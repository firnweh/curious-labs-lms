"use client";

import { useMemo, useState } from "react";

/**
 * AI Lab — "Spot the Mistake" (Computer Vision).
 *
 * A kid-facing playground that reveals WHY an AI eye gets things wrong. Four
 * scenes show the AI's confident-but-wrong guess next to the true answer. For
 * each, the child picks the REASON the AI slipped up from a row of chips.
 * Correct → ✓ + a one-line "because…". Wrong → a gentle wobble + hint (never a
 * scold). A tiny low-res pixel grid drives home the big idea: the AI never sees
 * a dog or a cat — only a tiny mosaic of colored squares.
 *
 * Self-contained, deterministic (no random, no dates). Pure React + divs/SVG.
 */

const ACCENT = "#22d3ee";

type ReasonId = "dark" | "busy" | "fewex" | "lookalike" | "label";

interface Reason {
  id: ReasonId;
  short: string;
}

const REASONS: Reason[] = [
  { id: "dark", short: "too dark / bad light" },
  { id: "busy", short: "busy background" },
  { id: "fewex", short: "not enough examples" },
  { id: "lookalike", short: "looks like something else" },
  { id: "label", short: "wrong label" },
];

interface Scene {
  emoji: string;
  bg: string; // backdrop tint for the scene tile
  truth: string;
  aiGuess: string;
  answer: ReasonId;
  why: string;
  // 5×5 low-res "what the AI sees" mosaic — fixed hex per cell (deterministic).
  px: string[];
}

// Tiny palettes built by hand so every grid is deterministic and on-theme.
const SCENES: Scene[] = [
  {
    emoji: "🐕",
    bg: "#0b1220",
    truth: "a white dog in the snow",
    aiGuess: "“just snow”",
    answer: "busy",
    why: "The white dog blends into the white snow, so the AI loses its edges.",
    px: [
      "#e8eefc", "#e8eefc", "#dfe7f7", "#e8eefc", "#e8eefc",
      "#e8eefc", "#f3f6ff", "#f3f6ff", "#e2eaf9", "#e8eefc",
      "#dfe7f7", "#f3f6ff", "#eef2fc", "#f3f6ff", "#e8eefc",
      "#e8eefc", "#e2eaf9", "#f3f6ff", "#e8eefc", "#dfe7f7",
      "#e8eefc", "#e8eefc", "#e8eefc", "#dfe7f7", "#e8eefc",
    ],
  },
  {
    emoji: "🐈‍⬛",
    bg: "#070a12",
    truth: "a black cat in a shadow",
    aiGuess: "“nothing there”",
    answer: "dark",
    why: "In the dark the black cat and the shadow are the same color — no light, no clues.",
    px: [
      "#0a0e16", "#0a0e16", "#0c111b", "#0a0e16", "#0a0e16",
      "#0a0e16", "#10141f", "#10141f", "#0c111b", "#0a0e16",
      "#0c111b", "#10141f", "#141a26", "#10141f", "#0a0e16",
      "#0a0e16", "#0c111b", "#10141f", "#0a0e16", "#0c111b",
      "#0a0e16", "#0a0e16", "#0a0e16", "#0c111b", "#0a0e16",
    ],
  },
  {
    emoji: "🧸🚗",
    bg: "#1a1018",
    truth: "a tiny toy car",
    aiGuess: "“a real car”",
    answer: "lookalike",
    why: "A toy car has the same shape as a real one — the AI can't tell how big it really is.",
    px: [
      "#1c2230", "#1c2230", "#ef4444", "#ef4444", "#1c2230",
      "#1c2230", "#ef4444", "#fb7185", "#ef4444", "#ef4444",
      "#ef4444", "#fb7185", "#fb7185", "#fb7185", "#ef4444",
      "#1c2230", "#222a3a", "#222a3a", "#222a3a", "#1c2230",
      "#1c2230", "#141a26", "#1c2230", "#141a26", "#1c2230",
    ],
  },
  {
    emoji: "✍️1",
    bg: "#0e1622",
    truth: "a handwritten “1”",
    aiGuess: "“a 7”",
    answer: "fewex",
    why: "The AI never saw enough wonky 1s, so a slanted one looks like a 7 to it.",
    px: [
      "#0b1018", "#0b1018", "#eab308", "#0b1018", "#0b1018",
      "#0b1018", "#eab308", "#fde047", "#0b1018", "#0b1018",
      "#0b1018", "#0b1018", "#eab308", "#0b1018", "#0b1018",
      "#0b1018", "#0b1018", "#eab308", "#0b1018", "#0b1018",
      "#0b1018", "#eab308", "#eab308", "#eab308", "#0b1018",
    ],
  },
];

