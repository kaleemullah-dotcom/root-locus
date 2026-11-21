/**
 * Rules R1–R6 of the 7-rule root-locus method (R7 lives in routh.ts / crossings.ts).
 * All quantities are computed from exact polynomials where possible.
 */
import { cabs, cdiv, cneg, cx, csub, cargDeg, type Complex } from './complex';
import { pevalC, pevalR } from './poly';
import { Q, Q0 } from './rational';
import {
  qder,
  qdeg,
  qdivExact,
  qgcd,
  qmul,
  qsub,
  qToFloat,
  qlead,
  type QPoly,
} from './qpoly';
import { rootsExact, expandRoots } from './roots';
import type { OpenLoop } from './system';

// ---------------------------------------------------------------- helpers
/** Wrap an angle in degrees to (−180, 180]. */
export function wrap180(a: number): number {
  let r = ((((a + 180) % 360) + 360) % 360) - 180;
  if (r <= -180 + 1e-12) r = 180;
  if (Math.abs(r) < 1e-12) r = 0;
  return r;
}
/** Angle in [0, 360) of the vector from `from` to `to`. */
export function angle360(from: Complex, to: Complex): number {
  const a = cargDeg(csub(to, from));
  const r = a < 0 ? a + 360 : a;
  return Math.abs(r - 360) < 1e-12 ? 0 : r;
}
const relTol = (x: number, t = 1e-9): number => t * Math.max(1, Math.abs(x));

// ---------------------------------------------------------------- R1
export interface R1 {
  n: number;
  m: number;
  branches: number;
  toInfinity: number;
}
export function ruleR1(ol: OpenLoop): R1 {
  return { n: ol.n, m: ol.m, branches: Math.max(ol.n, ol.m), toInfinity: ol.q };
}

// ---------------------------------------------------------------- R2
export interface R2Test {
  /** right end (may be +Infinity) */
  a: number;
  /** left end (may be −Infinity) */
  b: number;
  countRight: number;
  on: boolean;
}
export type EndKind = 'pole' | 'zero' | 'inf' | 'pz';
export interface R2Segment {
  a: number;
  b: number;
  aKind: EndKind;
  bKind: EndKind;
  /** sub-pieces split at break points, with direction of increasing K (+1 → rightwards) */
  pieces: Array<{ a: number; b: number; dir: 1 | -1 }>;
}
export interface R2 {
  tests: R2Test[];
  segments: R2Segment[];
  /** distinct real critical points, descending */
  crit: number[];
  hasComplex: boolean;
}

export function realPZ(ol: OpenLoop): Array<{ x: number; t: 'P' | 'Z' }> {
  return [
    ...ol.poles.filter((z) => z.im === 0).map((z) => ({ x: z.re, t: 'P' as const })),
    ...ol.zeros.filter((z) => z.im === 0).map((z) => ({ x: z.re, t: 'Z' as const })),
  ];
}

/** Is the real point x on the K>0 locus by the counting rule? (x must not be a pole/zero) */
export function onRealLocus(ol: OpenLoop, x: number): boolean {
  const cnt = realPZ(ol).filter((o) => o.x > x).length;
  return ol.is180 ? cnt % 2 === 1 : cnt % 2 === 0;
}

export function ruleR2(ol: OpenLoop, P: QPoly, breakX: number[]): R2 {
  const pz = realPZ(ol);
  const crit = [...new Set(pz.map((o) => o.x))].sort((u, v) => v - u);
  const tests: R2Test[] = [];
  const bounds = [Infinity, ...crit, -Infinity];
  for (let k = 0; k + 1 < bounds.length; k++) {
    const a = bounds[k],
      b = bounds[k + 1];
    if (a === Infinity && b === -Infinity) {
      // no real poles/zeros at all
      tests.push({ a, b, countRight: 0, on: !ol.is180 });
      continue;
    }
    const mid = a === Infinity ? b + 1 : b === -Infinity ? a - 1 : (a + b) / 2;
    const cnt = pz.filter((o) => o.x > mid).length;
    const on = ol.is180 ? cnt % 2 === 1 : cnt % 2 === 0;
    tests.push({ a, b, countRight: cnt, on });
  }
  const kindAt = (x: number): EndKind => {
    if (!Number.isFinite(x)) return 'inf';
    const p = pz.some((o) => o.t === 'P' && o.x === x),
      z = pz.some((o) => o.t === 'Z' && o.x === x);
    return p && z ? 'pz' : p ? 'pole' : 'zero';
  };
  const Pf = qToFloat(P);
  // direction of increasing K: dK/dσ = −P(σ)/N(σ)²  → sign(−P)
  const dirAt = (x: number): 1 | -1 => {
    const v = -pevalR(Pf, x);
    return v >= 0 ? 1 : -1;
  };
  const segments: R2Segment[] = [];
  for (const t of tests) {
    if (!t.on) continue;
    const inside = breakX.filter((x) => x < t.a - relTol(x, 1e-9) && x > t.b + relTol(x, 1e-9)).sort((u, v) => v - u);
    const cuts = [t.a, ...inside, t.b];
    const pieces: R2Segment['pieces'] = [];
    for (let k = 0; k + 1 < cuts.length; k++) {
      const pa = cuts[k],
        pb = cuts[k + 1];
      const span = Number.isFinite(pa) && Number.isFinite(pb) ? pa - pb : 1;
      const mid =
        pa === Infinity ? pb + Math.max(1, Math.abs(pb)) : pb === -Infinity ? pa - Math.max(1, Math.abs(pa)) : pb + span / 2;
      pieces.push({ a: pa, b: pb, dir: dirAt(mid) });
    }
    segments.push({ a: t.a, b: t.b, aKind: kindAt(t.a), bKind: kindAt(t.b), pieces });
  }
  const hasComplex = [...ol.poles, ...ol.zeros].some((z) => z.im !== 0);
  return { tests, segments, crit, hasComplex };
}

