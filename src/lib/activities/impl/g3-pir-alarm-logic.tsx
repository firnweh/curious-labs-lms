"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Motion Alarm Detective 🚨 ────────────────────────────────────────────────
   JUNIOR (Grade 3, age ~8) AI activity. LEARNING GOAL: a motion alarm only works
   well when its RULE matches reality — it must fire for real intruders and stay
   quiet for safe things, just like smart safety logic that ignores pets and family
   but catches a burglar. A PIR sensor 🔴 watches a doorway. The child taps picture
   tiles to choose WHICH moving things trigger the alarm, then ARMS the system and
   watches a fixed 5-icon parade (🦹 👧 🐈 🎈 🦹) cross the cone. The alarm 🔔 fires
   only for chosen tiles. Win = catch BOTH burglars with ZERO false alarms (the
   right rule is burglars-only). Forgiving, tap-only, picture-based, replayable. */

const ACCENT = "#a855f7";
const DANGER = "#f87171";
const STEP_MS = 1100;

type IconId = "burglar" | "kid" | "cat" | "balloon";

interface MoverKind {
  id: IconId;
  glyph: string;
  word: string;
  /** Ground truth: is this an actual intruder we WANT to catch? */
  intruder: boolean;
}

/** The four kinds of things that can move through the room. */
const KINDS: readonly MoverKind[] = [
  { id: "burglar", glyph: "🦹", word: "burglar", intruder: true },
  { id: "kid", glyph: "👧", word: "family kid", intruder: false },
  { id: "cat", glyph: "🐈", word: "pet cat", intruder: false },
  { id: "balloon", glyph: "🎈", word: "floating balloon", intruder: false },
] as const;

/** Tiles the learner can toggle in the rule (one per kind). */
const RULE_TILES: readonly MoverKind[] = KINDS;

/** Deterministic parade — always two burglars + three safe movers. Choosing the
 *  burglars-only rule yields a perfect 2/2 caught, 0 false alarms every time. */
const PARADE: readonly IconId[] = ["burglar", "kid", "cat", "balloon", "burglar"];

const kindOf = (id: IconId): MoverKind => {
  const k = KINDS.find((m) => m.id === id);
  // PARADE only ever holds valid ids, so this is always defined.
  return k ?? KINDS[0];
};

const TOTAL_INTRUDERS = PARADE.filter((id) => kindOf(id).intruder).length;

type Phase = "setup" | "armed" | "won";

interface Verdict {
  caught: number;
  falseAlarms: number;
}

