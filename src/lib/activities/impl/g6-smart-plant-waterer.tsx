"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Smart Plant Waterer — design the watering brain over 3 rounds.     */
/*  Learning goal: combine two sensors with AND logic so a bot waters  */
/*  only when it truly helps. Each round changes the day AND the rule  */
/*  shape, so you cannot brute-force one fixed answer — you must read  */
/*  the data and reason about where BOTH conditions are true.          */
/*                                                                     */
/*  R1  AND      : dry AND hot  (learn the rule)                       */
/*  R2  AND+gate : dry AND hot, but two decoys sit right on the edge   */
/*                 of the dials — pick thresholds that thread between   */
/*                 a watered tick and a trap tick.                      */
/*  R3  DEBUG    : the bot ships with an almost-right rule that floods  */
/*                 one trap and skips one real moment. Find & fix it.   */
/* ------------------------------------------------------------------ */

const ACCENT = "#a855f7";
const VIEW_W = 320;
const VIEW_H = 150;
const SOIL_MAX = 600;
const TEMP_MAX = 40;

/** One reading in the simulated day. soil: 0 (bone dry) → 600 (soaked). */
interface Tick {
  time: string;
  soil: number;
  temp: number;
}

interface Round {
  key: string;
  badge: string;
  brief: string;
  day: readonly Tick[];
  /** Allowed dial values (the search space) for this round. */
  soilOptions: readonly number[];
  tempOptions: readonly number[];
  /** Correct thresholds — used only to derive TARGET, never shown. */
  soilRule: number;
  tempRule: number;
  /** Starting dial positions. For DEBUG these are an almost-right rule. */
  startSoil: number;
  startTemp: number;
  /** Why this round is tricky — one short coaching line. */
  twist: string;
}

/* Round 1 — learn AND. Three dry-and-hot moments, two dry-but-cold traps. */
const R1_DAY: readonly Tick[] = [
  { time: "06:00", soil: 280, temp: 18 }, // dry but COLD  → OFF
  { time: "09:00", soil: 250, temp: 27 }, // dry & hot     → water
  { time: "12:00", soil: 180, temp: 33 }, // dry & hot     → water
  { time: "15:00", soil: 460, temp: 31 }, // hot but WET   → OFF
  { time: "18:00", soil: 200, temp: 22 }, // dry but COLD  → OFF
  { time: "21:00", soil: 120, temp: 26 }, // dry & hot     → water
] as const;

/* Round 2 — edge cases. A near-dry/near-hot tick must be threaded so it
   stays OFF, while a true dry-hot tick a hair away must fire. Only one
   pair of dials separates them, so a careless guess floods or skips. */
const R2_DAY: readonly Tick[] = [
  { time: "07:00", soil: 230, temp: 24 }, // dry, almost-hot → OFF (temp too low)
  { time: "10:00", soil: 230, temp: 26 }, // dry & hot       → water
  { time: "13:00", soil: 340, temp: 32 }, // damp, hot       → OFF (soil too wet)
  { time: "16:00", soil: 290, temp: 30 }, // dry & hot       → water
  { time: "19:00", soil: 150, temp: 21 }, // dry but cold    → OFF
  { time: "22:00", soil: 120, temp: 28 }, // dry & hot       → water
] as const;

/* Round 3 — DEBUG. Ships with soil<400 AND temp>20 (too loose): it floods
   the cold-but-dry trap at 17:00 and waters the wet tick at 11:00. Tighten
   both dials to the only pair that fixes both bugs without dropping a real
   watering. */
const R3_DAY: readonly Tick[] = [
  { time: "08:00", soil: 220, temp: 29 }, // dry & hot    → water
  { time: "11:00", soil: 380, temp: 31 }, // hot but WET  → OFF (loose rule floods)
  { time: "14:00", soil: 160, temp: 34 }, // dry & hot    → water
  { time: "17:00", soil: 240, temp: 23 }, // dry but COLD → OFF (loose rule floods)
  { time: "20:00", soil: 200, temp: 27 }, // dry & hot    → water
  { time: "23:00", soil: 290, temp: 24 }, // borderline cold → OFF
] as const;

