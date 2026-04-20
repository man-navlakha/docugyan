"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ReactFlow, { Background, BaseEdge, Controls, Handle, MarkerType, Position, getBezierPath } from "reactflow";
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
    position: { x: 40, y: 300 },
    data: { label: "Start", subtitle: "Pipeline entrypoint" },
  },
  {
    id: "Orchestrator_Init",
    type: "pipeline",
    position: { x: 600, y: 170 },
    data: { label: "Orchestrator Init", subtitle: "Initializing DocuPipeline" },
  },
  {
    id: "Extractor_Agent",
    type: "pipeline",
    position: { x: 1120, y: 430 },
    data: { label: "Extractor Agent", subtitle: "Parallel extraction + refinement" },
  },
  {
    id: "Extraction_Workers",
    type: "pipeline",
    position: { x: 1600, y: 240 },
    data: { label: "Extraction Workers", subtitle: "Extract reference blobs" },
  },
  {
    id: "Question_Refiner",
    type: "pipeline",
    position: { x: 1600, y: 560 },
    data: { label: "Question Refiner", subtitle: "Refines original questions" },
  },
  {
    id: "RAG_Strategy_Evaluator",
    type: "pipeline",
    position: { x: 2100, y: 170 },
    data: { label: "RAG Evaluator", subtitle: "Defaults strategy for V1" },
  },
  {
    id: "Ingestion_Router",
    type: "pipeline",
    position: { x: 2620, y: 430 },
    data: { label: "Ingestion Router", subtitle: "Routes Vector/Graph/Vectorless" },
  },
  {
    id: "Vector_Ingestor",
    type: "pipeline",
    position: { x: 3120, y: 220 },
    data: { label: "Vector Ingestor", subtitle: "Chunk + embed + upsert" },
  },
  {
    id: "Graph_Ingestor",
    type: "pipeline",
    position: { x: 3120, y: 430 },
    data: { label: "Graph Ingestor", subtitle: "Map entities + relations" },
  },
  {
    id: "Vectorless_Ingestor",
    type: "pipeline",
    position: { x: 3120, y: 560 },
    data: { label: "Vectorless Ingestor", subtitle: "Store raw text" },
  },
  {
    id: "Domain_Evaluator",
    type: "pipeline",
    position: { x: 3640, y: 170 },
    data: { label: "Domain Evaluator", subtitle: "Classify document domain" },
  },
  {
    id: "Specialist_Router",
    type: "pipeline",
    position: { x: 4160, y: 430 },
    data: { label: "Specialist Router", subtitle: "Academic/Financial/Audit" },
  },
  {
    id: "Academic_Agent",
    type: "pipeline",
    position: { x: 4680, y: 170 },
    data: { label: "Academic Agent", subtitle: "Question-solving workflow" },
  },
  {
    id: "Financial_Agent",
    type: "pipeline",
    position: { x: 4680, y: 430 },
    data: { label: "Financial Agent", subtitle: "Financial models pathway" },
  },
  {
    id: "Audit_Agent",
    type: "pipeline",
    position: { x: 4680, y: 690 },
    data: { label: "Audit Agent", subtitle: "Compliance/risk pathway" },
  },
  {
    id: "Academic_Workers",
    type: "pipeline",
    position: { x: 5200, y: 350 },
    data: { label: "Academic Workers", subtitle: "Per-question parallel workers" },
  },
  {
    id: "Academic_Aggregator",
    type: "pipeline",
    position: { x: 5720, y: 170 },
    data: { label: "Academic Aggregator", subtitle: "Stitch final study guide" },
  },
  {
    id: "Milvus_Index",
    type: "pipeline",
    position: { x: 6240, y: 350 },
    data: { label: "Milvus Index", subtitle: "Index final Q&A" },
  },
  {
    id: "END",
    type: "pipeline",
    position: { x: 6960, y: 430 },
    data: { label: "End", subtitle: "Pipeline completed" },
  },
];

const EDGE_ARROW_MARKER = {
  type: MarkerType.ArrowClosed,
  width: 22,
  height: 22,
  color: "#c4b5fd",
};

const PIPELINE_EDGES = [
  {
    id: "e-start-init",
    source: "START",
    target: "Orchestrator_Init",
    type: "pipeline",
    markerEnd: EDGE_ARROW_MARKER,
  },
  {
    id: "e-init-extractor",
    source: "Orchestrator_Init",
    target: "Extractor_Agent",
    type: "pipeline",
    markerEnd: EDGE_ARROW_MARKER,
  },
  {
    id: "e-extractor-workers",
    source: "Extractor_Agent",
    target: "Extraction_Workers",
    type: "pipeline",
    markerEnd: EDGE_ARROW_MARKER,
  },
  {
    id: "e-extractor-refiner",
    source: "Extractor_Agent",
    target: "Question_Refiner",
    type: "pipeline",
    markerEnd: EDGE_ARROW_MARKER,
  },
  {
    id: "e-workers-rag",
    source: "Extraction_Workers",
    target: "RAG_Strategy_Evaluator",
    type: "pipeline",
    markerEnd: EDGE_ARROW_MARKER,
  },
  {
    id: "e-refiner-rag",
    source: "Question_Refiner",
    target: "RAG_Strategy_Evaluator",
    type: "pipeline",
    markerEnd: EDGE_ARROW_MARKER,
  },
  {
    id: "e-rag-router",
    source: "RAG_Strategy_Evaluator",
    target: "Ingestion_Router",
    type: "pipeline",
    markerEnd: EDGE_ARROW_MARKER,
  },
  {
    id: "e-router-vector",
    source: "Ingestion_Router",
    target: "Vector_Ingestor",
    type: "pipeline",
    markerEnd: EDGE_ARROW_MARKER,
  },
  {
    id: "e-router-graph",
    source: "Ingestion_Router",
    target: "Graph_Ingestor",
    type: "pipeline",
    markerEnd: EDGE_ARROW_MARKER,
  },
  {
    id: "e-router-vectorless",
    source: "Ingestion_Router",
    target: "Vectorless_Ingestor",
    type: "pipeline",
    markerEnd: EDGE_ARROW_MARKER,
  },
  {
    id: "e-vector-domain",
    source: "Vector_Ingestor",
    target: "Domain_Evaluator",
    type: "pipeline",
    markerEnd: EDGE_ARROW_MARKER,
  },
  {
    id: "e-graph-domain",
    source: "Graph_Ingestor",
    target: "Domain_Evaluator",
    type: "pipeline",
    markerEnd: EDGE_ARROW_MARKER,
  },
  {
    id: "e-vectorless-domain",
    source: "Vectorless_Ingestor",
    target: "Domain_Evaluator",
    type: "pipeline",
    markerEnd: EDGE_ARROW_MARKER,
  },
  {
    id: "e-domain-router",
    source: "Domain_Evaluator",
    target: "Specialist_Router",
    type: "pipeline",
    markerEnd: EDGE_ARROW_MARKER,
  },
  {
    id: "e-router-academic",
    source: "Specialist_Router",
    target: "Academic_Agent",
    type: "pipeline",
    markerEnd: EDGE_ARROW_MARKER,
  },
  {
    id: "e-router-financial",
    source: "Specialist_Router",
    target: "Financial_Agent",
    type: "pipeline",
    markerEnd: EDGE_ARROW_MARKER,
  },
  {
    id: "e-router-audit",
    source: "Specialist_Router",
    target: "Audit_Agent",
    type: "pipeline",
    markerEnd: EDGE_ARROW_MARKER,
  },
  {
    id: "e-academic-dispatch",
    source: "Academic_Agent",
    target: "Academic_Workers",
    type: "pipeline",
    markerEnd: EDGE_ARROW_MARKER,
  },
  {
    id: "e-academic-aggregate",
    source: "Academic_Workers",
    target: "Academic_Aggregator",
    type: "pipeline",
    markerEnd: EDGE_ARROW_MARKER,
  },
  {
    id: "e-aggregate-index",
    source: "Academic_Aggregator",
    target: "Milvus_Index",
    type: "pipeline",
    markerEnd: EDGE_ARROW_MARKER,
  },
  {
    id: "e-index-end",
    source: "Milvus_Index",
    target: "END",
    type: "pipeline",
    markerEnd: EDGE_ARROW_MARKER,
  },
  {
    id: "e-financial-end",
    source: "Financial_Agent",
    target: "END",
    type: "pipeline",
    data: { route: "under" },
    markerEnd: EDGE_ARROW_MARKER,
  },
  {
    id: "e-audit-end",
    source: "Audit_Agent",
    target: "END",
    type: "pipeline",
    data: { route: "under-deep" },
    markerEnd: EDGE_ARROW_MARKER,
  },
];

const PRIMARY_STAGE_SEQUENCE = [
  "START",
  "Orchestrator_Init",
  "Extractor_Agent",
  "RAG_Strategy_Evaluator",
  "Ingestion_Router",
  "Vector_Ingestor",
  "Domain_Evaluator",
  "Specialist_Router",
  "Academic_Agent",
  "Academic_Workers",
  "Academic_Aggregator",
  "Milvus_Index",
  "END",
];

const PRIMARY_STAGE_SET = new Set(PRIMARY_STAGE_SEQUENCE);
const PIPELINE_NODE_ID_BY_NORMALIZED = new Map(
  PIPELINE_NODES.map((node) => [node.id.toLowerCase().replace(/[^a-z0-9]/g, ""), node.id])
);
const NODE_ID_ALIAS_TO_GRAPH_ID = new Map(
  Object.entries({
    start: "START",
    input: "START",
    query: "START",
    orchestrator: "Orchestrator_Init",
    orchestratorinit: "Orchestrator_Init",
    orchestratoragent: "Orchestrator_Init",
    extractor: "Extractor_Agent",
    extractoragent: "Extractor_Agent",
    extractionworkers: "Extraction_Workers",
    questionrefiner: "Question_Refiner",
    ragstrategyevaluator: "RAG_Strategy_Evaluator",
    ingestionrouter: "Ingestion_Router",
    vectorragingest: "Vector_Ingestor",
    vectoringestor: "Vector_Ingestor",
    vectoringest: "Vector_Ingestor",
    graphragingest: "Graph_Ingestor",
    graphingestor: "Graph_Ingestor",
    graphingest: "Graph_Ingestor",
    vectorlessingest: "Vectorless_Ingestor",
    vectorlessingestor: "Vectorless_Ingestor",
    domainevaluator: "Domain_Evaluator",
    specialistrouter: "Specialist_Router",
    academic: "Academic_Agent",
    academicagent: "Academic_Agent",
    academicworkers: "Academic_Workers",
    academicaggregator: "Academic_Aggregator",
    financial: "Financial_Agent",
    financialagent: "Financial_Agent",
    audit: "Audit_Agent",
    auditagent: "Audit_Agent",
    milvusindex: "Milvus_Index",
    final: "END",
    finalresult: "END",
    end: "END",
    completed: "END",
    success: "END",
    done: "END",
  })
);

function normalizePipelineNodeId(rawNodeId) {
  if (typeof rawNodeId !== "string" || !rawNodeId.trim()) {
    return "";
  }

  const trimmedNodeId = rawNodeId.trim();
  const normalizedNodeId = trimmedNodeId.toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliasMappedNodeId = NODE_ID_ALIAS_TO_GRAPH_ID.get(normalizedNodeId);
  if (aliasMappedNodeId) {
    return aliasMappedNodeId;
  }

  return PIPELINE_NODE_ID_BY_NORMALIZED.get(normalizedNodeId) || trimmedNodeId;
}

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

