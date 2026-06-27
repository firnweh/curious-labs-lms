"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CircuitDoc, PinRef, PartType, SimResult } from "@/lib/circuits/types";
import { simulate } from "@/lib/circuits/engine";
import { PART_DEFS, PART_ORDER, BOX_W, BOX_H } from "@/lib/circuits/parts";
import { useCircuits } from "@/lib/circuits/store";
import type { Challenge } from "@/lib/circuits/challenges";

const VBW = 760;
const VBH = 470;
const GRID = 20;
const CX = BOX_W / 2;
const CY = BOX_H / 2;
const snap = (v: number) => Math.round(v / GRID) * GRID;

const EMPTY: SimResult = { active: false, comp: {}, wireLive: {} };
const IDLE = { current: 0, on: false, level: 0 };
const LED_COLORS = ["#ef4444", "#f59e0b", "#fde047", "#34d399", "#3b82f6", "#a855f7"];
const PART_EMOJI: Record<PartType, string> = {
  battery: "🔋",
  switch: "🎚️",
  button: "🔘",
  led: "💡",
  resistor: "🟫",
  buzzer: "🔔",
  motor: "⚙️",
  pot: "🎛️",
};

function pinPos(doc: CircuitDoc, ref: PinRef) {
  const c = doc.components.find((x) => x.id === ref.c);
  if (!c) return { x: 0, y: 0 };
  const pin = PART_DEFS[c.type].pins.find((p) => p.id === ref.p)!;
  const rad = ((c.rot || 0) * Math.PI) / 180;
  const dx = pin.x - CX,
    dy = pin.y - CY;
  return {
    x: c.x + CX + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: c.y + CY + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

export function CircuitStudio({ challenge, onSolved, fill = false }: { challenge?: Challenge; onSolved?: () => void; fill?: boolean } = {}) {
  const [doc, setDoc] = useState<CircuitDoc>({ components: [], wires: [] });
  const [sel, setSel] = useState<{ kind: "component" | "wire"; id: string } | null>(null);
  const [wireFrom, setWireFrom] = useState<PinRef | null>(null);
  const [running, setRunning] = useState(false);
  const [ghost, setGhost] = useState<{ type: PartType; x: number; y: number } | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [solved, setSolved] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const idRef = useRef(1);
  const dragRef = useRef<{ id: string; offX: number; offY: number; moved: boolean } | null>(null);
  const { circuits, save, remove } = useCircuits();

  const sim = useMemo(() => (running ? simulate(doc) : EMPTY), [doc, running]);

  // live auto-grade for challenge mode
  useEffect(() => {
    if (challenge && running && !solved && challenge.check(doc, sim)) {
      setSolved(true);
      onSolved?.();
    }
  }, [sim, running, challenge, solved, doc, onSolved]);

  const toPoint = useCallback((clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * VBW, y: ((clientY - r.top) / r.height) * VBH };
  }, []);

  const addPartAt = (type: PartType, x?: number, y?: number) => {
    const id = `c${idRef.current++}`;
    const n = doc.components.length;
    const px = x ?? snap(110 + (n % 3) * 200);
    const py = y ?? snap(90 + Math.floor(n / 3) * 150);
    setDoc((d) => ({ ...d, components: [...d.components, { id, type, x: px, y: py, rot: 0, props: { ...PART_DEFS[type].defaultProps } }] }));
    setSel({ kind: "component", id });
  };

  const updateComp = (id: string, patch: Partial<{ x: number; y: number; rot: number }>, props?: Record<string, number | string | boolean>) =>
    setDoc((d) => ({ ...d, components: d.components.map((c) => (c.id === id ? { ...c, ...patch, props: props ? { ...c.props, ...props } : c.props } : c)) }));

  const deleteSel = useCallback(() => {
    if (!sel) return;
    if (sel.kind === "component") setDoc((d) => ({ components: d.components.filter((c) => c.id !== sel.id), wires: d.wires.filter((w) => w.a.c !== sel.id && w.b.c !== sel.id) }));
    else setDoc((d) => ({ ...d, wires: d.wires.filter((w) => w.id !== sel.id) }));
    setSel(null);
  }, [sel]);

  const rotateSel = useCallback(() => {
    if (sel?.kind === "component") updateComp(sel.id, { rot: ((doc.components.find((c) => c.id === sel.id)?.rot || 0) + 90) % 360 });
  }, [sel, doc]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.key === "Delete" || e.key === "Backspace") && !running) { e.preventDefault(); deleteSel(); }
      else if (e.key.toLowerCase() === "r" && !running) rotateSel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSel, rotateSel, running]);

  const startTrayDrag = (type: PartType, e: React.PointerEvent) => {
    e.preventDefault();
    setGhost({ type, x: e.clientX, y: e.clientY });
    const move = (ev: PointerEvent) => setGhost((g) => (g ? { ...g, x: ev.clientX, y: ev.clientY } : g));
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setGhost(null);
      const r = svgRef.current?.getBoundingClientRect();
      if (r && ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom)
        addPartAt(type, snap(((ev.clientX - r.left) / r.width) * VBW - CX), snap(((ev.clientY - r.top) / r.height) * VBH - CY));
      else addPartAt(type);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const onPinDown = (ref: PinRef, e: React.PointerEvent) => {
    e.stopPropagation();
    if (running) return;
    if (!wireFrom) return setWireFrom(ref);
    if (wireFrom.c === ref.c && wireFrom.p === ref.p) return setWireFrom(null);
    const id = `w${idRef.current++}`;
    setDoc((d) => ({ ...d, wires: [...d.wires, { id, a: wireFrom, b: ref }] }));
    setWireFrom(null);
  };

  const onCompDown = (id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    setSel({ kind: "component", id });
    setWireFrom(null);
    const c = doc.components.find((x) => x.id === id)!;
    const p = toPoint(e.clientX, e.clientY);
    dragRef.current = { id, offX: p.x - c.x, offY: p.y - c.y, moved: false };
    svgRef.current?.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const dr = dragRef.current;
    if (!dr) return;
    const p = toPoint(e.clientX, e.clientY);
    updateComp(dr.id, { x: snap(p.x - dr.offX), y: snap(p.y - dr.offY) });
    dr.moved = true;
  };
  const onUp = (e: React.PointerEvent) => {
    const dr = dragRef.current;
    if (dr && !dr.moved) {
      const c = doc.components.find((x) => x.id === dr.id);
      if (c && PART_DEFS[c.type].toggleable) updateComp(c.id, {}, { closed: !c.props.closed });
    }
    dragRef.current = null;
    svgRef.current?.releasePointerCapture?.(e.pointerId);
  };

  const doSave = () => {
    if (doc.components.length === 0) return;
    save(`My circuit ${circuits.length + 1}`, doc);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1400);
  };
  const loadDoc = (d: CircuitDoc) => {
    let max = 0;
    [...d.components.map((c) => c.id), ...d.wires.map((w) => w.id)].forEach((s) => { const n = parseInt(String(s).replace(/\D/g, "")) || 0; if (n > max) max = n; });
    idRef.current = max + 1;
    setRunning(false); setSel(null); setWireFrom(null);
    setDoc(JSON.parse(JSON.stringify(d)));
  };

  const selComp = sel?.kind === "component" ? doc.components.find((c) => c.id === sel.id) : undefined;
  const bigBtn = "font-round font-semibold rounded-2xl transition active:scale-95";

  if (fill) {
    return (
      <div className="flex h-full w-full flex-col gap-2">
        {challenge && (
          <div className={`flex shrink-0 items-center gap-2 rounded-2xl border-2 px-3 py-2 ${solved ? "border-neon-green/70 bg-neon-green/10" : "border-neon-cyan/50 bg-neon-cyan/5"}`}>
            <span className="text-xl" aria-hidden>{solved ? "🎉" : "🎯"}</span>
            <p className="font-round text-sm font-bold text-ink">{solved ? "You did it! 🌟" : challenge.prompt}</p>
          </div>
        )}
        {/* parts — horizontal strip on top */}
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto rounded-2xl border-2 border-line bg-panel-2/40 p-2">
          <span className="shrink-0 px-1 font-round text-sm font-bold text-ink">🧰 Parts</span>
          {PART_ORDER.map((t) => (
            <button key={t} onPointerDown={(e) => startTrayDrag(t, e)} className="cs-tile flex shrink-0 touch-none flex-col items-center gap-0.5 rounded-2xl border-2 border-line bg-panel-2/70 px-2.5 py-1.5 hover:border-neon-green/70">
              <svg viewBox="0 0 120 88" className="h-8 w-12">{PART_DEFS[t].render({ id: `tray-${t}`, type: t, x: 0, y: 0, props: { ...PART_DEFS[t].defaultProps } }, IDLE, false)}</svg>
              <span className="font-round text-[11px] font-semibold text-ink-dim">{PART_DEFS[t].label}</span>
            </button>
          ))}
        </div>
        {/* board — fills the rest */}
        <div className="cs-board relative min-h-0 flex-1 overflow-hidden rounded-3xl border-2 border-[#2a3a6a]">
          <svg ref={svgRef} viewBox={`0 0 ${VBW} ${VBH}`} preserveAspectRatio="xMidYMid meet" className="block h-full w-full touch-none" onPointerDown={() => { setSel(null); setWireFrom(null); }} onPointerMove={onMove} onPointerUp={onUp}>
            <defs>
              <pattern id="cs-grid" width="38" height="38" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.6" fill="#36477e" /></pattern>
            </defs>
            <rect width={VBW} height={VBH} fill="url(#cs-grid)" />
            {doc.wires.map((w) => {
              const a = pinPos(doc, w.a), b = pinPos(doc, w.b);
              const dx = Math.max(30, Math.abs(b.x - a.x) * 0.4);
              const d = `M${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
              const live = sim.wireLive[w.id];
              const selected = sel?.kind === "wire" && sel.id === w.id;
              return (
                <g key={w.id}>
                  <path d={d} fill="none" stroke={selected ? "#22d3ee" : live ? "#34d399" : "#7e8bb5"} strokeWidth={selected ? 7 : 6} strokeLinecap="round" style={{ cursor: "pointer", filter: live ? "drop-shadow(0 0 6px #34d399)" : undefined }} onPointerDown={(e) => { e.stopPropagation(); if (!running) setSel({ kind: "wire", id: w.id }); }} />
                  {live && <path d={d} fill="none" stroke="#eafff4" strokeWidth="3" className="cl-wire-live" strokeLinecap="round" />}
                </g>
              );
            })}
            {doc.components.map((c) => {
              const st = sim.comp[c.id] || IDLE;
              const selected = sel?.kind === "component" && sel.id === c.id;
              return (
                <g key={c.id} className="cs-pop" transform={`translate(${c.x} ${c.y}) rotate(${c.rot || 0} ${CX} ${CY})`} style={{ cursor: running ? "pointer" : "grab" }} onPointerDown={(e) => onCompDown(c.id, e)}>
                  {selected && <rect x={-5} y={-5} width={BOX_W + 10} height={BOX_H + 10} rx="14" fill="#22d3ee18" stroke="#22d3ee" strokeWidth="2.5" strokeDasharray="7 5" />}
                  {PART_DEFS[c.type].render(c, st, running)}
                  {!running && PART_DEFS[c.type].pins.map((pin) => {
                    const isFrom = wireFrom?.c === c.id && wireFrom?.p === pin.id;
                    return <circle key={pin.id} cx={pin.x} cy={pin.y} r={isFrom ? 12 : 9} fill={isFrom ? "#22d3ee" : "#0b1228"} stroke={isFrom ? "#d6f7ff" : "#ffd54a"} strokeWidth="3" className={isFrom ? "" : "cs-pin-pulse"} style={{ cursor: "crosshair" }} onPointerDown={(e) => onPinDown({ c: c.id, p: pin.id }, e)} />;
                  })}
                </g>
              );
            })}
            {doc.components.length === 0 && (
              <text x={VBW / 2} y={VBH / 2} textAnchor="middle" fill="#8ea0cf" fontFamily="Fredoka, system-ui" fontSize="22" fontWeight="600">👈 Grab a part and drop it here!</text>
            )}
          </svg>
          <div className="absolute left-3 right-3 top-3 flex items-center justify-between gap-2">
            <button onClick={() => { setRunning((r) => !r); setWireFrom(null); }} className={`${bigBtn} flex items-center gap-2 px-5 py-2 text-base shadow-lg`} style={{ background: running ? "#fb7185" : "#34d399", color: "#06210f", boxShadow: running ? "0 6px 20px -4px rgba(251,113,133,.6)" : "0 6px 20px -4px rgba(52,211,153,.6)" }}>{running ? "⏸ Stop" : "▶ Play"}</button>
            <div className="flex items-center gap-2">
              {running && <span className="flex items-center gap-1.5 rounded-2xl bg-neon-green/15 px-3 py-1.5 font-round text-sm font-semibold text-neon-green">{sim.active ? "⚡ Power on!" : "💤 No power"}</span>}
              <button onClick={doSave} disabled={running || doc.components.length === 0} className={`${bigBtn} border-2 border-line bg-base/70 px-3 py-1.5 text-sm text-ink-dim hover:border-neon-cyan/60 hover:text-neon-cyan disabled:opacity-30`}>{savedFlash ? "Saved ✓" : "💾 Save"}</button>
              <button onClick={() => { setDoc({ components: [], wires: [] }); setSel(null); }} disabled={running} className={`${bigBtn} border-2 border-line bg-base/70 px-3 py-1.5 text-sm text-ink-dim hover:text-ink disabled:opacity-30`}>🧹 Clear</button>
            </div>
          </div>
          {selComp && (
            <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2 rounded-2xl border-2 border-line bg-base/90 px-3 py-2 shadow-lg backdrop-blur">
              <span className="flex items-center gap-1.5 font-round text-sm font-bold text-ink"><span className="text-lg">{PART_EMOJI[selComp.type]}</span>{PART_DEFS[selComp.type].label}</span>
              {selComp.type === "led" && (
                <div className="flex gap-1.5">{LED_COLORS.map((col) => (<button key={col} onClick={() => updateComp(selComp.id, {}, { color: col })} className="h-7 w-7 rounded-full transition active:scale-90" style={{ background: col, boxShadow: selComp.props.color === col ? `0 0 0 2px #fff, 0 0 0 4px ${col}` : "none" }} aria-label={col} />))}</div>
              )}
              {(selComp.type === "resistor" || selComp.type === "pot") && (
                <label className="flex items-center gap-2 font-round text-xs text-ink-dim"><span className="font-bold text-neon-cyan">{Number(selComp.props.ohms)} Ω</span><input type="range" min={selComp.type === "pot" ? 1 : 10} max={1000} step={10} value={Number(selComp.props.ohms)} onChange={(e) => updateComp(selComp.id, {}, { ohms: Number(e.target.value) })} className="h-2 w-24 accent-[#34d399]" /></label>
              )}
              {(selComp.type === "switch" || selComp.type === "button") && (
                <button onClick={() => updateComp(selComp.id, {}, { closed: !selComp.props.closed })} className="rounded-xl border-2 px-3 py-1.5 font-round text-sm font-bold transition active:scale-95" style={{ borderColor: selComp.props.closed ? "#34d399" : "#1e2a44", color: selComp.props.closed ? "#34d399" : "#9fb0d0" }}>{selComp.props.closed ? "✅ ON" : "⭕ OFF"}</button>
              )}
              <button onClick={rotateSel} disabled={running} className={`${bigBtn} border-2 border-line px-2.5 py-1.5 text-sm text-ink-dim hover:text-ink disabled:opacity-30`} title="Rotate">🔄</button>
              <button onClick={deleteSel} disabled={running} className={`${bigBtn} border-2 border-line px-2.5 py-1.5 text-sm text-ink-dim hover:border-neon-red/60 hover:text-neon-red disabled:opacity-30`} title="Remove">🗑️</button>
            </div>
          )}
        </div>
        {ghost && (
          <div className="pointer-events-none fixed z-50 opacity-90" style={{ left: ghost.x, top: ghost.y, transform: "translate(-50%, -50%)" }}>
            <svg viewBox="0 0 120 88" className="h-20 w-28">{PART_DEFS[ghost.type].render({ id: "ghost", type: ghost.type, x: 0, y: 0, props: { ...PART_DEFS[ghost.type].defaultProps } }, IDLE, false)}</svg>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {challenge && (
        <div className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 ${solved ? "border-neon-green/70 bg-neon-green/10" : "border-neon-cyan/50 bg-neon-cyan/5"}`}>
          <span className="text-2xl" aria-hidden>{solved ? "🎉" : "🎯"}</span>
          <div className="font-round">
            <p className="text-base font-bold text-ink">{solved ? "You did it! 🌟" : challenge.prompt}</p>
            <p className="text-xs text-ink-dim">{solved ? "Challenge complete — great job!" : "Build it, then press ▶ Play to check."}</p>
          </div>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[210px_1fr_220px]">
      {/* ── toy shelf ── */}
      <aside className="panel h-fit rounded-3xl border-2 border-line p-3">
        <p className="mb-2 px-1 font-round text-base font-bold text-ink">🧰 Parts</p>
        <div className="grid grid-cols-2 gap-2">
          {PART_ORDER.map((t) => (
            <button
              key={t}
              onPointerDown={(e) => startTrayDrag(t, e)}
              className="cs-tile flex touch-none flex-col items-center gap-0.5 rounded-2xl border-2 border-line bg-panel-2/70 p-2 hover:border-neon-green/70"
            >
              <svg viewBox="0 0 120 88" className="h-11 w-16">
                {PART_DEFS[t].render({ id: `tray-${t}`, type: t, x: 0, y: 0, props: { ...PART_DEFS[t].defaultProps } }, IDLE, false)}
              </svg>
              <span className="font-round text-[13px] font-semibold text-ink-dim">{PART_DEFS[t].label}</span>
            </button>
          ))}
        </div>

        {circuits.length > 0 && (
          <>
            <p className="mb-2 mt-4 px-1 font-round text-base font-bold text-ink">⭐ My circuits</p>
            <div className="space-y-1.5">
              {circuits.map((s) => (
                <div key={s.id} className="flex items-center gap-1">
                  <button onClick={() => loadDoc(s.doc)} className="flex-1 truncate rounded-xl border-2 border-line bg-panel-2/70 px-2.5 py-1.5 text-left font-round text-[13px] text-ink-dim transition hover:border-neon-cyan/60 hover:text-ink">
                    {s.name}
                  </button>
                  <button onClick={() => remove(s.id)} aria-label="Delete" className="rounded-lg px-2 py-1.5 text-ink-faint transition hover:text-neon-red">✕</button>
                </div>
              ))}
            </div>
          </>
        )}
      </aside>

      {/* ── workbench ── */}
      <div className="cs-board relative overflow-hidden rounded-3xl border-2 border-[#2a3a6a] p-0 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.6)]" style={{ aspectRatio: `${VBW}/${VBH}` }}>
        <svg ref={svgRef} viewBox={`0 0 ${VBW} ${VBH}`} className="block h-full w-full touch-none" onPointerDown={() => { setSel(null); setWireFrom(null); }} onPointerMove={onMove} onPointerUp={onUp}>
          <defs>
            <pattern id="cs-grid" width="38" height="38" patternUnits="userSpaceOnUse">
              <circle cx="3" cy="3" r="1.6" fill="#36477e" />
            </pattern>
          </defs>
          <rect width={VBW} height={VBH} fill="url(#cs-grid)" />

          {doc.wires.map((w) => {
            const a = pinPos(doc, w.a), b = pinPos(doc, w.b);
            const dx = Math.max(30, Math.abs(b.x - a.x) * 0.4);
            const d = `M${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
            const live = sim.wireLive[w.id];
            const selected = sel?.kind === "wire" && sel.id === w.id;
            return (
              <g key={w.id}>
                <path d={d} fill="none" stroke={selected ? "#22d3ee" : live ? "#34d399" : "#7e8bb5"} strokeWidth={selected ? 7 : 6} strokeLinecap="round" style={{ cursor: "pointer", filter: live ? "drop-shadow(0 0 6px #34d399)" : undefined }} onPointerDown={(e) => { e.stopPropagation(); if (!running) setSel({ kind: "wire", id: w.id }); }} />
                {live && <path d={d} fill="none" stroke="#eafff4" strokeWidth="3" className="cl-wire-live" strokeLinecap="round" />}
              </g>
            );
          })}

          {doc.components.map((c) => {
            const st = sim.comp[c.id] || IDLE;
            const selected = sel?.kind === "component" && sel.id === c.id;
            return (
              <g key={c.id} className="cs-pop" transform={`translate(${c.x} ${c.y}) rotate(${c.rot || 0} ${CX} ${CY})`} style={{ cursor: running ? "pointer" : "grab" }} onPointerDown={(e) => onCompDown(c.id, e)}>
                {selected && <rect x={-5} y={-5} width={BOX_W + 10} height={BOX_H + 10} rx="14" fill="#22d3ee18" stroke="#22d3ee" strokeWidth="2.5" strokeDasharray="7 5" />}
                {PART_DEFS[c.type].render(c, st, running)}
                {!running &&
                  PART_DEFS[c.type].pins.map((pin) => {
                    const isFrom = wireFrom?.c === c.id && wireFrom?.p === pin.id;
                    return <circle key={pin.id} cx={pin.x} cy={pin.y} r={isFrom ? 12 : 9} fill={isFrom ? "#22d3ee" : "#0b1228"} stroke={isFrom ? "#d6f7ff" : "#ffd54a"} strokeWidth="3" className={isFrom ? "" : "cs-pin-pulse"} style={{ cursor: "crosshair" }} onPointerDown={(e) => onPinDown({ c: c.id, p: pin.id }, e)} />;
                  })}
              </g>
            );
          })}

          {doc.components.length === 0 && (
            <text x={VBW / 2} y={VBH / 2} textAnchor="middle" fill="#8ea0cf" fontFamily="Fredoka, system-ui" fontSize="22" fontWeight="600">
              👈 Grab a part and drop it here!
            </text>
          )}
        </svg>

        {/* toolbar */}
        <div className="absolute left-3 right-3 top-3 flex items-center justify-between gap-2">
          <button onClick={() => { setRunning((r) => !r); setWireFrom(null); }} className={`${bigBtn} flex items-center gap-2 px-6 py-2.5 text-lg shadow-lg`} style={{ background: running ? "#fb7185" : "#34d399", color: "#06210f", boxShadow: running ? "0 6px 20px -4px rgba(251,113,133,.6)" : "0 6px 20px -4px rgba(52,211,153,.6)" }}>
            {running ? "⏸ Stop" : "▶ Play"}
          </button>
          <div className="flex items-center gap-2">
            {running && <span className="flex items-center gap-1.5 rounded-2xl bg-neon-green/15 px-3.5 py-2 font-round text-sm font-semibold text-neon-green">{sim.active ? "⚡ Power on!" : "💤 No power"}</span>}
            <button onClick={doSave} disabled={running || doc.components.length === 0} className={`${bigBtn} border-2 border-line bg-base/70 px-3.5 py-2 text-sm text-ink-dim hover:border-neon-cyan/60 hover:text-neon-cyan disabled:opacity-30`}>{savedFlash ? "Saved ✓" : "💾 Save"}</button>
            <button onClick={() => { setDoc({ components: [], wires: [] }); setSel(null); }} disabled={running} className={`${bigBtn} border-2 border-line bg-base/70 px-3.5 py-2 text-sm text-ink-dim hover:text-ink disabled:opacity-30`}>🧹 Clear</button>
          </div>
        </div>
      </div>

      {/* ── settings ── */}
      <aside className="panel h-fit rounded-3xl border-2 border-line p-3">
        <p className="mb-2 px-1 font-round text-base font-bold text-ink">⚙️ Settings</p>
        {!selComp && <p className="px-1 font-round text-sm text-ink-faint">Tap a part to change it 👆</p>}
        {selComp && (
          <div className="space-y-3">
            <p className="flex items-center gap-2 font-round text-base font-bold text-ink">
              <span className="text-xl">{PART_EMOJI[selComp.type]}</span> {PART_DEFS[selComp.type].label}
            </p>

            {selComp.type === "led" && (
              <div>
                <p className="mb-1.5 px-0.5 font-round text-sm text-ink-dim">Pick a colour</p>
                <div className="flex flex-wrap gap-2">
                  {LED_COLORS.map((col) => (
                    <button key={col} onClick={() => updateComp(selComp.id, {}, { color: col })} className="h-9 w-9 rounded-full transition active:scale-90" style={{ background: col, boxShadow: selComp.props.color === col ? `0 0 0 3px #fff, 0 0 0 5px ${col}` : "none" }} aria-label={col} />
                  ))}
                </div>
              </div>
            )}

            {(selComp.type === "resistor" || selComp.type === "pot") && (
              <div>
                <div className="mb-1 flex items-center justify-between px-0.5 font-round text-sm text-ink-dim"><span>How strong?</span><span className="font-bold text-neon-cyan">{Number(selComp.props.ohms)} Ω</span></div>
                <input type="range" min={selComp.type === "pot" ? 1 : 10} max={1000} step={10} value={Number(selComp.props.ohms)} onChange={(e) => updateComp(selComp.id, {}, { ohms: Number(e.target.value) })} className="h-2 w-full accent-[#34d399]" />
              </div>
            )}

            {(selComp.type === "switch" || selComp.type === "button") && (
              <button onClick={() => updateComp(selComp.id, {}, { closed: !selComp.props.closed })} className="w-full rounded-2xl border-2 px-3 py-2.5 font-round font-bold transition active:scale-95" style={{ borderColor: selComp.props.closed ? "#34d399" : "#1e2a44", color: selComp.props.closed ? "#34d399" : "#9fb0d0", background: selComp.props.closed ? "#34d39915" : undefined }}>
                {selComp.props.closed ? "✅ ON" : "⭕ OFF"}
              </button>
            )}

            {selComp.type === "battery" && <p className="px-0.5 font-round text-sm text-ink-dim">⚡ 9 volts of power</p>}

            <button onClick={rotateSel} disabled={running} className={`${bigBtn} w-full border-2 border-line px-3 py-2.5 text-sm text-ink-dim hover:text-ink disabled:opacity-30`}>🔄 Turn it</button>

            {running && <p className="rounded-xl bg-panel-2/60 px-3 py-2 text-center font-round text-sm font-semibold text-neon-cyan">{(Math.abs(sim.comp[selComp.id]?.current || 0) * 1000).toFixed(0)} mA flowing</p>}

            <button onClick={deleteSel} disabled={running} className={`${bigBtn} w-full border-2 border-line px-3 py-2.5 text-sm text-ink-dim hover:border-neon-red/60 hover:text-neon-red disabled:opacity-30`}>🗑️ Remove</button>
          </div>
        )}

        <div className="mt-4 rounded-2xl bg-panel-2/50 p-3 font-round text-[13px] leading-relaxed text-ink-dim">
          <p className="font-bold text-ink">How to play 🎮</p>
          <p className="mt-1">1. Drag a part onto the board</p>
          <p>2. Tap a yellow dot, then another, to join them</p>
          <p>3. Press <span className="font-bold text-neon-green">▶ Play</span>!</p>
        </div>
      </aside>

      {ghost && (
        <div className="pointer-events-none fixed z-50 opacity-90" style={{ left: ghost.x, top: ghost.y, transform: "translate(-50%, -50%)" }}>
          <svg viewBox="0 0 120 88" className="h-20 w-28">
            {PART_DEFS[ghost.type].render({ id: "ghost", type: ghost.type, x: 0, y: 0, props: { ...PART_DEFS[ghost.type].defaultProps } }, IDLE, false)}
          </svg>
        </div>
      )}
      </div>
    </div>
  );
}
