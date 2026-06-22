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

  // Juniors (Class 1–3)
  "j-code-path": dynamic(() => import("./impl/j-code-path"), { ssr: false, loading: LabLoading }),
  "j-code-pattern": dynamic(() => import("./impl/j-code-pattern"), { ssr: false, loading: LabLoading }),
  "j-robo-light": dynamic(() => import("./impl/j-robo-light"), { ssr: false, loading: LabLoading }),
  "j-robo-build": dynamic(() => import("./impl/j-robo-build"), { ssr: false, loading: LabLoading }),
  "j-ai-sort": dynamic(() => import("./impl/j-ai-sort"), { ssr: false, loading: LabLoading }),
  "j-ai-odd": dynamic(() => import("./impl/j-ai-odd"), { ssr: false, loading: LabLoading }),
  "j-3d-stack": dynamic(() => import("./impl/j-3d-stack"), { ssr: false, loading: LabLoading }),
  "j-3d-spin": dynamic(() => import("./impl/j-3d-spin"), { ssr: false, loading: LabLoading }),

  // Grade 1 — "Think, Build, Play" curriculum labs
  "g1-robot-buddy": dynamic(() => import("./impl/g1-robot-buddy"), { ssr: false, loading: LabLoading }),
  "g1-traffic-light": dynamic(() => import("./impl/g1-traffic-light"), { ssr: false, loading: LabLoading }),
  "g1-paper-circuit": dynamic(() => import("./impl/g1-paper-circuit"), { ssr: false, loading: LabLoading }),
  "g1-windmill": dynamic(() => import("./impl/g1-windmill"), { ssr: false, loading: LabLoading }),
  "g1-smart-house": dynamic(() => import("./impl/g1-smart-house"), { ssr: false, loading: LabLoading }),
  "g1-pattern-art": dynamic(() => import("./impl/g1-pattern-art"), { ssr: false, loading: LabLoading }),
  "g1-maze": dynamic(() => import("./impl/g1-maze"), { ssr: false, loading: LabLoading }),
  "g1-pulley": dynamic(() => import("./impl/g1-pulley"), { ssr: false, loading: LabLoading }),
  "g1-animal-robot": dynamic(() => import("./impl/g1-animal-robot"), { ssr: false, loading: LabLoading }),
  "g1-machine-book": dynamic(() => import("./impl/g1-machine-book"), { ssr: false, loading: LabLoading }),
  // Grade 2 — "Cause & Effect Systems" curriculum labs
  "g2-torch-circuit": dynamic(() => import("./impl/g2-torch-circuit"), { ssr: false, loading: LabLoading }),
  "g2-buzz-wire": dynamic(() => import("./impl/g2-buzz-wire"), { ssr: false, loading: LabLoading }),
  "g2-smart-fan": dynamic(() => import("./impl/g2-smart-fan"), { ssr: false, loading: LabLoading }),
  "g2-moving-car": dynamic(() => import("./impl/g2-moving-car"), { ssr: false, loading: LabLoading }),
  "g2-scratch-story": dynamic(() => import("./impl/g2-scratch-story"), { ssr: false, loading: LabLoading }),
  "g2-bridge": dynamic(() => import("./impl/g2-bridge"), { ssr: false, loading: LabLoading }),
  "g2-shape-3d": dynamic(() => import("./impl/g2-shape-3d"), { ssr: false, loading: LabLoading }),
  "g2-auto-door": dynamic(() => import("./impl/g2-auto-door"), { ssr: false, loading: LabLoading }),
  "g2-sound-toy": dynamic(() => import("./impl/g2-sound-toy"), { ssr: false, loading: LabLoading }),
  "g2-science-fair": dynamic(() => import("./impl/g2-science-fair"), { ssr: false, loading: LabLoading }),
  // Grade 3 — "Motion, Control & Digital Creativity" curriculum labs
  "g3-motor-robot-builder": dynamic(() => import("./impl/g3-motor-robot-builder"), { ssr: false, loading: LabLoading }),
  "g3-traffic-signal-sequence": dynamic(() => import("./impl/g3-traffic-signal-sequence"), { ssr: false, loading: LabLoading }),
  "g3-catch-game-loop": dynamic(() => import("./impl/g3-catch-game-loop"), { ssr: false, loading: LabLoading }),
  "g3-smart-dustbin-sensor": dynamic(() => import("./impl/g3-smart-dustbin-sensor"), { ssr: false, loading: LabLoading }),
  "g3-water-level-alert": dynamic(() => import("./impl/g3-water-level-alert"), { ssr: false, loading: LabLoading }),
  "g3-quake-safe-tower": dynamic(() => import("./impl/g3-quake-safe-tower"), { ssr: false, loading: LabLoading }),
  "g3-3d-house-designer": dynamic(() => import("./impl/g3-3d-house-designer"), { ssr: false, loading: LabLoading }),
  "g3-pir-alarm-logic": dynamic(() => import("./impl/g3-pir-alarm-logic"), { ssr: false, loading: LabLoading }),
  "g3-maze-algorithm-path": dynamic(() => import("./impl/g3-maze-algorithm-path"), { ssr: false, loading: LabLoading }),
  "g3-innovation-expo": dynamic(() => import("./impl/g3-innovation-expo"), { ssr: false, loading: LabLoading }),
  // Grade 4 — "Real Robotics Begins" curriculum labs
  "g4-line-follower": dynamic(() => import("./impl/g4-line-follower"), { ssr: false, loading: LabLoading }),
  "g4-night-lamp": dynamic(() => import("./impl/g4-night-lamp"), { ssr: false, loading: LabLoading }),
  "g4-smart-parking": dynamic(() => import("./impl/g4-smart-parking"), { ssr: false, loading: LabLoading }),
  "g4-obstacle-bot": dynamic(() => import("./impl/g4-obstacle-bot"), { ssr: false, loading: LabLoading }),
  "g4-weather-station": dynamic(() => import("./impl/g4-weather-station"), { ssr: false, loading: LabLoading }),
  "g4-game-score-timer": dynamic(() => import("./impl/g4-game-score-timer"), { ssr: false, loading: LabLoading }),
  "g4-keychain-3d": dynamic(() => import("./impl/g4-keychain-3d"), { ssr: false, loading: LabLoading }),
  "g4-doorbell-tones": dynamic(() => import("./impl/g4-doorbell-tones"), { ssr: false, loading: LabLoading }),
  "g4-plant-monitor": dynamic(() => import("./impl/g4-plant-monitor"), { ssr: false, loading: LabLoading }),
  "g4-assistive-design": dynamic(() => import("./impl/g4-assistive-design"), { ssr: false, loading: LabLoading }),
  // Grade 5 — "Automation & Design Thinking" curriculum labs
  "g5-smart-home-rules": dynamic(() => import("./impl/g5-smart-home-rules"), { ssr: false, loading: LabLoading }),
  "g5-fire-zone-alarm": dynamic(() => import("./impl/g5-fire-zone-alarm"), { ssr: false, loading: LabLoading }),
  "g5-robot-arm-angles": dynamic(() => import("./impl/g5-robot-arm-angles"), { ssr: false, loading: LabLoading }),
  "g5-smart-watering": dynamic(() => import("./impl/g5-smart-watering"), { ssr: false, loading: LabLoading }),
  "g5-heartbeat-monitor": dynamic(() => import("./impl/g5-heartbeat-monitor"), { ssr: false, loading: LabLoading }),
  "g5-keyword-chatbot": dynamic(() => import("./impl/g5-keyword-chatbot"), { ssr: false, loading: LabLoading }),
  "g5-pen-holder-cad": dynamic(() => import("./impl/g5-pen-holder-cad"), { ssr: false, loading: LabLoading }),
  "g5-solar-car-race": dynamic(() => import("./impl/g5-solar-car-race"), { ssr: false, loading: LabLoading }),
  "g5-rfid-attendance": dynamic(() => import("./impl/g5-rfid-attendance"), { ssr: false, loading: LabLoading }),
  "g5-community-fix-it": dynamic(() => import("./impl/g5-community-fix-it"), { ssr: false, loading: LabLoading }),
  // Grade 6 — "Coding Meets Hardware" curriculum labs
  "g6-bluetooth-robot-driver": dynamic(() => import("./impl/g6-bluetooth-robot-driver"), { ssr: false, loading: LabLoading }),
  "g6-contactless-bin-lid": dynamic(() => import("./impl/g6-contactless-bin-lid"), { ssr: false, loading: LabLoading }),
  "g6-smart-plant-waterer": dynamic(() => import("./impl/g6-smart-plant-waterer"), { ssr: false, loading: LabLoading }),
  "g6-weather-dashboard": dynamic(() => import("./impl/g6-weather-dashboard"), { ssr: false, loading: LabLoading }),
  "g6-line-follower-tuner": dynamic(() => import("./impl/g6-line-follower-tuner"), { ssr: false, loading: LabLoading }),
  "g6-turtle-art-functions": dynamic(() => import("./impl/g6-turtle-art-functions"), { ssr: false, loading: LabLoading }),
  "g6-phone-stand-designer": dynamic(() => import("./impl/g6-phone-stand-designer"), { ssr: false, loading: LabLoading }),
  "g6-dual-zone-alarm": dynamic(() => import("./impl/g6-dual-zone-alarm"), { ssr: false, loading: LabLoading }),
  "g6-power-meter-dashboard": dynamic(() => import("./impl/g6-power-meter-dashboard"), { ssr: false, loading: LabLoading }),
  "g6-startup-pitch-builder": dynamic(() => import("./impl/g6-startup-pitch-builder"), { ssr: false, loading: LabLoading }),
  // Grade 7 — "AI & Data Awareness" curriculum labs
  "g7-voice-robot": dynamic(() => import("./impl/g7-voice-robot"), { ssr: false, loading: LabLoading }),
  "g7-face-door": dynamic(() => import("./impl/g7-face-door"), { ssr: false, loading: LabLoading }),
  "g7-adaptive-traffic": dynamic(() => import("./impl/g7-adaptive-traffic"), { ssr: false, loading: LabLoading }),
  "g7-attendance-logic": dynamic(() => import("./impl/g7-attendance-logic"), { ssr: false, loading: LabLoading }),
  "g7-robotic-arm": dynamic(() => import("./impl/g7-robotic-arm"), { ssr: false, loading: LabLoading }),
  "g7-data-dashboard": dynamic(() => import("./impl/g7-data-dashboard"), { ssr: false, loading: LabLoading }),
  "g7-gear-design": dynamic(() => import("./impl/g7-gear-design"), { ssr: false, loading: LabLoading }),
  "g7-blind-stick": dynamic(() => import("./impl/g7-blind-stick"), { ssr: false, loading: LabLoading }),
  "g7-energy-iot": dynamic(() => import("./impl/g7-energy-iot"), { ssr: false, loading: LabLoading }),
  "g7-ai-social-good": dynamic(() => import("./impl/g7-ai-social-good"), { ssr: false, loading: LabLoading }),
  // Grade 8 — "Intelligent Decision Systems" curriculum labs
  "g8-object-detection-lab": dynamic(() => import("./impl/g8-object-detection-lab"), { ssr: false, loading: LabLoading }),
  "g8-farm-line-bot": dynamic(() => import("./impl/g8-farm-line-bot"), { ssr: false, loading: LabLoading }),
  "g8-delivery-pathfinder": dynamic(() => import("./impl/g8-delivery-pathfinder"), { ssr: false, loading: LabLoading }),
  "g8-emotion-reader": dynamic(() => import("./impl/g8-emotion-reader"), { ssr: false, loading: LabLoading }),
  "g8-waste-sorter": dynamic(() => import("./impl/g8-waste-sorter"), { ssr: false, loading: LabLoading }),
  "g8-weather-predictor": dynamic(() => import("./impl/g8-weather-predictor"), { ssr: false, loading: LabLoading }),
  "g8-drone-frame-fea": dynamic(() => import("./impl/g8-drone-frame-fea"), { ssr: false, loading: LabLoading }),
  "g8-smart-classroom-iot": dynamic(() => import("./impl/g8-smart-classroom-iot"), { ssr: false, loading: LabLoading }),
  "g8-chatbot-intent": dynamic(() => import("./impl/g8-chatbot-intent"), { ssr: false, loading: LabLoading }),
  "g8-capstone-builder": dynamic(() => import("./impl/g8-capstone-builder"), { ssr: false, loading: LabLoading }),
  // Grade 9 — "Engineering & Research" curriculum labs
  "g9-pid-navigator": dynamic(() => import("./impl/g9-pid-navigator"), { ssr: false, loading: LabLoading }),
  "g9-diagnosis-explainer": dynamic(() => import("./impl/g9-diagnosis-explainer"), { ssr: false, loading: LabLoading }),
  "g9-smart-city-mqtt": dynamic(() => import("./impl/g9-smart-city-mqtt"), { ssr: false, loading: LabLoading }),
  "g9-warehouse-sorter": dynamic(() => import("./impl/g9-warehouse-sorter"), { ssr: false, loading: LabLoading }),
  "g9-face-attendance": dynamic(() => import("./impl/g9-face-attendance"), { ssr: false, loading: LabLoading }),
  "g9-stock-forecast": dynamic(() => import("./impl/g9-stock-forecast"), { ssr: false, loading: LabLoading }),
  "g9-product-fea": dynamic(() => import("./impl/g9-product-fea"), { ssr: false, loading: LabLoading }),
  "g9-energy-meter": dynamic(() => import("./impl/g9-energy-meter"), { ssr: false, loading: LabLoading }),
  "g9-rescue-robot": dynamic(() => import("./impl/g9-rescue-robot"), { ssr: false, loading: LabLoading }),
  "g9-research-symposium": dynamic(() => import("./impl/g9-research-symposium"), { ssr: false, loading: LabLoading }),
  // Grade 10 — "Industry & Entrepreneurship" curriculum labs
  "g10-self-driving-lane": dynamic(() => import("./impl/g10-self-driving-lane"), { ssr: false, loading: LabLoading }),
  "g10-recommender": dynamic(() => import("./impl/g10-recommender"), { ssr: false, loading: LabLoading }),
  "g10-surveillance-detect": dynamic(() => import("./impl/g10-surveillance-detect"), { ssr: false, loading: LabLoading }),
  "g10-crop-yield": dynamic(() => import("./impl/g10-crop-yield"), { ssr: false, loading: LabLoading }),
  "g10-robot-arm-ik": dynamic(() => import("./impl/g10-robot-arm-ik"), { ssr: false, loading: LabLoading }),
  "g10-resume-bias": dynamic(() => import("./impl/g10-resume-bias"), { ssr: false, loading: LabLoading }),
  "g10-product-cad": dynamic(() => import("./impl/g10-product-cad"), { ssr: false, loading: LabLoading }),
  "g10-iot-hospital": dynamic(() => import("./impl/g10-iot-hospital"), { ssr: false, loading: LabLoading }),
  "g10-sql-injection": dynamic(() => import("./impl/g10-sql-injection"), { ssr: false, loading: LabLoading }),
  "g10-capstone-pipeline": dynamic(() => import("./impl/g10-capstone-pipeline"), { ssr: false, loading: LabLoading }),
  // Junior coding practice set (Class 1-3)
  "jc-go": dynamic(() => import("./impl/jc-go"), { ssr: false, loading: LabLoading }),
  "jc-steps": dynamic(() => import("./impl/jc-steps"), { ssr: false, loading: LabLoading }),
  "jc-next": dynamic(() => import("./impl/jc-next"), { ssr: false, loading: LabLoading }),
  "jc-loop": dynamic(() => import("./impl/jc-loop"), { ssr: false, loading: LabLoading }),
  "jc-maze": dynamic(() => import("./impl/jc-maze"), { ssr: false, loading: LabLoading }),
  "jc-dance": dynamic(() => import("./impl/jc-dance"), { ssr: false, loading: LabLoading }),
  "jc-rule": dynamic(() => import("./impl/jc-rule"), { ssr: false, loading: LabLoading }),
  // Junior robotics practice set (Class 1-3)
  "jr-light": dynamic(() => import("./impl/jr-light"), { ssr: false, loading: LabLoading }),
  "jr-build": dynamic(() => import("./impl/jr-build"), { ssr: false, loading: LabLoading }),
  "jr-button": dynamic(() => import("./impl/jr-button"), { ssr: false, loading: LabLoading }),
  "jr-spin": dynamic(() => import("./impl/jr-spin"), { ssr: false, loading: LabLoading }),
  "jr-sensor": dynamic(() => import("./impl/jr-sensor"), { ssr: false, loading: LabLoading }),
  "jr-drive": dynamic(() => import("./impl/jr-drive"), { ssr: false, loading: LabLoading }),
  "jr-helper": dynamic(() => import("./impl/jr-helper"), { ssr: false, loading: LabLoading }),
};
