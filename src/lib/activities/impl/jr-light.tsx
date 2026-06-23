"use client";
import type { ActivityProps } from "@/lib/activities/types";
import type { CSSProperties, ReactElement } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * "Light It Up" 💡 — a JUNIOR (Class 1-3, age ~6-8) ROBOTICS lab.
 * Learning goal: power only flows when the circuit is a COMPLETE LOOP — so the
 * child must FIND every break and close them ALL, not tap one lucky spot.
 *
 * Upgraded from a single-tap toy into a 3-ROUND circuit-debugging puzzle:
 *   • Round 1 — one open GAP to snap shut (eases them in, the classic feel).
 *   • Round 2 — TWO gaps; closing only one leaves the bulb dark, so the child
 *     must hunt the whole loop and fix every break.
 *   • Round 3 — the TWIST: a sneaky open SWITCH that *looks* like solid wire
 *     (its lever is flipped up) hides among the gaps. Tapping only the obvious
 *     sparkly gaps fails — the child has to trace the loop, spot the broken
 *     switch, and flip it down too. Guessing / pattern-matching can't win it.
 *
 * Closing the LAST break snaps the wire in, a spark zips around the loop, and
 * the bulb bursts to life. Win all three → big celebration, ⭐⭐⭐, onComplete
 * once. Wrong/incomplete taps never scold: a gentle wobble + retry. Deterministic,
 * always winnable, near-zero reading (emoji, colour, shape, animation), touch-first.
 */

const ACCENT = "#34d399"; // robotics green = success / glow
const WIRE_OFF = "#3a4566";
const WIRE_ON = "#34d399";
const SPARK = "#fff6c4";

/**
 * Rounded-rectangle loop in a 320x240 SVG. The wire runs all the way around.
 * Breaks are punched out at fixed points on this path; each round opens a
 * different set, and the child must close every one of them.
 */
const LOOP_PATH =
  "M 110 56 L 70 56 Q 48 56 48 80 L 48 168 Q 48 192 72 192 L 248 192 Q 272 192 272 168 L 272 80 Q 272 56 250 56 L 210 56";

type Orient = "h" | "v"; // how the wire runs through this break
type BreakKind = "gap" | "switch";

/**
 * Every break the puzzle can open, keyed by id. A "gap" is two exposed ends the
 * child snaps together. A "switch" is a lever sitting on solid-looking wire —
 * the decoy — that must be flipped down. Coordinates sit ON the loop path.
 */
const SPOTS: Record<
  string,
  { x: number; y: number; orient: Orient; kind: BreakKind; len: number }
> = {
  top: { x: 160, y: 56, orient: "h", kind: "gap", len: 100 }, // the classic top gap (over the bulb's row)
  bottom: { x: 160, y: 192, orient: "h", kind: "gap", len: 96 }, // bottom wire
  left: { x: 48, y: 124, orient: "v", kind: "gap", len: 84 }, // left side wire
  right: { x: 272, y: 124, orient: "v", kind: "switch", len: 84 }, // right side — the sneaky switch
};
type SpotId = keyof typeof SPOTS;

/** The three rounds: which breaks are open. Hand-authored, escalating, no RNG. */
const ROUNDS: ReadonlyArray<ReadonlyArray<SpotId>> = [
  ["top"], // R1: one gap
  ["top", "bottom"], // R2: two gaps to find
  ["top", "right"], // R3: a gap + the decoy SWITCH (looks like wire — must flip it)
];

type Phase = "solving" | "won" | "done" | "oops";

