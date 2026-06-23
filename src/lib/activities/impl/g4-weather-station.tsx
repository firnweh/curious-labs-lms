"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Weather Station — PLAN the readings, then RUN your plan            */
/*  CLASS 4-6 (explorer). One DHT11 sensor reports BOTH temperature    */
/*  and humidity. Each round gives a TARGET BAND for both at once.     */
/*  The learner BUILDS a plan of actions (predict), presses RUN to     */
/*  watch the readings hop tick-by-tick (reveal), and must land the    */
/*  FINAL reading inside the target band.                              */
/*                                                                     */
/*  Why it's a real problem, not a one-tap toy:                        */
/*   • Each action moves BOTH readings — and they fight you. Breathing */
/*     adds humidity but warms the air; the heater warms but DRIES it; */
/*     the fan cools but eases humidity; waiting drifts back to room.  */
/*     So you must reason about ORDER and COUNTS, not tap one button.  */
/*   • R1 / R2 / R3 escalate; NONE is solvable by spamming one action  */
/*     (BFS-verified). R3 is the twist: a hot, humid STORM whose target*/
/*     sits BELOW the room baseline, so the lazy "just wait" overshoots*/
/*     — you must actively fan to cool past room temperature.          */
/*   • OPTIMIZATION: each round has a "par" (fewest moves). Hit every   */
/*     round at par → 3 stars. A few extra moves still wins, fewer star*/
/*  Deterministic. onComplete fires once on the final win.             */
/* ------------------------------------------------------------------ */

const ACCENT = "#a855f7";

/** Room baseline the readings drift back toward on WAIT. */
const BASE_TEMP = 26;
const BASE_HUM = 50;

/** Comfort band thresholds used only for the LCD colour coding. */
const COMFORT_TEMP_LO = 24;
const COMFORT_TEMP_HI = 28;
const COMFORT_HUM_LO = 40;
const COMFORT_HUM_HI = 60;

const MAX_PLAN = 10;
const STEP_MS = 520;

type ActionId = "breathe" | "fan" | "heat" | "wait";

interface Reading {
  /** Tick index, shown as a tiny clock-ish label. */
  t: number;
  temp: number;
  hum: number;
}

interface ActionDef {
  id: ActionId;
  label: string;
  short: string;
  glyph: string;
  /** One-line hint about what it does to BOTH readings. */
  effect: string;
  /** Deterministic effect on the environment. */
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
    short: "Breathe",
    glyph: "😮‍💨",
    effect: "humidity ▲16, but temp ▲1 (moist warm breath)",
    apply: (r) => ({
      temp: clamp(r.temp + 1, 10, 45),
      hum: clamp(r.hum + 16, 0, 100),
    }),
  },
  {
    id: "fan",
    label: "Blow a fan",
    short: "Fan",
    glyph: "💨",
    effect: "temp ▼2 and humidity ▼4 (cooling draft)",
    apply: (r) => ({
      temp: clamp(r.temp - 2, 10, 45),
      hum: clamp(r.hum - 4, 0, 100),
    }),
  },
  {
    id: "heat",
    label: "Switch on heater",
    short: "Heater",
    glyph: "🔥",
    effect: "temp ▲3 but humidity ▼6 (warm DRY air)",
    apply: (r) => ({
      temp: clamp(r.temp + 3, 10, 45),
      hum: clamp(r.hum - 6, 0, 100),
    }),
  },
  {
    id: "wait",
    label: "Wait a tick",
    short: "Wait",
    glyph: "⏳",
    effect: `readings drift toward room (${BASE_TEMP}°C, ${BASE_HUM}%)`,
    apply: (r) => ({
      temp: drift(r.temp, BASE_TEMP, 2),
      hum: drift(r.hum, BASE_HUM, 8),
    }),
  },
] as const;

const ACTION_BY_ID: Record<ActionId, ActionDef> = ACTIONS.reduce(
  (m, a) => {
    m[a.id] = a;
    return m;
  },
  {} as Record<ActionId, ActionDef>,
);

interface Round {
  id: 1 | 2 | 3;
  name: string;
  brief: string;
  start: Reading;
  tLo: number;
  tHi: number;
  hLo: number;
  hHi: number;
  /** Fewest moves to land in the band (BFS-verified). Hit this for full stars. */
  par: number;
}

