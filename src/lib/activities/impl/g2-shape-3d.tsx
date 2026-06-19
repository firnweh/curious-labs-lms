"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

/* ── 3D Shape Model 🧊 ─────────────────────────────────────────────────────────
   JUNIOR (Grade 2, age ~7) THREE-D lab. Single learning goal: simple 3D shapes
   (cube, cylinder, cone, sphere) combine to BUILD a real object — and each part
   of that object has a 3D FORM that fits it best (spatial thinking, 2D faces vs
   3D forms). The TARGET is a rocket 🚀 broken into three labelled slots: a pointy
   NOSE (needs a cone), a tall BODY (needs a cylinder) and a base of FINS (needs a
   cube). A palette of four isometric, CSS/SVG-shaded 3D shapes sits below. The
   child TAPS a shape to pick it up, then TAPS the slot it belongs in (or taps a
   filled slot to take the shape back). A wrong shape gives a gentle wobble and
   pops back — never a scold, always recoverable. When all three slots hold the
   correct form, the rocket lights up → celebration + onComplete(passed) once.
   No reading strictly required: each slot shows a hint silhouette of its form. */

const ACCENT = "#f59e0b";

/** The four primitive 3D forms the child can place. */
type ShapeId = "cone" | "cylinder" | "cube" | "sphere";

interface ShapeDef {
  id: ShapeId;
  /** aria word for screen readers. */
  word: string;
}

const SHAPES: Record<ShapeId, ShapeDef> = {
  cone: { id: "cone", word: "cone" },
  cylinder: { id: "cylinder", word: "cylinder" },
  cube: { id: "cube", word: "cube" },
  sphere: { id: "sphere", word: "sphere" },
};

/** Palette order. */
const PALETTE: readonly ShapeId[] = ["cone", "cylinder", "cube", "sphere"];

/** A labelled part of the rocket, top → bottom, with the form it needs. */
interface Slot {
  key: string;
  /** Emoji cue for the rocket part (no reading required). */
  cue: string;
  /** Human label for aria. */
  part: string;
  /** The one correct 3D form for this slot. */
  needs: ShapeId;
}

const SLOTS: readonly Slot[] = [
  { key: "nose", cue: "🔺", part: "nose", needs: "cone" },
  { key: "body", cue: "🚀", part: "body", needs: "cylinder" },
  { key: "fins", cue: "🪁", part: "fins", needs: "cube" },
];

/* ── One isometric, shaded 3D shape drawn purely in SVG ─────────────────────── */

const SH_W = 64;
const SH_H = 64;

