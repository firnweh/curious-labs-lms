"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ACCENT = "#34d399";

/** The parts a child can place into the robot. */
type PartId = "head" | "eyes" | "body" | "armL" | "armR" | "wheels";

interface Part {
  id: PartId;
  glyph: string;
  /** Friendly name for screen readers. */
  label: string;
}

const PARTS: Part[] = [
  { id: "head", glyph: "🟦", label: "Head" },
  { id: "eyes", glyph: "👀", label: "Eyes" },
  { id: "body", glyph: "🟩", label: "Body" },
  { id: "armL", glyph: "🦾", label: "Left arm" },
  { id: "armR", glyph: "🦾", label: "Right arm" },
  { id: "wheels", glyph: "🛞", label: "Wheels" },
];

/** A ghost slot on the robot silhouette that accepts exactly one part. */
interface Slot {
  id: PartId;
  /** SVG centre of the slot. */
  x: number;
  y: number;
  /** Tap-target radius. */
  r: number;
}

const SLOTS: Slot[] = [
  { id: "head", x: 180, y: 70, r: 40 },
  { id: "eyes", x: 180, y: 70, r: 26 },
  { id: "body", x: 180, y: 185, r: 46 },
  { id: "armL", x: 96, y: 175, r: 28 },
  { id: "armR", x: 264, y: 175, r: 28 },
  { id: "wheels", x: 180, y: 280, r: 40 },
];

type Placed = Record<PartId, boolean>;

const EMPTY: Placed = {
  head: false,
  eyes: false,
  body: false,
  armL: false,
  armR: false,
  wheels: false,
};

function glyphFor(id: PartId): string {
  return PARTS.find((p) => p.id === id)?.glyph ?? "❓";
}

