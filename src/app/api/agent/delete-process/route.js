import { NextResponse } from "next/server";
import { applyAuthCookies } from "@/lib/auth/cookies";
import { buildBackendUrl, getRequestAuthHeaders, readJsonSafe } from "@/lib/auth/backend";

const DELETE_PATHS = ["/api/agent/delete-process/", "/agent/delete-process/"];

async function requestDeleteProcess(request, body, path) {
  return fetch(buildBackendUrl(path), {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...getRequestAuthHeaders(request),
    },
    body: JSON.stringify(body),
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

export async function DELETE(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  const projectId = typeof body?.project_id === "string" ? body.project_id.trim() : "";
  
  if (!projectId) {
    return Response.json({ message: "project_id is required." }, { status: 400 });
  }

  const deleteBody = { project_id: projectId };

  try {
    let usedPath = DELETE_PATHS[0];
    let backendResponse = await requestDeleteProcess(request, deleteBody, usedPath);

    if (backendResponse.status === 404 && (await backendResponse.clone().text()).includes('Not Found')) {
      usedPath = DELETE_PATHS[1];
      backendResponse = await requestDeleteProcess(request, deleteBody, usedPath);
    }

    let refreshResponse = null;
    if (backendResponse.status === 401 || backendResponse.status === 403) {
      refreshResponse = await refreshAuth(request);

      if (refreshResponse.ok) {
        backendResponse = await requestDeleteProcess(request, deleteBody, usedPath);
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
