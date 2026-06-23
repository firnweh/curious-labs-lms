"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Build the Circuit ⚡ ──────────────────────────────────────────────────────
   CLASS 4-6 (explorer, age ~9-11) ROBOTICS lab. Not "drop 3 obvious parts in 3
   holes" — a real circuit-DESIGN problem with electrical RULES the learner must
   reason about, across THREE escalating rounds.

   The loop has ordered slots running CLOCKWISE from the battery's + terminal.
   Current leaves +, flows through every slot in order, and must arrive back at –.
   The learner builds the order. The grader checks REAL constraints:

   • Round 1 — Learn the rule. Battery is fixed at +. Place a Resistor, then the
     LED, in series so the LED is protected. Put the LED before the resistor and
     it "burns out" 💥 — order matters, not just presence.

   • Round 2 — Decoy + control. A SWITCH must be in the loop (you'll flip it to
     run), AND a BROKEN wire ✂ sits in the tray as a decoy — use it and current
     can't pass. More slots, more orderings: brute-force gets expensive.

   • Round 3 — DEBUG. A circuit arrives almost wired, but it's wrong: two parts
     are swapped so the LED would blow. Read it, find the bug, fix the order.

   OPTIMIZATION: each round has a part budget. Use only the parts the rule needs
   (no spare wires padding the loop) to earn the full ⭐⭐⭐; a working-but-bloated
   loop still passes at ⭐⭐. A clean solve every round → onComplete once, 3 stars.

   Wrong attempts NEVER scold and NEVER fire onComplete(passed:false): the bad
   spot is highlighted, a short hint shows, you fix it and flip again. Always
   winnable. Deterministic. Preserves the original loop visuals: travelling
   current dots, LED glow, the ON/OFF toggle, accent green, aria labels. */

const ACCENT = "#34d399";
const BAD = "#f87171";

/** Component kinds the learner can place into a slot. */
type PartId = "resistor" | "led" | "switch" | "wire" | "broken";

interface Part {
  id: PartId;
  label: string;
  glyph: string;
  hint: string;
}

const PARTS: Record<PartId, Part> = {
  resistor: { id: "resistor", label: "Resistor", glyph: "🟫", hint: "slows the current so the LED is safe" },
  led: { id: "led", label: "LED", glyph: "💡", hint: "lights up — but only if a resistor protects it first" },
  switch: { id: "switch", label: "Switch", glyph: "🔘", hint: "opens & closes the loop when you flip it" },
  wire: { id: "wire", label: "Wire", glyph: "➰", hint: "carries current, adds nothing else" },
  broken: { id: "broken", label: "Cut wire", glyph: "✂️", hint: "DECOY — it's snapped, current can't pass" },
};

type Slot = PartId | null;

/** A round = a fixed loop of ordered slots (clockwise from battery +), the
 *  parts offered in the tray, the rules to satisfy, and the part budget for ⭐⭐⭐. */
interface Round {
  title: string;
  /** How many empty slots the learner fills (battery + is implied, not a slot). */
  slots: number;
  /** Parts shown in the tray for this round. */
  tray: PartId[];
  /** Slots pre-filled when the round opens (the rest start empty / null).
   *  Used by the DEBUG round to hand the learner an almost-right circuit. */
  preset?: Slot[];
  /** Fewest parts a correct loop needs — beat or match this for full stars. */
  budget: number;
  /** Plain-language goals shown as a checklist. */
  goals: string[];
}

const ROUNDS: Round[] = [
  {
    title: "Protect the LED",
    slots: 2,
    tray: ["resistor", "led"],
    budget: 2,
    goals: ["Fill the loop so current can flow", "The LED must come AFTER a resistor"],
  },
  {
    title: "Add a switch (mind the decoy)",
    slots: 3,
    tray: ["resistor", "led", "switch", "wire", "broken"],
    budget: 3,
    goals: [
      "Put a switch in the loop so you can flip it on",
      "Resistor must come before the LED",
      "Never use the cut ✂️ wire — it's snapped",
    ],
  },
  {
    title: "Debug the broken build",
    slots: 3,
    // Almost right: LED is placed BEFORE the resistor → it would burn out.
    // The learner must swap them. (Switch is already correctly in slot 2.)
    preset: ["led", "switch", "resistor"],
    tray: ["resistor", "led", "switch", "wire"],
    budget: 3,
    goals: [
      "This loop is wired wrong — the LED sits before the resistor",
      "Swap parts so the resistor comes before the LED",
      "Keep the switch in the loop",
    ],
  },
];

type Phase = "build" | "ran-bad" | "won" | "done";

