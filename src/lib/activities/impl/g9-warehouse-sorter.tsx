"use client";
// Learning goal: program a vision-guided sorter — map each detected colour to
// the right bin, then tune belt speed vs. servo timing so no parcel out-runs a
// gate that is still swinging back to neutral (the camera-lag / servo trade-off).
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

const ACCENT = "#34d399";

/** The three parcel colours the camera can detect. */
type Colour = "red" | "green" | "blue";
/** The three destination bins (plus the implicit "reject" overflow). */
type Bin = "A" | "B" | "C";

interface Parcel {
  id: number;
  colour: Colour;
}

/** Fixed, deterministic queue of 10 parcels — order never changes. */
const QUEUE: readonly Parcel[] = [
  { id: 1, colour: "red" },
  { id: 2, colour: "green" },
  { id: 3, colour: "blue" },
  { id: 4, colour: "green" },
  { id: 5, colour: "red" },
  { id: 6, colour: "blue" },
  { id: 7, colour: "red" },
  { id: 8, colour: "green" },
  { id: 9, colour: "blue" },
  { id: 10, colour: "green" },
] as const;

/** The one correct colour → bin routing the learner must discover. */
const TRUTH: Record<Colour, Bin> = { red: "A", green: "B", blue: "C" };

const SWATCH: Record<Colour, string> = {
  red: "#f87171",
  green: "#4ade80",
  blue: "#60a5fa",
};

/** Detected HSV hue per colour — flavour for the "OpenCV" camera readout. */
const HUE: Record<Colour, number> = { red: 0, green: 120, blue: 220 };

const COLOURS: readonly Colour[] = ["red", "green", "blue"] as const;
const BINS: readonly Bin[] = ["A", "B", "C"] as const;

const TICK_BUDGET = 120;

// Safe operating band — guaranteed-winnable when speed & timing both sit inside.
const SPEED_SAFE_MAX = 6; // ticks-per-parcel travel; faster (lower) = risky
const TIMING_SAFE_MIN = 3; // gate must stay open long enough to catch a parcel

interface RunResult {
  sorted: number; // parcels in the correct bin
  jamId: number | null; // first parcel that missed its gate, if any
  jamTick: number | null; // tick the gate was still returning to neutral
  ticksUsed: number;
  allMapped: boolean;
  mappingOk: boolean;
}

/** True only inside the marked safe band — the honest, always-winnable rule. */
function gatesCatch(speed: number, timing: number): boolean {
  return speed <= SPEED_SAFE_MAX && timing >= TIMING_SAFE_MIN;
}

/**
 * Deterministic "physics": a parcel is caught only when the belt is slow enough
 * AND the servo holds the gate open long enough to cover its swing-back lag.
 * Too-fast belt or too-short hold leaves the gate mid-swing when the parcel
 * arrives, so it overshoots into the reject lane. Both conditions are the exact
 * safe band shown on screen, so the band is a genuine guarantee.
 */
function simulate(
  mapping: Record<Colour, Bin | null>,
  speed: number,
  timing: number,
): RunResult {
  const allMapped = COLOURS.every((c) => mapping[c] !== null);
  const mappingOk = COLOURS.every((c) => mapping[c] === TRUTH[c]);

  // Ticks the gate is still returning to neutral when a parcel reaches it.
  const lag = Math.max(0, speed - SPEED_SAFE_MAX) + Math.max(0, TIMING_SAFE_MIN - timing);
  const caught = gatesCatch(speed, timing);

  let sorted = 0;
  let jamId: number | null = null;
  let jamTick: number | null = null;

  QUEUE.forEach((p, i) => {
    const routedRight = mapping[p.colour] === TRUTH[p.colour];
    if (routedRight && caught) {
      sorted += 1;
    } else if (jamId === null && routedRight && !caught) {
      // Routing was correct but the gate jammed — capture the teachable moment.
      jamId = p.id;
      jamTick = i * speed + Math.max(1, speed - lag);
    }
  });

  const ticksUsed = QUEUE.length * speed;
  return { sorted, jamId, jamTick, ticksUsed, allMapped, mappingOk };
}

