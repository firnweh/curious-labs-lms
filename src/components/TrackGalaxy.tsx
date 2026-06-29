"use client";

import type { CSSProperties } from "react";
import { SUBJECTS, SUBJECT_PLATFORM } from "@/lib/subjects";
import { activitiesBySubject } from "@/lib/activities/registry";
import { useSubjectTransition } from "@/components/SubjectTransition";

/**
 * "Choose your world" — the 4 tracks as glowing planets floating in space.
 * Tapping one fires the launch transition and travels into that track. A more
 * playful, explorable way in than a list, keeping the cosmic theme.
 */
export function TrackGalaxy() {
  const transition = useSubjectTransition();

  return (
    <section className="track-galaxy">
      <div className="text-center">
        <p className="font-mono text-xs tracking-tech text-neon-cyan">CHOOSE YOUR WORLD</p>
        <h2
          className="mt-2 font-orbitron text-3xl font-black tracking-tight text-ink sm:text-4xl"
          style={{ textShadow: "0 0 26px rgba(34,211,238,.4)" }}
        >
          Pick a planet to explore
        </h2>
        <p className="mt-2 text-ink-dim">Tap a world to blast in and start making.</p>
      </div>

      <div className="track-galaxy-orbits">
        {SUBJECTS.map((s, i) => {
          const count = activitiesBySubject(s.id).length;
          const dest = SUBJECT_PLATFORM[s.id];
          const soon = dest === null;
          return (
            <button
              key={s.id}
              type="button"
              className="planet-world"
              style={{ "--acc": s.accent, "--d": `${(i * 0.45).toFixed(2)}s`, opacity: soon ? 0.6 : 1 } as CSSProperties}
              aria-label={soon ? `${s.name} — coming soon` : `Enter ${s.name}`}
              aria-disabled={soon}
              onClick={() => {
                if (soon || !dest) return;
                if (transition) transition.go(s.id, dest);
                else window.location.href = dest;
              }}
            >
              <span className="planet-orb" aria-hidden>
                <span className="planet-ring" />
                <span className="planet-emoji">{s.emoji}</span>
              </span>
              <span className="planet-name">{s.name}</span>
              <span className="planet-count">{soon ? "coming soon" : `${count} labs`}</span>
              <span className="planet-enter">{soon ? "SOON" : "ENTER →"}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
