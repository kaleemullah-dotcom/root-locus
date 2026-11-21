/**
 * Builds the open-loop transfer function G(s)H(s) = K·N(s)/D(s) from the three input modes,
 * validates it, and cancels common pole–zero factors exactly.
 */
import { cx, type Complex } from './complex';
import {
  ParseError,
  containsK,
  evalAst,
  parseAst,
  parseComplexList,
  parseRational,
  type QComplex,
  type RatS,
} from './parser';
import { Q, Q1 } from './rational';
import {
  qdeg,
  qdivExact,
  qFromConjPair,
  qFromLinear,
  qgcd,
  qlead,
  qmul,
  qscale,
  qeq,
  type QPoly,
} from './qpoly';
import { expandRoots, rootsExact } from './roots';

export type TFInput =
  | { mode: 'nd'; num: string; den: string }
  | { mode: 'string'; expr: string }
  | { mode: 'pz'; zeros: string; poles: string; gain: string };

export class InputError extends Error {
  readonly field: string;
  constructor(message: string, field = 'general') {
    super(message);
    this.name = 'InputError';
    this.field = field;
  }
}

export interface TransferFunction {
  /** Numerator N(s) (includes any constant gain), exact. */
  N: QPoly;
  /** Denominator D(s), exact. */
  D: QPoly;
  /** Notices to show the user (cancellations, added conjugates …). */
  warnings: string[];
  /** Roots that were cancelled between N and D. */
  cancelled: Complex[];
}

function ratToND(r: RatS): { N: QPoly; D: QPoly } {
  return { N: r.num, D: r.den };
}

/** Divide by a common monic factor, keeping the user's leading coefficients. */
function cancelCommon(N: QPoly, D: QPoly): { N: QPoly; D: QPoly; cancelled: Complex[] } {
  const g = qgcd(N, D);
  if (qdeg(g) < 1) return { N, D, cancelled: [] };
  return { N: qdivExact(N, g), D: qdivExact(D, g), cancelled: expandRoots(rootsExact(g)) };
}

function polyFromComplexList(list: QComplex[], what: string, warnings: string[]): QPoly {
  let p: QPoly = [Q1];
  const pending: QComplex[] = [];
  for (const z of list) {
    if (z.im.isZero()) p = qmul(p, qFromLinear(z.re));
    else pending.push(z);
  }
  // pair conjugates
  const used = new Array<boolean>(pending.length).fill(false);
  for (let i = 0; i < pending.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const z = pending[i];
    const j = pending.findIndex((w, k) => !used[k] && w.re.eq(z.re) && w.im.eq(z.im.neg()));
    if (j >= 0) used[j] = true;
    else
      warnings.push(
        `${what}: added the missing conjugate ${fmtQc({ re: z.re, im: z.im.neg() })} of ${fmtQc(z)} (a real system has conjugate pairs).`,
      );
    p = qmul(p, qFromConjPair(z.re, z.im.abs()));
  }
  return p;
}

function fmtQc(z: QComplex): string {
  const re = z.re.toNumber(),
    im = z.im.toNumber();
  if (im === 0) return `${re}`;
  const r = re === 0 ? '' : `${re}`;
  return `${r}${im < 0 ? '−' : r ? '+' : ''}j${Math.abs(im) === 1 ? '' : Math.abs(im)}`;
}

