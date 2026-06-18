"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SUBJECTS } from "@/lib/subjects";

interface Tab {
  href: string;
  label: string;
  short: string;
  accent: string;
  emoji?: string;
}

const TABS: Tab[] = [
  { href: "/tracks", label: "All Tracks", short: "All", accent: "#22d3ee" },
  ...SUBJECTS.map((s) => ({
    href: `/subjects/${s.id}`,
    label: s.name,
    short: s.name === "Artificial Intelligence" ? "AI" : s.name === "3D Modelling" ? "3D" : s.name,
    accent: s.accent,
    emoji: s.emoji,
  })),
];

/**
 * Header track navigation, rendered as a tab bar. The four subject tracks
 * (plus an "All Tracks" overview) live here so the homepage can stay purely
 * informational. Active tab is derived from the current pathname.
 */
export function TrackTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Tracks"
      className="no-scrollbar -mx-5 flex items-center gap-1 overflow-x-auto px-5 sm:mx-0 sm:px-0"
    >
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className="group relative shrink-0 px-3 py-2.5 text-sm font-medium transition-colors"
            style={{ color: active ? t.accent : undefined }}
          >
            <span className={active ? "" : "text-ink-dim group-hover:text-ink"}>
              {t.emoji && <span className="mr-1.5" aria-hidden>{t.emoji}</span>}
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.short}</span>
            </span>
            {/* active underline */}
            <span
              className="pointer-events-none absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-all"
              style={{
                background: t.accent,
                opacity: active ? 1 : 0,
                boxShadow: active ? `0 0 10px ${t.accent}` : undefined,
              }}
            />
          </Link>
        );
      })}
    </nav>
  );
}
