"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";

/**
 * Neural Lab — the AI platform shell. The selector is a CONSTELLATION SKY:
 * every experiment is a glowing STAR, topics are constellations joined by faint
 * star-lines, over a twinkling deep-space field. Hover a star to light it; tap
 * to open that experiment full-screen. With many experiments now, the topic
 * legend doubles as a FILTER — pick a topic to focus its constellation. Each
 * experiment is a self-contained component under ./ai-lab, lazy-loaded.
 */

const Loading = () => (
  <div className="grid h-full place-items-center font-mono text-xs text-[#5b6b8c]">Loading experiment…</div>
);

const COMP: Record<string, ReturnType<typeof dynamic>> = {
  // Foundations / fairness / language / creating — the original concept labs
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
  // Vision — live camera (MediaPipe + browser APIs)
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

interface Star { id: string; name: string; topic: string; x: number; y: number; accent: string; blurb: string }
const STARS: Star[] = [
  // Foundations
  { id: "awareness", name: "AI or Not AI?", topic: "Foundations", x: 8, y: 14, accent: "#34d399", blurb: "Smart AI, or just a plain tool?" },
  // Grouping
  { id: "classifier", name: "Train an AI", topic: "Grouping", x: 7, y: 38, accent: "#a855f7", blurb: "Train a model — and spot its bias." },
  { id: "clustering", name: "Group the Unknown", topic: "Grouping", x: 17, y: 50, accent: "#a855f7", blurb: "Group things with no labels." },
  // Training (teachable models)
  { id: "teach-image", name: "Train an Image Brain", topic: "Training", x: 7, y: 66, accent: "#f97316", blurb: "Teach it to tell images apart." },
  { id: "teach-object", name: "Sorting Robot", topic: "Training", x: 18, y: 77, accent: "#f97316", blurb: "Teach a waste-sorting robot." },
  { id: "teach-pose", name: "Pose Trainer", topic: "Training", x: 8, y: 89, accent: "#f97316", blurb: "Teach it your own poses." },
  { id: "teach-hand", name: "Gesture Trainer", topic: "Training", x: 21, y: 90, accent: "#f97316", blurb: "Teach it your own hand signs." },
  { id: "teach-audio", name: "Sound Trainer", topic: "Training", x: 31, y: 80, accent: "#f97316", blurb: "Teach it to tell sounds apart." },
  { id: "number-classifier", name: "Number Brain", topic: "Training", x: 30, y: 66, accent: "#f97316", blurb: "Classify & predict from numbers." },
  // Vision (live camera + classic CV)
  { id: "vision", name: "Spot the Mistake", topic: "Vision", x: 41, y: 20, accent: "#22d3ee", blurb: "Why the AI saw it wrong." },
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
  { id: "sentiment", name: "Mood Meter", topic: "Language", x: 83, y: 15, accent: "#60a5fa", blurb: "Read the mood of a message." },
  { id: "chatbot", name: "Chatbot Brain", topic: "Language", x: 92, y: 23, accent: "#60a5fa", blurb: "A bot that gets what you ask." },
  { id: "speech-to-text", name: "Speech to Text", topic: "Language", x: 84, y: 35, accent: "#60a5fa", blurb: "Turn your voice into text." },
  { id: "text-to-speech", name: "Text to Speech", topic: "Language", x: 93, y: 43, accent: "#60a5fa", blurb: "Make the computer talk." },
  { id: "translate", name: "Translator", topic: "Language", x: 83, y: 52, accent: "#60a5fa", blurb: "Translate across languages." },
  { id: "text-classifier", name: "Text Trainer", topic: "Language", x: 92, y: 61, accent: "#60a5fa", blurb: "Teach it to sort sentences." },
  // Creating
  { id: "prompt", name: "Prompt Lab", topic: "Creating", x: 74, y: 9, accent: "#eab308", blurb: "Prompt it, catch it inventing." },
  { id: "genai-chat", name: "Word Weaver", topic: "Creating", x: 78, y: 79, accent: "#eab308", blurb: "Generate text, word by word." },
  // Fairness
  { id: "ethics", name: "Who's Affected?", topic: "Fairness", x: 78, y: 70, accent: "#fb7185", blurb: "Who it helps, who it harms." },
  { id: "evaluation", name: "How Good Is It?", topic: "Fairness", x: 90, y: 78, accent: "#fb7185", blurb: "Accuracy, precision, recall." },
  { id: "recommend", name: "Recommend-o-Bot", topic: "Fairness", x: 82, y: 90, accent: "#fb7185", blurb: "Fall into a filter bubble." },
];
const byId = (id: string) => STARS.find((s) => s.id === id)!;

const TOPICS: [string, string][] = [
  ["Foundations", "#34d399"],
  ["Grouping", "#a855f7"],
  ["Training", "#f97316"],
  ["Vision", "#22d3ee"],
  ["Language", "#60a5fa"],
  ["Creating", "#eab308"],
  ["Fairness", "#fb7185"],
];

// Constellation lines join stars WITHIN a topic.
const LINES: [string, string][] = [
  ["classifier", "clustering"],
  ["teach-image", "teach-object"], ["teach-pose", "teach-hand"], ["teach-audio", "number-classifier"], ["teach-object", "teach-audio"],
  ["vision", "face-detect"], ["face-detect", "face-mesh"], ["face-mesh", "object-detect"], ["image-classify", "scene-describe"],
  ["scene-describe", "pose"], ["hand", "gesture"], ["gesture", "opencv-filters"], ["junior-face", "qr-scan"], ["qr-scan", "recognition-cards"], ["recognition-cards", "apriltag"],
  ["sentiment", "chatbot"], ["speech-to-text", "text-to-speech"], ["translate", "text-classifier"],
  ["prompt", "genai-chat"],
  ["ethics", "evaluation"], ["evaluation", "recommend"], ["recommend", "ethics"],
];

// Deterministic decorative starfield (no Math.random).
const BG = Array.from({ length: 70 }, (_, i) => ({
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
  <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
    <path d="M12 1.4c.5 5.7 4.4 9.6 10.1 10.1-5.7.5-9.6 4.4-10.1 10.1-.5-5.7-4.4-9.6-10.1-10.1 5.7-.5 9.6-4.4 10.1-10.1z" fill="currentColor" />
  </svg>
);

export function AILab() {
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);

  const current = sel ? byId(sel) : null;
  const Active = sel ? COMP[sel] : null;
  const visible = (id: string) => filter === null || byId(id).topic === filter;
  const shown = STARS.filter((s) => visible(s.id));

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
          <p className="mb-2 text-center font-mono text-[11px] text-[#5b6b8c]">
            ✦ {filter ? `${shown.length} ${filter} experiments — tap a star` : "Tap a star to open it · hover to see what it does"}
          </p>
          <div
            className="relative mx-auto h-[68vh] min-h-[520px] w-full max-w-[1040px] overflow-hidden rounded-2xl border border-[#1e2738]"
            style={{ backgroundImage: "radial-gradient(ellipse 85% 65% at 50% 38%, #131d3e 0%, #0a1126 48%, #060912 100%)" }}
          >
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {BG.map((s, i) => (
                <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#cdd6f4" className="nl-tw" style={{ animationDelay: `${s.d}s` }} />
              ))}
              {LINES.filter(([a, b]) => visible(a) && visible(b)).map(([a, b], i) => {
                const na = byId(a), nb = byId(b);
                const lit = hover != null && (a === hover || b === hover);
                return (
                  <line key={i} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} stroke={lit ? byId(hover!).accent : "#46557a"} strokeWidth={lit ? 1.4 : 1} vectorEffect="non-scaling-stroke" opacity={lit ? 0.85 : 0.3} strokeDasharray={lit ? "0" : "2 2"} />
                );
              })}
            </svg>

            {shown.map((s, i) => {
              const isHot = hover === s.id;
              const showLabel = filter !== null || isHot;
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
              ✦ All ({STARS.length})
            </button>
            {TOPICS.map(([label, c]) => {
              const on = filter === label;
              const n = STARS.filter((s) => s.topic === label).length;
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
      )}
    </div>
  );
}
