"use client";

import Link from "next/link";

/**
 * "Your creative areas" — the homepage slide that showcases the four hands-on
 * platforms as living PORTALS: each card runs a real animated mini-demo of its
 * tool, then opens straight into it. Pure CSS/SVG, deterministic, no deps.
 * 3D is not built yet → a coming-soon portal.
 */
interface Platform {
  id: "coding" | "robotics" | "ai" | "threed";
  name: string;
  emoji: string;
  subject: string;
  tagline: string;
  href: string | null;
  accent: string;
}

const PLATFORMS: Platform[] = [
  { id: "coding", name: "Studio", emoji: "🎮", subject: "CODING", tagline: "Snap blocks to build games & animations.", href: "/scratch", accent: "#22d3ee" },
  { id: "robotics", name: "Maker Lab", emoji: "🔧", subject: "ROBOTICS", tagline: "Wire a circuit and program the chip.", href: "/maker", accent: "#34d399" },
  { id: "ai", name: "Neural Lab", emoji: "⚡", subject: "AI", tagline: "Train your own AI — 10 experiments.", href: "/neural", accent: "#a855f7" },
  { id: "threed", name: "3D Studio", emoji: "🧊", subject: "3D MODELLING", tagline: "Shape space and build worlds in 3D.", href: null, accent: "#f59e0b" },
];

export default function MakerspaceStats() {
  return (
    <section id="stats">
      <div className="mb-8 text-center">
        <div className="section-label reveal">Your creative areas</div>
        <h2 className="section-title reveal">Step into a makerspace</h2>
        <p className="section-sub reveal mx-auto mt-3 max-w-xl">
          Each area is a living studio — tap a portal and start building. No installs, grades 1–10.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLATFORMS.map((p) => {
          const soon = p.href === null;
          const inner = (
            <>
              {/* live demo portal */}
              <div
                className="portal-stage relative h-28 overflow-hidden rounded-xl border"
                style={{ borderColor: `${p.accent}33`, background: `radial-gradient(circle at 50% 65%, ${p.accent}1f, transparent 72%), #0a0f1c` }}
              >
                <div className="absolute inset-0 grid place-items-center" style={{ color: p.accent }}>
                  <PortalDemo id={p.id} accent={p.accent} />
                </div>
              </div>
              {/* meta */}
              <div className="mt-3 flex items-center gap-2">
                <span aria-hidden style={{ fontSize: 18 }}>{p.emoji}</span>
                <span className="font-mono text-[10px] tracking-tech" style={{ color: p.accent }}>{p.subject}</span>
              </div>
              <h3 className="mt-1 font-display text-lg font-bold text-ink">{p.name}</h3>
              <p className="mt-0.5 flex-1 text-xs text-ink-dim">{p.tagline}</p>
              <div className="mt-2 font-mono text-[11px] font-semibold tracking-tech" style={{ color: p.accent }}>
                {soon ? "🔒 LAUNCHING SOON" : (
                  <span className="inline-flex items-center gap-1">
                    OPEN <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                  </span>
                )}
              </div>
            </>
          );
          const cls = "panel group relative flex min-h-[260px] flex-col p-4";
          return soon ? (
            <div key={p.id} className={cls} style={{ opacity: 0.7 }} aria-disabled="true" aria-label={`${p.name} — coming soon`}>{inner}</div>
          ) : (
            <Link key={p.id} href={p.href!} className={`${cls} transition-transform hover:-translate-y-0.5`} aria-label={`Open ${p.name}`}>{inner}</Link>
          );
        })}
      </div>

      <style>{`
        @keyframes mkBlk { 0%,100%{ opacity:.5 } 30%{ opacity:1; filter:brightness(1.5) } }
        @keyframes mkLed { 0%,100%{ opacity:.4 } 50%{ opacity:1 } }
        @keyframes mkNode { 0%,100%{ opacity:.4 } 40%{ opacity:1 } }
        @keyframes mkEdge { 0%,100%{ opacity:.18 } 45%{ opacity:.85 } }
        @keyframes mkSpin { from{ transform:rotateX(-24deg) rotateY(0) } to{ transform:rotateX(-24deg) rotateY(360deg) } }
        .mk-cube-scene { perspective: 260px; }
        .mk-cube { position: relative; width: 54px; height: 54px; transform-style: preserve-3d; animation: mkSpin 9s linear infinite; }
        .mk-face { position:absolute; width:54px; height:54px; border-width:1.5px; border-style:solid; }
      `}</style>
    </section>
  );
}

