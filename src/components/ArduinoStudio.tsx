"use client";

import { useEffect, useRef, useState } from "react";
import * as Blockly from "blockly";
import {
  registerArduinoBlocks,
  arduinoGenerator,
  arduinoTheme,
  ARDUINO_TOOLBOX,
} from "@/lib/arduinoBlocks";

const BOARDS = [
  { id: "uno", label: "Arduino Uno", fqbn: "arduino:avr:uno" },
  { id: "nano", label: "Arduino Nano", fqbn: "arduino:avr:nano" },
  { id: "mega", label: "Arduino Mega", fqbn: "arduino:avr:mega" },
  { id: "esp32", label: "ESP32", fqbn: "esp32:esp32:esp32" },
  { id: "esp8266", label: "ESP8266 (NodeMCU)", fqbn: "esp8266:esp8266:nodemcuv2" },
];

const STARTER = { blocks: { blocks: [{ type: "arduino_sketch", x: 40, y: 40 }] } };

/**
 * Block-based Arduino studio. Drag blocks → live Arduino/C++ (.ino) on the
 * right, with a board selector, copy and download. Compile + flash (WebSerial)
 * and the IoT dashboard are future phases — this is the editor + code engine.
 */
export function ArduinoStudio() {
  const blocklyDiv = useRef<HTMLDivElement>(null);
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const [code, setCode] = useState("");
  const [board, setBoard] = useState(BOARDS[0]);
  const [copied, setCopied] = useState(false);
  const boardRef = useRef(board);
  boardRef.current = board;

  useEffect(() => {
    registerArduinoBlocks();
    if (!blocklyDiv.current) return;
    const ws = Blockly.inject(blocklyDiv.current, {
      toolbox: ARDUINO_TOOLBOX as unknown as Blockly.utils.toolbox.ToolboxDefinition,
      theme: arduinoTheme(),
      renderer: "zelos",
      grid: { spacing: 28, length: 2, colour: "#1e293b", snap: true },
      zoom: { controls: true, wheel: true, startScale: 0.85, maxScale: 2.5, minScale: 0.3, pinch: true },
      move: { scrollbars: true, drag: true, wheel: true },
      trashcan: true,
    });
    wsRef.current = ws;
    try { Blockly.serialization.workspaces.load(STARTER, ws); } catch { /* ignore */ }

    const regen = () => {
      try {
        const body = arduinoGenerator.workspaceToCode(ws);
        setCode(`// Curious Labs — ${boardRef.current.label}\n\n${body}`);
      } catch { /* ignore */ }
    };
    ws.addChangeListener((e) => {
      if ((e as Blockly.Events.Abstract).isUiEvent) return;
      regen();
    });
    regen();

    const ro = new ResizeObserver(() => Blockly.svgResize(ws));
    ro.observe(blocklyDiv.current);
    const t = window.setTimeout(() => Blockly.svgResize(ws), 200);
    return () => { ro.disconnect(); window.clearTimeout(t); ws.dispose(); };
  }, []);

  // Re-stamp the board name in the header comment when the board changes.
  useEffect(() => {
    setCode((c) => c.replace(/^\/\/ Curious Labs — .*$/m, `// Curious Labs — ${board.label}`));
  }, [board]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
    a.download = "curious_labs.ino";
    a.click();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_minmax(320px,420px)]">
      {/* Blockly canvas */}
      <div className="overflow-hidden rounded-2xl border border-line/70 bg-[#0e1726]">
        <div ref={blocklyDiv} className="h-[640px] w-full" />
      </div>

      {/* Code panel */}
      <div className="flex h-[640px] flex-col overflow-hidden rounded-2xl border border-line/70 bg-[#0b1220]">
        <div className="flex items-center justify-between gap-2 border-b border-line/60 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs tracking-tech text-neon-cyan">curious_labs.ino</span>
          </div>
          <select
            value={board.id}
            onChange={(e) => setBoard(BOARDS.find((b) => b.id === e.target.value) ?? BOARDS[0])}
            className="rounded-lg border border-line/70 bg-[#0e1726] px-2 py-1 font-mono text-xs text-ink-dim focus:border-neon-cyan/60 focus:outline-none"
          >
            {BOARDS.map((b) => (<option key={b.id} value={b.id}>{b.label}</option>))}
          </select>
        </div>
        <pre className="flex-1 overflow-auto p-3 font-mono text-[12px] leading-relaxed text-emerald-200">{code || "// drag blocks to build your sketch"}</pre>
        <div className="flex items-center gap-2 border-t border-line/60 p-2">
          <button onClick={copy} className="flex-1 rounded-lg border border-line/70 bg-[#0e1726] py-2 font-mono text-xs text-ink-dim transition hover:border-neon-cyan/50 hover:text-ink">
            {copied ? "✓ Copied" : "⧉ Copy code"}
          </button>
          <button onClick={download} className="flex-1 rounded-lg bg-neon-cyan/15 py-2 font-mono text-xs font-semibold text-neon-cyan transition hover:bg-neon-cyan/25">
            ⬇ Download .ino
          </button>
        </div>
      </div>
    </div>
  );
}
