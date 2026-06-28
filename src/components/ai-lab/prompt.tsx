"use client";

import { useMemo, useState } from "react";

/**
 * Prompt Lab — a hands-on Generative-AI playground (Grades 6-10).
 *
 * Two parts in one screen:
 *  1) PROMPT BUILDER — start from a vague prompt and toggle structure chips
 *     (role / task / audience / format / constraint). The structured prompt
 *     assembles live, a quality meter rises with structure, and a canned
 *     WEAK-vs-STRONG sample output shows that structure changes the answer.
 *  2) HALLUCINATION HUNT — the AI states 5 confident "facts" about the Moon.
 *     Some are true, some false, some unverifiable. The child tags each, then
 *     reveals the truth: generative AI invents confident-but-wrong facts, so
 *     always verify.
 *
 * Self-contained, deterministic, no deps. Pure React + divs.
 */

const ACCENT = "#34d399";

type ChipKey = "role" | "task" | "audience" | "format" | "constraint";

interface Chip {
  key: ChipKey;
  label: string;
  emoji: string;
  text: string;
  hint: string;
}

// The five structure pieces, in the order they read best in a prompt.
const CHIPS: Chip[] = [
  { key: "role", label: "Role", emoji: "🎭", text: "Act as a friendly teacher.", hint: "who the AI should be" },
  { key: "task", label: "Task", emoji: "🎯", text: "Explain why the Moon changes shape.", hint: "the exact job" },
  { key: "audience", label: "Audience", emoji: "👧", text: "Write it for a Grade 6 student.", hint: "who will read it" },
  { key: "format", label: "Format", emoji: "📋", text: "Use 3 short bullet points.", hint: "the shape of the answer" },
  { key: "constraint", label: "Limits", emoji: "🚧", text: "Use one analogy and avoid hard physics.", hint: "rules to follow" },
];

const BASE_PROMPT = "Write about space.";

// Canned outputs — deterministic, picked by how much structure is on.
const WEAK_OUTPUT =
  "Space is very big. It has stars, planets, and the Moon. The Moon is in the sky. Space is interesting and there is a lot to learn about it.";
const STRONG_OUTPUT =
  "Here you go! 🌙\n• The Moon doesn't make its own light — the Sun lights up one side of it.\n• As the Moon orbits Earth, we see different amounts of that lit side — like turning a half-painted ball in your hand.\n• Those changing views are the Moon's phases, from a thin crescent to a full circle.";

type Verdict = "trust" | "check" | "false";

interface Claim {
  id: number;
  text: string;
  truth: Verdict;
  why: string;
}

// 5 confident "facts" — mix of true / false / unverifiable.
const CLAIMS: Claim[] = [
  { id: 1, text: "The Moon orbits the Earth about once a month.", truth: "trust", why: "True — about every 27 days. Easy to verify in any science book." },
  { id: 2, text: "Astronauts planted a flag on the Moon in 1969.", truth: "trust", why: "True — Apollo 11 landed in July 1969. Verifiable history." },
  { id: 3, text: "The Moon is made mostly of soft green cheese.", truth: "false", why: "False! A famous old joke. The Moon is rock and dust — the AI sounded sure but was wrong." },
  { id: 4, text: "The far side of the Moon is always pitch dark.", truth: "false", why: "False — it gets sunlight too. We just never see it from Earth. 'Dark side' is a myth." },
  { id: 5, text: "Exactly 1,037 secret tunnels run under the Moon's surface.", truth: "check", why: "Made-up number with no source. Confident but unverifiable — a classic hallucination." },
];

const VERDICTS: { key: Verdict; label: string; emoji: string; color: string }[] = [
  { key: "trust", label: "Trust", emoji: "✓", color: ACCENT },
  { key: "check", label: "Check it", emoji: "⚠️", color: "#eab308" },
  { key: "false", label: "False", emoji: "✗", color: "#fb7185" },
];

