import {
  ACCESS_COOKIE_MAX_AGE_SECONDS,
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_MAX_AGE_SECONDS,
  REFRESH_COOKIE_NAME,
  getAuthCookieOptions,
} from "@/lib/auth/config";

function splitSetCookieHeader(setCookieHeader) {
  if (!setCookieHeader) {
    return [];
  }

  return setCookieHeader.split(/,(?=\s*[A-Za-z0-9_-]+=)/g);
}

function getSetCookieValues(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }

  const setCookie = response.headers.get("set-cookie");
  return splitSetCookieHeader(setCookie);
}

function pickCookieValue(setCookieValues, cookieName) {
  for (const setCookieValue of setCookieValues) {
    const match = setCookieValue.match(new RegExp(`(?:^|\\s)${cookieName}=([^;]+)`));
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

export function applyAuthCookies(nextResponse, backendResponse) {
  const setCookieValues = getSetCookieValues(backendResponse);
  const accessToken = pickCookieValue(setCookieValues, ACCESS_COOKIE_NAME);
  const refreshToken = pickCookieValue(setCookieValues, REFRESH_COOKIE_NAME);
  const options = getAuthCookieOptions();

  if (accessToken) {
    nextResponse.cookies.set({
      name: ACCESS_COOKIE_NAME,
      value: accessToken,
      maxAge: ACCESS_COOKIE_MAX_AGE_SECONDS,
      ...options,
    });
  }

  if (refreshToken) {
    nextResponse.cookies.set({
      name: REFRESH_COOKIE_NAME,
      value: refreshToken,
      maxAge: REFRESH_COOKIE_MAX_AGE_SECONDS,
      ...options,
    });
  }
}

export function clearAuthCookies(nextResponse) {
  nextResponse.cookies.set({
    name: ACCESS_COOKIE_NAME,
    value: "",
    expires: new Date(0),
    ...getAuthCookieOptions(),
  });
  nextResponse.cookies.set({
    name: REFRESH_COOKIE_NAME,
    value: "",
    expires: new Date(0),
    ...getAuthCookieOptions(),
  });
}
