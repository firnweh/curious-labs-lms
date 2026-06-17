"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ACCENT = "#34d399";

/** The kinds of parts a learner can drop into a socket. */
type PartId = "battery" | "led" | "wire";

interface Part {
  id: PartId;
  label: string;
  glyph: string;
}

const PARTS: Part[] = [
  { id: "battery", label: "Battery", glyph: "🔋" },
  { id: "led", label: "LED", glyph: "💡" },
  { id: "wire", label: "Wire", glyph: "➰" },
];

/** Each socket sits on one edge of the loop; `correct` is the deterministic answer. */
interface Socket {
  key: "top" | "left" | "right";
  /** SVG centre of the socket. */
  x: number;
  y: number;
  correct: PartId;
}

const SOCKETS: Socket[] = [
  { key: "top", x: 200, y: 40, correct: "battery" },
  { key: "right", x: 360, y: 150, correct: "led" },
  { key: "left", x: 40, y: 150, correct: "wire" },
];

type Placed = Record<Socket["key"], PartId | null>;

const EMPTY: Placed = { top: null, left: null, right: null };

export default function LighttheLED({ onComplete }: ActivityProps) {
  const [selected, setSelected] = useState<PartId | null>(null);
  const [placed, setPlaced] = useState<Placed>(EMPTY);
  const [switchOn, setSwitchOn] = useState<boolean>(false);
  const [solved, setSolved] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("Place the parts, then flip the switch.");
  const [tries, setTries] = useState<number>(0);

  // Animation phase for the travelling current dots (0..1).
  const [phase, setPhase] = useState<number>(0);
  const rafRef = useRef<number | null>(null);
  const reportedRef = useRef<boolean>(false);

  const allFilled = useMemo(
    () => SOCKETS.every((s) => placed[s.key] !== null),
    [placed],
  );

  const isCorrectLoop = useMemo(
    () => SOCKETS.every((s) => placed[s.key] === s.correct),
    [placed],
  );

  const current = isCorrectLoop && switchOn;

  // Drive the flowing-current animation only while current actually flows.
  useEffect(() => {
    if (!current) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setPhase(0);
      return;
    }
    let start = 0;
    const tick = (t: number): void => {
      if (start === 0) start = t;
      const p = ((t - start) / 2200) % 1;
      setPhase(p);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [current]);

  // Fire onComplete exactly once, in response to current beginning to flow.
  useEffect(() => {
    if (current && !reportedRef.current) {
      reportedRef.current = true;
      setSolved(true);
      setStatus("Current is flowing — the LED is lit!");
      const stars: 1 | 2 | 3 = tries > 4 ? 2 : 3;
      onComplete({ passed: true, stars });
    }
  }, [current, tries, onComplete]);

  const placePart = useCallback(
    (key: Socket["key"]): void => {
      if (solved) return;
      if (selected === null) {
        setStatus("Pick a part from the tray first.");
        return;
      }
      setPlaced((prev) => ({ ...prev, [key]: selected }));
      setStatus(`Placed the ${labelFor(selected)}.`);
    },
    [selected, solved],
  );

  const clearSocket = useCallback(
    (key: Socket["key"]): void => {
      if (solved) return;
      setPlaced((prev) => ({ ...prev, [key]: null }));
    },
    [solved],
  );

  const toggleSwitch = useCallback((): void => {
    if (solved) return;
    const next = !switchOn;
    setSwitchOn(next);
    if (next) {
      setTries((t) => t + 1);
      if (!allFilled) {
        setStatus("Some sockets are empty — fill the whole loop.");
        onComplete({
          passed: false,
          detail: "No complete path — the current can't flow.",
        });
      } else if (!isCorrectLoop) {
        setStatus("The parts are in the wrong spots — try swapping them.");
        onComplete({
          passed: false,
          detail: "No complete path — the current can't flow.",
        });
      }
    } else {
      setStatus("Switch is off.");
    }
  }, [solved, switchOn, allFilled, isCorrectLoop, onComplete]);

  const reset = useCallback((): void => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    reportedRef.current = false;
    setSelected(null);
    setPlaced(EMPTY);
    setSwitchOn(false);
    setSolved(false);
    setPhase(0);
    setTries(0);
    setStatus("Place the parts, then flip the switch.");
  }, []);

  // ------- geometry for the loop path & travelling dots -------
  // The loop is a rounded square. We walk its perimeter as a list of points
  // so current dots can be placed by a single 0..1 parameter.
  const loopPts = useMemo<Array<[number, number]>>(
    () => [
      [40, 40],
      [360, 40],
      [360, 260],
      [40, 260],
    ],
    [],
  );

  const dotPositions = useMemo<Array<{ x: number; y: number }>>(() => {
    const segs = loopPts.map((p, i) => {
      const n = loopPts[(i + 1) % loopPts.length];
      return { ax: p[0], ay: p[1], bx: n[0], by: n[1] };
    });
    const total = segs.length;
    const dots = 6;
    const out: Array<{ x: number; y: number }> = [];
    for (let d = 0; d < dots; d++) {
      const t = (phase + d / dots) % 1;
      const seg = Math.floor(t * total);
      const local = t * total - seg;
      const s = segs[seg];
      out.push({
        x: s.ax + (s.bx - s.ax) * local,
        y: s.ay + (s.by - s.ay) * local,
      });
    }
    return out;
  }, [phase, loopPts]);

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Canvas */}
      <div className="panel relative overflow-hidden rounded-xl border border-line p-2">
        <svg
          viewBox="0 0 400 300"
          className="block w-full"
          role="img"
          aria-label="A square electric circuit with sockets for a battery, an LED and a wire, and a switch on the bottom wire."
        >
          <defs>
            <filter id="ledGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* base wires of the loop */}
          <rect
            x="40"
            y="40"
            width="320"
            height="220"
            rx="18"
            fill="none"
            stroke={current ? ACCENT : "#27314f"}
            strokeWidth="6"
            style={{
              transition: "stroke 240ms ease",
              filter: current ? `drop-shadow(0 0 6px ${ACCENT})` : "none",
            }}
          />

          {/* travelling current dots */}
          {current &&
            dotPositions.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="5" fill={ACCENT}>
                <animate
                  attributeName="opacity"
                  values="0.4;1;0.4"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </circle>
            ))}

          {/* sockets */}
          {SOCKETS.map((s) => {
            const part = placed[s.key];
            const right = isCorrectLoop && part === s.correct;
            return (
              <g key={s.key}>
                <circle
                  cx={s.x}
                  cy={s.y}
                  r="26"
                  fill="#0b1020"
                  stroke={
                    part === null
                      ? "#3a4566"
                      : right && current
                        ? ACCENT
                        : "#4a567e"
                  }
                  strokeWidth="3"
                  strokeDasharray={part === null ? "6 5" : "0"}
                  style={{ cursor: solved ? "default" : "pointer" }}
                  onClick={() => placePart(s.key)}
                />
                {part === null ? (
                  <text
                    x={s.x}
                    y={s.y + 5}
                    textAnchor="middle"
                    fontSize="14"
                    fill="#6b779e"
                    style={{ pointerEvents: "none" }}
                  >
                    + add
                  </text>
                ) : (
                  <>
                    {part === "led" && current ? (
                      <text
                        x={s.x}
                        y={s.y + 12}
                        textAnchor="middle"
                        fontSize="34"
                        filter="url(#ledGlow)"
                        style={{ pointerEvents: "none" }}
                      >
                        {glyphFor(part)}
                      </text>
                    ) : (
                      <text
                        x={s.x}
                        y={s.y + 10}
                        textAnchor="middle"
                        fontSize="26"
                        opacity={part === "led" ? 0.55 : 1}
                        style={{ pointerEvents: "none" }}
                      >
                        {glyphFor(part)}
                      </text>
                    )}
                    {/* tap-to-clear hotspot */}
                    <circle
                      cx={s.x}
                      cy={s.y}
                      r="26"
                      fill="transparent"
                      style={{ cursor: solved ? "default" : "pointer" }}
                      onClick={() => clearSocket(s.key)}
                    >
                      <title>Tap to remove and free this socket</title>
                    </circle>
                  </>
                )}
              </g>
            );
          })}

          {/* the physical switch on the bottom wire */}
          <g
            transform="translate(200 260)"
            style={{ cursor: solved ? "default" : "pointer" }}
            onClick={toggleSwitch}
            role="button"
            aria-label={switchOn ? "Switch is on, tap to turn off" : "Switch is off, tap to turn on"}
          >
            <rect x="-34" y="-16" width="68" height="32" rx="16" fill="#0b1020" stroke="#4a567e" strokeWidth="3" />
            <circle
              cx={switchOn ? 16 : -16}
              cy="0"
              r="12"
              fill={switchOn ? ACCENT : "#6b779e"}
              style={{ transition: "cx 200ms ease, fill 200ms ease" }}
            />
            <text x="0" y="-24" textAnchor="middle" fontSize="11" fill="#9aa6cf" className="font-mono">
              {switchOn ? "ON" : "OFF"}
            </text>
          </g>
        </svg>

        {/* in-canvas status line */}
        <div
          className="font-mono mt-1 rounded-md px-2 py-1 text-center text-xs"
          style={{
            color: solved ? "#05070d" : "#9aa6cf",
            background: solved ? ACCENT : "transparent",
          }}
          aria-live="polite"
        >
          {status}
        </div>
      </div>

      {/* Tray */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-ink-faint">Tray:</span>
        {PARTS.map((p) => {
          const active = selected === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(active ? null : p.id)}
              disabled={solved}
              aria-pressed={active}
              aria-label={`Select ${p.label}`}
              className="rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50"
              style={
                active
                  ? { background: ACCENT, color: "#05070d" }
                  : { borderWidth: 1, borderStyle: "solid", borderColor: "var(--color-line, #27314f)", background: "rgba(11,16,32,0.6)", color: "#9aa6cf" }
              }
            >
              <span aria-hidden="true">{p.glyph}</span> {p.label}
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggleSwitch}
          disabled={solved}
          className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: ACCENT, color: "#05070d" }}
          aria-label={switchOn ? "Turn the switch off" : "Turn the switch on to run the circuit"}
        >
          {switchOn ? "Switch OFF" : "Switch ON"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
          aria-label="Clear all parts and reset the circuit"
        >
          Reset
        </button>
        <span className="font-mono ml-auto text-xs text-ink-faint">
          {SOCKETS.filter((s) => placed[s.key] !== null).length} / {SOCKETS.length} placed
        </span>
      </div>
    </div>
  );
}

function labelFor(id: PartId): string {
  return PARTS.find((p) => p.id === id)?.label ?? id;
}

function glyphFor(id: PartId): string {
  return PARTS.find((p) => p.id === id)?.glyph ?? "?";
}
