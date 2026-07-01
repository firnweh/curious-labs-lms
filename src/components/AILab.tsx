"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

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
  "number-classifier": "<rect x='3' y='4' width='5' height='5' rx='1'/><rect x='9.5' y='4' width='5' height='5' rx='1'/><rect x='16' y='4' width='5' height='5' rx='1'/><polyline points='4 20 9 15 13 18 20 11'/><polyline points='16 11 20 11 20 15'/>",
  "teach-image": "<rect x='3' y='5' width='14' height='12' rx='1.5'/><path d='M6 14l3-3.5 2.5 2.5L14 10'/><circle cx='7' cy='8.5' r='1.3'/><path d='M19 16v5M16.5 18.5h5'/>",
  "teach-object": "<rect x='3' y='13' width='7' height='8' rx='1'/><rect x='14' y='13' width='7' height='8' rx='1'/><circle cx='6.5' cy='4' r='1.6'/><polyline points='6.5 6 6.5 10 6.5 10'/><polyline points='4 8 6.5 10.5 9 8'/>",
  "teach-pose": "<circle cx='12' cy='5' r='2.5'/><path d='M12 8v7'/><path d='M12 10l-4-2'/><path d='M12 10l4 1'/><path d='M12 15l-3 5'/><path d='M12 15l3 4'/>",
  "teach-hand": "<path d='M7 12V6.5a1.3 1.3 0 0 1 2.6 0V11'/><path d='M9.6 11V5.3a1.3 1.3 0 0 1 2.6 0V11'/><path d='M12.2 11V6a1.3 1.3 0 0 1 2.6 0V11'/><path d='M14.8 11V8a1.3 1.3 0 0 1 2.6 0v5a5.4 5.4 0 0 1-5.4 5.4h-2A5.4 5.4 0 0 1 4.6 15l-1.3-2.4a1.3 1.3 0 0 1 2.2-1.3L7 12.6'/>",
  "teach-audio": "<rect x='9' y='3' width='6' height='11' rx='3'/><path d='M6 11a6 6 0 0 0 12 0'/><line x1='12' y1='17' x2='12' y2='21'/><line x1='9' y1='21' x2='15' y2='21'/>",
  "image-classify": "<rect x='3' y='4' width='12' height='12' rx='1.5'/><path d='M3 12l3-3 3 3 2-2 4 4'/><circle cx='7' cy='8' r='1' fill='currentColor' stroke='none'/><path d='M13 15l4 4a2 2 0 0 0 2.8 0l1-1a2 2 0 0 0 0-2.8l-4-4'/><circle cx='18.5' cy='15.5' r='1' fill='currentColor' stroke='none'/>",
  "scene-describe": "<rect x='3' y='5' width='10' height='9' rx='1'/><circle cx='6' cy='8' r='1'/><path d='m4 13 3-3 2.5 2.5'/><line x1='16' y1='7' x2='21' y2='7'/><line x1='16' y1='11' x2='20' y2='11'/>",
  "object-detect": "<polyline points='4 6 4 4 6 4'/><polyline points='18 4 20 4 20 6'/><polyline points='20 18 20 20 18 20'/><polyline points='6 20 4 20 4 18'/><rect x='9' y='9' width='6' height='6' rx='1'/>",
  "face-detect": "<circle cx='12' cy='12' r='4'/><circle cx='10.5' cy='11' r='0.6' fill='currentColor' stroke='none'/><circle cx='13.5' cy='11' r='0.6' fill='currentColor' stroke='none'/><path d='M10.5 13.2c.5.6 2.5.6 3 0'/><path d='M4 8V5h3'/><path d='M20 8V5h-3'/><path d='M4 16v3h3'/><path d='M20 16v3h-3'/>",
  "face-mesh": "<ellipse cx='12' cy='12' rx='7' ry='9'/><path d='M8 8l4 3 4-3M8 8l-1 5 5 3 5-3-1-5M12 11l0 5'/><circle cx='9' cy='10' r='0.6' fill='currentColor' stroke='none'/><circle cx='15' cy='10' r='0.6' fill='currentColor' stroke='none'/>",
  "pose": "<circle cx='12' cy='4.5' r='2'/><line x1='12' y1='6.5' x2='12' y2='14'/><line x1='6' y1='8.5' x2='18' y2='8.5'/><line x1='6' y1='8.5' x2='4' y2='13'/><line x1='18' y1='8.5' x2='20' y2='13'/><line x1='12' y1='14' x2='8' y2='21'/><line x1='12' y1='14' x2='16' y2='21'/><circle cx='6' cy='8.5' r='0.9' fill='currentColor' stroke='none'/><circle cx='18' cy='8.5' r='0.9' fill='currentColor' stroke='none'/><circle cx='12' cy='14' r='0.9' fill='currentColor' stroke='none'/>",
  "hand": "<path d='M7 14v-3a1 1 0 0 1 2 0v1'/><path d='M9 12V8a1 1 0 0 1 2 0v3'/><path d='M11 11V7a1 1 0 0 1 2 0v4'/><path d='M13 11V9a1 1 0 0 1 2 0v4c0 4-2 8-5 8s-6-3-6-6l1-3a1 1 0 0 1 2 1'/><circle cx='8' cy='8' r='0.7' fill='currentColor' stroke='none'/><circle cx='12' cy='7' r='0.7' fill='currentColor' stroke='none'/><circle cx='14' cy='9' r='0.7' fill='currentColor' stroke='none'/>",
  "gesture": "<path d='M7 21v-8H5a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1h2l3-6a2 2 0 0 1 2 2v4h5a2 2 0 0 1 2 2l-1 6a2 2 0 0 1-2 2H7Z'/>",
  "opencv-filters": "<rect x='4' y='4' width='7' height='7'/><rect x='13' y='4' width='7' height='7'/><rect x='4' y='13' width='7' height='7'/><line x1='13' y1='17' x2='20' y2='17'/><circle cx='16' cy='17' r='1.6' fill='currentColor' stroke='none'/>",
  "junior-face": "<circle cx='12' cy='12' r='9'/><circle cx='9' cy='10' r='1' fill='currentColor' stroke='none'/><circle cx='15' cy='10' r='1' fill='currentColor' stroke='none'/><path d='M8 14a5 4 0 0 0 8 0'/>",
  "qr-scan": "<rect x='4' y='4' width='16' height='16' rx='2'/><rect x='7' y='7' width='3' height='3' fill='currentColor' stroke='none'/><rect x='14' y='7' width='3' height='3' fill='currentColor' stroke='none'/><rect x='7' y='14' width='3' height='3' fill='currentColor' stroke='none'/><line x1='14' y1='14' x2='14' y2='14'/><rect x='14.5' y='14.5' width='2' height='2' fill='currentColor' stroke='none'/>",
  "recognition-cards": "<rect x='5' y='4' width='14' height='16' rx='2'/><line x1='12' y1='16' x2='12' y2='8'/><polyline points='8.5 11.5 12 8 15.5 11.5'/>",
  "apriltag": "<rect x='3' y='3' width='18' height='18' rx='1'/><rect x='6' y='6' width='12' height='12'/><rect x='9' y='9' width='3' height='3' fill='currentColor' stroke='none'/><rect x='13' y='13' width='2' height='2' fill='currentColor' stroke='none'/>",
  "ocr": "<rect x='5' y='3' width='14' height='18' rx='1.5'/><line x1='8' y1='7' x2='16' y2='7'/><line x1='8' y1='11' x2='16' y2='11'/><line x1='8' y1='15' x2='13' y2='15'/><line x1='3' y1='11' x2='21' y2='11'/>",
  "speech-to-text": "<rect x='6' y='3' width='5' height='10' rx='2.5'/><path d='M4 11a4.5 4.5 0 0 0 9 0'/><line x1='8.5' y1='15.5' x2='8.5' y2='18'/><line x1='15' y1='7' x2='21' y2='7'/><line x1='15' y1='11' x2='19' y2='11'/>",
  "text-to-speech": "<path d='M4 9h4l4-3v12l-4-3H4z'/><path d='M16 9a4 4 0 0 1 0 6'/><path d='M18.5 7a7 7 0 0 1 0 10'/>",
  "translate": "<path d='M3 15l3-8 3 8'/><line x1='3.8' y1='12.5' x2='8.2' y2='12.5'/><path d='M15 20h6l-3-8-3 8'/><circle cx='18' cy='6' r='2'/><line x1='18' y1='3' x2='18' y2='8'/>",
  "text-classifier": "<line x1='4' y1='6' x2='14' y2='6'/><line x1='4' y1='10' x2='11' y2='10'/><path d='M12 8h5m0 0-2-2m2 2-2 2'/><rect x='4' y='16' width='6' height='4'/><rect x='14' y='16' width='6' height='4'/>",
  "genai-chat": "<path d='M4 20l3-1 11-11-2-2L5 17l-1 3Z'/><line x1='4' y1='20' x2='14' y2='20'/><path d='M19 4l.7 1.3L21 6l-1.3.7L19 8l-.7-1.3L17 6l1.3-.7Z'/>",
};

