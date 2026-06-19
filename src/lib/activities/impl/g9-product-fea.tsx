"use client";
// Learning goal: a product's geometry decides both its mass AND where stress
// concentrates under load. Targeted reinforcement (thicker walls, ribs, a
// rounded fillet) can cut the peak stress at a failure zone by a lot while
// barely adding mass — design smarter, not just heavier.
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

const ACCENT = "#f59e0b";

/** PETG print density, grams per cubic centimetre. */
const DENSITY = 1.27;
/** Fixed volume of the base + arm panels that don't change, cm³. */
const FIXED_VOL = 9.5;

/** Brief: a foldable phone stand for a desk. Hard caps from the client. */
const MAX_MASS = 60; // grams — must post light & cheap to ship
const MAX_WALL = 4; // mm
const RIB_MAX = 4;

/** Win thresholds, measured against the un-reinforced baseline. */
const STRESS_DROP = 0.2; // peak stress must fall > 20%
const MASS_GROWTH = 0.15; // mass may rise at most 15%

interface Design {
  /** Wall thickness, mm. */
  wall: number;
  /** Number of reinforcing ribs across the hinge, 0–4. */
  ribs: number;
  /** Rounded fillet at the hinge corner (vs a sharp corner). */
  fillet: boolean;
}

/** The un-reinforced baseline the brief ships with: thin, no ribs, sharp corner. */
const BASELINE: Design = { wall: 2, ribs: 0, fillet: false };
const START: Design = { wall: 2, ribs: 0, fillet: false };

/** Total stand mass in grams from the chosen geometry. */
function massOf(d: Design): number {
  const wallVol = d.wall * 1.6; // cm³ per mm of wall over the loaded panels
  const ribVol = d.ribs * 0.9; // each rib adds a little material
  return (FIXED_VOL + wallVol + ribVol) * DENSITY;
}

/**
 * Peak von Mises stress (MPa) at the hinge under a fixed phone load.
 * Thin walls raise bending stress (∝ 1/wall²); a sharp inner corner adds a
 * stress-concentration factor; ribs spread the load and shed it. Deterministic.
 */
function stressOf(d: Design): number {
  const base = 64; // MPa·mm² — load × geometry constant at the hinge
  const bending = base / (d.wall * d.wall); // thin walls bend hard
  const kt = d.fillet ? 1.0 : 1.85; // sharp corner concentrates stress
  const ribRelief = 1 / (1 + 0.28 * d.ribs); // honeycomb-style load spreading
  return bending * kt * ribRelief;
}

/** Map a 0..1 stress fraction to a blue→cyan→amber→red heat colour. */
function heat(frac: number): string {
  const f = Math.max(0, Math.min(1, frac));
  if (f < 0.5) {
    const k = f / 0.5; // blue → cyan
    return `rgb(${Math.round(40 + k * 20)}, ${Math.round(120 + k * 90)}, ${Math.round(220 - k * 20)})`;
  }
  const k = (f - 0.5) / 0.5; // amber → red
  return `rgb(245, ${Math.round(180 - k * 150)}, ${Math.round(40 - k * 30)})`;
}

/** Worst-case stress for a stable colour scale across runs. */
const WORST = stressOf({ wall: 1, ribs: 0, fillet: false });

