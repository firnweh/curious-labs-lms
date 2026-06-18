"use client";
import { useCallback, useRef, useState } from "react";
import type { ActivityProps } from "@/lib/activities/types";

const ACCENT = "#a855f7";

type Group = "pet" | "wild";

interface Animal {
  id: string;
  emoji: string;
  group: Group;
}

/** Fixed, deterministic shuffled order — pets and wild animals interleaved so
 *  there is no positional pattern to "cheat" the sorting. No Math.random. */
const ANIMALS: Animal[] = [
  { id: "dog", emoji: "🐶", group: "pet" },
  { id: "lion", emoji: "🦁", group: "wild" },
  { id: "rabbit", emoji: "🐰", group: "pet" },
  { id: "elephant", emoji: "🐘", group: "wild" },
  { id: "cat", emoji: "🐱", group: "pet" },
  { id: "tiger", emoji: "🐯", group: "wild" },
];

interface Bin {
  group: Group;
  emoji: string;
  /** Soft tint colour for the bin glow. */
  tint: string;
}

const BINS: Bin[] = [
  { group: "pet", emoji: "🏠", tint: ACCENT },
  { group: "wild", emoji: "🌴", tint: "#22c55e" },
];

/** Where a card currently lives. */
type Placement = Record<string, Group | undefined>;

interface DragState {
  id: string;
  /** Pointer position relative to the play surface, in px. */
  x: number;
  y: number;
  /** Pointer offset within the card so it doesn't jump to the corner. */
  offX: number;
  offY: number;
}

