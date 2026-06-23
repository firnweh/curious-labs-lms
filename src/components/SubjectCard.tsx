"use client";

import Link from "next/link";
import type { Subject } from "@/lib/subjects";
import type { ActivityMeta } from "@/lib/activities/types";
import { useProgress } from "@/lib/progress";
import { useSubjectTransition } from "@/components/SubjectTransition";
import { TrackCardFX } from "@/components/TrackCardFX";

export function SubjectCard({
  subject,
  activities,
  index = 0,
}: {
  subject: Subject;
  activities: ActivityMeta[];
  index?: number;
}) {
  const { isComplete } = useProgress();
  const transition = useSubjectTransition();
  const total = activities.length;
  const done = activities.filter((a) => isComplete(a.id)).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const accent = subject.accent;
  const href = `/subjects/${subject.id}`;
  const style = { "--acc": accent, animationDelay: `${index * 70}ms` } as React.CSSProperties;

  return (
    <Link
      href={href}
      onClick={(e) => {
        if (transition) {
          e.preventDefault();
          transition.go(subject.id, href);
        }
      }}
      className="lab-card card-in group relative flex min-h-[210px] flex-col overflow-hidden rounded-2xl border border-line/60 bg-panel/40 p-6"
      style={style}
    >
      {/* living, per-track ambient backdrop (code rain / circuits / neural net / cube) */}
      <TrackCardFX subject={subject.id} accent={accent} />
      {/* accent top edge blooms on hover */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        aria-hidden
      />

      <div className="relative z-10 flex flex-1 flex-col">
        <div className="flex items-start justify-between">
          <span
            className="grid h-14 w-14 place-items-center rounded-2xl text-3xl transition-transform duration-300 group-hover:scale-110"
            style={{ background: `${accent}1f`, border: `1px solid ${accent}40` }}
          >
            {subject.emoji}
          </span>
          {total > 0 && <Ring pct={pct} accent={accent} />}
        </div>

        <h3 className="mt-4 font-display text-xl font-bold text-ink">{subject.name}</h3>
        <p className="mt-1 text-sm font-medium" style={{ color: accent }}>
          {subject.tagline}
        </p>
        <p className="mt-2 flex-1 text-sm text-ink-dim">{subject.blurb}</p>

        <div className="mt-4 flex items-center justify-between font-mono text-[11px] tracking-tech text-ink-faint">
          <span>{total === 0 ? "✨ NEW LABS SOON" : `${done}/${total} COMPLETE · ${total} LABS`}</span>
          <span
            className="flex items-center gap-1 font-semibold opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            style={{ color: accent }}
          >
            ENTER <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

/** A small glowing accent ring showing track completion. */
function Ring({ pct, accent }: { pct: number; accent: string }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return (
    <div className="relative grid h-11 w-11 shrink-0 place-items-center">
      <svg viewBox="0 0 40 40" className="h-full w-full -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={accent}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          style={{ filter: `drop-shadow(0 0 4px ${accent})`, transition: "stroke-dashoffset .8s ease" }}
        />
      </svg>
      <span className="absolute font-mono text-[10px] font-bold text-ink">{pct}%</span>
    </div>
  );
}
