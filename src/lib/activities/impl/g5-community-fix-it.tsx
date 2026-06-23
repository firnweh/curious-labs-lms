"use client";
import type { ActivityProps } from "@/lib/activities/types";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Community Problem Solver — design thinking, leveled UP.            */
/*                                                                     */
/*  CLASS 4-6 (explorer, age ~9-11). The learner is the neighbourhood */
/*  inventor. Each neighbour's problem is now a LIST of real           */
/*  requirements (✓ must-haves). The tray holds modules, each with a   */
/*  COST in credits and the capabilities it provides. You must DESIGN  */
/*  a build — a COMBINATION of modules — that covers EVERY requirement */
/*  while staying inside the budget, then run a Test to prove it.      */
/*                                                                     */
/*  Why it is a real problem, not a keyword match:                     */
/*   • Several modules each cover SOME requirements — you must plan a   */
/*     combination, not pick "the one obvious tool".                   */
/*   • A tempting all-in-one module covers everything but blows the    */
/*     budget (or wastes credits) — a cheaper 2-module combo wins.     */
/*   • Decoy modules match a requirement's KEYWORD but miss a hidden   */
/*     second need, so brute pattern-matching fails the Test.          */
/*   • OPTIMIZE: spend at-or-under the smart target → full stars for   */
/*     that round. Over target but covered → it still passes, fewer    */
/*     stars. A clean 3-star win is always reachable by reasoning.     */
/*   • THREE escalating rounds (2 → 3 → 3 reqs, tighter budgets).      */
/*                                                                     */
/*  Deterministic grading, gentle retry (never scolds, never spams     */
/*  onComplete on a miss), onComplete fired EXACTLY once on the final  */
/*  win, guarded by reportedRef. Preserves the cyan look, the          */
/*  certificate, animations, aria and reduced-motion support.          */
/* ------------------------------------------------------------------ */

const ACCENT = "#22d3ee"; // cyan — win / accent
const GOOD = "#34d399"; // covered / solved green
const WARN = "#f59e0b"; // over-budget / missing amber
const BAD = "#f87171"; // hard fail red

/** The capabilities a module can provide / a requirement can demand. */
type Cap =
  | "identify" // tell things/people apart by a unique id
  | "log" // record events to a list
  | "sense" // read the physical world (soil, motion, heat)
  | "act" // do a physical action (water, move)
  | "alert" // send a warning / notification
  | "schedule" // only act during chosen hours
  | "answer"; // reply to questions in words

const CAP_LABEL: Record<Cap, string> = {
  identify: "tell apart by ID",
  log: "keep a record",
  sense: "sense the world",
  act: "do an action",
  alert: "send an alert",
  schedule: "work on a schedule",
  answer: "answer in words",
};

interface ModuleDef {
  id: string;
  emoji: string;
  name: string;
  cost: number;
  caps: readonly Cap[];
}

/** The shared toolbox. Costs + capabilities are tuned so that for every
 *  round a CHEAPER combination beats the tempting all-in-one. */
const MODULES: readonly ModuleDef[] = [
  { id: "tagreader", emoji: "📡", name: "Tag reader", cost: 2, caps: ["identify"] },
  { id: "logbook", emoji: "📒", name: "Cloud logbook", cost: 1, caps: ["log"] },
  { id: "soil", emoji: "🌱", name: "Soil sensor", cost: 2, caps: ["sense"] },
  { id: "pump", emoji: "💧", name: "Water pump", cost: 2, caps: ["act"] },
  { id: "motion", emoji: "👁️", name: "Motion sensor", cost: 2, caps: ["sense"] },
  { id: "siren", emoji: "🚨", name: "Alert siren", cost: 2, caps: ["alert"] },
  { id: "timer", emoji: "⏰", name: "Night timer", cost: 1, caps: ["schedule"] },
  { id: "chatbot", emoji: "💬", name: "Chatbot", cost: 3, caps: ["answer"] },
  // The shiny "all-in-one" temptation: covers a lot, but costs a fortune.
  { id: "megabox", emoji: "🧰", name: "Mega-box (all-in-one)", cost: 7, caps: ["sense", "act", "schedule", "alert"] },
] as const;

