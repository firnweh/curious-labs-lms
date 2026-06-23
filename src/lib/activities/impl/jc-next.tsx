"use client";
import type { ActivityProps } from "@/lib/activities/types";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

/* ── What Comes Next? 🔁 ──────────────────────────────────────────────────────
   CLASS 1-3 lab (juniors, age ~6-8). ONE learning goal: patterns REPEAT — find
   the rule, then PLAN and continue it (the thinking behind LOOPS). But this is
   now a real PROBLEM, not a one-tap lucky guess: each row has MORE THAN ONE empty
   slot, and the child must fill them IN ORDER from a shared tray of choice tiles
   (which always holds a wrong "decoy" tile too). To win a round you must read the
   rule and place every slot correctly in sequence — random tapping almost never
   works. Three growing rounds:
     • R1  🟥🟦🟥🟦 ❓❓        → 🟥 🟦   (ABAB, fill the next two)
     • R2  🍎🍎🍌🍌 ❓❓❓       → 🍎 🍎 🍌  (AABB, fill the next three)
     • R3  ⭐❤️🌙 ⭐ ❓ 🌙 ❓      → ❤️ … ⭐  (ABC ABC, but the GAPS are in the
                                          MIDDLE — "copy the last tile" fails,
                                          you must reason about cycle position)
   Each correct tile pops into its slot with a sparkle; a wrong tap gives a gentle
   wobble + 🙈 and an easy retry, never a hard fail. All three solved →
   onComplete({passed:true, stars:3}) ONCE. NO READING NEEDED — all emoji, colour
   and big shapes. Reset (🔄) restarts at Round 1. Accent #22d3ee. */

const ACCENT = "#22d3ee";

/** One pattern tile — a big emoji glyph plus an aria word (for screen readers). */
interface Item {
  id: string;
  glyph: string;
  word: string;
}

const APPLE: Item = { id: "apple", glyph: "🍎", word: "apple" };
const BANANA: Item = { id: "banana", glyph: "🍌", word: "banana" };
const RED: Item = { id: "red", glyph: "🟥", word: "red square" };
const BLUE: Item = { id: "blue", glyph: "🟦", word: "blue square" };
const STAR: Item = { id: "star", glyph: "⭐", word: "star" };
const HEART: Item = { id: "heart", glyph: "❤️", word: "heart" };
const MOON: Item = { id: "moon", glyph: "🌙", word: "moon" };
const GRAPE: Item = { id: "grape", glyph: "🍇", word: "grapes" };

/** A cell in the pattern row: either a tile that is already shown, or a blank
 *  slot the child must fill. Blanks are filled IN ORDER (left to right). */
type Cell = { kind: "shown"; item: Item } | { kind: "blank"; want: Item };

interface Round {
  /** The whole row, left to right — fixed tiles and the blanks to fill. */
  row: Cell[];
  /** The shared tray of choice tiles (always includes every needed tile
   *  PLUS one wrong decoy, so it is never a 1-of-2 coin-flip). */
  tray: Item[];
}

/** Helper builders keep the round table short and readable. */
const show = (item: Item): Cell => ({ kind: "shown", item });
const blank = (want: Item): Cell => ({ kind: "blank", want });

/** Three growing rounds. Each needs the child to PLAN the continuation, then
 *  place several tiles in the right order — luck can't carry it.
 *  Round 3's twist: the blanks sit in the MIDDLE of the row, so "copy the tile
 *  just before / the last tile" fails and the child must reason about where in
 *  the ⭐❤️🌙 cycle each gap falls. */
const ROUNDS: Round[] = [
  // R1 — ABAB, fill the next TWO: 🟥🟦🟥🟦 [🟥][🟦]
  {
    row: [show(RED), show(BLUE), show(RED), show(BLUE), blank(RED), blank(BLUE)],
    tray: [RED, BLUE, GRAPE],
  },
  // R2 — AABB, fill the next THREE: 🍎🍎🍌🍌 [🍎][🍎][🍌]
  {
    row: [
      show(APPLE),
      show(APPLE),
      show(BANANA),
      show(BANANA),
      blank(APPLE),
      blank(APPLE),
      blank(BANANA),
    ],
    tray: [APPLE, BANANA, GRAPE],
  },
  // R3 — ABC ABC, but the GAPS are in the MIDDLE: ⭐ [❤️] 🌙 ⭐ [❤️] 🌙
  {
    row: [
      show(STAR),
      blank(HEART),
      show(MOON),
      show(STAR),
      blank(HEART),
      show(MOON),
    ],
    tray: [STAR, HEART, MOON],
  },
];

