"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Power Meter Dashboard — Power = V × A, Energy = Σ Power × time      */
/*  Learning goal: see that adding power over time gives energy (kWh)  */
/*  and that kWh × rate is exactly what the electricity bill charges.  */
/*  The learner toggles appliances through a simulated hour, keeping   */
/*  the room warm enough while landing the cost under a cap.           */
/* ------------------------------------------------------------------ */

const ACCENT = "#a855f7";
const RED = "#f87171";
const GREEN = "#34d399";
const VOLTS = 230;

/** A 1-hour session is split into 12 five-minute ticks. */
const TICKS = 12;
const TICK_HOURS = 1 / TICKS;
/** Energy budget (kWh) → cap rupees = rate × this. Tuned so the heater
 *  run flat-out always fails, but cycling it always wins. */
const ENERGY_BUDGET = 0.8;
const COMFORT_THRESHOLD = 60;

type ApplianceId = "bulb" | "fan" | "heater";

interface Appliance {
  id: ApplianceId;
  name: string;
  emoji: string;
  watts: number;
  /** comfort change per tick while ON (heater warms; others neutral). */
  warm: number;
}

const APPLIANCES: readonly Appliance[] = [
  { id: "bulb", name: "LED bulb", emoji: "💡", watts: 10, warm: 0 },
  { id: "fan", name: "Fan", emoji: "🌀", watts: 60, warm: 0 },
  { id: "heater", name: "Heater", emoji: "🔥", watts: 1000, warm: 12 },
] as const;

type OnState = Record<ApplianceId, boolean>;
type Phase = "setup" | "running" | "won" | "lost";

const COOL_PER_TICK = 6; // comfort lost per tick with no heater
const START_COMFORT = 55;

/** Amps drawn by a wattage at the fixed 230V supply. I = P / V. */
function amps(watts: number): number {
  return watts / VOLTS;
}

interface Snapshot {
  watts: number;
  comfort: number;
}

