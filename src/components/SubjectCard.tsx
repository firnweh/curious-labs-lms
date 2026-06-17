"use client";

import Link from "next/link";
import type { Subject } from "@/lib/subjects";
import type { ActivityMeta } from "@/lib/activities/types";
import { useProgress } from "@/lib/progress";
import { useSubjectTransition } from "@/components/SubjectTransition";

export function SubjectCard({
  subject,
  activities,
}: {
  subject: Subject;
  activities: ActivityMeta[];
}) {
  const { isComplete } = useProgress();
  const transition = useSubjectTransition();
  const total = activities.length;
  const done = activities.filter((a) => isComplete(a.id)).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const accent = subject.accent;
  const href = `/subjects/${subject.id}`;

  return (
    <Link
      href={href}
      onClick={(e) => {
        if (transition) {
          e.preventDefault();
          transition.go(subject.id, href);
        }
      }}
      className="panel panel-hover group relative flex flex-col overflow-hidden p-6"
      style={{ color: accent }}
    >
      {/* glow corner */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-40 blur-2xl transition-opacity group-hover:opacity-70"
        style={{ background: accent }}
      />
      <div className="flex items-start justify-between">
        <span className="text-4xl">{subject.emoji}</span>
        <span className="font-mono text-xs text-ink-faint">{total} labs</span>
      </div>
      <h3 className="mt-4 font-display text-xl font-bold text-ink">{subject.name}</h3>
      <p className="mt-1 text-sm" style={{ color: accent }}>
        {subject.tagline}
      </p>
      <p className="mt-3 flex-1 text-sm text-ink-dim">{subject.blurb}</p>

      {/* progress bar */}
      <div className="mt-5">
        <div className="flex items-center justify-between font-mono text-[11px] text-ink-faint">
          <span>{done}/{total} complete</span>
          <span>{pct}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: accent, boxShadow: `0 0 12px ${accent}` }}
          />
        </div>
      </div>
    </Link>
  );
}
