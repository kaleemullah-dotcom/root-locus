/**
 * Exact closed-loop stability intervals in K > 0.
 * Candidate boundaries come from the Routh first column, the jω crossings, the origin crossing
 * and (n = m) the K where the characteristic degree drops. Each open interval between candidates
 * is tested EXACTLY with a rational K (Routh–Hurwitz over Q). A dense numeric scan cross-checks.
 */
import { Q, Q0 } from './rational';
import { qtrim, type QPoly } from './qpoly';
import { rootsFloat } from './roots';
import { cabs } from './complex';
import { rfDen, rfNum } from './kfunc';
import { isHurwitzExact, positiveRoots, type ColumnCondition, type KInterval } from './routh';
import type { CrossingsResult } from './crossings';
import type { OpenLoop } from './system';

export type IntervalStatus = 'stable' | 'marginal' | 'unstable';
export interface ClassifiedInterval extends KInterval {
  status: IntervalStatus;
  /** number of closed-loop poles in the open right half-plane (numeric, at the test point) */
  rhp: number;
  testK: number;
}
export interface StabilityResult {
  boundaries: number[];
  intervals: ClassifiedInterval[];
  /** merged stable K ranges */
  stable: KInterval[];
  marginalEverywhere: boolean;
  conditionallyStable: boolean;
  numericCheck: { points: number; mismatches: number };
}

export function charPolyAt(ol: OpenLoop, K: Q): QPoly {
  const len = Math.max(ol.D.length, ol.N.length);
  return qtrim(Array.from({ length: len }, (_, k) => (ol.D[k] ?? Q0).add((ol.N[k] ?? Q0).mul(K))));
}
/** Float-only view of the open loop (transferable to a Web Worker). */
export type OpenLoopLite = Pick<OpenLoop, 'Df' | 'Nf' | 'n' | 'm' | 'q' | 'poles' | 'zeros'>;

export function charPolyF(ol: Pick<OpenLoop, 'Df' | 'Nf'>, K: number): number[] {
  const len = Math.max(ol.Df.length, ol.Nf.length);
  return Array.from({ length: len }, (_, k) => (ol.Df[k] ?? 0) + K * (ol.Nf[k] ?? 0));
}
export function closedLoopPoles(ol: Pick<OpenLoop, 'Df' | 'Nf'>, K: number): ReturnType<typeof rootsFloat> {
  let p = charPolyF(ol, K);
  // drop a vanishing leading coefficient (n = m, degree drop)
  const scale = Math.max(...p.map(Math.abs));
  while (p.length > 1 && Math.abs(p[p.length - 1]) <= 1e-14 * scale) p = p.slice(0, -1);
  return rootsFloat(p);
}

function numericStatus(ol: Pick<OpenLoop, 'Df' | 'Nf'>, K: number): { status: IntervalStatus; rhp: number } {
  const r = closedLoopPoles(ol, K);
  const mag = Math.max(1, ...r.map(cabs));
  const tol = 1e-9 * mag;
  const rhp = r.filter((z) => z.re > tol).length;
  if (rhp > 0) return { status: 'unstable', rhp };
  const onAxis = r.filter((z) => Math.abs(z.re) <= tol).length;
  return { status: onAxis ? 'marginal' : 'stable', rhp: 0 };
}

export function stabilityIntervals(
  ol: OpenLoop,
  conds: ColumnCondition[],
  cross: CrossingsResult,
  opts: { numericCheck?: boolean } = {},
): StabilityResult {
  const b: number[] = [];
  for (const c of conds) if (!c.constant) b.push(...positiveRoots(rfNum(c.f)), ...positiveRoots(rfDen(c.f)));
  cross.crossings.forEach((c) => b.push(c.K));
  if (cross.originK !== null) b.push(cross.originK);
  if (ol.n === ol.m) {
    const kd = -ol.Df[ol.n] / ol.Nf[ol.m];
    if (kd > 0) b.push(kd);
  }
  const sorted = b.filter((x) => x > 0 && Number.isFinite(x)).sort((x, y) => x - y);
  const boundaries: number[] = [];
  for (const x of sorted)
    if (!boundaries.length || Math.abs(x - boundaries[boundaries.length - 1]) > 1e-9 * Math.max(1, x)) boundaries.push(x);

  const edges = [0, ...boundaries, Infinity];
  const intervals: ClassifiedInterval[] = [];
  for (let i = 0; i + 1 < edges.length; i++) {
    const lo = edges[i],
      hi = edges[i + 1];
    const testK = hi === Infinity ? (lo === 0 ? 1 : 2 * lo + 1) : lo === 0 ? hi / 2 : Math.sqrt(lo * hi);
    const exactStable = isHurwitzExact(charPolyAt(ol, Q.fromNumber(testK)));
    let st: { status: IntervalStatus; rhp: number };
    if (exactStable) st = { status: 'stable', rhp: 0 };
    else {
      st = numericStatus(ol, testK);
      if (st.status === 'stable') st = { status: 'marginal', rhp: 0 }; // exact test wins
    }
    intervals.push({ lo, hi, testK, ...st });
  }
  const stable: KInterval[] = intervals.filter((iv) => iv.status === 'stable').map(({ lo, hi }) => ({ lo, hi }));

  const numericCheck = opts.numericCheck === false ? { points: 0, mismatches: 0 } : numericCrossCheck(ol, boundaries, stable);
  return {
    boundaries,
    intervals,
    stable,
    marginalEverywhere: intervals.length > 0 && intervals.every((iv) => iv.status === 'marginal'),
    conditionallyStable: stable.length >= 2 || stable.some((iv) => iv.lo > 0 && iv.hi !== Infinity),
    numericCheck,
  };
}

/** Dense numeric scan of K: is "every closed-loop pole has Re < 0" ⇔ "K in an exact stable interval"? */
export function numericCrossCheck(
  ol: Pick<OpenLoop, 'Df' | 'Nf'>,
  boundaries: number[],
  stable: KInterval[],
): { points: number; mismatches: number } {
  const scale = boundaries.length ? boundaries[boundaries.length - 1] : 1;
  let points = 0,
    mismatches = 0;
  for (let e = -5; e <= 3.0001; e += 0.02) {
    const K = scale * Math.pow(10, e);
    if (boundaries.some((x) => Math.abs(K - x) < 1e-5 * Math.max(1, x))) continue;
    const exactIn = stable.some((iv) => K > iv.lo && K < iv.hi);
    const num = numericStatus(ol, K).status === 'stable';
    points++;
    if (exactIn !== num) mismatches++;
  }
  return { points, mismatches };
}

