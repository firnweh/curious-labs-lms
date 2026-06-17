import Link from "next/link";
import type { ReactNode } from "react";

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} of 3 stars`}>
      {[1, 2, 3].map((n) => (
        <svg
          key={n}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className={n <= value ? "text-neon-amber" : "text-line"}
          fill="currentColor"
        >
          <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

export function Difficulty({ level }: { level: 1 | 2 | 3 }) {
  const labels = { 1: "Starter", 2: "Builder", 3: "Pro" } as const;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-dim">
      <span className="flex gap-0.5">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`h-1.5 w-1.5 rounded-full ${
              n <= level ? "bg-neon-cyan" : "bg-line"
            }`}
          />
        ))}
      </span>
      {labels[level]}
    </span>
  );
}

export function Tag({
  children,
  accent,
}: {
  children: ReactNode;
  accent?: string;
}) {
  return (
    <span
      className="rounded-full border border-line bg-panel/60 px-2.5 py-0.5 text-[11px] font-mono tracking-tech text-ink-dim"
      style={accent ? { color: accent, borderColor: `${accent}55` } : undefined}
    >
      {children}
    </span>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 text-sm text-ink-dim hover:text-ink transition-colors"
    >
      <span aria-hidden>←</span>
      {label}
    </Link>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-line bg-panel/50 px-3 py-1 text-xs text-ink-dim">
      {children}
    </span>
  );
}
