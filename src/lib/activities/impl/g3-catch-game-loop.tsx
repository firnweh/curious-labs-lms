"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Catch-It Game Coder 🎮 ───────────────────────────────────────────────────
   JUNIORS (Grade 3, age ~8). One learning goal: a game is built from an EVENT
   start, a LOOP that keeps things moving, and a CONDITION that scores —
   "when 🏳 clicked", "repeat forever 🔁", "if catch then +1 ⭐".
   The child taps the 3 correct blocks into 3 numbered slots IN ORDER (an obvious
   "paint sky 🎨" distractor just wiggles back, no penalty). Once the program is
   right, a glowing GREEN FLAG lights up. Tapping it "runs the code": the loop
   makes an apple 🍎 fall again and again, the child slides the basket 🧺 left/
   right (big arrows or drag) to catch them, and each catch fires the if-rule to
   tick the score. Catch 5 → "You coded a game!" 🎉⭐⭐⭐, reported once.
   Missed apples just respawn — always winnable. No reading-heavy text. */

const ACCENT = "#22d3ee";
const TARGET_SCORE = 5;

// ── Stage geometry (virtual SVG units; CSS scales it) ──────────────────────
const STAGE_W = 200;
const STAGE_H = 240;
const BASKET_W = 52;
const BASKET_Y = STAGE_H - 30;
const BASKET_MIN = BASKET_W / 2 + 4;
const BASKET_MAX = STAGE_W - BASKET_W / 2 - 4;
const BASKET_STEP = 30;
const APPLE_TOP = 18;
const FALL_MS = 16; // animation tick
const FALL_SPEED = 1.5; // svg-units per tick
const CATCH_BAND = 26; // vertical reach of the basket mouth

// ── Block definitions ──────────────────────────────────────────────────────
type BlockId = "flag" | "loop" | "catch" | "paint";

interface BlockDef {
  id: BlockId;
  glyph: string;
  /** Short label — 2-3 words, emoji-led. */
  label: string;
  /** aria word. */
  word: string;
  /** Block colour family. */
  hue: string;
}

const BLOCKS: Record<BlockId, BlockDef> = {
  flag: { id: "flag", glyph: "🏳", label: "when clicked", word: "when flag clicked", hue: "#f5d442" },
  loop: { id: "loop", glyph: "🔁", label: "repeat forever", word: "repeat forever", hue: "#f59e0b" },
  catch: { id: "catch", glyph: "⭐", label: "if catch +1", word: "if catch then add one", hue: "#a855f7" },
  paint: { id: "paint", glyph: "🎨", label: "paint sky", word: "paint sky", hue: "#38bdf8" },
};

/** The one correct program, in order. */
const ANSWER: readonly BlockId[] = ["flag", "loop", "catch"];
/** Tray order — correct blocks shuffled with the obvious distractor. */
const TRAY: readonly BlockId[] = ["loop", "paint", "flag", "catch"];

type Phase = "build" | "ready" | "run" | "won";

