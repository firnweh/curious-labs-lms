"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActivityProps } from "@/lib/activities/types";

/* ── Train the Sorter 🍎🍌 ─────────────────────────────────────────────────────
   CLASS 4-6 (explorer, age ~9-11) AI lab. Teach a k-NN classifier to sort fruit
   — but the real problem is NOT "label things correctly" (tapping a fruit just
   reveals its true kind for free). The problem is CHOOSING which few examples to
   teach with, because you have a LIMITED LABEL BUDGET that is smaller than the
   pool. The model draws its boundary from the examples you pick, so picking the
   confusing in-between fruit (near the boundary) teaches far more than picking
   the obvious extremes.

   Why it's a real problem, not a one-tap win:
   • R1 — Warm-up. Two clean clusters, comfy budget. Learn the loop: tap fruit to
     teach, then Train to see the model's guesses on hidden test fruit.
   • R2 — Tight budget forces a choice. Reddish bananas sit near pale apples; you
     must spend labels on that overlap, not on the easy corners, or the boundary
     lands wrong and test accuracy stalls.
   • R3 — The TWIST / decoy. Redness LIES here: some apples are pale, some bananas
     are red. Only ROUNDNESS truly separates them. A child who teaches by the
     "red = apple" hunch mis-shapes the boundary and fails; the fix is to spend
     the budget on the cases that break that hunch.

   Optimisation: a clean win uses few labels. Solve every round at/under PAR
   labels → 3 ⭐. Over par but still solved → 2 ⭐. Used Reset/over budget but won
   → 1 ⭐. A clean full-marks solve is always reachable.

   Contract: one onComplete({passed:true,...}) on the FINAL round's win, guarded
   by reportedRef. Wrong tries never call onComplete(passed:false) destructively —
   just a gentle "try teaching the tricky ones" nudge. Deterministic throughout. */

const ACCENT = "#a855f7";
const AMBER = "#f5b942";

type Kind = "apple" | "banana";
const EMOJI: Record<Kind, string> = { apple: "🍎", banana: "🍌" };

interface Fruit {
  id: string;
  truth: Kind;
  /** Feature 1: redness (0 green/yellow … 100 deep red). */
  red: number;
  /** Feature 2: roundness (0 long … 100 perfectly round). */
  round: number;
}

interface Round {
  /** Examples the learner may choose to teach with. */
  pool: Fruit[];
  /** Hidden fruit the trained model is graded on. */
  test: Fruit[];
  /** Max labels the learner may spend this round. */
  budget: number;
  /** PAR — solving with this many labels (or fewer) keeps full marks. */
  par: number;
  /** Accuracy needed to clear the round (percent). */
  target: number;
  /** One-line problem framing shown above the board. */
  brief: string;
}

/* ── Three hand-authored, escalating, fully deterministic rounds ───────────────
   Each is verified by the k-NN classifier below: the PAR set of boundary-ish
   examples clears the target, while only-the-obvious-corners picks fall short. */
