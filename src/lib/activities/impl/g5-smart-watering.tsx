"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Smart Plant Waterer 🌱 ────────────────────────────────────────────────────
   GRADE 5 (explorer, age ~10–11). Subject: AI.
   ONE learning goal: SENSOR-DRIVEN AUTOMATION — a system reads LIVE data and
   decides on its OWN when to act. The learner programs an automatic watering
   rule: "water WHEN moisture drops below ___" plus a pump run-time. A 24-hour
   day runs in fast-forward; the rule fires by itself whenever a pot crosses the
   threshold. Win = keep BOTH plants inside the green healthy zone all day.

   Why it's always winnable (deterministic): moisture drains at a fixed rate and
   a watering adds a fixed amount per run-second, with NO randomness. The healthy
   band is wide (380–760). A threshold around the middle plus a medium run keeps
   both pots in the band the entire day. Too HIGH a threshold floods (overwater,
   blue). Too LOW lets them wilt (dry, red). Mistakes only cost a heart and end
   the day with a kind nudge — never a scold, always retryable.
   ──────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#a855f7";
const GREEN = "#34d399";
const BLUE = "#38bdf8";
const RED = "#f87171";

const GAUGE_MIN = 0;
const GAUGE_MAX = 1000;
const HEALTHY_LO = 380;
const HEALTHY_HI = 760;

const HOURS = 24;
const TICKS_PER_HOUR = 4; // 96 ticks across the day
const TOTAL_TICKS = HOURS * TICKS_PER_HOUR;
const TICK_MS = 70; // fast-forward day

type PotId = "fern" | "cactus";
type Phase = "idle" | "running" | "won" | "lost";
type RunTime = "short" | "medium" | "long";

interface PotConfig {
  id: PotId;
  name: string;
  emoji: string;
  start: number;
  /** Moisture lost per tick — the cactus sips slowly, the fern drinks fast. */
  drainPerTick: number;
}

const POTS: readonly PotConfig[] = [
  { id: "fern", name: "Fern", emoji: "🌿", start: 600, drainPerTick: 13 },
  { id: "cactus", name: "Cactus", emoji: "🌵", start: 540, drainPerTick: 8 },
] as const;

/** Pump output per run length — added back to a pot when the rule fires. */
const RUN_REFILL: Record<RunTime, number> = {
  short: 150,
  medium: 240,
  long: 330,
};
const RUN_LABEL: Record<RunTime, string> = {
  short: "Short",
  medium: "Medium",
  long: "Long",
};
const RUN_WATER: Record<RunTime, number> = { short: 1, medium: 2, long: 3 };
const RUN_ORDER: readonly RunTime[] = ["short", "medium", "long"] as const;

interface PotState {
  moisture: number;
  pumping: number; // ticks left of the watering animation
  flooded: boolean;
  wilted: boolean;
  trace: number[]; // moisture history for the line chart
}

function freshPot(cfg: PotConfig): PotState {
  return {
    moisture: cfg.start,
    pumping: 0,
    flooded: false,
    wilted: false,
    trace: [cfg.start],
  };
}

function freshStates(): Record<PotId, PotState> {
  return {
    fern: freshPot(POTS[0]),
    cactus: freshPot(POTS[1]),
  };
}

/** Map a moisture value to a 0..1 fill fraction for the gauge. */
function frac(m: number): number {
  return Math.max(0, Math.min(1, (m - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN)));
}

const GAUGE_H = 132;
const GAUGE_W = 30;
const CHART_W = 150;
const CHART_H = 60;

