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
  { id: "pw_curious", label: "PW Curious Board" },
  { id: "pw_curious_wifi", label: "Curious WiFi Board" },
  { id: "uno", label: "Arduino Uno" },
  { id: "nano", label: "Arduino Nano" },
  { id: "mega", label: "Arduino Mega" },
  { id: "esp32", label: "ESP32" },
  { id: "esp8266", label: "ESP8266 (NodeMCU)" },
];
const BAUDS = [9600, 115200, 57600, 4800];
const STARTER = { blocks: { blocks: [{ type: "arduino_sketch", x: 40, y: 40 }] } };

type Nav = Navigator & { serial?: { requestPort: () => Promise<SerialPortLike> } };
interface SerialPortLike {
  open: (o: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}

/**
 * Block-based Arduino studio with a block↔text toggle, board selector, and a
 * Web Serial "Connect board" + live Serial Monitor. Compile + flash and the IoT
 * dashboard are the next phases (need a compile service / MQTT backend).
 */
export function ArduinoStudio() {
  const blocklyDiv = useRef<HTMLDivElement>(null);
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const [view, setView] = useState<"blocks" | "code">("blocks");
  const [genCode, setGenCode] = useState("");
  const [manualCode, setManualCode] = useState<string | null>(null);
  const [board, setBoard] = useState(BOARDS[0]);
  const [copied, setCopied] = useState(false);
  const boardRef = useRef(board);
  boardRef.current = board;

  const code = manualCode ?? genCode;

  // ── Blockly ──
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
        setGenCode(`// Curious Labs — ${boardRef.current.label}\n\n${body}`);
      } catch { /* ignore */ }
    };
    ws.addChangeListener((e) => { if (!(e as Blockly.Events.Abstract).isUiEvent) regen(); });
    regen();
    const ro = new ResizeObserver(() => Blockly.svgResize(ws));
    ro.observe(blocklyDiv.current);
    const t = window.setTimeout(() => Blockly.svgResize(ws), 200);
    return () => { ro.disconnect(); window.clearTimeout(t); ws.dispose(); };
  }, []);

  // keep the board name fresh in the generated header comment
  useEffect(() => {
    setGenCode((c) => c.replace(/^\/\/ Curious Labs — .*$/m, `// Curious Labs — ${board.label}`));
  }, [board]);

  // re-size Blockly when returning to the blocks view
  useEffect(() => {
    if (view === "blocks" && wsRef.current) setTimeout(() => Blockly.svgResize(wsRef.current!), 50);
  }, [view]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
    a.download = "curious_labs.ino";
    a.click();
  };

  // ── Web Serial: connect + live monitor ──
  const portRef = useRef<SerialPortLike | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const [connected, setConnected] = useState(false);
  const [monBaud, setMonBaud] = useState(9600);
  const [serialOut, setSerialOut] = useState("");
  const [sendText, setSendText] = useState("");
  const [monOpen, setMonOpen] = useState(false);

  const connect = async () => {
    const nav = navigator as Nav;
    if (!nav.serial) { setSerialOut("⚠ Web Serial needs Chrome or Edge (desktop). Plug in your board over USB and try again."); return; }
    try {
      const port = await nav.serial.requestPort();
      await port.open({ baudRate: monBaud });
      portRef.current = port;
      setConnected(true);
      setMonOpen(true);
      setSerialOut("✓ Connected. Listening…\n");
      if (port.readable) {
        const dec = new TextDecoderStream();
        port.readable.pipeTo(dec.writable as unknown as WritableStream<Uint8Array>).catch(() => {});
        const reader = dec.readable.getReader();
        readerRef.current = reader;
        (async () => {
          try {
            for (;;) {
              const { value, done } = await reader.read();
              if (done) break;
              if (value) setSerialOut((s) => (s + value).slice(-6000));
            }
          } catch { /* closed */ }
        })();
      }
    } catch (e) {
      setSerialOut("Couldn't connect: " + (e instanceof Error ? e.message : String(e)));
    }
  };
  const disconnect = async () => {
    try { await readerRef.current?.cancel(); } catch { /* ignore */ }
    try { await portRef.current?.close(); } catch { /* ignore */ }
    portRef.current = null;
    setConnected(false);
  };
  const sendSerial = async () => {
    const port = portRef.current;
    if (!port?.writable || !sendText) return;
    const w = port.writable.getWriter();
    try { await w.write(new TextEncoder().encode(sendText + "\n")); } finally { w.releaseLock(); }
    setSendText("");
  };

  const tab = (v: "blocks" | "code", label: string) =>
    `rounded-lg px-3 py-1.5 font-mono text-xs font-semibold transition ${view === v ? "bg-neon-cyan/15 text-neon-cyan" : "text-ink-faint hover:text-ink-dim"}`;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-line/70 bg-[#0b1220] p-1">
          <button onClick={() => setView("blocks")} className={tab("blocks", "Blocks")}>🧩 Blocks</button>
          <button onClick={() => setView("code")} className={tab("code", "Code")}>{"</>"} Code</button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={board.id} onChange={(e) => setBoard(BOARDS.find((b) => b.id === e.target.value) ?? BOARDS[0])}
            className="rounded-lg border border-line/70 bg-[#0e1726] px-2 py-1.5 font-mono text-xs text-ink-dim focus:border-neon-cyan/60 focus:outline-none">
            {BOARDS.map((b) => (<option key={b.id} value={b.id}>{b.label}</option>))}
          </select>
          <button onClick={copy} className="rounded-lg border border-line/70 bg-[#0e1726] px-3 py-1.5 font-mono text-xs text-ink-dim transition hover:border-neon-cyan/50 hover:text-ink">{copied ? "✓ Copied" : "⧉ Copy"}</button>
          <button onClick={download} className="rounded-lg border border-line/70 bg-[#0e1726] px-3 py-1.5 font-mono text-xs text-ink-dim transition hover:border-neon-cyan/50 hover:text-ink">⬇ .ino</button>
          {connected
            ? <button onClick={disconnect} className="rounded-lg bg-neon-red/15 px-3 py-1.5 font-mono text-xs font-semibold text-neon-red transition hover:bg-neon-red/25">⏏ Disconnect</button>
            : <button onClick={connect} className="rounded-lg bg-neon-cyan/15 px-3 py-1.5 font-mono text-xs font-semibold text-neon-cyan transition hover:bg-neon-cyan/25">🔌 Connect board</button>}
        </div>
      </div>

      {/* Editor body */}
      <div className={view === "blocks" ? "grid gap-4 lg:grid-cols-[1fr_minmax(320px,420px)]" : "hidden"}>
        <div className="overflow-hidden rounded-2xl border border-line/70 bg-[#0e1726]"><div ref={blocklyDiv} className="h-[560px] w-full" /></div>
        <div className="flex h-[560px] flex-col overflow-hidden rounded-2xl border border-line/70 bg-[#0b1220]">
          <div className="border-b border-line/60 px-3 py-2 font-mono text-xs tracking-tech text-neon-cyan">curious_labs.ino</div>
          <pre className="flex-1 overflow-auto p-3 font-mono text-[12px] leading-relaxed text-emerald-200">{code || "// drag blocks to build your sketch"}</pre>
        </div>
      </div>
      <div className={view === "code" ? "block" : "hidden"}>
        <div className="overflow-hidden rounded-2xl border border-line/70 bg-[#0b1220]">
          <div className="flex items-center justify-between border-b border-line/60 px-3 py-2">
            <span className="font-mono text-xs tracking-tech text-neon-cyan">curious_labs.ino {manualCode != null && <span className="text-amber-400">· edited</span>}</span>
            {manualCode != null && <button onClick={() => setManualCode(null)} className="font-mono text-[11px] text-neon-violet hover:underline">↻ regenerate from blocks</button>}
          </div>
          <textarea
            value={code}
            onChange={(e) => setManualCode(e.target.value)}
            spellCheck={false}
            className="h-[560px] w-full resize-none bg-transparent p-3 font-mono text-[12px] leading-relaxed text-emerald-200 outline-none"
          />
        </div>
      </div>

      {/* Serial Monitor (collapsible) */}
      <div className="overflow-hidden rounded-2xl border border-line/70 bg-[#0b1220]">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <button onClick={() => setMonOpen((o) => !o)} className="flex items-center gap-1.5 font-mono text-xs tracking-tech text-ink-dim transition hover:text-ink">
            <span className="text-ink-faint">{monOpen ? "▾" : "▸"}</span>🖥️ Serial Monitor {connected && <span className="text-neon-green">● live</span>}
          </button>
          {monOpen && (
            <div className="flex items-center gap-2">
              <select value={monBaud} onChange={(e) => setMonBaud(Number(e.target.value))} disabled={connected}
                className="rounded-lg border border-line/70 bg-[#0e1726] px-2 py-1 font-mono text-[11px] text-ink-dim focus:outline-none disabled:opacity-50">
                {BAUDS.map((b) => (<option key={b} value={b}>{b} baud</option>))}
              </select>
              <button onClick={() => setSerialOut("")} className="font-mono text-[11px] text-ink-faint hover:text-ink-dim">clear</button>
            </div>
          )}
        </div>
        {monOpen && (
          <>
            <pre className="h-36 overflow-auto whitespace-pre-wrap break-words border-t border-line/60 p-3 font-mono text-[11px] leading-relaxed text-cyan-200">{serialOut || "Connect a board over USB to see its Serial output here. (Chrome/Edge desktop)"}</pre>
            <div className="flex items-center gap-2 border-t border-line/60 p-2">
              <input value={sendText} onChange={(e) => setSendText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendSerial()} disabled={!connected}
                placeholder={connected ? "send to board…" : "connect a board to send"} className="flex-1 rounded-lg border border-line/70 bg-[#0e1726] px-3 py-1.5 font-mono text-xs text-ink placeholder:text-ink-faint focus:border-neon-cyan/60 focus:outline-none disabled:opacity-50" />
              <button onClick={sendSerial} disabled={!connected} className="rounded-lg border border-line/70 bg-[#0e1726] px-3 py-1.5 font-mono text-xs text-ink-dim transition hover:border-neon-cyan/50 hover:text-ink disabled:opacity-50">Send</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
