"use client";
// Learning goal: an NLP classifier turns text into keyword features, predicts an
// intent by weighted match, and uses a confidence THRESHOLD to admit "I don't know".
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

const ACCENT = "#a855f7";

type IntentId = "greeting" | "farewell" | "question" | "complaint" | "request";

interface Intent {
  id: IntentId;
  label: string;
  emoji: string;
  reply: string;
}

const INTENTS: readonly Intent[] = [
  { id: "greeting", label: "Greeting", emoji: "👋", reply: "Hello there! How can I help?" },
  { id: "farewell", label: "Farewell", emoji: "👋", reply: "Goodbye — talk soon!" },
  { id: "question", label: "Question", emoji: "❓", reply: "Great question — here is the answer." },
  { id: "complaint", label: "Complaint", emoji: "⚠️", reply: "I'm sorry about that. Let me fix it." },
  { id: "request", label: "Request", emoji: "📦", reply: "Sure — I'll take care of that for you." },
] as const;

/** Each keyword chip belongs to exactly one correct intent bucket. */
interface Keyword {
  word: string;
  intent: IntentId;
}

const KEYWORDS: readonly Keyword[] = [
  { word: "hello", intent: "greeting" },
  { word: "hi", intent: "greeting" },
  { word: "bye", intent: "farewell" },
  { word: "goodbye", intent: "farewell" },
  { word: "what", intent: "question" },
  { word: "how", intent: "question" },
  { word: "broken", intent: "complaint" },
  { word: "wrong", intent: "complaint" },
  { word: "please", intent: "request" },
  { word: "send", intent: "request" },
] as const;

/** A test message: its tokens, the intent we expect, or null if it must fall back. */
interface TestMsg {
  text: string;
  expect: IntentId | null;
}

/**
 * Eight test messages. Seven map cleanly to one intent via the keywords above.
 * The last is deliberately AMBIGUOUS — it shares one weak token with two intents
 * so its top confidence stays low and MUST trigger the fallback, not a wrong guess.
 */
const TESTS: readonly TestMsg[] = [
  { text: "hello there", expect: "greeting" },
  { text: "hi friend", expect: "greeting" },
  { text: "goodbye now", expect: "farewell" },
  { text: "bye then", expect: "farewell" },
  { text: "what time is it", expect: "question" },
  { text: "this is broken", expect: "complaint" },
  { text: "please send it", expect: "request" },
  { text: "umm well maybe", expect: null }, // no known keywords → low confidence
] as const;

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Deterministic "model": for a message, score each intent by how many of its
 * assigned keywords appear in the tokens. Confidence = topScore / totalMatches,
 * a stand-in for a normalised TF-IDF / Naive-Bayes posterior in [0,1].
 */
interface Prediction {
  intent: IntentId | null;
  confidence: number;
}

function predict(tokens: string[], assign: Record<string, IntentId | null>): Prediction {
  const score: Record<IntentId, number> = {
    greeting: 0,
    farewell: 0,
    question: 0,
    complaint: 0,
    request: 0,
  };
  let total = 0;
  for (const tok of tokens) {
    const intent = assign[tok];
    if (intent) {
      score[intent] += 1;
      total += 1;
    }
  }
  if (total === 0) return { intent: null, confidence: 0 };
  let best: IntentId = "greeting";
  let bestVal = -1;
  (Object.keys(score) as IntentId[]).forEach((k) => {
    if (score[k] > bestVal) {
      bestVal = score[k];
      best = k;
    }
  });
  return { intent: best, confidence: bestVal / total };
}

const intentOf = (id: IntentId | null): Intent | undefined =>
  INTENTS.find((i) => i.id === id);

