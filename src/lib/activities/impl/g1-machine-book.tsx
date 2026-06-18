"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ActivityProps } from "@/lib/activities/types";

const ACCENT = "#a855f7";

/** The two "book pages" a build can belong to. */
type Page = "moves" | "lights";

interface Build {
  id: string;
  emoji: string;
  /** Tiny label — kept to one word so a 6-year-old barely needs to read. */
  label: string;
  page: Page;
}

/** ~6 Grade-1 builds with an unambiguous 2-way split (4 move, 2 light up). */
const BUILDS: Build[] = [
  { id: "robot", emoji: "🤖", label: "Robot", page: "moves" },
  { id: "traffic", emoji: "🚦", label: "Light", page: "lights" },
  { id: "circuit", emoji: "💡", label: "Card", page: "lights" },
  { id: "windmill", emoji: "🌬️", label: "Windmill", page: "moves" },
  { id: "pulley", emoji: "🏗️", label: "Pulley", page: "moves" },
  { id: "animal", emoji: "🦋", label: "Critter", page: "moves" },
];

interface PageInfo {
  page: Page;
  emoji: string;
  label: string;
  tint: string;
}

const PAGES: PageInfo[] = [
  { page: "moves", emoji: "🤸", label: "MOVES / SPINS", tint: ACCENT },
  { page: "lights", emoji: "✨", label: "LIGHTS UP", tint: "#22c55e" },
];

/** Where each build currently lives (undefined = still in the deck). */
type Placement = Record<string, Page | undefined>;

