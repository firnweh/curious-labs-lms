"use client";

import Link from "next/link";
import type { ActivityMeta } from "@/lib/activities/types";
import { SUBJECT_MAP } from "@/lib/subjects";
import { useProgress } from "@/lib/progress";
import { useSubjectTransition } from "@/components/SubjectTransition";
import { Difficulty, Stars } from "@/components/ui";

export function ActivityCard({ meta, index = 0 }: { meta: ActivityMeta; index?: number }) {
  const { isComplete, starsFor } = useProgress();
  const transition = useSubjectTransition();
  const accent = SUBJECT_MAP[meta.subject].accent;
  const done = isComplete(meta.id);
  const href = `/activity/${meta.id}`;

  const style = { "--acc": accent, animationDelay: `${index * 45}ms` } as React.CSSProperties;

  return (
    <Link
      href={href}
      onClick={(e) => {
        if (transition) {
          e.preventDefault();
          transition.go(meta.subject, href);
        }
      }}
      className="lab-card card-in group relative flex flex-col overflow-hidden rounded-2xl border border-line/60 bg-panel/40 p-5"
      style={style}
    >
      {/* accent line + glow that bloom on hover */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-25"
        style={{ background: accent }}
        aria-hidden
      />

      <div className="flex items-start gap-3">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl transition-transform duration-300 group-hover:scale-110"
          style={{ background: `${accent}14`, border: `1px solid ${accent}33` }}
        >
          {meta.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display font-semibold text-ink">{meta.title}</h3>
          <p className="mt-0.5 font-mono text-[11px] tracking-tech text-ink-faint">
            ~{meta.estMinutes} MIN · GR {meta.grades}
          </p>
        </div>
        {done && <Stars value={starsFor(meta.id)} size={13} />}
      </div>

      <p className="mt-3 line-clamp-2 flex-1 text-sm text-ink-dim">{meta.blurb}</p>

      <div className="mt-4 flex items-center justify-between">
        <Difficulty level={meta.difficulty} />
        <span className="flex items-center gap-1 font-mono text-xs font-semibold" style={{ color: accent }}>
          {done ? "REPLAY" : "START"}
          <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
        </span>
      </div>
    </Link>
  );
}
