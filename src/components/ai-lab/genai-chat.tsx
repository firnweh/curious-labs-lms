"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Caption, Footer, Hi, LabHeader } from "./_ui";

/**
 * Neural Lab — "Word Weaver" (generative AI, honestly).
 *
 * A real, on-device generative model: a Markov next-word predictor. The kid
 * sees the core trick behind ChatGPT-style tools — predict the next word, again
 * and again — and a "creativity" slider that is exactly the temperature knob
 * those tools expose. Add your own sentences to change what it can say. Low
 * creativity = safe & repetitive; high = surprising & sometimes nonsense
 * (a kid-sized look at "hallucination").
 */

const ACCENT = "#eab308";

// A small, original, kid-friendly corpus to seed the model.
const SEED = [
  "the curious robot loves to learn new things every day",
  "a friendly robot can paint pictures and tell funny stories",
  "the clever cat sat on the warm sunny window and purred",
  "young inventors build amazing machines that help people learn",
  "the happy dog runs fast and plays in the green park",
  "smart computers can see hear and even talk to people",
  "the brave explorer found a hidden cave full of glowing crystals",
  "students love to code games draw robots and solve puzzles",
];

const tokenize = (s: string) => s.toLowerCase().split(/[^a-z']+/).filter(Boolean);

function buildModel(sentences: string[]) {
  const m = new Map<string, Map<string, number>>();
  const starts: string[] = [];
  for (const s of sentences) {
    const w = tokenize(s);
    if (w.length) starts.push(w[0]);
    for (let i = 0; i < w.length - 1; i++) {
      const cur = w[i], nxt = w[i + 1];
      if (!m.has(cur)) m.set(cur, new Map());
      const nm = m.get(cur)!;
      nm.set(nxt, (nm.get(nxt) ?? 0) + 1);
    }
  }
  return { m, starts };
}

function sampleNext(dist: Map<string, number>, temp: number): string | null {
  const entries = [...dist.entries()];
  if (!entries.length) return null;
  const weights = entries.map(([, c]) => Math.pow(c, 1 / temp));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < entries.length; i++) {
    r -= weights[i];
    if (r <= 0) return entries[i][0];
  }
  return entries[entries.length - 1][0];
}

export default function WordWeaver() {
  const [extra, setExtra] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [creativity, setCreativity] = useState(0.4); // 0..1 → temperature
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [runs, setRuns] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const model = useMemo(() => buildModel([...SEED, ...extra]), [extra]);

  const generate = useCallback(() => {
    if (busy) return;
    if (timer.current) clearInterval(timer.current);
    const temp = 0.2 + creativity * 1.3; // map slider to 0.2..1.5
    const start = model.starts[Math.floor(Math.random() * model.starts.length)] ?? "the";
    let cur = start;
    const words = [cur];
    setOutput(cur);
    setBusy(true);
    let steps = 0;
    timer.current = setInterval(() => {
      const dist = model.m.get(cur);
      const nxt = dist ? sampleNext(dist, temp) : null;
      steps++;
      if (!nxt || steps > 18) {
        if (timer.current) clearInterval(timer.current);
        setBusy(false);
        setRuns((n) => n + 1);
        return;
      }
      words.push(nxt);
      cur = nxt;
      setOutput(words.join(" "));
    }, 140);
  }, [busy, creativity, model]);

  const addSentence = () => {
    if (!draft.trim()) return;
    setExtra((e) => [...e, draft.trim()]);
    setDraft("");
  };

  return (
    <div className="mx-auto w-full max-w-[640px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader emoji="✍️" title="Word Weaver" grades="Grades 4–10" topic="Creating" accent={ACCENT} right={`${runs} generated`} />

      <Caption accent={ACCENT} active={runs >= 2}>
        {runs >= 2
          ? "🪄 That's generative AI in miniature: predict the next word, then the next, then the next. Big tools like ChatGPT do exactly this — just with billions of examples. The creativity slider is their 'temperature' knob."
          : "Press Generate to watch it build a sentence one word at a time. Slide Creativity up for wilder results, and teach it new words below."}
      </Caption>

      <div className="min-h-[64px] rounded-2xl border border-[#1e2738] bg-[#0f1420] px-4 py-3 font-mono text-[15px] leading-relaxed" style={{ color: output ? "#e8eefc" : "#5b6b8c" }}>
        {output || "your AI-written sentence appears here…"}
        {busy && <span className="animate-pulse" style={{ color: ACCENT }}>▋</span>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={generate} disabled={busy} className="rounded-xl border-2 px-4 py-2 font-mono text-xs font-semibold disabled:opacity-40" style={{ borderColor: ACCENT, color: ACCENT, background: `${ACCENT}1a` }}>
          {busy ? "✍️ Writing…" : "🪄 Generate"}
        </button>
        <label className="flex flex-1 items-center gap-2">
          <span className="font-mono text-[10px] text-[#5b6b8c]">Creativity</span>
          <input type="range" min={0} max={1} step={0.05} value={creativity} onChange={(e) => setCreativity(+e.target.value)} className="flex-1" style={{ accentColor: ACCENT }} />
          <span className="font-mono text-[10px]" style={{ color: ACCENT }}>{creativity < 0.33 ? "safe" : creativity < 0.66 ? "balanced" : "wild"}</span>
        </label>
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addSentence()}
          placeholder="Teach it a sentence (it learns the words)…"
          className="flex-1 rounded-lg border border-[#1e2738] bg-[#0b1018] px-3 py-2 font-mono text-[12px] text-[#e8eefc] outline-none placeholder:text-[#5b6b8c]"
        />
        <button type="button" onClick={addSentence} className="rounded-lg border-2 px-3 py-2 font-mono text-[11px] font-semibold" style={{ borderColor: ACCENT, color: ACCENT, background: `${ACCENT}1a` }}>+ teach</button>
      </div>
      {extra.length > 0 && <p className="mt-1 font-mono text-[9px] text-[#5b6b8c]">Learned {extra.length} of your sentences · vocabulary now {model.m.size} words</p>}

      <Footer accent={ACCENT}>
        <Hi accent={ACCENT}>Generative AI</Hi> writes by predicting the next word from patterns it has seen, over and
        over. “Temperature” (our Creativity slider) sets how boldly it picks: low repeats safe words, high invents —
        sometimes brilliantly, sometimes nonsense. Real chatbots add a giant model and a backend key; this tiny one
        runs entirely in your browser.
      </Footer>
    </div>
  );
}
