"use client";

import type { CSSProperties } from "react";

const RINGS = [0, 1, 2, 3];
const RAYS = Array.from({ length: 12 }, (_, i) => i);
const SPARKS = Array.from({ length: 14 }, (_, i) => i);

const KEYFRAMES = `
@keyframes sn-pulse {
  0%, 100% { transform: scale(1); filter: brightness(1); }
  50% { transform: scale(1.18); filter: brightness(1.6); }
}
@keyframes sn-ring {
  0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0.9; }
  70% { opacity: 0.35; }
  100% { transform: translate(-50%, -50%) scale(3.4); opacity: 0; }
}
@keyframes sn-ray {
  0%, 100% { opacity: 0.25; transform: rotate(var(--sn-angle)) scaleY(0.85); }
  50% { opacity: 0.9; transform: rotate(var(--sn-angle)) scaleY(1.15); }
}
@keyframes sn-spark {
  0% { transform: translate(-50%, -50%) translate(0, 0) scale(1); opacity: 0; }
  15% { opacity: 1; }
  100% {
    transform: translate(-50%, -50%) translate(var(--sn-dx), var(--sn-dy)) scale(0.2);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .sn-core, .sn-ring, .sn-ray, .sn-spark { animation: none !important; }
  .sn-ring, .sn-spark { opacity: 0; }
}
`;

export default function SupernovaBurst() {
  return (
    <section
      id="supernova"
      className="relative flex min-h-[60vh] flex-col items-center justify-center overflow-hidden text-center"
    >
      <style>{KEYFRAMES}</style>

      {/* Visual */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-0 w-0">
          {/* Shockwave rings */}
          {RINGS.map((i) => (
            <span
              key={`ring-${i}`}
              className="sn-ring absolute left-1/2 top-1/2 h-48 w-48 rounded-full"
              style={{
                border: "1px solid rgba(34, 211, 238, 0.7)",
                boxShadow: "0 0 24px rgba(168, 85, 247, 0.45)",
                animation: "sn-ring 4s ease-out infinite",
                animationDelay: `${i * 1}s`,
              }}
            />
          ))}

          {/* Radiating rays */}
          {RAYS.map((i) => {
            const angle = (360 / RAYS.length) * i;
            return (
              <span
                key={`ray-${i}`}
                className="sn-ray absolute left-1/2 top-1/2 origin-bottom"
                style={
                  {
                    "--sn-angle": `${angle}deg`,
                    width: "2px",
                    height: "180px",
                    marginLeft: "-1px",
                    marginTop: "-180px",
                    background:
                      "linear-gradient(to top, rgba(245, 158, 11, 0.9), rgba(34, 211, 238, 0))",
                    animation: "sn-ray 3.2s ease-in-out infinite",
                    animationDelay: `${(i % 4) * 0.4}s`,
                  } as CSSProperties
                }
              />
            );
          })}

          {/* Spark particles */}
          {SPARKS.map((i) => {
            const angle = (Math.PI * 2 * i) / SPARKS.length;
            const dist = 120 + (i % 5) * 28;
            const dx = Math.cos(angle) * dist;
            const dy = Math.sin(angle) * dist;
            const hue = i % 2 === 0 ? "#34d399" : "#22d3ee";
            return (
              <span
                key={`spark-${i}`}
                className="sn-spark absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
                style={
                  {
                    "--sn-dx": `${dx}px`,
                    "--sn-dy": `${dy}px`,
                    background: hue,
                    boxShadow: `0 0 8px ${hue}`,
                    animation: "sn-spark 2.6s ease-out infinite",
                    animationDelay: `${(i % 7) * 0.35}s`,
                  } as CSSProperties
                }
              />
            );
          })}

          {/* Bright pulsing core */}
          <span
            className="sn-core absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(circle, #ffffff 0%, #22d3ee 28%, #a855f7 58%, rgba(168,85,247,0) 78%)",
              animation: "sn-pulse 3.6s ease-in-out infinite",
            }}
          />
        </div>
      </div>

      {/* Text overlay */}
      <div className="relative z-10 px-6">
        <p
          className="font-mono text-xs tracking-tech"
          style={{ color: "#22d3ee", textShadow: "0 0 12px rgba(34,211,238,0.8)" }}
        >
          ◤ IGNITION SEQUENCE ◢
        </p>
        <h2 className="neon-text font-display text-3xl font-bold text-ink sm:text-5xl">
          Spark something brilliant.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-ink-dim">
          Every great build starts with a single experiment. Light yours.
        </p>
      </div>
    </section>
  );
}
