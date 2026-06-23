"use client";
import type { ActivityProps } from "@/lib/activities/types";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ──────────────────────────────────────────────────────────────────────────
 * Press to Go 🔘 — a JUNIOR (Class 1-3, age ~6-8) ROBOTICS lab.
 * Core idea (unchanged): an INPUT (pressing a button) makes the robot DO an
 * OUTPUT — cause and effect. But now it is a real PROBLEM, not a one-tap toy.
 *
 * The robot shows a WISH on its chest screen — a picture of what it wants to
 * do: 💡 light up, 🌀 spin its fan, or 🎵 play music. Below sit the control
 * buttons, each wired to ONE output (shown by its own picture + colour). The
 * child must LOOK at the wish and press the matching button — the button's
 * place CHANGES every round, so "always press the green one" fails; you must
 * read the picture and reason which input makes that output.
 *
 *   Round 1 — 2 buttons, one wish.            (read + match)
 *   Round 2 — 3 buttons, shuffled, one wish.  (more inputs, must search)
 *   Round 3 — 3 buttons, a TWO-step wish 💡→🎵 in order.  (plan a sequence)
 *
 * The twist that defeats luck: round 3 needs the RIGHT outputs in the RIGHT
 * ORDER. A wrong/early press gives a gentle wobble and the plan restarts —
 * never a scold. Solve all three → the robot dances, ⭐⭐⭐, onComplete once.
 *
 * Understood from VISUALS alone — emoji, colour, big shapes; near-zero reading.
 * Touch-first, huge tap targets, deterministic, always winnable, no scolding.
 * ────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#34d399";

/** The three outputs the robot can do. Each has a picture and a button colour
 *  so the child can match by SHAPE and COLOUR — no reading needed. */
type Output = "light" | "fan" | "music";

interface OutputDef {
  icon: string; // what the robot DOES, shown on its screen and on the button
  color: string; // button colour so each input is its own thing
  shadow: string; // 3D press-shadow under the button
  label: string; // accessibility only — never shown
}

const OUTPUTS: Readonly<Record<Output, OutputDef>> = {
  light: { icon: "💡", color: "#f5c451", shadow: "#9c7510", label: "light up" },
  fan: { icon: "🌀", color: "#5cc8f0", shadow: "#1d7aa0", label: "spin the fan" },
  music: { icon: "🎵", color: "#e07ad8", shadow: "#9a3c93", label: "play music" },
};

/** A round = which buttons are on the panel (in this left-to-right order) and
 *  the WISH the robot makes (a sequence of outputs to perform in order).
 *  Hand-authored & deterministic: the button order is deliberately shuffled so
 *  the matching button sits in a different place each round (guess-defeating).
 *  Round 3's wish has TWO steps → the child must plan & press them in order. */
interface RoundDef {
  buttons: ReadonlyArray<Output>; // panel layout, left → right
  wish: ReadonlyArray<Output>; // do these outputs, in this order
}

const ROUNDS: ReadonlyArray<RoundDef> = [
  { buttons: ["light", "fan"], wish: ["fan"] }, // 2 buttons, match the spin
  { buttons: ["music", "light", "fan"], wish: ["light"] }, // 3 buttons shuffled, match the light
  { buttons: ["fan", "music", "light"], wish: ["light", "music"] }, // twist: a 2-step plan in order
];

type Phase = "play" | "doing" | "won" | "oops" | "done";

interface Spark {
  id: number;
  angle: number;
  dist: number;
  emoji: string;
}

const CONFETTI = ["⭐", "✨", "🎉", "💚", "🌟", "🎊"] as const;

/** Deterministic spark fan — no randomness, so grading/visuals stay reproducible. */
function makeSparks(count: number, seed: number): Spark[] {
  return Array.from({ length: count }).map((_, i) => ({
    id: seed * 100 + i,
    angle: (360 / count) * i + (i % 3) * 9,
    dist: 80 + (i % 4) * 16,
    emoji: CONFETTI[i % CONFETTI.length],
  }));
}

