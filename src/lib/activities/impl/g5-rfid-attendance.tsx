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
   4-hex UID codes, and (2) orders the logic blocks: read → look up → if/else.
   Pressing "Class Arrives" taps fixed cards on the pad and runs the learner's
   program per tap, stamping each line into the log. Win a round when the log
   exactly matches the goal attendance sheet.

   TWO ROUNDS, escalating:
   • Round 1 — three students, one unknown card, Asha taps twice. The 3 logic
     blocks start scrambled (lookup before read = the classic trap).
   • Round 2 — the GUESS-DEFEATING twist: FOUR students, but Raj's card was
     REVOKED (lost card / blocked list). Raj IS in the lookup table, yet the
     logger must REJECT him. That forces a NEW logic block — "IF on blocked
     list → reject" — which must be slotted in the right place (after read &
     lookup, BEFORE the welcome/else branch). Pattern-matching round 1 fails:
     a card that's "known" must now be turned away. Fresh UIDs + table too.

   Fixed UIDs & a fixed block set per round keep everything deterministic and
   always winnable. Order the blocks correctly in each round → 3 stars.
   ──────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#22d3ee";
const GREEN = "#34d399";
const DANGER = "#f87171";
const AMBER = "#fbbf24";

type NameId = "asha" | "raj" | "meena" | "dev";
type BlockId = "read" | "lookup" | "blocked" | "branch";

interface CardDef {
  uid: string; // unique 4-hex code, e.g. "7A3F"
  owner: NameId; // who this card really belongs to
}

const NAME_LABEL: Record<NameId, string> = {
  asha: "Asha",
  raj: "Raj",
  meena: "Meena",
  dev: "Dev",
};

/** The full set of logic blocks. Only some are used in a given round. */
interface BlockDef {
  id: BlockId;
  label: string;
  glyph: string;
}

const BLOCKS: Record<BlockId, BlockDef> = {
  read: { id: "read", label: "Read UID from card", glyph: "📡" },
  lookup: { id: "lookup", label: "Look up UID in table", glyph: "🔎" },
  blocked: { id: "blocked", label: "IF on blocked list → reject", glyph: "⛔" },
  branch: { id: "branch", label: "IF found → welcome  ELSE → reject", glyph: "🔀" },
};

/** A scripted tap on the pad: which physical card touched, at what clock time. */
interface Tap {
  uid: string;
  time: string;
}

/** A whole round's puzzle definition. Everything here is fixed → deterministic. */
interface RoundDef {
  title: string;
  intro: string;
  cards: readonly CardDef[];
  /** Names the learner must place (matches cards' owners). */
  names: readonly NameId[];
  /** Block ids used this round + their CORRECT order, top → down. */
  correctOrder: readonly BlockId[];
  /** The scrambled order the learner starts with. */
  startOrder: readonly BlockId[];
  /** UIDs whose owner is on the blocked list — known, but must be REJECTED. */
  blocklist: readonly string[];
  taps: readonly Tap[];
}