const MOD_BY_ID: Record<string, ModuleDef> = MODULES.reduce(
  (acc, m) => {
    acc[m.id] = m;
    return acc;
  },
  {} as Record<string, ModuleDef>,
);

interface Requirement {
  cap: Cap;
  /** Human-readable phrasing of this specific need. */
  text: string;
}

interface RoundDef {
  id: string;
  face: string;
  name: string;
  problem: string;
  reqs: readonly Requirement[];
  budget: number;
  /** Smallest total cost of any module set that covers all reqs (precomputed
   *  + verified at module load). Spend ≤ this ⇒ full stars for the round. */
  target: number;
  thanks: string;
}

/**
 * Three neighbours, escalating. Each requirement names a capability that the
 * chosen build must provide. Multiple builds can work; the TARGET is the
 * cheapest covering build (we assert this below so design stays honest).
 */
const ROUNDS: readonly RoundDef[] = [
  {
    id: "librarian",
    face: "👩‍🏫",
    name: "Mara the Librarian",
    problem: "When books go missing I can't tell which book, or who had it last.",
    reqs: [
      { cap: "identify", text: "Tell each book apart by its own ID" },
      { cap: "log", text: "Keep a record of who borrowed it" },
    ],
    budget: 4,
    target: 3, // tagreader(2) + logbook(1)
    thanks: "Now every book IDs itself and the borrow is logged. Thank you!",
  },
  {
    id: "gardener",
    face: "👨‍🌾",
    name: "Theo the Gardener",
    problem: "My plants dry out on weekends — I need it watered ONLY when the soil is actually dry.",
    reqs: [
      { cap: "sense", text: "Sense when the soil has gone dry" },
      { cap: "act", text: "Turn the water on by itself" },
    ],
    budget: 6,
    target: 4, // soil(2) + pump(2) beats megabox(7)
    thanks: "It senses dry soil and waters on its own — green all weekend. Thank you!",
  },
  {
    id: "guard",
    face: "💂",
    name: "Ravi the Night Guard",
    problem: "I must be warned if someone enters — but ONLY at night, so daytime visitors don't set it off.",
    reqs: [
      { cap: "sense", text: "Sense movement at the gate" },
      { cap: "alert", text: "Send a warning to the guard" },
      { cap: "schedule", text: "Stay active at night only" },
    ],
    budget: 6,
    target: 5, // motion(2)+siren(2)+timer(1)=5 beats megabox(7)
    thanks: "It senses night movement and alerts me — daytime is ignored. Thank you!",
  },
] as const;

/* ── Build-time sanity: verify every round's TARGET is the true minimum, and
 *    that the budget can hold it. Pure, deterministic — runs once on import,
 *    keeps the puzzle honest if anyone tweaks numbers later. ───────────────── */
function minCoveringCost(reqs: readonly Requirement[], budget: number): number {
  const need = new Set<Cap>(reqs.map((r) => r.cap));
  let best = Infinity;
  const n = MODULES.length;
  // Enumerate all module subsets (9 modules ⇒ 512 combos — trivial, deterministic).
  for (let mask = 0; mask < 1 << n; mask++) {
    let cost = 0;
    const have = new Set<Cap>();
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        cost += MODULES[i].cost;
        for (const c of MODULES[i].caps) have.add(c);
      }
    }
    if (cost > budget) continue;
    let covered = true;
    for (const c of need) if (!have.has(c)) covered = false;
    if (covered && cost < best) best = cost;
  }
  return best;
}
// Assert in dev; never throws in production builds.
if (process.env.NODE_ENV !== "production") {
  for (const r of ROUNDS) {
    const m = minCoveringCost(r.reqs, r.budget);
    if (m !== r.target) {
      // eslint-disable-next-line no-console
      console.warn(`[community-fix-it] round ${r.id}: target ${r.target} but true min is ${m}`);
    }
  }
}

