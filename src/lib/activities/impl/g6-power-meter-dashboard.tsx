"use client";
import type { ActivityProps } from "@/lib/activities/types";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Power Meter Dashboard — Power = V × A, Energy = Σ Power × time      */
/*  CLASS 4-6 (explorer). Learning goal: see that adding power over     */
/*  time gives energy (kWh) and that kWh × rate is the electricity bill.*/
/*                                                                      */
/*  This is a PLAN-then-RUN optimisation problem across 4 rounds.       */
/*  The learner does not fiddle live — they DESIGN a 12-slot heater     */
/*  schedule (plus which other appliances run) BEFORE pressing Run, the */
/*  hour then plays out deterministically and the meter is revealed.    */
/*                                                                      */
/*  Three coupled constraints make it a real puzzle, not one obvious    */
/*  tap, AND there are MANY valid plans — so it becomes an OPTIMISATION  */
/*  problem (place the ticks well to keep the most budget):             */
/*   • the room must end WARM ENOUGH (final comfort ≥ threshold), AND   */
/*   • it must never freeze mid-hour (comfort never hits 0), AND        */
/*   • the bill must stay ≤ the cap.                                    */
/*  Because the heater is the only warmth AND by far the biggest load,  */
/*  you must place its ON-ticks cleverly: clumped wrong → the room      */
/*  freezes early OR warmth overflows the 100 ceiling and is WASTED, so */
/*  a sloppy plan needs more ticks and a bigger bill than a smart one.  */
/*                                                                      */
/*  Escalation + guess-defeating twists:                                */
/*   R1  warm-ish start, gentle cooling — learn the mechanic.           */
/*   R2  COLD start + fast cooling — you must pre-heat, can't leave it   */
/*       all to the end (the lazy "burst at the end" plan freezes).     */
/*   R3  a VENT RULE: the fan must run (stealing budget), so the heater  */
/*       schedule has to be lean — pure efficiency.                     */
/*   R4  MASTER: cold-ish start + fast cooling + vent rule + a tight     */
/*       cap, all at once. The lazy end-burst FREEZES, forgetting the    */
/*       fan breaks the rule, and warmth wasted against the 100 ceiling  */
/*       blows the bill — only a well-PLACED plan keeps margin to spare. */
/*                                                                      */
/*  Optimisation: meeting the goal passes (★★); finishing with a healthy */
/*  bill MARGIN under the cap earns the third star. Because warmth clamps */
/*  at 100, clumsy placement wastes heat → smaller margin → fewer stars. */
/*  A sloppy win still passes; a clever, well-placed plan earns ★★★.    */
/* ------------------------------------------------------------------ */

const ACCENT = "#a855f7";
const RED = "#f87171";
const GREEN = "#34d399";
const AMBER = "#fbbf24";
const VOLTS = 230;

/** A 1-hour session is split into 12 five-minute ticks. */
const TICKS = 12;
const TICK_HOURS = 1 / TICKS;
const COMFORT_THRESHOLD = 60;
const TICK_MS = 420;

type ApplianceId = "bulb" | "fan" | "heater";

interface Appliance {
  id: ApplianceId;
  name: string;
  emoji: string;
  watts: number;
}

const APPLIANCES: readonly Appliance[] = [
  { id: "bulb", name: "LED bulb", emoji: "💡", watts: 10 },
  { id: "fan", name: "Fan", emoji: "🌀", watts: 60 },
  { id: "heater", name: "Heater", emoji: "🔥", watts: 1000 },
] as const;
const HEATER = APPLIANCES[2];

/** Amps drawn by a wattage at the fixed 230V supply. I = P / V. */
function amps(watts: number): number {
  return watts / VOLTS;
}

/* ---------------- Rounds ---------------- */
interface Round {
  title: string;
  brief: string;
  /** ₹ per kWh tariff for this round. */
  rate: number;
  /** kWh the bill cap allows → cap₹ = rate × this. */
  energyBudget: number;
  /** comfort at minute 0. */
  startComfort: number;
  /** comfort gained per tick the heater is ON. */
  warmPerTick: number;
  /** comfort lost per tick the heater is OFF. */
  coolPerTick: number;
  /** fan must be ON for the hour when this is true (vent rule). */
  fanRule: boolean;
  /** finishing with this much ₹ left under the cap (or more) earns the 3rd star. */
  starMargin: number;
}