const ROUNDS: readonly RoundDef[] = [
  {
    title: "Round 1 · Morning roll-call",
    intro: "Three students. One unknown card sneaks in. Asha taps twice.",
    cards: [
      { uid: "7A3F", owner: "asha" },
      { uid: "1C90", owner: "raj" },
      { uid: "B42E", owner: "meena" },
    ],
    names: ["asha", "raj", "meena"],
    correctOrder: ["read", "lookup", "branch"],
    // lookup before read = the classic trap
    startOrder: ["lookup", "branch", "read"],
    blocklist: [],
    taps: [
      { uid: "7A3F", time: "09:00" }, // Asha
      { uid: "1C90", time: "09:01" }, // Raj
      { uid: "FFFF", time: "09:02" }, // unknown card (not in table)
      { uid: "B42E", time: "09:03" }, // Meena
      { uid: "7A3F", time: "09:05" }, // Asha again
    ],
  },
  {
    title: "Round 2 · The blocked card",
    intro:
      "Raj reported his card LOST, so it's on the blocked list. He's still in your table — but the logger must REJECT his old card. Add the ⛔ check in the right spot.",
    cards: [
      { uid: "9D17", owner: "asha" },
      { uid: "4E22", owner: "raj" }, // on the blocklist this round
      { uid: "C58B", owner: "meena" },
      { uid: "2F60", owner: "dev" },
    ],
    names: ["asha", "raj", "meena", "dev"],
    // blocked check must sit AFTER read+lookup but BEFORE the welcome/else branch
    correctOrder: ["read", "lookup", "blocked", "branch"],
    startOrder: ["branch", "blocked", "lookup", "read"],
    blocklist: ["4E22"], // Raj's lost card
    taps: [
      { uid: "9D17", time: "09:00" }, // Asha → welcome
      { uid: "4E22", time: "09:01" }, // Raj's LOST card → blocked
      { uid: "C58B", time: "09:02" }, // Meena → welcome
      { uid: "7777", time: "09:03" }, // unknown card → reject
      { uid: "2F60", time: "09:04" }, // Dev → welcome
      { uid: "4E22", time: "09:06" }, // someone tries Raj's lost card again → blocked
    ],
  },
] as const;

interface LogLine {
  kind: "welcome" | "unknown" | "blocked" | "error";
  text: string;
}

/** Build the expected goal log for a round from a perfect table + correct order. */
function expectedLog(round: RoundDef): LogLine[] {
  return round.taps.map((t) => {
    if (round.blocklist.includes(t.uid)) {
      return { kind: "blocked", text: `${t.time}  BLOCKED CARD` };
    }
    const card = round.cards.find((c) => c.uid === t.uid);
    if (card) {
      return { kind: "welcome", text: `${t.time}  WELCOME ${NAME_LABEL[card.owner]}` };
    }
    return { kind: "unknown", text: `${t.time}  UNKNOWN CARD` };
  });
}

/** One droppable row of the lookup table: a fixed UID + the dropped name. */
interface Row {
  uid: string;
  name: NameId | null;
}

const startRows = (round: RoundDef): Row[] =>
  round.cards.map((c) => ({ uid: c.uid, name: null }));

type Drag = { id: NameId } | null;

