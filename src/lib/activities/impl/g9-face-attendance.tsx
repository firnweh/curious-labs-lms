"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

/* ── Face Match Attendance 🪪 ──────────────────────────────────────────────────
   GRADE 9 (innovator, age ~13–15). Subject: ai.
   ONE learning goal: Face recognition turns a face into a FEATURE SIGNATURE,
   measures its DISTANCE to the closest stored signature, and a CONFIDENCE
   THRESHOLD (plus capture conditions like low light or a mask) decides accept
   vs reject — and that threshold choice has fairness consequences.

   The learner tunes a confidence threshold slider, then runs a fixed 8-face
   queue through the matcher. Each face carries a deterministic distance-to-best
   and a condition tag that nudges the distance. Distance < threshold ⇒ admitted
   and INSERTed into a live attendance table with a timestamp; otherwise rejected.
   An anti-spoofing rule flags any name logged twice within 5 simulated minutes.
   WIN: every genuine student admitted, the impostor and the masked stranger
   rejected, and the double-tap duplicate flagged. A window of valid thresholds
   always exists for these scripted distances, so it is solvable. If the
   low-light genuine student is wrongly rejected, a Gender-Shades-style fairness
   callout appears that the learner must acknowledge before finishing.
   ──────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#a855f7";
const GREEN = "#34d399";
const DANGER = "#f87171";
const AMBER = "#fbbf24";

type Condition = "good" | "side" | "glasses" | "lowlight" | "mask";

interface CondInfo {
  label: string;
  /** Distance penalty this capture condition adds. */
  penalty: number;
}

const COND: Record<Condition, CondInfo> = {
  good: { label: "good light", penalty: 0 },
  side: { label: "side angle", penalty: 4 },
  glasses: { label: "glasses", penalty: 3 },
  lowlight: { label: "low light", penalty: 6 },
  mask: { label: "mask", penalty: 22 },
};

interface Enrolled {
  name: string;
  face: string;
  /** Darker-skin enrollee — fairness callout watches captures of this person. */
  darker: boolean;
}

/** The 5 enrolled students with their stored signatures (the database). */
const DB: readonly Enrolled[] = [
  { name: "Aria", face: "👩🏻", darker: false },
  { name: "Ben", face: "👦🏼", darker: false },
  { name: "Chidi", face: "🧑🏿", darker: true },
  { name: "Devi", face: "👩🏽", darker: false },
  { name: "Eli", face: "🧑🏻", darker: false },
] as const;

interface Capture {
  id: number;
  face: string;
  /** Who the model's nearest stored signature belongs to ("" = no enrollee). */
  claim: string;
  /** Base distance to that nearest signature, before the condition penalty. */
  base: number;
  cond: Condition;
  /** True identity is a genuinely enrolled student (should be admitted). */
  genuine: boolean;
  /** Minute on the simulated class clock when this face reached the camera. */
  minute: number;
}

/**
 * The fixed 8-face queue. Effective distance = base + condition penalty.
 * Genuine students top out at 13 (Chidi in low light: 7+6). The impostor and
 * the masked stranger never drop below 24. So ANY threshold in (13, 24] admits
 * every real student and rejects both frauds — the solvable window.
 * Devi appears twice at minute 2 and minute 4 → duplicate within 5 minutes.
 */
const QUEUE: readonly Capture[] = [
  { id: 1, face: "👩🏻", claim: "Aria", base: 3, cond: "good", genuine: true, minute: 1 },
  { id: 2, face: "👦🏼", claim: "Ben", base: 5, cond: "glasses", genuine: true, minute: 2 },
  { id: 3, face: "👩🏽", claim: "Devi", base: 4, cond: "good", genuine: true, minute: 2 },
  { id: 4, face: "🧑🏿", claim: "Chidi", base: 7, cond: "lowlight", genuine: true, minute: 3 },
  { id: 5, face: "🥸", claim: "Aria", base: 26, cond: "good", genuine: false, minute: 3 },
  { id: 6, face: "👩🏽", claim: "Devi", base: 4, cond: "side", genuine: true, minute: 4 },
  { id: 7, face: "😷", claim: "Ben", base: 9, cond: "mask", genuine: false, minute: 4 },
  { id: 8, face: "🧑🏻", claim: "Eli", base: 6, cond: "good", genuine: true, minute: 5 },
] as const;