/* Three fixed, escalating, hand-authored & BFS-verified rounds.
   None is solvable by spamming a single action. */
const ROUNDS: readonly Round[] = [
  {
    id: 1,
    name: "Make it rain",
    brief: "Push humidity sky-high — but keep the air cool enough.",
    start: { t: 0, temp: BASE_TEMP, hum: BASE_HUM },
    tLo: 24,
    tHi: 27,
    hLo: 80,
    hHi: 92,
    // par 4: breathe, breathe, breathe, wait  (breathing warms it, so cool back)
    par: 4,
  },
  {
    id: 2,
    name: "Warm & muggy",
    brief: "A warm, sticky greenhouse: high temp AND mid-high humidity.",
    start: { t: 0, temp: BASE_TEMP, hum: BASE_HUM },
    tLo: 32,
    tHi: 34,
    hLo: 48,
    hHi: 56,
    // par 3: breathe, heat, heat (heater dries, so add moisture first)
    par: 3,
  },
  {
    id: 3,
    name: "Tame the storm",
    brief: "It came in HOT and DRENCHED. Cool it below room temp and dry it out.",
    start: { t: 0, temp: 34, hum: 84 },
    tLo: 22,
    tHi: 24,
    hLo: 42,
    hHi: 54,
    // par 5: fan, wait, wait, wait, fan — target sits BELOW baseline,
    // so just waiting overshoots; you must actively fan.
    par: 5,
  },
] as const;

/** Weather scene chosen from the live readings — the "describe it" payoff. */
function describeScene(r: Reading): { emoji: string; word: string } {
  if (r.hum > 80) return { emoji: "🌧️", word: "Rainy" };
  if (r.hum >= 65) return { emoji: "☁️", word: "Cloudy" };
  if (r.temp >= 32) return { emoji: "🌡️", word: "Hot" };
  if (r.temp < 24) return { emoji: "🌬️", word: "Breezy" };
  return { emoji: "☀️", word: "Clear" };
}

const inBand = (r: Reading, rd: Round): boolean =>
  r.temp >= rd.tLo && r.temp <= rd.tHi && r.hum >= rd.hLo && r.hum <= rd.hHi;

/** Run a plan deterministically from a round's start; return every reading. */
function simulate(rd: Round, plan: ActionId[]): Reading[] {
  const trail: Reading[] = [rd.start];
  let cur = rd.start;
  for (const id of plan) {
    const next = ACTION_BY_ID[id].apply(cur);
    cur = { t: cur.t + 1, temp: next.temp, hum: next.hum };
    trail.push(cur);
  }
  return trail;
}

type Phase = "planning" | "running" | "roundWon" | "miss" | "allWon";