export default function SorttheAnimals({ onComplete }: ActivityProps) {
  const [placed, setPlaced] = useState<Placement>({});
  const [drag, setDrag] = useState<DragState | null>(null);
  /** Card id that just bounced back (wrong drop) — drives a wobble animation. */
  const [wobble, setWobble] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const binRefs = useRef<Record<Group, HTMLDivElement | null>>({
    pet: null,
    wild: null,
  });
  const wobbleTimer = useRef<number | null>(null);

  const remaining = ANIMALS.filter((a) => placed[a.id] === undefined);

  const finish = useCallback(
    (next: Placement) => {
      const allRight = ANIMALS.every((a) => next[a.id] === a.group);
      if (allRight) {
        setSolved(true);
        onComplete({ passed: true, stars: 3 });
      }
    },
    [onComplete],
  );

  const triggerWobble = useCallback((id: string) => {
    setWobble(id);
    if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
    wobbleTimer.current = window.setTimeout(() => setWobble(null), 520);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>, id: string) => {
      if (solved || placed[id] !== undefined) return;
      const surface = surfaceRef.current;
      if (!surface) return;
      const surfRect = surface.getBoundingClientRect();
      const cardRect = e.currentTarget.getBoundingClientRect();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({
        id,
        x: e.clientX - surfRect.left,
        y: e.clientY - surfRect.top,
        offX: e.clientX - cardRect.left - cardRect.width / 2,
        offY: e.clientY - cardRect.top - cardRect.height / 2,
      });
    },
    [solved, placed],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!drag) return;
      const surface = surfaceRef.current;
      if (!surface) return;
      const surfRect = surface.getBoundingClientRect();
      setDrag({
        ...drag,
        x: e.clientX - surfRect.left,
        y: e.clientY - surfRect.top,
      });
    },
    [drag],
  );

  const hitBin = useCallback((clientX: number, clientY: number): Group | null => {
    for (const b of BINS) {
      const el = binRefs.current[b.group];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (
        clientX >= r.left &&
        clientX <= r.right &&
        clientY >= r.top &&
        clientY <= r.bottom
      ) {
        return b.group;
      }
    }
    return null;
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!drag) return;
      const id = drag.id;
      const target = hitBin(e.clientX, e.clientY);
      const animal = ANIMALS.find((a) => a.id === id);
      setDrag(null);
      if (!animal) return;
      if (target === animal.group) {
        // Correct! Stick it in the bin with a pop.
        setPlaced((prev) => {
          const next = { ...prev, [id]: target };
          finish(next);
          return next;
        });
      } else if (target !== null) {
        // Wrong bin — bounce back, gentle wobble, no penalty.
        triggerWobble(id);
      }
      // Dropped on empty space — just snaps home silently.
    },
    [drag, hitBin, finish, triggerWobble],
  );

  /** Keyboard / fallback: tapping a tray card then a bin also sorts it. */
  const [picked, setPicked] = useState<string | null>(null);
  const tapCard = useCallback(
    (id: string) => {
      if (solved || placed[id] !== undefined) return;
      setPicked((p) => (p === id ? null : id));
    },
    [solved, placed],
  );
  const tapBin = useCallback(
    (group: Group) => {
      if (!picked) return;
      const animal = ANIMALS.find((a) => a.id === picked);
      if (!animal) return;
      if (animal.group === group) {
        setPlaced((prev) => {
          const next = { ...prev, [picked]: group };
          finish(next);
          return next;
        });
        setPicked(null);
      } else {
        triggerWobble(picked);
      }
    },
    [picked, finish, triggerWobble],
  );

  const reset = useCallback(() => {
    if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
    setPlaced({});
    setDrag(null);
    setWobble(null);
    setPicked(null);
    setSolved(false);
  }, []);

  const sortedCount = ANIMALS.length - remaining.length;

  return (
    <div
      ref={surfaceRef}
      className="relative flex w-full select-none flex-col gap-3 rounded-xl p-3"
      style={{ minHeight: 480, touchAction: "none" }}
    >
      {/* Header — icon-first, almost no reading needed */}
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[11px] tracking-tech text-ink-dim">
          🐾 Drag each animal to its home
        </p>
        <span aria-hidden className="text-lg" style={{ letterSpacing: 2 }}>
          {ANIMALS.map((a, i) =>
            i < sortedCount ? "🟣" : "⚪",
          ).join("")}
        </span>
      </div>

      {/* Tray of draggable animal cards */}
      <div
        className="panel grid grid-cols-3 gap-2 rounded-2xl p-2"
        style={{ minHeight: 150 }}
        aria-label="Animals to sort"
      >
        {ANIMALS.map((a) => {
          const isPlaced = placed[a.id] !== undefined;
          const isDragging = drag?.id === a.id;
          const isWobbling = wobble === a.id;
          const isPicked = picked === a.id;
          return (
            <button
              key={a.id}
              type="button"
              aria-label={`Animal ${a.id}${isPlaced ? ", already sorted" : ""}`}
              aria-pressed={isPicked}
              disabled={isPlaced || solved}
              onPointerDown={(e) => onPointerDown(e, a.id)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onClick={() => tapCard(a.id)}
              className="flex items-center justify-center rounded-2xl border-2 bg-panel-2/70 transition-transform active:scale-95"
              style={{
                minHeight: 64,
                fontSize: 38,
                touchAction: "none",
                cursor: isPlaced ? "default" : "grab",
                borderColor: isPicked ? ACCENT : "var(--color-line, #2a2f3a)",
                boxShadow: isPicked ? `0 0 0 3px ${ACCENT}` : undefined,
                // The floating drag-clone is rendered separately, so hide the
                // original while it's in the air.
                opacity: isPlaced ? 0 : isDragging ? 0.25 : 1,
                animation: isWobbling ? "jaisortWobble 0.5s ease" : undefined,
              }}
            >
              <span aria-hidden>{a.emoji}</span>
            </button>
          );
        })}
      </div>

      {/* The two big bins */}
      <div className="mt-1 grid grid-cols-2 gap-3">
        {BINS.map((b) => {
          const overThisBin =
            drag !== null &&
            (() => {
              const el = binRefs.current[b.group];
              if (!el || !surfaceRef.current) return false;
              const r = el.getBoundingClientRect();
              const s = surfaceRef.current.getBoundingClientRect();
              const px = drag.x + s.left;
              const py = drag.y + s.top;
              return (
                px >= r.left && px <= r.right && py >= r.top && py <= r.bottom
              );
            })();
          const inHere = ANIMALS.filter((a) => placed[a.id] === b.group);
          const armed = picked !== null;
          return (
            <div
              key={b.group}
              ref={(el) => {
                binRefs.current[b.group] = el;
              }}
              role="button"
              tabIndex={0}
              aria-label={
                b.group === "pet"
                  ? "Pets home — drop pet animals here"
                  : "Wild — drop wild animals here"
              }
              onClick={() => tapBin(b.group)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  tapBin(b.group);
                }
              }}
              className="flex flex-col items-center justify-start rounded-2xl border-2 p-2 transition-all"
              style={{
                minHeight: 150,
                cursor: armed ? "pointer" : "default",
                borderColor:
                  overThisBin || armed
                    ? b.tint
                    : "var(--color-line, #2a2f3a)",
                background: overThisBin
                  ? `${b.tint}22`
                  : "var(--color-panel, #11151c)",
                boxShadow:
                  overThisBin || armed ? `0 0 0 3px ${b.tint}55` : undefined,
                transform: overThisBin ? "scale(1.03)" : "scale(1)",
              }}
            >
              <span aria-hidden style={{ fontSize: 42, lineHeight: 1 }}>
                {b.emoji}
              </span>
              {/* Animals that have landed here */}
              <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
                {inHere.map((a) => (
                  <span
                    key={a.id}
                    aria-hidden
                    style={{
                      fontSize: 30,
                      animation: "jaisortPop 0.4s cubic-bezier(.2,1.4,.5,1)",
                    }}
                  >
                    {a.emoji}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating drag clone (follows the finger/pointer) */}
      {drag &&
        (() => {
          const a = ANIMALS.find((an) => an.id === drag.id);
          if (!a) return null;
          return (
            <div
              aria-hidden
              className="pointer-events-none absolute z-20 flex items-center justify-center rounded-2xl border-2"
              style={{
                left: drag.x - drag.offX,
                top: drag.y - drag.offY,
                width: 72,
                height: 72,
                marginLeft: -36,
                marginTop: -36,
                fontSize: 40,
                borderColor: ACCENT,
                background: "var(--color-panel-2, #161b24)",
                boxShadow: `0 8px 24px rgba(0,0,0,0.5), 0 0 0 3px ${ACCENT}`,
                transform: "scale(1.1)",
              }}
            >
              {a.emoji}
            </div>
          );
        })()}

      {/* Status + controls */}
      <div className="mt-auto flex items-center gap-2">
        <p
          className="flex-1 text-center font-mono text-sm"
          style={{ color: solved ? ACCENT : "var(--color-ink-dim, #9aa3b2)" }}
          aria-live="polite"
        >
          {solved
            ? "🎉 You sorted them all! 🌟🌟🌟"
            : sortedCount === 0
              ? "👆 Drag an animal to a home"
              : `Great! ${"⭐".repeat(sortedCount)}`}
        </p>
        <button
          type="button"
          onClick={reset}
          aria-label="Start over"
          className="rounded-xl border-2 border-line bg-panel/60 px-4 py-3"
          style={{ fontSize: 22, minHeight: 56 }}
        >
          🔄
        </button>
      </div>

      {/* Celebration overlay */}
      {solved && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-xl"
          style={{ background: "rgba(6,8,16,0.55)" }}
        >
          <div
            className="flex flex-col items-center gap-2"
            style={{ animation: "jaisortPop 0.5s cubic-bezier(.2,1.4,.5,1)" }}
          >
            <span style={{ fontSize: 72 }}>🎉</span>
            <span style={{ fontSize: 30, letterSpacing: 4 }}>🌟🌟🌟</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes jaisortPop {
          0% { transform: scale(0.3); opacity: 0; }
          70% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes jaisortWobble {
          0%,100% { transform: translateX(0) rotate(0deg); }
          20% { transform: translateX(-6px) rotate(-6deg); }
          40% { transform: translateX(6px) rotate(6deg); }
          60% { transform: translateX(-4px) rotate(-4deg); }
          80% { transform: translateX(4px) rotate(4deg); }
        }
      `}</style>
    </div>
  );
}
