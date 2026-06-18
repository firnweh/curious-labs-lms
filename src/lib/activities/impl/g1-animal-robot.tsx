"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ACCENT = "#34d399";

/** The four buildable parts of the butterfly robot. */
type PartId = "wingL" | "wingR" | "antennae" | "motor";

interface Part {
  id: PartId;
  glyph: string;
  /** Big-finger label, read aloud to screen readers only. */
  name: string;
}

const PARTS: readonly Part[] = [
  { id: "wingL", glyph: "🌸", name: "Left wing" },
  { id: "wingR", glyph: "🌺", name: "Right wing" },
  { id: "antennae", glyph: "📡", name: "Antennae" },
  { id: "motor", glyph: "⚙️", name: "Motor" },
] as const;

/** A faded slot on the robot body where a matching part belongs. */
interface Slot {
  id: PartId;
  /** SVG centre of the ghost slot. */
  x: number;
  y: number;
  /** Hint glyph shown faded while the slot is empty. */
  ghost: string;
}

const SLOTS: readonly Slot[] = [
  { id: "wingL", x: 112, y: 132, ghost: "🌸" },
  { id: "wingR", x: 248, y: 132, ghost: "🌺" },
  { id: "antennae", x: 180, y: 52, ghost: "📡" },
  { id: "motor", x: 180, y: 158, ghost: "⚙️" },
] as const;

type Placed = Record<PartId, boolean>;

const NONE_PLACED: Placed = {
  wingL: false,
  wingR: false,
  antennae: false,
  motor: false,
};

function glyphFor(id: PartId): string {
  return PARTS.find((p) => p.id === id)?.glyph ?? "?";
}

