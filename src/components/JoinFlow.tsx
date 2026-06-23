"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/SessionProvider";
import { joinClass } from "@/app/actions/auth";
import { signInAdult, signUpAdult } from "@/app/actions/accounts";
import type { AdultRole } from "@/lib/cloud-types";

type Role = "learner" | "teacher" | "parent";

const ROLES: { id: Role; emoji: string; title: string; desc: string }[] = [
  { id: "learner", emoji: "🚀", title: "I'm a Student", desc: "Join your class and play the labs." },
  { id: "teacher", emoji: "🧑‍🏫", title: "I'm a Teacher", desc: "See what your class is working on." },
  { id: "parent", emoji: "👪", title: "I'm a Parent", desc: "Follow your child's progress." },
];

export function JoinFlow() {
  // null = the "who are you?" chooser; a role = that role's login form.
  const [role, setRole] = useState<Role | null>(null);
  const active = role ? ROLES.find((r) => r.id === role)! : null;

  return (
    <div className="mx-auto max-w-md px-5 py-10 sm:py-16">
      <div className="mb-6 text-center">
        <h1 className="font-orbitron text-3xl font-bold text-ink neon-text">Welcome to Curious Labs</h1>
        <p className="mt-2 text-sm text-ink-dim">{active ? active.desc : "Who's signing in?"}</p>
      </div>

      {!role ? (
        // ── Step 1: pick a role ──────────────────────────────────────────
        <div className="space-y-3">
          {ROLES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRole(r.id)}
              className="panel panel-hover flex w-full items-center gap-4 p-5 text-left"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-neon-cyan/10 text-2xl">{r.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg font-semibold text-ink">{r.title}</span>
                <span className="block text-sm text-ink-dim">{r.desc}</span>
              </span>
              <span className="shrink-0 text-ink-faint">→</span>
            </button>
          ))}
        </div>
      ) : (
        // ── Step 2: that role's login form ───────────────────────────────
        <div>
          <button onClick={() => setRole(null)} className="mb-3 flex items-center gap-1.5 text-sm text-ink-dim transition-colors hover:text-ink">
            ← Choose a different role
          </button>
          <div className="panel p-6 sm:p-8">
            {role === "learner" ? <LearnerForm /> : <AdultAuth role={role} />}
          </div>
          {role === "learner" && (
            <p className="mt-5 text-center text-xs text-ink-faint">
              Trying it out? Join the demo class with code <span className="font-mono text-neon-cyan">CURIOUS-LAB</span>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function LearnerForm() {
  const router = useRouter();
  const { refresh } = useSession();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const r = await joinClass(code, name, pin);
    if (r.ok) {
      await refresh();
      router.push("/profile");
      return;
    }
    setErr(r.error);
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Class code">
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SPARK-1234" autoCapitalize="characters" className="input font-mono tracking-widest" />
      </Field>
      <Field label="Your name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Type your name" maxLength={40} className="input" />
      </Field>
      <Field label="Secret PIN (4 digits)" hint="Pick this on your first join — you'll use it next time.">
        <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="••••" className="input text-center font-mono text-2xl tracking-[0.6em]" />
      </Field>

      {err && <p className="rounded-lg bg-neon-violet/10 px-3 py-2 text-sm text-neon-violet">{err}</p>}
      <button type="submit" disabled={busy} className="btn-primary w-full justify-center disabled:opacity-50">
        {busy ? "Beaming you in…" : "🚀 Start learning"}
      </button>
    </form>
  );
}

function AdultAuth({ role }: { role: AdultRole }) {
  const router = useRouter();
  const { refresh } = useSession();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const home = role === "teacher" ? "/teacher" : "/parent";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const r = mode === "up" ? await signUpAdult(email, password, name, role) : await signInAdult(email, password);
    if (r.ok) {
      await refresh();
      router.push(home);
      return;
    }
    setErr(r.error);
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-panel/40 p-1">
        {(["in", "up"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setErr(null); }}
            className={"rounded-md px-3 py-1.5 text-sm font-medium transition-colors " + (mode === m ? "bg-neon-cyan/15 text-neon-cyan" : "text-ink-dim hover:text-ink")}
          >
            {m === "in" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      {mode === "up" && (
        <Field label="Your name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={role === "teacher" ? "e.g. Ms. Sharma" : "Your name"} maxLength={60} className="input" />
        </Field>
      )}
      <Field label="Email">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="you@example.com" className="input" />
      </Field>
      <Field label="Password" hint={mode === "up" ? "At least 8 characters." : undefined}>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete={mode === "up" ? "new-password" : "current-password"} placeholder="••••••••" className="input" />
      </Field>

      {err && <p className="rounded-lg bg-neon-violet/10 px-3 py-2 text-sm text-neon-violet">{err}</p>}
      <button type="submit" disabled={busy} className="btn-primary w-full justify-center disabled:opacity-50">
        {busy ? "One moment…" : mode === "up" ? `Create ${role} account` : "Sign in"}
      </button>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-xs tracking-tech text-ink-faint">{label.toUpperCase()}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-faint">{hint}</span>}
    </label>
  );
}
