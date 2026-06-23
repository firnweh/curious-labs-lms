"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

/* ── Rule-Based Chatbot Builder 🤖 ─────────────────────────────────────────────
   GRADE 5 (explorer, age ~10–11). Subject: AI.
   ONE learning goal: A RULE-BASED CHATBOT replies by checking the visitor's
   words for KEYWORDS and running the FIRST matching IF/ELIF rule, in order —
   so both the keyword AND the order of the rules decide the answer.

   The learner builds the bot by dropping a keyword tile onto each rule card,
   then ORDERING the cards (the first match wins). A catch-all "else → I don't
   understand" always sits at the bottom. Pressing Test Chat runs 6 fixed
   visitor messages top-to-bottom and shows which card fired + the reply.

   The deliberate trap: there are 5 tiles but only 4 cards, and "hi" is a decoy.
   "hi" matches INSIDE "this" (in the message "this is broken"), so using "hi"
   for the greeting STEALS a message that should fall through to else — and it
   still misses the real greeting "hello there". Fixed by tightening the greeting
   keyword to "hello" and leaving "hi" in the tray. Deterministic messages + a
   finite tile/rule set make it always solvable.
   ──────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#a855f7";
const DANGER = "#f87171";
const OK = "#34d399";

type KeyId = "hello" | "hi" | "name" | "joke" | "bye";
type ReplyId = "greet" | "name" | "joke" | "bye" | "else";

interface KeyTile {
  id: KeyId;
  word: string;
}

/** The keyword tiles the learner can drop. "hi" is the tempting-but-broad one. */
const TILES: readonly KeyTile[] = [
  { id: "hello", word: "hello" },
  { id: "hi", word: "hi" },
  { id: "name", word: "name" },
  { id: "joke", word: "joke" },
  { id: "bye", word: "bye" },
];

const tileWord = (id: KeyId): string =>
  (TILES.find((t) => t.id === id) as KeyTile).word;

/** Each rule card carries a FIXED reply and one droppable keyword slot. */
interface CardDef {
  id: ReplyId;
  reply: string;
  /** The keyword the learner is meant to land here (for kind, non-spoiler hints). */
  wantKey: KeyId | null;
}

const CARDS: readonly CardDef[] = [
  { id: "greet", reply: "Hi there! Welcome 👋", wantKey: "hello" },
  { id: "name", reply: "I'm ChatBot, your helper.", wantKey: "name" },
  { id: "joke", reply: "Why did the robot nap? Low battery! 🔋", wantKey: "joke" },
  { id: "bye", reply: "Goodbye! Come back soon 👋", wantKey: "bye" },
];

/** The catch-all that always lives at the bottom (not movable, no keyword). */
const ELSE_CARD: CardDef = { id: "else", reply: "Sorry, I don't understand.", wantKey: null };

/** A scripted visitor message + the reply we WANT the bot to give. */
interface Msg {
  text: string;
  want: ReplyId;
}

/** 6 fixed messages. "this is broken" is the trap: it hides "hi" inside "this". */
const MESSAGES: readonly Msg[] = [
  { text: "hello there", want: "greet" },
  { text: "what is your name", want: "name" },
  { text: "this is broken", want: "else" },
  { text: "tell me a joke", want: "joke" },
  { text: "ok bye now", want: "bye" },
  { text: "do you sell hats", want: "else" },
];

/** A card placed in the learner's ordered stack: its def + the dropped keyword. */
interface Slot {
  card: CardDef;
  key: KeyId | null;
}

/** Run the rules top-to-bottom; return the index of the first card that matches. */
function fireIndex(order: Slot[], text: string): number {
  for (let i = 0; i < order.length; i += 1) {
    const s = order[i];
    if (s.card.id === "else") return i; // catch-all always matches
    if (s.key && text.includes(tileWord(s.key))) return i;
  }
  return order.length - 1; // safety: should never reach (else is last)
}

const startSlots = (): Slot[] =>
  CARDS.map((c) => ({ card: c, key: null }));

type Drag = { id: KeyId } | null;

interface ChatLine {
  user: string;
  bot: string;
  want: ReplyId;
  got: ReplyId;
}

