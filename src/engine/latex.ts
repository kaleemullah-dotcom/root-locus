/**
 * Pure formatting helpers: numbers, polynomials, complex values and Routh entries → LaTeX.
 * No DOM. Used by the UI and the PDF export.
 */
import type { Complex } from './complex';
import type { BiPoly, RF } from './kfunc';
import { rfHasEps, rfIsConst, rfIsZero, rfConstValue } from './kfunc';
import { Q } from './rational';
import { qdeg, type QPoly } from './qpoly';
import type { RouthEntry } from './routh';
import type { RootM } from './roots';

/** Plain number: up to `d` decimals, trailing zeros trimmed, no "−0". Uses ASCII '-'. */
export function fnum(x: number, d = 3): string {
  if (!Number.isFinite(x)) return x > 0 ? '\\infty' : '-\\infty';
  const a = Math.abs(x);
  if (a !== 0 && (a >= 1e7 || a < Math.pow(10, -d) / 2)) {
    if (a < 1e-9) return '0';
    const [m, e] = x.toExponential(Math.min(3, d)).split('e');
    return `${m.replace(/\.?0+$/, '')}\\times10^{${parseInt(e, 10)}}`;
  }
  let v = Number(x.toFixed(d));
  if (Object.is(v, -0) || v === 0) v = 0;
  const str = v.toFixed(d);
  return str.includes('.') ? str.replace(/\.?0+$/, '') : str;
}
/** Same as fnum but plain text with a typographic minus (for SVG / text). */
export function tnum(x: number, d = 3): string {
  if (!Number.isFinite(x)) return x > 0 ? '∞' : '−∞';
  const s = fnum(x, d);
  if (s.includes('\\times')) {
    const m = /^(.*)\\times10\^\{(-?\d+)\}$/.exec(s);
    if (m) return `${m[1]}e${m[2]}`.replace(/-/g, '−');
  }
  return s.replace(/-/g, '−');
}

/** Exact rational as a decimal (exact when terminating and short, else rounded). */
export function qnum(q: Q, d = 4): string {
  if (q.isTerminating()) {
    const v = q.toNumber();
    const s = String(v);
    if (!s.includes('e') && (s.split('.')[1]?.length ?? 0) <= d) return s;
  }
  return fnum(q.toNumber(), d);
}

/** Complex value in teacher style: −1 + j2, j4.472, −3. */
export function fcomplex(z: Complex, d = 3, text = false): string {
  const N = text ? tnum : fnum;
  const minus = text ? '−' : '-';
  if (Math.abs(z.im) < Math.pow(10, -d) / 2) return N(z.re, d);
  const im = N(Math.abs(z.im), d);
  const imS = im === '1' ? '' : im;
  const reS = Math.abs(z.re) < Math.pow(10, -d) / 2 ? '' : N(z.re, d);
  if (!reS) return `${z.im < 0 ? minus : ''}j${imS}`;
  return `${reS} ${z.im < 0 ? minus : '+'} j${imS}`;
}
/** ± pair for conjugates: −1 ± j2 */
export function fpair(z: Complex, d = 3, text = false): string {
  const N = text ? tnum : fnum;
  const pm = text ? '±' : '\\pm';
  if (z.im === 0) return N(z.re, d);
  const im = N(Math.abs(z.im), d);
  const imS = im === '1' ? '' : im;
  const reS = Math.abs(z.re) < Math.pow(10, -d) / 2 ? '' : N(z.re, d);
  return reS ? `${reS} ${pm} j${imS}` : `${pm}j${imS}`;
}

type Coeff = number | Q;
const cval = (c: Coeff): number => (typeof c === 'number' ? c : c.toNumber());
const cstr = (c: Coeff, d: number): string => (typeof c === 'number' ? fnum(c, d) : qnum(c, d));

/** Polynomial (coefficients LOW → HIGH) in variable v, highest power first. */
export function polyTex(p: readonly Coeff[], v = 's', d = 4): string {
  const terms: Array<{ neg: boolean; body: string }> = [];
  for (let k = p.length - 1; k >= 0; k--) {
    const a = cval(p[k]);
    if (a === 0) continue;
    const abs = cstr(typeof p[k] === 'number' ? Math.abs(a) : (p[k] as Q).abs(), d);
    if (abs === '0') continue;
    const vp = k === 0 ? '' : k === 1 ? v : `${v}^{${k}}`;
    const body = k === 0 ? abs : abs === '1' ? vp : `${abs}${vp}`;
    terms.push({ neg: a < 0, body });
  }
  if (!terms.length) return '0';
  return terms.map((t, i) => (i === 0 ? (t.neg ? '-' : '') + t.body : ` ${t.neg ? '-' : '+'} ${t.body}`)).join('');
}

