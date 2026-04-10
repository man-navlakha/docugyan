import { buildBackendUrl, getRequestAuthHeaders, readJsonSafe } from "@/lib/auth/backend";

async function requestWsToken(request) {
  return fetch(buildBackendUrl("/core/ws-token/"), {
    method: "GET",
    headers: {
      ...getRequestAuthHeaders(request),
    },
    cache: "no-store",
  });
}

async function refreshAuth(request) {
  return fetch(buildBackendUrl("/api/core/token/refresh/"), {
    method: "POST",
    headers: {
      ...getRequestAuthHeaders(request),
    },
    cache: "no-store",
  });
}

export async function GET(request) {
  try {
    let backendResponse = await requestWsToken(request);

    if (backendResponse.status === 401 || backendResponse.status === 403) {
      const refreshResponse = await refreshAuth(request);

      if (refreshResponse.ok) {
        backendResponse = await requestWsToken(request);
      }
    }

    const payload = await readJsonSafe(backendResponse);
    return Response.json(payload, { status: backendResponse.status });
  } catch {
    return Response.json({ message: "Auth server unreachable." }, { status: 502 });
  }
}
