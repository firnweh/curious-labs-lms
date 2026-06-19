"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Story Blocks 🎬 ──────────────────────────────────────────────────────────
   JUNIOR (Grade 2, age ~7) CODING lab. Concept: SEQUENCING — instructions run
   in the ORDER you place them. A ScratchJr-style cat 🐱 stands on a small stage.
   A TARGET story is shown as a row of block icons (e.g. Walk ➡️, Jump ⤴️, Say 💬).
   The child taps blocks from the palette to fill a SEQUENCE strip so it matches
   the target, then presses PLAY ▶ — the cat performs each block in order with a
   little animation. When the played sequence matches the target → big
   celebration + onComplete({passed:true, stars:3}) once. A non-matching play is
   a gentle "almost!" nudge, never a scold, and is always fixable with Undo /
   Reset. The blocks read from VISUALS alone — no reading required.

   The intended story (3 blocks): Walk ➡️, Jump ⤴️, Say 💬. */

const ACCENT = "#22d3ee";
const STEP_MS = 720;

/** The five ScratchJr-style command blocks. */
type BlockId = "walk" | "jump" | "spin" | "say" | "meow";

interface BlockDef {
  id: BlockId;
  glyph: string;
  word: string;
}

const BLOCKS: Record<BlockId, BlockDef> = {
  walk: { id: "walk", glyph: "➡️", word: "Walk" },
  jump: { id: "jump", glyph: "⤴️", word: "Jump" },
  spin: { id: "spin", glyph: "🔄", word: "Spin" },
  say: { id: "say", glyph: "💬", word: "Say hi" },
  meow: { id: "meow", glyph: "🔊", word: "Meow" },
};

/** Palette order shown to the child. */
const PALETTE: readonly BlockId[] = ["walk", "jump", "spin", "say", "meow"];

/** The target story to recreate, in order. */
const TARGET: readonly BlockId[] = ["walk", "jump", "say"];

/** A placed block in the sequence strip — id-stamped so React keys stay stable. */
interface Slot {
  uid: number;
  block: BlockId;
}
let UID = 1;
const nextId = (): number => UID++;

type Phase = "build" | "playing" | "won" | "almost";

/** What the cat is doing on stage right now (drives the animation). */
type Action = BlockId | "idle";