/* ─────────────────────────── layout (deterministic) ─────────────────────────── */

// "input layer" style tags reinforce the deep-net reading.
const STAGES: { cat: Cat; cx: number; tag: string }[] = [
  { cat: "Foundations", cx: 13, tag: "input layer" },
  { cat: "Training", cx: 28, tag: "hidden 1" },
  { cat: "Vision", cx: 48, tag: "hidden 2" },
  { cat: "Language", cx: 68, tag: "hidden 3" },
  { cat: "Creating", cx: 80, tag: "hidden 4" },
  { cat: "Fairness", cx: 91, tag: "output layer" },
];
const NOVICE = { x: 4, y: 50 };
const MASTERY = { x: 97, y: 50 };
const BAND_W = 15; // category "layer" band width, in 0..100 units

const YTOP = 17, YBOT = 83, SP = 15;
function place(ids: string[], cx: number): { id: string; x: number; y: number }[] {
  const n = ids.length;
  const cols = n <= 6 ? 1 : n <= 12 ? 2 : 3;
  const perCol = Math.ceil(n / cols);
  const colGap = cols === 3 ? 5.5 : 7;
  const x0 = cx - ((cols - 1) * colGap) / 2;
  return ids.map((id, i) => {
    const col = Math.floor(i / perCol);
    const inCol = i % perCol;
    const colN = Math.min(perCol, n - col * perCol);
    // sparse stages spread wider so they feel intentional, not lonely
    const step = Math.min(colN <= 3 ? 22 : SP, (YBOT - YTOP) / Math.max(colN - 1, 1));
    let y = colN === 1 ? 50 : 50 + (inCol - (colN - 1) / 2) * step;
    if (cols === 3 && col === 1) y += step / 2; // hex-stagger the middle Vision column
    y = Math.max(YTOP - 3, Math.min(YBOT + 3, y));
    return { id, x: x0 + col * colGap, y };
  });
}

