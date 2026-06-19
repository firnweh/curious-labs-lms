"use client";
// LEARNING GOAL: an emotion-recognition model maps facial-feature numbers to a
// label via fixed weighted rules — and can be confidently wrong, so balanced
// training data matters for fairness.
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

const ACCENT = "#a855f7";

/** The three tunable facial features, each a slider in [0, 100]. */
interface Face {
  /** Inner brow height: 0 = pulled down/angry, 100 = raised/surprised. */
  brow: number;
  /** Mouth curve: 0 = deep frown, 50 = flat, 100 = big smile. */
  mouth: number;
  /** Eye openness: 0 = squinted, 100 = wide open. */
  eyes: number;
}

type EmotionId = "happy" | "sad" | "surprised" | "angry" | "calm" | "sleepy" | "shocked";

interface Emotion {
  id: EmotionId;
  label: string;
  face: string;
  /** Weighted rule: score = w·(feature − centre). Highest score wins. */
  brow: number;
  mouth: number;
  eyes: number;
  /** Feature setpoint the rule is centred on (the "ideal" face). */
  target: Face;
}

/**
 * A fixed 7-emotion deck. `target` is a face that makes THIS emotion win the
 * sort; the slider ranges below are wide, so each card is always reachable.
 * Scores are dot products of (feature−50)/50 with the per-emotion weights.
 */
const DECK: readonly Emotion[] = [
  {
    id: "happy",
    label: "Happy",
    face: "😊",
    brow: 0.2,
    mouth: 1.6,
    eyes: 0.4,
    target: { brow: 55, mouth: 92, eyes: 60 },
  },
  {
    id: "sad",
    label: "Sad",
    face: "😢",
    brow: -0.4,
    mouth: -1.6,
    eyes: -0.5,
    target: { brow: 30, mouth: 8, eyes: 35 },
  },
  {
    id: "surprised",
    label: "Surprised",
    face: "😮",
    brow: 1.5,
    mouth: 0.3,
    eyes: 1.4,
    target: { brow: 92, mouth: 60, eyes: 92 },
  },
  {
    id: "angry",
    label: "Angry",
    face: "😠",
    brow: -1.6,
    mouth: -0.6,
    eyes: 0.3,
    target: { brow: 6, mouth: 25, eyes: 58 },
  },
  {
    id: "calm",
    label: "Calm",
    face: "😌",
    brow: 0.1,
    mouth: 1.0,
    eyes: -0.6,
    target: { brow: 52, mouth: 78, eyes: 32 },
  },
  {
    id: "sleepy",
    label: "Sleepy",
    face: "😴",
    brow: -0.3,
    mouth: -0.2,
    eyes: -1.7,
    target: { brow: 40, mouth: 42, eyes: 5 },
  },
  {
    id: "shocked",
    label: "Shocked",
    face: "😲",
    brow: 1.3,
    mouth: -1.0,
    eyes: 1.5,
    target: { brow: 90, mouth: 14, eyes: 94 },
  },
] as const;

/** Map a feature in [0,100] to a centred signal in [-1,1]. */
function norm(v: number): number {
  return (v - 50) / 50;
}

/** Raw model score for one emotion given a face. */
function rawScore(e: Emotion, f: Face): number {
  return e.brow * norm(f.brow) + e.mouth * norm(f.mouth) + e.eyes * norm(f.eyes);
}

/** Softmax → confidence percentages, sorted high→low. */
function classify(
  f: Face,
  bias: number,
): { id: EmotionId; label: string; face: string; pct: number }[] {
  // `bias` shrinks scores for "underrepresented" inputs in Phase 2 (unfair gap).
  const scaled = DECK.map((e) => ({ e, s: rawScore(e, f) * bias }));
  const max = Math.max(...scaled.map((x) => x.s));
  const exps = scaled.map((x) => ({ e: x.e, ex: Math.exp((x.s - max) * 1.6) }));
  const sum = exps.reduce((a, x) => a + x.ex, 0);
  return exps
    .map((x) => ({
      id: x.e.id,
      label: x.e.label,
      face: x.e.face,
      pct: (x.ex / sum) * 100,
    }))
    .sort((a, b) => b.pct - a.pct);
}

