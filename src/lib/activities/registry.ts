import type { ActivityMeta, Band, SubjectId } from "./types";

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
    band: "explorer",
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
    hints: [
      "Look at where the robot starts and which way it's facing, then plan just the first move.",
      "See the staircase? A Forward, a turn, a Forward, a turn — that pattern repeats. That's a job for a Repeat loop!",
      "Try a Repeat ×5 of [Forward, Turn Left, Forward, Turn Right], then press Run.",
    ],
    realWorld:
      "Every app and game is built from step-by-step instructions like these. Giving a computer an exact sequence — and looping the parts that repeat — is the heart of all programming.",
    concepts: ["sequencing", "loops", "debugging"],
    grades: "2-6",
    difficulty: 1,
    estMinutes: 10,
    emoji: "🤖",
  },
  {
    id: "code-loops",
    subject: "coding",
    band: "explorer",
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
    hints: [
      "The target has a full top row and a full left column. Tackle one at a time.",
      "To paint a whole row, Repeat [Paint, Move Right]. To paint a column, Repeat [Paint, Move Down].",
      "Paint the top row with one loop, press Home to go back to the start, then paint the left column with a second loop.",
    ],
    realWorld:
      "Loops let one short instruction do a huge amount of work — it's how computers fill millions of pixels on your screen or zip through long lists in an instant.",
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
    band: "explorer",
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
    hints: [
      "Electricity needs a complete loop to flow — like a racetrack with no gaps.",
      "Place the battery (the power), the LED (the light) and a wire so they form one closed ring.",
      "Battery on top, LED on the right, wire on the left — close the loop, then flip the switch ON.",
    ],
    realWorld:
      "Every device you use — phone, torch, TV remote — works because electricity flows around a complete circuit. Break the loop anywhere and it switches off.",
    concepts: ["circuits", "current", "switches"],
    grades: "3-8",
    difficulty: 1,
    estMinutes: 10,
    emoji: "💡",
  },
  {
    id: "robo-linebot",
    subject: "robotics",
    band: "explorer",
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
    hints: [
      "The robot can only 'see' the line to its left, centre or right. Decide what it should do in each case.",
      "If the line drifts to the left, the robot should steer left to catch up to it again.",
      "Set Line-Left → Steer Left, Line-Centre → Go Straight, Line-Right → Steer Right, then Run.",
    ],
    realWorld:
      "This is exactly how self-driving cars and warehouse robots stay on track — sensors read the world and simple if-this-then-that rules decide every move.",
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
    band: "explorer",
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
    hints: [
      "The model can only learn from the examples YOU label — the more you label, the smarter it gets.",
      "Apples are red and round; bananas are yellow and long. Drop each example into the right bucket.",
      "Label all of the examples correctly, then press Train — accuracy climbs as your data grows.",
    ],
    realWorld:
      "This is how real AI learns — from labelled examples. Photo apps recognise faces and spam filters catch junk mail because people first showed them thousands of labelled examples.",
    concepts: ["training data", "classification", "accuracy"],
    grades: "4-9",
    difficulty: 2,
    estMinutes: 12,
    emoji: "🍎",
  },
  {
    id: "ai-weights",
    subject: "ai",
    band: "explorer",
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
    hints: [
      "The line splits the two groups of dots. Move the sliders to tilt and slide it.",
      "w1 tilts the line left/right, w2 tilts it up/down, and b slides it across the plane.",
      "Try w1 ≈ 1, w2 ≈ 1, b ≈ 0 so the line sits on the diagonal between the two colours.",
    ],
    realWorld:
      "Inside every AI is a 'neuron' that weighs its inputs to make a decision — exactly these sliders. Tuning millions of such weights is what 'training a neural network' really means.",
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
    band: "explorer",
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
    hints: [
      "Build it layer by layer, from the ground up — switch layers with the z0 / z1 / z2 tabs.",
      "Follow the faded ghost guide — it shows exactly where each cube belongs.",
      "It's a staircase: each step is one block taller than the last. Match the ghost, then press Check.",
    ],
    realWorld:
      "Video games, 3D printers and animated films all build their worlds out of 3D coordinates just like this — every object lives at an (x, y, z) point in space.",
    concepts: ["3D space", "coordinates", "construction"],
    grades: "3-8",
    difficulty: 2,
    estMinutes: 14,
    emoji: "🧱",
  },
  {
    id: "threed-transform",
    subject: "threed",
    band: "explorer",
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
    hints: [
      "Compare your orange shape to the faded ghost — which way is it rotated, and how big is it?",
      "Use Rotate to turn it, Scale to resize it, and Move to slide it into position.",
      "Match every axis to the ghost, then press Check match — it tells you what's still off.",
    ],
    realWorld:
      "Rotating, scaling and moving objects are the three core moves in every 3D tool — from designing game characters to engineering car parts to movie CGI.",
    concepts: ["transforms", "rotation", "scale"],
    grades: "5-10",
    difficulty: 3,
    estMinutes: 12,
    emoji: "🔷",
  },

  // ════════════════════════════════════════════════════════════
  //  JUNIORS — Class 1–3 (tap / match / sort, no reading needed)
  // ════════════════════════════════════════════════════════════

  // ── Coding ──────────────────────────────────────────────────
  {
    id: "j-code-path",
    subject: "coding",
    band: "junior",
    title: "Star Walk",
    blurb: "Tap arrow cards to walk the cub to the star.",
    objective: "Put moves in the right order to reach the goal — your very first program.",
    steps: ["Tap the arrow cards to add steps.", "Lead the cub all the way to the star.", "Tap Go to watch it walk!"],
    hints: ["Which way is the star — up, down, left or right?", "Add one arrow at a time and trace the path with your finger.", "Tap Go to see your steps come alive!"],
    realWorld: "Telling a computer the right steps in the right order is how every game and robot knows what to do.",
    concepts: ["sequencing", "directions"],
    grades: "1-3",
    difficulty: 1,
    estMinutes: 6,
    emoji: "🐾",
  },
  {
    id: "j-code-pattern",
    subject: "coding",
    band: "junior",
    title: "What Comes Next?",
    blurb: "Spot the pattern and tap what comes next.",
    objective: "Find the repeating pattern — the thinking behind loops and code.",
    steps: ["Look at the row of shapes.", "Work out the pattern.", "Tap the shape that comes next."],
    hints: ["Say the colours out loud: red, blue, red, blue…", "What should come after the last one?", "Patterns repeat — pick the one that keeps it going."],
    realWorld: "Computers love patterns — spotting and repeating them is how code does big jobs with tiny instructions.",
    concepts: ["patterns", "sequences"],
    grades: "1-3",
    difficulty: 1,
    estMinutes: 5,
    emoji: "🔵",
  },

  // ── Robotics ────────────────────────────────────────────────
  {
    id: "j-robo-light",
    subject: "robotics",
    band: "junior",
    title: "Make it Glow",
    blurb: "Connect the battery to the bulb to make it shine.",
    objective: "See that power must reach the bulb to light it — your very first circuit.",
    steps: ["Drag the wire to join the battery and the bulb.", "Watch the bulb light up.", "Tap the switch to turn it on!"],
    hints: ["The bulb needs power from the battery.", "Join them with the wire so they touch.", "Now flip the switch!"],
    realWorld: "Every light and toy needs power to flow from a battery — just like you connected here.",
    concepts: ["circuits", "cause and effect"],
    grades: "1-3",
    difficulty: 1,
    estMinutes: 5,
    emoji: "💡",
  },
  {
    id: "j-robo-build",
    subject: "robotics",
    band: "junior",
    title: "Build a Robot",
    blurb: "Drag the parts onto the robot to build it.",
    objective: "Match each part to its place — shapes and spaces, the start of building machines.",
    steps: ["Look at the robot's empty spots.", "Drag each part to where it fits.", "Finish the robot to win!"],
    hints: ["Wheels go at the bottom.", "Match each part's shape to its spot.", "One part at a time!"],
    realWorld: "Real robots are built from parts that each have a job — wheels to move, eyes to see, arms to grab.",
    concepts: ["matching", "parts"],
    grades: "1-3",
    difficulty: 1,
    estMinutes: 6,
    emoji: "🤖",
  },

  // ── AI ──────────────────────────────────────────────────────
  {
    id: "j-ai-sort",
    subject: "ai",
    band: "junior",
    title: "Sort the Animals",
    blurb: "Drag each animal into the right home — pets or wild.",
    objective: "Group things by what they share — how a computer learns to tell things apart.",
    steps: ["Look at each animal.", "Drag pets to the house and wild animals to the jungle.", "Sort them all to win!"],
    hints: ["Which animals live with people?", "Dogs and cats are pets; lions and tigers are wild.", "Drag each one to where it belongs."],
    realWorld: "Teaching a computer to put things into groups is the very first step of all artificial intelligence.",
    concepts: ["sorting", "classification"],
    grades: "1-3",
    difficulty: 1,
    estMinutes: 6,
    emoji: "🐶",
  },
  {
    id: "j-ai-odd",
    subject: "ai",
    band: "junior",
    title: "Odd One Out",
    blurb: "Tap the one that doesn't belong.",
    objective: "Notice what makes something different — how AI spots the odd thing out.",
    steps: ["Look at the whole group.", "Find the one that's different.", "Tap it!"],
    hints: ["Most of them are the same in one way.", "Which one breaks the rule?", "Tap the odd one out."],
    realWorld: "Spotting the thing that doesn't fit is how computers catch mistakes and find what's special.",
    concepts: ["observation", "classification"],
    grades: "1-3",
    difficulty: 1,
    estMinutes: 5,
    emoji: "🔎",
  },

  // ── 3D Modelling ────────────────────────────────────────────
  {
    id: "j-3d-stack",
    subject: "threed",
    band: "junior",
    title: "Block Tower",
    blurb: "Stack blocks to match the tower.",
    objective: "Build in 3D by counting and stacking — early spatial thinking.",
    steps: ["Look at the target tower.", "Tap to add blocks and build the same one.", "Match it to win!"],
    hints: ["Count the blocks in the target.", "Build yours just as tall.", "Same colours, same order!"],
    realWorld: "Stacking and counting blocks is how builders, games and 3D printers make big things from small pieces.",
    concepts: ["counting", "3D building"],
    grades: "1-3",
    difficulty: 1,
    estMinutes: 6,
    emoji: "🧱",
  },
  {
    id: "j-3d-spin",
    subject: "threed",
    band: "junior",
    title: "Spin to Match",
    blurb: "Spin the arrow to point the same way as the target.",
    objective: "Turn a shape to match — your first taste of rotation in 3D.",
    steps: ["See which way the target points.", "Tap to spin your arrow.", "Match the direction to win!"],
    hints: ["Which way is the faded arrow pointing?", "Tap to turn yours a quarter at a time.", "Stop when they match!"],
    realWorld: "Turning things to face the right way is something every video game and robot does all the time.",
    concepts: ["rotation", "direction"],
    grades: "1-3",
    difficulty: 1,
    estMinutes: 5,
    emoji: "🧭",
  },

  // ════════════════════════════════════════════════════════════
  //  GRADE 1 — "Think, Build, Play" (curriculum 2026–27)
  //  Each project from the yearly planner as a tap/drag lab.
  // ════════════════════════════════════════════════════════════
  {
    id: "g1-robot-buddy",
    subject: "robotics",
    band: "junior",
    grade: 1,
    month: "May",
    projectNo: 1,
    title: "Robot Buddy",
    blurb: "Drag the parts onto your robot, then make its arm wave!",
    objective: "A robot is built from parts that each do a job — place them, then bring one to life.",
    steps: ["Drag each part to the right spot on the robot.", "Fill every empty slot.", "Tap the arm to make your robot wave!"],
    hints: ["The head goes on top, wheels go at the bottom.", "Match each part's shape to its empty slot.", "Once it's built, tap the arm to wave hello!"],
    realWorld: "Real robots are made of parts — a head to sense, a body to hold things together, and arms or wheels to move. You just built one!",
    concepts: ["parts of a robot", "matching", "movement"],
    grades: "1",
    difficulty: 1,
    estMinutes: 7,
    emoji: "🤖",
  },
  {
    id: "g1-traffic-light",
    subject: "coding",
    band: "junior",
    grade: 1,
    month: "July",
    projectNo: 2,
    title: "Traffic Light Sequence",
    blurb: "Put the lights in the right order, then run the signal.",
    objective: "Order matters! Put the lights in the right sequence — the heart of every program.",
    steps: ["Drag the light cards into the program strip.", "Put them in the order a real signal uses.", "Tap Go to watch the cars stop and go!"],
    hints: ["What colour tells cars to STOP? What says GO?", "The cycle is Red, then Green, then Yellow, then back to Red.", "Fill the strip in that order, then press Go!"],
    realWorld: "Traffic lights follow a set order, over and over. Telling a computer the right steps in the right order is exactly how coding works.",
    concepts: ["sequencing", "order", "patterns"],
    grades: "1",
    difficulty: 1,
    estMinutes: 7,
    emoji: "🚦",
  },
  {
    id: "g1-paper-circuit",
    subject: "robotics",
    band: "junior",
    grade: 1,
    month: "August",
    projectNo: 3,
    title: "Paper Circuit Card",
    blurb: "Lay the shiny tape from battery to light and watch it glow.",
    objective: "Electricity needs a full path with no gaps — make a complete loop to light your card.",
    steps: ["Tap the tape tiles to build a path.", "Connect the battery all the way to the light.", "Close the loop to make it glow!"],
    hints: ["The light needs power from the battery.", "Fill in every gap so the tape makes one full path.", "No gaps allowed — finish the loop and it shines!"],
    realWorld: "A paper circuit is a real working circuit. Greeting cards that light up use exactly this — copper tape carrying power from a battery to an LED.",
    concepts: ["circuits", "conductors", "paths"],
    grades: "1",
    difficulty: 1,
    estMinutes: 7,
    emoji: "💡",
  },
  {
    id: "g1-windmill",
    subject: "robotics",
    band: "junior",
    grade: 1,
    month: "September",
    projectNo: 4,
    title: "Windmill Power",
    blurb: "Tilt the blades just right, then blow the wind to spin it!",
    objective: "Angled blades catch the wind and spin — turning moving air into useful power.",
    steps: ["Set the blade angle with the slider.", "Turn on the wind.", "Spin fast enough to light the bulb!"],
    hints: ["Flat blades barely catch any wind.", "Tilt the blades so the wind can push them around.", "Find the angle that makes them spin the fastest!"],
    realWorld: "Wind turbines tilt their blades to catch the most wind. The spinning turns a motor that makes electricity for whole towns.",
    concepts: ["energy", "motion", "simple machines"],
    grades: "1",
    difficulty: 1,
    estMinutes: 7,
    emoji: "🌬️",
  },
  {
    id: "g1-smart-house",
    subject: "threed",
    band: "junior",
    grade: 1,
    month: "October",
    projectNo: 5,
    title: "Build a Smart House",
    blurb: "Stack the walls and roof, then switch on a smart light.",
    objective: "Build a house in space from its pieces, then add one smart feature that turns on.",
    steps: ["Drag the walls and roof into place.", "Build a house that stands up.", "Add a light and tap the switch to make it smart!"],
    hints: ["Walls go up first, the roof goes on top.", "Match each piece to its faded outline.", "Once it's built, switch the light on!"],
    realWorld: "A smart home has features that switch on by themselves. Architects build houses piece by piece — just like you did — then add the tech inside.",
    concepts: ["3D building", "structures", "systems"],
    grades: "1",
    difficulty: 1,
    estMinutes: 8,
    emoji: "🏠",
  },
  {
    id: "g1-pattern-art",
    subject: "coding",
    band: "junior",
    grade: 1,
    month: "November",
    projectNo: 6,
    title: "Pattern Maker",
    blurb: "Spot the repeating pattern and tap what comes next.",
    objective: "Find the rule a pattern repeats — the same thinking that powers loops in code.",
    steps: ["Look at the row of shapes.", "Work out the repeating rule.", "Tap the tiles to continue the pattern!"],
    hints: ["Say the colours out loud: red, blue, red, blue…", "What should come after the last shape?", "Keep the pattern going to the end!"],
    realWorld: "Computers love patterns. Spotting a repeating rule and continuing it is how code does huge jobs with tiny instructions — that's a loop!",
    concepts: ["patterns", "sequences", "loops"],
    grades: "1",
    difficulty: 1,
    estMinutes: 6,
    emoji: "🎨",
  },
  {
    id: "g1-maze",
    subject: "coding",
    band: "junior",
    grade: 1,
    month: "December",
    projectNo: 7,
    title: "Maze Runner",
    blurb: "Tap arrow cards to guide your friend to the finish.",
    objective: "Plan a path of moves to reach the goal — your first real problem-solving program.",
    steps: ["Tap arrow cards to plan the path.", "Lead your friend all the way to the flag.", "Tap Go to watch it run!"],
    hints: ["Which way is the flag — up, down, left or right?", "Add one arrow at a time and trace the path.", "Avoid the walls and reach the finish!"],
    realWorld: "Finding a path through a maze is like solving a problem step by step. Robots and game characters plan their moves this very same way.",
    concepts: ["sequencing", "logic", "problem solving"],
    grades: "1",
    difficulty: 1,
    estMinutes: 8,
    emoji: "🌀",
  },
  {
    id: "g1-pulley",
    subject: "robotics",
    band: "junior",
    grade: 1,
    month: "Jan (I)",
    projectNo: 8,
    title: "Pulley Lifter",
    blurb: "Pull the rope down to lift the basket up high.",
    objective: "A pulley changes the direction of your pull — pull down to lift a load up.",
    steps: ["Grab the rope and pull it down.", "Watch the basket rise on the other side.", "Lift it all the way to the top!"],
    hints: ["The rope goes over the wheel at the top.", "When you pull one side down, the other side goes up.", "Keep pulling until the basket reaches the top!"],
    realWorld: "Pulleys help us lift heavy things easily — cranes, flagpoles and lifts all use a wheel and rope exactly like this one.",
    concepts: ["simple machines", "force", "direction"],
    grades: "1",
    difficulty: 1,
    estMinutes: 6,
    emoji: "🏗️",
  },
  {
    id: "g1-animal-robot",
    subject: "robotics",
    band: "junior",
    grade: 1,
    month: "Jan (II)",
    projectNo: 9,
    title: "Animal Robot",
    blurb: "Build an animal robot, then add a motor to make it move!",
    objective: "Nature inspires machines — build an animal and bring one part to life with a motor.",
    steps: ["Pick an animal and add its body parts.", "Attach a motor to a moving part.", "Switch it on to make it flap or wag!"],
    hints: ["Birds have wings, fish have tails — add the right parts.", "Put the motor on the part that should move.", "Turn it on and watch your animal come alive!"],
    realWorld: "Engineers copy nature — drones learned to fly from dragonflies! Building an animal robot that moves is the start of that idea, called biomimicry.",
    concepts: ["biomimicry", "movement", "motors"],
    grades: "1",
    difficulty: 1,
    estMinutes: 8,
    emoji: "🦋",
  },
  {
    id: "g1-machine-book",
    subject: "ai",
    band: "junior",
    grade: 1,
    month: "February",
    projectNo: 10,
    title: "My Machine Book",
    blurb: "Match each project from the year to what it does.",
    objective: "Sort the year's builds into groups by what they do — how a computer learns to classify.",
    steps: ["Look at each project card.", "Drag it to the page it belongs on.", "Match them all to finish your book!"],
    hints: ["Which builds light up? Which ones move?", "Robots and cars MOVE; lights and circuits GLOW.", "Drag each card to the matching page."],
    realWorld: "Putting things into groups by what they do is called classifying — and it's the very first thing every artificial intelligence learns to do.",
    concepts: ["classification", "sorting", "review"],
    grades: "1",
    difficulty: 1,
    estMinutes: 7,
    emoji: "📔",
  },
];

