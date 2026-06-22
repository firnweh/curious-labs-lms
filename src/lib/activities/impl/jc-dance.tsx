"use client";
import type { ActivityProps } from "@/lib/activities/types";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Dance Routine 💃 ─────────────────────────────────────────────────────────
   JUNIORS (Class 1-3, age ~6-8). Single learning goal: combine a SEQUENCE of
   moves with a LOOP (repeat) to match a target routine — the first taste of a
   loop living inside a sequence. A bear 🐻 stands on a stage. The TARGET shows a
   row of move icons (👏 👏 🌀 ⬆️) plus a compact hint "👏×2, 🌀, ⬆️". The child
   taps big move blocks — 👏 clap, 🌀 spin, ⬆️ jump — and a REPEAT ×2 block that
   wraps the NEXT move into two copies. Blocks land in a sequence strip (with
   Undo). Press PLAY ▶ and the bear performs each move with a little animation.
   Match the target → confetti + onComplete({passed:true,stars:3}) once. Mismatch
   → a gentle "🤔 not quite", fix and retry. NO READING needed — all emoji. */

const ACCENT = "#22d3ee";
const STEP_MS = 620;

/** A dance move — a big emoji glyph plus an aria word. No reading required. */
type MoveId = "clap" | "spin" | "jump";
interface Move {
  id: MoveId;
  glyph: string;
  word: string;
  color: string;
}
const CLAP: Move = { id: "clap", glyph: "👏", word: "clap", color: "#fbbf24" };
const SPIN: Move = { id: "spin", glyph: "🌀", word: "spin", color: "#a78bfa" };
const JUMP: Move = { id: "jump", glyph: "⬆️", word: "jump", color: "#34d399" };
const PALETTE: readonly Move[] = [CLAP, SPIN, JUMP];
const MOVE_BY_ID: Record<MoveId, Move> = { clap: CLAP, spin: SPIN, jump: JUMP };

/** The target routine the bear must perform, in order: 👏 👏 🌀 ⬆️. */
const TARGET: readonly MoveId[] = ["clap", "clap", "spin", "jump"];
const MAX_BLOCKS = 8;

/** One block placed in the sequence strip. `repeat` means the next move runs twice. */
interface Block {
  uid: number;
  move: MoveId;
  /** True when this block was added via the REPEAT ×2 wrapper. */
  repeat: boolean;
}
let UID = 1;
const nextId = (): number => UID++;

/** Flatten the sequence strip into the actual list of moves the bear performs. */
function expand(blocks: Block[]): MoveId[] {
  const out: MoveId[] = [];
  for (const b of blocks) {
    out.push(b.move);
    if (b.repeat) out.push(b.move);
  }
  return out;
}

const sameRoutine = (a: MoveId[], b: readonly MoveId[]): boolean =>
  a.length === b.length && a.every((m, i) => m === b[i]);

/** Pre-computed confetti particles for the win burst — purely decorative. */
interface Confetti {
  glyph: string;
  /** Horizontal end offset in px (outward fling). */
  dx: number;
  /** Vertical end offset in px. */
  dy: number;
  /** End rotation in degrees. */
  rot: number;
  /** Stagger delay in seconds. */
  delay: number;
}
const CONFETTI: readonly Confetti[] = [
  { glyph: "🎉", dx: -130, dy: -70, rot: -220, delay: 0 },
  { glyph: "✨", dx: 120, dy: -90, rot: 200, delay: 0.04 },
  { glyph: "⭐", dx: -90, dy: -120, rot: -160, delay: 0.08 },
  { glyph: "🎊", dx: 100, dy: -60, rot: 180, delay: 0.12 },
  { glyph: "💫", dx: -150, dy: -30, rot: -300, delay: 0.06 },
  { glyph: "🌟", dx: 150, dy: -40, rot: 260, delay: 0.1 },
  { glyph: "✨", dx: -50, dy: -140, rot: -120, delay: 0.14 },
  { glyph: "🎈", dx: 60, dy: -130, rot: 140, delay: 0.02 },
  { glyph: "💖", dx: -110, dy: 40, rot: -200, delay: 0.18 },
  { glyph: "🎉", dx: 130, dy: 30, rot: 220, delay: 0.16 },
  { glyph: "⭐", dx: 30, dy: -150, rot: 300, delay: 0.2 },
  { glyph: "✨", dx: -30, dy: -90, rot: -260, delay: 0.22 },
];

