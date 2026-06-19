"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Dual-Zone Alarm Logic — combine sensors with AND/OR to kill false */
/*  alarms. One learning goal: a real intrusion must trip TWO          */
/*  independent checks (motion in a zone AND the door opening), so the */
/*  rule  (Zone A OR Zone B) AND Door  passes all 5 test cases.        */
/* ------------------------------------------------------------------ */

const ACCENT = "#22d3ee";
const ALARM = "#f87171";
const SAFE = "#34d399";

type Op = "AND" | "OR";

/** One test scenario the alarm must judge correctly. */
interface Scenario {
  id: number;
  label: string;
  glyph: string;
  zoneA: boolean;
  zoneB: boolean;
  door: boolean;
  /** Ground truth: is this a real break-in that SHOULD alarm? */
  intrusion: boolean;
}

/* The 5 deterministic cases from the brief. */
const SCENARIOS: readonly Scenario[] = [
  { id: 1, label: "Cat strolls through Zone A, door shut", glyph: "🐈", zoneA: true, zoneB: false, door: false, intrusion: false },
  { id: 2, label: "Wind flutters a curtain in Zone B", glyph: "🍃", zoneA: false, zoneB: true, door: false, intrusion: false },
  { id: 3, label: "Door swings open, nobody moving", glyph: "🚪", zoneA: false, zoneB: false, door: true, intrusion: false },
  { id: 4, label: "Burglar crosses Zone A and opens door", glyph: "🦹", zoneA: true, zoneB: false, door: true, intrusion: true },
  { id: 5, label: "Burglar crosses Zone B and opens door", glyph: "🥷", zoneA: false, zoneB: true, door: true, intrusion: true },
] as const;

/** Evaluate the learner's rule:  (A op1 B) op2 Door  */
function evaluate(a: boolean, b: boolean, door: boolean, op1: Op, op2: Op): boolean {
  const inner: boolean = op1 === "AND" ? a && b : a || b;
  return op2 === "AND" ? inner && door : inner || door;
}

type Verdict = "pending" | "ok" | "false-alarm" | "missed";

interface Outcome {
  scenario: Scenario;
  fired: boolean; // did the learner's rule trip the alarm?
  verdict: Verdict;
}

/** Grade every scenario under the current rule. Pure + deterministic. */
function gradeAll(op1: Op, op2: Op): Outcome[] {
  return SCENARIOS.map((s) => {
    const fired = evaluate(s.zoneA, s.zoneB, s.door, op1, op2);
    let verdict: Verdict;
    if (fired === s.intrusion) verdict = "ok";
    else if (fired && !s.intrusion) verdict = "false-alarm";
    else verdict = "missed";
    return { scenario: s, fired, verdict };
  });
}