export const ACTIVITY_IDS = ACTIVITIES.map((a) => a.id);

export function getActivityMeta(id: string): ActivityMeta | undefined {
  return ACTIVITIES.find((a) => a.id === id);
}

export function activitiesBySubject(subject: SubjectId): ActivityMeta[] {
  return ACTIVITIES.filter((a) => a.subject === subject);
}

export function activitiesBySubjectAndBand(subject: SubjectId, band: Band): ActivityMeta[] {
  return ACTIVITIES.filter((a) => a.subject === subject && a.band === band);
}

export function activitiesByBand(band: Band): ActivityMeta[] {
  return ACTIVITIES.filter((a) => a.band === band);
}

export function bandHasContent(band: Band): boolean {
  return ACTIVITIES.some((a) => a.band === band);
}

/** Activities tied to a specific curriculum grade (1–10), in project order. */
export function activitiesByGrade(grade: number): ActivityMeta[] {
  return ACTIVITIES.filter((a) => a.grade === grade).sort(
    (a, b) => (a.projectNo ?? 0) - (b.projectNo ?? 0),
  );
}

/** Sorted list of grades (1–10) that currently have curriculum labs built. */
export function gradesWithContent(): number[] {
  const set = new Set<number>();
  for (const a of ACTIVITIES) if (typeof a.grade === "number") set.add(a.grade);
  return [...set].sort((x, y) => x - y);
}
