"use client";

import { useEffect, useRef, useState } from "react";
import * as Blockly from "blockly";
import { javascriptGenerator, Order } from "blockly/javascript";

/* ── Custom "rocket pen" motion blocks ─────────────────────────────────────
   STEPS / DEG are value inputs (with a shadow number) so younger kids just
   edit the number, while older kids can plug in maths or a variable. */
const CUSTOM_BLOCKS = [
  {
    type: "cl_move",
    message0: "🚀 fly forward %1 steps",
    args0: [{ type: "input_value", name: "STEPS", check: "Number" }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: "motion_blocks",
    tooltip: "Fly the rocket forward, drawing its trail.",
  },
  {
    type: "cl_turn",
    message0: "turn %1 %2 degrees",
    args0: [
      { type: "field_dropdown", name: "DIR", options: [["right ↻", "1"], ["left ↺", "-1"]] },
      { type: "input_value", name: "DEG", check: "Number" },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: "motion_blocks",
    tooltip: "Rotate the rocket without moving.",
  },
  {
    type: "cl_pen",
    message0: "trail %1",
    args0: [{ type: "field_dropdown", name: "STATE", options: [["on ✏️", "1"], ["off ✋", "0"]] }],
    previousStatement: null,
    nextStatement: null,
    style: "motion_blocks",
    tooltip: "Lift the trail to move without drawing.",
  },
  {
    type: "cl_color",
    message0: "set trail colour %1",
    args0: [
      {
        type: "field_dropdown",
        name: "COLOUR",
        options: [
          ["cyan", "#22d3ee"],
          ["violet", "#a855f7"],
          ["green", "#34d399"],
          ["amber", "#f59e0b"],
          ["pink", "#ec4899"],
          ["white", "#e8eefc"],
        ],
      },
    ],
    previousStatement: null,
    nextStatement: null,
    style: "motion_blocks",
    tooltip: "Change the trail colour.",
  },
];

Blockly.defineBlocksWithJsonArray(CUSTOM_BLOCKS);
javascriptGenerator.forBlock["cl_move"] = (b, g) =>
  `move(${g.valueToCode(b, "STEPS", Order.NONE) || "0"});\n`;
javascriptGenerator.forBlock["cl_turn"] = (b, g) =>
  `turn(${Number(b.getFieldValue("DIR")) || 1} * (${g.valueToCode(b, "DEG", Order.NONE) || "0"}));\n`;
javascriptGenerator.forBlock["cl_pen"] = (b) => `pen(${b.getFieldValue("STATE") === "1"});\n`;
javascriptGenerator.forBlock["cl_color"] = (b) => `color(${JSON.stringify(b.getFieldValue("COLOUR"))});\n`;
javascriptGenerator.INFINITE_LOOP_TRAP =
  'if(++__ops>300000)throw new Error("Program ran too long — use fewer loops or steps.");\n';

/* ── Toolbox categories (shown progressively by class) ─────────────────── */
const MOTION_CAT = {
  kind: "category",
  name: "🚀 Motion",
  categorystyle: "motion_category",
  contents: [
    { kind: "block", type: "cl_move", inputs: { STEPS: { shadow: { type: "math_number", fields: { NUM: 80 } } } } },
    { kind: "block", type: "cl_turn", inputs: { DEG: { shadow: { type: "math_number", fields: { NUM: 90 } } } } },
    { kind: "block", type: "cl_pen" },
    { kind: "block", type: "cl_color" },
  ],
};
const LOOPS_CAT = {
  kind: "category",
  name: "🔁 Loops",
  categorystyle: "loop_category",
  contents: [
    { kind: "block", type: "controls_repeat_ext", inputs: { TIMES: { shadow: { type: "math_number", fields: { NUM: 4 } } } } },
  ],
};
const MATH_CAT = {
  kind: "category",
  name: "🔢 Math",
  categorystyle: "math_category",
  contents: [
    { kind: "block", type: "math_number", fields: { NUM: 10 } },
    { kind: "block", type: "math_arithmetic" },
    {
      kind: "block",
      type: "math_random_int",
      inputs: {
        FROM: { shadow: { type: "math_number", fields: { NUM: 1 } } },
        TO: { shadow: { type: "math_number", fields: { NUM: 100 } } },
      },
    },
  ],
};
const LOGIC_CAT = {
  kind: "category",
  name: "🔀 Logic",
  categorystyle: "logic_category",
  contents: [
    { kind: "block", type: "controls_if" },
    { kind: "block", type: "logic_compare" },
    { kind: "block", type: "logic_boolean" },
  ],
};
const VARS_CAT = { kind: "category", name: "📦 Variables", categorystyle: "variable_category", custom: "VARIABLE" };
const FUNCS_CAT = { kind: "category", name: "🧰 Functions", categorystyle: "logic_category", custom: "PROCEDURE" };

function toolboxForGrade(g: number) {
  const c: object[] = [MOTION_CAT];
  if (g >= 3) c.push(LOOPS_CAT);
  if (g >= 5) c.push(MATH_CAT);
  if (g >= 6) c.push(LOGIC_CAT);
  if (g >= 7) c.push(VARS_CAT);
  if (g >= 9) c.push(FUNCS_CAT);
  return { kind: "categoryToolbox", contents: c } as unknown as Blockly.utils.toolbox.ToolboxDefinition;
}

/* ── Per-class missions ────────────────────────────────────────────────── */
function missionForGrade(g: number): { goal: string; tip: string } {
  if (g <= 2) return { goal: "Fly the rocket to draw a square 🟦", tip: "Use fly-forward and turn — four times!" };
  if (g <= 4) return { goal: "Use a Loop to draw a star ⭐", tip: "Repeat: fly forward, then turn 144°." };
  if (g <= 6) return { goal: "Draw a colourful polygon 🔷", tip: "Change the turn angle and repeat count with Math." };
  if (g <= 8) return { goal: "Use a Variable to draw a spiral 🌀", tip: "Grow the fly-forward distance each loop." };
  return { goal: "Invent your own generative art ✨", tip: "Combine loops, variables and your own functions." };
}

/* ── Starter programs (chained block specs) ────────────────────────────── */
type Spec = { type: string; fields?: object; inputs?: object };
function chain(specs: Spec[]): Record<string, unknown> | null {
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
const num = (n: number) => ({ shadow: { type: "math_number", fields: { NUM: n } } });

const STARTER_SQUARE = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        ...chain([
          { type: "cl_color", fields: { COLOUR: "#34d399" } },
          { type: "cl_move", inputs: { STEPS: num(110) } },
          { type: "cl_turn", fields: { DIR: "1" }, inputs: { DEG: num(90) } },
          { type: "cl_move", inputs: { STEPS: num(110) } },
          { type: "cl_turn", fields: { DIR: "1" }, inputs: { DEG: num(90) } },
          { type: "cl_move", inputs: { STEPS: num(110) } },
          { type: "cl_turn", fields: { DIR: "1" }, inputs: { DEG: num(90) } },
          { type: "cl_move", inputs: { STEPS: num(110) } },
          { type: "cl_turn", fields: { DIR: "1" }, inputs: { DEG: num(90) } },
        ]),
        x: 40,
        y: 40,
      },
    ],
  },
};

