"use client";

import Link from "next/link";
import { useState } from "react";
import { LOCAL_STORAGE_KEYS } from "@/lib/api/docuApi";

export default function DashboardPage() {
  const [userUuid] = useState(() => (typeof window === "undefined" ? "" : (window.localStorage.getItem(LOCAL_STORAGE_KEYS.userUuid) ?? "")));
  const [projectId] = useState(() => (typeof window === "undefined" ? "" : (window.localStorage.getItem(LOCAL_STORAGE_KEYS.projectId) ?? "")));
  const [taskId] = useState(() => (typeof window === "undefined" ? "" : (window.localStorage.getItem(LOCAL_STORAGE_KEYS.taskId) ?? "")));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-300">Use the integration wizard to run auth, uploads, and agent processing.</p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold text-white">Current Session</h2>
        <div className="mt-3 space-y-1 text-sm text-slate-300">
          <p>user_uuid: {userUuid || "-"}</p>
          <p>project_id: {projectId || "-"}</p>
          <p>task_id: {taskId || "-"}</p>
        </div>
      </section>

      <Link href="/dashboard/agent" className="brand-chip neon-purple inline-flex rounded-xl px-5 py-3 text-sm font-semibold text-white">
        Open 5-Step Wizard
      </Link>
    </div>
  );
}
