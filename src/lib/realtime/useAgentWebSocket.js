"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWsToken } from "@/lib/api/docuApi";
import { connectProcessSocket } from "@/lib/realtime/processSocketClient";

const NODE_ID_ALIASES = {
  input: "start",
  query: "start",
  start: "start",
  orchestrator: "orchestrator",
  orchestrator_agent: "orchestrator",
  extractor: "extractor",
  extractor_agent: "extractor",
  academic: "academic",
  academic_agent: "academic",
  financial: "financial",
  financial_agent: "financial",
  audit: "audit",
  audit_agent: "audit",
  vector_rag_ingest: "vector_rag_ingest",
  vector_ingestor: "vector_rag_ingest",
  graph_rag_ingest: "graph_rag_ingest",
  graph_ingestor: "graph_rag_ingest",
  vectorless_ingest: "vectorless_ingest",
  vectorless_ingestor: "vectorless_ingest",
  final: "end",
  final_result: "end",
  end: "end",
  completed: "end",
};

function normalizeNodeId(rawNode) {
  if (!rawNode || typeof rawNode !== "string") {
    return "";
  }

  const normalized = rawNode.trim().toLowerCase();
  return NODE_ID_ALIASES[normalized] ?? normalized;
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

function getCandidateFileName(url) {
  if (typeof url !== "string" || !url.trim()) {
    return "";
  }

  const normalized = url.trim();
  try {
    const parsed = new URL(normalized, /^https?:\/\//i.test(normalized) ? undefined : "http://local.preview");
    const nested = parsed.searchParams.get("url");
    const isBlobProxy = parsed.pathname.endsWith("/api/uploads/blob") || parsed.pathname.endsWith("/blob");
    if (isBlobProxy && nested) {
      return getCandidateFileName(nested);
    }

    return decodeURIComponent(parsed.pathname.split("/").pop() || "").toLowerCase();
  } catch {
    const withoutQuery = normalized.split(/[?#]/, 1)[0] || "";
    try {
      return decodeURIComponent(withoutQuery.split("/").pop() || "").toLowerCase();
    } catch {
      return (withoutQuery.split("/").pop() || "").toLowerCase();
    }
  }
}

function isHiddenIntermediateResultUrl(url) {
  const fileName = getCandidateFileName(url);
  if (!fileName) {
    return false;
  }

  return (
    fileName.includes("refined_question") ||
    fileName.includes("refined-questions") ||
    fileName.includes("refined questions")
  );
}

function isLikelyFinalAnswerUrl(url) {
  const fileName = getCandidateFileName(url);
  if (!fileName) {
    return false;
  }

  if (isHiddenIntermediateResultUrl(url)) {
    return false;
  }

  return (
    fileName.includes("final") ||
    fileName.includes("answer") ||
    fileName.includes("output")
  );
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
  const [stateProjectId, setStateProjectId] = useState(projectId || "");

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const appendLog = useCallback((type, text, meta = {}) => {
    const normalizedType = (type || "message").toString().trim().toLowerCase() || "message";
    const normalizedMessage = (text || "").toString();
    const normalizedCurrentNode = normalizeNodeId(meta?.currentNode ?? meta?.current_node ?? "");
    const normalizedStatus = (meta?.status || "").toString().trim().toLowerCase();
    const normalizedEventType = (meta?.eventType ?? meta?.event_type ?? "").toString().trim().toLowerCase();

    setLogs((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random()}`,
        type: normalizedType,
        message: normalizedMessage,
        at: new Date().toLocaleTimeString(),
        currentNode: normalizedCurrentNode,
        status: normalizedStatus,
        eventType: normalizedEventType,
      },
    ]);
  }, []);

  const finalAnswerUrl = finalAnswerState.projectId === projectId ? finalAnswerState.url : "";

  const updateFinalAnswerUrl = useCallback(
    (url) => {
      if (typeof url !== "string" || !url.trim()) {
        return false;
      }

      const normalizedUrl = url.trim();
      if (isHiddenIntermediateResultUrl(normalizedUrl)) {
        return false;
      }

      setFinalAnswerState({
        projectId,
        url: normalizedUrl,
      });
      return true;
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

        setStateProjectId(projectId);

        if (event.type === "error") {
          setLastEventType("error");
          setConnectionState("error");
          setStatus("error");
          setMessage(event.text || "WebSocket error.");
          appendLog("error", event.text || "WebSocket error.", { eventType: "error", status: "error" });
          return;
        }

        if (event.type === "message") {
          setLastEventType("message");
          const text = event.text || "Socket update";
          setMessage(text);
          appendLog("message", text, { eventType: "message" });

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

        const envelope = event.payload ?? {};
        const payload = envelope && typeof envelope.payload === "object" && envelope.payload ? envelope.payload : envelope;
        const data = payload && typeof payload.data === "object" && payload.data ? payload.data : payload;
        const payloadEventType = (payload.event_type ?? data.event_type ?? envelope.event_type ?? "message")
          .toString()
          .trim()
          .toLowerCase();

        setLastEventType(payloadEventType);

        const nextNode = normalizeNodeId(payload.current_node ?? data.current_node ?? data.currentNode ?? envelope.current_node);
        if (nextNode) {
          setCurrentNode(nextNode);
        }

        const nextStatus = (payload.status ?? data.status ?? envelope.status ?? "").toString().trim().toLowerCase();
        const isErrorEvent = payloadEventType === "error" || nextStatus === "error";
        const isCompletedEvent = payloadEventType === "completed" || nextNode === "end";

        if (isErrorEvent) {
          setStatus("error");
        } else if (isCompletedEvent) {
          setStatus("completed");
        } else if (nextStatus) {
          setStatus(nextStatus === "completed" ? "processing" : nextStatus);
        } else if (payloadEventType === "message" || payloadEventType === "stream_chunk") {
          setStatus("processing");
        }

        const nextMessage = (payload.message ?? payload.text ?? data.message ?? data.text ?? envelope.message ?? envelope.text ?? "").toString();
        const fallbackMessage = payloadEventType === "completed" ? "Agent process completed." : `Socket update: ${nextNode || "pipeline"}`;
        const logMessage = nextMessage || fallbackMessage;

        appendLog(payloadEventType || nextStatus || "message", logMessage, {
          currentNode: nextNode,
          status: nextStatus,
          eventType: payloadEventType,
        });

        if (nextMessage) {
          setMessage(nextMessage);
        } else if (payloadEventType === "completed") {
          setMessage(fallbackMessage);
        }

        const candidateUrl =
          payload.final_answer_url ??
          data.final_answer_url ??
          envelope.final_answer_url ??
          payload.final_ans_url ??
          data.final_ans_url ??
          envelope.final_ans_url ??
          payload.answer_url ??
          data.answer_url ??
          envelope.answer_url ??
          payload.result_url ??
          data.result_url ??
          envelope.result_url ??
          payload.output_url ??
          data.output_url ??
          envelope.output_url;

        const resultPayload = data.result ?? payload.result ?? envelope.result ?? {};
        const explicitFinalAnswerUrl =
          pickFirstUrl(resultPayload?.final_answers_blob_url) ||
          pickFirstUrl(resultPayload?.final_answer_blob_url) ||
          pickFirstUrl(resultPayload?.final_answer_url) ||
          pickFirstUrl(resultPayload?.final_answers_url) ||
          pickFirstUrl(payload.final_answer_url) ||
          pickFirstUrl(data.final_answer_url) ||
          pickFirstUrl(envelope.final_answer_url) ||
          pickFirstUrl(payload.final_ans_url) ||
          pickFirstUrl(data.final_ans_url) ||
          pickFirstUrl(envelope.final_ans_url) ||
          pickFirstUrl(payload.answer_url) ||
          pickFirstUrl(data.answer_url) ||
          pickFirstUrl(envelope.answer_url);

        if (explicitFinalAnswerUrl && updateFinalAnswerUrl(explicitFinalAnswerUrl)) {
          // prefer canonical final answer URL from result payload
        } else if (isCompletedEvent) {
          const completionFallbackUrl =
            pickFirstUrl(resultPayload?.result_url) ||
            pickFirstUrl(resultPayload?.output_url) ||
            pickFirstUrl(payload.result_url) ||
            pickFirstUrl(data.result_url) ||
            pickFirstUrl(envelope.result_url) ||
            pickFirstUrl(payload.output_url) ||
            pickFirstUrl(data.output_url) ||
            pickFirstUrl(envelope.output_url) ||
            (typeof candidateUrl === "string" && candidateUrl.trim() ? candidateUrl.trim() : "");

          if (completionFallbackUrl && isLikelyFinalAnswerUrl(completionFallbackUrl)) {
            updateFinalAnswerUrl(completionFallbackUrl);
          }

          const urlFromMessage = extractUrlFromText(nextMessage);
          if (urlFromMessage && isLikelyFinalAnswerUrl(urlFromMessage) && updateFinalAnswerUrl(urlFromMessage)) {
            // fallback to URL found in message text
          } else {
            const deepUrl = findCandidateUrlDeep(payload);
            if (deepUrl && isLikelyFinalAnswerUrl(deepUrl) && updateFinalAnswerUrl(deepUrl)) {
              // fallback to nested payload URL
            }
          }
        }

        const isCompleted = isCompletedEvent;
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
      setStateProjectId(projectId);
      setConnectionState("error");
      setStatus("error");
      setMessage(error?.message || "Failed to connect WebSocket.");
      appendLog("error", error?.message || "Failed to connect WebSocket.", { eventType: "error", status: "error" });
    });

    return () => {
      isDisposed = true;
    };
  }, [appendLog, isEnabled, projectId, updateFinalAnswerUrl]);

  const isCurrentProjectState = stateProjectId === projectId;
  const scopedLogs = isCurrentProjectState ? logs : [];
  const scopedCurrentNode = isCurrentProjectState ? currentNode : "";
  const scopedStatus = isCurrentProjectState ? status : "idle";
  const scopedMessage = isCurrentProjectState ? message : "";
  const scopedGeneratedDocument = isCurrentProjectState ? generatedDocument : "";
  const scopedLastEventType = isCurrentProjectState ? lastEventType : "";
  const scopedConnectionState = isCurrentProjectState ? connectionState : "idle";

  return {
    connectionState: scopedConnectionState,
    logs: scopedLogs,
    activeNode: scopedCurrentNode,
    currentNode: scopedCurrentNode,
    status: scopedStatus,
    message: scopedMessage,
    generatedDocument: scopedGeneratedDocument,
    finalAnswerUrl,
    clearLogs,
    lastEventType: scopedLastEventType,
  };
}
