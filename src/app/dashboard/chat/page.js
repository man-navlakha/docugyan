"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LOCAL_STORAGE_KEYS,
  ApiError,
  buildProcessWebSocketUrl,
  clearStoredProcessState,
  fetchAccessToken,
  googleLogin,
  initDocuProcess,
  loginSignUp,
  startDocuProcess,
  uploadFileToBlob,
  verifyOtp,
} from "@/lib/api/docuApi";

const stepLabels = [
  "Step 1 · Login",
  "Step 2 · OTP verify",
  "Step 3 · Init project",
  "Step 4 · Upload docs",
  "Step 5 · Start + live status",
];

function toErrorMessage(error, fallback) {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

function toValidUrl(rawValue) {
  try {
    const parsed = new URL(rawValue);
    return parsed.toString();
  } catch {
    return "";
  }
}

function createEventLine(type, text, data = null) {
  return {
    id: `${Date.now()}-${Math.random()}`,
    type,
    text,
    data,
    at: new Date().toLocaleTimeString(),
  };
}

export default function ChatPage() {
  const wsRef = useRef(null);
  const [currentStep, setCurrentStep] = useState(1);

  const [email, setEmail] = useState("");
  const [otpSessionId, setOtpSessionId] = useState(null);
  const [otp, setOtp] = useState("");
  const [googleToken, setGoogleToken] = useState("");

  const [userUuid, setUserUuid] = useState("");
  const [accessToken, setAccessToken] = useState("");

  const [projectId, setProjectId] = useState("");
  const [blobCollection, setBlobCollection] = useState("");
  const [taskId, setTaskId] = useState("");

  const [referenceUrls, setReferenceUrls] = useState([]);
  const [questionUrls, setQuestionUrls] = useState([]);
  const [referenceUrlInput, setReferenceUrlInput] = useState("");
  const [questionUrlInput, setQuestionUrlInput] = useState("");

  const [timeline, setTimeline] = useState([]);
  const [finalResult, setFinalResult] = useState(null);

  const [authError, setAuthError] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [initError, setInitError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [processError, setProcessError] = useState("");

  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [initializingProject, setInitializingProject] = useState(false);
  const [uploadingReference, setUploadingReference] = useState(false);
  const [uploadingQuestion, setUploadingQuestion] = useState(false);
  const [startingProcess, setStartingProcess] = useState(false);
  const [restartingProject, setRestartingProject] = useState(false);

  const readyToInit = Boolean(userUuid);
  const readyToUpload = Boolean(userUuid && projectId);
  const readyToStart = Boolean(userUuid && projectId && referenceUrls.length > 0 && questionUrls.length > 0);

  useEffect(() => {
    const savedUserUuid = window.localStorage.getItem(LOCAL_STORAGE_KEYS.userUuid) ?? "";
    const savedToken = window.localStorage.getItem(LOCAL_STORAGE_KEYS.accessToken) ?? "";
    const savedProjectId = window.localStorage.getItem(LOCAL_STORAGE_KEYS.projectId) ?? "";
    const savedBlobCollection = window.localStorage.getItem(LOCAL_STORAGE_KEYS.blobCollection) ?? "";
    const savedTaskId = window.localStorage.getItem(LOCAL_STORAGE_KEYS.taskId) ?? "";

    if (savedUserUuid) {
      setUserUuid(savedUserUuid);
      setCurrentStep(3);
    }
    if (savedToken) {
      setAccessToken(savedToken);
    }
    if (savedProjectId) {
      setProjectId(savedProjectId);
      setCurrentStep(4);
    }
    if (savedBlobCollection) {
      setBlobCollection(savedBlobCollection);
    }
    if (savedTaskId) {
      setTaskId(savedTaskId);
      setCurrentStep(5);
    }
  }, []);

  useEffect(
    () => () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    },
    []
  );

  const completedStep = useMemo(() => {
    if (finalResult) {
      return 5;
    }
    if (taskId) {
      return 4;
    }
    if (projectId) {
      return 3;
    }
    if (userUuid) {
      return 2;
    }
    if (otpSessionId) {
      return 1;
    }
    return 0;
  }, [finalResult, otpSessionId, projectId, taskId, userUuid]);

  const syncAccessToken = async () => {
    try {
      const payload = await fetchAccessToken();
      if (payload?.access_token) {
        setAccessToken(payload.access_token);
        window.localStorage.setItem(LOCAL_STORAGE_KEYS.accessToken, payload.access_token);
        return payload.access_token;
      }
    } catch {
      window.localStorage.removeItem(LOCAL_STORAGE_KEYS.accessToken);
      setAccessToken("");
    }

    return "";
  };

  const applyUserSession = async (uuidValue) => {
    if (!uuidValue) {
      throw new Error("OTP verified but no user_uuid returned by backend.");
    }

    setUserUuid(uuidValue);
    window.localStorage.setItem(LOCAL_STORAGE_KEYS.userUuid, uuidValue);
    await syncAccessToken();
    setCurrentStep(3);
  };

  const openProgressSocket = (activeProjectId, token) => {
    if (!activeProjectId || !token) {
      setProcessError("Processing started, but WebSocket token is missing. Re-authenticate and retry live stream.");
      return;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const wsUrl = buildProcessWebSocketUrl(activeProjectId, token);
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setTimeline((current) => [...current, createEventLine("message", "WebSocket connected.")]);
    };

    socket.onmessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        setTimeline((current) => [...current, createEventLine("error", "Received non-JSON WebSocket event.")]);
        return;
      }

      const eventType = payload?.event_type ?? "message";
      const data = payload?.data ?? {};
      const text = data?.text ?? "";

      if (eventType === "completed") {
        setFinalResult(data?.result ?? data);
        setTimeline((current) => [...current, createEventLine("completed", "Processing completed.", data?.result ?? data)]);
        return;
      }

      if (eventType === "error") {
        const message = text || data?.message || "Processing failed.";
        setProcessError(message);
        setTimeline((current) => [...current, createEventLine("error", message, data)]);
        return;
      }

      setTimeline((current) => [...current, createEventLine(eventType, text || JSON.stringify(data), data)]);
    };

    socket.onerror = () => {
      setTimeline((current) => [...current, createEventLine("error", "WebSocket error occurred.")]);
    };

    socket.onclose = () => {
      setTimeline((current) => [...current, createEventLine("message", "WebSocket disconnected.")]);
    };
  };

  const handleSendOtp = async (event) => {
    event.preventDefault();
    setSendingOtp(true);
    setAuthError("");
    setVerifyError("");

    try {
      const payload = await loginSignUp(email.trim());
      setOtpSessionId(payload.id);
      setCurrentStep(2);
    } catch (error) {
      setAuthError(toErrorMessage(error, "Failed to send OTP."));
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    if (!otpSessionId) {
      setVerifyError("Start login first.");
      return;
    }

    setVerifyingOtp(true);
    setVerifyError("");

    try {
      const payload = await verifyOtp(otpSessionId, otp.trim());
      await applyUserSession(payload?.user_uuid);
    } catch (error) {
      setVerifyError(toErrorMessage(error, "OTP verification failed."));
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleGoogleLogin = async (event) => {
    event.preventDefault();
    setGoogleLoading(true);
    setVerifyError("");

    try {
      const payload = await googleLogin(googleToken.trim());
      await applyUserSession(payload?.user_uuid);
    } catch (error) {
      setVerifyError(toErrorMessage(error, "Google login failed."));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleInitProject = async () => {
    if (!readyToInit) {
      setInitError("Complete OTP/Google login first.");
      return;
    }

    setInitializingProject(true);
    setInitError("");

    try {
      const payload = await initDocuProcess(userUuid);
      setProjectId(payload.project_id);
      setBlobCollection(payload.blob_collection);
      setTaskId("");
      setFinalResult(null);
      setProcessError("");
      setTimeline([]);

      window.localStorage.setItem(LOCAL_STORAGE_KEYS.projectId, payload.project_id);
      window.localStorage.setItem(LOCAL_STORAGE_KEYS.blobCollection, payload.blob_collection);
      window.localStorage.removeItem(LOCAL_STORAGE_KEYS.taskId);

      setCurrentStep(4);
    } catch (error) {
      setInitError(toErrorMessage(error, "Failed to initialize project."));
    } finally {
      setInitializingProject(false);
    }
  };

  const addManualUrl = (target) => {
    const inputValue = target === "reference" ? referenceUrlInput.trim() : questionUrlInput.trim();
    const validUrl = toValidUrl(inputValue);
    if (!validUrl) {
      setUploadError("Enter a valid public URL.");
      return;
    }

    setUploadError("");
    if (target === "reference") {
      setReferenceUrls((current) => (current.includes(validUrl) ? current : [...current, validUrl]));
      setReferenceUrlInput("");
      return;
    }

    setQuestionUrls((current) => (current.includes(validUrl) ? current : [...current, validUrl]));
    setQuestionUrlInput("");
  };

  const uploadFiles = async (target, files) => {
    if (!readyToUpload) {
      setUploadError("Initialize project before uploading.");
      return;
    }
    if (!files || files.length === 0) {
      return;
    }

    const setLoading = target === "reference" ? setUploadingReference : setUploadingQuestion;
    const setUrls = target === "reference" ? setReferenceUrls : setQuestionUrls;

    setLoading(true);
    setUploadError("");

    try {
      const folder = `${blobCollection || "docu-input"}/${target}`;
      const uploadResults = await Promise.all(Array.from(files).map((file) => uploadFileToBlob(file, folder)));
      const uploadedUrls = uploadResults.map((item) => item.url).filter(Boolean);
      setUrls((current) => [...current, ...uploadedUrls.filter((url) => !current.includes(url))]);
    } catch (error) {
      setUploadError(toErrorMessage(error, "Failed to upload one or more files."));
    } finally {
      setLoading(false);
    }
  };

  const handleStartProcess = async () => {
    if (!readyToStart) {
      setProcessError("Project, reference URLs, and question URLs are required.");
      return;
    }

    setStartingProcess(true);
    setProcessError("");
    setTimeline([]);
    setFinalResult(null);

    try {
      const payload = await startDocuProcess({
        project_id: projectId,
        user_uuid: userUuid,
        reference_urls: referenceUrls,
        question_urls: questionUrls,
      });

      const nextTaskId = payload?.task_id ?? "";
      setTaskId(nextTaskId);
      if (nextTaskId) {
        window.localStorage.setItem(LOCAL_STORAGE_KEYS.taskId, nextTaskId);
      }

      setCurrentStep(5);
      const token = accessToken || (await syncAccessToken());
      openProgressSocket(projectId, token);
    } catch (error) {
      setProcessError(toErrorMessage(error, "Failed to start processing."));
    } finally {
      setStartingProcess(false);
    }
  };

  const handleRestartProcessing = async () => {
    if (!userUuid) {
      setProcessError("Login and verify first.");
      return;
    }

    setRestartingProject(true);
    setProcessError("");

    try {
      const payload = await initDocuProcess(userUuid);
      setProjectId(payload.project_id);
      setBlobCollection(payload.blob_collection);
      setTaskId("");
      setFinalResult(null);
      setTimeline([]);
      setCurrentStep(4);

      window.localStorage.setItem(LOCAL_STORAGE_KEYS.projectId, payload.project_id);
      window.localStorage.setItem(LOCAL_STORAGE_KEYS.blobCollection, payload.blob_collection);
      window.localStorage.removeItem(LOCAL_STORAGE_KEYS.taskId);

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    } catch (error) {
      setProcessError(toErrorMessage(error, "Failed to restart processing."));
    } finally {
      setRestartingProject(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h1 className="text-2xl font-semibold text-white">Docu Process Wizard</h1>
        <p className="mt-1 text-sm text-slate-300">
          End-to-end integration: auth, project init, upload, process enqueue, and live WebSocket events.
        </p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <ol className="grid gap-2 md:grid-cols-5">
          {stepLabels.map((label, index) => {
            const stepNumber = index + 1;
            const isCurrent = currentStep === stepNumber;
            const isDone = completedStep >= stepNumber;
            return (
              <li
                key={label}
                className={`rounded-xl border px-3 py-2 text-xs ${
                  isCurrent
                    ? "border-violet-400/60 bg-violet-500/20 text-violet-100"
                    : isDone
                      ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                      : "border-white/10 bg-white/5 text-slate-400"
                }`}
              >
                {label}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold text-white">Step 1: Login</h2>
        <form onSubmit={handleSendOtp} className="mt-3 space-y-3 md:max-w-xl">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="user@example.com"
            className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-400"
            required
          />
          <button
            type="submit"
            disabled={sendingOtp}
            className="brand-chip neon-purple rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {sendingOtp ? "Sending OTP..." : "POST /Login_SignUp/"}
          </button>
        </form>
        {authError && <p className="mt-3 text-sm text-red-300">{authError}</p>}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold text-white">Step 2: OTP verify</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <form onSubmit={handleVerifyOtp} className="space-y-3">
            <input
              type="text"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              placeholder="123456"
              className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-400"
              required
            />
            <button
              type="submit"
              disabled={verifyingOtp || !otpSessionId}
              className="rounded-xl border border-blue-300/40 bg-blue-500/20 px-4 py-2 text-sm font-semibold text-blue-100 disabled:opacity-60"
            >
              {verifyingOtp ? "Verifying..." : "POST /otp-verify/"}
            </button>
          </form>

          <form onSubmit={handleGoogleLogin} className="space-y-3">
            <input
              type="text"
              value={googleToken}
              onChange={(event) => setGoogleToken(event.target.value)}
              placeholder="Google ID token (optional path)"
              className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-400"
            />
            <button
              type="submit"
              disabled={googleLoading || !googleToken.trim()}
              className="rounded-xl border border-violet-300/40 bg-violet-500/20 px-4 py-2 text-sm font-semibold text-violet-100 disabled:opacity-60"
            >
              {googleLoading ? "Signing in..." : "POST /google/"}
            </button>
          </form>
        </div>
        <p className="mt-3 text-sm text-slate-300">Resolved user UUID: {userUuid || "Not verified yet"}</p>
        {verifyError && <p className="mt-2 text-sm text-red-300">{verifyError}</p>}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold text-white">Step 3: Init project</h2>
        <button
          type="button"
          onClick={handleInitProject}
          disabled={initializingProject || !readyToInit}
          className="mt-3 rounded-xl border border-emerald-300/40 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-60"
        >
          {initializingProject ? "Initializing..." : "POST /agent/init-docu-process/"}
        </button>
        <div className="mt-3 space-y-1 text-sm text-slate-300">
          <p>init payload.user_uuid: {userUuid || "-"}</p>
          <p>project_id: {projectId || "-"}</p>
          <p>blob_collection: {blobCollection || "-"}</p>
        </div>
        {initError && <p className="mt-2 text-sm text-red-300">{initError}</p>}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold text-white">Step 4: Upload docs</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-sm font-semibold text-white">Reference files</h3>
            <input
              type="file"
              multiple
              onChange={(event) => uploadFiles("reference", event.target.files)}
              disabled={!readyToUpload || uploadingReference}
              className="mt-2 block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-500/20 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-100"
            />
            <div className="mt-3 flex gap-2">
              <input
                type="url"
                value={referenceUrlInput}
                onChange={(event) => setReferenceUrlInput(event.target.value)}
                placeholder="Paste reference URL"
                className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => addManualUrl("reference")}
                className="rounded-lg border border-white/20 px-3 py-2 text-xs text-slate-100"
              >
                Add
              </button>
            </div>
            <ul className="mt-3 max-h-24 space-y-1 overflow-y-auto text-xs text-slate-300">
              {referenceUrls.map((url) => (
                <li key={url} className="truncate">
                  {url}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-sm font-semibold text-white">Question files</h3>
            <input
              type="file"
              multiple
              onChange={(event) => uploadFiles("question", event.target.files)}
              disabled={!readyToUpload || uploadingQuestion}
              className="mt-2 block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-500/20 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-violet-100"
            />
            <div className="mt-3 flex gap-2">
              <input
                type="url"
                value={questionUrlInput}
                onChange={(event) => setQuestionUrlInput(event.target.value)}
                placeholder="Paste question URL"
                className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => addManualUrl("question")}
                className="rounded-lg border border-white/20 px-3 py-2 text-xs text-slate-100"
              >
                Add
              </button>
            </div>
            <ul className="mt-3 max-h-24 space-y-1 overflow-y-auto text-xs text-slate-300">
              {questionUrls.map((url) => (
                <li key={url} className="truncate">
                  {url}
                </li>
              ))}
            </ul>
          </article>
        </div>
        {uploadError && <p className="mt-3 text-sm text-red-300">{uploadError}</p>}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold text-white">Step 5: Start processing + live status</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleStartProcess}
            disabled={startingProcess || !readyToStart}
            className="brand-chip neon-blue rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {startingProcess ? "Starting..." : "POST /agent/process/"}
          </button>
          <button
            type="button"
            onClick={handleRestartProcessing}
            disabled={restartingProject || !userUuid}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100 disabled:opacity-60"
          >
            {restartingProject ? "Restarting..." : "Restart processing"}
          </button>
          <button
            type="button"
            onClick={() => {
              clearStoredProcessState();
              setProjectId("");
              setBlobCollection("");
              setTaskId("");
              setTimeline([]);
              setFinalResult(null);
              setReferenceUrls([]);
              setQuestionUrls([]);
              setCurrentStep(userUuid ? 3 : 1);
            }}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-slate-300"
          >
            Clear current process
          </button>
        </div>

        <div className="mt-3 space-y-1 text-sm text-slate-300">
          <p>task_id: {taskId || "-"}</p>
          <p>
            ws endpoint:{" "}
            <span className="text-xs text-slate-400">
              {projectId ? buildProcessWebSocketUrl(projectId, accessToken || "token") : "Initialize project first"}
            </span>
          </p>
        </div>

        {processError && (
          <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/15 p-3 text-sm text-red-200">
            <p>{processError}</p>
            <button
              type="button"
              onClick={handleStartProcess}
              disabled={startingProcess || !readyToStart}
              className="mt-2 rounded-lg border border-red-300/40 px-3 py-1.5 text-xs font-semibold"
            >
              Retry process call
            </button>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <h3 className="text-sm font-semibold text-white">Live timeline</h3>
          <div className="mt-2 max-h-56 space-y-2 overflow-y-auto text-xs">
            {timeline.length === 0 ? (
              <p className="text-slate-500">No events yet.</p>
            ) : (
              timeline.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                  <p className="font-semibold text-slate-200">
                    [{entry.at}] {entry.type}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-300">{entry.text}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {finalResult && (
          <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
            <p className="text-sm font-semibold text-emerald-100">Completed result</p>
            <pre className="mt-2 max-h-64 overflow-auto text-xs text-emerald-50">
              {JSON.stringify(finalResult, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {!userUuid && (
        <p className="text-sm text-slate-400">
          If dashboard access is blocked by middleware, complete login at{" "}
          <Link href="/login" className="text-violet-300 underline">
            /login
          </Link>{" "}
          first.
        </p>
      )}
    </div>
  );
}
