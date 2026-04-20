import { getBackendBaseUrl } from "@/lib/auth/config";

export function buildBackendUrl(pathname) {
  return new URL(pathname, getBackendBaseUrl()).toString();
}

export async function readJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export function getRequestAuthHeaders(request, options = {}) {
  const includeAuthorization = options?.includeAuthorization !== false;
  const accessTokenOverride = typeof options?.accessToken === "string" ? options.accessToken.trim() : "";
  const refreshTokenOverride = typeof options?.refreshToken === "string" ? options.refreshToken.trim() : "";
  const rawCookieOverride = typeof options?.cookieHeader === "string" ? options.cookieHeader.trim() : "";
  const headers = {};
  const authHeader = includeAuthorization ? request.headers.get("authorization") : "";
  const accessCookie = accessTokenOverride || request.cookies?.get("access")?.value || "";
  const refreshCookie = refreshTokenOverride || request.cookies?.get("refresh")?.value || "";

  if (includeAuthorization && authHeader) {
    headers.Authorization = authHeader;
  } else if (includeAuthorization && accessCookie) {
    headers.Authorization = `Bearer ${accessCookie}`;
  }

  const cookiePairs = [];
  if (accessCookie) {
    cookiePairs.push(`access=${accessCookie}`);
  }
  if (refreshCookie) {
    cookiePairs.push(`refresh=${refreshCookie}`);
  }
  if (cookiePairs.length > 0) {
    headers.Cookie = cookiePairs.join("; ");
  } else {
    const rawCookieHeader = rawCookieOverride || request.headers.get("cookie") || "";
    if (rawCookieHeader) {
      headers.Cookie = rawCookieHeader;
    }
  }

  return headers;
}
