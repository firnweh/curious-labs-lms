"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Heartbeat Health Monitor (Class 4-6) — a sensor turns a body       */
/*  signal into DATA, and turning that data into a RATE is real        */
/*  reasoning, not just counting. Each round the wave covers a         */
/*  DIFFERENT time window, so beats-per-minute = beats × (60 / window).*/
/*  The learner must:                                                  */
/*    1 · PREDICT the zone from the patient's story (commit a plan),   */
/*    2 · MEASURE — tap every heartbeat spike on the scrolling wave,   */
/*    3 · pick the RIGHT MULTIPLIER for that window to get BPM,        */
/*    4 · SORT the reading into Low / Normal / High.                   */
/*  The shifting window defeats "count = BPM" — you have to reason     */
/*  about rate. Full stars need sharp predictions + the right          */
/*  multiplier first try. Always winnable; gentle retries only.        */
/* ------------------------------------------------------------------ */

const ACCENT = "#a855f7"; // win / normal violet
const LOW = "#38bdf8"; // low cyan
const HIGH = "#f87171"; // high red
const OK = "#34d399"; // correct-tick green
const WARN = "#fbbf24"; // gentle-amber for "not quite"

type Zone = "low" | "normal" | "high";

interface Patient {
  id: string;
  name: string;
  emoji: string;
  /** What the learner is doing — sets the story for the prediction. */
  note: string;
  /** True number of peaks (beats) the wave shows in its window. */
  peaks: number;
  /** Length of the strip in SECONDS — the multiplier the learner must pick. */
  windowSec: number;
  /** The correct health zone for the resulting BPM. */
  zone: Zone;
}

/**
 * Three deterministic, ESCALATING patients. BPM = peaks × (60 / windowSec).
 * The window CHANGES every round, so the learner can't just read "beats = BPM":
 *   rest  : 12 beats over 10 s  → ×6  → 72 BPM  → normal
 *   run   : 27 beats over 15 s  → ×4  → 108 BPM → high
 *   calm  : 5 beats over 6 s    → ×10 → 50 BPM  → low
 * Peak counts sit well clear of the 60 / 100 zone edges so a ±1 tap slip can
 * never flip the BPM into the wrong zone — always winnable.
 */
const PATIENTS: readonly Patient[] = [
  {
    id: "rest",
    name: "Maya, resting",
    emoji: "🧍",
    note: "sitting quietly, breathing normally",
    peaks: 12,
    windowSec: 10,
    zone: "normal",
  },
  {
    id: "run",
    name: "Maya, after a sprint",
    emoji: "🏃",
    note: "just sprinted 100 m — heart pounding",
    peaks: 27,
    windowSec: 15,
    zone: "high",
  },
  {
    id: "calm",
    name: "Maya, deep breathing",
    emoji: "😌",
    note: "slow, calm, half-asleep breaths",
    peaks: 5,
    windowSec: 6,
    zone: "low",
  },
] as const;

const TAP_TOLERANCE = 1; // ±1 peak still counts as a correct measurement

/** Classify a BPM into a health zone — the data-reading rule. */
function zoneOf(bpm: number): Zone {
  if (bpm < 60) return "low";
  if (bpm > 100) return "high";
  return "normal";
}

const ZONE_META: Record<Zone, { label: string; range: string; color: string }> = {
  low: { label: "LOW", range: "< 60", color: LOW },
  normal: { label: "NORMAL", range: "60–100", color: ACCENT },
  high: { label: "HIGH", range: "> 100", color: HIGH },
};

/** Multiplier that turns "beats in this window" into beats-per-minute. */
function multiplierFor(windowSec: number): number {
  return 60 / windowSec;
}

/** The three multiplier cards offered. Exactly one is right per window. */
const MULTIPLIER_CHOICES: readonly number[] = [10, 6, 4];

/* --- Wave geometry. A repeating cardiac-style pulse across the screen. --- */
const WAVE_W = 360;
const WAVE_H = 90;
const MID = 52; // baseline y
const PAD_X = 14;

interface Peak {
  /** x position of the tall spike (the heartbeat) in the *content* space. */
  x: number;
  tapped: boolean;
}

