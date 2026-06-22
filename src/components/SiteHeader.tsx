import Link from "next/link";

/**
 * Global site header — fixed on every page. Curious Labs logo on the left,
 * Login button on the right. Nothing else (per design): no track tabs, no
 * level/streak chrome. The fixed height is offset by `main { padding-top }`
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

        <Link
          href="/login"
          className="rounded-full border border-neon-cyan/50 bg-neon-cyan/10 px-5 py-2 font-mono text-sm font-semibold tracking-tech text-neon-cyan transition-colors hover:border-neon-cyan hover:bg-neon-cyan/20"
        >
          Login
        </Link>
      </div>
    </header>
  );
}
