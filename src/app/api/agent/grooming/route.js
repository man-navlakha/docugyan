import { NextResponse } from "next/server";
import { applyAuthCookies } from "@/lib/auth/cookies";
import { buildBackendUrl, getRequestAuthHeaders, readJsonSafe } from "@/lib/auth/backend";

const GROOMING_PATHS = ["/api/agent/grooming/", "/agent/grooming/"];

async function requestSaveGrooming(request, body, path) {
  return fetch(buildBackendUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getRequestAuthHeaders(request),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
}

async function requestGetGrooming(request, projectId, path) {
  const query = new URLSearchParams({ project_id: projectId }).toString();
  return fetch(buildBackendUrl(`${path}?${query}`), {
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
    let backendResponse = await requestSaveGrooming(request, postBody, usedPath);

    if (backendResponse.status === 404 && (await backendResponse.clone().text()).includes("Not Found")) {
      usedPath = GROOMING_PATHS[1];
      backendResponse = await requestSaveGrooming(request, postBody, usedPath);
    }

    let refreshResponse = null;
    if (backendResponse.status === 401 || backendResponse.status === 403) {
      refreshResponse = await refreshAuth(request);

      if (refreshResponse.ok) {
        backendResponse = await requestSaveGrooming(request, postBody, usedPath);
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
    let backendResponse = await requestGetGrooming(request, projectId, usedPath);

    if (backendResponse.status === 404 && (await backendResponse.clone().text()).includes("Not Found")) {
      usedPath = GROOMING_PATHS[1];
      backendResponse = await requestGetGrooming(request, projectId, usedPath);
    }

    let refreshResponse = null;
    if (backendResponse.status === 401 || backendResponse.status === 403) {
      refreshResponse = await refreshAuth(request);

      if (refreshResponse.ok) {
        backendResponse = await requestGetGrooming(request, projectId, usedPath);
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