function dist(c: Capture): number {
  return c.base + COND[c.cond].penalty;
}

/** A processed row written into the live attendance log. */
interface LogRow {
  id: number;
  name: string;
  face: string;
  minute: number;
  admitted: boolean;
  duplicate: boolean;
  d: number;
  threshold: number;
}

function clock(minute: number): string {
  const mm = String(minute).padStart(2, "0");
  return `09:${mm}`;
}

const MIN_T = 6;
const MAX_T = 30;
const START_T = 30; // starts wide-open: lets the impostor & masked stranger in

export default function FaceMatchAttendance({ onComplete }: ActivityProps) {
  const [threshold, setThreshold] = useState<number>(START_T);
  const [log, setLog] = useState<LogRow[]>([]);
  const [ran, setRan] = useState<boolean>(false);
  const [solved, setSolved] = useState<boolean>(false);
  const [fairnessOpen, setFairnessOpen] = useState<boolean>(false);
  const [fairnessAck, setFairnessAck] = useState<boolean>(false);
  const [status, setStatus] = useState<string>(
    "Set a confidence threshold, then run the camera queue.",
  );
  const firedRef = useRef<boolean>(false);

  /** Run the whole queue through the matcher at the current threshold. */
  const result = useMemo(() => {
    const rows: LogRow[] = [];
    const seen: { name: string; minute: number }[] = [];
    for (const c of QUEUE) {
      const d = dist(c);
      const admitted = d < threshold;
      let duplicate = false;
      if (admitted) {
        duplicate = seen.some(
          (s) => s.name === c.claim && Math.abs(s.minute - c.minute) <= 5,
        );
        seen.push({ name: c.claim, minute: c.minute });
      }
      rows.push({
        id: c.id,
        name: c.claim,
        face: c.face,
        minute: c.minute,
        admitted,
        duplicate,
        d,
        threshold,
      });
    }
    // Grade: every genuine admitted, every fraud rejected, the duplicate flagged.
    let allGenuineIn = true;
    let allFraudOut = true;
    let dupFlagged = false;
    let darkerRejected = false;
    rows.forEach((r, i) => {
      const c = QUEUE[i];
      if (c.genuine && !r.admitted) {
        allGenuineIn = false;
        if (DB.find((e) => e.name === c.claim)?.darker) darkerRejected = true;
      }
      if (!c.genuine && r.admitted) allFraudOut = false;
      if (r.duplicate) dupFlagged = true;
    });
    const win = allGenuineIn && allFraudOut && dupFlagged;
    return { rows, win, allGenuineIn, allFraudOut, dupFlagged, darkerRejected };
  }, [threshold]);

  const presentCount = useMemo(
    () => result.rows.filter((r) => r.admitted).length,
    [result],
  );

  const finish = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    setSolved(true);
    setStatus("Attendance verified — secure and fair. ✨");
    onComplete({
      passed: true,
      stars: 3,
      detail: `Threshold ${threshold}: all students admitted, frauds rejected, duplicate flagged.`,
    });
  }, [onComplete, threshold]);

  const run = useCallback(() => {
    if (solved) return;
    setRan(true);
    setLog(result.rows);

    if (result.win) {
      // The fairness reflection is required ONLY when the low-light darker-skin
      // capture was the thing that was failing — here it passed, so finish.
      finish();
      return;
    }

    // A darker-skin genuine student rejected → raise the Gender-Shades callout.
    if (result.darkerRejected && !fairnessAck) {
      setFairnessOpen(true);
      setStatus("A real student was rejected in low light. Look closer ↓");
      onComplete({
        passed: false,
        detail: "Low-light bias rejected a genuine student — read the fairness note.",
      });
      return;
    }

    // Friendly, specific, never-scolding nudges.
    let nudge: string;
    if (!result.allFraudOut) {
      nudge =
        "A fraud slipped through — lower the threshold so far-away faces are turned away.";
    } else if (!result.allGenuineIn) {
      nudge =
        "A real student was turned away — raise the threshold to forgive small differences.";
    } else {
      nudge =
        "Frauds and students are sorted — but a double-entry needs catching. Keep going.";
    }
    setStatus(nudge);
    onComplete({ passed: false, detail: nudge });
  }, [solved, result, finish, fairnessAck, onComplete]);

  const acknowledge = useCallback(() => {
    setFairnessAck(true);
    setFairnessOpen(false);
    setStatus("Noted. Now raise the threshold so low-light captures still match.");
  }, []);

  const reset = useCallback(() => {
    setThreshold(START_T);
    setLog([]);
    setRan(false);
    setSolved(false);
    setFairnessOpen(false);
    setFairnessAck(false);
    setStatus("Set a confidence threshold, then run the camera queue.");
    firedRef.current = false;
  }, []);

  const onSlide = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (solved) return;
      setThreshold(Number(e.target.value));
      setRan(false);
      setLog([]);
      setStatus("Threshold changed — run the queue to see who's admitted.");
    },
    [solved],
  );

  const glow = solved;

  return (
    <div
      className="mx-auto flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink"
      style={{ touchAction: "manipulation" }}
    >
      <style>{`
        @keyframes g9faceattendance-pop {
          0% { transform: scale(0.7); opacity: 0; }
          60% { transform: scale(1.08); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g9faceattendance-scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes g9faceattendance-flash {
          0%, 100% { box-shadow: 0 0 0 1px ${ACCENT}; }
          50% { box-shadow: 0 0 18px -2px ${ACCENT}; }
        }
      `}</style>

      {/* Camera feed + database */}
      <div
        className="panel relative overflow-hidden rounded-xl p-3"
        style={glow ? { boxShadow: `0 0 0 1px ${ACCENT}, 0 0 24px -4px ${ACCENT}` } : undefined}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: ACCENT }}>
            🪪 Face Match Attendance
          </span>
          <span className="text-[10px] text-ink-faint">{DB.length} enrolled</span>
        </div>

        {/* Enrolled database */}
        <div className="mb-3 grid grid-cols-5 gap-1">
          {DB.map((e) => (
            <div
              key={e.name}
              className="flex flex-col items-center rounded-lg border border-line bg-panel/60 py-1.5"
              title={`${e.name} — stored signature`}
            >
              <span className="text-xl leading-none" aria-hidden="true">
                {e.face}
              </span>
              <span className="mt-0.5 text-[9px] text-ink-dim">{e.name}</span>
            </div>
          ))}
        </div>

        {/* Capture strip — each face with its distance + condition tag */}
        <div className="relative overflow-hidden rounded-lg border border-line bg-black/30 p-2">
          {ran && !solved && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-1/3"
              style={{
                background: `linear-gradient(180deg, transparent, ${ACCENT}55, transparent)`,
                animation: "g9faceattendance-scan 1.4s linear infinite",
              }}
            />
          )}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {QUEUE.map((c) => {
              const d = dist(c);
              const admitted = ran ? d < threshold : null;
              const border =
                admitted === null
                  ? "var(--color-line, #27314f)"
                  : admitted
                    ? GREEN
                    : DANGER;
              return (
                <div
                  key={c.id}
                  className="flex w-[58px] shrink-0 flex-col items-center rounded-md border bg-panel/50 px-1 py-1"
                  style={{ borderColor: border }}
                >
                  <span className="text-lg leading-none" aria-hidden="true">
                    {c.face}
                  </span>
                  <span className="mt-0.5 text-[8px] text-ink-faint">
                    {COND[c.cond].label}
                  </span>
                  <span
                    className="text-[9px] font-semibold tabular-nums"
                    style={{ color: d < threshold ? GREEN : AMBER }}
                  >
                    d={d}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div
          className="mt-2 rounded-md px-2 py-1 text-center text-[11px]"
          role="status"
          aria-live="polite"
          style={{
            color: glow ? "#0b0612" : "#c4b5fd",
            background: glow ? ACCENT : "rgba(168,85,247,0.10)",
          }}
        >
          {status}
        </div>
      </div>

      {/* Threshold slider */}
      <div className="panel flex flex-col gap-2 rounded-xl p-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="flex items-center justify-between">
            <span className="text-ink-dim">
              Confidence threshold{" "}
              <span className="text-ink-faint">· admit if distance &lt; T</span>
            </span>
            <span className="font-semibold tabular-nums" style={{ color: ACCENT }}>
              T = {threshold}
            </span>
          </span>
          <input
            type="range"
            min={MIN_T}
            max={MAX_T}
            step={1}
            value={threshold}
            onChange={onSlide}
            disabled={solved}
            aria-label={`Confidence threshold, current value ${threshold}`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2"
            style={{ accentColor: ACCENT, touchAction: "none" }}
          />
          <span className="flex justify-between text-[9px] text-ink-faint">
            <span>strict ({MIN_T})</span>
            <span>loose ({MAX_T})</span>
          </span>
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={run}
            disabled={solved}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ background: ACCENT, color: "#0b0612" }}
            aria-label="Run the camera queue at the current threshold"
          >
            {solved ? "Verified ✓" : ran ? "Re-run queue" : "Run queue ▶"}
          </button>
          <button
            type="button"
            onClick={reset}
            onPointerDown={(e) => e.stopPropagation()}
            className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-xs font-medium text-ink-dim"
            aria-label="Reset the threshold and attendance log"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Gender-Shades fairness callout */}
      {fairnessOpen && (
        <div
          className="rounded-xl border p-3 text-xs"
          role="alertdialog"
          aria-label="Fairness warning about low-light recognition"
          style={{
            borderColor: AMBER,
            background: "rgba(251,191,36,0.08)",
            animation: "g9faceattendance-pop 240ms ease-out",
          }}
        >
          <p className="mb-1 font-semibold" style={{ color: AMBER }}>
            ⚖️ Fairness check
          </p>
          <p className="leading-snug text-ink-dim">
            Your threshold rejected <b>Chidi</b>, a real student, only because the
            low-light capture pushed the distance up. Real face systems have been
            shown to fail more often on darker skin and poor lighting (the
            “Gender Shades” finding). A threshold that locks out genuine people is
            a bias problem, not just a number.
          </p>
          <button
            type="button"
            onClick={acknowledge}
            onPointerDown={(e) => e.stopPropagation()}
            className="mt-2 w-full rounded-lg px-3 py-1.5 text-xs font-semibold"
            style={{ background: AMBER, color: "#0b0612" }}
            aria-label="Acknowledge the fairness note and continue"
          >
            I’ll tune fairly — got it
          </button>
        </div>
      )}

      {/* Live attendance table */}
      {log.length > 0 && (
        <div className="panel flex flex-col gap-1.5 rounded-xl p-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-ink-dim">Attendance log</span>
            <span className="text-ink-faint">
              present {presentCount} / {DB.length}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {log.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 rounded-md border px-2 py-1 text-[11px]"
                style={{
                  borderColor: r.admitted ? GREEN : DANGER,
                  background: r.admitted
                    ? "rgba(52,211,153,0.07)"
                    : "rgba(248,113,113,0.07)",
                  animation: "g9faceattendance-pop 220ms ease-out",
                }}
              >
                <span className="text-base leading-none" aria-hidden="true">
                  {r.face}
                </span>
                <span className="w-12 font-semibold text-ink">{r.name}</span>
                <span className="tabular-nums text-ink-faint">{clock(r.minute)}</span>
                <span className="tabular-nums text-ink-faint">
                  d={r.d}/T={r.threshold}
                </span>
                <span className="ml-auto flex items-center gap-1">
                  {r.duplicate && (
                    <span
                      className="rounded px-1 py-0.5 text-[8px] font-bold"
                      style={{ background: DANGER, color: "#0b0612" }}
                      aria-label="Duplicate entry flagged"
                    >
                      DUP
                    </span>
                  )}
                  <span
                    className="font-semibold"
                    style={{ color: r.admitted ? GREEN : DANGER }}
                  >
                    {r.admitted ? "present" : "rejected"}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Win celebration */}
      {solved && (
        <div
          className="rounded-xl border p-3 text-center"
          role="status"
          aria-label="Lab complete"
          style={{
            borderColor: ACCENT,
            background: "rgba(168,85,247,0.10)",
            animation: "g9faceattendance-flash 1.2s ease-in-out 2",
          }}
        >
          <p className="text-2xl" aria-hidden="true">
            ✨🎉
          </p>
          <p className="text-lg font-bold" style={{ color: ACCENT }}>
            ⭐⭐⭐
          </p>
          <p className="mt-1 text-[11px] leading-snug text-ink-dim">
            Every genuine student matched, the impostor and masked stranger turned
            away, and the duplicate tap flagged — a secure <i>and</i> fair threshold.
          </p>
        </div>
      )}
    </div>
  );
}
