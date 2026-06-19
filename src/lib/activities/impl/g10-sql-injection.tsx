"use client";
// Learning goal: understand SQL injection — gluing user input straight into a
// query lets an attacker rewrite its logic to always-true; binding input as a
// PARAMETER (data, not code) closes the hole.
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

const ACCENT = "#22d3ee";
const BREACH = "#f87171";
const SAFE = "#4ade80";

/** One row of the tiny in-memory "database". No real DB, no network. */
interface Row {
  id: number;
  name: string;
  role: string;
}

/** The sandboxed users table the fake engine queries over. */
const USERS: readonly Row[] = [
  { id: 1, name: "admin", role: "owner" },
  { id: 2, name: "maya", role: "staff" },
  { id: 3, name: "leo", role: "staff" },
] as const;

/** The classic always-true injection payload this lab teaches. */
const PAYLOAD = "' OR '1'='1";

/** Snippets the learner can tap to build the attack. */
const SNIPPETS: readonly string[] = ["' OR '1'='1", " -- ", ";"];

type Mode = "vulnerable" | "parameterised";

/**
 * Deterministic fake query engine.
 *
 * VULNERABLE: input is concatenated into the SQL text, so the engine parses
 * the closing quote + OR and the WHERE clause becomes always-true → ALL rows.
 * PARAMETERISED: the whole username string is BOUND as one literal value, so
 * the engine compares it as data → it never equals a real name → no rows.
 *
 * We detect the injection by its shape (a quote that breaks out of the string)
 * rather than running a parser, which keeps it 100% deterministic & winnable.
 */
function runQuery(mode: Mode, username: string, password: string): Row[] {
  const isInjection = username.includes("' OR '1'='1") || username.includes("' or '1'='1");
  if (mode === "vulnerable") {
    if (isInjection) {
      // The OR '1'='1' short-circuits the check — every row matches.
      return [...USERS];
    }
    // Otherwise behave like a normal login (no real account passes here).
    return USERS.filter((u) => u.name === username && password === "hunter2" && u.name === "admin");
  }
  // Parameterised: the entire string is one bound literal value — compared as data.
  return USERS.filter((u) => u.name === username);
}

/** Builds the SQL text the engine *would* run, for the live display. */
function buildSql(mode: Mode, username: string, password: string): string {
  if (mode === "parameterised") {
    return "SELECT * FROM users WHERE name = ? AND pass = ?\n-- bound: [" + JSON.stringify(username) + ", \"" + password + "\"]";
  }
  return "SELECT * FROM users WHERE name='" + username + "' AND pass='" + password + "'";
}

