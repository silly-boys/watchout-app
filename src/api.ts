import { BACKEND_BASE_URL } from "./constants";
import type { Point } from "./types";

export type EventType =
  | "FIRE"
  | "NO_HELMET"
  | "INTRUSION"
  | "FALL"
  | "EQUIPMENT_ANOMALY";

export type EventRecord = {
  type: EventType;
  timestamp: string;
};

export type BackendConnectionStatus = {
  ok: boolean;
  message: string;
};

export async function testBackendConnection(): Promise<BackendConnectionStatus> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${BACKEND_BASE_URL}/openapi.json`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        message: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    const title = data?.info?.title ?? "WatchOut Server";

    return {
      ok: true,
      message: `${title} 연결됨`,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "백엔드 응답 시간 초과"
        : "백엔드 연결 실패";

    return {
      ok: false,
      message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function upsertFence(points: Point[]) {
  const polygon = points.map((point) => [point.x, point.y]);

  const response = await fetch(`${BACKEND_BASE_URL}/api/fence`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ polygon }),
  });

  if (!response.ok) {
    throw new Error(`위험구역 저장 실패: HTTP ${response.status}`);
  }

  return response.json();
}

export async function getFence(): Promise<Point[]> {
  const response = await fetch(`${BACKEND_BASE_URL}/api/fence`);

  if (!response.ok) {
    throw new Error(`위험구역 조회 실패: HTTP ${response.status}`);
  }

  const data = await response.json();
  const polygon = data?.data?.polygon;

  if (!Array.isArray(polygon)) {
    return [];
  }

  return polygon
    .filter(
      (point): point is [number, number] =>
        Array.isArray(point) &&
        typeof point[0] === "number" &&
        typeof point[1] === "number"
    )
    .map(([x, y]) => ({ x, y }));
}

export async function getEvents(limit = 20): Promise<EventRecord[]> {
  const response = await fetch(`${BACKEND_BASE_URL}/api/events?limit=${limit}`);

  if (!response.ok) {
    throw new Error(`이벤트 조회 실패: HTTP ${response.status}`);
  }

  const data = await response.json();
  const events = data?.data;

  if (!Array.isArray(events)) {
    return [];
  }

  return events
    .filter(
      (event): event is EventRecord =>
        event &&
        typeof event.type === "string" &&
        typeof event.timestamp === "string"
    )
    .slice(0, limit);
}

export async function upsertFcmToken(token: string) {
  const response = await fetch(`${BACKEND_BASE_URL}/api/notifications/fcm-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    throw new Error(`푸시 토큰 등록 실패: HTTP ${response.status}`);
  }

  return response.json();
}
