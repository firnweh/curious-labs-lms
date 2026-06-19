"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  3D Pen Holder Designer ✏️ — functional CAD: shape a product to     */
/*  meet REAL requirements.                                            */
/*  Single learning goal: a working 3D design must satisfy concrete,   */
/*  testable specs at the SAME time — a pocket wide enough to hold the */
/*  pens, walls thick enough not to be fragile, tall enough that pens  */
/*  don't tip, and a base wider than the top so the whole thing is     */
/*  stable. The learner drives four mm sliders until every spec is     */
/*  green at once, then exports an STL.                                */
/* ------------------------------------------------------------------ */

const ACCENT = "#f59e0b";
const VIEW_W = 360;
const VIEW_H = 320;

/* ----- design-brief specs (the four testable requirements) ----- */
const OPENING_MIN = 80; // mm — inner pocket must fit ~10 pens
const WALL_MIN = 3; // mm — thinner walls are flagged "fragile"
const HEIGHT_MIN = 90; // mm — tall enough so pens don't tip out

/* ----- slider ranges (each always includes a valid combination) ----- */
const OPENING_RANGE = { min: 40, max: 110, step: 2 } as const;
const WALL_RANGE = { min: 1, max: 10, step: 1 } as const;
const HEIGHT_RANGE = { min: 50, max: 130, step: 2 } as const;
const BASE_EXTRA_RANGE = { min: 0, max: 40, step: 2 } as const; // mm the base juts out past the top, per side

/* A deliberately not-yet-valid start: pocket too small, walls too thin,
   too short, and the base no wider than the top → nothing is green. */
const START = {
  opening: 56,
  wall: 2,
  height: 70,
  baseExtra: 0,
} as const;

type RotView = 0 | 1 | 2 | 3;

interface Design {
  opening: number; // inner pocket width (mm)
  wall: number; // wall thickness (mm)
  height: number; // overall height (mm)
  baseExtra: number; // how far the base juts past the top, each side (mm)
}

interface Specs {
  topWidth: number; // opening + 2 * wall
  baseWidth: number; // topWidth + 2 * baseExtra
  penCapacity: number; // rough count of pens the pocket fits
  wideOpening: boolean;
  thickWalls: boolean;
  tallEnough: boolean;
  stableBase: boolean;
  allOk: boolean;
}

/** Pure, deterministic grade of a design against the four specs. */
function evaluate(d: Design): Specs {
  const topWidth = d.opening + 2 * d.wall;
  const baseWidth = topWidth + 2 * d.baseExtra;
  // ~8mm per pen across the opening, leaving a little wiggle room.
  const penCapacity = Math.max(0, Math.floor(d.opening / 8));

  const wideOpening = d.opening >= OPENING_MIN;
  const thickWalls = d.wall >= WALL_MIN;
  const tallEnough = d.height >= HEIGHT_MIN;
  // Stable when the base is genuinely wider than the top (not just equal).
  const stableBase = baseWidth > topWidth;

  return {
    topWidth,
    baseWidth,
    penCapacity,
    wideOpening,
    thickWalls,
    tallEnough,
    stableBase,
    allOk: wideOpening && thickWalls && tallEnough && stableBase,
  };
}

/* ------------------------------------------------------------------ */
/*  Isometric projection helpers                                       */
/* ------------------------------------------------------------------ */

const CX = VIEW_W / 2;
const FLOOR_Y = 252; // y of the ground plane at the model centre
const ISO = 0.5; // depth squash for the iso look (ellipse ry / rx)
const MM = 1.4; // px per mm, scales the model into the viewport

interface XY {
  x: number;
  y: number;
}

/** Project an (x across, y up, depth) point with a yaw rotation. */
function iso(xAcross: number, yUp: number, view: RotView): XY {
  // Each rotation just flips/swaps the horizontal so the holder appears to
  // spin in place. Depth is faked with the squashed ellipses, so yaw only
  // needs to nudge the horizontal offset for a sense of turning.
  const lean = [0, 6, 0, -6][view];
  return { x: CX + xAcross + lean, y: FLOOR_Y - yUp };
}

