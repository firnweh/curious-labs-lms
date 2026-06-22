"use client";

import Link from "next/link";
import { BANDS, useBand } from "@/lib/bands";

/**
 * The three class-band cards on the homepage. Clicking one sets that band
 * (persisted) and routes to /tracks, which shows the labs filtered to that
 * class range. Hover is kept deliberately light — the standard cheap
 * `panel-hover` (lift + accent border) plus a sliding arrow — so it stays
 * smooth. The glow and HUD brackets are static decoration (no per-frame cost).
 */
export function ClassBandCards() {
  const { setBand } = useBand();

  return (
    <div className="grid gap-5 sm:grid-cols-3">
      {BANDS.map((b) => (
        <Link
          key={b.id}
          href="/tracks"
          onClick={() => setBand(b.id)}
          aria-label={`${b.classes} — ${b.name}: open the labs`}
          className="panel panel-hover group relative flex flex-col overflow-hidden p-7"
          style={{ color: b.accent, borderColor: `${b.accent}33` }}
        >
          {/* static accent glow — rasterized once, no hover animation */}
          <div
            className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full opacity-25 blur-2xl"
            style={{ background: b.accent }}
          />

          {/* static HUD corner brackets (decoration) */}
          <Bracket pos="tl" accent={b.accent} />
          <Bracket pos="tr" accent={b.accent} />
          <Bracket pos="bl" accent={b.accent} />
          <Bracket pos="br" accent={b.accent} />

          <div className="relative flex items-center gap-4">
            <span
              className="grid h-14 w-14 place-items-center rounded-2xl text-3xl"
              style={{ background: `${b.accent}1a`, border: `1px solid ${b.accent}40` }}
              aria-hidden
            >
              {b.emoji}
            </span>
            <div className="leading-tight">
              <h3 className="font-orbitron text-lg font-bold text-ink">{b.classes}</h3>
              <p className="font-mono text-[11px] tracking-tech" style={{ color: b.accent }}>
                {b.name.toUpperCase()}
              </p>
            </div>
          </div>

          <p className="relative mt-4 text-sm font-medium" style={{ color: b.accent }}>
            {b.tagline}
          </p>
          <p className="relative mt-2 flex-1 text-sm text-ink-dim">{b.thinking}</p>

          {/* CTA — arrow nudges on hover (cheap transform) */}
          <span
            className="relative mt-5 inline-flex items-center gap-1.5 font-mono text-xs tracking-tech opacity-80 transition-opacity group-hover:opacity-100"
            style={{ color: b.accent }}
          >
            ENTER LABS
            <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

/** A small static L-shaped HUD bracket pinned to one corner (pure decoration). */
function Bracket({ pos, accent }: { pos: "tl" | "tr" | "bl" | "br"; accent: string }) {
  const map: Record<typeof pos, string> = {
    tl: "left-2 top-2 border-l-2 border-t-2",
    tr: "right-2 top-2 border-r-2 border-t-2",
    bl: "bottom-2 left-2 border-b-2 border-l-2",
    br: "bottom-2 right-2 border-b-2 border-r-2",
  };
  return (
    <span
      className={`pointer-events-none absolute h-4 w-4 opacity-40 ${map[pos]}`}
      style={{ borderColor: accent }}
      aria-hidden
    />
  );
}
