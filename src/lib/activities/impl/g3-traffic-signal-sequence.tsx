"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Traffic Light Conductor 🚦 ───────────────────────────────────────────────
   JUNIOR (Grade 3, age ~8) CODING lab. Single learning goal: a traffic light
   runs a FIXED SEQUENCE of timed steps, and putting the instruction blocks in
   the right ORDER makes the lights cycle correctly so traffic moves safely.
   A cardboard traffic-light tower (red / yellow / green lamps) stands beside a
   vertical program with 3 numbered rungs. The child DRAGS three big colour
   blocks — 🔴 Red STOP, 🟡 Yellow READY, 🟢 Green GO — into the rungs to build
   the cycle. Blocks snap into rungs and can be re-dragged freely. PLAY ▶ runs
   the program top-to-bottom: each step lights its lamp for a 2s beat while a
   little car waits on red, edges forward on yellow, and zooms on green. Correct
   order (Red → Green → Yellow) → the car crosses safely → "Perfect cycle!" badge
   + confetti + onComplete({passed:true,stars:3}) ONCE. Wrong order → the car
   gives a friendly bump, a "Try a different order" bubble shows, then resets so
   the child can rearrange. No fail state. Always winnable with 3 blocks. */

const ACCENT = "#22d3ee";
const BEAT_MS = 2000; // each step lights its lamp for one 2-second beat

/** The three instruction blocks the child can place. */
type BlockId = "red" | "yellow" | "green";

interface BlockDef {
  id: BlockId;
  glyph: string; // big lamp emoji
  word: string; // big word on the chip
  color: string; // chip accent
  aria: string; // screen-reader label
}

const BLOCKS: Record<BlockId, BlockDef> = {
  red: { id: "red", glyph: "🔴", word: "STOP", color: "#ef4444", aria: "Red, stop" },
  yellow: { id: "yellow", glyph: "🟡", word: "READY", color: "#facc15", aria: "Yellow, ready" },
  green: { id: "green", glyph: "🟢", word: "GO", color: "#22c55e", aria: "Green, go" },
};

/** Tray order the chips start in (deliberately NOT the answer). */
const TRAY_ORDER: readonly BlockId[] = ["yellow", "green", "red"];

/** The one correct cycle: Stop, then Ready/Go in the safe driving order. */
const CORRECT: readonly BlockId[] = ["red", "green", "yellow"];

const SLOT_COUNT = 3;

type Phase = "build" | "playing" | "won" | "bump";

/** Where a block currently lives: a rung index 0–2, or the tray. */
type Spot = number | "tray";

