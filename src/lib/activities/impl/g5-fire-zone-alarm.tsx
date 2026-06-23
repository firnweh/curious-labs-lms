"use client";
import type { ActivityProps } from "@/lib/activities/types";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Multi-Zone Fire Alarm 🚨 — EXPLORER (Class 4-6)                     */
/*                                                                     */
/*  A real engineering problem, not "drag into the green zone".        */
/*  Each room has its OWN sensor with a TRIGGER LINE you must set.     */
/*  You are given each room's recent SENSOR LOG: the highest a         */
/*  warm-but-SAFE reading reached (oven, heater, dryer…) and the       */
/*  lowest a REAL fire reached. The trigger line must sit ABOVE every  */
/*  safe reading (so no false alarms) yet AT-or-BELOW every fire (so   */
/*  none slips through). Because every room runs hot differently, the  */
/*  correct line is DIFFERENT per room — you must reason about each.   */
/*                                                                     */
/*  You ALSO wire each sensor to its own zone light. Cross-wired       */
/*  sensors light the wrong room, so the panel can't say WHERE.        */
/*                                                                     */
/*  3 escalating rounds (2 → 3 → 4 zones). Round 3 twist: one room's   */
/*  safe oven spikes HIGHER than another room's real fire — so a       */
/*  single "one line fits all" guess is impossible. Star score rewards */
/*  solving with few wasted drills (plan before you run).              */
/* ------------------------------------------------------------------ */

const ACCENT = "#34d399";
const DANGER = "#f87171";
const WARM = "#fb923c";
const STEP_MS = 640;

type Tone = "low" | "high";
type Phase = "setup" | "drill" | "roundwon" | "won";

const TONE_LABEL: Record<Tone, string> = { low: "LOW beep", high: "HIGH beep" };

interface Zone {
  id: string; // panel letter A,B,C,D
  name: string;
  emoji: string;
  tone: Tone;
  /** highest a warm-but-SAFE appliance reading reached recently */
  safeMax: number;
  /** lowest a REAL fire reached recently */
  fireMin: number;
}

/* A drill event: a reading in a zone. `fire` is ground truth. The `peak`
 * is chosen to fall inside that zone's safe range (decoy) or fire range. */
interface DrillEvent {
  zone: string;
  peak: number;
  fire: boolean;
}

interface Round {
  building: string;
  zones: readonly Zone[];
  sequence: readonly DrillEvent[];
}

/* ---- Three hand-authored, deterministic, escalating buildings ---- */
/* For each zone the SAFE band of valid trigger lines is (safeMax, fireMin].
 * All sequences only use peaks inside safe range (<=safeMax) for decoys and
 * inside fire range (>=fireMin) for fires, so a correct line per zone always
 * locates every fire and ignores every decoy. */
const ROUNDS: readonly Round[] = [
  {
    building: "Bakery",
    zones: [
      { id: "A", name: "Kitchen", emoji: "🍳", tone: "low", safeMax: 55, fireMin: 70 },
      { id: "B", name: "Storeroom", emoji: "📦", tone: "high", safeMax: 40, fireMin: 60 },
    ],
    sequence: [
      { zone: "A", peak: 88, fire: true },
      { zone: "B", peak: 38, fire: false },
      { zone: "B", peak: 92, fire: true },
      { zone: "A", peak: 52, fire: false },
      { zone: "A", peak: 74, fire: true },
      { zone: "B", peak: 81, fire: true },
    ],
  },
  {
    building: "School",
    zones: [
      { id: "A", name: "Canteen", emoji: "🍲", tone: "low", safeMax: 60, fireMin: 75 },
      { id: "B", name: "Library", emoji: "📚", tone: "high", safeMax: 30, fireMin: 50 },
      { id: "C", name: "Lab", emoji: "⚗️", tone: "high", safeMax: 48, fireMin: 64 },
    ],
    sequence: [
      { zone: "B", peak: 27, fire: false },
      { zone: "A", peak: 84, fire: true },
      { zone: "C", peak: 45, fire: false },
      { zone: "B", peak: 55, fire: true },
      { zone: "A", peak: 58, fire: false },
      { zone: "C", peak: 70, fire: true },
      { zone: "B", peak: 88, fire: true },
      { zone: "A", peak: 78, fire: true },
    ],
  },
  {
    building: "Workshop",
    // TWIST: the Furnace room's SAFE peak (78) is HIGHER than the Office's
    // real FIRE minimum (44). A single global trigger line cannot work —
    // you MUST tune each zone separately from its own log.
    zones: [
      { id: "A", name: "Office", emoji: "💻", tone: "low", safeMax: 32, fireMin: 44 },
      { id: "B", name: "Paint store", emoji: "🪣", tone: "high", safeMax: 50, fireMin: 66 },
      { id: "C", name: "Furnace", emoji: "🔩", tone: "high", safeMax: 78, fireMin: 90 },
      { id: "D", name: "Wood shop", emoji: "🪵", tone: "low", safeMax: 40, fireMin: 58 },
    ],
    sequence: [
      { zone: "C", peak: 76, fire: false }, // furnace runs HOT but safe
      { zone: "A", peak: 46, fire: true }, // office fire is LOWER than furnace's safe peak!
      { zone: "D", peak: 38, fire: false },
      { zone: "B", peak: 48, fire: false },
      { zone: "C", peak: 95, fire: true },
      { zone: "A", peak: 30, fire: false },
      { zone: "D", peak: 64, fire: true },
      { zone: "B", peak: 70, fire: true },
    ],
  },
] as const;

