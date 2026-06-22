"use client";

import Link from "next/link";
import { SUBJECTS } from "@/lib/subjects";
import { activitiesBySubject } from "@/lib/activities/registry";
import { useSubjectTransition } from "@/components/SubjectTransition";
import { TrackCardFX } from "@/components/TrackCardFX";

/**
 * Minimal "live tiles" for the home Tracks slide. Each tile is mostly its
 * signature looping animation (code-rain / circuit / neural-net / voxel cube),
 * with a clean label resting at the bottom over a soft scrim. A click fires the
 * per-track launch animation before opening the track page.
 */
export function HomeTrackCards() {
  const transition = useSubjectTransition();

  return (
    <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
      {SUBJECTS.map((s) => {
        const href = `/subjects/${s.id}`;
        const count = activitiesBySubject(s.id).length;
        return (
          <Link
            key={s.id}
            href={href}
            onClick={(e) => {
              if (transition) {
                e.preventDefault();
                transition.go(s.id, href);
              }
            }}
            aria-label={`${s.name} — ${count} labs`}
            className="group relative flex min-h-[200px] flex-col justify-end overflow-hidden rounded-3xl border border-line/40 bg-[#080d1a] p-6 transition-all duration-300 hover:-translate-y-1"
            style={{ color: s.accent }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${s.accent}66`)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
          >
            {/* living backdrop (hero) */}
            <TrackCardFX subject={s.id} accent={s.accent} />

            {/* legibility scrim under the label */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#080d1a] via-[#080d1a]/70 to-transparent" />

            {/* minimal label */}
            <div className="relative flex items-end justify-between gap-3">
              <div>
                <span className="inline-block text-4xl transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110" aria-hidden>
                  {s.emoji}
                </span>
                <h3 className="mt-2 font-orbitron text-2xl font-bold text-ink">{s.name}</h3>
                <p className="mt-0.5 font-mono text-[11px] tracking-tech" style={{ color: s.accent }}>
                  {count} LABS
                </p>
              </div>
              <span
                className="mb-1 -translate-x-1 text-2xl opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                style={{ color: s.accent }}
                aria-hidden
              >
                →
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
