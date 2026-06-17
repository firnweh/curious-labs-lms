"use client";

import dynamic from "next/dynamic";
import type { ActivityComponent } from "./types";

function LabLoading() {
  return (
    <div className="grid min-h-[420px] place-items-center text-ink-faint">
      <div className="flex flex-col items-center gap-3">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-neon-cyan" />
        <span className="font-mono text-xs tracking-tech">BOOTING LAB…</span>
      </div>
    </div>
  );
}

/**
 * Client-only lazy components. `ssr: false` keeps canvas/drag activities off
 * the server entirely, so each lab can safely touch `window` on first render.
 * Every key MUST match an id in registry.ts.
 */
export const ACTIVITY_COMPONENTS: Record<string, ActivityComponent> = {
  "code-maze": dynamic(() => import("./impl/code-maze"), { ssr: false, loading: LabLoading }),
  "code-loops": dynamic(() => import("./impl/code-loops"), { ssr: false, loading: LabLoading }),
  "robo-circuit": dynamic(() => import("./impl/robo-circuit"), { ssr: false, loading: LabLoading }),
  "robo-linebot": dynamic(() => import("./impl/robo-linebot"), { ssr: false, loading: LabLoading }),
  "ai-sorter": dynamic(() => import("./impl/ai-sorter"), { ssr: false, loading: LabLoading }),
  "ai-weights": dynamic(() => import("./impl/ai-weights"), { ssr: false, loading: LabLoading }),
  "threed-voxel": dynamic(() => import("./impl/threed-voxel"), { ssr: false, loading: LabLoading }),
  "threed-transform": dynamic(() => import("./impl/threed-transform"), { ssr: false, loading: LabLoading }),
};