const POS: Record<string, { x: number; y: number }> = {};
STAGES.forEach((s) => place(STAGE_IDS[s.cat], s.cx).forEach((p) => (POS[p.id] = { x: p.x, y: p.y })));

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
interface Edge { a: string; b: string; ax: number; ay: number; bx: number; by: number; color: string; tcolor: string }
const RAW: Edge[] = [];
const edge = (a: string, ap: { x: number; y: number }, b: string, bp: { x: number; y: number }) => {
  const ac = ACT[a]?.cat, bc = ACT[b]?.cat;
  const color = ac ? CAT_COLOR[ac] : "#34d399"; // source tint (novice → green)
  const tcolor = bc ? CAT_COLOR[bc] : "#facc15"; // target tint (mastery → gold)
  RAW.push({ a, b, ax: ap.x, ay: ap.y, bx: bp.x, by: bp.y, color, tcolor });
};

// Wire the net COLUMN-by-COLUMN (each vertical column → the next), so that
// multi-column stages (Vision's 3 columns, Training's 2) are threaded together
// internally instead of leaving inner columns orphaned. Each source fans out to
// its 2 nearest in the next column, and every target is guaranteed its nearest
// incoming — so no node is ever left unconnected.
const posOf = (id: string) => (id === "novice" ? NOVICE : id === "mastery" ? MASTERY : POS[id]);
const colGroups = new Map<number, string[]>();
STAGES.flatMap((s) => STAGE_IDS[s.cat]).forEach((id) => {
  const xk = Math.round(POS[id].x * 2) / 2;
  (colGroups.get(xk) || colGroups.set(xk, []).get(xk)!).push(id);
});
const CHAIN: string[][] = [["novice"], ...[...colGroups.entries()].sort((a, b) => a[0] - b[0]).map(([, ids]) => ids), ["mastery"]];
const nearestIn = (id: string, pool: string[], k: number) =>
  [...pool].sort((x, y) => dist(posOf(id), posOf(x)) - dist(posOf(id), posOf(y))).slice(0, k);
for (let c = 0; c < CHAIN.length - 1; c++) {
  const A = CHAIN[c], B = CHAIN[c + 1];
  A.forEach((aid) => nearestIn(aid, B, 2).forEach((bid) => edge(aid, posOf(aid), bid, posOf(bid))));
  B.forEach((bid) => { const a = nearestIn(bid, A, 1)[0]; edge(a, posOf(a), bid, posOf(bid)); });
}

