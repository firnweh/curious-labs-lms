"use client";

import { activitiesBySubject } from "@/lib/activities/registry";
import { SUBJECT_MAP } from "@/lib/subjects";
import { useProgress, useMounted } from "@/lib/progress";
import type { SubjectId } from "@/lib/activities/types";

/**
 * Vibey subject header: an accent wordmark, an oversized faded subject glyph,
 * and a live progress strip (labs done + stars) for the whole subject.
 */
export function SubjectHero({ subject }: { subject: SubjectId }) {
  const s = SUBJECT_MAP[subject];
  const { store } = useProgress();
  const mounted = useMounted();

  const labs = activitiesBySubject(subject);
  const done = mounted ? labs.filter((l) => store[l.id]).length : 0;
  const stars = mounted ? labs.reduce((n, l) => n + (store[l.id]?.stars ?? 0), 0) : 0;
  const pct = labs.length ? Math.round((done / labs.length) * 100) : 0;
  const accent = s.accent;

  return (
    <header className="relative mt-4 overflow-hidden pb-2">
      <span className="pointer-events-none absolute -right-2 -top-12 select-none text-[7rem] leading-none opacity-[0.07] blur-[1px] sm:text-[10rem]" aria-hidden>
        {s.emoji}
      </span>

      <p className="font-mono text-xs tracking-tech" style={{ color: accent }}>
        {s.tagline.toUpperCase()}
      </p>
      <h1
        className="mt-1 font-orbitron text-5xl font-black tracking-tight sm:text-6xl"
        style={{ color: accent, textShadow: `0 0 26px ${accent}55` }}
      >
        {s.name}
      </h1>
      <p className="mt-3 max-w-xl text-ink-dim">{s.blurb}</p>

      <div className="mt-5 flex items-center gap-3">
        <div className="h-1.5 w-44 overflow-hidden rounded-full bg-line/40">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: accent, boxShadow: `0 0 10px ${accent}` }}
          />
        </div>
        <span className="font-mono text-xs text-ink-dim">
          {done}/{labs.length} done · {stars}★
        </span>
      </div>
    </header>
  );
}
