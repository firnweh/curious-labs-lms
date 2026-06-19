"use client";
// Learning goal: a 3D part's geometry sets its mass AND where stress
// concentrates under load — adding a fillet at a sharp junction sheds peak
// stress without overweighting the frame. Win = light AND strong at once.
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

const ACCENT = "#f59e0b";

/** PLA filament density, grams per cubic centimetre. */
const DENSITY = 1.24;
/** Wall thickness of the printed frame, centimetres (fixed). */
const THICK = 0.6;
/** Fixed solid volume of the central hub + 4 motor mounts, cm³. */
const HUB_VOL = 14.0;
const MOUNT_VOL = 4 * 2.2;

/** Mass must stay under this (grams) or the drone is too heavy to fly. */
const MAX_MASS = 120;
/** Max stress must stay under this (MPa) or an arm snaps mid-flight. */
const TARGET_STRESS = 6.0;

/** Slider ranges chosen so a light-AND-strong design always exists. */
const L_MIN = 8;
const L_MAX = 16;
const W_MIN = 0.8;
const W_MAX = 2.2;
const F_MIN = 0;
const F_MAX = 6;

/** A deliberately failing start: light enough, but the sharp junction is overstressed. */
const START = { length: 14, width: 1.0, fillet: 0 } as const;

interface Design {
  /** Arm length, cm. */
  length: number;
  /** Arm width, cm. */
  width: number;
  /** Fillet radius at the arm↔hub junction, mm. */
  fillet: number;
}

/** Total frame mass in grams from the chosen geometry. */
function massOf(d: Design): number {
  const armVol = 4 * (d.length * d.width * THICK);
  return (armVol + HUB_VOL + MOUNT_VOL) * DENSITY;
}

/**
 * Peak bending stress (MPa) at the arm root under a 500 g motor load.
 * Beam bending σ = M·c / I rises with arm length and falls with width;
 * the fillet relieves the stress concentration at the sharp inner corner.
 */
function stressOf(d: Design): number {
  const force = 4.905; // N from a 500 g motor (m·g)
  const moment = force * (d.length / 100); // N·m, arm length in metres
  const t = THICK / 100;
  const w = d.width / 100;
  const I = (w * t * t * t) / 12; // second moment of area, m⁴
  const c = t / 2;
  const sigma = (moment * c) / I / 1e6; // MPa
  const filletFactor = 1 / (1 + 0.16 * d.fillet); // sharp corner = full stress
  return sigma * filletFactor;
}

/** Map a 0..1 stress fraction to a blue→cyan→amber→red heat colour. */
function heat(frac: number): string {
  const f = Math.max(0, Math.min(1, frac));
  if (f < 0.5) {
    const k = f / 0.5; // blue → cyan
    return `rgb(${Math.round(40 + k * 20)}, ${Math.round(120 + k * 90)}, ${Math.round(220 - k * 20)})`;
  }
  const k = (f - 0.5) / 0.5; // amber → red
  return `rgb(${Math.round(245)}, ${Math.round(180 - k * 150)}, ${Math.round(40 - k * 30)})`;
}

