"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Live Energy Dashboard — an IoT data pipeline you wire by hand.      */
/*  Learning goal: data flows in order (read → compute → display),      */
/*  power = V × I, energy accumulates over time, and a threshold rule   */
/*  fires an alert. WIN = pipeline ordered correctly AND the alert set  */
/*  so the heater trips a red banner while lamp/fan stay green.         */
/* ------------------------------------------------------------------ */

const ACCENT = "#22d3ee";
const RED = "#f87171";
const GREEN = "#34d399";
const VOLTS = 230;
const RATE = 8; // ₹ per kWh, fixed tariff

/** Deterministic clock: one tick = one simulated second. */
const TICK_MS = 700;
const MAX_TICKS = 10;
const TICK_HOURS = 1 / 3600; // one second, in hours

type ApplianceId = "lamp" | "fan" | "heater";

interface Appliance {
  id: ApplianceId;
  name: string;
  emoji: string;
  amps: number;
}

/** Three loads on the same 230V supply. Heater alone clears 500W. */
const APPLIANCES: readonly Appliance[] = [
  { id: "lamp", name: "Lamp", emoji: "💡", amps: 0.4 },
  { id: "fan", name: "Fan", emoji: "🌀", amps: 0.8 },
  { id: "heater", name: "Heater", emoji: "🔥", amps: 4 },
] as const;

/** P = V × I, watts. */
function watts(amps: number): number {
  return VOLTS * amps;
}

/** The three pipeline blocks the learner must order. */
type BlockId = "read" | "compute" | "push";

interface Block {
  id: BlockId;
  label: string;
  sub: string;
  emoji: string;
}

const BLOCKS: Record<BlockId, Block> = {
  read: { id: "read", label: "read current", sub: "sensor → I (A)", emoji: "📟" },
  compute: { id: "compute", label: "power = V × I", sub: "compute box", emoji: "🧮" },
  push: { id: "push", label: "push to chart", sub: "→ dashboard", emoji: "📈" },
};

/** The one correct data-flow order. */
const CORRECT_ORDER: readonly BlockId[] = ["read", "compute", "push"] as const;

/** A scrambled-but-deterministic starting order (always re-orderable). */
const START_ORDER: readonly BlockId[] = ["compute", "push", "read"] as const;

type Phase = "wiring" | "running" | "won";

