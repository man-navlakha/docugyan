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

function OpenInNewTabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
      <path d="M14 4h6v6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 14L20 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function WorkspaceSidebar({
  projectId,
  resultUrls = [],
  referenceUrls = [],
  questionUrls = [],
  finalAnswerUrl = '',
  activeFile,
  onFileSelect,
}) {
  const totalDocuments = resultUrls.length + referenceUrls.length + questionUrls.length + (finalAnswerUrl ? 1 : 0);
  const activeFileName = activeFile ? extractFileParts(activeFile).displayName : '';

  const renderFileItem = (url, label, key) => {
    const isActive = activeFile === url;
    const fileInfo = extractFileParts(url);
    const typeLabel = getTypeLabel(fileInfo.extension);

    return (
      <button
        key={key}
        onClick={() => onFileSelect(url)}
        className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
          isActive ? 'border border-violet-500/30 bg-violet-500/15 shadow-sm' : 'border border-transparent hover:bg-white/5'
        }`}
      >
        <FileIcon url={url} />
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-semibold ${isActive ? 'text-violet-200' : 'text-slate-300'}`}>{fileInfo.displayName}</p>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
              {typeLabel}
            </span>
            <p className="truncate text-[10px] uppercase tracking-tight text-slate-500">{label}</p>
          </div>
        </div>

        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 text-slate-400 transition-colors hover:border-white/30 hover:text-white"
          title="Open in new tab"
          aria-label="Open in new tab"
        >
          <OpenInNewTabIcon />
        </a>
      </button>
    );
  };

  return (
    <aside className="hidden w-80 shrink-0 flex-col border-r border-white/10 bg-[#0f0f14]/80 backdrop-blur-xl lg:flex">
      <div className="border-b border-white/10 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/20 text-violet-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
              <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-white">Files</h2>
            <p className="font-mono text-[9px] text-slate-500">ID: {projectId?.split('-')[0]}</p>
          </div>
        </div>
      </div>

      <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-4">
        {finalAnswerUrl && (
          <section>
            <h3 className="mb-3 px-2 text-[10px] font-bold uppercase tracking-widest text-violet-300">Final Answer</h3>
            <div className="space-y-1">{renderFileItem(finalAnswerUrl, 'Final Answer', 'final-answer')}</div>
          </section>
        )}

        {resultUrls.length > 0 && (
          <section>
            <h3 className="mb-3 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Results</h3>
            <div className="space-y-1">{resultUrls.map((url, i) => renderFileItem(url, 'Generated Output', `result-${i}`))}</div>
          </section>
        )}

        {referenceUrls.length > 0 && (
          <section>
            <h3 className="mb-3 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Reference Materials</h3>
            <div className="space-y-1">{referenceUrls.map((url, i) => renderFileItem(url, 'Knowledge Source', `ref-${i}`))}</div>
          </section>
        )}

        {questionUrls.length > 0 && (
          <section>
            <h3 className="mb-3 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Questions</h3>
            <div className="space-y-1">{questionUrls.map((url, i) => renderFileItem(url, 'Query File', `q-${i}`))}</div>
          </section>
        )}
      </div>

      <div className="mt-auto border-t border-white/5 p-4">
        <div className="rounded-2xl border border-violet-400/20 bg-[linear-gradient(145deg,rgba(22,18,38,0.95),rgba(18,18,28,0.92))] p-4 shadow-[0_0_24px_rgba(139,92,246,0.14)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300/85">Workspace Summary</p>
          <p className="mt-2 text-sm font-bold text-slate-100">
            {totalDocuments} Document{totalDocuments === 1 ? '' : 's'}
          </p>
          <p className="mt-1 truncate text-xs text-slate-300/90">
            {activeFileName ? `Selected: ${activeFileName}` : 'Select a document to preview'}
          </p>
        </div>
      </div>
    </aside>
  );
}
