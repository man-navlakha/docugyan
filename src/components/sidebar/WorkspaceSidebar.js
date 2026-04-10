'use client';

function resolveSourceUrl(url) {
  try {
    const parsed = new URL(url, window.location.origin);
    const looksLikeProxyPath = parsed.pathname.endsWith('/api/uploads/blob') || parsed.pathname.endsWith('/blob');
    const nested = parsed.searchParams.get('url');

    if (looksLikeProxyPath && nested) {
      return nested;
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function stripRandomSuffix(baseName) {
  return baseName
    .replace(/[\s_-]+[A-Za-z0-9]{16,}$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFileParts(url) {
  try {
    const resolved = resolveSourceUrl(url);
    const parsed = new URL(resolved, window.location.origin);
    const rawSegment = decodeURIComponent(parsed.pathname.split('/').pop() || 'document');
    const extensionMatch = rawSegment.match(/\.([a-z0-9]+)$/i);
    const extension = extensionMatch?.[1]?.toLowerCase() || 'file';
    const nameWithoutExt = rawSegment.replace(/\.[a-z0-9]+$/i, '');

    const cleanedBase = stripRandomSuffix(
      nameWithoutExt
      .replace(/^\d+[-_]/, '')
      .replace(/^[a-f0-9]{8,}[-_]/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    );

    const displayName = extensionMatch
      ? `${cleanedBase || 'Untitled Document'}.${extension}`
      : cleanedBase || 'Untitled Document';

    return {
      displayName,
      extension,
    };
  } catch {
    return {
      displayName: 'Untitled Document',
      extension: 'file',
    };
  }
}

function getTypeLabel(extension) {
  if (extension === 'pdf') return 'PDF';
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(extension)) return 'Image';
  if (['doc', 'docx', 'txt', 'md'].includes(extension)) return extension.toUpperCase();
  return 'File';
}

function FileIcon({ url }) {
  const resolved = resolveSourceUrl(url);
  const isImage = resolved.match(/\.(png|jpg|jpeg|webp|bmp)(?:$|\?)/i);
  const isPdf = resolved.match(/\.pdf(?:$|\?)/i);

  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
      isPdf ? 'bg-red-500/20 text-red-400' : isImage ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-500/20 text-slate-400'
    }`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path d="M8 3h6l5 5v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
        <path d="M14 3v6h6" />
      </svg>
    </div>
  );
}

export default function WorkspaceSidebar({ 
  projectId, 
  referenceUrls = [], 
  questionUrls = [], 
  activeFile, 
  onFileSelect 
}) {
  const FileItem = ({ url, label }) => {
    const isActive = activeFile === url;
    const fileInfo = extractFileParts(url);
    const typeLabel = getTypeLabel(fileInfo.extension);

    return (
      <button
        onClick={() => onFileSelect(url)}
        className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
          isActive 
            ? 'bg-violet-500/15 border border-violet-500/30 shadow-sm' 
            : 'border border-transparent hover:bg-white/5'
        }`}
      >
        <FileIcon url={url} />
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-semibold ${isActive ? 'text-violet-200' : 'text-slate-300'}`}>
            {fileInfo.displayName}
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
              {typeLabel}
            </span>
            <p className="truncate text-[10px] text-slate-500 uppercase tracking-tight">{label}</p>
          </div>
        </div>
      </button>
    );
  };

  return (
    <aside className="hidden w-80 shrink-0 flex-col border-r border-white/10 bg-[#0f0f14]/80 backdrop-blur-xl lg:flex">
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/20 text-violet-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
              <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-white">Files</h2>
            <p className="text-[9px] text-slate-500 font-mono">ID: {projectId?.split('-')[0]}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {referenceUrls.length > 0 && (
          <section>
            <h3 className="mb-3 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Reference Materials</h3>
            <div className="space-y-1">
              {referenceUrls.map((url, i) => (
                <FileItem key={i} url={url} label="Knowledge Source" />
              ))}
            </div>
          </section>
        )}

        {questionUrls.length > 0 && (
          <section>
            <h3 className="mb-3 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Questions</h3>
            <div className="space-y-1">
              {questionUrls.map((url, i) => (
                <FileItem key={i} url={url} label="Query File" />
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="mt-auto p-4 border-t border-white/5">
        <div className="rounded-2xl bg-gradient-to-br from-violet-600/10 to-indigo-600/10 border border-violet-500/10 p-4">
          <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-2">Agent Status</p>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-slate-200">Processing Knowledge</span>
          </div>
        </div>
      </div>
    </aside>
  );
}