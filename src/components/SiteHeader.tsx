import Link from "next/link";
import { HeaderAuth } from "@/components/HeaderAuth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MobileNav } from "@/components/MobileNav";

export type NavItem = {
  href: string;
  label: string;
  title: string;
  emoji: string;
  /** Tailwind hover-border class, kept literal so it survives JIT purging. */
  hover: string;
};

// Single source of truth for the header nav — rendered as pills on desktop and
// inside the MobileNav sheet below `sm`.
const NAV: NavItem[] = [
  { href: "/scratch", label: "Studio", title: "Studio", emoji: "🎮", hover: "hover:border-neon-violet/50" },
  { href: "/maker", label: "Maker", title: "Maker Lab — wire a circuit and program the chip", emoji: "🔧", hover: "hover:border-neon-cyan/50" },
  { href: "/neural", label: "Neural Lab", title: "Neural Lab — train your own AI", emoji: "⚡", hover: "hover:border-neon-green/50" },
  { href: "/passport", label: "Passport", title: "My Skill Passport", emoji: "🪪", hover: "hover:border-neon-cyan/50" },
];

/**
 * Global site header — fixed on every page. Curious Labs logo on the left,
 * nav + auth state on the right. The nav collapses into a hamburger menu
 * (MobileNav) below `sm`. The fixed height is offset by `main { padding-top }`
 * in globals.css so page content clears the bar.
 */
export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-line/60 bg-base/70 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex shrink-0 items-center" aria-label="Curious Labs home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/curious-labs-logo.png"
            alt="Curious Labs — Powered by Physics Wallah"
            className="h-11 w-auto"
          />
        </Link>

        <div className="flex items-center gap-3">
          {/* desktop nav pills */}
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={item.title}
              className={`hidden items-center gap-1.5 rounded-full border border-line/70 bg-base/50 px-3 py-1.5 text-ink-dim transition-colors ${item.hover} hover:text-ink sm:inline-flex`}
            >
              <span aria-hidden>{item.emoji}</span>
              <span className="font-mono text-xs tracking-tech">{item.label}</span>
            </Link>
          ))}
          <LanguageSwitcher />
          <HeaderAuth />
          {/* mobile hamburger (sm:hidden) */}
          <MobileNav items={NAV} />
        </div>
      </div>
    </header>
  );
}
