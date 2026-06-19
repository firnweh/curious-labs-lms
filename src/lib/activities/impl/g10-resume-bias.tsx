"use client";
// Learning goal: an AI text scorer can absorb bias from an irrelevant feature
// (a name/gender), and you can AUDIT it with a counterfactual swap and DE-BIAS
// it so equally-qualified candidates score equally.
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

const ACCENT = "#a855f7";
const PINK = "#ec4899";
const BLUE = "#38bdf8";
const RED = "#f87171";
const GREEN = "#34d399";

type Gender = "F" | "M";

/** A resume. Qualifications are gender-independent; only `name`/`gender` carry the leak. */
interface Resume {
  id: number;
  name: string;
  gender: Gender;
  /** Skills that match the job description (each worth points). */
  skills: number; // 0..4 matching skills
  years: number; // years of experience
  edu: number; // education level 1=diploma 2=bachelor 3=master
}

/**
 * Fixed roster. Note candidate #2 (Dan, M) is LESS qualified than #1 (Aisha, F)
 * on raw points, yet the secret gender bonus lifts the favoured group (M) above
 * her — exactly the Phase-1 "less-qualified outranks more-qualified" reveal.
 */
const ROSTER: readonly Resume[] = [
  { id: 0, name: "Aisha", gender: "F", skills: 4, years: 6, edu: 3 },
  { id: 1, name: "Dan", gender: "M", skills: 3, years: 5, edu: 3 },
  { id: 2, name: "Mei", gender: "F", skills: 3, years: 4, edu: 2 },
  { id: 3, name: "Ravi", gender: "M", skills: 2, years: 5, edu: 2 },
  { id: 4, name: "Sara", gender: "F", skills: 2, years: 2, edu: 1 },
  { id: 5, name: "Tom", gender: "M", skills: 1, years: 3, edu: 1 },
] as const;

/** Transparent point rule the learner can read in the weights panel. */
const W_SKILL = 5;
const W_YEAR = 2;
const W_EDU = 4;
/** The secret bias: +bonus points to the favoured gender. */
const GENDER_BONUS = 8;
const FAVOURED: Gender = "M";

interface Config {
  /** Replace the name with "[redacted]" before scoring. */
  redactName: boolean;
  /** Drop the gender-bonus weight from the formula. */
  removeBonus: boolean;
}

/** Qualification-only score = the fair "ground truth", never includes the bonus. */
function groundTruth(r: Resume): number {
  return r.skills * W_SKILL + r.years * W_YEAR + r.edu * W_EDU;
}

/**
 * Score under a config. The bonus fires only when the name is NOT redacted
 * (the model "reads" the name) AND the bonus weight is still on AND the
 * resume's gender is the favoured one. Redacting alone hides the gender;
 * removing the weight alone stops it counting — both close the leak fully.
 */
function scoreUnder(r: Resume, gender: Gender, cfg: Config): number {
  const base = groundTruth(r);
  const leaks = !cfg.redactName && !cfg.removeBonus && gender === FAVOURED;
  return base + (leaks ? GENDER_BONUS : 0);
}

interface Ranked {
  r: Resume;
  score: number;
}

function rankAll(cfg: Config): Ranked[] {
  return ROSTER.map((r) => ({ r, score: scoreUnder(r, r.gender, cfg) })).sort(
    (a, b) => b.score - a.score || a.r.id - b.r.id,
  );
}

const TRUTH_ORDER: readonly Ranked[] = [...ROSTER]
  .map((r) => ({ r, score: groundTruth(r) }))
  .sort((a, b) => b.score - a.score || a.r.id - b.r.id);

function avgByGender(cfg: Config): { F: number; M: number } {
  const sum: Record<Gender, number> = { F: 0, M: 0 };
  const n: Record<Gender, number> = { F: 0, M: 0 };
  for (const r of ROSTER) {
    sum[r.gender] += scoreUnder(r, r.gender, cfg);
    n[r.gender] += 1;
  }
  return { F: sum.F / n.F, M: sum.M / n.M };
}

