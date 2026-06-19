"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Automatic Door 🚪 ────────────────────────────────────────────────────────
   GRADE 2 (junior, age ~7). Subject: ROBOTICS.
   ONE learning goal: a SENSOR detects something and TRIGGERS a machine —
   cause and effect.

   The scene is a sliding glass door 🚪. In front of it the child DRAGS a
   doormat SENSOR 🟩 left/right and drops it onto the bright target zone right by
   the door. Then they press WALK ▶ — a person 🧍 strolls toward the door. When
   the person steps onto a WELL-PLACED mat, the sensor fires, the glass slides
   OPEN, and they walk through 🎉 → win (onComplete passed:true, stars:3, once).
   If the mat sits too far away, the sensor never triggers in time, the door
   stays shut, and the person gently stops and steps back — "try moving the mat
   closer." No reading needed; no scolding; always winnable.

   Deterministic rule: the mat must overlap the trigger zone (close to the door).
   ──────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#34d399";

// ── Virtual SVG world (CSS scales it responsively) ───────────────────────────
const VW = 360;
const VH = 200;
const FLOOR_Y = 150; // baseline the person & mat stand on
const DOOR_X = 300; // x of the doorway centre (door is on the right)

// The mat slides along this track (its CENTRE x, clamped to the rail).
const MAT_MIN_X = 70;
const MAT_MAX_X = 250;
const MAT_W = 56; // visual + hit width of the mat
const MAT_START_X = 110; // starts off to the left (a wrong spot, must be moved)

// The sensor "trigger zone": the floor right in front of the door. The mat
// counts as placed when its centre lands inside this band → door opens.
const ZONE_X = 232; // centre of the good zone
const ZONE_HALF = 30; // half-width → a forgiving 60px sweet spot
const matIsGood = (x: number): boolean => Math.abs(x - ZONE_X) <= ZONE_HALF;

// Where the walker stops if the mat is misplaced (a little short of the door).
const STOP_X = 150;
const PERSON_START_X = 30;

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

type Phase = "place" | "walking" | "won" | "retry";

