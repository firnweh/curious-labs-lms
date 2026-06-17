"use client";

import { useState } from "react";
import Link from "next/link";
import { ACTIVITY_COMPONENTS } from "@/lib/activities/componentMap";
import { getActivityMeta, activitiesBySubject } from "@/lib/activities/registry";
import { SUBJECT_MAP } from "@/lib/subjects";
import { useProgress } from "@/lib/progress";
import type { ActivityResult } from "@/lib/activities/types";
import { Stars, Difficulty, Tag, BackLink } from "@/components/ui";

export function LabShell({ id }: { id: string }) {
  const meta = getActivityMeta(id);
  const Activity = ACTIVITY_COMPONENTS[id];
  const { markComplete, starsFor } = useProgress();
  const [result, setResult] = useState<ActivityResult | null>(null);
  const [attempt, setAttempt] = useState(0);

  if (!meta || !Activity) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-24 text-center">
        <p className="font-mono text-neon-red">404 // lab not found</p>
        <Link href="/" className="mt-4 inline-block text-ink-dim hover:text-ink">
          ← Back to home
        </Link>
      </div>
    );
  }

  const subject = SUBJECT_MAP[meta.subject];
  const accent = subject.accent;
  const earned = starsFor(id);
  const peers = activitiesBySubject(meta.subject);
  const idx = peers.findIndex((a) => a.id === id);
  const next = peers[idx + 1];

  function handleComplete(r: ActivityResult) {
    setResult(r);
    if (r.passed) markComplete(id, r.stars ?? 3);
  }

  function restart() {
    setResult(null);
    setAttempt((n) => n + 1);
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-6" style={{ color: accent }}>
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackLink href={`/subjects/${meta.subject}`} label={`Back to ${subject.name}`} />
        <div className="flex items-center gap-2">
          <Tag accent={accent}>{subject.name.toUpperCase()}</Tag>
          {earned > 0 && <Stars value={earned} />}
        </div>
      </div>

      <div className="mt-4 flex items-start gap-4">
        <span className="text-4xl animate-float" aria-hidden>
          {meta.emoji}
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
            {meta.title}
          </h1>
          <p className="mt-1 max-w-2xl text-ink-dim">{meta.objective}</p>
        </div>
      </div>

      {/* body grid */}
      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* activity canvas */}
        <div
          className="panel relative overflow-hidden p-4 sm:p-5"
          style={{ borderColor: `${accent}40` }}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
          />
          <Activity key={attempt} onComplete={handleComplete} />
        </div>

        {/* sidebar */}
        <aside className="space-y-4">
          <div className="panel p-5">
            <h2 className="font-mono text-xs tracking-tech text-ink-faint">MISSION</h2>
            <ol className="mt-3 space-y-2.5">
              {meta.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm text-ink-dim">
                  <span
                    className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] font-mono"
                    style={{ borderColor: `${accent}66`, color: accent }}
                  >
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="panel p-5">
            <div className="flex items-center justify-between">
              <Difficulty level={meta.difficulty} />
              <span className="font-mono text-xs text-ink-faint">~{meta.estMinutes} min</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {meta.concepts.map((c) => (
                <Tag key={c}>{c}</Tag>
              ))}
            </div>
            <p className="mt-3 font-mono text-[11px] text-ink-faint">
              Recommended grades {meta.grades}
            </p>
          </div>

          <button
            onClick={restart}
            className="w-full rounded-xl border border-line bg-panel/60 px-4 py-2.5 text-sm text-ink-dim transition-colors hover:border-ink-faint hover:text-ink"
          >
            ↺ Restart lab
          </button>
        </aside>
      </div>

      {/* result overlay */}
      {result && (
        <ResultBanner
          result={result}
          accent={accent}
          nextHref={next ? `/activity/${next.id}` : `/subjects/${meta.subject}`}
          nextLabel={next ? `Next: ${next.title}` : `Back to ${subject.name}`}
          onRetry={restart}
        />
      )}
    </div>
  );
}

function ResultBanner({
  result,
  accent,
  nextHref,
  nextLabel,
  onRetry,
}: {
  result: ActivityResult;
  accent: string;
  nextHref: string;
  nextLabel: string;
  onRetry: () => void;
}) {
  if (!result.passed) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-6">
        <div className="panel flex items-center gap-4 px-5 py-3.5 text-sm" style={{ borderColor: "#f43f5e66" }}>
          <span className="text-neon-red">✕</span>
          <span className="text-ink-dim">{result.detail ?? "Not quite — adjust and try again."}</span>
          <button onClick={onRetry} className="font-mono text-xs text-neon-cyan hover:underline">
            RETRY
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-base/70 px-4 backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 28 }).map((_, i) => (
          <span
            key={i}
            className="absolute top-0 h-2 w-2 rounded-[1px]"
            style={{
              left: `${(i * 37) % 100}%`,
              background: [accent, "#22d3ee", "#a855f7", "#34d399", "#f59e0b"][i % 5],
              animation: `confetti-fall ${1.6 + (i % 5) * 0.25}s ${(i % 7) * 0.12}s ease-in forwards`,
            }}
          />
        ))}
      </div>
      <div className="panel relative w-full max-w-sm p-7 text-center" style={{ borderColor: `${accent}66` }}>
        <div className="mx-auto mb-3 flex justify-center">
          <Stars value={result.stars ?? 3} size={28} />
        </div>
        <h2 className="font-display text-2xl font-bold text-ink">Lab complete!</h2>
        <p className="mt-2 text-sm text-ink-dim">
          {result.detail ?? "You cracked it. Your progress is saved on this device."}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href={nextHref}
            className="rounded-xl px-4 py-2.5 font-medium text-base transition-transform hover:scale-[1.02]"
            style={{ background: accent, color: "#05070d" }}
          >
            {nextLabel} →
          </Link>
          <button onClick={onRetry} className="text-sm text-ink-faint hover:text-ink-dim">
            Replay this lab
          </button>
        </div>
      </div>
    </div>
  );
}
