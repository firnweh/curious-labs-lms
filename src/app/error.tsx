"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * App-wide fallback for unexpected runtime errors (a backstop beneath the
 * targeted ErrorBoundary around the lab player). Keeps the header/footer and
 * offers a recover path instead of a white screen.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }, [error]);

  return (
    <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-5 text-center">
      <div>
        <span className="text-5xl" aria-hidden>🌌</span>
        <h2 className="mt-3 font-display text-2xl font-bold text-ink">Something drifted off course</h2>
        <p className="mt-2 text-sm text-ink-dim">A little glitch on our side — try again, or head back home.</p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <button onClick={() => unstable_retry()} className="btn-primary">↺ Try again</button>
          <Link href="/" className="rounded-xl border border-line px-4 py-2.5 text-sm text-ink-dim transition-colors hover:text-ink">
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
