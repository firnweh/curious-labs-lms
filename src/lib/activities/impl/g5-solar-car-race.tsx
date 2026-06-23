"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Solar Car Energy Race — light → electricity → speed               */
/*  LEARNING GOAL: a solar car runs on electricity its panel makes     */
/*  from light, so it goes faster with MORE light (bright sun + panel  */
/*  aimed at it), LESS weight, and LESS friction. The learner tunes    */
/*  tilt, cargo and tires, then races a deterministic 10-second run.   */
/*                                                                     */
/*  THREE ESCALATING ROUNDS turn this into a real problem, not a       */
/*  "max every slider" toy:                                            */
/*   1) Warm-up: free tuning, cross the finish — learn the model.      */
/*   2) Cloudy afternoon (TWIST): the sun is LOCKED low. You cannot    */
/*      brighten it, so the only way to win is to AIM the panel right  */
/*      at the low sun and shed every gram of drag. Maxing fails.      */
/*   3) Delivery run (CONSTRAINT + OPTIMISE): you MUST carry cargo,    */
/*      and the more blocks you still deliver across a longer track    */
/*      the more stars you earn. Many setups finish; the smart one     */
/*      finishes with the heaviest load.                               */
/* ------------------------------------------------------------------ */

const ACCENT = "#34d399";
const VIEW_W = 320;
const VIEW_H = 200;

// Track geometry (SVG space).
const ROAD_Y = 150; // car sits on this line
const START_X = 30; // start line
const FINISH_X = 296; // finish line
const TRACK_LEN = FINISH_X - START_X; // car travels this far across screen

const RUN_SECONDS = 10; // race length

// Three cargo blocks the learner can drop. Each adds weight (kg).
const CARGO_KG = 6;
const BASE_KG = 8; // chassis + panel + motor

type Tire = "smooth" | "rough";
type Phase = "tune" | "racing" | "won" | "lost" | "done";

interface Setup {
  /** Sun height 0 (horizon) .. 100 (overhead). Brighter when higher. */
  sunHeight: number;
  /** Panel tilt 0 (flat) .. 90 (straight up), in degrees. */
  tilt: number;
  /** Cargo blocks still loaded (0..3). */
  cargo: number;
  tire: Tire;
}

/** A round: its track length, locks, and what counts as a win. */
interface Round {
  name: string;
  brief: string;
  /** Metres to cross the finish line this round. */
  winDistance: number;
  /** Setup the round opens with. */
  start: Setup;
  /** Variables the learner may NOT change this round. */
  lockSun: boolean;
  lockTilt: boolean;
  lockCargo: boolean;
  lockTire: boolean;
  /** Minimum cargo blocks that must stay aboard (a delivery). */
  minCargo: number;
  /** True if extra cargo delivered earns extra stars (optimisation round). */
  optimiseCargo: boolean;
}

const ROUNDS: ReadonlyArray<Round> = [
  {
    name: "Warm-up lap",
    brief: "Tune anything you like and cross the line. Learn what makes power.",
    winDistance: 100,
    start: { sunHeight: 35, tilt: 10, cargo: 3, tire: "rough" },
    lockSun: false,
    lockTilt: false,
    lockCargo: false,
    lockTire: false,
    minCargo: 0,
    optimiseCargo: false,
  },
  {
    name: "Cloudy afternoon",
    brief: "The sun is stuck low and you can't raise it. Aim the panel right at it and cut every drag.",
    // Best possible run with a locked-low sun is ~71 m, so 65 m demands a
    // near-perfect aim AND zero cargo AND smooth tires — no sloppy setup clears it.
    winDistance: 65,
    // Sun locked low → brightness is weak; only a near-perfect aim + zero cargo + smooth tires clears it.
    start: { sunHeight: 25, tilt: 70, cargo: 2, tire: "rough" },
    lockSun: true,
    lockTilt: false,
    lockCargo: false,
    lockTire: false,
    minCargo: 0,
    optimiseCargo: false,
  },
  {
    name: "Delivery run",
    brief: "Deliver the cargo across a LONGER track. Finish with MORE blocks aboard for more stars.",
    // Max speed with 3 blocks (full sun, perfect aim, smooth tires) ≈ 13.96 m/s
    // → ~139.6 m, so 135 m is clearable with all 3 aboard but only by a sharp
    // setup; lighter loads clear easily, making "deliver more" the real challenge.
    winDistance: 135,
    // Must keep at least 1 block; bright sun is available but cargo fights you.
    start: { sunHeight: 60, tilt: 54, cargo: 3, tire: "smooth" },
    lockSun: false,
    lockTilt: false,
    lockCargo: false,
    lockTire: false,
    minCargo: 1,
    optimiseCargo: true,
  },
];

