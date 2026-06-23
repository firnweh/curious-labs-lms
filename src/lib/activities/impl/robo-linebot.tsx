"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Line Follower — sensors + conditionals + control loops            */
/*  CLASS 4-6 (explorer, age ~9-11) ROBOTICS lab.                     */
/*                                                                    */
/*  The learner programs a robot's control loop: map a 3-state line   */
/*  sensor (line is LEFT / CENTER / RIGHT of the robot) to a steering */
/*  action, press Run, and watch the robot drive the track live.      */
/*                                                                    */
/*  This is a REAL problem across THREE escalating rounds, not a      */
/*  one-tap toy:                                                      */
/*    R1  LEARN  — a normal robot. Find the basic rule that holds the */
/*                 line. (The intuitive identity mapping works here.) */
/*    R2  DEBUG  — the rules are ALMOST right but a teammate wired ONE */
/*                 line wrong. Find the buggy rule and fix it.        */
/*    R3  MIRROR — the camera was mounted UPSIDE-DOWN, so it reports  */
/*                 the line on the WRONG side. The obvious mapping    */
/*                 now drives the robot OFF the track — you must      */
/*                 reason about the flipped wiring and invert it.     */
/*                                                                    */
/*  OPTIMISE for stars: solve cleanly (few Runs / few rule edits) for */
/*  3 stars; a messy win still passes. Deterministic, winnable,       */
/*  never scolds. Keeps the original SVG/sim polish.                  */
/* ------------------------------------------------------------------ */

const ACCENT = "#34d399";
const VIEW_W = 320;
const VIEW_H = 200;

type Sensor = "left" | "center" | "right";
type Action = "left" | "straight" | "right";
type Phase = "idle" | "running" | "won" | "lost" | "done";

interface Pt {
  x: number;
  y: number;
}

/** A round's configuration. `mirror` flips what the camera reports;
 *  `prefill` seeds the rule editor (used by the DEBUG round). */
interface Round {
  key: string;
  label: string;
  tag: string;
  blurb: string;
  amp: number; // S-curve amplitude — bigger = sharper, harder track
  mirror: boolean; // camera mounted upside-down → sensor side is inverted
  prefill: Record<Sensor, Action>;
}

const ROUNDS: ReadonlyArray<Round> = [
  {
    key: "learn",
    label: "Round 1 · Learn the loop",
    tag: "LEARN",
    blurb:
      "Sense → think → steer. Set each rule so the robot turns toward the line and hugs the track to the GOAL.",
    amp: 48,
    mirror: false,
    prefill: { left: "straight", center: "straight", right: "straight" },
  },
  {
    key: "debug",
    label: "Round 2 · Fix the bug",
    tag: "DEBUG",
    blurb:
      "A teammate pre-wired the robot, but ONE rule is wrong and it keeps sliding off. Find the buggy rule and fix it.",
    amp: 60,
    mirror: false,
    // Almost right: CENTER + RIGHT are correct, LEFT is buggy (steers right → away from the line).
    prefill: { left: "right", center: "straight", right: "right" },
  },
  {
    key: "mirror",
    label: "Round 3 · Mirror camera",
    tag: "MIRROR",
    blurb:
      "The camera was bolted on UPSIDE-DOWN, so it reports the line on the WRONG side! The normal rule drives it off the track. Flip your thinking.",
    amp: 56,
    mirror: true,
    prefill: { left: "straight", center: "straight", right: "straight" },
  },
];

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

/** Smooth S-curve track for a given amplitude. Deterministic. */
function makeTrack(amp: number): Pt[] {
  const SAMPLES = 160;
  return Array.from({ length: SAMPLES + 1 }, (_, i) => {
    const t = i / SAMPLES;
    return {
      x: 36 + t * (VIEW_W - 72),
      y: VIEW_H / 2 + Math.sin(t * Math.PI * 2) * amp,
    };
  });
}

function trackPath(track: Pt[]): string {
  return track
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}

/** Nearest track index to a point (linear scan — track is small). */
function nearestIndex(track: Pt[], px: number, py: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < track.length; i++) {
    const dx = track[i].x - px;
    const dy = track[i].y - py;
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
  sensor: Sensor; // what the controller acted on (already mirror-adjusted)
}

