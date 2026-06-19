"use client";
// Learning goal: an object-detection + zone-alert system is two ideas stacked —
// (1) classify which boxes are the TARGET class (precision/recall), then
// (2) fire an alert only when a tracked object's CENTROID enters a polygon zone
// (a point-in-polygon geometric rule). The alert is detection AND geometry.
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ACCENT = "#a855f7";
const GREEN = "#34d399";
const DANGER = "#f87171";

/** Stage geometry (SVG user units). A top-down CCTV corridor. */
const W = 400;
const H = 300;

/** One recognised object sitting at a fixed spot in the frame. */
interface SceneObj {
  id: string;
  cls: "person" | "dog" | "chair" | "backpack";
  emoji: string;
  x: number;
  y: number;
}

/** Fixed scene. The TARGET class is "person" — there are exactly 3. */
const SCENE: readonly SceneObj[] = [
  { id: "p1", cls: "person", emoji: "🧍", x: 70, y: 80 },
  { id: "p2", cls: "person", emoji: "🚶", x: 150, y: 210 },
  { id: "p3", cls: "person", emoji: "🧍‍♀️", x: 300, y: 120 },
  { id: "d1", cls: "dog", emoji: "🐕", x: 230, y: 230 },
  { id: "c1", cls: "chair", emoji: "🪑", x: 110, y: 140 },
  { id: "c2", cls: "chair", emoji: "🪑", x: 330, y: 60 },
  { id: "b1", cls: "backpack", emoji: "🎒", x: 200, y: 90 },
] as const;

const TARGET_IDS: ReadonlySet<string> = new Set(
  SCENE.filter((o) => o.cls === "person").map((o) => o.id),
);

/** The doorway sits on the right edge. A pre-baked 6-frame walk path (centroids). */
const PATH: readonly { x: number; y: number }[] = [
  { x: 70, y: 250 }, // frame 0 — far hallway, SAFE
  { x: 150, y: 250 }, // frame 1 — hallway, SAFE
  { x: 240, y: 200 }, // frame 2 — approaching, SAFE
  { x: 330, y: 150 }, // frame 3 — IN DOORWAY (alert)
  { x: 360, y: 120 }, // frame 4 — IN DOORWAY (alert)
  { x: 380, y: 60 }, // frame 5 — exited up, SAFE
] as const;

/** Frames where the walker is truly inside the doorway → the intended alerts. */
const INTENDED_ALERT_FRAMES: ReadonlySet<number> = new Set([3, 4]);

type Corner = { x: number; y: number };

/** A loose ghost of where the zone SHOULD go (a hint, not the answer). */
const GHOST: readonly Corner[] = [
  { x: 300, y: 90 },
  { x: 390, y: 90 },
  { x: 390, y: 180 },
  { x: 300, y: 180 },
];

/** A reasonable, winnable starting quad — too small, sitting near the doorway. */
const START_ZONE: readonly Corner[] = [
  { x: 320, y: 130 },
  { x: 370, y: 130 },
  { x: 370, y: 175 },
  { x: 320, y: 175 },
];

/** Standard ray-casting point-in-polygon test. */
function inPolygon(pt: { x: number; y: number }, poly: readonly Corner[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const straddles = a.y > pt.y !== b.y > pt.y;
    if (straddles) {
      const xCross = ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x;
      if (pt.x < xCross) inside = !inside;
    }
  }
  return inside;
}

/** Score a candidate zone against the baked walk: true / false / missed alerts. */
interface AlertScore {
  truePos: number; // intended frames that DID fire
  falsePos: number; // safe frames that wrongly fired
  missed: number; // intended frames that did NOT fire
  firedFrames: number[]; // every frame the zone fired, in order
}

function scoreZone(poly: readonly Corner[]): AlertScore {
  let truePos = 0;
  let falsePos = 0;
  let missed = 0;
  const firedFrames: number[] = [];
  PATH.forEach((p, f) => {
    const fired = inPolygon(p, poly);
    if (fired) firedFrames.push(f);
    const intended = INTENDED_ALERT_FRAMES.has(f);
    if (intended && fired) truePos++;
    else if (intended && !fired) missed++;
    else if (!intended && fired) falsePos++;
  });
  return { truePos, falsePos, missed, firedFrames };
}

type Phase = "detect" | "zone" | "won";

