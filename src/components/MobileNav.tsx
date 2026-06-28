"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import type { NavItem } from "@/components/SiteHeader";

/**
 * Mobile-only nav for the global header. Below `sm` the desktop nav pills are
 * hidden, so this hamburger exposes the same links (Studio / Maker / Neural Lab
 * / Passport) in a drop-down sheet. Closes on route change, Escape, or tapping
 * the backdrop.
 */
export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close whenever the route changes (a link was followed).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape to close while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line/70 bg-base/50 text-ink-dim transition-colors hover:border-neon-cyan/50 hover:text-ink"
      >
        <span className="relative block h-3.5 w-4" aria-hidden>
          <span
            className={`absolute left-0 top-0 h-0.5 w-full rounded bg-current transition-transform duration-200 ${open ? "translate-y-1.5 rotate-45" : ""}`}
          />
          <span
            className={`absolute left-0 top-1.5 h-0.5 w-full rounded bg-current transition-opacity duration-200 ${open ? "opacity-0" : ""}`}
          />
          <span
            className={`absolute left-0 top-3 h-0.5 w-full rounded bg-current transition-transform duration-200 ${open ? "-translate-y-1.5 -rotate-45" : ""}`}
          />
        </span>
      </button>

      {open && (
        <>
          {/* backdrop below the header */}
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-x-0 bottom-0 top-16 z-40 cursor-default bg-black/40 backdrop-blur-sm"
          />
          {/* drop-down sheet */}
          <nav className="fixed inset-x-0 top-16 z-50 border-b border-line/60 bg-base/95 px-5 py-3 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl">
            <ul className="mx-auto flex max-w-6xl flex-col gap-1.5">
              {items.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={item.title}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${item.hover} hover:text-ink ${active ? "border-neon-cyan/50 bg-base/70 text-ink" : "border-line/60 bg-base/50 text-ink-dim"}`}
                    >
                      <span className="text-lg" aria-hidden>
                        {item.emoji}
                      </span>
                      <span className="font-mono text-sm tracking-tech">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </>
      )}
    </div>
  );
}
