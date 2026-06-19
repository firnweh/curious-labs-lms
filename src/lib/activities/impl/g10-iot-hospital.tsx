"use client";
// Learning goal: an IoT monitor uses LOW/HIGH threshold rules to decide
// normal vs. anomaly — fire an alert only when a vital leaves its safe band.
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ACCENT = "#22d3ee";
const RED = "#f87171";
const GREEN = "#34d399";

/** The three monitored vitals. */
type VitalId = "hr" | "spo2" | "temp";

interface VitalDef {
  id: VitalId;
  label: string;
  unit: string;
  /** Slider range for the learner's band controls. */
  min: number;
  max: number;
  step: number;
  /** Clinically safe reference band shown to the learner. */
  safeLow: number;
  safeHigh: number;
  /** Chart drawing range (data → pixels). */
  drawLow: number;
  drawHigh: number;
  /** Sensible default band the learner then tunes. */
  defLow: number;
  defHigh: number;
}

const VITALS: readonly VitalDef[] = [
  {
    id: "hr",
    label: "Heart Rate",
    unit: "bpm",
    min: 40,
    max: 160,
    step: 1,
    safeLow: 60,
    safeHigh: 100,
    drawLow: 40,
    drawHigh: 160,
    defLow: 55,
    defHigh: 155,
  },
  {
    id: "spo2",
    label: "SpO₂",
    unit: "%",
    min: 80,
    max: 100,
    step: 1,
    safeLow: 90,
    safeHigh: 100,
    drawLow: 80,
    drawHigh: 100,
    defLow: 82,
    defHigh: 100,
  },
  {
    id: "temp",
    label: "Temp",
    unit: "°C",
    min: 34,
    max: 41,
    step: 0.1,
    safeLow: 36,
    safeHigh: 38,
    drawLow: 34,
    drawHigh: 41,
    defLow: 35,
    defHigh: 40,
  },
] as const;

const TICKS = 30; // 30-second scripted scenario, one reading per second.

/**
 * Baked, deterministic time-series. The SAME patient every run.
 * Each vital opens NORMAL with tiny noise, then deteriorates once at a known
 * timestamp. The gap between "noisy normal" and the deterioration is wide, so a
 * correct LOW/HIGH band always exists that catches the event AND never trips on
 * the normal stretch.
 *   HR   normal 72–82, then SPIKES to 150 bpm from t=20 (tachycardia).
 *   SpO₂ normal 96–98, then DROPS to 85% from t=14 (hypoxia).
 *   Temp normal 36.6–37.2, then RISES to 39.6 °C from t=24 (fever).
 */
const SERIES: Record<VitalId, readonly number[]> = {
  hr: [
    74, 76, 78, 75, 77, 80, 79, 76, 78, 82, 80, 77, 79, 81, 78, 80, 82, 79, 81,
    80, 150, 152, 149, 151, 148, 150, 153, 149, 151, 150,
  ],
  spo2: [
    97, 98, 97, 96, 98, 97, 98, 97, 96, 98, 97, 98, 97, 96, 85, 84, 86, 85, 83,
    85, 86, 84, 85, 86, 84, 85, 83, 85, 86, 84,
  ],
  temp: [
    36.8, 37.0, 36.9, 37.1, 36.8, 37.0, 37.2, 36.9, 37.0, 37.1, 36.8, 37.0,
    36.9, 37.1, 37.0, 36.8, 37.1, 36.9, 37.0, 37.2, 36.9, 37.1, 37.0, 36.8,
    39.6, 39.8, 39.5, 39.7, 39.6, 39.8,
  ],
} as const;

/** First tick where each vital truly deteriorates (an event must be caught). */
const EVENT_START: Record<VitalId, number> = { hr: 20, spo2: 14, temp: 24 };

/** A learner-set safe band per vital. */
interface Band {
  low: number;
  high: number;
}

type Bands = Record<VitalId, Band>;

function defaultBands(): Bands {
  return {
    hr: { low: VITALS[0].defLow, high: VITALS[0].defHigh },
    spo2: { low: VITALS[1].defLow, high: VITALS[1].defHigh },
    temp: { low: VITALS[2].defLow, high: VITALS[2].defHigh },
  };
}

/** A reading is an alert when it leaves the band:  value < low OR value > high. */
function isAlert(value: number, band: Band): boolean {
  return value < band.low - 1e-9 || value > band.high + 1e-9;
}

interface Score {
  truePos: number; // real events caught
  missed: number; // real events with no alarm
  falsePos: number; // alarms during the normal stretch
}

