"use client";
// Learning goal: industrial product design begins with a real user problem,
// then models a 3D form by combining and sizing primitive solids (cylinder, box)
// to meet hard requirements (pocket-sized ≤ 8 cm, has a lid, has a clip).
// Everything is deterministic & always winnable — the grader checks the actual
// part list and numeric dimensions against the spec.
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

const ACCENT = "#f59e0b";
const MAX_CM = 8; // pocket-size limit on the largest dimension

/** Primitive solid kinds the learner can place on the workplane. */
type Kind = "cylinder" | "box" | "sphere" | "cone";

/** A part = which body it belongs to + its bounding size in cm. */
interface Part {
  id: number;
  kind: Kind;
  /** Logical role once placed — drives the requirements panel. */
  role: "body" | "lid" | "clip" | "none";
  w: number; // width / diameter (cm)
  h: number; // height (cm)
  d: number; // depth (cm)
}

type Material = "matte" | "metal";

interface Slot {
  kind: Kind;
  label: string;
  emoji: string;
  /** The role this primitive fills in a good earbud case. */
  want: "body" | "lid" | "clip" | "none";
}

/** Toolbar palette — only cylinder/box are part of the winning form. */
const PALETTE: readonly Slot[] = [
  { kind: "cylinder", label: "Cylinder", emoji: "🛢️", want: "body" },
  { kind: "box", label: "Box", emoji: "📦", want: "clip" },
  { kind: "sphere", label: "Sphere", emoji: "🔮", want: "none" },
  { kind: "cone", label: "Cone", emoji: "🔺", want: "none" },
] as const;

/** Sensible starting size per primitive (cm). Body starts OVER the limit. */
const START_SIZE: Record<Kind, { w: number; h: number; d: number }> = {
  cylinder: { w: 9, h: 5, d: 9 }, // intentionally too wide → learner must shrink ≤ 8
  box: { w: 2, h: 4, d: 1 },
  sphere: { w: 4, h: 4, d: 4 },
  cone: { w: 4, h: 5, d: 4 },
};

let NEXT_ID = 1;

/** Largest extent of a part in cm (what must be ≤ 8 to fit a pocket). */
function maxDim(p: Part): number {
  return Math.max(p.w, p.h, p.d);
}

