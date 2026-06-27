"use client";

import * as Blockly from "blockly";

/* ──────────────────────────────────────────────────────────────────────────
   A block set + Arduino/C++ code generator on Blockly. Blocks model the real
   Arduino API (pinMode / digitalWrite / analogRead / Serial / delay …) plus
   friendly component + Wi-Fi blocks. The generator emits a complete .ino:
   #includes → globals → setup() → loop(). Built-in control/logic/math/variable
   blocks get their own C++ generators here (variables are int for v1).
   ────────────────────────────────────────────────────────────────────────── */

const num = (n: number) => ({ shadow: { type: "math_number", fields: { NUM: n } } });
const txt = (t: string) => ({ shadow: { type: "text", fields: { TEXT: t } } });

const PIN_OPTIONS: [string, string][] = [
  ["D2", "2"], ["D3", "3"], ["D4", "4"], ["D5", "5"], ["D6", "6"], ["D7", "7"],
  ["D8", "8"], ["D9", "9"], ["D10", "10"], ["D11", "11"], ["D12", "12"], ["D13 (LED)", "13"],
  ["A0", "A0"], ["A1", "A1"], ["A2", "A2"], ["A3", "A3"],
];

const BLOCKS = [
  // ── Structure ──
  {
    type: "arduino_sketch",
    message0: "⚙️ Arduino sketch", message1: "setup — runs once %1", args1: [{ type: "input_statement", name: "SETUP" }],
    message2: "loop — runs forever %1", args2: [{ type: "input_statement", name: "LOOP" }],
    style: "struct_blocks",
  },
  // ── Pins ──
  {
    type: "arduino_pinmode",
    message0: "set pin %1 as %2",
    args0: [
      { type: "field_dropdown", name: "PIN", options: PIN_OPTIONS },
      { type: "field_dropdown", name: "MODE", options: [["OUTPUT", "OUTPUT"], ["INPUT", "INPUT"], ["INPUT_PULLUP", "INPUT_PULLUP"]] },
    ],
    previousStatement: null, nextStatement: null, style: "pin_blocks",
  },
  { type: "arduino_highlow", message0: "%1", args0: [{ type: "field_dropdown", name: "STATE", options: [["HIGH", "HIGH"], ["LOW", "LOW"]] }], output: null, style: "pin_blocks" },
  // ── Output ──
  {
    type: "arduino_digitalwrite",
    message0: "digital write pin %1 %2",
    args0: [{ type: "field_dropdown", name: "PIN", options: PIN_OPTIONS }, { type: "field_dropdown", name: "STATE", options: [["HIGH", "HIGH"], ["LOW", "LOW"]] }],
    previousStatement: null, nextStatement: null, style: "out_blocks",
  },
  {
    type: "arduino_analogwrite",
    message0: "analog (PWM) write pin %1 value %2",
    args0: [{ type: "field_dropdown", name: "PIN", options: PIN_OPTIONS }, { type: "input_value", name: "VAL", check: "Number" }],
    inputsInline: true, previousStatement: null, nextStatement: null, style: "out_blocks",
  },
  {
    type: "arduino_tone",
    message0: "play tone on pin %1 frequency %2 Hz",
    args0: [{ type: "field_dropdown", name: "PIN", options: PIN_OPTIONS }, { type: "input_value", name: "FREQ", check: "Number" }],
    inputsInline: true, previousStatement: null, nextStatement: null, style: "out_blocks",
  },
  // ── Input ──
  { type: "arduino_digitalread", message0: "digital read pin %1", args0: [{ type: "field_dropdown", name: "PIN", options: PIN_OPTIONS }], output: "Boolean", style: "in_blocks" },
  { type: "arduino_analogread", message0: "analog read pin %1", args0: [{ type: "field_dropdown", name: "PIN", options: PIN_OPTIONS }], output: "Number", style: "in_blocks" },
  // ── Control ──
  { type: "arduino_delay", message0: "wait %1 milliseconds", args0: [{ type: "input_value", name: "MS", check: "Number" }], inputsInline: true, previousStatement: null, nextStatement: null, style: "ctrl_blocks" },
  { type: "arduino_millis", message0: "milliseconds since start", output: "Number", style: "ctrl_blocks" },
  // ── Serial ──
  { type: "arduino_serial_begin", message0: "start Serial at %1 baud", args0: [{ type: "field_dropdown", name: "BAUD", options: [["9600", "9600"], ["115200", "115200"], ["57600", "57600"]] }], previousStatement: null, nextStatement: null, style: "serial_blocks" },
  {
    type: "arduino_serial_print",
    message0: "Serial print %1 %2",
    args0: [{ type: "input_value", name: "TEXT" }, { type: "field_dropdown", name: "NL", options: [["+ new line", "ln"], ["same line", "no"]] }],
    inputsInline: true, previousStatement: null, nextStatement: null, style: "serial_blocks",
  },
  // ── Components ──
  { type: "arduino_led", message0: "LED on pin %1 %2", args0: [{ type: "field_dropdown", name: "PIN", options: PIN_OPTIONS }, { type: "field_dropdown", name: "STATE", options: [["on", "HIGH"], ["off", "LOW"]] }], previousStatement: null, nextStatement: null, style: "comp_blocks" },
  { type: "arduino_button", message0: "button on pin %1 is pressed", args0: [{ type: "field_dropdown", name: "PIN", options: PIN_OPTIONS }], output: "Boolean", style: "comp_blocks" },
  {
    type: "arduino_servo",
    message0: "set servo on pin %1 to %2 degrees",
    args0: [{ type: "field_dropdown", name: "PIN", options: PIN_OPTIONS }, { type: "input_value", name: "ANGLE", check: "Number" }],
    inputsInline: true, previousStatement: null, nextStatement: null, style: "comp_blocks",
  },
  {
    type: "arduino_map",
    message0: "map %1 from %2 - %3 to %4 - %5",
    args0: [
      { type: "input_value", name: "VAL", check: "Number" }, { type: "input_value", name: "FL", check: "Number" }, { type: "input_value", name: "FH", check: "Number" },
      { type: "input_value", name: "TL", check: "Number" }, { type: "input_value", name: "TH", check: "Number" },
    ],
    inputsInline: true, output: "Number", style: "comp_blocks",
  },
  // ── Components ──
  {
    type: "arduino_rgbled",
    message0: "RGB LED  R pin %1 G pin %2 B pin %3 to  R %4 G %5 B %6",
    args0: [
      { type: "field_dropdown", name: "RPIN", options: PIN_OPTIONS }, { type: "field_dropdown", name: "GPIN", options: PIN_OPTIONS }, { type: "field_dropdown", name: "BPIN", options: PIN_OPTIONS },
      { type: "input_value", name: "R", check: "Number" }, { type: "input_value", name: "G", check: "Number" }, { type: "input_value", name: "B", check: "Number" },
    ],
    inputsInline: true, previousStatement: null, nextStatement: null, style: "comp_blocks",
  },
  { type: "arduino_buzzer", message0: "buzzer pin %1 play %2 Hz for %3 ms", args0: [{ type: "field_dropdown", name: "PIN", options: PIN_OPTIONS }, { type: "input_value", name: "FREQ", check: "Number" }, { type: "input_value", name: "DUR", check: "Number" }], inputsInline: true, previousStatement: null, nextStatement: null, style: "comp_blocks" },
  // ── Sensors ──
  { type: "sensor_ultrasonic", message0: "📏 distance (cm)  trig %1 echo %2", args0: [{ type: "field_dropdown", name: "TRIG", options: PIN_OPTIONS }, { type: "field_dropdown", name: "ECHO", options: PIN_OPTIONS }], output: "Number", style: "sensor_blocks" },
  { type: "sensor_pir", message0: "🚶 motion detected on pin %1", args0: [{ type: "field_dropdown", name: "PIN", options: PIN_OPTIONS }], output: "Boolean", style: "sensor_blocks" },
  { type: "sensor_ir", message0: "🚧 obstacle near IR pin %1", args0: [{ type: "field_dropdown", name: "PIN", options: PIN_OPTIONS }], output: "Boolean", style: "sensor_blocks" },
  { type: "sensor_soil", message0: "🌱 soil moisture on pin %1", args0: [{ type: "field_dropdown", name: "PIN", options: PIN_OPTIONS }], output: "Number", style: "sensor_blocks" },
  { type: "sensor_ldr", message0: "☀️ light level on pin %1", args0: [{ type: "field_dropdown", name: "PIN", options: PIN_OPTIONS }], output: "Number", style: "sensor_blocks" },
  { type: "sensor_pot", message0: "🎚️ knob (potentiometer) on pin %1", args0: [{ type: "field_dropdown", name: "PIN", options: PIN_OPTIONS }], output: "Number", style: "sensor_blocks" },
  {
    type: "sensor_dht",
    message0: "🌡️ %1 from %2 sensor on pin %3",
    args0: [
      { type: "field_dropdown", name: "READ", options: [["temperature °C", "Temperature"], ["humidity %", "Humidity"]] },
      { type: "field_dropdown", name: "MODEL", options: [["DHT11", "DHT11"], ["DHT22", "DHT22"]] },
      { type: "field_dropdown", name: "PIN", options: PIN_OPTIONS },
    ],
    output: "Number", style: "sensor_blocks",
  },
  { type: "sensor_button", message0: "🔘 button on pin %1 pressed", args0: [{ type: "field_dropdown", name: "PIN", options: PIN_OPTIONS }], output: "Boolean", style: "sensor_blocks" },
  { type: "sensor_flame", message0: "🔥 flame near pin %1", args0: [{ type: "field_dropdown", name: "PIN", options: PIN_OPTIONS }], output: "Boolean", style: "sensor_blocks" },
  { type: "sensor_touch", message0: "✋ touch on pin %1", args0: [{ type: "field_dropdown", name: "PIN", options: PIN_OPTIONS }], output: "Boolean", style: "sensor_blocks" },
  { type: "sensor_tilt", message0: "📐 tilted on pin %1", args0: [{ type: "field_dropdown", name: "PIN", options: PIN_OPTIONS }], output: "Boolean", style: "sensor_blocks" },
  { type: "sensor_water", message0: "💧 water level on pin %1", args0: [{ type: "field_dropdown", name: "PIN", options: PIN_OPTIONS }], output: "Number", style: "sensor_blocks" },
  { type: "sensor_gas", message0: "💨 gas level on pin %1", args0: [{ type: "field_dropdown", name: "PIN", options: PIN_OPTIONS }], output: "Number", style: "sensor_blocks" },
  { type: "sensor_rain", message0: "🌧️ rain level on pin %1", args0: [{ type: "field_dropdown", name: "PIN", options: PIN_OPTIONS }], output: "Number", style: "sensor_blocks" },
  { type: "sensor_sound", message0: "🎤 sound level on pin %1", args0: [{ type: "field_dropdown", name: "PIN", options: PIN_OPTIONS }], output: "Number", style: "sensor_blocks" },
  { type: "sensor_temp", message0: "🌡️ temperature °C (LM35) on pin %1", args0: [{ type: "field_dropdown", name: "PIN", options: PIN_OPTIONS }], output: "Number", style: "sensor_blocks" },
  { type: "arduino_relay", message0: "🔀 relay pin %1 %2", args0: [{ type: "field_dropdown", name: "PIN", options: PIN_OPTIONS }, { type: "field_dropdown", name: "STATE", options: [["ON", "HIGH"], ["OFF", "LOW"]] }], previousStatement: null, nextStatement: null, style: "comp_blocks" },
  // ── Wi-Fi (ESP) ──
  {
    type: "esp_wifi_connect",
    message0: "connect Wi-Fi  network %1 password %2",
    args0: [{ type: "input_value", name: "SSID" }, { type: "input_value", name: "PASS" }],
    inputsInline: false, previousStatement: null, nextStatement: null, style: "wifi_blocks",
  },
];

