"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Weather Station Dashboard — multi-sensor reading + calibration     */
/*  GOAL: each sensor measures ONE quantity; reading them together     */
/*  describes the weather, and a sensor that disagrees with a trusted  */
/*  reference must be calibrated back into agreement.                  */
/* ------------------------------------------------------------------ */

const ACCENT = "#a855f7";
const GOOD = "#34d399";
const BAD = "#f87171";

type SensorId = "temp" | "pressure" | "uv" | "light";
type SceneId = "sunny" | "cloudy" | "night" | "storm";
type ChipId = "bright" | "highuv" | "lowpress" | "dark";

interface SensorDef {
  id: SensorId;
  name: string;
  device: string;
  unit: string;
  glyph: string;
  min: number;
  max: number;
}

const SENSORS: readonly SensorDef[] = [
  { id: "temp", name: "Temperature", device: "DHT22", unit: "°C", glyph: "🌡️", min: -5, max: 45 },
  { id: "pressure", name: "Pressure", device: "BMP280", unit: "hPa", glyph: "🔵", min: 970, max: 1040 },
  { id: "uv", name: "UV Index", device: "UV", unit: "", glyph: "🟣", min: 0, max: 11 },
  { id: "light", name: "Light", device: "lux", unit: "lx", glyph: "💡", min: 0, max: 1000 },
] as const;

interface SceneDef {
  id: SceneId;
  name: string;
  emoji: string;
  /** Base reading for each sensor under this scene. */
  base: Record<SensorId, number>;
}

const SCENES: readonly SceneDef[] = [
  { id: "sunny", name: "Sunny Noon", emoji: "☀️", base: { temp: 31, pressure: 1022, uv: 9, light: 900 } },
  { id: "cloudy", name: "Cloudy", emoji: "☁️", base: { temp: 23, pressure: 1008, uv: 3, light: 380 } },
  { id: "night", name: "Night", emoji: "🌙", base: { temp: 16, pressure: 1015, uv: 0, light: 12 } },
  { id: "storm", name: "Storm Coming", emoji: "⛈️", base: { temp: 20, pressure: 984, uv: 2, light: 150 } },
] as const;

interface ChipDef {
  id: ChipId;
  label: string;
  /** The single sensor this description belongs to. */
  target: SensorId;
}

const CHIPS: readonly ChipDef[] = [
  { id: "bright", label: "bright", target: "light" },
  { id: "highuv", label: "high UV", target: "uv" },
  { id: "lowpress", label: "low pressure → rain coming", target: "pressure" },
  { id: "dark", label: "dark = night", target: "light" },
] as const;

/** The miscalibrated sensor (DHT22 reads 8° hot) and the trusted reference. */
const FAULTY: SensorId = "temp";
const FAULT_OFFSET = 8;

