/**
 * Polynomial root finding.
 *  - rootsFloat: Aberth–Ehrlich simultaneous iteration + Newton polish, conjugate symmetry.
 *  - rootsExact: exact square-free split over Q (true multiplicities), exact rational roots,
 *    closed-form quadratics, Sturm-certified real-root counts for higher factors.
 */
import { cabs, cdiv, cmul, csub, cx, type Complex } from './complex';
import { pder, pevalC, ptrim, type Poly } from './poly';
import { Q } from './rational';
import {
  countRealRoots,
  qdeg,
  qdivExact,
  qeval,
  qFromLinear,
  qToFloat,
  squareFree,
  type QPoly,
} from './qpoly';

export interface RootM {
  z: Complex;
  mult: number;
  /** Present when the root is an exact rational real number. */
  exact?: Q;
}

function quadRoots(c0: number, c1: number, c2: number): Complex[] {
  const d = c1 * c1 - 4 * c2 * c0;
  if (d >= 0) {
    const sq = Math.sqrt(d);
    // numerically stable form
    const qv = -0.5 * (c1 + (c1 >= 0 ? sq : -sq));
    if (qv === 0) return [cx(0), cx(0)];
    return [cx(qv / c2), cx(c0 / qv)];
  }
  const re = -c1 / (2 * c2);
  const im = Math.sqrt(-d) / (2 * Math.abs(c2));
  return [cx(re, im), cx(re, -im)];
}

/** Aberth–Ehrlich on a polynomial with non-zero constant and leading coefficients. */
function aberth(p: Poly): Complex[] {
  const n = p.length - 1;
  const lead = p[n];
  const a = p.map((x) => x / lead);
  const da = pder(a);
  // Fujiwara-type bound for the initial circle, plus a lower bound for tiny roots.
  let upper = 0;
  for (let k = 0; k < n; k++) upper = Math.max(upper, Math.pow(Math.abs(a[k]), 1 / (n - k)));
  upper *= 2;
  let lower = Infinity;
  const a0 = Math.abs(a[0]);
  for (let k = 1; k <= n; k++) if (a[k] !== 0) lower = Math.min(lower, Math.pow(a0 / Math.abs(a[k]), 1 / k));
  lower = Number.isFinite(lower) ? lower / 2 : upper / 10;
  const r0 = Math.sqrt(Math.max(lower, 1e-300) * Math.max(upper, 1e-300));
  const z: Complex[] = Array.from({ length: n }, (_, k) => {
    const t = (2 * Math.PI * k) / n + 0.4;
    return cx(r0 * Math.cos(t), r0 * Math.sin(t));
  });
  const done = new Array<boolean>(n).fill(false);
  for (let it = 0; it < 1000; it++) {
    let active = 0;
    for (let i = 0; i < n; i++) {
      if (done[i]) continue;
      active++;
      const pz = pevalC(a, z[i]);
      const dpz = pevalC(da, z[i]);
      if (pz.re === 0 && pz.im === 0) {
        done[i] = true;
        continue;
      }
      const w = cdiv(pz, dpz);
      let s = cx(0);
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const dz = csub(z[i], z[j]);
        const inv = cdiv(cx(1), dz);
        if (Number.isFinite(inv.re) && Number.isFinite(inv.im)) s = cx(s.re + inv.re, s.im + inv.im);
      }
      let step = cdiv(w, csub(cx(1), cmul(w, s)));
      if (!Number.isFinite(step.re) || !Number.isFinite(step.im)) step = w;
      if (!Number.isFinite(step.re) || !Number.isFinite(step.im)) {
        // perturb
        step = cx(1e-3 * (1 + cabs(z[i])), 1e-3);
      }
      z[i] = csub(z[i], step);
      if (cabs(step) <= 4e-16 * Math.max(1e-300, cabs(z[i])) || cabs(step) < 1e-300) done[i] = true;
    }
    if (!active) break;
  }
  // Newton polish (accept only improvements)
  for (let i = 0; i < n; i++) {
    let zi = z[i];
    let fi = cabs(pevalC(a, zi));
    for (let k = 0; k < 3; k++) {
      const d = pevalC(da, zi);
      if (cabs(d) === 0) break;
      const zn = csub(zi, cdiv(pevalC(a, zi), d));
      const fn = cabs(pevalC(a, zn));
      if (fn < fi) {
        zi = zn;
        fi = fn;
      } else break;
    }
    z[i] = zi;
  }
  return z;
}

/**
 * Snap and pair roots of a REAL polynomial so the result is exactly conjugate-symmetric.
 * If `realCount` is known (e.g. from a Sturm sequence) exactly that many roots become real.
 */
