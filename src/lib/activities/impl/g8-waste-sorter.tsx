"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Waste Sorting Bot ♻️ ──────────────────────────────────────────────────────
   GRADE 8 (innovator, age ~13–15). Subject: ROBOTICS.
   ONE learning goal: a color sensor outputs (R,G,B) numbers, and the ORDER of
   IF-ELSE classification rules decides which servo bin an item drops into — so a
   tie-breaker rule (using a second channel) must run BEFORE a looser rule, or two
   items with near-identical greens get confused.

   A TCS3200 sensor reads fixed (R,G,B) per item type. The learner builds the
   sorting program from three ordered IF-rules (channel + bin) over an ELSE→Dry,
   then presses RUN to push 20 items down the belt. Each item fires the first
   matching rule's servo; a table logs item / RGB / bin / correct?. Win = ≥18/20.

   The data is deterministic: the metal CAN has a high green (G=205) that collides
   with the organic APPLE (G=215), so a plain "IF G>200 → Wet" mis-sorts the can.
   The fix is a blue tie-breaker "IF B>120 → Dry" placed ABOVE the green rule —
   the can (B=160) is caught first, the apple (B=60) falls through. A correct,
   ordered rule set sorts all 20. Always winnable, never scolds, fully recoverable.
   ──────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#34d399";
const DANGER = "#f87171";

type Channel = "R" | "G" | "B";
type BinId = "haz" | "wet" | "dry";
type ItemKind = "battery" | "apple" | "bottle" | "can";

interface RGB {
  R: number;
  G: number;
  B: number;
}

interface ItemType {
  kind: ItemKind;
  emoji: string;
  label: string;
  /** Fixed sensor reading the TCS3200 prints for this item type. */
  rgb: RGB;
  /** The bin this item truly belongs in (ground truth for grading). */
  correctBin: BinId;
}

/**
 * Deterministic item library. Greens deliberately collide: the metal CAN
 * (G=205) reads almost as "organic" as the APPLE (G=215). Blue is the
 * separator — the shiny can reflects blue (B=160), the apple does not (B=60).
 */
const ITEM_TYPES: readonly ItemType[] = [
  {
    kind: "battery",
    emoji: "🔋",
    label: "Battery",
    rgb: { R: 230, G: 60, B: 80 },
    correctBin: "haz",
  },
  {
    kind: "apple",
    emoji: "🍎",
    label: "Apple core",
    rgb: { R: 80, G: 215, B: 60 },
    correctBin: "wet",
  },
  {
    kind: "bottle",
    emoji: "🍶",
    label: "Bottle",
    rgb: { R: 120, G: 185, B: 210 },
    correctBin: "dry",
  },
  {
    kind: "can",
    emoji: "🥫",
    label: "Metal can",
    rgb: { R: 160, G: 205, B: 160 },
    correctBin: "dry",
  },
] as const;

const KIND_BY: Record<ItemKind, ItemType> = ITEM_TYPES.reduce(
  (acc, it) => {
    acc[it.kind] = it;
    return acc;
  },
  {} as Record<ItemKind, ItemType>,
);

/** The fixed conveyor order — 5 of each kind, shuffled once, deterministic. */
const BELT: readonly ItemKind[] = [
  "battery", "apple", "can", "bottle", "apple",
  "can", "bottle", "battery", "apple", "can",
  "bottle", "battery", "can", "apple", "bottle",
  "battery", "apple", "can", "bottle", "battery",
] as const;

const BIN_META: Record<BinId, { label: string; emoji: string; color: string }> = {
  haz: { label: "Hazardous", emoji: "☣️", color: "#f87171" },
  wet: { label: "Wet", emoji: "🍃", color: "#34d399" },
  dry: { label: "Dry", emoji: "📦", color: "#60a5fa" },
};

/** Per-channel comparison threshold the rule editor exposes (R/G/B > t). */
const THRESHOLD: Record<Channel, number> = { R: 200, G: 200, B: 120 };
const CH_COLOR: Record<Channel, string> = {
  R: "#f87171",
  G: "#34d399",
  B: "#60a5fa",
};

/** One IF rule: "IF <channel> > THRESHOLD → <bin>". */
interface Rule {
  channel: Channel;
  bin: BinId;
}

/** A wrong-ish starting program: green first, no blue tie-breaker → can mis-sorts. */
const START_RULES: readonly Rule[] = [
  { channel: "R", bin: "haz" },
  { channel: "G", bin: "wet" },
  { channel: "G", bin: "wet" },
] as const;

