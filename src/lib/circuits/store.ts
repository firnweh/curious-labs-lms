"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { CircuitDoc } from "./types";

/** Local gallery of saved circuits (localStorage, like the creations store). */

const KEY = "cl-lms-circuits-v1";
const EVENT = "cl-lms-circuits-change";
const MAX = 40;

export interface CircuitSave {
  id: string;
  name: string;
  at: number;
  doc: CircuitDoc;
}

function read(): CircuitSave[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "[]") as CircuitSave[];
  } catch {
    return [];
  }
}

function writeAll(list: CircuitSave[]) {
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

let cache: CircuitSave[] = [];
let cacheRaw = "";
function getSnapshot(): CircuitSave[] {
  if (typeof window === "undefined") return cache;
  const raw = window.localStorage.getItem(KEY) || "[]";
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cache = read();
  }
  return cache;
}

export function useCircuits() {
  const circuits = useSyncExternalStore(subscribe, getSnapshot, () => cache);

  const save = useCallback((name: string, doc: CircuitDoc) => {
    const item: CircuitSave = {
      id: `cir${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
      name: name.trim() || "Untitled circuit",
      at: Date.now(),
      doc,
    };
    writeAll([item, ...read()]);
    return item.id;
  }, []);

  const remove = useCallback((id: string) => writeAll(read().filter((c) => c.id !== id)), []);

  return { circuits, save, remove };
}
