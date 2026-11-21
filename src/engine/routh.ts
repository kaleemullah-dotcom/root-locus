/**
 * R7 — Routh array for the characteristic equation D(s) + K·N(s) = 0 with entries that are
 * exact rational functions of K. Handles both special cases:
 *   • first element ≡ 0 (row not all zero): replaced by ε, signs taken as ε → 0⁺
 *   • whole row ≡ 0: auxiliary polynomial A(s) from the row above, row replaced by A′(s)
 */
import {
  RF0,
  rfConst,
  rfDiv,
  rfEps,
  rfHasEps,
  rfIsConst,
  rfIsZero,
  rfK,
  rfLimitSign,
  rfMul,
  rfScale,
  rfSub,
  rfConstValue,
  rfNum,
  rfDen,
  type RF,
} from './kfunc';
import { Q, Q0 } from './rational';
import { qdeg, qeval, qtrim, type QPoly } from './qpoly';
import { rootsExact } from './roots';
import type { OpenLoop } from './system';

export interface RouthEntry {
  val: RF;
  /** unreduced teacher form numerator / pivot (rows ≥ 2 only) */
  rawNum?: RF;
  rawDen?: RF;
}
export interface RouthRow {
  power: number;
  entries: RouthEntry[];
  /** 'epsilon': first element replaced by ε; 'aux': row replaced by A′(s) */
  special?: 'epsilon' | 'aux';
  /** for special = 'aux': the auxiliary polynomial coefficients (high → low powers, step 2) */
  aux?: { power: number; coeffs: RF[] };
}
export interface RouthTable {
  degree: number;
  width: number;
  rows: RouthRow[];
  notes: string[];
  usedEpsilon: boolean;
  zeroRows: number[];
}

/** Characteristic coefficients high → low as RF in K: c_k = D_k + K·N_k. */
function charCoeffs(ol: OpenLoop): RF[] {
  const deg = Math.max(qdeg(ol.D), qdeg(ol.N));
  const out: RF[] = [];
  for (let k = deg; k >= 0; k--) out.push(rfK(qtrim([ol.D[k] ?? Q0, ol.N[k] ?? Q0])));
  return out;
}

export function buildRouth(ol: OpenLoop): RouthTable {
  const coef = charCoeffs(ol);
  const deg = coef.length - 1;
  const w = Math.floor(deg / 2) + 1;
  const notes: string[] = [];
  const zeroRows: number[] = [];
  let usedEpsilon = false;
  const pad = (r: RouthEntry[]): RouthEntry[] => {
    while (r.length < w) r.push({ val: RF0 });
    return r;
  };
  const rows: RouthRow[] = [
    { power: deg, entries: pad(coef.filter((_, i) => i % 2 === 0).map((val) => ({ val }))) },
  ];
  if (deg >= 1) rows.push({ power: deg - 1, entries: pad(coef.filter((_, i) => i % 2 === 1).map((val) => ({ val }))) });

  const fixRow = (i: number): void => {
    const row = rows[i];
    if (row.power < 0) return;
    if (row.entries.every((e) => rfIsZero(e.val)) && i >= 1) {
      // auxiliary polynomial from the row above
      const above = rows[i - 1];
      const p = above.power;
      const coeffs = above.entries.map((e) => e.val).slice(0, Math.floor(p / 2) + 1);
      const der: RouthEntry[] = coeffs
        .map((c, j) => ({ c, pw: p - 2 * j }))
        .filter((o) => o.pw >= 1)
        .map((o) => ({ val: rfScale(o.c, Q.int(o.pw)) }));
      row.entries = pad(der);
      row.special = 'aux';
      row.aux = { power: p, coeffs };
      zeroRows.push(row.power);
      notes.push(
        `Row s^${row.power} is entirely zero → auxiliary polynomial A(s) from row s^${p}; the row is replaced by the coefficients of dA/ds. ` +
          `The roots of A(s) = 0 are symmetric about the origin (often a pair on the jω axis).`,
      );
    }
    if (rfIsZero(row.entries[0].val) && row.entries.some((e) => !rfIsZero(e.val))) {
      row.entries[0] = { ...row.entries[0], val: rfEps };
      row.special = row.special ?? 'epsilon';
      usedEpsilon = true;
      notes.push(
        `Row s^${row.power}: the first element is zero (for every K) but the row is not → replace it by a small ε > 0 and continue; signs are read as ε → 0⁺.`,
      );
    }
  };
  if (rows.length > 1) fixRow(1);
  for (let i = 2; i <= deg; i++) {
    const a = rows[i - 2].entries,
      b = rows[i - 1].entries;
    const b0 = b[0].val;
    const entries: RouthEntry[] = [];
    for (let j = 0; j < w - 1; j++) {
      const num = rfSub(rfMul(b0, a[j + 1]?.val ?? RF0), rfMul(a[0].val, b[j + 1]?.val ?? RF0));
      entries.push({ val: rfDiv(num, b0), rawNum: num, rawDen: b0 });
    }
    rows.push({ power: deg - i, entries: pad(entries) });
    fixRow(i);
  }
  return { degree: deg, width: w, rows, notes, usedEpsilon, zeroRows };
}

