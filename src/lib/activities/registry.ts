import type { ActivityMeta, SubjectId } from "./types";

/**
 * Metadata for every activity. This is plain data (server-safe) so route
 * pages can list/sort activities without pulling in the client-only
 * component bundles. The actual interactive components are wired in
 * `componentMap.ts` and loaded lazily, client-side only.
 */
export const ACTIVITIES: ActivityMeta[] = [
  // ── Coding ──────────────────────────────────────────────────
  {
    id: "code-maze",
    subject: "coding",
    title: "Robot Runner",
    blurb: "Stack commands to drive a robot through a maze to its battery.",
    objective:
      "Plan a sequence of moves and turns to navigate a grid — the core idea behind every program.",
    steps: [
      "Add command blocks (Forward, Turn Left, Turn Right) to the program strip.",
      "Use a Repeat block to avoid stacking the same move many times.",
      "Press Run to watch the robot follow your program step by step.",
      "Reach the battery without hitting a wall to pass.",
    ],
    concepts: ["sequencing", "loops", "debugging"],
    grades: "2-6",
    difficulty: 1,
    estMinutes: 10,
    emoji: "🤖",
  },
  {
    id: "code-loops",
    subject: "coding",
    title: "Loop Painter",
    blurb: "Use loops to paint a pixel pattern that matches the target.",
    objective:
      "Discover how a loop repeats work — recreate a picture with as few commands as possible.",
    steps: [
      "Read the target pattern shown on the right.",
      "Add paint and move commands, then wrap repeated ones in a Repeat loop.",
      "Run your program to paint the grid.",
      "Match every pixel of the target to pass.",
    ],
    concepts: ["loops", "patterns", "efficiency"],
    grades: "3-7",
    difficulty: 2,
    estMinutes: 12,
    emoji: "🎨",
  },

  // ── Robotics ────────────────────────────────────────────────
  {
    id: "robo-circuit",
    subject: "robotics",
    title: "Light the LED",
    blurb: "Drag a battery, switch and LED onto the board to close the circuit.",
    objective:
      "Build a complete electrical loop and learn why current needs a full path to flow.",
    steps: [
      "Drag components onto the board and connect them in a loop.",
      "Make sure the battery, switch and LED all sit on one closed path.",
      "Flip the switch — a complete circuit lights the LED.",
      "Light the LED to pass.",
    ],
    concepts: ["circuits", "current", "switches"],
    grades: "3-8",
    difficulty: 1,
    estMinutes: 10,
    emoji: "💡",
  },
  {
    id: "robo-linebot",
    subject: "robotics",
    title: "Line Follower",
    blurb: "Program sensor rules so a robot follows the track on its own.",
    objective:
      "Map sensor readings to motor actions — the if-this-then-that logic that drives real robots.",
    steps: [
      "Set a rule for each sensor state (line on left / right / centre).",
      "Choose which way the robot turns for each case.",
      "Run the simulation and watch the bot drive the track.",
      "Complete a full lap to pass.",
    ],
    concepts: ["sensors", "conditionals", "control loops"],
    grades: "5-10",
    difficulty: 3,
    estMinutes: 15,
    emoji: "🛤️",
  },

  // ── AI ──────────────────────────────────────────────────────
  {
    id: "ai-sorter",
    subject: "ai",
    title: "Train the Sorter",
    blurb: "Give labelled examples and teach a model to sort fruit by itself.",
    objective:
      "See how a model learns from examples — and why more (and better) data raises accuracy.",
    steps: [
      "Drag each example into the correct bucket to label your training data.",
      "Press Train, then run the model on new, unseen fruit.",
      "Add more examples if the accuracy is too low.",
      "Reach the target accuracy to pass.",
    ],
    concepts: ["training data", "classification", "accuracy"],
    grades: "4-9",
    difficulty: 2,
    estMinutes: 12,
    emoji: "🍎",
  },
  {
    id: "ai-weights",
    subject: "ai",
    title: "Tune the Brain",
    blurb: "Adjust weights to draw a line that separates two groups of dots.",
    objective:
      "Feel how a simple AI 'neuron' weighs inputs — move sliders to shift its decision boundary.",
    steps: [
      "Look at the two coloured groups of points.",
      "Drag the weight and bias sliders to move the dividing line.",
      "Separate the groups so every point lands on the right side.",
      "Classify all points correctly to pass.",
    ],
    concepts: ["weights", "decision boundary", "perceptron"],
    grades: "6-10",
    difficulty: 3,
    estMinutes: 12,
    emoji: "🧠",
  },

  // ── 3D Modelling ────────────────────────────────────────────
  {
    id: "threed-voxel",
    subject: "threed",
    title: "Voxel Builder",
    blurb: "Stack cubes in 3D space to match the target structure.",
    objective:
      "Build in three dimensions — add and remove voxels to recreate a shape from a blueprint.",
    steps: [
      "Click a face to add a cube; shift-click to remove one.",
      "Rotate the view to see all sides of your model.",
      "Match the target blueprint, cube for cube.",
      "Recreate the structure exactly to pass.",
    ],
    concepts: ["3D space", "coordinates", "construction"],
    grades: "3-8",
    difficulty: 2,
    estMinutes: 14,
    emoji: "🧱",
  },
  {
    id: "threed-transform",
    subject: "threed",
    title: "Transformer",
    blurb: "Rotate, scale and move a shape until it matches the ghost target.",
    objective:
      "Master the three core 3D transforms — translate, rotate and scale — used in every 3D tool.",
    steps: [
      "Compare your shape with the faded target outline.",
      "Use the transform controls to rotate, scale and move it.",
      "Line your shape up with the target in all axes.",
      "Match the target pose to pass.",
    ],
    concepts: ["transforms", "rotation", "scale"],
    grades: "5-10",
    difficulty: 3,
    estMinutes: 12,
    emoji: "🔷",
  },
];

export const ACTIVITY_IDS = ACTIVITIES.map((a) => a.id);

export function getActivityMeta(id: string): ActivityMeta | undefined {
  return ACTIVITIES.find((a) => a.id === id);
}

export function activitiesBySubject(subject: SubjectId): ActivityMeta[] {
  return ACTIVITIES.filter((a) => a.subject === subject);
}
