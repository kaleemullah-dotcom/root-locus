/**
 * Exact polynomials over Q. Coefficients LOW → HIGH, always trimmed
 * (the zero polynomial is []).
 */
import { Q, Q0, Q1 } from './rational';

export type QPoly = readonly Q[];

export function qtrim(p: readonly Q[]): QPoly {
  let k = p.length;
  while (k > 0 && p[k - 1].isZero()) k--;
  return p.slice(0, k);
}
export const qdeg = (p: QPoly): number => (p.length === 0 ? -Infinity : p.length - 1);
export const qIsZero = (p: QPoly): boolean => p.length === 0;
export const qlead = (p: QPoly): Q => (p.length ? p[p.length - 1] : Q0);
export const qconst = (c: Q): QPoly => qtrim([c]);
export const qfromInts = (a: number[]): QPoly => qtrim(a.map((x) => Q.fromNumber(x)));
export const QS: QPoly = [Q0, Q1]; // the polynomial "s"

export function qadd(a: QPoly, b: QPoly): QPoly {
  const n = Math.max(a.length, b.length);
  const r: Q[] = [];
  for (let i = 0; i < n; i++) r.push((a[i] ?? Q0).add(b[i] ?? Q0));
  return qtrim(r);
}
export const qneg = (a: QPoly): QPoly => a.map((x) => x.neg());
export const qsub = (a: QPoly, b: QPoly): QPoly => qadd(a, qneg(b));
export function qscale(a: QPoly, k: Q): QPoly {
  if (k.isZero()) return [];
  return a.map((x) => x.mul(k));
}
export function qmul(a: QPoly, b: QPoly): QPoly {
  if (!a.length || !b.length) return [];
  const r: Q[] = new Array<Q>(a.length + b.length - 1).fill(Q0);
  for (let i = 0; i < a.length; i++) {
    if (a[i].isZero()) continue;
    for (let j = 0; j < b.length; j++) r[i + j] = r[i + j].add(a[i].mul(b[j]));
  }
  return qtrim(r);
}
export function qpow(a: QPoly, k: number): QPoly {
  let r: QPoly = [Q1];
  for (let i = 0; i < k; i++) r = qmul(r, a);
  return r;
}
export function qder(a: QPoly): QPoly {
  const r: Q[] = [];
  for (let i = 1; i < a.length; i++) r.push(a[i].mul(Q.int(i)));
  return qtrim(r);
}
export function qeval(a: QPoly, x: Q): Q {
  let acc = Q0;
  for (let k = a.length - 1; k >= 0; k--) acc = acc.mul(x).add(a[k]);
  return acc;
}
export const qmonic = (a: QPoly): QPoly => (a.length ? qscale(a, qlead(a).inv()) : a);
export const qeq = (a: QPoly, b: QPoly): boolean => a.length === b.length && a.every((x, i) => x.eq(b[i]));

/** Polynomial long division a = q·b + r. */
export function qdivmod(a: QPoly, b: QPoly): { q: QPoly; r: QPoly } {
  if (!b.length) throw new Error('Polynomial division by zero');
  let r: Q[] = a.slice();
  const db = b.length - 1;
  const lb = b[db];
  const q: Q[] = new Array<Q>(Math.max(0, a.length - db)).fill(Q0);
  for (let k = r.length - 1; k >= db; k--) {
    if (r[k].isZero()) continue;
    const c = r[k].div(lb);
    q[k - db] = c;
    for (let j = 0; j <= db; j++) r[k - db + j] = r[k - db + j].sub(c.mul(b[j]));
  }
  r = qtrim(r) as Q[];
  return { q: qtrim(q), r };
}

/** Monic greatest common divisor (gcd(0,0) = 0). */
export function qgcd(a: QPoly, b: QPoly): QPoly {
  let x = qtrim(a),
    y = qtrim(b);
  while (y.length) {
    const r = qdivmod(x, y).r;
    x = y;
    y = qmonic(r);
  }
  return qmonic(x);
}

/** Exact quotient; throws if not divisible. */
export function qdivExact(a: QPoly, b: QPoly): QPoly {
  const { q, r } = qdivmod(a, b);
  if (r.length) throw new Error('qdivExact: not divisible');
  return q;
}

/**
 * Yun's square-free factorisation: a = c · Π f_i^i with each f_i monic and square-free,
 * pairwise coprime. Returns the list of [f_i, i] with deg f_i ≥ 1.
 */
export function squareFree(a: QPoly): Array<{ f: QPoly; mult: number }> {
  const out: Array<{ f: QPoly; mult: number }> = [];
  if (qdeg(a) < 1) return out;
  const p = qmonic(a);
  const dp = qder(p);
  const g = qgcd(p, dp);
  let c = qdivExact(p, g);
  let d = qsub(qdivExact(dp, g), qder(c));
  let i = 1;
  while (qdeg(c) >= 1) {
    const f = qgcd(c, d);
    if (qdeg(f) >= 1) out.push({ f, mult: i });
    c = qdivExact(c, f);
    d = qsub(qdivExact(d, f), qder(c));
    i++;
    if (i > 200) break;
  }
  return out;
}

export const qToFloat = (a: QPoly): number[] => (a.length ? a.map((x) => x.toNumber()) : [0]);

/** Sturm sequence based count of distinct real roots in (lo, hi]; lo/hi may be ±Infinity. */
export function sturmSequence(a: QPoly): QPoly[] {
  const seq: QPoly[] = [a, qder(a)];
  while (qdeg(seq[seq.length - 1]) > 0) {
    const r = qdivmod(seq[seq.length - 2], seq[seq.length - 1]).r;
    if (!r.length) break;
    // normalise by positive scalar to keep numbers small (sign preserved)
    const lead = qlead(r).abs();
    seq.push(qscale(qneg(r), lead.inv()));
  }
  return seq;
}
function signAt(p: QPoly, x: Q | number): number {
  if (typeof x === 'number') {
    // ±Infinity
    if (!p.length) return 0;
    const l = qlead(p).sign();
    const d = p.length - 1;
    return x > 0 ? l : d % 2 === 0 ? l : -l;
  }
  return qeval(p, x).sign();
}
function variations(seq: QPoly[], x: Q | number): number {
  let v = 0,
    last = 0;
  for (const p of seq) {
    const s = signAt(p, x);
    if (s === 0) continue;
    if (last !== 0 && s !== last) v++;
    last = s;
  }
  return v;
}
/** Number of distinct real roots in (lo, hi]. Works for any non-zero polynomial. */
export function countRealRoots(a: QPoly, lo: Q | number = -Infinity, hi: Q | number = Infinity): number {
  if (qdeg(a) < 1) return 0;
  const sf = qdivExact(a, qgcd(a, qder(a))); // square-free part
  if (qdeg(sf) < 1) return 0;
  const seq = sturmSequence(sf);
  return variations(seq, lo) - variations(seq, hi);
}

/** Polynomial with exact rational roots / conjugate pairs. */
export function qFromLinear(root: Q): QPoly {
  return qtrim([root.neg(), Q1]);
}
/** (s − (a+jb))(s − (a−jb)) = s² − 2a s + a² + b² */
export function qFromConjPair(a: Q, b: Q): QPoly {
  return qtrim([a.mul(a).add(b.mul(b)), a.mul(Q.int(-2)), Q1]);
}