/** Classify one reading by the ordered rules; ELSE falls through to Dry. */
function classify(rgb: RGB, rules: readonly Rule[]): BinId {
  for (const r of rules) {
    if (rgb[r.channel] > THRESHOLD[r.channel]) return r.bin;
  }
  return "dry";
}

interface LogRow {
  idx: number;
  kind: ItemKind;
  rgb: RGB;
  got: BinId;
  want: BinId;
  ok: boolean;
}

/** Run the whole belt through the rules. Pure + deterministic = grader truth. */
function runBelt(rules: readonly Rule[]): LogRow[] {
  return BELT.map((kind, idx) => {
    const t = KIND_BY[kind];
    const got = classify(t.rgb, rules);
    return { idx, kind, rgb: t.rgb, got, want: t.correctBin, ok: got === t.correctBin };
  });
}

const PASS_AT = 18; // ≥18/20 correct wins

type Phase = "build" | "running" | "won" | "retry";

export default function WasteSorter({ onComplete }: ActivityProps) {
  const [rules, setRules] = useState<Rule[]>(START_RULES.map((r) => ({ ...r })));
  const [phase, setPhase] = useState<Phase>("build");
  const [cursor, setCursor] = useState<number>(-1); // item currently on the sensor
  const [log, setLog] = useState<LogRow[]>([]);

  const reportedRef = useRef<boolean>(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback((): void => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  }, []);
  useEffect(() => () => clearTimers(), [clearTimers]);

  const running = phase === "running";
  const won = phase === "won";

  // The reading currently under the sensor window (live R,G,B readout).
  const activeKind: ItemKind | null =
    cursor >= 0 && cursor < BELT.length ? BELT[cursor] : null;
  const activeType = activeKind ? KIND_BY[activeKind] : null;

  const correctCount = useMemo(
    () => log.reduce((n, r) => (r.ok ? n + 1 : n), 0),
    [log],
  );
  const accuracy = log.length > 0 ? Math.round((correctCount / log.length) * 100) : 0;

  // ── editing the rules returns us to BUILD so the table can't go stale ──
  const editRule = useCallback(
    (i: number, patch: Partial<Rule>): void => {
      if (running) return;
      setRules((prev) => prev.map((r, k) => (k === i ? { ...r, ...patch } : r)));
      clearTimers();
      setPhase("build");
      setCursor(-1);
      setLog([]);
    },
    [running, clearTimers],
  );

  const moveRule = useCallback(
    (i: number, dir: -1 | 1): void => {
      if (running) return;
      const j = i + dir;
      if (j < 0 || j >= rules.length) return;
      setRules((prev) => {
        const next = prev.slice();
        const tmp = next[i];
        next[i] = next[j];
        next[j] = tmp;
        return next;
      });
      clearTimers();
      setPhase("build");
      setCursor(-1);
      setLog([]);
    },
    [running, rules.length, clearTimers],
  );

  // ── RUN: animate items past the sensor, then grade with the pure simulator ──
  const run = useCallback((): void => {
    if (running) return;
    clearTimers();
    setPhase("running");
    setLog([]);
    setCursor(-1);

    const final = runBelt(rules);
    const STEP_MS = 150;

    BELT.forEach((_, i) => {
      const t = setTimeout(() => {
        setCursor(i);
        setLog((prev) => [...prev, final[i]]);
      }, i * STEP_MS);
      timersRef.current.push(t);
    });

    const endT = setTimeout(
      () => {
        setCursor(-1);
        const right = final.reduce((n, r) => (r.ok ? n + 1 : n), 0);
        if (right >= PASS_AT) {
          setPhase("won");
          if (!reportedRef.current) {
            reportedRef.current = true;
            onComplete({
              passed: true,
              stars: 3,
              detail: `Sorted ${right}/20! The blue tie-breaker ran before the green rule. ✨`,
            });
          }
        } else {
          setPhase("retry");
          // Find the most common mis-sort to nudge — never the answer.
          const missCan = final.some((r) => r.kind === "can" && !r.ok);
          onComplete({
            passed: false,
            detail: missCan
              ? `${right}/20 — the metal can keeps landing in the wrong bin. Its green looks organic; which other channel tells it apart?`
              : `${right}/20 — close! Check which channel each item type spikes on, and the rule order.`,
          });
        }
      },
      BELT.length * STEP_MS + 260,
    );
    timersRef.current.push(endT);
  }, [running, clearTimers, rules, onComplete]);

  const reset = useCallback((): void => {
    clearTimers();
    setRules(START_RULES.map((r) => ({ ...r })));
    setPhase("build");
    setCursor(-1);
    setLog([]);
  }, [clearTimers]);

  const statusLabel = useMemo<string>(() => {
    if (won) return `Solved! ${correctCount} of 20 items sorted correctly.`;
    if (running)
      return `Running… ${log.length} of 20 items sorted, ${correctCount} correct.`;
    if (phase === "retry")
      return `${correctCount} of 20 correct — adjust the rules and run again.`;
    return "Build the sorting rules, then press Run to send 20 items down the belt.";
  }, [won, running, phase, correctCount, log.length]);

  const channels: Channel[] = ["R", "G", "B"];
  const bins: BinId[] = ["haz", "wet", "dry"];

  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-col items-center gap-3 font-mono text-ink">
      {/* ── Status pill ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5"
        role="status"
        aria-live="polite"
        aria-label={statusLabel}
        style={{
          background: won ? "rgba(52,211,153,0.16)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${won ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: won ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true" className="text-lg">♻️</span>
        {won ? (
          <span aria-hidden="true" className="text-lg">⭐⭐⭐</span>
        ) : (
          <span
            aria-hidden="true"
            className="text-sm tabular-nums"
            style={{ color: phase === "retry" ? DANGER : "#9aa6cf" }}
          >
            {`${correctCount}/${log.length || 20} · ${accuracy}%`}
          </span>
        )}
        {won && <span aria-hidden="true" className="text-lg">✨</span>}
      </div>

      {/* ── The belt + TCS3200 sensor window + three servo bins ── */}
      <div
        className="panel relative w-full overflow-hidden rounded-2xl border p-2"
        style={{
          borderColor: won ? ACCENT : "var(--color-line, #33405c)",
          boxShadow: won ? `0 0 0 1px ${ACCENT}, 0 0 22px -4px ${ACCENT}` : undefined,
          transition: "box-shadow .3s ease, border-color .3s ease",
        }}
      >
        <svg
          viewBox="0 0 360 210"
          className="block w-full select-none"
          role="img"
          aria-label="A conveyor belt feeding waste items past a color sensor toward three sorting bins"
        >
          <defs>
            <linearGradient id="g8wastesorter-belt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2b3550" />
              <stop offset="100%" stopColor="#1a2236" />
            </linearGradient>
            <radialGradient id="g8wastesorter-beam" cx="50%" cy="0%" r="90%">
              <stop offset="0%" stopColor="#fde68a" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* belt */}
          <rect x={8} y={70} width={344} height={26} rx={6} fill="url(#g8wastesorter-belt)" stroke="#3a4866" strokeWidth={1.5} />
          {[40, 96, 152, 208, 264, 320].map((x) => (
            <line key={x} x1={x} y1={70} x2={x} y2={96} stroke="#3a4866" strokeWidth={1} />
          ))}

          {/* TCS3200 sensor head + light beam onto the window */}
          <rect x={150} y={20} width={60} height={26} rx={4} fill="#0d1422" stroke="#fbbf24" strokeWidth={1.6} />
          <text x={180} y={36} fontSize={9} textAnchor="middle" fill="#fbbf24" aria-hidden="true">
            TCS3200
          </text>
          <polygon points="160,46 200,46 192,70 168,70" fill="url(#g8wastesorter-beam)" opacity={running ? 0.95 : 0.6} />
          {/* sensor window outline on the belt */}
          <rect x={166} y={66} width={28} height={30} rx={4} fill="none" stroke="#fbbf24" strokeWidth={1.2} strokeDasharray="3 2" opacity={0.8} />

          {/* the item currently being read sits in the sensor window */}
          {activeType && (
            <g style={{ transition: "transform 120ms linear" }}>
              <text x={180} y={88} fontSize={22} textAnchor="middle" dominantBaseline="central" aria-hidden="true">
                {activeType.emoji}
              </text>
            </g>
          )}
          {/* upcoming items queued to the left of the window */}
          {!running &&
            BELT.slice(0, 3).map((k, i) => (
              <text
                key={i}
                x={120 - i * 30}
                y={88}
                fontSize={18}
                textAnchor="middle"
                dominantBaseline="central"
                opacity={0.8}
                aria-hidden="true"
              >
                {KIND_BY[k].emoji}
              </text>
            ))}

          {/* live R,G,B readout swatch */}
          <g aria-hidden="true">
            <rect x={228} y={20} width={124} height={40} rx={6} fill="#0b1220" stroke="#33405c" strokeWidth={1} />
            {activeType ? (
              <>
                <rect
                  x={234}
                  y={26}
                  width={28}
                  height={28}
                  rx={3}
                  fill={`rgb(${activeType.rgb.R},${activeType.rgb.G},${activeType.rgb.B})`}
                  stroke="#0d1422"
                  strokeWidth={1}
                />
                <text x={270} y={34} fontSize={10} fill="#f87171" className="tabular-nums">{`R ${activeType.rgb.R}`}</text>
                <text x={270} y={45} fontSize={10} fill="#34d399" className="tabular-nums">{`G ${activeType.rgb.G}`}</text>
                <text x={270} y={56} fontSize={10} fill="#60a5fa" className="tabular-nums">{`B ${activeType.rgb.B}`}</text>
              </>
            ) : (
              <text x={290} y={44} fontSize={10} textAnchor="middle" fill="#7c8aa0">
                R G B —
              </text>
            )}
          </g>

          {/* three servo bins */}
          {bins.map((b, i) => {
            const cx = 70 + i * 110;
            const meta = BIN_META[b];
            const lastDrop = log.length > 0 ? log[log.length - 1] : null;
            const lit = running && lastDrop?.got === b;
            return (
              <g key={b}>
                {/* servo-lid gauge: a small arc that swings when this bin fires */}
                <g
                  transform={`rotate(${lit ? -38 : 0} ${cx - 22} 150)`}
                  style={{ transition: "transform 180ms cubic-bezier(.2,.7,.3,1)" }}
                >
                  <rect
                    x={cx - 22}
                    y={146}
                    width={44}
                    height={8}
                    rx={2}
                    fill={lit ? meta.color : "#46577a"}
                    stroke="#0d1422"
                    strokeWidth={1.2}
                  />
                </g>
                {/* bin body */}
                <path
                  d={`M ${cx - 24} 154 L ${cx + 24} 154 L ${cx + 18} 200 L ${cx - 18} 200 Z`}
                  fill="#1a2236"
                  stroke={meta.color}
                  strokeWidth={1.4}
                  opacity={0.95}
                />
                <text x={cx} y={178} fontSize={16} textAnchor="middle" dominantBaseline="central" aria-hidden="true">
                  {meta.emoji}
                </text>
                <text x={cx} y={195} fontSize={8} textAnchor="middle" fill={meta.color}>
                  {meta.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Rule editor: ordered IF rules over an ELSE → Dry ── */}
      <div className="panel flex w-full flex-col gap-2 rounded-xl p-3">
        <p className="text-[11px] text-ink-faint">
          Rules run top-to-bottom; the <span style={{ color: ACCENT }}>first</span> match wins. Order matters.
        </p>
        {rules.map((rule, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--color-line, #33405c)" }}
          >
            <span className="w-12 shrink-0 text-[11px] text-ink-faint">IF</span>
            <select
              value={rule.channel}
              disabled={running}
              onChange={(e) => editRule(i, { channel: e.target.value as Channel })}
              aria-label={`Rule ${i + 1} channel`}
              className="rounded-md px-1.5 py-1 text-xs disabled:opacity-50"
              style={{ background: "#0b1220", color: CH_COLOR[rule.channel], border: "1px solid #33405c" }}
            >
              {channels.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <span className="text-[11px] tabular-nums text-ink-dim">{`> ${THRESHOLD[rule.channel]}`}</span>
            <span aria-hidden="true" className="text-ink-faint">→</span>
            <select
              value={rule.bin}
              disabled={running}
              onChange={(e) => editRule(i, { bin: e.target.value as BinId })}
              aria-label={`Rule ${i + 1} target bin`}
              className="flex-1 rounded-md px-1.5 py-1 text-xs disabled:opacity-50"
              style={{ background: "#0b1220", color: BIN_META[rule.bin].color, border: "1px solid #33405c" }}
            >
              {bins.map((b) => (
                <option key={b} value={b}>
                  {BIN_META[b].label}
                </option>
              ))}
            </select>
            <div className="flex flex-col">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  moveRule(i, -1);
                }}
                disabled={running || i === 0}
                aria-label={`Move rule ${i + 1} up`}
                className="grid h-4 w-5 place-items-center rounded text-[10px] text-ink-dim disabled:opacity-25"
                style={{ touchAction: "none", background: "rgba(255,255,255,0.05)" }}
              >
                ▲
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  moveRule(i, 1);
                }}
                disabled={running || i === rules.length - 1}
                aria-label={`Move rule ${i + 1} down`}
                className="grid h-4 w-5 place-items-center rounded text-[10px] text-ink-dim disabled:opacity-25"
                style={{ touchAction: "none", background: "rgba(255,255,255,0.05)" }}
              >
                ▼
              </button>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 opacity-70" style={{ border: "1px dashed var(--color-line, #33405c)" }}>
          <span className="w-12 shrink-0 text-[11px] text-ink-faint">ELSE</span>
          <span aria-hidden="true" className="text-ink-faint">→</span>
          <span className="text-xs" style={{ color: BIN_META.dry.color }}>
            Dry bin
          </span>
        </div>
      </div>

      {/* ── Run / Reset ── */}
      <div className="flex w-full items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            run();
          }}
          disabled={running}
          aria-label="Run — send 20 items down the belt and grade the sorting"
          className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl text-base font-bold transition active:scale-95 disabled:opacity-50"
          style={{ touchAction: "none", background: ACCENT, color: "#04130d", boxShadow: "0 5px 0 0 #15916a" }}
        >
          <span aria-hidden="true">{running ? "⏩" : "▶"}</span>
          <span aria-hidden="true" className="font-extrabold tracking-wide">
            {running ? "SORTING…" : "RUN 20"}
          </span>
        </button>
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            reset();
          }}
          disabled={running}
          aria-label="Reset the rules and the run"
          className="grid h-[52px] w-[52px] place-items-center rounded-2xl text-xl transition active:scale-90 disabled:opacity-40"
          style={{ touchAction: "none", background: "rgba(255,255,255,0.05)", border: "2px solid var(--color-line, #33405c)" }}
        >
          <span aria-hidden="true">🔄</span>
        </button>
      </div>

      {/* ── Results table ── */}
      {log.length > 0 && (
        <div className="panel w-full rounded-xl p-2">
          <div className="mb-1 flex items-center justify-between px-1 text-[11px]">
            <span className="text-ink-dim">Sort log</span>
            <span
              className="tabular-nums"
              style={{ color: phase === "retry" ? DANGER : ACCENT }}
            >
              {`accuracy ${accuracy}%  ·  ${correctCount}/${log.length}`}
            </span>
          </div>
          <div className="max-h-[150px] overflow-y-auto">
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="text-ink-faint">
                  <th className="px-1 py-0.5 text-left font-normal">#</th>
                  <th className="px-1 py-0.5 text-left font-normal">item</th>
                  <th className="px-1 py-0.5 text-left font-normal">R,G,B</th>
                  <th className="px-1 py-0.5 text-left font-normal">bin</th>
                  <th className="px-1 py-0.5 text-center font-normal">ok?</th>
                </tr>
              </thead>
              <tbody>
                {log.map((r) => (
                  <tr key={r.idx} style={{ background: r.ok ? "transparent" : "rgba(248,113,113,0.10)" }}>
                    <td className="px-1 py-0.5 tabular-nums text-ink-faint">{r.idx + 1}</td>
                    <td className="px-1 py-0.5" aria-label={KIND_BY[r.kind].label}>
                      {KIND_BY[r.kind].emoji}
                    </td>
                    <td className="px-1 py-0.5 tabular-nums text-ink-dim">
                      {`${r.rgb.R},${r.rgb.G},${r.rgb.B}`}
                    </td>
                    <td className="px-1 py-0.5" style={{ color: BIN_META[r.got].color }}>
                      {BIN_META[r.got].label}
                    </td>
                    <td className="px-1 py-0.5 text-center" aria-label={r.ok ? "correct" : "wrong"}>
                      {r.ok ? "✅" : "❌"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {phase === "retry" && (
            <p className="mt-1 px-1 text-[11px]" style={{ color: DANGER }}>
              Some items mis-sorted. Look at the ❌ rows — which channel separates them, and is your rule order right?
            </p>
          )}
        </div>
      )}

      {/* celebratory floaters when solved */}
      {won && (
        <div className="pointer-events-none flex justify-center gap-2 text-2xl">
          <span style={{ animation: "g8wastesorter-float 1.4s ease-in-out infinite" }} aria-hidden="true">✨</span>
          <span style={{ animation: "g8wastesorter-float 1.4s ease-in-out infinite", animationDelay: "0.2s" }} aria-hidden="true">🎉</span>
          <span style={{ animation: "g8wastesorter-float 1.4s ease-in-out infinite", animationDelay: "0.4s" }} aria-hidden="true">✨</span>
        </div>
      )}

      <style>{`
        @keyframes g8wastesorter-float {
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