interface SliderDef {
  key: "wall" | "ribs";
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

const SLIDERS: readonly SliderDef[] = [
  { key: "wall", label: "Wall thickness", hint: "thicker resists bending", min: 1, max: MAX_WALL, step: 0.5, unit: "mm" },
  { key: "ribs", label: "Reinforcing ribs", hint: "spread load like a honeycomb", min: 0, max: RIB_MAX, step: 1, unit: "" },
] as const;

const BASE_STRESS = stressOf(BASELINE);
const BASE_MASS = massOf(BASELINE);

export default function ProductFEA({ onComplete }: ActivityProps) {
  const [design, setDesign] = useState<Design>({ ...START });
  const [ran, setRan] = useState<boolean>(false);
  const [solved, setSolved] = useState<boolean>(false);
  const [status, setStatus] = useState<string>(
    "Model the stand, then run FEA to find the hot-spot.",
  );
  const firedRef = useRef<boolean>(false);

  const mass = useMemo<number>(() => massOf(design), [design]);
  const stress = useMemo<number>(() => stressOf(design), [design]);

  const overMass = mass > MAX_MASS;
  const hotFrac = Math.max(0, Math.min(1, stress / WORST));
  const hotColor = heat(hotFrac);

  // Deltas vs the shipped baseline — the heart of the design review.
  const stressDrop = (BASE_STRESS - stress) / BASE_STRESS; // fraction reduced
  const massGrowth = (mass - BASE_MASS) / BASE_MASS; // fraction added
  const passStress = stressDrop > STRESS_DROP;
  const passMassGrowth = massGrowth <= MASS_GROWTH;
  const passCap = !overMass;

  const update = useCallback(
    (key: "wall" | "ribs") => (e: React.ChangeEvent<HTMLInputElement>): void => {
      if (solved) return;
      const v = Number(e.target.value);
      setRan(false);
      setStatus("Geometry changed — re-run FEA to test it.");
      setDesign((prev) => ({ ...prev, [key]: v }));
    },
    [solved],
  );

  const toggleFillet = useCallback((): void => {
    if (solved) return;
    setRan(false);
    setStatus("Corner reshaped — re-run FEA to test it.");
    setDesign((prev) => ({ ...prev, fillet: !prev.fillet }));
  }, [solved]);

  const runFEA = useCallback((): void => {
    if (solved) return;
    setRan(true);

    if (passStress && passMassGrowth && passCap) {
      setSolved(true);
      setStatus("Design review passed — peak stress cut, mass held.");
      if (!firedRef.current) {
        firedRef.current = true;
        onComplete({
          passed: true,
          stars: 3,
          detail: `stress −${Math.round(stressDrop * 100)}% · mass +${Math.round(massGrowth * 100)}% · ${mass.toFixed(0)} g`,
        });
      }
      return;
    }

    // Kind, specific nudge — never scold, always recoverable.
    let nudge = "";
    if (!passCap) {
      nudge = `Over the ${MAX_MASS} g cap (${mass.toFixed(0)} g). Trim wall thickness, then lean on ribs and a fillet to stay strong.`;
    } else if (!passStress && !passMassGrowth) {
      nudge = "Heavy AND not strong enough yet. Round the hinge corner and add ribs — they cut stress without much mass.";
    } else if (!passStress) {
      nudge = `Stress only down ${Math.round(stressDrop * 100)}% (need >20%). Round the corner or add a rib at the hinge.`;
    } else {
      nudge = `Strong, but mass up ${Math.round(massGrowth * 100)}% (max +15%). Thin the wall a touch — ribs are lighter per strength.`;
    }
    setStatus(nudge);
    onComplete({ passed: false, detail: nudge });
  }, [solved, passStress, passMassGrowth, passCap, stressDrop, massGrowth, mass, onComplete]);

  const reset = useCallback((): void => {
    setDesign({ ...START });
    setRan(false);
    setSolved(false);
    setStatus("Model the stand, then run FEA to find the hot-spot.");
  }, []);

  // SVG geometry of the iso phone stand (base wedge + back rest).
  const wallPx = 2 + (design.wall - 1) * 2.2; // visible thickness of the rest panel
  const filletR = design.fillet ? 9 : 1.5;
  // Pre-run the hinge shows neutral steel; post-run it shows the heat colour.
  const hingeColor = ran ? hotColor : "#33415a";

  return (
    <div className="flex w-full flex-col gap-3" style={{ maxWidth: 440 }}>
      <style>{`
        @keyframes g9productfea-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes g9productfea-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g9productfea-rise {
          from { transform: translateY(6px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {/* Design brief */}
      <div className="panel rounded-xl border border-line p-3 text-[11px] leading-snug text-ink-dim">
        <div className="mb-1 flex items-center gap-1.5 font-display text-xs" style={{ color: ACCENT }}>
          🛠️ Brief · Foldable phone stand
        </div>
        <p>
          Client: a desk user. Keep it under <strong>{MAX_MASS} g</strong> and{" "}
          <strong>{MAX_WALL} mm</strong> walls. Biomimicry tip:{" "}
          <em>honeycomb ribs = light + strong</em>. The hinge is the failure zone.
        </p>
      </div>

      {/* CAD-style viewport */}
      <div
        className="panel relative overflow-hidden rounded-xl border p-2"
        style={{
          borderColor: solved ? ACCENT : "var(--color-line, #27314f)",
          boxShadow: solved ? `0 0 24px -6px ${ACCENT}` : undefined,
        }}
      >
        <div className="mb-1 flex items-center justify-between px-1 text-[11px] text-ink-faint">
          <span>📐 stand.step · iso view</span>
          <span>{ran ? "FEA: von Mises" : "model"}</span>
        </div>

        <svg
          viewBox="0 0 220 170"
          className="block w-full"
          role="img"
          aria-label="An isometric foldable phone stand in a CAD viewport. The hinge is coloured by stress from blue (low) to red (high) after running the analysis."
          style={{ maxHeight: 240, touchAction: "manipulation" }}
        >
          {/* faint CAD grid */}
          <g stroke="#1c2540" strokeWidth={1}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <line key={`gv${i}`} x1={20 + i * 30} y1={10} x2={20 + i * 30} y2={160} />
            ))}
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <line key={`gh${i}`} x1={10} y1={18 + i * 26} x2={210} y2={18 + i * 26} />
            ))}
          </g>

          {/* iso base wedge (the foot) */}
          <polygon points="46,128 150,128 176,112 72,112" fill="#243049" stroke={ACCENT} strokeWidth={1.2} />
          <polygon points="150,128 150,140 176,124 176,112" fill="#1a2336" stroke={ACCENT} strokeWidth={1.2} />
          <polygon points="46,128 46,140 150,140 150,128" fill="#1e2840" stroke={ACCENT} strokeWidth={1.2} />

          {/* back rest panel — thickness driven by wall slider */}
          <g>
            <polygon
              points={`72,112 ${72 + wallPx},${112 - wallPx} ${150 + wallPx},${56 - wallPx} 150,56`}
              fill="#2c3a57"
              stroke="#0b1020"
              strokeWidth={1}
            />
            <polygon
              points="72,112 150,56 158,60 80,116"
              fill="#33425f"
              stroke="#0b1020"
              strokeWidth={1}
            />
          </g>

          {/* reinforcing ribs across the panel (honeycomb-style) */}
          {Array.from({ length: design.ribs }, (_, i) => {
            const t = (i + 1) / (RIB_MAX + 1);
            const x1 = 72 + t * 78;
            const y1 = 112 - t * 56;
            return (
              <line
                key={`rib${i}`}
                x1={x1}
                y1={y1}
                x2={x1 + wallPx}
                y2={y1 - wallPx}
                stroke={ACCENT}
                strokeWidth={1.6}
                opacity={0.85}
                style={{ animation: "g9productfea-rise 240ms ease-out both" }}
              />
            );
          })}

          {/* the hinge (failure zone) — sharp corner or rounded fillet */}
          <path
            d={`M 60,118 Q ${72 - filletR / 2},${112 + filletR / 2} 72,112 L 80,116 Q ${72},${118} ${68},${122} Z`}
            fill={hingeColor}
            stroke="#0b1020"
            strokeWidth={1}
          />
          <circle cx={70} cy={114} r={filletR} fill="none" stroke="#0b1020" strokeWidth={0.8} opacity={0.5} />

          {/* phone load arrow once FEA runs */}
          {ran && (
            <g stroke={passStress ? "#34d399" : "#f87171"} strokeWidth={1.8}>
              <line x1={120} y1={62} x2={120} y2={80} />
              <polygon
                points="116,76 124,76 120,84"
                fill={passStress ? "#34d399" : "#f87171"}
                stroke="none"
              />
            </g>
          )}

          {/* hot-spot marker at the hinge when stress is still high */}
          {ran && !passStress && (
            <circle
              cx={70}
              cy={114}
              r={9}
              fill="none"
              stroke="#f87171"
              strokeWidth={2}
              style={{ animation: "g9productfea-pulse 1s ease-in-out infinite" }}
            />
          )}

          {/* win stamp */}
          {solved && (
            <g style={{ animation: "g9productfea-pop 360ms ease-out both" }} transform="rotate(-11 110 28)">
              <rect x={52} y={16} width={116} height={24} rx={5} fill="none" stroke="#34d399" strokeWidth={2} />
              <text x={110} y={33} textAnchor="middle" fontSize={11} fontWeight={700} fill="#34d399">
                ✓ DESIGN REVIEW PASSED
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

      {/* before / after delta bars */}
      <div className="grid grid-cols-2 gap-2">
        <DeltaCard
          label="peak stress"
          before={BASE_STRESS}
          after={stress}
          unit="MPa"
          good={passStress}
          revealed={ran}
          note={ran ? `−${Math.round(stressDrop * 100)}% · need >20%` : "run FEA"}
          tick={passStress}
        />
        <DeltaCard
          label="mass"
          before={BASE_MASS}
          after={mass}
          unit="g"
          good={passMassGrowth && passCap}
          revealed
          note={overMass ? `over ${MAX_MASS} g cap!` : `+${Math.round(massGrowth * 100)}% · max +15%`}
          tick={passMassGrowth && passCap}
        />
      </div>

      {/* modelling controls */}
      <div className="panel flex flex-col gap-2.5 rounded-xl border border-line p-3">
        {SLIDERS.map(({ key, label, hint, min, max, step, unit }) => (
          <label key={key} className="flex flex-col gap-1 text-xs">
            <span className="flex items-center justify-between">
              <span className="text-ink-dim">
                {label} <span className="text-ink-faint">· {hint}</span>
              </span>
              <span className="font-display tabular-nums" style={{ color: ACCENT }}>
                {key === "ribs" ? design.ribs : design.wall.toFixed(1)} {unit}
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
              aria-label={`${label}, ${key === "ribs" ? design.ribs : design.wall.toFixed(1)} ${unit}`}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-60"
              style={{ accentColor: ACCENT, touchAction: "none" }}
            />
          </label>
        ))}

        <button
          type="button"
          onPointerDown={toggleFillet}
          disabled={solved}
          aria-pressed={design.fillet}
          aria-label={`Hinge corner: ${design.fillet ? "rounded fillet, tap to make it sharp" : "sharp corner, tap to round it"}`}
          className="mt-0.5 flex items-center justify-between rounded-lg border border-line bg-panel/60 px-3 py-1.5 text-xs text-ink-dim disabled:opacity-60"
        >
          <span>
            Hinge fillet <span className="text-ink-faint">· rounds the sharp corner</span>
          </span>
          <span
            className="font-display rounded px-2 py-0.5"
            style={{
              color: design.fillet ? "#05070d" : "#9aa6cf",
              background: design.fillet ? ACCENT : "transparent",
              border: design.fillet ? "none" : "1px solid var(--color-line, #27314f)",
            }}
          >
            {design.fillet ? "rounded" : "sharp"}
          </span>
        </button>
      </div>

      {/* status */}
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
        {solved ? "✨🎉 Design review passed — ⭐⭐⭐" : status}
      </div>

      {/* manufacturing note appears on win — completes the client pitch */}
      {solved && (
        <p
          className="text-center text-[11px] text-ink-faint"
          style={{ animation: "g9productfea-rise 320ms ease-out both" }}
        >
          📦 Ships under {MAX_MASS} g — ribs add strength for pennies of filament, so unit cost barely moves.
        </p>
      )}

      {/* actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onPointerDown={runFEA}
          disabled={solved}
          className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
          style={{ background: ACCENT, color: "#05070d" }}
          aria-label="Apply the phone load and run finite element stress analysis"
        >
          {solved ? "Solved!" : "Apply load · Run FEA ▶"}
        </button>
        <button
          type="button"
          onPointerDown={reset}
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
          aria-label="Reset the stand to the baseline design"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function DeltaCard({
  label,
  before,
  after,
  unit,
  good,
  revealed,
  note,
  tick,
}: {
  label: string;
  before: number;
  after: number;
  unit: string;
  good: boolean;
  revealed: boolean;
  note: string;
  tick: boolean;
}): React.ReactElement {
  const max = Math.max(before, after, 1);
  const beforePct = (before / max) * 100;
  const afterPct = (after / max) * 100;
  const afterColor = good ? "#34d399" : "#f87171";
  return (
    <div className="panel rounded-xl border border-line p-2">
      <div className="flex items-center justify-between text-[11px] text-ink-dim">
        <span>{label}</span>
        <span aria-hidden="true" style={{ color: revealed ? (tick ? "#34d399" : "#f87171") : "#9aa6cf" }}>
          {revealed ? (tick ? "✓" : "✗") : "—"}
        </span>
      </div>
      {/* baseline (before) bar */}
      <div className="mt-1.5 flex items-center gap-1">
        <span className="w-9 shrink-0 text-[9px] text-ink-faint">base</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
          <div className="h-full rounded-full" style={{ width: `${beforePct}%`, background: "#5b6788" }} />
        </div>
      </div>
      {/* your (after) bar */}
      <div className="mt-1 flex items-center gap-1">
        <span className="w-9 shrink-0 text-[9px]" style={{ color: ACCENT }}>yours</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
          <div
            className="h-full rounded-full"
            style={{
              width: `${revealed ? afterPct : 0}%`,
              background: afterColor,
              transition: "width 240ms ease, background 240ms ease",
            }}
          />
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px]">
        <span
          className="font-display tabular-nums"
          style={{ color: revealed ? afterColor : "#9aa6cf" }}
          aria-label={`${label} ${revealed ? `${after.toFixed(label === "mass" ? 0 : 1)} ${unit}` : "not yet measured"}`}
        >
          {revealed ? `${after.toFixed(label === "mass" ? 0 : 1)} ${unit}` : `— ${unit}`}
        </span>
        <span className="text-ink-faint">{note}</span>
      </div>
    </div>
  );
}
