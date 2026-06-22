import type { CircuitDoc, CircuitComponent, SimResult, CompState } from "./types";
import { pinKey } from "./types";

/**
 * Simplified DC simulator. Wires merge pins into nets (union-find); each
 * 2-terminal part is a branch between two nets; the battery is an ideal
 * voltage source. We stamp a Modified Nodal Analysis (MNA) system and solve
 * it with Gaussian elimination — correct for series AND parallel resistive
 * networks. LEDs/buzzers/motors are modelled as resistors that "switch on"
 * once enough current flows. Truthful enough for grades 1–10, no SPICE,
 * no GPL. Pure function: doc in → SimResult out.
 */

const BATTERY_V = 9;
const R_CLOSED = 0.01; // closed switch / wire-ish
const LED_R = 180;
const BUZZER_R = 120;
const MOTOR_R = 60;
const LED_ON = 0.0005; // 0.5 mA
const ACT_ON = 0.001; // motor/buzzer threshold
const LED_FULL = 0.02; // 20 mA = full brightness

function resistanceOf(c: CircuitComponent): number | null {
  switch (c.type) {
    case "switch":
    case "button":
      return c.props.closed ? R_CLOSED : null; // null = open branch
    case "resistor":
      return clamp(Number(c.props.ohms) || 220, 1, 1e6);
    case "pot":
      return clamp(Number(c.props.ohms) || 500, 1, 1000);
    case "led":
      return LED_R;
    case "buzzer":
      return BUZZER_R;
    case "motor":
      return MOTOR_R;
    default:
      return null;
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

class UF {
  parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let r = x;
    while (this.parent.get(r) !== r) r = this.parent.get(r)!;
    let c = x;
    while (this.parent.get(c) !== r) {
      const n = this.parent.get(c)!;
      this.parent.set(c, r);
      c = n;
    }
    return r;
  }
  union(a: string, b: string) {
    const ra = this.find(a),
      rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

function emptyState(): CompState {
  return { current: 0, on: false, level: 0 };
}

/** Solve a dense linear system A x = z (Gaussian elimination, partial pivot). */
function solveLinear(A: number[][], z: number[]): number[] | null {
  const n = z.length;
  if (n === 0) return [];
  const M = A.map((row, i) => [...row, z[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-12) continue; // singular column — leave as 0
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row) => row[n]);
}

export function simulate(doc: CircuitDoc): SimResult {
  const comp: Record<string, CompState> = {};
  const wireLive: Record<string, boolean> = {};
  doc.components.forEach((c) => (comp[c.id] = emptyState()));
  doc.wires.forEach((w) => (wireLive[w.id] = false));

  const batteries = doc.components.filter((c) => c.type === "battery");
  if (batteries.length === 0) return { active: false, comp, wireLive };

  // 1) nets via union-find over wired pins
  const uf = new UF();
  doc.components.forEach((c) => {
    uf.find(pinKey(c.id, "a"));
    uf.find(pinKey(c.id, "b"));
  });
  doc.wires.forEach((w) => uf.union(pinKey(w.a.c, w.a.p), pinKey(w.b.c, w.b.p)));

  const rootOf = (c: string, p: string) => uf.find(pinKey(c, p));
  const netIds = new Map<string, number>();
  const netRoot = (root: string) => {
    if (!netIds.has(root)) netIds.set(root, netIds.size);
    return netIds.get(root)!;
  };
  doc.components.forEach((c) => {
    netRoot(rootOf(c.id, "a"));
    netRoot(rootOf(c.id, "b"));
  });

  const nNets = netIds.size;
  const ground = netRoot(rootOf(batteries[0].id, "a")); // battery "a" = minus = ground

  // node index: ground excluded (its voltage is 0)
  const nodeIndex = (net: number) => (net === ground ? -1 : net < ground ? net : net - 1);
  const numNodes = nNets - 1;
  const numV = batteries.length;
  const size = numNodes + numV;
  const A: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
  const z = new Array(size).fill(0);

  // tiny leak to ground keeps the matrix non-singular for floating nets
  for (let i = 0; i < numNodes; i++) A[i][i] += 1e-9;

  const stampR = (na: number, nb: number, g: number) => {
    const ia = nodeIndex(na),
      ib = nodeIndex(nb);
    if (ia >= 0) A[ia][ia] += g;
    if (ib >= 0) A[ib][ib] += g;
    if (ia >= 0 && ib >= 0) {
      A[ia][ib] -= g;
      A[ib][ia] -= g;
    }
  };

  type RBranch = { id: string; na: number; nb: number; g: number };
  const rbranches: RBranch[] = [];
  doc.components.forEach((c) => {
    if (c.type === "battery") return;
    const r = resistanceOf(c);
    if (r == null) return; // open
    const na = netRoot(rootOf(c.id, "a"));
    const nb = netRoot(rootOf(c.id, "b"));
    const g = 1 / r;
    stampR(na, nb, g);
    rbranches.push({ id: c.id, na, nb, g });
  });

  // voltage sources (batteries): "b" = +, "a" = − ; V = 9
  batteries.forEach((bat, k) => {
    const np = netRoot(rootOf(bat.id, "b"));
    const nn = netRoot(rootOf(bat.id, "a"));
    const row = numNodes + k;
    const ip = nodeIndex(np),
      inn = nodeIndex(nn);
    if (ip >= 0) {
      A[ip][row] += 1;
      A[row][ip] += 1;
    }
    if (inn >= 0) {
      A[inn][row] -= 1;
      A[row][inn] -= 1;
    }
    z[row] = BATTERY_V;
  });

  const x = solveLinear(A, z);
  if (!x) return { active: false, comp, wireLive };

  const voltage = (net: number) => {
    const i = nodeIndex(net);
    return i < 0 ? 0 : x[i];
  };

  // 2) branch currents + per-net activity
  const netCurrent = new Array(nNets).fill(0);
  rbranches.forEach((b) => {
    const I = (voltage(b.na) - voltage(b.nb)) * b.g;
    const ai = Math.abs(I);
    const s = comp[b.id];
    s.current = I;
    netCurrent[b.na] = Math.max(netCurrent[b.na], ai);
    netCurrent[b.nb] = Math.max(netCurrent[b.nb], ai);
  });
  batteries.forEach((bat, k) => {
    const I = Math.abs(x[numNodes + k]);
    comp[bat.id].current = I;
    comp[bat.id].on = I > ACT_ON;
    comp[bat.id].level = clamp(I / LED_FULL, 0, 1);
    const np = netRoot(rootOf(bat.id, "b"));
    const nn = netRoot(rootOf(bat.id, "a"));
    netCurrent[np] = Math.max(netCurrent[np], I);
    netCurrent[nn] = Math.max(netCurrent[nn], I);
  });

  // 3) component on/level by type
  doc.components.forEach((c) => {
    const s = comp[c.id];
    const ai = Math.abs(s.current);
    if (c.type === "led") {
      s.on = ai > LED_ON;
      s.level = clamp(ai / LED_FULL, 0, 1);
    } else if (c.type === "buzzer" || c.type === "motor") {
      s.on = ai > ACT_ON;
      s.level = clamp(ai / LED_FULL, 0, 1);
    }
  });

  // 4) wires live if their net carries current
  doc.wires.forEach((w) => {
    const net = netRoot(uf.find(pinKey(w.a.c, w.a.p)));
    wireLive[w.id] = netCurrent[net] > ACT_ON;
  });

  const active = comp[batteries[0].id].current > ACT_ON;
  return { active, comp, wireLive };
}
