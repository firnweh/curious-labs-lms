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
  { type: "motion_setx", message0: "set x to %1", args0: [{ type: "input_value", name: "X", check: "Number" }], inputsInline: true, previousStatement: null, nextStatement: null, style: "motion_blocks" },
  { type: "motion_sety", message0: "set y to %1", args0: [{ type: "input_value", name: "Y", check: "Number" }], inputsInline: true, previousStatement: null, nextStatement: null, style: "motion_blocks" },
  { type: "motion_glide", message0: "glide %1 secs to x %2 y %3", args0: [{ type: "input_value", name: "SECS", check: "Number" }, { type: "input_value", name: "X", check: "Number" }, { type: "input_value", name: "Y", check: "Number" }], inputsInline: true, previousStatement: null, nextStatement: null, style: "motion_blocks" },
  { type: "motion_bounce", message0: "if on edge, bounce", previousStatement: null, nextStatement: null, style: "motion_blocks" },
  { type: "motion_gotomenu", message0: "go to %1", args0: [{ type: "field_dropdown", name: "TO", options: [["random position", "random"], ["mouse-pointer", "mouse"]] }], previousStatement: null, nextStatement: null, style: "motion_blocks" },
  { type: "motion_glidetomenu", message0: "glide %1 secs to %2", args0: [{ type: "input_value", name: "SECS", check: "Number" }, { type: "field_dropdown", name: "TO", options: [["random position", "random"], ["mouse-pointer", "mouse"]] }], inputsInline: true, previousStatement: null, nextStatement: null, style: "motion_blocks" },
  { type: "motion_pointtowards", message0: "point towards %1", args0: [{ type: "field_dropdown", name: "TO", options: [["mouse-pointer", "mouse"]] }], previousStatement: null, nextStatement: null, style: "motion_blocks" },
  // Sensing (reporters + booleans)
  { type: "sensing_mousex", message0: "mouse x", output: "Number", style: "sensing_blocks" },
  { type: "sensing_mousey", message0: "mouse y", output: "Number", style: "sensing_blocks" },
  { type: "sensing_mousedown", message0: "mouse down?", output: "Boolean", style: "sensing_blocks" },
  { type: "sensing_keypressed", message0: "key %1 pressed?", args0: [{ type: "field_dropdown", name: "KEY", options: [["space", "space"], ["↑ up", "up"], ["↓ down", "down"], ["← left", "left"], ["→ right", "right"], ["w", "w"], ["a", "a"], ["s", "s"], ["d", "d"]] }], output: "Boolean", style: "sensing_blocks" },
  { type: "sensing_timer", message0: "timer", output: "Number", style: "sensing_blocks" },
  { type: "sensing_resettimer", message0: "reset timer", previousStatement: null, nextStatement: null, style: "sensing_blocks" },
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
  G.forBlock["motion_setx"] = (b) => `s.setX(${val(b, "X")});\n`;
  G.forBlock["motion_sety"] = (b) => `s.setY(${val(b, "Y")});\n`;
  G.forBlock["motion_glide"] = (b) => `await s.glide(${val(b, "SECS")},${val(b, "X")},${val(b, "Y")});\n`;
  G.forBlock["motion_bounce"] = () => `s.bounce();\n`;
  G.forBlock["motion_gotomenu"] = (b) => `s.gotoTarget(${JSON.stringify(b.getFieldValue("TO"))});\n`;
  G.forBlock["motion_glidetomenu"] = (b) => `await s.glideTarget(${val(b, "SECS")},${JSON.stringify(b.getFieldValue("TO"))});\n`;
  G.forBlock["motion_pointtowards"] = (b) => `s.pointToward(${JSON.stringify(b.getFieldValue("TO"))});\n`;

  G.forBlock["sensing_mousex"] = () => ["s.mouseX()", Order.ATOMIC];
  G.forBlock["sensing_mousey"] = () => ["s.mouseY()", Order.ATOMIC];
  G.forBlock["sensing_mousedown"] = () => ["s.mouseDown()", Order.ATOMIC];
  G.forBlock["sensing_keypressed"] = (b) => [`s.keyDown(${JSON.stringify(b.getFieldValue("KEY"))})`, Order.ATOMIC];
  G.forBlock["sensing_timer"] = () => ["s.timer()", Order.ATOMIC];
  G.forBlock["sensing_resettimer"] = () => `s.resetTimer();\n`;

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

  // My Blocks (custom procedures): emit ASYNC functions + awaited calls so that
  // wait / glide / say-for work correctly inside a custom block.
  type ProcGen = {
    nameDB_: { getName(n: string, t: string): string };
    definitions_: Record<string, string>;
    statementToCode(b: Blockly.Block, n: string): string;
  };
  const procName = (b: Blockly.Block) =>
    (G as unknown as ProcGen).nameDB_.getName(b.getFieldValue("NAME") || "myBlock", "PROCEDURE");
  G.forBlock["procedures_defnoreturn"] = (b) => {
    const g = G as unknown as ProcGen;
    const name = procName(b);
    const branch = g.statementToCode(b, "STACK");
    const args = (b as unknown as { getVars(): string[] }).getVars().map((v) => g.nameDB_.getName(v, "VARIABLE"));
    g.definitions_["%" + name] = `async function ${name}(${args.join(", ")}) {\n${branch}}`;
    return null;
  };
  G.forBlock["procedures_callnoreturn"] = (b) => {
    const name = procName(b);
    const vars = (b as unknown as { arguments_?: string[] }).arguments_ || [];
    const args = vars.map((_, i) => G.valueToCode(b, "ARG" + i, Order.NONE) || "null");
    return `await ${name}(${args.join(", ")});\n`;
  };
}

