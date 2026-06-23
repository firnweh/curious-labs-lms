"use client";

import { activitiesByGrade } from "@/lib/activities/registry";
import { useProgress, useMounted } from "@/lib/progress";

const ACCENT = "#22d3ee"; // grades are multi-subject — cyan is the "grade" brand

/**
 * Vibey grade header: a giant faded grade numeral, an accent wordmark, and a
 * live progress strip across all of the grade's curriculum labs.
 */
export function GradeHero({ grade, theme }: { grade: number; theme?: string }) {
  const { store } = useProgress();
  const mounted = useMounted();

  const labs = activitiesByGrade(grade);
  const done = mounted ? labs.filter((l) => store[l.id]).length : 0;
  const stars = mounted ? labs.reduce((n, l) => n + (store[l.id]?.stars ?? 0), 0) : 0;
  const pct = labs.length ? Math.round((done / labs.length) * 100) : 0;

  return (
    <header className="relative mt-4 overflow-hidden pb-2">
      <span
        className="pointer-events-none absolute -right-2 -top-20 select-none font-orbitron text-[10rem] font-black leading-none text-neon-cyan opacity-[0.06] sm:text-[14rem]"
        aria-hidden
      >
        {grade}
      </span>

      <p className="font-mono text-xs tracking-tech text-neon-cyan">
        {(theme ?? "This year's curriculum").toUpperCase()}
      </p>
      <h1
        className="mt-1 font-orbitron text-5xl font-black tracking-tight text-neon-cyan sm:text-6xl"
        style={{ textShadow: `0 0 26px ${ACCENT}55` }}
      >
        Grade {grade}
      </h1>
      <p className="mt-3 max-w-xl text-ink-dim">
        {`${labs.length} hands-on labs from this year's curriculum — one per project, built to tap, drag and play right in your browser.`}
      </p>

      <div className="mt-5 flex items-center gap-3">
        <div className="h-1.5 w-44 overflow-hidden rounded-full bg-line/40">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: ACCENT, boxShadow: `0 0 10px ${ACCENT}` }}
          />
        </div>
        <span className="font-mono text-xs text-ink-dim">
          {done}/{labs.length} done · {stars}★
        </span>
      </div>
    </header>
  );
}