const TOTAL = ROUNDS.length;

/** Indices of the blank cells in a row, left to right. */
function blankIndices(row: Cell[]): number[] {
  const out: number[] = [];
  row.forEach((c, i) => {
    if (c.kind === "blank") out.push(i);
  });
  return out;
}

/** Soft blip (tap) / happy chime (win) — created on the gesture, never throws. */
function playTone(win: boolean): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = win ? [523.25, 659.25, 783.99] : [440];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.24);
    });
    window.setTimeout(() => void ctx.close().catch(() => undefined), 700);
  } catch {
    /* sound is a nice-to-have; never let it block or throw */
  }
}

/** A short, friendly tap blip for a CORRECT placement that is not the last one. */
function playStep(step: number): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    // rising ladder as the child fills more slots → a sense of building progress
    osc.frequency.value = 523.25 + step * 90;
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.22);
    window.setTimeout(() => void ctx.close().catch(() => undefined), 500);
  } catch {
    /* sound is a nice-to-have; never let it block or throw */
  }
}

export default function WhatComesNext({ onComplete }: ActivityProps) {
  const [round, setRound] = useState<number>(0);
  /** How many of this round's blanks are already filled (left to right). */
  const [progress, setProgress] = useState<number>(0);
  /** Tray choice id currently wobbling from a wrong tap. */
  const [wobble, setWobble] = useState<string | null>(null);
  /** True between rounds, while the quick cheer shows. */
  const [cheer, setCheer] = useState<boolean>(false);
  /** True once all rounds are solved — shows the big celebration. */
  const [done, setDone] = useState<boolean>(false);

  const reportedRef = useRef<boolean>(false);
  const wobbleTimer = useRef<number | null>(null);
  const advanceTimer = useRef<number | null>(null);

  const current = ROUNDS[round];
  const blanks = blankIndices(current.row);
  const totalBlanks = blanks.length;
  const solvedRounds = done ? TOTAL : round;

  /** The next blank the child must fill (cell index), or -1 when the row is full. */
  const nextBlankIndex = progress < totalBlanks ? blanks[progress] : -1;
  const nextWantId =
    nextBlankIndex >= 0 && current.row[nextBlankIndex].kind === "blank"
      ? (current.row[nextBlankIndex] as { kind: "blank"; want: Item }).want.id
      : null;

  const clearTimers = useCallback(() => {
    if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
    if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current);
    wobbleTimer.current = null;
    advanceTimer.current = null;
  }, []);

  const tap = useCallback(
    (choice: Item) => {
      if (done || cheer) return;
      if (progress >= totalBlanks) return; // row already complete

      if (choice.id !== nextWantId) {
        // Wrong tile → gentle wobble, no penalty, easy retry. No onComplete spam.
        setWobble(choice.id);
        if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
        wobbleTimer.current = window.setTimeout(() => setWobble(null), 480);
        playTone(false);
        return;
      }

      // Correct → snap it into the next slot.
      const nextProgress = progress + 1;
      const roundComplete = nextProgress >= totalBlanks;
      const lastRound = round + 1 >= TOTAL;

      if (!roundComplete) {
        // Mid-row: rising blip, keep going.
        setProgress(nextProgress);
        playStep(nextProgress);
        return;
      }

      // Final slot of this round filled → cheer, then advance / finish.
      setProgress(nextProgress);
      setCheer(true);
      playTone(true);
      if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current);
      advanceTimer.current = window.setTimeout(() => {
        if (lastRound) {
          setDone(true);
        } else {
          setRound((r) => r + 1);
          setProgress(0);
          setCheer(false);
        }
      }, 1050);
    },
    [done, cheer, progress, totalBlanks, nextWantId, round],
  );

  const reset = useCallback(() => {
    clearTimers();
    reportedRef.current = false;
    setRound(0);
    setProgress(0);
    setWobble(null);
    setCheer(false);
    setDone(false);
  }, [clearTimers]);

  // Report success exactly once when every round is solved.
  useEffect(() => {
    if (done && !reportedRef.current) {
      reportedRef.current = true;
      onComplete({ passed: true, stars: 3, detail: "You finished every pattern! 🎉" });
    }
  }, [done, onComplete]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono text-ink">
      <style>{KEYFRAMES}</style>

      {/* ── Tiny visual status (emoji + progress dots, no sentences) ── */}
      <div className="flex w-full max-w-[460px] items-center justify-between px-1">
        <div
          className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
          role="status"
          aria-live="polite"
          aria-label={done ? "You did it!" : cheer ? "Great!" : "Fill the empty squares in order"}
          style={{
            background: done ? "rgba(34,211,238,0.14)" : "rgba(255,255,255,0.04)",
            border: `2px solid ${done ? ACCENT : "var(--color-line, #33405c)"}`,
            boxShadow: done ? `0 0 18px ${ACCENT}66` : undefined,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              animation: done
                ? "jcnext-pulse 0.8s ease-in-out infinite"
                : cheer
                  ? "jcnext-pop 0.4s ease both"
                  : "jcnext-breathe 2.6s ease-in-out infinite",
            }}
          >
            {done ? "🎉" : cheer ? "🌟" : "🔁"}
          </span>
          {done ? (
            <span aria-hidden="true">⭐⭐⭐</span>
          ) : (
            <span
              aria-hidden="true"
              className="text-xl"
              style={{ display: "inline-block", animation: "jcnext-bob 1.6s ease-in-out infinite" }}
            >
              👇
            </span>
          )}
        </div>

        {/* per-round step dots: one pip per blank, filled as the child places tiles */}
        {!done && !cheer && (
          <div
            className="flex items-center gap-1.5"
            aria-hidden="true"
            aria-label={`${progress} of ${totalBlanks} filled`}
          >
            {blanks.map((_, i) => (
              <span
                key={i}
                className="block h-2.5 w-2.5 rounded-full transition-all"
                style={{
                  background: i < progress ? ACCENT : "transparent",
                  border: `2px solid ${i < progress ? ACCENT : "var(--color-line, #2a3340)"}`,
                  boxShadow: i < progress ? `0 0 6px ${ACCENT}` : "none",
                  animation: i === progress ? "jcnext-glow 1.4s ease-in-out infinite" : undefined,
                }}
              />
            ))}
          </div>
        )}

        {/* round-progress dots (which of the 3 rounds are solved) */}
        <div className="flex items-center gap-1.5" aria-label={`Round ${Math.min(solvedRounds + 1, TOTAL)} of ${TOTAL}`}>
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

      {/* ── The pattern row: shown tiles + the empty slots (filled in order) ── */}
      <div className="panel relative w-full max-w-[460px] overflow-hidden rounded-2xl border border-line p-3">
        <div className="grid min-h-[110px] place-items-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {current.row.map((cell, i) => {
              if (cell.kind === "shown") {
                return (
                  <PatternTile
                    key={`shown-${round}-${i}`}
                    glyph={cell.item.glyph}
                    label={cell.item.word}
                    kind="shown"
                  />
                );
              }
              // blank cell — its order among blanks tells us if it's filled / active
              const order = blanks.indexOf(i);
              if (order < progress) {
                return (
                  <PatternTile
                    key={`fill-${round}-${i}`}
                    glyph={cell.want.glyph}
                    label={cell.want.word}
                    kind="filled"
                  />
                );
              }
              const active = order === progress && !cheer && !done;
              return (
                <PatternTile
                  key={`empty-${round}-${i}`}
                  glyph={active ? "❓" : "▫️"}
                  label={active ? "this empty square is next" : "empty square"}
                  kind={active ? "empty" : "waiting"}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Big choice tiles (shared tray with a decoy) OR the big celebration ── */}
      {done ? (
        <div
          className="relative grid w-full max-w-[460px] place-items-center gap-2 py-4 text-center"
          style={{ animation: "jcnext-pop 0.5s ease both" }}
        >
          <Confetti />
          <div
            className="relative text-6xl"
            style={{ animation: "jcnext-dance 1.1s cubic-bezier(.34,1.56,.64,1) infinite", transformOrigin: "center bottom" }}
            aria-hidden="true"
          >
            🥳
          </div>
          <div className="flex gap-1.5 text-4xl" aria-label="Three stars, you did it">
            <span
              aria-hidden="true"
              style={{ display: "inline-block", animation: "jcnext-star 0.5s 0.15s cubic-bezier(.34,1.56,.64,1) both" }}
            >
              ⭐
            </span>
            <span
              aria-hidden="true"
              style={{ display: "inline-block", animation: "jcnext-star 0.5s 0.40s cubic-bezier(.34,1.56,.64,1) both" }}
            >
              ⭐
            </span>
            <span
              aria-hidden="true"
              style={{ display: "inline-block", animation: "jcnext-star 0.5s 0.65s cubic-bezier(.34,1.56,.64,1) both" }}
            >
              ⭐
            </span>
          </div>
          <div className="flex justify-center gap-2 text-3xl">
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
        </div>
      ) : (
        <div
          className="grid w-full max-w-[460px] gap-3"
          style={{ gridTemplateColumns: `repeat(${current.tray.length}, minmax(0, 1fr))` }}
          aria-label="Choices — tap the tile that fills the next empty square"
        >
          {current.tray.map((c, ci) => {
            const isWobbling = wobble === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-label={`Pick ${c.word}`}
                disabled={cheer || progress >= totalBlanks}
                onPointerDown={(e) => {
                  e.preventDefault();
                  tap(c);
                }}
                className="grid aspect-square min-h-[72px] place-items-center rounded-2xl text-5xl transition-transform duration-200 [transition-timing-function:cubic-bezier(.34,1.56,.64,1)] active:scale-90 disabled:opacity-50 sm:text-6xl"
                style={{
                  touchAction: "manipulation",
                  background: "rgba(34,211,238,0.10)",
                  border: `2px solid ${ACCENT}`,
                  boxShadow: `0 6px 0 0 #0e8aa0`,
                  animation: isWobbling
                    ? "jcnext-wobble 0.46s ease"
                    : "jcnext-breathe 2.8s ease-in-out infinite",
                  animationDelay: isWobbling ? undefined : `${ci * 0.35}s`,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    animation: isWobbling ? undefined : "jcnext-bounce 2.8s ease-in-out infinite",
                    animationDelay: isWobbling ? undefined : `${ci * 0.35 + 0.15}s`,
                  }}
                >
                  {isWobbling ? "🙈" : c.glyph}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Reset — big, friendly, always available ── */}
      <button
        type="button"
        aria-label="Start over"
        onPointerDown={(e) => {
          e.preventDefault();
          reset();
        }}
        className="grid h-[60px] w-[60px] place-items-center rounded-2xl text-2xl transition active:scale-90"
        style={{
          touchAction: "none",
          background: "rgba(255,255,255,0.05)",
          border: "2px solid var(--color-line, #33405c)",
        }}
      >
        <span aria-hidden="true">🔄</span>
      </button>
    </div>
  );
}

type TileKind = "shown" | "filled" | "empty" | "waiting";

/** One big square in the pattern row.
 *  - shown   : a fixed pattern tile
 *  - filled  : a blank the child correctly filled (snaps in, glowing)
 *  - empty   : the blank that is NEXT to fill (active ❓, glowing dashed)
 *  - waiting : a later blank, not yet active (dim dashed placeholder) */
function PatternTile({ glyph, label, kind }: { glyph: string; label: string; kind: TileKind }) {
  const filled = kind === "filled";
  const empty = kind === "empty";
  const waiting = kind === "waiting";
  return (
    <div
      aria-label={label}
      className="grid h-[54px] w-[54px] place-items-center rounded-xl border-2 text-3xl sm:h-[60px] sm:w-[60px] sm:text-4xl"
      style={{
        borderColor: empty || filled ? ACCENT : waiting ? "rgba(120,140,170,0.35)" : "var(--color-line, #2a3340)",
        borderStyle: empty || waiting ? "dashed" : "solid",
        background: filled ? "rgba(34,211,238,0.14)" : "var(--color-panel-2, #11161f)",
        boxShadow: filled ? `0 0 16px ${ACCENT}` : "none",
        opacity: waiting ? 0.45 : 1,
        animation: empty
          ? "jcnext-glow 1.4s ease-in-out infinite"
          : filled
            ? "jcnext-snap 0.55s cubic-bezier(.34,1.56,.64,1) both"
            : undefined,
      }}
    >
      <span aria-hidden="true">{glyph}</span>
    </div>
  );
}

/** A one-shot burst of confetti for the win celebration — pure transform/opacity. */
const CONFETTI_PIECES: { glyph: string; cx: number; cy: number; cr: number; delay: number }[] = [
  { glyph: "🎉", cx: -120, cy: -60, cr: -120, delay: 0 },
  { glyph: "✨", cx: 120, cy: -50, cr: 140, delay: 0.05 },
  { glyph: "⭐", cx: -90, cy: 70, cr: -90, delay: 0.1 },
  { glyph: "🎊", cx: 100, cy: 80, cr: 120, delay: 0.08 },
  { glyph: "💫", cx: -150, cy: 10, cr: -160, delay: 0.12 },
  { glyph: "🌟", cx: 150, cy: 20, cr: 160, delay: 0.06 },
  { glyph: "🎈", cx: -40, cy: -110, cr: -40, delay: 0.15 },
  { glyph: "✨", cx: 50, cy: -100, cr: 60, delay: 0.18 },
  { glyph: "⭐", cx: -70, cy: 110, cr: -70, delay: 0.22 },
  { glyph: "🎉", cx: 80, cy: 120, cr: 100, delay: 0.2 },
  { glyph: "💫", cx: -130, cy: -20, cr: -140, delay: 0.25 },
  { glyph: "🌟", cx: 130, cy: -30, cr: 150, delay: 0.28 },
];

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center" aria-hidden="true">
      {CONFETTI_PIECES.map((p, i) => (
        <span
          key={i}
          className="absolute text-2xl"
          style={
            {
              "--cx": `${p.cx}px`,
              "--cy": `${p.cy}px`,
              "--cr": `${p.cr}deg`,
              animation: `jcnext-confetti 1.1s ${p.delay}s cubic-bezier(.22,.61,.36,1) both`,
            } as CSSProperties
          }
        >
          {p.glyph}
        </span>
      ))}
    </div>
  );
}

const KEYFRAMES = `
@keyframes jcnext-wobble {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  20% { transform: translateX(-7px) rotate(-6deg); }
  45% { transform: translateX(7px) rotate(6deg); }
  70% { transform: translateX(-5px) rotate(-4deg); }
  90% { transform: translateX(4px) rotate(3deg); }
}
@keyframes jcnext-pop {
  0% { transform: scale(0.6); }
  60% { transform: scale(1.18); }
  100% { transform: scale(1); }
}
/* Springy snap-in: a placed part drops into its slot and bounces to rest. */
@keyframes jcnext-snap {
  0% { transform: translateY(-22px) scale(0.5); opacity: 0; }
  55% { transform: translateY(0) scale(1.22); opacity: 1; }
  72% { transform: translateY(-4px) scale(0.94); }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes jcnext-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}
/* Big happy hop with a touch of squash-and-stretch for the win character. */
@keyframes jcnext-dance {
  0% { transform: translateY(0) scale(1, 1) rotate(0deg); }
  18% { transform: translateY(0) scale(1.15, 0.85); }
  42% { transform: translateY(-26px) scale(0.9, 1.12) rotate(-7deg); }
  62% { transform: translateY(-26px) scale(0.95, 1.08) rotate(7deg); }
  82% { transform: translateY(0) scale(1.12, 0.9); }
  100% { transform: translateY(0) scale(1, 1) rotate(0deg); }
}
/* Slow "breathing" idle so the waiting screen never feels frozen. */
@keyframes jcnext-breathe {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-4px) scale(1.06); }
}
/* Gentle continuous bob for the prompt cue. */
@keyframes jcnext-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(4px); }
}
@keyframes jcnext-glow {
  0%, 100% { box-shadow: 0 0 6px ${ACCENT}; transform: scale(1); }
  50% { box-shadow: 0 0 16px ${ACCENT}; transform: scale(1.07); }
}
/* Pulsing glow + tiny throb for the celebration trophy badge. */
@keyframes jcnext-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.12); }
}
/* Stars pop in one at a time with a bouncy overshoot. */
@keyframes jcnext-star {
  0% { transform: scale(0) rotate(-30deg); opacity: 0; }
  55% { transform: scale(1.4) rotate(10deg); opacity: 1; }
  75% { transform: scale(0.9) rotate(-4deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
/* Confetti bursting outward then drifting down as it fades. */
@keyframes jcnext-confetti {
  0% { transform: translate(0, 0) scale(0.3) rotate(0deg); opacity: 0; }
  15% { opacity: 1; }
  100% { transform: translate(var(--cx), var(--cy)) scale(1) rotate(var(--cr)); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  [style*="jcnext-breathe"],
  [style*="jcnext-bob"],
  [style*="jcnext-glow"],
  [style*="jcnext-bounce"],
  [style*="jcnext-dance"],
  [style*="jcnext-pulse"],
  [style*="jcnext-confetti"],
  .animate-float {
    animation: none !important;
  }
}
`;
