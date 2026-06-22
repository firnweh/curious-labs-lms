"use client";

import Link from "next/link";
import { activitiesByGrade, gradesWithContent } from "@/lib/activities/registry";

/**
 * "Mission Select" grade picker — turns the flat number grid into a journey map.
 * Each grade is a card with its yearly theme + a signature project, colour-coded
 * by band (Class 1-3 Juniors → 4-6 Explorers → 7-10 Innovators), so you see the
 * climb from a first circuit to a self-driving car. Hover lifts + glows the card.
 */

interface GradeInfo {
  g: number;
  theme: string;
  sig: string;
  emoji: string;
}

const GRADES: GradeInfo[] = [
  { g: 1, theme: "Exploration & Logic", sig: "Robot Buddy", emoji: "🤖" },
  { g: 2, theme: "Cause & Effect", sig: "Moving Car", emoji: "🚗" },
  { g: 3, theme: "Motion & Control", sig: "Scratch Game", emoji: "🎮" },
  { g: 4, theme: "Real Robotics", sig: "Line Follower", emoji: "🛤️" },
  { g: 5, theme: "Automation", sig: "Smart Home", emoji: "🏠" },
  { g: 6, theme: "Code Meets Hardware", sig: "Bluetooth Bot", emoji: "📡" },
  { g: 7, theme: "AI & Data", sig: "Voice Robot", emoji: "🎙️" },
  { g: 8, theme: "Decision Systems", sig: "Object Detector", emoji: "👁️" },
  { g: 9, theme: "Engineering & Research", sig: "Autonomous Bot", emoji: "🛰️" },
  { g: 10, theme: "Industry & Startups", sig: "Self-Driving Car", emoji: "🚘" },
];

const BANDS = [
  { test: (g: number) => g <= 3, label: "JUNIORS", chip: "Class 1–3", emoji: "🐣", accent: "#34d399" },
  { test: (g: number) => g <= 6, label: "EXPLORERS", chip: "Class 4–6", emoji: "🚀", accent: "#22d3ee" },
  { test: (g: number) => g <= 10, label: "INNOVATORS", chip: "Class 7–10", emoji: "🧠", accent: "#a855f7" },
];

function bandOf(g: number) {
  return BANDS.find((b) => b.test(g)) ?? BANDS[BANDS.length - 1];
}

export function GradeJourney() {
  const ready = new Set(gradesWithContent());

  return (
    <div>
      {/* band legend — the three tiers / colours */}
      <div className="mb-5 flex flex-wrap items-center justify-center gap-2 font-mono text-[11px] tracking-tech">
        {BANDS.map((b, i) => (
          <span key={b.label} className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1"
              style={{ borderColor: `${b.accent}55`, color: b.accent }}
            >
              <span aria-hidden>{b.emoji}</span>
              {b.chip}
            </span>
            {i < BANDS.length - 1 && <span className="text-ink-faint" aria-hidden>→</span>}
          </span>
        ))}
      </div>

      {/* the journey — 10 mission cards, easy → hard */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {GRADES.map((d) => {
          const band = bandOf(d.g);
          const live = ready.has(d.g);
          const count = activitiesByGrade(d.g).length || 10;

          const card = (
            <>
              {/* band accent top bar */}
              <span
                className="pointer-events-none absolute inset-x-0 top-0 h-1"
                style={{ background: band.accent }}
              />
              <div className="flex items-start justify-between">
                <span className="font-display text-3xl font-bold leading-none text-ink">{d.g}</span>
                <span className="text-2xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" aria-hidden>
                  {d.emoji}
                </span>
              </div>
              <span className="mt-1 font-mono text-[9px] tracking-tech" style={{ color: band.accent }}>
                {band.label}
              </span>
              <span className="text-xs leading-tight text-ink-dim">{d.theme}</span>
              <span className="mt-1 text-xs font-semibold" style={{ color: band.accent }}>
                ▸ {d.sig}
              </span>
              <div className="mt-auto flex items-center justify-between pt-2.5 font-mono text-[10px] tracking-tech">
                <span className="text-ink-faint">{live ? `${count} LABS` : "SOON"}</span>
                {live && (
                  <span
                    className="inline-flex items-center gap-1 transition-transform group-hover:translate-x-0.5"
                    style={{ color: band.accent }}
                  >
                    PLAY →
                  </span>
                )}
              </div>
            </>
          );

          const cls =
            "group relative flex min-h-[140px] flex-col overflow-hidden p-4 panel";

          return live ? (
            <Link
              key={d.g}
              href={`/grade/${d.g}`}
              aria-label={`Grade ${d.g} — ${d.theme}: ${count} labs`}
              className={`${cls} panel-hover`}
              style={{ color: band.accent }}
            >
              {card}
            </Link>
          ) : (
            <div key={d.g} className={`${cls} opacity-50`} style={{ color: band.accent }} aria-label={`Grade ${d.g} — coming soon`}>
              {card}
            </div>
          );
        })}
      </div>
    </div>
  );
}
