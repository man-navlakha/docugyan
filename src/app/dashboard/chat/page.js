"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchDocuProcessList, LOCAL_STORAGE_KEYS, deleteDocuProcess, fetchChatSessionList, fetchChatSessionDetails, buildChatWebSocketUrl, fetchWsToken, fetchUserProfile, deleteChatSession, fetchDocuProcessData } from "@/lib/api/docuApi";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function CodeBlock({ inline, className, children, ...props }) {
  const match = /language-(\w+)/.exec(className || '');
  const codeString = String(children).replace(/\n$/, '');
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(codeString);
  };

  if (!inline && match) {
    return (
      <div className="relative group rounded-xl bg-[#1e1e28] my-5 overflow-hidden border border-white/10 shadow-lg">
        <div className="flex items-center justify-between px-4 py-2 bg-[#16161e] border-b border-white/5">
          <span className="text-xs font-mono font-medium tracking-wide text-violet-300">{match[1]}</span>
          <button 
            onClick={copyToClipboard}
            className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
            title="Copy Code"
          >
            <span className="text-[10px] uppercase font-bold tracking-wider hidden group-hover:block">Copy</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 8h2a2 2 0 012 2v8a2 2 0 01-2 2H10a2 2 0 01-2-2v-2" />
            </svg>
          </button>
        </div>
        <div className="p-4 overflow-x-auto text-[13px] leading-relaxed text-slate-300 font-mono">
          <code className={className} {...props}>
            {children}
          </code>
        </div>
      </div>
    );
  }
  return (
    <code className="bg-white/10 rounded px-1.5 py-0.5 text-violet-200 text-[13px] font-mono" {...props}>
      {children}
    </code>
  );
}

function cleanDocumentName(url) {
  if (!url) return "Unknown Document";
  let name = url.split('/').pop();
  if (!name) return "Unknown Document";
  
  try {
    name = decodeURIComponent(name);
  } catch(e) {}
  
  // Remove leading timestamp (13+ digits followed by dash)
  name = name.replace(/^\d{13,}-/, '');
  
  // Remove trailing Vercel blob hash (usually starts with -- or - followed by ~20+ random chars) before extension
  name = name.replace(/--[a-zA-Z0-9_-]{20,}(\.[a-zA-Z0-9]+)$/, '$1');
  name = name.replace(/-[a-zA-Z0-9_-]{20,}(\.[a-zA-Z0-9]+)$/, '$1');
  
  return name;
}

function getViewableUrl(url) {
  if (!url) return "";
  const clean = normalizeUrl(url);
  if (clean.includes('.blob.vercel-storage.com')) {
    if (clean.includes('token=')) return clean;
    return `/api/uploads/blob?url=${encodeURIComponent(clean)}`;
  }
  return clean;
}

