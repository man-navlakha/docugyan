"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReactFlow, { Background, Controls, Handle, MarkerType, Position } from "reactflow";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import "reactflow/dist/style.css";
import { fetchDocuProcessData, saveGroomingData } from "@/lib/api/docuApi";
import { useAgentWebSocket } from "@/lib/realtime/useAgentWebSocket";
import WorkspaceSidebar from "@/components/sidebar/WorkspaceSidebar";

const PIPELINE_NODES = [
  {
    id: "START",
    type: "pipeline",
    position: { x: 30, y: 210 },
    data: { label: "START", subtitle: "Pipeline entry" },
  },
  {
    id: "Orchestrator_Init",
    type: "pipeline",
    position: { x: 280, y: 210 },
    data: { label: "Orchestrator Init", subtitle: "Bootstraps flow" },
  },
  {
    id: "DocuExtractor_Agent",
    type: "pipeline",
    position: { x: 550, y: 210 },
    data: { label: "DocuExtractor Agent", subtitle: "Launches extraction branch" },
  },
  {
    id: "Extraction_Worker",
    type: "pipeline",
    position: { x: 840, y: 100 },
    data: { label: "Extraction Worker", subtitle: "Chunk & extract" },
  },
  {
    id: "Question_Refiner",
    type: "pipeline",
    position: { x: 840, y: 320 },
    data: { label: "Question Refiner", subtitle: "Refines question flow" },
  },
  {
    id: "Vector_DB_Ingestion",
    type: "pipeline",
    position: { x: 1130, y: 210 },
    data: { label: "Vector DB Ingestion", subtitle: "Embeds and stores vectors" },
  },
  {
    id: "Orchestrator_Domain_Router",
    type: "pipeline",
    position: { x: 1410, y: 210 },
    data: { label: "Domain Router", subtitle: "Classifies and routes" },
  },
  {
    id: "Academic_Agent",
    type: "pipeline",
    position: { x: 1690, y: 210 },
    data: { label: "Academic Agent", subtitle: "Domain reasoning" },
  },
  {
    id: "Parallel_Question_Workers",
    type: "pipeline",
    position: { x: 1970, y: 210 },
    data: { label: "Parallel Workers", subtitle: "Solve in parallel" },
  },
  {
    id: "Aggregate_Output",
    type: "pipeline",
    position: { x: 2250, y: 210 },
    data: { label: "Aggregate Output", subtitle: "Stitch final study guide" },
  },
  {
    id: "END",
    type: "pipeline",
    position: { x: 2530, y: 210 },
    data: { label: "END", subtitle: "Pipeline complete" },
  },
];

