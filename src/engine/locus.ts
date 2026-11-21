/**
 * Root-locus branch tracking with an adaptive step in u = ln K and optimal (Hungarian) matching.
 */
import { cabs, csub, cx, type Complex } from './complex';
import { hungarian } from './hungarian';
import { closedLoopPoles } from './stability';
import type { OpenLoopLite } from './stability';
import { viewCenter, viewSpan, type ViewBox } from './view';

export interface Locus {
  /** K for every sample (index shared by all branches); negative for the complementary locus */
  Ks: number[];
  /** branches[b][k] = closed-loop pole of branch b at Ks[k] (NaN when at infinity) */
  branches: Complex[][];
  Kmax: number;
  sign: 1 | -1;
}

const NAN_C = cx(NaN, NaN);
const finite = (z: Complex): boolean => Number.isFinite(z.re) && Number.isFinite(z.im);

/** Match `cur` roots to the previous ones (optionally predicted) minimising Σ|Δ|². */
export function matchRoots(prev: Complex[], pred: Complex[], cur: Complex[]): Complex[] {
  const n = prev.length;
  const padded = cur.slice(0, n);
  while (padded.length < n) padded.push(NAN_C);
  const cost = pred.map((p) =>
    padded.map((c) => {
      if (!finite(c)) return finite(p) ? 1e12 / (1 + cabs(p) ** 2) : 0; // a vanishing root: pick the largest
      if (!finite(p)) return 1e12; // re-entering from infinity
      const d = csub(p, c);
      return d.re * d.re + d.im * d.im;
    }),
  );
  const a = hungarian(cost);
  return a.map((j) => padded[j]);
}

/** Largest displacement among roots that are (at either end) inside the region of interest. */
function maxMove(a: Complex[], b: Complex[], center?: Complex, radius = Infinity): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    if (!finite(a[i]) || !finite(b[i])) continue;
    if (center && cabs(csub(a[i], center)) > radius && cabs(csub(b[i], center)) > radius) continue;
    m = Math.max(m, cabs(csub(a[i], b[i])));
  }
  return m;
}
function minSep(a: Complex[]): number {
  let m = Infinity;
  for (let i = 0; i < a.length; i++)
    for (let j = i + 1; j < a.length; j++) if (finite(a[i]) && finite(a[j])) m = Math.min(m, cabs(csub(a[i], a[j])));
  return m;
}

export interface TrackOptions {
  view: ViewBox;
  /** K values that must be sampled exactly (breakaway, crossings) — positive magnitudes */
  mandatory?: number[];
  sign?: 1 | -1;
  maxPoints?: number;
}

export function trackLocus(ol: OpenLoopLite, opts: TrackOptions): Locus {
  const sign = opts.sign ?? 1;
  const span = viewSpan(opts.view);
  const center = viewCenter(opts.view);
  const n = ol.n;
  const rootsAt = (k: number): Complex[] => closedLoopPoles(ol, sign * k);
  const start = ol.poles.slice();
  // ---- starting K: displacement from the poles below 1e-3 of the view span
  let k0 = 1;
  for (let it = 0; it < 80; it++) {
    const r = matchRoots(start, start, rootsAt(k0));
    if (maxMove(start, r) < 1e-3 * span) break;
    k0 /= 10;
  }
  // ---- final K: asymptotic branches far outside, other branches settled on their zeros
  const zeros = ol.zeros;
  const done = (r: Complex[]): boolean => {
    const far = r.filter((z) => !finite(z) || cabs(csub(z, center)) > 3 * span).length;
    if (far < ol.q) return false;
    const near = r.filter((z) => finite(z) && cabs(csub(z, center)) <= 3 * span);
    return near.every((z) => zeros.some((w) => cabs(csub(z, w)) < 2e-3 * span));
  };
  let k1 = Math.max(k0 * 10, 1);
  for (let it = 0; it < 200 && !done(rootsAt(k1)); it++) k1 *= 2;
  k1 *= 1.5;
  const mand = (opts.mandatory ?? []).filter((k) => k > k0 && k < k1).sort((a, b) => a - b);

  const Ks: number[] = [0];
  const rows: Complex[][] = [start];
  let prev = matchRoots(start, start, rootsAt(k0));
  Ks.push(k0);
  rows.push(prev);
  let u = Math.log(k0);
  const uEnd = Math.log(k1);
  const duMax = (uEnd - u) / 150;
  const duMin = 1e-7;
  let du = duMax / 4;
  let mi = 0;
  const maxPts = opts.maxPoints ?? 12000;
  while (u < uEnd && Ks.length < maxPts) {
    let uNext = Math.min(u + du, uEnd);
    let hitMand = false;
    if (mi < mand.length && uNext >= Math.log(mand[mi])) {
      uNext = Math.log(mand[mi]);
      hitMand = true;
    }
    const kNext = Math.exp(uNext);
    const pp = rows.length >= 2 ? rows[rows.length - 2] : prev;
    const ratio = Ks.length >= 2 && Ks[Ks.length - 1] !== Ks[Ks.length - 2] ? (kNext - Ks[Ks.length - 1]) / (Ks[Ks.length - 1] - Ks[Ks.length - 2]) : 0;
    const pred = prev.map((z, i) =>
      finite(z) && finite(pp[i]) && ratio > 0 && ratio < 4 ? cx(z.re + (z.re - pp[i].re) * ratio, z.im + (z.im - pp[i].im) * ratio) : z,
    );
    const cur = matchRoots(prev, pred, rootsAt(kNext));
    const mv = maxMove(prev, cur, center, 2.5 * span);
    const sep = Math.min(minSep(prev), minSep(cur));
    // near a double root (break point) the separation → 0; only enforce it while roots are clearly apart
    const tooFar = mv > 0.012 * span || (sep > 2e-3 * span && mv > 0.4 * sep);
    // (compare with a margin: uNext − u can exceed duMin by rounding, which used to loop forever)
    if (tooFar && uNext - u > duMin * 1.5) {
      du = Math.max((uNext - u) / 2, duMin);
      continue;
    }
    u = uNext;
    if (hitMand) mi++;
    Ks.push(kNext);
    rows.push(cur);
    prev = cur;
    if (mv < 0.003 * span) du = Math.min(du * 1.6, duMax);
  }
  const branches: Complex[][] = Array.from({ length: n }, (_, b) => rows.map((r) => r[b]));
  return { Ks: Ks.map((k) => sign * k), branches, Kmax: k1, sign };
}
