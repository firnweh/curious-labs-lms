"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ACTIVITY_COMPONENTS } from "@/lib/activities/componentMap";
import { getActivityMeta } from "@/lib/activities/registry";
import { SUBJECT_MAP } from "@/lib/subjects";
import { useProgress } from "@/lib/progress";
import { XP_PER_STAR } from "@/lib/gamification";
import type { ActivityResult } from "@/lib/activities/types";
import { Stars } from "@/components/ui";

type BandId = "junior" | "explorer" | "innovator";

const BANDS: { id: BandId; label: string; accent: string }[] = [
  { id: "junior", label: "Class 1–3", accent: "#34d399" },
  { id: "explorer", label: "Class 4–6", accent: "#22d3ee" },
  { id: "innovator", label: "Class 7–10", accent: "#a855f7" },
];

const SUBJECT_SHORT: Record<string, string> = {
  coding: "Coding",
  robotics: "Robotics",
  ai: "AI",
  threed: "3D",
};

/** One featured, age-right lab per track for each class band. */
const BAND_SAMPLES: Record<BandId, string[]> = {
  junior: ["jc-go", "jr-light", "j-ai-sort", "j-3d-stack"],
  explorer: ["code-maze", "robo-circuit", "ai-sorter", "threed-voxel"],
  innovator: ["g8-delivery-pathfinder", "g9-pid-navigator", "g8-object-detection-lab", "g7-gear-design"],
};

/**
 * An actual interactive lab embedded in the homepage, in a clean, restrained
 * card. A segmented control picks the class level (swapping the sample to an
 * age-right lab); minimal icon tabs pick the track. Touch events are isolated
 * so the surrounding CosmicCarousel never swipes mid-drag.
 */
export function SampleLabPlayer() {
  const [band, setBand] = useState<BandId>("explorer");
  const bandIndex = BANDS.findIndex((b) => b.id === band);
  const samples = useMemo(
    () => BAND_SAMPLES[band].filter((id) => getActivityMeta(id) && ACTIVITY_COMPONENTS[id]),
    [band],
  );
  const [activeId, setActiveId] = useState(samples[0]);
  const [attempt, setAttempt] = useState(0);
  const [solved, setSolved] = useState<ActivityResult | null>(null);
  const { markComplete } = useProgress();

  const currentId = samples.includes(activeId) ? activeId : samples[0];
  const meta = getActivityMeta(currentId);
  const Activity = ACTIVITY_COMPONENTS[currentId];
  const subject = meta ? SUBJECT_MAP[meta.subject] : undefined;
  const accent = subject?.accent ?? "#22d3ee";

  const handleComplete = useCallback(
    (r: ActivityResult) => {
      if (r.passed && !solved) {
        markComplete(currentId, r.stars ?? 3);
        setSolved(r);
      }
    },
    [currentId, solved, markComplete],
  );

  const switchTo = useCallback((id: string) => {
    setActiveId(id);
    setSolved(null);
    setAttempt(0);
  }, []);

  const switchBand = useCallback((b: BandId) => {
    setBand(b);
    setActiveId(BAND_SAMPLES[b][0]);
    setSolved(null);
    setAttempt(0);
  }, []);

  const replay = useCallback(() => {
    setSolved(null);
    setAttempt((a) => a + 1);
  }, []);

  const nextTrack = useCallback(() => {
    const idx = samples.indexOf(currentId);
    switchTo(samples[(idx + 1) % samples.length]);
  }, [samples, currentId, switchTo]);

  if (!meta || !Activity) return null;

  const stars = solved?.stars ?? 3;

  return (
    <div
      className="mx-auto max-w-2xl"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {/* segmented class control */}
      <div className="mb-5 flex justify-center">
        <div className="relative grid grid-cols-3 rounded-full border border-line/70 bg-panel/40 p-1">
          <span
            className="pointer-events-none absolute inset-y-1 left-1 rounded-full bg-white/[0.07] shadow-inner transition-transform duration-300 ease-out"
            style={{ width: "calc((100% - 0.5rem) / 3)", transform: `translateX(${bandIndex * 100}%)` }}
            aria-hidden
          />
          {BANDS.map((b, i) => {
            const active = i === bandIndex;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => switchBand(b.id)}
                aria-pressed={active}
                className="relative z-10 whitespace-nowrap rounded-full px-5 py-1.5 text-center text-sm font-medium transition-colors"
                style={{ color: active ? b.accent : "var(--color-ink-dim)" }}
              >
                {b.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* track tabs (icon + underline) */}
      <div className="mb-4 flex justify-center gap-1 border-b border-line/50">
        {samples.map((id) => {
          const m = getActivityMeta(id);
          if (!m) return null;
          const a = SUBJECT_MAP[m.subject].accent;
          const active = id === currentId;
          return (
            <button
              key={id}
              type="button"
              onClick={() => switchTo(id)}
              aria-pressed={active}
              className="relative flex items-center gap-1.5 px-3 py-2 text-sm transition-colors"
              style={{ color: active ? "var(--color-ink)" : "var(--color-ink-faint)" }}
            >
              <span className="text-base" aria-hidden>{m.emoji}</span>
              <span className={active ? "inline" : "hidden sm:inline"}>{SUBJECT_SHORT[m.subject] ?? m.subject}</span>
              {active && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full" style={{ background: a }} aria-hidden />
              )}
            </button>
          );
        })}
      </div>

      {/* the lab card — hairline, soft, restrained */}
      <div className="relative overflow-hidden rounded-2xl border border-line/70 bg-gradient-to-b from-panel to-panel-2 p-5 shadow-[0_28px_70px_-34px_rgba(0,0,0,0.95)] sm:p-6">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-tech text-ink-faint">INTERACTIVE · PLAYS IN YOUR BROWSER</p>
            <h3 className="mt-1 truncate font-display text-lg font-bold text-ink">
              <span aria-hidden className="mr-1.5">{meta.emoji}</span>
              {meta.title}
            </h3>
          </div>
          <span className="shrink-0 font-mono text-xs text-ink-faint">~{meta.estMinutes} min</span>
        </div>

        <Activity key={`${currentId}:${attempt}`} onComplete={handleComplete} />

        {/* solved celebration */}
        {solved && (
          <div
            className="absolute inset-x-4 bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-xl border p-3 backdrop-blur-sm"
            style={{ borderColor: accent, background: "rgba(6,8,16,0.88)" }}
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
            <Link
              href={`/activity/${currentId}`}
              className="rounded-lg px-3 py-2 text-sm font-semibold"
              style={{ background: accent, color: "#060810" }}
            >
              Open full lab →
            </Link>
          </div>
        )}
      </div>

      {/* footer */}
      <div className="mt-4 text-center">
        <Link href="/tracks" className="font-mono text-xs tracking-tech text-ink-faint transition-colors hover:text-ink">
          See all labs →
        </Link>
      </div>
    </div>
  );
}
