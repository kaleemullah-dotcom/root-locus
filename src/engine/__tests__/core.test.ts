import { describe, expect, it } from 'vitest';
import { Q } from '../rational';
import { countRealRoots, qder, qfromInts, qgcd, qmul, qpow, squareFree, qToFloat } from '../qpoly';
import { rootsExact, rootsFloat, expandRoots } from '../roots';
import { parseComplex, parseRational, ParseError } from '../parser';
import { buildTF, InputError } from '../tf';
import { pevalC } from '../poly';
import { cabs } from '../complex';

const qp = qfromInts;

describe('rational', () => {
  it('reduces and does arithmetic exactly', () => {
    const a = Q.make(6n, -8n);
    expect(a.toString()).toBe('-3/4');
    expect(a.add(Q.make(1n, 4n)).toString()).toBe('-1/2');
    expect(Q.parse('40.8').toString()).toBe('204/5');
    expect(Q.parse('1.5e-3').toString()).toBe('3/2000');
    expect(Q.parse('-.25').toNumber()).toBe(-0.25);
    expect(Q.approx(0.333333333333, 1000).toString()).toBe('1/3');
  });
  it('converts huge rationals to doubles accurately', () => {
    const big = Q.make(10n ** 400n + 1n, 3n * 10n ** 399n);
    expect(big.toNumber()).toBeCloseTo(10 / 3, 12);
  });
});

describe('exact polynomials', () => {
  it('gcd and square-free decomposition', () => {
    // (s+1)^2 (s+2)^3 s
    const p = qmul(qmul(qpow(qp([1, 1]), 2), qpow(qp([2, 1]), 3)), qp([0, 1]));
    const sf = squareFree(p);
    const byMult = Object.fromEntries(sf.map((x) => [x.mult, qToFloat(x.f)]));
    expect(byMult[1]).toEqual([0, 1]);
    expect(byMult[2]).toEqual([1, 1]);
    expect(byMult[3]).toEqual([2, 1]);
    expect(qToFloat(qgcd(p, qder(p)))).toEqual(qToFloat(qmul(qp([1, 1]), qpow(qp([2, 1]), 2))));
  });
  it('Sturm counts real roots', () => {
    expect(countRealRoots(qp([2, 2, 1]))).toBe(0); // s²+2s+2
    expect(countRealRoots(qp([0, 20, 9, 1]))).toBe(3); // s(s+4)(s+5)
    expect(countRealRoots(qp([-1, 0, 0, 1]))).toBe(1); // s³−1
  });
});

describe('roots', () => {
  it('exact multiplicities and rational roots', () => {
    const p = qmul(qmul(qpow(qp([1, 1]), 2), qp([4, 1])), qp([0, 0, 1])); // (s+1)²(s+4)s²
    const r = rootsExact(p);
    expect(r.map((x) => [x.z.re, x.mult])).toEqual([
      [0, 2],
      [-1, 2],
      [-4, 1],
    ]);
    expect(r.every((x) => x.exact)).toBe(true);
  });
  it('complex pairs are exact conjugates', () => {
    const r = rootsExact(qp([5, 2, 1]));
    expect(r[0].z).toEqual({ re: -1, im: 2 });
    expect(r[1].z).toEqual({ re: -1, im: -2 });
  });
  it('degree-8 polynomial residuals are tiny', () => {
    const p = [3, -2, 7, 1, -5, 0.5, 2, 1, 0.25];
    const r = rootsFloat(p);
    expect(r).toHaveLength(8);
    for (const z of r) expect(cabs(pevalC(p, z))).toBeLessThan(1e-9 * (1 + cabs(z) ** 8));
  });
  it('widely spread magnitudes', () => {
    // (s+1e-3)(s+1)(s+1e3)(s^2+0.02s+0.0101)
    const p = qmul(qmul(qmul(qp([1e-3, 1]), qp([1, 1])), qp([1e3, 1])), qp([0.0101, 0.02, 1]));
    const r = expandRoots(rootsExact(p));
    const reals = r.filter((z) => z.im === 0).map((z) => z.re);
    expect(reals).toEqual([-0.001, -1, -1000]);
    const cpx = r.filter((z) => z.im !== 0);
    expect(cpx[0].re).toBeCloseTo(-0.01, 14);
    expect(Math.abs(cpx[0].im)).toBeCloseTo(0.1, 14);
  });
});