export default function WarehouseVisionSorter({ onComplete }: ActivityProps) {
  const [mapping, setMapping] = useState<Record<Colour, Bin | null>>({
    red: null,
    green: null,
    blue: null,
  });
  const [speed, setSpeed] = useState<number>(4);
  const [timing, setTiming] = useState<number>(2);
  const [result, setResult] = useState<RunResult | null>(null);
  const [solved, setSolved] = useState<boolean>(false);
  const [status, setStatus] = useState<string>(
    "Map each colour to a bin, then tune the belt and servo before you RUN.",
  );
  const firedRef = useRef<boolean>(false);

  const allMapped = useMemo(
    () => COLOURS.every((c) => mapping[c] !== null),
    [mapping],
  );

  const setColourBin = useCallback(
    (c: Colour, b: Bin): void => {
      if (solved) return;
      setMapping((prev) => ({ ...prev, [c]: prev[c] === b ? null : b }));
      setResult(null);
      setStatus("Rules updated — press RUN to test the line.");
    },
    [solved],
  );

  const run = useCallback((): void => {
    if (solved) return;
    const r = simulate(mapping, speed, timing);
    setResult(r);

    if (r.sorted === QUEUE.length && r.ticksUsed <= TICK_BUDGET) {
      setSolved(true);
      setStatus("Sorting efficiency 100% — 10/10 sorted in time!");
      if (!firedRef.current) {
        firedRef.current = true;
        onComplete({
          passed: true,
          stars: 3,
          detail: `10/10 routed in ${r.ticksUsed}/${TICK_BUDGET} ticks.`,
        });
      }
      return;
    }

    // Friendly, specific nudge — never scold, always recoverable.
    let nudge: string;
    if (!r.allMapped) {
      nudge = "Some colours have no bin yet — fill the rules table.";
    } else if (!r.mappingOk) {
      nudge = "A colour is going to the wrong bin. Re-check the swatches.";
    } else if (r.jamId !== null) {
      nudge = `Parcel #${r.jamId} jammed — the gate was still swinging back. Slow the belt or hold the servo longer.`;
    } else if (r.ticksUsed > TICK_BUDGET) {
      nudge = "Routing is correct but you blew the tick budget — quicker belt.";
    } else {
      nudge = "Almost — nudge belt speed and servo timing into the safe band.";
    }
    setStatus(nudge);
    onComplete({ passed: false, detail: nudge });
  }, [solved, mapping, speed, timing, onComplete]);

  const reset = useCallback((): void => {
    setMapping({ red: null, green: null, blue: null });
    setSpeed(4);
    setTiming(2);
    setResult(null);
    setSolved(false);
    firedRef.current = false;
    setStatus("Map each colour to a bin, then tune the belt and servo before you RUN.");
  }, []);

  // Which bin each parcel lands in given the CURRENT settings (for the belt SVG).
  const landed = useMemo(() => {
    const caught = gatesCatch(speed, timing);
    return QUEUE.map((p) => {
      const target = mapping[p.colour];
      if (target !== null && target === TRUTH[p.colour] && caught) return target;
      return "reject" as const;
    });
  }, [mapping, speed, timing]);

  const speedSafe = speed <= SPEED_SAFE_MAX;
  const timingSafe = timing >= TIMING_SAFE_MIN;
  const inSafeBand = speedSafe && timingSafe;

  return (
    <div
      className="mx-auto flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink"
      style={{ color: "#cbd3ef" }}
    >
      <style>{`
        @keyframes g9warehousesorter-belt {
          from { background-position: 0 0; }
          to { background-position: -28px 0; }
        }
        @keyframes g9warehousesorter-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g9warehousesorter-scan {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* Camera + conveyor stage */}
      <div
        className="relative overflow-hidden rounded-xl border p-2"
        style={{
          borderColor: solved ? ACCENT : "#27314f",
          background: "rgba(11,16,32,0.6)",
          boxShadow: solved ? `0 0 22px -6px ${ACCENT}` : undefined,
        }}
      >
        <svg
          viewBox="0 0 220 150"
          className="block w-full"
          role="img"
          aria-label="Side view of a conveyor belt carrying ten coloured parcels under a vision camera toward three sorting bins."
        >
          {/* camera box */}
          <g>
            <rect x="86" y="6" width="48" height="26" rx="4" fill="#0b1020" stroke={ACCENT} strokeWidth="1.2" />
            <rect x="104" y="30" width="12" height="6" fill="#0b1020" stroke={ACCENT} strokeWidth="1" />
            <circle
              cx="110"
              cy="19"
              r="5"
              fill={SWATCH[QUEUE[0].colour]}
              style={{ animation: "g9warehousesorter-scan 1.4s ease-in-out infinite" }}
            />
            <text x="110" y="46" textAnchor="middle" fontSize="6" fill="#9aa6cf">
              CAM · hue {HUE[QUEUE[0].colour]}°
            </text>
          </g>

          {/* belt */}
          <rect
            x="6"
            y="62"
            width="208"
            height="20"
            rx="3"
            fill="#10182e"
            stroke="#27314f"
            strokeWidth="1"
          />
          <line x1="6" y1="82" x2="214" y2="82" stroke="#27314f" strokeWidth="1" />

          {/* the 10 parcels, evenly spaced along the belt */}
          {QUEUE.map((p, i) => {
            const x = 14 + i * 19.5;
            return (
              <g key={p.id}>
                <rect
                  x={x}
                  y={66}
                  width="13"
                  height="12"
                  rx="2"
                  fill={SWATCH[p.colour]}
                  stroke="#0b1020"
                  strokeWidth="0.8"
                />
                <text x={x + 6.5} y={75} textAnchor="middle" fontSize="6" fill="#0b1020">
                  {p.id}
                </text>
                {/* landed marker under each parcel after a run */}
                {result && (
                  <text
                    x={x + 6.5}
                    y={94}
                    textAnchor="middle"
                    fontSize="6.5"
                    fill={landed[i] === "reject" ? "#f87171" : ACCENT}
                    style={{ animation: "g9warehousesorter-pop 240ms ease both" }}
                  >
                    {landed[i] === "reject" ? "✗" : landed[i]}
                  </text>
                )}
              </g>
            );
          })}

          {/* two servo gates at junctions */}
          {[70, 150].map((gx, gi) => (
            <line
              key={gi}
              x1={gx}
              y1="62"
              x2={gx + (timingSafe ? 0 : 7)}
              y2="50"
              stroke={timingSafe ? ACCENT : "#f59e0b"}
              strokeWidth="2"
              strokeLinecap="round"
            />
          ))}

          {/* three bins */}
          {BINS.map((b, i) => {
            const bx = 30 + i * 64;
            return (
              <g key={b}>
                <rect x={bx} y="118" width="44" height="26" rx="3" fill="#0b1020" stroke="#27314f" strokeWidth="1" />
                <text x={bx + 22} y="134" textAnchor="middle" fontSize="9" fill="#9aa6cf">
                  Bin {b}
                </text>
              </g>
            );
          })}
        </svg>

        {/* live status line */}
        <div
          className="mt-1 rounded-md px-2 py-1 text-center text-[11px] leading-tight"
          role="status"
          aria-live="polite"
          style={{
            color: solved ? "#05070d" : "#9aa6cf",
            background: solved ? ACCENT : "transparent",
          }}
        >
          {solved ? "✨🎉 " : ""}
          {status}
          {solved ? " ⭐⭐⭐" : ""}
        </div>
      </div>

      {/* Rules table: colour → bin */}
      <div
        className="rounded-xl border p-3"
        style={{ borderColor: "#27314f", background: "rgba(11,16,32,0.6)" }}
      >
        <p className="mb-2 text-[11px] text-ink-faint" style={{ color: "#9aa6cf" }}>
          Routing rules — tap the bin for each detected colour:
        </p>
        <div className="flex flex-col gap-2">
          {COLOURS.map((c) => (
            <div key={c} className="flex items-center gap-2" role="group" aria-label={`Route ${c} parcels`}>
              <span
                className="inline-block h-4 w-4 shrink-0 rounded-sm"
                style={{ background: SWATCH[c] }}
                aria-hidden="true"
              />
              <span className="w-16 text-xs capitalize" style={{ color: "#cbd3ef" }}>
                {c}
              </span>
              <span className="flex gap-1.5">
                {BINS.map((b) => {
                  const on = mapping[c] === b;
                  return (
                    <button
                      key={b}
                      type="button"
                      onPointerDown={() => setColourBin(c, b)}
                      disabled={solved}
                      aria-pressed={on}
                      aria-label={`Send ${c} parcels to bin ${b}`}
                      className="rounded-md px-3 py-1 text-xs font-medium transition disabled:opacity-50"
                      style={{
                        touchAction: "manipulation",
                        border: `1px solid ${on ? ACCENT : "#27314f"}`,
                        background: on ? ACCENT : "rgba(11,16,32,0.6)",
                        color: on ? "#05070d" : "#cbd3ef",
                      }}
                    >
                      Bin {b}
                    </button>
                  );
                })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Belt speed + servo timing sliders */}
      <div
        className="rounded-xl border p-3"
        style={{ borderColor: "#27314f", background: "rgba(11,16,32,0.6)" }}
      >
        <label className="flex flex-col gap-1 text-xs">
          <span className="flex items-center justify-between">
            <span style={{ color: "#9aa6cf" }}>
              Belt speed <span className="text-ink-faint">· ticks per parcel</span>
            </span>
            <span
              className="tabular-nums"
              style={{ color: speedSafe ? ACCENT : "#f59e0b" }}
            >
              {speed} {speedSafe ? "" : "(fast)"}
            </span>
          </span>
          <input
            type="range"
            min={2}
            max={10}
            step={1}
            value={speed}
            onChange={(e) => {
              setSpeed(Number(e.target.value));
              setResult(null);
            }}
            disabled={solved}
            aria-label={`Belt speed, ${speed} ticks per parcel`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full"
            style={{ accentColor: ACCENT, background: "#10182e", touchAction: "none" }}
          />
        </label>

        <label className="mt-3 flex flex-col gap-1 text-xs">
          <span className="flex items-center justify-between">
            <span style={{ color: "#9aa6cf" }}>
              Servo timing <span className="text-ink-faint">· ticks gate held open</span>
            </span>
            <span
              className="tabular-nums"
              style={{ color: timingSafe ? ACCENT : "#f59e0b" }}
            >
              {timing} {timingSafe ? "" : "(short)"}
            </span>
          </span>
          <input
            type="range"
            min={1}
            max={8}
            step={1}
            value={timing}
            onChange={(e) => {
              setTiming(Number(e.target.value));
              setResult(null);
            }}
            disabled={solved}
            aria-label={`Servo timing, gate held open ${timing} ticks`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full"
            style={{ accentColor: ACCENT, background: "#10182e", touchAction: "none" }}
          />
        </label>

        <p
          className="mt-2 text-[10px] leading-tight"
          style={{ color: inSafeBand ? ACCENT : "#f59e0b" }}
        >
          {inSafeBand
            ? "✓ Inside the safe band: belt ≤ 6 and servo ≥ 3 — gates settle before each parcel."
            : "Safe band: belt speed ≤ 6 ticks AND servo timing ≥ 3 ticks."}
        </p>
      </div>

      {/* Run / reset + budget readout */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onPointerDown={run}
          disabled={solved}
          className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
          style={{ background: ACCENT, color: "#05070d", touchAction: "manipulation" }}
          aria-label="Run the sorter and grade the result"
        >
          {solved ? "Sorted!" : "▶ RUN"}
        </button>
        <button
          type="button"
          onPointerDown={reset}
          className="rounded-lg border px-4 py-2 text-sm font-medium"
          style={{ borderColor: "#27314f", background: "rgba(11,16,32,0.6)", color: "#9aa6cf", touchAction: "manipulation" }}
          aria-label="Reset the rules table and sliders"
        >
          Reset
        </button>
      </div>

      {/* Efficiency badge + jam replay */}
      {result && (
        <div
          className="rounded-xl border p-3 text-xs"
          style={{
            borderColor: solved ? ACCENT : "#27314f",
            background: "rgba(11,16,32,0.6)",
          }}
        >
          <div className="flex items-center justify-between">
            <span style={{ color: "#cbd3ef" }}>
              Sorting efficiency{" "}
              <span style={{ color: solved ? ACCENT : "#f59e0b" }}>
                {Math.round((result.sorted / QUEUE.length) * 100)}%
              </span>
            </span>
            <span className="tabular-nums" style={{ color: result.ticksUsed <= TICK_BUDGET ? ACCENT : "#f87171" }}>
              {result.ticksUsed}/{TICK_BUDGET} ticks · {result.sorted}/{QUEUE.length} sorted
            </span>
          </div>
          {result.jamId !== null && result.jamTick !== null && (
            <p className="mt-2 leading-snug" style={{ color: "#f59e0b" }}>
              Replay: parcel #{result.jamId} reached the gate at tick {result.jamTick},
              but the servo was still returning to neutral — that lag is why it dropped
              into reject. A slower belt or longer servo hold closes the gap.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