/* ── Theme: an electronics palette ── */
let themeSingleton: Blockly.Theme | null = null;
export function arduinoTheme(): Blockly.Theme | undefined {
  if (themeSingleton) return themeSingleton;
  const styles = {
    base: Blockly.Themes.Classic,
    fontStyle: { family: "var(--font-grotesk), ui-sans-serif, system-ui, sans-serif", size: 13, weight: "600" },
    componentStyles: {
      workspaceBackgroundColour: "#0a0f1e",
      toolboxBackgroundColour: "#0b1020",
      toolboxForegroundColour: "#aeb9da",
      flyoutBackgroundColour: "#0b1020",
      flyoutForegroundColour: "#aeb9da",
      flyoutOpacity: 0.96,
      scrollbarColour: "#2a3552",
      scrollbarOpacity: 0.5,
      insertionMarkerColour: "#22d3ee",
      insertionMarkerOpacity: 0.5,
      markerColour: "#22d3ee",
      cursorColour: "#22d3ee",
      selectedGlowColour: "#22d3ee",
      selectedGlowOpacity: 0.5,
      replacementGlowColour: "#22d3ee",
      replacementGlowOpacity: 0.4,
      gridColour: "#16233a",
    },
    blockStyles: {
      struct_blocks: { colourPrimary: "#475569", colourSecondary: "#334155", colourTertiary: "#1e293b" },
      pin_blocks: { colourPrimary: "#0ea5e9", colourSecondary: "#0284c7", colourTertiary: "#0369a1" },
      out_blocks: { colourPrimary: "#22c55e", colourSecondary: "#16a34a", colourTertiary: "#15803d" },
      in_blocks: { colourPrimary: "#a855f7", colourSecondary: "#9333ea", colourTertiary: "#7e22ce" },
      ctrl_blocks: { colourPrimary: "#f59e0b", colourSecondary: "#d97706", colourTertiary: "#b45309" },
      serial_blocks: { colourPrimary: "#14b8a6", colourSecondary: "#0d9488", colourTertiary: "#0f766e" },
      comp_blocks: { colourPrimary: "#ec4899", colourSecondary: "#db2777", colourTertiary: "#be185d" },
      sensor_blocks: { colourPrimary: "#ef4444", colourSecondary: "#dc2626", colourTertiary: "#b91c1c" },
      wifi_blocks: { colourPrimary: "#6366f1", colourSecondary: "#4f46e5", colourTertiary: "#4338ca" },
      logic_blocks: { colourPrimary: "#84cc16", colourSecondary: "#65a30d", colourTertiary: "#4d7c0f" },
      math_blocks: { colourPrimary: "#84cc16", colourSecondary: "#65a30d", colourTertiary: "#4d7c0f" },
      text_blocks: { colourPrimary: "#84cc16", colourSecondary: "#65a30d", colourTertiary: "#4d7c0f" },
      variable_blocks: { colourPrimary: "#f97316", colourSecondary: "#ea580c", colourTertiary: "#c2410c" },
    },
    name: "arduinodark",
  } as unknown as Parameters<typeof Blockly.Theme.defineTheme>[1];
  try {
    themeSingleton = Blockly.Theme.defineTheme("arduinodark", styles);
  } catch {
    themeSingleton = Blockly.Themes.Classic;
  }
  return themeSingleton ?? undefined;
}

