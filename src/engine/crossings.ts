/**
 * jω-axis crossings of the K > 0 locus, found exactly-then-numerically:
 *   s = jω in D(s) + K N(s) = 0  ⇒  Dr + K Nr = 0 and Di + K Ni = 0
 *   ⇒ W(ω) = Dr·Ni − Di·Nr = 0 (an odd polynomial; W/ω is a polynomial in x = ω²).
 * Every positive real root x gives ω = √x and K = −Dr/Nr (or −Di/Ni); keep K > 0.
 * The ω = 0 case (a real root passing through the origin) is reported separately.
 */
import { cx, type Complex } from './complex';
import { pevalR, pevalC } from './poly';
import { Q, Q0 } from './rational';
import { qdeg, qmul, qsub, qtrim, qToFloat, qeval, type QPoly } from './qpoly';
import { rootsExact, rootsFloat } from './roots';
import { rfEvalF, rfHasEps, rfIsConst, rfLimitSign, rfNum } from './kfunc';
import { positiveRoots, type RouthTable } from './routh';
import type { OpenLoop } from './system';

/** Real and imaginary parts of P(jω) as exact polynomials in ω. */
export function jwParts(p: QPoly): { re: QPoly; im: QPoly } {
  const re: Q[] = [],
    im: Q[] = [];
  p.forEach((c, k) => {
    // j^k = 1, j, −1, −j
    const m = k % 4;
    const sign = m === 0 || m === 1 ? 1 : -1;
    const v = sign > 0 ? c : c.neg();
    if (k % 2 === 0) {
      re[k] = v;
      im[k] = Q0;
    } else {
      im[k] = v;
      re[k] = Q0;
    }
  });
  const fill = (a: Q[]): Q[] => Array.from({ length: a.length }, (_, i) => a[i] ?? Q0);
  return { re: qtrim(fill(re)), im: qtrim(fill(im)) };
}

export interface Crossing {
  K: number;
  omega: number;
  /** Routh row (power) whose first-column entry vanishes at K, if any */
  routhPower: number | null;
  /** auxiliary polynomial (float, LOW → HIGH in s) from the row above, at K = Kx */
  aux: number[] | null;
  auxPower: number | null;
  auxRoots: Complex[] | null;
  /** multiplicity of the jω root pair at this K */
  through: 'crossing' | 'touching';
}
export interface JwAxisSegment {
  /** ω ranges (ω ≥ 0) where the locus lies on the jω axis */
  omegaLo: number;
  omegaHi: number;
}
export interface CrossingsResult {
  crossings: Crossing[];
  /** K at which a closed-loop pole passes through s = 0 (if K > 0) */
  originK: number | null;
  /** W(ω) ≡ 0: the locus contains part of the jω axis */
  jwSegments: JwAxisSegment[];
  /** x-polynomial W(√x)/√x used (float, LOW → HIGH) for display */
  wPoly: number[];
}

