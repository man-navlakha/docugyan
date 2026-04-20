import { NextResponse } from "next/server";
import { applyAuthCookies } from "@/lib/auth/cookies";
import { buildBackendUrl, getRequestAuthHeaders, readJsonSafe } from "@/lib/auth/backend";

const PROFILE_PATHS = ["/api/agent/user-profile/", "/agent/user-profile/"];

async function requestProfile(request, path) {
  const backendUrl = new URL(buildBackendUrl(path));
  return fetch(backendUrl.toString(), {
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
    let usedPath = PROFILE_PATHS[0];
    let backendResponse = await requestProfile(request, usedPath);

    if (backendResponse.status === 404) {
      usedPath = PROFILE_PATHS[1];
      backendResponse = await requestProfile(request, usedPath);
    }

    let refreshResponse = null;
    if (backendResponse.status === 401 || backendResponse.status === 403) {
      refreshResponse = await refreshAuth(request);

      if (refreshResponse.ok) {
        backendResponse = await requestProfile(request, usedPath);
      }
    }

    const payload = await readJsonSafe(backendResponse);
    const response = NextResponse.json(payload, { status: backendResponse.status });

    if (refreshResponse?.ok) {
      applyAuthCookies(response, refreshResponse);
    }

    return response;
  } catch {
    return Response.json({ message: "Agent server unreachable." }, { status: 502 });
  }
}
