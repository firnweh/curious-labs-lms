"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Weather Station — one sensor, many kinds of live data             */
/*  Learning goal: a single DHT11 sensor reports BOTH temperature and */
/*  humidity, and reading that live data lets you describe the        */
/*  weather. The learner nudges the environment with three actions    */
/*  and watches the readings change to complete a 3-task mission.     */
/* ------------------------------------------------------------------ */

const ACCENT = "#a855f7";

/** Room baseline the readings drift back toward on WAIT. */
const BASE_TEMP = 26;
const BASE_HUM = 50;

/** Comfort band thresholds used by the LCD colour coding + mission. */
const COMFORT_TEMP_LO = 24;
const COMFORT_TEMP_HI = 28;
const COMFORT_HUM_LO = 40;
const COMFORT_HUM_HI = 60;

type ActionId = "breathe" | "fan" | "wait";

interface Reading {
  /** Tick index, shown as a tiny clock-ish label. */
  t: number;
  temp: number;
  hum: number;
}

interface ActionDef {
  id: ActionId;
  label: string;
  glyph: string;
  /** What this action does to the environment, applied deterministically. */
  apply: (r: Reading) => { temp: number; hum: number };
}

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

/** Drift a value one step toward the baseline (used by WAIT). */
function drift(value: number, base: number, step: number): number {
  if (value > base) return Math.max(base, value - step);
  if (value < base) return Math.min(base, value + step);
  return value;
}

const ACTIONS: readonly ActionDef[] = [
  {
    id: "breathe",
    label: "Breathe on sensor",
    glyph: "😮‍💨",
    // Moist breath: humidity jumps a lot, temp ticks up a touch.
    apply: (r) => ({
      temp: clamp(r.temp + 1, 10, 45),
      hum: clamp(r.hum + 16, 0, 100),
    }),
  },
  {
    id: "fan",
    label: "Blow a fan",
    glyph: "💨",
    // Moving air cools: temp drops a couple of degrees, humidity eases.
    apply: (r) => ({
      temp: clamp(r.temp - 2, 10, 45),
      hum: clamp(r.hum - 4, 0, 100),
    }),
  },
  {
    id: "wait",
    label: "Wait",
    glyph: "⏳",
    // Readings relax back toward the room baseline.
    apply: (r) => ({
      temp: drift(r.temp, BASE_TEMP, 2),
      hum: drift(r.hum, BASE_HUM, 8),
    }),
  },
] as const;

interface Task {
  id: 1 | 2 | 3;
  label: string;
  /** Does this reading satisfy the task? */
  test: (r: Reading) => boolean;
}

const tempComfy = (r: Reading): boolean =>
  r.temp >= COMFORT_TEMP_LO && r.temp <= COMFORT_TEMP_HI;
const humComfy = (r: Reading): boolean =>
  r.hum >= COMFORT_HUM_LO && r.hum <= COMFORT_HUM_HI;

const TASKS: readonly Task[] = [
  { id: 1, label: "Make humidity rise above 80%", test: (r) => r.hum > 80 },
  { id: 2, label: "Make temperature fall below 24 °C", test: (r) => r.temp < 24 },
  {
    id: 3,
    label: "Bring both back to the Comfortable band",
    test: (r) => tempComfy(r) && humComfy(r),
  },
] as const;

const START: Reading = { t: 0, temp: BASE_TEMP, hum: BASE_HUM };

/** Weather scene chosen from the live readings — the "describe it" payoff. */
function describeScene(r: Reading): { emoji: string; word: string } {
  if (r.hum > 80) return { emoji: "🌧️", word: "Rainy" };
  if (r.hum >= 65) return { emoji: "☁️", word: "Cloudy" };
  if (r.temp < 24) return { emoji: "🌬️", word: "Breezy" };
  return { emoji: "☀️", word: "Clear" };
}

