"use client";

import { useEffect, useRef, useState } from "react";

type Stat = {
  value: number;
  label: string;
  accent: string;
};

const STATS: Stat[] = [
  { value: 26, label: "LIVE LABS", accent: "#22d3ee" },
  { value: 4, label: "TRACKS", accent: "#34d399" },
  { value: 10, label: "GRADES (1–10)", accent: "#a855f7" },
  { value: 0, label: "INSTALLS", accent: "#f59e0b" },
];

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function CountUp({ target }: { target: number }) {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0 || prefersReducedMotion()) {
      setValue(target);
      return;
    }

    const duration = 1200;
    let start: number | null = null;

    const tick = (now: number) => {
      if (start === null) start = now;
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(eased * target));
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [target]);

  return <>{value}</>;
}

export default function MakerspaceStats() {
  return (
    <section id="stats">
      <div className="mb-8 text-center">
        <div className="section-label reveal">By the numbers</div>
        <h2 className="section-title reveal">A whole makerspace in your browser</h2>
        <p className="section-sub reveal mx-auto mt-3 max-w-xl">Hands-on STEM for grades 1–10 — no installs, no setup, just experiments that run.</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="panel tilt reveal p-7 text-center"
            style={{ color: stat.accent }}
          >
            <div className="stat-num font-display text-5xl font-bold text-ink">
              <CountUp target={stat.value} />
            </div>
            <div
              className="font-mono text-xs tracking-tech"
              style={{ color: stat.accent }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