describe('parser', () => {
  const f = (s: string): number[] => {
    const r = parseRational(s);
    return qToFloat(r.num).map((x) => x / qToFloat(r.den)[0]);
  };
  it('factored, polynomial, implicit multiplication', () => {
    expect(f('s(s+3)(s^2+2s+2)')).toEqual([0, 6, 8, 5, 1]);
    expect(f('(s+1)^2(s+4)')).toEqual([4, 9, 6, 1]);
    expect(f('s^3+9s^2+20s')).toEqual([0, 20, 9, 1]);
    expect(f('2(s+3)')).toEqual([6, 2]);
    expect(f('0.5s² + 1.5 s')).toEqual([0, 1.5, 0.5]);
    expect(f('s·(s+2)')).toEqual([0, 2, 1]);
    expect(f('-s+1')).toEqual([1, -1]);
  });
  it('reports clear errors', () => {
    expect(() => parseRational('s(s+1')).toThrow(/Missing "\)"/);
    expect(() => parseRational('s^1.5')).toThrow(/whole number/);
    expect(() => parseRational('s+$')).toThrow(ParseError);
    expect(() => parseRational('s2')).toThrow(/ambiguous/);
    expect(() => parseRational('')).toThrow(/empty/);
  });
  it('complex numbers', () => {
    const c = (s: string): [number, number] => {
      const z = parseComplex(s);
      return [z.re.toNumber(), z.im.toNumber()];
    };
    expect(c('-1+2j')).toEqual([-1, 2]);
    expect(c('-1 - j2')).toEqual([-1, -2]);
    expect(c('3j')).toEqual([0, 3]);
    expect(c('-j')).toEqual([0, -1]);
    expect(c('-4')).toEqual([-4, 0]);
    expect(c('2.5i')).toEqual([0, 2.5]);
  });
});

describe('transfer function builder', () => {
  it('three input modes agree', () => {
    const a = buildTF({ mode: 'nd', num: 's+2', den: 's(s+1)(s+5)' });
    const b = buildTF({ mode: 'string', expr: 'K(s+2)/(s(s+1)(s+5))' });
    const c = buildTF({ mode: 'pz', zeros: '-2', poles: '0, -1, -5', gain: '1' });
    const d = buildTF({ mode: 'string', expr: 'K(s+2)/s(s+1)(s+5)' });
    for (const t of [b, c, d]) {
      expect(qToFloat(t.N)).toEqual(qToFloat(a.N));
      expect(qToFloat(t.D)).toEqual(qToFloat(a.D));
    }
  });
  it('adds missing conjugates and cancels common factors', () => {
    const t = buildTF({ mode: 'pz', zeros: '', poles: '-1+2j, 0', gain: '3' });
    expect(qToFloat(t.D)).toEqual([0, 5, 2, 1]);
    expect(t.warnings[0]).toMatch(/conjugate/);
    const c = buildTF({ mode: 'nd', num: '(s+1)(s+3)', den: 's(s+1)(s+4)(s+5)' });
    expect(qToFloat(c.N)).toEqual([3, 1]);
    expect(qToFloat(c.D)).toEqual([0, 20, 9, 1]);
    expect(c.cancelled).toEqual([{ re: -1, im: 0 }]);
    expect(c.warnings.join(' ')).toMatch(/cancel/);
  });
  it('rejects improper and malformed input', () => {
    expect(() => buildTF({ mode: 'nd', num: 's^2', den: 's+1' })).toThrow(/Improper/);
    expect(() => buildTF({ mode: 'nd', num: '0', den: 's+1' })).toThrow(InputError);
    expect(() => buildTF({ mode: 'nd', num: '1', den: '5' })).toThrow(/at least one pole/);
    expect(() => buildTF({ mode: 'string', expr: '(s+K)/(s^2)' })).toThrow(/overall gain/);
  });
  it('warns about negative effective gain', () => {
    const t = buildTF({ mode: 'nd', num: '-(s-1)', den: 's(s+2)' });
    expect(t.warnings.join(' ')).toMatch(/0°/);
    const u = buildTF({ mode: 'nd', num: '1-s', den: 's(s+2)' });
    expect(u.warnings.join(' ')).toMatch(/0°/);
  });
});