const STARTER_STAR = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: "controls_repeat_ext",
        x: 40,
        y: 40,
        inputs: {
          TIMES: num(5),
          DO: {
            block: chain([
              { type: "cl_color", fields: { COLOUR: "#22d3ee" } },
              { type: "cl_move", inputs: { STEPS: num(120) } },
              { type: "cl_turn", fields: { DIR: "1" }, inputs: { DEG: num(144) } },
            ]),
          },
        },
      },
    ],
  },
};

const VAR_ID = "sizeVar1";
const STARTER_SPIRAL = {
  variables: [{ name: "size", id: VAR_ID }],
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: "variables_set",
        x: 40,
        y: 40,
        fields: { VAR: { id: VAR_ID } },
        inputs: { VALUE: num(8) },
        next: {
          block: {
            type: "controls_repeat_ext",
            inputs: {
              TIMES: num(40),
              DO: {
                block: chain([
                  { type: "cl_color", fields: { COLOUR: "#a855f7" } },
                  { type: "cl_move", inputs: { STEPS: { block: { type: "variables_get", fields: { VAR: { id: VAR_ID } } } } } },
                  { type: "cl_turn", fields: { DIR: "1" }, inputs: { DEG: num(92) } },
                  { type: "math_change", fields: { VAR: { id: VAR_ID } }, inputs: { DELTA: num(4) } },
                ]),
              },
            },
          },
        },
      },
    ],
  },
};

