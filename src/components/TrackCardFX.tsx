"use client";

import type { SubjectId } from "@/lib/activities/types";

/**
 * Looping ambient animation behind each home track card — a small, GPU-cheap
 * "live preview" of what the track is about. Sits at low opacity and brightens
 * on hover (group-hover). All transform/opacity only; frozen for reduced-motion.
 */
export function TrackCardFX({ subject, accent }: { subject: SubjectId; accent: string }) {
  switch (subject) {
    case "coding":
      return <CodeRain accent={accent} />;
    case "robotics":
      return <CircuitFlow accent={accent} />;
    case "ai":
      return <NeuralPulse accent={accent} />;
    case "threed":
      return <SpinCube accent={accent} />;
  }
}

// Fade the animation out toward the bottom, where the minimal label sits.
const FADE = "linear-gradient(to top, transparent 4%, #000 40%)";

function CodeRain({ accent }: { accent: string }) {
  const cols = 8;
  const glyphs = "01</>{}=+*#λ;()[]";
  return (
    <div
      className="trackfx pointer-events-none absolute inset-0 overflow-hidden opacity-[0.26] transition-opacity duration-500 group-hover:opacity-[0.5]"
      style={{ maskImage: FADE, WebkitMaskImage: FADE }}
      aria-hidden
    >
      {Array.from({ length: cols }).map((_, i) => {
        const col = Array.from({ length: 16 }).map((_, j) => glyphs[(i * 5 + j * 3) % glyphs.length]).join("\n");
        return (
          <pre
            key={i}
            className="absolute top-0 m-0 whitespace-pre font-mono text-[11px] leading-[1.15]"
            style={{
              left: `${(i / cols) * 100 + 2}%`,
              color: accent,
              animation: `tcrain ${4.5 + (i % 4) * 0.8}s linear ${-(i % 5) * 0.9}s infinite`,
            }}
          >
            {col + "\n" + col}
          </pre>
        );
      })}
      <style>{`@keyframes tcrain{from{transform:translateY(-50%)}to{transform:translateY(0)}}
        @media (prefers-reduced-motion:reduce){.trackfx pre{animation:none!important}}`}</style>
    </div>
  );
}

function CircuitFlow({ accent }: { accent: string }) {
  const paths = ["8,28 28,28 28,52 56,52 56,30 84,30", "4,68 30,68 30,44 64,44 64,72 92,72", "14,90 14,64 46,64 46,86 78,86 78,60 96,60"];
  const nodes: [number, number][] = [[28, 28], [56, 52], [30, 68], [64, 44], [46, 64], [78, 86]];
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.32] transition-opacity duration-500 group-hover:opacity-[0.6]"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ maskImage: FADE, WebkitMaskImage: FADE }}
      aria-hidden
    >
      {paths.map((p, i) => (
        <polyline key={i} points={p} fill="none" stroke={accent} strokeWidth="0.7" strokeDasharray="3 6" style={{ animation: `tcflow ${2.2 + i * 0.6}s linear infinite` }} />
      ))}
      {nodes.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.4" fill={accent} style={{ transformOrigin: `${x}px ${y}px`, animation: `tcnode 2.4s ease-in-out ${i * 0.3}s infinite` }} />
      ))}
      <style>{`@keyframes tcflow{to{stroke-dashoffset:-18}}@keyframes tcnode{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:1;transform:scale(1.5)}}
        @media (prefers-reduced-motion:reduce){polyline,circle{animation:none!important}}`}</style>
    </svg>
  );
}

function NeuralPulse({ accent }: { accent: string }) {
  const xs = [22, 50, 78];
  const ys = [26, 50, 74];
  const nodes = xs.flatMap((x, li) => ys.map((y, ni) => ({ x, y, key: `${li}-${ni}` })));
  const edges: { x1: number; y1: number; x2: number; y2: number; k: string }[] = [];
  for (let l = 0; l < xs.length - 1; l++) for (const a of ys) for (const b of ys) edges.push({ x1: xs[l], y1: a, x2: xs[l + 1], y2: b, k: `${l}-${a}-${b}` });
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.3] transition-opacity duration-500 group-hover:opacity-[0.56]"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ maskImage: FADE, WebkitMaskImage: FADE }}
      aria-hidden
    >
      {edges.map((e, i) => (
        <line key={e.k} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={accent} strokeWidth="0.25" style={{ animation: `tnedge 3s ease-in-out ${(i % 7) * 0.25}s infinite` }} />
      ))}
      {nodes.map((n, i) => (
        <circle key={n.key} cx={n.x} cy={n.y} r="2" fill={accent} style={{ transformOrigin: `${n.x}px ${n.y}px`, animation: `tnnode 2.6s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
      <style>{`@keyframes tnedge{0%,100%{opacity:.12}50%{opacity:.5}}@keyframes tnnode{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.3)}}
        @media (prefers-reduced-motion:reduce){line,circle{animation:none!important}}`}</style>
    </svg>
  );
}

function SpinCube({ accent }: { accent: string }) {
  const faces = ["translateZ(20px)", "rotateY(180deg) translateZ(20px)", "rotateY(90deg) translateZ(20px)", "rotateY(-90deg) translateZ(20px)", "rotateX(90deg) translateZ(20px)", "rotateX(-90deg) translateZ(20px)"];
  return (
    <div
      className="pointer-events-none absolute inset-0 grid place-items-center opacity-[0.42] transition-opacity duration-500 group-hover:opacity-[0.62]"
      style={{ perspective: "320px", maskImage: FADE, WebkitMaskImage: FADE }}
      aria-hidden
    >
      <div className="tcube" style={{ width: 44, height: 44, position: "relative", transformStyle: "preserve-3d", animation: "tcspin 11s linear infinite" }}>
        {faces.map((t, i) => (
          <span key={i} style={{ position: "absolute", inset: 0, border: `1.5px solid ${accent}`, borderRadius: 4, transform: t, background: `${accent}10` }} />
        ))}
      </div>
      <style>{`@keyframes tcspin{from{transform:rotateX(-22deg) rotateY(0)}to{transform:rotateX(-22deg) rotateY(360deg)}}
        @media (prefers-reduced-motion:reduce){.tcube{animation:none!important}}`}</style>
    </div>
  );
}
