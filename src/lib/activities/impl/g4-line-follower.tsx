"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Line Follower Robot — sensors + if-this-then-that steering rules   */
/*  LEARNING GOAL: a robot reads its two front IR eyes (Left & Right)  */
/*  and uses a 4-row truth table of if-this-then-that rules to steer   */
/*  itself around a looping line. Fill the table correctly and the     */
/*  car drives one full lap back to the start flag.                    */
/* ------------------------------------------------------------------ */

const ACCENT = "#34d399";
const VIEW_W = 300;
const VIEW_H = 220;

/** The two IR eyes each read the tape as black (over line) or white. */
type Eye = "white" | "black";
/** What the motors do for a given sensor reading. */
type Action = "straight" | "left" | "right" | "stop";
type Phase = "idle" | "running" | "won" | "lost";

/** A rule key encodes the Left+Right eye combination, e.g. "white-white". */
type RuleKey = `${Eye}-${Eye}`;

interface Combo {
  key: RuleKey;
  left: Eye;
  right: Eye;
  answer: Action;
  why: string;
}

/** The four sensor combinations + their one correct steering action. */
const COMBOS: readonly Combo[] = [
  {
    key: "white-white",
    left: "white",
    right: "white",
    answer: "straight",
    why: "Both eyes off the line → centred → GO STRAIGHT.",
  },
  {
    key: "black-white",
    left: "black",
    right: "white",
    answer: "left",
    why: "Line slid under the LEFT eye → TURN LEFT to recentre.",
  },
  {
    key: "white-black",
    left: "white",
    right: "black",
    answer: "right",
    why: "Line slid under the RIGHT eye → TURN RIGHT to recentre.",
  },
  {
    key: "black-black",
    left: "black",
    right: "black",
    answer: "stop",
    why: "Both eyes on black → a junction → STOP.",
  },
] as const;

const ACTIONS: { id: Action; label: string; glyph: string }[] = [
  { id: "straight", label: "Go Straight", glyph: "↑" },
  { id: "left", label: "Turn Left", glyph: "↰" },
  { id: "right", label: "Turn Right", glyph: "↱" },
  { id: "stop", label: "Stop", glyph: "■" },
];

const ACTION_LABEL: Record<Action, string> = {
  straight: "Go Straight",
  left: "Turn Left",
  right: "Turn Right",
  stop: "Stop",
};

const EYE_TEXT: Record<Eye, string> = { white: "white", black: "black" };

interface Pt {
  x: number;
  y: number;
}

/**
 * A fixed looping track sampled as a closed loop of waypoints. Each waypoint
 * carries the sensor reading the robot WOULD see there, so the sim is fully
 * deterministic: it reads the waypoint's combo, looks up the learner's chosen
 * action, and only the correct action keeps the car on the tape.
 */
interface Way extends Pt {
  combo: RuleKey;
}

const CX = VIEW_W / 2;
const CY = VIEW_H / 2;
const RX = 96;
const RY = 70;
const LAP_STEPS = 48;

/**
 * Build the loop. The base shape is an oval; we tag each waypoint with the
 * sensor reading a centred robot would get. Most of the loop is gentle curve
 * (one eye clips the tape → alternating left/right); the long top/bottom runs
 * read "both white" (straight); and a single marked junction reads "both
 * black" (stop). This guarantees every one of the four rules is exercised.
 */
const LOOP: readonly Way[] = Array.from({ length: LAP_STEPS }, (_, i) => {
  const a = (i / LAP_STEPS) * Math.PI * 2 - Math.PI / 2;
  const x = CX + Math.cos(a) * RX;
  const y = CY + Math.sin(a) * RY;
  // Which eye clips the tape depends on which side of the oval we're on.
  // The flat top/bottom runs read "both white" (drive straight).
  let combo: RuleKey;
  if (i === LAP_STEPS - 6) {
    combo = "black-black"; // the junction marker, just before the flag
  } else if (Math.cos(a) > 0.55) {
    combo = "white-black"; // right-hand bend → right eye on the line
  } else if (Math.cos(a) < -0.55) {
    combo = "black-white"; // left-hand bend → left eye on the line
  } else {
    combo = "white-white"; // a straight run — stay centred
  }
  return { x, y, combo };
});

const LOOP_D: string =
  LOOP.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(
    " ",
  ) + " Z";

const START: Pt = { x: LOOP[0].x, y: LOOP[0].y };

const EMPTY_RULES: Record<RuleKey, Action | null> = {
  "white-white": null,
  "black-white": null,
  "white-black": null,
  "black-black": null,
};

