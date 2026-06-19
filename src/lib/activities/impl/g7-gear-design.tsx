"use client";
// Learning goal: meshing gears must share the same TOOTH SIZE (module), and the
// gear ratio (driven teeth ÷ driver teeth) trades speed for torque — design a
// 2:1 reduction that halves output speed and doubles torque.
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

const ACCENT = "#f59e0b";

/** Fixed driver gear the learner must mesh against. */
const DRIVER_TEETH = 20;
const DRIVER_MODULE = 2;
const DRIVER_SPEED = 60; // rpm, spins slowly
const DRIVER_TORQUE = 10; // N·m, baseline

/** The single winning design: same module (meshes) AND a 2:1 reduction. */
const TARGET_MODULE = 2;
const TARGET_TEETH = 40;

const MIN_TEETH = 10;
const MAX_TEETH = 60;
const MODULES: readonly number[] = [1, 2, 3] as const;

/** SVG pitch radius = module × teeth ÷ 2 — the geometry that makes gears mesh. */
function pitchRadius(teeth: number, module: number): number {
  return (module * teeth) / 2;
}

/** Build one SVG gear path: a toothed wheel of `teeth` spokes at `module` size. */
function gearPath(cx: number, cy: number, teeth: number, module: number): string {
  const rp = pitchRadius(teeth, module);
  const addendum = module; // tooth tip height
  const dedendum = module * 1.1; // root depth
  const rOut = rp + addendum;
  const rIn = rp - dedendum;
  const step = (Math.PI * 2) / teeth;
  const half = step / 2;
  let d = "";
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    // square-ish tooth: root → up → tip flat → down → next root
    const pts: [number, number][] = [
      [cx + rIn * Math.cos(a - half), cy + rIn * Math.sin(a - half)],
      [cx + rOut * Math.cos(a - half * 0.45), cy + rOut * Math.sin(a - half * 0.45)],
      [cx + rOut * Math.cos(a + half * 0.45), cy + rOut * Math.sin(a + half * 0.45)],
      [cx + rIn * Math.cos(a + half), cy + rIn * Math.sin(a + half)],
    ];
    d += i === 0 ? `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)} ` : `L ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)} `;
    d += `L ${pts[1][0].toFixed(2)} ${pts[1][1].toFixed(2)} `;
    d += `L ${pts[2][0].toFixed(2)} ${pts[2][1].toFixed(2)} `;
    d += `L ${pts[3][0].toFixed(2)} ${pts[3][1].toFixed(2)} `;
  }
  return d + "Z";
}

