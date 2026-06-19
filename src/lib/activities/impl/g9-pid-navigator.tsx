"use client";
// Learning goal: a robot estimates how far it has driven from encoder ticks
// (dead reckoning), then a PID controller — correction = Kp·e + Ki·Σe + Kd·Δe —
// steers its heading to each waypoint. Too little Kp is sluggish, high Kp with
// no Kd oscillates, balanced gains settle smoothly. Tune it to drive the square.
import type { ActivityProps } from "@/lib/activities/types";
import type { CSSProperties } from "react";
import { useCallback, useMemo, useRef, useState } from "react";

const ACCENT = "#34d399";
const WARN = "#fbbf24";
const BAD = "#f87171";

/** Dead-reckoning puzzle: distance = (ticks / ticksPerRev) · circumference. */
const RECK = { circumference: 20, ticksPerRev: 360, ticks: 1800 } as const;
const RECK_ANSWER =
  (RECK.ticks / RECK.ticksPerRev) * RECK.circumference; // = 100 cm

/** PID simulation constants — tuned so the recommended band is reachable. */
const FRAMES = 120; // sim steps per leg of the square
const DT = 0.1; // seconds per step
const INERTIA = 1.0; // robot turning mass — gives overshoot when undamped
const VEL_DAMP = 0.98; // slight angular drag
const SETTLE_TOL = 3; // ±degrees at a waypoint counts as "settled"
const DRIFT_TOL = 5; // cm of final position error to win

/** The square course: four target headings the robot must settle onto. */
const TARGETS: readonly number[] = [0, 90, 180, 270];

interface Gains {
  kp: number;
  ki: number;
  kd: number;
}

const START_GAINS: Gains = { kp: 0.3, ki: 0, kd: 0 }; // sluggish on purpose
const IDEAL_GAINS: Gains = { kp: 1.2, ki: 0.05, kd: 0.8 };

interface LegResult {
  /** Heading samples across the leg, for the line graph. */
  trace: number[];
  /** |target − heading| at the end of the leg, degrees. */
  settle: number;
  /** Largest overshoot past the target during the leg, degrees. */
  overshoot: number;
  /** How many times the heading crossed the target (wobble count). */
  crossings: number;
}

interface SimResult {
  legs: LegResult[];
  /** Worst settle error across all four waypoints. */
  worstSettle: number;
  /** Estimated final position drift, cm. */
  drift: number;
  settledAll: boolean;
  oscillates: boolean;
  won: boolean;
}

/** Deterministic PID + second-order plant. Same gains ⇒ same result, always. */
function simulate(g: Gains): SimResult {
  let heading = 0;
  let angVel = 0;
  const legs: LegResult[] = [];

  for (const target of TARGETS) {
    let errorSum = 0;
    let prevError = target - heading;
    let overshoot = 0;
    let crossings = 0;
    let lastSign = Math.sign(target - heading) || 1;
    const trace: number[] = [];

    for (let f = 0; f < FRAMES; f++) {
      const error = target - heading;
      errorSum += error * DT;
      errorSum = Math.max(-500, Math.min(500, errorSum)); // anti-windup clamp
      const deriv = (error - prevError) / DT;
      const correction = g.kp * error + g.ki * errorSum + g.kd * deriv;
      angVel = angVel * VEL_DAMP + (correction / INERTIA) * DT;
      heading += angVel * DT;
      prevError = error;

      const s = Math.sign(target - heading);
      if (s !== 0 && s !== lastSign) {
        crossings += 1;
        lastSign = s;
      }
      if (f > 2) overshoot = Math.max(overshoot, Math.min(Math.abs(heading - target), 400));
      if (f % 3 === 0) trace.push(heading - target); // sample for the graph
    }
    trace.push(heading - target);
    legs.push({ trace, settle: Math.abs(target - heading), overshoot, crossings });
  }

  const worstSettle = legs.reduce((m, l) => Math.max(m, l.settle), 0);
  // Position drift grows with how badly each leg ended (small-angle model).
  const legLen = RECK_ANSWER; // cm per side of the square
  const drift = legs.reduce(
    (sum, l) => sum + legLen * Math.abs(Math.sin((l.settle * Math.PI) / 180)) * 0.45,
    0,
  );
  const settledAll = legs.every((l) => l.settle <= SETTLE_TOL);
  const oscillates = legs.some((l) => l.crossings >= 4);
  const won = settledAll && drift < DRIFT_TOL;
  return { legs, worstSettle, drift, settledAll, oscillates, won };
}

