"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Community Problem Solver — design thinking.                         */
/*  ONE learning goal: match a real person's PROBLEM to the right        */
/*  technology, CONFIGURE its key setting, then DEMO that it actually    */
/*  solves that exact problem. Empathy → match → tune → prove.          */
/* ------------------------------------------------------------------ */

const ACCENT = "#22d3ee"; // cyan — win / accent
const GOOD = "#34d399"; // solved green
const WARN = "#f59e0b"; // configure-me amber

type CharId = "librarian" | "gardener" | "guard";
type ToolId = "rfid" | "waterer" | "alarm" | "chatbot" | "arm";

interface ToolDef {
  id: ToolId;
  emoji: string;
  name: string;
}

const TOOLS: readonly ToolDef[] = [
  { id: "rfid", emoji: "📡", name: "RFID logger" },
  { id: "waterer", emoji: "💧", name: "Soil-sensor waterer" },
  { id: "alarm", emoji: "🚨", name: "Motion alarm" },
  { id: "chatbot", emoji: "💬", name: "Chatbot helpdesk" },
  { id: "arm", emoji: "🦾", name: "Robotic arm" },
] as const;

const TOOL_BY_ID: Record<ToolId, ToolDef> = TOOLS.reduce(
  (acc, t) => {
    acc[t.id] = t;
    return acc;
  },
  {} as Record<ToolId, ToolDef>,
);

/** Each setting option carries a value and whether it is the correct one. */
interface SettingOption {
  value: string;
  label: string;
  correct: boolean;
}

interface CharDef {
  id: CharId;
  face: string;
  name: string;
  problem: string;
  /** The single tool that truly fits. */
  needs: ToolId;
  /** Hint shown when the WRONG tool is dropped. */
  mismatch: string;
  /** Label for the one key setting the learner configures. */
  settingLabel: string;
  options: readonly SettingOption[];
  thanks: string;
}

/**
 * Three community members. Exactly ONE tool fits each, and exactly ONE
 * setting value makes the demo succeed — so the lab is always winnable
 * by reasoning, and every check below is deterministic.
 */
const CHARS: readonly CharDef[] = [
  {
    id: "librarian",
    face: "👩‍🏫",
    name: "Mara the Librarian",
    problem: "I can't tell who borrowed which book!",
    needs: "rfid",
    mismatch: "She needs to TAG and log each book — not water or guard it.",
    settingLabel: "What should the reader scan?",
    options: [
      { value: "tag", label: "the book's RFID tag", correct: true },
      { value: "cover", label: "the book's cover photo", correct: false },
      { value: "weight", label: "the book's weight", correct: false },
    ],
    thanks: "Now every book logs itself. Thank you!",
  },
  {
    id: "gardener",
    face: "👨‍🌾",
    name: "Theo the Gardener",
    problem: "My plants dry out every weekend!",
    needs: "waterer",
    mismatch: "He needs a sensor that WATERS when soil is dry — not a logger or alarm.",
    settingLabel: "Water the plant when the soil is…",
    options: [
      { value: "dry", label: "below the dry-threshold", correct: true },
      { value: "wet", label: "already soaking wet", correct: false },
      { value: "always", label: "every single minute", correct: false },
    ],
    thanks: "My garden stays green all weekend. Thank you!",
  },
  {
    id: "guard",
    face: "💂",
    name: "Ravi the Night Guard",
    problem: "I need to know who enters at night!",
    needs: "alarm",
    mismatch: "He needs motion DETECTION at night — not watering or book logging.",
    settingLabel: "Set the alarm's active hours to…",
    options: [
      { value: "night", label: "night only (8pm–6am)", correct: true },
      { value: "day", label: "daytime only", correct: false },
      { value: "off", label: "never active", correct: false },
    ],
    thanks: "Now I'm alerted the moment someone enters. Thank you!",
  },
] as const;

type Stage = "empty" | "matched" | "solved";

interface CharState {
  /** Tool dropped on this character (null = none yet). */
  tool: ToolId | null;
  /** Chosen setting value (null = not configured). */
  setting: string | null;
  stage: Stage;
}

function freshState(): Record<CharId, CharState> {
  return {
    librarian: { tool: null, setting: null, stage: "empty" },
    gardener: { tool: null, setting: null, stage: "empty" },
    guard: { tool: null, setting: null, stage: "empty" },
  };
}

