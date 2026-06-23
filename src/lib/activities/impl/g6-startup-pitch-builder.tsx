"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Startup Studio — innovation design thinking (CLASS 4-6)            */
/*  LEARNING GOAL: a strong product idea connects a REAL problem to a  */
/*  MATCHING solution, proves it with the right minimum prototype      */
/*  (define -> sense -> logic -> output) and sells it with an honest   */
/*  4-line pitch. Now THREE escalating funding rounds:                 */
/*    R1  learn the flow (clear matches).                              */
/*    R2  twist: plausible near-miss solutions + a DECOY build step    */
/*        you must REJECT, and more pitch lines than slots.            */
/*    R3  hardest: two tempting solutions, only one truly FITS, and a  */
/*        pre-filled WRONG pitch line you must DEBUG.                  */
/*  Stars reward reasoning over guessing: every wrong tap costs you —  */
/*  a clean, thought-through run earns the full ⭐⭐⭐.                  */
/* ------------------------------------------------------------------ */

const ACCENT = "#22d3ee";

type Phase = "problem" | "solution" | "build" | "pitch" | "round-won" | "won";

interface Solution {
  id: string;
  emoji: string;
  text: string;
  skill: string;
}

interface BuildTile {
  id: string;
  emoji: string;
  label: string;
  /** Correct slot index 0..3 for the 4 real steps; DECOY tiles use -1. */
  order: number;
}

interface PitchOption {
  key: PitchKey;
  /** The phrase the learner can place. */
  text: string;
  /** Is this the right line for its slot? (decoys are false) */
  correct: boolean;
}

type PitchKey = "problem" | "solution" | "how" | "ask";

interface Round {
  id: string;
  emoji: string;
  problem: string;
  /** id of the ONE solution that genuinely fits. */
  fix: string;
  /** Why each common wrong pick fails — keyed by solution id. */
  nudges: Record<string, string>;
  /** Solution cards offered this round (1 correct + plausible decoys). */
  solutions: readonly Solution[];
  /** Build tiles: the 4 real steps PLUS any decoy that must be rejected. */
  buildTiles: readonly BuildTile[];
  /** Pitch lines: 4 correct + distractors (more than slots in later rounds). */
  pitchOptions: readonly PitchOption[];
  /** A pitch slot that starts PRE-FILLED with a WRONG line to debug (R3). */
  preFilledBug?: { key: PitchKey; text: string };
}

const PITCH_SLOTS: ReadonlyArray<{ key: PitchKey; label: string }> = [
  { key: "problem", label: "Problem" },
  { key: "solution", label: "Solution" },
  { key: "how", label: "How it works" },
  { key: "ask", label: "Our Ask" },
] as const;

const SLOT_HINT: readonly string[] = ["Define", "Sense / Input", "Logic", "Output"];

/* The four real build steps are shared (define -> sense -> logic -> output). */
const STEP_DEFINE: BuildTile = { id: "define", emoji: "🎯", label: "Define the goal", order: 0 };
const STEP_INPUT: BuildTile = { id: "input", emoji: "📡", label: "Read a sensor / input", order: 1 };
const STEP_LOGIC: BuildTile = { id: "logic", emoji: "🧠", label: "Decide with an if-rule", order: 2 };
const STEP_OUTPUT: BuildTile = { id: "output", emoji: "⚡", label: "Make it act (output)", order: 3 };