export default function WeatherStation({ onComplete }: ActivityProps) {
  const [roundIdx, setRoundIdx] = useState<number>(0);
  const [plan, setPlan] = useState<ActionId[]>([]);
  const [phase, setPhase] = useState<Phase>("planning");
  /** The reading currently shown on the LCD/scene (the live cursor). */
  const [shown, setShown] = useState<Reading>(ROUNDS[0].start);
  /** Readings revealed so far during a RUN (drives the log + sparkline). */
  const [trail, setTrail] = useState<Reading[]>([ROUNDS[0].start]);
  /** Stars earned per solved round (3 = par, 2 = a little over, 1 = sloppy). */
  const [roundStars, setRoundStars] = useState<number[]>([]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportedRef = useRef<boolean>(false);

  const round = ROUNDS[roundIdx];
  const scene = describeScene(shown);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => () => clearTimer(), [clearTimer]);

  const planning = phase === "planning";
  const running = phase === "running";
  const allWon = phase === "allWon";
  const locked = running || allWon;

  // Fresh round: reset cursor + log to this round's start.
  const loadRound = useCallback((idx: number) => {
    clearTimer();
    setPlan([]);
    setPhase("planning");
    setShown(ROUNDS[idx].start);
    setTrail([ROUNDS[idx].start]);
  }, [clearTimer]);

  const addAction = useCallback(
    (id: ActionId) => {
      if (!planning) {
        // After a miss, the first tap starts a fresh plan from this round's start.
        if (phase === "miss") {
          clearTimer();
          setShown(round.start);
          setTrail([round.start]);
          setPhase("planning");
          setPlan([id]);
          return;
        }
        return;
      }
      setPlan((p) => (p.length >= MAX_PLAN ? p : [...p, id]));
    },
    [planning, phase, round.start, clearTimer],
  );

  const undo = useCallback(() => {
    if (!planning) return;
    setPlan((p) => p.slice(0, -1));
  }, [planning]);

  const clearPlan = useCallback(() => {
    if (!planning) return;
    setPlan([]);
    setShown(round.start);
    setTrail([round.start]);
  }, [planning, round.start]);

  // Award stars for THIS round based on how close to par the plan was.
  const starsForPlan = useCallback(
    (rd: Round, planLen: number): number => {
      if (planLen <= rd.par) return 3;
      if (planLen <= rd.par + 2) return 2;
      return 1;
    },
    [],
  );

  const advance = useCallback(
    (earned: number) => {
      const last = roundIdx >= ROUNDS.length - 1;
      const nextStars = [...roundStars, earned];
      setRoundStars(nextStars);
      if (last) {
        setPhase("allWon");
        if (!reportedRef.current) {
          reportedRef.current = true;
          // Final stars = the WORST round (you only get 3 if every round was clean).
          const finalStars = Math.min(...nextStars) as 1 | 2 | 3;
          onComplete({
            passed: true,
            stars: finalStars,
            detail:
              finalStars === 3
                ? "Three forecasts nailed at par — efficient weather wizard! ⭐⭐⭐"
                : "All three target bands reached — try fewer moves for more stars.",
          });
        }
      } else {
        setPhase("roundWon");
        timerRef.current = setTimeout(() => {
          setRoundIdx((i) => {
            const ni = i + 1;
            setPlan([]);
            setPhase("planning");
            setShown(ROUNDS[ni].start);
            setTrail([ROUNDS[ni].start]);
            return ni;
          });
        }, 1300);
      }
    },
    [roundIdx, roundStars, onComplete],
  );

  const run = useCallback(() => {
    if (!planning || plan.length === 0) return;
    clearTimer();
    const full = simulate(round, plan);
    const landed = full[full.length - 1];
    const success = inBand(landed, round);
    const earned = success ? starsForPlan(round, plan.length) : 0;

    setPhase("running");
    setShown(full[0]);
    setTrail([full[0]]);

    let i = 0;
    const tick = (): void => {
      i += 1;
      if (i >= full.length) {
        if (success) {
          advance(earned);
        } else {
          // Gentle miss: keep the plan so they can tweak it. No onComplete.
          setPhase("miss");
        }
        return;
      }
      setShown(full[i]);
      setTrail(full.slice(0, i + 1));
      timerRef.current = setTimeout(tick, STEP_MS);
    };
    timerRef.current = setTimeout(tick, STEP_MS);
  }, [planning, plan, round, clearTimer, starsForPlan, advance]);

  const resetAll = useCallback(() => {
    clearTimer();
    reportedRef.current = false;
    setRoundStars([]);
    setRoundIdx(0);
    loadRound(0);
  }, [clearTimer, loadRound]);

  // ----- derived display bits -----
  const tempInBandLcd =
    shown.temp >= COMFORT_TEMP_LO && shown.temp <= COMFORT_TEMP_HI;
  const humInBandLcd =
    shown.hum >= COMFORT_HUM_LO && shown.hum <= COMFORT_HUM_HI;
  const tempOnTarget = shown.temp >= round.tLo && shown.temp <= round.tHi;
  const humOnTarget = shown.hum >= round.hLo && shown.hum <= round.hHi;
  const tempColor = tempOnTarget ? ACCENT : tempInBandLcd ? "#22d3ee" : "#f87171";
  const humColor = humOnTarget ? ACCENT : humInBandLcd ? "#22d3ee" : "#22d3ee";

  const statusChip = useMemo<{ text: string; color: string }>(() => {
    if (running) return { text: "Reading…", color: ACCENT };
    if (phase === "miss") return { text: "Off target", color: "#f87171" };
    if (tempOnTarget && humOnTarget) return { text: "ON TARGET", color: ACCENT };
    return { text: round.name, color: "#9aa6b2" };
  }, [running, phase, tempOnTarget, humOnTarget, round.name]);

  // Temperature sparkline over the revealed trail.
  const spark = useMemo(() => {
    const W = 200;
    const H = 44;
    const pad = 4;
    const pts = trail.slice(-8);
    const lo = 18;
    const hi = 38;
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
    // Target band as a shaded horizontal strip.
    const bandY = (v: number): number =>
      H - pad - clamp((v - lo) / (hi - lo), 0, 1) * (H - pad * 2);
    const yTop = bandY(round.tHi);
    const yBot = bandY(round.tLo);
    return { W, H, d, lx, ly, yTop, bandH: Math.max(2, yBot - yTop) };
  }, [trail, round.tLo, round.tHi]);

  const overPar = plan.length - round.par;

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink">
      <style>{`
        @keyframes g4ws-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g4ws-rain {
          0% { transform: translateY(-2px); opacity: 0; }
          40% { opacity: 1; }
          100% { transform: translateY(10px); opacity: 0; }
        }
        @keyframes g4ws-pulse { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
        @keyframes g4ws-win {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g4ws-snap {
          0% { transform: translateY(-8px) scale(0.5); opacity: 0; }
          60% { transform: translateY(2px) scale(1.15); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes g4ws-cursorpulse {
          0%,100% { transform: scale(1); }
          50% { transform: scale(1.3); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-g4ws-anim] { animation: none !important; }
        }
      `}</style>

      {/* ---------------- ROUND HEADER ---------------- */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5">
          {ROUNDS.map((r, i) => {
            const solved = i < roundIdx || allWon;
            const cur = i === roundIdx && !allWon;
            return (
              <span
                key={r.id}
                aria-hidden
                className="grid h-3.5 w-3.5 place-items-center rounded-full"
                style={{
                  background: solved
                    ? ACCENT
                    : cur
                      ? "rgba(168,85,247,0.25)"
                      : "rgba(255,255,255,0.06)",
                  border: `2px solid ${solved || cur ? ACCENT : "rgba(120,140,170,0.35)"}`,
                }}
              />
            );
          })}
          <span className="ml-1 text-[11px] uppercase tracking-tech text-ink-faint">
            Round {Math.min(roundIdx + 1, ROUNDS.length)} / {ROUNDS.length}
          </span>
        </div>
        <span className="text-[11px] text-ink-faint">par {round.par} moves</span>
      </div>

      {/* ---------------- TARGET CARD ---------------- */}
      <div
        className="rounded-xl border px-3 py-2"
        style={{ borderColor: "rgba(168,85,247,.4)", background: "rgba(168,85,247,.06)" }}
      >
        <p className="text-sm font-semibold" style={{ color: ACCENT }}>
          🎯 {round.name}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-ink-dim">{round.brief}</p>
        <div className="mt-1.5 flex gap-2 text-[11px] tabular-nums">
          <span
            className="rounded px-2 py-0.5"
            style={{
              background: tempOnTarget ? "rgba(168,85,247,.22)" : "rgba(255,255,255,.05)",
              color: tempOnTarget ? ACCENT : "var(--color-ink-dim,#9aa6b2)",
            }}
          >
            Temp target {round.tLo}–{round.tHi} °C
          </span>
          <span
            className="rounded px-2 py-0.5"
            style={{
              background: humOnTarget ? "rgba(168,85,247,.22)" : "rgba(255,255,255,.05)",
              color: humOnTarget ? ACCENT : "var(--color-ink-dim,#9aa6b2)",
            }}
          >
            Humidity target {round.hLo}–{round.hHi} %
          </span>
        </div>
      </div>

      {/* ---------------- SCENE + LCD ---------------- */}
      <div
        className="panel relative overflow-hidden rounded-xl p-3"
        style={
          allWon ? { boxShadow: `0 0 0 1px ${ACCENT}, 0 0 24px -4px ${ACCENT}` } : undefined
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
                  : scene.word === "Hot"
                    ? "linear-gradient(180deg,#7c2d12,#ea580c)"
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
            data-g4ws-anim
            style={{ animation: "g4ws-pop .35s ease both" }}
          >
            {scene.emoji}
          </span>
          {scene.word === "Rainy" &&
            [0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                aria-hidden
                data-g4ws-anim
                className="absolute text-xs"
                style={{
                  left: `${18 + i * 16}%`,
                  top: "58%",
                  animation: `g4ws-rain 1s linear ${i * 0.18}s infinite`,
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
              {shown.temp.toFixed(0)} °C {tempOnTarget && "✓"}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm tabular-nums">
            <span className="text-ink-faint">Humidity</span>
            <span style={{ color: humColor, textShadow: `0 0 8px ${humColor}` }}>
              {shown.hum.toFixed(0)} % {humOnTarget && "✓"}
            </span>
          </div>
          <div className="mt-1 text-center text-[10px] uppercase tracking-tech text-ink-faint">
            DHT11 · one sensor, two readings
          </div>
        </div>

        {/* temperature sparkline with target band */}
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-tech text-ink-faint">
            <span>Temp trend</span>
            <span>last {Math.min(trail.length, 8)} reads</span>
          </div>
          <svg
            viewBox={`0 0 ${spark.W} ${spark.H}`}
            className="block h-auto w-full"
            role="img"
            aria-label="Sparkline of temperature over recent readings, with the target band shaded"
          >
            <rect
              x={0}
              y={spark.yTop}
              width={spark.W}
              height={spark.bandH}
              fill="rgba(168,85,247,0.16)"
            />
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

      {/* ---------------- ACTION PALETTE ---------------- */}
      <div className="flex gap-2" role="group" aria-label="Add an action to your plan">
        {ACTIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              addAction(a.id);
            }}
            disabled={locked}
            aria-label={`Add ${a.label} to plan — ${a.effect}`}
            title={a.effect}
            className="flex flex-1 flex-col items-center gap-1 rounded-lg border border-line bg-panel/60 px-1 py-2 text-[10px] font-medium text-ink-dim transition active:scale-95 disabled:opacity-40"
            style={{ touchAction: "manipulation" }}
          >
            <span aria-hidden className="text-xl">
              {a.glyph}
            </span>
            <span className="leading-tight">{a.short}</span>
          </button>
        ))}
      </div>
      <p className="-mt-1 px-1 text-[10px] leading-snug text-ink-faint">
        Every action moves <span style={{ color: ACCENT }}>both</span> readings — and
        they fight you. Plan the order, then run it.
      </p>

      {/* ---------------- PLAN STRIP ---------------- */}
      <div
        className="flex min-h-[46px] flex-wrap items-center gap-1.5 rounded-xl px-3 py-2"
        style={{ background: "rgba(255,255,255,0.04)", border: "2px dashed var(--color-line,#33405c)" }}
        aria-label="Your plan of actions, in order"
      >
        {plan.length === 0 ? (
          <span className="text-[11px] text-ink-faint">
            Tap actions to build a plan…
          </span>
        ) : (
          plan.map((id, i) => (
            <span
              key={i}
              data-g4ws-anim
              aria-label={`Step ${i + 1}: ${ACTION_BY_ID[id].label}`}
              className="grid h-8 w-8 place-items-center rounded-lg text-base"
              style={{
                background: "rgba(168,85,247,0.12)",
                border: `1.5px solid ${ACCENT}`,
                animation: "g4ws-snap .4s cubic-bezier(.34,1.56,.64,1) both",
              }}
            >
              <span aria-hidden>{ACTION_BY_ID[id].glyph}</span>
            </span>
          ))
        )}
        {plan.length > 0 && (
          <span className="ml-auto text-[10px] tabular-nums text-ink-faint">
            {plan.length} move{plan.length === 1 ? "" : "s"}
            {overPar > 0 && (
              <span style={{ color: "#f59e0b" }}> · {overPar} over par</span>
            )}
            {overPar <= 0 && plan.length > 0 && (
              <span style={{ color: ACCENT }}> · at par ✦</span>
            )}
          </span>
        )}
      </div>

      {/* ---------------- CONTROLS ---------------- */}
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            undo();
          }}
          disabled={!planning || plan.length === 0}
          aria-label="Remove the last action"
          className="grid h-11 w-12 place-items-center rounded-lg border border-line bg-panel/60 text-lg active:scale-90 disabled:opacity-30"
          style={{ touchAction: "manipulation" }}
        >
          <span aria-hidden>⬅️</span>
        </button>
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            run();
          }}
          disabled={!planning || plan.length === 0}
          aria-label="Run the plan and watch the readings"
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-bold active:scale-95 disabled:opacity-40"
          style={{
            touchAction: "manipulation",
            background: ACCENT,
            color: "#0a0512",
          }}
        >
          <span aria-hidden>{running ? "⛅" : "▶"}</span>
          {running ? "Reading…" : "RUN PLAN"}
        </button>
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            clearPlan();
          }}
          disabled={!planning || plan.length === 0}
          aria-label="Clear the plan"
          className="grid h-11 w-12 place-items-center rounded-lg border border-line bg-panel/60 text-base active:scale-90 disabled:opacity-30"
          style={{ touchAction: "manipulation" }}
        >
          <span aria-hidden>🧹</span>
        </button>
      </div>

      {/* ---------------- DATA LOG ---------------- */}
      <div className="panel rounded-xl p-2">
        <p className="mb-1 px-1 text-[11px] uppercase tracking-tech text-ink-faint">
          Data log
        </p>
        <div className="max-h-32 overflow-y-auto">
          <table className="w-full text-left text-[11px] tabular-nums">
            <thead>
              <tr className="text-ink-faint">
                <th className="px-1 py-0.5 font-normal">#</th>
                <th className="px-1 py-0.5 font-normal">Temp</th>
                <th className="px-1 py-0.5 font-normal">Humidity</th>
              </tr>
            </thead>
            <tbody>
              {trail.map((r, i) => {
                const last = i === trail.length - 1;
                const hit = inBand(r, round);
                return (
                  <tr
                    key={i}
                    className="border-t border-line/60"
                    style={
                      last && hit
                        ? { background: "rgba(168,85,247,.16)", color: ACCENT }
                        : { color: "var(--color-ink-dim,#9aa6b2)" }
                    }
                  >
                    <td className="px-1 py-0.5">{r.t}</td>
                    <td className="px-1 py-0.5">{r.temp.toFixed(0)} °C</td>
                    <td className="px-1 py-0.5">
                      {r.hum.toFixed(0)} %
                      {last && hit && <span className="ml-1 text-[9px]">✓ on target</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------- FEEDBACK / WIN ---------------- */}
      {allWon ? (
        <div
          className="panel rounded-xl p-3 text-center"
          data-g4ws-anim
          style={{ border: `1px solid ${ACCENT}`, animation: "g4ws-win .4s ease both" }}
        >
          <div className="text-2xl">
            ✨🎉 {Array.from({ length: Math.min(...roundStars) }, () => "⭐").join("")}
          </div>
          <p className="mt-1 text-sm font-semibold" style={{ color: ACCENT }}>
            All three forecasts dialed in!
          </p>
          <p className="mt-0.5 text-[11px] text-ink-dim">
            {Math.min(...roundStars) === 3
              ? "You hit every target band at par — one sensor, total control. ⭐⭐⭐"
              : "Every band reached! Replay and solve each round in fewer moves for 3 stars."}
          </p>
        </div>
      ) : phase === "roundWon" ? (
        <p
          className="rounded-lg px-3 py-2 text-center text-sm font-semibold"
          style={{ background: "rgba(168,85,247,.12)", color: ACCENT }}
          role="status"
          aria-live="polite"
        >
          ✓ Round {round.id} solved in {plan.length} move{plan.length === 1 ? "" : "s"}!
          Next round loading…
        </p>
      ) : phase === "miss" ? (
        <p
          className="rounded-lg px-3 py-2 text-[12px] leading-snug"
          style={{ background: "rgba(248,113,113,.1)", color: "#fca5a5" }}
          role="status"
          aria-live="polite"
        >
          So close — the final reading landed{" "}
          {!tempOnTarget && (
            <b>{shown.temp < round.tLo ? "too cool" : "too warm"}</b>
          )}
          {!tempOnTarget && !humOnTarget && " and "}
          {!humOnTarget && (
            <b>{shown.hum < round.hLo ? "too dry" : "too humid"}</b>
          )}
          . Tweak your plan (⬅️ to undo) and run again.
        </p>
      ) : (
        <p className="px-1 text-[11px] leading-snug text-ink-faint">
          <span style={{ color: ACCENT }}>Tip:</span>{" "}
          {round.id === 1
            ? "Breathing makes it rain — but warm breath nudges temp up too. End with a Wait to cool back into range."
            : round.id === 2
              ? "The heater warms but DRIES the air. Add moisture first, then heat to hit both targets."
              : "Just waiting drifts toward the room (26°C) — but the target is COOLER than that. You'll have to fan it down."}
        </p>
      )}

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={resetAll}
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
          aria-label="Start over from round one"
        >
          🔄 Reset
        </button>
      </div>
    </div>
  );
}