let themeSingleton: Blockly.Theme | null = null;
export function getScratchTheme(): Blockly.Theme | undefined {
  if (themeSingleton) return themeSingleton;
  const styles = {
    base: Blockly.Themes.Classic,
    fontStyle: { family: "var(--font-round), 'Trebuchet MS', 'Helvetica Neue', sans-serif", size: 12, weight: "600" },
    componentStyles: {
      workspaceBackgroundColour: "#0e1530",
      toolboxBackgroundColour: "#0c1228",
      toolboxForegroundColour: "#c9d3ea",
      flyoutBackgroundColour: "#0a0f24",
      flyoutForegroundColour: "#c9d3ea",
      flyoutOpacity: 0.96,
      scrollbarColour: "#2a3550",
      insertionMarkerColour: "#ffffff",
      insertionMarkerOpacity: 0.3,
      cursorColour: "#22d3ee",
      selectedGlowColour: "#22d3ee",
      gridColour: "#1b2748",
    },
    blockStyles: {
      event_blocks: { colourPrimary: "#FFBF00", colourSecondary: "#E6AC00", colourTertiary: "#CC9900" },
      motion_blocks: { colourPrimary: "#4C97FF", colourSecondary: "#4280D7", colourTertiary: "#3373CC" },
      looks_blocks: { colourPrimary: "#9966FF", colourSecondary: "#855CD6", colourTertiary: "#774DCB" },
      sound_blocks: { colourPrimary: "#CF63CF", colourSecondary: "#C94FC9", colourTertiary: "#BD42BD" },
      control_blocks: { colourPrimary: "#FFAB19", colourSecondary: "#EC9C13", colourTertiary: "#CF8B17" },
      logic_blocks: { colourPrimary: "#59C059", colourSecondary: "#46B946", colourTertiary: "#389438" },
      math_blocks: { colourPrimary: "#59C059", colourSecondary: "#46B946", colourTertiary: "#389438" },
      text_blocks: { colourPrimary: "#59C059", colourSecondary: "#46B946", colourTertiary: "#389438" },
      variable_blocks: { colourPrimary: "#FF8C1A", colourSecondary: "#FF8000", colourTertiary: "#DB6E00" },
      sensing_blocks: { colourPrimary: "#5CB1D6", colourSecondary: "#47A8D1", colourTertiary: "#2E8EB8" },
      procedure_blocks: { colourPrimary: "#FF6680", colourSecondary: "#FF4D6A", colourTertiary: "#FF3355" },
    },
    categoryStyles: {
      event_category: { colour: "#FFBF00" },
      motion_category: { colour: "#4C97FF" },
      looks_category: { colour: "#9966FF" },
      sound_category: { colour: "#CF63CF" },
      control_category: { colour: "#FFAB19" },
      sensing_category: { colour: "#5CB1D6" },
      operator_category: { colour: "#59C059" },
      variable_category: { colour: "#FF8C1A" },
      procedure_category: { colour: "#FF6680" },
    },
    name: "scratchclassic",
  } as unknown as Parameters<typeof Blockly.Theme.defineTheme>[1];
  try {
    themeSingleton = Blockly.Theme.defineTheme("scratchclassic", styles);
  } catch {
    themeSingleton = Blockly.Themes.Classic;
  }
  return themeSingleton ?? undefined;
}

