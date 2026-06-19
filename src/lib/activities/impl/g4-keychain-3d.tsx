"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  3D Keychain Studio 🔑 — GRADE 4 / explorer / threed                */
/*  Single learning goal: a 3D model is built by ADDING solid shapes   */
/*  and SUBTRACTING "hole" shapes — and only a shape set to HOLE and    */
/*  then COMBINED punches a real opening. Plus, every part must fit     */
/*  inside the printable size box. The learner places a name + one      */
/*  symbol + a ring, switches the ring to HOLE, combines to cut a real */
/*  keyring loop, scales the layout back inside 6×3×0.5 cm, then        */
/*  exports keychain.stl.                                               */
/* ------------------------------------------------------------------ */

const ACCENT = "#f59e0b";
const GREEN = "#22c55e";
const RED = "#ef4444";

const VIEW_W = 360;
const VIEW_H = 300;

/* Printable build-volume limits (centimetres). */
const MAX_W = 6;
const MAX_H = 3;
const MAX_T = 0.5;

/* The un-scaled layout is intentionally a touch too big (6.6 cm wide) so the
   learner MUST shrink it with the scale slider — teaching "fit the box". */
const BASE_W = 6.6; // cm at scale 1.0
const BASE_H = 2.4; // cm at scale 1.0
const FIXED_T = 0.4; // cm — plate thickness, always within the 0.5 limit

const SCALE_RANGE = { min: 0.6, max: 1.0, step: 0.02 } as const;

type SymbolId = "star" | "heart" | "shield";

interface SymbolDef {
  id: SymbolId;
  glyph: string;
  word: string;
}

const SYMBOLS: readonly SymbolDef[] = [
  { id: "star", glyph: "⭐", word: "star" },
  { id: "heart", glyph: "❤️", word: "heart" },
  { id: "shield", glyph: "🛡️", word: "shield" },
];

type RingMode = "solid" | "hole";

interface Studio {
  namePlaced: boolean;
  symbol: SymbolId | null;
  ringPlaced: boolean;
  ringMode: RingMode;
  combined: boolean; // pressed COMBINE while ring is a HOLE → real cutout
  scale: number; // 0.6 .. 1.0
}

const START: Studio = {
  namePlaced: false,
  symbol: null,
  ringPlaced: false,
  ringMode: "solid",
  combined: false,
  scale: 1.0,
};

interface Dims {
  w: number;
  h: number;
  t: number;
  fits: boolean;
}

/** Pure, deterministic read-out of the current bounding box (cm). */
function dimsOf(s: Studio): Dims {
  const w = BASE_W * s.scale;
  const h = BASE_H * s.scale;
  const t = FIXED_T;
  const fits = w <= MAX_W + 1e-6 && h <= MAX_H + 1e-6 && t <= MAX_T + 1e-6;
  return { w, h, t, fits };
}

interface Checks {
  hasName: boolean;
  hasSymbol: boolean;
  realHole: boolean; // ring placed + set to HOLE + combined
  inBox: boolean;
  all: boolean;
}

function checksOf(s: Studio, d: Dims): Checks {
  const hasName = s.namePlaced;
  const hasSymbol = s.symbol !== null;
  const realHole = s.ringPlaced && s.ringMode === "hole" && s.combined;
  const inBox = d.fits;
  return {
    hasName,
    hasSymbol,
    realHole,
    inBox,
    all: hasName && hasSymbol && realHole && inBox,
  };
}

