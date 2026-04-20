import { NextResponse } from "next/server";
import { buildBackendUrl, getRequestAuthHeaders } from "@/lib/auth/backend";
import { applyAuthCookies, clearAuthCookies } from "@/lib/auth/cookies";
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from "@/lib/auth/config";

const DASHBOARD_PATH = "/dashboard/agent";
const LOGIN_PATH = "/login";
const OTP_PATH = "/otp-verification";

function isPublicPath(pathname) {
  return pathname === LOGIN_PATH || pathname === OTP_PATH;
}

function isLoginPath(pathname) {
  return pathname === LOGIN_PATH;
}

function createLoginRedirectUrl(request) {
  const loginUrl = new URL(LOGIN_PATH, request.url);
  const from = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  if (from && from !== "/") {
    loginUrl.searchParams.set("from", from);
  }

  return loginUrl;
}

async function refreshAccessToken(request) {
  return fetch(buildBackendUrl("/api/core/token/refresh/"), {
    method: "POST",
    headers: {
      ...getRequestAuthHeaders(request, { includeAuthorization: false }),
    },
    cache: "no-store",
  });
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const isRootRoute = pathname === "/";
  const isLoginRoute = isLoginPath(pathname);
  const isPublicRoute = isPublicPath(pathname);

  const accessToken = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  if (accessToken) {
    if (isRootRoute || isPublicRoute) {
      return NextResponse.redirect(new URL(DASHBOARD_PATH, request.url));
    }

    return NextResponse.next();
  }

  if (refreshToken) {
    try {
      const refreshResponse = await refreshAccessToken(request);

      if (refreshResponse.ok) {
        const response = isRootRoute || isPublicRoute
          ? NextResponse.redirect(new URL(DASHBOARD_PATH, request.url))
          : NextResponse.next();

        applyAuthCookies(response, refreshResponse);
        return response;
      }

      if (isLoginRoute) {
        const response = NextResponse.next();
        clearAuthCookies(response);
        return response;
      }
    } catch {
      if (isLoginRoute) {
        const response = NextResponse.next();
        clearAuthCookies(response);
        return response;
      }
    }
  }

  if (!refreshToken && isLoginRoute) {
    const response = NextResponse.next();
    clearAuthCookies(response);
    return response;
  }

  if (isRootRoute || isPublicRoute) {
    const response = NextResponse.redirect(new URL(LOGIN_PATH, request.url));
    clearAuthCookies(response);
    return response;
  }

  const response = NextResponse.redirect(createLoginRedirectUrl(request));
  clearAuthCookies(response);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)"],
};
