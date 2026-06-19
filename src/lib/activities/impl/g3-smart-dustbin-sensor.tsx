"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Smart Bin Sensor Lab 🗑️ ──────────────────────────────────────────────────
   GRADE 3 (junior, age ~8). Subject: ROBOTICS.
   ONE learning goal: a SENSOR triggers an ACTION automatically — when the IR
   sensor sees something close, it tells the servo motor to open the lid. This
   is a WHEN → THEN automation rule.

   The child builds the rule by dragging a TRIGGER chip and an ACTION chip into
   two blanks: "WHEN [____] → THEN [____]". Only 'hand is near 👋' → 'open lid
   ⬆️' is the real automation. Then a draggable hand 🤚 appears; the child slides
   it toward the bin. When the hand enters the IR detection cone, the sensor eye
   flashes green and the rule FIRES: with the correct rule the lid swings open
   (servo animation) and trash drops in → win. With a wrong rule nothing useful
   happens and a gentle bubble says "Hmm, the lid didn't open — try another
   rule." Moving the hand away closes the lid — showing automatic on/off.

   Deterministic & always winnable: rules can be swapped infinitely; the only
   correct pairing is hand-near → open-lid AND the hand must reach the cone.
   ──────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#34d399";

// ── Rule chips ───────────────────────────────────────────────────────────────
type TriggerId = "hand" | "dark" | "music";
type ActionId = "open" | "fan" | "bell";

interface Chip<T extends string> {
  id: T;
  glyph: string;
  word: string;
}

const TRIGGERS: readonly Chip<TriggerId>[] = [
  { id: "hand", glyph: "👋", word: "hand is near" },
  { id: "dark", glyph: "🌙", word: "it is dark" },
  { id: "music", glyph: "🎵", word: "music plays" },
];

const ACTIONS: readonly Chip<ActionId>[] = [
  { id: "open", glyph: "⬆️", word: "open lid" },
  { id: "fan", glyph: "🌀", word: "spin fan" },
  { id: "bell", glyph: "🔔", word: "ring bell" },
];

const CORRECT_TRIGGER: TriggerId = "hand";
const CORRECT_ACTION: ActionId = "open";

// ── Virtual SVG world (CSS scales it responsively) ───────────────────────────
const VW = 360;
const VH = 200;
const FLOOR_Y = 168;

// The bin sits on the right. The IR sensor eye is on its front rim.
const BIN_X = 250; // left edge of the bin body
const BIN_W = 86;
const EYE_X = BIN_X - 2; // sensor eye, front-left of the bin
const EYE_Y = 96;

// The detection cone reaches left from the eye. The hand triggers it when its
// centre is within this x-range AND roughly level with the eye.
const CONE_NEAR_X = 150; // how far left the cone still detects
const detects = (handX: number): boolean => handX <= CONE_NEAR_X + 1;

// The hand slides along this track (its CENTRE x, clamped to the rail).
const HAND_MIN_X = 40;
const HAND_MAX_X = 196; // stops just inside the cone — easy to reach
const HAND_START_X = 60;

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

type Slot = "trigger" | "action";
type Phase = "build" | "play" | "won";

