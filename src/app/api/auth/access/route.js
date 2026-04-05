import { ACCESS_COOKIE_NAME } from "@/lib/auth/config";

export async function GET(request) {
  const accessToken = request.cookies?.get(ACCESS_COOKIE_NAME)?.value;

  if (!accessToken) {
    return Response.json({ message: "Access token is not available." }, { status: 401 });
  }

  return Response.json({ access_token: accessToken });
}