export default function LightItUp({ onComplete }: ActivityProps) {
  const [round, setRound] = useState<number>(0);
  const [fixed, setFixed] = useState<Record<string, boolean>>({});
  const [phase, setPhase] = useState<Phase>("solving");
  const [poke, setPoke] = useState<number>(0); // bumps to retrigger the wobble pulse

  const reportedRef = useRef<boolean>(false);
  const wobbleTimer = useRef<number | null>(null);
  const advanceTimer = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const openSpots = ROUNDS[round];
  const lit = phase === "won" || phase === "done"; // complete loop → bulb glows
  const allFixed = openSpots.every((id) => fixed[id]);

  const clearTimers = useCallback((): void => {
    if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
    if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current);
    wobbleTimer.current = null;
    advanceTimer.current = null;
  }, []);

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

  const nudge = useCallback((): void => {
    blip(300, 0.09);
    setPoke((p) => p + 1);
    setPhase("oops");
    if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
    wobbleTimer.current = window.setTimeout(() => setPhase("solving"), 520);
  }, [blip]);

  // Close one break. When the last one closes, the loop lights up.
  const closeSpot = useCallback(
    (id: SpotId): void => {
      if (lit || fixed[id]) return;
      blip(660, 0.08);
      const nextFixed = { ...fixed, [id]: true };
      setFixed(nextFixed);
      const complete = openSpots.every((s) => nextFixed[s]);
      if (complete) {
        chime();
        const last = round >= ROUNDS.length - 1;
        if (last) {
          setPhase("done");
          if (!reportedRef.current) {
            reportedRef.current = true;
            onComplete({ passed: true, stars: 3, detail: "You fixed every circuit — it lit up! 💡💡💡" });
          }
        } else {
          setPhase("won");
          if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current);
          advanceTimer.current = window.setTimeout(() => {
            setRound((r) => r + 1);
            setFixed({});
            setPhase("solving");
          }, 1250);
        }
      } else {
        setPhase("solving");
      }
    },
    [lit, fixed, openSpots, round, blip, chime, onComplete],
  );

  // Tapping the bulb before the loop is whole: gentle wobble, no scold, no onComplete spam.
  const pokeBulb = useCallback((): void => {
    if (lit) return;
    nudge();
  }, [lit, nudge]);

  const reset = useCallback((): void => {
    clearTimers();
    reportedRef.current = false;
    setRound(0);
    setFixed({});
    setPhase("solving");
    setPoke(0);
  }, [clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const wobbling = phase === "oops";
  const done = phase === "done";
  const won = phase === "won";

  // How many breaks still need closing this round (drives the little hint dots).
  const remaining = useMemo(
    () => openSpots.filter((id) => !fixed[id]).length,
    [openSpots, fixed],
  );

  const statusEmoji = done ? "🏆" : won ? "🎉" : wobbling ? "🤔" : lit ? "🎉" : "🔎";

  // Geometry helpers for drawing a break (gap ends or switch lever) on the path.
  const renderBreak = (id: SpotId): ReactElement => {
    const s = SPOTS[id];
    const isFixed = !!fixed[id];
    const horizontal = s.orient === "h";
    const half = s.len / 2;
    const e1 = horizontal ? { x: s.x - half, y: s.y } : { x: s.x, y: s.y - half };
    const e2 = horizontal ? { x: s.x + half, y: s.y } : { x: s.x, y: s.y + half };

    // Big invisible finger target straddling the break.
    const target = horizontal
      ? { x: s.x - half - 12, y: s.y - 26, w: s.len + 24, h: 52 }
      : { x: s.x - 26, y: s.y - half - 12, w: 52, h: s.len + 24 };

    return (
      <g
        key={id}
        onClick={() => closeSpot(id)}
        onPointerDown={() => closeSpot(id)}
        role="button"
        tabIndex={isFixed ? -1 : 0}
        aria-label={
          isFixed
            ? "This break is closed"
            : s.kind === "switch"
              ? "A switch is open here — tap to flip it closed"
              : "A gap in the wire — tap to snap it shut"
        }
        style={{ cursor: isFixed ? "default" : "pointer" }}
      >
        <rect x={target.x} y={target.y} width={target.w} height={target.h} fill="transparent" />

        {isFixed ? (
          // The wire (or switch) snaps closed with a springy bounce — power can pass.
          <line
            className="jrlight-anim"
            x1={e1.x}
            y1={e1.y}
            x2={e2.x}
            y2={e2.y}
            stroke="url(#jrl-wireOn)"
            strokeWidth="8"
            strokeLinecap="round"
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              filter: `drop-shadow(0 0 5px ${ACCENT})`,
              animation: "jrlight-pop .5s cubic-bezier(.34,1.56,.64,1)",
            }}
          />
        ) : s.kind === "switch" ? (
          // DECOY: looks like solid wire, but the lever is flipped UP → broken.
          // (Drawn darker + with an obvious raised arm so a tracing child can spot it.)
          <g>
            {/* the two posts the switch bridges */}
            <circle cx={e1.x} cy={e1.y} r="6" fill="#6b779e" />
            <circle cx={e2.x} cy={e2.y} r="6" fill="#6b779e" />
            {/* the lever, hinged at the bottom post, swung OUT (open) */}
            <line
              x1={e2.x}
              y1={e2.y}
              x2={e2.x + 22}
              y2={e2.y - s.len * 0.7}
              stroke="#f2c14e"
              strokeWidth="7"
              strokeLinecap="round"
            />
            {/* a soft pulsing ring so the child can find the sneaky one */}
            <circle
              className="jrlight-anim"
              cx={s.x}
              cy={s.y}
              r="20"
              fill="none"
              stroke="#f2c14e"
              strokeWidth="2.5"
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                animation: "jrlight-hint 1.3s ease-in-out infinite",
              }}
            />
            <text
              x={s.x + (horizontal ? 0 : 30)}
              y={s.y - (horizontal ? 28 : 0) + 6}
              textAnchor="middle"
              fontSize="22"
              aria-hidden="true"
              className="jrlight-anim"
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                animation: "jrlight-breathe 1.6s ease-in-out infinite",
              }}
            >
              🔀
            </text>
          </g>
        ) : (
          // GAP: two exposed wire ends with pulsing "tap here" beacons.
          <g>
            <circle cx={e1.x} cy={e1.y} r="6" fill="#6b779e" />
            <circle cx={e2.x} cy={e2.y} r="6" fill="#6b779e" />
            {[e1, e2].map((p, i) => (
              <circle
                key={i}
                className="jrlight-anim"
                cx={p.x}
                cy={p.y}
                r="11"
                fill="none"
                stroke={ACCENT}
                strokeWidth="2.5"
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "center",
                  animation: `jrlight-hint 1.2s ease-in-out ${i * 0.3}s infinite`,
                }}
              />
            ))}
            <text
              className="jrlight-anim"
              x={s.x + (horizontal ? 0 : -28)}
              y={s.y - (horizontal ? 22 : 0) + 6}
              textAnchor="middle"
              fontSize="28"
              aria-hidden="true"
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                animation: "jrlight-breathe 1.6s ease-in-out infinite",
              }}
            >
              {horizontal ? "👇" : "👉"}
            </text>
          </g>
        )}
      </g>
    );
  };

  return (
    <div className="flex w-full flex-col items-center gap-3" style={{ maxWidth: 430 }}>
      <style>{`
        @keyframes jrlight-breathe {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-4px) scale(1.03); }
        }
        @keyframes jrlight-glow {
          0%, 100% { opacity: .55; transform: scale(.92); }
          50% { opacity: 1; transform: scale(1.12); }
        }
        @keyframes jrlight-rays {
          0%, 100% { opacity: .35; transform: scale(.9) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.06) rotate(8deg); }
        }
        @keyframes jrlight-pop {
          0% { transform: scale(.4); opacity: 0; }
          60% { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes jrlight-jump {
          0% { transform: translateY(0) scale(1); }
          30% { transform: translateY(-14px) scale(1.12, .9); }
          55% { transform: translateY(0) scale(.94, 1.1); }
          75% { transform: translateY(-6px) scale(1.04, .98); }
          100% { transform: translateY(0) scale(1); }
        }
        @keyframes jrlight-wobble {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-5deg); }
          75% { transform: rotate(5deg); }
        }
        @keyframes jrlight-confetti {
          0% { transform: translate(0,0) scale(.4) rotate(0deg); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(1) rotate(var(--rot)); opacity: 0; }
        }
        @keyframes jrlight-hint {
          0%, 100% { transform: scale(1); opacity: .8; }
          50% { transform: scale(1.4); opacity: 1; }
        }
        @keyframes jrlight-ready {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.12); }
        }
        @media (prefers-reduced-motion: reduce) {
          .jrlight-anim { animation: none !important; }
        }
      `}</style>

      {/* Emoji-only status + round progress dots (no sentences) */}
      <div
        className="flex items-center gap-3 rounded-full px-5 py-1.5 text-3xl"
        role="status"
        aria-live="polite"
        aria-label={
          done
            ? "You fixed all three circuits!"
            : won
              ? "Circuit fixed! A trickier one is coming"
              : wobbling
                ? "Not quite — keep looking for the break"
                : `Round ${round + 1} of 3 — find every break and close it`
        }
        style={{
          background: lit ? "rgba(52,211,153,0.16)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${lit ? ACCENT : "var(--color-line, #27314f)"}`,
          boxShadow: lit ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            animation: lit ? "jrlight-ready 0.7s cubic-bezier(.34,1.56,.64,1) infinite" : undefined,
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
                  height: 14,
                  width: 14,
                  background: solved ? ACCENT : current ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.06)",
                  border: `2px solid ${solved || current ? ACCENT : "rgba(120,140,170,0.35)"}`,
                  boxShadow: current ? `0 0 8px ${ACCENT}88` : undefined,
                  animation: current ? "jrlight-ready 1.6s ease-in-out infinite" : undefined,
                }}
              />
            );
          })}
        </span>

        {done && (
          <span
            className="jrlight-anim text-2xl"
            aria-hidden="true"
            style={{ animation: "jrlight-pop .5s ease-out" }}
          >
            ⭐⭐⭐
          </span>
        )}
      </div>

      {/* The circuit board */}
      <div
        className="panel relative w-full overflow-hidden rounded-2xl border border-line p-2"
        style={{
          background: lit
            ? "radial-gradient(circle at 50% 38%, rgba(52,211,153,0.16), transparent 62%)"
            : undefined,
          transition: "background 420ms ease",
          animation: wobbling ? "jrlight-wobble .5s ease" : undefined,
        }}
        key={`board-${round}-${poke}`}
      >
        <svg
          viewBox="0 0 320 240"
          className="block w-full select-none"
          style={{ touchAction: "manipulation" }}
          role="img"
          aria-label="A battery and a light bulb joined by a wire loop. Some places in the loop are broken — find every break and close it so power can flow and the bulb lights up."
        >
          <defs>
            <radialGradient id="jrl-bulb" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fffbe0" />
              <stop offset="42%" stopColor="#ffe27a" />
              <stop offset="100%" stopColor="rgba(255,226,122,0)" />
            </radialGradient>
            <linearGradient id="jrl-wireOn" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#9af5cf" />
              <stop offset="100%" stopColor={WIRE_ON} />
            </linearGradient>
            <filter id="jrl-soft" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ---- Wire loop (faint guide always visible) ---- */}
          <path
            d={LOOP_PATH}
            fill="none"
            stroke="#1e2a44"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* The live wire — colour + glow only once every break is closed */}
          <path
            d={LOOP_PATH}
            fill="none"
            stroke={lit ? "url(#jrl-wireOn)" : WIRE_OFF}
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              filter: lit ? `drop-shadow(0 0 5px ${ACCENT})` : "none",
              transition: "stroke 320ms ease, filter 320ms ease",
            }}
          />

          {/* ---- The breaks for THIS round ---- */}
          {openSpots.map((id) => renderBreak(id))}

          {/* ---- Battery (bottom centre-left) ---- */}
          <g transform="translate(110 192)">
            <circle cx="0" cy="0" r="26" fill="#11182f" stroke={ACCENT} strokeWidth="3" />
            <text x="0" y="9" textAnchor="middle" fontSize="26" aria-hidden="true">
              🔋
            </text>
          </g>

          {/* ---- Bulb (top centre) ---- */}
          <g transform="translate(160 56)">
            {/* warm pulsing halo when lit */}
            {lit && (
              <circle
                className="jrlight-anim"
                cx="0"
                cy="0"
                r="46"
                fill="url(#jrl-bulb)"
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "center",
                  animation: "jrlight-glow 1.7s ease-in-out infinite",
                }}
              />
            )}
            {/* little light rays when lit */}
            {lit && (
              <g
                className="jrlight-anim"
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "center",
                  animation: "jrlight-rays 1.7s ease-in-out infinite",
                }}
              >
                {Array.from({ length: 8 }).map((_, i) => {
                  const a = (i * Math.PI) / 4;
                  const r0 = 30;
                  const r1 = 42;
                  return (
                    <line
                      key={i}
                      x1={Math.cos(a) * r0}
                      y1={Math.sin(a) * r0}
                      x2={Math.cos(a) * r1}
                      y2={Math.sin(a) * r1}
                      stroke="#ffe27a"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                  );
                })}
              </g>
            )}
            <circle
              cx="0"
              cy="0"
              r="30"
              fill={lit ? "rgba(255,226,122,0.22)" : "#11182f"}
              stroke={lit ? "#ffe27a" : "#3a4566"}
              strokeWidth="3"
              style={{ transition: "fill 320ms ease, stroke 320ms ease" }}
            />
            <g
              className="jrlight-anim"
              role="button"
              tabIndex={lit ? -1 : 0}
              aria-label={lit ? "The bulb is glowing" : "Bulb — close every break to light it"}
              onClick={pokeBulb}
              onPointerDown={pokeBulb}
              filter={lit ? "url(#jrl-soft)" : undefined}
              style={{
                cursor: lit ? "default" : "pointer",
                transformBox: "fill-box",
                transformOrigin: "center",
                animation: lit
                  ? "jrlight-jump .7s cubic-bezier(.34,1.56,.64,1)"
                  : "jrlight-breathe 2.6s ease-in-out infinite",
              }}
            >
              <text
                x="0"
                y="11"
                textAnchor="middle"
                fontSize="34"
                opacity={lit ? 1 : 0.5}
                aria-hidden="true"
              >
                💡
              </text>
            </g>
          </g>

          {/* ---- Spark zipping round the closed loop ---- */}
          {lit && (
            <g aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <circle key={i} r="5" fill={SPARK}>
                  <animateMotion
                    dur="1.6s"
                    begin={`${i * 0.53}s`}
                    repeatCount="indefinite"
                    path={LOOP_PATH}
                  />
                </circle>
              ))}
            </g>
          )}
        </svg>

        {/* Confetti burst on FINAL win only */}
        {done && (
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden"
            aria-hidden="true"
          >
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i / 12) * Math.PI * 2;
              const dist = 90 + (i % 3) * 26;
              const dx = `${Math.cos(angle) * dist}px`;
              const dy = `${Math.sin(angle) * dist - 30}px`;
              const rot = `${(i % 2 ? 1 : -1) * (160 + i * 18)}deg`;
              const bits = ["✨", "🎉", "⭐", "💛"];
              return (
                <span
                  key={i}
                  className="jrlight-anim absolute left-1/2 top-1/2 text-xl"
                  style={
                    {
                      "--dx": dx,
                      "--dy": dy,
                      "--rot": rot,
                      animation: `jrlight-confetti 1.1s ease-out ${i * 0.04}s both`,
                    } as CSSProperties
                  }
                >
                  {bits[i % bits.length]}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* "Breaks left to fix" dots — counts down as the child closes each one. */}
      <div
        className="flex min-h-[40px] items-center justify-center gap-2 rounded-full px-5 py-1.5"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "2px solid var(--color-line, #27314f)",
        }}
        aria-hidden="true"
      >
        <span className="text-2xl">{lit ? "💡" : "🔧"}</span>
        {openSpots.map((id, i) => {
          const isFixed = !!fixed[id];
          return (
            <span
              key={id}
              className="grid h-7 w-7 place-items-center rounded-full text-lg transition"
              style={{
                background: isFixed ? "rgba(52,211,153,0.18)" : "rgba(255,255,255,0.03)",
                border: `2px solid ${isFixed ? ACCENT : "rgba(120,140,170,0.4)"}`,
                transform: isFixed ? "scale(1)" : "scale(.92)",
                animation:
                  isFixed && remaining === 0 && i === openSpots.length - 1
                    ? "jrlight-pop .5s cubic-bezier(.34,1.56,.64,1)"
                    : undefined,
              }}
            >
              {isFixed ? "✅" : "❓"}
            </span>
          );
        })}
      </div>

      {/* Controls — light status + start over */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            if (lit) return;
            // Convenience: tapping the big button closes the next still-open break.
            const next = openSpots.find((id) => !fixed[id]);
            if (next) closeSpot(next);
          }}
          disabled={lit}
          aria-label={lit ? "The light is on" : "Close the next break"}
          className="jrlight-anim font-display flex items-center gap-2 rounded-2xl px-7 font-bold disabled:cursor-default"
          style={{
            minHeight: 72,
            fontSize: 22,
            background: lit ? ACCENT : "rgba(11,16,32,0.6)",
            color: lit ? "#060810" : "#9aa6cf",
            border: lit ? "none" : "2px solid var(--color-line, #27314f)",
            boxShadow: lit ? `0 6px 0 0 #0e8a63, 0 0 18px ${ACCENT}` : "0 6px 0 0 #161e35",
            touchAction: "manipulation",
            transition: "transform .15s cubic-bezier(.34,1.56,.64,1)",
          }}
          onPointerUp={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
          }}
          onPointerDownCapture={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(.9)";
          }}
        >
          <span aria-hidden="true" className="text-3xl">
            {lit ? "💡" : "🔌"}
          </span>
          {lit ? "ON" : "FIX"}
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            reset();
          }}
          aria-label="Start over"
          className="flex items-center justify-center rounded-2xl font-bold text-ink-dim"
          style={{
            minHeight: 72,
            minWidth: 72,
            fontSize: 28,
            background: "rgba(11,16,32,0.6)",
            border: "2px solid var(--color-line, #27314f)",
            boxShadow: "0 6px 0 0 #161e35",
            touchAction: "manipulation",
          }}
        >
          <span aria-hidden="true">🔄</span>
        </button>
      </div>
    </div>
  );
}
