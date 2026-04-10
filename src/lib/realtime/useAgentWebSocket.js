"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWsToken } from "@/lib/api/docuApi";
import { connectProcessSocket } from "@/lib/realtime/processSocketClient";

const NODE_ID_ALIASES = {
  input: "input",
  query: "input",
  orchestrator: "orchestrator",
  orchestrator_agent: "orchestrator",
  academic: "academic",
  academic_agent: "academic",
  extractor: "extractor",
  extractor_agent: "extractor",
  synthesize: "synthesize",
  synthesize_output: "synthesize",
  final: "final",
  final_result: "final",
};

function normalizeNodeId(rawNode) {
  if (!rawNode || typeof rawNode !== "string") {
    return "";
  }

  const normalized = rawNode.trim().toLowerCase();
  return NODE_ID_ALIASES[normalized] ?? "";
}

function looksLikeUrl(value) {
  if (typeof value !== "string") {
    return false;
  }

  const next = value.trim();
  if (!next) {
    return false;
  }

  try {
    const parsed = new URL(next);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function extractUrlFromText(text) {
  if (typeof text !== "string" || !text.trim()) {
    return "";
  }

  const match = text.match(/https?:\/\/[^\s"'<>]+/i);
  return match?.[0]?.trim?.() || "";
}

function pickFirstUrl(value) {
  if (typeof value === "string") {
    const next = value.trim();
    return looksLikeUrl(next) ? next : "";
  }

  if (!Array.isArray(value)) {
    return "";
  }

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }
    const next = item.trim();
    if (looksLikeUrl(next)) {
      return next;
    }
  }

  return "";
}

function findCandidateUrlDeep(root) {
  const queue = [root];
  const visited = new Set();

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current || typeof current !== "object" || visited.has(current)) {
      continue;
    }

    visited.add(current);

    if (Array.isArray(current)) {
      for (const item of current) {
        if (typeof item === "string" && looksLikeUrl(item)) {
          return item.trim();
        }
        if (item && typeof item === "object") {
          queue.push(item);
        }
      }
      continue;
    }

    for (const [key, value] of Object.entries(current)) {
      if (typeof value === "string") {
        const normalizedKey = key.toLowerCase();
        const keyIndicatesUrl = normalizedKey.includes("url") || normalizedKey.includes("link") || normalizedKey.includes("result");

        if (keyIndicatesUrl && looksLikeUrl(value)) {
          return value.trim();
        }
      }

      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return "";
}

export function useAgentWebSocket(projectId, enabled = true) {
  const isEnabled = typeof enabled === "object" ? Boolean(enabled?.enabled) : Boolean(enabled);
  const [currentNode, setCurrentNode] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [generatedDocument, setGeneratedDocument] = useState("");
  const [finalAnswerState, setFinalAnswerState] = useState({ projectId: "", url: "" });
  const [connectionState, setConnectionState] = useState("idle");
  const [logs, setLogs] = useState([]);
  const [lastEventType, setLastEventType] = useState("");

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const appendLog = useCallback((type, text) => {
    setLogs((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random()}`,
        type,
        message: text,
        at: new Date().toLocaleTimeString(),
      },
    ]);
  }, []);

  const finalAnswerUrl = finalAnswerState.projectId === projectId ? finalAnswerState.url : "";

  const updateFinalAnswerUrl = useCallback(
    (url) => {
      if (typeof url !== "string" || !url.trim()) {
        return;
      }

      setFinalAnswerState({
        projectId,
        url: url.trim(),
      });
    },
    [projectId]
  );

  useEffect(() => {
    if (!isEnabled || !projectId) {
      return;
    }

    let isDisposed = false;

    connectProcessSocket({
      projectId,
      wsTokenProvider: fetchWsToken,
      onEvent: (event) => {
        if (isDisposed || !event) {
          return;
        }

        if (event.type === "error") {
          setLastEventType("error");
          setConnectionState("error");
          setStatus("error");
          setMessage(event.text || "WebSocket error.");
          appendLog("error", event.text || "WebSocket error.");
          return;
        }

        if (event.type === "message") {
          setLastEventType("message");
          const text = event.text || "Socket update";
          setMessage(text);
          appendLog("message", text);

          if (text.toLowerCase().includes("connected")) {
            setConnectionState("connected");
          }
          if (text.toLowerCase().includes("disconnected")) {
            setConnectionState("disconnected");
          }
          return;
        }

        if (event.type !== "payload") {
          return;
        }

        const payload = event.payload ?? {};
        const data = payload.data ?? payload;
        const payloadEventType = (payload.event_type ?? data.event_type ?? "message").toString().trim().toLowerCase();

        setLastEventType(payloadEventType);

        const nextNode = normalizeNodeId(payload.current_node ?? data.current_node);
        if (nextNode) {
          setCurrentNode(nextNode);
        }

        const nextStatus = (payload.status ?? data.status ?? "").toString().trim().toLowerCase();
        if (nextStatus) {
          setStatus(nextStatus);
        }

        const nextMessage = (payload.message ?? data.message ?? data.text ?? "").toString();
        if (nextMessage) {
          setMessage(nextMessage);
          appendLog(payloadEventType || nextStatus || "message", nextMessage);
        } else if (payloadEventType === "completed") {
          appendLog("completed", "Agent process completed.");
        }

        const candidateUrl =
          payload.final_answer_url ??
          data.final_answer_url ??
          payload.final_ans_url ??
          data.final_ans_url ??
          payload.answer_url ??
          data.answer_url ??
          payload.result_url ??
          data.result_url ??
          payload.output_url ??
          data.output_url;

        const resultPayload = data.result ?? payload.result ?? {};
        const prioritizedFinalAnswerUrl =
          pickFirstUrl(resultPayload?.final_answers_blob_url) ||
          pickFirstUrl(resultPayload?.final_answer_blob_url) ||
          pickFirstUrl(resultPayload?.final_answer_url) ||
          pickFirstUrl(resultPayload?.final_answers_url);

        if (prioritizedFinalAnswerUrl) {
          updateFinalAnswerUrl(prioritizedFinalAnswerUrl);
        } else if (typeof candidateUrl === "string" && candidateUrl.trim()) {
          updateFinalAnswerUrl(candidateUrl);
        } else {
          const urlFromMessage = extractUrlFromText(nextMessage);
          if (urlFromMessage) {
            updateFinalAnswerUrl(urlFromMessage);
          } else {
            const deepUrl = findCandidateUrlDeep(payload);
            if (deepUrl) {
              updateFinalAnswerUrl(deepUrl);
            }
          }
        }

        const isCompleted = payloadEventType === "completed" || nextStatus === "completed";
        if (!isCompleted) {
          return;
        }

        setStatus("completed");

        const result = data.result ?? payload.result ?? "";
        if (typeof result === "string") {
          if (looksLikeUrl(result)) {
            updateFinalAnswerUrl(result);
          }
          setGeneratedDocument(result);
          return;
        }

        if (typeof result?.markdown === "string") {
          setGeneratedDocument(result.markdown);
          return;
        }

        if (typeof result?.text === "string") {
          setGeneratedDocument(result.text);
        }
      },
    }).catch((error) => {
      if (isDisposed) {
        return;
      }
      setConnectionState("error");
      setStatus("error");
      setMessage(error?.message || "Failed to connect WebSocket.");
      appendLog("error", error?.message || "Failed to connect WebSocket.");
    });

    return () => {
      isDisposed = true;
    };
  }, [appendLog, isEnabled, projectId, updateFinalAnswerUrl]);

  return {
    connectionState,
    logs,
    activeNode: currentNode,
    currentNode,
    status,
    message,
    generatedDocument,
    finalAnswerUrl,
    clearLogs,
    lastEventType,
  };
}
