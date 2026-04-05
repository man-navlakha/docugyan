"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";

function getErrorMessage(payload, fallback) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  return payload.message ?? payload.error ?? payload.detail ?? fallback;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [googleToken, setGoogleToken] = useState("");
  const [authSession, setAuthSession] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [targetPath, setTargetPath] = useState("/dashboard");
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextPath = params.get("next");
    if (nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")) {
      setTargetPath(nextPath);
    }
  }, []);

  const handleStart = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setStatusMessage("");

    try {
      const response = await fetch("/api/auth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(getErrorMessage(payload, "Failed to send OTP."));
        return;
      }

      setAuthSession({
        id: payload.id,
        key: payload.key,
        status: payload.status,
      });
      setStatusMessage(`OTP sent. ${payload.status ?? ""}`.trim());
    } catch {
      setError("Unable to connect to auth service.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!authSession?.id) {
      setError("Start login first.");
      return;
    }

    setLoading(true);
    setError("");
    setStatusMessage("");

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: authSession.id, otp: otp.trim() }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(getErrorMessage(payload, "OTP verification failed."));
        return;
      }

      setStatusMessage(payload.message ?? "OTP verified.");
      router.push(targetPath);
    } catch {
      setError("Unable to verify OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!authSession?.id || resending) {
      return;
    }

    setResending(true);
    setError("");
    setStatusMessage("");

    try {
      const response = await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: authSession.id, key: authSession.key }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(getErrorMessage(payload, "Failed to resend OTP."));
        return;
      }

      setAuthSession((current) =>
        current
          ? {
              ...current,
              key: payload.key ?? current.key,
            }
          : current
      );
      setStatusMessage("A new OTP has been sent.");
    } catch {
      setError("Unable to resend OTP.");
    } finally {
      setResending(false);
    }
  };

  const handleGoogleLogin = async (e) => {
    e.preventDefault();
    setGoogleLoading(true);
    setError("");
    setStatusMessage("");

    try {
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: googleToken.trim() }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(getErrorMessage(payload, "Google login failed."));
        return;
      }

      setStatusMessage(payload.message ?? "Google login successful.");
      router.push(targetPath);
    } catch {
      setError("Unable to complete Google login.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="glass-panel w-full max-w-md rounded-3xl p-8">
        <div className="mb-8">
          <BrandLogo href="/" />
          <p className="mt-4 text-sm text-slate-300">Sign in with email OTP or Google token.</p>
        </div>

        {error && <p className="mb-4 rounded-xl border border-red-400/30 bg-red-500/20 p-3 text-sm text-red-200">{error}</p>}
        {statusMessage && (
          <p className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-500/20 p-3 text-sm text-emerald-100">{statusMessage}</p>
        )}

        {!authSession ? (
          <form onSubmit={handleStart} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm text-slate-300">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-white outline-none placeholder:text-slate-500 focus:border-violet-400"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="brand-chip neon-purple w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Sending OTP..." : "Continue with Email OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
              <p>Email: {email}</p>
              <p>User Type: {authSession.status ?? "Unknown"}</p>
            </div>
            <div>
              <label htmlFor="otp" className="mb-1 block text-sm text-slate-300">
                OTP
              </label>
              <input
                type="text"
                id="otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-white outline-none placeholder:text-slate-500 focus:border-blue-400"
                placeholder="Enter 6-digit OTP"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="brand-chip neon-purple w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="w-full rounded-xl border border-white/20 py-2.5 text-sm font-semibold text-slate-100 hover:border-white/40 disabled:opacity-60"
            >
              {resending ? "Resending..." : "Resend OTP"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthSession(null);
                setOtp("");
                setStatusMessage("");
              }}
              className="w-full rounded-xl py-2 text-sm text-slate-400 hover:text-slate-200"
            >
              Change email
            </button>
          </form>
        )}

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={handleGoogleLogin} className="space-y-3">
          <div>
            <label htmlFor="google-token" className="mb-1 block text-sm text-slate-300">
              Google ID Token
            </label>
            <input
              type="text"
              id="google-token"
              value={googleToken}
              onChange={(e) => setGoogleToken(e.target.value)}
              required
              className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-white outline-none placeholder:text-slate-500 focus:border-violet-400"
              placeholder="Paste Google ID token"
            />
          </div>
          <button
            type="submit"
            disabled={googleLoading}
            className="w-full rounded-xl border border-blue-300/40 bg-blue-500/20 py-3 text-sm font-semibold text-blue-100 disabled:opacity-60"
          >
            {googleLoading ? "Signing in..." : "Continue with Google Token"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-400">
          New here?{" "}
          <Link href="/" className="font-semibold text-violet-300 hover:text-violet-200">
            Back to Home
          </Link>
        </p>
      </section>
    </main>
  );
}