const PIPELINE_EDGES = [
  { id: "e-start-init", source: "START", target: "Orchestrator_Init", markerEnd: { type: MarkerType.ArrowClosed } },
  {
    id: "e-init-docu",
    source: "Orchestrator_Init",
    target: "DocuExtractor_Agent",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: "e-docu-extraction",
    source: "DocuExtractor_Agent",
    target: "Extraction_Worker",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: "e-docu-question",
    source: "DocuExtractor_Agent",
    target: "Question_Refiner",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: "e-extraction-vector",
    source: "Extraction_Worker",
    target: "Vector_DB_Ingestion",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: "e-question-vector",
    source: "Question_Refiner",
    target: "Vector_DB_Ingestion",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: "e-vector-router",
    source: "Vector_DB_Ingestion",
    target: "Orchestrator_Domain_Router",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: "e-router-academic",
    source: "Orchestrator_Domain_Router",
    target: "Academic_Agent",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: "e-academic-workers",
    source: "Academic_Agent",
    target: "Parallel_Question_Workers",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: "e-workers-aggregate",
    source: "Parallel_Question_Workers",
    target: "Aggregate_Output",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: "e-aggregate-end",
    source: "Aggregate_Output",
    target: "END",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
];

function toTitleCase(value) {
  if (!value) {
    return "";
  }

  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toMessage(error, fallback) {
  if (error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

function normalizeUrlString(value) {
  if (typeof value !== "string") {
    return "";
  }

  let trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    trimmed = trimmed.slice(1, -1).trim();
  }

  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1).trim();
  }

  trimmed = trimmed.replace(/[\]\"']+$/g, "").trim();

  if (/^https?:\/(?!\/)/i.test(trimmed)) {
    return trimmed.replace(/^https?:\/(?!\/)/i, (prefix) => `${prefix}/`);
  }

  return trimmed;
}

function resolveSourceUrl(url) {
  const normalizedInput = normalizeUrlString(url);
  if (!normalizedInput) {
    return "";
  }

  try {
    const isAbsolute = /^https?:\/\//i.test(normalizedInput);
    const parsed = new URL(normalizedInput, isAbsolute ? undefined : "http://local.preview");
    const isBlobProxy = parsed.pathname.endsWith("/api/uploads/blob") || parsed.pathname.endsWith("/blob");
    const nested = parsed.searchParams.get("url");

    if (isBlobProxy && nested) {
      return normalizeUrlString(nested);
    }

    if (isAbsolute) {
      return parsed.toString();
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return normalizedInput;
  }
}

function isMarkdownUrl(url) {
  const source = resolveSourceUrl(url);
  if (!source) {
    return false;
  }

  return /\.md(?:$|[?#])/i.test(source);
}

function buildPreviewUrl(url) {
  const resolved = resolveSourceUrl(url);
  if (!resolved) {
    return "";
  }

  try {
    const parsed = new URL(resolved, /^https?:\/\//i.test(resolved) ? undefined : "http://local.preview");
    if (parsed.hostname.endsWith(".blob.vercel-storage.com")) {
      return `/api/uploads/blob?url=${encodeURIComponent(parsed.toString())}`;
    }

    if (resolved.startsWith("/")) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    // Use resolved URL fallback.
  }

  return resolved;
}

function isSafeMarkdownImageUrl(url) {
  const normalized = normalizeUrlString(url);
  if (!normalized) {
    return false;
  }

  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(normalized)) {
    return true;
  }

  if (/^blob:/i.test(normalized)) {
    return true;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return true;
  }

  return normalized.startsWith("/") || normalized.startsWith("./") || normalized.startsWith("../");
}

function markdownUrlTransform(url, key) {
  const normalized = normalizeUrlString(url);
  if (!normalized) {
    return "";
  }

  if (key === "src" && normalized.startsWith("mdimg://")) {
    return normalized;
  }

  // Allow embedded diagram images from backend markdown payloads.
  if (key === "src" && isSafeMarkdownImageUrl(normalized)) {
    return normalized;
  }

  return defaultUrlTransform(normalized);
}

function normalizeDataImageUrl(url) {
  const normalized = normalizeUrlString(url);
  if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(normalized)) {
    return normalized;
  }

  const firstCommaIndex = normalized.indexOf(",");
  if (firstCommaIndex < 0) {
    return normalized;
  }

  const header = normalized.slice(0, firstCommaIndex + 1);
  const payload = normalized.slice(firstCommaIndex + 1).replace(/\s+/g, "");
  return `${header}${payload}`;
}

function tokenizeMarkdownDataImages(markdown) {
  if (typeof markdown !== "string" || !markdown.trim()) {
    return { content: "", imageByToken: {} };
  }

  const imageByToken = {};
  let index = 0;
  let cursor = 0;
  let content = "";

  while (cursor < markdown.length) {
    const imageStart = markdown.indexOf("![", cursor);
    if (imageStart < 0) {
      content += markdown.slice(cursor);
      break;
    }

    content += markdown.slice(cursor, imageStart);

    const altEnd = markdown.indexOf("]", imageStart + 2);
    if (altEnd < 0 || markdown[altEnd + 1] !== "(") {
      content += markdown.slice(imageStart, altEnd < 0 ? undefined : altEnd + 1);
      cursor = altEnd < 0 ? markdown.length : altEnd + 1;
      continue;
    }

    let urlStart = altEnd + 2;
    while (urlStart < markdown.length && /\s/.test(markdown[urlStart])) {
      urlStart += 1;
    }

    const closeParen = markdown.indexOf(")", urlStart);
    if (closeParen < 0) {
      content += markdown.slice(imageStart);
      cursor = markdown.length;
      break;
    }

    const rawUrl = markdown.slice(urlStart, closeParen);
    if (!/^data:image\//i.test(rawUrl.trim())) {
      content += markdown.slice(imageStart, closeParen + 1);
      cursor = closeParen + 1;
      continue;
    }

    const token = `mdimg://${index}`;
    const alt = markdown.slice(imageStart + 2, altEnd);
    imageByToken[token] = normalizeDataImageUrl(rawUrl);
    content += `![${alt}](${token})`;
    index += 1;
    cursor = closeParen + 1;
  }

  return { content, imageByToken };
}

function splitMarkdownReferencesBlock(markdown) {
  if (typeof markdown !== "string" || !markdown.trim()) {
    return { body: "", references: [] };
  }

  const startMarker = "---REFERENCES---";
  const endMarker = "---END REFERENCES---";
  const endIndex = markdown.lastIndexOf(endMarker);
  const startIndex = endIndex >= 0 ? markdown.lastIndexOf(startMarker, endIndex) : -1;

  if (startIndex < 0 || endIndex < 0 || endIndex < startIndex) {
    return { body: markdown, references: [] };
  }

  // Only extract a references block when it is truly the final block.
  // If anything meaningful exists after END REFERENCES, keep full markdown body.
  const afterEnd = markdown.slice(endIndex + endMarker.length).trim();
  if (afterEnd) {
    return { body: markdown, references: [] };
  }

  const body = markdown.slice(0, startIndex).trimEnd();
  const block = markdown.slice(startIndex + startMarker.length, endIndex);

  const references = block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^\[\[ref:(\d+)\]\]\s*Title:\s*(.*?)\s*\|\s*URL:\s*(.*)$/i);
      if (!match) {
        return null;
      }

      return {
        id: match[1],
        title: match[2] || "Unknown source",
        url: match[3] || "none",
      };
    })
    .filter(Boolean);

  return { body, references };
}

function getMarkdownFetchCandidates(url) {
  const normalized = normalizeUrlString(url);
  if (!normalized) {
    return [];
  }

  const candidates = [];

  const addCandidate = (candidate) => {
    const next = normalizeUrlString(candidate);
    if (!next) {
      return;
    }

    try {
      const parsed = new URL(next, /^https?:\/\//i.test(next) ? undefined : "http://local.preview");
      if (parsed.hostname.endsWith(".blob.vercel-storage.com")) {
        candidates.push(`/api/uploads/blob?url=${encodeURIComponent(parsed.toString())}`);
        return;
      }

      candidates.push(next);
    } catch {
      candidates.push(next);
    }
  };

  addCandidate(normalized);

  try {
    const parsed = new URL(normalized, /^https?:\/\//i.test(normalized) ? undefined : "http://local.preview");
    const nested = parsed.searchParams.get("url");
    const nestedNormalized = normalizeUrlString(nested || "");
    if (nestedNormalized) {
      addCandidate(nestedNormalized);
    }
  } catch {
    // Ignore malformed URLs and keep the primary candidate only.
  }

  return Array.from(new Set(candidates));
}

function mapLogToActiveNodes(message, eventType) {
  const normalizedType = (eventType || "").toLowerCase();
  if (normalizedType === "completed") {
    return ["END"];
  }

  const text = (message || "").toLowerCase();
  if (!text) {
    return null;
  }

  if (text.includes("initializing docupipeline orchestrator")) {
    return ["Orchestrator_Init"];
  }

  if (text.includes("extractor agent: starting parallel document extraction")) {
    return ["DocuExtractor_Agent", "Extraction_Worker"];
  }

  if (text.includes("extractor agent: starting question refinement")) {
    return ["Question_Refiner"];
  }

  if (text.includes("vector ingestor: processing chunks")) {
    return ["Vector_DB_Ingestion"];
  }

  if (text.includes("orchestrator: routing to") || text.includes("classifying document domain")) {
    return ["Orchestrator_Domain_Router"];
  }

  if (text.includes("academic agent: extracting questions and initiating workers")) {
    return ["Academic_Agent", "Parallel_Question_Workers"];
  }

  if (text.includes("academic agent: stitching final study guide")) {
    return ["Aggregate_Output"];
  }

  return null;
}

function firstNonEmptyString(values, fallback = "") {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return fallback;
}

function areStringArraysEqual(a, b) {
  if (a === b) {
    return true;
  }

  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

function mergeUniqueNodes(previous, additions) {
  return Array.from(new Set([...(Array.isArray(previous) ? previous : []), ...(Array.isArray(additions) ? additions : [])]));
}

function getGraphStateStorageKey(projectId) {
  return `docugyan-workspace-graph-state:${projectId}`;
}

function sanitizeNodeIdList(value, fallback = []) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value.filter((item) => typeof item === "string" && item.trim());
  return normalized.length > 0 ? Array.from(new Set(normalized)) : fallback;
}

function isObject(value) {
  return Boolean(value) && typeof value === "object";
}

function collectObjects(root) {
  const queue = [root];
  const visited = new Set();
  const objects = [];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!isObject(current) || visited.has(current)) {
      continue;
    }

    visited.add(current);
    objects.push(current);

    if (Array.isArray(current)) {
      for (const item of current) {
        if (isObject(item)) {
          queue.push(item);
        }
      }
      continue;
    }

    for (const value of Object.values(current)) {
      if (isObject(value)) {
        queue.push(value);
      }
    }
  }

  return objects;
}

function readUrlList(container, keys) {
  if (!container || typeof container !== "object") {
    return [];
  }

  for (const key of keys) {
    const value = container[key];

    if (typeof value === "string" && value.trim()) {
      const normalizedValue = normalizeUrlString(value);
      if (normalizedValue) {
        return [normalizedValue];
      }
    }

    if (!Array.isArray(value)) {
      continue;
    }

    const normalized = value
      .filter((item) => typeof item === "string")
      .map((item) => normalizeUrlString(item))
      .filter(Boolean);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return [];
}

function findStringByKeys(objects, keys, fallback = "") {
  for (const key of keys) {
    for (const obj of objects) {
      if (!isObject(obj) || Array.isArray(obj)) {
        continue;
      }

      const value = obj[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }

  return fallback;
}

function findUrlListByKeys(objects, keys) {
  for (const key of keys) {
    for (const obj of objects) {
      if (!isObject(obj) || Array.isArray(obj)) {
        continue;
      }

      const normalized = readUrlList(obj, [key]);
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }

  return [];
}

function normalizeProcessData(payload) {
  const root = payload && typeof payload === "object" ? payload : {};
  const objects = collectObjects(root);

  const title = findStringByKeys(
    objects,
    ["title", "name", "project_name", "project_title", "workspace_title", "docu_process_title"],
    "Untitled_DocuProcess"
  );

  const description = findStringByKeys(objects, ["description", "workspace_description", "summary", "details"], "No description provided.");

  const processStatus = findStringByKeys(objects, ["status", "process_status", "state"], "idle");
  const finalAnswerUrl = findStringByKeys(
    objects,
    ["final_answer_url", "final_ans_url", "answer_url", "result_url", "output_url"],
    ""
  );

  const resultUrls = findUrlListByKeys(objects, ["result_urls", "resultUrls", "result_url", "results", "output_urls", "output_url"]);
  const referenceUrls = findUrlListByKeys(objects, ["reference_urls", "referenceUrls", "reference_url", "references"]);
  const questionUrls = findUrlListByKeys(objects, ["question_urls", "questionUrls", "question_url", "questions"]);
  const groomingData = root.grooming_data || objects.find((o) => isObject(o.grooming_data))?.grooming_data || null;

  return {
    ...root,
    title,
    description,
    status: processStatus,
    final_answer_url: finalAnswerUrl,
    result_urls: resultUrls,
    reference_urls: referenceUrls,
    question_urls: questionUrls,
    grooming_data: groomingData,
  };
}

function PipelineNode({ data }) {
  const nodeState = data?.nodeState || "idle";
  const isFailed = nodeState === "failed";
  const isActive = nodeState === "active";

  return (
    <div
      className={`w-[220px] rounded-2xl border px-4 py-3 backdrop-blur-xl transition-all duration-300 ${
        isFailed
          ? "border-red-400/80 bg-red-500/15 ring-1 ring-red-300/70 shadow-[0_0_34px_rgba(248,113,113,0.45)] node-failed-glow"
          : isActive
          ? "border-violet-400/80 bg-violet-500/15 ring-1 ring-violet-300/70 shadow-[0_0_34px_rgba(139,92,246,0.45)] node-active-glow"
          : "border-white/15 bg-white/[0.04]"
      }`}
    >
      <p className="text-sm font-semibold text-white">{data.label}</p>
      <p className="mt-1 text-[11px] uppercase tracking-widest text-slate-400">{data.subtitle}</p>
      {(isActive || isFailed) && (
        <span className={`mt-2 inline-flex items-center gap-1 text-[11px] font-semibold ${isFailed ? "text-red-200" : "text-violet-200"}`}>
          <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${isFailed ? "bg-red-300" : "bg-violet-300"}`} />
          {isFailed ? "Failed" : "Active"}
        </span>
      )}

      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-2 !border-slate-900 !bg-slate-300" />
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-2 !border-slate-900 !bg-violet-300" />
    </div>
  );
}

const nodeTypes = { pipeline: PipelineNode };

export default function WorkspacePage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project") || "";

  const [activeView, setActiveView] = useState("graph");
  const [currentNodeIds, setCurrentNodeIds] = useState(["START"]);
  const [visitedNodeIds, setVisitedNodeIds] = useState(["START"]);
  const [failedNodeIds, setFailedNodeIds] = useState([]);
  const currentNodeIdsRef = useRef(["START"]);
  const [processData, setProcessData] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeDocumentUrl, setActiveDocumentUrl] = useState("");
  const [markdownContent, setMarkdownContent] = useState("");
  const [markdownLoading, setMarkdownLoading] = useState(false);
  const [markdownError, setMarkdownError] = useState("");
  const [markdownImageUrlByToken, setMarkdownImageUrlByToken] = useState({});
  const markdownObjectUrlsRef = useRef([]);

  const { connectionState, logs, status, lastEventType, finalAnswerUrl } = useAgentWebSocket(projectId, {
    enabled: Boolean(projectId),
  });

  useEffect(() => {
    if (!projectId) {
      setLoadingData(false);
      setProcessData(null);
      setLoadError("Project id is missing.");
      return;
    }

    let canceled = false;

    const load = async () => {
      setLoadingData(true);
      setLoadError("");

      try {
        const payload = await fetchDocuProcessData(projectId);
        if (canceled) {
          return;
        }

        const normalizedPayload = normalizeProcessData(payload);
        setProcessData(normalizedPayload);

        const initialDoc =
          normalizedPayload?.result_urls?.[0] || normalizedPayload?.reference_urls?.[0] || normalizedPayload?.question_urls?.[0] || "";
        setActiveDocumentUrl(initialDoc);
      } catch (error) {
        if (!canceled) {
          setLoadError(toMessage(error, "Failed to load workspace data."));
          setProcessData(null);
        }
      } finally {
        if (!canceled) {
          setLoadingData(false);
        }
      }
    };

    load();

    return () => {
      canceled = true;
    };
  }, [projectId]);

  useEffect(() => {
    const normalizedStatus = (status || processData?.status || "").toLowerCase();
    if (normalizedStatus.includes("complete") || normalizedStatus.includes("done") || normalizedStatus.includes("success")) {
      setActiveView("document");
    }
  }, [processData?.status, status]);

  useEffect(() => {
    const completionStatus = (status || processData?.status || lastEventType || "").toString().toLowerCase();
    const isCompleted =
      completionStatus.includes("complete") || completionStatus.includes("completed") || completionStatus.includes("done") || completionStatus.includes("success");

    const liveFinalAnswerUrl = resolveSourceUrl(finalAnswerUrl || processData?.final_answer_url || "");
    if (!isCompleted || !liveFinalAnswerUrl) {
      return;
    }

    setActiveView("document");
    setActiveDocumentUrl((prev) => {
      const normalizedPrev = resolveSourceUrl(prev);
      return normalizedPrev === liveFinalAnswerUrl ? prev : liveFinalAnswerUrl;
    });
  }, [finalAnswerUrl, lastEventType, processData?.final_answer_url, processData?.status, status]);

  useEffect(() => {
    if (!processData) {
      return;
    }

    try {
      const parsed = processData.grooming_data;
      if (!parsed || !parsed.currentNodeIds) {
        if (!currentNodeIdsRef.current || currentNodeIdsRef.current.length === 0 || currentNodeIdsRef.current[0] !== "START") {
          setCurrentNodeIds(["START"]);
          setVisitedNodeIds(["START"]);
          setFailedNodeIds([]);
          currentNodeIdsRef.current = ["START"];
        }
        return;
      }

      const restoredCurrent = sanitizeNodeIdList(parsed?.currentNodeIds, ["START"]);
      const restoredVisited = sanitizeNodeIdList(parsed?.visitedNodeIds, ["START"]);
      const restoredFailed = sanitizeNodeIdList(parsed?.failedNodeIds, []);

      setCurrentNodeIds(restoredCurrent);
      setVisitedNodeIds(restoredVisited);
      setFailedNodeIds(restoredFailed);
      currentNodeIdsRef.current = restoredCurrent;
    } catch {
      setCurrentNodeIds(["START"]);
      setVisitedNodeIds(["START"]);
      setFailedNodeIds([]);
      currentNodeIdsRef.current = ["START"];
    }
  }, [processData?.grooming_data]);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    // Only save if we have actual state beyond just START
    if (
      currentNodeIds.length === 1 &&
      currentNodeIds[0] === "START" &&
      visitedNodeIds.length === 1 &&
      visitedNodeIds[0] === "START" &&
      failedNodeIds.length === 0
    ) {
      return;
    }

    const snapshot = {
      currentNodeIds,
      visitedNodeIds,
      failedNodeIds,
      savedAt: Date.now(),
    };

    saveGroomingData(projectId, snapshot).catch(() => {
      // Ignore API save failures silently
    });
  }, [currentNodeIds, failedNodeIds, projectId, visitedNodeIds]);

  useEffect(() => {
    currentNodeIdsRef.current = currentNodeIds;
  }, [currentNodeIds]);

  useEffect(() => {
    if (logs.length === 0 && lastEventType !== "completed") {
      return;
    }

    if (lastEventType === "completed") {
      setCurrentNodeIds((prev) => (areStringArraysEqual(prev, ["END"]) ? prev : ["END"]));
      setVisitedNodeIds((prev) => mergeUniqueNodes(prev, ["END"]));
      return;
    }

    const latestLog = logs[logs.length - 1];
    const mappedNodeIds = mapLogToActiveNodes(latestLog?.message || "", latestLog?.type || lastEventType);
    const normalizedEventType = (latestLog?.type || lastEventType || status || "").toString().toLowerCase();
    const isFailureEvent = normalizedEventType.includes("failed") || normalizedEventType.includes("error");

    if (mappedNodeIds && mappedNodeIds.length > 0) {
      setCurrentNodeIds((prev) => (areStringArraysEqual(prev, mappedNodeIds) ? prev : mappedNodeIds));
      setVisitedNodeIds((prev) => mergeUniqueNodes(prev, mappedNodeIds));

      if (isFailureEvent) {
        setFailedNodeIds((prev) => mergeUniqueNodes(prev, mappedNodeIds));
      }
      return;
    }

    if (isFailureEvent && currentNodeIdsRef.current.length > 0) {
      setFailedNodeIds((prev) => mergeUniqueNodes(prev, currentNodeIdsRef.current));
    }
  }, [lastEventType, logs, status]);

  const sourceDocumentUrl = resolveSourceUrl(activeDocumentUrl);
  const previewDocumentUrl = buildPreviewUrl(activeDocumentUrl);

  useEffect(() => {
    if (!previewDocumentUrl || !isMarkdownUrl(sourceDocumentUrl)) {
      setMarkdownContent("");
      setMarkdownLoading(false);
      setMarkdownError("");
      return;
    }

    const controller = new AbortController();

    const loadMarkdown = async () => {
      setMarkdownLoading(true);
      setMarkdownError("");

      try {
        const candidates = getMarkdownFetchCandidates(previewDocumentUrl);
        let bestText = "";
        let bestLength = -1;
        let hadSuccess = false;

        for (const candidateUrl of candidates) {
          const response = await fetch(candidateUrl, {
            signal: controller.signal,
            credentials: "include",
          });

          if (!response.ok) {
            continue;
          }

          hadSuccess = true;
          const text = await response.text();
          if (text.length > bestLength) {
            bestText = text;
            bestLength = text.length;
          }
        }

        if (!hadSuccess) {
          throw new Error("Failed to fetch markdown from available sources.");
        }

        setMarkdownContent(bestText);
      } catch (error) {
        if (!controller.signal.aborted) {
          setMarkdownError(toMessage(error, "Failed to load markdown document."));
          setMarkdownContent("");
        }
      } finally {
        if (!controller.signal.aborted) {
          setMarkdownLoading(false);
        }
      }
    };

    loadMarkdown();

    return () => {
      controller.abort();
    };
  }, [previewDocumentUrl, sourceDocumentUrl]);

  const memoNodeTypes = useMemo(() => nodeTypes, []);
  const parsedMarkdown = useMemo(() => splitMarkdownReferencesBlock(markdownContent), [markdownContent]);
  const tokenizedMarkdown = useMemo(() => tokenizeMarkdownDataImages(parsedMarkdown.body), [parsedMarkdown.body]);

  useEffect(() => {
    let cancelled = false;

    const resolveImageUrls = async () => {
      for (const objectUrl of markdownObjectUrlsRef.current) {
        URL.revokeObjectURL(objectUrl);
      }
      markdownObjectUrlsRef.current = [];

      const entries = Object.entries(tokenizedMarkdown.imageByToken || {});
      if (entries.length === 0) {
        setMarkdownImageUrlByToken({});
        return;
      }

      const nextMap = {};

      await Promise.all(
        entries.map(async ([token, source]) => {
          if (!/^data:image\//i.test(source)) {
            nextMap[token] = source;
            return;
          }

          try {
            const response = await fetch(source);
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            markdownObjectUrlsRef.current.push(objectUrl);
            nextMap[token] = objectUrl;
          } catch {
            nextMap[token] = source;
          }
        })
      );

      if (!cancelled) {
        setMarkdownImageUrlByToken(nextMap);
      }
    };

    resolveImageUrls();

    return () => {
      cancelled = true;
    };
  }, [tokenizedMarkdown.imageByToken]);

  useEffect(
    () => () => {
      for (const objectUrl of markdownObjectUrlsRef.current) {
        URL.revokeObjectURL(objectUrl);
      }
      markdownObjectUrlsRef.current = [];
    },
    []
  );

  const markdownComponents = useMemo(
    () => ({
      img: ({ src, alt, ...props }) => {
        const tokenOrSrc = normalizeUrlString(src);
        const safeSrc = markdownImageUrlByToken[tokenOrSrc] || tokenizedMarkdown.imageByToken[tokenOrSrc] || tokenOrSrc;
        if (!isSafeMarkdownImageUrl(safeSrc)) {
          return null;
        }

        return <img src={safeSrc} alt={alt || ""} loading="lazy" {...props} />;
      },
      a: ({ href, children, ...props }) => {
        if (href?.startsWith("#citation:")) {
          try {
            const data = JSON.parse(decodeURIComponent(href.slice("#citation:".length)));
            if (!data || data.length === 0) return null;
            return (
              <sup className="inline-flex gap-1 ml-1 align-top select-none">
                {data.map((cite, i) => (
                  <a 
                    key={i} 
                    href={cite.source_url} 
                    target="_blank" 
                    rel="noreferrer noopener" 
                    className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[9px] font-bold text-violet-300 bg-violet-500/10 border border-violet-500/30 rounded-full hover:bg-violet-500/20 hover:border-violet-500/50 transition-colors !no-underline" 
                    title={`Source${cite.page_number ? ` • Page ${cite.page_number}` : ''}`}
                  >
                    {i + 1}
                  </a>
                ))}
              </sup>
            );
          } catch (e) {
            return null;
          }
        }

        const safeHref = normalizeUrlString(href);
        if (!safeHref) {
          return <span {...props}>{children}</span>;
        }

        return (
          <a href={safeHref} target="_blank" rel="noreferrer noopener" {...props}>
            {children}
          </a>
        );
      },
    }),
    [markdownImageUrlByToken, tokenizedMarkdown.imageByToken]
  );
  const currentSet = useMemo(() => new Set(currentNodeIds), [currentNodeIds]);
  const visitedSet = useMemo(() => new Set(visitedNodeIds), [visitedNodeIds]);
  const failedSet = useMemo(() => new Set(failedNodeIds), [failedNodeIds]);

  const flowNodes = useMemo(
    () =>
      PIPELINE_NODES.map((node) => ({
        ...node,
        data: {
          ...node.data,
          nodeState: failedSet.has(node.id) && currentSet.has(node.id) ? "failed" : visitedSet.has(node.id) || currentSet.has(node.id) ? "active" : "idle",
        },
      })),
    [currentSet, failedSet, visitedSet]
  );

  const processStatus = (processData?.status || "").toString().trim().toLowerCase();
  const socketStatus = (status || "").toString().trim().toLowerCase();
  const eventStatus = (lastEventType || "").toString().trim().toLowerCase();
  const referenceUrls = Array.isArray(processData?.reference_urls) ? processData.reference_urls : [];
  const questionUrls = Array.isArray(processData?.question_urls) ? processData.question_urls : [];
  const resultUrls = Array.isArray(processData?.result_urls) ? processData.result_urls : [];
  const resolvedFinalAnswerUrl = finalAnswerUrl || processData?.final_answer_url || "";
  const isFailedState =
    [socketStatus, processStatus, eventStatus].some((value) => value.includes("failed") || value.includes("error"));
  const isCompletedState =
    Boolean(resolvedFinalAnswerUrl) ||
    [socketStatus, processStatus, eventStatus].some(
      (value) => value.includes("complete") || value.includes("completed") || value.includes("done") || value.includes("success")
    );
  const headerStatus = isFailedState ? "failed" : isCompletedState ? "completed" : projectId ? "processing" : "idle";
  const sidebarResultUrls = Array.from(
    new Set(
      [resolvedFinalAnswerUrl, ...resultUrls].filter((item) => typeof item === "string" && item.trim())
    )
  );
  const agentStatusLabel = toTitleCase(headerStatus);
  const documentIsMarkdown = isMarkdownUrl(sourceDocumentUrl);

  const processedMarkdown = useMemo(() => {
    let text = tokenizedMarkdown.content || "";
    
    // Replace JSON array citations
    text = text.replace(/\[\s*\{.*?"source_url".*?\}\s*\]/gs, (match) => {
      try {
        const parsed = JSON.parse(match);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Check if valid data exists
          const validCitations = parsed.filter(c => c && c.source_url && c.source_url.trim() !== "");
          if (validCitations.length === 0) return ""; // don't display if no data
          return `[CITATION](#citation:${encodeURIComponent(JSON.stringify(validCitations))})`;
        }
      } catch (e) {
        // Ignore
      }
      return match;
    });

    // Remove empty brackets [] that the backend might send for empty citations, preserving markdown checklists
    text = text.replace(/\s*(?<![-\*]\s*)\[\s*\]/g, "");

    // Visually distinguish Question and Answer
    text = text.replace(/^(\s*(?:>|\d+\.|-(?!\-)|\*(?!\*))*\s*)(?:\*\*)?(Question(?:\s*\d+)?|Q(?:\s*\d+)?)\s*[:.]?\s*(?:\*\*)?\s*/gmi, '\n\n---\n$1### 📝 $2:\n');
    text = text.replace(/^(\s*(?:>|\d+\.|-(?!\-)|\*(?!\*))*\s*)(?:\*\*)?(Answer(?:\s*\d+)?|A(?:\s*\d+)?)\s*[:.]?\s*(?:\*\*)?\s*/gmi, '\n\n$1### 💡 $2:\n');

    return text;
  }, [tokenizedMarkdown.content]);

  const statusDotClass = ["failed", "error"].includes(headerStatus)
    ? "bg-red-400"
    : ["completed", "complete", "success"].includes(headerStatus)
      ? "bg-emerald-400"
      : ["processing", "running", "in_progress", "queued"].includes(headerStatus)
        ? "bg-amber-400"
        : "bg-slate-400";

  return (
    <main className="relative h-[calc(100vh-65px)] overflow-hidden bg-[#0a0a0c] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-violet-800/15 via-[#0a0a0c] to-[#0a0a0c]" />

      <section className="relative z-10 h-full w-full p-3 md:p-4">
        <div className="h-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
          <div className="flex h-full min-h-0">
            <WorkspaceSidebar
              projectId={projectId}
              referenceUrls={referenceUrls}
              questionUrls={questionUrls}
              resultUrls={sidebarResultUrls}
              activeFile={activeDocumentUrl}
              onFileSelect={(url) => {
                setActiveDocumentUrl(url);
                setActiveView("document");
              }}
            />

            <section className="min-w-0 flex h-full min-h-0 flex-1 flex-col overflow-y-auto p-3 md:p-4">
              <header className="mb-3 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                <div className="grid gap-4 px-4 py-4 lg:grid-cols-[1fr_auto] lg:items-start">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">DocuGyan Workspace</p>
                    <h1 className="mt-2 text-2xl font-bold leading-tight text-white">{processData?.title || "Untitled_DocuProcess"}</h1>
                    <p className="mt-1.5 max-w-3xl text-sm text-slate-300">{processData?.description || "No description provided."}</p>
                  </div>

                  <div className="flex flex-col gap-3 lg:items-end">
                    <div className="rounded-xl border border-white/10 bg-black/40 p-1">
                      <button
                        type="button"
                        onClick={() => setActiveView("graph")}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                          activeView === "graph"
                            ? "bg-violet-500/20 text-violet-100"
                            : "text-slate-300 hover:text-white"
                        }`}
                      >
                        <span className="material-symbols-outlined mr-1 align-middle text-[18px]"></span>
                        Agent Graph
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveView("document")}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                          activeView === "document"
                            ? "bg-blue-500/20 text-blue-100"
                            : "text-slate-300 hover:text-white"
                        }`}
                      >
                        <span className="material-symbols-outlined mr-1 align-middle text-[18px]"></span>
                        Document View
                      </button>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-xs uppercase tracking-wider text-slate-200">
                      <span className={`mr-2 inline-block h-2 w-2 rounded-full ${statusDotClass}`} />
                      {agentStatusLabel}
                    </div>
                  </div>
                </div>
              </header>

              <div className="flex min-h-[420px] flex-1 flex-col gap-3">
                {loadingData ? (
                  <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-white/10 bg-black/30">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-300/30 border-t-violet-300" />
                      Loading workspace...
                    </div>
                  </div>
                ) : loadError ? (
                  <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-sm text-red-300">{loadError}</div>
                ) : activeView === "graph" ? (
                  <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                    <ReactFlow
                      nodes={flowNodes}
                      edges={PIPELINE_EDGES}
                      fitView
                      fitViewOptions={{ padding: 0.2 }}
                      nodesDraggable={false}
                      nodesConnectable={false}
                      elementsSelectable={false}
                      panOnDrag
                      zoomOnScroll
                      nodeTypes={memoNodeTypes}
                    >
                      <Background color="rgba(148,163,184,0.15)" gap={24} />
                      <Controls />
                    </ReactFlow>
                  </div>
                ) : (
                  <div className="min-h-0 flex-1 overflow-visible rounded-xl border border-white/10 bg-black/20">
                    <div className="h-full">
                      {previewDocumentUrl ? (
                        documentIsMarkdown ? (
                          <div className="bg-[#0c0d11] p-4 md:p-6">
                            {markdownLoading ? (
                              <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-slate-300">
                                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-violet-300/30 border-t-violet-300" />
                                Rendering markdown...
                              </div>
                            ) : markdownError ? (
                              <div className="flex h-full min-h-[220px] items-center justify-center px-4 text-center text-sm text-red-300">
                                {markdownError}
                              </div>
                            ) : (
                              <article className="markdown-preview mx-auto max-w-5xl rounded-2xl border border-white/10 bg-[#11131a] px-5 py-6 text-slate-100 md:px-8 md:py-8">
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents} urlTransform={markdownUrlTransform}>
                                  {processedMarkdown}
                                </ReactMarkdown>

                                {parsedMarkdown.references.length > 0 && (
                                  <section className="mt-8 border-t border-white/10 pt-5">
                                    <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-violet-300">References</h4>
                                    <div className="mt-3 space-y-2">
                                      {parsedMarkdown.references.map((ref) => {
                                        const safeUrl = normalizeUrlString(ref.url);
                                        const isLink = /^https?:\/\//i.test(safeUrl);

                                        return (
                                          <div key={ref.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
                                            <span className="rounded-full border border-violet-400/40 bg-violet-500/15 px-2 py-0.5 font-semibold text-violet-200">ref:{ref.id}</span>
                                            <span className="text-slate-200">{ref.title}</span>
                                            {isLink ? (
                                              <a href={safeUrl} target="_blank" rel="noreferrer noopener" className="text-blue-300 underline decoration-blue-300/60 underline-offset-2">
                                                Open source
                                              </a>
                                            ) : (
                                              <span className="text-slate-500">URL unavailable</span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </section>
                                )}
                              </article>
                            )}
                          </div>
                        ) : (
                          <iframe src={previewDocumentUrl} className="h-full w-full border-0 bg-white" title="Generated Document" />
                        )
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                          <p className="text-sm font-semibold text-slate-200">Select a document from the sidebar</p>
                          <p className="text-xs text-slate-500">The preview will appear here.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </section>
          </div>
        </div>
      </section>

      <style jsx>{`
        .node-active-glow {
          animation: pulseGlow 1.8s ease-in-out infinite;
        }

        .node-failed-glow {
          animation: pulseGlowRed 1.8s ease-in-out infinite;
        }

        @keyframes pulseGlow {
          0%,
          100% {
            box-shadow: 0 0 14px rgba(139, 92, 246, 0.35), 0 0 30px rgba(139, 92, 246, 0.15);
          }
          50% {
            box-shadow: 0 0 24px rgba(139, 92, 246, 0.75), 0 0 48px rgba(139, 92, 246, 0.35);
          }
        }

        @keyframes pulseGlowRed {
          0%,
          100% {
            box-shadow: 0 0 14px rgba(248, 113, 113, 0.35), 0 0 30px rgba(248, 113, 113, 0.15);
          }
          50% {
            box-shadow: 0 0 24px rgba(248, 113, 113, 0.75), 0 0 48px rgba(248, 113, 113, 0.35);
          }
        }

        .markdown-preview :global(h1),
        .markdown-preview :global(h2),
        .markdown-preview :global(h3),
        .markdown-preview :global(h4) {
          margin-top: 1.2rem;
          margin-bottom: 0.6rem;
          font-weight: 700;
          color: #f8fafc;
          line-height: 1.25;
        }

        .markdown-preview :global(h1) {
          font-size: 1.7rem;
          border-bottom: 1px solid rgba(148, 163, 184, 0.25);
          padding-bottom: 0.5rem;
        }

        .markdown-preview :global(h2) {
          font-size: 1.4rem;
        }

        .markdown-preview :global(h3) {
          font-size: 1.15rem;
        }

        .markdown-preview :global(p),
        .markdown-preview :global(li),
        .markdown-preview :global(blockquote) {
          color: #dbe2f1;
          line-height: 1.7;
          font-size: 0.97rem;
        }

        .markdown-preview :global(p) {
          margin: 0.7rem 0;
        }

        .markdown-preview :global(ul),
        .markdown-preview :global(ol) {
          margin: 0.8rem 0 0.8rem 1.2rem;
        }

        .markdown-preview :global(code) {
          border: 1px solid rgba(148, 163, 184, 0.2);
          background: rgba(15, 23, 42, 0.75);
          color: #c4b5fd;
          border-radius: 0.4rem;
          padding: 0.1rem 0.35rem;
          font-size: 0.88em;
        }

        .markdown-preview :global(pre) {
          overflow-x: auto;
          border: 1px solid rgba(148, 163, 184, 0.2);
          background: rgba(15, 23, 42, 0.95);
          border-radius: 0.7rem;
          padding: 0.85rem 1rem;
          margin: 0.9rem 0;
        }

        .markdown-preview :global(pre code) {
          border: 0;
          background: transparent;
          padding: 0;
          color: #e2e8f0;
        }

        .markdown-preview :global(table) {
          width: 100%;
          border-collapse: collapse;
          margin: 0.9rem 0;
        }

        .markdown-preview :global(th),
        .markdown-preview :global(td) {
          border: 1px solid rgba(148, 163, 184, 0.3);
          padding: 0.45rem 0.6rem;
          text-align: left;
        }

        .markdown-preview :global(a) {
          color: #93c5fd;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .markdown-preview :global(img) {
          display: block;
          max-width: 100%;
          max-height: min(74vh, 820px);
          height: auto;
          margin: 1rem auto;
          border-radius: 0.75rem;
          border: 1px solid rgba(148, 163, 184, 0.25);
          background: rgba(15, 23, 42, 0.5);
          object-fit: contain;
        }

        .markdown-preview :global(hr) {
          border: 0;
          border-top: 1px solid rgba(148, 163, 184, 0.25);
          margin: 1.1rem 0;
        }
      `}</style>
    </main>
  );
}
