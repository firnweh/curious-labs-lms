"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useState } from "react";

/* ──────────────────────────────────────────────────────────────────────────
 * Block Tower — a JUNIOR (Class 1-3) 3D MODELLING lab.
 * Concept: COUNTING + STACKING (early spatial / 3D thinking).
 *
 * No reading required to play. On the RIGHT is a TARGET tower (a stack of
 * chunky 3D-shaded blocks, bottom→top). On the LEFT the child has an empty
 * build spot and a palette of BIG colour buttons. Tapping a colour stacks
 * that block on top of their tower (bottom-up). They must match the target's
 * colours, order AND count. Big "remove top" (⤺) and "start over" (↻) controls
 * let them fix mistakes. When the stack EXACTLY matches → celebrate + 3 stars.
 *
 * Pure SVG / divs. Pointer events. Deterministic & winnable. Very forgiving:
 * a wrong block bounces back instead of failing.
 * ────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#f59e0b";

/** The four block colours the child can place. */
type ColorId = "red" | "blue" | "yellow" | "green";

interface BlockColor {
  id: ColorId;
  emoji: string; // non-reading cue
  top: string; // light top face
  front: string; // mid front face
  side: string; // dark side face
  label: string; // for aria only
}

const COLORS: Record<ColorId, BlockColor> = {
  red: { id: "red", emoji: "🔴", top: "#ff8b8b", front: "#f4564f", side: "#c2332c", label: "red" },
  blue: { id: "blue", emoji: "🔵", top: "#7fb6ff", front: "#3b82f6", side: "#2459c2", label: "blue" },
  yellow: { id: "yellow", emoji: "🟡", top: "#ffe07a", front: "#f5c518", side: "#c79606", label: "yellow" },
  green: { id: "green", emoji: "🟢", top: "#7ce6b4", front: "#34d399", side: "#1f9d6f", label: "green" },
};

const PALETTE: ColorId[] = ["red", "blue", "yellow", "green"];

/** Fixed, deterministic target: bottom → top. */
const TARGET: ColorId[] = ["red", "blue", "yellow"];

/* ── One chunky 3D-ish block drawn in SVG (top + front + side shade). ── */
const BLOCK_W = 92; // front face width
const BLOCK_H = 30; // front face height
const DEPTH = 14; // iso depth offset

function Block({ color, big }: { color: BlockColor; big: boolean }) {
  // viewBox padded for the depth offset on top/right.
  const vw = BLOCK_W + DEPTH + 4;
  const vh = BLOCK_H + DEPTH + 4;
  const x = 2;
  const y = DEPTH + 2;
  return (
    <svg
      viewBox={`0 0 ${vw} ${vh}`}
      width="100%"
      height="100%"
      className="block select-none"
      role="img"
      aria-label={`${color.label} block`}
    >
      {/* top face (parallelogram) */}
      <polygon
        points={`${x},${y} ${x + DEPTH},${y - DEPTH} ${x + BLOCK_W + DEPTH},${y - DEPTH} ${x + BLOCK_W},${y}`}
        fill={color.top}
        stroke="rgba(0,0,0,0.18)"
        strokeWidth={1}
        strokeLinejoin="round"
      />
      {/* side face (parallelogram) */}
      <polygon
        points={`${x + BLOCK_W},${y} ${x + BLOCK_W + DEPTH},${y - DEPTH} ${x + BLOCK_W + DEPTH},${y + BLOCK_H - DEPTH} ${x + BLOCK_W},${y + BLOCK_H}`}
        fill={color.side}
        stroke="rgba(0,0,0,0.18)"
        strokeWidth={1}
        strokeLinejoin="round"
      />
      {/* front face */}
      <rect
        x={x}
        y={y}
        width={BLOCK_W}
        height={BLOCK_H}
        rx={5}
        fill={color.front}
        stroke="rgba(0,0,0,0.18)"
        strokeWidth={1}
      />
      {/* studs on the top, like building bricks — pure decoration */}
      {big &&
        [0.28, 0.72].map((t) => {
          const cx = x + DEPTH / 2 + (BLOCK_W) * t;
          const cy = y - DEPTH / 2;
          return (
            <ellipse
              key={t}
              cx={cx}
              cy={cy}
              rx={7}
              ry={4}
              fill={color.top}
              stroke="rgba(0,0,0,0.18)"
              strokeWidth={1}
            />
          );
        })}
    </svg>
  );
}

/* A vertical stack of blocks, drawn bottom-up (so the array's index 0 is the
 * block on the floor). Empty slots show faint dashed outlines as a gentle hint. */
