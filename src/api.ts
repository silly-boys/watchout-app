import { BACKEND_BASE_URL } from "./constants";

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
