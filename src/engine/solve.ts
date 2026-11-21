/** Top-level solver: input → complete R1–R7 solution + traced locus. */
import { cx, type Complex } from './complex';
import { findCrossings, type CrossingsResult } from './crossings';
import { trackLocus, type Locus } from './locus';
import {
  columnConditions,
  buildRouth,
  type ColumnCondition,
  type RouthTable,
} from './routh';
import {
  ruleR1,
  ruleR2,
  ruleR3,
  ruleR4,
  ruleR5,
  ruleR6,
  type R1,
  type R2,
  type R3,
  type R4,
  type R5,
  type R6,
} from './rules';
import { stabilityIntervals, type OpenLoopLite, type StabilityResult } from './stability';
import { makeOpenLoop, type OpenLoop } from './system';
import { buildTF, type TFInput, type TransferFunction } from './tf';
import { autoView, featureBox, type ViewBox } from './view';
import { qneg, qToFloat } from './qpoly';

export interface Solution {
  input: TFInput;
  tf: TransferFunction;
  ol: OpenLoop;
  r1: R1;
  r2: R2;
  r3: R3;
  r4: R4;
  r5: R5;
  r6: R6;
  routh: RouthTable;
  conds: ColumnCondition[];
  cross: CrossingsResult;
  stab: StabilityResult;
  /** important points for the automatic view */
  features: Complex[];
  view: ViewBox;
  locus: Locus;
  /** complementary (K < 0) locus — computed on demand */
  locusNeg: Locus | null;
}

export interface SolveOptions {
  /** plot aspect (width / height) used to pick the view and the tracking span */
  aspect?: number;
  complementary?: boolean;
  /** false: skip locus tracking + numeric scan (the UI runs them in a Web Worker) */
  heavy?: boolean;
}

/** Placeholder locus: just the open-loop poles (K = 0). */
export function emptyLocus(ol: OpenLoop): Locus {
  return { Ks: [0], branches: ol.poles.map((p) => [p]), Kmax: 1, sign: 1 };
}

/** Plain-data job for the locus worker. */
export interface LocusJob {
  ol: OpenLoopLite;
  view: ViewBox;
  mandatory: number[];
  /** |K| values to sample exactly on the K < 0 locus */
  mandatoryNeg?: number[];
  boundaries: number[];
  stable: { lo: number; hi: number }[];
}
export function locusJob(sol: Solution, view: ViewBox = sol.view): LocusJob {
  const { Df, Nf, n, m, q, poles, zeros } = sol.ol;
  return {
    ol: { Df, Nf, n, m, q, poles, zeros },
    view,
    mandatory: [...sol.r5.accepted.map((c) => c.K.re), ...sol.cross.crossings.map((c) => c.K)],
    boundaries: sol.stab.boundaries,
    stable: sol.stab.stable,
  };
}

export function solveTF(input: TFInput, opts: SolveOptions = {}): Solution {
  return solveFromTF(input, buildTF(input), opts);
}

/**
 * The K < 0 (complementary) locus solved with the same 7-rule pipeline: K·N/D with K < 0 is
 * K'·(−N)/D with K' = −K > 0, i.e. a 0° locus. Gains reported by the result are K' (> 0);
 * the UI shows them as K = −K'.
 */
export function solveNegative(sol: Solution): Solution {
  const tf = { ...sol.tf, N: qneg(sol.tf.N), warnings: [] };
  return solveFromTF(sol.input, tf, { heavy: false });
}

/** Common view containing the features of both the K > 0 and K < 0 solutions. */
export function combinedView(a: Solution, b: Solution | null, aspect = 1.45): ViewBox {
  if (!b) return a.view;
  const leftExtra = [...a.r2.segments, ...b.r2.segments].some((s) => s.b === -Infinity);
  return autoView(featureBox([...a.features, ...b.features]), aspect, { leftExtra });
}

export function solveFromTF(input: TFInput, tf: TransferFunction, opts: SolveOptions = {}): Solution {
  const ol = makeOpenLoop(tf.N, tf.D);
  const r1 = ruleR1(ol);
  const r5 = ruleR5(ol);
  const realBreaks = r5.accepted.filter((c) => c.s.im === 0).map((c) => c.s.re);
  const r2 = ruleR2(ol, r5.P, realBreaks);
  const r3 = ruleR3(ol);
  const r4 = ruleR4(ol, r3);
  const r6 = ruleR6(ol);
  const routh = buildRouth(ol);
  const conds = columnConditions(routh);
  const cross = findCrossings(ol, routh);
  const heavy = opts.heavy !== false;
  const stab = stabilityIntervals(ol, conds, cross, { numericCheck: heavy });

  const features: Complex[] = [...ol.poles, ...ol.zeros, cx(0)];
  r5.accepted.forEach((c) => features.push(c.s));
  cross.crossings.forEach((c) => features.push(cx(0, c.omega), cx(0, -c.omega)));
  if (r4.sigma !== null && ol.q >= 2) features.push(cx(r4.sigma));
  if (r4.tan && r4.tan.p < 1e6) features.push(cx(0, r4.tan.p * 0.6));
  const aspect = opts.aspect ?? 1.45;
  const box = featureBox(features);
  const leftExtra = r2.segments.some((s) => s.b === -Infinity);
  const view = autoView(box, aspect, { leftExtra });
  const mandatory = [...r5.accepted.map((c) => c.K.re), ...cross.crossings.map((c) => c.K)];
  const locus = heavy ? trackLocus(ol, { view, mandatory }) : emptyLocus(ol);
  const locusNeg = heavy && opts.complementary ? trackLocus(ol, { view, sign: -1 }) : null;
  return { input, tf, ol, r1, r2, r3, r4, r5, r6, routh, conds, cross, stab, features, view, locus, locusNeg };
}

/** JSON-friendly numeric summary (used by the Python cross-check and tests). */
export function summarize(sol: Solution): Record<string, unknown> {
  const c = (z: Complex): [number, number] => [z.re, z.im];
  return {
    N: qToFloat(sol.ol.N),
    D: qToFloat(sol.ol.D),
    n: sol.ol.n,
    m: sol.ol.m,
    is180: sol.ol.is180,
    poles: sol.ol.poles.map(c),
    zeros: sol.ol.zeros.map(c),
    asymptotes: sol.r3.angles.map((a) => a.deg),
    centroid: sol.r4.sigma,
    breakpoints: sol.r5.accepted.map((b) => ({ s: c(b.s), K: b.K.re, kind: b.kind })),
    departures: sol.r6.departures.map((d) => ({ at: c(d.at), angles: d.angles })),
    arrivals: sol.r6.arrivals.map((d) => ({ at: c(d.at), angles: d.angles })),
    crossings: sol.cross.crossings.map((x) => ({ K: x.K, omega: x.omega })),
    originK: sol.cross.originK,
    stable: sol.stab.stable.map((iv) => [iv.lo, iv.hi === Infinity ? null : iv.hi]),
    numericCheck: sol.stab.numericCheck,
  };
}
