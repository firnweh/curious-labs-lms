"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ACCENT = "#f59e0b"; // 3D amber — active states
const GLOW = "#fde68a"; // warm window-glow

/** The structural pieces a child snaps into the house. */
type PieceId = "floor" | "leftWall" | "rightWall" | "roof" | "door";

interface Piece {
  id: PieceId;
  glyph: string;
  /** Where this piece lives in the finished house (SVG coords) plus its shape. */
  draw: (filled: boolean) => React.ReactNode;
  /** Centre of the slot — used to position the ghost target + label. */
  cx: number;
  cy: number;
}

/**
 * House geometry, front elevation, drawn in a 320x300 viewBox.
 * Floor at the bottom, two walls standing on it, a triangle roof on top,
 * and a door in the middle. The window (with light) sits in the right wall.
 */
const WALL_TOP = 120;
const WALL_BOTTOM = 230;
const FLOOR_Y = 230;
const LEFT_X = 70;
const RIGHT_X = 250;
const PEAK_X = 160;
const PEAK_Y = 60;

function wallFill(filled: boolean): string {
  return filled ? "#fbbf24" : "transparent";
}
function ghostStroke(filled: boolean): string {
  return filled ? ACCENT : "#4a567e";
}

const PIECES: Piece[] = [
  {
    id: "floor",
    glyph: "🟫",
    cx: 160,
    cy: 244,
    draw: (filled) => (
      <rect
        x={LEFT_X - 8}
        y={FLOOR_Y}
        width={RIGHT_X - LEFT_X + 16 + 8}
        height="20"
        rx="5"
        fill={filled ? "#a16207" : "transparent"}
        stroke={ghostStroke(filled)}
        strokeWidth="3"
        strokeDasharray={filled ? "0" : "7 6"}
      />
    ),
  },
  {
    id: "leftWall",
    glyph: "🧱",
    cx: 70,
    cy: 175,
    draw: (filled) => (
      <rect
        x={LEFT_X}
        y={WALL_TOP}
        width="26"
        height={WALL_BOTTOM - WALL_TOP}
        rx="4"
        fill={wallFill(filled)}
        stroke={ghostStroke(filled)}
        strokeWidth="3"
        strokeDasharray={filled ? "0" : "7 6"}
      />
    ),
  },
  {
    id: "rightWall",
    glyph: "🧱",
    cx: 244,
    cy: 175,
    draw: (filled) => (
      <rect
        x={RIGHT_X}
        y={WALL_TOP}
        width="26"
        height={WALL_BOTTOM - WALL_TOP}
        rx="4"
        fill={wallFill(filled)}
        stroke={ghostStroke(filled)}
        strokeWidth="3"
        strokeDasharray={filled ? "0" : "7 6"}
      />
    ),
  },
  {
    id: "roof",
    glyph: "🔺",
    cx: 160,
    cy: 95,
    draw: (filled) => (
      <polygon
        points={`${LEFT_X - 14},${WALL_TOP} ${PEAK_X},${PEAK_Y} ${
          RIGHT_X + 26 + 14
        },${WALL_TOP}`}
        fill={filled ? "#c2410c" : "transparent"}
        stroke={filled ? "#ea580c" : "#4a567e"}
        strokeWidth="3"
        strokeLinejoin="round"
        strokeDasharray={filled ? "0" : "7 6"}
      />
    ),
  },
  {
    id: "door",
    glyph: "🚪",
    cx: 160,
    cy: 200,
    draw: (filled) => (
      <rect
        x="142"
        y="170"
        width="36"
        height="60"
        rx="6"
        fill={filled ? "#7c2d12" : "transparent"}
        stroke={filled ? "#a16207" : "#4a567e"}
        strokeWidth="3"
        strokeDasharray={filled ? "0" : "7 6"}
      />
    ),
  },
];

type Placed = Record<PieceId, boolean>;

const EMPTY_PLACED: Placed = {
  floor: false,
  leftWall: false,
  rightWall: false,
  roof: false,
  door: false,
};

