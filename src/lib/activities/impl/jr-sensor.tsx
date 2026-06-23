"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ──────────────────────────────────────────────────────────────────────────
 * Magic Eye 👀 — a JUNIOR (Class 1-3, age ~6-8) ROBOTICS lab.
 * ONE learning goal, now made into a real PROBLEM: a SENSOR robot reacts by a
 * RULE the child sets — "WHEN the eye sees ___, the light turns ON." The child
 * doesn't just watch; they CHOOSE the trigger, then press GO ▶ to run every
 * scene and PREDICT→RUN→REVEAL whether their rule was right.
 *
 * THREE rounds, each a fresh, harder rule (escalating):
 *   1) Night-light: light should come ON in the DARK 🌙 (off in ☀️).
 *   2) TWIST — sun-catcher: the rule FLIPS, light comes ON in the BRIGHT ☀️.
 *      (the "dark = on" habit from round 1 now fails → must re-reason.)
 *   3) DECOY threshold: three brightnesses ☀️ ⛅ 🌙. Only the DARKEST 🌙 must
 *      trigger; the dim ⛅ middle is a trap that must stay OFF. Picking "dark"
 *      is the only choice that lights the right scenes and leaves the trap dark.
 *
 * The child taps ONE big trigger-card to set the rule, presses GO to run the
 * scenes (the robot reacts automatically, frame by frame), then the round is
 * checked: every scene right → that round is won and the next, harder one
 * slides in. A wrong rule → gentle 🤔 wobble, scenes reset, try another card.
 * Always winnable, never scolds. NO READING (emoji, colour, brightness dots).
 * Touch-first (onPointerDown), deterministic, onComplete once on FINAL win.
 * ────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#34d399";
const SCENE_MS = 760; // time the robot dwells on each scene while running

/** A single light level the eye can read. Brighter = bigger number. */
type Level = "bright" | "dim" | "dark";

/** A round: the ordered scenes that play, the trigger cards the child may pick,
 *  and which single trigger is the CORRECT rule (lights exactly the right scenes). */
interface Round {
  scenes: readonly Level[];
  /** Trigger choices shown as big cards (the rule = "ON when eye reads this"). */
  choices: readonly Level[];
  /** The one trigger that makes the lamp behave correctly in every scene. */
  answer: Level;
}

/** Hand-authored, deterministic rounds — distance/decoys are fixed, never random. */
const ROUNDS: readonly Round[] = [
  // 1) plain night-light: dark → on, bright → off. Two scenes, two choices.
  { scenes: ["bright", "dark"], choices: ["bright", "dark"], answer: "dark" },
  // 2) TWIST: the rule flips — light belongs in the BRIGHT.
  { scenes: ["dark", "bright"], choices: ["bright", "dark"], answer: "bright" },
  // 3) DECOY: dim middle must stay off; only the darkest triggers.
  { scenes: ["bright", "dim", "dark"], choices: ["bright", "dim", "dark"], answer: "dark" },
];

type Phase = "pick" | "running" | "oops" | "won" | "done";

/** Visuals per light level — sky gradient + sun/moon/cloud emoji + dot count. */
const LOOK: Record<Level, { sky: string; orb: string; dots: number; aria: string }> = {
  bright: {
    sky: "linear-gradient(180deg, #2a4d8f 0%, #4f86d6 55%, #8fc0f0 100%)",
    orb: "☀️",
    dots: 3,
    aria: "bright day",
  },
  dim: {
    sky: "linear-gradient(180deg, #243a63 0%, #3c5a8c 55%, #6f8db5 100%)",
    orb: "⛅",
    dots: 2,
    aria: "dim, cloudy light",
  },
  dark: {
    sky: "linear-gradient(180deg, #0a1230 0%, #131b46 60%, #1c2350 100%)",
    orb: "🌙",
    dots: 1,
    aria: "dark night",
  },
};

