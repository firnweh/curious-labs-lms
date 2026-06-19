"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Mini Science Fair 🔬 ──────────────────────────────────────────────────────
   JUNIOR (Grade 2, age ~7) AI lab. Single learning goal: GROUP things by WHAT
   THEY DO — the very first thing a computer learns to do (classification).
   Eight project cards from the year sit in a tray, each tagged by its job:
   🔦 Torch + 💡 Bulb = ELECTRICITY, 🚗 Car + 🌀 Fan = MOTION, 🔊 Toy + 🔔 Bell
   = SOUND, 🌉 Bridge + 🏠 House = STRUCTURE. Four labelled BINS wait below.
   The child files every card into the right bin in EITHER of two ways:
     • TAP a card to pick it up, then TAP the bin it belongs in, OR
     • DRAG the card straight onto a bin.
   A right drop snaps in with a happy pop; a wrong drop bounces back gently with
   a little wobble — never a scold, always recoverable. When all eight cards are
   correctly grouped, the fair lights up → celebration + onComplete(passed) once.
   Reset returns every card to the tray. No reading required — cards are emoji and
   each bin shows its category icon. */

const ACCENT = "#a855f7";

/** The four categories cards get grouped into — by what the thing DOES. */
type CatId = "electricity" | "motion" | "sound" | "structure";

interface Category {
  id: CatId;
  /** Big icon for the bin (no reading required). */
  icon: string;
  /** aria word for screen readers. */
  word: string;
}

const CATEGORIES: readonly Category[] = [
  { id: "electricity", icon: "⚡", word: "electricity" },
  { id: "motion", icon: "🏃", word: "motion" },
  { id: "sound", icon: "🎵", word: "sound" },
  { id: "structure", icon: "🧱", word: "structure" },
];

/** A project card from the year — its emoji and the category it belongs to. */
interface Card {
  id: string;
  glyph: string;
  /** aria word for screen readers. */
  word: string;
  cat: CatId;
}

/** Two cards per category → eight cards in all. */
const CARDS: readonly Card[] = [
  { id: "torch", glyph: "🔦", word: "torch", cat: "electricity" },
  { id: "bulb", glyph: "💡", word: "bulb", cat: "electricity" },
  { id: "car", glyph: "🚗", word: "car", cat: "motion" },
  { id: "fan", glyph: "🌀", word: "fan", cat: "motion" },
  { id: "toy", glyph: "🔊", word: "speaker toy", cat: "sound" },
  { id: "bell", glyph: "🔔", word: "bell", cat: "sound" },
  { id: "bridge", glyph: "🌉", word: "bridge", cat: "structure" },
  { id: "house", glyph: "🏠", word: "house", cat: "structure" },
];

const TOTAL = CARDS.length;

/** Where each card currently lives: "tray" or a category id once filed. */
type Placement = "tray" | CatId;

/** A live pointer-drag in progress. */
interface Drag {
  cardId: string;
  /** Pointer position in viewport px (for the floating ghost). */
  x: number;
  y: number;
}

