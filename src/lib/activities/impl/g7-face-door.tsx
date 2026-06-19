"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

/* ── Face Recognition Door 🚪 ──────────────────────────────────────────────────
   GRADE 7 (innovator, age ~13–15). Subject: robotics.
   ONE learning goal: a recognizer turns a face into FEATURES, scores how well
   it matches an enrolled TEMPLATE (a confidence %), and a THRESHOLD decides
   accept vs reject — set too low and a stranger gets in (a false accept).

   The learner assembles the camera face by picking one tile per feature to
   match the highlighted enrolled person. Each correct feature adds a fixed
   weight to a live confidence meter; wrong tiles add nothing. A draggable
   threshold (default 70) sets the unlock line. At/above it the LED turns green,
   the servo dial sweeps 0°→90° and the cardboard door swings open. The round
   then presents an UNKNOWN intruder whose true face cannot be fully rebuilt
   from the enrolled tiles, so a fair threshold keeps the door shut on them.
   WIN: unlock the enrolled person AND keep the stranger locked out. Sliding the
   threshold too low to "force" an unlock visibly lets the intruder in — the
   false-accept trade-off, made tangible. Always solvable by matching features.
   ──────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#34d399";
const DANGER = "#f87171";
const AMBER = "#fbbf24";

/** The five feature categories that make up a face template. */
type Feature = "eyes" | "nose" | "mouth" | "glasses" | "hair";

const FEATURES: readonly Feature[] = ["eyes", "nose", "mouth", "glasses", "hair"];

const LABEL: Record<Feature, string> = {
  eyes: "eyes",
  nose: "nose",
  mouth: "mouth",
  glasses: "glasses",
  hair: "hair",
};

/** Emoji tile choices the learner can pick for each feature. */
const TILES: Record<Feature, readonly string[]> = {
  eyes: ["👀", "😑", "😍"],
  nose: ["👃", "🐽", "👃🏽"],
  mouth: ["👄", "👅", "😬"],
  glasses: ["👓", "🕶️", "🚫"],
  hair: ["🦱", "🦰", "🦲"],
};

/** A face is a chosen tile per feature. "" = nothing picked yet. */
type Face = Record<Feature, string>;

const EMPTY_FACE: Face = { eyes: "", nose: "", mouth: "", glasses: "", hair: "" };

interface Enrolled {
  name: string;
  avatar: string;
  template: Face;
}

/** The 3 enrolled people. Each is a fixed combination of feature tiles. */
const ENROLLED: readonly Enrolled[] = [
  {
    name: "Ava",
    avatar: "👩🏻",
    template: { eyes: "👀", nose: "👃", mouth: "👄", glasses: "👓", hair: "🦱" },
  },
  {
    name: "Ben",
    avatar: "🧑🏽",
    template: { eyes: "😑", nose: "🐽", mouth: "👅", glasses: "🚫", hair: "🦰" },
  },
  {
    name: "Cy",
    avatar: "🧑🏼",
    template: { eyes: "😍", nose: "👃🏽", mouth: "😬", glasses: "🕶️", hair: "🦲" },
  },
] as const;

/**
 * The unknown intruder's TRUE face. It deliberately reuses some enrolled tiles
 * but its eyes (🥸) and hair (🧑‍🦳-ish via 🦳) are NOT in the tile sets, so the
 * learner can never rebuild it from the enrolled choices. Its best honest match
 * to ANY template tops out at 2 features = 20 + 16 + 16 = 52% — safely below a
 * fair 70 threshold. The door only opens on the intruder if the threshold is
 * dragged unfairly low, which is exactly the false-accept lesson.
 */
const INTRUDER: { avatar: string; bestMatch: number } = {
  avatar: "🥷",
  bestMatch: 52,
};

/** Confidence weights: base + per-matched-feature. Max = 20 + 5*16 = 100. */
const BASE = 20;
const PER_FEATURE = 16;

/** Threshold bounds. Default 70 is a fair line; the floor lets it go unsafe. */
const MIN_T = 40;
const MAX_T = 95;
const DEFAULT_T = 70;