export default function WeatherStation({ onComplete }: ActivityProps) {
  const [log, setLog] = useState<Reading[]>([START]);
  const [done, setDone] = useState<Record<1 | 2 | 3, boolean>>({
    1: false,
    2: false,
    3: false,
  });
  /** Tick index of the log row that first satisfied each task (for highlight). */
  const [rowFor, setRowFor] = useState<Record<1 | 2 | 3, number | null>>({
    1: null,
    2: null,
    3: null,
  });
  const [won, setWon] = useState<boolean>(false);
  const firedRef = useRef<boolean>(false);

  // Mirror rowFor into a ref so the setLog/setDone updaters can read the latest
  // map without making runAction depend on rowFor (avoids stale closures).
  const rowForRef = useRef(rowFor);
  rowForRef.current = rowFor;

  const current: Reading = log[log.length - 1];
  const scene = describeScene(current);

  const allDone = done[1] && done[2] && done[3];

  const finish = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    setWon(true);
    onComplete({
      passed: true,
      stars: 3,
      detail: "You logged 6 readings and found the comfort zone.",
    });
  }, [onComplete]);

  const runAction = useCallback(
    (def: ActionDef) => {
      if (won) return;
      setLog((prev) => {
        const last = prev[prev.length - 1];
        const next = def.apply(last);
        const reading: Reading = {
          t: last.t + 1,
          temp: next.temp,
          hum: next.hum,
        };
        const log2 = [...prev, reading];

        // Tick any newly-satisfied mission tasks against the new reading.
        setDone((d) => {
          const nd = { ...d };
          const nr: Record<1 | 2 | 3, number | null> = { ...rowForRef.current };
          let changed = false;
          for (const task of TASKS) {
            if (!nd[task.id] && task.test(reading)) {
              nd[task.id] = true;
              nr[task.id] = reading.t;
              changed = true;
            }
          }
          if (changed) {
            rowForRef.current = nr;
            setRowFor(nr);
          }
          if (nd[1] && nd[2] && nd[3]) finish();
          return nd;
        });

        return log2;
      });
    },
    [won, finish],
  );

  const reset = useCallback(() => {
    firedRef.current = false;
    setLog([START]);
    setDone({ 1: false, 2: false, 3: false });
    setRowFor({ 1: null, 2: null, 3: null });
    rowForRef.current = { 1: null, 2: null, 3: null };
    setWon(false);
  }, []);

  const statusChip = useMemo<{ text: string; color: string }>(() => {
    if (current.hum > COMFORT_HUM_HI) return { text: "Too humid", color: "#22d3ee" };
    if (current.temp < COMFORT_TEMP_LO) return { text: "Too cool", color: "#60a5fa" };
    if (tempComfy(current) && humComfy(current))
      return { text: "Comfortable", color: ACCENT };
    if (current.temp > COMFORT_TEMP_HI) return { text: "Too warm", color: "#f87171" };
    return { text: "Reading…", color: "#9aa6b2" };
  }, [current]);

  const tempColor = tempComfy(current) ? ACCENT : "#f87171";
  const humColor = humComfy(current) ? ACCENT : "#22d3ee";

  // Sparkline of temperature over the last readings.
  const spark = useMemo(() => {
    const W = 200;
    const H = 44;
    const pad = 4;
    const pts = log.slice(-8);
    const lo = 18;
    const hi = 32;
    const n = pts.length;
    const d = pts
      .map((r, i) => {
        const x = n <= 1 ? pad : pad + (i / (n - 1)) * (W - pad * 2);
        const ty = clamp((r.temp - lo) / (hi - lo), 0, 1);
        const y = H - pad - ty * (H - pad * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
    const lastPt = pts[pts.length - 1];
    const lx = n <= 1 ? pad : W - pad;
    const lty = clamp((lastPt.temp - lo) / (hi - lo), 0, 1);
    const ly = H - pad - lty * (H - pad * 2);
    return { W, H, d, lx, ly };
  }, [log]);

  const nextTask = TASKS.find((t) => !done[t.id]) ?? null;

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink">
      <style>{`
        @keyframes g4weatherstation-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g4weatherstation-rain {
          0% { transform: translateY(-2px); opacity: 0; }
          40% { opacity: 1; }
          100% { transform: translateY(10px); opacity: 0; }
        }
        @keyframes g4weatherstation-pulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        @keyframes g4weatherstation-win {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* ---------------- SCENE + LCD ---------------- */}
      <div
        className="panel relative overflow-hidden rounded-xl p-3"
        style={
          won
            ? { boxShadow: `0 0 0 1px ${ACCENT}, 0 0 24px -4px ${ACCENT}` }
            : undefined
        }
      >
        {/* sky scene */}
        <div
          className="relative mb-3 flex h-24 items-center justify-center rounded-lg"
          style={{
            background:
              scene.word === "Rainy"
                ? "linear-gradient(180deg,#1e293b,#334155)"
                : scene.word === "Cloudy"
                  ? "linear-gradient(180deg,#1f2937,#475569)"
                  : scene.word === "Breezy"
                    ? "linear-gradient(180deg,#0c4a6e,#0e7490)"
                    : "linear-gradient(180deg,#1e3a8a,#3b82f6)",
          }}
          role="img"
          aria-label={`Weather scene: ${scene.word}`}
        >
          <span
            key={scene.word}
            className="text-5xl"
            style={{ animation: "g4weatherstation-pop .35s ease both" }}
          >
            {scene.emoji}
          </span>
          {scene.word === "Rainy" &&
            [0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                aria-hidden
                className="absolute text-xs"
                style={{
                  left: `${18 + i * 16}%`,
                  top: "58%",
                  animation: `g4weatherstation-rain 1s linear ${i * 0.18}s infinite`,
                }}
              >
                💧
              </span>
            ))}
          <span
            className="absolute right-2 top-2 rounded px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: "rgba(0,0,0,.35)", color: statusChip.color }}
            role="status"
            aria-live="polite"
          >
            {statusChip.text}
          </span>
        </div>

        {/* mini LCD: two lines of live data from one sensor */}
        <div
          className="rounded-lg border-2 px-3 py-2"
          style={{
            background: "#06140f",
            borderColor: "#0f3d2e",
            boxShadow: "inset 0 0 18px rgba(16,185,129,.15)",
          }}
        >
          <div className="flex items-center justify-between text-sm tabular-nums">
            <span className="text-ink-faint">Temp</span>
            <span style={{ color: tempColor, textShadow: `0 0 8px ${tempColor}` }}>
              {current.temp.toFixed(0)} °C
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm tabular-nums">
            <span className="text-ink-faint">Humidity</span>
            <span style={{ color: humColor, textShadow: `0 0 8px ${humColor}` }}>
              {current.hum.toFixed(0)} %
            </span>
          </div>
          <div className="mt-1 text-center text-[10px] uppercase tracking-tech text-ink-faint">
            DHT11 · one sensor, two readings
          </div>
        </div>

        {/* temperature sparkline */}
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-tech text-ink-faint">
            <span>Temp trend</span>
            <span>last {Math.min(log.length, 8)} reads</span>
          </div>
          <svg
            viewBox={`0 0 ${spark.W} ${spark.H}`}
            className="block h-auto w-full"
            role="img"
            aria-label="Sparkline of temperature over recent readings"
          >
            <path
              d={spark.d}
              fill="none"
              stroke={ACCENT}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx={spark.lx} cy={spark.ly} r={2.4} fill={ACCENT} />
          </svg>
        </div>
      </div>

      {/* ---------------- ACTIONS ---------------- */}
      <div className="flex gap-2" role="group" aria-label="Environment actions">
        {ACTIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            onPointerDown={() => runAction(a)}
            disabled={won}
            aria-label={a.label}
            title={a.label}
            className="flex flex-1 flex-col items-center gap-1 rounded-lg border border-line bg-panel/60 px-2 py-2 text-[11px] font-medium text-ink-dim transition disabled:opacity-50"
            style={{ touchAction: "manipulation" }}
          >
            <span aria-hidden className="text-xl">
              {a.glyph}
            </span>
            <span className="leading-tight">{a.label}</span>
          </button>
        ))}
      </div>

      {/* ---------------- MISSION ---------------- */}
      <div className="panel flex flex-col gap-1.5 rounded-xl p-3">
        <p className="mb-0.5 text-[11px] uppercase tracking-tech text-ink-faint">
          Mission — tick all three
        </p>
        {TASKS.map((task) => {
          const ok = done[task.id];
          return (
            <div
              key={task.id}
              className="flex items-center gap-2 text-xs"
              style={ok ? { color: ACCENT } : { color: "var(--color-ink-dim,#9aa6b2)" }}
            >
              <span
                aria-hidden
                className="flex h-4 w-4 items-center justify-center rounded-full border text-[10px]"
                style={{
                  borderColor: ok ? ACCENT : "#3a4452",
                  background: ok ? ACCENT : "transparent",
                  color: ok ? "#05070d" : "transparent",
                }}
              >
                ✓
              </span>
              <span className={ok ? "line-through" : ""}>{task.label}</span>
            </div>
          );
        })}
      </div>

      {/* ---------------- DATA LOG ---------------- */}
      <div className="panel rounded-xl p-2">
        <p className="mb-1 px-1 text-[11px] uppercase tracking-tech text-ink-faint">
          Data log
        </p>
        <div className="max-h-36 overflow-y-auto">
          <table className="w-full text-left text-[11px] tabular-nums">
            <thead>
              <tr className="text-ink-faint">
                <th className="px-1 py-0.5 font-normal">#</th>
                <th className="px-1 py-0.5 font-normal">Temp</th>
                <th className="px-1 py-0.5 font-normal">Humidity</th>
              </tr>
            </thead>
            <tbody>
              {log.map((r, i) => {
                const taskHere = TASKS.find((t) => rowFor[t.id] === r.t);
                const hot = taskHere !== undefined;
                return (
                  <tr
                    key={i}
                    className="border-t border-line/60"
                    style={
                      hot
                        ? { background: "rgba(168,85,247,.16)", color: ACCENT }
                        : { color: "var(--color-ink-dim,#9aa6b2)" }
                    }
                  >
                    <td className="px-1 py-0.5">{r.t}</td>
                    <td className="px-1 py-0.5">{r.temp.toFixed(0)} °C</td>
                    <td className="px-1 py-0.5">
                      {r.hum.toFixed(0)} %
                      {hot && taskHere && (
                        <span className="ml-1 text-[9px]">✓ task {taskHere.id}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------- HINT / WIN / CONTROLS ---------------- */}
      {won ? (
        <div
          className="panel rounded-xl p-3 text-center"
          style={{
            border: `1px solid ${ACCENT}`,
            animation: "g4weatherstation-win .4s ease both",
          }}
        >
          <div className="text-2xl">✨🎉 ⭐⭐⭐</div>
          <p className="mt-1 text-sm font-semibold" style={{ color: ACCENT }}>
            Comfort zone found!
          </p>
          <p className="mt-0.5 text-[11px] text-ink-dim">
            You logged {log.length} readings and found the comfort zone — one
            sensor told you the whole weather story.
          </p>
        </div>
      ) : (
        nextTask && (
          <p className="px-1 text-[11px] leading-snug text-ink-faint">
            <span style={{ color: ACCENT }}>Next:</span> {nextTask.label}.{" "}
            {nextTask.id === 1
              ? "Humidity rises when you add moisture — what could you breathe on it?"
              : nextTask.id === 2
                ? "Moving air cools things down. Which button makes a draft?"
                : "Waiting lets the readings drift back to the room baseline."}
          </p>
        )
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink-faint">
          Readings logged: {log.length}
        </span>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
          aria-label="Reset the weather station"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
