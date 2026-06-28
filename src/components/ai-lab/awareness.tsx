"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * AI Lab — "AI or Not AI?" (Grades 1-3).
 *
 * A drag/tap sorting game that teaches the very first idea of AI awareness:
 * some things *learn & decide* (AI), and some things *just do the same thing
 * every time* (a plain tool). Eight everyday items get sorted into the 🤖 bin
 * or the 🔧 bin. Wrong drops wobble gently and bounce back — never a penalty.
 * When all eight are right, a small celebration reveals the lesson.
 *
 * Pure React + emoji. Pointer drag AND tap-card-then-tap-bin fallback AND
 * keyboard. Deterministic interleaved order, no random, no network.
 */

const ACCENT = "#34d399";

type Bin = "ai" | "tool";

interface Item {
  id: string;
  emoji: string;
  label: string;
  answer: Bin;
}

// Deterministic interleaved order: AI, tool, AI, tool, …
const ITEMS: Item[] = [
  { id: "voice", emoji: "🔊", label: "Voice helper", answer: "ai" },
  { id: "calc", emoji: "🧮", label: "Calculator", answer: "tool" },
  { id: "vacuum", emoji: "🤖", label: "Robot vacuum", answer: "ai" },
  { id: "fan", emoji: "🪭", label: "Fan", answer: "tool" },
  { id: "picks", emoji: "▶️", label: "Video picks", answer: "ai" },
  { id: "bike", emoji: "🚲", label: "Bicycle", answer: "tool" },
  { id: "face", emoji: "📷", label: "Face unlock", answer: "ai" },
  { id: "switch", emoji: "💡", label: "Light switch", answer: "tool" },
];

const BINS: { id: Bin; emoji: string; title: string; sub: string; color: string }[] = [
  { id: "ai", emoji: "🤖", title: "AI", sub: "learns & decides", color: ACCENT },
  { id: "tool", emoji: "🔧", title: "Not AI", sub: "just a tool", color: "#60a5fa" },
];

