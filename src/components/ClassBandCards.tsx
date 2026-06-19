"use client";

import Link from "next/link";
import { BANDS, useBand } from "@/lib/bands";

/**
 * The three class-band cards on the homepage. Each is a clickable, HUD-styled
 * panel: clicking sets that band (persisted) and routes to /tracks, which then
 * shows the labs filtered to that class range. Lots of techy hover motion —
 * corner brackets, a scan-line sweep, a glow lift and a sliding "ENTER" arrow.
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
          className="panel reveal group relative flex flex-col overflow-hidden p-7 transition-all duration-300 hover:-translate-y-1.5"
          style={
            {
              color: b.accent,
              ["--accent" as string]: b.accent,
            } as React.CSSProperties
          }
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = `${b.accent}aa`;
            e.currentTarget.style.boxShadow = `0 18px 50px -18px ${b.accent}, inset 0 0 0 1px ${b.accent}22`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "";
            e.currentTarget.style.boxShadow = "";
          }}
        >
          {/* accent glow blob — grows on hover */}
          <div
            className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full opacity-30 blur-2xl transition-all duration-500 group-hover:scale-150 group-hover:opacity-70"
            style={{ background: b.accent }}
          />

          {/* techy grid overlay — fades in on hover */}
          <div
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{
              backgroundImage: `linear-gradient(${b.accent}14 1px, transparent 1px), linear-gradient(90deg, ${b.accent}14 1px, transparent 1px)`,
              backgroundSize: "22px 22px",
              maskImage: "radial-gradient(circle at 70% 0%, black, transparent 70%)",
              WebkitMaskImage: "radial-gradient(circle at 70% 0%, black, transparent 70%)",
            }}
          />

          {/* top scan-line — sweeps across on hover */}
          <div
            className="pointer-events-none absolute left-0 top-0 h-[2px] w-full origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100"
            style={{ background: `linear-gradient(90deg, transparent, ${b.accent}, transparent)` }}
          />

          {/* HUD corner brackets */}
          <Bracket pos="tl" accent={b.accent} />
          <Bracket pos="tr" accent={b.accent} />
          <Bracket pos="bl" accent={b.accent} />
          <Bracket pos="br" accent={b.accent} />

          <div className="relative flex items-center gap-4">
            <span
              className="grid h-14 w-14 place-items-center rounded-2xl text-3xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6"
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

          {/* CTA — arrow slides on hover */}
          <span
            className="relative mt-5 inline-flex items-center gap-1.5 font-mono text-xs tracking-tech opacity-80 transition-all group-hover:opacity-100"
            style={{ color: b.accent }}
          >
            ENTER LABS
            <span className="transition-transform duration-300 group-hover:translate-x-1.5">→</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

/** A small L-shaped HUD bracket pinned to one corner; brightens + nudges outward on hover. */
function Bracket({ pos, accent }: { pos: "tl" | "tr" | "bl" | "br"; accent: string }) {
  const base =
    "pointer-events-none absolute h-4 w-4 opacity-40 transition-all duration-300 group-hover:opacity-100";
  const map: Record<typeof pos, string> = {
    tl: "left-2 top-2 border-l-2 border-t-2 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5",
    tr: "right-2 top-2 border-r-2 border-t-2 group-hover:translate-x-0.5 group-hover:-translate-y-0.5",
    bl: "bottom-2 left-2 border-b-2 border-l-2 group-hover:-translate-x-0.5 group-hover:translate-y-0.5",
    br: "bottom-2 right-2 border-b-2 border-r-2 group-hover:translate-x-0.5 group-hover:translate-y-0.5",
  };
  return <span className={`${base} ${map[pos]}`} style={{ borderColor: accent }} aria-hidden />;
}
