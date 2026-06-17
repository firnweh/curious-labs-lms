"use client";

import Link from "next/link";
import type { ActivityMeta } from "@/lib/activities/types";
import { SUBJECT_MAP } from "@/lib/subjects";
import { useProgress } from "@/lib/progress";
import { useSubjectTransition } from "@/components/SubjectTransition";
import { Difficulty, Stars } from "@/components/ui";

export function ActivityCard({ meta }: { meta: ActivityMeta }) {
  const { isComplete, starsFor } = useProgress();
  const transition = useSubjectTransition();
  const accent = SUBJECT_MAP[meta.subject].accent;
  const done = isComplete(meta.id);
  const href = `/activity/${meta.id}`;

  return (
    <Link
      href={href}
      onClick={(e) => {
        if (transition) {
          e.preventDefault();
          transition.go(meta.subject, href);
        }
      }}
      className="panel panel-hover group relative flex flex-col p-5"
      style={{ color: accent }}
    >
      {done && (
        <span className="absolute right-4 top-4 flex items-center gap-1 text-xs" style={{ color: accent }}>
          <Stars value={starsFor(meta.id)} size={13} />
        </span>
      )}
      <div className="flex items-center gap-3">
        <span
          className="grid h-11 w-11 place-items-center rounded-xl text-2xl"
          style={{ background: `${accent}1a`, border: `1px solid ${accent}40` }}
        >
          {meta.emoji}
        </span>
        <div>
          <h3 className="font-display font-semibold text-ink">{meta.title}</h3>
          <p className="font-mono text-[11px] text-ink-faint">Grades {meta.grades}</p>
        </div>
      </div>
      <p className="mt-3 flex-1 text-sm text-ink-dim">{meta.blurb}</p>
      <div className="mt-4 flex items-center justify-between">
        <Difficulty level={meta.difficulty} />
        <span
          className="font-mono text-xs opacity-80 transition-transform group-hover:translate-x-0.5"
          style={{ color: accent }}
        >
          {done ? "REPLAY" : "START"} →
        </span>
      </div>
    </Link>
  );
}
