import { NextResponse } from "next/server";
import { applyAuthCookies } from "@/lib/auth/cookies";
import { buildBackendUrl, getRequestAuthHeaders, readJsonSafe } from "@/lib/auth/backend";
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from "@/lib/auth/config";

const GROOMING_PATHS = ["/api/agent/grooming/", "/agent/grooming/"];

function splitSetCookieHeader(setCookieHeader) {
  if (!setCookieHeader) {
    return [];
  }

  return setCookieHeader.split(/,(?=\s*[A-Za-z0-9_-]+=)/g);
}

function getSetCookieValues(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }

  return splitSetCookieHeader(response.headers.get("set-cookie"));
}

function pickCookieValue(setCookieValues, cookieName) {
  for (const setCookieValue of setCookieValues) {
    const match = setCookieValue.match(new RegExp(`(?:^|\\s)${cookieName}=([^;]+)`));
    if (match?.[1]) {
      return match[1];
    }
  }

  return "";
}

function extractRefreshedTokens(refreshResponse) {
  const setCookieValues = getSetCookieValues(refreshResponse);
  const accessToken = pickCookieValue(setCookieValues, ACCESS_COOKIE_NAME);
  const refreshToken = pickCookieValue(setCookieValues, REFRESH_COOKIE_NAME);

  return { accessToken, refreshToken };
}

async function requestSaveGrooming(request, body, path, authHeaders = getRequestAuthHeaders(request)) {
  return fetch(buildBackendUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
}

async function requestGetGrooming(request, projectId, path, authHeaders = getRequestAuthHeaders(request)) {
  const query = new URLSearchParams({ project_id: projectId }).toString();
  return fetch(buildBackendUrl(`${path}?${query}`), {
    method: "GET",
    headers: {
      ...authHeaders,
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

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  const projectId = typeof body?.project_id === "string" ? body.project_id.trim() : "";
  const groomingData = body?.grooming_data;
  
  if (!projectId) {
    return Response.json({ message: "project_id is required." }, { status: 400 });
  }
  if (!groomingData) {
    return Response.json({ message: "grooming_data is required." }, { status: 400 });
  }

  const postBody = { project_id: projectId, grooming_data: groomingData };

  try {
    let usedPath = GROOMING_PATHS[0];
    let activeAuthHeaders = getRequestAuthHeaders(request);
    let backendResponse = await requestSaveGrooming(request, postBody, usedPath, activeAuthHeaders);

    if (backendResponse.status === 404) {
      usedPath = GROOMING_PATHS[1];
      backendResponse = await requestSaveGrooming(request, postBody, usedPath, activeAuthHeaders);
    }

    let refreshResponse = null;
    if (backendResponse.status === 401 || backendResponse.status === 403) {
      refreshResponse = await refreshAuth(request);

      if (refreshResponse.ok) {
        const refreshedTokens = extractRefreshedTokens(refreshResponse);
        activeAuthHeaders = getRequestAuthHeaders(request, {
          accessToken: refreshedTokens.accessToken,
          refreshToken: refreshedTokens.refreshToken,
        });
        backendResponse = await requestSaveGrooming(request, postBody, usedPath, activeAuthHeaders);

        if (backendResponse.status === 404 && usedPath === GROOMING_PATHS[0]) {
          usedPath = GROOMING_PATHS[1];
          backendResponse = await requestSaveGrooming(request, postBody, usedPath, activeAuthHeaders);
        }
      }

      if ((backendResponse.status === 401 || backendResponse.status === 403) && usedPath === GROOMING_PATHS[0]) {
        usedPath = GROOMING_PATHS[1];
        backendResponse = await requestSaveGrooming(request, postBody, usedPath, activeAuthHeaders);
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

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const projectId = (searchParams.get("project_id") || "").trim();

  if (!projectId) {
    return Response.json({ message: "project_id is required." }, { status: 400 });
  }

  try {
    let usedPath = GROOMING_PATHS[0];
    let activeAuthHeaders = getRequestAuthHeaders(request);
    let backendResponse = await requestGetGrooming(request, projectId, usedPath, activeAuthHeaders);

    if (backendResponse.status === 404) {
      usedPath = GROOMING_PATHS[1];
      backendResponse = await requestGetGrooming(request, projectId, usedPath, activeAuthHeaders);
    }

    let refreshResponse = null;
    if (backendResponse.status === 401 || backendResponse.status === 403) {
      refreshResponse = await refreshAuth(request);

      if (refreshResponse.ok) {
        const refreshedTokens = extractRefreshedTokens(refreshResponse);
        activeAuthHeaders = getRequestAuthHeaders(request, {
          accessToken: refreshedTokens.accessToken,
          refreshToken: refreshedTokens.refreshToken,
        });
        backendResponse = await requestGetGrooming(request, projectId, usedPath, activeAuthHeaders);

        if (backendResponse.status === 404 && usedPath === GROOMING_PATHS[0]) {
          usedPath = GROOMING_PATHS[1];
          backendResponse = await requestGetGrooming(request, projectId, usedPath, activeAuthHeaders);
        }
      }

      if ((backendResponse.status === 401 || backendResponse.status === 403) && usedPath === GROOMING_PATHS[0]) {
        usedPath = GROOMING_PATHS[1];
        backendResponse = await requestGetGrooming(request, projectId, usedPath, activeAuthHeaders);
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
