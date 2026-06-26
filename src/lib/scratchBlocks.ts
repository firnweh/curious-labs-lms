"use client";

import * as Blockly from "blockly";
import { javascriptGenerator, Order } from "blockly/javascript";
import { SOUND_NAMES } from "@/lib/scratchSound";

/* ──────────────────────────────────────────────────────────────────────────
   A Scratch-flavoured block set on Blockly. Motion / Looks / Sound / Control
   blocks drive a sprite `s` (the per-sprite runtime API). Control blocks emit
   `await __yield()` so forever-loops cooperate with the render loop and can be
   stopped. Operators / Variables reuse Blockly's built-ins.
   ────────────────────────────────────────────────────────────────────────── */

const num = (n: number) => ({ shadow: { type: "math_number", fields: { NUM: n } } });
const txt = (t: string) => ({ shadow: { type: "text", fields: { TEXT: t } } });

const BLOCKS = [
  // Events
  { type: "event_whenflag", message0: "when 🟢 clicked", nextStatement: null, style: "event_blocks" },
  {
    type: "event_whenkey",
    message0: "when %1 key pressed",
    args0: [{
      type: "field_dropdown", name: "KEY", options: [
        ["space", "space"], ["↑ up arrow", "up"], ["↓ down arrow", "down"],
        ["← left arrow", "left"], ["→ right arrow", "right"],
        ["w", "w"], ["a", "a"], ["s", "s"], ["d", "d"],
      ],
    }],
    nextStatement: null,
    style: "event_blocks",
  },
  // Motion
  { type: "motion_move", message0: "move %1 steps", args0: [{ type: "input_value", name: "STEPS", check: "Number" }], inputsInline: true, previousStatement: null, nextStatement: null, style: "motion_blocks" },
  { type: "motion_turnright", message0: "turn ↻ %1 degrees", args0: [{ type: "input_value", name: "DEG", check: "Number" }], inputsInline: true, previousStatement: null, nextStatement: null, style: "motion_blocks" },
  { type: "motion_turnleft", message0: "turn ↺ %1 degrees", args0: [{ type: "input_value", name: "DEG", check: "Number" }], inputsInline: true, previousStatement: null, nextStatement: null, style: "motion_blocks" },
  { type: "motion_point", message0: "point in direction %1", args0: [{ type: "input_value", name: "DIR", check: "Number" }], inputsInline: true, previousStatement: null, nextStatement: null, style: "motion_blocks" },
  { type: "motion_goto", message0: "go to x %1 y %2", args0: [{ type: "input_value", name: "X", check: "Number" }, { type: "input_value", name: "Y", check: "Number" }], inputsInline: true, previousStatement: null, nextStatement: null, style: "motion_blocks" },
  { type: "motion_changex", message0: "change x by %1", args0: [{ type: "input_value", name: "DX", check: "Number" }], inputsInline: true, previousStatement: null, nextStatement: null, style: "motion_blocks" },
  { type: "motion_changey", message0: "change y by %1", args0: [{ type: "input_value", name: "DY", check: "Number" }], inputsInline: true, previousStatement: null, nextStatement: null, style: "motion_blocks" },
  { type: "motion_glide", message0: "glide %1 secs to x %2 y %3", args0: [{ type: "input_value", name: "SECS", check: "Number" }, { type: "input_value", name: "X", check: "Number" }, { type: "input_value", name: "Y", check: "Number" }], inputsInline: true, previousStatement: null, nextStatement: null, style: "motion_blocks" },
  { type: "motion_bounce", message0: "if on edge, bounce", previousStatement: null, nextStatement: null, style: "motion_blocks" },
  // Looks
  { type: "looks_say", message0: "say %1", args0: [{ type: "input_value", name: "TEXT" }], inputsInline: true, previousStatement: null, nextStatement: null, style: "looks_blocks" },
  { type: "looks_sayfor", message0: "say %1 for %2 secs", args0: [{ type: "input_value", name: "TEXT" }, { type: "input_value", name: "SECS", check: "Number" }], inputsInline: true, previousStatement: null, nextStatement: null, style: "looks_blocks" },
  { type: "looks_think", message0: "think %1", args0: [{ type: "input_value", name: "TEXT" }], inputsInline: true, previousStatement: null, nextStatement: null, style: "looks_blocks" },
  { type: "looks_nextcostume", message0: "next costume", previousStatement: null, nextStatement: null, style: "looks_blocks" },
  { type: "looks_switchcostume", message0: "switch to costume %1", args0: [{ type: "input_value", name: "NUM", check: "Number" }], inputsInline: true, previousStatement: null, nextStatement: null, style: "looks_blocks" },
  { type: "looks_changesize", message0: "change size by %1", args0: [{ type: "input_value", name: "NUM", check: "Number" }], inputsInline: true, previousStatement: null, nextStatement: null, style: "looks_blocks" },
  { type: "looks_setsize", message0: "set size to %1 %", args0: [{ type: "input_value", name: "NUM", check: "Number" }], inputsInline: true, previousStatement: null, nextStatement: null, style: "looks_blocks" },
  { type: "looks_show", message0: "show", previousStatement: null, nextStatement: null, style: "looks_blocks" },
  { type: "looks_hide", message0: "hide", previousStatement: null, nextStatement: null, style: "looks_blocks" },
  // Sound
  { type: "sound_play", message0: "play sound %1", args0: [{ type: "field_dropdown", name: "SOUND", options: SOUND_NAMES.map((n) => [n, n]) }], previousStatement: null, nextStatement: null, style: "sound_blocks" },
  { type: "sound_playuntil", message0: "play sound %1 until done", args0: [{ type: "field_dropdown", name: "SOUND", options: SOUND_NAMES.map((n) => [n, n]) }], previousStatement: null, nextStatement: null, style: "sound_blocks" },
  // Control
  { type: "control_wait", message0: "wait %1 seconds", args0: [{ type: "input_value", name: "SECS", check: "Number" }], inputsInline: true, previousStatement: null, nextStatement: null, style: "control_blocks" },
  { type: "control_repeat", message0: "repeat %1", args0: [{ type: "input_value", name: "TIMES", check: "Number" }], message1: "%1", args1: [{ type: "input_statement", name: "DO" }], previousStatement: null, nextStatement: null, style: "control_blocks" },
  { type: "control_forever", message0: "forever", message1: "%1", args1: [{ type: "input_statement", name: "DO" }], previousStatement: null, style: "control_blocks" },
  { type: "control_if", message0: "if %1 then", args0: [{ type: "input_value", name: "COND", check: "Boolean" }], message1: "%1", args1: [{ type: "input_statement", name: "DO" }], previousStatement: null, nextStatement: null, style: "control_blocks" },
  { type: "control_ifelse", message0: "if %1 then", args0: [{ type: "input_value", name: "COND", check: "Boolean" }], message1: "%1", args1: [{ type: "input_statement", name: "DO" }], message2: "else", message3: "%1", args3: [{ type: "input_statement", name: "ELSE" }], previousStatement: null, nextStatement: null, style: "control_blocks" },
];

