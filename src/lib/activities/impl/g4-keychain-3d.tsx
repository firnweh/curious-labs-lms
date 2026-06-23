"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  3D Keychain Studio 🔑 — GRADE 4-6 / explorer / threed              */
/*                                                                     */
/*  PROBLEM (not a checklist): you run a tiny 3D-print shop. Each      */
/*  CLIENT order is a SPEC you must read and satisfy with the CAD      */
/*  tools — add SOLID parts (name / symbols), and CUT a real keyring   */
/*  hole by setting the ring to HOLE then COMBINE. The catch: every    */
/*  solid part adds material WEIGHT, holes SAVE weight, and the slab   */
/*  must fit that order's print box. Each order has a WEIGHT BUDGET in */
/*  grams — go over and it won't print. So you must PLAN which parts   */
/*  to add, decide whether to punch the hole to lighten it, and scale  */
/*  to fit — there's no "add everything" win.                          */
/*                                                                     */
/*  3 escalating orders. The last one is the twist: the box is small   */
/*  AND the budget is tight, so the default layout overflows on both   */
/*  size and weight — you must shrink AND cut the hole to survive.     */
/*  Finish under budget with margin to spare → 3 stars.                */
/* ------------------------------------------------------------------ */

const ACCENT = "#f59e0b";
const GREEN = "#22c55e";
const RED = "#ef4444";

const VIEW_W = 360;
const VIEW_H = 300;

const FIXED_T = 0.4; // cm — plate thickness, always within every box's T limit
const SCALE_RANGE = { min: 0.6, max: 1.0, step: 0.02 } as const;

type SymbolId = "star" | "heart" | "shield";

interface SymbolDef {
  id: SymbolId;
  glyph: string;
  word: string;
  /* grams this symbol adds as a raised solid (deterministic). */
  grams: number;
}

const SYMBOLS: readonly SymbolDef[] = [
  { id: "star", glyph: "⭐", word: "star", grams: 3 },
  { id: "heart", glyph: "❤️", word: "heart", grams: 4 },
  { id: "shield", glyph: "🛡️", word: "shield", grams: 6 },
];

type RingMode = "solid" | "hole";

interface Studio {
  namePlaced: boolean;
  symbols: SymbolId[]; // can stack multiple raised symbols (each adds weight)
  ringPlaced: boolean;
  ringMode: RingMode;
  combined: boolean; // pressed COMBINE while ring is HOLE → real cutout
  scale: number; // 0.6 .. 1.0
}

function freshStudio(): Studio {
  return {
    namePlaced: false,
    symbols: [],
    ringPlaced: false,
    ringMode: "solid",
    combined: false,
    scale: 1.0,
  };
}

/* ---- Weight / material model (all deterministic) ---------------------------
   The slab's base weight scales with its footprint (≈ scale²). Each solid part
   adds grams; punching the ring hole REMOVES material. */
const SLAB_BASE_G = 22; // grams of the slab at scale 1.0
const NAME_G = 7; // raised name block
const RING_SOLID_G = 5; // a solid ring blob ADDS weight
const RING_HOLE_SAVING_G = 5; // a real punched hole REMOVES this much

interface Order {
  id: string;
  client: string;
  /* print box for this order (cm). */
  boxW: number;
  boxH: number;
  boxT: number;
  /* the base footprint of the un-scaled layout (cm at scale 1.0). */
  baseW: number;
  baseH: number;
  /* gram budget — finished weight must be ≤ this. */
  budget: number;
  /* spec requirements. */
  needName: boolean;
  needHole: boolean;
  minSymbols: number;
  /* human-readable spec lines for the order card. */
  spec: string[];
  /* margin (g) under budget that earns "comfortable" praise (3★ band). */
  comfyMargin: number;
}

/* THREE hand-authored, escalating orders. Each is solvable; the third forces
   both a shrink and a hole-cut. */
