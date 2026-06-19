"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Build-a-Bot Workshop 🤖 ───────────────────────────────────────────────────
   JUNIOR (Grade 3, age ~8) ROBOTICS lab. Single learning goal: a MOTOR is an
   actuator that turns electricity into movement, and a robot only drives when
   its parts are assembled in the right places. On the assembly bench a tray of
   four parts — 🟫 chassis plate, ⚙️ DC motor, 🛞 wheels, 🔋 battery pack — must be
   dragged onto a robot frame with four big glowing dashed sockets, each showing
   a faint ghost of the part it wants. A part dropped on the MATCHING socket snaps
   in with a click and turns solid green; dropped on the wrong socket it gently
   wiggles "nope" and floats back to the tray — no penalty, always retryable.
   When all four parts are in, a green ON switch appears. Tapping it sends an
   electric spark from the battery → motor → wheels, the wheels spin and the
   robot rolls across the finish line 🏁 → celebration + onComplete(passed) once.
   Two ways to place a part: DRAG it onto a socket, or TAP the part then TAP a
   socket. Big targets, no reading required, deterministic, always winnable. */

const ACCENT = "#34d399";

/** The four buildable parts. Each part matches exactly one socket by `id`. */
type PartId = "chassis" | "motor" | "wheels" | "battery";

interface Part {
  id: PartId;
  /** Big emoji glyph (no reading required). */
  glyph: string;
  /** aria word for screen readers. */
  word: string;
}

const PARTS: readonly Part[] = [
  { id: "chassis", glyph: "🟫", word: "chassis plate" },
  { id: "motor", glyph: "⚙️", word: "motor" },
  { id: "wheels", glyph: "🛞", word: "wheels" },
  { id: "battery", glyph: "🔋", word: "battery pack" },
];

/** A socket on the robot frame: where it sits + which part fits it. */
interface Socket {
  id: PartId;
  /** Centre x/y in virtual SVG units. */
  x: number;
  y: number;
}

// ── Layout maths (virtual SVG units; CSS scales it responsively) ─────────────
const VW = 300;
const VH = 300;
const SOCKET_R = 45; // ~90px sockets at full size — easy for an 8-year-old

/** Frame sockets: battery up top, motor in the middle, two wheels below. */
const SOCKETS: readonly Socket[] = [
  { id: "battery", x: 150, y: 70 },
  { id: "motor", x: 150, y: 150 },
  { id: "chassis", x: 150, y: 215 },
  { id: "wheels", x: 150, y: 262 },
];

type Phase = "build" | "ready" | "spark" | "won";

/** A live pointer-drag in progress (viewport px, for the floating ghost). */
interface Drag {
  partId: PartId;
  x: number;
  y: number;
}

const socketFor = (id: PartId): Socket =>
  SOCKETS.find((s) => s.id === id) as Socket;
const partFor = (id: PartId): Part => PARTS.find((p) => p.id === id) as Part;