const ROUNDS: readonly Round[] = [
  {
    key: "r1",
    badge: "Round 1 · Learn AND",
    brief: "Water only when soil is DRY and air is HOT.",
    day: R1_DAY,
    soilOptions: [200, 250, 300, 350, 400],
    tempOptions: [20, 22, 25, 28, 30],
    soilRule: 300,
    tempRule: 25,
    startSoil: 400,
    startTemp: 20,
    twist: "Two cold mornings are dry too — AND must keep them OFF.",
  },
  {
    key: "r2",
    badge: "Round 2 · Thread the edge",
    brief: "Same AND rule — but the traps sit RIGHT next to real moments.",
    day: R2_DAY,
    soilOptions: [220, 260, 300, 320, 360],
    tempOptions: [22, 24, 25, 27, 29],
    soilRule: 300,
    tempRule: 25,
    startSoil: 360,
    startTemp: 22,
    twist: "07:00 is dry but only 24° — your temp line must sit just above it.",
  },
  {
    key: "r3",
    badge: "Round 3 · Debug the bot",
    brief: "The bot shipped with a too-loose rule that over-waters. Tighten the dials to stop the bad calls.",
    day: R3_DAY,
    soilOptions: [220, 260, 300, 350, 400],
    tempOptions: [20, 22, 25, 26, 28],
    soilRule: 300,
    tempRule: 25,
    startSoil: 400,
    startTemp: 20,
    twist: "It waters a wet tick and the cold ones too. Tighten BOTH dials.",
  },
] as const;

const TOTAL_ROUNDS = ROUNDS.length;

/** Decisions a (soil,temp) threshold pair makes across a day. */
function decide(
  day: readonly Tick[],
  soil: number,
  temp: number,
): boolean[] {
  return day.map((t) => t.soil < soil && t.temp > temp);
}

/** Stars: clean run (few replays) earns more. */
function starsFor(replays: number): 1 | 2 | 3 {
  if (replays <= 1) return 3;
  if (replays <= 3) return 2;
  return 1;
}

type Phase = "idle" | "playing" | "won-round" | "miss" | "won-all";

