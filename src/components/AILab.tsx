"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";

/**
 * Neural Lab — the AI platform shell (sibling of the coding Studio and Maker
 * Lab). A three-level launcher so the full activity list is NEVER dumped on a
 * student up front:
 *   1. TOPIC TILES  — pick an AI area (no activities shown yet)
 *   2. ACTIVITIES   — just that topic's experiment cards
 *   3. EXPERIMENT   — the chosen experiment, full-screen
 * Filtering is by topic/interest, never by grade. Each experiment is a
 * self-contained component under ./ai-lab, lazy-loaded on selection.
 */

const Loading = () => (
  <div className="grid h-full place-items-center font-mono text-xs text-[#5b6b8c]">Loading experiment…</div>
);

const COMP: Record<string, ReturnType<typeof dynamic>> = {
  awareness: dynamic(() => import("./ai-lab/awareness"), { ssr: false, loading: Loading }),
  classifier: dynamic(() => import("./ai-lab/classifier"), { ssr: false, loading: Loading }),
  clustering: dynamic(() => import("./ai-lab/clustering"), { ssr: false, loading: Loading }),
  sentiment: dynamic(() => import("./ai-lab/sentiment"), { ssr: false, loading: Loading }),
  chatbot: dynamic(() => import("./ai-lab/chatbot"), { ssr: false, loading: Loading }),
  vision: dynamic(() => import("./ai-lab/vision"), { ssr: false, loading: Loading }),
  prompt: dynamic(() => import("./ai-lab/prompt"), { ssr: false, loading: Loading }),
  ethics: dynamic(() => import("./ai-lab/ethics"), { ssr: false, loading: Loading }),
  evaluation: dynamic(() => import("./ai-lab/evaluation"), { ssr: false, loading: Loading }),
  recommend: dynamic(() => import("./ai-lab/recommend"), { ssr: false, loading: Loading }),
};

interface Topic { id: string; label: string; emoji: string; accent: string; desc: string }
const TOPICS: Topic[] = [
  { id: "foundations", label: "Foundations", emoji: "🧱", accent: "#34d399", desc: "What AI is — and what it isn't." },
  { id: "grouping", label: "Grouping", emoji: "🔮", accent: "#a855f7", desc: "Teach AI to sort and group things." },
  { id: "language", label: "Language", emoji: "💬", accent: "#60a5fa", desc: "AI that reads and chats." },
  { id: "vision", label: "Vision", emoji: "👀", accent: "#22d3ee", desc: "How AI sees pictures." },
  { id: "creating", label: "Creating", emoji: "✨", accent: "#eab308", desc: "Make things with generative AI." },
  { id: "fairness", label: "Fairness", emoji: "⚖️", accent: "#fb7185", desc: "Judge AI: fair, accurate, responsible." },
];
const topicMeta = (id: string) => TOPICS.find((t) => t.id === id) ?? TOPICS[0];

interface Exp { id: string; name: string; emoji: string; topic: string; diff: 1 | 2 | 3; concept: string; accent: string; blurb: string }
const EXPERIMENTS: Exp[] = [
  { id: "awareness", name: "AI or Not AI?", emoji: "🤖", topic: "foundations", diff: 1, concept: "AI awareness", accent: "#34d399", blurb: "Sort everyday things — smart AI, or just a plain tool?" },
  { id: "classifier", name: "Train an AI", emoji: "🍎", topic: "grouping", diff: 2, concept: "Classification · Bias", accent: "#34d399", blurb: "Give examples, train a model, watch it learn — and spot bias." },
  { id: "clustering", name: "Group the Unknown", emoji: "🔮", topic: "grouping", diff: 2, concept: "Clustering", accent: "#a855f7", blurb: "Let the AI group things with no labels at all." },
  { id: "sentiment", name: "Mood Meter", emoji: "😀", topic: "language", diff: 2, concept: "NLP · sentiment", accent: "#eab308", blurb: "Teach an AI to read the mood of a message." },
  { id: "chatbot", name: "Chatbot Brain", emoji: "💬", topic: "language", diff: 2, concept: "NLP · intent", accent: "#60a5fa", blurb: "Build a chatbot that figures out what you're asking." },
  { id: "vision", name: "Spot the Mistake", emoji: "👀", topic: "vision", diff: 2, concept: "Computer vision", accent: "#22d3ee", blurb: "Work out why the AI saw the picture wrong." },
  { id: "prompt", name: "Prompt Lab", emoji: "✨", topic: "creating", diff: 3, concept: "Generative AI", accent: "#eab308", blurb: "Craft prompts and catch the AI making things up." },
  { id: "ethics", name: "Who's Affected?", emoji: "⚖️", topic: "fairness", diff: 3, concept: "AI ethics", accent: "#22d3ee", blurb: "Weigh who an AI helps and who it could harm." },
  { id: "evaluation", name: "How Good Is It?", emoji: "📊", topic: "fairness", diff: 3, concept: "Model evaluation", accent: "#fb7185", blurb: "Score an AI — accuracy, precision, recall, and its mistakes." },
  { id: "recommend", name: "Recommend-o-Bot", emoji: "▶️", topic: "fairness", diff: 3, concept: "Recommendations", accent: "#fb7185", blurb: "Run a video recommender and fall into a filter bubble." },
];

const DIFF_LABEL = ["", "Starter", "Explorer", "Challenge"];
const countOf = (t: string) => EXPERIMENTS.filter((e) => e.topic === t).length;

