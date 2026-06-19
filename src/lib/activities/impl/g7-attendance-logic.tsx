"use client";
import type { ActivityProps } from "@/lib/activities/types";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Smart Attendance Logger — logging a face correctly is CONDITIONAL  */
/*  logic in the right ORDER: detect, check the confidence threshold,  */
/*  then check it isn't a duplicate for the day, and only THEN append  */
/*  the row. Reorder the snap-together blocks so the camera queue      */
/*  streams into exactly the right 3 CSV rows.                         */
/* ------------------------------------------------------------------ */

const ACCENT = "#22d3ee";

/** A logic block the learner orders into a pipeline. */
type BlockId = "detect" | "threshold" | "dedup" | "append" | "skip";

interface Block {
  id: BlockId;
  /** Code-ish label shown on the block. */
  label: string;
  /** Tiny sub-line explaining the block. */
  sub: string;
  emoji: string;
}

const BLOCKS: Record<BlockId, Block> = {
  detect: { id: "detect", label: "detect_face()", sub: "read name + confidence", emoji: "📷" },
  threshold: { id: "threshold", label: "if conf > T", sub: "confidence threshold", emoji: "🎯" },
  dedup: { id: "dedup", label: "if not marked_today", sub: "no duplicate per day", emoji: "🗓️" },
  append: { id: "append", label: "append_row()", sub: "write name,date,time", emoji: "💾" },
  skip: { id: "skip", label: "else skip", sub: "reject this event", emoji: "🚫" },
};

/** The one correct pipeline order. */
const SOLUTION: readonly BlockId[] = ["detect", "threshold", "dedup", "append", "skip"];

/**
 * A scrambled starting order — genuinely WRONG: append sits before both gates,
 * so every detected face logs (duplicates + unknowns leak). The learner must
 * drag append down past the threshold and dedup checks. Always re-orderable.
 */
const START_ORDER: readonly BlockId[] = ["detect", "append", "threshold", "dedup", "skip"];

/** The required threshold value (the editable block must equal this). */
const TARGET_THRESHOLD = 60;

interface Event {
  name: string;
  conf: number;
  /** Whether this is a recognised student (Unknown faces never match a name). */
  known: boolean;
}

/**
 * A fixed camera queue. Streamed deterministically through the pipeline:
 *   Aanya@88   -> append (first, confident)
 *   Unknown@40 -> reject (below threshold)
 *   Aanya@91   -> reject (duplicate for the day)
 *   Rohan@72   -> append (first, confident)
 *   Vikram@81  -> append (first, confident)
 *   Maya@55    -> reject (below threshold) — a distinct name, so only the
 *                threshold gate can stop it (dedup never sees a Maya before).
 * Correct CSV = Aanya, Rohan, Vikram  (exactly 3 rows).
 */
const QUEUE: readonly Event[] = [
  { name: "Aanya", conf: 88, known: true },
  { name: "Unknown", conf: 40, known: false },
  { name: "Aanya", conf: 91, known: true },
  { name: "Rohan", conf: 72, known: true },
  { name: "Vikram", conf: 81, known: true },
  { name: "Maya", conf: 55, known: true },
];

/** A logged CSV row. `wrong` marks rows the correct pipeline would NOT write. */
interface Row {
  name: string;
  conf: number;
  wrong: boolean;
}

