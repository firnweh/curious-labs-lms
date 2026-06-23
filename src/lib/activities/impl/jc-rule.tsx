"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useRef, useState } from "react";

/* ── If This, Do That ❓ ──────────────────────────────────────────────────────
   JUNIORS (Class 1-3, age ~6-8). Concept: a simple IF/THEN rule lets a character
   DECIDE what to do — conditionals — but now as a real PROBLEM across THREE rounds,
   not a one-tap toy. A robot 🤖 walks a track of tiles toward a flag 🏁. Some tiles
   are SAFE to stroll over, one kind is a HAZARD that trips the robot. The child
   builds ONE rule: "IF [hazard] THEN ⤴️ JUMP" — but to build it they must first
   FIGURE OUT which tile is the hazard, choosing from several look-alike candidates,
   then press GO ▶ to run the plan and watch the robot follow the rule.

   The escalation defeats guessing / "do what worked last time":
     • Round 1 — tiles are 🟢 safe and 🔴 danger. Pick 🔴 → JUMP. (Learn the idea.)
     • Round 2 — a 🕳️ hole appears. NOW 🔴 is a harmless decoy and 🕳️ is the real
       hazard. Repeating round 1's answer (IF 🔴) trips the robot — you must look.
     • Round 3 — TWO scary-looking tiles (🔴 and ⚡) but only ⚡ actually zaps the
       robot; 🔴 is safe here. Two decoys, one true hazard → you must reason, not
       pattern-match. Jump the wrong tile and you waste the jump and trip on the ⚡.

   Land safely at the flag → that round is won and the next, harder one slides in.
   A wrong/empty rule → the robot gently trips (🙈) and hops home — never scolds,
   always retry, always winnable. Win all three → ⭐⭐⭐, onComplete ONCE.
   Deterministic, touch-first. NO READING REQUIRED — all emoji + color. */

const ACCENT = "#22d3ee";
const STEP_MS = 720;

/** The two actions the child can drop into the THEN slot. */
type Action = "stop" | "jump";
const ACTIONS: readonly Action[] = ["stop", "jump"];
const ACTION_GLYPH: Record<Action, string> = { stop: "✋", jump: "⤴️" };
const ACTION_WORD: Record<Action, string> = { stop: "stop", jump: "jump" };

/** Every tile kind that can appear on a track, with its emoji + a spoken label. */
type Tile = "green" | "red" | "hole" | "zap";
const TILE_GLYPH: Record<Tile, string> = { green: "🟢", red: "🔴", hole: "🕳️", zap: "⚡" };
const TILE_WORD: Record<Tile, string> = {
  green: "green light",
  red: "red light",
  hole: "hole",
  zap: "lightning",
};

/** One hand-authored round: the track, the candidate tiles the child chooses the IF
 *  condition from, and which tile is the TRUE hazard (the one that trips the robot).
 *  The winning rule is always "IF <hazard> THEN ⤴️ JUMP". Decoy candidates look
 *  dangerous but are safe this round, so brute-force / repeating fails. */
interface Round {
  track: readonly Tile[];
  /** Tiles offered as IF candidates, in display order. */
  candidates: readonly Tile[];
  /** The tile the robot will actually trip on unless the rule jumps it. */
  hazard: Tile;
}

const ROUNDS: readonly Round[] = [
  // R1 — learn it: red is the only danger.
  {
    track: ["green", "red", "green", "red", "green"],
    candidates: ["green", "red"],
    hazard: "red",
  },
  // R2 — twist: a hole appears; red is now a harmless DECOY, the hole is the danger.
  {
    track: ["red", "green", "hole", "red", "hole"],
    candidates: ["red", "hole"],
    hazard: "hole",
  },
  // R3 — two scary decoys (red + zap) but only the zap zaps; red is safe here.
  {
    track: ["zap", "red", "green", "zap", "red"],
    candidates: ["red", "zap"],
    hazard: "zap",
  },
];