export function buildTF(input: TFInput): TransferFunction {
  const warnings: string[] = [];
  let N: QPoly, D: QPoly;
  try {
    if (input.mode === 'nd') {
      const n = parseRational(input.num, 'N(s)');
      const d = parseRational(input.den, 'D(s)');
      if (!n.num.length) throw new InputError('N(s) cannot be zero.', 'num');
      if (!d.num.length) throw new InputError('D(s) cannot be zero.', 'den');
      if (qdeg(n.den) === 0 && qdeg(d.den) === 0) {
        // keep D exactly as typed; move constant denominators into N
        N = qscale(n.num, d.den[0].div(n.den[0]));
        D = d.num;
      } else {
        N = qmul(n.num, d.den);
        D = qmul(n.den, d.num);
      }
    } else if (input.mode === 'string') {
      let src = input.expr.trim();
      // allow "G(s)H(s) =" or "G(s) =" prefixes
      src = src.replace(/^\s*[A-Za-z]\s*\(\s*s\s*\)\s*([A-Za-z]\s*\(\s*s\s*\))?\s*=\s*/, '');
      const ast = parseAst(src);
      if (containsK(ast)) {
        // K must be an overall multiplicative factor: G(K=2) = 2·G(K=1)
        const g1 = evalAst(ast, Q1),
          g2 = evalAst(ast, Q.int(2));
        const lhs = qmul(g2.num, g1.den),
          rhs = qmul(qscale(g1.num, Q.int(2)), g2.den);
        if (!qeq(lhs, rhs))
          throw new InputError('K must appear as an overall gain factor, e.g. K(s+2)/(s(s+1)).', 'expr');
      }
      const topDiv = ast.t === 'div' ? ast : null;
      if (topDiv) {
        const a = evalAst(topDiv.a, Q1),
          b = evalAst(topDiv.b, Q1);
        if (!b.num.length) throw new InputError('Denominator cannot be zero.', 'expr');
        if (qdeg(a.den) === 0 && qdeg(b.den) === 0) {
          N = qscale(a.num, b.den[0].div(a.den[0]));
          D = b.num;
        } else ({ N, D } = ratToND({ num: qmul(a.num, b.den), den: qmul(a.den, b.num) }));
      } else ({ N, D } = ratToND(evalAst(ast, Q1)));
      if (!N.length) throw new InputError('G(s)H(s) cannot be zero.', 'expr');
    } else {
      const zeros = parseComplexList(input.zeros, 'Zeros');
      const poles = parseComplexList(input.poles, 'Poles');
      const gs = input.gain.trim() || '1';
      let gain: Q;
      try {
        gain = Q.parse(gs.replace(/[−–]/g, '-'));
      } catch {
        throw new InputError(`Gain "${gs}" is not a number.`, 'gain');
      }
      if (gain.isZero()) throw new InputError('Gain cannot be zero.', 'gain');
      if (!poles.length) throw new InputError('Enter at least one pole.', 'poles');
      N = qscale(polyFromComplexList(zeros, 'Zeros', warnings), gain);
      D = polyFromComplexList(poles, 'Poles', warnings);
    }
  } catch (e) {
    if (e instanceof InputError) throw e;
    if (e instanceof ParseError) {
      const field = input.mode === 'nd' ? 'general' : input.mode === 'string' ? 'expr' : 'general';
      throw new InputError(e.message, field);
    }
    throw e;
  }

  if (qdeg(D) < 1)
    throw new InputError('D(s) must contain s — the open loop needs at least one pole.', input.mode === 'pz' ? 'poles' : 'den');
  const c = cancelCommon(N, D);
  if (c.cancelled.length) {
    const list = c.cancelled.map((z) => fmtC(z)).join(', ');
    warnings.push(
      `Pole–zero cancellation: the common factor${c.cancelled.length > 1 ? 's' : ''} at s = ${list} ${c.cancelled.length > 1 ? 'were' : 'was'} cancelled. ` +
        'The cancelled mode is still present physically (hidden from the root locus) — check it is stable.',
    );
  }
  N = c.N;
  D = c.D;
  if (qdeg(D) < 1) throw new InputError('After cancellation no poles remain — G(s)H(s) is a constant.');
  const n = qdeg(D),
    m = qdeg(N);
  if (m > n)
    throw new InputError(
      `Improper G(s)H(s): m = ${m} zeros > n = ${n} poles. A physical open loop must have n ≥ m (more zeros than poles means infinite gain at high frequency, and the 7-rule method assumes n ≥ m).`,
    );
  if (qlead(N).toNumber() / qlead(D).toNumber() < 0)
    warnings.push(
      'The leading coefficients of N(s) and D(s) have opposite signs (negative effective gain). ' +
        'For K > 0 this is a 0° (complementary) root locus — the rules use the 0° versions (even count on the real axis, θ = 360°·i/(n−m), no ±180° in R6).',
    );
  return { N, D, warnings, cancelled: c.cancelled };
}

function fmtC(z: Complex): string {
  const r = (x: number): string => String(Math.round(x * 1e4) / 1e4).replace('-', '−');
  if (z.im === 0) return r(z.re);
  return `${z.re === 0 ? '' : r(z.re)} ${z.im < 0 ? '−' : '+'} j${r(Math.abs(z.im))}`;
}

export const _internal = { cancelCommon, cx };
