"use client";
import type { ActivityProps } from "@/lib/activities/types";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

/* ─────────────────────────────────────────────────────────────
   j-robo-build — "Build a Robot" (JUNIORS, Class 1-3)
   Concept: MATCHING parts to places (shapes & spaces).
   Drag each glowing part to its matching dashed slot on the robot.
   Correct drop snaps in with a pop; a wrong drop bounces gently back.
   All 4 placed → the robot lights up and wiggles → 3 stars.
   No reading required: every slot & part is a big colour-coded emoji.
   ───────────────────────────────────────────────────────────── */

const ACCENT = "#34d399";

type PartId = "eye" | "core" | "wheelL" | "wheelR";

interface Slot {
  id: PartId;
  /** centre of the slot, in SVG viewBox units (0..100 x, 0..100 y) */
  cx: number;
  cy: number;
  /** big emoji shown faintly inside the empty slot AND on the part */
  icon: string;
  /** matching colour so a non-reader can pair by colour too */
  color: string;
  label: string;
}

/* The four parts the robot needs. Slot positions live on the robot body. */
const SLOTS: Slot[] = [
  { id: "eye", cx: 50, cy: 26, icon: "👀", color: "#22d3ee", label: "eyes" },
  { id: "core", cx: 50, cy: 52, icon: "⚡", color: "#f59e0b", label: "power core" },
  { id: "wheelL", cx: 33, cy: 82, icon: "⚙️", color: "#a855f7", label: "left wheel" },
  { id: "wheelR", cx: 67, cy: 82, icon: "⚙️", color: "#a855f7", label: "right wheel" },
];

/* Deterministic tray order (shuffled but fixed) so the lab is repeatable. */
const TRAY_ORDER: PartId[] = ["wheelR", "eye", "wheelL", "core"];

interface DragState {
  id: PartId;
  /** pointer position in % of the stage box */
  x: number;
  y: number;
  /** pointer offset from the part centre, in px, to avoid jump-on-grab */
  ox: number;
  oy: number;
}