export default function StoryBlocks({ onComplete }: ActivityProps) {
  const [seq, setSeq] = useState<Slot[]>([]);
  const [phase, setPhase] = useState<Phase>("build");
  const [playIdx, setPlayIdx] = useState<number>(-1); // which slot is performing
  const [action, setAction] = useState<Action>("idle");
  const [bubble, setBubble] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportedRef = useRef<boolean>(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => () => clearTimer(), [clearTimer]);

  const playing = phase === "playing";
  const won = phase === "won";
  const almost = phase === "almost";
  const locked = playing || won;

  const restStage = useCallback(() => {
    setPlayIdx(-1);
    setAction("idle");
    setBubble(null);
  }, []);

  const addBlock = useCallback(
    (block: BlockId) => {
      if (locked) return;
      setSeq((s) => (s.length >= TARGET.length ? s : [...s, { uid: nextId(), block }]));
      setPhase("build");
      restStage();
    },
    [locked, restStage],
  );

  const undo = useCallback(() => {
    if (locked) return;
    setSeq((s) => s.slice(0, -1));
    setPhase("build");
    restStage();
  }, [locked, restStage]);

  const reset = useCallback(() => {
    clearTimer();
    reportedRef.current = false;
    setSeq([]);
    setPhase("build");
    restStage();
  }, [clearTimer, restStage]);

  const play = useCallback(() => {
    if (locked) return;
    if (seq.length === 0) {
      // Empty isn't a "mistake" — a gentle nudge, then settle.
      setPhase("almost");
      clearTimer();
      timerRef.current = setTimeout(() => setPhase("build"), 600);
      return;
    }

    const program: BlockId[] = seq.map((s) => s.block);
    const matches =
      program.length === TARGET.length && program.every((b, i) => b === TARGET[i]);

    clearTimer();
    restStage();
    setPhase("playing");

    let i = 0;
    const tick = (): void => {
      if (i >= program.length) {
        // Whole story has played — judge the result.
        setAction("idle");
        setBubble(null);
        setPlayIdx(-1);
        if (matches) {
          setPhase("won");
          if (!reportedRef.current) {
            reportedRef.current = true;
            onComplete({
              passed: true,
              stars: 3,
              detail: "Your story played in the right order! 🎬",
            });
          }
        } else {
          setPhase("almost");
          onComplete({
            passed: false,
            detail: "So close! Match the story blocks in the same order. 🐱",
          });
          timerRef.current = setTimeout(() => setPhase("build"), 900);
        }
        return;
      }
      const block = program[i];
      setPlayIdx(i);
      setAction(block);
      setBubble(block === "say" ? "Hi!" : block === "meow" ? "Meow!" : null);
      i += 1;
      timerRef.current = setTimeout(tick, STEP_MS);
    };

    timerRef.current = setTimeout(tick, 220);
  }, [locked, seq, clearTimer, restStage, onComplete]);

  // The cat's horizontal drift: each performed "walk" nudges it rightward.
  const walkSteps = useMemo<number>(() => {
    if (playIdx < 0) return 0;
    let n = 0;
    for (let i = 0; i <= playIdx && i < seq.length; i += 1) {
      if (seq[i].block === "walk") n += 1;
    }
    return n;
  }, [playIdx, seq]);

  const catX = won ? 22 : Math.min(walkSteps, 3) * 18; // px, gentle drift
  const catAnim =
    action === "idle"
      ? won
        ? "g2scratchstory-cheer 0.7s ease-out"
        : undefined
      : action === "jump"
        ? "g2scratchstory-jump 0.7s ease-in-out"
        : action === "spin"
          ? "g2scratchstory-spin 0.7s ease-in-out"
          : action === "walk"
            ? "g2scratchstory-walk 0.7s ease-in-out"
            : "g2scratchstory-bob 0.7s ease-in-out"; // say / meow

  const statusEmoji = won ? "🎉" : almost ? "🤏" : playing ? "🎬" : "🐱";
  const statusLabel = won
    ? "You did it! The story played in order."
    : playing
      ? "The cat is acting out your story."
      : almost
        ? "Almost — try matching the order."
        : "Build the story to match the target, then press Play.";

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono text-ink">
      <style>{KEYFRAMES}</style>

      {/* ── Tiny visual status ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={statusLabel}
        style={{
          background: won ? "rgba(34,211,238,0.14)" : "rgba(255,255,255,0.04)",
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
            🐱🎬
          </span>
        )}
        {won && (
          <span aria-hidden="true" className="text-2xl">
            ✨
          </span>
        )}
      </div>

      {/* ── TARGET story to copy ── */}
      <div className="flex w-full max-w-[420px] flex-col items-center gap-1">
        <span className="text-xs font-bold uppercase tracking-wide opacity-60" aria-hidden="true">
          Make this story
        </span>
        <div
          className="flex flex-wrap items-center justify-center gap-1.5 rounded-2xl px-3 py-2"
          style={{ background: "rgba(255,255,255,0.04)", border: "2px solid var(--color-line, #33405c)" }}
          aria-label={`Target story: ${TARGET.map((b) => BLOCKS[b].word).join(", then ")}`}
        >
          {TARGET.map((b, i) => (
            <span key={`tgt-${i}`} className="flex items-center gap-1">
              <BlockChip block={BLOCKS[b]} tone="target" />
              {i < TARGET.length - 1 && (
                <span aria-hidden="true" className="text-sm opacity-40">
                  →
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* ── The stage ── */}
      <div className="panel relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-line">
        <svg
          viewBox="0 0 320 150"
          className="block w-full select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="A small stage with a cat character that acts out the story"
        >
          <defs>
            <linearGradient id="g2ss-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10243a" />
              <stop offset="100%" stopColor="#0b1626" />
            </linearGradient>
            <radialGradient id="g2ss-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.85" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* backdrop */}
          <rect x={0} y={0} width={320} height={150} fill="url(#g2ss-sky)" />
          <rect x={0} y={118} width={320} height={32} fill="rgba(34,211,238,0.10)" />
          <line x1={0} y1={118} x2={320} y2={118} stroke={ACCENT} strokeWidth={1.5} opacity={0.5} />

          {/* tiny twinkles */}
          {[34, 92, 168, 240, 290].map((x, i) => (
            <text
              key={`star-${i}`}
              x={x}
              y={22 + (i % 2) * 14}
              fontSize={i % 2 === 0 ? 11 : 8}
              textAnchor="middle"
              opacity={0.6}
              aria-hidden="true"
            >
              ✦
            </text>
          ))}

          {/* glow under the cat when celebrating */}
          {won && <circle cx={160 + catX} cy={104} r={44} fill="url(#g2ss-glow)" />}

          {/* speech bubble */}
          {bubble !== null && (
            <g
              style={{ transformOrigin: "center", animation: "g2scratchstory-pop 0.3s ease-out" }}
              aria-hidden="true"
            >
              <rect
                x={170 + catX}
                y={42}
                width={64}
                height={26}
                rx={12}
                fill="#0b1220"
                stroke={ACCENT}
                strokeWidth={1.5}
              />
              <text
                x={202 + catX}
                y={56}
                fontSize={13}
                fill={ACCENT}
                textAnchor="middle"
                dominantBaseline="central"
                fontWeight="bold"
              >
                {bubble}
              </text>
            </g>
          )}

          {/* the cat */}
          <g
            style={{
              transform: `translateX(${catX}px)`,
              transition: "transform 0.5s ease-in-out",
            }}
          >
            <g
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                animation: catAnim,
              }}
            >
              <ellipse cx={160} cy={116} rx={20} ry={5} fill="rgba(0,0,0,0.35)" />
              <text
                x={160}
                y={96}
                fontSize={48}
                textAnchor="middle"
                dominantBaseline="central"
                aria-label="cat"
              >
                🐱
              </text>
            </g>
          </g>
        </svg>
      </div>

      {/* ── SEQUENCE strip the child builds ── */}
      <div
        className="flex min-h-[56px] w-full max-w-[420px] items-center justify-center gap-2 rounded-2xl px-3 py-2"
        style={{ background: "rgba(255,255,255,0.04)", border: "2px dashed var(--color-line, #33405c)" }}
        aria-label="Your story sequence"
      >
        {Array.from({ length: TARGET.length }).map((_, i) => {
          const slot = seq[i];
          const isNext = !slot && i === seq.length;
          const isActive = playing && playIdx === i;
          if (slot) {
            return (
              <span
                key={slot.uid}
                aria-label={`Step ${i + 1}: ${BLOCKS[slot.block].word}`}
                style={{
                  animation: isActive ? "g2scratchstory-pop 0.4s ease-out" : undefined,
                }}
              >
                <BlockChip
                  block={BLOCKS[slot.block]}
                  tone={isActive ? "active" : "placed"}
                />
              </span>
            );
          }
          return (
            <span
              key={`empty-${i}`}
              aria-label={`Step ${i + 1}: empty`}
              className="grid h-[46px] w-[46px] place-items-center rounded-xl text-xl"
              style={{
                border: `2px dashed ${isNext ? ACCENT : "var(--color-line, #33405c)"}`,
                opacity: isNext ? 1 : 0.5,
                animation: isNext ? "g2scratchstory-glow 1.4s ease-in-out infinite" : undefined,
              }}
            >
              <span aria-hidden="true" className="opacity-50">
                +
              </span>
            </span>
          );
        })}
      </div>

      {/* ── Block palette ── */}
      <div className="grid w-full max-w-[420px] grid-cols-5 gap-1.5" aria-label="Block palette">
        {PALETTE.map((id) => {
          const def = BLOCKS[id];
          const full = seq.length >= TARGET.length;
          return (
            <button
              key={id}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                addBlock(id);
              }}
              disabled={locked || full}
              aria-label={`Add ${def.word} block`}
              className="flex flex-col items-center gap-0.5 rounded-2xl px-1 py-2 transition active:scale-90 disabled:opacity-40"
              style={{
                touchAction: "none",
                background: "rgba(34,211,238,0.10)",
                border: `2px solid ${ACCENT}`,
                color: ACCENT,
              }}
            >
              <span aria-hidden="true" className="text-2xl leading-none">
                {def.glyph}
              </span>
              <span aria-hidden="true" className="text-[9px] font-bold leading-none">
                {def.word}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Controls: Undo · PLAY · Reset ── */}
      <div className="flex w-full max-w-[420px] items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            undo();
          }}
          disabled={locked || seq.length === 0}
          aria-label="Remove the last block"
          className="grid h-[60px] w-[60px] place-items-center rounded-2xl text-2xl transition active:scale-90 disabled:opacity-30"
          style={{
            touchAction: "none",
            background: "rgba(255,255,255,0.05)",
            border: "2px solid var(--color-line, #33405c)",
          }}
        >
          <span aria-hidden="true">↩️</span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            play();
          }}
          disabled={locked}
          aria-label="Play — make the cat act out your story"
          className="flex h-[60px] flex-1 items-center justify-center gap-2 rounded-2xl text-2xl font-bold transition active:scale-95 disabled:opacity-50"
          style={{
            touchAction: "none",
            background: ACCENT,
            color: "#060810",
            boxShadow: "0 6px 0 0 #0e8aa0",
          }}
        >
          <span aria-hidden="true">{playing ? "🎬" : "▶"}</span>
          <span aria-hidden="true" className="text-xl font-extrabold">
            PLAY
          </span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            reset();
          }}
          disabled={playing}
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