export default function PresstoGo({ onComplete }: ActivityProps) {
  const [round, setRound] = useState<number>(0);
  // How many steps of THIS round's wish are already correctly done.
  const [progress, setProgress] = useState<number>(0);
  const [phase, setPhase] = useState<Phase>("play");
  // Which output the robot is currently performing (drives the live animation).
  const [active, setActive] = useState<Output | null>(null);
  // Springy "depress" pulse keyed per button + a wobble for a wrong press.
  const [poke, setPoke] = useState<number>(0);
  const [pokedKey, setPokedKey] = useState<string>("");
  const [wobbleKey, setWobbleKey] = useState<string>("");
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [stars, setStars] = useState<number>(0);

  const reportedRef = useRef<boolean>(false);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const audioRef = useRef<AudioContext | null>(null);

  const addTimer = useCallback((fn: () => void, ms: number): void => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
  }, []);

  const clearTimers = useCallback((): void => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const def = ROUNDS[round];
  const wish = def.wish;
  const lastRound = round >= ROUNDS.length - 1;

  // Fresh round: clear the plan + idle the robot.
  useEffect(() => {
    setProgress(0);
    setActive(null);
    setSparks([]);
    setPhase("play");
  }, [round]);

  const robotOn = phase === "doing" || phase === "won" || phase === "done";
  const won = phase === "won";
  const done = phase === "done";
  const celebrating = won || done;
  const busy = phase === "doing" || celebrating;

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
      window.setTimeout(() => blip(f, 0.18), i * 110);
    });
  }, [blip]);

  const burst = useCallback(
    (count: number, seed: number): void => {
      setSparks(makeSparks(count, seed));
      addTimer(() => setSparks([]), 1100);
    },
    [addTimer],
  );

  // ── Press a control button: the cause → effect moment, now a CHOICE. ──
  const press = useCallback(
    (out: Output, slot: number): void => {
      if (busy) return;
      const key = `${round}-${slot}`;

      const want = wish[progress];
      if (out !== want) {
        // Wrong input → gentle wobble, never a scold. A multi-step plan restarts
        // so the child re-counts; a single-step round just lets them try again.
        blip(220, 0.12);
        setWobbleKey(key);
        setActive(null);
        if (wish.length > 1 && progress > 0) {
          setProgress(0);
          setPhase("oops");
          addTimer(() => setPhase("play"), 620);
        }
        return;
      }

      // Right input → the robot performs that output.
      setPoke((p) => p + 1);
      setPokedKey(key);
      setActive(out);
      setPhase("doing");
      blip(out === "light" ? 740 : out === "fan" ? 590 : 880, 0.12);

      const next = progress + 1;
      setProgress(next);

      if (next < wish.length) {
        // More steps remain in this round's plan — flash the output, keep going.
        burst(6, next);
        addTimer(() => {
          setActive(null);
          setPhase("play");
        }, 560);
        return;
      }

      // Whole wish done → this round is solved.
      if (lastRound) {
        setPhase("done");
        burst(16, 99);
        chime();
        setStars(0);
        addTimer(() => setStars(1), 200);
        addTimer(() => setStars(2), 480);
        addTimer(() => setStars(3), 760);
        if (!reportedRef.current) {
          reportedRef.current = true;
          onComplete({
            passed: true,
            stars: 3,
            detail: "You matched every wish — input → output! 🔘🤖",
          });
        }
      } else {
        setPhase("won");
        burst(10, round + 1);
        chime();
        addTimer(() => setRound((r) => r + 1), 1150);
      }
    },
    [busy, round, wish, progress, lastRound, blip, burst, chime, addTimer, onComplete],
  );

  const reset = useCallback((): void => {
    clearTimers();
    reportedRef.current = false;
    setRound(0);
    setProgress(0);
    setActive(null);
    setPoke(0);
    setPokedKey("");
    setWobbleKey("");
    setSparks([]);
    setStars(0);
    setPhase("play");
  }, [clearTimers]);

  // Coach bubble emoji — wholly visual, no sentences.
  const coach = useMemo<string>(() => {
    if (done) return "🏆";
    if (won) return "🎉";
    if (phase === "oops") return "🤔";
    if (phase === "doing") return "✨";
    return "👀"; // "look at the wish, then choose"
  }, [done, won, phase]);

  // The screen shows the FULL wish (so multi-step plans are visible), with the
  // already-done steps checked off — a readable, count-able plan.
  const screenIcons: ReadonlyArray<{ out: Output; doneStep: boolean }> = wish.map((o, i) => ({
    out: o,
    doneStep: i < progress,
  }));

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono text-ink">
      <style>{`
        @keyframes jrbutton-breathe {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-5px) scale(1.015); }
        }
        @keyframes jrbutton-dance {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-10px) rotate(-6deg); }
          50% { transform: translateY(0) rotate(0deg); }
          75% { transform: translateY(-10px) rotate(6deg); }
        }
        @keyframes jrbutton-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes jrbutton-pulse {
          0%, 100% { opacity: 1; filter: drop-shadow(0 0 3px ${ACCENT}); }
          50% { opacity: 0.55; filter: drop-shadow(0 0 10px ${ACCENT}); }
        }
        @keyframes jrbutton-poke {
          0% { transform: scale(1); }
          35% { transform: scale(0.86) translateY(6px); }
          100% { transform: scale(1) translateY(0); }
        }
        @keyframes jrbutton-wobble {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(-9deg); }
          45% { transform: rotate(7deg); }
          70% { transform: rotate(-4deg); }
          90% { transform: rotate(2deg); }
        }
        @keyframes jrbutton-starpop {
          0% { transform: scale(0) rotate(-40deg); opacity: 0; }
          60% { transform: scale(1.4) rotate(10deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes jrbutton-fly {
          0% { transform: translate(0,0) scale(0.4); opacity: 0; }
          25% { opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(1.2); opacity: 0; }
        }
        @keyframes jrbutton-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes jrbutton-wishpop {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.18); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes jrbutton-ready {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .jrbutton-spring {
          transition: transform 0.16s cubic-bezier(.34,1.56,.64,1);
          will-change: transform;
        }
        .jrbutton-spring:active:not(:disabled) { transform: scale(0.9); }
        @media (prefers-reduced-motion: reduce) {
          .jrbutton-anim { animation: none !important; }
          .jrbutton-spring { transition: none; }
        }
      `}</style>

      {/* ── Coach bubble + round dots (emoji only, no sentences) ── */}
      <div
        className="flex items-center gap-3 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={
          done
            ? "You matched all three wishes! Well done!"
            : won
              ? "Wish granted! Next robot wish coming up"
              : phase === "doing"
                ? "The robot is doing it!"
                : phase === "oops"
                  ? "Not that one — try again"
                  : wish.length > 1
                    ? `Round ${round + 1} of 3. Press the buttons that match the robot's wishes, in order`
                    : `Round ${round + 1} of 3. Press the button that matches the robot's wish`
        }
        style={{
          background: robotOn ? "rgba(52,211,153,0.16)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${robotOn ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: celebrating ? `0 0 20px ${ACCENT}66` : undefined,
        }}
      >
        <span
          aria-hidden="true"
          className="jrbutton-anim"
          style={{
            display: "inline-block",
            animation: celebrating ? "jrbutton-ready 0.7s ease-in-out infinite" : "jrbutton-bob 1.6s ease-in-out infinite",
          }}
        >
          {coach}
        </span>

        {/* round progress: solved ● / current ◉ / upcoming ○ */}
        <span aria-hidden="true" className="inline-flex items-center gap-1.5">
          {ROUNDS.map((_, i) => {
            const solved = i < round || done;
            const current = i === round && !done;
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
                  animation: current ? "jrbutton-ready 1.5s ease-in-out infinite" : undefined,
                }}
              />
            );
          })}
        </span>

        {done && (
          <span aria-hidden="true" className="text-2xl">
            {stars >= 1 && (
              <span className="jrbutton-anim" style={{ display: "inline-block", animation: "jrbutton-starpop 0.5s ease-out" }}>⭐</span>
            )}
            {stars >= 2 && (
              <span className="jrbutton-anim" style={{ display: "inline-block", animation: "jrbutton-starpop 0.5s ease-out" }}>⭐</span>
            )}
            {stars >= 3 && (
              <span className="jrbutton-anim" style={{ display: "inline-block", animation: "jrbutton-starpop 0.5s ease-out" }}>⭐</span>
            )}
          </span>
        )}
      </div>

      {/* ── The robot stage ── */}
      <div className="panel relative w-full overflow-hidden rounded-3xl border border-line p-3" style={{ maxWidth: 430 }}>
        {/* confetti layer (centred on the robot) */}
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          {sparks.map((s) => {
            const rad = (s.angle * Math.PI) / 180;
            const dx = Math.cos(rad) * s.dist;
            const dy = Math.sin(rad) * s.dist;
            return (
              <span
                key={s.id}
                aria-hidden="true"
                className="jrbutton-anim absolute text-2xl"
                style={
                  {
                    "--dx": `${dx}px`,
                    "--dy": `${dy}px`,
                    animation: "jrbutton-fly 1s ease-out forwards",
                  } as CSSProperties
                }
              >
                {s.emoji}
              </span>
            );
          })}
        </div>

        <svg
          viewBox="0 0 300 320"
          className="block w-full select-none"
          style={{ touchAction: "manipulation" }}
          role="img"
          aria-label="A friendly robot with a fan on its head and a screen on its chest showing what it wants to do"
        >
          <defs>
            <filter id="jrb-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* whole robot: idle breathing while waiting, happy dance on win */}
          <g
            className="jrbutton-anim"
            style={{
              transformOrigin: "150px 200px",
              transformBox: "view-box",
              animation: celebrating
                ? "jrbutton-dance 0.7s ease-in-out infinite"
                : "jrbutton-breathe 2.6s ease-in-out infinite",
            }}
          >
            {/* head fan ── spins only while the robot is performing the fan, or celebrating */}
            <g
              className="jrbutton-anim"
              style={{
                transformOrigin: "150px 54px",
                transformBox: "view-box",
                animation:
                  (active === "fan" && phase === "doing") || celebrating
                    ? "jrbutton-spin 0.5s linear infinite"
                    : "none",
              }}
            >
              <text x="150" y="66" textAnchor="middle" fontSize="40" aria-hidden="true" opacity={robotOn ? 1 : 0.45}>
                {robotOn ? "🌀" : "✜"}
              </text>
            </g>
            {/* fan post */}
            <rect x="146" y="70" width="8" height="20" rx="4" fill="#3a4866" />

            {/* head */}
            <rect
              x="92"
              y="88"
              width="116"
              height="92"
              rx="24"
              fill="#0b1220"
              stroke={robotOn ? ACCENT : "#3a4866"}
              strokeWidth="4"
              style={{ transition: "stroke 240ms ease" }}
            />

            {/* eyes ── light up when the robot is doing the LIGHT output, or celebrating */}
            {[120, 180].map((ex) => {
              const lit = (active === "light" && phase === "doing") || celebrating;
              return (
                <g key={ex}>
                  <circle
                    cx={ex}
                    cy="126"
                    r="15"
                    fill={lit ? "#f5c451" : robotOn ? ACCENT : "#1b2436"}
                    stroke={lit ? "#f5c451" : robotOn ? ACCENT : "#3a4866"}
                    strokeWidth="3"
                    filter={lit || robotOn ? "url(#jrb-glow)" : undefined}
                    style={{ transition: "fill 220ms ease, stroke 220ms ease" }}
                  />
                  <circle cx={ex} cy="126" r="6" fill={robotOn ? "#05140d" : "#2a3550"} />
                </g>
              );
            })}

            {/* mouth: flat when off, big smile when on */}
            <path
              d={robotOn ? "M120 158 Q150 178 180 158" : "M122 160 H178"}
              fill="none"
              stroke={robotOn ? ACCENT : "#3a4866"}
              strokeWidth="4"
              strokeLinecap="round"
              style={{ transition: "stroke 240ms ease" }}
            />

            {/* body */}
            <rect
              x="80"
              y="186"
              width="140"
              height="104"
              rx="22"
              fill="#0b1220"
              stroke={robotOn ? ACCENT : "#3a4866"}
              strokeWidth="4"
              style={{ transition: "stroke 240ms ease" }}
            />

            {/* arms ── raised & cheering on win */}
            <g style={{ transition: "transform 240ms ease" }}>
              <rect
                x="56"
                y={celebrating ? 176 : 200}
                width="22"
                height="60"
                rx="11"
                fill="#0b1220"
                stroke={robotOn ? ACCENT : "#3a4866"}
                strokeWidth="4"
                style={{ transition: "y 240ms ease, stroke 240ms ease" }}
              />
              <rect
                x="222"
                y={celebrating ? 176 : 200}
                width="22"
                height="60"
                rx="11"
                fill="#0b1220"
                stroke={robotOn ? ACCENT : "#3a4866"}
                strokeWidth="4"
                style={{ transition: "y 240ms ease, stroke 240ms ease" }}
              />
            </g>

            {/* CHEST SCREEN — the robot's WISH: the picture(s) it wants to do.
                Already-done steps get a soft ✓ tint so a 2-step plan reads clearly. */}
            <rect
              x="98"
              y="206"
              width="104"
              height="64"
              rx="14"
              fill="#05080f"
              stroke={robotOn ? ACCENT : "#4a567e"}
              strokeWidth="3"
              style={{ transition: "stroke 220ms ease" }}
            />
            <g transform="translate(150 238)">
              {screenIcons.map((it, i) => {
                const n = screenIcons.length;
                // space the wish icons across the little screen
                const spread = n > 1 ? 30 : 0;
                const x = (i - (n - 1) / 2) * spread;
                const isNow = i === progress && !celebrating && phase !== "oops";
                return (
                  <g key={`${round}-wish-${i}`} transform={`translate(${x} 0)`}>
                    {/* highlight ring around the CURRENT step to chase */}
                    {isNow && (
                      <circle
                        cx="0"
                        cy="0"
                        r="17"
                        fill="none"
                        stroke={ACCENT}
                        strokeWidth="2.5"
                        opacity="0.9"
                        className="jrbutton-anim"
                        style={{ animation: "jrbutton-pulse 1.2s ease-in-out infinite" }}
                      />
                    )}
                    <text
                      x="0"
                      y="1"
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="26"
                      aria-hidden="true"
                      className="jrbutton-anim"
                      opacity={it.doneStep ? 0.4 : 1}
                      style={{ animation: isNow ? "jrbutton-wishpop 0.4s ease-out" : undefined }}
                    >
                      {OUTPUTS[it.out].icon}
                    </text>
                    {/* tiny tick over a step that's already been performed */}
                    {it.doneStep && (
                      <text x="9" y="-9" textAnchor="middle" dominantBaseline="central" fontSize="15" aria-hidden="true">
                        ✅
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </g>
        </svg>
      </div>

      {/* ── THE CONTROL PANEL: one button per output, shuffled each round.
            Read the robot's wish, then press the matching picture. ── */}
      <div className="flex w-full max-w-[430px] items-stretch justify-center gap-3">
        {def.buttons.map((out, slot) => {
          const o = OUTPUTS[out];
          const key = `${round}-${slot}`;
          const isPoked = pokedKey === key && poke > 0;
          const isWobbling = wobbleKey === key;
          return (
            <button
              key={key}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                press(out, slot);
              }}
              disabled={busy}
              aria-label={`Button to make the robot ${o.label}`}
              className="jrbutton-spring grid flex-1 place-items-center rounded-full disabled:opacity-70"
              style={{
                height: 96,
                maxWidth: 120,
                touchAction: "manipulation",
                background: o.color,
                border: `4px solid rgba(255,255,255,0.55)`,
                color: "#05140d",
                fontSize: 44,
                boxShadow: `0 8px 0 0 ${o.shadow}`,
                animation: isWobbling
                  ? "jrbutton-wobble 0.5s ease-in-out"
                  : isPoked
                    ? "jrbutton-poke 0.32s cubic-bezier(.34,1.56,.64,1)"
                    : undefined,
              }}
            >
              <span aria-hidden="true">{o.icon}</span>
            </button>
          );
        })}
      </div>

      {/* ── Reset ── */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          reset();
        }}
        aria-label="Start over from round one"
        className="jrbutton-spring grid h-[56px] w-[56px] place-items-center rounded-2xl text-2xl"
        style={{
          touchAction: "manipulation",
          background: "rgba(255,255,255,0.05)",
          border: "2px solid var(--color-line, #33405c)",
          boxShadow: "0 5px 0 0 rgba(0,0,0,0.35)",
        }}
      >
        <span aria-hidden="true">🔄</span>
      </button>
    </div>
  );
}
