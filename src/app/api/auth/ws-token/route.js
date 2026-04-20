import { buildBackendUrl, getRequestAuthHeaders, readJsonSafe } from "@/lib/auth/backend";

const WS_TOKEN_PATHS = ["/core/ws-token/", "/api/core/ws-token/"];

async function requestWsToken(request, path) {
  return fetch(buildBackendUrl(path), {
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
      ...getRequestAuthHeaders(request, { includeAuthorization: false }),
    },
    cache: "no-store",
  });
}

export async function GET(request) {
  try {
    let usedPath = WS_TOKEN_PATHS[0];
    let backendResponse = await requestWsToken(request, usedPath);

    if (backendResponse.status === 404) {
      usedPath = WS_TOKEN_PATHS[1];
      backendResponse = await requestWsToken(request, usedPath);
    }

    if (backendResponse.status === 401 || backendResponse.status === 403) {
      const refreshResponse = await refreshAuth(request);

      if (refreshResponse.ok) {
        backendResponse = await requestWsToken(request, usedPath);
      }
    }

    const payload = await readJsonSafe(backendResponse);
    return Response.json(payload, { status: backendResponse.status });
  } catch {
    return Response.json({ message: "Auth server unreachable." }, { status: 502 });
  }
}
