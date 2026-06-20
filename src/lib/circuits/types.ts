/** Curious Labs — Circuit Studio data model (kid-friendly, 2-terminal parts). */

export type PartType =
  | "battery"
  | "switch"
  | "button"
  | "led"
  | "resistor"
  | "buzzer"
  | "motor"
  | "pot";

/** A pin reference: which component, which pin ("a" | "b"). */
export interface PinRef {
  c: string;
  p: string;
}

export interface CircuitComponent {
  id: string;
  type: PartType;
  x: number;
  y: number;
  /** rotation in degrees (0 / 90 / 180 / 270) */
  rot?: number;
  /** Per-type properties: ohms, color, closed, volts… */
  props: Record<string, number | string | boolean>;
}

export interface Wire {
  id: string;
  a: PinRef;
  b: PinRef;
}

export interface CircuitDoc {
  components: CircuitComponent[];
  wires: Wire[];
}

/** Per-component electrical result of a simulation solve. */
export interface CompState {
  /** signed current through the part, amps */
  current: number;
  /** is the part "doing its thing" (lit / spinning / buzzing) */
  on: boolean;
  /** 0..1 intensity (LED brightness, motor speed) */
  level: number;
}

export interface SimResult {
  active: boolean;
  comp: Record<string, CompState>;
  /** wireId → carrying current */
  wireLive: Record<string, boolean>;
}

export const pinKey = (c: string, p: string) => `${c}:${p}`;