type ResultMark = "pending" | "correct" | "missed" | "false" | "miswire";

interface EventResult {
  mark: ResultMark;
  litZone: string | null;
}

/* default trigger line for a zone before the learner tunes it (deliberately
 * too low so decoys would false-alarm — forces real tuning). */
const START_THRESH = 20;

function freshThresh(zones: readonly Zone[]): Record<string, number> {
  const o: Record<string, number> = {};
  for (const z of zones) o[z.id] = START_THRESH;
  return o;
}
/* Start every sensor cross-wired to the NEXT zone (forces rewiring). */
function freshWiring(zones: readonly Zone[]): Record<string, string> {
  const o: Record<string, string> = {};
  zones.forEach((z, i) => {
    o[z.id] = zones[(i + 1) % zones.length].id;
  });
  return o;
}

function evaluate(
  ev: DrillEvent,
  th: Record<string, number>,
  wire: Record<string, string>,
): EventResult {
  const triggered = ev.peak >= th[ev.zone];
  if (ev.fire) {
    if (!triggered) return { mark: "missed", litZone: null };
    const lit = wire[ev.zone];
    return lit === ev.zone
      ? { mark: "correct", litZone: lit }
      : { mark: "miswire", litZone: lit };
  }
  if (triggered) return { mark: "false", litZone: wire[ev.zone] };
  return { mark: "correct", litZone: null };
}

const CONFETTI = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2;
  const reach = 70 + (i % 4) * 18;
  return {
    emoji: ["✨", "🎉", "⭐", "💫", "🟢", "🚨"][i % 6],
    dx: Math.round(Math.cos(angle) * reach),
    dy: Math.round(Math.sin(angle) * reach * 0.7) + 36,
    spin: (i % 2 === 0 ? 1 : -1) * (180 + (i % 5) * 90),
    delay: (i % 7) * 0.05,
    dur: 1.1 + (i % 4) * 0.18,
  };
});

