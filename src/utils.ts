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

export function normalizeStreamUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (trimmed.endsWith("/stream")) return trimmed;
  if (trimmed.endsWith("/snapshot"))
    return trimmed.replace(/\/snapshot$/, "/stream");
  return `${trimmed.replace(/\/$/, "")}/stream`;
}

export function buildStreamHtml(streamUrl: string) {
  const safeUrl = JSON.stringify(streamUrl);

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #8f8f8f; }
    img { width: 100%; height: 100%; object-fit: cover; display: block; }
    #status {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: #fff;
      font-size: 14px;
      line-height: 1.45;
      font-family: sans-serif;
      text-align: center;
      padding: 16px;
      background: #8f8f8f;
    }
    #status.hidden { display: none; }
    small { display: block; margin-top: 6px; color: rgba(255,255,255,0.72); word-break: break-all; }
  </style>
</head>
<body>
  <img id="stream" alt="camera stream" />
  <div id="status">스트림 연결 중<small></small></div>
  <script>
    const streamUrl = ${safeUrl};
    const img = document.getElementById("stream");
    const status = document.getElementById("status");
    const statusUrl = status.querySelector("small");
    let previousUrl = null;

    statusUrl.textContent = streamUrl;

    function setStatus(message, isVisible = true) {
      status.firstChild.nodeValue = message;
      status.className = isVisible ? "" : "hidden";
    }

    function concat(a, b) {
      const c = new Uint8Array(a.length + b.length);
      c.set(a, 0);
      c.set(b, a.length);
      return c;
    }

    function findSequence(buf, seq) {
      outer: for (let i = 0; i <= buf.length - seq.length; i++) {
        for (let j = 0; j < seq.length; j++) {
          if (buf[i + j] !== seq[j]) continue outer;
        }
        return i;
      }
      return -1;
    }

    async function start() {
      if (!streamUrl) {
        setStatus("스트림 주소를 입력하세요");
        return;
      }

      try {
        const response = await fetch(streamUrl, {
          headers: {
            "ngrok-skip-browser-warning": "1",
            "Cache-Control": "no-cache"
          }
        });

        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }

        if (!response.body || !response.body.getReader) {
          img.src = streamUrl;
          setStatus("", false);
          return;
        }

        const reader = response.body.getReader();
        let buffer = new Uint8Array();
        const soi = [0xff, 0xd8];
        const eoi = [0xff, 0xd9];

        while (true) {
          const result = await reader.read();
          if (result.done) break;

          buffer = concat(buffer, result.value);
          const startIndex = findSequence(buffer, soi);
          const endIndex = findSequence(buffer, eoi);

          if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
            const jpeg = buffer.slice(startIndex, endIndex + 2);
            buffer = buffer.slice(endIndex + 2);
            const objectUrl = URL.createObjectURL(
              new Blob([jpeg], { type: "image/jpeg" })
            );

            img.src = objectUrl;
            setStatus("", false);

            if (previousUrl) URL.revokeObjectURL(previousUrl);
            previousUrl = objectUrl;
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown";
        setStatus("스트림 연결 실패: " + message);
      }
    }

    start();
  </script>
</body>
</html>`;
}
