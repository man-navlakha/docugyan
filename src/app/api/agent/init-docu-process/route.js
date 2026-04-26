import { NextResponse } from "next/server";
import { applyAuthCookies } from "@/lib/auth/cookies";
import { buildBackendUrl, getRequestAuthHeaders, readJsonSafe } from "@/lib/auth/backend";

const INIT_PATHS = ["/api/agent/init-docu-process/", "/agent/init-docu-process/"];

async function requestInitDocuProcess(request, initBody, path) {
  return fetch(buildBackendUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getRequestAuthHeaders(request),
    },
    body: JSON.stringify(initBody),
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

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const userUuid = typeof body?.user_uuid === "string" ? body.user_uuid.trim() : "";
  const initBody = {
    ...(userUuid ? { user_uuid: userUuid } : {}),
    ...(text ? { text } : {}),
    ...(description ? { description } : {}),
  };

  try {
    let usedPath = INIT_PATHS[0];
    let backendResponse = await requestInitDocuProcess(request, initBody, usedPath);

    if (backendResponse.status === 404) {
      usedPath = INIT_PATHS[1];
      backendResponse = await requestInitDocuProcess(request, initBody, usedPath);
    }

    let refreshResponse = null;
    if (backendResponse.status === 401 || backendResponse.status === 403) {
      refreshResponse = await refreshAuth(request);

      if (refreshResponse.ok) {
        backendResponse = await requestInitDocuProcess(request, initBody, usedPath);
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