export default function G4LineFollower({ onComplete }: ActivityProps) {
  const [rules, setRules] = useState<Record<RuleKey, Action | null>>({
    ...EMPTY_RULES,
  });
  const [editing, setEditing] = useState<RuleKey>("white-white");
  const [phase, setPhase] = useState<Phase>("idle");
  const [carIdx, setCarIdx] = useState<number>(0);
  const [drift, setDrift] = useState<number>(0); // sideways wobble when lost
  const [toast, setToast] = useState<string>("");
  const [tries, setTries] = useState<number>(0);
  const [hintEyes, setHintEyes] = useState<boolean>(false);

  // Refs the run-loop reads so it never goes stale between frames.
  const rulesRef = useRef(rules);
  const phaseRef = useRef<Phase>("idle");
  const idxRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const doneRef = useRef<boolean>(false); // guards the single onComplete

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

  // How many of the four rules are correct (for the live check marks + ring).
  const correctCount = useMemo(
    () => COMBOS.reduce((n, c) => (rules[c.key] === c.answer ? n + 1 : n), 0),
    [rules],
  );
  const allCorrect = correctCount === COMBOS.length;

  const resetCar = useCallback(() => {
    clearTimer();
    idxRef.current = 0;
    setCarIdx(0);
    setDrift(0);
    setPhase("idle");
    phaseRef.current = "idle";
  }, [clearTimer]);

  const setRule = useCallback(
    (key: RuleKey, action: Action) => {
      setRules((prev) => ({ ...prev, [key]: action }));
      setEditing(key);
      if (phaseRef.current === "running") resetCar();
      if (phaseRef.current === "lost" || phaseRef.current === "won") {
        setToast("");
        resetCar();
      }
    },
    [resetCar],
  );

  const finishWin = useCallback(() => {
    clearTimer();
    setPhase("won");
    phaseRef.current = "won";
    setToast("");
    if (!doneRef.current) {
      doneRef.current = true;
      onComplete({
        passed: true,
        stars: 3,
        detail: "Full lap! Both eyes feeding the steering rules — clean driving.",
      });
    }
  }, [clearTimer, onComplete]);

  const finishLost = useCallback(
    (combo: RuleKey) => {
      clearTimer();
      setPhase("lost");
      phaseRef.current = "lost";
      const c = COMBOS.find((x) => x.key === combo);
      setToast(
        c ? `Lost the line at the curve! ${c.why}` : "Lost the line at the curve!",
      );
      setEditing(combo);
      onComplete({
        passed: false,
        detail: "The car drifted off the tape — fix that rule and run again.",
      });
    },
    [clearTimer, onComplete],
  );

  // One simulation tick: read the waypoint's combo, look up the learner's
  // action, and check it matches the correct steering for that reading.
  const tick = useCallback(() => {
    const i = idxRef.current;
    const here = LOOP[i];
    const combo = COMBOS.find((c) => c.key === here.combo);
    const chosen = rulesRef.current[here.combo];

    // Wrong (or unset) rule for this reading → the car drifts off the tape.
    if (!combo || chosen !== combo.answer) {
      setDrift(combo ? (combo.left === "black" ? -16 : 16) : 14);
      window.setTimeout(() => finishLost(here.combo), 60);
      return;
    }

    setDrift(0);
    const next = i + 1;
    if (next >= LOOP.length) {
      idxRef.current = LOOP.length - 1;
      setCarIdx(LOOP.length - 1);
      finishWin();
      return;
    }
    idxRef.current = next;
    setCarIdx(next);
    timerRef.current = window.setTimeout(tick, 130);
  }, [finishLost, finishWin]);

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
    setRules({ ...EMPTY_RULES });
    setEditing("white-white");
    setToast("");
    setTries(0);
    setHintEyes(false);
    doneRef.current = false;
    resetCar();
  }, [resetCar]);

  const running = phase === "running";
  const car = LOOP[carIdx] ?? LOOP[0];
  const lapPct = Math.round((carIdx / (LOOP.length - 1)) * 100);

  // Drift the car perpendicular to its heading when it loses the line.
  const prev = LOOP[Math.max(0, carIdx - 1)];
  const heading = Math.atan2(car.y - prev.y, car.x - prev.x);
  const carX = car.x + Math.cos(heading + Math.PI / 2) * drift;
  const carY = car.y + Math.sin(heading + Math.PI / 2) * drift;
  const carDeg = (heading * 180) / Math.PI;

  const editCombo = COMBOS.find((c) => c.key === editing) ?? COMBOS[0];

  const status: string = running
    ? `Driving… ${lapPct}% of the lap`
    : phase === "won"
      ? "Lap complete! The robot followed the line all the way home."
      : phase === "lost"
        ? "Drifted off — adjust the highlighted rule and run again."
        : allCorrect
          ? "All four rules set — press Run to drive the lap!"
          : `Fill the truth table (${correctCount}/4 correct), then Run ▶`;

  // Ring geometry for the lap-progress dial.
  const R = 13;
  const CIRC = 2 * Math.PI * R;
  const ringPct = phase === "won" ? 1 : carIdx / (LOOP.length - 1);

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
      `}</style>

      {/* ---------------- TRACK CANVAS ---------------- */}
      <div
        className="relative overflow-hidden rounded-xl border border-line bg-[#0b1220] p-1"
        style={
          phase === "won"
            ? { boxShadow: `0 0 0 1px ${ACCENT}, 0 0 26px -4px ${ACCENT}` }
            : undefined
        }
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="block h-auto w-full"
          role="img"
          aria-label="Top-down view of a line-following robot car on a looping black-tape track"
        >
          {/* black tape track (glow + line) */}
          <path d={LOOP_D} fill="none" stroke="#000" strokeWidth={16} strokeLinejoin="round" />
          <path
            d={LOOP_D}
            fill="none"
            stroke="#1f2937"
            strokeWidth={16}
            strokeLinejoin="round"
            strokeOpacity={0.6}
          />
          {/* green trail of completed lap */}
          {carIdx > 0 && (
            <path
              d={
                LOOP.slice(0, carIdx + 1)
                  .map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`)
                  .join(" ")
              }
              fill="none"
              stroke={ACCENT}
              strokeWidth={4}
              strokeLinecap="round"
              strokeOpacity={phase === "lost" ? 0.3 : 0.85}
            />
          )}

          {/* junction marker (both eyes black) */}
          {LOOP.map((p, i) =>
            p.combo === "black-black" ? (
              <rect
                key={`j${i}`}
                x={p.x - 7}
                y={p.y - 7}
                width={14}
                height={14}
                rx={2}
                fill="#000"
                stroke="#374151"
                strokeWidth={1}
              />
            ) : null,
          )}

          {/* start / finish flag */}
          <g transform={`translate(${START.x} ${START.y})`}>
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
              fill={editCombo.left === "black" && hintEyes ? "#fbbf24" : "#fff"}
              stroke="#05070d"
              strokeWidth={0.6}
            />
            <circle
              cx={7}
              cy={3.5}
              r={2.1}
              fill={editCombo.right === "black" && hintEyes ? "#fbbf24" : "#fff"}
              stroke="#05070d"
              strokeWidth={0.6}
            />
          </g>

          {/* deterministic confetti burst on win */}
          {phase === "won" &&
            Array.from({ length: 14 }, (_, k) => {
              const ang = (k / 14) * Math.PI * 2;
              const dist = 22 + (k % 3) * 8;
              const col = [ACCENT, "#67e8f9", "#fbbf24", "#f472b6"][k % 4];
              return (
                <circle
                  key={`c${k}`}
                  cx={START.x + Math.cos(ang) * dist}
                  cy={START.y + Math.sin(ang) * dist}
                  r={2.6}
                  fill={col}
                  style={{
                    transformOrigin: `${START.x}px ${START.y}px`,
                    animation: `g4linefollower-pop .9s ease-out ${(k % 5) * 0.05}s both`,
                  }}
                />
              );
            })}
        </svg>

        {/* lost toast */}
        {phase === "lost" && toast && (
          <div
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
            return (
              <span key={side} className="flex flex-col items-center gap-0.5">
                <span
                  className="inline-block h-5 w-5 rounded-full border-2"
                  style={{
                    background: eye === "black" ? "#000" : "#fff",
                    borderColor: eye === "black" ? "#374151" : ACCENT,
                    boxShadow: eye === "white" ? `0 0 6px ${ACCENT}` : "none",
                  }}
                  aria-label={`${side} eye reads ${EYE_TEXT[eye]}`}
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
          {hintEyes ? "Hide eyes" : "Show the matching eyes"}
        </button>
      </div>

      {/* ---------------- TRUTH TABLE ---------------- */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] uppercase tracking-tech text-ink-faint">
          IF the eyes read… → THEN the motors…
        </p>
        {COMBOS.map((c) => {
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
              className="flex flex-col gap-1.5 rounded-lg bg-panel/60 p-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="flex items-center gap-2 text-xs">
                {/* per-rule check mark */}
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
            aria-label="Reset the truth table and the car"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
            style={{ background: ACCENT, color: "#05070d" }}
            aria-label="Run the robot around the track"
          >
            {running ? "Running…" : "Run ▶"}
          </button>
        </div>
      </div>

      {/* win celebration */}
      {phase === "won" && (
        <div
          className="rounded-xl border px-3 py-2 text-center text-sm font-semibold"
          style={{ borderColor: ACCENT, color: ACCENT }}
          role="status"
        >
          ✨🎉 Full lap! ⭐⭐⭐
          <span className="mt-0.5 block text-[11px] font-normal text-ink-dim">
            Both eyes fed your if-this-then-that rules and the robot drove itself home.
          </span>
        </div>
      )}
    </div>
  );
}
