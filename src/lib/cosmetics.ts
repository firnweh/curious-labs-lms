"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useGameStats } from "@/lib/gamification";

/**
 * Maker Base cosmetics. Coins are a SPENDABLE currency earned from stars,
 * kept separate from XP/levels (which only ever go up). Available coins are
 * derived — earned minus the cost of everything owned — so the balance can
 * never be corrupted or go negative.
 */

const KEY = "cl-lms-cosmetics-v1";
const EVENT = "cl-lms-cosmetics-change";
export const COINS_PER_STAR = 10;

export type CosmeticType = "avatar" | "accent" | "title";

export interface Cosmetic {
  id: string;
  type: CosmeticType;
  name: string;
  value: string; // emoji (avatar), hex (accent), or label (title)
  cost: number; // coins; 0 = free default
  levelReq?: number;
}

export const CATALOG: Cosmetic[] = [
  // avatars
  { id: "av-astro", type: "avatar", name: "Astronaut", value: "🧑‍🚀", cost: 0 },
  { id: "av-cat", type: "avatar", name: "Curious Cat", value: "🐱", cost: 50 },
  { id: "av-robot", type: "avatar", name: "Bot Buddy", value: "🤖", cost: 60 },
  { id: "av-fox", type: "avatar", name: "Clever Fox", value: "🦊", cost: 70 },
  { id: "av-owl", type: "avatar", name: "Wise Owl", value: "🦉", cost: 70 },
  { id: "av-arm", type: "avatar", name: "Mecha Arm", value: "🦾", cost: 80 },
  { id: "av-panda", type: "avatar", name: "Panda", value: "🐼", cost: 90 },
  { id: "av-rocket", type: "avatar", name: "Rocketeer", value: "🚀", cost: 100 },
  { id: "av-brain", type: "avatar", name: "Big Brain", value: "🧠", cost: 110 },
  { id: "av-alien", type: "avatar", name: "Alien", value: "👾", cost: 120 },
  { id: "av-hero", type: "avatar", name: "Super Maker", value: "🦸", cost: 130, levelReq: 4 },
  { id: "av-dragon", type: "avatar", name: "Dragon", value: "🐲", cost: 160, levelReq: 5 },
  { id: "av-unicorn", type: "avatar", name: "Unicorn", value: "🦄", cost: 200, levelReq: 6 },
  // accent colours (your signature colour)
  { id: "ac-cyan", type: "accent", name: "Cyan", value: "#22d3ee", cost: 0 },
  { id: "ac-green", type: "accent", name: "Green", value: "#34d399", cost: 40 },
  { id: "ac-violet", type: "accent", name: "Violet", value: "#a855f7", cost: 40 },
  { id: "ac-amber", type: "accent", name: "Amber", value: "#f59e0b", cost: 40 },
  { id: "ac-blue", type: "accent", name: "Blue", value: "#3b82f6", cost: 50 },
  { id: "ac-pink", type: "accent", name: "Pink", value: "#ec4899", cost: 60 },
  { id: "ac-lime", type: "accent", name: "Lime", value: "#a3e635", cost: 60 },
  { id: "ac-red", type: "accent", name: "Crimson", value: "#f43f5e", cost: 70 },
  // titles
  { id: "ti-maker", type: "title", name: "Maker", value: "Maker", cost: 0 },
  { id: "ti-coder", type: "title", name: "Code Ninja", value: "Code Ninja", cost: 80 },
  { id: "ti-robo", type: "title", name: "Robo Wrangler", value: "Robo Wrangler", cost: 80 },
  { id: "ti-ai", type: "title", name: "AI Whisperer", value: "AI Whisperer", cost: 90 },
  { id: "ti-3d", type: "title", name: "3D Wizard", value: "3D Wizard", cost: 90 },
  { id: "ti-circuit", type: "title", name: "Circuit Master", value: "Circuit Master", cost: 100 },
  { id: "ti-legend", type: "title", name: "Lab Legend", value: "Lab Legend", cost: 200, levelReq: 6 },
];

const BY_ID = new Map(CATALOG.map((c) => [c.id, c]));
const DEFAULTS: Record<CosmeticType, Cosmetic> = {
  avatar: BY_ID.get("av-astro")!,
  accent: BY_ID.get("ac-cyan")!,
  title: BY_ID.get("ti-maker")!,
};

interface CosmeticState {
  owned: string[];
  equipped: Partial<Record<CosmeticType, string>>;
}

function read(): CosmeticState {
  if (typeof window === "undefined") return { owned: [], equipped: {} };
  try {
    const s = JSON.parse(window.localStorage.getItem(KEY) || "{}") as Partial<CosmeticState>;
    return { owned: s.owned ?? [], equipped: s.equipped ?? {} };
  } catch {
    return { owned: [], equipped: {} };
  }
}

function write(next: CosmeticState) {
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

let cache: CosmeticState = { owned: [], equipped: {} };
let cacheRaw = "";
function getSnapshot(): CosmeticState {
  if (typeof window === "undefined") return cache;
  const raw = window.localStorage.getItem(KEY) || "{}";
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cache = read();
  }
  return cache;
}

export interface Equipped {
  avatar: Cosmetic;
  accent: Cosmetic;
  title: Cosmetic;
}

export function resolveEquipped(state: CosmeticState): Equipped {
  const pick = (t: CosmeticType) => {
    const id = state.equipped[t];
    return (id && BY_ID.get(id)) || DEFAULTS[t];
  };
  return { avatar: pick("avatar"), accent: pick("accent"), title: pick("title") };
}

export function useCosmetics() {
  const state = useSyncExternalStore(subscribe, getSnapshot, () => cache);
  const { totalStars, level } = useGameStats();

  const ownedSet = new Set(state.owned);
  const isOwned = (item: Cosmetic) => item.cost === 0 || ownedSet.has(item.id);
  const earnedCoins = totalStars * COINS_PER_STAR;
  const spent = CATALOG.filter((c) => ownedSet.has(c.id)).reduce((n, c) => n + c.cost, 0);
  const coins = Math.max(0, earnedCoins - spent);
  const equipped = resolveEquipped(state);

  const buy = useCallback((item: Cosmetic) => {
    if (item.cost === 0) return false;
    const cur = read();
    if (cur.owned.includes(item.id)) return false;
    const owned = new Set(cur.owned);
    const spentNow = CATALOG.filter((c) => owned.has(c.id)).reduce((n, c) => n + c.cost, 0);
    const available = totalStars * COINS_PER_STAR - spentNow;
    if ((item.levelReq ?? 0) > level.index) return false;
    if (available < item.cost) return false;
    write({ ...cur, owned: [...cur.owned, item.id] });
    return true;
  }, [totalStars, level.index]);

  const equip = useCallback((item: Cosmetic) => {
    const cur = read();
    if (item.cost !== 0 && !cur.owned.includes(item.id)) return false;
    write({ ...cur, equipped: { ...cur.equipped, [item.type]: item.id } });
    return true;
  }, []);

  return {
    coins,
    earnedCoins,
    level: level.index,
    isOwned,
    equipped,
    catalog: CATALOG,
    buy,
    equip,
  };
}
