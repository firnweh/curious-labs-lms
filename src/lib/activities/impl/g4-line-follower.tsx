"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Line Follower Robot — sensors + if-this-then-that steering rules   */
/*  CLASS 4-6 (explorer). A robot reads its two front IR eyes (Left &  */
/*  Right) and uses a 4-row truth table of if-this-then-that rules to  */
/*  steer itself around a looping line. But there are THREE escalating */
/*  courses, and the rules are NOT the same every time:               */
/*    R1 — DARK course: a black tape line on a pale floor (classic).  */
/*    R2 — the TWIST: a glowing WHITE line on a dark floor. The eyes  */
/*         now read the OPPOSITE — every rule must be re-thought, so   */
/*         brute-forcing Round 1's answers crashes the car.            */
/*    R3 — DEBUG: the robot ships with a steering table that is almost */
/*         right but has TWO swapped rules. Find and fix the bug.      */
/*  Each course is fully deterministic: every waypoint carries the     */
/*  reading a centred robot sees there, so only the correct steering   */
/*  action keeps the car on the tape.                                  */
/* ------------------------------------------------------------------ */

const ACCENT = "#34d399";
const VIEW_W = 300;
const VIEW_H = 220;

/** The two IR eyes each read the surface as bright or dark. */
type Eye = "white" | "black";
/** What the motors do for a given sensor reading. */
type Action = "straight" | "left" | "right" | "stop";
type Phase = "idle" | "running" | "won" | "lost";

/** A rule key encodes the Left+Right eye combination, e.g. "white-white". */
type RuleKey = `${Eye}-${Eye}`;

const ALL_KEYS: readonly RuleKey[] = [
  "white-white",
  "black-white",
  "white-black",
  "black-black",
];

interface Combo {
  key: RuleKey;
  left: Eye;
  right: Eye;
  answer: Action;
  why: string;
}

/**
 * Each course defines the SAME four sensor combinations but its OWN correct
 * steering action, because the line itself is different (dark tape vs. a
 * glowing white line). This is the guess-defeater: Round 1's table is wrong
 * for Round 2, so a child must actually reason about what the eyes mean.
 */
interface Course {
  id: number;
  name: string;
  /** Floor + line colours (for the SVG). */
  floor: string;
  line: string;
  lineGlow: string;
  /** "dark" = black tape on pale floor; "bright" = white line on dark floor. */
  mode: "dark" | "bright";
  combos: readonly Combo[];
  /** A pre-filled starting table. null entries = blank for the learner. */
  preset: Record<RuleKey, Action | null>;
  intro: string;
}

const EMPTY_TABLE: Record<RuleKey, Action | null> = {
  "white-white": null,
  "black-white": null,
  "white-black": null,
  "black-black": null,
};

// ── COURSE 1 — DARK course: black tape line on a pale floor (classic) ──────────
// An eye reads "black" when it is sitting ON the tape. Steer toward the eye
// that's on the line so the car swings back to centre.
const COURSE1_COMBOS: readonly Combo[] = [
  {
    key: "white-white",
    left: "white",
    right: "white",
    answer: "straight",
    why: "Both eyes off the dark tape → centred → GO STRAIGHT.",
  },
  {
    key: "black-white",
    left: "black",
    right: "white",
    answer: "left",
    why: "Dark tape slid under the LEFT eye → TURN LEFT to chase it.",
  },
  {
    key: "white-black",
    left: "white",
    right: "black",
    answer: "right",
    why: "Dark tape slid under the RIGHT eye → TURN RIGHT to chase it.",
  },
  {
    key: "black-black",
    left: "black",
    right: "black",
    answer: "stop",
    why: "Both eyes on dark tape → a junction → STOP.",
  },
];