function starterForGrade(g: number) {
  if (g <= 2) return STARTER_SQUARE;
  if (g <= 6) return STARTER_STAR;
  return STARTER_SPIRAL;
}

let themeSingleton: Blockly.Theme | null = null;
function getTheme(): Blockly.Theme | undefined {
  if (themeSingleton) return themeSingleton;
  const styles = {
    base: Blockly.Themes.Classic,
    fontStyle: { family: "'JetBrains Mono', ui-monospace, monospace", size: 11 },
    componentStyles: {
      workspaceBackgroundColour: "#0a1020",
      toolboxBackgroundColour: "#0c1326",
      toolboxForegroundColour: "#cdd9f0",
      flyoutBackgroundColour: "#0c1326",
      flyoutForegroundColour: "#9fb0d0",
      flyoutOpacity: 0.98,
      scrollbarColour: "#26334f",
      scrollbarOpacity: 0.6,
      insertionMarkerColour: "#22d3ee",
      insertionMarkerOpacity: 0.5,
      cursorColour: "#22d3ee",
      selectedGlowColour: "#22d3ee",
      gridColour: "#16223c",
    },
    blockStyles: {
      motion_blocks: { colourPrimary: "#f59e0b", colourSecondary: "#c97f0a", colourTertiary: "#e0930b" },
      loop_blocks: { colourPrimary: "#34d399", colourSecondary: "#1f8f68", colourTertiary: "#2bb583" },
      logic_blocks: { colourPrimary: "#22d3ee", colourSecondary: "#1593a8", colourTertiary: "#1bb3cf" },
      math_blocks: { colourPrimary: "#a855f7", colourSecondary: "#7d3fbb", colourTertiary: "#9148da" },
      variable_blocks: { colourPrimary: "#ec4899", colourSecondary: "#b32f72", colourTertiary: "#d23d88" },
      procedure_blocks: { colourPrimary: "#38bdf8", colourSecondary: "#2487b5", colourTertiary: "#2ea3da" },
      text_blocks: { colourPrimary: "#38bdf8", colourSecondary: "#2487b5", colourTertiary: "#2ea3da" },
    },
    categoryStyles: {
      motion_category: { colour: "#f59e0b" },
      loop_category: { colour: "#34d399" },
      logic_category: { colour: "#22d3ee" },
      math_category: { colour: "#a855f7" },
      variable_category: { colour: "#ec4899" },
    },
    name: "curiouscosmic",
  } as unknown as Parameters<typeof Blockly.Theme.defineTheme>[1];
  try {
    themeSingleton = Blockly.Theme.defineTheme("curiouscosmic", styles);
  } catch {
    themeSingleton = Blockly.Themes.Classic;
  }
  return themeSingleton ?? undefined;
}

const CLASSES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Grade-aware block-coding studio: the toolbox, mission and starter scale
 *  with the selected class (1–10). */