export function enforceConjugates(rs: Complex[], realCount?: number): Complex[] {
  let realIdx: Set<number>;
  if (realCount !== undefined) {
    const order = rs.map((z, i) => ({ i, a: Math.abs(z.im) })).sort((x, y) => x.a - y.a);
    realIdx = new Set(order.slice(0, realCount).map((o) => o.i));
  } else {
    realIdx = new Set(
      rs.map((z, i) => ({ z, i })).filter((o) => Math.abs(o.z.im) <= 1e-9 * Math.max(1, cabs(o.z))).map((o) => o.i),
    );
  }
  const out: Complex[] = [];
  const upper: Complex[] = []; // roots with im > 0
  const lower: Complex[] = []; // conjugates of roots with im < 0 (so im > 0 as well)
  rs.forEach((z, i) => {
    if (realIdx.has(i)) out.push(cx(z.re, 0));
    else if (z.im > 0) upper.push(z);
    else lower.push(cx(z.re, -z.im));
  });
  const byIm = (x: Complex, y: Complex): number => x.im - y.im;
  // Rebalance the two half-planes (numerical noise may put both of a near-real pair on one side).
  while (upper.length - lower.length >= 2) lower.push(upper.sort(byIm).shift() as Complex);
  while (lower.length - upper.length >= 2) upper.push(lower.sort(byIm).shift() as Complex);
  if (upper.length > lower.length) out.push(cx((upper.sort(byIm).shift() as Complex).re, 0));
  else if (lower.length > upper.length) out.push(cx((lower.sort(byIm).shift() as Complex).re, 0));
  const used = new Array<boolean>(lower.length).fill(false);
  for (const u of upper) {
    let bj = 0,
      bd = Infinity;
    lower.forEach((l, j) => {
      if (used[j]) return;
      const d = Math.hypot(u.re - l.re, u.im - l.im);
      if (d < bd) {
        bd = d;
        bj = j;
      }
    });
    used[bj] = true;
    const l = lower[bj];
    const re = (u.re + l.re) / 2,
      im = (u.im + l.im) / 2;
    out.push(cx(re, im), cx(re, -im));
  }
  return out;
}

/** All roots (with repetition) of a real float polynomial. */
export function rootsFloat(pIn: Poly): Complex[] {
  let p = ptrim(pIn);
  const out: Complex[] = [];
  let z0 = 0;
  while (z0 < p.length - 1 && p[z0] === 0) z0++;
  for (let i = 0; i < z0; i++) out.push(cx(0));
  p = p.slice(z0);
  const n = p.length - 1;
  if (n <= 0) return out;
  if (n === 1) return [...out, cx(-p[0] / p[1])];
  if (n === 2) return [...out, ...quadRoots(p[0], p[1], p[2])];
  return [...out, ...enforceConjugates(aberth(p))];
}

/** Roots of a square-free rational polynomial (each simple). */
function rootsSquareFree(f: QPoly): RootM[] {
  const out: RootM[] = [];
  let g = f;
  // strip exact zero root
  if (g.length && g[0].isZero()) {
    out.push({ z: cx(0), mult: 1, exact: Q.int(0) });
    g = g.slice(1);
  }
  // exact rational roots detected from float approximations
  for (let pass = 0; pass < 3 && qdeg(g) >= 1; pass++) {
    const fl = rootsFloat(qToFloat(g));
    let found = false;
    for (const r of fl) {
      if (Math.abs(r.im) > 1e-7 * Math.max(1, cabs(r))) continue;
      for (const maxDen of [1, 100, 10_000, 1_000_000]) {
        const q = Q.approx(r.re, maxDen);
        if (qdeg(g) >= 1 && qeval(g, q).isZero()) {
          out.push({ z: cx(q.toNumber()), mult: 1, exact: q });
          g = qdivExact(g, qFromLinear(q));
          found = true;
          break;
        }
      }
    }
    if (!found) break;
  }
  const d = qdeg(g);
  if (d === 1) {
    const q = g[0].neg().div(g[1]);
    out.push({ z: cx(q.toNumber()), mult: 1, exact: q });
  } else if (d === 2) {
    const [c, b, a] = g;
    const disc = b.mul(b).sub(a.mul(c).mul(Q.int(4)));
    const fl = quadRoots(c.toNumber(), b.toNumber(), a.toNumber());
    if (disc.sign() > 0) {
      out.push({ z: cx(fl[0].re), mult: 1 }, { z: cx(fl[1].re), mult: 1 });
    } else {
      const re = b.neg().div(a.mul(Q.int(2))).toNumber();
      const im = Math.sqrt(-disc.toNumber()) / (2 * Math.abs(a.toNumber()));
      out.push({ z: cx(re, im), mult: 1 }, { z: cx(re, -im), mult: 1 });
    }
  } else if (d >= 3) {
    const realCount = countRealRoots(g);
    const fl = enforceConjugates(rootsFloat(qToFloat(g)), realCount);
    fl.forEach((z) => out.push({ z, mult: 1 }));
  }
  return out;
}

/** Distinct roots with exact multiplicities. */
export function rootsExact(p: QPoly): RootM[] {
  if (qdeg(p) < 1) return [];
  const out: RootM[] = [];
  for (const { f, mult } of squareFree(p)) {
    for (const r of rootsSquareFree(f)) out.push({ ...r, mult });
  }
  return sortRootsM(out);
}

/** Expand multiplicities into a flat list. */
export function expandRoots(rs: RootM[]): Complex[] {
  const out: Complex[] = [];
  rs.forEach((r) => {
    for (let k = 0; k < r.mult; k++) out.push(r.z);
  });
  return out;
}

const isR = (z: Complex): boolean => z.im === 0;
/** Teacher ordering: real roots first (largest first), then complex (largest real part, +j first). */
export function compareRoots(a: Complex, b: Complex): number {
  if (isR(a) !== isR(b)) return isR(a) ? -1 : 1;
  if (Math.abs(a.re - b.re) > 1e-9 * Math.max(1, Math.abs(a.re))) return b.re - a.re;
  return b.im - a.im;
}
export function sortRootsM(rs: RootM[]): RootM[] {
  return rs.slice().sort((a, b) => compareRoots(a.z, b.z));
}
export function sortRoots(rs: Complex[]): Complex[] {
  return rs.slice().sort(compareRoots);
}