let loopSeq = 0;
let registered = false;

export function registerScratchBlocks() {
  if (registered) return;
  registered = true;
  Blockly.defineBlocksWithJsonArray(BLOCKS);
  const G = javascriptGenerator;
  const val = (b: Blockly.Block, n: string) => G.valueToCode(b, n, Order.NONE) || "0";
  const str = (b: Blockly.Block, n: string) => G.valueToCode(b, n, Order.NONE) || "''";

  G.forBlock["event_whenflag"] = () => "";
  G.forBlock["event_whenkey"] = () => "";
  G.forBlock["motion_move"] = (b) => `s.move(${val(b, "STEPS")});\n`;
  G.forBlock["motion_turnright"] = (b) => `s.turnRight(${val(b, "DEG")});\n`;
  G.forBlock["motion_turnleft"] = (b) => `s.turnLeft(${val(b, "DEG")});\n`;
  G.forBlock["motion_point"] = (b) => `s.point(${val(b, "DIR")});\n`;
  G.forBlock["motion_goto"] = (b) => `s.goto(${val(b, "X")},${val(b, "Y")});\n`;
  G.forBlock["motion_changex"] = (b) => `s.changeX(${val(b, "DX")});\n`;
  G.forBlock["motion_changey"] = (b) => `s.changeY(${val(b, "DY")});\n`;
  G.forBlock["motion_glide"] = (b) => `await s.glide(${val(b, "SECS")},${val(b, "X")},${val(b, "Y")});\n`;
  G.forBlock["motion_bounce"] = () => `s.bounce();\n`;

  G.forBlock["looks_say"] = (b) => `s.say(${str(b, "TEXT")});\n`;
  G.forBlock["looks_sayfor"] = (b) => `await s.sayFor(${str(b, "TEXT")},${val(b, "SECS")});\n`;
  G.forBlock["looks_think"] = (b) => `s.think(${str(b, "TEXT")});\n`;
  G.forBlock["looks_nextcostume"] = () => `s.nextCostume();\n`;
  G.forBlock["looks_switchcostume"] = (b) => `s.setCostume(${val(b, "NUM")});\n`;
  G.forBlock["looks_changesize"] = (b) => `s.changeSize(${val(b, "NUM")});\n`;
  G.forBlock["looks_setsize"] = (b) => `s.setSize(${val(b, "NUM")});\n`;
  G.forBlock["looks_show"] = () => `s.show();\n`;
  G.forBlock["looks_hide"] = () => `s.hide();\n`;

  G.forBlock["sound_play"] = (b) => `s.play(${JSON.stringify(b.getFieldValue("SOUND"))});\n`;
  G.forBlock["sound_playuntil"] = (b) => `await s.playUntil(${JSON.stringify(b.getFieldValue("SOUND"))});\n`;

  G.forBlock["control_wait"] = (b) => `await s.wait(${val(b, "SECS")});\n`;
  G.forBlock["control_repeat"] = (b) => {
    const v = "_i" + loopSeq++;
    return `for(let ${v}=0; ${v}<(${val(b, "TIMES")}); ${v}++){\n${G.statementToCode(b, "DO")}await __yield();\n}\n`;
  };
  G.forBlock["control_forever"] = (b) => `while(true){\n${G.statementToCode(b, "DO")}await __yield();\n}\n`;
  G.forBlock["control_if"] = (b) =>
    `if(${G.valueToCode(b, "COND", Order.NONE) || "false"}){\n${G.statementToCode(b, "DO")}}\n`;
  G.forBlock["control_ifelse"] = (b) =>
    `if(${G.valueToCode(b, "COND", Order.NONE) || "false"}){\n${G.statementToCode(b, "DO")}} else {\n${G.statementToCode(b, "ELSE")}}\n`;
}

