"use client";
// Learning goal: an adaptive controller cuts average wait by allocating green
// time IN PROPORTION to each lane's measured queue — busy lanes earn more green,
// empty lanes earn less — beating one-size-fits-all fixed timing.
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

const ACCENT = "#22d3ee";

/** The four approach arms of the intersection. */
type Arm = "N" | "E" | "S" | "W";
const ARMS: readonly Arm[] = ["N", "E", "S", "W"] as const;

/** Fixed, deterministic queue (cars waiting) per arm. Total = 16 cars. */
const CARS: Record<Arm, number> = { N: 8, E: 2, S: 5, W: 1 };

const TOTAL_CARS = ARMS.reduce((n, a) => n + CARS[a], 0); // 16

/** Slider bounds (seconds of green) and the shared green-time budget. */
const MIN_GREEN = 10;
const MAX_GREEN = 40;
const BUDGET = 100;

/** Seconds of green one car needs to clear. */
const SERVICE = 6;
/** Fixed-timing baseline: every arm gets 25s. */
const FIXED_GREEN = 25;
/** Win threshold (seconds). Only reachable by proportional allocation. */
const TARGET_WAIT = 18;

const ARM_META: Record<Arm, { label: string; icon: string }> = {
  N: { label: "North", icon: "⬆️" },
  E: { label: "East", icon: "➡️" },
  S: { label: "South", icon: "⬇️" },
  W: { label: "West", icon: "⬅️" },
};

/** Start: every arm at the budget-balanced 25s — i.e. fixed timing, too slow. */
const START: Record<Arm, number> = { N: 25, E: 25, S: 25, W: 25 };

/**
 * The exact proportional solution AUTO reveals. Green ∝ cars, rounded to the
 * slider grid and kept inside [10,40] while summing to the 100s budget:
 *   N=8 → 40, S=5 → 32, E=2 → 18, W=1 → 10  (= 100). Average wait ≈ 14.8s.
 */
const AUTO: Record<Arm, number> = { N: 40, S: 32, E: 18, W: 10 };

/**
 * Deterministic wait model for one arm.
 * Each car needs SERVICE seconds of green. If green falls short of what the
 * queue needs, leftover cars wait a full extra cycle — a starvation penalty
 * that grows with the unserved cars. Generous green adds no penalty.
 */
function armWait(cars: number, green: number): number {
  const needed = cars * SERVICE;
  const shortfall = Math.max(0, needed - green); // unserved seconds of demand
  const unserved = shortfall / SERVICE; // cars left in the queue
  // base service wait + heavy penalty per car forced to wait another cycle
  return cars * 2 + unserved * 9;
}

/**
 * Each arm's fair (proportional) share of the budget, clamped to the slider
 * grid. An arm reads "balanced" (green) when it gets at least its fair share —
 * so an over-subscribed busy arm at max green still counts as well-served.
 */
function fairShare(arm: Arm): number {
  const raw = (CARS[arm] / TOTAL_CARS) * BUDGET;
  return Math.max(MIN_GREEN, Math.min(MAX_GREEN, raw));
}

/** Average wait across all cars for a green-time plan. */
function avgWait(plan: Record<Arm, number>): number {
  const totalWait = ARMS.reduce((s, a) => s + armWait(CARS[a], plan[a]) * CARS[a], 0);
  return totalWait / TOTAL_CARS;
}

const FIXED_AVG = avgWait({ N: FIXED_GREEN, E: FIXED_GREEN, S: FIXED_GREEN, W: FIXED_GREEN });

