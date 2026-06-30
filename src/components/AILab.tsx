"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";

/**
 * Neural Lab — the AI platform shell. Two ways in:
 *  • NETWORK — the original 10 concept labs as a LIVING NEURAL NETWORK (neurons
 *    in three layers, synapses firing left→right).
 *  • +25 EXPERIMENTS — the hands-on browser-AI sky: live camera, teachable
 *    models, speech & generative labs, shown as a filterable CONSTELLATION.
 * Every experiment is a self-contained component under ./ai-lab, lazy-loaded.
 */

const Loading = () => (
  <div className="grid h-full place-items-center font-mono text-xs text-[#5b6b8c]">Loading experiment…</div>
);

const COMP: Record<string, ReturnType<typeof dynamic>> = {
  // Original 10 concept labs (the neural network)
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
  // +25 hands-on browser-AI experiments — Vision (live camera + classic CV)
  "face-detect": dynamic(() => import("./ai-lab/face-detect"), { ssr: false, loading: Loading }),
  "face-mesh": dynamic(() => import("./ai-lab/face-mesh"), { ssr: false, loading: Loading }),
  "object-detect": dynamic(() => import("./ai-lab/object-detect"), { ssr: false, loading: Loading }),
  pose: dynamic(() => import("./ai-lab/pose"), { ssr: false, loading: Loading }),
  hand: dynamic(() => import("./ai-lab/hand"), { ssr: false, loading: Loading }),
  gesture: dynamic(() => import("./ai-lab/gesture"), { ssr: false, loading: Loading }),
  "image-classify": dynamic(() => import("./ai-lab/image-classify"), { ssr: false, loading: Loading }),
  "scene-describe": dynamic(() => import("./ai-lab/scene-describe"), { ssr: false, loading: Loading }),
  "opencv-filters": dynamic(() => import("./ai-lab/opencv-filters"), { ssr: false, loading: Loading }),
  "junior-face": dynamic(() => import("./ai-lab/junior-face"), { ssr: false, loading: Loading }),
  "qr-scan": dynamic(() => import("./ai-lab/qr-scan"), { ssr: false, loading: Loading }),
  "recognition-cards": dynamic(() => import("./ai-lab/recognition-cards"), { ssr: false, loading: Loading }),
  apriltag: dynamic(() => import("./ai-lab/apriltag"), { ssr: false, loading: Loading }),
  ocr: dynamic(() => import("./ai-lab/ocr"), { ssr: false, loading: Loading }),
  // Training — teachable models
  "teach-image": dynamic(() => import("./ai-lab/teach-image"), { ssr: false, loading: Loading }),
  "teach-object": dynamic(() => import("./ai-lab/teach-object"), { ssr: false, loading: Loading }),
  "teach-pose": dynamic(() => import("./ai-lab/teach-pose"), { ssr: false, loading: Loading }),
  "teach-hand": dynamic(() => import("./ai-lab/teach-hand"), { ssr: false, loading: Loading }),
  "teach-audio": dynamic(() => import("./ai-lab/teach-audio"), { ssr: false, loading: Loading }),
  "number-classifier": dynamic(() => import("./ai-lab/number-classifier"), { ssr: false, loading: Loading }),
  // Language — speech & text
  "text-classifier": dynamic(() => import("./ai-lab/text-classifier"), { ssr: false, loading: Loading }),
  "speech-to-text": dynamic(() => import("./ai-lab/speech-to-text"), { ssr: false, loading: Loading }),
  "text-to-speech": dynamic(() => import("./ai-lab/text-to-speech"), { ssr: false, loading: Loading }),
  translate: dynamic(() => import("./ai-lab/translate"), { ssr: false, loading: Loading }),
  // Creating — generative
  "genai-chat": dynamic(() => import("./ai-lab/genai-chat"), { ssr: false, loading: Loading }),
};

/* ─────────────────────── ORIGINAL 10 — living neural network ─────────────────────── */

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
const nById = (id: string) => NEURONS.find((n) => n.id === id)!;