export default function RfidAttendanceLogger({ onComplete }: ActivityProps) {
  const [roundIdx, setRoundIdx] = useState<number>(0);
  const round = ROUNDS[roundIdx];
  const goalLog = useMemo<LogLine[]>(() => expectedLog(round), [round]);

  const [rows, setRows] = useState<Row[]>(() => startRows(ROUNDS[0]));
  const [order, setOrder] = useState<BlockId[]>(() => [...ROUNDS[0].startOrder]);
  const [drag, setDrag] = useState<Drag>(null);
  const [log, setLog] = useState<LogLine[] | null>(null);
  const [roundWon, setRoundWon] = useState<boolean>(false); // current round cleared
  const [allWon, setAllWon] = useState<boolean>(false); // every round cleared
  const [hint, setHint] = useState<string>("");
  const reportedRef = useRef<boolean>(false);

  const locked = roundWon || allWon; // no edits once the round is solved

  const orderCorrect = useMemo<boolean>(
    () => order.every((b, i) => b === round.correctOrder[i]),
    [order, round],
  );

  /** Table is solved when every name sits on the UID it truly owns. */
  const tableCorrect = useMemo<boolean>(
    () =>
      rows.every((r) => {
        const card = round.cards.find((c) => c.uid === r.uid);
        return !!card && r.name === card.owner;
      }),
    [rows, round],
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
  const trayNames = round.names.filter((n) => !placed.has(n));

  /** Run the learner's CURRENT program over this round's tap sequence. */
  const runProgram = useCallback((): LogLine[] => {
    // Validity: read → lookup must run, and the blocked check (if used) must come
    // AFTER lookup and BEFORE the final welcome/else branch, or the chip acts on
    // missing info and errors out per tap.
    const pos = (id: BlockId): number => order.indexOf(id);
    const readPos = pos("read");
    const lookupPos = pos("lookup");
    const branchPos = pos("branch");
    const usesBlocked = round.correctOrder.includes("blocked");
    const blockedPos = usesBlocked ? pos("blocked") : -1;

    let sane = readPos < lookupPos && lookupPos < branchPos;
    if (usesBlocked) {
      // blocked check sits strictly between lookup and branch
      sane = sane && lookupPos < blockedPos && blockedPos < branchPos;
    }

    return round.taps.map((t) => {
      if (!sane) {
        return { kind: "error", text: `${t.time}  ERROR: ran logic out of order` };
      }
      // Blocked check first (it runs before the welcome branch when ordered right).
      if (usesBlocked && round.blocklist.includes(t.uid)) {
        return { kind: "blocked", text: `${t.time}  BLOCKED CARD` };
      }
      // Look the tapped UID up in the LEARNER'S table (not the secret registry).
      const row = rows.find((r) => r.uid === t.uid);
      const name = row ? row.name : null;
      if (name) {
        return { kind: "welcome", text: `${t.time}  WELCOME ${NAME_LABEL[name]}` };
      }
      return { kind: "unknown", text: `${t.time}  UNKNOWN CARD` };
    });
  }, [order, rows, round]);

  const dropName = useCallback(
    (uid: string): void => {
      if (!drag || locked) return;
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
    [drag, locked],
  );

  const clearName = useCallback(
    (uid: string): void => {
      if (locked) return;
      setRows((prev) =>
        prev.map((r) => (r.uid === uid ? { ...r, name: null } : r)),
      );
      setLog(null);
      setHint("");
    },
    [locked],
  );

  const pickName = useCallback(
    (id: NameId): void => {
      if (locked) return;
      setDrag((cur) => (cur && cur.id === id ? null : { id }));
    },
    [locked],
  );

  const moveBlock = useCallback(
    (i: number, dir: -1 | 1): void => {
      if (locked) return;
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
    [locked],
  );

  /** Advance to the next round, or finish the whole lab. */
  const finishRound = useCallback(
    (final: LogLine[]): void => {
      setLog(final);
      setHint("");
      const isLast = roundIdx >= ROUNDS.length - 1;
      if (isLast) {
        setAllWon(true);
        if (!reportedRef.current) {
          reportedRef.current = true;
          onComplete({
            passed: true,
            stars: 3,
            detail:
              "Both roll-calls logged perfectly — even the blocked lost card was turned away. Real ID-system logic! ✨",
          });
        }
      } else {
        setRoundWon(true);
      }
    },
    [roundIdx, onComplete],
  );

  const nextRound = useCallback((): void => {
    const ni = roundIdx + 1;
    if (ni >= ROUNDS.length) return;
    setRoundIdx(ni);
    setRows(startRows(ROUNDS[ni]));
    setOrder([...ROUNDS[ni].startOrder]);
    setDrag(null);
    setLog(null);
    setRoundWon(false);
    setHint("");
  }, [roundIdx]);

  const runClass = useCallback((): void => {
    if (locked) return;
    const result = runProgram();
    setLog(result);

    const match =
      result.length === goalLog.length &&
      result.every((l, i) => l.text === goalLog[i].text);

    if (match) {
      finishRound(result);
      return;
    }

    // Kind, targeted nudge — never the exact answer.
    let msg = "The log doesn't match the attendance sheet yet. Check each ✗ line.";
    if (!orderCorrect) {
      if (round.correctOrder.includes("blocked")) {
        msg =
          "Order matters: READ, then LOOK UP, then check the ⛔ blocked list, and ONLY THEN decide welcome-or-reject.";
      } else {
        msg =
          "Run the blocks in order: READ the card before you LOOK IT UP, and decide only after both.";
      }
    } else if (!tableFilled) {
      msg = "Give every UID a name tag before the class arrives.";
    } else if (!tableCorrect) {
      msg =
        "A name is on the wrong UID — match each tag to the code printed on that person's card.";
    } else if (round.blocklist.length > 0) {
      msg =
        "A known student is still on the blocked list — your ⛔ check must run BEFORE the welcome step to catch them.";
    }
    setHint(msg);
  }, [
    locked,
    runProgram,
    goalLog,
    finishRound,
    orderCorrect,
    tableFilled,
    tableCorrect,
    round,
  ]);

  const reset = useCallback((): void => {
    setRoundIdx(0);
    setRows(startRows(ROUNDS[0]));
    setOrder([...ROUNDS[0].startOrder]);
    setDrag(null);
    setLog(null);
    setRoundWon(false);
    setAllWon(false);
    setHint("");
    // note: reportedRef stays set — onComplete fires exactly once per mount.
  }, []);

  const matchCount = useMemo<number>(() => {
    if (!log) return 0;
    return log.reduce(
      (n, l, i) => (l.text === goalLog[i]?.text ? n + 1 : n),
      0,
    );
  }, [log, goalLog]);

  const status = useMemo<string>(() => {
    if (allWon) return "Both roll-calls complete! Every card was logged correctly.";
    if (roundWon) return `${round.title} cleared! Press Next Round for the twist. ✓`;
    if (hint) return hint;
    if (!orderCorrect) return "Order the logic blocks, then fill the lookup table.";
    if (!tableFilled) return "Drag each name tag onto its matching UID code.";
    if (log) return `${matchCount} of ${goalLog.length} log lines match the sheet.`;
    return "Table & logic look ready — press Class Arrives to scan the cards.";
  }, [allWon, roundWon, round, hint, orderCorrect, tableFilled, log, matchCount, goalLog]);

  // Color a log/goal line by its kind.
  const lineColor = (kind: LogLine["kind"]): string =>
    kind === "welcome" ? GREEN : kind === "blocked" ? AMBER : DANGER;

  return (
    <div className="flex w-full max-w-[440px] flex-col items-center gap-3 font-mono text-ink">
      {/* ── Status pill ── */}
      <div
        className="flex w-full items-center justify-center gap-2 rounded-full px-3 py-1.5 text-center text-sm"
        role="status"
        aria-live="polite"
        aria-label={status}
        style={{
          background: allWon ? "rgba(34,211,238,0.16)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${allWon ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: allWon ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true">🪪</span>
        {allWon ? (
          <span aria-hidden="true" className="text-lg">
            ⭐⭐⭐
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="text-[12px] leading-tight text-ink-dim"
          >
            {round.title}
          </span>
        )}
        {allWon && <span aria-hidden="true">✨</span>}
      </div>

      {/* ── Round intro banner ── */}
      {!allWon && (
        <p
          className="w-full rounded-lg px-3 py-1.5 text-center text-[11px] leading-snug text-ink-dim"
          aria-hidden="true"
          style={{
            background: roundIdx === 0 ? "rgba(255,255,255,0.03)" : "rgba(251,191,36,0.08)",
            border: `1px solid ${roundIdx === 0 ? "var(--color-line, #33405c)" : AMBER + "66"}`,
          }}
        >
          {round.intro}
        </p>
      )}

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
              animation:
                !locked && !log ? "g5rfidattendance-scan 1.6s ease-in-out infinite" : undefined,
            }}
          />
          <text x="50" y="39" fill={ACCENT} fontSize="9" textAnchor="middle">
            SCAN
          </text>
          {/* known LED (green) */}
          <circle
            cx="118"
            cy="22"
            r="5"
            fill={log && matchCount > 0 ? GREEN : "rgba(52,211,153,0.18)"}
            stroke={GREEN}
            strokeWidth="1.2"
            style={{ filter: allWon ? `drop-shadow(0 0 4px ${GREEN})` : undefined }}
          />
          <text x="130" y="25" fill="var(--color-ink-faint, #7c8aa0)" fontSize="7">
            known
          </text>
          {/* blocked LED (amber) */}
          <circle
            cx="118"
            cy="36"
            r="5"
            fill={round.blocklist.length ? "rgba(251,191,36,0.22)" : "rgba(251,191,36,0.08)"}
            stroke={AMBER}
            strokeWidth="1.2"
          />
          <text x="130" y="39" fill="var(--color-ink-faint, #7c8aa0)" fontSize="7">
            blocked
          </text>
          {/* unknown LED (red) */}
          <circle
            cx="118"
            cy="50"
            r="5"
            fill="rgba(248,113,113,0.18)"
            stroke={DANGER}
            strokeWidth="1.2"
          />
          <text x="130" y="53" fill="var(--color-ink-faint, #7c8aa0)" fontSize="7">
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
            const armed = !!drag && !locked && !r.name;
            const onBlocklist = round.blocklist.includes(r.uid);
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
                  aria-label={`Card UID ${r.uid.split("").join(" ")}${
                    onBlocklist ? ", on blocked list" : ""
                  }`}
                >
                  {r.uid}
                  {onBlocklist && (
                    <span aria-hidden="true" title="on blocked list">
                      {" "}
                      ⛔
                    </span>
                  )}
                </span>
                <span aria-hidden="true" className="text-ink-faint">
                  →
                </span>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    if (locked) return;
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
                    disabled={locked}
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
            const inPlace = id === round.correctOrder[i];
            const highlight = log && orderCorrect && inPlace;
            return (
              <div
                key={id}
                className="flex items-start justify-between gap-1 rounded-lg border p-1.5 text-[11px] transition"
                style={{
                  borderColor: highlight ? ACCENT : "var(--color-line, #33405c)",
                  background: highlight
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
                {!locked && (
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
                Press Class Arrives to scan {round.taps.length} cards.
              </span>
            ) : (
              log.map((l, i) => {
                const right = l.text === goalLog[i]?.text;
                return (
                  <span
                    key={i}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]"
                    style={{
                      background: right
                        ? "rgba(52,211,153,0.12)"
                        : "rgba(248,113,113,0.14)",
                      color: lineColor(l.kind),
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
            {goalLog.map((l, i) => (
              <span
                key={i}
                className="truncate rounded px-1.5 py-0.5 text-[11px] text-ink-dim"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  borderLeft: `2px solid ${lineColor(l.kind)}`,
                }}
              >
                {l.text}
              </span>
            ))}
          </div>
        </div>
      </div>

      {allWon && (
        <span
          className="flex items-center gap-1 self-center rounded-full px-3 py-1 text-[11px] font-bold"
          style={{
            background: "rgba(52,211,153,0.18)",
            color: GREEN,
            boxShadow: `0 0 12px ${GREEN}55`,
          }}
        >
          <span aria-hidden="true">✅</span> Both roll-calls complete
        </span>
      )}

      {/* coaching / status line (never the exact answer) */}
      <p
        className="min-h-[28px] w-full text-center text-[11px] leading-tight"
        aria-hidden="true"
        style={{
          color: hint
            ? DANGER
            : allWon || roundWon
              ? ACCENT
              : "var(--color-ink-faint, #7c8aa0)",
        }}
      >
        {status}
      </p>

      {/* ── Controls: Class Arrives / Next Round · Reset ── */}
      <div className="flex w-full items-stretch gap-2">
        {roundWon && !allWon ? (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              nextRound();
            }}
            aria-label="Next Round — load the harder roll-call"
            className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-2xl text-base font-bold transition active:scale-95"
            style={{
              touchAction: "none",
              background: AMBER,
              color: "#3b2a06",
              boxShadow: "0 5px 0 0 #b45309",
            }}
          >
            <span aria-hidden="true">⛔</span>
            <span aria-hidden="true" className="font-extrabold tracking-wide">
              NEXT ROUND
            </span>
          </button>
        ) : (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              runClass();
            }}
            disabled={allWon}
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
        )}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            reset();
          }}
          aria-label="Reset the logger to round 1"
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
      {allWon && (
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
