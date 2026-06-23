"use client";

import { useSyncExternalStore } from "react";

/**
 * The learner's display name (shown on the profile + certificates). Centralised
 * so edits dispatch a change event — that's what lets the cloud sync bridge
 * persist a renamed learner, and keeps every reader in sync.
 */
const KEY = "cl-lms-name";
const EVENT = "cl-lms-name-change";

export function getName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(KEY) || "";
}

export function setName(name: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, name);
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

let cache = "";
function snapshot(): string {
  if (typeof window === "undefined") return cache;
  const v = window.localStorage.getItem(KEY) || "";
  if (v !== cache) cache = v;
  return cache;
}

/** Reactive [name, setName]. */
export function useName(): [string, (n: string) => void] {
  const name = useSyncExternalStore(subscribe, snapshot, () => cache);
  return [name, setName];
}