type Phase = "build" | "testing" | "solved";

interface RoundState {
  selected: readonly string[]; // module ids chosen for THIS round's build
  phase: Phase;
  starsEarned: 0 | 1 | 2 | 3; // banked once solved
}

function freshRounds(): RoundState[] {
  return ROUNDS.map(() => ({ selected: [], phase: "build", starsEarned: 0 }));
}

/* Evaluate a build against a round — pure + deterministic. */
interface Evaluation {
  cost: number;
  overBudget: boolean;
  covered: Set<Cap>;
  missing: Cap[];
  allCovered: boolean;
}
function evaluate(round: RoundDef, selected: readonly string[]): Evaluation {
  let cost = 0;
  const covered = new Set<Cap>();
  for (const id of selected) {
    const mod = MOD_BY_ID[id];
    if (!mod) continue;
    cost += mod.cost;
    for (const c of mod.caps) covered.add(c);
  }
  const missing = round.reqs.map((r) => r.cap).filter((c) => !covered.has(c));
  return {
    cost,
    overBudget: cost > round.budget,
    covered,
    missing,
    allCovered: missing.length === 0,
  };
}

/* Decorative confetti for the final win (transform/opacity only). */
interface Confetti {
  emoji: string;
  dx: number;
  dy: number;
  spin: number;
  delay: number;
  dur: number;
}
const CONFETTI: readonly Confetti[] = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2;
  const reach = 70 + (i % 4) * 18;
  return {
    emoji: ["✨", "🎉", "⭐", "💫", "🟡", "🩵"][i % 6],
    dx: Math.round(Math.cos(angle) * reach),
    dy: Math.round(Math.sin(angle) * reach * 0.7) + 30,
    spin: (i % 2 === 0 ? 1 : -1) * (180 + (i % 5) * 90),
    delay: (i % 7) * 0.05,
    dur: 1.1 + (i % 4) * 0.18,
  };
});

