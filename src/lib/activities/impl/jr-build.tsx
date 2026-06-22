"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ──────────────────────────────────────────────────────────────────────────
 * Build-a-Bot 🤖 — a JUNIOR (Class 1-3, age ~6-8) ROBOTICS lab.
 * ONE learning goal: a robot is MADE OF PARTS, each placed in the RIGHT SPOT.
 *
 * A robot outline shows six empty slots — head, body, two arms, two legs —
 * each with a faint ghost of the part that belongs there. A tray holds the six
 * parts. The child taps a part, then taps its slot; the part SNAPS in with a
 * bounce. Wrong slot → a gentle friendly wobble, never a scold. When every
 * slot is filled the robot WAKES UP: eyes light, it waves & wiggles, ⭐⭐⭐
 * pop in one by one and confetti bursts. Deterministic, always winnable,
 * understood from visuals alone — near-zero reading.
 * ────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#34d399";

/** Each part the child can place into the robot. */
type PartId = "head" | "body" | "armL" | "armR" | "legL" | "legR";

interface Part {
  id: PartId;
  glyph: string;
  label: string;
}

/** Tray order — head & body first, then arms, then legs. */
const PARTS: readonly Part[] = [
  { id: "head", glyph: "🤖", label: "Head" },
  { id: "body", glyph: "🟩", label: "Body" },
  { id: "armL", glyph: "🦾", label: "Left arm" },
  { id: "armR", glyph: "💪", label: "Right arm" },
  { id: "legL", glyph: "🦵", label: "Left leg" },
  { id: "legR", glyph: "🦿", label: "Right leg" },
];

/** A ghost slot on the silhouette that accepts exactly one part. */
interface Slot {
  id: PartId;
  x: number;
  y: number;
  r: number;
  ghost: string;
}

const SLOTS: readonly Slot[] = [
  { id: "head", x: 150, y: 66, r: 40, ghost: "🤖" },
  { id: "body", x: 150, y: 178, r: 46, ghost: "🟩" },
  { id: "armL", x: 64, y: 170, r: 28, ghost: "🦾" },
  { id: "armR", x: 236, y: 170, r: 28, ghost: "💪" },
  { id: "legL", x: 116, y: 290, r: 28, ghost: "🦵" },
  { id: "legR", x: 184, y: 290, r: 28, ghost: "🦿" },
];

type Placed = Record<PartId, boolean>;
const EMPTY: Placed = {
  head: false,
  body: false,
  armL: false,
  armR: false,
  legL: false,
  legR: false,
};

const glyphFor = (id: PartId): string =>
  PARTS.find((p) => p.id === id)?.glyph ?? "❓";

/** Stable confetti pieces for the win burst (angle + delay + glyph). */
const CONFETTI: readonly { dx: number; dy: number; delay: number; g: string }[] =
  Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    return {
      dx: Math.cos(a) * 96,
      dy: Math.sin(a) * 96 - 20,
      delay: (i % 5) * 0.05,
      g: ["✨", "🎉", "⭐", "💚", "🎊"][i % 5],
    };
  });