/** Grade the learner's bands against the whole scripted scenario, up to `upTo`. */
function grade(bands: Bands, upTo: number): { score: Score; logs: AlertRow[] } {
  let truePos = 0;
  let missed = 0;
  let falsePos = 0;
  const logs: AlertRow[] = [];
  const caught: Record<VitalId, boolean> = { hr: false, spo2: false, temp: false };

  for (const v of VITALS) {
    const eventAt = EVENT_START[v.id];
    let firedInEvent = false;
    for (let t = 0; t < TICKS; t++) {
      const value = SERIES[v.id][t];
      const alert = isAlert(value, bands[v.id]);
      const inEvent = t >= eventAt;
      if (alert && t <= upTo) {
        logs.push({ vital: v.id, t, value, kind: inEvent ? "true" : "false" });
      }
      if (alert && inEvent) firedInEvent = true;
      if (alert && !inEvent) falsePos++;
    }
    caught[v.id] = firedInEvent;
    if (firedInEvent) truePos++;
    else missed++;
  }
  return { score: { truePos, missed, falsePos }, logs };
}

interface AlertRow {
  vital: VitalId;
  t: number;
  value: number;
  kind: "true" | "false";
}

const VLABEL: Record<VitalId, string> = { hr: "HR", spo2: "SpO₂", temp: "Temp" };
const VUNIT: Record<VitalId, string> = { hr: "bpm", spo2: "%", temp: "°C" };

