"use client";

import { useEffect, useState } from "react";

type Badge = {
  emoji: string;
  label: string;
  color: string;
  earned: boolean;
};

const BADGES: Badge[] = [
  { emoji: "🚀", label: "First Launch", color: "#22d3ee", earned: true },
  { emoji: "🔁", label: "Loop Master", color: "#34d399", earned: true },
  { emoji: "🧠", label: "Model Trainer", color: "#a855f7", earned: true },
  { emoji: "🧊", label: "Voxel Pro", color: "#f59e0b", earned: false },
];

export default function AchievementsPreview() {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setWidth(68);
      return;
    }
    const id = window.requestAnimationFrame(() => setWidth(68));
    return () => window.cancelAnimationFrame(id);
  }, []);

  return (
    <section id="rewards">
      <div className="mb-8 text-center">
        <div className="section-label reveal">Level up</div>
        <h2 className="section-title reveal">Earn XP, badges &amp; certificates</h2>
        <p className="section-sub reveal mx-auto mt-3 max-w-xl">
          Every finished lab earns points, unlocks badges, and brings the next
          certificate closer.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* LEFT — XP / level panel */}
        <div className="panel reveal p-7">
          <div className="font-display text-xl text-ink">
            <span aria-hidden="true">🧑‍🚀</span> Level 3 · Innovator
          </div>

          <div className="mt-5 h-2.5 rounded-full bg-line overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${width}%`,
                background: "linear-gradient(90deg,#22d3ee,#a855f7)",
                boxShadow: "0 0 12px rgba(34,211,238,0.6)",
                transition: "width 1s ease-out",
              }}
            />
          </div>
          <p className="mt-2 font-mono text-xs tracking-tech text-ink-faint">
            680 / 1000 XP to Level 4
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {BADGES.map((b) => (
              <span
                key={b.label}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${
                  b.earned ? "" : "opacity-40 grayscale"
                }`}
                style={{
                  border: `1px solid ${b.color}`,
                  color: b.color,
                  background: `${b.color}1a`,
                }}
              >
                <span aria-hidden="true">{b.emoji}</span>
                <span className="font-mono tracking-tech">{b.label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* RIGHT — mock certificate card */}
        <div
          className="panel reveal p-7 text-center"
          style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.35)" }}
        >
          <div className="text-5xl" aria-hidden="true">
            🏅
          </div>
          <h3 className="mt-2 font-display text-lg text-ink neon-text">
            Certificate of Completion
          </h3>
          <p className="mt-1 text-sm text-ink-dim">Coding Track — Grade 1</p>

          <div className="mt-6 flex items-center justify-between gap-4">
            <span
              className="text-lg text-ink"
              style={{ fontFamily: "cursive" }}
            >
              Curious Labs
            </span>
            <span className="font-mono text-[10px] tracking-tech text-ink-dim">
              Powered by Physics Wallah
            </span>
          </div>

          <div
            className="mt-3 h-px"
            style={{
              background:
                "linear-gradient(90deg,transparent,#22d3ee,#a855f7,transparent)",
            }}
          />

          <p className="mt-4 font-mono text-[10px] tracking-tech" style={{ color: "#22d3ee" }}>
            CL-CERT-0001 · VERIFIED
          </p>
        </div>
      </div>
    </section>
  );
}