// Inner SVG markup per experiment (24x24, line style inherited from the wrapper
// <svg>; tiny dots opt into fill='currentColor'). Designed + verified per activity.
const ICON: Record<string, string> = {
  awareness: "<rect x='4' y='5' width='16' height='14' rx='3'/><line x1='12' y1='2.5' x2='12' y2='5'/><circle cx='12' cy='2.5' r='0.7' fill='currentColor' stroke='none'/><path d='M10 10.5 a2 2 0 1 1 2.6 1.9 c-0.6 0.25 -0.6 0.6 -0.6 1.1'/><circle cx='12' cy='15.6' r='0.7' fill='currentColor' stroke='none'/>",
  classifier: "<path d='M12 4v3'/><path d='M12 7c0 3 -5 3 -5 6'/><path d='M12 7c0 3 5 3 5 6'/><rect x='3' y='15' width='8' height='6' rx='1'/><rect x='13' y='15' width='8' height='6' rx='1'/><circle cx='12' cy='4' r='1.4' fill='currentColor' stroke='none'/>",
  clustering: "<circle cx='8' cy='8.5' r='4.5'/><circle cx='16' cy='15.5' r='4.5'/><circle cx='6.5' cy='7.5' r='1' fill='currentColor' stroke='none'/><circle cx='9.5' cy='10' r='1' fill='currentColor' stroke='none'/><circle cx='14.5' cy='14.5' r='1' fill='currentColor' stroke='none'/><circle cx='17.5' cy='16.5' r='1' fill='currentColor' stroke='none'/>",
  sentiment: "<path d='M3 13a9 9 0 0 1 18 0'/><line x1='12' y1='13' x2='15.5' y2='9'/><circle cx='12' cy='13' r='1.1' fill='currentColor' stroke='none'/><line x1='4.5' y1='11.5' x2='6' y2='12'/><line x1='19.5' y1='11.5' x2='18' y2='12'/>",
  chatbot: "<path d='M20 13a3 3 0 0 1-3 3H9l-4 3v-3a3 3 0 0 1-1-2.4V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3z'/><circle cx='8.5' cy='11' r='1' fill='currentColor' stroke='none'/><circle cx='12' cy='11' r='1' fill='currentColor' stroke='none'/><circle cx='15.5' cy='11' r='1' fill='currentColor' stroke='none'/>",
  vision: "<path d='M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z'/><circle cx='12' cy='12' r='2.5'/><path d='M15 6h3v3'/>",
  prompt: "<path d='M14.5 4.5 5 14a2.12 2.12 0 0 0 3 3l9.5-9.5a2.12 2.12 0 0 0-3-3Z'/><path d='M19 3v3'/><path d='M21.5 4.5h-3'/>",
  ethics: "<circle cx='12' cy='4' r='1.6' fill='currentColor' stroke='none'/><path d='M12 5.6V20'/><path d='M6 20h12'/><path d='M5 8h14'/><path d='M5 8l-2.5 5a2.5 2.5 0 0 0 5 0L5 8z'/><path d='M19 8l-2.5 5a2.5 2.5 0 0 0 5 0L19 8z'/>",
  evaluation: "<circle cx='11' cy='11' r='8'/><circle cx='11' cy='11' r='4'/><circle cx='11' cy='11' r='1.25' fill='currentColor' stroke='none'/><path d='M14 16.5 L16.5 19 L20 14'/>",
  recommend: "<path d='M9 21V9l3.5-7C13.9 2 15 3.1 15 4.5V8h4.5c1.1 0 1.9 1 1.7 2.1l-1.4 8c-.2 1-1 1.4-1.8 1.4H9'/><path d='M9 21H5.5C4.7 21 4 20.3 4 19.5V12c0-.8.7-1.5 1.5-1.5H9'/>",
};

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
const NN_BG = Array.from({ length: 50 }, (_, i) => ({
  x: (i * 41) % 100,
  y: (i * 67 + 9) % 100,
  r: 0.18 + ((i * 13) % 6) / 18,
  d: ((i * 7) % 32) / 10,
}));