function initialRobot(track: Pt[]): RobotState {
  const start = track[0];
  const next = track[2];
  return {
    x: start.x,
    y: start.y,
    heading: Math.atan2(next.y - start.y, next.x - start.x),
    idx: 0,
    offTicks: 0,
    sensor: "center",
  };
}

/** The flawless reference rule for a round — used only to give a star
 *  bonus, never to block a win. (Mirror inverts left/right.) */
function idealRules(round: Round): Record<Sensor, Action> {
  return round.mirror
    ? { left: "right", center: "straight", right: "left" }
    : { left: "left", center: "straight", right: "right" };
}

export default function LineFollower({ onComplete }: ActivityProps) {
  const [roundIdx, setRoundIdx] = useState<number>(0);
  const round = ROUNDS[roundIdx];

  const track = useMemo(() => makeTrack(round.amp), [round.amp]);
  const trackD = useMemo(() => trackPath(track), [track]);

  const [rules, setRules] = useState<Record<Sensor, Action>>(round.prefill);
  const [robot, setRobot] = useState<RobotState>(() => initialRobot(track));
  const [phase, setPhase] = useState<Phase>("idle");
  const [runs, setRuns] = useState<number>(0); // total Runs across all rounds (optimisation metric)

  // Refs so the animation loop always reads fresh values without re-binding.
  const rulesRef = useRef(rules);
  const robotRef = useRef(robot);
  const phaseRef = useRef(phase);
  const trackRef = useRef(track);
  const roundRef = useRef(round);
  const rafRef = useRef<number | null>(null);
  const accRef = useRef<number>(0);
  const lastRef = useRef<number>(0);
  const ticksRef = useRef<number>(0);
  const reportedRef = useRef<boolean>(false);

  useEffect(() => {
    rulesRef.current = rules;
  }, [rules]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    trackRef.current = track;
  }, [track]);
  useEffect(() => {
    roundRef.current = round;
  }, [round]);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => stopLoop, [stopLoop]);

  // Fresh round: load its pre-wired rules, park the robot at the start.
  useEffect(() => {
    stopLoop();
    const fresh = initialRobot(trackRef.current);
    robotRef.current = fresh;
    setRobot(fresh);
    setRules(ROUNDS[roundIdx].prefill);
    rulesRef.current = ROUNDS[roundIdx].prefill;
    accRef.current = 0;
    ticksRef.current = 0;
    setPhase("idle");
    phaseRef.current = "idle";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundIdx, stopLoop]);

  /** Advance the simulation by one fixed tick. */
  const step = useCallback((): RobotState => {
    const r = robotRef.current;
    const tk = trackRef.current;
    const rd = roundRef.current;
    const STEP = 2.4; // forward distance per tick
    const TURN = 0.26; // radians steered per tick

    // ----- SENSE: where is the line relative to the robot's heading? -----
    const ni = nearestIndex(tk, r.x, r.y);
    const target = tk[Math.min(ni + 6, tk.length - 1)];
    const toX = target.x - r.x;
    const toY = target.y - r.y;
    const hx = Math.cos(r.heading);
    const hy = Math.sin(r.heading);
    const cross = hx * toY - hy * toX;
    const dist = Math.hypot(toX, toY);

    let sensor: Sensor;
    if (Math.abs(cross) < 6 || dist < 4) sensor = "center";
    else if (cross < 0) sensor = "left";
    else sensor = "right";

    // MIRROR twist: the camera is upside-down, so it reports the OPPOSITE
    // side. The controller (and the on-screen readout) act on this flipped
    // value — the learner has to reason past it.
    if (rd.mirror) {
      if (sensor === "left") sensor = "right";
      else if (sensor === "right") sensor = "left";
    }

    // ----- THINK: apply the learner's rule -----
    const action = rulesRef.current[sensor];
    let heading = r.heading;
    if (action === "left") heading -= TURN;
    else if (action === "right") heading += TURN;

    // ----- ACT: drive forward -----
    const nx = r.x + Math.cos(heading) * STEP;
    const ny = r.y + Math.sin(heading) * STEP;

    const checkI = nearestIndex(tk, nx, ny);
    const lineDist = Math.hypot(tk[checkI].x - nx, tk[checkI].y - ny);
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

  // Award stars from the optimisation metric: total Runs used to clear all
  // three rounds. Lean solving = 3 stars; still always a win.
  const starsFor = useCallback((totalRuns: number): 1 | 2 | 3 => {
    if (totalRuns <= 5) return 3; // ~1-2 runs per round
    if (totalRuns <= 9) return 2;
    return 1;
  }, []);

  const finishRound = useCallback(
    (won: boolean) => {
      stopLoop();
      if (!won) {
        setPhase("lost");
        phaseRef.current = "lost";
        return; // gentle retry — never reports a failure
      }
      const last = roundIdx >= ROUNDS.length - 1;
      if (last) {
        setPhase("done");
        phaseRef.current = "done";
        if (!reportedRef.current) {
          reportedRef.current = true;
          // `runs` already counts this final run (incremented on Run press).
          const stars = starsFor(runs);
          onComplete({
            passed: true,
            stars,
            detail:
              stars === 3
                ? "All three robots solved — lean and clean! 🤖⭐"
                : "All three robots reached the GOAL! 🤖",
          });
        }
      } else {
        setPhase("won");
        phaseRef.current = "won";
      }
    },
    [stopLoop, roundIdx, runs, starsFor, onComplete],
  );

  const loop = useCallback(
    (now: number) => {
      if (phaseRef.current !== "running") return;
      const dt = now - lastRef.current;
      lastRef.current = now;
      accRef.current += dt;
      const TICK_MS = 28;
      const tk = trackRef.current;

      let steps = 0;
      while (accRef.current >= TICK_MS && steps < 4) {
        accRef.current -= TICK_MS;
        steps++;
        ticksRef.current++;
        const next = step();
        robotRef.current = next;

        if (next.idx >= tk.length - 3) {
          setRobot(next);
          finishRound(true);
          return;
        }
        if (next.offTicks > 22 || ticksRef.current > 600) {
          setRobot(next);
          finishRound(false);
          return;
        }
      }
      setRobot(robotRef.current);
      rafRef.current = requestAnimationFrame(loop);
    },
    [step, finishRound],
  );

  const handleRun = useCallback(() => {
    if (phaseRef.current === "running") return;
    stopLoop();
    const fresh = initialRobot(trackRef.current);
    robotRef.current = fresh;
    setRobot(fresh);
    accRef.current = 0;
    ticksRef.current = 0;
    lastRef.current = performance.now();
    setRuns((n) => n + 1);
    setPhase("running");
    phaseRef.current = "running";
    rafRef.current = requestAnimationFrame(loop);
  }, [loop, stopLoop]);

  const parkRobot = useCallback(() => {
    stopLoop();
    const fresh = initialRobot(trackRef.current);
    robotRef.current = fresh;
    setRobot(fresh);
    accRef.current = 0;
    ticksRef.current = 0;
    setPhase("idle");
    phaseRef.current = "idle";
  }, [stopLoop]);

  const nextRound = useCallback(() => {
    if (roundIdx < ROUNDS.length - 1) setRoundIdx((i) => i + 1);
  }, [roundIdx]);

  const setRule = useCallback(
    (sensor: Sensor, action: Action) => {
      if (phaseRef.current === "running" || phaseRef.current === "done") return;
      setRules((prev) => ({ ...prev, [sensor]: action }));
      rulesRef.current = { ...rulesRef.current, [sensor]: action };
      if (phaseRef.current === "lost") parkRobot();
    },
    [parkRobot],
  );

  const running = phase === "running";
  const done = phase === "done";
  const locked = running || done;
  const progressPct = Math.round((robot.idx / (track.length - 1)) * 100);

  // Does the current wiring match the round's flawless rule? (UI hint only.)
  const isIdeal = useMemo(() => {
    const ideal = idealRules(round);
    return (["left", "center", "right"] as Sensor[]).every(
      (s) => rules[s] === ideal[s],
    );
  }, [rules, round]);

  const status = useMemo(() => {
    if (done) return "All three robots solved! 🏆";
    if (phase === "won") return "Reached the GOAL! Next robot is harder… ▶";
    if (phase === "lost") return "Slid off the line — tweak a rule and retry.";
    if (phase === "running")
      return `Driving… reads ${SENSOR_LABEL[robot.sensor]} · ${progressPct}%`;
    return round.blurb;
  }, [done, phase, robot.sensor, progressPct, round.blurb]);

  const carColor =
    phase === "won" || done
      ? ACCENT
      : phase === "lost"
        ? "#f87171"
        : "#67e8f9";

  const goalRing =
    phase === "won" || done
      ? `0 0 0 1px ${ACCENT}, 0 0 24px -4px ${ACCENT}`
      : undefined;

  return (
    <div className="flex w-full flex-col gap-3 text-ink">
      {/* ---------------- ROUND HEADER + PROGRESS DOTS ---------------- */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-ink">
          {round.label}
        </span>
        <span
          aria-hidden
          className="inline-flex items-center gap-1.5"
          title={`Round ${roundIdx + 1} of ${ROUNDS.length}`}
        >
          {ROUNDS.map((_, i) => {
            const solved = i < roundIdx || done;
            const current = i === roundIdx && !done;
            return (
              <span
                key={i}
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{
                  background: solved
                    ? ACCENT
                    : current
                      ? "rgba(52,211,153,0.3)"
                      : "rgba(120,140,170,0.18)",
                  border: `1.5px solid ${solved || current ? ACCENT : "rgba(120,140,170,0.4)"}`,
                  boxShadow: current ? `0 0 8px ${ACCENT}88` : undefined,
                }}
              />
            );
          })}
        </span>
      </div>

      {/* ---------------- CANVAS ---------------- */}
      <div
        className="panel relative overflow-hidden rounded-xl"
        style={{ boxShadow: goalRing, transition: "box-shadow .3s ease" }}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="block h-auto w-full"
          role="img"
          aria-label={`Line-following robot, ${round.label}`}
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
            d={trackD}
            fill="none"
            stroke={ACCENT}
            strokeOpacity={0.18}
            strokeWidth={14}
            strokeLinecap="round"
          />
          <path
            d={trackD}
            fill="none"
            stroke={ACCENT}
            strokeWidth={4}
            strokeLinecap="round"
          />

          {/* start marker */}
          <circle cx={track[0].x} cy={track[0].y} r={5} fill="#67e8f9" />
          {/* goal marker */}
          <circle
            cx={track[track.length - 1].x}
            cy={track[track.length - 1].y}
            r={16}
            fill="url(#lf-goal)"
          />
          <circle
            cx={track[track.length - 1].x}
            cy={track[track.length - 1].y}
            r={6}
            fill="none"
            stroke={ACCENT}
            strokeWidth={2}
          />
          <text
            x={track[track.length - 1].x}
            y={track[track.length - 1].y - 14}
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
            <circle cx={6} cy={0} r={2} fill="#05070d" />
          </g>
        </svg>

        {/* MIRROR badge so kids know the rule is twisted, not random */}
        {round.mirror && (
          <span
            className="pointer-events-none absolute right-2 top-2 rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-tech"
            style={{
              background: "rgba(248,113,113,0.16)",
              border: "1px solid #f87171",
              color: "#fca5a5",
            }}
          >
            🔄 Mirror cam
          </span>
        )}

        {/* status line overlaid in-canvas */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 px-3 py-1.5">
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
          {round.tag === "DEBUG"
            ? "Pre-wired rules — one is buggy. Fix it!"
            : round.mirror
              ? "Camera is flipped — set rules that still reach GOAL"
              : "If the sensor reads… → steer like this"}
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
                    disabled={locked}
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
          Runs: {runs}
          {isIdeal && !running && phase !== "won" && !done && (
            <span style={{ color: ACCENT }}> · looks tuned ✓</span>
          )}
        </span>
        <div className="flex gap-2">
          {phase === "won" ? (
            <button
              type="button"
              onClick={nextRound}
              className="rounded-lg px-4 py-2 text-sm font-semibold"
              style={{ background: ACCENT, color: "#05070d" }}
              aria-label="Go to the next robot"
            >
              Next robot ▶
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={parkRobot}
                disabled={locked}
                className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim disabled:opacity-50"
                aria-label="Reset the robot to the start"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleRun}
                disabled={locked}
                className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
                style={{ background: ACCENT, color: "#05070d" }}
                aria-label="Run the simulation"
              >
                {running ? "Running…" : "Run ▶"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