/**
 * Polynomial in K, teacher style: when it is linear with a positive constant and a negative
 * K-coefficient the constant goes first ("40.8 - 5K"), otherwise highest power first.
 */
export function polyKTex(p: QPoly, d = 4): string {
  if (qdeg(p) === 1 && p[0].sign() > 0 && p[1].sign() < 0) {
    const c = p[1].abs();
    return `${qnum(p[0], d)} - ${c.isOne() ? '' : qnum(c, d)}K`;
  }
  return polyTex(p, 'K', d);
}

const needsParens = (s: string): boolean => /[+]|\s-\s/.test(s);

function biTex(b: BiPoly, d: number): string {
  // terms ordered by ε power descending; each coefficient is a K-polynomial
  const parts: string[] = [];
  for (let e = b.length - 1; e >= 0; e--) {
    const c = b[e];
    if (!c.length) continue;
    const eps = e === 0 ? '' : e === 1 ? '\\varepsilon' : `\\varepsilon^{${e}}`;
    let body = polyKTex(c, d);
    if (eps) {
      if (body === '1') body = eps;
      else if (body === '-1') body = `-${eps}`;
      else body = needsParens(body) ? `(${body})${eps}` : `${body}${eps}`;
    }
    parts.push(body);
  }
  return parts.map((p, i) => (i === 0 ? p : p.startsWith('-') ? ` - ${p.slice(1)}` : ` + ${p}`)).join('') || '0';
}

export function rfTex(f: RF, d = 4): string {
  if (rfIsZero(f)) return '0';
  const n = biTex(f.n, d),
    den = biTex(f.d, d);
  if (den === '1') return n;
  return `\\dfrac{${n}}{${den}}`;
}

/** Routh entry, teacher style: (40.8 − 5K)/6.8 with the unreduced numerator over the pivot. */
export function routhEntryTex(e: RouthEntry, d = 4): string {
  const v = e.val;
  if (rfIsZero(v)) return '0';
  if (rfIsConst(v)) return qnum(rfConstValue(v), d);
  if (e.rawNum && e.rawDen && !rfHasEps(e.rawDen) && !rfHasEps(e.rawNum) && rfIsConst(e.rawDen)) {
    const c = rfConstValue(e.rawDen);
    const num = e.rawNum;
    const terms = num.n.length === 1 ? num.n[0].filter((x) => !x.isZero()).length : 0;
    if (num.d.length === 1 && qdeg(num.d[0]) === 0 && num.n.length === 1 && terms >= 2) {
      const top = polyKTex(num.n[0].map((x) => x.div(num.d[0][0])), d);
      if (c.isOne()) return top;
      return `\\dfrac{${top}}{${qnum(c, d)}}`;
    }
  }
  return rfTex(v, d);
}

/** Factored LaTeX of a polynomial from its roots: s(s+4)(s^2+2s+5) */
export function factoredTex(roots: RootM[], lead: number, d = 3): string {
  const parts: string[] = [];
  const pw = (body: string, m: number): string => (m > 1 ? `${body}^{${m}}` : body);
  for (const r of roots) {
    if (r.z.im < 0) continue;
    if (r.z.im === 0) {
      if (r.z.re === 0) parts.push(pw('s', r.mult));
      else parts.push(pw(`(s ${r.z.re < 0 ? '+' : '-'} ${fnum(Math.abs(r.z.re), d)})`, r.mult));
    } else {
      const b = -2 * r.z.re,
        c = r.z.re * r.z.re + r.z.im * r.z.im;
      parts.push(pw(`(${polyTex([c, b, 1], 's', d)})`, r.mult));
    }
  }
  const body = parts.join('');
  const L = fnum(lead, d);
  if (!body) return L;
  return L === '1' ? body : L === '-1' ? `-${body}` : `${L}${body}`;
}