export default function KeychainStudio({ onComplete }: ActivityProps) {
  const [studio, setStudio] = useState<Studio>({ ...START });
  const [done, setDone] = useState<boolean>(false);
  const wonRef = useRef<boolean>(false);
  const nudgeReadyRef = useRef<boolean>(false);

  const dims: Dims = useMemo(() => dimsOf(studio), [studio]);
  const checks: Checks = useMemo(() => checksOf(studio, dims), [studio, dims]);

  /* A solid ring that's been "combined" can't really make a hole — show a note. */
  const solidBlobNote = studio.ringPlaced && studio.ringMode === "solid";

  /* WIN: export is only enabled when all four checks pass. Pressing it fires
     onComplete exactly once. */
  const handleExport = useCallback(() => {
    if (wonRef.current) return;
    if (!checks.all) {
      onComplete({
        passed: false,
        detail: "Almost! Tick every checklist item green, then export.",
      });
      return;
    }
    wonRef.current = true;
    setDone(true);
    onComplete({
      passed: true,
      stars: 3,
      detail: "keychain.stl ready to print — name, symbol, real ring hole, fits the box!",
    });
  }, [checks.all, onComplete]);

  /* A kind, debounced nudge once the learner pauses on a not-yet-valid design. */
  useEffect(() => {
    if (done) return;
    if (checks.all) return;
    if (!nudgeReadyRef.current) {
      nudgeReadyRef.current = true; // skip the very first render (load)
      return;
    }
    const t = window.setTimeout(() => {
      if (wonRef.current) return;
      let detail = "Keep building — get all four checks green.";
      if (!checks.hasName) detail = "Place your NAME block on the plate first.";
      else if (!checks.hasSymbol) detail = "Add exactly one symbol — star, heart or shield.";
      else if (!checks.realHole) {
        if (!studio.ringPlaced) detail = "Add a ring near the top of the plate.";
        else if (studio.ringMode === "solid")
          detail = "A solid blob has no hole — switch the ring to HOLE.";
        else detail = "Press COMBINE to punch the ring hole through the plate.";
      } else if (!checks.inBox) detail = "Too big — shrink it until the size box turns green.";
      onComplete({ passed: false, detail });
    }, 800);
    return () => window.clearTimeout(t);
  }, [studio, checks, done, onComplete]);

  /* ---- mutators (all blocked once won) ---- */
  const placeName = useCallback(() => {
    if (wonRef.current) return;
    setStudio((p) => ({ ...p, namePlaced: !p.namePlaced }));
  }, []);

  const placeSymbol = useCallback((id: SymbolId) => {
    if (wonRef.current) return;
    setStudio((p) => ({ ...p, symbol: p.symbol === id ? null : id }));
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
    // Changing the mode un-does a previous combine — you must re-combine.
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

  const reset = useCallback(() => {
    wonRef.current = false;
    nudgeReadyRef.current = false;
    setStudio({ ...START });
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
  /* faux-3D extrusion depth */
  const depth = 14 * studio.scale;
  /* ring sits near the top edge of the plate */
  const ringCx = cx;
  const ringCy = top + 12;
  const ringR = 11 * studio.scale;
  /* a real hole = punched-through (combined while HOLE); else a dark drawn blob */
  const realHole = checks.realHole;

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
          aria-label="3D workplane showing a keychain plate with the name, symbol and ring loop, tilted in orthographic view."
          style={{ maxHeight: 320, touchAction: "none" }}
        >
          <defs>
            <clipPath id="g4kc-ringhole">
              {/* the punched ring loop — used to subtract from the plate */}
              <path
                d={`M 0 0 H ${VIEW_W} V ${VIEW_H} H 0 Z
                    M ${ringCx} ${ringCy} m ${-ringR} 0
                    a ${ringR} ${ringR * 0.62} 0 1 0 ${ringR * 2} 0
                    a ${ringR} ${ringR * 0.62} 0 1 0 ${-ringR * 2} 0 Z`}
                clipRule="evenodd"
              />
            </clipPath>
          </defs>

          {/* faint workplane grid (with a subtle 3D tilt) */}
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

          {/* the printable build-box outline (turns green when the design fits) */}
          <rect
            x={cx - (MAX_W * PX_PER_CM) / 2}
            y={cy - (MAX_H * PX_PER_CM) / 2}
            width={MAX_W * PX_PER_CM}
            height={MAX_H * PX_PER_CM}
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

          {/* THE PLATE — extruded slab. When the ring is a real hole, the whole
             plate is clipped so you can see straight through the loop. */}
          <g clipPath={realHole ? "url(#g4kc-ringhole)" : undefined}>
            {/* extrusion side wall */}
            <path
              d={`M ${left} ${top + plateH}
                  L ${left} ${top + plateH + depth}
                  L ${left + plateW} ${top + plateH + depth}
                  L ${left + plateW} ${top + plateH} Z`}
              fill={done ? "#7a5212" : "#243150"}
              stroke="#0a0e18"
              strokeWidth={1}
            />
            {/* top face */}
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

          {/* SYMBOL (a solid) — sits to the right of the name */}
          {studio.symbol && (
            <text
              x={left + plateW - 18 * studio.scale}
              y={top + 22 * studio.scale}
              fontSize={18 * studio.scale}
              textAnchor="middle"
              style={{ animation: "g4keychain3d-drop .35s ease-out both" }}
            >
              {SYMBOLS.find((sy) => sy.id === studio.symbol)?.glyph}
            </text>
          )}

          {/* THE RING near the top edge */}
          {studio.ringPlaced && !realHole && (
            // a solid ring (or a not-yet-combined hole) drawn as a dark blob ring
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
          {/* the REAL punched loop — rim drawn around the clipped-through hole */}
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

          {/* slicing-style print-layer preview on the plate when valid & ringed */}
          {checks.realHole && checks.inBox && !done &&
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

          {/* dimension callout */}
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

          {/* Ready-to-print stamp on win */}
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
                READY TO PRINT
              </text>
              <text
                x={VIEW_W / 2}
                y={69}
                fontSize={11}
                textAnchor="middle"
                fill={ACCENT}
                opacity={0.9}
              >
                ⬇ keychain.stl ✨
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

        {/* "can't thread a solid blob" warning overlay */}
        {solidBlobNote && !done && (
          <div
            className="absolute inset-x-2 bottom-2 rounded-md px-2 py-1 text-center text-[11px] font-medium"
            style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5" }}
            role="note"
          >
            You can&apos;t thread a keyring through a solid blob! Set the ring to HOLE.
          </div>
        )}
      </div>

      {/* ---------------- MISSION CHECKLIST ---------------- */}
      <div
        className="flex flex-col gap-1.5 rounded-xl border border-line bg-panel/40 p-2"
        role="group"
        aria-label="Mission checklist"
      >
        <p className="px-1 font-mono text-[11px] uppercase tracking-wide text-ink-faint">
          📋 Mission — all four must pass
        </p>
        <CheckRow ok={checks.hasName} label="Name text on the plate" want="placed" />
        <CheckRow ok={checks.hasSymbol} label="Exactly one symbol" want="1 chosen" />
        <CheckRow
          ok={checks.realHole}
          label="Ring set to HOLE + combined"
          want="real cutout"
        />
        <CheckRow
          ok={checks.inBox}
          label={`Fits the ${MAX_W}×${MAX_H}×${MAX_T} cm box`}
          want={dims.fits ? "in range" : "shrink it"}
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
          ? "Exported keychain.stl — name, symbol, real hole, fits the box!"
          : !checks.hasName
            ? "Place your NAME block on the plate."
            : !checks.hasSymbol
              ? "Add one symbol — star, heart or shield."
              : !checks.realHole
                ? !studio.ringPlaced
                  ? "Add a ring near the top."
                  : studio.ringMode === "solid"
                    ? "Switch the ring to HOLE — a solid blob can't thread."
                    : "Press COMBINE to punch the hole through the plate."
                : !checks.inBox
                  ? "Too big — shrink it until the box turns green."
                  : "All set — press EXPORT! ✨"}
      </div>

      {/* ---------------- PALETTE / BUILD TOOLS ---------------- */}
      <div className="panel flex flex-col gap-3 rounded-xl p-3">
        {/* NAME + SYMBOL row */}
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
            Add solid parts
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <PaletteButton
              active={studio.namePlaced}
              disabled={done}
              onClick={placeName}
              ariaLabel={studio.namePlaced ? "Remove the name block" : "Add the name block"}
            >
              🔤 Name
            </PaletteButton>
            {SYMBOLS.map((sy) => (
              <PaletteButton
                key={sy.id}
                active={studio.symbol === sy.id}
                disabled={done}
                onClick={() => placeSymbol(sy.id)}
                ariaLabel={`${studio.symbol === sy.id ? "Remove" : "Add"} the ${sy.word} symbol`}
              >
                {sy.glyph} {sy.word}
              </PaletteButton>
            ))}
          </div>
        </div>

        {/* RING build — place, set SOLID/HOLE, combine */}
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
            Ring loop — solid adds, hole subtracts
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <PaletteButton
              active={studio.ringPlaced}
              disabled={done}
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
                    disabled={done || !studio.ringPlaced}
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
              disabled={done || !studio.ringPlaced || studio.combined}
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
              Scale <span className="text-ink-faint">· shrink to fit the box</span>
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
            disabled={done}
            aria-label={`Scale, ${Math.round(studio.scale * 100)} percent`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-60"
            style={{ accentColor: dims.fits ? GREEN : ACCENT, touchAction: "none" }}
          />
        </label>

        {/* EXPORT + RESET */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={reset}
            className="shrink-0 rounded-lg border border-line bg-panel/60 px-3 py-1.5 text-xs font-medium text-ink-dim"
            aria-label="Reset the keychain studio"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={done}
            aria-label="Export keychain.stl"
            className="rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-60"
            style={{
              background: checks.all ? ACCENT : "rgba(245,158,11,0.25)",
              color: checks.all ? "#05070d" : "#caa86a",
              boxShadow: checks.all ? `0 0 16px -4px ${ACCENT}` : undefined,
              transition: "background .2s ease, box-shadow .2s ease",
            }}
          >
            {done ? "Exported ✓" : "Export STL ⬇"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- small presentational helpers ---------------- */

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
