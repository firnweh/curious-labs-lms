"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Dual-Zone Alarm Logic — design a sensor rule that catches every    */
/*  real break-in while ignoring every false alarm. Three escalating   */
/*  rounds: a pet, then a second way in (a window), then a pet-immune  */
/*  decoy you must EXCLUDE. The rule space grows each round, so you     */
/*  can't just tap your way through all combinations — you have to     */
/*  reason about WHY each test case is safe or dangerous.              */
/* ------------------------------------------------------------------ */

const ACCENT = "#22d3ee";
const ALARM = "#f87171";
const SAFE = "#34d399";
const VIOLET = "#a855f7";
const AMBER = "#f59e0b";

type Op = "AND" | "OR";

/** Inputs available to a scenario. Not every round uses every field. */
interface Sensors {
  zoneA: boolean;
  zoneB: boolean;
  door: boolean;
  window: boolean;
  /** Low "pet sensor" — trips at cat height. A person walking does NOT trip it. */
  pet: boolean;
}

/** One test scenario the alarm must judge correctly. */
interface Scenario {
  id: number;
  label: string;
  glyph: string;
  sensors: Sensors;
  /** Ground truth: is this a real break-in that SHOULD alarm? */
  intrusion: boolean;
}

/* An operator slot the learner toggles. */
interface OpSlot {
  key: string;
  /** Tone for the chips on either side, purely cosmetic context. */
  defaultValue: Op;
}

/* A round = a fixed rule shape with named operator slots + its test cases. */
interface Round {
  id: number;
  title: string;
  brief: string;
  /** Pretty-printed rule template; %k tokens are operator slots, names are chips. */
  slots: readonly OpSlot[];
  /** Optional "ignore the pet" toggle (a NOT guard) the learner can switch on. */
  hasPetGuard: boolean;
  scenarios: readonly Scenario[];
  /** Evaluate the learner's wired rule for a scenario. Pure + deterministic. */
  evaluate: (s: Sensors, ops: Record<string, Op>, petGuard: boolean) => boolean;
  /** Render the rule as labelled pieces for the builder UI. */
  pieces: readonly RulePiece[];
}

type RulePiece =
  | { kind: "paren"; text: "(" | ")" }
  | { kind: "chip"; label: string; tone: string }
  | { kind: "op"; slot: string; aria: string }
  | { kind: "guard"; aria: string }; // the NOT-pet toggle

const NO: Sensors = { zoneA: false, zoneB: false, door: false, window: false, pet: false };

/* ---------------- ROUND 1 — warm-up: motion AND the door ---------------- */
const R1: Round = {
  id: 1,
  title: "Round 1 · One way in",
  brief: "A pet and a breeze keep tripping single sensors. A real burglar trips a zone AND opens the only door.",
  slots: [
    { key: "a", defaultValue: "OR" }, // between Zone A / Zone B
    { key: "b", defaultValue: "OR" }, // between (zones) / Door  — start loose so the cat fires
  ],
  hasPetGuard: false,
  evaluate: (s, ops) => {
    const zones = ops.a === "AND" ? s.zoneA && s.zoneB : s.zoneA || s.zoneB;
    return ops.b === "AND" ? zones && s.door : zones || s.door;
  },
  pieces: [
    { kind: "paren", text: "(" },
    { kind: "chip", label: "Zone A", tone: ACCENT },
    { kind: "op", slot: "a", aria: "Operator between Zone A and Zone B" },
    { kind: "chip", label: "Zone B", tone: ACCENT },
    { kind: "paren", text: ")" },
    { kind: "op", slot: "b", aria: "Operator between the zones and the Door" },
    { kind: "chip", label: "Door", tone: AMBER },
  ],
  scenarios: [
    { id: 1, label: "Cat strolls through Zone A, door shut", glyph: "🐈", sensors: { ...NO, zoneA: true }, intrusion: false },
    { id: 2, label: "Wind flutters a curtain in Zone B", glyph: "🍃", sensors: { ...NO, zoneB: true }, intrusion: false },
    { id: 3, label: "Door swings open, nobody moving", glyph: "🚪", sensors: { ...NO, door: true }, intrusion: false },
    { id: 4, label: "Burglar crosses Zone A and opens the door", glyph: "🦹", sensors: { ...NO, zoneA: true, door: true }, intrusion: true },
    { id: 5, label: "Burglar crosses Zone B and opens the door", glyph: "🥷", sensors: { ...NO, zoneB: true, door: true }, intrusion: true },
  ],
};