/**
 * Build a deterministic poly-line for `n` evenly spaced cardiac pulses plus
 * the x of each tall R-spike (the peak the learner must tap). One full screen
 * width shows the whole window, so counting the visible spikes is the task.
 */
function buildWave(n: number): { d: string; peaks: number[] } {
  const usable = WAVE_W - PAD_X * 2;
  const gap = usable / n;
  const pts: [number, number][] = [];
  const peaks: number[] = [];
  pts.push([0, MID]);
  for (let i = 0; i < n; i++) {
    const cx = PAD_X + gap * (i + 0.5);
    peaks.push(cx);
    // flat lead-in
    pts.push([cx - gap * 0.34, MID]);
    // small dip (Q)
    pts.push([cx - gap * 0.16, MID + 6]);
    // tall spike up (R = the heartbeat)
    pts.push([cx, MID - 34]);
    // dip below (S)
    pts.push([cx + gap * 0.14, MID + 12]);
    // small bump (T) then back to baseline
    pts.push([cx + gap * 0.26, MID - 5]);
    pts.push([cx + gap * 0.38, MID]);
  }
  pts.push([WAVE_W, MID]);
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(" ");
  return { d, peaks };
}

type Stage = "predict" | "measure" | "convert" | "sort" | "done";

interface Reading {
  /** Zone the learner PREDICTED from the story (before measuring). */
  predicted: Zone | null;
  /** Beats the learner counted on the wave. */
  beats: number | null;
  /** Final BPM once the right multiplier is applied. */
  bpm: number | null;
  /** Which zone the learner dropped this reading into (null = not sorted). */
  placed: Zone | null;
}

const EMPTY_READING: Reading = {
  predicted: null,
  beats: null,
  bpm: null,
  placed: null,
};

