import Link from "next/link";
import { supportChannels } from "@/lib/help/helpCenterData";

const responseGuidelines = [
  "Share exact steps that trigger the issue.",
  "Include the route URL and timestamp of failure.",
  "Attach workspace/project ID when reporting processing problems.",
  "Mention whether issue happens for one file or every upload.",
];

export default function HelpContactPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-[linear-gradient(150deg,rgba(17,20,33,0.97),rgba(12,12,18,0.95))] p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Support</p>
        <h1 className="mt-3 text-3xl font-bold text-white md:text-4xl">Contact the Help Team</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Use the channels below to report issues or request guidance. This page is publicly accessible for both logged-in and logged-out users.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {supportChannels.map((channel) => (
          <div key={channel.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm font-semibold text-white">{channel.title}</p>
            <p className="mt-2 text-base font-semibold text-violet-300">{channel.detail}</p>
            <p className="mt-2 text-sm text-slate-300">{channel.note}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold text-white">Before sending a ticket</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          {responseGuidelines.map((item) => (
            <li key={item} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold text-white">Useful routes</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/help" className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-white/40">
            Help Home
          </Link>
          <Link href="/help/troubleshooting" className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-white/40">
            Troubleshooting
          </Link>
          <Link href="/dashboard/agent" className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-white/40">
            DocuAgent
          </Link>
        </div>
      </section>
    </div>
  );
}
