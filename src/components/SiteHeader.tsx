"use client";

import Link from "next/link";
import { useMounted } from "@/lib/progress";
import { useGameStats } from "@/lib/gamification";
import { useCosmetics } from "@/lib/cosmetics";

export function SiteHeader() {
  const stats = useGameStats();
  const cos = useCosmetics();
  const mounted = useMounted();
  const level = stats.level;
  const accent = cos.equipped.accent.value;

  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-base/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan neon-ring">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
              <circle cx="12" cy="12" r="4" />
              <path d="M5 5l2.5 2.5M16.5 16.5L19 19M19 5l-2.5 2.5M7.5 16.5L5 19" />
            </svg>
          </span>
          <span className="font-display text-[15px] font-bold tracking-tech">
            CURIOUS<span className="text-neon-cyan neon-text">LABS</span>
          </span>
        </Link>

        <nav className="flex items-center gap-3 text-sm sm:gap-4">
          <Link href="/#tracks" className="text-ink-dim hover:text-ink transition-colors hidden md:block">
            Tracks
          </Link>
          <Link href="/create" className="text-ink-dim hover:text-ink transition-colors hidden md:block">
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
    </header>
  );
}
