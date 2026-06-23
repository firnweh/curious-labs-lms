"use client";

import { useCallback, useEffect, useState } from "react";
import { getLinkedChildren, linkChild, getStudentDetailForParent } from "@/app/actions/parent";
import type { StudentSummary, StudentDetail } from "@/lib/cloud-types";
import { MiniStats, DetailPanel } from "@/components/dashboard/parts";

export function ParentDashboard({ name }: { name: string }) {
  const [children, setChildren] = useState<StudentSummary[] | null>(null);
  const [detail, setDetail] = useState<StudentDetail | null>(null);

  const [code, setCode] = useState("");
  const [childName, setChildName] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setChildren(await getLinkedChildren());
    } catch {
      setChildren([]); // degrade gracefully on a network/backend blip
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addChild(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const r = await linkChild(code, childName, pin);
    setBusy(false);
    if (r.ok) {
      setCode("");
      setChildName("");
      setPin("");
      await load();
    } else {
      setErr(r.error);
    }
  }

  async function openChild(id: string) {
    setDetail(null);
    setDetail((await getStudentDetailForParent(id)) ?? null);
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <header className="mb-6">
        <p className="font-mono text-xs tracking-tech text-neon-cyan">PARENT DASHBOARD</p>
        <h1 className="font-display text-3xl font-bold text-ink">Hi, {name.split(/\s+/)[0]} 👋</h1>
        <p className="mt-1 text-sm text-ink-dim">Follow your child's progress, stars and streaks. (View-only.)</p>
      </header>

      {/* children */}
      {children === null ? (
        <p className="text-sm text-ink-faint">Loading…</p>
      ) : children.length === 0 ? (
        <div className="panel mb-6 p-8 text-center text-ink-dim">
          <p className="text-3xl">👶</p>
          <p className="mt-2">No children linked yet — add one below using their class code, name and PIN.</p>
        </div>
      ) : (
        <ul className="mb-6 space-y-2">
          {children.map((c) => (
            <li key={c.id}>
              <button onClick={() => openChild(c.id)} className="panel panel-hover flex w-full items-center justify-between gap-3 p-4 text-left">
                <span className="font-medium text-ink">{c.displayName}</span>
                <MiniStats s={c} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* add a child */}
      <form onSubmit={addChild} className="rounded-xl border border-line bg-panel/40 p-4">
        <p className="mb-3 font-display text-lg font-semibold text-ink">Add a child</p>
        <p className="mb-3 text-xs text-ink-faint">Enter your child's class code, their name and the 4-digit PIN they chose.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CLASS CODE" className="input font-mono tracking-widest" />
          <input value={childName} onChange={(e) => setChildName(e.target.value)} placeholder="Child's name" maxLength={40} className="input" />
          <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="PIN" className="input text-center font-mono tracking-[0.4em]" />
        </div>
        {err && <p className="mt-3 rounded-lg bg-neon-violet/10 px-3 py-2 text-sm text-neon-violet">{err}</p>}
        <button type="submit" disabled={busy} className="btn-primary mt-3 disabled:opacity-50">
          {busy ? "Linking…" : "Link child"}
        </button>
      </form>

      {detail && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-base/70 p-4 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <div className="panel w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <DetailPanel detail={detail} onClose={() => setDetail(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
