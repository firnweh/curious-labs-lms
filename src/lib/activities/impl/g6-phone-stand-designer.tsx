"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Phone Stand Designer — ergonomics vs. stability vs. material       */
/*  CLASS 4-6 (age ~9-11).                                             */
/*                                                                     */
/*  A real engineering trade-off across THREE client briefs. Each      */
/*  round a different customer wants a different viewing angle, so the */
/*  comfy window MOVES — you can't reuse last round's answer. For each */
/*  brief you must:                                                    */
/*    1) tilt the screen into THIS round's comfort window, and         */
/*    2) make the base just wide enough that the centre of gravity     */
/*       stays over the footprint (stable, doesn't tip), and           */
/*    3) NOT waste material — the tightest stable base earns full      */
/*       marks. A giant base is stable but wasteful → fewer stars.     */
/*                                                                     */
/*  So "drag the base as wide as it goes" stops working: a steeper     */
/*  lean needs MORE base, a gentler lean needs LESS, and you have to   */
/*  find the smallest base that still passes. Plan, then EXPORT.       */
/* ------------------------------------------------------------------ */

const ACCENT = "#f59e0b";
const VIEW_W = 360;
const VIEW_H = 300;

/** Base width slider range (in scene units / mm). */
const BASE_MIN = 60;
const BASE_MAX = 200;

/** Tilt slider range: degrees the screen leans toward the eye from upright. */
const ANGLE_MIN = 35;
const ANGLE_MAX = 82;

/** Geometry constants of the stand, all in scene units. */
const GROUND_Y = 244; // y of the floor line
const PHONE_LEN = 118; // length of the phone resting on the support
const SUPPORT_PIVOT_X = VIEW_W / 2; // the back support hinges here at the floor
const SUPPORT_LEN = 150; // length of the back support strut
const CRADLE_OFF = 16; // how far up the strut the phone's foot sits
const BACK_LIP = 22; // base extends this far BEHIND the pivot (the rest goes forward)
const FWD = 10; // small forward shove of the phone toward the eye

const BASE_LEFT = SUPPORT_PIVOT_X - BACK_LIP; // fixed back edge of the base plate

/** How much spare base (mm beyond the minimum stable width) still counts as
 *  an "efficient" design that earns full marks for the round. Tight = good
 *  engineering; a hugely oversized base is wasteful and loses the star. */
const EFFICIENT_SLACK = 14;

/** The three client briefs. Each wants a DIFFERENT comfy lean, so the target
 *  angle — and therefore the minimum stable base — shifts every round. */
interface Brief {
  who: string;
  tiltMin: number;
  tiltMax: number;
  /** A wrong-ish starting design so every round begins as a real problem. */
  startBase: number;
  startAngle: number;
}
const BRIEFS: ReadonlyArray<Brief> = [
  { who: "Gentle desk lean", tiltMin: 50, tiltMax: 55, startBase: 72, startAngle: 80 },
  { who: "Video-call angle", tiltMin: 66, tiltMax: 71, startBase: 200, startAngle: 40 },
  { who: "Steep kitchen lean", tiltMin: 74, tiltMax: 78, startBase: 80, startAngle: 60 },
];

interface Pt {
  x: number;
  y: number;
}

/**
 * Build the whole side-view geometry for a given base width + tilt angle.
 * Pure & deterministic: same inputs → same scene → same grade.
 */
