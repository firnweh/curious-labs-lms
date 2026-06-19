"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Bluetooth Robot Driver — wireless commands → motor actions        */
/*  ONE learning goal: a wireless message sends a single CHARACTER     */
/*  that the robot reads and turns into ONE motor action, so a short   */
/*  SEQUENCE of letters becomes a path. The learner queues F/L/R/S     */
/*  tiles so the robot follows a dashed route to the finish flag.      */
/* ------------------------------------------------------------------ */

const ACCENT = "#34d399";
const RED = "#f87171";
const CYAN = "#67e8f9";

const COLS = 6;
const ROWS = 6;
const CELL = 46;
const PAD = 14;
const VIEW_W = PAD * 2 + COLS * CELL;
const VIEW_H = PAD * 2 + ROWS * CELL;

/** Letter that gets "transmitted" over Bluetooth for each control. */
type Cmd = "F" | "B" | "L" | "R" | "S";
/** Only these tiles can be dragged into the queue (B is a decoy press). */
type QueueCmd = "F" | "L" | "R" | "S";

type Heading = 0 | 1 | 2 | 3; // 0=up, 1=right, 2=down, 3=left
type Phase = "idle" | "playing" | "won" | "crashed";

interface Cell {
  c: number;
  r: number;
}

/** Grid cells (col,row); row 0 is the TOP. */
const START: Cell = { c: 1, r: 5 };
// The dashed route the robot must trace, in order. START is implicit.
// Shape: up, up → (turn R) right → (turn L) up, up — a tidy S-bend.
const ROUTE: Cell[] = [
  { c: 1, r: 4 }, // F (up)
  { c: 1, r: 3 }, // F (up)  ← checkpoint 1
  { c: 2, r: 3 }, // R, then F (right) ← checkpoint 2
  { c: 2, r: 2 }, // L, then F (up)
  { c: 2, r: 1 }, // F (up)  ← finish flag
];
const FINISH: Cell = ROUTE[ROUTE.length - 1];
// Checkpoints are the 3 cells where the path turns / reaches a milestone.
const CHECKPOINTS: Cell[] = [ROUTE[1], ROUTE[2], FINISH];

// The single minimal correct program (revealed as a ghost after 2 misses).
const SOLUTION: QueueCmd[] = ["F", "F", "R", "F", "L", "F", "F", "S"];
const MAX_SLOTS = 8;

const DELTA: Record<Heading, Cell> = {
  0: { c: 0, r: -1 },
  1: { c: 1, r: 0 },
  2: { c: 0, r: 1 },
  3: { c: -1, r: 0 },
};

const PAD_BUTTONS: { id: Cmd; glyph: string; label: string }[] = [
  { id: "F", glyph: "▲", label: "Forward" },
  { id: "L", glyph: "◀", label: "Turn left" },
  { id: "S", glyph: "■", label: "Stop" },
  { id: "R", glyph: "▶", label: "Turn right" },
  { id: "B", glyph: "▼", label: "Back" },
];

const cx = (c: number): number => PAD + c * CELL + CELL / 2;
const cy = (r: number): number => PAD + r * CELL + CELL / 2;
const sameCell = (a: Cell, b: Cell): boolean => a.c === b.c && a.r === b.r;
const onRoute = (cell: Cell): boolean =>
  sameCell(cell, START) || ROUTE.some((p) => sameCell(p, cell));