const ROUNDS: readonly Round[] = [
  // R1 — warm-up: two clean clusters, roomy budget. Learn the loop.
  {
    brief: "Teach a few of each, then Train. Watch the model sort the hidden fruit.",
    budget: 6,
    par: 4,
    target: 100,
    pool: [
      { id: "1a", truth: "apple", red: 90, round: 88 },
      { id: "1b", truth: "apple", red: 80, round: 78 },
      { id: "1c", truth: "apple", red: 72, round: 70 },
      { id: "1d", truth: "banana", red: 16, round: 18 },
      { id: "1e", truth: "banana", red: 26, round: 24 },
      { id: "1f", truth: "banana", red: 34, round: 32 },
    ],
    test: [
      { id: "1t1", truth: "apple", red: 84, round: 82 },
      { id: "1t2", truth: "apple", red: 70, round: 74 },
      { id: "1t3", truth: "banana", red: 20, round: 22 },
      { id: "1t4", truth: "banana", red: 30, round: 28 },
    ],
  },
  // R2 — a MILD decoy + tight budget. Some apples are pale and one banana is red,
  // so "just teach the reddest apples and yellowest bananas" only reaches 75%.
  // You must teach the odd red banana (2d) so its test twin lands right.
  // Verified: every winning 4-set includes the red banana 2d.
  {
    brief: "Budget is tight, and some fruit are sneaky. Teach the confusing ones!",
    budget: 5,
    par: 4,
    target: 100,
    pool: [
      { id: "2a", truth: "apple", red: 84, round: 80 },
      { id: "2b", truth: "apple", red: 36, round: 72 }, // pale but round apple
      { id: "2c", truth: "apple", red: 58, round: 64 },
      { id: "2d", truth: "banana", red: 72, round: 30 }, // RED but long banana (sneaky)
      { id: "2e", truth: "banana", red: 46, round: 22 },
      { id: "2f", truth: "banana", red: 18, round: 14 },
    ],
    test: [
      { id: "2t1", truth: "apple", red: 30, round: 74 }, // pale apple
      { id: "2t2", truth: "apple", red: 62, round: 66 },
      { id: "2t3", truth: "banana", red: 76, round: 28 }, // red banana → needs 2d
      { id: "2t4", truth: "banana", red: 24, round: 16 },
    ],
  },
  // R3 — the TWIST. Redness is a DECOY: pale apples + red bananas exist.
  // Only roundness separates. "Red = apple" teaching tilts the boundary wrong.
  {
    brief: "Careful — redness lies here! Find what REALLY tells them apart.",
    budget: 5,
    par: 4,
    target: 100,
    pool: [
      { id: "3a", truth: "apple", red: 30, round: 86 }, // PALE but round apple
      { id: "3b", truth: "apple", red: 70, round: 78 },
      { id: "3c", truth: "apple", red: 48, round: 72 }, // mid-red, round apple
      { id: "3d", truth: "banana", red: 74, round: 20 }, // RED but long banana
      { id: "3e", truth: "banana", red: 40, round: 26 },
      { id: "3f", truth: "banana", red: 20, round: 14 },
    ],
    test: [
      { id: "3t1", truth: "apple", red: 26, round: 80 }, // pale + round → apple
      { id: "3t2", truth: "apple", red: 60, round: 74 },
      { id: "3t3", truth: "banana", red: 80, round: 22 }, // red + long → banana
      { id: "3t4", truth: "banana", red: 34, round: 18 },
    ],
  },
];

/** k-NN (k up to 3) over the chosen labelled examples. Deterministic. */
function classify(test: Fruit, labelled: Fruit[]): Kind {
  const k = Math.min(3, labelled.length);
  const ranked = labelled
    .map((f) => ({
      truth: f.truth,
      dist: (test.red - f.red) ** 2 + (test.round - f.round) ** 2,
    }))
    .sort((m, n) => m.dist - n.dist)
    .slice(0, k);
  let apples = 0;
  let bananas = 0;
  for (const r of ranked) r.truth === "apple" ? (apples += 1) : (bananas += 1);
  return apples >= bananas ? "apple" : "banana";
}

interface Scored {
  fruit: Fruit;
  pred: Kind;
  correct: boolean;
}

/** Map feature → SVG coords (shared by training points and test markers). */
const px = (red: number): number => 6 + (red / 100) * 90;
const py = (round: number): number => 94 - (round / 100) * 88;