export default function BuildaRobot({ onComplete }: ActivityProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const robotRef = useRef<HTMLDivElement | null>(null);

  // which slots are filled
  const [placed, setPlaced] = useState<Record<PartId, boolean>>({
    eye: false,
    core: false,
    wheelL: false,
    wheelR: false,
  });
  const [drag, setDrag] = useState<DragState | null>(null);
  // part id that just got rejected → plays a quick shake in the tray
  const [wobble, setWobble] = useState<PartId | null>(null);
  const wobbleTimer = useRef<number | null>(null);

  const slotById = useMemo(() => {
    const m = {} as Record<PartId, Slot>;
    for (const s of SLOTS) m[s.id] = s;
    return m;
  }, []);

  const allPlaced = SLOTS.every((s) => placed[s.id]);
  const placedCount = SLOTS.filter((s) => placed[s.id]).length;

  const startDrag = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>, id: PartId) => {
      if (placed[id] || allPlaced) return;
      e.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const target = e.currentTarget.getBoundingClientRect();
      const partCx = target.left + target.width / 2;
      const partCy = target.top + target.height / 2;
      e.currentTarget.setPointerCapture(e.pointerId);
      setWobble(null);
      setDrag({
        id,
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
        ox: e.clientX - partCx,
        oy: e.clientY - partCy,
      });
    },
    [placed, allPlaced],
  );

  const moveDrag = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!drag) return;
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      setDrag({
        ...drag,
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      });
    },
    [drag],
  );

  const rejectWobble = useCallback((id: PartId) => {
    setWobble(id);
    if (wobbleTimer.current) window.clearTimeout(wobbleTimer.current);
    wobbleTimer.current = window.setTimeout(() => setWobble(null), 520);
  }, []);

  const endDrag = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!drag) return;
      const id = drag.id;
      const stage = stageRef.current;
      const robot = robotRef.current;
      setDrag(null);
      if (!stage || !robot) {
        rejectWobble(id);
        return;
      }
      // Where did we drop, relative to the ROBOT box (which holds the slots)?
      const rRect = robot.getBoundingClientRect();
      const dropX = ((e.clientX - drag.ox - rRect.left) / rRect.width) * 100;
      const dropY = ((e.clientY - drag.oy - rRect.top) / rRect.height) * 100;

      const slot = slotById[id];
      const dist = Math.hypot(dropX - slot.cx, dropY - slot.cy);
      // generous hit radius — juniors don't aim precisely
      if (dist <= 22) {
        setPlaced((prev) => {
          const next = { ...prev, [id]: true };
          if (SLOTS.every((s) => next[s.id])) {
            // fire success once, in response to the action (not during render)
            window.setTimeout(
              () => onComplete({ passed: true, stars: 3 }),
              650,
            );
          }
          return next;
        });
      } else {
        rejectWobble(id);
      }
    },
    [drag, slotById, onComplete, rejectWobble],
  );

  const reset = useCallback(() => {
    setPlaced({ eye: false, core: false, wheelL: false, wheelR: false });
    setDrag(null);
    setWobble(null);
  }, []);

  return (
    <div
      className="flex w-full flex-col items-center gap-4 select-none"
      style={{ touchAction: "none" }}
    >
      {/* status: emoji only, no reading needed */}
      <div className="flex items-center gap-2" aria-hidden>
        {SLOTS.map((s) => (
          <span
            key={s.id}
            className="grid h-7 w-7 place-items-center rounded-full text-sm transition-transform"
            style={{
              background: placed[s.id]
                ? `color-mix(in srgb, ${ACCENT} 30%, transparent)`
                : "var(--color-panel-2)",
              border: `2px solid ${placed[s.id] ? ACCENT : "var(--color-line)"}`,
              transform: placed[s.id] ? "scale(1.12)" : "scale(1)",
            }}
          >
            {placed[s.id] ? "✅" : "⬜"}
          </span>
        ))}
      </div>

      {/* ── stage: robot + drag layer ─────────────────────────── */}
      <div
        ref={stageRef}
        className="panel relative w-full overflow-hidden"
        style={{
          maxWidth: 480,
          aspectRatio: "1 / 1",
          touchAction: "none",
          background:
            "radial-gradient(120% 100% at 50% 0%, color-mix(in srgb," +
            ACCENT +
            " 8%, var(--color-panel)) 0%, var(--color-panel-2) 70%)",
        }}
      >
        {/* the robot body holds the SLOTS via a 0..100 coordinate box */}
        <div
          ref={robotRef}
          className="absolute"
          style={{
            left: "10%",
            top: "6%",
            width: "80%",
            height: "88%",
            animation: allPlaced
              ? "robo-wiggle 0.7s ease-in-out infinite"
              : "none",
            transformOrigin: "50% 80%",
          }}
        >
          {/* robot outline */}
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 h-full w-full"
            aria-hidden
            style={{ overflow: "visible" }}
          >
            {/* antenna */}
            <line
              x1="50"
              y1="8"
              x2="50"
              y2="2"
              stroke={allPlaced ? ACCENT : "var(--color-line)"}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle
              cx="50"
              cy="2"
              r="2.6"
              fill={allPlaced ? "#f59e0b" : "var(--color-line)"}
              style={{
                animation: allPlaced
                  ? "pulse-glow 1s ease-in-out infinite"
                  : "none",
              }}
            />
            {/* head */}
            <rect
              x="30"
              y="8"
              width="40"
              height="28"
              rx="8"
              fill="var(--color-panel-2)"
              stroke={allPlaced ? ACCENT : "var(--color-line)"}
              strokeWidth="2.2"
            />
            {/* body */}
            <rect
              x="24"
              y="38"
              width="52"
              height="34"
              rx="9"
              fill="var(--color-panel-2)"
              stroke={allPlaced ? ACCENT : "var(--color-line)"}
              strokeWidth="2.2"
            />
            {/* arms */}
            <rect
              x="14"
              y="42"
              width="9"
              height="22"
              rx="4.5"
              fill="var(--color-panel-2)"
              stroke={allPlaced ? ACCENT : "var(--color-line)"}
              strokeWidth="2"
            />
            <rect
              x="77"
              y="42"
              width="9"
              height="22"
              rx="4.5"
              fill="var(--color-panel-2)"
              stroke={allPlaced ? ACCENT : "var(--color-line)"}
              strokeWidth="2"
            />
            {/* glow ring when finished */}
            {allPlaced && (
              <rect
                x="20"
                y="6"
                width="60"
                height="70"
                rx="14"
                fill="none"
                stroke={ACCENT}
                strokeWidth="2"
                opacity="0.7"
                style={{ animation: "pulse-glow 1.4s ease-in-out infinite" }}
              />
            )}
          </svg>

          {/* slots: each is an absolutely-placed target box */}
          {SLOTS.map((s) => {
            const isPlaced = placed[s.id];
            const isHot =
              drag?.id === s.id; // the part being dragged matches this slot
            return (
              <div
                key={s.id}
                className="absolute grid place-items-center rounded-2xl"
                style={{
                  left: `${s.cx}%`,
                  top: `${s.cy}%`,
                  width: 64,
                  height: 64,
                  transform: "translate(-50%, -50%)",
                  fontSize: 30,
                  border: isPlaced
                    ? `2px solid ${ACCENT}`
                    : `3px dashed ${isHot ? s.color : "color-mix(in srgb, var(--color-ink-faint) 70%, transparent)"}`,
                  background: isPlaced
                    ? `color-mix(in srgb, ${ACCENT} 22%, transparent)`
                    : isHot
                      ? `color-mix(in srgb, ${s.color} 16%, transparent)`
                      : "color-mix(in srgb, var(--color-base) 35%, transparent)",
                  boxShadow: isPlaced
                    ? `0 0 18px color-mix(in srgb, ${ACCENT} 55%, transparent)`
                    : isHot
                      ? `0 0 16px color-mix(in srgb, ${s.color} 45%, transparent)`
                      : "none",
                  opacity: isPlaced ? 1 : 0.95,
                  transition: "background .15s, box-shadow .15s, border-color .15s",
                }}
              >
                {isPlaced ? (
                  <span
                    style={{
                      animation: "robo-pop .45s cubic-bezier(.34,1.56,.64,1)",
                      filter: `drop-shadow(0 0 6px ${s.color})`,
                    }}
                  >
                    {s.icon}
                  </span>
                ) : (
                  <span style={{ opacity: 0.35 }}>{s.icon}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* celebration burst */}
        {allPlaced && (
          <div
            className="pointer-events-none absolute inset-0 grid place-items-center"
            aria-hidden
          >
            {["✨", "🎉", "⭐", "✨", "🎉", "⭐"].map((c, i) => (
              <span
                key={i}
                className="absolute text-2xl"
                style={{
                  left: `${12 + i * 14}%`,
                  top: "8%",
                  animation: `confetti-fall ${1.1 + (i % 3) * 0.25}s ease-in ${i * 0.08}s infinite`,
                }}
              >
                {c}
              </span>
            ))}
            <span
              className="absolute bottom-2 text-4xl"
              style={{ animation: "robo-pop .5s cubic-bezier(.34,1.56,.64,1)" }}
            >
              🤖💚
            </span>
          </div>
        )}

        {/* the part currently being dragged floats above everything */}
        {drag && (
          <div
            className="pointer-events-none absolute grid place-items-center rounded-2xl"
            style={{
              left: `${drag.x}%`,
              top: `${drag.y}%`,
              width: 64,
              height: 64,
              fontSize: 32,
              transform: "translate(-50%, -50%) scale(1.18)",
              background: `color-mix(in srgb, ${slotById[drag.id].color} 22%, var(--color-panel))`,
              border: `3px solid ${slotById[drag.id].color}`,
              boxShadow: `0 0 22px color-mix(in srgb, ${slotById[drag.id].color} 70%, transparent)`,
              zIndex: 30,
            }}
          >
            {slotById[drag.id].icon}
          </div>
        )}
      </div>

      {/* ── tray of parts ─────────────────────────────────────── */}
      <div
        className="flex w-full items-center justify-center gap-3"
        style={{ maxWidth: 480 }}
      >
        {TRAY_ORDER.map((id) => {
          const s = slotById[id];
          const isPlaced = placed[id];
          const isDragging = drag?.id === id;
          const isWobbling = wobble === id;
          return (
            <button
              key={id}
              type="button"
              aria-label={`Place the ${s.label}`}
              disabled={isPlaced || allPlaced}
              onPointerDown={(e) => startDrag(e, id)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              className="grid place-items-center rounded-2xl"
              style={{
                width: 64,
                height: 64,
                fontSize: 30,
                touchAction: "none",
                cursor: isPlaced ? "default" : "grab",
                background: isPlaced
                  ? "var(--color-panel)"
                  : `color-mix(in srgb, ${s.color} 16%, var(--color-panel))`,
                border: `3px solid ${isPlaced ? "var(--color-line)" : s.color}`,
                boxShadow: isPlaced
                  ? "none"
                  : `0 0 14px color-mix(in srgb, ${s.color} 40%, transparent)`,
                opacity: isPlaced ? 0.28 : isDragging ? 0.25 : 1,
                transition: "opacity .15s, transform .12s",
                animation: isWobbling
                  ? "robo-shake .5s ease-in-out"
                  : "none",
                visibility: isDragging ? "hidden" : "visible",
              }}
            >
              {isPlaced ? "✔️" : s.icon}
            </button>
          );
        })}
      </div>

      {/* start over — big, icon-led */}
      <button
        type="button"
        onClick={reset}
        aria-label="Start over"
        className="flex items-center gap-2 rounded-xl px-5 py-3 font-display text-base"
        style={{
          background: allPlaced ? ACCENT : "var(--color-panel-2)",
          color: allPlaced ? "#060810" : "var(--color-ink-dim)",
          border: `2px solid ${allPlaced ? ACCENT : "var(--color-line)"}`,
        }}
      >
        <span aria-hidden style={{ fontSize: 20 }}>
          🔄
        </span>
        <span>{allPlaced ? "Again!" : "Start over"}</span>
      </button>

      {/* tiny progress dots, again emoji-only */}
      <div className="sr-only" aria-live="polite">
        {allPlaced
          ? "Robot complete! Great job!"
          : `${placedCount} of ${SLOTS.length} parts placed`}
      </div>

      {/* component-scoped keyframes (no global edits) */}
      <style>{`
        @keyframes robo-pop {
          0% { transform: scale(0); }
          70% { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
        @keyframes robo-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-7px) rotate(-5deg); }
          40% { transform: translateX(7px) rotate(5deg); }
          60% { transform: translateX(-5px) rotate(-3deg); }
          80% { transform: translateX(5px) rotate(3deg); }
        }
        @keyframes robo-wiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-3deg); }
          75% { transform: rotate(3deg); }
        }
      `}</style>
    </div>
  );
}
