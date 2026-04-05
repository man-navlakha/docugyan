'use client';

const recentDocuments = [
  {
    name: 'Quarterly_Report.pdf',
    status: 'Processed',
    size: '2.4MB',
    tone: 'violet',
    active: true,
  },
  {
    name: 'Project_Scope_v2.docx',
    status: 'Indexed',
    size: '1.1MB',
    tone: 'blue',
  },
  {
    name: 'Market_Analysis_2024.d...',
    status: 'Queued',
    size: '4.8MB',
    tone: 'slate',
  },
];

function UploadIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M12 16V8" />
      <path d="m8.5 11.5 3.5-3.5 3.5 3.5" />
      <path d="M20 16.8a4.8 4.8 0 0 0-3.1-8.5A6 6 0 0 0 5.2 9.6 4.2 4.2 0 0 0 5 18h12.8" />
    </svg>
  );
}

function FileIcon({ tone }) {
  const tones = {
    violet: 'bg-violet-500/20 text-violet-300',
    blue: 'bg-blue-500/20 text-blue-300',
    slate: 'bg-slate-500/25 text-slate-300',
  };

  return (
    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${tones[tone] ?? tones.slate}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true">
        <path d="M8 3h6l5 5v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
        <path d="M14 3v6h6" />
        <path d="M10 13h4M10 17h4" />
      </svg>
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside className="glass-panel hidden w-[355px] min-w-[320px] min-h-[calc(100vh-7.5rem)] flex-col rounded-2xl p-4 lg:flex">
      <div>
        <button
          type="button"
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-5 text-lg font-semibold text-slate-200 transition-colors hover:bg-white/[0.08]"
        >
          <UploadIcon className="h-5 w-5 text-violet-400" />
          <span>Upload New File</span>
        </button>

        <p className="mt-7 px-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Recent Documents</p>

        <div className="mt-3 space-y-3">
          {recentDocuments.map((doc) => (
            <article
              key={doc.name}
              className={`rounded-2xl border px-3 py-3 ${
                doc.active ? 'border-violet-500/45 bg-violet-500/14' : 'border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <FileIcon tone={doc.tone} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[1.05rem] font-semibold text-slate-100">{doc.name}</p>
                  <p className="mt-0.5 text-sm text-slate-400">
                    {doc.status} · {doc.size}
                  </p>
                </div>
                {doc.active && (
                  <button type="button" className="rounded p-1 text-slate-500 hover:text-slate-300" aria-label="More options">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                      <circle cx="12" cy="5" r="1.6" />
                      <circle cx="12" cy="12" r="1.6" />
                      <circle cx="12" cy="19" r="1.6" />
                    </svg>
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-auto rounded-2xl border border-white/10 bg-gradient-to-br from-violet-600/15 to-blue-600/15 p-4">
        <p className="text-[1.75rem] font-semibold text-slate-100">Storage Usage</p>
        <div className="mt-3 h-2 rounded-full bg-white/10">
          <div className="h-2 w-[68%] rounded-full bg-gradient-to-r from-violet-500 to-blue-500" />
        </div>
        <p className="mt-3 text-sm italic text-slate-400">652MB of 1GB Used</p>
      </div>
    </aside>
  );
}
