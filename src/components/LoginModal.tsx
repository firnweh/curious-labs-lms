"use client";

import { useEffect, useState } from "react";

/** Existing Curious Labs backend (NextAuth + the student-login endpoint). */
const AUTH_BASE = "https://curiouslabs.online";

/**
 * Student login popup over the carousel. Opens on `?login=1` (from the
 * curiouslabs.online chooser) or when a Login control fires `cl:open-login`.
 * Authenticates real student accounts against the existing backend's
 * /api/student/login (which sets a shared `.curiouslabs.online` cookie).
 */
export function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async () => {
    if (!email.trim() || !password || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${AUTH_BASE}/api/student/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || "Couldn't log in. Try again.");
        setBusy(false);
        return;
      }
      // shared cookie is now set — reload so the app picks up the session
      window.location.assign("/");
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      onPointerDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Student login"
    >
      <div
        className="panel relative w-full max-w-sm rounded-3xl border-2 border-neon-cyan/40 p-7 text-center"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-lg text-ink-faint transition hover:text-ink"
        >
          ✕
        </button>

        <div className="text-4xl">👋</div>
        <h2 className="mt-2 font-round text-2xl font-bold text-ink">Student login</h2>
        <p className="mt-1 font-round text-sm text-ink-dim">Log in to start exploring the labs.</p>

        <input
          autoFocus
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="mt-5 w-full rounded-2xl border-2 border-line bg-panel-2/70 px-4 py-3 text-center font-round text-ink outline-none transition focus:border-neon-cyan/60"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Password"
          className="mt-2.5 w-full rounded-2xl border-2 border-line bg-panel-2/70 px-4 py-3 text-center font-round text-ink outline-none transition focus:border-neon-cyan/60"
        />

        {error && <p className="mt-3 font-round text-sm text-neon-red">{error}</p>}

        <button
          onClick={submit}
          disabled={busy}
          className="mt-3 w-full rounded-2xl bg-[#34d399] px-5 py-3 font-round text-base font-bold text-[#06210f] shadow-[0_6px_20px_-4px_rgba(52,211,153,.6)] transition active:scale-95 disabled:opacity-60"
        >
          {busy ? "Logging in…" : "🚀 Start learning"}
        </button>

        <p className="mt-5 border-t border-line/60 pt-4 font-round text-xs text-ink-faint">
          Are you a teacher or admin?{" "}
          <a href={`${AUTH_BASE}/login`} className="font-semibold text-neon-cyan hover:underline">
            Admin login →
          </a>
        </p>
      </div>
    </div>
  );
}