// ---------------------------------------------------------------- R3 / R4
export interface R3 {
  q: number;
  /** i value and raw/normalised angle, in teacher order i = 0, 1, −1, 2, −2 … */
  angles: Array<{ i: number; raw: number; deg: number }>;
}
export function ruleR3(ol: OpenLoop): R3 {
  const q = ol.q;
  const angles: R3['angles'] = [];
  if (q <= 0) return { q, angles };
  const seen = new Set<string>();
  const base = ol.is180 ? 180 : 0;
  for (let k = 0; angles.length < q && k < 4 * q + 4; k++) {
    const i = k === 0 ? 0 : k % 2 === 1 ? (k + 1) / 2 : -k / 2;
    const raw = (base + 360 * i) / q;
    const deg = wrap180(raw);
    const key = deg.toFixed(9);
    if (seen.has(key)) continue;
    seen.add(key);
    angles.push({ i, raw, deg });
  }
  return { q, angles };
}

export interface R4 {
  sumPoles: number;
  sumZeros: number;
  /** exact rational centroid as a float, or null when n = m */
  sigma: number | null;
  sigmaExact: string | null;
  /** teacher's tan-rule: asymptote crosses the jω axis at ±j·p */
  tan: { theta: number; p: number } | null;
}
export function ruleR4(ol: OpenLoop, r3: R3): R4 {
  // Σ roots = −a_{n−1}/a_n (exact)
  const sumRoots = (p: QPoly): Q => (qdeg(p) >= 1 ? (p[p.length - 2] ?? Q0).neg().div(qlead(p)) : Q0);
  const sp = sumRoots(ol.D),
    sz = sumRoots(ol.N);
  if (ol.q <= 0) return { sumPoles: sp.toNumber(), sumZeros: sz.toNumber(), sigma: null, sigmaExact: null, tan: null };
  const sig = sp.sub(sz).div(Q.int(ol.q));
  const sigma = sig.toNumber();
  let tan: R4['tan'] = null;
  const pos = r3.angles.map((a) => a.deg).filter((a) => a > 1e-9 && a < 90 - 1e-9).sort((u, v) => u - v);
  if (sigma < 0 && pos.length) tan = { theta: pos[0], p: Math.abs(sigma) * Math.tan((pos[0] * Math.PI) / 180) };
  else if (sigma > 0) {
    const neg = r3.angles.map((a) => a.deg).filter((a) => a > 90 + 1e-9 && a < 180 - 1e-9).sort((u, v) => u - v);
    if (neg.length) tan = { theta: neg[0], p: Math.abs(sigma * Math.tan((neg[0] * Math.PI) / 180)) };
  }
  return { sumPoles: sp.toNumber(), sumZeros: sz.toNumber(), sigma, sigmaExact: sig.toString(), tan };
}

// ---------------------------------------------------------------- R5
export type BreakKind = 'breakaway' | 'entry' | 'saddle' | 'complex';
export interface BreakCandidate {
  s: Complex;
  mult: number;
  /** K = −D/N at s (complex in general) */
  K: Complex;
  ok: boolean;
  why: string;
  kind: BreakKind | null;
  /** number of branches meeting (mult + 1) */
  branches: number;
  /** angle between the branches leaving / arriving, 180°/branches */
  breakAngle: number;
}
export interface R5 {
  P: QPoly;
  /** roots of P that coincide with multiple poles / zeros (removed before testing) */
  removed: Array<{ s: Complex; at: 'pole' | 'zero' }>;
  candidates: BreakCandidate[];
  accepted: BreakCandidate[];
}

export function breakPolynomial(ol: OpenLoop): QPoly {
  return qsub(qmul(ol.N, qder(ol.D)), qmul(qder(ol.N), ol.D));
}