export default function ICUAlertMonitor({ onComplete }: ActivityProps) {
  const [bands, setBands] = useState<Bands>(defaultBands);
  const [tick, setTick] = useState<number>(-1); // -1 = not running
  const [running, setRunning] = useState<boolean>(false);
  const [solved, setSolved] = useState<boolean>(false);
  const [status, setStatus] = useState<string>(
    "Set each safe band, then press Run to play the patient's 30 seconds.",
  );
  const firedRef = useRef<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const upTo = running || tick >= 0 ? tick : TICKS - 1;
  const finished = tick >= TICKS - 1;

  // Live grading of whatever has played so far (full scenario once finished).
  const { score, logs } = useMemo(
    () => grade(bands, running ? tick : TICKS - 1),
    [bands, running, tick],
  );

  const stopTimer = useCallback((): void => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => stopTimer, [stopTimer]);

  // Drive the scripted playback, one tick per ~1s.
  const run = useCallback((): void => {
    if (solved) return;
    stopTimer();
    setTick(0);
    setRunning(true);
    setStatus("Recording… watching the live streams against your bands.");
    timerRef.current = setInterval(() => {
      setTick((prev) => {
        const next = prev + 1;
        if (next >= TICKS - 1) {
          stopTimer();
          setRunning(false);
          return TICKS - 1;
        }
        return next;
      });
    }, 220);
  }, [solved, stopTimer]);

  // When a finished run is a perfect catch, celebrate exactly once.
  useEffect(() => {
    if (!finished || running) return;
    const final = grade(bands, TICKS - 1).score;
    const perfect =
      final.truePos === 3 && final.missed === 0 && final.falsePos === 0;
    if (perfect && !firedRef.current) {
      firedRef.current = true;
      setSolved(true);
      setStatus("All 3 events caught, zero false alarms — rules verified!");
      onComplete({
        passed: true,
        stars: 3,
        detail: "Caught HR spike, SpO₂ drop & fever with no false alarms.",
      });
    } else if (!perfect) {
      // Friendly, specific, never scolding nudge.
      let nudge = "";
      if (final.falsePos > 0) {
        nudge =
          "A normal reading tripped an alarm — your safe band is too narrow somewhere.";
      } else if (final.missed > 0) {
        const missVital = VITALS.find((v) => {
          const eventAt = EVENT_START[v.id];
          for (let t = eventAt; t < TICKS; t++) {
            if (isAlert(SERIES[v.id][t], bands[v.id])) return false;
          }
          return true;
        });
        nudge = missVital
          ? `The ${VLABEL[missVital.id]} event slipped past — tighten that band toward the safe range.`
          : "One real event slipped past — tighten a band toward the safe range.";
      }
      setStatus(`${nudge} Adjust and Run again — you can't break it.`);
      onComplete({ passed: false, detail: nudge });
    }
  }, [finished, running, bands, onComplete]);

  const setBand = useCallback(
    (id: VitalId, key: keyof Band) =>
      (e: React.ChangeEvent<HTMLInputElement>): void => {
        const raw = Number(e.target.value);
        setBands((prev) => {
          const b = prev[id];
          // Keep low ≤ high so the band stays a valid range.
          const next: Band =
            key === "low"
              ? { low: Math.min(raw, b.high), high: b.high }
              : { low: b.low, high: Math.max(raw, b.low) };
          return { ...prev, [id]: next };
        });
      },
    [],
  );

  const reset = useCallback((): void => {
    stopTimer();
    setBands(defaultBands());
    setTick(-1);
    setRunning(false);
    setSolved(false);
    firedRef.current = false;
    setStatus(
      "Set each safe band, then press Run to play the patient's 30 seconds.",
    );
  }, [stopTimer]);

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink">
      <style>{`
        @keyframes g10iothospital-flash {
          0%,100% { opacity: 0.18; }
          50% { opacity: 0.5; }
        }
        @keyframes g10iothospital-pop {
          0% { transform: scale(0.7); opacity: 0; }
          60% { transform: scale(1.08); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g10iothospital-pulse {
          0%,100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>

      {/* Header + scoreboard */}
      <div
        className="panel rounded-xl p-3"
        style={
          solved
            ? { boxShadow: `0 0 0 1px ${ACCENT}, 0 0 24px -4px ${ACCENT}` }
            : undefined
        }
      >
        <div className="flex items-center justify-between">
          <span className="font-display flex items-center gap-1.5 text-sm">
            <span aria-hidden="true">🏥</span> ICU Alert Monitor
          </span>
          <span className="text-[11px] text-ink-faint" aria-hidden="true">
            t = {Math.max(0, upTo)}s
          </span>
        </div>
        <div
          className="mt-2 grid grid-cols-3 gap-2 text-center"
          role="status"
          aria-label={`Scoreboard: ${score.truePos} true alerts, ${score.missed} missed, ${score.falsePos} false alarms. Target is 3 true, 0 missed, 0 false.`}
        >
          <Stat label="true" value={score.truePos} target={3} good={score.truePos === 3} />
          <Stat label="missed" value={score.missed} target={0} good={score.missed === 0} />
          <Stat label="false" value={score.falsePos} target={0} good={score.falsePos === 0} />
        </div>
      </div>

      {/* Reference panel of clinically safe ranges */}
      <div className="panel rounded-xl px-3 py-2 text-[11px] text-ink-dim">
        <span className="text-ink-faint">Clinically safe ranges · </span>
        HR 60–100 bpm · SpO₂ ≥ 90% · Temp 36–38°C
      </div>

      {/* One live chart + band controls per vital */}
      {VITALS.map((v) => (
        <VitalCard
          key={v.id}
          def={v}
          band={bands[v.id]}
          upTo={upTo}
          running={running}
          onLow={setBand(v.id, "low")}
          onHigh={setBand(v.id, "high")}
        />
      ))}

      {/* Status line */}
      <div
        className="rounded-lg px-3 py-2 text-center text-xs"
        aria-live="polite"
        style={{
          color: solved ? "#05070d" : "#9aa6cf",
          background: solved ? ACCENT : "rgba(11,16,32,0.6)",
        }}
      >
        {solved ? "✨🎉 Verified! ⭐⭐⭐" : status}
      </div>

      {/* Anomaly timeline — colours caught events red once a run finishes */}
      {finished && !running && logs.length > 0 && (
        <div className="panel rounded-xl p-3">
          <div className="mb-1 text-[11px] text-ink-faint">
            Alert log (anomaly view)
          </div>
          <div className="flex flex-col gap-1">
            {logs
              .filter((l) => l.t === EVENT_START[l.vital] || l.kind === "false")
              .slice(0, 6)
              .map((l, i) => (
                <div
                  key={`${l.vital}-${l.t}-${i}`}
                  className="flex items-center justify-between rounded-md px-2 py-1 text-[11px]"
                  style={{
                    background: l.kind === "true" ? "rgba(248,113,113,0.12)" : "rgba(251,191,36,0.12)",
                    color: l.kind === "true" ? RED : "#fbbf24",
                  }}
                >
                  <span>
                    {l.kind === "true" ? "ALERT" : "false alarm"} · {VLABEL[l.vital]}{" "}
                    {l.value}
                    {VUNIT[l.vital] === "%" ? "%" : ` ${VUNIT[l.vital]}`}
                  </span>
                  <span className="text-ink-faint">@ t={l.t}s</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={run}
          disabled={running || solved}
          className="flex-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: ACCENT, color: "#05070d" }}
          aria-label="Run the 30-second scripted scenario against your bands"
        >
          {solved ? "Solved!" : running ? "Recording…" : finished ? "Run again" : "Run scenario"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
          aria-label="Reset bands and the scenario"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  target,
  good,
}: {
  label: string;
  value: number;
  target: number;
  good: boolean;
}) {
  return (
    <div
      className="rounded-lg py-1.5"
      style={{
        background: good ? "rgba(52,211,153,0.12)" : "rgba(148,163,184,0.08)",
      }}
    >
      <div
        className="font-display text-lg tabular-nums"
        style={{ color: good ? GREEN : "#cbd3ef" }}
      >
        {value}
      </div>
      <div className="text-[10px] text-ink-faint">
        {label} · need {target}
      </div>
    </div>
  );
}

function VitalCard({
  def,
  band,
  upTo,
  running,
  onLow,
  onHigh,
}: {
  def: VitalDef;
  band: Band;
  upTo: number;
  running: boolean;
  onLow: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onHigh: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const W = 300;
  const H = 84;
  const PAD = 4;
  const span = def.drawHigh - def.drawLow;
  const toX = (t: number): number => PAD + (t / (TICKS - 1)) * (W - PAD * 2);
  const toY = (val: number): number =>
    PAD + ((def.drawHigh - val) / span) * (H - PAD * 2);

  const series = SERIES[def.id];
  const visible = upTo < 0 ? -1 : upTo;
  const latest = visible >= 0 ? series[visible] : series[0];
  const latestAlert = visible >= 0 ? isAlert(latest, band) : false;

  // Polyline of the played-so-far portion.
  const points: string = series
    .slice(0, Math.max(1, visible + 1))
    .map((val, t) => `${toX(t).toFixed(1)},${toY(val).toFixed(1)}`)
    .join(" ");

  // Safe-band overlay rectangle (clamped to the drawing window).
  const bandTop = toY(Math.min(def.drawHigh, band.high));
  const bandBot = toY(Math.max(def.drawLow, band.low));

  const fmt = (n: number): string =>
    def.step < 1 ? n.toFixed(1) : String(Math.round(n));

  return (
    <div
      className="panel rounded-xl p-2"
      style={
        latestAlert
          ? { boxShadow: `0 0 0 1px ${RED}, 0 0 14px -6px ${RED}` }
          : undefined
      }
    >
      <div className="mb-1 flex items-center justify-between px-1 text-[11px]">
        <span className="text-ink-dim">
          {def.label}{" "}
          <span className="text-ink-faint">
            (safe {fmt(def.safeLow)}
            {def.id === "spo2" ? "+" : `–${fmt(def.safeHigh)}`} {def.unit})
          </span>
        </span>
        <span
          className="font-display tabular-nums"
          style={{ color: latestAlert ? RED : ACCENT }}
        >
          {visible >= 0 ? fmt(latest) : "—"} {def.unit}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        role="img"
        aria-label={`${def.label} live chart. Safe band set ${fmt(band.low)} to ${fmt(band.high)} ${def.unit}.`}
      >
        {/* learner's safe-band overlay */}
        <rect
          x={PAD}
          y={bandTop}
          width={W - PAD * 2}
          height={Math.max(0, bandBot - bandTop)}
          fill={GREEN}
          opacity={0.12}
        />
        <line x1={PAD} y1={bandTop} x2={W - PAD} y2={bandTop} stroke={GREEN} strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
        <line x1={PAD} y1={bandBot} x2={W - PAD} y2={bandBot} stroke={GREEN} strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />

        {/* full-run alert flash backdrop when current reading is out of band */}
        {latestAlert && (
          <rect
            x={0}
            y={0}
            width={W}
            height={H}
            fill={RED}
            style={{ animation: "g10iothospital-flash 0.6s ease-in-out infinite" }}
          />
        )}

        {/* played-so-far trace */}
        {visible >= 0 && (
          <polyline
            points={points}
            fill="none"
            stroke={ACCENT}
            strokeWidth={1.6}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* per-tick markers: red when outside the learner's band */}
        {visible >= 0 &&
          series.slice(0, visible + 1).map((val, t) => {
            const a = isAlert(val, band);
            return (
              <circle
                key={t}
                cx={toX(t)}
                cy={toY(val)}
                r={a ? 2.4 : 1.4}
                fill={a ? RED : ACCENT}
                style={
                  t === visible && running
                    ? { animation: "g10iothospital-pulse 0.5s ease-in-out infinite" }
                    : undefined
                }
              />
            );
          })}
      </svg>

      {/* paired LOW / HIGH threshold sliders */}
      <div className="mt-1 flex flex-col gap-1.5 px-1">
        <SliderRow
          label="LOW"
          value={band.low}
          def={def}
          onChange={onLow}
          fmt={fmt}
        />
        <SliderRow
          label="HIGH"
          value={band.high}
          def={def}
          onChange={onHigh}
          fmt={fmt}
        />
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  def,
  onChange,
  fmt,
}: {
  label: string;
  value: number;
  def: VitalDef;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fmt: (n: number) => string;
}) {
  return (
    <label className="flex items-center gap-2 text-[11px]">
      <span className="w-9 shrink-0 text-ink-faint">{label}</span>
      <input
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        onChange={onChange}
        aria-label={`${def.label} ${label} threshold, ${fmt(value)} ${def.unit}`}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-panel-2"
        style={{ accentColor: ACCENT, touchAction: "none" }}
      />
      <span
        className="w-12 shrink-0 text-right font-display tabular-nums"
        style={{ color: ACCENT }}
      >
        {fmt(value)}
      </span>
    </label>
  );
}