type Phase = "idle" | "running" | "won" | "bump" | "done";

/** Pre-computed confetti particles for the win burst (transform-only, GPU-cheap). */
const CONFETTI = ["🎉", "✨", "⭐", "🎊", "💫", "🌟", "🎉", "✨", "⭐", "🎊", "💫", "🌟"] as const;
const CONFETTI_PIECES = CONFETTI.map((glyph, i) => {
  const angle = (i / CONFETTI.length) * Math.PI * 2;
  const dist = 90 + (i % 3) * 26;
  return {
    glyph,
    dx: `${Math.round(Math.cos(angle) * dist)}px`,
    dy: `${Math.round(Math.sin(angle) * dist - 20)}px`,
    rot: `${i % 2 === 0 ? 360 : -300}deg`,
    delay: `${(i % 4) * 0.05}s`,
  };
});

/** Soft Web-Audio blips — created on a tap, never autoplay, never throw. */
function useSound(): { blip: () => void; chime: () => void } {
  const ctxRef = useRef<AudioContext | null>(null);
  const ensure = useCallback((): AudioContext | null => {
    try {
      if (ctxRef.current === null) {
        const AC: typeof AudioContext | undefined =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return null;
        ctxRef.current = new AC();
      }
      return ctxRef.current;
    } catch {
      return null;
    }
  }, []);
  const tone = useCallback(
    (freq: number, dur: number, delay: number): void => {
      try {
        const ctx = ensure();
        if (!ctx) return;
        const t0 = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
      } catch {
        /* never block the lab on audio */
      }
    },
    [ensure],
  );
  const blip = useCallback((): void => tone(560, 0.1, 0), [tone]);
  const chime = useCallback((): void => {
    tone(660, 0.16, 0);
    tone(880, 0.16, 0.12);
    tone(1320, 0.26, 0.24);
  }, [tone]);
  return { blip, chime };
}

