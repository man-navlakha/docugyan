import { applyAuthCookies, clearAuthCookies } from "@/lib/auth/cookies";
import { buildBackendUrl, getRequestAuthHeaders, readJsonSafe } from "@/lib/auth/backend";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const backendResponse = await fetch(buildBackendUrl("/api/core/token/refresh/"), {
      method: "POST",
      headers: {
        ...getRequestAuthHeaders(request, { includeAuthorization: false }),
      },
      cache: "no-store",
    });

    const payload = await readJsonSafe(backendResponse);
    const response = NextResponse.json(payload, { status: backendResponse.status });

    if (backendResponse.ok) {
      applyAuthCookies(response, backendResponse);
    } else if (backendResponse.status === 401 || backendResponse.status === 403) {
      clearAuthCookies(response);
    }

    return response;
  } catch {
    return NextResponse.json({ message: "Auth server unreachable." }, { status: 502 });
  }
}
