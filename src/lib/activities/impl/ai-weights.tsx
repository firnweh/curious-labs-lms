"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActivityProps } from "@/lib/activities/types";

/* ── Tune the Brain 🧠 ─────────────────────────────────────────────────────────
   CLASS 4-6 (explorer, age ~9-11) AI lab. A perceptron is the tiniest "brain":
   it draws ONE straight line and calls everything on one side violet, everything
   on the other side cyan. The learner sets three knobs — w₁ (x weight), w₂ (y
   weight), b (bias) — to rotate & slide that line until every dot sits on its
   own colour's side.

   Why it's a real problem, not slider-wiggling:
   • PREDICT → TEST loop. Live wiggling no longer auto-wins. You arrange the line,
     then press TEST to "run the brain". Only a tested layout can score. This
     turns it from luck into plan-then-check.
   • THREE escalating rounds, each a different separating line:
       R1 — diagonal split (x+y), the gentle warm-up.
       R2 — a nearly VERTICAL split: clusters left vs right, so "x+y works for
            everything" fails. You must lean on w₁ and zero-out w₂-thinking.
       R3 — the TWIST: clusters sit along a tilted line that needs a NEGATIVE
            weight plus an off-centre bias. The naive "both weights positive,
            bias zero" guess from R1/R2 misclassifies — you must reason about
            which side is which.
   • OPTIMISE for stars. Solve all three using few TESTs → 3 stars; more tests →
     2; lots of tests → still a win at 1 star. A clean win is always reachable.

   Solve a round → it locks in and the next, harder dataset slides in. Win all
   three → celebration + onComplete({passed:true, stars}) exactly once, guarded.
   A failed TEST never scolds and never reports — the misclassified dots just get
   a red ring so you can see what to fix. Always winnable. Deterministic. */

const ACCENT = "#a855f7";
const CYAN = "#22d3ee";

/** Data-space half-extent. Points & axes live in [-RANGE, RANGE]. */
const RANGE = 5;

interface Pt {
  x: number;
  y: number;
  /** True class: +1 (violet) vs -1 (cyan). */
  label: 1 | -1;
}

interface Weights {
  w1: number;
  w2: number;
  b: number;
}

interface Round {
  /** Linearly-separable dataset, hand-picked so nothing sits on a boundary. */
  data: readonly Pt[];
  /** A wrong-ish starting position so the line begins misclassifying several. */
  start: Weights;
  /** Short kid-facing description of this round's challenge. */
  hint: string;
}

/* ── Round 1 — diagonal split along x+y. Violet upper-right, cyan lower-left.
   A line like x + y = 0 (w1=1, w2=1, b=0) separates them. ───────────────────── */
const R1: readonly Pt[] = [
  { x: 1.2, y: 2.6, label: 1 },
  { x: 3.1, y: 1.4, label: 1 },
  { x: 2.4, y: 3.3, label: 1 },
  { x: 4.0, y: 2.2, label: 1 },
  { x: 0.9, y: 4.1, label: 1 },
  { x: 3.6, y: 3.8, label: 1 },
  { x: 2.0, y: 1.9, label: 1 },
  { x: 4.3, y: 0.8, label: 1 },
  { x: 1.6, y: 3.0, label: 1 },
  { x: 3.0, y: 2.7, label: 1 },
  { x: -1.4, y: -2.4, label: -1 },
  { x: -3.0, y: -1.2, label: -1 },
  { x: -2.2, y: -3.1, label: -1 },
  { x: -4.1, y: -1.9, label: -1 },
  { x: -0.8, y: -3.9, label: -1 },
  { x: -3.5, y: -3.6, label: -1 },
  { x: -1.9, y: -1.7, label: -1 },
  { x: -4.2, y: -0.7, label: -1 },
  { x: -1.5, y: -2.9, label: -1 },
  { x: -2.8, y: -2.5, label: -1 },
];

/* ── Round 2 — vertical-ish split: violet on the RIGHT (x large), cyan on the
   LEFT (x small). Spread across all y. A line like x = 0 (w1=1, w2=0, b=0)
   separates them — "x+y works for everything" now fails. ────────────────────── */
