"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Weather Station Dashboard — diagnose & calibrate (Class 4-6)        */
/*                                                                     */
/*  A real weather station has 4 sensors. Each scene has a TRUSTED set  */
/*  of reference values. One (or more) sensors are LYING — reading off  */
/*  by some offset. The player must:                                    */
/*    1) READ all four live gauges and compare each to its reference,   */
/*    2) DIAGNOSE which sensor is faulty (it is NOT named by a clue —   */
/*       it changes every round, so you can't pattern-match), and       */
/*    3) CALIBRATE it back into agreement with a slider.                 */
/*                                                                     */
/*  Three escalating rounds. Round 3 twist: TWO sensors are faulty, and  */
/*  one drifts the opposite way — so "always slide left" fails.          */
/*                                                                     */
/*  Optimization → stars: diagnose with no wrong accusations and        */
/*  calibrate tightly for 3 stars; sloppy work earns fewer.             */
/* ------------------------------------------------------------------ */

const ACCENT = "#a855f7";
const GOOD = "#34d399";
const BAD = "#f87171";
const WARN = "#fbbf24";

type SensorId = "temp" | "pressure" | "uv" | "light";

interface SensorDef {
  id: SensorId;
  name: string;
  device: string;
  unit: string;
  glyph: string;
  min: number;
  max: number;
  /** How close (in sensor units) counts as "calibrated". */
  tol: number;
  /** Slider range for the calibration offset. */
  offMin: number;
  offMax: number;
  offStep: number;
}

const SENSORS: readonly SensorDef[] = [
  { id: "temp", name: "Temperature", device: "DHT22", unit: "°C", glyph: "🌡️", min: -5, max: 45, tol: 1, offMin: -14, offMax: 14, offStep: 0.5 },
  { id: "pressure", name: "Pressure", device: "BMP280", unit: "hPa", glyph: "🔵", min: 970, max: 1040, tol: 2, offMin: -30, offMax: 30, offStep: 1 },
  { id: "uv", name: "UV Index", device: "UV", unit: "", glyph: "🟣", min: 0, max: 11, tol: 0.5, offMin: -6, offMax: 6, offStep: 0.5 },
  { id: "light", name: "Light", device: "lux", unit: "lx", glyph: "💡", min: 0, max: 1000, tol: 30, offMin: -400, offMax: 400, offStep: 10 },
] as const;

function sensorDef(id: SensorId): SensorDef {
  return SENSORS.find((s) => s.id === id) ?? SENSORS[0];
}

interface RoundDef {
  scene: string;
  emoji: string;
  /** Trusted reference value for every sensor. */
  ref: Record<SensorId, number>;
  /** Which sensors are lying, and by how much (added to the true reading). */
  faults: Partial<Record<SensorId, number>>;
  blurb: string;
}

/* Deterministic, hand-tuned rounds. The faulty sensor changes each round so
   pattern-matching fails. Round 3 has TWO faults pulling opposite directions. */
const ROUNDS: readonly RoundDef[] = [
  {
    scene: "Sunny Noon",
    emoji: "☀️",
    ref: { temp: 31, pressure: 1022, uv: 9, light: 900 },
    faults: { temp: 8 }, // thermometer reads 8° too HOT
    blurb: "One sensor is lying. Read every gauge, compare to its trusted reference, and find the odd one out.",
  },
  {
    scene: "Cloudy",
    emoji: "☁️",
    ref: { temp: 23, pressure: 1008, uv: 3, light: 380 },
    faults: { light: 320 }, // light sensor reads way too bright
    blurb: "Different scene, different liar. Don't guess — the faulty sensor is whichever one disagrees with its reference.",
  },
  {
    scene: "Storm Coming",
    emoji: "⛈️",
    ref: { temp: 20, pressure: 984, uv: 2, light: 150 },
    faults: { pressure: 22, uv: -2.5 }, // TWIST: two faults, opposite signs
    blurb: "Storm twist: TWO sensors are off — and they drift opposite ways. Fix both to match the reference.",
  },
] as const;

const N_ROUNDS = ROUNDS.length;