export const ARDUINO_TOOLBOX = {
  kind: "categoryToolbox",
  contents: [
    { kind: "category", name: "⚙️ Structure", colour: "#475569", contents: [{ kind: "block", type: "arduino_sketch" }] },
    {
      kind: "category", name: "📌 Pins", colour: "#0ea5e9", contents: [
        { kind: "block", type: "arduino_pinmode" },
        { kind: "block", type: "arduino_highlow" },
      ],
    },
    {
      kind: "category", name: "💡 Output", colour: "#22c55e", contents: [
        { kind: "block", type: "arduino_digitalwrite" },
        { kind: "block", type: "arduino_analogwrite", inputs: { VAL: num(128) } },
        { kind: "block", type: "arduino_tone", inputs: { FREQ: num(440) } },
        { kind: "block", type: "arduino_led" },
      ],
    },
    {
      kind: "category", name: "🎛️ Input", colour: "#a855f7", contents: [
        { kind: "block", type: "arduino_digitalread" },
        { kind: "block", type: "arduino_analogread" },
        { kind: "block", type: "arduino_button" },
      ],
    },
    {
      kind: "category", name: "🔁 Control", colour: "#f59e0b", contents: [
        { kind: "block", type: "arduino_delay", inputs: { MS: num(1000) } },
        { kind: "block", type: "controls_if" },
        { kind: "block", type: "controls_repeat_ext", inputs: { TIMES: num(10) } },
        { kind: "block", type: "controls_whileUntil" },
        { kind: "block", type: "arduino_millis" },
      ],
    },
    {
      kind: "category", name: "🧮 Logic & Math", colour: "#84cc16", contents: [
        { kind: "block", type: "logic_compare" },
        { kind: "block", type: "logic_operation" },
        { kind: "block", type: "logic_negate" },
        { kind: "block", type: "logic_boolean" },
        { kind: "block", type: "math_number", fields: { NUM: 0 } },
        { kind: "block", type: "math_arithmetic", inputs: { A: num(1), B: num(1) } },
        { kind: "block", type: "arduino_map", inputs: { VAL: num(0), FL: num(0), FH: num(1023), TL: num(0), TH: num(255) } },
      ],
    },
    {
      kind: "category", name: "🔌 Serial", colour: "#14b8a6", contents: [
        { kind: "block", type: "arduino_serial_begin" },
        { kind: "block", type: "arduino_serial_print", inputs: { TEXT: txt("Hello") } },
      ],
    },
    {
      kind: "category", name: "🧩 Components", colour: "#ec4899", contents: [
        { kind: "block", type: "arduino_servo", inputs: { ANGLE: num(90) } },
        { kind: "block", type: "arduino_rgbled", inputs: { R: num(255), G: num(0), B: num(0) } },
        { kind: "block", type: "arduino_buzzer", inputs: { FREQ: num(440), DUR: num(200) } },
        { kind: "block", type: "arduino_relay" },
      ],
    },
    {
      kind: "category", name: "📡 Sensors", colour: "#ef4444", contents: [
        { kind: "block", type: "sensor_ultrasonic" },
        { kind: "block", type: "sensor_pir" },
        { kind: "block", type: "sensor_ir" },
        { kind: "block", type: "sensor_soil" },
        { kind: "block", type: "sensor_ldr" },
        { kind: "block", type: "sensor_pot" },
        { kind: "block", type: "sensor_dht" },
        { kind: "block", type: "sensor_temp" },
        { kind: "block", type: "sensor_button" },
        { kind: "block", type: "sensor_flame" },
        { kind: "block", type: "sensor_touch" },
        { kind: "block", type: "sensor_tilt" },
        { kind: "block", type: "sensor_water" },
        { kind: "block", type: "sensor_gas" },
        { kind: "block", type: "sensor_rain" },
        { kind: "block", type: "sensor_sound" },
      ],
    },
    {
      kind: "category", name: "📶 Wi-Fi", colour: "#6366f1", contents: [
        { kind: "block", type: "esp_wifi_connect", inputs: { SSID: txt("MyWiFi"), PASS: txt("password") } },
      ],
    },
    { kind: "category", name: "📦 Variables", colour: "#f97316", custom: "VARIABLE" },
    { kind: "category", name: "🔤 Text", colour: "#84cc16", contents: [{ kind: "block", type: "text", fields: { TEXT: "" } }] },
  ],
};

