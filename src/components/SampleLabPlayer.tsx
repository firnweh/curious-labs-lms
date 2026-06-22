"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ACTIVITY_COMPONENTS } from "@/lib/activities/componentMap";
import { getActivityMeta } from "@/lib/activities/registry";
import { SUBJECT_MAP } from "@/lib/subjects";
import { useProgress } from "@/lib/progress";
import { XP_PER_STAR } from "@/lib/gamification";
import type { ActivityResult } from "@/lib/activities/types";
import { Stars, Difficulty } from "@/components/ui";

type BandId = "junior" | "explorer" | "innovator";

const BANDS: { id: BandId; label: string; emoji: string; accent: string }[] = [
  { id: "junior", label: "Class 1–3", emoji: "🐣", accent: "#34d399" },
  { id: "explorer", label: "Class 4–6", emoji: "🚀", accent: "#22d3ee" },
  { id: "innovator", label: "Class 7–10", emoji: "🧠", accent: "#a855f7" },
];

/** One featured, age-right lab per track for each class band. */
const BAND_SAMPLES: Record<BandId, string[]> = {
  junior: ["jc-go", "jr-light", "j-ai-sort", "j-3d-stack"],
  explorer: ["code-maze", "robo-circuit", "ai-sorter", "threed-voxel"],
  innovator: ["g8-delivery-pathfinder", "g9-pid-navigator", "g8-object-detection-lab", "g7-gear-design"],
};

/**
 * An actual interactive lab embedded in the homepage, framed like a little
 * device. Visitors pick a class level (which swaps the sample to an age-right
 * lab), play and solve right here — a solve grants real XP. Touch events are
 * isolated so the surrounding CosmicCarousel never swipes mid-drag.
 */
export function SampleLabPlayer() {
  const [band, setBand] = useState<BandId>("explorer");
  const samples = useMemo(
    () => BAND_SAMPLES[band].filter((id) => getActivityMeta(id) && ACTIVITY_COMPONENTS[id]),
    [band],
  );
  const [activeId, setActiveId] = useState(samples[0]);
  const [attempt, setAttempt] = useState(0);
  const [solved, setSolved] = useState<ActivityResult | null>(null);
  const { markComplete } = useProgress();

  // Keep activeId valid for the current band.
  const currentId = samples.includes(activeId) ? activeId : samples[0];
  const meta = getActivityMeta(currentId);
  const Activity = ACTIVITY_COMPONENTS[currentId];
  const subject = meta ? SUBJECT_MAP[meta.subject] : undefined;
  const accent = subject?.accent ?? "#22d3ee";
  const bandInfo = BANDS.find((b) => b.id === band) ?? BANDS[1];

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
      className="mx-auto max-w-3xl"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {/* class-level toggle */}
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        <span className="font-mono text-[11px] tracking-tech text-ink-faint">PICK A CLASS</span>
        {BANDS.map((b) => {
          const active = b.id === band;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => switchBand(b.id)}
              aria-pressed={active}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition"
              style={
                active
                  ? { background: b.accent, borderColor: b.accent, color: "#060810" }
                  : { borderColor: `${b.accent}55`, color: b.accent, background: "rgba(11,16,32,0.5)" }
              }
            >
              <span aria-hidden>{b.emoji}</span>
              {b.label}
            </button>
          );
        })}
      </div>

      {/* track selector chips (within the chosen class) */}
      <div className="mb-3 flex flex-wrap justify-center gap-2">
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

      {/* ── the "device" ── */}
      <div
        className="overflow-hidden rounded-2xl border bg-[#070b16]"
        style={{ borderColor: `${accent}55`, boxShadow: `0 0 44px -20px ${accent}, inset 0 1px 0 0 ${accent}22` }}
      >
        {/* device top bar */}
        <div
          className="flex items-center justify-between gap-3 border-b px-4 py-2.5"
          style={{ borderColor: "var(--color-line)", background: "rgba(11,16,32,0.6)" }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="relative grid h-2.5 w-2.5 place-items-center" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-pulse-glow rounded-full" style={{ background: "#34d399" }} />
              <span className="inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "#34d399" }} />
            </span>
            <span className="font-mono text-[11px] tracking-tech text-ink-faint">LIVE</span>
            <span className="truncate text-sm font-semibold text-ink">
              <span aria-hidden className="mr-1">{meta.emoji}</span>
              {meta.title}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <span
              className="hidden rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-tech sm:inline"
              style={{ borderColor: `${bandInfo.accent}55`, color: bandInfo.accent }}
            >
              {bandInfo.emoji} {bandInfo.label}
            </span>
            <span className="hidden sm:block"><Difficulty level={meta.difficulty} /></span>
            <span className="font-mono text-[11px] text-ink-faint">~{meta.estMinutes}m</span>
          </div>
        </div>

        {/* screen */}
        <div className="relative p-4 sm:p-5">
          <p className="mb-3 text-center text-sm text-ink-dim">{meta.blurb}</p>
          <Activity key={`${currentId}:${attempt}`} onComplete={handleComplete} />

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
                href={`/activity/${currentId}`}
                className="rounded-lg px-3 py-2 text-sm font-semibold"
                style={{ background: accent, color: "#060810" }}
              >
                Open full lab →
              </Link>
            </div>
          )}
        </div>

        {/* device bottom brand strip */}
        <div
          className="border-t px-4 py-2 text-center font-mono text-[10px] tracking-tech text-ink-faint"
          style={{ borderColor: "var(--color-line)", background: "rgba(11,16,32,0.6)" }}
        >
          ⚡ POWERED BY PHYSICS WALLAH · PLAYS IN YOUR BROWSER · NO INSTALL
        </div>
      </div>

      {/* footer */}
      <div className="mt-3 flex items-center justify-center gap-4">
        <p className="font-mono text-xs text-ink-faint">No sign-up needed</p>
        <Link href="/tracks" className="btn-secondary !px-5 !py-2 !text-sm">
          See all labs →
        </Link>
      </div>
    </div>
  );
}
