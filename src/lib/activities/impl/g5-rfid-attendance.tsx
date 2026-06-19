"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

/* ── RFID Attendance Logger 🪪 ─────────────────────────────────────────────────
   GRADE 5 (explorer, age ~10–11). Subject: coding.
   ONE learning goal: An ID system LOOKS UP each card's unique code in a table,
   then RUNS ORDERED LOGIC — read the UID, find it in the table, and IF found
   welcome the matching name ELSE reject an unknown card. Both the lookup table
   AND the order of the logic blocks decide what gets logged.

   The learner (1) fills the lookup table by dragging name tags onto the right
   4-hex UID codes, and (2) orders 3 logic blocks: read → look up → if/else.
   Pressing "Class Arrives" taps 6 fixed cards on the pad (some registered, one
   unknown, with Asha tapping twice) and runs the learner's program per tap,
   stamping each line into the log. Win when the log exactly matches the goal
   attendance sheet. Fixed UIDs + a 3-block set keep it deterministic & winnable.
   ──────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#22d3ee";
const GREEN = "#34d399";
const DANGER = "#f87171";

type NameId = "asha" | "raj" | "meena";
type BlockId = "read" | "lookup" | "branch";

interface CardDef {
  uid: string; // unique 4-hex code, e.g. "7A3F"
  owner: NameId; // who this card really belongs to
}

/** Fixed card registry. Each UID maps to exactly one real owner. */
const CARDS: readonly CardDef[] = [
  { uid: "7A3F", owner: "asha" },
  { uid: "1C90", owner: "raj" },
  { uid: "B42E", owner: "meena" },
] as const;

const NAME_LABEL: Record<NameId, string> = {
  asha: "Asha",
  raj: "Raj",
  meena: "Meena",
};

/** One droppable row of the lookup table: a fixed UID + the dropped name. */
interface Row {
  uid: string;
  name: NameId | null;
}

const startRows = (): Row[] => CARDS.map((c) => ({ uid: c.uid, name: null }));

/** The 3 logic blocks, shown shuffled; the learner must order them. */
interface BlockDef {
  id: BlockId;
  label: string;
  glyph: string;
}

const BLOCKS: Record<BlockId, BlockDef> = {
  read: { id: "read", label: "Read UID from card", glyph: "📡" },
  lookup: { id: "lookup", label: "Look up UID in table", glyph: "🔎" },
  branch: { id: "branch", label: "IF found → welcome  ELSE → reject", glyph: "🔀" },
};

/** Correct program order. */
const CORRECT_ORDER: readonly BlockId[] = ["read", "lookup", "branch"] as const;

/** Start order is deliberately scrambled (lookup before read = the classic trap). */
const startBlocks = (): BlockId[] => ["lookup", "branch", "read"];

/** A scripted tap on the pad: which physical card touched, at what clock time. */
interface Tap {
  uid: string;
  time: string;
}

/** Deterministic "class arrives" sequence — Asha taps twice; one unknown card. */
const TAPS: readonly Tap[] = [
  { uid: "7A3F", time: "09:00" }, // Asha
  { uid: "1C90", time: "09:01" }, // Raj
  { uid: "FFFF", time: "09:02" }, // unknown card (not in registry)
  { uid: "B42E", time: "09:03" }, // Meena
  { uid: "7A3F", time: "09:05" }, // Asha again
] as const;

interface LogLine {
  ok: boolean; // green known card
  text: string;
}

/** Build the expected goal log from a perfectly-filled table + correct order. */
function expectedLog(): LogLine[] {
  return TAPS.map((t) => {
    const card = CARDS.find((c) => c.uid === t.uid);
    if (card) {
      return { ok: true, text: `${t.time}  WELCOME ${NAME_LABEL[card.owner]}` };
    }
    return { ok: false, text: `${t.time}  UNKNOWN CARD` };
  });
}

const GOAL_LOG: readonly LogLine[] = expectedLog();

type Drag = { id: NameId } | null;

