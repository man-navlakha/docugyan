import { buildBackendUrl, readJsonSafe } from "@/lib/auth/backend";

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  const email = body?.email?.trim();
  if (!email) {
    return Response.json({ message: "Email is required." }, { status: 400 });
  }

  try {
    const backendResponse = await fetch(buildBackendUrl("/Login_SignUp/"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      cache: "no-store",
    });

    const payload = await readJsonSafe(backendResponse);
    return Response.json(payload, { status: backendResponse.status });
  } catch {
    return Response.json({ message: "Auth server unreachable." }, { status: 502 });
  }
}
