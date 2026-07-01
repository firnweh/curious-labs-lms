"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";

/**
 * Neural Lab — the AI platform shell. All 35 hands-on experiments live in one
 * LEARNING JOURNEY laid out as a neural network: a Novice start node on the
 * left, category-coloured activity nodes flowing left→right through Foundations
 * → Training → Vision → Language → Creating → Fairness, and an AI Mastery output
 * node on the right. A glowing path threads the journey; synapses fire between
 * layers; hovering a node reveals what it does. Every experiment is a
 * self-contained component under ./ai-lab, lazy-loaded on open.
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

/* ─────────────────────────── activities + categories ─────────────────────────── */

type Cat = "Foundations" | "Training" | "Vision" | "Language" | "Creating" | "Fairness";
interface Activity { id: string; name: string; cat: Cat; blurb: string; core?: boolean }

const CAT_COLOR: Record<Cat, string> = {
  Foundations: "#34d399",
  Training: "#f97316",
  Vision: "#22d3ee",
  Language: "#60a5fa",
  Creating: "#eab308",
  Fairness: "#fb7185",
};
const CAT_SUB: Record<Cat, string> = {
  Foundations: "what AI is",
  Training: "teach a model",
  Vision: "AI that sees",
  Language: "AI that talks",
  Creating: "AI that makes",
  Fairness: "judge & question",
};

// Journey order, core concept labs first in each stage, hands-on experiments after.
const STAGE_IDS: Record<Cat, string[]> = {
  Foundations: ["awareness"],
  Training: ["classifier", "clustering", "number-classifier", "teach-image", "teach-object", "teach-pose", "teach-hand", "teach-audio"],
  Vision: ["vision", "image-classify", "scene-describe", "object-detect", "face-detect", "face-mesh", "pose", "hand", "gesture", "opencv-filters", "junior-face", "qr-scan", "recognition-cards", "apriltag", "ocr"],
  Language: ["sentiment", "chatbot", "speech-to-text", "text-to-speech", "translate", "text-classifier"],
  Creating: ["prompt", "genai-chat"],
  Fairness: ["ethics", "evaluation", "recommend"],
};

const ACT: Record<string, Activity> = {};
const add = (id: string, name: string, cat: Cat, blurb: string, core = false) => (ACT[id] = { id, name, cat, blurb, core });
// Foundations
add("awareness", "AI or Not AI?", "Foundations", "Smart AI, or just a plain tool?", true);
// Training
add("classifier", "Train an AI", "Training", "Train a model — and spot its bias.", true);
add("clustering", "Group the Unknown", "Training", "Group things with no labels.", true);
add("number-classifier", "Number Brain", "Training", "Classify & predict from numbers.");
add("teach-image", "Train an Image Brain", "Training", "Teach it to tell images apart.");
add("teach-object", "Sorting Robot", "Training", "Teach a waste-sorting robot.");
add("teach-pose", "Pose Trainer", "Training", "Teach it your own poses.");
add("teach-hand", "Gesture Trainer", "Training", "Teach it your own hand signs.");
add("teach-audio", "Sound Trainer", "Training", "Teach it to tell sounds apart.");
// Vision
add("vision", "Spot the Mistake", "Vision", "Why the AI saw it wrong.", true);
add("image-classify", "Image Labeler", "Vision", "Guess what the picture shows.");
add("scene-describe", "Scene Describer", "Vision", "Snap a photo, get a caption.");
add("object-detect", "Object Spotter", "Vision", "Find & box everyday objects.");
add("face-detect", "Face Finder", "Vision", "Find faces live on camera.");
add("face-mesh", "Face Mesh", "Vision", "478-point mesh + expressions.");
add("pose", "Pose Tracker", "Vision", "Track your body as a skeleton.");
add("hand", "Hand Tracker", "Vision", "Map 21 points of your hand.");
add("gesture", "Gesture Reader", "Vision", "Name your hand gestures live.");
add("opencv-filters", "Pixel Lab", "Vision", "Bend pixels with CV filters.");
add("junior-face", "Peekaboo", "Vision", "Face peekaboo for little kids.");
add("qr-scan", "QR Scanner", "Vision", "Decode QR codes live.");
add("recognition-cards", "Sign Driver", "Vision", "Steer a robot with hand signs.");
add("apriltag", "Robot Tags", "Vision", "How robots read marker tags.");
add("ocr", "Text Reader", "Vision", "Read printed text (OCR).");
// Language
add("sentiment", "Mood Meter", "Language", "Read the mood of a message.", true);
add("chatbot", "Chatbot Brain", "Language", "A bot that gets what you ask.", true);
add("speech-to-text", "Speech to Text", "Language", "Turn your voice into text.");
add("text-to-speech", "Text to Speech", "Language", "Make the computer talk.");
add("translate", "Translator", "Language", "Translate across languages.");
add("text-classifier", "Text Trainer", "Language", "Teach it to sort sentences.");
// Creating
add("prompt", "Prompt Lab", "Creating", "Prompt it, catch it inventing.", true);
add("genai-chat", "Word Weaver", "Creating", "Generate text, word by word.");
// Fairness
add("ethics", "Who's Affected?", "Fairness", "Who it helps, who it harms.", true);
add("evaluation", "How Good Is It?", "Fairness", "Accuracy, precision, recall.", true);
add("recommend", "Recommend-o-Bot", "Fairness", "Fall into a filter bubble.", true);

