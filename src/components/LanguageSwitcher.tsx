"use client";

import { useEffect, useRef, useState } from "react";
import { LANGUAGES, useT } from "@/lib/i18n";

/**
 * Header language picker. Shows the active language's native name and opens a
 * dropdown of all supported languages. Switching is instant — the whole app
 * re-renders through the language context.
 */
export function LanguageSwitcher() {
  const { lang, setLang, t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("lang.label")}
        className="flex items-center gap-1.5 rounded-full border border-line/70 bg-base/50 px-3 py-1.5 text-sm text-ink-dim transition-colors hover:border-neon-cyan/50 hover:text-ink"
      >
        <span aria-hidden>🌐</span>
        <span className="text-ink">{current.native}</span>
        <span
          aria-hidden
          className={`text-xs transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t("lang.label")}
          className="absolute right-0 z-50 mt-2 max-h-80 w-44 overflow-auto rounded-2xl border border-line/70 bg-base/95 p-1 shadow-2xl backdrop-blur-xl"
        >
          {LANGUAGES.map((o) => {
            const active = o.code === lang;
            return (
              <li key={o.code} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    setLang(o.code);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    active
                      ? "bg-neon-cyan/15 text-neon-cyan"
                      : "text-ink-dim hover:bg-white/5 hover:text-ink"
                  }`}
                >
                  <span>{o.native}</span>
                  <span className="font-mono text-[10px] tracking-tech opacity-60">
                    {o.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