const START: Face = { brow: 50, mouth: 50, eyes: 50 };

/** Confidence drop the audit applies to "Lighting B" before the data fix. */
const BIAS_BEFORE = 0.45;
/** After adding diverse data, both profiles match. */
const BIAS_AFTER = 1;
/** Fairness gap must fall below this (percentage points) to pass Phase 2. */
const GAP_THRESHOLD = 8;
/** How many of the 7 cards must be classified correctly. */
const NEED = 5;

export default function EmotionReaderLab({ onComplete }: ActivityProps) {
  const [face, setFace] = useState<Face>({ ...START });
  const [idx, setIdx] = useState<number>(0);
  // Per-card record: undefined = unattempted, true/false = locked result.
  const [marks, setMarks] = useState<(boolean | undefined)[]>(
    () => DECK.map(() => undefined),
  );
  const [phase, setPhase] = useState<1 | 2>(1);
  const [balanced, setBalanced] = useState<boolean>(false);
  const [won, setWon] = useState<boolean>(false);
  const completed = useRef<boolean>(false);

  const target = DECK[idx];

  const ranking = useMemo(() => classify(face, 1), [face]);
  const topId = ranking[0].id;
  const isCorrect = topId === target.id;

  const correctCount = useMemo(
    () => marks.reduce<number>((n, m) => (m === true ? n + 1 : n), 0),
    [marks],
  );
  const phase1Done = correctCount >= NEED;

  // Phase 2 audit: same face, two lighting profiles. The gap is the difference
  // in the model's confidence for the SAME top label across both profiles.
  const audit = useMemo(() => {
    const bias = balanced ? BIAS_AFTER : BIAS_BEFORE;
    const a = classify(face, 1);
    const b = classify(face, bias);
    const topA = a[0];
    const matchB = b.find((r) => r.id === topA.id) ?? b[0];
    const gap = Math.abs(topA.pct - matchB.pct);
    return { label: topA.label, face: topA.face, pctA: topA.pct, pctB: matchB.pct, gap };
  }, [face, balanced]);

  const gapClosed = audit.gap < GAP_THRESHOLD;

  const setFeature = useCallback(
    (key: keyof Face) => (e: React.ChangeEvent<HTMLInputElement>): void => {
      const v = Number(e.target.value);
      setFace((prev) => ({ ...prev, [key]: v }));
    },
    [],
  );

  // Lock the current card's result, advancing to the next unmarked one.
  const lockCard = useCallback((): void => {
    if (won) return;
    setMarks((prev) => {
      const next = [...prev];
      next[idx] = isCorrect;
      const nextUnmarked = next.findIndex((m, i) => m === undefined && i !== idx);
      if (nextUnmarked >= 0) {
        setIdx(nextUnmarked);
        setFace({ ...START });
      }
      return next;
    });
    if (!isCorrect) {
      onComplete({
        passed: false,
        detail: `The model read “${target.label}” as “${ranking[0].label}”. Re-shape the face and try again.`,
      });
    }
  }, [won, idx, isCorrect, onComplete, target.label, ranking]);

  const retryCard = useCallback((): void => {
    if (won) return;
    setMarks((prev) => {
      const next = [...prev];
      next[idx] = undefined;
      return next;
    });
    setFace({ ...START });
  }, [won, idx]);

  const goToPhase2 = useCallback((): void => {
    if (phase1Done) setPhase(2);
  }, [phase1Done]);

  const toggleBalance = useCallback((): void => {
    if (won) return;
    setBalanced((b) => !b);
  }, [won]);

  // The single, guarded win.
  const finish = useCallback((): void => {
    if (completed.current || won) return;
    if (phase1Done && gapClosed && balanced) {
      completed.current = true;
      setWon(true);
      onComplete({
        passed: true,
        stars: 3,
        detail: `${correctCount}/7 expressions read correctly and the fairness gap closed to ${audit.gap.toFixed(0)} pts.`,
      });
    } else {
      onComplete({
        passed: false,
        detail: gapClosed
          ? "Keep the diverse-data switch on to lock the fair result."
          : "The two lighting profiles still disagree — add diverse training data.",
      });
    }
  }, [won, phase1Done, gapClosed, balanced, onComplete, correctCount, audit.gap]);

  const reset = useCallback((): void => {
    setFace({ ...START });
    setIdx(0);
    setMarks(DECK.map(() => undefined));
    setPhase(1);
    setBalanced(false);
    setWon(false);
    completed.current = false;
  }, []);

  const sliders: { key: keyof Face; label: string; lo: string; hi: string }[] = [
    { key: "brow", label: "Eyebrow angle", lo: "lowered", hi: "raised" },
    { key: "mouth", label: "Mouth curve", lo: "frown", hi: "smile" },
    { key: "eyes", label: "Eye openness", lo: "squint", hi: "wide" },
  ];

  // SVG face geometry derived from the feature values.
  const browY = 34 - (norm(face.brow) * 7);
  const browTilt = norm(face.brow) * -6;
  const lid = 7 - (face.eyes / 100) * 6; // smaller = more open
  const mouthCurve = (norm(face.mouth)) * 14; // +down control => smile

  return (
    <div
      className="mx-auto flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink"
      style={{ touchAction: "manipulation" }}
    >
      <style>{`
        @keyframes g8emotionreader-pop {
          0% { transform: scale(0.7); opacity: 0; }
          60% { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g8emotionreader-bar {
          from { width: 0%; }
        }
        @keyframes g8emotionreader-glow {
          0%,100% { filter: drop-shadow(0 0 2px ${ACCENT}); }
          50% { filter: drop-shadow(0 0 8px ${ACCENT}); }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: ACCENT }}>
          😊 Emotion Reader Lab
        </h2>
        <span className="text-[11px] text-ink-faint">
          Phase {phase} / 2
        </span>
      </div>

      {/* The face the model "sees" */}
      <div className="panel rounded-xl p-3">
        <div className="flex items-stretch gap-3">
          <svg
            viewBox="0 0 100 100"
            className="block h-28 w-28 shrink-0 rounded-lg"
            role="img"
            aria-label={`Face with eyebrows ${face.brow}, mouth ${face.mouth}, eyes ${face.eyes}`}
            style={{ background: "#160d22" }}
          >
            <circle cx={50} cy={52} r={34} fill="#2a1b3d" stroke={ACCENT} strokeWidth={1.5} />
            {/* eyebrows */}
            <line x1={28} y1={browY} x2={42} y2={browY + browTilt} stroke="#e9d5ff" strokeWidth={2.4} strokeLinecap="round" />
            <line x1={58} y1={browY + browTilt} x2={72} y2={browY} stroke="#e9d5ff" strokeWidth={2.4} strokeLinecap="round" />
            {/* eyes */}
            <ellipse cx={35} cy={48} rx={5} ry={Math.max(1.2, 7 - lid + 1)} fill="#fff" />
            <ellipse cx={65} cy={48} rx={5} ry={Math.max(1.2, 7 - lid + 1)} fill="#fff" />
            <circle cx={35} cy={48} r={2.2} fill="#160d22" />
            <circle cx={65} cy={48} r={2.2} fill="#160d22" />
            {/* mouth */}
            <path
              d={`M 36 70 Q 50 ${70 + mouthCurve} 64 70`}
              fill="none"
              stroke="#f0abfc"
              strokeWidth={2.6}
              strokeLinecap="round"
            />
          </svg>

          {phase === 1 ? (
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
              <span className="text-[11px] text-ink-faint">Target card</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl" aria-hidden="true">{target.face}</span>
                <span className="text-lg font-semibold" style={{ color: ACCENT }}>
                  {target.label}
                </span>
              </div>
              <span
                className="mt-1 inline-flex w-fit items-center gap-1 rounded-md px-2 py-0.5 text-[11px]"
                style={{
                  background: isCorrect ? "rgba(168,85,247,0.18)" : "rgba(248,113,113,0.14)",
                  color: isCorrect ? ACCENT : "#fca5a5",
                }}
                role="status"
                aria-live="polite"
              >
                {isCorrect ? "✓ model agrees" : `✗ reads “${ranking[0].label}”`}
              </span>
              <span className="text-[11px] text-ink-faint">
                Card {idx + 1} of 7 · {correctCount}/{NEED} needed
              </span>
            </div>
          ) : (
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
              <span className="text-[11px] text-ink-faint">Bias audit</span>
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-hidden="true">{audit.face}</span>
                <span className="text-base font-semibold" style={{ color: ACCENT }}>
                  {audit.label}
                </span>
              </div>
              <span className="text-[11px] text-ink-faint">
                Same face, two lighting profiles.
              </span>
            </div>
          )}
        </div>
      </div>

      {phase === 1 && (
        <>
          {/* Live confidence chart */}
          <div className="panel rounded-xl p-3" aria-label="Model confidence chart" role="group">
            <span className="mb-1 block text-[11px] text-ink-faint">
              Simulated CNN confidence
            </span>
            <div className="flex flex-col gap-1">
              {ranking.slice(0, 4).map((r, i) => (
                <div key={r.id} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-[11px] text-ink-dim">{r.label}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-panel-2">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${r.pct.toFixed(1)}%`,
                        background: i === 0 ? ACCENT : "#5b3a82",
                      }}
                    />
                  </div>
                  <span className="w-9 shrink-0 text-right text-[11px] tabular-nums" style={{ color: i === 0 ? ACCENT : undefined }}>
                    {r.pct.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Sliders */}
          <div className="panel flex flex-col gap-2.5 rounded-xl p-3">
            {sliders.map(({ key, label, lo, hi }) => (
              <label key={key} className="flex flex-col gap-1 text-xs">
                <span className="flex items-center justify-between text-ink-dim">
                  <span>{label}</span>
                  <span className="tabular-nums" style={{ color: ACCENT }}>{face[key]}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={face[key]}
                  onChange={setFeature(key)}
                  disabled={won}
                  aria-label={`${label}, ${face[key]} of 100`}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2"
                  style={{ accentColor: ACCENT, touchAction: "none" }}
                />
                <span className="flex justify-between text-[10px] text-ink-faint">
                  <span>{lo}</span>
                  <span>{hi}</span>
                </span>
              </label>
            ))}
          </div>

          {/* Card actions + deck strip */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onPointerDown={lockCard}
              disabled={won}
              className="rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
              style={{ background: ACCENT, color: "#160d22" }}
              aria-label="Lock this card's classification and go to the next"
            >
              {isCorrect ? "Lock ✓ & next" : "Lock result"}
            </button>
            <button
              type="button"
              onPointerDown={retryCard}
              disabled={won}
              className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-xs text-ink-dim disabled:opacity-50"
              aria-label="Clear this card and retry"
            >
              Retry card
            </button>
            <button
              type="button"
              onPointerDown={goToPhase2}
              disabled={!phase1Done}
              className="ml-auto rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-40"
              style={{
                border: `1px solid ${ACCENT}`,
                color: phase1Done ? ACCENT : undefined,
              }}
              aria-label="Go to the fairness bias audit"
            >
              Bias audit →
            </button>
          </div>

          <div className="flex flex-wrap gap-1" role="list" aria-label="Card results">
            {DECK.map((e, i) => {
              const m = marks[i];
              const here = i === idx;
              return (
                <button
                  key={e.id}
                  type="button"
                  onPointerDown={() => {
                    if (!won) {
                      setIdx(i);
                      setFace({ ...START });
                    }
                  }}
                  role="listitem"
                  aria-label={`${e.label}: ${m === true ? "correct" : m === false ? "wrong" : "not done"}`}
                  className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px]"
                  style={{
                    border: here ? `1px solid ${ACCENT}` : "1px solid transparent",
                    background:
                      m === true ? "rgba(168,85,247,0.18)" : m === false ? "rgba(248,113,113,0.14)" : "rgba(255,255,255,0.04)",
                  }}
                >
                  <span aria-hidden="true">{e.face}</span>
                  <span aria-hidden="true">{m === true ? "✓" : m === false ? "✗" : "·"}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {phase === 2 && (
        <>
          {/* Two-profile comparison */}
          <div className="panel flex flex-col gap-2 rounded-xl p-3">
            <span className="text-[11px] text-ink-faint">
              Confidence for “{audit.label}” under each profile
            </span>
            {[
              { name: "Lighting A", pct: audit.pctA },
              { name: "Lighting B", pct: audit.pctB },
            ].map((p) => (
              <div key={p.name} className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-[11px] text-ink-dim">{p.name}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-panel-2">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${p.pct.toFixed(1)}%`, background: ACCENT }}
                  />
                </div>
                <span className="w-9 shrink-0 text-right text-[11px] tabular-nums">
                  {p.pct.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>

          {/* Fairness-gap meter */}
          <div className="panel rounded-xl p-3">
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="text-ink-dim">Fairness gap</span>
              <span
                className="tabular-nums font-semibold"
                style={{ color: gapClosed ? ACCENT : "#fca5a5" }}
                role="status"
                aria-live="polite"
              >
                {audit.gap.toFixed(0)} pts {gapClosed ? "✓ fair" : `(need < ${GAP_THRESHOLD})`}
              </span>
            </div>
            <div className="relative h-3 overflow-hidden rounded-full bg-panel-2">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, audit.gap * 2)}%`,
                  background: gapClosed ? ACCENT : "#f87171",
                }}
              />
              <div
                className="absolute top-0 h-full w-px"
                style={{ left: `${GAP_THRESHOLD * 2}%`, background: "#e9d5ff" }}
                aria-hidden="true"
              />
            </div>
          </div>

          {/* Data-balance switch */}
          <button
            type="button"
            onPointerDown={toggleBalance}
            disabled={won}
            role="switch"
            aria-checked={balanced}
            aria-label="Add more diverse training data"
            className="panel flex items-center justify-between rounded-xl p-3 text-left disabled:opacity-60"
          >
            <span className="flex flex-col">
              <span className="text-sm font-medium text-ink">Add diverse training data</span>
              <span className="text-[11px] text-ink-faint">
                Rebalances the model weights across both profiles.
              </span>
            </span>
            <span
              className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
              style={{ background: balanced ? ACCENT : "#3f3155" }}
            >
              <span
                className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
                style={{ left: balanced ? 22 : 2 }}
              />
            </span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onPointerDown={() => setPhase(1)}
              disabled={won}
              className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-xs text-ink-dim disabled:opacity-50"
              aria-label="Back to expression cards"
            >
              ← Cards
            </button>
            <button
              type="button"
              onPointerDown={finish}
              disabled={won}
              className="ml-auto rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              style={{ background: ACCENT, color: "#160d22" }}
              aria-label="Submit the fair model"
            >
              {won ? "Done ✓" : "Submit fair model"}
            </button>
          </div>

          <p className="text-[11px] leading-snug text-ink-faint">
            Reflect: why might a model trained on one kind of face read others
            wrongly — and who could that harm?
          </p>
        </>
      )}

      {/* Win celebration */}
      {won && (
        <div
          className="panel rounded-xl p-4 text-center"
          style={{
            border: `1px solid ${ACCENT}`,
            animation: "g8emotionreader-pop 360ms ease-out",
          }}
          role="status"
          aria-live="assertive"
        >
          <div className="text-2xl">✨🎉 ⭐⭐⭐</div>
          <p className="mt-1 text-sm font-semibold" style={{ color: ACCENT }}>
            Fair &amp; accurate model shipped!
          </p>
          <p className="mt-1 text-[11px] text-ink-faint">
            {correctCount}/7 read correctly · gap closed to {audit.gap.toFixed(0)} pts.
          </p>
        </div>
      )}

      <div className="flex justify-center">
        <button
          type="button"
          onPointerDown={reset}
          className="rounded-lg border border-line bg-panel/60 px-4 py-1.5 text-xs text-ink-dim"
          aria-label="Reset the whole lab"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
