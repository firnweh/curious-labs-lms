import type { ComponentType } from "react";

export type SubjectId = "coding" | "robotics" | "ai" | "threed";

/** Grade band — sets the cognitive / problem-solving level of a lab.
 *  junior = Class 1-3, explorer = Class 4-6, innovator = Class 7-10. */
export type Band = "junior" | "explorer" | "innovator";

/** Result an activity reports back when the learner's attempt is graded. */
export interface ActivityResult {
  passed: boolean;
  /** Optional richer score, 1–3 stars. Defaults to 3 when passed. */
  stars?: 1 | 2 | 3;
  /** Optional short message shown on the success/failure toast. */
  detail?: string;
}

/**
 * The ONE contract every hands-on activity implements.
 * An activity is a self-contained client component that owns its own
 * interaction + auto-grading and reports the outcome through `onComplete`.
 * It receives nothing else — no router, no store — so each can be built,
 * tested and reasoned about in isolation.
 */
export interface ActivityProps {
  onComplete: (result: ActivityResult) => void;
}

export type ActivityComponent = ComponentType<ActivityProps>;

export interface ActivityMeta {
  id: string;
  subject: SubjectId;
  /** Grade band this lab is pitched for. */
  band: Band;
  title: string;
  /** One-line hook shown on cards. */
  blurb: string;
  /** What the learner does + the concept it teaches. */
  objective: string;
  /** Plain-language steps shown in the lab instructions panel. */
  steps: string[];
  /** Progressive Socratic hints, revealed one at a time. Never the answer. */
  hints: string[];
  /** "How it works" — connects the lab to real-world technology. */
  realWorld: string;
  /** Concept tags, e.g. ["loops", "sequencing"]. */
  concepts: string[];
  grades: string; // e.g. "3-6"
  difficulty: 1 | 2 | 3;
  estMinutes: number;
  emoji: string;
}