export default function PowerMeterDashboard({ onComplete }: ActivityProps) {
  const [on, setOn] = useState<OnState>({ bulb: true, fan: false, heater: true });
  const [rate, setRate] = useState<number>(10); // ₹ per kWh, learner-set
  const [tick, setTick] = useState<number>(0);
  const [energy, setEnergy] = useState<number>(0); // kWh accumulated
  const [comfort, setComfort] = useState<number>(START_COMFORT);
  const [series, setSeries] = useState<number[]>([]); // wattage history
  const [phase, setPhase] = useState<Phase>("setup");

  const completedRef = useRef<boolean>(false);
  const onRef = useRef<OnState>(on);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    onRef.current = on;
  }, [on]);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => stopTimer, [stopTimer]);

  // ---- live (pre-run) readings for the current switch positions ----
  const liveWatts = useMemo(
    () => APPLIANCES.reduce((sum, a) => sum + (on[a.id] ? a.watts : 0), 0),
    [on],
  );
  const liveAmps = amps(liveWatts);

  const cap = useMemo(() => Math.round(rate * ENERGY_BUDGET * 100) / 100, [rate]);
  const cost = useMemo(() => Math.round(energy * rate * 100) / 100, [energy, rate]);

  const toggle = useCallback((id: ApplianceId) => {
    setOn((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const finish = useCallback(
    (finalCost: number, finalComfort: number) => {
      stopTimer();
      const won = finalCost <= cap + 1e-6 && finalComfort >= COMFORT_THRESHOLD;
      if (won) {
        setPhase("won");
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete({
            passed: true,
            stars: 3,
            detail: `₹${finalCost.toFixed(2)} ≤ ₹${cap.toFixed(
              2,
            )} cap, room warm — you added power over time into kWh!`,
          });
        }
      } else {
        setPhase("lost");
        const nudge =
          finalCost > cap + 1e-6
            ? "The heater eats 100× the bulb — try cycling it on and off."
            : "Too chilly. Give the heater a few more minutes to warm the room.";
        onComplete({ passed: false, detail: nudge });
      }
    },
    [cap, onComplete, stopTimer],
  );

  const run = useCallback(() => {
    stopTimer();
    // reset accumulators, keep the learner's current switch choices
    setTick(0);
    setEnergy(0);
    setComfort(START_COMFORT);
    setSeries([]);
    setPhase("running");

    let t = 0;
    let acc = 0; // kWh
    let cm = START_COMFORT;

    timerRef.current = setInterval(() => {
      const cur = onRef.current;
      const w = APPLIANCES.reduce((s, a) => s + (cur[a.id] ? a.watts : 0), 0);
      const heaterOn = cur.heater;
      // ENERGY: add this tick's power × time. This is the running sum → kWh.
      acc += (w * TICK_HOURS) / 1000;
      // COMFORT: heater warms, otherwise the room cools toward cold.
      cm += heaterOn ? APPLIANCES[2].warm : -COOL_PER_TICK;
      cm = Math.max(0, Math.min(100, cm));
      t += 1;

      setEnergy(acc);
      setComfort(cm);
      setTick(t);
      setSeries((prev) => [...prev, w]);

      if (t >= TICKS) {
        const finalCost = Math.round(acc * rate * 100) / 100;
        finish(finalCost, cm);
      }
    }, 480);
  }, [finish, rate, stopTimer]);

  const reset = useCallback(() => {
    stopTimer();
    setOn({ bulb: true, fan: false, heater: true });
    setRate(10);
    setTick(0);
    setEnergy(0);
    setComfort(START_COMFORT);
    setSeries([]);
    setPhase("setup");
  }, [stopTimer]);

  const running = phase === "running";
  const won = phase === "won";
  const costOver = cost > cap + 1e-6;
  const meterColor = won ? GREEN : costOver ? RED : ACCENT;
  const clockLabel = `${String(tick * 5).padStart(2, "0")} min of 60`;

  const status = useMemo(() => {
    if (won) return "Green meter! Cost capped and the room stayed warm. ✨";
    if (phase === "lost")
      return costOver ? "Cost meter blew red — cut the heater time." : "Room went cold — warm it more.";
    if (running) return `Simulating… ${clockLabel}`;
    return "Set your switches and rate, then press Run hour ▶";
  }, [won, phase, running, costOver, clockLabel]);

  // ---- line chart geometry (wattage over the session) ----
  const CW = 300;
  const CH = 70;
  const maxW = 1100; // bulb+fan+heater ≈ 1070, round headroom
  const chartPts = useMemo(() => {
    if (series.length === 0) return "";
    return series
      .map((w, i) => {
        const x = series.length === 1 ? 0 : (i / (TICKS - 1)) * CW;
        const y = CH - (w / maxW) * CH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [series]);

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
      `}</style>

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
            {/* three windows lit by which appliances are on */}
            {APPLIANCES.map((a, i) => {
              const lit = on[a.id];
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
                    style={running && lit ? { animation: "g6powermeterdashboard-pulse 1.2s ease-in-out infinite" } : undefined}
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
              width={(56 * comfort) / 100}
              height={8}
              rx={4}
              fill={comfort >= COMFORT_THRESHOLD ? GREEN : RED}
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

          {/* AMMETER — live current from chosen wattage */}
          <g transform="translate(140 80)">
            <rect width={76} height={42} rx={6} fill="#11182f" stroke="#1e2a44" strokeWidth={1.5} />
            <text x={38} y={15} fontSize={8} fill="#5f7194" textAnchor="middle">AMMETER</text>
            <text
              x={38}
              y={33}
              fontSize={15}
              fill={ACCENT}
              textAnchor="middle"
              className="font-display"
              style={running ? { animation: "g6powermeterdashboard-needle 0.5s ease-in-out infinite" } : undefined}
            >
              {liveAmps.toFixed(2)}A
            </text>
          </g>

          {/* meter dial badge */}
          <g transform="translate(232 30)">
            <rect width={80} height={92} rx={8} fill="#0b1020" stroke="#1e2a44" strokeWidth={1.5} />
            <text x={40} y={16} fontSize={8} fill="#5f7194" textAnchor="middle">SMART METER</text>
            <text x={40} y={42} fontSize={9} fill="#9fb0d0" textAnchor="middle">{energy.toFixed(3)}</text>
            <text x={40} y={54} fontSize={7} fill="#5f7194" textAnchor="middle">kWh used</text>
            <text x={40} y={76} fontSize={15} fill={meterColor} textAnchor="middle" className="font-display">
              ₹{cost.toFixed(2)}
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
              {energy.toFixed(3)} kWh
            </div>
          </div>
          <div className="rounded-lg border border-line bg-panel-2/60 p-1.5">
            <div className="text-ink-faint">Cost = kWh×₹</div>
            <div className="font-display" style={{ color: meterColor }}>
              ₹{cost.toFixed(2)}
            </div>
          </div>
        </div>

        {/* ---- wattage line chart ---- */}
        <svg
          viewBox={`-2 -6 ${CW + 4} ${CH + 14}`}
          className="mt-2 block h-auto w-full"
          role="img"
          aria-label="Line chart of wattage over the simulated hour"
        >
          <line x1={0} y1={CH} x2={CW} y2={CH} stroke="#1e2a44" strokeWidth={1} />
          <text x={0} y={-1} fontSize={7} fill="#5f7194">watts over the hour</text>
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
          borderColor: won ? GREEN : costOver && running ? RED : "var(--color-line)",
          color: won ? GREEN : "var(--color-ink-dim)",
        }}
      >
        {won && <span aria-hidden>✨🎉 ⭐⭐⭐ </span>}
        {status}
      </div>

      {won && (
        <div
          className="rounded-lg border p-3 text-center text-xs"
          style={{ borderColor: GREEN, color: "var(--color-ink)", animation: "g6powermeterdashboard-pop 0.4s ease-out" }}
        >
          You added up <b>power over time</b> to get <b>kWh</b> — just like your real electricity bill.
        </div>
      )}

      {/* ---------------- APPLIANCE SWITCHES ---------------- */}
      <div className="panel flex flex-col gap-2 rounded-xl p-3">
        <p className="text-[11px] uppercase tracking-tech text-ink-faint">Appliances — tap to switch</p>
        {APPLIANCES.map((a) => {
          const isOn = on[a.id];
          return (
            <button
              key={a.id}
              type="button"
              onPointerDown={() => toggle(a.id)}
              aria-pressed={isOn}
              aria-label={`${a.name}, ${a.watts} watts, ${amps(a.watts).toFixed(2)} amps, currently ${isOn ? "on" : "off"}`}
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-left transition"
              style={{
                touchAction: "manipulation",
                borderColor: isOn ? ACCENT : "var(--color-line)",
                background: isOn ? "color-mix(in srgb, #a855f7 14%, transparent)" : "var(--color-panel-2)",
              }}
            >
              <span className="flex items-center gap-2 text-sm text-ink">
                <span aria-hidden className="text-lg">{a.emoji}</span>
                {a.name}
                <span className="text-[11px] text-ink-faint">{a.watts}W · {amps(a.watts).toFixed(2)}A</span>
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
          );
        })}
      </div>

      {/* ---------------- RATE SLIDER ---------------- */}
      <div className="panel flex flex-col gap-1 rounded-xl p-3 text-xs">
        <span className="flex items-center justify-between">
          <span className="text-ink-dim">
            Tariff rate <span className="text-ink-faint">· ₹ per kWh</span>
          </span>
          <span className="font-display tabular-nums" style={{ color: ACCENT }}>
            ₹{rate}/kWh
          </span>
        </span>
        <input
          type="range"
          min={6}
          max={12}
          step={1}
          value={rate}
          disabled={running}
          onChange={(e) => setRate(Number(e.target.value))}
          aria-label={`Electricity rate, ₹${rate} per kilowatt-hour`}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-50"
          style={{ accentColor: ACCENT }}
        />
        <p className="text-[11px] text-ink-faint">
          Goal: keep cost ≤ ₹{cap.toFixed(2)} over the hour while warmth stays above the line.
        </p>
      </div>

      {/* ---------------- CONTROLS ---------------- */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink-faint" aria-hidden>
          warmth {Math.round(comfort)} / need {COMFORT_THRESHOLD}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
            aria-label="Reset the dashboard"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            style={{ background: ACCENT, color: "#05070d" }}
            aria-label="Run the simulated hour"
          >
            {running ? clockLabel : "Run hour ▶"}
          </button>
        </div>
      </div>
    </div>
  );
}
