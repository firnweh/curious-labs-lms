"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useState } from "react";

/* ── Spin to Match ──────────────────────────────────────────────────────────
   JUNIORS (Class 1-3). Subject: 3D MODELLING. Concept: ROTATION — a first
   taste of turning a shape in space.

   A faded GHOST rocket 🚀 points in a TARGET direction (up/right/down/left).
   The child's SOLID rocket points a different way. A big "Spin ↻" button
   rotates the solid rocket 90° clockwise each tap (smooth CSS transform).
   When the solid rocket points the SAME way as the ghost → snap-glow +
   celebrate. Two rounds (a new target each time) before completing.

   NO READING REQUIRED — the rocket is clearly directional, the ghost shows
   the goal, the big round arrow button is the only control. Wrong is
   impossible (every tap is progress); there is no fail state. After the
   last round → onComplete(3 stars). */

const ACCENT = "#f59e0b";

/** A heading in 90° steps: 0=up, 1=right, 2=down, 3=left. */
type Dir = 0 | 1 | 2 | 3;

interface Round {
  /** Where the ghost target points. */
  target: Dir;
  /** Where the child's rocket starts (always different from target). */
  start: Dir;
}

/** Two deterministic, always-winnable rounds. Start ≠ target each time. */
const ROUNDS: Round[] = [
  { target: 1, start: 0 }, // ghost → right, start up   (1 spin)
  { target: 2, start: 3 }, // ghost → down,  start left (3 spins)
];

const TOTAL = ROUNDS.length;

/** Word for the heading (used only for aria — not shown as instructions). */
const DIR_WORD: Record<Dir, string> = {
  0: "up",
  1: "right",
  2: "down",
  3: "left",
};

