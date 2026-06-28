"use client";

import { useCallback, useMemo, useRef, useState } from "react";

/**
 * AI Lab experiment — "Train an AI" (classification · data · bias · accuracy).
 * A hands-on k-nearest-neighbours classifier: drop example data for two
 * categories, train, watch the decision boundary form, test mystery points,
 * check accuracy, and discover how patchy data makes a biased, wrong AI.
 *
 * Shell-compatible: renders as a body block (no full-screen chrome / Back —
 * the AI Lab shell owns those). Deterministic, no deps.
 */

type Cat = 0 | 1;
interface Example { id: number; x: number; y: number; cat: Cat }
interface TestPt { id: number; x: number; y: number; pred: Cat; conf: number }

const CATS = [
  { name: "Apple", emoji: "🍎", color: "#ef4444" },
  { name: "Banana", emoji: "🍌", color: "#eab308" },
] as const;

const AX = { xLeft: "round", xRight: "long", yBottom: "red", yTop: "yellow" };

const trueCat = (x: number, y: number): Cat => (x + y < 1 ? 0 : 1);

const CHECK_PTS: [number, number][] = [
  [0.15, 0.2], [0.3, 0.15], [0.2, 0.45], [0.45, 0.3],
  [0.8, 0.85], [0.7, 0.6], [0.85, 0.55], [0.6, 0.8],
  [0.5, 0.5], [0.35, 0.65], [0.65, 0.35], [0.9, 0.2],
];

const K = 3;
const GRID = 22;

