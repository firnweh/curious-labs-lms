"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Turtle Art Functions — a function is a reusable drawing recipe,    */
/*  and calling it inside a loop with changing inputs paints a whole   */
/*  pattern from a few lines. Across THREE escalating rounds the       */
/*  learner must reason out turn = 360 / repeat so the ring closes,    */
/*  then dial in sides / size / grow to match the faded target.        */
/*  The feedback is per-dial (too small / too big / ✓), not one global */
/*  meter, so you can't just wiggle sliders up the slope — you have to */
/*  think. Fewer total runs across all rounds earns more stars.        */
/* ------------------------------------------------------------------ */

const ACCENT = "#22d3ee";
const VIEW = 260; // square SVG viewBox
const CX = VIEW / 2;
const CY = VIEW / 2;

/** Hue list the colour-cycle pulls from, one per repeat. */
const HUES: readonly string[] = [
  "#22d3ee",
  "#34d399",
  "#a3e635",
  "#fbbf24",
  "#fb923c",
  "#f87171",
  "#f472b6",
  "#c084fc",
  "#818cf8",
  "#60a5fa",
  "#2dd4bf",
  "#4ade80",
];

interface Dials {
  repeat: number;
  sides: number;
  size: number;
  grow: number;
  turn: number;
}

/**
 * Three escalating rounds. In every round the ring only closes when
 * turn === 360 / repeat — that's the reasoning the learner must do.
 * repeat / sides / size / grow change each round so a memorised answer
 * (or blind slider-wiggling) fails. All values are fixed + deterministic.
 */
interface Round {
  label: string;
  target: Dials; // turn here is always 360 / repeat
  prompt: string;
}

const ROUNDS: readonly Round[] = [
  {
    label: "Round 1 · Triangle ring",
    prompt: "8 triangles must meet in a closed ring. What turn closes 8 repeats?",
    target: { repeat: 8, sides: 3, size: 20, grow: 2, turn: 45 },
  },
  {
    label: "Round 2 · Square rosette",
    prompt: "10 growing squares this time. Work out the turn that closes 10 repeats.",
    target: { repeat: 10, sides: 4, size: 18, grow: 3, turn: 36 },
  },
  {
    label: "Round 3 · Pentagon bloom",
    prompt: "12 pentagons, fanning outward. Close 12 repeats, then match the bloom.",
    target: { repeat: 12, sides: 5, size: 16, grow: 3, turn: 30 },
  },
];

const DEFAULTS: Dials = { repeat: 6, sides: 3, size: 22, grow: 3, turn: 48 };

interface Dial {
  key: keyof Dials;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
}

const DIALS: readonly Dial[] = [
  { key: "repeat", label: "repeat", hint: "loop count", min: 3, max: 16, step: 1 },
  { key: "sides", label: "sides", hint: "shape", min: 3, max: 6, step: 1 },
  { key: "size", label: "size", hint: "start size", min: 12, max: 34, step: 2 },
  { key: "grow", label: "grow", hint: "+size / loop", min: 0, max: 6, step: 1 },
  { key: "turn", label: "turn", hint: "angle °", min: 10, max: 60, step: 1 },
];

interface Pt {
  x: number;
  y: number;
}

/**
 * draw_shape(sides, size) drawn as a regular polygon, then the whole
 * shape rotated by `rot` degrees about the canvas centre. The turtle
 * starts each shape offset from the centre so growing shapes fan out.
 */
function polygon(sides: number, size: number, rotDeg: number): Pt[] {
  const pts: Pt[] = [];
  const rot = (rotDeg * Math.PI) / 180;
  // Offset so the shape sits away from the hub — a rosette "petal".
  const reach = 8;
  for (let i = 0; i <= sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const lx = reach + size * Math.cos(a);
    const ly = size * Math.sin(a);
    // rotate the local point by rot about the centre
    const x = CX + lx * Math.cos(rot) - ly * Math.sin(rot);
    const y = CY + lx * Math.sin(rot) + ly * Math.cos(rot);
    pts.push({ x, y });
  }
  return pts;
}

function toPath(pts: Pt[]): string {
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}

/** All shapes a given dial setting produces — the full looped program. */
function buildShapes(d: Dials): { path: string; hue: string }[] {
  const out: { path: string; hue: string }[] = [];
  for (let i = 0; i < d.repeat; i++) {
    const size = d.size + i * d.grow;
    const rot = i * d.turn;
    out.push({ path: toPath(polygon(d.sides, size, rot)), hue: HUES[i % HUES.length] });
  }
  return out;
}