/* ---------------- ROUND 2 — twist: a SECOND way in (the window) -------- */
const R2: Round = {
  id: 2,
  title: "Round 2 · Two ways in",
  brief: "Now there's a window too. A burglar can enter by the door OR the window — but a zone must still move. Don't let the open window alone fool you.",
  slots: [
    { key: "a", defaultValue: "OR" }, // Zone A / Zone B
    { key: "b", defaultValue: "OR" }, // Door / Window
    { key: "c", defaultValue: "OR" }, // (zones) / (entries)
  ],
  hasPetGuard: false,
  evaluate: (s, ops) => {
    const zones = ops.a === "AND" ? s.zoneA && s.zoneB : s.zoneA || s.zoneB;
    const entries = ops.b === "AND" ? s.door && s.window : s.door || s.window;
    return ops.c === "AND" ? zones && entries : zones || entries;
  },
  pieces: [
    { kind: "paren", text: "(" },
    { kind: "chip", label: "Zone A", tone: ACCENT },
    { kind: "op", slot: "a", aria: "Operator between Zone A and Zone B" },
    { kind: "chip", label: "Zone B", tone: ACCENT },
    { kind: "paren", text: ")" },
    { kind: "op", slot: "c", aria: "Operator between the zones group and the entries group" },
    { kind: "paren", text: "(" },
    { kind: "chip", label: "Door", tone: AMBER },
    { kind: "op", slot: "b", aria: "Operator between the Door and the Window" },
    { kind: "chip", label: "Window", tone: AMBER },
    { kind: "paren", text: ")" },
  ],
  scenarios: [
    { id: 1, label: "Cat in Zone A, everything shut", glyph: "🐈", sensors: { ...NO, zoneA: true }, intrusion: false },
    { id: 2, label: "Window blows open, nobody moving", glyph: "🪟", sensors: { ...NO, window: true }, intrusion: false },
    { id: 3, label: "Door left open by the wind", glyph: "🚪", sensors: { ...NO, door: true }, intrusion: false },
    { id: 4, label: "Burglar in Zone A climbs through the window", glyph: "🦹", sensors: { ...NO, zoneA: true, window: true }, intrusion: true },
    { id: 5, label: "Burglar in Zone B opens the door", glyph: "🥷", sensors: { ...NO, zoneB: true, door: true }, intrusion: true },
    { id: 6, label: "Curtain flutters in Zone B, window ajar", glyph: "🍃", sensors: { ...NO, zoneB: true, window: false, door: false }, intrusion: false },
  ],
};

/* ---------------- ROUND 3 — the decoy: a pet-immune sensor to EXCLUDE -- */
/* The PET sensor sits low and only the cat trips it. The clever burglar
   knows a single high zone can be faked by a swinging curtain, so the rule
   must (a) see motion, (b) see a real entry, AND (c) NOT be just the pet. */
const R3: Round = {
  id: 3,
  title: "Round 3 · Outsmart the decoy",
  brief: "A low PET sensor trips only at cat height. Flip the 🚫 guard so the alarm IGNORES anything that is just the pet — then keep catching the real burglars.",
  slots: [
    { key: "a", defaultValue: "OR" }, // Door / Window
    { key: "b", defaultValue: "OR" }, // (motion) / (entries)
  ],
  hasPetGuard: true,
  evaluate: (s, ops, petGuard) => {
    const entries = ops.a === "AND" ? s.door && s.window : s.door || s.window;
    // The low PET sensor is wired into "Motion". With the 🚫 guard OFF the cat
    // counts as motion (and the cat-at-the-door case slips through as an alarm).
    // Flip the guard ON and Motion ignores the pet — only a real high zone counts.
    const motion = petGuard ? s.zoneA || s.zoneB : s.zoneA || s.zoneB || s.pet;
    return ops.b === "AND" ? motion && entries : motion || entries;
  },
  pieces: [
    { kind: "guard", aria: "Ignore-the-pet guard" },
    { kind: "chip", label: "Motion", tone: ACCENT },
    { kind: "op", slot: "b", aria: "Operator between the motion zones and the entries group" },
    { kind: "paren", text: "(" },
    { kind: "chip", label: "Door", tone: AMBER },
    { kind: "op", slot: "a", aria: "Operator between the Door and the Window" },
    { kind: "chip", label: "Window", tone: AMBER },
    { kind: "paren", text: ")" },
  ],
  scenarios: [
    { id: 1, label: "Cat pads along the floor (PET sensor only)", glyph: "🐈", sensors: { ...NO, pet: true }, intrusion: false },
    { id: 2, label: "Window pops open, nobody inside", glyph: "🪟", sensors: { ...NO, window: true }, intrusion: false },
    { id: 3, label: "Burglar crosses a zone and opens the door", glyph: "🦹", sensors: { ...NO, zoneA: true, door: true }, intrusion: true },
    { id: 4, label: "Burglar through the window, tripping a zone", glyph: "🥷", sensors: { ...NO, zoneB: true, window: true }, intrusion: true },
    { id: 5, label: "Cat trips PET while the door is open in the wind", glyph: "🐾", sensors: { ...NO, pet: true, door: true }, intrusion: false },
    { id: 6, label: "Burglar steps over the low sensor, opens door", glyph: "🧗", sensors: { ...NO, zoneA: true, pet: false, door: true }, intrusion: true },
  ],
};