export default function PrecisionGearTrain({ onComplete }: ActivityProps) {
  const [teeth, setTeeth] = useState<number>(24);
  const [module, setModule] = useState<number>(1);
  const [idler, setIdler] = useState<boolean>(false);
  const [solved, setSolved] = useState<boolean>(false);
  const firedRef = useRef<boolean>(false);

  const meshes = module === DRIVER_MODULE;
  const ratio = teeth / DRIVER_TEETH;
  const outSpeed = meshes ? DRIVER_SPEED / ratio : 0;
  const outTorque = meshes ? DRIVER_TORQUE * ratio : 0;
  const isReduction2to1 = meshes && teeth === TARGET_TEETH;

  // SVG geometry. The viewBox is fixed; gears are placed so pitch circles touch.
  const VIEW_W = 360;
  const VIEW_H = 220;
  const driverCx = 110;
  const driverCy = 110;
  const driverRp = pitchRadius(DRIVER_TEETH, DRIVER_MODULE);
  const drivenRp = pitchRadius(teeth, module);

  // Centre distance: when modules match, sum of pitch radii (clean mesh). When
  // mismatched, we use the DRIVER's pitch radii sum so teeth visibly clash/overlap.
  const idealCentre = driverRp + pitchRadius(teeth, DRIVER_MODULE);
  const drivenCx = driverCx + idealCentre;
  const drivenCy = driverCy;

  const driverPath = useMemo(
    () => gearPath(driverCx, driverCy, DRIVER_TEETH, DRIVER_MODULE),
    [driverCx, driverCy],
  );
  const drivenPath = useMemo(
    () => gearPath(drivenCx, drivenCy, teeth, module),
    [drivenCx, drivenCy, teeth, module],
  );
  const idlerCx = (driverCx + drivenCx) / 2;
  const idlerPath = useMemo(
    () => gearPath(idlerCx, driverCy - drivenRp - driverRp + drivenRp, 14, module),
    [idlerCx, driverCy, drivenRp, driverRp, module],
  );

  // Driver spins one way; driven spins opposite. Idler flips driven back.
  const driverDur = 4; // seconds / rev
  const drivenDur = meshes ? driverDur * ratio : driverDur; // slower when ratio>1
  const drivenDir = idler ? "normal" : "reverse"; // idler reverses direction

  const win = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    setSolved(true);
    onComplete({
      passed: true,
      stars: 3,
      detail: "2:1 reduction — half speed, double torque, modules matched.",
    });
  }, [onComplete]);

  const nudge = useCallback(
    (msg: string) => {
      if (firedRef.current) return;
      onComplete({ passed: false, detail: msg });
    },
    [onComplete],
  );

  const check = useCallback(() => {
    if (firedRef.current) return;
    if (!meshes) {
      nudge("Modules differ — the teeth can't interlock. Match the driver's module.");
      return;
    }
    if (isReduction2to1) {
      win();
      return;
    }
    if (teeth < TARGET_TEETH) nudge("Meshes! But add teeth — you need ratio 2:1 for half speed.");
    else nudge("Meshes! Too many teeth — ease back toward a 2:1 ratio.");
  }, [meshes, isReduction2to1, teeth, nudge, win]);

  const reset = useCallback(() => {
    setTeeth(24);
    setModule(1);
    setIdler(false);
  }, []);

  const stepTeeth = useCallback(
    (delta: number) => {
      if (solved) return;
      setTeeth((t) => Math.max(MIN_TEETH, Math.min(MAX_TEETH, t + delta)));
    },
    [solved],
  );

  const status = solved
    ? "✨ MESH ✓  Ratio 2:1 ✓  Half speed, double torque! ⭐⭐⭐"
    : !meshes
      ? "⚠ Won't mesh: module mismatch"
      : isReduction2to1
        ? "Meshed — press Check to lock in your 2:1 reduction!"
        : `Meshed ✓ — ratio ${ratio.toFixed(2)}:1`;

  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-col gap-3">
      <style>{`
        @keyframes g7geardesign-spin { to { transform: rotate(360deg); } }
        @keyframes g7geardesign-pop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes g7geardesign-clash { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-1.5px); } 75% { transform: translateX(1.5px); } }
      `}</style>

      {/* CAD canvas */}
      <div
        className="panel relative overflow-hidden rounded-xl border p-2"
        style={{ borderColor: solved ? ACCENT : "var(--color-line, #27314f)" }}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="block w-full"
          role="img"
          aria-label="CAD view: a fixed driver gear and your designed driven gear, meshing when modules match."
          style={{ maxHeight: 240 }}
        >
          {/* pitch-circle guides */}
          <circle cx={driverCx} cy={driverCy} r={driverRp} fill="none" stroke="#27314f" strokeWidth={0.8} strokeDasharray="3 3" />
          {meshes && (
            <circle cx={drivenCx} cy={drivenCy} r={drivenRp} fill="none" stroke="#27314f" strokeWidth={0.8} strokeDasharray="3 3" />
          )}

          {/* idler gear (above, between the two) — flips direction, not ratio */}
          {idler && meshes && (
            <g style={{ transformOrigin: `${idlerCx}px ${driverCy - drivenRp - driverRp + drivenRp}px`, animation: "g7geardesign-spin 3s linear infinite" }}>
              <path d={idlerPath} fill="#1c2540" stroke="#3a456b" strokeWidth={1} />
              <circle cx={idlerCx} cy={driverCy - drivenRp - driverRp + drivenRp} r={4} fill="#0b1020" stroke="#3a456b" />
            </g>
          )}

          {/* driver gear — spins slowly, fixed */}
          <g style={{ transformOrigin: `${driverCx}px ${driverCy}px`, animation: `g7geardesign-spin ${driverDur}s linear infinite` }}>
            <path d={driverPath} fill="#3a2c0a" stroke={ACCENT} strokeWidth={1.2} />
            <circle cx={driverCx} cy={driverCy} r={6} fill="#0b1020" stroke={ACCENT} strokeWidth={1.2} />
          </g>

          {/* driven gear — meshes only when module matches */}
          <g
            style={{
              transformOrigin: `${drivenCx}px ${drivenCy}px`,
              animation: meshes
                ? `g7geardesign-spin ${drivenDur}s linear infinite ${drivenDir}`
                : "g7geardesign-clash 0.4s ease-in-out infinite",
            }}
          >
            <path
              d={drivenPath}
              fill={meshes ? "#0e2a1c" : "#3a0e0e"}
              stroke={meshes ? "#34d399" : "#f87171"}
              strokeWidth={1.2}
              opacity={meshes ? 1 : 0.85}
            />
            <circle cx={drivenCx} cy={drivenCy} r={6} fill="#0b1020" stroke={meshes ? "#34d399" : "#f87171"} strokeWidth={1.2} />
          </g>

          {/* labels */}
          <text x={driverCx} y={VIEW_H - 8} fill="#9aa6cf" fontSize={9} textAnchor="middle" fontFamily="monospace">
            DRIVER · {DRIVER_TEETH}T · m{DRIVER_MODULE}
          </text>
          <text x={drivenCx} y={VIEW_H - 8} fill={meshes ? "#34d399" : "#f87171"} fontSize={9} textAnchor="middle" fontFamily="monospace">
            DRIVEN · {teeth}T · m{module}
          </text>
        </svg>

        {/* in-canvas status */}
        <div
          className="font-mono mt-1 rounded-md px-2 py-1 text-center text-xs"
          style={{
            color: solved ? "#05070d" : !meshes ? "#fca5a5" : "#9aa6cf",
            background: solved ? ACCENT : "transparent",
            animation: solved ? "g7geardesign-pop 0.5s ease-out" : undefined,
          }}
          role="status"
          aria-live="polite"
        >
          {status}
        </div>
      </div>

      {/* Live readout panel */}
      <div className="panel grid grid-cols-3 gap-2 rounded-xl p-3 text-center" aria-label="Gear train readout">
        <Stat label="Ratio" value={meshes ? `${ratio.toFixed(2)}:1` : "—"} good={isReduction2to1} />
        <Stat label="Out speed" value={meshes ? `${outSpeed.toFixed(0)} rpm` : "—"} good={meshes && outSpeed === DRIVER_SPEED / 2} />
        <Stat label="Out torque" value={meshes ? `${outTorque.toFixed(0)} N·m` : "—"} good={meshes && outTorque === DRIVER_TORQUE * 2} />
      </div>

      {/* Controls */}
      <div className="panel flex flex-col gap-3 rounded-xl p-3">
        {/* tooth stepper */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-ink-dim">
            Driven teeth <span className="text-ink-faint">· {MIN_TEETH}–{MAX_TEETH}</span>
          </span>
          <div className="flex items-center gap-2" role="group" aria-label="Adjust driven gear tooth count">
            <StepBtn label="Remove a tooth" glyph="−" onClick={() => stepTeeth(-2)} disabled={solved || teeth <= MIN_TEETH} />
            <span className="font-display w-12 text-center tabular-nums text-sm" style={{ color: ACCENT }} aria-label={`${teeth} teeth`}>
              {teeth}T
            </span>
            <StepBtn label="Add a tooth" glyph="+" onClick={() => stepTeeth(2)} disabled={solved || teeth >= MAX_TEETH} />
          </div>
        </div>

        {/* module selector */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-ink-dim">
            Module <span className="text-ink-faint">· tooth size</span>
          </span>
          <div className="flex gap-1.5" role="group" aria-label="Select tooth module">
            {MODULES.map((m) => {
              const active = module === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => !solved && setModule(m)}
                  disabled={solved}
                  aria-pressed={active}
                  aria-label={`Module ${m}${m === DRIVER_MODULE ? ", matches driver" : ""}`}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50"
                  style={{
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: active ? ACCENT : "var(--color-line, #27314f)",
                    background: active ? ACCENT : "rgba(11,16,32,0.6)",
                    color: active ? "#05070d" : "#cbd3ef",
                  }}
                >
                  m{m}
                </button>
              );
            })}
          </div>
        </div>

        {/* idler toggle */}
        <label className="flex cursor-pointer items-center justify-between gap-2 text-xs text-ink-dim">
          <span>
            Idler gear <span className="text-ink-faint">· flips direction, not ratio</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={idler}
            aria-label="Toggle idler gear"
            onClick={() => !solved && setIdler((v) => !v)}
            disabled={solved}
            className="relative h-5 w-9 rounded-full transition disabled:opacity-50"
            style={{ background: idler ? ACCENT : "#27314f" }}
          >
            <span
              className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
              style={{ left: idler ? 18 : 2 }}
            />
          </button>
        </label>

        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={check}
            disabled={solved}
            className="flex-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: ACCENT, color: "#05070d" }}
            aria-label="Check the gear design against the 2 to 1 reduction goal"
          >
            {solved ? "Solved! 🎉" : "Check design"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
            aria-label="Reset the gear design"
          >
            Reset
          </button>
        </div>

        <p className="text-[11px] leading-tight text-ink-faint">
          Goal: design a <span style={{ color: ACCENT }}>2:1 reduction</span> — output turns at half speed with double torque. Gears mesh only when modules match.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">{label}</span>
      <span
        className="font-display text-sm tabular-nums"
        style={{ color: good ? "#34d399" : "#cbd3ef" }}
      >
        {value}
        {good ? " ✓" : ""}
      </span>
    </div>
  );
}

function StepBtn({
  label,
  glyph,
  onClick,
  disabled,
}: {
  label: string;
  glyph: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={(e) => e.preventDefault()}
      disabled={disabled}
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-lg text-lg font-medium transition disabled:opacity-40"
      style={{
        touchAction: "manipulation",
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "var(--color-line, #27314f)",
        background: "rgba(11,16,32,0.6)",
        color: "#cbd3ef",
      }}
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  );
}
