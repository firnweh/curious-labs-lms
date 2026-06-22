"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * "Light It Up" 💡 — a JUNIOR (Class 1-3, age ~6-8) ROBOTICS lab.
 * Single learning goal: a circuit must be a COMPLETE LOOP for power to flow.
 *
 * A battery 🔋 and a bulb 💡 are joined by a wire loop with ONE open GAP.
 * The child taps the glowing gap to snap the missing wire in — the loop
 * closes, a spark zips around the wire, and the bulb bursts to life with a
 * warm pulsing glow and little rays. Deterministic + always winnable.
 * Near-zero reading: emoji, colour, one big word (TAP / ON).
 */

const ACCENT = "#34d399"; // robotics green = success / glow
const WIRE_OFF = "#3a4566";
const WIRE_ON = "#34d399";
const SPARK = "#fff6c4";

/**
 * Rounded-rectangle loop in a 320x240 SVG. The wire runs all the way around;
 * the TOP-MIDDLE segment is the missing gap the child closes. The full loop
 * path is used both to draw the lit wire and to send the spark zipping round.
 */
const LOOP_PATH =
  "M 110 56 L 70 56 Q 48 56 48 80 L 48 168 Q 48 192 72 192 L 248 192 Q 272 192 272 168 L 272 80 Q 272 56 250 56 L 210 56";
// The gap sits across the top between x=110 and x=210 at y=56.
const GAP = { x1: 110, y: 56, x2: 210 } as const;