/** Sun's brightness fraction (0..1): higher in the sky = more light energy. */
function brightness(sunHeight: number): number {
  return 0.25 + 0.75 * (sunHeight / 100);
}

/**
 * The sun's angle above the horizon, in degrees (0..90).
 * The panel makes the MOST power when it faces the sun squarely, which
 * happens when the panel tilt points right at the sun.
 */
function sunAngleDeg(sunHeight: number): number {
  return (sunHeight / 100) * 90;
}

/** How well the panel is aimed at the sun: 1.0 = pointed straight at it. */
function aimMatch(tilt: number, sunHeight: number): number {
  const diff = Math.abs(tilt - sunAngleDeg(sunHeight)); // 0..90
  // cosine of the miss-angle, floored so a bad aim still trickles power.
  return Math.max(0.1, Math.cos((diff * Math.PI) / 180));
}

/** Total weight (kg) of the car given the cargo still loaded. */
function totalKg(cargo: number): number {
  return BASE_KG + cargo * CARGO_KG;
}

interface Power {
  /** Volts shown on the panel meter (0..~3.6). */
  volts: number;
  /** Light captured 0..1 (brightness × aim). */
  captured: number;
  /** Final car speed in metres/second (clamped at 0). */
  speed: number;
}

/**
 * Deterministic energy model. Speed is a clear function of:
 *   captured light  −  weight drag  −  tire friction.
 * Tuned so a bright, well-aimed sun ALWAYS clears the warm-up, while the
 * later rounds (locked sun / required cargo) force genuine trade-offs.
 */
function compute(s: Setup): Power {
  const captured = brightness(s.sunHeight) * aimMatch(s.tilt, s.sunHeight); // 0..1
  const volts = captured * 3.6;

  const drivePower = captured * 18; // m/s of "push" from electricity
  const weightDrag = (totalKg(s.cargo) - BASE_KG) * 0.18; // only cargo slows it
  const friction = s.tire === "rough" ? 3.2 : 0.8;

  const speed = Math.max(0, drivePower - weightDrag - friction);
  return { volts, captured, speed };
}

/** Distance the car would travel in the full run. */
function projectedDistance(s: Setup): number {
  return compute(s).speed * RUN_SECONDS;
}