function getResolvedFileName(url) {
  const resolved = resolveSourceUrl(url);
  if (!resolved) {
    return "";
  }

  try {
    const parsed = new URL(resolved, /^https?:\/\//i.test(resolved) ? undefined : "http://local.preview");
    return decodeURIComponent(parsed.pathname.split("/").pop() || "").toLowerCase();
  } catch {
    const withoutQuery = resolved.split(/[?#]/, 1)[0] || "";
    try {
      return decodeURIComponent(withoutQuery.split("/").pop() || "").toLowerCase();
    } catch {
      return (withoutQuery.split("/").pop() || "").toLowerCase();
    }
  }
}

function isHiddenIntermediateResultUrl(url) {
  const fileName = getResolvedFileName(url);
  if (!fileName) {
    return false;
  }

  return (
    fileName.includes("refined_question") ||
    fileName.includes("refined-questions") ||
    fileName.includes("refined questions")
  );
}

function filterDisplayableDocumentUrls(urls) {
  if (!Array.isArray(urls)) {
    return [];
  }

  return urls
    .map((item) => normalizeUrlString(item))
    .filter(Boolean)
    .filter((item) => !isHiddenIntermediateResultUrl(item));
}

function isLikelyFinalAnswerUrl(url) {
  const fileName = getResolvedFileName(url);
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

function pickPreferredDocumentUrl(candidates) {
  if (!Array.isArray(candidates)) {
    return "";
  }

  for (const candidate of candidates) {
    const normalized = normalizeUrlString(candidate);
    if (!normalized || isHiddenIntermediateResultUrl(normalized)) {
      continue;
    }

    return normalized;
  }

  return "";
}

function pickPreferredFinalAnswerUrl(candidates) {
  if (!Array.isArray(candidates)) {
    return "";
  }

  const normalized = candidates.map((candidate) => normalizeUrlString(candidate)).filter(Boolean);
  if (normalized.length === 0) {
    return "";
  }

  // Trust the explicit final-answer field if present and not blocked.
  if (!isHiddenIntermediateResultUrl(normalized[0])) {
    return normalized[0];
  }

  for (const candidate of normalized) {
    if (isLikelyFinalAnswerUrl(candidate)) {
      return candidate;
    }
  }

  return "";
}

function pickAcademicAnswerMarkdownUrl(candidates) {
  if (!Array.isArray(candidates)) {
    return "";
  }

  for (const candidate of candidates) {
    const normalized = normalizeUrlString(candidate);
    if (!normalized || isHiddenIntermediateResultUrl(normalized)) {
      continue;
    }

    const fileName = getResolvedFileName(normalized);
    if (!fileName) {
      continue;
    }

    const isMarkdown = fileName.endsWith(".md");
    const isAcademicAnswer = fileName.includes("academic") && fileName.includes("answer");
    if (isMarkdown && isAcademicAnswer) {
      return normalized;
    }
  }

  return "";
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

  if (text.includes("orchestrator: graph execution started")) {
    return ["Orchestrator_Init"];
  }

  if (text.includes("evaluator agent: classifying rag strategy")) {
    return ["RAG_Strategy_Evaluator"];
  }

  if (text.includes("extractor agent: starting parallel document extraction")) {
    return ["Extractor_Agent", "Extraction_Workers"];
  }

  if (text.includes("extractor agent: extracting document from")) {
    return ["Extractor_Agent", "Extraction_Workers"];
  }

  if (text.includes("extractor agent: no reference urls provided. skipping extraction")) {
    return ["Extractor_Agent", "Extraction_Workers"];
  }

  if (text.includes("extractor agent: starting question refinement")) {
    return ["Extractor_Agent", "Question_Refiner"];
  }

  if (text.includes("extractor agent: refining questions from")) {
    return ["Extractor_Agent", "Question_Refiner"];
  }

  if (text.includes("extractor agent: question refinement complete")) {
    return ["Question_Refiner", "RAG_Strategy_Evaluator"];
  }

  if (text.includes("evaluator agent: defaulting to vector strategy")) {
    return ["RAG_Strategy_Evaluator", "Ingestion_Router"];
  }

  if (text.includes("orchestrator: routing to vector ingestor")) {
    return ["Ingestion_Router", "Vector_Ingestor"];
  }

  if (text.includes("orchestrator: routing to graph ingestor")) {
    return ["Ingestion_Router", "Graph_Ingestor"];
  }

  if (text.includes("orchestrator: routing to vectorless ingestor")) {
    return ["Ingestion_Router", "Vectorless_Ingestor"];
  }

  if (text.includes("routing to") && text.includes("ingestor")) {
    if (text.includes("vectorless")) {
      return ["Ingestion_Router", "Vectorless_Ingestor"];
    }
    if (text.includes("graph")) {
      return ["Ingestion_Router", "Graph_Ingestor"];
    }
    if (text.includes("vector")) {
      return ["Ingestion_Router", "Vector_Ingestor"];
    }
  }

  if (text.includes("vector ingestor: processing chunks")) {
    return ["Vector_Ingestor"];
  }

  if (text.includes("vector ingestor: successfully ingested")) {
    return ["Vector_Ingestor", "Domain_Evaluator"];
  }

  if (text.includes("vector ingestor")) {
    return ["Vector_Ingestor"];
  }

  if (text.includes("graph ingestor: mapping entities")) {
    return ["Graph_Ingestor", "Domain_Evaluator"];
  }

  if (text.includes("graph ingestor")) {
    return ["Graph_Ingestor", "Domain_Evaluator"];
  }

  if (text.includes("vectorless ingestor: storing raw text data")) {
    return ["Vectorless_Ingestor", "Domain_Evaluator"];
  }

  if (text.includes("vectorless ingestor")) {
    return ["Vectorless_Ingestor", "Domain_Evaluator"];
  }

  if (text.includes("failed to extract") || text.includes("failed to refine questions")) {
    return ["Extractor_Agent", "Extraction_Workers", "Question_Refiner"];
  }

  if (text.includes("evaluator agent: classifying document domain")) {
    return ["Domain_Evaluator", "Specialist_Router"];
  }

  if (text.includes("evaluator agent: domain classified as")) {
    return ["Domain_Evaluator", "Specialist_Router"];
  }

  if (text.includes("orchestrator: routing to academic specialist agent")) {
    return ["Specialist_Router", "Academic_Agent"];
  }

  if (text.includes("academic agent: analyzing theories and citations")) {
    return ["Specialist_Router", "Academic_Agent"];
  }

  if (text.includes("orchestrator: routing to financial specialist agent")) {
    return ["Specialist_Router", "Financial_Agent"];
  }

  if (text.includes("financial agent")) {
    return ["Specialist_Router", "Financial_Agent"];
  }

  if (text.includes("orchestrator: routing to audit specialist agent")) {
    return ["Specialist_Router", "Audit_Agent"];
  }

  if (text.includes("audit agent")) {
    return ["Specialist_Router", "Audit_Agent"];
  }

  if (text.includes("academic agent: extracting questions and initiating workers")) {
    return ["Academic_Agent", "Academic_Workers"];
  }

  if (text.includes("academic agent: stitching final study guide")) {
    return ["Academic_Aggregator"];
  }

  if (text.includes("academic agent complete")) {
    return ["Academic_Aggregator", "Milvus_Index"];
  }

  if (text.includes("final q&a successfully indexed in milvus")) {
    return ["Milvus_Index", "END"];
  }

  return null;
}

const SOCKET_NODE_TO_GRAPH_NODE_IDS = {
  start: ["START"],
  input: ["START"],
  extraction_workers: ["Extraction_Workers"],
  question_refiner: ["Question_Refiner"],
  rag_strategy_evaluator: ["RAG_Strategy_Evaluator"],
  rag_evaluator: ["RAG_Strategy_Evaluator"],
  ingestion_router: ["Ingestion_Router"],
  orchestrator: ["Orchestrator_Init"],
  orchestrator_init: ["Orchestrator_Init"],
  extractor: ["Extractor_Agent"],
  extractor_agent: ["Extractor_Agent"],
  vector_rag_ingest: ["Vector_Ingestor"],
  vector_ingestor: ["Vector_Ingestor"],
  graph_rag_ingest: ["Graph_Ingestor"],
  graph_ingestor: ["Graph_Ingestor"],
  vectorless_ingest: ["Vectorless_Ingestor"],
  vectorless_ingestor: ["Vectorless_Ingestor"],
  domain_evaluator: ["Domain_Evaluator"],
  specialist_router: ["Specialist_Router"],
  academic: ["Academic_Agent"],
  academic_agent: ["Academic_Agent"],
  academic_workers: ["Academic_Workers"],
  academic_aggregator: ["Academic_Aggregator"],
  financial: ["Financial_Agent"],
  financial_agent: ["Financial_Agent"],
  audit: ["Audit_Agent"],
  audit_agent: ["Audit_Agent"],
  milvus_index: ["Milvus_Index"],
  final: ["END"],
  final_result: ["END"],
  end: ["END"],
  completed: ["END"],
};

function mapSocketNodeToGraphNodes(currentNode, message, eventType) {
  const normalizedNode = (currentNode || "").toString().trim().toLowerCase();
  if (!normalizedNode) {
    return null;
  }

  const normalizedMessage = (message || "").toString().toLowerCase();
  const mappedByMessage = mapLogToActiveNodes(message, eventType);
  const mappedBase = SOCKET_NODE_TO_GRAPH_NODE_IDS[normalizedNode] || null;

  if (normalizedNode === "orchestrator" || normalizedNode === "orchestrator_init") {
    return mappedByMessage && mappedByMessage.length > 0 ? mappedByMessage : ["Orchestrator_Init"];
  }

  if (normalizedNode === "extractor" || normalizedNode === "extractor_agent") {
    if (normalizedMessage.includes("question refinement")) {
      return normalizedMessage.includes("complete")
        ? ["Question_Refiner", "RAG_Strategy_Evaluator"]
        : ["Extractor_Agent", "Question_Refiner"];
    }

    if (
      normalizedMessage.includes("parallel document extraction") ||
      normalizedMessage.includes("reference extraction") ||
      normalizedMessage.includes("extracting")
    ) {
      return ["Extractor_Agent", "Extraction_Workers"];
    }

    return ["Extractor_Agent"];
  }

  if (normalizedNode === "vector_rag_ingest" || normalizedNode === "vector_ingestor") {
    return ["Ingestion_Router", "Vector_Ingestor"];
  }

  if (normalizedNode === "graph_rag_ingest" || normalizedNode === "graph_ingestor") {
    return ["Ingestion_Router", "Graph_Ingestor"];
  }

  if (normalizedNode === "vectorless_ingest" || normalizedNode === "vectorless_ingestor") {
    return ["Ingestion_Router", "Vectorless_Ingestor"];
  }

  if (normalizedNode === "rag_strategy_evaluator" || normalizedNode === "rag_evaluator") {
    if ((normalizedMessage.includes("routing") || normalizedMessage.includes("route")) && normalizedMessage.includes("vectorless")) {
      return ["Ingestion_Router", "Vectorless_Ingestor"];
    }

    if ((normalizedMessage.includes("routing") || normalizedMessage.includes("route")) && normalizedMessage.includes("graph")) {
      return ["Ingestion_Router", "Graph_Ingestor"];
    }

    if ((normalizedMessage.includes("routing") || normalizedMessage.includes("route")) && normalizedMessage.includes("vector")) {
      return ["Ingestion_Router", "Vector_Ingestor"];
    }

    if (normalizedMessage.includes("strategy") && normalizedMessage.includes("vectorless")) {
      return ["RAG_Strategy_Evaluator", "Ingestion_Router", "Vectorless_Ingestor"];
    }

    if (normalizedMessage.includes("strategy") && normalizedMessage.includes("graph")) {
      return ["RAG_Strategy_Evaluator", "Ingestion_Router", "Graph_Ingestor"];
    }

    if (normalizedMessage.includes("strategy") && normalizedMessage.includes("vector")) {
      return ["RAG_Strategy_Evaluator", "Ingestion_Router", "Vector_Ingestor"];
    }

    if (normalizedMessage.includes("ingestion router") || normalizedMessage.includes("ingestion_router")) {
      return ["RAG_Strategy_Evaluator", "Ingestion_Router"];
    }

    return ["RAG_Strategy_Evaluator"];
  }

  if (normalizedNode === "academic" || normalizedNode === "academic_agent") {
    if (normalizedMessage.includes("initiating workers") || normalizedMessage.includes("dispatching workers")) {
      return ["Academic_Agent", "Academic_Workers"];
    }

    if (normalizedMessage.includes("stitching final study guide") || normalizedMessage.includes("stitch")) {
      return ["Academic_Aggregator"];
    }

    if (normalizedMessage.includes("academic agent complete")) {
      return ["Academic_Aggregator", "Milvus_Index"];
    }

    if (normalizedMessage.includes("indexed in milvus")) {
      return ["Milvus_Index", "END"];
    }

    return ["Specialist_Router", "Academic_Agent"];
  }

  if (normalizedNode === "financial" || normalizedNode === "financial_agent") {
    return ["Specialist_Router", "Financial_Agent"];
  }

  if (normalizedNode === "audit" || normalizedNode === "audit_agent") {
    return ["Specialist_Router", "Audit_Agent"];
  }

  if (normalizedNode === "end" || normalizedNode === "final" || normalizedNode === "final_result" || normalizedNode === "completed") {
    return mappedByMessage && mappedByMessage.length > 0 ? mappedByMessage : ["END"];
  }

  // Canonical fallback should participate in stage comparison rather than returning early.
  const canonicalNodeId = normalizePipelineNodeId(normalizedNode);
  let canonicalMapped = null;

  if (canonicalNodeId === "Vector_Ingestor") {
    canonicalMapped = ["Ingestion_Router", "Vector_Ingestor"];
  } else if (canonicalNodeId === "Graph_Ingestor") {
    canonicalMapped = ["Ingestion_Router", "Graph_Ingestor"];
  } else if (canonicalNodeId === "Vectorless_Ingestor") {
    canonicalMapped = ["Ingestion_Router", "Vectorless_Ingestor"];
  } else if (canonicalNodeId) {
    canonicalMapped = [canonicalNodeId];
  }

  const effectiveBase = Array.isArray(mappedBase) && mappedBase.length > 0 ? mappedBase : canonicalMapped;

  const hasMappedBase = Array.isArray(effectiveBase) && effectiveBase.length > 0;
  const hasMappedByMessage = Array.isArray(mappedByMessage) && mappedByMessage.length > 0;

  if (!hasMappedBase && !hasMappedByMessage) {
    return null;
  }

  if (!hasMappedBase) {
    return mappedByMessage;
  }

  if (!hasMappedByMessage) {
    return effectiveBase;
  }

  const mappedBaseStageIndex = getHighestPrimaryStageIndex(effectiveBase);
  const mappedByMessageStageIndex = getHighestPrimaryStageIndex(mappedByMessage);

  if (mappedByMessageStageIndex > mappedBaseStageIndex) {
    return mappedByMessage;
  }

  return effectiveBase;
}

function mapSocketStatusToNodeStatus(statusValue, eventType, logType) {
  const normalizedStatus = (statusValue || "").toString().trim().toLowerCase();
  const normalizedEventType = (eventType || "").toString().trim().toLowerCase();
  const normalizedLogType = (logType || "").toString().trim().toLowerCase();
  const merged = `${normalizedStatus} ${normalizedEventType} ${normalizedLogType}`;

  if (merged.includes("error") || merged.includes("failed")) {
    return "failed";
  }

  if (merged.includes("complete") || merged.includes("completed") || merged.includes("done") || merged.includes("success")) {
    return "success";
  }

  if (
    normalizedStatus.includes("processing") ||
    normalizedStatus.includes("progress") ||
    normalizedStatus.includes("running") ||
    normalizedStatus.includes("started") ||
    normalizedStatus.includes("start") ||
    normalizedStatus.includes("pending")
  ) {
    return "processing";
  }

  if (normalizedEventType === "message" || normalizedLogType === "message") {
    return "processing";
  }

  return "idle";
}

function truncateActivityText(value, max = 88) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  if (normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, max - 1).trim()}…`;
}

const NODE_SOCKET_HISTORY_LIMIT = 80;
const GRAPH_GROOMING_REPLAY_STEP_MS = 560;
const NODE_STATUS_PRIORITY = {
  idle: 0,
  success: 1,
  processing: 2,
  failed: 3,
};

function normalizeNodeStatus(value) {
  const next = (value || "").toString().trim().toLowerCase();
  if (next === "failed" || next === "processing" || next === "success" || next === "idle") {
    return next;
  }
  return "idle";
}

function chooseNodeStatus(previousStatus, nextStatus) {
  const prev = normalizeNodeStatus(previousStatus);
  const next = normalizeNodeStatus(nextStatus);
  return NODE_STATUS_PRIORITY[next] >= NODE_STATUS_PRIORITY[prev] ? next : prev;
}

function sanitizeNodeStatusById(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const normalized = {};
  for (const [nodeId, status] of Object.entries(value)) {
    const canonicalNodeId = normalizePipelineNodeId(nodeId);
    if (!canonicalNodeId) {
      continue;
    }

    const nextStatus = normalizeNodeStatus(status);
    if (nextStatus !== "idle") {
      normalized[canonicalNodeId] = chooseNodeStatus(normalized[canonicalNodeId], nextStatus);
    }
  }

  return normalized;
}

function sanitizeNodeSocketMessagesById(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const normalized = {};
  for (const [nodeId, entries] of Object.entries(value)) {
    const canonicalNodeId = normalizePipelineNodeId(nodeId);
    if (!canonicalNodeId || !Array.isArray(entries)) {
      continue;
    }

    const nextEntries = entries
      .filter((entry) => entry && typeof entry === "object")
      .map((entry, index) => {
        const message = typeof entry.message === "string" ? entry.message.trim() : "";
        if (!message) {
          return null;
        }

        const type = typeof entry.type === "string" && entry.type.trim() ? entry.type.trim().toLowerCase() : "message";
        const eventType =
          typeof entry.eventType === "string" && entry.eventType.trim() ? entry.eventType.trim().toLowerCase() : type;
        const currentNode = normalizePipelineNodeId(entry.currentNode || entry.current_node || "") || "";
        const status = typeof entry.status === "string" && entry.status.trim() ? entry.status.trim().toLowerCase() : "";
        const at = typeof entry.at === "string" && entry.at.trim() ? entry.at.trim() : "";
        const id = typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : `${canonicalNodeId}-${index}`;

        return { id, type, eventType, currentNode, status, message, at };
      })
      .filter(Boolean)
      .slice(-NODE_SOCKET_HISTORY_LIMIT);

    if (nextEntries.length > 0) {
      const existingEntries = Array.isArray(normalized[canonicalNodeId]) ? normalized[canonicalNodeId] : [];
      normalized[canonicalNodeId] = [...existingEntries, ...nextEntries].slice(-NODE_SOCKET_HISTORY_LIMIT);
    }
  }

  return normalized;
}

function parseObjectLikeJson(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Ignore malformed JSON snapshot payloads.
  }

  return null;
}

function coerceNodeIdList(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    const next = value.trim();
    return next ? [next] : [];
  }

  return [];
}

function extractGroomingSnapshot(source) {
  const sourceObject = parseObjectLikeJson(source);
  if (!sourceObject) {
    return null;
  }

  const candidates = [
    sourceObject.grooming_data,
    sourceObject.groomingData,
    sourceObject.data?.grooming_data,
    sourceObject.data?.groomingData,
    sourceObject.result?.grooming_data,
    sourceObject.result?.groomingData,
    sourceObject,
  ];

  for (const candidate of candidates) {
    const parsedCandidate = parseObjectLikeJson(candidate);
    if (!parsedCandidate) {
      continue;
    }

    const hasGroomingSignal =
      "currentNodeIds" in parsedCandidate ||
      "current_node_ids" in parsedCandidate ||
      "currentNode" in parsedCandidate ||
      "current_node" in parsedCandidate ||
      "currentNodeId" in parsedCandidate ||
      "current_node_id" in parsedCandidate ||
      "visitedNodeIds" in parsedCandidate ||
      "visited_node_ids" in parsedCandidate ||
      "visitedNodes" in parsedCandidate ||
      "visited_nodes" in parsedCandidate ||
      "nodeStatusById" in parsedCandidate ||
      "node_status_by_id" in parsedCandidate ||
      "nodeStatuses" in parsedCandidate ||
      "node_statuses" in parsedCandidate ||
      "nodeSocketMessagesById" in parsedCandidate ||
      "node_socket_messages_by_id" in parsedCandidate ||
      "nodeSocketMessages" in parsedCandidate ||
      "node_socket_messages" in parsedCandidate ||
      "failedNodeIds" in parsedCandidate ||
      "failed_node_ids" in parsedCandidate ||
      "failedNodes" in parsedCandidate ||
      "failed_nodes" in parsedCandidate;

    if (!hasGroomingSignal) {
      continue;
    }

    return {
      currentNodeIds: coerceNodeIdList(
        parsedCandidate.currentNodeIds ??
          parsedCandidate.current_node_ids ??
          parsedCandidate.currentNode ??
          parsedCandidate.current_node ??
          parsedCandidate.currentNodeId ??
          parsedCandidate.current_node_id ??
          []
      ),
      visitedNodeIds: coerceNodeIdList(
        parsedCandidate.visitedNodeIds ?? parsedCandidate.visited_node_ids ?? parsedCandidate.visitedNodes ?? parsedCandidate.visited_nodes ?? []
      ),
      failedNodeIds: coerceNodeIdList(
        parsedCandidate.failedNodeIds ?? parsedCandidate.failed_node_ids ?? parsedCandidate.failedNodes ?? parsedCandidate.failed_nodes ?? []
      ),
      nodeStatusById:
        parsedCandidate.nodeStatusById ?? parsedCandidate.node_status_by_id ?? parsedCandidate.nodeStatuses ?? parsedCandidate.node_statuses ?? {},
      nodeSocketMessagesById:
        parsedCandidate.nodeSocketMessagesById ??
        parsedCandidate.node_socket_messages_by_id ??
        parsedCandidate.nodeSocketMessages ??
        parsedCandidate.node_socket_messages ??
        {},
      savedAt: parsedCandidate.savedAt ?? parsedCandidate.saved_at ?? 0,
    };
  }

  return null;
}

function mergeNodeSocketMessages(previous, additions) {
  const next = { ...(previous || {}) };

  for (const [nodeId, entries] of Object.entries(additions || {})) {
    const existingEntries = Array.isArray(next[nodeId]) ? next[nodeId] : [];
    const seen = new Set(existingEntries.map((entry) => entry.id));
    const mergedEntries = [...existingEntries];

    for (const entry of entries) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      if (seen.has(entry.id)) {
        continue;
      }

      mergedEntries.push(entry);
      seen.add(entry.id);
    }

    next[nodeId] = mergedEntries.slice(-NODE_SOCKET_HISTORY_LIMIT);
  }

  return next;
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

function areNodeStatusMapsEqual(a, b) {
  const normalizedA = sanitizeNodeStatusById(a);
  const normalizedB = sanitizeNodeStatusById(b);
  const keysA = Object.keys(normalizedA);
  const keysB = Object.keys(normalizedB);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (normalizedA[key] !== normalizedB[key]) {
      return false;
    }
  }

  return true;
}

function areNodeSocketMessageMapsEqual(a, b) {
  const normalizedA = sanitizeNodeSocketMessagesById(a);
  const normalizedB = sanitizeNodeSocketMessagesById(b);
  const keysA = Object.keys(normalizedA);
  const keysB = Object.keys(normalizedB);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    const entriesA = normalizedA[key] || [];
    const entriesB = normalizedB[key] || [];

    if (entriesA.length !== entriesB.length) {
      return false;
    }

    for (let index = 0; index < entriesA.length; index += 1) {
      const left = entriesA[index];
      const right = entriesB[index];

      if (
        left.id !== right.id ||
        left.type !== right.type ||
        left.eventType !== right.eventType ||
        left.currentNode !== right.currentNode ||
        left.status !== right.status ||
        left.message !== right.message ||
        left.at !== right.at
      ) {
        return false;
      }
    }
  }

  return true;
}

function getGroomingProgressMetric({ visitedNodeIds, nodeStatusById, nodeSocketMessagesById }) {
  const visitedCount = sanitizeNodeIdList(visitedNodeIds, []).length;
  const statusCount = Object.keys(sanitizeNodeStatusById(nodeStatusById)).length;
  const messageCount = Object.values(sanitizeNodeSocketMessagesById(nodeSocketMessagesById)).reduce(
    (count, entries) => count + (Array.isArray(entries) ? entries.length : 0),
    0
  );

  return visitedCount * 1000 + statusCount * 100 + messageCount;
}

function getHighestPrimaryStageIndex(nodeIds) {
  const normalizedNodeIds = sanitizeNodeIdList(nodeIds, []);
  let highest = -1;

  for (const nodeId of normalizedNodeIds) {
    const nextIndex = PRIMARY_STAGE_SEQUENCE.indexOf(nodeId);
    if (nextIndex > highest) {
      highest = nextIndex;
    }
  }

  return highest;
}

function getHighestPrimaryStageNodeId(nodeIds) {
  const normalizedNodeIds = sanitizeNodeIdList(nodeIds, []);
  let bestNodeId = "";
  let bestIndex = -1;

  for (const nodeId of normalizedNodeIds) {
    const nextIndex = PRIMARY_STAGE_SEQUENCE.indexOf(nodeId);
    if (nextIndex > bestIndex) {
      bestIndex = nextIndex;
      bestNodeId = nodeId;
    }
  }

  return bestNodeId;
}

function resolveEffectiveCurrentNodeIds(snapshot) {
  const snapshotCurrent = sanitizeNodeIdList(snapshot?.currentNodeIds, []);
  const snapshotVisited = sanitizeNodeIdList(snapshot?.visitedNodeIds, []);
  const snapshotStatusMap = sanitizeNodeStatusById(snapshot?.nodeStatusById);

  const currentStageIndex = getHighestPrimaryStageIndex(snapshotCurrent);
  const highestVisitedNodeId = getHighestPrimaryStageNodeId(snapshotVisited);
  const highestVisitedStageIndex = highestVisitedNodeId ? PRIMARY_STAGE_SEQUENCE.indexOf(highestVisitedNodeId) : -1;

  const processingNodeCandidates = Object.entries(snapshotStatusMap)
    .filter(([, nextStatus]) => normalizeNodeStatus(nextStatus) === "processing")
    .map(([nodeId]) => nodeId);
  const highestProcessingNodeId = getHighestPrimaryStageNodeId(processingNodeCandidates);
  const highestProcessingStageIndex = highestProcessingNodeId ? PRIMARY_STAGE_SEQUENCE.indexOf(highestProcessingNodeId) : -1;

  if (highestProcessingNodeId && highestProcessingStageIndex > currentStageIndex) {
    return [highestProcessingNodeId];
  }

  if (highestVisitedNodeId && highestVisitedStageIndex > currentStageIndex) {
    return [highestVisitedNodeId];
  }

  if (snapshotCurrent.length > 0) {
    return snapshotCurrent;
  }

  if (highestProcessingNodeId) {
    return [highestProcessingNodeId];
  }

  if (highestVisitedNodeId) {
    return [highestVisitedNodeId];
  }

  return ["START"];
}

function shouldApplyRemoteGroomingSnapshot(localSnapshot, remoteSnapshot) {
  const localVisited = sanitizeNodeIdList(localSnapshot?.visitedNodeIds, []);
  const localCurrent = sanitizeNodeIdList(localSnapshot?.currentNodeIds, []);
  const remoteVisited = sanitizeNodeIdList(remoteSnapshot?.visitedNodeIds, []);
  const remoteCurrent = sanitizeNodeIdList(remoteSnapshot?.currentNodeIds, []);

  const localStageIndex = Math.max(getHighestPrimaryStageIndex(localVisited), getHighestPrimaryStageIndex(localCurrent));
  const remoteStageIndex = Math.max(getHighestPrimaryStageIndex(remoteVisited), getHighestPrimaryStageIndex(remoteCurrent));

  if (remoteStageIndex > localStageIndex) {
    return true;
  }

  if (remoteStageIndex < localStageIndex) {
    return false;
  }

  if (remoteVisited.length > localVisited.length) {
    return true;
  }

  if (remoteVisited.length < localVisited.length) {
    return false;
  }

  const remoteProgress = getGroomingProgressMetric({
    visitedNodeIds: remoteVisited,
    nodeStatusById: remoteSnapshot?.nodeStatusById,
    nodeSocketMessagesById: remoteSnapshot?.nodeSocketMessagesById,
  });
  const localProgress = getGroomingProgressMetric({
    visitedNodeIds: localVisited,
    nodeStatusById: localSnapshot?.nodeStatusById,
    nodeSocketMessagesById: localSnapshot?.nodeSocketMessagesById,
  });

  return remoteProgress >= localProgress;
}

function mergeUniqueNodes(previous, additions) {
  return Array.from(new Set([...(Array.isArray(previous) ? previous : []), ...(Array.isArray(additions) ? additions : [])]));
}

function getBootstrapPathForNode(nodeId) {
  const extractionPrelude = ["Orchestrator_Init", "Extractor_Agent", "Extraction_Workers", "Question_Refiner"];

  if (nodeId === "Extraction_Workers") {
    return ["Orchestrator_Init", "Extractor_Agent", "Extraction_Workers"];
  }

  if (nodeId === "Question_Refiner") {
    return ["Orchestrator_Init", "Extractor_Agent", "Question_Refiner"];
  }

  if (PRIMARY_STAGE_SET.has(nodeId)) {
    const stageIndex = PRIMARY_STAGE_SEQUENCE.indexOf(nodeId);
    if (stageIndex <= 2) {
      return PRIMARY_STAGE_SEQUENCE.slice(1, stageIndex + 1);
    }

    const primaryTail = PRIMARY_STAGE_SEQUENCE.slice(3, stageIndex + 1);
    return mergeUniqueNodes(extractionPrelude, primaryTail);
  }

  if (nodeId === "Graph_Ingestor" || nodeId === "Vectorless_Ingestor") {
    return [...extractionPrelude, "RAG_Strategy_Evaluator", "Ingestion_Router", nodeId];
  }

  if (nodeId === "Financial_Agent" || nodeId === "Audit_Agent") {
    return [...extractionPrelude, "RAG_Strategy_Evaluator", "Ingestion_Router", "Vector_Ingestor", "Domain_Evaluator", "Specialist_Router", nodeId];
  }

  return [];
}

function buildBootstrapProgressNodes(nodeIds) {
  const normalizedNodeIds = Array.isArray(nodeIds) ? nodeIds : [];
  const bootstrap = [];

  for (const nodeId of normalizedNodeIds) {
    bootstrap.push(...getBootstrapPathForNode(nodeId));
  }

  return mergeUniqueNodes(bootstrap, normalizedNodeIds);
}

function sanitizeNodeIdList(value, fallback = []) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value
    .map((item) => normalizePipelineNodeId(item))
    .filter((item) => typeof item === "string" && item.trim());
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
  const filteredResultUrls = filterDisplayableDocumentUrls(resultUrls);
  const finalResultUrls = filteredResultUrls.filter((url) => isLikelyFinalAnswerUrl(url));
  const filteredQuestionUrls = filterDisplayableDocumentUrls(questionUrls);
  const preferredFinalAnswerUrl = pickPreferredFinalAnswerUrl([finalAnswerUrl, ...finalResultUrls]);
  const groomingData = root.grooming_data || objects.find((o) => isObject(o.grooming_data))?.grooming_data || null;

  return {
    ...root,
    title,
    description,
    status: processStatus,
    final_answer_url: preferredFinalAnswerUrl,
    result_urls: finalResultUrls,
    reference_urls: referenceUrls,
    question_urls: filteredQuestionUrls,
    grooming_data: groomingData,
  };
}

function getNodeVisualType(nodeId) {
  if (nodeId === "START") {
    return "start";
  }
  if (nodeId === "END") {
    return "end";
  }
  if (nodeId.includes("Router")) {
    return "router";
  }
  if (nodeId.includes("Ingestor") || nodeId.includes("Milvus")) {
    return "database";
  }
  if (nodeId.includes("Evaluator")) {
    return "evaluator";
  }
  if (nodeId.includes("Workers")) {
    return "workers";
  }
  if (nodeId.includes("Refiner")) {
    return "refiner";
  }
  if (nodeId.includes("Aggregator")) {
    return "aggregate";
  }
  return "agent";
}

function NodeVisualIcon({ nodeId }) {
  const iconType = getNodeVisualType(nodeId || "");

  if (iconType === "start") {
    return (
      <svg viewBox="0 0 24 24" className="node-visual-svg" fill="currentColor" aria-hidden="true">
        <path d="M8 5.5v13l10-6.5-10-6.5z" />
      </svg>
    );
  }

  if (iconType === "end") {
    return (
      <svg viewBox="0 0 24 24" className="node-visual-svg" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M5 12l4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (iconType === "database") {
    return (
      <svg viewBox="0 0 24 24" className="node-visual-svg" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
        <ellipse cx="12" cy="6" rx="7" ry="3" />
        <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
        <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
      </svg>
    );
  }

  if (iconType === "router") {
    return (
      <svg viewBox="0 0 24 24" className="node-visual-svg" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
        <circle cx="6" cy="6" r="2" />
        <circle cx="18" cy="6" r="2" />
        <circle cx="12" cy="18" r="2" />
        <path d="M8 6h8" />
        <path d="M7 8l4 8" />
        <path d="M17 8l-4 8" />
      </svg>
    );
  }

  if (iconType === "evaluator") {
    return (
      <svg viewBox="0 0 24 24" className="node-visual-svg" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
        <circle cx="11" cy="11" r="5" />
        <path d="M16 16l4 4" strokeLinecap="round" />
      </svg>
    );
  }

  if (iconType === "workers") {
    return (
      <svg viewBox="0 0 24 24" className="node-visual-svg" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="9" cy="9" r="2.5" />
        <circle cx="16" cy="10" r="2" />
        <path d="M5.5 17c.9-2.4 2.3-3.5 4.5-3.5s3.5 1.1 4.2 3.5" />
        <path d="M14.2 17c.5-1.5 1.3-2.3 2.8-2.3 1.2 0 2 .5 2.5 1.7" />
      </svg>
    );
  }

  if (iconType === "refiner") {
    return (
      <svg viewBox="0 0 24 24" className="node-visual-svg" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M4 7h16" strokeLinecap="round" />
        <path d="M7 12h10" strokeLinecap="round" />
        <path d="M10 17h4" strokeLinecap="round" />
      </svg>
    );
  }

  if (iconType === "aggregate") {
    return (
      <svg viewBox="0 0 24 24" className="node-visual-svg" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
        <path d="M6 7l6 6" strokeLinecap="round" />
        <path d="M18 7l-6 6" strokeLinecap="round" />
        <path d="M12 13v5" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="node-visual-svg" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="M9 3h6" strokeLinecap="round" />
      <rect x="6" y="7" width="12" height="10" rx="3" />
      <circle cx="10" cy="12" r="1" fill="currentColor" />
      <circle cx="14" cy="12" r="1" fill="currentColor" />
      <path d="M9.5 15h5" strokeLinecap="round" />
    </svg>
  );
}

function getRoutedEdgePath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, route }) {
  if (route === "under" || route === "under-deep") {
    const horizontalSpan = Math.max(280, Math.abs(targetX - sourceX) * 0.34);
    const dipDepth = route === "under-deep" ? 380 : 300;
    const controlY = Math.max(sourceY, targetY) + dipDepth;
    const control1X = sourceX + horizontalSpan;
    const control2X = targetX - horizontalSpan;
    return `M ${sourceX},${sourceY} C ${control1X},${controlY} ${control2X},${controlY} ${targetX},${targetY}`;
  }

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return edgePath;
}

function PipelineEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
}) {
  const edgePath = getRoutedEdgePath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    route: data?.route,
  });

  const edgeState = data?.edgeState || "idle";
  const isFailed = edgeState === "failed";
  const isActive = edgeState === "active";
  const isVisited = edgeState === "visited";

  const stroke = isFailed
    ? "rgba(248,113,113,0.95)"
    : isActive
    ? "rgba(139,92,246,0.95)"
    : isVisited
    ? "rgba(196,181,253,0.9)"
    : "rgba(148,163,184,0.38)";
  const strokeWidth = isActive ? 3.1 : isVisited || isFailed ? 2.55 : 1.75;

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={{ stroke, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" }} />

      {isActive && (
        <>
          <circle r="4.6" className="edge-packet">
            <animateMotion dur="3.2s" repeatCount="indefinite" path={edgePath} />
          </circle>
          <circle r="3.4" className="edge-packet-secondary">
            <animateMotion dur="3.2s" begin="-1.6s" repeatCount="indefinite" path={edgePath} />
          </circle>
        </>
      )}

      {isVisited && !isActive && !isFailed && (
        <circle r="2.9" className="edge-packet-visited">
          <animateMotion dur="4.8s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}

      {isFailed && (
        <circle r="4.2" className="edge-packet-failed">
          <animateMotion dur="1.6s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
    </>
  );
}

function PipelineNode({ data }) {
  const nodeState = data?.nodeState || "idle";
  const nodeId = data?.nodeId || "";
  const stepIndex = Number.isInteger(data?.stepIndex) ? data.stepIndex : -1;
  const isPrimaryStage = Boolean(data?.isPrimaryStage);
  const isSelected = Boolean(data?.isSelected);
  const isFailed = nodeState === "failed";
  const isActive = nodeState === "active";
  const isVisited = nodeState === "visited";

  return (
    <div
      className={`relative w-[380px] rounded-2xl border px-6 py-5 backdrop-blur-xl transition-all duration-300 ${
        isFailed
          ? "border-red-400/80 bg-red-500/15 ring-1 ring-red-300/70 shadow-[0_0_34px_rgba(248,113,113,0.45)] node-failed-glow"
          : isActive
          ? "border-violet-400/80 bg-violet-500/15 ring-1 ring-violet-200/70 shadow-[0_0_34px_rgba(139,92,246,0.4)] node-active-glow"
          : isVisited
          ? "border-violet-300/70 bg-violet-500/10 ring-1 ring-violet-300/45 node-visited-glow"
          : "border-white/15 bg-white/[0.04]"
      } ${isSelected ? "ring-2 ring-violet-200/80 shadow-[0_0_26px_rgba(167,139,250,0.38)]" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-3">
          <div className={`node-avatar ${isFailed ? "node-avatar-failed" : isActive ? "node-avatar-active" : isVisited ? "node-avatar-visited" : "node-avatar-idle"}`}>
            <span className="node-avatar-ring" />
            <span className="node-avatar-icon" aria-hidden="true">
              <NodeVisualIcon nodeId={nodeId} />
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-[1.12rem] font-semibold leading-none text-white">{data.label}</p>
              <span className="node-ai-chip">AI</span>
            </div>
            <p className="mt-1.5 text-[13px] uppercase tracking-widest text-slate-300/80">{data.subtitle}</p>
          </div>
        </div>

        {isPrimaryStage && (
          <span className="node-step-badge" title={`Main Flow Step ${stepIndex + 1}`}>
            {String(stepIndex + 1).padStart(2, "0")}
          </span>
        )}
      </div>

      {(isActive || isFailed || isVisited) && (
        <span
          className={`mt-3 inline-flex items-center gap-1 text-[13px] font-semibold ${
            isFailed ? "text-red-200" : isActive ? "text-violet-100" : "text-violet-200"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isFailed ? "bg-red-300" : isActive ? "bg-violet-300 animate-pulse" : "bg-violet-300"
            }`}
          />
          {isFailed ? "Failed" : isActive ? "Running" : "Visited"}
        </span>
      )}

      {isActive && (
        <div className="node-processing-bars" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}

      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-2 !border-slate-900 !bg-slate-300" />
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-2 !border-slate-900 !bg-violet-300" />
    </div>
  );
}

const nodeTypes = { pipeline: PipelineNode };
const edgeTypes = { pipeline: PipelineEdge };

export default function WorkspacePage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project") || "";
  const viewParam = (searchParams.get("view") || "").toString().toLowerCase();
  const forceGraphView = viewParam === "graph";

  const [activeView, setActiveView] = useState("graph");
  const [currentNodeIds, setCurrentNodeIds] = useState(["START"]);
  const [visitedNodeIds, setVisitedNodeIds] = useState(["START"]);
  const [failedNodeIds, setFailedNodeIds] = useState([]);
  const [displayCurrentNodeIds, setDisplayCurrentNodeIds] = useState(["START"]);
  const [displayVisitedNodeIds, setDisplayVisitedNodeIds] = useState(["START"]);
  const [displayFailedNodeIds, setDisplayFailedNodeIds] = useState([]);
  const [isGraphReplayRunning, setIsGraphReplayRunning] = useState(false);
  const [graphReplayRequestId, setGraphReplayRequestId] = useState(0);
  const [nodeStatusById, setNodeStatusById] = useState({});
  const [nodeSocketMessagesById, setNodeSocketMessagesById] = useState({});
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const currentNodeIdsRef = useRef(["START"]);
  const replayCurrentNodeIdsRef = useRef(["START"]);
  const replayVisitedNodeIdsRef = useRef(["START"]);
  const replayFailedNodeIdsRef = useRef([]);
  const nodeStatusByIdRef = useRef({});
  const nodeSocketMessagesByIdRef = useRef({});
  const processedSocketLogIdsRef = useRef(new Set());
  const completedEventAppliedRef = useRef(false);
  const graphReplayTimerRef = useRef(null);
  const groomingSyncRequestIdRef = useRef(0);
  const [processData, setProcessData] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeDocumentUrl, setActiveDocumentUrl] = useState("");
  const [markdownContent, setMarkdownContent] = useState("");
  const [markdownLoading, setMarkdownLoading] = useState(false);
  const [markdownError, setMarkdownError] = useState("");
  const [markdownImageUrlByToken, setMarkdownImageUrlByToken] = useState({});
  const markdownObjectUrlsRef = useRef([]);

  const { logs, status, lastEventType, finalAnswerUrl, clearLogs } = useAgentWebSocket(projectId, {
    enabled: Boolean(projectId),
  });

  useEffect(() => {
    if (!forceGraphView) {
      return;
    }

    setActiveView("graph");
  }, [forceGraphView, projectId]);

  useEffect(() => {
    if (!projectId || !pathname) {
      return;
    }

    const desiredView = activeView === "document" ? "document" : "graph";
    if (viewParam === desiredView) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("project", projectId);
    nextParams.set("view", desiredView);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }, [activeView, pathname, projectId, router, searchParams, viewParam]);

  useEffect(() => {
    clearLogs();
    setCurrentNodeIds(["START"]);
    setVisitedNodeIds(["START"]);
    setFailedNodeIds([]);
    setDisplayCurrentNodeIds(["START"]);
    setDisplayVisitedNodeIds(["START"]);
    setDisplayFailedNodeIds([]);
    setIsGraphReplayRunning(false);
    setNodeStatusById({});
    setNodeSocketMessagesById({});
    setSelectedNodeId("");
    setGraphReplayRequestId((prev) => prev + 1);
    currentNodeIdsRef.current = ["START"];
    replayCurrentNodeIdsRef.current = ["START"];
    replayVisitedNodeIdsRef.current = ["START"];
    replayFailedNodeIdsRef.current = [];
    processedSocketLogIdsRef.current = new Set();
    completedEventAppliedRef.current = false;
    groomingSyncRequestIdRef.current = 0;

    if (graphReplayTimerRef.current && typeof window !== "undefined") {
      window.clearInterval(graphReplayTimerRef.current);
      graphReplayTimerRef.current = null;
    }
  }, [clearLogs, projectId]);

  useEffect(() => {
    if (isGraphReplayRunning) {
      return;
    }

    const normalizedDisplayStatus = (status || processData?.status || lastEventType || "").toString().toLowerCase();
    const isTerminalLike =
      normalizedDisplayStatus.includes("complete") ||
      normalizedDisplayStatus.includes("completed") ||
      normalizedDisplayStatus.includes("done") ||
      normalizedDisplayStatus.includes("success") ||
      normalizedDisplayStatus.includes("failed") ||
      normalizedDisplayStatus.includes("error");

    if (activeView === "graph" && !isTerminalLike) {
      return;
    }

    setDisplayCurrentNodeIds(currentNodeIds);
    setDisplayVisitedNodeIds(visitedNodeIds);
    setDisplayFailedNodeIds(failedNodeIds);
  }, [activeView, currentNodeIds, failedNodeIds, isGraphReplayRunning, lastEventType, processData?.status, status, visitedNodeIds]);

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
          pickPreferredFinalAnswerUrl([normalizedPayload?.final_answer_url, ...(normalizedPayload?.result_urls || [])]) ||
          normalizedPayload?.reference_urls?.[0] ||
          normalizedPayload?.question_urls?.[0] ||
          "";
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
    if (forceGraphView) {
      return;
    }

    const completionSignals = [(processData?.status || "").toLowerCase(), (lastEventType || "").toLowerCase()];
    const isCompleted = completionSignals.some(
      (value) => value.includes("complete") || value.includes("completed") || value.includes("done") || value.includes("success")
    );
    if (isCompleted) {
      setActiveView("document");
    }
  }, [forceGraphView, lastEventType, processData?.status]);

  useEffect(() => {
    if (activeView !== "graph") {
      if (graphReplayTimerRef.current && typeof window !== "undefined") {
        window.clearInterval(graphReplayTimerRef.current);
        graphReplayTimerRef.current = null;
      }
      setIsGraphReplayRunning(false);
      return;
    }

    setGraphReplayRequestId((prev) => prev + 1);
  }, [activeView]);

  useEffect(
    () => () => {
      if (graphReplayTimerRef.current && typeof window !== "undefined") {
        window.clearInterval(graphReplayTimerRef.current);
        graphReplayTimerRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    if (activeView !== "graph" || !projectId || loadingData) {
      return;
    }

    const targetVisited = sanitizeNodeIdList(replayVisitedNodeIdsRef.current, ["START"]);
    const targetCurrent = sanitizeNodeIdList(replayCurrentNodeIdsRef.current, ["START"]);
    const targetFailed = sanitizeNodeIdList(replayFailedNodeIdsRef.current, []);

    if (targetVisited.length <= 1) {
      setDisplayVisitedNodeIds(targetVisited);
      setDisplayCurrentNodeIds(targetCurrent);
      setDisplayFailedNodeIds(targetFailed);
      setIsGraphReplayRunning(false);
      return;
    }

    setIsGraphReplayRunning(true);
    setDisplayVisitedNodeIds([targetVisited[0] || "START"]);
    setDisplayCurrentNodeIds([targetVisited[0] || "START"]);
    setDisplayFailedNodeIds([]);

    let index = 1;
    const applyReplayStep = () => {
      if (index >= targetVisited.length) {
        if (graphReplayTimerRef.current) {
          window.clearInterval(graphReplayTimerRef.current);
          graphReplayTimerRef.current = null;
        }

        setDisplayVisitedNodeIds(targetVisited);
        setDisplayCurrentNodeIds(targetCurrent);
        setDisplayFailedNodeIds(targetFailed);
        setIsGraphReplayRunning(false);
        return true;
      }

      const nextNodeId = targetVisited[index];
      index += 1;

      setDisplayVisitedNodeIds((prev) => mergeUniqueNodes(prev, [nextNodeId]));
      setDisplayCurrentNodeIds([nextNodeId]);
      if (targetFailed.includes(nextNodeId)) {
        setDisplayFailedNodeIds((prev) => mergeUniqueNodes(prev, [nextNodeId]));
      }
      return false;
    };

    if (!applyReplayStep()) {
      graphReplayTimerRef.current = window.setInterval(() => {
        applyReplayStep();
      }, GRAPH_GROOMING_REPLAY_STEP_MS);
    }

    return () => {
      if (graphReplayTimerRef.current) {
        window.clearInterval(graphReplayTimerRef.current);
        graphReplayTimerRef.current = null;
      }
    };
  }, [activeView, graphReplayRequestId, loadingData, projectId]);

  useEffect(() => {
    if (activeView !== "graph" || isGraphReplayRunning) {
      return;
    }

    if (graphReplayTimerRef.current) {
      return;
    }

    const targetVisited = sanitizeNodeIdList(visitedNodeIds, ["START"]);
    const targetCurrent = sanitizeNodeIdList(currentNodeIds, ["START"]);
    const targetFailed = sanitizeNodeIdList(failedNodeIds, []);
    const currentDisplayVisited = sanitizeNodeIdList(displayVisitedNodeIds, ["START"]);
    const currentDisplayCurrent = sanitizeNodeIdList(displayCurrentNodeIds, ["START"]);
    const currentDisplayFailed = sanitizeNodeIdList(displayFailedNodeIds, []);

    const needsVisitedProgress = targetVisited.length > currentDisplayVisited.length;
    const currentNodeDiffers = !areStringArraysEqual(currentDisplayCurrent, targetCurrent);
    const failedDiffers = !areStringArraysEqual(currentDisplayFailed, targetFailed);

    if (!needsVisitedProgress && !currentNodeDiffers && !failedDiffers) {
      return;
    }

    setIsGraphReplayRunning(true);

    let index = Math.max(1, currentDisplayVisited.length);
    const applyReplayStep = () => {
      if (index >= targetVisited.length) {
        if (graphReplayTimerRef.current) {
          window.clearInterval(graphReplayTimerRef.current);
          graphReplayTimerRef.current = null;
        }

        setDisplayVisitedNodeIds(targetVisited);
        setDisplayCurrentNodeIds(targetCurrent);
        setDisplayFailedNodeIds(targetFailed);
        setIsGraphReplayRunning(false);
        return true;
      }

      const nextNodeId = targetVisited[index];
      index += 1;

      setDisplayVisitedNodeIds((prev) => mergeUniqueNodes(prev, [nextNodeId]));
      setDisplayCurrentNodeIds([nextNodeId]);
      if (targetFailed.includes(nextNodeId)) {
        setDisplayFailedNodeIds((prev) => mergeUniqueNodes(prev, [nextNodeId]));
      }
      return false;
    };

    if (!applyReplayStep()) {
      graphReplayTimerRef.current = window.setInterval(() => {
        applyReplayStep();
      }, GRAPH_GROOMING_REPLAY_STEP_MS);
    }

    return () => {
      if (graphReplayTimerRef.current) {
        window.clearInterval(graphReplayTimerRef.current);
        graphReplayTimerRef.current = null;
      }
    };
  }, [
    activeView,
    currentNodeIds,
    displayCurrentNodeIds,
    displayFailedNodeIds,
    displayVisitedNodeIds,
    failedNodeIds,
    isGraphReplayRunning,
    lastEventType,
    processData?.status,
    status,
    visitedNodeIds,
  ]);

  useEffect(() => {
    const completionSignals = [(lastEventType || "").toString().toLowerCase(), (processData?.status || "").toString().toLowerCase()];
    const isCompleted = completionSignals.some(
      (value) => value.includes("complete") || value.includes("completed") || value.includes("done") || value.includes("success")
    );

    const answerCandidates = [processData?.final_answer_url, finalAnswerUrl, ...(processData?.result_urls || [])];
    const academicAnswerMarkdownUrl = pickAcademicAnswerMarkdownUrl(answerCandidates);
    const preferredFinalAnswerUrl = academicAnswerMarkdownUrl || pickPreferredFinalAnswerUrl(answerCandidates);
    const liveFinalAnswerUrl = resolveSourceUrl(preferredFinalAnswerUrl);
    const shouldOpenDocument = isCompleted || Boolean(academicAnswerMarkdownUrl);
    if (!shouldOpenDocument || !liveFinalAnswerUrl) {
      return;
    }

    setActiveDocumentUrl((prev) => {
      const normalizedPrev = resolveSourceUrl(prev);
      return normalizedPrev === liveFinalAnswerUrl ? prev : liveFinalAnswerUrl;
    });

    if (!forceGraphView) {
      setActiveView("document");
    }
  }, [finalAnswerUrl, forceGraphView, lastEventType, processData?.final_answer_url, processData?.result_urls, processData?.status]);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    try {
      const parsed = extractGroomingSnapshot(processData);
      if (!parsed) {
        return;
      }

      const restoredCurrent = sanitizeNodeIdList(resolveEffectiveCurrentNodeIds(parsed), ["START"]);
      const restoredVisited = sanitizeNodeIdList(parsed?.visitedNodeIds, restoredCurrent);
      const restoredFailed = sanitizeNodeIdList(parsed?.failedNodeIds, []);
      const restoredNodeStatusById = sanitizeNodeStatusById(parsed?.nodeStatusById);
      const restoredNodeSocketMessagesById = sanitizeNodeSocketMessagesById(parsed?.nodeSocketMessagesById);

      setCurrentNodeIds(restoredCurrent);
      setVisitedNodeIds(restoredVisited);
      setFailedNodeIds(restoredFailed);
      setNodeStatusById(restoredNodeStatusById);
      setNodeSocketMessagesById(restoredNodeSocketMessagesById);
      setSelectedNodeId((prev) => prev || restoredCurrent[0] || "");
      currentNodeIdsRef.current = restoredCurrent;
      replayCurrentNodeIdsRef.current = restoredCurrent;
      replayVisitedNodeIdsRef.current = restoredVisited;
      replayFailedNodeIdsRef.current = restoredFailed;
      processedSocketLogIdsRef.current = new Set();
      completedEventAppliedRef.current = false;
      setGraphReplayRequestId((prev) => prev + 1);
    } catch {
      // Keep current in-memory state if grooming snapshot restore fails.
    }
  }, [processData, projectId]);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    const snapshot = {
      currentNodeIds,
      visitedNodeIds,
      failedNodeIds,
      nodeStatusById,
      nodeSocketMessagesById,
      savedAt: Date.now(),
    };

    const hasNodeSocketHistory = Object.values(nodeSocketMessagesById).some((entries) => Array.isArray(entries) && entries.length > 0);
    const hasNodeStatus = Object.keys(nodeStatusById).length > 0;

    // Only save if we have actual state beyond just START
    if (
      currentNodeIds.length === 1 &&
      currentNodeIds[0] === "START" &&
      visitedNodeIds.length === 1 &&
      visitedNodeIds[0] === "START" &&
      failedNodeIds.length === 0 &&
      !hasNodeSocketHistory &&
      !hasNodeStatus
    ) {
      return;
    }

    let isDisposed = false;
    const requestId = groomingSyncRequestIdRef.current + 1;
    groomingSyncRequestIdRef.current = requestId;

    const syncGroomingSnapshot = async () => {
      try {
        await saveGroomingData(projectId, snapshot);
        if (isDisposed || groomingSyncRequestIdRef.current !== requestId) {
          return;
        }
      } catch {
        // Ignore grooming sync failures silently.
      }
    };

    syncGroomingSnapshot();

    return () => {
      isDisposed = true;
    };
  }, [currentNodeIds, failedNodeIds, nodeSocketMessagesById, nodeStatusById, projectId, visitedNodeIds]);

  useEffect(() => {
    currentNodeIdsRef.current = currentNodeIds;
  }, [currentNodeIds]);

  useEffect(() => {
    replayCurrentNodeIdsRef.current = currentNodeIds;
    replayVisitedNodeIdsRef.current = visitedNodeIds;
    replayFailedNodeIdsRef.current = failedNodeIds;
  }, [currentNodeIds, failedNodeIds, visitedNodeIds]);

  useEffect(() => {
    nodeStatusByIdRef.current = nodeStatusById;
    nodeSocketMessagesByIdRef.current = nodeSocketMessagesById;
  }, [nodeSocketMessagesById, nodeStatusById]);

  useEffect(() => {
    if (logs.length === 0 && lastEventType !== "completed") {
      return;
    }

    const nextVisitedNodeIds = [];
    const nextFailedNodeIds = [];
    const nextStatusById = {};
    const nextSocketMessagesById = {};
    let bestMappedNodeIds = null;
    let bestMappedStageIndex = -1;

    for (const logEntry of logs) {
      const nextType = (logEntry?.type || "message").toString().toLowerCase();
      const nextEventType = (logEntry?.eventType || nextType).toString().trim().toLowerCase();
      const nextSocketStatus = (logEntry?.status || "").toString().trim().toLowerCase();
      const nextCurrentNode = (logEntry?.currentNode || logEntry?.current_node || "").toString().trim().toLowerCase();
      const nextMessage = (logEntry?.message || "").toString().trim();
      const nextAt = typeof logEntry?.at === "string" ? logEntry.at : "";
      const rawLogId =
        typeof logEntry?.id === "string" && logEntry.id.trim()
          ? logEntry.id.trim()
          : `${nextType}-${nextEventType}-${nextCurrentNode}-${nextAt}-${nextMessage}`;

      if (processedSocketLogIdsRef.current.has(rawLogId)) {
        continue;
      }
      processedSocketLogIdsRef.current.add(rawLogId);

      const mappedByNode = mapSocketNodeToGraphNodes(nextCurrentNode, nextMessage, nextEventType);
      const mappedByMessage = mapLogToActiveNodes(nextMessage, nextEventType || nextType);
      const mappedNodeIds = mappedByNode && mappedByNode.length > 0 ? mappedByNode : mappedByMessage;
      const normalizedMessage = nextMessage.toLowerCase();
      const isFailureEvent =
        nextType.includes("error") ||
        nextType.includes("failed") ||
        nextEventType.includes("error") ||
        nextEventType.includes("failed") ||
        nextSocketStatus.includes("error") ||
        nextSocketStatus.includes("failed");
      const isTransportError = normalizedMessage.includes("websocket") || normalizedMessage.includes("socket");
      const isCompletionLike =
        nextType.includes("completed") ||
        nextType.includes("success") ||
        nextEventType.includes("completed") ||
        nextEventType.includes("success") ||
        nextSocketStatus.includes("completed") ||
        nextSocketStatus.includes("success") ||
        nextSocketStatus.includes("done");
      const mappedNodeStatus = mapSocketStatusToNodeStatus(nextSocketStatus, nextEventType, nextType);

      let targetNodeIds = [];
      let visitedProgressNodeIds = [];
      if (mappedNodeIds && mappedNodeIds.length > 0) {
        const nextMappedStageIndex = getHighestPrimaryStageIndex(mappedNodeIds);
        const shouldReplaceBestMapped =
          !bestMappedNodeIds ||
          nextMappedStageIndex > bestMappedStageIndex ||
          (nextMappedStageIndex === bestMappedStageIndex && mappedNodeIds.length > bestMappedNodeIds.length);

        if (shouldReplaceBestMapped) {
          bestMappedNodeIds = mappedNodeIds;
          bestMappedStageIndex = nextMappedStageIndex;
        }

        targetNodeIds = mappedNodeIds;

        const hasOnlyStartVisited = replayVisitedNodeIdsRef.current.length === 1 && replayVisitedNodeIdsRef.current[0] === "START";
        const shouldBootstrapProgress = hasOnlyStartVisited && nextVisitedNodeIds.length === 0;
        visitedProgressNodeIds = shouldBootstrapProgress ? buildBootstrapProgressNodes(mappedNodeIds) : mappedNodeIds;
      } else if (isFailureEvent && !isTransportError && currentNodeIdsRef.current.length > 0) {
        targetNodeIds = currentNodeIdsRef.current;
        visitedProgressNodeIds = currentNodeIdsRef.current;
      }

      if (targetNodeIds.length === 0) {
        continue;
      }

      nextVisitedNodeIds.push(...visitedProgressNodeIds);

      for (const nodeId of targetNodeIds) {
        let inferredStatus = mappedNodeStatus;
        if (inferredStatus === "idle") {
          inferredStatus = isFailureEvent && !isTransportError ? "failed" : isCompletionLike ? "success" : "processing";
        } else if (isTransportError && inferredStatus === "failed") {
          inferredStatus = "processing";
        }

        nextStatusById[nodeId] = chooseNodeStatus(nextStatusById[nodeId], inferredStatus);

        if (!nextMessage) {
          continue;
        }

        if (!nextSocketMessagesById[nodeId]) {
          nextSocketMessagesById[nodeId] = [];
        }

        nextSocketMessagesById[nodeId].push({
          id: `${rawLogId}-${nodeId}`,
          type: nextType || "message",
          eventType: nextEventType || nextType || "message",
          currentNode: nextCurrentNode || "",
          status: nextSocketStatus || "",
          message: nextMessage,
          at: nextAt,
        });
      }

      if (isFailureEvent && !isTransportError) {
        nextFailedNodeIds.push(...targetNodeIds);
      }
    }

    if (bestMappedNodeIds && bestMappedNodeIds.length > 0) {
      const previousCurrentNodeIds = currentNodeIdsRef.current;
      setCurrentNodeIds((prev) => (areStringArraysEqual(prev, bestMappedNodeIds) ? prev : bestMappedNodeIds));
      setSelectedNodeId((prev) => prev || bestMappedNodeIds[0] || "");
      setNodeStatusById((prev) => {
        const merged = { ...prev };
        for (const nodeId of previousCurrentNodeIds) {
          if (bestMappedNodeIds.includes(nodeId)) {
            continue;
          }

          if (normalizeNodeStatus(merged[nodeId]) === "failed") {
            continue;
          }

          merged[nodeId] = "success";
        }
        return merged;
      });
    }

    if (nextVisitedNodeIds.length > 0) {
      setVisitedNodeIds((prev) => mergeUniqueNodes(prev, nextVisitedNodeIds));
    }

    if (nextFailedNodeIds.length > 0) {
      setFailedNodeIds((prev) => mergeUniqueNodes(prev, nextFailedNodeIds));
    }

    if (Object.keys(nextStatusById).length > 0) {
      setNodeStatusById((prev) => {
        const merged = { ...prev };
        for (const [nodeId, nextStatus] of Object.entries(nextStatusById)) {
          merged[nodeId] = chooseNodeStatus(merged[nodeId], nextStatus);
        }
        return merged;
      });
    }

    if (Object.keys(nextSocketMessagesById).length > 0) {
      setNodeSocketMessagesById((prev) => mergeNodeSocketMessages(prev, nextSocketMessagesById));
    }

    if (lastEventType === "completed") {
      setCurrentNodeIds((prev) => (areStringArraysEqual(prev, ["END"]) ? prev : ["END"]));
      setVisitedNodeIds((prev) => mergeUniqueNodes(prev, ["END"]));
      setNodeStatusById((prev) => ({
        ...prev,
        END: chooseNodeStatus(prev.END, "success"),
      }));

      if (!completedEventAppliedRef.current) {
        completedEventAppliedRef.current = true;
        setNodeSocketMessagesById((prev) =>
          mergeNodeSocketMessages(prev, {
            END: [
              {
                id: `completed-${projectId}`,
                type: "completed",
                eventType: "completed",
                currentNode: "end",
                status: "completed",
                message: "Pipeline completed successfully.",
                at: new Date().toLocaleTimeString(),
              },
            ],
          })
        );
      }
      return;
    }

    completedEventAppliedRef.current = false;
  }, [lastEventType, logs, projectId, status]);

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
  const displayCurrentSet = useMemo(() => new Set(displayCurrentNodeIds), [displayCurrentNodeIds]);
  const displayVisitedSet = useMemo(() => new Set(displayVisitedNodeIds), [displayVisitedNodeIds]);
  const displayFailedSet = useMemo(() => new Set(displayFailedNodeIds), [displayFailedNodeIds]);
  const nodeActivityById = useMemo(() => {
    const activity = {};

    for (const [nodeId, entries] of Object.entries(nodeSocketMessagesById || {})) {
      if (!Array.isArray(entries) || entries.length === 0) {
        continue;
      }

      const latestEntry = entries[entries.length - 1];
      activity[nodeId] = {
        message: truncateActivityText(latestEntry?.message || ""),
        type: (latestEntry?.type || "").toLowerCase(),
        at: latestEntry?.at || "",
      };
    }

    if (lastEventType === "completed") {
      activity.END = activity.END || {
        message: "Pipeline completed successfully.",
        type: "completed",
        at: new Date().toLocaleTimeString(),
      };
    }

    return activity;
  }, [lastEventType, nodeSocketMessagesById]);

  const flowNodes = useMemo(
    () =>
      PIPELINE_NODES.map((node) => {
        const stepIndex = PRIMARY_STAGE_SEQUENCE.indexOf(node.id);
        const nodeActivity = nodeActivityById[node.id] || null;
        const fallbackLiveText = currentSet.has(node.id) ? `Working: ${node.data.subtitle}` : "";
        const trackedStatus = normalizeNodeStatus(nodeStatusById[node.id]);
        const nodeState =
          displayFailedSet.has(node.id) || (trackedStatus === "failed" && !isGraphReplayRunning)
            ? "failed"
            : displayCurrentSet.has(node.id) || (trackedStatus === "processing" && !isGraphReplayRunning)
            ? "active"
            : displayVisitedSet.has(node.id) || (trackedStatus === "success" && !isGraphReplayRunning)
            ? "visited"
            : "idle";

        return {
          ...node,
          data: {
            ...node.data,
            nodeId: node.id,
            stepIndex,
            isPrimaryStage: PRIMARY_STAGE_SET.has(node.id),
            isSelected: selectedNodeId === node.id,
            activityMessage: nodeActivity?.message || fallbackLiveText,
            nodeState,
          },
        };
      }),
    [currentSet, displayCurrentSet, displayFailedSet, displayVisitedSet, isGraphReplayRunning, nodeActivityById, nodeStatusById, selectedNodeId]
  );

  const flowEdges = useMemo(
    () =>
      PIPELINE_EDGES.map((edge) => {
        const sourceActive = displayCurrentSet.has(edge.source);
        const targetActive = displayCurrentSet.has(edge.target);
        const sourceVisited = displayVisitedSet.has(edge.source);
        const targetVisited = displayVisitedSet.has(edge.target);
        const failedEdge = displayFailedSet.has(edge.source) || displayFailedSet.has(edge.target);

        const edgeState = failedEdge
          ? "failed"
          : sourceActive || targetActive
          ? "active"
          : sourceVisited && targetVisited
          ? "visited"
          : "idle";

        return {
          ...edge,
          data: {
            ...(edge.data || {}),
            edgeState,
          },
        };
      }),
    [displayCurrentSet, displayFailedSet, displayVisitedSet]
  );

  const processStatus = (processData?.status || "").toString().trim().toLowerCase();
  const socketStatus = (status || "").toString().trim().toLowerCase();
  const eventStatus = (lastEventType || "").toString().trim().toLowerCase();
  const referenceUrls = Array.isArray(processData?.reference_urls) ? processData.reference_urls : [];
  const questionUrls = filterDisplayableDocumentUrls(Array.isArray(processData?.question_urls) ? processData.question_urls : []);
  const resultUrls = filterDisplayableDocumentUrls(Array.isArray(processData?.result_urls) ? processData.result_urls : []).filter((url) =>
    isLikelyFinalAnswerUrl(url)
  );
  const resolvedFinalAnswerUrl = pickPreferredFinalAnswerUrl([processData?.final_answer_url, finalAnswerUrl, ...resultUrls]);
  const isFailedState =
    [socketStatus, processStatus, eventStatus].some((value) => value.includes("failed") || value.includes("error"));
  const hasRealtimeLogs = logs.length > 0;
  const processStatusLooksCompleted =
    processStatus.includes("complete") || processStatus.includes("completed") || processStatus.includes("done") || processStatus.includes("success");
  const eventStatusLooksCompleted =
    eventStatus.includes("complete") || eventStatus.includes("completed") || eventStatus.includes("done") || eventStatus.includes("success");
  const isCompletedState =
    Boolean(resolvedFinalAnswerUrl) ||
    eventStatusLooksCompleted ||
    (!hasRealtimeLogs && processStatusLooksCompleted);
  const headerStatus = isFailedState ? "failed" : isCompletedState ? "completed" : projectId ? "processing" : "idle";
  const sidebarResultUrls = Array.from(
    new Set(
      [resolvedFinalAnswerUrl, ...resultUrls].filter((item) => typeof item === "string" && item.trim())
    )
  );
  const sidebarActiveFile = activeView === "document" ? activeDocumentUrl : "";
  const agentStatusLabel = toTitleCase(headerStatus);
  const documentIsMarkdown = isMarkdownUrl(sourceDocumentUrl);
  const isProcessRunning = headerStatus === "processing";
  const isAnimationPanelSync = activeView === "graph" && (isProcessRunning || isGraphReplayRunning);

  const animatedReachedNodeIds = useMemo(
    () => new Set([...displayVisitedNodeIds, ...displayCurrentNodeIds, ...displayFailedNodeIds]),
    [displayCurrentNodeIds, displayFailedNodeIds, displayVisitedNodeIds]
  );

  const clickSelectableNodeIds = useMemo(() => {
    const nodeIds = new Set([...visitedNodeIds, ...currentNodeIds, ...failedNodeIds]);

    for (const [nodeId, entries] of Object.entries(nodeSocketMessagesById || {})) {
      if (Array.isArray(entries) && entries.length > 0) {
        nodeIds.add(nodeId);
      }
    }

    for (const [nodeId, nodeStatus] of Object.entries(nodeStatusById || {})) {
      if (normalizeNodeStatus(nodeStatus) !== "idle") {
        nodeIds.add(nodeId);
      }
    }

    return nodeIds;
  }, [currentNodeIds, failedNodeIds, nodeSocketMessagesById, nodeStatusById, visitedNodeIds]);

  const panelVisibleNodeIds = useMemo(
    () => (isAnimationPanelSync ? animatedReachedNodeIds : clickSelectableNodeIds),
    [animatedReachedNodeIds, clickSelectableNodeIds, isAnimationPanelSync]
  );

  useEffect(() => {
    if (activeView !== "graph") {
      return;
    }

    const liveFocusedNodeId = currentNodeIds[currentNodeIds.length - 1] || "";

    if (isAnimationPanelSync) {
      const nextFocusedNodeId = displayCurrentNodeIds[displayCurrentNodeIds.length - 1] || "";
      if (!nextFocusedNodeId) {
        return;
      }

      setSelectedNodeId((prev) => (prev === nextFocusedNodeId ? prev : nextFocusedNodeId));
      return;
    }

    setSelectedNodeId((prev) => {
      if (headerStatus === "processing" && liveFocusedNodeId) {
        return prev === liveFocusedNodeId ? prev : liveFocusedNodeId;
      }

      if (prev && panelVisibleNodeIds.has(prev)) {
        return prev;
      }
      return "";
    });
  }, [activeView, currentNodeIds, displayCurrentNodeIds, headerStatus, isAnimationPanelSync, panelVisibleNodeIds]);

  const selectedNodeDetails = useMemo(() => {
    if (!selectedNodeId || !panelVisibleNodeIds.has(selectedNodeId)) {
      return null;
    }
    return PIPELINE_NODES.find((node) => node.id === selectedNodeId) || null;
  }, [panelVisibleNodeIds, selectedNodeId]);

  const selectedDetailsNodeId = selectedNodeDetails?.id || "";

  const selectedNodeSocketMessages = useMemo(() => {
    if (!selectedDetailsNodeId) {
      return [];
    }

    if (isAnimationPanelSync && !animatedReachedNodeIds.has(selectedDetailsNodeId)) {
      return [];
    }

    const entries = Array.isArray(nodeSocketMessagesById[selectedDetailsNodeId]) ? nodeSocketMessagesById[selectedDetailsNodeId] : [];
    return [...entries].reverse();
  }, [animatedReachedNodeIds, isAnimationPanelSync, nodeSocketMessagesById, selectedDetailsNodeId]);

  const selectedNodeStatus = useMemo(() => {
    if (!selectedDetailsNodeId) {
      return "idle";
    }

    const failedPool = isAnimationPanelSync ? displayFailedSet : failedSet;
    const currentPool = isAnimationPanelSync ? displayCurrentSet : currentSet;
    const visitedPool = isAnimationPanelSync ? displayVisitedSet : visitedSet;

    if (failedPool.has(selectedDetailsNodeId) || nodeStatusById[selectedDetailsNodeId] === "failed") {
      return "failed";
    }
    if (currentPool.has(selectedDetailsNodeId) || nodeStatusById[selectedDetailsNodeId] === "processing") {
      return "processing";
    }
    if (visitedPool.has(selectedDetailsNodeId) || nodeStatusById[selectedDetailsNodeId] === "success") {
      return "success";
    }
    return "idle";
  }, [currentSet, displayCurrentSet, displayFailedSet, displayVisitedSet, failedSet, isAnimationPanelSync, nodeStatusById, selectedDetailsNodeId, visitedSet]);

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
              activeFile={sidebarActiveFile}
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
                        onClick={() => {
                          if (activeView === "graph") {
                            setGraphReplayRequestId((prev) => prev + 1);
                            return;
                          }
                          setActiveView("graph");
                        }}
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
                  <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-black/30 p-3">
                    <div className={`grid h-full min-h-0 gap-3 ${selectedNodeDetails ? "xl:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
                      <div className="relative h-full min-h-[360px] overflow-hidden rounded-xl border border-white/10 bg-[#0b0f18]">
                        <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-md border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-[10px] uppercase tracking-wider text-violet-100/90">
                          Follow main flow: step badges 01 → 12
                        </div>
                        <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-md border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-[10px] uppercase tracking-wider text-violet-100/90">
                          {isAnimationPanelSync ? "Auto-following grooming + node socket details" : "Click node to inspect socket history"}
                        </div>

                        <ReactFlow
                          nodes={flowNodes}
                          edges={flowEdges}
                          fitView
                          fitViewOptions={{ padding: 0.06, minZoom: 0.44, maxZoom: 1.9 }}
                          nodesDraggable={false}
                          nodesConnectable={false}
                          elementsSelectable={false}
                          panOnDrag
                          zoomOnScroll
                          minZoom={0.38}
                          maxZoom={1.9}
                          nodeTypes={nodeTypes}
                          edgeTypes={edgeTypes}
                          onNodeClick={(_event, node) => {
                            if (isAnimationPanelSync || !panelVisibleNodeIds.has(node.id)) {
                              return;
                            }
                            setSelectedNodeId(node.id);
                          }}
                          onPaneClick={() => {
                            if (isAnimationPanelSync) {
                              return;
                            }
                            setSelectedNodeId("");
                          }}
                        >
                          <Background color="rgba(167,139,250,0.2)" gap={22} />
                          <Controls />
                        </ReactFlow>
                      </div>

                      {selectedNodeDetails && (
                        <aside className="flex min-h-0 flex-col rounded-xl border border-violet-300/25 bg-gradient-to-b from-violet-500/10 via-[#0c111a] to-[#090c12] p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-200/80">Node Details</p>
                              <p className="mt-1 text-sm font-semibold text-white">{selectedNodeDetails.data.label}</p>
                              <p className="mt-0.5 text-[11px] uppercase tracking-wider text-slate-300/75">{selectedNodeDetails.id}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (!isAnimationPanelSync) {
                                  setSelectedNodeId("");
                                }
                              }}
                              disabled={isAnimationPanelSync}
                              className="rounded-md border border-white/15 px-2 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-violet-300/45 hover:text-violet-100 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              Close
                            </button>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                            <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-slate-300">
                              <p className="uppercase tracking-wider text-slate-400">Status</p>
                              <p className={`mt-0.5 font-semibold ${selectedNodeStatus === "failed" ? "text-red-200" : "text-violet-200"}`}>
                                {toTitleCase(selectedNodeStatus)}
                              </p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-slate-300">
                              <p className="uppercase tracking-wider text-slate-400">Messages</p>
                              <p className="mt-0.5 font-semibold text-violet-200">{selectedNodeSocketMessages.length}</p>
                            </div>
                          </div>

                          <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                            {selectedNodeSocketMessages.length > 0 ? (
                              <div className="space-y-2">
                                {selectedNodeSocketMessages.map((entry) => {
                                  const nextType = (entry?.type || "message").toLowerCase();
                                  const toneClass = nextType.includes("error")
                                    ? "border-red-400/35 bg-red-500/10 text-red-100"
                                    : nextType.includes("completed")
                                    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                                    : "border-violet-300/25 bg-violet-500/10 text-violet-100";

                                  return (
                                    <article key={entry.id} className={`rounded-lg border px-3 py-2 text-xs ${toneClass}`}>
                                      <div className="mb-1 flex items-center justify-between gap-2">
                                        <span className="font-semibold uppercase tracking-wide">{toTitleCase(entry.type || "message")}</span>
                                        <span className="text-[10px] text-slate-300/80">{entry.at || ""}</span>
                                      </div>
                                      <p className="leading-relaxed">{entry.message}</p>
                                    </article>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="flex h-full min-h-[120px] items-center justify-center rounded-lg border border-dashed border-white/10 text-center text-xs text-slate-400">
                                No socket logs mapped to this node yet.
                              </div>
                            )}
                          </div>
                        </aside>
                      )}
                    </div>
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

        .node-visited-glow {
          box-shadow: 0 0 12px rgba(167, 139, 250, 0.22);
        }

        .node-avatar {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 3.1rem;
          width: 3.1rem;
          border-radius: 9999px;
          border: 1px solid rgba(203, 213, 225, 0.35);
          background: radial-gradient(circle at 30% 30%, rgba(148, 163, 184, 0.28), rgba(30, 41, 59, 0.5));
          color: #e2e8f0;
          overflow: hidden;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
        }

        .node-avatar-idle {
          border-color: rgba(203, 213, 225, 0.35);
        }

        .node-avatar-active {
          border-color: rgba(167, 139, 250, 0.72);
          background: radial-gradient(circle at 30% 30%, rgba(192, 132, 252, 0.55), rgba(76, 29, 149, 0.28));
          color: #ede9fe;
          box-shadow: 0 0 18px rgba(139, 92, 246, 0.3);
          animation: avatarPulse 1.4s ease-in-out infinite;
        }

        .node-avatar-visited {
          border-color: rgba(196, 181, 253, 0.62);
          background: radial-gradient(circle at 30% 30%, rgba(167, 139, 250, 0.42), rgba(67, 56, 202, 0.2));
          color: #ddd6fe;
          box-shadow: 0 0 12px rgba(139, 92, 246, 0.2);
        }

        .node-avatar-failed {
          border-color: rgba(248, 113, 113, 0.72);
          background: radial-gradient(circle at 30% 30%, rgba(248, 113, 113, 0.55), rgba(127, 29, 29, 0.28));
          color: #fee2e2;
          box-shadow: 0 0 18px rgba(248, 113, 113, 0.28);
          animation: avatarError 0.75s ease-in-out infinite;
        }

        .node-avatar-ring {
          position: absolute;
          inset: 2px;
          border-radius: 9999px;
          border: 1px solid rgba(241, 245, 249, 0.25);
        }

        .node-avatar-icon {
          position: relative;
          z-index: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 2.35rem;
          width: 2.35rem;
          animation: floatAgent 2.1s ease-in-out infinite;
        }

        .node-avatar-icon :global(.node-visual-svg) {
          display: block;
          height: 100% !important;
          width: 100% !important;
        }

        .node-ai-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 2.05rem;
          height: 1.25rem;
          padding: 0 0.5rem;
          border-radius: 9999px;
          border: 1px solid rgba(196, 181, 253, 0.55);
          background: rgba(91, 33, 182, 0.35);
          color: #e9d5ff;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.08em;
        }

        .node-step-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 2.35rem;
          height: 1.55rem;
          padding: 0 0.55rem;
          border-radius: 9999px;
          border: 1px solid rgba(196, 181, 253, 0.45);
          background: rgba(76, 29, 149, 0.45);
          color: #ede9fe;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
        }

        .edge-packet {
          fill: rgba(139, 92, 246, 0.9);
          filter: drop-shadow(0 0 6px rgba(139, 92, 246, 0.85));
        }

        .edge-packet-secondary {
          fill: rgba(216, 180, 254, 0.75);
          filter: drop-shadow(0 0 7px rgba(216, 180, 254, 0.9));
        }

        .edge-packet-visited {
          fill: rgba(196, 181, 253, 0.95);
          filter: drop-shadow(0 0 5px rgba(167, 139, 250, 0.65));
        }

        .edge-packet-failed {
          fill: rgba(248, 113, 113, 0.9);
          filter: drop-shadow(0 0 8px rgba(248, 113, 113, 0.8));
        }

        .node-processing-bars {
          display: inline-flex;
          gap: 3px;
          margin-top: 0.45rem;
          margin-left: 2px;
        }

        .node-processing-bars span {
          width: 4px;
          height: 8px;
          border-radius: 9999px;
          background: linear-gradient(180deg, rgba(233, 213, 255, 1), rgba(167, 139, 250, 1));
          animation: barBeat 1.1s ease-in-out infinite;
        }

        .node-processing-bars span:nth-child(2) {
          animation-delay: 0.18s;
        }

        .node-processing-bars span:nth-child(3) {
          animation-delay: 0.36s;
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

        @keyframes floatAgent {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-2px);
          }
        }

        @keyframes barBeat {
          0%,
          100% {
            transform: scaleY(0.65);
            opacity: 0.75;
          }
          50% {
            transform: scaleY(1.25);
            opacity: 1;
          }
        }

        @keyframes avatarPulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.85;
          }
          50% {
            transform: scale(1.08);
            opacity: 1;
          }
        }

        @keyframes avatarError {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-1px);
          }
          75% {
            transform: translateX(1px);
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
