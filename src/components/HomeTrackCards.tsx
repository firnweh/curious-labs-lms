"use client";

import Link from "next/link";
import { SUBJECTS } from "@/lib/subjects";
import { useSubjectTransition } from "@/components/SubjectTransition";

/**
 * The four track cards on the home "Lab-First Learning Tracks" slide.
 * Same look as before, but a click now fires the per-track launch animation
 * (code-rain / circuit / neural-net / voxels) before opening the track page —
 * matching the behaviour on /tracks. Falls back to a plain link if the
 * transition provider isn't mounted or reduced-motion is on.
 */
export function HomeTrackCards() {
  const transition = useSubjectTransition();

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {SUBJECTS.map((s) => {
        const href = `/subjects/${s.id}`;
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
            className="panel tilt reveal group relative flex flex-col overflow-hidden p-7"
            style={{ color: s.accent }}
          >
            <div
              className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full opacity-40 blur-2xl transition-opacity group-hover:opacity-70"
              style={{ background: s.accent }}
            />
            <div className="flex items-center gap-4">
              <span
                className="grid h-14 w-14 place-items-center rounded-2xl text-3xl"
                style={{ background: `${s.accent}1a`, border: `1px solid ${s.accent}40` }}
              >
                {s.emoji}
              </span>
              <div>
                <h3 className="font-orbitron text-lg font-bold text-ink">{s.name}</h3>
                <p className="text-sm" style={{ color: s.accent }}>{s.tagline}</p>
              </div>
            </div>
            <p className="mt-4 flex-1 text-sm text-ink-dim">{s.blurb}</p>
            <span
              className="mt-5 font-mono text-xs tracking-tech opacity-80 transition-transform group-hover:translate-x-1"
              style={{ color: s.accent }}
            >
              ENTER TRACK →
            </span>
          </Link>
        );
      })}
    </div>
  );
}