function buildScene(baseW: number, angleDeg: number, tiltMin: number, tiltMax: number) {
  const baseLeft = BASE_LEFT;
  const baseRight = baseLeft + baseW;

  // The screen leans toward the viewer's eye (to the right) by `angleDeg`
  // measured from upright. Larger angle → leans further forward → CoG further
  // forward → easier to tip. The horizontal reach grows with sin(angle).
  const phi = (angleDeg * Math.PI) / 180;
  const sx = Math.sin(phi); // forward component
  const cy = Math.cos(phi); // upward component
  const supTop: Pt = {
    x: SUPPORT_PIVOT_X + sx * SUPPORT_LEN,
    y: GROUND_Y - cy * SUPPORT_LEN,
  };

  // The phone slab rests against the support, parallel to it.
  const cradleBase: Pt = {
    x: SUPPORT_PIVOT_X + FWD + sx * CRADLE_OFF,
    y: GROUND_Y - cy * CRADLE_OFF,
  };
  const phoneTop: Pt = {
    x: cradleBase.x + sx * PHONE_LEN,
    y: cradleBase.y - cy * PHONE_LEN,
  };

  // Outward normal of the phone face (points away from the strut, toward eye).
  const nx = cy;
  const ny = sx;

  const screenAngle = angleDeg;

  // ---- Centre of gravity of the heavy bits (phone + support) ----
  const phoneMid: Pt = {
    x: (cradleBase.x + phoneTop.x) / 2,
    y: (cradleBase.y + phoneTop.y) / 2,
  };
  const supMid: Pt = {
    x: (SUPPORT_PIVOT_X + supTop.x) / 2,
    y: (GROUND_Y + supTop.y) / 2,
  };
  const wPhone = 3;
  const wSup = 1;
  const cog: Pt = {
    x: (phoneMid.x * wPhone + supMid.x * wSup) / (wPhone + wSup),
    y: (phoneMid.y * wPhone + supMid.y * wSup) / (wPhone + wSup),
  };

  const cogGround: Pt = { x: cog.x, y: GROUND_Y };

  // Smallest base width that still catches the CoG for THIS angle.
  const minStableW = Math.max(0, cog.x - baseLeft);

  const stable = cogGround.x >= baseLeft && cogGround.x <= baseRight;
  const comfy = screenAngle >= tiltMin && screenAngle <= tiltMax;

  // How much extra base beyond the minimum we used (only meaningful if stable).
  const slack = baseW - minStableW;
  const efficient = stable && slack <= EFFICIENT_SLACK;

  return {
    baseLeft,
    baseRight,
    supTop,
    cradleBase,
    phoneTop,
    nx,
    ny,
    cog,
    cogGround,
    screenAngle,
    minStableW,
    slack,
    stable,
    comfy,
    efficient,
  };
}

type Scene = ReturnType<typeof buildScene>;

