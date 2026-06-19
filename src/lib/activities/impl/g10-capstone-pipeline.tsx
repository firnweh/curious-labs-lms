"use client";
// Learning goal: a real AI/IoT product is an end-to-end pipeline —
// input → process → model/logic → output — and it only works when every
// stage is filled with a block whose data TYPE flows into the next stage.
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

const ACCENT = "#22d3ee";
const GREEN = "#34d399";
const DANGER = "#f87171";

/** The data type that flows along a connector between two stages. */
type DataType = "image" | "person" | "decision" | "action";

/** The four ordered slots of the pipeline canvas. */
type Stage = "input" | "process" | "model" | "output";
const STAGES: readonly Stage[] = ["input", "process", "model", "output"] as const;
const STAGE_LABEL: Record<Stage, string> = {
  input: "INPUT",
  process: "PROCESS",
  model: "MODEL / LOGIC",
  output: "OUTPUT",
};

/**
 * A draggable pipeline block. `stage` says which slot it belongs in,
 * `accepts` is the data type it needs coming IN (null = a source), and
 * `emits` is the data type it sends OUT. The ONE correct chain is the set
 * of blocks flagged `correct: true`, and their types line up image→person→
 * decision→action. Decoys are real-looking blocks that break the type chain
 * or solve the wrong mission.
 */
interface Block {
  id: string;
  stage: Stage;
  icon: string;
  label: string;
  accepts: DataType | null;
  emits: DataType;
  /** Part of the single mission-correct pipeline. */
  correct: boolean;
  /** Friendly reason this block is wrong, surfaced only if the learner uses it. */
  why: string;
}

const BLOCKS: readonly Block[] = [
  // INPUT — only the camera produces an image the detector can read.
  { id: "camera", stage: "input", icon: "📷", label: "camera feed", accepts: null, emits: "image", correct: true, why: "" },
  { id: "temp", stage: "input", icon: "🌡️", label: "temp sensor", accepts: null, emits: "decision", correct: false, why: "a temperature reading can't feed an image detector — pick a matching input" },
  { id: "mic", stage: "input", icon: "🎙️", label: "sound sensor", accepts: null, emits: "decision", correct: false, why: "a sound level isn't a picture — the detector needs an image input" },
  // PROCESS — resize keeps it an image; clean-data turns it into a number stream.
  { id: "resize", stage: "process", icon: "🖼️", label: "resize frame", accepts: "image", emits: "image", correct: true, why: "" },
  { id: "clean", stage: "process", icon: "🧹", label: "clean data", accepts: "decision", emits: "decision", correct: false, why: "clean-data tidies numbers, not images — the detector still needs a frame" },
  // MODEL / LOGIC — only the detector turns an image into a person, then the rule decides.
  { id: "detector", stage: "model", icon: "🧠", label: "object detector + in-zone rule", accepts: "image", emits: "decision", correct: true, why: "" },
  { id: "threshold", stage: "model", icon: "📏", label: "threshold rule", accepts: "decision", emits: "decision", correct: false, why: "a threshold rule fires on a number, but no detector saw a person yet" },
  { id: "recommend", stage: "model", icon: "🛒", label: "recommender", accepts: "person", emits: "action", correct: false, why: "a recommender suggests items — it can't decide to stop traffic; use the in-zone rule" },
  // OUTPUT — only the red light acts on a STOP decision.
  { id: "redlight", stage: "output", icon: "🔴", label: "red-light signal", accepts: "decision", emits: "action", correct: true, why: "" },
  { id: "email", stage: "output", icon: "📧", label: "email alert", accepts: "person", emits: "action", correct: false, why: "an email is too slow to stop traffic — the crossing needs the red-light signal" },
  { id: "log", stage: "output", icon: "📊", label: "dashboard log", accepts: "person", emits: "action", correct: false, why: "logging just records the event — it never changes the light to stop cars" },
] as const;

const byId = (id: string): Block | undefined => BLOCKS.find((b) => b.id === id);

/** The transformed packet each correct stage prints as the test event flows. */
const FLOW_TEXT: Record<Stage, string> = {
  input: "frame captured 320×240",
  process: "frame resized → ready",
  model: "person detected (0.9) · in-crossing = TRUE",
  output: "STOP signal sent 🚦",
};

