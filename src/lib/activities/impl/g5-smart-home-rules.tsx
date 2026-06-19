"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Smart Home Control Center 🏠 ──────────────────────────────────────────────
   GRADE 5 (explorer, age ~10–11). Subject: ROBOTICS.
   ONE learning goal: AUTOMATION WITH IF–THEN RULES — a smart home links each
   sensor TRIGGER (the IF) to a relay ACTION (the THEN). The learner wires three
   rooms by dragging a condition chip into each IF slot and an action chip into
   each THEN slot, then presses Run Day to step a clock through 4 scenarios and
   watch the appliances fire ONLY when their rule's condition is true.

   The intended wiring (deterministic, always winnable):
     Hallway     IF  motion = yes      THEN  lamp ON
     Living Room IF  brightness < 30    THEN  night-light ON
     Bedroom     IF  temp > 30          THEN  fan ON
   Only 3 condition chips and 3 action chips exist, each used once, so trying
   combinations guarantees the solution. The simulation is pure + fixed — no
   randomness — and it never scolds: a mis-wired appliance shows a red X and a
   kind hint, and the lab is always recoverable.
   ──────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#34d399";
const DANGER = "#f87171";

type RoomId = "hall" | "living" | "bed";
type CondId = "motion" | "dark" | "hot";
type ActId = "lamp" | "night" | "fan";

interface Scenario {
  name: string;
  clock: string;
  /** Per-room live sensor reading for this moment of the day. */
  sense: Record<RoomId, { motion: boolean; bright: number; temp: number }>;
}