export default function AwarenessLab() {
  // Where each item has landed (null = still in the tray).
  const [placed, setPlaced] = useState<Record<string, Bin | null>>(
    () => Object.fromEntries(ITEMS.map((i) => [i.id, null])) as Record<string, Bin | null>,
  );
  const [picked, setPicked] = useState<string | null>(null); // tap/keyboard selection
  const [dragId, setDragId] = useState<string | null>(null); // pointer drag
  const [overBin, setOverBin] = useState<Bin | null>(null);
  const [wobbleId, setWobbleId] = useState<string | null>(null);

  // A card released over empty space has no bin to clear the drag — clear it on
  // any pointer release so a card never keeps a stale "lifted" highlight. (A drop
  // onto a bin is handled by the bin's own onPointerUp first; this is a no-op then.)
  useEffect(() => {
    const clear = () => { setDragId(null); setOverBin(null); };
    window.addEventListener("pointerup", clear);
    return () => window.removeEventListener("pointerup", clear);
  }, []);

  const correctCount = useMemo(
    () => ITEMS.filter((i) => placed[i.id] === i.answer).length,
    [placed],
  );
  const done = correctCount === ITEMS.length;
  const trayItems = ITEMS.filter((i) => placed[i.id] === null);

  // The one action that does everything: try to drop `id` into `bin`.
  const tryDrop = useCallback((id: string, bin: Bin) => {
    const item = ITEMS.find((i) => i.id === id);
    if (!item) return;
    if (item.answer === bin) {
      setPlaced((prev) => ({ ...prev, [id]: bin }));
      setPicked(null);
    } else {
      // Gentle wobble, then bounce back to the tray. No penalty.
      setWobbleId(id);
      setPicked(null);
      window.setTimeout(() => setWobbleId((w) => (w === id ? null : w)), 480);
    }
  }, []);

  const onTapCard = useCallback((id: string) => {
    setPicked((p) => (p === id ? null : id));
  }, []);

  const onTapBin = useCallback(
    (bin: Bin) => {
      if (picked) tryDrop(picked, bin);
    },
    [picked, tryDrop],
  );

  const reset = useCallback(() => {
    setPlaced(Object.fromEntries(ITEMS.map((i) => [i.id, null])) as Record<string, Bin | null>);
    setPicked(null);
    setDragId(null);
    setOverBin(null);
    setWobbleId(null);
  }, []);

  // Teaching caption — short words, updates as the child plays, ends on the aha.
  const caption = done
    ? "🎉 You got them all! AI notices patterns and makes choices. A tool always does the exact same thing."
    : picked
      ? "Now tap a bin: 🤖 AI or 🔧 Not AI."
      : correctCount === 0
        ? "Drag a card to a bin — or tap a card, then tap a bin."
        : `Nice! ${correctCount} of ${ITEMS.length} sorted. Keep going!`;

  return (
    <div className="w-full" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      {/* Header row */}
      <div className="mx-auto flex max-w-[840px] flex-col gap-2 px-4 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span aria-hidden style={{ fontSize: 24 }}>🤖</span>
          <span className="text-base font-semibold tracking-wide">AI or Not AI?</span>
          <span
            className="rounded-md px-2 py-0.5 font-mono text-[10px]"
            style={{ background: `${ACCENT}1a`, color: ACCENT, border: `1px solid ${ACCENT}55` }}
          >
            Grades 1-3
          </span>
          <span className="font-mono text-[11px] text-[#5b6b8c]">· AI awareness</span>
        </div>
        <p
          aria-live="polite"
          className="min-h-[20px] font-mono text-[12px] leading-relaxed text-[#9fb0d0]"
        >
          {caption}
        </p>
      </div>

      {/* Board */}
      <div className="mx-auto flex max-w-[840px] flex-col gap-4 p-4">
        {/* Bins */}
        <div className="grid grid-cols-2 gap-3">
          {BINS.map((b) => {
            const items = ITEMS.filter((i) => placed[i.id] === b.id);
            const hot = overBin === b.id || (picked !== null && overBin === null);
            return (
              <button
                key={b.id}
                type="button"
                aria-label={`${b.title} bin — ${b.sub}`}
                onClick={() => onTapBin(b.id)}
                onPointerEnter={() => dragId && setOverBin(b.id)}
                onPointerLeave={() => setOverBin((o) => (o === b.id ? null : o))}
                onPointerUp={() => {
                  if (dragId) {
                    tryDrop(dragId, b.id);
                    setDragId(null);
                    setOverBin(null);
                  }
                }}
                className="flex min-h-[150px] flex-col rounded-2xl border-2 p-3 text-left transition-colors"
                style={{
                  borderColor: hot && (dragId || picked) ? b.color : "#1e2738",
                  background: hot && (dragId || picked) ? `${b.color}1a` : "#0b1018",
                }}
              >
                <div className="flex items-center gap-2">
                  <span aria-hidden style={{ fontSize: 26 }}>{b.emoji}</span>
                  <div className="leading-tight">
                    <div className="font-mono text-sm font-semibold" style={{ color: b.color }}>
                      {b.title}
                    </div>
                    <div className="font-mono text-[10px] text-[#5b6b8c]">{b.sub}</div>
                  </div>
                </div>
                {/* Landed items */}
                <div className="mt-2 flex flex-wrap content-start gap-2">
                  {items.map((i) => (
                    <span
                      key={i.id}
                      className="flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-[11px]"
                      style={{ borderColor: `${b.color}55`, background: `${b.color}12`, color: "#e8eefc" }}
                    >
                      <span aria-hidden style={{ fontSize: 16 }}>{i.emoji}</span>
                      {i.label}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {/* Tray of cards */}
        <div className="rounded-2xl border border-[#1e2738] bg-[#0f1420] p-3">
          <p className="mb-2 font-mono text-[10px] tracking-wide text-[#5b6b8c]">
            DRAG OR TAP A CARD ({trayItems.length} left)
          </p>
          {trayItems.length === 0 && !done ? (
            <p className="py-4 text-center font-mono text-[11px] text-[#9fb0d0]">
              All cards placed — fix any that wobbled back. 🙂
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {trayItems.map((i) => {
              const sel = picked === i.id || dragId === i.id;
              const wob = wobbleId === i.id;
              return (
                <button
                  key={i.id}
                  type="button"
                  aria-label={`${i.label} — choose a bin`}
                  aria-pressed={sel}
                  draggable={false}
                  onClick={() => onTapCard(i.id)}
                  onPointerDown={() => {
                    setDragId(i.id);
                    setPicked(i.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onTapCard(i.id);
                    }
                  }}
                  className="flex touch-none select-none flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 transition-colors"
                  style={{
                    borderColor: sel ? ACCENT : "#1e2738",
                    background: sel ? `${ACCENT}1a` : "#0b1018",
                    animation: wob ? "cl-wobble 0.46s ease-in-out" : undefined,
                  }}
                >
                  <span aria-hidden style={{ fontSize: 34 }}>{i.emoji}</span>
                  <span className="text-center font-mono text-[11px] text-[#e8eefc]">{i.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Celebration + lesson */}
        {done && (
          <div
            className="flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center"
            style={{ borderColor: ACCENT, background: `${ACCENT}14`, animation: "cl-pop 0.4s ease-out" }}
          >
            <div style={{ fontSize: 40 }} aria-hidden>🎉</div>
            <div style={{ fontSize: 24, letterSpacing: 4, color: "#eab308" }} aria-hidden>★★★</div>
            <p className="max-w-[460px] font-mono text-[12px] leading-relaxed text-[#e8eefc]">
              AI <span style={{ color: ACCENT }}>notices patterns</span> and{" "}
              <span style={{ color: ACCENT }}>makes choices</span>.
              <br />A tool always does the <span style={{ color: "#60a5fa" }}>exact same thing</span>.
            </p>
          </div>
        )}

        {/* Start over */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-[#2a3550] px-4 py-2 font-mono text-[11px] text-[#9fb0d0] transition-colors hover:border-[#fb7185] hover:text-[#fb7185]"
          >
            🔄 Play again
          </button>
        </div>
      </div>

      {/* Local keyframes (scoped, no global page styles) */}
      <style>{`
        @keyframes cl-wobble {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px) rotate(-3deg); }
          40% { transform: translateX(6px) rotate(3deg); }
          60% { transform: translateX(-4px) rotate(-2deg); }
          80% { transform: translateX(4px) rotate(2deg); }
        }
        @keyframes cl-pop {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