function PortalDemo({ id, accent }: { id: Platform["id"]; accent: string }) {
  if (id === "coding") return <CodingDemo accent={accent} />;
  if (id === "robotics") return <CircuitDemo accent={accent} />;
  if (id === "ai") return <NeuralDemo accent={accent} />;
  return <CubeDemo accent={accent} />;
}

/** Scratch-style blocks with a run-highlight flowing down the stack. */
function CodingDemo({ accent }: { accent: string }) {
  const blocks = [
    { c: "#FFBF00", w: 58 }, { c: "#4C97FF", w: 66 }, { c: "#9966FF", w: 52 }, { c: accent, w: 62 },
  ];
  return (
    <svg viewBox="0 0 100 74" className="h-[88px] w-auto">
      {blocks.map((b, i) => (
        <rect key={i} x={18} y={6 + i * 16} width={b.w} height={12} rx={3} fill={b.c} style={{ animation: "mkBlk 2s ease-in-out infinite", animationDelay: `${i * 0.45}s` }} />
      ))}
    </svg>
  );
}

/** A circuit loop with a current dot flowing into a pulsing LED. */
function CircuitDemo({ accent }: { accent: string }) {
  return (
    <svg viewBox="0 0 100 70" className="h-[84px] w-auto">
      <path d="M22 16 H78 V54 H22 Z" fill="none" stroke={accent} strokeWidth="2" opacity="0.45" />
      {/* battery */}
      <rect x="18" y="29" width="8" height="12" rx="1" fill={accent} />
      <line x1="22" y1="26" x2="22" y2="31" stroke="#0a0f1c" strokeWidth="1.4" />
      {/* LED */}
      <circle cx="78" cy="16" r="4.5" fill={accent} style={{ animation: "mkLed 1.4s ease-in-out infinite", filter: `drop-shadow(0 0 5px ${accent})` }} />
      {/* travelling current */}
      <circle r="2.6" fill="#fff">
        <animateMotion dur="2.4s" repeatCount="indefinite" path="M22 16 H78 V54 H22 Z" />
      </circle>
    </svg>
  );
}

/** A 3-layer neural net firing left → right in waves. */
function NeuralDemo({ accent }: { accent: string }) {
  const L = [
    [{ x: 20, y: 22 }, { x: 20, y: 48 }],
    [{ x: 50, y: 14 }, { x: 50, y: 35 }, { x: 50, y: 56 }],
    [{ x: 80, y: 22 }, { x: 80, y: 48 }],
  ];
  const edges: { a: { x: number; y: number }; b: { x: number; y: number }; d: number }[] = [];
  for (let i = 0; i < L.length - 1; i++) for (const a of L[i]) for (const b of L[i + 1]) edges.push({ a, b, d: i });
  return (
    <svg viewBox="0 0 100 70" className="h-[84px] w-auto">
      {edges.map((e, i) => (
        <line key={i} x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y} stroke={accent} strokeWidth="1" style={{ animation: "mkEdge 1.8s ease-in-out infinite", animationDelay: `${e.d * 0.35}s` }} />
      ))}
      {L.map((layer, li) => layer.map((n, ni) => (
        <circle key={`${li}-${ni}`} cx={n.x} cy={n.y} r="4" fill={accent} style={{ animation: "mkNode 1.8s ease-in-out infinite", animationDelay: `${li * 0.35}s` }} />
      )))}
    </svg>
  );
}

/** A spinning wireframe cube (CSS 3D). */
function CubeDemo({ accent }: { accent: string }) {
  const faceStyle = (transform: string): React.CSSProperties => ({ transform, borderColor: accent, background: `${accent}12` });
  return (
    <div className="mk-cube-scene grid h-[88px] place-items-center">
      <div className="mk-cube">
        <span className="mk-face" style={faceStyle("translateZ(27px)")} />
        <span className="mk-face" style={faceStyle("rotateY(180deg) translateZ(27px)")} />
        <span className="mk-face" style={faceStyle("rotateY(90deg) translateZ(27px)")} />
        <span className="mk-face" style={faceStyle("rotateY(-90deg) translateZ(27px)")} />
        <span className="mk-face" style={faceStyle("rotateX(90deg) translateZ(27px)")} />
        <span className="mk-face" style={faceStyle("rotateX(-90deg) translateZ(27px)")} />
      </div>
    </div>
  );
}
