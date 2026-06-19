"use client";
// Learning goal: a self-driving car keeps its lane with a closed sense-decide-act
// control loop — measure offset from lane centre, then steer the OPPOSITE way,
// scaled by a gain k and clamped to a safe maximum.
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ACCENT = "#34d399";
const DANGER = "#f87171";

/** Stage geometry (SVG user units). The road is a vertical strip; the car sits low. */
const W = 280;
const H = 360;
const CAR_Y = 282;
const LANE_HALF = 46; // half lane-width: |offset| under this == IN LANE
const ROAD_HALF = 70; // half road-width: |carX-centre| beyond this == off road

// Closed-loop physics constants — tuned so there is a real, bounded winning band.
const MAX_STEER = 7; // clamp limit (±degrees of steer command)
const SENSOR_LAG = 6; // frames of delay: the camera reports a slightly stale offset
const INERTIA = 0.58; // how much lateral velocity carries between frames
const RESPONSE = 0.42; // how much steer converts into new lateral velocity

/**
 * The track centre-line, pre-baked as a deterministic x-offset (px from screen
 * centre) per frame: a straight, then two opposite curves. The car never sees
 * the future — each frame it only measures where the lane centre is NOW.
 */
const FRAMES = 150;
const TRACK: readonly number[] = (() => {
  const out: number[] = [];
  const AMP = 85;
  for (let f = 0; f < FRAMES; f++) {
    const t = f / FRAMES;
    let c = 0;
    if (t < 0.28) c = 0; // straight
    else if (t < 0.58) c = Math.sin(((t - 0.28) / 0.3) * Math.PI) * AMP; // curve right
    else c = -Math.sin(((t - 0.58) / 0.42) * Math.PI) * AMP; // curve left
    out.push(c);
  }
  return out;
})();

type Dir = "opposite" | "same";

interface SimResult {
  /** Per-frame car x-offset from screen centre, for drawing the trail. */
  carPath: number[];
  /** Per-frame lane-centre x-offset, for drawing the road. */
  lanePath: number[];
  /** Frame index where the car left the road, or FRAMES if it finished clean. */
  failFrame: number;
}

/**
 * Deterministically run the whole controller over the baked track.
 * Each frame the camera senses a slightly stale offset (SENSOR_LAG frames old),
 * the controller decides  steer = ±k·offset  (clamped), and the car's lateral
 * velocity carries momentum (INERTIA) — so too-low gain lags out on the curve
 * and too-high gain over-steers and oscillates. A winning band exists with
 * dir=opposite, clamp on, k in ~0.09–0.6 (the steady core is ~0.18–0.32).
 */
function simulate(k: number, dir: Dir, clamp: boolean): SimResult {
  let carX = 0;
  let vel = 0;
  const carPath: number[] = [];
  const lanePath: number[] = [];
  const carHist: number[] = [];
  let failFrame = FRAMES;

  for (let f = 0; f < FRAMES; f++) {
    const lane = TRACK[f];
    carHist.push(carX);
    // The camera reports a delayed reading: where things were SENSOR_LAG frames ago.
    const past = carHist[Math.max(0, carHist.length - 1 - SENSOR_LAG)];
    const sensedLane = TRACK[Math.max(0, f - SENSOR_LAG)];
    const offset = sensedLane - past; // +ve: lane centre is to the RIGHT of the car
    const sign = dir === "opposite" ? 1 : -1; // correct controllers steer toward the lane
    let steer = sign * k * offset;
    if (clamp) steer = Math.max(-MAX_STEER, Math.min(MAX_STEER, steer));
    vel = vel * INERTIA + steer * RESPONSE;
    carX += vel;

    carPath.push(carX);
    lanePath.push(lane);

    if (Math.abs(carX - lane) > ROAD_HALF && failFrame === FRAMES) {
      failFrame = f;
    }
  }
  return { carPath, lanePath, failFrame };
}

/** Friendly, never-scolding diagnosis of WHY a run failed — guides the next tweak. */
function diagnose(k: number, dir: Dir, clamp: boolean): string {
  if (dir === "same") {
    return "Check your correction direction — you steered toward the drift, not away from it.";
  }
  if (k < 0.09) return "Too gentle — raise the gain so the car corrects sooner on the curve.";
  if (!clamp) return "Too twitchy — switch on clamp so a big offset can't over-steer.";
  return "Too twitchy — lower the gain a little so the car stops wobbling.";
}

