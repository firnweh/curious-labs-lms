"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Smart Energy Meter — threshold rules + energy → cost → carbon       */
/*  Learning goal: a debounced alert rule (power > X for > Y seconds)   */
/*  ignores a harmless 1-second blip but catches a sustained event,     */
/*  and integrated kWh converts deterministically into cost and CO₂.   */
/*  Everything below is a fixed, scripted PZEM feed — fully winnable.   */
/* ------------------------------------------------------------------ */

const ACCENT = "#22d3ee";
const RED = "#f87171";
const GREEN = "#34d399";
const VOLTS = 230;

/** A scripted 45-minute run, sampled once per simulated minute (45 ticks). */
const TOTAL_MIN = 45;
const TICK_HOURS = 1 / 60; // each tick = 1 simulated minute = 1/60 hour
const GRID_CO2 = 0.82; // kg CO₂ per kWh — India grid factor
const SECONDS_PER_TICK = 60; // one tick of timeline = 60 simulated seconds

/**
 * Deterministic wattage timeline (one value per simulated minute).
 * - LED idle baseline ~5 W.
 * - A single harmless 1-second blip at minute 8 (~620 W) — too short to alert.
 * - A sustained kettle/heater event minutes 18–30 (~620 W) — must alert.
 * The blip is encoded as a one-tick spike; the event is a 13-tick plateau.
 */
const TIMELINE: readonly number[] = (() => {
  const t: number[] = [];
  for (let m = 0; m < TOTAL_MIN; m++) {
    if (m === 8) {
      t.push(620); // brief blip — one tick only
    } else if (m >= 18 && m <= 30) {
      t.push(620); // sustained high-draw event
    } else {
      t.push(5); // LED idle
    }
  }
  return t;
})();

/** The blip lasts a real 1 second even though it occupies one minute-tick. */
const BLIP_SECONDS = 1;

/** Total energy over the whole run, integrated power × time (kWh). */
const TOTAL_KWH = TIMELINE.reduce((s, w) => s + (w * TICK_HOURS) / 1000, 0);
/** Default editable tariff and the daily→monthly projection factor. */
const DEFAULT_TARIFF = 8; // ₹ per kWh
const DAYS_PER_MONTH = 30;

/** Deterministic targets the learner reads off the finished dashboard. */
function monthlyCost(tariff: number): number {
  // This 45-min run repeats; bill on the run's energy × tariff × 30 days.
  return TOTAL_KWH * tariff * DAYS_PER_MONTH;
}
const TOTAL_CO2 = TOTAL_KWH * GRID_CO2; // kg for the run

type Phase = "setup" | "running" | "armed" | "audit" | "won";

/** Audit answers the learner types; checked within tolerance. */
interface Audit {
  kwh: string;
  cost: string;
  co2: string;
}

