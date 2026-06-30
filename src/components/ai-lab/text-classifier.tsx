"use client";

import { useMemo, useState } from "react";
import { Caption, Footer, Hi, LabHeader } from "./_ui";

/**
 * Neural Lab — "Text Trainer" (teachable text classification).
 *
 * Type example sentences and label them (Group 1 / Group 2); the model learns
 * from the words. New text is scored by word-overlap (bag-of-words cosine)
 * against each group's examples. No camera, no network — pure, visible NLP.
 * PictoBlox's Text-Classifier / NLP idea, rebuilt transparently.
 */

const ACCENT = "#eab308";
const GROUPS = [
  { id: 0, label: "Group 1", hint: "e.g. happy / kind messages" },
  { id: 1, label: "Group 2", hint: "e.g. sad / mean messages" },
];

const tokenize = (s: string) =>
  s.toLowerCase().split(/[^a-z']+/).filter((w) => w.length > 1);

function bag(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of tokenize(s)) m.set(w, (m.get(w) ?? 0) + 1);
  return m;
}
function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  for (const [k, v] of a) dot += v * (b.get(k) ?? 0);
  const na = Math.sqrt([...a.values()].reduce((s, v) => s + v * v, 0)) || 1;
  const nb = Math.sqrt([...b.values()].reduce((s, v) => s + v * v, 0)) || 1;
  return dot / (na * nb);
}

interface Ex { text: string; cls: number }

export default function TextTrainer() {
  const [examples, setExamples] = useState<Ex[]>([]);
  const [draft, setDraft] = useState("");
  const [cls, setCls] = useState(0);
  const [test, setTest] = useState("");

  const counts = [0, 1].map((c) => examples.filter((e) => e.cls === c).length);
  const ready = counts[0] > 0 && counts[1] > 0;

  const result = useMemo(() => {
    if (!ready || !test.trim()) return null;
    const tb = bag(test);
    const scores = [0, 1].map((c) => {
      const exs = examples.filter((e) => e.cls === c);
      const sims = exs.map((e) => cosine(tb, bag(e.text)));
      return sims.length ? sims.reduce((a, b) => a + b, 0) / sims.length : 0;
    });
    const T = 6;
    const exps = scores.map((s) => Math.exp(s * T));
    const sum = exps.reduce((a, b) => a + b, 0) || 1;
    const probs = exps.map((e) => e / sum);
    const winner = probs[0] >= probs[1] ? 0 : 1;
    return { winner, probs };
  }, [test, examples, ready]);

  const addExample = () => {
    if (!draft.trim()) return;
    setExamples((e) => [...e, { text: draft.trim(), cls }]);
    setDraft("");
  };

  return (
    <div className="mx-auto w-full max-w-[640px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader emoji="💬" title="Text Trainer" grades="Grades 4–10" topic="Language" accent={ACCENT} right={`${examples.length} examples`} />

      <Caption accent={ACCENT} active={!!result}>
        {result
          ? `🧠 It sorted that into ${GROUPS[result.winner].label} (${Math.round(result.probs[result.winner] * 100)}% sure) — purely from which words it has seen in each group before.`
          : ready
            ? "Now type a NEW sentence below to test it. The model compares your words to each group's examples."
            : "Add a few example sentences to each group (label them with the buttons). Then test it on a new sentence."}
      </Caption>

      {/* Teach */}
      <div className="rounded-2xl border border-[#1e2738] bg-[#0f1420] p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {GROUPS.map((g) => (
            <button key={g.id} type="button" onClick={() => setCls(g.id)} className="rounded-xl border-2 px-3 py-1.5 font-mono text-[10px]" style={{ borderColor: cls === g.id ? ACCENT : "#1e2738", background: cls === g.id ? `${ACCENT}1a` : "transparent", color: cls === g.id ? ACCENT : "#9fb0d0" }}>
              {g.label} ({counts[g.id]})
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addExample()}
            placeholder={`Example for ${GROUPS[cls].label} — ${GROUPS[cls].hint}`}
            className="flex-1 rounded-lg border border-[#1e2738] bg-[#0b1018] px-3 py-2 font-mono text-[12px] text-[#e8eefc] outline-none placeholder:text-[#5b6b8c]"
          />
          <button type="button" onClick={addExample} className="rounded-lg border-2 px-3 py-2 font-mono text-[11px] font-semibold" style={{ borderColor: ACCENT, color: ACCENT, background: `${ACCENT}1a` }}>+ add</button>
        </div>
        {examples.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {examples.map((e, i) => (
              <span key={i} className="rounded-md px-1.5 py-0.5 font-mono text-[9px]" style={{ background: "#0b1018", color: e.cls === 0 ? ACCENT : "#9fb0d0", border: "1px solid #1e2738" }}>{e.text.slice(0, 22)}</span>
            ))}
          </div>
        )}
      </div>

      {/* Test */}
      <div className="mt-3">
        <input
          value={test}
          onChange={(e) => setTest(e.target.value)}
          disabled={!ready}
          placeholder={ready ? "Type a NEW sentence to classify…" : "Teach both groups first"}
          className="w-full rounded-lg border border-[#1e2738] bg-[#0b1018] px-3 py-2 font-mono text-[12px] text-[#e8eefc] outline-none placeholder:text-[#5b6b8c] disabled:opacity-50"
        />
        {result && (
          <div className="mt-2 space-y-1.5">
            {GROUPS.map((g) => (
              <div key={g.id} className="flex items-center gap-2">
                <span className="w-20 shrink-0 font-mono text-[10px] text-[#9fb0d0]">{g.label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#1e2738]"><div className="h-full rounded-full" style={{ width: `${Math.round(result.probs[g.id] * 100)}%`, background: ACCENT }} /></div>
                <span className="w-10 text-right font-mono text-[10px] text-[#5b6b8c]">{Math.round(result.probs[g.id] * 100)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer accent={ACCENT}>
        Computers don't read words — they count them. Each sentence becomes a <Hi accent={ACCENT}>bag of words</Hi>, and
        the model picks the group whose examples share the most words. Spam filters, support-ticket routing and topic
        tagging all start here. Teach it slang and watch it adapt.
      </Footer>
    </div>
  );
}
