"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useRef, useState } from "react";

const ACCENT = "#34d399";

/** SVG canvas is 360x240. The wire bridges the gap between these two posts. */
const POST_LEFT = { x: 132, y: 150 }; // wire's left end stays here (battery terminal)
const POST_RIGHT = { x: 228, y: 150 }; // battery → bulb gap closes when the wire reaches here
/** How close (in SVG units) the dragged end must get to snap the gap shut. */
const SNAP_RADIUS = 46;

/** Where the draggable wire-end starts: parked below the gap, easy to grab. */
const PARK = { x: 180, y: 210 };

type Phase = "open" | "wired" | "glow";

interface Pt {
  x: number;
  y: number;
}

export default function MakeitGlow({ onComplete }: ActivityProps) {
  // Position of the draggable wire end, in SVG coordinates.
  const [tip, setTip] = useState<Pt>(PARK);
  const [phase, setPhase] = useState<Phase>("open");
  const [dragging, setDragging] = useState<boolean>(false);
  const [wobble, setWobble] = useState<boolean>(false);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const reportedRef = useRef<boolean>(false);
  const wobbleTimer = useRef<number | null>(null);

  const connected = phase === "wired" || phase === "glow";
  const lit = phase === "glow";

  // Convert a pointer event to SVG coordinates (viewBox 0 0 360 240).
  const toSvg = useCallback((clientX: number, clientY: number): Pt => {
    const svg = svgRef.current;
    if (!svg) return PARK;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 360;
    const y = ((clientY - rect.top) / rect.height) * 240;
    return { x, y };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGGElement>): void => {
      if (connected) return; // once snapped, it stays put
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
    },
    [connected],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGGElement>): void => {
      if (!dragging || connected) return;
      const p = toSvg(e.clientX, e.clientY);
      // Keep the tip inside the canvas so it can never be lost.
      const x = Math.max(16, Math.min(344, p.x));
      const y = Math.max(120, Math.min(224, p.y));
      setTip({ x, y });
    },
    [dragging, connected, toSvg],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<SVGGElement>): void => {
      if (connected) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* capture may already be gone */
      }
      setDragging(false);
      const dx = tip.x - POST_RIGHT.x;
      const dy = tip.y - POST_RIGHT.y;
      const near = Math.hypot(dx, dy) <= SNAP_RADIUS;
      if (near) {
        // Snap the wire home — gap closed.
        setTip(POST_RIGHT);
        setPhase("wired");
      } else {
        // Too far: bounce gently back to the parking spot, no scolding.
        setTip(PARK);
        setWobble(true);
        if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
        wobbleTimer.current = window.setTimeout(() => setWobble(false), 520);
      }
    },
    [connected, tip],
  );

  const flipSwitch = useCallback((): void => {
    if (lit) return;
    if (!connected) {
      // No circuit yet — bulb just stays dark, give a friendly wobble.
      setWobble(true);
      if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
      wobbleTimer.current = window.setTimeout(() => setWobble(false), 520);
      return;
    }
    setPhase("glow");
  }, [lit, connected]);

  const reset = useCallback((): void => {
    if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
    reportedRef.current = false;
    setTip(PARK);
    setPhase("open");
    setDragging(false);
    setWobble(false);
  }, []);

  // Celebrate exactly once, in response to the bulb lighting up.
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

  // Status emoji (no reading required): drag → switch → party.
  const statusEmoji = lit ? "🎉" : connected ? "👉" : "🔌";

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Scene */}
      <div
        className="panel relative overflow-hidden rounded-2xl border border-line p-2"
        style={{
          background: lit
            ? "radial-gradient(circle at 72% 55%, rgba(52,211,153,0.18), transparent 60%)"
            : undefined,
          transition: "background 400ms ease",
        }}
      >
        <svg
          ref={svgRef}
          viewBox="0 0 360 240"
          className="block w-full select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="A battery on the left and a light bulb on the right with a gap between them. Drag the wire to close the gap, then tap the big switch to light the bulb."
        >
          <defs>
            <filter id="glowFx" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="7" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="bulbGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff6c4" />
              <stop offset="45%" stopColor={ACCENT} />
              <stop offset="100%" stopColor="rgba(52,211,153,0)" />
            </radialGradient>
          </defs>

          {/* Big halo behind the bulb when lit */}
          {lit && (
            <circle cx="280" cy="120" r="70" fill="url(#bulbGlow)" opacity="0.9">
              <animate
                attributeName="r"
                values="58;74;58"
                dur="1.6s"
                repeatCount="indefinite"
              />
            </circle>
          )}

          {/* ---- Battery (left) ---- */}
          <g transform="translate(58 120)">
            <rect
              x="-40"
              y="-34"
              width="80"
              height="68"
              rx="14"
              fill="#0b1020"
              stroke={ACCENT}
              strokeWidth="3"
            />
            <text
              x="0"
              y="14"
              textAnchor="middle"
              fontSize="44"
              style={{ pointerEvents: "none" }}
            >
              🔋
            </text>
            {/* terminal nub heading toward the gap */}
            <rect x="40" y="-6" width="34" height="12" rx="6" fill={ACCENT} />
          </g>

          {/* ---- Bulb (right) ---- */}
          <g transform="translate(280 120)">
            <rect x="-74" y="-6" width="34" height="12" rx="6" fill={ACCENT} />
            <circle
              cx="0"
              cy="0"
              r="40"
              fill={lit ? "rgba(255,246,196,0.22)" : "#0b1020"}
              stroke={lit ? ACCENT : "#3a4566"}
              strokeWidth="3"
              style={{ transition: "fill 300ms ease, stroke 300ms ease" }}
            />
            <g
              filter={lit ? "url(#glowFx)" : undefined}
              style={{
                transition: "transform 300ms cubic-bezier(.34,1.6,.64,1)",
                transform: lit ? "scale(1.18)" : "scale(1)",
                transformOrigin: "0px 0px",
                transformBox: "fill-box",
              }}
            >
              <text
                x="0"
                y="16"
                textAnchor="middle"
                fontSize="46"
                opacity={lit ? 1 : 0.55}
                style={{ pointerEvents: "none" }}
              >
                💡
              </text>
            </g>
          </g>

          {/* ---- The gap wire ---- */}
          {/* Fixed segment from battery terminal to the left post */}
          <line
            x1="98"
            y1="120"
            x2={POST_LEFT.x}
            y2={POST_LEFT.y}
            stroke={ACCENT}
            strokeWidth="7"
            strokeLinecap="round"
          />
          {/* Fixed segment from the right post into the bulb terminal */}
          <line
            x1={POST_RIGHT.x}
            y1={POST_RIGHT.y}
            x2="244"
            y2="120"
            stroke={connected ? ACCENT : "#2a3450"}
            strokeWidth="7"
            strokeLinecap="round"
            style={{ transition: "stroke 300ms ease" }}
          />

          {/* The draggable wire: left post → tip */}
          <line
            x1={POST_LEFT.x}
            y1={POST_LEFT.y}
            x2={connected ? POST_RIGHT.x : tip.x}
            y2={connected ? POST_RIGHT.y : tip.y}
            stroke={connected ? ACCENT : "#7c5cff"}
            strokeWidth="8"
            strokeLinecap="round"
            style={{
              filter: lit ? `drop-shadow(0 0 6px ${ACCENT})` : "none",
              transition: connected ? "all 220ms cubic-bezier(.34,1.6,.64,1)" : "none",
            }}
          />

          {/* Left anchor dot */}
          <circle cx={POST_LEFT.x} cy={POST_LEFT.y} r="7" fill={ACCENT} />

          {/* Target ring on the right post (shows where to drop) */}
          {!connected && (
            <circle
              cx={POST_RIGHT.x}
              cy={POST_RIGHT.y}
              r="22"
              fill="none"
              stroke={ACCENT}
              strokeWidth="3"
              strokeDasharray="6 6"
              opacity="0.85"
            >
              <animate
                attributeName="r"
                values="20;26;20"
                dur="1.4s"
                repeatCount="indefinite"
              />
            </circle>
          )}

          {/* Flowing current dots once lit */}
          {lit && (
            <g>
              {[0, 1, 2].map((i) => (
                <circle key={i} r="5" fill="#fff6c4">
                  <animateMotion
                    dur="1.4s"
                    begin={`${i * 0.46}s`}
                    repeatCount="indefinite"
                    path={`M98 120 L${POST_LEFT.x} ${POST_LEFT.y} L${POST_RIGHT.x} ${POST_RIGHT.y} L244 120`}
                  />
                </circle>
              ))}
            </g>
          )}

          {/* The DRAGGABLE handle (big tap target) — rendered last so it's on top */}
          {!connected && (
            <g
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
              role="button"
              aria-label="Drag the wire across to the bulb"
              tabIndex={0}
            >
              {/* invisible large hit area for little fingers */}
              <circle cx={tip.x} cy={tip.y} r="34" fill="transparent" />
              <circle
                cx={tip.x}
                cy={tip.y}
                r="18"
                fill="#7c5cff"
                stroke="#fff"
                strokeWidth="3"
                style={{
                  transition: "transform 120ms ease",
                  transformBox: "fill-box",
                  transformOrigin: "center",
                  transform: dragging ? "scale(1.12)" : "scale(1)",
                }}
              >
                {!dragging && (
                  <animate
                    attributeName="r"
                    values="18;20;18"
                    dur="1.2s"
                    repeatCount="indefinite"
                  />
                )}
              </circle>
              {/* little plug emoji on the handle */}
              <text
                x={tip.x}
                y={tip.y + 6}
                textAnchor="middle"
                fontSize="18"
                style={{ pointerEvents: "none" }}
              >
                🔌
              </text>
            </g>
          )}
        </svg>

        {/* tiny visual status — emoji only, no paragraph */}
        <div
          className="mt-1 flex items-center justify-center gap-2 text-2xl"
          aria-live="polite"
          style={{
            animation: wobble ? "jrl-wobble 0.5s ease" : undefined,
          }}
        >
          <span aria-hidden="true">{statusEmoji}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {/* BIG ON/OFF switch — only meaningful once connected, but always tappable */}
        <button
          type="button"
          onClick={flipSwitch}
          aria-label={
            lit
              ? "The light is on"
              : connected
                ? "Tap to turn the light on"
                : "Switch (connect the wire first)"
          }
          className="font-display flex min-h-[56px] items-center gap-2 rounded-2xl px-6 py-3 text-lg font-bold transition active:scale-95"
          style={
            connected
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
            {lit ? "💡" : "⚡"}
          </span>
          {lit ? "ON" : "PUSH"}
        </button>

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
        @keyframes jrl-wobble {
          0%, 100% { transform: translateX(0) rotate(0); }
          25% { transform: translateX(-5px) rotate(-4deg); }
          75% { transform: translateX(5px) rotate(4deg); }
        }
      `}</style>
    </div>
  );
}