/* ── Arduino / C++ generator ── */
type Gen = Blockly.Generator & {
  definitions_: Record<string, string>;
  globals_: Record<string, string>;
  setups_: Record<string, string>;
  ORDER_ATOMIC: number; ORDER_UNARY: number; ORDER_MUL: number; ORDER_ADD: number;
  ORDER_RELATIONAL: number; ORDER_EQUALITY: number; ORDER_AND: number; ORDER_OR: number; ORDER_NONE: number;
};

export const arduinoGenerator = new Blockly.Generator("Arduino") as Gen;
arduinoGenerator.ORDER_ATOMIC = 0;
arduinoGenerator.ORDER_UNARY = 2;
arduinoGenerator.ORDER_MUL = 3;
arduinoGenerator.ORDER_ADD = 4;
arduinoGenerator.ORDER_RELATIONAL = 6;
arduinoGenerator.ORDER_EQUALITY = 7;
arduinoGenerator.ORDER_AND = 11;
arduinoGenerator.ORDER_OR = 12;
arduinoGenerator.ORDER_NONE = 99;

arduinoGenerator.init = function (ws) {
  const g = this as Gen;
  g.definitions_ = Object.create(null);
  g.globals_ = Object.create(null);
  g.setups_ = Object.create(null);
  if (!g.nameDB_) g.nameDB_ = new Blockly.Names("");
  else g.nameDB_.reset();
  g.nameDB_.setVariableMap(ws.getVariableMap());
};

