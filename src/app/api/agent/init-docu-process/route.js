import { buildBackendUrl, getRequestAuthHeaders, readJsonSafe } from "@/lib/auth/backend";

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  const userUuid = body?.user_uuid?.trim();
  if (!userUuid) {
    return Response.json({ message: "user_uuid is required." }, { status: 400 });
  }

  try {
    const backendResponse = await fetch(buildBackendUrl("/agent/init-docu-process/"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getRequestAuthHeaders(request),
      },
      body: JSON.stringify({ user_uuid: userUuid }),
      cache: "no-store",
    });

    const payload = await readJsonSafe(backendResponse);
    return Response.json(payload, { status: backendResponse.status });
  } catch {
    return Response.json({ message: "Agent server unreachable." }, { status: 502 });
  }
}
