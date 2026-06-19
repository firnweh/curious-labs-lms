"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Multi-Zone Fire Alarm — sensors, thresholds + wiring per zone      */
/*  LEARNING GOAL: a multi-zone alarm needs one sensor per area, each  */
/*  wired to its OWN light + tone, with a threshold tuned high enough  */
/*  to ignore warm-but-safe readings yet low enough to catch a fire,   */
/*  so the panel can tell exactly WHERE the fire is.                   */
/* ------------------------------------------------------------------ */

const ACCENT = "#34d399";
const DANGER = "#f87171";
const WARM = "#fb923c";

type ZoneId = "A" | "B";
type Tone = "low" | "high";
type Phase = "setup" | "drill" | "won";

interface Zone {
  id: ZoneId;
  name: string;
  emoji: string;
  correctTone: Tone;
}

const ZONES: readonly Zone[] = [
  { id: "A", name: "Kitchen", emoji: "🍳", correctTone: "low" },
  { id: "B", name: "Storeroom", emoji: "📦", correctTone: "high" },
] as const;

const TONE_LABEL: Record<Tone, string> = { low: "LOW beep", high: "HIGH beep" };

/* Deterministic 6-event drill. `peak` is the flame intensity that zone
 * reaches (0–100). A reading counts as a real fire when it is at-or-above
 * the learner's threshold. Warm-but-safe decoys peak around 47–50, real
 * fires peak around 84–92. Any threshold in the green band catches every
 * fire and ignores every decoy — so the puzzle is always winnable. */
interface DrillEvent {
  zone: ZoneId;
  peak: number;
  fire: boolean; // ground truth: is this an actual fire?
}

const SEQUENCE: readonly DrillEvent[] = [
  { zone: "A", peak: 88, fire: true },
  { zone: "B", peak: 50, fire: false }, // warm storeroom — safe
  { zone: "B", peak: 92, fire: true },
  { zone: "A", peak: 47, fire: false }, // warm kitchen — safe
  { zone: "A", peak: 84, fire: true },
  { zone: "B", peak: 90, fire: true },
] as const;

const SAFE_BAND_LO = 56; // any threshold in [56,79] is correct
const SAFE_BAND_HI = 79;

type ResultMark = "pending" | "correct" | "missed" | "false" | "miswire";

interface EventResult {
  mark: ResultMark;
  litZone: ZoneId | null;
}

