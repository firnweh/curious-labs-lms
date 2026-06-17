"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ActivityProps } from "@/lib/activities/types";

const ACCENT = "#a855f7";

/** Data-space half-extent. Points & axes live in [-RANGE, RANGE]. */
const RANGE = 5;

interface Pt {
  x: number;
  y: number;
  /** True class: +1 (violet) lives where x+y is large, -1 (cyan) where small. */
  label: 1 | -1;
}

/**
 * A fixed, linearly-separable dataset. The two clusters are pulled apart along
 * the x+y diagonal so a line like  x + y = 0  (w1=1, w2=1, b=0) splits them.
 * Hand-picked so nothing sits on the boundary — deterministic & winnable.
 */
const DATA: readonly Pt[] = [
  // class +1 (violet) — upper-right, x + y clearly positive
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
  // class -1 (cyan) — lower-left, x + y clearly negative
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
] as const;

const DEFAULTS = { w1: 0, w2: 1, b: 3 } as const; // a wrong-ish start: misclassifies several

interface Weights {
  w1: number;
  w2: number;
  b: number;
}

/** Perceptron score for a point: positive => predicts class +1. */
function score(w: Weights, p: { x: number; y: number }): number {
  return w.w1 * p.x + w.w2 * p.y + w.b;
}

export default function TuneTheBrain({ onComplete }: ActivityProps) {
  const [w, setW] = useState<Weights>({ ...DEFAULTS });
  const [done, setDone] = useState<boolean>(false);
  const [tries, setTries] = useState<number>(0);

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

  // Classify every point under the current weights.
  const results = useMemo(() => {
    return DATA.map((p) => {
      const s = score(w, p);
      const pred: 1 | -1 = s >= 0 ? 1 : -1;
      return { p, correct: pred === p.label };
    });
  }, [w]);

  const correctCount = useMemo(
    () => results.reduce((n, r) => (r.correct ? n + 1 : n), 0),
    [results],
  );
  const total = DATA.length;
  const allCorrect = correctCount === total;

  // Auto-celebrate on a full solve — runs as an effect, never during render.
  useEffect(() => {
    if (allCorrect && !done) {
      setDone(true);
      onComplete({ passed: true, stars: 3 });
    }
  }, [allCorrect, done, onComplete]);

  const update = useCallback(
    (key: keyof Weights) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      setW((prev) => ({ ...prev, [key]: v }));
      setTries((t) => t + 1);
    },
    [],
  );

  const reset = useCallback(() => {
    setW({ ...DEFAULTS });
    setDone(false);
  }, []);

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
      // y = -(w1*x + b)/w2 at the two vertical edges
      push({ x: lo, y: -(w1 * lo + b) / w2 });
      push({ x: hi, y: -(w1 * hi + b) / w2 });
    }
    if (Math.abs(w1) > 1e-9) {
      // x = -(w2*y + b)/w1 at the two horizontal edges
      push({ x: -(w2 * lo + b) / w1, y: lo });
      push({ x: -(w2 * hi + b) / w1, y: hi });
    }
    if (pts.length < 2) return null;
    // pick the two furthest-apart valid points
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
      // Build polygon: line endpoints + the corners on the +side.
      const a = { x: line.x1, y: line.y1 };
      const c = { x: line.x2, y: line.y2 };
      const cx = (PAD * 2 + span) / 2;
      const cy = (PAD * 2 + span) / 2;
      const insidePx = inside.map((p) => ({ x: toX(p.x), y: toY(p.y) }));
      const all = [a, c, ...insidePx];
      // order by angle around centroid so the polygon isn't self-crossing
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

  const sliders: { key: keyof Weights; label: string; hint: string }[] = [
    { key: "w1", label: "w₁ (x weight)", hint: "tilts left ↔ right" },
    { key: "w2", label: "w₂ (y weight)", hint: "tilts up ↕ down" },
    { key: "b", label: "b (bias)", hint: "slides the line" },
  ];

  return (
    <div className="flex w-full flex-col gap-3 font-mono text-ink">
      {/* Canvas */}
      <div
        className="panel relative overflow-hidden rounded-xl p-2"
        style={done ? { boxShadow: `0 0 0 1px ${ACCENT}, 0 0 24px -4px ${ACCENT}` } : undefined}
      >
        <svg viewBox="0 0 100 100" className="block aspect-square w-full" role="img" aria-label="Scatter plot with adjustable decision line">
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
          {results.map(({ p, correct }, i) => {
            const cx = toX(p.x);
            const cy = toY(p.y);
            const isViolet = p.label === 1;
            const fill = isViolet ? ACCENT : "#22d3ee";
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={2.1} fill={fill} opacity={correct ? 1 : 0.85} />
                {!correct && (
                  // red ring marks a misclassified point
                  <circle cx={cx} cy={cy} r={3.1} fill="none" stroke="#f87171" strokeWidth={0.7} />
                )}
              </g>
            );
          })}
        </svg>

        {/* status line */}
        <div className="mt-1 flex items-center justify-between px-1 text-xs">
          <span className={done ? "neon-text font-display" : "text-ink-dim"} style={done ? { color: ACCENT } : undefined}>
            {done ? "Separated! The brain is tuned." : `correct: ${correctCount} / ${total}`}
          </span>
          <span className="flex items-center gap-2 text-ink-faint">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: ACCENT }} /> violet
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#22d3ee" }} /> cyan
            </span>
          </span>
        </div>
      </div>

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
              aria-label={`${label}, current value ${w[key].toFixed(1)}`}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2"
              style={{ accentColor: ACCENT }}
            />
          </label>
        ))}

        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-[11px] leading-tight text-ink-faint">
            Rotate &amp; slide the line until every dot sits on its own color&apos;s side.
          </p>
          <button
            type="button"
            onClick={reset}
            className="shrink-0 rounded-lg border border-line bg-panel/60 px-3 py-1.5 text-xs font-medium text-ink-dim"
            aria-label="Reset sliders to defaults"
          >
            Reset
          </button>
        </div>
        {tries > 0 && !done && correctCount >= total - 2 && (
          <p className="text-[11px]" style={{ color: ACCENT }}>
            So close — nudge a slider a touch more.
          </p>
        )}
      </div>
    </div>
  );
}
