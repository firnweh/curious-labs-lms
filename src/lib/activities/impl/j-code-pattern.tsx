"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useState } from "react";

/* ── What Comes Next? ───────────────────────────────────────────────────────
   JUNIORS (Class 1-3). Concept: PATTERNS — the thinking behind loops.
   A row of big shapes makes a simple repeating pattern; the last slot is a "?".
   Three big choice tiles below; tapping the correct one fills the "?" and
   celebrates. Three rounds of growing pattern: AB → ABC → AABB. A wrong tap
   just wobbles the tile (no penalty, no fail). NO READING REQUIRED — every
   choice is a big coloured shape. After the last round → onComplete(3 stars). */

const ACCENT = "#22d3ee";

/** A pattern shape. Each is a big emoji-like glyph rendered in colour. */
interface Shape {
  /** Stable key for matching the correct answer. */
  id: string;
  /** Big emoji glyph (renders with no reading required). */
  glyph: string;
  /** aria word for screen readers / labels. */
  word: string;
}

const RED: Shape = { id: "red", glyph: "🔴", word: "red circle" };
const BLUE: Shape = { id: "blue", glyph: "🔵", word: "blue circle" };
const GREEN: Shape = { id: "green", glyph: "🟢", word: "green circle" };
const STAR: Shape = { id: "star", glyph: "⭐", word: "yellow star" };
const HEART: Shape = { id: "heart", glyph: "❤️", word: "red heart" };

interface Round {
  /** The shapes shown before the "?" slot. */
  prompt: Shape[];
  /** The correct next shape. */
  answer: Shape;
  /** The three choice tiles (must include the answer). */
  choices: Shape[];
}

/** Three rounds of increasing pattern length: AB, ABC, AABB. */
const ROUNDS: Round[] = [
  // AB AB ?  → A
  {
    prompt: [RED, BLUE, RED, BLUE],
    answer: RED,
    choices: [BLUE, RED, GREEN],
  },
  // ABC ABC ? → A
  {
    prompt: [RED, GREEN, BLUE, RED, GREEN, BLUE],
    answer: RED,
    choices: [GREEN, RED, BLUE],
  },
  // AABB AABB ? → A
  {
    prompt: [STAR, STAR, HEART, HEART, STAR, STAR, HEART, HEART, STAR],
    answer: STAR,
    choices: [HEART, GREEN, STAR],
  },
];

const TOTAL = ROUNDS.length;

