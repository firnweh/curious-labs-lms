"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ACTIVITIES, gradesWithContent } from "@/lib/activities/registry";
import { SUBJECTS } from "@/lib/subjects";

type Stat = {
  value: number;
  label: string;
  icon: string;
  accent: string;
};

// All computed from the registry so the slide never goes stale.
const CURRICULUM_PROJECTS = ACTIVITIES.filter((a) => a.grade != null).length; // g1–g10 → 100

const STATS: Stat[] = [
  { value: ACTIVITIES.length, label: "Live Labs", icon: "🧪", accent: "#22d3ee" },
  { value: SUBJECTS.length, label: "Tracks", icon: "🧭", accent: "#34d399" },
  { value: gradesWithContent().length, label: "Grades", icon: "🎓", accent: "#a855f7" },
  { value: CURRICULUM_PROJECTS, label: "Projects", icon: "🛠️", accent: "#f59e0b" },
];

// Live labs-per-track breakdown for the distribution bar.
const SHORT: Record<string, string> = { coding: "Coding", robotics: "Robotics", ai: "AI", threed: "3D" };
const BY_TRACK = SUBJECTS.map((s) => ({
  id: s.id,
  name: SHORT[s.id] ?? s.name,
  emoji: s.emoji,
  accent: s.accent,
  count: ACTIVITIES.filter((a) => a.subject === s.id).length,
}));
const TOTAL = ACTIVITIES.length;

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
    // Safety net: rAF can stall in a background/throttled tab and freeze the
    // count partway. setTimeout still fires, so guarantee the final value lands.
    const settle = window.setTimeout(() => setValue(target), duration + 400);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      clearTimeout(settle);
    };
  }, [target]);

  return <>{value}</>;
}

export default function MakerspaceStats() {
  return (
    <section id="stats">
      <div className="mb-6 text-center">
        <div className="section-label reveal">By the numbers</div>
        <h2 className="section-title reveal">A whole makerspace in your browser</h2>
        <p className="section-sub reveal mx-auto mt-3 max-w-xl">Hands-on STEM for grades 1–10 — no installs, no setup, just experiments that run.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="panel p-6 text-center"
            style={{ color: stat.accent }}
          >
            <div className="text-3xl" aria-hidden>{stat.icon}</div>
            <div className="stat-num font-display mt-1 text-4xl font-bold text-ink">
              <CountUp target={stat.value} />
            </div>
            <div className="mt-0.5 font-mono text-xs tracking-tech" style={{ color: stat.accent }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Labs-by-track distribution — a tappable shortcut into each track */}
      <TrackBar />
    </section>
  );
}

/**
 * The "Labs by track" bar. Each segment + legend row links to that track's labs,
 * and the segments grow in (staggered) the first time the bar scrolls into view.
 */
function TrackBar() {
  const ref = useRef<HTMLDivElement>(null);
  const [grow, setGrow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      setGrow(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setGrow(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    // Fallback in case the observer never fires (e.g. odd transforms).
    const t = window.setTimeout(() => setGrow(true), 1400);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, []);

  return (
    <div className="panel mx-auto mt-5 max-w-3xl p-6">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-xs tracking-tech text-ink-faint">LABS BY TRACK</span>
        <span className="font-mono text-xs text-ink-faint">tap a colour →</span>
      </div>
      <div
        ref={ref}
        className="flex h-3 w-full overflow-hidden rounded-full bg-line/40"
        role="group"
        aria-label="Labs by track — tap a segment to open that track"
      >
        {BY_TRACK.map((t, i) => (
          <Link
            key={t.id}
            href={`/subjects/${t.id}`}
            title={`${t.name}: ${t.count} labs`}
            aria-label={`${t.name}: ${t.count} labs — open this track`}
            className="block h-full transition-[width,filter] duration-700 ease-out hover:brightness-125"
            style={{
              width: grow ? `${(t.count / TOTAL) * 100}%` : "0%",
              background: t.accent,
              transitionDelay: `${i * 110}ms`,
            }}
          />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        {BY_TRACK.map((t) => (
          <Link
            key={t.id}
            href={`/subjects/${t.id}`}
            aria-label={`${t.name}: ${t.count} labs — open this track`}
            className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-white/5"
          >
            <span aria-hidden>{t.emoji}</span>
            <span className="text-ink-dim transition-colors group-hover:text-ink">{t.name}</span>
            <span className="ml-auto font-mono font-semibold" style={{ color: t.accent }}>{t.count}</span>
            <span className="font-mono text-ink-faint transition-transform group-hover:translate-x-0.5" aria-hidden>→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
