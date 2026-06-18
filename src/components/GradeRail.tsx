"use client";

import Link from "next/link";
import { gradesWithContent } from "@/lib/activities/registry";

/** Grades 1–10. Those with built labs link through; the rest read "soon". */
export function GradeRail() {
  const ready = new Set(gradesWithContent());

  return (
    <div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((g) => {
        const live = ready.has(g);
        const inner = (
          <>
            <span className="font-display text-xl font-bold text-ink">{g}</span>
            <span
              className="font-mono text-[10px] tracking-tech"
              style={{ color: live ? "#22d3ee" : undefined }}
            >
              {live ? "PLAY" : "SOON"}
            </span>
          </>
        );
        return live ? (
          <Link
            key={g}
            href={`/grade/${g}`}
            className="panel panel-hover flex flex-col items-center gap-1 py-4 text-neon-cyan"
            style={{ borderColor: "#22d3ee55" }}
            aria-label={`Grade ${g} — open labs`}
          >
            {inner}
          </Link>
        ) : (
          <div
            key={g}
            className="panel flex flex-col items-center gap-1 py-4 opacity-45"
            aria-label={`Grade ${g} — coming soon`}
          >
            {inner}
          </div>
        );
      })}
    </div>
  );
}
