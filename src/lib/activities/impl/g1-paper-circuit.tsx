"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ACCENT = "#34d399"; // robotics green = lit / success / glow
const COPPER = "#d98a3d"; // shiny copper tape colour for filled tiles
const COPPER_LIGHT = "#f2b066";

/**
 * SVG canvas is 360x260. The copper-tape route runs from the battery (bottom-left)
 * up and across to the LED (top-right). A handful of segments along the route are
 * MISSING (faded tile outlines). Tap each one to lay copper tape. Fill them all and
 * the loop is continuous → the LED lights up.
 */

interface Pt {
  x: number;
  y: number;
}

/** The route is a polyline; the child fills the gap tiles to make it continuous. */
const ROUTE: Pt[] = [
  { x: 70, y: 210 }, // battery + terminal
  { x: 70, y: 120 },
  { x: 150, y: 120 },
  { x: 150, y: 60 },
  { x: 250, y: 60 },
  { x: 290, y: 60 }, // LED terminal
];

/** Which route corners need a copper-tape tile dropped on them (the gaps). */
const GAP_TILES: Pt[] = [
  { x: 70, y: 120 },
  { x: 150, y: 120 },
  { x: 150, y: 60 },
  { x: 250, y: 60 },
];

const TILE = 30; // tile side length (≥44px on screen once scaled up)

/** Full route as an SVG path string, used for the travelling current dots. */
const ROUTE_PATH = ROUTE.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");

