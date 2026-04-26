import Link from "next/link";
import { faqItems } from "@/lib/help/helpCenterData";

export default function HelpFaqPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-[linear-gradient(150deg,rgba(17,20,33,0.97),rgba(12,12,18,0.95))] p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Frequently Asked Questions</p>
        <h1 className="mt-3 text-3xl font-bold text-white md:text-4xl">FAQ</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Fast answers for the most common issues across authentication, uploads, and workspace processing.
        </p>
      </section>

      <section className="space-y-3">
        {faqItems.map((item) => (
          <details key={item.question} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" open={false}>
            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-100">{item.question}</summary>
            <p className="mt-3 text-sm text-slate-300">{item.answer}</p>
          </details>
        ))}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold text-white">Need more help?</h2>
        <p className="mt-2 text-sm text-slate-300">If this did not solve your issue, contact support with the affected steps and workspace details.</p>
        <Link href="/help/contact" className="mt-4 inline-block rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-white/40">
          Contact Support
        </Link>
      </section>
    </div>
  );
}
