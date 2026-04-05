import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="glass-panel w-full max-w-5xl rounded-3xl p-8 md:p-12">
        <header className="mb-12 flex items-center justify-between">
          <BrandLogo />
          <div className="flex items-center gap-3 text-sm font-medium text-slate-300">
            <Link href="/login" className="rounded-xl border border-white/20 px-4 py-2 hover:border-white/50">
              Login
            </Link>
            <Link href="/dashboard" className="brand-chip neon-purple rounded-xl px-4 py-2 text-white">
              Open Dashboard
            </Link>
          </div>
        </header>

        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">AI Knowledge Workspace</p>
            <h1 className="text-4xl font-bold leading-tight text-white md:text-5xl">
              Search, chat, and map your documents in one place.
            </h1>
            <p className="text-base text-slate-300">
              DocuGyan turns scattered files into a connected knowledge graph with fast AI-assisted reasoning.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard/chat" className="brand-chip neon-purple rounded-xl px-5 py-3 text-sm font-semibold text-white">
                Start AI Chat
              </Link>
              <Link href="/dashboard" className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-slate-100 hover:border-white/50">
                Explore Dashboard
              </Link>
            </div>
          </div>
          <div className="glass-panel rounded-2xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Live Snapshot</p>
              <span className="text-xs text-slate-400">Updated now</span>
            </div>
            <div className="space-y-4 text-sm">
              <div className="rounded-xl border border-white/10 p-4">
                <p className="text-slate-400">Processed Documents</p>
                <p className="mt-1 text-2xl font-bold text-white">1,248</p>
              </div>
              <div className="rounded-xl border border-white/10 p-4">
                <p className="text-slate-400">Knowledge Connections</p>
                <p className="mt-1 text-2xl font-bold text-white">32.4k</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
