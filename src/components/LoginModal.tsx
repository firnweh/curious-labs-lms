"use client";

import { useEffect, useRef, useState } from "react";
import { signInWithPhoneNumber, RecaptchaVerifier, type ConfirmationResult } from "firebase/auth";
import { firebaseAuth, isFirebaseConfigured } from "@/lib/firebase";

/** Existing Curious Labs backend (verifies the Firebase token, sets the cookie). */
const AUTH_BASE = "https://curiouslabs.online";

type Step = "phone" | "otp" | "school";

/**
 * Student login popup — mobile OTP via Firebase Phone Auth. Opens on `?login=1`
 * or the `cl:open-login` event. Flow: enter mobile number → Firebase sends an
 * OTP → enter the code → the backend verifies the Firebase token and sets the
 * shared `.curiouslabs.online` cookie. A brand-new number does a one-time
 * "join your school" step (class code + name + grade + section).
 */
export function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const idTokenRef = useRef<string>("");
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Tidy the reCAPTCHA when the modal closes so a reopen starts clean.
  useEffect(() => {
    if (open) return;
    recaptchaRef.current?.clear();
    recaptchaRef.current = null;
    setStep("phone");
    setOtp("");
    setError("");
    setBusy(false);
  }, [open]);

  if (!open) return null;

  const sendOtp = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) {
      setError("Enter your 10-digit mobile number.");
      return;
    }
    if (!isFirebaseConfigured) {
      setError("Mobile login isn't set up yet. Please try again later.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      recaptchaRef.current?.clear();
      recaptchaRef.current = new RecaptchaVerifier(firebaseAuth(), "recaptcha-container", { size: "invisible" });
      confirmationRef.current = await signInWithPhoneNumber(firebaseAuth(), "+91" + digits, recaptchaRef.current);
      setStep("otp");
      setBusy(false);
    } catch {
      setError("Couldn't send the code. Check the number and try again.");
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
      setBusy(false);
    }
  };

  const loginWithToken = async (body: Record<string, string>) => {
    const res = await fetch(`${AUTH_BASE}/api/student/otp-login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (data.ok) {
      window.location.assign("/");
      return;
    }
    if (data.needsOnboarding) {
      setStep("school");
      setError(data.error || "");
      setBusy(false);
      return;
    }
    setError(data.error || "Couldn't log in. Try again.");
    setBusy(false);
  };

  const verifyOtp = async () => {
    if (otp.replace(/\D/g, "").length !== 6 || !confirmationRef.current) {
      setError("Enter the 6-digit code.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const cred = await confirmationRef.current.confirm(otp.trim());
      idTokenRef.current = await cred.user.getIdToken();
      await loginWithToken({ idToken: idTokenRef.current });
    } catch {
      setError("That code didn't match. Try again.");
      setBusy(false);
    }
  };

  const joinSchool = async () => {
    if (!code.trim() || !name.trim() || !grade || !section.trim()) {
      setError("Fill in the class code, your name, grade and section.");
      return;
    }
    setBusy(true);
    setError("");
    await loginWithToken({ idToken: idTokenRef.current, code, name, grade, section });
  };

  const field =
    "w-full rounded-2xl border-2 border-line bg-panel-2/70 px-4 py-3 text-center font-round text-ink outline-none transition focus:border-neon-cyan/60";
  const cta =
    "w-full rounded-2xl bg-[#34d399] px-5 py-3 font-round text-base font-bold text-[#06210f] shadow-[0_6px_20px_-4px_rgba(52,211,153,.6)] transition active:scale-95 disabled:opacity-60";

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

        <div className="text-4xl">{step === "school" ? "🏫" : "📱"}</div>
        <h2 className="mt-2 font-round text-2xl font-bold text-ink">
          {step === "school" ? "Join your school" : "Student login"}
        </h2>

        {step === "phone" && (
          <div className="mt-5 space-y-2.5">
            <p className="font-round text-sm text-ink-faint">We&apos;ll text you a one-time code.</p>
            <div className="flex items-center gap-2">
              <span className="rounded-2xl border-2 border-line bg-panel-2/70 px-3 py-3 font-round text-ink">+91</span>
              <input
                autoFocus
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                placeholder="Mobile number"
                className={`${field} flex-1 tracking-[0.15em]`}
              />
            </div>
            {error && <p className="font-round text-sm text-neon-red">{error}</p>}
            <button onClick={sendOtp} disabled={busy} className={cta}>
              {busy ? "Sending…" : "📲 Send code"}
            </button>
          </div>
        )}

        {step === "otp" && (
          <div className="mt-5 space-y-2.5">
            <p className="font-round text-sm text-ink-faint">
              Enter the code sent to <span className="font-bold text-ink">+91 {phone}</span>
            </p>
            <input
              autoFocus
              inputMode="numeric"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
              placeholder="6-digit code"
              className={`${field} text-2xl tracking-[0.4em]`}
            />
            {error && <p className="font-round text-sm text-neon-red">{error}</p>}
            <button onClick={verifyOtp} disabled={busy} className={cta}>
              {busy ? "Verifying…" : "🚀 Verify & enter"}
            </button>
            <button
              onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
              className="font-round text-xs text-neon-cyan hover:underline"
            >
              ← change number
            </button>
          </div>
        )}

        {step === "school" && (
          <div className="mt-5 space-y-2.5">
            <p className="font-round text-sm text-ink-faint">First time here — join your school.</p>
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
            <button onClick={joinSchool} disabled={busy} className={cta}>
              {busy ? "Joining…" : "🚀 Join class"}
            </button>
          </div>
        )}

        <p className="mt-5 border-t border-line/60 pt-4 font-round text-xs text-ink-faint">
          Teacher or admin?{" "}
          <a href={`${AUTH_BASE}/login`} className="font-semibold text-neon-cyan hover:underline">Admin login →</a>
        </p>

        <div id="recaptcha-container" />
      </div>
    </div>
  );
}
