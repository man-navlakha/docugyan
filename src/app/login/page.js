"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleLogin } from "@react-oauth/google";
import BrandLogo from "@/components/BrandLogo";
import {
  LOCAL_STORAGE_KEYS,
  fetchAccessToken,
  googleLogin,
  loginSignUp,
  resendOtp,
  verifyOtp,
} from "@/lib/api/docuApi";

function getMessage(error, fallback) {
  if (error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

const GoogleAuthSection = memo(function GoogleAuthSection({ googleLoading, onSuccess, onError }) {
  return (
    <div className={`flex justify-center transition-opacity duration-300 ${googleLoading ? "pointer-events-none opacity-50" : ""}`}>
      <GoogleLogin
        onSuccess={onSuccess}
        onError={onError}
        theme="filled_black"
        size="large"
        shape="rectangular"
        text="continue_with"
        width={320}
      />
    </div>
  );
});

export default function LoginPage() {
  const REDIRECT_DELAY_MS = 1600;
  const targetPath = "/dashboard/agent";
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [authSession, setAuthSession] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);
  const [successText, setSuccessText] = useState("Authentication successful.");
  const [redirectStartedAt, setRedirectStartedAt] = useState(0);
  const router = useRouter();
  
  const disabledAction = loading || googleLoading;
  const showProcessingOverlay = !authSuccess && (googleLoading || (loading && Boolean(authSession)));

  useEffect(() => {
    router.prefetch(targetPath);
  }, [router, targetPath]);

  const persistSessionState = async (userUuid) => {
    if (userUuid) {
      window.localStorage.setItem(LOCAL_STORAGE_KEYS.userUuid, userUuid);
    }
    try {
      const tokenPayload = await fetchAccessToken();
      if (tokenPayload?.access_token) {
        window.localStorage.setItem(LOCAL_STORAGE_KEYS.accessToken, tokenPayload.access_token);
      }
    } catch {
      window.localStorage.removeItem(LOCAL_STORAGE_KEYS.accessToken);
    }
  };

  const completeAuthAndRedirect = useCallback(async (message, userUuid) => {
    await persistSessionState(userUuid);
    setStatusMessage("");
    setSuccessText(message ?? "Redirecting to DocuAgent...");
    setRedirectStartedAt(Date.now());
    setAuthSuccess(true);
    window.setTimeout(() => {
      router.push(targetPath);
    }, REDIRECT_DELAY_MS);
  }, [router, targetPath]);

  const handleGoogleSuccess = useCallback(async (credentialResponse) => {
    setGoogleLoading(true);
    setError("");
    setStatusMessage("");
    try {
      const payload = await googleLogin(credentialResponse.credential);
      await completeAuthAndRedirect("Google sign-in complete.", payload?.user_uuid);
    } catch (requestError) {
      setError(getMessage(requestError, "Google login failed on the server."));
    } finally {
      setGoogleLoading(false);
    }
  }, [completeAuthAndRedirect]);

  const handleGoogleError = useCallback(() => {
    setError("Google login was cancelled or failed.");
  }, []);

  const handleStart = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setStatusMessage("");

    try {
      const payload = await loginSignUp(email.trim());
      setAuthSession({ id: payload.id, key: payload.key, status: payload.status });
      setStatusMessage(`Secure code sent to your email.`);
    } catch (requestError) {
      setError(getMessage(requestError, "Failed to send OTP."));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    if (!authSession?.id) return setError("Please start the login process first.");

    setLoading(true);
    setError("");
    setStatusMessage("");

    try {
      const payload = await verifyOtp(authSession.id, otp.trim());
      await completeAuthAndRedirect("Verification complete.", payload?.user_uuid);
    } catch (requestError) {
      setError(getMessage(requestError, "Invalid or expired code."));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!authSession?.id || resending) return;

    setResending(true);
    setError("");
    setStatusMessage("");

    try {
      const payload = await resendOtp(authSession.id, authSession.key);
      setAuthSession((current) => current ? { ...current, key: payload.key ?? current.key } : current);
      setStatusMessage("A new code has been sent.");
    } catch (requestError) {
      setError(getMessage(requestError, "Failed to resend code."));
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#0a0a0c] px-4 font-display text-slate-100 selection:bg-violet-500/30 overflow-hidden">
      
      {/* Required for the SVG drawing animation */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes drawCheck {
          to { stroke-dashoffset: 0; }
        }
        @keyframes redirectFill {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}} />

      {/* Premium Background Layering */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-violet-900/15 via-[#0a0a0c] to-[#0a0a0c]" />
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />

      {/* Main Glass Card */}
      <section className="relative z-10 w-full max-w-[420px] rounded-3xl border border-white/10 bg-white/[0.02] p-8 shadow-2xl backdrop-blur-2xl">
        
        {/* Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo href="/" />
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-white">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-400">Sign in to your DocuGyan workspace</p>
        </div>

        {/* Alerts */}
        <div className="space-y-3 mb-6">
          {error && (
            <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200 animate-in fade-in slide-in-from-top-2">
              <svg className="h-5 w-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p>{error}</p>
            </div>
          )}
          {statusMessage && (
            <div className="flex items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/10 p-3 text-sm text-violet-200 animate-in fade-in slide-in-from-top-2">
              <svg className="h-5 w-5 text-violet-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>{statusMessage}</p>
            </div>
          )}
        </div>

        {/* Auth Flow */}
        {!authSession ? (
          <form onSubmit={handleStart} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3.5 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-violet-500 focus:bg-white/5 focus:ring-1 focus:ring-violet-500"
                placeholder="name@company.com"
              />
            </div>

            <button
              type="submit"
              disabled={disabledAction}
              className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-violet-500 to-violet-600 px-4 py-3.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(139,92,246,0.3)] ring-1 ring-white/10 transition-all hover:from-violet-400 hover:to-violet-500 hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              {loading ? (
                <svg className="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <>
                  <span>Continue with Email</span>
                  <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-5 animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/40 p-3">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-violet-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="truncate">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">Sent to</p>
                  <p className="truncate text-xs font-medium text-slate-200">{email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setAuthSession(null); setOtp(""); setStatusMessage(""); }}
                className="shrink-0 p-2 text-slate-400 transition-colors hover:text-white"
                title="Change Email"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="otp" className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                Verification Code
              </label>
              <input
                type="text"
                id="otp"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                required
                maxLength={6}
                autoFocus
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-4 text-center font-mono text-2xl tracking-[0.5em] text-white outline-none transition-all focus:border-violet-500 focus:bg-white/5 focus:ring-1 focus:ring-violet-500"
                placeholder="000000"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm font-semibold text-white transition-all hover:bg-white/10 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
              >
                {resending ? "Sending..." : "Resend"}
              </button>
              <button
                type="submit"
                disabled={disabledAction || otp.length < 6}
                className="group flex-[2] flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-violet-500 to-violet-600 px-4 py-3.5 text-sm font-semibold text-white ring-1 ring-white/10 transition-all hover:from-violet-400 hover:to-violet-500 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)]"
              >
                {loading ? "Verifying..." : "Sign In"}
              </button>
            </div>
          </form>
        )}

        <div className="my-7 flex items-center gap-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Or</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
        </div>

        {/* Official Google Login Component */}
        <GoogleAuthSection googleLoading={googleLoading} onSuccess={handleGoogleSuccess} onError={handleGoogleError} />

        <p className="mt-8 text-center text-xs text-slate-500">
          By continuing, you agree to DocuGyan's{" "}
          <Link href="#" className="text-slate-400 hover:text-white transition-colors">Terms</Link> and{" "}
          <Link href="#" className="text-slate-400 hover:text-white transition-colors">Privacy Policy</Link>.
        </p>

        {/* Processing Overlay (shown before success state to avoid silent waiting) */}
        {showProcessingOverlay && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-3xl bg-[#0a0a0c]/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="relative mb-5 flex h-20 w-20 items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-violet-300/30" />
              <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-violet-300 border-r-violet-400 animate-spin" />
              <div className="absolute inset-4 rounded-full bg-violet-500/20 blur-sm" />
            </div>
            <h2 className="text-lg font-semibold text-white">Just a moment...</h2>
            <p className="mt-2 text-sm text-violet-200/85">
              {googleLoading ? "Completing Google sign-in" : "Verifying your code"}
            </p>
            <div className="mt-4 h-1.5 w-[72%] max-w-[220px] overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/2 animate-[pulse_1s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-300" />
            </div>
          </div>
        )}

        {/* --- PREMIUM SUCCESS ANIMATION OVERLAY --- */}
        {authSuccess && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-3xl bg-[#0a0a0c]/95 backdrop-blur-xl animate-in fade-in duration-500">
            
            <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
              {/* Outer pulsing ring */}
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping opacity-75 duration-1000"></div>
              {/* Secondary pulse */}
              <div className="absolute inset-2 rounded-full bg-emerald-500/30 animate-pulse"></div>
              
              {/* Solid Inner Circle */}
              <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.6)] animate-in zoom-in-50 duration-500 spring">
                
                {/* SVG Checkmark with drawing animation */}
                <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    d="M5 13l4 4L19 7" 
                    style={{ strokeDasharray: 24, strokeDashoffset: 24, animation: 'drawCheck 0.5s ease-out 0.2s forwards' }} 
                  />
                </svg>

              </div>
            </div>

            {/* Staggered Text Reveal */}
            <h2 className="text-2xl font-bold text-white animate-in slide-in-from-bottom-4 fade-in duration-500 delay-200 fill-mode-both">
              Welcome Back
            </h2>
            <p className="mt-2 text-sm text-emerald-400/80 animate-in slide-in-from-bottom-2 fade-in duration-500 delay-300 fill-mode-both">
              {successText}
            </p>

            <div className="mt-5 w-[78%] max-w-[260px] animate-in fade-in duration-500 delay-500 fill-mode-both">
              <div className="mb-2 flex items-center justify-center gap-2 text-xs uppercase tracking-[0.14em] text-emerald-300/80">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-emerald-300/40 border-t-emerald-200" />
                Redirecting...
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300"
                  key={redirectStartedAt}
                  style={{ animation: `redirectFill ${REDIRECT_DELAY_MS}ms linear forwards` }}
                />
              </div>
            </div>
            
          </div>
        )}
      </section>
    </main>
  );
}