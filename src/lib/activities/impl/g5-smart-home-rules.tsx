"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Smart Home Control Center 🏠 ──────────────────────────────────────────────
   GRADE 5 (explorer, age ~10–11). Subject: ROBOTICS.
   ONE learning goal: AUTOMATION WITH IF–THEN RULES — a smart home links each
   sensor TRIGGER (the IF) to a relay ACTION (the THEN). The learner wires three
   rooms by dropping a trigger chip into each IF slot and an action chip into each
   THEN slot, then presses Run Day to step a clock through scripted scenarios and
   watch each appliance fire ONLY when its rule's condition is true.

   This is now a real PROBLEM, not a guess-the-pair toy. THREE escalating rounds:

   ROUND 1 · LEARN  — clean 1-to-1 wiring (motion→lamp, dark→night, hot→fan).
                      Teaches the mechanic.
   ROUND 2 · READ THE DATA — the tray now hides DECOY triggers with the wrong
                      THRESHOLD ("brightness < 60", "temp > 20") that look right
                      but fire at the wrong moments. Brute force fails: you must
                      read the day's sensor numbers and pick the threshold that
                      fires EXACTLY when the appliance should. Plus one room needs
                      a COMPOUND idea — the fan must run only when it's hot AND
                      someone's home, so an empty room doesn't waste power.
   ROUND 3 · DEBUG  — the rooms arrive PRE-WIRED with one sabotaged trigger.
                      Find the buggy room, swap in the right chip, re-run.

   OPTIMIZATION → STARS: clean play earns 3⭐. Each failed Run Day in a round
   costs a star (floor 1⭐). A clean three-round sweep = ⭐⭐⭐.

   Everything is pure + deterministic (no randomness, no clock reads in grading),
   always winnable, and never scolds — a mis-wired appliance shows a red X and a
   kind, targeted hint, and the lab is always recoverable.
   ──────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#34d399";
const DANGER = "#f87171";

type RoomId = "hall" | "living" | "bed";
type ActId = "lamp" | "night" | "fan";
/** Every trigger chip in the game (across all rounds). Some are DECOYS. */
type CondId =
  | "motion"
  | "noMotion"
  | "darkLt30"
  | "darkLt60"
  | "hotGt30"
  | "hotGt20"
  | "hotAndHome";

interface Reading {
  motion: boolean;
  bright: number;
  temp: number;
}

interface Scenario {
  name: string;
  clock: string;
  sense: Record<RoomId, Reading>;
}

interface CondDef {
  id: CondId;
  label: string;
  glyph: string;
  /** Does this trigger fire for the given room reading? Pure. */
  test: (s: Reading) => boolean;
}

const CONDS: readonly CondDef[] = [
  { id: "motion", label: "motion = yes", glyph: "🏃", test: (s) => s.motion },
  { id: "noMotion", label: "motion = no", glyph: "🚫", test: (s) => !s.motion },
  { id: "darkLt30", label: "brightness < 30", glyph: "🌙", test: (s) => s.bright < 30 },
  { id: "darkLt60", label: "brightness < 60", glyph: "🌗", test: (s) => s.bright < 60 },
  { id: "hotGt30", label: "temp > 30°C", glyph: "🔥", test: (s) => s.temp > 30 },
  { id: "hotGt20", label: "temp > 20°C", glyph: "🌡️", test: (s) => s.temp > 20 },
  {
    id: "hotAndHome",
    label: "temp > 30°C AND someone home",
    glyph: "🔥🏠",
    test: (s) => s.temp > 30 && s.motion,
  },
];

const condDef = (id: CondId): CondDef => CONDS.find((c) => c.id === id) as CondDef;

interface ActDef {
  id: ActId;
  label: string;
  glyph: string;
}
const ACTS: readonly ActDef[] = [
  { id: "lamp", label: "lamp ON", glyph: "💡" },
  { id: "night", label: "night-light ON", glyph: "🔦" },
  { id: "fan", label: "fan ON", glyph: "🌀" },
];
const actDef = (id: ActId): ActDef => ACTS.find((a) => a.id === id) as ActDef;

interface RoomDef {
  id: RoomId;
  name: string;
  appliance: ActId;
}
const ROOMS: readonly RoomDef[] = [
  { id: "hall", name: "Hallway", appliance: "lamp" },
  { id: "living", name: "Living Room", appliance: "night" },
  { id: "bed", name: "Bedroom", appliance: "fan" },
];

