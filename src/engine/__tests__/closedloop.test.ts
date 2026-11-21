import { describe, expect, it } from 'vitest';
import { hungarian } from '../hungarian';
import { expm, stepResponse, poleInfo } from '../closedloop';
import { solveTF } from '../solve';

describe('hungarian', () => {
  it('finds the optimal assignment', () => {
    const c = [
      [4, 1, 3],
      [2, 0, 5],
      [3, 2, 2],
    ];
    const a = hungarian(c);
    const total = a.reduce((s, j, i) => s + c[i][j], 0);
    expect(total).toBe(5); // 1 + 2 + 2
    expect(new Set(a).size).toBe(3);
  });
});

describe('closed loop', () => {
  it('matrix exponential of a rotation', () => {
    const E = expm([
      [0, -Math.PI / 2],
      [Math.PI / 2, 0],
    ]);
    expect(E[0][0]).toBeCloseTo(0, 12);
    expect(E[1][0]).toBeCloseTo(1, 12);
  });
  it('type-1 loop settles at 1, second-order overshoot matches theory', () => {
    const s = solveTF({ mode: 'nd', num: '1', den: 's(s+2)' }); // T = K/(s²+2s+K)
    const K = 4; // ωn = 2, ζ = 0.5 → overshoot e^{−πζ/√(1−ζ²)} = 16.3 %
    const r = stepResponse(s.ol, K, 2000);
    expect(r.stable).toBe(true);
    expect(r.final).toBe(1);
    const peak = Math.max(...r.y);
    expect(peak - 1).toBeCloseTo(Math.exp((-Math.PI * 0.5) / Math.sqrt(0.75)), 3);
    expect(r.y[r.y.length - 1]).toBeCloseTo(1, 3);
  });
  it('flags unstable responses', () => {
    const s = solveTF({ mode: 'nd', num: '1', den: 's(s+4)(s+5)' });
    expect(stepResponse(s.ol, 250).stable).toBe(false);
  });
  it('damping ratio and natural frequency', () => {
    const p = poleInfo({ re: -1, im: Math.sqrt(3) });
    expect(p.wn).toBeCloseTo(2, 12);
    expect(p.zeta).toBeCloseTo(0.5, 12);
  });
});