const ROUNDS: readonly Round[] = [R1, R2, R3] as const;

type Verdict = "ok" | "false-alarm" | "missed";

interface Outcome {
  scenario: Scenario;
  fired: boolean;
  verdict: Verdict;
}

/** Grade every scenario in a round under the current rule. Pure + deterministic. */
function gradeRound(round: Round, ops: Record<string, Op>, petGuard: boolean): Outcome[] {
  return round.scenarios.map((s) => {
    const fired = round.evaluate(s.sensors, ops, petGuard);
    let verdict: Verdict;
    if (fired === s.intrusion) verdict = "ok";
    else if (fired && !s.intrusion) verdict = "false-alarm";
    else verdict = "missed";
    return { scenario: s, fired, verdict };
  });
}

/** Fresh default operator map for a round. */
function defaultOps(round: Round): Record<string, Op> {
  const m: Record<string, Op> = {};
  round.slots.forEach((slot) => {
    m[slot.key] = slot.defaultValue;
  });
  return m;
}

export default function DualZoneAlarm({ onComplete }: ActivityProps) {
  const [roundIdx, setRoundIdx] = useState<number>(0);
  const round = ROUNDS[roundIdx];

  const [ops, setOps] = useState<Record<string, Op>>(() => defaultOps(ROUNDS[0]));
  const [petGuard, setPetGuard] = useState<boolean>(false);
  const [running, setRunning] = useState<boolean>(false);
  const [active, setActive] = useState<number>(-1);
  const [results, setResults] = useState<Outcome[]>([]);
  const [roundWon, setRoundWon] = useState<boolean>(false);
  const [done, setDone] = useState<boolean>(false);
  const [tries, setTries] = useState<number>(0);
  /** Total run presses across the whole lab — drives the star rating. */
  const totalRuns = useRef<number>(0);

  const reportedRef = useRef<boolean>(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const graded = useMemo(() => gradeRound(round, ops, petGuard), [round, ops, petGuard]);
  const falseAlarms = results.filter((r) => r.verdict === "false-alarm").length;
  const missed = results.filter((r) => r.verdict === "missed").length;
  const realCount = round.scenarios.filter((s) => s.intrusion).length;
  const caught = results.filter((r) => r.scenario.intrusion && r.fired).length;

  const stage: Outcome | null = active >= 0 ? graded[active] ?? null : null;
  const liveFired: boolean = stage ? stage.fired : false;

  const editGuarded = useCallback(() => {
    // Editing the rule clears a finished run so feedback stays honest.
    setResults([]);
    setActive(-1);
    setRoundWon(false);
  }, []);

  const setOperator = useCallback(
    (key: string, value: Op) => {
      if (running) return;
      setOps((m) => ({ ...m, [key]: value }));
      editGuarded();
    },
    [running, editGuarded],
  );

  const toggleGuard = useCallback(() => {
    if (running) return;
    setPetGuard((g) => !g);
    editGuarded();
  }, [running, editGuarded]);

  const advanceRound = useCallback(() => {
    clearTimers();
    const next = roundIdx + 1;
    setRoundIdx(next);
    setOps(defaultOps(ROUNDS[next]));
    setPetGuard(false);
    setRunning(false);
    setActive(-1);
    setResults([]);
    setRoundWon(false);
  }, [roundIdx, clearTimers]);

  const runTests = useCallback(() => {
    clearTimers();
    setResults([]);
    setActive(-1);
    setRunning(true);
    setTries((t) => t + 1);
    totalRuns.current += 1;

    const fresh = gradeRound(round, ops, petGuard);
    const STEP_MS = 560;

    round.scenarios.forEach((_, i) => {
      timers.current.push(
        setTimeout(() => {
          setActive(i);
          setResults(fresh.slice(0, i + 1));
        }, i * STEP_MS),
      );
    });

    timers.current.push(
      setTimeout(() => {
        setRunning(false);
        const win = fresh.every((r) => r.verdict === "ok");
        if (!win) {
          // Gentle retry: never report a failure, just leave the board honest.
          return;
        }
        const isLast = roundIdx === ROUNDS.length - 1;
        if (!isLast) {
          setRoundWon(true);
          return;
        }
        // FINAL success — grade by efficiency across all three rounds.
        if (reportedRef.current) return;
        reportedRef.current = true;
        setRoundWon(true);
        setDone(true);
        // 3 rounds solved in the fewest possible runs = 3 runs total.
        const runs = totalRuns.current;
        const stars: 1 | 2 | 3 = runs <= 4 ? 3 : runs <= 7 ? 2 : 1;
        onComplete({
          passed: true,
          stars,
          detail:
            stars === 3
              ? "Master alarm engineer — three rounds, no wasted guesses."
              : stars === 2
                ? "Solved all three rounds! Tighter reasoning earns the third star."
                : "All three rounds beaten. Try fewer test runs next time for more stars.",
        });
      }, round.scenarios.length * STEP_MS + 120),
    );
  }, [round, ops, petGuard, roundIdx, onComplete, clearTimers]);

  const resetRound = useCallback(() => {
    if (done) return;
    clearTimers();
    setOps(defaultOps(round));
    setPetGuard(false);
    setRunning(false);
    setActive(-1);
    setResults([]);
    setRoundWon(false);
  }, [round, done, clearTimers]);

  const ranFully = results.length === round.scenarios.length;
  const status: string = done
    ? "ARMED & smart across all three rounds. ✨"
    : roundWon
      ? roundIdx < ROUNDS.length - 1
        ? "Round clear! No false alarms, every burglar caught. ➡️"
        : "Final round clear!"
      : running
        ? `Testing case ${active + 1} of ${round.scenarios.length}…`
        : ranFully
          ? falseAlarms > 0
            ? `${falseAlarms} false alarm${falseAlarms > 1 ? "s" : ""} — a harmless event tripped it. Tighten the rule.`
            : missed > 0
              ? "A real break-in slipped past. Don't loosen it too far."
              : "All clear!"
          : round.brief;

  // Floor-plan wedge / icon state for the current stage.
  const aLit = stage ? stage.scenario.sensors.zoneA : false;
  const bLit = stage ? stage.scenario.sensors.zoneB : false;
  const doorOpen = stage ? stage.scenario.sensors.door : false;
  const windowOpen = stage ? stage.scenario.sensors.window : false;
  const petLit = stage ? stage.scenario.sensors.pet : false;
  const showWindow = round.scenarios.some((s) => s.sensors.window) || round.id >= 2;
  const showPet = round.hasPetGuard;

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3 text-ink">
      <style>{`
        @keyframes g6dualzonealarm-buzz {
          0%,100% { transform: translateX(0); }
          25% { transform: translateX(-1.5px); }
          75% { transform: translateX(1.5px); }
        }
        @keyframes g6dualzonealarm-pulse {
          0%,100% { opacity: .35; }
          50% { opacity: 1; }
        }
        @keyframes g6dualzonealarm-pop {
          0% { transform: scale(.6); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .g6dza-anim { animation: none !important; }
        }
      `}</style>

      {/* ---------------- ROUND PROGRESS ---------------- */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-tech text-ink-faint">{round.title}</p>
        <div className="flex gap-1" role="img" aria-label={`Round ${roundIdx + 1} of ${ROUNDS.length}`}>
          {ROUNDS.map((r, i) => (
            <span
              key={r.id}
              className="h-1.5 w-5 rounded-full"
              style={{
                background: i < roundIdx || done ? SAFE : i === roundIdx ? ACCENT : "#1b2433",
                transition: "background .25s ease",
              }}
            />
          ))}
        </div>
      </div>

      {/* ---------------- FLOOR PLAN ---------------- */}
      <div
        className="panel relative overflow-hidden rounded-xl g6dza-anim"
        style={{
          boxShadow: done || roundWon
            ? `0 0 0 1px ${SAFE}, 0 0 24px -4px ${SAFE}`
            : liveFired && stage
              ? `0 0 0 1px ${ALARM}, 0 0 24px -4px ${ALARM}`
              : undefined,
          transition: "box-shadow .25s ease",
          animation: liveFired && stage ? "g6dualzonealarm-buzz .12s linear infinite" : undefined,
        }}
      >
        <svg
          viewBox="0 0 320 200"
          className="block h-auto w-full"
          role="img"
          aria-label="Room floor plan with motion zones, a door, a window, and a low pet sensor"
        >
          {/* room walls */}
          <rect x={10} y={10} width={300} height={180} rx={8} fill="#0b1220" stroke="#1b2433" strokeWidth={2} />

          {/* PIR A — top-left detection wedge */}
          <g opacity={aLit ? 1 : 0.5}>
            <path d="M40 28 L150 96 L40 96 Z" fill={aLit ? ACCENT : "#1b2433"} fillOpacity={aLit ? 0.28 : 0.5} stroke={aLit ? ACCENT : "#2a3441"} strokeWidth={aLit ? 1.5 : 1} />
            <circle cx={40} cy={28} r={5} fill={aLit ? ACCENT : "#475569"} />
            <text x={48} y={48} fill={aLit ? ACCENT : "#64748b"} fontSize={10} className="font-mono">PIR A</text>
          </g>

          {/* PIR B — top-right detection wedge */}
          <g opacity={bLit ? 1 : 0.5}>
            <path d="M280 28 L170 96 L280 96 Z" fill={bLit ? ACCENT : "#1b2433"} fillOpacity={bLit ? 0.28 : 0.5} stroke={bLit ? ACCENT : "#2a3441"} strokeWidth={bLit ? 1.5 : 1} />
            <circle cx={280} cy={28} r={5} fill={bLit ? ACCENT : "#475569"} />
            <text x={250} y={48} fill={bLit ? ACCENT : "#64748b"} fontSize={10} className="font-mono">PIR B</text>
          </g>

          {/* the window on the left wall (rounds 2+) */}
          {showWindow && (
            <g transform="translate(10 110)">
              <rect x={-2} y={-18} width={6} height={36} rx={2} fill={windowOpen ? ALARM : "#475569"} />
              <g transform={windowOpen ? "translate(8 0) rotate(22 0 0)" : "translate(0 0)"} style={{ transition: "transform .4s ease" }}>
                <rect x={4} y={-16} width={14} height={32} rx={2} fill="none" stroke={windowOpen ? ALARM : "#64748b"} strokeWidth={2} />
              </g>
              <text x={22} y={-22} fill={windowOpen ? ALARM : "#64748b"} fontSize={9} className="font-mono">WIN</text>
            </g>
          )}

          {/* low pet sensor strip near the floor (round 3) */}
          {showPet && (
            <g transform="translate(160 168)" opacity={petLit ? 1 : 0.55}>
              <rect x={-70} y={-3} width={140} height={6} rx={3} fill={petLit ? VIOLET : "#1b2433"} stroke={petLit ? VIOLET : "#2a3441"} strokeWidth={1} />
              <text x={0} y={-7} fill={petLit ? VIOLET : "#64748b"} fontSize={9} textAnchor="middle" className="font-mono">
                PET {petLit ? "TRIP" : "low"}
              </text>
            </g>
          )}

          {/* the door + reed switch at the bottom wall */}
          <g transform="translate(160 190)">
            <line x1={-34} y1={0} x2={-12} y2={0} stroke="#475569" strokeWidth={4} />
            <line x1={12} y1={0} x2={34} y2={0} stroke="#475569" strokeWidth={4} />
            <g transform={doorOpen ? "rotate(-58 -12 0)" : "rotate(0 -12 0)"} style={{ transition: "transform .4s ease" }}>
              <line x1={-12} y1={0} x2={12} y2={0} stroke={doorOpen ? ALARM : "#64748b"} strokeWidth={5} strokeLinecap="round" />
            </g>
            <text x={0} y={-8} fill={doorOpen ? ALARM : "#64748b"} fontSize={10} textAnchor="middle" className="font-mono">
              {doorOpen ? "DOOR OPEN" : "DOOR SHUT"}
            </text>
          </g>

          {/* the subject moving through the room */}
          {stage && (
            <text
              x={aLit ? 95 : bLit ? 225 : 160}
              y={petLit && !aLit && !bLit ? 150 : 120}
              fontSize={26}
              textAnchor="middle"
              className="g6dza-anim"
              style={{ animation: "g6dualzonealarm-pop .35s ease both" }}
            >
              {stage.scenario.glyph}
            </text>
          )}

          {/* alarm LED + buzzer, top-centre */}
          <g transform="translate(160 26)">
            <circle cx={0} cy={0} r={8} fill={liveFired && stage ? ALARM : "#1b2433"} stroke={liveFired && stage ? ALARM : "#2a3441"} strokeWidth={1.5} className="g6dza-anim" style={{ animation: liveFired && stage ? "g6dualzonealarm-pulse .4s ease infinite" : undefined }} />
            <text x={0} y={3} fontSize={10} textAnchor="middle">{liveFired && stage ? "🔔" : "🔕"}</text>
          </g>
        </svg>

        {/* in-canvas status / verdict overlay */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-3 py-1.5">
          <span className="font-mono text-[11px] text-ink-dim">{stage ? stage.scenario.label : "Idle"}</span>
          {stage && (
            <span
              className="font-mono text-[11px] font-bold uppercase tracking-tech"
              style={{ color: liveFired ? ALARM : SAFE }}
            >
              {liveFired ? "ALARM" : "SAFE"}
            </span>
          )}
        </div>
      </div>

      {/* ---------------- LOGIC BUILDER ---------------- */}
      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-[11px] uppercase tracking-tech text-ink-faint">
          Wire the alarm rule
        </p>
        <div
          className="flex flex-wrap items-center justify-center gap-1.5 rounded-lg border border-line bg-panel/60 p-3 font-mono text-xs"
          role="group"
          aria-label="Alarm logic rule builder"
        >
          {round.pieces.map((p, idx) => {
            if (p.kind === "paren") {
              return (
                <span key={idx} className="text-ink-faint">
                  {p.text}
                </span>
              );
            }
            if (p.kind === "chip") {
              return <Chip key={idx} label={p.label} tone={p.tone} />;
            }
            if (p.kind === "guard") {
              return (
                <GuardGem
                  key={idx}
                  on={petGuard}
                  disabled={running}
                  onToggle={toggleGuard}
                  ariaLabel={p.aria}
                />
              );
            }
            return (
              <OpGem
                key={idx}
                value={ops[p.slot]}
                disabled={running}
                onChange={(v) => setOperator(p.slot, v)}
                ariaLabel={p.aria}
              />
            );
          })}
        </div>
        <p className="text-center font-mono text-[11px] text-ink-faint">
          Rule fires the alarm when this is <span style={{ color: ACCENT }}>true</span>.
        </p>
      </div>

      {/* ---------------- SCOREBOARD ---------------- */}
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${round.scenarios.length}, minmax(0, 1fr))` }}
        role="list"
        aria-label="Test case results"
      >
        {round.scenarios.map((s, i) => {
          const r = results[i];
          const isActive = running && active === i;
          const bg =
            r === undefined
              ? "#0b1220"
              : r.verdict === "ok"
                ? "rgba(52,211,153,.18)"
                : "rgba(248,113,113,.2)";
          const border =
            r === undefined ? "#1b2433" : r.verdict === "ok" ? SAFE : ALARM;
          const mark = r === undefined ? "" : r.verdict === "ok" ? "✓" : r.verdict === "false-alarm" ? "false!" : "missed";
          return (
            <div
              key={s.id}
              role="listitem"
              aria-label={`Case ${s.id}: ${r === undefined ? "not run" : r.verdict === "ok" ? "correct" : r.verdict}`}
              className="flex flex-col items-center gap-0.5 rounded-md py-1.5"
              style={{
                background: bg,
                border: `1px solid ${border}`,
                outline: isActive ? `2px solid ${ACCENT}` : undefined,
                transition: "background .2s ease, border-color .2s ease",
              }}
            >
              <span className="text-base" aria-hidden>
                {s.glyph}
              </span>
              <span
                className="font-mono text-[9px] font-bold uppercase"
                style={{ color: r === undefined ? "#475569" : r.verdict === "ok" ? SAFE : ALARM }}
              >
                {mark || "·"}
              </span>
            </div>
          );
        })}
      </div>

      {/* live tally */}
      <div className="flex items-center justify-center gap-4 font-mono text-[11px] text-ink-faint">
        <span>
          Caught:{" "}
          <span style={{ color: caught === realCount && ranFully ? SAFE : ACCENT }}>
            {caught}/{realCount}
          </span>
        </span>
        <span>
          False alarms:{" "}
          <span style={{ color: falseAlarms === 0 ? SAFE : ALARM }}>{falseAlarms}</span>
        </span>
      </div>

      {/* ---------------- STATUS + CONTROLS ---------------- */}
      <div
        role="status"
        aria-live="polite"
        className="rounded-lg px-3 py-2 text-center font-mono text-xs"
        style={{
          background: done || roundWon ? "rgba(52,211,153,.12)" : "rgba(34,211,238,.06)",
          color: done || roundWon ? SAFE : "var(--color-ink-dim, #9aa6b2)",
          border: `1px solid ${done || roundWon ? SAFE : "#1b2433"}`,
        }}
      >
        {done ? <span className="font-bold">🎉 {status}</span> : status}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-ink-faint">Runs: {tries}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={resetRound}
            disabled={running || done}
            className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim disabled:opacity-60"
            aria-label="Reset this round's rule and scoreboard"
          >
            Reset
          </button>
          {roundWon && !done ? (
            <button
              type="button"
              onClick={advanceRound}
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: SAFE, color: "#05070d" }}
              aria-label="Go to the next round"
            >
              Next round ➡️
            </button>
          ) : (
            <button
              type="button"
              onClick={runTests}
              disabled={running || done}
              className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
              style={{ background: ACCENT, color: "#05070d" }}
              aria-label="Run all test cases for this round"
            >
              {running ? "Testing…" : done ? "Solved 🎉" : "Run Tests ▶"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small presentational helpers                                       */
/* ------------------------------------------------------------------ */

function Chip({ label, tone }: { label: string; tone: string }): React.JSX.Element {
  return (
    <span
      className="rounded-md px-2 py-1 font-mono text-xs"
      style={{ background: "rgba(255,255,255,.04)", color: tone, border: `1px solid ${tone}55` }}
    >
      {label}
    </span>
  );
}

function OpGem({
  value,
  disabled,
  onChange,
  ariaLabel,
}: {
  value: Op;
  disabled: boolean;
  onChange: (v: Op) => void;
  ariaLabel: string;
}): React.JSX.Element {
  const next: Op = value === "AND" ? "OR" : "AND";
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${ariaLabel}: currently ${value}, tap to switch to ${next}`}
      onPointerDown={(e) => {
        e.preventDefault();
        if (!disabled) onChange(next);
      }}
      className="rounded-md px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-tech transition disabled:opacity-60"
      style={{
        background: value === "AND" ? ACCENT : VIOLET,
        color: "#05070d",
        touchAction: "manipulation",
      }}
    >
      {value}
    </button>
  );
}

function GuardGem({
  on,
  disabled,
  onToggle,
  ariaLabel,
}: {
  on: boolean;
  disabled: boolean;
  onToggle: () => void;
  ariaLabel: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={on}
      aria-label={`${ariaLabel}: ${on ? "on, the pet is ignored" : "off, tap to ignore the pet"}`}
      onPointerDown={(e) => {
        e.preventDefault();
        if (!disabled) onToggle();
      }}
      className="rounded-md px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-tech transition disabled:opacity-60"
      style={{
        background: on ? AMBER : "rgba(255,255,255,.06)",
        color: on ? "#05070d" : "#64748b",
        border: on ? "none" : "1px solid #2a3441",
        touchAction: "manipulation",
      }}
    >
      {on ? "🚫 PET" : "🚫 off"}
    </button>
  );
}
