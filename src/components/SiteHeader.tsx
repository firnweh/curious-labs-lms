import Link from "next/link";
import { HeaderAuth } from "@/components/HeaderAuth";

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

        <HeaderAuth />
      </div>
    </header>
  );
}
