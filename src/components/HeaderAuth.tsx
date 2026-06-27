"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

const AUTH_BASE = "https://curiouslabs.online";

/**
 * Right-side header action. Reads the shared student session via /api/me:
 *  - signed in  → a greeting chip + log out
 *  - signed out → "Login", which opens the student popup (LoginGate listens
 *    for the cl:open-login event)
 */
export function HeaderAuth() {
  const { t } = useT();
  const [student, setStudent] = useState<{ name: string | null } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => alive && setStudent(d.student))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const logout = async () => {
    try {
      await fetch(`${AUTH_BASE}/api/student/logout`, { method: "POST", credentials: "include" });
    } catch {
      /* ignore */
    }
    window.location.assign("/");
  };

  if (student) {
    const first = (student.name || "Learner").trim().split(/\s+/)[0];
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-3.5 py-1.5 font-round text-sm font-semibold text-neon-cyan">
          👋 {first}
        </span>
        <button
          onClick={logout}
          aria-label={t("nav.logout")}
          title={t("nav.logout")}
          className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink-dim transition-colors hover:border-neon-violet/50 hover:text-neon-violet"
        >
          ⎋
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("cl:open-login"))}
      className="rounded-full border border-neon-cyan/50 bg-neon-cyan/10 px-5 py-2 font-mono text-sm font-semibold tracking-tech text-neon-cyan transition-colors hover:border-neon-cyan hover:bg-neon-cyan/20"
    >
      {t("nav.login")}
    </button>
  );
}
