"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";

/**
 * AI Lab — the AI platform shell (sibling of the coding Studio and Maker Lab).
 * Hosts a set of switchable hands-on "experiments", one per AI-literacy strand
 * of the syllabus, banded across Grades 1-10. Each experiment is a
 * self-contained component under ./ai-lab, lazy-loaded on selection.
 */

const Loading = () => (
  <div className="grid h-full place-items-center font-mono text-xs text-[#5b6b8c]">Loading experiment…</div>
);

const COMP: Record<string, ReturnType<typeof dynamic>> = {
  awareness: dynamic(() => import("./ai-lab/awareness"), { ssr: false, loading: Loading }),
  classifier: dynamic(() => import("./ai-lab/classifier"), { ssr: false, loading: Loading }),
  sentiment: dynamic(() => import("./ai-lab/sentiment"), { ssr: false, loading: Loading }),
  vision: dynamic(() => import("./ai-lab/vision"), { ssr: false, loading: Loading }),
  chatbot: dynamic(() => import("./ai-lab/chatbot"), { ssr: false, loading: Loading }),
  clustering: dynamic(() => import("./ai-lab/clustering"), { ssr: false, loading: Loading }),
  prompt: dynamic(() => import("./ai-lab/prompt"), { ssr: false, loading: Loading }),
  recommend: dynamic(() => import("./ai-lab/recommend"), { ssr: false, loading: Loading }),
};

const EXPERIMENTS = [
  { id: "awareness", name: "AI or Not AI?", emoji: "🤖", grades: "1–3", concept: "AI awareness", accent: "#34d399" },
  { id: "classifier", name: "Train an AI", emoji: "🍎", grades: "4–7", concept: "Classification · Bias", accent: "#34d399" },
  { id: "sentiment", name: "Mood Meter", emoji: "😀", grades: "5–7", concept: "NLP · sentiment", accent: "#eab308" },
  { id: "vision", name: "Spot the Mistake", emoji: "👀", grades: "5–8", concept: "Computer vision", accent: "#22d3ee" },
  { id: "chatbot", name: "Chatbot Brain", emoji: "💬", grades: "6–8", concept: "NLP · intent", accent: "#60a5fa" },
  { id: "clustering", name: "Group the Unknown", emoji: "🔮", grades: "6–9", concept: "Clustering", accent: "#a855f7" },
  { id: "prompt", name: "Prompt Lab", emoji: "✨", grades: "6–10", concept: "Generative AI", accent: "#34d399" },
  { id: "recommend", name: "Recommend-o-Bot", emoji: "▶️", grades: "7–10", concept: "Recommendations", accent: "#fb7185" },
] as const;

export function AILab() {
  const [sel, setSel] = useState<string>("awareness");
  const Active = COMP[sel];

  return (
    <div className="flex h-full w-full flex-col" style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Top bar */}
      <header className="flex items-center gap-3 border-b border-[#1e2738] px-4 py-2.5">
        <Link
          href="/"
          title="Leave the AI Lab"
          className="flex items-center gap-1 rounded-lg border border-[#2a3550] bg-[#0f1626] px-2.5 py-1 font-mono text-xs text-[#9fb0d0] transition-colors hover:border-[#34d399] hover:text-[#34d399]"
        >
          ← Back
        </Link>
        <span aria-hidden className="text-lg">🧠</span>
        <span className="font-mono text-sm font-semibold tracking-wide">AI Lab</span>
        <span className="hidden font-mono text-[11px] text-[#5b6b8c] sm:inline">· {EXPERIMENTS.length} experiments · Grades 1–10</span>
      </header>

      {/* Experiment switcher */}
      <div className="flex gap-2 overflow-x-auto border-b border-[#1e2738] px-3 py-2">
        {EXPERIMENTS.map((e) => {
          const on = e.id === sel;
          return (
            <button
              key={e.id}
              onClick={() => setSel(e.id)}
              title={`${e.name} — ${e.concept} · Grades ${e.grades}`}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 transition-colors"
              style={{ borderColor: on ? e.accent : "#1e2738", background: on ? `${e.accent}1a` : "transparent" }}
            >
              <span aria-hidden style={{ fontSize: 16 }}>{e.emoji}</span>
              <span className="whitespace-nowrap font-mono text-xs" style={{ color: on ? e.accent : "#9fb0d0" }}>{e.name}</span>
              <span className="font-mono text-[9px] text-[#5b6b8c]">G{e.grades}</span>
            </button>
          );
        })}
      </div>

      {/* Active experiment */}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <Active />
      </div>
    </div>
  );
}