/** Which enrolled person the learner must unlock in the first round. */
const TARGET_INDEX = 0;

type Round = "enrolled" | "intruder";

/** Score a built face against a template: base + 16 per exactly-matched tile. */
function confidence(face: Face, template: Face): number {
  let matched = 0;
  for (const f of FEATURES) {
    if (face[f] !== "" && face[f] === template[f]) matched += 1;
  }
  return BASE + matched * PER_FEATURE;
}

export default function FaceRecognitionDoor({ onComplete }: ActivityProps) {
  const target = ENROLLED[TARGET_INDEX];

  const [round, setRound] = useState<Round>("enrolled");
  const [face, setFace] = useState<Face>({ ...EMPTY_FACE });
  const [threshold, setThreshold] = useState<number>(DEFAULT_T);
  /** True once the enrolled round was correctly unlocked at a fair threshold. */
  const [enrolledCleared, setEnrolledCleared] = useState<boolean>(false);
  const [solved, setSolved] = useState<boolean>(false);
  const [status, setStatus] = useState<string>(
    "Build the camera face to match Ava, then unlock the door.",
  );
  const firedRef = useRef<boolean>(false);

  // Live confidence for the current round.
  const conf = useMemo<number>(() => {
    if (round === "enrolled") return confidence(face, target.template);
    // The intruder's score doesn't depend on tiles — it's their honest best.
    return INTRUDER.bestMatch;
  }, [round, face, target.template]);

  const open = conf >= threshold;
  const servoAngle = open ? 90 : 0;

  const matchedCount = useMemo<number>(() => {
    if (round !== "enrolled") return 0;
    return FEATURES.reduce(
      (n, f) => (face[f] !== "" && face[f] === target.template[f] ? n + 1 : n),
      0,
    );
  }, [round, face, target.template]);

  const pick = useCallback(
    (feature: Feature, tile: string): void => {
      if (solved || round !== "enrolled") return;
      setFace((prev) => ({ ...prev, [feature]: prev[feature] === tile ? "" : tile }));
      setStatus("Recognizer re-scored the face — watch the confidence meter.");
    },
    [solved, round],
  );

  const onSlide = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      if (solved) return;
      setThreshold(Number(e.target.value));
    },
    [solved],
  );

  const win = useCallback((): void => {
    if (firedRef.current) return;
    firedRef.current = true;
    setSolved(true);
    setStatus("Locked to the right people — recognizer trusted. ✨");
    onComplete({
      passed: true,
      stars: 3,
      detail: `Unlocked Ava at ${conf}% and kept the stranger out with T=${threshold}.`,
    });
  }, [onComplete, conf, threshold]);

  // Pressing the door / unlock button is the deterministic grading moment.
  const tryDoor = useCallback((): void => {
    if (solved) return;

    if (round === "enrolled") {
      if (!open) {
        const need = Math.max(0, 5 - matchedCount);
        setStatus(
          `Confidence ${conf}% is below the ${threshold}% line — match ${need} more feature${need === 1 ? "" : "s"}.`,
        );
        onComplete({
          passed: false,
          detail: "Not enough confidence yet — match more features to cross the line.",
        });
        return;
      }
      // Door opened for the enrolled person. Was the threshold fair (≥ default)?
      if (threshold < DEFAULT_T) {
        setStatus(
          `Door opened, but T=${threshold} is loose. Raise it to ${DEFAULT_T}+ so a stranger can't sneak in.`,
        );
        onComplete({
          passed: false,
          detail: "Threshold too low — a fair door must still reject strangers.",
        });
        return;
      }
      // Fair unlock of the enrolled person → advance to the intruder test.
      setEnrolledCleared(true);
      setRound("intruder");
      setStatus(
        `Ava admitted at ${conf}%. Now an UNKNOWN face appears — keep the door SHUT.`,
      );
      onComplete({
        passed: false,
        detail: "Ava recognised. Next: prove the threshold rejects a stranger.",
      });
      return;
    }

    // Intruder round. The door must stay shut to win.
    if (open) {
      setStatus(
        `Stranger got in at ${INTRUDER.bestMatch}%! Your line (${threshold}%) is too low — raise it.`,
      );
      onComplete({
        passed: false,
        detail: "False accept — the threshold let a stranger through. Raise it.",
      });
      return;
    }
    // Stranger correctly rejected AND enrolled person was cleared earlier → win.
    if (enrolledCleared) {
      win();
    }
  }, [solved, round, open, matchedCount, conf, threshold, enrolledCleared, onComplete, win]);

  const reset = useCallback((): void => {
    setRound("enrolled");
    setFace({ ...EMPTY_FACE });
    setThreshold(DEFAULT_T);
    setEnrolledCleared(false);
    setSolved(false);
    setStatus("Build the camera face to match Ava, then unlock the door.");
    firedRef.current = false;
  }, []);

  const ledGreen = open;
  const isIntruder = round === "intruder";

  return (
    <div
      className="mx-auto flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink"
      style={{ touchAction: "manipulation" }}
    >
      <style>{`
        @keyframes g7facedoor-swing {
          from { transform: perspective(420px) rotateY(0deg); }
          to { transform: perspective(420px) rotateY(-72deg); }
        }
        @keyframes g7facedoor-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g7facedoor-flash {
          0%, 100% { box-shadow: 0 0 0 1px ${ACCENT}; }
          50% { box-shadow: 0 0 20px -2px ${ACCENT}; }
        }
        @keyframes g7facedoor-scan {
          0% { transform: translateY(-120%); }
          100% { transform: translateY(120%); }
        }
        @keyframes g7facedoor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>

      {/* Enrolled gallery + camera frame + door */}
      <div
        className="panel relative overflow-hidden rounded-xl p-3"
        style={solved ? { boxShadow: `0 0 0 1px ${ACCENT}, 0 0 24px -4px ${ACCENT}` } : undefined}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: ACCENT }}>
            🚪 Face Recognition Door
          </span>
          <span className="text-[10px] text-ink-faint">{ENROLLED.length} enrolled</span>
        </div>

        {/* Enrolled templates — target is highlighted */}
        <div className="mb-3 grid grid-cols-3 gap-1.5">
          {ENROLLED.map((p, i) => {
            const isTarget = i === TARGET_INDEX;
            return (
              <div
                key={p.name}
                className="flex flex-col items-center rounded-lg border py-1.5"
                style={{
                  borderColor: isTarget ? ACCENT : "var(--color-line, #27314f)",
                  background: isTarget ? "rgba(52,211,153,0.10)" : "rgba(11,16,32,0.5)",
                }}
                aria-label={`${p.name}${isTarget ? ", target to match" : ""}`}
              >
                <span className="text-2xl leading-none" aria-hidden="true">
                  {p.avatar}
                </span>
                <span className="mt-0.5 text-[10px] text-ink-dim">{p.name}</span>
                <span className="mt-0.5 flex gap-0.5 text-[9px]" aria-hidden="true">
                  {FEATURES.map((f) => (
                    <span key={f}>{p.template[f]}</span>
                  ))}
                </span>
                {isTarget && (
                  <span className="mt-0.5 text-[8px] font-bold" style={{ color: ACCENT }}>
                    TARGET
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Camera frame + servo door, side by side */}
        <div className="grid grid-cols-2 gap-2">
          {/* Camera frame */}
          <div className="relative overflow-hidden rounded-lg border border-line bg-black/40 p-2">
            <div className="mb-1 flex items-center justify-between text-[9px] text-ink-faint">
              <span>● CAM</span>
              <span>{isIntruder ? "unknown" : "incoming"}</span>
            </div>
            {!solved && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-1/3"
                style={{
                  background: `linear-gradient(180deg, transparent, ${ACCENT}44, transparent)`,
                  animation: "g7facedoor-scan 1.8s linear infinite",
                }}
              />
            )}
            <div
              className="grid place-items-center rounded-md bg-panel/40 py-2"
              role="img"
              aria-label={
                isIntruder
                  ? "An unknown intruder face in the camera"
                  : "The face you are assembling in the camera"
              }
            >
              {isIntruder ? (
                <span className="text-4xl leading-none" aria-hidden="true">
                  {INTRUDER.avatar}
                </span>
              ) : (
                <span className="flex flex-col items-center text-2xl leading-none" aria-hidden="true">
                  <span>{face.glasses && face.glasses !== "🚫" ? face.glasses : "　"}</span>
                  <span className="-mt-1">{face.hair || "　"}</span>
                  <span className="-mt-1">{face.eyes || "👁️"}</span>
                  <span className="-mt-1">{face.nose || "　"}</span>
                  <span className="-mt-1">{face.mouth || "　"}</span>
                </span>
              )}
            </div>
          </div>

          {/* Servo door */}
          <div className="relative flex flex-col items-center justify-center rounded-lg border border-line bg-panel/30 p-2">
            {/* LED + servo dial */}
            <div className="mb-1 flex w-full items-center justify-between text-[9px]">
              <span className="flex items-center gap-1 text-ink-faint">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{
                    background: ledGreen ? ACCENT : DANGER,
                    boxShadow: `0 0 6px ${ledGreen ? ACCENT : DANGER}`,
                    animation: ledGreen ? "none" : "g7facedoor-blink 1s ease-in-out infinite",
                  }}
                  aria-hidden="true"
                />
                {ledGreen ? "OPEN" : "LOCKED"}
              </span>
              <span className="tabular-nums text-ink-faint" aria-hidden="true">
                {servoAngle}°
              </span>
            </div>

            {/* Cardboard door frame */}
            <div
              className="relative h-20 w-16"
              style={{ perspective: "420px" }}
              role="img"
              aria-label={ledGreen ? "Door open" : "Door locked"}
            >
              <div className="absolute inset-0 rounded-sm border border-line bg-black/50" />
              <div
                className="absolute inset-0 origin-left rounded-sm border"
                style={{
                  borderColor: ledGreen ? ACCENT : "#7c5a3a",
                  background: ledGreen
                    ? "rgba(52,211,153,0.12)"
                    : "linear-gradient(180deg,#a8784e,#8a5f38)",
                  transformOrigin: "left center",
                  transform: ledGreen
                    ? "perspective(420px) rotateY(-72deg)"
                    : "perspective(420px) rotateY(0deg)",
                  transition: "transform 600ms cubic-bezier(.2,.7,.2,1)",
                }}
              >
                {!ledGreen && (
                  <span
                    className="absolute right-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
                    style={{ background: "#3a2a18" }}
                    aria-hidden="true"
                  />
                )}
              </div>
              {ledGreen && (
                <span
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-14deg] rounded border-2 px-1 text-[8px] font-black"
                  style={{ color: ACCENT, borderColor: ACCENT, animation: "g7facedoor-pop 260ms ease-out" }}
                  aria-hidden="true"
                >
                  UNLOCK
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Confidence meter */}
        <div className="mt-3">
          <div className="mb-0.5 flex items-center justify-between text-[10px]">
            <span className="text-ink-dim">confidence</span>
            <span className="font-semibold tabular-nums" style={{ color: open ? ACCENT : AMBER }}>
              {conf}%
            </span>
          </div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-panel-2">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${conf}%`,
                background: open ? ACCENT : AMBER,
              }}
            />
            {/* threshold marker */}
            <div
              className="absolute top-[-3px] bottom-[-3px] w-[2px]"
              style={{ left: `${threshold}%`, background: DANGER }}
              aria-hidden="true"
            />
          </div>
          <div className="mt-0.5 flex justify-between text-[8px] text-ink-faint">
            <span>0%</span>
            <span style={{ color: DANGER }}>▲ threshold {threshold}%</span>
            <span>100%</span>
          </div>
        </div>

        {/* status line */}
        <div
          className="mt-2 rounded-md px-2 py-1 text-center text-[11px]"
          role="status"
          aria-live="polite"
          style={{
            color: solved ? "#06281d" : isIntruder ? "#fde68a" : "#a7f3d0",
            background: solved
              ? ACCENT
              : isIntruder
                ? "rgba(251,191,36,0.10)"
                : "rgba(52,211,153,0.10)",
          }}
        >
          {status}
        </div>
      </div>

      {/* Feature tile picker (enrolled round only) */}
      {!isIntruder && (
        <div className="panel flex flex-col gap-2 rounded-xl p-3">
          <span className="text-[11px] font-semibold text-ink-dim">
            Match the features ({matchedCount}/5)
          </span>
          {FEATURES.map((f) => (
            <div key={f} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-[10px] text-ink-faint">{LABEL[f]}</span>
              <div className="flex flex-1 gap-1.5">
                {TILES[f].map((tile) => {
                  const chosen = face[f] === tile;
                  const correct = chosen && tile === target.template[f];
                  return (
                    <button
                      key={tile}
                      type="button"
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => pick(f, tile)}
                      disabled={solved}
                      aria-label={`${LABEL[f]} option ${tile}${correct ? ", matches" : ""}`}
                      aria-pressed={chosen}
                      className="grid h-9 flex-1 place-items-center rounded-lg border text-lg disabled:opacity-50"
                      style={{
                        borderColor: chosen
                          ? correct
                            ? ACCENT
                            : DANGER
                          : "var(--color-line, #27314f)",
                        background: chosen
                          ? correct
                            ? "rgba(52,211,153,0.14)"
                            : "rgba(248,113,113,0.12)"
                          : "rgba(11,16,32,0.6)",
                      }}
                    >
                      <span aria-hidden="true">{tile}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Threshold slider */}
      <div className="panel flex flex-col gap-2 rounded-xl p-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="flex items-center justify-between">
            <span className="text-ink-dim">
              Unlock threshold{" "}
              <span className="text-ink-faint">· open if confidence ≥ T</span>
            </span>
            <span className="font-semibold tabular-nums" style={{ color: ACCENT }}>
              T = {threshold}%
            </span>
          </span>
          <input
            type="range"
            min={MIN_T}
            max={MAX_T}
            step={1}
            value={threshold}
            onChange={onSlide}
            disabled={solved}
            aria-label={`Unlock threshold, current value ${threshold} percent`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2"
            style={{ accentColor: ACCENT, touchAction: "none" }}
          />
          <span className="flex justify-between text-[9px] text-ink-faint">
            <span>loose ({MIN_T})</span>
            <span>strict ({MAX_T})</span>
          </span>
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={tryDoor}
            disabled={solved}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ background: ACCENT, color: "#06281d" }}
            aria-label={
              isIntruder
                ? "Test the unknown face against the door"
                : "Try to unlock the door for Ava"
            }
          >
            {solved
              ? "Secured ✓"
              : isIntruder
                ? "Test stranger ▶"
                : "Try unlock 🔓"}
          </button>
          <button
            type="button"
            onClick={reset}
            onPointerDown={(e) => e.stopPropagation()}
            className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-xs font-medium text-ink-dim"
            aria-label="Reset the lab"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Win celebration */}
      {solved && (
        <div
          className="rounded-xl border p-3 text-center"
          role="status"
          aria-label="Lab complete"
          style={{
            borderColor: ACCENT,
            background: "rgba(52,211,153,0.10)",
            animation: "g7facedoor-flash 1.2s ease-in-out 2",
          }}
        >
          <p className="text-2xl" aria-hidden="true">
            ✨🎉
          </p>
          <p className="text-lg font-bold" style={{ color: ACCENT }}>
            ⭐⭐⭐
          </p>
          <p className="mt-1 text-[11px] leading-snug text-ink-dim">
            You unlocked Ava by matching her features past the line, and kept the
            stranger out by holding a fair threshold. That balance — accept the
            right face, reject the wrong one — is the heart of recognition.
          </p>
        </div>
      )}
    </div>
  );
}
