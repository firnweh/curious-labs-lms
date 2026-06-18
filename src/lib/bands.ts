"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Band } from "@/lib/activities/types";

export interface BandInfo {
  id: Band;
  name: string;
  classes: string; // "Class 1–3"
  short: string; // "1–3"
  emoji: string;
  accent: string;
  tagline: string;
  /** The thinking / problem-solving level this band targets. */
  thinking: string;
}

export const BANDS: BandInfo[] = [
  {
    id: "junior",
    name: "Juniors",
    classes: "Class 1–3",
    short: "1–3",
    emoji: "🐣",
    accent: "#34d399",
    tagline: "Tap, match and explore.",
    thinking: "Spot patterns, follow simple steps, sort by what you see — playful and no reading needed.",
  },
  {
    id: "explorer",
    name: "Explorers",
    classes: "Class 4–6",
    short: "4–6",
    emoji: "🚀",
    accent: "#22d3ee",
    tagline: "Build it, loop it, make it work.",
    thinking: "Use loops and logic, build circuits, train a model — solve multi-step puzzles.",
  },
  {
    id: "innovator",
    name: "Innovators",
    classes: "Class 7–10",
    short: "7–10",
    emoji: "🧠",
    accent: "#a855f7",
    tagline: "Analyse, model and create.",
    thinking: "Variables and conditions, control loops, evaluate models, think in coordinates — real reasoning.",
  },
];

export const BAND_MAP: Record<Band, BandInfo> = Object.fromEntries(
  BANDS.map((b) => [b.id, b]),
) as Record<Band, BandInfo>;

export const DEFAULT_BAND: Band = "explorer";

/* ── reactive selected-band store (localStorage) ─────────────────────────── */
const KEY = "cl-lms-band";
const EVENT = "cl-lms-band-change";

function isBand(v: string | null): v is Band {
  return v === "junior" || v === "explorer" || v === "innovator";
}

function readBand(): Band {
  if (typeof window === "undefined") return DEFAULT_BAND;
  const v = window.localStorage.getItem(KEY);
  return isBand(v) ? v : DEFAULT_BAND;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

let cache: Band = DEFAULT_BAND;
let cacheRaw = "";
function getSnapshot(): Band {
  if (typeof window === "undefined") return cache;
  const raw = window.localStorage.getItem(KEY) || "";
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cache = readBand();
  }
  return cache;
}

/** Whether the learner has explicitly chosen a band yet (for first-run prompts). */
export function hasChosenBand(): boolean {
  if (typeof window === "undefined") return false;
  return isBand(window.localStorage.getItem(KEY));
}

export function useBand() {
  const band = useSyncExternalStore(subscribe, getSnapshot, () => cache);
  const setBand = useCallback((b: Band) => {
    window.localStorage.setItem(KEY, b);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { band, setBand, info: BAND_MAP[band] };
}