const R2: readonly Pt[] = [
  { x: 1.6, y: 3.8, label: 1 },
  { x: 2.4, y: -3.2, label: 1 },
  { x: 3.7, y: 1.1, label: 1 },
  { x: 1.3, y: -1.4, label: 1 },
  { x: 4.2, y: 3.0, label: 1 },
  { x: 2.0, y: 0.4, label: 1 },
  { x: 3.1, y: -4.0, label: 1 },
  { x: 4.4, y: -0.9, label: 1 },
  { x: 1.1, y: 2.2, label: 1 },
  { x: 2.8, y: 4.3, label: 1 },
  { x: -1.5, y: 3.6, label: -1 },
  { x: -2.7, y: -3.0, label: -1 },
  { x: -3.9, y: 1.0, label: -1 },
  { x: -1.2, y: -1.7, label: -1 },
  { x: -4.3, y: 2.8, label: -1 },
  { x: -2.1, y: 0.2, label: -1 },
  { x: -3.3, y: -4.1, label: -1 },
  { x: -4.4, y: -0.6, label: -1 },
  { x: -1.0, y: 2.0, label: -1 },
  { x: -2.6, y: 4.2, label: -1 },
];

/* ── Round 3 — the TWIST. Boundary is the tilted line  -x + y = 1.5  (i.e.
   y = x + 1.5). Violet sits BELOW-RIGHT of it (where -x + y - 1.5 < 0, so the
   line w1=1, w2=-1, b=1.5 scores POSITIVE → violet). Cyan sits above-left.
   The "both weights positive, bias zero" habit from R1 fails badly here — you
   must use a NEGATIVE weight and an off-centre bias and reason about sides.
   Verified: every point is strictly off the boundary. ───────────────────────── */
const R3: readonly Pt[] = [
  // violet: below-right of y = x + 1.5  (y < x + 1.5)
  { x: 0.5, y: -3.0, label: 1 },
  { x: 3.0, y: 1.0, label: 1 },
  { x: -1.0, y: -3.5, label: 1 },
  { x: 4.2, y: 0.5, label: 1 },
  { x: 2.0, y: -1.0, label: 1 },
  { x: 4.5, y: 4.0, label: 1 },
  { x: 1.5, y: -2.6, label: 1 },
  { x: -2.5, y: -4.5, label: 1 },
  { x: 3.5, y: -2.0, label: 1 },
  { x: 0.0, y: -2.0, label: 1 },
  // cyan: above-left of y = x + 1.5  (y > x + 1.5)
  { x: -3.0, y: 1.0, label: -1 },
  { x: 0.5, y: 4.0, label: -1 },
  { x: -4.0, y: -1.0, label: -1 },
  { x: -1.5, y: 2.5, label: -1 },
  { x: -4.5, y: 2.0, label: -1 },
  { x: 1.0, y: 4.5, label: -1 },
  { x: -2.0, y: 0.5, label: -1 },
  { x: -4.2, y: 4.4, label: -1 },
  { x: -0.5, y: 3.0, label: -1 },
  { x: -3.5, y: -1.0, label: -1 },
];

const ROUNDS: readonly Round[] = [
  { data: R1, start: { w1: 0, w2: 1, b: 3 }, hint: "Violet sits upper-right, cyan lower-left." },
  { data: R2, start: { w1: 0, w2: 1, b: 0 }, hint: "Now violet is on the RIGHT, cyan on the LEFT. Up/down no longer matters." },
  { data: R3, start: { w1: 1, w2: 1, b: 0 }, hint: "Tricky! The split is a slanted line. One weight may need to go NEGATIVE." },
];

/** Perceptron score for a point: positive => predicts class +1 (violet). */
function score(w: Weights, p: { x: number; y: number }): number {
  return w.w1 * p.x + w.w2 * p.y + w.b;
}

const TOTAL_ROUNDS = ROUNDS.length;
/** Test-count thresholds (across all rounds) for the star award. */
const STAR3_MAX_TESTS = 9; // ~3 clean tests per round
const STAR2_MAX_TESTS = 16;

type Phase = "tuning" | "checked" | "solved" | "done";

