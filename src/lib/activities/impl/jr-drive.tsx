"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ──────────────────────────────────────────────────────────────────────────
 * Drive It! 🚗 — a JUNIOR (Class 1-3, age ~6-8) ROBOTICS lab.
 * FIRST you BUILD the robot car (snap on wheels 🛞 + a motor ⚙️). THEN — and this
 * is the real PROBLEM now — you must PROGRAM its route to the 🏁 flag.
 *
 * Every fork in the road offers TWO ways: go straight ⬆️ or turn ↪️. Only ONE
 * path actually reaches the flag; the other dead-ends at a 🚧 barrier. The child
 * must LOOK at the map, PLAN the whole sequence of moves into a little program
 * strip, then press GO ▶ to run it and watch the car drive the route it chose.
 * Land on the flag → that round is won and a harder map slides in.
 *
 * THREE rounds, escalating: 2 → 3 → 4 forks. The round-3 twist defeats guessing
 * — the "obvious" straight-straight path dead-ends, so the child must reason
 * about which branch each fork needs. A wrong route → gentle wobble, the car
 * rolls home, the program clears, try again. Always winnable, never scolds.
 * NO READING REQUIRED (emoji, colour, shape, arrows). Touch-first, deterministic.
 * Preserves the original build phase, car art, road, dots and celebration.
 * ────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#34d399";
const ROLL_MS = 640; // time to roll the car one hop along the route
const MAX_MOVES = 4; // longest route any round needs

/** The two parts the child snaps on to finish the car. */
type PartId = "wheels" | "motor";

/** A single move the child can program: keep going straight, or turn. */
type Move = "straight" | "turn";

/** A point in the map, in SVG units. heading = car nose angle on arrival. */
interface Pt {
  x: number;
  y: number;
  heading: number;
}

/** One fork on the route: where the car sits, and where each choice leads.
 *  `correct` is the move that stays on the road to the flag; the other choice
 *  rolls a little way to a 🚧 dead-end (gentle wobble, then home). */
interface Fork {
  /** The car's resting point + heading at this fork (before choosing). */
  at: Pt;
  /** The move that continues toward the flag. */
  correct: Move;
  /** Where the car ends up if it picks the WRONG move (a visible dead-end). */
  deadEnd: Pt;
}

/** A whole round: the start point, the ordered forks, and the flag point.
 *  Solving = entering the exact sequence of `correct` moves, in order. */
interface Round {
  start: Pt;
  forks: readonly Fork[];
  flag: Pt;
}

/* Three hand-authored maps. Each is deterministic. Coordinates live in the
 * 380×300 viewBox. The correct-move sequence is what the child must discover
 * by looking at where each branch's road actually goes. */
const ROUNDS: readonly Round[] = [
  // ── Round 1: 2 forks. A gentle warm-up. straight, then turn. ──
  {
    start: { x: 50, y: 250, heading: 0 },
    forks: [
      { at: { x: 130, y: 250, heading: 0 }, correct: "straight", deadEnd: { x: 130, y: 175, heading: -90 } },
      { at: { x: 215, y: 250, heading: 0 }, correct: "turn", deadEnd: { x: 300, y: 250, heading: 0 } },
    ],
    flag: { x: 215, y: 150, heading: -90 },
  },
  // ── Round 2: 3 forks. turn, straight, turn. ──
  {
    start: { x: 50, y: 255, heading: 0 },
    forks: [
      { at: { x: 120, y: 255, heading: 0 }, correct: "turn", deadEnd: { x: 200, y: 255, heading: 0 } },
      { at: { x: 120, y: 175, heading: -90 }, correct: "straight", deadEnd: { x: 50, y: 175, heading: 180 } },
      { at: { x: 120, y: 100, heading: -90 }, correct: "turn", deadEnd: { x: 120, y: 40, heading: -90 } },
    ],
    flag: { x: 230, y: 100, heading: 0 },
  },
  // ── Round 3: 4 forks + the TWIST. The straight-ahead road LOOKS like the way
  //    (it's long and inviting) but dead-ends; the real route zig-zags.
  //    Sequence: turn, turn, straight, turn. ──
  {
    start: { x: 45, y: 260, heading: 0 },
    forks: [
      { at: { x: 105, y: 260, heading: 0 }, correct: "turn", deadEnd: { x: 300, y: 260, heading: 0 } }, // decoy straight
      { at: { x: 105, y: 185, heading: -90 }, correct: "turn", deadEnd: { x: 105, y: 110, heading: -90 } },
      { at: { x: 185, y: 185, heading: 0 }, correct: "straight", deadEnd: { x: 185, y: 110, heading: -90 } },
      { at: { x: 260, y: 185, heading: 0 }, correct: "turn", deadEnd: { x: 330, y: 185, heading: 0 } },
    ],
    flag: { x: 260, y: 95, heading: -90 },
  },
];