export default function Classifier() {
  const [examples, setExamples] = useState<Example[]>([]);
  const [cat, setCat] = useState<Cat>(0);
  const [mode, setMode] = useState<"add" | "test">("add");
  const [trained, setTrained] = useState(false);
  const [tests, setTests] = useState<TestPt[]>([]);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const idRef = useRef(1);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const counts: [number, number] = [
    examples.filter((e) => e.cat === 0).length,
    examples.filter((e) => e.cat === 1).length,
  ];
  const canTrain = counts[0] >= 3 && counts[1] >= 3;

  const classify = useCallback(
    (px: number, py: number): [Cat, number] => {
      if (examples.length === 0) return [0, 0];
      const near = [...examples]
        .map((e) => ({ cat: e.cat, d: (e.x - px) ** 2 + (e.y - py) ** 2 }))
        .sort((a, b) => a.d - b.d)
        .slice(0, Math.min(K, examples.length));
      const votes = near.reduce((s, n) => s + n.cat, 0);
      const k = near.length;
      const pred: Cat = votes * 2 > k ? 1 : 0;
      const winning = pred === 1 ? votes : k - votes;
      return [pred, winning / k];
    },
    [examples],
  );

  const boundary = useMemo(() => {
    if (!trained) return null;
    const cells: { x: number; y: number; cat: Cat; conf: number }[] = [];
    for (let gx = 0; gx < GRID; gx++) {
      for (let gy = 0; gy < GRID; gy++) {
        const x = (gx + 0.5) / GRID;
        const y = (gy + 0.5) / GRID;
        const [c, conf] = classify(x, y);
        cells.push({ x, y, cat: c, conf });
      }
    }
    return cells;
  }, [trained, classify]);

  const pointerXY = useCallback((e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const y = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
    return { x, y };
  }, []);

  const onMapClick = useCallback(
    (e: React.PointerEvent) => {
      const p = pointerXY(e);
      if (!p) return;
      if (mode === "add") {
        setExamples((prev) => [...prev, { id: idRef.current++, x: p.x, y: p.y, cat }]);
        setTrained(false);
        setAccuracy(null);
      } else if (trained) {
        const [pred, conf] = classify(p.x, p.y);
        setTests((prev) => [...prev, { id: idRef.current++, x: p.x, y: p.y, pred, conf }]);
      }
    },
    [mode, cat, trained, classify, pointerXY],
  );

  const train = useCallback(() => {
    if (!canTrain) return;
    setTrained(true);
    setMode("test");
    setTests([]);
    setAccuracy(null);
  }, [canTrain]);

  const check = useCallback(() => {
    if (!trained) return;
    let correct = 0;
    const pts: TestPt[] = CHECK_PTS.map(([x, y]) => {
      const [pred, conf] = classify(x, y);
      if (pred === trueCat(x, y)) correct++;
      return { id: idRef.current++, x, y, pred, conf };
    });
    setTests(pts);
    setAccuracy(Math.round((correct / CHECK_PTS.length) * 100));
  }, [trained, classify]);

  const reset = useCallback(() => {
    setExamples([]);
    setTests([]);
    setTrained(false);
    setAccuracy(null);
    setMode("add");
    setCat(0);
  }, []);

  const autoSeed = useCallback(() => {
    const seed: Example[] = [];
    const add = (x: number, y: number, c: Cat) => seed.push({ id: idRef.current++, x, y, cat: c });
    add(0.15, 0.18, 0); add(0.28, 0.12, 0); add(0.12, 0.35, 0); add(0.32, 0.3, 0);
    add(0.85, 0.82, 1); add(0.72, 0.9, 1); add(0.9, 0.62, 1); add(0.66, 0.72, 1);
    setExamples(seed);
    setTrained(false);
    setAccuracy(null);
    setMode("add");
  }, []);

  const sx = (x: number) => x * 100;
  const sy = (y: number) => (1 - y) * 100;

  const step = examples.length === 0 ? 0 : !trained ? 1 : 2;
  const teach =
    accuracy !== null
      ? accuracy >= 80
        ? `🎯 ${accuracy}% correct! Great data — the AI learned a fair boundary.`
        : `🤔 Only ${accuracy}% correct. Your AI saw patchy data — add examples where it guesses wrong (that's bias!).`
      : step === 0
        ? "📊 DATA — Click the map to add examples. Apples are round & red (bottom-left); bananas are long & yellow (top-right)."
        : step === 1
          ? `🧠 ${canTrain ? "Ready! Press Train so the AI learns from your examples." : `Add at least 3 of each (🍎 ${counts[0]}/3 · 🍌 ${counts[1]}/3).`}`
          : "🎯 TEST — Drop a mystery item; the AI guesses from the closest examples. Then press Check accuracy.";

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Experiment header */}
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden className="text-xl">🍎</span>
        <span className="font-mono text-sm font-semibold">Train an AI</span>
        <span className="rounded-md border border-[#34d39955] bg-[#34d39922] px-2 py-0.5 font-mono text-[10px] text-[#34d399]">Grades 4–7</span>
        <span className="font-mono text-[11px] text-[#5b6b8c]">Classification · Data · Bias · Accuracy</span>
        <div className="ml-auto hidden items-center gap-1 font-mono text-[10px] sm:flex">
          {["1 DATA", "2 TRAIN", "3 TEST"].map((s, i) => (
            <span key={s} className="rounded-md px-2 py-1" style={{ background: step === i ? "#34d39922" : "transparent", color: step === i ? "#34d399" : "#5b6b8c", border: `1px solid ${step === i ? "#34d39955" : "transparent"}` }}>{s}</span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Feature map */}
        <div className="flex min-h-0 flex-1 flex-col items-center">
          <div className="relative w-full max-w-[520px]" style={{ aspectRatio: "1 / 1" }}>
            <span className="absolute -left-1 top-0 -translate-x-full font-mono text-[10px] text-[#eab308]">{AX.yTop} ↑</span>
            <span className="absolute -left-1 bottom-0 -translate-x-full font-mono text-[10px] text-[#ef4444]">{AX.yBottom} ↓</span>
            <svg
              ref={svgRef}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="h-full w-full touch-none rounded-2xl border border-[#1e2738]"
              style={{ background: "#0b1018", cursor: mode === "add" ? "copy" : "crosshair" }}
              onPointerDown={onMapClick}
            >
              {boundary?.map((c, i) => (
                <rect key={i} x={sx(c.x) - 50 / GRID} y={sy(c.y) - 50 / GRID} width={100 / GRID} height={100 / GRID} fill={CATS[c.cat].color} opacity={0.07 + c.conf * 0.16} />
              ))}
              {[25, 50, 75].map((g) => (
                <g key={g} stroke="#1e2738" strokeWidth={0.3}>
                  <line x1={g} y1={0} x2={g} y2={100} />
                  <line x1={0} y1={g} x2={100} y2={g} />
                </g>
              ))}
              {examples.map((e) => (
                <circle key={e.id} cx={sx(e.x)} cy={sy(e.y)} r={2.4} fill={CATS[e.cat].color} stroke="#0b1018" strokeWidth={0.6} />
              ))}
              {tests.map((t) => {
                const right = accuracy !== null ? t.pred === trueCat(t.x, t.y) : null;
                return (
                  <g key={t.id}>
                    <circle cx={sx(t.x)} cy={sy(t.y)} r={3.2} fill={CATS[t.pred].color} stroke={right === null ? "#e8eefc" : right ? "#34d399" : "#fb7185"} strokeWidth={1.1} />
                    <text x={sx(t.x)} y={sy(t.y) + 1.4} fontSize={3.4} textAnchor="middle" fill="#0b1018" fontWeight="700">?</text>
                  </g>
                );
              })}
            </svg>
            <div className="mt-1 flex justify-between font-mono text-[10px] text-[#5b6b8c]">
              <span>← {AX.xLeft}</span>
              <span>{AX.xRight} →</span>
            </div>
          </div>
          <p className="mt-2 max-w-[520px] text-center font-mono text-[11px] leading-relaxed text-[#9fb0d0]" aria-live="polite">{teach}</p>
        </div>

        {/* Controls */}
        <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[260px]">
          <div className="rounded-2xl border border-[#1e2738] bg-[#0f1420] p-3">
            <p className="mb-2 font-mono text-[10px] tracking-wide text-[#5b6b8c]">ADD EXAMPLES OF…</p>
            <div className="grid grid-cols-2 gap-2">
              {CATS.map((c, i) => {
                const on = mode === "add" && cat === i;
                return (
                  <button key={c.name} onClick={() => { setMode("add"); setCat(i as Cat); }} className="flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-2 transition-colors" style={{ borderColor: on ? c.color : "#1e2738", background: on ? `${c.color}1a` : "transparent" }}>
                    <span style={{ fontSize: 26 }}>{c.emoji}</span>
                    <span className="font-mono text-[11px]" style={{ color: c.color }}>{c.name}</span>
                    <span className="font-mono text-[9px] text-[#5b6b8c]">{counts[i]} examples</span>
                  </button>
                );
              })}
            </div>
            <button onClick={autoSeed} className="mt-2 w-full rounded-lg border border-[#2a3550] py-1.5 font-mono text-[10px] text-[#9fb0d0] hover:border-[#34d399] hover:text-[#34d399]">✨ Give me starter examples</button>
          </div>

          <button onClick={train} disabled={!canTrain} className="rounded-2xl py-3 font-mono text-sm font-semibold transition-colors" style={{ background: canTrain ? "#34d399" : "transparent", color: canTrain ? "#062018" : "#5b6b8c", border: `2px solid ${canTrain ? "#34d399" : "#1e2738"}` }}>🧠 Train the AI</button>

          <div className="rounded-2xl border border-[#1e2738] bg-[#0f1420] p-3">
            <button onClick={() => { setMode("test"); setTests([]); setAccuracy(null); }} disabled={!trained} className="w-full rounded-xl border-2 py-2 font-mono text-xs transition-colors disabled:opacity-40" style={{ borderColor: mode === "test" ? "#60a5fa" : "#1e2738", color: mode === "test" ? "#60a5fa" : "#9fb0d0" }}>🎯 Test mode — drop mystery items</button>
            <button onClick={check} disabled={!trained} className="mt-2 w-full rounded-xl border border-[#2a3550] py-2 font-mono text-xs text-[#9fb0d0] transition-colors hover:border-[#60a5fa] hover:text-[#60a5fa] disabled:opacity-40">📊 Check accuracy</button>
            {accuracy !== null && (
              <div className="mt-2 text-center">
                <span className="font-mono text-2xl font-bold" style={{ color: accuracy >= 80 ? "#34d399" : "#fb7185" }}>{accuracy}%</span>
                <span className="ml-1 font-mono text-[10px] text-[#5b6b8c]">on 12 hidden items</span>
              </div>
            )}
          </div>

          <button onClick={reset} className="rounded-xl border border-[#2a3550] py-2 font-mono text-[11px] text-[#9fb0d0] hover:border-[#fb7185] hover:text-[#fb7185]">🔄 Start over</button>

          <p className="rounded-xl border border-[#1e2738] bg-[#0f1420] p-2.5 font-mono text-[10px] leading-relaxed text-[#5b6b8c]">Real machine learning: the AI learns only from the examples YOU give it. Patchy or one-sided examples → an unfair, wrong AI. That&apos;s <span className="text-[#34d399]">bias</span>.</p>
        </div>
      </div>
    </div>
  );
}
