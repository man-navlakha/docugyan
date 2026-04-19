"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchDocuProcessList, LOCAL_STORAGE_KEYS, deleteDocuProcess } from "@/lib/api/docuApi";

const DEFAULT_PAGE_SIZE = 10;

function toStatusLabel(status) {
  if (typeof status !== "string" || !status.trim()) {
    return "Unknown";
  }

  return status
    .trim()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function toCount(value) {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (typeof value === "string") {
    return value.trim() ? 1 : 0;
  }

  return 0;
}

function toDisplayTitle(process) {
  if (typeof process?.title === "string" && process.title.trim()) {
    return process.title.trim();
  }

  if (typeof process?.description === "string" && process.description.trim()) {
    return process.description.trim().slice(0, 60);
  }

  return "Untitled Workspace";
}

function toDateTime(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function toStatusColor(status) {
  const normalized = (status || "").toLowerCase();

  if (normalized.includes("fail") || normalized.includes("error") || normalized.includes("delet")) {
    return "bg-red-500";
  }

  if (normalized.includes("complete") || normalized.includes("success") || normalized.includes("done")) {
    return "bg-emerald-500";
  }

  if (normalized.includes("progress") || normalized.includes("running") || normalized.includes("processing")) {
    return "bg-violet-500";
  }

  return "bg-slate-500";
}

export default function DocuHistoryPage() {
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

  useEffect(() => {
    setPage(1);
  }, [activeSearch]);

  useEffect(() => {
    let isMounted = true;

    const loadHistory = async () => {
      setLoading(true);
      setError("");

      try {
        const payload = await fetchDocuProcessList({ page, pageSize, search: activeSearch });

        if (!isMounted) {
          return;
        }

        const records = Array.isArray(payload?.results)
          ? payload.results
          : Array.isArray(payload)
            ? payload
            : [];

        setItems(records);
        setCount(typeof payload?.count === "number" ? payload.count : records.length);
      } catch (fetchError) {
        if (!isMounted) {
          return;
        }

        setError(fetchError?.message || "Unable to load history right now.");
        setItems([]);
        setCount(0);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, [activeSearch, page, pageSize]);

  const totalPages = useMemo(() => {
    const pages = Math.ceil(count / pageSize);
    return pages > 0 ? pages : 1;
  }, [count, pageSize]);

  const handleViewAgent = (projectId) => {
    if (!projectId) {
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCAL_STORAGE_KEYS.projectId, projectId);
    }

    router.push(`/dashboard/workspace?project=${encodeURIComponent(projectId)}`);
  };

  const handleStartChat = (projectId) => {
    if (!projectId) {
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCAL_STORAGE_KEYS.projectId, projectId);
    }

    router.push(`/dashboard/chat?project=${encodeURIComponent(projectId)}`);
  };

  const goToPrevious = () => {
    setPage((current) => (current > 1 ? current - 1 : current));
  };

  const goToNext = () => {
    setPage((current) => (current < totalPages ? current + 1 : current));
  };

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
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-white">DocuHistory Workspace</h1>
          <p className="mt-2 text-slate-400 max-w-xl mx-auto">
            Reopen previous runs instantly and continue from where you left off.
          </p>

          <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-1.5">
            <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100">
              <span className="text-cyan-200/80">Records</span>
              <span className="ml-1.5 text-sm font-bold text-white">{count}</span>
            </div>
            <div className="rounded-lg border border-violet-400/25 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-100">
              <span className="text-violet-200/85">Page</span>
              <span className="ml-1.5 text-sm font-bold text-white">{page}/{totalPages}</span>
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
                Loading history...
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 px-6 py-12 text-center text-slate-400">
              No history found yet. Start a new process from DocuAgent.
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
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
                          onClick={() => handleViewAgent(projectId)}
                          disabled={!projectId}
                          className="flex-1 lg:flex-none cursor-pointer rounded-xl bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-400 transition-all hover:bg-violet-500/20 hover:text-violet-300 disabled:cursor-not-allowed disabled:opacity-50 border border-violet-500/20"
                        >
                          View Agent
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartChat(projectId)}
                          disabled={!projectId}
                          className="flex-1 lg:flex-none cursor-pointer rounded-xl bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 transition-all hover:bg-emerald-500/20 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-50 border border-emerald-500/20 flex items-center justify-center gap-1.5"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          Chat
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
