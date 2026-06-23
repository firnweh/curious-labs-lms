"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

/**
 * Local, account-free progress.
 * Completion lives in localStorage so a learner keeps their badges across
 * visits without a login. When the backend phase lands, this hook is the
 * single seam to swap for a DB-backed store — the UI never changes.
 */

const KEY = "cl-lms-progress-v1";
const EVENT = "cl-lms-progress-change";

type Store = Record<string, { stars: number; at: number }>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "{}") as Store;
  } catch {
    return {};
  }
}

function write(next: Store) {
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

// Cache the parsed snapshot so useSyncExternalStore gets a stable reference
// (it bails out / loops if getSnapshot returns a fresh object every call).
let cache: Store = {};
let cacheRaw = "";
function getSnapshot(): Store {
  if (typeof window === "undefined") return cache;
  const raw = window.localStorage.getItem(KEY) || "{}";
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cache = read();
  }
  return cache;
}

export function useProgress() {
  const store = useSyncExternalStore(subscribe, getSnapshot, () => cache);

  const markComplete = useCallback((id: string, stars = 3) => {
    const cur = read();
    const prev = cur[id]?.stars ?? 0;
    cur[id] = { stars: Math.max(prev, stars), at: Date.now() };
    bumpStreak(); // record today's activity before the progress event fires
    write(cur);
  }, []);

  const reset = useCallback(() => {
    if (typeof window !== "undefined") window.localStorage.removeItem(STREAK_KEY);
    write({});
  }, []);

  const isComplete = useCallback((id: string) => Boolean(store[id]), [store]);
  const starsFor = useCallback((id: string) => store[id]?.stars ?? 0, [store]);

  const completedIds = Object.keys(store);

  return {
    store,
    completedIds,
    completedCount: completedIds.length,
    isComplete,
    starsFor,
    markComplete,
    reset,
  };
}

/** Synchronous read of the progress store (for before/after badge checks). */
export type ProgressStore = Store;
export function snapshotStore(): Store {
  return read();
}

/** Overwrite the whole progress store — cloud sync seam (hydrate / sign-out). */
export function replaceProgress(next: Store) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
}

/* ── Daily streak ─────────────────────────────────────────────────────────
   A lightweight "days active" counter, bumped whenever a lab is completed.
   Stored separately so it never pollutes the activity map. */

const STREAK_KEY = "cl-lms-streak-v1";
export interface Streak {
  current: number;
  best: number;
  lastDay: string; // local YYYY-MM-DD
}
const EMPTY_STREAK: Streak = { current: 0, best: 0, lastDay: "" };

function dayStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function readStreak(): Streak {
  if (typeof window === "undefined") return EMPTY_STREAK;
  try {
    return { ...EMPTY_STREAK, ...(JSON.parse(window.localStorage.getItem(STREAK_KEY) || "{}") as Partial<Streak>) };
  } catch {
    return EMPTY_STREAK;
  }
}

/** Overwrite the streak — cloud sync seam. Dispatches the progress event so
 *  streak readers (which share the same subscription) refresh immediately. */
export function replaceStreak(next: Streak) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STREAK_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
}

/** Bumps the streak for "today". Does NOT dispatch — the caller's progress
 *  write fires the change event, so streak readers refresh in the same tick. */
function bumpStreak() {
  if (typeof window === "undefined") return;
  const s = readStreak();
  const today = dayStr(new Date());
  if (s.lastDay === today) return; // already counted today
  const yesterday = dayStr(new Date(Date.now() - 86_400_000));
  const current = s.lastDay === yesterday ? s.current + 1 : 1;
  const next: Streak = { current, best: Math.max(s.best, current), lastDay: today };
  window.localStorage.setItem(STREAK_KEY, JSON.stringify(next));
}

let streakCache: Streak = EMPTY_STREAK;
let streakRaw = "";
function streakSnapshot(): Streak {
  if (typeof window === "undefined") return streakCache;
  const raw = window.localStorage.getItem(STREAK_KEY) || "{}";
  if (raw !== streakRaw) {
    streakRaw = raw;
    streakCache = readStreak();
  }
  return streakCache;
}

/** Reactive streak (current consecutive days a lab was completed). */
export function useStreak(): Streak {
  return useSyncExternalStore(subscribe, streakSnapshot, () => streakCache);
}

/** Avoids a hydration flash for components that only need a mounted flag. */
export function useMounted() {
  const get = useCallback(() => true, []);
  return useSyncExternalStore(
    () => () => {},
    get,
    () => false,
  );
}