export default function ChatbotIntentTrainer({ onComplete }: ActivityProps) {
  // assignment: keyword -> chosen intent bucket (null = not yet placed)
  const [assign, setAssign] = useState<Record<string, IntentId | null>>(() => {
    const init: Record<string, IntentId | null> = {};
    KEYWORDS.forEach((k) => (init[k.word] = null));
    return init;
  });
  const [picked, setPicked] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<number>(0.3);
  const [sentIdx, setSentIdx] = useState<number>(0); // how many tests have been run
  const [status, setStatus] = useState<string>(
    "Stage 1 — drop each keyword into the intent it signals.",
  );
  const [done, setDone] = useState<boolean>(false);
  const firedRef = useRef<boolean>(false);

  const allAssigned = useMemo(
    () => KEYWORDS.every((k) => assign[k.word] !== null),
    [assign],
  );

  // Evaluate the model over the messages the learner has already sent.
  const results = useMemo(() => {
    return TESTS.slice(0, sentIdx).map((m) => {
      const p = predict(tokenize(m.text), assign);
      const belowThreshold = p.confidence < threshold || p.intent === null;
      const shown: IntentId | null = belowThreshold ? null : p.intent;
      const correct = shown === m.expect;
      return { msg: m, pred: p, shown, correct, belowThreshold };
    });
  }, [assign, threshold, sentIdx]);

  const correctCount = useMemo(
    () => results.reduce((n, r) => (r.correct ? n + 1 : n), 0),
    [results],
  );

  const pickChip = useCallback(
    (word: string): void => {
      if (done) return;
      setPicked((prev) => (prev === word ? null : word));
    },
    [done],
  );

  const dropInto = useCallback(
    (intent: IntentId): void => {
      if (done || picked === null) return;
      const kw = KEYWORDS.find((k) => k.word === picked);
      if (!kw) return;
      setAssign((prev) => ({ ...prev, [picked]: intent }));
      setPicked(null);
      if (kw.intent === intent) {
        setStatus(`"${picked}" → ${intentOf(intent)?.label}. Good signal!`);
      } else {
        setStatus(`"${picked}" placed — but does it really mean ${intentOf(intent)?.label}?`);
        onComplete({ passed: false, detail: "Re-home that keyword to its true intent." });
      }
    },
    [done, picked, onComplete],
  );

  const removeFrom = useCallback(
    (word: string): void => {
      if (done) return;
      setAssign((prev) => ({ ...prev, [word]: null }));
    },
    [done],
  );

  const sendNext = useCallback((): void => {
    if (done) return;
    if (!allAssigned) {
      setStatus("Place every keyword chip before chatting.");
      return;
    }
    if (sentIdx >= TESTS.length) return;
    const next = sentIdx + 1;
    setSentIdx(next);
    if (next < TESTS.length) {
      setStatus(`Stage 2 — sent ${next} / ${TESTS.length} test messages.`);
    }

    // When the last message is sent, grade the full run deterministically.
    if (next === TESTS.length) {
      const all = TESTS.map((m) => {
        const p = predict(tokenize(m.text), assign);
        const below = p.confidence < threshold || p.intent === null;
        const shown: IntentId | null = below ? null : p.intent;
        return shown === m.expect;
      });
      const everyRight = all.every(Boolean);
      if (everyRight && !firedRef.current) {
        firedRef.current = true;
        setDone(true);
        setStatus("All 8 intents correct — your chatbot is trained! ✨🎉");
        onComplete({ passed: true, stars: 3, detail: "8/8 intents correct, fallback tuned." });
      } else if (!everyRight) {
        const ambiguous = TESTS[TESTS.length - 1];
        const ap = predict(tokenize(ambiguous.text), assign);
        if (ap.confidence >= threshold) {
          setStatus("The bot guessed on a confusing message — raise the threshold a little.");
        } else {
          setStatus("Some intents are off — fix a keyword, then re-run the chat.");
        }
        onComplete({ passed: false, detail: "Re-run after adjusting keywords or threshold." });
      }
    }
  }, [done, allAssigned, sentIdx, assign, threshold, onComplete]);

  const replayChat = useCallback((): void => {
    if (done) return;
    setSentIdx(0);
    setStatus("Chat cleared — send the messages again.");
  }, [done]);

  const reset = useCallback((): void => {
    const cleared: Record<string, IntentId | null> = {};
    KEYWORDS.forEach((k) => (cleared[k.word] = null));
    setAssign(cleared);
    setPicked(null);
    setThreshold(0.3);
    setSentIdx(0);
    setDone(false);
    firedRef.current = false;
    setStatus("Stage 1 — drop each keyword into the intent it signals.");
  }, []);

  const unplaced = KEYWORDS.filter((k) => assign[k.word] === null);

  return (
    <div
      className="mx-auto flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink"
      style={{ touchAction: "manipulation" }}
    >
      <style>{`
        @keyframes g8chatbotintent-pop { 0%{transform:scale(.7);opacity:0} 100%{transform:scale(1);opacity:1} }
        @keyframes g8chatbotintent-glow { 0%,100%{box-shadow:0 0 0 1px ${ACCENT}} 50%{box-shadow:0 0 18px -2px ${ACCENT}} }
        @keyframes g8chatbotintent-bar { from{width:0} }
      `}</style>

      {/* Header / status */}
      <div
        className="panel rounded-xl p-3"
        style={done ? { animation: "g8chatbotintent-glow 1.6s ease-in-out infinite" } : undefined}
      >
        <div className="flex items-center justify-between">
          <span className="font-display text-sm" style={{ color: ACCENT }}>
            💬 Chatbot Intent Trainer
          </span>
          <span className="text-xs text-ink-faint">
            acc {correctCount}/{TESTS.length}
          </span>
        </div>
        <p role="status" aria-live="polite" className="mt-1 text-[12px] leading-snug text-ink-dim">
          {status}
        </p>
      </div>

      {/* Stage 1 — keyword chips to place */}
      <div className="panel rounded-xl p-3">
        <p className="mb-2 text-[11px] uppercase tracking-wide text-ink-faint">
          Keyword features {unplaced.length > 0 ? `· tap one, then a bucket` : "· all placed ✓"}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {unplaced.length === 0 && (
            <span className="text-[11px] text-ink-faint">Every chip is in a bucket.</span>
          )}
          {unplaced.map((k) => {
            const active = picked === k.word;
            return (
              <button
                key={k.word}
                type="button"
                onPointerDown={() => pickChip(k.word)}
                aria-label={`Keyword ${k.word}${active ? ", selected" : ""}`}
                aria-pressed={active}
                className="rounded-full px-2.5 py-1 text-xs font-medium transition"
                style={{
                  animation: "g8chatbotintent-pop 160ms ease",
                  border: `1px solid ${active ? ACCENT : "var(--color-line, #27314f)"}`,
                  background: active ? ACCENT : "rgba(11,16,32,0.6)",
                  color: active ? "#05070d" : "#cbd3ef",
                }}
              >
                {k.word}
              </button>
            );
          })}
        </div>
      </div>

      {/* Intent buckets */}
      <div className="grid grid-cols-1 gap-2">
        {INTENTS.map((it) => {
          const inBucket = KEYWORDS.filter((k) => assign[k.word] === it.id);
          return (
            <div
              key={it.id}
              role="button"
              tabIndex={0}
              aria-label={`Drop selected keyword into ${it.label}`}
              onPointerDown={() => dropInto(it.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") dropInto(it.id);
              }}
              className="panel rounded-lg p-2"
              style={{
                cursor: picked ? "pointer" : "default",
                border: `1px solid ${picked ? ACCENT : "var(--color-line, #27314f)"}`,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-dim">
                  {it.emoji} {it.label}
                </span>
                <span className="text-[10px] text-ink-faint">{inBucket.length} kw</span>
              </div>
              <div className="mt-1 flex min-h-[20px] flex-wrap gap-1">
                {inBucket.map((k) => {
                  const ok = k.intent === it.id;
                  return (
                    <button
                      key={k.word}
                      type="button"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        removeFrom(k.word);
                      }}
                      aria-label={`Remove ${k.word} from ${it.label}`}
                      className="rounded-full px-2 py-0.5 text-[11px]"
                      style={{
                        border: `1px solid ${ok ? ACCENT : "#f8717155"}`,
                        background: ok ? "rgba(168,85,247,0.18)" : "rgba(248,113,113,0.12)",
                        color: ok ? ACCENT : "#fca5a5",
                      }}
                    >
                      {k.word} ×
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Threshold slider */}
      <div className="panel rounded-xl p-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="flex items-center justify-between">
            <span className="text-ink-dim">Confidence threshold</span>
            <span className="font-display tabular-nums" style={{ color: ACCENT }}>
              {threshold.toFixed(2)}
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            disabled={done}
            aria-label={`Confidence threshold, current ${threshold.toFixed(2)}`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2"
            style={{ accentColor: ACCENT }}
          />
          <span className="text-[10px] leading-tight text-ink-faint">
            Below this, the bot replies &quot;I didn&apos;t understand&quot; instead of guessing.
          </span>
        </label>
      </div>

      {/* Chat / test run */}
      <div className="panel flex flex-col gap-2 rounded-xl p-3">
        <div className="flex flex-col gap-1.5">
          {results.map((r, i) => {
            const it = intentOf(r.shown);
            return (
              <div key={i} className="flex flex-col gap-0.5" style={{ animation: "g8chatbotintent-pop 160ms ease" }}>
                <div className="flex items-center justify-between">
                  <span className="rounded-lg bg-panel-2 px-2 py-0.5 text-[11px] text-ink-dim">
                    🧑 {r.msg.text}
                  </span>
                  <span className="text-[11px]" aria-label={r.correct ? "correct" : "incorrect"}>
                    {r.correct ? "✅" : "❌"}
                  </span>
                </div>
                <div className="flex items-center gap-2 pl-3">
                  <span className="text-[11px] text-ink-dim">
                    🤖 {r.belowThreshold ? "I didn't understand." : it ? it.reply : ""}
                  </span>
                </div>
                {!r.belowThreshold && it && (
                  <div className="ml-3 flex items-center gap-2">
                    <span className="text-[10px] text-ink-faint">{it.label}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${Math.round(r.pred.confidence * 100)}%`,
                          background: ACCENT,
                          animation: "g8chatbotintent-bar 400ms ease",
                        }}
                      />
                    </span>
                    <span className="text-[10px] tabular-nums text-ink-faint">
                      {Math.round(r.pred.confidence * 100)}%
                    </span>
                  </div>
                )}
              </div>
            );
          })}
          {sentIdx === 0 && (
            <p className="text-[11px] text-ink-faint">
              Train the buckets, then press Send to run the 8 test messages.
            </p>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onPointerDown={sendNext}
            disabled={done || sentIdx >= TESTS.length}
            className="rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            style={{ background: ACCENT, color: "#05070d" }}
            aria-label="Send the next test message to the chatbot"
          >
            {sentIdx >= TESTS.length ? "Run complete" : `Send (${sentIdx}/${TESTS.length})`}
          </button>
          <button
            type="button"
            onPointerDown={replayChat}
            disabled={done || sentIdx === 0}
            className="rounded-lg border border-line bg-panel/60 px-3 py-1.5 text-xs font-medium text-ink-dim disabled:opacity-40"
            aria-label="Clear the chat and re-run from the first message"
          >
            Re-run
          </button>
          <button
            type="button"
            onPointerDown={reset}
            className="ml-auto rounded-lg border border-line bg-panel/60 px-3 py-1.5 text-xs font-medium text-ink-dim"
            aria-label="Reset the whole lab"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Win celebration */}
      {done && (
        <div
          className="panel rounded-xl p-3 text-center"
          style={{ border: `1px solid ${ACCENT}` }}
          role="status"
          aria-label="Lab complete"
        >
          <div className="text-2xl">✨🎉</div>
          <div className="mt-1 font-display text-sm" style={{ color: ACCENT }}>
            Intent model trained! ⭐⭐⭐
          </div>
          <p className="mt-1 text-[11px] text-ink-faint">
            All 8 messages classified and the ambiguous one fell back politely.
          </p>
        </div>
      )}
    </div>
  );
}
