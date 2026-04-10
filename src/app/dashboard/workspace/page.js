"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import WorkspaceSidebar from "@/components/sidebar/WorkspaceSidebar";

/**
 * Helper to extract a clean filename from a Vercel Blob URL 
 * (Kept here for the main header display)
 */
const getFilenameFromUrl = (url) => {
  try {
    const parsed = new URL(url, window.location.origin);
    const isProxyPath = parsed.pathname.endsWith('/api/uploads/blob') || parsed.pathname.endsWith('/blob');
    const nestedSource = isProxyPath ? parsed.searchParams.get('url') : null;
    const sourceUrl = nestedSource ? new URL(nestedSource) : parsed;
    const rawName = decodeURIComponent(sourceUrl.pathname.split("/").pop() || "Unknown File");

    const extensionMatch = rawName.match(/\.([a-z0-9]+)$/i);
    const extension = extensionMatch?.[1];
    const base = rawName
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/^\d+[-_]/, "")
      .replace(/^[a-f0-9]{8,}[-_]/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/[\s_-]+[A-Za-z0-9]{16,}$/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!base) {
      return "Document";
    }

    return extension ? `${base}.${extension.toLowerCase()}` : base;
  } catch {
    return "Document";
  }
};

function WorkspaceContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");

  const [referenceUrls, setReferenceUrls] = useState([]);
  const [questionUrls, setQuestionUrls] = useState([]);
  const [activeFile, setActiveFile] = useState(null);

  useEffect(() => {
    if (!projectId) return;

    // Retrieve the uploaded blob URLs from session storage
    try {
      const storedRefs = sessionStorage.getItem(`session_refs_${projectId}`);
      const storedQs = sessionStorage.getItem(`session_qs_${projectId}`);
      
      const parsedRefs = storedRefs ? JSON.parse(storedRefs) : [];
      const parsedQs = storedQs ? JSON.parse(storedQs) : [];

      setReferenceUrls(parsedRefs);
      setQuestionUrls(parsedQs);

      // Auto-select the first file to display by default
      if (parsedRefs.length > 0) {
        setActiveFile(parsedRefs[0]);
      } else if (parsedQs.length > 0) {
        setActiveFile(parsedQs[0]);
      }
    } catch (e) {
      console.error("Failed to load workspace files from session.", e);
    }
  }, [projectId]);

  return (
    <div className="flex h-[calc(100vh-65px)] w-full bg-[#0a0a0c] font-display text-slate-100 overflow-hidden">
      
      {/* MODULAR SIDEBAR Component */}
      <WorkspaceSidebar 
        projectId={projectId}
        referenceUrls={referenceUrls}
        questionUrls={questionUrls}
        activeFile={activeFile}
        onFileSelect={setActiveFile}
      />

      {/* MAIN CONTENT AREA: File Viewer & Agent Insights */}
      <main className="flex-1 flex flex-col relative bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-violet-900/5 via-[#0a0a0c] to-[#0a0a0c]">
        
        {/* Workspace Header */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-black/20 backdrop-blur-md">
           <div className="flex items-center gap-3">
              {activeFile && (
                <>
                  <span className="px-2.5 py-1 rounded-lg bg-violet-500/10 text-[10px] font-bold uppercase tracking-widest text-violet-400 border border-violet-500/20">
                    Active View
                  </span>
                  <span className="text-sm font-medium text-slate-200">{getFilenameFromUrl(activeFile)}</span>
                  <a 
                    href={activeFile} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-all ml-2" 
                    title="Open Source in New Tab"
                  >
                     <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                     </svg>
                  </a>
                </>
              )}
           </div>
           
           <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                DocuAgent Live
              </div>
           </div>
        </header>

        {/* Document Viewer Frame */}
        <div className="flex-1 p-6 relative overflow-hidden">
          {activeFile ? (
             <div className="w-full h-full rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden shadow-2xl relative group">
                {/* Image Detection & Rendering */}
                {activeFile.match(/\.(png|jpg|jpeg|webp|bmp)$/i) ? (
                  <div className="w-full h-full flex items-center justify-center bg-black/40 p-8">
                    <img 
                      src={activeFile} 
                      alt="Workspace Preview" 
                      className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-white/5" 
                    />
                  </div>
                ) : (
                  /* PDF / TXT / MD Rendering */
                  <iframe 
                    src={activeFile} 
                    className="w-full h-full border-0 bg-white" 
                    title="Document Preview"
                  />
                )}
             </div>
          ) : (
            /* Empty State */
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 space-y-4 animate-in fade-in duration-500">
               <div className="h-20 w-20 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                 <svg className="h-10 w-10 opacity-30 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                 </svg>
               </div>
               <div className="text-center">
                 <p className="text-slate-300 font-medium">No Document Selected</p>
                 <p className="text-sm opacity-50 mt-1">Select a reference or question from the sidebar to view it.</p>
               </div>
            </div>
          )}
        </div>

      </main>

      {/* Global Scrollbar Customization for Workspace */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(139, 92, 246, 0.5); }
      `}} />
    </div>
  );
}

/**
 * Main Page Wrapper with Suspense boundary
 */
export default function WorkspacePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0c]">
        <div className="relative flex items-center justify-center">
          <div className="absolute h-16 w-16 rounded-full border-2 border-violet-500/20 border-t-violet-500 animate-spin"></div>
          <svg className="h-8 w-8 text-violet-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <p className="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-slate-500 animate-pulse">Initializing Environment</p>
      </div>
    }>
      <WorkspaceContent />
    </Suspense>
  );
}