export default function ProductDesignStudio({ onComplete }: ActivityProps) {
  // Phase 1 — problem statement dropdowns.
  const [who, setWho] = useState<string>("commuter");
  const [need, setNeed] = useState<string>("carry earbuds safely");
  const [because, setBecause] = useState<string>("they keep getting tangled");
  const [defined, setDefined] = useState<boolean>(false);

  // Phase 2 — placed parts + edit state.
  const [parts, setParts] = useState<Part[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [fillet, setFillet] = useState<boolean>(false);

  // Phase 3 — material + outcome.
  const [material, setMaterial] = useState<Material>("matte");
  const [solved, setSolved] = useState<boolean>(false);
  const [status, setStatus] = useState<string>(
    "Define the problem to unlock your design requirements.",
  );
  const firedRef = useRef<boolean>(false);

  const selectedPart = useMemo(
    () => parts.find((p) => p.id === sel) ?? null,
    [parts, sel],
  );

  // Requirement evaluation against the ACTUAL parts (deterministic).
  const body = useMemo(() => parts.find((p) => p.role === "body") ?? null, [parts]);
  const lid = useMemo(() => parts.find((p) => p.role === "lid") ?? null, [parts]);
  const clip = useMemo(() => parts.find((p) => p.role === "clip") ?? null, [parts]);

  const reqPocket = body !== null && maxDim(body) <= MAX_CM && (lid === null || maxDim(lid) <= MAX_CM);
  const reqLid = body !== null && lid !== null; // a lid only counts once combined onto a body
  const reqClip = clip !== null && clip.kind === "box";

  const reqs: { ok: boolean; label: string }[] = [
    { ok: reqPocket, label: `Pocket-sized — every part ≤ ${MAX_CM} cm` },
    { ok: reqLid, label: "Has a lid — a second body that closes the case" },
    { ok: reqClip, label: "Has a clip — a small box to attach it" },
  ];
  const allMet = reqPocket && reqLid && reqClip;

  const place = useCallback(
    (slot: Slot): void => {
      if (solved) return;
      const s = START_SIZE[slot.kind];
      const part: Part = {
        id: NEXT_ID++,
        kind: slot.kind,
        role: slot.want,
        w: s.w,
        h: s.h,
        d: s.d,
      };
      setParts((prev) => [...prev, part]);
      setSel(part.id);
      if (slot.kind === "cylinder" && maxDim(part) > MAX_CM) {
        setStatus(`Cylinder placed — but ${maxDim(part)} cm is too big for a pocket. Shrink it to ≤ ${MAX_CM} cm.`);
      } else if (slot.want === "none") {
        setStatus(`A ${slot.label.toLowerCase()} won't meet the spec on its own — but explore freely.`);
      } else {
        setStatus(`${slot.label} placed. Size it with the handles below.`);
      }
    },
    [solved],
  );

  const resize = useCallback(
    (axis: "w" | "h" | "d", value: number): void => {
      if (solved || sel === null) return;
      const v = Math.max(1, Math.min(12, value));
      setParts((prev) => prev.map((p) => (p.id === sel ? { ...p, [axis]: v } : p)));
    },
    [solved, sel],
  );

  // Combine a second cylinder onto the body → it becomes the lid.
  const combineLid = useCallback((): void => {
    if (solved || selectedPart === null) return;
    if (selectedPart.kind !== "cylinder") {
      setStatus("Combine needs a cylinder selected — that becomes the lid that closes the case.");
      return;
    }
    if (body === null) {
      setStatus("Place a cylinder body first, then combine a second cylinder as the lid.");
      return;
    }
    if (selectedPart.id === body.id) {
      setStatus("That cylinder is the body. Add a second, smaller cylinder, then combine it as the lid.");
      return;
    }
    setParts((prev) =>
      prev.map((p) => (p.id === selectedPart.id ? { ...p, role: "lid" } : p)),
    );
    setStatus("Combined! The second cylinder is now the lid — your case can close.");
  }, [solved, selectedPart, body]);

  const removePart = useCallback(
    (id: number): void => {
      if (solved) return;
      setParts((prev) => prev.filter((p) => p.id !== id));
      setSel((cur) => (cur === id ? null : cur));
    },
    [solved],
  );

  const defineProblem = useCallback((): void => {
    setDefined(true);
    setStatus(`Requirements locked: pocket-sized ≤ ${MAX_CM} cm, a lid, and a clip. Now model the case.`);
  }, []);

  const check = useCallback((): void => {
    if (solved) return;
    if (!defined) {
      setStatus("Define the problem first so we know the requirements.");
      onComplete({ passed: false, detail: "Lock in the problem statement to set the spec." });
      return;
    }
    if (body === null) {
      setStatus("Start the case body — drag a cylinder onto the workplane.");
      onComplete({ passed: false, detail: "Add a cylinder body to begin the case." });
      return;
    }
    if (!reqPocket) {
      const big = parts.filter((p) => maxDim(p) > MAX_CM)[0];
      const which = big ? `${big.role === "lid" ? "lid" : "body"} is ${maxDim(big)} cm` : "a part is too big";
      setStatus(`Too big for a pocket — ${which}. Shrink it to ≤ ${MAX_CM} cm.`);
      onComplete({ passed: false, detail: "A part exceeds the 8 cm pocket limit — shrink it." });
      return;
    }
    if (!reqLid) {
      setStatus("Your case won't close — add a second cylinder and combine it as a lid.");
      onComplete({ passed: false, detail: "Missing a lid — add and combine a second cylinder." });
      return;
    }
    if (!reqClip) {
      setStatus("No way to attach it — add a small box as a clip.");
      onComplete({ passed: false, detail: "Missing a clip — add a box part." });
      return;
    }
    // All requirements satisfied.
    setSolved(true);
    if (!firedRef.current) {
      firedRef.current = true;
      onComplete({
        passed: true,
        stars: 3,
        detail: `Earbud case meets spec: ${parts.length} parts, ≤ ${MAX_CM} cm, lid + clip, ${material} finish.`,
      });
    }
    setStatus("Ready to pitch! Your earbud case meets every requirement. ✨");
  }, [solved, defined, body, reqPocket, reqLid, reqClip, parts, material, onComplete]);

  const reset = useCallback((): void => {
    setParts([]);
    setSel(null);
    setFillet(false);
    setMaterial("matte");
    setDefined(false);
    setSolved(false);
    firedRef.current = false;
    setStatus("Define the problem to unlock your design requirements.");
  }, []);

  // ── Isometric render helpers ──────────────────────────────────────────────
  const iso = (x: number, y: number, z: number): { sx: number; sy: number } => ({
    sx: (x - y) * 0.5,
    sy: (x + y) * 0.25 - z * 0.5,
  });

  // Material shading. Metal = cool steel, matte = warm accent.
  const shade =
    material === "metal"
      ? { top: "#cdd6e6", left: "#7e8aa3", right: "#9aa6c2" }
      : { top: ACCENT, left: "#a06a06", right: "#c98708" };
  const edge = material === "metal" ? "#2a3247" : "#241a02";

  return (
    <div
      className="mx-auto flex w-full flex-col gap-3 font-mono text-ink"
      style={{ maxWidth: 440 }}
    >
      <style>{`
        @keyframes g10productcad-pop { 0%{transform:scale(.7);opacity:0} 60%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
        @keyframes g10productcad-glow { 0%,100%{filter:drop-shadow(0 0 2px ${ACCENT})} 50%{filter:drop-shadow(0 0 8px ${ACCENT})} }
        @keyframes g10productcad-stamp { 0%{transform:rotate(-14deg) scale(1.6);opacity:0} 70%{transform:rotate(-14deg) scale(.92)} 100%{transform:rotate(-14deg) scale(1);opacity:1} }
        .g10productcad-win { animation: g10productcad-pop 420ms ease-out both; }
        .g10productcad-pulse { animation: g10productcad-glow 1.7s ease-in-out infinite; }
        .g10productcad-stamp { animation: g10productcad-stamp 460ms cubic-bezier(.2,.8,.2,1.2) both; }
      `}</style>

      {/* ── Phase 1 — Define the problem ─────────────────────────────────── */}
      <div
        className="panel rounded-xl p-2.5"
        style={{ borderWidth: 1, borderStyle: "solid", borderColor: defined ? ACCENT : "var(--color-line, #27314f)" }}
      >
        <p className="mb-1.5 text-[11px] text-ink-dim">
          <span style={{ color: ACCENT }}>1.</span> Define the problem
        </p>
        <p className="text-[12px] leading-relaxed text-ink">
          A{" "}
          <Drop value={who} onChange={setWho} disabled={defined} ariaLabel="who needs this"
            options={["commuter", "gym-goer", "student"]} />{" "}
          needs a way to{" "}
          <Drop value={need} onChange={setNeed} disabled={defined} ariaLabel="what they need"
            options={["carry earbuds safely", "store a hearing aid", "hold a USB key"]} />{" "}
          because{" "}
          <Drop value={because} onChange={setBecause} disabled={defined} ariaLabel="why they need it"
            options={["they keep getting tangled", "it gets lost in a bag", "it rattles around loose"]} />.
        </p>
        {!defined ? (
          <button
            type="button"
            onPointerDown={defineProblem}
            className="mt-2 rounded-lg px-3 py-1.5 text-[12px] font-medium"
            style={{ background: ACCENT, color: "#0a0612", touchAction: "manipulation" }}
            aria-label="Lock in the problem statement and reveal the requirements"
          >
            Lock requirements
          </button>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-[11px]" aria-label="Design requirements">
            {reqs.map((r) => (
              <li key={r.label} className="flex items-center gap-1.5">
                <span aria-hidden="true" style={{ color: r.ok ? ACCENT : "#566", width: 14, display: "inline-block" }}>
                  {r.ok ? "✓" : "○"}
                </span>
                <span style={{ color: r.ok ? "#cbd3ef" : "#9aa6cf" }}>{r.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Phase 2 — Isometric workplane ────────────────────────────────── */}
      <div
        className={`panel rounded-xl p-2 ${solved ? "g10productcad-pulse" : ""}`}
        style={{ borderWidth: 1, borderStyle: "solid", borderColor: solved ? ACCENT : "var(--color-line, #27314f)" }}
      >
        <svg
          viewBox="-70 -70 140 120"
          className="block w-full"
          role="img"
          aria-label="Isometric workplane showing the earbud case model being assembled from primitive solids."
          style={{ maxHeight: 260 }}
        >
          {/* iso floor grid */}
          {Array.from({ length: 9 }, (_, k) => k - 4).map((i) => {
            const a = iso(i * 8, -32, 0);
            const b = iso(i * 8, 32, 0);
            const c = iso(-32, i * 8, 0);
            const d = iso(32, i * 8, 0);
            return (
              <g key={`grid${i}`} stroke="#1c2540" strokeWidth={0.6}>
                <line x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} />
                <line x1={c.sx} y1={c.sy} x2={d.sx} y2={d.sy} />
              </g>
            );
          })}

          {!defined && (
            <text x={0} y={0} textAnchor="middle" fill="#566" fontSize={6}>
              define the problem first
            </text>
          )}

          {/* Body + lid drawn as stacked iso disks; clip as a small box. */}
          {defined && body && <IsoCylinder part={body} shadeTop={shade.top} shadeSide={shade.left} edge={edge} z={0} fillet={fillet} iso={iso} selected={sel === body.id} />}
          {defined && lid && <IsoCylinder part={lid} shadeTop={shade.top} shadeSide={shade.right} edge={edge} z={(body ? body.h : 0) + 0.5} fillet={fillet} iso={iso} selected={sel === lid.id} />}
          {defined && clip && <IsoBox part={clip} shadeTop={shade.top} shadeLeft={shade.left} shadeRight={shade.right} edge={edge} iso={iso} selected={sel === clip.id} />}

          {solved && (
            <g className="g10productcad-stamp" transform="translate(0,-46)">
              <rect x={-34} y={-9} width={68} height={18} rx={3} fill="none" stroke={ACCENT} strokeWidth={1.6} />
              <text x={0} y={3.5} textAnchor="middle" fill={ACCENT} fontSize={7.5} fontWeight={700}>
                READY TO PITCH
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Toolbar of primitives */}
      <div className="panel rounded-xl p-2.5">
        <p className="mb-1.5 text-[11px] text-ink-dim">
          <span style={{ color: ACCENT }}>2.</span> Model — tap a primitive to add it
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {PALETTE.map((slot) => (
            <button
              key={slot.kind}
              type="button"
              onPointerDown={() => place(slot)}
              disabled={!defined || solved}
              aria-label={`Add a ${slot.label}`}
              className="flex flex-col items-center rounded-lg px-1 py-1.5 text-[11px] disabled:opacity-40"
              style={{
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: "var(--color-line, #27314f)",
                background: "rgba(11,16,32,0.6)",
                color: "#cbd3ef",
                touchAction: "manipulation",
              }}
            >
              <span aria-hidden="true" className="text-base">{slot.emoji}</span>
              <span>{slot.label}</span>
            </button>
          ))}
        </div>

        {/* Placed-part chips */}
        {parts.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {parts.map((p) => (
              <button
                key={p.id}
                type="button"
                onPointerDown={() => setSel(p.id)}
                aria-pressed={sel === p.id}
                aria-label={`Select the ${p.role === "none" ? p.kind : p.role}`}
                className="rounded-full px-2 py-1 text-[10px]"
                style={{
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: sel === p.id ? ACCENT : "var(--color-line, #27314f)",
                  background: sel === p.id ? "rgba(245,158,11,0.18)" : "rgba(11,16,32,0.6)",
                  color: sel === p.id ? "#fff" : "#9aa6cf",
                  touchAction: "manipulation",
                }}
              >
                {p.role === "none" ? p.kind : p.role} · {maxDim(p)}cm
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Resize + combine + fillet for the selected part */}
      {selectedPart && !solved && (
        <div className="panel rounded-xl p-2.5">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="text-ink-dim">
              Editing: <span style={{ color: ACCENT }}>{selectedPart.role === "none" ? selectedPart.kind : selectedPart.role}</span>
            </span>
            <button
              type="button"
              onPointerDown={() => removePart(selectedPart.id)}
              className="text-[10px] underline decoration-dotted"
              style={{ color: "#7c89b0", touchAction: "manipulation" }}
              aria-label="Delete the selected part"
            >
              delete
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["w", "h", "d"] as const).map((axis) => (
              <label key={axis} className="flex flex-col gap-1 text-[10px] text-ink-faint">
                <span className="flex items-center justify-between">
                  <span>{axis === "w" ? "width" : axis === "h" ? "height" : "depth"}</span>
                  <span className="tabular-nums" style={{ color: selectedPart[axis] > MAX_CM ? "#f87171" : ACCENT }}>
                    {selectedPart[axis]}cm
                  </span>
                </span>
                <input
                  type="range"
                  min={1}
                  max={12}
                  step={1}
                  value={selectedPart[axis]}
                  onChange={(e) => resize(axis, Number(e.target.value))}
                  aria-label={`${axis === "w" ? "Width" : axis === "h" ? "Height" : "Depth"} in centimetres`}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2"
                  style={{ accentColor: ACCENT, touchAction: "manipulation" }}
                />
              </label>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onPointerDown={combineLid}
              className="rounded-lg px-2.5 py-1 text-[11px]"
              style={{
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: "var(--color-line, #27314f)",
                background: "rgba(11,16,32,0.6)",
                color: "#cbd3ef",
                touchAction: "manipulation",
              }}
              aria-label="Combine the selected cylinder onto the body as a lid"
            >
              ⛓️ Combine as lid
            </button>
            <button
              type="button"
              onPointerDown={() => setFillet((f) => !f)}
              aria-pressed={fillet}
              className="rounded-lg px-2.5 py-1 text-[11px]"
              style={{
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: fillet ? ACCENT : "var(--color-line, #27314f)",
                background: fillet ? "rgba(245,158,11,0.18)" : "rgba(11,16,32,0.6)",
                color: fillet ? "#fff" : "#9aa6cf",
                touchAction: "manipulation",
              }}
            >
              ◜ Fillet {fillet ? "on" : "off"}
            </button>
          </div>
        </div>
      )}

      {/* ── Phase 3 — Material + spec card ───────────────────────────────── */}
      <div className="panel rounded-xl p-2.5">
        <p className="mb-1.5 text-[11px] text-ink-dim">
          <span style={{ color: ACCENT }}>3.</span> Render &amp; spec — pick a material
        </p>
        <div className="flex gap-1.5">
          {(["matte", "metal"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onPointerDown={() => setMaterial(m)}
              disabled={solved}
              aria-pressed={material === m}
              aria-label={`Render in ${m} finish`}
              className="flex-1 rounded-lg px-2 py-1.5 text-[11px] capitalize disabled:opacity-60"
              style={{
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: material === m ? ACCENT : "var(--color-line, #27314f)",
                background: material === m ? "rgba(245,158,11,0.18)" : "rgba(11,16,32,0.6)",
                color: material === m ? "#fff" : "#cbd3ef",
                touchAction: "manipulation",
              }}
            >
              {m === "matte" ? "🟧 Matte" : "⚙️ Metal"}
            </button>
          ))}
        </div>
        {/* Live spec card */}
        <div className="mt-2 rounded-lg p-2 text-[10px] tabular-nums" style={{ background: "rgba(11,16,32,0.5)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--color-line, #27314f)" }}>
          <div className="flex justify-between"><span className="text-ink-faint">dimensions</span><span className="text-ink-dim">{body ? `${body.w}×${body.h}×${body.d} cm` : "—"}</span></div>
          <div className="flex justify-between"><span className="text-ink-faint">parts</span><span className="text-ink-dim">{parts.length}</span></div>
          <div className="flex justify-between"><span className="text-ink-faint">material</span><span className="text-ink-dim capitalize">{material}{fillet ? " · filleted" : ""}</span></div>
        </div>
      </div>

      {/* Status + actions */}
      <div
        className="panel rounded-xl px-3 py-2 text-center text-[12px]"
        role="status"
        aria-live="polite"
        style={solved ? { background: ACCENT, color: "#0a0612" } : { color: "#9aa6cf" }}
      >
        {solved ? (
          <span className="g10productcad-win inline-block font-display">
            ✨🎉 {status} ⭐⭐⭐
          </span>
        ) : (
          status
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onPointerDown={check}
          disabled={solved}
          className="flex-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: ACCENT, color: "#0a0612", touchAction: "manipulation" }}
          aria-label="Check the model against the requirements"
        >
          {solved ? "Shipped!" : "Check spec"}
        </button>
        <button
          type="button"
          onPointerDown={reset}
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
          style={{ touchAction: "manipulation" }}
          aria-label="Reset the studio"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

/** A small dropdown styled inline so the sentence reads naturally. */
function Drop({
  value,
  onChange,
  options,
  disabled,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  disabled: boolean;
  ariaLabel: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label={ariaLabel}
      className="rounded-md px-1 py-0.5 text-[12px] disabled:opacity-80"
      style={{
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: ACCENT,
        background: "rgba(245,158,11,0.12)",
        color: "#f6d28b",
      }}
    >
      {options.map((o) => (
        <option key={o} value={o} style={{ color: "#0a0612" }}>
          {o}
        </option>
      ))}
    </select>
  );
}

/** Render a part as a short iso cylinder (two ellipses + a side band). */
function IsoCylinder({
  part,
  shadeTop,
  shadeSide,
  edge,
  z,
  fillet,
  iso,
  selected,
}: {
  part: Part;
  shadeTop: string;
  shadeSide: string;
  edge: string;
  z: number;
  fillet: boolean;
  iso: (x: number, y: number, z: number) => { sx: number; sy: number };
  selected: boolean;
}) {
  const rx = part.w * 1.4; // diameter → screen radius
  const ry = rx * 0.5; // iso foreshortening
  const top = iso(0, 0, z + part.h);
  const bot = iso(0, 0, z);
  return (
    <g opacity={selected ? 1 : 0.96}>
      {/* side band */}
      <path
        d={`M ${bot.sx - rx} ${bot.sy} A ${rx} ${ry} 0 0 0 ${bot.sx + rx} ${bot.sy} L ${top.sx + rx} ${top.sy} A ${rx} ${ry} 0 0 1 ${top.sx - rx} ${top.sy} Z`}
        fill={shadeSide}
        stroke={edge}
        strokeWidth={0.7}
      />
      {/* top cap */}
      <ellipse cx={top.sx} cy={top.sy} rx={rx} ry={ry} fill={shadeTop} stroke={selected ? ACCENT : edge} strokeWidth={selected ? 1.4 : 0.7} />
      {fillet && (
        <ellipse cx={top.sx} cy={top.sy} rx={rx * 0.7} ry={ry * 0.7} fill="none" stroke={edge} strokeWidth={0.4} opacity={0.5} />
      )}
    </g>
  );
}

/** Render a part as a small iso box (clip). */
function IsoBox({
  part,
  shadeTop,
  shadeLeft,
  shadeRight,
  edge,
  iso,
  selected,
}: {
  part: Part;
  shadeTop: string;
  shadeLeft: string;
  shadeRight: string;
  edge: string;
  iso: (x: number, y: number, z: number) => { sx: number; sy: number };
  selected: boolean;
}) {
  // Offset the clip to the side of the body so both are visible.
  const ox = 22;
  const oy = -6;
  const w = part.w * 2.2;
  const h = part.h * 1.6;
  const d = part.d * 2.2;
  const c = (x: number, y: number, zz: number) => {
    const p = iso(x, y, zz);
    return { sx: p.sx + ox, sy: p.sy + oy };
  };
  const v = [
    c(0, 0, h), c(w, 0, h), c(w, d, h), c(0, d, h), // top
    c(0, 0, 0), c(w, 0, 0), c(w, d, 0), c(0, d, 0), // bottom
  ];
  const poly = (idx: number[]): string => idx.map((i) => `${v[i].sx.toFixed(1)},${v[i].sy.toFixed(1)}`).join(" ");
  const stroke = selected ? ACCENT : edge;
  const sw = selected ? 1.2 : 0.7;
  return (
    <g opacity={selected ? 1 : 0.96}>
      <polygon points={poly([3, 2, 6, 7])} fill={shadeLeft} stroke={stroke} strokeWidth={sw} />
      <polygon points={poly([1, 2, 6, 5])} fill={shadeRight} stroke={stroke} strokeWidth={sw} />
      <polygon points={poly([0, 1, 2, 3])} fill={shadeTop} stroke={stroke} strokeWidth={sw} />
    </g>
  );
}