function NeuralNet({ onPick }: { onPick: (id: string) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const hotColor = hover ? TOPIC_COLOR[nById(hover).topic] : null;

  return (
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
        {NN_BG.map((s, i) => (
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
            onClick={() => onPick(n.id)}
            onMouseEnter={() => setHover(n.id)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(n.id)}
            onBlur={() => setHover(null)}
            title={`${n.name} — ${n.topic}`}
            className="absolute flex flex-col items-center transition-all duration-200"
            style={{ left: `${n.x}%`, top: `${n.y}%`, transform: `translate(-50%,-50%) scale(${isHot ? 1.22 : 1})`, zIndex: isHot ? 40 : 12, opacity: dim ? 0.45 : 1 }}
          >
            <span
              className="nn-node grid place-items-center rounded-full"
              style={{
                width: 40, height: 40,
                background: "radial-gradient(circle at 50% 32%, #16263f, #070d18 80%)",
                border: `2px solid ${color}`,
                boxShadow: `0 0 ${isHot ? 24 : lit ? 15 : 9}px ${isHot ? color : color + "cc"}, inset 0 0 9px ${color}44`,
                color: "#eef4ff",
                animationDelay: `${(i % 5) * 0.5}s`,
              }}
            >
              <svg
                viewBox="0 0 24 24" width="22" height="22"
                fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                style={{ filter: `drop-shadow(0 0 3px ${color})` }}
                dangerouslySetInnerHTML={{ __html: ICON[n.id] }}
              />
            </span>
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
  );
}

/* ──────────────────── +25 HANDS-ON EXPERIMENTS — constellation sky ──────────────────── */

interface Star { id: string; name: string; topic: string; x: number; y: number; accent: string; blurb: string }
const EXTRA_STARS: Star[] = [
  // Training (teachable models)
  { id: "teach-image", name: "Train an Image Brain", topic: "Training", x: 7, y: 66, accent: "#f97316", blurb: "Teach it to tell images apart." },
  { id: "teach-object", name: "Sorting Robot", topic: "Training", x: 18, y: 77, accent: "#f97316", blurb: "Teach a waste-sorting robot." },
  { id: "teach-pose", name: "Pose Trainer", topic: "Training", x: 8, y: 89, accent: "#f97316", blurb: "Teach it your own poses." },
  { id: "teach-hand", name: "Gesture Trainer", topic: "Training", x: 21, y: 90, accent: "#f97316", blurb: "Teach it your own hand signs." },
  { id: "teach-audio", name: "Sound Trainer", topic: "Training", x: 31, y: 80, accent: "#f97316", blurb: "Teach it to tell sounds apart." },
  { id: "number-classifier", name: "Number Brain", topic: "Training", x: 30, y: 66, accent: "#f97316", blurb: "Classify & predict from numbers." },
  // Vision (live camera + classic CV)
  { id: "face-detect", name: "Face Finder", topic: "Vision", x: 51, y: 13, accent: "#22d3ee", blurb: "Find faces live on camera." },
  { id: "face-mesh", name: "Face Mesh", topic: "Vision", x: 61, y: 18, accent: "#22d3ee", blurb: "478-point mesh + expressions." },
  { id: "object-detect", name: "Object Spotter", topic: "Vision", x: 69, y: 13, accent: "#22d3ee", blurb: "Find & box everyday objects." },
  { id: "image-classify", name: "Image Labeler", topic: "Vision", x: 45, y: 32, accent: "#22d3ee", blurb: "Guess what the picture shows." },
  { id: "scene-describe", name: "Scene Describer", topic: "Vision", x: 56, y: 38, accent: "#22d3ee", blurb: "Snap a photo, get a caption." },
  { id: "pose", name: "Pose Tracker", topic: "Vision", x: 67, y: 33, accent: "#22d3ee", blurb: "Track your body as a skeleton." },
  { id: "hand", name: "Hand Tracker", topic: "Vision", x: 43, y: 49, accent: "#22d3ee", blurb: "Map 21 points of your hand." },
  { id: "gesture", name: "Gesture Reader", topic: "Vision", x: 54, y: 55, accent: "#22d3ee", blurb: "Name your hand gestures live." },
  { id: "opencv-filters", name: "Pixel Lab", topic: "Vision", x: 65, y: 49, accent: "#22d3ee", blurb: "Bend pixels with CV filters." },
  { id: "junior-face", name: "Peekaboo", topic: "Vision", x: 40, y: 65, accent: "#22d3ee", blurb: "Face peekaboo for little kids." },
  { id: "qr-scan", name: "QR Scanner", topic: "Vision", x: 50, y: 72, accent: "#22d3ee", blurb: "Decode QR codes live." },
  { id: "recognition-cards", name: "Sign Driver", topic: "Vision", x: 60, y: 67, accent: "#22d3ee", blurb: "Steer a robot with hand signs." },
  { id: "apriltag", name: "Robot Tags", topic: "Vision", x: 70, y: 60, accent: "#22d3ee", blurb: "How robots read marker tags." },
  { id: "ocr", name: "Text Reader", topic: "Vision", x: 48, y: 88, accent: "#22d3ee", blurb: "Read printed text (OCR)." },
  // Language (speech & text)
  { id: "speech-to-text", name: "Speech to Text", topic: "Language", x: 84, y: 35, accent: "#60a5fa", blurb: "Turn your voice into text." },
  { id: "text-to-speech", name: "Text to Speech", topic: "Language", x: 93, y: 43, accent: "#60a5fa", blurb: "Make the computer talk." },
  { id: "translate", name: "Translator", topic: "Language", x: 83, y: 52, accent: "#60a5fa", blurb: "Translate across languages." },
  { id: "text-classifier", name: "Text Trainer", topic: "Language", x: 92, y: 61, accent: "#60a5fa", blurb: "Teach it to sort sentences." },
  // Creating (generative)
  { id: "genai-chat", name: "Word Weaver", topic: "Creating", x: 78, y: 79, accent: "#eab308", blurb: "Generate text, word by word." },
];
const sById = (id: string) => EXTRA_STARS.find((s) => s.id === id)!;

const EXTRA_TOPICS: [string, string][] = [
  ["Training", "#f97316"],
  ["Vision", "#22d3ee"],
  ["Language", "#60a5fa"],
  ["Creating", "#eab308"],
];

// Constellation lines join stars WITHIN a topic (both ends are new experiments).
const EXTRA_LINES: [string, string][] = [
  ["teach-image", "teach-object"], ["teach-pose", "teach-hand"], ["teach-audio", "number-classifier"], ["teach-object", "teach-audio"],
  ["face-detect", "face-mesh"], ["face-mesh", "object-detect"], ["image-classify", "scene-describe"], ["scene-describe", "pose"],
  ["hand", "gesture"], ["gesture", "opencv-filters"], ["junior-face", "qr-scan"], ["qr-scan", "recognition-cards"], ["recognition-cards", "apriltag"],
  ["speech-to-text", "text-to-speech"], ["translate", "text-classifier"],
];

// Deterministic decorative starfield (no Math.random).
const SKY_BG = Array.from({ length: 70 }, (_, i) => ({
  x: (i * 37) % 100,
  y: (i * 61 + 11) % 100,
  r: 0.18 + ((i * 13) % 6) / 16,
  d: ((i * 7) % 32) / 10,
}));

const StarShape = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
    <path d="M12 1.4c.5 5.7 4.4 9.6 10.1 10.1-5.7.5-9.6 4.4-10.1 10.1-.5-5.7-4.4-9.6-10.1-10.1 5.7-.5 9.6-4.4 10.1-10.1z" fill="currentColor" />
  </svg>
);

function MoreSky({ onPick }: { onPick: (id: string) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);

  const visible = (id: string) => filter === null || sById(id).topic === filter;
  const shown = EXTRA_STARS.filter((s) => visible(s.id));

  return (
    <div className="min-h-0 flex-1 overflow-auto p-4">
      <p className="mb-2 text-center font-mono text-[11px] text-[#5b6b8c]">
        ✦ {filter ? `${shown.length} ${filter} experiments — tap a star` : "Tap a star to open it · hover to see what it does"}
      </p>
      <div
        className="relative mx-auto h-[68vh] min-h-[520px] w-full max-w-[1040px] overflow-hidden rounded-2xl border border-[#1e2738]"
        style={{ backgroundImage: "radial-gradient(ellipse 85% 65% at 50% 38%, #131d3e 0%, #0a1126 48%, #060912 100%)" }}
      >
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {SKY_BG.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#cdd6f4" className="nl-tw" style={{ animationDelay: `${s.d}s` }} />
          ))}
          {EXTRA_LINES.filter(([a, b]) => visible(a) && visible(b)).map(([a, b], i) => {
            const na = sById(a), nb = sById(b);
            const lit = hover != null && (a === hover || b === hover);
            return (
              <line key={i} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} stroke={lit ? sById(hover!).accent : "#46557a"} strokeWidth={lit ? 1.4 : 1} vectorEffect="non-scaling-stroke" opacity={lit ? 0.85 : 0.3} strokeDasharray={lit ? "0" : "2 2"} />
            );
          })}
        </svg>

        {shown.map((s, i) => {
          const isHot = hover === s.id;
          const showLabel = filter !== null || isHot;
          return (
            <button
              key={s.id}
              onClick={() => onPick(s.id)}
              onMouseEnter={() => setHover(s.id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(s.id)}
              onBlur={() => setHover(null)}
              title={`${s.name} — ${s.topic}`}
              className="absolute flex flex-col items-center transition-transform duration-200"
              style={{ left: `${s.x}%`, top: `${s.y}%`, transform: `translate(-50%,-50%) scale(${isHot ? 1.3 : 1})`, zIndex: isHot ? 20 : 10 }}
            >
              <span
                className="nl-star grid place-items-center transition-all duration-200"
                style={{ color: s.accent, filter: `drop-shadow(0 0 ${isHot ? 12 : 5}px ${s.accent})`, animationDelay: `${(i % 5) * 0.5}s` }}
              >
                <StarShape />
              </span>
              {showLabel && (
                <span className="mt-0.5 max-w-[120px] text-center font-mono text-[10px] leading-tight" style={{ color: s.accent }}>
                  {s.name}
                </span>
              )}
              {isHot && (
                <span className="pointer-events-none absolute top-full z-30 mt-4 w-[140px] rounded-lg border px-2 py-1 text-center font-mono text-[9px]" style={{ borderColor: `${s.accent}55`, background: "#0b1018ee", color: "#9fb0d0" }}>
                  {s.blurb}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Topic legend doubles as a filter */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 font-mono text-[9px]">
        <button
          type="button"
          onClick={() => setFilter(null)}
          className="rounded-full border px-2.5 py-1 transition-colors"
          style={{ borderColor: filter === null ? "#cdd6f4" : "#2a3550", color: filter === null ? "#e8eefc" : "#5b6b8c" }}
        >
          ✦ All ({EXTRA_STARS.length})
        </button>
        {EXTRA_TOPICS.map(([label, c]) => {
          const on = filter === label;
          const n = EXTRA_STARS.filter((s) => s.topic === label).length;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setFilter(on ? null : label)}
              className="flex items-center gap-1 rounded-full border px-2.5 py-1 transition-colors"
              style={{ borderColor: on ? c : "#2a3550", color: on ? c : "#5b6b8c" }}
            >
              <span className="inline-block h-2 w-2 rotate-45" style={{ background: c }} /> {label} ({n})
            </button>
          );
        })}
      </div>

      <style>{`
        @keyframes nlTw { 0%,100%{ opacity:.2 } 50%{ opacity:.75 } }
        .nl-tw { animation: nlTw 3s ease-in-out infinite; }
        @keyframes nlStar { 0%,100%{ opacity:.85; transform: scale(1) } 50%{ opacity:1; transform: scale(1.1) } }
        .nl-star { animation: nlStar 3.6s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────── shell ─────────────────────────────────────── */

// Name lookup across all 35 experiments (for the header label).
const NAME: Record<string, string> = {};
NEURONS.forEach((n) => (NAME[n.id] = n.name));
EXTRA_STARS.forEach((s) => (NAME[s.id] = s.name));

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
  const [view, setView] = useState<"network" | "more">("network");

  const Active = sel ? COMP[sel] : null;
  const tab = (key: "network" | "more", label: string) => {
    const on = view === key;
    return (
      <button
        type="button"
        onClick={() => setView(key)}
        className="rounded-lg border px-2.5 py-1 font-mono text-[11px] transition-colors"
        style={{ borderColor: on ? "#34d399" : "#2a3550", background: on ? "#0f1f1a" : "#0f1626", color: on ? "#34d399" : "#7c8baf" }}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex h-full w-full flex-col" style={{ fontFamily: "system-ui, sans-serif" }}>
      <header className="flex items-center gap-3 border-b border-[#1e2738] px-4 py-2.5">
        {sel ? (
          <button onClick={() => setSel(null)} className="flex items-center gap-1 rounded-lg border border-[#2a3550] bg-[#0f1626] px-2.5 py-1 font-mono text-xs text-[#9fb0d0] transition-colors hover:border-[#34d399] hover:text-[#34d399]">
            ← {view === "more" ? "Sky" : "Network"}
          </button>
        ) : (
          <Link href="/" title="Leave Neural Lab" className="flex items-center gap-1 rounded-lg border border-[#2a3550] bg-[#0f1626] px-2.5 py-1 font-mono text-xs text-[#9fb0d0] transition-colors hover:border-[#34d399] hover:text-[#34d399]">
            ← Back
          </Link>
        )}
        <NeuralWordmark />
        <span className="hidden font-mono text-[11px] text-[#5b6b8c] sm:inline">
          {sel ? `// ${NAME[sel]}` : view === "more" ? `// experiment sky · ${EXTRA_STARS.length} experiments` : `// neural net · ${NEURONS.length} core labs`}
        </span>
        {!sel && (
          <div className="ml-auto flex items-center gap-1.5">
            {tab("network", `Network · ${NEURONS.length}`)}
            {tab("more", `+${EXTRA_STARS.length} Experiments`)}
          </div>
        )}
      </header>

      {sel && Active ? (
        <div className="min-h-0 flex-1 overflow-auto p-4"><Active /></div>
      ) : view === "network" ? (
        <NeuralNet onPick={setSel} />
      ) : (
        <MoreSky onPick={setSel} />
      )}
    </div>
  );
}
