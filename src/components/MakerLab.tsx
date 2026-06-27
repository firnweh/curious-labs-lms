"use client";

import { useEffect, useRef, useState } from "react";
import { CircuitStudio } from "@/components/CircuitStudio";
import { ArduinoStudio } from "@/components/ArduinoStudio";

/**
 * Maker Lab — the circuit wiring lab and the Arduino code studio in one place.
 * The circuit is the main area; the code studio sits in a panel below that you
 * can drag taller/shorter, expand, or collapse out of the way.
 */
export function MakerLab() {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [codePct, setCodePct] = useState(40); // code-panel height, % of the lab
  const [open, setOpen] = useState(true);
  const lastPct = useRef(40);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((rect.bottom - e.clientY) / rect.height) * 100;
      setCodePct(Math.min(82, Math.max(16, pct)));
    };
    const onUp = () => { dragging.current = false; document.body.style.userSelect = ""; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const collapse = () => { lastPct.current = codePct; setOpen(false); };
  const restore = () => { setOpen(true); setCodePct(lastPct.current || 40); };
  const expand = () => { setOpen(true); setCodePct((p) => (p >= 70 ? 40 : 74)); };

  return (
    <div ref={containerRef} className="flex h-[84vh] flex-col overflow-hidden rounded-3xl border-2 border-line bg-base/40">
      {/* Circuit area */}
      <section className="min-h-0 flex-1 overflow-auto p-3">
        <div className="mb-2 flex items-center gap-2 px-1">
          <span className="text-lg" aria-hidden>⚡</span>
          <h2 className="font-round text-lg font-bold text-ink">Circuit</h2>
          <span className="font-round text-xs text-ink-faint">— grab parts &amp; wire them up</span>
        </div>
        <CircuitStudio />
      </section>

      {/* Drag handle + code-panel controls */}
      <div
        onMouseDown={() => { if (!open) return; dragging.current = true; document.body.style.userSelect = "none"; }}
        className={`group flex select-none items-center justify-between gap-2 border-t-2 border-line bg-panel-2/60 px-3 py-1.5 ${open ? "cursor-row-resize" : ""}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden>{"</>"}</span>
          <span className="font-round text-sm font-bold text-ink">Code</span>
          {open && <span className="hidden font-mono text-[10px] text-ink-faint sm:inline">⇕ drag to resize</span>}
        </div>
        <div className="flex items-center gap-1.5" onMouseDown={(e) => e.stopPropagation()}>
          <button onClick={expand} className="rounded-lg border border-line/70 bg-base/50 px-2.5 py-1 font-mono text-[11px] text-ink-dim transition hover:border-neon-cyan/50 hover:text-ink">
            {codePct >= 70 ? "↘ shrink" : "↗ expand"}
          </button>
          {open
            ? <button onClick={collapse} className="rounded-lg border border-line/70 bg-base/50 px-2.5 py-1 font-mono text-[11px] text-ink-dim transition hover:border-neon-cyan/50 hover:text-ink">▾ hide</button>
            : <button onClick={restore} className="rounded-lg bg-neon-cyan/15 px-2.5 py-1 font-mono text-[11px] font-semibold text-neon-cyan transition hover:bg-neon-cyan/25">▴ show code</button>}
        </div>
      </div>

      {/* Code area */}
      {open && (
        <section className="min-h-0 overflow-auto bg-[#0a1020] p-3" style={{ height: `${codePct}%` }}>
          <ArduinoStudio />
        </section>
      )}
    </div>
  );
}