/** What the learner has dropped into each room's IF and THEN slot. */
interface Rule {
  cond: CondId | null;
  act: ActId | null;
}
type Rules = Record<RoomId, Rule>;

interface RoundDef {
  title: string;
  brief: string;
  scenarios: readonly Scenario[];
  /** Trigger chips offered in the tray this round (order shown). */
  condTray: readonly CondId[];
  /** Action chips offered in the tray this round. */
  actTray: readonly ActId[];
  /** The one correct trigger per room for THIS round's data. */
  answer: Record<RoomId, CondId>;
  /** Optional starting wiring (debug round arrives pre-wired). */
  preset?: Rules;
}

const EMPTY: Rules = {
  hall: { cond: null, act: null },
  living: { cond: null, act: null },
  bed: { cond: null, act: null },
};

/* ── ROUND 1 · LEARN — clean 1-to-1, classic wiring ─────────────────────────── */
const R1_SCN: readonly Scenario[] = [
  {
    name: "Someone walks in",
    clock: "08:00",
    sense: {
      hall: { motion: true, bright: 70, temp: 23 },
      living: { motion: false, bright: 72, temp: 23 },
      bed: { motion: false, bright: 68, temp: 24 },
    },
  },
  {
    name: "Evening dims the rooms",
    clock: "19:30",
    sense: {
      hall: { motion: false, bright: 26, temp: 22 },
      living: { motion: false, bright: 18, temp: 22 },
      bed: { motion: false, bright: 24, temp: 23 },
    },
  },
  {
    name: "Hot afternoon",
    clock: "15:00",
    sense: {
      hall: { motion: false, bright: 88, temp: 33 },
      living: { motion: false, bright: 85, temp: 31 },
      bed: { motion: false, bright: 80, temp: 36 },
    },
  },
  {
    name: "All-quiet night",
    clock: "03:00",
    sense: {
      hall: { motion: false, bright: 40, temp: 21 },
      living: { motion: false, bright: 45, temp: 20 },
      bed: { motion: false, bright: 42, temp: 21 },
    },
  },
];

/* ── ROUND 2 · READ THE DATA — decoy thresholds + a compound rule ────────────
   Living-room night-light must come on ONLY in the two real-dark moments
   (bright 18 & 24). Decoy "brightness < 60" also fires at bright 45 → wrong.
   Bedroom fan must run ONLY when hot AND someone is home. There's a hot moment
   with an EMPTY bedroom (no one there) — plain "temp > 30" would waste power, so
   only "temp > 30 AND someone home" is correct. Decoy "temp > 20" fires always. */
const R2_SCN: readonly Scenario[] = [
  {
    name: "Morning rush",
    clock: "07:30",
    sense: {
      hall: { motion: true, bright: 65, temp: 22 },
      living: { motion: false, bright: 24, temp: 22 },
      bed: { motion: true, bright: 70, temp: 33 }, // hot AND someone home → fan
    },
  },
  {
    name: "Empty house, sun blazing",
    clock: "13:00",
    sense: {
      hall: { motion: false, bright: 90, temp: 31 },
      living: { motion: false, bright: 88, temp: 31 },
      bed: { motion: false, bright: 85, temp: 34 }, // HOT but NOBODY home → fan stays OFF
    },
  },
  {
    name: "Cloudy dusk",
    clock: "18:45",
    sense: {
      hall: { motion: false, bright: 45, temp: 24 }, // dim, but NOT < 30 → night-light OFF
      living: { motion: false, bright: 45, temp: 24 },
      bed: { motion: true, bright: 50, temp: 26 }, // someone home but COOL → fan OFF (defeats plain "motion")
    },
  },
  {
    name: "Family home, lights low",
    clock: "21:15",
    sense: {
      hall: { motion: true, bright: 18, temp: 28 },
      living: { motion: false, bright: 18, temp: 28 }, // truly dark → night-light ON
      bed: { motion: true, bright: 40, temp: 33 }, // hot AND home → fan ON
    },
  },
];