export default function SpotTheMistake() {
  // Per-scene state: chosen reason, whether it's solved, and a wobble pulse.
  const [picks, setPicks] = useState<(ReasonId | null)[]>(SCENES.map(() => null));
  const [solved, setSolved] = useState<boolean[]>(SCENES.map(() => false));
  const [wobble, setWobble] = useState<number[]>(SCENES.map(() => 0));

  const solvedCount = solved.filter(Boolean).length;
  const allSolved = solvedCount === SCENES.length;

  const choose = (sceneIdx: number, rid: ReasonId) => {
    if (solved[sceneIdx]) return; // already cracked — leave it be
    const correct = rid === SCENES[sceneIdx].answer;
    setPicks((p) => p.map((v, i) => (i === sceneIdx ? rid : v)));
    if (correct) {
      setSolved((s) => s.map((v, i) => (i === sceneIdx ? true : v)));
    } else {
      // gentle wobble nudge, never a scold
      setWobble((w) => w.map((v, i) => (i === sceneIdx ? v + 1 : v)));
    }
  };

  const caption = useMemo(() => {
    if (allSolved)
      return "💡 Aha! The AI never really sees a dog or a cat — only a tiny grid of colored squares. Bad light, busy backgrounds, look-alikes, and too-few examples are exactly when those squares trick it.";
    if (solvedCount === 0)
      return "👀 The AI looked at each picture and guessed WRONG. Tap the reason you think fooled it.";
    const lastWrong = picks.some((p, i) => p !== null && !solved[i]);
    if (lastWrong)
      return `🤔 Not quite — look again at the picture and the tiny pixel grid. (${solvedCount}/${SCENES.length} solved)`;
    return `✓ Nice — you found the AI's blind spot! Keep going. (${solvedCount}/${SCENES.length} solved)`;
  }, [allSolved, solvedCount, picks, solved]);

  return (
    <div className="w-full" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <style>{`@keyframes vis-wobble{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}`}</style>

      {/* Header row */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
        <span aria-hidden style={{ fontSize: 24 }}>👀</span>
        <h2 className="font-mono text-base font-semibold tracking-wide">Spot the Mistake</h2>
        <span
          className="rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold"
          style={{ background: `${ACCENT}1a`, color: ACCENT, border: `1px solid ${ACCENT}55` }}
        >
          Grades 5–8
        </span>
        <span className="font-mono text-[11px] text-[#9fb0d0]">· Computer vision</span>
        <span className="ml-auto font-mono text-[11px] text-[#5b6b8c]">
          {solvedCount}/{SCENES.length} cracked
        </span>
      </div>

      {/* Teaching caption — updates as the child interacts, ends on an aha */}
      <p
        aria-live="polite"
        className="mb-4 rounded-xl border px-3 py-2 font-mono text-[11px] leading-relaxed"
        style={{
          borderColor: allSolved ? `${ACCENT}55` : "#1e2738",
          background: allSolved ? `${ACCENT}14` : "#0f1420",
          color: allSolved ? ACCENT : "#9fb0d0",
        }}
      >
        {caption}
      </p>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {SCENES.map((scene, i) => {
          const done = solved[i];
          const pick = picks[i];
          const wrongPick = pick !== null && !done;
          return (
            <div
              key={scene.truth}
              className="rounded-2xl border p-3"
              style={{
                borderColor: done ? `${ACCENT}88` : "#1e2738",
                background: "#0f1420",
                animation: wobble[i] && wrongPick ? "vis-wobble 0.32s ease" : undefined,
              }}
            >
              {/* Scene + what the AI sees */}
              <div className="flex items-stretch gap-3">
                {/* The "real" scene */}
                <div
                  className="flex h-[92px] w-[92px] shrink-0 items-center justify-center rounded-xl border border-[#1e2738]"
                  style={{ background: scene.bg, fontSize: 40 }}
                  aria-label={scene.truth}
                >
                  <span aria-hidden>{scene.emoji}</span>
                </div>

                {/* What the AI sees: low-res pixel grid */}
                <div className="flex flex-col items-center justify-center">
                  <div
                    className="grid gap-px overflow-hidden rounded-md border border-[#1e2738]"
                    style={{ gridTemplateColumns: "repeat(5, 14px)", background: "#1e2738" }}
                    aria-hidden
                  >
                    {scene.px.map((hex, c) => (
                      <div key={c} style={{ width: 14, height: 14, background: hex }} />
                    ))}
                  </div>
                  <span className="mt-1 font-mono text-[8px] text-[#5b6b8c]">what the AI sees</span>
                </div>

                {/* Truth vs guess */}
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                  <p className="font-mono text-[10px] text-[#5b6b8c]">
                    Really: <span className="text-[#e8eefc]">{scene.truth}</span>
                  </p>
                  <p className="font-mono text-[10px] text-[#5b6b8c]">
                    AI said: <span style={{ color: "#fb7185" }}>{scene.aiGuess}</span>
                  </p>
                </div>
              </div>

              {/* Reason chips */}
              <p className="mb-1.5 mt-3 font-mono text-[9px] tracking-wide text-[#5b6b8c]">
                WHY DID IT SLIP UP?
              </p>
              <div className="flex flex-wrap gap-1.5">
                {REASONS.map((r) => {
                  const isAnswer = r.id === scene.answer;
                  const chosen = pick === r.id;
                  const showRight = done && isAnswer;
                  const showWrong = wrongPick && chosen;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      disabled={done}
                      onClick={() => choose(i, r.id)}
                      className="rounded-xl border-2 px-2.5 py-1.5 font-mono text-[10px] transition-colors disabled:cursor-default"
                      style={{
                        borderColor: showRight
                          ? ACCENT
                          : showWrong
                            ? "#fb7185"
                            : "#1e2738",
                        background: showRight
                          ? `${ACCENT}1a`
                          : showWrong
                            ? "#fb71851a"
                            : "transparent",
                        color: showRight ? ACCENT : showWrong ? "#fb7185" : "#9fb0d0",
                        opacity: done && !isAnswer ? 0.4 : 1,
                      }}
                    >
                      {showRight ? "✓ " : ""}
                      {r.short}
                    </button>
                  );
                })}
              </div>

              {/* Explanation / hint line */}
              <div className="mt-2 min-h-[16px]">
                {done ? (
                  <p className="font-mono text-[10px] leading-relaxed" style={{ color: ACCENT }}>
                    {scene.why}
                  </p>
                ) : wrongPick ? (
                  <p className="font-mono text-[10px] text-[#eab308]">
                    Not quite — try another reason. Peek at the pixel grid for a clue.
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Big idea footer */}
      <p className="mt-4 rounded-xl border border-[#1e2738] bg-[#0b1018] p-3 font-mono text-[10px] leading-relaxed text-[#5b6b8c]">
        Computer vision turns every photo into a grid of pixels, then guesses from
        patterns it learned from <span style={{ color: ACCENT }}>examples</span>. When the
        light is bad, the background is busy, things look alike, or it never saw enough
        examples, those guesses go wrong. That&apos;s called{" "}
        <span style={{ color: ACCENT }}>vision bias</span>.
      </p>
    </div>
  );
}
