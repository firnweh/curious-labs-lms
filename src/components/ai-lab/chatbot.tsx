"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * AI Lab — "Chatbot Brain".
 *
 * A kid-facing peek inside how a school chatbot understands you. The child taps
 * a preset message; the bot tokenises it, scores each INTENT by how many of its
 * KEYWORDS overlap, picks the best, and replies — showing the matched keywords
 * and a CONFIDENCE bar. When nothing matches (confidence 0) it does NOT guess —
 * it hands over to a human. The child can ADD a keyword to any intent and watch
 * a previously-stuck message suddenly get understood.
 *
 * Teaches: intent, keywords, confidence, and that good AI knows when to defer.
 * Deterministic, self-contained, no deps.
 */

const ACCENT = "#60a5fa";

interface Intent {
  id: string;
  label: string;
  emoji: string;
  color: string;
  keywords: string[];
  reply: string;
}

const BASE_INTENTS: Intent[] = [
  { id: "greeting", label: "Greeting", emoji: "👋", color: "#34d399", keywords: ["hi", "hello", "hey"], reply: "Hi! 👋 How can I help?" },
  { id: "timetable", label: "Timetable", emoji: "📅", color: "#60a5fa", keywords: ["when", "test", "exam", "class", "schedule"], reply: "Your timetable is on the board 📅" },
  { id: "homework", label: "Homework", emoji: "✏️", color: "#a855f7", keywords: ["homework", "assignment", "due"], reply: "Homework is in the diary ✏️" },
  { id: "goodbye", label: "Goodbye", emoji: "🙋", color: "#eab308", keywords: ["bye", "thanks", "thank"], reply: "Bye! 👋" },
];

// Preset messages a child can send. The last one matches NO keyword → fallback.
const PRESETS: string[] = [
  "hello there",
  "when is the maths test?",
  "is the homework due today?",
  "thanks bye",
  "what class do we have next?",
  "can I bring my dog to school?",
];

const FALLBACK = "I'm not sure — please ask a teacher 🧑‍🏫";

/** Split a sentence into lowercase word tokens (letters only). */
function tokenise(text: string): string[] {
  return text.toLowerCase().match(/[a-z]+/g) ?? [];
}

interface Score {
  intent: Intent;
  matched: string[];
  score: number;
}

/** Score every intent by keyword overlap; sort best-first. */
function scoreIntents(text: string, intents: Intent[]): Score[] {
  const words = new Set(tokenise(text));
  return intents
    .map((intent) => {
      const matched = intent.keywords.filter((k) => words.has(k));
      return { intent, matched, score: matched.length };
    })
    .sort((a, b) => b.score - a.score);
}

