import type { SubjectId } from "./activities/types";

export interface Subject {
  id: SubjectId;
  name: string;
  tagline: string;
  /** Hex accent — kept in sync with the CSS custom props in globals.css. */
  accent: string;
  /** Tailwind text color utility for the accent. */
  textClass: string;
  emoji: string;
  blurb: string;
  /** Glow colours for the page's ambient backdrop (accent-led). */
  palette: string[];
  /** Floating glyphs for the page's ambient backdrop. */
  glyphs: string[];
}

export const SUBJECTS: Subject[] = [
  {
    id: "coding",
    name: "Coding",
    tagline: "Think in steps. Make things move.",
    accent: "#22d3ee",
    textClass: "text-neon-cyan",
    emoji: "💻",
    blurb:
      "Sequence commands, loop them, and watch your logic come alive — no syntax to memorise, just ideas that run.",
    palette: ["#22d3ee", "#3b82f6", "#34d399"],
    glyphs: ["💻", "⌨️", "🧩", "⚡", "✨", "⭐"],
  },
  {
    id: "robotics",
    name: "Robotics",
    tagline: "Wire it. Sense it. Make it act.",
    accent: "#34d399",
    textClass: "text-neon-green",
    emoji: "🤖",
    blurb:
      "Build circuits and teach machines to react to the world with sensors, switches and motors.",
    palette: ["#34d399", "#a3e635", "#22d3ee"],
    glyphs: ["🤖", "⚙️", "🔋", "🔌", "🦾", "✨"],
  },
  {
    id: "ai",
    name: "Artificial Intelligence",
    tagline: "Teach a machine to decide.",
    accent: "#a855f7",
    textClass: "text-neon-violet",
    emoji: "🧠",
    blurb:
      "Train models from examples and tune how a machine 'thinks' — see why data and weights matter.",
    palette: ["#a855f7", "#ec4899", "#3b82f6"],
    glyphs: ["🧠", "✨", "🔮", "📈", "🤖", "⭐"],
  },
  {
    id: "threed",
    name: "3D Modelling",
    tagline: "Shape space. Build worlds.",
    accent: "#f59e0b",
    textClass: "text-neon-amber",
    emoji: "🧊",
    blurb:
      "Construct and transform objects in three dimensions — the foundation of games, design and printing.",
    palette: ["#f59e0b", "#ec4899", "#f43f5e"],
    glyphs: ["🧊", "🔷", "📐", "🟧", "✨", "⭐"],
  },
];

export const SUBJECT_MAP: Record<SubjectId, Subject> = Object.fromEntries(
  SUBJECTS.map((s) => [s.id, s]),
) as Record<SubjectId, Subject>;

export function getSubject(id: string): Subject | undefined {
  return SUBJECT_MAP[id as SubjectId];
}