export default function BuildABot({ onComplete }: ActivityProps) {
  const [selected, setSelected] = useState<PartId | null>(null);
  const [placed, setPlaced] = useState<Placed>(EMPTY);
  /** Slot that just accepted a part — plays the snap-in pop. */
  const [pop, setPop] = useState<PartId | null>(null);
  /** Slot that just rejected a part — plays a soft wobble. */
  const [wobble, setWobble] = useState<PartId | null>(null);
  /** How many stars have popped in (staggered after the win). */
  const [stars, setStars] = useState<number>(0);

  const reportedRef = useRef<boolean>(false);
  const popTimer = useRef<number | null>(null);
  const wobbleTimer = useRef<number | null>(null);
  const starTimers = useRef<number[]>([]);

  const placedCount = useMemo<number>(
    () => SLOTS.reduce((n, s) => n + (placed[s.id] ? 1 : 0), 0),
    [placed],
  );
  const done = placedCount === SLOTS.length;

  const clearStarTimers = useCallback((): void => {
    for (const t of starTimers.current) window.clearTimeout(t);
    starTimers.current = [];
  }, []);

  // Tap a slot: drop the held part if it matches; else a gentle wobble.
  const tapSlot = useCallback(
    (id: PartId): void => {
      if (done || placed[id] || selected === null) return;
      if (selected === id) {
        setPlaced((prev) => ({ ...prev, [id]: true }));
        setSelected(null);
        setPop(id);
        if (popTimer.current !== null) window.clearTimeout(popTimer.current);
        popTimer.current = window.setTimeout(() => setPop(null), 460);
      } else {
        setWobble(id);
        if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
        wobbleTimer.current = window.setTimeout(() => setWobble(null), 500);
      }
    },
    [done, placed, selected],
  );

  const reset = useCallback((): void => {
    if (popTimer.current !== null) window.clearTimeout(popTimer.current);
    if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
    clearStarTimers();
    reportedRef.current = false;
    setSelected(null);
    setPlaced(EMPTY);
    setPop(null);
    setWobble(null);
    setStars(0);
  }, [clearStarTimers]);

  // Robot is fully built → wake up, pop stars one by one, report once.
  useEffect(() => {
    if (!done) return;
    if (!reportedRef.current) {
      reportedRef.current = true;
      onComplete({
        passed: true,
        stars: 3,
        detail: "Every part is in its right spot — the robot woke up! 🤖",
      });
    }
    clearStarTimers();
    setStars(0);
    starTimers.current = [1, 2, 3].map((n) =>
      window.setTimeout(() => setStars(n), 360 * n),
    );
  }, [done, onComplete, clearStarTimers]);

  useEffect(
    () => () => {
      if (popTimer.current !== null) window.clearTimeout(popTimer.current);
      if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
      for (const t of starTimers.current) window.clearTimeout(t);
    },
    [],
  );

  // Emoji-only status: pick a part 👇 → build → party 🎉.
  const statusEmoji = done ? "🎉" : selected !== null ? "👇" : "🤖";

  return (
    <div className="flex w-full max-w-[430px] flex-col items-center gap-3">
      {/* ── Tiny emoji status (no paragraph to read) ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={
          done
            ? "The robot woke up!"
            : selected !== null
              ? "Now tap the matching spot"
              : "Pick a part"
        }
        style={{
          background: done ? "rgba(52,211,153,0.16)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${done ? ACCENT : "var(--color-line, #27314f)"}`,
          boxShadow: done ? `0 0 20px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true">{statusEmoji}</span>
        {done ? (
          <span aria-hidden="true" className="text-2xl">
            {"⭐".repeat(stars)}
            {"·".repeat(3 - stars)}
          </span>
        ) : (
          <span aria-hidden="true" className="text-xl opacity-80">
            🧩 {placedCount}/6
          </span>
        )}
      </div>

      {/* ── Build canvas ── */}
      <div
        className="panel relative w-full overflow-hidden rounded-2xl border border-line p-2"
        style={{
          background: done
            ? "radial-gradient(circle at 50% 42%, rgba(52,211,153,0.18), transparent 64%)"
            : undefined,
          transition: "background 400ms ease",
        }}
      >
        <svg
          viewBox="0 0 300 350"
          className="block w-full select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="A robot outline with empty slots for a head, body, two arms and two legs. Pick a part, then tap its matching spot."
        >
          <defs>
            <filter id="jb-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="jb-halo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.22" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Soft pulsing halo once the robot is alive */}
          {done && (
            <circle cx="150" cy="178" r="150" fill="url(#jb-halo)">
              <animate
                attributeName="r"
                values="135;158;135"
                dur="2.4s"
                repeatCount="indefinite"
              />
            </circle>
          )}

          {/* The whole robot idle-bobs / wakes-wiggles as a group */}
          <g
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              animation: done
                ? "jrbuild-wiggle 1.6s ease-in-out 1, jrbuild-bob 2.6s ease-in-out 1.6s infinite"
                : "jrbuild-bob 2.8s ease-in-out infinite",
            }}
          >
            {/* connector spine so parts feel joined */}
            <line
              x1="150"
              y1="100"
              x2="150"
              y2="262"
              stroke="#27314f"
              strokeWidth="6"
              strokeLinecap="round"
            />

            {/* ── LEGS ── */}
            <Ghost slot={SLOTS[4]} state={cell("legL", placed, selected, pop, wobble)} onTap={tapSlot}>
              <rect x={SLOTS[4].x - 12} y={SLOTS[4].y - 14} width="24" height="56" rx="11" fill="#0f2a22" stroke={ACCENT} strokeWidth="3" style={NOHIT} />
              <rect x={SLOTS[4].x - 16} y={SLOTS[4].y + 40} width="32" height="14" rx="7" fill={ACCENT} style={NOHIT} />
            </Ghost>
            <Ghost slot={SLOTS[5]} state={cell("legR", placed, selected, pop, wobble)} onTap={tapSlot}>
              <rect x={SLOTS[5].x - 12} y={SLOTS[5].y - 14} width="24" height="56" rx="11" fill="#0f2a22" stroke={ACCENT} strokeWidth="3" style={NOHIT} />
              <rect x={SLOTS[5].x - 16} y={SLOTS[5].y + 40} width="32" height="14" rx="7" fill={ACCENT} style={NOHIT} />
            </Ghost>

            {/* ── BODY ── */}
            <Ghost slot={SLOTS[1]} state={cell("body", placed, selected, pop, wobble)} onTap={tapSlot}>
              <rect x={SLOTS[1].x - 46} y={SLOTS[1].y - 46} width="92" height="92" rx="20" fill="#0f2a22" stroke={ACCENT} strokeWidth="3" style={NOHIT} />
              {/* tummy lights pulse when alive */}
              <circle cx={SLOTS[1].x - 18} cy={SLOTS[1].y} r="7" fill={ACCENT} style={NOHIT}>
                {done && <animate attributeName="opacity" values="0.4;1;0.4" dur="1s" repeatCount="indefinite" />}
              </circle>
              <circle cx={SLOTS[1].x + 18} cy={SLOTS[1].y} r="7" fill={ACCENT} style={NOHIT}>
                {done && <animate attributeName="opacity" values="1;0.4;1" dur="1s" repeatCount="indefinite" />}
              </circle>
              <text x={SLOTS[1].x} y={SLOTS[1].y + 30} textAnchor="middle" fontSize="18" style={NOHIT}>⚙️</text>
            </Ghost>

            {/* ── RIGHT ARM (still) ── */}
            <Ghost slot={SLOTS[3]} state={cell("armR", placed, selected, pop, wobble)} onTap={tapSlot}>
              <rect x={SLOTS[3].x - 9} y={SLOTS[3].y - 22} width="18" height="54" rx="9" fill="#0f2a22" stroke={ACCENT} strokeWidth="3" style={NOHIT} />
              <text x={SLOTS[3].x} y={SLOTS[3].y - 26} textAnchor="middle" fontSize="22" style={NOHIT}>🤚</text>
            </Ghost>

            {/* ── LEFT ARM (waves when awake) ── */}
            <g
              style={{
                transformBox: "fill-box",
                transformOrigin: `${SLOTS[2].x + 9}px ${SLOTS[2].y - 18}px`,
                animation: done ? "jrbuild-wave 0.55s ease-in-out 4" : undefined,
              }}
            >
              <Ghost slot={SLOTS[2]} state={cell("armL", placed, selected, pop, wobble)} onTap={tapSlot}>
                <rect x={SLOTS[2].x - 9} y={SLOTS[2].y - 22} width="18" height="54" rx="9" fill="#0f2a22" stroke={ACCENT} strokeWidth="3" style={NOHIT} />
                <text x={SLOTS[2].x} y={SLOTS[2].y - 26} textAnchor="middle" fontSize="22" style={NOHIT}>✋</text>
              </Ghost>
            </g>

            {/* ── HEAD ── */}
            <Ghost slot={SLOTS[0]} state={cell("head", placed, selected, pop, wobble)} onTap={tapSlot}>
              <line x1={SLOTS[0].x} y1={SLOTS[0].y - 34} x2={SLOTS[0].x} y2={SLOTS[0].y - 52} stroke={ACCENT} strokeWidth="3" style={NOHIT} />
              <circle cx={SLOTS[0].x} cy={SLOTS[0].y - 54} r="5" fill={ACCENT} style={NOHIT}>
                {done && <animate attributeName="r" values="5;7;5" dur="0.9s" repeatCount="indefinite" />}
              </circle>
              <rect x={SLOTS[0].x - 38} y={SLOTS[0].y - 34} width="76" height="68" rx="18" fill="#0f2a22" stroke={ACCENT} strokeWidth="3" style={NOHIT} />
              {/* eyes light up when the robot wakes */}
              <text x={SLOTS[0].x} y={SLOTS[0].y + 8} textAnchor="middle" fontSize="26" style={NOHIT} filter={done ? "url(#jb-glow)" : undefined}>
                {done ? "😄" : "💤"}
              </text>
            </Ghost>
          </g>
        </svg>
      </div>

      {/* ── Parts tray ── */}
      <div
        className="flex min-h-[84px] w-full flex-wrap items-center justify-center gap-2 rounded-2xl px-2 py-2"
        style={{ background: "rgba(255,255,255,0.04)", border: "2px dashed var(--color-line, #27314f)" }}
        aria-label="Tray of robot parts — pick one"
      >
        {done ? (
          <span aria-hidden="true" className="text-3xl">🤖 ✨ 🎉 ✨</span>
        ) : (
          PARTS.map((p) => {
            if (placed[p.id]) return null;
            const active = selected === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setSelected(active ? null : p.id);
                }}
                aria-pressed={active}
                aria-label={`Pick ${p.label}`}
                className="grid h-[72px] w-[72px] place-items-center rounded-2xl text-4xl"
                style={{
                  touchAction: "none",
                  border: `2px solid ${active ? ACCENT : "var(--color-line, #27314f)"}`,
                  background: active ? "rgba(52,211,153,0.18)" : "rgba(11,16,32,0.6)",
                  boxShadow: active
                    ? `0 0 18px ${ACCENT}, 0 5px 0 0 #15805c`
                    : "0 5px 0 0 #1a2236",
                  transform: active ? "translateY(-2px)" : undefined,
                  animation: active ? "jrbuild-picked 0.9s ease-in-out infinite" : undefined,
                  transition: "transform 120ms cubic-bezier(.34,1.56,.64,1)",
                }}
              >
                <span aria-hidden="true">{p.glyph}</span>
              </button>
            );
          })
        )}
      </div>

      {/* ── Reset ── */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          reset();
        }}
        aria-label="Start over"
        className="grid h-[60px] w-[72px] place-items-center rounded-2xl text-3xl"
        style={{
          touchAction: "none",
          border: "2px solid var(--color-line, #27314f)",
          background: "rgba(255,255,255,0.05)",
          boxShadow: "0 5px 0 0 #1a2236",
        }}
      >
        <span aria-hidden="true">🔄</span>
      </button>

      {/* ── Confetti party on win ── */}
      {done && (
        <div className="pointer-events-none absolute left-1/2 top-1/3 -z-0" aria-hidden="true">
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className="absolute text-2xl"
              style={{
                left: 0,
                top: 0,
                animation: `jrbuild-confetti 1100ms cubic-bezier(.22,.61,.36,1) ${c.delay}s both`,
                // pass per-piece distance via CSS custom props
                ["--dx" as string]: `${c.dx}px`,
                ["--dy" as string]: `${c.dy}px`,
              }}
            >
              {c.g}
            </span>
          ))}
        </div>
      )}

      <style>{`
        @keyframes jrbuild-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes jrbuild-wiggle {
          0%, 100% { transform: rotate(0deg) scale(1); }
          20% { transform: rotate(-5deg) scale(1.04); }
          50% { transform: rotate(5deg) scale(1.06); }
          80% { transform: rotate(-3deg) scale(1.03); }
        }
        @keyframes jrbuild-wave {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(36deg); }
        }
        @keyframes jrbuild-pop {
          0% { transform: scale(0.4) translateY(-10px); opacity: 0.3; }
          55% { transform: scale(1.22) translateY(0); opacity: 1; }
          75% { transform: scale(0.94); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes jrbuild-wobble {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-7deg); }
          60% { transform: rotate(6deg); }
          85% { transform: rotate(-3deg); }
        }
        @keyframes jrbuild-picked {
          0%, 100% { transform: translateY(-2px) scale(1); }
          50% { transform: translateY(-6px) scale(1.06); }
        }
        @keyframes jrbuild-ghost {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.95; }
        }
        @keyframes jrbuild-confetti {
          0% { transform: translate(0, 0) scale(0.4); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(1.1); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="jrbuild-bob"], [style*="jrbuild-picked"],
          [style*="jrbuild-ghost"], [style*="jrbuild-wiggle"],
          [style*="jrbuild-wave"] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ── Slot visual state, derived once per render ─────────────────────────── */
interface SlotState {
  filled: boolean;
  selected: boolean;
  pop: boolean;
  wobble: boolean;
}

const cell = (
  id: PartId,
  placed: Placed,
  selected: PartId | null,
  pop: PartId | null,
  wobble: PartId | null,
): SlotState => ({
  filled: placed[id],
  selected: selected === id,
  pop: pop === id,
  wobble: wobble === id,
});

/** Shared "no pointer events" style for inner SVG art (hits go to the group). */
const NOHIT: React.CSSProperties = { pointerEvents: "none" };

/** A ghost slot: a faded target when empty, the real part when filled. */
interface GhostProps {
  slot: Slot;
  state: SlotState;
  onTap: (id: PartId) => void;
  children: React.ReactNode;
}

function Ghost({ slot, state, onTap, children }: GhostProps) {
  const { filled, selected, pop, wobble } = state;
  return (
    <g
      onPointerDown={(e) => {
        e.preventDefault();
        onTap(slot.id);
      }}
      role="button"
      aria-label={`${slot.id} spot`}
      style={{
        cursor: filled ? "default" : "pointer",
        touchAction: "none",
        transformBox: "fill-box",
        transformOrigin: "center",
        animation: wobble
          ? "jrbuild-wobble 0.5s ease"
          : pop
            ? "jrbuild-pop 0.46s cubic-bezier(.34,1.56,.64,1)"
            : undefined,
      }}
    >
      {/* big invisible hit-area for little fingers */}
      <circle cx={slot.x} cy={slot.y} r={Math.max(slot.r, 30)} fill="transparent" />

      {filled ? (
        <g filter={pop ? "url(#jb-glow)" : undefined}>{children}</g>
      ) : (
        <>
          <circle
            cx={slot.x}
            cy={slot.y}
            r={slot.r}
            fill={selected ? "rgba(52,211,153,0.16)" : "rgba(11,16,32,0.55)"}
            stroke={selected ? ACCENT : "#3a4566"}
            strokeWidth="3"
            strokeDasharray="7 6"
            style={{ transition: "stroke 200ms ease, fill 200ms ease" }}
          >
            {selected && (
              <animate
                attributeName="r"
                values={`${slot.r};${slot.r + 4};${slot.r}`}
                dur="1.2s"
                repeatCount="indefinite"
              />
            )}
          </circle>
          <text
            x={slot.x}
            y={slot.y + 9}
            textAnchor="middle"
            fontSize="26"
            style={{
              pointerEvents: "none",
              animation: selected ? "jrbuild-ghost 1s ease-in-out infinite" : undefined,
              opacity: 0.5,
            }}
          >
            {slot.ghost || glyphFor(slot.id)}
          </text>
        </>
      )}
    </g>
  );
}