/** Deterministic grader. Walks the loop in order and reports the first problem,
 *  or null if the circuit is correct. Pure — no randomness, no time. */
interface Grade {
  ok: boolean;
  /** Index of the slot to highlight as the problem (or -1). */
  badIndex: number;
  /** Short, kid-readable hint. */
  message: string;
  /** True only when correct AND within the part budget. */
  optimal: boolean;
}

function gradeLoop(slots: Slot[], round: Round): Grade {
  // 1) Every slot must be filled.
  const emptyAt = slots.findIndex((s) => s === null);
  if (emptyAt !== -1) {
    return { ok: false, badIndex: emptyAt, message: "An empty slot breaks the loop — fill every slot.", optimal: false };
  }

  // 2) No snapped wire anywhere.
  const brokenAt = slots.findIndex((s) => s === "broken");
  if (brokenAt !== -1) {
    return { ok: false, badIndex: brokenAt, message: "The cut ✂️ wire is snapped — current can't pass it.", optimal: false };
  }

  const parts = slots as PartId[];

  // 3) Exactly one LED must be lit.
  const ledCount = parts.filter((p) => p === "led").length;
  if (ledCount === 0) {
    return { ok: false, badIndex: parts.length - 1, message: "There's no LED to light. Add one to the loop.", optimal: false };
  }
  if (ledCount > 1) {
    const second = parts.indexOf("led", parts.indexOf("led") + 1);
    return { ok: false, badIndex: second, message: "Two LEDs share the current — keep just one.", optimal: false };
  }

  // 4) A resistor must protect the LED, AND come before it in the flow.
  const ledIdx = parts.indexOf("led");
  const resistorBefore = parts.slice(0, ledIdx).includes("resistor");
  if (!resistorBefore) {
    const hasResistor = parts.includes("resistor");
    return {
      ok: false,
      badIndex: ledIdx,
      message: hasResistor
        ? "The LED gets the current first and burns out 💥 — put the resistor BEFORE it."
        : "No resistor protects the LED — add one before it.",
      optimal: false,
    };
  }

  // 5) Round-specific: a switch must be present when the round asks for one.
  const needsSwitch = round.tray.includes("switch") && round.goals.some((g) => g.toLowerCase().includes("switch"));
  if (needsSwitch && !parts.includes("switch")) {
    return { ok: false, badIndex: parts.length - 1, message: "You need a switch in the loop to flip it on.", optimal: false };
  }

  // Correct! Now: was it efficient? Count only the parts the rule truly needs.
  const usedParts = parts.length;
  const optimal = usedParts <= round.budget;
  return {
    ok: true,
    badIndex: -1,
    message: optimal ? "Clean build — current is flowing!" : "It works! But there are spare parts — try a tighter loop.",
    optimal,
  };
}

