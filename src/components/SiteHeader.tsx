import Link from "next/link";
import { HeaderAuth } from "@/components/HeaderAuth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

/**
 * Global site header — fixed on every page. Curious Labs logo on the left,
 * auth state (Login, or the signed-in learner chip) on the right. The fixed
 * height is offset by `main { padding-top }` in globals.css so page content
 * clears the bar.
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
          <Link
            href="/scratch"
            title="Studio"
            className="hidden items-center gap-1.5 rounded-full border border-line/70 bg-base/50 px-3 py-1.5 text-ink-dim transition-colors hover:border-neon-violet/50 hover:text-ink sm:inline-flex"
          >
            <span aria-hidden>🎮</span>
            <span className="font-mono text-xs tracking-tech">Studio</span>
          </Link>
          <Link
            href="/maker"
            title="Maker Lab — wire a circuit and program the chip"
            className="hidden items-center gap-1.5 rounded-full border border-line/70 bg-base/50 px-3 py-1.5 text-ink-dim transition-colors hover:border-neon-cyan/50 hover:text-ink sm:inline-flex"
          >
            <span aria-hidden>🔧</span>
            <span className="font-mono text-xs tracking-tech">Maker</span>
          </Link>
          <Link
            href="/passport"
            title="My Skill Passport"
            className="hidden items-center gap-1.5 rounded-full border border-line/70 bg-base/50 px-3 py-1.5 text-ink-dim transition-colors hover:border-neon-cyan/50 hover:text-ink sm:inline-flex"
          >
            <span aria-hidden>🪪</span>
            <span className="font-mono text-xs tracking-tech">Passport</span>
          </Link>
          <LanguageSwitcher />
          <HeaderAuth />
        </div>
      </div>
    </header>
  );
}
