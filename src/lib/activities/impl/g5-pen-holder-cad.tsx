"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  3D Pen Holder Designer ✏️ — functional CAD with a REAL engineering  */
/*  trade-off. Class 4-6 explorers don't just drag four sliders up      */
/*  until everything is green — they design AGAINST A FILAMENT BUDGET.  */
/*                                                                      */
/*  Every mm of opening, wall, height and base flare costs plastic.     */
/*  Maxing every slider ALWAYS busts the budget, so brute force fails:  */
/*  you must reason about which dimensions to spend material on and      */
/*  which to keep lean. Three escalating briefs:                        */
/*    R1  learn the loop: meet 4 specs, comfy budget.                   */
/*    R2  tighter budget — now thick walls steal height; plan trade-offs*/
/*    R3  the twist — a HARD flare cap (can't just splay the base to    */
/*        win stability) + a bigger pocket. The only way to be stable    */
/*        is to keep the build lean so the legal flare is enough.        */
/*  Finish under budget with material to spare → 3⭐ (efficient). Win    */
/*  but scrape the budget → fewer ⭐. A clean win is always reachable.   */
/* ------------------------------------------------------------------ */

const ACCENT = "#f59e0b";
const VIEW_W = 360;
const VIEW_H = 320;

/* ----- slider ranges (each round's valid combo lives inside these) ----- */
const OPENING_RANGE = { min: 40, max: 110, step: 2 } as const;
const WALL_RANGE = { min: 1, max: 10, step: 1 } as const;
const HEIGHT_RANGE = { min: 50, max: 130, step: 2 } as const;
const BASE_EXTRA_RANGE = { min: 0, max: 40, step: 2 } as const; // mm the base juts past the top, per side

type RotView = 0 | 1 | 2 | 3;

interface Design {
  opening: number; // inner pocket width (mm)
  wall: number; // wall thickness (mm)
  height: number; // overall height (mm)
  baseExtra: number; // how far the base juts past the top, each side (mm)
}

/* ------------------------------------------------------------------ */
/*  ROUNDS — three hand-tuned, escalating design briefs.               */
/*  Each is verified (below) to have a comfortable winning design AND   */
/*  to be impossible to win by simply maxing every slider.              */
/* ------------------------------------------------------------------ */
interface Brief {
  name: string;
  story: string;
  openingMin: number; // pocket must be at least this wide
  wallMin: number; // walls at least this thick
  heightMin: number; // at least this tall
  flareMax: number; // base flare per side may not EXCEED this (R3 twist)
  budget: number; // filament budget in cm³ (model volume must stay ≤ this)
  start: Design; // deliberately-invalid starting point
}

const ROUNDS: readonly Brief[] = [
  {
    name: "Brief 1 · Desk tidy",
    story: "Hold 10 pens, don't be flimsy, don't tip. Plenty of plastic.",
    openingMin: 80,
    wallMin: 3,
    heightMin: 90,
    flareMax: BASE_EXTRA_RANGE.max,
    budget: 285,
    start: { opening: 56, wall: 2, height: 70, baseExtra: 0 },
  },
  {
    name: "Brief 2 · Travel cup",
    story: "Same job, but the printer is low on filament. Spend it wisely.",
    openingMin: 84,
    wallMin: 3,
    heightMin: 100,
    flareMax: BASE_EXTRA_RANGE.max,
    budget: 320,
    start: { opening: 110, wall: 9, height: 130, baseExtra: 28 },
  },
  {
    name: "Brief 3 · Slim shelf pot",
    story: "Wide pocket, tall — but the flare may be 8mm at MOST, and barely any spare plastic.",
    openingMin: 90,
    wallMin: 3,
    heightMin: 104,
    flareMax: 8, // the twist: can't splay the base to fake stability
    budget: 360,
    start: { opening: 110, wall: 8, height: 130, baseExtra: 6 },
  },
];

/* ----- volume model (deterministic; drives the filament budget) -----
   We approximate the printed object as the solid block (outer footprint
   tapering base→top, times height) MINUS the carved pocket. It does not
   need to be physically exact — only consistent and monotone so spending
   on any dimension genuinely costs plastic. Result in cm³. */
