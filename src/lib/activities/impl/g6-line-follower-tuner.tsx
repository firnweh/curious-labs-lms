"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Line Follower Tuner — proportional control (Kp), now a real problem */
/*  CLASS 4-6 (age ~9-11). A self-correcting robot steers by HOW FAR it */
/*  is off the line — bigger error → sharper correction. The job: pick  */
/*  a steering strength Kp that is "just right" for THIS track. Too LOW  */
/*  drifts off the curves; too HIGH over-corrects into S-shaped wobbles.*/
/*                                                                      */
/*  Why it's a PROBLEM, not a slider toy:                               */
/*   • THREE escalating tracks. Each one bends differently, so the      */
/*     winnable Kp band SHIFTS and NARROWS — a value that worked on     */
/*     round 1 fails on round 3. You must re-reason every round.        */
/*   • PREDICT → RUN. Before each lap you commit a prediction (drift /  */
/*     clean / wobble). You only run once you've decided what should    */
/*     happen — that kills "drag randomly and watch".                   */
/*   • OPTIMIZE for stars. Any Kp inside the band finishes the lap, but */
/*     the closer you tune to the CENTRE of the band (the most robust   */
/*     setting), the more stars — sloppy-but-passing earns fewer.       */
/* ------------------------------------------------------------------ */

const ACCENT = "#34d399";
const RED = "#f87171";
const AMBER = "#fbbf24";
const CYAN = "#67e8f9";
const VIOLET = "#a78bfa";

const VIEW_W = 320;
const VIEW_H = 220;

type Phase = "idle" | "running" | "off" | "wobble" | "won" | "allDone";
type Predict = "off" | "won" | "wobble";

interface Pt {
  x: number;
  y: number;
}

/* ----------------------------- TRACKS ----------------------------- */
/* Each round bends differently. `curveGain` scales how hard the track */
/* swings, so the Kp needed to track it cleanly SHIFTS between rounds. */
interface TrackDef {
  name: string;
  curveGain: number; // multiplies the wobble terms → sharper track = harder
  kpOffMax: number; // below → too soft, drifts off the curves
  kpWobMin: number; // above → too hard, over-corrects (wobble)
  kpGood: number; // centre of the "just right" band (most robust)
  hint: string;
}

const TRACKS: ReadonlyArray<TrackDef> = [
  {
    name: "Gentle Oval",
    curveGain: 1.0,
    kpOffMax: 1.7,
    kpWobMin: 4.6,
    kpGood: 3.0,
    hint: "Soft curves. A medium Kp tracks it easily.",
  },
  {
    name: "Twisty Loop",
    curveGain: 1.7,
    kpOffMax: 2.6,
    kpWobMin: 5.0,
    kpGood: 3.7,
    hint: "Sharper bends need MORE steering — last round's Kp will drift here.",
  },
  {
    name: "Switchback",
    curveGain: 2.4,
    kpOffMax: 3.3,
    kpWobMin: 5.2,
    kpGood: 4.25,
    hint: "Very tight band. Reason it out, then fine-tune for full stars.",
  },
];

/** Deterministic curvy loop, sharper on later rounds via `gain`. */
function trackPoint(t: number, gain: number): Pt {
  const a = t * Math.PI * 2;
  const x =
    VIEW_W / 2 + Math.cos(a) * 116 + Math.sin(a * 2) * 14 * gain;
  const y =
    VIEW_H / 2 + Math.sin(a) * 78 - Math.cos(a * 3) * 12 * gain;
  return { x, y };
}

const SAMPLES = 240;

