"use client";
// Learning goal: an assistive sensor maps DISTANCE readings from three zones to
// graded HAPTIC alerts using threshold rules — set each zone's threshold so its
// obstacle falls inside the trigger range, and pick the right buzz response, so
// every obstacle on the course is detected (multi-zone threshold sensing).
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

const ACCENT = "#34d399";

/** The three ultrasonic beams on the stick. */
type Zone = "front" | "low" | "upper";
const ZONES: readonly Zone[] = ["front", "low", "upper"] as const;

/** A vibration pattern the learner assigns to a zone. */
type Buzz = "proportional" | "rapid" | "pulse";
const BUZZ_OPTIONS: readonly Buzz[] = ["proportional", "rapid", "pulse"] as const;

interface ZoneSpec {
  label: string;
  icon: string;
  /** Beam aim in plain words. */
  aim: string;
  /** Slider bounds for this zone's threshold (cm). */
  min: number;
  max: number;
  /** The buzz pattern this zone is SUPPOSED to use. */
  correctBuzz: Buzz;
  /** Recommended threshold the Hint reveals (cm). */
  recommend: number;
}

/** Each zone aims its beam at a different height and needs its own response. */
const SPEC: Record<Zone, ZoneSpec> = {
  front: {
    label: "Front beam",
    icon: "🧍",
    aim: "chest height, straight ahead",
    min: 40,
    max: 160,
    correctBuzz: "proportional",
    recommend: 100,
  },
  low: {
    label: "Low beam",
    icon: "🪜",
    aim: "angled down at the ground",
    min: 10,
    max: 80,
    correctBuzz: "rapid",
    recommend: 30,
  },
  upper: {
    label: "Upper beam",
    icon: "🌉",
    aim: "tilted up, overhead",
    min: 100,
    max: 240,
    correctBuzz: "pulse",
    recommend: 180,
  },
};

const BUZZ_LABEL: Record<Buzz, string> = {
  proportional: "Rising buzz (closer = stronger)",
  rapid: "Rapid buzz (fast warning)",
  pulse: "Single pulse (one tap)",
};

/** One obstacle on the deterministic corridor, sensed by exactly one zone. */
interface Obstacle {
  id: string;
  zone: Zone;
  label: string;
  icon: string;
  /** The fixed distance reading (cm) when the walker reaches it. */
  dist: number;
}

/**
 * A fixed course, revealed one obstacle at a time as the walker advances.
 * Each obstacle is caught only if its zone's threshold is set so dist < threshold
 * AND the zone uses its correct buzz pattern. The recommended thresholds
 * (100 / 30 / 180) all sit comfortably above these readings, so the course is
 * always winnable; readings are well clear of the slider grid so there is no
 * knife-edge tie.
 */
const COURSE: readonly Obstacle[] = [
  { id: "wall", zone: "front", label: "Wall ahead", icon: "🧱", dist: 80 },
  { id: "step", zone: "low", label: "Step down", icon: "⬇️", dist: 20 },
  { id: "beam", zone: "upper", label: "Low beam overhead", icon: "🚧", dist: 150 },
] as const;

const TOTAL = COURSE.length;

/** Sensible starting thresholds — deliberately too tight, so nothing fires yet. */
const START_THRESH: Record<Zone, number> = { front: 50, low: 15, upper: 110 };
/** Start with the wrong buzz everywhere so the learner must also choose. */
const START_BUZZ: Record<Zone, Buzz> = {
  front: "pulse",
  low: "pulse",
  upper: "rapid",
};

/** Buzz intensity (0–1) a zone produces for a reading inside its threshold. */
function buzzIntensity(zone: Zone, dist: number, thresh: number): number {
  if (dist >= thresh) return 0;
  if (zone === "front") {
    // proportional: closer ⇒ stronger, scaled across the threshold window
    return Math.max(0.15, Math.min(1, 1 - dist / thresh));
  }
  return 1; // rapid / pulse fire at full strength once triggered
}

/** Does this obstacle get DETECTED under the current rules? Deterministic. */
function isDetected(
  obs: Obstacle,
  thresh: Record<Zone, number>,
  buzz: Record<Zone, Buzz>,
): boolean {
  const z = obs.zone;
  const fires = obs.dist < thresh[z];
  const rightResponse = buzz[z] === SPEC[z].correctBuzz;
  return fires && rightResponse;
}

