"use client";

import Link from "next/link";
import { StartQR } from "@/components/StartQR";

/**
 * The finale slide — a mission-control "launch pad". The three platforms are
 * LAUNCH rows on a console with a live boot readout + online indicators, and the
 * QR becomes a "beam to tablet" panel. 3D sits in standby (coming soon).
 */
const LAUNCH = [
  { name: "STUDIO", sub: "coding", href: "/scratch", accent: "#22d3ee" },
  { name: "MAKER LAB", sub: "robotics", href: "/maker", accent: "#34d399" },
  { name: "NEURAL LAB", sub: "artificial intelligence", href: "/neural", accent: "#a855f7" },
  { name: "3D STUDIO", sub: "3d modelling", href: null as string | null, accent: "#f59e0b" },
];

const BOOT = ["booting curious core", "3 studios online", "grades 1–10 linked", "awaiting launch command"];

export function MissionConsole() {
  return (
    <section id="launch">
      <div className="panel relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -left-16 -top-16 h-52 w-52 rounded-full bg-neon-violet/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 -bottom-16 h-52 w-52 rounded-full bg-neon-cyan/20 blur-3xl" />

        <div className="relative">
          {/* console header */}
          <div className="flex items-center justify-between gap-3 border-b border-line/50 pb-3">
            <div className="flex items-center gap-2">
              <span className="mc-dot" style={{ background: "#34d399", boxShadow: "0 0 8px #34d399" }} />
              <span className="font-mono text-xs tracking-tech text-neon-green">SYSTEMS ONLINE</span>
            </div>
            <span className="font-mono text-[10px] tracking-tech text-ink-faint">CURIOUS · LAUNCH PAD</span>
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-[1.45fr_1fr]">
            {/* launch console */}
            <div>
              <h2 className="font-orbitron text-2xl font-bold text-ink neon-text sm:text-3xl">Ready for launch?</h2>
              {/* boot readout */}
              <div className="mt-3 space-y-0.5 font-mono text-[11px] text-ink-dim">
                {BOOT.map((b, i) => (
                  <div key={i} className="mc-boot flex items-center gap-2" style={{ animationDelay: `${i * 0.55}s` }}>
                    <span className="text-neon-green">▸</span> {b}…
                    {i < BOOT.length - 1 ? <span className="ml-auto text-neon-green">OK</span> : <span className="mc-blink ml-auto text-neon-cyan">▮</span>}
                  </div>
                ))}
              </div>
              {/* launch rows */}
              <div className="mt-4 space-y-2">
                {LAUNCH.map((l) => {
                  const soon = l.href === null;
                  const row = (
                    <div
                      className="flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 transition-all group-hover:-translate-y-0.5"
                      style={{ borderColor: soon ? "#2a2f3a" : `${l.accent}44`, background: soon ? "transparent" : `${l.accent}0d`, opacity: soon ? 0.6 : 1 }}
                    >
                      <span className="mc-dot" style={{ background: soon ? "#5b6b8c" : l.accent, boxShadow: soon ? "none" : `0 0 8px ${l.accent}` }} />
                      <div className="min-w-0">
                        <div className="font-mono text-sm font-bold" style={{ color: soon ? "#9fb0d0" : l.accent }}>{l.name}</div>
                        <div className="font-mono text-[9px] tracking-tech text-ink-faint">{l.sub}</div>
                      </div>
                      <span className="ml-auto font-mono text-xs font-bold" style={{ color: soon ? "#5b6b8c" : l.accent }}>
                        {soon ? "🔒 STANDBY" : (
                          <span className="inline-flex items-center gap-1">LAUNCH <span className="transition-transform group-hover:translate-x-0.5">→</span></span>
                        )}
                      </span>
                    </div>
                  );
                  return soon ? (
                    <div key={l.name} aria-disabled="true" aria-label={`${l.name} — coming soon`}>{row}</div>
                  ) : (
                    <Link key={l.name} href={l.href!} className="group block" aria-label={`Launch ${l.name}`}>{row}</Link>
                  );
                })}
              </div>
            </div>

            {/* beam to tablet */}
            <div className="flex flex-col items-center justify-center rounded-xl border border-line/50 bg-base/40 p-5 text-center">
              <span className="font-mono text-[10px] tracking-tech text-neon-cyan">▣ BEAM TO TABLET</span>
              <div className="mt-3"><StartQR /></div>
              <p className="mt-3 max-w-[180px] font-mono text-[10px] leading-relaxed text-ink-faint">scan to continue the mission on a tablet</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .mc-dot { display:inline-block; width:8px; height:8px; border-radius:9999px; animation: mcPulse 1.6s ease-in-out infinite; }
        @keyframes mcPulse { 0%,100%{ opacity:.55 } 50%{ opacity:1 } }
        .mc-boot { opacity:0; animation: mcBoot .5s ease forwards; }
        @keyframes mcBoot { from{ opacity:0; transform: translateX(-6px) } to{ opacity:1; transform:none } }
        .mc-blink { animation: mcBlink 1s step-end infinite; }
        @keyframes mcBlink { 0%,100%{ opacity:1 } 50%{ opacity:0 } }
      `}</style>
    </section>
  );
}