export default function FireZoneAlarm({ onComplete }: ActivityProps) {
  const [round, setRound] = useState<number>(0);
  const rd = ROUNDS[round];

  const [thresh, setThresh] = useState<Record<string, number>>(() =>
    freshThresh(ROUNDS[0].zones),
  );
  const [wiring, setWiring] = useState<Record<string, string>>(() =>
    freshWiring(ROUNDS[0].zones),
  );
  const [phase, setPhase] = useState<Phase>("setup");
  const [step, setStep] = useState<number>(-1);
  const [results, setResults] = useState<EventResult[]>(() =>
    ROUNDS[0].sequence.map(() => ({ mark: "pending", litZone: null })),
  );
  const [wastedDrills, setWastedDrills] = useState<number>(0);

  const doneRef = useRef<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => () => stopTimer(), [stopTimer]);

  // Fresh round setup: reset trigger lines + wiring + tracker for this building.
  useEffect(() => {
    stopTimer();
    setThresh(freshThresh(ROUNDS[round].zones));
    setWiring(freshWiring(ROUNDS[round].zones));
    setPhase("setup");
    setStep(-1);
    setResults(ROUNDS[round].sequence.map(() => ({ mark: "pending", litZone: null })));
  }, [round, stopTimer]);

  const inDrill = phase === "drill";

  const finishDrill = useCallback(
    (marks: EventResult[]) => {
      stopTimer();
      const ok =
        marks.every((r) => r.mark === "correct") &&
        marks.every((r) => r.mark !== "false") &&
        marks.every((r, i) => !rd.sequence[i].fire || r.mark === "correct");

      if (ok) {
        const last = round >= ROUNDS.length - 1;
        if (last) {
          setPhase("won");
          if (!doneRef.current) {
            doneRef.current = true;
            // Optimization goal: clean run (0 wasted drills) = 3 stars.
            const stars: 1 | 2 | 3 =
              wastedDrills <= 1 ? 3 : wastedDrills <= 4 ? 2 : 1;
            onComplete({
              passed: true,
              stars,
              detail:
                stars === 3
                  ? "Every zone tuned and located across all 3 buildings — flawless!"
                  : stars === 2
                    ? "All buildings safe! A little fine-tuning got you there."
                    : "All buildings safe — lots of test drills, but you solved it!",
            });
          }
        } else {
          setPhase("roundwon");
          timerRef.current = setTimeout(() => setRound((r) => r + 1), 1300);
        }
      } else {
        // Wrong: count a wasted drill, give a targeted nudge, let them retry.
        // No onComplete(passed:false) spam — gentle retry only.
        setWastedDrills((w) => w + 1);
        setPhase("setup");
        setStep(-1);
      }
    },
    [onComplete, rd, round, stopTimer, wastedDrills],
  );

  const runStep = useCallback(
    (i: number, acc: EventResult[]) => {
      if (i >= rd.sequence.length) {
        finishDrill(acc);
        return;
      }
      setStep(i);
      const res = evaluate(rd.sequence[i], thresh, wiring);
      const next = acc.slice();
      next[i] = res;
      setResults(next);
      timerRef.current = setTimeout(() => runStep(i + 1, next), STEP_MS);
    },
    [finishDrill, rd, thresh, wiring],
  );

  const handleStart = useCallback(() => {
    stopTimer();
    const cleared: EventResult[] = rd.sequence.map(() => ({
      mark: "pending",
      litZone: null,
    }));
    setResults(cleared);
    setPhase("drill");
    setStep(-1);
    timerRef.current = setTimeout(() => runStep(0, cleared), 350);
  }, [rd, runStep, stopTimer]);

  const handleReset = useCallback(() => {
    stopTimer();
    doneRef.current = false;
    setWastedDrills(0);
    setRound(0);
    // round-effect resets thresh/wiring/results/phase for round 0
    setThresh(freshThresh(ROUNDS[0].zones));
    setWiring(freshWiring(ROUNDS[0].zones));
    setPhase("setup");
    setStep(-1);
    setResults(ROUNDS[0].sequence.map(() => ({ mark: "pending", litZone: null })));
  }, [stopTimer]);

  const setZoneThresh = useCallback(
    (z: string, v: number) => {
      if (inDrill) return;
      setThresh((prev) => ({ ...prev, [z]: v }));
    },
    [inDrill],
  );

  const cycleWire = useCallback(
    (sensor: string) => {
      if (inDrill) return;
      setWiring((prev) => {
        const ids = rd.zones.map((z) => z.id);
        const cur = ids.indexOf(prev[sensor]);
        const nextId = ids[(cur + 1) % ids.length];
        return { ...prev, [sensor]: nextId };
      });
    },
    [inDrill, rd],
  );

  const activeEvent =
    step >= 0 && step < rd.sequence.length ? rd.sequence[step] : null;
  const activeRes = step >= 0 ? results[step] : null;
  const litZoneNow = activeRes?.litZone ?? null;
  const celebrating = phase === "won";

  // Targeted hint after a failed drill (deterministic, from last results).
  const failHint = useMemo<string | null>(() => {
    if (phase !== "setup" || step !== -1) return null;
    if (results.every((r) => r.mark === "pending")) return null;
    const miss = results.findIndex((r) => r.mark === "missed");
    if (miss >= 0)
      return `A real fire in Zone ${rd.sequence[miss].zone} slipped through — its trigger line is too HIGH. Lower it below ${rd.sequence[miss].peak}.`;
    const fls = results.findIndex((r) => r.mark === "false");
    if (fls >= 0)
      return `A safe reading set off Zone ${rd.sequence[fls].zone} — its trigger line is too LOW. Raise it above ${rd.sequence[fls].peak}.`;
    const mw = results.findIndex((r) => r.mark === "miswire");
    if (mw >= 0)
      return `Right room caught fire, wrong light lit — fix Sensor ${rd.sequence[mw].zone}'s wiring.`;
    return null;
  }, [phase, step, results, rd]);

  const status = useMemo<string>(() => {
    if (phase === "won") return "All buildings safe — every zone tuned and located! 🎉";
    if (phase === "roundwon")
      return `${rd.building} secured! Next building loading…`;
    if (phase === "drill") {
      if (activeEvent && activeRes) {
        const verb =
          activeRes.mark === "correct" && activeRes.litZone
            ? `🔥 FIRE found in Zone ${activeEvent.zone}`
            : activeRes.mark === "correct"
              ? "all clear (safe reading ignored)"
              : activeRes.mark === "missed"
                ? "❌ missed a real fire!"
                : activeRes.mark === "false"
                  ? "❌ false alarm!"
                  : "❌ wrong zone lit!";
        return `Drill ${step + 1}/${rd.sequence.length} — ${verb}`;
      }
      return "Running drill…";
    }
    if (failHint) return failHint;
    return "Read each room's log. Set its trigger ABOVE the safe peak but AT/BELOW the fire peak. Wire each sensor to its own zone.";
  }, [phase, step, activeEvent, activeRes, rd, failHint]);

  const nz = rd.zones.length;
  const planXW = nz <= 2 ? 156 : nz === 3 ? 104 : 78;

  return (
    <div className="flex w-full max-w-[460px] flex-col gap-3 font-mono text-ink">
      <style>{`
        @keyframes g5fza-flicker {
          0%,100% { transform: scaleY(1) translateY(0); opacity: 1; }
          50% { transform: scaleY(1.18) translateY(-1px); opacity: .85; }
        }
        @keyframes g5fza-sound {
          0%,100% { transform: scaleX(.4); opacity: .5; }
          50% { transform: scaleX(1); opacity: 1; }
        }
        @keyframes g5fza-pop {
          0% { transform: scale(.6); opacity: 0; }
          60% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g5fza-confetti {
          0% { transform: translate(0,0) rotate(0deg) scale(.4); opacity: 0; }
          12% { opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) rotate(var(--spin)) scale(1); opacity: 0; }
        }
        @keyframes g5fza-starpop {
          0% { transform: scale(0) rotate(-30deg); opacity: 0; }
          60% { transform: scale(1.4) rotate(8deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-g5fza-loop] { animation: none !important; }
        }
      `}</style>

      {/* ---- HEADER: building + round dots ---- */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: ACCENT }}>
          🏢 {rd.building}
          <span className="ml-1 text-[11px] font-normal text-ink-faint">
            · {nz} zones
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5" aria-hidden>
          {ROUNDS.map((_, i) => {
            const solved = i < round || celebrating;
            const cur = i === round && !celebrating;
            return (
              <span
                key={i}
                className="grid h-3.5 w-3.5 place-items-center rounded-full"
                style={{
                  background: solved
                    ? ACCENT
                    : cur
                      ? `${ACCENT}40`
                      : "rgba(255,255,255,0.06)",
                  border: `2px solid ${solved || cur ? ACCENT : "rgba(120,140,170,0.35)"}`,
                }}
              />
            );
          })}
        </span>
      </div>

      {/* ---------------- FLOOR PLAN ---------------- */}
      <div
        className="panel relative overflow-hidden rounded-xl p-2"
        style={
          celebrating
            ? { boxShadow: `0 0 0 1px ${ACCENT}, 0 0 24px -4px ${ACCENT}` }
            : undefined
        }
      >
        <svg
          viewBox="0 0 320 150"
          className="block h-auto w-full"
          role="img"
          aria-label={`${rd.building} floor plan with ${nz} zones`}
        >
          <rect
            x={4}
            y={4}
            width={312}
            height={142}
            rx={8}
            fill="#0b1220"
            stroke="#1b2433"
            strokeWidth={2}
          />
          {rd.zones.map((z, zi) => {
            const cellW = 312 / nz;
            const x0 = 4 + zi * cellW;
            const cx = x0 + cellW / 2;
            const isHere = activeEvent?.zone === z.id && activeRes?.mark !== "pending";
            const burning =
              isHere &&
              (activeRes?.mark === "correct" || activeRes?.mark === "miswire") &&
              activeEvent?.fire === true;
            const litHere = litZoneNow === z.id;
            return (
              <g key={z.id}>
                {zi > 0 && (
                  <line
                    x1={x0}
                    y1={8}
                    x2={x0}
                    y2={142}
                    stroke="#1b2433"
                    strokeWidth={3}
                  />
                )}
                <rect
                  x={x0 + 3}
                  y={10}
                  width={cellW - 6}
                  height={130}
                  rx={6}
                  fill={
                    litHere && activeRes?.mark === "correct"
                      ? `${ACCENT}26`
                      : litHere && activeRes?.mark === "miswire"
                        ? `${DANGER}22`
                        : "transparent"
                  }
                  style={{ transition: "fill .2s ease" }}
                />
                <text x={cx} y={26} fill="#9aa6b2" fontSize={8} textAnchor="middle">
                  {z.id} · {z.name.toUpperCase()}
                </text>
                <text x={cx} y={70} fontSize={nz >= 4 ? 22 : 28} textAnchor="middle">
                  {z.emoji}
                </text>
                <circle
                  cx={x0 + 14}
                  cy={122}
                  r={5}
                  fill={isHere ? WARM : "#243042"}
                  stroke={ACCENT}
                  strokeWidth={1.1}
                />
                {burning && (
                  <text
                    x={cx}
                    y={108}
                    fontSize={20}
                    textAnchor="middle"
                    style={{
                      transformOrigin: `${cx}px 102px`,
                      animation: "g5fza-flicker .5s ease-in-out infinite",
                    }}
                    data-g5fza-loop=""
                  >
                    🔥
                  </text>
                )}
                {litHere &&
                  activeRes?.mark === "correct" &&
                  activeEvent?.fire === true && (
                    <text
                      x={cx}
                      y={92}
                      fill={ACCENT}
                      fontSize={8}
                      fontWeight={700}
                      textAnchor="middle"
                      style={{ animation: "g5fza-pop .3s ease-out" }}
                    >
                      FIRE · {z.id}
                    </text>
                  )}
              </g>
            );
          })}

          {celebrating && (
            <g style={{ animation: "g5fza-pop .4s ease-out" }}>
              <rect
                x={108}
                y={56}
                width={104}
                height={40}
                rx={8}
                fill="#0b1220"
                stroke={ACCENT}
                strokeWidth={1.5}
              />
              <text x={160} y={74} fontSize={16} textAnchor="middle">
                🛡️
              </text>
              <text
                x={160}
                y={90}
                fill={ACCENT}
                fontSize={9}
                fontWeight={700}
                textAnchor="middle"
              >
                ALL SAFE
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* ---------------- STATUS ---------------- */}
      <div
        role="status"
        aria-live="polite"
        className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-center text-xs leading-snug"
        style={{
          color: celebrating
            ? ACCENT
            : activeRes?.mark === "missed" ||
                activeRes?.mark === "false" ||
                activeRes?.mark === "miswire" ||
                (phase === "setup" && failHint)
              ? DANGER
              : "var(--color-ink-dim, #9aa6b2)",
        }}
      >
        {status}
      </div>

      {/* ---------------- DRILL EVENT TRACKER ---------------- */}
      <div className="flex items-center justify-center gap-1.5" aria-hidden>
        {results.map((r, i) => {
          const color =
            r.mark === "correct"
              ? ACCENT
              : r.mark === "missed" || r.mark === "false" || r.mark === "miswire"
                ? DANGER
                : "#243042";
          const isNow = inDrill && i === step;
          return (
            <span
              key={i}
              className="grid h-6 w-6 place-items-center rounded-md text-[10px] font-bold"
              style={{
                background: r.mark === "pending" ? "#0e1626" : `${color}22`,
                color: r.mark === "pending" ? "#67748a" : color,
                border: `1px solid ${isNow ? ACCENT : "#1b2433"}`,
              }}
            >
              {rd.sequence[i].zone}
            </span>
          );
        })}
      </div>

      {/* ---------------- ZONE TUNING CARDS (log + slider + wiring) ---------------- */}
      <div className="panel flex flex-col gap-2 rounded-xl p-3">
        <p className="text-[11px] uppercase tracking-tech text-ink-faint">
          Tune each zone from its sensor log
        </p>
        {rd.zones.map((z) => {
          const t = thresh[z.id];
          // CORRECT band is (safeMax, fireMin]. We DON'T paint it on the bar —
          // the learner must read the log numbers and reason. We only colour
          // the current value once it is provably right/wrong vs the log.
          const tooLow = t <= z.safeMax; // would false-alarm on a known safe peak
          const tooHigh = t > z.fireMin; // would miss a known fire
          const valColor = tooLow ? DANGER : tooHigh ? DANGER : ACCENT;
          const target = wiring[z.id];
          const wireOk = target === z.id;
          const tgtZone = rd.zones.find((x) => x.id === target);
          const tone = tgtZone?.tone ?? "low";
          return (
            <div
              key={z.id}
              className="flex flex-col gap-1.5 rounded-lg border border-line bg-panel/60 p-2.5"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink">
                  {z.emoji} Zone {z.id} · {z.name}
                </span>
                <span className="tabular-nums" style={{ color: valColor }}>
                  line {t}
                </span>
              </div>

              {/* The LOG — this is the data to reason from (no answer given). */}
              <div className="flex items-center gap-2 text-[10px]">
                <span
                  className="rounded px-1.5 py-0.5"
                  style={{ background: `${WARM}22`, color: WARM }}
                >
                  warm-safe peaked {z.safeMax}
                </span>
                <span
                  className="rounded px-1.5 py-0.5"
                  style={{ background: `${DANGER}22`, color: DANGER }}
                >
                  real fire from {z.fireMin}
                </span>
              </div>

              {/* slider — NO green safe-band painted on it on purpose */}
              <input
                type="range"
                min={10}
                max={100}
                step={1}
                value={t}
                disabled={inDrill}
                onChange={(e) => setZoneThresh(z.id, Number(e.target.value))}
                aria-label={`Zone ${z.id} ${z.name} trigger line, currently ${t}. Safe readings peak at ${z.safeMax}, real fires start at ${z.fireMin}.`}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-50"
                style={{ accentColor: valColor }}
              />

              {/* wiring button */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  cycleWire(z.id);
                }}
                disabled={inDrill}
                aria-label={`Sensor ${z.id} is wired to Zone ${target} light and ${TONE_LABEL[tone]}. Tap to change which zone it lights.`}
                className="flex items-center justify-between gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold transition disabled:opacity-50"
                style={{
                  background: wireOk ? `${ACCENT}1f` : `${DANGER}1a`,
                  color: wireOk ? ACCENT : DANGER,
                  border: `1px solid ${wireOk ? ACCENT : DANGER}`,
                  touchAction: "manipulation",
                }}
              >
                <span>
                  Sensor {z.id} → Light {target} · {TONE_LABEL[tone]}
                </span>
                <span className="flex items-end gap-[2px]" aria-hidden>
                  {[0, 1, 2].map((b) => (
                    <span
                      key={b}
                      className="inline-block w-[3px] rounded-sm"
                      data-g5fza-loop=""
                      style={{
                        height: tone === "high" ? 12 - b * 3 : 6 + b * 2,
                        background: wireOk ? ACCENT : DANGER,
                        animation: `g5fza-sound ${0.5 + b * 0.12}s ease-in-out infinite`,
                      }}
                    />
                  ))}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* ---------------- CONTROLS ---------------- */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink-faint">
          Test drills used: {wastedDrills}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
            aria-label="Start over from the first building"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={inDrill || phase === "roundwon" || celebrating}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            style={{ background: ACCENT, color: "#05070d" }}
            aria-label="Run the fire drill"
          >
            {inDrill ? "Drill running…" : "Run Drill 🚨"}
          </button>
        </div>
      </div>

      {/* ---------------- WIN CELEBRATION ---------------- */}
      {celebrating && (
        <div
          className="relative rounded-xl border p-3 text-center"
          style={{ borderColor: ACCENT, background: `${ACCENT}14` }}
        >
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0"
            aria-hidden
          >
            {CONFETTI.map((p, i) => (
              <span
                key={i}
                className="absolute text-base"
                style={
                  {
                    left: 0,
                    top: 0,
                    "--dx": `${p.dx}px`,
                    "--dy": `${p.dy}px`,
                    "--spin": `${p.spin}deg`,
                    animation: `g5fza-confetti ${p.dur}s cubic-bezier(.2,.6,.3,1) ${p.delay}s infinite`,
                  } as CSSProperties
                }
              >
                {p.emoji}
              </span>
            ))}
          </div>
          <div className="relative z-10 text-2xl" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="inline-block"
                style={{
                  animation: `g5fza-starpop .55s cubic-bezier(.34,1.56,.64,1) ${0.15 + i * 0.28}s both`,
                }}
              >
                ⭐
              </span>
            ))}
          </div>
          <p className="relative z-10 mt-1 text-sm font-semibold" style={{ color: ACCENT }}>
            All 3 buildings safe! Every zone tuned and located.
          </p>
        </div>
      )}
    </div>
  );
}