export default function KeywordChatbot({ onComplete }: ActivityProps) {
  const [slots, setSlots] = useState<Slot[]>(startSlots);
  const [drag, setDrag] = useState<Drag>(null);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [firedIdx, setFiredIdx] = useState<number | null>(null);
  const [won, setWon] = useState<boolean>(false);
  const [hint, setHint] = useState<string>("");
  // How many full-stack tests the learner ran before all 6 passed.
  // Solving it by reasoning (few tests) earns more stars than trial-and-error.
  const [tests, setTests] = useState<number>(0);
  const [stars, setStars] = useState<1 | 2 | 3>(3);

  const reportedRef = useRef<boolean>(false);

  // full ordered program = learner's cards, then the fixed else card
  const program = useMemo<Slot[]>(
    () => [...slots, { card: ELSE_CARD, key: null }],
    [slots],
  );

  // keyword tiles not yet placed (each tile used at most once)
  const placed = useMemo<Set<KeyId>>(() => {
    const s = new Set<KeyId>();
    for (const sl of slots) if (sl.key) s.add(sl.key);
    return s;
  }, [slots]);
  const trayTiles = TILES.filter((t) => !placed.has(t.id));

  const allFilled = slots.every((s) => s.key !== null);

  /** Per-message result for the live checklist. Pure + deterministic. */
  const outcomes = useMemo<ChatLine[]>(() => {
    return MESSAGES.map((m) => {
      const idx = fireIndex(program, m.text);
      const got = program[idx].card.id;
      return { user: m.text, bot: program[idx].card.reply, want: m.want, got };
    });
  }, [program]);

  const allPass = outcomes.every((o) => o.got === o.want);

  const move = useCallback(
    (i: number, dir: -1 | 1): void => {
      if (won) return;
      setSlots((prev) => {
        const j = i + dir;
        if (j < 0 || j >= prev.length) return prev;
        const next = [...prev];
        const tmp = next[i];
        next[i] = next[j];
        next[j] = tmp;
        return next;
      });
      setChat([]);
      setFiredIdx(null);
      setHint("");
    },
    [won],
  );

  const dropKey = useCallback(
    (i: number): void => {
      if (!drag || won) return;
      setSlots((prev) => {
        const next = prev.map((s) => (s.key === drag.id ? { ...s, key: null } : s));
        next[i] = { ...next[i], key: drag.id };
        return next;
      });
      setDrag(null);
      setChat([]);
      setFiredIdx(null);
      setHint("");
    },
    [drag, won],
  );

  const clearKey = useCallback(
    (i: number): void => {
      if (won) return;
      setSlots((prev) => {
        const next = [...prev];
        next[i] = { ...next[i], key: null };
        return next;
      });
      setChat([]);
      setFiredIdx(null);
      setHint("");
    },
    [won],
  );

  const pickTile = useCallback(
    (id: KeyId): void => {
      if (won) return;
      setDrag((cur) => (cur && cur.id === id ? null : { id }));
    },
    [won],
  );

  const finishWin = useCallback(
    (earned: 1 | 2 | 3): void => {
      setWon(true);
      setStars(earned);
      setHint("");
      if (!reportedRef.current) {
        reportedRef.current = true;
        const tail =
          earned === 3
            ? "Solved it like an engineer — barely any test runs. ⭐⭐⭐"
            : earned === 2
              ? "Solved it! Next time, reason it out in fewer tests for 3 stars."
              : "Solved it — lots of trial and error. Plan the keywords first next time!";
        onComplete({
          passed: true,
          stars: earned,
          detail: `All 6 visitors got the right reply. ${tail}`,
        });
      }
    },
    [onComplete],
  );

  const testChat = useCallback((): void => {
    if (won) return;
    setChat(outcomes);
    // light up the card that fires for the FIRST failing message (or msg 1).
    const firstBad = outcomes.findIndex((o) => o.got !== o.want);
    const focus = firstBad === -1 ? 0 : firstBad;
    setFiredIdx(fireIndex(program, MESSAGES[focus].text));

    // Count every full test (counts the winning run too, so test #1 win = 3 stars).
    const usedTests = tests + 1;
    setTests(usedTests);

    if (allPass) {
      // Optimization goal: reward reasoning over brute-forcing.
      // ≤2 tests → 3★ (the trap can be reasoned out in one or two runs),
      // ≤4 → 2★, otherwise still a win at 1★. A clean 3★ is always reachable.
      const earned: 1 | 2 | 3 = usedTests <= 2 ? 3 : usedTests <= 4 ? 2 : 1;
      finishWin(earned);
      return;
    }

    // Build a kind, targeted nudge — never the exact answer.
    const bad = outcomes[firstBad];
    const grabber = program[fireIndex(program, bad.user)];
    // Did a short keyword sneak in as a substring of a real word?
    const sneaky =
      !!grabber.key &&
      grabber.card.id !== "else" &&
      !bad.user.split(" ").includes(tileWord(grabber.key));
    let msg = "Some replies are off. Watch which card lights up first.";
    if (!allFilled) {
      msg = "Give every rule card a keyword before testing.";
    } else if (bad.want === "else" && bad.got !== "else" && sneaky) {
      msg = `A short keyword is hiding inside a word in "${bad.user}". Try a longer, less greedy keyword.`;
    } else if (bad.got === "else" && bad.want !== "else") {
      msg = `No rule caught "${bad.user}". Is the right keyword on a card and spelled to appear in the message?`;
    } else if (bad.want === "else" && bad.got !== "else") {
      msg = `"${bad.user}" should fall through to the else reply, but a keyword grabbed it first.`;
    } else {
      msg = "A rule higher in the stack is firing first. Reorder a card or tighten a keyword.";
    }
    setHint(msg);
    onComplete({ passed: false, detail: msg });
  }, [won, outcomes, program, allPass, allFilled, tests, finishWin, onComplete]);

  const reset = useCallback((): void => {
    setSlots(startSlots());
    setDrag(null);
    setChat([]);
    setFiredIdx(null);
    setWon(false);
    setHint("");
    setTests(0);
    setStars(3);
  }, []);

  const passCount = outcomes.filter((o) => o.got === o.want).length;

  const status = useMemo<string>(() => {
    if (won) {
      return stars === 3
        ? "Bot is ready! You solved it in ≤2 tests — ⭐⭐⭐ engineer-level."
        : `Bot is ready! ${stars} stars — try again to solve it in ≤2 tests for all 3.`;
    }
    if (hint) return hint;
    if (!allFilled) return "Drag a keyword tile onto each rule card.";
    if (chat.length > 0) return `${passCount} of 6 replies correct. Adjust a card and test again.`;
    return "Cards are loaded. Press Test Chat to run the 6 visitors through your rules.";
  }, [won, stars, hint, allFilled, chat.length, passCount]);

  return (
    <div className="flex w-full max-w-[440px] flex-col items-center gap-3 font-mono text-ink">
      {/* ── Status pill ── */}
      <div
        className="flex w-full items-center justify-center gap-2 rounded-full px-3 py-1.5 text-center text-sm"
        role="status"
        aria-live="polite"
        aria-label={status}
        style={{
          background: won ? "rgba(168,85,247,0.16)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${won ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: won ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true">🤖</span>
        {won ? (
          <span aria-hidden="true" className="text-lg">
            {"⭐".repeat(stars)}
            <span className="text-ink-faint">{"☆".repeat(3 - stars)}</span>
          </span>
        ) : (
          <span aria-hidden="true" className="text-[12px] leading-tight text-ink-dim">
            {tests === 0
              ? "first matching rule wins"
              : `test ${tests} · solve in ≤2 for ⭐⭐⭐`}
          </span>
        )}
        {won && <span aria-hidden="true">✨</span>}
      </div>

      {/* ── Two panels: rule stack (left) + chat window (right) ── */}
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        {/* ---- RULE STACK ---- */}
        <div className="panel flex flex-1 flex-col gap-1.5 rounded-xl p-2">
          <span className="text-[10px] uppercase tracking-tech text-ink-faint">
            Rules — checked top → down
          </span>
          {program.map((s, i) => {
            const isElse = s.card.id === "else";
            const lit = firedIdx === i && chat.length > 0;
            const armed = !!drag && !won && !isElse;
            return (
              <div
                key={s.card.id}
                className="relative rounded-lg border p-1.5 text-[11px] transition"
                style={{
                  borderColor: lit ? ACCENT : "var(--color-line, #33405c)",
                  background: lit ? "rgba(168,85,247,0.14)" : "rgba(255,255,255,0.02)",
                  boxShadow: lit ? `0 0 0 1px ${ACCENT}, 0 0 12px -2px ${ACCENT}` : undefined,
                }}
              >
                {/* glowing "fired" arrow */}
                {lit && (
                  <span
                    aria-hidden="true"
                    className="absolute -left-2 top-1/2 -translate-y-1/2 text-sm"
                    style={{ color: ACCENT, animation: "g5keywordchatbot-pulse 1s ease-in-out infinite" }}
                  >
                    ▶
                  </span>
                )}
                <div className="flex items-center justify-between gap-1">
                  <span className="text-ink-faint">{isElse ? "ELSE" : i === 0 ? "IF" : "ELIF"}</span>
                  {!isElse && !won && (
                    <span className="flex gap-0.5">
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          move(i, -1);
                        }}
                        disabled={i === 0}
                        aria-label={`Move ${s.card.reply} rule up`}
                        className="grid h-5 w-5 place-items-center rounded text-ink-dim transition active:scale-90 disabled:opacity-25"
                        style={{ background: "rgba(255,255,255,0.05)", touchAction: "none" }}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          move(i, 1);
                        }}
                        disabled={i >= slots.length - 1}
                        aria-label={`Move ${s.card.reply} rule down`}
                        className="grid h-5 w-5 place-items-center rounded text-ink-dim transition active:scale-90 disabled:opacity-25"
                        style={{ background: "rgba(255,255,255,0.05)", touchAction: "none" }}
                      >
                        ▼
                      </button>
                    </span>
                  )}
                </div>

                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                  {isElse ? (
                    <span className="text-ink-faint">message has no match</span>
                  ) : (
                    <>
                      <span className="text-ink-dim">contains</span>
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          if (won) return;
                          if (s.key) clearKey(i);
                          else dropKey(i);
                        }}
                        aria-label={
                          s.key
                            ? `Keyword slot: "${tileWord(s.key)}". Tap to remove.`
                            : "Empty keyword slot"
                        }
                        className="rounded border px-1.5 py-0.5 transition"
                        style={{
                          borderColor: s.key ? ACCENT : armed ? ACCENT : "var(--color-line, #33405c)",
                          borderStyle: s.key ? "solid" : "dashed",
                          background: s.key ? "rgba(168,85,247,0.16)" : "rgba(255,255,255,0.02)",
                          color: s.key ? ACCENT : "var(--color-ink-faint, #7c8aa0)",
                          animation: armed && !s.key ? "g5keywordchatbot-pulse 1s ease-in-out infinite" : undefined,
                          touchAction: "none",
                        }}
                      >
                        {s.key ? `"${tileWord(s.key)}"` : armed ? "drop" : "[ ? ]"}
                      </button>
                    </>
                  )}
                </div>
                <div className="mt-0.5 truncate text-ink-dim">→ {s.card.reply}</div>
              </div>
            );
          })}

          {/* keyword tray */}
          <span className="mt-1 text-[10px] uppercase tracking-tech text-ink-faint">
            Keyword tiles
          </span>
          <div className="flex flex-wrap gap-1.5" style={{ touchAction: "none" }}>
            {trayTiles.length === 0 ? (
              <span className="text-[11px] text-ink-faint">all placed ✓</span>
            ) : (
              trayTiles.map((t) => {
                const active = !!drag && drag.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      pickTile(t.id);
                    }}
                    disabled={won}
                    aria-pressed={active}
                    aria-label={`Keyword tile: ${t.word}${active ? ", selected" : ""}`}
                    className="rounded-full border px-2.5 py-1 text-[11px] transition active:scale-95 disabled:opacity-40"
                    style={{
                      borderColor: active ? ACCENT : "var(--color-line, #33405c)",
                      background: active ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.04)",
                      color: active ? ACCENT : "var(--color-ink-dim, #9aa6b2)",
                      touchAction: "none",
                    }}
                  >
                    {t.word}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ---- CHAT + CHECKLIST ---- */}
        <div className="panel flex flex-1 flex-col gap-2 rounded-xl p-2">
          <span className="text-[10px] uppercase tracking-tech text-ink-faint">Test chat</span>
          <div
            className="flex flex-col gap-1.5 overflow-y-auto rounded-lg p-1.5"
            style={{ minHeight: 120, maxHeight: 200, background: "rgba(0,0,0,0.18)" }}
            aria-label="Chat transcript"
          >
            {chat.length === 0 ? (
              <span className="m-auto text-center text-[11px] text-ink-faint">
                Press Test Chat to run the 6 visitor messages.
              </span>
            ) : (
              chat.map((c, i) => {
                const ok = c.got === c.want;
                return (
                  <div key={i} className="flex flex-col gap-0.5">
                    <span
                      className="max-w-[85%] self-start rounded-lg px-2 py-1 text-[11px]"
                      style={{ background: "rgba(255,255,255,0.06)", color: "var(--color-ink-dim, #9aa6b2)" }}
                    >
                      {c.user}
                    </span>
                    <span
                      className="flex max-w-[85%] items-center gap-1 self-end rounded-lg px-2 py-1 text-[11px]"
                      style={{
                        background: ok ? "rgba(52,211,153,0.16)" : "rgba(248,113,113,0.16)",
                        color: ok ? OK : DANGER,
                      }}
                    >
                      <span aria-hidden="true">{ok ? "✅" : "❌"}</span>
                      {c.bot}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* expected-outcome checklist */}
          <div className="flex flex-col gap-0.5">
            {outcomes.map((o, i) => {
              const ok = o.got === o.want;
              const shown = chat.length > 0;
              return (
                <div key={i} className="flex items-center gap-1 text-[10px]">
                  <span aria-hidden="true">{shown ? (ok ? "✅" : "⬜") : "⬜"}</span>
                  <span className="truncate" style={{ color: shown && ok ? OK : "var(--color-ink-faint, #7c8aa0)" }}>
                    {o.user}
                  </span>
                </div>
              );
            })}
          </div>

          {won && (
            <span
              className="self-center rounded-full px-3 py-1 text-[11px] font-bold"
              style={{ background: "rgba(168,85,247,0.2)", color: ACCENT, boxShadow: `0 0 12px ${ACCENT}66` }}
            >
              Bot is ready! {"⭐".repeat(stars)}
            </span>
          )}
        </div>
      </div>

      {/* coaching / status line (never the exact answer) */}
      <p
        className="min-h-[28px] w-full text-center text-[11px] leading-tight"
        aria-hidden="true"
        style={{ color: hint ? DANGER : won ? ACCENT : "var(--color-ink-faint, #7c8aa0)" }}
      >
        {status}
      </p>

      {/* ── Controls: Test Chat · Reset ── */}
      <div className="flex w-full items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            testChat();
          }}
          disabled={won}
          aria-label="Test Chat — run all 6 visitor messages through the rules"
          className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-2xl text-base font-bold transition active:scale-95 disabled:opacity-40"
          style={{ touchAction: "none", background: ACCENT, color: "#1a0533", boxShadow: "0 5px 0 0 #7c3aed" }}
        >
          <span aria-hidden="true">▶</span>
          <span aria-hidden="true" className="font-extrabold tracking-wide">
            TEST CHAT
          </span>
        </button>
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            reset();
          }}
          aria-label="Reset the chatbot rules"
          className="grid h-[50px] w-[50px] place-items-center rounded-2xl text-xl transition active:scale-90"
          style={{ touchAction: "none", background: "rgba(255,255,255,0.05)", border: "2px solid var(--color-line, #33405c)" }}
        >
          <span aria-hidden="true">🔄</span>
        </button>
      </div>

      {/* celebratory floaters */}
      {won && (
        <div className="pointer-events-none flex justify-center gap-2 text-2xl">
          <span className="animate-float" aria-hidden="true">✨</span>
          <span className="animate-float" style={{ animationDelay: "0.2s" }} aria-hidden="true">🎉</span>
          <span className="animate-float" style={{ animationDelay: "0.4s" }} aria-hidden="true">✨</span>
        </div>
      )}

      <style>{`
        @keyframes g5keywordchatbot-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
