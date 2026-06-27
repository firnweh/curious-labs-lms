"use client";

import { useEffect, useRef, useState } from "react";
import * as Blockly from "blockly";
import { javascriptGenerator } from "blockly/javascript";
import { registerScratchBlocks, getScratchTheme, scratchToolboxForGrade } from "@/lib/scratchBlocks";
import { playSound } from "@/lib/scratchSound";

type Sprite = { id: string; name: string; costumes: string[] };
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

/* ── Classwise missions (problem-solving per class 1–10) ─────────────────── */
const txtv = (t: string) => ({ shadow: { type: "text", fields: { TEXT: t } } });
const SCORE_ID = "scoreVar1";

type Mission = { g: number; emoji: string; title: string; goal: string; hint: string; needs: string[] };
const MISSIONS: Mission[] = [
  { g: 1, emoji: "💬", title: "Say Hello", goal: "When the green flag is clicked, make your sprite say “Hi, I can code!”", hint: "Snap a Looks “say” block under the green-flag block.", needs: ["Events", "Looks"] },
  { g: 2, emoji: "🏃", title: "Get Moving", goal: "When clicked, make your sprite zoom across the stage.", hint: "Use a Motion “move 120 steps” block.", needs: ["Events", "Motion"] },
  { g: 3, emoji: "🔁", title: "Round & Round", goal: "Make your sprite move forever and bounce off the edges.", hint: "Put “move” + “if on edge bounce” inside a forever loop.", needs: ["Control", "Motion"] },
  { g: 4, emoji: "🎬", title: "Bring it Alive", goal: "Animate your sprite by switching costumes in a loop.", hint: "forever → next costume → wait 0.25 secs.", needs: ["Looks", "Control"] },
  { g: 5, emoji: "🎮", title: "You’re in Control", goal: "Move your sprite around with the arrow keys.", hint: "“when → key pressed” → change x by 10.", needs: ["Events", "Motion"] },
  { g: 6, emoji: "🔊", title: "Make Some Noise", goal: "Press space to play a sound and jump a random number of steps.", hint: "Drop a “random” block into “move”.", needs: ["Sound", "Operators", "Events"] },
  { g: 7, emoji: "➗", title: "Mathemagic", goal: "Make your sprite turn by a random angle each time it moves.", hint: "Put “random 15 to 45” inside the turn block.", needs: ["Operators", "Motion"] },
  { g: 8, emoji: "🏆", title: "Keep Score", goal: "Make a variable “score” and add 1 to it when space is pressed.", hint: "Variables → Make a Variable → change score by 1.", needs: ["Variables", "Events"] },
  { g: 9, emoji: "👾", title: "Mini Game", goal: "Move a hero with the arrows, score with space, and play a sound.", hint: "Combine key events, motion, a variable and sound.", needs: ["Events", "Variables", "Sound"] },
  { g: 10, emoji: "🚀", title: "Your Own Game", goal: "Design your own game — sprites, controls, scoring and sound. Make it yours!", hint: "There are no rules — invent something fun.", needs: ["Everything"] },
];
const missionFor = (g: number) => MISSIONS.find((m) => m.g === g) ?? MISSIONS[0];

const NEED_COLOR: Record<string, string> = {
  Events: "#f59e0b", Motion: "#22d3ee", Looks: "#a855f7", Sound: "#ec4899",
  Control: "#34d399", Operators: "#2dd4bf", Variables: "#fb923c", Everything: "#9fb0d0",
};

