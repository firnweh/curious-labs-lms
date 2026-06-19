"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Smart Classroom Dashboard — IoT automation rules                   */
/*  Learning goal: an IoT system reads live sensors and uses           */
/*  threshold rules (IF sensor <compare> value -> action) to drive     */
/*  devices automatically. The learner picks a comparison + threshold  */
/*  for four rules so every device holds the correct state across a    */
/*  fixed 60-tick scenario (empty room, hot stretch, stuffy air).      */
/* ------------------------------------------------------------------ */

const ACCENT = "#22d3ee";
const GREEN = "#34d399";
const RED = "#f87171";
const AMBER = "#f59e0b";

const TICKS = 60;
/** Per-device pass bar: correct for at least this share of ticks. */
const PASS_RATIO = 0.9;

type SensorId = "motion" | "lux" | "temp" | "air";
type DeviceId = "lamp" | "fan" | "window";
type Compare = ">" | "<";

interface SensorDef {
  id: SensorId;
  label: string;
  unit: string;
  emoji: string;
  /** Display range for the gauge / chart. */
  min: number;
  max: number;
  /** 60-tick scripted feed — identical every replay. */
  feed: readonly number[];
}

interface RuleDef {
  device: DeviceId;
  deviceLabel: string;
  deviceEmoji: string;
  sensor: SensorId;
  /** Action verb when the rule FIRES (sensor compare threshold is true). */
  onLabel: string;
  offLabel: string;
  /** Allowed thresholds the learner can dial in. */
  choices: readonly number[];
  /** The intended comparison + threshold band (for nudges only, never shown). */
}

/* ---- build the scripted feeds (deterministic, hand-shaped) ---- */

/** motion: 1 = someone moving (PIR HIGH), 0 = still room. */
const MOTION: number[] = [];
for (let t = 0; t < TICKS; t++) {
  // Empty-room stretch ticks 20–39: nobody there. Busy otherwise.
  MOTION.push(t >= 20 && t < 40 ? 0 : 1);
}

/** lux: ambient light. Bright daylight by the window most of the time;
 *  dips while the room is empty (blinds drawn) — but lamp is driven by motion. */
const LUX: number[] = [];
for (let t = 0; t < TICKS; t++) {
  LUX.push(t >= 20 && t < 40 ? 180 : 520);
}

/** temp °C: a hot stretch in the middle-late session (sun + crowd). */
const TEMP: number[] = [];
for (let t = 0; t < TICKS; t++) {
  // baseline ~24, spikes to ~33 across ticks 40–54.
  TEMP.push(t >= 40 && t < 55 ? 33 : 24);
}

/** air quality index (MQ135): higher = stuffier. Stuffy stretch early-mid. */
const AIR: number[] = [];
for (let t = 0; t < TICKS; t++) {
  // baseline ~420, stuffy spike to ~780 across ticks 8–22.
  AIR.push(t >= 8 && t < 23 ? 780 : 420);
}

const SENSORS: readonly SensorDef[] = [
  { id: "motion", label: "Motion (PIR)", unit: "", emoji: "🚶", min: 0, max: 1, feed: MOTION },
  { id: "lux", label: "Light (LDR)", unit: "lux", emoji: "💡", min: 0, max: 700, feed: LUX },
  { id: "temp", label: "Temp (DHT22)", unit: "°C", emoji: "🌡️", min: 16, max: 38, feed: TEMP },
  { id: "air", label: "Air (MQ135)", unit: "idx", emoji: "🟢", min: 300, max: 900, feed: AIR },
] as const;

const SENSOR_BY_ID: Record<SensorId, SensorDef> = SENSORS.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<SensorId, SensorDef>,
);

/**
 * Four rules — one per device. The learner chooses comparison + threshold.
 * Each device's CORRECT target state per tick is defined below by hand so a
 * winnable rule clearly exists inside the visible sensor band.
 */