export default function CatchGameCoder({ onComplete }: ActivityProps) {
  // Slots filled so far (correct blocks placed in order).
  const [placed, setPlaced] = useState<BlockId[]>([]);
  const [phase, setPhase] = useState<Phase>("build");
  const [wiggle, setWiggle] = useState<BlockId | null>(null);
  /** Which program block is "running" right now (the loop highlight). */
  const [activeBlock, setActiveBlock] = useState<number>(-1);

  const [basketX, setBasketX] = useState<number>(STAGE_W / 2);
  const [appleX, setAppleX] = useState<number>(STAGE_W / 2);
  const [appleY, setAppleY] = useState<number>(APPLE_TOP);
  const [score, setScore] = useState<number>(0);
  /** Bumps on each catch to retrigger the sparkle animation. */
  const [catchPing, setCatchPing] = useState<number>(0);

  const reportedRef = useRef<boolean>(false);
  const wiggleTimer = useRef<number | null>(null);
  const fallTimer = useRef<number | null>(null);
  const loopTimer = useRef<number | null>(null);
  const basketRef = useRef<number>(STAGE_W / 2);
  const scoreRef = useRef<number>(0);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef<boolean>(false);

  const programReady = phase === "ready" || phase === "run" || phase === "won";
  const running = phase === "run";
  const won = phase === "won";

  // Keep refs in sync for the timer closures.
  useEffect(() => {
    basketRef.current = basketX;
  }, [basketX]);
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  const clearTimers = useCallback(() => {
    if (fallTimer.current !== null) {
      window.clearInterval(fallTimer.current);
      fallTimer.current = null;
    }
    if (loopTimer.current !== null) {
      window.clearInterval(loopTimer.current);
      loopTimer.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
      if (wiggleTimer.current !== null) window.clearTimeout(wiggleTimer.current);
    };
  }, [clearTimers]);

  /** A new apple drops from a fresh spot near the top. */
  const respawnApple = useCallback((): void => {
    const margin = 22;
    const next = margin + Math.random() * (STAGE_W - margin * 2);
    setAppleX(next);
    setAppleY(APPLE_TOP);
  }, []);

  // ── Building the program ──────────────────────────────────────────────────
  const tapTrayBlock = useCallback(
    (id: BlockId): void => {
      if (phase !== "build") return;
      const nextNeeded = ANSWER[placed.length];
      if (id !== nextNeeded) {
        // Wrong block (or the paint distractor) → gentle wiggle, no penalty.
        setWiggle(id);
        if (wiggleTimer.current !== null) window.clearTimeout(wiggleTimer.current);
        wiggleTimer.current = window.setTimeout(() => setWiggle(null), 460);
        return;
      }
      const next = [...placed, id];
      setPlaced(next);
      if (next.length >= ANSWER.length) {
        setPhase("ready");
      }
    },
    [phase, placed],
  );

  const alreadyPlaced = useCallback(
    (id: BlockId): boolean => placed.includes(id),
    [placed],
  );

  // ── Running the game loop ────────────────────────────────────────────────
  const runFlag = useCallback((): void => {
    if (phase !== "ready") return;
    clearTimers();
    scoreRef.current = 0;
    setScore(0);
    respawnApple();
    setPhase("run");

    // Visual "loop is repeating" highlight — cycles through the 3 blocks.
    let beat = 0;
    setActiveBlock(0);
    loopTimer.current = window.setInterval(() => {
      beat = (beat + 1) % ANSWER.length;
      setActiveBlock(beat);
    }, 360);

    // The repeat-forever loop: apple falls; if it touches the basket → +1.
    fallTimer.current = window.setInterval(() => {
      setAppleY((y) => {
        const ny = y + FALL_SPEED;
        if (ny >= BASKET_Y - CATCH_BAND) {
          // Is the apple over the basket mouth? (the "if touching" rule)
          setAppleX((ax) => {
            const dx = Math.abs(ax - basketRef.current);
            if (dx <= BASKET_W / 2 + 6) {
              // Caught! Fire the score rule.
              const newScore = Math.min(scoreRef.current + 1, TARGET_SCORE);
              scoreRef.current = newScore;
              setScore(newScore);
              setCatchPing((p) => p + 1);
            }
            return ax;
          });
          // Whether caught or missed, the apple respawns at the top.
          const margin = 22;
          setAppleX(margin + Math.random() * (STAGE_W - margin * 2));
          return APPLE_TOP;
        }
        return ny;
      });
    }, FALL_MS);
  }, [phase, clearTimers, respawnApple]);

  // Win when the score reaches the target.
  useEffect(() => {
    if (running && score >= TARGET_SCORE) {
      clearTimers();
      setActiveBlock(-1);
      setPhase("won");
      if (!reportedRef.current) {
        reportedRef.current = true;
        onComplete({
          passed: true,
          stars: 3,
          detail: "You coded a game and caught 5 apples! 🎮",
        });
      }
    }
  }, [running, score, clearTimers, onComplete]);

  // ── Moving the basket ────────────────────────────────────────────────────
  const moveBasket = useCallback(
    (dir: -1 | 1): void => {
      if (!running) return;
      setBasketX((x) => {
        const nx = x + dir * BASKET_STEP;
        return Math.max(BASKET_MIN, Math.min(BASKET_MAX, nx));
      });
    },
    [running],
  );

  const pointToBasket = useCallback((clientX: number): void => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const x = ratio * STAGE_W;
    setBasketX(Math.max(BASKET_MIN, Math.min(BASKET_MAX, x)));
  }, []);

  const onStagePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>): void => {
      if (!running) return;
      e.preventDefault();
      draggingRef.current = true;
      svgRef.current?.setPointerCapture(e.pointerId);
      pointToBasket(e.clientX);
    },
    [running, pointToBasket],
  );

  const onStagePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>): void => {
      if (!running || !draggingRef.current) return;
      e.preventDefault();
      pointToBasket(e.clientX);
    },
    [running, pointToBasket],
  );

  const onStagePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>): void => {
    draggingRef.current = false;
    if (svgRef.current?.hasPointerCapture(e.pointerId)) {
      svgRef.current.releasePointerCapture(e.pointerId);
    }
  }, []);

  // ── Reset ────────────────────────────────────────────────────────────────
  const reset = useCallback((): void => {
    clearTimers();
    if (wiggleTimer.current !== null) window.clearTimeout(wiggleTimer.current);
    reportedRef.current = false;
    draggingRef.current = false;
    scoreRef.current = 0;
    basketRef.current = STAGE_W / 2;
    setPlaced([]);
    setPhase("build");
    setWiggle(null);
    setActiveBlock(-1);
    setBasketX(STAGE_W / 2);
    setAppleX(STAGE_W / 2);
    setAppleY(APPLE_TOP);
    setScore(0);
    setCatchPing(0);
  }, [clearTimers]);

  // ── Status emoji (no reading needed) ─────────────────────────────────────
  const statusEmoji = useMemo<string>(() => {
    if (won) return "🎉";
    if (running) return "🍎";
    if (programReady) return "🏳";
    return "🧩";
  }, [won, running, programReady]);

  const statusLabel = won
    ? "You coded a game!"
    : running
      ? `Caught ${score} of ${TARGET_SCORE} apples`
      : programReady
        ? "Program ready — tap the green flag"
        : "Stack the three blocks in order";

  const trayDisabled = phase !== "build";

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono text-ink">
      <style>{KEYFRAMES}</style>

      {/* ── Visual status pill ── */}
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
          <span
            aria-hidden="true"
            className="grid h-8 min-w-[44px] place-items-center rounded-full px-2 text-lg font-extrabold"
            style={{
              background: "rgba(34,211,238,0.12)",
              border: `2px solid ${ACCENT}`,
              color: ACCENT,
            }}
            key={catchPing}
          >
            <span style={{ animation: catchPing > 0 ? "g3catchgameloop-pop 0.4s ease" : undefined }}>
              ⭐ {score}
            </span>
          </span>
        )}
        {won && (
          <span aria-hidden="true" className="text-2xl">
            ✨
          </span>
        )}
      </div>

      {/* ── Two panels: script builder (left) + game stage (right) ── */}
      <div className="flex w-full max-w-[440px] items-stretch gap-2">
        {/* ── LEFT: script builder ── */}
        <div
          className="flex flex-1 flex-col gap-1.5 rounded-2xl border border-line p-2"
          style={{ background: "rgba(255,255,255,0.03)" }}
          aria-label="Code script with three slots"
        >
          {ANSWER.map((needed, i) => {
            const got = placed[i] ?? null;
            const def = got ? BLOCKS[got] : null;
            const isNext = !got && i === placed.length && phase === "build";
            const isRunning = running && activeBlock === i;
            return (
              <div
                key={`slot-${i}`}
                aria-label={
                  def ? `Slot ${i + 1}: ${def.word}` : `Slot ${i + 1}: empty`
                }
                className="flex h-[42px] items-center gap-1.5 rounded-xl px-2 text-xs font-bold"
                style={{
                  border: `2px ${def ? "solid" : "dashed"} ${
                    isRunning ? "#fff" : def ? def.hue : isNext ? ACCENT : "var(--color-line, #33405c)"
                  }`,
                  background: def ? `${def.hue}22` : "rgba(255,255,255,0.02)",
                  color: def ? "#f1f5f9" : "var(--color-ink-dim, #94a3b8)",
                  opacity: !def && !isNext ? 0.55 : 1,
                  boxShadow: isRunning
                    ? `0 0 14px ${BLOCKS[needed].hue}`
                    : isNext
                      ? `0 0 0 1px ${ACCENT}`
                      : undefined,
                  animation: isNext
                    ? "g3catchgameloop-glow 1.4s ease-in-out infinite"
                    : isRunning
                      ? "g3catchgameloop-runbeat 0.36s ease-in-out"
                      : undefined,
                }}
              >
                <span
                  className="grid h-5 w-5 place-items-center rounded-full text-[10px]"
                  style={{ background: "rgba(0,0,0,0.25)" }}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                {def ? (
                  <>
                    <span aria-hidden="true" className="text-base leading-none">
                      {def.glyph}
                    </span>
                    <span aria-hidden="true" className="leading-tight">
                      {def.label}
                    </span>
                  </>
                ) : (
                  <span aria-hidden="true" className="opacity-60">
                    {isNext ? "drop here" : "…"}
                  </span>
                )}
              </div>
            );
          })}

          {/* Block tray */}
          <div
            className="mt-1 grid grid-cols-2 gap-1.5 border-t border-line pt-2"
            aria-label="Block tray"
          >
            {TRAY.map((id) => {
              const def = BLOCKS[id];
              const used = alreadyPlaced(id);
              const isWiggling = wiggle === id;
              return (
                <button
                  key={id}
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    tapTrayBlock(id);
                  }}
                  disabled={trayDisabled || used}
                  aria-label={`Place block: ${def.word}`}
                  className="flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 transition active:scale-90 disabled:opacity-30"
                  style={{
                    touchAction: "none",
                    background: `${def.hue}1f`,
                    border: `2px solid ${def.hue}`,
                    color: "#f1f5f9",
                    animation: isWiggling ? "g3catchgameloop-wiggle 0.45s ease" : undefined,
                  }}
                >
                  <span aria-hidden="true" className="text-xl leading-none">
                    {def.glyph}
                  </span>
                  <span aria-hidden="true" className="text-[8.5px] font-bold leading-none">
                    {def.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: game stage ── */}
        <div
          className="relative w-[150px] shrink-0 overflow-hidden rounded-2xl border border-line p-1"
          style={{ background: "linear-gradient(#0b1220, #101a2e)" }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
            className="block h-full w-full select-none"
            style={{ touchAction: "none" }}
            role="img"
            aria-label="Game stage with a basket at the bottom and a falling apple"
            onPointerDown={onStagePointerDown}
            onPointerMove={onStagePointerMove}
            onPointerUp={onStagePointerUp}
            onPointerCancel={onStagePointerUp}
          >
            <defs>
              <radialGradient id="g3cgl-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={ACCENT} stopOpacity="0.5" />
                <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* ground line */}
            <line
              x1={0}
              y1={BASKET_Y + 14}
              x2={STAGE_W}
              y2={BASKET_Y + 14}
              stroke="rgba(120,140,170,0.25)"
              strokeWidth={1.5}
            />

            {/* the apple (only meaningful once running) */}
            {(running || won) && (
              <g
                style={{
                  transform: `translate(${appleX}px, ${appleY}px)`,
                  transition: `transform ${FALL_MS}ms linear`,
                }}
              >
                <text
                  x={0}
                  y={0}
                  fontSize={22}
                  textAnchor="middle"
                  dominantBaseline="central"
                  aria-label="apple"
                >
                  🍎
                </text>
              </g>
            )}

            {/* catch glow ping */}
            {running && (
              <circle
                key={catchPing}
                cx={basketX}
                cy={BASKET_Y - 6}
                r={20}
                fill="url(#g3cgl-glow)"
                style={{
                  transformOrigin: "center",
                  transformBox: "fill-box",
                  animation: catchPing > 0 ? "g3catchgameloop-ping 0.45s ease-out" : undefined,
                  opacity: 0,
                }}
              />
            )}

            {/* the basket */}
            <g
              style={{
                transform: `translate(${basketX}px, ${BASKET_Y}px)`,
                transition: "transform 120ms ease-out",
              }}
            >
              <text
                x={0}
                y={0}
                fontSize={34}
                textAnchor="middle"
                dominantBaseline="central"
                aria-label="basket"
              >
                🧺
              </text>
            </g>

            {/* idle hint overlay before running */}
            {!running && !won && (
              <text
                x={STAGE_W / 2}
                y={STAGE_H / 2}
                fontSize={16}
                textAnchor="middle"
                dominantBaseline="central"
                fill="rgba(226,232,240,0.6)"
                aria-hidden="true"
              >
                {programReady ? "🏳 ▶" : "🧩"}
              </text>
            )}

            {/* win celebration overlay */}
            {won && (
              <text
                x={STAGE_W / 2}
                y={STAGE_H / 2 - 30}
                fontSize={30}
                textAnchor="middle"
                dominantBaseline="central"
                aria-hidden="true"
                style={{ animation: "g3catchgameloop-pop 0.6s ease" }}
              >
                🎉
              </text>
            )}
          </svg>
        </div>
      </div>

      {/* ── Green flag (runs the code) ── */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          runFlag();
        }}
        disabled={!programReady || running || won}
        aria-label="Green flag — run your game"
        className="flex h-[54px] w-full max-w-[440px] items-center justify-center gap-2 rounded-2xl text-xl font-extrabold transition active:scale-95 disabled:opacity-40"
        style={{
          touchAction: "none",
          background: programReady && !running && !won ? "#22c55e" : "rgba(255,255,255,0.05)",
          color: programReady && !running && !won ? "#052e16" : "var(--color-ink-dim, #94a3b8)",
          border: `2px solid ${programReady && !running && !won ? "#22c55e" : "var(--color-line, #33405c)"}`,
          boxShadow: programReady && !running && !won ? "0 6px 0 0 #15803d, 0 0 18px #22c55e88" : undefined,
          animation:
            programReady && !running && !won ? "g3catchgameloop-flagpulse 1.2s ease-in-out infinite" : undefined,
        }}
      >
        <span aria-hidden="true">{running ? "🍎" : "🏳"}</span>
        <span aria-hidden="true">{running ? "RUNNING" : "GREEN FLAG"}</span>
      </button>

      {/* ── Basket move arrows ── */}
      <div className="flex w-full max-w-[440px] items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            moveBasket(-1);
          }}
          disabled={!running}
          aria-label="Move basket left"
          className="grid h-[58px] flex-1 place-items-center rounded-2xl text-3xl transition active:scale-90 disabled:opacity-30"
          style={{
            touchAction: "none",
            background: "rgba(34,211,238,0.10)",
            border: `2px solid ${ACCENT}`,
            color: ACCENT,
          }}
        >
          <span aria-hidden="true">⬅️</span>
        </button>
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            moveBasket(1);
          }}
          disabled={!running}
          aria-label="Move basket right"
          className="grid h-[58px] flex-1 place-items-center rounded-2xl text-3xl transition active:scale-90 disabled:opacity-30"
          style={{
            touchAction: "none",
            background: "rgba(34,211,238,0.10)",
            border: `2px solid ${ACCENT}`,
            color: ACCENT,
          }}
        >
          <span aria-hidden="true">➡️</span>
        </button>
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            reset();
          }}
          disabled={false}
          aria-label="Start over"
          className="grid h-[58px] w-[58px] place-items-center rounded-2xl text-2xl transition active:scale-90"
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
          <span style={{ animation: "g3catchgameloop-float 1.6s ease-in-out infinite" }} aria-hidden="true">
            ✨
          </span>
          <span
            style={{ animation: "g3catchgameloop-float 1.6s ease-in-out infinite", animationDelay: "0.2s" }}
            aria-hidden="true"
          >
            🎉
          </span>
          <span
            style={{ animation: "g3catchgameloop-float 1.6s ease-in-out infinite", animationDelay: "0.4s" }}
            aria-hidden="true"
          >
            ✨
          </span>
        </div>
      )}
    </div>
  );
}

const KEYFRAMES = `
@keyframes g3catchgameloop-wiggle {
  0%,100% { transform: translateX(0) rotate(0deg); }
  20% { transform: translateX(-6px) rotate(-6deg); }
  40% { transform: translateX(6px) rotate(6deg); }
  60% { transform: translateX(-4px) rotate(-4deg); }
  80% { transform: translateX(4px) rotate(3deg); }
}
@keyframes g3catchgameloop-glow {
  0%,100% { box-shadow: 0 0 0 1px ${ACCENT}; }
  50% { box-shadow: 0 0 12px ${ACCENT}; }
}
@keyframes g3catchgameloop-runbeat {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}
@keyframes g3catchgameloop-pop {
  0% { transform: scale(0.7); }
  60% { transform: scale(1.25); }
  100% { transform: scale(1); }
}
@keyframes g3catchgameloop-ping {
  0% { transform: scale(0.4); opacity: 0.9; }
  100% { transform: scale(1.6); opacity: 0; }
}
@keyframes g3catchgameloop-flagpulse {
  0%,100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}
@keyframes g3catchgameloop-float {
  0%,100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
@media (prefers-reduced-motion: reduce) {
  [style*="animation"] { animation: none !important; }
}
`;
