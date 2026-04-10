'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import BrandLogo from '@/components/BrandLogo';
import { LOCAL_STORAGE_KEYS, clearStoredProcessState } from '@/lib/api/docuApi';

// Updated Navigation Items
const navItems = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'DocuAgent', href: '/dashboard/agent' },
];

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
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0f0f14]/80 px-4 py-3 backdrop-blur-xl md:px-6">
      <div className="flex items-center gap-4">
        
        {/* Left Side: Logo & Desktop Navigation */}
        <div className="flex items-center gap-8">
          <BrandLogo href="/dashboard" />
          
          <nav className="hidden items-center gap-2 lg:flex">
            {navItems.map((item) => {
              const active = !!item.href && pathname === item.href;
              const classes = `relative rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                active ? 'text-white' : 'text-slate-400 hover:text-slate-100'
              }`;

              if (item.href) {
                return (
                  <Link key={item.label} href={item.href} className={classes}>
                    {item.label}
                    {active && (
                      <span className="absolute inset-x-3 -bottom-0.5 h-[2px] rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
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

        {/* Right Side: Search, Actions & Profile */}
        <div className="ml-auto flex items-center gap-3 md:gap-4">
          
          {/* Search Input */}
          <div className="group relative hidden w-56 lg:block xl:w-72">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              placeholder="Search knowledge..."
              className="w-full rounded-full border border-white/5 bg-white/5 py-1.5 pl-9 pr-4 text-sm text-white placeholder:text-slate-500 transition-all focus:border-violet-500/50 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
            />
          </div>

          {/* Pro Button */}
          <button className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-bold text-white shadow-[0_0_15px_rgba(139,92,246,0.4)] transition-all hover:bg-violet-500 hover:shadow-[0_0_20px_rgba(139,92,246,0.6)] active:scale-95">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            <span>Pro</span>
          </button>

          {/* User Avatar Placeholder */}
          <div className="cursor-pointer rounded-full border border-violet-500/50 p-0.5 shadow-[0_0_10px_rgba(139,92,246,0.2)] transition-transform hover:scale-105">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-slate-800 to-slate-700">
               <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
            </div>
          </div>

          {/* Logout Button */}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loggingOut ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-white" />
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            )}
            <span className="hidden sm:inline">{loggingOut ? '...' : 'Logout'}</span>
          </button>

        </div>
      </div>

      {/* Mobile Navigation */}
      <nav className="mt-3 flex gap-1 overflow-x-auto pb-1 lg:hidden [&::-webkit-scrollbar]:hidden">
        {navItems.map((item) => {
          const active = !!item.href && pathname === item.href;
          const classes = `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            active ? 'bg-violet-500/20 text-violet-200 border border-violet-500/30' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
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