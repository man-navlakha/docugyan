"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { LOCAL_STORAGE_KEYS } from "@/lib/api/docuApi";

export default function DocuAgentPage() {
  const router = useRouter();
  
  const [referenceFiles, setReferenceFiles] = useState([]);
  const [questionFiles, setQuestionFiles] = useState([]);
  
  const [referenceText, setReferenceText] = useState("");
  const [questionText, setQuestionText] = useState("");
  
  const MAX_REF_CHARS = 10000; 
  const MAX_Q_CHARS = 2000;    
  
  const [refMode, setRefMode] = useState("file");
  const [qMode, setQMode] = useState("file");

  const [showModal, setShowModal] = useState(false);
  const [processTitle, setProcessTitle] = useState("");
  const [processDescription, setProcessDescription] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");

  const PROCESS_STAGES = [
    "Initializing workspace",
    "Uploading to blob storage",
    "Awakening AI agents",
    "Redirecting to workspace",
  ];

  const getProcessStageIndex = (status) => {
    const normalized = (status || "").toLowerCase();
    if (normalized.includes("initializing")) return 0;
    if (normalized.includes("uploading")) return 1;
    if (normalized.includes("awakening") || normalized.includes("process")) return 2;
    if (normalized.includes("redirect")) return 3;
    return 0;
  };

  const refInputRef = useRef(null);
  const qInputRef = useRef(null);

  const SUPPORTED_EXTENSIONS = [".pdf", ".txt", ".md", ".png", ".jpg", ".jpeg", ".webp", ".bmp"];
  const ACCEPT_STRING = SUPPORTED_EXTENSIONS.join(",");

  const handleFileDrop = (e, type) => {
    e.preventDefault();
    const incomingFiles = Array.from(e.dataTransfer?.files || e.target?.files || []);
    if (!incomingFiles.length) return;

    const validFiles = [];
    const invalidFileNames = [];

    incomingFiles.forEach(file => {
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      if (SUPPORTED_EXTENSIONS.includes(ext)) {
        validFiles.push(file);
      } else {
        invalidFileNames.push(file.name);
      }
    });

    if (invalidFileNames.length > 0) {
      setError(`Unsupported format(s): ${invalidFileNames.join(", ")}. Please use PDF, TXT, MD, or supported Images.`);
      setTimeout(() => setError(""), 6000);
    }

    if (!validFiles.length) return;

    if (type === "reference") {
      setReferenceFiles((prev) => [...prev, ...validFiles]);
    } else {
      setQuestionFiles((prev) => [...prev, ...validFiles]);
    }
    
    if (e.target.value) e.target.value = '';
  };

  const removeFile = (index, type) => {
    if (type === "reference") {
      setReferenceFiles((prev) => prev.filter((_, i) => i !== index));
    } else {
      setQuestionFiles((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const createTextFile = (text, prefix) => {
    if (!text.trim()) return [];
    const blob = new Blob([text], { type: "text/plain" });
    return [new File([blob], `${prefix}_input_${Date.now()}.txt`, { type: "text/plain" })];
  };

  const handlePreflight = () => {
    if (!referenceFiles.length && !questionFiles.length && !referenceText.trim() && !questionText.trim()) {
      return setError("Please upload a document or enter text to proceed.");
    }

    if (!processTitle.trim()) {
      let defaultTitle = "Untitled Workspace";
      if (referenceFiles.length > 0) {
        defaultTitle = `Analysis: ${referenceFiles[0].name.split('.')[0]}`;
      } else if (questionFiles.length > 0) {
        defaultTitle = `Query: ${questionFiles[0].name.split('.')[0]}`;
      } else if (referenceText.trim()) {
        defaultTitle = "Text Analysis Workspace";
      }
      setProcessTitle(defaultTitle.replace(/[-_]/g, ' '));
    }

    setShowModal(true);
  };

  const handleStartProcess = async () => {
    const finalRefFiles = [...referenceFiles, ...createTextFile(referenceText, "reference")];
    const finalQuestionFiles = [...questionFiles, ...createTextFile(questionText, "question")];

    setIsProcessing(true);
    setError("");

    try {
      const userUuid = window.localStorage.getItem(LOCAL_STORAGE_KEYS.userUuid);
      if (!userUuid) throw new Error("User session not found. Please log in again.");

      // STEP 1: INITIALIZE & GET COLLECTION DIRECTORY
      setStatusText("Initializing workspace...");
      const initRes = await fetch("/api/agent/init-docu-process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          user_uuid: userUuid,
          text: processTitle.trim() || "Untitled Workspace",
          description: processDescription.trim() || ""
        }),
      });
      
      if (!initRes.ok) {
         const errData = await initRes.json().catch(() => ({}));
         throw new Error(errData.error || "Failed to initialize project.");
      }
      
      const { project_id, blob_collection } = await initRes.json();
      
      if (!blob_collection) throw new Error("Backend did not return a valid collection name for Vercel Blob.");

      const vercelUploadFolder = `${blob_collection}/input`;

      // STEP 2: UPLOAD TO BLOB (With better error catching)
      setStatusText("Uploading securely to blob storage...");
      const uploadFile = async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", vercelUploadFolder);
        
        const res = await fetch("/api/uploads/blob", { method: "POST", body: formData });
        
        // BETTER ERROR HANDLING HERE:
        if (!res.ok) {
           const errorData = await res.json().catch(() => ({}));
           throw new Error(errorData.message || `Failed to upload ${file.name} to Vercel Blob`);
        }
        
        const data = await res.json();
        return data.url; 
      };

      const reference_urls = await Promise.all(finalRefFiles.map(uploadFile));
      const question_urls = await Promise.all(finalQuestionFiles.map(uploadFile));

      // STEP 3: PROCESS AGENT
      setStatusText("Awakening AI Agents...");
      const processRes = await fetch("/api/agent/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id,
          user_uuid: userUuid,
          reference_urls,
          question_urls,
        }),
      });

      if (!processRes.ok) {
         const errData = await processRes.json().catch(() => ({}));
         throw new Error(errData.error || "Failed to start AI processing.");
      }

      setStatusText("DocuAgent Activated! Redirecting...");
      
      // Save URLs temporarily so the chat page can render them immediately in the sidebar
      sessionStorage.setItem(`session_refs_${project_id}`, JSON.stringify(reference_urls));
      sessionStorage.setItem(`session_qs_${project_id}`, JSON.stringify(question_urls));

      setTimeout(() => {
        setShowModal(false);
        router.push(`/dashboard/workspace?project=${project_id}`);
      }, 1000);

    } catch (err) {
      console.error("Agent Pipeline Error:", err);
      setError(err.message || "An unexpected error occurred.");
      setIsProcessing(false);
      setShowModal(false);
    }
  };

  const getFileIcon = (name) => {
    if (name.endsWith(".pdf")) return <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>;
    if (name.match(/\.(png|jpg|jpeg|webp|bmp)$/i)) return <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
    return <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">DocuAgent Workspace</h1>
          <p className="mt-2 text-slate-400 max-w-xl mx-auto">
            Provide your reference materials and questions. You can securely upload files or directly type your queries.
          </p>
        </div>

        {error && (
          <div className="mb-8 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200 animate-in fade-in">
            <svg className="h-5 w-5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <p>{error}</p>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          
          <div className="flex flex-col rounded-3xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-xl animate-in fade-in slide-in-from-left-4">
            <div className="mb-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                  </span>
                  Reference Data
                </h2>
                <p className="text-[11px] uppercase tracking-widest text-slate-500 mt-1">Provide Knowledge Base</p>
              </div>
              
              <div className="flex rounded-lg bg-black/40 p-1 border border-white/5 w-fit">
                <button onClick={() => setRefMode("text")} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${refMode === "text" ? "bg-white/10 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}>Text</button>
                <button onClick={() => setRefMode("file")} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${refMode === "file" ? "bg-white/10 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}>Files</button>
              </div>
            </div>

            {refMode === "file" ? (
              <>
                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleFileDrop(e, "reference")}
                  onClick={() => refInputRef.current.click()}
                  className="group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 bg-black/20 py-10 transition-all hover:border-violet-500/50 hover:bg-violet-500/5"
                >
                  <input type="file" ref={refInputRef} onChange={(e) => handleFileDrop(e, "reference")} className="hidden" multiple accept={ACCEPT_STRING} />
                  <div className="mb-3 rounded-full bg-white/5 p-3 text-slate-400 group-hover:text-violet-400 transition-colors">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  </div>
                  <p className="text-sm font-medium text-slate-200 group-hover:text-white">Click or drag files here</p>
                  <p className="mt-1 text-xs text-slate-500 text-center px-4 uppercase">
                    PDF, TXT, MD, PNG, JPG, WEBP, BMP
                  </p>
                </div>
                {referenceFiles.length > 0 && (
                  <div className="mt-4 flex flex-col gap-2 overflow-y-auto max-h-[160px] pr-2 custom-scrollbar">
                    {referenceFiles.map((file, i) => (
                      <div key={i} className="flex items-center justify-between rounded-xl border border-white/5 bg-black/40 p-3 animate-in fade-in zoom-in-95">
                        <div className="flex items-center gap-3 overflow-hidden">
                          {getFileIcon(file.name)}
                          <div className="truncate">
                            <p className="truncate text-xs font-medium text-slate-200">{file.name}</p>
                            <p className="text-[10px] text-slate-500">{formatSize(file.size)}</p>
                          </div>
                        </div>
                        <button onClick={() => removeFile(i, "reference")} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors rounded-lg hover:bg-white/5"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col flex-1 h-full animate-in fade-in zoom-in-95 relative">
                <textarea
                  value={referenceText}
                  onChange={(e) => setReferenceText(e.target.value)}
                  maxLength={MAX_REF_CHARS}
                  placeholder="Paste or type your reference context here..."
                  className={`w-full flex-1 min-h-[220px] rounded-2xl border bg-black/20 p-4 pb-8 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-all resize-none custom-scrollbar ${
                    referenceText.length >= MAX_REF_CHARS 
                      ? "border-red-500/50 focus:ring-red-500/50" 
                      : "border-white/10 focus:border-violet-500/50 focus:bg-white/5 focus:ring-1 focus:ring-violet-500/50"
                  }`}
                />
                <div className="absolute bottom-3 right-4 flex items-center justify-end pointer-events-none">
                  <span className={`text-[10px] font-mono tracking-wider ${referenceText.length >= MAX_REF_CHARS ? "text-red-400 font-bold" : "text-slate-500"}`}>
                    {referenceText.length.toLocaleString()} / {MAX_REF_CHARS.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col rounded-3xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-xl animate-in fade-in slide-in-from-right-4">
            <div className="mb-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </span>
                  Questions & Tasks
                </h2>
                <p className="text-[11px] uppercase tracking-widest text-slate-500 mt-1">What do you want to extract?</p>
              </div>

              <div className="flex rounded-lg bg-black/40 p-1 border border-white/5 w-fit">
                <button onClick={() => setQMode("text")} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${qMode === "text" ? "bg-white/10 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}>Text</button>
                <button onClick={() => setQMode("file")} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${qMode === "file" ? "bg-white/10 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}>Files</button>
              </div>
            </div>

            {qMode === "file" ? (
              <>
                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleFileDrop(e, "question")}
                  onClick={() => qInputRef.current.click()}
                  className="group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 bg-black/20 py-10 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/5"
                >
                  <input type="file" ref={qInputRef} onChange={(e) => handleFileDrop(e, "question")} className="hidden" multiple accept={ACCEPT_STRING} />
                  <div className="mb-3 rounded-full bg-white/5 p-3 text-slate-400 group-hover:text-emerald-400 transition-colors">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  </div>
                  <p className="text-sm font-medium text-slate-200 group-hover:text-white">Click or drag files here</p>
                  <p className="mt-1 text-xs text-slate-500 text-center px-4 uppercase">
                    PDF, TXT, MD, PNG, JPG, WEBP, BMP
                  </p>
                </div>
                {questionFiles.length > 0 && (
                  <div className="mt-4 flex flex-col gap-2 overflow-y-auto max-h-[160px] pr-2 custom-scrollbar">
                    {questionFiles.map((file, i) => (
                      <div key={i} className="flex items-center justify-between rounded-xl border border-white/5 bg-black/40 p-3 animate-in fade-in zoom-in-95">
                        <div className="flex items-center gap-3 overflow-hidden">
                          {getFileIcon(file.name)}
                          <div className="truncate">
                            <p className="truncate text-xs font-medium text-slate-200">{file.name}</p>
                            <p className="text-[10px] text-slate-500">{formatSize(file.size)}</p>
                          </div>
                        </div>
                        <button onClick={() => removeFile(i, "question")} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors rounded-lg hover:bg-white/5"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col flex-1 h-full animate-in fade-in zoom-in-95 relative">
                <textarea
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  maxLength={MAX_Q_CHARS}
                  placeholder="Ask a question or describe the task you want DocuAgent to perform..."
                  className={`w-full flex-1 min-h-[220px] rounded-2xl border bg-black/20 p-4 pb-8 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-all resize-none custom-scrollbar ${
                    questionText.length >= MAX_Q_CHARS 
                      ? "border-red-500/50 focus:ring-red-500/50" 
                      : "border-white/10 focus:border-emerald-500/50 focus:bg-white/5 focus:ring-1 focus:ring-emerald-500/50"
                  }`}
                />
                <div className="absolute bottom-3 right-4 flex items-center justify-end pointer-events-none">
                  <span className={`text-[10px] font-mono tracking-wider ${questionText.length >= MAX_Q_CHARS ? "text-red-400 font-bold" : "text-slate-500"}`}>
                    {questionText.length.toLocaleString()} / {MAX_Q_CHARS.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-4">
          <button
            onClick={handlePreflight}
            className="group relative flex w-full max-w-[320px] items-center justify-center gap-3 rounded-2xl bg-gradient-to-b from-violet-500 to-violet-600 px-8 py-4 text-base font-bold text-white shadow-[0_0_30px_rgba(139,92,246,0.3)] ring-1 ring-white/10 transition-all hover:from-violet-400 hover:to-violet-500 hover:shadow-[0_0_40px_rgba(139,92,246,0.5)] active:scale-[0.98]"
          >
            <span>Start DocuAgent</span>
            <svg className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-white text-violet-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </button>
        </div>

      </main>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a0c]/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#13131a] p-7 shadow-[0_0_50px_rgba(139,92,246,0.15)] animate-in zoom-in-95 duration-200">
            {isProcessing ? (
              <div className="py-2">
                <div className="mb-6 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-400/30 bg-violet-500/15 shadow-[0_0_30px_rgba(139,92,246,0.25)]">
                    <div className="relative h-8 w-8">
                      <span className="absolute inset-0 rounded-full border-2 border-violet-300/30" />
                      <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-300 border-r-cyan-300 animate-spin" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-white">Launching DocuAgent</h3>
                  <p className="mt-1 text-sm text-violet-200">{statusText || "Preparing workflow..."}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-300 transition-all duration-500"
                      style={{ width: `${((getProcessStageIndex(statusText) + 1) / PROCESS_STAGES.length) * 100}%` }}
                    />
                  </div>

                  <ul className="mt-4 space-y-2">
                    {PROCESS_STAGES.map((label, index) => {
                      const activeIndex = getProcessStageIndex(statusText);
                      const done = index < activeIndex;
                      const active = index === activeIndex;
                      return (
                        <li
                          key={label}
                          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
                            active
                              ? "bg-violet-500/15 text-violet-100"
                              : done
                                ? "text-emerald-200"
                                : "text-slate-500"
                          }`}
                        >
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${
                              done ? "bg-emerald-400" : active ? "bg-violet-300 animate-pulse" : "bg-slate-600"
                            }`}
                          />
                          {label}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Name Workspace</h3>
                    <p className="text-xs text-slate-400">Help organize your history.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                      Workspace Title <span className="text-red-400">*</span>
                    </label>
                    <input 
                      type="text" 
                      value={processTitle} 
                      onChange={(e) => setProcessTitle(e.target.value)} 
                      maxLength={100}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-violet-500/50 focus:bg-white/5 focus:ring-1 focus:ring-violet-500/50" 
                      placeholder="e.g., Financial Report Q3 Analysis"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                      Description (Optional)
                    </label>
                    <textarea 
                      value={processDescription} 
                      onChange={(e) => setProcessDescription(e.target.value)} 
                      maxLength={500}
                      className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-violet-500/50 focus:bg-white/5 focus:ring-1 focus:ring-violet-500/50 custom-scrollbar" 
                      placeholder="What is the main goal of this agent?"
                      rows="3" 
                    />
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-end gap-3">
                  <button 
                    onClick={() => setShowModal(false)} 
                    className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleStartProcess} 
                    disabled={!processTitle.trim()} 
                    className="group flex min-w-[140px] items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_15px_rgba(139,92,246,0.3)] transition-all hover:bg-violet-500 hover:shadow-[0_0_25px_rgba(139,92,246,0.5)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                  >
                    <>
                      Launch Agent
                      <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                    </>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(139, 92, 246, 0.5); }
      `}} />
    </div>
  );
}