export default function WhatComesNext({ onComplete }: ActivityProps) {
  const [round, setRound] = useState<number>(0);
  /** The shape that correctly filled the "?" this round, or null while open. */
  const [filled, setFilled] = useState<Shape | null>(null);
  /** Id of a choice tile currently wobbling from a wrong tap. */
  const [wobble, setWobble] = useState<string | null>(null);
  /** True once all rounds are solved — shows the celebration. */
  const [done, setDone] = useState<boolean>(false);

  const current = ROUNDS[round];
  const solvedCount = filled ? round + 1 : round;

  const choose = useCallback(
    (choice: Shape) => {
      if (filled || done) return;
      if (choice.id !== current.answer.id) {
        // Wrong → gentle wobble, no penalty, no fail toast.
        setWobble(choice.id);
        window.setTimeout(() => setWobble(null), 480);
        return;
      }
      // Correct → fill the "?" slot and celebrate this round.
      setFilled(choice);
      window.setTimeout(() => {
        if (round + 1 >= TOTAL) {
          setDone(true);
          onComplete({ passed: true, stars: 3 });
        } else {
          setRound((r) => r + 1);
          setFilled(null);
        }
      }, 1050);
    },
    [filled, done, current.answer.id, round, onComplete],
  );

  const reset = useCallback(() => {
    setRound(0);
    setFilled(null);
    setWobble(null);
    setDone(false);
  }, []);

  // The full row of slots: the prompt shapes + the "?"/filled slot.
  const slots = useMemo(() => current.prompt, [current.prompt]);

  return (
    <div
      className="panel relative mx-auto flex min-h-[460px] w-full max-w-[640px] flex-col gap-3 overflow-hidden p-4"
      style={{ touchAction: "none" }}
    >
      <style>{keyframes}</style>

      {/* Header: dots show progress (no text needed). */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2" aria-hidden>
          <span className="text-2xl">🧩</span>
          <span className="font-display text-lg" style={{ color: ACCENT }}>
            What comes next?
          </span>
        </div>
        <div className="flex items-center gap-1.5" aria-label={`Round ${solvedCount} of ${TOTAL}`}>
          {ROUNDS.map((_, i) => (
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

      {/* The pattern row. */}
      <div className="grid flex-1 place-items-center">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {slots.map((s, i) => (
            <PatternBox key={`${round}-${i}`} glyph={s.glyph} label={s.word} />
          ))}
          {/* The "?" / answer slot. */}
          <PatternBox
            glyph={filled ? filled.glyph : "❓"}
            label={filled ? filled.word : "what comes next"}
            isQuestion={!filled}
            isSolved={!!filled}
          />
        </div>
      </div>

      {/* Choices, or the celebration banner. */}
      {done ? (
        <div className="grid place-items-center gap-2 py-4 text-center" style={{ animation: "wcn-pop 0.5s ease both" }}>
          <div className="text-6xl" style={{ animation: "wcn-bounce 1s ease-in-out infinite" }}>
            🎉
          </div>
          <div className="flex gap-1 text-3xl" aria-label="Three stars, you did it">
            <span style={{ animation: "wcn-pop 0.4s 0.05s ease both" }}>⭐</span>
            <span style={{ animation: "wcn-pop 0.4s 0.2s ease both" }}>⭐</span>
            <span style={{ animation: "wcn-pop 0.4s 0.35s ease both" }}>⭐</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Choose what comes next">
          {current.choices.map((c) => {
            const isWobbling = wobble === c.id;
            const justPicked = filled?.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-label={`Choose ${c.word}`}
                disabled={!!filled}
                onClick={() => choose(c)}
                className="grid aspect-square min-h-[64px] place-items-center rounded-2xl border-2 text-5xl transition-transform active:scale-95 disabled:cursor-default sm:text-6xl"
                style={{
                  borderColor: justPicked ? ACCENT : "var(--color-line, #2a3340)",
                  background: justPicked ? "rgba(34,211,238,0.12)" : "var(--color-panel-2, #11161f)",
                  boxShadow: justPicked ? `0 0 18px ${ACCENT}` : "none",
                  animation: isWobbling
                    ? "wcn-wobble 0.45s ease"
                    : justPicked
                      ? "wcn-pop 0.4s ease both"
                      : undefined,
                  touchAction: "manipulation",
                }}
              >
                <span aria-hidden>{c.glyph}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Start over — big, always available. */}
      <div className="flex justify-center pt-1">
        <button
          type="button"
          aria-label="Start over"
          onClick={reset}
          className="flex items-center gap-2 rounded-xl border-2 px-5 py-3 font-display text-base active:scale-95"
          style={{ borderColor: "var(--color-line, #2a3340)", color: "var(--color-ink-dim, #9fb0c0)" }}
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

/** A single big square in the pattern row. */
function PatternBox({
  glyph,
  label,
  isQuestion = false,
  isSolved = false,
}: {
  glyph: string;
  label: string;
  isQuestion?: boolean;
  isSolved?: boolean;
}) {
  return (
    <div
      aria-label={label}
      className="grid h-[56px] w-[56px] place-items-center rounded-xl border-2 text-4xl sm:h-[64px] sm:w-[64px] sm:text-5xl"
      style={{
        borderColor: isQuestion || isSolved ? ACCENT : "var(--color-line, #2a3340)",
        background: isSolved ? "rgba(34,211,238,0.12)" : "var(--color-panel-2, #11161f)",
        boxShadow: isSolved ? `0 0 18px ${ACCENT}` : "none",
        borderStyle: isQuestion ? "dashed" : "solid",
        animation: isQuestion
          ? "wcn-glow 1.4s ease-in-out infinite"
          : isSolved
            ? "wcn-pop 0.45s ease both"
            : undefined,
      }}
    >
      <span aria-hidden>{glyph}</span>
    </div>
  );
}

const keyframes = `
@keyframes wcn-wobble {
  0%,100% { transform: translateX(0) rotate(0deg); }
  20% { transform: translateX(-7px) rotate(-5deg); }
  40% { transform: translateX(7px) rotate(5deg); }
  60% { transform: translateX(-5px) rotate(-3deg); }
  80% { transform: translateX(5px) rotate(3deg); }
}
@keyframes wcn-pop {
  0% { transform: scale(0.6); }
  60% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
@keyframes wcn-bounce {
  0%,100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}
@keyframes wcn-glow {
  0%,100% { box-shadow: 0 0 6px ${ACCENT}; transform: scale(1); }
  50% { box-shadow: 0 0 16px ${ACCENT}; transform: scale(1.06); }
}
@media (prefers-reduced-motion: reduce) {
  [style*="animation"] { animation: none !important; }
}
`;