arduinoGenerator.scrub_ = function (block, code, thisOnly) {
  const next = block.nextConnection && block.nextConnection.targetBlock();
  const nextCode = !thisOnly && next ? this.blockToCode(next) : "";
  return code + (nextCode as string);
};

arduinoGenerator.finish = function (code) {
  // Most code comes back from the arduino_sketch block (which assembles the
  // full program). If the user hasn't placed a sketch block, wrap loose code.
  if (code.includes("void loop()")) return code;
  const g = this as Gen;
  const inc = Object.values(g.definitions_).join("\n");
  const glob = Object.values(g.globals_).join("\n");
  const set = Object.values(g.setups_).join("");
  return `${inc ? inc + "\n\n" : ""}${glob ? glob + "\n\n" : ""}void setup() {\n${set}}\n\nvoid loop() {\n${code}}\n`;
};

const G = arduinoGenerator;
const v = (b: Blockly.Block, n: string, o: number) => G.valueToCode(b, n, o) || "0";
const s = (b: Blockly.Block, n: string) => G.statementToCode(b, n);

G.forBlock["arduino_sketch"] = function (block) {
  const setup = s(block, "SETUP");
  const loop = s(block, "LOOP");
  const inc = Object.values(G.definitions_).join("\n");
  const glob = Object.values(G.globals_).join("\n");
  const autoSet = Object.values(G.setups_).join("");
  let out = "";
  if (inc) out += inc + "\n\n";
  if (glob) out += glob + "\n\n";
  out += "void setup() {\n" + autoSet + setup + "}\n\n";
  out += "void loop() {\n" + loop + "}\n";
  return out;
};