function volumeCm3(d: Design): number {
  const topWidth = d.opening + 2 * d.wall;
  const baseWidth = topWidth + 2 * d.baseExtra;
  // average cross-section width across the taper, treated as a square column
  const avgWidth = (topWidth + baseWidth) / 2; // mm
  const outerMm3 = avgWidth * avgWidth * d.height; // solid block, mm³
  const pocketDepth = d.height * 0.82; // pocket doesn't reach the floor
  const pocketMm3 = d.opening * d.opening * pocketDepth; // carved hollow, mm³
  const solidMm3 = Math.max(0, outerMm3 - pocketMm3);
  return solidMm3 / 1000; // mm³ → cm³
}

interface Specs {
  topWidth: number;
  baseWidth: number;
  penCapacity: number;
  volume: number; // cm³ used
  budget: number; // cm³ allowed
  wideOpening: boolean;
  thickWalls: boolean;
  tallEnough: boolean;
  stableBase: boolean;
  flareLegal: boolean; // base flare within the brief's cap
  underBudget: boolean; // volume ≤ budget
  spare: number; // budget - volume (cm³ left over; negative = over)
  allOk: boolean; // every spec, AND within budget
}

/** Pure, deterministic grade of a design against the active brief. */
function evaluate(d: Design, b: Brief): Specs {
  const topWidth = d.opening + 2 * d.wall;
  const baseWidth = topWidth + 2 * d.baseExtra;
  const penCapacity = Math.max(0, Math.floor(d.opening / 8));
  const volume = volumeCm3(d);

  const wideOpening = d.opening >= b.openingMin;
  const thickWalls = d.wall >= b.wallMin;
  const tallEnough = d.height >= b.heightMin;
  const stableBase = baseWidth > topWidth; // base genuinely wider than top
  const flareLegal = d.baseExtra <= b.flareMax;
  const underBudget = volume <= b.budget + 1e-6;
  const spare = b.budget - volume;

  return {
    topWidth,
    baseWidth,
    penCapacity,
    volume,
    budget: b.budget,
    wideOpening,
    thickWalls,
    tallEnough,
    stableBase,
    flareLegal,
    underBudget,
    spare,
    allOk:
      wideOpening &&
      thickWalls &&
      tallEnough &&
      stableBase &&
      flareLegal &&
      underBudget,
  };
}

/* Star award for a winning design: efficiency rewards leaving plastic to
   spare. Reaching ~12% of the budget spare earns full marks. Always
   winnable at 3⭐ because each brief has a comfortable lean solution. */
function starsFor(specs: Specs): 1 | 2 | 3 {
  const ratio = specs.spare / specs.budget; // fraction of budget left over
  if (ratio >= 0.12) return 3;
  if (ratio >= 0.04) return 2;
  return 1;
}

/* ------------------------------------------------------------------ */
/*  Isometric projection helpers (unchanged look & feel)               */
/* ------------------------------------------------------------------ */

const CX = VIEW_W / 2;
const FLOOR_Y = 252;
const ISO = 0.5;
const MM = 1.4; // px per mm

interface XY {
  x: number;
  y: number;
}

function iso(xAcross: number, yUp: number, view: RotView): XY {
  const lean = [0, 6, 0, -6][view];
  return { x: CX + xAcross + lean, y: FLOOR_Y - yUp };
}

