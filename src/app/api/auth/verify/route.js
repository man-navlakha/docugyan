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

  const id = Number(body?.id);
  const otp = body?.otp?.trim();

  if (!Number.isInteger(id) || id < 1 || !otp) {
    return Response.json({ message: "Valid id and otp are required." }, { status: 400 });
  }

  try {
    const backendResponse = await fetch(buildBackendUrl("/otp-verify/"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, otp }),
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