export default function LightItUp({ onComplete }: ActivityProps) {
  const [closed, setClosed] = useState<boolean>(false);
  const [wobble, setWobble] = useState<boolean>(false);

  const reportedRef = useRef<boolean>(false);
  const wobbleTimer = useRef<number | null>(null);

  const lit = closed; // complete loop → power flows → bulb glows

  const closeGap = useCallback((): void => {
    if (closed) return;
    setClosed(true);
  }, [closed]);

  const nudge = useCallback((): void => {
    setWobble(true);
    if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
    wobbleTimer.current = window.setTimeout(() => setWobble(false), 520);
  }, []);

  // Tapping the bulb itself before the loop is closed: gentle wobble, no scold.
  const pokeBulb = useCallback((): void => {
    if (lit) return;
    nudge();
    onComplete({ passed: false, detail: "The loop has a gap — close it first! 🔌" });
  }, [lit, nudge, onComplete]);

  const reset = useCallback((): void => {
    if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
    reportedRef.current = false;
    setClosed(false);
    setWobble(false);
  }, []);

  // Celebrate exactly once when the loop is complete.
  useEffect(() => {
    if (lit && !reportedRef.current) {
      reportedRef.current = true;
      onComplete({ passed: true, stars: 3, detail: "Complete loop — the bulb lit up! 💡" });
    }
  }, [lit, onComplete]);

  useEffect(
    () => () => {
      if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
    },
    [],
  );

  const statusEmoji = lit ? "🎉" : "👆";

  return (
    <div className="flex w-full flex-col items-center gap-3" style={{ maxWidth: 430 }}>
      <style>{`
        @keyframes jrlight-breathe {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-4px) scale(1.03); }
        }
        @keyframes jrlight-glow {
          0%, 100% { opacity: .55; transform: scale(.92); }
          50% { opacity: 1; transform: scale(1.12); }
        }
        @keyframes jrlight-rays {
          0%, 100% { opacity: .35; transform: scale(.9) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.06) rotate(8deg); }
        }
        @keyframes jrlight-pop {
          0% { transform: scale(.4); opacity: 0; }
          60% { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes jrlight-jump {
          0% { transform: translateY(0) scale(1); }
          30% { transform: translateY(-14px) scale(1.12, .9); }
          55% { transform: translateY(0) scale(.94, 1.1); }
          75% { transform: translateY(-6px) scale(1.04, .98); }
          100% { transform: translateY(0) scale(1); }
        }
        @keyframes jrlight-wobble {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-5deg); }
          75% { transform: rotate(5deg); }
        }
        @keyframes jrlight-confetti {
          0% { transform: translate(0,0) scale(.4) rotate(0deg); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(1) rotate(var(--rot)); opacity: 0; }
        }
        @keyframes jrlight-hint {
          0%, 100% { transform: scale(1); opacity: .8; }
          50% { transform: scale(1.4); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .jrlight-anim { animation: none !important; }
        }
      `}</style>

      {/* Emoji-only status */}
      <div
        className="flex items-center gap-2 rounded-full px-5 py-1.5 text-3xl"
        role="status"
        aria-live="polite"
        aria-label={lit ? "The bulb is on!" : "Tap the gap to close the loop"}
        style={{
          background: lit ? "rgba(52,211,153,0.16)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${lit ? ACCENT : "var(--color-line, #27314f)"}`,
          boxShadow: lit ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true">{statusEmoji}</span>
        {lit && (
          <span
            className="jrlight-anim text-2xl"
            aria-hidden="true"
            style={{ animation: "jrlight-pop .5s ease-out" }}
          >
            ⭐⭐⭐
          </span>
        )}
      </div>

      {/* The circuit board */}
      <div
        className="panel relative w-full overflow-hidden rounded-2xl border border-line p-2"
        style={{
          background: lit
            ? "radial-gradient(circle at 50% 38%, rgba(52,211,153,0.16), transparent 62%)"
            : undefined,
          transition: "background 420ms ease",
        }}
      >
        <svg
          viewBox="0 0 320 240"
          className="block w-full select-none"
          style={{ touchAction: "manipulation" }}
          role="img"
          aria-label="A battery and a light bulb joined by a wire loop with one open gap at the top. Tap the gap to close the loop and light the bulb."
        >
          <defs>
            <radialGradient id="jrl-bulb" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fffbe0" />
              <stop offset="42%" stopColor="#ffe27a" />
              <stop offset="100%" stopColor="rgba(255,226,122,0)" />
            </radialGradient>
            <linearGradient id="jrl-wireOn" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#9af5cf" />
              <stop offset="100%" stopColor={WIRE_ON} />
            </linearGradient>
            <filter id="jrl-soft" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ---- Wire loop (faint guide always visible) ---- */}
          <path
            d={LOOP_PATH}
            fill="none"
            stroke="#1e2a44"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* The live wire — colour + glow only once the loop is closed */}
          <path
            d={LOOP_PATH}
            fill="none"
            stroke={lit ? "url(#jrl-wireOn)" : WIRE_OFF}
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              filter: lit ? `drop-shadow(0 0 5px ${ACCENT})` : "none",
              transition: "stroke 320ms ease, filter 320ms ease",
            }}
          />

          {/* ---- The missing gap ---- */}
          {!closed ? (
            <g
              onClick={closeGap}
              onPointerDown={closeGap}
              role="button"
              tabIndex={0}
              aria-label="Tap to snap the wire in and close the loop"
              style={{ cursor: "pointer" }}
            >
              {/* big invisible finger target across the whole top */}
              <rect
                x={GAP.x1 - 14}
                y={GAP.y - 40}
                width={GAP.x2 - GAP.x1 + 28}
                height="80"
                fill="transparent"
              />
              {/* the two exposed wire ends */}
              {[GAP.x1, GAP.x2].map((x) => (
                <circle key={x} cx={x} cy={GAP.y} r="6" fill="#6b779e" />
              ))}
              {/* pulsing "tap here" beacons */}
              {[GAP.x1, GAP.x2].map((x, i) => (
                <circle
                  key={`b-${x}`}
                  className="jrlight-anim"
                  cx={x}
                  cy={GAP.y}
                  r="11"
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth="2.5"
                  style={{
                    transformBox: "fill-box",
                    transformOrigin: "center",
                    animation: `jrlight-hint 1.2s ease-in-out ${i * 0.3}s infinite`,
                  }}
                />
              ))}
              {/* a friendly pointing finger over the gap */}
              <text
                className="jrlight-anim"
                x={(GAP.x1 + GAP.x2) / 2}
                y={GAP.y - 24}
                textAnchor="middle"
                fontSize="30"
                aria-hidden="true"
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "center",
                  animation: "jrlight-breathe 1.6s ease-in-out infinite",
                }}
              >
                👇
              </text>
            </g>
          ) : (
            // The wire snaps in with a springy bounce
            <line
              className="jrlight-anim"
              x1={GAP.x1}
              y1={GAP.y}
              x2={GAP.x2}
              y2={GAP.y}
              stroke="url(#jrl-wireOn)"
              strokeWidth="8"
              strokeLinecap="round"
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                filter: `drop-shadow(0 0 5px ${ACCENT})`,
                animation: "jrlight-pop .5s cubic-bezier(.34,1.56,.64,1)",
              }}
            />
          )}

          {/* ---- Battery (bottom centre-left) ---- */}
          <g transform="translate(110 192)">
            <circle cx="0" cy="0" r="26" fill="#11182f" stroke={ACCENT} strokeWidth="3" />
            <text x="0" y="9" textAnchor="middle" fontSize="26" aria-hidden="true">
              🔋
            </text>
          </g>

          {/* ---- Bulb (top centre) ---- */}
          <g transform="translate(160 56)">
            {/* warm pulsing halo when lit */}
            {lit && (
              <circle
                className="jrlight-anim"
                cx="0"
                cy="0"
                r="46"
                fill="url(#jrl-bulb)"
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "center",
                  animation: "jrlight-glow 1.7s ease-in-out infinite",
                }}
              />
            )}
            {/* little light rays when lit */}
            {lit && (
              <g
                className="jrlight-anim"
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "center",
                  animation: "jrlight-rays 1.7s ease-in-out infinite",
                }}
              >
                {Array.from({ length: 8 }).map((_, i) => {
                  const a = (i * Math.PI) / 4;
                  const r0 = 30;
                  const r1 = 42;
                  return (
                    <line
                      key={i}
                      x1={Math.cos(a) * r0}
                      y1={Math.sin(a) * r0}
                      x2={Math.cos(a) * r1}
                      y2={Math.sin(a) * r1}
                      stroke="#ffe27a"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                  );
                })}
              </g>
            )}
            <circle
              cx="0"
              cy="0"
              r="30"
              fill={lit ? "rgba(255,226,122,0.22)" : "#11182f"}
              stroke={lit ? "#ffe27a" : "#3a4566"}
              strokeWidth="3"
              style={{ transition: "fill 320ms ease, stroke 320ms ease" }}
            />
            <g
              className="jrlight-anim"
              role="button"
              tabIndex={lit ? -1 : 0}
              aria-label={lit ? "The bulb is glowing" : "Bulb — close the loop to light it"}
              onClick={pokeBulb}
              onPointerDown={pokeBulb}
              filter={lit ? "url(#jrl-soft)" : undefined}
              style={{
                cursor: lit ? "default" : "pointer",
                transformBox: "fill-box",
                transformOrigin: "center",
                animation: lit
                  ? "jrlight-jump .7s cubic-bezier(.34,1.56,.64,1)"
                  : "jrlight-breathe 2.6s ease-in-out infinite",
              }}
            >
              <text
                x="0"
                y="11"
                textAnchor="middle"
                fontSize="34"
                opacity={lit ? 1 : 0.5}
                aria-hidden="true"
              >
                💡
              </text>
            </g>
          </g>

          {/* ---- Spark zipping round the closed loop ---- */}
          {lit && (
            <g aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <circle key={i} r="5" fill={SPARK}>
                  <animateMotion
                    dur="1.6s"
                    begin={`${i * 0.53}s`}
                    repeatCount="indefinite"
                    path={LOOP_PATH}
                  />
                </circle>
              ))}
            </g>
          )}
        </svg>

        {/* Confetti burst on win */}
        {lit && (
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden"
            aria-hidden="true"
          >
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i / 12) * Math.PI * 2;
              const dist = 90 + (i % 3) * 26;
              const dx = `${Math.cos(angle) * dist}px`;
              const dy = `${Math.sin(angle) * dist - 30}px`;
              const rot = `${(i % 2 ? 1 : -1) * (160 + i * 18)}deg`;
              const bits = ["✨", "🎉", "⭐", "💛"];
              return (
                <span
                  key={i}
                  className="jrlight-anim absolute left-1/2 top-1/2 text-xl"
                  style={
                    {
                      "--dx": dx,
                      "--dy": dy,
                      "--rot": rot,
                      animation: `jrlight-confetti 1.1s ease-out ${i * 0.04}s both`,
                    } as React.CSSProperties
                  }
                >
                  {bits[i % bits.length]}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            if (!lit) closeGap();
          }}
          aria-label={lit ? "The light is on" : "Close the loop"}
          className="jrlight-anim font-display flex items-center gap-2 rounded-2xl px-7 font-bold"
          style={{
            minHeight: 72,
            fontSize: 22,
            background: lit ? ACCENT : "rgba(11,16,32,0.6)",
            color: lit ? "#060810" : "#9aa6cf",
            border: lit ? "none" : "2px solid var(--color-line, #27314f)",
            boxShadow: lit ? `0 6px 0 0 #0e8a63, 0 0 18px ${ACCENT}` : "0 6px 0 0 #161e35",
            touchAction: "manipulation",
            transition: "transform .15s cubic-bezier(.34,1.56,.64,1)",
          }}
          onPointerUp={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
          }}
          onPointerDownCapture={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(.9)";
          }}
        >
          <span aria-hidden="true" className="text-3xl">
            {lit ? "💡" : "🔌"}
          </span>
          {lit ? "ON" : "TAP"}
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            reset();
          }}
          aria-label="Start over"
          className="flex items-center justify-center rounded-2xl font-bold text-ink-dim"
          style={{
            minHeight: 72,
            minWidth: 72,
            fontSize: 28,
            background: "rgba(11,16,32,0.6)",
            border: "2px solid var(--color-line, #27314f)",
            boxShadow: "0 6px 0 0 #161e35",
            touchAction: "manipulation",
          }}
        >
          <span aria-hidden="true">🔄</span>
        </button>
      </div>

      {/* wobble feedback wrapper (gentle, friendly) */}
      <div
        className="jrlight-anim h-1"
        style={{ animation: wobble ? "jrlight-wobble .5s ease" : undefined }}
        aria-hidden="true"
      />
    </div>
  );
}
