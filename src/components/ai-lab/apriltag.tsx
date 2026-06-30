"use client";

import { useMemo, useState } from "react";
import { Caption, Footer, Hi, LabHeader } from "./_ui";

/**
 * Neural Lab — "Robot Tags" (AprilTag / fiducial markers).
 *
 * Browsers can't decode AprilTags live (no native API), so this is a hands-on
 * concept lab: a printed marker carries an ID *and*, by how it looks skewed,
 * tells a robot the tag's angle and distance — its "pose". Spin and zoom the
 * tag to hit a target pose, the way a robot lines itself up to a docking tag.
 */

const ACCENT = "#22d3ee";
// A fixed 6×6 marker bit pattern (black border + a data core) — represents "ID 7".
const BITS = [
  [0, 0, 0, 0, 0, 0],
  [0, 1, 1, 0, 1, 0],
  [0, 0, 1, 1, 0, 0],
  [0, 1, 0, 0, 1, 0],
  [0, 1, 1, 0, 1, 0],
  [0, 0, 0, 0, 0, 0],
];
const TARGET_ANGLE = 45;
const TARGET_ZOOM = 70; // %

export default function RobotTags() {
  const [angle, setAngle] = useState(0);
  const [zoom, setZoom] = useState(100);

  const angleOk = Math.abs(angle - TARGET_ANGLE) <= 6;
  const zoomOk = Math.abs(zoom - TARGET_ZOOM) <= 8;
  const docked = angleOk && zoomOk;

  // crude "pose read-out" derived from the controls
  const distance = useMemo(() => (200 / zoom).toFixed(2), [zoom]);

  return (
    <div className="mx-auto w-full max-w-[620px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader emoji="🏷️" title="Robot Tags" grades="Grades 5–10" topic="Computer vision" accent={ACCENT} right={docked ? "✓ docked!" : ""} />

      <Caption accent={ACCENT} active={docked}>
        {docked
          ? "🤖 Docked! From one printed tag a robot reads three things: WHICH tag (the ID), how it's TURNED (angle), and how FAR it is (size). That's why warehouse robots and AR apps stick these markers everywhere."
          : "Spin and zoom the tag to match the target pose (angle ≈ 45°, size ≈ 70%) — like a robot lining up to a docking tag."}
      </Caption>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid aspect-square place-items-center rounded-2xl border border-[#1e2738] bg-[#0b1018]">
          <div style={{ transform: `rotate(${angle}deg) scale(${zoom / 100})`, transition: "transform 80ms linear" }}>
            <svg width="180" height="180" viewBox="0 0 6 6" shapeRendering="crispEdges">
              {BITS.map((row, y) =>
                row.map((b, x) => (
                  <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={b ? "#e8eefc" : "#0b1018"} />
                )),
              )}
              <rect x="0" y="0" width="6" height="6" fill="none" stroke={ACCENT} strokeWidth="0.08" />
            </svg>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-4 rounded-2xl border border-[#1e2738] bg-[#0f1420] p-4">
          <label className="block">
            <span className="font-mono text-[10px] text-[#9fb0d0]">Angle: {angle}° {angleOk && <span style={{ color: ACCENT }}>✓</span>}</span>
            <input type="range" min={0} max={90} value={angle} onChange={(e) => setAngle(+e.target.value)} className="mt-1 w-full" style={{ accentColor: ACCENT }} />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] text-[#9fb0d0]">Size: {zoom}% {zoomOk && <span style={{ color: ACCENT }}>✓</span>}</span>
            <input type="range" min={40} max={140} value={zoom} onChange={(e) => setZoom(+e.target.value)} className="mt-1 w-full" style={{ accentColor: ACCENT }} />
          </label>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { k: "Tag ID", v: "7" },
              { k: "Angle", v: `${angle}°` },
              { k: "Distance", v: `${distance} m` },
            ].map((s) => (
              <div key={s.k} className="rounded-lg border border-[#1e2738] bg-[#0b1018] px-2 py-1.5">
                <div className="font-mono text-sm font-semibold" style={{ color: ACCENT }}>{s.v}</div>
                <div className="font-mono text-[8px] text-[#5b6b8c]">{s.k}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Footer accent={ACCENT}>
        An <Hi accent={ACCENT}>AprilTag</Hi> is like a QR code built for robots: a bold pattern that's easy to spot
        from far away and at an angle. The robot reads the tag's <Hi accent={ACCENT}>ID</Hi> and, from how squashed
        and rotated it looks, works out the tag's position and angle — its “pose”. Used in robotics, drones and AR.
      </Footer>
    </div>
  );
}
