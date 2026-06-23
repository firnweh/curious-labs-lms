"use client";
// Make It Spin 🌀 — a JUNIOR (Class 1-3, age ~6-8) ROBOTICS lab.
// Single learning goal: electricity must flow in a COMPLETE LOOP for the motor
// to spin. A loop is battery 🔋 → wire → switch → motor ⚙️ → back. If ANY piece
// is missing, no current flows and nothing happens.
//
// UPGRADE — now a real problem, not a one-tap toy. Across THREE rounds the rig
// has GAPS in the loop that the child must fill by dragging the right part from
// a small tray into the matching empty socket, THEN flipping the switch:
//   • Round 1 — one gap (the motor). Gentle intro.
//   • Round 2 — TWO gaps (battery + motor). Both must be filled or the loop
//     stays open; flipping the switch on a half-built loop just nudges, never
//     scolds, and the still-empty socket flickers to point the way.
//   • Round 3 — the GUESS-DEFEATER. The tray now offers a DECOY part (a 💡 bulb)
//     that does NOT fit either gap. Tapping parts at random fails — the child
//     must MATCH each part to the socket of the same shape/emoji to close the
//     loop. Only the correct two parts make it spin.
// Fill every gap correctly → flip the switch → fan whirls, wind flies, party.
// Win all three → ⭐⭐⭐, onComplete once. Deterministic, always winnable, no
// reading (emoji, colour, shape). Touch-first (onPointerDown). Never scolds.
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useRef, useState } from "react";

const ACCENT = "#34d399";

/** Hub centre in the 300×200 viewBox — blades spin around this point. */
const HUB = { x: 200, y: 92 };

/** A part that can sit in a socket on the loop. Each has its own emoji + colour. */
type PartKind = "battery" | "switch" | "motor";

/** A socket on the loop: a fixed spot that either holds a part or is an empty gap
 *  the child must fill. `need` is which part the loop needs here. */
interface Socket {
  id: string;
  /** which part belongs in this socket */
  need: PartKind;
  /** true → starts already installed; false → starts empty (a gap to fill) */
  preinstalled: boolean;
  /** centre of the socket in viewBox units */
  x: number;
  y: number;
}

/** One round = the loop's sockets + the parts offered in the tray (incl. decoys). */
interface Round {
  sockets: ReadonlyArray<Socket>;
  /** parts offered in the tray; some rounds add a decoy that fits no socket */
  tray: ReadonlyArray<PartKind | "bulb">;
}

/** Fixed socket positions on the loop (battery left, switch bottom, motor right). */
const SOCKET_BATTERY = { x: 58, y: 136 };
const SOCKET_SWITCH = { x: 150, y: 168 };
const SOCKET_MOTOR = { x: HUB.x, y: HUB.y };

/** Hand-authored rounds — deterministic, escalating. */
const ROUNDS: ReadonlyArray<Round> = [
  // Round 1: battery + switch already there, only the motor is a gap.
  {
    sockets: [
      { id: "bat", need: "battery", preinstalled: true, ...SOCKET_BATTERY },
      { id: "sw", need: "switch", preinstalled: true, ...SOCKET_SWITCH },
      { id: "mot", need: "motor", preinstalled: false, ...SOCKET_MOTOR },
    ],
    tray: ["motor"],
  },
  // Round 2: TWO gaps — battery and motor. Both must be filled.
  {
    sockets: [
      { id: "bat", need: "battery", preinstalled: false, ...SOCKET_BATTERY },
      { id: "sw", need: "switch", preinstalled: true, ...SOCKET_SWITCH },
      { id: "mot", need: "motor", preinstalled: false, ...SOCKET_MOTOR },
    ],
    tray: ["motor", "battery"],
  },
  // Round 3: two gaps again + a DECOY 💡 bulb that fits nothing. Must MATCH parts.
  {
    sockets: [
      { id: "bat", need: "battery", preinstalled: false, ...SOCKET_BATTERY },
      { id: "sw", need: "switch", preinstalled: true, ...SOCKET_SWITCH },
      { id: "mot", need: "motor", preinstalled: false, ...SOCKET_MOTOR },
    ],
    tray: ["battery", "bulb", "motor"],
  },
];