G.forBlock["arduino_pinmode"] = (b) => `pinMode(${b.getFieldValue("PIN")}, ${b.getFieldValue("MODE")});\n`;
G.forBlock["arduino_highlow"] = (b) => [b.getFieldValue("STATE"), G.ORDER_ATOMIC];
G.forBlock["arduino_digitalwrite"] = (b) => `digitalWrite(${b.getFieldValue("PIN")}, ${b.getFieldValue("STATE")});\n`;
G.forBlock["arduino_led"] = (b) => `digitalWrite(${b.getFieldValue("PIN")}, ${b.getFieldValue("STATE")});\n`;
G.forBlock["arduino_analogwrite"] = (b) => `analogWrite(${b.getFieldValue("PIN")}, ${v(b, "VAL", G.ORDER_NONE)});\n`;
G.forBlock["arduino_tone"] = (b) => `tone(${b.getFieldValue("PIN")}, ${v(b, "FREQ", G.ORDER_NONE)});\n`;
G.forBlock["arduino_digitalread"] = (b) => [`digitalRead(${b.getFieldValue("PIN")})`, G.ORDER_ATOMIC];
G.forBlock["arduino_button"] = (b) => [`digitalRead(${b.getFieldValue("PIN")}) == HIGH`, G.ORDER_EQUALITY];
G.forBlock["arduino_analogread"] = (b) => [`analogRead(${b.getFieldValue("PIN")})`, G.ORDER_ATOMIC];
G.forBlock["arduino_delay"] = (b) => `delay(${v(b, "MS", G.ORDER_NONE)});\n`;
G.forBlock["arduino_millis"] = () => ["millis()", G.ORDER_ATOMIC];
G.forBlock["arduino_serial_begin"] = (b) => `Serial.begin(${b.getFieldValue("BAUD")});\n`;
G.forBlock["arduino_serial_print"] = (b) => {
  const fn = b.getFieldValue("NL") === "ln" ? "println" : "print";
  return `Serial.${fn}(${v(b, "TEXT", G.ORDER_NONE)});\n`;
};
G.forBlock["arduino_map"] = (b) =>
  [`map(${v(b, "VAL", G.ORDER_NONE)}, ${v(b, "FL", G.ORDER_NONE)}, ${v(b, "FH", G.ORDER_NONE)}, ${v(b, "TL", G.ORDER_NONE)}, ${v(b, "TH", G.ORDER_NONE)})`, G.ORDER_ATOMIC];
G.forBlock["arduino_servo"] = (b) => {
  G.definitions_["servo_h"] = "#include <Servo.h>";
  const pin = b.getFieldValue("PIN");
  G.globals_[`servo_${pin}`] = `Servo servo_${pin};`;
  G.setups_[`servo_${pin}`] = `  servo_${pin}.attach(${pin});\n`;
  return `servo_${pin}.write(${v(b, "ANGLE", G.ORDER_NONE)});\n`;
};
G.forBlock["esp_wifi_connect"] = (b) => {
  G.definitions_["wifi_h"] = "#if defined(ESP32)\n#include <WiFi.h>\n#else\n#include <ESP8266WiFi.h>\n#endif";
  return `WiFi.begin(${v(b, "SSID", G.ORDER_NONE)}, ${v(b, "PASS", G.ORDER_NONE)});\nwhile (WiFi.status() != WL_CONNECTED) { delay(500); }\n`;
};