const CHAR_BY_ID: Record<CharId, CharDef> = CHARS.reduce(
  (acc, c) => {
    acc[c.id] = c;
    return acc;
  },
  {} as Record<CharId, CharDef>,
);

export default function CommunityProblemSolver({ onComplete }: ActivityProps) {
  const [states, setStates] = useState<Record<CharId, CharState>>(freshState);
  const [active, setActive] = useState<CharId>("librarian");
  const [picked, setPicked] = useState<ToolId | null>(null); // tool armed from tray
  const [nudge, setNudge] = useState<string>("");
  const [demoFor, setDemoFor] = useState<CharId | null>(null); // who is mid-demo
  const firedOnce = useRef<boolean>(false);
  const demoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const solvedCount = useMemo(
    () => (Object.keys(states) as CharId[]).filter((id) => states[id].stage === "solved").length,
    [states],
  );
  const allSolved = solvedCount === CHARS.length;
  const activeDef = CHAR_BY_ID[active];
  const activeState = states[active];

  /* ---------- drop a tool onto the active character ---------- */
  const dropTool = useCallback(
    (toolId: ToolId) => {
      if (allSolved || demoFor) return;
      const def = CHAR_BY_ID[active];
      if (def.needs === toolId) {
        setStates((prev) => ({
          ...prev,
          [active]: { tool: toolId, setting: null, stage: "matched" },
        }));
        setNudge("");
      } else {
        // wrong tool — confused character, recoverable hint, never scold
        setStates((prev) => ({
          ...prev,
          [active]: { ...prev[active], tool: null, setting: null, stage: "empty" },
        }));
        setNudge(`${def.name.split(" ")[0]} looks confused. ${def.mismatch}`);
        onComplete({
          passed: false,
          detail: `${TOOL_BY_ID[toolId].name} doesn't fit that problem yet — try again.`,
        });
      }
      setPicked(null);
    },
    [active, allSolved, demoFor, onComplete],
  );

  /* ---------- tray tap: arm a tool, or drop if a char is selected ---------- */
  const onTrayPick = useCallback(
    (toolId: ToolId) => {
      if (allSolved || demoFor) return;
      // tap-to-place: arm then drop straight onto the active character
      setPicked((p) => (p === toolId ? null : toolId));
      setNudge("");
    },
    [allSolved, demoFor],
  );

  const onCharTap = useCallback(
    (id: CharId) => {
      if (allSolved || demoFor) return;
      setActive(id);
      if (picked) {
        // place the armed tool here
        const armed = picked;
        setActive(id);
        // dropTool reads `active`; place synchronously via a local apply
        const def = CHAR_BY_ID[id];
        if (def.needs === armed) {
          setStates((prev) => ({
            ...prev,
            [id]: { tool: armed, setting: null, stage: "matched" },
          }));
          setNudge("");
        } else {
          setStates((prev) => ({
            ...prev,
            [id]: { ...prev[id], tool: null, setting: null, stage: "empty" },
          }));
          setNudge(`${def.name.split(" ")[0]} looks confused. ${def.mismatch}`);
          onComplete({
            passed: false,
            detail: `${TOOL_BY_ID[armed].name} doesn't fit that problem yet — try again.`,
          });
        }
        setPicked(null);
      }
    },
    [allSolved, demoFor, picked, onComplete],
  );

  /* ---------- choose the key setting ---------- */
  const chooseSetting = useCallback(
    (id: CharId, value: string) => {
      if (demoFor) return;
      setStates((prev) => ({ ...prev, [id]: { ...prev[id], setting: value } }));
      setNudge("");
    },
    [demoFor],
  );

  /* ---------- run the short deterministic demo ---------- */
  const runDemo = useCallback(
    (id: CharId) => {
      if (demoFor) return;
      const def = CHAR_BY_ID[id];
      const st = states[id];
      if (st.tool !== def.needs || st.setting === null) return;
      const opt = def.options.find((o) => o.value === st.setting);
      const willPass = !!opt?.correct;

      setDemoFor(id);
      setNudge("");
      if (demoTimer.current) clearTimeout(demoTimer.current);
      demoTimer.current = setTimeout(() => {
        setDemoFor(null);
        if (willPass) {
          setStates((prev) => {
            const next: Record<CharId, CharState> = {
              ...prev,
              [id]: { ...prev[id], stage: "solved" },
            };
            const done = (Object.keys(next) as CharId[]).every(
              (k) => next[k].stage === "solved",
            );
            if (done && !firedOnce.current) {
              firedOnce.current = true;
              onComplete({
                passed: true,
                stars: 3,
                detail:
                  "Young Innovator! Every neighbour's problem matched, tuned and proven.",
              });
            }
            return next;
          });
        } else {
          // wrong setting — preview shows it failed; gentle, recoverable
          setNudge(
            `The demo didn't solve ${def.name.split(" ")[0]}'s problem yet — re-check the setting.`,
          );
          onComplete({
            passed: false,
            detail: "Almost — that setting didn't prove it works. Pick the one that fits.",
          });
        }
      }, 1100);
    },
    [demoFor, states, onComplete],
  );

  const reset = useCallback(() => {
    if (demoTimer.current) clearTimeout(demoTimer.current);
    setStates(freshState());
    setActive("librarian");
    setPicked(null);
    setNudge("");
    setDemoFor(null);
  }, []);

  /* ---------- live preview text before the demo ---------- */
  const previewText = useMemo<string>(() => {
    const st = activeState;
    const def = activeDef;
    if (st.stage === "solved") return "Solved ✓ — demo proved it works.";
    if (st.tool !== def.needs) return "Drag the best-matching tool onto the person.";
    if (st.setting === null) return "Now configure the one key setting below.";
    const opt = def.options.find((o) => o.value === st.setting);
    const okPreview = !!opt?.correct;
    if (def.id === "librarian")
      return okPreview
        ? "Preview: a borrowed book scans its tag → logged to the borrower."
        : "Preview: the reader can't identify the book this way…";
    if (def.id === "gardener")
      return okPreview
        ? "Preview: weekend soil goes dry → the waterer turns on."
        : "Preview: this never waters the dry weekend plant…";
    return okPreview
      ? "Preview: a night intruder moves → the alarm triggers."
      : "Preview: at this hour the alarm stays silent for the intruder…";
  }, [activeState, activeDef]);

  const canDemo =
    activeState.tool === activeDef.needs &&
    activeState.setting !== null &&
    activeState.stage !== "solved" &&
    !demoFor;

  /* ---------- demo animation glyph for the active char ---------- */
  const demoGlyph: string | null = useMemo(() => {
    if (demoFor !== active) return null;
    if (active === "librarian") return "📡📖";
    if (active === "gardener") return "💧🌱";
    return "🚨🌙";
  }, [demoFor, active]);

  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-col gap-3 text-ink">
      <style>{`
        @keyframes g5communityfixit-pop {
          0% { transform: scale(.5); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g5communityfixit-bob {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes g5communityfixit-zip {
          0% { transform: translateX(-14px); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateX(14px); opacity: 0; }
        }
        @keyframes g5communityfixit-ring {
          0% { transform: scale(.6); opacity: .9; }
          100% { transform: scale(2); opacity: 0; }
        }
        @keyframes g5communityfixit-glow {
          0%,100% { opacity: .35; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* ---------------- HEADLINE ---------------- */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-tech text-ink-faint">
          Innovation Lab · match → tune → demo
        </p>
        <span className="font-mono text-[11px]" style={{ color: allSolved ? GOOD : ACCENT }}>
          {solvedCount}/{CHARS.length} solved
        </span>
      </div>

      {/* ---------------- CHARACTERS ROW ---------------- */}
      <div className="grid grid-cols-3 gap-2" role="list" aria-label="Community members and their problems">
        {CHARS.map((c) => {
          const st = states[c.id];
          const isActive = c.id === active;
          const solved = st.stage === "solved";
          const demoing = demoFor === c.id;
          const border = solved ? GOOD : isActive ? ACCENT : "#1b2433";
          return (
            <button
              key={c.id}
              type="button"
              role="listitem"
              onPointerDown={(e) => {
                e.preventDefault();
                onCharTap(c.id);
              }}
              aria-label={`${c.name}. Problem: ${c.problem} ${
                solved ? "Solved." : st.tool ? "Tool matched, configure it." : "Needs a solution."
              }${picked ? ` Tap to place ${TOOL_BY_ID[picked].name}.` : ""}`}
              aria-pressed={isActive}
              className="relative flex flex-col items-center gap-1 rounded-xl border bg-panel/60 p-2 text-center transition"
              style={{
                borderColor: border,
                touchAction: "manipulation",
                boxShadow: solved
                  ? `0 0 0 1px ${GOOD}, 0 0 16px -6px ${GOOD}`
                  : isActive
                    ? `0 0 0 1px ${ACCENT}55`
                    : undefined,
              }}
            >
              {/* speech bubble */}
              <span
                className="min-h-[34px] w-full rounded-md px-1 py-1 font-mono text-[9px] leading-tight"
                style={{
                  background: solved ? "rgba(52,211,153,.14)" : "rgba(56,189,248,.07)",
                  color: solved ? GOOD : "var(--color-ink-dim, #9aa6b2)",
                }}
              >
                {solved ? `“${c.thanks}”` : `“${c.problem}”`}
              </span>
              {/* face */}
              <span
                className="text-2xl"
                aria-hidden
                style={{ animation: demoing ? "g5communityfixit-bob .5s ease infinite" : undefined }}
              >
                {c.face}
              </span>
              {/* attached tool / status chip */}
              <span
                className="flex h-5 items-center gap-1 rounded-full px-2 font-mono text-[8px]"
                style={{
                  background: solved
                    ? GOOD
                    : st.tool
                      ? "#0b1220"
                      : "transparent",
                  border: `1px solid ${solved ? GOOD : st.tool ? WARN : "#1b2433"}`,
                  color: solved ? "#05070d" : st.tool ? WARN : "#475569",
                }}
              >
                {solved ? (
                  <span aria-hidden>✓ solved</span>
                ) : st.tool ? (
                  <span aria-hidden>{TOOL_BY_ID[st.tool].emoji} tune</span>
                ) : (
                  <span aria-hidden>drop here</span>
                )}
              </span>

              {/* demo zip overlay */}
              {demoing && (
                <span
                  className="pointer-events-none absolute inset-x-0 top-1/2 text-center text-lg"
                  aria-hidden
                  style={{ animation: "g5communityfixit-zip 1s ease-in-out" }}
                >
                  {c.id === "librarian" ? "📡" : c.id === "gardener" ? "💧" : "🚨"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ---------------- TOOL TRAY ---------------- */}
      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-[11px] uppercase tracking-tech text-ink-faint">
          1 · Tap a tool, then tap the person it fits
        </p>
        <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Solution toolbox">
          {TOOLS.map((t) => {
            const armed = picked === t.id;
            return (
              <button
                key={t.id}
                type="button"
                disabled={allSolved || !!demoFor}
                onPointerDown={(e) => {
                  e.preventDefault();
                  onTrayPick(t.id);
                }}
                aria-label={`${t.name}${armed ? " — armed, now tap a person" : ""}`}
                aria-pressed={armed}
                title={t.name}
                className="flex flex-col items-center gap-0.5 rounded-lg border bg-panel/60 px-1 py-1.5 transition disabled:opacity-40"
                style={{
                  borderColor: armed ? ACCENT : "#1b2433",
                  touchAction: "manipulation",
                  boxShadow: armed ? `0 0 0 1px ${ACCENT}, 0 0 12px -4px ${ACCENT}` : undefined,
                }}
              >
                <span className="text-lg" aria-hidden>
                  {t.emoji}
                </span>
                <span className="font-mono text-[7px] leading-tight text-ink-faint">
                  {t.name.split(" ")[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------------- CONFIG PANEL (active char) ---------------- */}
      <div
        className="rounded-xl border p-3"
        style={{
          borderColor: activeState.stage === "solved" ? GOOD : "#1b2433",
          background: "rgba(56,189,248,.04)",
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-mono text-xs text-ink">
            <span aria-hidden className="text-base">
              {activeDef.face}
            </span>
            {activeDef.name.split(" ")[0]}
          </span>
          <span className="font-mono text-[10px]" style={{ color: activeState.tool ? WARN : "#475569" }}>
            {activeState.tool ? `${TOOL_BY_ID[activeState.tool].name}` : "no tool yet"}
          </span>
        </div>

        <p className="font-mono text-[11px] uppercase tracking-tech text-ink-faint">
          2 · {activeDef.settingLabel}
        </p>

        {activeState.tool === activeDef.needs ? (
          <div className="mt-1.5 flex flex-col gap-1.5">
            {activeDef.options.map((o) => {
              const sel = activeState.setting === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  disabled={activeState.stage === "solved" || !!demoFor}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    chooseSetting(active, o.value);
                  }}
                  aria-pressed={sel}
                  aria-label={`Setting: ${o.label}`}
                  className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left font-mono text-xs transition disabled:opacity-60"
                  style={{
                    borderColor: sel ? ACCENT : "#1b2433",
                    background: sel ? "rgba(34,211,238,.1)" : "transparent",
                    color: sel ? ACCENT : "var(--color-ink-dim, #9aa6b2)",
                    touchAction: "manipulation",
                  }}
                >
                  <span
                    aria-hidden
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: sel ? ACCENT : "#334155" }}
                  />
                  {o.label}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-1.5 font-mono text-[11px] text-ink-faint">
            Match the right tool to {activeDef.name.split(" ")[0]} first, then this panel unlocks.
          </p>
        )}

        {/* live preview + demo glyph */}
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-panel/60 px-2.5 py-2">
          {demoGlyph && (
            <span aria-hidden className="text-base" style={{ animation: "g5communityfixit-bob .5s ease infinite" }}>
              {demoGlyph}
            </span>
          )}
          <span className="font-mono text-[10px] leading-tight text-ink-dim">{previewText}</span>
        </div>

        <button
          type="button"
          disabled={!canDemo}
          onPointerDown={(e) => {
            e.preventDefault();
            if (canDemo) runDemo(active);
          }}
          aria-label={`Run the demo for ${activeDef.name}`}
          className="mt-2 w-full rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-40"
          style={{ background: ACCENT, color: "#05070d" }}
        >
          {demoFor === active ? "Demoing…" : activeState.stage === "solved" ? "Solved ✓" : "Demo ▶"}
        </button>
      </div>

      {/* ---------------- NUDGE ---------------- */}
      {nudge && !allSolved && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-lg px-3 py-2 text-center font-mono text-[11px]"
          style={{ background: "rgba(245,158,11,.1)", color: WARN, border: `1px solid ${WARN}55` }}
        >
          {nudge}
        </p>
      )}

      {/* ---------------- CERTIFICATE ---------------- */}
      <div
        className="relative overflow-hidden rounded-xl border p-3 text-center"
        role="status"
        aria-live="polite"
        aria-label={
          allSolved
            ? "Young Innovator certificate complete"
            : `Young Innovator certificate, ${solvedCount} of ${CHARS.length} stamps filled`
        }
        style={{
          borderColor: allSolved ? GOOD : "#1b2433",
          background: allSolved ? "rgba(52,211,153,.1)" : "rgba(56,189,248,.04)",
          boxShadow: allSolved ? `0 0 0 1px ${GOOD}, 0 0 24px -4px ${GOOD}` : undefined,
        }}
      >
        <svg viewBox="0 0 320 84" className="block h-auto w-full" aria-hidden>
          <rect
            x={4}
            y={4}
            width={312}
            height={76}
            rx={8}
            fill="none"
            stroke={allSolved ? GOOD : "#1b2433"}
            strokeWidth={1.5}
            strokeDasharray={allSolved ? "0" : "4 4"}
          />
          <text x={160} y={26} textAnchor="middle" fontSize={13} className="font-mono" fill={allSolved ? GOOD : "#64748b"}>
            🏅 YOUNG INNOVATOR
          </text>
          {CHARS.map((c, i) => {
            const solved = states[c.id].stage === "solved";
            const cx = 80 + i * 80;
            return (
              <g key={c.id} transform={`translate(${cx} 56)`}>
                <circle
                  cx={0}
                  cy={0}
                  r={15}
                  fill={solved ? "rgba(52,211,153,.18)" : "#0b1220"}
                  stroke={solved ? GOOD : "#334155"}
                  strokeWidth={1.5}
                  style={{ animation: solved ? "g5communityfixit-pop .4s ease both" : undefined }}
                />
                <text x={0} y={5} textAnchor="middle" fontSize={15}>
                  {solved ? "✓" : c.face}
                </text>
                {solved && (
                  <circle
                    cx={0}
                    cy={0}
                    r={15}
                    fill="none"
                    stroke={GOOD}
                    strokeWidth={1.5}
                    style={{ animation: "g5communityfixit-ring .7s ease-out" }}
                  />
                )}
              </g>
            );
          })}
        </svg>
        {allSolved && (
          <p className="mt-1 font-mono text-xs font-bold" style={{ color: GOOD }}>
            ⭐⭐⭐ 🎉✨ Young Innovator — all three problems solved!
          </p>
        )}
      </div>

      {/* ---------------- CONTROLS ---------------- */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
          aria-label="Reset the innovation lab"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
