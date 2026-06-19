"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

/* ── Invention Lab Expo 💡 ────────────────────────────────────────────────────
   JUNIOR (Grade 3, age ~8) AI / DESIGN-THINKING lab. ONE learning goal: design
   thinking means matching a real PROBLEM to a helpful SOLUTION — spotting who
   has the problem and what gadget could fix it.

   Stage 1 — Match the fix: three picture problem cards (thirsty plant 🥀, dark
   room 🌙, hungry fish 🐟). A shelf of gadget chips below — auto water sprout 💦,
   night-light sensor 💡, timed fish feeder 🍤, plus a silly distractor singing
   toaster 🎤. Drag the right gadget onto each problem: a correct drop snaps with
   a green glow and the picture animates the fix happening; a wrong drop bounces
   back with a gentle wiggle. The toaster never fits anywhere.

   Stage 2 — Build the poster: drag three labelled tiles (Problem 🙋, Solution 🛠️,
   How It Works ⚙️) into the poster frame, then tap PRESENT! Three judge emojis
   pop 1-2-3 stars (always favourable) and award a Young Innovator ribbon 🏅.

   Win = all 3 matches + 3 poster tiles + Present tapped → onComplete once.
   Deterministic, drag-and-tap only, picture-first, always winnable. */

const ACCENT = "#a855f7";

/* ── Stage 1 data: fixed problem↔gadget pairings ─────────────────────────── */
interface Problem {
  id: string;
  /** Picture before the fix. */
  glyph: string;
  /** Picture after the gadget fixes it. */
  fixedGlyph: string;
  word: string;
}
interface Gadget {
  id: string;
  glyph: string;
  word: string;
  /** Problem id this gadget solves, or null for the silly distractor. */
  solves: string | null;
}

const PROBLEMS: readonly Problem[] = [
  { id: "plant", glyph: "🥀", fixedGlyph: "🌻", word: "thirsty plant" },
  { id: "dark", glyph: "🌙", fixedGlyph: "💡", word: "dark room at night" },
  { id: "fish", glyph: "🐟", fixedGlyph: "🐠", word: "hungry fish" },
];

const GADGETS: readonly Gadget[] = [
  { id: "sprout", glyph: "💦", word: "auto water sprout", solves: "plant" },
  { id: "sensor", glyph: "💡", word: "night light sensor", solves: "dark" },
  { id: "feeder", glyph: "🍤", word: "timed fish feeder", solves: "fish" },
  { id: "toaster", glyph: "🎤", word: "singing toaster", solves: null },
];

/* ── Stage 2 data: three poster tiles ────────────────────────────────────── */
interface PosterTile {
  id: string;
  glyph: string;
  word: string;
}
const POSTER_TILES: readonly PosterTile[] = [
  { id: "problem", glyph: "🙋", word: "Problem" },
  { id: "solution", glyph: "🛠️", word: "Solution" },
  { id: "works", glyph: "⚙️", word: "How It Works" },
];

type Stage = "match" | "poster" | "win";

