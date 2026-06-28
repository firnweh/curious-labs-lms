"use client";
import { useCallback, useRef, useState } from "react";
import type { ActivityProps } from "@/lib/activities/types";

/**
 * Grade 3 · AI Literacy — "AI or Not AI?"
 * Concept: AI awareness. A child sorts everyday things into "AI" (it notices
 * patterns and makes choices) vs "Not AI" (a tool that always does the same
 * thing). Pure drag/tap/keyboard, deterministic, self-grading. On a clean
 * solve it reveals the one-line "why" so the lesson lands, not just the win.
 */
const ACCENT = "#34c3ff";

type Group = "ai" | "tool";

interface Thing {
  id: string;
  emoji: string;
  label: string;
  group: Group;
}

/** Interleaved so there's no positional pattern to game. No Math.random. */
const THINGS: Thing[] = [
  { id: "speaker", emoji: "🔊", label: "Voice assistant", group: "ai" },
  { id: "calc", emoji: "🧮", label: "Calculator", group: "tool" },
  { id: "vacuum", emoji: "🤖", label: "Robot vacuum", group: "ai" },
  { id: "fan", emoji: "🪭", label: "Fan", group: "tool" },
  { id: "videos", emoji: "▶️", label: "Video picks", group: "ai" },
  { id: "bike", emoji: "🚲", label: "Bicycle", group: "tool" },
  { id: "face", emoji: "📷", label: "Face unlock", group: "ai" },
  { id: "switch", emoji: "💡", label: "Light switch", group: "tool" },
];

interface Bin {
  group: Group;
  emoji: string;
  title: string;
  hint: string;
  tint: string;
}

const BINS: Bin[] = [
  { group: "ai", emoji: "🤖", title: "AI", hint: "learns & decides", tint: ACCENT },
  { group: "tool", emoji: "🔧", title: "Not AI", hint: "just a tool", tint: "#f59e0b" },
];

type Placement = Record<string, Group | undefined>;

interface DragState {
  id: string;
  x: number;
  y: number;
  offX: number;
  offY: number;
}