export default function SqlInjectionLab({ onComplete }: ActivityProps) {
  const [phase, setPhase] = useState<1 | 2>(1);
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [mode, setMode] = useState<Mode>("vulnerable");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [ran, setRan] = useState<boolean>(false);
  const [status, setStatus] = useState<string>(
    "Phase 1 — break in. Build a username that makes the check always true.",
  );
  const [breached, setBreached] = useState<boolean>(false); // phase-1 win
  const [defended, setDefended] = useState<boolean>(false); // phase-2 win
  const completed = useRef<boolean>(false);

  const sql = useMemo(() => buildSql(mode, username, password), [mode, username, password]);
  const payloadReady = useMemo(() => username.includes(PAYLOAD), [username]);

  const insert = useCallback((snippet: string): void => {
    setUsername((u) => u + snippet);
    setRan(false);
    setRows(null);
  }, []);

  const login = useCallback((): void => {
    const result = runQuery(mode, username, password);
    setRows(result);
    setRan(true);
    const breachedNow = mode === "vulnerable" && result.length === USERS.length && payloadReady;

    if (phase === 1) {
      if (breachedNow) {
        setBreached(true);
        setStatus("BREACHED. The OR made the WHERE always true — every row leaked.");
      } else if (result.length > 0) {
        setStatus("Logged in normally. Now try the injection — bend the logic, not the password.");
      } else {
        setStatus(
          payloadReady
            ? "Hmm — make sure the snippet sits in the USERNAME box."
            : "Access denied. Tap a snippet to break out of the quotes.",
        );
      }
      return;
    }

    // Phase 2 — replay the SAME payload against whichever version is selected.
    if (mode === "parameterised") {
      if (payloadReady && result.length === 0 && !completed.current) {
        completed.current = true;
        setDefended(true);
        setStatus("Attack blocked — input was treated as data, not code. Hole closed!");
        onComplete({
          passed: true,
          stars: 3,
          detail: "Breached the concatenated query, then patched it with a parameterised one.",
        });
      } else if (result.length === 0) {
        setStatus("No rows — but re-run the actual ' OR '1'='1 payload to prove it's blocked.");
        onComplete({ passed: false, detail: "Re-run the injection payload against the safe version." });
      }
    } else {
      // Still on the vulnerable card — the breach repeats.
      setStatus("Still breached — this version glues input into the query. Pick the parameterised one.");
      onComplete({ passed: false, detail: "That card still concatenates input. Choose 'name = ?'." });
    }
  }, [mode, username, password, payloadReady, phase, onComplete]);

  const goDefend = useCallback((): void => {
    setPhase(2);
    setMode("vulnerable");
    setRan(false);
    setRows(null);
    setStatus("Phase 2 — defend. Pick a query-builder, then re-run the same payload.");
  }, []);

  const reset = useCallback((): void => {
    setPhase(1);
    setUsername("");
    setPassword("");
    setMode("vulnerable");
    setRows(null);
    setRan(false);
    setBreached(false);
    setDefended(false);
    completed.current = false;
    setStatus("Phase 1 — break in. Build a username that makes the check always true.");
  }, []);

  const showBreach = ran && rows !== null && mode === "vulnerable" && rows.length === USERS.length && payloadReady;

  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink">
      <style>{`
        @keyframes g10sqlinjection-flash { 0%,100%{opacity:1} 50%{opacity:.55} }
        @keyframes g10sqlinjection-pop { 0%{transform:scale(.8);opacity:0} 100%{transform:scale(1);opacity:1} }
        @keyframes g10sqlinjection-caret { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>

      {/* Phase tracker */}
      <div className="flex items-center gap-2 text-[11px]">
        <span
          className="rounded-full px-2 py-0.5"
          style={{
            background: phase === 1 ? ACCENT : "rgba(34,211,238,0.15)",
            color: phase === 1 ? "#05070d" : "#9aa6cf",
          }}
        >
          1 · Attack {breached ? "✓" : ""}
        </span>
        <span className="text-ink-faint">→</span>
        <span
          className="rounded-full px-2 py-0.5"
          style={{
            background: phase === 2 ? ACCENT : "rgba(34,211,238,0.15)",
            color: phase === 2 ? "#05070d" : "#9aa6cf",
          }}
        >
          2 · Defend {defended ? "✓" : ""}
        </span>
      </div>

      {/* Login form */}
      <div className="panel flex flex-col gap-2 rounded-xl border border-line p-3">
        <span className="text-xs text-ink-dim">🔐 Login</span>
        <input
          type="text"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setRan(false);
            setRows(null);
          }}
          placeholder="username"
          aria-label="Username input — try a SQL injection payload here"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-sm text-ink outline-none"
          style={{ caretColor: ACCENT }}
        />
        <input
          type="text"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setRan(false);
            setRows(null);
          }}
          placeholder="password"
          aria-label="Password input"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-sm text-ink outline-none"
          style={{ caretColor: ACCENT }}
        />

        {/* Injection palette */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5" role="group" aria-label="Injection snippets to insert">
          <span className="text-[10px] text-ink-faint">tap to insert:</span>
          {SNIPPETS.map((s) => (
            <button
              key={s}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                insert(s);
              }}
              style={{ touchAction: "manipulation", borderColor: "var(--color-line, #27314f)" }}
              className="rounded-md border bg-panel/60 px-2 py-1 text-[11px] text-ink-dim"
              aria-label={`Insert snippet ${s.trim()}`}
            >
              {s.trim() === "" ? "·" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Live query the engine will run */}
      <div className="panel rounded-xl border border-line p-3">
        <span className="text-[10px] uppercase tracking-wide text-ink-faint">live query</span>
        <pre
          className="mt-1 overflow-x-auto whitespace-pre-wrap break-words text-[12px] leading-snug"
          style={{ color: showBreach ? BREACH : mode === "parameterised" ? SAFE : ACCENT }}
        >
          {sql}
          <span style={{ animation: "g10sqlinjection-caret 1s step-end infinite", color: ACCENT }}>▌</span>
        </pre>
      </div>

      {/* Phase 2 — patch the code */}
      {phase === 2 && (
        <div className="panel flex flex-col gap-2 rounded-xl border border-line p-3">
          <span className="text-xs text-ink-dim">🛠️ Patch the code — choose a query-builder</span>
          <CodeCard
            selected={mode === "vulnerable"}
            onSelect={() => {
              setMode("vulnerable");
              setRan(false);
              setRows(null);
            }}
            title="A · concatenate"
            code={'q = "...name=\'" + input + "\'"'}
            note="glues input into the SQL text"
            danger
          />
          <CodeCard
            selected={mode === "parameterised"}
            onSelect={() => {
              setMode("parameterised");
              setRan(false);
              setRows(null);
            }}
            title="B · parameterise"
            code={'q = "...name = ?"; bind(input)'}
            note="input is bound as data, never code"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={login}
          className="flex-1 rounded-lg px-4 py-2 text-sm font-medium"
          style={{ background: ACCENT, color: "#05070d" }}
          aria-label="Run the login query against the fake database"
        >
          ▶ LOGIN
        </button>
        {phase === 1 && breached && !defended && (
          <button
            type="button"
            onClick={goDefend}
            className="rounded-lg border px-4 py-2 text-sm font-medium text-ink-dim"
            style={{ borderColor: ACCENT }}
            aria-label="Continue to phase two: defend the app"
          >
            Defend →
          </button>
        )}
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-sm font-medium text-ink-dim"
          aria-label="Reset the lab"
        >
          Reset
        </button>
      </div>

      {/* Result banner */}
      {ran && rows !== null && (
        <div
          className="rounded-xl border p-3 text-sm"
          style={{
            animation: "g10sqlinjection-pop 180ms ease-out",
            borderColor: showBreach ? BREACH : defended ? SAFE : "var(--color-line, #27314f)",
            background: showBreach
              ? "rgba(248,113,113,0.12)"
              : defended
                ? "rgba(74,222,128,0.12)"
                : "transparent",
          }}
        >
          {showBreach && (
            <p
              className="font-bold"
              style={{ color: BREACH, animation: "g10sqlinjection-flash 1s ease-in-out infinite" }}
            >
              ⚠ BREACHED — logged in as admin without a password
            </p>
          )}
          {defended && (
            <p className="font-bold" style={{ color: SAFE }}>
              ✅ Attack blocked — input was treated as data, not code
            </p>
          )}
          <p className="mt-1 text-[11px] text-ink-faint">
            {rows.length === 0 ? "rows returned: 0 (no match)" : `rows leaked: ${rows.length}`}
          </p>
          {rows.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-[12px]">
              {rows.map((r) => (
                <li key={r.id} style={{ color: showBreach ? BREACH : ACCENT }}>
                  #{r.id} {r.name} · {r.role}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Status line */}
      <div
        className="rounded-lg px-2 py-1.5 text-center text-xs"
        role="status"
        aria-live="polite"
        style={{ color: defended ? SAFE : breached && phase === 1 ? BREACH : "#9aa6cf" }}
      >
        {status}
      </div>

      {/* Win celebration */}
      {defended && (
        <div
          className="rounded-xl border p-3 text-center"
          style={{ borderColor: SAFE, animation: "g10sqlinjection-pop 220ms ease-out" }}
        >
          <p className="text-lg" style={{ color: SAFE }}>
            ✨🎉 ⭐⭐⭐
          </p>
          <p className="mt-1 text-[11px] leading-snug text-ink-dim">
            Same payload, two outcomes. This is how ethical hackers find and fix holes — only ever
            on systems you&apos;re allowed to test.
          </p>
        </div>
      )}
    </div>
  );
}

function CodeCard({
  selected,
  onSelect,
  title,
  code,
  note,
  danger,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  code: string;
  note: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        onSelect();
      }}
      aria-label={`Select query builder: ${title}. ${note}.`}
      aria-pressed={selected}
      style={{
        touchAction: "manipulation",
        borderColor: selected ? (danger ? BREACH : SAFE) : "var(--color-line, #27314f)",
        background: selected ? (danger ? "rgba(248,113,113,0.1)" : "rgba(74,222,128,0.1)") : "rgba(11,16,32,0.6)",
      }}
      className="flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left"
    >
      <span className="text-xs font-medium text-ink">
        {selected ? "◉" : "○"} {title}
      </span>
      <code className="text-[11px]" style={{ color: danger ? BREACH : SAFE }}>
        {code}
      </code>
      <span className="text-[10px] text-ink-faint">{note}</span>
    </button>
  );
}