/** Round to a tidy display precision. */
function r(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export default function SmartEnergyMeter({ onComplete }: ActivityProps) {
  // --- alert rule the learner builds ---
  const [thresholdW, setThresholdW] = useState<number>(300);
  const [durationS, setDurationS] = useState<number>(5);
  const [tariff, setTariff] = useState<number>(DEFAULT_TARIFF);

  // --- live stream state ---
  const [tick, setTick] = useState<number>(0); // minutes elapsed
  const [energy, setEnergy] = useState<number>(0); // kWh integrated
  const [series, setSeries] = useState<number[]>([]); // wattage history
  const [phase, setPhase] = useState<Phase>("setup");
  const [alertFired, setAlertFired] = useState<boolean>(false);
  const [blipTripped, setBlipTripped] = useState<boolean>(false);
  const [audit, setAudit] = useState<Audit>({ kwh: "", cost: "", co2: "" });
  const [showHint, setShowHint] = useState<boolean>(false);
  const [nudge, setNudge] = useState<string>("");

  const completedRef = useRef<boolean>(false);
  const ruleRef = useRef<{ w: number; s: number }>({ w: thresholdW, s: durationS });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    ruleRef.current = { w: thresholdW, s: durationS };
  }, [thresholdW, durationS]);

  const stopTimer = useCallback((): void => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => stopTimer, [stopTimer]);

  // ---- derived live readings ----
  const liveWatts = series.length > 0 ? series[series.length - 1] : TIMELINE[0];
  const liveAmps = liveWatts / VOLTS;
  const cost = useMemo(() => energy * tariff * DAYS_PER_MONTH, [energy, tariff]);
  const co2 = useMemo(() => energy * GRID_CO2, [energy]);

  // Targets for the audit (full-run values).
  const targetKwh = r(TOTAL_KWH, 3);
  const targetCost = r(monthlyCost(tariff), 0);
  const targetCo2 = r(TOTAL_CO2, 3);

  /** Does this rule alert on the SUSTAINED event but NOT on the 1-s blip? */
  const ruleIsCorrect = useCallback((w: number, s: number): boolean => {
    const eventW = 620;
    const eventSeconds = 13 * SECONDS_PER_TICK; // plateau length
    const fitsEvent = eventW > w && eventSeconds > s;
    const ignoresBlip = !(eventW > w && BLIP_SECONDS > s);
    return fitsEvent && ignoresBlip;
  }, []);

  const run = useCallback((): void => {
    stopTimer();
    setTick(0);
    setEnergy(0);
    setSeries([]);
    setAlertFired(false);
    setBlipTripped(false);
    setPhase("running");
    setNudge("");

    let t = 0;
    let acc = 0;
    let runHigh = 0; // consecutive seconds above threshold

    timerRef.current = setInterval(() => {
      const w = TIMELINE[t];
      const { w: thr, s: dur } = ruleRef.current;
      acc += (w * TICK_HOURS) / 1000;

      // Debounce: this tick contributes its real high-power duration.
      const tickHighSeconds =
        w > thr ? (t === 8 ? BLIP_SECONDS : SECONDS_PER_TICK) : 0;
      if (tickHighSeconds > 0) {
        runHigh += tickHighSeconds;
        if (runHigh > dur) {
          // Tag whether this was the blip-minute or the real event.
          if (t === 8) setBlipTripped(true);
          else setAlertFired(true);
        }
      } else {
        runHigh = 0;
      }

      t += 1;
      setEnergy(acc);
      setSeries((prev) => [...prev, w]);
      setTick(t);

      if (t >= TOTAL_MIN) {
        stopTimer();
        setPhase("audit");
      }
    }, 90);
  }, [stopTimer]);

  const reset = useCallback((): void => {
    stopTimer();
    setThresholdW(300);
    setDurationS(5);
    setTariff(DEFAULT_TARIFF);
    setTick(0);
    setEnergy(0);
    setSeries([]);
    setPhase("setup");
    setAlertFired(false);
    setBlipTripped(false);
    setAudit({ kwh: "", cost: "", co2: "" });
    setNudge("");
    setShowHint(false);
    completedRef.current = false;
  }, [stopTimer]);

  const submitAudit = useCallback((): void => {
    const k = Number(audit.kwh);
    const c = Number(audit.cost);
    const g = Number(audit.co2);
    const ruleOk = alertFired && !blipTripped;
    const kOk = Number.isFinite(k) && Math.abs(k - targetKwh) <= 0.01;
    const cOk = Number.isFinite(c) && Math.abs(c - targetCost) <= 2;
    const gOk = Number.isFinite(g) && Math.abs(g - targetCo2) <= 0.02;

    if (ruleOk && kOk && cOk && gOk) {
      setPhase("won");
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete({
          passed: true,
          stars: 3,
          detail: `Rule caught the event, ignored the blip — ${targetKwh} kWh → ₹${targetCost}/mo, ${targetCo2} kg CO₂.`,
        });
      }
      return;
    }

    // Friendly, recoverable guidance — never scold.
    let msg = "";
    if (!ruleOk) {
      msg = blipTripped
        ? "Your rule alerted on the 1-second blip too. Make the duration longer so the blip is ignored."
        : "Your rule never fired during the real event. Lower the watt threshold or shorten the duration a little.";
    } else if (!kOk) {
      msg = "Total kWh is a touch off — read the meter's kWh badge at the end of the run.";
    } else if (!cOk) {
      msg = "Monthly cost = kWh × tariff × 30. Recheck the cost panel.";
    } else {
      msg = "CO₂ = kWh × 0.82. Recheck the carbon panel.";
    }
    setNudge(msg);
    onComplete({ passed: false, detail: msg });
  }, [audit, alertFired, blipTripped, targetKwh, targetCost, targetCo2, onComplete]);

  const running = phase === "running";
  const won = phase === "won";
  const inAudit = phase === "audit" || won;
  const ruleGood = ruleIsCorrect(thresholdW, durationS);

  // ---- needle gauge geometry (0..800 W over a 180° arc) ----
  const GMAX = 800;
  const needleAngle = Math.PI * (1 - Math.min(liveWatts, GMAX) / GMAX); // π→0
  const nx = 60 + 40 * Math.cos(needleAngle);
  const ny = 62 - 40 * Math.sin(needleAngle);

  // ---- trend chart (scrolling wattage) ----
  const CW = 300;
  const CH = 64;
  const chartPts = useMemo(() => {
    if (series.length === 0) return "";
    return series
      .map((w, i) => {
        const x = (i / (TOTAL_MIN - 1)) * CW;
        const y = CH - (Math.min(w, GMAX) / GMAX) * CH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [series]);
  const thresholdY = CH - (Math.min(thresholdW, GMAX) / GMAX) * CH;

  const showBubble = alertFired || (blipTripped && !alertFired);
  const bubbleText = blipTripped && !alertFired ? "False alert on a 1-s blip!" : "Alert: High power draw 620W";

  const status = useMemo(() => {
    if (won) return "Audit complete! Rule tuned, totals verified. ✨";
    if (phase === "audit") return `Run finished — fill the energy audit below.`;
    if (running) return `PZEM streaming… ${tick} / ${TOTAL_MIN} min`;
    return "Set your alert rule, then press Run feed ▶";
  }, [won, phase, running, tick]);

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink">
      <style>{`
        @keyframes g9energymeter-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g9energymeter-bubble {
          0% { transform: translateY(6px) scale(0.9); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes g9energymeter-pulse {
          0%,100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {/* ---------------- DASHBOARD CANVAS ---------------- */}
      <div
        className="panel relative overflow-hidden rounded-xl p-3"
        style={won ? { boxShadow: `0 0 0 1px ${ACCENT}, 0 0 24px -4px ${ACCENT}` } : undefined}
      >
        <svg
          viewBox="0 0 320 150"
          className="block h-auto w-full"
          role="img"
          aria-label="Smart energy meter: watt gauge, kilowatt-hour accumulator and carbon readout"
        >
          {/* WATT needle gauge */}
          <g transform="translate(0 8)">
            <path d="M20 62 A40 40 0 0 1 100 62" fill="none" stroke="#1e2a44" strokeWidth={6} strokeLinecap="round" />
            <path
              d={`M20 62 A40 40 0 0 1 ${60 + 40 * Math.cos(Math.PI * (1 - Math.min(thresholdW, GMAX) / GMAX))} ${62 - 40 * Math.sin(Math.PI * (1 - Math.min(thresholdW, GMAX) / GMAX))}`}
              fill="none"
              stroke="#26405a"
              strokeWidth={6}
              strokeLinecap="round"
            />
            <line
              x1={60}
              y1={62}
              x2={nx}
              y2={ny}
              stroke={liveWatts > thresholdW ? RED : ACCENT}
              strokeWidth={2.4}
              strokeLinecap="round"
              style={running ? { animation: "g9energymeter-pulse 0.6s ease-in-out infinite" } : undefined}
            />
            <circle cx={60} cy={62} r={3} fill={ACCENT} />
            <text x={60} y={78} fontSize={13} fill={liveWatts > thresholdW ? RED : ACCENT} textAnchor="middle" className="font-display">
              {liveWatts} W
            </text>
            <text x={60} y={20} fontSize={7} fill="#5f7194" textAnchor="middle">WATT GAUGE</text>
            <text x={22} y={70} fontSize={6} fill="#5f7194">0</text>
            <text x={96} y={70} fontSize={6} fill="#5f7194">800</text>
          </g>

          {/* kWh ACCUMULATOR */}
          <g transform="translate(120 18)">
            <rect width={86} height={52} rx={8} fill="#0b1020" stroke="#1e2a44" strokeWidth={1.5} />
            <text x={43} y={14} fontSize={7} fill="#5f7194" textAnchor="middle">kWh ACCUMULATOR</text>
            <text x={43} y={34} fontSize={16} fill={ACCENT} textAnchor="middle" className="font-display">
              {energy.toFixed(3)}
            </text>
            <text x={43} y={45} fontSize={6} fill="#5f7194" textAnchor="middle">Σ power × time</text>
          </g>

          {/* CO₂ readout */}
          <g transform="translate(120 78)">
            <rect width={86} height={44} rx={8} fill="#0b1020" stroke="#1e2a44" strokeWidth={1.5} />
            <text x={43} y={13} fontSize={7} fill="#5f7194" textAnchor="middle">CARBON 0.82 kg/kWh</text>
            <text x={43} y={32} fontSize={14} fill={GREEN} textAnchor="middle" className="font-display">
              {co2.toFixed(3)} kg
            </text>
          </g>

          {/* COST readout */}
          <g transform="translate(218 18)">
            <rect width={92} height={104} rx={8} fill="#11182f" stroke="#1e2a44" strokeWidth={1.5} />
            <text x={46} y={15} fontSize={7} fill="#5f7194" textAnchor="middle">COST PANEL</text>
            <text x={46} y={30} fontSize={7} fill="#9fb0d0" textAnchor="middle">₹{tariff}/kWh tariff</text>
            <text x={46} y={56} fontSize={16} fill={ACCENT} textAnchor="middle" className="font-display">
              ₹{Math.round(cost)}
            </text>
            <text x={46} y={66} fontSize={6} fill="#5f7194" textAnchor="middle">projected / month</text>
            <text x={46} y={86} fontSize={8} fill="#9fb0d0" textAnchor="middle">{VOLTS}V · {liveAmps.toFixed(2)}A</text>
            <text x={46} y={97} fontSize={6} fill="#5f7194" textAnchor="middle">live supply</text>
          </g>

          {/* simulated phone bubble */}
          {showBubble && (
            <g transform="translate(120 60)" style={{ animation: "g9energymeter-bubble 0.3s ease-out" }}>
              <rect
                width={86}
                height={20}
                rx={10}
                fill={blipTripped && !alertFired ? "#3a1620" : "#0e2a24"}
                stroke={blipTripped && !alertFired ? RED : GREEN}
                strokeWidth={1.2}
              />
              <text x={43} y={13} fontSize={6.2} fill={blipTripped && !alertFired ? RED : GREEN} textAnchor="middle">
                📱 {bubbleText}
              </text>
            </g>
          )}
        </svg>

        {/* ---- scrolling power TREND chart ---- */}
        <svg
          viewBox={`-2 -8 ${CW + 4} ${CH + 16}`}
          className="mt-2 block h-auto w-full"
          role="img"
          aria-label="Trend chart of power in watts over the 45-minute run, with the alert threshold line"
        >
          <text x={0} y={-2} fontSize={7} fill="#5f7194">power trend (W) over 45 min</text>
          <line x1={0} y1={CH} x2={CW} y2={CH} stroke="#1e2a44" strokeWidth={1} />
          {/* threshold guide line */}
          <line x1={0} y1={thresholdY} x2={CW} y2={thresholdY} stroke={RED} strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />
          <text x={CW - 1} y={thresholdY - 2} fontSize={6.5} fill={RED} textAnchor="end">
            rule {thresholdW}W
          </text>
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
          borderColor: won ? ACCENT : "var(--color-line)",
          color: won ? ACCENT : "var(--color-ink-dim)",
        }}
      >
        {won && <span aria-hidden>✨🎉 ⭐⭐⭐ </span>}
        {status}
      </div>

      {/* ---------------- ALERT RULE BUILDER ---------------- */}
      <div className="panel flex flex-col gap-3 rounded-xl p-3 text-xs">
        <p className="text-[11px] uppercase tracking-tech text-ink-faint">
          Alert rule — IF power &gt; threshold FOR &gt; duration → WhatsApp
        </p>

        <label className="flex flex-col gap-1">
          <span className="flex items-center justify-between">
            <span className="text-ink-dim">Power threshold</span>
            <span className="font-display tabular-nums" style={{ color: ACCENT }}>{thresholdW} W</span>
          </span>
          <input
            type="range"
            min={50}
            max={750}
            step={10}
            value={thresholdW}
            disabled={running}
            onChange={(e) => setThresholdW(Number(e.target.value))}
            aria-label={`Alert power threshold, ${thresholdW} watts`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-50"
            style={{ accentColor: ACCENT, touchAction: "none" }}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex items-center justify-between">
            <span className="text-ink-dim">Sustained for</span>
            <span className="font-display tabular-nums" style={{ color: ACCENT }}>{durationS} s</span>
          </span>
          <input
            type="range"
            min={1}
            max={120}
            step={1}
            value={durationS}
            disabled={running}
            onChange={(e) => setDurationS(Number(e.target.value))}
            aria-label={`Alert debounce duration, ${durationS} seconds`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-50"
            style={{ accentColor: ACCENT, touchAction: "none" }}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex items-center justify-between">
            <span className="text-ink-dim">Tariff <span className="text-ink-faint">· ₹ per kWh</span></span>
            <span className="font-display tabular-nums" style={{ color: ACCENT }}>₹{tariff}/kWh</span>
          </span>
          <input
            type="range"
            min={5}
            max={12}
            step={1}
            value={tariff}
            disabled={running}
            onChange={(e) => setTariff(Number(e.target.value))}
            aria-label={`Electricity tariff, ₹${tariff} per kilowatt-hour`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-50"
            style={{ accentColor: ACCENT, touchAction: "none" }}
          />
        </label>

        <p className="text-[11px] text-ink-faint">
          The feed hides a harmless 1-second blip and a long high-draw event. Catch the event, skip the blip.
        </p>

        {showHint && (
          <p className="rounded-md border px-2 py-1 text-[11px]" style={{ borderColor: ACCENT, color: ACCENT }}>
            Safe band: threshold between 50–610 W and duration between 2–700 s. Then the long event fires but the 1-s blip cannot.
          </p>
        )}
        {!running && !inAudit && (
          <span className="text-[11px]" style={{ color: ruleGood ? GREEN : "var(--color-ink-faint)" }} aria-hidden>
            {ruleGood ? "✓ rule looks debounce-safe" : "tune the rule to be debounce-safe"}
          </span>
        )}
      </div>

      {/* ---------------- ENERGY AUDIT (after run) ---------------- */}
      {inAudit && (
        <div className="panel flex flex-col gap-2 rounded-xl p-3 text-xs" style={{ animation: "g9energymeter-pop 0.4s ease-out" }}>
          <p className="text-[11px] uppercase tracking-tech text-ink-faint">Energy audit — read the meter, fill the totals</p>
          <AuditField
            label="Total energy (kWh, 3 dp)"
            value={audit.kwh}
            placeholder={`e.g. ${targetKwh.toFixed(3)}`}
            onChange={(v) => setAudit((a) => ({ ...a, kwh: v }))}
            disabled={won}
          />
          <AuditField
            label="Projected monthly cost (₹)"
            value={audit.cost}
            placeholder="kWh × tariff × 30"
            onChange={(v) => setAudit((a) => ({ ...a, cost: v }))}
            disabled={won}
          />
          <AuditField
            label="Run CO₂ (kg, 3 dp)"
            value={audit.co2}
            placeholder="kWh × 0.82"
            onChange={(v) => setAudit((a) => ({ ...a, co2: v }))}
            disabled={won}
          />
          {nudge && !won && (
            <p className="text-[11px]" style={{ color: RED }} role="alert">{nudge}</p>
          )}
          {!won && (
            <button
              type="button"
              onClick={submitAudit}
              className="mt-1 rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: ACCENT, color: "#05070d" }}
              aria-label="Submit the energy audit for checking"
            >
              Submit audit
            </button>
          )}
        </div>
      )}

      {/* ---------------- WIN CARD ---------------- */}
      {won && (
        <div
          className="flex flex-col gap-2 rounded-xl border p-3 text-center text-xs"
          style={{ borderColor: ACCENT, color: "var(--color-ink)", animation: "g9energymeter-pop 0.4s ease-out" }}
        >
          <div className="font-display" style={{ color: ACCENT }}>Audit complete ⭐⭐⭐</div>
          <p>A <b>debounced threshold rule</b> ignores noise, and <b>kWh</b> turns straight into ₹ and CO₂.</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {["💡 Switch to LEDs", "❄️ Turn AC off early", "⏱️ Shift heavy loads off-peak"].map((c) => (
              <span key={c} className="rounded-full border px-2 py-0.5 text-[11px]" style={{ borderColor: GREEN, color: GREEN }}>
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- CONTROLS ---------------- */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowHint((s) => !s)}
          disabled={won}
          className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-xs font-medium text-ink-dim disabled:opacity-50"
          aria-label="Toggle the rule hint"
        >
          {showHint ? "Hide hint" : "Hint"}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
            aria-label="Reset the energy meter"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={run}
            disabled={running || inAudit}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            style={{ background: ACCENT, color: "#05070d" }}
            aria-label="Run the simulated PZEM feed"
          >
            {running ? `${tick}/${TOTAL_MIN} min` : "Run feed ▶"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AuditField({
  label,
  value,
  placeholder,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-ink-dim">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="rounded-lg border border-line bg-panel-2/60 px-3 py-2 text-sm text-ink disabled:opacity-60"
        style={{ accentColor: ACCENT }}
      />
    </label>
  );
}
