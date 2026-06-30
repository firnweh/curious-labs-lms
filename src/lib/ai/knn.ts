/**
 * Tiny "teachable model" used by the Neural Lab trainer experiments.
 *
 * Kids add a few example vectors per class (image embeddings, pose/hand
 * landmark vectors, or audio fingerprints), then the model classifies a new
 * vector by cosine-similarity to each class's mean (centroid). Confidences come
 * from a softmax over those similarities. Deliberately simple and transparent —
 * the whole point is that the learner can see how "more examples → better".
 */

export interface Prediction {
  label: string;
  score: number; // 0..1 confidence for the winning label
  scores: { label: string; score: number }[];
}

const dot = (a: number[], b: number[]) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};
const norm = (a: number[]) => Math.sqrt(dot(a, a)) || 1;
const cosine = (a: number[], b: number[]) => dot(a, b) / (norm(a) * norm(b));

export class TeachableModel {
  private samples = new Map<string, number[][]>();
  private centroids = new Map<string, number[]>();

  addSample(label: string, vec: number[]) {
    const arr = this.samples.get(label) ?? [];
    arr.push(vec);
    this.samples.set(label, arr);
    this.recompute(label);
  }

  private recompute(label: string) {
    const arr = this.samples.get(label);
    if (!arr || arr.length === 0) return;
    const dim = arr[0].length;
    const mean = new Array(dim).fill(0);
    for (const v of arr) for (let i = 0; i < dim; i++) mean[i] += v[i];
    for (let i = 0; i < dim; i++) mean[i] /= arr.length;
    this.centroids.set(label, mean);
  }

  labels(): string[] {
    return [...this.samples.keys()];
  }

  count(label: string): number {
    return this.samples.get(label)?.length ?? 0;
  }

  counts(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of this.samples) out[k] = v.length;
    return out;
  }

  totalSamples(): number {
    let n = 0;
    for (const v of this.samples.values()) n += v.length;
    return n;
  }

  reset() {
    this.samples.clear();
    this.centroids.clear();
  }

  trainedClasses(): number {
    return [...this.samples.values()].filter((v) => v.length > 0).length;
  }

  classify(vec: number[]): Prediction | null {
    const entries = [...this.centroids.entries()];
    if (entries.length === 0) return null;
    const sims = entries.map(([label, c]) => ({ label, sim: cosine(vec, c) }));
    // softmax over similarities (temperature sharpens the winner)
    const T = 12;
    const exps = sims.map((s) => Math.exp(s.sim * T));
    const sum = exps.reduce((a, b) => a + b, 0) || 1;
    const scores = sims
      .map((s, i) => ({ label: s.label, score: exps[i] / sum }))
      .sort((a, b) => b.score - a.score);
    return { label: scores[0].label, score: scores[0].score, scores };
  }
}

/** Flatten a list of {x,y,z?} landmarks into a single vector, recentred on its
 *  mean so position in frame doesn't matter — only the shape does. */
export function landmarksToVector(lm: { x: number; y: number; z?: number }[]): number[] {
  const n = lm.length || 1;
  let cx = 0, cy = 0;
  for (const p of lm) { cx += p.x; cy += p.y; }
  cx /= n; cy /= n;
  const out: number[] = [];
  for (const p of lm) {
    out.push(p.x - cx, p.y - cy, p.z ?? 0);
  }
  return out;
}