const NeuralWordmark = () => (
  <>
    <span aria-hidden className="text-lg" style={{ filter: "drop-shadow(0 0 6px #34d39988)" }}>⚡</span>
    {["NEURAL", "LAB"].map((w) => (
      <span key={w} className="font-mono text-sm font-bold tracking-[0.3em]" style={{ backgroundImage: "linear-gradient(90deg,#34d399,#22d3ee)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{w}</span>
    ))}
  </>
);

function Stars({ n }: { n: 1 | 2 | 3 }) {
  return (
    <span className="font-mono text-[11px] tracking-tight" style={{ color: "#eab308" }} title={DIFF_LABEL[n]} aria-label={`Difficulty: ${DIFF_LABEL[n]}`}>
      {"★".repeat(n)}<span className="text-[#3a4255]">{"★".repeat(3 - n)}</span>
    </span>
  );
}

export function AILab() {
  const [topic, setTopic] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);

  const current = sel ? EXPERIMENTS.find((e) => e.id === sel) ?? null : null;
  const Active = sel ? COMP[sel] : null;
  const tm = topic ? topicMeta(topic) : null;
  const inTopic = topic ? EXPERIMENTS.filter((e) => e.topic === topic) : [];

  return (
    <div className="flex h-full w-full flex-col" style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Top bar — back target depends on the level */}
      <header className="flex items-center gap-3 border-b border-[#1e2738] px-4 py-2.5">
        {sel && tm ? (
          <button onClick={() => setSel(null)} className="flex items-center gap-1 rounded-lg border border-[#2a3550] bg-[#0f1626] px-2.5 py-1 font-mono text-xs text-[#9fb0d0] transition-colors hover:border-[#34d399] hover:text-[#34d399]">
            ← {tm.label}
          </button>
        ) : topic ? (
          <button onClick={() => setTopic(null)} className="flex items-center gap-1 rounded-lg border border-[#2a3550] bg-[#0f1626] px-2.5 py-1 font-mono text-xs text-[#9fb0d0] transition-colors hover:border-[#34d399] hover:text-[#34d399]">
            ← Topics
          </button>
        ) : (
          <Link href="/" title="Leave Neural Lab" className="flex items-center gap-1 rounded-lg border border-[#2a3550] bg-[#0f1626] px-2.5 py-1 font-mono text-xs text-[#9fb0d0] transition-colors hover:border-[#34d399] hover:text-[#34d399]">
            ← Back
          </Link>
        )}
        <NeuralWordmark />
        <span className="hidden font-mono text-[11px] text-[#5b6b8c] sm:inline">
          {current ? `// ${current.name}` : tm ? `// ${tm.label} · ${inTopic.length} experiments` : `// ${TOPICS.length} areas · ${EXPERIMENTS.length} experiments`}
        </span>
      </header>

      {sel && Active ? (
        /* 3 — Experiment */
        <div className="min-h-0 flex-1 overflow-auto p-4"><Active /></div>
      ) : topic && tm ? (
        /* 2 — Activities in the chosen topic */
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="mb-4 flex items-center gap-3">
            <span aria-hidden style={{ fontSize: 30 }}>{tm.emoji}</span>
            <div>
              <p className="font-mono text-sm font-semibold" style={{ color: tm.accent }}>{tm.label}</p>
              <p className="font-mono text-[11px] text-[#9fb0d0]">{tm.desc}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {inTopic.map((e) => (
              <button key={e.id} onClick={() => setSel(e.id)} title={`${e.name} — ${e.concept}`} className="group flex flex-col gap-2 rounded-2xl border-2 border-[#1e2738] bg-[#0f1420] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--a)]" style={{ ["--a" as string]: e.accent }}>
                <div className="flex items-start justify-between gap-2">
                  <span aria-hidden style={{ fontSize: 34, lineHeight: 1 }}>{e.emoji}</span>
                  <Stars n={e.diff} />
                </div>
                <span className="font-mono text-sm font-semibold text-[#e8eefc]">{e.name}</span>
                <span className="font-mono text-[11px] leading-relaxed text-[#9fb0d0]">{e.blurb}</span>
                <span className="mt-auto flex items-center gap-1 pt-1 font-mono text-[10px]" style={{ color: e.accent }}>
                  {e.concept}
                  <span className="translate-x-0 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100">→</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* 1 — Topic tiles (no activities shown) */
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <p className="mb-3 font-mono text-[11px] text-[#5b6b8c]">Choose an area to explore ↓</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TOPICS.map((t) => {
              const n = countOf(t.id);
              return (
                <button key={t.id} onClick={() => setTopic(t.id)} className="group flex flex-col gap-2 rounded-2xl border-2 border-[#1e2738] bg-[#0f1420] p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--a)]" style={{ ["--a" as string]: t.accent }}>
                  <div className="flex items-center justify-between">
                    <span aria-hidden style={{ fontSize: 40, lineHeight: 1 }}>{t.emoji}</span>
                    <span className="rounded-md px-2 py-0.5 font-mono text-[10px]" style={{ color: t.accent, background: `${t.accent}1a`, border: `1px solid ${t.accent}55` }}>{n} lab{n > 1 ? "s" : ""}</span>
                  </div>
                  <span className="font-mono text-base font-semibold text-[#e8eefc]">{t.label}</span>
                  <span className="font-mono text-[11px] text-[#9fb0d0]">{t.desc}</span>
                  <span className="mt-1 flex items-center gap-1 font-mono text-[10px]" style={{ color: t.accent }}>
                    Explore
                    <span className="translate-x-0 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100">→</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