function Tower({
  blocks,
  hintCount,
  highlight,
  solved,
  shakeTop,
}: {
  blocks: ColorId[];
  hintCount: number;
  highlight: boolean;
  solved: boolean;
  shakeTop: boolean;
}) {
  const slots = Math.max(hintCount, blocks.length, 1);
  // render top→bottom for natural stacking visual
  const rows = Array.from({ length: slots }).map((_, i) => slots - 1 - i);
  return (
    <div
      className="flex flex-col items-center justify-end gap-1"
      style={{ minHeight: slots * (BLOCK_H + 8) }}
    >
      {rows.map((idx) => {
        const c = blocks[idx];
        const isTop = idx === blocks.length - 1;
        if (c) {
          return (
            <div
              key={idx}
              className="w-[86%]"
              style={{
                aspectRatio: `${BLOCK_W + DEPTH + 4} / ${BLOCK_H + DEPTH + 4}`,
                animation: solved
                  ? `bt-pop 0.5s ${idx * 0.08}s ease-out both`
                  : isTop && shakeTop
                    ? "bt-shake 0.4s ease-in-out"
                    : "bt-drop 0.28s ease-out",
                filter: highlight && solved ? `drop-shadow(0 0 6px ${ACCENT})` : undefined,
              }}
            >
              <Block color={COLORS[c]} big />
            </div>
          );
        }
        // empty ghost slot
        return (
          <div
            key={idx}
            className="w-[78%] rounded-md"
            style={{
              aspectRatio: `${BLOCK_W} / ${BLOCK_H}`,
              border: "2px dashed rgba(159,176,208,0.35)",
              background: "rgba(255,255,255,0.02)",
            }}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}

type Phase = "build" | "solved";

export default function BlockTower({ onComplete }: ActivityProps) {
  const [stack, setStack] = useState<ColorId[]>([]);
  const [phase, setPhase] = useState<Phase>("build");
  const [shakeTop, setShakeTop] = useState<boolean>(false);
  const [bumpPalette, setBumpPalette] = useState<ColorId | null>(null);

  const solved = phase === "solved";

  /** What colour is expected at the next floor position (or null when full). */
  const nextExpected: ColorId | null = useMemo(() => {
    return stack.length < TARGET.length ? TARGET[stack.length] : null;
  }, [stack.length]);

  const place = useCallback(
    (c: ColorId) => {
      if (solved) return;

      // If the tower is already the target height, ignore extra taps gently.
      if (stack.length >= TARGET.length) {
        setShakeTop(true);
        window.setTimeout(() => setShakeTop(false), 420);
        return;
      }

      // Correct next colour → stack it (bottom-up).
      if (c === TARGET[stack.length]) {
        const next = [...stack, c];
        setStack(next);
        if (next.length === TARGET.length) {
          setPhase("solved");
          onComplete({ passed: true, stars: 3, detail: "Tower matched! 🎉" });
        }
        return;
      }

      // Wrong colour → bounce it back, never fail.
      setBumpPalette(c);
      setShakeTop(true);
      window.setTimeout(() => {
        setBumpPalette(null);
        setShakeTop(false);
      }, 420);
    },
    [stack, solved, onComplete],
  );

  const removeTop = useCallback(() => {
    if (solved) return;
    setStack((prev) => prev.slice(0, -1));
  }, [solved]);

  const reset = useCallback(() => {
    setStack([]);
    setPhase("build");
    setShakeTop(false);
    setBumpPalette(null);
  }, []);

  // Tiny visual status: ✓ when solved, … while building, with a progress count.
  const statusEmoji = solved ? "✓" : "…";

  return (
    <div className="flex w-full flex-col gap-4 font-mono text-ink">
      {/* keyframes (scoped via unique animation names) */}
      <style>{`
        @keyframes bt-drop { 0% { transform: translateY(-14px) scale(1.04); opacity: 0; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
        @keyframes bt-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px) rotate(-2deg); } 75% { transform: translateX(6px) rotate(2deg); } }
        @keyframes bt-pop { 0% { transform: scale(1); } 40% { transform: scale(1.12); } 100% { transform: scale(1); } }
        @keyframes bt-bump { 0%,100% { transform: translateY(0); } 40% { transform: translateY(-10px) rotate(-6deg); } }
        @keyframes bt-spark { 0% { transform: scale(0) rotate(0deg); opacity: 0; } 50% { opacity: 1; } 100% { transform: scale(1.3) rotate(40deg); opacity: 0; } }
      `}</style>

      {/* ── Two build areas: child's tower (left) + target tower (right) ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* child's build spot */}
        <div
          className="panel relative flex flex-col items-center rounded-2xl p-3"
          style={{
            boxShadow: solved ? `0 0 22px ${ACCENT}55, inset 0 0 0 2px ${ACCENT}` : undefined,
            transition: "box-shadow .3s",
          }}
        >
          <div className="mb-1 flex items-center gap-1 text-2xl" aria-hidden="true">
            🧱
          </div>
          <div className="flex w-full flex-1 items-end justify-center">
            <Tower
              blocks={stack}
              hintCount={TARGET.length}
              highlight
              solved={solved}
              shakeTop={shakeTop}
            />
          </div>
          {/* floor line */}
          <div
            className="mt-1 h-1.5 w-[90%] rounded-full"
            style={{ background: "rgba(159,176,208,0.25)" }}
            aria-hidden="true"
          />
          {/* celebration sparkles */}
          {solved && (
            <>
              <span
                className="pointer-events-none absolute left-2 top-2 text-2xl"
                style={{ animation: "bt-spark 0.9s 0.1s ease-out both" }}
                aria-hidden="true"
              >
                ✨
              </span>
              <span
                className="pointer-events-none absolute right-2 top-3 text-2xl"
                style={{ animation: "bt-spark 0.9s 0.25s ease-out both" }}
                aria-hidden="true"
              >
                ⭐
              </span>
              <span
                className="pointer-events-none absolute bottom-8 right-3 text-2xl"
                style={{ animation: "bt-spark 0.9s 0.4s ease-out both" }}
                aria-hidden="true"
              >
                🎉
              </span>
            </>
          )}
        </div>

        {/* target tower (the goal) */}
        <div className="panel relative flex flex-col items-center rounded-2xl p-3">
          <div className="mb-1 flex items-center gap-1 text-2xl" aria-hidden="true">
            🎯
          </div>
          <div className="flex w-full flex-1 items-end justify-center opacity-95">
            <Tower
              blocks={TARGET}
              hintCount={TARGET.length}
              highlight={false}
              solved={false}
              shakeTop={false}
            />
          </div>
          <div
            className="mt-1 h-1.5 w-[90%] rounded-full"
            style={{ background: "rgba(159,176,208,0.25)" }}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* tiny visual status: emoji + progress dots, no paragraphs */}
      <div className="flex items-center justify-center gap-2" role="status" aria-live="polite">
        <span
          className="grid h-9 w-9 place-items-center rounded-full text-lg"
          style={{
            background: solved ? ACCENT : "rgba(255,255,255,0.05)",
            color: solved ? "#060810" : "var(--color-ink-dim, #9fb0d0)",
            border: `2px solid ${solved ? ACCENT : "var(--color-line, #1e2a44)"}`,
            boxShadow: solved ? `0 0 12px ${ACCENT}88` : undefined,
          }}
        >
          {statusEmoji}
        </span>
        {/* progress pips — one per target block, fill as you stack */}
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {TARGET.map((c, i) => {
            const done = i < stack.length;
            return (
              <span
                key={i}
                className="h-3.5 w-3.5 rounded-full transition"
                style={{
                  background: done ? COLORS[c].front : "rgba(255,255,255,0.08)",
                  border: `1.5px solid ${done ? COLORS[c].side : "var(--color-line, #1e2a44)"}`,
                }}
              />
            );
          })}
        </div>
        <span className="sr-only">
          {solved
            ? "You matched the tower!"
            : `${stack.length} of ${TARGET.length} blocks stacked.`}
        </span>
      </div>

      {/* ── Colour palette: BIG tap targets ── */}
      <div
        className="grid grid-cols-4 gap-2"
        role="group"
        aria-label="Pick a colour to stack on your tower"
      >
        {PALETTE.map((id) => {
          const c = COLORS[id];
          const isNext = !solved && id === nextExpected;
          return (
            <button
              key={id}
              type="button"
              onClick={() => place(id)}
              disabled={solved}
              aria-label={`Stack a ${c.label} block`}
              className="relative grid place-items-center rounded-2xl py-3 disabled:opacity-50"
              style={{
                minHeight: 64,
                background: c.front,
                border: `3px solid ${isNext ? ACCENT : c.side}`,
                boxShadow: isNext
                  ? `0 0 0 2px ${ACCENT}66, 0 4px 0 ${c.side}`
                  : `0 4px 0 ${c.side}`,
                touchAction: "none",
                animation:
                  bumpPalette === id ? "bt-bump 0.42s ease-in-out" : undefined,
                transform: "translateY(0)",
                transition: "filter .15s",
              }}
            >
              <span className="text-3xl drop-shadow" aria-hidden="true">
                {c.emoji}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Fix-it controls: BIG icon buttons, no reading needed ── */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={removeTop}
          disabled={solved || stack.length === 0}
          aria-label="Take off the top block"
          className="flex items-center justify-center gap-2 rounded-2xl py-3 text-base font-bold disabled:opacity-40"
          style={{
            minHeight: 56,
            background: "var(--color-panel-2, #11182f)",
            border: "2px solid var(--color-line, #1e2a44)",
            color: "var(--color-ink, #e8eefc)",
            touchAction: "none",
          }}
        >
          <span className="text-2xl" aria-hidden="true">
            ⤺
          </span>
          <span aria-hidden="true">Undo</span>
        </button>
        <button
          type="button"
          onClick={reset}
          aria-label="Start over with an empty tower"
          className="flex items-center justify-center gap-2 rounded-2xl py-3 text-base font-bold"
          style={{
            minHeight: 56,
            background: "var(--color-panel-2, #11182f)",
            border: "2px solid var(--color-line, #1e2a44)",
            color: "var(--color-ink, #e8eefc)",
            touchAction: "none",
          }}
        >
          <span className="text-2xl" aria-hidden="true">
            ↻
          </span>
          <span aria-hidden="true">Reset</span>
        </button>
      </div>
    </div>
  );
}