export default function TraintheSorter({ onComplete }: ActivityProps) {
  const [round, setRound] = useState(0);
  const [chosen, setChosen] = useState<string[]>([]); // pool ids taught this round
  const [scored, setScored] = useState<Scored[] | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [roundDone, setRoundDone] = useState<boolean[]>([false, false, false]);
  const [clean, setClean] = useState<boolean[]>([false, false, false]); // solved at/under par
  const [usedReset, setUsedReset] = useState(false);
  const [nudge, setNudge] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => () => clearTimer(), [clearTimer]);

  const rd = ROUNDS[round];
  const allDone = roundDone.every(Boolean);

  // Fresh round → clear chosen labels & results.
  useEffect(() => {
    setChosen([]);
    setScored(null);
    setAccuracy(null);
    setNudge(null);
  }, [round]);

  const labelled = useMemo(
    () => rd.pool.filter((f) => chosen.includes(f.id)),
    [rd.pool, chosen],
  );
  const hasBoth =
    labelled.some((f) => f.truth === "apple") &&
    labelled.some((f) => f.truth === "banana");
  const budgetLeft = rd.budget - chosen.length;

  const toggle = useCallback(
    (id: string) => {
      if (roundDone[round]) return;
      setScored(null);
      setAccuracy(null);
      setNudge(null);
      setChosen((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id);
        if (prev.length >= rd.budget) {
          setNudge("Budget full — unteach one before teaching another.");
          return prev;
        }
        return [...prev, id];
      });
    },
    [round, roundDone, rd.budget],
  );

  const train = useCallback(() => {
    if (roundDone[round] || !hasBoth) return;
    const results: Scored[] = rd.test.map((f) => {
      const pred = classify(f, labelled);
      return { fruit: f, pred, correct: pred === f.truth };
    });
    const right = results.filter((r) => r.correct).length;
    const acc = Math.round((100 * right) / rd.test.length);
    setScored(results);
    setAccuracy(acc);

    if (acc >= rd.target) {
      const wasClean = chosen.length <= rd.par;
      const nextDone = roundDone.map((v, i) => (i === round ? true : v));
      const nextClean = clean.map((v, i) => (i === round ? wasClean : v));
      setRoundDone(nextDone);
      setClean(nextClean);
      setNudge(
        wasClean
          ? `Solved with ${chosen.length} labels — efficient! ✨`
          : `Solved! (Used ${chosen.length}; ${rd.par} or fewer earns full marks.)`,
      );

      if (round < ROUNDS.length - 1) {
        clearTimer();
        timerRef.current = setTimeout(() => setRound((r) => r + 1), 1150);
      } else if (!reportedRef.current) {
        reportedRef.current = true;
        const allClean = nextClean.every(Boolean);
        const stars: 1 | 2 | 3 = usedReset ? 1 : allClean ? 3 : 2;
        clearTimer();
        timerRef.current = setTimeout(
          () =>
            onComplete({
              passed: true,
              stars,
              detail: allClean
                ? "All three rounds solved with smart, efficient teaching! 🍎🍌"
                : "All three rounds solved! Try fewer labels next time for full marks.",
            }),
          900,
        );
      }
    } else {
      // Gentle, non-destructive nudge — never spam onComplete(passed:false).
      setNudge(
        acc <= 50
          ? "The boundary is off. Teach examples from the confusing in-between zone."
          : `${acc}% — close! One tricky test fruit is on the wrong side. Re-teach near it.`,
      );
    }
  }, [round, roundDone, hasBoth, rd, labelled, chosen, clean, usedReset, onComplete, clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    reportedRef.current = false;
    setRound(0);
    setChosen([]);
    setScored(null);
    setAccuracy(null);
    setRoundDone([false, false, false]);
    setClean([false, false, false]);
    setUsedReset(true);
    setNudge(null);
  }, [clearTimer]);

  const status = allDone
    ? "All rounds solved! Your sorter learned the real pattern. 🎉"
    : roundDone[round]
      ? "Round solved — next round loading…"
      : nudge ??
        (accuracy !== null
          ? `${accuracy}% on the test fruit. Aim for ${rd.target}%.`
          : rd.brief);

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl p-3" style={{ minHeight: 480 }}>
      {/* Header: round progress + budget */}
      <div className="flex items-center justify-between gap-2">
        <span
          aria-hidden
          className="inline-flex items-center gap-1.5"
          data-ais-round={`${round + 1}`}
        >
          {ROUNDS.map((_, i) => {
            const done = roundDone[i];
            const cur = i === round && !allDone;
            return (
              <span
                key={i}
                className="grid h-3.5 w-3.5 place-items-center rounded-full"
                style={{
                  background: done ? ACCENT : cur ? "rgba(168,85,247,0.25)" : "rgba(255,255,255,0.06)",
                  border: `2px solid ${done || cur ? ACCENT : "rgba(120,140,170,0.35)"}`,
                  boxShadow: cur ? `0 0 8px ${ACCENT}88` : undefined,
                }}
              />
            );
          })}
          <span className="ml-1 font-mono text-[11px] text-ink-dim">
            Round {Math.min(round + 1, ROUNDS.length)} / {ROUNDS.length}
          </span>
        </span>
        <span
          className="rounded-md px-2 py-0.5 font-mono text-[11px]"
          style={{
            background: budgetLeft === 0 ? "rgba(245,185,66,0.16)" : "rgba(168,85,247,0.14)",
            color: budgetLeft === 0 ? AMBER : ACCENT,
          }}
          aria-label={`${chosen.length} of ${rd.budget} labels used`}
        >
          🏷️ {chosen.length}/{rd.budget} labels
        </span>
      </div>

      {/* Pool: tap a fruit to teach with it (reveals its true kind for free). */}
      <div className="panel rounded-lg p-2">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-tech text-ink-faint">
          Fruit pool — tap to teach the model with this example
        </p>
        <div className="grid grid-cols-6 gap-1.5">
          {rd.pool.map((f) => {
            const on = chosen.includes(f.id);
            const locked = roundDone[round];
            return (
              <button
                key={f.id}
                type="button"
                disabled={locked}
                aria-pressed={on}
                aria-label={`${EMOJI[f.truth]} ${f.truth}: redness ${f.red}, roundness ${f.round}. ${on ? "Teaching with it" : "Tap to teach"}`}
                onClick={() => toggle(f.id)}
                className="relative flex aspect-square flex-col items-center justify-center rounded-md border bg-panel-2/70 text-xl transition-transform active:scale-95 disabled:opacity-60"
                style={{
                  borderColor: on ? ACCENT : "var(--color-line, #2a2f3a)",
                  boxShadow: on ? `0 0 0 2px ${ACCENT}` : undefined,
                }}
              >
                <span aria-hidden>{EMOJI[f.truth]}</span>
                <span
                  aria-hidden
                  className="font-mono text-[7px] leading-tight text-ink-faint"
                >
                  r{f.red}·○{f.round}
                </span>
                {on && (
                  <span
                    aria-hidden
                    className="absolute right-0.5 top-0.5 grid h-3 w-3 place-items-center rounded-full text-[7px]"
                    style={{ background: ACCENT, color: "#05070d" }}
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scatter / feature map: training points + (after train) test predictions */}
      <div className="panel rounded-lg p-2">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-tech text-ink-faint">
          Feature map {scored ? "— model's guesses on test fruit" : "— what you've taught"}
        </p>
        <svg
          viewBox="0 0 100 100"
          className="w-full rounded-md"
          style={{ background: "rgba(255,255,255,0.02)", aspectRatio: "16 / 9" }}
          role="img"
          aria-label="Scatter plot of fruit by redness across and roundness up"
        >
          <line x1="6" y1="94" x2="98" y2="94" stroke="#3a3f4b" strokeWidth="0.5" />
          <line x1="6" y1="2" x2="6" y2="94" stroke="#3a3f4b" strokeWidth="0.5" />
          <text x="52" y="99" fontSize="3.2" fill="#6b7280" textAnchor="middle">
            redness →
          </text>
          <text
            x="2.6"
            y="48"
            fontSize="3.2"
            fill="#6b7280"
            textAnchor="middle"
            transform="rotate(-90 2.6 48)"
          >
            roundness →
          </text>

          {/* labelled training points (filled = taught) */}
          {labelled.map((f) => (
            <circle
              key={f.id}
              cx={px(f.red)}
              cy={py(f.round)}
              r="2.7"
              fill={f.truth === "apple" ? ACCENT : AMBER}
              opacity="0.92"
            />
          ))}

          {/* test predictions after training (square = model guess; ✕ = wrong) */}
          {scored?.map(({ fruit, pred, correct }) => {
            const cx = px(fruit.red);
            const cy = py(fruit.round);
            return (
              <g key={fruit.id} data-ais-pop="">
                <rect
                  x={cx - 2.6}
                  y={cy - 2.6}
                  width="5.2"
                  height="5.2"
                  rx="1"
                  fill="none"
                  stroke={pred === "apple" ? ACCENT : AMBER}
                  strokeWidth="1"
                />
                {!correct && (
                  <text x={cx} y={cy + 1.2} fontSize="3.8" fill="#ff5d6c" textAnchor="middle">
                    ✕
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <p className="mt-1 font-mono text-[9px] text-ink-faint">
          ● what you taught · ▢ model's guess {scored ? "(✕ = wrong)" : ""}
        </p>
      </div>

      {/* Accuracy meter */}
      {accuracy !== null && (
        <div className="flex items-center gap-2">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-panel-2">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${accuracy}%`,
                background: accuracy >= rd.target ? ACCENT : AMBER,
              }}
            />
          </div>
          <span className="font-mono text-xs" style={{ color: ACCENT }}>
            {accuracy}%
          </span>
        </div>
      )}

      {/* Status / nudge line */}
      <p
        className="text-center font-mono text-xs"
        style={{ color: allDone ? ACCENT : "var(--color-ink-dim, #9aa3b2)" }}
        aria-live="polite"
      >
        {status}
      </p>

      {/* Controls */}
      <div className="mt-auto flex gap-2">
        <button
          type="button"
          onClick={train}
          disabled={!hasBoth || roundDone[round]}
          aria-label="Train the model and test it on the hidden fruit"
          className="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-40"
          style={{ background: ACCENT, color: "#05070d" }}
        >
          {scored ? "Re-train" : "Train"} ▸
        </button>
        <button
          type="button"
          onClick={reset}
          aria-label="Reset back to round one and start over"
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm text-ink-dim"
        >
          Reset
        </button>
      </div>

      <style>{`
        @keyframes ais-pop {
          0%   { transform: scale(0); opacity: 0; }
          60%  { transform: scale(1.25); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        [data-ais-pop] {
          transform-box: fill-box;
          transform-origin: center;
          animation: ais-pop 0.4s cubic-bezier(.34,1.56,.64,1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          [data-ais-pop] { animation: none !important; }
          .transition-all { transition: none !important; }
        }
      `}</style>
    </div>
  );
}
