import type { ReactNode } from "react";
import type { CircuitComponent, CompState, PartType } from "./types";

/* Realistic real-life SVG art for Maker Lab parts. Each renders inside a
   120x88 viewBox, wiring at pin a (6,44) and b (114,44); gradient ids are
   namespaced with comp.id. Generated + hand-tuned. */

export type PartArtProps = { comp: CircuitComponent; state: CompState; running: boolean };

function ArduinoUno({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  const topPins = Array.from({ length: 14 });
  const botPins = Array.from({ length: 12 });
  return (
    <g>
      <ellipse cx={60} cy={80} rx={50} ry={6} fill="#000" opacity={0.28} />
      {/* leads to side header pins */}
      <line x1={6} y1={44} x2={14} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={106} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#00a7ac" />
          <stop offset="0.5" stopColor="#00979c" />
          <stop offset="1" stopColor="#006d70" />
        </linearGradient>
        <linearGradient id={`usb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e8eaee" />
          <stop offset="0.5" stopColor="#aab0b8" />
          <stop offset="1" stopColor="#7d838b" />
        </linearGradient>
        <linearGradient id={`chip-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3f45" />
          <stop offset="1" stopColor="#16191c" />
        </linearGradient>
        <radialGradient id={`xtal-${id}`} cx="0.4" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#f0f2f4" />
          <stop offset="1" stopColor="#8d949c" />
        </radialGradient>
        <radialGradient id={`glow-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#34d399" stopOpacity={0.9} />
          <stop offset="1" stopColor="#34d399" stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* PCB */}
      <rect x={14} y={12} width={92} height={64} rx={4} fill={`url(#pcb-${id})`} stroke="#006d70" strokeWidth={1} />
      <rect x={14} y={12} width={92} height={3} rx={2} fill="#fff" opacity={0.12} />
      {/* mounting holes */}
      <circle cx={19} cy={17} r={1.8} fill="#0c5557" />
      <circle cx={101} cy={71} r={1.8} fill="#0c5557" />
      {/* TOP digital header */}
      <rect x={26} y={14} width={74} height={8} rx={1} fill="#15171a" />
      {topPins.map((_, i) => (
        <rect key={`tp${i}`} x={28 + i * 5.2} y={16} width={1.4} height={4} fill="#dfe4e8" opacity={0.85} />
      ))}
      {/* BOTTOM power + analog header */}
      <rect x={30} y={66} width={66} height={8} rx={1} fill="#15171a" />
      {botPins.map((_, i) => (
        <rect key={`bp${i}`} x={32 + i * 5.2} y={68} width={1.4} height={4} fill="#dfe4e8" opacity={0.85} />
      ))}
      {/* USB-B connector off LEFT-TOP */}
      <rect x={8} y={20} width={20} height={16} rx={1.5} fill={`url(#usb-${id})`} stroke="#5e646c" strokeWidth={0.8} />
      <rect x={9} y={22} width={4} height={12} fill="#6b7178" />
      <rect x={11} y={24} width={14} height={8} rx={1} fill="#cfd4da" />
      {/* barrel power jack off LEFT-BOTTOM */}
      <rect x={10} y={50} width={16} height={16} rx={3} fill="#1a1c1f" stroke="#000" strokeWidth={0.6} />
      <ellipse cx={11} cy={58} rx={2.2} ry={6} fill="#0a0b0c" />
      <circle cx={11} cy={58} r={2} fill="#2a2d30" />
      {/* ATmega328P DIP-28 centre */}
      <rect x={48} y={38} width={28} height={20} rx={1.5} fill={`url(#chip-${id})`} stroke="#000" strokeWidth={0.6} />
      <path d="M58 38 a3 3 0 0 0 6 0" fill="#0c0d0e" />
      <circle cx={51} cy={55} r={1} fill="#0c0d0e" />
      {Array.from({ length: 7 }).map((_, i) => (
        <g key={`lg${i}`}>
          <rect x={49.5 + i * 3.7} y={35.5} width={1.6} height={3} fill="#c9cdd2" />
          <rect x={49.5 + i * 3.7} y={57.5} width={1.6} height={3} fill="#c9cdd2" />
        </g>
      ))}
      <text x={62} y={50} fontSize={2.6} fill="#9aa0a6" textAnchor="middle" fontFamily="monospace">ATMEGA</text>
      {/* crystal can */}
      <rect x={40} y={42} width={6} height={11} rx={2.5} fill={`url(#xtal-${id})`} stroke="#666" strokeWidth={0.5} />
      {/* reset button near top */}
      <rect x={88} y={24} width={9} height={9} rx={1.5} fill="#2b2e32" stroke="#000" strokeWidth={0.5} />
      <circle cx={92.5} cy={28.5} r={2.6} fill="#c0c4c9" />
      {/* ICSP 2x3 block near right edge */}
      <rect x={92} y={44} width={9} height={7} rx={0.8} fill="#15171a" />
      {Array.from({ length: 6 }).map((_, i) => (
        <circle key={`ic${i}`} cx={94 + (i % 3) * 2.6} cy={46.5 + Math.floor(i / 3) * 3} r={0.8} fill="#d9b24a" />
      ))}
      {/* silkscreen wordmark */}
      <text x={66} y={32} fontSize={5} fill="#fff" textAnchor="middle" fontFamily="Arial, sans-serif" fontStyle="italic" fontWeight="bold" opacity={0.92}>ARDUINO</text>
      <text x={66} y={64} fontSize={4} fill="#fff" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="bold" opacity={0.9}>UNO</text>
      {/* L / TX / RX LEDs */}
      <rect x={78} y={36} width={2.4} height={1.6} fill="#f4d03f" />
      <rect x={78} y={39} width={2.4} height={1.6} fill="#f4d03f" />
      {/* ON power LED (glows green) */}
      {on && <circle cx={84} cy={58} r={7} fill={`url(#glow-${id})`} />}
      <circle cx={84} cy={58} r={2.4} fill={on ? "#34d399" : "#243049"} stroke={on ? "#10b981" : "#1a2334"} strokeWidth={0.6} />
      <text x={84} y={54} fontSize={2.4} fill="#fff" textAnchor="middle" fontFamily="Arial" opacity={0.8}>ON</text>
    </g>
  );
}

function CuriousBoard({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  const ticks = [26, 33, 40, 47, 54, 61, 68, 75, 82, 89];
  return (
    <g>
      <ellipse cx={60} cy={80} rx={48} ry={6} fill="#000" opacity={0.3} />
      {/* USB-C cable (left) + pin header (right) leads */}
      <line x1={6} y1={44} x2={18} y2={44} stroke="#cfd6e4" strokeWidth={4} strokeLinecap="round" />
      <line x1={102} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <defs>
        <linearGradient id={`cb-pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#101a38" />
          <stop offset="1" stopColor="#0b1228" />
        </linearGradient>
        <linearGradient id={`cb-usb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2f4f8" />
          <stop offset="0.5" stopColor="#b9c0cc" />
          <stop offset="1" stopColor="#8d94a2" />
        </linearGradient>
        <linearGradient id={`cb-chip-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a2f38" />
          <stop offset="1" stopColor="#0c0e12" />
        </linearGradient>
        <radialGradient id={`cb-glow-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#22d3ee" stopOpacity={on ? 0.85 : 0} />
          <stop offset="1" stopColor="#22d3ee" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect x={18} y={12} width={84} height={64} rx={6} fill={`url(#cb-pcb-${id})`} stroke="#1d2b52" strokeWidth={1.2} />
      <rect x={18} y={12} width={84} height={3} rx={2} fill="#fff" opacity={0.08} />
      <rect x={21} y={15} width={78} height={58} rx={4} fill="none" stroke="#22d3ee" strokeWidth={0.5} opacity={0.35} />
      {/* header strips on both long edges with cyan tick pins */}
      <rect x={24} y={14} width={72} height={6} rx={1} fill="#0a0f1f" />
      <rect x={24} y={68} width={72} height={6} rx={1} fill="#0a0f1f" />
      {ticks.map((x, i) => (
        <g key={i}>
          <rect x={x} y={15.5} width={1.4} height={3} fill="#22d3ee" opacity={0.7} />
          <rect x={x} y={69.5} width={1.4} height={3} fill="#22d3ee" opacity={0.7} />
        </g>
      ))}
      {/* central QFN microcontroller */}
      <rect x={50} y={36} width={22} height={18} rx={2} fill={`url(#cb-chip-${id})`} stroke="#22d3ee" strokeWidth={0.6} />
      <circle cx={53} cy={39} r={1} fill="#22d3ee" opacity={0.8} />
      {Array.from({ length: 6 }).map((_, i) => (
        <g key={i}>
          <rect x={51.5 + i * 3.3} y={34.5} width={1.4} height={2} fill="#c9cdd2" />
          <rect x={51.5 + i * 3.3} y={53.5} width={1.4} height={2} fill="#c9cdd2" />
        </g>
      ))}
      {/* USB-C connector on the left edge */}
      <rect x={14} y={38} width={10} height={12} rx={3} fill={`url(#cb-usb-${id})`} stroke="#5e646c" strokeWidth={0.6} />
      <rect x={16} y={41} width={6} height={6} rx={3} fill="#6b7178" />
      {/* CURIOUS wordmark + subtitle */}
      <text x={60} y={31} fontSize={6} fill="#e8f9ff" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="bold" letterSpacing="1.2">CURIOUS</text>
      <text x={60} y={64} fontSize={3} fill="#22d3ee" textAnchor="middle" fontFamily="monospace" opacity={0.85}>WiFi · dev board</text>
      {/* antenna zig-zag trace */}
      <polyline points="82,22 85,24 82,26 85,28 82,30" fill="none" stroke="#d9b24a" strokeWidth={0.8} opacity={0.7} />
      {/* RGB status LED */}
      <circle cx={30} cy={32} r={2.2} fill={on ? "#a855f7" : "#243049"} stroke="#0a0f1f" strokeWidth={0.5} />
      {on && <circle cx={30} cy={32} r={5} fill="#a855f7" opacity={0.3} />}
      {/* power LED (cyan glow) */}
      {on && <circle cx={90} cy={58} r={7} fill={`url(#cb-glow-${id})`} />}
      <circle cx={90} cy={58} r={2.4} fill={on ? "#22d3ee" : "#243049"} stroke="#0a0f1f" strokeWidth={0.5} />
    </g>
  );
}

function Ultrasonic({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  const Eye = ({ cx }: { cx: number }) => (
    <g>
      <circle cx={cx} cy={34} r={17} fill={`url(#rim-${id})`} stroke="#8c9098" strokeWidth={0.8} />
      <circle cx={cx} cy={34} r={14.5} fill="#9aa0a8" />
      <circle cx={cx} cy={34} r={13.5} fill={`url(#mesh-${id})`} />
      <circle cx={cx} cy={34} r={13.5} fill={`url(#meshgrid-${id})`} opacity={0.6} />
      <circle cx={cx} cy={34} r={13.5} fill="none" stroke="#5b6068" strokeWidth={1.2} />
      <ellipse cx={cx - 4} cy={28} rx={6} ry={4} fill="#fff" opacity={0.18} />
    </g>
  );
  return (
    <g>
      <ellipse cx={60} cy={80} rx={46} ry={6} fill="#000" opacity={0.28} />
      <line x1={6} y1={44} x2={16} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={104} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a72d8" />
          <stop offset="1" stopColor="#1f5fc0" />
        </linearGradient>
        <radialGradient id={`rim-${id}`} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#e8ebef" />
          <stop offset="0.6" stopColor="#b9bdc4" />
          <stop offset="1" stopColor="#7d828a" />
        </radialGradient>
        <radialGradient id={`mesh-${id}`} cx="0.4" cy="0.35" r="0.9">
          <stop offset="0" stopColor="#6e747c" />
          <stop offset="1" stopColor="#3a3e44" />
        </radialGradient>
        <pattern id={`meshgrid-${id}`} width="2" height="2" patternUnits="userSpaceOnUse">
          <rect width="2" height="2" fill="none" />
          <circle cx="1" cy="1" r="0.45" fill="#22252a" />
        </pattern>
        <radialGradient id={`can-${id}`} cx="0.4" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#eef0f3" />
          <stop offset="1" stopColor="#9499a0" />
        </radialGradient>
      </defs>
      <rect x={14} y={10} width={92} height={62} rx={4} fill={`url(#pcb-${id})`} stroke="#15489a" strokeWidth={1} />
      <circle cx={19} cy={15} r={2.2} fill="#0e3477" />
      <circle cx={101} cy={15} r={2.2} fill="#0e3477" />
      <circle cx={19} cy={67} r={2.2} fill="#0e3477" />
      <circle cx={101} cy={67} r={2.2} fill="#0e3477" />
      <Eye cx={38} />
      <Eye cx={82} />
      <ellipse cx={60} cy={50} rx={6} ry={5} fill={`url(#can-${id})`} stroke="#7c818a" strokeWidth={0.8} />
      <rect x={60} y={45} width={4.5} height={10} rx={1} fill="#0c0e12" stroke="#2a2d33" strokeWidth={0.5} />
      <circle cx={62.2} cy={50} r={0.6} fill="#3a3e46" />
      <rect x={68} y={46} width={5} height={8} rx={1} fill="#0c0e12" stroke="#2a2d33" strokeWidth={0.5} />
      <ellipse cx={50} cy={52} rx={3.2} ry={3.2} fill="#1b2230" stroke="#0b1018" strokeWidth={0.6} />
      <ellipse cx={50} cy={52} rx={3.2} ry={3.2} fill="#2c3a52" opacity={0.5} />
      <rect x={20} y={62} width={48} height={9} rx={1.5} fill="#101216" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={25 + i * 11} y={60} width={3} height={11} rx={0.6} fill={`url(#can-${id})`} stroke="#b9912f" strokeWidth={0.4} />
      ))}
      {["VCC", "TRIG", "ECHO", "GND"].map((t, i) => (
        <text key={t} x={26.5 + i * 11} y={59} fontSize={2.4} fill="#d6e2f5" textAnchor="middle" fontFamily="monospace">{t}</text>
      ))}
      <circle cx={94} cy={50} r={2.4} fill={on ? "#34d399" : "#243049"} stroke="#0d1622" strokeWidth={0.5} />
      {on && <circle cx={94} cy={50} r={5} fill="#34d399" opacity={0.3} />}
      <rect x={14} y={11} width={92} height={3} rx={2} fill="#fff" opacity={0.12} />
    </g>
  );
}

function PirSensor({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  // Fresnel dome facet grid
  const facets: ReactNode[] = [];
  const cols = 5, rows = 4;
  const cx = 60, cy = 40, rx = 34, ry = 30;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const fx = cx - rx + 6 + (c + 0.5) * ((rx * 2 - 12) / cols);
      const fy = cy - ry + 4 + (r + 0.5) * ((ry * 2 - 8) / rows);
      const dx = (fx - cx) / rx, dy = (fy - cy) / ry;
      if (dx * dx + dy * dy > 0.92) continue;
      const fw = ((rx * 2 - 12) / cols) * 0.46 * (1 - 0.25 * Math.abs(dx));
      const fh = ((ry * 2 - 8) / rows) * 0.46 * (1 - 0.2 * Math.abs(dy));
      facets.push(
        <ellipse key={`f${r}-${c}`} cx={fx} cy={fy} rx={fw} ry={fh} fill={`url(#facet-${id})`} stroke="#c8cdd6" strokeWidth={0.5} opacity={0.85} />
      );
    }
  }
  return (
    <g>
      <defs>
        <radialGradient id={`dome-${id}`} cx="42%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.98} />
          <stop offset="55%" stopColor="#f1f3f7" stopOpacity={0.92} />
          <stop offset="100%" stopColor="#d4d8e0" stopOpacity={0.95} />
        </radialGradient>
        <radialGradient id={`facet-${id}`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.95} />
          <stop offset="100%" stopColor="#dde1e8" stopOpacity={0.7} />
        </radialGradient>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1f7a4d" />
          <stop offset="100%" stopColor="#14552f" />
        </linearGradient>
        <linearGradient id={`pin-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f3d98a" />
          <stop offset="50%" stopColor="#d9b24a" />
          <stop offset="100%" stopColor="#a9842f" />
        </linearGradient>
      </defs>
      {/* shadow */}
      <ellipse cx={60} cy={80} rx={42} ry={6} fill="#000" opacity={0.28} />
      {/* leads */}
      <line x1={6} y1={44} x2={24} y2={44} stroke={`url(#pin-${id})`} strokeWidth={4} strokeLinecap="round" />
      <line x1={96} y1={44} x2={114} y2={44} stroke={`url(#pin-${id})`} strokeWidth={4} strokeLinecap="round" />
      {/* PCB base */}
      <rect x={24} y={56} width={72} height={20} rx={3} fill={`url(#pcb-${id})`} stroke="#0e3d22" strokeWidth={1} />
      <rect x={24} y={56} width={72} height={3} rx={1.5} fill="#2f9a63" opacity={0.6} />
      {/* trimmer pots (orange) */}
      <g>
        <rect x={31} y={61} width={11} height={11} rx={1.5} fill="#e8731a" stroke="#9c4708" strokeWidth={0.8} />
        <circle cx={36.5} cy={66.5} r={3.2} fill="#f2a55a" stroke="#9c4708" strokeWidth={0.6} />
        <line x1={34.6} y1={66.5} x2={38.4} y2={66.5} stroke="#7a3704" strokeWidth={1} />
        <rect x={47} y={61} width={11} height={11} rx={1.5} fill="#e8731a" stroke="#9c4708" strokeWidth={0.8} />
        <circle cx={52.5} cy={66.5} r={3.2} fill="#f2a55a" stroke="#9c4708" strokeWidth={0.6} />
        <line x1={52.5} y1={64.6} x2={52.5} y2={68.4} stroke="#7a3704" strokeWidth={1} />
      </g>
      {/* 3-pin header */}
      <rect x={70} y={62} width={20} height={9} rx={1} fill="#1a1d24" stroke="#000" strokeWidth={0.6} />
      <rect x={72.5} y={71} width={2} height={5} fill={`url(#pin-${id})`} />
      <rect x={79} y={71} width={2} height={5} fill={`url(#pin-${id})`} />
      <rect x={85.5} y={71} width={2} height={5} fill={`url(#pin-${id})`} />
      {/* power LED */}
      <circle cx={60} cy={66} r={7} fill="#34d399" opacity={on ? 0.3 : 0} />
      <circle cx={60} cy={66} r={2.6} fill={on ? "#34d399" : "#243049"} stroke={on ? "#0f8a5f" : "#11161f"} strokeWidth={0.6} />
      {on && <circle cx={59.2} cy={65.2} r={0.9} fill="#eafff5" />}
      {/* Fresnel dome */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#dome-${id})`} stroke="#b9bfc9" strokeWidth={1.2} />
      <g clipPath={`url(#domeclip-${id})`}>{facets}</g>
      <clipPath id={`domeclip-${id}`}>
        <ellipse cx={cx} cy={cy} rx={rx - 1} ry={ry - 1} />
      </clipPath>
      {/* top highlight */}
      <ellipse cx={cx - 9} cy={cy - 12} rx={13} ry={8} fill="#ffffff" opacity={0.5} />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="#ffffff" strokeWidth={0.8} opacity={0.5} />
    </g>
  );
}

function IrSensor({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  const obstacle = on;
  return (
    <g>
      <ellipse cx={60} cy={80} rx={42} ry={6} fill="#000" opacity={0.28} />
      {/* leads: 3-pin header on left, sensor cans face right */}
      <line x1={6} y1={44} x2={22} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={98} y1={44} x2={114} y2={44} stroke="#9aa3ad" strokeWidth={4} strokeLinecap="round" />
      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f6bd6" />
          <stop offset="0.5" stopColor="#1f53b8" />
          <stop offset="1" stopColor="#163f8f" />
        </linearGradient>
        <radialGradient id={`emit-${id}`} cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#fbfdff" />
          <stop offset="0.6" stopColor="#cfe0f2" />
          <stop offset="1" stopColor="#9fb6cf" />
        </radialGradient>
        <radialGradient id={`recv-${id}`} cx="0.5" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#4a4f57" />
          <stop offset="0.55" stopColor="#22262c" />
          <stop offset="1" stopColor="#0c0e11" />
        </radialGradient>
        <radialGradient id={`pot-${id}`} cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#3da3e8" />
          <stop offset="1" stopColor="#1364a8" />
        </radialGradient>
        <radialGradient id={`led-${id}`} cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#9bffc7" />
          <stop offset="1" stopColor="#34d399" />
        </radialGradient>
      </defs>
      {/* PCB board */}
      <rect x={22} y={20} width={74} height={48} rx={4} fill={`url(#pcb-${id})`} stroke="#10316f" strokeWidth={1} />
      <rect x={22} y={20} width={74} height={3} rx={1.5} fill="#5b8de0" opacity={0.5} />
      {/* mounting holes */}
      <circle cx={28} cy={26} r={2.4} fill="#0c2a5e" stroke="#c8b86a" strokeWidth={1} />
      <circle cx={28} cy={62} r={2.4} fill="#0c2a5e" stroke="#c8b86a" strokeWidth={1} />
      {/* 3-pin header VCC GND OUT (left) */}
      <rect x={20} y={36} width={9} height={16} rx={1} fill="#16181c" />
      <rect x={21.5} y={38.5} width={2.6} height={2.6} fill="#d9b24a" />
      <rect x={21.5} y={43.2} width={2.6} height={2.6} fill="#d9b24a" />
      <rect x={21.5} y={47.9} width={2.6} height={2.6} fill="#d9b24a" />
      {/* blue trimmer potentiometer */}
      <circle cx={47} cy={32} r={8} fill={`url(#pot-${id})`} stroke="#0e4f86" strokeWidth={1} />
      <circle cx={47} cy={32} r={5} fill="#0f5896" />
      <rect x={46.2} y={26.5} width={1.6} height={11} rx={0.8} fill="#e8b94a"
        transform={`rotate(${obstacle ? 35 : -20} 47 32)`} />
      {/* power + obstacle indicator LEDs */}
      <circle cx={47} cy={58} r={3.4} fill={on ? `url(#led-${id})` : "#243049"} stroke="#0e2350" strokeWidth={0.8} />
      {on && <circle cx={47} cy={58} r={7} fill="#34d399" opacity={0.3} />}
      <circle cx={62} cy={58} r={3.4} fill={obstacle ? "#ff5a4d" : "#3a1f24"} stroke="#0e2350" strokeWidth={0.8} />
      {obstacle && <circle cx={62} cy={58} r={7} fill="#ff5a4d" opacity={0.35} />}
      {/* front-edge LED cans facing forward (right side) */}
      <g>
        {/* emitter (clear) */}
        <ellipse cx={78} cy={36} rx={8} ry={9} fill="#0a1d3f" />
        <ellipse cx={78} cy={35} rx={7} ry={8} fill={`url(#emit-${id})`} stroke="#7e93ac" strokeWidth={0.8} />
        <ellipse cx={76} cy={31} rx={2.4} ry={3} fill="#ffffff" opacity={0.8} />
        {on && <ellipse cx={88} cy={35} rx={5} ry={7} fill="#a9c8ff" opacity={0.4} />}
        {/* receiver (black) */}
        <ellipse cx={78} cy={54} rx={8} ry={9} fill="#05070a" />
        <ellipse cx={78} cy={53} rx={7} ry={8} fill={`url(#recv-${id})`} stroke="#2c3138" strokeWidth={0.8} />
        <ellipse cx={76} cy={49} rx={2} ry={2.6} fill="#6b727b" opacity={0.6} />
      </g>
      {/* board top highlight */}
      <rect x={24} y={22} width={70} height={6} rx={3} fill="#ffffff" opacity={0.06} />
    </g>
  );
}

function SoilSensor({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  return (
    <g>
      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f6b4a" />
          <stop offset="0.5" stopColor="#175238" />
          <stop offset="1" stopColor="#0e3b27" />
        </linearGradient>
        <linearGradient id={`gold-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8a6a1f" />
          <stop offset="0.4" stopColor="#e8c659" />
          <stop offset="0.55" stopColor="#fff0b8" />
          <stop offset="0.7" stopColor="#e8c659" />
          <stop offset="1" stopColor="#8a6a1f" />
        </linearGradient>
        <linearGradient id={`hdr-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2f38" />
          <stop offset="1" stopColor="#11141a" />
        </linearGradient>
        <radialGradient id={`led-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#b6ffd9" />
          <stop offset="0.55" stopColor="#34d399" />
          <stop offset="1" stopColor="#0e7a4f" />
        </radialGradient>
      </defs>

      {/* shadow */}
      <ellipse cx={60} cy={80} rx={40} ry={5} fill="#000" opacity={0.28} />

      {/* leads to circuit pins (metal pins from header) */}
      <line x1={6} y1={44} x2={36} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={84} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />

      {/* top header connector */}
      <rect x={38} y={10} width={44} height={16} rx={2.5} fill={`url(#hdr-${id})`} stroke="#05070a" strokeWidth={0.8} />
      <circle cx={46} cy={18} r={2.2} fill="#0a0c10" />
      <circle cx={54} cy={18} r={2.2} fill="#0a0c10" />
      <circle cx={62} cy={18} r={2.2} fill="#0a0c10" />
      <circle cx={70} cy={18} r={2.2} fill="#0a0c10" />
      <rect x={45.4} y={17.4} width={1.2} height={1.2} fill="#d9b24a" />
      <rect x={53.4} y={17.4} width={1.2} height={1.2} fill="#d9b24a" />
      <rect x={61.4} y={17.4} width={1.2} height={1.2} fill="#d9b24a" />
      <rect x={69.4} y={17.4} width={1.2} height={1.2} fill="#d9b24a" />

      {/* fork-shaped PCB body */}
      <path
        d="M34 26 H86 V40 H66 V82 a3 3 0 0 1 -6 0 V40 H60 V82 a3 3 0 0 1 -6 0 V40 H34 Z"
        fill={`url(#pcb-${id})`}
        stroke="#0a2417"
        strokeWidth={1}
        strokeLinejoin="round"
      />
      <path d="M36 27 H84 V31 H36 Z" fill="#fff" opacity={0.07} />

      {/* gold prongs (tines) overlaid as plated faces */}
      <rect x={54} y={42} width={6} height={40} rx={2} fill={`url(#gold-${id})`} stroke="#7a5c18" strokeWidth={0.6} />
      <rect x={66} y={42} width={6} height={40} rx={2} fill={`url(#gold-${id})`} stroke="#7a5c18" strokeWidth={0.6} />
      {/* pointed tips */}
      <path d="M54 80 L57 86 L60 80 Z" fill={`url(#gold-${id})`} stroke="#7a5c18" strokeWidth={0.5} />
      <path d="M66 80 L69 86 L72 80 Z" fill={`url(#gold-${id})`} stroke="#7a5c18" strokeWidth={0.5} />

      {/* horizontal gold traces up each prong */}
      {[48, 54, 60, 66, 72].map((yy) => (
        <g key={yy}>
          <rect x={54.5} y={yy} width={5} height={1.6} rx={0.6} fill="#fbe08a" opacity={0.85} />
          <rect x={66.5} y={yy} width={5} height={1.6} rx={0.6} fill="#fbe08a" opacity={0.85} />
        </g>
      ))}

      {/* silkscreen label */}
      <rect x={38} y={32} width={12} height={5} rx={1} fill="#0a2417" opacity={0.6} />

      {/* power LED */}
      {on && <circle cx={78} cy={34} r={7} fill="#34d399" opacity={0.4} />}
      <circle cx={78} cy={34} r={3} fill={on ? `url(#led-${id})` : "#243049"} stroke="#0a0c10" strokeWidth={0.6} />
    </g>
  );
}

function Ldr({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  return (
    <g>
      {/* soft contact shadow */}
      <ellipse cx={60} cy={80} rx={34} ry={5.5} fill="#000" opacity={0.28} />

      {/* leads: tinned metal legs going down then bending to the pins */}
      <line x1={6} y1={44} x2={46} y2={44} stroke="#c8cdd4" strokeWidth={4} strokeLinecap="round" />
      <line x1={74} y1={44} x2={114} y2={44} stroke="#c8cdd4" strokeWidth={4} strokeLinecap="round" />
      {/* solder kink highlights on leads */}
      <line x1={10} y1={43} x2={44} y2={43} stroke="#eef1f4" strokeWidth={1} strokeLinecap="round" opacity={0.7} />
      <line x1={76} y1={43} x2={112} y2={43} stroke="#eef1f4" strokeWidth={1} strokeLinecap="round" opacity={0.7} />

      <defs>
        {/* dark bezel ring */}
        <radialGradient id={`bezel-${id}`} cx="42%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#3a3f47" />
          <stop offset="62%" stopColor="#23272d" />
          <stop offset="100%" stopColor="#0c0e11" />
        </radialGradient>
        {/* tan/orange ceramic disc face */}
        <radialGradient id={`face-${id}`} cx="40%" cy="32%" r="78%">
          <stop offset="0%" stopColor="#f0c98a" />
          <stop offset="48%" stopColor="#e0a85c" />
          <stop offset="82%" stopColor="#c1843c" />
          <stop offset="100%" stopColor="#9c6328" />
        </radialGradient>
        {/* clip so the serpentine track stays on the disc face */}
        <clipPath id={`faceclip-${id}`}>
          <circle cx={60} cy={42} r={25.5} />
        </clipPath>
        {/* glassy top highlight */}
        <radialGradient id={`gloss-${id}`} cx="38%" cy="26%" r="46%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* outer dark bezel */}
      <circle cx={60} cy={42} r={32} fill={`url(#bezel-${id})`} stroke="#070809" strokeWidth={1} />
      {/* inner rim shadow */}
      <circle cx={60} cy={42} r={27} fill="#161a1f" />
      {/* ceramic sensor face */}
      <circle cx={60} cy={42} r={25.5} fill={`url(#face-${id})`} />

      {/* serpentine cadmium-sulfide zig-zag track */}
      <g clipPath={`url(#faceclip-${id})`}>
        <path
          d="M40 28 H80 V33 H40 V38 H80 V43 H40 V48 H80 V53 H40 V58 H80"
          fill="none"
          stroke="#1a1410"
          strokeWidth={3.1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M40 28 H80 V33 H40 V38 H80 V43 H40 V48 H80 V53 H40 V58 H80"
          fill="none"
          stroke="#000"
          strokeWidth={1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.5}
        />
        {/* two metal contact combs at the ends of the snake */}
        <rect x={37} y={24} width={4.5} height={38} rx={1.4} fill="#8a8f96" />
        <rect x={78.5} y={24} width={4.5} height={38} rx={1.4} fill="#8a8f96" />
      </g>

      {/* face gloss highlight */}
      <circle cx={60} cy={42} r={25.5} fill={`url(#gloss-${id})`} />
      {/* thin bright rim catch-light */}
      <circle cx={60} cy={42} r={31.4} fill="none" stroke="#6a727c" strokeWidth={0.8} opacity={0.6} />

      {/* power LED indicator */}
      {on && <circle cx={60} cy={42} r={16} fill="#34d399" opacity={0.22} />}
      <circle cx={60} cy={42} r={3} fill={on ? "#34d399" : "#243049"} stroke="#0c0e11" strokeWidth={0.6} />
      {on && <circle cx={59} cy={41} r={1} fill="#eafff5" opacity={0.9} />}
    </g>
  );
}

function Dht11({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  const cols = [30, 44, 58, 72];
  const rows = [22, 32, 42, 52, 62];
  const holes: ReactNode[] = [];
  rows.forEach((cy, ri) => {
    cols.forEach((cx, ci) => {
      holes.push(
        <circle key={`h-${ri}-${ci}`} cx={cx} cy={cy} r={3.1} fill={`url(#hole-${id})`} stroke="#1c5d7e" strokeWidth={0.5} />
      );
    });
  });
  return (
    <g>
      <defs>
        <linearGradient id={`body-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6fc1e6" />
          <stop offset="0.45" stopColor="#48a7d8" />
          <stop offset="1" stopColor="#2e85b8" />
        </linearGradient>
        <radialGradient id={`hole-${id}`} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#2a3742" />
          <stop offset="0.6" stopColor="#16242e" />
          <stop offset="1" stopColor="#0a151c" />
        </radialGradient>
        <linearGradient id={`pin-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9c7c2e" />
          <stop offset="0.4" stopColor="#e9cf78" />
          <stop offset="0.6" stopColor="#d9b24a" />
          <stop offset="1" stopColor="#8f6f26" />
        </linearGradient>
        <linearGradient id={`base-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3f4a55" />
          <stop offset="1" stopColor="#222b33" />
        </linearGradient>
      </defs>

      <ellipse cx={60} cy={80} rx={40} ry={5.5} fill="#000" opacity={0.28} />

      {/* leads */}
      <line x1={6} y1={44} x2={28} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={92} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />

      {/* metal pin base strip */}
      <rect x={40} y={66} width={40} height={7} rx={1.5} fill={`url(#base-${id})`} />
      {[48, 60, 72].map((px, i) => (
        <rect key={`p-${i}`} x={px - 1.6} y={70} width={3.2} height={12} rx={1} fill={`url(#pin-${id})`} stroke="#7a5e1f" strokeWidth={0.4} />
      ))}

      {/* blue perforated body (hero) */}
      <rect x={28} y={12} width={64} height={56} rx={5} fill={`url(#body-${id})`} stroke="#1c5d7e" strokeWidth={1.5} />
      {/* inner recessed grille panel */}
      <rect x={33} y={16} width={54} height={48} rx={3} fill="#3f99cb" stroke="#226a93" strokeWidth={1} />
      <rect x={33} y={16} width={54} height={6} rx={3} fill="#ffffff" opacity={0.18} />

      {holes}

      {/* top highlight on case */}
      <rect x={31} y={13.5} width={58} height={4} rx={2} fill="#ffffff" opacity={0.3} />

      {/* power LED */}
      {on && <circle cx={84} cy={20} r={7} fill="#34d399" opacity={0.32} />}
      <circle cx={84} cy={20} r={2.8} fill={on ? "#34d399" : "#243049"} stroke="#0c1a14" strokeWidth={0.6} />
      {on && <circle cx={83} cy={19} r={1} fill="#d7fff0" opacity={0.9} />}
    </g>
  );
}

function Lm35({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  return (
    <g>
      {/* shadow */}
      <ellipse cx={60} cy={78} rx={34} ry={6} fill="#000" opacity={0.3} />

      {/* leads (silver legs) — left pin to art, art to right pin */}
      <line x1={6} y1={44} x2={48} y2={70} stroke={`url(#leg-${id})`} strokeWidth={4} strokeLinecap="round" />
      <line x1={114} y1={44} x2={72} y2={70} stroke={`url(#leg-${id})`} strokeWidth={4} strokeLinecap="round" />
      {/* three splayed legs going down */}
      <line x1={48} y1={56} x2={42} y2={84} stroke={`url(#leg-${id})`} strokeWidth={3.4} strokeLinecap="round" />
      <line x1={60} y1={56} x2={60} y2={86} stroke={`url(#leg-${id})`} strokeWidth={3.4} strokeLinecap="round" />
      <line x1={72} y1={56} x2={78} y2={84} stroke={`url(#leg-${id})`} strokeWidth={3.4} strokeLinecap="round" />

      <defs>
        <linearGradient id={`leg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f4f6f8" />
          <stop offset="45%" stopColor="#b8bfc6" />
          <stop offset="100%" stopColor="#7c848c" />
        </linearGradient>
        <linearGradient id={`body-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a3d42" />
          <stop offset="22%" stopColor="#26282c" />
          <stop offset="78%" stopColor="#141518" />
          <stop offset="100%" stopColor="#0a0b0d" />
        </linearGradient>
        <radialGradient id={`hl-${id}`} cx="0.36" cy="0.22" r="0.6">
          <stop offset="0%" stopColor="#6b6f76" stopOpacity={0.85} />
          <stop offset="55%" stopColor="#2c2e33" stopOpacity={0.2} />
          <stop offset="100%" stopColor="#000" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`glow-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#34d399" stopOpacity={0.85} />
          <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* TO-92 body: flat-front, rounded-back D-shape */}
      <path
        d="M 34 50 L 34 30 Q 34 12 60 12 Q 86 12 86 30 L 86 50 Q 86 56 80 56 L 40 56 Q 34 56 34 50 Z"
        fill={`url(#body-${id})`}
        stroke="#000"
        strokeWidth={1}
      />
      {/* rounded back depth shading band */}
      <path
        d="M 34 30 Q 34 12 60 12 Q 86 12 86 30 L 86 36 Q 60 26 34 36 Z"
        fill="#000"
        opacity={0.18}
      />
      {/* overall plastic highlight */}
      <path
        d="M 34 50 L 34 30 Q 34 12 60 12 Q 86 12 86 30 L 86 50 Q 86 56 80 56 L 40 56 Q 34 56 34 50 Z"
        fill={`url(#hl-${id})`}
      />
      {/* flat front face vertical highlight strip */}
      <rect x={40} y={20} width={5} height={34} rx={2} fill="#fff" opacity={0.07} />

      {/* silkscreen text */}
      <text x={60} y={36} textAnchor="middle" fontSize={9} fontWeight={700} fontFamily="monospace" fill="#e6e8ea" opacity={0.82}>LM35</text>
      <text x={60} y={47} textAnchor="middle" fontSize={4.6} fontFamily="monospace" fill="#b9bdc2" opacity={0.7}>DZ</text>

      {/* power LED on flat face */}
      {on && <circle cx={73} cy={45} r={8} fill={`url(#glow-${id})`} />}
      <circle cx={73} cy={45} r={2.6} fill={on ? "#34d399" : "#243049"} stroke="#000" strokeWidth={0.5} />
      {on && <circle cx={72.2} cy={44.2} r={0.9} fill="#d6ffe9" />}
    </g>
  );
}

function WaterSensor({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  const combs = Array.from({ length: 10 });
  return (
    <g>
      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f6b4a" />
          <stop offset="0.5" stopColor="#13573a" />
          <stop offset="1" stopColor="#0c3f2a" />
        </linearGradient>
        <linearGradient id={`gold-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe9a8" />
          <stop offset="0.45" stopColor="#e6b94e" />
          <stop offset="1" stopColor="#b3852a" />
        </linearGradient>
        <linearGradient id={`pin-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0d27a" />
          <stop offset="1" stopColor="#c79a3a" />
        </linearGradient>
        <radialGradient id={`chip-${id}`} cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#4a4f57" />
          <stop offset="1" stopColor="#15171b" />
        </radialGradient>
      </defs>

      {/* shadow */}
      <ellipse cx={60} cy={80} rx={34} ry={5} fill="#000" opacity={0.28} />

      {/* leads to circuit pins */}
      <line x1={6} y1={44} x2={40} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={80} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />

      {/* PCB body */}
      <rect x={40} y={10} width={40} height={68} rx={3} fill={`url(#pcb-${id})`} stroke="#082a1d" strokeWidth={1} />
      {/* top highlight */}
      <rect x={42} y={12} width={36} height={6} rx={2} fill="#ffffff" opacity={0.08} />

      {/* mounting hole */}
      <circle cx={60} cy={16} r={3.2} fill="#0a3324" stroke="#d9b24a" strokeWidth={1.2} />

      {/* 3-pin header */}
      <rect x={49} y={22} width={22} height={9} rx={1.5} fill="#0a0d12" />
      {[53, 60, 67].map((cx, i) => (
        <rect key={i} x={cx - 1.4} y={24} width={2.8} height={5} rx={0.6} fill={`url(#pin-${id})`} />
      ))}

      {/* tiny chip */}
      <rect x={48.5} y={34} width={10} height={7} rx={1} fill={`url(#chip-${id})`} stroke="#000" strokeWidth={0.4} />
      <circle cx={50} cy={37.5} r={0.8} fill="#888" />

      {/* small SMD resistors */}
      <rect x={63} y={34} width={6} height={3} rx={0.5} fill="#2a2218" />
      <rect x={63} y={38} width={6} height={3} rx={0.5} fill="#2a2218" />

      {/* sensing area: interdigitated gold comb */}
      <rect x={43} y={45} width={34} height={30} rx={2} fill="#0e3a27" />
      {combs.map((_, i) => {
        const x = 45 + i * 3.1;
        return (
          <rect key={i} x={x} y={47} width={1.6} height={26} rx={0.6} fill={`url(#gold-${id})`} />
        );
      })}
      {/* connecting bus bars top/bottom alternating */}
      <rect x={44.5} y={47} width={32} height={1.6} fill={`url(#gold-${id})`} opacity={0.9} />
      <rect x={44.5} y={71.5} width={32} height={1.6} fill={`url(#gold-${id})`} opacity={0.9} />
      {/* sheen over gold */}
      <rect x={44.5} y={47} width={32} height={9} fill="#ffffff" opacity={0.1} />

      {/* power LED */}
      {on && <circle cx={73} cy={28} r={6} fill="#34d399" opacity={0.35} />}
      <circle cx={73} cy={28} r={2.3} fill={on ? "#34d399" : "#243049"} stroke="#0a0d12" strokeWidth={0.6} />
      {on && <circle cx={72.3} cy={27.3} r={0.8} fill="#eafff4" />}
    </g>
  );
}

function GasSensor({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  const mesh = [];
  // diagonal mesh lines across the dome (clipped to dome shape)
  for (let i = -10; i <= 10; i++) {
    mesh.push(
      <line key={`a${i}`} x1={60 + i * 5 - 22} y1={6} x2={60 + i * 5 + 22} y2={50} stroke={`url(#wire-${id})`} strokeWidth={0.7} opacity={0.55} />
    );
    mesh.push(
      <line key={`b${i}`} x1={60 + i * 5 + 22} y1={6} x2={60 + i * 5 - 22} y2={50} stroke={`url(#wire-${id})`} strokeWidth={0.7} opacity={0.55} />
    );
  }
  return (
    <g>
      {/* shadow */}
      <ellipse cx={60} cy={80} rx={30} ry={5} fill="#000" opacity={0.3} />

      {/* leads */}
      <line x1={6} y1={44} x2={40} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={80} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />

      <defs>
        <radialGradient id={`dome-${id}`} cx="38%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#fafcfe" />
          <stop offset="35%" stopColor="#cdd6dd" />
          <stop offset="70%" stopColor="#8e9aa3" />
          <stop offset="100%" stopColor="#5d676e" />
        </radialGradient>
        <linearGradient id={`wire-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c878e" />
          <stop offset="100%" stopColor="#3f474c" />
        </linearGradient>
        <linearGradient id={`rim-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8edf1" />
          <stop offset="45%" stopColor="#aab4bb" />
          <stop offset="100%" stopColor="#6a747b" />
        </linearGradient>
        <radialGradient id={`board-${id}`} cx="50%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#2f6db5" />
          <stop offset="100%" stopColor="#1b4a82" />
        </radialGradient>
        <clipPath id={`domeclip-${id}`}>
          <path d="M38 50 L38 30 A22 22 0 0 1 82 30 L82 50 Z" />
        </clipPath>
      </defs>

      {/* blue PCB board */}
      <ellipse cx={60} cy={60} rx={32} ry={11} fill={`url(#board-${id})`} stroke="#12356a" strokeWidth={1} />
      <ellipse cx={60} cy={57} rx={32} ry={11} fill="#3573bd" />
      <ellipse cx={60} cy={57} rx={32} ry={11} fill="none" stroke="#1d4f8f" strokeWidth={1} />
      {/* solder pads / legs */}
      {[-22, -13, -4, 5, 14, 23].map((dx, k) => (
        <g key={`leg${k}`}>
          <line x1={60 + dx} y1={62} x2={60 + dx * 0.9} y2={76} stroke="#c9cdd1" strokeWidth={2.4} strokeLinecap="round" />
          <line x1={60 + dx} y1={62} x2={60 + dx * 0.9} y2={76} stroke="#8a8f93" strokeWidth={0.8} />
          <circle cx={60 + dx} cy={57} r={2.4} fill="#cfd6dc" stroke="#7d858b" strokeWidth={0.6} />
        </g>
      ))}

      {/* crimped rolled rim */}
      <ellipse cx={60} cy={50} rx={24} ry={6.5} fill={`url(#rim-${id})`} stroke="#5d676e" strokeWidth={0.8} />
      <ellipse cx={60} cy={49} rx={24} ry={5.5} fill="none" stroke="#eef2f5" strokeWidth={0.8} opacity={0.7} />

      {/* steel mesh dome */}
      <path d="M38 50 L38 30 A22 22 0 0 1 82 30 L82 50 Z" fill={`url(#dome-${id})`} stroke="#525c63" strokeWidth={1} />
      <g clipPath={`url(#domeclip-${id})`}>{mesh}</g>
      {/* top crimp seam of dome */}
      <path d="M38 30 A22 22 0 0 1 82 30" fill="none" stroke="#4c565d" strokeWidth={1.2} />
      {/* specular highlight */}
      <ellipse cx={50} cy={24} rx={9} ry={6} fill="#ffffff" opacity={0.45} clipPath={`url(#domeclip-${id})`} />
      <path d="M38 50 L38 30 A22 22 0 0 1 82 30 L82 50 Z" fill="none" stroke="#2f373c" strokeWidth={1} opacity={0.5} />

      {/* power LED */}
      {on && <circle cx={86} cy={58} r={7} fill="#34d399" opacity={0.35} />}
      <circle cx={86} cy={58} r={2.8} fill={on ? "#34d399" : "#243049"} stroke="#0c1422" strokeWidth={0.7} />
      {on && <circle cx={85} cy={57} r={1} fill="#eafff5" />}
    </g>
  );
}

function FlameSensor({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  return (
    <g>
      <ellipse cx={60} cy={80} rx={42} ry={6} fill="#000" opacity={0.28} />
      {/* leads */}
      <line x1={6} y1={44} x2={24} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={96} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e3a5f" />
          <stop offset="0.5" stopColor="#13294a" />
          <stop offset="1" stopColor="#0c1a33" />
        </linearGradient>
        <radialGradient id={`dome-${id}`} cx="0.38" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#3a4a66" />
          <stop offset="0.45" stopColor="#15233d" />
          <stop offset="1" stopColor="#05080f" />
        </radialGradient>
        <linearGradient id={`pot-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b6fd1" />
          <stop offset="1" stopColor="#1c3f8a" />
        </linearGradient>
        <radialGradient id={`halo-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#34d399" stopOpacity={0.9} />
          <stop offset="1" stopColor="#34d399" stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* PCB board */}
      <rect x={24} y={20} width={72} height={48} rx={4} fill={`url(#pcb-${id})`} stroke="#091627" strokeWidth={1} />
      <rect x={24} y={20} width={72} height={6} rx={3} fill="#fff" opacity={0.07} />
      {/* mounting holes */}
      <circle cx={31} cy={27} r={2.6} fill="#0a1526" stroke="#c9b35a" strokeWidth={0.8} />
      <circle cx={31} cy={61} r={2.6} fill="#0a1526" stroke="#c9b35a" strokeWidth={0.8} />
      {/* IR photodiode dome at front (left of board face) */}
      <ellipse cx={40} cy={44} rx={11} ry={11.5} fill="#04060c" opacity={0.5} />
      <circle cx={40} cy={44} r={10.5} fill={`url(#dome-${id})`} stroke="#02040a" strokeWidth={1} />
      <ellipse cx={36.5} cy={40} rx={3.5} ry={2.6} fill="#7fa8d8" opacity={0.55} />
      <ellipse cx={42} cy={47} rx={5} ry={4} fill="#0a1830" opacity={0.6} />
      {/* blue trimmer pot */}
      <rect x={58} y={30} width={16} height={16} rx={2} fill={`url(#pot-${id})`} stroke="#0e2a5e" strokeWidth={1} />
      <circle cx={66} cy={38} r={5.2} fill="#cfd6e0" stroke="#8893a3" strokeWidth={0.8} />
      <rect x={65.2} y={33.5} width={1.6} height={9} rx={0.6} fill="#5a6271" transform="rotate(28 66 38)" />
      {/* two indicator LEDs */}
      <circle cx={80} cy={52} r={3.2} fill={on ? "#34d399" : "#243049"} stroke="#0a1526" strokeWidth={0.7} />
      <circle cx={88} cy={52} r={3.2} fill="#c23b3b" stroke="#0a1526" strokeWidth={0.7} />
      {/* power LED glow */}
      {on && <circle cx={80} cy={52} r={9} fill={`url(#halo-${id})`} />}
      {on && <circle cx={80} cy={52} r={1.4} fill="#d7fff0" />}
      {/* 3-pin header */}
      <rect x={57} y={58} width={26} height={7} rx={1.5} fill="#101622" stroke="#05080f" strokeWidth={0.6} />
      <rect x={60} y={59.5} width={2} height={4} fill="#d9b24a" />
      <rect x={69} y={59.5} width={2} height={4} fill="#d9b24a" />
      <rect x={78} y={59.5} width={2} height={4} fill="#d9b24a" />
      {/* solder pads near dome */}
      <circle cx={40} cy={58} r={1.4} fill="#c9b35a" />
      <circle cx={40} cy={30} r={1.4} fill="#c9b35a" />
      {/* flame flickers when on */}
      {on && (
        <g style={{ transformOrigin: "26px 44px", animation: "cl-spin 0s" }}>
          <path d="M22 40 q-3 -5 0 -10 q2 4 4 2 q1 6 -4 8 Z" fill="#ff8a1e" opacity={0.9} />
          <path d="M22 41 q-1.5 -3 0 -6 q1.5 2.5 1.5 6 Z" fill="#ffd24a" />
          <path d="M16 44 q-2 -4 0 -8 q2 3 3 1 q0 5 -3 7 Z" fill="#ff7a12" opacity={0.8} />
        </g>
      )}
    </g>
  );
}

function TouchSensor({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  return (
    <g>
      {/* shadow */}
      <ellipse cx={60} cy={80} rx={40} ry={6} fill="#000" opacity={0.28} />

      {/* gradients */}
      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5b3fb0" />
          <stop offset="0.5" stopColor="#4a2f9c" />
          <stop offset="1" stopColor="#371f78" />
        </linearGradient>
        <radialGradient id={`pad-${id}`} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#ffe9a8" />
          <stop offset="0.5" stopColor="#e8bf63" />
          <stop offset="1" stopColor="#b8852e" />
        </radialGradient>
        <linearGradient id={`pin-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f1d27a" />
          <stop offset="1" stopColor="#b88a2e" />
        </linearGradient>
        <radialGradient id={`led-${id}`} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor={on ? "#bbf7d0" : "#3a4658"} />
          <stop offset="1" stopColor={on ? "#16a34a" : "#243049"} />
        </radialGradient>
      </defs>

      {/* left lead (signal wire) and right lead (pin) */}
      <line x1={6} y1={44} x2={22} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={98} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />

      {/* PCB body */}
      <rect x={22} y={14} width={76} height={60} rx={5} fill={`url(#pcb-${id})`} stroke="#2c1860" strokeWidth={1.2} />
      {/* top highlight */}
      <rect x={24} y={16} width={72} height={10} rx={4} fill="#fff" opacity={0.08} />

      {/* mounting holes */}
      <circle cx={29} cy={21} r={2.4} fill="#1f1450" />
      <circle cx={91} cy={21} r={2.4} fill="#1f1450" />

      {/* copper touch pad (keyhole / rounded square) */}
      <rect x={36} y={26} width={42} height={34} rx={8} fill={`url(#pad-${id})`} stroke="#8a6420" strokeWidth={1} />
      <circle cx={57} cy={43} r={11} fill="#4a2f9c" opacity={0.32} />
      <rect x={40} y={29} width={20} height={4} rx={2} fill="#fff" opacity={0.25} />
      {/* TTP223 text */}
      <text x={57} y={56} fontSize={5.2} fill="#5a3f10" textAnchor="middle" fontFamily="monospace" fontWeight="bold">TTP223</text>

      {/* indicator LED with glow */}
      {on && <circle cx={86} cy={43} r={9} fill="#34d399" opacity={0.35} />}
      <circle cx={86} cy={43} r={4.2} fill={`url(#led-${id})`} stroke="#15301f" strokeWidth={0.6} />
      {on && <circle cx={84.6} cy={41.6} r={1.3} fill="#eaffef" opacity={0.85} />}

      {/* 3-pin header at bottom */}
      <rect x={43} y={64} width={34} height={9} rx={1.5} fill="#1a1340" stroke="#0e0a2a" strokeWidth={0.6} />
      <rect x={47} y={66} width={3.5} height={9} rx={0.6} fill={`url(#pin-${id})`} />
      <rect x={58} y={66} width={3.5} height={9} rx={0.6} fill={`url(#pin-${id})`} />
      <rect x={69} y={66} width={3.5} height={9} rx={0.6} fill={`url(#pin-${id})`} />
    </g>
  );
}

function TiltSensor({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  const canLeft = 30;
  const canRight = 92;
  return (
    <g>
      <defs>
        <linearGradient id={`metal-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fcfdff" />
          <stop offset="0.18" stopColor="#e6ebf0" />
          <stop offset="0.5" stopColor="#aeb6bf" />
          <stop offset="0.82" stopColor="#7f868f" />
          <stop offset="1" stopColor="#5c6168" />
        </linearGradient>
        <radialGradient id={`cap-${id}`} cx="0.35" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#f4f7fa" />
          <stop offset="0.6" stopColor="#bcc3cb" />
          <stop offset="1" stopColor="#6f757c" />
        </radialGradient>
        <linearGradient id={`board-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c6b3a" />
          <stop offset="1" stopColor="#0e4524" />
        </linearGradient>
        <radialGradient id={`ball-${id}`} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#fbe9b0" />
          <stop offset="0.5" stopColor="#d9b24a" />
          <stop offset="1" stopColor="#8a6d1f" />
        </radialGradient>
      </defs>

      {/* shadow */}
      <ellipse cx={60} cy={76} rx={46} ry={7} fill="#000" opacity={0.28} />

      {/* leads */}
      <line x1={6} y1={44} x2={canLeft} y2={40} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={6} y1={44} x2={canLeft} y2={48} stroke="#c8a23e" strokeWidth={3} strokeLinecap="round" />
      <line x1={canRight} y1={44} x2={114} y2={44} stroke="#9aa0a8" strokeWidth={4} strokeLinecap="round" />

      {/* module board */}
      <rect x={26} y={56} width={68} height={14} rx={2.5} fill={`url(#board-${id})`} stroke="#0a3219" strokeWidth={1} />
      <rect x={30} y={59} width={6} height={4} rx={1} fill="#cdd3d8" opacity={0.7} />
      <rect x={84} y={59} width={6} height={4} rx={1} fill="#cdd3d8" opacity={0.7} />

      {/* metal can body */}
      <rect x={canLeft} y={28} width={canRight - canLeft} height={32} rx={16} fill={`url(#metal-${id})`} stroke="#5c6168" strokeWidth={1} />
      {/* rounded end caps */}
      <ellipse cx={canLeft + 2} cy={44} rx={4} ry={16} fill={`url(#cap-${id})`} stroke="#666c73" strokeWidth={0.8} />
      <ellipse cx={canRight - 2} cy={44} rx={4} ry={16} fill={`url(#cap-${id})`} stroke="#666c73" strokeWidth={0.8} />

      {/* seam */}
      <line x1={canLeft + 4} y1={36} x2={canRight - 4} y2={36} stroke="#ffffff" strokeWidth={1} opacity={0.55} />
      <line x1={canLeft + 4} y1={52} x2={canRight - 4} y2={52} stroke="#4f555b" strokeWidth={1} opacity={0.7} />
      <line x1={canLeft + 28} y1={29} x2={canLeft + 28} y2={59} stroke="#7d848b" strokeWidth={0.8} opacity={0.6} />

      {/* top highlight */}
      <rect x={canLeft + 4} y={31} width={canRight - canLeft - 8} height={5} rx={2.5} fill="#ffffff" opacity={0.45} />

      {/* rolling ball hint (slides toward right when on / tilted) */}
      <g style={{ transition: "transform 0.4s ease" }} transform={on ? `translate(${canRight - 16},44)` : `translate(${canLeft + 14},44)`}>
        <circle cx={0} cy={0} r={5.5} fill={`url(#ball-${id})`} opacity={0.85} />
        <circle cx={-1.6} cy={-1.6} r={1.6} fill="#fff" opacity={0.7} />
      </g>

      {/* power LED */}
      {on && <circle cx={canRight + 2} cy={26} r={8} fill="#34d399" opacity={0.3} />}
      <circle cx={canRight + 2} cy={26} r={3} fill={on ? "#34d399" : "#243049"} stroke="#11161f" strokeWidth={0.8} />
      {on && <circle cx={canRight + 1} cy={25} r={1} fill="#d6ffe9" opacity={0.9} />}
    </g>
  );
}

function RainSensor({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  // serpentine interdigitated comb: many vertical fingers joined by left/right buses
  const fingers = [];
  const x0 = 28, x1 = 92, top = 26, bot = 68;
  const cols = 13;
  const step = (x1 - x0) / (cols - 1);
  for (let i = 0; i < cols; i++) {
    const x = x0 + i * step;
    const fromTop = i % 2 === 0; // alternating combs
    const y1 = fromTop ? top : top + 5;
    const y2 = fromTop ? bot - 5 : bot;
    fingers.push(
      <line key={i} x1={x} y1={y1} x2={x} y2={y2} stroke={`url(#gold-${id})`} strokeWidth={2.4} strokeLinecap="round" />
    );
  }
  return (
    <g>
      <ellipse cx={60} cy={80} rx={46} ry={6} fill="#000" opacity={0.3} />
      {/* leads */}
      <line x1={6} y1={44} x2={20} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={100} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />

      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d2b22" />
          <stop offset="0.5" stopColor="#0e1a12" />
          <stop offset="1" stopColor="#06120b" />
        </linearGradient>
        <linearGradient id={`gold-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe89a" />
          <stop offset="0.5" stopColor="#e8c25a" />
          <stop offset="1" stopColor="#b98e2c" />
        </linearGradient>
        <linearGradient id={`hdr-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2a2e" />
          <stop offset="1" stopColor="#101013" />
        </linearGradient>
        <radialGradient id={`pin-${id}`} cx="0.4" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff0c0" />
          <stop offset="1" stopColor="#b98e2c" />
        </radialGradient>
        <radialGradient id={`led-${id}`} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor={on ? "#bbf7d0" : "#33414f"} />
          <stop offset="1" stopColor={on ? "#34d399" : "#243049"} />
        </radialGradient>
      </defs>

      {/* PCB body */}
      <rect x={20} y={14} width={80} height={60} rx={4} fill={`url(#pcb-${id})`} stroke="#04140c" strokeWidth={1.2} />
      {/* corner mounting holes */}
      <circle cx={26} cy={20} r={2.4} fill="#05100a" stroke={`url(#gold-${id})`} strokeWidth={1.1} />
      <circle cx={94} cy={20} r={2.4} fill="#05100a" stroke={`url(#gold-${id})`} strokeWidth={1.1} />
      <circle cx={26} cy={68} r={2.4} fill="#05100a" stroke={`url(#gold-${id})`} strokeWidth={1.1} />
      <circle cx={94} cy={68} r={2.4} fill="#05100a" stroke={`url(#gold-${id})`} strokeWidth={1.1} />

      {/* hero: interdigitated gold combs */}
      {/* top bus (comb A) */}
      <line x1={x0} y1={top} x2={x1 - step} y2={top} stroke={`url(#gold-${id})`} strokeWidth={3.2} strokeLinecap="round" />
      {/* bottom bus (comb B) */}
      <line x1={x0 + step} y1={bot} x2={x1} y2={bot} stroke={`url(#gold-${id})`} strokeWidth={3.2} strokeLinecap="round" />
      {fingers}

      {/* header strip at top edge */}
      <rect x={36} y={14} width={48} height={9} rx={1.5} fill={`url(#hdr-${id})`} stroke="#000" strokeWidth={0.6} />
      <circle cx={45} cy={18.5} r={1.6} fill={`url(#pin-${id})`} />
      <circle cx={54} cy={18.5} r={1.6} fill={`url(#pin-${id})`} />
      <circle cx={63} cy={18.5} r={1.6} fill={`url(#pin-${id})`} />
      <circle cx={72} cy={18.5} r={1.6} fill={`url(#pin-${id})`} />

      {/* top highlight */}
      <rect x={22} y={16} width={76} height={5} rx={3} fill="#ffffff" opacity={0.06} />

      {/* power LED */}
      {on && <circle cx={92} cy={68} r={7.5} fill="#34d399" opacity={0.35} />}
      <circle cx={92} cy={68} r={3} fill={`url(#led-${id})`} stroke="#0c1a14" strokeWidth={0.7} />
      {on && <circle cx={91} cy={67} r={1} fill="#eafff4" opacity={0.9} />}
    </g>
  );
}

function SoundSensor({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  return (
    <g>
      {/* leads: 4-pin header style metal pins */}
      <line x1={6} y1={44} x2={20} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={100} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />

      {/* shadow */}
      <ellipse cx={60} cy={80} rx={42} ry={6} fill="#000" opacity={0.3} />

      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f6fd6" />
          <stop offset="0.5" stopColor="#1f54ad" />
          <stop offset="1" stopColor="#163f85" />
        </linearGradient>
        <radialGradient id={`mic-${id}`} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#c9ccd2" />
          <stop offset="0.5" stopColor="#8e939c" />
          <stop offset="1" stopColor="#3a3d44" />
        </radialGradient>
        <radialGradient id={`micface-${id}`} cx="0.4" cy="0.35" r="0.85">
          <stop offset="0" stopColor="#6f747d" />
          <stop offset="0.6" stopColor="#4a4d54" />
          <stop offset="1" stopColor="#24262b" />
        </radialGradient>
        <linearGradient id={`pin-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3d97a" />
          <stop offset="1" stopColor="#b8902f" />
        </linearGradient>
      </defs>

      {/* PCB board */}
      <rect x={20} y={20} width={80} height={48} rx={4} fill={`url(#pcb-${id})`} stroke="#0e2c5e" strokeWidth={1} />
      <rect x={20} y={20} width={80} height={5} rx={4} fill="#fff" opacity={0.12} />
      {/* mounting holes */}
      <circle cx={26} cy={26} r={2.4} fill="#0e2c5e" />
      <circle cx={26} cy={62} r={2.4} fill="#0e2c5e" />
      <circle cx={26} cy={26} r={1.2} fill="#c9ccd2" />
      <circle cx={26} cy={62} r={1.2} fill="#c9ccd2" />

      {/* blue trimmer potentiometer */}
      <rect x={36} y={48} width={16} height={14} rx={1.5} fill="#1746a0" stroke="#0c2552" strokeWidth={0.8} />
      <circle cx={44} cy={54} r={4.6} fill="#3a6bd0" stroke="#0c2552" strokeWidth={0.6} />
      <rect x={43.2} y={50} width={1.6} height={8} rx={0.5} fill="#e8c24a" />

      {/* indicator LEDs */}
      <circle cx={64} cy={58} r={3} fill="#7a1d1d" stroke="#4a0f0f" strokeWidth={0.6} />
      <circle cx={63} cy={57} r={1} fill="#ff8a8a" opacity={0.7} />
      {on && <circle cx={64} cy={58} r={6} fill="#34d399" opacity={0.35} />}
      <circle cx={64} cy={58} r={0} fill="none" />

      {/* power LED (green) */}
      {on && <circle cx={82} cy={58} r={7} fill="#34d399" opacity={0.4} />}
      <circle cx={82} cy={58} r={3} fill={on ? "#34d399" : "#243049"} stroke={on ? "#0f9d6e" : "#11203a"} strokeWidth={0.6} />
      {on && <circle cx={81} cy={57} r={1.1} fill="#d6fff0" opacity={0.85} />}

      {/* electret microphone can (standing prominent) */}
      <ellipse cx={66} cy={40} rx={20} ry={19} fill="#1a1c20" opacity={0.4} />
      <circle cx={64} cy={38} r={19} fill={`url(#mic-${id})`} stroke="#2a2c30" strokeWidth={1} />
      {/* seam ring */}
      <circle cx={64} cy={38} r={16.5} fill="none" stroke="#2a2c30" strokeWidth={1.2} opacity={0.7} />
      {/* mic face */}
      <circle cx={64} cy={38} r={15} fill={`url(#micface-${id})`} />
      {/* fabric speckle texture */}
      <circle cx={58} cy={33} r={1} fill="#2a2c30" opacity={0.5} />
      <circle cx={70} cy={35} r={1} fill="#2a2c30" opacity={0.5} />
      <circle cx={60} cy={43} r={1} fill="#2a2c30" opacity={0.5} />
      <circle cx={69} cy={44} r={1} fill="#2a2c30" opacity={0.5} />
      <circle cx={64} cy={31} r={1} fill="#2a2c30" opacity={0.5} />
      {/* centre hole */}
      <circle cx={64} cy={38} r={3.4} fill="#0c0d10" stroke="#5a5d64" strokeWidth={0.8} />
      <circle cx={64} cy={38} r={1.4} fill="#000" />
      {/* top highlight */}
      <ellipse cx={57} cy={29} rx={6} ry={3.5} fill="#fff" opacity={0.28} transform="rotate(-30 57 29)" />

      {/* 4-pin header on right */}
      <rect x={88} y={30} width={10} height={28} rx={1.5} fill="#16181c" stroke="#000" strokeWidth={0.6} />
      <rect x={91} y={32} width={4} height={5} rx={0.6} fill={`url(#pin-${id})`} />
      <rect x={91} y={38.5} width={4} height={5} rx={0.6} fill={`url(#pin-${id})`} />
      <rect x={91} y={45} width={4} height={5} rx={0.6} fill={`url(#pin-${id})`} />
      <rect x={91} y={51.5} width={4} height={5} rx={0.6} fill={`url(#pin-${id})`} />

      {/* label */}
      <rect x={36} y={63} width={26} height={3.6} rx={1} fill="#fff" opacity={0.85} />
    </g>
  );
}

function RelayModule({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  return (
    <g>
      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b6fb0" />
          <stop offset="0.5" stopColor="#1f5790" />
          <stop offset="1" stopColor="#164472" />
        </linearGradient>
        <linearGradient id={`relay-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4f8fe0" />
          <stop offset="0.18" stopColor="#3a78d0" />
          <stop offset="0.85" stopColor="#1f57ad" />
          <stop offset="1" stopColor="#163f82" />
        </linearGradient>
        <linearGradient id={`relaytop-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6ba6ee" />
          <stop offset="1" stopColor="#3f7fd6" />
        </linearGradient>
        <linearGradient id={`term-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#27a857" />
          <stop offset="0.5" stopColor="#1c8f47" />
          <stop offset="1" stopColor="#136e35" />
        </linearGradient>
        <radialGradient id={`screw-${id}`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fdfdfd" />
          <stop offset="0.5" stopColor="#c8ccd2" />
          <stop offset="1" stopColor="#7d828a" />
        </radialGradient>
        <radialGradient id={`led-${id}`} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor={on ? "#ff8a8a" : "#7a2530"} />
          <stop offset="0.6" stopColor={on ? "#ef3b3b" : "#5a1a22"} />
          <stop offset="1" stopColor={on ? "#b51d1d" : "#3c1118"} />
        </radialGradient>
        <radialGradient id={`pwr-${id}`} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor={on ? "#bbf7d6" : "#2c3a4c"} />
          <stop offset="1" stopColor={on ? "#34d399" : "#243049"} />
        </radialGradient>
      </defs>

      {/* shadow */}
      <ellipse cx="60" cy="80" rx="50" ry="6" fill="#000" opacity="0.3" />

      {/* leads */}
      <line x1={6} y1={44} x2={14} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={106} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />

      {/* PCB */}
      <rect x="14" y="16" width="92" height="56" rx="4" fill={`url(#pcb-${id})`} stroke="#10355c" strokeWidth="1" />
      <rect x="14" y="16" width="92" height="4" rx="2" fill="#ffffff" opacity="0.12" />
      {/* mounting holes */}
      <circle cx="20" cy="22" r="2.2" fill="#0e2c4d" stroke="#c9cdd3" strokeWidth="0.8" />
      <circle cx="100" cy="66" r="2.2" fill="#0e2c4d" stroke="#c9cdd3" strokeWidth="0.8" />

      {/* green screw terminal block (left) */}
      <rect x="14" y="26" width="22" height="36" rx="2" fill={`url(#term-${id})`} stroke="#0d5a2b" strokeWidth="1" />
      <rect x="14" y="26" width="22" height="3" rx="1.5" fill="#ffffff" opacity="0.18" />
      {[33, 44, 55].map((cy, i) => (
        <g key={i}>
          <rect x="17" y={cy - 4.5} width="16" height="9" rx="1" fill="#0f6b34" opacity="0.6" />
          <circle cx="25" cy={cy} r="3.4" fill={`url(#screw-${id})`} stroke="#5f646b" strokeWidth="0.6" />
          <path d={`M ${25 - 2.4} ${cy} L ${25 + 2.4} ${cy}`} stroke="#4a4e55" strokeWidth="0.9" strokeLinecap="round" />
        </g>
      ))}

      {/* blue cubic relay (right) */}
      <rect x="62" y="22" width="40" height="40" rx="2.5" fill={`url(#relay-${id})`} stroke="#102f5e" strokeWidth="1" />
      <rect x="62" y="22" width="40" height="8" rx="2" fill={`url(#relaytop-${id})`} />
      <rect x="65" y="24.5" width="34" height="3.5" rx="1" fill="#ffffff" opacity="0.4" />
      {/* faint white text lines */}
      <rect x="67" y="34" width="30" height="1.6" rx="0.8" fill="#dce8fb" opacity="0.55" />
      <rect x="67" y="38" width="24" height="1.4" rx="0.7" fill="#dce8fb" opacity="0.42" />
      <rect x="67" y="42" width="28" height="1.4" rx="0.7" fill="#dce8fb" opacity="0.42" />
      <rect x="67" y="52" width="20" height="1.3" rx="0.6" fill="#dce8fb" opacity="0.32" />
      {/* glossy reflection */}
      <path d="M 66 24 Q 74 36 70 60 L 64 60 Q 64 38 66 24 Z" fill="#ffffff" opacity="0.12" />

      {/* black optocoupler chip */}
      <rect x="40" y="30" width="13" height="16" rx="1.5" fill="#1c1c20" stroke="#000" strokeWidth="0.6" />
      <circle cx="42.5" cy="33" r="1" fill="#3a3a40" />
      <rect x="40" y="30" width="13" height="2.5" rx="1" fill="#ffffff" opacity="0.08" />
      <line x1="40" y1="34" x2="38" y2="34" stroke="#b9bdc4" strokeWidth="0.8" />
      <line x1="40" y1="38" x2="38" y2="38" stroke="#b9bdc4" strokeWidth="0.8" />
      <line x1="40" y1="42" x2="38" y2="42" stroke="#b9bdc4" strokeWidth="0.8" />
      <line x1="53" y1="34" x2="55" y2="34" stroke="#b9bdc4" strokeWidth="0.8" />
      <line x1="53" y1="38" x2="55" y2="38" stroke="#b9bdc4" strokeWidth="0.8" />
      <line x1="53" y1="42" x2="55" y2="42" stroke="#b9bdc4" strokeWidth="0.8" />

      {/* diode */}
      <rect x="41" y="50" width="11" height="4" rx="1.5" fill="#222" stroke="#000" strokeWidth="0.4" />
      <rect x="49.5" y="50" width="2.2" height="4" fill="#cfd3da" />
      <line x1="41" y1="52" x2="38" y2="52" stroke="#9aa0a8" strokeWidth="0.8" />
      <line x1="52" y1="52" x2="55" y2="52" stroke="#9aa0a8" strokeWidth="0.8" />

      {/* red power LED with halo */}
      {on && <circle cx="56" cy="60" r="7" fill="#ef3b3b" opacity="0.35" />}
      <circle cx="56" cy="60" r="3.2" fill={`url(#led-${id})`} stroke="#7a1c1c" strokeWidth="0.5" />
      <circle cx="55" cy="59" r="1" fill="#ffffff" opacity={on ? 0.85 : 0.3} />

      {/* 4-pin header along bottom (IN VCC GND + one) */}
      <rect x="68" y="64" width="24" height="6" rx="1" fill="#15151a" />
      {[71, 77, 83, 89].map((cx, i) => (
        <rect key={i} x={cx - 1.4} y="65" width="2.8" height="4" rx="0.5" fill="#d9b24a" stroke="#9a7c2e" strokeWidth="0.4" />
      ))}

      {/* green power-status LED with halo */}
      {on && <circle cx="44" cy="60" r="7" fill="#34d399" opacity="0.4" />}
      <circle cx="44" cy="60" r="3" fill={`url(#pwr-${id})`} stroke={on ? "#15915f" : "#1a2436"} strokeWidth="0.6" />
      <circle cx="43" cy="59" r="0.9" fill="#ffffff" opacity={on ? 0.8 : 0.25} />
    </g>
  );
}

function ServoMotor({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  const horn = on ? -14 : 6;
  return (
    <g>
      <defs>
        <linearGradient id={`body-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3d7fd6" />
          <stop offset="0.5" stopColor="#2563b0" />
          <stop offset="1" stopColor="#16407a" />
        </linearGradient>
        <linearGradient id={`tab-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a8ade" />
          <stop offset="1" stopColor="#1c4f93" />
        </linearGradient>
        <radialGradient id={`hub-${id}`} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#eef1f4" />
          <stop offset="1" stopColor="#c4ccd4" />
        </radialGradient>
        <linearGradient id={`hornG-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d8dde2" />
        </linearGradient>
      </defs>

      {/* shadow */}
      <ellipse cx={60} cy={80} rx={34} ry={6} fill="#000" opacity={0.28} />

      {/* leads / wires */}
      <line x1={6} y1={44} x2={32} y2={44} stroke="#7d4a2a" strokeWidth={4} strokeLinecap="round" />
      <line x1={88} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />

      {/* mounting tabs */}
      <rect x={20} y={36} width={16} height={16} rx={2} fill={`url(#tab-${id})`} stroke="#103663" strokeWidth={0.8} />
      <rect x={84} y={36} width={16} height={16} rx={2} fill={`url(#tab-${id})`} stroke="#103663" strokeWidth={0.8} />
      <circle cx={27} cy={44} r={2.6} fill="#0d2c52" />
      <circle cx={93} cy={44} r={2.6} fill="#0d2c52" />
      <circle cx={27} cy={44} r={1.3} fill="#5a86b8" />
      <circle cx={93} cy={44} r={1.3} fill="#5a86b8" />

      {/* main body */}
      <rect x={34} y={20} width={52} height={48} rx={4} fill={`url(#body-${id})`} stroke="#0f2f5c" strokeWidth={1} />
      <rect x={37} y={23} width={46} height={5} rx={2.5} fill="#ffffff" opacity={0.18} />
      {/* parting line */}
      <line x1={34} y1={40} x2={86} y2={40} stroke="#0f2f5c" strokeWidth={0.7} opacity={0.6} />

      {/* 3-wire cable exiting bottom */}
      <path d="M44 68 Q42 78 38 84" stroke="#7d4a2a" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <path d="M50 68 Q49 78 47 85" stroke="#e23b2e" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <path d="M56 68 Q57 78 56 85" stroke="#f08a1d" strokeWidth={2.4} fill="none" strokeLinecap="round" />

      {/* gear collar */}
      <circle cx={64} cy={22} r={11} fill="#22507f" stroke="#0f2f5c" strokeWidth={1} />

      {/* rotating hub + horn */}
      <g style={{ transformOrigin: "64px 22px", transform: `rotate(${horn}deg)`, transition: "transform 0.5s ease" }}>
        <circle cx={64} cy={22} r={8} fill={`url(#hub-${id})`} stroke="#b6bdc4" strokeWidth={0.8} />
        {/* horn arm */}
        <path d="M61 22 L61 2 Q64 -1 67 2 L67 22 Z" fill={`url(#hornG-${id})`} stroke="#b6bdc4" strokeWidth={0.7} />
        <circle cx={64} cy={6} r={1.5} fill="#c4ccd4" />
        <circle cx={64} cy={11} r={1.4} fill="#c4ccd4" />
        {/* spline center */}
        <circle cx={64} cy={22} r={3} fill="#9aa3ac" />
        <circle cx={64} cy={22} r={1.3} fill="#5c6670" />
      </g>

      {/* power LED */}
      {on && <circle cx={78} cy={60} r={6} fill="#34d399" opacity={0.35} />}
      <circle cx={78} cy={60} r={2.6} fill={on ? "#34d399" : "#243049"} stroke="#0f2f5c" strokeWidth={0.6} />
    </g>
  );
}

function Lamp({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  const glassFill = on ? `url(#glassOn-${id})` : `url(#glassOff-${id})`;
  const filStroke = on ? `#fff7d6` : `#6b5a3a`;
  return (
    <g>
      <ellipse cx={60} cy={80} rx={26} ry={5} fill="#000" opacity={0.28} />
      <defs>
        <radialGradient id={`glassOn-${id}`} cx="50%" cy="42%" r="62%">
          <stop offset="0%" stopColor="#fffbe8" />
          <stop offset="38%" stopColor="#ffe9a3" />
          <stop offset="75%" stopColor="#ffcf63" />
          <stop offset="100%" stopColor="#f3b53e" />
        </radialGradient>
        <radialGradient id={`glassOff-${id}`} cx="42%" cy="36%" r="70%">
          <stop offset="0%" stopColor="#eef4fa" stopOpacity={0.95} />
          <stop offset="55%" stopColor="#c9d6e3" stopOpacity={0.7} />
          <stop offset="100%" stopColor="#9fb1c2" stopOpacity={0.78} />
        </radialGradient>
        <linearGradient id={`base-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7a7d82" />
          <stop offset="22%" stopColor="#d7dade" />
          <stop offset="50%" stopColor="#aeb2b7" />
          <stop offset="78%" stopColor="#d7dade" />
          <stop offset="100%" stopColor="#6f7378" />
        </linearGradient>
        <linearGradient id={`tip-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2a2a2e" />
          <stop offset="50%" stopColor="#55555a" />
          <stop offset="100%" stopColor="#1f1f22" />
        </linearGradient>
        <radialGradient id={`halo-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffe9a0" stopOpacity={0.85} />
          <stop offset="100%" stopColor="#ffe9a0" stopOpacity={0} />
        </radialGradient>
      </defs>
      <line x1={6} y1={44} x2={47} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={73} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      {on && <circle cx={60} cy={36} r={34} fill={`url(#halo-${id})`} />}
      {/* metal screw base */}
      <g>
        <rect x={49} y={56} width={22} height={14} rx={2} fill={`url(#base-${id})`} stroke="#5e6166" strokeWidth={0.6} />
        {[58.5, 62, 65.5].map((yy, i) => (
          <rect key={i} x={49} y={yy} width={22} height={2} fill="#6b6e73" opacity={0.7} />
        ))}
        <path d="M51 70 L69 70 L66 76 Q60 79 54 76 Z" fill={`url(#tip-${id})`} stroke="#3a3a3d" strokeWidth={0.5} />
      </g>
      {/* glass bulb */}
      <path d="M44 54 Q41 44 44 33 A17 17 0 1 1 76 33 Q79 44 76 54 Q68 58 60 58 Q52 58 44 54 Z" fill={glassFill} stroke={on ? "#e8b95a" : "#aebccb"} strokeWidth={1} />
      {/* filament supports */}
      <line x1={54} y1={56} x2={55} y2={40} stroke="#8a8a8a" strokeWidth={1.1} />
      <line x1={66} y1={56} x2={65} y2={40} stroke="#8a8a8a" strokeWidth={1.1} />
      {/* coiled tungsten filament */}
      <path
        d="M55 40 q1.4 -3 2.8 0 q1.4 3 2.8 0 q1.4 -3 2.8 0 q1.4 3 2.8 0 q1.4 -3 2.4 0"
        fill="none"
        stroke={filStroke}
        strokeWidth={on ? 2 : 1.3}
        strokeLinecap="round"
        opacity={on ? 1 : 0.85}
      />
      {on && (
        <path
          d="M55 40 q1.4 -3 2.8 0 q1.4 3 2.8 0 q1.4 -3 2.8 0 q1.4 3 2.8 0 q1.4 -3 2.4 0"
          fill="none"
          stroke="#fffdf2"
          strokeWidth={0.8}
          strokeLinecap="round"
        />
      )}
      {/* glass highlight */}
      <ellipse cx={51} cy={28} rx={5} ry={9} fill="#ffffff" opacity={on ? 0.35 : 0.55} transform="rotate(-18 51 28)" />
      {/* power LED */}
      {on && <circle cx={92} cy={62} r={6} fill="#34d399" opacity={0.35} />}
      <circle cx={92} cy={62} r={2.6} fill={on ? "#34d399" : "#243049"} stroke="#11161f" strokeWidth={0.5} />
    </g>
  );
}

function Fan({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  const blades = [0, 60, 120, 180, 240, 300];
  return (
    <g>
      <defs>
        <linearGradient id={`frame-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3f47" />
          <stop offset="0.5" stopColor="#22262c" />
          <stop offset="1" stopColor="#15181c" />
        </linearGradient>
        <radialGradient id={`hub-${id}`} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#5a6068" />
          <stop offset="0.6" stopColor="#2c3037" />
          <stop offset="1" stopColor="#16181c" />
        </radialGradient>
        <radialGradient id={`blade-${id}`} cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stopColor="#41464d" />
          <stop offset="1" stopColor="#202329" />
        </radialGradient>
        <radialGradient id={`hole-${id}`} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#0a0b0d" />
          <stop offset="1" stopColor="#33373d" />
        </radialGradient>
      </defs>

      {/* shadow */}
      <ellipse cx={60} cy={80} rx={40} ry={6} fill="#000" opacity={0.3} />

      {/* leads / wires from left side */}
      <line x1={6} y1={40} x2={22} y2={40} stroke="#d23b3b" strokeWidth={4} strokeLinecap="round" />
      <line x1={6} y1={48} x2={22} y2={48} stroke="#1b1d22" strokeWidth={4} strokeLinecap="round" />
      <line x1={98} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />

      {/* square frame */}
      <rect x={20} y={6} width={76} height={76} rx={9} fill={`url(#frame-${id})`} stroke="#0c0d0f" strokeWidth={1.5} />
      <rect x={23} y={9} width={70} height={70} rx={7} fill="none" stroke="#4a4f57" strokeWidth={1} opacity={0.5} />

      {/* mounting holes */}
      {[[30, 16], [86, 16], [30, 72], [86, 72]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={4.2} fill={`url(#hole-${id})`} stroke="#0a0b0d" strokeWidth={0.8} />
      ))}

      {/* circular air opening recess */}
      <circle cx={58} cy={44} r={32} fill="#0d0f12" opacity={0.6} />

      {/* rotating blade assembly */}
      <g style={{ transformOrigin: "58px 44px", animation: on ? "cl-spin 0.6s linear infinite" : "none" }}>
        {blades.map((deg) => (
          <path
            key={deg}
            d="M58 44 Q 80 30, 88 44 Q 78 50, 58 44 Z"
            fill={`url(#blade-${id})`}
            stroke="#101216"
            strokeWidth={0.6}
            transform={`rotate(${deg} 58 44)`}
            opacity={0.96}
          />
        ))}
        {/* hub */}
        <circle cx={58} cy={44} r={13} fill={`url(#hub-${id})`} stroke="#0c0e11" strokeWidth={1} />
        <circle cx={54.5} cy={40.5} r={3.5} fill="#7a818a" opacity={0.5} />
        <line x1={58} y1={31} x2={58} y2={57} stroke="#15171b" strokeWidth={0.8} opacity={0.5} />
        <line x1={45} y1={44} x2={71} y2={44} stroke="#15171b" strokeWidth={0.8} opacity={0.5} />
      </g>

      {/* top highlight on frame */}
      <rect x={23} y={9} width={70} height={10} rx={6} fill="#ffffff" opacity={0.06} />

      {/* power LED */}
      {on && <circle cx={88} cy={70} r={7} fill="#34d399" opacity={0.3} />}
      <circle cx={88} cy={70} r={2.6} fill={on ? "#34d399" : "#243049"} stroke="#0c0e11" strokeWidth={0.6} />
      {on && <circle cx={87.2} cy={69.2} r={0.9} fill="#eafff5" opacity={0.9} />}
    </g>
  );
}

function RgbLed({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  return (
    <g>
      <defs>
        <radialGradient id={`dome-${id}`} cx="42%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.95} />
          <stop offset="45%" stopColor="#e8f4f8" stopOpacity={0.45} />
          <stop offset="100%" stopColor="#aebfc7" stopOpacity={0.5} />
        </radialGradient>
        <radialGradient id={`glow-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.95} />
          <stop offset="35%" stopColor="#ff5fa0" stopOpacity={0.7} />
          <stop offset="65%" stopColor="#5fd0ff" stopOpacity={0.45} />
          <stop offset="100%" stopColor="#7bff8e" stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`collar-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dfeaf0" stopOpacity={0.6} />
          <stop offset="100%" stopColor="#9fb2bc" stopOpacity={0.7} />
        </linearGradient>
        <linearGradient id={`leg-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9a9da3" />
          <stop offset="40%" stopColor="#eef1f4" />
          <stop offset="60%" stopColor="#d2d6db" />
          <stop offset="100%" stopColor="#8b8e94" />
        </linearGradient>
      </defs>

      {/* shadow */}
      <ellipse cx={60} cy={80} rx={26} ry={5} fill="#000" opacity={0.28} />

      {/* leads to circuit (long bent legs) */}
      <line x1={6} y1={44} x2={48} y2={44} stroke="#b9bcc2" strokeWidth={4} strokeLinecap="round" />
      <line x1={72} y1={44} x2={114} y2={44} stroke="#b9bcc2" strokeWidth={4} strokeLinecap="round" />

      {/* emitted glow when on */}
      {on && (
        <>
          <circle cx={60} cy={36} r={40} fill={`url(#glow-${id})`} />
          <g stroke="#fff" strokeWidth={1.4} strokeLinecap="round" opacity={0.75}>
            <line x1={60} y1={2} x2={60} y2={-4} />
            <line x1={32} y1={12} x2={28} y2={7} />
            <line x1={88} y1={12} x2={92} y2={7} />
            <line x1={20} y1={36} x2={13} y2={36} />
            <line x1={100} y1={36} x2={107} y2={36} />
          </g>
        </>
      )}

      {/* four metal legs of different lengths */}
      <g>
        <rect x={47} y={62} width={3} height={20} rx={1} fill={`url(#leg-${id})`} />
        <rect x={54} y={62} width={3} height={15} rx={1} fill={`url(#leg-${id})`} />
        <rect x={61} y={62} width={3} height={24} rx={1} fill={`url(#leg-${id})`} />
        <rect x={68} y={62} width={3} height={18} rx={1} fill={`url(#leg-${id})`} />
      </g>

      {/* flat-bottom collar / flange */}
      <path d="M40 60 Q40 66 47 66 L73 66 Q80 66 80 60 L80 56 L40 56 Z" fill={`url(#collar-${id})`} stroke="#8fa3ad" strokeWidth={0.6} />
      <ellipse cx={60} cy={56} rx={20} ry={4} fill="#cdd9df" opacity={0.55} />

      {/* clear rounded dome body */}
      <path d="M41 57 L41 30 Q41 8 60 8 Q79 8 79 30 L79 57 Z" fill={`url(#dome-${id})`} stroke="#9fb4bd" strokeWidth={0.8} />

      {/* three coloured dies inside */}
      <g opacity={on ? 0.95 : 0.4}>
        <rect x={51} y={38} width={4} height={8} rx={1} fill="#ff4d4d" opacity={on ? 0.9 : 0.5} />
        <rect x={58} y={36} width={4} height={10} rx={1} fill="#2ec16a" opacity={on ? 0.9 : 0.5} />
        <rect x={65} y={38} width={4} height={8} rx={1} fill="#4d7dff" opacity={on ? 0.9 : 0.5} />
        {/* tiny bond wires */}
        <path d="M53 38 Q57 28 60 36" stroke="#cfd6da" strokeWidth={0.5} fill="none" />
        <path d="M67 38 Q63 28 60 36" stroke="#cfd6da" strokeWidth={0.5} fill="none" />
      </g>

      {/* glassy top highlight */}
      <ellipse cx={52} cy={22} rx={7} ry={11} fill="#ffffff" opacity={0.55} />
      <ellipse cx={68} cy={48} rx={3} ry={6} fill="#ffffff" opacity={0.25} />

      {/* power LED indicator */}
      {on && <circle cx={97} cy={58} r={7} fill="#34d399" opacity={0.35} />}
      <circle cx={97} cy={58} r={3} fill={on ? "#34d399" : "#243049"} stroke="#0c1320" strokeWidth={0.6} />
    </g>
  );
}

function ArduinoNano({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  const pins = Array.from({ length: 15 });
  return (
    <g>
      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f7a73" />
          <stop offset="0.5" stopColor="#176159" />
          <stop offset="1" stopColor="#0f4a44" />
        </linearGradient>
        <linearGradient id={`usb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2f4f7" />
          <stop offset="0.45" stopColor="#c2c8d0" />
          <stop offset="0.55" stopColor="#9aa2ac" />
          <stop offset="1" stopColor="#6f767f" />
        </linearGradient>
        <linearGradient id={`chip-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3f47" />
          <stop offset="0.5" stopColor="#23262c" />
          <stop offset="1" stopColor="#15171b" />
        </linearGradient>
        <radialGradient id={`pad-${id}`} cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#f5e08f" />
          <stop offset="0.6" stopColor="#d9b24a" />
          <stop offset="1" stopColor="#a8842f" />
        </radialGradient>
        <radialGradient id={`led-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#7ff0c0" />
          <stop offset="1" stopColor="#34d399" />
        </radialGradient>
      </defs>

      <ellipse cx={60} cy={80} rx={46} ry={5} fill="#000" opacity={0.28} />

      <line x1={6} y1={44} x2={18} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={102} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />

      <rect x={18} y={14} width={84} height={60} rx={4} fill={`url(#pcb-${id})`} stroke="#0a3833" strokeWidth={1} />
      <rect x={18} y={14} width={84} height={6} rx={4} fill="#fff" opacity={0.12} />

      {pins.map((_, i) => {
        const px = 24 + i * 5.2;
        return (
          <g key={`p${i}`}>
            <rect x={px - 1.6} y={15.5} width={3.2} height={6} rx={0.8} fill={`url(#pad-${id})`} stroke="#7a5e20" strokeWidth={0.4} />
            <rect x={px - 1.6} y={66.5} width={3.2} height={6} rx={0.8} fill={`url(#pad-${id})`} stroke="#7a5e20" strokeWidth={0.4} />
          </g>
        );
      })}

      <rect x={20} y={26} width={10} height={36} rx={1.5} fill={`url(#usb-${id})`} stroke="#5a6068" strokeWidth={0.6} />
      <rect x={21} y={30} width={3} height={28} rx={1} fill="#3a3f45" />
      <rect x={22.5} y={32} width={6} height={24} rx={1} fill="#dfe3e8" opacity={0.5} />

      <rect x={44} y={34} width={30} height={20} rx={2} fill={`url(#chip-${id})`} stroke="#0c0d0f" strokeWidth={0.6} />
      <rect x={44} y={35} width={30} height={3} rx={1.5} fill="#fff" opacity={0.1} />
      <circle cx={48} cy={50} r={1.6} fill="#101113" stroke="#444" strokeWidth={0.3} />
      <text x={59} y={43} fontSize={4} fill="#c7ccd2" textAnchor="middle" fontFamily="monospace">ATMEGA</text>
      <text x={59} y={49} fontSize={3.4} fill="#9aa0a8" textAnchor="middle" fontFamily="monospace">328P</text>

      <rect x={86} y={32} width={11} height={11} rx={1.2} fill="#cfd4da" stroke="#7d838b" strokeWidth={0.5} />
      <rect x={88} y={34} width={7} height={7} rx={2} fill="#3a3f45" />
      <rect x={89} y={35} width={5} height={5} rx={1.5} fill="#5a6068" />

      <text x={88} y={70} fontSize={6} fill="#eef2f5" fontFamily="monospace" fontWeight="bold" opacity={0.85}>NANO</text>

      <rect x={80} y={48} width={4} height={2.6} rx={0.6} fill={on ? "#34d399" : "#243049"} stroke="#0c2b27" strokeWidth={0.3} />
      <rect x={80} y={53} width={4} height={2.6} rx={0.6} fill={on ? "#ffd24a" : "#3a3320"} stroke="#2b2410" strokeWidth={0.3} />

      {on && <circle cx={82} cy={49.3} r={6} fill={`url(#led-${id})`} opacity={0.45} />}
      <circle cx={82} cy={49.3} r={2} fill={on ? `url(#led-${id})` : "#243049"} stroke={on ? "#1f9d6f" : "#11161f"} strokeWidth={0.4} />
      {on && <circle cx={81.4} cy={48.7} r={0.6} fill="#eafff6" />}
    </g>
  );
}

function ArduinoMega({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  const topPins = Array.from({ length: 26 }, (_, i) => 30 + i * 2.85);
  const botPins = Array.from({ length: 26 }, (_, i) => 30 + i * 2.85);
  return (
    <g>
      <ellipse cx={60} cy={80} rx={50} ry={6} fill="#000" opacity={0.28} />
      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1aa088" />
          <stop offset="0.5" stopColor="#0f8270" />
          <stop offset="1" stopColor="#0a6354" />
        </linearGradient>
        <linearGradient id={`usb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e8ecef" />
          <stop offset="0.5" stopColor="#b6bdc4" />
          <stop offset="1" stopColor="#848d96" />
        </linearGradient>
        <linearGradient id={`barrel-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3f47" />
          <stop offset="0.5" stopColor="#16191d" />
          <stop offset="1" stopColor="#04060a" />
        </linearGradient>
        <linearGradient id={`hdr-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#23262b" />
          <stop offset="1" stopColor="#0a0c0f" />
        </linearGradient>
        <linearGradient id={`mcu-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2c2f34" />
          <stop offset="0.5" stopColor="#16181b" />
          <stop offset="1" stopColor="#050608" />
        </linearGradient>
        <radialGradient id={`halo-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#34d399" stopOpacity="0.9" />
          <stop offset="1" stopColor="#34d399" stopOpacity="0" />
        </radialGradient>
      </defs>

      <line x1={6} y1={44} x2={16} y2={44} stroke="#9aa1a8" strokeWidth={4} strokeLinecap="round" />
      <line x1={104} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />

      <rect x={15} y={14} width={90} height={60} rx={4} fill={`url(#pcb-${id})`} stroke="#0a5b4d" strokeWidth={1} />
      <rect x={15} y={14} width={90} height={3.5} rx={3} fill="#ffffff" opacity={0.12} />
      <circle cx={20} cy={19} r={2.4} fill="#0a4f43" stroke="#063a30" strokeWidth={0.6} />
      <circle cx={100} cy={19} r={2.4} fill="#0a4f43" stroke="#063a30" strokeWidth={0.6} />
      <circle cx={20} cy={69} r={2.4} fill="#0a4f43" stroke="#063a30" strokeWidth={0.6} />
      <circle cx={100} cy={69} r={2.4} fill="#0a4f43" stroke="#063a30" strokeWidth={0.6} />

      <rect x={11} y={20} width={16} height={14} rx={1.5} fill={`url(#usb-${id})`} stroke="#5a626b" strokeWidth={0.8} />
      <rect x={12.5} y={22} width={13} height={10} rx={1} fill="#6d757d" opacity={0.5} />
      <rect x={11} y={50} width={15} height={13} rx={2} fill={`url(#barrel-${id})`} stroke="#000" strokeWidth={0.6} />
      <ellipse cx={13} cy={56.5} rx={2.2} ry={4.5} fill="#0a0c0f" stroke="#33373d" strokeWidth={0.8} />

      <rect x={29} y={16} width={76} height={5} rx={1} fill={`url(#hdr-${id})`} />
      {topPins.map((x, i) => (
        <rect key={`t${i}`} x={x} y={17} width={1.1} height={3} fill="#dfe3e6" opacity={0.85} />
      ))}
      <rect x={29} y={67} width={76} height={5} rx={1} fill={`url(#hdr-${id})`} />
      {botPins.map((x, i) => (
        <rect key={`b${i}`} x={x} y={68} width={1.1} height={3} fill="#dfe3e6" opacity={0.85} />
      ))}

      <rect x={93} y={24} width={10} height={40} rx={1} fill={`url(#hdr-${id})`} />
      {Array.from({ length: 9 }, (_, i) => (
        <g key={`d${i}`}>
          <rect x={95} y={26 + i * 4.2} width={1.4} height={1.4} fill="#cfd4d8" />
          <rect x={99} y={26 + i * 4.2} width={1.4} height={1.4} fill="#cfd4d8" />
        </g>
      ))}

      <rect x={48} y={36} width={20} height={20} rx={1.5} fill={`url(#mcu-${id})`} stroke="#000" strokeWidth={0.6} />
      <circle cx={51} cy={39} r={1} fill="#3a3f45" />
      {Array.from({ length: 9 }, (_, i) => (
        <g key={`l${i}`}>
          <rect x={46.2} y={37.5 + i * 2} width={2} height={0.8} fill="#c9ccd0" />
          <rect x={67.8} y={37.5 + i * 2} width={2} height={0.8} fill="#c9ccd0" />
        </g>
      ))}

      <text x={62} y={29} fontSize={4.2} fontWeight="700" fill="#ffffff" opacity={0.92} textAnchor="middle" fontFamily="Arial, sans-serif">ARDUINO</text>
      <text x={62} y={62} fontSize={5.5} fontWeight="800" fill="#ffffff" opacity={0.9} textAnchor="middle" fontFamily="Arial, sans-serif" letterSpacing="1">MEGA</text>

      <circle cx={82} cy={50} r={1.5} fill="#fbbf24" stroke="#92600a" strokeWidth={0.4} />
      <circle cx={82} cy={56} r={1.5} fill="#ef4444" stroke="#7a1414" strokeWidth={0.4} />

      {on && <circle cx={37} cy={28} r={7} fill={`url(#halo-${id})`} />}
      <circle cx={37} cy={28} r={2} fill={on ? "#34d399" : "#243049"} stroke={on ? "#0f7a55" : "#11161f"} strokeWidth={0.5} />
      {on && <circle cx={36.4} cy={27.4} r={0.7} fill="#eafff5" opacity={0.9} />}
    </g>
  );
}

function Esp32({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  return (
    <g>
      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2f33" />
          <stop offset="0.5" stopColor="#1b1d20" />
          <stop offset="1" stopColor="#101113" />
        </linearGradient>
        <linearGradient id={`shield-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2f4f6" />
          <stop offset="0.45" stopColor="#c2c8cd" />
          <stop offset="1" stopColor="#8b9298" />
        </linearGradient>
        <linearGradient id={`pin-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b88a2e" />
          <stop offset="0.5" stopColor="#f2d877" />
          <stop offset="1" stopColor="#9c7726" />
        </linearGradient>
        <linearGradient id={`usb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e8ebed" />
          <stop offset="0.5" stopColor="#b0b6bb" />
          <stop offset="1" stopColor="#7d8388" />
        </linearGradient>
        <radialGradient id={`led-${id}`} cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#9cffd0" />
          <stop offset="0.5" stopColor="#34d399" />
          <stop offset="1" stopColor="#0f8a5f" />
        </radialGradient>
      </defs>

      <ellipse cx={60} cy={80} rx={46} ry={6} fill="#000" opacity={0.28} />

      <line x1={6} y1={44} x2={20} y2={44} stroke={`url(#pin-${id})`} strokeWidth={4} strokeLinecap="round" />
      <line x1={100} y1={44} x2={114} y2={44} stroke={`url(#pin-${id})`} strokeWidth={4} strokeLinecap="round" />

      {/* PCB board */}
      <rect x={20} y={8} width={80} height={72} rx={4} fill={`url(#pcb-${id})`} stroke="#070809" strokeWidth={1} />
      <rect x={22} y={10} width={76} height={2} rx={1} fill="#ffffff" opacity={0.06} />

      {/* mounting holes */}
      <circle cx={26} cy={14} r={2.2} fill="#0a0b0c" stroke="#c9a23e" strokeWidth={0.8} />
      <circle cx={94} cy={14} r={2.2} fill="#0a0b0c" stroke="#c9a23e" strokeWidth={0.8} />
      <circle cx={26} cy={74} r={2.2} fill="#0a0b0c" stroke="#c9a23e" strokeWidth={0.8} />
      <circle cx={94} cy={74} r={2.2} fill="#0a0b0c" stroke="#c9a23e" strokeWidth={0.8} />

      {/* PCB trace antenna zig-zag at top */}
      <polyline points="34,11 38,11 38,14 42,14 42,11 46,11 46,14 50,14 50,11 54,11 54,14 58,14 58,11 62,11"
        fill="none" stroke="#d9b24a" strokeWidth={1.3} opacity={0.9} />

      {/* RF shield can */}
      <rect x={36} y={22} width={48} height={30} rx={2} fill={`url(#shield-${id})`} stroke="#5f6469" strokeWidth={1} />
      <rect x={36} y={22} width={48} height={4} rx={2} fill="#ffffff" opacity={0.4} />
      <rect x={39} y={26} width={42} height={23} rx={1} fill="none" stroke="#9aa0a5" strokeWidth={0.7} opacity={0.7} />
      <text x={60} y={40} textAnchor="middle" fontSize={5.5} fontFamily="monospace" fontWeight="bold" fill="#5a5f63">ESP32</text>

      {/* left header pins */}
      {[20, 27, 34, 41, 48, 55, 62, 69].map((py, i) => (
        <rect key={`l${i}`} x={21} y={py + 36} width={5} height={4} rx={1} fill={`url(#pin-${id})`} stroke="#7a5e1c" strokeWidth={0.4} />
      ))}
      {/* right header pins */}
      {[20, 27, 34, 41, 48, 55, 62, 69].map((py, i) => (
        <rect key={`r${i}`} x={94} y={py + 36} width={5} height={4} rx={1} fill={`url(#pin-${id})`} stroke="#7a5e1c" strokeWidth={0.4} />
      ))}

      {/* EN / BOOT buttons */}
      <rect x={40} y={58} width={9} height={9} rx={1.5} fill="#3a3d40" stroke="#1a1c1e" strokeWidth={0.6} />
      <circle cx={44.5} cy={62.5} r={2.6} fill="#cfd3d6" stroke="#888" strokeWidth={0.5} />
      <rect x={71} y={58} width={9} height={9} rx={1.5} fill="#3a3d40" stroke="#1a1c1e" strokeWidth={0.6} />
      <circle cx={75.5} cy={62.5} r={2.6} fill="#cfd3d6" stroke="#888" strokeWidth={0.5} />
      <text x={44.5} y={56} textAnchor="middle" fontSize={3} fontFamily="monospace" fill="#9aa0a5">EN</text>
      <text x={75.5} y={56} textAnchor="middle" fontSize={3} fontFamily="monospace" fill="#9aa0a5">BOOT</text>

      {/* red power LED (always present) */}
      <circle cx={56} cy={68} r={1.8} fill="#ff5454" opacity={0.85} />

      {/* micro-USB connector at bottom */}
      <rect x={50} y={70} width={20} height={9} rx={1.5} fill={`url(#usb-${id})`} stroke="#5f6469" strokeWidth={0.8} />
      <rect x={53} y={72.5} width={14} height={4} rx={1} fill="#5a5f63" />
      <rect x={50} y={70} width={20} height={2} rx={1} fill="#ffffff" opacity={0.4} />

      {/* power LED indicator (status) */}
      {on && <circle cx={64} cy={68} r={6} fill="#34d399" opacity={0.3} />}
      <circle cx={64} cy={68} r={2.2} fill={on ? `url(#led-${id})` : "#243049"} stroke={on ? "#0f8a5f" : "#1a2230"} strokeWidth={0.6} />
    </g>
  );
}

function Esp8266({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  return (
    <g>
      <ellipse cx={60} cy={80} rx={46} ry={6} fill="#000" opacity={0.28} />
      <line x1={6} y1={44} x2={16} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={104} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f6b52" />
          <stop offset="0.5" stopColor="#0f4d39" />
          <stop offset="1" stopColor="#0a3a2b" />
        </linearGradient>
        <linearGradient id={`can-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2f4f7" />
          <stop offset="0.45" stopColor="#c4cad2" />
          <stop offset="1" stopColor="#8c939c" />
        </linearGradient>
        <linearGradient id={`usb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9edf2" />
          <stop offset="1" stopColor="#9aa2ac" />
        </linearGradient>
        <radialGradient id={`led-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="1" stopColor="#0f7a55" />
        </radialGradient>
        <radialGradient id={`pin-${id}`} cx="0.4" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffe9a8" />
          <stop offset="1" stopColor="#c79a32" />
        </radialGradient>
      </defs>
      {/* PCB body */}
      <rect x={16} y={14} width={88} height={60} rx={4} fill={`url(#pcb-${id})`} stroke="#072a1f" strokeWidth={1} />
      <rect x={16} y={14} width={88} height={5} rx={3} fill="#fff" opacity={0.08} />
      {/* mounting holes */}
      <circle cx={22} cy={20} r={2.4} fill="#0a3a2b" stroke="#c9b06a" strokeWidth={0.8} />
      <circle cx={98} cy={20} r={2.4} fill="#0a3a2b" stroke="#c9b06a" strokeWidth={0.8} />
      {/* top header row */}
      {Array.from({ length: 14 }).map((_, i) => (
        <rect key={`th-${i}`} x={19 + i * 6} y={15} width={3.4} height={4.6} rx={0.8} fill={`url(#pin-${id})`} stroke="#8a6c1e" strokeWidth={0.3} />
      ))}
      {/* bottom header row */}
      {Array.from({ length: 14 }).map((_, i) => (
        <rect key={`bh-${i}`} x={19 + i * 6} y={68} width={3.4} height={4.6} rx={0.8} fill={`url(#pin-${id})`} stroke="#8a6c1e" strokeWidth={0.3} />
      ))}
      {/* metal WiFi shield can */}
      <rect x={34} y={24} width={40} height={26} rx={2.5} fill={`url(#can-${id})`} stroke="#6b727b" strokeWidth={1} />
      <rect x={36} y={26} width={36} height={3} rx={1.5} fill="#fff" opacity={0.5} />
      {/* PCB antenna zig-zag at top of can */}
      <polyline points="38,28 41,28 41,32 45,32 45,28 49,28 49,32 53,32 53,28 57,28 57,32 61,32 61,28 65,28" fill="none" stroke="#caa84a" strokeWidth={1.4} />
      {/* silkscreen text */}
      <text x={54} y={42} textAnchor="middle" fontSize={5} fontFamily="Arial" fontWeight="bold" fill="#3a4148">ESP8266</text>
      <text x={60} y={61} textAnchor="middle" fontSize={5} fontFamily="Arial" fontWeight="bold" fill="#e6f0ea">NodeMCU</text>
      {/* micro-USB connector at bottom-left */}
      <rect x={20} y={50} width={16} height={11} rx={1.5} fill={`url(#usb-${id})`} stroke="#7a818a" strokeWidth={0.8} />
      <rect x={23} y={53} width={10} height={5} rx={1} fill="#454b52" />
      {/* blue LED */}
      <circle cx={84} cy={56} r={2.6} fill="#2563eb" stroke="#1e3a8a" strokeWidth={0.6} />
      <circle cx={83} cy={55} r={0.9} fill="#bfdbfe" opacity={0.8} />
      {/* power LED */}
      {on && <circle cx={92} cy={56} r={6} fill="#34d399" opacity={0.35} />}
      <circle cx={92} cy={56} r={2.6} fill={on ? `url(#led-${id})` : "#243049"} stroke={on ? "#0f7a55" : "#161f2e"} strokeWidth={0.6} />
      {on && <circle cx={91} cy={55} r={0.9} fill="#d1fae5" opacity={0.9} />}
    </g>
  );
}

function RpiPico({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  const pinXs = [16, 24, 32, 40, 48, 56, 64, 72, 80, 88];
  return (
    <g>
      <ellipse cx={60} cy={80} rx={46} ry={6} fill="#000" opacity={0.28} />
      <line x1={6} y1={44} x2={18} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={102} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f8f4e" />
          <stop offset="0.5" stopColor="#22713c" />
          <stop offset="1" stopColor="#185a2e" />
        </linearGradient>
        <linearGradient id={`chip-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3f47" />
          <stop offset="0.5" stopColor="#1c1f24" />
          <stop offset="1" stopColor="#0c0e11" />
        </linearGradient>
        <linearGradient id={`usb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9edf2" />
          <stop offset="0.5" stopColor="#b6bcc4" />
          <stop offset="1" stopColor="#8b9099" />
        </linearGradient>
        <radialGradient id={`led-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#7cf0b8" />
          <stop offset="1" stopColor="#1f9e63" />
        </radialGradient>
      </defs>
      <rect x={14} y={12} width={92} height={64} rx={7} fill={`url(#pcb-${id})`} stroke="#0f4a26" strokeWidth={1} />
      <rect x={14} y={12} width={92} height={12} rx={7} fill="#fff" opacity={0.08} />
      {pinXs.map((x, i) => (
        <g key={`pl-${i}`}>
          <rect x={x - 3} y={11} width={6} height={5} rx={1} fill="#d9b24a" stroke="#a8842f" strokeWidth={0.5} />
          <circle cx={x} cy={20} r={2.6} fill="#e7c25a" stroke="#9c7a2c" strokeWidth={0.7} />
          <circle cx={x} cy={20} r={1.1} fill="#1c1f24" />
        </g>
      ))}
      {pinXs.map((x, i) => (
        <g key={`pb-${i}`}>
          <rect x={x - 3} y={72} width={6} height={5} rx={1} fill="#d9b24a" stroke="#a8842f" strokeWidth={0.5} />
          <circle cx={x} cy={68} r={2.6} fill="#e7c25a" stroke="#9c7a2c" strokeWidth={0.7} />
          <circle cx={x} cy={68} r={1.1} fill="#1c1f24" />
        </g>
      ))}
      <rect x={48} y={8} width={24} height={9} rx={2} fill={`url(#usb-${id})`} stroke="#71767e" strokeWidth={0.8} />
      <rect x={51} y={10} width={18} height={4} rx={1} fill="#5d6views" opacity={0} />
      <rect x={51} y={10} width={18} height={4} rx={1} fill="#3a3f47" />
      <rect x={44} y={28} width={32} height={32} rx={3} fill={`url(#chip-${id})`} stroke="#000" strokeWidth={0.8} />
      <rect x={47} y={31} width={26} height={10} rx={1} fill="#fff" opacity={0.05} />
      <circle cx={49} cy={56} r={1.5} fill="#0a0b0d" />
      <text x={60} y={46} fontSize={4.4} fontFamily="Arial, sans-serif" fontWeight="bold" fill="#cfd3d8" textAnchor="middle">RP2040</text>
      <text x={60} y={51} fontSize={3} fontFamily="Arial, sans-serif" fill="#8b9099" textAnchor="middle">Raspberry Pi</text>
      <text x={26} y={62} fontSize={6} fontFamily="Georgia, serif" fontStyle="italic" fontWeight="bold" fill="#eaf2ec" textAnchor="middle">Pico</text>
      {on && <circle cx={92} cy={56} r={6} fill="#34d399" opacity={0.35} />}
      <circle cx={92} cy={56} r={2.6} fill={on ? `url(#led-${id})` : "#243049"} stroke={on ? "#1f9e63" : "#11151f"} strokeWidth={0.7} />
      {on && <circle cx={91} cy={55} r={0.9} fill="#eafff5" opacity={0.9} />}
      <text x={92} y={66} fontSize={3} fontFamily="Arial, sans-serif" fill="#cfe6d6" textAnchor="middle">LED</text>
    </g>
  );
}

function OledDisplay({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  const pinX = [50, 56, 62, 68];
  return (
    <g>
      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f3a6e" />
          <stop offset="0.5" stopColor="#15315f" />
          <stop offset="1" stopColor="#0f2547" />
        </linearGradient>
        <linearGradient id={`glass-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#15171c" />
          <stop offset="0.5" stopColor="#0a0b0f" />
          <stop offset="1" stopColor="#050608" />
        </linearGradient>
        <radialGradient id={`screenglow-${id}`} cx="0.5" cy="0.5" r="0.7">
          <stop offset="0" stopColor="#1a3d4a" stopOpacity={on ? 0.9 : 0} />
          <stop offset="1" stopColor="#0a0b0f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`pin-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0d27a" />
          <stop offset="0.5" stopColor="#d9b24a" />
          <stop offset="1" stopColor="#a8842f" />
        </linearGradient>
      </defs>

      <ellipse cx="60" cy="80" rx="42" ry="5.5" fill="#000" opacity="0.3" />

      <line x1={6} y1={44} x2={22} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={98} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />

      <rect x="22" y="10" width="76" height="68" rx="3" fill={`url(#pcb-${id})`} stroke="#0a1c38" strokeWidth="1" />
      <rect x="22" y="10" width="76" height="3" rx="2" fill="#fff" opacity="0.12" />
      <circle cx="27" cy="15" r="2.4" fill="#0c1d3a" stroke="#26467e" strokeWidth="0.8" />
      <circle cx="93" cy="15" r="2.4" fill="#0c1d3a" stroke="#26467e" strokeWidth="0.8" />
      <circle cx="27" cy="57" r="2.4" fill="#0c1d3a" stroke="#26467e" strokeWidth="0.8" />
      <circle cx="93" cy="57" r="2.4" fill="#0c1d3a" stroke="#26467e" strokeWidth="0.8" />

      <rect x="30" y="20" width="60" height="38" rx="2" fill="#020305" />
      <rect x="32.5" y="22.5" width="55" height="33" rx="1.5" fill={`url(#glass-${id})`} stroke="#202632" strokeWidth="0.6" />
      <rect x="34" y="24" width="52" height="30" rx="1" fill={`url(#screenglow-${id})`} />

      {on && (
        <g>
          <text x="60" y="35" fontSize="7" fontFamily="monospace" fontWeight="bold" fill="#67e8f9" textAnchor="middle">HELLO</text>
          <text x="60" y="46" fontSize="5.5" fontFamily="monospace" fill="#e0fbff" textAnchor="middle">hello :)</text>
          <rect x="35" y="50" width="50" height="1.4" rx="0.7" fill="#22d3ee" opacity="0.7" />
          <circle cx="38" cy="27" r="0.9" fill="#a5f3fc" />
          <circle cx="82" cy="27" r="0.9" fill="#a5f3fc" />
        </g>
      )}
      {!on && (
        <rect x="34" y="24" width="52" height="30" rx="1" fill="#0a0c10" opacity="0.5" />
      )}
      <rect x="33" y="23" width="54" height="8" rx="1" fill="#fff" opacity="0.05" />

      {pinX.map((px, i) => (
        <g key={i}>
          <rect x={px - 2.4} y="62" width="4.8" height="6" rx="1" fill="#1a1a1d" />
          <rect x={px - 1.2} y="64" width="2.4" height="13" rx="0.8" fill={`url(#pin-${id})`} />
          <rect x={px - 1.2} y="64" width="0.8" height="13" fill="#fff" opacity="0.4" />
        </g>
      ))}

      <circle cx="84" cy="65" r="5.5" fill="#34d399" opacity={on ? 0.35 : 0} />
      <circle cx="84" cy="65" r="2.4" fill={on ? "#34d399" : "#243049"} stroke="#0a1c38" strokeWidth="0.6" />
      {on && <circle cx="83" cy="64" r="0.9" fill="#d1fae5" />}
    </g>
  );
}

function Lcd1602({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  const cells = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 16; c++) {
      cells.push(
        <rect
          key={`cell-${id}-${r}-${c}`}
          x={32.5 + c * 3.05}
          y={29 + r * 12.5}
          width={2.4}
          height={10.5}
          rx={0.4}
          fill={on ? `url(#cell-${id})` : "#21607a"}
          opacity={on ? 1 : 0.55}
        />
      );
    }
  }
  return (
    <g>
      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f9d57" />
          <stop offset="1" stopColor="#127a3f" />
        </linearGradient>
        <linearGradient id={`bezel-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a4f57" />
          <stop offset="1" stopColor="#2c3035" />
        </linearGradient>
        <linearGradient id={`screen-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={on ? "#2f8fc4" : "#1c5670"} />
          <stop offset="1" stopColor={on ? "#1f6fa3" : "#164256"} />
        </linearGradient>
        <linearGradient id={`cell-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cdeeff" />
          <stop offset="1" stopColor="#8fd6f5" />
        </linearGradient>
        <radialGradient id={`led-${id}`} cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#9af8c8" />
          <stop offset="1" stopColor="#34d399" />
        </radialGradient>
        <linearGradient id={`chip-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3d42" />
          <stop offset="1" stopColor="#1a1c1f" />
        </linearGradient>
      </defs>
      <ellipse cx={60} cy={80} rx={50} ry={6} fill="#000" opacity={0.28} />
      <line x1={6} y1={44} x2={14} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={106} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <rect x={12} y={12} width={96} height={64} rx={3} fill={`url(#pcb-${id})`} stroke="#0c5a2e" strokeWidth={1} />
      <circle cx={16.5} cy={16} r={2} fill="#cfd6da" stroke="#0c5a2e" strokeWidth={0.6} />
      <circle cx={103.5} cy={16} r={2} fill="#cfd6da" stroke="#0c5a2e" strokeWidth={0.6} />
      <circle cx={16.5} cy={72} r={2} fill="#cfd6da" stroke="#0c5a2e" strokeWidth={0.6} />
      <circle cx={103.5} cy={72} r={2} fill="#cfd6da" stroke="#0c5a2e" strokeWidth={0.6} />
      <rect x={26} y={20} width={68} height={48} rx={2} fill={`url(#bezel-${id})`} stroke="#1a1d20" strokeWidth={0.8} />
      <rect x={30} y={24} width={60} height={40} rx={1.5} fill={`url(#screen-${id})`} stroke="#0e3a4c" strokeWidth={0.8} />
      {on && (
        <rect x={30} y={24} width={60} height={40} rx={1.5} fill="#bfeaff" opacity={0.12} />
      )}
      {cells}
      <rect x={30} y={24} width={60} height={6} fill="#fff" opacity={0.08} />
      <rect x={96} y={26} width={9} height={36} rx={1.5} fill={`url(#chip-${id})`} stroke="#0b0c0d" strokeWidth={0.5} />
      <line x1={96} y1={30} x2={94.5} y2={30} stroke="#c9cdd0" strokeWidth={1} />
      <line x1={96} y1={34} x2={94.5} y2={34} stroke="#c9cdd0" strokeWidth={1} />
      <line x1={96} y1={38} x2={94.5} y2={38} stroke="#c9cdd0" strokeWidth={1} />
      <line x1={96} y1={42} x2={94.5} y2={42} stroke="#c9cdd0" strokeWidth={1} />
      <rect x={97} y={64} width={9} height={9} rx={1.5} fill="#2b6ac4" stroke="#1a3f7a" strokeWidth={0.6} />
      <circle cx={101.5} cy={68.5} r={1.4} fill="#dfe6ea" />
      <line x1={101.5} y1={67.1} x2={101.5} y2={69.9} stroke="#3a3f44" strokeWidth={0.7} />
      <g>
        {[0, 1, 2, 3].map((i) => (
          <rect key={`hdr-${id}-${i}`} x={15 + i * 4} y={68} width={2.6} height={5} rx={0.4} fill="#d9b24a" stroke="#8a6f24" strokeWidth={0.4} />
        ))}
      </g>
      {on && <circle cx={84} cy={70} r={5} fill="#34d399" opacity={0.35} />}
      <circle cx={84} cy={70} r={2.4} fill={on ? `url(#led-${id})` : "#243049"} stroke="#0c5a2e" strokeWidth={0.5} />
    </g>
  );
}

function SevenSegment({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  const litOn = "#ff2b2b";
  const litOff = "#3a0d0d";
  const seg = on ? litOn : litOff;
  const segOp = on ? 1 : 0.55;
  // segment path helper builders for one digit at origin x
  const D = (x: number) => {
    const t = 2.2; // thickness
    const w = 9;   // digit width
    const h = 22;  // digit height
    const y = 33;
    const segs = [
      `M${x + t},${y} l${w},0 l${-t},${t} l${-(w - 2 * t)},0 z`,                       // top a
      `M${x + w + t},${y + t} l0,${h / 2 - t} l${-t},${-t} l0,${-(h / 2 - 2 * t)} z`,    // top-right b
      `M${x + w + t},${y + h / 2 + t} l0,${h / 2 - t} l${-t},${-t} l0,${-(h / 2 - 2 * t)} z`, // bot-right c
      `M${x + t},${y + h} l${w},0 l${-t},${-t} l${-(w - 2 * t)},0 z`,                   // bottom d
      `M${x},${y + h / 2 + t} l0,${h / 2 - t} l${t},${-t} l0,${-(h / 2 - 2 * t)} z`,    // bot-left e
      `M${x},${y + t} l0,${h / 2 - t} l${t},${-t} l0,${-(h / 2 - 2 * t)} z`,            // top-left f
      `M${x + t},${y + h / 2} l${w - 2 * t},0 l${t},${t} l${-(w - 2 * t)},0 l${-t},${-t} z`, // mid g
    ];
    return segs;
  };
  const digitXs = [22, 40, 66, 84];
  return (
    <g>
      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f6f3e" />
          <stop offset="1" stopColor="#0f4a27" />
        </linearGradient>
        <linearGradient id={`face-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2a2e" />
          <stop offset="0.5" stopColor="#161618" />
          <stop offset="1" stopColor="#0a0a0c" />
        </linearGradient>
        <radialGradient id={`glow-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ff3b3b" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ff3b3b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`pin-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0d27a" />
          <stop offset="1" stopColor="#b8923a" />
        </linearGradient>
      </defs>

      <ellipse cx="60" cy="80" rx="46" ry="6" fill="#000" opacity="0.3" />

      <line x1={6} y1={44} x2={20} y2={44} stroke={`url(#pin-${id})`} strokeWidth={4} strokeLinecap="round" />
      <line x1={100} y1={44} x2={114} y2={44} stroke={`url(#pin-${id})`} strokeWidth={4} strokeLinecap="round" />

      {/* green pcb backing */}
      <rect x="16" y="20" width="88" height="50" rx="3" fill={`url(#pcb-${id})`} stroke="#0a3b1e" strokeWidth="1" />
      {/* header pins */}
      {[24, 36, 84, 96].map((px, i) => (
        <rect key={i} x={px} y={64} width="4" height="7" rx="1" fill={`url(#pin-${id})`} stroke="#7a5e1f" strokeWidth="0.4" />
      ))}

      {/* black display module */}
      <rect x="20" y="24" width="80" height="40" rx="3" fill={`url(#face-${id})`} stroke="#000" strokeWidth="1" />
      <rect x="20" y="24" width="80" height="3.5" rx="2" fill="#fff" opacity="0.06" />

      {/* red glow when on */}
      {on && <rect x="20" y="24" width="80" height="40" rx="3" fill={`url(#glow-${id})`} />}

      {/* four digits */}
      {digitXs.map((dx, di) => (
        <g key={di} opacity={segOp}>
          {D(dx).map((p, si) => (
            <path key={si} d={p} fill={seg} stroke={seg} strokeWidth="0.3" />
          ))}
        </g>
      ))}

      {/* colon */}
      <circle cx="59" cy="40" r="1.8" fill={seg} opacity={segOp} />
      <circle cx="59" cy="50" r="1.8" fill={seg} opacity={segOp} />

      {/* decimal points */}
      {[31, 49, 75, 93].map((px, i) => (
        <circle key={i} cx={px} cy={56} r="1.3" fill={seg} opacity={segOp} />
      ))}

      {/* power LED */}
      {on && <circle cx="98" cy="29" r="6" fill="#34d399" opacity="0.35" />}
      <circle cx="98" cy="29" r="2.2" fill={on ? "#34d399" : "#243049"} stroke="#0b1a12" strokeWidth="0.5" />
    </g>
  );
}

function LedMatrix({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  const cell = 8.6;
  const x0 = 30;
  const y0 = 14;
  const rows = [0, 1, 2, 3, 4, 5, 6, 7];
  const cols = [0, 1, 2, 3, 4, 5, 6, 7];
  const litSet: Record<string, boolean> = {
    "1,1": true, "1,6": true, "2,2": true, "2,5": true,
    "3,3": true, "3,4": true, "5,0": true, "5,7": true,
    "6,1": true, "6,2": true, "6,3": true, "6,4": true,
    "6,5": true, "6,6": true,
  };
  return (
    <g>
      <defs>
        <linearGradient id={`board-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1b1f" />
          <stop offset="0.5" stopColor="#0e0e11" />
          <stop offset="1" stopColor="#050506" />
        </linearGradient>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c6b3a" />
          <stop offset="1" stopColor="#0f4424" />
        </linearGradient>
        <radialGradient id={`lit-${id}`} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#ff8a7a" />
          <stop offset="0.45" stopColor="#ff2d1a" />
          <stop offset="1" stopColor="#8a0d05" />
        </radialGradient>
        <radialGradient id={`dim-${id}`} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#5a1410" />
          <stop offset="1" stopColor="#2a0807" />
        </radialGradient>
        <radialGradient id={`glow-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#34d399" stopOpacity="0.85" />
          <stop offset="1" stopColor="#34d399" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx={60} cy={82} rx={44} ry={5} fill="#000" opacity={0.3} />

      <line x1={6} y1={44} x2={18} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={102} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />

      <rect x={16} y={62} width={8} height={5} rx={1} fill="#c9a23f" />
      <rect x={16} y={68} width={8} height={4} rx={1} fill="#7a6320" />
      <rect x={96} y={62} width={8} height={5} rx={1} fill="#c9a23f" />
      <rect x={96} y={68} width={8} height={4} rx={1} fill="#7a6320" />

      <rect x={20} y={70} width={80} height={10} rx={2} fill={`url(#pcb-${id})`} stroke="#0a3018" strokeWidth={0.8} />
      <circle cx={26} cy={75} r={1.6} fill="#cdcdcd" />
      <circle cx={94} cy={75} r={1.6} fill="#cdcdcd" />
      <rect x={50} y={73} width={20} height={5} rx={0.8} fill="#0c0c0e" />
      <rect x={52} y={74} width={2} height={3} fill="#3a3a3a" />
      <rect x={56} y={74} width={2} height={3} fill="#3a3a3a" />
      <rect x={62} y={74} width={2} height={3} fill="#3a3a3a" />
      <rect x={66} y={74} width={2} height={3} fill="#3a3a3a" />

      <rect x={20} y={8} width={80} height={64} rx={3} fill={`url(#board-${id})`} stroke="#000" strokeWidth={1} />
      <rect x={21} y={9} width={78} height={3} rx={2} fill="#ffffff" opacity={0.06} />

      {rows.map((r) =>
        cols.map((c) => {
          const cx = x0 + c * cell;
          const cy = y0 + r * cell;
          const lit = on && litSet[`${r},${c}`];
          return (
            <g key={`${r}-${c}`}>
              {lit && <circle cx={cx} cy={cy} r={4.6} fill="#ff3a22" opacity={0.4} />}
              <circle cx={cx} cy={cy} r={2.9} fill={lit ? `url(#lit-${id})` : `url(#dim-${id})`} stroke="#000" strokeWidth={0.4} />
              <circle cx={cx - 0.8} cy={cy - 0.9} r={0.9} fill="#fff" opacity={lit ? 0.85 : 0.18} />
            </g>
          );
        })
      )}

      {on && <circle cx={94} cy={66} r={5} fill={`url(#glow-${id})`} />}
      <circle cx={94} cy={66} r={2} fill={on ? "#34d399" : "#243049"} stroke="#0a0a0a" strokeWidth={0.5} />
      <circle cx={93.4} cy={65.4} r={0.6} fill="#fff" opacity={on ? 0.9 : 0.25} />
    </g>
  );
}

function NeoPixelRing({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  const cx = 56;
  const cy = 44;
  const rOuter = 33;
  const rInner = 17;
  const rLed = 25;
  const ledCount = 12;
  const rainbow = [
    "#ff3b30", "#ff9500", "#ffd60a", "#a3e635",
    "#34d399", "#22d3ee", "#3b82f6", "#6366f1",
    "#8b5cf6", "#d946ef", "#ec4899", "#f43f5e",
  ];
  const leds = [];
  for (let i = 0; i < ledCount; i++) {
    const a = (i / ledCount) * Math.PI * 2 - Math.PI / 2;
    const lx = cx + rLed * Math.cos(a);
    const ly = cy + rLed * Math.sin(a);
    const col = rainbow[i % rainbow.length];
    leds.push(
      <g key={i} transform={`translate(${lx} ${ly}) rotate(${(a * 180) / Math.PI + 90})`}>
        {on && (
          <circle cx={0} cy={0} r={8.5} fill={col} opacity={0.45} filter={`url(#glow-${id})`} />
        )}
        <rect x={-4.2} y={-4.2} width={8.4} height={8.4} rx={1} fill="#f7f7f5" stroke="#cfd2cf" strokeWidth={0.6} />
        <rect x={-3} y={-3} width={6} height={6} rx={0.6} fill={on ? col : "#3a3f44"} opacity={on ? 1 : 0.85} />
        {on && <rect x={-2.6} y={-2.6} width={2.4} height={2.4} rx={0.4} fill="#ffffff" opacity={0.7} />}
        <circle cx={-2.6} cy={-2.6} r={0.5} fill="#9aa0a6" />
        <circle cx={2.6} cy={-2.6} r={0.5} fill="#9aa0a6" />
        <circle cx={-2.6} cy={2.6} r={0.5} fill="#9aa0a6" />
        <circle cx={2.6} cy={2.6} r={0.5} fill="#9aa0a6" />
      </g>
    );
  }
  return (
    <g>
      <defs>
        <radialGradient id={`pcb-${id}`} cx="42%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#2e3340" />
          <stop offset="55%" stopColor="#16181f" />
          <stop offset="100%" stopColor="#070809" />
        </radialGradient>
        <radialGradient id={`hole-${id}`} cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#0a0b0d" />
          <stop offset="100%" stopColor="#1c2029" />
        </radialGradient>
        <linearGradient id={`pin-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f4d98a" />
          <stop offset="50%" stopColor="#d9b24a" />
          <stop offset="100%" stopColor="#a07e2c" />
        </linearGradient>
        <filter id={`glow-${id}`} x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation={3} />
        </filter>
      </defs>

      <ellipse cx={58} cy={80} rx={40} ry={6} fill="#000" opacity={0.3} />

      <line x1={6} y1={44} x2={24} y2={44} stroke={`url(#pin-${id})`} strokeWidth={4} strokeLinecap="round" />
      <line x1={88} y1={44} x2={114} y2={44} stroke={`url(#pin-${id})`} strokeWidth={4} strokeLinecap="round" />

      <circle cx={cx} cy={cy} r={rOuter} fill={`url(#pcb-${id})`} stroke="#000" strokeWidth={1} />
      <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="#3a4150" strokeWidth={0.5} opacity={0.6} />
      <circle cx={cx} cy={cy} r={rInner} fill={`url(#hole-${id})`} stroke="#000" strokeWidth={0.8} />
      <circle cx={cx} cy={cy} r={rInner + 1.5} fill="none" stroke="#2a3140" strokeWidth={1} opacity={0.5} />

      <ellipse cx={cx - 8} cy={cy - 18} rx={20} ry={9} fill="#ffffff" opacity={0.05} />

      {leds}

      <g>
        <rect x={cx - 8} y={cy + rOuter - 3} width={4} height={4} rx={0.6} fill="#c9ccc8" stroke="#7a7d79" strokeWidth={0.4} />
        <rect x={cx - 2} y={cy + rOuter - 3} width={4} height={4} rx={0.6} fill="#c9ccc8" stroke="#7a7d79" strokeWidth={0.4} />
        <rect x={cx + 4} y={cy + rOuter - 3} width={4} height={4} rx={0.6} fill="#c9ccc8" stroke="#7a7d79" strokeWidth={0.4} />
      </g>

      <g transform={`translate(${cx + rOuter - 6} ${cy - rOuter + 6})`}>
        {on && <circle cx={0} cy={0} r={5} fill="#34d399" opacity={0.5} filter={`url(#glow-${id})`} />}
        <circle cx={0} cy={0} r={2.4} fill={on ? "#34d399" : "#243049"} stroke="#0c1018" strokeWidth={0.5} />
        {on && <circle cx={-0.7} cy={-0.7} r={0.8} fill="#eafff5" />}
      </g>
    </g>
  );
}

function StepperMotor({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  return (
    <g>
      <ellipse cx={62} cy={80} rx={42} ry={6} fill="#000" opacity={0.3} />

      <defs>
        <radialGradient id={`bodyrad-${id}`} cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#4a7fd6" />
          <stop offset="45%" stopColor="#2d5db4" />
          <stop offset="100%" stopColor="#163872" />
        </radialGradient>
        <linearGradient id={`bodyside-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#173a73" />
          <stop offset="22%" stopColor="#3a6cc4" />
          <stop offset="50%" stopColor="#2a55a8" />
          <stop offset="80%" stopColor="#1d437f" />
          <stop offset="100%" stopColor="#102e5e" />
        </linearGradient>
        <linearGradient id={`metaltop-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f2f4f7" />
          <stop offset="40%" stopColor="#c2c8d0" />
          <stop offset="100%" stopColor="#8a929c" />
        </linearGradient>
        <radialGradient id={`shaft-${id}`} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#f5e3a8" />
          <stop offset="55%" stopColor="#d9b24a" />
          <stop offset="100%" stopColor="#9c7a22" />
        </radialGradient>
        <linearGradient id={`cable-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbfbf6" />
          <stop offset="50%" stopColor="#e6e6dd" />
          <stop offset="100%" stopColor="#c4c4ba" />
        </linearGradient>
      </defs>

      {/* left lead: brass shaft tip connection */}
      <line x1={6} y1={44} x2={28} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      {/* right lead: white cable */}
      <line x1={94} y1={44} x2={114} y2={44} stroke="#e6e6dd" strokeWidth={4} strokeLinecap="round" />

      {/* mounting tab back */}
      <rect x={30} y={20} width={56} height={10} rx={3} fill="#1d437f" />
      <circle cx={36} cy={25} r={3} fill="#0d2347" />
      <circle cx={80} cy={25} r={3} fill="#0d2347" />

      {/* metal top plate */}
      <ellipse cx={58} cy={32} rx={32} ry={11} fill={`url(#metaltop-${id})`} stroke="#6b727c" strokeWidth={0.8} />
      <ellipse cx={58} cy={31} rx={20} ry={6} fill="none" stroke="#9aa1aa" strokeWidth={1} opacity={0.7} />

      {/* blue cylinder body */}
      <path d="M26 44 A32 11 0 0 0 90 44 L90 50 A32 11 0 0 1 26 50 Z" fill={`url(#bodyside-${id})`} />
      <ellipse cx={58} cy={44} rx={32} ry={11} fill={`url(#bodyrad-${id})`} stroke="#102e5e" strokeWidth={0.8} />
      {/* body highlight */}
      <ellipse cx={50} cy={40} rx={10} ry={3.5} fill="#9cc2f5" opacity={0.5} />
      {/* circular seam */}
      <ellipse cx={58} cy={44} rx={24} ry={8} fill="none" stroke="#0f3066" strokeWidth={1} opacity={0.5} />

      {/* brass shaft (off-centre) protruding from top */}
      <ellipse cx={44} cy={31} rx={6} ry={2.6} fill="#7a5e1a" />
      <circle cx={44} cy={26} r={6} fill={`url(#shaft-${id})`} stroke="#8a6c20" strokeWidth={0.6} />
      <rect x={41} y={20} width={6} height={6} fill={`url(#shaft-${id})`} />
      <ellipse cx={44} cy={20} rx={3} ry={1.4} fill="#f5e3a8" />
      {/* flat on D-shaft */}
      <rect x={43} y={21} width={1.4} height={4} fill="#b8932f" opacity={0.7} />

      {/* white connector cable exiting side, curving to right */}
      <path d="M78 47 C 92 50 96 46 102 44" fill="none" stroke={`url(#cable-${id})`} strokeWidth={9} strokeLinecap="round" />
      <path d="M78 47 C 92 50 96 46 102 44" fill="none" stroke="#b8b8ad" strokeWidth={9} strokeLinecap="round" opacity={0.0} />
      {/* wire detail lines */}
      <path d="M79 45 C 92 48 96 44 101 42.5" fill="none" stroke="#cf3030" strokeWidth={1} opacity={0.4} />
      <path d="M80 49 C 93 52 96 48 102 45.5" fill="none" stroke="#3a6cc4" strokeWidth={1} opacity={0.4} />

      {/* power LED */}
      {on && <circle cx={58} cy={44} r={9} fill="#34d399" opacity={0.35} />}
      <circle cx={58} cy={44} r={3.2} fill={on ? "#34d399" : "#243049"} stroke="#0d2347" strokeWidth={0.6} />
      {on && <circle cx={57} cy={43} r={1} fill="#d9ffe9" opacity={0.9} />}
    </g>
  );
}

function L298nDriver({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  return (
    <g>
      <ellipse cx={60} cy={80} rx={46} ry={6} fill="#000" opacity={0.3} />
      <line x1={6} y1={44} x2={20} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={100} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f6fb0" />
          <stop offset="1" stopColor="#1d4f86" />
        </linearGradient>
        <linearGradient id={`hs-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9edf2" />
          <stop offset="0.5" stopColor="#aeb6bf" />
          <stop offset="1" stopColor="#7d8590" />
        </linearGradient>
        <linearGradient id={`fin-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cfd6dd" />
          <stop offset="1" stopColor="#8b939c" />
        </linearGradient>
        <linearGradient id={`term-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4fbf6a" />
          <stop offset="1" stopColor="#1f8a3e" />
        </linearGradient>
        <radialGradient id={`led-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#9cffd0" />
          <stop offset="1" stopColor={on ? "#34d399" : "#243049"} />
        </radialGradient>
      </defs>
      {/* PCB board */}
      <rect x={20} y={16} width={80} height={56} rx={3} fill={`url(#pcb-${id})`} stroke="#143b66" strokeWidth={1} />
      <rect x={20} y={16} width={80} height={4} rx={2} fill="#fff" opacity={0.12} />
      {/* mounting holes */}
      <circle cx={26} cy={22} r={2} fill="#0e2c4d" />
      <circle cx={94} cy={66} r={2} fill="#0e2c4d" />
      {/* green screw terminal blocks - top edge */}
      <rect x={28} y={13} width={30} height={11} rx={1.5} fill={`url(#term-${id})`} stroke="#13662c" strokeWidth={0.8} />
      <circle cx={35} cy={18} r={2.4} fill="#caa23a" stroke="#6e5a1c" strokeWidth={0.6} />
      <line x1={35} y1={16} x2={35} y2={20} stroke="#5a4915" strokeWidth={0.7} />
      <circle cx={43} cy={18} r={2.4} fill="#caa23a" stroke="#6e5a1c" strokeWidth={0.6} />
      <line x1={43} y1={16} x2={43} y2={20} stroke="#5a4915" strokeWidth={0.7} />
      <circle cx={51} cy={18} r={2.4} fill="#caa23a" stroke="#6e5a1c" strokeWidth={0.6} />
      <line x1={51} y1={16} x2={51} y2={20} stroke="#5a4915" strokeWidth={0.7} />
      {/* green screw terminal block - bottom edge */}
      <rect x={62} y={64} width={30} height={11} rx={1.5} fill={`url(#term-${id})`} stroke="#13662c" strokeWidth={0.8} />
      <circle cx={69} cy={69} r={2.4} fill="#caa23a" stroke="#6e5a1c" strokeWidth={0.6} />
      <line x1={69} y1={67} x2={69} y2={71} stroke="#5a4915" strokeWidth={0.7} />
      <circle cx={77} cy={69} r={2.4} fill="#caa23a" stroke="#6e5a1c" strokeWidth={0.6} />
      <line x1={77} y1={67} x2={77} y2={71} stroke="#5a4915" strokeWidth={0.7} />
      <circle cx={85} cy={69} r={2.4} fill="#caa23a" stroke="#6e5a1c" strokeWidth={0.6} />
      <line x1={85} y1={67} x2={85} y2={71} stroke="#5a4915" strokeWidth={0.7} />
      {/* black H-bridge chip under heatsink */}
      <rect x={36} y={48} width={20} height={14} rx={1} fill="#15171a" stroke="#000" strokeWidth={0.6} />
      <rect x={37} y={49} width={18} height={2} fill="#33363b" />
      {/* pin headers */}
      <rect x={64} y={28} width={26} height={5} rx={1} fill="#111317" />
      <circle cx={68} cy={30.5} r={0.9} fill="#d9b24a" />
      <circle cx={73} cy={30.5} r={0.9} fill="#d9b24a" />
      <circle cx={78} cy={30.5} r={0.9} fill="#d9b24a" />
      <circle cx={83} cy={30.5} r={0.9} fill="#d9b24a" />
      <circle cx={88} cy={30.5} r={0.9} fill="#d9b24a" />
      {/* large finned heatsink on top */}
      <rect x={34} y={28} width={26} height={22} rx={2} fill={`url(#hs-${id})`} stroke="#5f666e" strokeWidth={0.8} />
      <rect x={37} y={28} width={3} height={22} fill={`url(#fin-${id})`} />
      <rect x={42} y={28} width={3} height={22} fill={`url(#fin-${id})`} />
      <rect x={47} y={28} width={3} height={22} fill={`url(#fin-${id})`} />
      <rect x={52} y={28} width={3} height={22} fill={`url(#fin-${id})`} />
      <rect x={34} y={28} width={26} height={2} fill="#fff" opacity={0.4} />
      {/* power LED */}
      {on && <circle cx={88} cy={58} r={7} fill="#34d399" opacity={0.35} />}
      <circle cx={88} cy={58} r={3} fill={`url(#led-${id})`} stroke="#0c241a" strokeWidth={0.6} />
      {on && <circle cx={87} cy={57} r={1} fill="#eafff5" />}
    </g>
  );
}

function WaterPump({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  return (
    <g>
      <defs>
        <linearGradient id={`body-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d6e6f2" />
          <stop offset="0.18" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#cfe0ee" />
          <stop offset="0.82" stopColor="#9fc0db" />
          <stop offset="1" stopColor="#7ba6c8" />
        </linearGradient>
        <linearGradient id={`cap-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3f7fb8" />
          <stop offset="0.3" stopColor="#6fb0e0" />
          <stop offset="0.6" stopColor="#2f6aa0" />
          <stop offset="1" stopColor="#1f4d7a" />
        </linearGradient>
        <linearGradient id={`nozzle-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5a92c4" />
          <stop offset="0.4" stopColor="#aacceb" />
          <stop offset="1" stopColor="#2c5e92" />
        </linearGradient>
        <radialGradient id={`base-${id}`} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#e8f1f8" />
          <stop offset="1" stopColor="#8fb2cf" />
        </radialGradient>
      </defs>

      <ellipse cx={60} cy={80} rx={34} ry={5} fill="#000" opacity={0.28} />

      <line x1={6} y1={44} x2={34} y2={48} stroke="#c0392b" strokeWidth={4} strokeLinecap="round" />
      <line x1={6} y1={44} x2={34} y2={40} stroke="#1a1a1a" strokeWidth={4} strokeLinecap="round" />
      <line x1={86} y1={20} x2={114} y2={44} stroke="#3a4a5a" strokeWidth={4} strokeLinecap="round" />

      <rect x={34} y={30} width={44} height={42} rx={9} fill={`url(#body-${id})`} stroke="#5e84a3" strokeWidth={1} />
      <ellipse cx={56} cy={31} rx={22} ry={7} fill={`url(#cap-${id})`} stroke="#1f4d7a" strokeWidth={1} />
      <rect x={39} y={34} width={6} height={34} rx={3} fill="#ffffff" opacity={0.55} />

      <rect x={34} y={66} width={44} height={10} rx={5} fill={`url(#base-${id})`} stroke="#5e84a3" strokeWidth={1} />
      <line x1={40} y1={66} x2={40} y2={75} stroke="#5e84a3" strokeWidth={1.4} />
      <line x1={46} y1={66} x2={46} y2={75} stroke="#5e84a3" strokeWidth={1.4} />
      <line x1={52} y1={66} x2={52} y2={75} stroke="#5e84a3" strokeWidth={1.4} />
      <line x1={58} y1={66} x2={58} y2={75} stroke="#5e84a3" strokeWidth={1.4} />
      <line x1={64} y1={66} x2={64} y2={75} stroke="#5e84a3" strokeWidth={1.4} />
      <line x1={70} y1={66} x2={70} y2={75} stroke="#5e84a3" strokeWidth={1.4} />

      <rect x={50} y={10} width={12} height={22} rx={3} fill={`url(#nozzle-${id})`} stroke="#1f4d7a" strokeWidth={1} />
      <rect x={48} y={8} width={16} height={6} rx={3} fill={`url(#nozzle-${id})`} stroke="#1f4d7a" strokeWidth={1} />
      <rect x={52} y={11} width={2.5} height={18} rx={1} fill="#ffffff" opacity={0.5} />

      {on && (
        <g>
          <ellipse cx={70} cy={12} rx={2.6} ry={3.4} fill="#38bdf8" opacity={0.85} />
          <ellipse cx={77} cy={20} rx={2} ry={2.7} fill="#38bdf8" opacity={0.7} />
          <ellipse cx={46} cy={16} rx={2.2} ry={3} fill="#38bdf8" opacity={0.75} />
        </g>
      )}

      {on && <circle cx={56} cy={50} r={8} fill="#34d399" opacity={0.3} />}
      <circle cx={56} cy={50} r={3.4} fill={on ? "#34d399" : "#243049"} stroke="#10314a" strokeWidth={0.8} />
      {on && <circle cx={54.8} cy={48.8} r={1} fill="#ffffff" opacity={0.85} />}
    </g>
  );
}

function VibrationMotor({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  const cx = 60;
  const cy = 44;
  const r = 30;
  return (
    <g>
      <defs>
        <radialGradient id={`disc-${id}`} cx="40%" cy="32%" r="80%">
          <stop offset="0%" stopColor="#fdfefe" />
          <stop offset="35%" stopColor="#dfe4e8" />
          <stop offset="70%" stopColor="#aab2ba" />
          <stop offset="100%" stopColor="#7c858d" />
        </radialGradient>
        <radialGradient id={`hub-${id}`} cx="42%" cy="34%" r="75%">
          <stop offset="0%" stopColor="#f2f4f6" />
          <stop offset="55%" stopColor="#c2c9cf" />
          <stop offset="100%" stopColor="#888f96" />
        </radialGradient>
        <linearGradient id={`tape-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f6d24b" />
          <stop offset="50%" stopColor="#e8b820" />
          <stop offset="100%" stopColor="#c79410" />
        </linearGradient>
        <radialGradient id={`led-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={on ? "#9cffd0" : "#33425a"} />
          <stop offset="60%" stopColor={on ? "#34d399" : "#243049"} />
          <stop offset="100%" stopColor={on ? "#0e9c6b" : "#1a2235"} />
        </radialGradient>
      </defs>

      <ellipse cx={cx} cy={78} rx={32} ry={6} fill="#000" opacity={0.28} />

      {/* motion arcs */}
      {on && (
        <g stroke="#8fd4ff" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.7}>
          <path d="M 22 26 A 30 30 0 0 1 30 18" />
          <path d="M 90 18 A 30 30 0 0 1 98 26" />
          <path d="M 98 62 A 30 30 0 0 1 90 70" />
          <path d="M 30 70 A 30 30 0 0 1 22 62" />
        </g>
      )}

      {/* left lead wire (red) */}
      <line x1={6} y1={44} x2={32} y2={40} stroke="#cf3b3b" strokeWidth={4} strokeLinecap="round" />
      {/* right lead wire (black) */}
      <line x1={88} y1={48} x2={114} y2={44} stroke="#2c2c2c" strokeWidth={4} strokeLinecap="round" />

      {/* yellow adhesive backing ring */}
      <circle cx={cx} cy={cy} r={r + 2} fill={`url(#tape-${id})`} />
      <circle cx={cx} cy={cy} r={r + 2} fill="none" stroke="#a87c0a" strokeWidth={1} opacity={0.6} />

      {/* silver metal disc */}
      <circle cx={cx} cy={cy} r={r} fill={`url(#disc-${id})`} stroke="#6b737a" strokeWidth={1} />
      <ellipse cx={cx - 9} cy={cy - 11} rx={13} ry={8} fill="#ffffff" opacity={0.35} />

      {/* concentric crimp ring */}
      <circle cx={cx} cy={cy} r={r - 5} fill="none" stroke="#9aa2a9" strokeWidth={1.2} opacity={0.8} />

      {/* central hub */}
      <circle cx={cx} cy={cy} r={12} fill={`url(#hub-${id})`} stroke="#7c848b" strokeWidth={1} />
      <circle cx={cx} cy={cy} r={4} fill="#5b6268" stroke="#3f4448" strokeWidth={0.8} />
      <circle cx={cx - 1.5} cy={cy - 1.5} r={1.4} fill="#cfd5da" />

      {/* power LED with halo */}
      {on && <circle cx={cx} cy={cy + 24} r={9} fill="#34d399" opacity={0.3} />}
      <circle cx={cx} cy={cy + 24} r={3.4} fill={`url(#led-${id})`} stroke="#0c3a2a" strokeWidth={0.6} />
    </g>
  );
}

function BluetoothHc05({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  return (
    <g>
      <ellipse cx={60} cy={80} rx={42} ry={6} fill="#000" opacity={0.28} />
      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a6fd4" />
          <stop offset="0.5" stopColor="#1f5bbf" />
          <stop offset="1" stopColor="#153f8c" />
        </linearGradient>
        <linearGradient id={`mod-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cfd6dd" />
          <stop offset="0.45" stopColor="#9aa3ad" />
          <stop offset="1" stopColor="#5f6770" />
        </linearGradient>
        <linearGradient id={`shield-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b424b" />
          <stop offset="1" stopColor="#16191d" />
        </linearGradient>
        <linearGradient id={`pin-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0d27a" />
          <stop offset="0.5" stopColor="#d9b24a" />
          <stop offset="1" stopColor="#a8842f" />
        </linearGradient>
        <radialGradient id={`led-${id}`} cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor={on ? "#ff8a8a" : "#5a2630"} />
          <stop offset="1" stopColor={on ? "#e02b2b" : "#3a1a20"} />
        </radialGradient>
      </defs>
      {/* leads */}
      <line x1={6} y1={44} x2={18} y2={44} stroke={`url(#pin-${id})`} strokeWidth={4} strokeLinecap="round" />
      <line x1={102} y1={44} x2={114} y2={44} stroke={`url(#pin-${id})`} strokeWidth={4} strokeLinecap="round" />
      {/* blue PCB */}
      <rect x={18} y={12} width={84} height={58} rx={5} fill={`url(#pcb-${id})`} stroke="#0e2f6b" strokeWidth={1.2} />
      <rect x={18} y={12} width={84} height={9} rx={5} fill="#ffffff" opacity={0.12} />
      {/* corner mounting holes */}
      <circle cx={24} cy={18} r={2} fill="#0c2657" />
      <circle cx={96} cy={18} r={2} fill="#0c2657" />
      {/* silver SMD radio module */}
      <rect x={24} y={24} width={50} height={32} rx={2.5} fill={`url(#mod-${id})`} stroke="#4a525b" strokeWidth={1} />
      {/* shield can lower portion */}
      <rect x={24} y={40} width={50} height={16} rx={2} fill={`url(#shield-${id})`} stroke="#0c0e11" strokeWidth={0.8} />
      {/* white PCB antenna zig-zag */}
      <polyline
        points="28,30 33,28 28,33 33,31 28,36 33,34 28,38"
        fill="none"
        stroke="#f4f7fa"
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <rect x={40} y={28} width={28} height={9} rx={1} fill="#bfc6cd" opacity={0.5} />
      {/* HC-05 silkscreen */}
      <text x={49} y={51} fontSize={6.5} fontFamily="monospace" fontWeight="bold" fill="#e7edf3" textAnchor="middle">
        HC-05
      </text>
      {/* small chip + caps */}
      <rect x={78} y={26} width={9} height={7} rx={1} fill="#2b2f35" />
      <rect x={90} y={26} width={5} height={4} rx={0.6} fill="#caa05a" />
      <rect x={90} y={33} width={5} height={4} rx={0.6} fill="#caa05a" />
      <rect x={78} y={37} width={6} height={4} rx={0.6} fill="#caa05a" />
      {/* status LED */}
      {on && <circle cx={86} cy={45} r={7} fill="#ff3b3b" opacity={0.35} />}
      <circle cx={86} cy={45} r={2.6} fill={`url(#led-${id})`} stroke="#7a1a22" strokeWidth={0.6} />
      {/* power LED (green) */}
      {on && <circle cx={32} cy={62} r={6} fill="#34d399" opacity={0.4} />}
      <circle cx={32} cy={62} r={2.4} fill={on ? "#34d399" : "#243049"} stroke="#0e2f6b" strokeWidth={0.5} />
      {/* bottom header */}
      <rect x={24} y={62} width={56} height={7} rx={1.5} fill="#101418" stroke="#000" strokeWidth={0.5} />
      <circle cx={31} cy={65.5} r={1.5} fill={`url(#pin-${id})`} />
      <circle cx={40} cy={65.5} r={1.5} fill={`url(#pin-${id})`} />
      <circle cx={49} cy={65.5} r={1.5} fill={`url(#pin-${id})`} />
      <circle cx={58} cy={65.5} r={1.5} fill={`url(#pin-${id})`} />
      <circle cx={67} cy={65.5} r={1.5} fill={`url(#pin-${id})`} />
      <circle cx={75} cy={65.5} r={1.5} fill={`url(#pin-${id})`} />
    </g>
  );
}

function Nrf24({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  return (
    <g>
      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f4ed0" />
          <stop offset="0.5" stopColor="#1640a8" />
          <stop offset="1" stopColor="#0e2f7e" />
        </linearGradient>
        <linearGradient id={`chip-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3f47" />
          <stop offset="0.5" stopColor="#1c1f24" />
          <stop offset="1" stopColor="#0c0d10" />
        </linearGradient>
        <linearGradient id={`xtal-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2f4f7" />
          <stop offset="0.4" stopColor="#c2cad4" />
          <stop offset="1" stopColor="#7d8794" />
        </linearGradient>
        <linearGradient id={`hdr-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2d33" />
          <stop offset="1" stopColor="#101216" />
        </linearGradient>
        <radialGradient id={`led-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#bbf7d0" />
          <stop offset="0.5" stopColor="#34d399" />
          <stop offset="1" stopColor="#0f7a4d" />
        </radialGradient>
      </defs>

      <ellipse cx={60} cy={80} rx={48} ry={5} fill="#000" opacity={0.28} />

      <line x1={6} y1={44} x2={18} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={102} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />

      <rect x={16} y={12} width={88} height={64} rx={4} fill={`url(#pcb-${id})`} stroke="#0a2566" strokeWidth={1} />
      <rect x={16} y={12} width={88} height={5} rx={4} fill="#fff" opacity={0.12} />

      <circle cx={21} cy={17} r={2.2} fill="#0a2058" />
      <circle cx={99} cy={17} r={2.2} fill="#0a2058" />

      <g stroke="#e9b23a" strokeWidth={1.6} fill="none" strokeLinejoin="round">
        <path d="M22 22 h6 v5 h6 v-5 h6 v5 h6 v-5 h6 v5 h6 v-5 h6 v5 h6 v-5 h6" />
        <path d="M22 22 h76" opacity={0.5} />
      </g>

      <rect x={24} y={40} width={26} height={26} rx={2} fill={`url(#chip-${id})`} stroke="#000" strokeWidth={0.8} />
      <rect x={26} y={42} width={22} height={9} rx={1} fill="#2c3037" opacity={0.6} />
      <circle cx={28} cy={44} r={1.4} fill="#0a0b0d" />
      <g stroke="#9aa0a8" strokeWidth={0.8}>
        <line x1={22} y1={44} x2={24} y2={44} />
        <line x1={22} y1={48} x2={24} y2={48} />
        <line x1={22} y1={52} x2={24} y2={52} />
        <line x1={22} y1={56} x2={24} y2={56} />
        <line x1={22} y1={60} x2={24} y2={60} />
        <line x1={50} y1={44} x2={52} y2={44} />
        <line x1={50} y1={48} x2={52} y2={48} />
        <line x1={50} y1={52} x2={52} y2={52} />
        <line x1={50} y1={56} x2={52} y2={56} />
        <line x1={50} y1={60} x2={52} y2={60} />
      </g>

      <rect x={58} y={42} width={24} height={14} rx={2.5} fill={`url(#xtal-${id})`} stroke="#5a626e" strokeWidth={0.8} />
      <rect x={60} y={44} width={20} height={3} rx={1} fill="#fff" opacity={0.45} />

      <rect x={86} y={42} width={10} height={6} rx={1} fill="#3a3f47" stroke="#15171b" strokeWidth={0.5} />
      <rect x={86} y={52} width={10} height={6} rx={1} fill="#c9a45a" stroke="#7a5f2a" strokeWidth={0.5} />

      <rect x={28} y={67} width={56} height={9} rx={1.5} fill={`url(#hdr-${id})`} stroke="#000" strokeWidth={0.6} />
      {[0, 1, 2, 3].map((c) => (
        <g key={c}>
          <rect x={31 + c * 13} y={68.5} width={4} height={2.5} rx={0.5} fill="#d9b24a" />
          <rect x={31 + c * 13} y={72.5} width={4} height={2.5} rx={0.5} fill="#d9b24a" />
        </g>
      ))}

      {on && <circle cx={94} cy={20} r={7} fill="#34d399" opacity={0.35} />}
      <circle cx={94} cy={20} r={3} fill={on ? `url(#led-${id})` : "#243049"} stroke="#0a1424" strokeWidth={0.6} />
    </g>
  );
}

function Rc522Rfid({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  const coils = [0, 1, 2, 3, 4];
  return (
    <g>
      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b6fb8" />
          <stop offset="0.5" stopColor="#1f4f88" />
          <stop offset="1" stopColor="#163a66" />
        </linearGradient>
        <linearGradient id={`chip-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3f47" />
          <stop offset="0.5" stopColor="#1d2026" />
          <stop offset="1" stopColor="#0c0e12" />
        </linearGradient>
        <linearGradient id={`pin-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4e08a" />
          <stop offset="0.5" stopColor="#d9b24a" />
          <stop offset="1" stopColor="#9c7a2c" />
        </linearGradient>
        <radialGradient id={`glow-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#34d399" stopOpacity="0.9" />
          <stop offset="1" stopColor="#34d399" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx={60} cy={80} rx={48} ry={6} fill="#000" opacity={0.3} />

      <line x1={6} y1={44} x2={18} y2={44} stroke={`url(#pin-${id})`} strokeWidth={4} strokeLinecap="round" />
      <line x1={102} y1={44} x2={114} y2={44} stroke={`url(#pin-${id})`} strokeWidth={4} strokeLinecap="round" />

      <rect x={16} y={12} width={88} height={64} rx={4} fill={`url(#pcb-${id})`} stroke="#0f2a4d" strokeWidth={1} />
      <rect x={16} y={12} width={88} height={4} rx={4} fill="#fff" opacity={0.12} />

      <circle cx={21} cy={17} r={2} fill="#0c2342" />
      <circle cx={99} cy={17} r={2} fill="#0c2342" />
      <circle cx={21} cy={71} r={2} fill="#0c2342" />
      <circle cx={99} cy={71} r={2} fill="#0c2342" />

      {coils.map((i) => (
        <rect
          key={i}
          x={22 + i * 3}
          y={20 + i * 3}
          width={76 - i * 6}
          height={48 - i * 6}
          rx={3}
          fill="none"
          stroke="#c9a23a"
          strokeWidth={1.4}
          opacity={0.85}
        />
      ))}

      <rect x={48} y={32} width={24} height={24} rx={2} fill={`url(#chip-${id})`} stroke="#000" strokeWidth={0.6} />
      <rect x={48} y={33} width={24} height={2} fill="#fff" opacity={0.1} />
      <circle cx={52} cy={36} r={1.4} fill="#444" />
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={`l${i}`} x1={48} y1={36 + i * 4} x2={45} y2={36 + i * 4} stroke="#9a9a9a" strokeWidth={1} />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={`r${i}`} x1={72} y1={36 + i * 4} x2={75} y2={36 + i * 4} stroke="#9a9a9a" strokeWidth={1} />
      ))}

      <text x={60} y={28} textAnchor="middle" fontSize={6} fontFamily="monospace" fontWeight="bold" fill="#e8eef6" opacity={0.92}>
        RC522
      </text>

      <rect x={24} y={64} width={56} height={8} rx={1.5} fill="#101a2c" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={`h${i}`} x={26 + i * 6.6} y={65.5} width={3} height={5} rx={0.6} fill={`url(#pin-${id})`} />
      ))}

      {on && <circle cx={92} cy={62} r={9} fill={`url(#glow-${id})`} />}
      <circle cx={92} cy={62} r={3} fill={on ? "#34d399" : "#243049"} stroke="#0d1726" strokeWidth={0.8} />
      {on && <circle cx={91} cy={61} r={1} fill="#d9fff0" opacity={0.9} />}
    </g>
  );
}

function IrReceiver({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  return (
    <g>
      <defs>
        <radialGradient id={`dome-${id}`} cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#3a3f47" />
          <stop offset="45%" stopColor="#1a1c20" />
          <stop offset="100%" stopColor="#050608" />
        </radialGradient>
        <radialGradient id={`win-${id}`} cx="42%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#2b2f36" />
          <stop offset="100%" stopColor="#0a0b0d" />
        </radialGradient>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2f7d52" />
          <stop offset="100%" stopColor="#1c5436" />
        </linearGradient>
        <linearGradient id={`leg-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f1e6b8" />
          <stop offset="45%" stopColor="#d9b24a" />
          <stop offset="100%" stopColor="#9c7c2e" />
        </linearGradient>
        <radialGradient id={`led-${id}`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor={on ? "#bbf7d0" : "#3a4a5e"} />
          <stop offset="60%" stopColor={on ? "#34d399" : "#243049"} />
          <stop offset="100%" stopColor={on ? "#16855f" : "#171f30"} />
        </radialGradient>
      </defs>

      <ellipse cx={60} cy={80} rx={42} ry={6} fill="#000" opacity={0.3} />

      <line x1={6} y1={44} x2={34} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={86} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />

      {/* PCB carrier */}
      <rect x={34} y={30} width={52} height={30} rx={3} fill={`url(#pcb-${id})`} stroke="#123a25" strokeWidth={1} />
      <rect x={34} y={31} width={52} height={3} rx={2} fill="#ffffff" opacity={0.12} />

      {/* mounting holes */}
      <circle cx={40} cy={36} r={2} fill="#0c2b1b" />
      <circle cx={80} cy={36} r={2} fill="#0c2b1b" />

      {/* three legs going down */}
      <rect x={47} y={58} width={3.5} height={16} rx={1} fill={`url(#leg-${id})`} />
      <rect x={58.5} y={58} width={3.5} height={16} rx={1} fill={`url(#leg-${id})`} />
      <rect x={70} y={58} width={3.5} height={16} rx={1} fill={`url(#leg-${id})`} />
      <rect x={45} y={57} width={30} height={3} rx={1} fill="#1c5436" />

      {/* black TSOP body */}
      <rect x={44} y={26} width={32} height={26} rx={5} fill="#16181c" stroke="#000000" strokeWidth={1} />
      <rect x={46} y={28} width={28} height={6} rx={3} fill="#ffffff" opacity={0.07} />

      {/* hemispherical dome */}
      <ellipse cx={60} cy={34} rx={15} ry={14} fill={`url(#dome-${id})`} stroke="#000000" strokeWidth={1} />
      <ellipse cx={55} cy={28} rx={5} ry={4} fill="#7d848f" opacity={0.35} />
      {/* flat dark IR window */}
      <ellipse cx={60} cy={35} rx={9.5} ry={9} fill={`url(#win-${id})`} />
      <ellipse cx={57} cy={31} rx={2.5} ry={2} fill="#586270" opacity={0.4} />

      {/* indicator LED */}
      {on && <circle cx={60} cy={66} r={9} fill="#34d399" opacity={0.3} />}
      <circle cx={60} cy={66} r={4.5} fill={`url(#led-${id})`} stroke={on ? "#0c6e4d" : "#11192a"} strokeWidth={1} />
      <circle cx={58.5} cy={64.5} r={1.4} fill="#ffffff" opacity={on ? 0.85 : 0.25} />
    </g>
  );
}

function JoystickModule({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  return (
    <g>
      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f6fd6" />
          <stop offset="0.5" stopColor="#1d4f9e" />
          <stop offset="1" stopColor="#143a78" />
        </linearGradient>
        <linearGradient id={`gimbal-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7d8794" />
          <stop offset="0.5" stopColor="#5a636e" />
          <stop offset="1" stopColor="#3a424c" />
        </linearGradient>
        <radialGradient id={`cap-${id}`} cx="0.38" cy="0.32" r="0.85">
          <stop offset="0" stopColor="#4a4f57" />
          <stop offset="0.45" stopColor="#23262b" />
          <stop offset="1" stopColor="#0c0d10" />
        </radialGradient>
        <radialGradient id={`capring-${id}`} cx="0.5" cy="0.5" r="0.6">
          <stop offset="0.7" stopColor="#1a1c20" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <linearGradient id={`pin-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3d98a" />
          <stop offset="0.5" stopColor="#d9b24a" />
          <stop offset="1" stopColor="#a8842f" />
        </linearGradient>
      </defs>

      {/* shadow */}
      <ellipse cx={60} cy={80} rx={44} ry={6} fill="#000" opacity={0.3} />

      {/* leads */}
      <line x1={6} y1={44} x2={24} y2={44} stroke="#c9a23f" strokeWidth={4} strokeLinecap="round" />
      <line x1={96} y1={44} x2={114} y2={44} stroke="#c9a23f" strokeWidth={4} strokeLinecap="round" />

      {/* PCB */}
      <rect x={22} y={20} width={76} height={50} rx={4} fill={`url(#pcb-${id})`} stroke="#0e2c5c" strokeWidth={1.2} />
      <rect x={22} y={20} width={76} height={4} rx={2} fill="#fff" opacity={0.12} />
      {/* mounting holes */}
      <circle cx={28} cy={26} r={2.4} fill="#0c264f" stroke="#9ab2da" strokeWidth={0.8} />
      <circle cx={92} cy={26} r={2.4} fill="#0c264f" stroke="#9ab2da" strokeWidth={0.8} />
      <circle cx={28} cy={64} r={2.4} fill="#0c264f" stroke="#9ab2da" strokeWidth={0.8} />
      <circle cx={92} cy={64} r={2.4} fill="#0c264f" stroke="#9ab2da" strokeWidth={0.8} />

      {/* gimbal base */}
      <rect x={42} y={30} width={36} height={32} rx={3} fill={`url(#gimbal-${id})`} stroke="#2c333b" strokeWidth={1} />
      <rect x={45} y={33} width={30} height={26} rx={2} fill="none" stroke="#2c333b" strokeWidth={0.8} opacity={0.6} />
      {/* gimbal screw posts */}
      <circle cx={46} cy={34} r={1.6} fill="#8b939e" stroke="#2c333b" strokeWidth={0.5} />
      <circle cx={74} cy={34} r={1.6} fill="#8b939e" stroke="#2c333b" strokeWidth={0.5} />
      <circle cx={46} cy={58} r={1.6} fill="#8b939e" stroke="#2c333b" strokeWidth={0.5} />
      <circle cx={74} cy={58} r={1.6} fill="#8b939e" stroke="#2c333b" strokeWidth={0.5} />

      {/* thumbstick cap (hero) */}
      <ellipse cx={60} cy={48} rx={17} ry={6} fill="#000" opacity={0.35} />
      <circle cx={60} cy={42} r={16.5} fill={`url(#capring-${id})`} stroke="#000" strokeWidth={0.8} />
      <circle cx={60} cy={41} r={14} fill={`url(#cap-${id})`} />
      {/* concave dish rim */}
      <circle cx={60} cy={41} r={14} fill="none" stroke="#000" strokeWidth={1.4} opacity={0.55} />
      <circle cx={60} cy={41} r={9.5} fill="none" stroke="#3a3e45" strokeWidth={1.2} opacity={0.7} />
      {/* grip texture rings */}
      <circle cx={60} cy={41} r={6} fill="none" stroke="#000" strokeWidth={1} opacity={0.5} />
      <circle cx={60} cy={41} r={3} fill="none" stroke="#000" strokeWidth={0.8} opacity={0.5} />
      {/* highlight */}
      <ellipse cx={55} cy={36} rx={4.5} ry={3} fill="#fff" opacity={0.22} />

      {/* header pins row (5) */}
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <rect x={32 + i * 11} y={64} width={6} height={9} rx={1} fill="#1a1d22" stroke="#000" strokeWidth={0.4} />
          <rect x={34 + i * 11} y={71} width={2} height={6} fill={`url(#pin-${id})`} />
        </g>
      ))}

      {/* power LED */}
      {on && <circle cx={88} cy={58} r={7} fill="#34d399" opacity={0.35} />}
      <circle cx={88} cy={58} r={2.6} fill={on ? "#34d399" : "#243049"} stroke="#0e2c5c" strokeWidth={0.6} />
      {on && <circle cx={87} cy={57} r={0.9} fill="#eafff5" />}
    </g>
  );
}

function MembraneKeypad({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  const labels = [
    ["1", "2", "3", "A"],
    ["4", "5", "6", "B"],
    ["7", "8", "9", "C"],
    ["*", "0", "#", "D"],
  ];
  const panelX = 26;
  const panelY = 8;
  const panelW = 68;
  const panelH = 72;
  const gx = panelX + 6;
  const gy = panelY + 6;
  const cell = 14;
  const gap = 1.5;
  return (
    <g>
      <ellipse cx={60} cy={82} rx={42} ry={5} fill="#000" opacity={0.28} />
      <defs>
        <linearGradient id={`panel-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a4a63" />
          <stop offset="0.5" stopColor="#2b384d" />
          <stop offset="1" stopColor="#1d2737" />
        </linearGradient>
        <linearGradient id={`key-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#56678a" />
          <stop offset="1" stopColor="#34425c" />
        </linearGradient>
        <linearGradient id={`ribbon-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d8a23a" />
          <stop offset="0.5" stopColor="#c98f24" />
          <stop offset="1" stopColor="#a8741a" />
        </linearGradient>
        <radialGradient id={`glow-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#34d399" stopOpacity="0.85" />
          <stop offset="1" stopColor="#34d399" stopOpacity="0" />
        </radialGradient>
      </defs>
      <line x1={6} y1={44} x2={26} y2={44} stroke="#c98f24" strokeWidth={4} strokeLinecap="round" />
      <g>
        <rect x={94} y={36} width={20} height={16} rx={1.5} fill={`url(#ribbon-${id})`} />
        <line x1={97} y1={37} x2={97} y2={51} stroke="#8a5f12" strokeWidth={0.8} />
        <line x1={100} y1={37} x2={100} y2={51} stroke="#8a5f12" strokeWidth={0.8} />
        <line x1={103} y1={37} x2={103} y2={51} stroke="#8a5f12" strokeWidth={0.8} />
        <line x1={106} y1={37} x2={106} y2={51} stroke="#8a5f12" strokeWidth={0.8} />
        <line x1={109} y1={37} x2={109} y2={51} stroke="#8a5f12" strokeWidth={0.8} />
      </g>
      <line x1={114} y1={44} x2={114} y2={44} stroke="#c98f24" strokeWidth={4} strokeLinecap="round" />
      <rect x={panelX} y={panelY} width={panelW} height={panelH} rx={4} fill={`url(#panel-${id})`} stroke="#121a26" strokeWidth={1.2} />
      <rect x={panelX + 1.5} y={panelY + 1.5} width={panelW - 3} height={3} rx={1.5} fill="#ffffff" opacity={0.1} />
      {labels.map((row, r) =>
        row.map((lab, c) => {
          const x = gx + c * (cell + gap);
          const y = gy + r * (cell + gap);
          return (
            <g key={`${r}-${c}`}>
              <rect x={x} y={y} width={cell} height={cell} rx={2} fill={`url(#key-${id})`} stroke="#1a2333" strokeWidth={0.7} />
              <rect x={x + 1} y={y + 1} width={cell - 2} height={3} rx={1} fill="#ffffff" opacity={0.14} />
              <text x={x + cell / 2} y={y + cell / 2 + 3} textAnchor="middle" fontSize={7} fontFamily="Arial, sans-serif" fontWeight="bold" fill="#e8edf5">{lab}</text>
            </g>
          );
        })
      )}
      {on && <circle cx={panelX + panelW - 7} cy={panelY + 5} r={6} fill={`url(#glow-${id})`} />}
      <circle cx={panelX + panelW - 7} cy={panelY + 5} r={2} fill={on ? "#34d399" : "#243049"} stroke="#10202f" strokeWidth={0.5} />
    </g>
  );
}

function RotaryEncoder({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  return (
    <g>
      <ellipse cx={60} cy={80} rx={42} ry={6} fill="#000" opacity={0.28} />
      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f6bd6" />
          <stop offset="0.5" stopColor="#1f4fae" />
          <stop offset="1" stopColor="#173e8a" />
        </linearGradient>
        <linearGradient id={`metal-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2f4f7" />
          <stop offset="0.5" stopColor="#c2c9d2" />
          <stop offset="1" stopColor="#8b95a3" />
        </linearGradient>
        <linearGradient id={`shaft-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9aa3af" />
          <stop offset="0.5" stopColor="#e6eaf0" />
          <stop offset="1" stopColor="#7d8794" />
        </linearGradient>
        <radialGradient id={`knob-${id}`} cx="0.38" cy="0.32" r="0.85">
          <stop offset="0" stopColor="#5a5f66" />
          <stop offset="0.55" stopColor="#2a2d31" />
          <stop offset="1" stopColor="#121316" />
        </radialGradient>
        <radialGradient id={`glow-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#34d399" stopOpacity="0.9" />
          <stop offset="1" stopColor="#34d399" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* leads / pins */}
      <line x1={6} y1={44} x2={26} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={94} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />

      {/* PCB board */}
      <rect x={26} y={30} width={68} height={42} rx={3} fill={`url(#pcb-${id})`} stroke="#102a5e" strokeWidth={1} />
      <rect x={26} y={30} width={68} height={6} rx={3} fill="#ffffff" opacity={0.12} />
      {/* mounting hole */}
      <circle cx={31} cy={36} r={2.2} fill="#0e2350" stroke="#9fb4dd" strokeWidth={0.6} />
      <circle cx={89} cy={36} r={2.2} fill="#0e2350" stroke="#9fb4dd" strokeWidth={0.6} />

      {/* header pins row at bottom */}
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <rect x={36 + i * 10} y={70} width={5} height={5} rx={1} fill="#1a1c20" />
          <rect x={37.4 + i * 10} y={73} width={2.2} height={6} rx={1} fill="#d9b24a" />
          <rect x={37.4 + i * 10} y={73} width={1} height={6} rx={0.5} fill="#fff2c4" opacity={0.6} />
        </g>
      ))}

      {/* silver encoder body */}
      <rect x={44} y={28} width={32} height={32} rx={2} fill={`url(#metal-${id})`} stroke="#6b727d" strokeWidth={1} />
      <rect x={46} y={30} width={28} height={4} rx={1} fill="#ffffff" opacity={0.55} />
      {/* four crimp tabs */}
      <rect x={42} y={33} width={3} height={6} fill="#aab2bd" />
      <rect x={42} y={48} width={3} height={6} fill="#aab2bd" />
      <rect x={75} y={33} width={3} height={6} fill="#aab2bd" />
      <rect x={75} y={48} width={3} height={6} fill="#aab2bd" />

      {/* knurled shaft */}
      <rect x={56} y={16} width={8} height={16} rx={1} fill={`url(#shaft-${id})`} stroke="#6b727d" strokeWidth={0.5} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line key={i} x1={57 + i * 1.2} y1={16} x2={57 + i * 1.2} y2={32} stroke="#7d8794" strokeWidth={0.4} opacity={0.7} />
      ))}

      {/* black knob cap */}
      <g style={{ transformOrigin: "60px 18px", animation: on ? "cl-spin 0.6s linear infinite" : "none" }}>
        <ellipse cx={60} cy={26} rx={18} ry={8} fill="#0c0d0f" opacity={0.55} />
        <ellipse cx={60} cy={18} rx={18} ry={9} fill={`url(#knob-${id})`} stroke="#000" strokeWidth={0.6} />
        <ellipse cx={56} cy={15} rx={7} ry={3.2} fill="#ffffff" opacity={0.18} />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const a = (i / 8) * Math.PI * 2;
          return <line key={i} x1={60 + Math.cos(a) * 14} y1={18 + Math.sin(a) * 7} x2={60 + Math.cos(a) * 17} y2={18 + Math.sin(a) * 8.3} stroke="#000" strokeWidth={0.8} opacity={0.5} />;
        })}
        <line x1={60} y1={18} x2={60} y2={10} stroke="#3a3d42" strokeWidth={1.4} strokeLinecap="round" />
      </g>

      {/* power LED */}
      {on && <circle cx={85} cy={64} r={7} fill={`url(#glow-${id})`} />}
      <circle cx={85} cy={64} r={2.6} fill={on ? "#34d399" : "#243049"} stroke="#0e2350" strokeWidth={0.6} />
      {on && <circle cx={84} cy={63} r={0.9} fill="#d6ffe9" />}
    </g>
  );
}

function SolarPanel({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  const cols = 4;
  const rows = 3;
  const px = 18;
  const py = 18;
  const pw = 84;
  const ph = 52;
  const gap = 2.5;
  const cellW = (pw - gap * (cols + 1)) / cols;
  const cellH = (ph - gap * (rows + 1)) / rows;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = px + gap + c * (cellW + gap);
      const cy = py + gap + r * (cellH + gap);
      cells.push(
        <rect
          key={`cell-${id}-${r}-${c}`}
          x={cx}
          y={cy}
          width={cellW}
          height={cellH}
          rx={1}
          fill={`url(#cell-${id})`}
          stroke="#0a1a3a"
          strokeWidth={0.4}
        />
      );
    }
  }
  return (
    <g>
      <defs>
        <linearGradient id={`frame-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d8dde6" />
          <stop offset="0.5" stopColor="#9aa3b2" />
          <stop offset="1" stopColor="#6c7585" />
        </linearGradient>
        <linearGradient id={`cell-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2b4ea8" />
          <stop offset="0.45" stopColor="#1c357d" />
          <stop offset="0.55" stopColor="#16306f" />
          <stop offset="1" stopColor="#0f2456" />
        </linearGradient>
        <linearGradient id={`glass-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`glint-${id}`} cx="0.3" cy="0.25" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`halo-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#34d399" stopOpacity="0.85" />
          <stop offset="1" stopColor="#34d399" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx={60} cy={80} rx={46} ry={6} fill="#000" opacity={0.28} />

      <line x1={6} y1={44} x2={px} y2={38} stroke="#b4341f" strokeWidth={4} strokeLinecap="round" />
      <line x1={6} y1={44} x2={px} y2={50} stroke="#1a1a1a" strokeWidth={4} strokeLinecap="round" />
      <line x1={px + pw} y1={38} x2={114} y2={44} stroke="#b4341f" strokeWidth={4} strokeLinecap="round" />
      <line x1={px + pw} y1={50} x2={114} y2={44} stroke="#1a1a1a" strokeWidth={4} strokeLinecap="round" />

      <rect x={px - 3} y={py - 3} width={pw + 6} height={ph + 6} rx={4} fill={`url(#frame-${id})`} stroke="#5a6271" strokeWidth={1} />
      <rect x={px - 1.5} y={py - 1.5} width={pw + 3} height={ph + 3} rx={2.5} fill="#0c1f4a" />

      <rect x={px} y={py} width={pw} height={ph} rx={1.5} fill="#0a1a3a" />
      {cells}

      <rect x={px} y={py} width={pw} height={ph} rx={1.5} fill={`url(#glass-${id})`} />
      {on && <ellipse cx={px + 26} cy={py + 16} rx={30} ry={16} fill={`url(#glint-${id})`} />}

      {on && <circle cx={px + pw - 6} cy={py + ph + 9} r={9} fill={`url(#halo-${id})`} />}
      <circle cx={px + pw - 6} cy={py + ph + 9} r={3.2} fill={on ? "#34d399" : "#243049"} stroke="#0c1f4a" strokeWidth={0.8} />
      {on && <circle cx={px + pw - 7} cy={py + ph + 8} r={1} fill="#d6fff0" opacity={0.9} />}
    </g>
  );
}

function BuckConverter({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  return (
    <g>
      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f6bd1" />
          <stop offset="0.5" stopColor="#1f4f9e" />
          <stop offset="1" stopColor="#163d7a" />
        </linearGradient>
        <linearGradient id={`pcbtop-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="0.4" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`ind-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#444a52" />
          <stop offset="0.5" stopColor="#23272c" />
          <stop offset="1" stopColor="#101316" />
        </linearGradient>
        <linearGradient id={`cap-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3a3f47" />
          <stop offset="0.3" stopColor="#8b9099" />
          <stop offset="0.5" stopColor="#c8ccd2" />
          <stop offset="0.7" stopColor="#6d727a" />
          <stop offset="1" stopColor="#2c3036" />
        </linearGradient>
        <radialGradient id={`captop-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#4a4f57" />
          <stop offset="0.8" stopColor="#23262b" />
          <stop offset="1" stopColor="#0e1013" />
        </radialGradient>
        <linearGradient id={`chip-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#33383f" />
          <stop offset="1" stopColor="#16191d" />
        </linearGradient>
        <radialGradient id={`glow-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#34d399" stopOpacity="0.85" />
          <stop offset="1" stopColor="#34d399" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="60" cy="80" rx="46" ry="6" fill="#000" opacity="0.28" />

      <line x1={6} y1={44} x2={18} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={102} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />

      <rect x={16} y={20} width={88} height={48} rx={3} fill={`url(#pcb-${id})`} stroke="#0e2e5e" strokeWidth={1.2} />
      <rect x={16} y={20} width={88} height={48} rx={3} fill={`url(#pcbtop-${id})`} />

      <rect x={17} y={32} width={6} height={9} rx={1} fill="#d9b24a" opacity="0.9" />
      <rect x={17} y={46} width={6} height={9} rx={1} fill="#bdbdbd" opacity="0.85" />
      <rect x={97} y={32} width={6} height={9} rx={1} fill="#d9b24a" opacity="0.9" />
      <rect x={97} y={46} width={6} height={9} rx={1} fill="#bdbdbd" opacity="0.85" />

      <rect x={29} y={28} width={26} height={26} rx={2.5} fill={`url(#ind-${id})`} stroke="#000" strokeWidth={0.8} />
      <rect x={31} y={30} width={22} height={6} rx={1} fill="#ffffff" opacity="0.1" />
      <text x={42} y={45} fontSize={6} fill="#9aa0a8" textAnchor="middle" fontFamily="monospace">68u</text>

      <ellipse cx={75} cy={41} rx={11} ry={11} fill={`url(#captop-${id})`} stroke="#0a0c0e" strokeWidth={0.8} />
      <rect x={64} y={41} width={22} height={20} fill={`url(#cap-${id})`} />
      <ellipse cx={75} cy={61} rx={11} ry={5} fill="#1a1d21" />
      <path d="M64 41 a11 11 0 0 0 22 0" fill="none" stroke="#0a0c0e" strokeWidth={0.6} />
      <line x1={75} y1={32} x2={75} y2={50} stroke="#c8ccd2" strokeWidth={2} opacity="0.5" />
      <rect x={70} y={43} width={3} height={16} fill="#3a3f47" opacity="0.6" />

      <rect x={84} y={28} width={13} height={20} rx={1.5} fill={`url(#chip-${id})`} stroke="#000" strokeWidth={0.6} />
      <circle cx={87} cy={31} r={1} fill="#555" />
      <rect x={82} y={31} width={2} height={1.6} fill="#cfcfcf" />
      <rect x={82} y={36} width={2} height={1.6} fill="#cfcfcf" />
      <rect x={82} y={41} width={2} height={1.6} fill="#cfcfcf" />
      <rect x={97} y={31} width={2} height={1.6} fill="#cfcfcf" />
      <rect x={97} y={41} width={2} height={1.6} fill="#cfcfcf" />

      <rect x={30} y={56} width={16} height={9} rx={1.5} fill="#2f6bd1" stroke="#0e2e5e" strokeWidth={0.8} />
      <circle cx={38} cy={60.5} r={3} fill="#dfe4ea" stroke="#9aa0a8" strokeWidth={0.6} />
      <line x1={38} y1={58} x2={38} y2={63} stroke="#3a3f47" strokeWidth={1} />

      {on && <circle cx={56} cy={61} r={8} fill={`url(#glow-${id})`} />}
      <circle cx={56} cy={61} r={2.4} fill={on ? "#34d399" : "#243049"} stroke="#0a0c0e" strokeWidth={0.5} />
      {on && <circle cx={55.2} cy={60.2} r={0.8} fill="#eafff5" />}
    </g>
  );
}

function UsbPower({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  return (
    <g>
      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f7a4d" />
          <stop offset="0.5" stopColor="#15633c" />
          <stop offset="1" stopColor="#0e4a2c" />
        </linearGradient>
        <linearGradient id={`shell-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2f4f7" />
          <stop offset="0.45" stopColor="#c2c8d0" />
          <stop offset="1" stopColor="#878f9a" />
        </linearGradient>
        <linearGradient id={`pin-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4dd8a" />
          <stop offset="0.5" stopColor="#d9b24a" />
          <stop offset="1" stopColor="#a07d2c" />
        </linearGradient>
        <radialGradient id={`glow-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#34d399" stopOpacity="0.85" />
          <stop offset="1" stopColor="#34d399" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`cap-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a4250" />
          <stop offset="1" stopColor="#10151d" />
        </linearGradient>
      </defs>

      <ellipse cx={60} cy={80} rx={46} ry={6} fill="#000" opacity={0.28} />

      <line x1={6} y1={44} x2={18} y2={44} stroke={`url(#pin-${id})`} strokeWidth={4} strokeLinecap="round" />
      <line x1={102} y1={44} x2={114} y2={44} stroke={`url(#pin-${id})`} strokeWidth={4} strokeLinecap="round" />

      <rect x={18} y={22} width={84} height={44} rx={4} fill={`url(#pcb-${id})`} stroke="#0a3a22" strokeWidth={1.2} />
      <rect x={18} y={22} width={84} height={5} rx={4} fill="#ffffff" opacity={0.12} />

      <rect x={14} y={29} width={20} height={30} rx={3} fill={`url(#shell-${id})`} stroke="#6b727c" strokeWidth={1} />
      <rect x={16} y={33} width={11} height={22} rx={2} fill="#2a2f37" />
      <rect x={18} y={37} width={7} height={14} rx={1.5} fill="#11151b" />
      <rect x={19} y={39} width={5} height={3} fill="#5a6068" />
      <rect x={19} y={45} width={5} height={3} fill="#5a6068" />
      <rect x={14} y={31} width={20} height={3} fill="#ffffff" opacity={0.25} />

      <rect x={42} y={31} width={9} height={9} rx={1.5} fill={`url(#cap-${id})`} stroke="#000" strokeWidth={0.4} />
      <rect x={43} y={32} width={7} height={2} fill="#ffffff" opacity={0.18} />
      <rect x={54} y={32} width={7} height={7} rx={1} fill="#0c1016" />
      <circle cx={57.5} cy={35.5} r={2} fill="#1c222b" />

      <rect x={43} y={48} width={3} height={10} rx={1} fill="#0c1016" />
      <rect x={48} y={48} width={3} height={10} rx={1} fill="#0c1016" />
      <rect x={43.4} y={49} width={2.2} height={3} fill={`url(#pin-${id})`} />
      <rect x={48.4} y={49} width={2.2} height={3} fill={`url(#pin-${id})`} />
      <rect x={42} y={59} width={9} height={4} rx={1} fill="#1a1f27" />

      <circle cx={67} cy={54} r={3.4} fill="#0c1016" />
      <circle cx={75} cy={54} r={3.4} fill="#0c1016" />
      <circle cx={67} cy={54} r={1.7} fill={`url(#pin-${id})`} />
      <circle cx={75} cy={54} r={1.7} fill={`url(#pin-${id})`} />
      <rect x={62.5} y={50} width={4} height={2} rx={0.5} fill="#cfe3d6" opacity={0.5} />

      {on && <circle cx={88} cy={37} r={11} fill={`url(#glow-${id})`} />}
      <circle cx={88} cy={37} r={4.4} fill={on ? "#34d399" : "#243049"} stroke={on ? "#0d8a5e" : "#161d28"} strokeWidth={1} />
      <circle cx={86.6} cy={35.6} r={1.4} fill="#ffffff" opacity={on ? 0.9 : 0.18} />

      <rect x={84} y={50} width={14} height={10} rx={1.5} fill="#101a13" stroke="#0a3a22" strokeWidth={0.6} />
      <rect x={86} y={52} width={10} height={1.4} fill="#2f6b48" opacity={0.7} />
      <rect x={86} y={55} width={10} height={1.4} fill="#2f6b48" opacity={0.7} />
    </g>
  );
}

function Mpu6050({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  const ledFill = on ? "#34d399" : "#243049";
  return (
    <g>
      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a3fb0" />
          <stop offset="0.5" stopColor="#5e2a92" />
          <stop offset="1" stopColor="#46206e" />
        </linearGradient>
        <linearGradient id={`chip-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3f47" />
          <stop offset="0.5" stopColor="#1d2125" />
          <stop offset="1" stopColor="#0c0e10" />
        </linearGradient>
        <linearGradient id={`hdr-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2a2e" />
          <stop offset="1" stopColor="#101012" />
        </linearGradient>
        <radialGradient id={`pinm-${id}`} cx="0.5" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#ffe9a8" />
          <stop offset="0.5" stopColor="#e6c25e" />
          <stop offset="1" stopColor="#a8801f" />
        </radialGradient>
        <radialGradient id={`glow-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#34d399" stopOpacity="0.85" />
          <stop offset="1" stopColor="#34d399" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx={60} cy={80} rx={42} ry={5} fill="#000" opacity={0.28} />

      <line x1={6} y1={44} x2={20} y2={44} stroke={`url(#pinm-${id})`} strokeWidth={4} strokeLinecap="round" />
      <line x1={100} y1={44} x2={114} y2={44} stroke={`url(#pinm-${id})`} strokeWidth={4} strokeLinecap="round" />

      <rect x={20} y={16} width={80} height={56} rx={4} fill={`url(#pcb-${id})`} stroke="#34174f" strokeWidth={1} />
      <rect x={20} y={16} width={80} height={4} rx={2} fill="#fff" opacity={0.12} />

      {[
        [27, 23], [93, 23], [27, 65], [93, 65],
      ].map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r={4} fill="#d8b86a" stroke="#a8801f" strokeWidth={0.8} />
          <circle cx={p[0]} cy={p[1]} r={1.8} fill="#2b1640" />
        </g>
      ))}

      <rect x={48} y={32} width={24} height={24} rx={1.5} fill={`url(#chip-${id})`} stroke="#000" strokeWidth={0.6} />
      <rect x={48.6} y={32.6} width={22.8} height={4} fill="#fff" opacity={0.08} />
      <circle cx={51.5} cy={52.5} r={1.4} fill="#c9cdd2" opacity={0.8} />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={`l${i}`}>
          <rect x={48 - 2.5} y={34.5 + i * 4} width={2.5} height={1.6} fill="#b8b8b8" />
          <rect x={72} y={34.5 + i * 4} width={2.5} height={1.6} fill="#b8b8b8" />
        </g>
      ))}

      <rect x={30} y={66.5} width={44} height={5} rx={1} fill={`url(#hdr-${id})`} />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={`p${i}`} x={31.5 + i * 5.4} y={67.5} width={2.6} height={3} rx={0.6} fill={`url(#pinm-${id})`} stroke="#8a6a18" strokeWidth={0.4} />
      ))}

      <text x={60} y={28} fontSize={5} fontFamily="monospace" fill="#f0e6ff" textAnchor="middle" opacity={0.85}>GY-521</text>

      <circle cx={84} cy={48} r={6.5} fill={`url(#glow-${id})`} opacity={on ? 1 : 0} />
      <circle cx={84} cy={48} r={2.6} fill={ledFill} stroke="#0d1822" strokeWidth={0.7} />
      <circle cx={83.2} cy={47.2} r={0.9} fill="#eafff5" opacity={on ? 0.9 : 0.2} />
    </g>
  );
}

function Ds3231Rtc({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  return (
    <g>
      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f6fd6" />
          <stop offset="0.5" stopColor="#1f55b0" />
          <stop offset="1" stopColor="#163f86" />
        </linearGradient>
        <radialGradient id={`coin-${id}`} cx="0.38" cy="0.32" r="0.85">
          <stop offset="0" stopColor="#fbfdff" />
          <stop offset="0.45" stopColor="#d4dae0" />
          <stop offset="0.8" stopColor="#9aa3ac" />
          <stop offset="1" stopColor="#6f767d" />
        </radialGradient>
        <radialGradient id={`coinr-${id}`} cx="0.4" cy="0.35" r="0.9">
          <stop offset="0" stopColor="#cfd6dd" />
          <stop offset="0.7" stopColor="#aab1b9" />
          <stop offset="1" stopColor="#7b828a" />
        </radialGradient>
        <linearGradient id={`chip-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3f47" />
          <stop offset="0.5" stopColor="#22262c" />
          <stop offset="1" stopColor="#15181c" />
        </linearGradient>
        <linearGradient id={`pin-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3d987" />
          <stop offset="0.5" stopColor="#d9b24a" />
          <stop offset="1" stopColor="#a07e2c" />
        </linearGradient>
      </defs>

      <ellipse cx={60} cy={80} rx={48} ry={6} fill="#000" opacity={0.28} />

      <line x1={6} y1={44} x2={16} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={104} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />

      <rect x={16} y={16} width={88} height={56} rx={4} fill={`url(#pcb-${id})`} stroke="#0f2d63" strokeWidth={1.2} />
      <rect x={16} y={16} width={88} height={4} rx={3} fill="#ffffff" opacity={0.12} />

      <circle cx={23} cy={23} r={2.6} fill="#0e2148" />
      <circle cx={97} cy={23} r={2.6} fill="#0e2148" />
      <circle cx={23} cy={65} r={2.6} fill="#0e2148" />
      <circle cx={97} cy={65} r={2.6} fill="#0e2148" />

      <g>
        <ellipse cx={56} cy={44} rx={26} ry={23} fill="#5a6068" opacity={0.5} />
        <path d="M30 44 a26 23 0 0 1 52 0 l0 4 a26 23 0 0 1 -52 0 z" fill="#74797f" />
        <ellipse cx={56} cy={43} rx={26} ry={23} fill={`url(#coinr-${id})`} stroke="#5b6168" strokeWidth={1} />
        <ellipse cx={56} cy={43} rx={20} ry={17} fill={`url(#coin-${id})`} stroke="#888f96" strokeWidth={0.8} />
        <ellipse cx={56} cy={43} rx={13} ry={11} fill="none" stroke="#aeb5bc" strokeWidth={0.7} opacity={0.7} />
        <text x={56} y={41} fontSize={5.2} fill="#5c636a" textAnchor="middle" fontFamily="Arial" fontWeight="bold">CR2032</text>
        <text x={56} y={48} fontSize={3.4} fill="#7a818a" textAnchor="middle" fontFamily="Arial">3V</text>
        <ellipse cx={49} cy={36} rx={7} ry={4} fill="#ffffff" opacity={0.4} />
      </g>

      <g>
        <rect x={80} y={26} width={18} height={18} rx={1.5} fill={`url(#chip-${id})`} stroke="#0a0c0e" strokeWidth={0.6} />
        <circle cx={83} cy={29} r={1} fill="#4a5058" />
        <rect x={82} y={31} width={14} height={1} fill="#52585f" opacity={0.6} />
        <rect x={82} y={34} width={14} height={1} fill="#52585f" opacity={0.6} />
        <rect x={82} y={37} width={14} height={1} fill="#52585f" opacity={0.6} />
        {[27, 31, 35, 39].map((yy) => (
          <rect key={`l${yy}`} x={78} y={yy} width={2.5} height={1.2} fill="#c9ccd0" />
        ))}
        {[27, 31, 35, 39].map((yy) => (
          <rect key={`r${yy}`} x={97.5} y={yy} width={2.5} height={1.2} fill="#c9ccd0" />
        ))}
      </g>

      <rect x={20} y={62} width={42} height={8} rx={1.5} fill="#1a1c1e" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={`pin${i}`}>
          <rect x={23 + i * 6.5} y={63.5} width={3} height={5} rx={0.6} fill={`url(#pin-${id})`} stroke="#8a6e25" strokeWidth={0.3} />
        </g>
      ))}

      <circle cx={26} cy={28} r={5.2} fill={on ? "#34d399" : "#243049"} opacity={on ? 0.35 : 0} />
      <circle cx={26} cy={28} r={2.6} fill={on ? "#34d399" : "#243049"} stroke={on ? "#10b981" : "#1a2230"} strokeWidth={0.6} />
      {on && <circle cx={25} cy={27} r={1} fill="#d6fff0" opacity={0.9} />}
    </g>
  );
}

function HallSensor({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  return (
    <g>
      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f74c9" />
          <stop offset="0.5" stopColor="#1c5aa8" />
          <stop offset="1" stopColor="#134582" />
        </linearGradient>
        <linearGradient id={`pcbtop-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5b9be0" stopOpacity="0.7" />
          <stop offset="1" stopColor="#5b9be0" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`chip-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3a40" />
          <stop offset="0.45" stopColor="#1c1c20" />
          <stop offset="1" stopColor="#0c0c0e" />
        </linearGradient>
        <radialGradient id={`pot-${id}`} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#2a6fd0" />
          <stop offset="1" stopColor="#0e3a78" />
        </radialGradient>
        <linearGradient id={`pin-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4d988" />
          <stop offset="0.5" stopColor="#d9b24a" />
          <stop offset="1" stopColor="#a8821f" />
        </linearGradient>
        <radialGradient id={`led-${id}`} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor={on ? "#9cf7c9" : "#3a4760"} />
          <stop offset="0.6" stopColor={on ? "#34d399" : "#243049"} />
          <stop offset="1" stopColor={on ? "#0f9d63" : "#161f30"} />
        </radialGradient>
      </defs>
      <ellipse cx={60} cy={80} rx={46} ry={6} fill="#000" opacity={0.28} />
      <line x1={6} y1={44} x2={20} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={100} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <rect x={20} y={20} width={80} height={48} rx={4} fill={`url(#pcb-${id})`} stroke="#0c3262" strokeWidth={1} />
      <rect x={20} y={20} width={80} height={16} rx={4} fill={`url(#pcbtop-${id})`} />
      <circle cx={26} cy={26} r={2.4} fill="#0c2a52" />
      <circle cx={94} cy={26} r={2.4} fill="#0c2a52" />
      <circle cx={26} cy={62} r={2.4} fill="#0c2a52" />
      <circle cx={94} cy={62} r={2.4} fill="#0c2a52" />
      <g>
        <line x1={36} y1={62} x2={36} y2={70} stroke="#c8c8cc" strokeWidth={1.4} />
        <line x1={40} y1={62} x2={40} y2={70} stroke="#c8c8cc" strokeWidth={1.4} />
        <line x1={44} y1={62} x2={44} y2={70} stroke="#c8c8cc" strokeWidth={1.4} />
        <path d="M32 62 h16 v-7 a8 8 0 0 0 -16 0 z" fill={`url(#chip-${id})`} stroke="#000" strokeWidth={0.6} />
        <path d="M33 50 a7 7 0 0 1 14 0 z" fill="#4a4a52" opacity={0.55} />
        <rect x={32} y={59} width={16} height={3} fill="#2a2a30" />
      </g>
      <g>
        <circle cx={74} cy={50} r={9} fill={`url(#pot-${id})`} stroke="#0a2c5a" strokeWidth={1} />
        <circle cx={74} cy={50} r={5.5} fill="#e9e3d2" stroke="#b8b09a" strokeWidth={0.8} />
        <rect x={72.5} y={45} width={3} height={10} rx={1} fill="#7a3010" transform="rotate(28 74 50)" />
        <circle cx={74} cy={50} r={1.2} fill="#5a2208" />
      </g>
      <g>
        <circle cx={52} cy={31} r={5.5} fill={on ? "#34d399" : "#243049"} opacity={on ? 0.32 : 0} />
        <circle cx={52} cy={31} r={3.4} fill={`url(#led-${id})`} stroke={on ? "#0f9d63" : "#11192a"} strokeWidth={0.7} />
        <circle cx={51} cy={30} r={1} fill="#ffffff" opacity={on ? 0.85 : 0.25} />
      </g>
      <g>
        <rect x={83} y={28} width={11} height={22} rx={1.5} fill="#15161a" stroke="#000" strokeWidth={0.5} />
        <rect x={86} y={24} width={2} height={6} fill={`url(#pin-${id})`} />
        <rect x={89.5} y={24} width={2} height={6} fill={`url(#pin-${id})`} />
        <rect x={86} y={31} width={2} height={5} fill={`url(#pin-${id})`} />
        <rect x={89.5} y={31} width={2} height={5} fill={`url(#pin-${id})`} />
      </g>
      <rect x={20} y={20} width={80} height={48} rx={4} fill="none" stroke="#8fc0ef" strokeWidth={0.5} opacity={0.35} />
    </g>
  );
}

function ColorSensor({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  const ledOn = on ? "#ffffff" : "#cfd6dd";
  const ledGlow = on ? 0.9 : 0;
  const corners = [
    { x: 42, y: 30 },
    { x: 78, y: 30 },
    { x: 42, y: 58 },
    { x: 78, y: 58 },
  ];
  return (
    <g>
      <defs>
        <radialGradient id={`pcb-${id}`} cx="42%" cy="34%" r="80%">
          <stop offset="0%" stopColor="#2a3138" />
          <stop offset="60%" stopColor="#161b20" />
          <stop offset="100%" stopColor="#0c0f12" />
        </radialGradient>
        <radialGradient id={`chip-${id}`} cx="42%" cy="34%" r="75%">
          <stop offset="0%" stopColor="#3a3f46" />
          <stop offset="70%" stopColor="#181b1f" />
          <stop offset="100%" stopColor="#05070a" />
        </radialGradient>
        <radialGradient id={`lens-${id}`} cx="40%" cy="34%" r="70%">
          <stop offset="0%" stopColor="#cfe6ff" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#5b86a8" />
          <stop offset="100%" stopColor="#10222e" />
        </radialGradient>
        <radialGradient id={`led-${id}`} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor={ledOn} />
          <stop offset="55%" stopColor={on ? "#f1f4f7" : "#aeb6bd"} />
          <stop offset="100%" stopColor="#7c858c" />
        </radialGradient>
        <linearGradient id={`pin-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f6e29a" />
          <stop offset="50%" stopColor="#d9b24a" />
          <stop offset="100%" stopColor="#9c7c2c" />
        </linearGradient>
      </defs>

      <ellipse cx={60} cy={80} rx={44} ry={6} fill="#000" opacity={0.3} />

      <line x1={6} y1={44} x2={16} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={104} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />

      <rect x={16} y={16} width={88} height={56} rx={5} fill={`url(#pcb-${id})`} stroke="#04060a" strokeWidth={1.2} />
      <rect x={16} y={16} width={88} height={20} rx={5} fill="#ffffff" opacity={0.05} />

      <circle cx={23} cy={23} r={2.4} fill="#070a0d" stroke="#3a4148" strokeWidth={0.8} />
      <circle cx={97} cy={23} r={2.4} fill="#070a0d" stroke="#3a4148" strokeWidth={0.8} />
      <circle cx={23} cy={65} r={2.4} fill="#070a0d" stroke="#3a4148" strokeWidth={0.8} />
      <circle cx={97} cy={65} r={2.4} fill="#070a0d" stroke="#3a4148" strokeWidth={0.8} />

      <rect x={30} y={22} width={60} height={44} rx={4} fill={`url(#chip-${id})`} stroke="#000" strokeWidth={0.8} />
      <rect x={30} y={22} width={60} height={12} rx={4} fill="#ffffff" opacity={0.06} />

      {corners.map((c, i) => (
        <g key={`led-${i}`}>
          {ledGlow > 0 && <circle cx={c.x} cy={c.y} r={9} fill="#ffffff" opacity={ledGlow * 0.35} />}
          <rect x={c.x - 5} y={c.y - 5} width={10} height={10} rx={1.6} fill="#e7ebef" stroke="#9aa2a8" strokeWidth={0.7} />
          <circle cx={c.x} cy={c.y} r={3.6} fill={`url(#led-${id})`} stroke="#aab1b7" strokeWidth={0.6} />
          <circle cx={c.x - 1} cy={c.y - 1.1} r={1.1} fill="#ffffff" opacity={0.9} />
        </g>
      ))}

      <circle cx={60} cy={44} r={8.5} fill="#0a0d10" stroke="#2c3238" strokeWidth={1} />
      <circle cx={60} cy={44} r={6} fill={`url(#lens-${id})`} stroke="#1a2730" strokeWidth={0.7} />
      <circle cx={57.6} cy={41.6} r={1.6} fill="#ffffff" opacity={0.75} />

      <g>
        <circle cx={26} cy={48} r={2.4} fill="#9aa2a8" opacity={0.5} />
        <circle cx={26} cy={48} r={1.1} fill="#5a6168" />
      </g>

      {on && <circle cx={94} cy={48} r={6} fill="#34d399" opacity={0.35} />}
      <circle cx={94} cy={48} r={2.4} fill={on ? "#34d399" : "#243049"} stroke="#0c1118" strokeWidth={0.6} />
      {on && <circle cx={93.2} cy={47.2} r={0.9} fill="#d6ffe9" />}

      {[40, 47, 54, 61, 68, 75].map((px) => (
        <g key={`pin-${px}`}>
          <rect x={px - 1.6} y={70} width={3.2} height={6} rx={0.8} fill={`url(#pin-${id})`} stroke="#7a5e1f" strokeWidth={0.4} />
        </g>
      ))}
    </g>
  );
}

function CurrentSensor({ comp, state, running }: PartArtProps) {
  const id = comp.id;
  const on = running && state.on;
  return (
    <g>
      <ellipse cx={60} cy={80} rx={46} ry={6} fill="#000" opacity={0.28} />

      <defs>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f6fb0" />
          <stop offset="0.5" stopColor="#1d5494" />
          <stop offset="1" stopColor="#143e73" />
        </linearGradient>
        <linearGradient id={`chip-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3a40" />
          <stop offset="0.5" stopColor="#1c1c20" />
          <stop offset="1" stopColor="#0c0c0e" />
        </linearGradient>
        <linearGradient id={`screw-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3fbf6a" />
          <stop offset="0.55" stopColor="#1f9f4c" />
          <stop offset="1" stopColor="#127a37" />
        </linearGradient>
        <radialGradient id={`metal-${id}`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#f3e7b0" />
          <stop offset="0.5" stopColor="#d9b24a" />
          <stop offset="1" stopColor="#9c7d2c" />
        </radialGradient>
        <radialGradient id={`led-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#bff7d8" />
          <stop offset="0.5" stopColor="#34d399" />
          <stop offset="1" stopColor="#0f7a4d" />
        </radialGradient>
      </defs>

      {/* leads: left is the screw-terminal power side (thick gold), right is header pins */}
      <line x1={6} y1={44} x2={18} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />
      <line x1={102} y1={44} x2={114} y2={44} stroke="#d9b24a" strokeWidth={4} strokeLinecap="round" />

      {/* PCB board */}
      <rect x={18} y={16} width={84} height={56} rx={4} fill={`url(#pcb-${id})`} stroke="#0d2f5a" strokeWidth={1} />
      <rect x={18} y={16} width={84} height={4} rx={2} fill="#fff" opacity={0.12} />
      {/* mounting holes */}
      <circle cx={24} cy={66} r={2.4} fill="#0c2950" stroke="#c9cdd4" strokeWidth={0.8} />
      <circle cx={96} cy={66} r={2.4} fill="#0c2950" stroke="#c9cdd4" strokeWidth={0.8} />

      {/* green 2-terminal screw block on left edge */}
      <rect x={18} y={22} width={20} height={40} rx={2} fill={`url(#screw-${id})`} stroke="#0c5a28" strokeWidth={1} />
      <rect x={18} y={22} width={20} height={3} rx={1.5} fill="#fff" opacity={0.18} />
      <circle cx={28} cy={33} r={5.5} fill={`url(#metal-${id})`} stroke="#7a611f" strokeWidth={0.8} />
      <path d="M25 33 h6 M28 30 v6" stroke="#5c4815" strokeWidth={1.2} strokeLinecap="round" />
      <circle cx={28} cy={51} r={5.5} fill={`url(#metal-${id})`} stroke="#7a611f" strokeWidth={0.8} />
      <path d="M25 51 h6 M28 48 v6" stroke="#5c4815" strokeWidth={1.2} strokeLinecap="round" />

      {/* black ACS712 chip in middle (SOIC) */}
      <rect x={50} y={32} width={26} height={22} rx={2} fill={`url(#chip-${id})`} stroke="#000" strokeWidth={0.8} />
      <circle cx={54} cy={36} r={1.4} fill="#54545c" />
      <rect x={56} y={40} width={14} height={1.3} fill="#5a5a62" opacity={0.7} />
      <rect x={56} y={43} width={14} height={1.3} fill="#5a5a62" opacity={0.7} />
      <rect x={56} y={46} width={10} height={1.3} fill="#5a5a62" opacity={0.7} />
      {/* chip pins */}
      {[0, 1, 2, 3].map((i) => (
        <g key={`pl-${i}`}>
          <rect x={46} y={34 + i * 5} width={4} height={2.2} rx={0.6} fill="#cfd3d8" />
          <rect x={76} y={34 + i * 5} width={4} height={2.2} rx={0.6} fill="#cfd3d8" />
        </g>
      ))}

      {/* 3-pin header on right edge */}
      <rect x={84} y={28} width={10} height={28} rx={1.5} fill="#15151a" stroke="#000" strokeWidth={0.6} />
      {[0, 1, 2].map((i) => (
        <rect key={`hp-${i}`} x={88} y={31 + i * 8} width={2.4} height={2.4} rx={0.4} fill={`url(#metal-${id})`} stroke="#7a611f" strokeWidth={0.4} />
      ))}

      {/* small SMD caps */}
      <rect x={50} y={60} width={6} height={4} rx={0.8} fill="#caa46a" stroke="#7a5e2c" strokeWidth={0.4} />
      <rect x={62} y={60} width={6} height={4} rx={0.8} fill="#caa46a" stroke="#7a5e2c" strokeWidth={0.4} />

      {/* power LED */}
      {on && <circle cx={42} cy={64} r={8} fill="#34d399" opacity={0.35} />}
      <circle cx={42} cy={64} r={3} fill={on ? `url(#led-${id})` : "#243049"} stroke={on ? "#0f7a4d" : "#101826"} strokeWidth={0.8} />
      {on && <circle cx={41} cy={63} r={1} fill="#eafff4" opacity={0.85} />}
    </g>
  );
}

export const PART_ART: Partial<Record<PartType, (p: PartArtProps) => ReactNode>> = {
  arduino: ArduinoUno,
  curious: CuriousBoard,
  ultrasonic: Ultrasonic,
  pir: PirSensor,
  ir: IrSensor,
  soil: SoilSensor,
  ldr: Ldr,
  dht: Dht11,
  temp: Lm35,
  water: WaterSensor,
  gas: GasSensor,
  flame: FlameSensor,
  touch: TouchSensor,
  tilt: TiltSensor,
  rain: RainSensor,
  mic: SoundSensor,
  relay: RelayModule,
  servo: ServoMotor,
  lamp: Lamp,
  fan: Fan,
  rgb: RgbLed,
  nano: ArduinoNano,
  mega: ArduinoMega,
  esp32: Esp32,
  esp8266: Esp8266,
  pico: RpiPico,
  oled: OledDisplay,
  lcd1602: Lcd1602,
  sevenseg: SevenSegment,
  matrix: LedMatrix,
  neopixel: NeoPixelRing,
  stepper: StepperMotor,
  l298n: L298nDriver,
  pump: WaterPump,
  vibration: VibrationMotor,
  bluetooth: BluetoothHc05,
  nrf24: Nrf24,
  rfid: Rc522Rfid,
  irrecv: IrReceiver,
  joystick: JoystickModule,
  keypad: MembraneKeypad,
  encoder: RotaryEncoder,
  solar: SolarPanel,
  buck: BuckConverter,
  usbpower: UsbPower,
  mpu6050: Mpu6050,
  rtc: Ds3231Rtc,
  hall: HallSensor,
  color: ColorSensor,
  current: CurrentSensor,
};