/** Emoji + label for each kind, so sockets and tray chips read the same. */
const PART_EMOJI: Record<PartKind | "bulb", string> = {
  battery: "🔋",
  switch: "🔘",
  motor: "⚙️",
  bulb: "💡",
};
const PART_LABEL: Record<PartKind | "bulb", string> = {
  battery: "battery",
  switch: "switch",
  motor: "motor",
  bulb: "bulb (does not fit)",
};

type Phase = "building" | "spinning";

/** Confetti burst pieces for the win party. */
interface Spark {
  id: number;
  dx: number;
  dy: number;
  emoji: string;
  delay: number;
}
const PARTY = ["✨", "🎉", "⭐", "💫", "🌟"];

export default function MakeItSpin({ onComplete }: ActivityProps) {
  const [round, setRound] = useState<number>(0);
  const [phase, setPhase] = useState<Phase>("building");
  // Which sockets are currently filled with the CORRECT part (by socket id).
  const [filled, setFilled] = useState<Record<string, boolean>>({});
  // Which tray part the child has "picked up" (selected) and is about to place.
  const [held, setHeld] = useState<number | null>(null);
  const [spin, setSpin] = useState<number>(0); // accumulated rotation, degrees
  const [speed, setSpeed] = useState<number>(0); // current deg/sec, eases up
  const [snapId, setSnapId] = useState<string | null>(null); // socket that just snapped
  const [wobble, setWobble] = useState<boolean>(false); // switch nudge
  const [missWobble, setMissWobble] = useState<boolean>(false); // wrong-place nudge
  const [hintId, setHintId] = useState<string | null>(null); // socket to flicker as a hint
  const [sparks, setSparks] = useState<Spark[]>([]);

  const rafRef = useRef<number | null>(null);
  const speedRef = useRef<number>(0);
  const targetRef = useRef<number>(0); // 0 when off, full when on
  const reportedRef = useRef<boolean>(false);
  const wobbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const missTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const cfg = ROUNDS[round];
  const on = phase === "spinning";
  const isLast = round >= ROUNDS.length - 1;

  // A socket is "ready" if it's pre-installed or has been filled correctly.
  const socketReady = useCallback(
    (s: Socket): boolean => s.preinstalled || filled[s.id] === true,
    [filled],
  );
  // The loop is closed when EVERY socket is ready.
  const loopClosed = cfg.sockets.every(socketReady);

  // ── One rAF loop for the whole life of the lab: blades keep their angle,
  // speed eases toward a target so flipping ON *accelerates* smoothly. ──
  useEffect(() => {
    let last = 0;
    const tick = (t: number): void => {
      if (last === 0) last = t;
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const target = targetRef.current;
      const k = target > speedRef.current ? 3.0 : 2.2;
      const next = speedRef.current + (target - speedRef.current) * Math.min(k * dt, 1);
      speedRef.current = next;
      setSpeed(next);
      if (next > 0.5) setSpin((s) => (s + next * dt) % 360);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, []);

  useEffect(() => {
    targetRef.current = on ? 760 : 0;
  }, [on]);

  // Clear every timer on unmount.
  useEffect(
    () => () => {
      [wobbleTimer, missTimer, snapTimer, hintTimer, nextTimer].forEach((r) => {
        if (r.current !== null) clearTimeout(r.current);
      });
    },
    [],
  );

  // Fresh round → empty all the gaps, drop any held part, stop the fan.
  useEffect(() => {
    setFilled({});
    setHeld(null);
    setSnapId(null);
    setHintId(null);
    setSparks([]);
    setPhase("building");
    targetRef.current = 0;
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
      gain.gain.exponentialRampToValueAtTime(0.16, ac.currentTime + 0.02);
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

  // The first still-empty gap (used for a gentle "look here" flicker hint).
  const firstGap = cfg.sockets.find((s) => !socketReady(s));

  // ── Pick up a tray part (toggle selection). ──
  const pickUp = useCallback(
    (idx: number): void => {
      if (on) return;
      blip(620, 0.06);
      setHeld((h) => (h === idx ? null : idx));
    },
    [on, blip],
  );

  // ── Tap a socket: if it's an empty gap and we're holding the matching part,
  // it snaps in. Wrong part (or decoy) → gentle miss wobble, stays empty. ──
  const tapSocket = useCallback(
    (s: Socket): void => {
      if (on) return;
      if (socketReady(s)) return; // already filled / pre-installed
      if (held === null) {
        // Nothing picked up yet → flicker this gap to invite filling it.
        setHintId(s.id);
        if (hintTimer.current !== null) clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setHintId(null), 900);
        blip(440, 0.06);
        return;
      }
      const part = cfg.tray[held];
      if (part === s.need) {
        // Correct match → snap it in, clear the hand.
        blip(720, 0.09);
        setFilled((f) => ({ ...f, [s.id]: true }));
        setHeld(null);
        setSnapId(s.id);
        if (snapTimer.current !== null) clearTimeout(snapTimer.current);
        snapTimer.current = setTimeout(() => setSnapId(null), 480);
      } else {
        // Wrong part for this socket → friendly wobble, keep the part in hand.
        blip(300, 0.08);
        setMissWobble(true);
        if (missTimer.current !== null) clearTimeout(missTimer.current);
        missTimer.current = setTimeout(() => setMissWobble(false), 520);
      }
    },
    [on, socketReady, held, cfg.tray, blip],
  );

  // ── Flip the switch. If the loop isn't closed → friendly wobble + point at the
  // remaining gap. If closed → spin up, celebrate, advance. ──
  const flipSwitch = useCallback((): void => {
    if (on) {
      // Already spinning → let them switch it off (stays won, just stops).
      setPhase("building");
      return;
    }
    if (!loopClosed) {
      // Half-built loop → never scold: wobble + flicker the still-empty gap.
      blip(300, 0.1);
      setWobble(true);
      if (wobbleTimer.current !== null) clearTimeout(wobbleTimer.current);
      wobbleTimer.current = setTimeout(() => setWobble(false), 520);
      if (firstGap) {
        setHintId(firstGap.id);
        if (hintTimer.current !== null) clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setHintId(null), 1000);
      }
      // Per the contract: do NOT spam onComplete(passed:false) on retries.
      return;
    }
    // Loop closed → power flows, fan spins up.
    setPhase("spinning");
    const burst: Spark[] = Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2;
      return {
        id: i,
        dx: Math.cos(a) * (70 + (i % 3) * 22),
        dy: Math.sin(a) * (70 + (i % 3) * 22),
        emoji: PARTY[i % PARTY.length],
        delay: (i % 5) * 0.05,
      };
    });
    setSparks(burst);
    chime();

    if (isLast) {
      if (!reportedRef.current) {
        reportedRef.current = true;
        onComplete({ passed: true, stars: 3, detail: "You closed every loop — the motor spins! 🌀" });
      }
    } else {
      // Win this round, let the fan whirl a moment, then slide the next in.
      if (nextTimer.current !== null) clearTimeout(nextTimer.current);
      nextTimer.current = setTimeout(() => setRound((r) => r + 1), 1500);
    }
  }, [on, loopClosed, firstGap, isLast, blip, chime, onComplete]);

  const reset = useCallback((): void => {
    [wobbleTimer, missTimer, snapTimer, hintTimer, nextTimer].forEach((r) => {
      if (r.current !== null) {
        clearTimeout(r.current);
        r.current = null;
      }
    });
    reportedRef.current = false;
    setRound(0);
    setFilled({});
    setHeld(null);
    setSnapId(null);
    setWobble(false);
    setMissWobble(false);
    setHintId(null);
    setSparks([]);
    setPhase("building");
    targetRef.current = 0;
  }, []);

  const motorSocket = cfg.sockets.find((s) => s.need === "motor")!;
  const motorIn = socketReady(motorSocket);
  const batterySocket = cfg.sockets.find((s) => s.need === "battery")!;
  const batteryIn = socketReady(batterySocket);
  const fast = speed > 380;

  // Wind lines fly off only while the blades whirl.
  const wind = [
    { x: 252, y: 70 },
    { x: 256, y: 96 },
    { x: 248, y: 118 },
  ];

  // Wire segments light up green only when BOTH ends of that segment are live
  // AND the switch is on — so a half-built loop visibly stays dark.
  const liveLoop = on && loopClosed;

  return (
    <div className="flex w-full flex-col items-center gap-3" style={{ maxWidth: 430 }}>
      <style>{`
        @keyframes jrspin-bob {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes jrspin-snap {
          0% { transform: translateY(-26px) scale(0.7); opacity: 0; }
          60% { transform: translateY(4px) scale(1.12); opacity: 1; }
          80% { transform: translateY(-2px) scale(0.97); }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes jrspin-wobble {
          0%,100% { transform: rotate(0deg); }
          20% { transform: rotate(-9deg); }
          50% { transform: rotate(8deg); }
          75% { transform: rotate(-5deg); }
        }
        @keyframes jrspin-pulse {
          0%,100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.18); opacity: 0.7; }
        }
        @keyframes jrspin-flicker {
          0%,100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.16); }
        }
        @keyframes jrspin-wind {
          0% { transform: translateX(0); opacity: 0; }
          30% { opacity: 0.9; }
          100% { transform: translateX(34px); opacity: 0; }
        }
        @keyframes jrspin-fly {
          0% { transform: translate(0,0) scale(0.4); opacity: 0; }
          25% { opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(1.2); opacity: 0; }
        }
        @keyframes jrspin-star {
          0% { transform: scale(0) rotate(-30deg); }
          60% { transform: scale(1.35) rotate(8deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes jrspin-dance {
          0%,100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-8px) rotate(-8deg); }
          75% { transform: translateY(-8px) rotate(8deg); }
        }
        @keyframes jrspin-held {
          0%,100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-4px) scale(1.08); }
        }
        @keyframes jrspin-press {
          0% { transform: scale(1); }
          40% { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        .jrspin-spring { transition: transform 0.16s cubic-bezier(.34,1.56,.64,1); }
        .jrspin-spring:active:not(:disabled) { transform: scale(0.92); }
        @media (prefers-reduced-motion: reduce) {
          .jrspin-bob, .jrspin-pulse, .jrspin-wind, .jrspin-spring,
          [style*="infinite"] { animation: none !important; }
          .jrspin-spring { transition: none; }
        }
      `}</style>

      {/* ── Status: emoji only, no reading + round dots ── */}
      <div
        className="flex items-center justify-center gap-3 rounded-full px-4 py-1.5 text-3xl"
        role="status"
        aria-live="polite"
        aria-label={
          on
            ? isLast
              ? "You closed every loop — the motor is spinning! You did it!"
              : "Loop closed — the motor spins! Next rig coming up"
            : loopClosed
              ? "The loop is complete — flip the switch on"
              : held !== null
                ? "You are holding a part — tap the matching empty socket"
                : `Round ${round + 1} of 3 — fill the empty sockets to close the loop`
        }
        style={{
          background: on ? "rgba(52,211,153,0.16)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${on ? ACCENT : "var(--color-line, #27314f)"}`,
          boxShadow: on ? `0 0 20px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true" style={on ? { animation: "jrspin-dance 0.7s ease-in-out infinite" } : undefined}>
          {on ? "🤖" : loopClosed ? "🔌" : held !== null ? "✋" : "🧩"}
        </span>

        {/* round progress: solved ● / current ◉ / upcoming ○ */}
        <span aria-hidden="true" className="inline-flex items-center gap-1.5">
          {ROUNDS.map((_, i) => {
            const solved = i < round || (on && isLast);
            const current = i === round && !(on && isLast);
            return (
              <span
                key={i}
                className="grid place-items-center rounded-full"
                style={{
                  height: 13,
                  width: 13,
                  background: solved ? ACCENT : current ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.06)",
                  border: `2px solid ${solved || current ? ACCENT : "rgba(120,140,170,0.35)"}`,
                  boxShadow: current ? `0 0 8px ${ACCENT}88` : undefined,
                }}
              />
            );
          })}
        </span>

        {on && isLast && (
          <span aria-hidden="true" className="inline-flex gap-0.5 text-2xl">
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ display: "inline-block", animation: `jrspin-star 0.5s ease-out ${0.15 + i * 0.18}s both` }}>
                ⭐
              </span>
            ))}
          </span>
        )}
      </div>

      {/* ── The rig scene ── */}
      <div className="panel relative w-full overflow-hidden rounded-2xl border border-line p-2">
        {/* confetti party layer */}
        {sparks.length > 0 && (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center" aria-hidden="true">
            {sparks.map((s) => (
              <span
                key={s.id}
                className="absolute text-2xl"
                style={
                  {
                    "--dx": `${s.dx}px`,
                    "--dy": `${s.dy}px`,
                    animation: `jrspin-fly 0.95s ease-out ${s.delay}s forwards`,
                  } as React.CSSProperties
                }
              >
                {s.emoji}
              </span>
            ))}
          </div>
        )}

        <svg
          viewBox="0 0 300 200"
          className="block w-full select-none"
          style={{ touchAction: "manipulation" }}
          role="img"
          aria-label="A loop of wires joining a battery, a switch and a motor with a fan. Fill the empty sockets, then flip the switch to make it spin."
        >
          <defs>
            <radialGradient id="jrspin-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.9" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect x="0" y="0" width="300" height="200" rx="12" fill="#0b1020" />

          {/* ── Wires forming the loop. Light up (green) only when the whole loop
                is closed AND switched on. ── */}
          {/* battery → switch (bottom-left run) */}
          <path
            d={`M58 150 L58 168 L150 168`}
            fill="none"
            stroke={liveLoop ? ACCENT : "#2a3450"}
            strokeWidth="5"
            strokeLinecap="round"
            style={{ transition: "stroke 250ms ease" }}
          />
          {/* switch → motor (bottom-right run + up to hub) */}
          <path
            d={`M150 168 L${HUB.x} 168 L${HUB.x} 132`}
            fill="none"
            stroke={liveLoop ? ACCENT : "#2a3450"}
            strokeWidth="5"
            strokeLinecap="round"
            style={{ transition: "stroke 250ms ease" }}
          />
          {/* travelling spark pulses around the live loop when spinning */}
          {liveLoop && (
            <circle r="4" fill="#fff6c4">
              <animateMotion dur="0.8s" repeatCount="indefinite" path={`M58 150 L58 168 L${HUB.x} 168 L${HUB.x} 132`} />
            </circle>
          )}

          {/* ── Battery socket (left) ── */}
          {batteryIn ? (
            <g
              style={{
                transformBox: "view-box",
                transformOrigin: `${SOCKET_BATTERY.x}px ${SOCKET_BATTERY.y - 6}px`,
                animation: snapId === "bat" ? "jrspin-snap 0.46s cubic-bezier(.34,1.56,.64,1)" : on ? undefined : "jrspin-bob 2.6s ease-in-out infinite",
              }}
            >
              <rect x="36" y="120" width="44" height="32" rx="7" fill="#13351f" stroke={ACCENT} strokeWidth="2.5" />
              <text x="58" y="142" textAnchor="middle" fontSize="22" style={{ pointerEvents: "none" }}>
                🔋
              </text>
            </g>
          ) : (
            <EmptySocket
              cx={SOCKET_BATTERY.x}
              cy={SOCKET_BATTERY.y}
              r={26}
              need="battery"
              hint={hintId === "bat"}
              onTap={() => tapSocket(batterySocket)}
            />
          )}

          {/* ── Motor mount + fan (right) ── */}
          {!motorIn ? (
            <EmptySocket
              cx={SOCKET_MOTOR.x}
              cy={SOCKET_MOTOR.y}
              r={34}
              need="motor"
              hint={hintId === "mot"}
              onTap={() => tapSocket(motorSocket)}
            />
          ) : (
            <g
              style={{
                transformBox: "view-box",
                transformOrigin: `${HUB.x}px ${HUB.y}px`,
                animation: snapId === "mot"
                  ? "jrspin-snap 0.46s cubic-bezier(.34,1.56,.64,1)"
                  : on
                    ? undefined
                    : "jrspin-bob 2.8s ease-in-out infinite",
              }}
            >
              {/* glow halo when whirling fast */}
              {fast && <circle cx={HUB.x} cy={HUB.y} r="50" fill="url(#jrspin-glow)" />}

              {/* motor body */}
              <rect x={HUB.x - 16} y={HUB.y + 26} width="32" height="26" rx="6" fill="#1b2440" stroke={ACCENT} strokeWidth="2.5" />
              <text x={HUB.x} y={HUB.y + 45} textAnchor="middle" fontSize="16" style={{ pointerEvents: "none" }}>
                ⚙️
              </text>

              {/* spinning fan blades (3) */}
              <g transform={`rotate(${spin} ${HUB.x} ${HUB.y})`}>
                {[0, 120, 240].map((base) => (
                  <g key={base} transform={`rotate(${base} ${HUB.x} ${HUB.y})`}>
                    <path
                      d={`M${HUB.x} ${HUB.y}
                          Q${HUB.x - 16} ${HUB.y - 22} ${HUB.x - 3} ${HUB.y - 40}
                          Q${HUB.x + 14} ${HUB.y - 30} ${HUB.x} ${HUB.y} Z`}
                      fill={ACCENT}
                      opacity={on ? 0.95 : 0.7}
                      stroke="#0b1020"
                      strokeWidth="1.5"
                    />
                  </g>
                ))}
              </g>
              {/* hub cap */}
              <circle cx={HUB.x} cy={HUB.y} r="8" fill="#0b1020" stroke={ACCENT} strokeWidth="3" />
              <circle cx={HUB.x} cy={HUB.y} r="3" fill={ACCENT} />

              {/* wind lines flying off while spinning */}
              {on &&
                wind.map((w, i) => (
                  <g key={i} aria-hidden="true">
                    <path
                      d={`M${w.x} ${w.y} q12 0 22 0`}
                      fill="none"
                      stroke={ACCENT}
                      strokeWidth="3"
                      strokeLinecap="round"
                      style={{ animation: `jrspin-wind ${fast ? 0.5 : 0.8}s linear ${i * 0.18}s infinite` }}
                    />
                  </g>
                ))}
            </g>
          )}

          {/* ── Switch socket (bottom centre) — always pre-installed; shown so the
                loop reads as battery → switch → motor. ── */}
          <g aria-hidden="true">
            <rect x={SOCKET_SWITCH.x - 18} y={SOCKET_SWITCH.y - 14} width="36" height="28" rx="6" fill="#1b2440" stroke={liveLoop ? ACCENT : "#2a3450"} strokeWidth="2" style={{ transition: "stroke 250ms ease" }} />
            <text x={SOCKET_SWITCH.x} y={SOCKET_SWITCH.y + 6} textAnchor="middle" fontSize="16" style={{ pointerEvents: "none" }}>
              {on ? "🟢" : "🔘"}
            </text>
          </g>
        </svg>
      </div>

      {/* ── Parts tray: tap a part to pick it up (✋), then tap its empty socket ── */}
      <div
        className="flex w-full items-center justify-center gap-3 rounded-2xl px-3 py-2"
        style={{ background: "rgba(255,255,255,0.04)", border: "2px dashed var(--color-line, #27314f)", minHeight: 72 }}
        aria-label="Parts tray — pick a part, then tap its socket"
      >
        {cfg.tray.map((part, idx) => {
          // A part is "used up" once its matching socket is filled (only one of
          // each kind per round, and the decoy bulb is never used).
          const used =
            part !== "bulb" &&
            cfg.sockets.some((s) => s.need === part && socketReady(s));
          const heldNow = held === idx && !used;
          return (
            <button
              key={idx}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                if (!used) pickUp(idx);
              }}
              disabled={on || used}
              aria-label={
                used
                  ? `${PART_LABEL[part]} placed`
                  : heldNow
                    ? `Holding the ${PART_LABEL[part]} — tap its socket`
                    : `Pick up the ${PART_LABEL[part]}`
              }
              aria-pressed={heldNow}
              className="jrspin-spring grid place-items-center rounded-2xl text-3xl disabled:opacity-30"
              style={{
                height: 56,
                width: 56,
                touchAction: "none",
                background: heldNow ? "rgba(52,211,153,0.18)" : "rgba(255,255,255,0.05)",
                border: `3px solid ${heldNow ? ACCENT : "rgba(120,140,170,0.3)"}`,
                boxShadow: heldNow ? `0 0 14px ${ACCENT}88` : "0 4px 0 0 rgba(0,0,0,0.25)",
                opacity: used ? 0.3 : 1,
                animation: heldNow ? "jrspin-held 0.7s ease-in-out infinite" : undefined,
              }}
            >
              <span aria-hidden="true">{used ? "✅" : PART_EMOJI[part]}</span>
            </button>
          );
        })}
      </div>

      {/* ── The BIG switch — flip ON once the loop is closed ── */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          flipSwitch();
        }}
        disabled={false}
        aria-label={on ? "Switch is on, tap to turn off" : loopClosed ? "Flip the switch on" : "Switch — finish the loop first"}
        aria-pressed={on}
        className="font-display flex w-full items-center justify-between gap-3 rounded-2xl px-5 font-extrabold"
        style={{
          minHeight: 88,
          touchAction: "manipulation",
          background: on ? ACCENT : "rgba(11,16,32,0.7)",
          color: on ? "#060810" : "#9aa6cf",
          borderWidth: on ? 0 : 3,
          borderStyle: "solid",
          borderColor: "var(--color-line, #27314f)",
          boxShadow: on ? `0 7px 0 0 #15916a, 0 0 22px ${ACCENT}88` : "0 7px 0 0 #161d33",
          opacity: loopClosed || on ? 1 : 0.85,
          animation: wobble ? "jrspin-wobble 0.5s ease-in-out" : loopClosed && !on ? "jrspin-press 0s" : undefined,
        }}
      >
        <span aria-hidden="true" className="text-3xl">
          {on ? "🌀" : loopClosed ? "🔘" : "🔌"}
        </span>
        {/* the physical toggle track */}
        <span
          className="relative inline-flex items-center rounded-full"
          aria-hidden="true"
          style={{
            width: 96,
            height: 48,
            background: on ? "rgba(6,8,16,0.35)" : "#0b1020",
            border: `2px solid ${on ? "#060810" : "#2a3450"}`,
          }}
        >
          <span
            className="absolute grid place-items-center rounded-full text-xl"
            style={{
              width: 40,
              height: 40,
              top: 2,
              left: on ? 50 : 2,
              background: on ? "#060810" : "#2a3450",
              color: on ? ACCENT : "#9aa6cf",
              transition: "left 240ms cubic-bezier(.34,1.56,.64,1)",
            }}
          >
            {on ? "ON" : ""}
          </span>
        </span>
        <span style={{ fontSize: 22 }}>{on ? "ON" : "OFF"}</span>
      </button>

      {/* ── Reset ── */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          reset();
        }}
        aria-label="Start over from round one"
        className="jrspin-spring flex items-center justify-center gap-2 rounded-2xl border-2 border-line bg-panel/60 px-6 text-2xl font-bold text-ink-dim"
        style={{ minHeight: 52, touchAction: "none" }}
      >
        <span aria-hidden="true">🔄</span>
      </button>
    </div>
  );
}

