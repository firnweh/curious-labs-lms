"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Pattern Maker 🎨 ─────────────────────────────────────────────────────────
   JUNIORS (Grade 1, age ~6). Concept: find the repeating RULE of a pattern and
   continue it — the thinking behind LOOPS. A row of big colourful shape tiles
   begins a repeating pattern; the last cells are EMPTY. A palette below lets the
   child TAP shapes to fill the blanks, continuing the rule. Three rounds grow in
   difficulty: AB → ABB → ABC. A correct tap fills the next blank; a wrong tap
   gently shakes and does not advance. Finishing a round shows a quick "great!"
   and moves on. All three rounds done → onComplete({passed:true, stars:3}) once.
   Reset restarts at Round 1. NO READING REQUIRED — everything is shapes. */

const ACCENT = "#22d3ee";

/** A pattern shape — a big emoji glyph plus an aria word. */
interface Shape {
  /** Stable key for matching. */
  id: string;
  /** Big emoji glyph (no reading required). */
  glyph: string;
  /** aria word for screen readers. */
  word: string;
}

const RED: Shape = { id: "red", glyph: "🔴", word: "red circle" };
const BLUE: Shape = { id: "blue", glyph: "🔵", word: "blue circle" };
const GREEN: Shape = { id: "green", glyph: "🟢", word: "green circle" };
const YELLOW: Shape = { id: "yellow", glyph: "🟡", word: "yellow circle" };
const TRI: Shape = { id: "tri", glyph: "🔺", word: "red triangle" };
const SQUARE: Shape = { id: "square", glyph: "🟦", word: "blue square" };
const STAR: Shape = { id: "star", glyph: "⭐", word: "yellow star" };

interface Round {
  /** Shapes already shown (the start of the repeating pattern). */
  shown: Shape[];
  /** Shapes the child must place, in order, to continue the rule. */
  answer: Shape[];
  /** The palette tiles to tap (includes every answer shape + a distractor). */
  palette: Shape[];
}

/** Three rounds: AB, ABB, ABC — each leaves the tail blank to be filled. */
const ROUNDS: Round[] = [
  // 🔴🔵🔴🔵 _ _  → 🔴🔵
  {
    shown: [RED, BLUE, RED, BLUE],
    answer: [RED, BLUE],
    palette: [RED, BLUE, GREEN],
  },
  // 🟢🟡🟡🟢🟡🟡 _ _ _ → 🟢🟡🟡
  {
    shown: [GREEN, YELLOW, YELLOW, GREEN, YELLOW, YELLOW],
    answer: [GREEN, YELLOW, YELLOW],
    palette: [GREEN, YELLOW, RED],
  },
  // 🔺🟦⭐🔺🟦⭐ _ _ _ → 🔺🟦⭐
  {
    shown: [TRI, SQUARE, STAR, TRI, SQUARE, STAR],
    answer: [TRI, SQUARE, STAR],
    palette: [TRI, SQUARE, STAR],
  },
];

const TOTAL = ROUNDS.length;