export default function CommunityProblemSolver({ onComplete }: ActivityProps) {
  const [rounds, setRounds] = useState<RoundState[]>(freshRounds);
  const [active, setActive] = useState<number>(0);
  const [nudge, setNudge] = useState<string>("");
  const [testFlash, setTestFlash] = useState<"none" | "pass" | "fail">("none");

  const reportedRef = useRef<boolean>(false);
  const testTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (testTimer.current) clearTimeout(testTimer.current);
    },
    [],
  );

  const def = ROUNDS[active];
  const st = rounds[active];
  const evalNow = useMemo(() => evaluate(def, st.selected), [def, st.selected]);

  const solvedCount = useMemo(
    () => rounds.filter((r) => r.phase === "solved").length,
    [rounds],
  );
  const allSolved = solvedCount === ROUNDS.length;

  const totalStars = useMemo(
    () => rounds.reduce((sum, r) => sum + r.starsEarned, 0),
    [rounds],
  );

  /* Toggle a module in/out of the active round's build. */
  const toggleModule = useCallback(
    (modId: string) => {
      if (st.phase !== "build") return;
      setNudge("");
      setTestFlash("none");
      setRounds((prev) => {
        const next = prev.slice();
        const cur = next[active];
        const has = cur.selected.includes(modId);
        next[active] = {
          ...cur,
          selected: has
            ? cur.selected.filter((m) => m !== modId)
            : [...cur.selected, modId],
        };
        return next;
      });
    },
    [active, st.phase],
  );

  /* Run the deterministic Test on the active build. */
  const runTest = useCallback(() => {
    if (st.phase !== "build") return;
    const ev = evaluate(def, st.selected);

    // Empty build: gentle nudge, no penalty.
    if (st.selected.length === 0) {
      setNudge("Add at least one module, then Test it.");
      return;
    }

    if (testTimer.current) clearTimeout(testTimer.current);
    setRounds((prev) => {
      const next = prev.slice();
      next[active] = { ...next[active], phase: "testing" };
      return next;
    });
    setNudge("");

    const willPass = ev.allCovered && !ev.overBudget;
    setTestFlash(willPass ? "pass" : "fail");

    testTimer.current = setTimeout(() => {
      if (willPass) {
        // Star score for THIS round: under-or-at target ⇒ 3, else 2.
        const stars: 1 | 2 | 3 = ev.cost <= def.target ? 3 : 2;
        setRounds((prev) => {
          const next = prev.slice();
          next[active] = { ...next[active], phase: "solved", starsEarned: stars };
          const everyDone = next.every((r) => r.phase === "solved");
          if (everyDone && !reportedRef.current) {
            reportedRef.current = true;
            const total = next.reduce((s, r) => s + r.starsEarned, 0); // 3..9
            // Map 3 rounds × (2|3) stars → overall 1|2|3.
            const overall: 1 | 2 | 3 = total >= 9 ? 3 : total >= 7 ? 2 : 1;
            onComplete({
              passed: true,
              stars: overall,
              detail:
                overall === 3
                  ? "Young Innovator! Every build covers the need AND uses the fewest credits. 🏅"
                  : "Young Innovator! Every neighbour's problem is solved — try fewer credits next time for a perfect score.",
            });
          }
          return next;
        });
        setTestFlash("none");
      } else {
        // Recoverable: explain WHY, keep the build so they can fix it.
        setRounds((prev) => {
          const next = prev.slice();
          next[active] = { ...next[active], phase: "build" };
          return next;
        });
        if (ev.overBudget) {
          setNudge(
            `Over budget — ${ev.cost} credits used, only ${def.budget} allowed. Find a cheaper combo.`,
          );
        } else {
          const miss = ev.missing.map((c) => CAP_LABEL[c]).join(" + ");
          setNudge(`Test failed — still missing: ${miss}. Add a module that covers it.`);
        }
        setTestFlash("none");
      }
      testTimer.current = null;
    }, 950);
  }, [active, def, st.phase, st.selected, onComplete]);

  const clearBuild = useCallback(() => {
    if (st.phase !== "build") return;
    setNudge("");
    setTestFlash("none");
    setRounds((prev) => {
      const next = prev.slice();
      next[active] = { ...next[active], selected: [] };
      return next;
    });
  }, [active, st.phase]);

  const resetAll = useCallback(() => {
    if (testTimer.current) clearTimeout(testTimer.current);
    reportedRef.current = false;
    setRounds(freshRounds());
    setActive(0);
    setNudge("");
    setTestFlash("none");
  }, []);

  const testing = st.phase === "testing";
  const solved = st.phase === "solved";

  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col gap-3 text-ink">
      <style>{`
        @keyframes g5cfx-pop {
          0% { transform: scale(.5); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g5cfx-bob {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes g5cfx-ring {
          0% { transform: scale(.6); opacity: .9; }
          100% { transform: scale(2); opacity: 0; }
        }
        @keyframes g5cfx-glow {
          0%,100% { opacity: .4; }
          50% { opacity: 1; }
        }
        @keyframes g5cfx-shake {
          0%,100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        @keyframes g5cfx-star-pop {
          0% { transform: scale(0) rotate(-30deg); opacity: 0; }
          60% { transform: scale(1.4) rotate(8deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes g5cfx-confetti {
          0% { transform: translate(0,0) rotate(0deg) scale(.4); opacity: 0; }
          12% { opacity: 1; }
          100% { transform: translate(var(--cfx-dx), var(--cfx-dy)) rotate(var(--cfx-spin)) scale(1); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-cfx-anim] { animation: none !important; }
        }
      `}</style>

      {/* ---------------- HEADLINE ---------------- */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-tech text-ink-faint">
          Innovation Lab · design → build → test
        </p>
        <span className="font-mono text-[11px]" style={{ color: allSolved ? GOOD : ACCENT }}>
          {solvedCount}/{ROUNDS.length} solved
        </span>
      </div>

      {/* ---------------- NEIGHBOUR TABS ---------------- */}
      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Community members">
        {ROUNDS.map((r, i) => {
          const rs = rounds[i];
          const isActive = i === active;
          const isSolved = rs.phase === "solved";
          const border = isSolved ? GOOD : isActive ? ACCENT : "#1b2433";
          return (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`${r.name}. ${
                isSolved ? `Solved with ${rs.starsEarned} stars.` : "Open to design a solution."
              }`}
              onPointerDown={(e) => {
                e.preventDefault();
                if (!testing) {
                  setActive(i);
                  setNudge("");
                  setTestFlash("none");
                }
              }}
              className="relative flex flex-col items-center gap-1 rounded-xl border bg-panel/60 p-2 text-center transition"
              style={{
                borderColor: border,
                touchAction: "manipulation",
                boxShadow: isSolved
                  ? `0 0 0 1px ${GOOD}, 0 0 16px -6px ${GOOD}`
                  : isActive
                    ? `0 0 0 1px ${ACCENT}55`
                    : undefined,
              }}
            >
              <span className="text-2xl" aria-hidden>
                {r.face}
              </span>
              <span className="font-mono text-[9px] leading-tight text-ink-dim">
                {r.name.split(" ")[0]}
              </span>
              <span
                className="flex h-4 items-center rounded-full px-1.5 font-mono text-[8px]"
                style={{
                  background: isSolved ? GOOD : "transparent",
                  border: `1px solid ${isSolved ? GOOD : "#1b2433"}`,
                  color: isSolved ? "#05070d" : "#475569",
                }}
                aria-hidden
              >
                {isSolved ? `${"★".repeat(rs.starsEarned)} solved` : `${r.reqs.length} needs`}
              </span>
            </button>
          );
        })}
      </div>

      {/* ---------------- ACTIVE PROBLEM CARD ---------------- */}
      <div
        className="rounded-xl border p-3"
        style={{
          borderColor: solved ? GOOD : "#1b2433",
          background: "rgba(56,189,248,.04)",
        }}
      >
        {/* speech bubble */}
        <div className="mb-2 flex items-start gap-2">
          <span aria-hidden className="text-2xl" data-cfx-anim style={{ animation: testing ? "g5cfx-bob .5s ease infinite" : undefined }}>
            {def.face}
          </span>
          <span
            className="flex-1 rounded-md px-2 py-1.5 font-mono text-[11px] leading-snug"
            style={{
              background: solved ? "rgba(52,211,153,.12)" : "rgba(56,189,248,.07)",
              color: solved ? GOOD : "var(--color-ink-dim, #9aa6b2)",
            }}
          >
            “{solved ? def.thanks : def.problem}”
          </span>
        </div>

        {/* requirement checklist — live coverage feedback */}
        <p className="font-mono text-[10px] uppercase tracking-tech text-ink-faint">
          Must-haves · your build has to cover all
        </p>
        <ul className="mt-1 flex flex-col gap-1" aria-label="Requirements for this build">
          {def.reqs.map((req) => {
            const met = evalNow.covered.has(req.cap);
            return (
              <li
                key={req.cap}
                className="flex items-center gap-2 rounded-lg px-2 py-1 font-mono text-[11px]"
                style={{
                  background: met ? "rgba(52,211,153,.1)" : "rgba(255,255,255,.03)",
                  color: met ? GOOD : "var(--color-ink-dim, #9aa6b2)",
                }}
              >
                <span
                  aria-hidden
                  className="grid h-4 w-4 place-items-center rounded-full text-[9px]"
                  style={{
                    background: met ? GOOD : "transparent",
                    border: `1px solid ${met ? GOOD : "#334155"}`,
                    color: "#05070d",
                  }}
                >
                  {met ? "✓" : ""}
                </span>
                <span className="flex-1">{req.text}</span>
                <span aria-label={met ? "covered" : "not covered yet"} className="text-[9px] opacity-70">
                  {met ? "covered" : CAP_LABEL[req.cap]}
                </span>
              </li>
            );
          })}
        </ul>

        {/* budget meter */}
        <div className="mt-2 flex items-center justify-between font-mono text-[11px]">
          <span className="text-ink-faint">Budget</span>
          <span
            style={{
              color: evalNow.overBudget ? BAD : evalNow.cost <= def.target ? GOOD : WARN,
            }}
          >
            {evalNow.cost} / {def.budget} credits
            {!solved && evalNow.cost > 0 && (
              <span className="ml-1 opacity-70">
                {evalNow.cost <= def.target ? "· efficient ✦" : "· can be cheaper"}
              </span>
            )}
          </span>
        </div>
        <div
          className="mt-1 h-2 w-full overflow-hidden rounded-full"
          style={{ background: "rgba(255,255,255,.06)" }}
          aria-hidden
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, (evalNow.cost / def.budget) * 100)}%`,
              background: evalNow.overBudget ? BAD : evalNow.cost <= def.target ? GOOD : WARN,
            }}
          />
          {/* target tick */}
        </div>
        <p className="mt-1 text-right font-mono text-[9px] text-ink-faint">
          Cover all needs using <span style={{ color: ACCENT }}>{def.target} credits or fewer</span> for full stars
        </p>
      </div>

      {/* ---------------- MODULE TRAY ---------------- */}
      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-[11px] uppercase tracking-tech text-ink-faint">
          Toolbox · tap modules to add them to your build
        </p>
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Module toolbox">
          {MODULES.map((m) => {
            const inBuild = st.selected.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                disabled={st.phase !== "build"}
                onPointerDown={(e) => {
                  e.preventDefault();
                  toggleModule(m.id);
                }}
                aria-pressed={inBuild}
                aria-label={`${m.name}, costs ${m.cost} credits, provides ${m.caps
                  .map((c) => CAP_LABEL[c])
                  .join(" and ")}.${inBuild ? " In your build." : ""}`}
                className="flex flex-col items-start gap-0.5 rounded-lg border bg-panel/60 px-2 py-1.5 text-left transition disabled:opacity-50"
                style={{
                  borderColor: inBuild ? ACCENT : "#1b2433",
                  background: inBuild ? "rgba(34,211,238,.08)" : undefined,
                  touchAction: "manipulation",
                  boxShadow: inBuild ? `0 0 0 1px ${ACCENT}, 0 0 10px -4px ${ACCENT}` : undefined,
                }}
              >
                <span className="flex w-full items-center justify-between">
                  <span className="text-base" aria-hidden>
                    {m.emoji}
                  </span>
                  <span
                    className="font-mono text-[8px]"
                    style={{ color: inBuild ? ACCENT : "#64748b" }}
                  >
                    {m.cost}c
                  </span>
                </span>
                <span className="font-mono text-[8px] leading-tight text-ink-dim">{m.name}</span>
                <span className="font-mono text-[7px] leading-tight" style={{ color: "#5b6b7d" }}>
                  {m.caps.map((c) => CAP_LABEL[c]).join(", ")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------------- BUILD + TEST CONTROLS ---------------- */}
      <div
        className="rounded-xl border px-3 py-2"
        style={{
          borderColor:
            testFlash === "pass" ? GOOD : testFlash === "fail" ? BAD : "#1b2433",
          background: "rgba(56,189,248,.04)",
        }}
        data-cfx-anim
      >
        <div className="mb-2 flex min-h-[26px] flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-tech text-ink-faint">
            Your build:
          </span>
          {st.selected.length === 0 ? (
            <span className="font-mono text-[10px] text-ink-faint opacity-70">
              empty — pick modules above
            </span>
          ) : (
            st.selected.map((id) => (
              <span
                key={id}
                className="flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px]"
                style={{ background: "#0b1220", border: `1px solid ${ACCENT}66`, color: ACCENT }}
              >
                <span aria-hidden>{MOD_BY_ID[id].emoji}</span>
                {MOD_BY_ID[id].name}
              </span>
            ))
          )}
        </div>

        <div className="flex items-stretch gap-2">
          <button
            type="button"
            disabled={st.phase !== "build" || st.selected.length === 0}
            onPointerDown={(e) => {
              e.preventDefault();
              clearBuild();
            }}
            aria-label="Clear the current build"
            className="rounded-lg border border-line bg-panel/60 px-3 py-2 font-mono text-[11px] text-ink-dim transition disabled:opacity-30"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={st.phase !== "build"}
            onPointerDown={(e) => {
              e.preventDefault();
              runTest();
            }}
            aria-label={`Test the build for ${def.name}`}
            className="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-40"
            style={{ background: solved ? GOOD : ACCENT, color: "#05070d" }}
          >
            {testing ? "Testing…" : solved ? "Solved ✓" : "Test ▶"}
          </button>
        </div>
      </div>

      {/* ---------------- NUDGE ---------------- */}
      {nudge && !allSolved && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-lg px-3 py-2 text-center font-mono text-[11px]"
          style={{ background: "rgba(245,158,11,.1)", color: WARN, border: `1px solid ${WARN}55` }}
          data-cfx-anim
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
            ? `Young Innovator certificate complete, ${totalStars} of 9 design points`
            : `Young Innovator certificate, ${solvedCount} of ${ROUNDS.length} stamps filled`
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
          {ROUNDS.map((r, i) => {
            const rs = rounds[i];
            const isSolved = rs.phase === "solved";
            const cxp = 80 + i * 80;
            return (
              <g key={r.id} transform={`translate(${cxp} 56)`}>
                <circle
                  cx={0}
                  cy={0}
                  r={15}
                  fill={isSolved ? "rgba(52,211,153,.18)" : "#0b1220"}
                  stroke={isSolved ? GOOD : "#334155"}
                  strokeWidth={1.5}
                  data-cfx-anim
                  style={{ animation: isSolved ? "g5cfx-pop .4s ease both" : undefined }}
                />
                <text x={0} y={5} textAnchor="middle" fontSize={15}>
                  {isSolved ? "✓" : r.face}
                </text>
                {isSolved && (
                  <text x={0} y={-20} textAnchor="middle" fontSize={9} fill={GOOD}>
                    {"★".repeat(rs.starsEarned)}
                  </text>
                )}
                {isSolved && (
                  <circle
                    cx={0}
                    cy={0}
                    r={15}
                    fill="none"
                    stroke={GOOD}
                    strokeWidth={1.5}
                    data-cfx-anim
                    style={{ animation: "g5cfx-ring .7s ease-out" }}
                  />
                )}
              </g>
            );
          })}
        </svg>
        {allSolved && (
          <p className="mt-1 font-mono text-xs font-bold" style={{ color: GOOD }}>
            {totalStars >= 9
              ? "⭐⭐⭐ Perfect — every build covers the need with the fewest credits!"
              : "✨ All solved! Re-design any round with fewer credits for a perfect score."}
          </p>
        )}

        {/* confetti on full completion */}
        {allSolved && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0" aria-hidden>
            {CONFETTI.map((p, i) => (
              <span
                key={`cf-${i}`}
                className="absolute text-base"
                data-cfx-anim
                style={
                  {
                    left: 0,
                    top: 0,
                    "--cfx-dx": `${p.dx}px`,
                    "--cfx-dy": `${p.dy}px`,
                    "--cfx-spin": `${p.spin}deg`,
                    animation: `g5cfx-confetti ${p.dur}s cubic-bezier(.2,.6,.3,1) ${p.delay}s infinite`,
                    willChange: "transform, opacity",
                  } as CSSProperties
                }
              >
                {p.emoji}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ---------------- CONTROLS ---------------- */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={resetAll}
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
          aria-label="Reset the innovation lab"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