export default function PromptLab() {
  const [on, setOn] = useState<Record<ChipKey, boolean>>({
    role: false, task: false, audience: false, format: false, constraint: false,
  });
  const [tags, setTags] = useState<Record<number, Verdict>>({});
  const [revealed, setRevealed] = useState(false);
  const [wobble, setWobble] = useState(false);

  const activeCount = useMemo(() => Object.values(on).filter(Boolean).length, [on]);
  const quality = Math.round((activeCount / CHIPS.length) * 100);
  const strong = activeCount >= 3;

  // Assemble the live structured prompt from base + active chips (in order).
  const assembled = useMemo(() => {
    const parts = CHIPS.filter((c) => on[c.key]).map((c) => c.text);
    return [BASE_PROMPT, ...parts].join(" ");
  }, [on]);

  const toggle = (k: ChipKey) =>
    setOn((p) => ({ ...p, [k]: !p[k] }));

  const tagClaim = (id: number, v: Verdict) =>
    setTags((p) => ({ ...p, [id]: v }));

  const allTagged = CLAIMS.every((c) => tags[c.id] !== undefined);
  const correctCount = CLAIMS.filter((c) => tags[c.id] === c.truth).length;

  const tryReveal = () => {
    if (!allTagged) {
      setWobble(true);
      window.setTimeout(() => setWobble(false), 500);
      return;
    }
    setRevealed(true);
  };

  // Teaching caption — narrates progress and lands on an "aha".
  const caption = revealed
    ? `🔎 You spotted ${correctCount}/${CLAIMS.length}. Aha — generative AI can sound 100% confident and still be wrong. It predicts likely words, it doesn't "know" facts. Always verify!`
    : activeCount === 0
      ? "✨ A vague prompt gives a vague answer. Add structure chips below to aim the AI."
      : strong
        ? `💪 ${activeCount} pieces of structure — now the AI knows the role, task, reader, and shape. Structure makes the answer sharper!`
        : `🧩 ${activeCount} piece${activeCount > 1 ? "s" : ""} added. Keep going — role + task + audience + format + limits = a strong prompt.`;

  return (
    <div className="w-full" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-2 px-1 pb-3">
        <span aria-hidden style={{ fontSize: 24 }}>✨</span>
        <span className="text-base font-semibold tracking-wide">Prompt Lab</span>
        <span
          className="rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold"
          style={{ background: `${ACCENT}1a`, color: ACCENT, border: `1px solid ${ACCENT}55` }}
        >
          Grades 6-10
        </span>
        <span className="font-mono text-[11px] text-[#5b6b8c]">· Generative AI</span>
      </div>
      <p
        aria-live="polite"
        className="mb-4 rounded-xl border px-3 py-2 font-mono text-[11px] leading-relaxed"
        style={{ background: "#0f1420", borderColor: "#1e2738", color: "#9fb0d0" }}
      >
        {caption}
      </p>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* ============ PART 1 — PROMPT BUILDER ============ */}
        <div className="flex flex-1 flex-col gap-3">
          <div className="rounded-2xl border border-[#1e2738] bg-[#0f1420] p-3">
            <p className="mb-2 font-mono text-[10px] tracking-wide text-[#5b6b8c]">
              1 · BUILD A STRONG PROMPT — tap chips to add structure
            </p>

            {/* chips */}
            <div className="flex flex-wrap gap-2">
              {CHIPS.map((c) => {
                const active = on[c.key];
                return (
                  <button
                    key={c.key}
                    onClick={() => toggle(c.key)}
                    aria-pressed={active}
                    title={c.hint}
                    className="flex items-center gap-1.5 rounded-xl border-2 px-3 py-2 text-left transition-colors"
                    style={{
                      borderColor: active ? ACCENT : "#1e2738",
                      background: active ? `${ACCENT}1a` : "transparent",
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{c.emoji}</span>
                    <span className="leading-tight">
                      <span className="block font-mono text-[12px] font-semibold" style={{ color: active ? ACCENT : "#e8eefc" }}>
                        {c.label}
                      </span>
                      <span className="block font-mono text-[9px] text-[#5b6b8c]">{c.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* assembled prompt */}
          <div className="rounded-2xl border border-[#1e2738] bg-[#0b1018] p-3">
            <p className="mb-1.5 font-mono text-[10px] tracking-wide text-[#5b6b8c]">YOUR PROMPT</p>
            <p className="font-mono text-[12px] leading-relaxed text-[#e8eefc]">
              <span style={{ color: "#5b6b8c" }}>{BASE_PROMPT}</span>{" "}
              {CHIPS.filter((c) => on[c.key]).map((c) => (
                <span key={c.key} style={{ color: ACCENT }}>{c.text} </span>
              ))}
            </p>

            {/* quality meter */}
            <div className="mt-3 flex items-center gap-2">
              <span className="font-mono text-[10px] text-[#5b6b8c]">QUALITY</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: "#1e2738" }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${quality}%`,
                    background: quality >= 60 ? ACCENT : quality >= 40 ? "#eab308" : "#fb7185",
                  }}
                />
              </div>
              <span className="font-mono text-[11px] font-semibold" style={{ color: quality >= 60 ? ACCENT : "#9fb0d0" }}>
                {quality}%
              </span>
            </div>
          </div>

          {/* sample output — weak vs strong */}
          <div className="rounded-2xl border border-[#1e2738] bg-[#0f1420] p-3">
            <p className="mb-1.5 font-mono text-[10px] tracking-wide text-[#5b6b8c]">
              AI ANSWER {strong ? "· strong prompt 💪" : "· weak prompt 😐"}
            </p>
            <p
              className="whitespace-pre-line rounded-xl border p-2.5 font-mono text-[12px] leading-relaxed transition-colors"
              style={{
                borderColor: strong ? `${ACCENT}55` : "#2a3550",
                background: strong ? `${ACCENT}0f` : "#0b1018",
                color: strong ? "#e8eefc" : "#9fb0d0",
              }}
            >
              {strong ? STRONG_OUTPUT : WEAK_OUTPUT}
            </p>
            <p className="mt-2 font-mono text-[10px] leading-relaxed text-[#5b6b8c]">
              Same AI, different prompt. Structure (role · task · audience · format · limits) steers the answer.
            </p>
          </div>
        </div>

        {/* ============ PART 2 — HALLUCINATION HUNT ============ */}
        <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[330px]">
          <div className="rounded-2xl border border-[#1e2738] bg-[#0f1420] p-3">
            <p className="mb-2 font-mono text-[10px] tracking-wide text-[#5b6b8c]">
              2 · HALLUCINATION HUNT — the AI sounds sure. Is it right?
            </p>

            <div
              className="flex flex-col gap-2 transition-transform"
              style={{ transform: wobble ? "translateX(0)" : undefined, animation: wobble ? "promptlab-wobble 0.45s ease" : undefined }}
            >
              {CLAIMS.map((claim) => {
                const picked = tags[claim.id];
                const right = revealed && picked === claim.truth;
                const wrong = revealed && picked !== undefined && picked !== claim.truth;
                return (
                  <div
                    key={claim.id}
                    className="rounded-xl border p-2"
                    style={{
                      borderColor: right ? ACCENT : wrong ? "#fb7185" : "#1e2738",
                      background: "#0b1018",
                    }}
                  >
                    <p className="mb-1.5 font-mono text-[11px] leading-snug text-[#e8eefc]">
                      <span aria-hidden style={{ color: "#60a5fa" }}>🤖 </span>
                      {claim.text}
                    </p>
                    <div className="flex gap-1.5">
                      {VERDICTS.map((v) => {
                        const sel = picked === v.key;
                        return (
                          <button
                            key={v.key}
                            onClick={() => !revealed && tagClaim(claim.id, v.key)}
                            disabled={revealed}
                            aria-pressed={sel}
                            className="flex flex-1 items-center justify-center gap-1 rounded-lg border-2 py-1 font-mono text-[10px] transition-colors disabled:cursor-default"
                            style={{
                              borderColor: sel ? v.color : "#1e2738",
                              background: sel ? `${v.color}1a` : "transparent",
                              color: sel ? v.color : "#9fb0d0",
                            }}
                          >
                            <span aria-hidden>{v.emoji}</span>
                            {v.label}
                          </button>
                        );
                      })}
                    </div>
                    {revealed && (
                      <p className="mt-1.5 font-mono text-[10px] leading-snug" style={{ color: right ? ACCENT : "#eab308" }}>
                        {claim.why}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {!revealed ? (
              <button
                onClick={tryReveal}
                className="mt-3 w-full rounded-xl border-2 py-2.5 font-mono text-xs font-semibold transition-colors"
                style={{
                  borderColor: allTagged ? ACCENT : "#1e2738",
                  background: allTagged ? ACCENT : "transparent",
                  color: allTagged ? "#062018" : "#5b6b8c",
                }}
              >
                {allTagged ? "🔎 Reveal the truth" : `Tag all 5 first (${Object.keys(tags).length}/5)`}
              </button>
            ) : (
              <div className="mt-3 text-center">
                <span className="font-mono text-2xl font-bold" style={{ color: correctCount >= 4 ? ACCENT : "#eab308" }}>
                  {correctCount}/5
                </span>
                <span className="ml-1 font-mono text-[10px] text-[#5b6b8c]">spotted</span>
                <button
                  onClick={() => { setTags({}); setRevealed(false); }}
                  className="mt-2 w-full rounded-xl border border-[#2a3550] py-1.5 font-mono text-[11px] text-[#9fb0d0] transition-colors hover:border-[#34d399] hover:text-[#34d399]"
                >
                  🔄 Try again
                </button>
              </div>
            )}
          </div>

          <p className="rounded-xl border border-[#1e2738] bg-[#0f1420] p-2.5 font-mono text-[10px] leading-relaxed text-[#5b6b8c]">
            A generative AI guesses the next likely words — it doesn&apos;t look anything up. So it can write{" "}
            <span style={{ color: "#fb7185" }}>confident nonsense</span>. Good prompts steer it; checking facts keeps you safe.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes promptlab-wobble {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-5px); }
          40% { transform: translateX(5px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
      `}</style>
    </div>
  );
}
