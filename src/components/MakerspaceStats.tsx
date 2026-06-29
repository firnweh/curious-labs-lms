"use client";

import Link from "next/link";

/**
 * "Your creative areas" — the homepage slide that showcases the four hands-on
 * platforms. Every subject's activities live in its own studio now (no separate
 * lab lists), so this slide routes straight into them. 3D is not built yet.
 */
interface Platform {
  id: string;
  name: string;
  emoji: string;
  subject: string;
  tagline: string;
  href: string | null; // null → coming soon
  accent: string;
}

const PLATFORMS: Platform[] = [
  { id: "coding", name: "Studio", emoji: "🎮", subject: "CODING", tagline: "Snap blocks together to build games & animations.", href: "/scratch", accent: "#22d3ee" },
  { id: "robotics", name: "Maker Lab", emoji: "🔧", subject: "ROBOTICS", tagline: "Wire up a circuit and program the chip.", href: "/maker", accent: "#34d399" },
  { id: "ai", name: "Neural Lab", emoji: "⚡", subject: "AI", tagline: "Train your own AI across 10 hands-on experiments.", href: "/neural", accent: "#a855f7" },
  { id: "threed", name: "3D Studio", emoji: "🧊", subject: "3D MODELLING", tagline: "Shape space and build worlds in three dimensions.", href: null, accent: "#f59e0b" },
];

export default function MakerspaceStats() {
  return (
    <section id="stats">
      <div className="mb-8 text-center">
        <div className="section-label reveal">Your creative areas</div>
        <h2 className="section-title reveal">Four makerspaces, one browser</h2>
        <p className="section-sub reveal mx-auto mt-3 max-w-xl">
          Every subject has its own hands-on studio. Pick an area and start building — no installs, grades 1–10.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLATFORMS.map((p) => {
          const soon = p.href === null;
          const inner = (
            <>
              <span
                className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ background: `linear-gradient(90deg, transparent, ${p.accent}, transparent)` }}
                aria-hidden
              />
              <div className="flex items-center justify-between">
                <span
                  className="grid h-14 w-14 place-items-center rounded-2xl text-3xl transition-transform duration-300 group-hover:scale-110"
                  style={{ background: `${p.accent}1f`, border: `1px solid ${p.accent}40` }}
                  aria-hidden
                >
                  {p.emoji}
                </span>
                <span className="font-mono text-[10px] tracking-tech" style={{ color: p.accent }}>{p.subject}</span>
              </div>
              <h3 className="mt-4 font-display text-xl font-bold text-ink">{p.name}</h3>
              <p className="mt-1 flex-1 text-sm text-ink-dim">{p.tagline}</p>
              <div className="mt-4 font-mono text-xs font-semibold tracking-tech" style={{ color: p.accent }}>
                {soon ? "🔒 LAUNCHING SOON" : (
                  <span className="inline-flex items-center gap-1">
                    OPEN <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                  </span>
                )}
              </div>
            </>
          );
          const cls = "panel group relative flex min-h-[210px] flex-col overflow-hidden p-6";
          return soon ? (
            <div key={p.id} className={cls} style={{ opacity: 0.6 }} aria-disabled="true" aria-label={`${p.name} — coming soon`}>
              {inner}
            </div>
          ) : (
            <Link key={p.id} href={p.href!} className={`${cls} transition-transform hover:-translate-y-0.5`} aria-label={`Open ${p.name}`} style={{ "--acc": p.accent } as React.CSSProperties}>
              {inner}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
