"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Smart Plant Waterer — combine two sensors with AND, log the data  */
/*  Learning goal: a bot acts only when BOTH conditions are true      */
/*  (soil dry AND air hot). Build the rule, play the day, read the    */
/*  logged data, and avoid the "dry but cold" traps.                  */
/* ------------------------------------------------------------------ */

const ACCENT = "#a855f7";
const VIEW_W = 320;
const VIEW_H = 150;

/** One reading in the simulated day. soil: 0 (bone dry) → 600 (soaked). */
interface Tick {
  time: string;
  soil: number;
  temp: number;
}

/**
 * A fixed day of 6 readings. Hand-picked so the target rule
 * (soil < 300 AND temp > 25) fires on exactly 3 ticks and the two
 * "dry but cold" traps stay OFF. Deterministic & always winnable.
 */
const DAY: readonly Tick[] = [
  { time: "06:00", soil: 280, temp: 18 }, // dry but COLD  → trap, stay OFF
  { time: "09:00", soil: 250, temp: 27 }, // dry & hot     → water
  { time: "12:00", soil: 180, temp: 33 }, // dry & hot     → water
  { time: "15:00", soil: 460, temp: 31 }, // hot but WET   → stay OFF
  { time: "18:00", soil: 200, temp: 22 }, // dry but COLD  → trap, stay OFF
  { time: "21:00", soil: 120, temp: 26 }, // dry & hot     → water
] as const;

/** The correct watering decisions, derived once from the target rule. */
const TARGET: readonly boolean[] = DAY.map((t) => t.soil < 300 && t.temp > 25);
const SOIL_OPTIONS: readonly number[] = [200, 250, 300, 350, 400] as const;
const TEMP_OPTIONS: readonly number[] = [20, 22, 25, 28, 30] as const;
const SOIL_MAX = 600;
const TEMP_MAX = 40;

type Phase = "idle" | "playing" | "won" | "miss";