export default function Chatbot() {
  const [intents, setIntents] = useState<Intent[]>(BASE_INTENTS);
  const [sent, setSent] = useState<string | null>(null);
  const [addTo, setAddTo] = useState<string>("timetable");
  const [draftWord, setDraftWord] = useState("");

  const scores = useMemo(() => (sent === null ? null : scoreIntents(sent, intents)), [sent, intents]);
  const best = scores?.[0] ?? null;
  // Top possible score across all intents = how many keywords matched the winner.
  const won = best && best.score > 0 ? best : null;
  const reply = sent === null ? null : won ? won.intent.reply : FALLBACK;

  const send = useCallback((msg: string) => setSent(msg), []);

  const addKeyword = useCallback(() => {
    const word = tokenise(draftWord)[0];
    if (!word) return;
    setIntents((prev) =>
      prev.map((it) =>
        it.id === addTo && !it.keywords.includes(word)
          ? { ...it, keywords: [...it.keywords, word] }
          : it,
      ),
    );
    setDraftWord("");
  }, [draftWord, addTo]);

  const reset = useCallback(() => {
    setIntents(BASE_INTENTS);
    setSent(null);
    setDraftWord("");
    setAddTo("timetable");
  }, []);

  const teach =
    sent === null
      ? "💬 Tap a message to send it to the chatbot. Watch it figure out what you MEAN."
      : won === null
        ? "🧑‍🏫 No keywords matched, so confidence is 0. A good AI does NOT guess — it hands you to a human. Try teaching it a new keyword below!"
        : `🧠 The bot scored each intent by matched keywords. "${won.intent.label}" won with ${won.matched.length} match${won.matched.length > 1 ? "es" : ""} → that's its INTENT, and the matched words are the KEYWORDS that gave it confidence.`;

  return (
    <div className="w-full" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      {/* Header row */}
      <div className="mb-3 flex flex-wrap items-center gap-2 px-1">
        <span aria-hidden style={{ fontSize: 26 }}>💬</span>
        <span className="text-base font-semibold">Chatbot Brain</span>
        <span
          className="rounded-md border px-1.5 py-0.5 font-mono text-[10px]"
          style={{ borderColor: `${ACCENT}55`, background: `${ACCENT}1a`, color: ACCENT }}
        >
          Grades 6-8
        </span>
        <span className="font-mono text-[11px] text-[#5b6b8c]">· NLP · intent</span>
      </div>
      <p className="mb-4 px-1 font-mono text-[11px] leading-relaxed text-[#9fb0d0]" aria-live="polite">
        {teach}
      </p>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* LEFT — chat */}
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {/* Chat window */}
          <div className="rounded-2xl border border-[#1e2738] p-3" style={{ background: "#0b1018", minHeight: 200 }}>
            <p className="mb-3 font-mono text-[10px] tracking-wide text-[#5b6b8c]">SCHOOL BOT</p>
            <div className="flex flex-col gap-3">
              {/* Child bubble */}
              {sent !== null && (
                <div className="flex justify-end">
                  <div
                    className="max-w-[80%] rounded-2xl rounded-br-sm px-3 py-2 text-sm"
                    style={{ background: `${ACCENT}1a`, border: `1px solid ${ACCENT}55`, color: "#e8eefc" }}
                  >
                    {sent}
                  </div>
                </div>
              )}
              {/* Bot bubble */}
              {reply !== null && (
                <div className="flex justify-start">
                  <div
                    className="flex max-w-[80%] items-start gap-2 rounded-2xl rounded-bl-sm border border-[#1e2738] bg-[#0f1420] px-3 py-2 text-sm"
                    style={{ color: won ? "#e8eefc" : "#fb7185" }}
                  >
                    <span aria-hidden>{won ? won.intent.emoji : "🧑‍🏫"}</span>
                    <span>{reply}</span>
                  </div>
                </div>
              )}
              {sent === null && (
                <p className="py-6 text-center font-mono text-[11px] text-[#5b6b8c]">
                  Pick a message below to start chatting 👇
                </p>
              )}
            </div>
          </div>

          {/* Preset messages */}
          <div className="rounded-2xl border border-[#1e2738] bg-[#0f1420] p-3">
            <p className="mb-2 font-mono text-[10px] tracking-wide text-[#5b6b8c]">SEND A MESSAGE</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PRESETS.map((msg) => {
                const on = sent === msg;
                return (
                  <button
                    key={msg}
                    onClick={() => send(msg)}
                    className="rounded-xl border-2 px-3 py-2 text-left text-sm transition-colors"
                    style={{
                      borderColor: on ? ACCENT : "#1e2738",
                      background: on ? `${ACCENT}1a` : "transparent",
                      color: on ? "#e8eefc" : "#9fb0d0",
                    }}
                  >
                    {msg}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT — brain */}
        <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[320px]">
          {/* Intent scoreboard */}
          <div className="rounded-2xl border border-[#1e2738] bg-[#0f1420] p-3">
            <p className="mb-2 font-mono text-[10px] tracking-wide text-[#5b6b8c]">INTENT SCORES</p>
            <div className="flex flex-col gap-2">
              {(scores ?? intents.map((intent) => ({ intent, matched: [] as string[], score: 0 }))).map(
                ({ intent, matched, score }) => {
                  const isWinner = won?.intent.id === intent.id;
                  // Confidence bar: share of this intent's keywords that matched.
                  const conf = intent.keywords.length ? score / intent.keywords.length : 0;
                  return (
                    <div
                      key={intent.id}
                      className="rounded-xl border px-2.5 py-2 transition-colors"
                      style={{
                        borderColor: isWinner ? intent.color : "#1e2738",
                        background: isWinner ? `${intent.color}1a` : "transparent",
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span aria-hidden>{intent.emoji}</span>
                        <span className="font-mono text-xs" style={{ color: intent.color }}>
                          {intent.label}
                        </span>
                        <span className="ml-auto font-mono text-[10px] text-[#5b6b8c]">
                          {score} match{score === 1 ? "" : "es"}
                        </span>
                      </div>
                      {/* confidence bar */}
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#0b1018]">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${Math.round(conf * 100)}%`, background: intent.color }}
                        />
                      </div>
                      {/* keyword chips */}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {intent.keywords.map((k) => {
                          const hit = matched.includes(k);
                          return (
                            <span
                              key={k}
                              className="rounded-md px-1.5 py-0.5 font-mono text-[9px]"
                              style={{
                                background: hit ? intent.color : "#0b1018",
                                color: hit ? "#0b1018" : "#5b6b8c",
                                border: `1px solid ${hit ? intent.color : "#1e2738"}`,
                                fontWeight: hit ? 700 : 400,
                              }}
                            >
                              {k}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </div>

          {/* Teach a keyword */}
          <div className="rounded-2xl border border-[#1e2738] bg-[#0f1420] p-3">
            <p className="mb-2 font-mono text-[10px] tracking-wide text-[#5b6b8c]">TEACH A KEYWORD</p>
            <div className="mb-2 grid grid-cols-2 gap-1.5">
              {intents.map((it) => {
                const on = addTo === it.id;
                return (
                  <button
                    key={it.id}
                    onClick={() => setAddTo(it.id)}
                    className="rounded-lg border-2 px-2 py-1.5 font-mono text-[10px] transition-colors"
                    style={{
                      borderColor: on ? it.color : "#1e2738",
                      background: on ? `${it.color}1a` : "transparent",
                      color: on ? it.color : "#9fb0d0",
                    }}
                  >
                    {it.emoji} {it.label}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input
                value={draftWord}
                onChange={(e) => setDraftWord(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addKeyword();
                }}
                placeholder="new word, e.g. dog"
                className="min-w-0 flex-1 rounded-lg border border-[#1e2738] bg-[#0b1018] px-2.5 py-1.5 font-mono text-xs text-[#e8eefc] outline-none placeholder:text-[#5b6b8c] focus:border-[#60a5fa]"
              />
              <button
                onClick={addKeyword}
                disabled={tokenise(draftWord).length === 0}
                className="rounded-lg border-2 px-3 py-1.5 font-mono text-xs transition-colors disabled:opacity-40"
                style={{ borderColor: ACCENT, color: ACCENT, background: `${ACCENT}1a` }}
              >
                + Add
              </button>
            </div>
            <p className="mt-2 font-mono text-[10px] leading-relaxed text-[#5b6b8c]">
              Add <span style={{ color: ACCENT }}>dog</span> to an intent, then re-send the dog
              message — the bot will finally understand it!
            </p>
          </div>

          <button
            onClick={reset}
            className="rounded-xl border border-[#2a3550] py-2 font-mono text-[11px] text-[#9fb0d0] transition-colors hover:border-[#fb7185] hover:text-[#fb7185]"
          >
            🔄 Reset bot
          </button>

          <p className="rounded-xl border border-[#1e2738] bg-[#0f1420] p-2.5 font-mono text-[10px] leading-relaxed text-[#5b6b8c]">
            The bot has no real understanding — it just counts matching <span style={{ color: ACCENT }}>keywords</span> to guess your{" "}
            <span style={{ color: ACCENT }}>intent</span>. When <span className="text-[#fb7185]">confidence is 0</span>, a good AI hands you to a human instead of guessing.
          </p>
        </div>
      </div>
    </div>
  );
}
