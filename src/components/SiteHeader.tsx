"use client";

import Link from "next/link";
import { useMounted } from "@/lib/progress";
import { useGameStats } from "@/lib/gamification";
import { useCosmetics } from "@/lib/cosmetics";
import { TrackTabs } from "@/components/TrackTabs";

export function SiteHeader() {
  const stats = useGameStats();
  const cos = useCosmetics();
  const mounted = useMounted();
  const level = stats.level;
  const accent = cos.equipped.accent.value;

  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-base/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 pt-3.5 pb-1">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <span
            className="grid h-9 w-9 place-items-center rounded-xl border border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan"
            style={{ animation: "pulse-logo 2.6s ease-in-out infinite" }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
              <circle cx="12" cy="12" r="4" />
              <path d="M5 5l2.5 2.5M16.5 16.5L19 19M19 5l-2.5 2.5M7.5 16.5L5 19" />
            </svg>
          </span>
          <span className="leading-none">
            <span className="block font-orbitron text-[15px] font-bold tracking-tech text-ink">
              CURIOUS<span className="text-neon-cyan neon-text">LABS</span>
            </span>
            <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint">
              Powered by <span className="text-neon-cyan">Physics Wallah</span>
            </span>
          </span>
        </Link>

        {/* desktop track tabs sit inline with the brand */}
        <div className="hidden flex-1 justify-center md:flex">
          <TrackTabs />
        </div>

        <nav className="flex shrink-0 items-center gap-3 text-sm sm:gap-4">
          <Link href="/circuits" className="text-ink-dim hover:text-ink transition-colors hidden lg:block">
            Circuits
          </Link>
          <Link href="/create" className="text-ink-dim hover:text-ink transition-colors hidden lg:block">
            Create
          </Link>

          {/* streak */}
          {mounted && stats.streak > 0 && (
            <span className="flex items-center gap-1 font-mono text-xs text-neon-amber" title={`${stats.streak}-day streak`}>
              <span className="animate-pulse-glow">🔥</span>
              {stats.streak}
            </span>
          )}

          {/* avatar + level → profile */}
          <Link
            href="/profile"
            className="flex items-center gap-2 rounded-full border border-line bg-panel/60 px-2 py-1 transition-colors hover:border-ink-faint"
            style={{ borderColor: mounted ? `${accent}55` : undefined }}
            title={`Level ${level.index} · ${stats.xp} XP`}
          >
            <span
              className="grid h-6 w-6 place-items-center rounded-full text-sm"
              style={{ background: `${accent}1a`, border: `1px solid ${accent}66` }}
              aria-hidden
            >
              {mounted ? cos.equipped.avatar.value : "🧑‍🚀"}
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-mono text-[11px] text-ink">
                Lv {mounted ? level.index : 1}
                <span className="ml-1 hidden text-ink-faint sm:inline">{level.title}</span>
              </span>
              <span className="mt-1 hidden h-1 w-16 overflow-hidden rounded-full bg-line sm:block">
                <span
                  className="block h-full rounded-full transition-all"
                  style={{ width: `${mounted ? level.pct : 0}%`, background: accent }}
                />
              </span>
            </span>
          </Link>
        </nav>
      </div>

      {/* mobile track tabs drop to their own scrollable row */}
      <div className="mx-auto max-w-6xl px-5 pb-1 md:hidden">
        <TrackTabs />
      </div>
    </header>
  );
}