interface SliderDef {
  key: keyof Design;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

const SLIDERS: readonly SliderDef[] = [
  { key: "length", label: "Arm length", hint: "longer reach, more leverage", min: L_MIN, max: L_MAX, step: 0.5, unit: "cm" },
  { key: "width", label: "Arm width", hint: "wider carries more load", min: W_MIN, max: W_MAX, step: 0.1, unit: "cm" },
  { key: "fillet", label: "Fillet radius", hint: "rounds the sharp junction", min: F_MIN, max: F_MAX, step: 0.5, unit: "mm" },
] as const;

export default function DroneFrameFEA({ onComplete }: ActivityProps) {
  const [design, setDesign] = useState<Design>({ ...START });
  const [ran, setRan] = useState<boolean>(false);
  const [prevStress, setPrevStress] = useState<number | null>(null);
  const [rotated, setRotated] = useState<boolean>(false);
  const [solved, setSolved] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("Tune the frame, then run the stress test.");
  const firedRef = useRef<boolean>(false);

  const mass = useMemo<number>(() => massOf(design), [design]);
  const stress = useMemo<number>(() => stressOf(design), [design]);

  /** Stress shown on the heat map: highest just-run value, else live preview. */
  const shownStress = ran ? stress : stressOf(design);
  const overMass = mass >= MAX_MASS;
  const overStress = shownStress >= TARGET_STRESS;

  // Heat fraction relative to a fixed worst-case so colours are comparable run-to-run.
  const WORST = 16.5;
  const hotFrac = Math.max(0, Math.min(1, shownStress / WORST));
  const hotColor = heat(hotFrac);
  const massFrac = Math.max(0, Math.min(1, mass / 150));

  const update = useCallback(
    (key: keyof Design) => (e: React.ChangeEvent<HTMLInputElement>): void => {
      if (solved) return;
      const v = Number(e.target.value);
      setRan(false);
      setStatus("Geometry changed — run FEA to test it.");
      setDesign((prev) => ({ ...prev, [key]: v }));
    },
    [solved],
  );

  const runFEA = useCallback((): void => {
    if (solved) return;
    const m = massOf(design);
    const s = stressOf(design);
    setPrevStress(ran ? stress : null);
    setRan(true);

    if (m < MAX_MASS && s < TARGET_STRESS) {
      setSolved(true);
      setStatus("Flight-ready! Light frame, stress safely below the limit.");
      if (!firedRef.current) {
        firedRef.current = true;
        onComplete({
          passed: true,
          stars: 3,
          detail: `mass ${m.toFixed(0)} g · max stress ${s.toFixed(1)} MPa`,
        });
      }
      return;
    }

    // Kind, specific nudge — never scold, always recoverable.
    let nudge = "";
    if (m >= MAX_MASS && s >= TARGET_STRESS) {
      nudge = "Too heavy AND overstressed — round the junction with a bigger fillet, then trim width or length.";
    } else if (m >= MAX_MASS) {
      nudge = `Strong but heavy (${m.toFixed(0)} g). Shorten or narrow an arm to drop under ${MAX_MASS} g.`;
    } else {
      nudge = `Light enough, but the junction peaks at ${s.toFixed(1)} MPa. Add fillet radius to relieve it (target under ${TARGET_STRESS} MPa).`;
    }
    setStatus(nudge);
    onComplete({ passed: false, detail: nudge });
  }, [solved, design, ran, stress, onComplete]);

  const reset = useCallback((): void => {
    setDesign({ ...START });
    setRan(false);
    setPrevStress(null);
    setSolved(false);
    setStatus("Tune the frame, then run the stress test.");
  }, []);

  // Geometry of the SVG drone (centred at 110,90 in a 220×180 viewport).
  const cx = 110;
  const cy = 90;
  const armPx = 4 + (design.length - L_MIN) / (L_MAX - L_MIN) * 5; // half-width in px
  const armLen = 26 + (design.length - L_MIN) / (L_MAX - L_MIN) * 30;
  const filletPx = (design.fillet / F_MAX) * 6;
  const hubR = 14;

  return (
    <div className="flex w-full flex-col gap-3" style={{ maxWidth: 440 }}>
      <style>{`
        @keyframes g8droneframefea-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        @keyframes g8droneframefea-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g8droneframefea-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* CAD-style viewport */}
      <div
        className="panel relative overflow-hidden rounded-xl border p-2"
        style={{
          borderColor: solved ? ACCENT : "var(--color-line, #27314f)",
          boxShadow: solved ? `0 0 24px -6px ${ACCENT}` : undefined,
        }}
      >
        <div className="mb-1 flex items-center justify-between px-1 text-[11px] text-ink-faint">
          <span>🚁 frame.stl · {rotated ? "side view" : "top view"}</span>
          <button
            type="button"
            onClick={() => setRotated((r) => !r)}
            className="rounded-md border border-line bg-panel/60 px-2 py-0.5 text-[11px] text-ink-dim"
            aria-label="Toggle viewport rotation between top and side view"
          >
            ⟳ rotate
          </button>
        </div>

        <svg
          viewBox="0 0 220 180"
          className="block w-full"
          role="img"
          aria-label="A four-armed drone frame in a CAD viewport, coloured by stress from blue (low) to red (high)."
          style={{ maxHeight: 240, touchAction: "manipulation" }}
        >
          {/* faint CAD grid */}
          <g stroke="#1c2540" strokeWidth={1}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <line key={`gv${i}`} x1={20 + i * 30} y1={10} x2={20 + i * 30} y2={170} />
            ))}
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <line key={`gh${i}`} x1={10} y1={20 + i * 28} x2={210} y2={20 + i * 28} />
            ))}
          </g>

          {/* the frame: a top-down + (or a flattened side bar when rotated) */}
          <g
            transform={rotated ? `translate(${cx} ${cy}) scale(1 0.42) translate(${-cx} ${-cy})` : undefined}
            style={{ transition: "transform 300ms ease" }}
          >
            {[0, 90, 180, 270].map((deg) => (
              <g key={deg} transform={`rotate(${deg} ${cx} ${cy})`}>
                {/* arm beam — coloured by current stress */}
                <rect
                  x={cx - armPx}
                  y={cy - hubR - armLen}
                  width={armPx * 2}
                  height={armLen + 4}
                  rx={1}
                  fill={hotColor}
                  stroke="#0b1020"
                  strokeWidth={1}
                />
                {/* fillet: a rounded gusset filling the inner corner at the hub */}
                {filletPx > 0.4 && (
                  <path
                    d={`M ${cx - armPx - filletPx} ${cy - hubR + 2}
                        Q ${cx - armPx} ${cy - hubR + 2} ${cx - armPx} ${cy - hubR - filletPx}
                        L ${cx - armPx} ${cy - hubR + 2} Z
                        M ${cx + armPx + filletPx} ${cy - hubR + 2}
                        Q ${cx + armPx} ${cy - hubR + 2} ${cx + armPx} ${cy - hubR - filletPx}
                        L ${cx + armPx} ${cy - hubR + 2} Z`}
                    fill={heat(Math.max(0, hotFrac - 0.35))}
                    stroke="#0b1020"
                    strokeWidth={0.6}
                  />
                )}
                {/* motor mount ring at the arm tip */}
                <circle cx={cx} cy={cy - hubR - armLen} r={6} fill="#0b1020" stroke={ACCENT} strokeWidth={1.4} />
                {/* 500 g load arrow when FEA has run */}
                {ran && (
                  <g stroke={overStress ? "#f87171" : "#34d399"} strokeWidth={1.6}>
                    <line x1={cx} y1={cy - hubR - armLen - 14} x2={cx} y2={cy - hubR - armLen - 4} />
                    <polygon
                      points={`${cx - 3},${cy - hubR - armLen - 7} ${cx + 3},${cy - hubR - armLen - 7} ${cx},${cy - hubR - armLen - 2}`}
                      fill={overStress ? "#f87171" : "#34d399"}
                      stroke="none"
                    />
                  </g>
                )}
              </g>
            ))}

            {/* central hub */}
            <circle cx={cx} cy={cy} r={hubR} fill="#243049" stroke={ACCENT} strokeWidth={1.4} />
            <circle cx={cx} cy={cy} r={5} fill="#0b1020" />

            {/* hot-spot marker when overstressed after a run */}
            {ran && overStress && (
              <circle
                cx={cx}
                cy={cy - hubR - 2}
                r={5}
                fill="none"
                stroke="#f87171"
                strokeWidth={2}
                style={{ animation: "g8droneframefea-pulse 1s ease-in-out infinite" }}
              />
            )}
          </g>

          {/* win stamp */}
          {solved && (
            <g style={{ animation: "g8droneframefea-pop 360ms ease-out both" }} transform={`rotate(-12 ${cx} 26)`}>
              <rect x={cx - 58} y={14} width={116} height={24} rx={5} fill="none" stroke="#34d399" strokeWidth={2} />
              <text x={cx} y={31} textAnchor="middle" fontSize={12} fontWeight={700} fill="#34d399">
                ✓ FLIGHT-READY FRAME
              </text>
            </g>
          )}
        </svg>

        {/* heat-map legend */}
        <div className="mt-1 flex items-center gap-2 px-1 text-[10px] text-ink-faint">
          <span>low</span>
          <span
            className="h-2 flex-1 rounded-full"
            style={{ background: "linear-gradient(90deg, rgb(40,120,220), rgb(60,210,200), rgb(245,180,40), rgb(245,30,10))" }}
          />
          <span>high stress</span>
        </div>
      </div>

      {/* live readouts: mass gauge + stress */}
      <div className="grid grid-cols-2 gap-2">
        <div className="panel rounded-xl border border-line p-2">
          <div className="flex items-center justify-between text-[11px] text-ink-dim">
            <span>mass</span>
            <span
              className="font-display tabular-nums"
              style={{ color: overMass ? "#f87171" : "#34d399" }}
              aria-label={`mass ${mass.toFixed(0)} grams, limit ${MAX_MASS} grams`}
            >
              {mass.toFixed(0)} g
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-panel-2">
            <div
              className="h-full rounded-full"
              style={{
                width: `${massFrac * 100}%`,
                background: overMass ? "#f87171" : "#34d399",
                transition: "width 200ms ease, background 200ms ease",
              }}
            />
          </div>
          <div className="mt-0.5 text-[10px] text-ink-faint">limit {MAX_MASS} g</div>
        </div>

        <div className="panel rounded-xl border border-line p-2">
          <div className="flex items-center justify-between text-[11px] text-ink-dim">
            <span>max stress</span>
            <span
              className="font-display tabular-nums"
              style={{ color: ran ? (overStress ? "#f87171" : "#34d399") : "#9aa6cf" }}
              aria-label={`max stress ${shownStress.toFixed(1)} megapascals, target ${TARGET_STRESS} megapascals`}
            >
              {ran ? `${shownStress.toFixed(1)} MPa` : "— run —"}
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-panel-2">
            <div
              className="h-full rounded-full"
              style={{ width: `${hotFrac * 100}%`, background: hotColor, transition: "width 200ms ease" }}
            />
          </div>
          <div className="mt-0.5 text-[10px] text-ink-faint">
            target &lt; {TARGET_STRESS} MPa
            {ran && prevStress !== null && (
              <span style={{ color: "#34d399" }}> · was {prevStress.toFixed(1)}</span>
            )}
          </div>
        </div>
      </div>

      {/* sliders */}
      <div className="panel flex flex-col gap-2.5 rounded-xl border border-line p-3">
        {SLIDERS.map(({ key, label, hint, min, max, step, unit }) => (
          <label key={key} className="flex flex-col gap-1 text-xs">
            <span className="flex items-center justify-between">
              <span className="text-ink-dim">
                {label} <span className="text-ink-faint">· {hint}</span>
              </span>
              <span className="font-display tabular-nums" style={{ color: ACCENT }}>
                {design[key].toFixed(1)} {unit}
              </span>
            </span>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={design[key]}
              onChange={update(key)}
              disabled={solved}
              aria-label={`${label}, ${design[key].toFixed(1)} ${unit}`}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-60"
              style={{ accentColor: ACCENT, touchAction: "none" }}
            />
          </label>
        ))}
      </div>

      {/* status + actions */}
      <div
        className="font-mono rounded-md px-3 py-2 text-center text-xs"
        role="status"
        aria-live="polite"
        style={{
          color: solved ? "#05070d" : "#9aa6cf",
          background: solved ? "#34d399" : "transparent",
          border: solved ? "none" : "1px solid var(--color-line, #27314f)",
        }}
      >
        {solved ? "✨🎉 Flight-ready frame — ⭐⭐⭐" : status}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onPointerDown={runFEA}
          disabled={solved}
          className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
          style={{ background: ACCENT, color: "#05070d" }}
          aria-label="Run finite element stress analysis on the current frame"
        >
          {solved ? "Solved!" : "Run FEA ▶"}
        </button>
        <button
          type="button"
          onPointerDown={reset}
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
          aria-label="Reset the frame to its starting dimensions"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
