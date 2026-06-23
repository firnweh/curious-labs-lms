"use client";

import { useEffect, useRef } from "react";
import { useSession } from "@/components/SessionProvider";
import {
  snapshotStore,
  readStreak,
  replaceProgress,
  replaceStreak,
  type Streak,
} from "@/lib/progress";
import { readCosmeticState, replaceCosmeticState, type CosmeticState } from "@/lib/cosmetics";
import { readCreations, replaceCreations, type Creation } from "@/lib/creations";
import { getName, setName } from "@/lib/name";
import {
  pullState,
  pushProgress,
  pushStreak,
  pushCosmetics,
  pushCreations,
  setDisplayName,
  resetProgress,
} from "@/app/actions/state";
import type { CloudState } from "@/lib/cloud-types";

const EMPTY_STREAK: Streak = { current: 0, best: 0, lastDay: "" };

/**
 * The cloud sync bridge. The app stays offline-first (localStorage is the live,
 * reactive source of truth). This provider just mirrors it to Postgres:
 *   • on sign-in  → pull the learner's cloud state into the local stores
 *                    (or, for a fresh account, push any anonymous local play up)
 *   • on change   → debounced push of the affected store to the cloud
 *   • on sign-out → clear the synced local stores (shared-tablet safety)
 * No UI component changes — they all keep using useProgress/useCosmetics/etc.
 */
export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { student } = useSession();
  const id = student?.id ?? null;
  const activeId = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;
    const cleanups: Array<() => void> = [];
    const timers: ReturnType<typeof setTimeout>[] = [];

    const debounced = (fn: () => void, ms = 700) => {
      let t: ReturnType<typeof setTimeout> | undefined;
      return () => {
        if (t) clearTimeout(t);
        t = setTimeout(fn, ms);
        timers.push(t);
      };
    };

    async function run() {
      if (!id) {
        if (activeId.current) clearLocal(); // a real sign-out, not the first anon load
        activeId.current = null;
        return;
      }
      activeId.current = id;

      const cloud = await pullState().catch(() => null);
      if (cancelled) return;

      if (cloud && Object.keys(cloud.progress).length > 0) {
        hydrateFromCloud(cloud);
      } else {
        await pushAllLocal().catch(() => {}); // carry anonymous play into the new account
      }
      if (cancelled) return;

      const onProgress = debounced(() => {
        const store = snapshotStore();
        // An empty store means the learner hit "reset" — clear the cloud rows
        // too (an empty upsert can't delete them).
        if (Object.keys(store).length === 0) void resetProgress();
        else void pushProgress(store);
        void pushStreak(readStreak());
      });
      const onCosmetics = debounced(() => void pushCosmetics(toCloudCosmetics(readCosmeticState())));
      const onCreations = debounced(() => void pushCreations(readCreations()));
      const onName = debounced(() => void setDisplayName(getName()));

      const listen = (event: string, fn: () => void) => {
        window.addEventListener(event, fn);
        cleanups.push(() => window.removeEventListener(event, fn));
      };
      listen("cl-lms-progress-change", onProgress);
      listen("cl-lms-cosmetics-change", onCosmetics);
      listen("cl-lms-creations-change", onCreations);
      listen("cl-lms-name-change", onName);
    }

    void run();

    return () => {
      cancelled = true;
      cleanups.forEach((c) => c());
      timers.forEach((t) => clearTimeout(t));
    };
  }, [id]);

  return <>{children}</>;
}

function toCloudCosmetics(c: CosmeticState) {
  const equipped: Record<string, string> = {};
  for (const [k, v] of Object.entries(c.equipped)) if (v) equipped[k] = v;
  return { owned: c.owned, equipped };
}

function hydrateFromCloud(cloud: CloudState) {
  replaceProgress(cloud.progress);
  replaceStreak(cloud.streak);
  replaceCosmeticState({
    owned: cloud.cosmetics.owned,
    equipped: cloud.cosmetics.equipped as CosmeticState["equipped"],
  });
  replaceCreations(cloud.creations as Creation[]);
  if (cloud.name) setName(cloud.name);
}

async function pushAllLocal() {
  await Promise.all([
    pushProgress(snapshotStore()),
    pushStreak(readStreak()),
    pushCosmetics(toCloudCosmetics(readCosmeticState())),
    pushCreations(readCreations()),
    setDisplayName(getName()),
  ]);
}

function clearLocal() {
  replaceProgress({});
  replaceStreak(EMPTY_STREAK);
  replaceCosmeticState({ owned: [], equipped: {} });
  replaceCreations([]);
  setName("");
}
