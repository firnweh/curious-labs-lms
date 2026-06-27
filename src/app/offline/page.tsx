import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline — Curious Labs",
};

/**
 * Shown by the service worker when a page is requested with no connection.
 * Labs already opened stay cached and keep working; this is the fallback for
 * pages that haven't been visited yet.
 */
export default function OfflinePage() {
  return (
    <div className="relative mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl" aria-hidden>
        🛰️
      </div>
      <h1 className="mt-6 font-orbitron text-3xl font-black tracking-tight text-ink">
        You&rsquo;re offline
      </h1>
      <p className="mt-3 text-ink-dim">
        No internet right now — but labs you&rsquo;ve already opened still work.
        Reconnect to load new ones.
      </p>
      <p className="mt-6 font-mono text-xs tracking-tech text-neon-cyan">
        CURIOUS LABS // LEARN BY DOING
      </p>
    </div>
  );
}
