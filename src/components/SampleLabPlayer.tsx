"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ACTIVITY_COMPONENTS } from "@/lib/activities/componentMap";
import { getActivityMeta } from "@/lib/activities/registry";
import { SUBJECT_MAP } from "@/lib/subjects";
import { useProgress } from "@/lib/progress";
import { XP_PER_STAR } from "@/lib/gamification";
import type { ActivityResult } from "@/lib/activities/types";
import { Stars, Difficulty } from "@/components/ui";

/** One featured lab per track — the homepage "play it right here" sampler. */
const SAMPLE_IDS = ["code-maze", "robo-circuit", "ai-sorter", "threed-voxel"];

/**
 * An actual interactive lab embedded in the homepage. Visitors play and solve
 * without navigating away; a solve grants real XP (via useProgress) and offers
 * to open the full lab or try another track. Touch events are isolated so the
 * surrounding CosmicCarousel never swipes mid-drag.
 */
export function SampleLabPlayer() {
  const samples = SAMPLE_IDS.filter((id) => getActivityMeta(id) && ACTIVITY_COMPONENTS[id]);
  const [activeId, setActiveId] = useState(samples[0]);
  const [attempt, setAttempt] = useState(0);
  const [solved, setSolved] = useState<ActivityResult | null>(null);
  const { markComplete } = useProgress();

  const meta = getActivityMeta(activeId);
  const Activity = ACTIVITY_COMPONENTS[activeId];
  const subject = meta ? SUBJECT_MAP[meta.subject] : undefined;
  const accent = subject?.accent ?? "#22d3ee";

  const handleComplete = useCallback(
    (r: ActivityResult) => {
      if (r.passed && !solved) {
        markComplete(activeId, r.stars ?? 3);
        setSolved(r);
      }
    },
    [activeId, solved, markComplete],
  );

  const switchTo = useCallback((id: string) => {
    setActiveId(id);
    setSolved(null);
    setAttempt(0);
  }, []);

  const replay = useCallback(() => {
    setSolved(null);
    setAttempt((a) => a + 1);
  }, []);

  const nextTrack = useCallback(() => {
    const idx = samples.indexOf(activeId);
    switchTo(samples[(idx + 1) % samples.length]);
  }, [samples, activeId, switchTo]);

  if (!meta || !Activity) return null;

  const stars = solved?.stars ?? 3;

  return (
    <div
      className="mx-auto max-w-3xl"
      // Isolate touches so dragging inside a lab never triggers a carousel swipe.
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {/* track selector chips */}
      <div className="mb-5 flex flex-wrap justify-center gap-2">
        {samples.map((id) => {
          const m = getActivityMeta(id);
          if (!m) return null;
          const a = SUBJECT_MAP[m.subject].accent;
          const active = id === activeId;
          return (
            <button
              key={id}
              type="button"
              onClick={() => switchTo(id)}
              aria-pressed={active}
              className="flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition"
              style={
                active
                  ? { background: a, borderColor: a, color: "#060810" }
                  : { borderColor: "var(--color-line)", color: "#9fb0d0", background: "rgba(11,16,32,0.6)" }
              }
            >
              <span aria-hidden className="text-base">{m.emoji}</span>
              <span className="hidden sm:inline">{m.title}</span>
              <span className="sm:hidden">{SUBJECT_MAP[m.subject].name}</span>
            </button>
          );
        })}
      </div>

      {/* player panel */}
      <div
        className="panel relative overflow-hidden p-4 sm:p-5"
        style={{ borderColor: `${accent}55`, boxShadow: `0 0 40px -22px ${accent}` }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        />

        {/* header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-2xl"
              style={{ background: `${accent}1a`, border: `1px solid ${accent}40` }}
              aria-hidden
            >
              {meta.emoji}
            </span>
            <div>
              <h3 className="font-orbitron text-lg font-bold text-ink">{meta.title}</h3>
              <p className="mt-0.5 max-w-md text-sm text-ink-dim">{meta.blurb}</p>
            </div>
          </div>
          <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
            <Difficulty level={meta.difficulty} />
            <span className="font-mono text-xs text-ink-faint">~{meta.estMinutes} min</span>
          </div>
        </div>

        {/* live activity */}
        <div className="rounded-xl">
          <Activity key={`${activeId}:${attempt}`} onComplete={handleComplete} />
        </div>

        {/* solved celebration */}
        {solved && (
          <div
            className="absolute inset-x-3 bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-xl border p-3 backdrop-blur-sm"
            style={{ borderColor: accent, background: "rgba(6,8,16,0.86)" }}
            role="status"
            aria-live="polite"
          >
            <span className="text-2xl" aria-hidden>🎉</span>
            <div className="mr-auto">
              <p className="font-display font-bold text-ink">Solved it!</p>
              <span className="flex items-center gap-2 text-sm text-ink-dim">
                <Stars value={stars} size={14} />
                <span style={{ color: accent }}>+{stars * XP_PER_STAR} XP</span>
              </span>
            </div>
            <button
              type="button"
              onClick={replay}
              className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-sm font-medium text-ink-dim transition hover:text-ink"
            >
              🔁 Replay
            </button>
            <button
              type="button"
              onClick={nextTrack}
              className="rounded-lg border px-3 py-2 text-sm font-medium transition"
              style={{ borderColor: `${accent}66`, color: accent }}
            >
              Next track →
            </button>
            <Link
              href={`/activity/${activeId}`}
              className="rounded-lg px-3 py-2 text-sm font-semibold"
              style={{ background: accent, color: "#060810" }}
            >
              Open full lab →
            </Link>
          </div>
        )}
      </div>

      {/* footer */}
      <div className="mt-4 flex items-center justify-center gap-4">
        <p className="font-mono text-xs text-ink-faint">No sign-up · plays right here</p>
        <Link href="/tracks" className="btn-secondary reveal !px-5 !py-2 !text-sm">
          See all labs →
        </Link>
      </div>
    </div>
  );
}
