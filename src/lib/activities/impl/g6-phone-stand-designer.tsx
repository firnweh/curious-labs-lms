"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Phone Stand Designer — ergonomics vs. stability in 3D product CAD  */
/*  Learning goal: a good 3D product must balance the right viewing    */
/*  angle (comfort) with a base wide enough that the centre of gravity */
/*  stays over the footprint (stability). The learner drives two       */
/*  sliders until BOTH constraints are satisfied at once.              */
/* ------------------------------------------------------------------ */

const ACCENT = "#f59e0b";
const VIEW_W = 360;
const VIEW_H = 300;

/** The phone screen must lean back into this comfort window (degrees). */
const TILT_MIN = 65;
const TILT_MAX = 70;

/** Base width slider range (in scene units / mm). */
const BASE_MIN = 60;
const BASE_MAX = 200;

/** Tilt slider range: degrees the screen leans toward the eye from upright. */
const ANGLE_MIN = 35;
const ANGLE_MAX = 82;

/** A deliberately wrong-ish start: too narrow + leaning too far → it tips. */
const START_BASE = 78;
const START_ANGLE = 82;

/** Geometry constants of the stand, all in scene units. */
const GROUND_Y = 244; // y of the floor line
const PHONE_LEN = 118; // length of the phone resting on the support
const SUPPORT_PIVOT_X = VIEW_W / 2; // the back support hinges here at the floor
const SUPPORT_LEN = 150; // length of the back support strut
const CRADLE_OFF = 16; // how far up the strut the phone's foot sits
const BACK_LIP = 22; // base extends this far BEHIND the pivot (the rest goes forward)
const FWD = 10; // small forward shove of the phone toward the eye

interface Pt {
  x: number;
  y: number;
}

/**
 * Build the whole side-view geometry for a given base width + tilt angle.
 * Pure & deterministic: same inputs → same scene → same grade.
 */
function buildScene(baseW: number, angleDeg: number) {
  // Base plate: its BACK edge sits a little behind the pivot; the width then
  // extends FORWARD toward the eye — exactly where a stand needs material to
  // catch the load. So a wider base reaches further forward under the phone.
  const baseLeft = SUPPORT_PIVOT_X - BACK_LIP;
  const baseRight = baseLeft + baseW;

  // The screen leans toward the viewer's eye (to the right) by `angleDeg`
  // measured from upright. Larger angle → leans further forward → CoG further
  // forward → easier to tip. The horizontal reach grows with sin(angle).
  const phi = (angleDeg * Math.PI) / 180;
  const sx = Math.sin(phi); // forward component
  const cy = Math.cos(phi); // upward component
  const supTop: Pt = {
    x: SUPPORT_PIVOT_X + sx * SUPPORT_LEN,
    y: GROUND_Y - cy * SUPPORT_LEN,
  };

  // The phone slab rests against the support, parallel to it.
  const cradleBase: Pt = {
    x: SUPPORT_PIVOT_X + FWD + sx * CRADLE_OFF,
    y: GROUND_Y - cy * CRADLE_OFF,
  };
  const phoneTop: Pt = {
    x: cradleBase.x + sx * PHONE_LEN,
    y: cradleBase.y - cy * PHONE_LEN,
  };

  // Outward normal of the phone face (points away from the strut, toward eye),
  // used to give the slab thickness when drawn.
  const nx = cy;
  const ny = sx;

  // The screen's lean toward the eye, in degrees — the comfort number.
  const screenAngle = angleDeg;

  // ---- Centre of gravity of the heavy bits (phone + support) ----
  // The phone is the heaviest part and sits high & forward → it's what tips
  // the stand. Weight the phone more than the support.
  const phoneMid: Pt = {
    x: (cradleBase.x + phoneTop.x) / 2,
    y: (cradleBase.y + phoneTop.y) / 2,
  };
  const supMid: Pt = {
    x: (SUPPORT_PIVOT_X + supTop.x) / 2,
    y: (GROUND_Y + supTop.y) / 2,
  };
  const wPhone = 3;
  const wSup = 1;
  const cog: Pt = {
    x: (phoneMid.x * wPhone + supMid.x * wSup) / (wPhone + wSup),
    y: (phoneMid.y * wPhone + supMid.y * wSup) / (wPhone + wSup),
  };

  // Project the CoG straight down to the floor.
  const cogGround: Pt = { x: cog.x, y: GROUND_Y };

  // Stable when the dropped CoG lands inside the base footprint.
  const stable = cogGround.x >= baseLeft && cogGround.x <= baseRight;
  const comfy = screenAngle >= TILT_MIN && screenAngle <= TILT_MAX;

  return {
    baseLeft,
    baseRight,
    supTop,
    cradleBase,
    phoneTop,
    nx,
    ny,
    cog,
    cogGround,
    screenAngle,
    stable,
    comfy,
  };
}