export default function PenHolderCAD({ onComplete }: ActivityProps) {
  const [round, setRound] = useState<number>(0);
  const brief = ROUNDS[round];

  const [design, setDesign] = useState<Design>({ ...ROUNDS[0].start });
  const [view, setView] = useState<RotView>(0);
  const [solvedRound, setSolvedRound] = useState<boolean>(false); // current round met
  const [allDone, setAllDone] = useState<boolean>(false); // every round complete
  const [showPens, setShowPens] = useState<boolean>(false);
  const [wobbleNonce, setWobbleNonce] = useState<number>(0);
  const [bestStars, setBestStars] = useState<1 | 2 | 3>(3); // worst round caps final stars

  const reportedRef = useRef<boolean>(false);
  const lockRef = useRef<boolean>(false); // freeze sliders the instant a round is solved
  const nudgeReadyRef = useRef<boolean>(false);

  const specs: Specs = useMemo(() => evaluate(design, brief), [design, brief]);
  const topHeavy = !specs.stableBase;

  /* When the current design satisfies the brief, lock the round and
     advance (or finish). Final success fires onComplete exactly once. */
  useEffect(() => {
    if (allDone) return;
    if (!specs.allOk) return;
    if (lockRef.current) return;
    lockRef.current = true;

    const earned = starsFor(specs);
    setSolvedRound(true);
    setShowPens(true);
    setBestStars((prev) => (earned < prev ? earned : prev) as 1 | 2 | 3);

    const isLast = round >= ROUNDS.length - 1;
    if (isLast) {
      const finalStars = (earned < bestStars ? earned : bestStars) as 1 | 2 | 3;
      const t = window.setTimeout(() => {
        setAllDone(true);
        if (!reportedRef.current) {
          reportedRef.current = true;
          onComplete({
            passed: true,
            stars: finalStars,
            detail:
              finalStars === 3
                ? "All three briefs met — lean, strong, printable!"
                : finalStars === 2
                  ? "All briefs met — a little plastic-heavy on one design."
                  : "All briefs met — every design scraped the budget.",
          });
        }
      }, 950);
      return () => window.clearTimeout(t);
    }
    // not the last round: pause on the win, then slide in the next brief
    const t = window.setTimeout(() => {
      const next = round + 1;
      setRound(next);
      setDesign({ ...ROUNDS[next].start });
      setView(0);
      setSolvedRound(false);
      setShowPens(false);
      setWobbleNonce(0);
      lockRef.current = false;
      nudgeReadyRef.current = false;
    }, 1100);
    return () => window.clearTimeout(t);
  }, [specs, round, allDone, bestStars, onComplete]);

  /* A kind, debounced coaching nudge once the learner pauses on an
     invalid design — never reports passed:false (no penalty, just help). */
  const [hint, setHint] = useState<string>("");
  useEffect(() => {
    if (allDone || solvedRound) return;
    if (specs.allOk) {
      setHint("");
      return;
    }
    if (!nudgeReadyRef.current) {
      nudgeReadyRef.current = true;
      return;
    }
    const t = window.setTimeout(() => {
      setHint(coach(specs, brief));
    }, 650);
    return () => window.clearTimeout(t);
  }, [specs, brief, allDone, solvedRound]);

  const update = useCallback(
    (key: keyof Design) => (e: React.ChangeEvent<HTMLInputElement>) => {
      if (lockRef.current) return;
      const v = Number(e.target.value);
      setDesign((prev) => ({ ...prev, [key]: v }));
      setShowPens(false);
    },
    [],
  );

  const resetRound = useCallback(() => {
    if (lockRef.current || allDone) return;
    setDesign({ ...ROUNDS[round].start });
    setView(0);
    setShowPens(false);
    setHint("");
    nudgeReadyRef.current = false;
  }, [round, allDone]);

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

  const baseC = iso(0, 0, view);
  const topC = iso(0, hPx, view);
  const pocketDepth = Math.min(hPx - 8 * MM, design.height * MM * 0.82);
  const pocketC = iso(0, hPx - pocketDepth, view);

  const wobbleName = `g5penholdercad-wobble`;
  const win = solvedRound || allDone;
  const budgetPct = Math.min(100, (specs.volume / specs.budget) * 100);
  const overBudget = !specs.underBudget;

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

      {/* ---------------- BRIEF HEADER + ROUND PROGRESS ---------------- */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex flex-col">
          <span className="font-display text-sm font-bold" style={{ color: ACCENT }}>
            {brief.name}
          </span>
          <span className="text-[11px] leading-tight text-ink-faint">{brief.story}</span>
        </div>
        <div className="flex shrink-0 gap-1" aria-label={`Round ${round + 1} of ${ROUNDS.length}`}>
          {ROUNDS.map((_, i) => (
            <span
              key={i}
              aria-hidden
              className="grid h-6 w-6 place-items-center rounded-md font-mono text-[11px] font-bold"
              style={{
                background:
                  i < round || allDone
                    ? "#22c55e"
                    : i === round
                      ? ACCENT
                      : "rgba(11,16,32,0.6)",
                color: i <= round || allDone ? "#05070d" : "#5b6a8c",
                border: "1px solid var(--color-line, #27314f)",
              }}
            >
              {i < round || allDone ? "✓" : i + 1}
            </span>
          ))}
        </div>
      </div>

      {/* ---------------- CAD STAGE ---------------- */}
      <div
        className="panel relative overflow-hidden rounded-xl border p-2"
        style={{
          borderColor: win ? ACCENT : overBudget ? "#ef4444" : "var(--color-line, #27314f)",
          boxShadow: win ? `0 0 24px -6px ${ACCENT}` : undefined,
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
              fill={win ? "#1f2d18" : overBudget ? "#3a2230" : "#2a3650"}
              stroke={win ? ACCENT : overBudget ? "#ef4444" : "#3c4a6c"}
              strokeWidth={1.5}
            />

            {/* outer rim (top of the walls) */}
            <ellipse
              cx={topC.x}
              cy={topC.y}
              rx={topHalf}
              ry={ryTop}
              fill={win ? "#2b3a22" : "#34425f"}
              stroke={win ? ACCENT : "#46557a"}
              strokeWidth={1.5}
            />

            {/* ---- INNER POCKET (the subtracted hollow) ---- */}
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
            <ellipse
              cx={pocketC.x}
              cy={pocketC.y}
              rx={openHalf}
              ry={ryOpen}
              fill="#070b14"
            />
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

          {/* Ready-to-print stamp + STL export on a round win */}
          {win && (
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
                {allDone ? "ALL PRINTED" : "BRIEF MET"}
              </text>
              <text
                x={VIEW_W / 2}
                y={78}
                fontSize={11}
                textAnchor="middle"
                fill={ACCENT}
                opacity={0.9}
              >
                {allDone
                  ? "⬇ three designs exported ✨"
                  : `⬇ ${specs.spare.toFixed(0)}cm³ to spare → ${"⭐".repeat(starsFor(specs))}`}
              </text>
            </g>
          )}

          {/* celebration sparkles */}
          {win && (
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

      {/* ---------------- FILAMENT BUDGET METER ---------------- */}
      <div
        className="flex flex-col gap-1 rounded-xl border px-2.5 py-2"
        style={{
          borderColor: overBudget ? "#ef4444" : "var(--color-line, #27314f)",
          background: overBudget ? "rgba(239,68,68,0.08)" : "rgba(11,16,32,0.4)",
        }}
        role="group"
        aria-label="Filament budget"
      >
        <div className="flex items-center justify-between font-mono text-[11px]">
          <span className="text-ink-dim">🧵 Filament used</span>
          <span
            className="font-display tabular-nums"
            style={{ color: overBudget ? "#ef4444" : specs.spare > 0 ? "#22c55e" : ACCENT }}
            aria-label={`${specs.volume.toFixed(0)} of ${specs.budget} cubic centimetres used`}
          >
            {specs.volume.toFixed(0)} / {specs.budget} cm³
          </span>
        </div>
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-panel-2">
          <div
            className="h-full rounded-full"
            style={{
              width: `${budgetPct}%`,
              background: overBudget ? "#ef4444" : specs.spare > specs.budget * 0.12 ? "#22c55e" : ACCENT,
              transition: "width .15s ease, background .2s ease",
            }}
          />
        </div>
        <p className="text-[10px] leading-tight text-ink-faint">
          {overBudget
            ? "Over budget! Trim a dimension — you can't max everything."
            : "Win with plastic to spare for ⭐⭐⭐. Maxing every slider always busts the budget."}
        </p>
      </div>

      {/* ---------------- DESIGN BRIEF CHECKLIST ---------------- */}
      <div
        className="flex flex-col gap-1.5 rounded-xl border border-line bg-panel/40 p-2"
        role="group"
        aria-label="Design brief checklist"
      >
        <p className="px-1 font-mono text-[11px] uppercase tracking-wide text-ink-faint">
          📋 Brief — all checks green AND under budget
        </p>
        <SpecRow
          ok={specs.wideOpening}
          label="Inner opening (pens fit)"
          value={`${Math.round(design.opening)}mm`}
          want={`≥ ${brief.openingMin}mm`}
        />
        <SpecRow
          ok={specs.thickWalls}
          label="Wall thickness (not fragile)"
          value={`${Math.round(design.wall)}mm`}
          want={`≥ ${brief.wallMin}mm`}
        />
        <SpecRow
          ok={specs.tallEnough}
          label="Height (pens don't tip)"
          value={`${Math.round(design.height)}mm`}
          want={`≥ ${brief.heightMin}mm`}
        />
        <SpecRow
          ok={specs.stableBase}
          label="Base wider than top (stable)"
          value={`${Math.round(specs.baseWidth)} vs ${Math.round(specs.topWidth)}`}
          want="base > top"
        />
        {brief.flareMax < BASE_EXTRA_RANGE.max && (
          <SpecRow
            ok={specs.flareLegal}
            label="Flare cap (slim shelf!)"
            value={`${Math.round(design.baseExtra)}mm`}
            want={`≤ ${brief.flareMax}mm`}
          />
        )}
      </div>

      {/* status line */}
      <div
        className="rounded-md px-2 py-1.5 text-center font-mono text-xs"
        role="status"
        aria-live="polite"
        style={{
          color: win ? "#05070d" : "#9aa6cf",
          background: win ? ACCENT : "rgba(11,16,32,0.5)",
          fontWeight: win ? 700 : 400,
        }}
      >
        {allDone
          ? `✨🎉 ${"⭐".repeat(bestStars)} All three briefs printed!`
          : solvedRound
            ? `✨ Brief met — ${"⭐".repeat(starsFor(specs))} · loading next brief…`
            : hint || coach(specs, brief)}
      </div>

      {/* ---------------- SLIDERS ---------------- */}
      <div className="panel flex flex-col gap-3 rounded-xl p-3">
        <Slider
          label="Inner opening"
          hint="wider pocket = more plastic"
          value={design.opening}
          range={OPENING_RANGE}
          unit="mm"
          onChange={update("opening")}
          disabled={win || allDone}
          ok={specs.wideOpening}
        />
        <Slider
          label="Wall thickness"
          hint="too thin = fragile · thick = heavy"
          value={design.wall}
          range={WALL_RANGE}
          unit="mm"
          onChange={update("wall")}
          disabled={win || allDone}
          ok={specs.thickWalls}
        />
        <Slider
          label="Height"
          hint="taller keeps pens upright, costs plastic"
          value={design.height}
          range={HEIGHT_RANGE}
          unit="mm"
          onChange={update("height")}
          disabled={win || allDone}
          ok={specs.tallEnough}
        />
        <Slider
          label="Base flare"
          hint={
            brief.flareMax < BASE_EXTRA_RANGE.max
              ? `keep it ≤ ${brief.flareMax}mm this round`
              : "how far the base juts past the top"
          }
          value={design.baseExtra}
          range={BASE_EXTRA_RANGE}
          unit="mm"
          onChange={update("baseExtra")}
          disabled={win || allDone}
          ok={specs.stableBase && specs.flareLegal}
        />

        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] leading-tight text-ink-faint">
            Meet every check AND stay under the filament budget. Spend plastic
            only where the brief needs it — leftover plastic earns more stars.
          </p>
          <button
            type="button"
            onClick={resetRound}
            disabled={win || allDone}
            className="shrink-0 rounded-lg border border-line bg-panel/60 px-3 py-1.5 text-xs font-medium text-ink-dim disabled:opacity-50"
            aria-label="Reset this round to its starting values"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

/* Friendly, prioritized coaching message for an invalid design. */
function coach(specs: Specs, brief: Brief): string {
  if (!specs.flareLegal)
    return `Flare too big — this brief caps it at ${brief.flareMax}mm.`;
  if (!specs.underBudget)
    return `Over budget by ${Math.abs(specs.spare).toFixed(0)}cm³ — trim a dimension.`;
  if (!specs.thickWalls) return "Walls too thin — make them thicker.";
  if (!specs.wideOpening) return "Pocket too narrow — widen the opening.";
  if (!specs.tallEnough) return "A little short — make it taller.";
  if (!specs.stableBase) return "Top-heavy — flare the base past the top.";
  return "So close — nudge the last check into the green.";
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
