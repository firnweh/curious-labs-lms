"use client";

import { useEffect, useRef, useState } from "react";
import * as Blockly from "blockly";
import {
  registerArduinoBlocks,
  arduinoGenerator,
  arduinoTheme,
  ARDUINO_TOOLBOX,
} from "@/lib/arduinoBlocks";
import { CARD, CHIP, PILL, PILL_GHOST, PILL_ACTIVE, PILL_CYAN, MONO, MUTED, FAINT } from "@/lib/maker-ui";

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

type Tab = "blocks" | "code" | "serial" | "plotter";
type Nav = Navigator & { serial?: { requestPort: () => Promise<SerialPortLike> } };
interface SerialPortLike {
  open: (o: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}

/**
 * Block-based Arduino studio. Tabs: Blocks (canvas only) · Code (editable .ino)
 * · Serial (monitor) · Plotter (live chart of serial numbers). Board selector +
 * Web Serial "Connect board". Fills its container height.
 */
export function ArduinoStudio() {
  const blocklyDiv = useRef<HTMLDivElement>(null);
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const [tab, setTab] = useState<Tab>("blocks");
  const [genCode, setGenCode] = useState("");
  const [manualCode, setManualCode] = useState<string | null>(null);
  const [board, setBoard] = useState(BOARDS[0]);
  const [copied, setCopied] = useState(false);
  const boardRef = useRef(board);
  boardRef.current = board;
  const code = manualCode ?? genCode;

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
      try { setGenCode(`// Curious Labs — ${boardRef.current.label}\n\n${arduinoGenerator.workspaceToCode(ws)}`); } catch { /* ignore */ }
    };
    ws.addChangeListener((e) => { if (!(e as Blockly.Events.Abstract).isUiEvent) regen(); });
    regen();
    const ro = new ResizeObserver(() => Blockly.svgResize(ws));
    ro.observe(blocklyDiv.current);
    const t = window.setTimeout(() => Blockly.svgResize(ws), 200);
    return () => { ro.disconnect(); window.clearTimeout(t); ws.dispose(); };
  }, []);

  useEffect(() => { setGenCode((c) => c.replace(/^\/\/ Curious Labs — .*$/m, `// Curious Labs — ${board.label}`)); }, [board]);
  useEffect(() => { if (tab === "blocks" && wsRef.current) setTimeout(() => Blockly.svgResize(wsRef.current!), 60); }, [tab]);

  const copy = async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } };
  const download = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([code], { type: "text/plain" })); a.download = "curious_labs.ino"; a.click(); };

  // ── Web Serial: monitor + plotter ──
  const portRef = useRef<SerialPortLike | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const lineBuf = useRef("");
  const [connected, setConnected] = useState(false);
  const [monBaud, setMonBaud] = useState(9600);
  const [serialOut, setSerialOut] = useState("");
  const [sendText, setSendText] = useState("");
  const [plot, setPlot] = useState<number[][]>([]);

  const connect = async () => {
    const nav = navigator as Nav;
    if (!nav.serial) { setSerialOut("⚠ Web Serial needs Chrome or Edge (desktop). Plug in your board over USB and try again."); setTab("serial"); return; }
    try {
      const port = await nav.serial.requestPort();
      await port.open({ baudRate: monBaud });
      portRef.current = port;
      setConnected(true);
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
              if (!value) continue;
              lineBuf.current += value;
              const parts = lineBuf.current.split(/\r?\n/);
              lineBuf.current = parts.pop() ?? "";
              if (!parts.length) continue;
              setSerialOut((s) => (s + parts.join("\n") + "\n").slice(-6000));
              const samples = parts
                .map((l) => l.trim().split(/[\s,;]+/).map(Number).filter((n) => Number.isFinite(n)))
                .filter((a) => a.length);
              if (samples.length) setPlot((p) => [...p, ...samples].slice(-150));
            }
          } catch { /* closed */ }
        })();
      }
    } catch (e) {
      setSerialOut("Couldn't connect: " + (e instanceof Error ? e.message : String(e)));
      setTab("serial");
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

  const tabBtn = (t: Tab) => `${PILL} ${tab === t ? PILL_ACTIVE : PILL_GHOST}`;

  return (
    <div className="flex h-full w-full flex-col gap-2.5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
          <button onClick={() => setTab("blocks")} className={tabBtn("blocks")}>🧩 Blocks</button>
          <button onClick={() => setTab("code")} className={tabBtn("code")}>{"</>"} Code</button>
          <button onClick={() => setTab("serial")} className={tabBtn("serial")}>🖥️ Serial{connected && <span className="ml-1 text-emerald-400">●</span>}</button>
          <button onClick={() => setTab("plotter")} className={tabBtn("plotter")}>📈 Plotter</button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={board.id} onChange={(e) => setBoard(BOARDS.find((b) => b.id === e.target.value) ?? BOARDS[0])}
            className={`${CHIP} cursor-pointer ${MONO}`}>
            {BOARDS.map((b) => (<option key={b.id} value={b.id} className="bg-[#0c1222] text-[#e8eefc]">{b.label}</option>))}
          </select>
          <button onClick={copy} className={CHIP}>{copied ? "✓ Copied" : "⧉ Copy"}</button>
          <button onClick={download} className={CHIP}>⬇ .ino</button>
          {connected
            ? <button onClick={disconnect} className={`${PILL} bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30 hover:bg-rose-500/25`}>⏏ Disconnect</button>
            : <button onClick={connect} className={`${PILL} ${PILL_CYAN}`}>🔌 Connect</button>}
        </div>
      </div>

      {/* Tab body (fills) */}
      <div className={`relative min-h-0 flex-1 overflow-hidden ${CARD}`}>
        {/* Blockly stays mounted; only visible on the Blocks tab */}
        <div ref={blocklyDiv} className={`h-full w-full ${tab === "blocks" ? "" : "hidden"}`} style={{ background: "#0a0f1e" }} />

        {tab === "code" && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <span className={`${MONO} text-xs text-cyan-300`}>curious_labs.ino {manualCode != null && <span className="text-amber-300">· edited</span>}</span>
              {manualCode != null && <button onClick={() => setManualCode(null)} className={`${MONO} text-[11px] text-violet-300 hover:underline`}>↻ regenerate from blocks</button>}
            </div>
            <textarea value={code} onChange={(e) => setManualCode(e.target.value)} spellCheck={false}
              className={`min-h-0 w-full flex-1 resize-none bg-transparent p-3 ${MONO} text-[12.5px] leading-relaxed text-emerald-200 outline-none`} />
          </div>
        )}

        {tab === "serial" && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
              <span className={`${MONO} text-xs ${MUTED}`}>🖥️ Serial Monitor {connected && <span className="text-emerald-400">● live</span>}</span>
              <div className="flex items-center gap-2">
                <select value={monBaud} onChange={(e) => setMonBaud(Number(e.target.value))} disabled={connected}
                  className={`rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 ${MONO} text-[11px] ${MUTED} focus:outline-none disabled:opacity-50`}>
                  {BAUDS.map((b) => (<option key={b} value={b} className="bg-[#0c1222]">{b} baud</option>))}
                </select>
                <button onClick={() => setSerialOut("")} className={`${MONO} text-[11px] ${FAINT} hover:text-[#8595bd]`}>clear</button>
              </div>
            </div>
            <pre className={`min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-3 ${MONO} text-[11px] leading-relaxed text-cyan-200`}>{serialOut || "Connect a board over USB to see its Serial output here. (Chrome/Edge desktop)"}</pre>
            <div className="flex items-center gap-2 border-t border-white/10 p-2">
              <input value={sendText} onChange={(e) => setSendText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendSerial()} disabled={!connected}
                placeholder={connected ? "send to board…" : "connect a board to send"} className={`flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 ${MONO} text-xs text-[#e8eefc] placeholder:text-[#566091] focus:border-cyan-300/50 focus:outline-none disabled:opacity-50`} />
              <button onClick={sendSerial} disabled={!connected} className={`${CHIP} disabled:opacity-50`}>Send</button>
            </div>
          </div>
        )}

        {tab === "plotter" && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <span className={`${MONO} text-xs ${MUTED}`}>📈 Serial Plotter {connected && <span className="text-emerald-400">● live</span>}</span>
              <button onClick={() => setPlot([])} className={`${MONO} text-[11px] ${FAINT} hover:text-[#8595bd]`}>clear</button>
            </div>
            <div className="min-h-0 flex-1 p-2"><Plotter data={plot} /></div>
          </div>
        )}
      </div>
    </div>
  );
}