export default function TuneTheBrain({ onComplete }: ActivityProps) {
  const [round, setRound] = useState<number>(0);
  const [w, setW] = useState<Weights>({ ...ROUNDS[0].start });
  const [phase, setPhase] = useState<Phase>("tuning");
  /** The weights that were last TESTED — grading reads these, not live wiggle. */
  const [tested, setTested] = useState<Weights | null>(null);
  const [totalTests, setTotalTests] = useState<number>(0);

  const reportedRef = useRef<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => () => clearTimer(), [clearTimer]);

  const cur = ROUNDS[round];
  const DATA = cur.data;

  // SVG geometry: a square viewBox. Data [-RANGE,RANGE] maps to [PAD, SIZE-PAD].
  const SIZE = 100;
  const PAD = 8;
  const span = SIZE - PAD * 2;
  const toX = useCallback(
    (dx: number): number => PAD + ((dx + RANGE) / (2 * RANGE)) * span,
    [span],
  );
  const toY = useCallback(
    // flip Y so +data is up
    (dy: number): number => PAD + ((RANGE - dy) / (2 * RANGE)) * span,
    [span],
  );

  // LIVE preview classification (drives the picture as you drag sliders).
  const liveResults = useMemo(
    () =>
      DATA.map((p) => {
        const s = score(w, p);
        const pred: 1 | -1 = s >= 0 ? 1 : -1;
        return { p, correct: pred === p.label };
      }),
    [w, DATA],
  );

  // The classification that GRADING sees — only updates on TEST.
  const checkedResults = useMemo(() => {
    if (!tested) return null;
    return DATA.map((p) => {
      const s = score(tested, p);
      const pred: 1 | -1 = s >= 0 ? 1 : -1;
      return { p, correct: pred === p.label };
    });
  }, [tested, DATA]);

  // Which set of results the canvas shows: tested result if we just checked &
  // haven't touched a slider since; otherwise the live preview (no red rings).
  const showChecked = phase === "checked" || phase === "solved" || phase === "done";
  const shown = showChecked && checkedResults ? checkedResults : liveResults;

  const total = DATA.length;
  const correctNow = useMemo(
    () => (checkedResults ?? liveResults).reduce((n, r) => (r.correct ? n + 1 : n), 0),
    [checkedResults, liveResults],
  );

  const finalStars = useMemo<1 | 2 | 3>(() => {
    if (totalTests <= STAR3_MAX_TESTS) return 3;
    if (totalTests <= STAR2_MAX_TESTS) return 2;
    return 1;
  }, [totalTests]);

  // Boundary line endpoints: w1*x + w2*y + b = 0, clipped to the data box.
  const line = useMemo(() => {
    const { w1, w2, b } = w;
    const lo = -RANGE;
    const hi = RANGE;
    type P = { x: number; y: number };
    const pts: P[] = [];
    const push = (p: P) => {
      if (p.x >= lo - 1e-6 && p.x <= hi + 1e-6 && p.y >= lo - 1e-6 && p.y <= hi + 1e-6) {
        pts.push(p);
      }
    };
    if (Math.abs(w2) > 1e-9) {
      push({ x: lo, y: -(w1 * lo + b) / w2 });
      push({ x: hi, y: -(w1 * hi + b) / w2 });
    }
    if (Math.abs(w1) > 1e-9) {
      push({ x: -(w2 * lo + b) / w1, y: lo });
      push({ x: -(w2 * hi + b) / w1, y: hi });
    }
    if (pts.length < 2) return null;
    let a = pts[0];
    let c = pts[1];
    let best = -1;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = (pts[i].x - pts[j].x) ** 2 + (pts[i].y - pts[j].y) ** 2;
        if (d > best) {
          best = d;
          a = pts[i];
          c = pts[j];
        }
      }
    }
    return { x1: toX(a.x), y1: toY(a.y), x2: toX(c.x), y2: toY(c.y) };
  }, [w, toX, toY]);

  // A filled polygon for the +1 (violet) half-plane, for soft shading.
  const shade = useMemo(() => {
    const { w1, w2, b } = w;
    const lo = -RANGE;
    const hi = RANGE;
    const corners = [
      { x: lo, y: lo },
      { x: hi, y: lo },
      { x: hi, y: hi },
      { x: lo, y: hi },
    ];
    const inside = corners.filter((c) => w1 * c.x + w2 * c.y + b >= 0);
    if (line && inside.length > 0 && inside.length < 4) {
      const a = { x: line.x1, y: line.y1 };
      const c = { x: line.x2, y: line.y2 };
      const cx = (PAD * 2 + span) / 2;
      const cy = (PAD * 2 + span) / 2;
      const insidePx = inside.map((p) => ({ x: toX(p.x), y: toY(p.y) }));
      const all = [a, c, ...insidePx];
      all.sort(
        (p, q) => Math.atan2(p.y - cy, p.x - cx) - Math.atan2(q.y - cy, q.x - cx),
      );
      return all.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
    }
    if (inside.length === 4) {
      return `${PAD},${PAD} ${PAD + span},${PAD} ${PAD + span},${PAD + span} ${PAD},${PAD + span}`;
    }
    return null;
  }, [w, line, span, toX, toY]);

  // ── Slider change: editing always returns to "tuning" (red rings clear) ──
  const update = useCallback(
    (key: keyof Weights) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      setW((prev) => ({ ...prev, [key]: v }));
      setPhase((ph) => (ph === "checked" ? "tuning" : ph));
    },
    [],
  );

  // ── TEST = "run the brain": commit the current weights & grade them ──
  const test = useCallback(() => {
    if (phase === "solved" || phase === "done") return;
    const committed = { ...w };
    const allCorrect = DATA.every((p) => {
      const pred: 1 | -1 = score(committed, p) >= 0 ? 1 : -1;
      return pred === p.label;
    });
    setTested(committed);
    setTotalTests((n) => n + 1);

    if (!allCorrect) {
      setPhase("checked"); // show red rings, gentle retry — no onComplete
      return;
    }

    // Round solved.
    if (round >= TOTAL_ROUNDS - 1) {
      setPhase("done");
      if (!reportedRef.current) {
        reportedRef.current = true;
        // Star tally uses the just-incremented count.
        const tests = totalTests + 1;
        const stars: 1 | 2 | 3 =
          tests <= STAR3_MAX_TESTS ? 3 : tests <= STAR2_MAX_TESTS ? 2 : 1;
        onComplete({
          passed: true,
          stars,
          detail: `All 3 brains tuned in ${tests} test${tests === 1 ? "" : "s"}!`,
        });
      }
    } else {
      setPhase("solved");
      clearTimer();
      timerRef.current = setTimeout(() => {
        setRound((r) => r + 1);
      }, 1100);
    }
  }, [phase, w, DATA, round, totalTests, onComplete, clearTimer]);

  // Fresh round: load its starting weights, back to tuning.
  useEffect(() => {
    setW({ ...ROUNDS[round].start });
    setTested(null);
    setPhase("tuning");
  }, [round]);

  const reset = useCallback(() => {
    clearTimer();
    reportedRef.current = false;
    setRound(0);
    setW({ ...ROUNDS[0].start });
    setTested(null);
    setPhase("tuning");
    setTotalTests(0);
  }, [clearTimer]);

  const done = phase === "done";
  const solvedRound = phase === "solved";
  const justChecked = phase === "checked";
  const celebrating = done || solvedRound;
  const locked = solvedRound || done;

  const sliders: { key: keyof Weights; label: string; hint: string }[] = [
    { key: "w1", label: "w₁ (x weight)", hint: "tilts left ↔ right" },
    { key: "w2", label: "w₂ (y weight)", hint: "tilts up ↕ down" },
    { key: "b", label: "b (bias)", hint: "slides the line" },
  ];

  // Status text under the canvas.
  const statusText = done
    ? `All brains tuned! ${"⭐".repeat(finalStars)}`
    : solvedRound
      ? "Separated! Next brain loading…"
      : justChecked
        ? `Tested: ${correctNow} / ${total} correct — fix the ringed dots`
        : `Round ${round + 1}/${TOTAL_ROUNDS} · arrange the line, then TEST`;

  return (
    <div className="flex w-full flex-col gap-3 font-mono text-ink">
      {/* Round progress dots */}
      <div className="flex items-center justify-between px-1">
        <span className="flex items-center gap-1.5" aria-label={`Round ${round + 1} of ${TOTAL_ROUNDS}`}>
          {ROUNDS.map((_, i) => {
            const solved = i < round || done;
            const current = i === round && !done;
            return (
              <span
                key={`rd-${i}`}
                aria-hidden="true"
                className="grid place-items-center rounded-full"
                style={{
                  height: 12,
                  width: 12,
                  background: solved ? ACCENT : current ? "rgba(168,85,247,0.25)" : "rgba(255,255,255,0.06)",
                  border: `2px solid ${solved || current ? ACCENT : "rgba(120,140,170,0.35)"}`,
                  boxShadow: current ? `0 0 8px ${ACCENT}88` : undefined,
                }}
              />
            );
          })}
        </span>
        <span className="text-[11px] text-ink-faint">
          tests: <span className="tabular-nums" style={{ color: ACCENT }}>{totalTests}</span>
        </span>
      </div>

      {/* Canvas */}
      <div
        className="panel relative overflow-hidden rounded-xl p-2"
        style={celebrating ? { boxShadow: `0 0 0 1px ${ACCENT}, 0 0 24px -4px ${ACCENT}` } : undefined}
      >
        <svg
          viewBox="0 0 100 100"
          className="block aspect-square w-full"
          role="img"
          aria-label={`Scatter plot, round ${round + 1} of ${TOTAL_ROUNDS}, with an adjustable decision line`}
        >
          {/* +half-plane shading */}
          {shade && <polygon points={shade} fill={ACCENT} opacity={0.1} />}

          {/* faint grid + axes */}
          <g stroke="currentColor" className="text-line">
            {[-RANGE / 2, RANGE / 2].map((g) => (
              <line key={`vx${g}`} x1={toX(g)} y1={PAD} x2={toX(g)} y2={SIZE - PAD} strokeWidth={0.2} opacity={0.4} />
            ))}
            {[-RANGE / 2, RANGE / 2].map((g) => (
              <line key={`hy${g}`} x1={PAD} y1={toY(g)} x2={SIZE - PAD} y2={toY(g)} strokeWidth={0.2} opacity={0.4} />
            ))}
            <line x1={toX(0)} y1={PAD} x2={toX(0)} y2={SIZE - PAD} strokeWidth={0.3} opacity={0.7} />
            <line x1={PAD} y1={toY(0)} x2={SIZE - PAD} y2={toY(0)} strokeWidth={0.3} opacity={0.7} />
          </g>

          {/* decision boundary */}
          {line && (
            <line
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={ACCENT}
              strokeWidth={0.9}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 1.5px ${ACCENT})` }}
            />
          )}

          {/* data points */}
          {shown.map(({ p, correct }, i) => {
            const cx = toX(p.x);
            const cy = toY(p.y);
            const isViolet = p.label === 1;
            const fill = isViolet ? ACCENT : CYAN;
            // Red rings only appear after a TEST (showChecked); live preview is calm.
            const ring = showChecked && !correct;
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={2.1} fill={fill} opacity={correct ? 1 : 0.85} />
                {ring && (
                  <circle cx={cx} cy={cy} r={3.1} fill="none" stroke="#f87171" strokeWidth={0.7}>
                    <animate attributeName="r" values="3.1;3.6;3.1" dur="0.9s" repeatCount="indefinite" />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        {/* status line */}
        <div className="mt-1 flex items-center justify-between px-1 text-xs">
          <span
            className={celebrating ? "neon-text font-display" : "text-ink-dim"}
            style={celebrating ? { color: ACCENT } : undefined}
            role="status"
            aria-live="polite"
          >
            {statusText}
          </span>
          <span className="flex items-center gap-2 text-ink-faint">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: ACCENT }} /> violet
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: CYAN }} /> cyan
            </span>
          </span>
        </div>
      </div>

      {/* Round hint */}
      {!done && (
        <p className="px-1 text-[11px] leading-tight text-ink-faint">
          <span style={{ color: ACCENT }}>Round {round + 1}:</span> {cur.hint}
        </p>
      )}

      {/* Sliders */}
      <div className="panel flex flex-col gap-2.5 rounded-xl p-3">
        {sliders.map(({ key, label, hint }) => (
          <label key={key} className="flex flex-col gap-1 text-xs">
            <span className="flex items-center justify-between">
              <span className="text-ink-dim">
                {label} <span className="text-ink-faint">· {hint}</span>
              </span>
              <span className="font-display tabular-nums" style={{ color: ACCENT }}>
                {w[key].toFixed(1)}
              </span>
            </span>
            <input
              type="range"
              min={-5}
              max={5}
              step={0.1}
              value={w[key]}
              onChange={update(key)}
              disabled={locked}
              aria-label={`${label}, current value ${w[key].toFixed(1)}`}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-50"
              style={{ accentColor: ACCENT }}
            />
          </label>
        ))}

        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={test}
            disabled={locked}
            className="flex-1 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50"
            style={{ background: ACCENT, color: "#0b0512" }}
            aria-label="Test the brain — run it on every dot and check the result"
          >
            {justChecked ? "↻ Test again" : "▶ Test the brain"}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={phase === "solved"}
            className="shrink-0 rounded-lg border border-line bg-panel/60 px-3 py-2 text-xs font-medium text-ink-dim disabled:opacity-40"
            aria-label="Start over from round one"
          >
            Reset
          </button>
        </div>

        {justChecked && correctNow >= total - 2 && (
          <p className="text-[11px]" style={{ color: ACCENT }}>
            So close — only {total - correctNow} ringed dot{total - correctNow === 1 ? "" : "s"} left. Nudge a slider, then test again.
          </p>
        )}
        {!justChecked && !celebrating && (
          <p className="text-[11px] leading-tight text-ink-faint">
            Aim for full stars: solve all three with as few tests as you can. ({totalTests}/{STAR3_MAX_TESTS} for ⭐⭐⭐)
          </p>
        )}
      </div>
    </div>
  );
}