type Phase = "idle" | "running" | "won" | "oops" | "done";

export default function DriveIt({ onComplete }: ActivityProps) {
  // ── Build phase ──
  const [wheels, setWheels] = useState<boolean>(false);
  const [motor, setMotor] = useState<boolean>(false);
  const [snap, setSnap] = useState<PartId | null>(null);
  const built = wheels && motor;

  // ── Program / drive phase ──
  const [round, setRound] = useState<number>(0);
  const [program, setProgram] = useState<Move[]>([]); // the planned route
  const [carPt, setCarPt] = useState<Pt>(ROUNDS[0].start); // where the car is drawn
  const [phase, setPhase] = useState<Phase>("idle");

  const cfg = ROUNDS[round];
  const needed = cfg.forks.length; // moves required this round

  const reportedRef = useRef<boolean>(false);
  const snapTimer = useRef<number | null>(null);
  const runTimer = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const clearTimers = useCallback((): void => {
    [snapTimer, runTimer].forEach((t) => {
      if (t.current !== null) window.clearTimeout(t.current);
      t.current = null;
    });
  }, []);
  useEffect(() => () => clearTimers(), [clearTimers]);

  // Fresh round: park the car at the start, clear the program.
  useEffect(() => {
    if (runTimer.current !== null) {
      window.clearTimeout(runTimer.current);
      runTimer.current = null;
    }
    setCarPt(ROUNDS[round].start);
    setProgram([]);
    setPhase("idle");
  }, [round]);

  // ── Soft optional sound, made on the user's gesture; never throws/blocks. ──
  const blip = useCallback((freq: number, dur: number): void => {
    try {
      type WinAudio = typeof AudioContext;
      const w = window as unknown as { webkitAudioContext?: WinAudio };
      const Ctx: WinAudio | undefined = window.AudioContext ?? w.webkitAudioContext;
      if (!Ctx) return;
      const ac = audioRef.current ?? new Ctx();
      audioRef.current = ac;
      if (ac.state === "suspended") void ac.resume();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ac.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + dur + 0.02);
    } catch {
      /* sound is a nicety — silently ignore any failure */
    }
  }, []);

  const chime = useCallback((): void => {
    [523, 659, 784, 1046].forEach((f, i) => {
      window.setTimeout(() => blip(f, 0.18), i * 120);
    });
  }, [blip]);

  const busy = phase === "running" || phase === "won" || phase === "done";

  // Place a build part — it springs into its slot with a happy pop.
  const place = useCallback((id: PartId): void => {
    blip(660, 0.08);
    if (id === "wheels") setWheels(true);
    else setMotor(true);
    setSnap(id);
    if (snapTimer.current !== null) window.clearTimeout(snapTimer.current);
    snapTimer.current = window.setTimeout(() => setSnap(null), 460);
  }, [blip]);

  // Add a move card to the program strip.
  const addMove = useCallback((m: Move): void => {
    if (busy) return;
    blip(m === "turn" ? 588 : 720, 0.08);
    setProgram((p) => (p.length >= MAX_MOVES ? p : [...p, m]));
    setPhase("idle");
  }, [busy, blip]);

  // Clear just the program strip (keep the round + built car).
  const clearProgram = useCallback((): void => {
    if (busy) return;
    blip(420, 0.07);
    setProgram([]);
    setCarPt(ROUNDS[round].start);
    setPhase("idle");
  }, [busy, blip, round]);

  const reset = useCallback((): void => {
    clearTimers();
    reportedRef.current = false;
    setWheels(false);
    setMotor(false);
    setSnap(null);
    setRound(0);
    setProgram([]);
    setCarPt(ROUNDS[0].start);
    setPhase("idle");
  }, [clearTimers]);

  // ── RUN the program: roll the car fork by fork, checking each move. ──
  const run = useCallback((): void => {
    if (busy) return;
    if (program.length === 0) {
      // Nothing planned yet — friendly wobble, no scolding, no onComplete.
      setPhase("oops");
      runTimer.current = window.setTimeout(() => setPhase("idle"), 480);
      return;
    }
    blip(523, 0.1);
    setCarPt(cfg.start);
    setPhase("running");

    // Walk the planned program against the round's forks.
    let i = 0;
    const stepThrough = (): void => {
      const fork = cfg.forks[i];
      const move = program[i];
      const correct = move === fork.correct;
      const lastFork = i === cfg.forks.length - 1;

      if (correct) {
        // Roll onto the next correct point (a fork, or the flag).
        const next: Pt = lastFork ? cfg.flag : cfg.forks[i + 1].at;
        setCarPt(next);
        if (lastFork) {
          // Reached the flag — round solved!
          runTimer.current = window.setTimeout(() => {
            const finalRound = round >= ROUNDS.length - 1;
            chime();
            if (finalRound) {
              setPhase("done");
              if (!reportedRef.current) {
                reportedRef.current = true;
                onComplete({ passed: true, stars: 3, detail: "You programmed all three routes! 🏁🏁🏁" });
              }
            } else {
              setPhase("won");
              runTimer.current = window.setTimeout(() => setRound((r) => r + 1), 1150);
            }
          }, ROLL_MS);
          return;
        }
        // Keep rolling to the next fork.
        i += 1;
        runTimer.current = window.setTimeout(stepThrough, ROLL_MS);
      } else {
        // Wrong turn — roll into the visible dead-end, wobble, then home.
        setCarPt(fork.deadEnd);
        runTimer.current = window.setTimeout(() => {
          setPhase("oops");
          runTimer.current = window.setTimeout(() => {
            setProgram([]);
            setCarPt(cfg.start);
            setPhase("idle");
          }, 900);
        }, ROLL_MS);
      }
    };
    runTimer.current = window.setTimeout(stepThrough, 260);
  }, [busy, program, cfg, round, blip, chime, onComplete]);

  const won = phase === "won";
  const done = phase === "done";
  const oops = phase === "oops";
  const running = phase === "running";
  const celebrating = won || done;

  // Car heading follows whichever point it is currently at.
  const heading = carPt.heading;

  const statusEmoji = done
    ? "🏆"
    : won
      ? "🎉"
      : !built
        ? "🔧"
        : running
          ? "💨"
          : oops
            ? "🤔"
            : "🚗";

  // The road for THIS round, drawn as a connected path: start → each correct
  // fork point → flag, plus a little stub road into every dead-end so the forks
  // visibly branch (this is the map the child reads to plan).
  const mainPath = useMemo<Pt[]>(() => {
    return [cfg.start, ...cfg.forks.map((f) => f.at), cfg.flag];
  }, [cfg]);

  return (
    <div className="flex w-full flex-col items-center gap-3" style={{ maxWidth: 430 }}>
      {/* ── Tiny emoji status + round dots (no sentences) ── */}
      <div
        className="flex items-center gap-3 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={
          done
            ? "You solved all three routes!"
            : won
              ? "Route solved! Next map coming up"
              : !built
                ? "Build the car"
                : running
                  ? "The car is driving your route"
                  : oops
                    ? "That way is blocked, try another route"
                    : `Round ${round + 1} of 3 — plan the route to the flag, then press Go`
        }
        style={{
          background: celebrating ? "rgba(52,211,153,0.14)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${celebrating ? ACCENT : "var(--color-line, #27314f)"}`,
          boxShadow: celebrating ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            animation: celebrating ? "jrdrive-cheer 0.7s cubic-bezier(.34,1.56,.64,1) infinite" : undefined,
          }}
        >
          {statusEmoji}
        </span>

        {built && (
          /* round progress: solved ● / current ◉ / upcoming ○ */
          <span aria-hidden="true" className="inline-flex items-center gap-1.5">
            {ROUNDS.map((_, i) => {
              const solved = i < round || done;
              const current = i === round && !done;
              return (
                <span
                  key={i}
                  className="grid place-items-center rounded-full"
                  style={{
                    height: 14,
                    width: 14,
                    background: solved ? ACCENT : current ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.06)",
                    border: `2px solid ${solved || current ? ACCENT : "rgba(120,140,170,0.35)"}`,
                    boxShadow: current ? `0 0 8px ${ACCENT}88` : undefined,
                    animation: current ? "jrdrive-pulse 1.5s ease-in-out infinite" : undefined,
                  }}
                />
              );
            })}
          </span>
        )}

        {done ? (
          <span aria-hidden="true">⭐⭐⭐</span>
        ) : (
          !built && <span aria-hidden="true" className="text-xl">🚗→🏁</span>
        )}
      </div>

      {/* ── Stage: the branching map + car ── */}
      <div className="panel relative w-full overflow-hidden rounded-2xl border border-line p-2">
        <svg
          viewBox="0 0 380 300"
          className="block w-full select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="A branching road map from the car to a flag, with blocked dead-ends"
        >
          <defs>
            <radialGradient id="jrdrive-halo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.9" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* backdrop */}
          <rect x="0" y="0" width="380" height="300" fill="#0c1322" />

          {/* ── dead-end STUB roads (drawn first, underneath) ── */}
          {cfg.forks.map((f, i) => (
            <polyline
              key={`d${i}`}
              points={`${f.at.x},${f.at.y} ${f.deadEnd.x},${f.deadEnd.y}`}
              fill="none"
              stroke="#222a40"
              strokeWidth="30"
              strokeLinecap="round"
            />
          ))}

          {/* ── the CORRECT winding road through every fork to the flag ── */}
          <polyline
            points={mainPath.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="#26304a"
            strokeWidth="34"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* dashed centre line on the main road */}
          <polyline
            points={mainPath.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="#3f4d70"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="9 10"
          />

          {/* 🚧 barrier at the end of every dead-end stub */}
          {cfg.forks.map((f, i) => (
            <text
              key={`b${i}`}
              x={f.deadEnd.x}
              y={f.deadEnd.y + 1}
              fontSize="20"
              textAnchor="middle"
              dominantBaseline="central"
              aria-hidden="true"
              style={{ animation: "jrdrive-flag 2.6s ease-in-out infinite" }}
            >
              🚧
            </text>
          ))}

          {/* glow under the flag when won */}
          {celebrating && <circle cx={cfg.flag.x} cy={cfg.flag.y} r="44" fill="url(#jrdrive-halo)" />}

          {/* ── FLAG goal ── */}
          <g
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              animation: celebrating ? "jrdrive-pop 0.7s ease-out" : "jrdrive-flag 2.4s ease-in-out infinite",
            }}
          >
            <text
              x={cfg.flag.x}
              y={cfg.flag.y + 2}
              fontSize="34"
              textAnchor="middle"
              dominantBaseline="central"
              aria-hidden="true"
            >
              🏁
            </text>
          </g>

          {/* ── the CAR ── */}
          <g
            style={{
              transform: `translate(${carPt.x}px, ${carPt.y}px)`,
              transition: running
                ? `transform ${ROLL_MS}ms cubic-bezier(.45,.05,.55,.95)`
                : "transform 0.2s ease-out",
            }}
          >
            {/* exhaust puffs while rolling */}
            {running && (
              <g aria-hidden="true">
                <text x="-26" y="6" fontSize="16" style={{ animation: "jrdrive-puff 0.7s ease-out infinite" }}>💨</text>
                <text x="-34" y="-4" fontSize="13" style={{ animation: "jrdrive-puff 0.7s ease-out 0.2s infinite" }}>💨</text>
              </g>
            )}

            {/* heading turn + idle bob + wrong-wobble all on this group */}
            <g
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                transition: "transform 0.32s cubic-bezier(.34,1.56,.64,1)",
                transform: `rotate(${heading}deg)`,
              }}
            >
              <g
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "center",
                  animation: celebrating
                    ? "jrdrive-cheer 0.6s ease-out 2"
                    : oops
                      ? "jrdrive-wobble 0.42s ease-in-out"
                      : built && !running
                        ? "jrdrive-bob 2.6s ease-in-out infinite"
                        : undefined,
                }}
              >
                {/* car body */}
                <rect x="-26" y="-14" width="52" height="22" rx="9" fill="#0f2a22" stroke={ACCENT} strokeWidth="3" />
                <rect x="-12" y="-22" width="26" height="14" rx="6" fill="#0f2a22" stroke={ACCENT} strokeWidth="3" />
                {/* headlight */}
                <circle cx="22" cy="-3" r="3.5" fill="#fde68a" />
                {/* the MOTOR (only after it's snapped on) */}
                {motor && (
                  <text x="0" y="-12" fontSize="13" textAnchor="middle" dominantBaseline="central" aria-hidden="true">
                    ⚙️
                  </text>
                )}
                {/* the WHEELS (only after snapped on) — spin while rolling */}
                {wheels && (
                  <g aria-hidden="true">
                    <g style={{ transformBox: "fill-box", transformOrigin: "center", animation: running ? "jrdrive-spin 0.5s linear infinite" : undefined }}>
                      <text x="-16" y="12" fontSize="16" textAnchor="middle" dominantBaseline="central">⚫</text>
                    </g>
                    <g style={{ transformBox: "fill-box", transformOrigin: "center", animation: running ? "jrdrive-spin 0.5s linear infinite" : undefined }}>
                      <text x="16" y="12" fontSize="16" textAnchor="middle" dominantBaseline="central">⚫</text>
                    </g>
                  </g>
                )}
              </g>
            </g>
          </g>

          {/* confetti burst at the flag on final win */}
          {done &&
            Array.from({ length: 12 }).map((_, i) => {
              const ang = (i / 12) * Math.PI * 2;
              const glyph = ["🎉", "✨", "⭐", "🎊"][i % 4];
              return (
                <text
                  key={i}
                  x={cfg.flag.x}
                  y={cfg.flag.y}
                  fontSize="16"
                  textAnchor="middle"
                  dominantBaseline="central"
                  aria-hidden="true"
                  style={{
                    transformBox: "fill-box",
                    transformOrigin: "center",
                    ["--dx" as string]: `${Math.cos(ang) * 60}px`,
                    ["--dy" as string]: `${Math.sin(ang) * 60}px`,
                    animation: `jrdrive-confetti 0.9s ease-out ${i * 0.03}s both`,
                  }}
                >
                  {glyph}
                </text>
              );
            })}
        </svg>
      </div>

      {/* ── BUILD tray (before the car is built) ── */}
      {!built ? (
        <div className="flex w-full flex-col items-center gap-2">
          <div className="text-2xl" aria-hidden="true">👇 🔧</div>
          <div className="flex items-center justify-center gap-3">
            <BuildButton
              label="Add wheels"
              glyph="🛞"
              done={wheels}
              springing={snap === "wheels"}
              onPress={() => place("wheels")}
            />
            <BuildButton
              label="Add motor"
              glyph="⚙️"
              done={motor}
              springing={snap === "motor"}
              onPress={() => place("motor")}
            />
          </div>
        </div>
      ) : (
        /* ── PROGRAM + DRIVE controls (after the car is built) ── */
        <div className="flex w-full flex-col items-center gap-3">
          {/* the program strip: the route the child has planned, in order */}
          <div
            className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl px-3 py-2"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "2px dashed var(--color-line, #27314f)",
            }}
            aria-label={`${program.length} of ${needed} moves planned`}
          >
            {Array.from({ length: needed }).map((_, i) => {
              const m = program[i];
              const filled = i < program.length;
              return (
                <span
                  key={i}
                  aria-hidden="true"
                  className="grid h-10 w-10 place-items-center rounded-xl text-2xl transition"
                  style={{
                    background: filled ? "rgba(52,211,153,0.16)" : "rgba(255,255,255,0.03)",
                    border: `2px solid ${filled ? ACCENT : "rgba(120,140,170,0.25)"}`,
                    transform: filled ? "scale(1)" : "scale(0.92)",
                    opacity: filled ? 1 : 0.5,
                    animation: filled && i === program.length - 1 ? "jrdrive-snap 0.42s cubic-bezier(.34,1.56,.64,1)" : undefined,
                  }}
                >
                  {filled ? (m === "turn" ? "↪️" : "⬆️") : ""}
                </span>
              );
            })}
          </div>

          {/* the two move-cards + the GO button */}
          <div className="flex w-full items-stretch justify-center gap-3">
            <DriveButton
              label="Add a straight move"
              glyph="⬆️"
              tint="rgba(52,211,153,0.12)"
              disabled={busy || program.length >= needed}
              active={false}
              onPress={() => addMove("straight")}
            />
            <DriveButton
              label="Add a turn move"
              glyph="↪️"
              tint="rgba(52,211,153,0.12)"
              disabled={busy || program.length >= needed}
              active={false}
              onPress={() => addMove("turn")}
            />
            <DriveButton
              label="Go — run the route"
              glyph={running ? "💨" : "▶"}
              tint={ACCENT}
              solid
              disabled={busy}
              active={false}
              ready={!busy && program.length > 0}
              onPress={run}
            />
          </div>
        </div>
      )}

      {/* progress dots — how many forks solved on this map, no reading */}
      {built && (
        <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
          {cfg.forks.map((_, i) => (
            <span key={i} className="text-sm">
              {i < program.length ? "🟢" : "⚪"}
            </span>
          ))}
          <span className="text-sm">🏁</span>
        </div>
      )}

      {/* Clear program + Reset */}
      <div className="flex items-center justify-center gap-3">
        {built && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              clearProgram();
            }}
            disabled={busy || program.length === 0}
            aria-label="Clear the route"
            className="grid h-[52px] w-[52px] place-items-center rounded-2xl text-2xl active:scale-90 disabled:opacity-30"
            style={{
              touchAction: "none",
              background: "rgba(255,255,255,0.05)",
              border: "2px solid var(--color-line, #27314f)",
              transition: "transform 0.18s cubic-bezier(.34,1.56,.64,1)",
            }}
          >
            <span aria-hidden="true">🧹</span>
          </button>
        )}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            reset();
          }}
          disabled={running}
          aria-label="Start over"
          className="grid h-[52px] w-[52px] place-items-center rounded-2xl text-2xl active:scale-90 disabled:opacity-40"
          style={{
            touchAction: "none",
            background: "rgba(255,255,255,0.05)",
            border: "2px solid var(--color-line, #27314f)",
            transition: "transform 0.18s cubic-bezier(.34,1.56,.64,1)",
          }}
        >
          <span aria-hidden="true">🔄</span>
        </button>
      </div>

      {/* celebratory floaters (final win only) */}
      {done && (
        <div className="pointer-events-none flex justify-center gap-2 text-2xl">
          <span style={{ animation: "jrdrive-float 1.6s ease-in-out infinite" }} aria-hidden="true">✨</span>
          <span style={{ animation: "jrdrive-float 1.6s ease-in-out 0.2s infinite" }} aria-hidden="true">🎉</span>
          <span style={{ animation: "jrdrive-float 1.6s ease-in-out 0.4s infinite" }} aria-hidden="true">✨</span>
        </div>
      )}

      <style>{`
        @keyframes jrdrive-bob {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-3px) scale(1.03); }
        }
        @keyframes jrdrive-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes jrdrive-puff {
          0% { transform: translateX(0) scale(0.7); opacity: 0.9; }
          100% { transform: translateX(-14px) scale(1.3); opacity: 0; }
        }
        @keyframes jrdrive-wobble {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-7deg); }
          60% { transform: rotate(5deg); }
          85% { transform: rotate(-3deg); }
        }
        @keyframes jrdrive-cheer {
          0%, 100% { transform: translateY(0) scale(1); }
          40% { transform: translateY(-12px) scale(1.12); }
          70% { transform: translateY(0) scale(0.96); }
        }
        @keyframes jrdrive-pop {
          0% { transform: scale(0.5); }
          55% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        @keyframes jrdrive-flag {
          0%, 100% { transform: rotate(-4deg); }
          50% { transform: rotate(4deg); }
        }
        @keyframes jrdrive-confetti {
          0% { transform: translate(0, 0) scale(0.4); opacity: 0; }
          25% { opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(1.1); opacity: 0; }
        }
        @keyframes jrdrive-float {
          0%, 100% { transform: translateY(0); opacity: 0.85; }
          50% { transform: translateY(-10px); opacity: 1; }
        }
        @keyframes jrdrive-snap {
          0% { transform: translateY(-12px) scale(0.4); opacity: 0; }
          60% { transform: translateY(0) scale(1.18); opacity: 1; }
          80% { transform: translateY(0) scale(0.94); }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes jrdrive-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.12); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="infinite"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

/** A chunky build button with a solid drop "lip" and springy press. */
interface BuildButtonProps {
  label: string;
  glyph: string;
  done: boolean;
  springing: boolean;
  onPress: () => void;
}

function BuildButton({ label, glyph, done, springing, onPress }: BuildButtonProps) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        if (!done) onPress();
      }}
      disabled={done}
      aria-label={done ? `${label} done` : label}
      className="grid h-[78px] w-[78px] place-items-center rounded-2xl text-4xl active:scale-90 disabled:opacity-100"
      style={{
        touchAction: "none",
        background: done ? "rgba(52,211,153,0.18)" : "rgba(11,16,32,0.6)",
        border: `3px solid ${done ? ACCENT : "var(--color-line, #27314f)"}`,
        boxShadow: done ? "none" : `0 6px 0 0 #0e3a2c`,
        transition: "transform 0.18s cubic-bezier(.34,1.56,.64,1)",
        animation: springing ? "jrdrive-snap 0.46s cubic-bezier(.34,1.56,.64,1)" : undefined,
      }}
    >
      <span aria-hidden="true">{done ? "✅" : glyph}</span>
    </button>
  );
}

/** A big drive button. solid = the main GO; lip via boxShadow offset. */
interface DriveButtonProps {
  label: string;
  glyph: string;
  tint: string;
  solid?: boolean;
  disabled: boolean;
  active: boolean;
  /** When true (GO button with a planned route), gently pulses to invite a tap. */
  ready?: boolean;
  onPress: () => void;
}

function DriveButton({ label, glyph, tint, solid, disabled, active, ready, onPress }: DriveButtonProps) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      disabled={disabled}
      aria-label={label}
      className="grid h-[84px] flex-1 place-items-center rounded-2xl text-4xl active:scale-90 disabled:opacity-50"
      style={{
        touchAction: "none",
        background: tint,
        color: solid ? "#060810" : ACCENT,
        border: `3px solid ${ACCENT}`,
        boxShadow: solid ? `0 7px 0 0 #0e8a63` : `0 7px 0 0 #15392c`,
        outline: active ? `3px solid ${ACCENT}` : undefined,
        transition: "transform 0.18s cubic-bezier(.34,1.56,.64,1)",
        animation: ready ? "jrdrive-pulse 1.5s ease-in-out infinite" : undefined,
      }}
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  );
}
