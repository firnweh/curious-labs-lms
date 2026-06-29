import type { ActivityComponent } from "./types";

/**
 * The legacy activity labs have been removed — Studio, Maker Lab and Neural Lab
 * are the hands-on experiences now. This map is kept (empty) so the remaining
 * admin/infra importers still compile until they're reworked.
 */
export const ACTIVITY_COMPONENTS: Record<string, ActivityComponent> = {};