export const SCRATCH_TOOLBOX = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category", name: "Events", categorystyle: "event_category", cssconfig: { icon: "cl-ic cl-events" },
      contents: [
        { kind: "block", type: "event_whenflag" },
        { kind: "block", type: "event_whenkey" },
      ],
    },
    {
      kind: "category", name: "Motion", categorystyle: "motion_category", cssconfig: { icon: "cl-ic cl-motion" },
      contents: [
        { kind: "block", type: "motion_move", inputs: { STEPS: num(10) } },
        { kind: "block", type: "motion_turnright", inputs: { DEG: num(15) } },
        { kind: "block", type: "motion_turnleft", inputs: { DEG: num(15) } },
        { kind: "block", type: "motion_point", inputs: { DIR: num(90) } },
        { kind: "block", type: "motion_goto", inputs: { X: num(0), Y: num(0) } },
        { kind: "block", type: "motion_changex", inputs: { DX: num(10) } },
        { kind: "block", type: "motion_changey", inputs: { DY: num(10) } },
        { kind: "block", type: "motion_setx", inputs: { X: num(0) } },
        { kind: "block", type: "motion_sety", inputs: { Y: num(0) } },
        { kind: "block", type: "motion_glide", inputs: { SECS: num(1), X: num(0), Y: num(0) } },
        { kind: "block", type: "motion_glidetomenu", inputs: { SECS: num(1) } },
        { kind: "block", type: "motion_gotomenu" },
        { kind: "block", type: "motion_pointtowards" },
        { kind: "block", type: "motion_bounce" },
      ],
    },
    {
      kind: "category", name: "Looks", categorystyle: "looks_category", cssconfig: { icon: "cl-ic cl-looks" },
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
      kind: "category", name: "Sound", categorystyle: "sound_category", cssconfig: { icon: "cl-ic cl-sound" },
      contents: [
        { kind: "block", type: "sound_play" },
        { kind: "block", type: "sound_playuntil" },
      ],
    },
    {
      kind: "category", name: "Control", categorystyle: "control_category", cssconfig: { icon: "cl-ic cl-control" },
      contents: [
        { kind: "block", type: "control_wait", inputs: { SECS: num(1) } },
        { kind: "block", type: "control_repeat", inputs: { TIMES: num(10) } },
        { kind: "block", type: "control_forever" },
        { kind: "block", type: "control_if" },
        { kind: "block", type: "control_ifelse" },
      ],
    },
    {
      kind: "category", name: "Sensing", categorystyle: "sensing_category", cssconfig: { icon: "cl-ic cl-sensing" },
      contents: [
        { kind: "block", type: "sensing_mousex" },
        { kind: "block", type: "sensing_mousey" },
        { kind: "block", type: "sensing_mousedown" },
        { kind: "block", type: "sensing_keypressed" },
        { kind: "block", type: "sensing_timer" },
        { kind: "block", type: "sensing_resettimer" },
      ],
    },
    {
      kind: "category", name: "Operators", categorystyle: "operator_category", cssconfig: { icon: "cl-ic cl-operators" },
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
    { kind: "category", name: "Variables", categorystyle: "variable_category", cssconfig: { icon: "cl-ic cl-variables" }, custom: "VARIABLE" },
    { kind: "category", name: "My Blocks", categorystyle: "procedure_category", cssconfig: { icon: "cl-ic cl-myblocks" }, custom: "PROCEDURE" },
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

