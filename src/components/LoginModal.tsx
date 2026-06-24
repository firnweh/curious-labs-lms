"use client";

import { useEffect, useState } from "react";

/** Existing Curious Labs backend (NextAuth + the student-login endpoints). */
const AUTH_BASE = "https://curiouslabs.online";

type Mode = "class" | "account";

/**
 * Student login popup over the carousel. Opens on `?login=1` (from the
 * curiouslabs.online chooser) or the `cl:open-login` event. Two ways in:
 *  - Class code: school code + name + grade + section (joins via the school's
 *    class code — for schools already in Curious Labs).
 *  - Student account: email + password (a STUDENT User).
 * Both hit the existing backend, which sets a shared `.curiouslabs.online` cookie.
 */
export function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("class");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const post = async (path: string, body: Record<string, string>) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${AUTH_BASE}${path}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || "Couldn't log in. Try again.");
        setBusy(false);
        return;
      }
      window.location.assign("/");
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  };

  const joinByCode = () => {
    if (!code.trim() || !name.trim() || !grade || !section.trim()) {
      setError("Fill in the class code, your name, grade and section.");
      return;
    }
    post("/api/student/classcode-login", { code, name, grade, section });
  };
  const loginByAccount = () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    post("/api/student/login", { email, password });
  };

  const field =
    "w-full rounded-2xl border-2 border-line bg-panel-2/70 px-4 py-3 text-center font-round text-ink outline-none transition focus:border-neon-cyan/60";
  const tab = (m: Mode, label: string) =>
    `flex-1 rounded-xl px-3 py-2 font-round text-sm font-bold transition ${
      mode === m ? "bg-neon-cyan/15 text-neon-cyan" : "text-ink-faint hover:text-ink-dim"
    }`;

  return (
    <div
      className="fixed inset-0 z-[200] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      onPointerDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Student login"
    >
      <div className="panel relative w-full max-w-sm rounded-3xl border-2 border-neon-cyan/40 p-7 text-center" onPointerDown={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-lg text-ink-faint transition hover:text-ink">
          ✕
        </button>

        <div className="text-4xl">👋</div>
        <h2 className="mt-2 font-round text-2xl font-bold text-ink">Student login</h2>

        <div className="mt-4 flex gap-1 rounded-2xl border-2 border-line bg-panel-2/50 p-1">
          <button onClick={() => { setMode("class"); setError(""); }} className={tab("class", "Class code")}>🏫 Class code</button>
          <button onClick={() => { setMode("account"); setError(""); }} className={tab("account", "Account")}>📧 Account</button>
        </div>

        {mode === "class" ? (
          <div className="mt-4 space-y-2.5">
            <input autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Class code" className={`${field} font-mono tracking-[0.2em]`} />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={field} />
            <div className="flex gap-2.5">
              <select value={grade} onChange={(e) => setGrade(e.target.value)} className={`${field} flex-1`} style={{ color: grade ? undefined : "#5f7194" }}>
                <option value="">Grade</option>
                {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((g) => (
                  <option key={g} value={g} style={{ color: "#0b1020" }}>Grade {g}</option>
                ))}
              </select>
              <input value={section} onChange={(e) => setSection(e.target.value.toUpperCase())} placeholder="Sec" className={`${field} w-20`} maxLength={3} />
            </div>
            {error && <p className="font-round text-sm text-neon-red">{error}</p>}
            <button onClick={joinByCode} disabled={busy} className="w-full rounded-2xl bg-[#34d399] px-5 py-3 font-round text-base font-bold text-[#06210f] shadow-[0_6px_20px_-4px_rgba(52,211,153,.6)] transition active:scale-95 disabled:opacity-60">
              {busy ? "Joining…" : "🚀 Join class"}
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            <input autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={field} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loginByAccount()} placeholder="Password" className={field} />
            {error && <p className="font-round text-sm text-neon-red">{error}</p>}
            <button onClick={loginByAccount} disabled={busy} className="w-full rounded-2xl bg-[#34d399] px-5 py-3 font-round text-base font-bold text-[#06210f] shadow-[0_6px_20px_-4px_rgba(52,211,153,.6)] transition active:scale-95 disabled:opacity-60">
              {busy ? "Logging in…" : "🚀 Start learning"}
            </button>
          </div>
        )}

        <p className="mt-5 border-t border-line/60 pt-4 font-round text-xs text-ink-faint">
          Teacher or admin?{" "}
          <a href={`${AUTH_BASE}/login`} className="font-semibold text-neon-cyan hover:underline">Admin login →</a>
        </p>
      </div>
    </div>
  );
}
