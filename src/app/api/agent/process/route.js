import { buildBackendUrl, getRequestAuthHeaders, readJsonSafe } from "@/lib/auth/backend";

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  const projectId = body?.project_id?.trim();
  const userUuid = body?.user_uuid?.trim();
  const referenceUrls = Array.isArray(body?.reference_urls) ? body.reference_urls : [];
  const questionUrls = Array.isArray(body?.question_urls) ? body.question_urls : [];

  if (!projectId || !userUuid) {
    return Response.json({ message: "project_id and user_uuid are required." }, { status: 400 });
  }

  try {
    const backendResponse = await fetch(buildBackendUrl("/agent/process/"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getRequestAuthHeaders(request),
      },
      body: JSON.stringify({
        project_id: projectId,
        user_uuid: userUuid,
        reference_urls: referenceUrls,
        question_urls: questionUrls,
      }),
      cache: "no-store",
    });

    const payload = await readJsonSafe(backendResponse);
    return Response.json(payload, { status: backendResponse.status });
  } catch {
    return Response.json({ message: "Agent server unreachable." }, { status: 502 });
  }
}