function ordersEqual(a: readonly BlockId[], b: readonly BlockId[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export default function LiveEnergyDashboard({ onComplete }: ActivityProps) {
  const [order, setOrder] = useState<BlockId[]>([...START_ORDER]);
  const [appliance, setAppliance] = useState<ApplianceId>("lamp");
  const [threshold, setThreshold] = useState<number>(900); // alert if power > this (W)
  const [tick, setTick] = useState<number>(0);
  const [energy, setEnergy] = useState<number>(0); // watt-hours
  const [series, setSeries] = useState<number[]>([]); // wattage per tick
  const [phase, setPhase] = useState<Phase>("wiring");
  const [note, setNote] = useState<string>("");

  const completedRef = useRef<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const applianceRef = useRef<ApplianceId>(appliance);

  useEffect(() => {
    applianceRef.current = appliance;
  }, [appliance]);

  const stopTimer = useCallback((): void => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => stopTimer, [stopTimer]);

  const pipelineOk = useMemo(() => ordersEqual(order, CORRECT_ORDER), [order]);

  const active = useMemo(
    () => APPLIANCES.find((a) => a.id === appliance) ?? APPLIANCES[0],
    [appliance],
  );
  const liveWatts = watts(active.amps);
  const running = phase === "running";
  const won = phase === "won";

  // ---- alert state for the CURRENT appliance (live, pre-run) ----
  const alertNow = liveWatts > threshold;

  const cost = useMemo(
    () => Math.round((energy / 1000) * RATE * 100) / 100,
    [energy],
  );

  /** Move a block up (-1) or down (+1) in the pipeline. */
  const moveBlock = useCallback(
    (index: number, dir: -1 | 1): void => {
      if (phase !== "wiring") return;
      setOrder((prev) => {
        const next = [...prev];
        const j = index + dir;
        if (j < 0 || j >= next.length) return prev;
        const tmp = next[index];
        next[index] = next[j];
        next[j] = tmp;
        return next;
      });
    },
    [phase],
  );

  const pickAppliance = useCallback(
    (id: ApplianceId): void => {
      if (running) return;
      setAppliance(id);
    },
    [running],
  );

  /**
   * WIN CHECK — deterministic. The learner wins when:
   *  1. the pipeline is ordered read → compute → push, AND
   *  2. the threshold is set so the HEATER trips the alert (its power
   *     is above it) while the LAMP and FAN stay below (green).
   * The threshold band that satisfies this is (320W, 920W].
   */
  const lampW = watts(APPLIANCES[0].amps); // 92
  const fanW = watts(APPLIANCES[1].amps); // 184
  const heaterW = watts(APPLIANCES[2].amps); // 920
  const thresholdGood = threshold >= fanW && threshold < heaterW;

  const finish = useCallback((): void => {
    stopTimer();
    setPhase("won");
    if (!completedRef.current) {
      completedRef.current = true;
      onComplete({
        passed: true,
        stars: 3,
        detail:
          "Pipeline wired in order, P = V × I plotted live, and the heater trips a red high-load alert while lamp & fan stay green.",
      });
    }
  }, [onComplete, stopTimer]);

  const run = useCallback((): void => {
    if (!pipelineOk) {
      setNote("Data can't flow yet — blocks are out of order. Read first, push last.");
      onComplete({ passed: false, detail: "Order the pipeline: read → compute → push." });
      return;
    }
    if (!thresholdGood) {
      setNote(
        threshold >= heaterW
          ? "Threshold is too high — even the heater never trips. Lower it below the heater's power."
          : "Threshold is too low — the lamp or fan would false-alarm. Raise it above the fan's power.",
      );
      onComplete({
        passed: false,
        detail: "Set the alert so only the heater is high-load.",
      });
      return;
    }

    // Both conditions met — stream the live chart, then celebrate.
    stopTimer();
    setNote("");
    setTick(0);
    setEnergy(0);
    setSeries([]);
    setPhase("running");

    let t = 0;
    let acc = 0; // watt-hours
    timerRef.current = setInterval(() => {
      const a = APPLIANCES.find((x) => x.id === applianceRef.current) ?? APPLIANCES[0];
      const w = watts(a.amps);
      acc += w * TICK_HOURS; // energy = Σ power × elapsed_hours
      t += 1;
      setEnergy(acc);
      setSeries((prev) => [...prev, w]);
      setTick(t);
      if (t >= MAX_TICKS) finish();
    }, TICK_MS);
  }, [pipelineOk, thresholdGood, threshold, heaterW, finish, onComplete, stopTimer]);

  const reset = useCallback((): void => {
    stopTimer();
    setOrder([...START_ORDER]);
    setAppliance("lamp");
    setThreshold(900);
    setTick(0);
    setEnergy(0);
    setSeries([]);
    setPhase("wiring");
    setNote("");
  }, [stopTimer]);

  const status = useMemo(() => {
    if (won) return "Pipeline streaming and the alert rule is dialled in. ✨";
    if (running) return `Streaming live data… tick ${tick} of ${MAX_TICKS}`;
    if (!pipelineOk) return "Wire the pipeline in the right order, then press Stream.";
    if (!thresholdGood) return "Pipeline looks good — now tune the alert threshold.";
    return "Looks ready — press Stream ▶ to go live.";
  }, [won, running, tick, pipelineOk, thresholdGood]);

  // ---- live line chart geometry ----
  const CW = 300;
  const CH = 70;
  const maxW = 1000; // heater ≈ 920, round headroom
  const chartPts = useMemo(() => {
    if (series.length === 0) return "";
    return series
      .map((w, i) => {
        const x = series.length === 1 ? 0 : (i / (MAX_TICKS - 1)) * CW;
        const y = CH - (w / maxW) * CH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [series]);
  const thresholdY = CH - (threshold / maxW) * CH;

  // border glow color for the canvas
  const glow = won ? GREEN : alertNow ? RED : ACCENT;

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink">
      <style>{`
        @keyframes g7energyiot-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g7energyiot-flow {
          from { stroke-dashoffset: 16; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes g7energyiot-blink {
          0%,100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {/* ---------------- DASHBOARD CANVAS ---------------- */}
      <div
        className="panel relative overflow-hidden rounded-xl p-3"
        style={
          won
            ? { boxShadow: `0 0 0 1px ${GREEN}, 0 0 24px -4px ${GREEN}` }
            : alertNow
              ? { boxShadow: `0 0 0 1px ${RED}, 0 0 20px -6px ${RED}` }
              : undefined
        }
      >
        {/* high-load alert banner */}
        <div
          className="mb-2 rounded-lg px-3 py-1.5 text-center text-xs font-semibold"
          role="status"
          aria-live="polite"
          aria-label={alertNow ? "High load alert active" : "Load within safe range"}
          style={{
            background: alertNow ? RED : "color-mix(in srgb, #34d399 14%, transparent)",
            color: alertNow ? "#160606" : GREEN,
            animation: alertNow && running ? "g7energyiot-blink 0.9s ease-in-out infinite" : undefined,
          }}
        >
          {alertNow ? "⚠ HIGH LOAD" : "✓ LOAD OK"} · {active.emoji} {active.name} = {liveWatts}W
        </div>

        {/* IoT stack diagram: sensor → serial → compute → dashboard */}
        <svg
          viewBox="0 0 320 70"
          className="block h-auto w-full"
          role="img"
          aria-label="IoT stack: current sensor sends data over a serial cable into a compute box, then to the dashboard"
        >
          {/* sensor */}
          <g transform="translate(4 18)">
            <rect width={56} height={34} rx={6} fill="#11182f" stroke="#1e2a44" strokeWidth={1.5} />
            <text x={28} y={14} fontSize={7} fill="#5f7194" textAnchor="middle">SENSOR</text>
            <text x={28} y={28} fontSize={13} fill={ACCENT} textAnchor="middle" className="font-display">
              {active.amps}A
            </text>
          </g>

          {/* serial cable (animated dash while streaming) */}
          <line
            x1={60}
            y1={35}
            x2={132}
            y2={35}
            stroke={pipelineOk ? ACCENT : "#1e2a44"}
            strokeWidth={2.5}
            strokeDasharray="4 4"
            style={running ? { animation: "g7energyiot-flow 0.5s linear infinite" } : undefined}
          />

          {/* compute box */}
          <g transform="translate(132 12)">
            <rect width={70} height={46} rx={6} fill="#11182f" stroke="#1e2a44" strokeWidth={1.5} />
            <text x={35} y={13} fontSize={7} fill="#5f7194" textAnchor="middle">COMPUTE</text>
            <text x={35} y={26} fontSize={8} fill="#9fb0d0" textAnchor="middle">P = {VOLTS}×{active.amps}</text>
            <text x={35} y={40} fontSize={13} fill={ACCENT} textAnchor="middle" className="font-display">
              {liveWatts}W
            </text>
          </g>

          {/* link to dashboard */}
          <line
            x1={202}
            y1={35}
            x2={252}
            y2={35}
            stroke={pipelineOk ? ACCENT : "#1e2a44"}
            strokeWidth={2.5}
            strokeDasharray="4 4"
            style={running ? { animation: "g7energyiot-flow 0.5s linear infinite" } : undefined}
          />

          {/* dashboard */}
          <g transform="translate(252 14)">
            <rect width={64} height={42} rx={6} fill="#0b1020" stroke="#1e2a44" strokeWidth={1.5} />
            <text x={32} y={13} fontSize={7} fill="#5f7194" textAnchor="middle">DASHBOARD</text>
            <text x={32} y={28} fontSize={12} fill={won ? GREEN : ACCENT} textAnchor="middle" className="font-display">
              {energy.toFixed(2)}
            </text>
            <text x={32} y={38} fontSize={7} fill="#5f7194" textAnchor="middle">Wh used</text>
          </g>
        </svg>

        {/* live calculation tiles */}
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[11px]">
          <div className="rounded-lg border border-line bg-panel-2/60 p-1.5">
            <div className="text-ink-faint">Power = V × I</div>
            <div className="font-display" style={{ color: ACCENT }}>
              {VOLTS}×{active.amps} = {liveWatts}W
            </div>
          </div>
          <div className="rounded-lg border border-line bg-panel-2/60 p-1.5">
            <div className="text-ink-faint">Energy Σ(P×t)</div>
            <div className="font-display" style={{ color: won ? GREEN : ACCENT }}>
              {energy.toFixed(2)} Wh
            </div>
          </div>
          <div className="rounded-lg border border-line bg-panel-2/60 p-1.5">
            <div className="text-ink-faint">Cost ₹{RATE}/kWh</div>
            <div className="font-display" style={{ color: ACCENT }}>
              ₹{cost.toFixed(3)}
            </div>
          </div>
        </div>

        {/* live line chart with threshold line */}
        <svg
          viewBox={`-2 -6 ${CW + 4} ${CH + 16}`}
          className="mt-2 block h-auto w-full"
          role="img"
          aria-label="Line chart of power in watts over time, with the alert threshold drawn as a red line"
        >
          <line x1={0} y1={CH} x2={CW} y2={CH} stroke="#1e2a44" strokeWidth={1} />
          <text x={0} y={-1} fontSize={7} fill="#5f7194">power (W) vs time</text>
          {/* threshold line */}
          <line
            x1={0}
            y1={thresholdY}
            x2={CW}
            y2={thresholdY}
            stroke={RED}
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.85}
          />
          <text x={CW} y={thresholdY - 2} fontSize={7} fill={RED} textAnchor="end">
            alert &gt; {threshold}W
          </text>
          {chartPts && (
            <polyline
              points={chartPts}
              fill="none"
              stroke={glow}
              strokeWidth={1.8}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
        </svg>
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
        {won && <span aria-hidden>✨🎉 ⭐⭐⭐ </span>}
        {status}
      </div>

      {note && !won && (
        <div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: RED, color: RED }} role="alert">
          {note}
        </div>
      )}

      {won && (
        <div
          className="rounded-lg border p-3 text-center text-xs"
          style={{ borderColor: GREEN, color: "var(--color-ink)", animation: "g7energyiot-pop 0.4s ease-out" }}
        >
          You built a real <b>IoT pipeline</b>: read → compute → push, turned current into
          <b> power (V × I)</b>, summed it into <b>energy</b>, and set a <b>threshold alert</b>.
        </div>
      )}

      {/* ---------------- PIPELINE BLOCKS ---------------- */}
      <div className="panel flex flex-col gap-2 rounded-xl p-3">
        <p className="text-[11px] uppercase tracking-tech text-ink-faint">
          Pipeline — order the blocks (data flows top → bottom)
        </p>
        {order.map((id, i) => {
          const b = BLOCKS[id];
          const inPlace = id === CORRECT_ORDER[i];
          return (
            <div
              key={id}
              className="flex items-center gap-2 rounded-lg border px-2.5 py-2"
              style={{
                borderColor: pipelineOk ? ACCENT : inPlace ? "color-mix(in srgb, #22d3ee 40%, var(--color-line))" : "var(--color-line)",
                background: "var(--color-panel-2)",
              }}
            >
              <span aria-hidden className="text-lg">{b.emoji}</span>
              <span className="flex-1 text-left text-sm">
                <span className="text-ink">{i + 1}. {b.label}</span>{" "}
                <span className="text-[11px] text-ink-faint">{b.sub}</span>
              </span>
              <button
                type="button"
                onPointerDown={() => moveBlock(i, -1)}
                disabled={i === 0 || phase !== "wiring"}
                aria-label={`Move ${b.label} up`}
                className="grid h-7 w-7 place-items-center rounded-md border border-line bg-panel/60 text-ink-dim disabled:opacity-40"
                style={{ touchAction: "manipulation" }}
              >
                <span aria-hidden>▲</span>
              </button>
              <button
                type="button"
                onPointerDown={() => moveBlock(i, 1)}
                disabled={i === order.length - 1 || phase !== "wiring"}
                aria-label={`Move ${b.label} down`}
                className="grid h-7 w-7 place-items-center rounded-md border border-line bg-panel/60 text-ink-dim disabled:opacity-40"
                style={{ touchAction: "manipulation" }}
              >
                <span aria-hidden>▼</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* ---------------- APPLIANCE PICKER ---------------- */}
      <div className="panel flex flex-col gap-2 rounded-xl p-3">
        <p className="text-[11px] uppercase tracking-tech text-ink-faint">
          Plugged into {VOLTS}V supply — pick the load
        </p>
        <div className="grid grid-cols-3 gap-2">
          {APPLIANCES.map((a) => {
            const isSel = a.id === appliance;
            return (
              <button
                key={a.id}
                type="button"
                onPointerDown={() => pickAppliance(a.id)}
                disabled={running}
                aria-pressed={isSel}
                aria-label={`${a.name}, ${a.amps} amps, ${watts(a.amps)} watts`}
                className="flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-center disabled:opacity-60"
                style={{
                  touchAction: "manipulation",
                  borderColor: isSel ? ACCENT : "var(--color-line)",
                  background: isSel ? "color-mix(in srgb, #22d3ee 14%, transparent)" : "var(--color-panel-2)",
                }}
              >
                <span aria-hidden className="text-lg">{a.emoji}</span>
                <span className="text-sm text-ink">{a.name}</span>
                <span className="text-[10px] text-ink-faint">{a.amps}A · {watts(a.amps)}W</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------------- ALERT THRESHOLD ---------------- */}
      <div className="panel flex flex-col gap-1 rounded-xl p-3 text-xs">
        <span className="flex items-center justify-between">
          <span className="text-ink-dim">
            Alert rule <span className="text-ink-faint">· high load if power &gt; this</span>
          </span>
          <span className="font-display tabular-nums" style={{ color: ACCENT }}>
            {threshold}W
          </span>
        </span>
        <input
          type="range"
          min={50}
          max={1000}
          step={10}
          value={threshold}
          disabled={running}
          onChange={(e) => setThreshold(Number(e.target.value))}
          aria-label={`Alert threshold, ${threshold} watts`}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-50"
          style={{ accentColor: ACCENT }}
        />
        <p className="text-[11px] text-ink-faint">
          Goal: only the heater ({heaterW}W) should trip — keep lamp ({lampW}W) &amp; fan ({fanW}W) green.
        </p>
      </div>

      {/* ---------------- CONTROLS ---------------- */}
      <div className="flex items-center justify-end gap-2">
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
          disabled={running || won}
          className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
          style={{ background: ACCENT, color: "#05070d" }}
          aria-label="Stream live data through the pipeline"
        >
          {running ? `tick ${tick}/${MAX_TICKS}` : won ? "Done ⭐" : "Stream ▶"}
        </button>
      </div>
    </div>
  );
}