export function ruleR5(ol: OpenLoop): R5 {
  const P = breakPolynomial(ol);
  const removed: R5['removed'] = [];
  let red = P;
  // remove factors shared with D (multiple poles) and N (multiple zeros)
  for (const [poly, at] of [
    [ol.D, 'pole'],
    [ol.N, 'zero'],
  ] as const) {
    for (let guard = 0; guard < 50 && qdeg(red) >= 1; guard++) {
      const g = qgcd(red, poly);
      if (qdeg(g) < 1) break;
      expandRoots(rootsExact(g)).forEach((s) => removed.push({ s, at }));
      red = qdivExact(red, g);
    }
  }
  const dPf = qToFloat(qder(P));
  const Kof = (s: Complex): Complex => cneg(cdiv(pevalC(ol.Df, s), pevalC(ol.Nf, s)));
  const KofR = (x: number): number => -pevalR(ol.Df, x) / pevalR(ol.Nf, x);
  const candidates: BreakCandidate[] = [];
  if (qdeg(red) >= 1) {
    for (const r of rootsExact(red)) {
      const s = r.z;
      const K = Kof(s);
      const branches = r.mult + 1;
      const c: BreakCandidate = {
        s,
        mult: r.mult,
        K,
        ok: false,
        why: '',
        kind: null,
        branches,
        breakAngle: 180 / branches,
      };
      if (s.im === 0) {
        const k = K.re;
        if (!(k > relTol(k, 1e-12))) {
          c.why = !onRealLocus(ol, s.re)
            ? `not on a real-axis segment (K = −D/N = ${fmt(k)} < 0)`
            : `gives K = −D/N = ${fmt(k)} ≤ 0`;
        } else {
          c.ok = true;
          if (r.mult === 1) {
            const d = pevalR(dPf, s.re);
            // K'' = −P'/N²  → P' > 0 ⇒ local max of K ⇒ breakaway
            c.kind = d > 0 ? 'breakaway' : 'entry';
          } else {
            const h = 1e-3 * Math.max(1e-3, Math.abs(s.re) || 1);
            const k0 = KofR(s.re),
              kl = KofR(s.re - h),
              kr = KofR(s.re + h);
            c.kind = k0 >= kl && k0 >= kr ? 'breakaway' : k0 <= kl && k0 <= kr ? 'entry' : 'saddle';
          }
        }
      } else {
        const isReal = Math.abs(K.im) <= 1e-7 * Math.max(1, cabs(K));
        if (isReal && K.re > 0) {
          c.ok = true;
          c.kind = 'complex';
          c.K = cx(K.re, 0);
        } else if (isReal) c.why = `complex root with K = ${fmt(K.re)} ≤ 0`;
        else c.why = `complex root, K = −D/N is complex (${fmt(K.re)} ${K.im < 0 ? '−' : '+'} j${fmt(Math.abs(K.im))})`;
      }
      candidates.push(c);
    }
  }
  return { P, removed, candidates, accepted: candidates.filter((c) => c.ok) };
}

function fmt(x: number): string {
  const v = Math.abs(x) < 5e-4 ? 0 : x;
  return (Math.round(v * 1000) / 1000).toString().replace('-', '−');
}

// ---------------------------------------------------------------- R6
export interface AngleTerm {
  from: Complex;
  angle: number;
  mult: number;
}
export interface DepartureAngle {
  at: Complex;
  kind: 'departure' | 'arrival';
  mult: number;
  poleTerms: AngleTerm[];
  zeroTerms: AngleTerm[];
  sumPoles: number;
  sumZeros: number;
  /** raw value of the teacher formula before wrapping (for l = 0) */
  raw: number;
  /** all branch angles (one per multiplicity), wrapped to (−180, 180] */
  angles: number[];
}
export interface R6 {
  departures: DepartureAngle[];
  arrivals: DepartureAngle[];
}

export function ruleR6(ol: OpenLoop): R6 {
  const base = ol.is180 ? 180 : 0;
  const compute = (at: Complex, mult: number, kind: 'departure' | 'arrival'): DepartureAngle => {
    const same = (z: Complex): boolean => z.re === at.re && z.im === at.im;
    const terms = (list: { z: Complex; mult: number }[], skipSelf: boolean): AngleTerm[] =>
      list.filter((r) => !(skipSelf && same(r.z))).map((r) => ({ from: r.z, angle: angle360(r.z, at), mult: r.mult }));
    const poleTerms = terms(ol.polesM, kind === 'departure');
    const zeroTerms = terms(ol.zerosM, kind === 'arrival');
    const sum = (t: AngleTerm[]): number => t.reduce((s, o) => s + o.angle * o.mult, 0);
    const SP = sum(poleTerms),
      SZ = sum(zeroTerms);
    const raw = kind === 'departure' ? -SP + SZ + base : -SZ + SP - base;
    const angles: number[] = [];
    for (let l = 0; l < mult; l++) angles.push(wrap180((raw + 360 * l) / mult));
    return { at, kind, mult, poleTerms, zeroTerms, sumPoles: SP, sumZeros: SZ, raw, angles };
  };
  const pick = (list: OpenLoop['polesM']): OpenLoop['polesM'] => list.filter((r) => r.z.im > 0 || (r.z.im === 0 && r.mult > 1));
  return {
    departures: pick(ol.polesM).map((r) => compute(r.z, r.mult, 'departure')),
    arrivals: pick(ol.zerosM).map((r) => compute(r.z, r.mult, 'arrival')),
  };
}
