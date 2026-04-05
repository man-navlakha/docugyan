const DEFAULT_BACKEND_BASE_URL = "http://127.0.0.1:8000";

function normalizeBoolean(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  return String(value).toLowerCase() === "true";
}

export function getBackendBaseUrl() {
  return process.env.AUTH_BACKEND_BASE_URL ?? process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? DEFAULT_BACKEND_BASE_URL;
}

export function getAuthCookieOptions() {
  const secure = normalizeBoolean(process.env.AUTH_COOKIE_SECURE, process.env.NODE_ENV === "production");
  const sameSite = process.env.AUTH_COOKIE_SAMESITE ?? (secure ? "none" : "lax");

  return {
    secure,
    sameSite,
    httpOnly: true,
    path: "/",
  };
}

export const ACCESS_COOKIE_NAME = "access";
export const REFRESH_COOKIE_NAME = "refresh";
export const ACCESS_COOKIE_MAX_AGE_SECONDS = 30 * 60;
export const REFRESH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
