import type { ReactNode } from "react";
import type { CircuitComponent, CompState, PartType } from "./types";

/* ──────────────────────────────────────────────────────────────
   Part registry — every part is a 2-terminal block in a 120×88 box.
   Pin "a" sits left (6,44), pin "b" right (114,44). Art is centred
   and shaded for a 3D look; lead stubs run out to the pins.
   render() gets a unique component id so gradient ids never clash.
   ────────────────────────────────────────────────────────────── */

export const BOX_W = 120;
export const BOX_H = 88;
const MY = 44;

export interface PartPin {
  id: "a" | "b";
  x: number;
  y: number;
  label?: string;
}

export interface PartDef {
  type: PartType;
  label: string;
  pins: PartPin[];
  defaultProps: Record<string, number | string | boolean>;
  toggleable?: boolean;
  render: (comp: CircuitComponent, state: CompState, running: boolean) => ReactNode;
}

const PINS: PartPin[] = [
  { id: "a", x: 6, y: MY },
  { id: "b", x: 114, y: MY },
];

const lead = (x1: number, x2: number, color = "#9aa6b8") => (
  <line x1={x1} y1={MY} x2={x2} y2={MY} stroke={color} strokeWidth="4" strokeLinecap="round" />
);

function Battery({ comp }: { comp: CircuitComponent }) {
  const id = comp.id;
  return (
    <g>
      <linearGradient id={`bt-${id}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#5aa2e6" />
        <stop offset="1" stopColor="#3b82c4" />
      </linearGradient>
      {lead(6, 30, "#2b2b2b")}
      {lead(90, 114, "#e2554e")}
      <ellipse cx="60" cy="74" rx="30" ry="6" fill="#000" opacity="0.32" />
      <polygon points="60,16 92,32 60,48 28,32" fill={`url(#bt-${id})`} stroke="#0f335c" />
      <polygon points="28,32 60,48 60,70 28,54" fill="#225a96" stroke="#0f335c" />
      <polygon points="60,48 92,32 92,54 60,70" fill="#15406e" stroke="#0f335c" />
      <polygon points="28,40 60,56 60,64 28,48" fill="#f59e0b" opacity="0.9" />
      <polygon points="60,56 92,40 92,48 60,64" fill="#c77f08" opacity="0.9" />
      <ellipse cx="52" cy="28" rx="5" ry="2.4" fill="#e2e8f0" stroke="#7c8aa0" />
      <ellipse cx="68" cy="32" rx="6" ry="3" fill="#cbd5e1" stroke="#7c8aa0" />
      <polyline points="28,32 60,16 92,32" fill="none" stroke="#bcdcff" strokeWidth="1.2" opacity="0.6" />
    </g>
  );
}

function Led({ comp, state, running }: { comp: CircuitComponent; state: CompState; running: boolean }) {
  const id = comp.id;
  const color = String(comp.props.color || "#ef4444");
  const on = running && state.on;
  const lvl = on ? 0.4 + state.level * 0.6 : 0;
  return (
    <g>
      <radialGradient id={`led-${id}`} cx="0.38" cy="0.32" r="0.85">
        <stop offset="0" stopColor={on ? "#ffffff" : "#ffd9d6"} />
        <stop offset="0.3" stopColor={on ? lighten(color) : color} />
        <stop offset="1" stopColor={darken(color)} />
      </radialGradient>
      <radialGradient id={`halo-${id}`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor={color} stopOpacity={lvl * 0.8} />
        <stop offset="1" stopColor={color} stopOpacity="0" />
      </radialGradient>
      {lead(6, 44, "#9aa6b8")}
      {lead(76, 114, "#8593a6")}
      {on && <circle cx="60" cy="40" r="46" fill={`url(#halo-${id})`} />}
      {on &&
        Array.from({ length: 8 }).map((_, i) => {
          const ang = (i / 8) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={60 + Math.cos(ang) * 30}
              y1={40 + Math.sin(ang) * 30}
              x2={60 + Math.cos(ang) * 40}
              y2={40 + Math.sin(ang) * 40}
              stroke={lighten(color)}
              strokeWidth="2.6"
              strokeLinecap="round"
              opacity={lvl}
            />
          );
        })}
      <ellipse cx="60" cy="58" rx="17" ry="5" fill={darken(color)} />
      <rect x="43" y="48" width="34" height="11" fill={darken(color)} />
      <ellipse cx="60" cy="48" rx="17" ry="5" fill={color} />
      <path d={`M44 52 L44 33 Q44 16 60 16 Q76 16 76 33 L76 52 Z`} fill={`url(#led-${id})`} stroke={darken(color)} />
      <ellipse cx="52" cy="30" rx="5" ry="9" fill="#fff" opacity={on ? 0.75 : 0.45} />
    </g>
  );
}

function Resistor({ comp }: { comp: CircuitComponent }) {
  const id = comp.id;
  const bands = ohmBands(Number(comp.props.ohms) || 220);
  return (
    <g>
      <linearGradient id={`res-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f0d3aa" />
        <stop offset="0.5" stopColor="#d8ac72" />
        <stop offset="1" stopColor="#b07f42" />
      </linearGradient>
      {lead(6, 40, "#aab4c2")}
      {lead(80, 114, "#aab4c2")}
      <ellipse cx="60" cy="64" rx="34" ry="6" fill="#000" opacity="0.25" />
      <ellipse cx="40" cy="44" rx="6" ry="15" fill="#a87b46" />
      <rect x="40" y="29" width="40" height="30" fill={`url(#res-${id})`} />
      <ellipse cx="80" cy="44" rx="6" ry="15" fill="#caa063" />
      {bands.map((c, i) => (
        <rect key={i} x={46 + i * 8} y="29" width="5" height="30" fill={c} />
      ))}
      <rect x="40" y="32" width="40" height="3" fill="#fff" opacity="0.35" />
    </g>
  );
}

function Switchy({ comp, running }: { comp: CircuitComponent; running: boolean }) {
  const closed = !!comp.props.closed;
  return (
    <g>
      {lead(6, 36, "#9aa6b8")}
      {lead(84, 114, "#9aa6b8")}
      <ellipse cx="60" cy="60" rx="30" ry="6" fill="#000" opacity="0.28" />
      <rect x="34" y="40" width="52" height="16" rx="4" fill="#2b3550" stroke="#1a2236" />
      <circle cx="40" cy="48" r="4.5" fill="#cbd5e1" stroke="#7c8aa0" />
      <circle cx="80" cy="48" r="4.5" fill="#cbd5e1" stroke="#7c8aa0" />
      {closed ? (
        <line x1="40" y1="48" x2="80" y2="48" stroke="#e2e8f0" strokeWidth="5" strokeLinecap="round" />
      ) : (
        <line x1="40" y1="48" x2="74" y2="30" stroke="#e2e8f0" strokeWidth="5" strokeLinecap="round" />
      )}
      <text x="60" y="78" textAnchor="middle" fontFamily="monospace" fontSize="11" fill={closed && running ? "#34d399" : "#5f7194"}>
        {closed ? "ON" : "OFF"}
      </text>
    </g>
  );
}

function Button({ comp }: { comp: CircuitComponent }) {
  const id = comp.id;
  const down = !!comp.props.closed;
  return (
    <g>
      <linearGradient id={`btn-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#67b0f2" />
        <stop offset="1" stopColor="#2f6fb0" />
      </linearGradient>
      {lead(6, 36, "#9aa6b8")}
      {lead(84, 114, "#9aa6b8")}
      <ellipse cx="60" cy="62" rx="26" ry="6" fill="#000" opacity="0.28" />
      <polygon points="60,40 92,56 60,72 28,56" fill="#222a3e" stroke="#161d2c" />
      <polygon points="28,56 60,72 60,76 28,60" fill="#161d2c" />
      <polygon points="60,72 92,56 92,60 60,76" fill="#10151f" />
      <ellipse cx="60" cy={down ? 50 : 46} rx="18" ry="9" fill="#1f5a93" />
      <ellipse cx="60" cy={down ? 48 : 42} rx="18" ry="9" fill={`url(#btn-${id})`} stroke="#1f4f86" />
      <ellipse cx="54" cy={down ? 45 : 39} rx="6" ry="3" fill="#bfe0ff" opacity="0.7" />
    </g>
  );
}

function Buzzer({ comp, state, running }: { comp: CircuitComponent; state: CompState; running: boolean }) {
  const id = comp.id;
  const on = running && state.on;
  return (
    <g>
      <linearGradient id={`bz-${id}`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#3a3a3a" />
        <stop offset="0.5" stopColor="#1c1c1c" />
        <stop offset="1" stopColor="#000000" />
      </linearGradient>
      {lead(6, 40, "#9aa6b8")}
      {lead(80, 114, "#9aa6b8")}
      <ellipse cx="60" cy="64" rx="28" ry="6" fill="#000" opacity="0.3" />
      <ellipse cx="60" cy="60" rx="28" ry="9" fill="#0a0a0a" />
      <rect x="32" y="28" width="56" height="32" fill={`url(#bz-${id})`} />
      <ellipse cx="60" cy="28" rx="28" ry="10" fill="#2b2b2b" stroke="#454545" />
      <circle cx="60" cy="27" r="4.5" fill="#0b0b0b" />
      {on &&
        [12, 18, 24].map((r, i) => (
          <ellipse key={i} cx="60" cy="27" rx={r} ry={r * 0.4} fill="none" stroke="#34d399" strokeWidth="1.5" opacity={0.6 - i * 0.18} />
        ))}
    </g>
  );
}

function Motor({ comp, state, running }: { comp: CircuitComponent; state: CompState; running: boolean }) {
  const id = comp.id;
  const on = running && state.on;
  return (
    <g>
      <linearGradient id={`mot-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#eef2f7" />
        <stop offset="0.5" stopColor="#c2ccd8" />
        <stop offset="1" stopColor="#8d9aac" />
      </linearGradient>
      {lead(6, 30, "#d9a441")}
      {lead(96, 114, "#9aa6b8")}
      <ellipse cx="60" cy="64" rx="30" ry="6" fill="#000" opacity="0.28" />
      <rect x="92" y="40" width="14" height="8" fill="#c9a24a" />
      <ellipse cx="34" cy="44" rx="9" ry="20" fill="#7e8a9b" />
      <rect x="34" y="24" width="52" height="40" fill={`url(#mot-${id})`} />
      <ellipse cx="86" cy="44" rx="9" ry="20" fill="#aab6c6" />
      <ellipse cx="86" cy="44" rx="5" ry="13" fill="#8d9aac" />
      <rect x="34" y="27" width="52" height="3" fill="#fff" opacity="0.4" />
      <g style={{ transformOrigin: "86px 44px", animation: on ? "cl-spin 0.5s linear infinite" : "none" }}>
        <line x1="86" y1="36" x2="86" y2="52" stroke="#5f6b7d" strokeWidth="2" />
      </g>
    </g>
  );
}

function Pot({ comp }: { comp: CircuitComponent }) {
  const id = comp.id;
  const frac = clamp01((Number(comp.props.ohms) || 500) / 1000);
  const ang = -120 + frac * 240;
  return (
    <g>
      <radialGradient id={`pot-${id}`} cx="0.4" cy="0.35" r="0.8">
        <stop offset="0" stopColor="#46506b" />
        <stop offset="1" stopColor="#222a3e" />
      </radialGradient>
      {lead(6, 36, "#9aa6b8")}
      {lead(84, 114, "#9aa6b8")}
      <ellipse cx="60" cy="62" rx="26" ry="6" fill="#000" opacity="0.28" />
      <circle cx="60" cy="42" r="24" fill="#1a2236" />
      <circle cx="60" cy="40" r="22" fill={`url(#pot-${id})`} stroke="#111726" />
      <g transform={`rotate(${ang} 60 40)`}>
        <line x1="60" y1="40" x2="60" y2="22" stroke="#e2e8f0" strokeWidth="3.5" strokeLinecap="round" />
      </g>
      <circle cx="60" cy="40" r="4" fill="#cbd5e1" />
    </g>
  );
}

/** Generic module/board/sensor — a labelled PCB block with 2 power leads.
 *  Lights a small status LED when it's powered. Lets us add many parts (boards,
 *  sensors, actuators) with a consistent look without bespoke art for each. */
function ModulePart({ comp, emoji, label, color, state, running }: { comp: CircuitComponent; emoji: string; label: string; color: string; state: CompState; running: boolean }) {
  void comp;
  const on = running && state.on;
  return (
    <g>
      {lead(6, 24)}
      {lead(96, 114)}
      <rect x="24" y="20" width="72" height="48" rx="9" fill={color} stroke="#0b1228" strokeWidth="2.5" />
      <rect x="24" y="20" width="72" height="13" rx="9" fill="#ffffff" opacity="0.12" />
      <text x="60" y="49" textAnchor="middle" fontSize="22">{emoji}</text>
      <text x="60" y="82" textAnchor="middle" fill="#cbd5e1" fontFamily="Fredoka, system-ui" fontSize="11" fontWeight="600">{label}</text>
      <circle cx="88" cy="28" r="3.4" fill={on ? "#34d399" : "#243049"} stroke="#0b1228" strokeWidth="1" />
      {on && <circle cx="88" cy="28" r="6.5" fill="#34d399" opacity="0.35" />}
    </g>
  );
}

const mod = (type: PartType, label: string, emoji: string, color: string): PartDef => ({
  type, label, pins: PINS, defaultProps: {},
  render: (c, s, r) => <ModulePart comp={c} emoji={emoji} label={label} color={color} state={s} running={r} />,
});

export const PART_DEFS: Record<PartType, PartDef> = {
  battery: { type: "battery", label: "Battery", pins: PINS, defaultProps: { volts: 9 }, render: (c) => <Battery comp={c} /> },
  switch: { type: "switch", label: "Switch", pins: PINS, defaultProps: { closed: false }, toggleable: true, render: (c, _s, r) => <Switchy comp={c} running={r} /> },
  button: { type: "button", label: "Button", pins: PINS, defaultProps: { closed: false }, toggleable: true, render: (c) => <Button comp={c} /> },
  led: { type: "led", label: "LED", pins: PINS, defaultProps: { color: "#ef4444" }, render: (c, s, r) => <Led comp={c} state={s} running={r} /> },
  resistor: { type: "resistor", label: "Resistor", pins: PINS, defaultProps: { ohms: 220 }, render: (c) => <Resistor comp={c} /> },
  buzzer: { type: "buzzer", label: "Buzzer", pins: PINS, defaultProps: {}, render: (c, s, r) => <Buzzer comp={c} state={s} running={r} /> },
  motor: { type: "motor", label: "Motor", pins: PINS, defaultProps: {}, render: (c, s, r) => <Motor comp={c} state={s} running={r} /> },
  pot: { type: "pot", label: "Knob", pins: PINS, defaultProps: { ohms: 500 }, render: (c) => <Pot comp={c} /> },
  // boards
  arduino: mod("arduino", "Arduino Uno", "🔲", "#1e9b8a"),
  curious: mod("curious", "Curious Board", "🟢", "#16a34a"),
  // outputs / actuators
  relay: mod("relay", "Relay", "🔀", "#f59e0b"),
  servo: mod("servo", "Servo", "🦾", "#ec4899"),
  lamp: mod("lamp", "Lamp", "💡", "#eab308"),
  fan: mod("fan", "Fan", "🌀", "#38bdf8"),
  rgb: mod("rgb", "RGB LED", "🌈", "#a855f7"),
  // sensors
  ultrasonic: mod("ultrasonic", "Ultrasonic", "📏", "#ef4444"),
  pir: mod("pir", "PIR Motion", "🚶", "#f43f5e"),
  ir: mod("ir", "IR Sensor", "🚧", "#fb7185"),
  soil: mod("soil", "Soil Moisture", "🌱", "#84cc16"),
  ldr: mod("ldr", "Light (LDR)", "☀️", "#f59e0b"),
  dht: mod("dht", "DHT11", "🌡️", "#22d3ee"),
  temp: mod("temp", "Temp (LM35)", "🌡️", "#f97316"),
  water: mod("water", "Water Level", "💧", "#0ea5e9"),
  gas: mod("gas", "Gas (MQ-2)", "💨", "#94a3b8"),
  flame: mod("flame", "Flame", "🔥", "#ef4444"),
  touch: mod("touch", "Touch", "✋", "#c084fc"),
  tilt: mod("tilt", "Tilt", "📐", "#14b8a6"),
  rain: mod("rain", "Rain", "🌧️", "#3b82f6"),
  mic: mod("mic", "Sound", "🎤", "#ec4899"),
};

/** Parts grouped for the tray. */
export const PART_GROUPS: { name: string; emoji: string; types: PartType[] }[] = [
  { name: "Basics", emoji: "🔋", types: ["battery", "switch", "button", "led", "resistor", "pot"] },
  { name: "Outputs", emoji: "💡", types: ["buzzer", "motor", "relay", "servo", "lamp", "fan", "rgb"] },
  { name: "Sensors", emoji: "📡", types: ["ultrasonic", "pir", "ir", "soil", "ldr", "dht", "temp", "water", "gas", "flame", "touch", "tilt", "rain", "mic"] },
  { name: "Boards", emoji: "🧠", types: ["arduino", "curious"] },
];

export const PART_ORDER: PartType[] = PART_GROUPS.flatMap((g) => g.types);

/* ── colour helpers ── */
function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
function hexToRgb(h: string) {
  const m = h.replace("#", "");
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}
function toHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
function lighten(h: string) {
  const [r, g, b] = hexToRgb(h);
  return toHex(r + (255 - r) * 0.45, g + (255 - g) * 0.45, b + (255 - b) * 0.45);
}
function darken(h: string) {
  const [r, g, b] = hexToRgb(h);
  return toHex(r * 0.55, g * 0.55, b * 0.55);
}
function ohmBands(ohms: number): string[] {
  const COL = ["#000000", "#7a4a23", "#d23b2f", "#e8862e", "#e8d22e", "#3aa84a", "#3a6fd2", "#9a4ad2", "#9aa6b8", "#ffffff"];
  const s = Math.max(1, Math.round(ohms)).toString();
  const d1 = Number(s[0]);
  const d2 = s.length > 1 ? Number(s[1]) : 0;
  const mult = Math.max(0, s.length - 2);
  return [COL[d1], COL[d2], COL[Math.min(9, mult)], "#d4af37"];
}