/** Per-sensor deterministic drift so gauges feel "live" without randomness. */
function drift(id: SensorId, tick: number): number {
  const phase = id === "temp" ? 0 : id === "pressure" ? 1.6 : id === "uv" ? 3.1 : 4.4;
  const amp = id === "temp" ? 0.4 : id === "pressure" ? 1.2 : id === "uv" ? 0.2 : 10;
  return Math.sin(tick / 7 + phase) * amp;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Gauge needle path for a value in [min,max] across a 240° arc. */
function needleAngle(v: number, min: number, max: number): number {
  const t = clamp((v - min) / (max - min), 0, 1);
  return -120 + t * 240;
}

function fmt(id: SensorId, v: number): string {
  if (id === "uv") return v.toFixed(1);
  if (id === "pressure") return v.toFixed(0);
  if (id === "light") return v.toFixed(0);
  return v.toFixed(1);
}

type Phase = "diagnose" | "calibrate" | "roundWon" | "done";

export default function WeatherStationDashboard({ onComplete }: ActivityProps) {
  const [round, setRound] = useState<number>(0);
  const [tick, setTick] = useState<number>(0);
  const [phase, setPhase] = useState<Phase>("diagnose");

  // The set of sensors the player still has to fix this round (the real faults).
  const [openSuspects, setOpenSuspects] = useState<SensorId[]>([]);
  // Player-applied calibration offsets per sensor (cancel the fault).
  const [offsets, setOffsets] = useState<Record<SensorId, number>>({
    temp: 0,
    pressure: 0,
    uv: 0,
    light: 0,
  });
  // Which sensor's calibration panel is open.
  const [active, setActive] = useState<SensorId | null>(null);
  // Wrong accusations this round (tapping a healthy sensor) — costs stars.
  const [misAccuse, setMisAccuse] = useState<number>(0);
  // Total wrong accusations across the whole game (for final stars).
  const [totalMis, setTotalMis] = useState<number>(0);

  const [glow, setGlow] = useState<SensorId | null>(null);
  const [shake, setShake] = useState<SensorId | null>(null);
  const [hint, setHint] = useState<string>("");

  const reportedRef = useRef<boolean>(false);
  const timersRef = useRef<number[]>([]);

  const pushTimer = useCallback((id: number) => {
    timersRef.current.push(id);
  }, []);
  useEffect(
    () => () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    },
    [],
  );

  // Gentle "live" ticking. Pure counter → drift() is deterministic.
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 700);
    return () => window.clearInterval(t);
  }, []);

  const roundDef = ROUNDS[round];

  /** The list of sensors that are genuinely faulty this round. */
  const faultyIds = useMemo<SensorId[]>(
    () => (Object.keys(roundDef.faults) as SensorId[]).filter((k) => roundDef.faults[k] !== undefined),
    [roundDef],
  );

  // When the round changes, reset the per-round state. (Not on every render.)
  useEffect(() => {
    setPhase("diagnose");
    setOpenSuspects([]);
    setOffsets({ temp: 0, pressure: 0, uv: 0, light: 0 });
    setActive(null);
    setMisAccuse(0);
    setGlow(null);
    setShake(null);
    setHint("");
  }, [round]);

  /** Live reading shown on a gauge: reference + scene drift + fault − player calibration. */
  const reading = useCallback(
    (id: SensorId): number => {
      const def = sensorDef(id);
      const fault = roundDef.faults[id] ?? 0;
      const v = roundDef.ref[id] + drift(id, tick) + fault + offsets[id];
      return clamp(v, def.min, def.max);
    },
    [roundDef, tick, offsets],
  );

  const refOf = useCallback((id: SensorId): number => roundDef.ref[id], [roundDef]);

  /** Is this sensor currently reading within tolerance of its reference? */
  const inTol = useCallback(
    (id: SensorId): boolean => Math.abs(reading(id) - refOf(id)) <= sensorDef(id).tol,
    [reading, refOf],
  );

  /** Every faulty sensor has been found (opened) AND calibrated into tolerance. */
  const allFound = faultyIds.every((id) => openSuspects.includes(id));
  const allCalibrated = faultyIds.every((id) => inTol(id));

  // ---- Diagnose: tap a gauge to accuse it of being faulty ----
  const accuse = useCallback(
    (id: SensorId) => {
      if (phase !== "diagnose" && phase !== "calibrate") return;
      if (openSuspects.includes(id)) {
        // Re-open its calibration panel.
        setActive(id);
        return;
      }
      if (faultyIds.includes(id)) {
        // Correct! Reveal its calibration tool.
        setOpenSuspects((prev) => [...prev, id]);
        setActive(id);
        setPhase("calibrate");
        setGlow(id);
        setHint("");
        const t = window.setTimeout(() => setGlow(null), 700);
        pushTimer(t);
      } else {
        // Wrong accusation — this sensor already agrees with its reference.
        setMisAccuse((m) => m + 1);
        setTotalMis((m) => m + 1);
        setShake(id);
        const def = sensorDef(id);
        setHint(
          `${def.name} (${def.device}) reads ${fmt(id, reading(id))}${def.unit} and the reference says ${fmt(id, refOf(id))}${def.unit} — that's a match, not the liar.`,
        );
        const t = window.setTimeout(() => setShake(null), 450);
        pushTimer(t);
      }
    },
    [phase, openSuspects, faultyIds, reading, refOf, pushTimer],
  );

  const setOffset = useCallback((id: SensorId, value: number) => {
    setOffsets((prev) => ({ ...prev, [id]: value }));
  }, []);

  // ---- Advance the round once everything is found AND calibrated ----
  const lastRound = round === N_ROUNDS - 1;

  const finishRound = useCallback(() => {
    if (lastRound) {
      if (reportedRef.current) return;
      reportedRef.current = true;
      // Stars: start at 3, lose one for ≥1 wrong accusation, lose another for ≥4.
      const mis = totalMis;
      const stars: 1 | 2 | 3 = mis === 0 ? 3 : mis <= 3 ? 2 : 1;
      setPhase("done");
      onComplete({
        passed: true,
        stars,
        detail:
          mis === 0
            ? "Flawless diagnosis — every faulty sensor found on the first try and calibrated to the reference!"
            : `Station fixed across all ${N_ROUNDS} rounds. (${mis} wrong accusation${mis === 1 ? "" : "s"} along the way.)`,
      });
    } else {
      setPhase("roundWon");
      const t = window.setTimeout(() => setRound((r) => r + 1), 1100);
      pushTimer(t);
    }
  }, [lastRound, totalMis, onComplete, pushTimer]);

  // Watch for round completion. We require the player to have OPENED every fault
  // (so they can't win by luck) and calibrated each into tolerance.
  useEffect(() => {
    if (phase !== "calibrate") return;
    if (allFound && allCalibrated) {
      finishRound();
    }
  }, [phase, allFound, allCalibrated, finishRound]);

  const reset = useCallback(() => {
    reportedRef.current = false;
    setTotalMis(0);
    setRound(0);
    // The round-effect resets everything else when round becomes 0; if we are
    // already on round 0, force the per-round reset explicitly.
    setPhase("diagnose");
    setOpenSuspects([]);
    setOffsets({ temp: 0, pressure: 0, uv: 0, light: 0 });
    setActive(null);
    setMisAccuse(0);
    setGlow(null);
    setShake(null);
    setHint("");
  }, []);

  const won = phase === "done";
  const foundCount = faultyIds.filter((id) => openSuspects.includes(id)).length;
  const calCount = faultyIds.filter((id) => openSuspects.includes(id) && inTol(id)).length;

  const status = won
    ? "Weather station fully repaired — every sensor agrees with the reference!"
    : phase === "roundWon"
      ? "Round clear! Next station warming up…"
      : phase === "diagnose"
        ? `Round ${round + 1}/${N_ROUNDS} · ${roundDef.blurb}`
        : `Found ${foundCount}/${faultyIds.length} · Calibrated ${calCount}/${faultyIds.length} — slide each fixed sensor onto its reference.`;

  const activeDef = active ? sensorDef(active) : null;

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink">
      <style>{`
        @keyframes g6weatherdashboard-shake {
          0% { transform: translateX(0); }
          25% { transform: translateX(-4px) rotate(-1.5deg); }
          75% { transform: translateX(4px) rotate(1.5deg); }
          100% { transform: translateX(0); }
        }
        @keyframes g6weatherdashboard-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g6weatherdashboard-glow {
          0%,100% { filter: drop-shadow(0 0 0 ${ACCENT}); }
          50% { filter: drop-shadow(0 0 6px ${ACCENT}); }
        }
        @keyframes g6weatherdashboard-pulse {
          0%,100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .g6wd-anim { animation: none !important; }
        }
      `}</style>

      {/* ---------------- SCENE / ROUND HEADER ---------------- */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-tech text-ink-faint">
          {roundDef.emoji} {roundDef.scene} — diagnostic
        </span>
        <div className="flex gap-1" aria-label={`Round ${round + 1} of ${N_ROUNDS}`}>
          {ROUNDS.map((_, i) => (
            <span
              key={i}
              aria-hidden
              className="h-2 w-2 rounded-full"
              style={{
                background: i < round || won ? GOOD : i === round ? ACCENT : "var(--color-line, #2a2f3a)",
              }}
            />
          ))}
        </div>
      </div>

      {/* ---------------- 2x2 GAUGE DASHBOARD ---------------- */}
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Sensor gauges — tap the one you think is lying">
        {SENSORS.map((s) => {
          const v = reading(s.id);
          const ref = refOf(s.id);
          const opened = openSuspects.includes(s.id);
          const calibratedNow = inTol(s.id);
          const isActive = active === s.id;
          const tileGlow = glow === s.id;
          const tileShake = shake === s.id;

          const ringColor = won
            ? GOOD
            : opened
              ? calibratedNow
                ? GOOD
                : WARN
              : isActive
                ? ACCENT
                : "var(--color-line, #2a2f3a)";

          // The gap badge: shown only AFTER a sensor is opened (so diagnosing
          // stays a real reading task, not "read the number off the screen").
          const gap = v - ref;
          const showGap = opened || won;

          return (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              aria-label={`${s.name} sensor (${s.device}) reading ${fmt(s.id, v)} ${s.unit}, reference ${fmt(s.id, ref)} ${s.unit}. ${
                opened ? (calibratedNow ? "Calibrated." : "Faulty — open for calibration.") : "Tap if you think it is faulty."
              }`}
              aria-pressed={isActive}
              onClick={() => accuse(s.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  accuse(s.id);
                }
              }}
              className="relative flex flex-col items-center gap-1 rounded-xl border p-2"
              style={{
                borderColor: ringColor,
                background: "var(--color-panel, #12151c)",
                boxShadow: tileGlow ? `0 0 16px -4px ${ACCENT}` : undefined,
                cursor: won ? "default" : "pointer",
                animation: tileGlow
                  ? "g6weatherdashboard-glow .7s ease"
                  : tileShake
                    ? "g6weatherdashboard-shake .45s ease"
                    : undefined,
                transition: "border-color .25s ease, box-shadow .25s ease",
              }}
            >
              <span className="flex items-center gap-1 text-[11px] text-ink-dim">
                <span aria-hidden>{s.glyph}</span>
                {s.name}
                <span className="text-ink-faint">· {s.device}</span>
              </span>

              {/* SVG gauge */}
              <svg viewBox="0 0 100 70" className="w-full" role="img" aria-hidden>
                <path
                  d={describeArc(50, 55, 34, -120, 120)}
                  fill="none"
                  stroke="var(--color-line, #2a2f3a)"
                  strokeWidth={6}
                  strokeLinecap="round"
                />
                {/* reference tick — the trusted target the needle should land on */}
                {showGap &&
                  (() => {
                    const a = needleAngle(ref, s.min, s.max);
                    const o = polar(50, 55, 38, a);
                    const i = polar(50, 55, 30, a);
                    return (
                      <line
                        x1={i.x}
                        y1={i.y}
                        x2={o.x}
                        y2={o.y}
                        stroke={GOOD}
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                    );
                  })()}
                <path
                  d={describeArc(50, 55, 34, -120, needleAngle(v, s.min, s.max))}
                  fill="none"
                  stroke={opened && !calibratedNow ? WARN : ACCENT}
                  strokeWidth={6}
                  strokeLinecap="round"
                  style={{ transition: "all .35s ease" }}
                />
                <g
                  transform={`rotate(${needleAngle(v, s.min, s.max)} 50 55)`}
                  style={{ transition: "transform .35s ease" }}
                >
                  <line x1={50} y1={55} x2={50} y2={26} stroke="#e5e7eb" strokeWidth={2} strokeLinecap="round" />
                </g>
                <circle cx={50} cy={55} r={3} fill="#e5e7eb" />
                <text x={50} y={50} textAnchor="middle" fontSize={11} fill={ACCENT} className="tabular-nums">
                  {fmt(s.id, v)}
                </text>
              </svg>

              {/* reference read-out under EVERY gauge — this is the data you reason over */}
              <span className="text-[10px] text-ink-faint">
                ref{" "}
                <span style={{ color: showGap ? (calibratedNow ? GOOD : WARN) : "var(--color-ink-dim, #9aa6b2)" }}>
                  {fmt(s.id, ref)}
                  {s.unit}
                </span>
                {showGap && (
                  <span style={{ color: calibratedNow ? GOOD : WARN }}>
                    {" "}· gap {gap > 0 ? "+" : ""}
                    {fmt(s.id, gap)}
                  </span>
                )}
              </span>

              {/* status badge once opened */}
              {(opened || won) && (
                <span
                  className="absolute right-1 top-1 text-[9px] g6wd-anim"
                  style={{
                    color: calibratedNow ? GOOD : WARN,
                    animation: "g6weatherdashboard-pop .4s ease",
                  }}
                >
                  {calibratedNow ? "✓ cal" : "⚠ off"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ---------------- DIAGNOSE HINT ---------------- */}
      {phase === "diagnose" && openSuspects.length === 0 && (
        <div className="rounded-xl border border-line bg-panel/60 p-2">
          <span
            className="text-[11px] text-ink-dim g6wd-anim"
            style={{ animation: "g6weatherdashboard-pulse 1.6s ease infinite" }}
          >
            Every gauge shows its <b>reference</b> value underneath. The faulty sensor is the one
            whose needle does <b>not</b> match its reference. Tap it to start fixing it.
          </span>
        </div>
      )}

      {/* ---------------- CALIBRATION PANEL ---------------- */}
      {active && activeDef && !won && (openSuspects.includes(active)) && (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-panel/60 p-3">
          <span className="text-[11px] text-ink-dim">
            Calibrate <b>{activeDef.name}</b> ({activeDef.device}): slide the offset until the gauge
            lands on the green reference tick.
          </span>
          <label className="flex flex-col gap-1 text-xs">
            <span className="flex items-center justify-between">
              <span className="text-ink-dim">offset</span>
              <span className="tabular-nums" style={{ color: inTol(active) ? GOOD : ACCENT }}>
                {offsets[active] > 0 ? "+" : ""}
                {offsets[active]}
                {activeDef.unit}
              </span>
            </span>
            <input
              type="range"
              min={activeDef.offMin}
              max={activeDef.offMax}
              step={activeDef.offStep}
              value={offsets[active]}
              onChange={(e) => setOffset(active, Number(e.target.value))}
              aria-label={`${activeDef.name} calibration offset, ${offsets[active]} ${activeDef.unit}`}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2"
              style={{ accentColor: ACCENT, touchAction: "none" }}
            />
          </label>
          <span className="text-[11px]" style={{ color: inTol(active) ? GOOD : WARN }}>
            gauge {fmt(active, reading(active))}
            {activeDef.unit} vs reference {fmt(active, refOf(active))}
            {activeDef.unit} · gap {fmt(active, Math.abs(reading(active) - refOf(active)))}
            {inTol(active) ? " ✓ matched" : ""}
          </span>
          {/* If more than one fault remains, nudge back to diagnosing the rest. */}
          {faultyIds.length > 1 && (
            <span className="text-[10px] text-ink-faint">
              {foundCount < faultyIds.length
                ? "Another sensor is still lying — tap it on the dashboard too."
                : calCount < faultyIds.length
                  ? "Both found — make sure each one is matched."
                  : ""}
            </span>
          )}
        </div>
      )}

      {/* ---------------- STATUS ---------------- */}
      <div
        role="status"
        aria-live="polite"
        className="rounded-lg px-3 py-2 text-center text-xs"
        style={{
          background: won ? `${GOOD}1a` : "var(--color-panel, #12151c)",
          color: won ? GOOD : "var(--color-ink-dim, #9aa6b2)",
          border: won ? `1px solid ${GOOD}` : "1px solid var(--color-line, #2a2f3a)",
        }}
      >
        {won ? "✨🎉 " : ""}
        {status}
      </div>

      {hint && !won && (
        <p className="text-center text-[11px]" style={{ color: BAD }}>
          {hint}
        </p>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-ink-faint">
          Wrong accusations: {misAccuse}
          {totalMis !== misAccuse ? ` (game ${totalMis})` : ""}
        </span>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
          aria-label="Reset the dashboard"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

/* ----- SVG arc helper (degrees, clockwise, 0° = up) ----- */
function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = polar(cx, cy, r, endDeg);
  const end = polar(cx, cy, r, startDeg);
  const large = Math.abs(endDeg - startDeg) <= 180 ? 0 : 1;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${large} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}
