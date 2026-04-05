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

export function getRequestAuthHeaders(request) {
  const headers = {};
  const authHeader = request.headers.get("authorization");
  const accessCookie = request.cookies?.get("access")?.value;
  const refreshCookie = request.cookies?.get("refresh")?.value;

  if (authHeader) {
    headers.Authorization = authHeader;
  } else if (accessCookie) {
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
  }

  return headers;
}