export default function BluetoothRobotDriver({ onComplete }: ActivityProps) {
  const [queue, setQueue] = useState<QueueCmd[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [robot, setRobot] = useState<Cell>(START);
  const [heading, setHeading] = useState<Heading>(0);
  const [trail, setTrail] = useState<Cell[]>([START]);
  const [litCheckpoints, setLit] = useState<number>(0);
  const [badTile, setBadTile] = useState<number | null>(null);
  const [pulse, setPulse] = useState<Cmd | null>(null);
  const [latency, setLatency] = useState<number>(0);
  const [misses, setMisses] = useState<number>(0);
  const [hint, setHint] = useState<string>("");

  const completedRef = useRef<boolean>(false);
  const timersRef = useRef<number[]>([]);
  const pulseTimerRef = useRef<number | null>(null);

  const playing = phase === "playing";
  const showGhost = misses >= 2 && phase !== "won";

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }, []);

  /** Animate a Bluetooth "pulse" on the matching pad button + bump latency. */
  const flashPulse = useCallback((id: Cmd) => {
    setPulse(id);
    setLatency((ms) => Math.min(ms + 18, 240));
    if (pulseTimerRef.current !== null) window.clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = window.setTimeout(() => setPulse(null), 340);
  }, []);

  const addTile = useCallback(
    (id: QueueCmd) => {
      if (playing) return;
      flashPulse(id);
      setQueue((q) => (q.length >= MAX_SLOTS ? q : [...q, id]));
      setBadTile(null);
      setHint("");
    },
    [playing, flashPulse],
  );

  const padPress = useCallback(
    (id: Cmd) => {
      flashPulse(id);
      if (id === "B") {
        // B transmits, but reversing is never needed — gentle nudge only.
        setHint("Tip: this route only needs Forward, Left, Right and Stop.");
        return;
      }
      addTile(id);
    },
    [flashPulse, addTile],
  );

  const popTile = useCallback(() => {
    if (playing) return;
    setQueue((q) => q.slice(0, -1));
    setBadTile(null);
    setHint("");
  }, [playing]);

  const reset = useCallback(() => {
    clearTimers();
    setQueue([]);
    setPhase("idle");
    setRobot(START);
    setHeading(0);
    setTrail([START]);
    setLit(0);
    setBadTile(null);
    setLatency(0);
    setHint("");
  }, [clearTimers]);

  const turnLeft = (h: Heading): Heading => ((h + 3) % 4) as Heading;
  const turnRight = (h: Heading): Heading => ((h + 1) % 4) as Heading;

  /** Run the queued program one tile at a time, 0.4s apart. Deterministic. */
  const play = useCallback(() => {
    if (playing || queue.length === 0) return;
    clearTimers();
    setPhase("playing");
    setRobot(START);
    setHeading(0);
    setTrail([START]);
    setLit(0);
    setBadTile(null);
    setHint("");

    let pos: Cell = START;
    let h: Heading = 0;
    let lit = 0;
    const path: Cell[] = [START];

    for (let i = 0; i < queue.length; i++) {
      const idx = i;
      const cmd = queue[i];
      const t = window.setTimeout(
        () => {
          flashPulse(cmd);
          if (cmd === "L") {
            h = turnLeft(h);
            setHeading(h);
            return;
          }
          if (cmd === "R") {
            h = turnRight(h);
            setHeading(h);
            return;
          }
          if (cmd === "S") {
            // Reaching the flag AND stopping on it = win.
            if (sameCell(pos, FINISH)) {
              setPhase("won");
              setLit(CHECKPOINTS.length);
              if (!completedRef.current) {
                completedRef.current = true;
                onComplete({
                  passed: true,
                  stars: 3,
                  detail: "Robot drove the whole route and stopped on the flag!",
                });
              }
            } else {
              setMisses((m) => m + 1);
              setPhase("crashed");
              setBadTile(idx);
              setHint(
                "It stopped early. Add Forward tiles so it reaches the flag before S.",
              );
              onComplete({
                passed: false,
                detail: "Stopped before the flag — add more Forward steps.",
              });
            }
            return;
          }
          // cmd === "F": try to step one cell ahead.
          const d = DELTA[h];
          const next: Cell = { c: pos.c + d.c, r: pos.r + d.r };
          const inBounds =
            next.c >= 0 && next.c < COLS && next.r >= 0 && next.r < ROWS;
          if (!inBounds || !onRoute(next)) {
            // Wall / off-route: stop one cell short and flash the bad tile.
            setMisses((m) => m + 1);
            setPhase("crashed");
            setBadTile(idx);
            setHint("It turned the wrong way here — try swapping an L and an R.");
            onComplete({
              passed: false,
              detail: "Robot left the route — check your turns.",
            });
            return;
          }
          pos = next;
          path.push(pos);
          setRobot(pos);
          setTrail([...path]);
          // Light a checkpoint when we land exactly on one (in order).
          if (lit < CHECKPOINTS.length && sameCell(pos, CHECKPOINTS[lit])) {
            lit += 1;
            setLit(lit);
          }
        },
        (i + 1) * 400,
      );
      timersRef.current.push(t);
    }
  }, [playing, queue, clearTimers, flashPulse, onComplete]);

  const robotAngle = heading * 90;

  const status = useMemo<string>(() => {
    if (phase === "won") return "Arrived and stopped on the flag! ✨";
    if (phase === "playing") return "Streaming commands over Bluetooth…";
    if (phase === "crashed") return hint || "Not there yet — adjust the queue.";
    if (queue.length === 0) return "Tap pad buttons to build a command queue.";
    return `Queue ready: ${queue.join(" ")} — press Play ▶`;
  }, [phase, hint, queue]);

  return (
    <div
      className="flex w-full flex-col gap-3 text-ink"
      style={{ maxWidth: 440, margin: "0 auto" }}
    >
      <style>{`
        @keyframes g6bluetoothrobotdriver-ping {
          0% { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes g6bluetoothrobotdriver-shake {
          0%,100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }
        @keyframes g6bluetoothrobotdriver-pop {
          0% { transform: scale(0.4); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        .g6bluetoothrobotdriver-bad {
          animation: g6bluetoothrobotdriver-shake .28s ease 2;
        }
      `}</style>

      {/* ---------------- ARENA + CONTROL PAD ---------------- */}
      <div className="flex gap-2">
        {/* Arena */}
        <div className="panel relative flex-1 overflow-hidden rounded-xl p-1">
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className="block h-auto w-full"
            role="img"
            aria-label="Top-down robot arena with a dashed route to the finish flag"
          >
            {/* grid */}
            {Array.from({ length: COLS + 1 }, (_, i) => (
              <line
                key={`gv${i}`}
                x1={PAD + i * CELL}
                y1={PAD}
                x2={PAD + i * CELL}
                y2={PAD + ROWS * CELL}
                stroke="#1b2433"
                strokeWidth={1}
              />
            ))}
            {Array.from({ length: ROWS + 1 }, (_, i) => (
              <line
                key={`gh${i}`}
                x1={PAD}
                y1={PAD + i * CELL}
                x2={PAD + COLS * CELL}
                y2={PAD + i * CELL}
                stroke="#1b2433"
                strokeWidth={1}
              />
            ))}

            {/* dashed route */}
            <polyline
              points={[START, ...ROUTE]
                .map((p) => `${cx(p.c)},${cy(p.r)}`)
                .join(" ")}
              fill="none"
              stroke={CYAN}
              strokeOpacity={0.45}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="2 7"
            />

            {/* ghost solution path (after 2 misses) */}
            {showGhost && (
              <polyline
                points={[START, ...ROUTE]
                  .map((p) => `${cx(p.c)},${cy(p.r)}`)
                  .join(" ")}
                fill="none"
                stroke={ACCENT}
                strokeOpacity={0.25}
                strokeWidth={10}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* checkpoints */}
            {CHECKPOINTS.map((cp, i) => {
              const done = i < litCheckpoints;
              return (
                <circle
                  key={`cp${i}`}
                  cx={cx(cp.c)}
                  cy={cy(cp.r)}
                  r={9}
                  fill={done ? ACCENT : "none"}
                  fillOpacity={done ? 0.85 : 0}
                  stroke={done ? ACCENT : CYAN}
                  strokeWidth={2}
                />
              );
            })}

            {/* travelled trail */}
            {trail.length > 1 && (
              <polyline
                points={trail.map((p) => `${cx(p.c)},${cy(p.r)}`).join(" ")}
                fill="none"
                stroke={ACCENT}
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* start marker */}
            <text
              x={cx(START.c)}
              y={cy(START.r) + 4}
              textAnchor="middle"
              fontSize={11}
              fill={CYAN}
              className="font-mono"
            >
              START
            </text>

            {/* finish flag */}
            <text
              x={cx(FINISH.c)}
              y={cy(FINISH.r) + 7}
              textAnchor="middle"
              fontSize={20}
            >
              🏁
            </text>

            {/* robot */}
            <g
              transform={`translate(${cx(robot.c)} ${cy(robot.r)}) rotate(${robotAngle})`}
              style={{ transition: "transform .35s ease" }}
            >
              <polygon
                points="0,-11 8,9 0,4 -8,9"
                fill={
                  phase === "won" ? ACCENT : phase === "crashed" ? RED : CYAN
                }
                stroke="#05070d"
                strokeWidth={1.5}
              />
            </g>
            {/* robot emoji ride-along (kept upright, not rotated) */}
            <text
              x={cx(robot.c)}
              y={cy(robot.r) - 13}
              textAnchor="middle"
              fontSize={14}
              style={{ transition: "all .35s ease" }}
            >
              🤖
            </text>
          </svg>

          {phase === "won" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-2xl">
              ✨🎉✨
            </div>
          )}
        </div>

        {/* Phone-style control pad */}
        <div
          className="flex flex-col items-center gap-2 rounded-xl border border-line bg-panel/60 p-2"
          style={{ width: 116 }}
        >
          <div className="flex items-center gap-1 font-mono text-[10px] text-ink-faint">
            <span className="relative inline-flex h-3 w-3 items-center justify-center">
              {pulse !== null && (
                <span
                  aria-hidden
                  className="absolute inline-block h-3 w-3 rounded-full"
                  style={{
                    background: ACCENT,
                    animation: "g6bluetoothrobotdriver-ping .34s ease-out",
                  }}
                />
              )}
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: pulse !== null ? ACCENT : "#3a4658" }}
              />
            </span>
            📡 BT
          </div>

          {/* 3×3 d-pad layout */}
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
          >
            {(["_", "F", "_", "L", "S", "R", "_", "B", "_"] as const).map(
              (slot, i) => {
                if (slot === "_")
                  return <span key={`sp${i}`} aria-hidden className="h-9 w-9" />;
                const btn = PAD_BUTTONS.find((b) => b.id === slot)!;
                const active = pulse === btn.id;
                const isStop = btn.id === "S";
                return (
                  <button
                    key={btn.id}
                    type="button"
                    onPointerDown={() => padPress(btn.id)}
                    disabled={playing}
                    aria-label={`${btn.label} — transmits the letter ${btn.id}`}
                    title={`${btn.label} (sends '${btn.id}')`}
                    className="flex h-9 w-9 flex-col items-center justify-center rounded-md font-mono text-[13px] leading-none transition disabled:opacity-50"
                    style={{
                      background: active
                        ? ACCENT
                        : isStop
                          ? "#2a3340"
                          : "#1b2433",
                      color: active ? "#05070d" : isStop ? RED : CYAN,
                      border: `1px solid ${active ? ACCENT : "#2a3340"}`,
                      touchAction: "manipulation",
                    }}
                  >
                    <span aria-hidden>{btn.glyph}</span>
                    <span className="text-[8px] opacity-80">{btn.id}</span>
                  </button>
                );
              },
            )}
          </div>

          {/* latency meter */}
          <div className="w-full">
            <div className="flex justify-between font-mono text-[9px] text-ink-faint">
              <span>latency</span>
              <span>{latency}ms</span>
            </div>
            <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-panel-2">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min((latency / 240) * 100, 100)}%`,
                  background: latency > 180 ? RED : ACCENT,
                  transition: "width .3s ease",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- QUEUE STRIP ---------------- */}
      <div className="panel rounded-xl p-2">
        <div className="mb-1.5 flex items-center justify-between font-mono text-[11px] uppercase tracking-tech text-ink-faint">
          <span>Command queue · max {MAX_SLOTS}</span>
          <span>
            {queue.length}/{MAX_SLOTS}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: MAX_SLOTS }, (_, i) => {
            const cmd = queue[i];
            const isBad = badTile === i;
            const ghost = showGhost && queue.length === 0 ? SOLUTION[i] : null;
            return (
              <div
                key={i}
                role="listitem"
                aria-label={
                  cmd ? `Slot ${i + 1}: ${cmd}` : `Slot ${i + 1}: empty`
                }
                className={isBad ? "g6bluetoothrobotdriver-bad" : undefined}
                style={{
                  width: 36,
                  height: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 8,
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 15,
                  fontWeight: 600,
                  background: cmd ? "#1b2433" : "transparent",
                  color: isBad ? "#05070d" : cmd ? ACCENT : "#3a4658",
                  border: `1.5px ${cmd ? "solid" : "dashed"} ${
                    isBad ? RED : cmd ? ACCENT : "#2a3340"
                  }`,
                  ...(isBad ? { background: RED } : {}),
                  ...(cmd
                    ? { animation: "g6bluetoothrobotdriver-pop .22s ease" }
                    : {}),
                }}
              >
                {cmd ?? (
                  <span style={{ opacity: 0.5, fontSize: 12 }}>
                    {ghost ?? i + 1}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------------- STATUS ---------------- */}
      <div
        role="status"
        aria-live="polite"
        className="font-mono text-[12px]"
        style={{
          color:
            phase === "won" ? ACCENT : phase === "crashed" ? RED : "#9aa6b2",
          minHeight: 18,
        }}
      >
        {status}
      </div>

      {/* ---------------- CONTROLS ---------------- */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onPointerDown={popTile}
          disabled={playing || queue.length === 0}
          className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-sm font-medium text-ink-dim disabled:opacity-40"
          style={{ touchAction: "manipulation" }}
          aria-label="Remove the last queued command"
        >
          ⌫ Undo
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onPointerDown={reset}
            className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
            style={{ touchAction: "manipulation" }}
            aria-label="Reset the robot and clear the queue"
          >
            Reset
          </button>
          <button
            type="button"
            onPointerDown={play}
            disabled={playing || queue.length === 0}
            className="rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-50"
            style={{
              background: ACCENT,
              color: "#05070d",
              touchAction: "manipulation",
            }}
            aria-label="Play the queued commands"
          >
            {playing ? "Driving…" : "Play ▶"}
          </button>
        </div>
      </div>

      {phase === "won" && (
        <div
          className="text-center text-lg font-semibold"
          style={{ color: ACCENT }}
        >
          ⭐⭐⭐ Route complete!
        </div>
      )}
    </div>
  );
}