// Line icons for the 10 core concept labs (24x24, stroke=currentColor).
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

/* ─────────────────────────── layout (deterministic) ─────────────────────────── */

const STAGES: { cat: Cat; cx: number }[] = [
  { cat: "Foundations", cx: 13 },
  { cat: "Training", cx: 27 },
  { cat: "Vision", cx: 48 },
  { cat: "Language", cx: 68 },
  { cat: "Creating", cx: 80 },
  { cat: "Fairness", cx: 90 },
];
const NOVICE = { x: 4, y: 50 };
const MASTERY = { x: 97, y: 50 };

const YTOP = 17, YBOT = 83, SP = 15;
function place(ids: string[], cx: number): { id: string; x: number; y: number }[] {
  const n = ids.length;
  const cols = n <= 6 ? 1 : n <= 12 ? 2 : 3;
  const perCol = Math.ceil(n / cols);
  const colGap = 7;
  const x0 = cx - ((cols - 1) * colGap) / 2;
  return ids.map((id, i) => {
    const col = Math.floor(i / perCol);
    const inCol = i % perCol;
    const colN = Math.min(perCol, n - col * perCol);
    const step = Math.min(SP, (YBOT - YTOP) / Math.max(colN - 1, 1));
    const y = colN === 1 ? 50 : 50 + (inCol - (colN - 1) / 2) * step;
    return { id, x: x0 + col * colGap, y };
  });
}

const POS: Record<string, { x: number; y: number }> = {};
STAGES.forEach((s) => place(STAGE_IDS[s.cat], s.cx).forEach((p) => (POS[p.id] = { x: p.x, y: p.y })));

// Forward synapses: each node wires to its 2 nearest nodes in the next stage.
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
interface Edge { a: string; b: string; ax: number; ay: number; bx: number; by: number; color: string }
const EDGES: Edge[] = [];
const edge = (a: string, ap: { x: number; y: number }, b: string, bp: { x: number; y: number }) => {
  const cat = ACT[a]?.cat;
  const color = cat ? CAT_COLOR[cat] : "#34d399"; // synapses tinted by the source stage's category
  EDGES.push({ a, b, ax: ap.x, ay: ap.y, bx: bp.x, by: bp.y, color });
};
STAGE_IDS[STAGES[0].cat].forEach((id) => edge("novice", NOVICE, id, POS[id]));
for (let s = 0; s < STAGES.length - 1; s++) {
  const A = STAGE_IDS[STAGES[s].cat], B = STAGE_IDS[STAGES[s + 1].cat];
  A.forEach((aid) => {
    const near = [...B].sort((x, y) => dist(POS[aid], POS[x]) - dist(POS[aid], POS[y])).slice(0, 3);
    near.forEach((bid) => edge(aid, POS[aid], bid, POS[bid]));
  });
}
STAGE_IDS[STAGES[STAGES.length - 1].cat].forEach((id) => edge(id, POS[id], "mastery", MASTERY));