/* ── ROUND 3 · DEBUG — pre-wired, one sabotaged trigger (Living Room) ────────
   Hallway & Bedroom are wired right. Living-room IF is the DECOY "brightness<60",
   which wrongly fires the night-light at bright 50. Learner must swap to "< 30". */
const R3_SCN: readonly Scenario[] = [
  {
    name: "Bright noon",
    clock: "12:00",
    sense: {
      hall: { motion: false, bright: 95, temp: 29 },
      living: { motion: false, bright: 95, temp: 29 },
      bed: { motion: false, bright: 90, temp: 33 }, // hot, no one home → fan ON (it's a temp rule, not presence)
    },
  },
  {
    name: "Half-light hallway",
    clock: "17:30",
    sense: {
      hall: { motion: true, bright: 50, temp: 27 },
      living: { motion: false, bright: 50, temp: 27 }, // bright 50: <60 fires (BUG), <30 does not
      bed: { motion: false, bright: 48, temp: 30 },
    },
  },
  {
    name: "Lights out",
    clock: "23:00",
    sense: {
      hall: { motion: false, bright: 20, temp: 24 },
      living: { motion: false, bright: 20, temp: 24 }, // truly dark → night-light SHOULD be ON
      bed: { motion: true, bright: 22, temp: 33 },
    },
  },
];

const R3_PRESET: Rules = {
  hall: { cond: "motion", act: "lamp" },
  living: { cond: "darkLt60", act: "night" }, // ← the planted bug
  bed: { cond: "hotGt30", act: "fan" },
};

const ROUNDS: readonly RoundDef[] = [
  {
    title: "Round 1 · Learn the wiring",
    brief: "Wire each room: drop a TRIGGER in IF and the matching APPLIANCE in THEN.",
    scenarios: R1_SCN,
    condTray: ["motion", "darkLt30", "hotGt30"],
    actTray: ["lamp", "night", "fan"],
    answer: { hall: "motion", living: "darkLt30", bed: "hotGt30" },
  },
  {
    title: "Round 2 · Read the data",
    brief:
      "Trick triggers are mixed in! Read the day's numbers and pick the one that fires at EXACTLY the right moments.",
    scenarios: R2_SCN,
    condTray: ["motion", "darkLt30", "darkLt60", "hotGt30", "hotGt20", "hotAndHome"],
    actTray: ["lamp", "night", "fan"],
    answer: { hall: "motion", living: "darkLt30", bed: "hotAndHome" },
  },
  {
    title: "Round 3 · Debug the home",
    brief:
      "This home is pre-wired but ONE room misbehaves. Run it, watch the red X, then swap the buggy trigger.",
    scenarios: R3_SCN,
    condTray: ["motion", "darkLt30", "darkLt60", "hotGt30"],
    actTray: ["lamp", "night", "fan"],
    answer: { hall: "motion", living: "darkLt30", bed: "hotGt30" },
    preset: R3_PRESET,
  },
];

type Phase = "idle" | "running" | "roundWon" | "won";
type Drag = { kind: "cond"; id: CondId } | { kind: "act"; id: ActId } | null;

const cloneRules = (r: Rules): Rules => ({
  hall: { ...r.hall },
  living: { ...r.living },
  bed: { ...r.bed },
});

