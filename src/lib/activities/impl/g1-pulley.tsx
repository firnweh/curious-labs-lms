"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useRef, useState } from "react";

const ACCENT = "#34d399";

/** SVG canvas is 360x300. The pulley wheel sits at the top of the A-frame. */
const WHEEL = { x: 180, y: 56, r: 24 };

/** The two rope columns drop straight down from the rim of the wheel. */
const LEFT_X = WHEEL.x - WHEEL.r; // basket side
const RIGHT_X = WHEEL.x + WHEEL.r; // handle side

/** Vertical travel range (in SVG units) for each side. */
const TOP_Y = WHEEL.y + 20; // highest the basket / handle can reach
const BOTTOM_Y = 250; // lowest (start) position

/** The handle starts high and is pulled DOWN; the basket starts low and rises. */
const HANDLE_START_Y = TOP_Y; // handle begins near the wheel
const HANDLE_END_Y = BOTTOM_Y; // fully pulled down
/** Travel distance shared by both sides (rope is conserved). */
const TRAVEL = HANDLE_END_Y - HANDLE_START_Y;

/** Win when the basket is within this many units of the top. */
const WIN_SLOP = 6;

interface Pt {
  x: number;
  y: number;
}

export default function PulleyLifter({ onComplete }: ActivityProps) {
  // How far the handle has been pulled down from its start, 0..TRAVEL.
  const [pull, setPull] = useState<number>(0);
  const [dragging, setDragging] = useState<boolean>(false);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const reportedRef = useRef<boolean>(false);
  // Where on the handle the finger grabbed (so it doesn't jump).
  const grabOffsetRef = useRef<number>(0);

  // Handle goes DOWN as you pull; basket goes UP by the same amount.
  const handleY = HANDLE_START_Y + pull;
  const basketY = BOTTOM_Y - pull;
  const lifted = basketY <= TOP_Y + WIN_SLOP;
  const progress = TRAVEL === 0 ? 0 : pull / TRAVEL; // 0..1
  // Spin the wheel proportionally to how much rope has moved over it.
  const wheelAngle = (pull / WHEEL.r) * (180 / Math.PI);

  // Convert a pointer event to SVG coordinates (viewBox 0 0 360 300).
  const toSvg = useCallback((clientX: number, clientY: number): Pt => {
    const svg = svgRef.current;
    if (!svg) return { x: RIGHT_X, y: HANDLE_START_Y };
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 360;
    const y = ((clientY - rect.top) / rect.height) * 300;
    return { x, y };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGGElement>): void => {
      if (lifted) return; // once lifted, it stays put
      e.currentTarget.setPointerCapture(e.pointerId);
      const p = toSvg(e.clientX, e.clientY);
      grabOffsetRef.current = p.y - handleY;
      setDragging(true);
    },
    [lifted, toSvg, handleY],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGGElement>): void => {
      if (!dragging || lifted) return;
      const p = toSvg(e.clientX, e.clientY);
      const wantHandleY = p.y - grabOffsetRef.current;
      // Constrain the handle to its vertical track, then derive the pull.
      const clampedY = Math.max(HANDLE_START_Y, Math.min(HANDLE_END_Y, wantHandleY));
      setPull(clampedY - HANDLE_START_Y);
    },
    [dragging, lifted, toSvg],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<SVGGElement>): void => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* capture may already be gone */
      }
      setDragging(false);
    },
    [],
  );

  const reset = useCallback((): void => {
    reportedRef.current = false;
    setPull(0);
    setDragging(false);
  }, []);

  // Celebrate exactly once, when the basket reaches the top.
  useEffect(() => {
    if (lifted && !reportedRef.current) {
      reportedRef.current = true;
      onComplete({ passed: true, stars: 3 });
    }
  }, [lifted, onComplete]);

  // Status emoji (no reading required): pull down → lift → party.
  const statusEmoji = lifted ? "🎉" : dragging ? "💪" : "👇";

  // Rope path: basket top → up left column → over the wheel → down right column → handle.
  const ropePath =
    `M ${LEFT_X} ${basketY}` +
    ` L ${LEFT_X} ${WHEEL.y}` +
    ` A ${WHEEL.r} ${WHEEL.r} 0 0 1 ${RIGHT_X} ${WHEEL.y}` +
    ` L ${RIGHT_X} ${handleY}`;

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Scene */}
      <div
        className="panel relative overflow-hidden rounded-2xl border border-line p-2"
        style={{
          background: lifted
            ? "radial-gradient(circle at 50% 22%, rgba(52,211,153,0.18), transparent 62%)"
            : undefined,
          transition: "background 400ms ease",
        }}
      >
        <svg
          ref={svgRef}
          viewBox="0 0 360 300"
          className="block w-full select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="A pulley on a tall stand. A basket hangs low on the left. Drag the big rope handle on the right downward to lift the basket up to the top."
        >
          <defs>
            <radialGradient id="g1p-halo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff6c4" />
              <stop offset="45%" stopColor={ACCENT} />
              <stop offset="100%" stopColor="rgba(52,211,153,0)" />
            </radialGradient>
          </defs>

          {/* Ground line */}
          <line
            x1="20"
            y1="278"
            x2="340"
            y2="278"
            stroke="#2a3450"
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* ---- A-frame stand ---- */}
          <line x1="70" y1="276" x2={WHEEL.x - 4} y2={WHEEL.y + 6} stroke="#3a4566" strokeWidth="8" strokeLinecap="round" />
          <line x1="290" y1="276" x2={WHEEL.x + 4} y2={WHEEL.y + 6} stroke="#3a4566" strokeWidth="8" strokeLinecap="round" />
          {/* cross brace */}
          <line x1="108" y1="186" x2="252" y2="186" stroke="#2a3450" strokeWidth="6" strokeLinecap="round" />

          {/* ---- Halo behind wheel when lifted ---- */}
          {lifted && (
            <circle cx={WHEEL.x} cy={WHEEL.y} r="60" fill="url(#g1p-halo)" opacity="0.9">
              <animate attributeName="r" values="50;66;50" dur="1.6s" repeatCount="indefinite" />
            </circle>
          )}

          {/* ---- The rope running over the wheel ---- */}
          <path
            d={ropePath}
            fill="none"
            stroke={lifted ? ACCENT : "#caa46a"}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transition: dragging ? "none" : "stroke 300ms ease" }}
          />

          {/* ---- Pulley wheel (rotates as you pull) ---- */}
          <g
            style={{
              transform: `rotate(${wheelAngle}deg)`,
              transformOrigin: `${WHEEL.x}px ${WHEEL.y}px`,
              transformBox: "view-box",
            }}
          >
            <circle cx={WHEEL.x} cy={WHEEL.y} r={WHEEL.r} fill="#0b1020" stroke={ACCENT} strokeWidth="4" />
            <circle cx={WHEEL.x} cy={WHEEL.y} r="5" fill={ACCENT} />
            {/* spokes for visible spin */}
            {[0, 60, 120].map((a) => {
              const rad = (a * Math.PI) / 180;
              return (
                <line
                  key={a}
                  x1={WHEEL.x - Math.cos(rad) * (WHEEL.r - 3)}
                  y1={WHEEL.y - Math.sin(rad) * (WHEEL.r - 3)}
                  x2={WHEEL.x + Math.cos(rad) * (WHEEL.r - 3)}
                  y2={WHEEL.y + Math.sin(rad) * (WHEEL.r - 3)}
                  stroke="#3a4566"
                  strokeWidth="3"
                />
              );
            })}
          </g>

          {/* ---- Target ring at the top (where the basket should land) ---- */}
          {!lifted && (
            <circle
              cx={LEFT_X}
              cy={TOP_Y + 16}
              r="22"
              fill="none"
              stroke={ACCENT}
              strokeWidth="3"
              strokeDasharray="6 6"
              opacity="0.8"
            >
              <animate attributeName="r" values="20;26;20" dur="1.4s" repeatCount="indefinite" />
            </circle>
          )}

          {/* ---- Basket / load (rises as you pull) ---- */}
          <g>
            {/* short hanger from the rope to the basket */}
            <line x1={LEFT_X} y1={basketY} x2={LEFT_X} y2={basketY + 8} stroke="#caa46a" strokeWidth="4" />
            <rect
              x={LEFT_X - 24}
              y={basketY + 8}
              width="48"
              height="40"
              rx="10"
              fill="#0b1020"
              stroke={lifted ? ACCENT : "#3a4566"}
              strokeWidth="3"
              style={{ transition: dragging ? "none" : "stroke 300ms ease" }}
            />
            <text x={LEFT_X} y={basketY + 38} textAnchor="middle" fontSize="30" style={{ pointerEvents: "none" }}>
              📦
            </text>
          </g>

          {/* ---- The DRAGGABLE rope handle (big tap target) — rendered last, on top ---- */}
          <g
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{ cursor: lifted ? "default" : dragging ? "grabbing" : "grab", touchAction: "none" }}
            role="button"
            aria-label="Drag the rope handle downward to lift the basket"
            tabIndex={0}
          >
            {/* invisible large hit area for little fingers */}
            <rect x={RIGHT_X - 36} y={handleY - 8} width="72" height="72" fill="transparent" />
            {/* chunky grip bar (>=44px) */}
            <rect
              x={RIGHT_X - 30}
              y={handleY}
              width="60"
              height="46"
              rx="14"
              fill="#7c5cff"
              stroke="#fff"
              strokeWidth="3"
              style={{
                transition: dragging ? "none" : "transform 120ms ease",
                transformBox: "fill-box",
                transformOrigin: "center",
                transform: dragging ? "scale(1.06)" : "scale(1)",
                filter: lifted ? `drop-shadow(0 0 6px ${ACCENT})` : "none",
              }}
            >
              {!dragging && !lifted && (
                <animate attributeName="y" values={`${handleY};${handleY + 4};${handleY}`} dur="1.2s" repeatCount="indefinite" />
              )}
            </rect>
            <text x={RIGHT_X} y={handleY + 31} textAnchor="middle" fontSize="24" style={{ pointerEvents: "none" }}>
              {lifted ? "✊" : "🪢"}
            </text>
            {/* down-arrow hint, only before the first pull */}
            {pull < 6 && !lifted && (
              <text x={RIGHT_X} y={handleY + 70} textAnchor="middle" fontSize="22" style={{ pointerEvents: "none" }}>
                <tspan>👇</tspan>
                <animate attributeName="opacity" values="0.4;1;0.4" dur="1.1s" repeatCount="indefinite" />
              </text>
            )}
          </g>

          {/* ---- Progress sparkles climbing the basket rope when nearly there ---- */}
          {progress > 0.6 && !lifted && (
            <text x={LEFT_X} y={basketY - 12} textAnchor="middle" fontSize="18" style={{ pointerEvents: "none" }}>
              ✨
            </text>
          )}
        </svg>

        {/* tiny visual status — emoji only, no paragraph */}
        <div className="mt-1 flex items-center justify-center gap-2 text-2xl" aria-live="polite">
          <span aria-hidden="true">{statusEmoji}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {/* Start over */}
        <button
          type="button"
          onClick={reset}
          aria-label="Start over"
          className="flex min-h-[56px] items-center gap-2 rounded-2xl border-2 border-line bg-panel/60 px-5 py-3 text-lg font-bold text-ink-dim transition active:scale-95"
        >
          <span aria-hidden="true" className="text-2xl">
            🔄
          </span>
        </button>
      </div>

      {/* celebratory confetti dots when solved */}
      {lifted && (
        <div className="pointer-events-none flex justify-center gap-2 text-2xl">
          <span className="animate-float" aria-hidden="true">
            ✨
          </span>
          <span className="animate-float" style={{ animationDelay: "0.2s" }} aria-hidden="true">
            🎉
          </span>
          <span className="animate-float" style={{ animationDelay: "0.4s" }} aria-hidden="true">
            ✨
          </span>
        </div>
      )}
    </div>
  );
}
