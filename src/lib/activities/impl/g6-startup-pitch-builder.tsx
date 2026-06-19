"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Startup Pitch Builder — innovation design thinking                */
/*  LEARNING GOAL: a strong product idea connects a REAL problem to a */
/*  MATCHING solution, then proves it with the right minimum prototype */
/*  (define → sense → logic → output) and a clear 4-line pitch.        */
/* ------------------------------------------------------------------ */

const ACCENT = "#22d3ee";

type Phase = "problem" | "solution" | "build" | "pitch" | "won";

interface Problem {
  id: string;
  emoji: string;
  text: string;
  /** The single solution id that genuinely fixes this problem. */
  fix: string;
  /** Nudge shown when the wrong solution is dropped here. */
  nudge: string;
}

interface Solution {
  id: string;
  emoji: string;
  text: string;
  skill: string;
}

const PROBLEMS: readonly Problem[] = [
  {
    id: "plants",
    emoji: "🪴",
    text: "Plants die over the holidays",
    fix: "moisture",
    nudge:
      "A 3D-printed cup won't water plants while you're away — what could SENSE the dry soil and act on it?",
  },
  {
    id: "homework",
    emoji: "📚",
    text: "Students forget their homework",
    fix: "reminder",
    nudge: "A soil sensor can't remember tasks — what tracks a to-do list?",
  },
  {
    id: "stairs",
    emoji: "🌑",
    text: "Dark stairs cause night falls",
    fix: "motionlight",
    nudge: "A reminder app won't light a staircase — what could detect a person and switch on a light?",
  },
] as const;

const SOLUTIONS: readonly Solution[] = [
  {
    id: "moisture",
    emoji: "💧",
    text: "Auto-watering pot",
    skill: "Arduino soil sensor",
  },
  {
    id: "reminder",
    emoji: "⏰",
    text: "Homework reminder app",
    skill: "Python app",
  },
  {
    id: "motionlight",
    emoji: "🔦",
    text: "Motion stair light",
    skill: "AI rule + sensor",
  },
  { id: "cup", emoji: "🥤", text: "3D-printed travel cup", skill: "3D print" },
  { id: "robot", emoji: "🕺", text: "Dancing robot toy", skill: "Arduino motor" },
  { id: "game", emoji: "🎮", text: "Space shooter game", skill: "Python game" },
] as const;

interface BuildTile {
  id: string;
  emoji: string;
  label: string;
  /** Correct slot index 0..3 (define → input → logic → output). */
  order: number;
}

const BUILD_TILES: readonly BuildTile[] = [
  { id: "define", emoji: "🎯", label: "Define the goal", order: 0 },
  { id: "input", emoji: "📡", label: "Read a sensor / input", order: 1 },
  { id: "logic", emoji: "🧠", label: "Decide with an if-rule", order: 2 },
  { id: "output", emoji: "⚡", label: "Make it act (output)", order: 3 },
] as const;

const SLOT_HINT: readonly string[] = [
  "Define",
  "Sense / Input",
  "Logic",
  "Output",
];

type PitchKey = "problem" | "solution" | "how" | "ask";

interface PitchSlot {
  key: PitchKey;
  label: string;
  correct: string;
}

const PITCH_SLOTS: readonly PitchSlot[] = [
  {
    key: "problem",
    label: "Problem",
    correct: "Many people face a real, everyday headache.",
  },
  {
    key: "solution",
    label: "Solution",
    correct: "Our gadget fixes it automatically.",
  },
  {
    key: "how",
    label: "How it works",
    correct: "A sensor reads the world, an if-rule decides, an output acts.",
  },
  {
    key: "ask",
    label: "Our Ask",
    correct: "Back us so we can build the first prototype.",
  },
] as const;

const PITCH_DISTRACTORS: readonly string[] = [
  "Our logo is a really cool colour.",
  "We will become billionaires by Friday.",
];

/** Deterministic shuffle by a fixed key so layout is stable but mixed. */
function ordered<T>(items: readonly T[], get: (t: T) => string): T[] {
  return [...items].sort((a, b) => get(a).localeCompare(get(b)));
}

