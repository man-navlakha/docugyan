'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import BrandLogo from '@/components/BrandLogo';
import { LOCAL_STORAGE_KEYS, clearStoredProcessState, fetchDocuProcessList, fetchUserProfile } from '@/lib/api/docuApi';

function toStatusColor(status) {
  const normalized = (status || "").toLowerCase();
  if (normalized.includes("fail") || normalized.includes("error")) return "bg-red-500";
  if (normalized.includes("complete") || normalized.includes("success") || normalized.includes("done")) return "bg-emerald-500";
  if (normalized.includes("progress") || normalized.includes("running") || normalized.includes("processing")) return "bg-violet-500";
  return "bg-slate-500";
}

export default function TopNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);

  const [showProfile, setShowProfile] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    setIsMounted(true);
    
    async function loadProfile() {
      try {
        const profile = await fetchUserProfile();
        setUserProfile(profile);
      } catch (err) {
        console.error("Failed to load initial profile", err);
      }
    }
    loadProfile();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfile(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleProfileClick = async () => {
    setShowProfile(!showProfile);
    if (!userProfile && !showProfile) {
      setLoadingProfile(true);
      try {
        const profile = await fetchUserProfile();
        setUserProfile(profile);
      } catch (err) {
        console.error("Failed to fetch profile", err);
      } finally {
        setLoadingProfile(false);
      }
    }
  };

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (searchQuery.trim()) {
        setIsSearching(true);
        try {
          const payload = await fetchDocuProcessList({ page: 1, pageSize: 4, search: searchQuery });
          setSearchResults(Array.isArray(payload?.results) ? payload.results : (Array.isArray(payload) ? payload : []));
          setTotalCount(payload?.count || 0);
          setShowDropdown(true);
        } catch (err) {
          console.error("Search error", err);
          setSearchResults([]);
          setTotalCount(0);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setTotalCount(0);
        setShowDropdown(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  const handleViewAgent = (projectId) => {
    if (!projectId) return;
    if (typeof window !== "undefined") window.localStorage.setItem(LOCAL_STORAGE_KEYS.projectId, projectId);
    setShowDropdown(false);
    setSearchQuery("");
    router.push(`/dashboard/workspace?project=${encodeURIComponent(projectId)}&view=graph`);
  };

  const handleStartChat = (projectId) => {
    if (!projectId) return;
    if (typeof window !== "undefined") window.localStorage.setItem(LOCAL_STORAGE_KEYS.projectId, projectId);
    setShowDropdown(false);
    setSearchQuery("");
    router.push(`/dashboard/chat?project=${encodeURIComponent(projectId)}`);
  };

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      clearStoredProcessState();
      window.localStorage.removeItem(LOCAL_STORAGE_KEYS.userUuid);
    } finally {
      router.push('/login');
      router.refresh();
      setLoggingOut(false);
    }
  };

  if (!isMounted) {
    return (
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0f0f14]/80 px-4 py-3 backdrop-blur-xl md:px-6">
        <div className="flex items-center gap-4">
          <BrandLogo href="/dashboard/agent" />
          <div className="ml-auto h-8 w-24 rounded-lg border border-white/10 bg-white/5" />
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0f0f14]/80 px-4 py-3 backdrop-blur-xl md:px-6">
      <div className="flex items-center gap-4">
        
        {/* Left Side: Logo & Desktop Navigation */}
        <div className="flex items-center gap-8">
          <BrandLogo href="/dashboard/agent" />
          
          <nav className="hidden items-center gap-2 lg:flex">
            <Link
              href="/dashboard/agent"
              className={`relative rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                pathname === '/dashboard/agent' ? 'text-white' : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              DocuAgent
              {pathname === '/dashboard/agent' && (
                <span className="absolute inset-x-3 -bottom-0.5 h-[2px] rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
              )}
            </Link>
            <Link
              href="/dashboard/chat"
              className={`relative rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                pathname === '/dashboard/chat' ? 'text-white' : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              DocuChat
              {pathname === '/dashboard/chat' && (
                <span className="absolute inset-x-3 -bottom-0.5 h-[2px] rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
              )}
            </Link>
            <Link
              href="/dashboard/docu-history"
              className={`relative rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                pathname === '/dashboard/docu-history' ? 'text-white' : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              DocuHistory
              {pathname === '/dashboard/docu-history' && (
                <span className="absolute inset-x-3 -bottom-0.5 h-[2px] rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
              )}
            </Link>
          </nav>
        </div>

        {/* Right Side: Search, Actions & Profile */}
        <div className="ml-auto flex items-center gap-3 md:gap-4">
          
          {/* Search Input */}
          <div ref={searchRef} className="group relative hidden w-48 lg:block xl:w-60">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
              onFocus={() => { if (searchQuery.trim()) setShowDropdown(true); }}
              placeholder="Search history..."
              className="w-full rounded-full border border-white/5 bg-white/5 py-1.5 pl-9 pr-4 text-sm text-white placeholder:text-slate-500 transition-all focus:border-violet-500/50 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
            />
            
            {showDropdown && searchQuery.trim() && (
              <div className="absolute right-0 top-full mt-2 max-h-[85vh] w-[420px] overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0a0c] p-2 shadow-2xl">
                {isSearching ? (
                  <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-white" />
                    Searching...
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {searchResults.map((process) => (
                      <div 
                        key={process.project_id} 
                        onClick={() => handleViewAgent(process.project_id)}
                        className="group flex cursor-pointer items-center justify-between rounded-xl border border-white/5 bg-black/40 p-4 transition-all hover:border-violet-500/30 hover:bg-white/5"
                      >
                        <div className="flex items-center gap-4 overflow-hidden min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 group-hover:bg-violet-500/20 group-hover:text-violet-300 transition-colors">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">{process.title || process.description?.slice(0, 40) || 'Untitled'}</p>
                            <div className="mt-1 flex items-center gap-2">
                              <span className={`inline-block h-1.5 w-1.5 rounded-full ${toStatusColor(process.status)}`} />
                              <p className="text-xs text-slate-500">{new Date(process.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleStartChat(process.project_id); }} 
                          className="shrink-0 cursor-pointer flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-400 opacity-0 transition-all hover:bg-emerald-500/20 group-hover:opacity-100" 
                          title="Start Chat"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          Chat
                        </button>
                      </div>
                    ))}
                    
                    {totalCount > searchResults.length && (
                      <button 
                        onClick={() => {
                          setShowDropdown(false);
                          router.push(`/dashboard/docu-history?search=${encodeURIComponent(searchQuery)}`);
                        }}
                        className="mt-2 cursor-pointer rounded-xl bg-black/40 px-3 py-3 text-sm font-semibold text-slate-400 transition-all hover:bg-white/5 hover:text-white"
                      >
                        View all {totalCount} results &rarr;
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No results found
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pro Button */}
          <button className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-bold text-white shadow-[0_0_15px_rgba(139,92,246,0.4)] transition-all hover:bg-violet-500 hover:shadow-[0_0_20px_rgba(139,92,246,0.6)] active:scale-95">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            <span>Pro</span>
          </button>

          {/* User Profile */}
          <div ref={profileRef} className="relative">
            <button 
              onClick={handleProfileClick}
              className="flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/30 shadow-[0_0_10px_rgba(139,92,246,0.15)] transition-all hover:bg-violet-500/20 hover:scale-105 font-bold text-base"
            >
              {userProfile ? (userProfile.first_name?.[0] || userProfile.email?.[0] || 'U').toUpperCase() : 'U'}
            </button>
            {showProfile && (
              <div className="absolute right-0 top-full mt-3 w-72 rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 shadow-2xl z-50">
                {loadingProfile ? (
                  <div className="flex flex-col items-center justify-center py-6 text-slate-400">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-500 border-t-white mb-2" />
                    <span className="text-xs">Loading profile...</span>
                  </div>
                ) : userProfile ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 text-lg font-bold">
                        {(userProfile.first_name?.[0] || userProfile.email?.[0] || 'U').toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="truncate text-sm font-semibold text-white">
                          {userProfile.first_name || userProfile.last_name 
                            ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() 
                            : 'DocuGyan User'}
                        </span>
                        <span className="truncate text-xs text-slate-400">{userProfile.email}</span>
                        <div className="mt-1 flex items-center gap-1">
                          <span className={`h-1.5 w-1.5 rounded-full ${userProfile.is_active ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                          <span className="text-[10px] uppercase tracking-wider text-slate-500">{userProfile.is_active ? 'Active' : 'Inactive'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400 px-1 py-1">
                      <span>Joined</span>
                      <span className="text-slate-300 font-medium">{new Date(userProfile.date_joined).toLocaleDateString()}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 py-2.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loggingOut ? (
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      )}
                      <span>{loggingOut ? 'Logging out...' : 'Logout'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-red-400">Failed to load profile.</div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Mobile Navigation */}
      <nav className="mt-3 flex gap-1 overflow-x-auto pb-1 lg:hidden [&::-webkit-scrollbar]:hidden">
        <Link
          href="/dashboard/agent"
          className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            pathname === '/dashboard/agent'
              ? 'bg-violet-500/20 text-violet-200 border border-violet-500/30'
              : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
          }`}
        >
          DocuAgent
        </Link>
        <Link
          href="/dashboard/chat"
          className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            pathname === '/dashboard/chat'
              ? 'bg-violet-500/20 text-violet-200 border border-violet-500/30'
              : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
          }`}
        >
          DocuChat
        </Link>
        <Link
          href="/dashboard/docu-history"
          className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            pathname === '/dashboard/docu-history'
              ? 'bg-violet-500/20 text-violet-200 border border-violet-500/30'
              : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
          }`}
        >
          DocuHistory
        </Link>
      </nav>
    </header>
  );
}