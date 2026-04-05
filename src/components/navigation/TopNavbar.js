'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import BrandLogo from '@/components/BrandLogo';
import { LOCAL_STORAGE_KEYS, clearStoredProcessState } from '@/lib/api/docuApi';

const navItems = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Graph View', href: '/dashboard/chat' },
  { label: 'Models' },
  { label: 'Team' },
];

function SearchIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

export default function TopNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
      clearStoredProcessState();
      window.localStorage.removeItem(LOCAL_STORAGE_KEYS.userUuid);
      window.localStorage.removeItem(LOCAL_STORAGE_KEYS.accessToken);
    } finally {
      router.push('/login');
      router.refresh();
      setLoggingOut(false);
    }
  };

  return (
    <header className="glass-panel border-white/15 px-4 py-3 md:px-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-8">
          <BrandLogo href="/dashboard" />
          <nav className="hidden items-center gap-2 lg:flex">
            {navItems.map((item) => {
              const active = !!item.href && pathname === item.href;
              const classes = `relative rounded-lg px-3 py-2 text-[1.05rem] font-semibold transition-colors ${
                active ? 'text-white' : 'text-slate-400 hover:text-slate-100'
              }`;

              if (item.href) {
                return (
                  <Link key={item.label} href={item.href} className={classes}>
                    {item.label}
                    {active && (
                      <span className="absolute inset-x-3 -bottom-0.5 h-[2px] rounded-full bg-gradient-to-r from-violet-500 to-indigo-500" />
                    )}
                  </Link>
                );
              }

              return (
                <button key={item.label} type="button" className={classes}>
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <label className="relative hidden w-56 lg:block xl:w-80">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              placeholder="Search knowledge..."
              className="w-full rounded-full border border-white/10 bg-white/[0.05] py-2 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500/60 focus:outline-none"
            />
          </label>

          <button className="inline-flex items-center gap-2 rounded-xl border border-violet-300/20 bg-gradient-to-r from-violet-600 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_24px_rgba(124,58,237,0.35)]">
            <span aria-hidden="true">⚡</span>
            <span>Pro</span>
          </button>

          <button
            aria-label="User profile"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-300/40 bg-[#231b26] text-sm font-semibold text-amber-100"
          >
            N
          </button>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-xl border border-white/20 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-white/40 disabled:opacity-60"
          >
            {loggingOut ? 'Signing out...' : 'Logout'}
          </button>
        </div>
      </div>

      <nav className="mt-3 flex gap-1 overflow-x-auto pb-1 lg:hidden">
        {navItems.map((item) => {
          const active = !!item.href && pathname === item.href;
          const classes = `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${
            active ? 'bg-violet-500/20 text-violet-200' : 'text-slate-400'
          }`;

          if (item.href) {
            return (
              <Link key={`${item.label}-mobile`} href={item.href} className={classes}>
                {item.label}
              </Link>
            );
          }

          return (
            <button key={`${item.label}-mobile`} type="button" className={classes}>
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