export default function AIorNotAI({ onComplete }: ActivityProps) {
  const [placed, setPlaced] = useState<Placement>({});
  const [drag, setDrag] = useState<DragState | null>(null);
  const [wobble, setWobble] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const binRefs = useRef<Record<Group, HTMLDivElement | null>>({ ai: null, tool: null });
  const wobbleTimer = useRef<number | null>(null);

  const remaining = THINGS.filter((t) => placed[t.id] === undefined);
  const sortedCount = THINGS.length - remaining.length;

  const finish = useCallback(
    (next: Placement) => {
      if (THINGS.every((t) => next[t.id] === t.group)) {
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

  const place = useCallback(
    (id: string, group: Group) => {
      const thing = THINGS.find((t) => t.id === id);
      if (!thing) return;
      if (thing.group === group) {
        setPlaced((prev) => {
          const next = { ...prev, [id]: group };
          finish(next);
          return next;
        });
        setPicked(null);
      } else {
        triggerWobble(id);
      }
    },
    [finish, triggerWobble],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>, id: string) => {
      if (solved || placed[id] !== undefined) return;
      const surface = surfaceRef.current;
      if (!surface) return;
      const s = surface.getBoundingClientRect();
      const c = e.currentTarget.getBoundingClientRect();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({
        id,
        x: e.clientX - s.left,
        y: e.clientY - s.top,
        offX: e.clientX - c.left - c.width / 2,
        offY: e.clientY - c.top - c.height / 2,
      });
    },
    [solved, placed],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!drag) return;
      const surface = surfaceRef.current;
      if (!surface) return;
      const s = surface.getBoundingClientRect();
      setDrag({ ...drag, x: e.clientX - s.left, y: e.clientY - s.top });
    },
    [drag],
  );

  const hitBin = useCallback((clientX: number, clientY: number): Group | null => {
    for (const b of BINS) {
      const el = binRefs.current[b.group];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) return b.group;
    }
    return null;
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!drag) return;
      const id = drag.id;
      const target = hitBin(e.clientX, e.clientY);
      setDrag(null);
      if (target !== null) place(id, target);
    },
    [drag, hitBin, place],
  );

  const reset = useCallback(() => {
    if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
    setPlaced({});
    setDrag(null);
    setWobble(null);
    setPicked(null);
    setSolved(false);
  }, []);

  return (
    <div
      ref={surfaceRef}
      className="relative flex w-full select-none flex-col gap-3 rounded-xl p-3"
      style={{ minHeight: 500, touchAction: "none" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[11px] tracking-tech text-ink-dim">
          🤖 Is it AI, or just a tool? Sort each one.
        </p>
        <span aria-hidden className="text-lg" style={{ letterSpacing: 2 }}>
          {THINGS.map((_, i) => (i < sortedCount ? "🔵" : "⚪")).join("")}
        </span>
      </div>

      {/* Tray of draggable cards */}
      <div className="panel grid grid-cols-4 gap-2 rounded-2xl p-2" style={{ minHeight: 150 }} aria-label="Things to sort">
        {THINGS.map((t) => {
          const isPlaced = placed[t.id] !== undefined;
          const isDragging = drag?.id === t.id;
          const isWobbling = wobble === t.id;
          const isPicked = picked === t.id;
          return (
            <button
              key={t.id}
              type="button"
              aria-label={`${t.label}${isPlaced ? ", already sorted" : ""}`}
              aria-pressed={isPicked}
              disabled={isPlaced || solved}
              onPointerDown={(e) => onPointerDown(e, t.id)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onClick={() => { if (!solved && placed[t.id] === undefined) setPicked((p) => (p === t.id ? null : t.id)); }}
              className="flex flex-col items-center justify-center gap-1 rounded-2xl border-2 bg-panel-2/70 px-1 py-2 transition-transform active:scale-95"
              style={{
                minHeight: 76,
                touchAction: "none",
                cursor: isPlaced ? "default" : "grab",
                borderColor: isPicked ? ACCENT : "var(--color-line, #2a2f3a)",
                boxShadow: isPicked ? `0 0 0 3px ${ACCENT}` : undefined,
                opacity: isPlaced ? 0 : isDragging ? 0.25 : 1,
                animation: isWobbling ? "ainotWobble 0.5s ease" : undefined,
              }}
            >
              <span aria-hidden style={{ fontSize: 30, lineHeight: 1 }}>{t.emoji}</span>
              <span className="text-center font-mono text-[9px] leading-tight text-ink-dim">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* The two bins */}
      <div className="mt-1 grid grid-cols-2 gap-3">
        {BINS.map((b) => {
          const overThisBin =
            drag !== null &&
            (() => {
              const el = binRefs.current[b.group];
              if (!el || !surfaceRef.current) return false;
              const r = el.getBoundingClientRect();
              const s = surfaceRef.current.getBoundingClientRect();
              return drag.x + s.left >= r.left && drag.x + s.left <= r.right && drag.y + s.top >= r.top && drag.y + s.top <= r.bottom;
            })();
          const inHere = THINGS.filter((t) => placed[t.id] === b.group);
          const armed = picked !== null;
          return (
            <div
              key={b.group}
              ref={(el) => { binRefs.current[b.group] = el; }}
              role="button"
              tabIndex={0}
              aria-label={`${b.title} — ${b.hint}`}
              onClick={() => { if (picked) place(picked, b.group); }}
              onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && picked) { e.preventDefault(); place(picked, b.group); } }}
              className="flex flex-col items-center justify-start rounded-2xl border-2 p-2 transition-all"
              style={{
                minHeight: 156,
                cursor: armed ? "pointer" : "default",
                borderColor: overThisBin || armed ? b.tint : "var(--color-line, #2a2f3a)",
                background: overThisBin ? `${b.tint}22` : "var(--color-panel, #11151c)",
                boxShadow: overThisBin || armed ? `0 0 0 3px ${b.tint}55` : undefined,
                transform: overThisBin ? "scale(1.03)" : "scale(1)",
              }}
            >
              <span aria-hidden style={{ fontSize: 36, lineHeight: 1 }}>{b.emoji}</span>
              <span className="font-mono text-xs font-semibold" style={{ color: b.tint }}>{b.title}</span>
              <span className="font-mono text-[9px] text-ink-faint">{b.hint}</span>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
                {inHere.map((t) => (
                  <span key={t.id} aria-hidden style={{ fontSize: 24, animation: "ainotPop 0.4s cubic-bezier(.2,1.4,.5,1)" }}>{t.emoji}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating drag clone */}
      {drag &&
        (() => {
          const t = THINGS.find((x) => x.id === drag.id);
          if (!t) return null;
          return (
            <div
              aria-hidden
              className="pointer-events-none absolute z-20 flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2"
              style={{
                left: drag.x - drag.offX,
                top: drag.y - drag.offY,
                width: 80,
                height: 80,
                marginLeft: -40,
                marginTop: -40,
                borderColor: ACCENT,
                background: "var(--color-panel-2, #161b24)",
                boxShadow: `0 8px 24px rgba(0,0,0,0.5), 0 0 0 3px ${ACCENT}`,
                transform: "scale(1.1)",
              }}
            >
              <span aria-hidden style={{ fontSize: 32 }}>{t.emoji}</span>
              <span className="font-mono text-[8px] text-ink-dim">{t.label}</span>
            </div>
          );
        })()}

      {/* Status + reset */}
      <div className="mt-auto flex items-center gap-2">
        <p
          className="flex-1 text-center font-mono text-sm"
          style={{ color: solved ? ACCENT : "var(--color-ink-dim, #9aa3b2)" }}
          aria-live="polite"
        >
          {solved
            ? "🎉 Sorted! AI learns patterns & decides — a tool always does the same thing."
            : sortedCount === 0
              ? "👆 Drag (or tap, then tap a box)"
              : `Nice! ${"⭐".repeat(Math.min(3, Math.ceil((sortedCount / THINGS.length) * 3)))}`}
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
        <div aria-hidden className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-xl" style={{ background: "rgba(6,8,16,0.55)" }}>
          <div className="flex flex-col items-center gap-2" style={{ animation: "ainotPop 0.5s cubic-bezier(.2,1.4,.5,1)" }}>
            <span style={{ fontSize: 72 }}>🎉</span>
            <span style={{ fontSize: 30, letterSpacing: 4 }}>🌟🌟🌟</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes ainotPop {
          0% { transform: scale(0.3); opacity: 0; }
          70% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes ainotWobble {
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
