import { clearAuthCookies } from "@/lib/auth/cookies";
import { buildBackendUrl, getRequestAuthHeaders, readJsonSafe } from "@/lib/auth/backend";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const backendResponse = await fetch(buildBackendUrl("/logout/"), {
      method: "POST",
      headers: {
        ...getRequestAuthHeaders(request),
      },
      cache: "no-store",
    });

    const payload = await readJsonSafe(backendResponse);
    const response = NextResponse.json(payload, { status: backendResponse.status });
    clearAuthCookies(response);
    return response;
  } catch {
    const response = NextResponse.json({ message: "Logged out locally. Auth server unreachable." }, { status: 200 });
    clearAuthCookies(response);
    return response;
  }
}