let themeSingleton: Blockly.Theme | null = null;
export function getScratchTheme(): Blockly.Theme | undefined {
  if (themeSingleton) return themeSingleton;
  const styles = {
    base: Blockly.Themes.Classic,
    fontStyle: { family: "'Fredoka', 'JetBrains Mono', sans-serif", size: 12 },
    componentStyles: {
      workspaceBackgroundColour: "#0a1020",
      toolboxBackgroundColour: "#0c1326",
      toolboxForegroundColour: "#cdd9f0",
      flyoutBackgroundColour: "#0c1326",
      flyoutForegroundColour: "#9fb0d0",
      flyoutOpacity: 0.98,
      scrollbarColour: "#26334f",
      insertionMarkerColour: "#22d3ee",
      insertionMarkerOpacity: 0.5,
      cursorColour: "#22d3ee",
      selectedGlowColour: "#22d3ee",
      gridColour: "#16223c",
    },
    blockStyles: {
      event_blocks: { colourPrimary: "#f59e0b", colourSecondary: "#c97f0a", colourTertiary: "#e0930b" },
      motion_blocks: { colourPrimary: "#22d3ee", colourSecondary: "#1593a8", colourTertiary: "#1bb3cf" },
      looks_blocks: { colourPrimary: "#a855f7", colourSecondary: "#7d3fbb", colourTertiary: "#9148da" },
      sound_blocks: { colourPrimary: "#ec4899", colourSecondary: "#b32f72", colourTertiary: "#d23d88" },
      control_blocks: { colourPrimary: "#34d399", colourSecondary: "#1f8f68", colourTertiary: "#2bb583" },
      logic_blocks: { colourPrimary: "#2dd4bf", colourSecondary: "#1d9486", colourTertiary: "#24b3a2" },
      math_blocks: { colourPrimary: "#2dd4bf", colourSecondary: "#1d9486", colourTertiary: "#24b3a2" },
      text_blocks: { colourPrimary: "#fb923c", colourSecondary: "#c56f28", colourTertiary: "#e08234" },
      variable_blocks: { colourPrimary: "#fb923c", colourSecondary: "#c56f28", colourTertiary: "#e08234" },
    },
    categoryStyles: {
      event_category: { colour: "#f59e0b" },
      motion_category: { colour: "#22d3ee" },
      looks_category: { colour: "#a855f7" },
      sound_category: { colour: "#ec4899" },
      control_category: { colour: "#34d399" },
      operator_category: { colour: "#2dd4bf" },
      variable_category: { colour: "#fb923c" },
    },
    name: "scratchcosmic",
  } as unknown as Parameters<typeof Blockly.Theme.defineTheme>[1];
  try {
    themeSingleton = Blockly.Theme.defineTheme("scratchcosmic", styles);
  } catch {
    themeSingleton = Blockly.Themes.Classic;
  }
  return themeSingleton ?? undefined;
}