export default function DualZoneAlarm({ onComplete }: ActivityProps) {
  // Start on a deliberately wrong rule (A OR B) OR Door → fires on the cat.
  const [op1, setOp1] = useState<Op>("OR");
  const [op2, setOp2] = useState<Op>("OR");
  const [running, setRunning] = useState<boolean>(false);
  const [active, setActive] = useState<number>(-1); // index of scenario being played
  const [results, setResults] = useState<Outcome[]>([]);
  const [done, setDone] = useState<boolean>(false);
  const [tries, setTries] = useState<number>(0);

  const firedOnce = useRef<boolean>(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  // Live grade (used by the floor-plan + scoreboard once a run finishes).
  const graded = useMemo(() => gradeAll(op1, op2), [op1, op2]);
  const falseAlarms = results.filter((r) => r.verdict === "false-alarm").length;
  const missed = results.filter((r) => r.verdict === "missed").length;
  const caught = results.filter((r) => r.scenario.intrusion && r.fired).length;

  // The scenario currently on the floor-plan (during a run) or the last graded.
  const stage: Outcome | null = active >= 0 ? graded[active] : null;
  const liveFired: boolean = stage ? stage.fired : false;

  const setOperator = useCallback(
    (which: "op1" | "op2", value: Op) => {
      if (running) return;
      if (which === "op1") setOp1(value);
      else setOp2(value);
      // Editing the rule clears a finished run so feedback stays honest.
      setResults([]);
      setActive(-1);
      setDone(false);
    },
    [running],
  );

  const runTests = useCallback(() => {
    clearTimers();
    setResults([]);
    setActive(-1);
    setRunning(true);
    setTries((t) => t + 1);

    const fresh = gradeAll(op1, op2);
    const STEP_MS = 620;

    SCENARIOS.forEach((_, i) => {
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
        if (win && !firedOnce.current) {
          firedOnce.current = true;
          setDone(true);
          onComplete({
            passed: true,
            stars: 3,
            detail: "ARMED & smart — dual-zone logic stopped every false alarm.",
          });
        } else if (!win) {
          const fa = fresh.filter((r) => r.verdict === "false-alarm").length;
          onComplete({
            passed: false,
            detail:
              fa > 0
                ? "A single zone shouldn't alarm — you need motion AND the door."
                : "Almost — both real break-ins must still set off the alarm.",
          });
        }
      }, SCENARIOS.length * STEP_MS + 120),
    );
  }, [op1, op2, onComplete, clearTimers]);

  const reset = useCallback(() => {
    clearTimers();
    setOp1("OR");
    setOp2("OR");
    setRunning(false);
    setActive(-1);
    setResults([]);
    setDone(false);
  }, [clearTimers]);

  const status: string = done
    ? "ARMED & smart: dual-zone logic stops false alarms. ✨"
    : running
      ? `Testing case ${active + 1} of ${SCENARIOS.length}…`
      : results.length === SCENARIOS.length
        ? falseAlarms > 0
          ? `${falseAlarms} false alarm${falseAlarms > 1 ? "s" : ""} — tighten the rule.`
          : missed > 0
            ? "A real break-in slipped through — don't loosen it too far."
            : "All clear!"
        : "Wire the rule, then press Run Tests ▶";

  // Floor-plan wedge colours light up when their input is active in the stage.
  const aLit = stage ? stage.scenario.zoneA : false;
  const bLit = stage ? stage.scenario.zoneB : false;
  const doorOpen = stage ? stage.scenario.door : false;

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
      `}</style>

      {/* ---------------- FLOOR PLAN ---------------- */}
      <div
        className="panel relative overflow-hidden rounded-xl"
        style={{
          boxShadow: done
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
          aria-label="Room floor plan with two motion zones and a door sensor"
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
              y={120}
              fontSize={26}
              textAnchor="middle"
              style={{ animation: "g6dualzonealarm-pop .35s ease both" }}
            >
              {stage.scenario.glyph}
            </text>
          )}

          {/* alarm LED + buzzer, top-centre */}
          <g transform="translate(160 26)">
            <circle cx={0} cy={0} r={8} fill={liveFired && stage ? ALARM : "#1b2433"} stroke={liveFired && stage ? ALARM : "#2a3441"} strokeWidth={1.5} style={{ animation: liveFired && stage ? "g6dualzonealarm-pulse .4s ease infinite" : undefined }} />
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
          <span className="text-ink-faint">(</span>
          <Chip label="Zone A" tone={ACCENT} />
          <OpGem value={op1} disabled={running} onChange={(v) => setOperator("op1", v)} ariaLabel="Operator between Zone A and Zone B" />
          <Chip label="Zone B" tone={ACCENT} />
          <span className="text-ink-faint">)</span>
          <OpGem value={op2} disabled={running} onChange={(v) => setOperator("op2", v)} ariaLabel="Operator between the zones and the door" />
          <Chip label="Door" tone="#f59e0b" />
        </div>
        <p className="text-center font-mono text-[11px] text-ink-faint">
          Rule fires the alarm when this is <span style={{ color: ACCENT }}>true</span>.
        </p>
      </div>

      {/* ---------------- SCOREBOARD ---------------- */}
      <div className="grid grid-cols-5 gap-1.5" role="list" aria-label="Test case results">
        {SCENARIOS.map((s, i) => {
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
          <span style={{ color: caught === 2 ? SAFE : ACCENT }}>{caught}/2</span>
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
          background: done ? "rgba(52,211,153,.12)" : "rgba(34,211,238,.06)",
          color: done ? SAFE : "var(--color-ink-dim, #9aa6b2)",
          border: `1px solid ${done ? SAFE : "#1b2433"}`,
        }}
      >
        {done ? (
          <span className="font-bold">⭐⭐⭐ {status}</span>
        ) : (
          status
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-ink-faint">Runs: {tries}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
            aria-label="Reset the rule and scoreboard"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={runTests}
            disabled={running || done}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            style={{ background: ACCENT, color: "#05070d" }}
            aria-label="Run all five test cases"
          >
            {running ? "Testing…" : done ? "Solved 🎉" : "Run Tests ▶"}
          </button>
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
        background: value === "AND" ? "#22d3ee" : "#a855f7",
        color: "#05070d",
        touchAction: "manipulation",
      }}
    >
      {value}
    </button>
  );
}