export default function JrSensor({ onComplete }: ActivityProps) {
  const [round, setRound] = useState<number>(0);
  const [pick, setPick] = useState<Level | null>(null); // the rule the child set
  const [phase, setPhase] = useState<Phase>("pick");
  const [sceneIdx, setSceneIdx] = useState<number>(0); // which scene is showing
  const [blink, setBlink] = useState<boolean>(false);

  const reportedRef = useRef<boolean>(false);
  const timers = useRef<number[]>([]);

  const cfg = ROUNDS[round];
  const scenes = cfg.scenes;
  const showing: Level = scenes[Math.min(sceneIdx, scenes.length - 1)];
  const armed = pick !== null;

  // The sensor's automatic reaction: lamp is ON iff this scene matches the rule.
  const lampOn = armed && (phase === "running" || phase === "won" || phase === "done") && showing === pick;

  const won = phase === "won";
  const done = phase === "done";
  const running = phase === "running";
  const oops = phase === "oops";
  const celebrating = won || done;

  const clearTimers = useCallback((): void => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);
  const later = useCallback((fn: () => void, ms: number): void => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // Fresh round: forget the old rule, park on the first scene, clear running state.
  useEffect(() => {
    clearTimers();
    setPick(null);
    setPhase("pick");
    setSceneIdx(0);
    setBlink(false);
  }, [round, clearTimers]);

  // Tap a trigger card → set the rule (only while choosing). Happy blink.
  const choose = useCallback(
    (lvl: Level): void => {
      if (phase !== "pick" && phase !== "oops") return;
      setPick(lvl);
      setPhase("pick");
      setSceneIdx(0);
      setBlink(true);
      later(() => setBlink(false), 360);
    },
    [phase, later],
  );

  // GO ▶ — run the scenes one by one; the lamp reacts by the chosen rule.
  // After the last scene, check: did the rule light EXACTLY the right scenes?
  const run = useCallback((): void => {
    if (pick === null || phase === "running" || celebrating) return;
    clearTimers();
    setPhase("running");
    setSceneIdx(0);
    setBlink(true);
    later(() => setBlink(false), 300);

    // Is the chosen trigger the correct rule for this round?
    const correct = pick === cfg.answer;

    // Step through every scene so the child SEES the robot react to each.
    for (let i = 1; i < scenes.length; i += 1) {
      const idx = i;
      later(() => setSceneIdx(idx), SCENE_MS * i);
    }

    // After the final scene has been seen, reveal the verdict.
    const endAt = SCENE_MS * scenes.length + 260;
    later(() => {
      if (correct) {
        const last = round >= ROUNDS.length - 1;
        if (last) {
          setPhase("done");
          if (!reportedRef.current) {
            reportedRef.current = true;
            onComplete({ passed: true, stars: 3, detail: "You set every sensor rule right! 👀💡" });
          }
        } else {
          setPhase("won");
          later(() => setRound((r) => r + 1), 1250);
        }
      } else {
        // Gentle, never a scold: wobble, drop back to the first scene, let them
        // try a different trigger card. Do NOT report a failure.
        setPhase("oops");
        later(() => {
          setPick(null);
          setSceneIdx(0);
          setPhase("pick");
        }, 1000);
      }
    }, endAt);
  }, [pick, phase, celebrating, cfg.answer, scenes, round, clearTimers, later, onComplete]);

  const reset = useCallback((): void => {
    clearTimers();
    reportedRef.current = false;
    setRound(0);
    setPick(null);
    setPhase("pick");
    setSceneIdx(0);
    setBlink(false);
  }, [clearTimers]);

  const look = LOOK[showing];

  const statusEmoji = done
    ? "🏆"
    : won
      ? "🎉"
      : oops
        ? "🤔"
        : running
          ? lampOn
            ? "💡"
            : "👁️"
          : pick === null
            ? "👁️"
            : "▶️";

  // Eye face: blinking → 😆, sleeping (no rule yet) → 💤, watching → 👁️.
  const eyeFace = blink ? "😆" : armed ? "👁️" : "💤";

  // Whether each scene in the strip has already been visited this run.
  const sceneState = useCallback(
    (i: number): "past" | "current" | "future" => {
      if (running || celebrating) {
        if (i < sceneIdx) return "past";
        if (i === sceneIdx) return "current";
        return "future";
      }
      return "future";
    },
    [running, celebrating, sceneIdx],
  );

  const ariaStatus = useMemo<string>(() => {
    if (done) return "You solved all three sensor rules!";
    if (won) return "Rule correct! The next robot is coming.";
    if (oops) return "That rule did not fit. Try a different trigger.";
    if (running) return "Running the scenes — watch the robot react.";
    if (pick === null) return `Round ${round + 1} of 3. Choose what the eye should react to, then press Go.`;
    return "A trigger is chosen. Press Go to test the rule.";
  }, [done, won, oops, running, pick, round]);

  return (
    <div className="flex w-full flex-col items-center gap-3" style={{ maxWidth: 430 }}>
      {/* ── Tiny emoji status + round dots ── */}
      <div
        className="flex items-center gap-3 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={ariaStatus}
        style={{
          background: celebrating ? "rgba(52,211,153,0.16)" : "rgba(255,255,255,0.05)",
          border: `2px solid ${celebrating ? ACCENT : "var(--color-line, #27314f)"}`,
          boxShadow: celebrating ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            animation: celebrating ? "jrsensor-celebrate 0.7s ease-in-out infinite" : undefined,
          }}
        >
          {statusEmoji}
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
                  animation: current ? "jrsensor-dot 1.5s ease-in-out infinite" : undefined,
                }}
              />
            );
          })}
        </span>

        {done && (
          <span aria-hidden="true" className="text-2xl">
            ⭐⭐⭐
          </span>
        )}
      </div>

      {/* ── The scene: sky + robot ── */}
      <div
        className="relative w-full overflow-hidden rounded-2xl border border-line"
        style={{ background: look.sky, transition: "background 600ms ease", touchAction: "manipulation" }}
      >
        <svg
          viewBox="0 0 360 300"
          className="block w-full select-none"
          role="img"
          aria-label="A robot with a big eye sensor under a sky that can be bright, dim, or dark."
        >
          <defs>
            <radialGradient id="js-lampGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffe08a" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#ffe08a" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="js-eyeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.9" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Sun / cloud / Moon up in the sky, gently bobbing */}
          <g
            style={{
              transformBox: "view-box",
              transformOrigin: "center",
              animation: "jrsensor-float 3s ease-in-out infinite",
            }}
          >
            <text x="300" y="56" fontSize="40" textAnchor="middle" dominantBaseline="central" aria-hidden="true">
              {look.orb}
            </text>
          </g>
          {/* Stars only when dark */}
          {showing === "dark" && (
            <g aria-hidden="true">
              <text x="70" y="46" fontSize="16" style={{ animation: "jrsensor-twinkle 2s ease-in-out infinite" }}>
                ✨
              </text>
              <text x="140" y="34" fontSize="13" style={{ animation: "jrsensor-twinkle 2.4s ease-in-out infinite 0.4s" }}>
                ⭐
              </text>
              <text x="210" y="50" fontSize="14" style={{ animation: "jrsensor-twinkle 2.2s ease-in-out infinite 0.8s" }}>
                ✨
              </text>
            </g>
          )}

          {/* Warm lamp glow when the light is on */}
          {lampOn && (
            <circle cx="180" cy="96" r="92" fill="url(#js-lampGlow)" style={{ animation: "jrsensor-glow 1.6s ease-in-out infinite" }} />
          )}

          {/* ── Robot body — gently breathes while idle ── */}
          <g
            style={{
              transformBox: "fill-box",
              transformOrigin: "center bottom",
              animation: celebrating
                ? "jrsensor-celebrate 0.7s ease-in-out infinite"
                : oops
                  ? "jrsensor-wobble 0.5s ease-in-out"
                  : "jrsensor-breathe 2.6s ease-in-out infinite",
            }}
          >
            {/* The lamp on its head — reacts automatically, not tappable. */}
            <g>
              {/* lamp stalk */}
              <rect x="174" y="120" width="12" height="26" rx="6" fill="#1d2b46" stroke="#41527a" strokeWidth="2" />
              {/* bulb */}
              <circle
                cx="180"
                cy="110"
                r="22"
                fill={lampOn ? "#ffe08a" : "#26324f"}
                stroke={lampOn ? "#ffd25e" : "#41527a"}
                strokeWidth="3"
                style={{
                  filter: lampOn ? "drop-shadow(0 0 10px #ffe08a)" : undefined,
                  transition: "fill 400ms ease, stroke 400ms ease",
                }}
              />
              <text x="180" y="112" fontSize="22" textAnchor="middle" dominantBaseline="central" aria-hidden="true">
                {lampOn ? "💡" : "🔌"}
              </text>
            </g>

            {/* Robot head/body box */}
            <rect x="120" y="150" width="120" height="110" rx="24" fill="#101a30" stroke={ACCENT} strokeWidth="4" />

            {/* The BIG EYE sensor — glows once a rule is set */}
            {armed && (
              <circle cx="180" cy="196" r="46" fill="url(#js-eyeGlow)" opacity="0.6" style={{ animation: "jrsensor-glow 2s ease-in-out infinite" }} />
            )}
            <g
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                animation: blink
                  ? "jrsensor-blink 0.4s ease"
                  : armed
                    ? "jrsensor-scan 3s ease-in-out infinite"
                    : "jrsensor-pulse 1.4s ease-in-out infinite",
              }}
            >
              <circle
                cx="180"
                cy="196"
                r="34"
                fill={armed ? "#0a2a22" : "#14233f"}
                stroke={armed ? ACCENT : "#41527a"}
                strokeWidth="4"
                style={{ transition: "fill 300ms ease, stroke 300ms ease" }}
              />
              <text x="180" y="198" fontSize="38" textAnchor="middle" dominantBaseline="central" aria-hidden="true">
                {eyeFace}
              </text>
            </g>

            {/* little feet */}
            <rect x="134" y="258" width="30" height="14" rx="7" fill="#1d2b46" stroke="#41527a" strokeWidth="2" />
            <rect x="196" y="258" width="30" height="14" rx="7" fill="#1d2b46" stroke="#41527a" strokeWidth="2" />
          </g>
        </svg>

        {/* Celebration confetti burst (final win only) */}
        {done && (
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {["🎉", "✨", "⭐", "💡", "🎊", "✨", "⭐", "🎉", "💫", "✨"].map((c, i) => (
              <span
                key={i}
                className="absolute text-2xl"
                style={{
                  left: `${8 + i * 9}%`,
                  top: "44%",
                  animation: `jrsensor-confetti 1.1s ease-out ${i * 0.06}s forwards`,
                }}
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Scene strip: the brightnesses this round will run through ── */}
      <div className="flex items-center justify-center gap-2" aria-hidden="true">
        {scenes.map((lvl, i) => {
          const st = sceneState(i);
          const litHere = (running || celebrating) && st !== "future" && lvl === pick;
          return (
            <span
              key={i}
              className="grid place-items-center rounded-xl text-xl"
              style={{
                height: 44,
                width: 44,
                background: litHere ? "rgba(255,224,138,0.22)" : "rgba(255,255,255,0.05)",
                border: `2px solid ${
                  st === "current" ? ACCENT : litHere ? "#ffd25e" : "rgba(120,140,170,0.3)"
                }`,
                boxShadow: st === "current" ? `0 0 10px ${ACCENT}88` : undefined,
                transform: st === "current" ? "scale(1.12)" : "scale(1)",
                opacity: st === "future" && (running || celebrating) ? 0.5 : 1,
                transition: "all 260ms cubic-bezier(.34,1.56,.64,1)",
              }}
            >
              {/* show the lamp result on visited scenes, else the sky orb */}
              {st === "future" || !(running || celebrating) ? LOOK[lvl].orb : litHere ? "💡" : "🌑"}
            </span>
          );
        })}
      </div>

      {/* ── Trigger cards: WHEN the eye sees THIS, the light turns on ── */}
      <div
        className="flex w-full items-stretch justify-center gap-3 rounded-2xl px-3 py-3"
        style={{ background: "rgba(255,255,255,0.04)", border: "2px dashed var(--color-line, #27314f)" }}
        aria-label="Pick what the eye sensor should react to"
      >
        {cfg.choices.map((lvl) => {
          const selected = pick === lvl;
          const lockedOut = running || celebrating;
          return (
            <button
              key={lvl}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                choose(lvl);
              }}
              disabled={lockedOut}
              aria-label={`Make the light react to ${LOOK[lvl].aria}`}
              className="jrsensor-spring flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-2 disabled:opacity-50"
              style={{
                minHeight: 84,
                touchAction: "none",
                background: selected ? "rgba(52,211,153,0.18)" : "rgba(255,255,255,0.05)",
                border: `3px solid ${selected ? ACCENT : "rgba(120,140,170,0.3)"}`,
                boxShadow: selected ? `0 0 14px ${ACCENT}66, 0 4px 0 0 rgba(0,0,0,0.3)` : "0 4px 0 0 rgba(0,0,0,0.3)",
              }}
            >
              <span aria-hidden="true" className="text-3xl">
                {LOOK[lvl].orb}
              </span>
              {/* brightness dots: bright = ●●●, dim = ●●, dark = ● */}
              <span aria-hidden="true" className="inline-flex items-center gap-1">
                {Array.from({ length: 3 }).map((_, d) => (
                  <span
                    key={d}
                    className="rounded-full"
                    style={{
                      height: 6,
                      width: 6,
                      background: d < LOOK[lvl].dots ? (selected ? ACCENT : "#ffd25e") : "rgba(120,140,170,0.3)",
                    }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Big GO button + reset ── */}
      <div className="flex w-full items-stretch justify-center gap-3">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            run();
          }}
          disabled={pick === null || running || celebrating}
          aria-label="Go — run the scenes and test the rule"
          className="jrsensor-spring flex min-h-[72px] flex-1 items-center justify-center gap-2 rounded-2xl text-2xl font-extrabold disabled:opacity-50"
          style={{
            touchAction: "none",
            background: celebrating ? "rgba(52,211,153,0.25)" : ACCENT,
            color: "#06120d",
            boxShadow: celebrating ? undefined : "0 6px 0 0 #138a5f",
            animation: pick !== null && !running && !celebrating ? "jrsensor-dot 1.5s ease-in-out infinite" : undefined,
          }}
        >
          <span
            aria-hidden="true"
            style={{ display: "inline-block", animation: running ? "jrsensor-pulse 0.6s ease-in-out infinite" : undefined }}
          >
            {done ? "🎉" : running ? "👀" : "▶"}
          </span>
          <span>{done ? "YAY" : "GO"}</span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            reset();
          }}
          disabled={running}
          aria-label="Start over from the first robot"
          className="jrsensor-spring grid min-h-[72px] w-[72px] place-items-center rounded-2xl text-3xl disabled:opacity-40"
          style={{
            touchAction: "none",
            background: "rgba(255,255,255,0.05)",
            border: "2px solid var(--color-line, #27314f)",
            boxShadow: "0 6px 0 0 rgba(0,0,0,0.35)",
          }}
        >
          <span aria-hidden="true">🔄</span>
        </button>
      </div>

      <style>{`
        @keyframes jrsensor-breathe {
          0%, 100% { transform: scale(1, 1); }
          50% { transform: scale(1.02, 0.985); }
        }
        @keyframes jrsensor-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes jrsensor-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.12); }
        }
        @keyframes jrsensor-scan {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        @keyframes jrsensor-blink {
          0% { transform: scaleY(1); }
          45% { transform: scaleY(0.15); }
          100% { transform: scaleY(1); }
        }
        @keyframes jrsensor-glow {
          0%, 100% { opacity: 0.45; transform: scale(0.96); }
          50% { opacity: 0.85; transform: scale(1.06); }
        }
        @keyframes jrsensor-twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes jrsensor-wobble {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-5deg); }
          60% { transform: rotate(4deg); }
          85% { transform: rotate(-2deg); }
        }
        @keyframes jrsensor-celebrate {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          30% { transform: translateY(-10px) rotate(-4deg); }
          60% { transform: translateY(0) rotate(4deg); }
        }
        @keyframes jrsensor-dot {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes jrsensor-confetti {
          0% { transform: translate(0, 0) scale(0.4); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translate(var(--dx, 0), 120px) scale(1.1) rotate(180deg); opacity: 0; }
        }
        .jrsensor-spring {
          transition: transform 0.18s cubic-bezier(.34,1.56,.64,1);
          will-change: transform;
        }
        .jrsensor-spring:active:not(:disabled) {
          transform: scale(0.92);
        }
        @media (prefers-reduced-motion: reduce) {
          .jrsensor-anim, [style*="jrsensor-"] { animation: none !important; }
          .jrsensor-spring { transition: none; }
        }
      `}</style>
    </div>
  );
}
