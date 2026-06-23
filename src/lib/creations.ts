"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Local gallery of things kids make in the creative studios. */

const KEY = "cl-lms-creations-v1";
const EVENT = "cl-lms-creations-change";
const MAX = 40;

export interface Creation {
  id: string;
  name: string;
  kind: "pixel";
  w: number;
  h: number;
  palette: string[];
  cells: number[]; // palette index, or -1 for empty
  at: number;
}

function read(): Creation[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "[]") as Creation[];
  } catch {
    return [];
  }
}

function writeAll(list: Creation[]) {
  window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
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

let cache: Creation[] = [];
let cacheRaw = "";
function getSnapshot(): Creation[] {
  if (typeof window === "undefined") return cache;
  const raw = window.localStorage.getItem(KEY) || "[]";
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cache = read();
  }
  return cache;
}

/** Read / overwrite the gallery — cloud sync seam (hydrate / sign-out). */
export function readCreations(): Creation[] {
  return read();
}
export function replaceCreations(list: Creation[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  window.dispatchEvent(new Event(EVENT));
}

export function useCreations() {
  const creations = useSyncExternalStore(subscribe, getSnapshot, () => cache);

  const save = useCallback((c: Omit<Creation, "id" | "at">) => {
    const item: Creation = { ...c, id: `c${Date.now()}-${Math.floor(Math.random() * 1e4)}`, at: Date.now() };
    writeAll([item, ...read()]);
    return item.id;
  }, []);

  const remove = useCallback((id: string) => {
    writeAll(read().filter((c) => c.id !== id));
  }, []);

  return { creations, save, remove };
}
