"use client";

import { useEffect, useRef, useState } from "react";
import * as Blockly from "blockly";
import { javascriptGenerator } from "blockly/javascript";
import { registerScratchBlocks, getScratchTheme, SCRATCH_TOOLBOX } from "@/lib/scratchBlocks";
import { playSound, SOUND_NAMES } from "@/lib/scratchSound";

type Sprite = { id: string; name: string; costumes: string[] };

const COSTUME_EMOJIS = ["😀", "😎", "😺", "🤖", "👾", "🚀", "🛸", "⭐", "🌟", "🔥", "💧", "🍎", "⚽", "🎈", "🌈", "🦄", "🐶", "🐱", "🐸", "🦋", "🎃", "👻", "💀", "🐢"];
const BACKDROPS: { name: string; css: string }[] = [
  { name: "White", css: "#ffffff" },
  { name: "Sky", css: "linear-gradient(180deg,#bfe3ff,#eaf6ff)" },
  { name: "Sunset", css: "linear-gradient(180deg,#ffd194,#ff9a9e)" },
  { name: "Grass", css: "linear-gradient(180deg,#bdf0c0,#7ddf86)" },
  { name: "Space", css: "radial-gradient(120% 120% at 50% 0%,#1b2447,#070d1a)" },
  { name: "Candy", css: "linear-gradient(180deg,#fbc2eb,#a6c1ee)" },
];
type Runtime = {
  x: number; y: number; dir: number; size: number; visible: boolean;
  costumeIndex: number; bubble: string | null; bubbleType: "say" | "think";
};
type Compiled = { flag: string[]; keys: Map<string, string[]>; defs: string };

const STOP = {} as const;

const LIBRARY: Sprite[] = [
  { id: "", name: "Rocket", costumes: ["🚀", "🛸"] },
  { id: "", name: "Cat", costumes: ["🐱", "😺", "😸"] },
  { id: "", name: "Robot", costumes: ["🤖", "👾"] },
  { id: "", name: "Dog", costumes: ["🐶", "🐕"] },
  { id: "", name: "Star", costumes: ["⭐", "🌟", "✨"] },
  { id: "", name: "Ball", costumes: ["⚽", "🏀", "🎾"] },
  { id: "", name: "Ghost", costumes: ["👻", "💀"] },
  { id: "", name: "Unicorn", costumes: ["🦄", "🐴"] },
  { id: "", name: "Bird", costumes: ["🐦", "🐤"] },
  { id: "", name: "Fish", costumes: ["🐠", "🐟"] },
  { id: "", name: "Bug", costumes: ["🐞", "🐛"] },
  { id: "", name: "Alien", costumes: ["👽", "🛸"] },
];

const num = (n: number) => ({ shadow: { type: "math_number", fields: { NUM: n } } });
function chain(specs: { type: string; fields?: object; inputs?: object }[]): Record<string, unknown> | null {
  let head: Record<string, unknown> | null = null;
  for (let i = specs.length - 1; i >= 0; i--) {
    const s = specs[i];
    const b: Record<string, unknown> = { type: s.type };
    if (s.fields) b.fields = s.fields;
    if (s.inputs) b.inputs = s.inputs;
    if (head) b.next = { block: head };
    head = b;
  }
  return head;
}

const DEFAULT_SPRITE: Sprite = { id: "sp0", name: "Rocket", costumes: ["🚀", "🛸"] };

const freshRuntime = (): Runtime => ({
  x: 0, y: 0, dir: 90, size: 100, visible: true, costumeIndex: 0, bubble: null, bubbleType: "say",
});