export default function SelfDrivingLane({ onComplete }: ActivityProps) {
  const [gain, setGain] = useState<number>(0.08); // starts too gentle
  const [dir, setDir] = useState<Dir>("opposite");
  const [clamp, setClamp] = useState<boolean>(true);
  const [showMath, setShowMath] = useState<boolean>(false);

  const [frame, setFrame] = useState<number>(0); // current animation frame
  const [running, setRunning] = useState<boolean>(false);
  const [outcome, setOutcome] = useState<"idle" | "won" | "lost">("idle");
  const [message, setMessage] = useState<string>(
    "Tune the controller, then press DRIVE.",
  );

  const rafRef = useRef<number | null>(null);
  const simRef = useRef<SimResult | null>(null);
  const completedRef = useRef<boolean>(false);

  // The whole drive is computed up-front, deterministically — animation just replays it.
  const stopLoop = useCallback((): void => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => () => stopLoop(), [stopLoop]);

  const drive = useCallback((): void => {
    if (running) return;
    stopLoop();
    const sim = simulate(gain, dir, clamp);
    simRef.current = sim;
    setOutcome("idle");
    setFrame(0);
    setRunning(true);
    setMessage("Driving…");

    let f = 0;
    const tick = (): void => {
      f += 1;
      setFrame(f);
      // Lost the road this frame?
      if (f >= sim.failFrame && sim.failFrame < FRAMES) {
        setRunning(false);
        setOutcome("lost");
        setMessage(diagnose(gain, dir, clamp));
        if (!completedRef.current) {
          onComplete({ passed: false, detail: diagnose(gain, dir, clamp) });
        }
        return;
      }
      // Reached the end still inside the road → win.
      if (f >= FRAMES - 1) {
        setRunning(false);
        setOutcome("won");
        setMessage("Lane held the whole track! ✨🎉");
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete({
            passed: true,
            stars: 3,
            detail: `Held the lane for all ${FRAMES} frames with k=${gain.toFixed(2)}.`,
          });
        }
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [running, gain, dir, clamp, onComplete, stopLoop]);

  const reset = useCallback((): void => {
    stopLoop();
    setRunning(false);
    setOutcome("idle");
    setFrame(0);
    simRef.current = null;
    setMessage("Tune the controller, then press DRIVE.");
  }, [stopLoop]);

  // Live HUD values for the current frame (or a static preview before driving).
  const sim = simRef.current;
  const lane = sim ? sim.lanePath[Math.min(frame, FRAMES - 1)] : TRACK[0];
  const carX = sim ? sim.carPath[Math.min(frame, FRAMES - 1)] : 0;
  const offset = lane - carX;
  const sign = dir === "opposite" ? 1 : -1;
  const steerRaw = sign * gain * offset;
  const steer = clamp
    ? Math.max(-MAX_STEER, Math.min(MAX_STEER, steerRaw))
    : steerRaw;
  const inLane = Math.abs(offset) <= LANE_HALF;

  // Map an x-offset (px from centre) to an SVG x coordinate.
  const sx = useCallback((dx: number): number => W / 2 + dx, []);

  // Build the visible slice of road around the car: a window of upcoming frames
  // scrolls downward so the car appears to drive forward along a fixed track.
  const roadWindow = useMemo(() => {
    const span = 26; // frames visible ahead/behind
    const left: string[] = [];
    const right: string[] = [];
    const dash: string[] = [];
    for (let i = -span; i <= span; i++) {
      const f = Math.max(0, Math.min(FRAMES - 1, frame + i));
      const yc = CAR_Y - i * (H / (span * 1.55));
      const c = TRACK[f];
      left.push(`${sx(c - ROAD_HALF).toFixed(1)},${yc.toFixed(1)}`);
      right.push(`${sx(c + ROAD_HALF).toFixed(1)},${yc.toFixed(1)}`);
      dash.push(`${sx(c).toFixed(1)},${yc.toFixed(1)}`);
    }
    return { left: left.join(" "), right: right.join(" "), dash };
  }, [frame, sx]);

  const carScreenX = sx(carX);
  const laneScreenX = sx(lane);
  const elapsed = Math.min(frame, FRAMES);
  const pct = Math.round((elapsed / (FRAMES - 1)) * 100);

  const badgeColor = outcome === "lost" ? DANGER : inLane ? ACCENT : "#fbbf24";
  const badgeText =
    outcome === "lost" ? "OFF ROAD" : inLane ? "IN LANE" : "DRIFTING";

  return (
    <div className="flex w-full flex-col gap-3" style={{ maxWidth: 440 }}>
      <style>{`
        @keyframes g10selfdrivinglane-pulse {
          0%,100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        @keyframes g10selfdrivinglane-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Road stage */}
      <div
        className="panel relative overflow-hidden rounded-xl border p-2"
        style={{
          borderColor: outcome === "won" ? ACCENT : "var(--color-line, #27314f)",
          boxShadow:
            outcome === "won" ? `0 0 24px -4px ${ACCENT}` : undefined,
        }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full"
          role="img"
          aria-label="Top-down view of a car driving a curving lane it must stay centred in."
          style={{ maxHeight: 360, touchAction: "none" }}
        >
          {/* tarmac */}
          <rect x={0} y={0} width={W} height={H} fill="#0b1020" />
          {/* road band */}
          <polygon
            points={`${roadWindow.left} ${roadWindow.right.split(" ").reverse().join(" ")}`}
            fill="#161d33"
          />
          {/* lane edges */}
          <polyline points={roadWindow.left} fill="none" stroke="#3b4668" strokeWidth={3} />
          <polyline points={roadWindow.right} fill="none" stroke="#3b4668" strokeWidth={3} />
          {/* dashed centre line */}
          {roadWindow.dash.map((p, i) =>
            i % 2 === 0 ? (
              <circle key={`d${i}`} cx={Number(p.split(",")[0])} cy={Number(p.split(",")[1])} r={2.2} fill="#65709a" />
            ) : null,
          )}

          {/* lane-centre marker the car is chasing */}
          <line
            x1={laneScreenX}
            y1={CAR_Y - 30}
            x2={laneScreenX}
            y2={CAR_Y + 30}
            stroke={ACCENT}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            opacity={0.7}
          />

          {/* simulated camera strip under the car: two detected lane-edge markers */}
          <g opacity={0.95}>
            <rect
              x={carScreenX - 34}
              y={CAR_Y + 26}
              width={68}
              height={12}
              rx={2}
              fill="#05070d"
              stroke="#243049"
            />
            <rect x={sx(lane - LANE_HALF) - 1.5} y={CAR_Y + 27} width={3} height={10} fill={ACCENT} />
            <rect x={sx(lane + LANE_HALF) - 1.5} y={CAR_Y + 27} width={3} height={10} fill={ACCENT} />
          </g>

          {/* the car */}
          <g
            transform={`translate(${carScreenX} ${CAR_Y}) rotate(${(steer * 1.4).toFixed(2)})`}
            style={{ transition: running ? "none" : "transform 120ms ease" }}
          >
            <rect x={-12} y={-18} width={24} height={36} rx={5} fill={outcome === "lost" ? DANGER : ACCENT} />
            <rect x={-8} y={-12} width={16} height={11} rx={2} fill="#05140e" />
            <rect x={-8} y={4} width={16} height={8} rx={2} fill="#063322" opacity={0.8} />
          </g>

          {/* win confetti */}
          {outcome === "won" && (
            <g style={{ animation: "g10selfdrivinglane-pop 360ms ease-out" }}>
              <text x={W / 2} y={64} textAnchor="middle" fontSize={30}>
                ✨🎉
              </text>
              <text x={W / 2} y={98} textAnchor="middle" fontSize={24}>
                ⭐⭐⭐
              </text>
            </g>
          )}
        </svg>

        {/* HUD */}
        <div className="mt-1 flex items-center justify-between gap-2 px-1 text-xs">
          <span
            className="rounded-md px-2 py-0.5 font-semibold"
            role="status"
            aria-label={`Lane status: ${badgeText}`}
            style={{
              color: "#05070d",
              background: badgeColor,
              animation:
                badgeText === "DRIFTING" && running
                  ? "g10selfdrivinglane-pulse 0.6s ease-in-out infinite"
                  : undefined,
            }}
          >
            {badgeText}
          </span>
          <span className="font-mono tabular-nums text-ink-faint">
            offset {offset >= 0 ? "+" : ""}
            {offset.toFixed(0)}px · steer {steer >= 0 ? "+" : ""}
            {steer.toFixed(1)}°
          </span>
          <span className="font-mono tabular-nums" style={{ color: ACCENT }}>
            {pct}%
          </span>
        </div>
        {/* progress bar = lane-staying timer */}
        <div className="mx-1 mt-1 h-1.5 overflow-hidden rounded-full bg-panel-2">
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: outcome === "lost" ? DANGER : ACCENT,
              transition: "width 60ms linear",
            }}
          />
        </div>
      </div>

      {/* Controller authoring */}
      <div className="panel flex flex-col gap-3 rounded-xl p-3">
        {/* steering gain k */}
        <label className="flex flex-col gap-1 text-xs">
          <span className="flex items-center justify-between">
            <span className="text-ink-dim">
              steering gain k <span className="text-ink-faint">· correction per px</span>
            </span>
            <span className="font-display tabular-nums" style={{ color: ACCENT }}>
              {gain.toFixed(2)}
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={0.6}
            step={0.01}
            value={gain}
            disabled={running}
            onChange={(e) => setGain(Number(e.target.value))}
            aria-label={`Steering gain k, current value ${gain.toFixed(2)}`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-50"
            style={{ accentColor: ACCENT }}
          />
        </label>

        {/* rule direction */}
        <label className="flex items-center justify-between gap-2 text-xs">
          <span className="text-ink-dim">if lane centre is LEFT of car → steer</span>
          <select
            value={dir}
            disabled={running}
            onChange={(e) => setDir(e.target.value as Dir)}
            aria-label="Correction rule direction"
            className="rounded-md border border-line bg-panel/60 px-2 py-1 text-ink disabled:opacity-50"
          >
            <option value="opposite">left (toward it)</option>
            <option value="same">right (away)</option>
          </select>
        </label>

        {/* clamp */}
        <label className="flex items-center gap-2 text-xs text-ink-dim">
          <input
            type="checkbox"
            checked={clamp}
            disabled={running}
            onChange={(e) => setClamp(e.target.checked)}
            aria-label="Clamp steering to plus or minus max"
            style={{ accentColor: ACCENT }}
          />
          clamp steering to ±max (keeps a big offset from over-steering)
        </label>

        {/* status line */}
        <div
          className="rounded-md px-2 py-1 text-center text-xs"
          aria-live="polite"
          style={{
            color: outcome === "lost" ? DANGER : outcome === "won" ? "#05070d" : "#9aa6cf",
            background: outcome === "won" ? ACCENT : "transparent",
          }}
        >
          {message}
        </div>

        {/* actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onPointerDown={drive}
            disabled={running}
            className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ background: ACCENT, color: "#05070d" }}
            aria-label="Drive the car using your controller settings"
          >
            {running ? "Driving…" : "🚗 DRIVE"}
          </button>
          <button
            type="button"
            onPointerDown={reset}
            className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
            aria-label="Reset the car to the start"
          >
            Reset
          </button>
        </div>

        {/* show the math */}
        <button
          type="button"
          onPointerDown={() => setShowMath((s) => !s)}
          className="self-start text-[11px] underline"
          style={{ color: ACCENT }}
          aria-expanded={showMath}
        >
          {showMath ? "hide the math" : "show the math"}
        </button>
        {showMath && (
          <div className="rounded-md border border-line bg-panel-2/60 p-2 font-mono text-[11px] leading-relaxed text-ink-dim">
            <div>offset = laneCentre − carX = {offset.toFixed(0)} px</div>
            <div>
              steer = {dir === "opposite" ? "+" : "−"}k × offset ={" "}
              {sign > 0 ? "+" : "−"}
              {gain.toFixed(2)} × {offset.toFixed(0)} = {steerRaw.toFixed(1)}°
            </div>
            <div>
              {clamp ? `clamp ±${MAX_STEER}° → ${steer.toFixed(1)}°` : "clamp off"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