export default function StartupPitchBuilder({ onComplete }: ActivityProps) {
  const [phase, setPhase] = useState<Phase>("problem");
  const [problemId, setProblemId] = useState<string | null>(null);
  const [solutionId, setSolutionId] = useState<string | null>(null);
  const [judgeNudge, setJudgeNudge] = useState<string | null>(null);

  // Build step: which tile id sits in each of the 4 slots (null = empty).
  const [slots, setSlots] = useState<(string | null)[]>([null, null, null, null]);
  const [buildError, setBuildError] = useState<boolean>(false);

  // Pitch: which phrase fills each pitch slot.
  const [pitch, setPitch] = useState<Record<PitchKey, string | null>>({
    problem: null,
    solution: null,
    how: null,
    ask: null,
  });
  const [pitchError, setPitchError] = useState<string | null>(null);

  // Drag payload (works for pointer-based custom drag).
  const dragRef = useRef<{ kind: "solution" | "build" | "pitch"; value: string } | null>(
    null,
  );
  const completedRef = useRef<boolean>(false);

  const problem = useMemo(
    () => PROBLEMS.find((p) => p.id === problemId) ?? null,
    [problemId],
  );

  // ----- progress meter (0..4 stages done) -----
  const meter = useMemo(() => {
    let n = 0;
    if (problemId) n += 1;
    if (solutionId && problem && solutionId === problem.fix) n += 1;
    if (slots.every((s, i) => s !== null && BUILD_TILES.find((t) => t.id === s)?.order === i))
      n += 1;
    if (PITCH_SLOTS.every((s) => pitch[s.key] === s.correct)) n += 1;
    return n;
  }, [problemId, solutionId, problem, slots, pitch]);

  // ---------------- STEP 1: pick a problem ----------------
  const pickProblem = useCallback((id: string) => {
    setProblemId(id);
    setSolutionId(null);
    setJudgeNudge(null);
    setPhase("solution");
  }, []);

  // ---------------- STEP 2: drop a solution ----------------
  const tryDropSolution = useCallback(
    (id: string) => {
      if (!problem) return;
      if (id === problem.fix) {
        setSolutionId(id);
        setJudgeNudge(null);
        setPhase("build");
        onComplete({ passed: false, detail: "Great fit! Now build the prototype." });
      } else {
        const wrong = SOLUTIONS.find((s) => s.id === id);
        setJudgeNudge(problem.nudge);
        onComplete({
          passed: false,
          detail: wrong ? `Hmm, ${wrong.text}? ${problem.nudge}` : problem.nudge,
        });
      }
    },
    [problem, onComplete],
  );

  // ---------------- STEP 3: order build tiles ----------------
  const placeBuild = useCallback(
    (tileId: string, slotIndex: number) => {
      setBuildError(false);
      setSlots((prev) => {
        const next = [...prev];
        // remove tile from any slot it currently occupies
        for (let i = 0; i < next.length; i++) if (next[i] === tileId) next[i] = null;
        next[slotIndex] = tileId;
        return next;
      });
    },
    [],
  );

  const checkBuild = useCallback(() => {
    const ok = slots.every(
      (s, i) => s !== null && BUILD_TILES.find((t) => t.id === s)?.order === i,
    );
    if (ok) {
      setBuildError(false);
      setPhase("pitch");
      onComplete({ passed: false, detail: "Prototype flow looks solid — now pitch it!" });
    } else {
      setBuildError(true);
      onComplete({
        passed: false,
        detail: "Order matters: define first, then sense, then decide, then act.",
      });
    }
  }, [slots, onComplete]);

  // ---------------- STEP 4: assemble the pitch ----------------
  const placePitch = useCallback((phrase: string, key: PitchKey) => {
    setPitchError(null);
    setPitch((prev) => {
      const next: Record<PitchKey, string | null> = { ...prev };
      // a phrase can only live in one slot
      (Object.keys(next) as PitchKey[]).forEach((k) => {
        if (next[k] === phrase) next[k] = null;
      });
      next[key] = phrase;
      return next;
    });
  }, []);

  const finishPitch = useCallback(() => {
    const wrongSlot = PITCH_SLOTS.find((s) => pitch[s.key] !== s.correct);
    if (!wrongSlot) {
      if (!completedRef.current) {
        completedRef.current = true;
        setPhase("won");
        const chosen = problem ? problem.text : "a real problem";
        onComplete({
          passed: true,
          stars: 3,
          detail: `Investor: I'm in! Your "${chosen}" pitch connects problem → solution → prototype.`,
        });
      }
    } else {
      setPitchError(
        `The ${wrongSlot.label} line doesn't fit yet — pitches stay honest and clear.`,
      );
      onComplete({
        passed: false,
        detail: `Re-check the ${wrongSlot.label} line — keep it real.`,
      });
    }
  }, [pitch, problem, onComplete]);

  // ---------------- reset ----------------
  const reset = useCallback(() => {
    completedRef.current = false;
    dragRef.current = null;
    setPhase("problem");
    setProblemId(null);
    setSolutionId(null);
    setJudgeNudge(null);
    setSlots([null, null, null, null]);
    setBuildError(false);
    setPitch({ problem: null, solution: null, how: null, ask: null });
    setPitchError(null);
  }, []);

  // ----- drag helpers (pointer + click fallback) -----
  const beginDrag = useCallback(
    (kind: "solution" | "build" | "pitch", value: string) => {
      dragRef.current = { kind, value };
    },
    [],
  );

  const pitchPhrases = useMemo(
    () =>
      ordered(
        [...PITCH_SLOTS.map((s) => s.correct), ...PITCH_DISTRACTORS],
        (s) => s,
      ),
    [],
  );

  const placedPitchPhrases = useMemo(
    () => new Set(Object.values(pitch).filter((v): v is string => v !== null)),
    [pitch],
  );

  const status: string = useMemo(() => {
    switch (phase) {
      case "problem":
        return "Step 1 of 4 · Pick a real problem worth solving.";
      case "solution":
        return "Step 2 of 4 · Drag the BEST-fitting solution onto your problem.";
      case "build":
        return "Step 3 of 4 · Order the 4 build steps, then Check Build.";
      case "pitch":
        return "Step 4 of 4 · Fill all four pitch lines, then Pitch It.";
      case "won":
        return "Funded! ✨ Investor: I'm in!";
    }
  }, [phase]);

  const meterPct = (meter / 4) * 100;

  return (
    <div
      className="mx-auto flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink"
      style={{ touchAction: "manipulation" }}
    >
      <style>{`
        @keyframes g6startuppitchbuilder-pop {
          0% { transform: scale(.7); opacity: 0; }
          60% { transform: scale(1.08); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g6startuppitchbuilder-clap {
          0%,100% { transform: translateY(0) rotate(0); }
          25% { transform: translateY(-4px) rotate(-12deg); }
          75% { transform: translateY(-4px) rotate(12deg); }
        }
        @keyframes g6startuppitchbuilder-stamp {
          0% { transform: scale(2.4) rotate(-18deg); opacity: 0; }
          70% { transform: scale(.92) rotate(-9deg); opacity: 1; }
          100% { transform: scale(1) rotate(-9deg); opacity: 1; }
        }
        @keyframes g6startuppitchbuilder-glow {
          0%,100% { box-shadow: 0 0 0 1px ${ACCENT}55; }
          50% { box-shadow: 0 0 18px -2px ${ACCENT}; }
        }
      `}</style>

      {/* ---------- header + meter ---------- */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">💡 Startup Pitch Builder</span>
          <span className="text-[11px] text-ink-faint">{meter}/4</span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-panel-2"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuenow={meter}
          aria-label="Pitch progress"
        >
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${meterPct}%`, background: ACCENT }}
          />
        </div>
        <p
          role="status"
          aria-live="polite"
          className="text-[11px] leading-tight text-ink-dim"
        >
          {status}
        </p>
      </div>

      {/* ================= STEP 1: PROBLEM WALL ================= */}
      {phase !== "won" && (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-panel/60 p-3">
          <p className="text-[11px] uppercase tracking-tech text-ink-faint">
            Your problem
          </p>
          <div className="grid grid-cols-3 gap-2">
            {PROBLEMS.map((p) => {
              const active = problemId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onPointerDown={() => pickProblem(p.id)}
                  aria-pressed={active}
                  aria-label={`Problem: ${p.text}`}
                  className="flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition"
                  style={{
                    borderColor: active ? ACCENT : "var(--color-line, #233042)",
                    background: active ? `${ACCENT}1a` : "transparent",
                  }}
                >
                  <span aria-hidden className="text-2xl">
                    {p.emoji}
                  </span>
                  <span className="text-[10px] leading-tight text-ink-dim">
                    {p.text}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= STEP 2: SOLUTION MATCH ================= */}
      {problem && phase !== "won" && (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-panel/60 p-3">
          <p className="text-[11px] uppercase tracking-tech text-ink-faint">
            Match a solution
          </p>

          {/* drop target = the chosen problem */}
          <div
            onPointerUp={() => {
              const d = dragRef.current;
              if (d && d.kind === "solution") tryDropSolution(d.value);
              dragRef.current = null;
            }}
            className="flex items-center gap-2 rounded-lg border-2 border-dashed p-2"
            style={{
              borderColor: solutionId ? ACCENT : `${ACCENT}66`,
              background: solutionId ? `${ACCENT}14` : "transparent",
              animation:
                phase === "solution" && !solutionId
                  ? "g6startuppitchbuilder-glow 2.4s ease-in-out infinite"
                  : undefined,
            }}
            role="group"
            aria-label="Drop a solution onto your problem"
          >
            <span aria-hidden className="text-xl">
              {problem.emoji}
            </span>
            <span className="flex-1 text-[11px] text-ink">{problem.text}</span>
            {solutionId ? (
              <span className="flex items-center gap-1 text-[11px]" style={{ color: ACCENT }}>
                {SOLUTIONS.find((s) => s.id === solutionId)?.emoji}{" "}
                {SOLUTIONS.find((s) => s.id === solutionId)?.text} ✓
              </span>
            ) : (
              <span className="text-[10px] text-ink-faint">drop here</span>
            )}
          </div>

          {/* confused judge nudge */}
          {judgeNudge && !solutionId && (
            <div
              className="flex items-start gap-2 rounded-lg border border-line bg-panel-2/60 p-2"
              style={{ animation: "g6startuppitchbuilder-pop .25s ease-out" }}
            >
              <span aria-hidden className="text-lg">
                🤨
              </span>
              <span className="text-[10px] leading-tight text-ink-dim">
                Judge: {judgeNudge}
              </span>
            </div>
          )}

          {/* solution tray */}
          {!solutionId && (
            <div className="grid grid-cols-2 gap-2" style={{ touchAction: "none" }}>
              {SOLUTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onPointerDown={() => beginDrag("solution", s.id)}
                  onPointerUp={() => {
                    // tap-to-place fallback: a tap also "drops" on the target
                    if (dragRef.current && dragRef.current.value === s.id) {
                      tryDropSolution(s.id);
                      dragRef.current = null;
                    }
                  }}
                  aria-label={`Solution: ${s.text}, uses ${s.skill}. Tap or drag onto your problem.`}
                  className="flex flex-col items-start gap-0.5 rounded-lg border border-line bg-panel-2/50 p-2 text-left transition active:scale-95"
                >
                  <span className="flex items-center gap-1 text-[11px] text-ink">
                    <span aria-hidden>{s.emoji}</span> {s.text}
                  </span>
                  <span className="text-[9px] text-ink-faint">{s.skill}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= STEP 3: BUILD THE MVP ================= */}
      {solutionId && phase !== "won" && (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-panel/60 p-3">
          <p className="text-[11px] uppercase tracking-tech text-ink-faint">
            Order the prototype
          </p>

          {/* numbered slots */}
          <div className="grid grid-cols-4 gap-1.5" style={{ touchAction: "none" }}>
            {slots.map((tileId, i) => {
              const tile = tileId ? BUILD_TILES.find((t) => t.id === tileId) : null;
              const right = tile?.order === i;
              return (
                <div
                  key={i}
                  onPointerUp={() => {
                    const d = dragRef.current;
                    if (d && d.kind === "build") placeBuild(d.value, i);
                    dragRef.current = null;
                  }}
                  className="flex min-h-[58px] flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed p-1 text-center"
                  style={{
                    borderColor: tile
                      ? right
                        ? ACCENT
                        : "#f87171"
                      : `${ACCENT}55`,
                    background: tile ? `${ACCENT}10` : "transparent",
                  }}
                  aria-label={`Slot ${i + 1}: ${SLOT_HINT[i]}${tile ? `, holds ${tile.label}` : ", empty"}`}
                >
                  <span className="text-[8px] text-ink-faint">
                    {i + 1}. {SLOT_HINT[i]}
                  </span>
                  {tile && (
                    <>
                      <span aria-hidden className="text-base">
                        {tile.emoji}
                      </span>
                      <span className="text-[8px] leading-tight text-ink-dim">
                        {tile.label}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* tile bank (only unplaced tiles) */}
          <div className="flex flex-wrap gap-1.5" style={{ touchAction: "none" }}>
            {BUILD_TILES.filter((t) => !slots.includes(t.id)).map((t) => (
              <button
                key={t.id}
                type="button"
                onPointerDown={() => beginDrag("build", t.id)}
                onPointerUp={() => {
                  // tap fallback: place into the first empty slot
                  if (dragRef.current && dragRef.current.value === t.id) {
                    const empty = slots.findIndex((s) => s === null);
                    if (empty >= 0) placeBuild(t.id, empty);
                    dragRef.current = null;
                  }
                }}
                aria-label={`Build tile: ${t.label}. Tap or drag into a slot.`}
                className="flex items-center gap-1 rounded-lg border border-line bg-panel-2/60 px-2 py-1.5 text-[10px] text-ink active:scale-95"
              >
                <span aria-hidden>{t.emoji}</span> {t.label}
              </button>
            ))}
          </div>

          {buildError && (
            <p className="text-[10px]" style={{ color: "#fca5a5" }}>
              Almost — think define → sense → decide → act. Re-order and check again.
            </p>
          )}

          <button
            type="button"
            onClick={checkBuild}
            disabled={slots.some((s) => s === null)}
            className="self-end rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            style={{ background: ACCENT, color: "#05070d" }}
            aria-label="Check the build order"
          >
            Check Build
          </button>
        </div>
      )}

      {/* ================= STEP 4: THE PITCH ================= */}
      {phase === "pitch" && (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-panel/60 p-3">
          <p className="text-[11px] uppercase tracking-tech text-ink-faint">
            Assemble your pitch
          </p>

          {/* slots */}
          <div className="flex flex-col gap-1.5" style={{ touchAction: "none" }}>
            {PITCH_SLOTS.map((s) => {
              const filled = pitch[s.key];
              return (
                <div
                  key={s.key}
                  onPointerUp={() => {
                    const d = dragRef.current;
                    if (d && d.kind === "pitch") placePitch(d.value, s.key);
                    dragRef.current = null;
                  }}
                  className="flex min-h-[40px] flex-col gap-0.5 rounded-lg border-2 border-dashed p-2"
                  style={{
                    borderColor: filled ? ACCENT : `${ACCENT}55`,
                    background: filled ? `${ACCENT}10` : "transparent",
                  }}
                  aria-label={`${s.label} line${filled ? `: ${filled}` : ", empty"}`}
                >
                  <span className="text-[9px] uppercase tracking-tech text-ink-faint">
                    {s.label}
                  </span>
                  <span className="text-[10px] leading-tight text-ink">
                    {filled ?? "drop a line here"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* phrase bank */}
          <div className="flex flex-col gap-1.5" style={{ touchAction: "none" }}>
            {pitchPhrases.map((phrase) => {
              const used = placedPitchPhrases.has(phrase);
              return (
                <button
                  key={phrase}
                  type="button"
                  disabled={used}
                  onPointerDown={() => beginDrag("pitch", phrase)}
                  aria-label={`Pitch phrase: ${phrase}. Drag onto a slot.`}
                  className="rounded-lg border border-line bg-panel-2/60 px-2 py-1.5 text-left text-[10px] leading-tight text-ink-dim active:scale-[.98] disabled:opacity-30"
                >
                  {phrase}
                </button>
              );
            })}
          </div>

          {pitchError && (
            <p className="text-[10px]" style={{ color: "#fca5a5" }}>
              {pitchError}
            </p>
          )}

          <button
            type="button"
            onClick={finishPitch}
            disabled={PITCH_SLOTS.some((s) => pitch[s.key] === null)}
            className="self-end rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            style={{ background: ACCENT, color: "#05070d" }}
            aria-label="Submit your pitch to the investor"
          >
            Pitch It 🎤
          </button>
        </div>
      )}

      {/* ================= WIN CELEBRATION ================= */}
      {phase === "won" && problem && (
        <div
          className="relative flex flex-col items-center gap-2 overflow-hidden rounded-xl border p-4 text-center"
          style={{
            borderColor: ACCENT,
            background: `${ACCENT}10`,
            animation: "g6startuppitchbuilder-glow 2s ease-in-out infinite",
          }}
          role="status"
          aria-label="You won. Investor is in."
        >
          <div className="flex items-center justify-center gap-2 text-3xl">
            <span
              aria-hidden
              style={{ animation: "g6startuppitchbuilder-clap .6s ease-in-out infinite" }}
            >
              👏
            </span>
            <span aria-hidden>🎉</span>
            <span
              aria-hidden
              style={{
                animation:
                  "g6startuppitchbuilder-clap .6s ease-in-out infinite .3s",
                display: "inline-block",
              }}
            >
              👏
            </span>
          </div>
          <div className="text-xl tracking-tech" style={{ color: ACCENT }}>
            ⭐⭐⭐
          </div>
          <div
            className="rounded-md border-2 px-3 py-1 text-sm font-bold uppercase"
            style={{
              borderColor: ACCENT,
              color: ACCENT,
              animation: "g6startuppitchbuilder-stamp .6s ease-out",
            }}
          >
            ✨ Investor: I&apos;m in!
          </div>

          {/* printed pitch summary */}
          <div className="mt-1 w-full rounded-lg border border-line bg-panel-2/50 p-2 text-left">
            <p className="mb-1 text-[9px] uppercase tracking-tech text-ink-faint">
              Your pitch
            </p>
            <p className="text-[10px] leading-snug text-ink">
              <span className="text-ink-faint">Problem:</span> {problem.emoji}{" "}
              {problem.text}.
            </p>
            <p className="text-[10px] leading-snug text-ink">
              <span className="text-ink-faint">Solution:</span>{" "}
              {SOLUTIONS.find((s) => s.id === solutionId)?.emoji}{" "}
              {SOLUTIONS.find((s) => s.id === solutionId)?.text} (
              {SOLUTIONS.find((s) => s.id === solutionId)?.skill}).
            </p>
            <p className="text-[10px] leading-snug text-ink">
              <span className="text-ink-faint">How:</span> Sense → decide with an
              if-rule → act.
            </p>
            <p className="text-[10px] leading-snug text-ink">
              <span className="text-ink-faint">Ask:</span> Back us to build the
              first prototype.
            </p>
          </div>
        </div>
      )}

      {/* ---------- reset ---------- */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-xs font-medium text-ink-dim"
          aria-label="Reset the lab and start a new pitch"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