/* ── An empty socket: a dashed ring showing which part it needs (its emoji),
   pulsing gently, flickering brighter when hinted. Tappable to drop a held part. */
function EmptySocket({
  cx,
  cy,
  r,
  need,
  hint,
  onTap,
}: {
  cx: number;
  cy: number;
  r: number;
  need: PartKind;
  hint: boolean;
  onTap: () => void;
}): React.ReactElement {
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`Empty socket for the ${PART_LABEL[need]}`}
      onPointerDown={(e) => {
        e.preventDefault();
        onTap();
      }}
      style={{ cursor: "pointer", touchAction: "none" }}
    >
      {/* generous invisible hit area for small fingers */}
      <circle cx={cx} cy={cy} r={r + 8} fill="transparent" />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={hint ? "rgba(52,211,153,0.12)" : "none"}
        stroke={hint ? ACCENT : "#3a4566"}
        strokeWidth="3"
        strokeDasharray="7 7"
        style={{ transition: "stroke 200ms ease, fill 200ms ease" }}
      />
      <text
        x={cx}
        y={cy + r * 0.32}
        textAnchor="middle"
        fontSize={r * 0.95}
        opacity={hint ? 1 : 0.55}
        style={{
          pointerEvents: "none",
          transformBox: "fill-box",
          transformOrigin: "center",
          animation: hint ? "jrspin-flicker 0.5s ease-in-out infinite" : "jrspin-pulse 1.6s ease-in-out infinite",
        }}
      >
        {PART_EMOJI[need]}
      </text>
    </g>
  );
}