const ROUNDS: readonly Round[] = [
  /* ---------- ROUND 1 — learn the flow ---------- */
  {
    id: "plants",
    emoji: "🪴",
    problem: "Plants die over the holidays",
    fix: "moisture",
    nudges: {
      cup: "A 3D-printed cup can't sense dry soil or water on its own — what could DETECT dryness and act?",
      game: "A space game is fun, but it won't keep a plant alive — match the problem to its fix.",
      robot: "A dancing robot doesn't help thirsty plants — what senses the soil?",
    },
    solutions: [
      { id: "moisture", emoji: "💧", text: "Auto-watering pot", skill: "Arduino soil sensor" },
      { id: "cup", emoji: "🥤", text: "3D-printed travel cup", skill: "3D print" },
      { id: "robot", emoji: "🕺", text: "Dancing robot toy", skill: "Arduino motor" },
      { id: "game", emoji: "🎮", text: "Space shooter game", skill: "Python game" },
    ],
    buildTiles: [STEP_DEFINE, STEP_INPUT, STEP_LOGIC, STEP_OUTPUT],
    pitchOptions: [
      { key: "problem", text: "Plants dry out and die when nobody is home to water them.", correct: true },
      { key: "solution", text: "A smart pot that waters the plant by itself.", correct: true },
      { key: "how", text: "A soil sensor reads moisture, an if-rule checks it, a pump waters.", correct: true },
      { key: "ask", text: "Back us to build the first working pot.", correct: true },
      { key: "ask", text: "Our logo is a really cool colour.", correct: false },
    ],
  },

  /* ---------- ROUND 2 — twist: plausible decoys + a DECOY build step ---------- */
  {
    id: "stairs",
    emoji: "🌑",
    problem: "Dark stairs cause night falls",
    fix: "motionlight",
    nudges: {
      // tempting near-miss: a torch you carry vs. a light that turns itself on
      torch: "A torch only helps if you remember to hold it — a fall happens when hands are full. What turns ON by ITSELF?",
      // tempting: a reminder app is automation, but reminders don't light a stair
      reminder: "A reminder app pings your phone — but a dark stair needs LIGHT the moment someone steps near.",
      alarm: "A loud alarm warns you, but you still can't SEE the steps — the fix should light them.",
    },
    solutions: [
      { id: "motionlight", emoji: "🔦", text: "Motion stair light", skill: "PIR sensor + LED" },
      // plausible near-misses (all touch the same space, only one truly fits):
      { id: "torch", emoji: "🪫", text: "Hand-held torch app", skill: "Phone flashlight" },
      { id: "reminder", emoji: "⏰", text: "“Turn on the light” reminder", skill: "Python app" },
      { id: "alarm", emoji: "📢", text: "Loud trip alarm", skill: "Arduino buzzer" },
    ],
    // DECOY tile "paint" must be REJECTED — only the 4 real steps belong.
    buildTiles: [
      STEP_DEFINE,
      STEP_INPUT,
      STEP_LOGIC,
      STEP_OUTPUT,
      { id: "paint", emoji: "🎨", label: "Paint it a nice colour", order: -1 },
    ],
    pitchOptions: [
      { key: "problem", text: "People trip on dark stairs at night and get hurt.", correct: true },
      { key: "solution", text: "A light that switches on the instant it senses someone.", correct: true },
      { key: "how", text: "A motion sensor sees a person, an if-rule fires, the LED turns on.", correct: true },
      { key: "ask", text: "Back us to install the first prototype on a real staircase.", correct: true },
      // more distractors than slots -> can't just place everything:
      { key: "how", text: "It works because the stairs are painted bright yellow.", correct: false },
      { key: "ask", text: "We will be billionaires by Friday.", correct: false },
    ],
  },

  /* ---------- ROUND 3 — hardest: two tempting fits + DEBUG a pitch line ---------- */
  {
    id: "buswait",
    emoji: "🚌",
    problem: "Kids miss the school bus / wait in the rain",
    fix: "predict",
    nudges: {
      // very tempting: a tracker shows the bus, but doesn't tell YOU when to leave
      tracker: "A live map shows WHERE the bus is — but kids still must guess WHEN to leave. What tells them the right moment?",
      umbrella: "A smart umbrella keeps you dry, but it doesn't stop you missing the bus — match the MAIN problem.",
      ring: "A doorbell camera watches your door, not the bus — it won't time your walk to the stop.",
    },
    solutions: [
      { id: "predict", emoji: "⏳", text: "“Leave now” alert", skill: "Live bus data + if-rule" },
      // the trap: a tracker is the obvious-looking answer but doesn't decide for you
      { id: "tracker", emoji: "🗺️", text: "Live bus map", skill: "GPS feed" },
      { id: "umbrella", emoji: "☂️", text: "Auto-open smart umbrella", skill: "Rain sensor" },
      { id: "ring", emoji: "🔔", text: "Doorbell camera", skill: "Camera + app" },
    ],
    buildTiles: [
      STEP_DEFINE,
      STEP_INPUT,
      STEP_LOGIC,
      STEP_OUTPUT,
      { id: "ad", emoji: "📣", label: "Run a big TV advert", order: -1 },
    ],
    // R3 starts with a WRONG line already dropped in "How" — spot & fix it.
    preFilledBug: {
      key: "how",
      text: "It works because we hired a famous celebrity.",
    },
    pitchOptions: [
      { key: "problem", text: "Kids miss the bus or wait in the rain because they leave at the wrong time.", correct: true },
      { key: "solution", text: "An app that says “leave now!” at exactly the right moment.", correct: true },
      { key: "how", text: "Live bus data feeds an if-rule on walk time, which sends a leave-now alert.", correct: true },
      { key: "ask", text: "Back us to test the alert with one real bus route.", correct: true },
      // distractors, incl. the celebrity bug that's pre-placed:
      { key: "how", text: "It works because we hired a famous celebrity.", correct: false },
      { key: "problem", text: "The bus is the wrong shade of yellow.", correct: false },
    ],
  },
] as const;