const PLOT_COLORS = ["#34d399", "#22d3ee", "#f59e0b", "#ef4444", "#a855f7", "#84cc16"];

/** Live multi-series line chart of the numbers coming over Serial. */
function Plotter({ data }: { data: number[][] }) {
  if (!data.length) {
    return (
      <div className="grid h-full place-items-center">
        <p className={`max-w-xs text-center ${MONO} text-xs leading-relaxed text-[#566091]`}>
          Print numbers over Serial (e.g.{" "}
          <code className="text-cyan-300">Serial.println(value)</code>) to plot them here.
        </p>
      </div>
    );
  }
  const W = 600, H = 240, P = 10;
  const series = Math.max(...data.map((s) => s.length));
  const all = data.flat().filter(Number.isFinite);
  let lo = Math.min(...all), hi = Math.max(...all);
  if (lo === hi) { lo -= 1; hi += 1; }
  const n = data.length;
  const x = (i: number) => P + (i / Math.max(1, n - 1)) * (W - 2 * P);
  const y = (v: number) => P + (1 - (v - lo) / (hi - lo)) * (H - 2 * P);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
      <rect width={W} height={H} fill="#0a0f1e" rx="8" />
      {[0.25, 0.5, 0.75].map((f) => (<line key={f} x1={P} x2={W - P} y1={P + f * (H - 2 * P)} y2={P + f * (H - 2 * P)} stroke="#1e293b" strokeWidth="1" />))}
      {Array.from({ length: series }).map((_, s) => {
        const pts = data.map((sample, i) => (Number.isFinite(sample[s]) ? `${x(i).toFixed(1)},${y(sample[s]).toFixed(1)}` : "")).filter(Boolean).join(" ");
        return <polyline key={s} points={pts} fill="none" stroke={PLOT_COLORS[s % PLOT_COLORS.length]} strokeWidth="2" />;
      })}
      <text x={P} y={P + 10} fill="#64748b" fontSize="11" fontFamily="monospace">{hi.toFixed(1)}</text>
      <text x={P} y={H - P} fill="#64748b" fontSize="11" fontFamily="monospace">{lo.toFixed(1)}</text>
    </svg>
  );
}
