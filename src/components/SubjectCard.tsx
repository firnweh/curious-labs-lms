"use client";

import Link from "next/link";
import { SUBJECT_PLATFORM, type Subject } from "@/lib/subjects";
import { useSubjectTransition } from "@/components/SubjectTransition";
import { TrackCardFX } from "@/components/TrackCardFX";

/** Display name of the platform each subject opens into. */
const PLATFORM_LABEL: Record<string, string> = {
  coding: "STUDIO",
  robotics: "MAKER LAB",
  ai: "NEURAL LAB",
  threed: "3D STUDIO",
};

export function SubjectCard({ subject, index = 0 }: { subject: Subject; index?: number }) {
  const transition = useSubjectTransition();
  const accent = subject.accent;
  const dest = SUBJECT_PLATFORM[subject.id];
  const soon = dest === null;
  const style = { "--acc": accent, animationDelay: `${index * 70}ms`, ...(soon ? { opacity: 0.62, cursor: "default" } : null) } as React.CSSProperties;
  const cardClass = "lab-card card-in group relative flex min-h-[210px] flex-col overflow-hidden rounded-2xl border border-line/60 bg-panel/40 p-6";

  const body = (
    <>
      {/* living, per-track ambient backdrop (code rain / circuits / neural net / cube) */}
      <TrackCardFX subject={subject.id} accent={accent} />
      {/* accent top edge blooms on hover */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        aria-hidden
      />

      <div className="relative z-10 flex flex-1 flex-col">
        <span
          className="grid h-14 w-14 place-items-center rounded-2xl text-3xl transition-transform duration-300 group-hover:scale-110"
          style={{ background: `${accent}1f`, border: `1px solid ${accent}40` }}
          aria-hidden
        >
          {subject.emoji}
        </span>

        <h3 className="mt-4 font-display text-xl font-bold text-ink">{subject.name}</h3>
        <p className="mt-1 text-sm font-medium" style={{ color: accent }}>
          {subject.tagline}
        </p>
        <p className="mt-2 flex-1 text-sm text-ink-dim">{subject.blurb}</p>

        <div className="mt-4 flex items-center justify-between font-mono text-[11px] tracking-tech">
          <span className={soon ? "text-ink-faint" : ""} style={soon ? undefined : { color: accent }}>
            {soon ? "✨ LAUNCHING SOON" : PLATFORM_LABEL[subject.id]}
          </span>
          {soon ? (
            <span className="font-semibold text-ink-faint">SOON</span>
          ) : (
            <span
              className="flex items-center gap-1 font-semibold opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              style={{ color: accent }}
            >
              OPEN <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
            </span>
          )}
        </div>
      </div>
    </>
  );

  if (soon) {
    return (
      <div className={cardClass} style={style} aria-disabled="true" aria-label={`${subject.name} — coming soon`}>
        {body}
      </div>
    );
  }
  return (
    <Link
      href={dest}
      onClick={(e) => {
        if (transition) {
          e.preventDefault();
          transition.go(subject.id, dest);
        }
      }}
      className={cardClass}
      style={style}
    >
      {body}
    </Link>
  );
}