export default function PaperCircuitCard({ onComplete }: ActivityProps) {
  // One boolean per gap tile: true = copper tape laid.
  const [filled, setFilled] = useState<boolean[]>(() => GAP_TILES.map(() => false));
  const [wobble, setWobble] = useState<boolean>(false);

  const reportedRef = useRef<boolean>(false);
  const wobbleTimer = useRef<number | null>(null);

  const allFilled = useMemo<boolean>(() => filled.every((f) => f), [filled]);
  const lit = allFilled; // continuous loop → glowing LED

  const filledCount = useMemo<number>(
    () => filled.reduce((n, f) => n + (f ? 1 : 0), 0),
    [filled],
  );

  const fillTile = useCallback(
    (i: number): void => {
      if (lit) return;
      setFilled((prev) => {
        if (prev[i]) return prev;
        const next = prev.slice();
        next[i] = true;
        return next;
      });
    },
    [lit],
  );

  const nudge = useCallback((): void => {
    setWobble(true);
    if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
    wobbleTimer.current = window.setTimeout(() => setWobble(false), 520);
  }, []);

  const lightIt = useCallback((): void => {
    if (lit) return;
    // Gaps remain → LED stays dark, friendly wobble (no scolding).
    nudge();
  }, [lit, nudge]);

  const reset = useCallback((): void => {
    if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
    reportedRef.current = false;
    setFilled(GAP_TILES.map(() => false));
    setWobble(false);
  }, []);

  // Celebrate exactly once, when the loop becomes continuous.
  useEffect(() => {
    if (lit && !reportedRef.current) {
      reportedRef.current = true;
      onComplete({ passed: true, stars: 3 });
    }
  }, [lit, onComplete]);

  useEffect(() => {
    return () => {
      if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
    };
  }, []);

  // Status emoji only — no reading required.
  const statusEmoji = lit ? "🎉" : filledCount === 0 ? "👆" : "🛠️";

  return (
    <div className="flex w-full flex-col gap-3">
      {/* The greeting card */}
      <div
        className="panel relative overflow-hidden rounded-2xl border border-line p-2"
        style={{
          background: lit
            ? "radial-gradient(circle at 80% 24%, rgba(52,211,153,0.18), transparent 60%)"
            : undefined,
          transition: "background 400ms ease",
        }}
      >
        <svg
          viewBox="0 0 360 260"
          className="block w-full select-none"
          style={{ touchAction: "manipulation" }}
          role="img"
          aria-label="A folded greeting card with a battery and a light bulb joined by a copper tape path. Some path tiles are missing. Tap each empty tile to lay copper tape and complete the loop to light the bulb."
        >
          <defs>
            <filter id="pcGlow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="pcBulbGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff6c4" />
              <stop offset="45%" stopColor={ACCENT} />
              <stop offset="100%" stopColor="rgba(52,211,153,0)" />
            </radialGradient>
            <linearGradient id="pcCopper" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COPPER_LIGHT} />
              <stop offset="100%" stopColor={COPPER} />
            </linearGradient>
          </defs>

          {/* ---- Card front (folded greeting card) ---- */}
          <rect
            x="16"
            y="16"
            width="328"
            height="228"
            rx="16"
            fill="#0b1020"
            stroke="#27314f"
            strokeWidth="3"
          />
          {/* fold line down the middle */}
          <line
            x1="180"
            y1="20"
            x2="180"
            y2="240"
            stroke="#1e2a44"
            strokeWidth="2"
            strokeDasharray="5 6"
          />
          {/* a little charm drawing on the card front */}
          <text x="300" y="216" textAnchor="middle" fontSize="26" style={{ pointerEvents: "none" }}>
            🌟
          </text>
          <text x="40" y="52" textAnchor="middle" fontSize="22" style={{ pointerEvents: "none" }}>
            💌
          </text>

          {/* Big halo behind the LED when lit */}
          {lit && (
            <circle cx="310" cy="60" r="56" fill="url(#pcBulbGlow)" opacity="0.9">
              <animate attributeName="r" values="46;60;46" dur="1.6s" repeatCount="indefinite" />
            </circle>
          )}

          {/* ---- The copper-tape route ---- */}
          {/* Faint guide line so kids see where the tape should go */}
          <path
            d={ROUTE_PATH}
            fill="none"
            stroke="#1e2a44"
            strokeWidth="12"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* The lit copper line — only fully drawn once every gap is filled */}
          <path
            d={ROUTE_PATH}
            fill="none"
            stroke={lit ? ACCENT : "url(#pcCopper)"}
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={lit ? 1 : 0.9}
            style={{
              filter: lit ? `drop-shadow(0 0 6px ${ACCENT})` : "none",
              transition: "stroke 300ms ease",
            }}
          />

          {/* Gap tiles: empty outline → tap → copper fill (drawn over the route) */}
          {GAP_TILES.map((g, i) => {
            const isFilled = filled[i];
            return (
              <g
                key={i}
                onClick={() => fillTile(i)}
                onPointerDown={() => fillTile(i)}
                role="button"
                aria-label={isFilled ? "Copper tape laid" : "Tap to lay copper tape"}
                tabIndex={isFilled ? -1 : 0}
                style={{ cursor: isFilled || lit ? "default" : "pointer" }}
              >
                {/* big invisible hit area for little fingers */}
                <rect
                  x={g.x - 24}
                  y={g.y - 24}
                  width="48"
                  height="48"
                  fill="transparent"
                />
                <rect
                  x={g.x - TILE / 2}
                  y={g.y - TILE / 2}
                  width={TILE}
                  height={TILE}
                  rx="6"
                  fill={isFilled ? "url(#pcCopper)" : "#0b1020"}
                  stroke={isFilled ? COPPER_LIGHT : "#4a567e"}
                  strokeWidth="3"
                  strokeDasharray={isFilled ? "0" : "5 5"}
                  style={{ transition: "fill 200ms ease, stroke 200ms ease" }}
                />
                {/* shiny tape highlight when filled */}
                {isFilled && (
                  <rect
                    x={g.x - TILE / 2 + 4}
                    y={g.y - TILE / 2 + 4}
                    width={TILE - 8}
                    height="5"
                    rx="2"
                    fill="rgba(255,255,255,0.55)"
                  />
                )}
                {/* nudge marker on empty tiles */}
                {!isFilled && (
                  <circle cx={g.x} cy={g.y} r="4" fill="#6b779e">
                    <animate
                      attributeName="r"
                      values="3;5;3"
                      dur="1.2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
              </g>
            );
          })}

          {/* ---- Battery (bottom-left) ---- */}
          <g transform="translate(70 210)">
            <circle
              cx="0"
              cy="0"
              r="26"
              fill="#11182f"
              stroke={ACCENT}
              strokeWidth="3"
            />
            <text x="0" y="9" textAnchor="middle" fontSize="26" style={{ pointerEvents: "none" }}>
              🔋
            </text>
          </g>

          {/* ---- LED (top-right) ---- */}
          <g transform="translate(310 60)">
            <circle
              cx="0"
              cy="0"
              r="30"
              fill={lit ? "rgba(255,246,196,0.22)" : "#11182f"}
              stroke={lit ? ACCENT : "#3a4566"}
              strokeWidth="3"
              style={{ transition: "fill 300ms ease, stroke 300ms ease" }}
            />
            <g
              filter={lit ? "url(#pcGlow)" : undefined}
              style={{
                transition: "transform 300ms cubic-bezier(.34,1.6,.64,1)",
                transform: lit ? "scale(1.18)" : "scale(1)",
                transformBox: "fill-box",
                transformOrigin: "center",
              }}
            >
              <text
                x="0"
                y="11"
                textAnchor="middle"
                fontSize="30"
                opacity={lit ? 1 : 0.5}
                style={{ pointerEvents: "none" }}
              >
                💡
              </text>
            </g>
          </g>

          {/* Travelling current dots once the loop is complete */}
          {lit && (
            <g>
              {[0, 1, 2].map((i) => (
                <circle key={i} r="5" fill="#fff6c4">
                  <animateMotion
                    dur="1.8s"
                    begin={`${i * 0.6}s`}
                    repeatCount="indefinite"
                    path={ROUTE_PATH}
                  />
                </circle>
              ))}
            </g>
          )}
        </svg>

        {/* tiny emoji-only status */}
        <div
          className="mt-1 flex items-center justify-center gap-2 text-2xl"
          aria-live="polite"
          style={{ animation: wobble ? "pc-wobble 0.5s ease" : undefined }}
        >
          <span aria-hidden="true">{statusEmoji}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={lightIt}
          aria-label={lit ? "The light is on" : "Light it up"}
          className="font-display flex min-h-[56px] items-center gap-2 rounded-2xl px-6 py-3 text-lg font-bold transition active:scale-95"
          style={
            lit
              ? { background: ACCENT, color: "#060810", boxShadow: `0 0 18px ${ACCENT}` }
              : {
                  background: "rgba(11,16,32,0.6)",
                  color: "#9aa6cf",
                  borderWidth: 2,
                  borderStyle: "solid",
                  borderColor: "var(--color-line, #27314f)",
                }
          }
        >
          <span aria-hidden="true" className="text-2xl">
            {lit ? "💡" : "✨"}
          </span>
          {lit ? "ON" : "LIGHT IT"}
        </button>

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

      {/* celebratory confetti when solved */}
      {lit && (
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

      <style>{`
        @keyframes pc-wobble {
          0%, 100% { transform: translateX(0) rotate(0); }
          25% { transform: translateX(-5px) rotate(-4deg); }
          75% { transform: translateX(5px) rotate(4deg); }
        }
      `}</style>
    </div>
  );
}