const ORDERS: readonly Order[] = [
  {
    id: "o1",
    client: "Maya's backpack tag",
    boxW: 6,
    boxH: 3,
    boxT: 0.5,
    baseW: 6.6, // a touch too wide at scale 1.0 → must shrink a little
    baseH: 2.4,
    budget: 40,
    needName: true,
    needHole: true,
    minSymbols: 1,
    comfyMargin: 6,
    spec: [
      "Name on the tag",
      "At least 1 symbol",
      "A real keyring hole",
      "Fits the 6×3 cm box",
      "Weight ≤ 40 g",
    ],
  },
  {
    id: "o2",
    client: "Coach Rao — gym locker",
    boxW: 5,
    boxH: 2.8,
    boxT: 0.5,
    baseW: 6.0,
    baseH: 2.7,
    budget: 34,
    needName: true,
    needHole: true,
    minSymbols: 2, // must stack two symbols → more weight to manage
    comfyMargin: 5,
    spec: [
      "Name on the tag",
      "At least 2 symbols",
      "A real keyring hole",
      "Fits the 5×2.8 cm box",
      "Weight ≤ 34 g",
    ],
  },
  {
    id: "o3",
    // TWIST: tiny box + tight budget. Default scale overflows the box, and a
    // solid (un-punched) ring blows the budget — you MUST shrink AND cut.
    client: "Tiny drone key — featherweight",
    boxW: 4.2,
    boxH: 2.4,
    boxT: 0.5,
    baseW: 6.4,
    baseH: 2.6,
    budget: 26,
    needName: true,
    needHole: true,
    minSymbols: 1,
    comfyMargin: 4,
    spec: [
      "Name on the tag",
      "At least 1 symbol",
      "A real keyring hole (saves weight!)",
      "Fits the small 4.2×2.4 cm box",
      "Weight ≤ 26 g — featherweight!",
    ],
  },
];

interface Dims {
  w: number;
  h: number;
  t: number;
  fits: boolean;
}

/** Pure bounding box for the current order + scale. */
function dimsOf(s: Studio, o: Order): Dims {
  const w = o.baseW * s.scale;
  const h = o.baseH * s.scale;
  const t = FIXED_T;
  const fits =
    w <= o.boxW + 1e-6 && h <= o.boxH + 1e-6 && t <= o.boxT + 1e-6;
  return { w, h, t, fits };
}

/** Pure, deterministic finished weight in grams. */
function weightOf(s: Studio): number {
  let g = SLAB_BASE_G * s.scale * s.scale; // slab footprint ≈ scale²
  if (s.namePlaced) g += NAME_G;
  for (const id of s.symbols) {
    g += SYMBOLS.find((sy) => sy.id === id)?.grams ?? 0;
  }
  if (s.ringPlaced) {
    if (s.ringMode === "hole" && s.combined) g -= RING_HOLE_SAVING_G; // real cut
    else g += RING_SOLID_G; // solid blob adds material
  }
  return Math.max(0, Math.round(g * 10) / 10);
}

interface Checks {
  hasName: boolean;
  hasSymbols: boolean;
  realHole: boolean; // ring placed + HOLE + combined
  inBox: boolean;
  underBudget: boolean;
  all: boolean;
}

function checksOf(s: Studio, o: Order, d: Dims, grams: number): Checks {
  const hasName = !o.needName || s.namePlaced;
  const hasSymbols = s.symbols.length >= o.minSymbols;
  const realHole = !o.needHole || (s.ringPlaced && s.ringMode === "hole" && s.combined);
  const inBox = d.fits;
  const underBudget = grams <= o.budget + 1e-6;
  return {
    hasName,
    hasSymbols,
    realHole,
    inBox,
    underBudget,
    all: hasName && hasSymbols && realHole && inBox && underBudget,
  };
}