/* ── Components & Sensors ── */
G.forBlock["arduino_rgbled"] = (b) => {
  const rp = b.getFieldValue("RPIN"), gp = b.getFieldValue("GPIN"), bp = b.getFieldValue("BPIN");
  [rp, gp, bp].forEach((p) => { G.setups_[`rgb_${p}`] = `  pinMode(${p}, OUTPUT);\n`; });
  return `analogWrite(${rp}, ${v(b, "R", G.ORDER_NONE)});\nanalogWrite(${gp}, ${v(b, "G", G.ORDER_NONE)});\nanalogWrite(${bp}, ${v(b, "B", G.ORDER_NONE)});\n`;
};
G.forBlock["arduino_buzzer"] = (b) => `tone(${b.getFieldValue("PIN")}, ${v(b, "FREQ", G.ORDER_NONE)}, ${v(b, "DUR", G.ORDER_NONE)});\n`;
G.forBlock["sensor_ultrasonic"] = (b) => {
  G.globals_["fn_ultrasonic"] =
    "long readDistanceCM(int trig, int echo) {\n  pinMode(trig, OUTPUT); pinMode(echo, INPUT);\n  digitalWrite(trig, LOW); delayMicroseconds(2);\n  digitalWrite(trig, HIGH); delayMicroseconds(10); digitalWrite(trig, LOW);\n  return pulseIn(echo, HIGH) * 0.0343 / 2;\n}";
  return [`readDistanceCM(${b.getFieldValue("TRIG")}, ${b.getFieldValue("ECHO")})`, G.ORDER_ATOMIC];
};
G.forBlock["sensor_pir"] = (b) => { const p = b.getFieldValue("PIN"); G.setups_[`pir_${p}`] = `  pinMode(${p}, INPUT);\n`; return [`digitalRead(${p}) == HIGH`, G.ORDER_EQUALITY]; };
G.forBlock["sensor_ir"] = (b) => { const p = b.getFieldValue("PIN"); G.setups_[`ir_${p}`] = `  pinMode(${p}, INPUT);\n`; return [`digitalRead(${p}) == LOW`, G.ORDER_EQUALITY]; };
G.forBlock["sensor_soil"] = (b) => [`analogRead(${b.getFieldValue("PIN")})`, G.ORDER_ATOMIC];
G.forBlock["sensor_ldr"] = (b) => [`analogRead(${b.getFieldValue("PIN")})`, G.ORDER_ATOMIC];
G.forBlock["sensor_pot"] = (b) => [`analogRead(${b.getFieldValue("PIN")})`, G.ORDER_ATOMIC];
G.forBlock["sensor_dht"] = (b) => {
  const pin = b.getFieldValue("PIN"), model = b.getFieldValue("MODEL"), read = b.getFieldValue("READ");
  G.definitions_["dht_h"] = "#include <DHT.h>";
  G.globals_[`dht_${pin}`] = `DHT dht_${pin}(${pin}, ${model});`;
  G.setups_[`dht_${pin}`] = `  dht_${pin}.begin();\n`;
  return [`dht_${pin}.read${read}()`, G.ORDER_ATOMIC];
};
G.forBlock["sensor_button"] = (b) => { const p = b.getFieldValue("PIN"); G.setups_[`btn_${p}`] = `  pinMode(${p}, INPUT_PULLUP);\n`; return [`digitalRead(${p}) == LOW`, G.ORDER_EQUALITY]; };
G.forBlock["sensor_flame"] = (b) => { const p = b.getFieldValue("PIN"); G.setups_[`flame_${p}`] = `  pinMode(${p}, INPUT);\n`; return [`digitalRead(${p}) == LOW`, G.ORDER_EQUALITY]; };
G.forBlock["sensor_touch"] = (b) => { const p = b.getFieldValue("PIN"); G.setups_[`touch_${p}`] = `  pinMode(${p}, INPUT);\n`; return [`digitalRead(${p}) == HIGH`, G.ORDER_EQUALITY]; };
G.forBlock["sensor_tilt"] = (b) => { const p = b.getFieldValue("PIN"); G.setups_[`tilt_${p}`] = `  pinMode(${p}, INPUT_PULLUP);\n`; return [`digitalRead(${p}) == LOW`, G.ORDER_EQUALITY]; };
G.forBlock["sensor_water"] = (b) => [`analogRead(${b.getFieldValue("PIN")})`, G.ORDER_ATOMIC];
G.forBlock["sensor_gas"] = (b) => [`analogRead(${b.getFieldValue("PIN")})`, G.ORDER_ATOMIC];
G.forBlock["sensor_rain"] = (b) => [`analogRead(${b.getFieldValue("PIN")})`, G.ORDER_ATOMIC];
G.forBlock["sensor_sound"] = (b) => [`analogRead(${b.getFieldValue("PIN")})`, G.ORDER_ATOMIC];
G.forBlock["sensor_temp"] = (b) => [`(analogRead(${b.getFieldValue("PIN")}) * 0.48828)`, G.ORDER_MUL];
G.forBlock["arduino_relay"] = (b) => { const p = b.getFieldValue("PIN"); G.setups_[`relay_${p}`] = `  pinMode(${p}, OUTPUT);\n`; return `digitalWrite(${p}, ${b.getFieldValue("STATE")});\n`; };

