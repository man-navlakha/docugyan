import { NextResponse } from "next/server";
import { ACCESS_COOKIE_NAME } from "@/lib/auth/config";

export function proxy(request) {
  const pathname = request.nextUrl.pathname;
  const hasAccessToken = Boolean(request.cookies.get(ACCESS_COOKIE_NAME)?.value);

  if (pathname.startsWith("/dashboard") && !hasAccessToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && hasAccessToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