type ChipTone = "target" | "placed" | "active";

/** A single block icon chip used in the target row and the sequence strip. */
function BlockChip({ block, tone }: { block: BlockDef; tone: ChipTone }): React.JSX.Element {
  const active = tone === "active";
  const target = tone === "target";
  return (
    <span
      aria-label={block.word}
      className="grid h-[46px] w-[46px] place-items-center rounded-xl text-xl"
      style={{
        background: active ? "rgba(34,211,238,0.30)" : "rgba(34,211,238,0.12)",
        border: `2px solid ${active ? "#a5f3fc" : ACCENT}`,
        opacity: target ? 0.95 : 1,
        boxShadow: active ? `0 0 14px ${ACCENT}` : undefined,
      }}
    >
      <span aria-hidden="true">{block.glyph}</span>
    </span>
  );
}

const KEYFRAMES = `
@keyframes g2scratchstory-walk {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-3px) rotate(-4deg); }
  50% { transform: translateY(0) rotate(0deg); }
  75% { transform: translateY(-3px) rotate(4deg); }
}
@keyframes g2scratchstory-jump {
  0%, 100% { transform: translateY(0) scale(1); }
  40% { transform: translateY(-26px) scale(1.06); }
  60% { transform: translateY(-26px) scale(1.06); }
}
@keyframes g2scratchstory-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes g2scratchstory-bob {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-5px) scale(1.08); }
}
@keyframes g2scratchstory-cheer {
  0% { transform: scale(1) rotate(0deg); }
  40% { transform: scale(1.25) rotate(-8deg); }
  70% { transform: scale(1.15) rotate(8deg); }
  100% { transform: scale(1) rotate(0deg); }
}
@keyframes g2scratchstory-pop {
  0% { transform: scale(0.7); }
  60% { transform: scale(1.18); }
  100% { transform: scale(1); }
}
@keyframes g2scratchstory-glow {
  0%, 100% { box-shadow: 0 0 4px ${ACCENT}; transform: scale(1); }
  50% { box-shadow: 0 0 14px ${ACCENT}; transform: scale(1.06); }
}
@media (prefers-reduced-motion: reduce) {
  [style*="animation"] { animation: none !important; }
}
`;