/** Exact match: every dial must equal the round's target. */
function isSolved(d: Dials, t: Dials): boolean {
  return (
    d.repeat === t.repeat &&
    d.sides === t.sides &&
    d.size === t.size &&
    d.grow === t.grow &&
    d.turn === t.turn
  );
}

/** Per-dial verdict shown after a run — discrete, not a hill to climb. */
type Verdict = "low" | "high" | "ok";
function verdict(val: number, target: number): Verdict {
  if (val === target) return "ok";
  return val < target ? "low" : "high";
}

type Phase = "predict" | "tune" | "drawing" | "roundwon" | "won";

export default function TurtleArtFunctions({ onComplete }: ActivityProps) {
  const [round, setRound] = useState<number>(0);
  const [dials, setDials] = useState<Dials>({ ...DEFAULTS });
  const [phase, setPhase] = useState<Phase>("predict");
  const [drawn, setDrawn] = useState<number>(0); // shapes revealed so far
  const [runs, setRuns] = useState<number>(0); // total runs across all rounds
  // Predict-then-run: learner commits the turn angle before tuning.
  const [predict, setPredict] = useState<string>("");
  const [predictMsg, setPredictMsg] = useState<string>("");
  // Whether the learner has run at least once this round (feedback unlocks).
  const [ranThisRound, setRanThisRound] = useState<boolean>(false);
  const completedRef = useRef<boolean>(false);
  const timerRef = useRef<number | null>(null);

  const cur = ROUNDS[round];
  const target = cur.target;
  const closingTurn = useMemo(() => 360 / target.repeat, [target.repeat]);

  const shapes = useMemo(() => buildShapes(dials), [dials]);
  const targetShapes = useMemo(() => buildShapes(target), [target]);
  const solved = isSolved(dials, target);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  // Animate the turtle drawing one shape per tick during "drawing".
  useEffect(() => {
    if (phase !== "drawing") return;
    if (drawn >= shapes.length) {
      // Finished the program. Grade this round (locally; no onComplete spam).
      if (solved) {
        if (round >= ROUNDS.length - 1) {
          if (!completedRef.current) {
            completedRef.current = true;
            // Optimization: ideal is one clean run per round (3 runs total).
            // Few extra runs → 3★, some → 2★, lots of wiggling → 1★.
            const extra = Math.max(0, runs - ROUNDS.length);
            const stars: 1 | 2 | 3 = extra <= 2 ? 3 : extra <= 6 ? 2 : 1;
            setPhase("won");
            onComplete({
              passed: true,
              stars,
              detail:
                stars === 3
                  ? "All 3 rosettes closed with sharp reasoning — turn = 360 / repeat!"
                  : `All 3 rounds solved in ${runs} runs. Plan first, wiggle less, for full stars.`,
            });
            return;
          }
        } else {
          setPhase("roundwon");
          return;
        }
      }
      // Not solved — stay in tune, feedback panel now guides the learner.
      setPhase("tune");
      setRanThisRound(true);
      return;
    }
    timerRef.current = window.setTimeout(() => {
      setDrawn((n) => n + 1);
    }, 130);
    return clearTimer;
  }, [phase, drawn, shapes.length, solved, round, runs, onComplete, clearTimer]);

  const setDial = useCallback(
    (key: keyof Dials, value: number) => {
      if (phase === "drawing" || phase === "won") return;
      setDials((prev) => ({ ...prev, [key]: value }));
      if (phase === "roundwon") return;
      // Editing after a run clears the partial drawing but keeps feedback.
      if (phase !== "tune") setPhase("tune");
      setDrawn(0);
    },
    [phase],
  );

  const handlePredict = useCallback(() => {
    const guess = Number(predict);
    if (!Number.isFinite(guess) || predict.trim() === "") {
      setPredictMsg("Type a number first — degrees the turtle turns each loop.");
      return;
    }
    if (guess === closingTurn) {
      setPredictMsg("Yes! 360 ÷ repeat closes the ring. Now match the rest and Run.");
      // Pre-load repeat + the correct turn as a reward for correct reasoning.
      setDials((prev) => ({ ...prev, repeat: target.repeat, turn: closingTurn }));
      setPhase("tune");
    } else {
      setPredictMsg(
        `Not quite. A full circle is 360°. ${target.repeat} equal turns means 360 ÷ ${target.repeat}. Try again.`,
      );
    }
  }, [predict, closingTurn, target.repeat]);

  const handleSkipPredict = useCallback(() => {
    setPredictMsg("");
    setPhase("tune");
  }, []);

  const handleRun = useCallback(() => {
    if (phase === "drawing" || phase === "predict" || phase === "won") return;
    clearTimer();
    setDrawn(0);
    setRuns((t) => t + 1);
    setPhase("drawing");
  }, [phase, clearTimer]);

  const handleNextRound = useCallback(() => {
    clearTimer();
    const next = round + 1;
    setRound(next);
    setDials({ ...DEFAULTS });
    setDrawn(0);
    setPredict("");
    setPredictMsg("");
    setRanThisRound(false);
    setPhase("predict");
  }, [round, clearTimer]);

  const handleReset = useCallback(() => {
    if (phase === "won") return;
    clearTimer();
    setDials({ ...DEFAULTS });
    setDrawn(0);
    setRanThisRound(false);
    setPhase(predict !== "" && closingTurn === Number(predict) ? "tune" : "predict");
  }, [phase, clearTimer, predict, closingTurn]);

  const won = phase === "won";
  const roundWon = phase === "roundwon";
  const inTune = phase === "tune" || roundWon;
  const visible = won || roundWon ? shapes.length : drawn;

  // Show the faded target only once tuning has begun (after predict step),
  // so the puzzle stays about reasoning, not pure tracing.
  const showTarget = phase !== "predict";

  const status = useMemo(() => {
    if (won) return "All three rosettes closed! ✨";
    if (roundWon) return `${cur.label} solved — ring closed!`;
    if (phase === "drawing") return `Turtle drawing… shape ${visible} / ${shapes.length}`;
    if (phase === "predict") return cur.prompt;
    if (!ranThisRound) return "Set the dials to match the faded target, then Run ▶";
    if (solved) return "Looks matched — Run ▶ to confirm!";
    return "Check the dial hints below, adjust, and Run again ▶";
  }, [won, roundWon, phase, visible, shapes.length, cur, ranThisRound, solved]);

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink">
      <style>{`
        @keyframes g6turtleartfunctions-pop {
          0% { transform: scale(.6); opacity: 0; }
          70% { transform: scale(1.08); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g6turtleartfunctions-spark {
          0%, 100% { opacity: 0; transform: scale(.4); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes g6turtleartfunctions-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
      `}</style>

      {/* ---------------- ROUND TRACKER ---------------- */}
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-display" style={{ color: ACCENT }}>
          {cur.label}
        </span>
        <div className="flex items-center gap-1.5" aria-label={`Round ${round + 1} of ${ROUNDS.length}`}>
          {ROUNDS.map((_, i) => (
            <span
              key={`rt${i}`}
              aria-hidden
              className="h-2 w-2 rounded-full"
              style={{
                background: i < round || won ? "#34d399" : i === round ? ACCENT : "#1b2433",
              }}
            />
          ))}
        </div>
      </div>

      {/* ---------------- CANVAS ---------------- */}
      <div
        className="panel relative overflow-hidden rounded-xl p-2"
        style={
          won || roundWon
            ? { boxShadow: `0 0 0 1px ${ACCENT}, 0 0 26px -4px ${ACCENT}`, transition: "box-shadow .3s ease" }
            : { transition: "box-shadow .3s ease" }
        }
      >
        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="block aspect-square w-full"
          role="img"
          aria-label="Turtle drawing canvas with faded target rosette behind it"
        >
          {/* faint grid */}
          <g stroke="#1b2433" strokeWidth={0.5}>
            {Array.from({ length: 9 }, (_, i) => (
              <line key={`gv${i}`} x1={(i * VIEW) / 8} y1={0} x2={(i * VIEW) / 8} y2={VIEW} />
            ))}
            {Array.from({ length: 9 }, (_, i) => (
              <line key={`gh${i}`} x1={0} y1={(i * VIEW) / 8} x2={VIEW} y2={(i * VIEW) / 8} />
            ))}
          </g>

          {/* faded TARGET artwork behind everything */}
          <g
            opacity={won || roundWon || !showTarget ? 0 : 0.22}
            style={{ transition: "opacity .4s ease" }}
          >
            {targetShapes.map((s, i) => (
              <path
                key={`t${i}`}
                d={s.path}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth={1.4}
                strokeLinejoin="round"
              />
            ))}
          </g>

          {/* the learner's drawing, revealed shape by shape */}
          <g>
            {shapes.slice(0, visible).map((s, i) => (
              <path
                key={`s${i}`}
                d={s.path}
                fill="none"
                stroke={s.hue}
                strokeWidth={2}
                strokeLinejoin="round"
                style={{
                  transformOrigin: `${CX}px ${CY}px`,
                  animation: `g6turtleartfunctions-pop .28s ease both`,
                  filter: won || roundWon ? `drop-shadow(0 0 2px ${s.hue})` : undefined,
                }}
              />
            ))}
          </g>

          {/* the turtle, parked at the hub */}
          <g
            transform={`translate(${CX} ${CY})`}
            style={{ animation: phase === "drawing" ? "g6turtleartfunctions-bob .6s ease-in-out infinite" : undefined }}
          >
            <circle r={9} fill="#0b1220" stroke={ACCENT} strokeWidth={1} />
            <text x={0} y={3.5} fontSize={11} textAnchor="middle">
              🐢
            </text>
          </g>

          {/* win sparkles */}
          {(won || roundWon) &&
            Array.from({ length: 8 }, (_, i) => {
              const a = (i / 8) * Math.PI * 2;
              const r = 96;
              return (
                <text
                  key={`sp${i}`}
                  x={CX + Math.cos(a) * r}
                  y={CY + Math.sin(a) * r}
                  fontSize={14}
                  textAnchor="middle"
                  style={{
                    transformOrigin: `${CX + Math.cos(a) * r}px ${CY + Math.sin(a) * r}px`,
                    animation: `g6turtleartfunctions-spark 1s ease-in-out ${i * 0.08}s infinite`,
                  }}
                >
                  ✨
                </text>
              );
            })}
        </svg>

        {/* status line */}
        <div className="mt-1 px-1">
          <div
            className="text-xs"
            role="status"
            aria-live="polite"
          >
            <span
              className={won || roundWon ? "font-display" : "text-ink-dim"}
              style={won || roundWon ? { color: ACCENT } : undefined}
            >
              {status}
            </span>
          </div>
        </div>
      </div>

      {/* ---------------- PREDICT STEP ---------------- */}
      {phase === "predict" && (
        <div className="panel rounded-xl p-3 text-xs leading-relaxed">
          <p className="mb-1.5 text-[11px] uppercase tracking-tech text-ink-faint">
            predict first
          </p>
          <p className="mb-2 text-ink-dim">
            {target.repeat} shapes share one full turn around the centre. For the
            ring to close, what should{" "}
            <span style={{ color: ACCENT }}>turn</span> be?
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              value={predict}
              onChange={(e) => setPredict(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handlePredict();
              }}
              placeholder="°"
              aria-label="Your predicted turn angle in degrees"
              className="w-20 rounded-lg border border-line bg-panel/60 px-2 py-1.5 text-sm tabular-nums text-ink"
            />
            <button
              type="button"
              onClick={handlePredict}
              className="rounded-lg px-3 py-1.5 text-sm font-medium"
              style={{ background: ACCENT, color: "#05070d" }}
            >
              Check
            </button>
            <button
              type="button"
              onClick={handleSkipPredict}
              className="rounded-lg border border-line bg-panel/60 px-3 py-1.5 text-xs text-ink-faint"
            >
              Skip
            </button>
          </div>
          {predictMsg && (
            <p className="mt-2 text-ink-dim" role="status" aria-live="polite">
              {predictMsg}
            </p>
          )}
        </div>
      )}

      {/* ---------------- BLOCK CODE ---------------- */}
      {phase !== "predict" && (
        <div className="panel rounded-xl p-3 text-xs leading-relaxed">
          <p className="mb-1.5 text-[11px] uppercase tracking-tech text-ink-faint">
            your program
          </p>
          <pre className="overflow-x-auto whitespace-pre text-ink-dim">
            <span style={{ color: "#c084fc" }}>def</span>{" "}
            <span style={{ color: ACCENT }}>draw_shape</span>(sides, size):{"\n"}
            {"  "}turtle.polygon(sides, size){"\n\n"}
            <span style={{ color: "#fbbf24" }}>for</span> i{" "}
            <span style={{ color: "#fbbf24" }}>in</span> range(
            <span style={{ color: "#34d399" }}>{dials.repeat}</span>):{"\n"}
            {"  "}<span style={{ color: ACCENT }}>draw_shape</span>(
            <span style={{ color: "#34d399" }}>{dials.sides}</span>,{" "}
            <span style={{ color: "#34d399" }}>{dials.size}</span> + i*
            <span style={{ color: "#34d399" }}>{dials.grow}</span>){"\n"}
            {"  "}turtle.right(<span style={{ color: "#34d399" }}>{dials.turn}</span>)
          </pre>
        </div>
      )}

      {/* ---------------- DIALS ---------------- */}
      {phase !== "predict" && (
        <div className="panel flex flex-col gap-2.5 rounded-xl p-3">
          {DIALS.map((d) => {
            const v = verdict(dials[d.key], target[d.key]);
            // Per-dial feedback only appears after the learner has run once,
            // so they reason from the drawing first — not a live hill to climb.
            const showFeedback = ranThisRound && phase !== "drawing";
            return (
              <label key={d.key} className="flex flex-col gap-1 text-xs">
                <span className="flex items-center justify-between">
                  <span className="text-ink-dim">
                    {d.label} <span className="text-ink-faint">· {d.hint}</span>
                  </span>
                  <span className="flex items-center gap-1.5 tabular-nums">
                    {showFeedback && v === "ok" && (
                      <span aria-hidden style={{ color: "#34d399" }}>
                        ✓
                      </span>
                    )}
                    {showFeedback && v !== "ok" && (
                      <span
                        aria-hidden
                        className="text-[10px]"
                        style={{ color: "#fbbf24" }}
                      >
                        {v === "low" ? "▲ bigger" : "▼ smaller"}
                      </span>
                    )}
                    <span className="font-display" style={{ color: ACCENT }}>
                      {dials[d.key]}
                      {d.key === "turn" ? "°" : ""}
                    </span>
                  </span>
                </span>
                <input
                  type="range"
                  min={d.min}
                  max={d.max}
                  step={d.step}
                  value={dials[d.key]}
                  disabled={phase === "drawing" || phase === "roundwon"}
                  onChange={(e) => setDial(d.key, Number(e.target.value))}
                  aria-label={`${d.label} (${d.hint}), value ${dials[d.key]}${
                    showFeedback
                      ? v === "ok"
                        ? ", matched"
                        : v === "low"
                          ? ", needs to be bigger"
                          : ", needs to be smaller"
                      : ""
                  }`}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-50"
                  style={{ accentColor: ACCENT, touchAction: "none" }}
                />
              </label>
            );
          })}
        </div>
      )}

      {/* ---------------- CONTROLS ---------------- */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink-faint">Runs: {runs}</span>
        <div className="flex gap-2">
          {!won && phase !== "roundwon" && phase !== "predict" && (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
              aria-label="Reset the dials for this round"
            >
              Reset
            </button>
          )}
          {roundWon ? (
            <button
              type="button"
              onClick={handleNextRound}
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: ACCENT, color: "#05070d" }}
              aria-label="Go to the next round"
            >
              Next round ▶
            </button>
          ) : (
            phase !== "predict" &&
            !won && (
              <button
                type="button"
                onPointerDown={handleRun}
                disabled={phase === "drawing"}
                className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
                style={{ background: ACCENT, color: "#05070d" }}
                aria-label="Run the program and draw the pattern"
              >
                {phase === "drawing" ? "Drawing…" : "Run ▶"}
              </button>
            )
          )}
        </div>
      </div>

      {/* round-clear celebration (between rounds) */}
      {roundWon && (
        <div
          className="panel flex flex-col items-center gap-1 rounded-xl p-3 text-center"
          style={{ boxShadow: `0 0 0 1px ${ACCENT}` }}
        >
          <div className="text-xl">✅ Ring closed!</div>
          <p className="text-xs text-ink-dim">
            turn {target.turn}° = 360 ÷ {target.repeat}. On to the next bloom.
          </p>
        </div>
      )}

      {/* final win celebration */}
      {won && (
        <div
          className="panel flex flex-col items-center gap-1 rounded-xl p-3 text-center"
          style={{ boxShadow: `0 0 0 1px ${ACCENT}` }}
        >
          <div className="text-2xl">🎉</div>
          <p className="text-xs" style={{ color: ACCENT }}>
            One function + a loop drew all three rosettes — and you found
            turn = 360 ÷ repeat every time!
          </p>
        </div>
      )}
    </div>
  );
}