type Scene = ReturnType<typeof buildScene>;

export default function PhoneStandDesigner({ onComplete }: ActivityProps) {
  const [baseW, setBaseW] = useState<number>(START_BASE);
  const [angle, setAngle] = useState<number>(START_ANGLE);
  const [done, setDone] = useState<boolean>(false);
  const firedRef = useRef<boolean>(false);

  const scene: Scene = useMemo(
    () => buildScene(baseW, angle),
    [baseW, angle],
  );

  const solved = scene.comfy && scene.stable;
  // It "tips" only when unstable — drives the wobble animation.
  const tipping = !scene.stable && !done;

  // Fire success exactly once, from an effect (never during render).
  useEffect(() => {
    if (solved && !firedRef.current) {
      firedRef.current = true;
      setDone(true);
      onComplete({
        passed: true,
        stars: 3,
        detail: "Ergonomic AND stable — ready to print!",
      });
    }
  }, [solved, onComplete]);

  // A gentle nudge when an attempt lands wrong (never scolds, always winnable).
  const nudgedRef = useRef<boolean>(false);
  useEffect(() => {
    if (done) return;
    if (!scene.comfy || !scene.stable) {
      if (!nudgedRef.current) {
        nudgedRef.current = true;
        return; // skip the very first render so we don't toast on load
      }
      // Debounce-ish: only report once the learner has stopped sliding.
      const t = window.setTimeout(() => {
        if (firedRef.current) return;
        let detail = "";
        if (!scene.stable && !scene.comfy) {
          detail = "It tips and the angle is off — widen the base a bit.";
        } else if (!scene.stable) {
          detail = "It tips back — widen the base or reduce the tilt.";
        } else {
          detail =
            scene.screenAngle < TILT_MIN
              ? "Too upright to read comfortably — tilt it back a touch."
              : "Leaning too far — stand it up a little for comfort.";
        }
        onComplete({ passed: false, detail });
      }, 650);
      return () => window.clearTimeout(t);
    }
  }, [scene, done, onComplete]);

  const reset = useCallback((): void => {
    firedRef.current = false;
    nudgedRef.current = false;
    setDone(false);
    setBaseW(START_BASE);
    setAngle(START_ANGLE);
  }, []);

  const onBase = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      if (firedRef.current) return;
      setBaseW(Number(e.target.value));
    },
    [],
  );
  const onAngle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      if (firedRef.current) return;
      setAngle(Number(e.target.value));
    },
    [],
  );

  const status = useMemo<string>(() => {
    if (done) return "Exported! Ergonomic AND stable — ready to print! ✨";
    if (tipping) return "Whoa — it tips over! The centre of gravity falls off the base.";
    if (!scene.comfy)
      return scene.screenAngle < TILT_MIN
        ? "Stable, but too upright to read — tilt it back."
        : "Stable, but leaning too far — stand it up a bit.";
    return "Nearly there — keep both checks green at once.";
  }, [done, tipping, scene]);

  // SVG transform for the tipping wobble (rotate the whole stand about a foot).
  const wobble = tipping
    ? `g6phonestanddesigner-tip 1.1s ease-in-out infinite`
    : "none";
  const pivotX = scene.baseRight;

  const phoneW = 28; // half-thickness of the phone slab for its outline

  return (
    <div className="flex w-full flex-col gap-3 text-ink" style={{ maxWidth: 440 }}>
      <style>{`
        @keyframes g6phonestanddesigner-tip {
          0%, 100% { transform: rotate(0deg); }
          30% { transform: rotate(7deg); }
          55% { transform: rotate(4deg); }
          80% { transform: rotate(9deg); }
        }
        @keyframes g6phonestanddesigner-stamp {
          0% { transform: scale(0.2) rotate(-18deg); opacity: 0; }
          60% { transform: scale(1.15) rotate(-12deg); opacity: 1; }
          100% { transform: scale(1) rotate(-12deg); opacity: 1; }
        }
        @keyframes g6phonestanddesigner-spark {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* ---------------- CAD STAGE ---------------- */}
      <div
        className="panel relative overflow-hidden rounded-xl border p-2"
        style={{
          borderColor: done ? ACCENT : "var(--color-line, #27314f)",
          boxShadow: done ? `0 0 24px -6px ${ACCENT}` : undefined,
          transition: "box-shadow .3s ease, border-color .3s ease",
        }}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="block h-auto w-full"
          role="img"
          aria-label="Side-view CAD scene of a phone stand: a base plate, an angled back support, and a phone resting in the cradle, with a centre-of-gravity plumb line."
          style={{ maxHeight: 360 }}
        >
          {/* faint CAD grid */}
          {Array.from({ length: 13 }, (_, i) => (
            <line
              key={`gv${i}`}
              x1={(i * VIEW_W) / 12}
              y1={0}
              x2={(i * VIEW_W) / 12}
              y2={VIEW_H}
              stroke="#18223a"
              strokeWidth={0.5}
            />
          ))}
          {Array.from({ length: 11 }, (_, i) => (
            <line
              key={`gh${i}`}
              x1={0}
              y1={(i * VIEW_H) / 10}
              x2={VIEW_W}
              y2={(i * VIEW_H) / 10}
              stroke="#18223a"
              strokeWidth={0.5}
            />
          ))}

          {/* floor line */}
          <line
            x1={0}
            y1={GROUND_Y}
            x2={VIEW_W}
            y2={GROUND_Y}
            stroke="#2b3a5c"
            strokeWidth={2}
          />

          {/* eye + viewing line (fixed eye height to the right) */}
          <g>
            <line
              x1={scene.cradleBase.x + (scene.phoneTop.x - scene.cradleBase.x) / 2}
              y1={scene.cradleBase.y + (scene.phoneTop.y - scene.cradleBase.y) / 2}
              x2={VIEW_W - 26}
              y2={96}
              stroke={scene.comfy ? ACCENT : "#5b6a8c"}
              strokeWidth={1.4}
              strokeDasharray="4 4"
              opacity={0.85}
            />
            <text x={VIEW_W - 26} y={84} fontSize={20} textAnchor="middle">
              👁️
            </text>
          </g>

          {/* The stand itself — wobbles as a unit when it tips. */}
          <g
            style={{
              transformBox: "fill-box",
              transformOrigin: `${pivotX}px ${GROUND_Y}px`,
              animation: wobble,
            }}
          >
            {/* base footprint stability zone (green when CoG is inside) */}
            <rect
              x={scene.baseLeft}
              y={GROUND_Y - 8}
              width={scene.baseRight - scene.baseLeft}
              height={12}
              rx={3}
              fill={scene.stable ? "#16a34a" : "#7f1d1d"}
              fillOpacity={0.85}
              stroke={scene.stable ? "#22c55e" : "#ef4444"}
              strokeWidth={1.5}
            />
            {/* a translucent “safe zone” band above the base */}
            <rect
              x={scene.baseLeft}
              y={GROUND_Y - 150}
              width={scene.baseRight - scene.baseLeft}
              height={150}
              fill={scene.stable ? "#22c55e" : "#ef4444"}
              fillOpacity={0.06}
            />

            {/* back support strut */}
            <line
              x1={SUPPORT_PIVOT_X}
              y1={GROUND_Y}
              x2={scene.supTop.x}
              y2={scene.supTop.y}
              stroke="#9aa6cf"
              strokeWidth={7}
              strokeLinecap="round"
            />

            {/* phone slab resting in the cradle */}
            <polygon
              points={[
                `${scene.cradleBase.x - scene.nx * phoneW},${scene.cradleBase.y - scene.ny * phoneW}`,
                `${scene.cradleBase.x + scene.nx * phoneW},${scene.cradleBase.y + scene.ny * phoneW}`,
                `${scene.phoneTop.x + scene.nx * phoneW},${scene.phoneTop.y + scene.ny * phoneW}`,
                `${scene.phoneTop.x - scene.nx * phoneW},${scene.phoneTop.y - scene.ny * phoneW}`,
              ].join(" ")}
              fill={done ? "#1f2d18" : "#11192c"}
              stroke={scene.comfy ? ACCENT : "#5b6a8c"}
              strokeWidth={2}
            />
            {/* screen glint */}
            <line
              x1={scene.cradleBase.x + scene.nx * (phoneW - 6)}
              y1={scene.cradleBase.y + scene.ny * (phoneW - 6)}
              x2={scene.phoneTop.x + scene.nx * (phoneW - 6)}
              y2={scene.phoneTop.y + scene.ny * (phoneW - 6)}
              stroke={scene.comfy ? ACCENT : "#3b4a6c"}
              strokeWidth={2}
              opacity={0.7}
            />

            {/* CoG plumb line + dot */}
            <line
              x1={scene.cog.x}
              y1={scene.cog.y}
              x2={scene.cogGround.x}
              y2={scene.cogGround.y}
              stroke={scene.stable ? "#22c55e" : "#ef4444"}
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
            <circle
              cx={scene.cog.x}
              cy={scene.cog.y}
              r={6}
              fill={scene.stable ? "#22c55e" : "#ef4444"}
              stroke="#05070d"
              strokeWidth={1.5}
            />
            <circle
              cx={scene.cogGround.x}
              cy={scene.cogGround.y}
              r={4}
              fill={scene.stable ? "#22c55e" : "#ef4444"}
            />
          </g>

          {/* TIP! warning */}
          {tipping && (
            <text
              x={VIEW_W / 2}
              y={40}
              fontSize={22}
              fontWeight={700}
              textAnchor="middle"
              fill="#ef4444"
            >
              TIP!
            </text>
          )}

          {/* Export STL stamp on win */}
          {done && (
            <g
              style={{
                transformBox: "view-box",
                transformOrigin: "center",
                animation: "g6phonestanddesigner-stamp .5s ease-out both",
              }}
            >
              <rect
                x={VIEW_W / 2 - 96}
                y={VIEW_H / 2 - 30}
                width={192}
                height={60}
                rx={8}
                fill="none"
                stroke={ACCENT}
                strokeWidth={3}
              />
              <text
                x={VIEW_W / 2}
                y={VIEW_H / 2 + 1}
                fontSize={20}
                fontWeight={800}
                textAnchor="middle"
                fill={ACCENT}
                letterSpacing={2}
              >
                EXPORT STL
              </text>
              <text
                x={VIEW_W / 2}
                y={VIEW_H / 2 + 20}
                fontSize={10}
                textAnchor="middle"
                fill={ACCENT}
                opacity={0.9}
              >
                ready to print ✨
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* ---------------- LIVE REQUIREMENT CHECKS ---------------- */}
      <div className="flex gap-2" role="group" aria-label="Design requirement checks">
        <Check
          ok={scene.comfy}
          label="Comfort"
          value={`${Math.round(scene.screenAngle)}°`}
          want={`${TILT_MIN}–${TILT_MAX}°`}
        />
        <Check
          ok={scene.stable}
          label="Stability"
          value={scene.stable ? "in base" : "off base"}
          want="CoG over base"
        />
      </div>

      {/* status line */}
      <div
        className="font-mono rounded-md px-2 py-1.5 text-center text-xs"
        role="status"
        aria-live="polite"
        style={{
          color: done ? "#05070d" : "#9aa6cf",
          background: done ? ACCENT : "rgba(11,16,32,0.5)",
          fontWeight: done ? 700 : 400,
        }}
      >
        {done ? "✨🎉 ⭐⭐⭐ " : ""}
        {status}
      </div>

      {/* ---------------- SLIDERS ---------------- */}
      <div className="panel flex flex-col gap-3 rounded-xl p-3">
        <Slider
          label="Base plate width"
          hint="wider = more stable"
          value={baseW}
          min={BASE_MIN}
          max={BASE_MAX}
          step={2}
          display={`${Math.round(baseW)}`}
          unit="mm"
          onChange={onBase}
          disabled={done}
        />
        <Slider
          label="Back support tilt"
          hint="leans the screen toward the eye"
          value={angle}
          min={ANGLE_MIN}
          max={ANGLE_MAX}
          step={1}
          display={`${Math.round(angle)}`}
          unit="°"
          onChange={onAngle}
          disabled={done}
        />

        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] leading-tight text-ink-faint">
            Balance both: a comfy {TILT_MIN}–{TILT_MAX}° lean AND a base wide
            enough to keep the green dot inside the footprint.
          </p>
          <button
            type="button"
            onClick={reset}
            className="shrink-0 rounded-lg border border-line bg-panel/60 px-3 py-1.5 text-xs font-medium text-ink-dim"
            aria-label="Reset the design to the starting values"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- small presentational helpers ---------------- */

function Check({
  ok,
  label,
  value,
  want,
}: {
  ok: boolean;
  label: string;
  value: string;
  want: string;
}) {
  return (
    <div
      className="flex flex-1 flex-col gap-0.5 rounded-lg border px-2.5 py-2"
      style={{
        borderColor: ok ? "#22c55e" : "#ef4444",
        background: ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.07)",
      }}
      aria-label={`${label} check ${ok ? "passing" : "failing"}: ${value}, want ${want}`}
    >
      <span className="flex items-center justify-between font-mono text-xs">
        <span className="text-ink-dim">{label}</span>
        <span aria-hidden style={{ color: ok ? "#22c55e" : "#ef4444" }}>
          {ok ? "✓" : "✗"}
        </span>
      </span>
      <span
        className="font-display text-sm tabular-nums"
        style={{ color: ok ? "#22c55e" : "#f87171" }}
      >
        {value}
      </span>
      <span className="font-mono text-[10px] text-ink-faint">need {want}</span>
    </div>
  );
}

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  display,
  unit,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  unit: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="flex items-center justify-between">
        <span className="text-ink-dim">
          {label} <span className="text-ink-faint">· {hint}</span>
        </span>
        <span className="font-display tabular-nums" style={{ color: ACCENT }}>
          {display}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        disabled={disabled}
        aria-label={`${label}, ${display}${unit}`}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-60"
        style={{ accentColor: ACCENT, touchAction: "none" }}
      />
    </label>
  );
}