// A costume/backdrop that is a "data:" URL is an uploaded image; otherwise an emoji.
const isImg = (c: string) => c.startsWith("data:");
const imgCache = new Map<string, HTMLImageElement>();
function getImg(src: string): HTMLImageElement | null {
  let img = imgCache.get(src);
  if (!img) { img = new Image(); img.src = src; imgCache.set(src, img); }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/* ── Classwise missions (problem-solving per class 1–10) ─────────────────── */
const txtv = (t: string) => ({ shadow: { type: "text", fields: { TEXT: t } } });
const SCORE_ID = "scoreVar1";

type Mission = { g: number; emoji: string; title: string; goal: string; hint: string; needs: string[]; difficulty: number; check: (t: Set<string>) => boolean };
const MISSIONS: Mission[] = [
  { g: 1, emoji: "💬", title: "Say Hello", goal: "When the green flag is clicked, make your sprite greet the world: “Hi, I’m a coder!”", hint: "Snap a purple Looks “say” block under the green-flag block.", needs: ["Events", "Looks"], difficulty: 1, check: (t) => t.has("looks_say") || t.has("looks_sayfor") || t.has("looks_think") },
  { g: 2, emoji: "🏎️", title: "Zoom Across", goal: "Make your sprite glide smoothly across the stage — and back again.", hint: "Use Motion “glide … to x …” blocks (try two, to send it back).", needs: ["Events", "Motion"], difficulty: 1, check: (t) => t.has("motion_glide") || t.has("motion_move") || t.has("motion_goto") },
  { g: 3, emoji: "🏀", title: "Bouncing Ball", goal: "Keep your sprite moving forever and bouncing off every edge.", hint: "Put “move” + “if on edge, bounce” inside a forever loop.", needs: ["Control", "Motion"], difficulty: 2, check: (t) => t.has("control_forever") && t.has("motion_bounce") },
  { g: 4, emoji: "🕺", title: "Dance Party", goal: "Make your sprite dance — switching costumes and grooving across the stage in a loop.", hint: "forever → next costume → move a little → turn → wait.", needs: ["Looks", "Control"], difficulty: 2, check: (t) => t.has("control_forever") && (t.has("looks_nextcostume") || t.has("looks_switchcostume")) },
  { g: 5, emoji: "🎮", title: "Drive It!", goal: "Steer your sprite all around the stage using the arrow keys.", hint: "One “when → key pressed → change x/y” for each arrow.", needs: ["Events", "Motion"], difficulty: 3, check: (t) => t.has("event_whenkey") && (t.has("motion_changex") || t.has("motion_changey") || t.has("motion_move")) },
  { g: 6, emoji: "🔊", title: "Sound Blaster", goal: "Press space to fire a sound and blast your sprite off in a random direction.", hint: "Drop a “random” block into the turn and move blocks.", needs: ["Sound", "Operators", "Events"], difficulty: 3, check: (t) => (t.has("sound_play") || t.has("sound_playuntil")) && t.has("event_whenkey") },
  { g: 7, emoji: "🌀", title: "Spinner Art", goal: "Use random angles in a loop to make your sprite trace wild, hypnotic patterns.", hint: "forever → move → turn by “random 10 to 40” → tiny wait.", needs: ["Operators", "Motion", "Control"], difficulty: 4, check: (t) => t.has("control_forever") && (t.has("motion_turnright") || t.has("motion_turnleft")) && t.has("math_random_int") },
  { g: 8, emoji: "🏆", title: "Score Counter", goal: "Make a “score” variable and add a point every time space is pressed.", hint: "Variables → Make a Variable → change score by 1 → say score.", needs: ["Variables", "Events"], difficulty: 4, check: (t) => t.has("math_change") || t.has("variables_set") },
  { g: 9, emoji: "👾", title: "Catch Game", goal: "Build a real mini-game: drive a hero with arrows, score with space, and play a sound on every catch.", hint: "Combine key events, motion, a score variable and sound.", needs: ["Events", "Variables", "Sound"], difficulty: 5, check: (t) => t.has("event_whenkey") && (t.has("math_change") || t.has("variables_set")) && (t.has("sound_play") || t.has("sound_playuntil")) },
  { g: 10, emoji: "🚀", title: "Your Own Game", goal: "Design your own game from scratch — sprites, controls, scoring and sound. Make it yours!", hint: "No rules. Add sprites, mix every block, and invent something fun.", needs: ["Everything"], difficulty: 5, check: (t) => t.size >= 4 },
];
const missionFor = (g: number) => MISSIONS.find((m) => m.g === g) ?? MISSIONS[0];

type Level = "easy" | "medium" | "hard";
const levelOf = (m: Mission): Level => (m.difficulty <= 2 ? "easy" : m.difficulty === 3 ? "medium" : "hard");
const LEVEL_META: Record<Level, { label: string; color: string }> = {
  easy: { label: "Easy", color: "#34d399" },
  medium: { label: "Medium", color: "#f59e0b" },
  hard: { label: "Hard", color: "#ec4899" },
};
const FILTERS: { id: "all" | Level; label: string }[] = [
  { id: "all", label: "All" },
  { id: "easy", label: "🟢 Easy" },
  { id: "medium", label: "🟡 Medium" },
  { id: "hard", label: "🔴 Hard" },
];

const NEED_COLOR: Record<string, string> = {
  Events: "#f59e0b", Motion: "#22d3ee", Looks: "#a855f7", Sound: "#ec4899",
  Control: "#34d399", Operators: "#2dd4bf", Variables: "#fb923c", Everything: "#9fb0d0",
};

function exampleFor(g: number): object {
  const wf = (next?: object | null) => ({ type: "event_whenflag", x: 30, y: 30, ...(next ? { next: { block: next } } : {}) });
  switch (g) {
    case 1:
      return { blocks: { languageVersion: 0, blocks: [wf({ type: "looks_sayfor", inputs: { TEXT: txtv("Hi, I can code!"), SECS: num(3) } })] } };
    case 2:
      return { blocks: { languageVersion: 0, blocks: [wf(chain([
        { type: "motion_goto", inputs: { X: num(-150), Y: num(0) } },
        { type: "motion_glide", inputs: { SECS: num(1.5), X: num(150), Y: num(0) } },
        { type: "motion_glide", inputs: { SECS: num(1.5), X: num(-150), Y: num(0) } },
      ])) ] } };
    case 3:
      return { blocks: { languageVersion: 0, blocks: [wf({ type: "control_forever", inputs: { DO: { block: chain([{ type: "motion_move", inputs: { STEPS: num(6) } }, { type: "motion_bounce" }]) } } })] } };
    case 4:
      return { blocks: { languageVersion: 0, blocks: [wf({ type: "control_forever", inputs: { DO: { block: chain([
        { type: "looks_nextcostume" },
        { type: "motion_move", inputs: { STEPS: num(12) } },
        { type: "motion_turnright", inputs: { DEG: num(15) } },
        { type: "control_wait", inputs: { SECS: num(0.15) } },
      ]) } } })] } };
    case 5:
      return { blocks: { languageVersion: 0, blocks: [
        { type: "event_whenkey", x: 30, y: 30, fields: { KEY: "right" }, next: { block: { type: "motion_changex", inputs: { DX: num(10) } } } },
        { type: "event_whenkey", x: 30, y: 150, fields: { KEY: "left" }, next: { block: { type: "motion_changex", inputs: { DX: num(-10) } } } },
        { type: "event_whenkey", x: 260, y: 30, fields: { KEY: "up" }, next: { block: { type: "motion_changey", inputs: { DY: num(10) } } } },
        { type: "event_whenkey", x: 260, y: 150, fields: { KEY: "down" }, next: { block: { type: "motion_changey", inputs: { DY: num(-10) } } } },
      ] } };
    case 6:
      return { blocks: { languageVersion: 0, blocks: [
        { type: "event_whenkey", x: 30, y: 30, fields: { KEY: "space" }, next: { block: { type: "sound_play", fields: { SOUND: "laser" }, next: { block: { type: "motion_turnright", inputs: { DEG: { block: { type: "math_random_int", inputs: { FROM: num(0), TO: num(360) } } } }, next: { block: { type: "motion_move", inputs: { STEPS: { block: { type: "math_random_int", inputs: { FROM: num(30), TO: num(120) } } } } } } } } } } },
      ] } };
    case 7:
      return { blocks: { languageVersion: 0, blocks: [wf({ type: "control_forever", inputs: { DO: { block: chain([
        { type: "motion_move", inputs: { STEPS: num(18) } },
        { type: "motion_turnright", inputs: { DEG: { block: { type: "math_random_int", inputs: { FROM: num(10), TO: num(40) } } } } },
        { type: "motion_bounce" },
        { type: "control_wait", inputs: { SECS: num(0.04) } },
      ]) } } })] } };
    case 8:
      return { variables: [{ name: "score", id: SCORE_ID }], blocks: { languageVersion: 0, blocks: [
        { type: "event_whenflag", x: 30, y: 30, next: { block: { type: "variables_set", fields: { VAR: { id: SCORE_ID } }, inputs: { VALUE: num(0) } } } },
        { type: "event_whenkey", x: 30, y: 170, fields: { KEY: "space" }, next: { block: { type: "math_change", fields: { VAR: { id: SCORE_ID } }, inputs: { DELTA: num(1) }, next: { block: { type: "looks_say", inputs: { TEXT: { block: { type: "variables_get", fields: { VAR: { id: SCORE_ID } } } } } } } } } },
      ] } };
    case 9:
      return { variables: [{ name: "score", id: SCORE_ID }], blocks: { languageVersion: 0, blocks: [
        { type: "event_whenflag", x: 30, y: 30, next: { block: { type: "variables_set", fields: { VAR: { id: SCORE_ID } }, inputs: { VALUE: num(0) } } } },
        { type: "event_whenkey", x: 30, y: 160, fields: { KEY: "right" }, next: { block: { type: "motion_changex", inputs: { DX: num(12) } } } },
        { type: "event_whenkey", x: 260, y: 160, fields: { KEY: "left" }, next: { block: { type: "motion_changex", inputs: { DX: num(-12) } } } },
        { type: "event_whenkey", x: 30, y: 280, fields: { KEY: "space" }, next: { block: { type: "math_change", fields: { VAR: { id: SCORE_ID } }, inputs: { DELTA: num(1) }, next: { block: { type: "sound_play", fields: { SOUND: "chime" }, next: { block: { type: "looks_say", inputs: { TEXT: { block: { type: "variables_get", fields: { VAR: { id: SCORE_ID } } } } } } } } } } } },
      ] } };
    default:
      return { blocks: { languageVersion: 0, blocks: [wf({ type: "looks_sayfor", inputs: { TEXT: txtv("Let's build a game!"), SECS: num(3) } })] } };
  }
}

function normKey(e: KeyboardEvent): string | null {
  const k = e.key;
  if (k === " ") return "space";
  if (k === "ArrowUp") return "up";
  if (k === "ArrowDown") return "down";
  if (k === "ArrowLeft") return "left";
  if (k === "ArrowRight") return "right";
  if (/^[a-zA-Z]$/.test(k)) return k.toLowerCase();
  return null;
}

export function ScratchStudio() {
  const blocklyDiv = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const spriteFileRef = useRef<HTMLInputElement>(null);
  const backdropFileRef = useRef<HTMLInputElement>(null);
  // Sensing state: live mouse position (stage coords), held keys, timer origin.
  const mouseRef = useRef({ x: 0, y: 0, down: false });
  const keysRef = useRef<Set<string>>(new Set());
  const timerStartRef = useRef(0);
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const runtimeRef = useRef<Map<string, Runtime>>(new Map());
  const scriptsRef = useRef<Map<string, object>>(new Map());
  const compiledRef = useRef<Map<string, Compiled>>(new Map());
  const spritesRef = useRef<Sprite[]>([]);
  const selectedIdRef = useRef("sp0");
  const stopRef = useRef(false);
  const sessionRef = useRef(false);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const xRef = useRef<HTMLSpanElement>(null);
  const yRef = useRef<HTMLSpanElement>(null);
  const sizeRef = useRef<HTMLSpanElement>(null);
  const dirRef = useRef<HTMLSpanElement>(null);
  const rafRender = useRef(0);
  const idSeq = useRef(1);
  const gradeRef = useRef(1);
  const firstGrade = useRef(true);
  const freePlayRef = useRef(false);

  const [sprites, setSprites] = useState<Sprite[]>([DEFAULT_SPRITE]);
  const [selectedId, setSelectedId] = useState("sp0");
  const [grade, setGrade] = useState(1);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [celebrate, setCelebrate] = useState<number | null>(null);
  const [goalMet, setGoalMet] = useState(false);
  const [filter, setFilter] = useState<"all" | "easy" | "medium" | "hard">("all");
  const [freePlay, setFreePlay] = useState(false);
  const [running, setRunning] = useState(false);
  const [picker, setPicker] = useState(false);
  const [tab, setTab] = useState<"code" | "costumes" | "sounds">("code");
  const [costumePicker, setCostumePicker] = useState(false);
  const [backdrop, setBackdrop] = useState("#ffffff");
  const [spriteMenu, setSpriteMenu] = useState(false);
  const [backdropMenu, setBackdropMenu] = useState(false);
  const [, setTick] = useState(0);

  spritesRef.current = sprites;
  selectedIdRef.current = selectedId;
  gradeRef.current = grade;
  freePlayRef.current = freePlay;

  // ── Mount: runtime + Blockly + render loop + key listener ────────────────
  useEffect(() => {
    registerScratchBlocks();
    runtimeRef.current.set("sp0", freshRuntime());
    // Open empty, like a fresh Scratch project.
    const initial = { blocks: { languageVersion: 0, blocks: [] } };
    scriptsRef.current.set("sp0", initial);

    if (!blocklyDiv.current) return;
    const ws = Blockly.inject(blocklyDiv.current, {
      toolbox: SCRATCH_TOOLBOX as unknown as Blockly.utils.toolbox.ToolboxDefinition,
      theme: getScratchTheme(),
      renderer: "zelos",
      grid: { spacing: 28, length: 2, colour: "#16223c", snap: true },
      zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 2.5, minScale: 0.35, pinch: true },
      move: { scrollbars: true, drag: true, wheel: true },
      trashcan: true,
    });
    wsRef.current = ws;
    try { Blockly.serialization.workspaces.load(initial, ws); } catch { /* ignore */ }

    // Scratch-style: click any block (or stack) to run it instantly on the selected sprite.
    ws.addChangeListener((e) => {
      if (e.type !== Blockly.Events.CLICK) return;
      const ev = e as Blockly.Events.Click;
      if (ev.targetType !== "block" || !ev.blockId) return;
      const blk = ws.getBlockById(ev.blockId);
      if (!blk) return;
      const root = blk.getRootBlock();
      javascriptGenerator.init(ws);
      let code = javascriptGenerator.blockToCode(root);
      code = (Array.isArray(code) ? code[0] : code) as string;
      const defs = javascriptGenerator.finish("");
      if (!code || !code.trim()) return;
      stopRef.current = false;
      sessionRef.current = true;
      runStack(selectedIdRef.current, code, defs);
    });

    // Live goal detection — lights up the moment the activity's blocks are present.
    ws.addChangeListener((e) => {
      if (e.isUiEvent) return;
      const types = new Set(ws.getAllBlocks(false).map((b) => b.type));
      setGoalMet(missionFor(gradeRef.current).check(types));
    });
    setGoalMet(missionFor(gradeRef.current).check(new Set(ws.getAllBlocks(false).map((b) => b.type))));

    const ro = new ResizeObserver(() => Blockly.svgResize(ws));
    ro.observe(blocklyDiv.current);
    const t = window.setTimeout(() => Blockly.svgResize(ws), 200);

    const draw = () => {
      const canvas = canvasRef.current;
      if (canvas) drawStage(canvas);
      rafRender.current = requestAnimationFrame(draw);
    };
    rafRender.current = requestAnimationFrame(draw);

    const onKey = (e: KeyboardEvent) => {
      if (!sessionRef.current) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (document.querySelector(".blocklyHtmlInput")) return;
      const key = normKey(e);
      if (!key) return;
      let handled = false;
      for (const sp of spritesRef.current) {
        const c = compiledRef.current.get(sp.id);
        const stacks = c?.keys.get(key);
        if (stacks && stacks.length) {
          handled = true;
          for (const code of stacks) runStack(sp.id, code, c!.defs);
        }
      }
      if (handled) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    // Track held keys for Sensing's "key … pressed?".
    const onKeyDownTrack = (e: KeyboardEvent) => { const k = normKey(e); if (k) keysRef.current.add(k); };
    const onKeyUpTrack = (e: KeyboardEvent) => { const k = normKey(e); if (k) keysRef.current.delete(k); };
    window.addEventListener("keydown", onKeyDownTrack);
    window.addEventListener("keyup", onKeyUpTrack);

    return () => {
      window.clearTimeout(t);
      ro.disconnect();
      cancelAnimationFrame(rafRender.current);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keydown", onKeyDownTrack);
      window.removeEventListener("keyup", onKeyUpTrack);
      ws.dispose();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Activity change: load that activity's scaffold into the selected sprite.
  // (The full block palette is always available — no gating by level.)
  // Restore saved activity completion.
  useEffect(() => {
    try {
      const a = JSON.parse(localStorage.getItem("cl-scratch-done") || "[]");
      if (Array.isArray(a)) setCompleted(new Set(a as number[]));
    } catch { /* ignore */ }
  }, []);

  function markComplete(advance = true) {
    const already = completed.has(grade);
    setCompleted((prev) => {
      const next = new Set(prev);
      next.add(grade);
      try { localStorage.setItem("cl-scratch-done", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
    if (!already) {
      playSound("chime");
      setCelebrate(grade);
      window.setTimeout(() => setCelebrate(null), 1600);
    }
    if (advance && grade < 10) window.setTimeout(() => setGrade((g) => Math.min(10, g + 1)), 850);
  }

  function loadExample() {
    const ws = wsRef.current;
    if (!ws) return;
    const ex = exampleFor(grade);
    ws.clear();
    try { Blockly.serialization.workspaces.load(ex, ws); } catch { /* ignore */ }
    scriptsRef.current.set(selectedIdRef.current, ex);
    ws.scrollCenter();
  }

  // Re-fit the Blockly workspace when the Code tab becomes visible again.
  useEffect(() => {
    if (tab === "code" && wsRef.current) {
      const id = window.setTimeout(() => { if (wsRef.current) Blockly.svgResize(wsRef.current); }, 30);
      return () => window.clearTimeout(id);
    }
  }, [tab]);

  function addCostume(emoji: string) {
    setSprites((s) => s.map((sp) => (sp.id === selectedIdRef.current ? { ...sp, costumes: [...sp.costumes, emoji] } : sp)));
    setCostumePicker(false);
  }
  function removeCostume(i: number) {
    setSprites((s) => s.map((sp) => {
      if (sp.id !== selectedIdRef.current || sp.costumes.length <= 1) return sp;
      const costumes = sp.costumes.filter((_, j) => j !== i);
      const rt = runtimeRef.current.get(sp.id);
      if (rt && rt.costumeIndex >= costumes.length) rt.costumeIndex = costumes.length - 1;
      return { ...sp, costumes };
    }));
    setTick((t) => t + 1);
  }

  function drawStage(canvas: HTMLCanvasElement) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = canvas.clientWidth || 480;
    const ch = canvas.clientHeight || 360;
    if (canvas.width !== Math.round(cw * dpr)) {
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cw, ch);
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= cw; gx += 30) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, ch); ctx.stroke(); }
    for (let gy = 0; gy <= ch; gy += 30) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(cw, gy); ctx.stroke(); }

    const sc = Math.min(cw / 480, ch / 360);
    for (const sp of spritesRef.current) {
      const rt = runtimeRef.current.get(sp.id);
      if (!rt || !rt.visible) continue;
      const cx = cw / 2 + rt.x * sc;
      const cy = ch / 2 - rt.y * sc;
      const fs = 40 * (rt.size / 100) * sc;
      const costume = sp.costumes[((rt.costumeIndex % sp.costumes.length) + sp.costumes.length) % sp.costumes.length];
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(((rt.dir - 90) * Math.PI) / 180);
      if (isImg(costume)) {
        const img = getImg(costume);
        if (img) {
          const s = (fs * 1.8) / Math.max(img.naturalWidth, img.naturalHeight);
          ctx.drawImage(img, (-img.naturalWidth * s) / 2, (-img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
        }
      } else {
        ctx.font = `${Math.max(8, fs)}px "Apple Color Emoji","Segoe UI Emoji",serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(costume, 0, 0);
      }
      ctx.restore();
      if (sp.id === selectedIdRef.current) {
        ctx.strokeStyle = "rgba(76,151,255,0.7)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(10, fs * 0.7), 0, 7);
        ctx.stroke();
      }
      if (rt.bubble) drawBubble(ctx, cx + fs * 0.45, cy - fs * 0.5, rt.bubble, rt.bubbleType);
    }
    ctx.restore();

    // Live sprite-info readout (Scratch-style x / y / size / direction).
    const sr = runtimeRef.current.get(selectedIdRef.current);
    if (sr) {
      if (xRef.current) xRef.current.textContent = String(Math.round(sr.x));
      if (yRef.current) yRef.current.textContent = String(Math.round(sr.y));
      if (sizeRef.current) sizeRef.current.textContent = String(Math.round(sr.size));
      if (dirRef.current) dirRef.current.textContent = String(Math.round(sr.dir));
    }
  }

  function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, type: "say" | "think") {
    ctx.font = '13px "Fredoka", system-ui, sans-serif';
    const t = text.length > 40 ? text.slice(0, 39) + "…" : text;
    const w = Math.min(180, ctx.measureText(t).width + 18);
    const h = 26;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.strokeStyle = "rgba(120,128,150,0.65)";
    ctx.lineWidth = 1.5;
    const rx = x, ry = y - h;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(rx, ry, w, h, 10);
    else ctx.rect(rx, ry, w, h);
    ctx.fill();
    ctx.stroke();
    if (type === "think") {
      ctx.beginPath(); ctx.arc(rx + 6, ry + h + 6, 3, 0, 7); ctx.fill(); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(rx + 6, ry + h); ctx.lineTo(rx + 2, ry + h + 8); ctx.lineTo(rx + 16, ry + h); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = "#0b1020";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(t, rx + 9, ry + h / 2);
    ctx.restore();
  }

  function makeApi(id: string) {
    const rt = runtimeRef.current.get(id)!;
    const sp = spritesRef.current.find((s) => s.id === id);
    const ncos = sp ? sp.costumes.length : 1;
    const sleep = (secs: number) =>
      new Promise<void>((res, rej) => {
        const end = performance.now() + Math.max(0, secs) * 1000;
        const tick = () => {
          if (stopRef.current) return rej(STOP);
          if (performance.now() >= end) return res();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    const norm = (d: number) => ((d % 360) + 360) % 360;
    return {
      move: (n: number) => { const r = (rt.dir * Math.PI) / 180; rt.x += Math.sin(r) * n; rt.y += Math.cos(r) * n; },
      turnRight: (d: number) => { rt.dir = norm(rt.dir + d); },
      turnLeft: (d: number) => { rt.dir = norm(rt.dir - d); },
      point: (d: number) => { rt.dir = norm(d); },
      goto: (x: number, y: number) => { rt.x = x; rt.y = y; },
      changeX: (d: number) => { rt.x += d; },
      changeY: (d: number) => { rt.y += d; },
      setX: (n: number) => { rt.x = n; },
      setY: (n: number) => { rt.y = n; },
      bounce: () => {
        let b = false;
        if (rt.x > 240) { rt.x = 240; rt.dir = -rt.dir; b = true; } else if (rt.x < -240) { rt.x = -240; rt.dir = -rt.dir; b = true; }
        if (rt.y > 180) { rt.y = 180; rt.dir = 180 - rt.dir; b = true; } else if (rt.y < -180) { rt.y = -180; rt.dir = 180 - rt.dir; b = true; }
        if (b) rt.dir = norm(rt.dir);
      },
      glide: (secs: number, tx: number, ty: number) =>
        new Promise<void>((res, rej) => {
          const sx = rt.x, sy = rt.y, start = performance.now(), dur = Math.max(1, secs * 1000);
          const tick = () => {
            if (stopRef.current) return rej(STOP);
            const p = Math.min(1, (performance.now() - start) / dur);
            rt.x = sx + (tx - sx) * p; rt.y = sy + (ty - sy) * p;
            if (p >= 1) return res();
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
      say: (t: unknown) => { rt.bubble = t === "" || t == null ? null : String(t); rt.bubbleType = "say"; },
      think: (t: unknown) => { rt.bubble = t === "" || t == null ? null : String(t); rt.bubbleType = "think"; },
      sayFor: async (t: unknown, secs: number) => { rt.bubble = String(t); rt.bubbleType = "say"; await sleep(secs); rt.bubble = null; },
      nextCostume: () => { rt.costumeIndex = (rt.costumeIndex + 1) % ncos; },
      setCostume: (n: number) => { rt.costumeIndex = (((Math.round(n) - 1) % ncos) + ncos) % ncos; },
      changeSize: (d: number) => { rt.size = Math.max(10, Math.min(500, rt.size + d)); },
      setSize: (n: number) => { rt.size = Math.max(10, Math.min(500, n)); },
      show: () => { rt.visible = true; },
      hide: () => { rt.visible = false; },
      play: (name: string) => { playSound(name); },
      playUntil: async (name: string) => { const d = playSound(name); await sleep(d); },
      wait: (secs: number) => sleep(secs),
      // Motion: random-position / mouse-pointer targets (Sensing-powered)
      gotoTarget: (t: string) => {
        rt.x = t === "mouse" ? mouseRef.current.x : Math.round(Math.random() * 480 - 240);
        rt.y = t === "mouse" ? mouseRef.current.y : Math.round(Math.random() * 360 - 180);
      },
      glideTarget: (secs: number, t: string) => {
        const tx = t === "mouse" ? mouseRef.current.x : Math.round(Math.random() * 480 - 240);
        const ty = t === "mouse" ? mouseRef.current.y : Math.round(Math.random() * 360 - 180);
        return new Promise<void>((res, rej) => {
          const sx = rt.x, sy = rt.y, start = performance.now(), dur = Math.max(1, secs * 1000);
          const tick = () => {
            if (stopRef.current) return rej(STOP);
            const p = Math.min(1, (performance.now() - start) / dur);
            rt.x = sx + (tx - sx) * p; rt.y = sy + (ty - sy) * p;
            if (p >= 1) return res();
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
      },
      pointToward: (t: string) => {
        const tx = t === "mouse" ? mouseRef.current.x : 0;
        const ty = t === "mouse" ? mouseRef.current.y : 0;
        rt.dir = norm(90 - (Math.atan2(ty - rt.y, tx - rt.x) * 180) / Math.PI);
      },
      // Sensing reporters
      mouseX: () => Math.round(mouseRef.current.x),
      mouseY: () => Math.round(mouseRef.current.y),
      mouseDown: () => mouseRef.current.down,
      keyDown: (k: string) => keysRef.current.has(k),
      timer: () => Math.round((performance.now() - timerStartRef.current) / 100) / 10,
      resetTimer: () => { timerStartRef.current = performance.now(); },
    };
  }

  // Compile a sprite's blocks into runnable code per hat (green flag + keys).
  function compileSprite(id: string): Compiled {
    const out: Compiled = { flag: [], keys: new Map(), defs: "" };
    const json = scriptsRef.current.get(id);
    if (!json) return out;
    const tmp = new Blockly.Workspace();
    try {
      Blockly.serialization.workspaces.load(json, tmp);
      javascriptGenerator.init(tmp);
      for (const top of tmp.getTopBlocks(true)) {
        const raw = javascriptGenerator.blockToCode(top);
        const code = (Array.isArray(raw) ? raw[0] : raw) as string;
        if (!code || !code.trim()) continue;
        if (top.type === "event_whenkey") {
          const k = top.getFieldValue("KEY");
          if (!out.keys.has(k)) out.keys.set(k, []);
          out.keys.get(k)!.push(code);
        } else {
          out.flag.push(code);
        }
      }
      out.defs = javascriptGenerator.finish("");
    } catch {
      /* ignore */
    }
    tmp.dispose();
    return out;
  }

  async function runStack(id: string, code: string, defs: string) {
    const api = makeApi(id);
    const yield_ = () => new Promise<void>((res, rej) => requestAnimationFrame(() => (stopRef.current ? rej(STOP) : res())));
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
      const fn = new Function("s", "__yield", `return (async()=>{\n${defs}\n${code}\n})();`);
      await fn(api, yield_);
    } catch (e) {
      if (e !== STOP) console.warn("[ScratchStudio] error", e);
    }
  }

  function syncSelectedScript() {
    const ws = wsRef.current;
    if (ws) scriptsRef.current.set(selectedIdRef.current, Blockly.serialization.workspaces.save(ws));
  }

  function greenFlag() {
    if (running) return;
    syncSelectedScript();
    stopRef.current = false;
    sessionRef.current = true;
    timerStartRef.current = performance.now();
    compiledRef.current.clear();
    for (const sp of spritesRef.current) compiledRef.current.set(sp.id, compileSprite(sp.id));
    for (const rt of runtimeRef.current.values()) rt.bubble = null;
    setRunning(true);
    for (const sp of spritesRef.current) {
      const c = compiledRef.current.get(sp.id);
      if (c) for (const code of c.flag) runStack(sp.id, code, c.defs);
    }
  }

  function stopAll() {
    stopRef.current = true;
    sessionRef.current = false;
    for (const rt of runtimeRef.current.values()) rt.bubble = null;
    setRunning(false);
  }

  // ── Dragging sprites on the stage ───────────────────────────────────────
  function pointerToStage(e: React.PointerEvent) {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    const sc = Math.min(r.width / 480, r.height / 360);
    return { x: (e.clientX - r.left - r.width / 2) / sc, y: (r.height / 2 - (e.clientY - r.top)) / sc };
  }
  function onCanvasDown(e: React.PointerEvent) {
    const p = pointerToStage(e);
    mouseRef.current.x = p.x; mouseRef.current.y = p.y; mouseRef.current.down = true;
    for (let i = spritesRef.current.length - 1; i >= 0; i--) {
      const sp = spritesRef.current[i];
      const rt = runtimeRef.current.get(sp.id);
      if (!rt || !rt.visible) continue;
      const radius = 40 * (rt.size / 100) * 0.7;
      if (Math.hypot(p.x - rt.x, p.y - rt.y) <= radius) {
        dragRef.current = { id: sp.id, dx: rt.x - p.x, dy: rt.y - p.y };
        if (sp.id !== selectedIdRef.current) selectSprite(sp.id);
        try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        return;
      }
    }
  }
  function onCanvasMove(e: React.PointerEvent) {
    const m = pointerToStage(e);
    mouseRef.current.x = m.x; mouseRef.current.y = m.y;
    if (!dragRef.current) return;
    const p = pointerToStage(e);
    const rt = runtimeRef.current.get(dragRef.current.id);
    if (rt) {
      rt.x = Math.max(-240, Math.min(240, p.x + dragRef.current.dx));
      rt.y = Math.max(-180, Math.min(180, p.y + dragRef.current.dy));
    }
  }
  function onCanvasUp() { dragRef.current = null; mouseRef.current.down = false; }

  function selectSprite(id: string) {
    const ws = wsRef.current;
    if (!ws || id === selectedIdRef.current) return;
    scriptsRef.current.set(selectedIdRef.current, Blockly.serialization.workspaces.save(ws));
    ws.clear();
    const js = scriptsRef.current.get(id);
    if (js) { try { Blockly.serialization.workspaces.load(js, ws); } catch { /* ignore */ } }
    setSelectedId(id);
  }

  function addSprite(lib: Sprite) {
    const id = "sp" + idSeq.current++;
    const count = spritesRef.current.length;
    const rt = freshRuntime();
    rt.x = ((count % 4) - 1.5) * 70;
    rt.y = Math.floor(count / 4) * -70;
    runtimeRef.current.set(id, rt);
    scriptsRef.current.set(id, { blocks: { languageVersion: 0, blocks: [] } });
    const sprite = { id, name: `${lib.name} ${count}`, costumes: lib.costumes };
    syncSelectedScript();
    wsRef.current?.clear();
    setSprites((s) => [...s, sprite]);
    setSelectedId(id);
    setPicker(false);
  }

  function surpriseSprite() {
    addSprite(LIBRARY[Math.floor(Math.random() * LIBRARY.length)]);
    setSpriteMenu(false);
  }
  function uploadSprite(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const id = "sp" + idSeq.current++;
      const count = spritesRef.current.length;
      const rt = freshRuntime();
      rt.x = ((count % 4) - 1.5) * 70;
      rt.y = Math.floor(count / 4) * -70;
      runtimeRef.current.set(id, rt);
      scriptsRef.current.set(id, { blocks: { languageVersion: 0, blocks: [] } });
      syncSelectedScript();
      wsRef.current?.clear();
      setSprites((s) => [...s, { id, name: `Sprite ${count}`, costumes: [url] }]);
      setSelectedId(id);
    };
    reader.readAsDataURL(file);
    setSpriteMenu(false);
  }
  function surpriseBackdrop() {
    setBackdrop(BACKDROPS[Math.floor(Math.random() * BACKDROPS.length)].css);
    setBackdropMenu(false);
  }
  function uploadBackdrop(file: File) {
    const reader = new FileReader();
    reader.onload = () => setBackdrop(`center / cover no-repeat url(${JSON.stringify(String(reader.result))})`);
    reader.readAsDataURL(file);
    setBackdropMenu(false);
  }

  function deleteSprite(id: string) {
    if (spritesRef.current.length <= 1) return;
    runtimeRef.current.delete(id);
    scriptsRef.current.delete(id);
    const remaining = spritesRef.current.filter((s) => s.id !== id);
    if (id === selectedIdRef.current) {
      const next = remaining[0];
      wsRef.current?.clear();
      const js = scriptsRef.current.get(next.id);
      if (js) { try { Blockly.serialization.workspaces.load(js, wsRef.current!); } catch { /* ignore */ } }
      setSelectedId(next.id);
    }
    setSprites(remaining);
  }

  // ── Save / load project ─────────────────────────────────────────────────
  function saveProject() {
    syncSelectedScript();
    const runtime: Record<string, Runtime> = {};
    for (const [id, rt] of runtimeRef.current) runtime[id] = rt;
    const scripts: Record<string, object> = {};
    for (const [id, js] of scriptsRef.current) scripts[id] = js;
    const data = { v: 1, app: "curious-labs-sprite-studio", sprites: spritesRef.current, runtime, scripts, selectedId: selectedIdRef.current };
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "curious-labs-project.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function loadProject(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!Array.isArray(data.sprites) || data.sprites.length === 0) return;
        stopAll();
        runtimeRef.current = new Map(Object.entries(data.runtime || {}) as [string, Runtime][]);
        scriptsRef.current = new Map(Object.entries(data.scripts || {}) as [string, object][]);
        for (const sp of data.sprites as Sprite[]) {
          if (!runtimeRef.current.has(sp.id)) runtimeRef.current.set(sp.id, freshRuntime());
          if (!scriptsRef.current.has(sp.id)) scriptsRef.current.set(sp.id, { blocks: { languageVersion: 0, blocks: [] } });
        }
        const sel = data.selectedId && (data.sprites as Sprite[]).some((s) => s.id === data.selectedId)
          ? data.selectedId : data.sprites[0].id;
        idSeq.current = Math.max(idSeq.current, ...(data.sprites as Sprite[]).map((s) => parseInt(String(s.id).replace("sp", "")) || 0)) + 1;
        setSprites(data.sprites);
        setSelectedId(sel);
        const ws = wsRef.current;
        if (ws) {
          ws.clear();
          const js = scriptsRef.current.get(sel);
          if (js) { try { Blockly.serialization.workspaces.load(js, ws); } catch { /* ignore */ } }
        }
      } catch (e) {
        console.warn("[ScratchStudio] load failed", e);
      }
    };
    reader.readAsText(file);
  }

  const selectedSprite = sprites.find((s) => s.id === selectedId);
  const selRt = runtimeRef.current.get(selectedId);

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(300px,360px)]">
      {/* ── Blockly workspace — LEFT (Scratch: palette + code) ── */}
      <div className="order-2 overflow-hidden rounded-xl border border-[#D9D9D9] bg-white shadow-sm lg:order-1">
        {/* Tab bar — Code / Costumes / Sounds */}
        <div className="flex items-center gap-1 border-b border-[#E5E5E5] bg-[#F9F9F9] px-2 py-1.5">
          {([["code", "💻 Code"], ["costumes", "🎨 Costumes"], ["sounds", "🔊 Sounds"]] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-lg px-3 py-1 font-mono text-xs transition-colors ${tab === id ? "bg-white text-[#2E3856] shadow-sm ring-1 ring-[#D9D9D9]" : "text-[#9AA0B3] hover:text-[#575E75]"}`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto pr-2 font-mono text-[10px] tracking-tech text-[#9AA0B3]">{running ? "▶ running…" : selectedSprite?.name ?? ""}</span>
        </div>

        {/* Code tab — Blockly stays mounted, just hidden off-tab */}
        <div ref={blocklyDiv} className={`h-[440px] w-full sm:h-[600px] ${tab === "code" ? "" : "hidden"}`} />

        {/* Costumes tab */}
        {tab === "costumes" && (
          <div className="h-[440px] w-full overflow-auto p-4 sm:h-[600px]">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-mono text-xs tracking-tech text-[#575E75]">COSTUMES · {selectedSprite?.name}</p>
              <button onClick={() => setCostumePicker((p) => !p)} className="rounded-full border border-[#9966FF]/60 px-3 py-1 font-mono text-xs text-[#9966FF] hover:bg-[#9966FF]/10">+ Add costume</button>
            </div>
            {costumePicker && (
              <div className="mb-3 grid grid-cols-8 gap-1.5 rounded-xl border border-[#E5E5E5] bg-[#F9F9F9] p-2">
                {COSTUME_EMOJIS.map((em) => (
                  <button key={em} onClick={() => addCostume(em)} className="grid aspect-square place-items-center rounded-lg border border-[#D9D9D9] bg-white text-xl hover:border-[#9966FF] hover:bg-[#9966FF]/10">{em}</button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {selectedSprite?.costumes.map((c, i) => {
                const on = (selRt?.costumeIndex ?? 0) % (selectedSprite?.costumes.length || 1) === i;
                return (
                  <button key={i} onClick={() => { if (selRt) { selRt.costumeIndex = i; setTick((t) => t + 1); } }}
                    className={`relative grid place-items-center gap-1 rounded-xl border p-3 transition-colors ${on ? "border-[#9966FF] bg-[#9966FF]/10" : "border-[#E5E5E5] bg-white hover:border-[#9966FF]/50"}`}>
                    <span className="text-3xl">{c}</span>
                    <span className="font-mono text-[10px] text-[#9AA0B3]">costume {i + 1}</span>
                    {(selectedSprite?.costumes.length || 1) > 1 && (
                      <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); removeCostume(i); }} className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-[#EC4C4C] text-[10px] text-white">×</span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-4 font-mono text-[10px] text-[#9AA0B3]">Tip: use the “next costume” / “switch to costume” blocks to animate these.</p>
          </div>
        )}

        {/* Sounds tab */}
        {tab === "sounds" && (
          <div className="h-[440px] w-full overflow-auto p-4 sm:h-[600px]">
            <p className="mb-3 font-mono text-xs tracking-tech text-[#575E75]">SOUNDS · tap to preview</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SOUND_NAMES.map((name) => (
                <button key={name} onClick={() => playSound(name)} className="flex items-center justify-between rounded-xl border border-[#E5E5E5] bg-white px-3 py-2.5 text-left transition-colors hover:border-[#CF63CF]">
                  <span className="font-mono text-sm text-[#2E3856]">{name}</span>
                  <span className="text-[#CF63CF]">▶</span>
                </button>
              ))}
            </div>
            <p className="mt-4 font-mono text-[10px] text-[#9AA0B3]">Tip: use the “play sound” blocks in the 🔊 Sound category to trigger these.</p>
          </div>
        )}
      </div>

      {/* ── Stage + sprites — RIGHT ── */}
      <div className="order-1 flex flex-col gap-4 lg:order-2">
        <div className="rounded-xl border border-[#D9D9D9] bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="font-mono text-xs tracking-tech text-[#575E75]">STAGE</p>
              <button onClick={saveProject} title="Save project" className="rounded-md border border-[#D9D9D9] px-2 py-0.5 text-xs text-[#575E75] transition-colors hover:border-[#4C97FF] hover:text-[#4C97FF]">💾</button>
              <button onClick={() => fileRef.current?.click()} title="Load project" className="rounded-md border border-[#D9D9D9] px-2 py-0.5 text-xs text-[#575E75] transition-colors hover:border-[#4C97FF] hover:text-[#4C97FF]">📂</button>
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadProject(f); e.target.value = ""; }} />
            </div>
            <div className="flex gap-2">
              <button onClick={greenFlag} disabled={running} title="Green flag — run all" className="grid h-8 w-8 place-items-center rounded-full border border-[#4CBB17]/50 bg-[#4CBB17]/10 text-sm transition-colors hover:bg-[#4CBB17]/20 disabled:opacity-50">🟢</button>
              <button onClick={stopAll} title="Stop everything" className="grid h-8 w-8 place-items-center rounded-full border border-[#EC4C4C]/50 bg-[#EC4C4C]/10 text-sm transition-colors hover:bg-[#EC4C4C]/20">🛑</button>
            </div>
          </div>
          <canvas
            ref={canvasRef}
            onPointerDown={onCanvasDown}
            onPointerMove={onCanvasMove}
            onPointerUp={onCanvasUp}
            onPointerCancel={onCanvasUp}
            className={`block aspect-[4/3] w-full cursor-grab touch-none rounded-lg border transition-shadow active:cursor-grabbing ${running ? "border-[#4CBB17] shadow-[0_0_0_3px_rgba(76,187,23,0.25)]" : "border-[#D9D9D9]"}`}
            style={{ background: backdrop }}
          />
          {/* Choose a Backdrop — Scratch-style menu */}
          <div className="relative mt-2 flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-tech text-[#9AA0B3]">BACKDROP</span>
            <button onClick={() => setBackdropMenu((m) => !m)} className="rounded-full border border-[#4C97FF]/60 px-3 py-1 font-mono text-[11px] text-[#4C97FF] transition-colors hover:bg-[#4C97FF]/10">🖼️ Choose a Backdrop ▾</button>
            {backdropMenu && (
              <div className="absolute right-0 top-8 z-20 w-36 rounded-xl border border-[#D9D9D9] bg-white p-1 shadow-lg">
                <button onClick={surpriseBackdrop} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-[#575E75] hover:bg-[#4C97FF]/10">🎲 Surprise</button>
                <button onClick={() => backdropFileRef.current?.click()} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-[#575E75] hover:bg-[#4C97FF]/10">⬆️ Upload image</button>
              </div>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {BACKDROPS.map((b) => (
              <button
                key={b.name}
                onClick={() => setBackdrop(b.css)}
                title={b.name}
                className={`h-5 w-5 rounded-md border transition-transform hover:scale-110 ${backdrop === b.css ? "border-[#4C97FF] ring-1 ring-[#4C97FF]" : "border-[#D9D9D9]"}`}
                style={{ background: b.css }}
              />
            ))}
            <input ref={backdropFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBackdrop(f); e.target.value = ""; }} />
          </div>
          <p className="mt-2 text-center font-mono text-[10px] tracking-tech text-[#9AA0B3]">
            drag sprites · click a block to test it · 🟢 run · space/arrows for keys
          </p>
        </div>

        {/* Sprite info bar — Scratch-style live x / y / size / direction */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-[#D9D9D9] bg-white px-3 py-2 text-xs text-[#575E75] shadow-sm">
          <span className="max-w-[7rem] truncate font-semibold text-[#2E3856]">{selectedSprite?.name ?? "Sprite"}</span>
          <span>x <b ref={xRef} className="font-mono text-[#2E3856]">0</b></span>
          <span>y <b ref={yRef} className="font-mono text-[#2E3856]">0</b></span>
          <span>size <b ref={sizeRef} className="font-mono text-[#2E3856]">100</b></span>
          <span>dir <b ref={dirRef} className="font-mono text-[#2E3856]">90</b></span>
          <button
            onClick={() => { const r = runtimeRef.current.get(selectedIdRef.current); if (r) { r.visible = !r.visible; setTick((t) => t + 1); } }}
            title="Show / hide sprite"
            className="ml-auto rounded-md border border-[#D9D9D9] px-2 py-0.5 text-[#575E75] transition-colors hover:border-[#4C97FF] hover:text-[#4C97FF]"
          >
            {selRt?.visible === false ? "🚫 hidden" : "👁 shown"}
          </button>
        </div>

        {/* Sprite panel */}
        <div className="rounded-xl border border-[#D9D9D9] bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-mono text-xs tracking-tech text-[#575E75]">SPRITES</p>
            <div className="relative">
              <button onClick={() => setSpriteMenu((m) => !m)} className="rounded-full border border-[#4C97FF]/60 px-3 py-1 font-mono text-xs text-[#4C97FF] transition-colors hover:bg-[#4C97FF]/10">🐱 Choose a Sprite ▾</button>
              {spriteMenu && (
                <div className="absolute right-0 top-8 z-20 w-36 rounded-xl border border-[#D9D9D9] bg-white p-1 shadow-lg">
                  <button onClick={() => { setSpriteMenu(false); setPicker(true); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-[#575E75] hover:bg-[#4C97FF]/10">🔍 Choose</button>
                  <button onClick={surpriseSprite} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-[#575E75] hover:bg-[#4C97FF]/10">🎲 Surprise</button>
                  <button onClick={() => spriteFileRef.current?.click()} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-[#575E75] hover:bg-[#4C97FF]/10">⬆️ Upload image</button>
                </div>
              )}
              <input ref={spriteFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadSprite(f); e.target.value = ""; }} />
            </div>
          </div>

          {picker && (
            <div className="mb-3 grid grid-cols-6 gap-1.5 rounded-xl border border-[#E5E5E5] bg-[#F9F9F9] p-2">
              {LIBRARY.map((lib) => (
                <button key={lib.name} onClick={() => addSprite(lib)} title={lib.name} className="grid aspect-square place-items-center rounded-lg border border-[#D9D9D9] bg-white text-xl transition-colors hover:border-[#4C97FF] hover:bg-[#4C97FF]/10">
                  {lib.costumes[0]}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {sprites.map((sp) => {
              const on = sp.id === selectedId;
              const rt = runtimeRef.current.get(sp.id);
              return (
                <button key={sp.id} onClick={() => selectSprite(sp.id)} className={`relative grid place-items-center gap-1 rounded-xl border p-2 transition-colors ${on ? "border-[#4C97FF] bg-[#4C97FF]/10" : "border-[#E5E5E5] bg-white hover:border-[#4C97FF]/50"}`}>
                  {(() => { const c = sp.costumes[rt ? rt.costumeIndex % sp.costumes.length : 0]; return isImg(c) ? <span aria-hidden className="inline-block h-8 w-8 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${JSON.stringify(c)})` }} /> : <span className="text-2xl">{c}</span>; })()}
                  <span className="max-w-full truncate font-mono text-[10px] text-[#575E75]">{sp.name}</span>
                  {sprites.length > 1 && (
                    <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); deleteSprite(sp.id); }} className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-[#EC4C4C] text-[10px] text-white">×</span>
                  )}
                </button>
              );
            })}
          </div>

          {selectedSprite && selectedSprite.costumes.length > 1 && (
            <div className="mt-3 border-t border-[#E5E5E5] pt-3">
              <p className="mb-2 font-mono text-[10px] tracking-tech text-[#9AA0B3]">COSTUMES · {selectedSprite.name}</p>
              <div className="flex flex-wrap gap-2">
                {selectedSprite.costumes.map((c, i) => {
                  const on = (selRt?.costumeIndex ?? 0) % selectedSprite.costumes.length === i;
                  return (
                    <button key={i} onClick={() => { if (selRt) { selRt.costumeIndex = i; setTick((t) => t + 1); } }} className={`grid h-10 w-10 place-items-center rounded-lg border text-lg transition-colors ${on ? "border-[#9966FF] bg-[#9966FF]/15" : "border-[#E5E5E5] bg-white hover:border-[#9966FF]/50"}`}>
                      {isImg(c) ? <span aria-hidden className="inline-block h-7 w-7 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${JSON.stringify(c)})` }} /> : c}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