export default function SmartPlantWaterer({ onComplete }: ActivityProps) {
  const [roundIdx, setRoundIdx] = useState<number>(0);
  const round = ROUNDS[roundIdx];
  const DAY = round.day;
  const TARGET = useMemo<boolean[]>(
    () => decide(DAY, round.soilRule, round.tempRule),
    [DAY, round.soilRule, round.tempRule],
  );

  const [soilThresh, setSoilThresh] = useState<number>(round.startSoil);
  const [tempThresh, setTempThresh] = useState<number>(round.startTemp);
  const [tick, setTick] = useState<number>(0); // current scrubbed tick
  const [played, setPlayed] = useState<number>(-1); // furthest tick simulated
  const [phase, setPhase] = useState<Phase>("idle");
  const [tries, setTries] = useState<number>(0); // total play presses (all rounds)
  const [roundReplays, setRoundReplays] = useState<number>(0); // plays this round
  const [graded, setGraded] = useState<boolean>(false); // revealed correctness?
  const reportedRef = useRef<boolean>(false);
  const allDoneRef = useRef<boolean>(false);

  /** Decisions the learner's CURRENT rule makes across the whole day. */
  const decisions = useMemo<boolean[]>(
    () => decide(DAY, soilThresh, tempThresh),
    [DAY, soilThresh, tempThresh],
  );

  const ruleSolved = useMemo<boolean>(
    () => decisions.every((d, i) => d === TARGET[i]),
    [decisions, TARGET],
  );

  // Which logged rows the learner has revealed so far (0..played).
  const loggedRows = played + 1;
  const cur = DAY[tick];
  const curPump = decisions[tick];
  // Only show right/wrong markings once a run has been judged.
  const curFlood = graded && phase !== "idle" && curPump && !TARGET[tick];

  const advanceOrFinish = useCallback(() => {
    if (roundIdx < TOTAL_ROUNDS - 1) {
      // Move to the next round, fresh dials & day.
      const nextIdx = roundIdx + 1;
      const next = ROUNDS[nextIdx];
      setRoundIdx(nextIdx);
      setSoilThresh(next.startSoil);
      setTempThresh(next.startTemp);
      setRoundReplays(0);
      setPlayed(-1);
      setTick(0);
      setGraded(false);
      setPhase("idle");
    } else {
      // All rounds cleared.
      if (allDoneRef.current) return;
      allDoneRef.current = true;
      setPhase("won-all");
      if (!reportedRef.current) {
        reportedRef.current = true;
        const stars = starsFor(roundReplays);
        onComplete({
          passed: true,
          stars,
          detail:
            stars === 3
              ? "Designed all 3 watering brains first try — true AND-logic engineer!"
              : "All 3 rounds solved — your AND rules water only when it helps.",
        });
      }
    }
  }, [roundIdx, roundReplays, onComplete]);

  // Advance the simulated day one tick at a time while "playing".
  useEffect(() => {
    if (phase !== "playing") return;
    if (played >= DAY.length - 1) {
      // Reached the end of the day — judge the run.
      setGraded(true);
      if (ruleSolved) {
        setPhase("won-round");
      } else {
        setPhase("miss");
      }
      return;
    }
    const id = window.setTimeout(() => {
      const next = played + 1;
      setPlayed(next);
      setTick(next);
    }, 600);
    return () => window.clearTimeout(id);
  }, [phase, played, ruleSolved, DAY.length]);

  const handlePlay = useCallback(() => {
    if (phase === "playing" || phase === "won-round" || phase === "won-all")
      return;
    setTries((t) => t + 1);
    setRoundReplays((r) => r + 1);
    setGraded(false);
    setPlayed(0);
    setTick(0);
    setPhase("playing");
  }, [phase]);

  const handleReset = useCallback(() => {
    if (phase === "won-round" || phase === "won-all") return;
    setPlayed(-1);
    setTick(0);
    setGraded(false);
    setPhase("idle");
  }, [phase]);

  const scrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      setTick(Math.min(v, Math.max(loggedRows - 1, 0)));
    },
    [loggedRows],
  );

  const setSoil = useCallback(
    (v: number) => {
      if (phase === "won-round" || phase === "won-all") return;
      setSoilThresh(v);
      if (phase !== "idle") handleReset();
    },
    [phase, handleReset],
  );
  const setTemp = useCallback(
    (v: number) => {
      if (phase === "won-round" || phase === "won-all") return;
      setTempThresh(v);
      if (phase !== "idle") handleReset();
    },
    [phase, handleReset],
  );

  // ----- Live line chart of soil moisture across logged ticks -----
  const chartD = useMemo<string>(() => {
    if (loggedRows < 1) return "";
    const pts = DAY.slice(0, loggedRows).map((t, i) => {
      const x = 12 + (i / Math.max(DAY.length - 1, 1)) * (VIEW_W - 24);
      const y = VIEW_H - 14 - (t.soil / SOIL_MAX) * (VIEW_H - 28);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    return pts.join(" ");
  }, [DAY, loggedRows]);

  const goodWaterings = useMemo<number>(
    () => DAY.filter((_, i) => i < loggedRows && decisions[i] && TARGET[i]).length,
    [DAY, loggedRows, decisions, TARGET],
  );
  const targetWaterings = useMemo<number>(
    () => TARGET.filter(Boolean).length,
    [TARGET],
  );

  const plantGreen = useMemo<string>(() => {
    const t = targetWaterings > 0 ? goodWaterings / targetWaterings : 0;
    const light = 32 + Math.round(t * 30);
    return `hsl(140 65% ${light}%)`;
  }, [goodWaterings, targetWaterings]);

  const status = useMemo<string>(() => {
    if (phase === "won-all") return "Every round solved! The garden is thriving ✨";
    if (phase === "won-round")
      return `Round ${roundIdx + 1} cleared — press Next round ▶`;
    if (phase === "miss")
      return "A wrong call slipped through — check the ⚠ rows and retune.";
    if (phase === "playing")
      return `Logging ${cur.time} · soil ${cur.soil} · temp ${cur.temp}°`;
    return "Build the rule, then press Play day ▶";
  }, [phase, cur, roundIdx]);

  const soilPct = Math.round((cur.soil / SOIL_MAX) * 100);
  const tempPct = Math.round((cur.temp / TEMP_MAX) * 100);

  // Coaching for a missed run, based on the actual bug in the rule.
  const missHint = useMemo<string>(() => {
    const flooded = decisions.some((d, i) => d && !TARGET[i]);
    const skipped = decisions.some((d, i) => !d && TARGET[i]);
    if (flooded && skipped)
      return "Both kinds of mistake — you watered a trap AND skipped a real moment. Nudge both dials.";
    if (flooded)
      return "You watered a tick that should stay OFF (too dry-only or too hot-only). Tighten a dial.";
    if (skipped)
      return "You skipped a dry-and-hot moment — loosen a dial just enough to let it fire.";
    return "Replay to lock it in.";
  }, [decisions, TARGET]);

  const isDone = phase === "won-all";

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

      {/* ---------------- ROUND HEADER ---------------- */}
      <div className="flex items-center justify-between gap-2 px-1">
        <span
          className="rounded-md px-2 py-1 text-[11px] font-bold tracking-tech"
          style={{ background: `${ACCENT}22`, color: ACCENT }}
        >
          {isDone ? "All rounds clear ✓" : round.badge}
        </span>
        <div className="flex gap-1" aria-hidden>
          {ROUNDS.map((r, i) => (
            <span
              key={r.key}
              className="h-2 w-2 rounded-full"
              style={{
                background:
                  i < roundIdx || isDone
                    ? ACCENT
                    : i === roundIdx
                      ? `${ACCENT}88`
                      : "#1b2433",
              }}
            />
          ))}
        </div>
      </div>
      {!isDone && (
        <p className="-mt-1 px-1 text-[11px] text-ink-dim">{round.brief}</p>
      )}

      {/* ---------------- DASHBOARD ---------------- */}
      <div
        className="panel relative overflow-hidden rounded-xl p-2"
        style={
          phase === "won-round" || phase === "won-all"
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
                  phase === "won-round" || phase === "won-all"
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
              pct={soilPct}
              unit=""
              color="#38bdf8"
              note={cur.soil < soilThresh ? "DRY ✓" : "wet"}
            />
            <Gauge
              label="Temperature"
              value={cur.temp}
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
            const wrong = graded && on !== TARGET[i];
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
          style={
            phase === "won-round" || phase === "won-all"
              ? { color: ACCENT }
              : undefined
          }
        >
          <span
            className={
              phase === "won-round" || phase === "won-all"
                ? "font-display"
                : "text-ink-dim"
            }
          >
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
          {roundIdx === 2
            ? "Fix the bot's watering rule"
            : "Snap the watering rule together"}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <Block>IF soil &lt;</Block>
          <Dial
            value={soilThresh}
            options={round.soilOptions}
            onPick={setSoil}
            ariaLabel="Soil threshold"
          />
          <Block tone="and">AND</Block>
          <Block>temp &gt;</Block>
          <Dial
            value={tempThresh}
            options={round.tempOptions}
            onPick={setTemp}
            unit="°"
            ariaLabel="Temperature threshold"
          />
          <Block tone="then">THEN pump 8s</Block>
        </div>

        {!isDone && (
          <p className="text-[11px] text-ink-faint">
            <span style={{ color: ACCENT }}>Hint:</span> {round.twist}
          </p>
        )}

        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-[11px] text-ink-faint">
            Round {Math.min(roundIdx + 1, TOTAL_ROUNDS)}/{TOTAL_ROUNDS} · plays:{" "}
            {tries}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={phase === "idle" || phase === "won-round" || isDone}
              className="rounded-lg border border-line bg-panel/60 px-3 py-1.5 text-xs font-medium text-ink-dim disabled:opacity-50"
              aria-label="Reset the day"
            >
              Reset
            </button>
            {phase === "won-round" ? (
              <button
                type="button"
                onClick={advanceOrFinish}
                className="rounded-lg px-4 py-1.5 text-xs font-medium"
                style={{ background: ACCENT, color: "#0b0710" }}
                aria-label="Go to the next round"
              >
                Next round ▶
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePlay}
                disabled={phase === "playing" || isDone}
                className="rounded-lg px-4 py-1.5 text-xs font-medium disabled:opacity-60"
                style={{ background: ACCENT, color: "#0b0710" }}
                aria-label="Play the simulated day"
              >
                {phase === "playing" ? "Playing…" : "Play day ▶"}
              </button>
            )}
          </div>
        </div>

        {phase === "miss" && (
          <p className="text-[11px]" style={{ color: ACCENT }}>
            {missHint}
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
                const wrong = shown && graded && on !== TARGET[i];
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

      {/* ---------------- WIN PANEL ---------------- */}
      {isDone && (
        <div
          className="panel rounded-xl p-3 text-xs"
          style={{ boxShadow: `0 0 0 1px ${ACCENT}55` }}
        >
          <p className="font-display text-sm" style={{ color: ACCENT }}>
            ✨🎉 You engineered the watering brain ⭐⭐⭐
          </p>
          <p className="mt-1 leading-snug text-ink-dim">
            Across 3 different days you tuned an <b>AND</b> rule so the pump
            fired only when the soil was dry <b>and</b> the air was hot — even
            when traps sat right on the edge, and even when the bot shipped with
            a buggy rule you had to debug. Combining two sensors with AND makes a
            careful robot that never wastes water.
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
    tone === "and"
      ? ACCENT
      : tone === "then"
        ? "#7dd3fc"
        : "var(--color-ink-dim, #9aa6b2)";
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