export default function PatternMaker({ onComplete }: ActivityProps) {
  const [round, setRound] = useState<number>(0);
  /** Shapes placed into the blanks so far this round (in order). */
  const [placed, setPlaced] = useState<Shape[]>([]);
  /** Palette id currently shaking from a wrong tap. */
  const [shake, setShake] = useState<string | null>(null);
  /** True between rounds, while the "great!" cheer shows. */
  const [cheer, setCheer] = useState<boolean>(false);
  /** True once all rounds are solved — shows the big celebration. */
  const [done, setDone] = useState<boolean>(false);

  const reportedRef = useRef<boolean>(false);
  const shakeTimer = useRef<number | null>(null);
  const advanceTimer = useRef<number | null>(null);

  const current = ROUNDS[round];

  /** How many blanks are still empty this round. */
  const remaining = current.answer.length - placed.length;
  /** Progress dots: rounds fully solved before the current one. */
  const solvedRounds = done ? TOTAL : round;

  const tap = useCallback(
    (choice: Shape) => {
      if (done || cheer) return;
      const next = current.answer[placed.length];
      if (!next || choice.id !== next.id) {
        // Wrong shape → gentle shake, no penalty, no advance.
        setShake(choice.id);
        if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
        shakeTimer.current = window.setTimeout(() => setShake(null), 480);
        return;
      }
      // Correct → place it in the next blank.
      const nextPlaced = [...placed, choice];
      setPlaced(nextPlaced);
      if (nextPlaced.length >= current.answer.length) {
        // Round complete → quick cheer, then advance or finish.
        setCheer(true);
        if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current);
        advanceTimer.current = window.setTimeout(() => {
          if (round + 1 >= TOTAL) {
            setDone(true);
          } else {
            setRound((r) => r + 1);
            setPlaced([]);
            setCheer(false);
          }
        }, 1000);
      }
    },
    [done, cheer, current.answer, placed, round],
  );

  const reset = useCallback(() => {
    if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
    if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current);
    setRound(0);
    setPlaced([]);
    setShake(null);
    setCheer(false);
    setDone(false);
  }, []);

  // Report success exactly once when every round is solved.
  useEffect(() => {
    if (done && !reportedRef.current) {
      reportedRef.current = true;
      onComplete({ passed: true, stars: 3 });
    }
    if (!done) {
      reportedRef.current = false;
    }
  }, [done, onComplete]);

  useEffect(() => {
    return () => {
      if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
      if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current);
    };
  }, []);

  // The full row: shown shapes + one cell per answer slot (filled or blank).
  const cells = useMemo(() => {
    const blanks = current.answer.map((ans, i): { shape: Shape | null; isNext: boolean } => {
      const got = placed[i] ?? null;
      return { shape: got, isNext: !got && i === placed.length };
    });
    return { shown: current.shown, blanks };
  }, [current.shown, current.answer, placed]);

  // Status emoji (no reading): cheering, party, or "your turn".
  const statusEmoji = done ? "🎉" : cheer ? "🌟" : remaining > 0 ? "👇" : "✨";

  return (
    <div className="flex w-full flex-col gap-3">
      <style>{KEYFRAMES}</style>

      {/* Header: title + progress dots (one per round). */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2" aria-hidden>
          <span className="text-2xl">🎨</span>
          <span className="font-display text-lg font-bold" style={{ color: ACCENT }}>
            Pattern Maker
          </span>
        </div>
        <div
          className="flex items-center gap-1.5"
          aria-label={`Round ${Math.min(solvedRounds + (done ? 0 : 1), TOTAL)} of ${TOTAL}`}
        >
          {ROUNDS.map((_, i) => (
            <span
              key={i}
              className="block h-3 w-3 rounded-full transition-all"
              style={{
                background: i < solvedRounds ? ACCENT : "transparent",
                border: `2px solid ${i < solvedRounds ? ACCENT : "var(--color-line, #2a3340)"}`,
                boxShadow: i < solvedRounds ? `0 0 8px ${ACCENT}` : "none",
              }}
            />
          ))}
        </div>
      </div>

      {/* Canvas: the pattern row. */}
      <div className="panel relative overflow-hidden rounded-2xl border border-line p-2">
        <div className="grid min-h-[150px] place-items-center p-2">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
            {cells.shown.map((s, i) => (
              <Tile key={`shown-${round}-${i}`} glyph={s.glyph} label={s.word} kind="shown" />
            ))}
            {cells.blanks.map((b, i) =>
              b.shape ? (
                <Tile
                  key={`blank-${round}-${i}`}
                  glyph={b.shape.glyph}
                  label={b.shape.word}
                  kind="filled"
                />
              ) : (
                <Tile
                  key={`blank-${round}-${i}`}
                  glyph="➕"
                  label="empty cell"
                  kind={b.isNext ? "next" : "blank"}
                />
              ),
            )}
          </div>
        </div>

        {/* Emoji status line. */}
        <div
          className="mt-1 flex items-center justify-center gap-2 text-2xl"
          aria-live="polite"
          aria-label={done ? "All done!" : cheer ? "Great!" : "Tap a shape to keep the pattern going"}
        >
          <span aria-hidden="true">{statusEmoji}</span>
        </div>
      </div>

      {/* Palette OR the big celebration. */}
      {done ? (
        <div
          className="grid place-items-center gap-2 py-4 text-center"
          style={{ animation: "pm-pop 0.5s ease both" }}
        >
          <div className="text-6xl" style={{ animation: "pm-bounce 1s ease-in-out infinite" }}>
            🎉
          </div>
          <div className="flex gap-1.5 text-3xl" aria-label="Three stars, you did it">
            <span style={{ animation: "pm-pop 0.4s 0.05s ease both" }}>⭐</span>
            <span style={{ animation: "pm-pop 0.4s 0.20s ease both" }}>⭐</span>
            <span style={{ animation: "pm-pop 0.4s 0.35s ease both" }}>⭐</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Shape palette">
          {current.palette.map((c) => {
            const isShaking = shake === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-label={`Place ${c.word}`}
                disabled={cheer}
                onClick={() => tap(c)}
                className="grid aspect-square min-h-[64px] place-items-center rounded-2xl border-2 text-5xl transition-transform active:scale-95 disabled:opacity-60 sm:text-6xl"
                style={{
                  borderColor: "var(--color-line, #2a3340)",
                  background: "var(--color-panel-2, #11161f)",
                  animation: isShaking ? "pm-shake 0.45s ease" : undefined,
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
          className="font-display flex min-h-[52px] items-center gap-2 rounded-2xl border-2 border-line bg-panel/60 px-6 py-3 text-base font-bold text-ink-dim transition active:scale-95"
        >
          <span aria-hidden className="text-2xl">
            🔄
          </span>
        </button>
      </div>
    </div>
  );
}

type TileKind = "shown" | "filled" | "blank" | "next";

/** A single big square in the pattern row. */
function Tile({ glyph, label, kind }: { glyph: string; label: string; kind: TileKind }) {
  const filled = kind === "filled";
  const next = kind === "next";
  const empty = kind === "blank" || next;
  return (
    <div
      aria-label={label}
      className="grid h-[54px] w-[54px] place-items-center rounded-xl border-2 text-3xl sm:h-[62px] sm:w-[62px] sm:text-4xl"
      style={{
        borderColor: next || filled ? ACCENT : "var(--color-line, #2a3340)",
        borderStyle: empty ? "dashed" : "solid",
        background: filled ? "rgba(34,211,238,0.12)" : "var(--color-panel-2, #11161f)",
        boxShadow: filled ? `0 0 16px ${ACCENT}` : "none",
        opacity: kind === "blank" ? 0.45 : 1,
        animation: next
          ? "pm-glow 1.4s ease-in-out infinite"
          : filled
            ? "pm-pop 0.45s ease both"
            : undefined,
      }}
    >
      <span aria-hidden style={{ opacity: empty ? 0.55 : 1 }}>
        {empty ? "➕" : glyph}
      </span>
    </div>
  );
}

const KEYFRAMES = `
@keyframes pm-shake {
  0%,100% { transform: translateX(0) rotate(0deg); }
  20% { transform: translateX(-7px) rotate(-5deg); }
  40% { transform: translateX(7px) rotate(5deg); }
  60% { transform: translateX(-5px) rotate(-3deg); }
  80% { transform: translateX(5px) rotate(3deg); }
}
@keyframes pm-pop {
  0% { transform: scale(0.6); }
  60% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
@keyframes pm-bounce {
  0%,100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}
@keyframes pm-glow {
  0%,100% { box-shadow: 0 0 6px ${ACCENT}; transform: scale(1); }
  50% { box-shadow: 0 0 16px ${ACCENT}; transform: scale(1.06); }
}
@media (prefers-reduced-motion: reduce) {
  [style*="animation"] { animation: none !important; }
}
`;
