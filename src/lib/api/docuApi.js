const DEFAULT_BACKEND_BASE_URL = "http://127.0.0.1:8000";
const AUTH_PROXY_BASE = "/api/auth";
const AGENT_PROXY_BASE = "/api/agent";

export const LOCAL_STORAGE_KEYS = {
  userUuid: "docugyan_user_uuid",
  accessToken: "docugyan_access_token",
  projectId: "docugyan_project_id",
  blobCollection: "docugyan_blob_collection",
  taskId: "docugyan_task_id",
};

/**
 * @typedef {Object} ApiRequestErrorPayload
 * @property {string=} message
 * @property {string=} error
 * @property {string=} detail
 */

export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   * @param {unknown} payload
   * @param {string} url
   */
  constructor(message, status, payload, url) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
    this.url = url;
  }
}

export function getBackendBaseUrl() {
  return process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? DEFAULT_BACKEND_BASE_URL;
}

async function readJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function extractFieldError(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  for (const [key, value] of Object.entries(payload)) {
    if (isNonEmptyString(value)) {
      return `${key}: ${value}`;
    }
    if (Array.isArray(value) && value.length > 0 && isNonEmptyString(value[0])) {
      return `${key}: ${value[0]}`;
    }
  }

  return "";
}

export function parseApiError(payload, status, fallbackMessage = "Request failed.") {
  if (payload && typeof payload === "object") {
    const directMessage = payload.message ?? payload.error ?? payload.detail;
    if (isNonEmptyString(directMessage)) {
      return directMessage;
    }

    const fieldMessage = extractFieldError(payload);
    if (fieldMessage) {
      return fieldMessage;
    }
  }

  if (status === 400) {
    return "Bad request. Check your input and try again.";
  }
  if (status === 404) {
    return "Requested resource was not found.";
  }
  if (status >= 500) {
    return "Server error. Please retry in a moment.";
  }

  return fallbackMessage;
}

function shouldRetryAfterUnauthorized(url) {
  return url.startsWith(AGENT_PROXY_BASE) || url === `${AUTH_PROXY_BASE}/access`;
}

function normalizeUrlArray(value) {
  const flattened = [];

  const walk = (input) => {
    if (Array.isArray(input)) {
      for (const item of input) {
        walk(item);
      }
      return;
    }

    if (typeof input !== "string") {
      return;
    }

    const next = input.trim();
    if (next) {
      flattened.push(next);
    }
  };

  walk(value);
  return flattened;
}

async function refreshAuthToken() {
  try {
    const response = await fetch(`${AUTH_PROXY_BASE}/refresh`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function requestJson(url, init = {}, fallbackMessage = "Request failed.") {
  let response;

  try {
    response = await fetch(url, {
      cache: "no-store",
      ...init,
    });
  } catch {
    throw new ApiError("Network error. Backend is unreachable.", 0, null, url);
  }

  let payload = await readJsonSafe(response);

  if (response.status === 401 && shouldRetryAfterUnauthorized(url)) {
    const refreshed = await refreshAuthToken();

    if (refreshed) {
      try {
        response = await fetch(url, {
          cache: "no-store",
          ...init,
        });
        payload = await readJsonSafe(response);
      } catch {
        throw new ApiError("Network error. Backend is unreachable.", 0, null, url);
      }
    }
  }

  if (!response.ok) {
    throw new ApiError(parseApiError(payload, response.status, fallbackMessage), response.status, payload, url);
  }

  return payload;
}

function authRequest(pathname, init = {}, fallbackMessage) {
  return requestJson(`${AUTH_PROXY_BASE}${pathname}`, { credentials: "include", ...init }, fallbackMessage);
}

function agentRequest(pathname, init = {}, fallbackMessage) {
  return requestJson(`${AGENT_PROXY_BASE}${pathname}`, { credentials: "include", ...init }, fallbackMessage);
}

/**
 * @typedef {Object} LoginSignUpResponse
 * @property {number} id
 * @property {string=} key
 * @property {string=} status
 * @property {string=} message
 */
export async function loginSignUp(email) {
  return authRequest(
    "/start",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    },
    "Failed to start login."
  );
}

/**
 * @typedef {Object} OtpVerifyResponse
 * @property {string=} user_uuid
 * @property {string=} message
 */
export async function verifyOtp(id, otp) {
  return authRequest(
    "/verify",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, otp }),
    },
    "OTP verification failed."
  );
}

/**
 * @typedef {Object} GoogleLoginResponse
 * @property {string=} user_uuid
 * @property {string=} message
 */
export async function googleLogin(token) {
  return authRequest(
    "/google",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    },
    "Google login failed."
  );
}

export async function resendOtp(id, key) {
  return authRequest(
    "/resend",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(key ? { id, key } : { id }),
    },
    "Failed to resend OTP."
  );
}

export async function fetchAccessToken() {
  return authRequest("/access", { method: "GET" }, "Unable to fetch access token.");
}

export async function fetchWsToken() {
  return requestJson(
    "/api/core/ws-token/",
    {
      method: "GET",
      credentials: "include",
    },
    "Unable to fetch WebSocket token."
  );
}

