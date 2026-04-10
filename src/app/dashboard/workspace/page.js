"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReactFlow, { Background, Controls, Handle, MarkerType, Position } from "reactflow";
import "reactflow/dist/style.css";
import { fetchDocuProcessData } from "@/lib/api/docuApi";
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
    if (!Array.isArray(value)) {
      continue;
    }

    const normalized = value.filter((item) => typeof item === "string" && item.trim());
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

  const resultUrls = findUrlListByKeys(objects, ["result_urls", "resultUrls", "results", "output_urls"]);
  const referenceUrls = findUrlListByKeys(objects, ["reference_urls", "referenceUrls", "references"]);
  const questionUrls = findUrlListByKeys(objects, ["question_urls", "questionUrls", "questions"]);

  return {
    ...root,
    title,
    description,
    status: processStatus,
    final_answer_url: finalAnswerUrl,
    result_urls: resultUrls,
    reference_urls: referenceUrls,
    question_urls: questionUrls,
  };
}

function PipelineNode({ data }) {
  const active = Boolean(data?.active);

  return (
    <div
      className={`w-[220px] rounded-2xl border px-4 py-3 backdrop-blur-xl transition-all duration-300 ${
        active
          ? "border-violet-400/80 bg-violet-500/15 ring-1 ring-violet-300/70 shadow-[0_0_34px_rgba(139,92,246,0.45)] node-active-glow"
          : "border-white/15 bg-white/[0.04]"
      }`}
    >
      <p className="text-sm font-semibold text-white">{data.label}</p>
      <p className="mt-1 text-[11px] uppercase tracking-widest text-slate-400">{data.subtitle}</p>
      {active && (
        <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-200">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-300 animate-pulse" />
          Active
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
  const [activeNodeIds, setActiveNodeIds] = useState(["START"]);
  const [processData, setProcessData] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeDocumentUrl, setActiveDocumentUrl] = useState("");

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
    setActiveNodeIds(["START"]);
  }, [projectId]);

  useEffect(() => {
    if (logs.length === 0 && lastEventType !== "completed") {
      return;
    }

    if (lastEventType === "completed") {
      setActiveNodeIds(["END"]);
      return;
    }

    const latestLog = logs[logs.length - 1];
    const mappedNodeIds = mapLogToActiveNodes(latestLog?.message || "", latestLog?.type || lastEventType);

    if (mappedNodeIds && mappedNodeIds.length > 0) {
      setActiveNodeIds(mappedNodeIds);
    }
  }, [lastEventType, logs]);

  const memoNodeTypes = useMemo(() => nodeTypes, []);
  const activeSet = useMemo(() => new Set(activeNodeIds), [activeNodeIds]);

  const flowNodes = useMemo(
    () =>
      PIPELINE_NODES.map((node) => ({
        ...node,
        data: {
          ...node.data,
          active: activeSet.has(node.id),
        },
      })),
    [activeSet]
  );

  const processStatus = (processData?.status || "idle").toString().trim().toLowerCase();
  const headerStatus = processStatus || "idle";
  const referenceUrls = Array.isArray(processData?.reference_urls) ? processData.reference_urls : [];
  const questionUrls = Array.isArray(processData?.question_urls) ? processData.question_urls : [];
  const resultUrls = Array.isArray(processData?.result_urls) ? processData.result_urls : [];
  const resolvedFinalAnswerUrl = finalAnswerUrl || processData?.final_answer_url || "";
  const agentStatusLabel = toTitleCase(headerStatus);
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
              resultUrls={resultUrls}
              finalAnswerUrl={resolvedFinalAnswerUrl}
              activeFile={activeDocumentUrl}
              onFileSelect={(url) => {
                setActiveDocumentUrl(url);
                setActiveView("document");
              }}
            />

            <section className="min-w-0 flex-1 p-3 md:p-4">
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

              <div className="flex h-[calc(100%-108px)] min-h-[420px] flex-col gap-3">
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
                  <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                    <div className="h-full">
                      {activeDocumentUrl ? (
                        <iframe src={activeDocumentUrl} className="h-full w-full border-0 bg-white" title="Generated Document" />
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

        @keyframes pulseGlow {
          0%,
          100% {
            box-shadow: 0 0 14px rgba(139, 92, 246, 0.35), 0 0 30px rgba(139, 92, 246, 0.15);
          }
          50% {
            box-shadow: 0 0 24px rgba(139, 92, 246, 0.75), 0 0 48px rgba(139, 92, 246, 0.35);
          }
        }
      `}</style>
    </main>
  );
}
