"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SUBJECTS } from "@/lib/subjects";
import { ACTIVITIES } from "@/lib/activities/registry";

const STATS = [
  { target: ACTIVITIES.length, suffix: "", label: "Live Labs" },
  { target: SUBJECTS.length, suffix: "", label: "Tracks" },
  { target: 3, suffix: "", label: "Class Bands" },
  { target: 100, suffix: "%", label: "In-Browser" },
];

function StatNum({ target, suffix }: { target: number; suffix: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    let start = 0;
    const dur = 1400;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    const t = window.setTimeout(() => (raf = requestAnimationFrame(step)), 700);
    // Safety net: requestAnimationFrame can stall in a background/throttled tab,
    // freezing the count-up partway. setTimeout still fires, so guarantee the
    // number always lands on its true target.
    const settle = window.setTimeout(() => setVal(target), 700 + dur + 400);
    return () => {
      clearTimeout(t);
      clearTimeout(settle);
      cancelAnimationFrame(raf);
    };
  }, [target]);

  return (
    <span ref={ref} className="stat-num">
      {val.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}

/** The cinematic landing hero: aurora + planet + orbit rings + shimmer headline. */
export function CinematicHero() {
  return (
    <section className="hero" id="home">
      {/* orbit rings + planet (decorative) */}
      <div className="orbit-system" aria-hidden>
        <div className="orbit-ring" />
        <div className="orbit-ring r2" />
        <div className="orbit-sat" />
        <div className="orbit-sat s2" />
        <div className="orbit-sat s3" />
      </div>
      <div className="hero-planet" aria-hidden>
        <i />
      </div>

      <div className="hero-badge">
        <span className="badge-dot" />
        India&apos;s #1 STEM Innovation Platform
      </div>

      <h1>
        <span className="line-1">Explore. Build.</span>
        <span className="line-orange">Innovate.</span>
        <span className="line-blue">Create Future.</span>
      </h1>

      <p className="hero-sub">
        Where young makers discover Coding, Robotics, AI and 3D Modelling through
        hands-on browser labs, real projects and instant feedback — powered by Physics Wallah.
      </p>

      <div className="hero-actions">
        <Link href="/tracks" className="btn-primary">
          🚀 Enter the Labs
        </Link>
        <a href="#samples" className="btn-secondary">
          ▶ Try a sample lab
        </a>
      </div>

      <div className="stats-bar">
        {STATS.map((s) => (
          <div className="stat" key={s.label}>
            <StatNum target={s.target} suffix={s.suffix} />
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