export default function SmartPlantWaterer({ onComplete }: ActivityProps) {
  const [soilThresh, setSoilThresh] = useState<number>(400);
  const [tempThresh, setTempThresh] = useState<number>(20);
  const [tick, setTick] = useState<number>(0); // current scrubbed tick
  const [played, setPlayed] = useState<number>(-1); // furthest tick simulated
  const [phase, setPhase] = useState<Phase>("idle");
  const [tries, setTries] = useState<number>(0);
  const wonRef = useRef<boolean>(false);

  /** Decisions the learner's CURRENT rule makes across the whole day. */
  const decisions = useMemo<boolean[]>(
    () => DAY.map((t) => t.soil < soilThresh && t.temp > tempThresh),
    [soilThresh, tempThresh],
  );

  const correctCount = useMemo<number>(
    () => decisions.reduce((n, d, i) => (d === TARGET[i] ? n + 1 : n), 0),
    [decisions],
  );
  const ruleSolved = correctCount === DAY.length;

  // Which logged rows the learner has revealed so far (0..played).
  const loggedRows = played + 1;
  const cur = DAY[tick];
  const curPump = decisions[tick];
  // A "flood" is watering a dry-but-cold trap (or any wrong ON).
  const curFlood = phase !== "idle" && curPump && !TARGET[tick];

  const finish = useCallback(() => {
    if (wonRef.current) return;
    wonRef.current = true;
    setPhase("won");
    onComplete({
      passed: true,
      stars: 3,
      detail: "AND rule watered the 3 dry-hot moments and blocked both traps.",
    });
  }, [onComplete]);

  // Advance the simulated day one tick at a time while "playing".
  useEffect(() => {
    if (phase !== "playing") return;
    if (played >= DAY.length - 1) {
      // Reached the end of the day — judge the run.
      if (ruleSolved) {
        finish();
      } else {
        setPhase("miss");
        if (!wonRef.current) {
          onComplete({
            passed: false,
            detail:
              "Some decisions were wrong — check the rows ringed in red and retune your rule.",
          });
        }
      }
      return;
    }
    const id = window.setTimeout(() => {
      const next = played + 1;
      setPlayed(next);
      setTick(next);
    }, 650);
    return () => window.clearTimeout(id);
  }, [phase, played, ruleSolved, finish, onComplete]);

  const handlePlay = useCallback(() => {
    if (wonRef.current) return;
    setTries((t) => t + 1);
    setPlayed(0);
    setTick(0);
    setPhase("playing");
  }, []);

  const handleReset = useCallback(() => {
    if (wonRef.current) return;
    setPlayed(-1);
    setTick(0);
    setPhase("idle");
  }, []);

  const scrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      setTick(Math.min(v, Math.max(loggedRows - 1, 0)));
    },
    [loggedRows],
  );

  const setSoil = useCallback(
    (v: number) => {
      if (wonRef.current) return;
      setSoilThresh(v);
      if (phase !== "idle") handleReset();
    },
    [phase, handleReset],
  );
  const setTemp = useCallback(
    (v: number) => {
      if (wonRef.current) return;
      setTempThresh(v);
      if (phase !== "idle") handleReset();
    },
    [phase, handleReset],
  );

  // ----- Live line chart of soil moisture across logged ticks -----
  const chartD = useMemo<string>(() => {
    if (loggedRows < 1) return "";
    const pts = DAY.slice(0, loggedRows).map((t, i) => {
      const x =
        12 + (i / Math.max(DAY.length - 1, 1)) * (VIEW_W - 24);
      const y = VIEW_H - 14 - (t.soil / SOIL_MAX) * (VIEW_H - 28);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    return pts.join(" ");
  }, [loggedRows]);

  const plantGreen = useMemo<string>(() => {
    // Brighter green as more correct waterings have been logged.
    const goodSoFar = DAY.slice(0, loggedRows).filter(
      (_, i) => decisions[i] && TARGET[i],
    ).length;
    const t = goodSoFar / 3;
    const light = 32 + Math.round(t * 30);
    return `hsl(140 65% ${light}%)`;
  }, [loggedRows, decisions]);

  const status = useMemo<string>(() => {
    if (phase === "won") return "Perfect day! The plant is thriving ✨";
    if (phase === "miss")
      return "A wrong call slipped through — retune and replay.";
    if (phase === "playing")
      return `Logging ${cur.time} · soil ${cur.soil} · temp ${cur.temp}°`;
    return "Build the rule, then press Play day ▶";
  }, [phase, cur]);

  const soilPct = Math.round((cur.soil / SOIL_MAX) * 100);
  const tempPct = Math.round((cur.temp / TEMP_MAX) * 100);

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink">
      <style>{`
        @keyframes g6smartplantwaterer-drip {
          0% { transform: translateY(-4px); opacity: 0; }
          40% { opacity: 1; }
          100% { transform: translateY(8px); opacity: 0; }
        }
        @keyframes g6smartplantwaterer-pop {
          0% { transform: scale(.6); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g6smartplantwaterer-sway {
          0%,100% { transform: rotate(-2deg); }
          50% { transform: rotate(2deg); }
        }
      `}</style>

      {/* ---------------- DASHBOARD ---------------- */}
      <div
        className="panel relative overflow-hidden rounded-xl p-2"
        style={
          phase === "won"
            ? { boxShadow: `0 0 0 1px ${ACCENT}, 0 0 24px -4px ${ACCENT}` }
            : undefined
        }
      >
        <div className="flex items-stretch gap-2">
          {/* Plant + pot */}
          <div className="flex w-[96px] shrink-0 flex-col items-center justify-end">
            <div
              aria-hidden
              className="text-4xl"
              style={{
                color: plantGreen,
                animation:
                  phase === "won"
                    ? "g6smartplantwaterer-sway 1.6s ease-in-out infinite"
                    : undefined,
                filter: `drop-shadow(0 0 6px ${plantGreen}55)`,
              }}
            >
              🌱
            </div>
            <div className="relative text-3xl" aria-hidden>
              🪴
              {curFlood && (
                <span
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-lg"
                  style={{ animation: "g6smartplantwaterer-pop .3s ease both" }}
                >
                  💧🌊
                </span>
              )}
              {phase !== "idle" && curPump && !curFlood && (
                <span
                  className="absolute -top-2 left-1/2 -translate-x-1/2 text-sm"
                  style={{
                    animation:
                      "g6smartplantwaterer-drip .6s ease-in-out infinite",
                  }}
                >
                  💧
                </span>
              )}
            </div>
          </div>

          {/* Gauges */}
          <div className="flex flex-1 flex-col justify-center gap-2">
            <Gauge
              label="Soil moisture"
              value={cur.soil}
              max={SOIL_MAX}
              pct={soilPct}
              unit=""
              color="#38bdf8"
              note={cur.soil < soilThresh ? "DRY ✓" : "wet"}
            />
            <Gauge
              label="Temperature"
              value={cur.temp}
              max={TEMP_MAX}
              pct={tempPct}
              unit="°C"
              color="#fb923c"
              note={cur.temp > tempThresh ? "HOT ✓" : "cool"}
            />
            <div
              className="mt-0.5 flex items-center justify-between rounded-md px-2 py-1 text-[11px]"
              style={{
                background: curPump ? `${ACCENT}22` : "#1b2433",
                color: curPump ? ACCENT : "var(--color-ink-faint, #6b7785)",
              }}
            >
              <span>pump</span>
              <span className="font-bold tracking-tech">
                {curPump ? "ON 8s" : "OFF"}
              </span>
            </div>
          </div>
        </div>

        {/* Live soil chart */}
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="mt-2 block h-auto w-full rounded-md bg-panel-2/40"
          role="img"
          aria-label="Line chart of logged soil moisture over the day"
        >
          {[0, 0.5, 1].map((g) => (
            <line
              key={g}
              x1={12}
              x2={VIEW_W - 12}
              y1={VIEW_H - 14 - g * (VIEW_H - 28)}
              y2={VIEW_H - 14 - g * (VIEW_H - 28)}
              stroke="#1b2433"
              strokeWidth={0.6}
            />
          ))}
          {/* dry-line at the soil threshold */}
          <line
            x1={12}
            x2={VIEW_W - 12}
            y1={VIEW_H - 14 - (soilThresh / SOIL_MAX) * (VIEW_H - 28)}
            y2={VIEW_H - 14 - (soilThresh / SOIL_MAX) * (VIEW_H - 28)}
            stroke={ACCENT}
            strokeWidth={0.8}
            strokeDasharray="4 3"
            opacity={0.8}
          />
          {chartD && (
            <path
              d={chartD}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {DAY.slice(0, loggedRows).map((t, i) => {
            const x = 12 + (i / Math.max(DAY.length - 1, 1)) * (VIEW_W - 24);
            const y = VIEW_H - 14 - (t.soil / SOIL_MAX) * (VIEW_H - 28);
            const on = decisions[i];
            const wrong = on !== TARGET[i];
            return (
              <g key={t.time}>
                <circle
                  cx={x}
                  cy={y}
                  r={3}
                  fill={on ? ACCENT : "#38bdf8"}
                  opacity={i === tick ? 1 : 0.85}
                />
                {wrong && (
                  <circle
                    cx={x}
                    cy={y}
                    r={5}
                    fill="none"
                    stroke="#f87171"
                    strokeWidth={1}
                  />
                )}
              </g>
            );
          })}
        </svg>

        <div
          className="mt-1 px-1 text-xs"
          role="status"
          aria-live="polite"
          style={phase === "won" ? { color: ACCENT } : undefined}
        >
          <span className={phase === "won" ? "font-display" : "text-ink-dim"}>
            {status}
          </span>
        </div>
      </div>

      {/* ---------------- TIMELINE SCRUBBER ---------------- */}
      <label className="flex items-center gap-2 px-1 text-[11px] text-ink-dim">
        <span className="shrink-0 tracking-tech">DAY</span>
        <input
          type="range"
          min={0}
          max={DAY.length - 1}
          step={1}
          value={tick}
          onChange={scrub}
          disabled={loggedRows < 1}
          aria-label={`Timeline, viewing ${cur.time}`}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-40"
          style={{ accentColor: ACCENT }}
        />
        <span className="w-10 shrink-0 text-right tabular-nums">{cur.time}</span>
      </label>

      {/* ---------------- RULE BUILDER ---------------- */}
      <div className="panel flex flex-col gap-2 rounded-xl p-3">
        <p className="text-[11px] uppercase tracking-tech text-ink-faint">
          Snap the watering rule together
        </p>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <Block>IF soil &lt;</Block>
          <Dial
            value={soilThresh}
            options={SOIL_OPTIONS}
            onPick={setSoil}
            ariaLabel="Soil threshold"
          />
          <Block tone="and">AND</Block>
          <Block>temp &gt;</Block>
          <Dial
            value={tempThresh}
            options={TEMP_OPTIONS}
            onPick={setTemp}
            unit="°"
            ariaLabel="Temperature threshold"
          />
          <Block tone="then">THEN pump 8s</Block>
        </div>

        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-[11px] text-ink-faint">
            Tries: {tries} · correct calls: {correctCount}/{DAY.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={phase === "idle" || phase === "won"}
              className="rounded-lg border border-line bg-panel/60 px-3 py-1.5 text-xs font-medium text-ink-dim disabled:opacity-50"
              aria-label="Reset the day"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handlePlay}
              disabled={phase === "playing" || phase === "won"}
              className="rounded-lg px-4 py-1.5 text-xs font-medium disabled:opacity-60"
              style={{ background: ACCENT, color: "#0b0710" }}
              aria-label="Play the simulated day"
            >
              {phase === "playing" ? "Playing…" : "Play day ▶"}
            </button>
          </div>
        </div>

        {phase === "miss" && (
          <p className="text-[11px]" style={{ color: ACCENT }}>
            {decisions.some((d, i) => d && !TARGET[i])
              ? "It was dry but cold — your AND rule should block this. Raise the temp dial."
              : "You skipped a dry-and-hot moment — loosen a dial so it fires there."}
          </p>
        )}
      </div>

      {/* ---------------- DATA LOG (CSV) ---------------- */}
      <div className="panel rounded-xl p-2">
        <p className="px-1 pb-1 text-[11px] uppercase tracking-tech text-ink-faint">
          Decision log · time, soil, temp, pump
        </p>
        <div className="overflow-hidden rounded-md">
          <table className="w-full text-left text-[11px] tabular-nums">
            <thead>
              <tr className="text-ink-faint">
                <th className="px-2 py-1 font-normal">time</th>
                <th className="px-2 py-1 font-normal">soil</th>
                <th className="px-2 py-1 font-normal">temp</th>
                <th className="px-2 py-1 font-normal">pump</th>
              </tr>
            </thead>
            <tbody>
              {DAY.map((t, i) => {
                const shown = i < loggedRows;
                const on = decisions[i];
                const wrong = shown && on !== TARGET[i];
                return (
                  <tr
                    key={t.time}
                    className="border-t border-line"
                    style={{
                      background:
                        i === tick && shown ? `${ACCENT}14` : undefined,
                      opacity: shown ? 1 : 0.28,
                    }}
                  >
                    <td className="px-2 py-1">{t.time}</td>
                    <td className="px-2 py-1">{shown ? t.soil : "—"}</td>
                    <td className="px-2 py-1">{shown ? `${t.temp}°` : "—"}</td>
                    <td
                      className="px-2 py-1 font-bold"
                      style={{
                        color: !shown
                          ? undefined
                          : wrong
                            ? "#f87171"
                            : on
                              ? ACCENT
                              : "var(--color-ink-faint, #6b7785)",
                      }}
                    >
                      {shown ? (on ? "ON" : "OFF") : "—"}
                      {wrong ? " ⚠" : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------- WHAT THE DATA TELLS THE FARMER ---------------- */}
      {phase === "won" && (
        <div
          className="panel rounded-xl p-3 text-xs"
          style={{ boxShadow: `0 0 0 1px ${ACCENT}55` }}
        >
          <p className="font-display text-sm" style={{ color: ACCENT }}>
            ✨🎉 What the data tells the farmer ⭐⭐⭐
          </p>
          <p className="mt-1 leading-snug text-ink-dim">
            The pump fired 3 times — only when the soil was dry{" "}
            <b>and</b> the air was hot (09:00, 12:00, 21:00). On the two cold
            mornings the soil was dry too, but the AND rule kept the pump OFF,
            so no water was wasted. Combining two sensors makes a smarter, more
            careful watering robot.
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small presentational pieces                                        */
/* ------------------------------------------------------------------ */

function Gauge({
  label,
  value,
  pct,
  unit,
  color,
  note,
}: {
  label: string;
  value: number;
  max: number;
  pct: number;
  unit: string;
  color: string;
  note: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-ink-dim">{label}</span>
        <span className="tabular-nums" style={{ color }}>
          {value}
          {unit} · {note}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-panel-2">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

function Block({
  children,
  tone = "plain",
}: {
  children: React.ReactNode;
  tone?: "plain" | "and" | "then";
}) {
  const bg =
    tone === "and" ? "#a855f733" : tone === "then" ? "#38bdf833" : "#1b2433";
  const fg =
    tone === "and" ? ACCENT : tone === "then" ? "#7dd3fc" : "var(--color-ink-dim, #9aa6b2)";
  return (
    <span
      className="rounded-md px-2 py-1 text-[11px] font-medium"
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  );
}

function Dial({
  value,
  options,
  onPick,
  unit = "",
  ariaLabel,
}: {
  value: number;
  options: readonly number[];
  onPick: (v: number) => void;
  unit?: string;
  ariaLabel: string;
}) {
  const idx = options.indexOf(value);
  const next = useCallback(() => {
    const i = (idx + 1) % options.length;
    onPick(options[i]);
  }, [idx, options, onPick]);
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        next();
      }}
      aria-label={`${ariaLabel}, currently ${value}${unit}. Tap to change.`}
      className="min-w-[44px] rounded-md px-2 py-1 text-[11px] font-bold tabular-nums"
      style={{
        background: ACCENT,
        color: "#0b0710",
        touchAction: "manipulation",
      }}
    >
      {value}
      {unit} ⟳
    </button>
  );
}