export default function KeychainStudio({ onComplete }: ActivityProps) {
  const [round, setRound] = useState<number>(0); // 0..2
  const [studio, setStudio] = useState<Studio>(() => freshStudio());
  const [done, setDone] = useState<boolean>(false);
  const [starTotal, setStarTotal] = useState<number>(0); // sum of per-order star bands
  const [flash, setFlash] = useState<boolean>(false); // brief "order shipped" flash
  const wonRef = useRef<boolean>(false);
  const nudgeReadyRef = useRef<boolean>(false);
  const flashTimer = useRef<number | null>(null);

  const order = ORDERS[round];
  const dims: Dims = useMemo(() => dimsOf(studio, order), [studio, order]);
  const grams: number = useMemo(() => weightOf(studio), [studio]);
  const checks: Checks = useMemo(
    () => checksOf(studio, order, dims, grams),
    [studio, order, dims, grams],
  );

  const isFinalOrder = round === ORDERS.length - 1;

  /* A solid ring that's been "combined" can't really make a hole. */
  const solidBlobNote = studio.ringPlaced && studio.ringMode === "solid";

  useEffect(() => {
    return () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    };
  }, []);

  /* SHIP this order. Only enabled when every spec line passes. Advances to the
     next order, or fires onComplete once on the final order. */
  const handleShip = useCallback(() => {
    if (wonRef.current) return;
    if (!checks.all) {
      onComplete({
        passed: false,
        detail: "Not ready to print — make every spec line on the order card go green.",
      });
      return;
    }

    /* Per-order star band: under budget with margin to spare = full credit. */
    const margin = order.budget - grams;
    const band = margin >= order.comfyMargin ? 3 : margin >= 0 ? 2 : 0;
    const runningTotal = starTotal + band;

    if (!isFinalOrder) {
      setStarTotal(runningTotal);
      setFlash(true);
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => {
        setFlash(false);
        setRound((r) => r + 1);
        setStudio(freshStudio());
      }, 900);
      return;
    }

    /* Final order shipped → grade the whole shop run. */
    wonRef.current = true;
    setStarTotal(runningTotal);
    setDone(true);
    const maxStars = ORDERS.length * 3;
    // Map total band points (0..9) → 1..3 stars; a comfortable run = 3.
    const stars: 1 | 2 | 3 =
      runningTotal >= maxStars - 1 ? 3 : runningTotal >= ORDERS.length * 2 ? 2 : 1;
    onComplete({
      passed: true,
      stars,
      detail: `All ${ORDERS.length} orders shipped — every print fit its box and stayed under budget.`,
    });
  }, [checks.all, grams, order, starTotal, isFinalOrder, onComplete]);

  /* Kind, debounced nudge when the learner pauses on an invalid design. */
  useEffect(() => {
    if (done || flash) return;
    if (checks.all) return;
    if (!nudgeReadyRef.current) {
      nudgeReadyRef.current = true;
      return;
    }
    const t = window.setTimeout(() => {
      if (wonRef.current) return;
      let detail = "Keep building — make every spec line green.";
      if (!checks.hasName) detail = "This order needs the NAME block on the tag.";
      else if (!checks.hasSymbols) {
        const need = order.minSymbols;
        detail =
          need > 1
            ? `Add at least ${need} symbols for this order.`
            : "Add at least one symbol — star, heart or shield.";
      } else if (!checks.realHole) {
        if (!studio.ringPlaced) detail = "Add a ring near the top of the tag.";
        else if (studio.ringMode === "solid")
          detail = "A solid blob has no hole — switch the ring to HOLE.";
        else detail = "Press COMBINE to punch the keyring hole through the tag.";
      } else if (!checks.inBox) {
        detail = `Too big for this order's box — shrink it until the size box turns green.`;
      } else if (!checks.underBudget) {
        detail = `${grams} g is over the ${order.budget} g budget — punch the ring HOLE to save weight, or shrink the tag.`;
      }
      onComplete({ passed: false, detail });
    }, 900);
    return () => window.clearTimeout(t);
  }, [studio, checks, done, flash, grams, order, onComplete]);

  /* ---- mutators (blocked once the run is won) ---- */
  const placeName = useCallback(() => {
    if (wonRef.current) return;
    setStudio((p) => ({ ...p, namePlaced: !p.namePlaced }));
  }, []);

  const toggleSymbol = useCallback((id: SymbolId) => {
    if (wonRef.current) return;
    setStudio((p) => {
      const has = p.symbols.includes(id);
      return {
        ...p,
        symbols: has ? p.symbols.filter((x) => x !== id) : [...p.symbols, id],
      };
    });
  }, []);

  const placeRing = useCallback(() => {
    if (wonRef.current) return;
    setStudio((p) =>
      p.ringPlaced
        ? { ...p, ringPlaced: false, combined: false }
        : { ...p, ringPlaced: true },
    );
  }, []);

  const setRingMode = useCallback((mode: RingMode) => {
    if (wonRef.current) return;
    setStudio((p) => ({ ...p, ringMode: mode, combined: false }));
  }, []);

  const combine = useCallback(() => {
    if (wonRef.current) return;
    setStudio((p) => (p.ringPlaced ? { ...p, combined: true } : p));
  }, []);

  const onScale = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (wonRef.current) return;
    const v = Number(e.target.value);
    setStudio((p) => ({ ...p, scale: v }));
  }, []);

  const restart = useCallback(() => {
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    wonRef.current = false;
    nudgeReadyRef.current = false;
    setRound(0);
    setStarTotal(0);
    setFlash(false);
    setStudio(freshStudio());
    setDone(false);
  }, []);

  /* ---- plate geometry in the SVG (scaled from the cm dims) ---- */
  const PX_PER_CM = 42;
  const plateW = dims.w * PX_PER_CM;
  const plateH = dims.h * PX_PER_CM;
  const cx = VIEW_W / 2;
  const cy = VIEW_H / 2 + 6;
  const left = cx - plateW / 2;
  const top = cy - plateH / 2;
  const depth = 14 * studio.scale;
  const ringCx = cx;
  const ringCy = top + 12;
  const ringR = 11 * studio.scale;
  const realHole = studio.ringPlaced && studio.ringMode === "hole" && studio.combined;
  const overBudget = grams > order.budget + 1e-6;

  /* Where the first/second placed symbols sit on the tag. */
  const symbolSlots: { x: number; y: number }[] = [
    { x: left + plateW - 18 * studio.scale, y: top + 22 * studio.scale },
    { x: left + 18 * studio.scale, y: top + 22 * studio.scale },
    { x: left + plateW - 18 * studio.scale, y: top + plateH - 12 * studio.scale },
  ];

  return (
    <div className="flex w-full flex-col gap-3 text-ink" style={{ maxWidth: 440 }}>
      <style>{`
        @keyframes g4keychain3d-punch {
          0% { transform: scale(0.2); opacity: 0; }
          60% { transform: scale(1.18); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g4keychain3d-drop {
          0% { transform: translateY(-26px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes g4keychain3d-stamp {
          0% { transform: scale(0.2) rotate(-12deg); opacity: 0; }
          60% { transform: scale(1.1) rotate(-8deg); opacity: 1; }
          100% { transform: scale(1) rotate(-8deg); opacity: 1; }
        }
        @keyframes g4keychain3d-spark {
          0% { transform: scale(0); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: scale(1.3) rotate(40deg); opacity: 0; }
        }
        @keyframes g4keychain3d-slice {
          from { transform: translateY(0); }
          to { transform: translateY(6px); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; }
        }
      `}</style>

      {/* ---------------- ORDER CARD ---------------- */}
      <div
        className="rounded-xl border p-2.5"
        style={{
          borderColor: "var(--color-line, #27314f)",
          background: "rgba(11,16,32,0.45)",
        }}
        role="group"
        aria-label={`Order ${round + 1} of ${ORDERS.length}`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
            📦 Order {round + 1} / {ORDERS.length}
          </p>
          <div className="flex items-center gap-1" aria-label={`${round} orders shipped`}>
            {ORDERS.map((_, i) => (
              <span
                key={i}
                aria-hidden
                className="text-xs"
                style={{ opacity: i < round || (done && i <= round) ? 1 : 0.25 }}
              >
                {i < round || (done && i <= round) ? "✅" : "⬜"}
              </span>
            ))}
          </div>
        </div>
        <p className="mt-1 text-sm font-bold" style={{ color: ACCENT }}>
          {order.client}
        </p>
        <p className="mt-0.5 text-[11px] text-ink-dim">
          Read the spec, then build it with the CAD tools below.
        </p>
      </div>

      {/* ---------------- WORKPLANE STAGE ---------------- */}
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
          aria-label={`3D workplane: a keychain tag for ${order.client}, ${dims.w.toFixed(1)} by ${dims.h.toFixed(1)} centimetres, weight ${grams} grams.`}
          style={{ maxHeight: 320, touchAction: "none" }}
        >
          <defs>
            <clipPath id="g4kc-ringhole">
              <path
                d={`M 0 0 H ${VIEW_W} V ${VIEW_H} H 0 Z
                    M ${ringCx} ${ringCy} m ${-ringR} 0
                    a ${ringR} ${ringR * 0.62} 0 1 0 ${ringR * 2} 0
                    a ${ringR} ${ringR * 0.62} 0 1 0 ${-ringR * 2} 0 Z`}
                clipRule="evenodd"
              />
            </clipPath>
          </defs>

          {/* faint workplane grid with a subtle 3D tilt */}
          <g transform={`translate(${cx} ${cy}) skewX(-10) translate(${-cx} ${-cy})`}>
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
          </g>

          {/* this order's printable build-box outline (green when the design fits) */}
          <rect
            x={cx - (order.boxW * PX_PER_CM) / 2}
            y={cy - (order.boxH * PX_PER_CM) / 2}
            width={order.boxW * PX_PER_CM}
            height={order.boxH * PX_PER_CM}
            rx={4}
            fill="none"
            stroke={dims.fits ? GREEN : RED}
            strokeWidth={1.5}
            strokeDasharray="5 4"
            opacity={0.8}
          />

          {/* ground shadow */}
          <ellipse
            cx={cx}
            cy={top + plateH + depth + 6}
            rx={plateW / 2}
            ry={7}
            fill="#05070d"
            opacity={0.4}
          />

          {/* THE TAG — extruded slab; clipped through the loop when it's a real hole */}
          <g clipPath={realHole ? "url(#g4kc-ringhole)" : undefined}>
            <path
              d={`M ${left} ${top + plateH}
                  L ${left} ${top + plateH + depth}
                  L ${left + plateW} ${top + plateH + depth}
                  L ${left + plateW} ${top + plateH} Z`}
              fill={done ? "#7a5212" : "#243150"}
              stroke="#0a0e18"
              strokeWidth={1}
            />
            <rect
              x={left}
              y={top}
              width={plateW}
              height={plateH}
              rx={6}
              fill={done ? "#3a2c0c" : "#2c3a5a"}
              stroke={done ? ACCENT : "#3c4a6c"}
              strokeWidth={1.5}
            />
          </g>

          {/* NAME text block (a solid) */}
          {studio.namePlaced && (
            <g style={{ animation: "g4keychain3d-drop .35s ease-out both" }}>
              <text
                x={cx}
                y={cy + 8 * studio.scale}
                fontSize={22 * studio.scale}
                fontWeight={800}
                letterSpacing={1}
                textAnchor="middle"
                fill={done ? ACCENT : "#e8eefc"}
                style={{ paintOrder: "stroke" }}
                stroke="#0a0e18"
                strokeWidth={1.2}
              >
                ALEX
              </text>
            </g>
          )}

          {/* SYMBOLS (solids) — each placed symbol sits in its own slot */}
          {studio.symbols.map((id, i) => {
            const slot = symbolSlots[i] ?? symbolSlots[symbolSlots.length - 1];
            return (
              <text
                key={id}
                x={slot.x}
                y={slot.y}
                fontSize={18 * studio.scale}
                textAnchor="middle"
                style={{ animation: "g4keychain3d-drop .35s ease-out both" }}
              >
                {SYMBOLS.find((sy) => sy.id === id)?.glyph}
              </text>
            );
          })}

          {/* THE RING near the top edge */}
          {studio.ringPlaced && !realHole && (
            <g key={`ring-${studio.ringMode}-${studio.combined}`}>
              <ellipse
                cx={ringCx}
                cy={ringCy}
                rx={ringR}
                ry={ringR * 0.62}
                fill={studio.ringMode === "hole" ? "#0c1322" : "#1c2742"}
                stroke={studio.ringMode === "hole" ? ACCENT : "#46557a"}
                strokeWidth={1.5}
                strokeDasharray={studio.ringMode === "hole" ? "3 2" : "0"}
              />
              <ellipse
                cx={ringCx}
                cy={ringCy}
                rx={ringR * 0.45}
                ry={ringR * 0.28}
                fill="#0a0e18"
              />
            </g>
          )}
          {/* the REAL punched loop */}
          {realHole && (
            <ellipse
              key="real-ring"
              cx={ringCx}
              cy={ringCy}
              rx={ringR}
              ry={ringR * 0.62}
              fill="none"
              stroke={ACCENT}
              strokeWidth={2.5}
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                animation: "g4keychain3d-punch .4s ease-out both",
              }}
            />
          )}

          {/* slicing-style print-layer preview when the design is fully valid */}
          {checks.all && !done && !flash &&
            Array.from({ length: 4 }, (_, i) => (
              <line
                key={`slice${i}`}
                x1={left + 4}
                y1={top + plateH - 6 - i * 7}
                x2={left + plateW - 4}
                y2={top + plateH - 6 - i * 7}
                stroke={GREEN}
                strokeWidth={1}
                opacity={0.45}
                style={{ animation: `g4keychain3d-slice 1s ${i * 0.12}s ease-in-out infinite alternate` }}
              />
            ))}

          {/* dimension + weight callout */}
          <text
            x={cx}
            y={top + plateH + depth + 22}
            fontSize={11}
            fontWeight={700}
            textAnchor="middle"
            fill={dims.fits ? GREEN : RED}
            className="font-mono"
          >
            {dims.w.toFixed(1)} × {dims.h.toFixed(1)} × {dims.t.toFixed(1)} cm
          </text>
          <text
            x={cx}
            y={top + plateH + depth + 36}
            fontSize={11}
            fontWeight={700}
            textAnchor="middle"
            fill={overBudget ? RED : GREEN}
            className="font-mono"
          >
            {grams} g / {order.budget} g
          </text>

          {/* per-order "shipped!" flash between rounds */}
          {flash && !done && (
            <g
              style={{
                transformBox: "view-box",
                transformOrigin: "center",
                animation: "g4keychain3d-stamp .5s ease-out both",
              }}
            >
              <rect
                x={VIEW_W / 2 - 96}
                y={30}
                width={192}
                height={46}
                rx={8}
                fill="rgba(7,11,20,0.9)"
                stroke={GREEN}
                strokeWidth={3}
              />
              <text
                x={VIEW_W / 2}
                y={59}
                fontSize={15}
                fontWeight={800}
                textAnchor="middle"
                fill={GREEN}
                letterSpacing={1}
              >
                ORDER SHIPPED ✅
              </text>
            </g>
          )}

          {/* Ready-to-print stamp on the final win */}
          {done && (
            <g
              style={{
                transformBox: "view-box",
                transformOrigin: "center",
                animation: "g4keychain3d-stamp .5s ease-out both",
              }}
            >
              <rect
                x={VIEW_W / 2 - 108}
                y={26}
                width={216}
                height={54}
                rx={8}
                fill="rgba(7,11,20,0.88)"
                stroke={ACCENT}
                strokeWidth={3}
              />
              <text
                x={VIEW_W / 2}
                y={49}
                fontSize={16}
                fontWeight={800}
                textAnchor="middle"
                fill={ACCENT}
                letterSpacing={1.5}
              >
                ALL ORDERS SHIPPED
              </text>
              <text
                x={VIEW_W / 2}
                y={69}
                fontSize={11}
                textAnchor="middle"
                fill={ACCENT}
                opacity={0.9}
              >
                ⬇ {ORDERS.length} keychains printed ✨
              </text>
            </g>
          )}

          {/* celebration sparkles */}
          {done && (
            <>
              <text
                x={26}
                y={120}
                fontSize={22}
                style={{ animation: "g4keychain3d-spark .9s .1s ease-out both" }}
              >
                ✨
              </text>
              <text
                x={VIEW_W - 36}
                y={132}
                fontSize={22}
                style={{ animation: "g4keychain3d-spark .9s .3s ease-out both" }}
              >
                ⭐
              </text>
              <text
                x={VIEW_W - 58}
                y={206}
                fontSize={22}
                style={{ animation: "g4keychain3d-spark .9s .46s ease-out both" }}
              >
                🎉
              </text>
            </>
          )}
        </svg>

        {/* "can't thread a solid blob" / "over budget" warning overlay */}
        {!done && !flash && solidBlobNote && (
          <div
            className="absolute inset-x-2 bottom-2 rounded-md px-2 py-1 text-center text-[11px] font-medium"
            style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5" }}
            role="note"
          >
            You can&apos;t thread a keyring through a solid blob — and it adds weight. Set
            the ring to HOLE.
          </div>
        )}
        {!done && !flash && !solidBlobNote && overBudget && (
          <div
            className="absolute inset-x-2 bottom-2 rounded-md px-2 py-1 text-center text-[11px] font-medium"
            style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5" }}
            role="note"
          >
            Over budget by {Math.round((grams - order.budget) * 10) / 10} g — cut the ring
            hole to lighten it, or shrink the tag.
          </div>
        )}
      </div>

      {/* ---------------- SPEC CHECKLIST ---------------- */}
      <div
        className="flex flex-col gap-1.5 rounded-xl border border-line bg-panel/40 p-2"
        role="group"
        aria-label="Order spec"
      >
        <p className="px-1 font-mono text-[11px] uppercase tracking-wide text-ink-faint">
          📋 Spec — every line must pass to ship
        </p>
        {order.needName && (
          <CheckRow ok={checks.hasName} label="Name on the tag" want="placed" />
        )}
        <CheckRow
          ok={checks.hasSymbols}
          label={order.minSymbols > 1 ? `At least ${order.minSymbols} symbols` : "At least 1 symbol"}
          want={`${studio.symbols.length}/${order.minSymbols}`}
        />
        {order.needHole && (
          <CheckRow ok={checks.realHole} label="Real keyring hole" want="cut through" />
        )}
        <CheckRow
          ok={checks.inBox}
          label={`Fits the ${order.boxW}×${order.boxH} cm box`}
          want={dims.fits ? "in range" : "shrink it"}
        />
        <CheckRow
          ok={checks.underBudget}
          label={`Weight ≤ ${order.budget} g`}
          want={`${grams} g`}
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
        {done
          ? "✨🎉 Whole shop run complete — every order shipped on spec!"
          : flash
            ? "✅ Shipped! Loading the next order…"
            : !checks.hasName
              ? "This order needs the NAME block."
              : !checks.hasSymbols
                ? `Add ${order.minSymbols > studio.symbols.length ? order.minSymbols - studio.symbols.length : order.minSymbols} more symbol${order.minSymbols - studio.symbols.length === 1 ? "" : "s"}.`
                : !checks.realHole
                  ? !studio.ringPlaced
                    ? "Add a ring near the top."
                    : studio.ringMode === "solid"
                      ? "Switch the ring to HOLE — a solid blob can't thread."
                      : "Press COMBINE to punch the hole through the tag."
                  : !checks.inBox
                    ? "Too big — shrink it until the box turns green."
                    : !checks.underBudget
                      ? `Over budget — cut the hole or shrink to get under ${order.budget} g.`
                      : "On spec — press SHIP! ✨"}
      </div>

      {/* ---------------- CAD BUILD TOOLS ---------------- */}
      <div className="panel flex flex-col gap-3 rounded-xl p-3">
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
            Add solid parts · each adds weight
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <PaletteButton
              active={studio.namePlaced}
              disabled={done || flash}
              onClick={placeName}
              ariaLabel={studio.namePlaced ? `Remove the name block, saves ${NAME_G} grams` : `Add the name block, adds ${NAME_G} grams`}
            >
              🔤 Name <Tag>+{NAME_G}g</Tag>
            </PaletteButton>
            {SYMBOLS.map((sy) => {
              const on = studio.symbols.includes(sy.id);
              return (
                <PaletteButton
                  key={sy.id}
                  active={on}
                  disabled={done || flash}
                  onClick={() => toggleSymbol(sy.id)}
                  ariaLabel={`${on ? "Remove" : "Add"} the ${sy.word} symbol, ${sy.grams} grams`}
                >
                  {sy.glyph} {sy.word} <Tag>+{sy.grams}g</Tag>
                </PaletteButton>
              );
            })}
          </div>
        </div>

        {/* RING build — place, set SOLID/HOLE, combine */}
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
            Ring loop — solid adds {RING_SOLID_G}g · a cut hole saves {RING_HOLE_SAVING_G}g
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <PaletteButton
              active={studio.ringPlaced}
              disabled={done || flash}
              onClick={placeRing}
              ariaLabel={studio.ringPlaced ? "Remove the ring" : "Add a ring near the top"}
            >
              ⭕ Ring
            </PaletteButton>

            <div
              className="flex overflow-hidden rounded-lg border border-line"
              role="group"
              aria-label="Ring shape mode"
            >
              {(["solid", "hole"] as RingMode[]).map((mode) => {
                const on = studio.ringMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setRingMode(mode)}
                    disabled={done || flash || !studio.ringPlaced}
                    aria-pressed={on}
                    aria-label={`Set ring to ${mode}`}
                    className="px-3 py-1.5 text-xs font-medium transition disabled:opacity-40"
                    style={
                      on
                        ? { background: ACCENT, color: "#05070d", fontWeight: 700 }
                        : { color: "var(--color-ink-dim, #9aa6b2)" }
                    }
                  >
                    {mode === "solid" ? "Solid" : "Hole"}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={combine}
              disabled={done || flash || !studio.ringPlaced || studio.combined}
              aria-label="Combine the shapes to punch the ring hole"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40"
              style={{ background: "#2c3a5a", color: "#e8eefc", border: `1px solid ${ACCENT}` }}
            >
              ⚙ Combine
            </button>
          </div>
        </div>

        {/* SCALE slider */}
        <label className="flex flex-col gap-1 text-xs">
          <span className="flex items-center justify-between">
            <span className="text-ink-dim">
              Scale <span className="text-ink-faint">· smaller = fits + lighter</span>
            </span>
            <span
              className="font-display tabular-nums"
              style={{ color: dims.fits ? GREEN : RED }}
            >
              {Math.round(studio.scale * 100)}%
            </span>
          </span>
          <input
            type="range"
            min={SCALE_RANGE.min}
            max={SCALE_RANGE.max}
            step={SCALE_RANGE.step}
            value={studio.scale}
            onChange={onScale}
            disabled={done || flash}
            aria-label={`Scale, ${Math.round(studio.scale * 100)} percent`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-60"
            style={{ accentColor: dims.fits ? GREEN : ACCENT, touchAction: "none" }}
          />
        </label>

        {/* SHIP + RESTART */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={restart}
            className="shrink-0 rounded-lg border border-line bg-panel/60 px-3 py-1.5 text-xs font-medium text-ink-dim"
            aria-label="Restart from the first order"
          >
            Restart
          </button>
          <button
            type="button"
            onClick={handleShip}
            disabled={done || flash}
            aria-label={isFinalOrder ? "Ship the final order" : "Ship this order"}
            className="rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-60"
            style={{
              background: checks.all ? ACCENT : "rgba(245,158,11,0.25)",
              color: checks.all ? "#05070d" : "#caa86a",
              boxShadow: checks.all ? `0 0 16px -4px ${ACCENT}` : undefined,
              transition: "background .2s ease, box-shadow .2s ease",
            }}
          >
            {done ? "Done ✓" : isFinalOrder ? "Ship final order 🚚" : "Ship order 🚚"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- small presentational helpers ---------------- */

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="ml-1 rounded px-1 font-mono text-[10px]"
      style={{ background: "rgba(0,0,0,0.18)" }}
    >
      {children}
    </span>
  );
}

function CheckRow({
  ok,
  label,
  want,
}: {
  ok: boolean;
  label: string;
  want: string;
}) {
  return (
    <div
      className="flex items-center justify-between rounded-lg border px-2.5 py-1.5"
      style={{
        borderColor: ok ? GREEN : "#b45309",
        background: ok ? "rgba(34,197,94,0.08)" : "rgba(245,158,11,0.07)",
      }}
      aria-label={`${label}: ${ok ? "pass" : "not yet"} — ${want}`}
    >
      <span className="flex items-center gap-2 font-mono text-xs text-ink-dim">
        <span aria-hidden style={{ color: ok ? GREEN : ACCENT }}>
          {ok ? "✓" : "○"}
        </span>
        {label}
      </span>
      <span
        className="font-mono text-[11px]"
        style={{ color: ok ? GREEN : "#f7b955" }}
      >
        {want}
      </span>
    </div>
  );
}

function PaletteButton({
  active,
  disabled,
  onClick,
  ariaLabel,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        if (!disabled) onClick();
      }}
      disabled={disabled}
      aria-pressed={active}
      aria-label={ariaLabel}
      className="rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50"
      style={
        active
          ? { background: ACCENT, color: "#05070d", borderColor: ACCENT, fontWeight: 700 }
          : {
              background: "rgba(11,16,32,0.4)",
              color: "var(--color-ink-dim, #9aa6b2)",
              borderColor: "var(--color-line, #27314f)",
            }
      }
    >
      {children}
    </button>
  );
}