function exampleFor(g: number): object {
  const wf = (next?: object) => ({ type: "event_whenflag", x: 30, y: 30, ...(next ? { next: { block: next } } : {}) });
  switch (g) {
    case 1:
      return { blocks: { languageVersion: 0, blocks: [wf({ type: "looks_sayfor", inputs: { TEXT: txtv("Hi, I can code!"), SECS: num(3) } })] } };
    case 2:
      return { blocks: { languageVersion: 0, blocks: [wf({ type: "motion_move", inputs: { STEPS: num(120) } })] } };
    case 3:
      return { blocks: { languageVersion: 0, blocks: [wf({ type: "control_forever", inputs: { DO: { block: chain([{ type: "motion_move", inputs: { STEPS: num(6) } }, { type: "motion_bounce" }]) } } })] } };
    case 4:
      return { blocks: { languageVersion: 0, blocks: [wf({ type: "control_forever", inputs: { DO: { block: chain([{ type: "looks_nextcostume" }, { type: "control_wait", inputs: { SECS: num(0.25) } }]) } } })] } };
    case 5:
      return { blocks: { languageVersion: 0, blocks: [
        { type: "event_whenkey", x: 30, y: 30, fields: { KEY: "right" }, next: { block: { type: "motion_changex", inputs: { DX: num(10) } } } },
        { type: "event_whenkey", x: 30, y: 150, fields: { KEY: "left" }, next: { block: { type: "motion_changex", inputs: { DX: num(-10) } } } },
        { type: "event_whenkey", x: 260, y: 30, fields: { KEY: "up" }, next: { block: { type: "motion_changey", inputs: { DY: num(10) } } } },
        { type: "event_whenkey", x: 260, y: 150, fields: { KEY: "down" }, next: { block: { type: "motion_changey", inputs: { DY: num(-10) } } } },
      ] } };
    case 6:
      return { blocks: { languageVersion: 0, blocks: [
        { type: "event_whenkey", x: 30, y: 30, fields: { KEY: "space" }, next: { block: { type: "sound_play", fields: { SOUND: "laser" }, next: { block: { type: "motion_move", inputs: { STEPS: { block: { type: "math_random_int", inputs: { FROM: num(10), TO: num(80) } } } } } } } } },
      ] } };
    case 7:
      return { blocks: { languageVersion: 0, blocks: [wf({ type: "control_forever", inputs: { DO: { block: chain([
        { type: "motion_move", inputs: { STEPS: num(20) } },
        { type: "motion_turnright", inputs: { DEG: { block: { type: "math_random_int", inputs: { FROM: num(15), TO: num(45) } } } } },
        { type: "control_wait", inputs: { SECS: num(0.1) } },
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
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const runtimeRef = useRef<Map<string, Runtime>>(new Map());
  const scriptsRef = useRef<Map<string, object>>(new Map());
  const compiledRef = useRef<Map<string, Compiled>>(new Map());
  const spritesRef = useRef<Sprite[]>([]);
  const selectedIdRef = useRef("sp0");
  const stopRef = useRef(false);
  const sessionRef = useRef(false);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const rafRender = useRef(0);
  const idSeq = useRef(1);
  const gradeRef = useRef(1);
  const firstGrade = useRef(true);

  const [sprites, setSprites] = useState<Sprite[]>([DEFAULT_SPRITE]);
  const [selectedId, setSelectedId] = useState("sp0");
  const [grade, setGrade] = useState(1);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [celebrate, setCelebrate] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [picker, setPicker] = useState(false);
  const [, setTick] = useState(0);

  spritesRef.current = sprites;
  selectedIdRef.current = selectedId;
  gradeRef.current = grade;

  // ── Mount: runtime + Blockly + render loop + key listener ────────────────
  useEffect(() => {
    registerScratchBlocks();
    runtimeRef.current.set("sp0", freshRuntime());
    const initial = exampleFor(gradeRef.current);
    scriptsRef.current.set("sp0", initial);

    if (!blocklyDiv.current) return;
    const ws = Blockly.inject(blocklyDiv.current, {
      toolbox: scratchToolboxForGrade(gradeRef.current),
      theme: getScratchTheme(),
      renderer: "zelos",
      grid: { spacing: 28, length: 2, colour: "#16223c", snap: true },
      zoom: { controls: true, wheel: true, startScale: 0.8, maxScale: 2, minScale: 0.35, pinch: true },
      move: { scrollbars: true, drag: true, wheel: true },
      trashcan: true,
    });
    wsRef.current = ws;
    try { Blockly.serialization.workspaces.load(initial, ws); } catch { /* ignore */ }

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

    return () => {
      window.clearTimeout(t);
      ro.disconnect();
      cancelAnimationFrame(rafRender.current);
      window.removeEventListener("keydown", onKey);
      ws.dispose();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Activity change: scale the palette to the class AND load that activity's
  // scaffold into the selected sprite, so activities are stepped one by one.
  useEffect(() => {
    if (firstGrade.current) { firstGrade.current = false; return; }
    const ws = wsRef.current;
    if (!ws) return;
    ws.updateToolbox(scratchToolboxForGrade(grade));
    const ex = exampleFor(grade);
    ws.clear();
    try { Blockly.serialization.workspaces.load(ex, ws); } catch { /* ignore */ }
    scriptsRef.current.set(selectedIdRef.current, ex);
  }, [grade]);

  // Restore saved activity completion.
  useEffect(() => {
    try {
      const a = JSON.parse(localStorage.getItem("cl-scratch-done") || "[]");
      if (Array.isArray(a)) setCompleted(new Set(a as number[]));
    } catch { /* ignore */ }
  }, []);

  function markComplete() {
    setCompleted((prev) => {
      const next = new Set(prev);
      next.add(grade);
      try { localStorage.setItem("cl-scratch-done", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
    playSound("chime");
    setCelebrate(grade);
    window.setTimeout(() => setCelebrate(null), 1600);
    if (grade < 10) window.setTimeout(() => setGrade((g) => Math.min(10, g + 1)), 850);
  }

  function loadExample() {
    const ws = wsRef.current;
    if (!ws) return;
    const ex = exampleFor(grade);
    ws.clear();
    try { Blockly.serialization.workspaces.load(ex, ws); } catch { /* ignore */ }
    scriptsRef.current.set(selectedIdRef.current, ex);
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
      const emoji = sp.costumes[((rt.costumeIndex % sp.costumes.length) + sp.costumes.length) % sp.costumes.length];
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(((rt.dir - 90) * Math.PI) / 180);
      ctx.font = `${Math.max(8, fs)}px "Apple Color Emoji","Segoe UI Emoji",serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(emoji, 0, 0);
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
    if (!dragRef.current) return;
    const p = pointerToStage(e);
    const rt = runtimeRef.current.get(dragRef.current.id);
    if (rt) {
      rt.x = Math.max(-240, Math.min(240, p.x + dragRef.current.dx));
      rt.y = Math.max(-180, Math.min(180, p.y + dragRef.current.dy));
    }
  }
  function onCanvasUp() { dragRef.current = null; }

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
  const mission = missionFor(grade);

  return (
    <div>
      {/* ── Classwise mission ─────────────────────────────── */}
      <div className="mb-4 panel relative overflow-hidden p-4">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: "radial-gradient(120% 120% at 100% -20%, rgba(168,85,247,.18), transparent 45%), radial-gradient(120% 120% at -10% 120%, rgba(34,211,238,.16), transparent 45%)" }}
          aria-hidden
        />
        {celebrate && (
          <div
            className="pointer-events-none absolute right-4 top-4 z-10 rounded-full border border-neon-green/60 bg-neon-green/20 px-4 py-1.5 font-mono text-xs font-bold tracking-tech text-neon-green"
            style={{ animation: "reactorIn .5s cubic-bezier(.18,1.8,.34,1) both" }}
          >
            {completed.size >= 10 ? "🏆 All 10 complete!" : `🎉 Activity ${celebrate} complete!`}
          </div>
        )}
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setGrade((g) => Math.max(1, g - 1))}
              disabled={grade <= 1}
              aria-label="Previous activity"
              className="shrink-0 rounded-full border border-line px-3 py-1.5 font-mono text-xs text-ink-dim transition-colors hover:border-neon-cyan/50 hover:text-ink disabled:opacity-25"
            >
              ← Back
            </button>
            <div className="flex flex-1 flex-col items-center gap-1.5">
              <p className="font-mono text-[11px] tracking-tech text-neon-cyan">
                ACTIVITY {grade} OF 10 <span className="text-neon-green">· {completed.size} DONE</span>
              </p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((c) => {
                  const done = completed.has(c);
                  const cur = c === grade;
                  return (
                    <button
                      key={c}
                      onClick={() => setGrade(c)}
                      aria-label={`Go to activity ${c}${done ? " (complete)" : ""}`}
                      title={done ? `Activity ${c} ✓` : `Activity ${c}`}
                      className={`h-2 rounded-full transition-all ${cur ? "w-5 bg-neon-cyan" : done ? "w-2.5 bg-neon-green" : "w-2 bg-line"}`}
                    />
                  );
                })}
              </div>
            </div>
            <button
              onClick={() => setGrade((g) => Math.min(10, g + 1))}
              disabled={grade >= 10}
              aria-label="Next activity"
              className="shrink-0 rounded-full border border-neon-cyan/50 bg-neon-cyan/10 px-3 py-1.5 font-mono text-xs font-semibold text-neon-cyan transition-colors hover:bg-neon-cyan/20 disabled:opacity-25"
            >
              Next →
            </button>
          </div>
          <div className="mt-3 flex items-start gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-neon-amber/40 bg-neon-amber/10 text-2xl">
              {mission.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] tracking-tech text-neon-amber">🎯 MISSION · CLASS {grade}</p>
              <h3 className="font-display text-lg font-bold text-ink">{mission.title}</h3>
              <p className="text-sm text-ink-dim">{mission.goal}</p>
              <p className="mt-1 text-xs text-ink-faint">💡 {mission.hint}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {mission.needs.map((n) => (
                  <span
                    key={n}
                    className="rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
                    style={{ color: NEED_COLOR[n] ?? "#9fb0d0", borderColor: `${NEED_COLOR[n] ?? "#9fb0d0"}55`, background: `${NEED_COLOR[n] ?? "#9fb0d0"}14` }}
                  >
                    {n}
                  </span>
                ))}
                <button
                  onClick={loadExample}
                  className="ml-1 rounded-full border border-neon-cyan/50 bg-neon-cyan/10 px-3 py-1 font-mono text-[11px] text-neon-cyan transition-colors hover:bg-neon-cyan/20"
                >
                  ✨ Load example
                </button>
                <button
                  onClick={markComplete}
                  className={`rounded-full border px-3 py-1 font-mono text-[11px] transition-colors ${completed.has(grade) ? "border-neon-green/60 bg-neon-green/15 text-neon-green" : "border-neon-green/40 text-neon-green hover:bg-neon-green/10"}`}
                >
                  {completed.has(grade) ? "✓ Completed" : "✓ Mark complete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(300px,360px)]">
      {/* ── Blockly workspace — LEFT (Scratch: palette + code) ── */}
      <div className="order-2 overflow-hidden rounded-xl border border-[#D9D9D9] bg-white shadow-sm lg:order-1">
        <div className="flex items-center justify-between border-b border-[#E5E5E5] bg-[#F9F9F9] px-4 py-2">
          <p className="font-mono text-xs tracking-tech text-[#575E75]">SCRIPTS · <span className="font-semibold text-[#2E3856]">{selectedSprite?.name ?? "—"}</span></p>
          <span className="font-mono text-[10px] tracking-tech text-[#9AA0B3]">{running ? "▶ running…" : "idle"}</span>
        </div>
        <div ref={blocklyDiv} className="h-[440px] w-full sm:h-[600px]" />
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
            className="block aspect-[4/3] w-full cursor-grab touch-none rounded-lg border border-[#D9D9D9] active:cursor-grabbing"
            style={{ background: "#ffffff" }}
          />
          <p className="mt-2 text-center font-mono text-[10px] tracking-tech text-[#9AA0B3]">
            drag sprites on the stage · 🟢 run · space/arrows trigger key blocks
          </p>
        </div>

        {/* Sprite panel */}
        <div className="rounded-xl border border-[#D9D9D9] bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-mono text-xs tracking-tech text-[#575E75]">SPRITES</p>
            <button onClick={() => setPicker((p) => !p)} className="rounded-full border border-[#4C97FF]/60 px-3 py-1 font-mono text-xs text-[#4C97FF] transition-colors hover:bg-[#4C97FF]/10">+ Add sprite</button>
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
                  <span className="text-2xl">{sp.costumes[rt ? rt.costumeIndex % sp.costumes.length : 0]}</span>
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
                      {c}
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
