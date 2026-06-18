"use client";
import { useCallback, useMemo, useState } from "react";
import type { ActivityProps } from "@/lib/activities/types";

const ACCENT = "#a855f7";

/**
 * One round: a row of big items where every item shares ONE feature except the
 * `oddIndex` one. The child taps the odd one out. The "difference" is made
 * obvious — a different category (emoji), a different colour, or a different
 * shape — so a non-reader can spot it from visuals alone.
 */
interface Round {
  /** What kind of difference this round teaches (used only for the aria hint). */
  kind: "thing" | "colour" | "shape";
  /** The visual cells, left-to-right. */
  cells: Cell[];
  /** Index of the odd one out within `cells`. */
  oddIndex: number;
}

type Cell =
  | { type: "emoji"; emoji: string }
  | { type: "dot"; color: string }
  | { type: "shape"; shape: "circle" | "square"; color: string };

const ROUNDS: Round[] = [
  // Round 1 — different THING (category): one banana among apples.
  {
    kind: "thing",
    oddIndex: 2,
    cells: [
      { type: "emoji", emoji: "🍎" },
      { type: "emoji", emoji: "🍎" },
      { type: "emoji", emoji: "🍌" },
      { type: "emoji", emoji: "🍎" },
      { type: "emoji", emoji: "🍎" },
    ],
  },
  // Round 2 — different COLOUR: one blue dot among yellow dots.
  {
    kind: "colour",
    oddIndex: 3,
    cells: [
      { type: "dot", color: "#f5b942" },
      { type: "dot", color: "#f5b942" },
      { type: "dot", color: "#f5b942" },
      { type: "dot", color: "#3b82f6" },
      { type: "dot", color: "#f5b942" },
    ],
  },
  // Round 3 — different SHAPE: one square among circles (all same colour).
  {
    kind: "shape",
    oddIndex: 1,
    cells: [
      { type: "shape", shape: "circle", color: ACCENT },
      { type: "shape", shape: "square", color: ACCENT },
      { type: "shape", shape: "circle", color: ACCENT },
      { type: "shape", shape: "circle", color: ACCENT },
    ],
  },
];

const HINT: Record<Round["kind"], { icon: string; label: string }> = {
  thing: { icon: "🔎", label: "Find the different one" },
  colour: { icon: "🎨", label: "Find the different colour" },
  shape: { icon: "⭐", label: "Find the different shape" },
};

/** Plain-words description of a cell for the screen-reader aria-label. */
function describe(cell: Cell): string {
  if (cell.type === "emoji") return "picture";
  if (cell.type === "dot") return "coloured dot";
  return cell.shape;
}