export default function AnimalRobot({ onComplete }: ActivityProps) {
  const [selected, setSelected] = useState<PartId | null>(null);
  const [placed, setPlaced] = useState<Placed>(NONE_PLACED);
  const [powered, setPowered] = useState<boolean>(false);
  const [bounceSlot, setBounceSlot] = useState<PartId | null>(null);

  const reportedRef = useRef<boolean>(false);
  const bounceTimer = useRef<number | null>(null);

  const allPlaced = useMemo<boolean>(
    () => PARTS.every((p) => placed[p.id]),
    [placed],
  );

  const flapping = allPlaced && powered;

  // Celebrate exactly once, when the butterfly comes to life.
  useEffect(() => {
    if (flapping && !reportedRef.current) {
      reportedRef.current = true;
      onComplete({ passed: true, stars: 3 });
    }
  }, [flapping, onComplete]);

  useEffect(() => {
    return () => {
      if (bounceTimer.current !== null) window.clearTimeout(bounceTimer.current);
    };
  }, []);

  const nudge = useCallback((slotId: PartId): void => {
    setBounceSlot(slotId);
    if (bounceTimer.current !== null) window.clearTimeout(bounceTimer.current);
    bounceTimer.current = window.setTimeout(() => setBounceSlot(null), 480);
  }, []);

  const tapSlot = useCallback(
    (slot: Slot): void => {
      if (flapping) return;
      if (placed[slot.id]) return; // already filled
      if (selected === null) return; // nothing held — silent, slots glow as cue
      if (selected === slot.id) {
        // Right home for the held part.
        setPlaced((prev) => ({ ...prev, [slot.id]: true }));
        setSelected(null);
      } else {
        // Wrong slot — gentle bounce-back, keep the part in hand.
        nudge(slot.id);
      }
    },
    [flapping, placed, selected, nudge],
  );

  const togglePart = useCallback(
    (id: PartId): void => {
      if (flapping) return;
      if (placed[id]) return; // it's on the robot already
      setSelected((cur) => (cur === id ? null : id));
    },
    [flapping, placed],
  );

  const powerOn = useCallback((): void => {
    if (!allPlaced) {
      // Friendly cue: bounce the first empty slot.
      const empty = PARTS.find((p) => !placed[p.id]);
      if (empty) nudge(empty.id);
      return;
    }
    setPowered(true);
  }, [allPlaced, placed, nudge]);

  const reset = useCallback((): void => {
    if (bounceTimer.current !== null) window.clearTimeout(bounceTimer.current);
    reportedRef.current = false;
    setSelected(null);
    setPlaced(NONE_PLACED);
    setPowered(false);
    setBounceSlot(null);
  }, []);

  // Status emoji only — no reading required.
  const statusEmoji = flapping
    ? "🎉"
    : allPlaced
      ? "⚡"
      : selected !== null
        ? "👇"
        : "🦋";

  const motorPlaced = placed.motor;

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Scene */}
      <div
        className="panel relative overflow-hidden rounded-2xl border border-line p-2"
        style={{
          background: flapping
            ? "radial-gradient(circle at 50% 45%, rgba(52,211,153,0.18), transparent 65%)"
            : undefined,
          transition: "background 400ms ease",
        }}
      >
        <svg
          viewBox="0 0 360 220"
          className="block w-full select-none"
          role="img"
          aria-label="A butterfly robot with faded slots for a left wing, right wing, antennae and a motor. Pick a part, then tap its matching slot. When every part is placed, press Power On to make the wings flap."
        >
          <defs>
            <filter id="ar-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="ar-halo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#d9fff0" />
              <stop offset="45%" stopColor={ACCENT} />
              <stop offset="100%" stopColor="rgba(52,211,153,0)" />
            </radialGradient>
          </defs>

          {/* celebratory halo behind the body */}
          {flapping && (
            <circle cx="180" cy="120" r="74" fill="url(#ar-halo)" opacity="0.9">
              <animate
                attributeName="r"
                values="62;80;62"
                dur="1.4s"
                repeatCount="indefinite"
              />
            </circle>
          )}

          {/* ---- Thorax / body ---- */}
          <g transform="translate(180 120)">
            <ellipse
              cx="0"
              cy="0"
              rx="22"
              ry="44"
              fill="#0b1020"
              stroke={ACCENT}
              strokeWidth="3"
            />
            {/* body segment beads */}
            <circle cx="0" cy="-20" r="4" fill={ACCENT} opacity="0.7" />
            <circle cx="0" cy="0" r="4" fill={ACCENT} opacity="0.7" />
            <circle cx="0" cy="20" r="4" fill={ACCENT} opacity="0.7" />
          </g>

          {/* ---- Slots & placed parts ---- */}
          {SLOTS.map((slot) => {
            const isWing = slot.id === "wingL" || slot.id === "wingR";
            const filled = placed[slot.id];
            const bouncing = bounceSlot === slot.id;
            const selectable = selected !== null && !filled && !flapping;

            // Flap transform applies only to wings while powered.
            const flapStyle: React.CSSProperties =
              isWing && flapping
                ? {
                    transformBox: "fill-box",
                    transformOrigin:
                      slot.id === "wingL" ? "100% 50%" : "0% 50%",
                    animation: `ar-flap-${slot.id} 0.42s ease-in-out infinite`,
                  }
                : {};

            return (
              <g key={slot.id}>
                {/* empty ghost slot */}
                {!filled && (
                  <g
                    style={{
                      animation: bouncing ? "ar-bounce 0.46s ease" : undefined,
                    }}
                  >
                    <circle
                      cx={slot.x}
                      cy={slot.y}
                      r="30"
                      fill="#0b1020"
                      stroke={selectable ? ACCENT : "#3a4566"}
                      strokeWidth="3"
                      strokeDasharray="6 6"
                      opacity={selectable ? 1 : 0.85}
                    >
                      {selectable && (
                        <animate
                          attributeName="r"
                          values="28;33;28"
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
                      opacity="0.35"
                      style={{ pointerEvents: "none" }}
                    >
                      {slot.ghost}
                    </text>
                  </g>
                )}

                {/* placed part */}
                {filled && (
                  <g filter={flapping ? "url(#ar-glow)" : undefined} style={flapStyle}>
                    <text
                      x={slot.x}
                      y={slot.y + 14}
                      textAnchor="middle"
                      fontSize="42"
                      style={{ pointerEvents: "none" }}
                    >
                      {glyphFor(slot.id)}
                    </text>
                  </g>
                )}

                {/* big tap target (>=44px) — on top so it always catches taps */}
                <circle
                  cx={slot.x}
                  cy={slot.y}
                  r="30"
                  fill="transparent"
                  style={{ cursor: filled || flapping ? "default" : "pointer" }}
                  onClick={() => tapSlot(slot)}
                  role="button"
                  aria-label={
                    filled
                      ? `${slot.id} placed`
                      : `Empty slot — tap to place the held part here`
                  }
                />
              </g>
            );
          })}

          {/* spinning motor sparkle once powered */}
          {flapping && motorPlaced && (
            <g transform="translate(180 158)" style={{ pointerEvents: "none" }}>
              <g style={{ transformBox: "fill-box", transformOrigin: "center", animation: "ar-spin 0.6s linear infinite" }}>
                <text x="0" y="14" textAnchor="middle" fontSize="40">
                  ⚙️
                </text>
              </g>
            </g>
          )}
        </svg>

        {/* emoji-only status */}
        <div
          className="mt-1 flex items-center justify-center gap-2 text-3xl"
          aria-live="polite"
        >
          <span aria-hidden="true">{statusEmoji}</span>
          {flapping && (
            <span className="animate-float" aria-hidden="true">
              🦋
            </span>
          )}
        </div>
      </div>

      {/* Tray — parts still to place */}
      <div className="flex items-center justify-center gap-2">
        {PARTS.map((p) => {
          const isPlaced = placed[p.id];
          const active = selected === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => togglePart(p.id)}
              disabled={isPlaced || flapping}
              aria-pressed={active}
              aria-label={`${p.name}${isPlaced ? " — placed" : ""}`}
              className="flex min-h-[56px] min-w-[56px] items-center justify-center rounded-2xl text-3xl transition active:scale-95 disabled:opacity-30"
              style={
                active
                  ? { background: ACCENT, boxShadow: `0 0 16px ${ACCENT}` }
                  : {
                      background: "rgba(11,16,32,0.6)",
                      borderWidth: 2,
                      borderStyle: "solid",
                      borderColor: "var(--color-line, #27314f)",
                    }
              }
            >
              <span aria-hidden="true">{isPlaced ? "✅" : p.glyph}</span>
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={powerOn}
          aria-label={
            flapping
              ? "Power is on — the wings are flapping"
              : allPlaced
                ? "Tap to power on the butterfly robot"
                : "Place every part first, then power on"
          }
          className="font-display flex min-h-[56px] items-center gap-2 rounded-2xl px-6 py-3 text-lg font-bold transition active:scale-95"
          style={
            allPlaced
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
          <span aria-hidden="true" className="text-2xl">
            {flapping ? "🦋" : "⚡"}
          </span>
          {flapping ? "ON" : "POWER"}
        </button>

        <button
          type="button"
          onClick={reset}
          aria-label="Start over"
          className="flex min-h-[56px] items-center gap-2 rounded-2xl border-2 border-line bg-panel/60 px-5 py-3 text-lg font-bold text-ink-dim transition active:scale-95"
        >
          <span aria-hidden="true" className="text-2xl">
            🔄
          </span>
        </button>
      </div>

      {/* confetti on success */}
      {flapping && (
        <div className="pointer-events-none flex justify-center gap-2 text-2xl">
          <span className="animate-float" aria-hidden="true">
            ✨
          </span>
          <span className="animate-float" style={{ animationDelay: "0.2s" }} aria-hidden="true">
            🎉
          </span>
          <span className="animate-float" style={{ animationDelay: "0.4s" }} aria-hidden="true">
            ✨
          </span>
        </div>
      )}

      <style>{`
        @keyframes ar-bounce {
          0%, 100% { transform: translateX(0) rotate(0); }
          25% { transform: translateX(-5px) rotate(-5deg); }
          75% { transform: translateX(5px) rotate(5deg); }
        }
        @keyframes ar-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes ar-flap-wingL {
          0%, 100% { transform: rotateY(0deg) scaleX(1); }
          50% { transform: rotateY(0deg) scaleX(0.45); }
        }
        @keyframes ar-flap-wingR {
          0%, 100% { transform: rotateY(0deg) scaleX(1); }
          50% { transform: rotateY(0deg) scaleX(0.45); }
        }
      `}</style>
    </div>
  );
}