/* All four rounds are HAND-TUNED & brute-force-verified solvable AND
   3-star-achievable AND 2-star-also-possible (an honest optimisation gap).
   warmPerTick / coolPerTick / startComfort decide how many heater ticks you
   need and where they can sit; energyBudget decides how many you can AFFORD;
   starMargin decides how lean/well-placed a plan must be for the 3rd star. */
const ROUNDS: readonly Round[] = [
  {
    // R1: start 55, cool 6, warm 12. Land net heat ≥60 to end warm.
    // Heater for ~5 of 12 ticks. Lots of room → easy to discover the mechanic.
    // 3-star: keep ≥ ₹2.00 under the cap (a tight, well-placed plan).
    title: "Round 1 · Warm-up",
    brief: "Keep the room ≥ 60 warmth and the bill under the cap. Plan when the heater runs.",
    rate: 10,
    energyBudget: 0.8,
    startComfort: 55,
    warmPerTick: 12,
    coolPerTick: 6,
    fanRule: false,
    starMargin: 2.0,
  },
  {
    // R2: COLD start 28, fast cool 9, warm 11. Leave heating to the end and the
    // room hits 0 early → frozen. You MUST pre-heat. ~7 ticks placed so it never
    // freezes & ends ≥60. 3-star: keep ≥ ₹1.00 under the cap.
    title: "Round 2 · Cold snap ❄️",
    brief: "It starts FREEZING and cools fast. Heat early — don't let warmth hit 0, and still end ≥ 60.",
    rate: 11,
    energyBudget: 0.72,
    startComfort: 28,
    warmPerTick: 11,
    coolPerTick: 9,
    fanRule: false,
    starMargin: 1.0,
  },
  {
    // R3: VENT RULE — fan ON (60W → 0.06 kWh) eats into the budget, so the
    // heater plan must be lean. start 45, cool 7, warm 12, budget 0.66.
    // 3-star: keep ≥ ₹0.80 under the cap with the fan stealing budget.
    title: "Round 3 · Vent rule 🌀",
    brief: "Safety: the FAN must run all hour. That steals budget — so place every heater tick to count.",
    rate: 12,
    energyBudget: 0.66,
    startComfort: 45,
    warmPerTick: 12,
    coolPerTick: 7,
    fanRule: true,
    starMargin: 0.8,
  },
  {
    // R4: MASTER — every twist at once. Cold-ish start 34, fast cool 8, warm 11,
    // VENT RULE on, tight cap. The lazy end-burst FREEZES (warmth hits 0 mid-hour);
    // forgetting the fan breaks the rule; clumping early overflows the 100 ceiling
    // and wastes heat → bigger bill. ~7 ticks placed early-but-spread end exactly
    // ≥60, never freeze, and (best plan) leave ~₹1.16 under the cap.
    // 3-star: keep ≥ ₹1.00 under the cap — a genuinely well-placed plan.
    title: "Round 4 · Master ⚡",
    brief: "Everything at once: freezing start, fast cooling, fan rule, tight cap. Plan every tick — don't waste heat past full warmth.",
    rate: 12,
    energyBudget: 0.74,
    startComfort: 34,
    warmPerTick: 11,
    coolPerTick: 8,
    fanRule: true,
    starMargin: 1.0,
  },
] as const;

type Phase = "plan" | "running" | "result";
type OnState = Record<ApplianceId, boolean>;

interface SimResult {
  energy: number; // kWh
  cost: number; // ₹
  endComfort: number;
  minComfort: number; // lowest the room ever got
  froze: boolean;
  heaterTicks: number;
  fanTicks: number;
  comfortSeries: number[]; // length TICKS+1 (incl. start)
  wattSeries: number[]; // length TICKS
}

/** Deterministically simulate the whole hour from a heater schedule + which
 *  other appliances are on (constant across the hour). No randomness. */
