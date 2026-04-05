import { buildBackendUrl, readJsonSafe } from "@/lib/auth/backend";

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  const id = Number(body?.id);
  const key = typeof body?.key === "string" ? body.key : undefined;

  if (!Number.isInteger(id) || id < 1) {
    return Response.json({ message: "Valid id is required." }, { status: 400 });
  }

  try {
    const backendResponse = await fetch(buildBackendUrl("/resend-otp/"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...(key ? { key } : {}) }),
      cache: "no-store",
    });

    const payload = await readJsonSafe(backendResponse);
    return Response.json(payload, { status: backendResponse.status });
  } catch {
    return Response.json({ message: "Auth server unreachable." }, { status: 502 });
  }
}