export default function SurveillanceDetect({ onComplete }: ActivityProps) {
  const [phase, setPhase] = useState<Phase>("detect");
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [zone, setZone] = useState<Corner[]>(START_ZONE.map((c) => ({ ...c })));
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [playFrame, setPlayFrame] = useState<number>(-1); // -1 = not playing
  const [alerts, setAlerts] = useState<number[]>([]);
  const [status, setStatus] = useState<string>("Detect: PEOPLE only. Tap each person.");

  const completedRef = useRef<boolean>(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // ---- PHASE 1: detection scoring ----
  const detected = useMemo(() => {
    let truePos = 0;
    let falsePos = 0;
    picked.forEach((id) => {
      if (TARGET_IDS.has(id)) truePos++;
      else falsePos++;
    });
    return { truePos, falsePos, total: TARGET_IDS.size };
  }, [picked]);

  const detectionPerfect =
    detected.truePos === detected.total && detected.falsePos === 0;

  const toggle = useCallback(
    (o: SceneObj): void => {
      if (phase !== "detect") return;
      setPicked((prev) => {
        const next = new Set(prev);
        if (next.has(o.id)) next.delete(o.id);
        else next.add(o.id);
        return next;
      });
      setStatus(
        TARGET_IDS.has(o.id)
          ? "person 0.9 — locked on."
          : "That's not a person — deselect it to clear the false positive.",
      );
    },
    [phase],
  );

  const goToZone = useCallback((): void => {
    if (!detectionPerfect) {
      setStatus(
        detected.falsePos > 0
          ? "Clear the red boxes — those aren't people."
          : "Some people are still un-boxed. Find all 3.",
      );
      onComplete({ passed: false, detail: "Box exactly the 3 people first." });
      return;
    }
    setPhase("zone");
    setStatus("Drag the 4 handles to wrap the doorway (the faded zone).");
  }, [detectionPerfect, detected.falsePos, onComplete]);

  // ---- PHASE 2: drag polygon corners ----
  const clientToSvg = useCallback((clientX: number, clientY: number): Corner => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    const y = ((clientY - rect.top) / rect.height) * H;
    return {
      x: Math.max(0, Math.min(W, x)),
      y: Math.max(0, Math.min(H, y)),
    };
  }, []);

  const onHandleDown = useCallback(
    (i: number) =>
      (e: React.PointerEvent<SVGCircleElement>): void => {
        if (phase !== "zone") return;
        e.preventDefault();
        (e.target as Element).setPointerCapture?.(e.pointerId);
        setDragIdx(i);
      },
    [phase],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>): void => {
      if (dragIdx === null) return;
      const p = clientToSvg(e.clientX, e.clientY);
      setZone((prev) => {
        const next = prev.map((c) => ({ ...c }));
        next[dragIdx] = p;
        return next;
      });
    },
    [dragIdx, clientToSvg],
  );

  const onPointerUp = useCallback((): void => setDragIdx(null), []);

  // ---- PHASE 2: deterministic 6-frame walk ----
  const stopLoop = useCallback((): void => {
    if (rafRef.current !== null) {
      window.clearTimeout(rafRef.current);
      rafRef.current = null;
    }
  }, []);
  useEffect(() => () => stopLoop(), [stopLoop]);

  const runWalk = useCallback((): void => {
    stopLoop();
    const score = scoreZone(zone);
    setAlerts([]);
    setPlayFrame(0);
    setStatus("Tracking… watching the centroid.");

    let f = 0;
    const step = (): void => {
      setPlayFrame(f);
      if (inPolygon(PATH[f], zone)) {
        setAlerts((prev) => [...prev, f]);
      }
      if (f >= PATH.length - 1) {
        // Walk finished — grade the whole run.
        if (score.truePos === 2 && score.falsePos === 0 && score.missed === 0) {
          setPhase("won");
          setStatus("Zone locked: 2 true alerts, 0 false, 0 missed. ✨🎉");
          if (!completedRef.current) {
            completedRef.current = true;
            onComplete({
              passed: true,
              stars: 3,
              detail:
                "Detected 3/3 people with 0 false positives, then the zone fired on exactly the 2 doorway frames.",
            });
          }
        } else {
          let nudge = "Re-shape the zone and run again.";
          if (score.falsePos > 0)
            nudge =
              "Your zone is too greedy — it alerts on the hallway. Pull it back to just the doorway.";
          else if (score.missed > 0)
            nudge =
              "The person walked through but no alert — widen the zone to cover the doorway.";
          setStatus(nudge);
          onComplete({ passed: false, detail: nudge });
        }
        rafRef.current = null;
        return;
      }
      f += 1;
      rafRef.current = window.setTimeout(step, 520);
    };
    rafRef.current = window.setTimeout(step, 0);
  }, [zone, onComplete, stopLoop]);

  const reset = useCallback((): void => {
    stopLoop();
    completedRef.current = false;
    setPhase("detect");
    setPicked(new Set());
    setZone(START_ZONE.map((c) => ({ ...c })));
    setDragIdx(null);
    setPlayFrame(-1);
    setAlerts([]);
    setStatus("Detect: PEOPLE only. Tap each person.");
  }, [stopLoop]);

  const polyStr = zone.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const ghostStr = GHOST.map((c) => `${c.x},${c.y}`).join(" ");
  const walker = playFrame >= 0 ? PATH[Math.min(playFrame, PATH.length - 1)] : null;
  const walkerAlert = walker !== null && inPolygon(walker, zone);
  const won = phase === "won";

  return (
    <div className="flex w-full flex-col gap-3" style={{ maxWidth: 440 }}>
      <style>{`
        @keyframes g10surveillancedetect-flash {
          0%,100% { opacity: 0; }
          50% { opacity: 1; }
        }
        @keyframes g10surveillancedetect-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g10surveillancedetect-blip {
          from { transform: translateY(4px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {/* CCTV stage */}
      <div
        className="panel relative overflow-hidden rounded-xl border p-2"
        style={{
          borderColor: won ? ACCENT : "var(--color-line, #27314f)",
          boxShadow: won ? `0 0 24px -4px ${ACCENT}` : undefined,
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full"
          role="img"
          aria-label="Top-down CCTV corridor with recognised objects and a draggable alert zone."
          style={{ maxHeight: 320, touchAction: "none" }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {/* floor + corridor walls */}
          <rect x={0} y={0} width={W} height={H} fill="#0b1020" />
          <rect x={8} y={8} width={W - 16} height={H - 16} rx={6} fill="#10172b" stroke="#1c2540" />
          {/* doorway gap on the right wall */}
          <rect x={W - 14} y={90} width={12} height={90} fill="#0b1020" stroke="#243049" />
          <text x={W - 60} y={84} fontSize={11} fill="#5b678f">door →</text>

          {/* ghost target zone (only while authoring) */}
          {phase === "zone" && (
            <polygon
              points={ghostStr}
              fill={ACCENT}
              opacity={0.1}
              stroke={ACCENT}
              strokeOpacity={0.4}
              strokeDasharray="5 4"
              strokeWidth={1}
            />
          )}

          {/* the learner's alert zone */}
          {phase !== "detect" && (
            <polygon
              points={polyStr}
              fill={walkerAlert ? DANGER : ACCENT}
              fillOpacity={walkerAlert ? 0.22 : 0.14}
              stroke={walkerAlert ? DANGER : ACCENT}
              strokeWidth={2}
            />
          )}

          {/* scene objects with bounding boxes */}
          {SCENE.map((o) => {
            const on = picked.has(o.id);
            const isTarget = TARGET_IDS.has(o.id);
            const boxColor = on ? (isTarget ? GREEN : DANGER) : "transparent";
            return (
              <g
                key={o.id}
                onPointerDown={() => toggle(o)}
                style={{ cursor: phase === "detect" ? "pointer" : "default" }}
              >
                <rect
                  x={o.x - 22}
                  y={o.y - 22}
                  width={44}
                  height={44}
                  rx={4}
                  fill={on ? boxColor : "#ffffff"}
                  fillOpacity={on ? 0.12 : 0.02}
                  stroke={on ? boxColor : "#2a3450"}
                  strokeWidth={on ? 2 : 1}
                />
                {on && (
                  <text
                    x={o.x - 21}
                    y={o.y - 26}
                    fontSize={9}
                    fill={boxColor}
                    style={{ fontFamily: "monospace" }}
                  >
                    {isTarget ? "person 0.9" : "not a target"}
                  </text>
                )}
                <text x={o.x} y={o.y + 8} fontSize={26} textAnchor="middle">
                  {o.emoji}
                </text>
              </g>
            );
          })}

          {/* corner handles (authoring) */}
          {phase === "zone" &&
            zone.map((c, i) => (
              <circle
                key={`h${i}`}
                cx={c.x}
                cy={c.y}
                r={dragIdx === i ? 11 : 9}
                fill={ACCENT}
                stroke="#05070d"
                strokeWidth={2}
                style={{ cursor: "grab", touchAction: "none" }}
                onPointerDown={onHandleDown(i)}
                role="button"
                aria-label={`Zone corner ${i + 1}, drag to reshape the alert zone`}
              />
            ))}

          {/* the walking person token */}
          {walker && (
            <g>
              <circle
                cx={walker.x}
                cy={walker.y}
                r={3}
                fill={walkerAlert ? DANGER : GREEN}
              />
              <text x={walker.x} y={walker.y - 8} fontSize={22} textAnchor="middle">
                🚶
              </text>
            </g>
          )}

          {/* red alert border flash */}
          {walkerAlert && (
            <rect
              x={3}
              y={3}
              width={W - 6}
              height={H - 6}
              rx={6}
              fill="none"
              stroke={DANGER}
              strokeWidth={5}
              style={{ animation: "g10surveillancedetect-flash 0.5s ease-in-out infinite" }}
            />
          )}

          {/* win celebration */}
          {won && (
            <g style={{ animation: "g10surveillancedetect-pop 360ms ease-out" }}>
              <text x={W / 2} y={H / 2 - 10} textAnchor="middle" fontSize={36}>
                ✨🎉
              </text>
              <text x={W / 2} y={H / 2 + 28} textAnchor="middle" fontSize={28}>
                ⭐⭐⭐
              </text>
            </g>
          )}
        </svg>

        {/* info bar */}
        <div className="mt-1 flex items-center justify-between gap-2 px-1 text-xs">
          {phase === "detect" ? (
            <span className="font-mono tabular-nums text-ink-faint">
              detected {detected.truePos}/{detected.total} people ·{" "}
              <span style={{ color: detected.falsePos > 0 ? DANGER : "inherit" }}>
                {detected.falsePos} false positives
              </span>
            </span>
          ) : (
            <span className="font-mono tabular-nums text-ink-faint">
              frame {Math.max(playFrame, 0)}/{PATH.length - 1} · alerts {alerts.length}
            </span>
          )}
          <span
            className="rounded-md px-2 py-0.5 font-semibold"
            style={{
              color: "#05070d",
              background: walkerAlert ? DANGER : phase === "detect" ? "#475569" : ACCENT,
            }}
          >
            {walkerAlert ? "ALERT" : phase === "detect" ? "DETECT" : "ZONE"}
          </span>
        </div>
      </div>

      {/* status + alert log */}
      <div className="panel flex flex-col gap-2 rounded-xl p-3">
        <div
          className="rounded-md px-2 py-1 text-center text-xs"
          role="status"
          aria-live="polite"
          style={{
            color: won ? "#05070d" : status.startsWith("That's not") ? DANGER : "#9aa6cf",
            background: won ? ACCENT : "transparent",
          }}
        >
          {status}
        </div>

        {/* alert log rows (phase 2) */}
        {phase !== "detect" && alerts.length > 0 && (
          <div className="flex flex-col gap-1 rounded-md border border-line bg-panel-2/60 p-2 font-mono text-[11px]">
            {alerts.map((f) => (
              <div
                key={`a${f}`}
                style={{
                  color: INTENDED_ALERT_FRAMES.has(f) ? GREEN : DANGER,
                  animation: "g10surveillancedetect-blip 220ms ease-out",
                }}
              >
                {INTENDED_ALERT_FRAMES.has(f) ? "✓" : "✗"} ALERT logged: person in
                restricted zone @ frame {f}
              </div>
            ))}
          </div>
        )}

        {/* actions */}
        <div className="flex items-center gap-2">
          {phase === "detect" && (
            <button
              type="button"
              onPointerDown={goToZone}
              className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold"
              style={{ background: ACCENT, color: "#05070d" }}
              aria-label="Confirm the detected people and move to the zone-alert phase"
            >
              Confirm detections →
            </button>
          )}
          {phase === "zone" && (
            <button
              type="button"
              onPointerDown={runWalk}
              disabled={playFrame >= 0 && playFrame < PATH.length - 1}
              className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
              style={{ background: ACCENT, color: "#05070d" }}
              aria-label="Play the 6-frame walk and test the alert zone"
            >
              ▶ Run the walk
            </button>
          )}
          {won && (
            <span
              className="flex-1 rounded-lg px-4 py-2 text-center text-sm font-semibold"
              style={{ background: ACCENT, color: "#05070d" }}
            >
              Solved! ⭐⭐⭐
            </span>
          )}
          <button
            type="button"
            onPointerDown={reset}
            className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
            aria-label="Reset the whole lab"
          >
            Reset
          </button>
        </div>

        <p className="text-[11px] leading-snug text-ink-faint">
          Ethics note: a real version must show people it&apos;s recording and let
          them opt out.
        </p>
      </div>
    </div>
  );
}