export default function SpintoMatch({ onComplete }: ActivityProps) {
  const [round, setRound] = useState<number>(0);
  /** Child rocket heading. Stored as a free-running turn count so the CSS
   *  transform keeps spinning the same way (it never jumps backwards). */
  const [turns, setTurns] = useState<number>(ROUNDS[0].start);
  /** True for the brief moment after a match — drives the snap-glow. */
  const [matched, setMatched] = useState<boolean>(false);
  /** True once all rounds are solved — shows the celebration. */
  const [done, setDone] = useState<boolean>(false);

  const current = ROUNDS[round];
  /** Heading the child rocket currently shows (0-3). */
  const dir = ((((turns % 4) + 4) % 4) as Dir);
  const isMatch = dir === current.target && !done;
  const solvedCount = done ? TOTAL : round;

  const spin = useCallback(() => {
    if (matched || done) return;
    setTurns((t) => {
      const next = t + 1;
      const nextDir = (((next % 4) + 4) % 4) as Dir;
      if (nextDir === current.target) {
        // Snap to the goal → glow, then advance or celebrate.
        setMatched(true);
        window.setTimeout(() => {
          if (round + 1 >= TOTAL) {
            setDone(true);
            onComplete({ passed: true, stars: 3 });
          } else {
            const nr = round + 1;
            setRound(nr);
            setTurns(ROUNDS[nr].start);
            setMatched(false);
          }
        }, 1050);
      }
      return next;
    });
  }, [matched, done, current.target, round, onComplete]);

  const reset = useCallback(() => {
    setRound(0);
    setTurns(ROUNDS[0].start);
    setMatched(false);
    setDone(false);
  }, []);

  // Degrees for the child rocket transform (free-running, never rewinds).
  const childDeg = turns * 90;
  // Degrees for the ghost (fixed at its target heading).
  const ghostDeg = current.target * 90;

  // Progress dots.
  const dots = useMemo(() => ROUNDS.map((_, i) => i), []);

  return (
    <div
      className="panel relative mx-auto flex min-h-[460px] w-full max-w-[640px] flex-col gap-3 overflow-hidden p-4"
      style={{ touchAction: "none" }}
    >
      <style>{keyframes}</style>

      {/* Header: icon + progress dots (no instructions to read). */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2" aria-hidden>
          <span className="text-2xl">🧭</span>
          <span className="font-display text-lg" style={{ color: ACCENT }}>
            Spin to match
          </span>
        </div>
        <div
          className="flex items-center gap-1.5"
          aria-label={`Round ${solvedCount} of ${TOTAL}`}
        >
          {dots.map((i) => (
            <span
              key={i}
              className="block h-3 w-3 rounded-full transition-all"
              style={{
                background: i < solvedCount ? ACCENT : "transparent",
                border: `2px solid ${i < solvedCount ? ACCENT : "var(--color-line, #2a3340)"}`,
                boxShadow: i < solvedCount ? `0 0 8px ${ACCENT}` : "none",
              }}
            />
          ))}
        </div>
      </div>

      {/* The play field, or the celebration. */}
      {done ? (
        <div
          className="grid flex-1 place-items-center gap-2 py-4 text-center"
          style={{ animation: "spn-pop 0.5s ease both" }}
        >
          <div
            className="text-6xl"
            style={{ animation: "spn-bounce 1s ease-in-out infinite" }}
          >
            🎉
          </div>
          <div
            className="flex gap-1 text-3xl"
            aria-label="Three stars, you did it"
          >
            <span style={{ animation: "spn-pop 0.4s 0.05s ease both" }}>⭐</span>
            <span style={{ animation: "spn-pop 0.4s 0.2s ease both" }}>⭐</span>
            <span style={{ animation: "spn-pop 0.4s 0.35s ease both" }}>⭐</span>
          </div>
        </div>
      ) : (
        <div className="grid flex-1 place-items-center">
          <div
            className="relative grid h-[240px] w-[240px] place-items-center rounded-full sm:h-[280px] sm:w-[280px]"
            style={{
              background: isMatch
                ? "radial-gradient(circle, rgba(245,158,11,0.22), transparent 70%)"
                : "radial-gradient(circle, rgba(255,255,255,0.03), transparent 70%)",
              boxShadow: isMatch ? `0 0 40px ${ACCENT}` : "none",
              transition: "box-shadow 0.3s ease, background 0.3s ease",
              animation: matched ? "spn-pop 0.5s ease" : undefined,
            }}
          >
            {/* GHOST target rocket — faded, fixed, shows the goal heading. */}
            <RocketDisc
              deg={ghostDeg}
              ghost
              label={`Goal: point ${DIR_WORD[current.target]}`}
            />
            {/* Child rocket — solid, rotates on top. */}
            <div className="absolute inset-0 grid place-items-center">
              <RocketDisc
                deg={childDeg}
                glow={isMatch}
                label={`Your rocket points ${DIR_WORD[dir]}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Big SPIN button (hidden once finished). */}
      {!done && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            aria-label="Spin the rocket"
            disabled={matched}
            onClick={spin}
            className="flex items-center gap-3 rounded-2xl px-7 py-4 font-display text-xl active:scale-95 disabled:opacity-60"
            style={{
              background: ACCENT,
              color: "#060810",
              boxShadow: `0 6px 0 rgba(0,0,0,0.25), 0 0 22px rgba(245,158,11,0.5)`,
              touchAction: "manipulation",
            }}
          >
            <span
              aria-hidden
              className="text-2xl"
              style={{ animation: matched ? undefined : "spn-hint 2.4s ease-in-out infinite" }}
            >
              ↻
            </span>
            <span>Spin</span>
          </button>
        </div>
      )}

      {/* Start over — big, always available. */}
      <div className="flex justify-center pt-1">
        <button
          type="button"
          aria-label="Start over"
          onClick={reset}
          className="flex items-center gap-2 rounded-xl border-2 px-5 py-3 font-display text-base active:scale-95"
          style={{
            borderColor: "var(--color-line, #2a3340)",
            color: "var(--color-ink-dim, #9fb0c0)",
          }}
        >
          <span aria-hidden className="text-xl">
            🔄
          </span>
          <span>Start over</span>
        </button>
      </div>
    </div>
  );
}

/** A round disc holding a clearly-directional rocket, rotated by `deg`.
 *  `0deg` = pointing up. The rocket nose, fins and flame make "which way"
 *  unmistakable without reading. */
function RocketDisc({
  deg,
  ghost = false,
  glow = false,
  label,
}: {
  deg: number;
  ghost?: boolean;
  glow?: boolean;
  label: string;
}) {
  return (
    <div
      aria-label={label}
      className="grid h-[150px] w-[150px] place-items-center rounded-full sm:h-[170px] sm:w-[170px]"
      style={{
        transform: `rotate(${deg}deg)`,
        transition: ghost ? undefined : "transform 0.5s cubic-bezier(0.34,1.4,0.5,1)",
        opacity: ghost ? 0.28 : 1,
        filter: glow ? `drop-shadow(0 0 10px ${ACCENT})` : undefined,
        willChange: "transform",
      }}
    >
      <svg
        viewBox="0 0 100 100"
        className="h-full w-full"
        role="presentation"
        aria-hidden
      >
        {/* Flame at the tail (bottom when pointing up). */}
        <path
          d="M50 86 L42 74 Q50 80 58 74 Z"
          fill={ghost ? "#9fb0c0" : "#fb7185"}
        />
        <path
          d="M50 80 L45 72 Q50 76 55 72 Z"
          fill={ghost ? "#cbd5e1" : "#fbbf24"}
        />
        {/* Body. */}
        <path
          d="M50 14
             C40 24 36 44 36 60
             L36 72 L64 72 L64 60
             C64 44 60 24 50 14 Z"
          fill={ghost ? "#64748b" : glow ? ACCENT : "#38bdf8"}
          stroke={ghost ? "#94a3b8" : "#060810"}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Fins. */}
        <path
          d="M36 58 L24 74 L36 70 Z"
          fill={ghost ? "#475569" : "#0ea5e9"}
          stroke={ghost ? "#94a3b8" : "#060810"}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M64 58 L76 74 L64 70 Z"
          fill={ghost ? "#475569" : "#0ea5e9"}
          stroke={ghost ? "#94a3b8" : "#060810"}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Window. */}
        <circle
          cx="50"
          cy="42"
          r="8"
          fill={ghost ? "#1e293b" : "#0b1220"}
          stroke={ghost ? "#94a3b8" : "#e0f2fe"}
          strokeWidth="2.5"
        />
        {/* Nose tip marker — makes the pointing end obvious. */}
        <circle cx="50" cy="16" r="3.5" fill={ghost ? "#cbd5e1" : "#fef08a"} />
      </svg>
    </div>
  );
}

const keyframes = `
@keyframes spn-pop {
  0% { transform: scale(0.7); }
  60% { transform: scale(1.12); }
  100% { transform: scale(1); }
}
@keyframes spn-bounce {
  0%,100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}
@keyframes spn-hint {
  0%,100% { transform: rotate(0deg); }
  10% { transform: rotate(-18deg); }
  25% { transform: rotate(0deg); }
}
@media (prefers-reduced-motion: reduce) {
  [style*="animation"] { animation: none !important; }
}
`;
