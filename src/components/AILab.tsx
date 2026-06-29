"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";

/**
 * Neural Lab — the AI platform shell. The selector IS a neural network: every
 * experiment is a glowing NODE wired to the next layer by pulsing "synapses",
 * coloured by topic. Hover a node to light up its name + wires; tap to fire up
 * that experiment full-screen. Each experiment is a self-contained component
 * under ./ai-lab, lazy-loaded on selection.
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

interface Node { id: string; name: string; emoji: string; topic: string; x: number; y: number; accent: string; blurb: string }

// Three "layers" (left → right), positioned as % of the map area.
const NODES: Node[] = [
  { id: "awareness", name: "AI or Not AI?", emoji: "🤖", topic: "Foundations", x: 13, y: 26, accent: "#34d399", blurb: "Smart AI, or just a plain tool?" },
  { id: "classifier", name: "Train an AI", emoji: "🍎", topic: "Grouping", x: 13, y: 52, accent: "#34d399", blurb: "Train a model — and spot its bias." },
  { id: "clustering", name: "Group the Unknown", emoji: "🔮", topic: "Grouping", x: 13, y: 78, accent: "#a855f7", blurb: "Group things with no labels." },
  { id: "sentiment", name: "Mood Meter", emoji: "😀", topic: "Language", x: 50, y: 20, accent: "#eab308", blurb: "Read the mood of a message." },
  { id: "chatbot", name: "Chatbot Brain", emoji: "💬", topic: "Language", x: 50, y: 50, accent: "#60a5fa", blurb: "A bot that gets what you ask." },
  { id: "vision", name: "Spot the Mistake", emoji: "👀", topic: "Vision", x: 50, y: 80, accent: "#22d3ee", blurb: "Why the AI saw it wrong." },
  { id: "prompt", name: "Prompt Lab", emoji: "✨", topic: "Creating", x: 87, y: 16, accent: "#eab308", blurb: "Prompt it, catch it inventing." },
  { id: "ethics", name: "Who's Affected?", emoji: "⚖️", topic: "Fairness", x: 87, y: 39, accent: "#22d3ee", blurb: "Who it helps, who it harms." },
  { id: "evaluation", name: "How Good Is It?", emoji: "📊", topic: "Fairness", x: 87, y: 62, accent: "#fb7185", blurb: "Accuracy, precision, recall." },
  { id: "recommend", name: "Recommend-o-Bot", emoji: "▶️", topic: "Fairness", x: 87, y: 85, accent: "#fb7185", blurb: "Fall into a filter bubble." },
];
const byId = (id: string) => NODES.find((n) => n.id === id)!;

const LAYERS = [
  ["awareness", "classifier", "clustering"],
  ["sentiment", "chatbot", "vision"],
  ["prompt", "ethics", "evaluation", "recommend"],
];
// Dense "fully-connected" synapses between adjacent layers.
const EDGES: [string, string][] = [];
for (let i = 0; i < LAYERS.length - 1; i++) {
  for (const a of LAYERS[i]) for (const b of LAYERS[i + 1]) EDGES.push([a, b]);
}

// Custom line icons (stroke = currentColor → topic accent). No emoji.
function Icon({ id }: { id: string }) {
  const p = { fill: "currentColor", stroke: "none" } as const;
  const c = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (id) {
    case "awareness": // robot
      return (<svg {...c}><rect x="5" y="8" width="14" height="11" rx="2.5" /><path d="M12 8V4.2" /><circle cx="12" cy="3.2" r="1.1" /><circle cx="9.5" cy="13" r="1" {...p} /><circle cx="14.5" cy="13" r="1" {...p} /><path d="M9.5 16.5h5" /></svg>);
    case "classifier": // decision boundary + points
      return (<svg {...c}><path d="M4 20 20 4" /><circle cx="7" cy="8.5" r="1.2" {...p} /><circle cx="10.5" cy="6.5" r="1.2" {...p} /><circle cx="13.5" cy="17.5" r="1.2" {...p} /><circle cx="17" cy="15.5" r="1.2" {...p} /></svg>);
    case "clustering": // clusters
      return (<svg {...c}><circle cx="8" cy="9" r="4.5" /><circle cx="15.5" cy="15.5" r="4" /><circle cx="8" cy="9" r="1" {...p} /><circle cx="15.5" cy="15.5" r="1" {...p} /></svg>);
    case "sentiment": // smiley
      return (<svg {...c}><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5c1 1.3 2.2 2 3.5 2s2.5-.7 3.5-2" /><circle cx="9" cy="10" r="0.7" {...p} /><circle cx="15" cy="10" r="0.7" {...p} /></svg>);
    case "chatbot": // speech bubble
      return (<svg {...c}><path d="M5 5h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H9l-4 3.5V6a1 1 0 0 1 1-1z" /><circle cx="9" cy="10.5" r="0.8" {...p} /><circle cx="12" cy="10.5" r="0.8" {...p} /><circle cx="15" cy="10.5" r="0.8" {...p} /></svg>);
    case "vision": // eye
      return (<svg {...c}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>);
    case "prompt": // sparkle
      return (<svg {...c}><path d="M12 3c.4 3.5 1.5 4.6 5 5-3.5.4-4.6 1.5-5 5-.4-3.5-1.5-4.6-5-5 3.5-.4 4.6-1.5 5-5z" /><path d="M18.5 14c.2 1.5.6 1.9 2 2-1.4.2-1.8.5-2 2-.2-1.5-.6-1.9-2-2 1.4-.1 1.8-.5 2-2z" /></svg>);
    case "ethics": // balance scale
      return (<svg {...c}><path d="M12 4v15" /><path d="M8 19h8" /><path d="M5 7.5h14" /><path d="M5 7.5 3 12h4z" /><path d="M19 7.5 17 12h4z" /></svg>);
    case "evaluation": // 2x2 matrix
      return (<svg {...c}><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M12 4v16" /><path d="M4 12h16" /><path d="M6.5 8 8 9.5l2-2.5" /><path d="m15 14.5 3 3m0-3-3 3" /></svg>);
    case "recommend": // play
      return (<svg {...c}><path d="M9 6.5v11l8.5-5.5z" /></svg>);
    default:
      return (<svg {...c}><circle cx="12" cy="12" r="8" /></svg>);
  }
}

const NeuralWordmark = () => (
  <>
    <span aria-hidden className="text-lg" style={{ filter: "drop-shadow(0 0 6px #34d39988)" }}>⚡</span>
    {["NEURAL", "LAB"].map((w) => (
      <span key={w} className="font-mono text-sm font-bold tracking-[0.3em]" style={{ backgroundImage: "linear-gradient(90deg,#34d399,#22d3ee)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{w}</span>
    ))}
  </>
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
            ← Network
          </button>
        ) : (
          <Link href="/" title="Leave Neural Lab" className="flex items-center gap-1 rounded-lg border border-[#2a3550] bg-[#0f1626] px-2.5 py-1 font-mono text-xs text-[#9fb0d0] transition-colors hover:border-[#34d399] hover:text-[#34d399]">
            ← Back
          </Link>
        )}
        <NeuralWordmark />
        <span className="hidden font-mono text-[11px] text-[#5b6b8c] sm:inline">{current ? `// ${current.name}` : `// neural map · ${NODES.length} experiments`}</span>
      </header>

      {sel && Active ? (
        <div className="min-h-0 flex-1 overflow-auto p-4"><Active /></div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <p className="mb-2 text-center font-mono text-[11px] text-[#5b6b8c]">⚡ Tap a node to fire up an experiment</p>
          {/* The network */}
          <div className="relative mx-auto h-[64vh] min-h-[460px] w-full max-w-[1000px]">
            {/* synapse lines */}
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {EDGES.map(([a, b], i) => {
                const na = byId(a), nb = byId(b);
                const lit = hover != null && (a === hover || b === hover);
                const dim = hover != null && !lit;
                return (
                  <line
                    key={i}
                    x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
                    stroke={lit ? byId(hover!).accent : "#2b3a52"}
                    strokeWidth={lit ? 1.6 : 1}
                    vectorEffect="non-scaling-stroke"
                    opacity={lit ? 0.9 : dim ? 0.05 : 0.16}
                    className={lit || dim ? "" : "nl-synapse"}
                    style={{ animationDelay: `${(i % 8) * 0.35}s` }}
                  />
                );
              })}
            </svg>

            {/* nodes */}
            {NODES.map((n) => {
              const isHot = hover === n.id;
              const isCold = hover != null && !isHot;
              return (
                <button
                  key={n.id}
                  onClick={() => setSel(n.id)}
                  onMouseEnter={() => setHover(n.id)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(n.id)}
                  onBlur={() => setHover(null)}
                  title={`${n.name} — ${n.topic}`}
                  className="absolute flex flex-col items-center transition-all duration-200"
                  style={{ left: `${n.x}%`, top: `${n.y}%`, transform: `translate(-50%,-50%) scale(${isHot ? 1.12 : 1})`, opacity: isCold ? 0.55 : 1, zIndex: isHot ? 20 : 10 }}
                >
                  <span
                    className="grid place-items-center rounded-full border-2 bg-[#0b1018] transition-all duration-200"
                    style={{
                      width: 56, height: 56,
                      color: n.accent,
                      borderColor: n.accent,
                      boxShadow: isHot ? `0 0 22px ${n.accent}, 0 0 0 4px ${n.accent}33` : `0 0 10px ${n.accent}55`,
                    }}
                  >
                    <Icon id={n.id} />
                  </span>
                  <span className="mt-1.5 max-w-[110px] text-center font-mono text-[10px] leading-tight transition-colors" style={{ color: isHot ? n.accent : "#9fb0d0" }}>
                    {n.name}
                  </span>
                  {isHot && (
                    <span className="pointer-events-none absolute top-full mt-7 w-[130px] text-center font-mono text-[9px] text-[#5b6b8c]">{n.blurb}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* legend */}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-[9px] text-[#5b6b8c]">
            {[["Foundations", "#34d399"], ["Grouping", "#a855f7"], ["Language", "#60a5fa"], ["Vision", "#22d3ee"], ["Creating", "#eab308"], ["Fairness", "#fb7185"]].map(([label, c]) => (
              <span key={label} className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: c }} /> {label}
              </span>
            ))}
          </div>

          <style>{`
            @keyframes nlPulse { 0%,100% { opacity: 0.10 } 50% { opacity: 0.30 } }
            .nl-synapse { animation: nlPulse 2.6s ease-in-out infinite; }
          `}</style>
        </div>
      )}
    </div>
  );
}
