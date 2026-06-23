import type { CircuitDoc, SimResult, PartType } from "./types";

/**
 * Guided circuit challenges. Each has a kid-friendly goal and a `check`
 * predicate evaluated against the live simulation — when it passes, the lab
 * is solved. Pure data + functions, reused by the graded activity wrappers.
 */
export interface Challenge {
  id: string;
  title: string;
  /** kid-facing goal shown in the banner */
  prompt: string;
  emoji: string;
  check: (doc: CircuitDoc, sim: SimResult) => boolean;
  /** optional pre-placed parts to start from */
  starter?: CircuitDoc;
}

const onCount = (doc: CircuitDoc, sim: SimResult, type: PartType) =>
  doc.components.filter((c) => c.type === type && sim.comp[c.id]?.on).length;

const has = (doc: CircuitDoc, type: PartType) => doc.components.some((c) => c.type === type);

const ACT = 0.001;

export const CHALLENGES: Record<string, Challenge> = {
  light: {
    id: "light",
    title: "Light the LED",
    prompt: "Make the LED glow! 💡",
    emoji: "💡",
    check: (doc, sim) => onCount(doc, sim, "led") >= 1,
  },
  switchit: {
    id: "switchit",
    title: "Add a Switch",
    prompt: "Wire a switch so it turns the LED on. Flip it ON! 🎚️",
    emoji: "🎚️",
    check: (doc, sim) =>
      onCount(doc, sim, "led") >= 1 &&
      doc.components.some((c) => c.type === "switch" && Math.abs(sim.comp[c.id]?.current || 0) > ACT),
  },
  parallel: {
    id: "parallel",
    title: "Two Lights",
    prompt: "Light up TWO LEDs at the same time! 💡💡",
    emoji: "✨",
    check: (doc, sim) => onCount(doc, sim, "led") >= 2,
  },
  spin: {
    id: "spin",
    title: "Spin the Motor",
    prompt: "Make the motor spin! ⚙️",
    emoji: "⚙️",
    check: (doc, sim) => onCount(doc, sim, "motor") >= 1,
  },
  buzz: {
    id: "buzz",
    title: "Make it Buzz",
    prompt: "Make the buzzer ring! 🔔",
    emoji: "🔔",
    check: (doc, sim) => onCount(doc, sim, "buzzer") >= 1,
  },
  dim: {
    id: "dim",
    title: "Dim the Light",
    prompt: "Add a big resistor so the LED glows softly (not too bright). 🟫",
    emoji: "🟫",
    check: (doc, sim) =>
      has(doc, "resistor") &&
      doc.components.some((c) => c.type === "led" && sim.comp[c.id]?.on && (sim.comp[c.id]?.level || 0) < 0.45),
  },
};

export const CHALLENGE_ORDER = ["light", "switchit", "parallel", "spin", "buzz", "dim"];
