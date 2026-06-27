"use client";

import { useEffect, useRef, useState } from "react";
import { CircuitStudio } from "@/components/CircuitStudio";
import { ArduinoStudio } from "@/components/ArduinoStudio";
import { PILL, PILL_GHOST, PILL_ACTIVE } from "@/lib/maker-ui";

type View = "split" | "circuit" | "code";

/**
 * Maker Lab — full-screen workspace combining the circuit wiring lab and the
 * Arduino code studio. Two panes (Circuit · Code) with a draggable divider and
 * a Circuit / Split / Code switcher. Premium "midnight + electric cyan" theme.
 */
export function MakerLab() {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [view, setView] = useState<View>("split");
  const [codePct, setCodePct] = useState(44);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = 100 - ((e.clientX - rect.left) / rect.width) * 100;
      setCodePct(Math.min(78, Math.max(22, pct)));
    };
    const onUp = () => { dragging.current = false; setIsDragging(false); document.body.style.userSelect = ""; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const seg = (v: View) => `${PILL} ${view === v ? PILL_ACTIVE : PILL_GHOST}`;
  const showCircuit = view !== "code";
  const showCode = view !== "circuit";

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* ambient glow */}
      <div className="pointer-events-none absolute -top-48 left-1/2 h-[520px] w-[860px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[130px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[360px] w-[460px] rounded-full bg-indigo-600/10 blur-[120px]" />

      {/* top bar */}
      <header className="relative z-10 flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-[#0a0e1a]/70 px-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-2 text-[#566091] transition hover:text-[#e8eefc]" title="Back to Curious Labs">
            <span className="text-lg leading-none">‹</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/curious-labs-logo.png" alt="Curious Labs" className="h-6 w-auto opacity-90" />
          </a>
          <span className="hidden items-center gap-2 text-sm font-medium tracking-wide text-[#e8eefc] sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_2px_rgba(34,211,238,0.7)]" />
            Maker Lab
          </span>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
          <button onClick={() => setView("circuit")} className={seg("circuit")}>⚡ Circuit</button>
          <button onClick={() => setView("split")} className={seg("split")}>⊟ Split</button>
          <button onClick={() => setView("code")} className={seg("code")}>{"</>"} Code</button>
        </div>
      </header>

      {/* panes */}
      <div ref={containerRef} className="relative z-10 flex min-h-0 flex-1">
        {showCircuit && (
          <section
            className={`flex min-w-0 overflow-hidden p-3 ${isDragging ? "pointer-events-none" : ""}`}
            style={{ width: view === "split" ? `${100 - codePct}%` : "100%" }}
          >
            <CircuitStudio fill />
          </section>
        )}

        {view === "split" && (
          <div
            onMouseDown={() => { dragging.current = true; setIsDragging(true); document.body.style.userSelect = "none"; }}
            className={`group relative flex w-3 shrink-0 cursor-col-resize items-center justify-center transition-colors ${isDragging ? "bg-cyan-400/25" : "hover:bg-cyan-400/15"}`}
            title="Drag to resize circuit / code"
          >
            <span className="absolute inset-y-0 -left-2.5 -right-2.5" aria-hidden />
            <div className="flex flex-col gap-1.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className={`h-1 w-1 rounded-full transition-colors ${isDragging ? "bg-cyan-300" : "bg-[#566091] group-hover:bg-cyan-300"}`} />
              ))}
            </div>
          </div>
        )}

        {showCode && (
          <section
            className={`flex min-w-0 overflow-hidden p-3 ${isDragging ? "pointer-events-none" : ""}`}
            style={{ width: view === "split" ? `${codePct}%` : "100%" }}
          >
            <ArduinoStudio />
          </section>
        )}
      </div>
    </div>
  );
}
