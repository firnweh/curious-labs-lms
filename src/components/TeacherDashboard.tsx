"use client";

import { useCallback, useEffect, useState } from "react";
import { getTeacherClasses, createClass, getClassRoster, getStudentDetailForTeacher } from "@/app/actions/teacher";
import type { ClassInfo, ClassRoster, StudentDetail } from "@/lib/cloud-types";
import { MiniStats, DetailPanel } from "@/components/dashboard/parts";

export function TeacherDashboard({ name }: { name: string }) {
  const [classes, setClasses] = useState<ClassInfo[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [roster, setRoster] = useState<ClassRoster | null>(null);
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const loadClasses = useCallback(async () => {
    try {
      const c = await getTeacherClasses();
      setClasses(c);
      setActiveId((cur) => cur ?? c[0]?.id ?? null);
    } catch {
      setClasses([]); // degrade to "no classes yet" instead of spinning forever
    }
  }, []);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  useEffect(() => {
    if (!activeId) return;
    setRoster(null);
    setDetail(null);
    void getClassRoster(activeId).then(setRoster);
  }, [activeId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    const r = await createClass(newName);
    setBusy(false);
    if (r.ok) {
      setNewName("");
      await loadClasses();
    }
  }

  async function openStudent(id: string) {
    setDetail(null);
    setDetail((await getStudentDetailForTeacher(id)) ?? null);
  }

  const active = classes?.find((c) => c.id === activeId);

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <header className="mb-6">
        <p className="font-mono text-xs tracking-tech text-neon-cyan">TEACHER DASHBOARD</p>
        <h1 className="font-display text-3xl font-bold text-ink">Hi, {name.split(/\s+/)[0]} 👋</h1>
        <p className="mt-1 text-sm text-ink-dim">See what every learner in your classes is working on. (View-only.)</p>
      </header>

      {/* create class */}
      <form onSubmit={create} className="mb-6 flex flex-wrap items-end gap-2 rounded-xl border border-line bg-panel/40 p-4">
        <label className="flex-1">
          <span className="font-mono text-xs tracking-tech text-ink-faint">NEW CLASS</span>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Grade 4 — Section A" maxLength={60} className="input" />
        </label>
        <button type="submit" disabled={busy} className="btn-primary shrink-0 disabled:opacity-50">
          {busy ? "Creating…" : "Create class"}
        </button>
      </form>

      {classes === null ? (
        <p className="text-sm text-ink-faint">Loading…</p>
      ) : classes.length === 0 ? (
        <div className="panel p-8 text-center text-ink-dim">
          <p className="text-3xl">🏫</p>
          <p className="mt-2">Create your first class above — you'll get a join code to share with your learners.</p>
        </div>
      ) : (
        <>
          {/* class chips */}
          <div className="mb-5 flex flex-wrap gap-2">
            {classes.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={
                  "rounded-full border px-4 py-2 text-sm transition-colors " +
                  (c.id === activeId ? "border-neon-cyan/60 bg-neon-cyan/10 text-neon-cyan" : "border-line text-ink-dim hover:text-ink")
                }
              >
                {c.name} <span className="ml-1 font-mono text-xs opacity-70">· {c.studentCount}</span>
              </button>
            ))}
          </div>

          {active && (
            <div className="mb-4 flex items-center gap-2 text-sm text-ink-dim">
              <span>Join code:</span>
              <span className="rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 px-3 py-1 font-mono font-bold tracking-widest text-neon-cyan">{active.code}</span>
              <button
                onClick={() => { navigator.clipboard?.writeText(active.code); setCopied(active.code); }}
                className="rounded-lg border border-line px-2.5 py-1 text-xs hover:text-ink"
              >
                {copied === active.code ? "✓ copied" : "copy"}
              </button>
            </div>
          )}

          {/* roster */}
          {roster === null ? (
            <p className="text-sm text-ink-faint">Loading roster…</p>
          ) : roster.students.length === 0 ? (
            <div className="panel p-8 text-center text-ink-dim">
              <p>No learners have joined <span className="text-ink">{roster.name}</span> yet.</p>
              <p className="mt-1 text-sm text-ink-faint">Share the code <span className="font-mono text-neon-cyan">{roster.code}</span> so they can sign in.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {roster.students.map((s) => (
                <li key={s.id}>
                  <button onClick={() => openStudent(s.id)} className="panel panel-hover flex w-full items-center justify-between gap-3 p-4 text-left">
                    <span className="font-medium text-ink">{s.displayName}</span>
                    <MiniStats s={s} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* student detail overlay */}
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