export default function SmartBinSensor({ onComplete }: ActivityProps) {
  const [trigger, setTrigger] = useState<TriggerId | null>(null);
  const [action, setAction] = useState<ActionId | null>(null);
  const [phase, setPhase] = useState<Phase>("build");
  const [handX, setHandX] = useState<number>(HAND_START_X);
  const [dragging, setDragging] = useState<boolean>(false);
  // Which chip is currently picked up (for a gentle "drop me in a slot" cue).
  const [held, setHeld] = useState<string | null>(null);
  // Shows the "lid didn't open" bubble after a wrong-rule trigger.
  const [missed, setMissed] = useState<boolean>(false);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const reportedRef = useRef<boolean>(false);
  const missTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const won = phase === "won";
  const playing = phase === "play";

  const ruleCorrect = trigger === CORRECT_TRIGGER && action === CORRECT_ACTION;
  const ruleFull = trigger !== null && action !== null;

  // The sensor "sees" the hand whenever it's inside the cone (any phase in play).
  const sensorLit = (playing || won) && detects(handX);
  // The lid opens only when the correct rule is set AND the sensor sees the hand.
  const lidOpen = ruleCorrect && sensorLit;

  const clearMiss = useCallback((): void => {
    if (missTimer.current !== null) {
      clearTimeout(missTimer.current);
      missTimer.current = null;
    }
  }, []);
  useEffect(() => () => clearMiss(), [clearMiss]);

  // ── Win: fires once when the correct lid actually opens ─────────────────────
  useEffect(() => {
    if (lidOpen && !won && !reportedRef.current) {
      reportedRef.current = true;
      setPhase("won");
      onComplete({
        passed: true,
        stars: 3,
        detail: "Your sensor saw the hand and the lid popped open! 🗑️✨",
      });
    }
  }, [lidOpen, won, onComplete]);

  // ── Building the rule: drop a chip into its matching slot ───────────────────
  const placeChip = useCallback(
    (slot: Slot, id: string): void => {
      if (won) return;
      clearMiss();
      setMissed(false);
      if (slot === "trigger") setTrigger(id as TriggerId);
      else setAction(id as ActionId);
      setHeld(null);
    },
    [won, clearMiss],
  );

  // Tapping a palette chip "arms" it; tapping a slot drops the armed chip in.
  // (Tap-to-place is the most forgiving input for little fingers — no precise
  // drop needed — while still feeling like dragging a chip into the sentence.)
  const onChipDown = useCallback(
    (slot: Slot, id: string): void => {
      if (won) return;
      placeChip(slot, id);
    },
    [won, placeChip],
  );

  // ── Dragging the hand (pointer → virtual SVG x) ─────────────────────────────
  const pointerToHandX = useCallback((clientX: number): number => {
    const svg = svgRef.current;
    if (!svg) return HAND_START_X;
    const rect = svg.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    return clamp(ratio * VW, HAND_MIN_X, HAND_MAX_X);
  }, []);

  const onHandDown = useCallback(
    (e: React.PointerEvent<SVGGElement>): void => {
      if (won) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setDragging(true);
      setHandX(pointerToHandX(e.clientX));
    },
    [won, pointerToHandX],
  );

  const onHandMove = useCallback(
    (e: React.PointerEvent<SVGGElement>): void => {
      if (!dragging || won) return;
      e.preventDefault();
      const nx = pointerToHandX(e.clientX);
      setHandX(nx);
      // If the hand reaches the cone with a WRONG rule, show a gentle nudge.
      if (detects(nx) && ruleFull && !ruleCorrect) {
        setMissed(true);
        if (!reportedRef.current) {
          clearMiss();
          missTimer.current = setTimeout(() => {
            onComplete({
              passed: false,
              detail: "The lid didn't open — try another WHEN → THEN rule!",
            });
          }, 0);
        }
      } else {
        setMissed(false);
      }
    },
    [dragging, won, pointerToHandX, ruleFull, ruleCorrect, clearMiss, onComplete],
  );

  const onHandUp = useCallback(
    (e: React.PointerEvent<SVGGElement>): void => {
      if (!dragging) return;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      setDragging(false);
    },
    [dragging],
  );

  // ── Move from build → play once a full rule is set ──────────────────────────
  const startPlay = useCallback((): void => {
    if (won || !ruleFull) return;
    clearMiss();
    setMissed(false);
    setHandX(HAND_START_X);
    setPhase("play");
  }, [won, ruleFull, clearMiss]);

  const reset = useCallback((): void => {
    clearMiss();
    reportedRef.current = false;
    setTrigger(null);
    setAction(null);
    setPhase("build");
    setHandX(HAND_START_X);
    setDragging(false);
    setHeld(null);
    setMissed(false);
  }, [clearMiss]);

  // ── Tiny visual status (emoji, no paragraphs) ──────────────────────────────
  const statusEmoji = useMemo<string>(() => {
    if (won) return "🎉";
    if (missed) return "🤔";
    if (sensorLit) return "👀";
    if (playing) return "🤚";
    return "🧩";
  }, [won, missed, sensorLit, playing]);

  const statusLabel = won
    ? "The sensor opened the lid automatically!"
    : missed
      ? "The lid didn't open. Try a different WHEN to THEN rule."
      : playing
        ? "Slide the hand toward the bin's sensor"
        : ruleFull
          ? "Rule is set. Press Play to test it!"
          : "Build the rule: drag a WHEN chip and a THEN chip into the blanks";

  const triggerChip = trigger
    ? TRIGGERS.find((c) => c.id === trigger) ?? null
    : null;
  const actionChip = action ? ACTIONS.find((c) => c.id === action) ?? null : null;

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono text-ink">
      {/* ── Status pill ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={statusLabel}
        style={{
          background: won ? "rgba(52,211,153,0.16)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${won ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: won ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true">{statusEmoji}</span>
        {won ? (
          <span aria-hidden="true" className="text-2xl">
            ⭐⭐⭐
          </span>
        ) : (
          <span aria-hidden="true" className="text-xl">
            🤚→🗑️
          </span>
        )}
        {won && (
          <span aria-hidden="true" className="text-2xl">
            ✨
          </span>
        )}
      </div>

      {/* ── The scene: bin, IR sensor eye + cone, servo hinge, draggable hand ── */}
      <div className="panel relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-line p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VW} ${VH}`}
          className="block w-full select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="A dustbin with an infrared sensor eye, a servo on the lid hinge, and a hand you can slide toward the bin"
        >
          <defs>
            <linearGradient id="g3smartdustbinsensor-bin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2c3850" />
              <stop offset="100%" stopColor="#1b2436" />
            </linearGradient>
            <radialGradient id="g3smartdustbinsensor-cone" cx="100%" cy="50%" r="90%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.55" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* floor */}
          <line
            x1={0}
            y1={FLOOR_Y}
            x2={VW}
            y2={FLOOR_Y}
            stroke="rgba(120,140,170,0.35)"
            strokeWidth={2}
          />

          {/* ── IR detection cone (faint when idle, bright when it sees the hand) ── */}
          <path
            d={`M ${EYE_X} ${EYE_Y} L ${CONE_NEAR_X - 24} ${EYE_Y - 30} L ${CONE_NEAR_X - 24} ${EYE_Y + 30} Z`}
            fill="url(#g3smartdustbinsensor-cone)"
            opacity={sensorLit ? 1 : 0.45}
            style={{
              animation:
                playing && !sensorLit
                  ? "g3smartdustbinsensor-pulse 1.6s ease-in-out infinite"
                  : undefined,
            }}
          />

          {/* ── Bin body ── */}
          <rect
            x={BIN_X}
            y={70}
            width={BIN_W}
            height={FLOOR_Y - 70}
            rx={10}
            fill="url(#g3smartdustbinsensor-bin)"
            stroke="#3a4866"
            strokeWidth={2}
          />
          {/* bin vertical ribs */}
          <line x1={BIN_X + 28} y1={80} x2={BIN_X + 28} y2={FLOOR_Y - 6} stroke="#3a4866" strokeWidth={2} />
          <line x1={BIN_X + 58} y1={80} x2={BIN_X + 58} y2={FLOOR_Y - 6} stroke="#3a4866" strokeWidth={2} />

          {/* ── Servo motor at the hinge (top-right corner of the bin) ── */}
          <circle
            cx={BIN_X + BIN_W - 6}
            cy={68}
            r={8}
            fill={lidOpen ? ACCENT : "#26324a"}
            stroke={lidOpen ? ACCENT : "#46587a"}
            strokeWidth={2}
            style={{ filter: lidOpen ? `drop-shadow(0 0 6px ${ACCENT})` : undefined }}
          />
          <text
            x={BIN_X + BIN_W - 6}
            y={69}
            fontSize={9}
            textAnchor="middle"
            dominantBaseline="central"
            aria-hidden="true"
          >
            ⚙️
          </text>

          {/* ── Hinged lid — swings up on the servo when the rule fires ── */}
          <g
            style={{
              transform: lidOpen ? "rotate(-58deg)" : "rotate(0deg)",
              transformOrigin: `${BIN_X + BIN_W - 6}px 68px`,
              transformBox: "view-box",
              transition: "transform 420ms cubic-bezier(.34,1.4,.5,1)",
            }}
          >
            <rect
              x={BIN_X - 4}
              y={56}
              width={BIN_W + 8}
              height={16}
              rx={6}
              fill={lidOpen ? "rgba(52,211,153,0.30)" : "#33415c"}
              stroke={lidOpen ? ACCENT : "#46587a"}
              strokeWidth={2}
            />
          </g>

          {/* ── IR sensor 'eye' on the front rim ── */}
          <circle
            cx={EYE_X}
            cy={EYE_Y}
            r={9}
            fill={sensorLit ? ACCENT : "#10182a"}
            stroke={sensorLit ? ACCENT : "#46587a"}
            strokeWidth={2.5}
            style={{
              filter: sensorLit ? `drop-shadow(0 0 7px ${ACCENT})` : undefined,
              animation: sensorLit ? "g3smartdustbinsensor-blink 0.5s ease" : undefined,
            }}
          />
          <text
            x={EYE_X}
            y={EYE_Y + 0.5}
            fontSize={10}
            textAnchor="middle"
            dominantBaseline="central"
            aria-hidden="true"
          >
            👁️
          </text>

          {/* ── Trash that drops in when the correct lid opens ── */}
          {lidOpen && (
            <text
              x={BIN_X + BIN_W / 2}
              y={40}
              fontSize={20}
              textAnchor="middle"
              dominantBaseline="central"
              aria-hidden="true"
              style={{ animation: "g3smartdustbinsensor-drop 0.7s ease-in both" }}
            >
              🗑️
            </text>
          )}

          {/* ── The draggable HAND (only in play / won) ── */}
          {(playing || won) && (
            <g
              onPointerDown={onHandDown}
              onPointerMove={onHandMove}
              onPointerUp={onHandUp}
              onPointerCancel={onHandUp}
              style={{
                cursor: won ? "default" : "grab",
                transform: `translate(${handX}px, ${EYE_Y}px)`,
                transition: dragging ? "none" : "transform 160ms ease-out",
                touchAction: "none",
              }}
              role="button"
              tabIndex={0}
              aria-label="Hand — slide it toward the bin's sensor"
            >
              {/* generous invisible hit pad for little fingers */}
              <circle r={26} fill="transparent" />
              <circle
                r={18}
                fill="rgba(52,211,153,0.10)"
                stroke={ACCENT}
                strokeWidth={sensorLit ? 2.5 : 1.5}
                style={{ filter: sensorLit ? `drop-shadow(0 0 6px ${ACCENT})` : undefined }}
              />
              <text
                x={0}
                y={1}
                fontSize={24}
                textAnchor="middle"
                dominantBaseline="central"
                aria-hidden="true"
              >
                🤚
              </text>
              {/* nudge arrow toward the bin while not yet detecting */}
              {!sensorLit && !won && (
                <text
                  x={26}
                  y={1}
                  fontSize={14}
                  textAnchor="middle"
                  dominantBaseline="central"
                  aria-hidden="true"
                  style={{ animation: "g3smartdustbinsensor-nudge 1.2s ease-in-out infinite" }}
                >
                  👉
                </text>
              )}
            </g>
          )}

          {/* gentle "didn't open" bubble for a wrong rule in the cone */}
          {missed && !won && (
            <g aria-hidden="true">
              <rect
                x={CONE_NEAR_X - 70}
                y={28}
                width={130}
                height={26}
                rx={13}
                fill="rgba(255,255,255,0.10)"
                stroke="#46587a"
                strokeWidth={1.5}
              />
              <text
                x={CONE_NEAR_X - 5}
                y={42}
                fontSize={11}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#cbd5e1"
              >
                Hmm… lid stayed shut 🤔
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* ── The rule sentence: WHEN [trigger] → THEN [action] ── */}
      <div
        className="flex w-full max-w-[420px] flex-wrap items-center justify-center gap-1.5 rounded-2xl px-3 py-3 text-base font-bold"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: `2px solid ${ruleCorrect ? ACCENT : "var(--color-line, #33405c)"}`,
        }}
        aria-label={`Rule: WHEN ${triggerChip ? triggerChip.word : "blank"}, THEN ${actionChip ? actionChip.word : "blank"}`}
      >
        <span aria-hidden="true" style={{ color: ACCENT }}>
          WHEN
        </span>
        <Blank
          chipGlyph={triggerChip?.glyph ?? null}
          armed={held !== null}
        />
        <span aria-hidden="true" className="text-xl">
          →
        </span>
        <span aria-hidden="true" style={{ color: ACCENT }}>
          THEN
        </span>
        <Blank chipGlyph={actionChip?.glyph ?? null} armed={held !== null} />
      </div>

      {/* ── Chip palettes (tap a chip to drop it into its slot) ── */}
      {!won && (
        <div className="flex w-full max-w-[420px] flex-col gap-2">
          <ChipRow
            label="WHEN chips — pick a trigger"
            chips={TRIGGERS}
            slot="trigger"
            selected={trigger}
            onPick={(id) => onChipDown("trigger", id)}
            setHeld={setHeld}
          />
          <ChipRow
            label="THEN chips — pick an action"
            chips={ACTIONS}
            slot="action"
            selected={action}
            onPick={(id) => onChipDown("action", id)}
            setHeld={setHeld}
          />
        </div>
      )}

      {/* ── Controls: PLAY · Reset ── */}
      <div className="flex w-full max-w-[420px] items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            startPlay();
          }}
          disabled={won || !ruleFull || playing}
          aria-label="Play — test your rule by sliding the hand toward the bin"
          className="flex h-[60px] flex-1 items-center justify-center gap-2 rounded-2xl text-2xl font-bold transition active:scale-95 disabled:opacity-50"
          style={{
            touchAction: "none",
            background: ACCENT,
            color: "#04130d",
            boxShadow: "0 6px 0 0 #15916a",
          }}
        >
          <span aria-hidden="true">{playing ? "🤚" : "▶"}</span>
          <span aria-hidden="true" className="text-xl font-extrabold">
            {playing ? "TEST" : "PLAY"}
          </span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            reset();
          }}
          aria-label="Start over"
          className="grid h-[60px] w-[60px] place-items-center rounded-2xl text-2xl transition active:scale-90"
          style={{
            touchAction: "none",
            background: "rgba(255,255,255,0.05)",
            border: "2px solid var(--color-line, #33405c)",
          }}
        >
          <span aria-hidden="true">🔄</span>
        </button>
      </div>

      {/* tiny coaching line (emoji + few words) */}
      <div className="flex items-center gap-2 text-sm text-ink-dim" aria-hidden="true">
        {won ? (
          <span>Sensor → servo → lid opens! 🗑️✨</span>
        ) : missed ? (
          <span>Wrong rule. Try 👋 → ⬆️ in the blanks</span>
        ) : playing ? (
          <span>Slide 🤚 into the green cone</span>
        ) : ruleFull ? (
          <span>Rule set — press PLAY ▶</span>
        ) : (
          <span>Pick a WHEN chip and a THEN chip</span>
        )}
      </div>

      {/* celebratory floaters when solved */}
      {won && (
        <div className="pointer-events-none flex justify-center gap-2 text-2xl">
          <span className="animate-float" aria-hidden="true">
            ✨
          </span>
          <span className="animate-float" style={{ animationDelay: "0.2s" }} aria-hidden="true">
            🎉
          </span>
          <span className="animate-float" style={{ animationDelay: "0.4s" }} aria-hidden="true">
            ✨
          </span>
        </div>
      )}

      <style>{`
        @keyframes g3smartdustbinsensor-pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.7; }
        }
        @keyframes g3smartdustbinsensor-blink {
          0% { transform: scale(1); }
          50% { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
        @keyframes g3smartdustbinsensor-drop {
          0% { transform: translateY(-18px); opacity: 0; }
          60% { transform: translateY(6px); opacity: 1; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes g3smartdustbinsensor-nudge {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(4px); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

// ── One blank in the rule sentence ──────────────────────────────────────────
function Blank({
  chipGlyph,
  armed,
}: {
  chipGlyph: string | null;
  armed: boolean;
}) {
  const filled = chipGlyph !== null;
  return (
    <span
      className="grid h-10 min-w-[48px] place-items-center rounded-xl px-2 text-2xl"
      aria-hidden="true"
      style={{
        border: `2px ${filled ? "solid" : "dashed"} ${filled ? ACCENT : "var(--color-line, #33405c)"}`,
        background: filled ? "rgba(52,211,153,0.14)" : "rgba(255,255,255,0.03)",
        boxShadow: filled ? `0 0 12px ${ACCENT}55` : undefined,
        animation: !filled && armed ? "g3smartdustbinsensor-pulse 1.2s ease-in-out infinite" : undefined,
      }}
    >
      {filled ? chipGlyph : "＿"}
    </span>
  );
}

// ── A row of pickable chips ──────────────────────────────────────────────────
function ChipRow<T extends string>({
  label,
  chips,
  slot,
  selected,
  onPick,
  setHeld,
}: {
  label: string;
  chips: readonly Chip<T>[];
  slot: Slot;
  selected: T | null;
  onPick: (id: T) => void;
  setHeld: (v: string | null) => void;
}) {
  return (
    <div
      className="flex items-center justify-center gap-2"
      role="group"
      aria-label={label}
    >
      {chips.map((c) => {
        const isOn = selected === c.id;
        return (
          <button
            key={c.id}
            type="button"
            aria-label={`${slot === "trigger" ? "When" : "Then"}: ${c.word}`}
            aria-pressed={isOn}
            onPointerDown={(e) => {
              e.preventDefault();
              setHeld(`${slot}-${c.id}`);
              onPick(c.id);
            }}
            className="flex h-[58px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-2xl transition active:scale-95"
            style={{
              touchAction: "none",
              background: isOn ? "rgba(52,211,153,0.16)" : "rgba(255,255,255,0.05)",
              border: `2px solid ${isOn ? ACCENT : "var(--color-line, #33405c)"}`,
              boxShadow: isOn ? `0 0 12px ${ACCENT}55` : undefined,
            }}
          >
            <span aria-hidden="true">{c.glyph}</span>
            <span aria-hidden="true" className="text-[9px] leading-none text-ink-dim">
              {c.word}
            </span>
          </button>
        );
      })}
    </div>
  );
}