export function findCrossings(ol: OpenLoop, routh: RouthTable): CrossingsResult {
  const Dp = jwParts(ol.D),
    Np = jwParts(ol.N);
  const W = qsub(qmul(Dp.re, Np.im), qmul(Dp.im, Np.re));
  const Kat = (w: number): number => {
    const nr = pevalR(qToFloat(Np.re), w),
      ni = pevalR(qToFloat(Np.im), w);
    const dr = pevalR(qToFloat(Dp.re), w),
      di = pevalR(qToFloat(Dp.im), w);
    return Math.abs(nr) >= Math.abs(ni) ? -dr / nr : -di / ni;
  };
  const crossings: Crossing[] = [];
  const jwSegments: JwAxisSegment[] = [];
  let wPoly: number[] = [];
  if (!W.length) {
    // whole jω axis satisfies the angle condition; K(ω) = −Dr/Nr real; keep where K > 0
    const Kr = (w: number): number => Kat(w);
    const cuts = [
      0,
      ...rootsExact(Dp.re).filter((r) => r.z.im === 0 && r.z.re > 0).map((r) => r.z.re),
      ...rootsExact(Np.re).filter((r) => r.z.im === 0 && r.z.re > 0).map((r) => r.z.re),
      Infinity,
    ].sort((a, b) => a - b);
    for (let i = 0; i + 1 < cuts.length; i++) {
      const lo = cuts[i],
        hi = cuts[i + 1];
      const mid = hi === Infinity ? lo + 1 + lo : (lo + hi) / 2;
      if (Kr(mid) > 0) jwSegments.push({ omegaLo: lo, omegaHi: hi });
    }
  } else {
    // W is odd in ω: divide by ω and substitute x = ω²
    const lowIdx = W.findIndex((c) => !c.isZero());
    const odd = W.slice(lowIdx);
    // after dividing by ω^lowIdx, all exponents are even
    const x: Q[] = [];
    odd.forEach((c, k) => {
      if (k % 2 === 0) x[k / 2] = c;
    });
    const xp = qtrim(Array.from({ length: x.length }, (_, i) => x[i] ?? Q0));
    wPoly = qToFloat(xp);
    const xs = qdeg(xp) >= 1 ? rootsExact(xp).filter((r) => r.z.im === 0 && r.z.re > 0) : [];
    for (const r of xs) {
      const omega = Math.sqrt(r.z.re);
      const K = Kat(omega);
      if (!(K > 1e-12 * Math.max(1, Math.abs(K))) || !Number.isFinite(K)) continue;
      // verify: char poly residual at s = jω
      const ch = qToFloat(qtrim(Array.from({ length: Math.max(ol.D.length, ol.N.length) }, (_, k) => (ol.D[k] ?? Q0).add((ol.N[k] ?? Q0).mul(Q.fromNumber(K))))));
      const res = pevalC(ch, cx(0, omega));
      const scale = ch.reduce((s, c, k) => s + Math.abs(c) * Math.pow(omega, k), 0);
      if (Math.hypot(res.re, res.im) > 1e-6 * scale) continue;
      crossings.push({
        K,
        omega,
        routhPower: null,
        aux: null,
        auxPower: null,
        auxRoots: null,
        through: r.mult % 2 === 0 ? 'touching' : 'crossing',
      });
    }
  }
  // ω = 0: a real closed-loop pole at the origin when D(0) + K N(0) = 0
  let originK: number | null = null;
  const d0 = qeval(ol.D, Q0),
    n0 = qeval(ol.N, Q0);
  if (!n0.isZero() && !d0.isZero()) {
    const k0 = d0.neg().div(n0).toNumber();
    if (k0 > 0) originK = k0;
  }
  crossings.sort((a, b) => a.K - b.K);
  linkRouth(crossings, routh);
  return { crossings, originK, jwSegments, wPoly };
}

/** For each crossing find the Routh row that vanishes at Kx and evaluate the auxiliary equation. */
function linkRouth(cr: Crossing[], t: RouthTable): void {
  for (const c of cr) {
    let best: { i: number; err: number; k: number } | null = null;
    t.rows.forEach((r, i) => {
      if (i < 1) return;
      const f0 = r.entries[0].val;
      const f = rfHasEps(f0) ? rfLimitSign(f0) : f0;
      if (rfIsConst(f)) return;
      for (const k of positiveRoots(rfNum(f))) {
        const err = Math.abs(k - c.K) / Math.max(1, c.K);
        if (err < 1e-7 && (!best || err < best.err)) best = { i, err, k };
      }
    });
    if (!best) continue;
    const found = best as { i: number; k: number };
    const i = found.i;
    c.K = found.k; // exact (Routh) value — the ω-method value agrees to < 1e-7
    const above = t.rows[i - 1];
    if (above.entries.some((e) => rfHasEps(e.val))) {
      c.routhPower = t.rows[i].power;
      continue;
    }
    const p = above.power;
    const aux = new Array<number>(p + 1).fill(0);
    above.entries.forEach((e, j) => {
      const pw = p - 2 * j;
      if (pw >= 0) aux[pw] = rfEvalF(e.val, c.K);
    });
    c.routhPower = t.rows[i].power;
    c.aux = aux;
    c.auxPower = p;
    c.auxRoots = rootsFloat(aux);
  }
}