/** Per-sensor deterministic drift so gauges feel "live" without randomness. */
function drift(id: SensorId, tick: number): number {
  const phase = id === "temp" ? 0 : id === "pressure" ? 1.6 : id === "uv" ? 3.1 : 4.4;
  const amp = id === "temp" ? 0.6 : id === "pressure" ? 1.5 : id === "uv" ? 0.3 : 14;
  return Math.sin(tick / 7 + phase) * amp;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Gauge needle path for a value in [min,max] across a 240° arc. */
function needleAngle(v: number, min: number, max: number): number {
  const t = clamp((v - min) / (max - min), 0, 1);
  return -120 + t * 240; // degrees, 0 = straight up
}

interface DragState {
  chip: ChipId;
  x: number;
  y: number;
}

export default function WeatherStationDashboard({ onComplete }: ActivityProps) {
  const [scene, setScene] = useState<SceneId>("sunny");
  const [tick, setTick] = useState<number>(0);
  const [placed, setPlaced] = useState<Record<ChipId, boolean>>({
    bright: false,
    highuv: false,
    lowpress: false,
    dark: false,
  });
  const [glow, setGlow] = useState<SensorId | null>(null);
  const [bounce, setBounce] = useState<ChipId | null>(null);
  const [hint, setHint] = useState<string>("");
  const [drag, setDrag] = useState<DragState | null>(null);
  const [selected, setSelected] = useState<SensorId | null>(null);
  const [offset, setOffset] = useState<number>(0);
  const [tries, setTries] = useState<number>(0);
  const [won, setWon] = useState<boolean>(false);

  const wonRef = useRef<boolean>(false);
  const tileRefs = useRef<Record<SensorId, HTMLDivElement | null>>({
    temp: null,
    pressure: null,
    uv: null,
    light: null,
  });

  // Gentle "live" ticking. Pure counter → drift() is deterministic.
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 700);
    return () => window.clearInterval(t);
  }, []);

  const sceneDef = useMemo(
    () => SCENES.find((s) => s.id === scene) ?? SCENES[0],
    [scene],
  );

  /** Live reading for a sensor: scene base + drift, plus fault & user offset on temp. */
  const reading = useCallback(
    (id: SensorId): number => {
      const def = SENSORS.find((s) => s.id === id) ?? SENSORS[0];
      let v = sceneDef.base[id] + drift(id, tick);
      if (id === FAULTY) v += FAULT_OFFSET + offset;
      return clamp(v, def.min, def.max);
    },
    [sceneDef, tick, offset],
  );

  /** The trusted reference thermometer (no fault, no drift wobble baked in). */
  const reference = sceneDef.base[FAULTY];
  const calibrated = Math.abs(reference - reading(FAULTY)) <= 1;
  const allChips = CHIPS.every((c) => placed[c.id]);

  // WIN: all four chips on the right gauge AND the faulty sensor calibrated.
  useEffect(() => {
    if (allChips && calibrated && !wonRef.current) {
      wonRef.current = true;
      setWon(true);
      onComplete({
        passed: true,
        stars: 3,
        detail: "All sensors mapped and the DHT22 calibrated to the reference!",
      });
    }
  }, [allChips, calibrated, onComplete]);

  const handleScene = useCallback((id: SceneId) => {
    setScene(id);
  }, []);

  // ---- Chip dragging (pointer-based, touch friendly) ----
  const startDrag = useCallback(
    (chip: ChipId) => (e: React.PointerEvent<HTMLButtonElement>) => {
      if (placed[chip] || wonRef.current) return;
      e.preventDefault();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      setDrag({ chip, x: e.clientX, y: e.clientY });
      setHint("");
    },
    [placed],
  );

  const moveDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!drag) return;
      setDrag({ chip: drag.chip, x: e.clientX, y: e.clientY });
    },
    [drag],
  );

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!drag) return;
      const current = drag;
      setDrag(null);
      setTries((t) => t + 1);

      // Which tile did we drop over?
      let hitId: SensorId | null = null;
      for (const s of SENSORS) {
        const el = tileRefs.current[s.id];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (
          e.clientX >= r.left &&
          e.clientX <= r.right &&
          e.clientY >= r.top &&
          e.clientY <= r.bottom
        ) {
          hitId = s.id;
          break;
        }
      }

      const def = CHIPS.find((c) => c.id === current.chip);
      if (!def) return;

      if (hitId === def.target) {
        setPlaced((prev) => ({ ...prev, [current.chip]: true }));
        setGlow(hitId);
        window.setTimeout(() => setGlow(null), 700);
        setHint("");
      } else if (hitId) {
        setBounce(current.chip);
        window.setTimeout(() => setBounce(null), 450);
        const wrong = SENSORS.find((s) => s.id === hitId);
        setHint(
          `${def.label} isn't measured by the ${wrong?.name ?? ""} (${wrong?.device ?? ""}) sensor.`,
        );
        if (!wonRef.current) {
          onComplete({ passed: false, detail: "Not that sensor — try the gauge that measures it." });
        }
      }
    },
    [drag, onComplete],
  );

  const reset = useCallback(() => {
    wonRef.current = false;
    setWon(false);
    setPlaced({ bright: false, highuv: false, lowpress: false, dark: false });
    setOffset(0);
    setSelected(null);
    setGlow(null);
    setBounce(null);
    setHint("");
    setDrag(null);
    setScene("sunny");
  }, []);

  const remaining = CHIPS.filter((c) => !placed[c.id]);
  const placedCount = CHIPS.length - remaining.length;

  const status = won
    ? "Now your station agrees with the reference — sensors must be calibrated!"
    : !allChips
      ? `Match the clues: ${placedCount} / ${CHIPS.length} sensors described.`
      : !calibrated
        ? "All clues placed! One sensor disagrees with the reference — calibrate it."
        : "Calibrated!";

  return (
    <div
      className="flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink"
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      style={{ touchAction: drag ? "none" : undefined }}
    >
      <style>{`
        @keyframes g6weatherdashboard-bounce {
          0% { transform: scale(1); }
          40% { transform: scale(1.12) rotate(-4deg); }
          100% { transform: scale(1); }
        }
        @keyframes g6weatherdashboard-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g6weatherdashboard-glow {
          0%,100% { filter: drop-shadow(0 0 0 ${ACCENT}); }
          50% { filter: drop-shadow(0 0 6px ${ACCENT}); }
        }
        @keyframes g6weatherdashboard-pulse {
          0%,100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* ---------------- SCENE SELECTOR ---------------- */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-tech text-ink-faint">
          {sceneDef.emoji} Conditions — scroll &amp; pick
        </span>
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="radiogroup"
          aria-label="Weather scene"
        >
          {SCENES.map((s) => {
            const active = s.id === scene;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={s.name}
                onClick={() => handleScene(s.id)}
                className="shrink-0 rounded-lg border px-3 py-1.5 text-xs transition"
                style={{
                  borderColor: active ? ACCENT : "var(--color-line, #2a2f3a)",
                  background: active ? ACCENT : "transparent",
                  color: active ? "#0b0810" : "var(--color-ink-dim, #9aa6b2)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {s.emoji} {s.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------------- 2x2 GAUGE DASHBOARD ---------------- */}
      <div className="grid grid-cols-2 gap-2">
        {SENSORS.map((s) => {
          const v = reading(s.id);
          const isFaulty = s.id === FAULTY;
          const tileGlow = glow === s.id;
          const placedHere = CHIPS.filter((c) => c.target === s.id && placed[c.id]);
          const isSelected = selected === s.id;
          const showCalRing = isFaulty && (isSelected || won);
          const ringColor = won
            ? GOOD
            : isFaulty && isSelected && !calibrated
              ? BAD
              : tileGlow
                ? ACCENT
                : "var(--color-line, #2a2f3a)";
          return (
            <div
              key={s.id}
              ref={(el) => {
                tileRefs.current[s.id] = el;
              }}
              role="button"
              tabIndex={0}
              aria-label={`${s.name} sensor (${s.device}) reading ${v.toFixed(1)} ${s.unit}`}
              onClick={() => {
                if (isFaulty && !won) setSelected((cur) => (cur === s.id ? null : s.id));
              }}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && isFaulty && !won) {
                  e.preventDefault();
                  setSelected((cur) => (cur === s.id ? null : s.id));
                }
              }}
              className="relative flex flex-col items-center gap-1 rounded-xl border p-2"
              style={{
                borderColor: ringColor,
                background: "var(--color-panel, #12151c)",
                boxShadow: tileGlow ? `0 0 16px -4px ${ACCENT}` : undefined,
                cursor: isFaulty && !won ? "pointer" : "default",
                animation: tileGlow ? "g6weatherdashboard-glow .7s ease" : undefined,
                transition: "border-color .25s ease, box-shadow .25s ease",
              }}
            >
              <span className="flex items-center gap-1 text-[11px] text-ink-dim">
                <span aria-hidden>{s.glyph}</span>
                {s.name}
                <span className="text-ink-faint">· {s.device}</span>
              </span>

              {/* SVG gauge */}
              <svg viewBox="0 0 100 70" className="w-full" role="img" aria-hidden>
                {/* arc track */}
                <path
                  d={describeArc(50, 55, 34, -120, 120)}
                  fill="none"
                  stroke="var(--color-line, #2a2f3a)"
                  strokeWidth={6}
                  strokeLinecap="round"
                />
                {/* value arc */}
                <path
                  d={describeArc(50, 55, 34, -120, needleAngle(v, s.min, s.max))}
                  fill="none"
                  stroke={showCalRing && !calibrated ? BAD : ACCENT}
                  strokeWidth={6}
                  strokeLinecap="round"
                  style={{ transition: "all .35s ease" }}
                />
                {/* needle */}
                <g
                  transform={`rotate(${needleAngle(v, s.min, s.max)} 50 55)`}
                  style={{ transition: "transform .35s ease" }}
                >
                  <line x1={50} y1={55} x2={50} y2={26} stroke="#e5e7eb" strokeWidth={2} strokeLinecap="round" />
                </g>
                <circle cx={50} cy={55} r={3} fill="#e5e7eb" />
                <text x={50} y={50} textAnchor="middle" fontSize={11} fill={ACCENT} className="tabular-nums">
                  {s.id === "uv" ? v.toFixed(0) : v.toFixed(s.id === "pressure" ? 0 : 1)}
                </text>
              </svg>

              {/* reference thermometer beside the faulty sensor */}
              {isFaulty && (
                <span className="text-[10px] text-ink-faint">
                  ref 🌡️{" "}
                  <span style={{ color: calibrated ? GOOD : BAD }}>
                    {reference.toFixed(1)}°C
                  </span>
                </span>
              )}

              {/* placed chips badges */}
              {placedHere.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1">
                  {placedHere.map((c) => (
                    <span
                      key={c.id}
                      className="rounded-full px-1.5 py-0.5 text-[9px]"
                      style={{
                        background: `${ACCENT}22`,
                        color: ACCENT,
                        animation: "g6weatherdashboard-pop .4s ease",
                      }}
                    >
                      ✓ {c.label}
                    </span>
                  ))}
                </div>
              )}

              {showCalRing && (
                <span
                  className="absolute right-1 top-1 text-[9px]"
                  style={{ color: calibrated ? GOOD : BAD }}
                >
                  {calibrated ? "✓ cal" : "⚠ off"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ---------------- PART 1: CHIP TRAY ---------------- */}
      {!allChips && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-panel/60 p-2">
          <span className="text-[11px] uppercase tracking-tech text-ink-faint">
            Drag each clue onto the gauge that measures it
          </span>
          <div className="flex flex-wrap gap-2">
            {remaining.map((c) => (
              <button
                key={c.id}
                type="button"
                onPointerDown={startDrag(c.id)}
                aria-label={`Clue: ${c.label}. Drag onto its sensor.`}
                className="select-none rounded-lg border px-2.5 py-1.5 text-xs"
                style={{
                  borderColor: ACCENT,
                  background: `${ACCENT}1a`,
                  color: "#e9d5ff",
                  touchAction: "none",
                  visibility: drag?.chip === c.id ? "hidden" : "visible",
                  animation: bounce === c.id ? "g6weatherdashboard-bounce .45s ease" : undefined,
                }}
              >
                ⤴ {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- PART 2: CALIBRATION ---------------- */}
      {allChips && !won && (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-panel/60 p-3">
          {selected === FAULTY ? (
            <>
              <span className="text-[11px] text-ink-dim">
                Slide the calibration offset until the gauge matches the reference thermometer.
              </span>
              <label className="flex flex-col gap-1 text-xs">
                <span className="flex items-center justify-between">
                  <span className="text-ink-dim">offset</span>
                  <span className="tabular-nums" style={{ color: calibrated ? GOOD : ACCENT }}>
                    {offset > 0 ? "+" : ""}
                    {offset.toFixed(1)}°C
                  </span>
                </span>
                <input
                  type="range"
                  min={-12}
                  max={4}
                  step={0.5}
                  value={offset}
                  onChange={(e) => setOffset(Number(e.target.value))}
                  aria-label={`Temperature calibration offset, ${offset.toFixed(1)} degrees`}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2"
                  style={{ accentColor: ACCENT, touchAction: "none" }}
                />
              </label>
              <span className="text-[11px]" style={{ color: calibrated ? GOOD : BAD }}>
                gauge {reading(FAULTY).toFixed(1)}°C vs reference {reference.toFixed(1)}°C ·
                gap {Math.abs(reading(FAULTY) - reference).toFixed(1)}°
              </span>
            </>
          ) : (
            <span
              className="text-[11px] text-ink-dim"
              style={{ animation: "g6weatherdashboard-pulse 1.6s ease infinite" }}
            >
              One sensor reads warmer than the trusted reference beside it. Tap the gauge you
              suspect to open its calibration.
            </span>
          )}
        </div>
      )}

      {/* ---------------- STATUS + CONTROLS ---------------- */}
      <div
        role="status"
        aria-live="polite"
        className="rounded-lg px-3 py-2 text-center text-xs"
        style={{
          background: won ? `${GOOD}1a` : "var(--color-panel, #12151c)",
          color: won ? GOOD : "var(--color-ink-dim, #9aa6b2)",
          border: won ? `1px solid ${GOOD}` : "1px solid var(--color-line, #2a2f3a)",
        }}
      >
        {won ? "✨🎉 ⭐⭐⭐ " : ""}
        {status}
      </div>

      {hint && !won && (
        <p className="text-center text-[11px]" style={{ color: BAD }}>
          {hint}
        </p>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-ink-faint">Drops: {tries}</span>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
          aria-label="Reset the dashboard"
        >
          Reset
        </button>
      </div>

      {/* ---------------- DRAG GHOST ---------------- */}
      {drag && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border px-2.5 py-1.5 text-xs"
          style={{
            left: drag.x,
            top: drag.y,
            transform: "translate(-50%, -50%)",
            borderColor: ACCENT,
            background: ACCENT,
            color: "#0b0810",
            fontWeight: 600,
          }}
        >
          ⤴ {CHIPS.find((c) => c.id === drag.chip)?.label}
        </div>
      )}
    </div>
  );
}

/* ----- SVG arc helper (degrees, clockwise, 0° = up) ----- */
function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = polar(cx, cy, r, endDeg);
  const end = polar(cx, cy, r, startDeg);
  const large = Math.abs(endDeg - startDeg) <= 180 ? 0 : 1;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${large} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}