export default function AdaptiveTrafficBrain({ onComplete }: ActivityProps) {
  const [green, setGreen] = useState<Record<Arm, number>>({ ...START });
  const [solved, setSolved] = useState<boolean>(false);
  const firedRef = useRef<boolean>(false);

  const used = useMemo(() => ARMS.reduce((n, a) => n + green[a], 0), [green]);
  const overBudget = used > BUDGET;

  // Per-arm wait + average, recomputed live as sliders move.
  const waits = useMemo(() => {
    const w = {} as Record<Arm, number>;
    for (const a of ARMS) w[a] = armWait(CARS[a], green[a]);
    return w;
  }, [green]);

  const average = useMemo(() => avgWait(green), [green]);
  const reduction = Math.max(0, Math.round(((FIXED_AVG - average) / FIXED_AVG) * 100));
  const win = average < TARGET_WAIT && !overBudget;

  const fire = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    setSolved(true);
    onComplete({
      passed: true,
      stars: 3,
      detail: `Adaptive timing cut the average wait by ${reduction}% — busy North got the green it needed.`,
    });
  }, [onComplete, reduction]);

  const nudge = useCallback(() => {
    if (firedRef.current) return;
    onComplete({
      passed: false,
      detail: overBudget
        ? "Over the 100s budget — take green from a quiet arm and give it to a busy one."
        : "Getting there — the busiest arm still needs more green than the empty ones.",
    });
  }, [onComplete, overBudget]);

  const setArm = useCallback(
    (arm: Arm) => (e: React.ChangeEvent<HTMLInputElement>) => {
      if (firedRef.current) return;
      const v = Number(e.target.value);
      setGreen((prev) => {
        const next = { ...prev, [arm]: v };
        if (avgWait(next) < TARGET_WAIT && ARMS.reduce((n, a) => n + next[a], 0) <= BUDGET) {
          // Win condition met mid-drag — celebrate on next tick, after state commits.
          queueMicrotask(fire);
        }
        return next;
      });
    },
    [fire],
  );

  const auto = useCallback(() => {
    if (firedRef.current) return;
    setGreen({ ...AUTO });
    queueMicrotask(fire);
  }, [fire]);

  const reset = useCallback(() => {
    if (firedRef.current) return; // a solved lab stays solved
    setGreen({ ...START });
  }, []);

  return (
    <div
      className="mx-auto flex w-full flex-col gap-3 font-mono text-ink"
      style={{ maxWidth: 440 }}
    >
      <style>{`
        @keyframes g7adaptivetraffic-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g7adaptivetraffic-pulse {
          0%,100% { box-shadow: 0 0 0 0 ${ACCENT}44; }
          50% { box-shadow: 0 0 14px 2px ${ACCENT}66; }
        }
        @keyframes g7adaptivetraffic-roll {
          0% { transform: translateY(2px); }
          100% { transform: translateY(-2px); }
        }
      `}</style>

      {/* Intersection map */}
      <div
        className="panel relative overflow-hidden rounded-xl p-2"
        style={
          win ? { boxShadow: `0 0 0 1px ${ACCENT}, 0 0 22px -4px ${ACCENT}` } : undefined
        }
      >
        <svg
          viewBox="0 0 100 100"
          className="block aspect-square w-full"
          role="img"
          aria-label="Top-down four-arm intersection with a queue of cars waiting on each arm"
        >
          {/* asphalt cross */}
          <rect x="40" y="0" width="20" height="100" fill="#0b1020" />
          <rect x="0" y="40" width="100" height="20" fill="#0b1020" />
          {/* lane dashes */}
          <g stroke="#36406a" strokeWidth="0.6" strokeDasharray="3 3" opacity={0.5}>
            <line x1="50" y1="0" x2="50" y2="40" />
            <line x1="50" y1="60" x2="50" y2="100" />
            <line x1="0" y1="50" x2="40" y2="50" />
            <line x1="60" y1="50" x2="100" y2="50" />
          </g>

          {/* per-arm car stacks + signal dot */}
          {ARMS.map((a) => {
            const cars = CARS[a];
            const ok = green[a] >= fairShare(a) - 0.5;
            const dot = ok ? "#22c55e" : "#ef4444";
            // Place the stack along the arm leading into the centre.
            const items = Array.from({ length: cars });
            return (
              <g key={a}>
                {items.map((_, i) => {
                  const off = 9 + i * 5; // distance from centre
                  let x = 50;
                  let y = 50;
                  if (a === "N") y = 50 - off;
                  if (a === "S") y = 50 + off;
                  if (a === "E") x = 50 + off;
                  if (a === "W") x = 50 - off;
                  return (
                    <text
                      key={i}
                      x={x}
                      y={y}
                      fontSize={4.4}
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      🚗
                    </text>
                  );
                })}
                {/* signal light for the arm */}
                <circle
                  cx={a === "W" ? 44 : a === "E" ? 56 : 50}
                  cy={a === "N" ? 44 : a === "S" ? 56 : 50}
                  r={1.8}
                  fill={dot}
                />
              </g>
            );
          })}

          {/* arm labels with live wait */}
          {ARMS.map((a) => {
            const ok = green[a] >= fairShare(a) - 0.5;
            const lx = a === "E" ? 82 : a === "W" ? 18 : 50;
            const ly = a === "N" ? 6 : a === "S" ? 95 : 50;
            return (
              <text
                key={`lbl${a}`}
                x={lx}
                y={ly}
                fontSize={4}
                textAnchor="middle"
                dominantBaseline="central"
                fill={ok ? "#22c55e" : "#94a3c4"}
                style={{ fontWeight: 700 }}
              >
                {a} {Math.round(waits[a])}s
              </text>
            );
          })}
        </svg>
      </div>

      {/* Dashboard */}
      <div className="panel flex flex-col gap-2 rounded-xl p-3">
        <div
          className="flex items-center justify-between rounded-lg px-2 py-1.5"
          role="status"
          aria-live="polite"
          style={{
            background: win ? ACCENT : "rgba(11,16,32,0.6)",
            color: win ? "#05070d" : "#cbd3ef",
          }}
        >
          <span className="text-xs">
            {win ? "✨ Adaptive!" : "Average wait"}
          </span>
          <span className="font-display text-lg tabular-nums">
            {average.toFixed(1)}s
            <span className="ml-2 text-xs opacity-80">target &lt; {TARGET_WAIT}s</span>
          </span>
        </div>

        {/* baseline comparison */}
        <div className="flex items-center justify-between text-[11px] text-ink-faint">
          <span>Fixed timing (25s each): {FIXED_AVG.toFixed(1)}s</span>
          <span style={{ color: reduction > 0 ? "#22c55e" : "#94a3c4" }}>
            wait reduced {reduction}%
          </span>
        </div>

        {/* budget meter */}
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-ink-dim">Green budget</span>
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-panel-2">
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${Math.min(100, (used / BUDGET) * 100)}%`,
                background: overBudget ? "#ef4444" : ACCENT,
              }}
            />
          </div>
          <span
            className="tabular-nums"
            style={{ color: overBudget ? "#ef4444" : "#cbd3ef" }}
          >
            {used}/{BUDGET}s
          </span>
        </div>

        {/* per-arm sliders + wait bars */}
        {ARMS.map((a) => {
          const ok = green[a] >= fairShare(a) - 0.5;
          const barPct = Math.min(100, (waits[a] / 60) * 100);
          return (
            <label key={a} className="flex flex-col gap-1 text-xs">
              <span className="flex items-center justify-between">
                <span className="text-ink-dim">
                  {ARM_META[a].icon} {ARM_META[a].label}{" "}
                  <span className="text-ink-faint">· {CARS[a]} cars</span>
                </span>
                <span className="font-display tabular-nums" style={{ color: ACCENT }}>
                  {green[a]}s green
                </span>
              </span>
              <input
                type="range"
                min={MIN_GREEN}
                max={MAX_GREEN}
                step={1}
                value={green[a]}
                onChange={setArm(a)}
                disabled={solved}
                aria-label={`${ARM_META[a].label} green time, ${green[a]} seconds, ${CARS[a]} cars waiting`}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2"
                style={{ accentColor: ACCENT, touchAction: "none" }}
              />
              {/* wait bar */}
              <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-panel-2">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-[width]"
                  style={{
                    width: `${barPct}%`,
                    background: ok ? "#22c55e" : "#ef4444",
                  }}
                />
              </div>
            </label>
          );
        })}

        <p className="mt-1 text-[11px] leading-tight text-ink-faint">
          Rule: give each arm green time in proportion to its queue, keeping the
          total at {BUDGET}s. Starved arms turn red.
        </p>

        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={auto}
            disabled={solved}
            className="flex-1 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: ACCENT, color: "#05070d" }}
            aria-label="Let the adaptive AI snap the sliders to the proportional solution"
          >
            🤖 AUTO (adaptive)
          </button>
          <button
            type="button"
            onClick={solved ? undefined : overBudget || !win ? nudge : fire}
            disabled={solved}
            className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-sm font-medium text-ink-dim disabled:opacity-50"
            aria-label="Check the current timing plan"
          >
            Check
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={solved}
            className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-sm font-medium text-ink-dim disabled:opacity-50"
            aria-label="Reset all green times to the fixed 25 second plan"
          >
            Reset
          </button>
        </div>

        {win && (
          <div
            className="mt-1 rounded-lg px-3 py-2 text-center text-sm font-medium"
            style={{
              background: "rgba(34,211,238,0.12)",
              color: ACCENT,
              animation: "g7adaptivetraffic-pop 360ms ease-out both",
            }}
            role="status"
            aria-live="polite"
          >
            🎉 ⭐⭐⭐ Average wait {average.toFixed(1)}s — adaptive timing beat fixed
            timing by {reduction}%!
          </div>
        )}
      </div>
    </div>
  );
}
