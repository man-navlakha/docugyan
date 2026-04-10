import { NextResponse } from "next/server";
import { applyAuthCookies } from "@/lib/auth/cookies";
import { buildBackendUrl, getRequestAuthHeaders, readJsonSafe } from "@/lib/auth/backend";

const PROCESS_DATA_PATHS = ["/api/agent/process-data/", "/agent/process-data/"];

async function requestProcessData(request, projectId, path) {
  const backendUrl = new URL(buildBackendUrl(path));
  backendUrl.searchParams.set("project_id", projectId);

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
      ...getRequestAuthHeaders(request),
    },
    cache: "no-store",
  });
}

export async function GET(request) {
  const projectId = request.nextUrl.searchParams.get("project_id")?.trim();

  if (!projectId) {
    return Response.json({ message: "project_id is required." }, { status: 400 });
  }

  try {
    let usedPath = PROCESS_DATA_PATHS[0];
    let backendResponse = await requestProcessData(request, projectId, usedPath);

    if (backendResponse.status === 404) {
      usedPath = PROCESS_DATA_PATHS[1];
      backendResponse = await requestProcessData(request, projectId, usedPath);
    }

    let refreshResponse = null;
    if (backendResponse.status === 401 || backendResponse.status === 403) {
      refreshResponse = await refreshAuth(request);

      if (refreshResponse.ok) {
        backendResponse = await requestProcessData(request, projectId, usedPath);
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