export default function RfidAttendanceLogger({ onComplete }: ActivityProps) {
  const [rows, setRows] = useState<Row[]>(startRows);
  const [order, setOrder] = useState<BlockId[]>(startBlocks);
  const [drag, setDrag] = useState<Drag>(null);
  const [log, setLog] = useState<LogLine[] | null>(null);
  const [won, setWon] = useState<boolean>(false);
  const [hint, setHint] = useState<string>("");
  const reportedRef = useRef<boolean>(false);

  const orderCorrect = useMemo<boolean>(
    () => order.every((b, i) => b === CORRECT_ORDER[i]),
    [order],
  );

  /** Table is solved when every name sits on the UID it truly owns. */
  const tableCorrect = useMemo<boolean>(
    () =>
      rows.every((r) => {
        const card = CARDS.find((c) => c.uid === r.uid);
        return !!card && r.name === card.owner;
      }),
    [rows],
  );

  const tableFilled = useMemo<boolean>(
    () => rows.every((r) => r.name !== null),
    [rows],
  );

  const placed = useMemo<Set<NameId>>(() => {
    const s = new Set<NameId>();
    for (const r of rows) if (r.name) s.add(r.name);
    return s;
  }, [rows]);
  const trayNames = (Object.keys(NAME_LABEL) as NameId[]).filter(
    (n) => !placed.has(n),
  );

  /** Run the learner's CURRENT program over the tap sequence. Deterministic. */
  const runProgram = useCallback((): LogLine[] => {
    // The branch step must come AFTER read AND lookup, or the simulated chip
    // has no UID / no lookup result to act on — it errors out per tap.
    const readPos = order.indexOf("read");
    const lookupPos = order.indexOf("lookup");
    const branchPos = order.indexOf("branch");
    const sane = readPos < lookupPos && lookupPos < branchPos;

    return TAPS.map((t) => {
      if (!sane) {
        return { ok: false, text: `${t.time}  ERROR: ran logic out of order` };
      }
      // Look the tapped UID up in the LEARNER'S table (not the secret registry).
      const row = rows.find((r) => r.uid === t.uid);
      const name = row ? row.name : null;
      if (name) {
        return { ok: true, text: `${t.time}  WELCOME ${NAME_LABEL[name]}` };
      }
      return { ok: false, text: `${t.time}  UNKNOWN CARD` };
    });
  }, [order, rows]);

  const dropName = useCallback(
    (uid: string): void => {
      if (!drag || won) return;
      setRows((prev) => {
        const next = prev.map((r) =>
          r.name === drag.id ? { ...r, name: null } : r,
        );
        const i = next.findIndex((r) => r.uid === uid);
        if (i >= 0) next[i] = { ...next[i], name: drag.id };
        return next;
      });
      setDrag(null);
      setLog(null);
      setHint("");
    },
    [drag, won],
  );

  const clearName = useCallback(
    (uid: string): void => {
      if (won) return;
      setRows((prev) =>
        prev.map((r) => (r.uid === uid ? { ...r, name: null } : r)),
      );
      setLog(null);
      setHint("");
    },
    [won],
  );

  const pickName = useCallback(
    (id: NameId): void => {
      if (won) return;
      setDrag((cur) => (cur && cur.id === id ? null : { id }));
    },
    [won],
  );

  const moveBlock = useCallback(
    (i: number, dir: -1 | 1): void => {
      if (won) return;
      setOrder((prev) => {
        const j = i + dir;
        if (j < 0 || j >= prev.length) return prev;
        const next = [...prev];
        const tmp = next[i];
        next[i] = next[j];
        next[j] = tmp;
        return next;
      });
      setLog(null);
      setHint("");
    },
    [won],
  );

  const finishWin = useCallback(
    (final: LogLine[]): void => {
      setLog(final);
      setWon(true);
      setHint("");
      if (!reportedRef.current) {
        reportedRef.current = true;
        onComplete({
          passed: true,
          stars: 3,
          detail:
            "Every known card welcomed by name and the unknown card rejected — attendance complete! ✨",
        });
      }
    },
    [onComplete],
  );

  const runClass = useCallback((): void => {
    if (won) return;
    const result = runProgram();
    setLog(result);

    const match =
      result.length === GOAL_LOG.length &&
      result.every((l, i) => l.text === GOAL_LOG[i].text);

    if (match) {
      finishWin(result);
      return;
    }

    // Kind, targeted nudge — never the exact answer.
    let msg = "The log doesn't match the attendance sheet yet. Check each red line.";
    if (!orderCorrect) {
      msg =
        "Run the blocks in order: you must READ the card before you can LOOK IT UP, and decide only after both.";
    } else if (!tableFilled) {
      msg = "Give every UID a name tag before the class arrives.";
    } else if (!tableCorrect) {
      msg =
        "A name is on the wrong UID — match each tag to the code printed on that person's card.";
    }
    setHint(msg);
    onComplete({ passed: false, detail: msg });
  }, [
    won,
    runProgram,
    finishWin,
    orderCorrect,
    tableFilled,
    tableCorrect,
    onComplete,
  ]);

  const reset = useCallback((): void => {
    setRows(startRows());
    setOrder(startBlocks());
    setDrag(null);
    setLog(null);
    setWon(false);
    setHint("");
  }, []);

  const matchCount = useMemo<number>(() => {
    if (!log) return 0;
    return log.reduce(
      (n, l, i) => (l.text === GOAL_LOG[i].text ? n + 1 : n),
      0,
    );
  }, [log]);

  const status = useMemo<string>(() => {
    if (won) return "Attendance complete! Every card was logged correctly.";
    if (hint) return hint;
    if (!orderCorrect) return "Order the 3 logic blocks, then fill the lookup table.";
    if (!tableFilled) return "Drag each name tag onto its matching UID code.";
    if (log) return `${matchCount} of ${GOAL_LOG.length} log lines match the sheet.`;
    return "Table & logic look ready — press Class Arrives to scan the cards.";
  }, [won, hint, orderCorrect, tableFilled, log, matchCount]);

  return (
    <div className="flex w-full max-w-[440px] flex-col items-center gap-3 font-mono text-ink">
      {/* ── Status pill ── */}
      <div
        className="flex w-full items-center justify-center gap-2 rounded-full px-3 py-1.5 text-center text-sm"
        role="status"
        aria-live="polite"
        aria-label={status}
        style={{
          background: won ? "rgba(34,211,238,0.16)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${won ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: won ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true">🪪</span>
        {won ? (
          <span aria-hidden="true" className="text-lg">
            ⭐⭐⭐
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="text-[12px] leading-tight text-ink-dim"
          >
            match each card to a name, then log it
          </span>
        )}
        {won && <span aria-hidden="true">✨</span>}
      </div>

      {/* ── Reader terminal ── */}
      <div className="panel flex w-full flex-col items-center gap-1 rounded-xl p-2">
        <svg
          viewBox="0 0 200 70"
          className="block h-auto w-[170px]"
          role="img"
          aria-label="RFID card reader terminal with green known LED and red unknown LED"
        >
          <rect
            x="8"
            y="6"
            width="184"
            height="58"
            rx="8"
            fill="rgba(255,255,255,0.03)"
            stroke="var(--color-line, #33405c)"
            strokeWidth="1.5"
          />
          {/* scan pad */}
          <rect
            x="20"
            y="18"
            width="60"
            height="34"
            rx="6"
            fill="rgba(34,211,238,0.08)"
            stroke={ACCENT}
            strokeWidth="1.5"
            style={{
              animation: !won && !log ? "g5rfidattendance-scan 1.6s ease-in-out infinite" : undefined,
            }}
          />
          <text x="50" y="39" fill={ACCENT} fontSize="9" textAnchor="middle">
            SCAN
          </text>
          {/* known LED (green) */}
          <circle
            cx="118"
            cy="26"
            r="6"
            fill={won ? GREEN : "rgba(52,211,153,0.18)"}
            stroke={GREEN}
            strokeWidth="1.2"
            style={{ filter: won ? `drop-shadow(0 0 4px ${GREEN})` : undefined }}
          />
          <text x="132" y="29" fill="var(--color-ink-faint, #7c8aa0)" fontSize="7">
            known
          </text>
          {/* unknown LED (red) */}
          <circle
            cx="118"
            cy="44"
            r="6"
            fill="rgba(248,113,113,0.18)"
            stroke={DANGER}
            strokeWidth="1.2"
          />
          <text x="132" y="47" fill="var(--color-ink-faint, #7c8aa0)" fontSize="7">
            unknown
          </text>
        </svg>
      </div>

      {/* ── Two panels: lookup table + logic blocks ── */}
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        {/* ---- LOOKUP TABLE ---- */}
        <div className="panel flex flex-1 flex-col gap-1.5 rounded-xl p-2">
          <span className="text-[10px] uppercase tracking-tech text-ink-faint">
            Lookup table — UID → name
          </span>
          {rows.map((r) => {
            const armed = !!drag && !won && !r.name;
            return (
              <div
                key={r.uid}
                className="flex items-center justify-between gap-2 rounded-lg border p-1.5 text-[11px]"
                style={{
                  borderColor: r.name ? ACCENT : "var(--color-line, #33405c)",
                  background: r.name
                    ? "rgba(34,211,238,0.08)"
                    : "rgba(255,255,255,0.02)",
                }}
              >
                <span
                  className="rounded bg-black/30 px-1.5 py-0.5 tracking-widest text-ink-dim"
                  aria-label={`Card UID ${r.uid.split("").join(" ")}`}
                >
                  {r.uid}
                </span>
                <span aria-hidden="true" className="text-ink-faint">
                  →
                </span>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    if (won) return;
                    if (r.name) clearName(r.uid);
                    else dropName(r.uid);
                  }}
                  aria-label={
                    r.name
                      ? `UID ${r.uid} is assigned to ${NAME_LABEL[r.name]}. Tap to remove.`
                      : `Empty name slot for UID ${r.uid}`
                  }
                  className="flex-1 rounded border px-2 py-0.5 text-center transition"
                  style={{
                    borderColor: r.name || armed ? ACCENT : "var(--color-line, #33405c)",
                    borderStyle: r.name ? "solid" : "dashed",
                    background: r.name
                      ? "rgba(34,211,238,0.16)"
                      : "rgba(255,255,255,0.02)",
                    color: r.name ? ACCENT : "var(--color-ink-faint, #7c8aa0)",
                    animation:
                      armed ? "g5rfidattendance-pulse 1s ease-in-out infinite" : undefined,
                    touchAction: "none",
                  }}
                >
                  {r.name ? NAME_LABEL[r.name] : armed ? "drop" : "[ ? ]"}
                </button>
              </div>
            );
          })}

          {/* name tag tray */}
          <span className="mt-1 text-[10px] uppercase tracking-tech text-ink-faint">
            Name tags
          </span>
          <div className="flex flex-wrap gap-1.5" style={{ touchAction: "none" }}>
            {trayNames.length === 0 ? (
              <span className="text-[11px] text-ink-faint">all placed ✓</span>
            ) : (
              trayNames.map((n) => {
                const active = !!drag && drag.id === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      pickName(n);
                    }}
                    disabled={won}
                    aria-pressed={active}
                    aria-label={`Name tag: ${NAME_LABEL[n]}${active ? ", selected" : ""}`}
                    className="rounded-full border px-2.5 py-1 text-[11px] transition active:scale-95 disabled:opacity-40"
                    style={{
                      borderColor: active ? ACCENT : "var(--color-line, #33405c)",
                      background: active
                        ? "rgba(34,211,238,0.2)"
                        : "rgba(255,255,255,0.04)",
                      color: active ? ACCENT : "var(--color-ink-dim, #9aa6b2)",
                      touchAction: "none",
                    }}
                  >
                    🏷️ {NAME_LABEL[n]}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ---- LOGIC BLOCKS ---- */}
        <div className="panel flex flex-1 flex-col gap-1.5 rounded-xl p-2">
          <span className="text-[10px] uppercase tracking-tech text-ink-faint">
            Logic — runs top → down
          </span>
          {order.map((id, i) => {
            const b = BLOCKS[id];
            const inPlace = id === CORRECT_ORDER[i];
            return (
              <div
                key={id}
                className="flex items-start justify-between gap-1 rounded-lg border p-1.5 text-[11px] transition"
                style={{
                  borderColor:
                    log && orderCorrect && inPlace
                      ? ACCENT
                      : "var(--color-line, #33405c)",
                  background:
                    log && orderCorrect && inPlace
                      ? "rgba(34,211,238,0.08)"
                      : "rgba(255,255,255,0.02)",
                }}
              >
                <span className="flex items-start gap-1">
                  <span aria-hidden="true">{b.glyph}</span>
                  <span className="text-ink-dim leading-tight">
                    <span className="text-ink-faint">{i + 1}. </span>
                    {b.label}
                  </span>
                </span>
                {!won && (
                  <span className="flex shrink-0 gap-0.5">
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        moveBlock(i, -1);
                      }}
                      disabled={i === 0}
                      aria-label={`Move "${b.label}" up`}
                      className="grid h-5 w-5 place-items-center rounded text-ink-dim transition active:scale-90 disabled:opacity-25"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        touchAction: "none",
                      }}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        moveBlock(i, 1);
                      }}
                      disabled={i >= order.length - 1}
                      aria-label={`Move "${b.label}" down`}
                      className="grid h-5 w-5 place-items-center rounded text-ink-dim transition active:scale-90 disabled:opacity-25"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        touchAction: "none",
                      }}
                    >
                      ▼
                    </button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Attendance log + goal sheet ── */}
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <div className="panel flex flex-1 flex-col gap-1 rounded-xl p-2">
          <span className="text-[10px] uppercase tracking-tech text-ink-faint">
            Attendance log
          </span>
          <div
            className="flex flex-col gap-1 overflow-y-auto rounded-lg p-1.5"
            style={{ minHeight: 110, maxHeight: 150, background: "rgba(0,0,0,0.22)" }}
            aria-label="Attendance log output"
          >
            {!log ? (
              <span className="m-auto text-center text-[11px] text-ink-faint">
                Press Class Arrives to scan {TAPS.length} cards.
              </span>
            ) : (
              log.map((l, i) => {
                const right = l.text === GOAL_LOG[i].text;
                return (
                  <span
                    key={i}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]"
                    style={{
                      background: right
                        ? "rgba(52,211,153,0.12)"
                        : "rgba(248,113,113,0.14)",
                      color: l.ok ? GREEN : DANGER,
                    }}
                  >
                    <span aria-hidden="true">{right ? "✓" : "✗"}</span>
                    <span className="truncate">{l.text}</span>
                  </span>
                );
              })
            )}
          </div>
        </div>

        <div className="panel flex flex-1 flex-col gap-1 rounded-xl p-2">
          <span className="text-[10px] uppercase tracking-tech text-ink-faint">
            Goal sheet
          </span>
          <div
            className="flex flex-col gap-1 rounded-lg p-1.5"
            style={{ minHeight: 110, background: "rgba(0,0,0,0.12)" }}
          >
            {GOAL_LOG.map((l, i) => (
              <span
                key={i}
                className="truncate rounded px-1.5 py-0.5 text-[11px] text-ink-dim"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  borderLeft: `2px solid ${l.ok ? GREEN : DANGER}`,
                }}
              >
                {l.text}
              </span>
            ))}
          </div>
        </div>
      </div>

      {won && (
        <span
          className="flex items-center gap-1 self-center rounded-full px-3 py-1 text-[11px] font-bold"
          style={{
            background: "rgba(52,211,153,0.18)",
            color: GREEN,
            boxShadow: `0 0 12px ${GREEN}55`,
          }}
        >
          <span aria-hidden="true">✅</span> Attendance complete
        </span>
      )}

      {/* coaching / status line (never the exact answer) */}
      <p
        className="min-h-[28px] w-full text-center text-[11px] leading-tight"
        aria-hidden="true"
        style={{
          color: hint ? DANGER : won ? ACCENT : "var(--color-ink-faint, #7c8aa0)",
        }}
      >
        {status}
      </p>

      {/* ── Controls: Class Arrives · Reset ── */}
      <div className="flex w-full items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            runClass();
          }}
          disabled={won}
          aria-label="Class Arrives — scan all cards and run your logger"
          className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-2xl text-base font-bold transition active:scale-95 disabled:opacity-40"
          style={{
            touchAction: "none",
            background: ACCENT,
            color: "#053040",
            boxShadow: "0 5px 0 0 #0e7490",
          }}
        >
          <span aria-hidden="true">🪪</span>
          <span aria-hidden="true" className="font-extrabold tracking-wide">
            CLASS ARRIVES
          </span>
        </button>
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            reset();
          }}
          aria-label="Reset the logger"
          className="grid h-[50px] w-[50px] place-items-center rounded-2xl text-xl transition active:scale-90"
          style={{
            touchAction: "none",
            background: "rgba(255,255,255,0.05)",
            border: "2px solid var(--color-line, #33405c)",
          }}
        >
          <span aria-hidden="true">🔄</span>
        </button>
      </div>

      {/* celebratory floaters */}
      {won && (
        <div
          className="pointer-events-none flex justify-center gap-2 text-2xl"
          aria-hidden="true"
        >
          <span style={{ animation: "g5rfidattendance-float 1.4s ease-in-out infinite" }}>
            ✨
          </span>
          <span
            style={{
              animation: "g5rfidattendance-float 1.4s ease-in-out infinite",
              animationDelay: "0.2s",
            }}
          >
            🎉
          </span>
          <span
            style={{
              animation: "g5rfidattendance-float 1.4s ease-in-out infinite",
              animationDelay: "0.4s",
            }}
          >
            ✨
          </span>
        </div>
      )}

      <style>{`
        @keyframes g5rfidattendance-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes g5rfidattendance-scan {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        @keyframes g5rfidattendance-float {
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