export default function IfThisDoThat({ onComplete }: ActivityProps) {
  const [level, setLevel] = useState<number>(0);
  /** The tile the child has dropped into the IF slot, or null until chosen. */
  const [ifTile, setIfTile] = useState<Tile | null>(null);
  /** THEN slot action, or null until the child picks one. */
  const [then, setThen] = useState<Action | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  /** Index of the tile the robot is currently AT (-1 = start, track.length = flag). */
  const [at, setAt] = useState<number>(-1);
  /** True while the robot is mid-jump at its current tile. */
  const [jumping, setJumping] = useState<boolean>(false);

  const round = ROUNDS[level];
  const track = round.track;

  const reportedRef = useRef<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { blip, chime } = useSound();

  const clearTimer = useCallback((): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => () => clearTimer(), [clearTimer]);

  // Fresh round: clear the plan, park the robot at the start.
  useEffect(() => {
    clearTimer();
    setIfTile(null);
    setThen(null);
    setPhase("idle");
    setAt(-1);
    setJumping(false);
  }, [level, clearTimer]);

  const running = phase === "running";
  const won = phase === "won";
  const bump = phase === "bump";
  const done = phase === "done";
  const celebrating = won || done;
  const locked = running || won || done;

  const pickIf = useCallback(
    (t: Tile): void => {
      if (locked) return;
      blip();
      setIfTile(t);
      setPhase("idle");
      setAt(-1);
    },
    [locked, blip],
  );

  const pickThen = useCallback(
    (a: Action): void => {
      if (locked) return;
      blip();
      setThen(a);
      setPhase("idle");
      setAt(-1);
    },
    [locked, blip],
  );

  const reset = useCallback((): void => {
    clearTimer();
    reportedRef.current = false;
    setLevel(0);
    setIfTile(null);
    setThen(null);
    setPhase("idle");
    setAt(-1);
    setJumping(false);
  }, [clearTimer]);

  /** The rule solves THIS round only when it jumps the TRUE hazard. */
  const ruleOk = ifTile === round.hazard && then === "jump";
  const ruleReady = ifTile !== null && then !== null;

  const go = useCallback((): void => {
    if (locked) return;
    blip();
    // No rule yet → friendly wobble nudge, settle, let them keep building.
    if (!ruleReady) {
      setPhase("bump");
      timerRef.current = setTimeout(() => setPhase("idle"), 520);
      return;
    }
    clearTimer();
    setAt(-1);
    setJumping(false);
    setPhase("running");

    const walk = (i: number): void => {
      // Reached the flag past the last tile → this round is solved.
      if (i >= track.length) {
        setAt(track.length);
        const last = level >= ROUNDS.length - 1;
        chime();
        if (last) {
          setPhase("done");
          if (!reportedRef.current) {
            reportedRef.current = true;
            onComplete({
              passed: true,
              stars: 3,
              detail: "Three smart rules — the robot dodged every danger and reached the flag! 🏁",
            });
          }
        } else {
          // Win this round, then slide the next (harder) puzzle in.
          setPhase("won");
          timerRef.current = setTimeout(() => setLevel((l) => l + 1), 1200);
        }
        return;
      }
      setAt(i);
      const tile = track[i];
      const isHazard = tile === round.hazard;
      // The rule only jumps the tile the child put in the IF slot.
      const ruleJumpsThis = ifTile === tile && then === "jump";

      if (isHazard && !ruleJumpsThis) {
        // The robot hit the real danger without jumping it → gentle trip, hop home.
        setJumping(false);
        setPhase("bump");
        timerRef.current = setTimeout(() => {
          setAt(-1);
          setPhase("idle");
        }, 820);
        return;
      }

      if (ruleJumpsThis) {
        // The rule says jump this tile → hop over it (whether hazard or a wasted jump).
        setJumping(true);
        timerRef.current = setTimeout(() => {
          setJumping(false);
          timerRef.current = setTimeout(() => walk(i + 1), STEP_MS * 0.45);
        }, STEP_MS * 0.55);
      } else {
        // Safe tile, no jump → just stroll on.
        setJumping(false);
        timerRef.current = setTimeout(() => walk(i + 1), STEP_MS);
      }
    };

    timerRef.current = setTimeout(() => walk(0), STEP_MS * 0.5);
  }, [locked, blip, ruleReady, clearTimer, track, level, round.hazard, ifTile, then, chime, onComplete]);

  const robotEmoji = celebrating ? "🎉" : bump ? "🙈" : "🤖";

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono text-ink">
      <style>{KEYFRAMES}</style>

      {/* ── Tiny visual status + round dots (emoji, not sentences) ── */}
      <div
        className="flex items-center gap-3 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={
          done
            ? "You solved all three rounds!"
            : won
              ? "Round solved! Next one coming up"
              : running
                ? "The robot is walking"
                : bump
                  ? "Oops, look again and try a new rule"
                  : `Round ${level + 1} of 3 — find the danger tile, build the rule, then press Go`
        }
        style={{
          background: celebrating ? "rgba(34,211,238,0.14)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${celebrating ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: celebrating ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span
          aria-hidden="true"
          className="inline-block"
          style={{
            animation: bump
              ? "jcrule-wobble 0.5s ease"
              : celebrating
                ? "jcrule-cheer 0.9s ease-in-out 2"
                : running
                  ? undefined
                  : "jcrule-bob 2.6s ease-in-out infinite",
          }}
        >
          {robotEmoji}
        </span>

        {/* round progress: solved ● / current ◉ / upcoming ○ */}
        <span aria-hidden="true" className="inline-flex items-center gap-1.5">
          {ROUNDS.map((_, i) => {
            const solved = i < level || done;
            const current = i === level && !done;
            return (
              <span
                key={i}
                className="grid place-items-center rounded-full"
                style={{
                  height: 14,
                  width: 14,
                  background: solved ? ACCENT : current ? "rgba(34,211,238,0.25)" : "rgba(255,255,255,0.06)",
                  border: `2px solid ${solved || current ? ACCENT : "rgba(120,140,170,0.35)"}`,
                  boxShadow: current ? `0 0 8px ${ACCENT}88` : undefined,
                  animation: current ? "jcrule-nudge 1.5s ease-in-out infinite" : undefined,
                }}
              />
            );
          })}
        </span>

        {done ? (
          <span aria-hidden="true" className="inline-flex text-2xl">
            {(["a", "b", "c"] as const).map((k, i) => (
              <span
                key={k}
                className="inline-block"
                style={{ animation: `jcrule-star 0.5s cubic-bezier(.34,1.56,.64,1) both`, animationDelay: `${0.15 + i * 0.22}s` }}
              >
                ⭐
              </span>
            ))}
          </span>
        ) : (
          <span aria-hidden="true" className="text-xl">
            🤖→🏁
          </span>
        )}
        {done && (
          <span aria-hidden="true" className="text-2xl">
            ✨
          </span>
        )}
      </div>

      {/* ── The track the robot walks ── */}
      <div className="panel relative w-full max-w-[430px] overflow-hidden rounded-2xl border border-line p-3">
        <div className="relative flex items-end justify-between" style={{ height: 96, touchAction: "none" }}>
          {/* ground line */}
          <div
            aria-hidden="true"
            className="absolute left-0 right-0 rounded-full"
            style={{ bottom: 8, height: 4, background: "rgba(120,140,170,0.30)" }}
          />

          {/* the tiles, evenly spaced */}
          {track.map((tile, i) => {
            const here = at === i;
            const dangerHere = here && tile === round.hazard;
            return (
              <div key={i} className="relative z-10 flex flex-col items-center" style={{ width: 40 }}>
                <span
                  aria-label={TILE_WORD[tile]}
                  className="inline-block text-2xl"
                  style={{
                    filter: dangerHere
                      ? "drop-shadow(0 0 10px #f87171)"
                      : here
                        ? `drop-shadow(0 0 10px ${ACCENT})`
                        : undefined,
                    animation: here ? "jcrule-pulse 0.6s ease-in-out infinite" : undefined,
                  }}
                >
                  <span aria-hidden="true">{TILE_GLYPH[tile]}</span>
                </span>
              </div>
            );
          })}

          {/* the flag at the end */}
          <div className="relative z-10 flex flex-col items-center" style={{ width: 40 }}>
            <span
              aria-label="finish flag"
              className="text-2xl"
              style={{ animation: celebrating ? "jcrule-pop 0.7s ease-out" : undefined }}
            >
              <span aria-hidden="true">🏁</span>
            </span>
          </div>

          {/* the robot — positioned along the row by percent of cells (tiles + flag) */}
          <div
            aria-hidden="true"
            className="absolute z-20"
            style={{
              bottom: 10,
              left: `${(Math.max(at, -1) + 1) * (100 / (track.length + 1))}%`,
              transform: "translateX(-50%)",
              transition: running ? `left ${STEP_MS}ms ease-in-out` : "left 160ms ease-out",
            }}
          >
            <span
              className="block text-3xl"
              style={{
                animation: jumping
                  ? "jcrule-jump 0.55s cubic-bezier(.34,1.56,.64,1)"
                  : celebrating
                    ? "jcrule-cheer 0.9s ease-in-out 3"
                    : running
                      ? "jcrule-walk 0.4s ease-in-out infinite"
                      : "jcrule-breathe 2.6s ease-in-out infinite",
              }}
            >
              {celebrating ? "🎉" : "🤖"}
            </span>
          </div>

          {/* BIG win: confetti burst flying outward from the finish (final round only) */}
          {done && (
            <div aria-hidden="true" className="pointer-events-none absolute z-30" style={{ right: "10%", bottom: 24 }}>
              {CONFETTI_PIECES.map((p, i) => (
                <span
                  key={i}
                  className="absolute block text-xl"
                  style={{
                    left: 0,
                    top: 0,
                    // CSS vars consumed by the jcrule-confetti keyframes
                    ["--jc-dx" as string]: p.dx,
                    ["--jc-dy" as string]: p.dy,
                    ["--jc-rot" as string]: p.rot,
                    animation: "jcrule-confetti 1.1s cubic-bezier(.2,.7,.3,1) both",
                    animationDelay: p.delay,
                  }}
                >
                  {p.glyph}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── The ONE rule: IF [ ? ] THEN [ ? ] ── */}
      <div
        className="flex w-full max-w-[430px] items-center justify-center gap-2 rounded-2xl px-3 py-3"
        style={{ background: "rgba(255,255,255,0.04)", border: "2px dashed var(--color-line, #33405c)" }}
        aria-label="Your rule"
      >
        <span aria-hidden="true" className="text-lg font-extrabold" style={{ color: ACCENT }}>
          IF
        </span>
        {/* IF slot — shows the chosen danger tile */}
        <div
          aria-label={ifTile ? `if ${TILE_WORD[ifTile]}` : "if, pick a danger tile below"}
          className="grid h-[60px] w-[60px] place-items-center rounded-2xl text-3xl"
          style={{
            background: ifTile ? "rgba(248,113,113,0.16)" : "rgba(255,255,255,0.05)",
            border: `2px ${ifTile ? "solid #f87171" : "dashed var(--color-line, #33405c)"}`,
            animation: !ifTile ? "jcrule-glow 1.5s ease-in-out infinite" : undefined,
          }}
        >
          <span
            key={ifTile ?? "if-empty"}
            aria-hidden="true"
            className="inline-block"
            style={{ animation: ifTile ? "jcrule-snap 0.5s cubic-bezier(.34,1.56,.64,1) both" : undefined }}
          >
            {ifTile ? TILE_GLYPH[ifTile] : "❓"}
          </span>
        </div>

        <span aria-hidden="true" className="text-lg font-extrabold" style={{ color: ACCENT }}>
          ▶
        </span>

        {/* THEN slot — shows the chosen action */}
        <div
          aria-label={then ? `then ${ACTION_WORD[then]}` : "then, pick an action below"}
          className="grid h-[60px] w-[60px] place-items-center rounded-2xl text-3xl"
          style={{
            background: then ? "rgba(34,211,238,0.14)" : "rgba(255,255,255,0.05)",
            border: `2px ${then ? "solid " + ACCENT : "dashed var(--color-line, #33405c)"}`,
            animation: ifTile && !then ? "jcrule-glow 1.5s ease-in-out infinite" : undefined,
          }}
        >
          <span
            key={then ?? "then-empty"}
            aria-hidden="true"
            className="inline-block"
            style={{ animation: then ? "jcrule-snap 0.5s cubic-bezier(.34,1.56,.64,1) both" : undefined }}
          >
            {then ? ACTION_GLYPH[then] : "❓"}
          </span>
        </div>
      </div>

      {/* ── IF candidates: tap a tile to drop it in the IF slot ── */}
      <div
        className="grid w-full max-w-[320px] gap-3"
        style={{ gridTemplateColumns: `repeat(${round.candidates.length}, minmax(0, 1fr))` }}
        aria-label="Danger tile choices"
      >
        {round.candidates.map((t) => {
          const chosen = ifTile === t;
          return (
            <button
              key={t}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                pickIf(t);
              }}
              disabled={locked}
              aria-label={`Put ${TILE_WORD[t]} in the IF box`}
              className="grid h-[68px] place-items-center rounded-2xl text-3xl transition active:scale-90 disabled:opacity-50"
              style={{
                touchAction: "none",
                transitionTimingFunction: "cubic-bezier(.34,1.56,.64,1)",
                background: chosen ? "rgba(248,113,113,0.18)" : "rgba(255,255,255,0.05)",
                border: `2px solid ${chosen ? "#f87171" : "var(--color-line, #33405c)"}`,
                boxShadow: chosen ? "0 0 14px rgba(248,113,113,0.5)" : undefined,
              }}
            >
              <span
                aria-hidden="true"
                className="inline-block"
                style={{ animation: chosen ? "jcrule-pop 0.45s cubic-bezier(.34,1.56,.64,1)" : undefined }}
              >
                {TILE_GLYPH[t]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Action choices for the THEN slot ── */}
      <div className="grid w-full max-w-[320px] grid-cols-2 gap-3">
        {ACTIONS.map((a) => {
          const chosen = then === a;
          return (
            <button
              key={a}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                pickThen(a);
              }}
              disabled={locked}
              aria-label={`Choose ${ACTION_WORD[a]}`}
              className="grid h-[68px] place-items-center rounded-2xl text-4xl transition active:scale-90 disabled:opacity-50"
              style={{
                touchAction: "none",
                transitionTimingFunction: "cubic-bezier(.34,1.56,.64,1)",
                background: chosen ? "rgba(34,211,238,0.16)" : "rgba(34,211,238,0.06)",
                border: `2px solid ${chosen ? ACCENT : "var(--color-line, #33405c)"}`,
                boxShadow: chosen ? `0 0 14px ${ACCENT}66` : undefined,
              }}
            >
              <span
                aria-hidden="true"
                className="inline-block"
                style={{ animation: chosen ? "jcrule-pop 0.45s cubic-bezier(.34,1.56,.64,1)" : undefined }}
              >
                {ACTION_GLYPH[a]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Controls: GO · Reset ── */}
      <div className="flex w-full max-w-[430px] items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            go();
          }}
          disabled={locked}
          aria-label="Go — make the robot walk and follow the rule"
          className="flex h-[72px] flex-1 items-center justify-center gap-2 rounded-2xl text-2xl font-bold transition active:scale-95 disabled:opacity-50"
          style={{
            touchAction: "none",
            transitionTimingFunction: "cubic-bezier(.34,1.56,.64,1)",
            background: ACCENT,
            color: "#060810",
            boxShadow: "0 6px 0 0 #0e8aa0",
            animation: ruleReady && !locked ? "jcrule-nudge 1.4s ease-in-out infinite" : undefined,
          }}
        >
          <span
            aria-hidden="true"
            className="inline-block"
            style={{ animation: running ? "jcrule-bob 1s ease-in-out infinite" : undefined }}
          >
            {running ? "🤖" : "▶"}
          </span>
          <span aria-hidden="true" className="text-xl font-extrabold">
            GO
          </span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            reset();
          }}
          disabled={running}
          aria-label="Start over from round one"
          className="grid h-[72px] w-[72px] place-items-center rounded-2xl text-2xl transition active:scale-90 active:-rotate-180 disabled:opacity-40"
          style={{
            touchAction: "none",
            transitionTimingFunction: "cubic-bezier(.34,1.56,.64,1)",
            background: "rgba(255,255,255,0.05)",
            border: "2px solid var(--color-line, #33405c)",
          }}
        >
          <span aria-hidden="true">🔄</span>
        </button>
      </div>

      {/* celebratory floaters when all rounds solved */}
      {done && (
        <div className="pointer-events-none flex justify-center gap-2 text-2xl">
          <span style={{ animation: "jcrule-float 1.6s ease-in-out infinite" }} aria-hidden="true">
            ✨
          </span>
          <span style={{ animation: "jcrule-float 1.6s ease-in-out infinite", animationDelay: "0.2s" }} aria-hidden="true">
            🎉
          </span>
          <span style={{ animation: "jcrule-float 1.6s ease-in-out infinite", animationDelay: "0.4s" }} aria-hidden="true">
            ✨
          </span>
        </div>
      )}
    </div>
  );
}

const KEYFRAMES = `
@keyframes jcrule-walk {
  0%, 100% { transform: translateY(0) rotate(-3deg) scaleY(0.96); }
  25% { transform: translateY(-5px) rotate(0deg) scaleY(1.05); }
  50% { transform: translateY(0) rotate(3deg) scaleY(0.96); }
  75% { transform: translateY(-5px) rotate(0deg) scaleY(1.05); }
}
@keyframes jcrule-jump {
  0% { transform: translateY(0) scaleY(0.78) scaleX(1.12); }
  25% { transform: translateY(-30px) scaleY(1.18) scaleX(0.9); }
  55% { transform: translateY(-34px) scaleY(1.1) scaleX(0.94); }
  80% { transform: translateY(0) scaleY(0.82) scaleX(1.14); }
  100% { transform: translateY(0) scaleY(1) scaleX(1); }
}
@keyframes jcrule-wobble {
  0%, 100% { transform: rotate(0deg); }
  20% { transform: rotate(-9deg); }
  45% { transform: rotate(8deg); }
  70% { transform: rotate(-5deg); }
  90% { transform: rotate(3deg); }
}
@keyframes jcrule-pop {
  0% { transform: scale(0.4); }
  55% { transform: scale(1.35); }
  72% { transform: scale(0.92); }
  100% { transform: scale(1); }
}
@keyframes jcrule-glow {
  0%, 100% { box-shadow: 0 0 4px ${ACCENT}55; transform: scale(1); }
  50% { box-shadow: 0 0 14px ${ACCENT}; transform: scale(1.05); }
}
@keyframes jcrule-nudge {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-4px) scale(1.04); }
}
@keyframes jcrule-float {
  0%, 100% { transform: translateY(0); opacity: 0.85; }
  50% { transform: translateY(-10px); opacity: 1; }
}
/* Idle "breathing" — the robot is never fully still while it waits. */
@keyframes jcrule-breathe {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-4px) scale(1.05); }
}
/* Status-bubble robot gently bobs while idle. */
@keyframes jcrule-bob {
  0%, 100% { transform: translateY(0) rotate(-2deg); }
  50% { transform: translateY(-3px) rotate(2deg); }
}
/* Springy pop-in for a freshly placed part. */
@keyframes jcrule-snap {
  0% { transform: translateY(-16px) scale(0.5) rotate(-8deg); opacity: 0; }
  55% { transform: translateY(4px) scale(1.22) rotate(3deg); opacity: 1; }
  75% { transform: translateY(0) scale(0.94) rotate(-1deg); }
  100% { transform: translateY(0) scale(1) rotate(0deg); }
}
/* The active tile pulses + glows as the robot stands on it. */
@keyframes jcrule-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.28); }
}
/* Winner does a happy hop-dance. */
@keyframes jcrule-cheer {
  0% { transform: translateY(0) rotate(0deg) scale(1); }
  20% { transform: translateY(-22px) rotate(-12deg) scale(1.12); }
  40% { transform: translateY(0) rotate(0deg) scale(0.92); }
  60% { transform: translateY(-22px) rotate(12deg) scale(1.12); }
  80% { transform: translateY(0) rotate(0deg) scale(0.96); }
  100% { transform: translateY(0) rotate(0deg) scale(1); }
}
/* Each victory star pops in one at a time with a bounce. */
@keyframes jcrule-star {
  0% { transform: scale(0) rotate(-90deg); opacity: 0; }
  60% { transform: scale(1.5) rotate(8deg); opacity: 1; }
  78% { transform: scale(0.85) rotate(-4deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
/* Confetti burst — particles fly outward and tumble down. */
@keyframes jcrule-confetti {
  0% { transform: translate(0, 0) rotate(0deg) scale(0.4); opacity: 0; }
  12% { opacity: 1; }
  100% {
    transform: translate(var(--jc-dx), var(--jc-dy)) rotate(var(--jc-rot)) scale(1);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  [style*="animation"] { animation: none !important; }
}
`;