export default function AutoDoor({ onComplete }: ActivityProps) {
  const [matX, setMatX] = useState<number>(MAT_START_X);
  const [phase, setPhase] = useState<Phase>("place");
  const [personX, setPersonX] = useState<number>(PERSON_START_X);
  const [doorOpen, setDoorOpen] = useState<boolean>(false);
  const [sensorLit, setSensorLit] = useState<boolean>(false);
  const [dragging, setDragging] = useState<boolean>(false);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reportedRef = useRef<boolean>(false);

  const clearTimers = useCallback((): void => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  }, []);
  const after = useCallback(
    (ms: number, fn: () => void): void => {
      timersRef.current.push(setTimeout(fn, ms));
    },
    [],
  );
  useEffect(() => () => clearTimers(), [clearTimers]);

  const walking = phase === "walking";
  const won = phase === "won";
  const retry = phase === "retry";
  const placed = matIsGood(matX);

  // ── Dragging the sensor mat (pointer → virtual SVG x) ──────────────────────
  const pointerToMatX = useCallback((clientX: number): number => {
    const svg = svgRef.current;
    if (!svg) return matX;
    const rect = svg.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    return clamp(ratio * VW, MAT_MIN_X, MAT_MAX_X);
  }, [matX]);

  const onMatDown = useCallback(
    (e: React.PointerEvent<SVGGElement>): void => {
      if (walking || won) return;
      e.preventDefault();
      (e.currentTarget as SVGGElement).setPointerCapture?.(e.pointerId);
      setDragging(true);
      setPhase("place");
      setMatX(pointerToMatX(e.clientX));
    },
    [walking, won, pointerToMatX],
  );

  const onMatMove = useCallback(
    (e: React.PointerEvent<SVGGElement>): void => {
      if (!dragging) return;
      e.preventDefault();
      setMatX(pointerToMatX(e.clientX));
    },
    [dragging, pointerToMatX],
  );

  const onMatUp = useCallback(
    (e: React.PointerEvent<SVGGElement>): void => {
      if (!dragging) return;
      (e.currentTarget as SVGGElement).releasePointerCapture?.(e.pointerId);
      setDragging(false);
    },
    [dragging],
  );

  // ── Reset everyone to the start of an attempt (keeps mat where it is) ───────
  const resetWalker = useCallback((): void => {
    clearTimers();
    setPersonX(PERSON_START_X);
    setDoorOpen(false);
    setSensorLit(false);
  }, [clearTimers]);

  const reset = useCallback((): void => {
    clearTimers();
    reportedRef.current = false;
    setMatX(MAT_START_X);
    setPersonX(PERSON_START_X);
    setDoorOpen(false);
    setSensorLit(false);
    setDragging(false);
    setPhase("place");
  }, [clearTimers]);

  // ── WALK: send the person toward the door and run the sensor rule ──────────
  const walk = useCallback((): void => {
    if (walking || won || dragging) return;
    resetWalker();
    setPhase("walking");

    if (matIsGood(matX)) {
      // Good placement → step onto the mat, sensor fires, door opens, walk through.
      after(40, () => setPersonX(ZONE_X)); // walk up onto the mat
      after(820, () => setSensorLit(true)); // sensor detects → trigger!
      after(1040, () => setDoorOpen(true)); // glass slides open
      after(1320, () => setPersonX(DOOR_X + 40)); // stroll through the doorway
      after(1900, () => {
        setPhase("won");
        if (!reportedRef.current) {
          reportedRef.current = true;
          onComplete({
            passed: true,
            stars: 3,
            detail: "The sensor saw you and opened the door! 🚪✨",
          });
        }
      });
    } else {
      // Mat too far from the door → no trigger; person stops short and steps back.
      after(40, () => setPersonX(STOP_X));
      after(900, () => setPhase("retry"));
      after(900, () =>
        onComplete({
          passed: false,
          detail: "The door stayed shut. Slide the mat closer to the door!",
        }),
      );
      after(1500, () => {
        setPersonX(PERSON_START_X);
        setPhase("place");
      });
    }
  }, [walking, won, dragging, matX, resetWalker, after, onComplete]);

  // ── Tiny visual status (emoji, no paragraphs) ──────────────────────────────
  const statusEmoji = useMemo<string>(() => {
    if (won) return "🎉";
    if (retry) return "🤔";
    if (walking) return "🚶";
    return placed ? "👍" : "🟩";
  }, [won, retry, walking, placed]);

  const statusLabel = won
    ? "The door opened and you walked through!"
    : retry
      ? "The door stayed shut. Move the mat closer to the door."
      : walking
        ? "The person is walking to the door"
        : placed
          ? "Mat is in the sensor zone. Press Walk!"
          : "Drag the mat in front of the door";

  // Person glyph: walking vs standing vs celebrating.
  const personGlyph = won ? "🎉" : walking ? "🚶" : "🧍";

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono text-ink">
      {/* ── Status pill ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={statusLabel}
        style={{
          background: won ? "rgba(52,211,153,0.16)" : "rgba(255,255,255,0.04)",
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
          <span aria-hidden="true" className="text-xl">
            🧍→🚪
          </span>
        )}
        {won && (
          <span aria-hidden="true" className="text-2xl">
            ✨
          </span>
        )}
      </div>

      {/* ── The scene: floor, sensor zone, sliding door, mat, person ── */}
      <div className="panel relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-line p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VW} ${VH}`}
          className="block w-full select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="A sliding glass door with a sensor mat on the floor in front of it"
        >
          <defs>
            <linearGradient id="g2autodoor-glass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.32" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0.08" />
            </linearGradient>
            <radialGradient id="g2autodoor-zone" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.9" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* back wall + floor */}
          <rect x={0} y={0} width={VW} height={FLOOR_Y} fill="rgba(255,255,255,0.03)" />
          <rect
            x={0}
            y={FLOOR_Y}
            width={VW}
            height={VH - FLOOR_Y}
            fill="rgba(255,255,255,0.05)"
          />
          <line
            x1={0}
            y1={FLOOR_Y}
            x2={VW}
            y2={FLOOR_Y}
            stroke="rgba(120,140,170,0.35)"
            strokeWidth={2}
          />

          {/* the sensor target zone on the floor (where the mat belongs) */}
          <ellipse
            cx={ZONE_X}
            cy={FLOOR_Y + 6}
            rx={ZONE_HALF + 8}
            ry={12}
            fill="url(#g2autodoor-zone)"
            opacity={placed ? 0.55 : 0.32}
          />
          <rect
            x={ZONE_X - ZONE_HALF}
            y={FLOOR_Y - 10}
            width={ZONE_HALF * 2}
            height={20}
            rx={6}
            fill="none"
            stroke={placed ? ACCENT : "rgba(52,211,153,0.5)"}
            strokeWidth={2}
            strokeDasharray="5 5"
            style={{ animation: placed ? undefined : "g2autodoor-pulse 1.6s ease-in-out infinite" }}
          />

          {/* ── Door frame + sliding glass panels ── */}
          {/* frame posts */}
          <rect x={DOOR_X - 46} y={28} width={6} height={FLOOR_Y - 28} fill="#3a4866" rx={2} />
          <rect x={DOOR_X + 40} y={28} width={6} height={FLOOR_Y - 28} fill="#3a4866" rx={2} />
          <rect x={DOOR_X - 46} y={24} width={92} height={8} fill="#3a4866" rx={3} />

          {/* left glass panel slides left when open */}
          <g
            style={{
              transform: doorOpen ? "translateX(-34px)" : "translateX(0px)",
              transition: "transform 320ms ease-in-out",
            }}
          >
            <rect
              x={DOOR_X - 40}
              y={32}
              width={38}
              height={FLOOR_Y - 32}
              fill="url(#g2autodoor-glass)"
              stroke={ACCENT}
              strokeWidth={1.5}
            />
          </g>
          {/* right glass panel slides right when open */}
          <g
            style={{
              transform: doorOpen ? "translateX(34px)" : "translateX(0px)",
              transition: "transform 320ms ease-in-out",
            }}
          >
            <rect
              x={DOOR_X + 2}
              y={32}
              width={38}
              height={FLOOR_Y - 32}
              fill="url(#g2autodoor-glass)"
              stroke={ACCENT}
              strokeWidth={1.5}
            />
          </g>

          {/* a small sensor lamp above the door — lights green on trigger */}
          <circle
            cx={DOOR_X}
            cy={18}
            r={7}
            fill={sensorLit ? ACCENT : "#1b2436"}
            stroke={sensorLit ? ACCENT : "#3a4866"}
            strokeWidth={2}
            style={{ filter: sensorLit ? `drop-shadow(0 0 6px ${ACCENT})` : undefined }}
          />
          <text
            x={DOOR_X}
            y={19}
            fontSize={9}
            textAnchor="middle"
            dominantBaseline="central"
            aria-hidden="true"
          >
            {sensorLit ? "👁️" : ""}
          </text>

          {/* ── The walking person ── */}
          <g
            style={{
              transform: `translate(${personX}px, ${FLOOR_Y - 22}px)`,
              transition: walking || won ? "transform 760ms ease-in-out" : "none",
              opacity: won ? 0 : 1,
            }}
          >
            <text
              x={0}
              y={0}
              fontSize={30}
              textAnchor="middle"
              dominantBaseline="central"
              aria-label="person"
              style={{ animation: walking ? "g2autodoor-bob 0.5s ease-in-out infinite" : undefined }}
            >
              {personGlyph}
            </text>
          </g>

          {/* ── The draggable SENSOR mat ── */}
          <g
            onPointerDown={onMatDown}
            onPointerMove={onMatMove}
            onPointerUp={onMatUp}
            onPointerCancel={onMatUp}
            style={{
              cursor: walking || won ? "default" : "grab",
              transform: `translate(${matX}px, ${FLOOR_Y + 4}px)`,
              transition: dragging ? "none" : "transform 160ms ease-out",
              touchAction: "none",
            }}
            role="button"
            tabIndex={0}
            aria-label="Sensor mat — drag it in front of the door"
          >
            {/* generous invisible hit pad for little fingers */}
            <rect
              x={-MAT_W / 2 - 6}
              y={-20}
              width={MAT_W + 12}
              height={32}
              fill="transparent"
            />
            <rect
              x={-MAT_W / 2}
              y={-9}
              width={MAT_W}
              height={16}
              rx={5}
              fill={placed ? "rgba(52,211,153,0.30)" : "rgba(52,211,153,0.16)"}
              stroke={ACCENT}
              strokeWidth={placed ? 2.5 : 1.8}
              style={{
                filter: placed ? `drop-shadow(0 0 6px ${ACCENT})` : undefined,
                animation: dragging ? "g2autodoor-lift 0.4s ease" : undefined,
              }}
            />
            <text
              x={0}
              y={0}
              fontSize={12}
              textAnchor="middle"
              dominantBaseline="central"
              aria-hidden="true"
            >
              {placed ? "🟩" : "🟩"}
            </text>
            {/* a little hint arrow when not yet placed and idle */}
            {!placed && !walking && !won && (
              <text
                x={MAT_W / 2 + 14}
                y={-2}
                fontSize={14}
                textAnchor="middle"
                dominantBaseline="central"
                aria-hidden="true"
                style={{ animation: "g2autodoor-nudge 1.2s ease-in-out infinite" }}
              >
                👉
              </text>
            )}
          </g>
        </svg>
      </div>

      {/* ── Controls: WALK · Reset ── */}
      <div className="flex w-full max-w-[420px] items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            walk();
          }}
          disabled={walking || won}
          aria-label="Walk — send the person to the door"
          className="flex h-[60px] flex-1 items-center justify-center gap-2 rounded-2xl text-2xl font-bold transition active:scale-95 disabled:opacity-50"
          style={{
            touchAction: "none",
            background: ACCENT,
            color: "#04130d",
            boxShadow: "0 6px 0 0 #15916a",
          }}
        >
          <span aria-hidden="true">{walking ? "🚶" : "▶"}</span>
          <span aria-hidden="true" className="text-xl font-extrabold">
            WALK
          </span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            reset();
          }}
          disabled={walking}
          aria-label="Start over"
          className="grid h-[60px] w-[60px] place-items-center rounded-2xl text-2xl transition active:scale-90 disabled:opacity-40"
          style={{
            touchAction: "none",
            background: "rgba(255,255,255,0.05)",
            border: "2px solid var(--color-line, #33405c)",
          }}
        >
          <span aria-hidden="true">🔄</span>
        </button>
      </div>

      {/* tiny coaching line (emoji + few words) */}
      <div
        className="flex items-center gap-2 text-sm text-ink-dim"
        aria-hidden="true"
      >
        {won ? (
          <span>Sensor saw you → door opened! 🚪✨</span>
        ) : retry ? (
          <span>Too far! Slide the 🟩 mat closer to the 🚪</span>
        ) : placed ? (
          <span>Mat is set — press WALK ▶</span>
        ) : (
          <span>Drag the 🟩 mat to the glowing spot</span>
        )}
      </div>

      {/* celebratory floaters when solved */}
      {won && (
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
        @keyframes g2autodoor-pulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        @keyframes g2autodoor-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        @keyframes g2autodoor-nudge {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(4px); }
        }
        @keyframes g2autodoor-lift {
          0% { transform: scale(1); }
          50% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
