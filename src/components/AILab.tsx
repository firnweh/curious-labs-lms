"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

/**
 * Neural Lab — the AI platform shell (sibling of the coding Studio and Maker
 * Lab). Opens to a LAUNCHER GALLERY of experiment cards with a grade-band
 * filter; tapping a card opens that experiment full-screen, with "← All
 * experiments" to return. Each experiment is a self-contained component under
 * ./ai-lab, lazy-loaded on selection.
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
  ethics: dynamic(() => import("./ai-lab/ethics"), { ssr: false, loading: Loading }),
  prompt: dynamic(() => import("./ai-lab/prompt"), { ssr: false, loading: Loading }),
  evaluation: dynamic(() => import("./ai-lab/evaluation"), { ssr: false, loading: Loading }),
  recommend: dynamic(() => import("./ai-lab/recommend"), { ssr: false, loading: Loading }),
};

interface Exp { id: string; name: string; emoji: string; grades: string; lo: number; hi: number; concept: string; accent: string; blurb: string }

const EXPERIMENTS: Exp[] = [
  { id: "awareness", name: "AI or Not AI?", emoji: "🤖", grades: "1–3", lo: 1, hi: 3, concept: "AI awareness", accent: "#34d399", blurb: "Sort everyday things — smart AI, or just a plain tool?" },
  { id: "classifier", name: "Train an AI", emoji: "🍎", grades: "4–7", lo: 4, hi: 7, concept: "Classification · Bias", accent: "#34d399", blurb: "Give examples, train a model, watch it learn — and spot bias." },
  { id: "sentiment", name: "Mood Meter", emoji: "😀", grades: "5–7", lo: 5, hi: 7, concept: "NLP · sentiment", accent: "#eab308", blurb: "Teach an AI to read the mood of a message." },
  { id: "vision", name: "Spot the Mistake", emoji: "👀", grades: "5–8", lo: 5, hi: 8, concept: "Computer vision", accent: "#22d3ee", blurb: "Work out why the AI saw the picture wrong." },
  { id: "chatbot", name: "Chatbot Brain", emoji: "💬", grades: "6–8", lo: 6, hi: 8, concept: "NLP · intent", accent: "#60a5fa", blurb: "Build a chatbot that figures out what you're asking." },
  { id: "clustering", name: "Group the Unknown", emoji: "🔮", grades: "6–9", lo: 6, hi: 9, concept: "Clustering", accent: "#a855f7", blurb: "Let the AI group things with no labels at all." },
  { id: "ethics", name: "Who's Affected?", emoji: "⚖️", grades: "6–10", lo: 6, hi: 10, concept: "AI ethics", accent: "#22d3ee", blurb: "Weigh who an AI helps and who it could harm." },
  { id: "prompt", name: "Prompt Lab", emoji: "✨", grades: "6–10", lo: 6, hi: 10, concept: "Generative AI", accent: "#34d399", blurb: "Craft prompts and catch the AI making things up." },
  { id: "evaluation", name: "How Good Is It?", emoji: "📊", grades: "7–10", lo: 7, hi: 10, concept: "Model evaluation", accent: "#fb7185", blurb: "Score an AI — accuracy, precision, recall, and its mistakes." },
  { id: "recommend", name: "Recommend-o-Bot", emoji: "▶️", grades: "7–10", lo: 7, hi: 10, concept: "Recommendations", accent: "#fb7185", blurb: "Run a video recommender and fall into a filter bubble." },
];

const BANDS = [
  { id: "all", label: "All", lo: 1, hi: 10 },
  { id: "1-3", label: "Grades 1–3", lo: 1, hi: 3 },
  { id: "4-6", label: "Grades 4–6", lo: 4, hi: 6 },
  { id: "7-10", label: "Grades 7–10", lo: 7, hi: 10 },
];

const NeuralWordmark = () => (
  <>
    <span aria-hidden className="text-lg" style={{ filter: "drop-shadow(0 0 6px #34d39988)" }}>⚡</span>
    {["NEURAL", "LAB"].map((w) => (
      <span
        key={w}
        className="font-mono text-sm font-bold tracking-[0.3em]"
        style={{ backgroundImage: "linear-gradient(90deg,#34d399,#22d3ee)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
      >
        {w}
      </span>
    ))}
  </>
);

export function AILab() {
  const [sel, setSel] = useState<string | null>(null);
  const [band, setBand] = useState("all");

  const current = sel ? EXPERIMENTS.find((e) => e.id === sel) ?? null : null;
  const Active = sel ? COMP[sel] : null;

  const shown = useMemo(() => {
    const b = BANDS.find((x) => x.id === band)!;
    return EXPERIMENTS.filter((e) => e.lo <= b.hi && e.hi >= b.lo);
  }, [band]);

  return (
    <div className="flex h-full w-full flex-col" style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Top bar */}
      <header className="flex items-center gap-3 border-b border-[#1e2738] px-4 py-2.5">
        {sel ? (
          <button
            onClick={() => setSel(null)}
            className="flex items-center gap-1 rounded-lg border border-[#2a3550] bg-[#0f1626] px-2.5 py-1 font-mono text-xs text-[#9fb0d0] transition-colors hover:border-[#34d399] hover:text-[#34d399]"
          >
            ← All experiments
          </button>
        ) : (
          <Link
            href="/"
            title="Leave Neural Lab"
            className="flex items-center gap-1 rounded-lg border border-[#2a3550] bg-[#0f1626] px-2.5 py-1 font-mono text-xs text-[#9fb0d0] transition-colors hover:border-[#34d399] hover:text-[#34d399]"
          >
            ← Back
          </Link>
        )}
        <NeuralWordmark />
        <span className="hidden font-mono text-[11px] text-[#5b6b8c] sm:inline">
          {current ? `// ${current.name}` : `// ${EXPERIMENTS.length} experiments · Grades 1–10`}
        </span>
      </header>

      {sel && Active ? (
        /* Experiment view */
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <Active />
        </div>
      ) : (
        /* Launcher gallery */
        <>
          <div className="flex flex-wrap gap-2 border-b border-[#1e2738] px-4 py-2.5">
            {BANDS.map((bd) => {
              const on = band === bd.id;
              const count = EXPERIMENTS.filter((e) => e.lo <= bd.hi && e.hi >= bd.lo).length;
              return (
                <button
                  key={bd.id}
                  onClick={() => setBand(bd.id)}
                  className="shrink-0 rounded-xl border-2 px-3 py-1.5 font-mono text-xs transition-colors"
                  style={{ borderColor: on ? "#34d399" : "#1e2738", background: on ? "#34d39922" : "transparent", color: on ? "#34d399" : "#9fb0d0" }}
                >
                  {bd.label} <span className="text-[#5b6b8c]">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-4">
            <p className="mb-3 font-mono text-[11px] text-[#5b6b8c]">Pick an experiment to start ↓</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {shown.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSel(e.id)}
                  title={`${e.name} — ${e.concept}`}
                  className="group flex flex-col gap-2 rounded-2xl border-2 border-[#1e2738] bg-[#0f1420] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--a)]"
                  style={{ ["--a" as string]: e.accent }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span aria-hidden style={{ fontSize: 34, lineHeight: 1 }}>{e.emoji}</span>
                    <span
                      className="rounded-md px-2 py-0.5 font-mono text-[10px]"
                      style={{ color: e.accent, background: `${e.accent}1a`, border: `1px solid ${e.accent}55` }}
                    >
                      Grades {e.grades}
                    </span>
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
        </>
      )}
    </div>
  );
}