/* ── Built-in blocks → C++ ── */
G.forBlock["math_number"] = (b) => {
  const n = Number(b.getFieldValue("NUM"));
  return [String(n), n < 0 ? G.ORDER_UNARY : G.ORDER_ATOMIC];
};
G.forBlock["text"] = (b) => [JSON.stringify(b.getFieldValue("TEXT") || ""), G.ORDER_ATOMIC];
G.forBlock["logic_boolean"] = (b) => [b.getFieldValue("BOOL") === "TRUE" ? "true" : "false", G.ORDER_ATOMIC];
G.forBlock["logic_negate"] = (b) => [`!${v(b, "BOOL", G.ORDER_UNARY)}`, G.ORDER_UNARY];
G.forBlock["math_arithmetic"] = (b) => {
  const ops: Record<string, [string, number]> = {
    ADD: ["+", G.ORDER_ADD], MINUS: ["-", G.ORDER_ADD], MULTIPLY: ["*", G.ORDER_MUL],
    DIVIDE: ["/", G.ORDER_MUL], POWER: ["", G.ORDER_NONE],
  };
  const [op, order] = ops[b.getFieldValue("OP")];
  if (!op) return [`pow(${v(b, "A", G.ORDER_NONE)}, ${v(b, "B", G.ORDER_NONE)})`, G.ORDER_ATOMIC];
  return [`${v(b, "A", order)} ${op} ${v(b, "B", order)}`, order];
};
G.forBlock["logic_compare"] = (b) => {
  const ops: Record<string, string> = { EQ: "==", NEQ: "!=", LT: "<", LTE: "<=", GT: ">", GTE: ">=" };
  const op = ops[b.getFieldValue("OP")];
  const order = op === "==" || op === "!=" ? G.ORDER_EQUALITY : G.ORDER_RELATIONAL;
  return [`${v(b, "A", order)} ${op} ${v(b, "B", order)}`, order];
};
G.forBlock["logic_operation"] = (b) => {
  const and = b.getFieldValue("OP") === "AND";
  const op = and ? "&&" : "||";
  const order = and ? G.ORDER_AND : G.ORDER_OR;
  return [`${v(b, "A", order)} ${op} ${v(b, "B", order)}`, order];
};
G.forBlock["controls_if"] = (b) => {
  let code = "";
  let i = 0;
  do {
    const cond = G.valueToCode(b, "IF" + i, G.ORDER_NONE) || "false";
    const branch = s(b, "DO" + i);
    code += `${i === 0 ? "if" : "else if"} (${cond}) {\n${branch}}\n`;
    i++;
  } while (b.getInput("IF" + i));
  if (b.getInput("ELSE")) code += `else {\n${s(b, "ELSE")}}\n`;
  return code;
};
G.forBlock["controls_repeat_ext"] = (b) => {
  const times = v(b, "TIMES", G.ORDER_NONE);
  const i = G.nameDB_!.getDistinctName("i", Blockly.Names.NameType.VARIABLE);
  return `for (int ${i} = 0; ${i} < ${times}; ${i}++) {\n${s(b, "DO")}}\n`;
};
G.forBlock["controls_whileUntil"] = (b) => {
  const until = b.getFieldValue("MODE") === "UNTIL";
  const cond = G.valueToCode(b, "BOOL", until ? G.ORDER_UNARY : G.ORDER_NONE) || "false";
  return `while (${until ? "!" + cond : cond}) {\n${s(b, "DO")}}\n`;
};
G.forBlock["variables_get"] = (b) => [G.nameDB_!.getName(b.getFieldValue("VAR"), Blockly.Names.NameType.VARIABLE), G.ORDER_ATOMIC];
G.forBlock["variables_set"] = (b) => {
  const name = G.nameDB_!.getName(b.getFieldValue("VAR"), Blockly.Names.NameType.VARIABLE);
  G.globals_[`var_${name}`] = `int ${name};`;
  return `${name} = ${v(b, "VALUE", G.ORDER_NONE)};\n`;
};
G.forBlock["math_change"] = (b) => {
  const name = G.nameDB_!.getName(b.getFieldValue("VAR"), Blockly.Names.NameType.VARIABLE);
  G.globals_[`var_${name}`] = `int ${name};`;
  return `${name} += ${v(b, "DELTA", G.ORDER_NONE)};\n`;
};

let defined = false;
/** Register the Arduino blocks once (safe to call on every mount). */
export function registerArduinoBlocks() {
  if (defined) return;
  Blockly.defineBlocksWithJsonArray(BLOCKS);
  defined = true;
}
