"use client";

import { useMemo, useState } from "react";

/**
 * AI Lab experiment — "Who's Affected?" (AI ethics · stakeholders).
 *
 * A stakeholder ethics lab. One scenario: a school wants AI cameras that check
 * if students are paying attention. The child works through 5 stakeholders and,
 * for each, taps the most likely BENEFIT and the most likely HARM from a few
 * option chips. A running "people considered" tally shows the child that ONE
 * AI affects MANY people very differently. Finally a "Make it fairer" step asks
 * the child to pick the most responsible redesign — revealing why consent,
 * privacy, fairness, accountability and a human-in-the-loop matter.
 *
 * Shell-compatible: renders as a body block (no full-screen chrome / Back —
 * the AI Lab shell owns those). Deterministic, no deps, gentle on mistakes.
 */

const ACCENT = "#22d3ee";

interface Choice { id: string; label: string }
interface Stakeholder {
  id: string;
  emoji: string;
  name: string;
  benefits: Choice[]; // first entry is the "best" benefit
  harms: Choice[]; // first entry is the "best" harm
  benefitBest: string;
  harmBest: string;
}

const STAKEHOLDERS: Stakeholder[] = [
  {
    id: "students",
    emoji: "🧑‍🎓",
    name: "Students",
    benefitBest: "b1",
    harmBest: "h1",
    benefits: [
      { id: "b1", label: "Gentle nudge when they drift off" },
      { id: "b2", label: "Cheaper school lunches" },
      { id: "b3", label: "Faster wifi at home" },
    ],
    harms: [
      { id: "h1", label: "Feel watched & stressed all day" },
      { id: "h2", label: "Shorter summer break" },
      { id: "h3", label: "Heavier backpacks" },
    ],
  },
  {
    id: "teachers",
    emoji: "🧑‍🏫",
    name: "Teachers",
    benefitBest: "b1",
    harmBest: "h1",
    benefits: [
      { id: "b1", label: "See which lessons lose the class" },
      { id: "b2", label: "A bigger classroom" },
      { id: "b3", label: "More holidays" },
    ],
    harms: [
      { id: "h1", label: "Blamed if scores look 'low'" },
      { id: "h2", label: "Have to buy new shoes" },
      { id: "h3", label: "Longer lunch lines" },
    ],
  },
  {
    id: "parents",
    emoji: "👪",
    name: "Parents",
    benefitBest: "b1",
    harmBest: "h1",
    benefits: [
      { id: "b1", label: "Reassured kids are supported" },
      { id: "b2", label: "Free movie tickets" },
      { id: "b3", label: "A new family car" },
    ],
    harms: [
      { id: "h1", label: "Worry their child is judged unfairly" },
      { id: "h2", label: "Pay higher phone bills" },
      { id: "h3", label: "Longer commute to work" },
    ],
  },
  {
    id: "leaders",
    emoji: "🏫",
    name: "School leaders",
    benefitBest: "b1",
    harmBest: "h1",
    benefits: [
      { id: "b1", label: "Spot classes that need help" },
      { id: "b2", label: "A shinier school logo" },
      { id: "b3", label: "More parking spaces" },
    ],
    harms: [
      { id: "h1", label: "Lose trust if families feel spied on" },
      { id: "h2", label: "Repaint the hallways" },
      { id: "h3", label: "Order new whiteboards" },
    ],
  },
  {
    id: "company",
    emoji: "🏢",
    name: "Data company",
    benefitBest: "b1",
    harmBest: "h1",
    benefits: [
      { id: "b1", label: "Earns money & lots of face data" },
      { id: "b2", label: "Wins a sports trophy" },
      { id: "b3", label: "Gets a longer lunch break" },
    ],
    harms: [
      { id: "h1", label: "Could leak or misuse kids' faces" },
      { id: "h2", label: "Runs out of printer paper" },
      { id: "h3", label: "Has to move offices" },
    ],
  },
];

interface Redesign {
  id: string;
  label: string;
  detail: string;
  responsible: boolean;
}

const REDESIGNS: Redesign[] = [
  {
    id: "a",
    label: "Name-by-name attention scores, emailed to every parent",
    detail: "Singles kids out and shares private scores — no consent, easy to feel unfair and shaming.",
    responsible: false,
  },
  {
    id: "b",
    label: "Anonymous class-level summary for the teacher only — with student consent and a human reviewing it",
    detail: "Privacy (no names), consent (students agree), fairness (whole class, not individuals), accountability + a human-in-the-loop double-checking the AI.",
    responsible: true,
  },
  {
    id: "c",
    label: "Secretly record everyone, forever, and never tell them",
    detail: "No consent, no privacy, no accountability — the opposite of responsible AI.",
    responsible: false,
  },
];

type Picks = Record<string, { benefit?: string; harm?: string }>;