interface Marked {
  obs: Obstacle;
  detected: boolean;
  intensity: number;
}

export default function SmartBlindStick({ onComplete }: ActivityProps) {
  const [thresh, setThresh] = useState<Record<Zone, number>>({ ...START_THRESH });
  const [buzz, setBuzz] = useState<Record<Zone, Buzz>>({ ...START_BUZZ });
  /** How many obstacles the walker has stepped up to (-1 = at start). */
  const [step, setStep] = useState<number>(-1);
  const [solved, setSolved] = useState<boolean>(false);
  const [status, setStatus] = useState<string>(
    "Set the rules, then press WALK to send the walker down the corridor.",
  );
  const firedRef = useRef<boolean>(false);

  /** Mark every obstacle the walker has already reached. */
  const marked = useMemo<Marked[]>(() => {
    const out: Marked[] = [];
    for (let i = 0; i <= step && i < TOTAL; i++) {
      const obs = COURSE[i];
      out.push({
        obs,
        detected: isDetected(obs, thresh, buzz),
        intensity: buzzIntensity(obs.zone, obs.dist, thresh[obs.zone]),
      });
    }
    return out;
  }, [step, thresh, buzz]);

  const hits = useMemo(() => marked.filter((m) => m.detected).length, [marked]);
  const walkedAll = step >= TOTAL - 1;
  const allDetected = walkedAll && hits === TOTAL;

  const fire = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    setSolved(true);
    setStatus("✨ Every obstacle detected — the stick keeps the walker safe!");
    onComplete({
      passed: true,
      stars: 3,
      detail:
        "All 3 zones tuned: front/low/upper thresholds caught the wall, step and overhead beam with the right haptic alert each.",
    });
  }, [onComplete]);

  const nudge = useCallback(
    (missed: Marked[]) => {
      if (firedRef.current) return;
      const m = missed[0];
      const tooTight = m.obs.dist >= thresh[m.obs.zone];
      const detail = tooTight
        ? `The ${SPEC[m.obs.zone].label.toLowerCase()} read ${m.obs.dist}cm but only alerts under ${thresh[m.obs.zone]}cm — widen that threshold.`
        : `The ${SPEC[m.obs.zone].label.toLowerCase()} fired, but its buzz pattern doesn't match the right response for that zone.`;
      setStatus(detail);
      onComplete({ passed: false, detail });
    },
    [thresh, onComplete],
  );

  /** Advance one obstacle. When the last one is reached, grade the run. */
  const walk = useCallback(() => {
    if (firedRef.current) return;
    setStep((prev) => {
      const next = Math.min(prev + 1, TOTAL - 1);
      const reached = COURSE.slice(0, next + 1);
      const results = reached.map((obs) => ({
        obs,
        detected: isDetected(obs, thresh, buzz),
        intensity: buzzIntensity(obs.zone, obs.dist, thresh[obs.zone]),
      }));
      const last = results[results.length - 1];
      if (next < TOTAL - 1) {
        setStatus(
          last.detected
            ? `${last.obs.icon} ${last.obs.label} at ${last.obs.dist}cm — detected! Keep walking.`
            : `${last.obs.icon} ${last.obs.label} at ${last.obs.dist}cm — missed! You can fix the rules and retry.`,
        );
      } else {
        const missed = results.filter((r) => !r.detected);
        if (missed.length === 0) {
          queueMicrotask(fire);
        } else {
          queueMicrotask(() => nudge(missed));
        }
      }
      return next;
    });
  }, [thresh, buzz, fire, nudge]);

  const setZoneThresh = useCallback(
    (zone: Zone) => (e: React.ChangeEvent<HTMLInputElement>) => {
      if (firedRef.current) return;
      const v = Number(e.target.value);
      setThresh((prev) => ({ ...prev, [zone]: v }));
    },
    [],
  );

  const setZoneBuzz = useCallback(
    (zone: Zone) => (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (firedRef.current) return;
      const v = e.target.value as Buzz;
      setBuzz((prev) => ({ ...prev, [zone]: v }));
    },
    [],
  );

  const hint = useCallback(() => {
    if (firedRef.current) return;
    setThresh((prev) => {
      const next = { ...prev };
      for (const z of ZONES) next[z] = SPEC[z].recommend;
      return next;
    });
    setStatus(
      "Hint: thresholds eased to recommended values. Now match each zone's buzz pattern and WALK.",
    );
  }, []);

  const reset = useCallback(() => {
    if (firedRef.current) return; // a solved lab stays solved
    setThresh({ ...START_THRESH });
    setBuzz({ ...START_BUZZ });
    setStep(-1);
    setStatus("Set the rules, then press WALK to send the walker down the corridor.");
  }, []);

  // Walker travels left → right; position scales with progress.
  const walkerX = useMemo(() => {
    const frac = (step + 1) / TOTAL;
    return 14 + frac * 64; // 14% → 78% of the corridor width
  }, [step]);

  return (
    <div
      className="mx-auto flex w-full flex-col gap-3 font-mono text-ink"
      style={{ maxWidth: 440 }}
    >
      <style>{`
        @keyframes g7blindstick-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g7blindstick-buzz {
          0%,100% { transform: translateX(0); }
          25% { transform: translateX(-1.4px); }
          75% { transform: translateX(1.4px); }
        }
        @keyframes g7blindstick-step {
          0% { transform: translateX(-3px); }
          100% { transform: translateX(0); }
        }
      `}</style>

      {/* Corridor */}
      <div
        className="panel relative overflow-hidden rounded-xl p-2"
        style={
          allDetected
            ? { boxShadow: `0 0 0 1px ${ACCENT}, 0 0 22px -4px ${ACCENT}` }
            : undefined
        }
      >
        <svg
          viewBox="0 0 100 64"
          className="block w-full"
          role="img"
          aria-label="Side view of a corridor with a blindfolded walker holding a sensing stick that fires three beams"
        >
          {/* floor + ceiling */}
          <rect x="0" y="0" width="100" height="64" fill="#0b1020" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="#36406a" strokeWidth="0.8" />
          <line x1="0" y1="8" x2="100" y2="8" stroke="#1f2742" strokeWidth="0.8" />

          {/* three beams from the stick tip, drawn before obstacles */}
          {ZONES.map((z) => {
            const reached = marked.find((m) => m.obs.zone === z);
            const lit = reached !== undefined;
            const ok = reached?.detected === true;
            const yByZone: Record<Zone, number> = { front: 30, low: 47, upper: 14 };
            const y = yByZone[z];
            return (
              <line
                key={`beam-${z}`}
                x1={walkerX + 4}
                y1={38}
                x2={walkerX + 22}
                y2={y}
                stroke={lit ? (ok ? ACCENT : "#ef4444") : "#2a3354"}
                strokeWidth={lit ? 1.1 : 0.6}
                strokeDasharray="2 1.6"
                opacity={lit ? 0.9 : 0.5}
              />
            );
          })}

          {/* obstacles, revealed as the walker reaches them */}
          {COURSE.map((obs, i) => {
            const shown = i <= step;
            const m = marked.find((mm) => mm.obs.id === obs.id);
            const x = 14 + ((i + 1) / TOTAL) * 64 + 16;
            const yByZone: Record<Zone, number> = { front: 30, low: 47, upper: 12 };
            return (
              <g key={obs.id} opacity={shown ? 1 : 0.18}>
                <text
                  x={x}
                  y={yByZone[obs.zone]}
                  fontSize={7}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {obs.icon}
                </text>
                {shown && m && (
                  <text
                    x={x}
                    y={yByZone[obs.zone] + 6}
                    fontSize={3}
                    textAnchor="middle"
                    fill={m.detected ? ACCENT : "#ef4444"}
                    style={{ fontWeight: 700 }}
                  >
                    {m.detected ? "✓ detected" : "✗ missed"}
                  </text>
                )}
              </g>
            );
          })}

          {/* the walker */}
          <g
            style={{ animation: step >= 0 ? "g7blindstick-step 300ms ease-out" : undefined }}
          >
            <text
              x={walkerX}
              y={36}
              fontSize={9}
              textAnchor="middle"
              dominantBaseline="central"
            >
              🦯
            </text>
          </g>
        </svg>

        {/* live distance + detection readout */}
        <div className="mt-1 flex items-center justify-between px-1 text-[11px]">
          <span className="text-ink-faint">
            {step < 0
              ? "ready at the start"
              : `reading: ${COURSE[Math.min(step, TOTAL - 1)].label} @ ${COURSE[Math.min(step, TOTAL - 1)].dist}cm`}
          </span>
          <span
            className="font-display tabular-nums"
            style={{ color: hits === TOTAL && walkedAll ? ACCENT : "#cbd3ef" }}
          >
            detected {hits}/{TOTAL}
          </span>
        </div>
      </div>

      {/* status line */}
      <div
        className="rounded-lg px-3 py-2 text-center text-xs"
        role="status"
        aria-live="polite"
        style={{
          background: allDetected ? ACCENT : "rgba(11,16,32,0.6)",
          color: allDetected ? "#05070d" : "#9aa6cf",
        }}
      >
        {status}
      </div>

      {/* Rule editor — one row per zone */}
      <div className="panel flex flex-col gap-3 rounded-xl p-3">
        {ZONES.map((z) => {
          const spec = SPEC[z];
          const m = marked.find((mm) => mm.obs.zone === z);
          const intensity = m?.intensity ?? 0;
          const fired = intensity > 0;
          return (
            <div key={z} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-dim">
                  <span aria-hidden="true">{spec.icon}</span> {spec.label}{" "}
                  <span className="text-ink-faint">· {spec.aim}</span>
                </span>
                {/* vibration motor + live intensity bar */}
                <span
                  className="flex items-center gap-1"
                  aria-label={`${spec.label} motor ${fired ? "buzzing" : "quiet"}`}
                  style={{
                    animation: fired ? "g7blindstick-buzz 120ms linear infinite" : undefined,
                  }}
                >
                  <span aria-hidden="true">📳</span>
                  <span className="relative inline-block h-1.5 w-10 overflow-hidden rounded-full bg-panel-2">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${Math.round(intensity * 100)}%`,
                        background: m?.detected ? ACCENT : fired ? "#f59e0b" : "transparent",
                      }}
                    />
                  </span>
                </span>
              </div>

              <label className="flex items-center gap-2 text-[11px]">
                <span className="w-16 shrink-0 text-ink-faint">alert under</span>
                <input
                  type="range"
                  min={spec.min}
                  max={spec.max}
                  step={5}
                  value={thresh[z]}
                  onChange={setZoneThresh(z)}
                  disabled={solved}
                  aria-label={`${spec.label} threshold, alert when nearer than ${thresh[z]} centimetres`}
                  className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-panel-2"
                  style={{ accentColor: ACCENT, touchAction: "none" }}
                />
                <span
                  className="w-14 shrink-0 text-right font-display tabular-nums"
                  style={{ color: ACCENT }}
                >
                  {thresh[z]}cm
                </span>
              </label>

              <label className="flex items-center gap-2 text-[11px]">
                <span className="w-16 shrink-0 text-ink-faint">vibration</span>
                <select
                  value={buzz[z]}
                  onChange={setZoneBuzz(z)}
                  disabled={solved}
                  aria-label={`${spec.label} vibration pattern`}
                  className="flex-1 rounded-md border border-line bg-panel/60 px-2 py-1 text-[11px] text-ink-dim"
                >
                  {BUZZ_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      {BUZZ_LABEL[b]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          );
        })}

        <p className="text-[11px] leading-tight text-ink-faint">
          Each zone alerts when an obstacle is nearer than its threshold. Set the
          threshold above the obstacle&apos;s distance AND pick the buzz that fits
          the zone, then WALK to catch all three.
        </p>

        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={walk}
            disabled={solved || walkedAll}
            className="flex-1 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: ACCENT, color: "#05070d" }}
            aria-label="Send the walker forward one step down the corridor"
          >
            {walkedAll ? "🏁 End of corridor" : "🚶 WALK"}
          </button>
          <button
            type="button"
            onClick={hint}
            disabled={solved}
            className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-sm font-medium text-ink-dim disabled:opacity-50"
            aria-label="Reveal the recommended thresholds"
          >
            Hint
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={solved}
            className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-sm font-medium text-ink-dim disabled:opacity-50"
            aria-label="Reset the walker and all rules to the start"
          >
            Reset
          </button>
        </div>

        {allDetected && (
          <div
            className="mt-1 rounded-lg px-3 py-2 text-center text-sm font-medium"
            style={{
              background: "rgba(52,211,153,0.12)",
              color: ACCENT,
              animation: "g7blindstick-pop 360ms ease-out both",
            }}
            role="status"
            aria-live="polite"
          >
            🎉 ⭐⭐⭐ {hits}/{TOTAL} obstacles detected — every zone tuned to keep the
            walker safe!
          </div>
        )}
      </div>
    </div>
  );
}