function normalizeUrl(value) {
  if (typeof value !== 'string') return '';
  let trimmed = value.trim();
  if (!trimmed) return '';
  const listMatch = trimmed.match(/^\[\s*['"](.+?)['"]\s*\]$/);
  if (listMatch) trimmed = listMatch[1];
  return trimmed.replace(/^['"\[]+|['"\]]+$/g, '');
}

function parseDocumentChunks(markdown) {
  if (typeof markdown !== "string" || !markdown.trim()) {
    return [{ type: "markdown", content: "" }];
  }

  const refMarkerRegex = /(?:\n|^)###\s+(?:\*\*)*Refer[ea]nces?(?:\*\*)*\s*(?:\n|$)/i;
  const chunks = [];
  let currentMarkdown = markdown;

  while (true) {
    const match = currentMarkdown.match(refMarkerRegex);
    if (!match) {
      if (currentMarkdown.trim()) {
        chunks.push({ type: "markdown", content: currentMarkdown });
      }
      break;
    }

    const startIndex = match.index;
    let beforeContent = currentMarkdown.slice(0, startIndex);
    beforeContent = beforeContent.replace(/(?:\r?\n)*---(?:\r?\n)*$/, "").trimEnd();

    if (beforeContent) {
      chunks.push({ type: "markdown", content: beforeContent });
    }

    let blockAfter = currentMarkdown.slice(startIndex + match[0].length);
    let afterContent = "";

    const nextSectionMatch = blockAfter.match(/\n(?:##+ |---)/);
    if (nextSectionMatch) {
      afterContent = blockAfter.slice(nextSectionMatch.index);
      blockAfter = blockAfter.slice(0, nextSectionMatch.index);
    }

    const references = blockAfter
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.match(/^(?:-|\*|\d+\.) /))
      .map((line, index) => {
        let url = line.replace(/^(?:-|\*|\d+\.) /, "").trim();
        const mdLinkMatch = url.match(/\[(.*?)\]\((.*?)\)/);
        if (mdLinkMatch) {
          url = mdLinkMatch[2];
        }
        return { id: String(index + 1), title: url, url };
      })
      .filter((ref) => ref.url);

    if (references.length > 0) {
      chunks.push({ type: "references", references });
    } else {
      chunks.push({ type: "markdown", content: match[0] + blockAfter });
    }

    currentMarkdown = afterContent;
  }

  return chunks;
}

function processDocumentContent(rawContent) {
  if (typeof rawContent !== 'string') return '';
  let text = rawContent;

  // Convert question headings (### Title) to h6 for purple accent styling
  // But skip known section headers like References / Unanswered Questions
  text = text.replace(/(^|\n(?:---|\*\*\*|___)\n\n)### (?!References|Unanswered Questions)(.*?)(?=\n)/g, '$1###### $2');

  // Remove empty bracket artifacts from backend
  text = text.replace(/\s*(?<![-\*]\s*)\[\s*\]/g, '');

  return text;
}

function tokenizeDocumentDataImages(markdown) {
  if (typeof markdown !== 'string' || !markdown.trim()) {
    return { content: '', imageByToken: {} };
  }

  const imageByToken = {};
  let index = 0;
  let cursor = 0;
  let content = '';

  while (cursor < markdown.length) {
    const imageStart = markdown.indexOf('![', cursor);
    if (imageStart < 0) {
      content += markdown.slice(cursor);
      break;
    }

    content += markdown.slice(cursor, imageStart);

    const altEnd = markdown.indexOf(']', imageStart + 2);
    if (altEnd < 0 || markdown[altEnd + 1] !== '(') {
      content += markdown.slice(imageStart, altEnd < 0 ? undefined : altEnd + 1);
      cursor = altEnd < 0 ? markdown.length : altEnd + 1;
      continue;
    }

    let urlStart = altEnd + 2;
    while (urlStart < markdown.length && /\s/.test(markdown[urlStart])) {
      urlStart += 1;
    }

    const closeParen = markdown.indexOf(')', urlStart);
    if (closeParen < 0) {
      content += markdown.slice(imageStart);
      cursor = markdown.length;
      break;
    }

    const rawUrl = markdown.slice(urlStart, closeParen);

    // Handle data:image URLs by tokenizing them
    if (/^data:image\//i.test(rawUrl.trim())) {
      const token = `mdimg://${index}`;
      const alt = markdown.slice(imageStart + 2, altEnd);
      const firstComma = rawUrl.indexOf(',');
      imageByToken[token] = firstComma >= 0
        ? rawUrl.slice(0, firstComma + 1) + rawUrl.slice(firstComma + 1).replace(/\s+/g, '')
        : rawUrl;
      content += `![${alt}](${token})`;
      index += 1;
      cursor = closeParen + 1;
      continue;
    }

    // For blob URLs, proxy them through our API
    if (rawUrl.includes('.blob.vercel-storage.com')) {
      const alt = markdown.slice(imageStart + 2, altEnd);
      const proxyUrl = getViewableUrl(rawUrl.trim());
      content += `![${alt}](${proxyUrl})`;
      cursor = closeParen + 1;
      continue;
    }

    // Keep other images as-is
    content += markdown.slice(imageStart, closeParen + 1);
    cursor = closeParen + 1;
  }

  return { content, imageByToken };
}

function DocumentInlineReferences({ references }) {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <section className="mt-6 mb-6 border-t border-b border-white/10 py-4">
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between group hover:bg-white/5 rounded-lg p-2 transition-colors focus:outline-none"
      >
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-300">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
          </svg>
          <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-violet-300">References</h4>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-violet-300/70 group-hover:text-violet-200 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2 px-2 pb-2">
          {references.map((ref) => {
            const safeUrl = normalizeUrl(ref.url);
            const isLink = /^https?:\/\//i.test(safeUrl);

            return (
              <div key={ref.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
                <span className="rounded-full border border-violet-400/40 bg-violet-500/15 px-2 py-0.5 font-semibold text-violet-200">ref:{ref.id}</span>
                <span className="text-slate-200 truncate max-w-[200px]" title={ref.title}>{ref.title}</span>
                {isLink ? (
                  <a href={getViewableUrl(safeUrl)} target="_blank" rel="noreferrer noopener" className="text-blue-300 underline decoration-blue-300/60 underline-offset-2 shrink-0">
                    Open source
                  </a>
                ) : (
                  <span className="text-slate-500">URL unavailable</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

const DEFAULT_PAGE_SIZE = 10;

function toStatusLabel(status) {
  if (typeof status !== "string" || !status.trim()) return "Unknown";
  return status.trim().split(/[_\s-]+/).filter(Boolean).map(segment => segment.charAt(0).toUpperCase() + segment.slice(1)).join(" ");
}

function toCount(value) {
  if (Array.isArray(value)) return value.length;
  if (typeof value === "string") return value.trim() ? 1 : 0;
  return 0;
}

function toDisplayTitle(process) {
  if (typeof process?.title === "string" && process.title.trim()) return process.title.trim();
  if (typeof process?.description === "string" && process.description.trim()) return process.description.trim().slice(0, 60);
  return "Untitled Workspace";
}

function toDateTime(value) {
  if (typeof value !== "string" || !value.trim()) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function toStatusColor(status) {
  const normalized = (status || "").toUpperCase();
  if (normalized === "FAILED" || normalized === "DELETED") return "bg-red-500";
  if (normalized === "COMPLETED") return "bg-emerald-500";
  if (normalized === "PROCESSING" || normalized === "PENDING") return "bg-violet-500";
  if (normalized === "DELETING") return "bg-orange-500";
  return "bg-slate-500";
}

function formatSessionDate(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(parsed);
}

function createClientSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  return template.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

function ChatList() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const activeSearch = searchParams?.get("search") || "";

  useEffect(() => { setPage(1); }, [activeSearch]);

  useEffect(() => {
    let isMounted = true;
    const loadHistory = async () => {
      setLoading(true);
      setError("");
      try {
        const payload = await fetchDocuProcessList({ page, pageSize, search: activeSearch });
        if (!isMounted) return;
        const records = Array.isArray(payload?.results) ? payload.results : Array.isArray(payload) ? payload : [];
        setItems(records);
        setCount(typeof payload?.count === "number" ? payload.count : records.length);
      } catch (fetchError) {
        if (!isMounted) return;
        setError(fetchError?.message || "Unable to load chat sessions right now.");
        setItems([]);
        setCount(0);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadHistory();
    return () => { isMounted = false; };
  }, [activeSearch, page, pageSize]);

  const totalPages = useMemo(() => {
    const pages = Math.ceil(count / pageSize);
    return pages > 0 ? pages : 1;
  }, [count, pageSize]);

  const handleStartChat = (process) => {
    const projectId = process?.project_id;
    const status = (process?.status || "").toUpperCase();
    const isCompleted = status === "COMPLETED";

    if (!isCompleted) {
      let message = `Chat unavailable: This process is currently ${toStatusLabel(status)}.`;
      if (status === "FAILED") {
        message += " The document processing failed. Please check DocuAgent for details.";
      } else if (status === "PROCESSING" || status === "PENDING") {
        message += " Please wait until the process is fully completed.";
      } else if (status === "DELETING" || status === "DELETED") {
        message += " This process is being removed.";
      }
      
      alert(message);
      return;
    }

    if (!projectId) return;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCAL_STORAGE_KEYS.projectId, projectId);
    }
    router.push(`/dashboard/chat?project=${encodeURIComponent(projectId)}`);
  };

  const goToPrevious = () => setPage((current) => (current > 1 ? current - 1 : current));
  const goToNext = () => setPage((current) => (current < totalPages ? current + 1 : current));

  const handleDelete = async (projectId) => {
    if (!window.confirm("Are you sure you want to delete this process? This cannot be undone.")) return;
    setDeletingId(projectId);
    try {
      await deleteDocuProcess(projectId);
      setItems((current) => current.filter((p) => p.project_id !== projectId));
      setCount((current) => current - 1);
    } catch (err) {
      alert("Failed to delete process: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-70px)] w-full bg-[#0a0a0c] font-display text-slate-100 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-violet-900/10 via-[#0a0a0c] to-[#0a0a0c]" />
      <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[400px] w-[800px] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none" />

      <main className="relative z-10 w-full max-w-5xl mx-auto pt-12 pb-20 px-6">
        <div className="mb-10 text-center animate-in fade-in slide-in-from-top-4">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/30 text-violet-400 shadow-[0_0_30px_rgba(139,92,246,0.15)]">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-white">Docu Processes</h1>
          <p className="mt-2 text-slate-400 max-w-xl mx-auto">
            Select a processed project from your history to start interacting with your documents.
          </p>

          <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-1.5">
            <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100">
              <span className="text-cyan-200/80">Processes</span>
              <span className="ml-1.5 text-sm font-bold text-white">{count}</span>
            </div>
            <div className="rounded-lg border border-violet-400/25 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-100">
              <span className="text-violet-200/85">Page</span>
              <span className="ml-1.5 text-sm font-bold text-white">{page}/{totalPages > 0 ? totalPages : 1}</span>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mb-8 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200 animate-in fade-in">
            <svg className="h-5 w-5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p>{error}</p>
          </div>
        ) : null}

        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-xl animate-in fade-in">
          {loading ? (
            <div className="flex min-h-[280px] items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-500 border-t-white" />
                Loading processes...
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 px-6 py-12 text-center text-slate-400">
              No processes found yet. Start a new process from DocuAgent.
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((process, index) => {
                const projectId = process?.project_id || "";
                const refCount = toCount(process?.reference_urls);
                const questionCount = toCount(process?.question_urls);
                const resultCount = toCount(process?.result_urls);
                const isDeletingState = process?.status?.toLowerCase().includes("delet");

                return (
                  <article
                    key={projectId || `${process?.created_at || "item"}-${index}`}
                    className={`group flex flex-col gap-5 rounded-2xl border border-white/5 bg-black/40 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/10 hover:bg-white/[0.02] hover:shadow-lg hover:shadow-black/50 animate-in fade-in ${isDeletingState ? "opacity-50 grayscale pointer-events-none" : ""}`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-start lg:items-center gap-4 overflow-hidden min-w-0">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 group-hover:bg-violet-500/20 group-hover:text-violet-300 transition-colors border border-white/5 mt-1 lg:mt-0">
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h2 className="truncate text-base font-semibold text-slate-200 group-hover:text-white transition-colors">{toDisplayTitle(process)}</h2>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <div className="flex items-center gap-1.5 rounded-full bg-black/50 px-2 py-0.5 border border-white/5">
                              <span className={`inline-block h-1.5 w-1.5 rounded-full ${toStatusColor(process.status)}`} />
                              <span>{toStatusLabel(process?.status)}</span>
                            </div>
                            {process?.description && (
                              <span className="hidden sm:inline-block h-1 w-1 rounded-full bg-slate-700"></span>
                            )}
                            {process?.description && (
                              <span className="truncate max-w-[200px] sm:max-w-[300px] text-slate-400">{process.description}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 w-full lg:w-auto shrink-0 items-center">
                        <button
                          type="button"
                          onClick={() => handleStartChat(process)}
                          disabled={!projectId}
                          className={`w-full lg:w-auto cursor-pointer rounded-xl px-8 py-2.5 text-sm font-semibold transition-all flex items-center justify-center gap-2 border shadow-sm ${
                            process?.status?.toUpperCase() === "COMPLETED"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 hover:text-emerald-300 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                              : "bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20 hover:text-slate-300"
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          Start Chat
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(projectId)}
                          disabled={!projectId || deletingId === projectId}
                          title="Delete Process"
                          className="flex items-center justify-center cursor-pointer rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm hover:shadow-red-500/10 h-10 w-10 shrink-0"
                        >
                          {deletingId === projectId ? (
                            <span className="h-4 w-4 block animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                          ) : (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 text-xs sm:grid-cols-3 lg:grid-cols-4">
                      <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-slate-300 transition-colors group-hover:bg-black/30">
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/50" />
                          References
                        </div>
                        <div className="mt-1 text-base font-bold text-slate-100">{refCount}</div>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-slate-300 transition-colors group-hover:bg-black/30">
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/50" />
                          Questions
                        </div>
                        <div className="mt-1 text-base font-bold text-slate-100">{questionCount}</div>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-slate-300 transition-colors group-hover:bg-black/30">
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-violet-400/50" />
                          Results
                        </div>
                        <div className="mt-1 text-base font-bold text-slate-100">{resultCount}</div>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-slate-300 sm:col-span-3 lg:col-span-1 transition-colors group-hover:bg-black/30">
                        <div className="text-slate-500">Created</div>
                        <div className="mt-0.5 font-semibold text-slate-100">{toDateTime(process?.created_at)}</div>
                      </div>
                    </div>
                  </article>
                );
              })}

              <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-300 md:flex-row">
                <p>
                  Page {page} of {totalPages} · {count} total records
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={goToPrevious}
                    disabled={page <= 1}
                    className="rounded-lg border border-white/15 px-3 py-1.5 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={goToNext}
                    disabled={page >= totalPages}
                    className="rounded-lg border border-white/15 px-3 py-1.5 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ChatSession({ projectId }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSessionId = searchParams?.get("session") || "new";

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sessions, setSessions] = useState([]);
  const [userName, setUserName] = useState("");
  const [userAvatarUrl, setUserAvatarUrl] = useState("");
  const [userInitial, setUserInitial] = useState("U");
  const [expandedMessages, setExpandedMessages] = useState({});
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState(null);
  const [activeSessionIdState, setActiveSessionIdState] = useState(urlSessionId);
  const [projectDocuments, setProjectDocuments] = useState([]);
  const [selectedSources, setSelectedSources] = useState([]);
  const [showSourcesDropdown, setShowSourcesDropdown] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [viewingDocumentUrl, setViewingDocumentUrl] = useState(null);
  const [showDocumentPicker, setShowDocumentPicker] = useState(false);
  const [documentContent, setDocumentContent] = useState("");
  const [documentLoading, setDocumentLoading] = useState(false);
  const [documentError, setDocumentError] = useState("");
  const [agentStatus, setAgentStatus] = useState("");
  const scrollContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const currentWsUrlSessionRef = useRef(urlSessionId);
  const sourcesDropdownRef = useRef(null);
  const sourcesToggleRef = useRef(null);
  const hasAutoOpenedDocRef = useRef(false);
  const streamInProgressRef = useRef(false);
  const documentPickerRef = useRef(null);
  const documentPickerToggleRef = useRef(null);
  const activeSessionId = useMemo(() => (
    urlSessionId === "new" ? null : urlSessionId
  ), [urlSessionId]);
  const sourceStorageKey = useMemo(() => (
    projectId ? `docugyan_chat_sources_${projectId}` : ""
  ), [projectId]);
  const viewingDocument = useMemo(() => (
    projectDocuments.find((doc) => doc.displayUrl === viewingDocumentUrl) || null
  ), [projectDocuments, viewingDocumentUrl]);

  const LONG_MESSAGE_THRESHOLD = 220;

  const toggleMessageExpanded = (index) => {
    setExpandedMessages((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleCopy = async (text, index) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
    } catch (err) {
      // Ignore clipboard failures silently.
    }
  };

  const markStreamingAssistant = () => {
    setMessages((prev) => {
      if (prev.some((msg) => msg.role === "assistant" && msg.status === "streaming")) {
        return prev;
      }
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i -= 1) {
        if (next[i].role === "assistant" && (next[i].status === "pending" || next[i].status === "streaming")) {
          next[i] = { ...next[i], status: "streaming", content: next[i].content || "" };
          return next;
        }
      }
      return [...next, { role: "assistant", content: "", status: "streaming" }];
    });
  };

  const appendStreamChunk = (chunkText) => {
    if (!chunkText) return;
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i -= 1) {
        if (next[i].role === "assistant" && next[i].status === "streaming") {
          next[i] = { ...next[i], content: `${next[i].content || ""}${chunkText}` };
          return next;
        }
      }
      return [...next, { role: "assistant", content: chunkText, status: "streaming" }];
    });
  };

  const finalizeStreamingAssistant = (fallbackMessage) => {
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i -= 1) {
        if (next[i].role === "assistant" && next[i].status === "streaming") {
          const nextContent = next[i].content || fallbackMessage || "";
          next[i] = { ...next[i], content: nextContent, status: "done" };
          return next;
        }
      }
      if (fallbackMessage) {
        return [...next, { role: "assistant", content: fallbackMessage, status: "done" }];
      }
      return next;
    });
  };

  const hasActiveAssistantStream = useMemo(
    () => messages.some((msg) => msg.role === "assistant" && msg.status === "streaming"),
    [messages]
  );

  const handleRetry = (query, messageIndex) => {
    const trimmed = query?.trim();
    if (!trimmed || isWaitingForResponse) return;

    setMessages((prev) => {
      const next = [...prev];
      if (typeof messageIndex === "number" && next[messageIndex]?.role === "assistant") {
        next[messageIndex] = { ...next[messageIndex], status: "streaming", content: "" };
      }
      return next;
    });

    setIsWaitingForResponse(true);
    streamInProgressRef.current = false;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "chat", query: trimmed, sources: selectedSources }));
    } else {
      setIsWaitingForResponse(false);
      finalizeStreamingAssistant("Connection offline. Please refresh.");
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm("Are you sure you want to delete this chat session?")) return;
    setDeletingSessionId(sessionId);
    try {
      await deleteChatSession(sessionId);
      setSessions(prev => prev.filter(s => s.session_id !== sessionId));
      if (sessionId === activeSessionId || sessionId === urlSessionId) {
        router.push(`/dashboard/chat?project=${encodeURIComponent(projectId)}&session=new`);
      }
    } catch (err) {
      alert("Failed to delete session: " + err.message);
    } finally {
      setDeletingSessionId(null);
    }
  };

  const scrollToBottom = (behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isAtBottom);
  };

  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    // Use a slightly larger threshold for auto-scroll to be more forgiving
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 200;
    
    if (isAtBottom) {
      scrollToBottom("auto");
    }
  }, [messages, isWaitingForResponse]);

  const groupedSessions = useMemo(() => {
    const groups = new Map();
    sessions.forEach((session) => {
      const label = formatSessionDate(session?.created_at) || "Unknown date";
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(session);
    });
    return Array.from(groups.entries());
  }, [sessions]);

  useEffect(() => {
    fetchUserProfile().then(res => {
      if (res && (res.name || res.first_name || res.email)) {
        const displayName = res.name || res.first_name || res.email.split('@')[0];
        setUserName(displayName);
        setUserInitial((displayName?.[0] || res.email?.[0] || "U").toUpperCase());
      }
      const avatarCandidate = res?.avatar_url || res?.profile_image || res?.image_url || res?.photo_url || "";
      if (avatarCandidate) setUserAvatarUrl(avatarCandidate);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    hasAutoOpenedDocRef.current = false;
    setViewingDocumentUrl(null);
  }, [projectId]);

  useEffect(() => {
    let isMounted = true;
    setSessionsLoading(true);
    fetchChatSessionList(projectId).then(res => {
      if (isMounted) {
        setSessions(Array.isArray(res) ? res : []);
        setSessionsLoading(false);
      }
    }).catch(() => {
      if (isMounted) {
        setSessions([]);
        setSessionsLoading(false);
      }
    });

    if (projectId) {
      fetchDocuProcessData(projectId).then(res => {
        if (!isMounted) return;
        let documents = [];
        const processData = (res && res.results && res.results.length > 0) ? res.results[0] : res;
        if (processData) {
          const refUrls = Array.isArray(processData.reference_urls)
            ? processData.reference_urls
            : (typeof processData.reference_urls === "string" ? [processData.reference_urls] : []);
          const extractedUrls = Array.isArray(processData.extracted_doc_urls)
            ? processData.extracted_doc_urls
            : (typeof processData.extracted_doc_urls === "string" ? [processData.extracted_doc_urls] : []);
          const resUrls = Array.isArray(processData.result_urls)
            ? processData.result_urls
            : (typeof processData.result_urls === "string" ? [processData.result_urls] : []);

          const normalizedExtracted = extractedUrls.map(normalizeUrl).filter(Boolean);
          const referenceDocs = refUrls.map((refUrl, index) => {
            const displayUrl = normalizeUrl(refUrl);
            const extractedUrl = normalizedExtracted[index] || "";
            if (!displayUrl || !extractedUrl) return null;
            return {
              id: `ref-${index}`,
              kind: "reference",
              displayName: cleanDocumentName(displayUrl),
              displayUrl,
              sendUrl: extractedUrl,
            };
          }).filter(Boolean);

          const resultDocs = resUrls.map((resultUrl, index) => {
            const displayUrl = normalizeUrl(resultUrl);
            if (!displayUrl) return null;
            return {
              id: `final-${index}`,
              kind: "final",
              displayName: index === 0 ? "Final Answer" : `Final Answer ${index + 1}`,
              displayUrl,
              sendUrl: displayUrl,
            };
          }).filter(Boolean);

          documents = [...referenceDocs, ...resultDocs];

        }
        setProjectDocuments(documents);

        let storedSources;
        if (sourceStorageKey && typeof window !== "undefined") {
          try {
            storedSources = JSON.parse(window.localStorage.getItem(sourceStorageKey) || "null");
          } catch (err) {
            storedSources = null;
          }
        }

        const allowedSources = new Set(documents.map((doc) => doc.sendUrl));
        const defaultSources = documents.map((doc) => doc.sendUrl);
        const filteredSources = Array.isArray(storedSources)
          ? storedSources.filter((source) => allowedSources.has(source))
          : defaultSources;

        setSelectedSources(filteredSources);

        if (!hasAutoOpenedDocRef.current) {
          const selectedDoc = documents.find((doc) => filteredSources.includes(doc.sendUrl));
          const finalAnswerDoc = documents.find((doc) => doc.kind === "final");
          const fallbackDoc = finalAnswerDoc || documents[0];
          const nextUrl = selectedDoc?.displayUrl || fallbackDoc?.displayUrl || null;
          if (nextUrl) {
            setViewingDocumentUrl(nextUrl);
            hasAutoOpenedDocRef.current = true;
          }
        }
      }).catch(err => console.error("Failed to load documents", err));
    }

    return () => { isMounted = false; };
  }, [projectId, sourceStorageKey]);

  useEffect(() => {
    if (!sourceStorageKey || projectDocuments.length === 0) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(sourceStorageKey, JSON.stringify(selectedSources));
  }, [projectDocuments, selectedSources, sourceStorageKey]);

  useEffect(() => {
    if (!showSourcesDropdown) return;

    const handleOutsideClick = (event) => {
      const dropdown = sourcesDropdownRef.current;
      const toggle = sourcesToggleRef.current;
      if (!dropdown || !toggle) return;
      if (dropdown.contains(event.target) || toggle.contains(event.target)) return;
      setShowSourcesDropdown(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showSourcesDropdown]);

  useEffect(() => {
    if (!showDocumentPicker) return;

    const handleOutsideClick = (event) => {
      const picker = documentPickerRef.current;
      const toggle = documentPickerToggleRef.current;
      if (!picker || !toggle) return;
      if (picker.contains(event.target) || toggle.contains(event.target)) return;
      setShowDocumentPicker(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showDocumentPicker]);

  useEffect(() => {
    let isMounted = true;
    if (urlSessionId === 'new') {
      const newSessionId = createClientSessionId();
      currentWsUrlSessionRef.current = newSessionId;
      setActiveSessionIdState(newSessionId);
      setIsWaitingForResponse(false);
      setIsSessionLoading(false);
      setMessages([]);
      const newUrl = `/dashboard/chat?project=${encodeURIComponent(projectId)}&session=${encodeURIComponent(newSessionId)}`;
      window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl);
      return;
    }

    setActiveSessionIdState(urlSessionId);
    // Attempt to fetch history for this session UUID.
    setIsSessionLoading(true);
    setMessages([]);
    fetchChatSessionDetails(urlSessionId).then(res => {
      if (!isMounted) return;
      if (res && res.messages) {
        const loadedMsgs = [];
        res.messages.forEach(m => {
          if (m.user_message) loadedMsgs.push({ role: 'user', content: m.user_message });
          const assistantText = typeof m.assistant_response === "string" ? m.assistant_response.trim() : "";
          if (assistantText) {
            loadedMsgs.push({ role: 'assistant', content: m.assistant_response, status: "done" });
          } else if (m.user_message) {
            loadedMsgs.push({ role: 'assistant', content: "", status: "pending", retryQuery: m.user_message });
          }
        });
        setMessages(loadedMsgs);
      } else {
         // Maybe it's a freshly generated UUID client-side that doesn't exist yet
         setMessages([]);
      }
      if (isMounted) setIsSessionLoading(false);
    }).catch(() => {
      if (isMounted) {
        // Just treat as empty fresh session
        setMessages([]);
        setIsSessionLoading(false);
      }
    });

    return () => { isMounted = false; };
  }, [urlSessionId, projectId]);

  useEffect(() => {
    if (!viewingDocumentUrl) return;
    const isMdOrTxt = viewingDocumentUrl.match(/\.(md|txt)(?:$|[?#])/i);
    if (!isMdOrTxt) {
      setDocumentContent("");
      setDocumentError("");
      return;
    }
    
    setDocumentLoading(true);
    setDocumentError("");
    fetch(getViewableUrl(viewingDocumentUrl))
      .then(res => {
         if (!res.ok) throw new Error("Failed to load document");
         return res.text();
      })
      .then(text => {
         setDocumentContent(text);
         setDocumentLoading(false);
      })
      .catch(err => {
         setDocumentError("Failed to load document content.");
         setDocumentLoading(false);
      });
  }, [viewingDocumentUrl]);

  useEffect(() => {
    let ws;
    let isMounted = true;
    currentWsUrlSessionRef.current = urlSessionId;

    if (urlSessionId === 'new') {
      return () => { isMounted = false; };
    }

    const connect = async () => {
      try {
        const tokenRes = await fetchWsToken();
        const token = tokenRes?.access_token || tokenRes?.token || "";
        const wsUrl = buildChatWebSocketUrl(projectId, urlSessionId, token);
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "ping" }));
            }
          }, 25000);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'pong') return;

            if (data.type === "agent_thinking") {
              setIsWaitingForResponse(true);
              setAgentStatus("Thinking...");
              return;
            }

            if (data.type === "agent_tool_call") {
              const toolList = Array.isArray(data.tools) && data.tools.length > 0
                ? `Using tools: ${data.tools.join(", ")}`
                : "Retrieving documents...";
              setIsWaitingForResponse(true);
              setAgentStatus(toolList);
              return;
            }

            if (data.type === "agent_done") {
              setAgentStatus("");
              return;
            }

            if (data.type === "retrying") {
              const turns = data.history_turns ? ` (history: ${data.history_turns} turns)` : "";
              setIsWaitingForResponse(true);
              setAgentStatus(`Retrying with shorter context${turns}...`);
              return;
            }

            if (data.type === "stream_start") {
              setIsWaitingForResponse(true);
              streamInProgressRef.current = true;
              setAgentStatus("Generating answer...");
              markStreamingAssistant();
              return;
            }

            if (data.type === "stream_chunk") {
              if (!streamInProgressRef.current) {
                streamInProgressRef.current = true;
                setIsWaitingForResponse(true);
                markStreamingAssistant();
              }
              appendStreamChunk(data.content || data.chunk || "");
              return;
            }

            if (data.type === "stream_end") {
              setIsWaitingForResponse(false);
              streamInProgressRef.current = false;
              setAgentStatus("");
              finalizeStreamingAssistant();
              return;
            }

            if (data.type === "error" || data.type === "stream_error") {
              setIsWaitingForResponse(false);
              streamInProgressRef.current = false;
              setAgentStatus("");
              finalizeStreamingAssistant(data.content || data.error || "Error generating response.");
              return;
            }
            
            if (data.session_id && data.title) {
               setSessions(prev => {
                 const existing = prev.find(s => s.session_id === data.session_id);
                 if (existing) {
                   if (existing.title === data.title) return prev;
                   return prev.map(s => s.session_id === data.session_id ? { ...s, title: data.title } : s);
                 }
                 return [{ session_id: data.session_id, title: data.title, created_at: new Date().toISOString() }, ...prev];
               });
            }

            if (data.type === 'chat_response' || data.type === 'message' || data.content !== undefined) {
              if (!streamInProgressRef.current) {
                setIsWaitingForResponse(false);
              }
              const text = data.content || data.message || data.chunk || "";
              if (!text) return;
              if (streamInProgressRef.current) {
                appendStreamChunk(text);
                return;
              }
              setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                  if (lastMsg.content === text || lastMsg.content?.endsWith?.(text)) {
                    return prev;
                  }
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1] = { ...lastMsg, content: `${lastMsg.content || ""}${text}`, status: "done" };
                  return newMsgs;
                }
                return [...prev, { role: 'assistant', content: text, status: "done" }];
              });
            }
          } catch(e) {}
        };

        ws.onclose = () => {
          clearInterval(ws.pingInterval);
        };
      } catch (err) {}
    };

    connect();

    return () => {
      isMounted = false;
      if (ws) {
        clearInterval(ws.pingInterval);
        ws.close();
      }
    };
  }, [projectId, urlSessionId]);
  const handleSend = (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isWaitingForResponse) return;
    setMessages(prev => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setIsWaitingForResponse(true);
    setAgentStatus("");
    setShowSourcesDropdown(false);
    streamInProgressRef.current = false;
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "chat", query: trimmed, sources: selectedSources }));
    } else {
      setIsWaitingForResponse(false);
      setMessages(prev => [...prev, { role: "assistant", content: "Connection offline. Please refresh.", status: "done" }]);
    }
  };

  return (
    <div className="flex h-[calc(100vh-70px)] w-full overflow-hidden bg-[#0a0a0c] text-slate-200">
      {/* Sidebar */}
      <div className={`transition-all duration-300 ease-in-out ${sidebarOpen ? 'md:flex' : 'hidden'} w-72 shrink-0 flex-col border-r border-white/10 bg-[#0f0f14] z-10 relative shadow-xl animate-in fade-in-left`} style={{ minWidth: 288 }}>
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/5 px-5">
          <span className="font-semibold text-slate-200 tracking-wide">Chat Sessions</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Close Sidebar"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button
              onClick={() => {
                const newSessionId = createClientSessionId();
                currentWsUrlSessionRef.current = newSessionId;
                setIsWaitingForResponse(false);
                setIsSessionLoading(true);
                router.push(`/dashboard/chat?project=${encodeURIComponent(projectId)}&session=${encodeURIComponent(newSessionId)}`);
              }}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="New Chat"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
          {sessionsLoading ? (
            <div className="space-y-4 px-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="h-3 w-16 rounded bg-white/5 animate-pulse mx-auto mb-1" />
                  <div className="h-11 w-full rounded-lg bg-white/5 border border-white/5 animate-pulse" />
                  {i === 1 && <div className="h-11 w-full rounded-lg bg-white/5 border border-white/5 animate-pulse" />}
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-xs text-slate-500 px-2 py-3 text-center">No sessions found.</div>
          ) : (
            groupedSessions.map(([label, daySessions]) => (
              <div key={label} className="space-y-2">
                <div className="flex items-center gap-2 px-2">
                  <span className="h-px flex-1 bg-white/5" />
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {label}
                  </span>
                  <span className="h-px flex-1 bg-white/5" />
                </div>
                <div className="space-y-1 pt-2">
                  {daySessions.map((s) => {
                    const isActive = s.session_id === activeSessionId;
                    return (
                      <div
                        key={s.session_id}
                        onClick={() => router.push(`/dashboard/chat?project=${encodeURIComponent(projectId)}&session=${encodeURIComponent(s.session_id)}`)}
                        className={`group w-full text-left truncate rounded-lg px-3 py-2 text-sm flex items-center justify-between transition-all cursor-pointer border ${isActive ? 'bg-gradient-to-r from-violet-600/25 to-indigo-500/15 text-white border-violet-500/30 shadow-md scale-[1.01]' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border-transparent'} animate-in fade-in`}
                        style={{ boxShadow: isActive ? '0 1px 10px 0 rgba(139,92,246,0.10)' : undefined }}
                      >
                        <span className="font-semibold truncate flex-1">{s.title || 'Untitled Session'}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSession(s.session_id);
                          }}
                          disabled={deletingSessionId === s.session_id}
                          className={`ml-2 p-1 rounded-md transition-all hover:text-red-400 hover:bg-red-500/10 ${isActive ? 'text-violet-200' : 'opacity-0 group-hover:opacity-100 text-slate-500'}`}
                          title="Delete Session"
                        >
                          {deletingSessionId === s.session_id ? (
                            <span className="h-3 w-3 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                          ) : (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex flex-col relative bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-violet-900/10 via-[#0a0a0c] to-[#0a0a0c] transition-all duration-300 ${viewingDocumentUrl ? 'w-full lg:w-1/2 border-r border-white/10' : 'flex-1'}`}>
        {/* Sidebar toggle for mobile */}
        <button
          className="absolute left-2 top-4 z-20 md:hidden bg-violet-600/80 hover:bg-violet-700 text-white rounded-full p-2 shadow-lg transition-all"
          onClick={() => setSidebarOpen(true)}
          style={{ display: sidebarOpen ? 'none' : 'block' }}
          title="Open Sidebar"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        {/* Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-[#0f0f14]/80 px-4 md:px-6 backdrop-blur-md z-10">
          <div className="flex items-start min-w-0 gap-2">
            <button onClick={() => setSidebarOpen(true)} className="mr-2 md:hidden cursor-pointer text-slate-400 hover:text-white transition-colors shrink-0" style={{ display: sidebarOpen ? 'none' : 'block' }}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex flex-col min-w-0">
              {isSessionLoading ? (
                <span className="inline-flex items-center">
                  <span className="h-4 w-44 rounded-full bg-white/10 animate-pulse" />
                </span>
              ) : sessions.find(s => s.session_id === activeSessionIdState)?.title ? (
                <span className="font-semibold text-white truncate">
                  {sessions.find(s => s.session_id === activeSessionIdState).title}
                </span>
              ) : (
                <span className="font-semibold text-slate-400 truncate">New Chat</span>
              )}
            </div>
          </div>
          
          {/* Header Actions */}
          <div className="flex items-center gap-2">
            <div className="relative">
               <button
                  type="button"
                  onClick={() => setShowSourcesDropdown((prev) => !prev)}
                    ref={sourcesToggleRef}
                  className={`flex h-9 items-center gap-2 px-3 rounded-lg border transition-all ${
                    selectedSources.length > 0
                      ? "border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20"
                      : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                  }`}
                  title="Select Sources"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span className="text-xs font-medium">Sources {selectedSources.length > 0 ? `(${selectedSources.length})` : ''}</span>
                </button>
                {/* Dropdown Menu */}
                {showSourcesDropdown && (
                  <div
                    ref={sourcesDropdownRef}
                    className="absolute top-full right-0 mt-3 w-80 md:w-96 rounded-2xl border border-white/10 bg-[#16161e] p-4 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 slide-in-from-top-2 z-50"
                  >
                    <div className="mb-4 flex items-center justify-between px-1">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Select Sources</h3>
                      <button
                        type="button"
                        onClick={() => setShowSourcesDropdown(false)}
                        className="text-slate-500 hover:text-white transition-colors"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                      {projectDocuments.length === 0 ? (
                        <div className="p-4 text-center text-sm text-slate-500">No documents found for this project.</div>
                      ) : (
                        projectDocuments.map((doc) => {
                          const isSelected = selectedSources.includes(doc.sendUrl);
                          
                          return (
                            <div key={doc.id} className={`flex items-center justify-between gap-4 rounded-xl border p-3.5 transition-all mb-3 last:mb-0 ${isSelected ? 'border-violet-500/40 bg-violet-500/15 shadow-sm' : 'border-white/5 hover:bg-white/5 hover:border-white/10'}`}>
                              <label className="flex flex-1 cursor-pointer items-center gap-3 overflow-hidden">
                                <div className="relative flex shrink-0 items-center justify-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {
                                      setSelectedSources(prev => 
                                        prev.includes(doc.sendUrl) ? prev.filter(s => s !== doc.sendUrl) : [...prev, doc.sendUrl]
                                      );
                                    }}
                                    className="peer sr-only"
                                  />
                                  <div className={`h-4 w-4 rounded-md border flex items-center justify-center transition-all ${isSelected ? 'border-violet-500 bg-violet-500' : 'border-slate-600 bg-black/20 peer-hover:border-slate-500'}`}>
                                    {isSelected && (
                                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                </div>
                                <span className={`truncate text-sm transition-colors ${isSelected ? 'text-violet-100 font-medium' : 'text-slate-300'}`} title={doc.displayName}>{doc.displayName}</span>
                              </label>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingDocumentUrl(doc.displayUrl);
                                  setShowSourcesDropdown(false);
                                }}
                                className="flex shrink-0 items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-all bg-black/20 border border-white/5"
                                title="View Document"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth custom-scrollbar"
        >
          <div className="max-w-3xl mx-auto w-full space-y-6 pt-4">
            {(messages.length === 0 && !isSessionLoading && !isWaitingForResponse) ? (
              <div className="flex flex-col items-center justify-center h-[60vh] animate-in fade-in slide-in-from-bottom-2">
                <div className="mb-4 flex items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/30 text-violet-400 shadow-[0_0_30px_rgba(139,92,246,0.15)] h-16 w-16">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">👋 Welcome{userName ? `, ${userName}` : ''}!</h2>
                <p className="text-slate-300 max-w-xl text-center whitespace-pre-line">
                  I am DocuChat. You can ask me questions about your documents in this workspace.
                </p>
              </div>
            ) : null}
            {isSessionLoading ? (
              <div className="space-y-6">
                <div className="flex justify-end animate-pulse">
                  <div className="flex max-w-[85%] md:max-w-[75%] gap-3 flex-row-reverse">
                    <div className="h-8 w-8 rounded-lg border border-white/10 bg-white/5" />
                    <div className="rounded-2xl rounded-tr-none bg-white/5 border border-white/10 px-5 py-3.5">
                      <div className="h-3 w-44 rounded-full bg-white/10" />
                      <div className="mt-2 h-3 w-36 rounded-full bg-white/10" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-start animate-pulse">
                  <div className="flex max-w-[85%] md:max-w-[75%] gap-3">
                    <div className="h-8 w-8 rounded-lg border border-white/10 bg-white/5" />
                    <div className="rounded-2xl rounded-tl-none bg-white/5 border border-white/10 px-5 py-3.5">
                      <div className="h-3 w-52 rounded-full bg-white/10" />
                      <div className="mt-2 h-3 w-32 rounded-full bg-white/10" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end animate-pulse">
                  <div className="flex max-w-[85%] md:max-w-[75%] gap-3 flex-row-reverse">
                    <div className="h-8 w-8 rounded-lg border border-white/10 bg-white/5" />
                    <div className="rounded-2xl rounded-tr-none bg-white/5 border border-white/10 px-5 py-3.5">
                      <div className="h-3 w-60 rounded-full bg-white/10" />
                      <div className="mt-2 h-3 w-24 rounded-full bg-white/10" />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            {messages.map((m, i) => {
              const isLongUserMessage = m.role === 'user' && m.content && m.content.length > LONG_MESSAGE_THRESHOLD;
              const isExpanded = Boolean(expandedMessages[i]);
              const displayContent = isLongUserMessage && !isExpanded
                ? `${m.content.slice(0, LONG_MESSAGE_THRESHOLD)}...`
                : m.content;
              const isPending = m.role === 'assistant' && m.status === 'pending';
              const isStreaming = m.role === 'assistant' && m.status === 'streaming';
              const showTypingDots = isStreaming && !displayContent;
              const showStreamingIndicator = isStreaming && displayContent;

              return (
                <div key={i} className={`flex animate-in slide-in-from-bottom-2 fade-in ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex max-w-[85%] md:max-w-[75%] gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Avatar */}
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border ${m.role === 'user' ? 'bg-violet-600/20 border-violet-500/40 text-violet-100 shadow-[0_0_10px_rgba(139,92,246,0.2)]' : 'bg-violet-600 border-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.3)]'}`}>
                      {m.role === 'user' ? (
                        userAvatarUrl ? (
                          <img src={userAvatarUrl} alt="User avatar" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xs font-semibold">{userInitial}</span>
                        )
                      ) : (
                        <img src="/logo.svg" alt="DocuGyan" className="h-4 w-4" />
                      )}
                    </div>
                    {/* Message Bubble */}
                    <div className={`group flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start min-w-0 w-full'}`}>
                      <div className={`px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-white/5 border border-white/10 text-slate-200 rounded-xl' : 'text-slate-200 w-full prose prose-invert prose-violet max-w-none prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0'}`}>
                        {m.role === 'assistant' ? (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code: CodeBlock,
                              table: ({node, ...props}) => <div className="overflow-x-auto my-6"><table className="min-w-full divide-y divide-white/10 text-sm" {...props} /></div>,
                              thead: ({node, ...props}) => <thead className="bg-white/5" {...props} />,
                              th: ({node, ...props}) => <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300 border-b border-white/10" {...props} />,
                              td: ({node, ...props}) => <td className="px-4 py-3 text-slate-400 border-b border-white/5 whitespace-nowrap" {...props} />,
                              p: ({node, ...props}) => <p className="mb-4 last:mb-0 leading-relaxed" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-1.5 marker:text-violet-500" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-1.5 marker:text-violet-500" {...props} />,
                              h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-8 mb-4 text-white tracking-tight" {...props} />,
                              h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-6 mb-3 text-white tracking-tight" {...props} />,
                              h3: ({node, ...props}) => <h3 className="text-lg font-semibold mt-4 mb-2 text-white" {...props} />,
                              a: ({node, href, ...props}) => <a href={getViewableUrl(href)} className="text-violet-400 hover:text-violet-300 underline decoration-violet-400/30 underline-offset-2 transition-colors" target="_blank" rel="noopener noreferrer" {...props} />,
                              img: ({node, src, alt, ...props}) => {
                                const safeSrc = typeof src === "string" && src.trim() ? getViewableUrl(src) : null;
                                if (!safeSrc) return null;
                                return <img src={safeSrc} alt={alt || ""} className="rounded-xl border border-white/10" {...props} />;
                              },
                            }}
                          >
                            {displayContent}
                          </ReactMarkdown>
                        ) : (
                          displayContent
                        )}
                        {showTypingDots ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-white/80 animate-bounce" />
                            <span className="h-2 w-2 rounded-full bg-white/80 animate-bounce [animation-delay:120ms]" />
                            <span className="h-2 w-2 rounded-full bg-white/80 animate-bounce [animation-delay:240ms]" />
                          </span>
                        ) : null}
                        {showStreamingIndicator ? (
                          <span className="mt-2 inline-flex items-center gap-1 text-xs text-slate-400">
                            <span className="h-2 w-2 rounded-full bg-white/80 animate-bounce" />
                            <span className="h-2 w-2 rounded-full bg-white/80 animate-bounce [animation-delay:120ms]" />
                            <span className="h-2 w-2 rounded-full bg-white/80 animate-bounce [animation-delay:240ms]" />
                          </span>
                        ) : null}
                        <div className={`mt-2 flex items-center gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          {isLongUserMessage && (
                            <button
                              type="button"
                              onClick={() => toggleMessageExpanded(i)}
                              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 p-1 text-slate-300 transition-colors hover:bg-white/10"
                              title={isExpanded ? "Collapse" : "Expand"}
                              aria-label={isExpanded ? "Collapse" : "Expand"}
                            >
                              <svg className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                      {isPending ? (
                        <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                          <span>No response yet.</span>
                          <button
                            type="button"
                            onClick={() => handleRetry(m.retryQuery, i)}
                            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200 transition-colors hover:bg-white/10"
                          >
                            Retry
                          </button>
                        </div>
                      ) : null}
                      {m.role === 'assistant' ? (
                        <div className="mt-1 flex items-center">
                          <button
                            type="button"
                            onClick={() => handleCopy(m.content, i)}
                            onMouseLeave={() => setCopiedIndex((current) => (current === i ? null : current))}
                            className="inline-flex items-center justify-center rounded-full border border-transparent bg-transparent p-1.5 text-slate-300 transition-all hover:bg-white/10 hover:border-white/10"
                            title={copiedIndex === i ? "Copied" : "Copy"}
                            aria-label={copiedIndex === i ? "Copied" : "Copy"}
                          >
                            {copiedIndex === i ? (
                              <svg className="h-3.5 w-3.5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 8h2a2 2 0 012 2v8a2 2 0 01-2 2H10a2 2 0 01-2-2v-2" />
                              </svg>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="mt-1 flex items-center opacity-0 transition-all group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => handleCopy(m.content, i)}
                            onMouseLeave={() => setCopiedIndex((current) => (current === i ? null : current))}
                            className="inline-flex items-center justify-center rounded-full border border-transparent bg-transparent p-1.5 text-slate-300 transition-all hover:bg-white/10 hover:border-white/10"
                            title={copiedIndex === i ? "Copied" : "Copy"}
                            aria-label={copiedIndex === i ? "Copied" : "Copy"}
                          >
                            {copiedIndex === i ? (
                              <svg className="h-3.5 w-3.5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 8h2a2 2 0 012 2v8a2 2 0 01-2 2H10a2 2 0 01-2-2v-2" />
                              </svg>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {isWaitingForResponse && !hasActiveAssistantStream && (
              <div className="flex justify-start animate-in fade-in">
                <div className="flex max-w-[85%] md:max-w-[75%] gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-violet-600 border-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.3)]">
                    <img src="/logo.svg" alt="DocuGyan" className="h-4 w-4" />
                  </div>
                  <div className="px-2 py-1 text-sm leading-relaxed whitespace-pre-wrap text-slate-200">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-white/80 animate-bounce" />
                      <span className="h-2 w-2 rounded-full bg-white/80 animate-bounce [animation-delay:120ms]" />
                      <span className="h-2 w-2 rounded-full bg-white/80 animate-bounce [animation-delay:240ms]" />
                    </span>
                    {agentStatus ? (
                      <span className="ml-3 text-xs text-slate-400">{agentStatus}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-4 w-full" />
          </div>
        </div>

        {/* Scroll to Bottom Button */}
        {showScrollButton && (
          <button
            onClick={() => scrollToBottom("smooth")}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-violet-600/90 text-white shadow-2xl backdrop-blur-sm transition-all hover:bg-violet-500 hover:scale-110 active:scale-95 animate-in fade-in zoom-in slide-in-from-bottom-4 border border-white/10"
            title="Scroll to bottom"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 13l-7 7-7-7" />
            </svg>
          </button>
        )}

        {/* Input Box */}
        <div className="p-4 md:p-6 shrink-0 relative z-10">
          <div className="absolute inset-x-0 bottom-full h-12 bg-gradient-to-t from-[#0a0a0c] to-transparent pointer-events-none" />
          <form onSubmit={handleSend} className="relative flex items-center w-full max-w-3xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask anything about your documents..."
              className="w-full rounded-2xl border border-white/10 bg-[#0f0f14] pl-5 pr-14 py-4 text-sm text-white placeholder:text-slate-500 focus:border-violet-500/50 focus:bg-[#0f0f14] focus:outline-none focus:ring-1 focus:ring-violet-500/50 shadow-2xl transition-all"
            />
            <button 
              type="submit" 
              disabled={!input.trim() || isWaitingForResponse || isSessionLoading} 
              className="absolute right-2.5 flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-violet-600 text-white disabled:opacity-50 transition-all hover:bg-violet-500 disabled:cursor-not-allowed hover:shadow-[0_0_15px_rgba(139,92,246,0.4)]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m-7 7l7-7 7 7" />
              </svg>
            </button>
          </form>
          <p className="mt-3 text-center text-[11px] text-slate-500">DocuChat can make mistakes. Consider verifying important information.</p>
        </div>
      </div>
      
      {/* Document Viewer Side Panel */}
      {viewingDocumentUrl && (
        <div className="absolute inset-0 lg:static lg:inset-auto flex flex-col lg:w-1/2 bg-[#0a0a0c] animate-in slide-in-from-right relative z-50 lg:z-20 shadow-[-10px_0_30px_-10px_rgba(0,0,0,0.5)]">
           {/* Header */}
           <div className="relative z-40 flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-[#0f0f14]/95 px-4 backdrop-blur-md">
             <div className="flex items-center gap-3 min-w-0">
               <svg className="h-5 w-5 text-violet-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
               </svg>
               <span className="font-medium text-sm text-slate-200 truncate" title={viewingDocument?.displayName || viewingDocumentUrl}>
                 {viewingDocument?.displayName || cleanDocumentName(viewingDocumentUrl)}
               </span>
             </div>
             <div className="relative flex items-center gap-2">
                <button
                  ref={documentPickerToggleRef}
                  type="button"
                  onClick={() => setShowDocumentPicker((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/20 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-100 shadow-[0_0_18px_rgba(139,92,246,0.25)] transition-all hover:bg-violet-500/30 hover:text-white"
                  title="Change document"
                >
                  Change Doc
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <a 
                  href={getViewableUrl(viewingDocumentUrl)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                  title="Open in new tab"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <button onClick={() => setViewingDocumentUrl(null)} className="p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors" title="Close">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                {showDocumentPicker ? (
                  <div
                    ref={documentPickerRef}
                    className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-white/15 bg-[#16161e] p-3 shadow-2xl shadow-black/70 backdrop-blur-xl z-[60]"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Documents</div>
                      <button
                        type="button"
                        onClick={() => setShowDocumentPicker(false)}
                        className="rounded-full p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                        title="Cancel"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1">
                      {projectDocuments.length === 0 ? (
                        <div className="p-2 text-xs text-slate-500">No documents available.</div>
                      ) : (
                        projectDocuments.map((doc) => (
                          <button
                            key={doc.id}
                            type="button"
                            onClick={() => {
                              setViewingDocumentUrl(doc.displayUrl);
                              setShowDocumentPicker(false);
                            }}
                            className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                              doc.displayUrl === viewingDocumentUrl
                                ? "bg-violet-500/15 text-violet-100"
                                : "text-slate-300 hover:bg-white/5"
                            }`}
                          >
                            {doc.displayName}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
             </div>
           </div>
           {/* Viewer */}
           <div className="relative z-10 flex-1 w-full bg-[#12121a] flex items-center justify-center overflow-hidden">
             {(() => {
               const viewableUrl = getViewableUrl(viewingDocumentUrl);
               const isImage = viewingDocumentUrl.match(/\.(png|jpg|jpeg|gif|webp|bmp)(?:$|[?#])/i);
               const isMdOrTxt = viewingDocumentUrl.match(/\.(md|txt)(?:$|[?#])/i);

               if (isImage) {
                 return (
                   <div className="flex-1 w-full h-full flex items-center justify-center p-8 overflow-auto custom-scrollbar">
                     <div className="relative rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.6)] border border-white/10 bg-black/60 p-3 max-w-full m-auto inline-block">
                        <img src={viewableUrl} alt="Document" className="max-w-full h-auto object-contain rounded-xl" />
                     </div>
                   </div>
                 );
               }
               
               if (isMdOrTxt) {
                 return (
                   <div className="flex-1 w-full h-full overflow-y-auto custom-scrollbar bg-[#0c0d11] p-4 md:p-6">
                      {documentLoading ? (
                        <div className="flex h-full min-h-[300px] items-center justify-center text-sm text-violet-400">
                          <span className="h-5 w-5 block animate-spin rounded-full border-2 border-current border-t-transparent mr-3" />
                          Loading document...
                        </div>
                      ) : documentError ? (
                        <div className="flex h-full min-h-[300px] items-center justify-center text-sm text-red-400">
                          {documentError}
                        </div>
                      ) : (() => {
                        const tokenized = tokenizeDocumentDataImages(documentContent);
                        const processed = processDocumentContent(tokenized.content);
                        const chunks = parseDocumentChunks(processed);
                        
                        return (
                        <article className="mx-auto max-w-none w-full rounded-2xl border border-white/10 bg-[#11131a] px-4 py-5 md:px-6 md:py-6 text-slate-100">
                          {chunks.map((chunk, index) => {
                            if (chunk.type === "references") {
                              return <DocumentInlineReferences key={index} references={chunk.references} />;
                            }
                            return (
                              <ReactMarkdown key={index} remarkPlugins={[remarkGfm]} urlTransform={(url) => {
                                if (url.startsWith('mdimg://')) return url;
                                return url;
                              }} components={{
                                h1: ({ children, ...props }) => (
                                  <h1 {...props} className="text-2xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-white to-violet-200 mb-6 pb-3 border-b border-white/10">
                                    {children}
                                  </h1>
                                ),
                                h2: ({ children, ...props }) => (
                                  <h2 {...props} className="text-lg md:text-xl font-bold text-slate-100 mt-8 mb-4 flex items-center gap-2 border-b border-white/5 pb-2">
                                    {children}
                                  </h2>
                                ),
                                h3: ({ children, ...props }) => {
                                  const text = String(children).trim();
                                  if (text === "References" || text === "Unanswered Questions") {
                                    return (
                                      <h3 {...props} className="text-xs font-bold uppercase tracking-[0.15em] text-violet-300 mt-8 mb-3 flex items-center gap-2">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
                                        </svg>
                                        {children}
                                      </h3>
                                    );
                                  }
                                  return <h3 {...props} className="text-base font-semibold text-slate-200 mt-6 mb-3">{children}</h3>;
                                },
                                h4: ({ children, ...props }) => (
                                  <h4 {...props} className="text-sm font-semibold text-slate-200 mt-5 mb-2">{children}</h4>
                                ),
                                h6: ({ children, ...props }) => (
                                  <h6 {...props} className="text-base font-bold text-white mt-8 mb-4 border-l-[3px] border-violet-400 pl-3 py-1.5 bg-gradient-to-r from-violet-500/20 to-transparent rounded-r-lg">{children}</h6>
                                ),
                                p: ({ children, ...props }) => (
                                  <p {...props} className="text-slate-300 leading-[1.8] mb-4 text-[14px]">{children}</p>
                                ),
                                ul: ({ children, ...props }) => (
                                  <ul {...props} className="list-disc marker:text-violet-500 space-y-1.5 mb-5 ml-4">{children}</ul>
                                ),
                                ol: ({ children, ...props }) => (
                                  <ol {...props} className="list-decimal marker:text-violet-400 marker:font-semibold space-y-1.5 mb-5 ml-4 text-slate-300">{children}</ol>
                                ),
                                li: ({ children, ...props }) => (
                                  <li {...props} className="text-slate-300 leading-relaxed pl-1 mb-0.5">{children}</li>
                                ),
                                blockquote: ({ children, ...props }) => (
                                  <blockquote {...props} className="border-l-[3px] border-violet-500/60 bg-violet-500/5 px-4 py-3 rounded-r-xl my-5 text-slate-300 italic">{children}</blockquote>
                                ),
                                hr: (props) => <hr {...props} className="my-8 border-t border-dashed border-white/20" />,
                                strong: ({ children, ...props }) => (
                                  <strong {...props} className="font-semibold text-white">{children}</strong>
                                ),
                                table: ({ children, ...props }) => (
                                  <div className="overflow-x-auto my-5 rounded-xl border border-white/10 bg-black/40">
                                    <table {...props} className="w-full text-left text-sm text-slate-300">{children}</table>
                                  </div>
                                ),
                                thead: ({ children, ...props }) => <thead {...props} className="bg-white/5">{children}</thead>,
                                th: ({ children, ...props }) => (
                                  <th {...props} className="bg-white/5 px-3 py-2 font-semibold text-violet-200 border-b border-white/10 whitespace-nowrap text-xs">{children}</th>
                                ),
                                td: ({ children, ...props }) => (
                                  <td {...props} className="px-3 py-2 border-b border-white/5 last:border-0 align-top text-[13px]">{children}</td>
                                ),
                                code: CodeBlock,
                                pre: ({ children, ...props }) => (
                                  <pre {...props} className="!bg-transparent !p-0 !m-0 !border-0">{children}</pre>
                                ),
                                img: ({ src, alt, ...props }) => {
                                  let safeSrc = null;
                                  if (typeof src === 'string' && src.trim()) {
                                    if (src.startsWith('mdimg://')) {
                                      safeSrc = tokenized.imageByToken[src] || null;
                                    } else {
                                      safeSrc = getViewableUrl(src);
                                    }
                                  }
                                  if (!safeSrc) return null;
                                  return (
                                    <span className="my-6 flex flex-col items-center group">
                                      <img 
                                        src={safeSrc} 
                                        alt={alt || ""} 
                                        loading="lazy" 
                                        className="rounded-xl border border-white/10 bg-white/5 p-1.5 w-full max-h-[500px] object-contain shadow-[0_0_30px_rgba(139,92,246,0.15)] ring-1 ring-white/5 transition-transform group-hover:scale-[1.01] duration-300" 
                                        {...props} 
                                      />
                                      {alt && <span className="mt-3 text-xs font-medium text-slate-400 text-center">{alt}</span>}
                                    </span>
                                  );
                                },
                                a: ({ href, children, ...props }) => {
                                  const safeHref = typeof href === "string" ? getViewableUrl(href) : "";
                                  if (!safeHref) return <span {...props}>{children}</span>;
                                  return (
                                    <a href={safeHref} target="_blank" rel="noreferrer noopener" className="text-blue-400 underline decoration-blue-400/40 underline-offset-4 hover:decoration-blue-400 transition-all" {...props}>
                                      {children}
                                    </a>
                                  );
                                },
                              }}>
                                {chunk.content}
                              </ReactMarkdown>
                            );
                          })}
                        </article>
                        );
                      })()}
                   </div>
                 );
               }

               return (
                 <iframe src={viewableUrl} className="absolute inset-0 w-full h-full border-0 bg-white" title="Document Viewer" />
               );
             })()}
           </div>
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams?.get("project");

  if (projectId) {
    return <ChatSession projectId={projectId} />;
  }

  return <ChatList />;
}
