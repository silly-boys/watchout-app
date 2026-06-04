import { Point } from "./types";

export function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function toSvgPoints(
  points: Point[],
  size: { width: number; height: number }
) {
  const width = size.width || 1;
  const height = size.height || 1;
  return points
    .map((point) => `${point.x * width},${point.y * height}`)
    .join(" ");
}

export function buildOfferUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const base = trimmed
    .replace(/\/(offer|stream|snapshot)\/?$/, "")
    .replace(/\/$/, "");
  return `${base}/offer`;
}

export function buildWebRTCHtml(offerUrl: string): string {
  const safeUrl = JSON.stringify(offerUrl);
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #1A1A2E; }
    video { width: 100%; height: 100%; object-fit: cover; display: block; }
    #overlay {
      position: absolute; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center; padding: 20px;
    }
    #overlay.hidden { display: none; }
    #msg { color: #fff; font-family: sans-serif; font-size: 16px; font-weight: 700; text-align: center; }
    #sub { margin-top: 8px; color: rgba(255,255,255,0.5); font-family: sans-serif; font-size: 13px; text-align: center; word-break: break-all; }
  </style>
</head>
<body>
  <video id="v" autoplay playsinline muted></video>
  <div id="overlay">
    <div id="msg">WebRTC 연결 중...</div>
    <div id="sub"></div>
  </div>
  <script>
    (async () => {
      const OFFER_URL = ${safeUrl};
      const overlay = document.getElementById('overlay');
      const msg = document.getElementById('msg');
      const sub = document.getElementById('sub');
      const video = document.getElementById('v');
      let pc;

      function showStatus(text, detail) {
        msg.textContent = text;
        sub.textContent = detail || '';
        overlay.classList.remove('hidden');
      }

      function cleanup() {
        if (video.srcObject) {
          video.srcObject.getTracks().forEach(track => track.stop());
          video.srcObject = null;
        }
        if (pc) {
          pc.ontrack = null;
          pc.onconnectionstatechange = null;
          pc.close();
          pc = null;
        }
      }

      window.addEventListener('pagehide', cleanup);
      window.addEventListener('beforeunload', cleanup);

      try {
        pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        pc.ontrack = (e) => {
          video.srcObject = e.streams[0];
          overlay.classList.add('hidden');
        };

        pc.onconnectionstatechange = () => {
          const s = pc.connectionState;
          if (s === 'failed' || s === 'disconnected') showStatus('연결 끊김', s);
        };

        pc.addTransceiver('video', { direction: 'recvonly' });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Wait for ICE gathering (max 5s)
        await new Promise(resolve => {
          if (pc.iceGatheringState === 'complete') { resolve(); return; }
          const timeout = setTimeout(resolve, 5000);
          pc.addEventListener('icegatheringstatechange', () => {
            if (pc.iceGatheringState === 'complete') { clearTimeout(timeout); resolve(); }
          });
        });

        const res = await fetch(OFFER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sdp: pc.localDescription.sdp, type: pc.localDescription.type })
        });

        if (!res.ok) throw new Error('서버 오류 ' + res.status);

        const answer = await res.json();
        await pc.setRemoteDescription(answer);

      } catch (err) {
        showStatus('연결 실패', err.message || String(err));
      }
    })();
  </script>
</body>
</html>`;
}
