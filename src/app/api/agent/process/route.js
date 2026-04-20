import { NextResponse } from "next/server";
import { applyAuthCookies } from "@/lib/auth/cookies";
import { buildBackendUrl, getRequestAuthHeaders, readJsonSafe } from "@/lib/auth/backend";

const PROCESS_PATHS = ["/api/agent/process/", "/agent/process/"];

function normalizeUrlArray(value) {
  const flattened = [];

  const normalizeCandidateUrl = (raw) => {
    if (typeof raw !== "string") {
      return "";
    }

    const next = raw.trim();
    if (!next) {
      return "";
    }

    try {
      const parsed = new URL(next);
      const isBlobProxyPath = parsed.pathname.endsWith("/api/uploads/blob") || parsed.pathname.endsWith("/blob");
      const nested = parsed.searchParams.get("url");
      if (isBlobProxyPath && nested) {
        return nested.trim();
      }
    } catch {
      // keep original candidate when URL parsing fails
    }

    return next;
  };

  const walk = (input) => {
    if (Array.isArray(input)) {
      for (const item of input) {
        walk(item);
      }
      return;
    }

    if (typeof input !== "string") {
      return;
    }

    const next = normalizeCandidateUrl(input);
    if (!next) {
      return;
    }

    flattened.push(next);
  };

  walk(value);
  return flattened;
}

async function requestProcess(request, body, path) {
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

  const projectId = body?.project_id?.trim();
  const referenceUrls = normalizeUrlArray(body?.reference_urls);
  const questionUrls = normalizeUrlArray(body?.question_urls);

  if (!projectId) {
    return Response.json({ message: "project_id is required." }, { status: 400 });
  }

  const processBody = {
    project_id: projectId,
    reference_urls: referenceUrls,
    question_urls: questionUrls[0] || "",
  };

  try {
    let usedPath = PROCESS_PATHS[0];
    let backendResponse = await requestProcess(request, processBody, usedPath);

    if (backendResponse.status === 404) {
      usedPath = PROCESS_PATHS[1];
      backendResponse = await requestProcess(request, processBody, usedPath);
    }

    let refreshResponse = null;
    if (backendResponse.status === 401 || backendResponse.status === 403) {
      refreshResponse = await refreshAuth(request);

      if (refreshResponse.ok) {
        backendResponse = await requestProcess(request, processBody, usedPath);
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
