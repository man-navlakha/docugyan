import Link from "next/link";
import { cookies } from "next/headers";
import BrandLogo from "@/components/BrandLogo";
import { ACCESS_COOKIE_NAME } from "@/lib/auth/config";
import { helpNavigationLinks } from "@/lib/help/helpCenterData";

export default async function HelpLayout({ children }) {
  const cookieStore = await cookies();
  const isAuthenticated = Boolean(cookieStore.get(ACCESS_COOKIE_NAME)?.value);
  const primaryAction = isAuthenticated
    ? { href: "/dashboard/agent", label: "Back to Dashboard" }
    : { href: "/login", label: "Login" };

  return (
    <div className="relative min-h-screen bg-[#090a11] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(59,130,246,0.14),transparent_30%),radial-gradient(circle_at_90%_90%,rgba(139,92,246,0.18),transparent_40%)]" />

      <header className="relative z-10 border-b border-white/10 bg-[#0c0d14]/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-4 md:px-6">
          <BrandLogo href={isAuthenticated ? "/dashboard/agent" : "/"} />
          <nav className="ml-auto hidden items-center gap-2 text-sm md:flex">
            <Link href="/help" className="rounded-lg px-3 py-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
              Help Home
            </Link>
            <Link href="/help/faq" className="rounded-lg px-3 py-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
              FAQ
            </Link>
            <Link href="/help/contact" className="rounded-lg px-3 py-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
              Contact
            </Link>
          </nav>
          <Link
            href={primaryAction.href}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:border-white/40"
          >
            {primaryAction.label}
          </Link>
        </div>
      </header>

      <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 md:px-6 lg:grid-cols-[280px_1fr]">
        <aside className="h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Help Routes</p>
          <p className="mt-2 text-sm text-slate-300">Browse full guides for login, workspace flow, and troubleshooting.</p>

          <nav className="mt-4 space-y-1">
            {helpNavigationLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-lg border border-transparent px-3 py-2 text-sm text-slate-300 transition-colors hover:border-white/15 hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">{children}</section>
      </div>
    </div>
  );
}