const SLIDERS: { key: keyof Gains; label: string; hint: string; max: number }[] = [
  { key: "kp", label: "Kp", hint: "push toward target", max: 5 },
  { key: "ki", label: "Ki", hint: "erase steady offset", max: 1 },
  { key: "kd", label: "Kd", hint: "damp the wobble", max: 3 },
];

const cardStyle: CSSProperties = {
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(148,163,184,0.18)",
  background: "rgba(13,18,30,0.6)",
  borderRadius: 14,
};

export default function PidNavigator({ onComplete }: ActivityProps) {
  // ---- Panel A: dead reckoning ----
  const [typed, setTyped] = useState<string>("");
  const [reckOk, setReckOk] = useState<boolean>(false);
  const [reckMsg, setReckMsg] = useState<string>("");

  // ---- Panel B: PID tuning ----
  const [gains, setGains] = useState<Gains>({ ...START_GAINS });
  const [result, setResult] = useState<SimResult | null>(null);
  const [status, setStatus] = useState<string>("Solve the distance, then tune & RUN.");
  const [showIdeal, setShowIdeal] = useState<boolean>(false);
  const wonRef = useRef<boolean>(false);

  const checkReck = useCallback(() => {
    const v = Number(typed);
    if (typed.trim() === "" || Number.isNaN(v)) {
      setReckOk(false);
      setReckMsg("Type your distance in cm to check it.");
      return;
    }
    if (Math.abs(v - RECK_ANSWER) <= 0.5) {
      setReckOk(true);
      setReckMsg(`Correct — ${RECK_ANSWER} cm per side. Now tune the PID.`);
    } else {
      setReckOk(false);
      setReckMsg("Not quite — distance = (ticks ÷ ticksPerRev) × circumference.");
    }
  }, [typed]);

  const setGain = useCallback(
    (key: keyof Gains) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      setGains((prev) => ({ ...prev, [key]: v }));
    },
    [],
  );

  const run = useCallback(() => {
    if (!reckOk) {
      setStatus("First compute the per-side distance in Panel A.");
      return;
    }
    const r = simulate(gains);
    setResult(r);
    if (r.won) {
      setStatus(`Mission complete — drift ${r.drift.toFixed(1)} cm. ✨`);
      if (!wonRef.current) {
        wonRef.current = true;
        onComplete({
          passed: true,
          stars: 3,
          detail: `Settled all 4 waypoints, drift ${r.drift.toFixed(1)} cm`,
        });
      }
    } else if (r.oscillates) {
      setStatus("Oscillating! Add some Kd to damp the overshoot.");
      onComplete({ passed: false, detail: "Too much wobble — raise Kd a little." });
    } else if (!r.settledAll) {
      setStatus("Sluggish — it never reaches in time. Nudge Kp up.");
      onComplete({ passed: false, detail: "Heading hasn't settled — try more Kp." });
    } else {
      setStatus(`Close — drift ${r.drift.toFixed(1)} cm. Trim the gains a touch.`);
      onComplete({ passed: false, detail: "Almost there — fine-tune the gains." });
    }
  }, [reckOk, gains, onComplete]);

  const revealIdeal = useCallback(() => {
    setGains({ ...IDEAL_GAINS });
    setShowIdeal(true);
    setStatus("Loaded recommended gains — press RUN to drive the square.");
  }, []);

  const reset = useCallback(() => {
    setTyped("");
    setReckOk(false);
    setReckMsg("");
    setGains({ ...START_GAINS });
    setResult(null);
    setShowIdeal(false);
    setStatus("Solve the distance, then tune & RUN.");
    // wonRef intentionally NOT reset — onComplete fires at most once per mount.
  }, []);

  // ---- Arena geometry (top-down square course) ----
  const arena = useMemo(() => {
    const pad = 18;
    const size = 100;
    const lo = pad;
    const hi = size - pad;
    const corners = [
      { x: lo, y: hi },
      { x: hi, y: hi },
      { x: hi, y: lo },
      { x: lo, y: lo },
    ];
    return { corners, lo, hi };
  }, []);

  // Where the robot ends up — driven by the simulated heading errors.
  const robotPath = useMemo(() => {
    const { corners } = arena;
    if (!result) return { pts: [corners[0]], wobble: false };
    const pts: { x: number; y: number }[] = [corners[0]];
    for (let i = 0; i < result.legs.length; i++) {
      const next = corners[(i + 1) % corners.length];
      const leg = result.legs[i];
      // Bend the leg's midpoint outward by its overshoot to *show* the wobble.
      const mid = { x: (corners[i].x + next.x) / 2, y: (corners[i].y + next.y) / 2 };
      const bow = Math.min(leg.overshoot / 90, 1) * 6;
      const nx = -(next.y - corners[i].y);
      const ny = next.x - corners[i].x;
      const len = Math.hypot(nx, ny) || 1;
      pts.push({ x: mid.x + (nx / len) * bow, y: mid.y + (ny / len) * bow });
      pts.push(next);
    }
    return { pts, wobble: result.oscillates };
  }, [arena, result]);

  const pathD = useMemo(
    () =>
      robotPath.pts
        .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(" "),
    [robotPath],
  );

  const graph = useMemo(() => {
    if (!result) return null;
    const trace = result.legs.flatMap((l) => l.trace);
    const n = trace.length;
    const w = 100;
    const h = 38;
    const maxAbs = Math.max(20, ...trace.map((t) => Math.abs(t)));
    const pts = trace
      .map((t, i) => {
        const x = (i / (n - 1)) * w;
        const y = h / 2 - (t / maxAbs) * (h / 2 - 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    return { pts, h, w };
  }, [result]);

  const won = result?.won ?? false;

  return (
    <div className="flex w-full flex-col gap-3" style={{ maxWidth: 440, margin: "0 auto" }}>
      <style>{`
        @keyframes g9pidnavigator-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g9pidnavigator-spin {
          from { transform: rotate(0deg); } to { transform: rotate(360deg); }
        }
      `}</style>

      {/* ---- Arena ---- */}
      <div
        style={{
          ...cardStyle,
          padding: 8,
          boxShadow: won ? `0 0 0 1px ${ACCENT}, 0 0 26px -6px ${ACCENT}` : undefined,
        }}
      >
        <svg
          viewBox="0 0 100 100"
          className="block aspect-square w-full"
          role="img"
          aria-label="Top-down view of a square course with the robot's driven path"
        >
          <rect x={0} y={0} width={100} height={100} fill="#0b1120" rx={6} />
          {[1, 2, 3].map((i) => (
            <g key={i} stroke="#1c2540" strokeWidth={0.3}>
              <line x1={arena.lo} y1={arena.lo + ((arena.hi - arena.lo) / 4) * i} x2={arena.hi} y2={arena.lo + ((arena.hi - arena.lo) / 4) * i} />
              <line x1={arena.lo + ((arena.hi - arena.lo) / 4) * i} y1={arena.lo} x2={arena.lo + ((arena.hi - arena.lo) / 4) * i} y2={arena.hi} />
            </g>
          ))}
          {/* ideal square path (ghost) */}
          <polygon
            points={arena.corners.map((c) => `${c.x},${c.y}`).join(" ")}
            fill="none"
            stroke="#334155"
            strokeWidth={0.8}
            strokeDasharray="2 2"
          />
          {/* waypoint markers */}
          {arena.corners.map((c, i) => {
            const ok = result ? result.legs[i].settle <= SETTLE_TOL : false;
            return (
              <g key={i}>
                <circle cx={c.x} cy={c.y} r={2.6} fill={result ? (ok ? ACCENT : WARN) : "#475569"} />
                <text x={c.x} y={c.y + 1} fontSize={2.6} textAnchor="middle" fill="#05070d" fontWeight="bold">
                  {i + 1}
                </text>
              </g>
            );
          })}
          {/* driven path */}
          {result && (
            <path
              d={pathD}
              fill="none"
              stroke={won ? ACCENT : robotPath.wobble ? BAD : WARN}
              strokeWidth={1.3}
              strokeLinejoin="round"
              strokeLinecap="round"
              style={{ filter: won ? `drop-shadow(0 0 1.5px ${ACCENT})` : undefined }}
            />
          )}
          {/* robot at start */}
          <g style={{ transformOrigin: `${arena.corners[0].x}px ${arena.corners[0].y}px` }}>
            <text x={arena.corners[0].x} y={arena.corners[0].y + 2} fontSize={5.5} textAnchor="middle">
              🤖
            </text>
          </g>
          {won && (
            <text x={50} y={52} fontSize={9} textAnchor="middle" style={{ animation: "g9pidnavigator-pop 500ms ease both" }}>
              ✨🎉
            </text>
          )}
        </svg>

        <div
          className="mt-1 rounded-md px-2 py-1 text-center text-xs"
          role="status"
          aria-live="polite"
          style={{ color: won ? "#05070d" : "#9aa6cf", background: won ? ACCENT : "transparent", fontFamily: "monospace" }}
        >
          {status}
        </div>
      </div>

      {/* ---- Panel A: dead reckoning ---- */}
      <div style={{ ...cardStyle, padding: 12 }}>
        <p className="mb-2 text-xs font-semibold" style={{ color: ACCENT }}>
          A · Dead reckoning — how far per side?
        </p>
        <p className="mb-2 text-[11px] leading-tight" style={{ color: "#9aa6cf" }}>
          wheel circumference <b>{RECK.circumference} cm</b> · <b>{RECK.ticksPerRev}</b> ticks/rev ·
          encoder counted <b>{RECK.ticks}</b> ticks. distance = (ticks ÷ ticksPerRev) × circumference.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="cm"
            aria-label="Your computed distance in centimetres"
            className="w-24 rounded-lg px-2 py-1.5 text-sm"
            style={{ background: "#0b1120", color: "#e5edff", border: "1px solid rgba(148,163,184,0.25)" }}
          />
          <button
            type="button"
            onClick={checkReck}
            className="rounded-lg px-3 py-1.5 text-sm font-medium"
            style={{ background: reckOk ? ACCENT : "rgba(52,211,153,0.18)", color: reckOk ? "#05070d" : ACCENT }}
            aria-label="Compute and check the distance"
          >
            {reckOk ? "Distance ✓" : "Compute distance"}
          </button>
        </div>
        {reckMsg && (
          <p className="mt-1.5 text-[11px]" style={{ color: reckOk ? ACCENT : WARN }} aria-live="polite">
            {reckMsg}
          </p>
        )}
      </div>

      {/* ---- Panel B: PID tuning ---- */}
      <div style={{ ...cardStyle, padding: 12, opacity: reckOk ? 1 : 0.6 }}>
        <p className="mb-2 text-xs font-semibold" style={{ color: ACCENT }}>
          B · PID tuning — steer to each heading
        </p>
        {SLIDERS.map(({ key, label, hint, max }) => (
          <label key={key} className="mb-2 flex flex-col gap-1 text-xs">
            <span className="flex items-center justify-between">
              <span style={{ color: "#9aa6cf" }}>
                {label} <span style={{ color: "#5b6688" }}>· {hint}</span>
              </span>
              <span className="tabular-nums" style={{ color: ACCENT, fontFamily: "monospace" }}>
                {gains[key].toFixed(2)}
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={max}
              step={key === "ki" ? 0.01 : 0.1}
              value={gains[key]}
              onChange={setGain(key)}
              disabled={!reckOk}
              aria-label={`${label} gain, current value ${gains[key].toFixed(2)}`}
              className="h-2 w-full cursor-pointer appearance-none rounded-full"
              style={{ accentColor: ACCENT, background: "#1c2540", touchAction: "none" }}
            />
          </label>
        ))}

        {/* heading-vs-target graph */}
        {graph && (
          <div className="my-2 rounded-lg p-1" style={{ background: "#0b1120", border: "1px solid rgba(148,163,184,0.15)" }}>
            <svg viewBox={`0 0 ${graph.w} ${graph.h}`} className="block w-full" role="img" aria-label="Graph of heading error over time">
              <line x1={0} y1={graph.h / 2} x2={graph.w} y2={graph.h / 2} stroke={ACCENT} strokeWidth={0.4} strokeDasharray="2 2" opacity={0.7} />
              <polyline points={graph.pts} fill="none" stroke={result?.oscillates ? BAD : ACCENT} strokeWidth={0.8} strokeLinejoin="round" />
            </svg>
            <p className="px-1 text-[10px]" style={{ color: "#5b6688" }}>
              heading − target over time · the line should flatten onto zero
            </p>
          </div>
        )}

        {/* per-waypoint chips */}
        {result && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {result.legs.map((l, i) => {
              const ok = l.settle <= SETTLE_TOL;
              return (
                <span
                  key={i}
                  className="rounded-md px-2 py-0.5 text-[10px] font-medium"
                  style={{ background: ok ? "rgba(52,211,153,0.16)" : "rgba(248,113,113,0.16)", color: ok ? ACCENT : BAD }}
                >
                  WP{i + 1} {ok ? "±" : ""}
                  {l.settle.toFixed(1)}°{l.crossings >= 4 ? " ⚠" : ""}
                </span>
              );
            })}
            <span
              className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: won ? ACCENT : "rgba(148,163,184,0.16)", color: won ? "#05070d" : "#9aa6cf" }}
            >
              drift {result.drift.toFixed(1)} cm
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={run}
            disabled={!reckOk}
            className="flex-1 rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50"
            style={{ background: ACCENT, color: "#05070d" }}
            aria-label="Run the PID simulation and drive the square"
          >
            {won ? "⭐⭐⭐ Solved!" : "▶ RUN"}
          </button>
          <button
            type="button"
            onClick={revealIdeal}
            className="rounded-lg px-3 py-2 text-xs font-medium"
            style={{ border: "1px solid rgba(148,163,184,0.25)", background: "rgba(11,17,32,0.6)", color: "#cbd3ef" }}
            aria-label="Show a working set of ideal gains"
          >
            {showIdeal ? "Ideal set ✓" : "Show ideal gains"}
          </button>
        </div>

        <button
          type="button"
          onClick={reset}
          className="mt-2 w-full rounded-lg px-4 py-1.5 text-xs font-medium"
          style={{ border: "1px solid rgba(148,163,184,0.2)", background: "rgba(11,17,32,0.5)", color: "#9aa6cf" }}
          aria-label="Reset the whole lab"
        >
          Reset
        </button>
      </div>

      {won && (
        <p className="text-center text-sm font-bold" style={{ color: ACCENT }}>
          ✨🎉 Robot navigated the square — ⭐⭐⭐
        </p>
      )}
    </div>
  );
}