/** Precompute geometry for one track so the loop reads cheap arrays. */
interface TrackGeo {
  pts: Pt[];
  d: string;
  maxCurv: number;
}
function buildGeo(gain: number): TrackGeo {
  const pts: Pt[] = Array.from({ length: SAMPLES + 1 }, (_, i) =>
    trackPoint(i / SAMPLES, gain),
  );
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
  // tangent + curvature scan to find the peak bend (for normalising drift)
  const tan = (i: number): number => {
    const a = pts[(i - 1 + pts.length) % pts.length];
    const b = pts[(i + 1) % pts.length];
    return Math.atan2(b.y - a.y, b.x - a.x);
  };
  let maxCurv = 0.0001;
  for (let i = 0; i < SAMPLES; i++) {
    const t0 = tan((i - 4 + pts.length) % pts.length);
    const t1 = tan((i + 4) % pts.length);
    let dd = t1 - t0;
    while (dd > Math.PI) dd -= Math.PI * 2;
    while (dd < -Math.PI) dd += Math.PI * 2;
    if (Math.abs(dd) > maxCurv) maxCurv = Math.abs(dd);
  }
  return { pts, d, maxCurv };
}

const GEOS: TrackGeo[] = TRACKS.map((t) => buildGeo(t.curveGain));

function tangentAt(geo: TrackGeo, i: number): number {
  const a = geo.pts[(i - 1 + geo.pts.length) % geo.pts.length];
  const b = geo.pts[(i + 1) % geo.pts.length];
  return Math.atan2(b.y - a.y, b.x - a.x);
}
function curvatureAt(geo: TrackGeo, i: number): number {
  const t0 = tangentAt(geo, (i - 4 + geo.pts.length) % geo.pts.length);
  const t1 = tangentAt(geo, (i + 4) % geo.pts.length);
  let d = t1 - t0;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/* --- The proportional-control model (deterministic, always winnable) --- */
const KP_MIN = 0.5;
const KP_MAX = 6.0;
const LAP_TICKS = 216;

type Verdict = "off" | "wobble" | "won";
function verdict(kp: number, track: TrackDef): Verdict {
  if (kp < track.kpOffMax) return "off";
  if (kp > track.kpWobMin) return "wobble";
  return "won";
}

/** How many stars a winning Kp earns: closer to the band centre = more. */
function starsFor(kp: number, track: TrackDef): 1 | 2 | 3 {
  const halfBand = Math.min(
    track.kpGood - track.kpOffMax,
    track.kpWobMin - track.kpGood,
  );
  const off = Math.abs(kp - track.kpGood) / halfBand; // 0 = dead centre, 1 = band edge
  if (off <= 0.45) return 3;
  if (off <= 0.8) return 2;
  return 1;
}

function driftDots(kp: number): number {
  return Math.max(0, 9.5 / (kp + 0.6) - 2.4);
}
function wobbleDots(kp: number, track: TrackDef): number {
  return Math.max(0, kp - track.kpGood) * 1.15;
}
function offsetPx(i: number, kp: number, geo: TrackGeo, track: TrackDef): number {
  const curv = curvatureAt(geo, i % SAMPLES);
  const drift = driftDots(kp) * (curv / geo.maxCurv) * 10.0;
  const wob = wobbleDots(kp, track) * Math.sin(i * 0.55) * 4.4;
  return drift + wob;
}
function poseAt(
  i: number,
  kp: number,
  geo: TrackGeo,
  track: TrackDef,
): { x: number; y: number; heading: number } {
  const c = geo.pts[i % SAMPLES];
  const tan = tangentAt(geo, i % SAMPLES);
  const nx = -Math.sin(tan);
  const ny = Math.cos(tan);
  const off = offsetPx(i, kp, geo, track);
  const lead = offsetPx(i + 2, kp, geo, track) - off;
  return { x: c.x + nx * off, y: c.y + ny * off, heading: tan + lead * 0.04 };
}
function errorDotsAt(i: number, kp: number, geo: TrackGeo, track: TrackDef): number {
  const e = offsetPx(i, kp, geo, track) / 7;
  return Math.max(-4, Math.min(4, e));
}

const ROUNDS = TRACKS.length;
const STAR_GLYPH = (n: number): string => "⭐".repeat(n) + "☆".repeat(3 - n);

export default function LineFollowerTuner({ onComplete }: ActivityProps) {
  const [round, setRound] = useState<number>(0);
  const [kp, setKp] = useState<number>(1.2); // a too-low start → drifts off
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<number>(0);
  const [errDots, setErrDots] = useState<number>(0);
  const [lapSecs, setLapSecs] = useState<string>("0.0");
  const [predict, setPredict] = useState<Predict | null>(null);
  const [predictRight, setPredictRight] = useState<boolean | null>(null);
  const [starsThisRound, setStarsThisRound] = useState<number>(0);
  const [totalStars, setTotalStars] = useState<number>(0); // sum across won rounds

  const track = TRACKS[round];
  const geo = GEOS[round];

  // Refs so the animation loop reads fresh values without re-binding.
  const kpRef = useRef<number>(kp);
  const roundRef = useRef<number>(round);
  const phaseRef = useRef<Phase>(phase);
  const tickRef = useRef<number>(0);
  const failAtRef = useRef<number>(SAMPLES + 1);
  const rafRef = useRef<number | null>(null);
  const accRef = useRef<number>(0);
  const lastRef = useRef<number>(0);
  const reportedRef = useRef<boolean>(false); // guards the single final onComplete
  const starsAccRef = useRef<number>(0); // running star total, side-effect-safe

  useEffect(() => {
    kpRef.current = kp;
  }, [kp]);
  useEffect(() => {
    roundRef.current = round;
  }, [round]);

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

      const r = roundRef.current;
      const tr = TRACKS[r];

      if (result === "won") {
        const gained = starsFor(kpRef.current, tr);
        setStarsThisRound(gained);
        setProgress(SAMPLES);

        const sum = starsAccRef.current + gained;
        starsAccRef.current = sum;
        setTotalStars(sum);

        if (r >= ROUNDS - 1) {
          // final round cleared → report once, averaged stars
          const avg = Math.max(1, Math.round(sum / ROUNDS)) as 1 | 2 | 3;
          if (!reportedRef.current) {
            reportedRef.current = true;
            onComplete({
              passed: true,
              stars: avg,
              detail: `Tuned all ${ROUNDS} tracks — clean proportional control. Avg ${avg}★.`,
            });
          }
          setPhase("allDone");
          phaseRef.current = "allDone";
        } else {
          setPhase("won");
          phaseRef.current = "won";
        }
      } else if (result === "off") {
        setPhase("off");
        phaseRef.current = "off";
        setProgress(atSample);
        // NOTE: no onComplete(passed:false) — gentle retry only.
      } else {
        setPhase("wobble");
        phaseRef.current = "wobble";
        setProgress(atSample);
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
        const r = roundRef.current;

        if (i >= failAtRef.current) {
          const v = verdict(kpRef.current, TRACKS[r]);
          setErrDots(errorDotsAt(i, kpRef.current, GEOS[r], TRACKS[r]));
          finish(v, i);
          return;
        }
        if (i >= SAMPLES) {
          finish("won", SAMPLES);
          return;
        }
      }

      const i = tickRef.current;
      const r = roundRef.current;
      setProgress(i);
      setErrDots(errorDotsAt(i, kpRef.current, GEOS[r], TRACKS[r]));
      rafRef.current = requestAnimationFrame(loop);
    },
    [finish],
  );

  const handlePlay = useCallback(() => {
    if (predict === null) return; // must commit a prediction first
    stopLoop();
    const tr = TRACKS[roundRef.current];
    const v = verdict(kpRef.current, tr);
    // grade prediction against the real outcome
    setPredictRight(predict === v);
    // Where a bad run visibly fails: off ≈ first sharp curve, wobble ≈ midway.
    failAtRef.current = v === "off" ? 70 : v === "wobble" ? 150 : SAMPLES + 1;
    tickRef.current = 0;
    accRef.current = 0;
    setProgress(0);
    setErrDots(0);
    lastRef.current = performance.now();
    setPhase("running");
    phaseRef.current = "running";
    rafRef.current = requestAnimationFrame(loop);
  }, [loop, stopLoop, predict]);

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

  const nextRound = useCallback(() => {
    stopLoop();
    const nr = roundRef.current + 1;
    if (nr >= ROUNDS) return;
    roundRef.current = nr;
    setRound(nr);
    setKp(1.2);
    kpRef.current = 1.2;
    tickRef.current = 0;
    accRef.current = 0;
    failAtRef.current = SAMPLES + 1;
    setProgress(0);
    setErrDots(0);
    setPredict(null);
    setPredictRight(null);
    setStarsThisRound(0);
    setPhase("idle");
    phaseRef.current = "idle";
  }, [stopLoop]);

  const onKp = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (phaseRef.current === "running") return;
      setKp(Number(e.target.value));
      // moving the slider invalidates a finished/failed run AND the prediction
      if (phaseRef.current === "off" || phaseRef.current === "wobble") {
        handleReset();
      }
      setPredictRight(null);
    },
    [handleReset],
  );

  const choosePredict = useCallback(
    (p: Predict) => {
      if (phaseRef.current === "running") return;
      setPredict(p);
      setPredictRight(null);
      if (phaseRef.current === "off" || phaseRef.current === "wobble") {
        handleReset();
      }
    },
    [handleReset],
  );

  const running = phase === "running";
  const won = phase === "won" || phase === "allDone";

  const trailColor =
    phase === "won" || phase === "allDone"
      ? ACCENT
      : phase === "off"
        ? RED
        : phase === "wobble"
          ? AMBER
          : CYAN;

  const trailD = useMemo(() => {
    if (progress < 1) return "";
    const pts: string[] = [];
    for (let i = 0; i <= progress; i++) {
      const p = poseAt(i, kp, geo, track);
      pts.push(`${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
    }
    return pts.join(" ");
  }, [progress, kp, geo, track]);

  const robot = useMemo(
    () => poseAt(progress, kp, geo, track),
    [progress, kp, geo, track],
  );

  const correctionDir = errDots > 0.3 ? "◀" : errDots < -0.3 ? "▶" : "●";
  const progressPct = Math.min(100, Math.round((progress / SAMPLES) * 100));

  const status = useMemo(() => {
    if (phase === "allDone")
      return `All ${ROUNDS} tracks tuned! ${STAR_GLYPH(starsThisRound)} ✨`;
    if (phase === "won")
      return `Clean lap — ${STAR_GLYPH(starsThisRound)}. Onto a sharper track ▶`;
    if (phase === "off")
      return "Drifting wide on the curve — correct HARDER (raise Kp).";
    if (phase === "wobble")
      return "Over-correcting into S-shapes — ease off (lower Kp).";
    if (phase === "running") return `Driving the lap… ${progressPct}%`;
    if (predict === null)
      return "Step 1 — PREDICT what this Kp will do, then Play ▶";
    return "Step 2 — happy with your plan? Press Play ▶";
  }, [phase, starsThisRound, progressPct, predict]);

  const predictLabel: Record<Predict, string> = {
    off: "Drift off",
    won: "Clean lap",
    wobble: "Wobble",
  };

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

      {/* ---------------- ROUND HEADER ---------------- */}
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className="font-mono text-[11px] text-ink-dim">
          Track {round + 1}/{ROUNDS} ·{" "}
          <span style={{ color: VIOLET }}>{track.name}</span>
        </span>
        <span aria-hidden className="flex gap-1">
          {TRACKS.map((_, i) => (
            <span
              key={i}
              className="inline-block h-2 w-2 rounded-full"
              style={{
                background:
                  i < round ? ACCENT : i === round ? VIOLET : "#1e293b",
                boxShadow: i === round ? `0 0 6px ${VIOLET}` : undefined,
              }}
            />
          ))}
        </span>
      </div>

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
          aria-label={`Robot driving the ${track.name} line-following track`}
        >
          <path
            d={geo.d}
            fill="none"
            stroke="#111827"
            strokeWidth={8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={geo.d}
            fill="none"
            stroke={ACCENT}
            strokeOpacity={0.55}
            strokeWidth={1.4}
            strokeDasharray="3 4"
          />

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

          <circle cx={geo.pts[0].x} cy={geo.pts[0].y} r={5} fill={ACCENT} />
          <text
            x={geo.pts[0].x}
            y={geo.pts[0].y - 9}
            fill="#111827"
            fontSize={8}
            textAnchor="middle"
            fontFamily="monospace"
          >
            START
          </text>

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

      {/* ---------------- PREDICT panel ---------------- */}
      {!won && (
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-panel/60 p-3">
          <div className="flex items-center justify-between font-mono text-[11px]">
            <span className="text-ink-dim">
              Predict: with Kp = {kp.toFixed(1)}, this lap will…
            </span>
            {predictRight !== null && !running && (
              <span
                className="font-display"
                style={{ color: predictRight ? ACCENT : AMBER }}
              >
                {predictRight ? "called it! ✓" : "not quite — look again"}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["off", "won", "wobble"] as const).map((p) => {
              const active = predict === p;
              const col =
                p === "off" ? RED : p === "won" ? ACCENT : AMBER;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => choosePredict(p)}
                  onPointerDown={(e) => e.stopPropagation()}
                  disabled={running}
                  aria-pressed={active}
                  aria-label={`Predict the robot will ${predictLabel[p]}`}
                  className="rounded-lg border px-2 py-2 text-xs font-medium disabled:opacity-50"
                  style={{
                    borderColor: active ? col : "var(--line, #243044)",
                    background: active ? col : "transparent",
                    color: active ? "#05070d" : "var(--ink-dim, #94a3b8)",
                  }}
                >
                  {predictLabel[p]}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
          <span
            aria-hidden
            className="absolute top-0 h-full"
            style={{ left: "50%", width: 2, background: ACCENT, opacity: 0.7 }}
          />
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
            disabled={running || won}
            aria-label={`Steering strength Kp, current value ${kp.toFixed(1)}`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-50"
            style={{ accentColor: ACCENT, touchAction: "none" }}
          />
          <span className="flex justify-between font-mono text-[10px] text-ink-faint">
            <span>{KP_MIN.toFixed(1)} · too soft, drifts wide</span>
            <span>{KP_MAX.toFixed(1)} · too hard, wobbles</span>
          </span>
        </label>
        <p className="font-mono text-[10px] text-ink-faint">
          💡 {track.hint} Tune near the band&apos;s centre for ⭐⭐⭐.
        </p>
      </div>

      {/* ---------------- CONTROLS ---------------- */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="font-mono text-[11px] text-ink-faint"
          aria-label={`Stars so far ${totalStars}`}
        >
          {won && phase === "won"
            ? STAR_GLYPH(starsThisRound)
            : `Kp = ${kp.toFixed(1)}`}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={won}
            className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim disabled:opacity-50"
            aria-label="Reset the robot to the start"
          >
            Reset
          </button>
          {phase === "won" ? (
            <button
              type="button"
              onClick={nextRound}
              onPointerDown={(e) => e.stopPropagation()}
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: VIOLET, color: "#05070d" }}
              aria-label="Go to the next, harder track"
            >
              Next track ▶
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePlay}
              onPointerDown={(e) => e.stopPropagation()}
              disabled={running || won || predict === null}
              className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
              style={{ background: ACCENT, color: "#05070d" }}
              aria-label="Play one lap"
            >
              {running
                ? "Driving…"
                : predict === null
                  ? "Predict first"
                  : "Play ▶"}
            </button>
          )}
        </div>
      </div>

      {/* win celebration (final) */}
      {phase === "allDone" && (
        <div
          className="rounded-lg border px-3 py-2 text-center font-mono text-xs"
          style={{
            borderColor: ACCENT,
            color: ACCENT,
            animation: "g6linefollowertuner-pop .5s ease both",
          }}
        >
          ✨🎉 All {ROUNDS} tracks tuned! You matched each one&apos;s curves with
          the right Kp — that&apos;s proportional control.
        </div>
      )}
    </div>
  );
}