export default function FireZoneAlarm({ onComplete }: ActivityProps) {
  // Threshold per zone (0–100). Start too low so warm decoys would false-alarm.
  const [thresh, setThresh] = useState<Record<ZoneId, number>>({ A: 35, B: 35 });
  // Wiring: which zone-light+tone each sensor drives. Start cross-wired.
  const [wiring, setWiring] = useState<Record<ZoneId, ZoneId>>({ A: "B", B: "A" });
  const [phase, setPhase] = useState<Phase>("setup");
  const [step, setStep] = useState<number>(-1); // index into SEQUENCE during drill
  const [results, setResults] = useState<EventResult[]>(
    SEQUENCE.map(() => ({ mark: "pending", litZone: null })),
  );
  const [tries, setTries] = useState<number>(0);

  const doneRef = useRef<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** Evaluate one event with the CURRENT settings. Pure + deterministic. */
  const evaluate = useCallback(
    (
      ev: DrillEvent,
      th: Record<ZoneId, number>,
      wire: Record<ZoneId, ZoneId>,
    ): EventResult => {
      const triggered = ev.peak >= th[ev.zone];
      if (ev.fire) {
        if (!triggered) return { mark: "missed", litZone: null };
        const lit = wire[ev.zone]; // sensor of ev.zone lights this panel zone
        return lit === ev.zone
          ? { mark: "correct", litZone: lit }
          : { mark: "miswire", litZone: lit };
      }
      // not a real fire — a trigger here is a FALSE alarm
      if (triggered) return { mark: "false", litZone: wire[ev.zone] };
      return { mark: "correct", litZone: null };
    },
    [],
  );

  const finishDrill = useCallback(
    (marks: EventResult[]) => {
      stopTimer();
      const allGood = marks.every((r) => r.mark === "correct");
      const realFiresLocated = marks.every(
        (r, i) => !SEQUENCE[i].fire || r.mark === "correct",
      );
      const noFalse = marks.every((r) => r.mark !== "false");
      if (allGood && realFiresLocated && noFalse) {
        setPhase("won");
        if (!doneRef.current) {
          doneRef.current = true;
          onComplete({
            passed: true,
            stars: 3,
            detail: "All 6 zones located, no false alarms — building safe!",
          });
        }
      } else {
        setPhase("setup");
        setStep(-1);
        const miss = marks.some((r) => r.mark === "missed");
        const fls = marks.some((r) => r.mark === "false");
        const mw = marks.some((r) => r.mark === "miswire");
        const detail = miss
          ? "A real fire slipped through — lower a trigger line a little."
          : fls
            ? "A warm-but-safe reading set off a false alarm — raise that trigger line."
            : mw
              ? "The right zone lit the wrong panel light — check your wiring."
              : "Almost! Adjust a setting and run the drill again.";
        onComplete({ passed: false, detail });
      }
    },
    [onComplete, stopTimer],
  );

  /** Play the 6-event sequence one beat at a time so kids see each locate. */
  const runStep = useCallback(
    (i: number, acc: EventResult[]) => {
      if (i >= SEQUENCE.length) {
        finishDrill(acc);
        return;
      }
      setStep(i);
      const res = evaluate(SEQUENCE[i], thresh, wiring);
      const next = acc.slice();
      next[i] = res;
      setResults(next);
      timerRef.current = setTimeout(() => runStep(i + 1, next), 720);
    },
    [evaluate, finishDrill, thresh, wiring],
  );

  const handleStart = useCallback(() => {
    stopTimer();
    setTries((t) => t + 1);
    const cleared: EventResult[] = SEQUENCE.map(() => ({
      mark: "pending",
      litZone: null,
    }));
    setResults(cleared);
    setPhase("drill");
    setStep(-1);
    timerRef.current = setTimeout(() => runStep(0, cleared), 350);
  }, [runStep, stopTimer]);

  const handleReset = useCallback(() => {
    stopTimer();
    setThresh({ A: 35, B: 35 });
    setWiring({ A: "B", B: "A" });
    setPhase("setup");
    setStep(-1);
    setResults(SEQUENCE.map(() => ({ mark: "pending", litZone: null })));
    // doneRef stays true after a win so we never double-complete.
  }, [stopTimer]);

  const setZoneThresh = useCallback(
    (z: ZoneId, v: number) => {
      if (phase === "drill") return;
      setThresh((prev) => ({ ...prev, [z]: v }));
      if (phase === "won") setPhase("setup");
    },
    [phase],
  );

  const toggleWire = useCallback(
    (sensor: ZoneId) => {
      if (phase === "drill") return;
      setWiring((prev) => ({
        ...prev,
        [sensor]: prev[sensor] === "A" ? "B" : "A",
      }));
      if (phase === "won") setPhase("setup");
    },
    [phase],
  );

  const wiringOk = wiring.A === "A" && wiring.B === "B";
  const threshOk =
    thresh.A >= SAFE_BAND_LO &&
    thresh.A <= SAFE_BAND_HI &&
    thresh.B >= SAFE_BAND_LO &&
    thresh.B <= SAFE_BAND_HI;

  const activeEvent = step >= 0 && step < SEQUENCE.length ? SEQUENCE[step] : null;
  const activeRes = step >= 0 ? results[step] : null;

  const status = useMemo(() => {
    if (phase === "won") return "Building Safe — every zone located correctly! 🎉";
    if (phase === "drill") {
      if (activeEvent && activeRes) {
        const verb =
          activeRes.mark === "correct" && activeRes.litZone
            ? `FIRE IN ZONE ${activeEvent.zone}`
            : activeRes.mark === "correct"
              ? "all clear (safe reading)"
              : activeRes.mark === "missed"
                ? "missed a real fire!"
                : activeRes.mark === "false"
                  ? "false alarm!"
                  : "wrong zone lit!";
        return `Drill ${step + 1}/6 — ${verb}`;
      }
      return "Running drill…";
    }
    return "Tune both triggers, wire each sensor to its own zone, then start the drill.";
  }, [phase, step, activeEvent, activeRes]);

  const litZoneNow = activeRes?.litZone ?? null;
  const inDrill = phase === "drill";

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink">
      <style>{`
        @keyframes g5firezonealarm-flameflicker {
          0%,100% { transform: scaleY(1) translateY(0); opacity: 1; }
          50% { transform: scaleY(1.18) translateY(-1px); opacity: .85; }
        }
        @keyframes g5firezonealarm-sound {
          0%,100% { transform: scaleX(.4); opacity: .5; }
          50% { transform: scaleX(1); opacity: 1; }
        }
        @keyframes g5firezonealarm-pop {
          0% { transform: scale(.6); opacity: 0; }
          60% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* ---------------- FLOOR PLAN ---------------- */}
      <div
        className="panel relative overflow-hidden rounded-xl p-2"
        style={
          phase === "won"
            ? { boxShadow: `0 0 0 1px ${ACCENT}, 0 0 24px -4px ${ACCENT}` }
            : undefined
        }
      >
        <svg
          viewBox="0 0 320 150"
          className="block h-auto w-full"
          role="img"
          aria-label="Building floor plan with Zone A kitchen and Zone B storeroom"
        >
          {/* outer wall */}
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
          {/* dividing wall */}
          <line x1={160} y1={8} x2={160} y2={142} stroke="#1b2433" strokeWidth={3} />

          {ZONES.map((z, zi) => {
            const x0 = zi === 0 ? 4 : 160;
            const cx = x0 + 78;
            const isFire =
              activeEvent?.zone === z.id && activeRes?.mark !== "pending";
            const burning =
              isFire &&
              (activeRes?.mark === "correct" || activeRes?.mark === "miswire") &&
              activeEvent?.fire === true;
            const litHere = litZoneNow === z.id;
            return (
              <g key={z.id}>
                {/* zone fill — flashes green when correctly located */}
                <rect
                  x={x0 + 6}
                  y={10}
                  width={148}
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
                <text x={cx} y={26} fill="#9aa6b2" fontSize={9} textAnchor="middle">
                  ZONE {z.id} · {z.name.toUpperCase()}
                </text>
                {/* room emoji */}
                <text x={cx} y={70} fontSize={30} textAnchor="middle">
                  {z.emoji}
                </text>
                {/* flame sensor dot */}
                <circle
                  cx={x0 + 24}
                  cy={120}
                  r={6}
                  fill={isFire ? WARM : "#243042"}
                  stroke={ACCENT}
                  strokeWidth={1.2}
                />
                <text x={x0 + 24} y={138} fill="#67748a" fontSize={7} textAnchor="middle">
                  sensor
                </text>
                {/* live flame when this event burns in this zone */}
                {burning && (
                  <text
                    x={cx}
                    y={106}
                    fontSize={22}
                    textAnchor="middle"
                    style={{
                      transformOrigin: `${cx}px 100px`,
                      animation:
                        "g5firezonealarm-flameflicker .5s ease-in-out infinite",
                    }}
                  >
                    🔥
                  </text>
                )}
                {/* FIRE callout */}
                {litHere &&
                  activeRes?.mark === "correct" &&
                  activeEvent?.fire === true && (
                    <text
                      x={cx}
                      y={92}
                      fill={ACCENT}
                      fontSize={9}
                      fontWeight={700}
                      textAnchor="middle"
                      style={{ animation: "g5firezonealarm-pop .3s ease-out" }}
                    >
                      FIRE IN ZONE {z.id}
                    </text>
                  )}
              </g>
            );
          })}

          {/* green shield when won */}
          {phase === "won" && (
            <g style={{ animation: "g5firezonealarm-pop .4s ease-out" }}>
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
                BUILDING SAFE
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* ---------------- STATUS ---------------- */}
      <div
        role="status"
        aria-live="polite"
        className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-center text-xs"
        style={{
          color:
            phase === "won"
              ? ACCENT
              : activeRes?.mark === "missed" ||
                  activeRes?.mark === "false" ||
                  activeRes?.mark === "miswire"
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
              {SEQUENCE[i].zone}
            </span>
          );
        })}
      </div>

      {/* ---------------- THRESHOLD SLIDERS ---------------- */}
      <div className="panel flex flex-col gap-2.5 rounded-xl p-3">
        <p className="text-[11px] uppercase tracking-tech text-ink-faint">
          1 · Set each trigger line
        </p>
        {ZONES.map((z) => {
          const t = thresh[z.id];
          const tooLow = t < SAFE_BAND_LO;
          const tooHigh = t > SAFE_BAND_HI;
          const okColor = tooLow ? WARM : tooHigh ? DANGER : ACCENT;
          return (
            <label key={z.id} className="flex flex-col gap-1 text-xs">
              <span className="flex items-center justify-between">
                <span className="text-ink-dim">
                  {z.emoji} Zone {z.id} trigger
                </span>
                <span className="tabular-nums" style={{ color: okColor }}>
                  {t}
                  {tooLow ? " · false alarms" : tooHigh ? " · misses fire" : " · ✓"}
                </span>
              </span>
              {/* mini bar showing the safe band */}
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-panel-2">
                <span
                  className="absolute inset-y-0"
                  style={{
                    left: `${SAFE_BAND_LO}%`,
                    width: `${SAFE_BAND_HI - SAFE_BAND_LO}%`,
                    background: `${ACCENT}40`,
                  }}
                />
              </div>
              <input
                type="range"
                min={20}
                max={100}
                step={1}
                value={t}
                disabled={inDrill}
                onChange={(e) => setZoneThresh(z.id, Number(e.target.value))}
                aria-label={`Zone ${z.id} flame trigger threshold, currently ${t}`}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-50"
                style={{ accentColor: okColor }}
              />
            </label>
          );
        })}
      </div>

      {/* ---------------- WIRING PANEL ---------------- */}
      <div className="panel flex flex-col gap-2 rounded-xl p-3">
        <p className="text-[11px] uppercase tracking-tech text-ink-faint">
          2 · Wire each sensor to its own zone light + tone
        </p>
        {ZONES.map((z) => {
          const target = wiring[z.id];
          const ok = target === z.id;
          const tone = ZONES.find((x) => x.id === target)?.correctTone ?? "low";
          return (
            <div
              key={z.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-line bg-panel/60 p-2"
            >
              <span className="flex items-center gap-1.5 text-xs text-ink">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: ACCENT }}
                  aria-hidden
                />
                Sensor {z.id}
              </span>
              <span aria-hidden className="text-ink-faint">
                →
              </span>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  toggleWire(z.id);
                }}
                disabled={inDrill}
                aria-label={`Sensor ${z.id} is wired to Zone ${target} light and ${TONE_LABEL[tone]}. Tap to change.`}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                style={{
                  background: ok ? `${ACCENT}22` : `${DANGER}1f`,
                  color: ok ? ACCENT : DANGER,
                  border: `1px solid ${ok ? ACCENT : DANGER}`,
                  touchAction: "manipulation",
                }}
              >
                <span>
                  Light {target} · {TONE_LABEL[tone]}
                </span>
                {/* animated sound icon */}
                <span className="flex items-end gap-[2px]" aria-hidden>
                  {[0, 1, 2].map((b) => (
                    <span
                      key={b}
                      className="inline-block w-[3px] rounded-sm"
                      style={{
                        height: tone === "high" ? 12 - b * 3 : 6 + b * 2,
                        background: ok ? ACCENT : DANGER,
                        animation: `g5firezonealarm-sound ${
                          0.5 + b * 0.12
                        }s ease-in-out infinite`,
                      }}
                    />
                  ))}
                </span>
              </button>
            </div>
          );
        })}
        {!inDrill && phase !== "won" && (
          <p className="text-[11px] leading-tight text-ink-faint">
            {wiringOk
              ? threshOk
                ? "Wiring and triggers look right — start the drill! ✓"
                : "Wiring's good. Now make sure both triggers sit in the green band."
              : "Each sensor should drive its OWN zone — tap a button to re-route it."}
          </p>
        )}
      </div>

      {/* ---------------- CONTROLS ---------------- */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink-faint">Drills: {tries}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
            aria-label="Reset thresholds and wiring"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={inDrill}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            style={{ background: ACCENT, color: "#05070d" }}
            aria-label="Start the fire drill sequence"
          >
            {inDrill ? "Drill running…" : "Start Drill 🚨"}
          </button>
        </div>
      </div>

      {/* ---------------- WIN CELEBRATION ---------------- */}
      {phase === "won" && (
        <div
          className="rounded-xl border p-3 text-center"
          style={{ borderColor: ACCENT, background: `${ACCENT}14` }}
        >
          <div className="text-2xl" aria-hidden>
            ✨🎉 ⭐⭐⭐
          </div>
          <p className="mt-1 text-sm font-semibold" style={{ color: ACCENT }}>
            Building Safe! Every zone located, zero false alarms.
          </p>
        </div>
      )}
    </div>
  );
}
