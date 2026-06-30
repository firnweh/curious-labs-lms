"use client";

import type { ReactNode } from "react";

/**
 * Shared presentational primitives so every Neural Lab experiment wears the
 * same dark, mono, kid-facing skin (matching the original ten labs): a header
 * row with emoji + title + grade/topic chips, a live teaching caption, and a
 * "big idea" footer.
 */

export function LabHeader({
  emoji,
  title,
  grades,
  topic,
  accent,
  right,
}: {
  emoji: string;
  title: string;
  grades: string;
  topic: string;
  accent: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
      <span aria-hidden style={{ fontSize: 24 }}>{emoji}</span>
      <h2 className="font-mono text-base font-semibold tracking-wide">{title}</h2>
      <span
        className="rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold"
        style={{ background: `${accent}1a`, color: accent, border: `1px solid ${accent}55` }}
      >
        {grades}
      </span>
      <span className="font-mono text-[11px] text-[#9fb0d0]">· {topic}</span>
      {right && <span className="ml-auto font-mono text-[11px] text-[#5b6b8c]">{right}</span>}
    </div>
  );
}

export function Caption({
  accent,
  active = false,
  children,
}: {
  accent: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <p
      aria-live="polite"
      className="mb-4 rounded-xl border px-3 py-2 font-mono text-[11px] leading-relaxed"
      style={{
        borderColor: active ? `${accent}55` : "#1e2738",
        background: active ? `${accent}14` : "#0f1420",
        color: active ? accent : "#9fb0d0",
      }}
    >
      {children}
    </p>
  );
}

export function Footer({ accent, children }: { accent: string; children: ReactNode }) {
  return (
    <p className="mt-4 rounded-xl border border-[#1e2738] bg-[#0b1018] p-3 font-mono text-[10px] leading-relaxed text-[#5b6b8c]">
      {children}
    </p>
  );
}

/** Accent-colored inline emphasis used inside captions/footers. */
export function Hi({ accent, children }: { accent: string; children: ReactNode }) {
  return <span style={{ color: accent }}>{children}</span>;
}