export default function ScienceFair({ onComplete }: ActivityProps) {
  /** Each card id → where it sits. All start in the tray. */
  const [placed, setPlaced] = useState<Record<string, Placement>>(() =>
    Object.fromEntries(CARDS.map((c) => [c.id, "tray" as Placement])),
  );
  /** Card the child has tapped to "pick up" (tap-then-tap mode), or null. */
  const [held, setHeld] = useState<string | null>(null);
  /** A live drag (drag mode), or null. */
  const [drag, setDrag] = useState<Drag | null>(null);
  /** Bin id currently lit because a held/dragged card is hovering it. */
  const [hoverBin, setHoverBin] = useState<CatId | null>(null);
  /** Bin id wobbling from a wrong drop (gentle, no penalty). */
  const [wobbleBin, setWobbleBin] = useState<CatId | null>(null);
  /** Card id bouncing back to the tray after a wrong drop. */
  const [bounceCard, setBounceCard] = useState<string | null>(null);
  /** True once every card is correctly grouped. */
  const [solved, setSolved] = useState<boolean>(false);

  const reportedRef = useRef<boolean>(false);
  const wobbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Refs to each bin's DOM node, for hit-testing a drag drop. */
  const binRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    return () => {
      if (wobbleTimer.current !== null) clearTimeout(wobbleTimer.current);
      if (bounceTimer.current !== null) clearTimeout(bounceTimer.current);
    };
  }, []);

  /** How many cards sit correctly in their bin right now. */
  const correctCount = useMemo<number>(
    () => CARDS.filter((c) => placed[c.id] === c.cat).length,
    [placed],
  );

  /** Cards still waiting in the tray, in their fixed order. */
  const trayCards = useMemo<Card[]>(
    () => CARDS.filter((c) => placed[c.id] === "tray"),
    [placed],
  );

  const bumpWobble = useCallback((cat: CatId) => {
    setWobbleBin(cat);
    if (wobbleTimer.current !== null) clearTimeout(wobbleTimer.current);
    wobbleTimer.current = setTimeout(() => setWobbleBin(null), 460);
  }, []);

  const bounceBack = useCallback((cardId: string) => {
    setBounceCard(cardId);
    if (bounceTimer.current !== null) clearTimeout(bounceTimer.current);
    bounceTimer.current = setTimeout(() => setBounceCard(null), 460);
  }, []);

  /** Try to file `cardId` into bin `cat`. Returns true when it was correct. */
  const fileCard = useCallback(
    (cardId: string, cat: CatId): boolean => {
      const card = CARDS.find((c) => c.id === cardId);
      if (!card) return false;
      if (card.cat === cat) {
        // Correct group → snap in.
        const next: Record<string, Placement> = { ...placed, [cardId]: cat };
        setPlaced(next);
        setHeld(null);
        const allRight = CARDS.every((c) => next[c.id] === c.cat);
        if (allRight && !reportedRef.current) {
          reportedRef.current = true;
          setSolved(true);
          onComplete({ passed: true, stars: 3, detail: "Every project is grouped! 🔬" });
        }
        return true;
      }
      // Wrong group → gentle wobble + bounce back to the tray. No penalty.
      bumpWobble(cat);
      bounceBack(cardId);
      onComplete({
        passed: false,
        detail: "Almost — that one belongs in a different group. Try again!",
      });
      return false;
    },
    [placed, onComplete, bumpWobble, bounceBack],
  );

  /* ── Tap-then-tap mode ─────────────────────────────────────────────────── */

  const tapCard = useCallback(
    (cardId: string) => {
      if (solved || drag) return;
      setHeld((h) => (h === cardId ? null : cardId));
    },
    [solved, drag],
  );

  const tapBin = useCallback(
    (cat: CatId) => {
      if (solved) return;
      if (held === null) return; // tapping an empty bin does nothing
      fileCard(held, cat);
    },
    [solved, held, fileCard],
  );

  /* ── Drag mode (pointer events) ────────────────────────────────────────── */

  /** Which bin (if any) sits under this viewport point. */
  const binAtPoint = useCallback((x: number, y: number): CatId | null => {
    for (const cat of CATEGORIES) {
      const node = binRefs.current[cat.id];
      if (!node) continue;
      const r = node.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return cat.id;
    }
    return null;
  }, []);

  const onCardPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>, cardId: string) => {
      if (solved) return;
      e.preventDefault();
      (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
      setHeld(null);
      setDrag({ cardId, x: e.clientX, y: e.clientY });
    },
    [solved],
  );

  const onCardPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!drag) return;
      e.preventDefault();
      setDrag({ cardId: drag.cardId, x: e.clientX, y: e.clientY });
      setHoverBin(binAtPoint(e.clientX, e.clientY));
    },
    [drag, binAtPoint],
  );

  const onCardPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!drag) return;
      e.preventDefault();
      const overBin = binAtPoint(e.clientX, e.clientY);
      const movedFar =
        Math.abs(e.clientX - drag.x) > 6 || Math.abs(e.clientY - drag.y) > 6;
      const cardId = drag.cardId;
      setDrag(null);
      setHoverBin(null);
      if (overBin) {
        // A real drop onto a bin.
        fileCard(cardId, overBin);
      } else if (!movedFar) {
        // Barely moved + released off any bin → treat as a tap (pick up).
        setHeld((h) => (h === cardId ? null : cardId));
      }
    },
    [drag, binAtPoint, fileCard],
  );

  const reset = useCallback(() => {
    if (wobbleTimer.current !== null) clearTimeout(wobbleTimer.current);
    if (bounceTimer.current !== null) clearTimeout(bounceTimer.current);
    reportedRef.current = false;
    setPlaced(Object.fromEntries(CARDS.map((c) => [c.id, "tray" as Placement])));
    setHeld(null);
    setDrag(null);
    setHoverBin(null);
    setWobbleBin(null);
    setBounceCard(null);
    setSolved(false);
  }, []);

  const draggingCard = drag ? CARDS.find((c) => c.id === drag.cardId) ?? null : null;

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono text-ink">
      <style>{KEYFRAMES}</style>

      {/* ── Tiny visual status (emoji + progress) ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={
          solved
            ? "Every project is grouped! Three stars."
            : held
              ? `Holding the ${CARDS.find((c) => c.id === held)?.word ?? "card"}. Tap the bin it belongs in.`
              : `${correctCount} of ${TOTAL} projects grouped. Pick a card, then a bin.`
        }
        style={{
          background: solved ? "rgba(168,85,247,0.16)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${solved ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: solved ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true">{solved ? "🎉" : held ? "🤲" : "🔬"}</span>
        {solved ? (
          <span aria-hidden="true" className="text-2xl">
            ⭐⭐⭐
          </span>
        ) : (
          <span aria-hidden="true" className="text-base font-bold" style={{ color: ACCENT }}>
            {correctCount}/{TOTAL}
          </span>
        )}
        {solved && (
          <span aria-hidden="true" className="text-2xl">
            ✨
          </span>
        )}
      </div>

      {/* ── The tray of project cards still to sort ── */}
      <div
        className="flex min-h-[92px] w-full max-w-[420px] flex-wrap items-center justify-center gap-2 rounded-2xl px-3 py-3"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "2px dashed var(--color-line, #33405c)",
        }}
        role="group"
        aria-label="Tray of projects to group"
      >
        {trayCards.length === 0 ? (
          <span aria-hidden="true" className="text-2xl opacity-50">
            {solved ? "🎉 all grouped! 🎉" : "✓"}
          </span>
        ) : (
          trayCards.map((card) => {
            const isHeld = held === card.id;
            const isDragging = drag?.cardId === card.id;
            const isBouncing = bounceCard === card.id;
            return (
              <button
                key={card.id}
                type="button"
                onPointerDown={(e) => onCardPointerDown(e, card.id)}
                onPointerMove={onCardPointerMove}
                onPointerUp={onCardPointerUp}
                onClick={() => tapCard(card.id)}
                disabled={solved}
                aria-label={
                  isHeld
                    ? `Put down the ${card.word}`
                    : `Pick up the ${card.word} — drag it to a bin, or tap a bin next`
                }
                aria-pressed={isHeld}
                className="relative grid h-[62px] w-[62px] place-items-center rounded-2xl text-3xl transition active:scale-95 disabled:opacity-60"
                style={{
                  touchAction: "none",
                  background: isHeld ? "rgba(168,85,247,0.18)" : "rgba(255,255,255,0.05)",
                  border: `2px solid ${isHeld ? ACCENT : "var(--color-line, #33405c)"}`,
                  boxShadow: isHeld ? `0 0 14px ${ACCENT}88` : "none",
                  opacity: isDragging ? 0.3 : 1,
                  transform: isHeld ? "translateY(-3px)" : "translateY(0)",
                  animation: isBouncing ? "g2sciencefair-bounce 0.45s ease" : undefined,
                }}
              >
                <span aria-hidden="true">{card.glyph}</span>
                {isHeld && (
                  <span
                    className="pointer-events-none absolute -top-2 right-0 text-base"
                    aria-hidden="true"
                    style={{ animation: "g2sciencefair-bob 0.9s ease-in-out infinite" }}
                  >
                    🤲
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* ── The four category bins ── */}
      <div
        className="grid w-full max-w-[420px] grid-cols-2 gap-2"
        role="group"
        aria-label="Category bins"
      >
        {CATEGORIES.map((cat) => {
          const inBin = CARDS.filter((c) => placed[c.id] === cat.id);
          const isHover = hoverBin === cat.id;
          const isWobble = wobbleBin === cat.id;
          const full = inBin.length === 2;
          return (
            <button
              key={cat.id}
              ref={(node) => {
                binRefs.current[cat.id] = node;
              }}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                tapBin(cat.id);
              }}
              disabled={solved}
              aria-label={
                full
                  ? `${cat.word} bin, full with ${inBin.map((c) => c.word).join(" and ")}`
                  : held !== null
                    ? `Drop the held card into the ${cat.word} bin`
                    : `${cat.word} bin, holding ${inBin.length} of 2`
              }
              className="flex min-h-[104px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-3 transition active:scale-[0.98] disabled:opacity-100"
              style={{
                touchAction: "none",
                background: full
                  ? "rgba(168,85,247,0.12)"
                  : isHover
                    ? "rgba(168,85,247,0.10)"
                    : "rgba(255,255,255,0.04)",
                border: `2px ${full ? "solid" : "dashed"} ${
                  full || isHover ? ACCENT : "var(--color-line, #33405c)"
                }`,
                boxShadow: full
                  ? `0 0 14px ${ACCENT}55`
                  : isHover
                    ? `0 0 12px ${ACCENT}66`
                    : "none",
                animation: isWobble
                  ? "g2sciencefair-wobble 0.45s ease-in-out"
                  : full
                    ? "g2sciencefair-pop 0.45s ease both"
                    : undefined,
              }}
            >
              {/* bin label: icon + category word */}
              <span className="flex items-center gap-1.5" aria-hidden="true">
                <span className="text-2xl">{cat.icon}</span>
                <span className="text-[11px] font-bold uppercase tracking-wide text-ink-dim">
                  {cat.word}
                </span>
              </span>

              {/* cards filed in this bin */}
              <span className="flex min-h-[40px] items-center justify-center gap-1.5" aria-hidden="true">
                {inBin.length === 0 ? (
                  <span className="text-xl opacity-40">➕</span>
                ) : (
                  inBin.map((c) => (
                    <span
                      key={c.id}
                      className="grid h-9 w-9 place-items-center rounded-lg text-2xl"
                      style={{
                        background: "rgba(168,85,247,0.16)",
                        border: `1.5px solid ${ACCENT}`,
                        animation: "g2sciencefair-pop 0.4s ease both",
                      }}
                    >
                      {c.glyph}
                    </span>
                  ))
                )}
              </span>

              {full && (
                <span className="text-sm" aria-hidden="true">
                  ✅
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

      {/* celebratory floaters when solved */}
      {solved && (
        <div className="pointer-events-none flex justify-center gap-2 text-2xl">
          <span style={{ animation: "g2sciencefair-spark 0.9s 0.1s ease-out both" }} aria-hidden="true">
            ✨
          </span>
          <span style={{ animation: "g2sciencefair-spark 0.9s 0.28s ease-out both" }} aria-hidden="true">
            🎉
          </span>
          <span style={{ animation: "g2sciencefair-spark 0.9s 0.44s ease-out both" }} aria-hidden="true">
            ✨
          </span>
        </div>
      )}

      {/* ── Floating drag ghost (follows the pointer) ── */}
      {drag && draggingCard && (
        <div
          className="pointer-events-none fixed z-50 grid h-[62px] w-[62px] place-items-center rounded-2xl text-3xl"
          style={{
            left: drag.x,
            top: drag.y,
            transform: "translate(-50%, -50%) scale(1.08)",
            background: "rgba(168,85,247,0.20)",
            border: `2px solid ${ACCENT}`,
            boxShadow: `0 0 18px ${ACCENT}aa`,
          }}
          aria-hidden="true"
        >
          {draggingCard.glyph}
        </div>
      )}
    </div>
  );
}

const KEYFRAMES = `
@keyframes g2sciencefair-wobble {
  0%,100% { transform: translateX(0) rotate(0deg); }
  20% { transform: translateX(-6px) rotate(-3deg); }
  45% { transform: translateX(6px) rotate(3deg); }
  70% { transform: translateX(-4px) rotate(-2deg); }
  90% { transform: translateX(3px) rotate(1deg); }
}
@keyframes g2sciencefair-bounce {
  0% { transform: scale(1); }
  30% { transform: scale(0.86) rotate(-4deg); }
  60% { transform: scale(1.06) rotate(3deg); }
  100% { transform: scale(1); }
}
@keyframes g2sciencefair-pop {
  0% { transform: scale(0.7); }
  60% { transform: scale(1.12); }
  100% { transform: scale(1); }
}
@keyframes g2sciencefair-bob {
  0%,100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
@keyframes g2sciencefair-spark {
  0% { transform: scale(0) rotate(0deg); opacity: 0; }
  50% { opacity: 1; }
  100% { transform: scale(1.3) rotate(40deg); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  [style*="animation"] { animation: none !important; }
}
`;