export default function SmartPlantWaterer({ onComplete }: ActivityProps) {
  // A deliberately-too-high start: at 700 the rule waters far too eagerly and
  // floods a pot. The learner drags the marker DOWN into the discoverable band.
  const [threshold, setThreshold] = useState<number>(700);
  const [runTime, setRunTime] = useState<RunTime>("short");
  const [phase, setPhase] = useState<Phase>("idle");
  const [tick, setTick] = useState<number>(0);
  const [states, setStates] = useState<Record<PotId, PotState>>(freshStates);
  const [hearts, setHearts] = useState<number>(3);
  const [water, setWater] = useState<number>(0);
  const [day, setDay] = useState<number>(0);

  // Refs so the deterministic loop reads fresh values without re-binding.
  const phaseRef = useRef<Phase>("idle");
  const thresholdRef = useRef<number>(threshold);
  const runTimeRef = useRef<RunTime>(runTime);
  const tickRef = useRef<number>(0);
  const statesRef = useRef<Record<PotId, PotState>>(states);
  const heartsRef = useRef<number>(3);
  const waterRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const doneRef = useRef<boolean>(false); // guards the single success call

  useEffect(() => {
    thresholdRef.current = threshold;
  }, [threshold]);
  useEffect(() => {
    runTimeRef.current = runTime;
  }, [runTime]);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => stopTimer, [stopTimer]);

  const finish = useCallback(
    (won: boolean) => {
      stopTimer();
      if (won) {
        setPhase("won");
        phaseRef.current = "won";
        if (!doneRef.current) {
          doneRef.current = true;
          onComplete({
            passed: true,
            stars: 3,
            detail: `Both plants thrived all day on ${waterRef.current} pump runs!`,
          });
        }
      } else {
        setPhase("lost");
        phaseRef.current = "lost";
        const tooHigh = statesRef.current.fern.flooded || statesRef.current.cactus.flooded;
        onComplete({
          passed: false,
          detail: tooHigh
            ? "A plant got soggy — try a lower threshold or shorter run."
            : "A plant got too dry — water a little sooner or run the pump longer.",
        });
      }
    },
    [onComplete, stopTimer],
  );

  /** Advance the deterministic simulation by exactly one tick. */
  const stepOnce = useCallback(() => {
    const t = tickRef.current;
    const th = thresholdRef.current;
    const refill = RUN_REFILL[runTimeRef.current];
    const prev = statesRef.current;
    let lostThisTick = false;
    let heartsLost = 0;
    let runsThisTick = 0;

    const next = {} as Record<PotId, PotState>;
    for (const cfg of POTS) {
      const p = prev[cfg.id];
      let m = p.moisture - cfg.drainPerTick;
      let pumping = Math.max(0, p.pumping - 1);
      let flooded = p.flooded;
      let wilted = p.wilted;

      // DECIDE: the rule reads the live sensor and acts on its own.
      if (m < th) {
        m += refill;
        pumping = 3;
        runsThisTick += 1;
      }

      // Health checks against the wide green band.
      if (m > HEALTHY_HI) {
        flooded = true;
        heartsLost += 1;
        lostThisTick = true;
      } else if (m < HEALTHY_LO) {
        wilted = true;
        heartsLost += 1;
        lostThisTick = true;
      }

      m = Math.max(GAUGE_MIN, Math.min(GAUGE_MAX, m));
      const trace = p.trace.length > TOTAL_TICKS ? p.trace : [...p.trace, m];
      next[cfg.id] = { moisture: m, pumping, flooded, wilted, trace };
    }

    statesRef.current = next;
    setStates(next);

    if (runsThisTick > 0) {
      waterRef.current += runsThisTick;
      setWater(waterRef.current);
    }

    if (heartsLost > 0) {
      heartsRef.current = Math.max(0, heartsRef.current - heartsLost);
      setHearts(heartsRef.current);
    }

    const nt = t + 1;
    tickRef.current = nt;
    setTick(nt);

    if (lostThisTick) {
      finish(false);
      return;
    }
    if (nt >= TOTAL_TICKS) {
      finish(true);
      return;
    }
  }, [finish]);

  const handleRun = useCallback(() => {
    stopTimer();
    const fresh = freshStates();
    statesRef.current = fresh;
    setStates(fresh);
    tickRef.current = 0;
    setTick(0);
    heartsRef.current = 3;
    setHearts(3);
    waterRef.current = 0;
    setWater(0);
    setDay((d) => d + 1);
    setPhase("running");
    phaseRef.current = "running";
    timerRef.current = window.setInterval(() => {
      if (phaseRef.current !== "running") return;
      stepOnce();
    }, TICK_MS);
  }, [stepOnce, stopTimer]);

  const handleReset = useCallback(() => {
    stopTimer();
    const fresh = freshStates();
    statesRef.current = fresh;
    setStates(fresh);
    tickRef.current = 0;
    setTick(0);
    heartsRef.current = 3;
    setHearts(3);
    waterRef.current = 0;
    setWater(0);
    setPhase("idle");
    phaseRef.current = "idle";
  }, [stopTimer]);

  const running = phase === "running";

  // ── Threshold drag handling (pointer-based, touch-first). ──
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<boolean>(false);

  const moveThresholdToClientY = useCallback(
    (clientY: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const rel = (clientY - rect.top) / rect.height; // 0 at top
      const value = GAUGE_MAX - rel * (GAUGE_MAX - GAUGE_MIN);
      const clamped = Math.round(Math.max(GAUGE_MIN + 40, Math.min(GAUGE_MAX - 40, value)));
      setThreshold(clamped);
    },
    [],
  );

  const onTrackPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (phaseRef.current === "running") return;
      if (phaseRef.current === "won" || phaseRef.current === "lost") handleReset();
      draggingRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      moveThresholdToClientY(e.clientY);
    },
    [handleReset, moveThresholdToClientY],
  );

  const onTrackPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      moveThresholdToClientY(e.clientY);
    },
    [moveThresholdToClientY],
  );

  const onTrackPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  const nudgeThreshold = useCallback(
    (delta: number) => {
      if (phaseRef.current === "running") return;
      if (phaseRef.current === "won" || phaseRef.current === "lost") handleReset();
      setThreshold((v) => Math.round(Math.max(GAUGE_MIN + 40, Math.min(GAUGE_MAX - 40, v + delta))));
    },
    [handleReset],
  );

  const cycleRunTime = useCallback(
    (dir: 1 | -1) => {
      if (phaseRef.current === "running") return;
      if (phaseRef.current === "won" || phaseRef.current === "lost") handleReset();
      setRunTime((rt) => {
        const i = RUN_ORDER.indexOf(rt);
        const ni = Math.max(0, Math.min(RUN_ORDER.length - 1, i + dir));
        return RUN_ORDER[ni];
      });
    },
    [handleReset],
  );

  const hour = Math.min(HOURS, Math.floor(tick / TICKS_PER_HOUR));
  const clock = `${String(hour).padStart(2, "0")}:00`;
  // A simple deterministic sun brightness curve, peaking at midday.
  const sun = Math.max(0.1, Math.sin((Math.min(tick, TOTAL_TICKS) / TOTAL_TICKS) * Math.PI));

  const bothHealthy = useMemo(
    () =>
      (Object.values(states) as PotState[]).every(
        (p) => !p.flooded && !p.wilted,
      ),
    [states],
  );

  const status = useMemo(() => {
    if (phase === "won") return "Both plants happy all day! ✨";
    if (phase === "lost") return "Day ended early — tune the rule and retry.";
    if (phase === "running") return `Day running… ${clock} · ${hour}/${HOURS}h`;
    return "Set the rule, then press Run Day ▶";
  }, [phase, clock, hour]);

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3 text-ink">
      <style>{`
        @keyframes g5smartwatering-drip {
          0% { transform: translateY(-6px); opacity: 0; }
          30% { opacity: 1; }
          100% { transform: translateY(14px); opacity: 0; }
        }
        @keyframes g5smartwatering-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes g5smartwatering-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* ── DASHBOARD ── */}
      <div
        className="panel relative overflow-hidden rounded-xl p-3"
        style={{
          boxShadow:
            phase === "won" ? `0 0 0 1px ${ACCENT}, 0 0 24px -4px ${ACCENT}` : undefined,
          transition: "box-shadow .3s ease",
        }}
      >
        {/* header: sun + clock + hearts */}
        <div className="mb-2 flex items-center justify-between">
          <span
            className="text-lg"
            style={{ filter: `brightness(${0.7 + sun * 0.8})`, transition: "filter .15s linear" }}
            aria-hidden
          >
            ☀️
          </span>
          <span
            className="font-mono text-sm tabular-nums"
            style={{ color: ACCENT }}
            role="timer"
            aria-label={`Simulated time ${clock}`}
          >
            {clock}
          </span>
          <span aria-label={`${hearts} health hearts remaining`} className="text-sm">
            {"❤️".repeat(hearts)}
            <span aria-hidden style={{ opacity: 0.25 }}>
              {"🤍".repeat(3 - hearts)}
            </span>
          </span>
        </div>

        {/* two pots side by side */}
        <div className="flex items-stretch justify-around gap-2">
          {POTS.map((cfg) => {
            const p = states[cfg.id];
            const f = frac(p.moisture);
            const fillH = f * GAUGE_H;
            const loY = (1 - frac(HEALTHY_LO)) * GAUGE_H;
            const hiY = (1 - frac(HEALTHY_HI)) * GAUGE_H;
            const mood = !p.flooded && !p.wilted ? "😊" : "😟";
            const barColor = p.flooded ? BLUE : p.wilted ? RED : GREEN;
            const trace = p.trace;
            const chartD =
              trace.length > 1
                ? trace
                    .map((m, i) => {
                      const x = (i / TOTAL_TICKS) * CHART_W;
                      const y = (1 - frac(m)) * CHART_H;
                      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
                    })
                    .join(" ")
                : "";
            return (
              <div key={cfg.id} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex items-center gap-1 text-sm">
                  <span aria-hidden>{cfg.emoji}</span>
                  <span className="font-mono text-xs text-ink-dim">{cfg.name}</span>
                  <span aria-hidden>{mood}</span>
                </div>

                {/* gauge */}
                <div className="relative" style={{ width: GAUGE_W, height: GAUGE_H }}>
                  <svg
                    width={GAUGE_W}
                    height={GAUGE_H}
                    viewBox={`0 0 ${GAUGE_W} ${GAUGE_H}`}
                    role="img"
                    aria-label={`${cfg.name} soil moisture ${Math.round(p.moisture)} of ${GAUGE_MAX}`}
                  >
                    {/* tube */}
                    <rect
                      x={1}
                      y={1}
                      width={GAUGE_W - 2}
                      height={GAUGE_H - 2}
                      rx={7}
                      fill="#0b1220"
                      stroke="#1b2433"
                      strokeWidth={1}
                    />
                    {/* healthy zone band */}
                    <rect
                      x={2}
                      y={hiY}
                      width={GAUGE_W - 4}
                      height={Math.max(2, loY - hiY)}
                      fill={GREEN}
                      opacity={0.16}
                    />
                    <line x1={2} y1={hiY} x2={GAUGE_W - 2} y2={hiY} stroke={GREEN} strokeWidth={0.6} opacity={0.5} />
                    <line x1={2} y1={loY} x2={GAUGE_W - 2} y2={loY} stroke={GREEN} strokeWidth={0.6} opacity={0.5} />
                    {/* moisture fill */}
                    <rect
                      x={2}
                      y={GAUGE_H - fillH}
                      width={GAUGE_W - 4}
                      height={fillH}
                      rx={5}
                      fill={barColor}
                      opacity={0.85}
                      style={{ transition: "y .12s linear, height .12s linear" }}
                    />
                    {/* watering drip while the pump runs */}
                    {p.pumping > 0 && (
                      <g style={{ animation: "g5smartwatering-drip .5s linear infinite" }}>
                        <circle cx={GAUGE_W / 2} cy={10} r={2} fill={BLUE} />
                      </g>
                    )}
                  </svg>
                </div>

                {/* pump + reading */}
                <div className="flex items-center gap-1">
                  <span
                    className="text-sm"
                    aria-hidden
                    style={
                      p.pumping > 0
                        ? { display: "inline-block", animation: "g5smartwatering-spin .6s linear infinite" }
                        : { opacity: 0.4 }
                    }
                  >
                    ⚙️
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-ink-dim">
                    {Math.round(p.moisture)}
                  </span>
                </div>

                {/* mini moisture trace over the day */}
                <svg
                  width={CHART_W}
                  height={CHART_H}
                  viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                  className="rounded bg-panel/60"
                  role="img"
                  aria-label={`${cfg.name} moisture over the day`}
                >
                  <rect
                    x={0}
                    y={(1 - frac(HEALTHY_HI)) * CHART_H}
                    width={CHART_W}
                    height={(frac(HEALTHY_HI) - frac(HEALTHY_LO)) * CHART_H}
                    fill={GREEN}
                    opacity={0.12}
                  />
                  {chartD && <path d={chartD} fill="none" stroke={barColor} strokeWidth={1.4} />}
                </svg>
              </div>
            );
          })}
        </div>

        {/* status line */}
        <div className="mt-2 flex items-center justify-between px-1">
          <span
            className="font-mono text-[11px]"
            style={phase === "won" ? { color: ACCENT } : undefined}
            role="status"
            aria-live="polite"
          >
            {status}
          </span>
          <span className="font-mono text-[11px] text-ink-faint">💧 {water} runs</span>
        </div>

        {/* win celebration */}
        {phase === "won" && (
          <div
            className="mt-2 flex items-center justify-center gap-2 rounded-lg py-2"
            style={{ background: `${ACCENT}22`, animation: "g5smartwatering-pop .4s ease both" }}
          >
            <span className="text-lg" aria-hidden>
              ✨🎉
            </span>
            <span className="font-display text-sm" style={{ color: ACCENT }}>
              ⭐⭐⭐ Garden saved!
            </span>
          </div>
        )}
      </div>

      {/* ── RULE EDITOR ── */}
      <div className="panel flex flex-col gap-3 rounded-xl p-3">
        <p className="font-mono text-[11px] uppercase tracking-tech text-ink-faint">
          Automation rule: water when moisture is below…
        </p>

        <div className="flex items-center gap-3">
          {/* draggable threshold track */}
          <div
            ref={trackRef}
            onPointerDown={onTrackPointerDown}
            onPointerMove={onTrackPointerMove}
            onPointerUp={onTrackPointerUp}
            onPointerCancel={onTrackPointerUp}
            role="slider"
            aria-label="Watering threshold"
            aria-valuemin={GAUGE_MIN + 40}
            aria-valuemax={GAUGE_MAX - 40}
            aria-valuenow={threshold}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") {
                e.preventDefault();
                nudgeThreshold(20);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                nudgeThreshold(-20);
              }
            }}
            className="relative cursor-pointer rounded-lg"
            style={{ width: 44, height: GAUGE_H, touchAction: "none", background: "#0b1220", border: "1px solid #1b2433" }}
          >
            {/* healthy band reference */}
            <div
              className="pointer-events-none absolute left-0 right-0"
              style={{
                top: (1 - frac(HEALTHY_HI)) * GAUGE_H,
                height: (frac(HEALTHY_HI) - frac(HEALTHY_LO)) * GAUGE_H,
                background: `${GREEN}22`,
              }}
            />
            {/* threshold marker */}
            <div
              className="pointer-events-none absolute left-0 right-0 flex items-center"
              style={{ top: (1 - frac(threshold)) * GAUGE_H - 1 }}
            >
              <div style={{ height: 3, width: "100%", background: ACCENT, boxShadow: `0 0 6px ${ACCENT}` }} />
            </div>
            <div
              className="pointer-events-none absolute"
              style={{
                top: (1 - frac(threshold)) * GAUGE_H - 8,
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: 11,
              }}
              aria-hidden
            >
              💧
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-ink-dim">Threshold</span>
              <span className="font-display tabular-nums" style={{ color: ACCENT }}>
                {threshold}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => nudgeThreshold(-20)}
                disabled={running}
                aria-label="Lower the watering threshold"
                className="flex-1 rounded-md border border-line bg-panel/60 py-1.5 font-mono text-sm text-ink-dim disabled:opacity-50"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => nudgeThreshold(20)}
                disabled={running}
                aria-label="Raise the watering threshold"
                className="flex-1 rounded-md border border-line bg-panel/60 py-1.5 font-mono text-sm text-ink-dim disabled:opacity-50"
              >
                +
              </button>
            </div>

            {/* pump run-time stepper */}
            <div className="mt-1 flex items-center justify-between">
              <span className="font-mono text-xs text-ink-dim">Pump run</span>
              <span className="font-display" style={{ color: ACCENT }}>
                {RUN_LABEL[runTime]} · {"💧".repeat(RUN_WATER[runTime])}
              </span>
            </div>
            <div className="flex gap-2" role="group" aria-label="Pump run-time stepper">
              <button
                type="button"
                onClick={() => cycleRunTime(-1)}
                disabled={running}
                aria-label="Shorter pump run"
                className="flex-1 rounded-md border border-line bg-panel/60 py-1.5 font-mono text-sm text-ink-dim disabled:opacity-50"
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => cycleRunTime(1)}
                disabled={running}
                aria-label="Longer pump run"
                className="flex-1 rounded-md border border-line bg-panel/60 py-1.5 font-mono text-sm text-ink-dim disabled:opacity-50"
              >
                ▶
              </button>
            </div>
          </div>
        </div>

        {/* nudge when close: lost on a small miss */}
        {phase === "lost" && bothHealthy === false && (
          <p className="text-[11px]" style={{ color: ACCENT }}>
            Almost! Watch which gauge left the green — adjust just that direction.
          </p>
        )}

        {/* controls */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-ink-faint">Day: {day}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
              aria-label="Reset the garden"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleRun}
              disabled={running}
              className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
              style={{ background: ACCENT, color: "#05070d" }}
              aria-label="Run the day simulation"
            >
              {running ? "Running…" : "Run Day ▶"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