/** Deterministic shuffle by a fixed key so layout is stable but mixed. */
function ordered<T>(items: readonly T[], get: (t: T) => string): T[] {
  return [...items].sort((a, b) => get(a).localeCompare(get(b)));
}

/** Stars from total wrong taps across all rounds. Reasoning beats guessing. */
function starsFor(mistakes: number): 1 | 2 | 3 {
  if (mistakes <= 2) return 3;
  if (mistakes <= 6) return 2;
  return 1;
}

export default function StartupPitchBuilder({ onComplete }: ActivityProps) {
  const [roundIdx, setRoundIdx] = useState<number>(0);
  const round = ROUNDS[roundIdx];
  const isLastRound = roundIdx === ROUNDS.length - 1;

  const [phase, setPhase] = useState<Phase>("problem");
  const [confirmedProblem, setConfirmedProblem] = useState<boolean>(false);
  const [solutionId, setSolutionId] = useState<string | null>(null);
  const [judgeNudge, setJudgeNudge] = useState<string | null>(null);

  // Build step: which tile id sits in each of the 4 slots (null = empty).
  const [slots, setSlots] = useState<(string | null)[]>([null, null, null, null]);
  const [buildError, setBuildError] = useState<string | null>(null);

  // Pitch: which phrase fills each pitch slot.
  const [pitch, setPitch] = useState<Record<PitchKey, string | null>>({
    problem: null,
    solution: null,
    how: null,
    ask: null,
  });
  const [pitchError, setPitchError] = useState<string | null>(null);

  // Optimization signal: total wrong taps across the whole studio run.
  const [mistakes, setMistakes] = useState<number>(0);
  const [finalStars, setFinalStars] = useState<1 | 2 | 3>(3);

  // Drag payload (works for pointer-based custom drag).
  const dragRef = useRef<{ kind: "solution" | "build" | "pitch"; value: string } | null>(null);
  const reportedRef = useRef<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => () => clearTimer(), [clearTimer]);

  // Set up each round's fresh state (and pre-filled bug for R3).
  const loadRound = useCallback((r: Round) => {
    setPhase("problem");
    setConfirmedProblem(false);
    setSolutionId(null);
    setJudgeNudge(null);
    setSlots([null, null, null, null]);
    setBuildError(null);
    setPitch({
      problem: null,
      solution: null,
      how: null,
      ask: null,
      ...(r.preFilledBug ? { [r.preFilledBug.key]: r.preFilledBug.text } : {}),
    });
    setPitchError(null);
  }, []);

  const bump = useCallback(() => setMistakes((m) => m + 1), []);

  // ---------------- STEP 1: confirm the problem ----------------
  const confirmProblem = useCallback(() => {
    setConfirmedProblem(true);
    setJudgeNudge(null);
    setPhase("solution");
  }, []);

  // ---------------- STEP 2: drop a solution ----------------
  const tryDropSolution = useCallback(
    (id: string) => {
      if (id === round.fix) {
        setSolutionId(id);
        setJudgeNudge(null);
        setPhase("build");
      } else {
        bump();
        const wrong = round.solutions.find((s) => s.id === id);
        const why = round.nudges[id] ?? "That one doesn't fix THIS problem — re-read the headache, then match.";
        setJudgeNudge(wrong ? `${wrong.text}? ${why}` : why);
        onComplete({ passed: false, detail: why });
      }
    },
    [round, bump, onComplete],
  );

  // ---------------- STEP 3: order build tiles (reject decoys) ----------------
  const placeBuild = useCallback((tileId: string, slotIndex: number) => {
    setBuildError(null);
    setSlots((prev) => {
      const next = [...prev];
      for (let i = 0; i < next.length; i++) if (next[i] === tileId) next[i] = null;
      next[slotIndex] = tileId;
      return next;
    });
  }, []);

  const removeFromSlot = useCallback((slotIndex: number) => {
    setBuildError(null);
    setSlots((prev) => {
      const next = [...prev];
      next[slotIndex] = null;
      return next;
    });
  }, []);

  const checkBuild = useCallback(() => {
    // Reject decoy tiles AND require correct order.
    const usedDecoy = slots.some((s) => {
      const t = round.buildTiles.find((b) => b.id === s);
      return t ? t.order === -1 : false;
    });
    if (usedDecoy) {
      bump();
      setBuildError("One of those steps isn't part of the prototype — a real product senses, decides, and acts. Swap out the odd one.");
      onComplete({ passed: false, detail: "One tile doesn't belong in the build — sense, decide, act." });
      return;
    }
    const ok = slots.every(
      (s, i) => s !== null && round.buildTiles.find((t) => t.id === s)?.order === i,
    );
    if (ok) {
      setBuildError(null);
      setPhase("pitch");
    } else {
      bump();
      setBuildError("Order matters: define → sense → decide → act. Re-order and check again.");
      onComplete({ passed: false, detail: "Re-order: define → sense → decide → act." });
    }
  }, [slots, round, bump, onComplete]);

  // ---------------- STEP 4: assemble the pitch ----------------
  const placePitch = useCallback((phrase: string, key: PitchKey) => {
    setPitchError(null);
    setPitch((prev) => {
      const next: Record<PitchKey, string | null> = { ...prev };
      (Object.keys(next) as PitchKey[]).forEach((k) => {
        if (next[k] === phrase) next[k] = null;
      });
      next[key] = phrase;
      return next;
    });
  }, []);

  const clearPitchSlot = useCallback((key: PitchKey) => {
    setPitchError(null);
    setPitch((prev) => ({ ...prev, [key]: null }));
  }, []);

  const correctTextFor = useCallback(
    (key: PitchKey): string | undefined =>
      round.pitchOptions.find((o) => o.key === key && o.correct)?.text,
    [round],
  );

  const advanceAfterRound = useCallback(() => {
    if (isLastRound) {
      if (!reportedRef.current) {
        reportedRef.current = true;
        const stars = starsFor(mistakes);
        setFinalStars(stars);
        setPhase("won");
        onComplete({
          passed: true,
          stars,
          detail:
            stars === 3
              ? "Investor: I'm IN — three sharp pitches, almost no guessing. Funded! 🚀"
              : stars === 2
                ? "Investor: I'm in! Solid pitches — a little less guessing next time for a perfect run."
                : "Investor: I'm in! You got there — reason it through with fewer tries to earn all three stars.",
        });
      }
    } else {
      setPhase("round-won");
      clearTimer();
      timerRef.current = setTimeout(() => {
        setRoundIdx((i) => {
          const next = i + 1;
          loadRound(ROUNDS[next]);
          return next;
        });
      }, 1250);
    }
  }, [isLastRound, mistakes, onComplete, clearTimer, loadRound]);

  const finishPitch = useCallback(() => {
    const wrongSlot = PITCH_SLOTS.find((s) => {
      const placed = pitch[s.key];
      const correct = correctTextFor(s.key);
      return placed !== correct;
    });
    if (!wrongSlot) {
      advanceAfterRound();
    } else {
      bump();
      const placed = pitch[wrongSlot.key];
      setPitchError(
        placed
          ? `The “${wrongSlot.label}” line doesn't ring true — pitches stay honest and clear. Tap it to remove, then pick a better line.`
          : `The “${wrongSlot.label}” line is still empty.`,
      );
      onComplete({ passed: false, detail: `Re-check the ${wrongSlot.label} line — keep it real.` });
    }
  }, [pitch, correctTextFor, advanceAfterRound, bump, onComplete]);

  // ---------------- reset ----------------
  const reset = useCallback(() => {
    clearTimer();
    reportedRef.current = false;
    dragRef.current = null;
    setMistakes(0);
    setFinalStars(3);
    setRoundIdx(0);
    loadRound(ROUNDS[0]);
  }, [clearTimer, loadRound]);

  // ----- drag helpers (pointer + click fallback) -----
  const beginDrag = useCallback((kind: "solution" | "build" | "pitch", value: string) => {
    dragRef.current = { kind, value };
  }, []);

  const pitchPhrases = useMemo(
    () => ordered(round.pitchOptions.map((o) => o.text), (t) => t),
    [round],
  );

  const placedPitchPhrases = useMemo(
    () => new Set(Object.values(pitch).filter((v): v is string => v !== null)),
    [pitch],
  );

  // ----- progress meter (0..4 stages done THIS round) -----
  const meter = useMemo(() => {
    let n = 0;
    if (confirmedProblem) n += 1;
    if (solutionId === round.fix) n += 1;
    if (
      slots.every((s, i) => s !== null && round.buildTiles.find((t) => t.id === s)?.order === i)
    )
      n += 1;
    if (PITCH_SLOTS.every((s) => pitch[s.key] === correctTextFor(s.key))) n += 1;
    return n;
  }, [confirmedProblem, solutionId, round, slots, pitch, correctTextFor]);

  const status: string = useMemo(() => {
    switch (phase) {
      case "problem":
        return `Round ${roundIdx + 1} of 3 · Read the problem, then start your build.`;
      case "solution":
        return "Match the BEST-fitting solution — some look close but don't truly fix it.";
      case "build":
        return "Order the prototype steps. Reject any step that doesn't belong, then Check Build.";
      case "pitch":
        return round.preFilledBug
          ? "Fix the wrong line, fill the rest, then Pitch It. (Tap a line to remove it.)"
          : "Fill all four pitch lines with the honest ones, then Pitch It.";
      case "round-won":
        return "Funded this round! Next challenge loading…";
      case "won":
        return "Studio complete! ✨ Investor: I'm in!";
    }
  }, [phase, roundIdx, round]);

  const meterPct = (meter / 4) * 100;
  const starRow = "⭐".repeat(finalStars);

  const chosenSolution = solutionId ? round.solutions.find((s) => s.id === solutionId) : null;

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
        @media (prefers-reduced-motion: reduce) {
          [style*="g6startuppitchbuilder-"] { animation: none !important; }
        }
      `}</style>

      {/* ---------- header + meter ---------- */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">💡 Startup Studio</span>
          <span className="flex items-center gap-2 text-[11px] text-ink-faint">
            {/* round dots */}
            <span aria-hidden className="inline-flex items-center gap-1">
              {ROUNDS.map((_, i) => {
                const solved = i < roundIdx || phase === "won";
                const current = i === roundIdx && phase !== "won";
                return (
                  <span
                    key={i}
                    className="inline-block rounded-full"
                    style={{
                      height: 8,
                      width: 8,
                      background: solved ? ACCENT : current ? `${ACCENT}55` : "var(--color-line, #233042)",
                      boxShadow: current ? `0 0 6px ${ACCENT}` : undefined,
                    }}
                  />
                );
              })}
            </span>
            <span aria-label={`Step ${meter} of 4 this round`}>{meter}/4</span>
          </span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-panel-2"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuenow={meter}
          aria-label="Pitch progress this round"
        >
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${meterPct}%`, background: ACCENT }}
          />
        </div>
        <p role="status" aria-live="polite" className="text-[11px] leading-tight text-ink-dim">
          {status}
        </p>
      </div>

      {/* ================= STEP 1: PROBLEM ================= */}
      {phase !== "won" && phase !== "round-won" && (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-panel/60 p-3">
          <p className="text-[11px] uppercase tracking-tech text-ink-faint">
            Round {roundIdx + 1} · Your problem
          </p>
          <div
            className="flex items-center gap-3 rounded-lg border p-3"
            style={{ borderColor: `${ACCENT}66`, background: `${ACCENT}10` }}
          >
            <span aria-hidden className="text-3xl">
              {round.emoji}
            </span>
            <span className="flex-1 text-xs leading-tight text-ink">{round.problem}</span>
          </div>
          {!confirmedProblem && (
            <button
              type="button"
              onClick={confirmProblem}
              className="self-end rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{ background: ACCENT, color: "#05070d" }}
              aria-label="Start building a solution for this problem"
            >
              Tackle it →
            </button>
          )}
        </div>
      )}

      {/* ================= STEP 2: SOLUTION MATCH ================= */}
      {confirmedProblem && phase !== "won" && phase !== "round-won" && (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-panel/60 p-3">
          <p className="text-[11px] uppercase tracking-tech text-ink-faint">Match a solution</p>

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
              {round.emoji}
            </span>
            <span className="flex-1 text-[11px] text-ink">{round.problem}</span>
            {chosenSolution ? (
              <span className="flex items-center gap-1 text-[11px]" style={{ color: ACCENT }}>
                {chosenSolution.emoji} {chosenSolution.text} ✓
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
              <span className="text-[10px] leading-tight text-ink-dim">Judge: {judgeNudge}</span>
            </div>
          )}

          {/* solution tray */}
          {!solutionId && (
            <div className="grid grid-cols-2 gap-2" style={{ touchAction: "none" }}>
              {round.solutions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onPointerDown={() => beginDrag("solution", s.id)}
                  onPointerUp={() => {
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
      {solutionId && phase !== "won" && phase !== "round-won" && (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-panel/60 p-3">
          <p className="text-[11px] uppercase tracking-tech text-ink-faint">
            Order the prototype
          </p>

          {/* numbered slots */}
          <div className="grid grid-cols-4 gap-1.5" style={{ touchAction: "none" }}>
            {slots.map((tileId, i) => {
              const tile = tileId ? round.buildTiles.find((t) => t.id === tileId) : null;
              const right = tile?.order === i;
              const decoy = tile?.order === -1;
              return (
                <div
                  key={i}
                  onPointerUp={() => {
                    const d = dragRef.current;
                    if (d && d.kind === "build") placeBuild(d.value, i);
                    dragRef.current = null;
                  }}
                  onClick={() => {
                    if (tile) removeFromSlot(i);
                  }}
                  className="flex min-h-[58px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed p-1 text-center"
                  style={{
                    borderColor: tile ? (right ? ACCENT : "#f87171") : `${ACCENT}55`,
                    background: tile ? (decoy ? "#f8717118" : `${ACCENT}10`) : "transparent",
                  }}
                  aria-label={`Slot ${i + 1}: ${SLOT_HINT[i]}${tile ? `, holds ${tile.label}. Tap to remove.` : ", empty"}`}
                >
                  <span className="text-[8px] text-ink-faint">
                    {i + 1}. {SLOT_HINT[i]}
                  </span>
                  {tile && (
                    <>
                      <span aria-hidden className="text-base">
                        {tile.emoji}
                      </span>
                      <span className="text-[8px] leading-tight text-ink-dim">{tile.label}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* tile bank (only unplaced tiles, incl. decoys to reject) */}
          <div className="flex flex-wrap gap-1.5" style={{ touchAction: "none" }}>
            {round.buildTiles
              .filter((t) => !slots.includes(t.id))
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onPointerDown={() => beginDrag("build", t.id)}
                  onPointerUp={() => {
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
              {buildError}
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
          <p className="text-[11px] uppercase tracking-tech text-ink-faint">Assemble your pitch</p>

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
                  onClick={() => {
                    if (pitch[s.key]) clearPitchSlot(s.key);
                  }}
                  className="flex min-h-[40px] cursor-pointer flex-col gap-0.5 rounded-lg border-2 border-dashed p-2"
                  style={{
                    borderColor: filled ? ACCENT : `${ACCENT}55`,
                    background: filled ? `${ACCENT}10` : "transparent",
                  }}
                  aria-label={`${s.label} line${filled ? `: ${filled}. Tap to remove.` : ", empty"}`}
                >
                  <span className="text-[9px] uppercase tracking-tech text-ink-faint">{s.label}</span>
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

      {/* ================= BETWEEN-ROUND BEAT ================= */}
      {phase === "round-won" && (
        <div
          className="flex flex-col items-center gap-1 rounded-xl border p-4 text-center"
          style={{ borderColor: ACCENT, background: `${ACCENT}10` }}
          role="status"
          aria-label="Round funded. Next challenge loading."
        >
          <span aria-hidden className="text-3xl">
            🤝
          </span>
          <span className="text-sm font-bold" style={{ color: ACCENT }}>
            Round {roundIdx + 1} funded!
          </span>
          <span className="text-[10px] text-ink-dim">A tougher challenge is loading…</span>
        </div>
      )}

      {/* ================= WIN CELEBRATION ================= */}
      {phase === "won" && (
        <div
          className="relative flex flex-col items-center gap-2 overflow-hidden rounded-xl border p-4 text-center"
          style={{
            borderColor: ACCENT,
            background: `${ACCENT}10`,
            animation: "g6startuppitchbuilder-glow 2s ease-in-out infinite",
          }}
          role="status"
          aria-label={`You won with ${finalStars} stars. Investor is in.`}
        >
          <div className="flex items-center justify-center gap-2 text-3xl">
            <span aria-hidden style={{ animation: "g6startuppitchbuilder-clap .6s ease-in-out infinite" }}>
              👏
            </span>
            <span aria-hidden>🎉</span>
            <span
              aria-hidden
              style={{
                animation: "g6startuppitchbuilder-clap .6s ease-in-out infinite .3s",
                display: "inline-block",
              }}
            >
              👏
            </span>
          </div>
          <div className="text-xl tracking-tech" style={{ color: ACCENT }}>
            {starRow}
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

          <p className="text-[10px] text-ink-dim">
            {finalStars === 3
              ? "Three sharp pitches with almost no guessing — that's founder thinking. 🚀"
              : finalStars === 2
                ? "Three funded rounds! Trim the guesses next time for a perfect ⭐⭐⭐."
                : "You funded all three! Reason each match through with fewer tries to earn all three stars."}
          </p>

          {/* recap of all three ventures */}
          <div className="mt-1 w-full rounded-lg border border-line bg-panel-2/50 p-2 text-left">
            <p className="mb-1 text-[9px] uppercase tracking-tech text-ink-faint">
              Your three ventures
            </p>
            {ROUNDS.map((r) => {
              const fixSol = r.solutions.find((s) => s.id === r.fix);
              return (
                <p key={r.id} className="text-[10px] leading-snug text-ink">
                  <span aria-hidden>{r.emoji}</span> {r.problem} →{" "}
                  <span style={{ color: ACCENT }}>
                    {fixSol?.emoji} {fixSol?.text}
                  </span>
                </p>
              );
            })}
            <p className="mt-1 text-[9px] leading-snug text-ink-faint">
              Every win = real problem → matching solution → sense·decide·act prototype →
              honest pitch.
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
          aria-label="Reset the studio and start from round one"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
