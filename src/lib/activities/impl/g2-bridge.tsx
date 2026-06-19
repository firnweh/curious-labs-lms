"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Bridge Builder 🌉 ────────────────────────────────────────────────────────
   GRADE 2 (junior, age ~7) · 3D / structures. Single learning goal: TRIANGLES
   make structures strong — a deck braced with triangles carries a heavy load,
   while plain squares and gaps sag and wobble.

   A flat road-deck spans a gap between two cliffs 🏔️. Beneath the deck sit four
   empty bays. Each bay has a diagonal SLOT the child can TAP to add (or remove)
   a brace beam — adding a diagonal turns a wobbly square into two stiff
   triangles 🔺. Tap the big TEST button to drop a heavy rock 🪨 onto the deck:
   with every bay braced the bridge HOLDS and cheers (✨🎉 ⭐⭐⭐); with one or
   more bays still open it gently sags and the rock bounces off — try again, no
   scolding. Always winnable: brace all four bays, then TEST.

   onComplete fires exactly once on the holding bridge (guarded by reportedRef).
   No reading required — everything is shown with beams, emoji and motion. */

const ACCENT = "#f59e0b";

/** There are four bays under the deck; each may hold one diagonal brace. */
const BAY_COUNT = 4;
/** All four bays must be braced for the deck to carry the load. */
const NEEDED = BAY_COUNT;

/* ── Layout maths (virtual SVG units; CSS scales it responsively) ─────────── */
const VW = 360;
const VH = 240;
const DECK_Y = 96; // top chord (the road) height
const BASE_Y = 176; // bottom chord height
const CLIFF_TOP = DECK_Y; // deck rests level with the cliff tops
const LEFT_EDGE = 18; // inner edge of the left cliff
const RIGHT_EDGE = VW - 18; // inner edge of the right cliff
const SPAN = RIGHT_EDGE - LEFT_EDGE;
const BAY_W = SPAN / BAY_COUNT;

/** The x of the n-th vertical post (0..BAY_COUNT). */
const postX = (i: number): number => LEFT_EDGE + i * BAY_W;

interface Bay {
  /** Left/right x of the bay's square. */
  x0: number;
  x1: number;
  /** Diagonal runs bottom-left → top-right (alternating for a pretty truss). */
  up: boolean;
}

const BAYS: readonly Bay[] = Array.from({ length: BAY_COUNT }, (_, i): Bay => ({
  x0: postX(i),
  x1: postX(i + 1),
  up: i % 2 === 0,
}));

type Phase = "build" | "testing" | "won" | "sag";

