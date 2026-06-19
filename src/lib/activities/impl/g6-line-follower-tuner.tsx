"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Line Follower Tuner — proportional control (Kp)                    */
/*  ONE learning goal: a self-correcting robot steers by HOW FAR it is */
/*  off the line — bigger error → sharper correction. Pick a steering  */
/*  strength Kp that is "just right": too LOW drifts off the curves,   */
/*  too HIGH over-corrects into S-shaped wobbles.                      */
/* ------------------------------------------------------------------ */

const ACCENT = "#34d399";
const RED = "#f87171";
const AMBER = "#fbbf24";
const CYAN = "#67e8f9";

const VIEW_W = 320;
const VIEW_H = 220;

type Phase = "idle" | "running" | "off" | "wobble" | "won";

interface Pt {
  x: number;
  y: number;
}

/** Deterministic curvy loop track sampled across t in [0,1]. */
function trackPoint(t: number): Pt {
  const a = t * Math.PI * 2;
  // A wobbly oval so there are real curves to correct on.
  const x = VIEW_W / 2 + Math.cos(a) * 116 + Math.sin(a * 2) * 14;
  const y = VIEW_H / 2 + Math.sin(a) * 78 - Math.cos(a * 3) * 12;
  return { x, y };
}

const SAMPLES = 240;
const TRACK: Pt[] = Array.from({ length: SAMPLES + 1 }, (_, i) =>
  trackPoint(i / SAMPLES),
);
const TRACK_D: string = TRACK.map(
  (p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`,
).join(" ");

/** Tangent angle (radians) of the centreline at sample index i. */
function tangentAt(i: number): number {
  const a = TRACK[(i - 1 + TRACK.length) % TRACK.length];
  const b = TRACK[(i + 1) % TRACK.length];
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/** Signed local curvature (how sharply the line bends) at sample i. */
function curvatureAt(i: number): number {
  const t0 = tangentAt((i - 4 + TRACK.length) % TRACK.length);
  const t1 = tangentAt((i + 4) % TRACK.length);
  let d = t1 - t0;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
const MAX_CURV = 0.37; // measured peak |curvature| of this track

/* --- The proportional-control model (deterministic, always winnable) --- */
/* Steering strength Kp runs 0.5 … 6.0 on the slider. The winnable band is */
/* contiguous and comfortably wide, so the slider can always reach it.     */
const KP_MIN = 0.5;
const KP_MAX = 6.0;
const KP_OFF_MAX = 1.9; // below this → too soft, drifts off the curves
const KP_WOB_MIN = 4.2; // above this → too hard, over-corrects (wobble)
const KP_GOOD = 3.05; // centre of the "just right" band
const LAP_TICKS = 216; // a clean lap is a fixed length → always finishes in time

type Verdict = "off" | "wobble" | "won";
function verdict(kp: number): Verdict {
  if (kp < KP_OFF_MAX) return "off";
  if (kp > KP_WOB_MIN) return "wobble";
  return "won";
}

/** Lateral drift in "dots" — weak Kp lags behind on curves (≈0 when tuned). */
function driftDots(kp: number): number {
  return Math.max(0, 9.5 / (kp + 0.6) - 2.4);
}
/** Over-correction wobble amplitude in "dots" — grows past the good Kp. */
function wobbleDots(kp: number): number {
  return Math.max(0, kp - KP_GOOD) * 1.15;
}

/** Signed offset (pixels) of the trail from the centreline at sample i. */
function offsetPx(i: number, kp: number): number {
  const curv = curvatureAt(i % SAMPLES);
  const drift = driftDots(kp) * (curv / MAX_CURV) * 10.0; // lags outward on curves
  const wob = wobbleDots(kp) * Math.sin(i * 0.55) * 4.4; // zig-zag S-shapes
  return drift + wob;
}

/** Robot pose at sample i for a given Kp: centreline + perpendicular offset. */
function poseAt(i: number, kp: number): { x: number; y: number; heading: number } {
  const c = TRACK[i % SAMPLES];
  const tan = tangentAt(i % SAMPLES);
  const nx = -Math.sin(tan);
  const ny = Math.cos(tan);
  const off = offsetPx(i, kp);
  // heading wobbles a touch with the offset so the robot visibly weaves
  const lead = offsetPx(i + 2, kp) - off;
  return { x: c.x + nx * off, y: c.y + ny * off, heading: tan + lead * 0.04 };
}

/** Signed error reading (−4 … +4 "dots") the IR bar would sense at sample i. */
function errorDotsAt(i: number, kp: number): number {
  const e = offsetPx(i, kp) / 7;
  return Math.max(-4, Math.min(4, e));
}

export default function LineFollowerTuner({ onComplete }: ActivityProps) {
  const [kp, setKp] = useState<number>(1.2); // a too-low start → drifts off
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<number>(0); // sample index 0…SAMPLES
  const [errDots, setErrDots] = useState<number>(0);
  const [lapSecs, setLapSecs] = useState<string>("0.0");

  // Refs so the animation loop reads fresh values without re-binding.
  const kpRef = useRef<number>(kp);
  const phaseRef = useRef<Phase>(phase);
  const tickRef = useRef<number>(0);
  const failAtRef = useRef<number>(SAMPLES + 1); // sample where a bad run stops
  const rafRef = useRef<number | null>(null);
  const accRef = useRef<number>(0);
  const lastRef = useRef<number>(0);
  const doneRef = useRef<boolean>(false); // guards the single success call

  useEffect(() => {
    kpRef.current = kp;
  }, [kp]);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => stopLoop, [stopLoop]);

  const finish = useCallback(
    (result: Verdict, atSample: number) => {
      stopLoop();
      const lap = (LAP_TICKS / 36).toFixed(1);
      setLapSecs(lap);
      if (result === "won") {
        setPhase("won");
        phaseRef.current = "won";
        setProgress(SAMPLES);
        if (!doneRef.current) {
          doneRef.current = true;
          onComplete({
            passed: true,
            stars: 3,
            detail: `Clean lap in ${lap}s — smooth proportional control.`,
          });
        }
      } else if (result === "off") {
        setPhase("off");
        phaseRef.current = "off";
        setProgress(atSample);
        onComplete({
          passed: false,
          detail: "Drifting wide on the curve — correct HARDER (raise Kp).",
        });
      } else {
        setPhase("wobble");
        phaseRef.current = "wobble";
        setProgress(atSample);
        onComplete({
          passed: false,
          detail: "Over-correcting into S-shapes — ease off (lower Kp).",
        });
      }
    },
    [onComplete, stopLoop],
  );

  const loop = useCallback(
    (now: number) => {
      if (phaseRef.current !== "running") return;
      const dt = now - lastRef.current;
      lastRef.current = now;
      accRef.current += dt;
      const TICK_MS = 16;

      let steps = 0;
      while (accRef.current >= TICK_MS && steps < 4) {
        accRef.current -= TICK_MS;
        steps++;
        tickRef.current += 1;
        const i = tickRef.current;

        // A failing run stops the moment its trail leaves the safe zone.
        if (i >= failAtRef.current) {
          const v = verdict(kpRef.current);
          setErrDots(errorDotsAt(i, kpRef.current));
          finish(v === "won" ? "won" : v, i);
          return;
        }
        // A clean run completes the whole lap.
        if (i >= SAMPLES) {
          finish("won", SAMPLES);
          return;
        }
      }

      const i = tickRef.current;
      setProgress(i);
      setErrDots(errorDotsAt(i, kpRef.current));
      rafRef.current = requestAnimationFrame(loop);
    },
    [finish],
  );

  const handlePlay = useCallback(() => {
    stopLoop();
    const v = verdict(kpRef.current);
    // Where a bad run visibly fails: off ≈ first sharp curve, wobble ≈ midway.
    failAtRef.current =
      v === "off" ? 70 : v === "wobble" ? 150 : SAMPLES + 1;
    tickRef.current = 0;
    accRef.current = 0;
    setProgress(0);
    setErrDots(0);
    lastRef.current = performance.now();
    setPhase("running");
    phaseRef.current = "running";
    rafRef.current = requestAnimationFrame(loop);
  }, [loop, stopLoop]);

  const handleReset = useCallback(() => {
    stopLoop();
    tickRef.current = 0;
    accRef.current = 0;
    failAtRef.current = SAMPLES + 1;
    setProgress(0);
    setErrDots(0);
    setPhase("idle");
    phaseRef.current = "idle";
  }, [stopLoop]);

  const onKp = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (phaseRef.current === "running") return;
      setKp(Number(e.target.value));
      if (phaseRef.current !== "idle") handleReset();
    },
    [handleReset],
  );

  const running = phase === "running";
  const won = phase === "won";

  // Trail colour reflects the outcome; green only on a clean lap.
  const trailColor =
    phase === "won"
      ? ACCENT
      : phase === "off"
        ? RED
        : phase === "wobble"
          ? AMBER
          : CYAN;

  // Build the driven trail up to the current progress.
  const trailD = useMemo(() => {
    if (progress < 1) return "";
    const pts: string[] = [];
    for (let i = 0; i <= progress; i++) {
      const p = poseAt(i, kp);
      pts.push(`${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
    }
    return pts.join(" ");
  }, [progress, kp]);

  const robot = useMemo(() => poseAt(progress, kp), [progress, kp]);

  const correctionDir = errDots > 0.3 ? "◀" : errDots < -0.3 ? "▶" : "●";
  const progressPct = Math.min(100, Math.round((progress / SAMPLES) * 100));

  const status = useMemo(() => {
    if (phase === "won") return `Smooth and steady — lap in ${lapSecs}s. ✨`;
    if (phase === "off")
      return "Drifting wide on the curve — correct HARDER (raise Kp).";
    if (phase === "wobble")
      return "Over-correcting into S-shapes — ease off (lower Kp).";
    if (phase === "running") return `Driving the lap… ${progressPct}%`;
    return "Set the steering strength Kp, then press Play ▶";
  }, [phase, lapSecs, progressPct]);

  return (
    <div
      className="flex w-full flex-col gap-3 text-ink"
      style={{ maxWidth: 440, margin: "0 auto" }}
    >
      <style>{`
        @keyframes g6linefollowertuner-pop {
          0% { transform: scale(0.4); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g6linefollowertuner-pulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* ---------------- TRACK CANVAS ---------------- */}
      <div
        className="panel relative overflow-hidden rounded-xl"
        style={{
          boxShadow: won
            ? `0 0 0 1px ${ACCENT}, 0 0 24px -4px ${ACCENT}`
            : undefined,
          transition: "box-shadow .3s ease",
        }}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="block h-auto w-full"
          style={{ background: "#f8fafc" }}
          role="img"
          aria-label="Robot driving a curvy line-following track"
        >
          {/* the black centreline (the line to follow) */}
          <path
            d={TRACK_D}
            fill="none"
            stroke="#111827"
            strokeWidth={8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* faint ghost centreline so the learner sees the ideal path */}
          <path
            d={TRACK_D}
            fill="none"
            stroke={ACCENT}
            strokeOpacity={0.55}
            strokeWidth={1.4}
            strokeDasharray="3 4"
          />

          {/* the robot's actual driven trail */}
          {trailD && (
            <path
              d={trailD}
              fill="none"
              stroke={trailColor}
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.95}
            />
          )}

          {/* start / finish marker */}
          <circle cx={TRACK[0].x} cy={TRACK[0].y} r={5} fill={ACCENT} />
          <text
            x={TRACK[0].x}
            y={TRACK[0].y - 9}
            fill="#111827"
            fontSize={8}
            textAnchor="middle"
            fontFamily="monospace"
          >
            START
          </text>

          {/* robot with a 5-dot IR sensor bar */}
          <g
            transform={`translate(${robot.x} ${robot.y}) rotate(${
              (robot.heading * 180) / Math.PI
            })`}
          >
            <rect
              x={-9}
              y={-7}
              width={18}
              height={14}
              rx={3}
              fill={won ? ACCENT : "#2563eb"}
              stroke="#0f172a"
              strokeWidth={1}
            />
            {/* IR sensor bar: 5 dots across the front; centre dot is white */}
            {[-6, -3, 0, 3, 6].map((dy) => (
              <circle
                key={dy}
                cx={9}
                cy={dy}
                r={1.3}
                fill={dy === 0 ? "#f8fafc" : "#93c5fd"}
              />
            ))}
          </g>
        </svg>

        {/* progress overlaid in-canvas */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-end px-3 py-1.5">
          <span className="font-mono text-[11px] text-ink-dim">
            {running ? `${progressPct}% of lap` : ""}
          </span>
        </div>
      </div>

      {/* ---------------- STATUS (aria-live) ---------------- */}
      <div
        role="status"
        aria-live="polite"
        aria-label={status}
        className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-center font-mono text-xs"
        style={
          won
            ? { color: ACCENT, borderColor: ACCENT }
            : phase === "off"
              ? { color: RED }
              : phase === "wobble"
                ? { color: AMBER }
                : undefined
        }
      >
        {won && (
          <span
            aria-hidden
            className="mr-1 inline-block"
            style={{ animation: "g6linefollowertuner-pop .5s ease both" }}
          >
            🎉
          </span>
        )}
        {status}
      </div>

      {/* ---------------- LIVE ERROR BAR ---------------- */}
      <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-panel/60 p-3">
        <div className="flex items-center justify-between font-mono text-[11px] text-ink-faint">
          <span>← off left</span>
          <span className="text-ink-dim">error from line</span>
          <span>off right →</span>
        </div>
        <div
          className="relative h-5 w-full rounded-full"
          style={{ background: "#0b1220" }}
          role="img"
          aria-label={`Error ${errDots.toFixed(1)} of 4, correction ${
            correctionDir === "◀"
              ? "steer left"
              : correctionDir === "▶"
                ? "steer right"
                : "on the line"
          }`}
        >
          {/* centre (on-line) marker */}
          <span
            aria-hidden
            className="absolute top-0 h-full"
            style={{ left: "50%", width: 2, background: ACCENT, opacity: 0.7 }}
          />
          {/* error indicator dot with the correction arrow */}
          <span
            aria-hidden
            className="absolute top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full"
            style={{
              left: `calc(${50 + errDots * 11}% - 8px)`,
              background: running ? trailColor : CYAN,
              transition: "left .08s linear",
              fontSize: 10,
              color: "#05070d",
              fontWeight: 700,
            }}
          >
            {correctionDir}
          </span>
        </div>
        <p className="text-center font-mono text-[10px] text-ink-faint">
          Bigger error → the robot steers back harder. That&apos;s
          proportional control.
        </p>
      </div>

      {/* ---------------- Kp SLIDER ---------------- */}
      <div className="flex flex-col gap-2 rounded-xl border border-line bg-panel/60 p-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="flex items-center justify-between font-mono">
            <span className="text-ink-dim">
              Kp · steering strength
              <span className="text-ink-faint"> (correction per error)</span>
            </span>
            <span
              className="font-display tabular-nums"
              style={{ color: ACCENT }}
            >
              {kp.toFixed(1)}
            </span>
          </span>
          <input
            type="range"
            min={KP_MIN}
            max={KP_MAX}
            step={0.1}
            value={kp}
            onChange={onKp}
            disabled={running}
            aria-label={`Steering strength Kp, current value ${kp.toFixed(1)}`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-50"
            style={{ accentColor: ACCENT, touchAction: "none" }}
          />
          <span className="flex justify-between font-mono text-[10px] text-ink-faint">
            <span>{KP_MIN.toFixed(1)} · too soft, drifts wide</span>
            <span>{KP_MAX.toFixed(1)} · too hard, wobbles</span>
          </span>
        </label>
      </div>

      {/* ---------------- CONTROLS ---------------- */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="font-mono text-[11px] text-ink-faint"
          aria-hidden={!won}
        >
          {won ? "⭐⭐⭐" : `Kp = ${kp.toFixed(1)}`}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            onPointerDown={(e) => e.stopPropagation()}
            className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
            aria-label="Reset the robot to the start"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handlePlay}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={running || won}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            style={{ background: ACCENT, color: "#05070d" }}
            aria-label="Play one lap"
          >
            {running ? "Driving…" : won ? "Solved ✨" : "Play ▶"}
          </button>
        </div>
      </div>

      {/* win celebration */}
      {won && (
        <div
          className="rounded-lg border px-3 py-2 text-center font-mono text-xs"
          style={{
            borderColor: ACCENT,
            color: ACCENT,
            animation: "g6linefollowertuner-pop .5s ease both",
          }}
        >
          ✨🎉 ⭐⭐⭐ — lap finished in {lapSecs}s. That&apos;s proportional
          control!
        </div>
      )}
    </div>
  );
}