export async function logout() {
  return authRequest("/logout", { method: "POST" }, "Logout failed.");
}

/**
 * @typedef {Object} InitDocuProcessResponse
 * @property {string} project_id
 * @property {string} blob_collection
 */
export async function initDocuProcess() {
  return agentRequest(
    "/init-docu-process",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
    "Failed to initialize document process."
  );
}

/**
 * @typedef {Object} ProcessResponse
 * @property {string=} project_id
 * @property {string=} task_id
 * @property {string=} message
 */
export async function startDocuProcess({ project_id, reference_urls, question_urls }) {
  const normalizedReferenceUrls = normalizeUrlArray(reference_urls);
  const normalizedQuestionUrls = normalizeUrlArray(question_urls);

  return agentRequest(
    "/process",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: project_id?.trim?.() ?? project_id,
        reference_urls: normalizedReferenceUrls,
        question_urls: normalizedQuestionUrls[0] ?? "",
      }),
    },
    "Failed to start processing."
  );
}

export async function fetchDocuProcessData(projectId) {
  const nextProjectId = projectId?.trim?.() ?? projectId;

  return agentRequest(
    `/process-data?project_id=${encodeURIComponent(nextProjectId ?? "")}`,
    {
      method: "GET",
    },
    "Failed to load workspace data."
  );
}

export async function fetchUserProfile() {
  return agentRequest(
    "/user-profile",
    {
      method: "GET",
    },
    "Failed to load user profile."
  );
}

/**
 * @typedef {Object} DocuProcessListItem
 * @property {string} project_id
 * @property {string} user_uuid
 * @property {string=} title
 * @property {string=} description
 * @property {string[]|string=} reference_urls
 * @property {string[]|string=} question_urls
 * @property {string[]|string=} result_urls
 * @property {string=} created_at
 * @property {string=} status
 */

/**
 * @typedef {Object} DocuProcessListResponse
 * @property {number=} count
 * @property {string|null=} next
 * @property {string|null=} previous
 * @property {DocuProcessListItem[]=} results
 */
export async function fetchDocuProcessList({ page = 1, pageSize = 10, search = "" } = {}) {
  const nextPage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  const nextPageSize = Number.isFinite(pageSize) ? Math.min(50, Math.max(1, Math.floor(pageSize))) : 10;

  const params = new URLSearchParams();
  params.set("page", String(nextPage));
  params.set("page_size", String(nextPageSize));

  if (typeof search === "string" && search.trim()) {
    params.set("search", search.trim());
  }

  return agentRequest(
    `/process-list?${params.toString()}`,
    {
      method: "GET",
    },
    "Failed to load document history."
  );
}

export async function uploadFileToBlob(file, folder, options = {}) {
  const formData = new FormData();
  formData.set("file", file);
  if (folder) {
    formData.set("folder", folder);
  }

  if (options?.overwrite) {
    formData.set("overwrite", "true");
  }

  if (options?.sourceUrl) {
    formData.set("source_url", options.sourceUrl);
  }

  if (options?.pathname) {
    formData.set("pathname", options.pathname);
  }

  return requestJson(
    "/api/uploads/blob",
    {
      method: "POST",
      body: formData,
    },
    "File upload failed."
  );
}

export function buildProcessWebSocketUrl(projectId, accessToken) {
  const backendBase = new URL(getBackendBaseUrl());
  let protocol = backendBase.protocol === "https:" ? "wss:" : "ws:";
  let host = backendBase.host; // e.g. "127.0.0.1:8000"

  // If running in the browser and the backend is configured to loopback,
  // but we are accessing it via a LAN IP (like 172.x or 192.x),
  // we must swap the loopback IP for the LAN IP so the phone/external device
  // actually attempts to connect to the server device instead of itself.
  if (typeof window !== "undefined" && backendBase.hostname === "127.0.0.1" && window.location.hostname !== "127.0.0.1" && window.location.hostname !== "localhost") {
    host = `${window.location.hostname}:${backendBase.port || "8000"}`;
    protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  }

  const wsUrl = new URL(`/ws/agent/process/${projectId}/`, `${protocol}//${host}`);
  wsUrl.searchParams.set("client", "docugyan-fe");

  if (accessToken) {
    wsUrl.searchParams.set("token", accessToken);
  }

  return wsUrl.toString();
}

export function clearStoredProcessState() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(LOCAL_STORAGE_KEYS.projectId);
  window.localStorage.removeItem(LOCAL_STORAGE_KEYS.blobCollection);
  window.localStorage.removeItem(LOCAL_STORAGE_KEYS.taskId);
}

export async function deleteDocuProcess(projectId) {
  return agentRequest(
    "/delete-process",
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    },
    "Failed to delete document process."
  );
}

export async function saveGroomingData(projectId, groomingData) {
  return agentRequest(
    "/grooming",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, grooming_data: groomingData }),
    },
    "Failed to save grooming data."
  );
}

export async function fetchGroomingData(projectId) {
  const nextProjectId = projectId?.trim?.() ?? projectId;

  return agentRequest(
    `/grooming?project_id=${encodeURIComponent(nextProjectId ?? "")}`,
    {
      method: "GET",
    },
    "Failed to fetch grooming data."
  );
}