function ShapeArt({ id, dim }: { id: ShapeId; dim?: boolean }) {
  const o = dim ? 0.85 : 1;
  return (
    <svg
      viewBox={`0 0 ${SH_W} ${SH_H}`}
      width="100%"
      height="100%"
      className="block select-none"
      role="img"
      aria-label={SHAPES[id].word}
      style={{ opacity: o }}
    >
      {id === "cube" && (
        <>
          {/* top face */}
          <polygon
            points="14,20 32,10 50,20 32,30"
            fill="#fbbf6e"
            stroke="rgba(0,0,0,0.22)"
            strokeWidth={1}
            strokeLinejoin="round"
          />
          {/* left face */}
          <polygon
            points="14,20 32,30 32,52 14,42"
            fill="#d98a18"
            stroke="rgba(0,0,0,0.22)"
            strokeWidth={1}
            strokeLinejoin="round"
          />
          {/* right face */}
          <polygon
            points="32,30 50,20 50,42 32,52"
            fill="#f5a623"
            stroke="rgba(0,0,0,0.22)"
            strokeWidth={1}
            strokeLinejoin="round"
          />
        </>
      )}

      {id === "cylinder" && (
        <>
          {/* body */}
          <path
            d="M16,18 a16,6 0 0 0 32,0 v26 a16,6 0 0 1 -32,0 z"
            fill="#f5a623"
            stroke="rgba(0,0,0,0.22)"
            strokeWidth={1}
          />
          {/* shade on left of body */}
          <path
            d="M16,18 v26 a16,6 0 0 0 8,4.4 v-26 a16,6 0 0 1 -8,-4.4 z"
            fill="#d98a18"
            opacity={0.9}
          />
          {/* top ellipse */}
          <ellipse
            cx={32}
            cy={18}
            rx={16}
            ry={6}
            fill="#fbbf6e"
            stroke="rgba(0,0,0,0.22)"
            strokeWidth={1}
          />
        </>
      )}

      {id === "cone" && (
        <>
          {/* cone body (apex top) */}
          <path
            d="M32,8 L48,46 a16,6 0 0 1 -32,0 z"
            fill="#f5a623"
            stroke="rgba(0,0,0,0.22)"
            strokeWidth={1}
            strokeLinejoin="round"
          />
          {/* left highlight */}
          <path d="M32,8 L16,46 a16,6 0 0 0 16,6 z" fill="#fbbf6e" opacity={0.55} />
          {/* base ellipse rim */}
          <path
            d="M16,46 a16,6 0 0 0 32,0"
            fill="none"
            stroke="rgba(0,0,0,0.22)"
            strokeWidth={1}
          />
        </>
      )}

      {id === "sphere" && (
        <>
          <defs>
            <radialGradient id={`g2shape3d-sph`} cx="38%" cy="34%" r="72%">
              <stop offset="0%" stopColor="#ffe1ab" />
              <stop offset="55%" stopColor="#f5a623" />
              <stop offset="100%" stopColor="#c97c12" />
            </radialGradient>
          </defs>
          <circle
            cx={32}
            cy={32}
            r={20}
            fill="url(#g2shape3d-sph)"
            stroke="rgba(0,0,0,0.22)"
            strokeWidth={1}
          />
          <ellipse cx={25} cy={24} rx={6} ry={4} fill="#fff" opacity={0.35} />
        </>
      )}
    </svg>
  );
}

type Phase = "build" | "solved";

