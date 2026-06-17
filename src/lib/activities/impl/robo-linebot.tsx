"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Line Follower — sensors + conditionals + control loops            */
/*  The learner maps a 3-state line sensor (line is to the LEFT /     */
/*  CENTER / RIGHT of the robot) to a steering action. Press Run to   */
/*  simulate the robot driving the track tick-by-tick.                */
/* ------------------------------------------------------------------ */

const ACCENT = "#34d399";
const VIEW_W = 320;
const VIEW_H = 200;

type Sensor = "left" | "center" | "right";
type Action = "left" | "straight" | "right";
type Phase = "idle" | "running" | "won" | "lost";

interface Pt {
  x: number;
  y: number;
}

/** Smooth S-curve track sampled across t in [0,1]. Deterministic. */
function trackPoint(t: number): Pt {
  // A gentle S that snakes left→right across the canvas.
  const x = 36 + t * (VIEW_W - 72);
  const y = VIEW_H / 2 + Math.sin(t * Math.PI * 2) * 56;
  return { x, y };
}

const SAMPLES = 160;
const TRACK: Pt[] = Array.from({ length: SAMPLES + 1 }, (_, i) =>
  trackPoint(i / SAMPLES),
);

const TRACK_D: string = TRACK.map(
  (p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`,
).join(" ");

const SENSOR_LABEL: Record<Sensor, string> = {
  left: "Line is LEFT",
  center: "Line is CENTER",
  right: "Line is RIGHT",
};

const ACTIONS: { id: Action; label: string; glyph: string }[] = [
  { id: "left", label: "Steer Left", glyph: "↰" },
  { id: "straight", label: "Go Straight", glyph: "↑" },
  { id: "right", label: "Steer Right", glyph: "↱" },
];

/** Find nearest track index to a point (simple linear scan — track is small). */
function nearestIndex(px: number, py: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < TRACK.length; i++) {
    const dx = TRACK[i].x - px;
    const dy = TRACK[i].y - py;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

interface RobotState {
  x: number;
  y: number;
  heading: number; // radians
  idx: number; // nearest track index (progress)
  offTicks: number; // consecutive ticks far from the line
  sensor: Sensor;
}

function initialRobot(): RobotState {
  const start = TRACK[0];
  const next = TRACK[2];
  return {
    x: start.x,
    y: start.y,
    heading: Math.atan2(next.y - start.y, next.x - start.x),
    idx: 0,
    offTicks: 0,
    sensor: "center",
  };
}

export default function LineFollower({ onComplete }: ActivityProps) {
  const [rules, setRules] = useState<Record<Sensor, Action>>({
    left: "straight",
    center: "straight",
    right: "straight",
  });
  const [robot, setRobot] = useState<RobotState>(initialRobot);
  const [phase, setPhase] = useState<Phase>("idle");
  const [tries, setTries] = useState<number>(0);

  // Refs so the animation loop always reads fresh values without re-binding.
  const rulesRef = useRef(rules);
  const robotRef = useRef(robot);
  const phaseRef = useRef(phase);
  const rafRef = useRef<number | null>(null);
  const accRef = useRef<number>(0);
  const lastRef = useRef<number>(0);
  const ticksRef = useRef<number>(0);

  useEffect(() => {
    rulesRef.current = rules;
  }, [rules]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => stopLoop, [stopLoop]);

  /** Advance the simulation by one fixed tick. Pure-ish: mutates a copy. */
  const step = useCallback((): RobotState => {
    const r = robotRef.current;
    const STEP = 2.4; // forward distance per tick
    const TURN = 0.26; // radians steered per tick

    // ----- SENSE: where is the line relative to the robot's heading? -----
    const ni = nearestIndex(r.x, r.y);
    const target = TRACK[Math.min(ni + 6, TRACK.length - 1)];
    const toX = target.x - r.x;
    const toY = target.y - r.y;
    // cross product of heading vector and vector-to-line → side of line
    const hx = Math.cos(r.heading);
    const hy = Math.sin(r.heading);
    const cross = hx * toY - hy * toX;
    const dist = Math.hypot(toX, toY);

    let sensor: Sensor;
    if (Math.abs(cross) < 6 || dist < 4) sensor = "center";
    else if (cross < 0) sensor = "left";
    else sensor = "right";

    // ----- THINK: apply the learner's rule -----
    const action = rulesRef.current[sensor];
    let heading = r.heading;
    if (action === "left") heading -= TURN;
    else if (action === "right") heading += TURN;

    // ----- ACT: drive forward -----
    const nx = r.x + Math.cos(heading) * STEP;
    const ny = r.y + Math.sin(heading) * STEP;

    // distance from the line after moving (for the "lost" check)
    const checkI = nearestIndex(nx, ny);
    const lineDist = Math.hypot(
      TRACK[checkI].x - nx,
      TRACK[checkI].y - ny,
    );
    const offTicks = lineDist > 26 ? r.offTicks + 1 : 0;

    return {
      x: nx,
      y: ny,
      heading,
      idx: Math.max(r.idx, checkI),
      offTicks,
      sensor,
    };
  }, []);

  const finish = useCallback(
    (won: boolean) => {
      stopLoop();
      if (won) {
        setPhase("won");
        phaseRef.current = "won";
        onComplete({ passed: true, stars: 3 });
      } else {
        setPhase("lost");
        phaseRef.current = "lost";
        onComplete({
          passed: false,
          detail: "Lost the line — check your sensor rules",
        });
      }
    },
    [onComplete, stopLoop],
  );

  const loop = useCallback(
    (now: number) => {
      if (phaseRef.current !== "running") return;
      const dt = now - lastRef.current;
      lastRef.current = now;
      accRef.current += dt;
      const TICK_MS = 28;

      let steps = 0;
      while (accRef.current >= TICK_MS && steps < 4) {
        accRef.current -= TICK_MS;
        steps++;
        ticksRef.current++;
        const next = step();
        robotRef.current = next;

        // WIN: reached the end of the track.
        if (next.idx >= TRACK.length - 3) {
          setRobot(next);
          finish(true);
          return;
        }
        // LOSE: drifted off the line for too long, or never made it
        // to the goal in a reasonable number of ticks (e.g. spinning).
        if (next.offTicks > 22 || ticksRef.current > 600) {
          setRobot(next);
          finish(false);
          return;
        }
      }
      setRobot(robotRef.current);
      rafRef.current = requestAnimationFrame(loop);
    },
    [step, finish],
  );

  const handleRun = useCallback(() => {
    stopLoop();
    const fresh = initialRobot();
    robotRef.current = fresh;
    setRobot(fresh);
    accRef.current = 0;
    ticksRef.current = 0;
    lastRef.current = performance.now();
    setTries((t) => t + 1);
    setPhase("running");
    phaseRef.current = "running";
    rafRef.current = requestAnimationFrame(loop);
  }, [loop, stopLoop]);

  const handleReset = useCallback(() => {
    stopLoop();
    const fresh = initialRobot();
    robotRef.current = fresh;
    setRobot(fresh);
    accRef.current = 0;
    ticksRef.current = 0;
    setPhase("idle");
    phaseRef.current = "idle";
  }, [stopLoop]);

  const setRule = useCallback(
    (sensor: Sensor, action: Action) => {
      if (phaseRef.current === "running") return;
      setRules((prev) => ({ ...prev, [sensor]: action }));
      if (phase === "won" || phase === "lost") handleReset();
    },
    [phase, handleReset],
  );

  const running = phase === "running";
  const progressPct = Math.round((robot.idx / (TRACK.length - 1)) * 100);

  const status = useMemo(() => {
    if (phase === "won") return "Reached the goal! Nice driving 🤖";
    if (phase === "lost") return "Lost the line — tweak a rule and retry.";
    if (phase === "running")
      return `Driving… sensor: ${SENSOR_LABEL[robot.sensor]} · ${progressPct}%`;
    return "Set the rules, then press Run ▶";
  }, [phase, robot.sensor, progressPct]);

  const carColor = phase === "won" ? ACCENT : phase === "lost" ? "#f87171" : "#67e8f9";

  return (
    <div className="flex w-full flex-col gap-3 text-ink">
      {/* ---------------- CANVAS ---------------- */}
      <div
        className="panel relative overflow-hidden rounded-xl"
        style={{
          boxShadow:
            phase === "won" ? `0 0 0 1px ${ACCENT}, 0 0 24px -4px ${ACCENT}` : undefined,
          transition: "box-shadow .3s ease",
        }}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="block h-auto w-full"
          role="img"
          aria-label="Line-following robot track simulation"
        >
          <defs>
            <radialGradient id="lf-goal" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.9" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* faint circuit grid */}
          {Array.from({ length: 9 }, (_, i) => (
            <line
              key={`gv${i}`}
              x1={(i * VIEW_W) / 8}
              y1={0}
              x2={(i * VIEW_W) / 8}
              y2={VIEW_H}
              stroke="#1b2433"
              strokeWidth={0.5}
            />
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <line
              key={`gh${i}`}
              x1={0}
              y1={(i * VIEW_H) / 5}
              x2={VIEW_W}
              y2={(i * VIEW_H) / 5}
              stroke="#1b2433"
              strokeWidth={0.5}
            />
          ))}

          {/* track glow + line */}
          <path
            d={TRACK_D}
            fill="none"
            stroke={ACCENT}
            strokeOpacity={0.18}
            strokeWidth={14}
            strokeLinecap="round"
          />
          <path
            d={TRACK_D}
            fill="none"
            stroke={ACCENT}
            strokeWidth={4}
            strokeLinecap="round"
          />

          {/* start marker */}
          <circle cx={TRACK[0].x} cy={TRACK[0].y} r={5} fill="#67e8f9" />
          {/* goal marker */}
          <circle
            cx={TRACK[TRACK.length - 1].x}
            cy={TRACK[TRACK.length - 1].y}
            r={16}
            fill="url(#lf-goal)"
          />
          <circle
            cx={TRACK[TRACK.length - 1].x}
            cy={TRACK[TRACK.length - 1].y}
            r={6}
            fill="none"
            stroke={ACCENT}
            strokeWidth={2}
          />
          <text
            x={TRACK[TRACK.length - 1].x}
            y={TRACK[TRACK.length - 1].y - 14}
            fill={ACCENT}
            fontSize={9}
            textAnchor="middle"
            className="font-mono"
          >
            GOAL
          </text>

          {/* robot car */}
          <g
            transform={`translate(${robot.x} ${robot.y}) rotate(${
              (robot.heading * 180) / Math.PI
            })`}
          >
            {/* sensor whisker */}
            <line
              x1={0}
              y1={0}
              x2={14}
              y2={0}
              stroke={carColor}
              strokeWidth={1.5}
              strokeOpacity={0.7}
            />
            <rect
              x={-7}
              y={-5}
              width={14}
              height={10}
              rx={2.5}
              fill={carColor}
              stroke="#05070d"
              strokeWidth={1}
            />
            {/* sensor eye */}
            <circle cx={6} cy={0} r={2} fill="#05070d" />
          </g>
        </svg>

        {/* status line overlaid in-canvas */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-3 py-1.5">
          <span className="font-mono text-[11px] text-ink-dim">{status}</span>
          {phase === "running" && (
            <span
              className="font-mono text-[11px] uppercase tracking-tech"
              style={{ color: ACCENT }}
            >
              {robot.sensor}
            </span>
          )}
        </div>
      </div>

      {/* ---------------- RULE EDITOR ---------------- */}
      <div className="flex flex-col gap-2">
        <p className="font-mono text-[11px] uppercase tracking-tech text-ink-faint">
          If the sensor says… → steer like this
        </p>
        {(["left", "center", "right"] as Sensor[]).map((sensor) => (
          <div
            key={sensor}
            className="flex flex-col gap-1.5 rounded-lg border border-line bg-panel/60 p-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="flex items-center gap-2 font-mono text-xs text-ink">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: ACCENT }}
              />
              {SENSOR_LABEL[sensor]}
            </span>
            <div
              className="flex gap-1"
              role="group"
              aria-label={`Action when ${SENSOR_LABEL[sensor]}`}
            >
              {ACTIONS.map((a) => {
                const active = rules[sensor] === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setRule(sensor, a.id)}
                    disabled={running}
                    aria-pressed={active}
                    aria-label={`${SENSOR_LABEL[sensor]}: ${a.label}`}
                    title={a.label}
                    className="flex items-center gap-1 rounded-md px-2 py-1 font-mono text-xs transition disabled:opacity-50"
                    style={
                      active
                        ? { background: ACCENT, color: "#05070d", fontWeight: 600 }
                        : { color: "var(--color-ink-dim, #9aa6b2)" }
                    }
                  >
                    <span aria-hidden className="text-sm">
                      {a.glyph}
                    </span>
                    <span className="hidden sm:inline">{a.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ---------------- CONTROLS ---------------- */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-ink-faint">
          Tries: {tries}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
            aria-label="Reset the robot to the start"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            style={{ background: ACCENT, color: "#05070d" }}
            aria-label="Run the simulation"
          >
            {running ? "Running…" : "Run ▶"}
          </button>
        </div>
      </div>
    </div>
  );
}