const RULES: readonly RuleDef[] = [
  {
    device: "lamp",
    deviceLabel: "Ceiling lamp",
    deviceEmoji: "🔦",
    sensor: "motion",
    onLabel: "lights ON",
    offLabel: "lights OFF",
    // motion is 0/1: threshold 0 with ">" → ON only when motion=1 (someone in).
    choices: [0, 1],
  },
  {
    device: "fan",
    deviceLabel: "Fan",
    deviceEmoji: "🌀",
    sensor: "temp",
    onLabel: "fan ON",
    offLabel: "fan OFF",
    choices: [22, 26, 30, 34],
  },
  {
    device: "window",
    deviceLabel: "Window",
    deviceEmoji: "🪟",
    sensor: "air",
    onLabel: "window OPEN",
    offLabel: "window SHUT",
    choices: [500, 600, 700, 800],
  },
  {
    device: "lamp",
    deviceLabel: "Lamp dimmer",
    deviceEmoji: "🔅",
    sensor: "lux",
    onLabel: "dim lamp",
    offLabel: "full lamp",
    choices: [300, 400, 600, 700],
  },
];

/* ---- correct (target) device state per tick, derived from the script ---- */

/** Lamp: ON whenever someone is in the room (motion = 1). */
function lampTarget(t: number): boolean {
  return MOTION[t] === 1;
}
/** Fan: ON during the hot stretch (temp >= 30). */
function fanTarget(t: number): boolean {
  return TEMP[t] >= 30;
}
/** Window: OPEN during stuffy air (air index >= 700). */
function windowTarget(t: number): boolean {
  return AIR[t] >= 700;
}
/** Dimmer: dim when the room is bright (lux >= 500). */
function dimTarget(t: number): boolean {
  return LUX[t] >= 500;
}

/** A learner rule fires (action ON) when sensor[t] <compare> threshold. */
function ruleFires(sensor: SensorId, cmp: Compare, threshold: number, t: number): boolean {
  const v = SENSOR_BY_ID[sensor].feed[t];
  return cmp === ">" ? v > threshold : v < threshold;
}

interface RuleConfig {
  cmp: Compare;
  threshold: number;
}

type Configs = readonly [RuleConfig, RuleConfig, RuleConfig, RuleConfig];

const DEFAULT_CONFIGS: Configs = [
  { cmp: ">", threshold: 1 }, // lamp / motion — wrong-ish on purpose
  { cmp: "<", threshold: 22 }, // fan / temp
  { cmp: "<", threshold: 500 }, // window / air
  { cmp: "<", threshold: 300 }, // dimmer / lux
];

interface LogEntry {
  tick: number;
  text: string;
}

type Phase = "setup" | "running" | "won" | "checked";