/** Soft Web-Audio blip/chime on a user gesture — never throws, never autoplays. */
let audioCtx: AudioContext | null = null;
function beep(freq: number, ms: number): void {
  try {
    type WinAudio = typeof window & { webkitAudioContext?: typeof AudioContext };
    const w = window as WinAudio;
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return;
    if (!audioCtx) audioCtx = new Ctor();
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + ms / 1000 + 0.02);
  } catch {
    /* audio is a nice-to-have; ignore any failure */
  }
}

type Phase = "build" | "playing" | "won" | "miss";

export default function DanceRoutine({ onComplete }: ActivityProps) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  /** True while the REPEAT ×2 wrapper is armed — the next tapped move doubles. */
  const [armed, setArmed] = useState<boolean>(false);
  const [phase, setPhase] = useState<Phase>("build");
  /** Index into the expanded routine currently being performed (-1 = none). */
  const [active, setActive] = useState<number>(-1);
  /** The move glyph the bear is showing right now (null = resting). */
  const [pose, setPose] = useState<MoveId | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportedRef = useRef<boolean>(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => () => clearTimer(), [clearTimer]);

  const playing = phase === "playing";
  const won = phase === "won";
  const missed = phase === "miss";

  const routine = useMemo<MoveId[]>(() => expand(blocks), [blocks]);

  const restBear = useCallback(() => {
    setActive(-1);
    setPose(null);
  }, []);

  const addMove = useCallback(
    (move: MoveId) => {
      if (playing || won) return;
      beep(520, 90);
      setBlocks((b) =>
        b.length >= MAX_BLOCKS ? b : [...b, { uid: nextId(), move, repeat: armed }],
      );
      setArmed(false);
      setPhase("build");
      restBear();
    },
    [playing, won, armed, restBear],
  );

  const toggleRepeat = useCallback(() => {
    if (playing || won) return;
    beep(660, 80);
    setArmed((a) => !a);
  }, [playing, won]);

  const undo = useCallback(() => {
    if (playing || won) return;
    beep(380, 70);
    setBlocks((b) => b.slice(0, -1));
    setArmed(false);
    setPhase("build");
    restBear();
  }, [playing, won, restBear]);

  const reset = useCallback(() => {
    clearTimer();
    reportedRef.current = false;
    beep(440, 80);
    setBlocks([]);
    setArmed(false);
    setPhase("build");
    restBear();
  }, [clearTimer, restBear]);

  const play = useCallback(() => {
    if (playing || won) return;
    beep(580, 90);
    const moves = routine;
    if (moves.length === 0) {
      // Empty isn't a "mistake" — a soft wobble nudge, then settle.
      setPhase("miss");
      timerRef.current = setTimeout(() => setPhase("build"), 560);
      return;
    }
    clearTimer();
    restBear();
    setPhase("playing");

    let i = 0;
    const tick = (): void => {
      if (i >= moves.length) {
        const matched = sameRoutine(moves, TARGET);
        restBear();
        if (matched) {
          setPhase("won");
          beep(784, 140);
          setTimeout(() => beep(988, 160), 150);
          setTimeout(() => beep(1175, 220), 320);
          if (!reportedRef.current) {
            reportedRef.current = true;
            onComplete({ passed: true, stars: 3, detail: "The bear danced the routine! 💃" });
          }
        } else {
          setPhase("miss");
          beep(240, 220);
          onComplete({ passed: false, detail: "So close — fix the dance and try again! 🤔" });
          timerRef.current = setTimeout(() => setPhase("build"), 720);
        }
        return;
      }
      const m = moves[i];
      setActive(i);
      setPose(m);
      beep(m === "clap" ? 600 : m === "spin" ? 720 : 840, 120);
      i += 1;
      timerRef.current = setTimeout(tick, STEP_MS);
    };
    timerRef.current = setTimeout(tick, 220);
  }, [playing, won, routine, clearTimer, restBear, onComplete]);

  // Bear status glyph (no reading): cheering, confused, dancing, or ready.
  const statusEmoji = won ? "🎉" : missed ? "🤔" : playing ? "🎵" : "💃";
  const poseAnim =
    pose === "spin"
      ? "jcdance-spin 0.6s ease-in-out"
      : pose === "jump"
        ? "jcdance-jump 0.6s cubic-bezier(.34,1.56,.64,1)"
        : pose === "clap"
          ? "jcdance-clap 0.6s ease-in-out"
          : won
            ? "jcdance-party 0.6s cubic-bezier(.34,1.56,.64,1) infinite"
            : missed
              ? "jcdance-wobble 0.5s ease-in-out"
              : /* idle: gentle breathing bob so the stage is never static */
                "jcdance-breathe 2.6s ease-in-out infinite";

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <style>{KEYFRAMES}</style>

      {/* ── Tiny visual status (emoji, not sentences) ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={
          won
            ? "You did it!"
            : playing
              ? "The bear is dancing"
              : missed
                ? "Not quite, try again"
                : "Build the dance, then press play"
        }
        style={{
          background: won ? "rgba(34,211,238,0.14)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${won ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: won ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span
          aria-hidden="true"
          style={won ? { animation: "jcdance-party 0.6s cubic-bezier(.34,1.56,.64,1) infinite", display: "inline-block" } : undefined}
        >
          {statusEmoji}
        </span>
        {won ? (
          <span aria-hidden="true" className="inline-flex">
            {[0, 1, 2].map((s) => (
              <span
                key={s}
                style={{
                  display: "inline-block",
                  animation: `jcdance-star-pop 0.5s cubic-bezier(.34,1.56,.64,1) ${0.18 + s * 0.22}s both`,
                }}
              >
                ⭐
              </span>
            ))}
          </span>
        ) : (
          <span aria-hidden="true" className="text-xl">
            🐻🎶
          </span>
        )}
        {won && (
          <span aria-hidden="true" style={{ display: "inline-block", animation: "jcdance-float 1.4s ease-in-out infinite" }}>
            ✨
          </span>
        )}
      </div>

      {/* ── TARGET routine: the dance to copy, + compact loop hint ── */}
      <div
        className="flex w-full max-w-[430px] flex-col items-center gap-1 rounded-2xl px-3 py-2"
        style={{ background: "rgba(34,211,238,0.06)", border: `2px solid ${ACCENT}55` }}
        aria-label="The target dance: clap, clap, spin, jump"
      >
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true" className="text-2xl">
            🎯
          </span>
          {TARGET.map((m, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="grid h-9 w-9 place-items-center rounded-lg text-xl"
              style={{ background: "rgba(255,255,255,0.05)", border: `1.5px solid ${ACCENT}77` }}
            >
              {MOVE_BY_ID[m].glyph}
            </span>
          ))}
        </div>
        {/* compact hint surfaces the loop: 👏×2, 🌀, ⬆️ */}
        <div aria-hidden="true" className="flex items-center gap-1 text-base opacity-80">
          <span>👏</span>
          <span style={{ color: ACCENT }} className="text-sm font-bold">
            ×2
          </span>
          <span className="opacity-50">,</span>
          <span>🌀</span>
          <span className="opacity-50">,</span>
          <span>⬆️</span>
        </div>
      </div>

      {/* ── The stage with the bear ── */}
      <div
        className="relative grid w-full max-w-[430px] place-items-center overflow-hidden rounded-2xl border border-line"
        style={{
          minHeight: 150,
          background: "linear-gradient(180deg, rgba(34,211,238,0.05), rgba(0,0,0,0.18))",
        }}
      >
        <div
          aria-hidden="true"
          className="select-none text-7xl"
          style={{ animation: poseAnim, transformOrigin: "center bottom" }}
        >
          {pose === "spin" ? "🐻" : pose === "jump" ? "🐻" : "🐻"}
        </div>
        {/* little move bubble floats above the bear while it performs */}
        {pose && (
          <div
            aria-hidden="true"
            className="absolute top-3 text-4xl"
            style={{
              animation:
                pose === "spin"
                  ? "jcdance-spin 0.6s linear infinite"
                  : "jcdance-pop 0.5s cubic-bezier(.34,1.56,.64,1) both",
              transformOrigin: "center center",
            }}
          >
            {MOVE_BY_ID[pose].glyph}
          </div>
        )}
        {/* stage floor */}
        <div
          aria-hidden="true"
          className="absolute bottom-0 h-3 w-full"
          style={{ background: `${ACCENT}33` }}
        />
        {won && (
          <>
            {/* confetti burst — particles fling outward from the bear */}
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              {CONFETTI.map((c, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className="absolute text-2xl"
                  style={
                    {
                      "--dx": `${c.dx}px`,
                      "--dy": `${c.dy}px`,
                      "--rot": `${c.rot}deg`,
                      animation: `jcdance-burst 1.5s cubic-bezier(.22,.61,.36,1) ${c.delay}s infinite`,
                    } as CSSProperties
                  }
                >
                  {c.glyph}
                </span>
              ))}
            </div>
            {/* a row of happy emoji bobbing along the top */}
            <div className="pointer-events-none absolute top-2 flex items-center justify-center gap-3 text-3xl">
              <span style={{ animation: "jcdance-float 1.4s ease-in-out infinite" }} aria-hidden="true">
                ✨
              </span>
              <span
                style={{ animation: "jcdance-float 1.4s ease-in-out 0.2s infinite" }}
                aria-hidden="true"
              >
                🎉
              </span>
              <span
                style={{ animation: "jcdance-float 1.4s ease-in-out 0.4s infinite" }}
                aria-hidden="true"
              >
                ✨
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Sequence strip: blocks placed so far, in order ── */}
      <div
        className="flex min-h-[56px] w-full max-w-[430px] flex-wrap items-center gap-1.5 rounded-2xl px-3 py-2"
        style={{ background: "rgba(255,255,255,0.04)", border: "2px dashed var(--color-line, #33405c)" }}
        aria-label="Your dance, block by block"
      >
        {blocks.length === 0 ? (
          <span aria-hidden="true" className="text-2xl opacity-50">
            🐻 …… 🎵
          </span>
        ) : (
          blocks.map((b, i) => {
            const m = MOVE_BY_ID[b.move];
            const isActive = playing && active >= 0;
            return (
              <span
                key={b.uid}
                aria-label={`${b.repeat ? "twice " : ""}${m.word}`}
                className="relative grid h-11 place-items-center rounded-xl text-2xl"
                style={{
                  minWidth: b.repeat ? 64 : 44,
                  padding: "0 6px",
                  background: "rgba(34,211,238,0.10)",
                  border: `1.5px solid ${b.repeat ? ACCENT : `${ACCENT}88`}`,
                  boxShadow: isActive && i === 0 ? `0 0 10px ${ACCENT}` : undefined,
                  transformOrigin: "center bottom",
                  /* snap into the slot with a springy drop on mount */
                  animation: "jcdance-snap 0.4s cubic-bezier(.34,1.56,.64,1) both",
                }}
              >
                <span aria-hidden="true">{m.glyph}</span>
                {b.repeat && (
                  <span
                    aria-hidden="true"
                    className="ml-0.5 text-xs font-bold"
                    style={{ color: ACCENT }}
                  >
                    ×2
                  </span>
                )}
              </span>
            );
          })
        )}
      </div>

      {/* ── Move palette: 3 big move blocks ── */}
      <div className="grid w-full max-w-[430px] grid-cols-3 gap-2">
        {PALETTE.map((m, mi) => (
          <button
            key={m.id}
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              addMove(m.id);
            }}
            disabled={playing || won}
            aria-label={`Add ${m.word}${armed ? " twice" : ""}`}
            className="grid h-[76px] place-items-center rounded-2xl text-4xl active:scale-90 disabled:opacity-40"
            style={{
              touchAction: "none",
              background: `${m.color}22`,
              border: `3px solid ${m.color}`,
              boxShadow: `0 6px 0 0 ${m.color}aa`,
              /* springy, toy-like overshoot on tap */
              transition: "transform 0.22s cubic-bezier(.34,1.56,.64,1)",
            }}
          >
            <span
              aria-hidden="true"
              style={{ display: "inline-block", animation: `jcdance-bob 2.8s ease-in-out ${mi * 0.35}s infinite` }}
            >
              {m.glyph}
            </span>
          </button>
        ))}
      </div>

      {/* ── REPEAT ×2 wrapper block (the loop) ── */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          toggleRepeat();
        }}
        disabled={playing || won}
        aria-pressed={armed}
        aria-label="Repeat the next move two times"
        className="flex h-[72px] w-full max-w-[430px] items-center justify-center gap-2 rounded-2xl text-3xl font-bold active:scale-95 disabled:opacity-40"
        style={{
          touchAction: "none",
          background: armed ? ACCENT : "rgba(34,211,238,0.12)",
          color: armed ? "#060810" : ACCENT,
          border: `3px solid ${ACCENT}`,
          boxShadow: armed ? `0 4px 0 0 #0e8aa0` : `0 6px 0 0 #0e8aa0`,
          transform: armed ? "translateY(2px)" : undefined,
          transition: "transform 0.22s cubic-bezier(.34,1.56,.64,1)",
        }}
      >
        <span
          aria-hidden="true"
          style={{ display: "inline-block", animation: armed ? "jcdance-spin 1.1s linear infinite" : undefined }}
        >
          🔁
        </span>
        <span aria-hidden="true" className="text-2xl font-extrabold">
          ×2
        </span>
        {armed && (
          <span aria-hidden="true" className="text-2xl">
            👇
          </span>
        )}
      </button>

      {/* ── Controls: Undo · PLAY ▶ · Reset ── */}
      <div className="flex w-full max-w-[430px] items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            undo();
          }}
          disabled={playing || won || blocks.length === 0}
          aria-label="Remove the last block"
          className="grid h-[68px] w-[68px] place-items-center rounded-2xl text-2xl active:scale-90 disabled:opacity-30"
          style={{
            touchAction: "none",
            background: "rgba(255,255,255,0.05)",
            border: "2px solid var(--color-line, #33405c)",
            transition: "transform 0.22s cubic-bezier(.34,1.56,.64,1)",
          }}
        >
          <span aria-hidden="true">⬅️</span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            play();
          }}
          disabled={playing || won}
          aria-label="Play — make the bear dance"
          className="flex h-[68px] flex-1 items-center justify-center gap-2 rounded-2xl text-2xl font-bold active:scale-95 disabled:opacity-50"
          style={{
            touchAction: "none",
            background: ACCENT,
            color: "#060810",
            boxShadow: "0 6px 0 0 #0e8aa0",
            transition: "transform 0.22s cubic-bezier(.34,1.56,.64,1)",
          }}
        >
          <span
            aria-hidden="true"
            style={{ display: "inline-block", animation: playing ? "jcdance-bob 0.7s ease-in-out infinite" : undefined }}
          >
            {playing ? "🎵" : "▶"}
          </span>
          <span aria-hidden="true" className="text-xl font-extrabold">
            PLAY
          </span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            reset();
          }}
          disabled={playing}
          aria-label="Start over"
          className="grid h-[68px] w-[68px] place-items-center rounded-2xl text-2xl active:scale-90 disabled:opacity-40"
          style={{
            touchAction: "none",
            background: "rgba(255,255,255,0.05)",
            border: "2px solid var(--color-line, #33405c)",
            transition: "transform 0.22s cubic-bezier(.34,1.56,.64,1)",
          }}
        >
          <span aria-hidden="true">🔄</span>
        </button>
      </div>

      <style>{`
        @keyframes jcdance-pop {
          0% { transform: scale(0.3) translateY(8px); opacity: 0; }
          55% { transform: scale(1.3) translateY(-2px); opacity: 1; }
          75% { transform: scale(0.92) translateY(0); }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const KEYFRAMES = `
@keyframes jcdance-clap {
  0%,100% { transform: rotate(0deg) scale(1); }
  20% { transform: rotate(-6deg) scale(1.04, 0.96); }
  45% { transform: rotate(6deg) scale(1.1); }
  70% { transform: rotate(-4deg) scale(0.98, 1.04); }
}
@keyframes jcdance-spin {
  0% { transform: rotate(0deg) scale(1); }
  100% { transform: rotate(360deg) scale(1); }
}
@keyframes jcdance-jump {
  /* squash before launch, stretch up, squash on landing */
  0% { transform: translateY(0) scale(1); }
  15% { transform: translateY(2px) scale(1.12, 0.86); }
  45% { transform: translateY(-30px) scale(0.9, 1.16); }
  70% { transform: translateY(0) scale(1.14, 0.84); }
  85% { transform: translateY(0) scale(0.96, 1.05); }
  100% { transform: translateY(0) scale(1); }
}
@keyframes jcdance-cheer {
  0%,100% { transform: translateY(0) rotate(-4deg); }
  50% { transform: translateY(-10px) rotate(4deg); }
}
/* big happy party jump+wiggle for the win */
@keyframes jcdance-party {
  0% { transform: translateY(0) rotate(-6deg) scale(1); }
  30% { transform: translateY(-16px) rotate(6deg) scale(1.06, 0.96); }
  55% { transform: translateY(0) rotate(-5deg) scale(1.08, 0.92); }
  80% { transform: translateY(-6px) rotate(5deg) scale(0.98, 1.06); }
  100% { transform: translateY(0) rotate(-6deg) scale(1); }
}
/* gentle idle breathing — never lets the stage go fully static */
@keyframes jcdance-breathe {
  0%,100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-3px) scale(1.015, 0.985); }
}
/* soft idle bob for palette/control glyphs */
@keyframes jcdance-bob {
  0%,100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
@keyframes jcdance-wobble {
  0%,100% { transform: rotate(0deg); }
  25% { transform: rotate(-7deg); }
  55% { transform: rotate(6deg); }
  80% { transform: rotate(-3deg); }
}
@keyframes jcdance-float {
  0%,100% { transform: translateY(0); opacity: 0.85; }
  50% { transform: translateY(-12px); opacity: 1; }
}
/* a placed block springs/drops into its slot */
@keyframes jcdance-snap {
  0% { transform: translateY(-14px) scale(0.6); opacity: 0; }
  55% { transform: translateY(2px) scale(1.18, 0.86); opacity: 1; }
  78% { transform: translateY(0) scale(0.94, 1.08); }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
/* confetti particle flings outward then drifts down and fades */
@keyframes jcdance-burst {
  0% { transform: translate(0, 0) rotate(0deg) scale(0.3); opacity: 0; }
  15% { opacity: 1; }
  60% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)) scale(1.1); opacity: 1; }
  100% { transform: translate(calc(var(--dx) * 1.15), calc(var(--dy) + 60px)) rotate(var(--rot)) scale(0.85); opacity: 0; }
}
/* each win star pops in with a bouncy overshoot */
@keyframes jcdance-star-pop {
  0% { transform: scale(0) rotate(-30deg); opacity: 0; }
  60% { transform: scale(1.35) rotate(8deg); opacity: 1; }
  80% { transform: scale(0.92) rotate(-4deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  /* stop looping idle/celebration loops; allow one-shot entrances to settle */
  [style*="animation"] { animation: none !important; }
}
`;