/** The 4 scripted moments of a day. Fixed → deterministic + always winnable. */
const SCENARIOS: readonly Scenario[] = [
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
    name: "Evening dims the room",
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

interface CondDef {
  id: CondId;
  label: string;
  glyph: string;
  /** Does this trigger fire for the given room reading? */
  test: (s: { motion: boolean; bright: number; temp: number }) => boolean;
}

const CONDS: readonly CondDef[] = [
  { id: "motion", label: "motion = yes", glyph: "🏃", test: (s) => s.motion },
  { id: "dark", label: "brightness < 30", glyph: "🌙", test: (s) => s.bright < 30 },
  { id: "hot", label: "temp > 30°C", glyph: "🔥", test: (s) => s.temp > 30 },
];

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

interface RoomDef {
  id: RoomId;
  name: string;
  /** The action this room's appliance performs. */
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

const EMPTY_RULES: Rules = {
  hall: { cond: null, act: null },
  living: { cond: null, act: null },
  bed: { cond: null, act: null },
};

const condDef = (id: CondId): CondDef => CONDS.find((c) => c.id === id) as CondDef;
const actDef = (id: ActId): ActDef => ACTS.find((a) => a.id === id) as ActDef;

type Phase = "idle" | "running" | "won";
type Drag = { kind: "cond"; id: CondId } | { kind: "act"; id: ActId } | null;

export default function SmartHomeRules({ onComplete }: ActivityProps) {
  const [rules, setRules] = useState<Rules>(EMPTY_RULES);
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState<number>(-1); // current scenario index while running
  const [drag, setDrag] = useState<Drag>(null);
  const [hint, setHint] = useState<string>("");

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reportedRef = useRef<boolean>(false);

  const clearTimers = useCallback((): void => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  }, []);
  useEffect(() => () => clearTimers(), [clearTimers]);

  const running = phase === "running";
  const won = phase === "won";

  // chips already placed somewhere are removed from the tray (each used once)
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

  /** Does a room respond correctly across ALL 4 scenarios? Pure + deterministic. */
  const roomCorrect = useCallback(
    (room: RoomDef): boolean => {
      const rule = rules[room.id];
      if (!rule.cond || !rule.act) return false;
      // The action MUST drive this room's own appliance…
      if (rule.act !== room.appliance) return false;
      // …and the condition must fire exactly when the appliance ought to.
      const def = condDef(rule.cond);
      // The "ought to" reference: the room's appliance is the action we want,
      // and that action's intended trigger is whichever condition matches the
      // appliance one-to-one (lamp↔motion, night↔dark, fan↔hot).
      const want: Record<ActId, CondId> = { lamp: "motion", night: "dark", fan: "hot" };
      if (rule.cond !== want[room.appliance]) return false;
      // Sanity: simulate to be certain the chosen condition reproduces the
      // appliance's correct on/off pattern across the whole day.
      for (const sc of SCENARIOS) {
        const r = sc.sense[room.id];
        const fired = def.test(r);
        const shouldFire = condDef(want[room.appliance]).test(r);
        if (fired !== shouldFire) return false;
      }
      return true;
    },
    [rules],
  );

  const allCorrect = useMemo(
    () => ROOMS.every((r) => roomCorrect(r)),
    [roomCorrect],
  );

  // ── Live per-room appliance state during the run ────────────────────────────
  const fired = useMemo<Record<RoomId, boolean>>(() => {
    const out: Record<RoomId, boolean> = { hall: false, living: false, bed: false };
    if (step < 0 || step >= SCENARIOS.length) return out;
    const sc = SCENARIOS[step];
    for (const r of ROOMS) {
      const rule = rules[r.id];
      if (rule.cond && rule.act) {
        out[r.id] = condDef(rule.cond).test(sc.sense[r.id]);
      }
    }
    return out;
  }, [step, rules]);

  // Which rooms are MIS-wired at the current step (fire when they shouldn't,
  // or stay off when they should, OR drive the wrong appliance).
  const wrong = useMemo<Record<RoomId, boolean>>(() => {
    const out: Record<RoomId, boolean> = { hall: false, living: false, bed: false };
    if (step < 0) return out;
    const want: Record<ActId, CondId> = { lamp: "motion", night: "dark", fan: "hot" };
    const sc = SCENARIOS[step];
    for (const r of ROOMS) {
      const rule = rules[r.id];
      if (!rule.cond || !rule.act) continue;
      const correctAct = rule.act === r.appliance;
      const should = condDef(want[r.appliance]).test(sc.sense[r.id]);
      const actually = correctAct && condDef(rule.cond).test(sc.sense[r.id]);
      if (actually !== should || !correctAct) out[r.id] = true;
    }
    return out;
  }, [step, rules]);

  const finishWin = useCallback((): void => {
    setPhase("won");
    setHint("");
    if (!reportedRef.current) {
      reportedRef.current = true;
      onComplete({
        passed: true,
        stars: 3,
        detail: "Every room obeyed its IF–THEN rule all day. Home is smart! ✨",
      });
    }
  }, [onComplete]);

  const runDay = useCallback((): void => {
    if (running) return;
    clearTimers();
    setHint("");
    setPhase("running");
    setStep(0);
    const STEP_MS = 900;
    for (let i = 1; i < SCENARIOS.length; i += 1) {
      const t = setTimeout(() => setStep(i), i * STEP_MS);
      timersRef.current.push(t);
    }
    const endT = setTimeout(() => {
      if (allCorrect) {
        finishWin();
      } else {
        setPhase("idle");
        setStep(-1);
        // find the first mis-wired room for a targeted, kind nudge
        const broken = ROOMS.find((r) => !roomCorrect(r));
        let msg = "Almost! Re-check which trigger each appliance needs.";
        if (broken) {
          const rule = rules[broken.id];
          if (rule.act && rule.act !== broken.appliance) {
            msg = `The ${broken.name} has the wrong appliance plugged in — match the room to its device.`;
          } else if (broken.appliance === "fan") {
            msg = "The fan should turn on when it's HOT. 🔥";
          } else if (broken.appliance === "night") {
            msg = "The night-light should turn on when it's DARK. 🌙";
          } else {
            msg = "The lamp should turn on when there's MOTION. 🏃";
          }
        }
        setHint(msg);
        onComplete({ passed: false, detail: msg });
      }
    }, SCENARIOS.length * STEP_MS);
    timersRef.current.push(endT);
  }, [running, clearTimers, allCorrect, finishWin, roomCorrect, rules, onComplete]);

  const reset = useCallback((): void => {
    clearTimers();
    setRules(EMPTY_RULES);
    setPhase("idle");
    setStep(-1);
    setDrag(null);
    setHint("");
  }, [clearTimers]);

  // ── Drag + drop (pointer-first; tap a chip then tap a slot also works) ───────
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

  const sc = step >= 0 && step < SCENARIOS.length ? SCENARIOS[step] : null;

  const status = useMemo<string>(() => {
    if (won) return "Home is smart! Every room responded correctly across the whole day.";
    if (running && sc) return `Running ${sc.clock} — ${sc.name}. Watch each appliance.`;
    if (hint) return hint;
    if (!allFilled) return "Drag a trigger into each IF slot and an appliance into each THEN slot.";
    return "Rules are wired. Press Run Day to test them across the day.";
  }, [won, running, sc, hint, allFilled]);

  const availConds = CONDS.filter((c) => !usedConds.has(c.id));
  const availActs = ACTS.filter((a) => !usedActs.has(a.id));

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
          border: `2px solid ${won ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: won ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true">🏠</span>
        {won ? (
          <span aria-hidden="true" className="text-lg">
            ⭐⭐⭐
          </span>
        ) : (
          <span aria-hidden="true" className="text-[12px] leading-tight text-ink-dim">
            {running && sc ? `${sc.clock} · ${sc.name}` : "IF [trigger] → THEN [action]"}
          </span>
        )}
        {won && <span aria-hidden="true">✨</span>}
      </div>

      {/* ── Cutaway house: 3 rooms with live sensors + appliances ── */}
      <div
        className="panel w-full overflow-hidden rounded-2xl border p-2"
        style={{
          borderColor: won ? ACCENT : "var(--color-line, #33405c)",
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
            const live = sc ? sc.sense[room.id] : null;
            const on = fired[room.id];
            const bad = wrong[room.id] && running;
            const ad = actDef(room.appliance);
            // sensor blurb shown in-room
            const reading = live
              ? room.id === "hall"
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
                {i > 0 && (
                  <line x1={28} y1={y} x2={332} y2={y} stroke="#3a4866" strokeWidth={1.4} />
                )}
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
                  {won && (
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
          const ok = won && roomCorrect(room);
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
            chips={availConds.map((c) => ({ id: c.id, label: c.label, glyph: c.glyph }))}
            drag={drag}
            disabled={running}
            onPick={(id) => pickChip({ kind: "cond", id: id as CondId })}
          />
          <ChipTray
            title="Actions (THEN)"
            kind="act"
            chips={availActs.map((a) => ({ id: a.id, label: a.label, glyph: a.glyph }))}
            drag={drag}
            disabled={running}
            onPick={(id) => pickChip({ kind: "act", id: id as ActId })}
          />
        </div>

        {/* coaching / status line (never the exact answer) */}
        <p
          className="min-h-[28px] text-[11px] leading-tight"
          aria-hidden="true"
          style={{ color: hint ? DANGER : won ? ACCENT : "var(--color-ink-faint, #7c8aa0)" }}
        >
          {status}
        </p>

        {/* ── Controls: Run Day · Reset ── */}
        <div className="mt-1 flex items-stretch gap-2">
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              runDay();
            }}
            disabled={running || !allFilled || won}
            aria-label="Run Day — step the clock through four scenarios and test every rule"
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
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              reset();
            }}
            disabled={running}
            aria-label="Reset all rules"
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
