import Link from "next/link";
import { faqItems, getHelpTopics, supportChannels } from "@/lib/help/helpCenterData";

export default function HelpHomePage() {
  const topics = getHelpTopics();
  const quickFaq = faqItems.slice(0, 3);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-[linear-gradient(155deg,rgba(17,20,33,0.98),rgba(12,12,18,0.95))] p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">DocuGyan Help Center</p>
        <h1 className="mt-3 text-3xl font-bold text-white md:text-4xl">Find answers by route, workflow, or issue type</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          This help center is available for everyone. Logged-in users and visitors can both access all help routes.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/help/faq" className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-white/40">
            View FAQ
          </Link>
          <Link href="/help/contact" className="brand-chip rounded-xl px-4 py-2 text-sm font-semibold text-white">
            Contact Support
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">Guides</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {topics.map((topic) => (
            <Link
              key={topic.slug}
              href={`/help/${topic.slug}`}
              className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-violet-400/40 hover:bg-white/[0.05]"
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-lg font-semibold text-white">{topic.title}</h3>
                <span className="rounded-full border border-white/15 px-2 py-1 text-xs text-slate-300">{topic.readTime}</span>
              </div>
              <p className="mt-2 text-sm text-slate-300">{topic.summary}</p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-violet-300 group-hover:text-violet-200">
                Open guide
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="text-lg font-semibold text-white">Common questions</h3>
          <div className="mt-4 space-y-3">
            {quickFaq.map((item) => (
              <div key={item.question} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-sm font-semibold text-slate-100">{item.question}</p>
                <p className="mt-1 text-sm text-slate-300">{item.answer}</p>
              </div>
            ))}
          </div>
          <Link href="/help/faq" className="mt-4 inline-block text-sm font-semibold text-violet-300 hover:text-violet-200">
            See all FAQ
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="text-lg font-semibold text-white">Support channels</h3>
          <div className="mt-4 space-y-3">
            {supportChannels.map((channel) => (
              <div key={channel.title} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-sm font-semibold text-slate-100">{channel.title}</p>
                <p className="mt-1 text-sm text-violet-300">{channel.detail}</p>
                <p className="mt-1 text-sm text-slate-300">{channel.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