// neighbours (for hover lighting)
const NEIGH: Record<string, Set<string>> = {};
EDGES.forEach((e) => {
  (NEIGH[e.a] ||= new Set()).add(e.b);
  (NEIGH[e.b] ||= new Set()).add(e.a);
});

// Journey path — Novice → the mid node of each stage → AI Mastery.
const midOf = (ids: string[]) => ids.map((id) => POS[id]).sort((a, b) => Math.abs(a.y - 50) - Math.abs(b.y - 50))[0];
const WAY = [NOVICE, ...STAGES.map((s) => midOf(STAGE_IDS[s.cat])), MASTERY];
function smooth(pts: { x: number; y: number }[]) {
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}
const JOURNEY = smooth(WAY);

const NAME: Record<string, string> = {};
Object.values(ACT).forEach((a) => (NAME[a.id] = a.name));
const TOTAL = Object.keys(ACT).length;

// deterministic starfield
const BG = Array.from({ length: 60 }, (_, i) => ({ x: (i * 41) % 100, y: (i * 67 + 9) % 100, r: 0.16 + ((i * 13) % 6) / 20, d: ((i * 7) % 32) / 10 }));

/* ─────────────────────────── the journey view ─────────────────────────── */

function NeuralJourney({ onPick }: { onPick: (id: string) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const hoverCat = hover && ACT[hover] ? ACT[hover].cat : null;
  const hotColor = hoverCat ? CAT_COLOR[hoverCat] : "#eab308";

  const nodeList = STAGES.flatMap((s) => STAGE_IDS[s.cat]);

  return (
    <div
      className="relative min-h-0 flex-1 overflow-hidden"
      style={{ backgroundImage: "radial-gradient(ellipse 100% 85% at 50% 45%, #131d40 0%, #0a1126 52%, #060912 100%)" }}
    >
      <p className="pointer-events-none absolute left-1/2 top-2 z-30 -translate-x-1/2 text-center font-mono text-[11px] text-[#7c8baf]">
        ⚡ Follow the path from <span style={{ color: "#34d399" }}>Novice</span> to <span style={{ color: "#facc15" }}>AI Mastery</span> — tap any node to open it
      </p>

      {/* category headers */}
      {STAGES.map((s) => (
        <div key={s.cat} className="pointer-events-none absolute z-20 -translate-x-1/2 text-center" style={{ left: `${s.cx}%`, top: "8.5%" }}>
          <div className="font-mono text-[11px] font-bold tracking-[0.18em]" style={{ color: CAT_COLOR[s.cat] }}>{s.cat.toUpperCase()}</div>
          <div className="font-mono text-[8.5px] tracking-[0.14em] text-[#566a90]">{CAT_SUB[s.cat]}</div>
        </div>
      ))}

      {/* svg: starfield · synapses · journey path */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {BG.map((s, i) => (
          <circle key={`bg${i}`} cx={s.x} cy={s.y} r={s.r} fill="#cdd6f4" className="nj-tw" style={{ animationDelay: `${s.d}s` }} />
        ))}
        {EDGES.map((e, i) => {
          const lit = hover != null && (e.a === hover || e.b === hover);
          return (
            <g key={i}>
              {/* solid synapse — tinted by source category so the net reads as colour-coded layers */}
              <line
                x1={e.ax} y1={e.ay} x2={e.bx} y2={e.by}
                stroke={lit ? hotColor : e.color} strokeWidth={lit ? 1.5 : 0.7}
                vectorEffect="non-scaling-stroke"
                opacity={lit ? 0.95 : hover ? 0.07 : 0.42}
              />
              {/* firing pulse travelling along the synapse */}
              <line
                x1={e.ax} y1={e.ay} x2={e.bx} y2={e.by}
                stroke={lit ? "#ffffff" : "#aebbe0"} strokeWidth={lit ? 1.3 : 0.9}
                strokeLinecap="round" strokeDasharray="0.7 6"
                vectorEffect="non-scaling-stroke" className="nj-flow"
                opacity={lit ? 1 : hover ? 0.04 : 0.5}
                style={{ animationDelay: `${(i % 8) * 0.18}s` }}
              />
            </g>
          );
        })}
        {/* journey path — glow + core + animated flow */}
        <path d={JOURNEY} fill="none" stroke="#facc15" strokeWidth={7} strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={hover ? 0.1 : 0.16} style={{ filter: "blur(1px)" }} />
        <path d={JOURNEY} fill="none" stroke="#f5c542" strokeWidth={1.6} strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={hover ? 0.3 : 0.75} />
        <path d={JOURNEY} fill="none" stroke="#fff7d6" strokeWidth={1.6} strokeLinecap="round" strokeDasharray="0.6 7" vectorEffect="non-scaling-stroke" className="nj-flow" opacity={hover ? 0.3 : 0.9} />
      </svg>

      {/* Novice + Mastery milestones */}
      <Milestone x={NOVICE.x} y={NOVICE.y} color="#34d399" title="NOVICE" sub="start here" glyph="🌱" side="right" dim={hover != null} />
      <Milestone x={MASTERY.x} y={MASTERY.y} color="#facc15" title="AI MASTERY" sub="you made it!" glyph="🏆" side="left" dim={hover != null} />

      {/* activity nodes */}
      {nodeList.map((id, i) => {
        const a = ACT[id];
        const p = POS[id];
        const color = CAT_COLOR[a.cat];
        const isHot = hover === id;
        const lit = hover != null && (isHot || NEIGH[hover]?.has(id));
        const dim = hover != null && !lit;
        const above = p.y > 56;
        const sz = a.core ? 38 : 28;
        return (
          <button
            key={id}
            onClick={() => onPick(id)}
            onMouseEnter={() => setHover(id)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(id)}
            onBlur={() => setHover(null)}
            title={`${a.name} — ${a.cat}`}
            className="absolute flex flex-col items-center transition-all duration-200"
            style={{ left: `${p.x}%`, top: `${p.y}%`, transform: `translate(-50%,-50%) scale(${isHot ? 1.28 : 1})`, zIndex: isHot ? 45 : 12, opacity: dim ? 0.4 : 1 }}
          >
            <span
              className="nj-node grid place-items-center rounded-full"
              style={{
                width: sz, height: sz,
                background: "radial-gradient(circle at 50% 32%, #16263f, #070d18 82%)",
                border: `2px solid ${color}`,
                boxShadow: `0 0 ${isHot ? 22 : lit ? 14 : 8}px ${isHot ? color : color + "cc"}, inset 0 0 8px ${color}44`,
                color: "#eef4ff",
                animationDelay: `${(i % 6) * 0.45}s`,
              }}
            >
              {a.core ? (
                <svg
                  viewBox="0 0 24 24" width={sz > 34 ? 21 : 16} height={sz > 34 ? 21 : 16}
                  fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                  style={{ filter: `drop-shadow(0 0 3px ${color})` }}
                  dangerouslySetInnerHTML={{ __html: ICON[id] }}
                />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" style={{ color, filter: `drop-shadow(0 0 3px ${color})` }}>
                  <path d="M12 1.4c.5 5.7 4.4 9.6 10.1 10.1-5.7.5-9.6 4.4-10.1 10.1-.5-5.7-4.4-9.6-10.1-10.1 5.7-.5 9.6-4.4 10.1-10.1z" fill="currentColor" />
                </svg>
              )}
            </span>
            <span
              className="mt-1 max-w-[92px] text-center font-mono text-[9px] leading-tight transition-colors"
              style={{ color: isHot || lit ? color : "#7f8dad" }}
            >
              {a.name}
            </span>
            {isHot && (
              <span
                className="pointer-events-none absolute left-1/2 z-50 w-[168px] -translate-x-1/2 rounded-lg border px-2.5 py-1.5 text-center font-mono"
                style={{ borderColor: `${color}66`, background: "#0b1018f2", color: "#cdd8f0", [above ? "bottom" : "top"]: "100%", [above ? "marginBottom" : "marginTop"]: 8 } as React.CSSProperties}
              >
                <span className="block text-[10px] font-bold" style={{ color }}>{a.name}</span>
                <span className="mt-0.5 block text-[9px] leading-snug text-[#9fb0d0]">{a.blurb}</span>
                <span className="mt-1 block text-[8px] uppercase tracking-[0.15em] text-[#5b6b8c]">{a.cat} · {a.core ? "concept lab" : "hands-on"}</span>
              </span>
            )}
          </button>
        );
      })}

      {/* legend */}
      <div className="pointer-events-none absolute bottom-2.5 left-1/2 z-20 flex max-w-full -translate-x-1/2 flex-wrap items-center justify-center gap-x-3.5 gap-y-1 px-3 font-mono text-[9px] text-[#5b6b8c]">
        {(Object.keys(CAT_COLOR) as Cat[]).map((c) => (
          <span key={c} className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: CAT_COLOR[c], boxShadow: `0 0 5px ${CAT_COLOR[c]}` }} />
            {c} ({STAGE_IDS[c].length})
          </span>
        ))}
      </div>

      <style>{`
        @keyframes njTw { 0%,100%{ opacity:.16 } 50%{ opacity:.62 } }
        .nj-tw { animation: njTw 3s ease-in-out infinite; }
        @keyframes njFlow { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -7.6; } }
        .nj-flow { animation: njFlow 1.5s linear infinite; }
        @keyframes njBreathe { 0%,100%{ transform: scale(1); } 50%{ transform: scale(1.07); } }
        .nj-node { animation: njBreathe 3.6s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

function Milestone({ x, y, color, title, sub, glyph, side, dim }: { x: number; y: number; color: string; title: string; sub: string; glyph: string; side: "left" | "right"; dim: boolean }) {
  return (
    <div className="pointer-events-none absolute z-30 flex flex-col items-center" style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)", opacity: dim ? 0.6 : 1, transition: "opacity .2s" }}>
      <span
        className="nj-node grid place-items-center rounded-full text-2xl"
        style={{ width: 56, height: 56, background: "radial-gradient(circle at 50% 30%, #16263f, #070d18 82%)", border: `2.5px solid ${color}`, boxShadow: `0 0 24px ${color}, inset 0 0 12px ${color}55` }}
      >
        {glyph}
      </span>
      <div className="mt-1 text-center" style={{ minWidth: 74 }}>
        <div className="font-mono text-[11px] font-bold tracking-[0.14em]" style={{ color }}>{title}</div>
        <div className="font-mono text-[8.5px] text-[#7c8baf]">{sub}</div>
      </div>
      <span aria-hidden className="absolute top-1/2 -translate-y-1/2 font-mono text-lg" style={{ color, [side]: -18, opacity: 0.7 } as React.CSSProperties}>
        {side === "right" ? "»" : "«"}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────── shell ─────────────────────────────────────── */

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
  const Active = sel ? COMP[sel] : null;

  return (
    <div className="flex h-full w-full flex-col" style={{ fontFamily: "system-ui, sans-serif" }}>
      <header className="flex items-center gap-3 border-b border-[#1e2738] px-4 py-2.5">
        {sel ? (
          <button onClick={() => setSel(null)} className="flex items-center gap-1 rounded-lg border border-[#2a3550] bg-[#0f1626] px-2.5 py-1 font-mono text-xs text-[#9fb0d0] transition-colors hover:border-[#34d399] hover:text-[#34d399]">
            ← Journey
          </button>
        ) : (
          <Link href="/" title="Leave Neural Lab" className="flex items-center gap-1 rounded-lg border border-[#2a3550] bg-[#0f1626] px-2.5 py-1 font-mono text-xs text-[#9fb0d0] transition-colors hover:border-[#34d399] hover:text-[#34d399]">
            ← Back
          </Link>
        )}
        <NeuralWordmark />
        <span className="hidden font-mono text-[11px] text-[#5b6b8c] sm:inline">
          {sel ? `// ${NAME[sel]}` : `// learning journey · ${TOTAL} experiments`}
        </span>
      </header>

      {sel && Active ? (
        <div className="min-h-0 flex-1 overflow-auto p-4"><Active /></div>
      ) : (
        <NeuralJourney onPick={setSel} />
      )}
    </div>
  );
}
