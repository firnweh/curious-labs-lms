"use client";
// Learning goal: drive a disaster robot with tank steering across an obstacle
// grid, then set a thermal DETECTION THRESHOLD that fires on the 38°C victim
// but NOT on the 34°C sun-warmed decoy wall — a real heat-signature vs. a
// false positive. Win = reach + detect the victim with 0 false alarms.
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

const ACCENT = "#34d399";

/** 4×4 rubble field = a 2 m × 2 m square of 0.5 m cells. */
const N = 4;

/** Compass heading the robot faces. Index into DIRS below. */
type Heading = 0 | 1 | 2 | 3; // 0 = North(up), 1 = East, 2 = South, 3 = West

/** Unit step in grid coords per heading (row grows downward = South). */
const DIRS: readonly { dc: number; dr: number; name: string }[] = [
  { dc: 0, dr: -1, name: "North" },
  { dc: 1, dr: 0, name: "East" },
  { dc: 0, dr: 1, name: "South" },
  { dc: -1, dr: 0, name: "West" },
] as const;

interface Cell {
  c: number;
  r: number;
}

/** Foam-block obstacles. A clear path to the victim is guaranteed. */
const BLOCKS: readonly Cell[] = [
  { c: 1, r: 1 },
  { c: 2, r: 1 },
  { c: 1, r: 3 },
] as const;

/** Hidden heated victim — reads ~38°C on the thermal sensor. */
const VICTIM: Cell = { c: 3, r: 0 };

/** Sun-warmed "warm wall" decoy — reads ~34°C, a tempting false positive. */
const DECOY: Cell = { c: 0, r: 3 };

const START: Cell = { c: 0, r: 0 };
const START_HEADING: Heading = 2; // facing South

const AMBIENT_C = 26;
const DECOY_C = 34;
const VICTIM_C = 38;

// Mission budget — generous, but rewards a tidy run.
const MOVE_BUDGET = 24;
const COLLISION_CAP = 3;

function sameCell(a: Cell, b: Cell): boolean {
  return a.c === b.c && a.r === b.r;
}

function isBlock(c: number, r: number): boolean {
  return BLOCKS.some((b) => b.c === c && b.r === r);
}

function inBounds(c: number, r: number): boolean {
  return c >= 0 && c < N && r >= 0 && r < N;
}

/** Temperature the non-contact thermal sensor reads for a given cell. */
function tempAt(c: number, r: number): number {
  if (VICTIM.c === c && VICTIM.r === r) return VICTIM_C;
  if (DECOY.c === c && DECOY.r === r) return DECOY_C;
  return AMBIENT_C;
}

/** The cell directly in front of the robot (may be off-grid). */
function facedCell(pos: Cell, h: Heading): Cell {
  return { c: pos.c + DIRS[h].dc, r: pos.r + DIRS[h].dr };
}

/** Ultrasonic: cells to the nearest obstacle/wall straight ahead. */
function ultrasonic(pos: Cell, h: Heading): number {
  let d = 0;
  let c = pos.c;
  let r = pos.r;
  for (let step = 0; step < N; step++) {
    c += DIRS[h].dc;
    r += DIRS[h].dr;
    if (!inBounds(c, r) || isBlock(c, r)) return d;
    d += 1;
  }
  return d;
}

interface RobotState {
  pos: Cell;
  heading: Heading;
}

