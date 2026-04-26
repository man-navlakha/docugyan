import Link from "next/link";
import { notFound } from "next/navigation";
import { getHelpTopic, getHelpTopics, getRelatedTopics } from "@/lib/help/helpCenterData";

export function generateStaticParams() {
  return getHelpTopics().map((topic) => ({
    topic: topic.slug,
  }));
}

export default async function HelpTopicPage({ params }) {
  const { topic } = await params;
  const currentTopic = getHelpTopic(topic);

  if (!currentTopic) {
    notFound();
  }

  const relatedTopics = getRelatedTopics(topic, 3);

  return (
    <article className="space-y-6">
      <header className="rounded-3xl border border-white/10 bg-[linear-gradient(150deg,rgba(17,20,33,0.97),rgba(12,12,18,0.95))] p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Help Topic</p>
        <h1 className="mt-3 text-3xl font-bold text-white md:text-4xl">{currentTopic.title}</h1>
        <p className="mt-3 max-w-3xl text-slate-300">{currentTopic.summary}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-300">{currentTopic.readTime}</span>
          <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-300">{currentTopic.audience}</span>
        </div>
      </header>

      <section className="space-y-4">
        {currentTopic.sections.map((section) => (
          <div key={section.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-semibold text-white">{section.title}</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {section.items.map((item) => (
                <li key={item} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold text-white">Quick actions</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {currentTopic.quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:border-white/40"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold text-white">Related topics</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {relatedTopics.map((relatedTopic) => (
            <Link
              key={relatedTopic.slug}
              href={`/help/${relatedTopic.slug}`}
              className="rounded-xl border border-white/10 bg-black/20 p-3 transition-colors hover:border-violet-400/40"
            >
              <p className="text-sm font-semibold text-slate-100">{relatedTopic.title}</p>
              <p className="mt-1 text-xs text-slate-400">{relatedTopic.readTime}</p>
            </Link>
          ))}
        </div>
      </section>
    </article>
  );
}
