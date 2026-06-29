"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";

/**
 * Neural Lab — the AI platform shell. The selector is a LIVING NEURAL NETWORK:
 * the 10 experiments are NEURONS arranged in three layers — Input (learn) →
 * Hidden (apply) → Output (judge) — wired together by synapses with signal
 * pulses flowing left→right. Hover a neuron to FIRE it and light up everything
 * it connects to; tap to drop into that experiment. Each experiment is a
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

type Layer = "input" | "hidden" | "output";
interface Neuron { id: string; name: string; topic: string; layer: Layer; x: number; y: number; blurb: string }

const TOPIC_COLOR: Record<string, string> = {
  Foundations: "#34d399",
  Grouping: "#a855f7",
  Language: "#60a5fa",
  Vision: "#22d3ee",
  Creating: "#eab308",
  Fairness: "#fb7185",
};

// Input = how AI learns · Hidden = how AI applies itself · Output = how we judge it.
const NEURONS: Neuron[] = [
  { id: "awareness", name: "AI or Not AI?", topic: "Foundations", layer: "input", x: 15, y: 27, blurb: "Smart AI, or just a plain tool?" },
  { id: "classifier", name: "Train an AI", topic: "Grouping", layer: "input", x: 15, y: 51, blurb: "Train a model — and spot its bias." },
  { id: "clustering", name: "Group the Unknown", topic: "Grouping", layer: "input", x: 15, y: 75, blurb: "Group things with no labels." },

  { id: "sentiment", name: "Mood Meter", topic: "Language", layer: "hidden", x: 50, y: 21, blurb: "Read the mood of a message." },
  { id: "chatbot", name: "Chatbot Brain", topic: "Language", layer: "hidden", x: 50, y: 43, blurb: "A bot that gets what you ask." },
  { id: "vision", name: "Spot the Mistake", topic: "Vision", layer: "hidden", x: 50, y: 63, blurb: "Why the AI saw it wrong." },
  { id: "prompt", name: "Prompt Lab", topic: "Creating", layer: "hidden", x: 50, y: 83, blurb: "Prompt it, catch it inventing." },

  { id: "ethics", name: "Who's Affected?", topic: "Fairness", layer: "output", x: 85, y: 29, blurb: "Who it helps, who it harms." },
  { id: "evaluation", name: "How Good Is It?", topic: "Fairness", layer: "output", x: 85, y: 51, blurb: "Accuracy, precision, recall." },
  { id: "recommend", name: "Recommend-o-Bot", topic: "Fairness", layer: "output", x: 85, y: 73, blurb: "Fall into a filter bubble." },
];
const byId = (id: string) => NEURONS.find((n) => n.id === id)!;

const inputN = NEURONS.filter((n) => n.layer === "input");
const hiddenN = NEURONS.filter((n) => n.layer === "hidden");
const outputN = NEURONS.filter((n) => n.layer === "output");

// Dense synapses: every input→hidden and every hidden→output (the classic net look).
const SYNAPSES: { a: Neuron; b: Neuron }[] = [];
inputN.forEach((a) => hiddenN.forEach((b) => SYNAPSES.push({ a, b })));
hiddenN.forEach((a) => outputN.forEach((b) => SYNAPSES.push({ a, b })));

// Pre-computed neighbours so hovering a neuron can light everything it wires to.
const NEIGHBORS: Record<string, Set<string>> = {};
NEURONS.forEach((n) => (NEIGHBORS[n.id] = new Set()));
SYNAPSES.forEach(({ a, b }) => { NEIGHBORS[a.id].add(b.id); NEIGHBORS[b.id].add(a.id); });

const LAYERS: { key: Layer; label: string; sub: string; x: number }[] = [
  { key: "input", label: "INPUT", sub: "learn", x: 15 },
  { key: "hidden", label: "HIDDEN", sub: "apply", x: 50 },
  { key: "output", label: "OUTPUT", sub: "judge", x: 85 },
];

// Deterministic decorative starfield (no Math.random).
const BG = Array.from({ length: 50 }, (_, i) => ({
  x: (i * 41) % 100,
  y: (i * 67 + 9) % 100,
  r: 0.18 + ((i * 13) % 6) / 18,
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

export function AILab() {
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const current = sel ? byId(sel) : null;
  const Active = sel ? COMP[sel] : null;
  const hotColor = hover ? TOPIC_COLOR[byId(hover).topic] : null;

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
        <span className="hidden font-mono text-[11px] text-[#5b6b8c] sm:inline">{current ? `// ${current.name}` : `// neural net · ${NEURONS.length} experiments`}</span>
      </header>

      {sel && Active ? (
        <div className="min-h-0 flex-1 overflow-auto p-4"><Active /></div>
      ) : (
        <div
          className="relative min-h-0 flex-1 overflow-hidden"
          style={{ backgroundImage: "radial-gradient(ellipse 95% 80% at 50% 45%, #131d40 0%, #0a1126 52%, #060912 100%)" }}
        >
          <p className="pointer-events-none absolute left-1/2 top-2.5 z-30 -translate-x-1/2 font-mono text-[11px] text-[#7c8baf]">⚡ Tap a neuron to fire its experiment</p>

          {/* layer headers */}
          {LAYERS.map((l) => (
            <div key={l.key} className="pointer-events-none absolute z-20 -translate-x-1/2 text-center" style={{ left: `${l.x}%`, top: "9%" }}>
              <div className="font-mono text-[11px] font-bold tracking-[0.25em] text-[#9fb0d0]">{l.label}</div>
              <div className="font-mono text-[9px] tracking-[0.2em]" style={{ color: "#566a90" }}>{l.sub}</div>
            </div>
          ))}

          {/* synapses + starfield */}
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {BG.map((s, i) => (
              <circle key={`bg${i}`} cx={s.x} cy={s.y} r={s.r} fill="#cdd6f4" className="nn-tw" style={{ animationDelay: `${s.d}s` }} />
            ))}
            {SYNAPSES.map((s, i) => {
              const lit = hover != null && (s.a.id === hover || s.b.id === hover);
              return (
                <g key={i}>
                  <line
                    x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y}
                    stroke={lit ? hotColor! : "#33436b"} strokeWidth={lit ? 1 : 0.5}
                    vectorEffect="non-scaling-stroke"
                    opacity={lit ? 0.85 : hover ? 0.12 : 0.3}
                  />
                  <line
                    x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y}
                    stroke={lit ? "#ffffff" : "#5b78b8"} strokeWidth={lit ? 1.6 : 1}
                    strokeLinecap="round" strokeDasharray="1.5 8"
                    vectorEffect="non-scaling-stroke"
                    className="nn-flow"
                    style={{ animationDuration: lit ? "0.7s" : "1.7s", opacity: lit ? 1 : hover ? 0.08 : 0.55 }}
                  />
                </g>
              );
            })}
          </svg>

          {/* neurons */}
          {NEURONS.map((n, i) => {
            const color = TOPIC_COLOR[n.topic];
            const isHot = hover === n.id;
            const lit = hover != null && (hover === n.id || NEIGHBORS[hover]?.has(n.id));
            const dim = hover != null && !lit;
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
                style={{ left: `${n.x}%`, top: `${n.y}%`, transform: `translate(-50%,-50%) scale(${isHot ? 1.22 : 1})`, zIndex: isHot ? 40 : 12, opacity: dim ? 0.45 : 1 }}
              >
                <span
                  className="nn-node block rounded-full"
                  style={{
                    width: 26, height: 26,
                    background: `radial-gradient(circle at 34% 30%, #ffffff, ${color} 58%, ${color}22 100%)`,
                    boxShadow: `0 0 ${isHot ? 26 : lit ? 16 : 9}px ${color}, inset 0 0 6px ${color}aa`,
                    animationDelay: `${(i % 5) * 0.5}s`,
                  }}
                />
                <span
                  className="mt-1 max-w-[124px] text-center font-mono text-[10px] leading-tight transition-colors"
                  style={{ color: isHot || lit ? color : "#8a96b4" }}
                >
                  {n.name}
                </span>
                {isHot && (
                  <span className="pointer-events-none absolute top-full z-50 mt-1 w-[150px] rounded-lg border px-2 py-1 text-center font-mono text-[9px]" style={{ borderColor: `${color}66`, background: "#0b1018ee", color: "#aebbd9" }}>
                    {n.blurb}
                  </span>
                )}
              </button>
            );
          })}

          {/* topic legend */}
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 flex max-w-full -translate-x-1/2 flex-wrap items-center justify-center gap-x-4 gap-y-1 px-3 font-mono text-[9px] text-[#5b6b8c]">
            {Object.entries(TOPIC_COLOR).map(([label, c]) => (
              <span key={label} className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: c, boxShadow: `0 0 5px ${c}` }} /> {label}</span>
            ))}
          </div>

          <style>{`
            @keyframes nnTw { 0%,100%{ opacity:.16 } 50%{ opacity:.66 } }
            .nn-tw { animation: nnTw 3s ease-in-out infinite; }
            @keyframes nnFlow { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -9.5; } }
            .nn-flow { animation: nnFlow 1.7s linear infinite; }
            @keyframes nnBreathe { 0%,100%{ transform: scale(1); } 50%{ transform: scale(1.09); } }
            .nn-node { animation: nnBreathe 3.6s ease-in-out infinite; }
          `}</style>
        </div>
      )}
    </div>
  );
}