export default function ShapeThreeD({ onComplete }: ActivityProps) {
  /** What sits in each slot, keyed by slot.key. null = empty. */
  const [filled, setFilled] = useState<Record<string, ShapeId | null>>({
    nose: null,
    body: null,
    fins: null,
  });
  /** The shape the child has currently "picked up" (tapped), or null. */
  const [held, setHeld] = useState<ShapeId | null>(null);
  /** Slot key that is wobbling from a wrong drop (gentle, no penalty). */
  const [wobble, setWobble] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("build");

  const reportedRef = useRef<boolean>(false);
  const wobbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const solved = phase === "solved";

  /** How many slots are correctly filled right now. */
  const correctCount = useMemo<number>(
    () => SLOTS.filter((s) => filled[s.key] === s.needs).length,
    [filled],
  );

  const finishIfDone = useCallback(
    (next: Record<string, ShapeId | null>) => {
      const allRight = SLOTS.every((s) => next[s.key] === s.needs);
      if (allRight && !reportedRef.current) {
        reportedRef.current = true;
        setPhase("solved");
        setHeld(null);
        onComplete({ passed: true, stars: 3, detail: "You built the rocket! 🚀" });
      }
    },
    [onComplete],
  );

  const bumpWobble = useCallback((key: string) => {
    setWobble(key);
    if (wobbleTimer.current !== null) clearTimeout(wobbleTimer.current);
    wobbleTimer.current = setTimeout(() => setWobble(null), 460);
  }, []);

  /** Tap a palette shape: pick it up (or drop it if already held). */
  const pickShape = useCallback(
    (id: ShapeId) => {
      if (solved) return;
      setHeld((h) => (h === id ? null : id));
    },
    [solved],
  );

  /** Tap a slot. */
  const tapSlot = useCallback(
    (slot: Slot) => {
      if (solved) return;
      const current = filled[slot.key];

      // Nothing held + slot has a shape → pick that shape back up (take it out).
      if (held === null) {
        if (current) {
          setFilled((f) => ({ ...f, [slot.key]: null }));
          setHeld(current);
        } else {
          bumpWobble(slot.key);
        }
        return;
      }

      // A shape is held → try to place it.
      if (held === slot.needs) {
        const next = { ...filled, [slot.key]: held };
        setFilled(next);
        setHeld(null);
        finishIfDone(next);
      } else {
        // Wrong form for this part → gentle wobble, shape stays in hand.
        bumpWobble(slot.key);
        onComplete({
          passed: false,
          detail: "Not quite — that shape doesn't fit there. Try another part!",
        });
      }
    },
    [solved, filled, held, bumpWobble, finishIfDone, onComplete],
  );

  const reset = useCallback(() => {
    if (wobbleTimer.current !== null) clearTimeout(wobbleTimer.current);
    reportedRef.current = false;
    setFilled({ nose: null, body: null, fins: null });
    setHeld(null);
    setWobble(null);
    setPhase("build");
  }, []);

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono text-ink">
      <style>{KEYFRAMES}</style>

      {/* ── Tiny visual status (emoji + star/progress) ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={
          solved
            ? "You built the rocket! Three stars."
            : held
              ? `Holding a ${SHAPES[held].word}. Tap the part it fits.`
              : `${correctCount} of 3 parts built. Tap a shape to pick it up.`
        }
        style={{
          background: solved ? "rgba(245,158,11,0.14)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${solved ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: solved ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true">{solved ? "🎉" : held ? "🤲" : "🧊"}</span>
        {solved ? (
          <span aria-hidden="true" className="text-2xl">
            ⭐⭐⭐
          </span>
        ) : (
          <span aria-hidden="true" className="flex items-center gap-1">
            {SLOTS.map((s) => (
              <span
                key={s.key}
                className="block h-3 w-3 rounded-full transition-all"
                style={{
                  background: filled[s.key] === s.needs ? ACCENT : "transparent",
                  border: `2px solid ${filled[s.key] === s.needs ? ACCENT : "var(--color-line, #33405c)"}`,
                  boxShadow: filled[s.key] === s.needs ? `0 0 8px ${ACCENT}` : "none",
                }}
              />
            ))}
          </span>
        )}
        {solved && (
          <span aria-hidden="true" className="text-2xl">
            ✨
          </span>
        )}
      </div>

      {/* ── The rocket target: three labelled slots, nose → fins ── */}
      <div
        className="panel relative flex w-full max-w-[420px] flex-col items-center gap-2 overflow-hidden rounded-2xl border border-line p-4"
        style={{
          boxShadow: solved ? `0 0 22px ${ACCENT}55, inset 0 0 0 2px ${ACCENT}` : undefined,
          transition: "box-shadow .3s",
        }}
      >
        <div className="mb-1 text-sm font-bold" style={{ color: ACCENT }} aria-hidden="true">
          🎯 Build the rocket
        </div>

        {SLOTS.map((slot) => {
          const got = filled[slot.key];
          const right = got === slot.needs;
          const isWobble = wobble === slot.key;
          const targeted = held !== null && !right;
          return (
            <button
              key={slot.key}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                tapSlot(slot);
              }}
              disabled={solved}
              aria-label={
                got
                  ? `Rocket ${slot.part}: holds a ${SHAPES[got].word}. Tap to take it out.`
                  : `Empty rocket ${slot.part}. Tap to place the held shape here.`
              }
              className="flex w-[80%] items-center gap-3 rounded-2xl px-3 py-2 transition active:scale-[0.98] disabled:opacity-100"
              style={{
                touchAction: "none",
                minHeight: 72,
                background: right ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.04)",
                border: `2px ${got ? "solid" : "dashed"} ${
                  right ? ACCENT : targeted ? "rgba(245,158,11,0.6)" : "var(--color-line, #33405c)"
                }`,
                boxShadow: right ? `0 0 14px ${ACCENT}55` : "none",
                animation: isWobble
                  ? "g2shape3d-wobble 0.45s ease-in-out"
                  : right
                    ? "g2shape3d-pop 0.45s ease both"
                    : undefined,
              }}
            >
              {/* the slot's form box */}
              <span
                className="grid h-14 w-14 shrink-0 place-items-center rounded-xl"
                style={{
                  background: "rgba(0,0,0,0.18)",
                  border: `1.5px solid ${right ? ACCENT : "var(--color-line, #33405c)"}`,
                }}
                aria-hidden="true"
              >
                {got ? (
                  <span className="h-12 w-12">
                    <ShapeArt id={got} />
                  </span>
                ) : (
                  <span className="text-2xl opacity-50">➕</span>
                )}
              </span>

              {/* the rocket part cue + name */}
              <span className="flex flex-1 flex-col items-start" aria-hidden="true">
                <span className="text-2xl">{slot.cue}</span>
                <span className="text-xs uppercase tracking-wide text-ink-dim">{slot.part}</span>
              </span>

              {right && (
                <span className="text-xl" aria-hidden="true">
                  ✅
                </span>
              )}
            </button>
          );
        })}

        {/* celebration floaters */}
        {solved && (
          <>
            <span
              className="pointer-events-none absolute left-3 top-3 text-2xl"
              style={{ animation: "g2shape3d-spark 0.9s 0.1s ease-out both" }}
              aria-hidden="true"
            >
              ✨
            </span>
            <span
              className="pointer-events-none absolute right-3 top-4 text-2xl"
              style={{ animation: "g2shape3d-spark 0.9s 0.28s ease-out both" }}
              aria-hidden="true"
            >
              ⭐
            </span>
            <span
              className="pointer-events-none absolute bottom-4 right-4 text-2xl"
              style={{ animation: "g2shape3d-spark 0.9s 0.44s ease-out both" }}
              aria-hidden="true"
            >
              🎉
            </span>
          </>
        )}
      </div>

      {/* ── Palette of 3D shapes: BIG tap targets ── */}
      <div
        className="grid w-full max-w-[420px] grid-cols-4 gap-2"
        role="group"
        aria-label="Pick up a 3D shape"
      >
        {PALETTE.map((id) => {
          const isHeld = held === id;
          return (
            <button
              key={id}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                pickShape(id);
              }}
              disabled={solved}
              aria-label={isHeld ? `Put down the ${SHAPES[id].word}` : `Pick up the ${SHAPES[id].word}`}
              aria-pressed={isHeld}
              className="relative grid aspect-square min-h-[68px] place-items-center rounded-2xl transition active:scale-95 disabled:opacity-50"
              style={{
                touchAction: "none",
                background: isHeld ? "rgba(245,158,11,0.16)" : "rgba(255,255,255,0.05)",
                border: `2px solid ${isHeld ? ACCENT : "var(--color-line, #33405c)"}`,
                boxShadow: isHeld ? `0 0 14px ${ACCENT}88` : "none",
                transform: isHeld ? "translateY(-3px)" : "translateY(0)",
              }}
            >
              <span className="h-12 w-12" aria-hidden="true">
                <ShapeArt id={id} dim={!isHeld && held !== null} />
              </span>
              {isHeld && (
                <span
                  className="pointer-events-none absolute -top-2 right-1 text-base"
                  aria-hidden="true"
                  style={{ animation: "g2shape3d-bob 0.9s ease-in-out infinite" }}
                >
                  🤲
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Reset control ── */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          reset();
        }}
        aria-label="Start over"
        className="flex min-h-[52px] items-center gap-2 rounded-2xl px-6 py-3 text-base font-bold transition active:scale-95"
        style={{
          touchAction: "none",
          background: "var(--color-panel-2, #11182f)",
          border: "2px solid var(--color-line, #33405c)",
          color: "var(--color-ink, #e8eefc)",
        }}
      >
        <span className="text-2xl" aria-hidden="true">
          🔄
        </span>
        <span aria-hidden="true">Reset</span>
      </button>
    </div>
  );
}

const KEYFRAMES = `
@keyframes g2shape3d-wobble {
  0%,100% { transform: translateX(0) rotate(0deg); }
  20% { transform: translateX(-6px) rotate(-3deg); }
  45% { transform: translateX(6px) rotate(3deg); }
  70% { transform: translateX(-4px) rotate(-2deg); }
  90% { transform: translateX(3px) rotate(1deg); }
}
@keyframes g2shape3d-pop {
  0% { transform: scale(0.94); }
  55% { transform: scale(1.05); }
  100% { transform: scale(1); }
}
@keyframes g2shape3d-bob {
  0%,100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
@keyframes g2shape3d-spark {
  0% { transform: scale(0) rotate(0deg); opacity: 0; }
  50% { opacity: 1; }
  100% { transform: scale(1.3) rotate(40deg); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  [style*="animation"] { animation: none !important; }
}
`;