export default function HeartbeatMonitor({ onComplete }: ActivityProps) {
  const [active, setActive] = useState<number>(0); // index into PATIENTS
  const [measuring, setMeasuring] = useState<boolean>(false);
  const [peaks, setPeaks] = useState<Peak[]>([]);
  const [missTap, setMissTap] = useState<boolean>(false); // tapped a valley
  const [readings, setReadings] = useState<Record<string, Reading>>({});
  const [dragZone, setDragZone] = useState<Zone | null>(null); // hover target
  const [won, setWon] = useState<boolean>(false);

  // Quality tracking → drives the star rating (deterministic).
  const slips = useRef<number>(0); // wrong predictions + wrong multiplier picks
  const [wrongPick, setWrongPick] = useState<number | null>(null); // flash a bad ×card

  const reportedRef = useRef<boolean>(false);
  const missTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const patient = PATIENTS[active];

  // Geometry + peak x-positions for whichever patient is on screen.
  const wave = useMemo(() => buildWave(patient.peaks), [patient.peaks]);

  // Reset the tap state whenever we move to a fresh patient's wave.
  useEffect(() => {
    setPeaks(wave.peaks.map((x) => ({ x, tapped: false })));
    setMeasuring(false);
    setMissTap(false);
    setWrongPick(null);
  }, [wave]);

  useEffect(
    () => () => {
      if (missTimer.current) clearTimeout(missTimer.current);
      if (pickTimer.current) clearTimeout(pickTimer.current);
    },
    [],
  );

  const tappedCount = peaks.filter((p) => p.tapped).length;
  const within =
    measuring && Math.abs(tappedCount - patient.peaks) <= TAP_TOLERANCE;

  const current: Reading = readings[patient.id] ?? EMPTY_READING;

  const stage: Stage = won
    ? "done"
    : current.placed && zoneOf(current.bpm ?? -1) === current.placed
      ? "sort" // sorted correctly → resting on the "Next" state
      : current.bpm != null
        ? "sort"
        : current.beats != null
          ? "convert"
          : current.predicted != null
            ? "measure"
            : "predict";

  /* ---------------- helper to patch the active reading ---------------- */
  const patchReading = useCallback(
    (patch: Partial<Reading>) => {
      setReadings((prev) => ({
        ...prev,
        [patient.id]: { ...(prev[patient.id] ?? EMPTY_READING), ...patch },
      }));
    },
    [patient.id],
  );

  /* ---------------- 1 · PREDICT the zone from the story ---------------- */
  const predict = useCallback(
    (zone: Zone) => {
      if (zone !== patient.zone) slips.current += 1;
      patchReading({ predicted: zone });
    },
    [patient.zone, patchReading],
  );

  /* ---------------- 2 · TAP A PEAK (count a heartbeat) ---------------- */
  const flashMiss = useCallback(() => {
    setMissTap(true);
    if (missTimer.current) clearTimeout(missTimer.current);
    missTimer.current = setTimeout(() => setMissTap(false), 1100);
  }, []);

  const onWavePointer = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!measuring || stage !== "measure") return;
      e.preventDefault();
      const svg = e.currentTarget;
      const r = svg.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * WAVE_W;
      const y = ((e.clientY - r.top) / r.height) * WAVE_H;
      // A tap counts if it lands near a spike's x and in the upper (tall) band.
      let hit = -1;
      let bestDx = 22;
      peaks.forEach((p, i) => {
        const dx = Math.abs(p.x - x);
        if (!p.tapped && dx < bestDx) {
          bestDx = dx;
          hit = i;
        }
      });
      if (hit >= 0 && y < MID + 2) {
        setPeaks((prev) =>
          prev.map((p, i) => (i === hit ? { ...p, tapped: true } : p)),
        );
        setMissTap(false);
      } else {
        flashMiss();
      }
    },
    [measuring, stage, peaks, flashMiss],
  );

  /* ---------------- MEASURE button: start the scroll ---------------- */
  const startMeasure = useCallback(() => {
    setPeaks(wave.peaks.map((x) => ({ x, tapped: false })));
    setMeasuring(true);
    setMissTap(false);
  }, [wave]);

  // Lock in the counted beats and move to the "pick a multiplier" stage.
  const lockBeats = useCallback(() => {
    patchReading({ beats: tappedCount });
    setMeasuring(false);
  }, [tappedCount, patchReading]);

  /* ---------------- 3 · PICK THE MULTIPLIER → compute BPM ---------------- */
  const pickMultiplier = useCallback(
    (m: number) => {
      if (current.beats == null) return;
      const right = multiplierFor(patient.windowSec);
      if (m !== right) {
        slips.current += 1;
        setWrongPick(m);
        if (pickTimer.current) clearTimeout(pickTimer.current);
        pickTimer.current = setTimeout(() => setWrongPick(null), 1200);
        return; // gentle retry — let them try another card
      }
      patchReading({ bpm: current.beats * m });
      setWrongPick(null);
    },
    [current.beats, patient.windowSec, patchReading],
  );

  /* ---------------- 4 · DRAG the reading into a zone ---------------- */
  const placeReading = useCallback(
    (zone: Zone) => {
      setDragZone(null);
      patchReading({ placed: zone });
    },
    [patchReading],
  );

  /* ---------------- advance / grade ---------------- */
  // A patient is fully solved when measured + converted + sorted into the right zone.
  const solved = useCallback(
    (p: Patient): boolean => {
      const r = readings[p.id];
      if (!r || r.bpm == null) return false;
      return zoneOf(r.bpm) === p.zone && r.placed === p.zone;
    },
    [readings],
  );

  const allSolved = PATIENTS.every((p) => solved(p));

  // Deterministic stars at win time: 0 slips → 3, 1-2 slips → 2, more → 1.
  // A clean ⭐⭐⭐ is always reachable. Slips = wrong predictions + wrong
  // multiplier picks + wrong zone drops.
  useEffect(() => {
    if (allSolved && !reportedRef.current) {
      reportedRef.current = true;
      setWon(true);
      const earned: 1 | 2 | 3 =
        slips.current === 0 ? 3 : slips.current <= 2 ? 2 : 1;
      const list = PATIENTS.map(
        (p) => `${readings[p.id]?.bpm ?? "?"} BPM`,
      ).join(", ");
      onComplete({
        passed: true,
        stars: earned,
        detail: `Health check complete — ${list}, all sorted correctly${
          slips.current === 0 ? " on the first try" : ""
        }.`,
      });
    }
  }, [allSolved, readings, onComplete]);

  // Gentle nudge after a wrong drop (never scold), let them re-drop freely.
  const lastNudge = useRef<string>("");
  const nudge = useCallback(
    (msg: string) => {
      if (won || reportedRef.current) return;
      if (lastNudge.current === msg) return;
      lastNudge.current = msg;
      onComplete({ passed: false, detail: msg });
    },
    [won, onComplete],
  );

  const onDrop = useCallback(
    (zone: Zone) => {
      if (current.bpm == null) return;
      placeReading(zone);
      const correct = zoneOf(current.bpm) === zone;
      if (!correct) {
        slips.current += 1;
        nudge(
          `${current.bpm} BPM belongs in a different band — compare it to the numbers on each zone.`,
        );
      }
    },
    [placeReading, current.bpm, nudge],
  );

  const goNext = useCallback(() => {
    const next = PATIENTS.findIndex((p, i) => i > active && !solved(p));
    const fallback = PATIENTS.findIndex((p) => !solved(p));
    setActive(next >= 0 ? next : fallback >= 0 ? fallback : active);
  }, [active, solved]);

  const reset = useCallback(() => {
    if (missTimer.current) clearTimeout(missTimer.current);
    if (pickTimer.current) clearTimeout(pickTimer.current);
    reportedRef.current = false;
    lastNudge.current = "";
    slips.current = 0;
    setReadings({});
    setActive(0);
    setMeasuring(false);
    setMissTap(false);
    setDragZone(null);
    setWrongPick(null);
    setWon(false);
  }, []);

  const rightMultiplier = multiplierFor(patient.windowSec);

  /* ---------------- status line ---------------- */
  const status = useMemo(() => {
    if (won) return "Health check complete — every reading sorted! ✨";
    if (stage === "predict")
      return `Read the patient's story. PREDICT: will the heart be Low, Normal, or High?`;
    if (stage === "measure") {
      if (!measuring)
        return `Good guess locked in. Press Measure, then tap every heartbeat spike.`;
      if (within) return `Counted ${tappedCount} beats ✓ — press Lock Count.`;
      return `Tapped ${tappedCount} of the tall spikes… keep counting.`;
    }
    if (stage === "convert")
      return `${current.beats} beats in ${patient.windowSec} seconds. Which × card turns that into beats per MINUTE?`;
    // sort stage
    if (current.placed && zoneOf(current.bpm ?? -1) === current.placed)
      return `${current.bpm} BPM sorted into ${ZONE_META[current.placed].label} ✓`;
    return `${current.bpm} BPM — drag the reading onto the matching band.`;
  }, [won, stage, measuring, within, tappedCount, current, patient.windowSec]);

  const solvedCount = PATIENTS.filter((p) => solved(p)).length;
  const predictedRight =
    current.predicted != null && current.predicted === patient.zone;

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3 text-ink">
      <style>{`
        @keyframes g5heartbeatmonitor-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-${WAVE_W}px); }
        }
        @keyframes g5heartbeatmonitor-beat {
          0%,100% { transform: scale(1); }
          30% { transform: scale(1.28); }
        }
        @keyframes g5heartbeatmonitor-pop {
          0% { transform: scale(.4); opacity: 0; }
          60% { transform: scale(1.18); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g5heartbeatmonitor-ping {
          0% { r: 3; opacity: .9; }
          100% { r: 13; opacity: 0; }
        }
        @keyframes g5heartbeatmonitor-flashband {
          0% { box-shadow: 0 0 0 0 ${OK}00; }
          40% { box-shadow: 0 0 0 2px ${OK}, 0 0 18px -2px ${OK}; }
          100% { box-shadow: 0 0 0 0 ${OK}00; }
        }
        @keyframes g5heartbeatmonitor-shake {
          0%,100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .g5hb-anim { animation: none !important; }
        }
      `}</style>

      {/* ---------------- WEARABLE BAND ---------------- */}
      <div
        className="panel relative overflow-hidden rounded-2xl"
        style={{
          boxShadow: won
            ? `0 0 0 1px ${ACCENT}, 0 0 24px -4px ${ACCENT}`
            : undefined,
          transition: "box-shadow .25s ease",
        }}
      >
        {/* patient header */}
        <div className="flex items-center justify-between px-3 pt-2.5 font-mono text-[11px]">
          <span className="flex items-center gap-1.5 text-ink-dim">
            <span aria-hidden className="text-base">
              {patient.emoji}
            </span>
            {patient.name}
          </span>
          <span className="text-ink-faint">
            patient {active + 1}/{PATIENTS.length} · strip = {patient.windowSec}s
          </span>
        </div>

        {/* OLED-style mini screen with the scrolling pulse wave */}
        <div className="px-3 pb-2 pt-1.5">
          <svg
            viewBox={`0 0 ${WAVE_W} ${WAVE_H}`}
            className="block h-auto w-full select-none rounded-xl"
            style={{
              background: "#06101a",
              touchAction: "none",
              cursor: measuring && stage === "measure" ? "crosshair" : "default",
            }}
            role={stage === "measure" ? "button" : "img"}
            aria-label={
              stage === "measure"
                ? `Pulse wave for ${patient.name}, a ${patient.windowSec} second strip. Tap each tall heartbeat spike. ${tappedCount} tapped so far.`
                : `Pulse wave for ${patient.name}, a ${patient.windowSec} second strip`
            }
            onPointerDown={onWavePointer}
          >
            {/* faint screen grid */}
            {Array.from({ length: 11 }, (_, i) => (
              <line
                key={`gx${i}`}
                x1={(i * WAVE_W) / 10}
                y1={0}
                x2={(i * WAVE_W) / 10}
                y2={WAVE_H}
                stroke="#0f2233"
                strokeWidth={0.6}
              />
            ))}
            {Array.from({ length: 4 }, (_, i) => (
              <line
                key={`gy${i}`}
                x1={0}
                y1={(i * WAVE_H) / 3}
                x2={WAVE_W}
                y2={(i * WAVE_H) / 3}
                stroke="#0f2233"
                strokeWidth={0.6}
              />
            ))}

            {/* the wave — scrolls when measuring; two copies for a seamless loop */}
            <g
              className="g5hb-anim"
              style={{
                animation: measuring
                  ? "g5heartbeatmonitor-scroll 6s linear infinite"
                  : undefined,
              }}
            >
              {[0, 1].map((k) => (
                <path
                  key={k}
                  d={wave.d}
                  transform={`translate(${k * WAVE_W} 0)`}
                  fill="none"
                  stroke={OK}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={0.92}
                />
              ))}
            </g>

            {/* tap markers sit on the static (content) layer so they stay put */}
            {peaks.map((p, i) => (
              <g key={i}>
                {p.tapped && (
                  <>
                    <circle
                      cx={p.x}
                      cy={MID - 34}
                      r={5.5}
                      fill={OK}
                      className="g5hb-anim"
                      style={{
                        transformOrigin: `${p.x}px ${MID - 34}px`,
                        animation: "g5heartbeatmonitor-pop .3s ease both",
                      }}
                    />
                    <circle
                      cx={p.x}
                      cy={MID - 34}
                      fill="none"
                      stroke={OK}
                      strokeWidth={1.5}
                      className="g5hb-anim"
                      style={{
                        animation: "g5heartbeatmonitor-ping .6s ease-out",
                      }}
                    />
                  </>
                )}
              </g>
            ))}

            {/* live tap counter chip */}
            {stage === "measure" && (
              <g>
                <rect
                  x={WAVE_W - 70}
                  y={6}
                  width={62}
                  height={18}
                  rx={5}
                  fill="#06101a"
                  stroke={within ? OK : "#1b2433"}
                  strokeWidth={1}
                />
                <text
                  x={WAVE_W - 39}
                  y={19}
                  textAnchor="middle"
                  fontSize={10}
                  className="font-mono"
                  fill={within ? OK : "#9aa6b2"}
                >
                  {within ? "✓ " : ""}beats {tappedCount}
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* OLED BPM read-out */}
        <div className="flex items-center justify-center gap-2 pb-3">
          <span
            aria-hidden
            className="g5hb-anim text-2xl"
            style={{
              animation:
                measuring || won
                  ? "g5heartbeatmonitor-beat 0.8s ease-in-out infinite"
                  : undefined,
            }}
          >
            ❤️
          </span>
          <span
            className="font-mono text-3xl font-bold tabular-nums"
            style={{
              color:
                current.bpm != null
                  ? ZONE_META[zoneOf(current.bpm)].color
                  : "#334155",
            }}
          >
            {current.bpm != null ? current.bpm : "— —"}
          </span>
          <span className="self-end pb-1 font-mono text-[11px] text-ink-faint">
            BPM
          </span>
        </div>
      </div>

      {/* ============ 1 · PREDICT (story → zone guess) ============ */}
      {stage === "predict" && (
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[11px] uppercase tracking-tech text-ink-faint">
            1 · Predict from the story
          </p>
          <div
            className="rounded-lg border px-3 py-2 text-center text-sm"
            style={{ borderColor: "#1b2433", background: "rgba(11,18,32,.5)" }}
          >
            <span aria-hidden className="mr-1">
              {patient.emoji}
            </span>
            Maya is <span className="font-bold">{patient.note}</span>. Before you
            measure — what do you expect her heart rate to be?
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["low", "normal", "high"] as Zone[]).map((z) => {
              const meta = ZONE_META[z];
              return (
                <button
                  key={z}
                  type="button"
                  onClick={() => predict(z)}
                  aria-label={`Predict ${meta.label}, ${meta.range} beats per minute`}
                  className="flex flex-col items-center gap-0.5 rounded-xl border-2 px-1 py-2.5 text-center transition active:scale-95"
                  style={{
                    borderColor: "#1b2433",
                    background: "rgba(11,18,32,.6)",
                  }}
                >
                  <span
                    className="font-mono text-xs font-bold"
                    style={{ color: meta.color }}
                  >
                    {meta.label}
                  </span>
                  <span className="font-mono text-[10px] text-ink-faint">
                    {meta.range}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ============ 3 · CONVERT (pick the multiplier) ============ */}
      {stage === "convert" && current.beats != null && (
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[11px] uppercase tracking-tech text-ink-faint">
            3 · Beats → beats per MINUTE
          </p>
          <div
            className="rounded-lg border px-3 py-2 text-center text-sm"
            style={{ borderColor: "#1b2433", background: "rgba(11,18,32,.5)" }}
          >
            You counted{" "}
            <span className="font-mono font-bold" style={{ color: OK }}>
              {current.beats} beats
            </span>{" "}
            in a{" "}
            <span className="font-mono font-bold" style={{ color: ACCENT }}>
              {patient.windowSec}-second
            </span>{" "}
            strip. A minute is 60 seconds — pick the × card that scales it up.
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MULTIPLIER_CHOICES.map((m) => {
              const bad = wrongPick === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => pickMultiplier(m)}
                  aria-label={`Multiply by ${m}. ${current.beats} beats times ${m} equals ${
                    (current.beats ?? 0) * m
                  } beats per minute.`}
                  className="g5hb-anim flex flex-col items-center gap-0.5 rounded-xl border-2 px-1 py-3 text-center transition active:scale-95"
                  style={{
                    borderColor: bad ? WARN : "#1b2433",
                    background: bad ? `${WARN}1a` : "rgba(11,18,32,.6)",
                    animation: bad
                      ? "g5heartbeatmonitor-shake .35s ease"
                      : undefined,
                  }}
                >
                  <span className="font-mono text-lg font-bold text-ink">
                    × {m}
                  </span>
                  <span className="font-mono text-[10px] text-ink-faint">
                    = {(current.beats ?? 0) * m} BPM
                  </span>
                </button>
              );
            })}
          </div>
          {wrongPick != null && (
            <p
              className="text-center font-mono text-[11px]"
              style={{ color: WARN }}
            >
              Not that one. {patient.windowSec}s fits into 60s exactly{" "}
              {60 / patient.windowSec} times — so multiply by {rightMultiplier}.
            </p>
          )}
        </div>
      )}

      {/* ============ 4 · ZONE BANDS (drag target) ============ */}
      {(stage === "sort" || stage === "done") && (
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-[11px] uppercase tracking-tech text-ink-faint">
            {stage === "sort" && current.placed == null
              ? "4 · Drag the reading onto its health band"
              : "Health zones · low < 60 · normal 60–100 · high > 100"}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(["low", "normal", "high"] as Zone[]).map((z) => {
              const meta = ZONE_META[z];
              const isTarget = dragZone === z;
              const placedHere = current.placed === z;
              const correctHere =
                placedHere && zoneOf(current.bpm ?? -1) === z;
              return (
                <div
                  key={z}
                  data-zone={z}
                  role="button"
                  aria-label={`${meta.label} zone, ${meta.range} beats per minute. Drop the reading here.`}
                  onPointerEnter={() =>
                    stage === "sort" && current.placed == null && setDragZone(z)
                  }
                  onPointerUp={() =>
                    stage === "sort" && current.placed == null && onDrop(z)
                  }
                  className="g5hb-anim flex flex-col items-center gap-0.5 rounded-xl border-2 px-1 py-2.5 text-center transition"
                  style={{
                    borderColor: isTarget || placedHere ? meta.color : "#1b2433",
                    background:
                      isTarget || placedHere
                        ? `${meta.color}22`
                        : "rgba(11,18,32,.6)",
                    animation: correctHere
                      ? "g5heartbeatmonitor-flashband .8s ease both"
                      : undefined,
                  }}
                >
                  <span
                    className="font-mono text-xs font-bold"
                    style={{ color: meta.color }}
                  >
                    {meta.label}
                  </span>
                  <span className="font-mono text-[10px] text-ink-faint">
                    {meta.range}
                  </span>
                  {correctHere && (
                    <span className="text-sm" aria-hidden>
                      {current.bpm} ❤️
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------- DRAGGABLE READING CHIP ---------------- */}
      {stage === "sort" && current.bpm != null && current.placed == null && (
        <div className="flex items-center justify-center">
          <DraggableChip
            bpm={current.bpm}
            color={ZONE_META[zoneOf(current.bpm)].color}
            onHover={(z) => setDragZone(z)}
            onDrop={onDrop}
          />
        </div>
      )}

      {/* ---------------- PROGRESS DOTS ---------------- */}
      <div
        className="flex items-center justify-center gap-2"
        role="list"
        aria-label="Patient progress"
      >
        {PATIENTS.map((p, i) => {
          const done = solved(p);
          const isActive = i === active && !won;
          return (
            <button
              key={p.id}
              type="button"
              role="listitem"
              onClick={() => !won && setActive(i)}
              aria-label={`${p.name}: ${
                done ? `done, ${readings[p.id]?.bpm} BPM` : "not measured"
              }`}
              className="flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10px] transition"
              style={{
                borderColor: done ? OK : isActive ? ACCENT : "#1b2433",
                background: done
                  ? `${OK}1f`
                  : isActive
                    ? `${ACCENT}1a`
                    : "transparent",
                color: done ? OK : isActive ? ACCENT : "#64748b",
              }}
            >
              <span aria-hidden>{done ? "✓" : p.emoji}</span>
              {done ? `${readings[p.id]?.bpm}` : "?"}
            </button>
          );
        })}
      </div>

      {/* ---------------- STATUS ---------------- */}
      <div
        role="status"
        aria-live="polite"
        className="rounded-lg px-3 py-2 text-center font-mono text-xs"
        style={{
          background: won ? "rgba(168,85,247,.12)" : "rgba(56,189,248,.06)",
          color: won ? ACCENT : "var(--color-ink-dim, #9aa6b2)",
          border: `1px solid ${won ? ACCENT : "#1b2433"}`,
        }}
      >
        {won ? <span className="font-bold">🎉 {status}</span> : status}
        {/* prediction feedback once measured, encouraging either way */}
        {!won && stage !== "predict" && current.predicted != null && (
          <span
            className="mt-1 block text-[11px]"
            style={{ color: predictedRight ? OK : WARN }}
          >
            {predictedRight
              ? `Your prediction (${ZONE_META[current.predicted].label}) — let's see if the data agrees ✓`
              : `You predicted ${ZONE_META[current.predicted].label}. Measure and check — data can surprise you!`}
          </span>
        )}
        {missTap && stage === "measure" && (
          <span className="mt-1 block text-[11px]" style={{ color: HIGH }}>
            That&apos;s a valley — tap the tall spikes ⬆ to count a beat.
          </span>
        )}
      </div>

      {/* ---------------- WIN CARD ---------------- */}
      {won && (
        <div
          className="rounded-xl border p-3 text-center"
          style={{ borderColor: `${ACCENT}66`, background: `${ACCENT}10` }}
        >
          <p className="font-mono text-xs font-bold" style={{ color: ACCENT }}>
            {slips.current === 0
              ? "⭐⭐⭐ Perfect — sharp predictions and the right rate every time!"
              : slips.current <= 2
                ? "⭐⭐ Health check complete — solid reasoning!"
                : "⭐ Health check complete — you got there!"}
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {PATIENTS.map((p) => {
              const r = readings[p.id];
              const z = r && r.bpm != null ? zoneOf(r.bpm) : "normal";
              return (
                <div key={p.id} className="rounded-lg bg-panel/60 px-1 py-1.5">
                  <div className="text-base" aria-hidden>
                    {p.emoji}
                  </div>
                  <div
                    className="font-mono text-sm font-bold tabular-nums"
                    style={{ color: ZONE_META[z].color }}
                  >
                    {r?.bpm}
                  </div>
                  <div className="font-mono text-[9px] text-ink-faint">
                    {ZONE_META[z].label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------- CONTROLS ---------------- */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-ink-faint">
          Solved: {solvedCount}/{PATIENTS.length}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
            aria-label="Reset all patients and start over"
          >
            Reset
          </button>
          {stage === "measure" && !measuring && (
            <button
              type="button"
              onClick={startMeasure}
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: ACCENT, color: "#05070d" }}
              aria-label="Start measuring this patient's pulse"
            >
              Measure ❤️
            </button>
          )}
          {stage === "measure" && measuring && (
            <button
              type="button"
              onClick={lockBeats}
              disabled={tappedCount === 0}
              className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              style={{ background: within ? OK : ACCENT, color: "#05070d" }}
              aria-label="Lock in the number of beats you counted"
            >
              Lock Count →
            </button>
          )}
          {stage === "sort" && solved(patient) && !won && (
            <button
              type="button"
              onClick={goNext}
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: ACCENT, color: "#05070d" }}
              aria-label="Go to the next patient"
            >
              Next patient →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Draggable BPM chip — a pointer-following puck the learner drags    */
/*  onto a zone band. Plain pointer events, touch-first, no libs.      */
/* ================================================================== */

interface ChipProps {
  bpm: number;
  color: string;
  onHover: (z: Zone | null) => void;
  onDrop: (z: Zone) => void;
}

function DraggableChip({ bpm, color, onHover, onDrop }: ChipProps) {
  const [drag, setDrag] = useState<boolean>(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const overRef = useRef<Zone | null>(null);

  const zoneUnder = useCallback(
    (clientX: number, clientY: number): Zone | null => {
      const el = document.elementFromPoint(clientX, clientY);
      const band = el?.closest<HTMLElement>("[data-zone]");
      const z = band?.dataset.zone;
      return z === "low" || z === "normal" || z === "high" ? z : null;
    },
    [],
  );

  const onDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag(true);
    setPos({ x: 0, y: 0 });
  }, []);

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!drag) return;
      e.preventDefault();
      setPos((p) => ({ x: p.x + e.movementX, y: p.y + e.movementY }));
      const z = zoneUnder(e.clientX, e.clientY);
      overRef.current = z;
      onHover(z);
    },
    [drag, zoneUnder, onHover],
  );

  const onUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!drag) return;
      e.preventDefault();
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* capture already released — safe to ignore */
      }
      setDrag(false);
      setPos({ x: 0, y: 0 });
      const z = zoneUnder(e.clientX, e.clientY) ?? overRef.current;
      onHover(null);
      if (z) onDrop(z);
    },
    [drag, zoneUnder, onHover, onDrop],
  );

  return (
    <button
      type="button"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      aria-label={`Reading ${bpm} BPM. Drag onto the matching health band.`}
      className="flex select-none items-center gap-1.5 rounded-full border-2 px-4 py-2 font-mono text-sm font-bold shadow-lg"
      style={{
        borderColor: color,
        background: `${color}22`,
        color,
        touchAction: "none",
        cursor: drag ? "grabbing" : "grab",
        transform: `translate(${pos.x}px, ${pos.y}px) scale(${drag ? 1.08 : 1})`,
        transition: drag ? "none" : "transform .15s ease",
        zIndex: drag ? 50 : undefined,
        position: "relative",
      }}
    >
      <span aria-hidden>❤️</span>
      {bpm} BPM
      <span aria-hidden className="text-ink-faint">
        ⤧
      </span>
    </button>
  );
}