export default function BridgeBuilder({ onComplete }: ActivityProps) {
  // Which bays currently have a brace beam.
  const [braced, setBraced] = useState<boolean[]>(() => Array(BAY_COUNT).fill(false));
  const [phase, setPhase] = useState<Phase>("build");

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportedRef = useRef<boolean>(false);

  const clearTimer = useCallback((): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => () => clearTimer(), [clearTimer]);

  const testing = phase === "testing";
  const won = phase === "won";
  const sagging = phase === "sag";
  const locked = testing || won; // no editing mid-test or after the win

  const bracedCount = useMemo<number>(
    () => braced.reduce((n, b) => n + (b ? 1 : 0), 0),
    [braced],
  );
  const triangles = bracedCount * 2; // each diagonal splits a square into two triangles

  const toggleBay = useCallback(
    (i: number): void => {
      if (locked) return;
      setBraced((prev) => {
        const next = [...prev];
        next[i] = !next[i];
        return next;
      });
      // Leaving a sag/idle state back into building keeps things tidy.
      setPhase("build");
    },
    [locked],
  );

  const reset = useCallback((): void => {
    clearTimer();
    reportedRef.current = false;
    setBraced(Array(BAY_COUNT).fill(false));
    setPhase("build");
  }, [clearTimer]);

  const test = useCallback((): void => {
    if (locked) return;
    clearTimer();
    setPhase("testing");
    const strong = bracedCount >= NEEDED;
    // Let the rock fall, THEN judge — deterministic, no randomness.
    timerRef.current = setTimeout(() => {
      if (strong) {
        setPhase("won");
        if (!reportedRef.current) {
          reportedRef.current = true;
          onComplete({
            passed: true,
            stars: 3,
            detail: "Strong bridge! Triangles held the heavy rock. 🌉",
          });
        }
      } else {
        setPhase("sag");
        onComplete({
          passed: false,
          detail:
            bracedCount === 0
              ? "The flat deck wobbled! Add diagonal beams to make triangles."
              : "Almost! A few bays are still open squares. Brace every bay, then test.",
        });
        // Always recoverable — settle back to building after the wobble.
        timerRef.current = setTimeout(() => setPhase("build"), 1100);
      }
    }, 720);
  }, [locked, clearTimer, bracedCount, onComplete]);

  const statusEmoji = won ? "🎉" : sagging ? "😮" : testing ? "🪨" : "🌉";
  const statusLabel = won
    ? "The bridge held the heavy rock!"
    : testing
      ? "Dropping the rock to test the bridge"
      : sagging
        ? "The deck wobbled — add more triangle braces and try again"
        : `${bracedCount} of ${BAY_COUNT} bays braced — tap the slots, then test`;

  // The rock sits above the deck, then drops to the deck on TEST.
  const rockY = testing || won || sagging ? DECK_Y - 18 : 30;
  // A holding deck stays flat; a weak one dips in the middle.
  const deckDip = sagging ? 14 : 0;

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono text-ink">
      <style>{`
        @keyframes g2bridge-wobble {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(-4px) rotate(-2deg); }
          60% { transform: translateX(4px) rotate(2deg); }
          80% { transform: translateX(-2px) rotate(-1deg); }
        }
        @keyframes g2bridge-pop {
          0% { transform: scale(1); }
          45% { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
        @keyframes g2bridge-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }
        @keyframes g2bridge-glow {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; }
        }
      `}</style>

      {/* ── Tiny visual status pill ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={statusLabel}
        style={{
          background: won ? "rgba(245,158,11,0.16)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${won ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: won ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true">{statusEmoji}</span>
        {won ? (
          <span aria-hidden="true" className="text-2xl">
            ⭐⭐⭐
          </span>
        ) : (
          <span aria-hidden="true" className="text-xl">
            🔺×{triangles}
          </span>
        )}
        {won && (
          <span aria-hidden="true" className="text-2xl">
            ✨
          </span>
        )}
      </div>

      {/* ── The bridge scene ── */}
      <div className="panel relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-line p-2">
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="block w-full select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="A bridge deck across a gap, with bays underneath to brace with beams"
        >
          <defs>
            <linearGradient id="g2b-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0b1426" />
              <stop offset="100%" stopColor="#10243b" />
            </linearGradient>
            <linearGradient id="g2b-cliff" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3a4866" />
              <stop offset="100%" stopColor="#1b2436" />
            </linearGradient>
          </defs>

          {/* sky + canyon */}
          <rect x={0} y={0} width={VW} height={VH} fill="url(#g2b-sky)" />

          {/* cliffs on each side */}
          <path
            d={`M0 ${CLIFF_TOP} L${LEFT_EDGE} ${CLIFF_TOP} L${LEFT_EDGE} ${VH} L0 ${VH} Z`}
            fill="url(#g2b-cliff)"
            stroke="#475569"
            strokeWidth={1}
          />
          <path
            d={`M${RIGHT_EDGE} ${CLIFF_TOP} L${VW} ${CLIFF_TOP} L${VW} ${VH} L${RIGHT_EDGE} ${VH} Z`}
            fill="url(#g2b-cliff)"
            stroke="#475569"
            strokeWidth={1}
          />
          <text x={9} y={CLIFF_TOP - 6} fontSize={18} textAnchor="middle" aria-hidden="true">
            🏔️
          </text>
          <text x={VW - 9} y={CLIFF_TOP - 6} fontSize={18} textAnchor="middle" aria-hidden="true">
            🏔️
          </text>

          {/* the truss group — wobbles when the deck sags */}
          <g
            style={{
              transformBox: "view-box",
              transformOrigin: "center",
              animation: sagging ? "g2bridge-wobble 0.6s ease-in-out" : undefined,
            }}
          >
            {/* bottom chord */}
            <line
              x1={LEFT_EDGE}
              y1={BASE_Y}
              x2={RIGHT_EDGE}
              y2={BASE_Y}
              stroke="#64748b"
              strokeWidth={6}
              strokeLinecap="round"
            />
            {/* vertical posts between bays */}
            {Array.from({ length: BAY_COUNT + 1 }, (_, i) => (
              <line
                key={`post-${i}`}
                x1={postX(i)}
                y1={DECK_Y}
                x2={postX(i)}
                y2={BASE_Y}
                stroke="#64748b"
                strokeWidth={5}
                strokeLinecap="round"
              />
            ))}

            {/* the diagonal braces (only the braced bays) */}
            {BAYS.map((bay, i) =>
              braced[i] ? (
                <line
                  key={`brace-${i}`}
                  x1={bay.up ? bay.x0 : bay.x1}
                  y1={BASE_Y}
                  x2={bay.up ? bay.x1 : bay.x0}
                  y2={DECK_Y}
                  stroke={ACCENT}
                  strokeWidth={7}
                  strokeLinecap="round"
                  style={{
                    filter: `drop-shadow(0 0 4px ${ACCENT}aa)`,
                    transformBox: "fill-box",
                    transformOrigin: "center",
                    animation: "g2bridge-pop 0.35s ease-out",
                  }}
                />
              ) : null,
            )}

            {/* the road deck (top chord) — dips in the middle when weak */}
            <path
              d={`M${LEFT_EDGE} ${DECK_Y} Q${VW / 2} ${DECK_Y + deckDip * 2} ${RIGHT_EDGE} ${DECK_Y}`}
              fill="none"
              stroke={won ? ACCENT : "#cbd5e1"}
              strokeWidth={9}
              strokeLinecap="round"
              style={{
                transition: "stroke 200ms ease",
                filter: won ? `drop-shadow(0 0 6px ${ACCENT})` : undefined,
              }}
            />
          </g>

          {/* the heavy test rock */}
          <g
            style={{
              transform: `translate(${VW / 2}px, ${rockY + deckDip}px)`,
              transition: "transform 700ms cubic-bezier(0.5,0,0.75,0)",
            }}
          >
            <text
              x={0}
              y={0}
              fontSize={30}
              textAnchor="middle"
              dominantBaseline="central"
              aria-label="heavy rock"
              style={{
                animation: won ? "g2bridge-float 1.2s ease-in-out infinite" : undefined,
              }}
            >
              🪨
            </text>
          </g>
        </svg>

        {/* ── Tappable bay slots, overlaid on the truss ── */}
        <div className="pointer-events-none absolute inset-0">
          {BAYS.map((bay, i) => {
            // Convert bay-center to a percentage box for the tap target.
            const leftPct = (bay.x0 / VW) * 100;
            const widthPct = (BAY_W / VW) * 100;
            const topPct = (DECK_Y / VH) * 100;
            const heightPct = ((BASE_Y - DECK_Y) / VH) * 100;
            const isOn = braced[i];
            return (
              <button
                key={`slot-${i}`}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  toggleBay(i);
                }}
                disabled={locked}
                aria-label={
                  isOn
                    ? `Bay ${i + 1} braced with a triangle beam. Tap to remove it.`
                    : `Bay ${i + 1} is an open square. Tap to add a triangle beam.`
                }
                aria-pressed={isOn}
                className="pointer-events-auto absolute grid place-items-center rounded-lg text-lg transition active:scale-95 disabled:opacity-100"
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                  touchAction: "none",
                  background: isOn ? "rgba(245,158,11,0.10)" : "rgba(255,255,255,0.04)",
                  border: `2px dashed ${isOn ? ACCENT : "rgba(148,163,184,0.5)"}`,
                  color: isOn ? ACCENT : "rgba(203,213,225,0.85)",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{ animation: !isOn && !locked ? "g2bridge-glow 1.6s ease-in-out infinite" : undefined }}
                >
                  {isOn ? "🔺" : "➕"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Brace counter (visual, one tile per bay) ── */}
      <div
        className="flex w-full max-w-[420px] items-center justify-center gap-2 rounded-2xl px-3 py-2"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "2px dashed var(--color-line, #33405c)",
        }}
        aria-label={`${bracedCount} of ${BAY_COUNT} bays braced`}
      >
        {braced.map((b, i) => (
          <span
            key={`dot-${i}`}
            aria-hidden="true"
            className="grid h-9 w-9 place-items-center rounded-lg text-xl"
            style={{
              background: b ? "rgba(245,158,11,0.14)" : "rgba(255,255,255,0.03)",
              border: `1.5px solid ${b ? ACCENT : "var(--color-line, #33405c)"}`,
            }}
          >
            {b ? "🔺" : "⬜"}
          </span>
        ))}
      </div>

      {/* ── Controls: TEST · Reset ── */}
      <div className="flex w-full max-w-[420px] items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            test();
          }}
          disabled={locked}
          aria-label="Test the bridge — drop the heavy rock"
          className="flex h-[60px] flex-1 items-center justify-center gap-2 rounded-2xl text-2xl font-bold transition active:scale-95 disabled:opacity-50"
          style={{
            touchAction: "none",
            background: ACCENT,
            color: "#1a1206",
            boxShadow: "0 6px 0 0 #b4790a",
          }}
        >
          <span aria-hidden="true">{testing ? "🪨" : "⚖️"}</span>
          <span aria-hidden="true" className="text-xl font-extrabold">
            TEST
          </span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            reset();
          }}
          disabled={testing}
          aria-label="Start over"
          className="grid h-[60px] w-[60px] place-items-center rounded-2xl text-2xl transition active:scale-90 disabled:opacity-40"
          style={{
            touchAction: "none",
            background: "rgba(255,255,255,0.05)",
            border: "2px solid var(--color-line, #33405c)",
          }}
        >
          <span aria-hidden="true">🔄</span>
        </button>
      </div>

      {/* celebratory floaters when solved */}
      {won && (
        <div className="pointer-events-none flex justify-center gap-2 text-2xl">
          <span style={{ animation: "g2bridge-float 1.1s ease-in-out infinite" }} aria-hidden="true">
            ✨
          </span>
          <span
            style={{ animation: "g2bridge-float 1.1s ease-in-out infinite", animationDelay: "0.2s" }}
            aria-hidden="true"
          >
            🎉
          </span>
          <span
            style={{ animation: "g2bridge-float 1.1s ease-in-out infinite", animationDelay: "0.4s" }}
            aria-hidden="true"
          >
            ✨
          </span>
        </div>
      )}
    </div>
  );
}