// ── COURSE 2 — BRIGHT course: a glowing WHITE line on a DARK floor ─────────────
// Everything flips. Now an eye reads "white" when it is ON the line, and
// "black" when it is over the dark floor. Steer toward the WHITE eye.
const COURSE2_COMBOS: readonly Combo[] = [
  {
    key: "black-black",
    left: "black",
    right: "black",
    answer: "straight",
    why: "Both eyes off the bright line, over dark floor → centred → GO STRAIGHT.",
  },
  {
    key: "white-black",
    left: "white",
    right: "black",
    answer: "left",
    why: "Bright line slid under the LEFT eye → TURN LEFT to chase it.",
  },
  {
    key: "black-white",
    left: "black",
    right: "white",
    answer: "right",
    why: "Bright line slid under the RIGHT eye → TURN RIGHT to chase it.",
  },
  {
    key: "white-white",
    left: "white",
    right: "white",
    answer: "stop",
    why: "Both eyes glowing white → a junction on the bright line → STOP.",
  },
];

// ── COURSE 3 — DEBUG: dark tape again, but the shipped table has two bugs ──────
// Same correct answers as Course 1 (dark line), but the robot boots with the
// two TURN rules swapped. The learner must spot which rows are wrong and fix
// them — the other two rows are already correct and should be left alone.
const COURSE3_COMBOS: readonly Combo[] = COURSE1_COMBOS.map((c) => ({
  ...c,
  why: c.why.replace("→", "(debug) →"),
}));
const COURSE3_PRESET: Record<RuleKey, Action | null> = {
  "white-white": "straight", // correct, leave it
  "black-white": "right", // BUG: should be left
  "white-black": "left", // BUG: should be right
  "black-black": "stop", // correct, leave it
};

const ACTIONS: { id: Action; label: string; glyph: string }[] = [
  { id: "straight", label: "Go Straight", glyph: "↑" },
  { id: "left", label: "Turn Left", glyph: "↰" },
  { id: "right", label: "Turn Right", glyph: "↱" },
  { id: "stop", label: "Stop", glyph: "■" },
];

const EYE_TEXT: Record<Eye, string> = { white: "white", black: "black" };

interface Pt {
  x: number;
  y: number;
}

/** A loop waypoint carries the reading a centred robot sees there. */
interface Way extends Pt {
  combo: RuleKey;
}

const CX = VIEW_W / 2;
const CY = VIEW_H / 2;
const LAP_STEPS = 48;

/**
 * Build a loop of waypoints around an oval and tag each with the reading a
 * centred robot gets. `junctionAt` marks the single "both on the line"
 * junction. The two flank readings ("one eye on the line") are supplied so
 * Course 2 can carry the FLIPPED labels (white-white as a junction, etc.)
 * while drawing the same oval shape — the geometry never changes, only the
 * meaning of the readings does. Fully deterministic.
 */
function buildLoop(opts: {
  rx: number;
  ry: number;
  bothOff: RuleKey; // reading on a straight run (no eye on the line)
  leftBend: RuleKey; // reading on a left-hand bend (left eye on the line)
  rightBend: RuleKey; // reading on a right-hand bend (right eye on the line)
  junction: RuleKey; // reading at the marked junction
}): readonly Way[] {
  const { rx, ry, bothOff, leftBend, rightBend, junction } = opts;
  return Array.from({ length: LAP_STEPS }, (_, i) => {
    const a = (i / LAP_STEPS) * Math.PI * 2 - Math.PI / 2;
    const x = CX + Math.cos(a) * rx;
    const y = CY + Math.sin(a) * ry;
    let combo: RuleKey;
    if (i === LAP_STEPS - 6) {
      combo = junction;
    } else if (Math.cos(a) > 0.55) {
      combo = rightBend;
    } else if (Math.cos(a) < -0.55) {
      combo = leftBend;
    } else {
      combo = bothOff;
    }
    return { x, y, combo };
  });
}

// Course 1 & 3 share the dark-line readings. Course 2 uses the flipped set.
const LOOP_DARK = buildLoop({
  rx: 96,
  ry: 70,
  bothOff: "white-white",
  leftBend: "black-white",
  rightBend: "white-black",
  junction: "black-black",
});
const LOOP_BRIGHT = buildLoop({
  rx: 96,
  ry: 70,
  bothOff: "black-black",
  leftBend: "white-black",
  rightBend: "black-white",
  junction: "white-white",
});