// Dedupe, then fan-in cap — each target keeps only its 4 shortest incoming edges
// so each column seam reads as a clean hourglass instead of a hairball.
const elen = (e: Edge) => Math.hypot(e.ax - e.bx, e.ay - e.by);
const seenE = new Set<string>();
const byT: Record<string, Edge[]> = {};
RAW.forEach((e) => { const k = e.a + "|" + e.b; if (seenE.has(k)) return; seenE.add(k); (byT[e.b] ||= []).push(e); });
const EDGES: Edge[] = [];
Object.values(byT).forEach((list) => { list.sort((x, y) => elen(x) - elen(y)); EDGES.push(...list.slice(0, 4)); });

// neighbours (for hover lighting)
const NEIGH: Record<string, Set<string>> = {};
EDGES.forEach((e) => {
  (NEIGH[e.a] ||= new Set()).add(e.b);
  (NEIGH[e.b] ||= new Set()).add(e.a);
});

// layer index per activity (times the left→right forward-pass wave)
const STAGE_IDX: Record<string, number> = {};
STAGES.forEach((s, i) => STAGE_IDS[s.cat].forEach((id) => (STAGE_IDX[id] = i)));

// deterministic string hash → 0..99 (pseudo synapse "weight", no Math.random)
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h % 100; };

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
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [{ w, h }, setSize] = useState({ w: 0, h: 0 });
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const upd = () => setReduce(mq.matches); upd();
    mq.addEventListener("change", upd);
    return () => { ro.disconnect(); mq.removeEventListener("change", upd); };
  }, []);

  const hoverCat = hover && ACT[hover] ? ACT[hover].cat : null;
  const hotColor = hoverCat ? CAT_COLOR[hoverCat] : "#eab308";
  const nodeList = STAGES.flatMap((s) => STAGE_IDS[s.cat]);

  const PX = (n: number) => (n / 100) * w;
  const PY = (n: number) => (n / 100) * h;

  // projected, horizontal-tangent bezier synapses (pixel space → no distortion)
  const pxEdges = w
    ? EDGES.map((e, i) => {
        const x1 = PX(e.ax), y1 = PY(e.ay), x2 = PX(e.bx), y2 = PY(e.by);
        const dx = x2 - x1, k = 0.45;
        const jit = ((i * 53) % 7 - 3) * (h / 100) * 0.9;
        const d = `M ${x1} ${y1} C ${x1 + dx * k} ${y1 + jit} ${x2 - dx * k} ${y2 - jit} ${x2} ${y2}`;
        const wgt = 0.35 + 0.65 * (hash(e.a + e.b) / 100);
        return { e, i, x1, y1, x2, y2, d, wgt };
      })
    : [];
  const journeyD = w ? smooth(WAY.map((p) => ({ x: PX(p.x), y: PY(p.y) }))) : "";

  return (
    <div
      ref={ref}
      className="relative min-h-0 flex-1 overflow-hidden"
      style={{
        backgroundColor: "#05070e",
        backgroundImage: [
          "radial-gradient(55% 45% at 50% 4%, rgba(52,211,153,0.07), transparent 70%)",
          "radial-gradient(60% 55% at 92% 100%, rgba(99,102,241,0.09), transparent 70%)",
          "radial-gradient(55% 55% at 8% 100%, rgba(34,211,238,0.06), transparent 70%)",
          "radial-gradient(ellipse 135% 100% at 50% 40%, #0c1630 0%, #080e1f 46%, #05070e 100%)",
        ].join(","),
      }}
    >
      <p className="pointer-events-none absolute left-1/2 top-2 z-30 -translate-x-1/2 text-center font-mono text-[11px] text-[#aab8d8]">
        ⚡ Follow the forward pass from <span style={{ color: "#34d399" }}>Novice</span> to <span style={{ color: "#facc15" }}>AI Mastery</span> — tap any node to open it
      </p>

      {/* category / layer headers */}
      {STAGES.map((s) => (
        <div key={s.cat} className="pointer-events-none absolute z-20 -translate-x-1/2 text-center" style={{ left: `${s.cx}%`, top: "7%" }}>
          <div className="font-mono text-[11px] font-bold tracking-[0.18em]" style={{ color: CAT_COLOR[s.cat], textShadow: `0 0 12px ${CAT_COLOR[s.cat]}66` }}>{s.cat.toUpperCase()}</div>
          <div className="font-mono text-[8.5px] tracking-[0.14em] text-[#8b9cc0]">{CAT_SUB[s.cat]}</div>
          <div className="font-mono text-[7.5px] tracking-[0.18em] text-[#57668c]">{s.tag}</div>
        </div>
      ))}

      {w > 0 && (
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <filter id="nj-soft" x="-250%" y="-250%" width="600%" height="600%"><feGaussianBlur stdDeviation="1.1" /></filter>
            <filter id="nj-comet" x="-400%" y="-400%" width="900%" height="900%"><feGaussianBlur stdDeviation="1.7" /></filter>
            {pxEdges.map(({ e, i, x1, y1, x2, y2 }) => (
              <linearGradient key={i} id={`nj-g${i}`} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
                <stop offset="0" stopColor={e.color} />
                <stop offset="0.5" stopColor={`color-mix(in oklab, ${e.color} 55%, #ffffff)`} />
                <stop offset="1" stopColor={e.tcolor} />
              </linearGradient>
            ))}
          </defs>

          {/* category "layer" bands */}
          {STAGES.map((s) => {
            const bw = PX(BAND_W), hot = hoverCat === s.cat;
            return <rect key={s.cat} x={PX(s.cx) - bw / 2} y={0} width={bw} height={h} rx={bw * 0.16} fill={CAT_COLOR[s.cat]} opacity={hot ? 0.09 : 0.038} style={{ transition: "opacity .2s" }} />;
          })}

          {/* starfield */}
          {BG.map((s, i) => (
            <circle key={`bg${i}`} cx={PX(s.x)} cy={PY(s.y)} r={Math.max(0.5, s.r * (w / 130))} fill="#cdd6f4" className="nj-tw" style={{ animationDelay: `${s.d}s` }} />
          ))}

          {/* synapses — gradient strand + firing pulse */}
          {pxEdges.map(({ e, i, d, wgt }) => {
            const lit = hover != null && (e.a === hover || e.b === hover);
            const dim = hover != null && !lit;
            return (
              <g key={i}>
                <path id={`nj-syn${i}`} d={d} fill="none"
                  stroke={lit ? hotColor : `url(#nj-g${i})`}
                  strokeWidth={lit ? 2 : 0.4 + 1.1 * wgt} strokeLinecap="round"
                  opacity={lit ? 0.95 : dim ? 0.05 : 0.16 + 0.28 * wgt}
                  vectorEffect="non-scaling-stroke" />
                <path d={d} fill="none" stroke={lit ? "#ffffff" : "#b9c6ea"}
                  strokeWidth={lit ? 1.3 : 0.8} strokeLinecap="round" strokeDasharray="1 9"
                  vectorEffect="non-scaling-stroke" className="nj-flow"
                  opacity={lit ? 0.9 : dim ? 0.03 : 0.3} style={{ animationDelay: `${(STAGE_IDX[e.a] ?? 0) * 0.3}s` }} />
              </g>
            );
          })}

          {/* journey ribbon — glow + core + flow */}
          <path d={journeyD} fill="none" stroke="#facc15" strokeWidth={9} strokeLinecap="round" opacity={hover ? 0.08 : 0.15} style={{ filter: "blur(2px)" }} />
          <path id="nj-journey" d={journeyD} fill="none" stroke="#f5c542" strokeWidth={2.2} strokeLinecap="round" opacity={hover ? 0.25 : 0.7} />
          <path d={journeyD} fill="none" stroke="#fff7d6" strokeWidth={2.2} strokeLinecap="round" strokeDasharray="1 10" className="nj-flow" opacity={hover ? 0.25 : 0.85} />

          {/* signal particles — a dot leaves each source as its layer fires */}
          {!reduce && (
            <g opacity={hover ? 0.06 : 0.85}>
              {pxEdges.map(({ i, e }) => (
                <circle key={i} r={1.6} fill="#dbe6ff" filter="url(#nj-soft)">
                  <animateMotion dur={`${1.5 + (i % 5) * 0.14}s`} repeatCount="indefinite" begin={`${(STAGE_IDX[e.a] ?? 0) * 0.5}s`}>
                    <mpath href={`#nj-syn${i}`} />
                  </animateMotion>
                </circle>
              ))}
            </g>
          )}

          {/* gold comet running the hero route */}
          {!reduce && journeyD && (
            <g opacity={hover ? 0.15 : 1}>
              {([[2.4, "#fff7d6", "0s"], [1.7, "#fde68a", "-0.12s"], [1.2, "#f5c542", "-0.24s"], [0.8, "#f59e0b", "-0.36s"]] as [number, string, string][]).map(([r, c, off], k) => (
                <circle key={k} r={r} fill={c} filter="url(#nj-comet)" opacity={k === 0 ? 1 : 0.5 - k * 0.12}>
                  <animateMotion dur="6.5s" repeatCount="indefinite" calcMode="spline" keyTimes="0;1" keySplines=".45 0 .55 1" begin={off}>
                    <mpath href="#nj-journey" />
                  </animateMotion>
                </circle>
              ))}
            </g>
          )}
        </svg>
      )}

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
        const showLabel = a.core || isHot || lit;
        const sz = a.core ? 38 : 27;
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
            style={{ left: `${p.x}%`, top: `${p.y}%`, transform: `translate(-50%,-50%) scale(${isHot ? 1.3 : 1})`, zIndex: isHot ? 45 : 12, opacity: dim ? 0.42 : 1 }}
          >
            <span
              className="nj-node grid place-items-center rounded-full"
              style={{
                width: sz, height: sz,
                background: `radial-gradient(circle at 50% 28%, ${color}3a 0%, ${color}12 45%, #0a1120 82%)`,
                border: `1.5px solid ${color}`,
                boxShadow: `0 0 ${isHot ? 24 : lit ? 14 : 7}px ${isHot ? color : color + "aa"}, inset 0 1px 3px ${color}66, inset 0 0 10px ${color}22`,
                color: isHot || lit ? "#ffffff" : color,
                animationDelay: `${(STAGE_IDX[id] ?? 0) * 0.3 + (i % 3) * 0.12}s`,
              }}
            >
              {ICON[id] ? (
                <svg
                  viewBox="0 0 24 24" width={sz > 34 ? 21 : 15} height={sz > 34 ? 21 : 15}
                  fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                  style={{ filter: `drop-shadow(0 0 2.5px ${color})` }}
                  dangerouslySetInnerHTML={{ __html: ICON[id] }}
                />
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" style={{ color, filter: `drop-shadow(0 0 3px ${color})` }}>
                  <path d="M12 1.4c.5 5.7 4.4 9.6 10.1 10.1-5.7.5-9.6 4.4-10.1 10.1-.5-5.7-4.4-9.6-10.1-10.1 5.7-.5 9.6-4.4 10.1-10.1z" fill="currentColor" />
                </svg>
              )}
            </span>
            <span
              className="mt-1 max-w-[94px] rounded text-center font-mono text-[9px] leading-tight transition-opacity duration-200"
              style={{ color: isHot || lit ? color : "#aab8d8", opacity: showLabel ? 1 : 0, padding: "1px 5px", background: "#0a1220cc", textShadow: "0 1px 3px #000" }}
            >
              {a.name}
            </span>
            {isHot && (
              <span
                className="pointer-events-none absolute left-1/2 z-50 w-[168px] -translate-x-1/2 rounded-lg border px-2.5 py-1.5 text-center font-mono"
                style={{ borderColor: `${color}66`, background: "#0b1018f2", color: "#cdd8f0", [above ? "bottom" : "top"]: "100%", [above ? "marginBottom" : "marginTop"]: 10 } as React.CSSProperties}
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
      <div className="pointer-events-none absolute bottom-2.5 left-1/2 z-20 flex max-w-full -translate-x-1/2 flex-wrap items-center justify-center gap-x-3.5 gap-y-1 px-3 font-mono text-[9px] text-[#8b9cc0]">
        {(Object.keys(CAT_COLOR) as Cat[]).map((c) => (
          <span key={c} className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: CAT_COLOR[c], boxShadow: `0 0 5px ${CAT_COLOR[c]}` }} />
            {c} ({STAGE_IDS[c].length})
          </span>
        ))}
      </div>

      <style>{`
        @keyframes njTw { 0%,100%{ opacity:.14 } 50%{ opacity:.55 } }
        .nj-tw { animation: njTw 3.2s ease-in-out infinite; }
        @keyframes njFlow { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -11; } }
        .nj-flow { animation: njFlow 1.6s linear infinite; }
        @keyframes njBreathe { 0%,100%{ transform: scale(1); } 50%{ transform: scale(1.04); } }
        .nj-node { animation: njBreathe 4.5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .nj-flow, .nj-node, .nj-tw { animation: none !important; } }
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