export default function DisasterRescueRobot({ onComplete }: ActivityProps) {
  const [robot, setRobot] = useState<RobotState>({
    pos: { ...START },
    heading: START_HEADING,
  });
  const [threshold, setThreshold] = useState<number>(30);
  const [moves, setMoves] = useState<number>(0);
  const [collisions, setCollisions] = useState<number>(0);
  const [falseAlarms, setFalseAlarms] = useState<number>(0);
  const [solved, setSolved] = useState<boolean>(false);
  const [flash, setFlash] = useState<"none" | "victim" | "false">("none");
  const [status, setStatus] = useState<string>(
    "Drive with the tracks. Face a cell, then DETECT — find the 38°C victim.",
  );
  const firedRef = useRef<boolean>(false);

  const faced = useMemo(
    () => facedCell(robot.pos, robot.heading),
    [robot],
  );
  const facedInBounds = inBounds(faced.c, faced.r);
  const facedTemp = facedInBounds ? tempAt(faced.c, faced.r) : null;
  const distance = useMemo(
    () => ultrasonic(robot.pos, robot.heading),
    [robot],
  );
  const facingVictim = facedInBounds && sameCell(faced, VICTIM);

  const nudge = useCallback(
    (msg: string): void => {
      setStatus(msg);
      if (!firedRef.current) onComplete({ passed: false, detail: msg });
    },
    [onComplete],
  );

  /**
   * Tank steering. left/right = +1 (forward) / -1 (back) / 0 for each track.
   *   equal & non-zero  → drive straight that way
   *   opposite          → spin in place (90° per press)
   */
  const drive = useCallback(
    (left: number, right: number): void => {
      if (solved) return;
      setFlash("none");

      // Spin: tracks oppose.
      if (left === -right && left !== 0) {
        setRobot((s) => ({
          ...s,
          heading: (((s.heading + (left > 0 ? 1 : 3)) % 4) as Heading),
        }));
        setMoves((m) => m + 1);
        setStatus(
          left > 0 ? "Spun clockwise — new heading." : "Spun anti-clockwise — new heading.",
        );
        return;
      }

      // Straight: tracks agree.
      const dirSign = left; // == right here
      setRobot((s) => {
        const dir = DIRS[s.heading];
        const tc = s.pos.c + dir.dc * dirSign;
        const tr = s.pos.r + dir.dr * dirSign;
        if (!inBounds(tc, tr) || isBlock(tc, tr)) {
          setCollisions((x) => x + 1);
          setStatus(
            isBlock(tc, tr)
              ? "Bump! Foam block ahead — backed off. Steer around it."
              : "Bump! Field edge — backed off.",
          );
          return s; // bumped back to same cell
        }
        return { ...s, pos: { c: tc, r: tr } };
      });
      setMoves((m) => m + 1);
    },
    [solved],
  );

  const detect = useCallback((): void => {
    if (solved) return;
    if (!facedInBounds || facedTemp === null) {
      nudge("Sensor points off the field. Spin to face a rubble cell first.");
      return;
    }
    const fires = facedTemp > threshold;

    // False alarm: threshold fired on the warm decoy (or ambient), not the victim.
    if (fires && !facingVictim) {
      setFalseAlarms((f) => f + 1);
      setFlash("false");
      const onDecoy = sameCell(faced, DECOY);
      nudge(
        onDecoy
          ? `False alarm! The sunny wall is only ${DECOY_C}°C. Raise the threshold above ${DECOY_C} so it won't trip here.`
          : `False alarm! Ambient rubble is ${AMBIENT_C}°C — your threshold is far too low.`,
      );
      return;
    }

    if (facingVictim && !fires) {
      setFlash("none");
      nudge(
        `Victim cell reads ${VICTIM_C}°C but your threshold (${threshold}°C) is too high — lower it below ${VICTIM_C}.`,
      );
      return;
    }

    if (!facingVictim) {
      nudge("No heat signature here. Keep searching — the victim is hotter.");
      return;
    }

    // facingVictim && fires → check threshold rejects the 34°C decoy too.
    if (threshold < DECOY_C) {
      setFlash("victim");
      nudge(
        `Detected — but this same threshold would also trip on the ${DECOY_C}°C sunny wall. Tighten it into the ${DECOY_C + 1}–${VICTIM_C - 1} window.`,
      );
      return;
    }

    // Within budget?
    if (moves > MOVE_BUDGET) {
      setFlash("victim");
      nudge("Victim found, but the run was long. Tap Reset for a tidy 3-star run.");
      return;
    }
    if (collisions > COLLISION_CAP) {
      setFlash("victim");
      nudge(
        `Victim found, but ${collisions} collisions (cap ${COLLISION_CAP}). Reset and steer cleaner for full marks.`,
      );
      return;
    }

    // WIN.
    setSolved(true);
    setFlash("victim");
    setStatus("Mission success: victim found, 0 false alarms ✨🎉 ⭐⭐⭐");
    if (!firedRef.current) {
      firedRef.current = true;
      onComplete({
        passed: true,
        stars: 3,
        detail: `Victim at ${VICTIM_C}°C detected, decoy rejected — ${moves} moves, ${collisions} bumps, ${falseAlarms} false alarms.`,
      });
    }
  }, [
    solved,
    facedInBounds,
    facedTemp,
    threshold,
    facingVictim,
    faced,
    moves,
    collisions,
    falseAlarms,
    nudge,
    onComplete,
  ]);

  const reset = useCallback((): void => {
    setRobot({ pos: { ...START }, heading: START_HEADING });
    setThreshold(30);
    setMoves(0);
    setCollisions(0);
    setFalseAlarms(0);
    setSolved(false);
    setFlash("none");
    firedRef.current = false;
    setStatus("Drive with the tracks. Face a cell, then DETECT — find the 38°C victim.");
  }, []);

  // ── SVG geometry ──────────────────────────────────────────────
  const VB = 200;
  const PAD = 12;
  const span = VB - PAD * 2;
  const cw = span / N;
  const cx = (c: number): number => PAD + c * cw;
  const cy = (r: number): number => PAD + r * cw;

  // Robot triangle pointing along its heading, centred in its cell.
  const robotPoly = useMemo(() => {
    const ox = cx(robot.pos.c) + cw / 2;
    const oy = cy(robot.pos.r) + cw / 2;
    const a = (robot.heading * Math.PI) / 2 - Math.PI / 2; // 0=North→ -90°
    const tip = 0.34 * cw;
    const back = 0.26 * cw;
    const pts: [number, number][] = [
      [ox + tip * Math.cos(a), oy + tip * Math.sin(a)],
      [ox + back * Math.cos(a + 2.4), oy + back * Math.sin(a + 2.4)],
      [ox + back * Math.cos(a - 2.4), oy + back * Math.sin(a - 2.4)],
    ];
    return pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  }, [robot, cw]);

  const distBeep = distance === 0 ? "▮▮▮ TOO CLOSE" : distance === 1 ? "▮▮ ·beep beep·" : distance === 2 ? "▮ ·beep·" : "clear";
  const tempColor =
    facedTemp === null
      ? "#9aa6cf"
      : facedTemp >= VICTIM_C
        ? "#f87171"
        : facedTemp >= DECOY_C
          ? "#f59e0b"
          : "#60a5fa";
  const willFire = facedTemp !== null && facedTemp > threshold;

  return (
    <div
      className="mx-auto flex w-full max-w-[440px] flex-col gap-3 font-mono"
      style={{ color: "#cbd3ef" }}
    >
      <style>{`
        @keyframes g9rescuerobot-victimflash {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.7; }
        }
        @keyframes g9rescuerobot-falseflash {
          0% { opacity: 0; }
          25% { opacity: 0.6; }
          100% { opacity: 0; }
        }
        @keyframes g9rescuerobot-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.18); }
        }
      `}</style>

      {/* Rubble field */}
      <div
        className="relative overflow-hidden rounded-xl border p-2"
        style={{
          borderColor: solved ? ACCENT : "#27314f",
          background: "rgba(11,16,32,0.6)",
          boxShadow: solved ? `0 0 22px -6px ${ACCENT}` : undefined,
        }}
      >
        <svg
          viewBox={`0 0 ${VB} ${VB}`}
          className="block w-full"
          role="img"
          aria-label="Top-down 2 metre rubble field with foam blocks, a sunny decoy wall, and a hidden heated victim, with the rescue robot you drive."
        >
          {/* grid cells */}
          {Array.from({ length: N }).map((_, r) =>
            Array.from({ length: N }).map((__, c) => (
              <rect
                key={`${c}-${r}`}
                x={cx(c)}
                y={cy(r)}
                width={cw}
                height={cw}
                fill={(c + r) % 2 === 0 ? "#0d1426" : "#101a30"}
                stroke="#1c2540"
                strokeWidth={1}
              />
            )),
          )}

          {/* sunny decoy wall */}
          <g>
            <rect
              x={cx(DECOY.c)}
              y={cy(DECOY.r)}
              width={cw}
              height={cw}
              fill="#f59e0b"
              opacity={0.18}
            />
            <text
              x={cx(DECOY.c) + cw / 2}
              y={cy(DECOY.r) + cw / 2 + 6}
              textAnchor="middle"
              fontSize="18"
            >
              ☀️
            </text>
          </g>

          {/* victim cell — revealed when faced or solved, else hidden in rubble */}
          <g>
            {(facingVictim || solved) && (
              <rect
                x={cx(VICTIM.c)}
                y={cy(VICTIM.r)}
                width={cw}
                height={cw}
                fill="#f87171"
                style={{
                  animation: "g9rescuerobot-victimflash 1s ease-in-out infinite",
                }}
              />
            )}
            <text
              x={cx(VICTIM.c) + cw / 2}
              y={cy(VICTIM.r) + cw / 2 + 6}
              textAnchor="middle"
              fontSize="18"
              opacity={facingVictim || solved ? 1 : 0.45}
            >
              {facingVictim || solved ? "🧍" : "❓"}
            </text>
          </g>

          {/* foam blocks */}
          {BLOCKS.map((b, i) => (
            <g key={i}>
              <rect
                x={cx(b.c) + 3}
                y={cy(b.r) + 3}
                width={cw - 6}
                height={cw - 6}
                rx={4}
                fill="#3a2c0a"
                stroke="#5a440f"
                strokeWidth={1.4}
              />
              <text
                x={cx(b.c) + cw / 2}
                y={cy(b.r) + cw / 2 + 5}
                textAnchor="middle"
                fontSize="15"
              >
                🧱
              </text>
            </g>
          ))}

          {/* ultrasonic ray ahead of the robot */}
          {facedInBounds && (
            <line
              x1={cx(robot.pos.c) + cw / 2}
              y1={cy(robot.pos.r) + cw / 2}
              x2={cx(faced.c) + cw / 2}
              y2={cy(faced.r) + cw / 2}
              stroke={willFire ? "#f87171" : ACCENT}
              strokeWidth={2}
              strokeDasharray="4 3"
              opacity={0.7}
            />
          )}

          {/* false-alarm red wash */}
          {flash === "false" && (
            <rect
              x={0}
              y={0}
              width={VB}
              height={VB}
              fill="#f87171"
              style={{ animation: "g9rescuerobot-falseflash 600ms ease both" }}
            />
          )}

          {/* the robot */}
          <polygon
            points={robotPoly}
            fill={flash === "victim" ? "#f87171" : ACCENT}
            stroke="#05221a"
            strokeWidth={1.5}
            style={
              flash === "victim"
                ? { animation: "g9rescuerobot-pulse 500ms ease-in-out infinite", transformBox: "fill-box", transformOrigin: "center" }
                : undefined
            }
          />
        </svg>

        {/* status line */}
        <div
          className="mt-1 rounded-md px-2 py-1 text-center text-[11px] leading-tight"
          role="status"
          aria-live="polite"
          style={{
            color: solved ? "#05070d" : "#9aa6cf",
            background: solved ? ACCENT : "transparent",
          }}
        >
          {status}
        </div>
      </div>

      {/* Sensor readouts */}
      <div className="grid grid-cols-2 gap-2">
        <div
          className="rounded-xl border p-2 text-center"
          style={{ borderColor: "#27314f", background: "rgba(11,16,32,0.6)" }}
        >
          <div className="text-[10px]" style={{ color: "#9aa6cf" }}>
            ULTRASONIC · {DIRS[robot.heading].name}
          </div>
          <div className="text-base tabular-nums" style={{ color: distance <= 1 ? "#f59e0b" : ACCENT }}>
            {(distance * 0.5).toFixed(1)} m
          </div>
          <div className="text-[10px]" style={{ color: distance <= 1 ? "#f59e0b" : "#9aa6cf" }}>
            {distBeep}
          </div>
        </div>
        <div
          className="rounded-xl border p-2 text-center"
          style={{ borderColor: "#27314f", background: "rgba(11,16,32,0.6)" }}
        >
          <div className="text-[10px]" style={{ color: "#9aa6cf" }}>
            THERMAL · faced cell
          </div>
          <div className="text-base tabular-nums" style={{ color: tempColor }}>
            {facedTemp === null ? "—" : `${facedTemp}°C`}
          </div>
          <div className="text-[10px]" style={{ color: willFire ? "#f87171" : "#9aa6cf" }}>
            {facedTemp === null ? "off field" : willFire ? "above threshold" : "below threshold"}
          </div>
        </div>
      </div>

      {/* Detection threshold */}
      <div
        className="rounded-xl border p-3"
        style={{ borderColor: "#27314f", background: "rgba(11,16,32,0.6)" }}
      >
        <label className="flex flex-col gap-1 text-xs">
          <span className="flex items-center justify-between">
            <span style={{ color: "#9aa6cf" }}>
              Detection threshold <span className="text-ink-faint">· fire if temp &gt; this</span>
            </span>
            <span className="tabular-nums" style={{ color: ACCENT }}>
              {threshold}°C
            </span>
          </span>
          <input
            type="range"
            min={26}
            max={40}
            step={1}
            value={threshold}
            onChange={(e) => {
              setThreshold(Number(e.target.value));
              setFlash("none");
            }}
            disabled={solved}
            aria-label={`Detection threshold, ${threshold} degrees Celsius`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full"
            style={{ accentColor: ACCENT, background: "#10182e", touchAction: "none" }}
          />
          <span className="text-[10px]" style={{ color: "#9aa6cf" }}>
            Decoy wall = {DECOY_C}°C · victim = {VICTIM_C}°C · ambient = {AMBIENT_C}°C
          </span>
        </label>
      </div>

      {/* Tank-steering controls */}
      <div className="flex items-stretch gap-2" role="group" aria-label="Tank steering tracks">
        <TrackPad
          title="LEFT track"
          onForward={() => drive(1, 1)}
          onBack={() => drive(-1, -1)}
          disabled={solved}
        />
        <div className="flex flex-1 flex-col gap-2">
          <button
            type="button"
            onPointerDown={() => detect()}
            disabled={solved}
            className="flex-1 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ background: ACCENT, color: "#05070d", touchAction: "manipulation" }}
            aria-label="Run thermal detection on the cell the robot faces"
          >
            🌡 DETECT
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onPointerDown={() => drive(-1, 1)}
              disabled={solved}
              className="rounded-lg border px-2 py-2 text-sm disabled:opacity-50"
              style={{ borderColor: "#27314f", background: "rgba(11,16,32,0.6)", color: "#cbd3ef", touchAction: "manipulation" }}
              aria-label="Spin left, anti-clockwise"
            >
              ↺ spin
            </button>
            <button
              type="button"
              onPointerDown={() => drive(1, -1)}
              disabled={solved}
              className="rounded-lg border px-2 py-2 text-sm disabled:opacity-50"
              style={{ borderColor: "#27314f", background: "rgba(11,16,32,0.6)", color: "#cbd3ef", touchAction: "manipulation" }}
              aria-label="Spin right, clockwise"
            >
              spin ↻
            </button>
          </div>
        </div>
        <TrackPad
          title="RIGHT track"
          onForward={() => drive(1, 1)}
          onBack={() => drive(-1, -1)}
          disabled={solved}
        />
      </div>

      {/* Mission stats + reset */}
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="tabular-nums" style={{ color: moves > MOVE_BUDGET ? "#f87171" : "#9aa6cf" }}>
          moves {moves}/{MOVE_BUDGET}
        </span>
        <span className="tabular-nums" style={{ color: collisions > COLLISION_CAP ? "#f87171" : "#9aa6cf" }}>
          collisions {collisions}/{COLLISION_CAP}
        </span>
        <span className="tabular-nums" style={{ color: falseAlarms > 0 ? "#f59e0b" : ACCENT }}>
          false alarms {falseAlarms}
        </span>
        <button
          type="button"
          onPointerDown={reset}
          className="rounded-lg border px-3 py-1.5 font-medium"
          style={{ borderColor: "#27314f", background: "rgba(11,16,32,0.6)", color: "#9aa6cf", touchAction: "manipulation" }}
          aria-label="Reset the mission"
        >
          Reset
        </button>
      </div>

      {/* Debrief card */}
      <div
        className="rounded-xl border p-3 text-[11px] leading-snug"
        style={{ borderColor: solved ? ACCENT : "#27314f", background: "rgba(11,16,32,0.6)" }}
      >
        <p className="mb-1 font-semibold" style={{ color: solved ? ACCENT : "#cbd3ef" }}>
          {solved ? "✅ Debrief — mission success" : "Field notes"}
        </p>
        <p style={{ color: "#9aa6cf" }}>
          Failure modes: a threshold ≤ {DECOY_C}°C trips on the sunny wall (false alarm); a
          threshold ≥ {VICTIM_C}°C misses the victim; bumping foam blocks wastes time. A safe
          window is {DECOY_C + 1}–{VICTIM_C - 1}°C.
        </p>
        <p className="mt-1" style={{ color: "#9aa6cf" }}>
          Upgrade ideas: 1) GPS for absolute position, 2) a 360° camera to map rubble,
          3) a gripper arm to free a trapped victim.
        </p>
      </div>
    </div>
  );
}

function TrackPad({
  title,
  onForward,
  onBack,
  disabled,
}: {
  title: string;
  onForward: () => void;
  onBack: () => void;
  disabled: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-2"
      role="group"
      aria-label={title}
      style={{ minWidth: 64 }}
    >
      <button
        type="button"
        onPointerDown={onForward}
        disabled={disabled}
        className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
        style={{ borderColor: "#27314f", background: "rgba(11,16,32,0.6)", color: "#cbd3ef", touchAction: "manipulation" }}
        aria-label={`${title} forward`}
      >
        ▲
      </button>
      <span className="text-center text-[9px]" style={{ color: "#9aa6cf" }}>
        {title.split(" ")[0]}
      </span>
      <button
        type="button"
        onPointerDown={onBack}
        disabled={disabled}
        className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
        style={{ borderColor: "#27314f", background: "rgba(11,16,32,0.6)", color: "#cbd3ef", touchAction: "manipulation" }}
        aria-label={`${title} backward`}
      >
        ▼
      </button>
    </div>
  );
}
