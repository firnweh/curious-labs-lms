"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Mood Meter — NLP · sentiment (Grades 5-7).
 *
 * The AI guesses a message's MOOD by adding up word feelings. Each word in a
 * small lexicon carries a sentiment weight (+2 / 0 / -2); the AI sums the
 * weights of the words in a picked message and shows 😀 / 😐 / 😠 on a meter,
 * highlighting the words that drove the verdict.
 *
 * The child can FLIP any word's weight (+ / neutral / -) and watch every
 * prediction update live — the headline "aha" is the slang word "sick", which
 * the AI reads as negative until the child teaches it that it means awesome.
 * Teaches: text is data; sentiment = sum of word feelings; words are ambiguous
 * so the AI can be fooled. Deterministic, no deps.
 */

const ACCENT = "#eab308";

type Weight = 2 | 0 | -2;

interface Word {
  id: string;
  text: string;
  base: Weight; // starting feeling
}

// ~14 feeling words the child can flip. Neutral words in messages (the, this,
// is, a…) carry weight 0 and are not in the lexicon — only feeling words are.
const LEXICON: Word[] = [
  { id: "love", text: "love", base: 2 },
  { id: "great", text: "great", base: 2 },
  { id: "fun", text: "fun", base: 2 },
  { id: "happy", text: "happy", base: 2 },
  { id: "awesome", text: "awesome", base: 2 },
  { id: "sick", text: "sick", base: -2 }, // slang twist! most read "sick" = bad
  { id: "ok", text: "ok", base: 0 },
  { id: "fine", text: "fine", base: 0 },
  { id: "boring", text: "boring", base: -2 },
  { id: "bad", text: "bad", base: -2 },
  { id: "sad", text: "sad", base: -2 },
  { id: "hate", text: "hate", base: -2 },
  { id: "angry", text: "angry", base: -2 },
  { id: "terrible", text: "terrible", base: -2 },
];

const LEX_BY_ID = new Map(LEXICON.map((w) => [w.id, w]));

// Preset messages, each a list of tokens. Tokens that match a lexicon id are
// "feeling words"; the rest are plain filler the AI ignores (weight 0).
interface Msg {
  id: number;
  emoji: string;
  tokens: string[]; // display tokens (filler shown grey, feeling words live)
}

const MESSAGES: Msg[] = [
  { id: 0, emoji: "🎉", tokens: ["I", "love", "this", "it", "is", "so", "fun"] },
  { id: 1, emoji: "😴", tokens: ["this", "movie", "is", "boring", "and", "bad"] },
  { id: 2, emoji: "🏆", tokens: ["a", "great", "and", "happy", "awesome", "day"] },
  { id: 3, emoji: "😤", tokens: ["I", "hate", "it", "so", "angry", "and", "sad"] },
  { id: 4, emoji: "🤷", tokens: ["it", "is", "ok", "I", "guess", "it", "is", "fine"] },
  { id: 5, emoji: "🎮", tokens: ["this", "game", "is", "sick"] }, // ambiguous slang
];

// A token is a feeling word iff its lowercase matches a lexicon id.
const feelId = (tok: string): string | null =>
  LEX_BY_ID.has(tok.toLowerCase()) ? tok.toLowerCase() : null;