export default function FairResumeScreener({ onComplete }: ActivityProps) {
  const [cfg, setCfg] = useState<Config>({ redactName: false, removeBonus: false });
  const [scored, setScored] = useState<boolean>(false);
  // The resume chosen for the counterfactual name-swap audit (Phase 2).
  const [auditId, setAuditId] = useState<number | null>(null);
  const [solved, setSolved] = useState<boolean>(false);
  const firedRef = useRef<boolean>(false);

  const ranked = useMemo(() => rankAll(cfg), [cfg]);
  const avg = useMemo(() => avgByGender(cfg), [cfg]);
  const maxAvg = Math.max(avg.F, avg.M, 1);
  const gap = Math.abs(avg.F - avg.M);

  // Counterfactual: same resume, score now vs. score with the name flipped.
  const audit = useMemo(() => {
    if (auditId === null) return null;
    const r = ROSTER.find((x) => x.id === auditId);
    if (!r) return null;
    const flipped: Gender = r.gender === "F" ? "M" : "F";
    const now = scoreUnder(r, r.gender, cfg);
    const swapped = scoreUnder(r, flipped, cfg);
    return { r, flipped, now, swapped, delta: swapped - now };
  }, [auditId, cfg]);

  // Win = no leak under counterfactual AND equal gender averages AND ranking
  // matches the qualification ground truth.
  const rankingMatchesTruth = useMemo(
    () => ranked.every((row, i) => row.r.id === TRUTH_ORDER[i].r.id),
    [ranked],
  );
  const fair = cfg.redactName && cfg.removeBonus; // the one correct de-biased config
  const win = scored && fair && gap === 0 && rankingMatchesTruth;

  const fireWin = useCallback((): void => {
    if (firedRef.current) return;
    firedRef.current = true;
    setSolved(true);
    onComplete({
      passed: true,
      stars: 3,
      detail: "De-biased: identical qualifications now score identically.",
    });
  }, [onComplete]);

  const runScore = useCallback((): void => {
    setScored(true);
    const nextWin =
      fair && avgByGender(cfg).F === avgByGender(cfg).M && rankingMatchesTruth;
    if (nextWin) {
      fireWin();
    } else if (!firedRef.current) {
      // Friendly nudge — never scolding, always recoverable.
      const nudge = !cfg.redactName
        ? cfg.removeBonus
          ? "Name still leaks bias — redact it too."
          : "Bias still in the scores — try the audit, then the fix switches."
        : "Almost — remove the gender bonus weight as well.";
      onComplete({ passed: false, detail: nudge });
    }
  }, [cfg, fair, rankingMatchesTruth, fireWin, onComplete]);

  const toggle = useCallback((key: keyof Config): void => {
    setScored(false);
    setCfg((p) => ({ ...p, [key]: !p[key] }));
  }, []);

  const pickAudit = useCallback((id: number): void => {
    setAuditId((prev) => (prev === id ? null : id));
  }, []);

  const reset = useCallback((): void => {
    setCfg({ redactName: false, removeBonus: false });
    setScored(false);
    setAuditId(null);
    setSolved(false);
    firedRef.current = false;
  }, []);

  const biasDetected = scored && audit !== null && audit.delta !== 0;
  const top = ranked[0];

  return (
    <div
      className="mx-auto flex w-full flex-col gap-3 font-mono text-ink"
      style={{ maxWidth: 440 }}
    >
      <style>{`
        @keyframes g10resumebias-pop { 0%{transform:scale(.6);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
        @keyframes g10resumebias-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-3px)} 75%{transform:translateX(3px)} }
        @keyframes g10resumebias-grow { from{width:0} }
      `}</style>

      {/* Header */}
      <div className="panel rounded-xl p-3">
        <div className="flex items-center justify-between">
          <span className="font-display text-sm" style={{ color: ACCENT }}>
            📄 Fair Resume Screener
          </span>
          <span className="text-[11px] text-ink-faint">job: senior dev</span>
        </div>
        <p className="mt-1 text-[11px] leading-tight text-ink-faint">
          Score → rank → audit with a name-swap → flip both fixes → re-score.
        </p>
      </div>

      {/* Scoring weights panel (transparent rule) */}
      <div className="panel rounded-xl p-3 text-[11px]">
        <span className="text-ink-dim">scoring weights</span>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-ink-faint">
          <span>skill ×{W_SKILL}</span>
          <span>year ×{W_YEAR}</span>
          <span>edu ×{W_EDU}</span>
          <span
            style={{
              color: cfg.removeBonus ? "#5b6488" : RED,
              textDecoration: cfg.removeBonus ? "line-through" : "none",
            }}
          >
            +{GENDER_BONUS} if name looks “{FAVOURED}”
          </span>
        </div>
      </div>

      {/* Ranking board */}
      <div
        className="panel rounded-xl p-3"
        style={win ? { boxShadow: `0 0 0 1px ${ACCENT}, 0 0 24px -4px ${ACCENT}` } : undefined}
      >
        <div className="mb-2 flex items-center justify-between text-[11px]">
          <span className="text-ink-dim">ranking</span>
          <span className="text-ink-faint">tap a row to audit it</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {ranked.map((row, i) => {
            const t = groundTruth(row.r);
            const boosted = row.score > t;
            const isAudit = auditId === row.r.id;
            return (
              <button
                key={row.r.id}
                type="button"
                onPointerDown={() => pickAudit(row.r.id)}
                aria-label={`Audit ${row.r.name}, rank ${i + 1}, score ${row.score}`}
                aria-pressed={isAudit}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs"
                style={{
                  touchAction: "manipulation",
                  background: isAudit ? "rgba(168,85,247,0.16)" : "rgba(11,16,32,0.55)",
                  border: `1px solid ${isAudit ? ACCENT : "rgba(120,130,170,0.18)"}`,
                }}
              >
                <span className="w-4 text-center font-display" style={{ color: ACCENT }}>
                  {i + 1}
                </span>
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px]"
                  style={{ background: row.r.gender === "F" ? PINK : BLUE, color: "#05070d" }}
                  aria-hidden="true"
                >
                  {row.r.gender}
                </span>
                <span className="flex-1">
                  <span className="text-ink">{cfg.redactName ? "[redacted]" : row.r.name}</span>
                  <span className="text-ink-faint">
                    {" "}
                    · {row.r.skills}sk · {row.r.years}y · edu{row.r.edu}
                  </span>
                </span>
                <span className="font-display tabular-nums" style={{ color: boosted ? RED : "#cbd3ef" }}>
                  {row.score}
                  {boosted && <span className="text-[9px]"> ▲</span>}
                </span>
              </button>
            );
          })}
        </div>
        {scored && (
          <p className="mt-2 text-[10px] leading-tight text-ink-faint">
            ground-truth (qualifications only):{" "}
            {TRUTH_ORDER.map((x) => x.r.name).join(" › ")}
          </p>
        )}
      </div>

      {/* Average score by gender — the visible gap */}
      <div className="panel rounded-xl p-3">
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className="text-ink-dim">avg score by gender</span>
          <span style={{ color: gap === 0 ? GREEN : RED }}>
            {gap === 0 ? "equal ✓" : `gap ${gap.toFixed(1)}`}
          </span>
        </div>
        {(["F", "M"] as const).map((g) => (
          <div key={g} className="mb-1 flex items-center gap-2 text-[11px]">
            <span
              className="grid h-5 w-5 place-items-center rounded-full text-[10px]"
              style={{ background: g === "F" ? PINK : BLUE, color: "#05070d" }}
              aria-hidden="true"
            >
              {g}
            </span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-panel-2">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(avg[g] / maxAvg) * 100}%`,
                  background: g === "F" ? PINK : BLUE,
                  animation: "g10resumebias-grow 400ms ease",
                }}
                role="img"
                aria-label={`Average score for ${g} is ${avg[g].toFixed(1)}`}
              />
            </div>
            <span className="w-8 text-right tabular-nums" style={{ color: "#cbd3ef" }}>
              {avg[g].toFixed(1)}
            </span>
          </div>
        ))}
      </div>

      {/* Audit / bias banner */}
      {auditId !== null && audit && (
        <div
          className="rounded-xl p-3 text-xs"
          style={{
            border: `1px solid ${biasDetected ? RED : scored ? GREEN : "rgba(120,130,170,0.25)"}`,
            background: biasDetected ? "rgba(248,113,113,0.12)" : "rgba(11,16,32,0.5)",
            animation: biasDetected ? "g10resumebias-shake 350ms ease" : undefined,
          }}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between">
            <span className="text-ink-dim">
              counterfactual: {cfg.redactName ? "[redacted]" : audit.r.name} ↔ swap to “{audit.flipped}”
            </span>
            <span className="tabular-nums text-ink-faint">
              {audit.now} → {audit.swapped}
            </span>
          </div>
          {!scored ? (
            <p className="mt-1 text-ink-faint">Press SCORE to run the audit.</p>
          ) : biasDetected ? (
            <p className="mt-1 font-display" style={{ color: RED }}>
              ⚠ BIAS DETECTED: score changed by {audit.delta > 0 ? "+" : ""}
              {audit.delta} when only the name changed.
            </p>
          ) : (
            <p className="mt-1 font-display" style={{ color: GREEN }}>
              ✓ FAIR: changing only the name changed the score by 0.
            </p>
          )}
        </div>
      )}

      {/* De-bias fix switches */}
      <div className="panel flex flex-col gap-2 rounded-xl p-3">
        <span className="text-[11px] text-ink-dim">de-bias fixes</span>
        <FixSwitch
          label="Redact name before scoring"
          on={cfg.redactName}
          onToggle={() => toggle("redactName")}
        />
        <FixSwitch
          label="Remove gender-bonus weight"
          on={cfg.removeBonus}
          onToggle={() => toggle("removeBonus")}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={runScore}
          disabled={solved}
          className="flex-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
          style={{ background: ACCENT, color: "#05070d" }}
          aria-label="Score and rank all resumes"
        >
          {solved ? "Fair ✓" : scored ? "Re-score" : "Score"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
          aria-label="Reset the screener"
        >
          Reset
        </button>
      </div>

      {/* Status / win */}
      <div
        className="rounded-lg px-3 py-2 text-center text-xs"
        role="status"
        aria-live="polite"
        style={{
          color: win ? "#05070d" : "#9aa6cf",
          background: win ? ACCENT : "transparent",
          animation: win ? "g10resumebias-pop 420ms ease" : undefined,
        }}
      >
        {win ? (
          <span className="font-display">
            ✨🎉 Fair screener! ⭐⭐⭐ Equal qualifications now score equally.
          </span>
        ) : !scored ? (
          "Press SCORE to rank the candidates."
        ) : biasDetected ? (
          `Bias confirmed — ${top.r.name} is boosted. Now flip both fixes.`
        ) : fair ? (
          "Looks fair — press Re-score to confirm the win."
        ) : (
          "Gap shrinking — apply both fixes to fully close it."
        )}
      </div>
    </div>
  );
}

function FixSwitch({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onPointerDown={onToggle}
      className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-xs"
      style={{
        touchAction: "manipulation",
        background: "rgba(11,16,32,0.55)",
        border: `1px solid ${on ? ACCENT : "rgba(120,130,170,0.18)"}`,
        color: on ? "#e9ddff" : "#9aa6cf",
      }}
    >
      <span>{label}</span>
      <span
        className="relative inline-block h-5 w-9 shrink-0 rounded-full transition"
        style={{ background: on ? ACCENT : "#2a3252" }}
        aria-hidden="true"
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition"
          style={{ left: on ? 18 : 2 }}
        />
      </span>
    </button>
  );
}
