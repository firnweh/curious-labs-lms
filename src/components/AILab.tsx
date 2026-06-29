"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";

/**
 * Neural Lab — the AI platform shell. The selector is a CONSTELLATION SKY:
 * every experiment is a glowing STAR, topics are constellations joined by faint
 * star-lines, over a twinkling deep-space field. Hover a star to light it + its
 * constellation; tap to open that experiment full-screen. Each experiment is a
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

interface Star { id: string; name: string; topic: string; x: number; y: number; accent: string; blurb: string }
const STARS: Star[] = [
  { id: "awareness", name: "AI or Not AI?", topic: "Foundations", x: 19, y: 23, accent: "#34d399", blurb: "Smart AI, or just a plain tool?" },
  { id: "classifier", name: "Train an AI", topic: "Grouping", x: 13, y: 52, accent: "#34d399", blurb: "Train a model — and spot its bias." },
  { id: "clustering", name: "Group the Unknown", topic: "Grouping", x: 28, y: 71, accent: "#a855f7", blurb: "Group things with no labels." },
  { id: "sentiment", name: "Mood Meter", topic: "Language", x: 46, y: 19, accent: "#eab308", blurb: "Read the mood of a message." },
  { id: "chatbot", name: "Chatbot Brain", topic: "Language", x: 59, y: 34, accent: "#60a5fa", blurb: "A bot that gets what you ask." },
  { id: "vision", name: "Spot the Mistake", topic: "Vision", x: 48, y: 66, accent: "#22d3ee", blurb: "Why the AI saw it wrong." },
  { id: "prompt", name: "Prompt Lab", topic: "Creating", x: 83, y: 17, accent: "#eab308", blurb: "Prompt it, catch it inventing." },
  { id: "ethics", name: "Who's Affected?", topic: "Fairness", x: 75, y: 47, accent: "#22d3ee", blurb: "Who it helps, who it harms." },
  { id: "evaluation", name: "How Good Is It?", topic: "Fairness", x: 89, y: 61, accent: "#fb7185", blurb: "Accuracy, precision, recall." },
  { id: "recommend", name: "Recommend-o-Bot", topic: "Fairness", x: 77, y: 81, accent: "#fb7185", blurb: "Fall into a filter bubble." },
];
const byId = (id: string) => STARS.find((s) => s.id === id)!;

// Constellation lines join stars WITHIN a topic.
const LINES: [string, string][] = [
  ["classifier", "clustering"],
  ["sentiment", "chatbot"],
  ["ethics", "evaluation"],
  ["evaluation", "recommend"],
  ["recommend", "ethics"],
];

// Deterministic decorative starfield (no Math.random).
const BG = Array.from({ length: 60 }, (_, i) => ({
  x: (i * 37) % 100,
  y: (i * 61 + 11) % 100,
  r: 0.18 + ((i * 13) % 6) / 16,
  d: ((i * 7) % 32) / 10,
}));

const NeuralWordmark = () => (
  <>
    <span aria-hidden className="text-lg" style={{ filter: "drop-shadow(0 0 6px #34d39988)" }}>⚡</span>
    {["NEURAL", "LAB"].map((w) => (
      <span key={w} className="font-mono text-sm font-bold tracking-[0.3em]" style={{ backgroundImage: "linear-gradient(90deg,#34d399,#22d3ee)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{w}</span>
    ))}
  </>
);

const StarShape = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden>
    <path d="M12 1.4c.5 5.7 4.4 9.6 10.1 10.1-5.7.5-9.6 4.4-10.1 10.1-.5-5.7-4.4-9.6-10.1-10.1 5.7-.5 9.6-4.4 10.1-10.1z" fill="currentColor" />
  </svg>
);

export function AILab() {
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const current = sel ? byId(sel) : null;
  const Active = sel ? COMP[sel] : null;

  return (
    <div className="flex h-full w-full flex-col" style={{ fontFamily: "system-ui, sans-serif" }}>
      <header className="flex items-center gap-3 border-b border-[#1e2738] px-4 py-2.5">
        {sel ? (
          <button onClick={() => setSel(null)} className="flex items-center gap-1 rounded-lg border border-[#2a3550] bg-[#0f1626] px-2.5 py-1 font-mono text-xs text-[#9fb0d0] transition-colors hover:border-[#34d399] hover:text-[#34d399]">
            ← Sky
          </button>
        ) : (
          <Link href="/" title="Leave Neural Lab" className="flex items-center gap-1 rounded-lg border border-[#2a3550] bg-[#0f1626] px-2.5 py-1 font-mono text-xs text-[#9fb0d0] transition-colors hover:border-[#34d399] hover:text-[#34d399]">
            ← Back
          </Link>
        )}
        <NeuralWordmark />
        <span className="hidden font-mono text-[11px] text-[#5b6b8c] sm:inline">{current ? `// ${current.name}` : `// AI sky · ${STARS.length} experiments`}</span>
      </header>

      {sel && Active ? (
        <div className="min-h-0 flex-1 overflow-auto p-4"><Active /></div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <p className="mb-2 text-center font-mono text-[11px] text-[#5b6b8c]">✦ Tap a star to open its experiment</p>
          <div
            className="relative mx-auto h-[66vh] min-h-[480px] w-full max-w-[1000px] overflow-hidden rounded-2xl border border-[#1e2738]"
            style={{ backgroundImage: "radial-gradient(ellipse 85% 65% at 50% 38%, #131d3e 0%, #0a1126 48%, #060912 100%)" }}
          >
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {/* starfield */}
              {BG.map((s, i) => (
                <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#cdd6f4" className="nl-tw" style={{ animationDelay: `${s.d}s` }} />
              ))}
              {/* constellation lines */}
              {LINES.map(([a, b], i) => {
                const na = byId(a), nb = byId(b);
                const lit = hover != null && (a === hover || b === hover);
                return (
                  <line key={i} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} stroke={lit ? byId(hover!).accent : "#46557a"} strokeWidth={lit ? 1.4 : 1} vectorEffect="non-scaling-stroke" opacity={lit ? 0.85 : 0.32} strokeDasharray={lit ? "0" : "2 2"} />
                );
              })}
            </svg>

            {STARS.map((s, i) => {
              const isHot = hover === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSel(s.id)}
                  onMouseEnter={() => setHover(s.id)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(s.id)}
                  onBlur={() => setHover(null)}
                  title={`${s.name} — ${s.topic}`}
                  className="absolute flex flex-col items-center transition-transform duration-200"
                  style={{ left: `${s.x}%`, top: `${s.y}%`, transform: `translate(-50%,-50%) scale(${isHot ? 1.25 : 1})`, zIndex: isHot ? 20 : 10 }}
                >
                  <span
                    className="nl-star grid place-items-center transition-all duration-200"
                    style={{ color: s.accent, filter: `drop-shadow(0 0 ${isHot ? 12 : 5}px ${s.accent})`, animationDelay: `${(i % 5) * 0.5}s` }}
                  >
                    <StarShape />
                  </span>
                  <span className="mt-0.5 max-w-[120px] text-center font-mono text-[10px] leading-tight transition-colors" style={{ color: isHot ? s.accent : "#8a96b4" }}>
                    {s.name}
                  </span>
                  {isHot && (
                    <span className="pointer-events-none absolute top-full z-30 mt-1 w-[140px] rounded-lg border px-2 py-1 text-center font-mono text-[9px]" style={{ borderColor: `${s.accent}55`, background: "#0b1018ee", color: "#9fb0d0" }}>
                      {s.blurb}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-[9px] text-[#5b6b8c]">
            {[["Foundations", "#34d399"], ["Grouping", "#a855f7"], ["Language", "#60a5fa"], ["Vision", "#22d3ee"], ["Creating", "#eab308"], ["Fairness", "#fb7185"]].map(([label, c]) => (
              <span key={label} className="flex items-center gap-1"><span className="inline-block h-2 w-2 rotate-45" style={{ background: c }} /> {label}</span>
            ))}
          </div>

          <style>{`
            @keyframes nlTw { 0%,100%{ opacity:.2 } 50%{ opacity:.75 } }
            .nl-tw { animation: nlTw 3s ease-in-out infinite; }
            @keyframes nlStar { 0%,100%{ opacity:.85; transform: scale(1) } 50%{ opacity:1; transform: scale(1.1) } }
            .nl-star { animation: nlStar 3.6s ease-in-out infinite; }
          `}</style>
        </div>
      )}
    </div>
  );
}
