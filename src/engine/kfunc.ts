/**
 * Exact rational functions in the gain K and (optionally) the Routh ε.
 *
 * A BiPoly is a polynomial in ε whose coefficients are polynomials in K over Q:
 *   b[e] = coefficient (a QPoly in K) of ε^e.
 * An RF is n/d with BiPoly numerator and denominator.
 */
import { Q, Q1 } from './rational';
import {
  qadd,
  qdeg,
  qdivExact,
  qeval,
  qgcd,
  qlead,
  qmul,
  qscale,
  qsub,
  qtrim,
  type QPoly,
} from './qpoly';

export type BiPoly = readonly QPoly[];
export interface RF {
  n: BiPoly;
  d: BiPoly;
}

const bTrim = (b: readonly QPoly[]): BiPoly => {
  let k = b.length;
  while (k > 0 && b[k - 1].length === 0) k--;
  return b.slice(0, k);
};
export const bIsZero = (b: BiPoly): boolean => bTrim(b).length === 0;
function bAdd(a: BiPoly, b: BiPoly, sub = false): BiPoly {
  const r: QPoly[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? [],
      y = b[i] ?? [];
    r.push(sub ? qsub(x, y) : qadd(x, y));
  }
  return bTrim(r);
}
function bMul(a: BiPoly, b: BiPoly): BiPoly {
  if (!a.length || !b.length) return [];
  const r: QPoly[] = Array.from({ length: a.length + b.length - 1 }, () => []);
  for (let i = 0; i < a.length; i++) {
    if (!a[i].length) continue;
    for (let j = 0; j < b.length; j++) if (b[j].length) r[i + j] = qadd(r[i + j], qmul(a[i], b[j]));
  }
  return bTrim(r);
}
const bScale = (a: BiPoly, k: Q): BiPoly => bTrim(a.map((p) => qscale(p, k)));
const bLow = (a: BiPoly): number => a.findIndex((p) => p.length > 0);
const bShift = (a: BiPoly, k: number): BiPoly => a.slice(k);

export const RF0: RF = { n: [], d: [[Q1]] };
export const rfConst = (c: Q): RF => (c.isZero() ? RF0 : { n: [[c]], d: [[Q1]] });
/** K-polynomial → RF */
export const rfK = (p: QPoly): RF => (qtrim(p).length ? { n: [qtrim(p)], d: [[Q1]] } : RF0);
/** the symbol ε */
export const rfEps: RF = { n: [[], [Q1]], d: [[Q1]] };

export function rfReduce(f: RF): RF {
  let n = bTrim(f.n),
    d = bTrim(f.d);
  if (!n.length) return RF0;
  if (!d.length) throw new Error('RF with zero denominator');
  // common power of ε
  const lo = Math.min(bLow(n), bLow(d));
  if (lo > 0) {
    n = bShift(n, lo);
    d = bShift(d, lo);
  }
  if (n.length === 1 && d.length === 1) {
    const g = qgcd(n[0], d[0]);
    let nn = qdeg(g) >= 1 ? qdivExact(n[0], g) : n[0];
    let dd = qdeg(g) >= 1 ? qdivExact(d[0], g) : d[0];
    const l = qlead(dd).inv();
    nn = qscale(nn, l);
    dd = qscale(dd, l);
    return { n: [nn], d: [dd] };
  }
  // content gcd over all K-coefficients
  let g: QPoly = [];
  for (const p of [...n, ...d]) if (p.length) g = g.length ? qgcd(g, p) : qscale(p, qlead(p).inv());
  if (qdeg(g) >= 1) {
    n = n.map((p) => (p.length ? qdivExact(p, g) : p));
    d = d.map((p) => (p.length ? qdivExact(p, g) : p));
  }
  const dl = d[bLow(d)];
  const s = qlead(dl).inv();
  return { n: bScale(n, s), d: bScale(d, s) };
}

export const rfAdd = (a: RF, b: RF): RF => rfReduce({ n: bAdd(bMul(a.n, b.d), bMul(b.n, a.d)), d: bMul(a.d, b.d) });
export const rfSub = (a: RF, b: RF): RF =>
  rfReduce({ n: bAdd(bMul(a.n, b.d), bMul(b.n, a.d), true), d: bMul(a.d, b.d) });
export const rfMul = (a: RF, b: RF): RF => rfReduce({ n: bMul(a.n, b.n), d: bMul(a.d, b.d) });
export function rfDiv(a: RF, b: RF): RF {
  if (rfIsZero(b)) throw new Error('RF division by zero');
  return rfReduce({ n: bMul(a.n, b.d), d: bMul(a.d, b.n) });
}
export const rfScale = (a: RF, k: Q): RF => rfReduce({ n: bScale(a.n, k), d: a.d });
export const rfIsZero = (a: RF): boolean => bIsZero(a.n);
export const rfHasEps = (a: RF): boolean => a.n.length > 1 || a.d.length > 1;
/** ε-free and K-free */
export const rfIsConst = (a: RF): boolean =>
  rfIsZero(a) || (!rfHasEps(a) && qdeg(a.n[0]) <= 0 && qdeg(a.d[0]) <= 0);
export const rfConstValue = (a: RF): Q => (rfIsZero(a) ? Q.ZERO : a.n[0][0].div(a.d[0][0]));

/** ε-free numerator / denominator (only valid when !rfHasEps). */
export const rfNum = (a: RF): QPoly => (rfIsZero(a) ? [] : a.n[0]);
export const rfDen = (a: RF): QPoly => a.d[0];

/**
 * Sign-equivalent ε-free function as ε → 0⁺: keep the lowest-order ε term of numerator
 * and denominator. The result has the same sign as `a` for small positive ε.
 */
export function rfLimitSign(a: RF): RF {
  if (rfIsZero(a)) return RF0;
  const n = a.n[bLow(a.n)],
    d = a.d[bLow(a.d)];
  return rfReduce({ n: [n], d: [d] });
}
/** Power of ε in the leading behaviour of a (num low − den low). */
export function rfEpsOrder(a: RF): number {
  if (rfIsZero(a)) return 0;
  return bLow(a.n) - bLow(a.d);
}

/** Evaluate an ε-free RF at an exact K. */
export function rfEvalQ(a: RF, K: Q): Q {
  if (rfIsZero(a)) return Q.ZERO;
  const den = qeval(a.d[0], K);
  if (den.isZero()) throw new Error('pole of RF');
  return qeval(a.n[0], K).div(den);
}
/** Evaluate an ε-free RF at a float K. */
export function rfEvalF(a: RF, K: number): number {
  if (rfIsZero(a)) return 0;
  const ev = (p: QPoly): number => {
    let acc = 0;
    for (let k = p.length - 1; k >= 0; k--) acc = acc * K + p[k].toNumber();
    return acc;
  };
  return ev(a.n[0]) / ev(a.d[0]);
}
