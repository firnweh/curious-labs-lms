"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

/* ── Automatic Night Lamp 💡 ──────────────────────────────────────────────────
   GRADE 4 (explorer, age ~10–11). Subject: ROBOTICS.
   ONE learning goal: a light sensor (LDR) reads brightness as a NUMBER, and a
   THRESHOLD rule — "IF light < threshold → lamp ON, ELSE OFF" — lets a circuit
   decide on its own when to switch the lamp on.

   The learner drags a day-night slider that deterministically drives the LDR
   value (noon ~900, dusk ~400, night ~120). They drag a horizontal THRESHOLD
   line on a vertical 0–1023 gauge; the rule it writes updates live in code-style
   text. Pressing CHECK runs a fixed 4-step day (Morning, Afternoon, Dusk, Night)
   and ticks/crosses whether the lamp behaved correctly (OFF in day, ON at dusk &
   night). A green PASS band on the gauge shows every winning threshold, so it is
   always solvable. WIN → onComplete({passed:true, stars:3}) exactly once.
   ──────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#34d399";

// ── Virtual SVG gauge world (CSS scales it responsively) ─────────────────────
const VW = 360;
const VH = 300;

// Vertical gauge geometry. Top = bright (1023), bottom = dark (0).
const GAUGE_X = 250;
const GAUGE_W = 56;
const GAUGE_TOP = 24;
const GAUGE_BOTTOM = 276;
const GAUGE_H = GAUGE_BOTTOM - GAUGE_TOP;
const LDR_MAX = 1023;

// Map an LDR value (0..1023) to a y pixel on the gauge.
const valueToY = (v: number): number =>
  GAUGE_BOTTOM - (v / LDR_MAX) * GAUGE_H;
// Map a y pixel back to an LDR value.
const yToValue = (y: number): number =>
  ((GAUGE_BOTTOM - y) / GAUGE_H) * LDR_MAX;

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

// ── The fixed 4-step day. Each step's LDR is deterministic. ──────────────────
interface DayStep {
  id: string;
  label: string;
  emoji: string;
  ldr: number;
  /** What the lamp SHOULD do at this time of day. */
  shouldBeOn: boolean;
}

const DAY: readonly DayStep[] = [
  { id: "morning", label: "Morning", emoji: "🌅", ldr: 880, shouldBeOn: false },
  { id: "afternoon", label: "Afternoon", emoji: "☀️", ldr: 700, shouldBeOn: false },
  { id: "dusk", label: "Dusk", emoji: "🌆", ldr: 400, shouldBeOn: true },
  { id: "night", label: "Night", emoji: "🌙", ldr: 120, shouldBeOn: true },
];

// Pass band: lamp must be OFF at afternoon (700) and ON at dusk (400).
//   OFF at 700  → 700 must NOT be < threshold → threshold ≤ 700
//   ON  at 400  → 400 must be < threshold      → threshold > 400
// So any threshold in (400, 700] wins. We show a slightly inset green band.
const PASS_LO = 401;
const PASS_HI = 700;
const BAND_DRAW_LO = 410; // drawn band stays comfortably inside the true range
const BAND_DRAW_HI = 690;

const START_THRESHOLD = 250; // a wrong-ish start: lamp stays dark at dusk

// The outside-light slider (0 = night, 1 = bright noon) → drives the live LDR.
const START_DAYLIGHT = 0.7;
/** Deterministic daylight → LDR curve. 0 → ~80 (night), 1 → ~930 (noon). */
const daylightToLdr = (d: number): number => Math.round(80 + d * 850);

type Mark = "pass" | "fail" | "pending";