export default function SmartClassroomIot({ onComplete }: ActivityProps) {
  const [configs, setConfigs] = useState<Configs>(DEFAULT_CONFIGS);
  const [tick, setTick] = useState<number>(0);
  const [phase, setPhase] = useState<Phase>("setup");
  // running correct-count per device across the scenario.
  const [correct, setCorrect] = useState<[number, number, number, number]>([0, 0, 0, 0]);
  const [log, setLog] = useState<LogEntry[]>([]);
  // live device on/off, indexed by rule.
  const [devOn, setDevOn] = useState<[boolean, boolean, boolean, boolean]>([
    false,
    false,
    false,
    false,
  ]);

  const completedRef = useRef<boolean>(false);
  const configsRef = useRef<Configs>(configs);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    configsRef.current = configs;
  }, [configs]);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => stopTimer, [stopTimer]);

  const targetAt = useCallback((ruleIdx: number, t: number): boolean => {
    if (ruleIdx === 0) return lampTarget(t);
    if (ruleIdx === 1) return fanTarget(t);
    if (ruleIdx === 2) return windowTarget(t);
    return dimTarget(t);
  }, []);

  const setCmp = useCallback((idx: number, cmp: Compare) => {
    setConfigs((prev) => {
      const next = [...prev] as unknown as RuleConfig[];
      next[idx] = { ...next[idx], cmp };
      return next as unknown as Configs;
    });
  }, []);

  const setThreshold = useCallback((idx: number, threshold: number) => {
    setConfigs((prev) => {
      const next = [...prev] as unknown as RuleConfig[];
      next[idx] = { ...next[idx], threshold };
      return next as unknown as Configs;
    });
  }, []);

  const finish = useCallback(
    (finalCorrect: [number, number, number, number]) => {
      stopTimer();
      const ratios = finalCorrect.map((c) => c / TICKS);
      const allPass = ratios.every((r) => r >= PASS_RATIO - 1e-9);
      if (allPass) {
        setPhase("won");
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete({
            passed: true,
            stars: 3,
            detail:
              "Dashboard healthy — every device held the right state ≥90% of the scenario from your rules!",
          });
        }
      } else {
        setPhase("checked");
        // Find the weakest device and nudge toward fixing its rule.
        let worst = 0;
        for (let i = 1; i < 4; i++) if (ratios[i] < ratios[worst]) worst = i;
        const r = RULES[worst];
        const s = SENSOR_BY_ID[r.sensor];
        const nudge = `${r.deviceLabel} was right only ${Math.round(
          ratios[worst] * 100,
        )}% of ticks. Re-watch the ${s.label} feed and find the band where it should ${r.onLabel}.`;
        onComplete({ passed: false, detail: nudge });
      }
    },
    [onComplete, stopTimer],
  );

  const run = useCallback(() => {
    stopTimer();
    setTick(0);
    setCorrect([0, 0, 0, 0]);
    setLog([]);
    setDevOn([false, false, false, false]);
    setPhase("running");

    let t = 0;
    const acc: [number, number, number, number] = [0, 0, 0, 0];

    timerRef.current = setInterval(() => {
      const cfg = configsRef.current;
      const states: [boolean, boolean, boolean, boolean] = [false, false, false, false];
      const newLogs: LogEntry[] = [];

      for (let i = 0; i < 4; i++) {
        const fired = ruleFires(RULES[i].sensor, cfg[i].cmp, cfg[i].threshold, t);
        states[i] = fired;
        const want = targetAt(i, t);
        if (fired === want) acc[i] += 1;
        // Log only state CHANGES vs previous tick to keep the log readable.
        if (t === 0 || ruleFires(RULES[i].sensor, cfg[i].cmp, cfg[i].threshold, t - 1) !== fired) {
          newLogs.push({
            tick: t,
            text: `t${t}: ${RULES[i].deviceEmoji} ${fired ? RULES[i].onLabel : RULES[i].offLabel}`,
          });
        }
      }

      setDevOn(states);
      setCorrect([acc[0], acc[1], acc[2], acc[3]]);
      if (newLogs.length > 0) {
        setLog((prev) => [...newLogs.reverse(), ...prev].slice(0, 7));
      }
      t += 1;
      setTick(t);

      if (t >= TICKS) {
        finish([acc[0], acc[1], acc[2], acc[3]]);
      }
    }, 70);
  }, [finish, stopTimer, targetAt]);

  const reset = useCallback(() => {
    stopTimer();
    setConfigs(DEFAULT_CONFIGS);
    setTick(0);
    setCorrect([0, 0, 0, 0]);
    setLog([]);
    setDevOn([false, false, false, false]);
    setPhase("setup");
  }, [stopTimer]);

  const running = phase === "running";
  const won = phase === "won";

  const ratios = useMemo(() => correct.map((c) => c / TICKS) as [number, number, number, number], [correct]);

  const status = useMemo(() => {
    if (won) return "Dashboard healthy — all four devices stayed correct. ✨🎉 ⭐⭐⭐";
    if (running) return `Streaming live data… tick ${tick} / ${TICKS}`;
    if (phase === "checked")
      return "Some devices drifted off. Tune a comparison or threshold and Go Live again.";
    return "Set each rule's comparison + threshold, then press Go Live ▶";
  }, [won, running, tick, phase]);

  // currently-displayed sensor values (during/after a run, else tick 0).
  const showTick = running || phase === "checked" || won ? Math.min(tick, TICKS - 1) : 0;

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink">
      <style>{`
        @keyframes g8smartclassroomiot-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g8smartclassroomiot-pulse {
          0%,100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes g8smartclassroomiot-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* ---------------- DASHBOARD HEADER ---------------- */}
      <div
        className="panel relative overflow-hidden rounded-xl p-3"
        style={won ? { boxShadow: `0 0 0 1px ${GREEN}, 0 0 24px -4px ${GREEN}` } : undefined}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm">
            <span aria-hidden className="text-lg">
              🏫
            </span>
            <span className="font-display">Smart Classroom</span>
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-tech"
            style={
              won
                ? { background: GREEN, color: "#05070d" }
                : { color: "var(--color-ink-faint)", border: "1px solid var(--color-line)" }
            }
            aria-hidden
          >
            {won ? "● healthy" : running ? "● live" : "○ idle"}
          </span>
        </div>

        {/* sensor gauges */}
        <div className="grid grid-cols-2 gap-1.5">
          {SENSORS.map((s) => {
            const v = s.feed[showTick];
            const frac = (v - s.min) / (s.max - s.min);
            const pct = Math.max(0, Math.min(1, frac)) * 100;
            const isMotion = s.id === "motion";
            const display = isMotion ? (v === 1 ? "DETECTED" : "still") : `${v}${s.unit ? " " + s.unit : ""}`;
            return (
              <div
                key={s.id}
                className="rounded-lg border border-line bg-panel-2/60 p-2"
                role="img"
                aria-label={`${s.label} reading ${display}`}
              >
                <div className="flex items-center justify-between text-[10px] text-ink-faint">
                  <span>
                    {s.emoji} {s.label}
                  </span>
                </div>
                <div className="font-display text-sm" style={{ color: ACCENT }}>
                  {display}
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-panel">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${isMotion ? (v === 1 ? 100 : 6) : pct}%`,
                      background: ACCENT,
                      transition: "width 90ms linear",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* device panel */}
        <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
          {RULES.map((r, i) => {
            const on = devOn[i];
            return (
              <div
                key={`${r.device}-${i}`}
                className="rounded-lg border p-1.5"
                style={{ borderColor: on ? ACCENT : "var(--color-line)" }}
                role="img"
                aria-label={`${r.deviceLabel} is ${on ? r.onLabel : r.offLabel}`}
              >
                <div
                  className="text-xl"
                  aria-hidden
                  style={
                    on && r.sensor === "temp" && running
                      ? { display: "inline-block", animation: "g8smartclassroomiot-spin 0.7s linear infinite" }
                      : on && running
                        ? { animation: "g8smartclassroomiot-pulse 0.9s ease-in-out infinite" }
                        : { opacity: on ? 1 : 0.4 }
                  }
                >
                  {r.deviceEmoji}
                </div>
                <div className="text-[9px]" style={{ color: on ? ACCENT : "var(--color-ink-faint)" }}>
                  {on ? "ON" : "OFF"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------------- STATUS ---------------- */}
      <div
        className="rounded-lg border px-3 py-2 text-xs"
        role="status"
        aria-live="polite"
        style={{
          borderColor: won ? GREEN : "var(--color-line)",
          color: won ? GREEN : "var(--color-ink-dim)",
        }}
      >
        {status}
      </div>

      {/* ---------------- PER-DEVICE CORRECT BARS ---------------- */}
      {(running || phase === "checked" || won) && (
        <div className="panel flex flex-col gap-1.5 rounded-xl p-3">
          <p className="text-[11px] uppercase tracking-tech text-ink-faint">Correct-state %</p>
          {RULES.map((r, i) => {
            const pct = Math.round(ratios[i] * 100);
            const pass = ratios[i] >= PASS_RATIO - 1e-9;
            return (
              <div key={`bar-${i}`} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-[11px] text-ink-dim">
                  {r.deviceEmoji} {r.deviceLabel}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-panel-2">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: pass ? GREEN : pct >= 60 ? AMBER : RED,
                      transition: "width 90ms linear",
                    }}
                  />
                </div>
                <span
                  className="w-9 shrink-0 text-right font-display text-[11px]"
                  style={{ color: pass ? GREEN : "var(--color-ink-dim)" }}
                >
                  {pct}%
                </span>
              </div>
            );
          })}
          <p className="text-[10px] text-ink-faint">Goal: every bar ≥ {Math.round(PASS_RATIO * 100)}%.</p>
        </div>
      )}

      {/* ---------------- EVENT LOG ---------------- */}
      {(running || phase === "checked" || won) && log.length > 0 && (
        <div className="panel rounded-xl p-3">
          <p className="mb-1 text-[11px] uppercase tracking-tech text-ink-faint">Event log</p>
          <ul className="flex flex-col gap-0.5 text-[11px] text-ink-dim">
            {log.map((e, i) => (
              <li key={`${e.tick}-${i}`} className="tabular-nums">
                {e.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {won && (
        <div
          className="rounded-lg border p-3 text-center text-xs"
          style={{
            borderColor: GREEN,
            color: "var(--color-ink)",
            animation: "g8smartclassroomiot-pop 0.4s ease-out",
          }}
        >
          Your IF-sensor-THEN-device rules ran the whole classroom automatically — that is exactly how
          real IoT automation works. ✨🎉
        </div>
      )}

      {/* ---------------- RULE EDITOR ---------------- */}
      <div className="panel flex flex-col gap-2.5 rounded-xl p-3">
        <p className="text-[11px] uppercase tracking-tech text-ink-faint">Automation rules — IF … THEN …</p>
        {RULES.map((r, i) => {
          const s = SENSOR_BY_ID[r.sensor];
          const cfg = configs[i];
          return (
            <div
              key={`rule-${i}`}
              className="rounded-lg border border-line bg-panel-2/40 p-2"
            >
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-ink-faint">IF</span>
                <span
                  className="rounded-md px-1.5 py-0.5"
                  style={{ background: "color-mix(in srgb, #22d3ee 14%, transparent)", color: ACCENT }}
                >
                  {s.emoji} {s.label}
                </span>
                {/* comparison toggle */}
                <div className="inline-flex overflow-hidden rounded-md border border-line" role="group" aria-label={`Comparison for ${r.deviceLabel} rule`}>
                  {(["<", ">"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onPointerDown={() => !running && setCmp(i, c)}
                      aria-pressed={cfg.cmp === c}
                      aria-label={`compare ${c === ">" ? "greater than" : "less than"}`}
                      className="px-2 py-0.5 font-display"
                      style={{
                        touchAction: "manipulation",
                        background: cfg.cmp === c ? ACCENT : "transparent",
                        color: cfg.cmp === c ? "#05070d" : "var(--color-ink-dim)",
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                {/* threshold chips */}
                <span className="text-ink-faint">→</span>
                <span className="text-ink-dim">{r.onLabel}</span>
              </div>

              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="text-[10px] text-ink-faint">threshold</span>
                <div className="flex flex-wrap gap-1">
                  {r.choices.map((th) => (
                    <button
                      key={th}
                      type="button"
                      onPointerDown={() => !running && setThreshold(i, th)}
                      aria-pressed={cfg.threshold === th}
                      aria-label={`set ${r.deviceLabel} threshold to ${th}`}
                      className="rounded-md border px-2 py-0.5 text-[11px] font-display tabular-nums"
                      style={{
                        touchAction: "manipulation",
                        borderColor: cfg.threshold === th ? ACCENT : "var(--color-line)",
                        background:
                          cfg.threshold === th
                            ? "color-mix(in srgb, #22d3ee 18%, transparent)"
                            : "transparent",
                        color: cfg.threshold === th ? ACCENT : "var(--color-ink-dim)",
                      }}
                    >
                      {th}
                      {s.unit ? s.unit : ""}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ---------------- CONTROLS ---------------- */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
          aria-label="Reset all rules and the dashboard"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-60"
          style={{ background: ACCENT, color: "#05070d" }}
          aria-label="Run the 60-tick scenario live"
        >
          {running ? `Live ${tick}/${TICKS}` : won ? "Go Live again ▶" : "Go Live ▶"}
        </button>
      </div>
    </div>
  );
}
