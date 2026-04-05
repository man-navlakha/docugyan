import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from "@/lib/auth/config";

export async function GET(request) {
  const access = request.cookies?.get(ACCESS_COOKIE_NAME)?.value ?? null;
  const refresh = request.cookies?.get(REFRESH_COOKIE_NAME)?.value ?? null;

  return Response.json({
    authenticated: !!access,
    hasAccessToken: !!access,
    hasRefreshToken: !!refresh,
  });
}