export default function OddOneOut({ onComplete }: ActivityProps) {
  const [round, setRound] = useState(0);
  /** Index of the cell that just got a celebratory pop (the correct pick). */
  const [popped, setPopped] = useState<number | null>(null);
  /** Index of the cell that just wobbled (a gentle "try again" on a wrong tap). */
  const [wobble, setWobble] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);

  const current = ROUNDS[round];
  const hint = HINT[current.kind];
  const total = ROUNDS.length;

  const handlePick = useCallback(
    (index: number) => {
      if (solved || popped !== null) return; // ignore taps during the pop animation
      if (index === current.oddIndex) {
        // Correct! Pop + glow, then advance after a short celebratory beat.
        setWobble(null);
        setPopped(index);
        const last = round + 1 >= total;
        window.setTimeout(() => {
          if (last) {
            setSolved(true);
            onComplete({ passed: true, stars: 3 });
          } else {
            setRound((r) => r + 1);
            setPopped(null);
          }
        }, 850);
      } else {
        // Gentle nudge — wobble the wrong piece, no penalty, no fail.
        setWobble(index);
        window.setTimeout(() => setWobble((w) => (w === index ? null : w)), 450);
      }
    },
    [solved, popped, current.oddIndex, round, total, onComplete],
  );

  const restart = useCallback(() => {
    setRound(0);
    setPopped(null);
    setWobble(null);
    setSolved(false);
  }, []);

  // Little stars filled up as the child clears each round.
  const progress = useMemo(
    () => Array.from({ length: total }, (_, i) => (solved ? true : i < round)),
    [round, total, solved],
  );

  return (
    <div
      className="flex w-full flex-col gap-4 rounded-xl p-3"
      style={{ minHeight: 460 }}
    >
      <style>{`
        @keyframes ooo-wobble {
          0%,100% { transform: translateX(0) rotate(0); }
          20% { transform: translateX(-7px) rotate(-5deg); }
          50% { transform: translateX(7px) rotate(5deg); }
          80% { transform: translateX(-4px) rotate(-3deg); }
        }
        @keyframes ooo-pop {
          0% { transform: scale(1); }
          45% { transform: scale(1.28) rotate(6deg); }
          100% { transform: scale(1.12) rotate(0); }
        }
        @keyframes ooo-sparkle {
          0% { opacity: 0; transform: scale(0.4); }
          50% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0; transform: scale(1.4); }
        }
        @keyframes ooo-bounce-in {
          0% { opacity: 0; transform: translateY(14px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Big picture-first prompt: icon + very short label */}
      <div className="flex items-center justify-center gap-2">
        <span aria-hidden className="text-3xl">
          {solved ? "🎉" : hint.icon}
        </span>
        <p
          className="font-display text-lg font-semibold"
          style={{ color: solved ? ACCENT : "var(--color-ink, #e6e9ef)" }}
        >
          {solved ? "You did it!" : hint.label}
        </p>
      </div>

      {/* Progress stars — one fills per cleared round (visual, no numbers) */}
      <div
        className="flex items-center justify-center gap-2"
        role="img"
        aria-label={`${progress.filter(Boolean).length} of ${total} rounds done`}
      >
        {progress.map((done, i) => (
          <span
            key={i}
            aria-hidden
            className="text-2xl transition-transform duration-300"
            style={{
              transform: done ? "scale(1.15)" : "scale(0.85)",
              filter: done
                ? `drop-shadow(0 0 6px ${ACCENT})`
                : "grayscale(1) opacity(0.4)",
            }}
          >
            ⭐
          </span>
        ))}
      </div>

      {/* The play field — big tappable items */}
      <div
        key={solved ? "done" : round}
        className="panel flex flex-1 flex-wrap items-center justify-center gap-3 rounded-2xl p-3"
        style={{ touchAction: "none" }}
      >
        {solved ? (
          <div
            className="flex flex-col items-center gap-2 text-center"
            style={{ animation: "ooo-bounce-in 360ms ease-out" }}
          >
            <span aria-hidden className="text-6xl animate-float">
              🌟
            </span>
            <p className="font-display text-base" style={{ color: ACCENT }}>
              Great spotting!
            </p>
          </div>
        ) : (
          current.cells.map((cell, i) => {
            const isPopped = popped === i;
            const isWobble = wobble === i;
            const dim = popped !== null && !isPopped;
            return (
              <button
                key={`${round}-${i}`}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  handlePick(i);
                }}
                aria-label={`Tap if this ${describe(cell)} is the different one`}
                className="relative grid place-items-center rounded-2xl border-2 bg-panel-2/60 transition-opacity"
                style={{
                  width: "clamp(64px, 19vw, 96px)",
                  height: "clamp(64px, 19vw, 96px)",
                  touchAction: "none",
                  borderColor: isPopped ? ACCENT : "var(--color-line, #2a2f3a)",
                  boxShadow: isPopped
                    ? `0 0 0 4px ${ACCENT}, 0 0 26px ${ACCENT}`
                    : undefined,
                  opacity: dim ? 0.35 : 1,
                  animation: isPopped
                    ? "ooo-pop 850ms ease-out forwards"
                    : isWobble
                      ? "ooo-wobble 450ms ease-in-out"
                      : "ooo-bounce-in 320ms ease-out",
                  animationDelay: isPopped || isWobble ? "0ms" : `${i * 60}ms`,
                }}
              >
                <CellVisual cell={cell} />
                {isPopped && (
                  <>
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -right-1 -top-2 text-2xl"
                      style={{ animation: "ooo-sparkle 850ms ease-out" }}
                    >
                      ✨
                    </span>
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -bottom-2 -left-1 text-xl"
                      style={{ animation: "ooo-sparkle 850ms ease-out 120ms" }}
                    >
                      ✨
                    </span>
                  </>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Tiny visual status + start-over control */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="rounded-full px-3 py-1 font-mono text-[11px]"
          style={{ background: "rgba(168,85,247,0.14)", color: ACCENT }}
          aria-live="polite"
        >
          {solved
            ? "⭐⭐⭐ Done!"
            : popped !== null
              ? "✅ Yes!"
              : wobble !== null
                ? "🙂 Try again"
                : `Round ${round + 1} / ${total}`}
        </span>
        <button
          type="button"
          onClick={restart}
          aria-label="Start over from the first round"
          className="rounded-xl border-2 border-line bg-panel/60 px-5 py-3 text-sm font-semibold text-ink-dim transition-transform active:scale-95"
        >
          🔄 Again
        </button>
      </div>
    </div>
  );
}

/** Renders the inner visual of a cell — emoji, colour dot, or shape. */
function CellVisual({ cell }: { cell: Cell }) {
  if (cell.type === "emoji") {
    return (
      <span aria-hidden style={{ fontSize: "clamp(34px, 11vw, 52px)" }}>
        {cell.emoji}
      </span>
    );
  }
  if (cell.type === "dot") {
    return (
      <svg viewBox="0 0 100 100" width="68%" height="68%" aria-hidden>
        <circle cx="50" cy="50" r="42" fill={cell.color} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100" width="68%" height="68%" aria-hidden>
      {cell.shape === "circle" ? (
        <circle cx="50" cy="50" r="42" fill={cell.color} />
      ) : (
        <rect x="10" y="10" width="80" height="80" rx="10" fill={cell.color} />
      )}
    </svg>
  );
}
