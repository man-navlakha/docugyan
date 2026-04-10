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

export function useAgentWebSocket(projectId, enabled = true) {
  const isEnabled = typeof enabled === "object" ? Boolean(enabled?.enabled) : Boolean(enabled);
  const [currentNode, setCurrentNode] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [generatedDocument, setGeneratedDocument] = useState("");
  const [finalAnswerUrl, setFinalAnswerUrl] = useState("");
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

        if (typeof candidateUrl === "string" && candidateUrl.trim()) {
          setFinalAnswerUrl(candidateUrl.trim());
        }

        const isCompleted = payloadEventType === "completed" || nextStatus === "completed";
        if (!isCompleted) {
          return;
        }

        setStatus("completed");

        const result = data.result ?? payload.result ?? "";
        if (typeof result === "string") {
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
  }, [appendLog, isEnabled, projectId]);

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
