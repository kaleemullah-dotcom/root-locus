import { describe, expect, it } from 'vitest';
import { fcomplex, fnum, polyTex, routhEntryTex, rfTex, factoredTex } from '../latex';
import { solveTF } from '../solve';

describe('latex formatting', () => {
  it('numbers and polynomials', () => {
    expect(fnum(-1e-12)).toBe('0');
    expect(fnum(0.0002)).toBe('2\\times10^{-4}');
    expect(fnum(13.12847)).toBe('13.128');
    expect(fnum(-3)).toBe('-3');
    expect(polyTex([0, 20, 9, 1])).toBe('s^{3} + 9s^{2} + 20s');
    expect(polyTex([1, -1])).toBe('-s + 1');
    expect(fcomplex({ re: -1, im: -2 })).toBe('-1 - j2');
    expect(fcomplex({ re: 0, im: 4.47213 })).toBe('j4.472');
  });
  it('Routh entries in the teacher style', () => {
    const p1 = solveTF({ mode: 'nd', num: '1', den: 's(s+3)(s^2+2s+2)' });
    const r1 = p1.routh.rows.find((r) => r.power === 1)!;
    expect(routhEntryTex(r1.entries[0])).toBe('\\dfrac{40.8 - 5K}{6.8}');
    const r2 = p1.routh.rows.find((r) => r.power === 2)!;
    expect(routhEntryTex(r2.entries[0])).toBe('6.8');
    expect(routhEntryTex(r2.entries[1])).toBe('K');
    const cls = solveTF({ mode: 'nd', num: '1', den: 's(s+4)(s+5)' });
    expect(routhEntryTex(cls.routh.rows[2].entries[0])).toBe('\\dfrac{180 - K}{9}');
  });
  it('ε entries', () => {
    const s = solveTF({ mode: 'nd', num: '1', den: 's(s+1)(s^2+2)' });
    const r1 = s.routh.rows.find((r) => r.power === 1)!;
    expect(rfTex(r1.entries[0].val)).toBe('\\dfrac{2\\varepsilon - K}{\\varepsilon}');
  });
  it('factored form', () => {
    const s = solveTF({ mode: 'nd', num: '1', den: 's(s+4)(s^2+2s+5)' });
    expect(factoredTex(s.ol.polesM, 1)).toBe('s(s + 4)(s^{2} + 2s + 5)');
  });
});