export default function InventionLabExpo({ onComplete }: ActivityProps) {
  const [stage, setStage] = useState<Stage>("match");

  // Stage 1: problemId → gadgetId that has snapped onto it.
  const [matched, setMatched] = useState<Record<string, string>>({});
  // The gadget currently being dragged (pointer drag), if any.
  const [dragGadget, setDragGadget] = useState<string | null>(null);
  // A gadget id that just bounced back from a wrong drop (gentle wiggle).
  const [wiggle, setWiggle] = useState<string | null>(null);

  // Stage 2: which poster tiles have been placed into the frame.
  const [placedTiles, setPlacedTiles] = useState<Record<string, boolean>>({});
  const [dragTile, setDragTile] = useState<string | null>(null);

  const reportedRef = useRef<boolean>(false);
  const wiggleTimer = useRef<number | null>(null);

  const allMatched = PROBLEMS.every((p) => matched[p.id]);
  const allTilesPlaced = POSTER_TILES.every((t) => placedTiles[t.id]);

  /* ── Stage 1: drop a gadget onto a problem ─────────────────────────────── */
  const dropGadgetOn = useCallback(
    (problemId: string, gadgetId: string) => {
      const gadget = GADGETS.find((g) => g.id === gadgetId);
      if (!gadget) return;
      const correct = gadget.solves === problemId && !matched[problemId];
      // Already-used gadget can't be reused.
      const alreadyUsed = Object.values(matched).includes(gadgetId);
      if (correct && !alreadyUsed) {
        setMatched((m) => {
          const next = { ...m, [problemId]: gadgetId };
          if (PROBLEMS.every((p) => next[p.id])) {
            // All three solved → advance to the poster stage shortly after the
            // fix animation plays.
            window.setTimeout(() => setStage("poster"), 800);
          }
          return next;
        });
        onComplete({ passed: false, detail: "Nice match! That gadget fixes it. 💡" });
      } else {
        // Wrong (or distractor) → gentle wiggle, bounce back, nothing lost.
        setWiggle(gadgetId);
        if (wiggleTimer.current !== null) window.clearTimeout(wiggleTimer.current);
        wiggleTimer.current = window.setTimeout(() => setWiggle(null), 520);
        onComplete({ passed: false, detail: "Not quite — try another gadget for that one!" });
      }
      setDragGadget(null);
    },
    [matched, onComplete],
  );

  /* ── Stage 2: drop a poster tile into the frame ────────────────────────── */
  const dropTileInFrame = useCallback((tileId: string) => {
    setPlacedTiles((p) => ({ ...p, [tileId]: true }));
    setDragTile(null);
  }, []);

  /* ── Present! the poster → win ─────────────────────────────────────────── */
  const present = useCallback(() => {
    if (!allTilesPlaced || !allMatched) return;
    setStage("win");
    if (!reportedRef.current) {
      reportedRef.current = true;
      onComplete({
        passed: true,
        stars: 3,
        detail: "Young Innovator! You matched every fix and presented your invention. 🏅",
      });
    }
  }, [allTilesPlaced, allMatched, onComplete]);

  const reset = useCallback(() => {
    if (wiggleTimer.current !== null) window.clearTimeout(wiggleTimer.current);
    reportedRef.current = false;
    setStage("match");
    setMatched({});
    setPlacedTiles({});
    setDragGadget(null);
    setDragTile(null);
    setWiggle(null);
  }, []);

  // Gadgets still on the shelf (not yet successfully matched).
  const shelfGadgets = useMemo<Gadget[]>(() => {
    const used = new Set(Object.values(matched));
    return GADGETS.filter((g) => !used.has(g.id));
  }, [matched]);

  const statusEmoji = stage === "win" ? "🎉" : stage === "poster" ? "🛠️" : "🔍";
  const statusLabel =
    stage === "win"
      ? "You did it! Young Innovator!"
      : stage === "poster"
        ? "Build your expo poster, then press Present"
        : "Drag each gadget onto the problem it fixes";

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono text-ink">
      <style>{KEYFRAMES}</style>

      {/* ── Status pill ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={statusLabel}
        style={{
          background: stage === "win" ? "rgba(168,85,247,0.16)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${stage === "win" ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: stage === "win" ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true">{statusEmoji}</span>
        {stage === "win" ? (
          <span aria-hidden="true" className="text-2xl">
            ⭐⭐⭐
          </span>
        ) : (
          <span aria-hidden="true" className="text-xl">
            💡 Expo
          </span>
        )}
        {stage === "win" && (
          <span aria-hidden="true" className="text-2xl">
            ✨
          </span>
        )}
      </div>

      <div className="panel w-full max-w-[440px] rounded-2xl border border-line p-3">
        {/* ════════ STAGE 1 — MATCH THE FIX ════════ */}
        {stage === "match" && (
          <div className="flex flex-col gap-3">
            {/* Problem cards (drop targets) */}
            <div className="grid grid-cols-3 gap-2" aria-label="Problems to solve">
              {PROBLEMS.map((p) => {
                const fixedBy = matched[p.id];
                const solved = Boolean(fixedBy);
                const armed = dragGadget !== null && !solved;
                return (
                  <div
                    key={p.id}
                    role="button"
                    aria-label={
                      solved ? `${p.word} — fixed!` : `Problem: ${p.word}. Drop a gadget here.`
                    }
                    onPointerUp={() => {
                      if (dragGadget) dropGadgetOn(p.id, dragGadget);
                    }}
                    className="grid place-items-center rounded-2xl p-2 text-center transition"
                    style={{
                      minHeight: 110,
                      touchAction: "none",
                      background: solved
                        ? "rgba(168,85,247,0.14)"
                        : armed
                          ? "rgba(168,85,247,0.08)"
                          : "rgba(255,255,255,0.05)",
                      border: `2px ${solved ? "solid" : "dashed"} ${
                        solved || armed ? ACCENT : "var(--color-line, #33405c)"
                      }`,
                      boxShadow: solved ? `0 0 16px ${ACCENT}66` : undefined,
                    }}
                  >
                    <span
                      className="text-5xl"
                      aria-hidden="true"
                      style={{
                        animation: solved ? "g3innovationexpo-fixpop 0.7s ease-out" : undefined,
                        display: "inline-block",
                      }}
                    >
                      {solved ? p.fixedGlyph : p.glyph}
                    </span>
                    {solved && (
                      <span className="mt-1 text-xl" aria-hidden="true">
                        ✅
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Gadget shelf (drag sources) */}
            <div
              className="flex flex-wrap items-center justify-center gap-2 rounded-2xl px-3 py-3"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "2px dashed var(--color-line, #33405c)",
              }}
              aria-label="Gadget shelf — drag a gadget to a problem"
            >
              {shelfGadgets.length === 0 ? (
                <span aria-hidden="true" className="text-2xl opacity-60">
                  🎉 all fixed!
                </span>
              ) : (
                shelfGadgets.map((g) => {
                  const dragging = dragGadget === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      aria-label={`Gadget: ${g.word}. Drag onto the problem it fixes.`}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        setDragGadget(g.id);
                      }}
                      onPointerUp={() => {
                        // Released on the shelf (not a problem) → just drop it.
                        setDragGadget((d) => (d === g.id ? null : d));
                      }}
                      className="grid h-[68px] w-[68px] place-items-center rounded-2xl text-4xl transition active:scale-95"
                      style={{
                        touchAction: "none",
                        background: dragging
                          ? "rgba(168,85,247,0.22)"
                          : "rgba(168,85,247,0.10)",
                        border: `2px solid ${ACCENT}`,
                        boxShadow: dragging ? `0 0 16px ${ACCENT}88` : undefined,
                        animation:
                          wiggle === g.id ? "g3innovationexpo-wiggle 0.5s ease-in-out" : undefined,
                      }}
                    >
                      <span aria-hidden="true">{g.glyph}</span>
                    </button>
                  );
                })
              )}
            </div>
            <p className="text-center text-xs text-ink-dim" aria-hidden="true">
              Drag a gadget 👆 onto the matching problem
            </p>
          </div>
        )}

        {/* ════════ STAGE 2 — BUILD THE POSTER ════════ */}
        {stage === "poster" && (
          <div className="flex flex-col gap-3">
            {/* The poster frame (drop target) */}
            <div
              className="grid grid-cols-3 gap-2 rounded-2xl p-3"
              aria-label="Expo poster frame"
              style={{
                background: "rgba(168,85,247,0.06)",
                border: `2px solid ${ACCENT}`,
              }}
            >
              {POSTER_TILES.map((t) => {
                const placed = placedTiles[t.id];
                const armed = dragTile === t.id;
                return (
                  <div
                    key={t.id}
                    role="button"
                    aria-label={
                      placed ? `${t.word} placed` : `Empty ${t.word} slot — drop the tile here`
                    }
                    onPointerUp={() => {
                      if (dragTile === t.id) dropTileInFrame(t.id);
                    }}
                    className="grid place-items-center rounded-xl p-2 text-center"
                    style={{
                      minHeight: 96,
                      touchAction: "none",
                      background: placed ? "rgba(168,85,247,0.16)" : "rgba(255,255,255,0.05)",
                      border: `2px ${placed ? "solid" : "dashed"} ${
                        placed || armed ? ACCENT : "var(--color-line, #33405c)"
                      }`,
                      boxShadow: placed ? `0 0 14px ${ACCENT}55` : undefined,
                    }}
                  >
                    <span
                      className="text-4xl"
                      aria-hidden="true"
                      style={{
                        animation: placed ? "g3innovationexpo-snap 0.45s ease both" : undefined,
                        opacity: placed ? 1 : 0.4,
                      }}
                    >
                      {placed ? t.glyph : "➕"}
                    </span>
                    <span
                      className="mt-1 text-[11px] font-bold"
                      style={{ color: placed ? ACCENT : "var(--color-ink-dim, #8a97ad)" }}
                    >
                      {t.word}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Tile tray (drag sources) */}
            <div
              className="flex flex-wrap items-center justify-center gap-2 rounded-2xl px-3 py-3"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "2px dashed var(--color-line, #33405c)",
              }}
              aria-label="Poster tile tray"
            >
              {POSTER_TILES.filter((t) => !placedTiles[t.id]).length === 0 ? (
                <span aria-hidden="true" className="text-2xl opacity-60">
                  📋 poster ready!
                </span>
              ) : (
                POSTER_TILES.filter((t) => !placedTiles[t.id]).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-label={`Tile: ${t.word}. Drag into the poster frame.`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      setDragTile(t.id);
                    }}
                    onPointerUp={() => setDragTile((d) => (d === t.id ? null : d))}
                    className="grid h-[68px] w-[80px] place-items-center rounded-2xl transition active:scale-95"
                    style={{
                      touchAction: "none",
                      background:
                        dragTile === t.id ? "rgba(168,85,247,0.22)" : "rgba(168,85,247,0.10)",
                      border: `2px solid ${ACCENT}`,
                      boxShadow: dragTile === t.id ? `0 0 16px ${ACCENT}88` : undefined,
                    }}
                  >
                    <span className="text-3xl" aria-hidden="true">
                      {t.glyph}
                    </span>
                  </button>
                ))
              )}
            </div>

            {/* PRESENT! button — enabled once the poster is full */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                present();
              }}
              disabled={!allTilesPlaced}
              aria-label="Present your invention to the judges"
              className="flex h-[60px] w-full items-center justify-center gap-2 rounded-2xl text-xl font-extrabold transition active:scale-95 disabled:opacity-45"
              style={{
                touchAction: "none",
                background: ACCENT,
                color: "#0b0614",
                boxShadow: `0 6px 0 0 #7a31c4`,
              }}
            >
              <span aria-hidden="true">🎤</span>
              <span aria-hidden="true">PRESENT!</span>
            </button>
          </div>
        )}

        {/* ════════ WIN — JUDGES, STARS & RIBBON ════════ */}
        {stage === "win" && (
          <div
            className="grid place-items-center gap-3 py-3 text-center"
            style={{ animation: "g3innovationexpo-snap 0.5s ease both" }}
          >
            {/* Judges popping their star scores */}
            <div className="flex items-end justify-center gap-4" aria-label="Judges give you stars">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1"
                  style={{ animation: `g3innovationexpo-judge 0.5s ${i * 0.25}s ease both` }}
                >
                  <span className="text-4xl" aria-hidden="true">
                    {["👩‍🔬", "🧑‍🏫", "👨‍🎓"][i]}
                  </span>
                  <span className="text-base" aria-hidden="true">
                    ⭐⭐⭐
                  </span>
                </div>
              ))}
            </div>

            {/* Young Innovator ribbon */}
            <div
              className="text-6xl"
              aria-label="Young Innovator ribbon"
              style={{ animation: "g3innovationexpo-bounce 1s ease-in-out infinite" }}
            >
              🏅
            </div>
            <div className="text-sm font-extrabold" style={{ color: ACCENT }}>
              YOUNG INNOVATOR
            </div>
          </div>
        )}
      </div>

      {/* confetti floaters on win */}
      {stage === "win" && (
        <div className="pointer-events-none flex justify-center gap-2 text-2xl" aria-hidden="true">
          <span style={{ animation: "g3innovationexpo-float 1.4s ease-in-out infinite" }}>✨</span>
          <span style={{ animation: "g3innovationexpo-float 1.4s 0.2s ease-in-out infinite" }}>
            🎉
          </span>
          <span style={{ animation: "g3innovationexpo-float 1.4s 0.4s ease-in-out infinite" }}>
            ✨
          </span>
        </div>
      )}

      {/* Reset — always available */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          reset();
        }}
        aria-label="Start over"
        className="grid h-[52px] w-[52px] place-items-center rounded-2xl text-2xl transition active:scale-90"
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

const KEYFRAMES = `
@keyframes g3innovationexpo-wiggle {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  20% { transform: translateX(-7px) rotate(-6deg); }
  45% { transform: translateX(7px) rotate(6deg); }
  70% { transform: translateX(-4px) rotate(-3deg); }
  90% { transform: translateX(4px) rotate(2deg); }
}
@keyframes g3innovationexpo-fixpop {
  0% { transform: scale(0.6) rotate(-8deg); }
  55% { transform: scale(1.3) rotate(4deg); }
  100% { transform: scale(1) rotate(0deg); }
}
@keyframes g3innovationexpo-snap {
  0% { transform: scale(0.7); }
  60% { transform: scale(1.12); }
  100% { transform: scale(1); }
}
@keyframes g3innovationexpo-judge {
  0% { transform: translateY(14px) scale(0.7); opacity: 0; }
  60% { transform: translateY(-4px) scale(1.1); opacity: 1; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes g3innovationexpo-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}
@keyframes g3innovationexpo-float {
  0%, 100% { transform: translateY(0); opacity: 0.85; }
  50% { transform: translateY(-12px); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  [style*="animation"] { animation: none !important; }
}
`;