export default function RobotBuddy({ onComplete }: ActivityProps) {
  const [selected, setSelected] = useState<PartId | null>(null);
  const [placed, setPlaced] = useState<Placed>(EMPTY);
  const [waved, setWaved] = useState<boolean>(false);
  const [waving, setWaving] = useState<boolean>(false);
  /** Slot that just rejected a wrong part — triggers a gentle bounce. */
  const [bounce, setBounce] = useState<PartId | null>(null);
  /** Slot that just accepted a part — triggers a happy pop. */
  const [pop, setPop] = useState<PartId | null>(null);

  const reportedRef = useRef<boolean>(false);
  const bounceTimer = useRef<number | null>(null);
  const popTimer = useRef<number | null>(null);
  const waveTimer = useRef<number | null>(null);

  const assembled = useMemo<boolean>(
    () => SLOTS.every((s) => placed[s.id]),
    [placed],
  );

  const placedCount = useMemo<number>(
    () => SLOTS.reduce((n, s) => n + (placed[s.id] ? 1 : 0), 0),
    [placed],
  );

  const solved = assembled && waved;

  // Tap a slot: drop the selected part if it matches; otherwise bounce back.
  const tapSlot = useCallback(
    (id: PartId): void => {
      if (solved || placed[id]) return;
      if (selected === null) return;
      if (selected === id) {
        setPlaced((prev) => ({ ...prev, [id]: true }));
        setSelected(null);
        setPop(id);
        if (popTimer.current !== null) window.clearTimeout(popTimer.current);
        popTimer.current = window.setTimeout(() => setPop(null), 420);
      } else {
        // Wrong slot — friendly wobble, keep the part in hand.
        setBounce(id);
        if (bounceTimer.current !== null) window.clearTimeout(bounceTimer.current);
        bounceTimer.current = window.setTimeout(() => setBounce(null), 480);
      }
    },
    [solved, placed, selected],
  );

  const triggerWave = useCallback((): void => {
    if (!assembled) return;
    setWaved(true);
    setWaving(true);
    if (waveTimer.current !== null) window.clearTimeout(waveTimer.current);
    waveTimer.current = window.setTimeout(() => setWaving(false), 1600);
  }, [assembled]);

  const reset = useCallback((): void => {
    if (bounceTimer.current !== null) window.clearTimeout(bounceTimer.current);
    if (popTimer.current !== null) window.clearTimeout(popTimer.current);
    if (waveTimer.current !== null) window.clearTimeout(waveTimer.current);
    reportedRef.current = false;
    setSelected(null);
    setPlaced(EMPTY);
    setWaved(false);
    setWaving(false);
    setBounce(null);
    setPop(null);
  }, []);

  // Celebrate exactly once when assembled AND the robot has waved.
  useEffect(() => {
    if (solved && !reportedRef.current) {
      reportedRef.current = true;
      onComplete({ passed: true, stars: 3 });
    }
  }, [solved, onComplete]);

  useEffect(() => {
    return () => {
      if (bounceTimer.current !== null) window.clearTimeout(bounceTimer.current);
      if (popTimer.current !== null) window.clearTimeout(popTimer.current);
      if (waveTimer.current !== null) window.clearTimeout(waveTimer.current);
    };
  }, []);

  // Emoji-only status: pick a part → place it → wave → party.
  const statusEmoji = solved
    ? "🎉"
    : assembled
      ? "👋"
      : selected !== null
        ? "👇"
        : "🤖";

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Build canvas */}
      <div
        className="panel relative overflow-hidden rounded-2xl border border-line p-2"
        style={{
          background: solved
            ? "radial-gradient(circle at 50% 42%, rgba(52,211,153,0.18), transparent 62%)"
            : undefined,
          transition: "background 400ms ease",
        }}
      >
        <svg
          viewBox="0 0 360 340"
          className="block w-full select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="A robot outline with empty slots for a head, eyes, body, two arms and wheels. Pick a part, then tap its matching slot. When the robot is built, make it wave."
        >
          <defs>
            <filter id="rbGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="rbHalo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.22" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Soft halo behind a finished robot */}
          {assembled && (
            <circle cx="180" cy="175" r="150" fill="url(#rbHalo)" opacity="0.5">
              <animate
                attributeName="r"
                values="140;160;140"
                dur="2.4s"
                repeatCount="indefinite"
              />
            </circle>
          )}

          {/* ---- WHEELS / FEET (bottom) ---- */}
          <Ghost
            slot={SLOTS[5]}
            filled={placed.wheels}
            selected={selected === "wheels"}
            bounce={bounce === "wheels"}
            pop={pop === "wheels"}
            onTap={tapSlot}
          >
            <text x={SLOTS[5].x - 26} y={SLOTS[5].y + 14} textAnchor="middle" fontSize="40" style={{ pointerEvents: "none" }}>
              🛞
            </text>
            <text x={SLOTS[5].x + 26} y={SLOTS[5].y + 14} textAnchor="middle" fontSize="40" style={{ pointerEvents: "none" }}>
              🛞
            </text>
          </Ghost>

          {/* ---- BODY (centre) ---- */}
          <Ghost
            slot={SLOTS[2]}
            filled={placed.body}
            selected={selected === "body"}
            bounce={bounce === "body"}
            pop={pop === "body"}
            onTap={tapSlot}
          >
            <rect
              x={SLOTS[2].x - 44}
              y={SLOTS[2].y - 44}
              width="88"
              height="88"
              rx="18"
              fill="#0f2a22"
              stroke={ACCENT}
              strokeWidth="3"
              style={{ pointerEvents: "none" }}
            />
            <circle cx={SLOTS[2].x} cy={SLOTS[2].y} r="14" fill={ACCENT} style={{ pointerEvents: "none" }} />
            <text x={SLOTS[2].x} y={SLOTS[2].y + 8} textAnchor="middle" fontSize="20" style={{ pointerEvents: "none" }}>
              ⚙️
            </text>
          </Ghost>

          {/* ---- LEFT ARM ---- (swings during a wave) */}
          <g
            style={{
              transformBox: "fill-box",
              transformOrigin: `${SLOTS[3].x + 18}px ${SLOTS[3].y - 18}px`,
              animation: waving ? "rb-wave 0.5s ease-in-out 3" : undefined,
            }}
          >
            <Ghost
              slot={SLOTS[3]}
              filled={placed.armL}
              selected={selected === "armL"}
              bounce={bounce === "armL"}
              pop={pop === "armL"}
              onTap={tapSlot}
            >
              <rect
                x={SLOTS[3].x - 8}
                y={SLOTS[3].y - 22}
                width="16"
                height="50"
                rx="8"
                fill="#0f2a22"
                stroke={ACCENT}
                strokeWidth="3"
                style={{ pointerEvents: "none" }}
              />
              <text x={SLOTS[3].x} y={SLOTS[3].y - 24} textAnchor="middle" fontSize="22" style={{ pointerEvents: "none" }}>
                ✋
              </text>
            </Ghost>
          </g>

          {/* ---- RIGHT ARM ---- */}
          <Ghost
            slot={SLOTS[4]}
            filled={placed.armR}
            selected={selected === "armR"}
            bounce={bounce === "armR"}
            pop={pop === "armR"}
            onTap={tapSlot}
          >
            <rect
              x={SLOTS[4].x - 8}
              y={SLOTS[4].y - 22}
              width="16"
              height="50"
              rx="8"
              fill="#0f2a22"
              stroke={ACCENT}
              strokeWidth="3"
              style={{ pointerEvents: "none" }}
            />
            <text x={SLOTS[4].x} y={SLOTS[4].y - 24} textAnchor="middle" fontSize="22" style={{ pointerEvents: "none" }}>
              🤚
            </text>
          </Ghost>

          {/* ---- HEAD ---- */}
          <Ghost
            slot={SLOTS[0]}
            filled={placed.head}
            selected={selected === "head"}
            bounce={bounce === "head"}
            pop={pop === "head"}
            onTap={tapSlot}
          >
            <rect
              x={SLOTS[0].x - 40}
              y={SLOTS[0].y - 36}
              width="80"
              height="72"
              rx="20"
              fill="#0f2a22"
              stroke={ACCENT}
              strokeWidth="3"
              style={{ pointerEvents: "none" }}
            />
            {/* little antenna */}
            <line x1={SLOTS[0].x} y1={SLOTS[0].y - 36} x2={SLOTS[0].x} y2={SLOTS[0].y - 54} stroke={ACCENT} strokeWidth="3" style={{ pointerEvents: "none" }} />
            <circle cx={SLOTS[0].x} cy={SLOTS[0].y - 56} r="5" fill={ACCENT} style={{ pointerEvents: "none" }} />
          </Ghost>

          {/* ---- EYES (on the head — only meaningful once the head is on) ---- */}
          {placed.head && (
            <Ghost
              slot={SLOTS[1]}
              filled={placed.eyes}
              selected={selected === "eyes"}
              bounce={bounce === "eyes"}
              pop={pop === "eyes"}
              onTap={tapSlot}
            >
              <text x={SLOTS[1].x} y={SLOTS[1].y + 8} textAnchor="middle" fontSize="26" style={{ pointerEvents: "none" }}>
                {solved ? "😄" : assembled ? "🙂" : "👀"}
              </text>
            </Ghost>
          )}
        </svg>

        {/* Emoji-only status — no paragraph to read */}
        <div className="mt-1 flex items-center justify-center text-3xl" aria-live="polite">
          <span aria-hidden="true">{statusEmoji}</span>
        </div>

        {/* Celebration burst */}
        {solved && (
          <div className="pointer-events-none flex justify-center gap-2 text-2xl">
            <span className="animate-float" aria-hidden="true">✨</span>
            <span className="animate-float" style={{ animationDelay: "0.2s" }} aria-hidden="true">🎉</span>
            <span className="animate-float" style={{ animationDelay: "0.4s" }} aria-hidden="true">✨</span>
          </div>
        )}
      </div>

      {/* Parts tray */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {PARTS.map((p) => {
          const used = placed[p.id];
          const active = selected === p.id;
          if (used) return null;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(active ? null : p.id)}
              disabled={solved}
              aria-pressed={active}
              aria-label={`Pick ${p.label}`}
              className="flex min-h-[56px] min-w-[56px] items-center justify-center rounded-2xl text-3xl transition active:scale-95 disabled:opacity-50"
              style={
                active
                  ? { background: ACCENT, boxShadow: `0 0 18px ${ACCENT}`, transform: "scale(1.08)" }
                  : {
                      borderWidth: 2,
                      borderStyle: "solid",
                      borderColor: "var(--color-line, #27314f)",
                      background: "rgba(11,16,32,0.6)",
                    }
              }
            >
              <span aria-hidden="true">{p.glyph}</span>
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {/* Wave button — only lights up once the robot is assembled */}
        <button
          type="button"
          onClick={triggerWave}
          disabled={!assembled || solved}
          aria-label={assembled ? "Make the robot wave" : "Finish building, then wave"}
          className="font-display flex min-h-[56px] items-center gap-2 rounded-2xl px-6 py-3 text-lg font-bold transition active:scale-95 disabled:opacity-60"
          style={
            assembled
              ? { background: ACCENT, color: "#060810", boxShadow: `0 0 18px ${ACCENT}` }
              : {
                  background: "rgba(11,16,32,0.6)",
                  color: "#9aa6cf",
                  borderWidth: 2,
                  borderStyle: "solid",
                  borderColor: "var(--color-line, #27314f)",
                }
          }
        >
          <span aria-hidden="true" className="text-2xl">👋</span>
          Wave!
        </button>

        {/* Start over */}
        <button
          type="button"
          onClick={reset}
          aria-label="Start over"
          className="flex min-h-[56px] items-center gap-2 rounded-2xl border-2 border-line bg-panel/60 px-5 py-3 text-lg font-bold text-ink-dim transition active:scale-95"
        >
          <span aria-hidden="true" className="text-2xl">🔄</span>
        </button>
      </div>

      {/* Progress dots — emoji, no reading needed */}
      <div className="flex items-center justify-center gap-1 text-sm text-ink-faint" aria-hidden="true">
        {SLOTS.map((s) => (
          <span key={s.id}>{placed[s.id] ? "🟢" : "⚪"}</span>
        ))}
        <span className="ml-1 text-ink-dim">
          {placedCount}/{SLOTS.length}
        </span>
      </div>

      <style>{`
        @keyframes rb-wave {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(34deg); }
        }
        @keyframes rb-bounce {
          0%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
          60% { transform: translateY(3px); }
        }
        @keyframes rb-pop {
          0% { transform: scale(0.6); opacity: 0.4; }
          60% { transform: scale(1.18); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/** A ghost slot: a faded target when empty, the real part when filled. */
interface GhostProps {
  slot: Slot;
  filled: boolean;
  selected: boolean;
  bounce: boolean;
  pop: boolean;
  onTap: (id: PartId) => void;
  children: React.ReactNode;
}

function Ghost({ slot, filled, selected, bounce, pop, onTap, children }: GhostProps) {
  return (
    <g
      onClick={() => onTap(slot.id)}
      role="button"
      aria-label={`${slot.id} slot`}
      style={{
        cursor: filled ? "default" : "pointer",
        transformBox: "fill-box",
        transformOrigin: "center",
        animation: bounce ? "rb-bounce 0.48s ease" : pop ? "rb-pop 0.42s ease" : undefined,
      }}
    >
      {/* big invisible hit area for little fingers */}
      <circle cx={slot.x} cy={slot.y} r={Math.max(slot.r, 26)} fill="transparent" />

      {filled ? (
        <g filter={pop ? "url(#rbGlow)" : undefined}>{children}</g>
      ) : (
        <>
          {/* faded outline of what goes here */}
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
              <animate attributeName="r" values={`${slot.r};${slot.r + 4};${slot.r}`} dur="1.3s" repeatCount="indefinite" />
            )}
          </circle>
          <text
            x={slot.x}
            y={slot.y + 9}
            textAnchor="middle"
            fontSize="26"
            opacity="0.45"
            style={{ pointerEvents: "none" }}
          >
            {glyphFor(slot.id)}
          </text>
        </>
      )}
    </g>
  );
}