const FIXED_DATE = "2026-09-14";
/** Deterministic clock — one tick per accepted row so times read sensibly. */
function rowTime(index: number): string {
  const mins = 0 + index * 2;
  const hh = String(9 + Math.floor(mins / 60)).padStart(2, "0");
  const mm = String(mins % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Run the learner's pipeline over the queue, deterministically.
 * The order of [threshold] vs [dedup] vs [append] vs [skip] decides behaviour:
 *  - threshold gate active only if "threshold" sits before "append".
 *  - dedup gate active only if "dedup" sits before "append".
 *  - "detect" must come before "append" for a name to exist at all.
 */
function runPipeline(order: readonly BlockId[], threshold: number): Row[] {
  const pos = (id: BlockId): number => order.indexOf(id);
  const appendAt = pos("append");
  const detectBeforeAppend = pos("detect") < appendAt;
  const thresholdActive = pos("threshold") < appendAt;
  const dedupActive = pos("dedup") < appendAt;

  const rows: Row[] = [];
  const markedToday = new Set<string>();

  for (const ev of QUEUE) {
    // Without detect ahead of append, the writer has no identity to write.
    if (!detectBeforeAppend) continue;

    // The threshold gate. Inactive => unknown/low-confidence faces slip through.
    if (thresholdActive && ev.conf <= threshold) continue;

    // The dedup gate. Inactive => the same student is logged repeatedly.
    if (dedupActive && markedToday.has(ev.name)) continue;

    markedToday.add(ev.name);
    // A row is "wrong" if the correct pipeline would never have written it:
    // an unknown face, a below-threshold face, or a duplicate name.
    const belowTarget = ev.conf <= TARGET_THRESHOLD;
    const wrong = !ev.known || belowTarget;
    rows.push({ name: ev.name, conf: ev.conf, wrong });
  }
  return rows;
}

/** The exact rows the correct pipeline produces — the grading target. */
const EXPECTED: readonly Row[] = runPipeline(SOLUTION, TARGET_THRESHOLD);

function rowsMatch(a: readonly Row[], b: readonly Row[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((r, i) => r.name === b[i].name && r.conf === b[i].conf);
}

export default function SmartAttendanceLogger({ onComplete }: ActivityProps) {
  const [order, setOrder] = useState<BlockId[]>([...START_ORDER]);
  const [threshold, setThreshold] = useState<number>(50);
  const [rows, setRows] = useState<Row[]>([]);
  const [ran, setRan] = useState<boolean>(false);
  const [streamIdx, setStreamIdx] = useState<number>(-1);
  const [solved, setSolved] = useState<boolean>(false);
  const [status, setStatus] = useState<string>(
    "Order the blocks, set the threshold, then press RUN.",
  );
  const firedRef = useRef<boolean>(false);
  const timerRef = useRef<number | null>(null);

  const move = useCallback(
    (index: number, dir: -1 | 1): void => {
      if (solved) return;
      setOrder((prev) => {
        const next = [...prev];
        const j = index + dir;
        if (j < 0 || j >= next.length) return prev;
        [next[index], next[j]] = [next[j], next[index]];
        return next;
      });
      setRan(false);
      setRows([]);
      setStatus("Pipeline changed — press RUN to test it.");
    },
    [solved],
  );

  const bumpThreshold = useCallback(
    (delta: number): void => {
      if (solved) return;
      setThreshold((t) => Math.max(0, Math.min(100, t + delta)));
      setRan(false);
      setRows([]);
      setStatus("Threshold changed — press RUN to test it.");
    },
    [solved],
  );

  const reset = useCallback((): void => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setOrder([...START_ORDER]);
    setThreshold(50);
    setRows([]);
    setRan(false);
    setStreamIdx(-1);
    setSolved(false);
    setStatus("Order the blocks, set the threshold, then press RUN.");
  }, []);

  const run = useCallback((): void => {
    if (solved) return;
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const finalRows = runPipeline(order, threshold);
    setRan(true);
    setRows([]);
    setStreamIdx(0);
    setStatus("Streaming the camera queue through your logic…");

    // Animate the queue one event at a time, then grade.
    let i = 0;
    timerRef.current = window.setInterval(() => {
      i += 1;
      if (i >= QUEUE.length) {
        if (timerRef.current !== null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setStreamIdx(-1);
        setRows(finalRows);

        const win = rowsMatch(finalRows, EXPECTED);
        if (win) {
          setSolved(true);
          setStatus("Clean log! Aanya, Rohan and Vikram — each once. ✨");
          if (!firedRef.current) {
            firedRef.current = true;
            onComplete({
              passed: true,
              stars: 3,
              detail: "Correct pipeline: threshold then dedup then append.",
            });
          }
        } else {
          const hasWrong = finalRows.some((r) => r.wrong);
          const dupes = finalRows.length > new Set(finalRows.map((r) => r.name)).size;
          const detail = dupes
            ? "Duplicates slipped in — check the dedup block."
            : hasWrong
              ? "A low-confidence face got logged — check the threshold."
              : finalRows.length < EXPECTED.length
                ? "Some valid students were skipped — check the block order."
                : "Not quite — re-order the blocks and run again.";
          setStatus(`${detail}`);
          onComplete({ passed: false, detail });
        }
        return;
      }
      setStreamIdx(i);
    }, 420);
  }, [order, threshold, solved, onComplete]);

  const thresholdOk = threshold === TARGET_THRESHOLD;
  const expectedNames = useMemo(() => EXPECTED.map((r) => r.name), []);

  // Diff: which logged rows are unexpected (highlighted red).
  const rowFlags = useMemo<boolean[]>(() => {
    return rows.map((r, i) => {
      const exp = EXPECTED[i];
      return !exp || exp.name !== r.name || r.wrong;
    });
  }, [rows]);

  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-col gap-3 text-ink">
      <style>{KEYFRAMES}</style>

      {/* Camera feed */}
      <div
        className="panel relative overflow-hidden rounded-xl p-3"
        style={solved ? glowStyle : undefined}
      >
        <div className="mb-2 flex items-center justify-between text-[11px] text-ink-faint">
          <span className="flex items-center gap-1">
            <span aria-hidden="true">📷</span> camera_feed.queue
          </span>
          <span>{FIXED_DATE}</span>
        </div>
        <div
          className="flex gap-1.5 overflow-x-auto pb-1"
          role="list"
          aria-label="Camera queue of six face events"
          style={{ touchAction: "pan-x" }}
        >
          {QUEUE.map((ev, i) => {
            const active = ran && streamIdx === i;
            const done = ran && streamIdx !== -1 && i < streamIdx;
            return (
              <div
                key={i}
                role="listitem"
                aria-label={`Event ${i + 1}: ${ev.name}, confidence ${ev.conf}`}
                className="flex min-w-[64px] flex-col items-center rounded-lg border px-2 py-1.5 text-center"
                style={{
                  borderColor: active ? ACCENT : "var(--color-line, #1e2a44)",
                  background: active ? "rgba(34,211,238,0.16)" : "rgba(11,16,32,0.6)",
                  opacity: done ? 0.4 : 1,
                  animation: active ? "g7attendancelogic-pulse 420ms ease" : undefined,
                }}
              >
                <span className="text-base" aria-hidden="true">
                  {ev.known ? "🙂" : "❓"}
                </span>
                <span className="text-[11px] font-medium leading-tight">{ev.name}</span>
                <span
                  className="font-mono text-[10px]"
                  style={{ color: ev.conf > threshold ? ACCENT : "#f87171" }}
                >
                  {ev.conf}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Threshold control */}
      <div className="panel flex items-center justify-between rounded-xl px-3 py-2">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-ink-dim">threshold T</span>
          <span className="text-[10px] text-ink-faint">log only if confidence &gt; T</span>
        </div>
        <div className="flex items-center gap-2" role="group" aria-label="Adjust confidence threshold">
          <StepBtn label="Decrease threshold" glyph="−" onClick={() => bumpThreshold(-5)} disabled={solved} />
          <span
            className="w-12 text-center font-mono text-lg tabular-nums"
            style={{ color: thresholdOk ? ACCENT : "#e6ecff" }}
            aria-live="polite"
            aria-label={`Threshold is ${threshold}`}
          >
            {threshold}
          </span>
          <StepBtn label="Increase threshold" glyph="+" onClick={() => bumpThreshold(5)} disabled={solved} />
        </div>
      </div>

      {/* Pipeline blocks */}
      <div className="panel flex flex-col gap-1.5 rounded-xl p-3">
        <span className="mb-0.5 text-[11px] text-ink-faint">pipeline (top → bottom)</span>
        {order.map((id, i) => {
          const b = BLOCKS[id];
          return (
            <div
              key={id}
              className="flex items-center gap-2 rounded-lg border px-2.5 py-2"
              style={{
                borderColor: "var(--color-line, #1e2a44)",
                background: "linear-gradient(180deg, rgba(17,24,47,0.9), rgba(11,16,32,0.9))",
              }}
            >
              <span className="font-mono text-[10px] text-ink-faint">{i + 1}</span>
              <span className="text-base" aria-hidden="true">
                {b.emoji}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-mono text-[13px]" style={{ color: ACCENT }}>
                  {b.label}
                </span>
                <span className="truncate text-[10px] text-ink-faint">{b.sub}</span>
              </span>
              <span className="flex flex-col gap-0.5">
                <ArrowBtn
                  label={`Move ${b.label} up`}
                  glyph="▲"
                  onClick={() => move(i, -1)}
                  disabled={solved || i === 0}
                />
                <ArrowBtn
                  label={`Move ${b.label} down`}
                  glyph="▼"
                  onClick={() => move(i, 1)}
                  disabled={solved || i === order.length - 1}
                />
              </span>
            </div>
          );
        })}
      </div>

      {/* CSV output */}
      <div className="panel rounded-xl p-3">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-ink-faint">
          <span className="flex items-center gap-1">
            <span aria-hidden="true">🗒️</span> attendance.csv
          </span>
          <span>
            {rows.length} / {EXPECTED.length} rows
          </span>
        </div>
        <div
          className="grid grid-cols-[1fr_auto_auto] gap-x-2 font-mono text-[12px]"
          role="table"
          aria-label="Attendance CSV output"
        >
          <span className="border-b border-line pb-1 text-ink-faint">name</span>
          <span className="border-b border-line pb-1 text-ink-faint">conf</span>
          <span className="border-b border-line pb-1 text-ink-faint">time</span>
          {rows.length === 0 && (
            <span className="col-span-3 py-3 text-center text-[11px] text-ink-faint">
              {ran ? "no rows logged" : "empty — press RUN"}
            </span>
          )}
          {rows.map((r, i) => {
            const bad = rowFlags[i];
            const style: CSSProperties = {
              color: bad ? "#f87171" : "#34d399",
              animation: "g7attendancelogic-slidein 280ms ease",
            };
            return (
              <span key={i} className="contents" role="row">
                <span className="py-0.5" style={style}>
                  {bad ? "⚠ " : "✓ "}
                  {r.name}
                </span>
                <span className="py-0.5 tabular-nums" style={style}>
                  {r.conf}
                </span>
                <span className="py-0.5 tabular-nums" style={style}>
                  {rowTime(i)}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Status + actions */}
      <div
        className="rounded-lg px-3 py-2 text-center text-xs"
        role="status"
        aria-live="polite"
        style={{
          background: solved ? ACCENT : "rgba(11,16,32,0.6)",
          color: solved ? "#05070d" : "#9aa6cf",
          border: solved ? "none" : "1px solid var(--color-line, #1e2a44)",
          fontWeight: solved ? 700 : 400,
        }}
      >
        {solved ? "✨🎉 Solved!  ⭐⭐⭐" : status}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onPointerDown={run}
          disabled={solved || (ran && streamIdx !== -1)}
          className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          style={{ background: ACCENT, color: "#05070d", touchAction: "manipulation" }}
          aria-label="Run the pipeline over the camera queue"
        >
          {solved ? "Logged ✓" : streamIdx !== -1 ? "Running…" : "▶ RUN"}
        </button>
        <button
          type="button"
          onPointerDown={reset}
          className="rounded-lg border border-line bg-panel/60 px-4 py-2.5 text-sm font-medium text-ink-dim"
          aria-label="Reset the pipeline and CSV"
          style={{ touchAction: "manipulation" }}
        >
          Reset
        </button>
      </div>

      <p className="text-center text-[11px] leading-tight text-ink-faint">
        Goal: log {expectedNames.join(", ")} — each exactly once. Reject the unknown
        and below-threshold faces, and never log a duplicate for the day.
      </p>
    </div>
  );
}

const glowStyle: CSSProperties = {
  boxShadow: `0 0 0 1px ${ACCENT}, 0 0 26px -6px ${ACCENT}`,
};

function StepBtn({
  label,
  glyph,
  onClick,
  disabled,
}: {
  label: string;
  glyph: string;
  onClick: () => void;
  disabled: boolean;
}): ReactNode {
  return (
    <button
      type="button"
      onPointerDown={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-lg text-base font-bold disabled:opacity-40"
      style={{
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "var(--color-line, #1e2a44)",
        background: "rgba(11,16,32,0.6)",
        color: "#cbd3ef",
        touchAction: "manipulation",
      }}
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  );
}

function ArrowBtn({
  label,
  glyph,
  onClick,
  disabled,
}: {
  label: string;
  glyph: string;
  onClick: () => void;
  disabled: boolean;
}): ReactNode {
  return (
    <button
      type="button"
      onPointerDown={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-5 w-6 place-items-center rounded text-[10px] disabled:opacity-30"
      style={{
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "var(--color-line, #1e2a44)",
        background: "rgba(11,16,32,0.6)",
        color: "#cbd3ef",
        touchAction: "manipulation",
      }}
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  );
}

const KEYFRAMES = `
@keyframes g7attendancelogic-pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.08); }
  100% { transform: scale(1); }
}
@keyframes g7attendancelogic-slidein {
  0% { opacity: 0; transform: translateX(-6px); }
  100% { opacity: 1; transform: translateX(0); }
}
`;
