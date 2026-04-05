'use client';

import { useState } from 'react';

export default function DashboardPage() {
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleProcess = async () => {
    setLoading(true);
    setResponse(null);
    try {
      // First API call
      const res1 = await fetch('http://127.0.0.1:8000/agent/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_uuid: "77aca8f0-4349-45b5-afff-52911031c0bf"
        }),
      });
      const data1 = await res1.json();

      // Second API call
      const res2 = await fetch('http://127.0.0.1:8000/agent/process/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            "user_uuid": "77aca8f0-4349-45b5-afff-52911031c0bf",
            "project_id": data1.project_id,
            "reference_urls":["https://ycppnqqer6rwwoag.private.blob.vercel-storage.com/collection_man_28ce/input/ALL%20UNIT%20.pdf"],
            "question_urls":"https://ycppnqqer6rwwoag.private.blob.vercel-storage.com/collection_man_28ce/input/Screenshot%202026-04-04%20200611.png"
        }),
      });
      const data2 = await res2.json();
      setResponse(data2);
    } catch (error) {
      console.error('Error processing documents:', error);
      setResponse({ error: 'Failed to process documents.' });
    }
    setLoading(false);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-white">Dashboard</h1>
      <p className="mt-2 text-sm text-slate-300">Run your document pipeline and monitor generated project metadata.</p>

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold text-white">Document Processing</h2>
        <p className="mt-2 text-sm text-slate-300">
          Click the button to start processing the documents. This will initiate a two-step process.
        </p>
        <button
          onClick={handleProcess}
          disabled={loading}
          className="brand-chip neon-purple mt-4 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? 'Processing...' : 'Process Documents'}
        </button>
      </section>

      {response && (
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-xl font-semibold text-white">Processing Result</h3>
          {response.error ? (
            <p className="mt-3 text-red-300">{response.error}</p>
          ) : (
            <div className="mt-3 space-y-2 text-sm text-slate-200">
              <p className="text-emerald-300">{response.message}</p>
              <p><span className="font-semibold text-slate-100">Project ID:</span> {response.project_id}</p>
              <p><span className="font-semibold text-slate-100">Task ID:</span> {response.task_id}</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