export default function MachineBook({ onComplete }: ActivityProps) {
  const [placed, setPlaced] = useState<Placement>({});
  /** The build the child has tapped and is about to sort. */
  const [picked, setPicked] = useState<string | null>(null);
  /** Id of a card that just bounced back from the wrong page (drives a shake). */
  const [wobble, setWobble] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);

  const reportedRef = useRef(false);
  const wobbleTimer = useRef<number | null>(null);

  const deck = BUILDS.filter((b) => placed[b.id] === undefined);
  const sortedCount = BUILDS.length - deck.length;

  const triggerWobble = useCallback((id: string) => {
    setWobble(id);
    if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
    wobbleTimer.current = window.setTimeout(() => setWobble(null), 520);
  }, []);

  const finish = useCallback((next: Placement) => {
    const allRight = BUILDS.every((b) => next[b.id] === b.page);
    if (allRight) setSolved(true);
  }, []);

  const tapCard = useCallback(
    (id: string) => {
      if (solved || placed[id] !== undefined) return;
      setPicked((p) => (p === id ? null : id));
    },
    [solved, placed],
  );

  const tapPage = useCallback(
    (page: Page) => {
      if (!picked) return;
      const build = BUILDS.find((b) => b.id === picked);
      if (!build) return;
      if (build.page === page) {
        setPlaced((prev) => {
          const next = { ...prev, [picked]: page };
          finish(next);
          return next;
        });
        setPicked(null);
      } else {
        // Wrong page — gentle shake, card stays in the deck, no penalty.
        triggerWobble(picked);
      }
    },
    [picked, finish, triggerWobble],
  );

  const reset = useCallback(() => {
    if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
    reportedRef.current = false;
    setPlaced({});
    setPicked(null);
    setWobble(null);
    setSolved(false);
  }, []);

  // Celebrate exactly once when the book is complete.
  useEffect(() => {
    if (solved && !reportedRef.current) {
      reportedRef.current = true;
      onComplete({ passed: true, stars: 3 });
    }
  }, [solved, onComplete]);

  useEffect(() => {
    return () => {
      if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
    };
  }, []);

  const statusEmoji = solved ? "🎉" : picked ? "👇" : "👆";

  return (
    <div className="flex w-full select-none flex-col gap-3">
      {/* Header — icon-first, minimal reading */}
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[11px] tracking-tech text-ink-dim">
          📔 Sort your builds into the book
        </p>
        <span aria-hidden className="text-lg" style={{ letterSpacing: 2 }}>
          {BUILDS.map((_, i) => (i < sortedCount ? "🟣" : "⚪")).join("")}
        </span>
      </div>

      {/* The deck of build cards */}
      <div
        className="panel relative overflow-hidden rounded-2xl border border-line p-2"
        aria-label="Builds to sort"
      >
        <div className="grid grid-cols-3 gap-2" style={{ minHeight: 150 }}>
          {BUILDS.map((b) => {
            const isPlaced = placed[b.id] !== undefined;
            const isPicked = picked === b.id;
            const isWobbling = wobble === b.id;
            return (
              <button
                key={b.id}
                type="button"
                aria-label={`${b.label}${isPlaced ? ", sorted" : isPicked ? ", picked" : ""}`}
                aria-pressed={isPicked}
                disabled={isPlaced || solved}
                onClick={() => tapCard(b.id)}
                className="flex flex-col items-center justify-center gap-1 rounded-2xl border-2 bg-panel-2/70 transition-transform active:scale-95"
                style={{
                  minHeight: 72,
                  touchAction: "manipulation",
                  cursor: isPlaced ? "default" : "pointer",
                  borderColor: isPicked ? ACCENT : "var(--color-line, #2a2f3a)",
                  boxShadow: isPicked ? `0 0 0 3px ${ACCENT}` : undefined,
                  opacity: isPlaced ? 0.15 : 1,
                  animation: isWobbling ? "mbWobble 0.5s ease" : undefined,
                }}
              >
                <span aria-hidden style={{ fontSize: 34, lineHeight: 1 }}>
                  {b.emoji}
                </span>
                <span className="font-mono text-[10px] text-ink-faint">
                  {b.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* The two book pages / buckets */}
      <div className="grid grid-cols-2 gap-3">
        {PAGES.map((p) => {
          const inHere = BUILDS.filter((b) => placed[b.id] === p.page);
          const armed = picked !== null;
          return (
            <button
              key={p.page}
              type="button"
              onClick={() => tapPage(p.page)}
              aria-label={
                p.page === "moves"
                  ? "Moves or spins page — put movers here"
                  : "Lights up page — put lights here"
              }
              className="flex flex-col items-center justify-start rounded-2xl border-2 p-2 transition-all active:scale-[0.98]"
              style={{
                minHeight: 150,
                cursor: armed ? "pointer" : "default",
                borderColor: armed ? p.tint : "var(--color-line, #2a2f3a)",
                background: armed
                  ? `${p.tint}18`
                  : "var(--color-panel, #11151c)",
                boxShadow: armed ? `0 0 0 3px ${p.tint}55` : undefined,
              }}
            >
              <span aria-hidden style={{ fontSize: 40, lineHeight: 1 }}>
                {p.emoji}
              </span>
              <span className="mt-1 font-mono text-[10px] tracking-tech text-ink-dim">
                {p.label}
              </span>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1">
                {inHere.map((b) => (
                  <span
                    key={b.id}
                    aria-hidden
                    style={{
                      fontSize: 28,
                      animation: "mbPop 0.4s cubic-bezier(.2,1.4,.5,1)",
                    }}
                  >
                    {b.emoji}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Status + reset */}
      <div className="flex items-center gap-2">
        <p
          className="flex-1 text-center font-mono text-sm"
          style={{ color: solved ? ACCENT : "var(--color-ink-dim, #9aa3b2)" }}
          aria-live="polite"
        >
          <span aria-hidden className="mr-1 text-base">
            {statusEmoji}
          </span>
          {solved
            ? "Book complete! 🌟🌟🌟"
            : picked
              ? "Tap a page"
              : sortedCount === 0
                ? "Tap a build"
                : `Nice! ${"⭐".repeat(sortedCount)}`}
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
          className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center"
          style={{ background: "rgba(6,8,16,0.45)" }}
        >
          <div
            className="flex flex-col items-center gap-2"
            style={{ animation: "mbPop 0.5s cubic-bezier(.2,1.4,.5,1)" }}
          >
            <span style={{ fontSize: 72 }}>📔</span>
            <span style={{ fontSize: 44 }}>🎉✨</span>
            <span style={{ fontSize: 30, letterSpacing: 4 }}>🌟🌟🌟</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes mbPop {
          0% { transform: scale(0.3); opacity: 0; }
          70% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes mbWobble {
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