export default function SmartHomeRules({ onComplete }: ActivityProps) {
  const [roundIdx, setRoundIdx] = useState<number>(0);
  const [rules, setRules] = useState<Rules>(cloneRules(ROUNDS[0].preset ?? EMPTY));
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState<number>(-1);
  const [drag, setDrag] = useState<Drag>(null);
  const [hint, setHint] = useState<string>("");
  /** Stars spent: each failed Run Day this whole game drops a star (floor 1). */
  const [stars, setStars] = useState<3 | 2 | 1>(3);

  const round = ROUNDS[roundIdx];
  const scenarios = round.scenarios;

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reportedRef = useRef<boolean>(false);

  const clearTimers = useCallback((): void => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  }, []);
  useEffect(() => () => clearTimers(), [clearTimers]);

  const running = phase === "running";
  const won = phase === "won";
  const roundWon = phase === "roundWon";

  // Chips already placed are removed from the tray (each used once per round).
  const usedConds = useMemo<Set<CondId>>(() => {
    const s = new Set<CondId>();
    for (const r of ROOMS) {
      const c = rules[r.id].cond;
      if (c) s.add(c);
    }
    return s;
  }, [rules]);
  const usedActs = useMemo<Set<ActId>>(() => {
    const s = new Set<ActId>();
    for (const r of ROOMS) {
      const a = rules[r.id].act;
      if (a) s.add(a);
    }
    return s;
  }, [rules]);

  const allFilled = ROOMS.every((r) => rules[r.id].cond && rules[r.id].act);

  /** Does a room respond correctly across ALL scenarios in this round? Pure. */
  const roomCorrect = useCallback(
    (room: RoomDef): boolean => {
      const rule = rules[room.id];
      if (!rule.cond || !rule.act) return false;
      if (rule.act !== room.appliance) return false; // wrong appliance
      const want = round.answer[room.id];
      // Verify by simulation: chosen trigger must reproduce the intended on/off
      // pattern across the whole day. (Equivalent to cond === want, but checked
      // against data so decoys are caught structurally.)
      const wantDef = condDef(want);
      const gotDef = condDef(rule.cond);
      for (const scn of scenarios) {
        const reading = scn.sense[room.id];
        if (gotDef.test(reading) !== wantDef.test(reading)) return false;
      }
      return true;
    },
    [rules, round, scenarios],
  );

  const allCorrect = useMemo(() => ROOMS.every((r) => roomCorrect(r)), [roomCorrect]);

  // Live per-room appliance state during the run (what the wiring actually does).
  const fired = useMemo<Record<RoomId, boolean>>(() => {
    const out: Record<RoomId, boolean> = { hall: false, living: false, bed: false };
    if (step < 0 || step >= scenarios.length) return out;
    const scn = scenarios[step];
    for (const r of ROOMS) {
      const rule = rules[r.id];
      if (rule.cond && rule.act && rule.act === r.appliance) {
        out[r.id] = condDef(rule.cond).test(scn.sense[r.id]);
      }
    }
    return out;
  }, [step, rules, scenarios]);

  // Which rooms are MIS-behaving at the current step (fire when they shouldn't,
  // stay off when they should, or drive the wrong appliance).
  const wrong = useMemo<Record<RoomId, boolean>>(() => {
    const out: Record<RoomId, boolean> = { hall: false, living: false, bed: false };
    if (step < 0) return out;
    const scn = scenarios[step];
    for (const r of ROOMS) {
      const rule = rules[r.id];
      if (!rule.cond || !rule.act) continue;
      const correctAct = rule.act === r.appliance;
      const should = condDef(round.answer[r.id]).test(scn.sense[r.id]);
      const actually = correctAct && condDef(rule.cond).test(scn.sense[r.id]);
      if (actually !== should || !correctAct) out[r.id] = true;
    }
    return out;
  }, [step, rules, scenarios, round]);

  const loadRound = useCallback((idx: number): void => {
    clearTimers();
    setRoundIdx(idx);
    setRules(cloneRules(ROUNDS[idx].preset ?? EMPTY));
    setPhase("idle");
    setStep(-1);
    setDrag(null);
    setHint("");
  }, [clearTimers]);

  const finishGame = useCallback(
    (finalStars: 3 | 2 | 1): void => {
      setPhase("won");
      setHint("");
      if (!reportedRef.current) {
        reportedRef.current = true;
        const detail =
          finalStars === 3
            ? "Flawless! You learned, read the data, and debugged the home. ✨"
            : finalStars === 2
              ? "Smart home online — solved with a couple of test runs. ✨"
              : "Home is smart! You got every room responding correctly. ✨";
        onComplete({ passed: true, stars: finalStars, detail });
      }
    },
    [onComplete],
  );

  // Targeted, kind nudge for the first mis-wired room (never the exact answer).
  const buildHint = useCallback((): string => {
    const broken = ROOMS.find((r) => !roomCorrect(r));
    if (!broken) return "Almost — re-check each room.";
    const rule = rules[broken.id];
    if (rule.act && rule.act !== broken.appliance) {
      return `${broken.name}: wrong appliance in THEN — match the room to its device.`;
    }
    if (broken.appliance === "fan") {
      return roundIdx >= 1
        ? "The fan wastes power in an EMPTY hot room. It should run only when it's hot AND someone's home. 🔥🏠"
        : "The fan should turn on when it's HOT. 🔥";
    }
    if (broken.appliance === "night") {
      return roundIdx >= 1
        ? "Check the numbers: the night-light fired when a room was only dim, not truly dark. Pick a tighter brightness limit. 🌙"
        : "The night-light should turn on when it's DARK. 🌙";
    }
    return "The lamp should turn on when there's MOTION. 🏃";
  }, [roomCorrect, rules, roundIdx]);

  const runDay = useCallback((): void => {
    if (running) return;
    clearTimers();
    setHint("");
    setPhase("running");
    setStep(0);
    const STEP_MS = 900;
    for (let i = 1; i < scenarios.length; i += 1) {
      const t = setTimeout(() => setStep(i), i * STEP_MS);
      timersRef.current.push(t);
    }
    const endT = setTimeout(() => {
      if (allCorrect) {
        if (roundIdx === ROUNDS.length - 1) {
          finishGame(stars);
        } else {
          setPhase("roundWon");
          setHint("");
        }
      } else {
        setPhase("idle");
        setStep(-1);
        setStars((s) => (s > 1 ? ((s - 1) as 3 | 2 | 1) : 1)); // cost a star, floor 1
        setHint(buildHint());
        // NOTE: do NOT report onComplete(false) — gentle retry only.
      }
    }, scenarios.length * STEP_MS);
    timersRef.current.push(endT);
  }, [running, clearTimers, scenarios, allCorrect, roundIdx, finishGame, stars, buildHint]);

  const reset = useCallback((): void => {
    loadRound(roundIdx);
  }, [loadRound, roundIdx]);

  const nextRound = useCallback((): void => {
    if (roundIdx < ROUNDS.length - 1) loadRound(roundIdx + 1);
  }, [roundIdx, loadRound]);

  // ── Drag + drop (pointer-first; tap a chip then tap a slot also works) ──────
  const dropInto = useCallback(
    (room: RoomId, slot: "cond" | "act"): void => {
      if (!drag || running) return;
      if (slot === "cond" && drag.kind === "cond") {
        setRules((prev) => ({ ...prev, [room]: { ...prev[room], cond: drag.id } }));
        setHint("");
      } else if (slot === "act" && drag.kind === "act") {
        setRules((prev) => ({ ...prev, [room]: { ...prev[room], act: drag.id } }));
        setHint("");
      }
      setDrag(null);
    },
    [drag, running],
  );

  const clearSlot = useCallback(
    (room: RoomId, slot: "cond" | "act"): void => {
      if (running) return;
      setRules((prev) => ({ ...prev, [room]: { ...prev[room], [slot]: null } }));
      setHint("");
    },
    [running],
  );

  const pickChip = useCallback(
    (d: NonNullable<Drag>): void => {
      if (running) return;
      setDrag((cur) => (cur && cur.kind === d.kind && cur.id === d.id ? null : d));
    },
    [running],
  );

  const scn = step >= 0 && step < scenarios.length ? scenarios[step] : null;

  const status = useMemo<string>(() => {
    if (won) return "Home is smart! Every room responded correctly all game. ⭐";
    if (roundWon) return "Round solved! Press Next Round for a tougher home.";
    if (running && scn) return `Running ${scn.clock} — ${scn.name}. Watch each appliance.`;
    if (hint) return hint;
    if (!allFilled) return round.brief;
    return "Rules are wired. Press Run Day to test them across the whole day.";
  }, [won, roundWon, running, scn, hint, allFilled, round]);

  const availConds = round.condTray.filter((id) => !usedConds.has(id));
  const availActs = round.actTray.filter((id) => !usedActs.has(id));

  return (
    <div className="flex w-full max-w-[440px] flex-col items-center gap-3 font-mono text-ink">
      {/* ── Status pill ── */}
      <div
        className="flex w-full items-center justify-center gap-2 rounded-full px-3 py-1.5 text-center text-sm"
        role="status"
        aria-live="polite"
        aria-label={status}
        style={{
          background: won ? "rgba(52,211,153,0.16)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${won || roundWon ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: won ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true">🏠</span>
        {won ? (
          <span aria-hidden="true" className="text-lg">
            {stars === 3 ? "⭐⭐⭐" : stars === 2 ? "⭐⭐" : "⭐"}
          </span>
        ) : (
          <span aria-hidden="true" className="text-[12px] leading-tight text-ink-dim">
            {running && scn ? `${scn.clock} · ${scn.name}` : `Round ${roundIdx + 1}/${ROUNDS.length}`}
          </span>
        )}
        {won && <span aria-hidden="true">✨</span>}
      </div>

      {/* ── Round title + live star meter ── */}
      <div className="flex w-full items-center justify-between gap-2 px-0.5">
        <span className="text-[12px] font-bold" style={{ color: roundWon || won ? ACCENT : "var(--color-ink-dim, #9aa6b2)" }}>
          {won ? "Smart Home complete!" : round.title}
        </span>
        <span className="text-[12px] tabular-nums text-ink-faint" aria-label={`Stars remaining: ${stars} of 3`}>
          <span aria-hidden="true">
            {"⭐".repeat(stars)}
            {"·".repeat(3 - stars)}
          </span>
        </span>
      </div>

      {/* ── Cutaway house: 3 rooms with live sensors + appliances ── */}
      <div
        className="panel w-full overflow-hidden rounded-2xl border p-2"
        style={{
          borderColor: won || roundWon ? ACCENT : "var(--color-line, #33405c)",
          boxShadow: won ? `0 0 0 1px ${ACCENT}, 0 0 22px -4px ${ACCENT}` : undefined,
          transition: "box-shadow .3s ease, border-color .3s ease",
        }}
      >
        <svg
          viewBox="0 0 360 240"
          className="block w-full select-none"
          role="img"
          aria-label="A cutaway house with three rooms, each showing a sensor reading and an appliance"
        >
          {/* roof */}
          <polygon points="20,72 180,18 340,72" fill="#2b3550" stroke="#3a4866" strokeWidth={2} />
          {/* house body */}
          <rect x={28} y={72} width={304} height={156} rx={4} fill="#1a2236" stroke="#3a4866" strokeWidth={2} />

          {ROOMS.map((room, i) => {
            const y = 72 + i * 52;
            const live = scn ? scn.sense[room.id] : null;
            const on = fired[room.id];
            const bad = wrong[room.id] && running;
            const ad = actDef(room.appliance);
            // sensor blurb shown in-room: in rounds 2+, every room shows ALL three
            // readings so the learner can reason about thresholds + presence.
            const reading = live
              ? roundIdx >= 1
                ? `${live.motion ? "👤" : "—"} ${live.bright}% ${live.temp}°`
                : room.id === "hall"
                  ? live.motion
                    ? "person"
                    : "no one"
                  : room.id === "living"
                    ? `${live.bright}% light`
                    : `${live.temp}°C`
              : room.id === "hall"
                ? "motion"
                : room.id === "living"
                  ? "light"
                  : "temp";
            const sensorGlyph = room.id === "hall" ? "🚶" : room.id === "living" ? "🔆" : "🌡️";
            return (
              <g key={room.id}>
                {i > 0 && <line x1={28} y1={y} x2={332} y2={y} stroke="#3a4866" strokeWidth={1.4} />}
                {/* room label */}
                <text x={40} y={y + 16} fontSize={9} fill="rgba(160,180,205,0.85)">
                  {room.name}
                </text>
                {/* sensor reading */}
                <text x={40} y={y + 34} fontSize={11} aria-hidden="true">
                  {sensorGlyph}
                </text>
                <text x={56} y={y + 35} fontSize={9} fill="#9aa6b2" className="tabular-nums">
                  {reading}
                </text>

                {/* appliance — glows green when correctly ON */}
                <g transform={`translate(290 ${y + 28})`}>
                  <circle
                    r={17}
                    fill={on ? `${ACCENT}22` : "rgba(255,255,255,0.03)"}
                    stroke={bad ? DANGER : on ? ACCENT : "#3a4866"}
                    strokeWidth={1.8}
                    style={{
                      filter: on && !bad ? `drop-shadow(0 0 7px ${ACCENT}cc)` : undefined,
                      transition: "all .2s ease",
                    }}
                  />
                  <text
                    x={0}
                    y={0}
                    fontSize={18}
                    textAnchor="middle"
                    dominantBaseline="central"
                    aria-hidden="true"
                    style={{
                      transformOrigin: "center",
                      animation:
                        on && room.appliance === "fan" && !bad
                          ? "g5smarthomerules-spin 0.8s linear infinite"
                          : undefined,
                      opacity: on ? 1 : 0.45,
                    }}
                  >
                    {ad.glyph}
                  </text>
                  {/* red X over a mis-firing appliance */}
                  {bad && (
                    <g stroke={DANGER} strokeWidth={2.4} strokeLinecap="round">
                      <line x1={-9} y1={-9} x2={9} y2={9} />
                      <line x1={9} y1={-9} x2={-9} y2={9} />
                    </g>
                  )}
                  {/* green check when this room is verified correct on a win */}
                  {(won || roundWon) && roomCorrect(room) && (
                    <text x={14} y={-12} fontSize={11} aria-hidden="true">
                      ✅
                    </text>
                  )}
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Rule-builder rack: 3 IF [__] THEN [__] rows ── */}
      <div className="panel flex w-full flex-col gap-2 rounded-xl p-3">
        {ROOMS.map((room) => {
          const rule = rules[room.id];
          const ok = (won || roundWon) && roomCorrect(room);
          return (
            <div
              key={room.id}
              className="flex flex-wrap items-center gap-1.5 rounded-lg border p-2 text-xs"
              style={{
                borderColor: ok ? ACCENT : "var(--color-line, #33405c)",
                background: ok ? "rgba(52,211,153,0.08)" : "rgba(255,255,255,0.02)",
              }}
            >
              <span className="w-[68px] shrink-0 text-ink-dim">{room.name}</span>
              <span className="text-ink-faint">IF</span>
              <Slot
                filled={rule.cond ? condDef(rule.cond) : null}
                accepts="cond"
                drag={drag}
                disabled={running}
                onDrop={() => dropInto(room.id, "cond")}
                onClear={() => clearSlot(room.id, "cond")}
                label={`IF slot for ${room.name}`}
              />
              <span className="text-ink-faint">THEN</span>
              <Slot
                filled={rule.act ? actDef(rule.act) : null}
                accepts="act"
                drag={drag}
                disabled={running}
                onDrop={() => dropInto(room.id, "act")}
                onClear={() => clearSlot(room.id, "act")}
                label={`THEN slot for ${room.name}`}
              />
            </div>
          );
        })}

        {/* chip trays */}
        <div className="mt-1 flex flex-col gap-2">
          <ChipTray
            title="Triggers (IF)"
            kind="cond"
            chips={availConds.map((id) => {
              const c = condDef(id);
              return { id: c.id, label: c.label, glyph: c.glyph };
            })}
            drag={drag}
            disabled={running}
            onPick={(id) => pickChip({ kind: "cond", id: id as CondId })}
          />
          <ChipTray
            title="Actions (THEN)"
            kind="act"
            chips={availActs.map((id) => {
              const a = actDef(id);
              return { id: a.id, label: a.label, glyph: a.glyph };
            })}
            drag={drag}
            disabled={running}
            onPick={(id) => pickChip({ kind: "act", id: id as ActId })}
          />
        </div>

        {/* coaching / status line (never the exact answer) */}
        <p
          className="min-h-[28px] text-[11px] leading-tight"
          aria-hidden="true"
          style={{ color: hint ? DANGER : won || roundWon ? ACCENT : "var(--color-ink-faint, #7c8aa0)" }}
        >
          {status}
        </p>

        {/* ── Controls: Run Day / Next Round · Reset ── */}
        <div className="mt-1 flex items-stretch gap-2">
          {roundWon ? (
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                nextRound();
              }}
              aria-label="Next round — a tougher smart home"
              className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-2xl text-base font-bold transition active:scale-95"
              style={{
                touchAction: "none",
                background: ACCENT,
                color: "#04130d",
                boxShadow: "0 5px 0 0 #15916a",
              }}
            >
              <span aria-hidden="true">➡️</span>
              <span aria-hidden="true" className="font-extrabold tracking-wide">
                NEXT ROUND
              </span>
            </button>
          ) : (
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                runDay();
              }}
              disabled={running || !allFilled || won}
              aria-label="Run Day — step the clock through the day and test every rule"
              className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-2xl text-base font-bold transition active:scale-95 disabled:opacity-40"
              style={{
                touchAction: "none",
                background: ACCENT,
                color: "#04130d",
                boxShadow: "0 5px 0 0 #15916a",
              }}
            >
              <span aria-hidden="true">{running ? "⏱" : "▶"}</span>
              <span aria-hidden="true" className="font-extrabold tracking-wide">
                {running ? "RUNNING…" : "RUN DAY"}
              </span>
            </button>
          )}
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              reset();
            }}
            disabled={running || won}
            aria-label="Reset this round's rules"
            className="grid h-[50px] w-[50px] place-items-center rounded-2xl text-xl transition active:scale-90 disabled:opacity-40"
            style={{
              touchAction: "none",
              background: "rgba(255,255,255,0.05)",
              border: "2px solid var(--color-line, #33405c)",
            }}
          >
            <span aria-hidden="true">🔄</span>
          </button>
        </div>
      </div>

      {/* celebratory floaters */}
      {won && (
        <div className="pointer-events-none flex justify-center gap-2 text-2xl">
          <span className="animate-float" aria-hidden="true">
            ✨
          </span>
          <span className="animate-float" style={{ animationDelay: "0.2s" }} aria-hidden="true">
            🎉
          </span>
          <span className="animate-float" style={{ animationDelay: "0.4s" }} aria-hidden="true">
            ✨
          </span>
        </div>
      )}

      <style>{`
        @keyframes g5smarthomerules-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes g5smarthomerules-pulse {
          0%, 100% { box-shadow: 0 0 0 0 ${ACCENT}66; }
          50% { box-shadow: 0 0 0 4px ${ACCENT}11; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

/* ── A single IF or THEN drop slot ─────────────────────────────────────────── */
interface ChipLook {
  glyph: string;
  label: string;
}
function Slot({
  filled,
  accepts,
  drag,
  disabled,
  onDrop,
  onClear,
  label,
}: {
  filled: ChipLook | null;
  accepts: "cond" | "act";
  drag: Drag;
  disabled: boolean;
  onDrop: () => void;
  onClear: () => void;
  label: string;
}) {
  const armed = !!drag && drag.kind === accepts && !disabled;
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        if (disabled) return;
        if (filled) onClear();
        else onDrop();
      }}
      aria-label={filled ? `${label}: ${filled.label}. Tap to clear.` : `${label}: empty`}
      className="flex min-w-[96px] items-center gap-1 rounded-md border px-2 py-1 transition"
      style={{
        borderColor: filled ? ACCENT : armed ? ACCENT : "var(--color-line, #33405c)",
        background: filled ? "rgba(52,211,153,0.14)" : "rgba(255,255,255,0.02)",
        borderStyle: filled ? "solid" : "dashed",
        animation: armed && !filled ? "g5smarthomerules-pulse 1s ease-in-out infinite" : undefined,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {filled ? (
        <>
          <span aria-hidden="true">{filled.glyph}</span>
          <span style={{ color: ACCENT }}>{filled.label}</span>
        </>
      ) : (
        <span className="text-ink-faint">{armed ? "drop here" : "[ empty ]"}</span>
      )}
    </button>
  );
}

/* ── A tray of draggable chips ─────────────────────────────────────────────── */
function ChipTray({
  title,
  kind,
  chips,
  drag,
  disabled,
  onPick,
}: {
  title: string;
  kind: "cond" | "act";
  chips: { id: string; label: string; glyph: string }[];
  drag: Drag;
  disabled: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-tech text-ink-faint">{title}</span>
      <div className="flex flex-wrap gap-1.5" style={{ touchAction: "none" }}>
        {chips.length === 0 ? (
          <span className="text-[11px] text-ink-faint">all placed ✓</span>
        ) : (
          chips.map((c) => {
            const active = !!drag && drag.kind === kind && drag.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  if (!disabled) onPick(c.id);
                }}
                aria-label={`${title} chip: ${c.label}${active ? ", selected" : ""}`}
                aria-pressed={active}
                disabled={disabled}
                className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition active:scale-95 disabled:opacity-40"
                style={{
                  borderColor: active ? ACCENT : "var(--color-line, #33405c)",
                  background: active ? "rgba(52,211,153,0.18)" : "rgba(255,255,255,0.04)",
                  color: active ? ACCENT : "var(--color-ink-dim, #9aa6b2)",
                  touchAction: "none",
                }}
              >
                <span aria-hidden="true">{c.glyph}</span>
                {c.label}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