export default function MoodMeter() {
  // Live weight overrides keyed by word id (defaults to each word's base).
  const [weights, setWeights] = useState<Record<string, Weight>>({});
  const [pickedId, setPickedId] = useState<number>(0);
  const [flippedSick, setFlippedSick] = useState(false);

  const weightOf = useCallback(
    (id: string): Weight => weights[id] ?? LEX_BY_ID.get(id)!.base,
    [weights],
  );

  const cycle = useCallback(
    (id: string) => {
      // - → neutral → + → - … (cycle the three feelings)
      const order: Weight[] = [-2, 0, 2];
      const cur = weightOf(id);
      const next = order[(order.indexOf(cur) + 1) % order.length] ?? 0;
      setWeights((prev) => ({ ...prev, [id]: next }));
      if (id === "sick") setFlippedSick(true);
    },
    [weightOf],
  );

  const picked = MESSAGES.find((m) => m.id === pickedId) ?? MESSAGES[0]!;

  // Score the picked message: sum the weights of its feeling words.
  const scored = useMemo(() => {
    let score = 0;
    const parts = picked.tokens.map((tok, i) => {
      const id = feelId(tok);
      const w = id ? weightOf(id) : 0;
      score += w;
      return { key: `${tok}-${i}`, tok, id, w };
    });
    const mood: "happy" | "mad" | "meh" =
      score > 0 ? "happy" : score < 0 ? "mad" : "meh";
    return { score, parts, mood };
  }, [picked, weightOf]);

  const MOOD = {
    happy: { face: "😀", label: "HAPPY", color: "#34d399" },
    meh: { face: "😐", label: "NEUTRAL", color: ACCENT },
    mad: { face: "😠", label: "SAD / MAD", color: "#fb7185" },
  } as const;
  const mood = MOOD[scored.mood];

  // Meter fill: map score (-6..+6 reasonable range) to a 0..100 position.
  const pct = Math.max(0, Math.min(100, 50 + (scored.score / 8) * 50));

  const sickW = weightOf("sick");
  const teach =
    feelId("sick") && picked.id === 5
      ? sickW < 0
        ? "🎮 The AI reads “sick” as a BAD word, so it guesses SAD/MAD. But you meant it's awesome! Flip “sick” to + and watch the mood change…"
        : "✨ Aha! You taught the AI that “sick” means awesome — now it reads the message as HAPPY. Same word, opposite meaning: words are ambiguous, so the AI can be fooled."
      : scored.score > 0
        ? `😀 Feeling words add up to +${scored.score} → the AI guesses HAPPY. Sentiment = the SUM of word feelings.`
        : scored.score < 0
          ? `😠 Feeling words add up to ${scored.score} → the AI guesses SAD/MAD. Text is just data the AI counts up.`
          : "😐 The good and bad words cancel out to 0 → NEUTRAL. Flip a word to tip the balance!";

  return (
    <div
      className="w-full"
      style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-4">
        <span aria-hidden className="text-2xl">😀</span>
        <span className="text-base font-semibold tracking-wide">Mood Meter</span>
        <span
          className="rounded-md px-2 py-0.5 font-mono text-[10px]"
          style={{ background: `${ACCENT}1a`, color: ACCENT, border: `1px solid ${ACCENT}55` }}
        >
          Grades 5-7
        </span>
        <span className="font-mono text-[11px] text-[#5b6b8c]">NLP · sentiment</span>
      </div>
      <p
        aria-live="polite"
        className="px-4 pt-1.5 font-mono text-[11px] leading-relaxed text-[#9fb0d0]"
      >
        {teach}
      </p>

      <div className="flex flex-col gap-4 p-4 lg:flex-row">
        {/* Left: messages + reading */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Pick a message */}
          <div className="rounded-2xl border border-[#1e2738] bg-[#0f1420] p-3">
            <p className="mb-2 font-mono text-[10px] tracking-wide text-[#5b6b8c]">
              PICK A MESSAGE
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {MESSAGES.map((m) => {
                const on = m.id === picked.id;
                const text = m.tokens.join(" ");
                return (
                  <button
                    key={m.id}
                    onClick={() => setPickedId(m.id)}
                    className="flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-left transition-colors"
                    style={{
                      borderColor: on ? ACCENT : "#1e2738",
                      background: on ? `${ACCENT}1a` : "transparent",
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{m.emoji}</span>
                    <span className="font-mono text-[12px] leading-snug text-[#e8eefc]">
                      “{text}”
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* How the AI reads it */}
          <div className="rounded-2xl border border-[#1e2738] bg-[#0b1018] p-3">
            <p className="mb-3 font-mono text-[10px] tracking-wide text-[#5b6b8c]">
              HOW THE AI READS IT — each feeling word adds its number
            </p>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
              {scored.parts.map((p) => {
                if (!p.id) {
                  return (
                    <span
                      key={p.key}
                      className="font-mono text-[15px] text-[#5b6b8c]"
                    >
                      {p.tok}
                    </span>
                  );
                }
                const c = p.w > 0 ? "#34d399" : p.w < 0 ? "#fb7185" : ACCENT;
                return (
                  <span
                    key={p.key}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-mono text-[15px]"
                    style={{ background: `${c}22`, border: `1px solid ${c}66`, color: c }}
                  >
                    {p.tok}
                    <span className="text-[11px] font-bold">
                      {p.w > 0 ? `+${p.w}` : p.w === 0 ? "0" : p.w}
                    </span>
                  </span>
                );
              })}
            </div>

            {/* Sum line */}
            <div className="mt-3 flex items-center gap-2 font-mono text-[12px] text-[#9fb0d0]">
              <span>add it all up</span>
              <span aria-hidden>→</span>
              <span
                className="rounded-md px-2 py-0.5 text-[14px] font-bold"
                style={{ background: `${mood.color}22`, color: mood.color }}
              >
                {scored.score > 0 ? `+${scored.score}` : scored.score}
              </span>
            </div>
          </div>
        </div>

        {/* Right: the mood meter + lexicon */}
        <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[300px]">
          {/* Meter */}
          <div className="rounded-2xl border border-[#1e2738] bg-[#0f1420] p-3">
            <p className="mb-2 font-mono text-[10px] tracking-wide text-[#5b6b8c]">
              MOOD METER
            </p>
            <div className="flex flex-col items-center gap-2 py-1">
              <span style={{ fontSize: 52, lineHeight: 1 }}>{mood.face}</span>
              <span
                className="font-mono text-sm font-bold tracking-wide"
                style={{ color: mood.color }}
              >
                {mood.label}
              </span>
            </div>
            {/* bar: 😠 …… 😐 …… 😀 */}
            <div className="mt-2">
              <div
                className="relative h-3 w-full rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg,#fb718533,#eab30833 50%,#34d39933)",
                  border: "1px solid #1e2738",
                }}
              >
                <div
                  className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                  style={{
                    left: `${pct}%`,
                    background: mood.color,
                    borderColor: "#0b1018",
                    transition: "left 0.35s ease, background 0.2s ease",
                  }}
                />
              </div>
              <div className="mt-1 flex justify-between font-mono text-[14px]">
                <span>😠</span>
                <span>😐</span>
                <span>😀</span>
              </div>
            </div>
          </div>

          {/* Lexicon — flip word feelings */}
          <div className="rounded-2xl border border-[#1e2738] bg-[#0f1420] p-3">
            <p className="mb-1 font-mono text-[10px] tracking-wide text-[#5b6b8c]">
              WORD FEELINGS — tap a chip to flip it
            </p>
            <p className="mb-2 font-mono text-[9px] leading-snug text-[#5b6b8c]">
              <span style={{ color: "#34d399" }}>+ good</span> ·{" "}
              <span style={{ color: ACCENT }}>0 neutral</span> ·{" "}
              <span style={{ color: "#fb7185" }}>− bad</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {LEXICON.map((w) => {
                const cur = weightOf(w.id);
                const c = cur > 0 ? "#34d399" : cur < 0 ? "#fb7185" : ACCENT;
                const inMsg = picked.tokens.some((t) => feelId(t) === w.id);
                const isSick = w.id === "sick";
                return (
                  <button
                    key={w.id}
                    onClick={() => cycle(w.id)}
                    title={`Flip “${w.text}” feeling`}
                    className="inline-flex items-center gap-1 rounded-lg border-2 px-2 py-1 font-mono text-[12px] transition-colors"
                    style={{
                      borderColor: c,
                      background: `${c}1a`,
                      color: c,
                      outline: inMsg ? `2px solid ${c}` : "none",
                      outlineOffset: inMsg ? "1px" : undefined,
                      animation:
                        isSick && !flippedSick ? "moodWobble 1.6s ease-in-out infinite" : undefined,
                    }}
                  >
                    {w.text}
                    <span className="text-[10px] font-bold">
                      {cur > 0 ? "+" : cur < 0 ? "−" : "0"}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => {
                setWeights({});
                setFlippedSick(false);
              }}
              className="mt-2 w-full rounded-lg border border-[#2a3550] py-1.5 font-mono text-[10px] text-[#9fb0d0] transition-colors hover:border-[#eab308] hover:text-[#eab308]"
            >
              🔄 Reset word feelings
            </button>
          </div>

          <p className="rounded-xl border border-[#1e2738] bg-[#0f1420] p-2.5 font-mono text-[10px] leading-relaxed text-[#5b6b8c]">
            To a computer, text is just <span style={{ color: ACCENT }}>data</span>. It
            scores mood by adding up word feelings — so tricky or slangy words like
            “sick” can <span style={{ color: ACCENT }}>fool</span> it.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes moodWobble {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-4deg); }
          75% { transform: rotate(4deg); }
        }
      `}</style>
    </div>
  );
}