export function BlocklyStudio() {
  const blocklyDiv = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const rafRef = useRef<number>(0);
  const gradeRef = useRef(4);

  const [grade, setGrade] = useState(4);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  gradeRef.current = grade;

  const mission = missionForGrade(grade);

  function loadStarter(g: number) {
    const ws = wsRef.current;
    if (!ws) return;
    ws.clear();
    try {
      Blockly.serialization.workspaces.load(starterForGrade(g), ws);
    } catch {
      /* ignore */
    }
  }

  // Mount: inject the workspace.
  useEffect(() => {
    if (!blocklyDiv.current) return;
    const ws = Blockly.inject(blocklyDiv.current, {
      toolbox: toolboxForGrade(gradeRef.current),
      theme: getTheme(),
      renderer: "zelos",
      grid: { spacing: 28, length: 2, colour: "#16223c", snap: true },
      zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 2, minScale: 0.4, pinch: true },
      move: { scrollbars: true, drag: true, wheel: true },
      trashcan: true,
    });
    wsRef.current = ws;
    loadStarter(gradeRef.current);

    const ro = new ResizeObserver(() => Blockly.svgResize(ws));
    ro.observe(blocklyDiv.current);
    const t = window.setTimeout(() => Blockly.svgResize(ws), 200);

    return () => {
      window.clearTimeout(t);
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
      ws.dispose();
      wsRef.current = null;
    };
  }, []);

  // Class change: swap toolbox + load the class-appropriate example.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const ws = wsRef.current;
    if (!ws) return;
    ws.updateToolbox(toolboxForGrade(grade));
    loadStarter(grade);
    setError(null);
  }, [grade]);

  function animate(segs: { x1: number; y1: number; x2: number; y2: number; col: string; draw: boolean }[]) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    cancelAnimationFrame(rafRef.current);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth || 400;
    const H = canvas.clientHeight || 300;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    for (const s of segs) {
      minX = Math.min(minX, s.x1, s.x2); maxX = Math.max(maxX, s.x1, s.x2);
      minY = Math.min(minY, s.y1, s.y2); maxY = Math.max(maxY, s.y1, s.y2);
    }
    const pad = 36;
    const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
    const scale = Math.min((W - pad * 2) / bw, (H - pad * 2) / bh, 2);
    const ox = W / 2 - ((minX + maxX) / 2) * scale;
    const oy = H / 2 + ((minY + maxY) / 2) * scale;
    const tx = (x: number) => ox + x * scale;
    const ty = (y: number) => oy - y * scale;

    const drawn = segs.filter((s) => s.draw);
    const lens = drawn.map((s) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1) * scale);
    const total = lens.reduce((a, b) => a + b, 0) || 1;
    const dur = Math.min(4000, Math.max(450, (total / 540) * 1000));

    const grid = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(56,189,248,0.06)";
      ctx.lineWidth = 1;
      for (let gx = 0; gx <= W; gx += 28) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
      for (let gy = 0; gy <= H; gy += 28) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
    };
    const stroke = (x1: number, y1: number, x2: number, y2: number, col: string) => {
      ctx.save();
      ctx.shadowColor = col; ctx.shadowBlur = 10;
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.restore();
    };

    let start: number | null = null;
    const frame = (now: number) => {
      if (start == null) start = now;
      const p = Math.min(1, (now - start) / dur);
      const target = total * p;
      grid();
      let acc = 0, headX: number | null = null, headY: number | null = null;
      for (let i = 0; i < drawn.length; i++) {
        const s = drawn[i];
        const segLen = lens[i];
        const x1 = tx(s.x1), y1 = ty(s.y1), x2 = tx(s.x2), y2 = ty(s.y2);
        if (acc + segLen <= target) {
          stroke(x1, y1, x2, y2, s.col); headX = x2; headY = y2;
        } else if (acc < target) {
          const f = (target - acc) / segLen;
          const mx = x1 + (x2 - x1) * f, my = y1 + (y2 - y1) * f;
          stroke(x1, y1, mx, my, s.col); headX = mx; headY = my;
          break;
        } else break;
        acc += segLen;
      }
      if (headX != null && headY != null) {
        ctx.save();
        ctx.shadowColor = "#22d3ee"; ctx.shadowBlur = 16;
        ctx.fillStyle = "#e8eefc";
        ctx.beginPath(); ctx.arc(headX, headY, 4.5, 0, 7); ctx.fill();
        ctx.restore();
      }
      if (p < 1) rafRef.current = requestAnimationFrame(frame);
      else setRunning(false);
    };
    if (drawn.length === 0) { grid(); setRunning(false); return; }
    setRunning(true);
    rafRef.current = requestAnimationFrame(frame);
  }

  function run() {
    const ws = wsRef.current;
    if (!ws) return;
    setError(null);
    let src = "";
    try {
      src = javascriptGenerator.workspaceToCode(ws);
    } catch {
      setError("Couldn't read the blocks. Try again.");
      return;
    }
    setCode(src);

    const segs: { x1: number; y1: number; x2: number; y2: number; col: string; draw: boolean }[] = [];
    let x = 0, y = 0, heading = 0, down = true, col = "#22d3ee";
    const move = (n: number) => {
      const r = (heading * Math.PI) / 180;
      const nx = x + Math.sin(r) * (Number(n) || 0);
      const ny = y + Math.cos(r) * (Number(n) || 0);
      segs.push({ x1: x, y1: y, x2: nx, y2: ny, col, draw: down });
      x = nx; y = ny;
    };
    const turn = (d: number) => { heading += Number(d) || 0; };
    const pen = (b: boolean) => { down = !!b; };
    const color = (c: string) => { col = String(c) || col; };

    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
      const fn = new Function("move", "turn", "pen", "color", "var __ops=0;\n" + src);
      fn(move, turn, pen, color);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    if (segs.length === 0) {
      setError("Add some Motion blocks (like “fly forward”) and press Run!");
    }
    animate(segs);
  }

  return (
    <div>
      {/* Class selector */}
      <div className="mb-4 panel p-3">
        <p className="mb-2 font-mono text-[11px] tracking-tech text-ink-faint">CHOOSE YOUR CLASS</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {CLASSES.map((c) => {
            const on = c === grade;
            return (
              <button
                key={c}
                onClick={() => setGrade(c)}
                aria-pressed={on}
                className={`shrink-0 rounded-lg px-3 py-1.5 font-mono text-sm transition-colors ${
                  on ? "bg-neon-cyan font-bold text-base" : "border border-line text-ink-dim hover:border-neon-cyan/50 hover:text-ink"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-ink">
          <span className="font-mono text-[11px] tracking-tech text-neon-amber">🎯 MISSION · CLASS {grade}</span>
          <br />
          <span className="font-display font-semibold">{mission.goal}</span>{" "}
          <span className="text-ink-dim">— {mission.tip}</span>
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(300px,420px)]">
        {/* Workspace */}
        <div className="panel overflow-hidden p-0">
          <div ref={blocklyDiv} className="h-[420px] w-full sm:h-[560px]" />
        </div>

        {/* Output + controls */}
        <div className="flex flex-col gap-4">
          <div className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-mono text-xs tracking-tech text-neon-cyan">MISSION OUTPUT</p>
              <span className="font-mono text-[10px] tracking-tech text-ink-faint">
                {running ? "▶ flying…" : "idle"}
              </span>
            </div>
            <canvas
              ref={canvasRef}
              className="block aspect-[4/3] w-full rounded-xl border border-line/70"
              style={{ background: "radial-gradient(120% 120% at 50% 0%, #0b1428, #070d1a)" }}
            />
            {error && (
              <p className="mt-3 rounded-lg border border-neon-amber/40 bg-neon-amber/10 px-3 py-2 text-xs text-neon-amber">
                {error}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={run}
                className="rounded-full border border-neon-green/50 bg-neon-green/15 px-5 py-2.5 font-mono text-sm font-bold tracking-tech text-neon-green transition-colors hover:bg-neon-green/25"
              >
                ▶ Run
              </button>
              <button
                onClick={() => loadStarter(grade)}
                className="rounded-full border border-line px-4 py-2.5 font-mono text-xs text-ink-dim transition-colors hover:border-neon-cyan/50 hover:text-ink"
              >
                ✦ Load example
              </button>
              <button
                onClick={() => setShowCode((s) => !s)}
                className="rounded-full border border-line px-4 py-2.5 font-mono text-xs text-ink-dim transition-colors hover:border-ink/40 hover:text-ink"
              >
                {showCode ? "Hide code" : "</> Code"}
              </button>
            </div>
          </div>

          {showCode && (
            <div className="panel p-4">
              <p className="mb-2 font-mono text-[11px] tracking-tech text-neon-violet">GENERATED JAVASCRIPT</p>
              <pre className="max-h-52 overflow-auto rounded-lg bg-base/60 p-3 font-mono text-[11px] leading-relaxed text-ink-dim">
                {code || "// Press Run to generate code from your blocks."}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