export default function MotorRobotBuilder({ onComplete }: ActivityProps) {
  /** Which parts have been correctly socketed. */
  const [placed, setPlaced] = useState<Record<PartId, boolean>>({
    chassis: false,
    motor: false,
    wheels: false,
    battery: false,
  });
  const [phase, setPhase] = useState<Phase>("build");
  /** Part tapped to "pick up" in tap-then-tap mode, or null. */
  const [held, setHeld] = useState<PartId | null>(null);
  /** A live drag, or null. */
  const [drag, setDrag] = useState<Drag | null>(null);
  /** Socket id glowing because a held/dragged part hovers it. */
  const [hover, setHover] = useState<PartId | null>(null);
  /** Socket id flashing a happy snap, or null. */
  const [snap, setSnap] = useState<PartId | null>(null);
  /** Part id wiggling "nope" after a wrong drop. */
  const [nope, setNope] = useState<PartId | null>(null);

  const reportedRef = useRef<boolean>(false);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nopeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const driveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Refs to each socket's DOM hit-area, for drag hit-testing. */
  const socketRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const clearTimers = useCallback(() => {
    if (snapTimer.current !== null) clearTimeout(snapTimer.current);
    if (nopeTimer.current !== null) clearTimeout(nopeTimer.current);
    if (driveTimer.current !== null) clearTimeout(driveTimer.current);
  }, []);
  useEffect(() => () => clearTimers(), [clearTimers]);

  const won = phase === "won";
  const driving = phase === "spark" || phase === "won";

  /** Parts not yet socketed, in their fixed tray order. */
  const trayParts = useMemo<Part[]>(
    () => PARTS.filter((p) => !placed[p.id]),
    [placed],
  );
  const placedCount = useMemo<number>(
    () => PARTS.filter((p) => placed[p.id]).length,
    [placed],
  );
  const allPlaced = placedCount === PARTS.length;

  // Promote build → ready the moment the last part snaps in (shows ON switch).
  useEffect(() => {
    if (allPlaced && phase === "build") setPhase("ready");
  }, [allPlaced, phase]);

  /** Try to fit `partId` into socket `socketId`. Returns true on a match. */
  const fitPart = useCallback(
    (partId: PartId, socketId: PartId): boolean => {
      if (phase === "spark" || won) return false;
      if (partId === socketId) {
        // Correct socket → snap in with a happy click.
        setPlaced((prev) => ({ ...prev, [partId]: true }));
        setHeld(null);
        setSnap(socketId);
        if (snapTimer.current !== null) clearTimeout(snapTimer.current);
        snapTimer.current = setTimeout(() => setSnap(null), 420);
        return true;
      }
      // Wrong socket → gentle "nope" wiggle, float back to tray. No penalty.
      setNope(partId);
      if (nopeTimer.current !== null) clearTimeout(nopeTimer.current);
      nopeTimer.current = setTimeout(() => setNope(null), 480);
      onComplete({
        passed: false,
        detail: "Not quite — that part fits a different socket. Try again!",
      });
      return false;
    },
    [phase, won, onComplete],
  );

  /* ── Tap-then-tap mode ─────────────────────────────────────────────────── */

  const tapPart = useCallback(
    (partId: PartId) => {
      if (driving || drag) return;
      setHeld((h) => (h === partId ? null : partId));
    },
    [driving, drag],
  );

  const tapSocket = useCallback(
    (socketId: PartId) => {
      if (driving) return;
      if (placed[socketId]) return; // already filled
      if (held === null) return; // nothing picked up
      fitPart(held, socketId);
    },
    [driving, placed, held, fitPart],
  );

  /* ── Drag mode (pointer events) ────────────────────────────────────────── */

  /** Which empty socket (if any) sits under this viewport point. */
  const socketAtPoint = useCallback(
    (x: number, y: number): PartId | null => {
      for (const s of SOCKETS) {
        if (placed[s.id]) continue;
        const node = socketRefs.current[s.id];
        if (!node) continue;
        const r = node.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return s.id;
      }
      return null;
    },
    [placed],
  );

  const onPartPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>, partId: PartId) => {
      if (driving) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setHeld(null);
      setDrag({ partId, x: e.clientX, y: e.clientY });
    },
    [driving],
  );

  const onPartPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!drag) return;
      e.preventDefault();
      setDrag({ partId: drag.partId, x: e.clientX, y: e.clientY });
      setHover(socketAtPoint(e.clientX, e.clientY));
    },
    [drag, socketAtPoint],
  );

  const onPartPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!drag) return;
      e.preventDefault();
      const overSocket = socketAtPoint(e.clientX, e.clientY);
      const movedFar =
        Math.abs(e.clientX - drag.x) > 6 || Math.abs(e.clientY - drag.y) > 6;
      const partId = drag.partId;
      setDrag(null);
      setHover(null);
      if (overSocket) {
        fitPart(partId, overSocket);
      } else if (!movedFar) {
        // Barely moved + released off any socket → treat as a tap (pick up).
        setHeld((h) => (h === partId ? null : partId));
      }
    },
    [drag, socketAtPoint, fitPart],
  );

  /* ── Power on → spark flows, robot drives across the line ───────────────── */

  const powerOn = useCallback(() => {
    if (phase !== "ready") return;
    setHeld(null);
    setPhase("spark");
    if (driveTimer.current !== null) clearTimeout(driveTimer.current);
    driveTimer.current = setTimeout(() => {
      setPhase("won");
      if (!reportedRef.current) {
        reportedRef.current = true;
        onComplete({
          passed: true,
          stars: 3,
          detail: "Power on! The motor spun the wheels and your bot rolled across the line! 🤖",
        });
      }
    }, 1400);
  }, [phase, onComplete]);

  const reset = useCallback(() => {
    clearTimers();
    reportedRef.current = false;
    setPlaced({ chassis: false, motor: false, wheels: false, battery: false });
    setPhase("build");
    setHeld(null);
    setDrag(null);
    setHover(null);
    setSnap(null);
    setNope(null);
  }, [clearTimers]);

  const draggingPart = drag ? partFor(drag.partId) : null;
  const statusEmoji = won ? "🎉" : phase === "spark" ? "⚡" : allPlaced ? "✨" : "🛠️";

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono text-ink">
      <style>{KEYFRAMES}</style>

      {/* ── Tiny visual status ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={
          won
            ? "Your robot rolled across the finish line!"
            : phase === "spark"
              ? "Electricity is flowing to the motor"
              : allPlaced
                ? "All parts in — tap the green switch to power up"
                : "Drag each part onto its matching socket"
        }
        style={{
          background: won ? "rgba(52,211,153,0.14)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${won ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: won ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true">{statusEmoji}</span>
        {won ? (
          <span aria-hidden="true" className="text-2xl">
            ⭐⭐⭐
          </span>
        ) : (
          <span aria-hidden="true" className="text-base">
            {placedCount} / {PARTS.length} 🔩
          </span>
        )}
        {won && (
          <span aria-hidden="true" className="text-2xl">
            ✨
          </span>
        )}
      </div>

      {/* ── The assembly bench ── */}
      <div className="panel w-full max-w-[420px] overflow-hidden rounded-2xl border border-line p-2">
        {/* This inner box is exactly the SVG's rendered square, so the absolutely
            positioned socket hit-areas track the SVG sockets at any size. */}
        <div className="relative w-full" style={{ aspectRatio: `${VW} / ${VH}` }}>
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="block w-full select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="A robot frame with four sockets and a finish line"
        >
          <defs>
            <radialGradient id="g3mrb-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.85" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* finish line on the right edge */}
          <g aria-hidden="true">
            {Array.from({ length: 10 }).map((_, i) => (
              <rect
                key={`fin-${i}`}
                x={VW - 16 + (i % 2) * 8}
                y={i * 30}
                width={8}
                height={30}
                fill={i % 2 === 0 ? "#e5e7eb" : "#1b2436"}
                opacity={0.55}
              />
            ))}
            <text x={VW - 24} y={20} fontSize={18} textAnchor="end">
              🏁
            </text>
          </g>

          {/* the spark path battery → motor → wheels (only while powered) */}
          {driving && (
            <g aria-hidden="true">
              <path
                d={`M150,70 L150,150 L150,262`}
                fill="none"
                stroke={ACCENT}
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray="6 10"
                opacity={0.85}
                style={{ animation: "g3motorrobotbuilder-flow 0.6s linear infinite" }}
              />
              <text fontSize={20} style={{ animation: "g3motorrobotbuilder-spark 1.2s linear infinite" }}>
                <animateMotion dur="1.2s" repeatCount="indefinite" path="M150,70 L150,150 L150,262" />
                ⚡
              </text>
            </g>
          )}

          {/* the robot: a group that slides right when it drives */}
          <g
            style={{
              transform: driving ? `translateX(${VW - 90}px)` : "translateX(0px)",
              transition: driving ? "transform 1.3s cubic-bezier(.4,0,.3,1) 0.1s" : "none",
            }}
          >
            {/* sockets + parts */}
            {SOCKETS.map((s) => {
              const isPlaced = placed[s.id];
              const isHover = hover === s.id;
              const isSnap = snap === s.id;
              const part = partFor(s.id);
              const isWheels = s.id === "wheels";
              return (
                <g key={s.id}>
                  {/* glow under a filled socket */}
                  {isPlaced && (
                    <circle cx={s.x} cy={s.y} r={SOCKET_R} fill="url(#g3mrb-glow)" />
                  )}
                  {/* socket ring */}
                  <circle
                    cx={s.x}
                    cy={s.y}
                    r={SOCKET_R}
                    fill={isPlaced ? "rgba(52,211,153,0.18)" : "rgba(255,255,255,0.04)"}
                    stroke={isPlaced ? ACCENT : isHover ? ACCENT : "rgba(120,140,170,0.5)"}
                    strokeWidth={isPlaced || isHover ? 3 : 2}
                    strokeDasharray={isPlaced ? "0" : "7 7"}
                    style={{
                      transformOrigin: `${s.x}px ${s.y}px`,
                      transformBox: "fill-box",
                      animation: isSnap
                        ? "g3motorrobotbuilder-snap 0.42s ease-out"
                        : !isPlaced
                          ? "g3motorrobotbuilder-pulse 1.6s ease-in-out infinite"
                          : undefined,
                    }}
                  />
                  {/* faint ghost of the wanted part, or the solid placed part */}
                  <g
                    style={{
                      transformOrigin: `${s.x}px ${s.y}px`,
                      transformBox: "fill-box",
                      animation:
                        isPlaced && isWheels && driving
                          ? "g3motorrobotbuilder-spin 0.5s linear infinite"
                          : undefined,
                    }}
                  >
                    <text
                      x={s.x}
                      y={s.y + 1}
                      fontSize={SOCKET_R * 1.05}
                      textAnchor="middle"
                      dominantBaseline="central"
                      opacity={isPlaced ? 1 : 0.28}
                      aria-hidden="true"
                    >
                      {part.glyph}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>

        {/* invisible socket hit-areas, aligned over the SVG sockets, for drag + tap.
            Positioned in % so they track the responsive SVG exactly. */}
        {SOCKETS.map((s) => {
          const isPlaced = placed[s.id];
          const isHeldTarget = held !== null && !isPlaced;
          return (
            <button
              key={`hit-${s.id}`}
              type="button"
              ref={(el: HTMLButtonElement | null) => {
                socketRefs.current[s.id] = el;
              }}
              disabled={driving || isPlaced}
              aria-label={
                isPlaced
                  ? `${partFor(s.id).word} socket — filled`
                  : `Empty ${partFor(s.id).word} socket`
              }
              onPointerDown={(e) => {
                e.preventDefault();
                tapSocket(s.id);
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: `${(s.x / VW) * 100}%`,
                top: `${(s.y / VH) * 100}%`,
                width: `${((SOCKET_R * 2) / VW) * 100}%`,
                height: `${((SOCKET_R * 2) / VH) * 100}%`,
                background: isHeldTarget ? "rgba(52,211,153,0.10)" : "transparent",
                border: isHeldTarget ? `2px dashed ${ACCENT}` : "2px solid transparent",
                touchAction: "none",
                pointerEvents: driving || isPlaced ? "none" : "auto",
              }}
            />
          );
        })}
        </div>
      </div>

      {/* ── The parts tray (drag from here) OR the win celebration ── */}
      {won ? (
        <div
          className="grid place-items-center gap-2 py-3 text-center"
          style={{ animation: "g3motorrobotbuilder-pop 0.5s ease both" }}
        >
          <div
            className="text-5xl"
            style={{ animation: "g3motorrobotbuilder-bounce 1s ease-in-out infinite" }}
            aria-hidden="true"
          >
            🤖💨
          </div>
          <div className="flex gap-1.5 text-3xl" aria-label="Three stars, you did it">
            {[0.05, 0.2, 0.35].map((d) => (
              <span key={d} style={{ animation: `g3motorrobotbuilder-pop 0.4s ${d}s ease both` }}>⭐</span>
            ))}
          </div>
          <div className="flex gap-2 text-2xl" aria-hidden="true">
            {(["✨", "🎉", "✨"] as const).map((g, i) => (
              <span key={i} style={{ animation: `g3motorrobotbuilder-float 1.4s ${i * 0.2}s ease-in-out infinite` }}>{g}</span>
            ))}
          </div>
        </div>
      ) : (
        <div
          className="flex min-h-[88px] w-full max-w-[420px] flex-wrap items-center justify-center gap-2 rounded-2xl px-3 py-3"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "2px dashed var(--color-line, #33405c)",
            touchAction: "none",
          }}
          aria-label="Parts tray — drag a part onto its socket"
        >
          {trayParts.length === 0 ? (
            <span aria-hidden="true" className="text-base opacity-60">
              All parts in! Flip the switch 👉
            </span>
          ) : (
            trayParts.map((p) => {
              const isHeld = held === p.id;
              const isNope = nope === p.id;
              const isDragging = drag?.partId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-label={`${p.word}${isHeld ? " — picked up" : ""}`}
                  onPointerDown={(e) => onPartPointerDown(e, p.id)}
                  onPointerMove={onPartPointerMove}
                  onPointerUp={onPartPointerUp}
                  onClick={() => tapPart(p.id)}
                  className="grid h-[72px] w-[72px] place-items-center rounded-2xl border-2 text-4xl transition-transform active:scale-95"
                  style={{
                    borderColor: isHeld ? ACCENT : "var(--color-line, #33405c)",
                    background: isHeld ? "rgba(52,211,153,0.14)" : "var(--color-panel-2, #11161f)",
                    boxShadow: isHeld ? `0 0 14px ${ACCENT}` : "none",
                    opacity: isDragging ? 0.35 : 1,
                    animation: isNope ? "g3motorrobotbuilder-nope 0.46s ease" : undefined,
                    touchAction: "none",
                  }}
                >
                  <span aria-hidden="true">{p.glyph}</span>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* ── ON switch (appears when every part is in) ── */}
      {phase === "ready" && (
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            powerOn();
          }}
          aria-label="Power on the robot"
          className="flex h-[60px] w-full max-w-[260px] items-center justify-center gap-2 rounded-2xl text-2xl font-extrabold transition active:scale-95"
          style={{
            touchAction: "none",
            background: ACCENT,
            color: "#06120c",
            boxShadow: `0 6px 0 0 #1f9d72`,
            animation: "g3motorrobotbuilder-glowbtn 1.2s ease-in-out infinite",
          }}
        >
          <span aria-hidden="true">⚡</span>
          <span aria-hidden="true">ON</span>
        </button>
      )}

      {/* ── Reset — always available ── */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          reset();
        }}
        disabled={phase === "spark"}
        aria-label="Start over"
        className="grid h-[52px] w-[52px] place-items-center rounded-2xl text-2xl transition active:scale-90 disabled:opacity-40"
        style={{
          touchAction: "none",
          background: "rgba(255,255,255,0.05)",
          border: "2px solid var(--color-line, #33405c)",
        }}
      >
        <span aria-hidden="true">🔄</span>
      </button>

      {/* floating drag ghost follows the pointer */}
      {drag && draggingPart && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 grid h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl text-4xl"
          style={{
            left: drag.x,
            top: drag.y,
            background: "rgba(52,211,153,0.18)",
            border: `2px solid ${ACCENT}`,
            boxShadow: `0 0 16px ${ACCENT}`,
          }}
        >
          {draggingPart.glyph}
        </div>
      )}
    </div>
  );
}

const KEYFRAMES = `
@keyframes g3motorrobotbuilder-pulse {
  0%, 100% { opacity: 0.65; }
  50% { opacity: 1; }
}
@keyframes g3motorrobotbuilder-snap {
  0% { transform: scale(0.7); }
  55% { transform: scale(1.22); }
  100% { transform: scale(1); }
}
@keyframes g3motorrobotbuilder-nope {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  20% { transform: translateX(-7px) rotate(-6deg); }
  45% { transform: translateX(7px) rotate(6deg); }
  70% { transform: translateX(-4px) rotate(-3deg); }
}
@keyframes g3motorrobotbuilder-spin {
  to { transform: rotate(360deg); }
}
@keyframes g3motorrobotbuilder-flow {
  to { stroke-dashoffset: -16; }
}
@keyframes g3motorrobotbuilder-spark {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
@keyframes g3motorrobotbuilder-pop {
  0% { transform: scale(0.6); }
  60% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
@keyframes g3motorrobotbuilder-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
@keyframes g3motorrobotbuilder-float {
  0%, 100% { transform: translateY(0); opacity: 0.85; }
  50% { transform: translateY(-9px); opacity: 1; }
}
@keyframes g3motorrobotbuilder-glowbtn {
  0%, 100% { box-shadow: 0 6px 0 0 #1f9d72, 0 0 8px ${ACCENT}; }
  50% { box-shadow: 0 6px 0 0 #1f9d72, 0 0 20px ${ACCENT}; }
}
@media (prefers-reduced-motion: reduce) {
  [style*="animation"] { animation: none !important; }
}
`;