export default function SolarCarRace({ onComplete }: ActivityProps) {
  const [roundIdx, setRoundIdx] = useState<number>(0);
  const round = ROUNDS[roundIdx];

  const [setup, setSetup] = useState<Setup>({ ...ROUNDS[0].start });
  const [phase, setPhase] = useState<Phase>("tune");
  const [distance, setDistance] = useState<number>(0); // live metres
  const [elapsed, setElapsed] = useState<number>(0); // live seconds
  const [tries, setTries] = useState<number>(0);
  const [lastDistance, setLastDistance] = useState<number | null>(null);
  // Best cargo successfully delivered in the optimise round (0..3).
  const [bestCargo, setBestCargo] = useState<number>(0);

  const reportedRef = useRef<boolean>(false);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const setupRef = useRef<Setup>(setup);
  const phaseRef = useRef<Phase>(phase);
  const roundRef = useRef<Round>(round);
  const bestCargoRef = useRef<number>(0);

  useEffect(() => {
    setupRef.current = setup;
  }, [setup]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    roundRef.current = round;
  }, [round]);
  useEffect(() => {
    bestCargoRef.current = bestCargo;
  }, [bestCargo]);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);
  useEffect(() => stopLoop, [stopLoop]);

  // Live readout while tuning (preview) or racing (actual run setup).
  const live = useMemo(() => compute(setup), [setup]);
  const sunAngle = sunAngleDeg(setup.sunHeight);
  const winDistance = round.winDistance;

  /** Stars for the final round: deliver more cargo → more stars. */
  const starsForCargo = useCallback((cargoAboard: number): 1 | 2 | 3 => {
    if (cargoAboard >= 3) return 3;
    if (cargoAboard >= 2) return 2;
    return 1;
  }, []);

  const finishRace = useCallback(
    (finalDistance: number) => {
      stopLoop();
      setLastDistance(finalDistance);
      const r = roundRef.current;
      const cargoAboard = setupRef.current.cargo;
      const cleared = finalDistance >= r.winDistance;

      if (!cleared) {
        // Gentle retry — never reports a failure, always winnable.
        setPhase("lost");
        phaseRef.current = "lost";
        return;
      }

      // Cleared the line for this round.
      if (r.optimiseCargo) {
        const best = Math.max(bestCargoRef.current, cargoAboard);
        setBestCargo(best);
        bestCargoRef.current = best;
      }

      const isLast = roundIdx >= ROUNDS.length - 1;
      if (!isLast) {
        setPhase("won");
        phaseRef.current = "won";
        return;
      }

      // FINAL round cleared → grade and report exactly once.
      setPhase("done");
      phaseRef.current = "done";
      if (!reportedRef.current) {
        reportedRef.current = true;
        const finalBest = r.optimiseCargo
          ? Math.max(bestCargoRef.current, cargoAboard)
          : 3;
        const stars = r.optimiseCargo ? starsForCargo(finalBest) : 3;
        const detail = r.optimiseCargo
          ? finalBest >= 3
            ? "Full delivery! You powered all 3 blocks across the long track — peak efficiency."
            : finalBest >= 2
              ? `Delivered ${finalBest} blocks. Try keeping all 3 aboard for full stars.`
              : `Delivered ${finalBest} block. Aim the panel sharper and keep more cargo for more stars.`
          : "Across the line! More light, less weight and smooth tires made the power.";
        onComplete({ passed: true, stars, detail });
      }
    },
    [onComplete, stopLoop, roundIdx, starsForCargo],
  );

  const loop = useCallback(
    (now: number) => {
      if (phaseRef.current !== "racing") return;
      const t = Math.min(RUN_SECONDS, (now - startTimeRef.current) / 1000);
      const speed = compute(setupRef.current).speed;
      const d = speed * t;
      const win = roundRef.current.winDistance;
      setElapsed(t);
      setDistance(d);

      if (d >= win) {
        setDistance(win);
        finishRace(d);
        return;
      }
      if (t >= RUN_SECONDS) {
        finishRace(d);
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    },
    [finishRace],
  );

  const handleRace = useCallback(() => {
    stopLoop();
    setDistance(0);
    setElapsed(0);
    setTries((n) => n + 1);
    setPhase("racing");
    phaseRef.current = "racing";
    startTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);
  }, [loop, stopLoop]);

  // Advance to the next round after a non-final win.
  const handleNextRound = useCallback(() => {
    stopLoop();
    const next = roundIdx + 1;
    if (next >= ROUNDS.length) return;
    setRoundIdx(next);
    setSetup({ ...ROUNDS[next].start });
    setPhase("tune");
    phaseRef.current = "tune";
    setDistance(0);
    setElapsed(0);
    setLastDistance(null);
  }, [roundIdx, stopLoop]);

  const handleReset = useCallback(() => {
    stopLoop();
    // Reset only the CURRENT round's setup, not the whole game's progress.
    setSetup({ ...ROUNDS[roundIdx].start });
    setPhase("tune");
    phaseRef.current = "tune";
    setDistance(0);
    setElapsed(0);
    setLastDistance(null);
  }, [stopLoop, roundIdx]);

  // Any edit while a result is showing returns us to tuning (recoverable).
  const editSetup = useCallback(
    (patch: Partial<Setup>) => {
      setSetup((prev) => ({ ...prev, ...patch }));
      if (phaseRef.current === "won" || phaseRef.current === "lost") {
        setPhase("tune");
        phaseRef.current = "tune";
        setDistance(0);
        setElapsed(0);
      }
    },
    [],
  );

  const racing = phase === "racing";
  const done = phase === "done";

  // Locks for this round (also disabled while racing / after final win).
  const lockAll = racing || done;
  const sunLocked = round.lockSun || lockAll;
  const tiltLocked = round.lockTilt || lockAll;
  const cargoLocked = round.lockCargo || lockAll;
  const tireLocked = round.lockTire || lockAll;

  // Cargo buttons the round permits (delivery rounds forbid going below minCargo).
  const cargoChoices = useMemo(
    () => [0, 1, 2, 3].filter((n) => n >= round.minCargo),
    [round.minCargo],
  );

  // Car X position along the track from current distance.
  const carX =
    START_X + (Math.min(distance, winDistance) / winDistance) * TRACK_LEN;
  const showDistance = phase === "tune" ? 0 : distance;

  // Sun position in SVG space (height slider → vertical position).
  const sunY = 44 - (setup.sunHeight / 100) * 30; // 14..44
  const sunX = 250;
  const sunGlow = 8 + (setup.sunHeight / 100) * 8;

  // Tip cards: deterministic, never the exact answer — just direction.
  const tips = useMemo(() => {
    const out: string[] = [];
    const aim = aimMatch(setup.tilt, setup.sunHeight);
    if (aim < 0.7) {
      out.push(
        setup.tilt < sunAngle
          ? "Your panel is aimed below the sun — tilt it up to catch more light."
          : "Your panel is aimed past the sun — tilt it down toward it.",
      );
    }
    if (!round.lockSun && setup.sunHeight < 55)
      out.push("Raise the sun higher for a brighter, stronger beam.");
    if (round.lockSun)
      out.push("The sun won't move today — a perfect panel aim is your best friend.");
    if (round.optimiseCargo)
      out.push("Every extra block you finish with earns a star — don't drop more than you must.");
    else if (setup.cargo >= 2)
      out.push("Heavy cargo slows the car — drop a block or two.");
    if (setup.tire === "rough")
      out.push("Rough tires grip and drag — smooth tires roll faster.");
    if (out.length === 0)
      out.push("Strong setup! Press Race to send it across the line.");
    return out;
  }, [setup, sunAngle, round.lockSun, round.optimiseCargo]);

  const status = useMemo(() => {
    if (done) return "All three rounds cleared — solar champion! ✨";
    if (phase === "won") return "Round cleared! Next challenge ready ▶";
    if (phase === "lost")
      return `Ran out of track at ${showDistance.toFixed(0)} m — re-tune and race again.`;
    if (phase === "racing")
      return `Racing… ${elapsed.toFixed(1)} s · ${showDistance.toFixed(0)} m · ${live.volts.toFixed(1)} V`;
    return "Tune the car, then press Race ▶";
  }, [phase, done, showDistance, elapsed, live.volts]);

  const carColor =
    phase === "won" || done ? ACCENT : phase === "lost" ? "#f87171" : "#67e8f9";
  const energyPct = Math.round(live.captured * 100);
  const distancePct = Math.min(
    100,
    Math.round((showDistance / winDistance) * 100),
  );

  // Preview: would the CURRENT setup clear this round? (predict before you run)
  const projected = useMemo(() => projectedDistance(setup), [setup]);
  const wouldClear = projected >= winDistance;

  return (
    <div className="flex w-full flex-col gap-3 font-mono text-ink" style={{ maxWidth: 440 }}>
      <style>{`
        @keyframes g5solarcarrace-rays {
          0%,100% { opacity: .55; }
          50% { opacity: 1; }
        }
        @keyframes g5solarcarrace-spin { to { transform: rotate(360deg); } }
        @keyframes g5solarcarrace-pop {
          0% { transform: scale(.5); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* ---------------- ROUND HEADER ---------------- */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] uppercase tracking-tech text-ink-faint">
            Round {roundIdx + 1} of {ROUNDS.length}
          </span>
          <span className="font-display text-sm" style={{ color: ACCENT }}>
            {round.name}
          </span>
        </div>
        <div className="flex items-center gap-1 pt-0.5" aria-label={`Round ${roundIdx + 1} of ${ROUNDS.length}`}>
          {ROUNDS.map((_, i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full"
              style={{
                background: i < roundIdx || done ? ACCENT : i === roundIdx ? "#67e8f9" : "#243049",
              }}
            />
          ))}
        </div>
      </div>
      <p className="-mt-1 text-[11px] leading-snug text-ink-dim">{round.brief}</p>

      {/* ---------------- CANVAS ---------------- */}
      <div
        className="panel relative overflow-hidden rounded-xl"
        style={{
          boxShadow:
            phase === "won" || done ? `0 0 0 1px ${ACCENT}, 0 0 24px -4px ${ACCENT}` : undefined,
          transition: "box-shadow .3s ease",
        }}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="block h-auto w-full"
          role="img"
          aria-label="Solar car on a racetrack with a sun, a finish line and a panel power meter"
          style={{ touchAction: "none" }}
        >
          <defs>
            <radialGradient id="g5scr-sun" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="70%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </radialGradient>
            <linearGradient id="g5scr-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0c1424" />
              <stop offset="100%" stopColor="#0a1018" />
            </linearGradient>
          </defs>

          {/* sky + ground */}
          <rect x={0} y={0} width={VIEW_W} height={ROAD_Y + 6} fill="url(#g5scr-sky)" />
          <rect x={0} y={ROAD_Y + 6} width={VIEW_W} height={VIEW_H - ROAD_Y - 6} fill="#0e1626" />

          {/* cloud overlay when the sun is locked low (round 2) */}
          {round.lockSun && (
            <g opacity={0.5}>
              <ellipse cx={230} cy={30} rx={26} ry={9} fill="#1b2536" />
              <ellipse cx={258} cy={34} rx={20} ry={8} fill="#222e42" />
              <ellipse cx={212} cy={36} rx={16} ry={7} fill="#222e42" />
            </g>
          )}

          {/* road */}
          <line x1={0} y1={ROAD_Y + 6} x2={VIEW_W} y2={ROAD_Y + 6} stroke="#243049" strokeWidth={1.5} />
          {Array.from({ length: 10 }, (_, i) => (
            <line
              key={`dash${i}`}
              x1={20 + i * 30}
              y1={ROAD_Y + 16}
              x2={36 + i * 30}
              y2={ROAD_Y + 16}
              stroke="#2a3754"
              strokeWidth={2}
            />
          ))}

          {/* sun + brightness rays */}
          <g
            style={{
              transformOrigin: `${sunX}px ${sunY}px`,
              animation: "g5solarcarrace-rays 2.2s ease-in-out infinite",
            }}
          >
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i / 8) * Math.PI * 2;
              const r0 = sunGlow + 2;
              const r1 = sunGlow + 7;
              return (
                <line
                  key={`ray${i}`}
                  x1={sunX + Math.cos(a) * r0}
                  y1={sunY + Math.sin(a) * r0}
                  x2={sunX + Math.cos(a) * r1}
                  y2={sunY + Math.sin(a) * r1}
                  stroke="#fbbf24"
                  strokeWidth={1.4}
                  strokeLinecap="round"
                />
              );
            })}
          </g>
          <circle cx={sunX} cy={sunY} r={sunGlow} fill="url(#g5scr-sun)" />
          {/* light beam from sun toward the panel */}
          <line
            x1={sunX}
            y1={sunY}
            x2={START_X + 6}
            y2={ROAD_Y - 12}
            stroke="#fcd34d"
            strokeWidth={1}
            strokeOpacity={0.18 + live.captured * 0.4}
            strokeDasharray="3 3"
          />

          {/* finish line */}
          <g>
            {Array.from({ length: 6 }, (_, i) => (
              <rect
                key={`fin${i}`}
                x={FINISH_X}
                y={ROAD_Y - 30 + i * 6}
                width={6}
                height={6}
                fill={i % 2 === 0 ? "#e5e7eb" : "#0e1626"}
              />
            ))}
            <text x={FINISH_X + 3} y={ROAD_Y - 36} fill={ACCENT} fontSize={8} textAnchor="middle">
              FINISH
            </text>
          </g>
          {/* start line */}
          <line x1={START_X} y1={ROAD_Y - 18} x2={START_X} y2={ROAD_Y + 6} stroke="#3a4a66" strokeWidth={1.5} />

          {/* car: chassis, tilted panel, spinning wheels */}
          <g transform={`translate(${carX} ${ROAD_Y})`}>
            {/* panel, tilted toward the sun */}
            <g transform={`rotate(${-setup.tilt} -6 -8)`}>
              <rect x={-15} y={-12} width={18} height={6} rx={1} fill="#1e3a8a" stroke={ACCENT} strokeWidth={0.8} />
              <line x1={-11} y1={-12} x2={-11} y2={-6} stroke="#3b82f6" strokeWidth={0.5} />
              <line x1={-6} y1={-12} x2={-6} y2={-6} stroke="#3b82f6" strokeWidth={0.5} />
              <line x1={-1} y1={-12} x2={-1} y2={-6} stroke="#3b82f6" strokeWidth={0.5} />
            </g>
            {/* body */}
            <rect x={-14} y={-6} width={28} height={9} rx={3} fill={carColor} stroke="#05070d" strokeWidth={1} />
            {/* cargo blocks still loaded */}
            {Array.from({ length: setup.cargo }, (_, i) => (
              <rect key={`cargo${i}`} x={-2 + i * 6} y={-11} width={5} height={5} rx={1} fill="#fbbf24" stroke="#05070d" strokeWidth={0.6} />
            ))}
            {/* wheels */}
            {[-8, 8].map((wx) => (
              <g
                key={`wheel${wx}`}
                style={{
                  transformOrigin: `${wx}px 5px`,
                  animation: racing ? "g5solarcarrace-spin .4s linear infinite" : undefined,
                }}
              >
                <circle cx={wx} cy={5} r={4} fill="#0b1220" stroke={setup.tire === "smooth" ? "#94a3b8" : "#64748b"} strokeWidth={setup.tire === "rough" ? 2 : 1} />
                <line x1={wx} y1={2} x2={wx} y2={8} stroke="#334155" strokeWidth={0.8} />
              </g>
            ))}
          </g>

          {/* panel power meter (top-left) */}
          <g>
            <rect x={10} y={12} width={92} height={24} rx={4} fill="#0b1220" stroke="#243049" strokeWidth={1} />
            <text x={16} y={23} fill="#9aa6b2" fontSize={7}>
              PANEL
            </text>
            <text x={16} y={32} fill={ACCENT} fontSize={9} className="tabular-nums">
              {live.volts.toFixed(1)} V
            </text>
            {/* charge bar */}
            <rect x={52} y={16} width={44} height={6} rx={3} fill="#15202e" />
            <rect x={52} y={16} width={44 * live.captured} height={6} rx={3} fill={ACCENT} />
            <text x={52} y={32} fill="#9aa6b2" fontSize={7} className="tabular-nums">
              {(live.captured * 6).toFixed(1)} A
            </text>
          </g>

          {/* win burst */}
          {(phase === "won" || done) && (
            <text
              x={VIEW_W / 2}
              y={ROAD_Y - 50}
              fontSize={24}
              textAnchor="middle"
              style={{ transformOrigin: `${VIEW_W / 2}px ${ROAD_Y - 50}px`, animation: "g5solarcarrace-pop .5s ease-out" }}
            >
              ✨🎉✨
            </text>
          )}

          {/* live distance readout */}
          <text x={VIEW_W - 8} y={20} fill="#9aa6b2" fontSize={9} textAnchor="end" className="tabular-nums">
            {showDistance.toFixed(0)} / {winDistance} m
          </text>
        </svg>

        {/* in-canvas status */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3 py-1.5">
          <span role="status" aria-live="polite" className="font-mono text-[11px] text-ink-dim">
            {status}
          </span>
        </div>
      </div>

      {/* ---------------- ENERGY / DISTANCE GAUGES ---------------- */}
      <div className="grid grid-cols-2 gap-2">
        <div className="panel rounded-xl p-2">
          <p className="text-[10px] uppercase tracking-tech text-ink-faint">Light captured</p>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-panel-2">
            <div className="h-full rounded-full transition-all" style={{ width: `${energyPct}%`, background: ACCENT }} />
          </div>
          <p className="mt-1 text-[11px] tabular-nums" style={{ color: ACCENT }}>
            {energyPct}%
          </p>
        </div>
        <div className="panel rounded-xl p-2">
          <p className="text-[10px] uppercase tracking-tech text-ink-faint">Distance</p>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-panel-2">
            <div className="h-full rounded-full transition-all" style={{ width: `${distancePct}%`, background: "#67e8f9" }} />
          </div>
          <p className="mt-1 text-[11px] tabular-nums text-ink-dim">
            {showDistance.toFixed(0)} m
          </p>
        </div>
      </div>

      {/* ---------------- PREDICT BAR (commit a plan before running) ---------------- */}
      {!racing && !done && (
        <div
          className="flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px]"
          style={{
            borderColor: wouldClear ? "rgba(52,211,153,0.4)" : "rgba(251,191,36,0.4)",
            background: wouldClear ? "rgba(52,211,153,0.08)" : "rgba(251,191,36,0.06)",
          }}
        >
          <span className="text-ink-dim">
            🔮 Predicted run: <span className="tabular-nums">{projected.toFixed(0)} m</span> of {winDistance} m
          </span>
          <span className="tabular-nums" style={{ color: wouldClear ? ACCENT : "#fbbf24" }}>
            {wouldClear ? "should clear ✓" : "short — keep tuning"}
          </span>
        </div>
      )}

      {/* ---------------- TUNING CONTROLS ---------------- */}
      <div className="panel flex flex-col gap-3 rounded-xl p-3">
        {/* sun height */}
        <label className="flex flex-col gap-1 text-xs">
          <span className="flex items-center justify-between">
            <span className="text-ink-dim">
              ☀️ Sun height{" "}
              <span className="text-ink-faint">
                {round.lockSun ? "· locked (cloudy)" : "· brighter up high"}
              </span>
            </span>
            <span className="tabular-nums" style={{ color: ACCENT }}>
              {Math.round(setup.sunHeight)}%
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={setup.sunHeight}
            disabled={sunLocked}
            onChange={(e) => editSetup({ sunHeight: Number(e.target.value) })}
            aria-label={`Sun height, ${Math.round(setup.sunHeight)} percent${round.lockSun ? ", locked this round" : ""}`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-50"
            style={{ accentColor: ACCENT, touchAction: "none" }}
          />
        </label>

        {/* panel tilt */}
        <label className="flex flex-col gap-1 text-xs">
          <span className="flex items-center justify-between">
            <span className="text-ink-dim">
              📐 Panel tilt <span className="text-ink-faint">· aim at the sun ({Math.round(sunAngle)}°)</span>
            </span>
            <span className="tabular-nums" style={{ color: ACCENT }}>
              {Math.round(setup.tilt)}°
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={90}
            step={1}
            value={setup.tilt}
            disabled={tiltLocked}
            onChange={(e) => editSetup({ tilt: Number(e.target.value) })}
            aria-label={`Panel tilt, ${Math.round(setup.tilt)} degrees`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-50"
            style={{ accentColor: ACCENT, touchAction: "none" }}
          />
        </label>

        {/* cargo + tires */}
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-ink-dim">
              📦 Cargo{" "}
              <span className="text-ink-faint">
                · {totalKg(setup.cargo)} kg{round.minCargo > 0 ? ` · keep ≥${round.minCargo}` : ""}
              </span>
            </span>
            <div className="flex gap-1" role="group" aria-label="Cargo blocks loaded">
              {[0, 1, 2, 3].map((n) => {
                const active = setup.cargo === n;
                const allowed = cargoChoices.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onPointerDown={() => {
                      if (!cargoLocked && allowed) editSetup({ cargo: n });
                    }}
                    disabled={cargoLocked || !allowed}
                    aria-pressed={active}
                    aria-label={`${n} cargo blocks${!allowed ? ", not allowed this round" : ""}`}
                    className="h-8 w-8 rounded-md border text-xs tabular-nums transition disabled:opacity-40"
                    style={{
                      borderColor: active ? ACCENT : "var(--color-line, #243049)",
                      background: active ? "rgba(52,211,153,0.14)" : "rgba(255,255,255,0.02)",
                      color: active ? ACCENT : "var(--color-ink-dim, #9aa6b2)",
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-ink-dim">🛞 Tires</span>
            <div className="flex gap-1" role="group" aria-label="Tire type">
              {(["smooth", "rough"] as Tire[]).map((t) => {
                const active = setup.tire === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onPointerDown={() => {
                      if (!tireLocked) editSetup({ tire: t });
                    }}
                    disabled={tireLocked}
                    aria-pressed={active}
                    aria-label={`${t} tires`}
                    className="rounded-md border px-2.5 py-1.5 text-xs capitalize transition disabled:opacity-50"
                    style={{
                      borderColor: active ? ACCENT : "var(--color-line, #243049)",
                      background: active ? "rgba(52,211,153,0.14)" : "rgba(255,255,255,0.02)",
                      color: active ? ACCENT : "var(--color-ink-dim, #9aa6b2)",
                    }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- TIP CARDS + LAST-RUN COMPARE ---------------- */}
      <div className="flex flex-col gap-1.5">
        {phase !== "racing" &&
          !done &&
          tips.slice(0, 2).map((tip, i) => (
            <p
              key={i}
              className="rounded-lg border border-line bg-panel/50 px-2.5 py-1.5 text-[11px] leading-snug text-ink-dim"
            >
              💡 {tip}
            </p>
          ))}
        {(phase === "won" || phase === "lost") && lastDistance !== null && (
          <p className="px-1 text-[11px]" style={{ color: lastDistance >= winDistance ? ACCENT : "#fbbf24" }}>
            This run: {lastDistance.toFixed(0)} m
            {lastDistance >= winDistance ? " — cleared the finish!" : ` — ${(winDistance - lastDistance).toFixed(0)} m short.`}
            {round.optimiseCargo && lastDistance >= winDistance
              ? ` · ${setup.cargo} block${setup.cargo === 1 ? "" : "s"} delivered`
              : ""}
          </p>
        )}
        {round.optimiseCargo && bestCargo > 0 && (
          <p className="px-1 text-[11px] text-ink-faint">
            Best delivery so far: {bestCargo} of 3 blocks.
          </p>
        )}
      </div>

      {/* ---------------- CONTROLS ---------------- */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-ink-faint">Races: {tries}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={racing || done}
            className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim disabled:opacity-50"
            aria-label="Reset this round's car to its start"
          >
            Reset
          </button>
          {phase === "won" ? (
            <button
              type="button"
              onClick={handleNextRound}
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: ACCENT, color: "#05070d" }}
              aria-label="Go to the next round"
            >
              Next round ▶
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRace}
              disabled={racing || done}
              className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
              style={{ background: ACCENT, color: "#05070d" }}
              aria-label="Race the solar car for ten seconds"
            >
              {racing ? "Racing…" : done ? "Finished" : "Race ▶"}
            </button>
          )}
        </div>
      </div>

      {done && (
        <p className="text-center font-display text-sm" style={{ color: ACCENT }}>
          {round.optimiseCargo && bestCargo >= 3
            ? "⭐⭐⭐ Full load delivered — solar power wins!"
            : bestCargo >= 2
              ? "⭐⭐ Strong delivery — try keeping all 3 blocks for full stars!"
              : "⭐ You finished! Replay to deliver more cargo for more stars."}
        </p>
      )}
    </div>
  );
}
