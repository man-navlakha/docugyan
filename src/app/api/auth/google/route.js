import { applyAuthCookies } from "@/lib/auth/cookies";
import { buildBackendUrl, readJsonSafe } from "@/lib/auth/backend";
import { NextResponse } from "next/server";

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  const token = body?.token?.trim();
  if (!token) {
    return Response.json({ message: "Google token is required." }, { status: 400 });
  }

  try {
    const backendResponse = await fetch(buildBackendUrl("/google/"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });

    const payload = await readJsonSafe(backendResponse);
    const response = NextResponse.json(payload, { status: backendResponse.status });

    if (backendResponse.ok) {
      applyAuthCookies(response, backendResponse);
    }

    return response;
  } catch {
    return Response.json({ message: "Auth server unreachable." }, { status: 502 });
  }
}
