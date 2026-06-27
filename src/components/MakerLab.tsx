"use client";

import { useEffect, useRef, useState } from "react";
import { CircuitStudio } from "@/components/CircuitStudio";
import { ArduinoStudio } from "@/components/ArduinoStudio";

type View = "split" | "circuit" | "code";

/**
 * Maker Lab — full-screen workspace combining the circuit wiring lab and the
 * Arduino code studio. Two panes (Circuit · Code) with a draggable divider, and
 * a Circuit / Split / Code switcher to focus either side. No page chrome — just
 * the platform.
 */
export function MakerLab() {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [view, setView] = useState<View>("split");
  const [codePct, setCodePct] = useState(44); // code-pane width, % (split view)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = 100 - ((e.clientX - rect.left) / rect.width) * 100;
      setCodePct(Math.min(78, Math.max(22, pct)));
    };
    const onUp = () => { dragging.current = false; document.body.style.userSelect = ""; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const seg = (v: View, label: string) =>
    `rounded-lg px-3 py-1.5 font-mono text-xs font-semibold transition ${view === v ? "bg-neon-cyan/15 text-neon-cyan" : "text-ink-faint hover:text-ink-dim"}`;

  const showCircuit = view !== "code";
  const showCode = view !== "circuit";

  return (
    <div className="flex h-full flex-col bg-base">
      {/* slim top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b-2 border-line bg-base/80 px-3 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <a href="/" className="flex items-center gap-1.5 text-ink-faint transition hover:text-ink" title="Back to Curious Labs">
            <span className="text-lg">‹</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/curious-labs-logo.png" alt="Curious Labs" className="h-7 w-auto" />
          </a>
          <span className="hidden font-mono text-xs tracking-tech text-ink-dim sm:inline">🔧 Maker Lab</span>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-line/70 bg-panel-2/50 p-1">
          <button onClick={() => setView("circuit")} className={seg("circuit", "Circuit")}>⚡ Circuit</button>
          <button onClick={() => setView("split")} className={seg("split", "Split")}>⊟ Split</button>
          <button onClick={() => setView("code")} className={seg("code", "Code")}>{"</>"} Code</button>
        </div>
      </header>

      {/* panes */}
      <div ref={containerRef} className="flex min-h-0 flex-1">
        {showCircuit && (
          <section
            className="min-w-0 overflow-auto p-3"
            style={{ width: view === "split" ? `${100 - codePct}%` : "100%" }}
          >
            <CircuitStudio />
          </section>
        )}

        {view === "split" && (
          <div
            onMouseDown={() => { dragging.current = true; document.body.style.userSelect = "none"; }}
            className="group flex w-2 shrink-0 cursor-col-resize items-center justify-center border-x border-line bg-panel-2/60 hover:bg-neon-cyan/20"
            title="Drag to resize"
          >
            <div className="h-10 w-0.5 rounded-full bg-line group-hover:bg-neon-cyan" />
          </div>
        )}

        {showCode && (
          <section
            className="min-w-0 overflow-auto bg-[#0a1020] p-3"
            style={{ width: view === "split" ? `${codePct}%` : "100%" }}
          >
            <ArduinoStudio />
          </section>
        )}
      </div>
    </div>
  );
}