export default function AutomaticNightLamp({ onComplete }: ActivityProps) {
  const [threshold, setThreshold] = useState<number>(START_THRESHOLD);
  const [daylight, setDaylight] = useState<number>(START_DAYLIGHT);
  const [dragging, setDragging] = useState<boolean>(false);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [won, setWon] = useState<boolean>(false);
  const [hintShown, setHintShown] = useState<boolean>(false);
  const [checked, setChecked] = useState<boolean>(false);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const reportedRef = useRef<boolean>(false);

  // Live LDR reading driven by the day-night slider (deterministic).
  const liveLdr = useMemo<number>(() => daylightToLdr(daylight), [daylight]);
  // Lamp state RIGHT NOW under the learner's rule: IF light < threshold → ON.
  const lampOnNow = liveLdr < threshold;

  // ── Drag the threshold line on the gauge (pointer y → LDR value). ──────────
  const pointerToThreshold = useCallback((clientY: number): number => {
    const svg = svgRef.current;
    if (!svg) return threshold;
    const rect = svg.getBoundingClientRect();
    const yInVirtual = ((clientY - rect.top) / rect.height) * VH;
    return clamp(Math.round(yToValue(yInVirtual)), 0, LDR_MAX);
  }, [threshold]);

  const onThreshDown = useCallback(
    (e: React.PointerEvent<SVGGElement>): void => {
      if (won) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setDragging(true);
      setThreshold(pointerToThreshold(e.clientY));
      setChecked(false);
    },
    [won, pointerToThreshold],
  );

  const onThreshMove = useCallback(
    (e: React.PointerEvent<SVGGElement>): void => {
      if (!dragging) return;
      e.preventDefault();
      setThreshold(pointerToThreshold(e.clientY));
    },
    [dragging, pointerToThreshold],
  );

  const onThreshUp = useCallback(
    (e: React.PointerEvent<SVGGElement>): void => {
      if (!dragging) return;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      setDragging(false);
    },
    [dragging],
  );

  const nudgeThreshold = useCallback(
    (delta: number): void => {
      if (won) return;
      setThreshold((t) => clamp(t + delta, 0, LDR_MAX));
      setChecked(false);
    },
    [won],
  );

  // ── CHECK: run the fixed 4-step day deterministically. ─────────────────────
  const runCheck = useCallback((): void => {
    if (won) return;
    const next: Record<string, Mark> = {};
    let allPass = true;
    for (const step of DAY) {
      const lampOn = step.ldr < threshold; // the rule, applied
      const correct = lampOn === step.shouldBeOn;
      next[step.id] = correct ? "pass" : "fail";
      if (!correct) allPass = false;
    }
    setMarks(next);
    setChecked(true);
    if (allPass && !reportedRef.current) {
      reportedRef.current = true;
      setWon(true);
      onComplete({
        passed: true,
        stars: 3,
        detail: `Threshold ${threshold} works all day — lamp OFF in daylight, ON at dusk & night. 💡✨`,
      });
    } else if (!allPass) {
      onComplete({
        passed: false,
        detail: "Almost! Slide the threshold into the green band so the lamp is right at every time of day.",
      });
    }
  }, [won, threshold, onComplete]);

  const reset = useCallback((): void => {
    reportedRef.current = false;
    setThreshold(START_THRESHOLD);
    setDaylight(START_DAYLIGHT);
    setDragging(false);
    setMarks({});
    setWon(false);
    setChecked(false);
    setHintShown(false);
  }, []);

  // One-line reason for a failing step (kind, never scolding).
  const reasonFor = useCallback((step: DayStep, mark: Mark): string => {
    if (mark !== "fail") return "";
    if (step.shouldBeOn) {
      return `Lamp stayed OFF at ${step.label.toLowerCase()} — your line must sit ABOVE ${step.ldr}.`;
    }
    return `Lamp came ON in daylight — your line must sit BELOW ${step.ldr}.`;
  }, []);

  const passCount = useMemo<number>(
    () => DAY.reduce((n, s) => (marks[s.id] === "pass" ? n + 1 : n), 0),
    [marks],
  );

  const status = won
    ? "Solved! The lamp switches itself on at dusk and night. ⭐⭐⭐"
    : checked
      ? `${passCount} of 4 times of day correct — nudge the line and check again.`
      : "Drag the threshold line, then press CHECK to run the day.";

  const threshY = valueToY(threshold);

  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-col items-center gap-3 font-mono text-ink">
      {/* ── Status pill ── */}
      <div
        className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-1.5 text-center text-sm"
        role="status"
        aria-live="polite"
        aria-label={status}
        style={{
          background: won ? "rgba(52,211,153,0.16)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${won ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: won ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true">{won ? "🎉" : "💡"}</span>
        <span aria-hidden="true">{won ? "⭐⭐⭐" : "IF light < threshold → ON"}</span>
        {won && <span aria-hidden="true">✨</span>}
      </div>

      {/* ── Day-night slider drives the outside light → live LDR ── */}
      <div className="w-full rounded-2xl border border-line bg-panel/60 p-3">
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="flex items-center justify-between text-ink-dim">
            <span aria-hidden="true">🌙 Night ⟶ Noon ☀️</span>
            <span className="font-display tabular-nums" style={{ color: ACCENT }}>
              LDR {liveLdr}
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={daylight}
            onChange={(e) => setDaylight(Number(e.target.value))}
            aria-label={`Outside light. Sensor reads ${liveLdr} of ${LDR_MAX}. Lamp is ${lampOnNow ? "on" : "off"}.`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full"
            style={{ accentColor: ACCENT, background: "linear-gradient(90deg,#0b1220,#fde68a)" }}
          />
          <span className="text-[11px] text-ink-faint" aria-hidden="true">
            Move the sky and watch the sensor number change — the lamp is{" "}
            <strong style={{ color: lampOnNow ? "#fde68a" : "#6b7a90" }}>
              {lampOnNow ? "ON 💡" : "off"}
            </strong>{" "}
            right now.
          </span>
        </label>
      </div>

      {/* ── Room scene + LDR gauge with draggable threshold ── */}
      <div className="panel relative w-full overflow-hidden rounded-2xl border border-line p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VW} ${VH}`}
          className="block w-full select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="A room with a window and an automatic lamp, next to a light-sensor gauge from 0 to 1023 with a draggable threshold line and a green pass band."
        >
          <defs>
            <linearGradient id="g4nightlamp-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={daylight > 0.5 ? "#7dd3fc" : "#1e293b"} />
              <stop offset="100%" stopColor={daylight > 0.5 ? "#bae6fd" : "#0b1220"} />
            </linearGradient>
            <radialGradient id="g4nightlamp-glow" cx="50%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#fde68a" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* ── Room ── */}
          <rect x={16} y={24} width={210} height={252} rx={12} fill="rgba(255,255,255,0.03)" stroke="rgba(120,140,170,0.4)" strokeWidth={2} />

          {/* window showing the current sky/sun/moon */}
          <rect x={36} y={48} width={84} height={84} rx={6} fill="url(#g4nightlamp-sky)" stroke="rgba(160,180,210,0.5)" strokeWidth={2} />
          <line x1={78} y1={48} x2={78} y2={132} stroke="rgba(160,180,210,0.45)" strokeWidth={2} />
          <line x1={36} y1={90} x2={120} y2={90} stroke="rgba(160,180,210,0.45)" strokeWidth={2} />
          <text x={daylight > 0.4 ? 100 : 56} y={daylight > 0.4 ? 70 : 112} fontSize={22} textAnchor="middle" dominantBaseline="central" aria-hidden="true">
            {daylight > 0.66 ? "☀️" : daylight > 0.33 ? "⛅" : "🌙"}
          </text>

          {/* lamp glow when ON */}
          {lampOnNow && <circle cx={170} cy={150} r={56} fill="url(#g4nightlamp-glow)" style={{ animation: "g4nightlamp-pulse 2s ease-in-out infinite" }} />}
          {/* lamp body */}
          <g aria-label={`Lamp is ${lampOnNow ? "on" : "off"}`}>
            <rect x={160} y={196} width={20} height={10} rx={2} fill="#3a4866" />
            <rect x={166} y={150} width={8} height={48} fill="#3a4866" />
            <path d="M 150 150 L 190 150 L 182 120 L 158 120 Z" fill={lampOnNow ? "#fde68a" : "#1b2436"} stroke={lampOnNow ? "#fbbf24" : "#3a4866"} strokeWidth={2} style={{ filter: lampOnNow ? "drop-shadow(0 0 10px #fde68a)" : undefined }} />
            <text x={170} y={138} fontSize={18} textAnchor="middle" dominantBaseline="central" aria-hidden="true">
              {lampOnNow ? "💡" : "🔌"}
            </text>
          </g>

          {/* LDR sensor tile on the wall, showing the live number */}
          <g aria-label={`Light sensor reads ${liveLdr}`}>
            <rect x={36} y={224} width={94} height={36} rx={6} fill="#0b1220" stroke={ACCENT} strokeWidth={1.5} />
            <text x={50} y={242} fontSize={13} aria-hidden="true">🔆</text>
            <text x={120} y={243} fontSize={16} textAnchor="end" dominantBaseline="central" fill={ACCENT} className="font-display" aria-hidden="true">
              {liveLdr}
            </text>
            <text x={83} y={255} fontSize={8} textAnchor="middle" fill="#6b7a90" aria-hidden="true">LDR reading</text>
          </g>

          {/* ── The vertical gauge (0..1023) ── */}
          <rect x={GAUGE_X} y={GAUGE_TOP} width={GAUGE_W} height={GAUGE_H} rx={8} fill="rgba(255,255,255,0.03)" stroke="rgba(120,140,170,0.4)" strokeWidth={2} />

          {/* green PASS band — every winning threshold lives here */}
          <rect
            x={GAUGE_X}
            y={valueToY(BAND_DRAW_HI)}
            width={GAUGE_W}
            height={valueToY(BAND_DRAW_LO) - valueToY(BAND_DRAW_HI)}
            fill={ACCENT}
            opacity={0.16}
          />
          <text x={GAUGE_X + GAUGE_W / 2} y={valueToY((BAND_DRAW_LO + BAND_DRAW_HI) / 2)} fontSize={8} textAnchor="middle" dominantBaseline="central" fill={ACCENT} aria-hidden="true">
            PASS
          </text>

          {/* gauge ticks + step markers (where each time-of-day reads) */}
          {DAY.map((s) => {
            const ty = valueToY(s.ldr);
            const mk = marks[s.id];
            const ring = mk === "pass" ? ACCENT : mk === "fail" ? "#f87171" : "#6b7a90";
            return (
              <g key={s.id} aria-hidden="true">
                <line x1={GAUGE_X - 6} y1={ty} x2={GAUGE_X} y2={ty} stroke="#6b7a90" strokeWidth={1.5} />
                <text x={GAUGE_X - 9} y={ty} fontSize={11} textAnchor="end" dominantBaseline="central">{s.emoji}</text>
                <circle cx={GAUGE_X + GAUGE_W + 9} cy={ty} r={6} fill="#0b1220" stroke={ring} strokeWidth={1.6} />
                <text x={GAUGE_X + GAUGE_W + 9} y={ty + 0.5} fontSize={8} textAnchor="middle" dominantBaseline="central" fill={ring}>
                  {mk === "pass" ? "✓" : mk === "fail" ? "✕" : ""}
                </text>
              </g>
            );
          })}

          {/* the live LDR pointer on the gauge */}
          <g aria-hidden="true">
            <polygon
              points={`${GAUGE_X + GAUGE_W + 2},${valueToY(liveLdr)} ${GAUGE_X + GAUGE_W + 14},${valueToY(liveLdr) - 5} ${GAUGE_X + GAUGE_W + 14},${valueToY(liveLdr) + 5}`}
              fill="#fde68a"
              opacity={0.9}
            />
          </g>

          {/* ── Draggable THRESHOLD line ── */}
          <g
            onPointerDown={onThreshDown}
            onPointerMove={onThreshMove}
            onPointerUp={onThreshUp}
            onPointerCancel={onThreshUp}
            style={{ cursor: won ? "default" : "grab", touchAction: "none" }}
            role="slider"
            tabIndex={0}
            aria-label="Threshold line — drag up or down to set when the lamp switches on"
            aria-valuemin={0}
            aria-valuemax={LDR_MAX}
            aria-valuenow={threshold}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") { e.preventDefault(); nudgeThreshold(20); }
              else if (e.key === "ArrowDown") { e.preventDefault(); nudgeThreshold(-20); }
            }}
          >
            {/* generous invisible hit pad spanning the gauge width */}
            <rect x={GAUGE_X - 12} y={threshY - 14} width={GAUGE_W + 24} height={28} fill="transparent" />
            <line
              x1={GAUGE_X - 10}
              y1={threshY}
              x2={GAUGE_X + GAUGE_W + 10}
              y2={threshY}
              stroke={ACCENT}
              strokeWidth={3}
              strokeDasharray="7 4"
              style={{ filter: `drop-shadow(0 0 5px ${ACCENT})` }}
            />
            {/* draggable knob */}
            <circle cx={GAUGE_X + GAUGE_W + 10} cy={threshY} r={9} fill="rgba(52,211,153,0.2)" stroke={ACCENT} strokeWidth={2.5} style={{ filter: dragging ? `drop-shadow(0 0 8px ${ACCENT})` : undefined }} />
            <text x={GAUGE_X + GAUGE_W + 10} y={threshY + 0.5} fontSize={10} textAnchor="middle" dominantBaseline="central" aria-hidden="true">↕</text>
            {/* threshold value chip */}
            <rect x={GAUGE_X - 2} y={threshY - 9} width={42} height={18} rx={4} fill="#0b1220" stroke={ACCENT} strokeWidth={1} opacity={0.95} />
            <text x={GAUGE_X + 19} y={threshY + 0.5} fontSize={11} textAnchor="middle" dominantBaseline="central" fill={ACCENT} className="font-display" aria-hidden="true">
              {threshold}
            </text>
          </g>

          {/* gauge top/bottom labels */}
          <text x={GAUGE_X + GAUGE_W / 2} y={GAUGE_TOP - 8} fontSize={9} textAnchor="middle" fill="#6b7a90" aria-hidden="true">1023 bright</text>
          <text x={GAUGE_X + GAUGE_W / 2} y={GAUGE_BOTTOM + 12} fontSize={9} textAnchor="middle" fill="#6b7a90" aria-hidden="true">0 dark</text>
        </svg>
      </div>

      {/* ── The rule, in plain code-style text ── */}
      <div className="w-full rounded-xl border border-line bg-[#0b1220] px-3 py-2 text-xs" aria-label={`Rule: if light less than ${threshold}, lamp on, else off`}>
        <span className="text-ink-faint">rule:</span>{" "}
        <span className="text-ink-dim">IF</span>{" "}
        <span style={{ color: "#fde68a" }}>light</span> &lt;{" "}
        <span style={{ color: ACCENT }}>{threshold}</span>{" "}
        <span className="text-ink-dim">→ lamp</span> <span style={{ color: ACCENT }}>ON</span>,{" "}
        <span className="text-ink-dim">ELSE</span> lamp OFF
      </div>

      {/* ── Day-sequence checklist ── */}
      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
        {DAY.map((s) => {
          const mk: Mark = marks[s.id] ?? "pending";
          const border = mk === "pass" ? ACCENT : mk === "fail" ? "#f87171" : "var(--color-line, #33405c)";
          return (
            <div
              key={s.id}
              className="flex flex-col items-center gap-0.5 rounded-xl border-2 px-2 py-2 text-center"
              style={{ borderColor: border, background: mk === "pass" ? "rgba(52,211,153,0.1)" : mk === "fail" ? "rgba(248,113,113,0.08)" : "rgba(255,255,255,0.02)" }}
              aria-label={`${s.label}: sensor reads ${s.ldr}, lamp should be ${s.shouldBeOn ? "on" : "off"}. ${mk === "pass" ? "Correct." : mk === "fail" ? "Not yet." : "Not checked."}`}
            >
              <span className="text-lg" aria-hidden="true">{s.emoji}</span>
              <span className="text-[11px] text-ink-dim">{s.label}</span>
              <span className="text-[10px] text-ink-faint" aria-hidden="true">LDR {s.ldr}</span>
              <span className="text-[10px]" aria-hidden="true" style={{ color: mk === "pass" ? ACCENT : "#6b7a90" }}>
                want {s.shouldBeOn ? "ON 💡" : "off"}
              </span>
              <span aria-hidden="true" className="text-sm" style={{ color: mk === "pass" ? ACCENT : mk === "fail" ? "#f87171" : "#39465e" }}>
                {mk === "pass" ? "✓" : mk === "fail" ? "✕" : "•"}
              </span>
            </div>
          );
        })}
      </div>

      {/* one-line reasons for any failing step */}
      {checked && !won && (
        <div className="w-full space-y-1" aria-live="polite">
          {DAY.filter((s) => marks[s.id] === "fail").map((s) => (
            <p key={s.id} className="text-[11px]" style={{ color: "#f87171" }}>
              {s.emoji} {reasonFor(s, "fail")}
            </p>
          ))}
        </div>
      )}

      {/* hint reveal */}
      {hintShown && !won && (
        <p className="w-full text-[11px]" style={{ color: ACCENT }} aria-live="polite">
          💡 At dusk the sensor reads 400 — your line must sit just above that, but still below the afternoon reading of 700.
        </p>
      )}

      {/* ── Controls ── */}
      <div className="flex w-full items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => { e.preventDefault(); reset(); }}
          aria-label="Start over"
          className="grid h-[54px] w-[56px] place-items-center rounded-2xl text-xl transition active:scale-90"
          style={{ touchAction: "none", background: "rgba(255,255,255,0.05)", border: "2px solid var(--color-line, #33405c)" }}
        >
          <span aria-hidden="true">🔄</span>
        </button>
        <button
          type="button"
          onPointerDown={(e) => { e.preventDefault(); setHintShown(true); }}
          disabled={won}
          aria-label="Show a hint"
          className="grid h-[54px] w-[56px] place-items-center rounded-2xl text-xl transition active:scale-90 disabled:opacity-40"
          style={{ touchAction: "none", background: "rgba(255,255,255,0.05)", border: "2px solid var(--color-line, #33405c)" }}
        >
          <span aria-hidden="true">💭</span>
        </button>
        <button
          type="button"
          onPointerDown={(e) => { e.preventDefault(); runCheck(); }}
          disabled={won}
          aria-label="Check the threshold across the whole day"
          className="flex h-[54px] flex-1 items-center justify-center gap-2 rounded-2xl text-lg font-bold transition active:scale-95 disabled:opacity-50"
          style={{ touchAction: "none", background: ACCENT, color: "#04130d", boxShadow: "0 6px 0 0 #15916a" }}
        >
          <span aria-hidden="true">{won ? "✅" : "▶"}</span>
          <span aria-hidden="true" className="font-extrabold">{won ? "SOLVED" : "CHECK"}</span>
        </button>
      </div>

      {/* celebratory floaters when solved */}
      {won && (
        <div className="pointer-events-none flex justify-center gap-2 text-2xl">
          <span style={{ animation: "g4nightlamp-float 1.6s ease-in-out infinite" }} aria-hidden="true">✨</span>
          <span style={{ animation: "g4nightlamp-float 1.6s ease-in-out infinite", animationDelay: "0.2s" }} aria-hidden="true">🎉</span>
          <span style={{ animation: "g4nightlamp-float 1.6s ease-in-out infinite", animationDelay: "0.4s" }} aria-hidden="true">✨</span>
        </div>
      )}

      <style>{`
        @keyframes g4nightlamp-pulse {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
        @keyframes g4nightlamp-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