export default function BuildTheCircuit({ onComplete }: ActivityProps) {
  const [round, setRound] = useState<number>(0);
  const cfg = ROUNDS[round];

  const [slots, setSlots] = useState<Slot[]>(() => freshSlots(ROUNDS[0]));
  const [selected, setSelected] = useState<PartId | null>(null);
  const [switchOn, setSwitchOn] = useState<boolean>(false);
  const [phase, setPhase] = useState<Phase>("build");
  const [badIndex, setBadIndex] = useState<number>(-1);
  const [status, setStatus] = useState<string>("Plan the loop, then flip the switch to test it.");
  /** Best (lowest) stars earned across rounds — a sloppy round caps the total. */
  const [minStars, setMinStars] = useState<3 | 2>(3);

  const [phaseAnim, setPhaseAnim] = useState<number>(0); // current-dot animation 0..1
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportedRef = useRef<boolean>(false);

  const clearTimer = useCallback((): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // The switch only matters if one is actually placed in the loop.
  const hasSwitch = useMemo(() => slots.includes("switch"), [slots]);
  const grade = useMemo(() => gradeLoop(slots, cfg), [slots, cfg]);
  // Current flows when the build is correct AND (no switch needed, or switch on).
  const current = grade.ok && (!hasSwitch || switchOn) && (phase === "won" || phase === "done");

  // ── travelling current dots, only while current flows ──
  useEffect(() => {
    if (!current) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setPhaseAnim(0);
      return;
    }
    let start = 0;
    const tick = (t: number): void => {
      if (start === 0) start = t;
      setPhaseAnim(((t - start) / 2200) % 1);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [current]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const startRound = useCallback((r: number): void => {
    clearTimer();
    setSlots(freshSlots(ROUNDS[r]));
    setSelected(null);
    setSwitchOn(false);
    setBadIndex(-1);
    setPhase("build");
    setStatus(
      r === 2
        ? "This build is wrong on purpose — find the bug and fix the order."
        : "Plan the loop, then flip the switch to test it.",
    );
  }, [clearTimer]);

  const placePart = useCallback(
    (i: number): void => {
      if (phase === "won" || phase === "done") return;
      setBadIndex(-1);
      if (slots[i] !== null) {
        // tap a filled slot to clear it
        setSlots((prev) => prev.map((s, k) => (k === i ? null : s)));
        return;
      }
      if (selected === null) {
        setStatus("Pick a part from the tray, then tap a slot.");
        return;
      }
      setSlots((prev) => prev.map((s, k) => (k === i ? selected : s)));
      setStatus(`Placed the ${PARTS[selected].label}.`);
    },
    [phase, slots, selected],
  );

  const runTest = useCallback((): void => {
    if (phase === "won" || phase === "done") return;
    const g = gradeLoop(slots, cfg);
    if (!g.ok) {
      setBadIndex(g.badIndex);
      setStatus(g.message);
      setSwitchOn(false);
      setPhase("ran-bad");
      // gentle: clear the highlight after a beat, keep the build to fix
      clearTimer();
      timerRef.current = setTimeout(() => {
        setPhase("build");
      }, 200);
      return;
    }
    // Correct. If a switch is in the loop it must be flipped on to power up.
    if (hasSwitch && !switchOn) {
      setSwitchOn(true);
    }
    setBadIndex(-1);
    setStatus(g.message);
    const roundStars: 3 | 2 = g.optimal ? 3 : 2;
    if (!g.optimal) setMinStars(2);

    const last = round >= ROUNDS.length - 1;
    if (last) {
      setPhase("done");
      if (!reportedRef.current) {
        reportedRef.current = true;
        // Final stars = 3 only if THIS round was clean and no earlier round was sloppy.
        const finalStars: 1 | 2 | 3 = roundStars === 3 && minStars === 3 ? 3 : 2;
        onComplete({
          passed: true,
          stars: finalStars,
          detail:
            finalStars === 3
              ? "Every loop solved cleanly — full marks!"
              : "All loops working! Tighter, no-spare builds earn the third star.",
        });
      }
    } else {
      setPhase("won");
      clearTimer();
      timerRef.current = setTimeout(() => {
        setRound((r) => r + 1);
        startRound(round + 1);
      }, 1250);
    }
  }, [phase, slots, cfg, hasSwitch, switchOn, round, minStars, onComplete, clearTimer, startRound]);

  const toggleSwitch = useCallback((): void => {
    if (phase === "won" || phase === "done") return;
    if (!hasSwitch) {
      setStatus("No switch in the loop yet — place one first.");
      return;
    }
    setSwitchOn((v) => !v);
    setBadIndex(-1);
  }, [phase, hasSwitch]);

  const reset = useCallback((): void => {
    clearTimer();
    reportedRef.current = false;
    setMinStars(3);
    setRound(0);
    startRound(0);
  }, [clearTimer, startRound]);

  // ── loop geometry: slots sit evenly around a rounded square, clockwise,
  //    starting just right of the battery (which lives at the top-left corner). ──
  const loopPts = useMemo<Array<[number, number]>>(
    () => [
      [40, 40],
      [360, 40],
      [360, 260],
      [40, 260],
    ],
    [],
  );

  // Position each slot at an even fraction around the perimeter, after the battery.
  const slotPositions = useMemo<Array<{ x: number; y: number }>>(() => {
    const segs = perimeterSegs(loopPts);
    const n = slots.length;
    return slots.map((_, i) => {
      // leave room at the very start (battery) and spread the rest around
      const t = (i + 1) / (n + 1);
      return pointAt(segs, t);
    });
  }, [slots, loopPts]);

  const dotPositions = useMemo<Array<{ x: number; y: number }>>(() => {
    const segs = perimeterSegs(loopPts);
    const dots = 6;
    return Array.from({ length: dots }, (_, d) => pointAt(segs, (phaseAnim + d / dots) % 1));
  }, [phaseAnim, loopPts]);

  const goals = cfg.goals;
  const placedCount = slots.filter((s) => s !== null).length;
  const solvedHere = phase === "won" || phase === "done";

  return (
    <div className="flex w-full flex-col gap-3">
      {/* round banner + progress */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-ink-faint">
          Round {round + 1}/{ROUNDS.length}
        </span>
        <span className="text-sm font-semibold" style={{ color: ACCENT }}>
          {cfg.title}
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5" aria-hidden="true">
          {ROUNDS.map((_, i) => (
            <span
              key={i}
              className="rounded-full"
              style={{
                height: 10,
                width: 10,
                background: i < round || phase === "done" ? ACCENT : i === round ? "rgba(52,211,153,0.3)" : "rgba(120,140,170,0.2)",
                border: `1.5px solid ${i <= round || phase === "done" ? ACCENT : "rgba(120,140,170,0.35)"}`,
              }}
            />
          ))}
        </span>
      </div>

      {/* Canvas */}
      <div className="panel relative overflow-hidden rounded-xl border border-line p-2">
        <svg
          viewBox="0 0 400 300"
          className="block w-full"
          role="img"
          aria-label={`A square circuit loop with a battery and ${slots.length} ordered slots to fill with parts. Current flows clockwise from the battery's plus terminal.`}
        >
          <defs>
            <filter id="ledGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* base wires of the loop */}
          <rect
            x="40"
            y="40"
            width="320"
            height="220"
            rx="18"
            fill="none"
            stroke={current ? ACCENT : "#27314f"}
            strokeWidth="6"
            style={{
              transition: "stroke 240ms ease",
              filter: current ? `drop-shadow(0 0 6px ${ACCENT})` : "none",
            }}
          />

          {/* travelling current dots */}
          {current &&
            dotPositions.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="5" fill={ACCENT}>
                <animate attributeName="opacity" values="0.4;1;0.4" dur="1s" repeatCount="indefinite" />
              </circle>
            ))}

          {/* battery at the top-left corner — fixed + terminal, the flow's start */}
          <g aria-hidden="true">
            <circle cx={40} cy={40} r="22" fill="#0b1020" stroke="#4a567e" strokeWidth="3" />
            <text x={40} y={46} textAnchor="middle" fontSize="22" style={{ pointerEvents: "none" }}>
              🔋
            </text>
            <text x={40} y={18} textAnchor="middle" fontSize="13" fill={ACCENT} className="font-mono" style={{ pointerEvents: "none" }}>
              +
            </text>
            {/* flow-direction arrow leaving the + terminal */}
            <text x={86} y={34} textAnchor="middle" fontSize="13" fill="#6b779e" style={{ pointerEvents: "none" }}>
              →
            </text>
          </g>

          {/* ordered slots */}
          {slots.map((part, i) => {
            const pos = slotPositions[i];
            const isBad = badIndex === i;
            const ringColor = isBad ? BAD : part === null ? "#3a4566" : "#4a567e";
            const isLitLed = part === "led" && current;
            return (
              <g key={i}>
                {/* order number under the slot helps the learner reason about flow */}
                <text
                  x={pos.x}
                  y={pos.y - 32}
                  textAnchor="middle"
                  fontSize="10"
                  fill={isBad ? BAD : "#6b779e"}
                  className="font-mono"
                  style={{ pointerEvents: "none" }}
                >
                  {i + 1}
                </text>
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r="26"
                  fill="#0b1020"
                  stroke={ringColor}
                  strokeWidth={isBad ? 4 : 3}
                  strokeDasharray={part === null ? "6 5" : "0"}
                  style={{ cursor: solvedHere ? "default" : "pointer", transition: "stroke 180ms ease" }}
                  onClick={() => placePart(i)}
                />
                {part === null ? (
                  <text x={pos.x} y={pos.y + 5} textAnchor="middle" fontSize="12" fill="#6b779e" style={{ pointerEvents: "none" }}>
                    + add
                  </text>
                ) : isLitLed ? (
                  <text x={pos.x} y={pos.y + 12} textAnchor="middle" fontSize="32" filter="url(#ledGlow)" style={{ pointerEvents: "none" }}>
                    {PARTS[part].glyph}
                  </text>
                ) : (
                  <text
                    x={pos.x}
                    y={pos.y + 10}
                    textAnchor="middle"
                    fontSize="24"
                    opacity={part === "led" ? 0.55 : part === "broken" ? 0.8 : 1}
                    style={{ pointerEvents: "none" }}
                  >
                    {PARTS[part].glyph}
                  </text>
                )}
                {/* tap-to-clear hotspot over a filled slot */}
                {part !== null && (
                  <circle cx={pos.x} cy={pos.y} r="26" fill="transparent" style={{ cursor: solvedHere ? "default" : "pointer" }} onClick={() => placePart(i)}>
                    <title>Tap to remove this part</title>
                  </circle>
                )}
              </g>
            );
          })}

          {/* the physical switch readout on the bottom wire (only meaningful with a switch placed) */}
          <g
            transform="translate(200 260)"
            style={{ cursor: solvedHere || !hasSwitch ? "default" : "pointer", opacity: hasSwitch ? 1 : 0.4 }}
            onClick={toggleSwitch}
            role="button"
            aria-label={!hasSwitch ? "No switch placed yet" : switchOn ? "Switch is on, tap to turn off" : "Switch is off, tap to turn on"}
          >
            <rect x="-34" y="-16" width="68" height="32" rx="16" fill="#0b1020" stroke="#4a567e" strokeWidth="3" />
            <circle
              cx={switchOn && hasSwitch ? 16 : -16}
              cy="0"
              r="12"
              fill={switchOn && hasSwitch ? ACCENT : "#6b779e"}
              style={{ transition: "cx 200ms ease, fill 200ms ease" }}
            />
            <text x="0" y="-24" textAnchor="middle" fontSize="11" fill="#9aa6cf" className="font-mono">
              {hasSwitch ? (switchOn ? "ON" : "OFF") : "no switch"}
            </text>
          </g>
        </svg>

        {/* in-canvas status line */}
        <div
          className="font-mono mt-1 rounded-md px-2 py-1 text-center text-xs"
          style={{
            color: phase === "done" || phase === "won" ? "#05070d" : badIndex !== -1 ? "#fff" : "#9aa6cf",
            background: phase === "done" || phase === "won" ? ACCENT : badIndex !== -1 ? "rgba(248,113,113,0.85)" : "transparent",
          }}
          aria-live="polite"
        >
          {status}
        </div>
      </div>

      {/* Goals checklist — what a correct loop must satisfy */}
      <ul className="flex flex-col gap-1 rounded-lg border border-line bg-panel/40 px-3 py-2 text-xs text-ink-dim">
        {goals.map((g, i) => (
          <li key={i} className="flex items-start gap-1.5">
            <span aria-hidden="true" style={{ color: ACCENT }}>
              •
            </span>
            <span>{g}</span>
          </li>
        ))}
        <li className="flex items-start gap-1.5 pt-0.5 text-ink-faint">
          <span aria-hidden="true">⭐</span>
          <span>
            For full stars use only the parts you need ({cfg.budget} or fewer). Right now: {placedCount} placed.
          </span>
        </li>
      </ul>

      {/* Tray */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-ink-faint">Tray:</span>
        {cfg.tray.map((id) => {
          const p = PARTS[id];
          const active = selected === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSelected(active ? null : id)}
              disabled={solvedHere}
              aria-pressed={active}
              aria-label={`Select ${p.label} — ${p.hint}`}
              title={p.hint}
              className="rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50"
              style={
                active
                  ? { background: id === "broken" ? BAD : ACCENT, color: "#05070d" }
                  : { borderWidth: 1, borderStyle: "solid", borderColor: "var(--color-line, #27314f)", background: "rgba(11,16,32,0.6)", color: "#9aa6cf" }
              }
            >
              <span aria-hidden="true">{p.glyph}</span> {p.label}
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={runTest}
          disabled={solvedHere}
          className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: ACCENT, color: "#05070d" }}
          aria-label="Test the circuit by flipping the switch on"
        >
          ⚡ Test it
        </button>
        {hasSwitch && (
          <button
            type="button"
            onClick={toggleSwitch}
            disabled={solvedHere}
            className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim disabled:opacity-50"
            aria-label={switchOn ? "Turn the switch off" : "Turn the switch on"}
          >
            {switchOn ? "Switch OFF" : "Switch ON"}
          </button>
        )}
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
          aria-label="Clear everything and start from round one"
        >
          Reset
        </button>
        <span className="font-mono ml-auto text-xs text-ink-faint">
          {placedCount} / {slots.length} placed
        </span>
      </div>
    </div>
  );
}

/** Fresh slot array for a round — uses its preset if it has one, else all empty. */
function freshSlots(r: Round): Slot[] {
  if (r.preset) return [...r.preset];
  return Array.from({ length: r.slots }, () => null);
}

/** Perimeter as a list of segments for parametric placement along the loop. */
function perimeterSegs(pts: Array<[number, number]>): Array<{ ax: number; ay: number; bx: number; by: number }> {
  return pts.map((p, i) => {
    const n = pts[(i + 1) % pts.length];
    return { ax: p[0], ay: p[1], bx: n[0], by: n[1] };
  });
}

/** Point at fraction t (0..1) around the perimeter. */
function pointAt(segs: Array<{ ax: number; ay: number; bx: number; by: number }>, t: number): { x: number; y: number } {
  const total = segs.length;
  const tt = ((t % 1) + 1) % 1;
  const seg = Math.min(total - 1, Math.floor(tt * total));
  const local = tt * total - seg;
  const s = segs[seg];
  return { x: s.ax + (s.bx - s.ax) * local, y: s.ay + (s.by - s.ay) * local };
}
