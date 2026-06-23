"use client";

import { CircuitChallengeLab } from "@/components/CircuitChallengeLab";
import type { ActivityProps } from "../types";

export default function CircuitLab(props: ActivityProps) {
  return <CircuitChallengeLab challengeId="buzz" {...props} />;
}