const COURSES: readonly Course[] = [
  {
    id: 0,
    name: "Dark Track",
    floor: "#0b1220",
    line: "#000",
    lineGlow: "#1f2937",
    mode: "dark",
    combos: COURSE1_COMBOS,
    preset: { ...EMPTY_TABLE },
    intro: "Black tape line. An eye reads BLACK when it sits on the tape.",
  },
  {
    id: 1,
    name: "Glow Track",
    floor: "#05070d",
    line: "#e8fff6",
    lineGlow: ACCENT,
    mode: "bright",
    combos: COURSE2_COMBOS,
    preset: { ...EMPTY_TABLE },
    intro: "TWIST! A glowing WHITE line on a dark floor — the eyes read the opposite. Re-think every rule.",
  },
  {
    id: 2,
    name: "Debug Track",
    floor: "#0b1220",
    line: "#000",
    lineGlow: "#1f2937",
    mode: "dark",
    combos: COURSE3_COMBOS,
    preset: { ...COURSE3_PRESET },
    intro: "DEBUG! This robot's table is almost right but TWO rules are swapped. Spot the bugs and fix them.",
  },
];

const loopFor = (mode: Course["mode"]): readonly Way[] =>
  mode === "bright" ? LOOP_BRIGHT : LOOP_DARK;

const loopPath = (loop: readonly Way[]): string =>
  loop
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ") + " Z";