function simulate(
  round: Round,
  schedule: boolean[],
  bulbOn: boolean,
  fanOn: boolean,
): SimResult {
  const baseW = (bulbOn ? APPLIANCES[0].watts : 0) + (fanOn ? APPLIANCES[1].watts : 0);
  let acc = 0;
  let cm = round.startComfort;
  let minC = cm;
  let heaterTicks = 0;
  const comfortSeries: number[] = [cm];
  const wattSeries: number[] = [];
  for (let t = 0; t < TICKS; t++) {
    const hOn = schedule[t];
    if (hOn) heaterTicks += 1;
    const w = baseW + (hOn ? HEATER.watts : 0);
    acc += (w * TICK_HOURS) / 1000;
    cm += hOn ? round.warmPerTick : -round.coolPerTick;
    cm = Math.max(0, Math.min(100, cm));
    minC = Math.min(minC, cm);
    comfortSeries.push(cm);
    wattSeries.push(w);
  }
  const cost = Math.round(acc * round.rate * 100) / 100;
  return {
    energy: acc,
    cost,
    endComfort: cm,
    minComfort: minC,
    froze: minC <= 0,
    heaterTicks,
    fanTicks: fanOn ? TICKS : 0,
    comfortSeries,
    wattSeries,
  };
}

export default function PowerMeterDashboard({ onComplete }: ActivityProps) {
  const [roundIdx, setRoundIdx] = useState<number>(0);
  const round = ROUNDS[roundIdx];

  const [schedule, setSchedule] = useState<boolean[]>(() => Array(TICKS).fill(false));
  const [bulbOn, setBulbOn] = useState<boolean>(false);
  const [fanOn, setFanOn] = useState<boolean>(false);

  const [phase, setPhase] = useState<Phase>("plan");
  const [playTick, setPlayTick] = useState<number>(0); // how many ticks revealed
  const [starsEarned, setStarsEarned] = useState<number>(0); // best stars across rounds (min)

  const reportedRef = useRef<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const starsRef = useRef<number>(3); // running min of per-round stars

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => stopTimer, [stopTimer]);

  const cap = useMemo(
    () => Math.round(round.rate * round.energyBudget * 100) / 100,
    [round],
  );

  // The full deterministic outcome of the CURRENT plan (used for the live
  // preview meter while planning AND the played-back reveal).
  const sim = useMemo(
    () => simulate(round, schedule, bulbOn, fanOn),
    [round, schedule, bulbOn, fanOn],
  );

  // ---- live pre-run readings of the chosen switch positions (steady state) ----
  // Power shown reflects "everything currently planned to be ON right now" —
  // for the V×A tile we show the steady load with heater counted as ON so the
  // learner sees its huge current. Use the max load (heater on) for teaching.
  const liveWatts =
    (bulbOn ? APPLIANCES[0].watts : 0) +
    (fanOn ? APPLIANCES[1].watts : 0) +
    HEATER.watts;
  const liveAmps = amps(liveWatts);

  const heaterCount = useMemo(
    () => schedule.reduce((n, b) => n + (b ? 1 : 0), 0),
    [schedule],
  );

  /** Per-round stars from a passing result: 3 if the bill finished with a
   *  healthy margin under the cap (a lean, well-placed plan), else 2. */
  const starsFor = useCallback(
    (result: SimResult): 2 | 3 =>
      cap - result.cost >= round.starMargin - 1e-6 ? 3 : 2,
    [cap, round],
  );

  // Grade the current plan deterministically.
  const grade = useMemo(() => {
    const fanRuleMet = !round.fanRule || fanOn;
    const warmOk = sim.endComfort >= COMFORT_THRESHOLD;
    const noFreeze = !sim.froze;
    const costOk = sim.cost <= cap + 1e-6;
    const passed = warmOk && noFreeze && costOk && fanRuleMet;
    // Optimisation stars: 3 = healthy ₹ margin, 2 = passes but tight, 1 floor.
    let stars: 1 | 2 | 3 = 1;
    if (passed) stars = starsFor(sim);
    const margin = Math.round((cap - sim.cost) * 100) / 100;
    return { passed, stars, warmOk, noFreeze, costOk, fanRuleMet, margin };
  }, [sim, round, cap, fanOn, starsFor]);

  // ---- reveal-aware derived values (during running we show partial state) ----
  const revealed = phase === "running" ? playTick : phase === "result" ? TICKS : 0;
  const energyNow =
    phase === "plan"
      ? sim.energy
      : sim.wattSeries.slice(0, revealed).reduce((s, w) => s + (w * TICK_HOURS) / 1000, 0);
  const costNow = Math.round(energyNow * round.rate * 100) / 100;
  const comfortNow =
    phase === "plan"
      ? round.startComfort
      : sim.comfortSeries[Math.min(revealed, TICKS)];

  const isLastRound = roundIdx === ROUNDS.length - 1;
  const won = phase === "result" && grade.passed;
  const lost = phase === "result" && !grade.passed;
  const costOver = (phase === "plan" ? sim.cost : costNow) > cap + 1e-6;
  const meterColor = won ? GREEN : costOver ? RED : ACCENT;

  const toggleSlot = useCallback(
    (i: number) => {
      if (phase !== "plan") return;
      setSchedule((prev) => {
        const next = prev.slice();
        next[i] = !next[i];
        return next;
      });
    },
    [phase],
  );

  const toggleBulb = useCallback(() => {
    if (phase !== "plan") return;
    setBulbOn((p) => !p);
  }, [phase]);
  const toggleFan = useCallback(() => {
    if (phase !== "plan") return;
    setFanOn((p) => !p);
  }, [phase]);

  const clearPlan = useCallback(() => {
    if (phase !== "plan") return;
    setSchedule(Array(TICKS).fill(false));
  }, [phase]);

  // Run the planned hour: play it back tick by tick, then settle on result.
  const run = useCallback(() => {
    stopTimer();
    setPhase("running");
    setPlayTick(0);
    let t = 0;
    timerRef.current = setInterval(() => {
      t += 1;
      setPlayTick(t);
      if (t >= TICKS) {
        stopTimer();
        // Settle into the result on the next frame so the last tick paints.
        setPhase("result");
        const result = simulate(round, schedule, bulbOn, fanOn);
        const fanRuleMet = !round.fanRule || fanOn;
        const passed =
          result.endComfort >= COMFORT_THRESHOLD &&
          !result.froze &&
          result.cost <= cap + 1e-6 &&
          fanRuleMet;
        if (passed) {
          const roundStars: 1 | 2 | 3 = starsFor(result);
          starsRef.current = Math.min(starsRef.current, roundStars) as 1 | 2 | 3;
          setStarsEarned(starsRef.current);
          if (isLastRound && !reportedRef.current) {
            reportedRef.current = true;
            const finalStars = starsRef.current as 1 | 2 | 3;
            onComplete({
              passed: true,
              stars: finalStars,
              detail:
                finalStars === 3
                  ? "All 4 rounds solved with lean, well-placed plans — you mastered kWh = power × time, never wasted heat past full warmth, and kept healthy margin under every bill cap!"
                  : "All 4 rounds solved! You added power over time into kWh and beat each bill cap. (Place ticks so no heat is wasted past 100 warmth to leave more budget and earn full stars.)",
            });
          }
        }
        // never call onComplete(passed:false) — gentle retry instead.
      }
    }, TICK_MS);
  }, [stopTimer, round, schedule, bulbOn, fanOn, cap, isLastRound, onComplete, starsFor]);

  const retry = useCallback(() => {
    stopTimer();
    setPhase("plan");
    setPlayTick(0);
  }, [stopTimer]);

  const nextRound = useCallback(() => {
    stopTimer();
    setRoundIdx((i) => Math.min(i + 1, ROUNDS.length - 1));
    setSchedule(Array(TICKS).fill(false));
    setBulbOn(false);
    setFanOn(false);
    setPhase("plan");
    setPlayTick(0);
  }, [stopTimer]);

  const running = phase === "running";
  const clockLabel = `${String(revealed * 5).padStart(2, "0")} min of 60`;

  // ---- status line ----
  const status = useMemo(() => {
    if (running) return `Running the hour… ${clockLabel}`;
    if (won) {
      const starNote =
        grade.stars === 3
          ? ""
          : ` Lean it up (leave ≥ ₹${round.starMargin.toFixed(2)} under the cap) for the 3rd star.`;
      return isLastRound
        ? "All rounds complete! ✨ You read the meter and beat every bill."
        : `Solved! ✅ Tap Next round for a tougher challenge.${starNote}`;
    }
    if (lost) {
      if (!grade.fanRuleMet) return "Vent rule broken — switch the fan ON before running.";
      if (sim.froze) return "The room FROZE (warmth hit 0). Heat earlier in the hour.";
      if (!grade.warmOk) return "Ended too cold. Add more heater ticks (or move them later).";
      if (!grade.costOk) return "Bill blew the cap. Use FEWER heater ticks — it's 100× the bulb.";
      return "Not quite — tweak your plan and run again.";
    }
    return "Plan the heater schedule, then press Run ▶ to play the hour.";
  }, [running, clockLabel, won, lost, isLastRound, grade, sim.froze, round.starMargin]);

  // ---- line chart geometry (wattage over the session) ----
  const CW = 300;
  const CH = 70;
  const maxW = 1100;
  const chartSeries = phase === "plan" ? sim.wattSeries : sim.wattSeries.slice(0, revealed);
  const chartPts = useMemo(() => {
    if (chartSeries.length === 0) return "";
    return chartSeries
      .map((w, i) => {
        const x = (i / (TICKS - 1)) * CW;
        const y = CH - (w / maxW) * CH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [chartSeries]);

  // windows lit: during reveal use the live tick's appliances; while planning,
  // show heater-on if any tick uses it (so the house looks "in use").
  const heaterLitNow =
    phase === "plan" ? heaterCount > 0 : revealed > 0 && revealed <= TICKS ? sim.wattSeries[revealed - 1] >= HEATER.watts : false;
  const windowLit: OnState = {
    bulb: bulbOn,
    fan: fanOn,
    heater: heaterLitNow,
  };

  const pulseStyle: CSSProperties | undefined = undefined;

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink">
      <style>{`
        @keyframes g6powermeterdashboard-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g6powermeterdashboard-needle {
          0%,100% { transform: translateX(0); }
          50% { transform: translateX(0.6px); }
        }
        @keyframes g6powermeterdashboard-pulse {
          0%,100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        @media (prefers-reduced-motion: reduce) {
          .g6pm-anim { animation: none !important; }
        }
      `}</style>

      {/* ---------------- ROUND HEADER ---------------- */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {ROUNDS.map((_, i) => (
            <span
              key={i}
              aria-hidden
              className="h-1.5 w-5 rounded-full"
              style={{
                background:
                  i < roundIdx || (i === roundIdx && won)
                    ? GREEN
                    : i === roundIdx
                      ? ACCENT
                      : "var(--color-line)",
              }}
            />
          ))}
        </div>
        <span className="text-[11px] text-ink-faint">
          Round {roundIdx + 1} / {ROUNDS.length}
        </span>
      </div>
      <div className="rounded-lg border border-line bg-panel-2/40 px-3 py-2">
        <p className="text-sm font-semibold" style={{ color: ACCENT }}>
          {round.title}
        </p>
        <p className="mt-0.5 text-[11px] text-ink-dim">{round.brief}</p>
      </div>

      {/* ---------------- DASHBOARD CANVAS ---------------- */}
      <div
        className="panel relative overflow-hidden rounded-xl p-3"
        style={
          won
            ? { boxShadow: `0 0 0 1px ${GREEN}, 0 0 24px -4px ${GREEN}` }
            : costOver
              ? { boxShadow: `0 0 0 1px ${RED}, 0 0 20px -6px ${RED}` }
              : undefined
        }
      >
        <svg
          viewBox="0 0 320 150"
          className="block h-auto w-full"
          role="img"
          aria-label="Smart meter: house with appliances, ammeter and voltmeter"
        >
          {/* house */}
          <g>
            <path d="M16 60 L60 26 L104 60 Z" fill="#11182f" stroke="#1e2a44" strokeWidth={1.5} />
            <rect x={24} y={60} width={72} height={58} rx={3} fill="#0b1020" stroke="#1e2a44" strokeWidth={1.5} />
            {APPLIANCES.map((a, i) => {
              const lit = windowLit[a.id];
              return (
                <g key={a.id}>
                  <rect
                    x={32 + i * 22}
                    y={74}
                    width={16}
                    height={16}
                    rx={2}
                    fill={lit ? ACCENT : "#0b1020"}
                    fillOpacity={lit ? 0.85 : 1}
                    stroke="#1e2a44"
                    strokeWidth={1}
                    className={running && lit ? "g6pm-anim" : undefined}
                    style={running && lit ? { animation: "g6powermeterdashboard-pulse 1.2s ease-in-out infinite" } : pulseStyle}
                  />
                  <text x={40 + i * 22} y={87} fontSize={11} textAnchor="middle">
                    {lit ? a.emoji : ""}
                  </text>
                </g>
              );
            })}
            {/* warmth bar inside the house */}
            <rect x={32} y={100} width={56} height={8} rx={4} fill="#0b1020" stroke="#1e2a44" strokeWidth={1} />
            <rect
              x={32}
              y={100}
              width={(56 * comfortNow) / 100}
              height={8}
              rx={4}
              fill={comfortNow >= COMFORT_THRESHOLD ? GREEN : comfortNow <= 0 ? RED : AMBER}
            />
          </g>

          {/* supply wire to the meters */}
          <line x1={104} y1={60} x2={132} y2={60} stroke={ACCENT} strokeWidth={2} strokeOpacity={0.6} />

          {/* VOLTMETER — pinned at 230V */}
          <g transform="translate(140 30)">
            <rect width={76} height={42} rx={6} fill="#11182f" stroke="#1e2a44" strokeWidth={1.5} />
            <text x={38} y={15} fontSize={8} fill="#5f7194" textAnchor="middle">VOLTMETER</text>
            <text x={38} y={33} fontSize={15} fill="#22d3ee" textAnchor="middle" className="font-display">
              {VOLTS}V
            </text>
          </g>

          {/* AMMETER — current at full load (heater on) */}
          <g transform="translate(140 80)">
            <rect width={76} height={42} rx={6} fill="#11182f" stroke="#1e2a44" strokeWidth={1.5} />
            <text x={38} y={15} fontSize={8} fill="#5f7194" textAnchor="middle">AMMETER</text>
            <text
              x={38}
              y={33}
              fontSize={15}
              fill={ACCENT}
              textAnchor="middle"
              className={running ? "font-display g6pm-anim" : "font-display"}
              style={running ? { animation: "g6powermeterdashboard-needle 0.5s ease-in-out infinite" } : undefined}
            >
              {liveAmps.toFixed(2)}A
            </text>
          </g>

          {/* meter dial badge */}
          <g transform="translate(232 30)">
            <rect width={80} height={92} rx={8} fill="#0b1020" stroke="#1e2a44" strokeWidth={1.5} />
            <text x={40} y={16} fontSize={8} fill="#5f7194" textAnchor="middle">SMART METER</text>
            <text x={40} y={42} fontSize={9} fill="#9fb0d0" textAnchor="middle">{energyNow.toFixed(3)}</text>
            <text x={40} y={54} fontSize={7} fill="#5f7194" textAnchor="middle">kWh used</text>
            <text x={40} y={76} fontSize={15} fill={meterColor} textAnchor="middle" className="font-display">
              ₹{costNow.toFixed(2)}
            </text>
            <text x={40} y={87} fontSize={7} fill="#5f7194" textAnchor="middle">cap ₹{cap.toFixed(2)}</text>
          </g>
        </svg>

        {/* ---- live calculation tiles ---- */}
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[11px]">
          <div className="rounded-lg border border-line bg-panel-2/60 p-1.5">
            <div className="text-ink-faint">Power = V × A</div>
            <div className="font-display" style={{ color: ACCENT }}>
              {VOLTS}×{liveAmps.toFixed(2)} = {liveWatts}W
            </div>
          </div>
          <div className="rounded-lg border border-line bg-panel-2/60 p-1.5">
            <div className="text-ink-faint">Energy (Σ W×t)</div>
            <div className="font-display" style={{ color: ACCENT }}>
              {energyNow.toFixed(3)} kWh
            </div>
          </div>
          <div className="rounded-lg border border-line bg-panel-2/60 p-1.5">
            <div className="text-ink-faint">Cost = kWh×₹{round.rate}</div>
            <div className="font-display" style={{ color: meterColor }}>
              ₹{costNow.toFixed(2)}
            </div>
          </div>
        </div>

        {/* ---- wattage line chart ---- */}
        <svg
          viewBox={`-2 -6 ${CW + 4} ${CH + 14}`}
          className="mt-2 block h-auto w-full"
          role="img"
          aria-label="Line chart of planned wattage over the simulated hour"
        >
          <line x1={0} y1={CH} x2={CW} y2={CH} stroke="#1e2a44" strokeWidth={1} />
          <text x={0} y={-1} fontSize={7} fill="#5f7194">watts over the hour (your plan)</text>
          {chartPts && (
            <polyline points={chartPts} fill="none" stroke={ACCENT} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
          )}
        </svg>
      </div>

      {/* ---------------- STATUS ---------------- */}
      <div
        className="rounded-lg border px-3 py-2 text-xs"
        role="status"
        aria-live="polite"
        style={{
          borderColor: won ? GREEN : (costOver && (running || lost)) ? RED : "var(--color-line)",
          color: won ? GREEN : "var(--color-ink-dim)",
        }}
      >
        {won && <span aria-hidden>✨ {"⭐".repeat(grade.stars)} </span>}
        {status}
      </div>

      {/* ---------------- OPTIMISE GOAL ---------------- */}
      <div
        className="flex items-center justify-between rounded-lg border px-3 py-2 text-[11px]"
        style={{ borderColor: "var(--color-line)" }}
        aria-label={`Bill so far ₹${(phase === "plan" ? sim.cost : costNow).toFixed(2)}, cap ₹${cap.toFixed(2)}, ${grade.margin >= 0 ? `₹${grade.margin.toFixed(2)} to spare` : "over budget"}. For the third star leave at least ₹${round.starMargin.toFixed(2)} under the cap.`}
      >
        <span className="text-ink-faint">
          🎯 3-star goal: leave ≥ <b style={{ color: AMBER }}>₹{round.starMargin.toFixed(2)}</b> under the cap
        </span>
        <span
          className="font-display"
          style={{ color: grade.margin >= round.starMargin - 1e-6 ? GREEN : grade.margin >= 0 ? AMBER : RED }}
        >
          {grade.margin >= 0 ? `₹${grade.margin.toFixed(2)} to spare` : `₹${(-grade.margin).toFixed(2)} over`}
        </span>
      </div>

      {/* ---------------- HEATER SCHEDULE PLANNER ---------------- */}
      <div className="panel flex flex-col gap-2 rounded-xl p-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-tech text-ink-faint">
            🔥 Heater plan — tap each 5-min slot
          </p>
          <span className="text-[11px] text-ink-faint">
            on {heaterCount}/12
          </span>
        </div>
        <div className="grid grid-cols-12 gap-1" role="group" aria-label="Heater schedule, twelve five-minute slots">
          {schedule.map((slotOn, i) => {
            const isPast = phase !== "plan" && i < revealed;
            const isNow = running && i === revealed - 1;
            return (
              <button
                key={i}
                type="button"
                onPointerDown={() => toggleSlot(i)}
                disabled={phase !== "plan"}
                aria-pressed={slotOn}
                aria-label={`Minute ${i * 5} to ${i * 5 + 5}, heater ${slotOn ? "on" : "off"}`}
                className="flex aspect-square items-center justify-center rounded text-[10px] transition disabled:cursor-default"
                style={{
                  touchAction: "manipulation",
                  border: `1px solid ${isNow ? GREEN : slotOn ? ACCENT : "var(--color-line)"}`,
                  background: slotOn
                    ? isPast
                      ? "color-mix(in srgb, #34d399 26%, transparent)"
                      : "color-mix(in srgb, #a855f7 30%, transparent)"
                    : "var(--color-panel-2)",
                  opacity: phase !== "plan" && i >= revealed ? 0.45 : 1,
                }}
              >
                {slotOn ? "🔥" : ""}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-ink-faint">
          Each 🔥 slot = heater ON for 5 min (+{round.warmPerTick} warmth, big bill). Empty slot = room cools −{round.coolPerTick}. Warmth maxes at 100 — heating a full room WASTES money.
        </p>
      </div>

      {/* ---------------- OTHER APPLIANCES ---------------- */}
      <div className="panel flex flex-col gap-2 rounded-xl p-3">
        <p className="text-[11px] uppercase tracking-tech text-ink-faint">
          Other appliances — run all hour?
        </p>
        {[
          { a: APPLIANCES[0], isOn: bulbOn, toggle: toggleBulb, note: "" },
          {
            a: APPLIANCES[1],
            isOn: fanOn,
            toggle: toggleFan,
            note: round.fanRule ? `must be ON (vent rule)` : "",
          },
        ].map(({ a, isOn, toggle, note }) => (
          <button
            key={a.id}
            type="button"
            onPointerDown={toggle}
            disabled={phase !== "plan"}
            aria-pressed={isOn}
            aria-label={`${a.name}, ${a.watts} watts, ${amps(a.watts).toFixed(2)} amps, currently ${isOn ? "on" : "off"}${note ? `, ${note}` : ""}`}
            className="flex items-center justify-between rounded-lg border px-3 py-2 text-left transition disabled:opacity-70"
            style={{
              touchAction: "manipulation",
              borderColor: isOn ? ACCENT : note ? AMBER : "var(--color-line)",
              background: isOn ? "color-mix(in srgb, #a855f7 14%, transparent)" : "var(--color-panel-2)",
            }}
          >
            <span className="flex items-center gap-2 text-sm text-ink">
              <span aria-hidden className="text-lg">{a.emoji}</span>
              {a.name}
              <span className="text-[11px] text-ink-faint">{a.watts}W · {amps(a.watts).toFixed(2)}A</span>
              {note && (
                <span className="text-[10px] font-semibold" style={{ color: AMBER }}>{note}</span>
              )}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={
                isOn
                  ? { background: ACCENT, color: "#05070d" }
                  : { color: "var(--color-ink-faint)", border: "1px solid var(--color-line)" }
              }
            >
              {isOn ? "ON" : "OFF"}
            </span>
          </button>
        ))}
      </div>

      {/* ---------------- WIN / RETRY PANEL ---------------- */}
      {won && (
        <div
          className="g6pm-anim rounded-lg border p-3 text-center text-xs"
          style={{ borderColor: GREEN, color: "var(--color-ink)", animation: "g6powermeterdashboard-pop 0.4s ease-out" }}
        >
          Final bill <b>₹{sim.cost.toFixed(2)}</b> ≤ cap <b>₹{cap.toFixed(2)}</b>, room ended at{" "}
          <b>{Math.round(sim.endComfort)}</b> warmth.{" "}
          {grade.stars === 3 ? (
            <>Lean plan — ₹{grade.margin.toFixed(2)} to spare! ⭐⭐⭐</>
          ) : (
            <>Only ₹{grade.margin.toFixed(2)} to spare — leave ≥ ₹{round.starMargin.toFixed(2)} (don&apos;t waste heat past full warmth) for full stars.</>
          )}
        </div>
      )}

      {/* ---------------- CONTROLS ---------------- */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink-faint" aria-hidden>
          warmth {Math.round(comfortNow)} / need {COMFORT_THRESHOLD}
        </span>
        <div className="flex gap-2">
          {phase === "plan" && (
            <button
              type="button"
              onClick={clearPlan}
              className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
              aria-label="Clear the heater plan"
            >
              Clear
            </button>
          )}
          {phase === "plan" && (
            <button
              type="button"
              onClick={run}
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: ACCENT, color: "#05070d" }}
              aria-label="Run the planned hour"
            >
              Run hour ▶
            </button>
          )}
          {running && (
            <button
              type="button"
              disabled
              className="rounded-lg px-4 py-2 text-sm font-medium opacity-70"
              style={{ background: ACCENT, color: "#05070d" }}
            >
              {clockLabel}
            </button>
          )}
          {lost && (
            <button
              type="button"
              onClick={retry}
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: ACCENT, color: "#05070d" }}
              aria-label="Adjust your plan and try again"
            >
              Tweak plan ↺
            </button>
          )}
          {won && !isLastRound && (
            <button
              type="button"
              onClick={nextRound}
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: GREEN, color: "#05070d" }}
              aria-label="Go to the next round"
            >
              Next round →
            </button>
          )}
          {won && isLastRound && (
            <span
              className="rounded-lg px-4 py-2 text-sm font-semibold"
              style={{ color: GREEN, border: `1px solid ${GREEN}` }}
            >
              Complete ✨ {"⭐".repeat(starsEarned || grade.stars)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