export default function PhoneStandDesigner({ onComplete }: ActivityProps) {
  const [round, setRound] = useState<number>(0);
  const [baseW, setBaseW] = useState<number>(BRIEFS[0].startBase);
  const [angle, setAngle] = useState<number>(BRIEFS[0].startAngle);
  const [done, setDone] = useState<boolean>(false);
  /** "good" = exported tight/efficient; "ok" = exported but base was wasteful. */
  const [results, setResults] = useState<ReadonlyArray<"good" | "ok">>([]);
  /** Brief flash after a round is exported, before the next brief slides in. */
  const [justExported, setJustExported] = useState<boolean>(false);

  const reportedRef = useRef<boolean>(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgedRef = useRef<boolean>(false);

  const brief = BRIEFS[round];

  const scene: Scene = useMemo(
    () => buildScene(baseW, angle, brief.tiltMin, brief.tiltMax),
    [baseW, angle, brief.tiltMin, brief.tiltMax],
  );

  // A design is "shippable" once both hard constraints pass; full marks also
  // need it to be efficient. Either way the round CAN be exported.
  const shippable = scene.comfy && scene.stable;
  const tipping = !scene.stable && !done && !justExported;

  const clearTimers = useCallback((): void => {
    if (flashTimerRef.current !== null) {
      clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
    if (nudgeTimerRef.current !== null) {
      clearTimeout(nudgeTimerRef.current);
      nudgeTimerRef.current = null;
    }
  }, []);
  useEffect(() => () => clearTimers(), [clearTimers]);

  // Gentle nudge when a tweak leaves the design unshippable — never scolds,
  // never reports a fail; just whispers what to fix once sliding stops.
  useEffect(() => {
    if (done || justExported || shippable) return;
    if (!nudgedRef.current) {
      nudgedRef.current = true;
      return; // don't toast on first load
    }
    if (nudgeTimerRef.current !== null) clearTimeout(nudgeTimerRef.current);
    nudgeTimerRef.current = setTimeout(() => {
      if (reportedRef.current) return;
      let detail = "";
      if (!scene.stable && !scene.comfy) {
        detail = "It tips and the angle is off for this client — fix both.";
      } else if (!scene.stable) {
        detail = "It tips back — widen the base just enough to catch it.";
      } else {
        detail =
          scene.screenAngle < brief.tiltMin
            ? "Too upright for this client — tilt it back a little."
            : "Leaning too far for this client — stand it up a little.";
      }
      onComplete({ passed: false, detail });
    }, 700);
    return () => {
      if (nudgeTimerRef.current !== null) {
        clearTimeout(nudgeTimerRef.current);
        nudgeTimerRef.current = null;
      }
    };
  }, [scene, shippable, done, justExported, brief.tiltMin, onComplete]);

  // Commit this round's design. Locks in the result, then either advances to
  // the next brief or finishes the whole job.
  const exportDesign = useCallback((): void => {
    if (!shippable || done || justExported) return;
    const grade: "good" | "ok" = scene.efficient ? "good" : "ok";
    const nextResults = [...results, grade];
    setResults(nextResults);
    setJustExported(true);

    if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => {
      const last = round >= BRIEFS.length - 1;
      if (last) {
        setDone(true);
        if (!reportedRef.current) {
          reportedRef.current = true;
          const wasteful = nextResults.filter((g) => g === "ok").length;
          // 3 stars: every base was tight. Each wasteful base costs a star,
          // floored at 1 so a finished job always passes.
          const stars = Math.max(1, 3 - wasteful) as 1 | 2 | 3;
          const detail =
            stars === 3
              ? "All three briefs: comfy, stable AND no wasted material — ship it! 🏭"
              : wasteful === 1
                ? "All three shipped — one base was bigger than it needed to be."
                : "All three shipped — trim those bases next time to save material.";
          onComplete({ passed: true, stars, detail });
        }
      } else {
        const next = round + 1;
        setRound(next);
        setBaseW(BRIEFS[next].startBase);
        setAngle(BRIEFS[next].startAngle);
        setJustExported(false);
        nudgedRef.current = false;
      }
    }, 1150);
  }, [shippable, done, justExported, scene.efficient, results, round, onComplete]);

  const reset = useCallback((): void => {
    clearTimers();
    reportedRef.current = false;
    nudgedRef.current = false;
    setRound(0);
    setResults([]);
    setDone(false);
    setJustExported(false);
    setBaseW(BRIEFS[0].startBase);
    setAngle(BRIEFS[0].startAngle);
  }, [clearTimers]);

  const locked = done || justExported;

  const onBase = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      if (locked) return;
      setBaseW(Number(e.target.value));
    },
    [locked],
  );
  const onAngle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      if (locked) return;
      setAngle(Number(e.target.value));
    },
    [locked],
  );

  const status = useMemo<string>(() => {
    if (done) return "Job complete — all three designs exported! ✨";
    if (justExported) return "Exported! Loading the next client brief…";
    if (tipping) return "Whoa — it tips over! The centre of gravity falls off the base.";
    if (!scene.comfy)
      return scene.screenAngle < brief.tiltMin
        ? "Angle's too upright for this client — tilt it back."
        : "Leaning too far for this client — stand it up a bit.";
    if (!scene.efficient)
      return "Stable & comfy — but the base is bigger than it needs. Trim it for full marks.";
    return "Tight, stable AND comfy. Hit Export to ship this design!";
  }, [done, justExported, tipping, scene, brief.tiltMin]);

  // SVG transform for the tipping wobble (rotate the whole stand about a foot).
  const wobble = tipping
    ? `g6phonestanddesigner-tip 1.1s ease-in-out infinite`
    : "none";
  const pivotX = scene.baseRight;

  const phoneW = 28; // half-thickness of the phone slab for its outline

  // Where the MINIMUM stable base edge would fall — a faint guide marker so the
  // efficiency goal is learnable, not guesswork.
  const minEdgeX = scene.baseLeft + scene.minStableW;

  return (
    <div className="flex w-full flex-col gap-3 text-ink" style={{ maxWidth: 440 }}>
      <style>{`
        @keyframes g6phonestanddesigner-tip {
          0%, 100% { transform: rotate(0deg); }
          30% { transform: rotate(7deg); }
          55% { transform: rotate(4deg); }
          80% { transform: rotate(9deg); }
        }
        @keyframes g6phonestanddesigner-stamp {
          0% { transform: scale(0.2) rotate(-18deg); opacity: 0; }
          60% { transform: scale(1.15) rotate(-12deg); opacity: 1; }
          100% { transform: scale(1) rotate(-12deg); opacity: 1; }
        }
        @keyframes g6phonestanddesigner-spark {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="g6phonestanddesigner-tip"],
          [style*="g6phonestanddesigner-stamp"],
          [style*="g6phonestanddesigner-spark"] { animation: none !important; }
        }
      `}</style>

      {/* ---------------- CLIENT BRIEF + ROUND DOTS ---------------- */}
      <div
        className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2"
        style={{
          borderColor: done ? ACCENT : "var(--color-line, #27314f)",
          background: "rgba(11,16,32,0.4)",
        }}
        role="status"
        aria-live="polite"
        aria-label={
          done
            ? "All three client briefs exported"
            : `Brief ${round + 1} of 3: ${brief.who}, wants a ${brief.tiltMin} to ${brief.tiltMax} degree lean`
        }
      >
        <div className="flex flex-col">
          <span className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">
            {done ? "Job done" : `Brief ${round + 1} / ${BRIEFS.length}`}
          </span>
          <span className="font-display text-sm" style={{ color: ACCENT }}>
            {done ? "All clients happy 🎉" : brief.who}
          </span>
          {!done && (
            <span className="font-mono text-[10px] text-ink-dim">
              wants a {brief.tiltMin}–{brief.tiltMax}° lean
            </span>
          )}
        </div>
        <span aria-hidden className="inline-flex items-center gap-1.5">
          {BRIEFS.map((_, i) => {
            const filled = i < results.length || done;
            const grade = results[i];
            const current = i === round && !done && !justExported;
            const color =
              filled && grade === "ok" ? "#9aa6cf" : filled ? "#22c55e" : ACCENT;
            return (
              <span
                key={i}
                className="grid place-items-center rounded-full text-[11px]"
                style={{
                  height: 18,
                  width: 18,
                  color: filled ? "#05070d" : color,
                  background: filled ? color : "transparent",
                  border: `2px solid ${current ? ACCENT : color}`,
                  boxShadow: current ? `0 0 8px ${ACCENT}88` : undefined,
                }}
              >
                {filled ? (grade === "ok" ? "✓" : "★") : ""}
              </span>
            );
          })}
        </span>
      </div>

      {/* ---------------- CAD STAGE ---------------- */}
      <div
        className="panel relative overflow-hidden rounded-xl border p-2"
        style={{
          borderColor: done ? ACCENT : "var(--color-line, #27314f)",
          boxShadow: done ? `0 0 24px -6px ${ACCENT}` : undefined,
          transition: "box-shadow .3s ease, border-color .3s ease",
        }}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="block h-auto w-full"
          role="img"
          aria-label="Side-view CAD scene of a phone stand: a base plate, an angled back support, a phone resting in the cradle, a centre-of-gravity plumb line, and a marker showing the minimum base width needed for stability."
          style={{ maxHeight: 360 }}
        >
          {/* faint CAD grid */}
          {Array.from({ length: 13 }, (_, i) => (
            <line
              key={`gv${i}`}
              x1={(i * VIEW_W) / 12}
              y1={0}
              x2={(i * VIEW_W) / 12}
              y2={VIEW_H}
              stroke="#18223a"
              strokeWidth={0.5}
            />
          ))}
          {Array.from({ length: 11 }, (_, i) => (
            <line
              key={`gh${i}`}
              x1={0}
              y1={(i * VIEW_H) / 10}
              x2={VIEW_W}
              y2={(i * VIEW_H) / 10}
              stroke="#18223a"
              strokeWidth={0.5}
            />
          ))}

          {/* floor line */}
          <line
            x1={0}
            y1={GROUND_Y}
            x2={VIEW_W}
            y2={GROUND_Y}
            stroke="#2b3a5c"
            strokeWidth={2}
          />

          {/* eye + viewing line (fixed eye height to the right) */}
          <g>
            <line
              x1={scene.cradleBase.x + (scene.phoneTop.x - scene.cradleBase.x) / 2}
              y1={scene.cradleBase.y + (scene.phoneTop.y - scene.cradleBase.y) / 2}
              x2={VIEW_W - 26}
              y2={96}
              stroke={scene.comfy ? ACCENT : "#5b6a8c"}
              strokeWidth={1.4}
              strokeDasharray="4 4"
              opacity={0.85}
            />
            <text x={VIEW_W - 26} y={84} fontSize={20} textAnchor="middle">
              👁️
            </text>
          </g>

          {/* minimum-stable-base guide tick (teaches the efficiency target) */}
          {!done && !justExported && (
            <g aria-hidden>
              <line
                x1={minEdgeX}
                y1={GROUND_Y - 18}
                x2={minEdgeX}
                y2={GROUND_Y + 8}
                stroke="#fbbf24"
                strokeWidth={1.5}
                strokeDasharray="2 3"
                opacity={0.85}
              />
              <text
                x={minEdgeX}
                y={GROUND_Y - 22}
                fontSize={8}
                textAnchor="middle"
                fill="#fbbf24"
                opacity={0.9}
              >
                min
              </text>
            </g>
          )}

          {/* The stand itself — wobbles as a unit when it tips. */}
          <g
            style={{
              transformBox: "fill-box",
              transformOrigin: `${pivotX}px ${GROUND_Y}px`,
              animation: wobble,
            }}
          >
            {/* base footprint stability zone (green when CoG is inside) */}
            <rect
              x={scene.baseLeft}
              y={GROUND_Y - 8}
              width={scene.baseRight - scene.baseLeft}
              height={12}
              rx={3}
              fill={scene.stable ? (scene.efficient ? "#16a34a" : "#a16207") : "#7f1d1d"}
              fillOpacity={0.85}
              stroke={scene.stable ? (scene.efficient ? "#22c55e" : "#eab308") : "#ef4444"}
              strokeWidth={1.5}
            />
            {/* a translucent "safe zone" band above the base */}
            <rect
              x={scene.baseLeft}
              y={GROUND_Y - 150}
              width={scene.baseRight - scene.baseLeft}
              height={150}
              fill={scene.stable ? "#22c55e" : "#ef4444"}
              fillOpacity={0.06}
            />

            {/* back support strut */}
            <line
              x1={SUPPORT_PIVOT_X}
              y1={GROUND_Y}
              x2={scene.supTop.x}
              y2={scene.supTop.y}
              stroke="#9aa6cf"
              strokeWidth={7}
              strokeLinecap="round"
            />

            {/* phone slab resting in the cradle */}
            <polygon
              points={[
                `${scene.cradleBase.x - scene.nx * phoneW},${scene.cradleBase.y - scene.ny * phoneW}`,
                `${scene.cradleBase.x + scene.nx * phoneW},${scene.cradleBase.y + scene.ny * phoneW}`,
                `${scene.phoneTop.x + scene.nx * phoneW},${scene.phoneTop.y + scene.ny * phoneW}`,
                `${scene.phoneTop.x - scene.nx * phoneW},${scene.phoneTop.y - scene.ny * phoneW}`,
              ].join(" ")}
              fill={locked && done ? "#1f2d18" : "#11192c"}
              stroke={scene.comfy ? ACCENT : "#5b6a8c"}
              strokeWidth={2}
            />
            {/* screen glint */}
            <line
              x1={scene.cradleBase.x + scene.nx * (phoneW - 6)}
              y1={scene.cradleBase.y + scene.ny * (phoneW - 6)}
              x2={scene.phoneTop.x + scene.nx * (phoneW - 6)}
              y2={scene.phoneTop.y + scene.ny * (phoneW - 6)}
              stroke={scene.comfy ? ACCENT : "#3b4a6c"}
              strokeWidth={2}
              opacity={0.7}
            />

            {/* CoG plumb line + dot */}
            <line
              x1={scene.cog.x}
              y1={scene.cog.y}
              x2={scene.cogGround.x}
              y2={scene.cogGround.y}
              stroke={scene.stable ? "#22c55e" : "#ef4444"}
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
            <circle
              cx={scene.cog.x}
              cy={scene.cog.y}
              r={6}
              fill={scene.stable ? "#22c55e" : "#ef4444"}
              stroke="#05070d"
              strokeWidth={1.5}
            />
            <circle
              cx={scene.cogGround.x}
              cy={scene.cogGround.y}
              r={4}
              fill={scene.stable ? "#22c55e" : "#ef4444"}
            />
          </g>

          {/* TIP! warning */}
          {tipping && (
            <text
              x={VIEW_W / 2}
              y={40}
              fontSize={22}
              fontWeight={700}
              textAnchor="middle"
              fill="#ef4444"
            >
              TIP!
            </text>
          )}

          {/* Export STL stamp on each export / final win */}
          {(justExported || done) && (
            <g
              style={{
                transformBox: "view-box",
                transformOrigin: "center",
                animation: "g6phonestanddesigner-stamp .5s ease-out both",
              }}
            >
              <rect
                x={VIEW_W / 2 - 96}
                y={VIEW_H / 2 - 30}
                width={192}
                height={60}
                rx={8}
                fill="none"
                stroke={ACCENT}
                strokeWidth={3}
              />
              <text
                x={VIEW_W / 2}
                y={VIEW_H / 2 + 1}
                fontSize={20}
                fontWeight={800}
                textAnchor="middle"
                fill={ACCENT}
                letterSpacing={2}
              >
                EXPORT STL
              </text>
              <text
                x={VIEW_W / 2}
                y={VIEW_H / 2 + 20}
                fontSize={10}
                textAnchor="middle"
                fill={ACCENT}
                opacity={0.9}
              >
                {done ? "all designs ready ✨" : "design saved ✨"}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* ---------------- LIVE REQUIREMENT CHECKS ---------------- */}
      <div className="flex gap-2" role="group" aria-label="Design requirement checks">
        <Check
          ok={scene.comfy}
          label="Comfort"
          value={`${Math.round(scene.screenAngle)}°`}
          want={`${brief.tiltMin}–${brief.tiltMax}°`}
        />
        <Check
          ok={scene.stable}
          label="Stability"
          value={scene.stable ? "in base" : "off base"}
          want="CoG over base"
        />
        <Check
          ok={scene.efficient}
          label="Material"
          value={
            scene.stable
              ? scene.efficient
                ? "tight"
                : `+${Math.round(scene.slack)}mm`
              : "—"
          }
          want="no waste"
        />
      </div>

      {/* status line */}
      <div
        className="font-mono rounded-md px-2 py-1.5 text-center text-xs"
        role="status"
        aria-live="polite"
        style={{
          color: done ? "#05070d" : "#9aa6cf",
          background: done ? ACCENT : "rgba(11,16,32,0.5)",
          fontWeight: done ? 700 : 400,
        }}
      >
        {done ? "✨🎉 " : ""}
        {status}
      </div>

      {/* ---------------- SLIDERS ---------------- */}
      <div className="panel flex flex-col gap-3 rounded-xl p-3">
        <Slider
          label="Base plate width"
          hint="wider = more stable, but more material"
          value={baseW}
          min={BASE_MIN}
          max={BASE_MAX}
          step={2}
          display={`${Math.round(baseW)}`}
          unit="mm"
          onChange={onBase}
          disabled={locked}
        />
        <Slider
          label="Back support tilt"
          hint="leans the screen toward the eye"
          value={angle}
          min={ANGLE_MIN}
          max={ANGLE_MAX}
          step={1}
          display={`${Math.round(angle)}`}
          unit="°"
          onChange={onAngle}
          disabled={locked}
        />

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={exportDesign}
            disabled={!shippable || locked}
            className="flex-1 rounded-lg px-3 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-45"
            style={{
              background: shippable && !locked ? ACCENT : "rgba(120,140,170,0.18)",
              color: shippable && !locked ? "#05070d" : "#9aa6cf",
              boxShadow: shippable && !locked ? `0 0 16px -4px ${ACCENT}` : undefined,
            }}
            aria-label={
              shippable
                ? "Export this design and move to the next client"
                : "Export — make the design comfy and stable first"
            }
          >
            {done ? "Done ✓" : justExported ? "Saving…" : "Export design ▶"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="shrink-0 rounded-lg border border-line bg-panel/60 px-3 py-2 text-xs font-medium text-ink-dim"
            aria-label="Reset all briefs to the start"
          >
            Reset
          </button>
        </div>

        <p className="text-[11px] leading-tight text-ink-faint">
          For each client: tilt into their comfy window, then make the base{" "}
          <span style={{ color: ACCENT }}>just</span> wide enough to keep the dot
          over the footprint. The tightest base earns ★ — a giant base still works
          but wastes plastic.
        </p>
      </div>
    </div>
  );
}

/* ---------------- small presentational helpers ---------------- */

function Check({
  ok,
  label,
  value,
  want,
}: {
  ok: boolean;
  label: string;
  value: string;
  want: string;
}) {
  return (
    <div
      className="flex flex-1 flex-col gap-0.5 rounded-lg border px-2 py-2"
      style={{
        borderColor: ok ? "#22c55e" : "#ef4444",
        background: ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.07)",
      }}
      aria-label={`${label} check ${ok ? "passing" : "failing"}: ${value}, want ${want}`}
    >
      <span className="flex items-center justify-between font-mono text-xs">
        <span className="text-ink-dim">{label}</span>
        <span aria-hidden style={{ color: ok ? "#22c55e" : "#ef4444" }}>
          {ok ? "✓" : "✗"}
        </span>
      </span>
      <span
        className="font-display text-sm tabular-nums"
        style={{ color: ok ? "#22c55e" : "#f87171" }}
      >
        {value}
      </span>
      <span className="font-mono text-[10px] text-ink-faint">need {want}</span>
    </div>
  );
}

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  display,
  unit,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  unit: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="flex items-center justify-between">
        <span className="text-ink-dim">
          {label} <span className="text-ink-faint">· {hint}</span>
        </span>
        <span className="font-display tabular-nums" style={{ color: ACCENT }}>
          {display}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        disabled={disabled}
        aria-label={`${label}, ${display}${unit}`}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-60"
        style={{ accentColor: ACCENT, touchAction: "none" }}
      />
    </label>
  );
}