export default function G4LineFollower({ onComplete }: ActivityProps) {
  const [courseIdx, setCourseIdx] = useState<number>(0);
  const course = COURSES[courseIdx];
  const loop = useMemo(() => loopFor(course.mode), [course.mode]);
  const loopD = useMemo(() => loopPath(loop), [loop]);
  const start = loop[0];

  const [rules, setRules] = useState<Record<RuleKey, Action | null>>({
    ...course.preset,
  });
  const [editing, setEditing] = useState<RuleKey>(ALL_KEYS[0]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [carIdx, setCarIdx] = useState<number>(0);
  const [drift, setDrift] = useState<number>(0);
  const [toast, setToast] = useState<string>("");
  const [tries, setTries] = useState<number>(0);
  const [hintEyes, setHintEyes] = useState<boolean>(false);
  // Tracks whether each course was solved without ever drifting off (for stars).
  const [cleanRuns, setCleanRuns] = useState<boolean[]>([false, false, false]);
  const triedThisCourseRef = useRef<boolean>(false);

  const rulesRef = useRef(rules);
  const phaseRef = useRef<Phase>("idle");
  const idxRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const reportedRef = useRef<boolean>(false);

  useEffect(() => {
    rulesRef.current = rules;
  }, [rules]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const correctCount = useMemo(
    () => course.combos.reduce((n, c) => (rules[c.key] === c.answer ? n + 1 : n), 0),
    [rules, course],
  );
  const allCorrect = correctCount === course.combos.length;

  const resetCar = useCallback(() => {
    clearTimer();
    idxRef.current = 0;
    setCarIdx(0);
    setDrift(0);
    setPhase("idle");
    phaseRef.current = "idle";
  }, [clearTimer]);

  // Load a course's preset table and park the car when the course changes.
  useEffect(() => {
    clearTimer();
    setRules({ ...COURSES[courseIdx].preset });
    setEditing(ALL_KEYS[0]);
    setToast("");
    setHintEyes(false);
    triedThisCourseRef.current = false;
    idxRef.current = 0;
    setCarIdx(0);
    setDrift(0);
    setPhase("idle");
    phaseRef.current = "idle";
  }, [courseIdx, clearTimer]);

  const setRule = useCallback(
    (key: RuleKey, action: Action) => {
      setRules((prev) => ({ ...prev, [key]: action }));
      setEditing(key);
      if (
        phaseRef.current === "running" ||
        phaseRef.current === "lost" ||
        phaseRef.current === "won"
      ) {
        setToast("");
        resetCar();
      }
    },
    [resetCar],
  );

  const advanceOrFinish = useCallback(() => {
    clearTimer();
    setPhase("won");
    phaseRef.current = "won";
    setToast("");

    const clean = !triedThisCourseRef.current;
    setCleanRuns((prev) => {
      const next = [...prev];
      next[courseIdx] = clean;
      return next;
    });

    if (courseIdx < COURSES.length - 1) {
      // Win this course, then slide the next, harder one in.
      timerRef.current = window.setTimeout(
        () => setCourseIdx((c) => c + 1),
        1300,
      );
      return;
    }

    // Final course solved → report once. Three stars only if EVERY course was
    // solved on the first run with no drift (a true clean sweep). Otherwise 2.
    if (!reportedRef.current) {
      reportedRef.current = true;
      const allClean =
        cleanRuns[0] && cleanRuns[1] && clean; // courses 0,1 stored; 2 = `clean`
      onComplete({
        passed: true,
        stars: allClean ? 3 : 2,
        detail: allClean
          ? "Clean sweep! All three courses — dark, glow, and debug — driven perfectly first try."
          : "All three courses complete! Some took a few tries — solid debugging.",
      });
    }
  }, [clearTimer, courseIdx, cleanRuns, onComplete]);

  const finishLost = useCallback(
    (combo: RuleKey) => {
      clearTimer();
      setPhase("lost");
      phaseRef.current = "lost";
      triedThisCourseRef.current = true;
      const c = course.combos.find((x) => x.key === combo);
      setToast(c ? `Drifted off! ${c.why}` : "Drifted off the line!");
      setEditing(combo);
      // No onComplete on misses — gentle retry, the lab stays winnable.
    },
    [clearTimer, course],
  );

  const tick = useCallback(() => {
    const i = idxRef.current;
    const here = loop[i];
    const combo = course.combos.find((c) => c.key === here.combo);
    const chosen = rulesRef.current[here.combo];

    if (!combo || chosen !== combo.answer) {
      setDrift(combo ? (combo.left === "black" ? -16 : 16) : 14);
      window.setTimeout(() => finishLost(here.combo), 60);
      return;
    }

    setDrift(0);
    const next = i + 1;
    if (next >= loop.length) {
      idxRef.current = loop.length - 1;
      setCarIdx(loop.length - 1);
      advanceOrFinish();
      return;
    }
    idxRef.current = next;
    setCarIdx(next);
    timerRef.current = window.setTimeout(tick, 130);
  }, [finishLost, advanceOrFinish, loop, course]);

  const handleRun = useCallback(() => {
    clearTimer();
    idxRef.current = 0;
    setCarIdx(0);
    setDrift(0);
    setToast("");
    setTries((t) => t + 1);
    setPhase("running");
    phaseRef.current = "running";
    timerRef.current = window.setTimeout(tick, 200);
  }, [clearTimer, tick]);

  const handleReset = useCallback(() => {
    clearTimer();
    reportedRef.current = false;
    setCleanRuns([false, false, false]);
    setTries(0);
    setCourseIdx(0);
    // The courseIdx effect re-loads the preset, but force it for idx 0 too.
    setRules({ ...COURSES[0].preset });
    setEditing(ALL_KEYS[0]);
    setToast("");
    setHintEyes(false);
    triedThisCourseRef.current = false;
    idxRef.current = 0;
    setCarIdx(0);
    setDrift(0);
    setPhase("idle");
    phaseRef.current = "idle";
  }, [clearTimer]);

  const running = phase === "running";
  const car = loop[carIdx] ?? loop[0];
  const lapPct = Math.round((carIdx / (loop.length - 1)) * 100);

  const prev = loop[Math.max(0, carIdx - 1)];
  const heading = Math.atan2(car.y - prev.y, car.x - prev.x);
  const carX = car.x + Math.cos(heading + Math.PI / 2) * drift;
  const carY = car.y + Math.sin(heading + Math.PI / 2) * drift;
  const carDeg = (heading * 180) / Math.PI;

  const editCombo =
    course.combos.find((c) => c.key === editing) ?? course.combos[0];
  const isFinalWin = phase === "won" && courseIdx === COURSES.length - 1;

  const status: string = running
    ? `Driving… ${lapPct}% of the lap`
    : phase === "won"
      ? isFinalWin
        ? "All three courses cleared! The robot drives itself home."
        : `Course ${courseIdx + 1} cleared — next track loading…`
      : phase === "lost"
        ? "Drifted off — adjust the highlighted rule and run again."
        : allCorrect
          ? "All four rules set — press Run to drive the lap!"
          : `${course.intro} (${correctCount}/4 correct)`;

  // Eye colours depend on the course's surface (bright line vs dark tape).
  const eyeFill = (eye: Eye, on: boolean): string => {
    if (course.mode === "bright") {
      // white eye = on the bright line; black eye = over dark floor
      if (on) return eye === "white" ? "#fff7" : "#fbbf24";
      return eye === "white" ? "#fff" : "#222a38";
    }
    if (on) return eye === "black" ? "#fbbf24" : "#fff";
    return eye === "black" ? "#000" : "#fff";
  };

  const R = 13;
  const CIRC = 2 * Math.PI * R;
  const ringPct = phase === "won" ? 1 : carIdx / (loop.length - 1);

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink">
      <style>{`
        @keyframes g4linefollower-pulse {
          0%,100% { opacity: .55; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.18); }
        }
        @keyframes g4linefollower-wobble {
          0% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(-2px) rotate(-6deg); }
          75% { transform: translateX(2px) rotate(6deg); }
          100% { transform: translateX(0) rotate(0deg); }
        }
        @keyframes g4linefollower-pop {
          0% { transform: scale(0); opacity: 1; }
          70% { opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes g4linefollower-rise {
          0% { transform: translateY(0); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(-26px); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-g4lf-anim] { animation: none !important; }
        }
      `}</style>

      {/* ---------------- COURSE PROGRESS ---------------- */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-tech text-ink-faint">
          Course {courseIdx + 1} / 3 · {course.name}
        </span>
        <span className="inline-flex items-center gap-1.5" aria-hidden>
          {COURSES.map((c, i) => {
            const solved = i < courseIdx || (i === courseIdx && phase === "won");
            const current = i === courseIdx && phase !== "won";
            return (
              <span
                key={c.id}
                className="grid h-3.5 w-3.5 place-items-center rounded-full"
                style={{
                  background: solved
                    ? ACCENT
                    : current
                      ? "rgba(52,211,153,0.25)"
                      : "rgba(255,255,255,0.06)",
                  border: `2px solid ${solved || current ? ACCENT : "rgba(120,140,170,0.35)"}`,
                }}
              />
            );
          })}
        </span>
      </div>

      {/* ---------------- TRACK CANVAS ---------------- */}
      <div
        className="relative overflow-hidden rounded-xl border border-line p-1"
        style={{
          background: course.floor,
          ...(phase === "won"
            ? { boxShadow: `0 0 0 1px ${ACCENT}, 0 0 26px -4px ${ACCENT}` }
            : {}),
        }}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="block h-auto w-full"
          role="img"
          aria-label={`Top-down view of a line-following robot car on the ${course.name} looping track`}
        >
          {/* the line track (glow + line) */}
          {course.mode === "bright" ? (
            <>
              <path
                d={loopD}
                fill="none"
                stroke={course.lineGlow}
                strokeWidth={18}
                strokeLinejoin="round"
                strokeOpacity={0.35}
              />
              <path
                d={loopD}
                fill="none"
                stroke={course.line}
                strokeWidth={6}
                strokeLinejoin="round"
              />
            </>
          ) : (
            <>
              <path d={loopD} fill="none" stroke={course.line} strokeWidth={16} strokeLinejoin="round" />
              <path
                d={loopD}
                fill="none"
                stroke={course.lineGlow}
                strokeWidth={16}
                strokeLinejoin="round"
                strokeOpacity={0.6}
              />
            </>
          )}

          {/* green trail of completed lap */}
          {carIdx > 0 && (
            <path
              d={loop
                .slice(0, carIdx + 1)
                .map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`)
                .join(" ")}
              fill="none"
              stroke={ACCENT}
              strokeWidth={4}
              strokeLinecap="round"
              strokeOpacity={phase === "lost" ? 0.3 : 0.85}
            />
          )}

          {/* junction marker */}
          {loop.map((p, i) => {
            const c = course.combos.find((cc) => cc.key === p.combo);
            if (!c || c.answer !== "stop") return null;
            return (
              <rect
                key={`j${i}`}
                x={p.x - 7}
                y={p.y - 7}
                width={14}
                height={14}
                rx={2}
                fill={course.mode === "bright" ? course.line : "#000"}
                stroke={course.mode === "bright" ? "#e8fff6" : "#374151"}
                strokeWidth={1}
              />
            );
          })}

          {/* start / finish flag */}
          <g transform={`translate(${start.x} ${start.y})`}>
            <circle r={9} fill="url(#g4lf-flag)" />
            <text x={0} y={-12} fill={ACCENT} fontSize={9} textAnchor="middle">
              🏁
            </text>
          </g>
          <defs>
            <radialGradient id="g4lf-flag" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.7" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* the robot car (top-down) */}
          <g
            data-g4lf-anim={phase === "lost" ? "" : undefined}
            transform={`translate(${carX} ${carY}) rotate(${carDeg})`}
            style={
              phase === "lost"
                ? { animation: "g4linefollower-wobble .35s ease-in-out 2" }
                : undefined
            }
          >
            <rect
              x={-9}
              y={-7}
              width={18}
              height={14}
              rx={3}
              fill={phase === "lost" ? "#f87171" : phase === "won" ? ACCENT : "#67e8f9"}
              stroke="#05070d"
              strokeWidth={1.2}
            />
            {/* two IR eyes under the nose */}
            <circle
              cx={7}
              cy={-3.5}
              r={2.1}
              fill={eyeFill(editCombo.left, hintEyes)}
              stroke="#05070d"
              strokeWidth={0.6}
            />
            <circle
              cx={7}
              cy={3.5}
              r={2.1}
              fill={eyeFill(editCombo.right, hintEyes)}
              stroke="#05070d"
              strokeWidth={0.6}
            />
          </g>

          {/* deterministic confetti burst on a win */}
          {phase === "won" &&
            Array.from({ length: 14 }, (_, k) => {
              const ang = (k / 14) * Math.PI * 2;
              const dist = 22 + (k % 3) * 8;
              const col = [ACCENT, "#67e8f9", "#fbbf24", "#f472b6"][k % 4];
              return (
                <circle
                  key={`c${k}`}
                  data-g4lf-anim=""
                  cx={start.x + Math.cos(ang) * dist}
                  cy={start.y + Math.sin(ang) * dist}
                  r={2.6}
                  fill={col}
                  style={{
                    transformOrigin: `${start.x}px ${start.y}px`,
                    animation: `g4linefollower-pop .9s ease-out ${(k % 5) * 0.05}s both`,
                  }}
                />
              );
            })}
        </svg>

        {/* lost toast */}
        {phase === "lost" && toast && (
          <div
            data-g4lf-anim=""
            className="pointer-events-none absolute inset-x-2 top-2 rounded-md bg-[#f87171] px-2 py-1 text-center text-[11px] font-semibold text-[#05070d]"
            style={{ animation: "g4linefollower-rise 2.4s ease-out forwards" }}
            role="alert"
          >
            {toast}
          </div>
        )}

        {/* lap-progress ring + status, overlaid */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 px-2 py-1.5">
          <span className="text-[11px] text-ink-dim">{status}</span>
          <svg width={32} height={32} viewBox="0 0 32 32" aria-hidden>
            <circle cx={16} cy={16} r={R} fill="none" stroke="#1f2937" strokeWidth={3} />
            <circle
              cx={16}
              cy={16}
              r={R}
              fill="none"
              stroke={ACCENT}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - ringPct)}
              transform="rotate(-90 16 16)"
              style={{ transition: "stroke-dashoffset .12s linear" }}
            />
          </svg>
        </div>
      </div>

      {/* live status for screen readers */}
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>

      {/* ---------------- LIVE PREVIEW of the rule being edited ---------------- */}
      <div
        className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panel/60 p-2"
        aria-label="Sensor preview for the rule you are editing"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-tech text-ink-faint">
            Eyes see
          </span>
          {(["left", "right"] as const).map((side) => {
            const eye: Eye = side === "left" ? editCombo.left : editCombo.right;
            const bright = course.mode === "bright";
            const onLine = bright ? eye === "white" : eye === "black";
            return (
              <span key={side} className="flex flex-col items-center gap-0.5">
                <span
                  className="inline-block h-5 w-5 rounded-full border-2"
                  style={{
                    background: eye === "black" ? "#000" : "#fff",
                    borderColor: onLine ? ACCENT : "#374151",
                    boxShadow: onLine ? `0 0 6px ${ACCENT}` : "none",
                  }}
                  aria-label={`${side} eye reads ${EYE_TEXT[eye]}${onLine ? ", on the line" : ""}`}
                />
                <span className="text-[9px] text-ink-faint">
                  {side === "left" ? "L" : "R"}: {EYE_TEXT[eye]}
                </span>
              </span>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setHintEyes((v) => !v)}
          aria-pressed={hintEyes}
          className="rounded-md border border-line px-2 py-1 text-[11px] text-ink-dim"
        >
          {hintEyes ? "Hide hint" : "Where's the line?"}
        </button>
      </div>

      {/* ---------------- TRUTH TABLE ---------------- */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] uppercase tracking-tech text-ink-faint">
          IF the eyes read… → THEN the motors…
        </p>
        {course.combos.map((c) => {
          const chosen = rules[c.key];
          const ok = chosen === c.answer;
          const isEditing = editing === c.key;
          return (
            <div
              key={c.key}
              onPointerDown={() => setEditing(c.key)}
              style={{
                touchAction: "manipulation",
                borderColor: isEditing ? ACCENT : "var(--color-line, #1f2937)",
              }}
              className="flex flex-col gap-1.5 rounded-lg border bg-panel/60 p-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="flex items-center gap-2 text-xs">
                <span
                  aria-hidden
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px]"
                  style={{
                    background: ok ? ACCENT : "#1f2937",
                    color: "#05070d",
                  }}
                >
                  {ok ? "✓" : ""}
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className="inline-block h-3 w-3 rounded-full border"
                    style={{
                      background: c.left === "black" ? "#000" : "#fff",
                      borderColor: "#374151",
                    }}
                    aria-hidden
                  />
                  <span
                    className="inline-block h-3 w-3 rounded-full border"
                    style={{
                      background: c.right === "black" ? "#000" : "#fff",
                      borderColor: "#374151",
                    }}
                    aria-hidden
                  />
                  <span className="text-ink-dim">
                    L:{EYE_TEXT[c.left]} R:{EYE_TEXT[c.right]}
                  </span>
                </span>
              </span>
              <div
                className="flex flex-wrap gap-1"
                role="group"
                aria-label={`Motor action when left eye is ${EYE_TEXT[c.left]} and right eye is ${EYE_TEXT[c.right]}`}
              >
                {ACTIONS.map((a) => {
                  const active = chosen === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onPointerDown={() => setRule(c.key, a.id)}
                      style={
                        active
                          ? { background: ACCENT, color: "#05070d", touchAction: "manipulation" }
                          : { color: "var(--color-ink-dim, #9aa6b2)", touchAction: "manipulation" }
                      }
                      aria-pressed={active}
                      aria-label={`Left ${EYE_TEXT[c.left]}, right ${EYE_TEXT[c.right]}: ${a.label}`}
                      title={a.label}
                      className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[11px] font-medium transition"
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
          );
        })}
      </div>

      {/* ---------------- CONTROLS ---------------- */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink-faint" aria-live="polite">
          {correctCount}/4 rules ✓ · Tries: {tries}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
            aria-label="Start over from course one"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleRun}
            disabled={running || phase === "won"}
            className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
            style={{ background: ACCENT, color: "#05070d" }}
            aria-label="Run the robot around the track"
          >
            {running ? "Running…" : "Run ▶"}
          </button>
        </div>
      </div>

      {/* win celebration (final only) */}
      {isFinalWin && (
        <div
          className="rounded-xl border px-3 py-2 text-center text-sm font-semibold"
          style={{ borderColor: ACCENT, color: ACCENT }}
          role="status"
        >
          ✨🎉 All three courses cleared! ⭐⭐⭐
          <span className="mt-0.5 block text-[11px] font-normal text-ink-dim">
            Dark track, glowing twist, and the buggy table — your if-this-then-that
            rules drove the robot home every time.
          </span>
        </div>
      )}
    </div>
  );
}
