"use client";

import { usePathname } from "next/navigation";

/**
 * Global footer. Hidden on the Studio (/scratch) so the editor can run
 * full-screen with no page scroll.
 */
export function SiteFooter() {
  const pathname = usePathname();
  if (pathname === "/scratch") return null;
  return (
    <footer className="border-t border-line/60 mt-20">
      <div className="mx-auto max-w-6xl px-5 py-8 text-sm text-ink-faint flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono tracking-tech">
          CURIOUS<span className="text-neon-cyan">LABS</span> // LEARN BY DOING
        </span>
        <span>Browser experiments · zero installs · grades 1–10</span>
      </div>
    </footer>
  );
}