export default function PenHolderCAD({ onComplete }: ActivityProps) {
  const [design, setDesign] = useState<Design>({ ...START });
  const [view, setView] = useState<RotView>(0);
  const [done, setDone] = useState<boolean>(false);
  const [showPens, setShowPens] = useState<boolean>(false);
  const [wobbleNonce, setWobbleNonce] = useState<number>(0);
  const firedRef = useRef<boolean>(false);
  const nudgeReadyRef = useRef<boolean>(false);

  const specs: Specs = useMemo(() => evaluate(design), [design]);

  // top-heavy → it would tip; drives the wobble-test arrow.
  const topHeavy = !specs.stableBase;

  /* Fire success exactly once, from an effect (never during render). */
  useEffect(() => {
    if (specs.allOk && !firedRef.current) {
      firedRef.current = true;
      setDone(true);
      setShowPens(true);
      onComplete({
        passed: true,
        stars: 3,
        detail: "All four specs met — ready to print!",
      });
    }
  }, [specs.allOk, onComplete]);

  /* A kind, debounced nudge once the learner pauses on a not-yet-valid design. */
  useEffect(() => {
    if (done) return;
    if (specs.allOk) return;
    if (!nudgeReadyRef.current) {
      nudgeReadyRef.current = true; // skip the very first render (load)
      return;
    }
    const t = window.setTimeout(() => {
      if (firedRef.current) return;
      let detail = "Keep going — get all four checks green at once.";
      if (!specs.thickWalls) detail = "Walls too thin — make them thicker.";
      else if (!specs.wideOpening) detail = "Pocket too narrow — widen the opening so 10 pens fit.";
      else if (!specs.tallEnough) detail = "A bit short — make it taller so pens don't tip out.";
      else if (!specs.stableBase) detail = "Top-heavy — make the base wider than the top.";
      onComplete({ passed: false, detail });
    }, 700);
    return () => window.clearTimeout(t);
  }, [design, specs, done, onComplete]);

  const update = useCallback(
    (key: keyof Design) => (e: React.ChangeEvent<HTMLInputElement>) => {
      if (firedRef.current) return;
      const v = Number(e.target.value);
      setDesign((prev) => ({ ...prev, [key]: v }));
      setShowPens(false);
    },
    [],
  );

  const reset = useCallback(() => {
    firedRef.current = false;
    nudgeReadyRef.current = false;
    setDesign({ ...START });
    setView(0);
    setDone(false);
    setShowPens(false);
  }, []);

  const rotate = useCallback((dir: 1 | -1) => {
    setView((v) => (((v + dir + 4) % 4) as RotView));
  }, []);

  const runWobble = useCallback(() => {
    setWobbleNonce((n) => n + 1);
  }, []);

  /* ---- model geometry in mm → px (computed for the SVG) ---- */
  const topHalf = (specs.topWidth / 2) * MM;
  const baseHalf = (specs.baseWidth / 2) * MM;
  const openHalf = (design.opening / 2) * MM;
  const hPx = design.height * MM;
  const ryTop = topHalf * ISO;
  const ryBase = baseHalf * ISO;
  const ryOpen = openHalf * ISO;

  // Anchor points in projected space.
  const baseC = iso(0, 0, view); // centre of base on the floor
  const topC = iso(0, hPx, view); // centre of the rim
  const pocketDepth = Math.min(hPx - 8 * MM, design.height * MM * 0.82);
  const pocketC = iso(0, hPx - pocketDepth, view); // floor of the inner pocket

  const wobbleName = `g5penholdercad-wobble`;

  return (
    <div className="flex w-full flex-col gap-3 text-ink" style={{ maxWidth: 440 }}>
      <style>{`
        @keyframes g5penholdercad-wobble {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(-7deg); }
          45% { transform: rotate(5deg); }
          70% { transform: rotate(-3deg); }
          88% { transform: rotate(2deg); }
        }
        @keyframes g5penholdercad-tip {
          0%, 100% { transform: rotate(0deg); }
          30% { transform: rotate(6deg); }
          60% { transform: rotate(3deg); }
          82% { transform: rotate(7deg); }
        }
        @keyframes g5penholdercad-drop {
          0% { transform: translateY(-46px); opacity: 0; }
          70% { opacity: 1; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes g5penholdercad-stamp {
          0% { transform: scale(0.2) rotate(-16deg); opacity: 0; }
          60% { transform: scale(1.12) rotate(-11deg); opacity: 1; }
          100% { transform: scale(1) rotate(-11deg); opacity: 1; }
        }
        @keyframes g5penholdercad-spark {
          0% { transform: scale(0) rotate(0deg); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: scale(1.3) rotate(40deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; }
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
          aria-label="Isometric CAD view of a pen holder: a tapered outer block with a hollow pocket carved into the top, sitting on a wider base, with pens shown for capacity."
          style={{ maxHeight: 360, touchAction: "none" }}
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

          {/* ground ellipse (shadow) */}
          <ellipse
            cx={baseC.x}
            cy={baseC.y + 6}
            rx={baseHalf + 6}
            ry={(baseHalf + 6) * ISO}
            fill="#05070d"
            opacity={0.45}
          />

          {/* The whole model — wobbles for the test, tips if top-heavy. */}
          <g
            key={wobbleNonce}
            style={{
              transformBox: "fill-box",
              transformOrigin: `${baseC.x + baseHalf}px ${baseC.y}px`,
              animation:
                wobbleNonce > 0
                  ? topHeavy
                    ? `g5penholdercad-tip 1s ease-in-out`
                    : `${wobbleName} 0.9s ease-in-out`
                  : "none",
            }}
          >
            {/* ---- BASE slab (wider footprint) ---- */}
            <g>
              {/* base side wall */}
              <path
                d={`M ${baseC.x - baseHalf} ${baseC.y}
                    A ${baseHalf} ${ryBase} 0 0 0 ${baseC.x + baseHalf} ${baseC.y}
                    L ${baseC.x + baseHalf} ${baseC.y - 10}
                    A ${baseHalf} ${ryBase} 0 0 1 ${baseC.x - baseHalf} ${baseC.y - 10}
                    Z`}
                fill={specs.stableBase ? "#7a5212" : "#5a3a3a"}
                stroke="#0a0e18"
                strokeWidth={1}
              />
              {/* base top face */}
              <ellipse
                cx={baseC.x}
                cy={baseC.y - 10}
                rx={baseHalf}
                ry={ryBase}
                fill={specs.stableBase ? "#a36c16" : "#7a4d4d"}
                stroke="#0a0e18"
                strokeWidth={1}
              />
            </g>

            {/* ---- OUTER body (taper from base up to the rim) ---- */}
            <path
              d={`M ${baseC.x - topHalf} ${topC.y}
                  L ${baseC.x - baseHalf * 0.92} ${baseC.y - 10}
                  A ${baseHalf * 0.92} ${ryBase * 0.92} 0 0 0 ${baseC.x + baseHalf * 0.92} ${baseC.y - 10}
                  L ${baseC.x + topHalf} ${topC.y}
                  A ${topHalf} ${ryTop} 0 0 1 ${baseC.x - topHalf} ${topC.y}
                  Z`}
              fill={done ? "#1f2d18" : "#2a3650"}
              stroke={done ? ACCENT : "#3c4a6c"}
              strokeWidth={1.5}
            />

            {/* outer rim (top of the walls) */}
            <ellipse
              cx={topC.x}
              cy={topC.y}
              rx={topHalf}
              ry={ryTop}
              fill={done ? "#2b3a22" : "#34425f"}
              stroke={done ? ACCENT : "#46557a"}
              strokeWidth={1.5}
            />

            {/* ---- INNER POCKET (the subtracted hollow) ---- */}
            {/* pocket inner wall */}
            <path
              d={`M ${topC.x - openHalf} ${topC.y}
                  A ${openHalf} ${ryOpen} 0 0 0 ${topC.x + openHalf} ${topC.y}
                  L ${pocketC.x + openHalf} ${pocketC.y}
                  A ${openHalf} ${ryOpen} 0 0 1 ${pocketC.x - openHalf} ${pocketC.y}
                  Z`}
              fill="#0c1322"
              stroke="#0a0e18"
              strokeWidth={1}
            />
            {/* pocket floor */}
            <ellipse
              cx={pocketC.x}
              cy={pocketC.y}
              rx={openHalf}
              ry={ryOpen}
              fill="#070b14"
            />
            {/* pocket mouth ring — turns amber when walls too thin (fragile) */}
            <ellipse
              cx={topC.x}
              cy={topC.y}
              rx={openHalf}
              ry={ryOpen}
              fill="none"
              stroke={specs.thickWalls ? "#46557a" : "#ef4444"}
              strokeWidth={specs.thickWalls ? 1.5 : 2.5}
              strokeDasharray={specs.thickWalls ? "0" : "4 3"}
            />

            {/* fragile-wall warning flag */}
            {!specs.thickWalls && (
              <text
                x={topC.x}
                y={topC.y - ryTop - 8}
                fontSize={11}
                fontWeight={700}
                textAnchor="middle"
                fill="#ef4444"
              >
                ⚠ fragile wall
              </text>
            )}

            {/* ---- PENS dropping in (capacity preview) ---- */}
            {showPens &&
              Array.from(
                { length: Math.min(specs.penCapacity, 10) },
                (_, i) => {
                  const n = Math.min(specs.penCapacity, 10);
                  const t = n <= 1 ? 0.5 : i / (n - 1);
                  const px = topC.x - openHalf * 0.7 + t * openHalf * 1.4;
                  const penTop = topC.y - pocketDepth * 0.55 - hPx * 0.16;
                  return (
                    <g
                      key={`pen${i}`}
                      style={{
                        transformBox: "fill-box",
                        transformOrigin: "center bottom",
                        animation: `g5penholdercad-drop 0.45s ${0.05 * i}s ease-out both`,
                      }}
                    >
                      <line
                        x1={px}
                        y1={penTop}
                        x2={px}
                        y2={topC.y + ryOpen * 0.4}
                        stroke={["#22d3ee", "#f472b6", "#a3e635", "#fbbf24", "#818cf8"][i % 5]}
                        strokeWidth={3}
                        strokeLinecap="round"
                      />
                      <circle cx={px} cy={penTop} r={2.2} fill="#e8eefc" />
                    </g>
                  );
                },
              )}
          </g>

          {/* tipping arrow during a wobble test on a top-heavy model */}
          {topHeavy && wobbleNonce > 0 && (
            <g key={`arrow${wobbleNonce}`}>
              <path
                d={`M ${baseC.x + baseHalf + 6} ${topC.y + 10}
                    q 26 -2 30 22`}
                fill="none"
                stroke="#ef4444"
                strokeWidth={2.5}
              />
              <path
                d={`M ${baseC.x + baseHalf + 34} ${topC.y + 30}
                    l 4 8 l -10 -2 Z`}
                fill="#ef4444"
              />
              <text
                x={baseC.x + baseHalf + 40}
                y={topC.y + 8}
                fontSize={11}
                fontWeight={700}
                fill="#ef4444"
              >
                tips!
              </text>
            </g>
          )}

          {/* width comparison callout: base vs top */}
          <g opacity={0.9}>
            <line
              x1={baseC.x - baseHalf}
              y1={baseC.y + 16}
              x2={baseC.x + baseHalf}
              y2={baseC.y + 16}
              stroke={specs.stableBase ? "#22c55e" : "#ef4444"}
              strokeWidth={1.5}
            />
            <text
              x={baseC.x}
              y={baseC.y + 28}
              fontSize={9}
              textAnchor="middle"
              fill={specs.stableBase ? "#22c55e" : "#ef4444"}
              className="font-mono"
            >
              base {Math.round(specs.baseWidth)}mm vs top {Math.round(specs.topWidth)}mm
            </text>
          </g>

          {/* Ready-to-print stamp + STL export on win */}
          {done && (
            <g
              style={{
                transformBox: "view-box",
                transformOrigin: "center",
                animation: "g5penholdercad-stamp .5s ease-out both",
              }}
            >
              <rect
                x={VIEW_W / 2 - 104}
                y={34}
                width={208}
                height={56}
                rx={8}
                fill="rgba(7,11,20,0.85)"
                stroke={ACCENT}
                strokeWidth={3}
              />
              <text
                x={VIEW_W / 2}
                y={58}
                fontSize={18}
                fontWeight={800}
                textAnchor="middle"
                fill={ACCENT}
                letterSpacing={1.5}
              >
                READY TO PRINT
              </text>
              <text
                x={VIEW_W / 2}
                y={78}
                fontSize={11}
                textAnchor="middle"
                fill={ACCENT}
                opacity={0.9}
              >
                ⬇ export penholder.stl ✨
              </text>
            </g>
          )}

          {/* celebration sparkles */}
          {done && (
            <>
              <text
                x={28}
                y={120}
                fontSize={22}
                style={{ animation: "g5penholdercad-spark 0.9s 0.1s ease-out both" }}
              >
                ✨
              </text>
              <text
                x={VIEW_W - 36}
                y={132}
                fontSize={22}
                style={{ animation: "g5penholdercad-spark 0.9s 0.3s ease-out both" }}
              >
                ⭐
              </text>
              <text
                x={VIEW_W - 60}
                y={210}
                fontSize={22}
                style={{ animation: "g5penholdercad-spark 0.9s 0.46s ease-out both" }}
              >
                🎉
              </text>
            </>
          )}

          {/* view label */}
          <text x={10} y={VIEW_H - 8} fontSize={9} fill="#5b6a8c" className="font-mono">
            view {view + 1}/4 · holds ~{specs.penCapacity} pens
          </text>
        </svg>

        {/* rotate + wobble controls overlaid on the stage */}
        <div className="absolute right-2 top-2 flex flex-col gap-1">
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              rotate(-1);
            }}
            aria-label="Rotate the model left"
            className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-panel/80 text-sm text-ink-dim"
          >
            ⟲
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              rotate(1);
            }}
            aria-label="Rotate the model right"
            className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-panel/80 text-sm text-ink-dim"
          >
            ⟳
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              runWobble();
            }}
            aria-label="Run the wobble stability test"
            title="Wobble test"
            className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-panel/80 text-sm text-ink-dim"
          >
            〰
          </button>
        </div>
      </div>

      {/* ---------------- DESIGN BRIEF CHECKLIST ---------------- */}
      <div
        className="flex flex-col gap-1.5 rounded-xl border border-line bg-panel/40 p-2"
        role="group"
        aria-label="Design brief checklist"
      >
        <p className="px-1 font-mono text-[11px] uppercase tracking-wide text-ink-faint">
          📋 Design brief — all four must pass
        </p>
        <SpecRow
          ok={specs.wideOpening}
          label="Inner opening (10 pens fit)"
          value={`${Math.round(design.opening)}mm`}
          want={`≥ ${OPENING_MIN}mm`}
        />
        <SpecRow
          ok={specs.thickWalls}
          label="Wall thickness (not fragile)"
          value={`${Math.round(design.wall)}mm`}
          want={`≥ ${WALL_MIN}mm`}
        />
        <SpecRow
          ok={specs.tallEnough}
          label="Height (pens don't tip)"
          value={`${Math.round(design.height)}mm`}
          want={`≥ ${HEIGHT_MIN}mm`}
        />
        <SpecRow
          ok={specs.stableBase}
          label="Base wider than top (stable)"
          value={`${Math.round(specs.baseWidth)} vs ${Math.round(specs.topWidth)}`}
          want="base > top"
        />
      </div>

      {/* status line */}
      <div
        className="rounded-md px-2 py-1.5 text-center font-mono text-xs"
        role="status"
        aria-live="polite"
        style={{
          color: done ? "#05070d" : "#9aa6cf",
          background: done ? ACCENT : "rgba(11,16,32,0.5)",
          fontWeight: done ? 700 : 400,
        }}
      >
        {done ? "✨🎉 ⭐⭐⭐ " : ""}
        {done
          ? "Exported penholder.stl — every spec met!"
          : !specs.thickWalls
            ? "Walls too thin — make them thicker."
            : !specs.wideOpening
              ? "Pocket too narrow — widen the opening."
              : !specs.tallEnough
                ? "A little short — make it taller."
                : !specs.stableBase
                  ? "Top-heavy — widen the base past the top."
                  : "So close — nudge the last check into the green."}
      </div>

      {/* ---------------- SLIDERS ---------------- */}
      <div className="panel flex flex-col gap-3 rounded-xl p-3">
        <Slider
          label="Inner opening"
          hint="pocket width for the pens"
          value={design.opening}
          range={OPENING_RANGE}
          unit="mm"
          onChange={update("opening")}
          disabled={done}
          ok={specs.wideOpening}
        />
        <Slider
          label="Wall thickness"
          hint="too thin = fragile"
          value={design.wall}
          range={WALL_RANGE}
          unit="mm"
          onChange={update("wall")}
          disabled={done}
          ok={specs.thickWalls}
        />
        <Slider
          label="Height"
          hint="taller keeps pens upright"
          value={design.height}
          range={HEIGHT_RANGE}
          unit="mm"
          onChange={update("height")}
          disabled={done}
          ok={specs.tallEnough}
        />
        <Slider
          label="Base flare"
          hint="how far the base juts past the top"
          value={design.baseExtra}
          range={BASE_EXTRA_RANGE}
          unit="mm"
          onChange={update("baseExtra")}
          disabled={done}
          ok={specs.stableBase}
        />

        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] leading-tight text-ink-faint">
            Carve a pocket that fits 10 pens, keep the walls strong, stand it
            tall, and flare the base wider than the top.
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

function SpecRow({
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
      className="flex items-center justify-between rounded-lg border px-2.5 py-1.5"
      style={{
        borderColor: ok ? "#22c55e" : "#b45309",
        background: ok ? "rgba(34,197,94,0.08)" : "rgba(245,158,11,0.07)",
      }}
      aria-label={`${label}: ${ok ? "pass" : "not yet"} — ${value}, need ${want}`}
    >
      <span className="flex items-center gap-2 font-mono text-xs text-ink-dim">
        <span aria-hidden style={{ color: ok ? "#22c55e" : ACCENT }}>
          {ok ? "✓" : "○"}
        </span>
        {label}
      </span>
      <span className="flex items-center gap-2 font-mono text-[11px]">
        <span
          className="font-display tabular-nums"
          style={{ color: ok ? "#22c55e" : "#f7b955" }}
        >
          {value}
        </span>
        <span className="text-ink-faint">{want}</span>
      </span>
    </div>
  );
}

function Slider({
  label,
  hint,
  value,
  range,
  unit,
  onChange,
  disabled,
  ok,
}: {
  label: string;
  hint: string;
  value: number;
  range: { min: number; max: number; step: number };
  unit: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled: boolean;
  ok: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="flex items-center justify-between">
        <span className="text-ink-dim">
          {label} <span className="text-ink-faint">· {hint}</span>
        </span>
        <span
          className="font-display tabular-nums"
          style={{ color: ok ? "#22c55e" : ACCENT }}
        >
          {Math.round(value)}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={onChange}
        disabled={disabled}
        aria-label={`${label}, ${Math.round(value)}${unit}`}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-60"
        style={{ accentColor: ok ? "#22c55e" : ACCENT, touchAction: "none" }}
      />
    </label>
  );
}