// --------------------------------------------------------------- first column conditions

export interface KInterval {
  lo: number;
  hi: number;
}
export interface ColumnCondition {
  power: number;
  /** ε-free sign-equivalent first column entry */
  f: RF;
  constant: boolean;
  /** sign when constant */
  sign: number;
  /** K > 0 intervals where f > 0 */
  positive: KInterval[];
  /** human text, e.g. "K < 8.16" */
  text: string;
}

/** Positive real roots of an exact polynomial in K (distinct, ascending). */
export function positiveRoots(p: QPoly): number[] {
  if (qdeg(p) < 1) return [];
  return rootsExact(p)
    .filter((r) => r.z.im === 0 && r.z.re > 0)
    .map((r) => r.z.re)
    .sort((x, y) => x - y);
}

function signAtF(f: RF, K: number): number {
  const kq = Q.fromNumber(K);
  const n = qeval(rfNum(f), kq),
    d = qeval(rfDen(f), kq);
  return n.sign() * d.sign();
}

export function fmtK(x: number): string {
  if (!Number.isFinite(x)) return '∞';
  const a = Math.abs(x);
  const s = a >= 1e5 || (a < 1e-3 && a > 0) ? x.toPrecision(4) : (Math.round(x * 1e4) / 1e4).toString();
  return s.replace('-', '−');
}

export function intervalsText(iv: KInterval[]): string {
  if (!iv.length) return 'no K > 0';
  return iv
    .map(({ lo, hi }) =>
      lo <= 0 && hi === Infinity
        ? 'all K > 0'
        : lo <= 0
          ? `0 < K < ${fmtK(hi)}`
          : hi === Infinity
            ? `K > ${fmtK(lo)}`
            : `${fmtK(lo)} < K < ${fmtK(hi)}`,
    )
    .join(' or ');
}

export function columnConditions(t: RouthTable): ColumnCondition[] {
  return t.rows.map((r) => {
    const f = rfHasEps(r.entries[0].val) ? rfLimitSign(r.entries[0].val) : r.entries[0].val;
    if (rfIsConst(f)) {
      const sg = rfConstValue(f).sign();
      return {
        power: r.power,
        f,
        constant: true,
        sign: sg,
        positive: sg > 0 ? [{ lo: 0, hi: Infinity }] : [],
        text: sg > 0 ? 'always > 0' : sg < 0 ? 'always < 0' : '= 0',
      };
    }
    const cuts = [...new Set([...positiveRoots(rfNum(f)), ...positiveRoots(rfDen(f))])].sort((x, y) => x - y);
    const bounds = [0, ...cuts, Infinity];
    const positive: KInterval[] = [];
    for (let k = 0; k + 1 < bounds.length; k++) {
      const lo = bounds[k],
        hi = bounds[k + 1];
      const mid = hi === Infinity ? (lo === 0 ? 1 : lo * 2 + 1) : (lo + hi) / 2;
      if (signAtF(f, mid) > 0) {
        const last = positive[positive.length - 1];
        if (last && last.hi === lo && !cuts.includes(lo)) last.hi = hi;
        else positive.push({ lo, hi });
      }
    }
    return { power: r.power, f, constant: false, sign: 0, positive, text: intervalsText(positive) };
  });
}

// --------------------------------------------------------------- exact Hurwitz test

/**
 * Exact Routh–Hurwitz test of a concrete rational polynomial (coefficients LOW → HIGH).
 * Returns true iff every root has a strictly negative real part.
 * (A Hurwitz polynomial never produces a zero in the first column.)
 */
export function isHurwitzExact(p: QPoly): boolean {
  const c = qtrim(p);
  const deg = c.length - 1;
  if (deg < 1) return true;
  const hi: Q[] = [];
  for (let k = deg; k >= 0; k--) hi.push(c[k]);
  // all coefficients must be non-zero with the same sign (necessary condition)
  const s0 = hi[0].sign();
  if (hi.some((x) => x.sign() !== s0)) return false;
  const w = Math.floor(deg / 2) + 1;
  let a: Q[] = hi.filter((_, i) => i % 2 === 0);
  let b: Q[] = hi.filter((_, i) => i % 2 === 1);
  while (a.length < w) a.push(Q.ZERO);
  while (b.length < w) b.push(Q.ZERO);
  for (let i = 2; i <= deg; i++) {
    const b0 = b[0];
    if (b0.sign() !== s0) return false;
    const r: Q[] = [];
    for (let j = 0; j < w - 1; j++) r.push(b0.mul(a[j + 1] ?? Q.ZERO).sub(a[0].mul(b[j + 1] ?? Q.ZERO)).div(b0));
    r.push(Q.ZERO);
    a = b;
    b = r;
  }
  return b[0].sign() === s0;
}

export { rfConst };