type Slots = Record<Stage, string | null>;
const EMPTY: Slots = { input: null, process: null, model: null, output: null };

/** Connector status between consecutive filled stages. */
type LinkState = "empty" | "good" | "bad";

export default function CapstonePipeline({ onComplete }: ActivityProps) {
  const [slots, setSlots] = useState<Slots>({ ...EMPTY });
  const [picked, setPicked] = useState<string | null>(null); // block id armed for placing
  const [running, setRunning] = useState<boolean>(false);
  const [reached, setReached] = useState<number>(-1); // how many stages the packet lit
  const [outcome, setOutcome] = useState<"idle" | "won" | "lost">("idle");
  const [message, setMessage] = useState<string>(
    "Mission: build a smart crossing that detects a pedestrian and stops traffic.",
  );
  const completedRef = useRef<boolean>(false);

  // Which placed-block ids are already used, so the palette can grey them out.
  const used = useMemo<Set<string>>(
    () => new Set(Object.values(slots).filter((v): v is string => v !== null)),
    [slots],
  );

  /** Type of the data leaving a stage (null if empty). */
  const emitOf = useCallback(
    (s: Stage): DataType | null => {
      const id = slots[s];
      return id ? (byId(id)?.emits ?? null) : null;
    },
    [slots],
  );
  const acceptOf = useCallback(
    (s: Stage): DataType | null => {
      const id = slots[s];
      return id ? (byId(id)?.accepts ?? null) : null;
    },
    [slots],
  );

  // Connector between stage i and i+1: green only when out-type == next in-type.
  const linkState = useCallback(
    (i: number): LinkState => {
      const out = emitOf(STAGES[i]);
      const inNext = acceptOf(STAGES[i + 1]);
      if (out === null || inNext === null) return "empty";
      return out === inNext ? "good" : "bad";
    },
    [emitOf, acceptOf],
  );

  const allFilled = STAGES.every((s) => slots[s] !== null);
  const allLinksGood =
    allFilled && [0, 1, 2].every((i) => linkState(i) === "good");
  const allCorrectBlocks = STAGES.every((s) => byId(slots[s] ?? "")?.correct);

  const placeIn = useCallback(
    (stage: Stage): void => {
      if (running || completedRef.current) return;
      if (picked === null) {
        // tapping a filled slot with nothing armed clears it
        if (slots[stage] !== null) {
          setSlots((prev) => ({ ...prev, [stage]: null }));
          setOutcome("idle");
          setReached(-1);
        }
        return;
      }
      const block = byId(picked);
      if (!block) return;
      if (block.stage !== stage) {
        setMessage(
          `That block belongs in the ${STAGE_LABEL[block.stage]} track — try the ${STAGE_LABEL[block.stage]} slot.`,
        );
        return;
      }
      setSlots((prev) => ({ ...prev, [stage]: block.id }));
      setPicked(null);
      setOutcome("idle");
      setReached(-1);
      setMessage(
        `${block.icon} ${block.label} placed in ${STAGE_LABEL[stage]}.`,
      );
    },
    [picked, running, slots],
  );

  const pick = useCallback(
    (id: string): void => {
      if (running || completedRef.current) return;
      if (used.has(id)) return;
      setPicked((cur) => (cur === id ? null : id));
    },
    [running, used],
  );

  const reset = useCallback((): void => {
    setSlots({ ...EMPTY });
    setPicked(null);
    setRunning(false);
    setReached(-1);
    setOutcome("idle");
    setMessage(
      "Mission: build a smart crossing that detects a pedestrian and stops traffic.",
    );
  }, []);

  // Deterministic test-packet run: validate order/types, then animate stage by stage.
  const run = useCallback((): void => {
    if (running || completedRef.current) return;
    if (!allFilled) {
      setMessage("Fill all four slots first — data has to flow input → process → model → output.");
      return;
    }
    // A broken type connector refuses to run and names the offending pair.
    for (let i = 0; i < 3; i++) {
      if (linkState(i) === "bad") {
        const bad = byId(slots[STAGES[i + 1]] ?? "");
        const detail = bad?.why ?? "those two stages don't share a data type — pick a matching block";
        setOutcome("lost");
        setReached(-1);
        setMessage(detail);
        onComplete({ passed: false, detail });
        return;
      }
    }

    // Types line up. Animate the packet flowing left to right.
    setRunning(true);
    setOutcome("idle");
    setReached(-1);
    setMessage("Running pipeline…");
    let step = 0;
    const tick = (): void => {
      setReached(step);
      step += 1;
      if (step <= 3) {
        window.setTimeout(tick, 650);
        return;
      }
      // Packet reached OUTPUT — judge the action it produced.
      setRunning(false);
      if (allCorrectBlocks) {
        setOutcome("won");
        setMessage("TRAFFIC STOPPED — pedestrian safe ✨🎉");
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete({
            passed: true,
            stars: 3,
            detail:
              "Wired camera → resize → detector+rule → red light; the test pedestrian stopped traffic.",
          });
        }
      } else {
        // Types matched but a wrong-logic block produced the wrong action.
        const wrong = STAGES.map((s) => byId(slots[s] ?? "")).find(
          (b) => b && !b.correct,
        );
        const detail =
          wrong?.why ??
          "the packet flowed through, but the action was wrong — re-check each block fits THIS mission";
        setOutcome("lost");
        setMessage(detail);
        onComplete({ passed: false, detail });
      }
    };
    window.setTimeout(tick, 250);
  }, [running, allFilled, allCorrectBlocks, linkState, slots, onComplete]);

  const won = outcome === "won";

  return (
    <div className="flex w-full flex-col gap-3" style={{ maxWidth: 440 }}>
      <style>{`
        @keyframes g10capstonepipeline-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g10capstonepipeline-flow {
          0% { transform: translateX(-4px); opacity: 0.4; }
          50% { opacity: 1; }
          100% { transform: translateX(4px); opacity: 0.4; }
        }
        @keyframes g10capstonepipeline-glow {
          0%,100% { box-shadow: 0 0 0 1px ${ACCENT}33; }
          50% { box-shadow: 0 0 10px -1px ${ACCENT}; }
        }
      `}</style>

      {/* Mission card */}
      <div
        className="panel rounded-xl border p-3"
        style={{ borderColor: won ? GREEN : "var(--color-line, #27314f)" }}
      >
        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: ACCENT }}>
          <span aria-hidden="true">🏆</span> Mission Card
        </div>
        <p
          className="mt-1 rounded-md px-2 py-1 text-center text-xs"
          role="status"
          aria-live="polite"
          style={{
            color: won ? "#05140e" : outcome === "lost" ? DANGER : "#9aa6cf",
            background: won ? GREEN : "transparent",
          }}
        >
          {message}
        </p>
      </div>

      {/* Pipeline canvas */}
      <div
        className="panel rounded-xl border p-2"
        style={{
          borderColor: won ? GREEN : "var(--color-line, #27314f)",
          boxShadow: won ? `0 0 24px -4px ${GREEN}` : undefined,
        }}
      >
        <div className="flex items-stretch gap-0.5">
          {STAGES.map((stage, i) => {
            const id = slots[stage];
            const block = id ? byId(id) : undefined;
            const lit = reached >= i;
            const armedHere = picked !== null && byId(picked)?.stage === stage;
            return (
              <div key={stage} className="flex flex-1 items-center">
                <button
                  type="button"
                  onPointerDown={() => placeIn(stage)}
                  aria-label={`${STAGE_LABEL[stage]} slot${block ? `: ${block.label}` : ", empty"}`}
                  className="flex min-h-[88px] w-full flex-col items-center justify-center gap-1 rounded-lg border p-1 text-center transition"
                  style={{
                    borderColor: lit && block?.correct
                      ? GREEN
                      : armedHere
                        ? ACCENT
                        : "var(--color-line, #27314f)",
                    background: lit ? "rgba(52,211,153,0.10)" : "rgba(11,16,32,0.6)",
                    animation: armedHere ? "g10capstonepipeline-glow 1.1s ease-in-out infinite" : undefined,
                  }}
                >
                  <span className="text-[9px] font-semibold tracking-wide text-ink-faint">
                    {STAGE_LABEL[stage]}
                  </span>
                  {block ? (
                    <>
                      <span className="text-2xl" aria-hidden="true">{block.icon}</span>
                      <span className="text-[9px] leading-tight text-ink-dim">{block.label}</span>
                    </>
                  ) : (
                    <span className="text-[10px] text-ink-faint">tap to place</span>
                  )}
                  {lit && (
                    <span
                      className="text-[8px] leading-tight"
                      style={{ color: GREEN }}
                    >
                      {FLOW_TEXT[stage]}
                    </span>
                  )}
                </button>

                {/* connector to the next stage */}
                {i < 3 && (
                  <ConnectorArrow
                    state={linkState(i)}
                    flowing={running && reached === i}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* win banner */}
        {won && (
          <div
            className="mt-2 text-center"
            style={{ animation: "g10capstonepipeline-pop 360ms ease-out" }}
          >
            <div className="text-2xl">✨🎉</div>
            <div className="text-xl">⭐⭐⭐</div>
          </div>
        )}
      </div>

      {/* Palette grouped by track */}
      <div className="panel flex flex-col gap-2 rounded-xl p-2">
        {STAGES.map((stage) => (
          <div key={stage}>
            <div className="px-1 text-[10px] font-semibold tracking-wide text-ink-faint">
              {STAGE_LABEL[stage]}
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {BLOCKS.filter((b) => b.stage === stage).map((b) => {
                const isUsed = used.has(b.id);
                const isPicked = picked === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onPointerDown={() => pick(b.id)}
                    disabled={isUsed || running || won}
                    aria-label={`${b.label}${isUsed ? ", placed" : isPicked ? ", selected, tap a slot" : ""}`}
                    aria-pressed={isPicked}
                    className="flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] transition disabled:opacity-35"
                    style={{
                      touchAction: "manipulation",
                      borderColor: isPicked ? ACCENT : "var(--color-line, #27314f)",
                      background: isPicked ? "rgba(34,211,238,0.15)" : "rgba(11,16,32,0.6)",
                      color: "#cbd3ef",
                    }}
                  >
                    <span aria-hidden="true">{b.icon}</span>
                    <span>{b.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onPointerDown={run}
          disabled={running || won}
          className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
          style={{ background: ACCENT, color: "#05070d" }}
          aria-label="Run the test packet through the assembled pipeline"
        >
          {running ? "Running…" : won ? "Solved!" : "▶ RUN PIPELINE"}
        </button>
        <button
          type="button"
          onPointerDown={reset}
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
          aria-label="Clear all slots and start over"
        >
          Reset
        </button>
      </div>

      <p className="px-1 text-[11px] leading-tight text-ink-faint">
        {picked
          ? "A block is selected — tap its matching pipeline slot to drop it in."
          : "Tap a block to pick it up, then tap a slot. A connector glows green only when one stage's output type matches the next stage's input."}
      </p>
    </div>
  );
}

/** A horizontal connector that snaps green for a valid type match, red for a mismatch. */
function ConnectorArrow({
  state,
  flowing,
}: {
  state: LinkState;
  flowing: boolean;
}) {
  const color = state === "good" ? GREEN : state === "bad" ? DANGER : "#3b4668";
  return (
    <svg
      width={16}
      height={20}
      viewBox="0 0 16 20"
      className="shrink-0"
      role="img"
      aria-label={
        state === "good"
          ? "connector valid"
          : state === "bad"
            ? "connector type mismatch"
            : "connector empty"
      }
    >
      {state === "bad" ? (
        // broken connector: a gap with a tiny break
        <>
          <line x1={0} y1={10} x2={5} y2={10} stroke={color} strokeWidth={2} />
          <line x1={11} y1={10} x2={16} y2={10} stroke={color} strokeWidth={2} />
          <text x={8} y={13} textAnchor="middle" fontSize={7} fill={color}>✕</text>
        </>
      ) : (
        <g style={flowing ? { animation: "g10capstonepipeline-flow 0.65s ease-in-out" } : undefined}>
          <line x1={0} y1={10} x2={12} y2={10} stroke={color} strokeWidth={2} />
          <polygon points="12,6 16,10 12,14" fill={color} />
        </g>
      )}
    </svg>
  );
}