export const SCRATCH_TOOLBOX = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category", name: "🟢 Events", categorystyle: "event_category",
      contents: [
        { kind: "block", type: "event_whenflag" },
        { kind: "block", type: "event_whenkey" },
      ],
    },
    {
      kind: "category", name: "🏃 Motion", categorystyle: "motion_category",
      contents: [
        { kind: "block", type: "motion_move", inputs: { STEPS: num(10) } },
        { kind: "block", type: "motion_turnright", inputs: { DEG: num(15) } },
        { kind: "block", type: "motion_turnleft", inputs: { DEG: num(15) } },
        { kind: "block", type: "motion_point", inputs: { DIR: num(90) } },
        { kind: "block", type: "motion_goto", inputs: { X: num(0), Y: num(0) } },
        { kind: "block", type: "motion_changex", inputs: { DX: num(10) } },
        { kind: "block", type: "motion_changey", inputs: { DY: num(10) } },
        { kind: "block", type: "motion_glide", inputs: { SECS: num(1), X: num(0), Y: num(0) } },
        { kind: "block", type: "motion_bounce" },
      ],
    },
    {
      kind: "category", name: "🎨 Looks", categorystyle: "looks_category",
      contents: [
        { kind: "block", type: "looks_say", inputs: { TEXT: txt("Hello!") } },
        { kind: "block", type: "looks_sayfor", inputs: { TEXT: txt("Hello!"), SECS: num(2) } },
        { kind: "block", type: "looks_think", inputs: { TEXT: txt("Hmm…") } },
        { kind: "block", type: "looks_nextcostume" },
        { kind: "block", type: "looks_switchcostume", inputs: { NUM: num(1) } },
        { kind: "block", type: "looks_changesize", inputs: { NUM: num(10) } },
        { kind: "block", type: "looks_setsize", inputs: { NUM: num(100) } },
        { kind: "block", type: "looks_show" },
        { kind: "block", type: "looks_hide" },
      ],
    },
    {
      kind: "category", name: "🔊 Sound", categorystyle: "sound_category",
      contents: [
        { kind: "block", type: "sound_play" },
        { kind: "block", type: "sound_playuntil" },
      ],
    },
    {
      kind: "category", name: "🔁 Control", categorystyle: "control_category",
      contents: [
        { kind: "block", type: "control_wait", inputs: { SECS: num(1) } },
        { kind: "block", type: "control_repeat", inputs: { TIMES: num(10) } },
        { kind: "block", type: "control_forever" },
        { kind: "block", type: "control_if" },
        { kind: "block", type: "control_ifelse" },
      ],
    },
    {
      kind: "category", name: "🧮 Operators", categorystyle: "operator_category",
      contents: [
        { kind: "block", type: "math_number", fields: { NUM: 0 } },
        { kind: "block", type: "math_arithmetic" },
        { kind: "block", type: "math_random_int", inputs: { FROM: num(1), TO: num(10) } },
        { kind: "block", type: "logic_compare" },
        { kind: "block", type: "logic_operation" },
        { kind: "block", type: "logic_boolean" },
        { kind: "block", type: "text", fields: { TEXT: "hello" } },
      ],
    },
    { kind: "category", name: "📦 Variables", categorystyle: "variable_category", custom: "VARIABLE" },
  ],
};

/** Toolbox scaled to a class: younger classes see fewer categories, older
 *  classes unlock Control → Sound → Operators → Variables. */
export function scratchToolboxForGrade(g: number) {
  const want = (name: string) => {
    if (name.includes("Control")) return g >= 3;
    if (name.includes("Sound")) return g >= 4;
    if (name.includes("Operators")) return g >= 6;
    if (name.includes("Variables")) return g >= 8;
    return true; // Events, Motion, Looks are always available
  };
  const contents = (SCRATCH_TOOLBOX.contents as { name?: string }[]).filter((c) => want(c.name || ""));
  return { kind: "categoryToolbox", contents } as unknown as Blockly.utils.toolbox.ToolboxDefinition;
}