export default function SmartHouse({ onComplete }: ActivityProps) {
  const [selected, setSelected] = useState<PieceId | null>(null);
  const [placed, setPlaced] = useState<Placed>(EMPTY_PLACED);
  const [lightOn, setLightOn] = useState<boolean>(false);
  /** Slot that just rejected a wrong piece — drives a gentle bounce. */
  const [bouncing, setBouncing] = useState<PieceId | null>(null);

  const reportedRef = useRef<boolean>(false);
  const bounceTimer = useRef<number | null>(null);

  const built = useMemo<boolean>(
    () => PIECES.every((p) => placed[p.id]),
    [placed],
  );
  const placedCount = useMemo<number>(
    () => PIECES.filter((p) => placed[p.id]).length,
    [placed],
  );
  const win = built && lightOn;

  const bounce = useCallback((id: PieceId): void => {
    setBouncing(id);
    if (bounceTimer.current !== null) window.clearTimeout(bounceTimer.current);
    bounceTimer.current = window.setTimeout(() => setBouncing(null), 480);
  }, []);

  /** Tap a ghost slot: drops the selected piece if it matches, else bounces. */
  const tapSlot = useCallback(
    (id: PieceId): void => {
      if (win) return;
      if (placed[id]) return; // already built here
      if (selected === null) return; // pick from the tray first
      if (selected === id) {
        setPlaced((prev) => ({ ...prev, [id]: true }));
        setSelected(null);
      } else {
        bounce(id); // wrong slot — gentle bounce-back
      }
    },
    [win, placed, selected, bounce],
  );

  const flipSwitch = useCallback((): void => {
    if (!built) {
      bounce("door"); // not ready — nudge, stay off
      return;
    }
    setLightOn((on) => !on);
  }, [built, bounce]);

  const reset = useCallback((): void => {
    if (bounceTimer.current !== null) window.clearTimeout(bounceTimer.current);
    reportedRef.current = false;
    setSelected(null);
    setPlaced(EMPTY_PLACED);
    setLightOn(false);
    setBouncing(null);
  }, []);

  // Celebrate exactly once when the house is built and the light is on.
  useEffect(() => {
    if (win && !reportedRef.current) {
      reportedRef.current = true;
      onComplete({ passed: true, stars: 3 });
    }
  }, [win, onComplete]);

  useEffect(() => {
    return () => {
      if (bounceTimer.current !== null) window.clearTimeout(bounceTimer.current);
    };
  }, []);

  // Status emoji only — no reading needed: build → switch → party.
  const statusEmoji = win ? "🎉" : built ? "👉" : "🏠";

  // Tray hides pieces already placed; remaining ones are tappable.
  const tray = PIECES.filter((p) => !placed[p.id]);

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Scene */}
      <div
        className="panel relative overflow-hidden rounded-2xl border border-line p-2"
        style={{
          background: win
            ? "radial-gradient(circle at 75% 58%, rgba(253,230,138,0.20), transparent 60%)"
            : undefined,
          transition: "background 400ms ease",
        }}
      >
        <svg
          viewBox="0 0 320 300"
          className="block w-full select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="Build a house from its pieces — floor, two walls, a roof and a door — then turn on the light."
        >
          <defs>
            <filter id="sh-glow" x="-90%" y="-90%" width="280%" height="280%">
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="sh-window" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fffbeb" />
              <stop offset="55%" stopColor={GLOW} />
              <stop offset="100%" stopColor="rgba(253,230,138,0)" />
            </radialGradient>
          </defs>

          {/* ground line under the house */}
          <line
            x1="20"
            y1="252"
            x2="300"
            y2="252"
            stroke="#27314f"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* warm glow halo from the lit window */}
          {lightOn && built && (
            <circle cx="263" cy="158" r="46" fill="url(#sh-window)" opacity="0.95">
              <animate
                attributeName="r"
                values="38;50;38"
                dur="1.7s"
                repeatCount="indefinite"
              />
            </circle>
          )}

          {/* House pieces — each is a tappable slot (ghost when empty). */}
          {PIECES.map((p) => {
            const filled = placed[p.id];
            const isBounce = bouncing === p.id;
            return (
              <g
                key={p.id}
                onClick={() => tapSlot(p.id)}
                role="button"
                aria-label={
                  filled
                    ? `${p.id} placed`
                    : `Empty ${p.id} slot — tap to place the selected piece`
                }
                tabIndex={filled || win ? -1 : 0}
                style={{
                  cursor: filled || win ? "default" : "pointer",
                  transformBox: "fill-box",
                  transformOrigin: "center",
                  animation: isBounce ? "sh-bounce 0.46s ease" : undefined,
                }}
              >
                {p.draw(filled)}
                {/* gentle pulse on empty slots that match the held piece */}
                {!filled && selected === p.id && (
                  <circle
                    cx={p.cx}
                    cy={p.cy}
                    r="16"
                    fill="none"
                    stroke={ACCENT}
                    strokeWidth="3"
                    strokeDasharray="5 5"
                  >
                    <animate
                      attributeName="r"
                      values="14;20;14"
                      dur="1.2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
                {/* faded hint glyph inside an empty slot */}
                {!filled && (
                  <text
                    x={p.cx}
                    y={p.cy + 8}
                    textAnchor="middle"
                    fontSize="22"
                    opacity="0.35"
                    style={{ pointerEvents: "none" }}
                  >
                    {p.glyph}
                  </text>
                )}
              </g>
            );
          })}

          {/* Window with the smart light — appears once the house is built. */}
          {built && (
            <g style={{ pointerEvents: "none" }}>
              <rect
                x="246"
                y="142"
                width="34"
                height="34"
                rx="4"
                fill={lightOn ? "rgba(253,230,138,0.4)" : "#0b1020"}
                stroke={lightOn ? GLOW : "#4a567e"}
                strokeWidth="3"
                style={{ transition: "fill 300ms ease, stroke 300ms ease" }}
              />
              {/* window cross-bars */}
              <line
                x1="263"
                y1="142"
                x2="263"
                y2="176"
                stroke={lightOn ? "#ca8a04" : "#4a567e"}
                strokeWidth="2"
              />
              <line
                x1="246"
                y1="159"
                x2="280"
                y2="159"
                stroke={lightOn ? "#ca8a04" : "#4a567e"}
                strokeWidth="2"
              />
              {/* the bulb */}
              <g
                filter={lightOn ? "url(#sh-glow)" : undefined}
                style={{
                  transition: "transform 300ms cubic-bezier(.34,1.6,.64,1)",
                  transform: lightOn ? "scale(1.15)" : "scale(1)",
                  transformBox: "fill-box",
                  transformOrigin: "263px 159px",
                }}
              >
                <text
                  x="263"
                  y="168"
                  textAnchor="middle"
                  fontSize="22"
                  opacity={lightOn ? 1 : 0.5}
                >
                  💡
                </text>
              </g>
            </g>
          )}

          {/* doorknob accent once the door is placed */}
          {placed.door && (
            <circle cx="170" cy="202" r="3" fill={ACCENT} />
          )}
        </svg>

        {/* emoji-only status */}
        <div
          className="mt-1 flex items-center justify-center text-2xl"
          aria-live="polite"
        >
          <span aria-hidden="true">{statusEmoji}</span>
        </div>
      </div>

      {/* Tray of pieces */}
      <div className="flex min-h-[60px] flex-wrap items-center justify-center gap-2">
        {tray.length === 0 ? (
          <span className="text-sm font-bold text-ink-dim" aria-hidden="true">
            🏠 ✔
          </span>
        ) : (
          tray.map((p) => {
            const active = selected === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(active ? null : p.id)}
                disabled={win}
                aria-pressed={active}
                aria-label={`Pick the ${p.id} piece`}
                className="flex min-h-[56px] min-w-[56px] items-center justify-center rounded-2xl text-3xl transition active:scale-95 disabled:opacity-50"
                style={
                  active
                    ? {
                        background: ACCENT,
                        boxShadow: `0 0 16px ${ACCENT}`,
                        transform: "scale(1.08)",
                      }
                    : {
                        borderWidth: 2,
                        borderStyle: "solid",
                        borderColor: "var(--color-line, #1e2a44)",
                        background: "rgba(11,16,32,0.6)",
                      }
                }
              >
                <span aria-hidden="true">{p.glyph}</span>
              </button>
            );
          })
        )}
      </div>

      {/* Controls: big smart switch + reset */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={flipSwitch}
          aria-label={
            !built
              ? "Light switch — build the whole house first"
              : lightOn
                ? "The light is on"
                : "Tap to turn the light on"
          }
          className="font-display flex min-h-[56px] items-center gap-2 rounded-2xl px-6 py-3 text-lg font-bold transition active:scale-95"
          style={
            built
              ? {
                  background: lightOn ? GLOW : ACCENT,
                  color: "#060810",
                  boxShadow: `0 0 18px ${lightOn ? GLOW : ACCENT}`,
                }
              : {
                  background: "rgba(11,16,32,0.6)",
                  color: "#9aa6cf",
                  borderWidth: 2,
                  borderStyle: "solid",
                  borderColor: "var(--color-line, #1e2a44)",
                }
          }
        >
          <span aria-hidden="true" className="text-2xl">
            {lightOn ? "💡" : "🔌"}
          </span>
          {lightOn ? "ON" : "PUSH"}
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

      {/* progress pips — visual, no reading */}
      <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
        {PIECES.map((p) => (
          <span
            key={p.id}
            className="h-2.5 w-2.5 rounded-full transition"
            style={{
              background: placed[p.id] ? ACCENT : "var(--color-line, #1e2a44)",
            }}
          />
        ))}
        <span className="ml-1 text-xs text-ink-faint">
          {placedCount}/{PIECES.length}
        </span>
      </div>

      {/* celebration */}
      {win && (
        <div className="pointer-events-none flex justify-center gap-2 text-2xl">
          <span className="animate-float" aria-hidden="true">
            ✨
          </span>
          <span
            className="animate-float"
            style={{ animationDelay: "0.2s" }}
            aria-hidden="true"
          >
            🎉
          </span>
          <span
            className="animate-float"
            style={{ animationDelay: "0.4s" }}
            aria-hidden="true"
          >
            ✨
          </span>
        </div>
      )}

      <style>{`
        @keyframes sh-bounce {
          0%, 100% { transform: translateY(0) scale(1); }
          30% { transform: translateY(-6px) scale(1.06); }
          60% { transform: translateY(3px) scale(0.97); }
        }
      `}</style>
    </div>
  );
}
