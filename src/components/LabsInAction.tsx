"use client";

import { useEffect, useState } from "react";

type Lab = {
  title: string;
  subject: string;
  emoji: string;
  accent: string;
};

const LABS: Lab[] = [
  { title: "Robot Runner", subject: "Coding", emoji: "🤖", accent: "#22d3ee" },
  { title: "Light the LED", subject: "Robotics", emoji: "💡", accent: "#34d399" },
  { title: "Train the Sorter", subject: "AI", emoji: "🍎", accent: "#a855f7" },
  { title: "Voxel Builder", subject: "3D Modelling", emoji: "🧱", accent: "#f59e0b" },
];

export default function LabsInAction() {
  const [active, setActive] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      setActive((i) => (i + 1) % LABS.length);
    }, 2800);
    return () => clearInterval(id);
  }, [reduced]);

  const lab = LABS[active];

  return (
    <section id="reel">
      <div className="mb-8 text-center">
        <div className="section-label reveal">See it run</div>
        <h2 className="section-title reveal">Labs in action</h2>
        <p className="section-sub reveal mx-auto mt-3 max-w-xl">
          Real experiments, running live — here&apos;s a peek at what students build.
        </p>
      </div>

      <div
        className="panel reveal relative mx-auto aspect-video max-w-3xl overflow-hidden"
        style={{
          background: `radial-gradient(circle at 30% 20%, ${lab.accent}22, transparent 60%)`,
          transition: "background 600ms ease",
        }}
      >
        <div className="absolute left-4 top-4 flex gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: "#ff5f56" }} />
          <span className="h-3 w-3 rounded-full" style={{ background: "#ffbd2e" }} />
          <span className="h-3 w-3 rounded-full" style={{ background: "#27c93f" }} />
        </div>

        {LABS.map((l, i) => (
          <div
            key={l.title}
            aria-hidden={i !== active}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center"
            style={{
              opacity: i === active ? 1 : 0,
              transform: i === active ? "scale(1)" : "scale(0.94)",
              transition: "opacity 600ms ease, transform 600ms ease",
              pointerEvents: i === active ? "auto" : "none",
            }}
          >
            <div
              className="text-7xl"
              style={{
                animation: reduced ? undefined : "labbob 2.4s ease-in-out infinite",
                filter: `drop-shadow(0 0 24px ${l.accent}66)`,
              }}
            >
              {l.emoji}
            </div>
            <div className="font-display text-2xl text-ink">{l.title}</div>
            <div
              className="font-mono text-xs tracking-tech"
              style={{ color: l.accent }}
            >
              {l.subject.toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-center gap-3">
        {LABS.map((l, i) => (
          <button
            key={l.title}
            type="button"
            aria-label={`Show ${l.title}`}
            aria-pressed={i === active}
            onClick={() => setActive(i)}
            className="h-3 w-3 rounded-full transition-transform"
            style={{
              background: i === active ? l.accent : "rgba(255,255,255,0.2)",
              boxShadow: i === active ? `0 0 12px ${l.accent}` : undefined,
              transform: i === active ? "scale(1.3)" : "scale(1)",
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes labbob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </section>
  );
}
