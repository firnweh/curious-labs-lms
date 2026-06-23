"use client";

import { useState } from "react";
import { activitiesByGrade } from "@/lib/activities/registry";
import { SUBJECTS, SUBJECT_MAP } from "@/lib/subjects";
import { ActivityCard } from "@/components/ActivityCard";
import type { SubjectId } from "@/lib/activities/types";

/**
 * A grade's full set of curriculum labs, browsable by subject.
 * "All" shows every project in calendar (projectNo) order; a subject chip
 * filters down to just that track while keeping the same card grid.
 */
export function GradeView({ grade }: { grade: number }) {
  const labs = activitiesByGrade(grade);
  const [filter, setFilter] = useState<SubjectId | "all">("all");

  const present = SUBJECTS.filter((s) => labs.some((l) => l.subject === s.id));
  const shown = filter === "all" ? labs : labs.filter((l) => l.subject === filter);

  return (
    <div>
      {/* subject filter chips */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Chip active={filter === "all"} onClick={() => setFilter("all")} accent="#9fb0d0">
          All · {labs.length}
        </Chip>
        {present.map((s) => {
          const count = labs.filter((l) => l.subject === s.id).length;
          return (
            <Chip
              key={s.id}
              active={filter === s.id}
              onClick={() => setFilter(s.id)}
              accent={s.accent}
            >
              <span aria-hidden>{s.emoji}</span> {s.name} · {count}
            </Chip>
          );
        })}
      </div>

      {/* cards, each tagged with its curriculum month */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((meta, i) => (
          <div key={meta.id} className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] tracking-tech text-ink-faint">
              {(meta.month ?? "").toUpperCase()}
              {meta.month && " · "}
              <span style={{ color: SUBJECT_MAP[meta.subject].accent }}>
                {SUBJECT_MAP[meta.subject].name}
              </span>
            </span>
            <ActivityCard meta={meta} index={i} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  accent,
  children,
}: {
  active: boolean;
  onClick: () => void;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-full border px-3.5 py-1.5 text-sm font-medium transition"
      style={
        active
          ? { background: accent, borderColor: accent, color: "#060810" }
          : { borderColor: "var(--color-line)", color: "#9fb0d0", background: "rgba(11,16,32,0.6)" }
      }
    >
      {children}
    </button>
  );
}
