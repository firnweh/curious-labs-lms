"use client";

import { CircuitStudio } from "@/components/CircuitStudio";
import { CHALLENGES } from "@/lib/circuits/challenges";
import type { ActivityProps } from "@/lib/activities/types";

/** Adapts the free-build Circuit Studio into a graded, goal-based lab. */
export function CircuitChallengeLab({ challengeId, onComplete }: ActivityProps & { challengeId: string }) {
  const challenge = CHALLENGES[challengeId];
  return <CircuitStudio challenge={challenge} onSolved={() => onComplete({ passed: true, stars: 3 })} />;
}
