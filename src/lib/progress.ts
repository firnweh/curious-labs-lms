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
    write(cur);
  }, []);

  const reset = useCallback(() => write({}), []);

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

/** Avoids a hydration flash for components that only need a mounted flag. */
export function useMounted() {
  const get = useCallback(() => true, []);
  return useSyncExternalStore(
    () => () => {},
    get,
    () => false,
  );
}