function Chip({
  label,
  state,
  onClick,
}: {
  label: string;
  state: "idle" | "right" | "wrong" | "dim";
  onClick: () => void;
}) {
  const color =
    state === "right" ? "#34d399" : state === "wrong" ? "#eab308" : ACCENT;
  const active = state === "right" || state === "wrong";
  return (
    <button
      onClick={onClick}
      className="rounded-xl border-2 px-2.5 py-1.5 text-left font-mono text-[11px] leading-snug transition-colors"
      style={{
        borderColor: active ? color : state === "dim" ? "#1e2738" : "#2a3550",
        background: active ? `${color}18` : "#0b1018",
        color: active ? color : state === "dim" ? "#5b6b8c" : "#e8eefc",
        opacity: state === "dim" ? 0.7 : 1,
      }}
    >
      {state === "right" ? "✓ " : state === "wrong" ? "↻ " : ""}
      {label}
    </button>
  );
}

export default function Ethics() {
  const [picks, setPicks] = useState<Picks>({});
  const [redesign, setRedesign] = useState<string | null>(null);

  const choose = (sid: string, kind: "benefit" | "harm", cid: string) => {
    setPicks((prev) => ({ ...prev, [sid]: { ...prev[sid], [kind]: cid } }));
  };

  // How many stakeholders has the child fully considered (both benefit + harm)?
  const considered = useMemo(
    () =>
      STAKEHOLDERS.filter(
        (s) => picks[s.id]?.benefit && picks[s.id]?.harm,
      ).length,
    [picks],
  );

  const allConsidered = considered === STAKEHOLDERS.length;
  const chosen = REDESIGNS.find((r) => r.id === redesign) ?? null;

  const reset = () => {
    setPicks({});
    setRedesign(null);
  };

  const teach = chosen
    ? chosen.responsible
      ? `⚖️ Aha! Option B is the responsible design. It weighs EVERY stakeholder's benefit and harm, then adds privacy, consent, fairness, accountability and a human-in-the-loop. That's responsible AI.`
      : `🤔 Hmm — that design helps some people but hurts others, and skips consent or privacy. Try the option that protects every stakeholder. (No wrong tries here — just keep thinking!)`
    : allConsidered
      ? `🌍 You considered all ${STAKEHOLDERS.length} stakeholders — ${considered} groups, each helped AND harmed differently! One AI ripples out to many people. Now pick the fairest redesign below.`
      : considered > 0
        ? `👀 ${considered}/${STAKEHOLDERS.length} stakeholders considered. Notice how the SAME camera helps and hurts each group differently. Keep going to see who else is affected.`
        : `⚖️ Read the scenario, then for each group tap one likely BENEFIT and one possible HARM. Watch the "people considered" tally climb.`;

  return (
    <div className="flex w-full flex-col gap-3" style={{ color: "#e8eefc" }}>
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden className="text-xl">⚖️</span>
        <span className="font-mono text-sm font-semibold">Who&apos;s Affected?</span>
        <span
          className="rounded-md px-2 py-0.5 font-mono text-[10px]"
          style={{ color: ACCENT, background: `${ACCENT}1a`, border: `1px solid ${ACCENT}55` }}
        >
          Grades 6-10
        </span>
        <span className="font-mono text-[11px] text-[#5b6b8c]">· AI ethics</span>
        {/* People considered tally */}
        <div className="ml-auto flex items-center gap-1.5" title="Stakeholder groups you've fully considered">
          <span className="font-mono text-[9px] text-[#5b6b8c]">people considered</span>
          <span
            className="rounded-md px-2 py-0.5 font-mono text-[11px] font-bold"
            style={{ color: ACCENT, background: `${ACCENT}1a`, border: `1px solid ${ACCENT}55` }}
          >
            {considered}/{STAKEHOLDERS.length}
          </span>
        </div>
      </div>

      <p
        aria-live="polite"
        className="rounded-xl border border-[#1e2738] bg-[#0f1420] p-2.5 font-mono text-[11px] leading-relaxed text-[#9fb0d0]"
      >
        {teach}
      </p>

      {/* The scenario, shown prominently */}
      <div
        className="rounded-2xl border-2 p-3"
        style={{ borderColor: `${ACCENT}55`, background: `${ACCENT}10` }}
      >
        <p className="mb-1 font-mono text-[10px] tracking-wide" style={{ color: ACCENT }}>
          📷 THE SCENARIO
        </p>
        <p className="font-mono text-[13px] leading-relaxed text-[#e8eefc]">
          A school wants to use <span style={{ color: ACCENT }}>AI cameras</span> to
          check if students are <span style={{ color: ACCENT }}>paying attention</span> in
          class.
        </p>
      </div>

      {/* Stakeholder cards */}
      <p className="font-mono text-[10px] tracking-wide text-[#5b6b8c]">
        FOR EACH GROUP — tap one likely benefit and one possible harm
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {STAKEHOLDERS.map((s) => {
          const p = picks[s.id] ?? {};
          const done = !!p.benefit && !!p.harm;
          return (
            <div
              key={s.id}
              className="rounded-2xl border-2 p-3 transition-colors"
              style={{
                borderColor: done ? "#34d39966" : "#1e2738",
                background: done ? "#34d3990a" : "#0f1420",
              }}
            >
              <div className="mb-2 flex items-center gap-2">
                <span aria-hidden className="text-xl">{s.emoji}</span>
                <span className="font-mono text-[13px] font-semibold text-[#e8eefc]">{s.name}</span>
                {done && (
                  <span className="ml-auto font-mono text-[10px] text-[#34d399]">considered ✓</span>
                )}
              </div>

              <p className="mb-1 font-mono text-[9px] tracking-wide text-[#34d399]">
                ✅ LIKELY BENEFIT
              </p>
              <div className="mb-2 flex flex-col gap-1.5">
                {s.benefits.map((c) => {
                  const picked = p.benefit === c.id;
                  const isBest = c.id === s.benefitBest;
                  const state: "idle" | "right" | "wrong" | "dim" = picked
                    ? isBest
                      ? "right"
                      : "wrong"
                    : p.benefit
                      ? "dim"
                      : "idle";
                  return (
                    <Chip
                      key={c.id}
                      label={c.label}
                      state={state}
                      onClick={() => choose(s.id, "benefit", c.id)}
                    />
                  );
                })}
              </div>

              <p className="mb-1 font-mono text-[9px] tracking-wide text-[#fb7185]">
                ⚠️ POSSIBLE HARM
              </p>
              <div className="flex flex-col gap-1.5">
                {s.harms.map((c) => {
                  const picked = p.harm === c.id;
                  const isBest = c.id === s.harmBest;
                  const state: "idle" | "right" | "wrong" | "dim" = picked
                    ? isBest
                      ? "right"
                      : "wrong"
                    : p.harm
                      ? "dim"
                      : "idle";
                  return (
                    <Chip
                      key={c.id}
                      label={c.label}
                      state={state}
                      onClick={() => choose(s.id, "harm", c.id)}
                    />
                  );
                })}
              </div>

              {p.benefit && p.benefit !== s.benefitBest && (
                <p className="mt-2 font-mono text-[9px] leading-snug text-[#eab308]">
                  That could happen, but the clearest benefit here is a different one — try again, no rush.
                </p>
              )}
              {p.harm && p.harm !== s.harmBest && (
                <p className="mt-1 font-mono text-[9px] leading-snug text-[#eab308]">
                  Good thinking — but which harm comes straight from the cameras? Tap another.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Make it fairer step — unlocks once every group is considered */}
      <div
        className="rounded-2xl border-2 p-3 transition-opacity"
        style={{
          borderColor: allConsidered ? `${ACCENT}55` : "#1e2738",
          background: "#0f1420",
          opacity: allConsidered ? 1 : 0.55,
        }}
      >
        <div className="mb-2 flex items-center gap-2">
          <span aria-hidden className="text-base">🛠️</span>
          <span className="font-mono text-[12px] font-semibold text-[#e8eefc]">
            Make it fairer
          </span>
          <span className="font-mono text-[9px] text-[#5b6b8c]">
            {allConsidered ? "— pick the most responsible redesign" : "— consider all groups first to unlock"}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {REDESIGNS.map((r) => {
            const picked = redesign === r.id;
            const color = picked ? (r.responsible ? "#34d399" : "#eab308") : ACCENT;
            return (
              <div key={r.id}>
                <button
                  disabled={!allConsidered}
                  onClick={() => setRedesign(r.id)}
                  className="w-full rounded-xl border-2 px-3 py-2 text-left font-mono text-[11px] leading-snug transition-colors disabled:cursor-not-allowed"
                  style={{
                    borderColor: picked ? color : "#2a3550",
                    background: picked ? `${color}18` : "#0b1018",
                    color: picked ? color : "#e8eefc",
                  }}
                >
                  <span className="font-semibold">{r.id.toUpperCase()}.</span> {r.label}
                </button>
                {picked && (
                  <p
                    className="mt-1 rounded-lg px-2.5 py-1.5 font-mono text-[10px] leading-relaxed"
                    style={{ background: `${color}12`, color: r.responsible ? "#34d399" : "#9fb0d0" }}
                  >
                    {r.responsible ? "✅ " : "↻ "}
                    {r.detail}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="rounded-xl border border-[#2a3550] px-3 py-2 font-mono text-[11px] text-[#9fb0d0] transition-colors hover:border-[#22d3ee] hover:text-[#22d3ee]"
        >
          🔄 Start over
        </button>
        <p className="flex-1 rounded-xl border border-[#1e2738] bg-[#0f1420] p-2.5 font-mono text-[10px] leading-relaxed text-[#5b6b8c]">
          Responsible AI weighs <span style={{ color: ACCENT }}>every</span> stakeholder&apos;s
          benefit AND harm — then adds <span className="text-[#34d399]">consent</span>,{" "}
          <span className="text-[#34d399]">privacy</span> and{" "}
          <span className="text-[#34d399]">human judgement</span>.
        </p>
      </div>
    </div>
  );
}
