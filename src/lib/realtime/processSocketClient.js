import { buildProcessWebSocketUrl } from "@/lib/api/docuApi";

const RECONNECT_DELAY_MS = 1500;
const PING_INTERVAL_MS = 25000;

function getGlobalState() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!window.__docugyanProcessSocketState) {
    window.__docugyanProcessSocketState = {
      socket: null,
      projectId: "",
      pingTimer: null,
      connectPromise: null,
      reconnectTimer: null,
      wsTokenProvider: null,
      onEvent: null,
      manualClose: false,
    };
  }

  return window.__docugyanProcessSocketState;
}

function clearTimers(state) {
  if (state.pingTimer) {
    window.clearInterval(state.pingTimer);
    state.pingTimer = null;
  }

  if (state.reconnectTimer) {
    window.clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }
}

function emitEvent(state, payload) {
  if (typeof state.onEvent === "function") {
    state.onEvent(payload);
  }
}

function sendPing(socket) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify({ type: "ping", source: "docugyan-fe" }));
}

async function connectInternal(state) {
  const wsTokenPayload = await state.wsTokenProvider();
  const wsToken = wsTokenPayload?.access_token?.trim();

  if (!wsToken) {
    throw new Error("Failed to get WebSocket token.");
  }

  const wsUrl = buildProcessWebSocketUrl(state.projectId, wsToken);

  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    state.socket = socket;

    const timeout = window.setTimeout(() => {
      try {
        socket.close();
      } catch {
        // Ignore close errors after timeout.
      }
      reject(new Error("WebSocket connection timed out."));
    }, 7000);

    socket.onopen = () => {
      window.clearTimeout(timeout);

      sendPing(socket);
      state.pingTimer = window.setInterval(() => {
        try {
          sendPing(socket);
        } catch {
          // Ignore ping send failures; onclose/onerror handles state.
        }
      }, PING_INTERVAL_MS);

      emitEvent(state, { type: "message", text: "WebSocket connected." });
      resolve(socket);
    };

    socket.onmessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        emitEvent(state, { type: "error", text: "Received non-JSON WebSocket event." });
        return;
      }

      if (payload?.type === "pong") {
        emitEvent(state, { type: "message", text: "Received pong from server." });
        return;
      }

      emitEvent(state, { type: "payload", payload });
    };

    socket.onerror = () => {
      window.clearTimeout(timeout);
      emitEvent(state, { type: "error", text: "WebSocket error occurred." });
      reject(new Error("WebSocket connection failed."));
    };

    socket.onclose = () => {
      window.clearTimeout(timeout);
      clearTimers(state);
      state.socket = null;
      emitEvent(state, { type: "message", text: "WebSocket disconnected." });

      if (!state.manualClose && state.projectId && typeof state.wsTokenProvider === "function") {
        state.reconnectTimer = window.setTimeout(() => {
          connectProcessSocket({
            projectId: state.projectId,
            wsTokenProvider: state.wsTokenProvider,
            onEvent: state.onEvent,
          }).catch(() => {
            // Reconnect failures are surfaced by caller/UI paths that consume onEvent.
          });
        }, RECONNECT_DELAY_MS);
      }
    };
  });
}

export async function connectProcessSocket({ projectId, wsTokenProvider, onEvent }) {
  const state = getGlobalState();
  if (!state) {
    throw new Error("WebSocket is only available in browser runtime.");
  }

  if (!projectId) {
    throw new Error("projectId is required for WebSocket connection.");
  }

  if (typeof wsTokenProvider !== "function") {
    throw new Error("wsTokenProvider is required.");
  }

  const previousProjectId = state.projectId;
  state.projectId = projectId;
  state.wsTokenProvider = wsTokenProvider;
  state.onEvent = onEvent;
  state.manualClose = false;

  if (state.socket && state.socket.readyState === WebSocket.OPEN) {
    if (previousProjectId !== projectId) {
      state.manualClose = true;
      try {
        state.socket.close();
      } catch {
        // Ignore close errors while switching project channels.
      }
      state.socket = null;
      state.manualClose = false;
    } else {
      return state.socket;
    }
  }

  if (state.socket && state.socket.readyState === WebSocket.CONNECTING) {
    if (previousProjectId === projectId && state.connectPromise) {
      return state.connectPromise;
    }

    state.manualClose = true;
    try {
      state.socket.close();
    } catch {
      // Ignore close errors while replacing pending connections.
    }
    state.socket = null;
    state.manualClose = false;
  }

  if (state.connectPromise) {
    return state.socket;
  }

  clearTimers(state);

  state.connectPromise = connectInternal(state)
    .finally(() => {
      state.connectPromise = null;
    });

  return state.connectPromise;
}

export function closeProcessSocket() {
  const state = getGlobalState();
  if (!state) {
    return;
  }

  state.manualClose = true;
  clearTimers(state);

  if (state.socket) {
    try {
      state.socket.close();
    } catch {
      // Ignore close errors when cleaning up.
    }
    state.socket = null;
  }
}
