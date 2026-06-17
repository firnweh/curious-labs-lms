"use client";

import Link from "next/link";
import { useProgress } from "@/lib/progress";
import { useMounted } from "@/lib/progress";

export function SiteHeader() {
  const { completedCount } = useProgress();
  const mounted = useMounted();

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

        <nav className="flex items-center gap-5 text-sm">
          <Link href="/#tracks" className="text-ink-dim hover:text-ink transition-colors hidden sm:block">
            Tracks
          </Link>
          <Link href="/#how" className="text-ink-dim hover:text-ink transition-colors hidden sm:block">
            How it works
          </Link>
          <span className="flex items-center gap-2 rounded-full border border-line bg-panel/60 px-3 py-1 font-mono text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-neon-green animate-pulse-glow" />
            <span className="text-ink-dim">
              {mounted ? completedCount : 0}
              <span className="text-ink-faint"> done</span>
            </span>
          </span>
        </nav>
      </div>
    </header>
  );
}