export default function MotionAlarmDetective({ onComplete }: ActivityProps) {
  /** Which kinds the rule will fire on (the alarm's logic). */
  const [rule, setRule] = useState<Set<IconId>>(() => new Set<IconId>());
  const [phase, setPhase] = useState<Phase>("setup");
  /** Index into PARADE currently crossing the cone, or -1 before/after. */
  const [idx, setIdx] = useState<number>(-1);
  /** Is the alarm firing on the current mover? */
  const [alarmFiring, setAlarmFiring] = useState<boolean>(false);
  const [verdict, setVerdict] = useState<Verdict>({ caught: 0, falseAlarms: 0 });
  /** Set true once a false alarm happens this run — drives the gentle hint. */
  const [hadFalse, setHadFalse] = useState<boolean>(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportedRef = useRef<boolean>(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => () => clearTimer(), [clearTimer]);

  const armed = phase === "armed";
  const won = phase === "won";

  const toggleTile = useCallback(
    (id: IconId) => {
      if (armed || won) return;
      setRule((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [armed, won],
  );

  const stopParade = useCallback(() => {
    clearTimer();
    setIdx(-1);
    setAlarmFiring(false);
  }, [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    reportedRef.current = false;
    setRule(new Set<IconId>());
    setPhase("setup");
    setIdx(-1);
    setAlarmFiring(false);
    setVerdict({ caught: 0, falseAlarms: 0 });
    setHadFalse(false);
  }, [clearTimer]);

  /** ARM → run the fixed parade one mover at a time, scoring deterministically. */
  const arm = useCallback(() => {
    if (armed || won) return;
    clearTimer();
    setPhase("armed");
    setVerdict({ caught: 0, falseAlarms: 0 });
    setHadFalse(false);
    setAlarmFiring(false);

    const ruleSnapshot = new Set(rule);
    const tally: Verdict = { caught: 0, falseAlarms: 0 };

    const showMover = (i: number): void => {
      if (i >= PARADE.length) {
        setIdx(-1);
        setAlarmFiring(false);
        const perfect =
          tally.caught === TOTAL_INTRUDERS && tally.falseAlarms === 0;
        if (perfect) {
          setPhase("won");
          if (!reportedRef.current) {
            reportedRef.current = true;
            onComplete({
              passed: true,
              stars: 3,
              detail: "Home secured! Both intruders caught, zero false alarms. 🚨",
            });
          }
        } else {
          // Settle back to setup so the child can tweak the rule and replay.
          setPhase("setup");
          onComplete({
            passed: false,
            detail:
              tally.falseAlarms > 0
                ? "A safe friend set off the alarm — try changing your rule. 🙂"
                : "An intruder slipped past — pick the right tile and arm again. 🙂",
          });
        }
        return;
      }

      const kind = kindOf(PARADE[i]);
      const fires = ruleSnapshot.has(kind.id);
      setIdx(i);
      setAlarmFiring(fires);

      if (fires && kind.intruder) tally.caught += 1;
      if (fires && !kind.intruder) {
        tally.falseAlarms += 1;
        setHadFalse(true);
      }
      setVerdict({ caught: tally.caught, falseAlarms: tally.falseAlarms });

      timerRef.current = setTimeout(() => showMover(i + 1), STEP_MS);
    };

    timerRef.current = setTimeout(() => showMover(0), 420);
  }, [armed, won, clearTimer, rule, onComplete]);

  const currentKind = useMemo<MoverKind | null>(
    () => (idx >= 0 ? kindOf(PARADE[idx]) : null),
    [idx],
  );

  const statusEmoji = useMemo<string>(() => {
    if (won) return "🎉";
    if (alarmFiring) return "🔔";
    if (armed) return "🟢";
    return "🛡️";
  }, [won, alarmFiring, armed]);

  const statusLabel = won
    ? "Home secured! Both intruders caught."
    : armed
      ? "System armed — watching the parade."
      : "Pick which movers should sound the alarm, then arm.";

  // SVG room geometry (virtual units; CSS scales responsively).
  const VW = 320;
  const VH = 220;
  const moverX = idx >= 0 ? 40 + (idx / (PARADE.length - 1)) * (VW - 80) : -100;
  const moverY = 96;

  return (
    <div className="flex w-full max-w-[440px] flex-col items-center gap-3 font-mono text-ink">
      <style>{KEYFRAMES}</style>

      {/* ── Status pill (emoji-first, screen-reader friendly) ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={statusLabel}
        style={{
          background: won ? "rgba(168,85,247,0.16)" : "rgba(255,255,255,0.04)",
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
            🔴→🔔
          </span>
        )}
        {won && (
          <span aria-hidden="true" className="text-2xl">
            ✨
          </span>
        )}
      </div>

      {/* ── Top-down room with PIR sensor + detection cone ── */}
      <div className="panel relative w-full overflow-hidden rounded-2xl border border-line p-2">
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="block w-full select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="A top-down room with a motion sensor in the corner watching a doorway"
        >
          <defs>
            <linearGradient id="g3pir-cone" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={alarmFiring ? DANGER : ACCENT} stopOpacity="0.45" />
              <stop offset="100%" stopColor={alarmFiring ? DANGER : ACCENT} stopOpacity="0.04" />
            </linearGradient>
          </defs>

          {/* room floor */}
          <rect
            x={8}
            y={8}
            width={VW - 16}
            height={VH - 16}
            rx={14}
            fill="rgba(255,255,255,0.04)"
            stroke="rgba(120,140,170,0.28)"
            strokeWidth={2}
          />

          {/* doorway on the right wall */}
          <rect
            x={VW - 14}
            y={70}
            width={12}
            height={52}
            rx={4}
            fill="#1b2436"
            stroke="rgba(120,140,170,0.35)"
            strokeWidth={1.5}
          />
          <text x={VW - 26} y={62} fontSize={16} textAnchor="middle" aria-hidden="true">
            🚪
          </text>

          {/* detection cone fanning out from the sensor corner */}
          <polygon
            points={`30,40 ${VW - 18},62 ${VW - 18},132 30,40`}
            fill="url(#g3pir-cone)"
            style={{
              animation: alarmFiring ? "g3piralarmlogic-pulse 0.5s ease-in-out infinite" : undefined,
            }}
          />

          {/* the PIR sensor in the corner */}
          <circle
            cx={30}
            cy={40}
            r={16}
            fill="#0b1220"
            stroke={alarmFiring ? DANGER : ACCENT}
            strokeWidth={2.5}
            style={{
              animation: alarmFiring ? "g3piralarmlogic-flash 0.4s ease-in-out infinite" : undefined,
            }}
          />
          <text x={30} y={41} fontSize={18} textAnchor="middle" dominantBaseline="central" aria-label="motion sensor">
            🔴
          </text>

          {/* the alarm bell */}
          <text
            x={VW - 30}
            y={VH - 22}
            fontSize={26}
            textAnchor="middle"
            dominantBaseline="central"
            aria-hidden="true"
            style={{
              animation: alarmFiring ? "g3piralarmlogic-ring 0.35s ease-in-out infinite" : undefined,
            }}
          >
            {alarmFiring ? "🔔" : "🔕"}
          </text>

          {/* INTRUDER! banner when the alarm fires on a mover */}
          {alarmFiring && (
            <text
              x={VW / 2}
              y={26}
              fontSize={16}
              fontWeight="bold"
              textAnchor="middle"
              fill={DANGER}
              aria-hidden="true"
              style={{ animation: "g3piralarmlogic-flash 0.4s ease-in-out infinite" }}
            >
              🚨 INTRUDER! 🚨
            </text>
          )}

          {/* the moving icon crossing the room */}
          {currentKind && (
            <g
              style={{
                transform: `translate(${moverX}px, ${moverY}px)`,
                transition: `transform ${STEP_MS}ms linear`,
              }}
            >
              <text
                x={0}
                y={0}
                fontSize={30}
                textAnchor="middle"
                dominantBaseline="central"
                aria-label={`${currentKind.word} moving through the room`}
              >
                {currentKind.glyph}
              </text>
            </g>
          )}
        </svg>

        {/* live tally — caught vs false alarms */}
        <div
          className="mt-1 flex items-center justify-center gap-4 text-sm"
          aria-live="polite"
          aria-label={`Caught ${verdict.caught} of ${TOTAL_INTRUDERS} intruders, ${verdict.falseAlarms} false alarms`}
        >
          <span className="flex items-center gap-1" style={{ color: ACCENT }}>
            <span aria-hidden="true">🦹</span>
            {verdict.caught}/{TOTAL_INTRUDERS}
          </span>
          <span className="flex items-center gap-1" style={{ color: verdict.falseAlarms > 0 ? DANGER : "var(--color-ink-dim, #94a3b8)" }}>
            <span aria-hidden="true">🔔</span>
            {verdict.falseAlarms}
          </span>
        </div>
      </div>

      {/* ── Rule picker: tap tiles to choose who triggers the alarm ── */}
      <div className="w-full" aria-label="Choose which movers sound the alarm">
        <div className="grid grid-cols-4 gap-2">
          {RULE_TILES.map((k) => {
            const on = rule.has(k.id);
            return (
              <button
                key={k.id}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  toggleTile(k.id);
                }}
                disabled={armed || won}
                aria-pressed={on}
                aria-label={`${on ? "Alarm on" : "Alarm off"} for ${k.word}`}
                className="relative grid aspect-square min-h-[64px] place-items-center rounded-2xl text-4xl transition active:scale-90 disabled:opacity-50"
                style={{
                  touchAction: "none",
                  background: on ? "rgba(168,85,247,0.18)" : "rgba(255,255,255,0.05)",
                  border: `2px solid ${on ? ACCENT : "var(--color-line, #33405c)"}`,
                  boxShadow: on ? `0 0 12px ${ACCENT}66` : "none",
                }}
              >
                <span aria-hidden="true">{k.glyph}</span>
                <span
                  aria-hidden="true"
                  className="absolute right-1 top-1 text-sm"
                  style={{ opacity: on ? 1 : 0.3 }}
                >
                  {on ? "🔔" : "💤"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* gentle hint after a false alarm */}
      {hadFalse && !won && (
        <div
          className="rounded-xl px-3 py-1.5 text-center text-sm"
          aria-live="polite"
          style={{ background: "rgba(248,113,113,0.10)", border: `1.5px solid ${DANGER}66`, color: "#fca5a5" }}
        >
          <span aria-hidden="true">🙂</span> That one was safe — maybe change your rule.
        </div>
      )}

      {/* ── Controls: ARM/DISARMED toggle · Reset ── */}
      <div className="flex w-full items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            if (armed) stopParade();
            else arm();
          }}
          disabled={won}
          aria-label={armed ? "System armed and watching" : "Arm the system and start the parade"}
          className="flex h-[60px] flex-1 items-center justify-center gap-2 rounded-2xl text-xl font-extrabold transition active:scale-95 disabled:opacity-50"
          style={{
            touchAction: "none",
            background: armed ? "rgba(255,255,255,0.06)" : ACCENT,
            color: armed ? ACCENT : "#0b0510",
            border: armed ? `2px solid ${ACCENT}` : "none",
            boxShadow: armed ? "none" : `0 6px 0 0 #7e22ce`,
          }}
        >
          <span aria-hidden="true">{armed ? "🟢" : "🛡️"}</span>
          <span aria-hidden="true">{armed ? "ARMED" : "ARM"}</span>
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

      {/* win celebration */}
      {won && (
        <div className="pointer-events-none flex justify-center gap-2 text-2xl">
          <span style={{ animation: "g3piralarmlogic-float 1.4s ease-in-out infinite" }} aria-hidden="true">
            ✨
          </span>
          <span
            style={{ animation: "g3piralarmlogic-float 1.4s ease-in-out infinite", animationDelay: "0.2s" }}
            aria-hidden="true"
          >
            🎉
          </span>
          <span
            style={{ animation: "g3piralarmlogic-float 1.4s ease-in-out infinite", animationDelay: "0.4s" }}
            aria-hidden="true"
          >
            ✨
          </span>
        </div>
      )}
    </div>
  );
}

const KEYFRAMES = `
@keyframes g3piralarmlogic-flash {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
@keyframes g3piralarmlogic-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}
@keyframes g3piralarmlogic-ring {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-12deg); }
  75% { transform: rotate(12deg); }
}
@keyframes g3piralarmlogic-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
@media (prefers-reduced-motion: reduce) {
  [style*="animation"] { animation: none !important; }
}
`;