export default function TrafficLightConductor({ onComplete }: ActivityProps) {
  /** slots[i] = the BlockId in rung i, or null if that rung is empty. */
  const [slots, setSlots] = useState<(BlockId | null)[]>([null, null, null]);
  const [phase, setPhase] = useState<Phase>("build");
  /** The active step while playing (-1 = none). Lamp at this step glows bright. */
  const [activeStep, setActiveStep] = useState<number>(-1);
  /** The block the child is dragging, or null. */
  const [dragId, setDragId] = useState<BlockId | null>(null);
  /** Pointer position in viewport px while dragging (for the floating ghost). */
  const [dragXY, setDragXY] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  /** Rung index the dragged block is hovering over, or null. */
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);

  const reportedRef = useRef<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => () => clearTimer(), [clearTimer]);

  const playing = phase === "playing";
  const won = phase === "won";
  const bumping = phase === "bump";
  const locked = playing || won;

  /** Which blocks are still in the tray (not yet placed in a rung). */
  const trayBlocks = useMemo<BlockId[]>(
    () => TRAY_ORDER.filter((id) => !slots.includes(id)),
    [slots],
  );

  const filledCount = useMemo<number>(() => slots.filter((s) => s !== null).length, [slots]);
  const allPlaced = filledCount === SLOT_COUNT;

  /** Move a block to a spot (rung index or "tray"), removing it from anywhere else. */
  const placeBlock = useCallback((id: BlockId, spot: Spot) => {
    setSlots((prev) => {
      const next = prev.map((s) => (s === id ? null : s));
      if (spot === "tray") return next;
      // If a block already sits in the target rung, send it back to the tray.
      next[spot] = id;
      return next;
    });
    setPhase("build");
    setActiveStep(-1);
  }, []);

  // ── Pointer drag (touch-first) ─────────────────────────────────────────────
  const onPointerDownBlock = useCallback(
    (e: React.PointerEvent, id: BlockId) => {
      if (locked) return;
      e.preventDefault();
      setDragId(id);
      setDragXY({ x: e.clientX, y: e.clientY });
    },
    [locked],
  );

  const slotAtPoint = useCallback((x: number, y: number): number | null => {
    for (let i = 0; i < SLOT_COUNT; i += 1) {
      const el = slotRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
    }
    return null;
  }, []);

  useEffect(() => {
    if (dragId === null) return;
    const onMove = (e: PointerEvent): void => {
      setDragXY({ x: e.clientX, y: e.clientY });
      setHoverSlot(slotAtPoint(e.clientX, e.clientY));
    };
    const onUp = (e: PointerEvent): void => {
      const target = slotAtPoint(e.clientX, e.clientY);
      if (target !== null) placeBlock(dragId, target);
      setDragId(null);
      setHoverSlot(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragId, slotAtPoint, placeBlock]);

  /** Tap a filled rung to pop its block back to the tray (keyboard / no-drag path). */
  const tapSlot = useCallback(
    (i: number) => {
      if (locked) return;
      const here = slots[i];
      if (here) placeBlock(here, "tray");
    },
    [locked, slots, placeBlock],
  );

  // ── PLAY: run the program top-to-bottom, one 2s beat per step ──────────────
  const play = useCallback(() => {
    if (locked || !allPlaced) return;
    clearTimer();
    const program = slots.filter((s): s is BlockId => s !== null);
    const correct = program.every((id, i) => id === CORRECT[i]);
    setPhase("playing");

    let step = 0;
    const tick = (): void => {
      if (step >= SLOT_COUNT) {
        if (correct) {
          setActiveStep(-1);
          setPhase("won");
          if (!reportedRef.current) {
            reportedRef.current = true;
            onComplete({ passed: true, stars: 3, detail: "Perfect cycle — the car crossed safely! 🚗💨" });
          }
        } else {
          // Friendly bump, then settle back to build so the child can rearrange.
          setActiveStep(-1);
          setPhase("bump");
          onComplete({ passed: false, detail: "Almost! Try a different order so the car can cross safely." });
          timerRef.current = setTimeout(() => setPhase("build"), 1300);
        }
        return;
      }
      setActiveStep(step);
      step += 1;
      timerRef.current = setTimeout(tick, BEAT_MS);
    };
    tick();
  }, [locked, allPlaced, clearTimer, slots, onComplete]);

  const reset = useCallback(() => {
    clearTimer();
    reportedRef.current = false;
    setSlots([null, null, null]);
    setPhase("build");
    setActiveStep(-1);
    setDragId(null);
    setHoverSlot(null);
  }, [clearTimer]);

  // ── Car position derived from the active lamp during play ──────────────────
  // Resting before / after a wrong run = at the line. Per beat: red waits,
  // yellow edges, green zooms. On a winning run the final green sends it across.
  const activeBlock: BlockId | null = activeStep >= 0 ? slots[activeStep] : null;
  const program = useMemo(() => slots.filter((s): s is BlockId => s !== null), [slots]);
  const isWinningRun = playing && program.every((id, i) => id === CORRECT[i]);
  let carPct = 6; // % across the road; resting at the line
  if (won) carPct = 88;
  else if (activeBlock === "yellow") carPct = 20;
  else if (activeBlock === "green") carPct = isWinningRun ? 88 : 38;
  else if (activeBlock === "red") carPct = 6;

  /** Which lamp glows: during play, only the active step's colour; idle = soft all. */
  const lampLit = useCallback(
    (id: BlockId): boolean => {
      if (won) return true;
      if (activeBlock !== null) return activeBlock === id;
      return false;
    },
    [won, activeBlock],
  );

  const statusEmoji = won ? "🎉" : bumping ? "🚗" : playing ? "🚦" : "👇";
  const statusLabel = won
    ? "Perfect cycle! The car crossed safely. Three stars."
    : bumping
      ? "The car bumped — try a different order."
      : playing
        ? "Running your program."
        : allPlaced
          ? "All rungs filled. Press Play to run it."
          : "Drag the blocks into the rungs.";

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono text-ink">
      <style>{KEYFRAMES}</style>

      {/* ── Tiny visual status pill ── */}
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
          <span aria-hidden="true" className="flex items-center gap-1">
            {slots.map((s, i) => (
              <span
                key={i}
                className="block h-3 w-3 rounded-full transition-all"
                style={{
                  background: s ? ACCENT : "transparent",
                  border: `2px solid ${s ? ACCENT : "var(--color-line, #33405c)"}`,
                  boxShadow: s ? `0 0 8px ${ACCENT}` : "none",
                }}
              />
            ))}
          </span>
        )}
        {won && (
          <span aria-hidden="true" className="text-2xl">
            ✨
          </span>
        )}
      </div>

      {/* ── Stage: tower + program rungs ── */}
      <div
        className="panel relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-line p-3"
        style={{
          boxShadow: won ? `0 0 22px ${ACCENT}55, inset 0 0 0 2px ${ACCENT}` : undefined,
          transition: "box-shadow .3s",
        }}
      >
        <div className="flex items-stretch justify-center gap-4">
          {/* The cardboard traffic-light tower */}
          <div
            className="flex shrink-0 flex-col items-center gap-2 rounded-2xl px-3 py-3"
            style={{ background: "#7c4a21", border: "3px solid #5b3415", boxShadow: "inset 0 0 0 2px #92592b" }}
            aria-label="Traffic light tower"
            role="img"
          >
            {(["red", "yellow", "green"] as const).map((id) => {
              const lit = lampLit(id);
              const def = BLOCKS[id];
              return (
                <div
                  key={id}
                  className="grid h-14 w-14 place-items-center rounded-full"
                  aria-hidden="true"
                  style={{
                    background: lit ? def.color : "#23150a",
                    border: `3px solid ${lit ? "#fff8" : "#3a2412"}`,
                    boxShadow: lit ? `0 0 20px 4px ${def.color}` : "inset 0 3px 6px rgba(0,0,0,0.6)",
                    opacity: lit ? 1 : 0.55,
                    transition: "background .25s, box-shadow .25s, opacity .25s",
                  }}
                >
                  <span style={{ fontSize: 22, opacity: lit ? 1 : 0.35 }}>{def.glyph}</span>
                </div>
              );
            })}
            <div
              className="mt-1 h-6 w-3 rounded-b"
              style={{ background: "#3a2412" }}
              aria-hidden="true"
            />
          </div>

          {/* The vertical program: 3 numbered rungs */}
          <div className="flex flex-1 flex-col justify-center gap-2" aria-label="Program rungs">
            {slots.map((id, i) => {
              const def = id ? BLOCKS[id] : null;
              const isActive = activeStep === i;
              const isHover = hoverSlot === i && dragId !== null;
              return (
                <div
                  key={i}
                  ref={(el) => {
                    slotRefs.current[i] = el;
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={
                    def
                      ? `Rung ${i + 1}: ${def.aria}. Tap to send it back to the tray.`
                      : `Rung ${i + 1}: empty. Drag a block here.`
                  }
                  onPointerDown={(e) => {
                    // Tapping a filled rung returns its block; dragging starts a re-drag.
                    if (def && !locked) {
                      e.preventDefault();
                      onPointerDownBlock(e, def.id);
                    }
                  }}
                  onClick={() => tapSlot(i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      tapSlot(i);
                    }
                  }}
                  className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition active:scale-[0.98]"
                  style={{
                    touchAction: "none",
                    minHeight: 58,
                    cursor: def ? "grab" : "default",
                    background: isActive
                      ? "rgba(34,211,238,0.18)"
                      : isHover
                        ? "rgba(34,211,238,0.10)"
                        : "rgba(255,255,255,0.04)",
                    border: `2px ${def ? "solid" : "dashed"} ${
                      isActive || isHover ? ACCENT : "var(--color-line, #33405c)"
                    }`,
                    boxShadow: isActive ? `0 0 14px ${ACCENT}66` : "none",
                    opacity: dragId === id && id !== null ? 0.4 : 1,
                  }}
                >
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold"
                    aria-hidden="true"
                    style={{ background: "rgba(0,0,0,0.3)", color: ACCENT, border: `1.5px solid ${ACCENT}` }}
                  >
                    {i + 1}
                  </span>
                  {def ? (
                    <Chip def={def} />
                  ) : (
                    <span className="flex-1 text-center text-2xl opacity-40" aria-hidden="true">
                      ⬚
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* The road with the waiting car and the crossing line */}
        <div
          className="relative mt-3 h-14 w-full overflow-hidden rounded-xl"
          style={{ background: "#1a2030", border: "2px solid var(--color-line, #33405c)" }}
          aria-hidden="true"
        >
          {/* dashed centre line */}
          <div
            className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2"
            style={{
              backgroundImage: "repeating-linear-gradient(90deg,#ffffff55 0 14px,transparent 14px 28px)",
            }}
          />
          {/* the stop line */}
          <div className="absolute bottom-0 top-0" style={{ left: "12%", width: 4, background: "#ffffff66" }} />
          {/* the car */}
          <div
            className="absolute top-1/2 text-3xl"
            style={{
              left: `${carPct}%`,
              transform: "translate(-50%,-50%)",
              transition: `left ${activeBlock === "green" || won ? "1.1s" : "0.7s"} cubic-bezier(.4,0,.2,1)`,
              animation: bumping ? "g3trafficsignalsequence-bump 0.5s ease" : undefined,
              filter: won ? `drop-shadow(0 0 6px ${ACCENT})` : undefined,
            }}
          >
            🚗
          </div>
        </div>

        {/* Win badge / bump bubble */}
        {won && (
          <div
            className="pointer-events-none absolute inset-x-0 top-2 flex justify-center"
            aria-hidden="true"
          >
            <span
              className="rounded-full px-4 py-1.5 text-sm font-bold"
              style={{
                background: ACCENT,
                color: "#060810",
                boxShadow: `0 0 16px ${ACCENT}`,
                animation: "g3trafficsignalsequence-pop 0.5s ease both",
              }}
            >
              ✨ Perfect cycle! 🎉
            </span>
          </div>
        )}
        {bumping && (
          <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center" aria-hidden="true">
            <span
              className="rounded-full px-4 py-1.5 text-sm font-bold"
              style={{ background: "#fff", color: "#1a2030", boxShadow: "0 4px 10px rgba(0,0,0,0.4)" }}
            >
              💭 Try a different order
            </span>
          </div>
        )}

        {/* confetti */}
        {won && (
          <>
            <span className="pointer-events-none absolute left-4 top-6 text-xl" style={confetti(0.05)} aria-hidden="true">
              ✨
            </span>
            <span className="pointer-events-none absolute right-5 top-8 text-xl" style={confetti(0.22)} aria-hidden="true">
              ⭐
            </span>
            <span className="pointer-events-none absolute left-1/2 top-4 text-xl" style={confetti(0.4)} aria-hidden="true">
              🎉
            </span>
          </>
        )}
      </div>

      {/* ── Tray of draggable blocks ── */}
      <div
        className="flex min-h-[74px] w-full max-w-[420px] flex-wrap items-center justify-center gap-2 rounded-2xl px-3 py-2"
        style={{ background: "rgba(255,255,255,0.04)", border: "2px dashed var(--color-line, #33405c)" }}
        aria-label="Block tray — drag a block up into a rung"
      >
        {trayBlocks.length === 0 ? (
          <span className="text-sm text-ink-dim" aria-hidden="true">
            All blocks placed — press Play ▶
          </span>
        ) : (
          trayBlocks.map((id) => {
            const def = BLOCKS[id];
            return (
              <button
                key={id}
                type="button"
                onPointerDown={(e) => onPointerDownBlock(e, id)}
                disabled={locked}
                aria-label={`Drag block: ${def.aria}`}
                className="transition active:scale-95 disabled:opacity-50"
                style={{
                  touchAction: "none",
                  cursor: "grab",
                  opacity: dragId === id ? 0.4 : 1,
                  background: "transparent",
                  border: "none",
                  padding: 0,
                }}
              >
                <Chip def={def} big />
              </button>
            );
          })
        )}
      </div>

      {/* ── Controls: PLAY · Reset ── */}
      <div className="flex w-full max-w-[420px] items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            play();
          }}
          disabled={locked || !allPlaced}
          aria-label="Play — run the traffic light program"
          className="flex h-[60px] flex-1 items-center justify-center gap-2 rounded-2xl text-2xl font-bold transition active:scale-95 disabled:opacity-50"
          style={{
            touchAction: "none",
            background: ACCENT,
            color: "#060810",
            boxShadow: "0 6px 0 0 #0e8aa0",
          }}
        >
          <span aria-hidden="true">{playing ? "🚦" : "▶"}</span>
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

      {/* Floating drag ghost follows the finger/cursor */}
      {dragId !== null && (
        <div
          className="pointer-events-none fixed z-50"
          style={{
            left: dragXY.x,
            top: dragXY.y,
            transform: "translate(-50%,-50%) scale(1.08)",
            filter: "drop-shadow(0 8px 12px rgba(0,0,0,0.5))",
          }}
          aria-hidden="true"
        >
          <Chip def={BLOCKS[dragId]} big />
        </div>
      )}
    </div>
  );
}

/** One colour instruction block: lamp emoji + big word. */
function Chip({ def, big }: { def: BlockDef; big?: boolean }) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-xl font-bold ${big ? "px-3 py-2.5 text-base" : "px-2 py-1.5 text-sm"}`}
      style={{
        background: `${def.color}22`,
        border: `2px solid ${def.color}`,
        color: "var(--color-ink, #e8eefc)",
        minWidth: big ? 104 : 92,
      }}
      aria-hidden="true"
    >
      <span style={{ fontSize: big ? 22 : 18 }}>{def.glyph}</span>
      <span style={{ color: def.color, letterSpacing: 0.5 }}>{def.word}</span>
    </span>
  );
}

/** Confetti float style with a stagger delay. */
function confetti(delay: number): React.CSSProperties {
  return { animation: `g3trafficsignalsequence-spark 0.9s ${delay}s ease-out both` };
}

const KEYFRAMES = `
@keyframes g3trafficsignalsequence-bump {
  0%,100% { transform: translate(-50%,-50%) rotate(0deg); }
  25% { transform: translate(-30%,-50%) rotate(8deg); }
  55% { transform: translate(-60%,-50%) rotate(-7deg); }
  80% { transform: translate(-45%,-50%) rotate(4deg); }
}
@keyframes g3trafficsignalsequence-pop {
  0% { transform: scale(0.6); opacity: 0; }
  60% { transform: scale(1.12); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes g3trafficsignalsequence-spark {
  0% { transform: scale(0) rotate(0deg); opacity: 0; }
  50% { opacity: 1; }
  100% { transform: scale(1.3) rotate(40deg); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  [style*="animation"] { animation: none !important; }
}
`;
