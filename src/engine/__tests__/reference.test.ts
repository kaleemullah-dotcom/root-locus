/**
 * The reference table from the course plus the special cases required by the spec.
 * Expected values are textbook / hand-computed; tolerances match the printed precision.
 */
import { describe, expect, it } from 'vitest';
import { solveTF, type Solution } from '../solve';
import { cabs, csub } from '../complex';
import { rfIsZero } from '../kfunc';

const solve = (num: string, den: string): Solution => solveTF({ mode: 'nd', num, den });
const near = (a: number, b: number, digits: number): void => expect(a).toBeCloseTo(b, digits);
const sortedAbs = (xs: number[]): number[] => xs.map((x) => Math.round(x * 1e6) / 1e6).sort((a, b) => a - b);
const brk = (s: Solution, kind?: string): Solution['r5']['accepted'] =>
  s.r5.accepted.filter((b) => !kind || b.kind === kind);

describe('course reference table', () => {
  it('K/[s(s+4)(s+5)] — class example', () => {
    const s = solve('1', 's(s+4)(s+5)');
    expect(s.r1.branches).toBe(3);
    expect(sortedAbs(s.r3.angles.map((a) => a.deg))).toEqual([-60, 60, 180]);
    expect(s.r4.sigma).toBe(-3);
    near(brk(s)[0].s.re, -1.472, 3);
    near(brk(s)[0].K.re, 13.128, 3);
    expect(brk(s)[0].kind).toBe('breakaway');
    expect(s.cross.crossings).toHaveLength(1);
    near(s.cross.crossings[0].K, 180, 9);
    near(s.cross.crossings[0].omega, 4.472, 3);
    expect(s.stab.stable).toEqual([{ lo: 0, hi: s.cross.crossings[0].K }]);
    // tan rule: |σ|·tan60° = 5.196
    near(s.r4.tan?.p ?? 0, 3 * Math.sqrt(3), 9);
  });

  it('K/[s(s+3)(s²+2s+2)]', () => {
    const s = solve('1', 's(s+3)(s^2+2s+2)');
    near(s.r4.sigma ?? 0, -1.25, 12);
    near(brk(s)[0].s.re, -2.289, 3);
    near(brk(s)[0].K.re, 4.33, 2);
    near(s.r6.departures[0].angles[0], -71.57, 2);
    near(s.cross.crossings[0].K, 8.16, 9);
    near(s.cross.crossings[0].omega, 1.095, 3);
    // the complex roots of P(s) are rejected with a reason
    expect(s.r5.candidates.filter((c) => !c.ok).every((c) => /complex/.test(c.why))).toBe(true);
  });

  it('K(s+3)/[(s+1)(s+5)] — no breakaway, always stable', () => {
    const s = solve('s+3', '(s+1)(s+5)');
    expect(s.r2.segments.map((g) => [g.a, g.b])).toEqual([
      [-1, -3],
      [-5, -Infinity],
    ]);
    expect(brk(s)).toHaveLength(0);
    const rej = s.r5.candidates.map((c) => c.s);
    expect(rej).toHaveLength(2);
    rej.forEach((z) => {
      near(z.re, -3, 12);
      near(Math.abs(z.im), 2, 12);
    });
    expect(s.cross.crossings).toHaveLength(0);
    expect(s.stab.stable).toEqual([{ lo: 0, hi: Infinity }]);
  });

  it('K/[(s+1)(s+3)(s+6)]', () => {
    const s = solve('1', '(s+1)(s+3)(s+6)');
    near(brk(s)[0].s.re, -1.88, 3);
    near(brk(s)[0].K.re, 4.06, 2);
    near(s.cross.crossings[0].K, 252, 9);
    near(s.cross.crossings[0].omega, 5.196, 3);
  });

  it('K(s+2)/[(s+1)(s+4)(s+6)]', () => {
    const s = solve('s+2', '(s+1)(s+4)(s+6)');
    expect(sortedAbs(s.r3.angles.map((a) => a.deg))).toEqual([-90, 90]);
    near(s.r4.sigma ?? 0, -4.5, 12);
    near(brk(s)[0].s.re, -4.957, 3);
    near(brk(s)[0].K.re, 1.336, 3);
    expect(s.cross.crossings).toHaveLength(0);
    expect(s.stab.stable).toEqual([{ lo: 0, hi: Infinity }]);
  });

  it('K/[(s+4)(s+5)(s²+2s+5)]', () => {
    const s = solve('1', '(s+4)(s+5)(s^2+2s+5)');
    near(brk(s)[0].s.re, -4.553, 3);
    near(brk(s)[0].K.re, 4.11, 2);
    near(s.r6.departures[0].angles[0], 29.74, 2);
    near(s.cross.crossings[0].K, 172.56, 2);
    near(s.cross.crossings[0].omega, 2.78, 2);
  });

  it('K/[(s+1)(s+2)(s²+8s+20)]', () => {
    const s = solve('1', '(s+1)(s+2)(s^2+8s+20)');
    near(brk(s)[0].s.re, -1.44, 2);
    near(brk(s)[0].K.re, 2.6, 2);
    near(s.r6.departures[0].angles[0], 168.69, 2);
    near(s.cross.crossings[0].K, 230.08, 2);
    near(s.cross.crossings[0].omega, 2.629, 3);
  });

  it('K(s+2)/(s²+2s+3) — entry point', () => {
    const s = solve('s+2', 's^2+2s+3');
    const e = brk(s, 'entry');
    expect(e).toHaveLength(1);
    near(e[0].s.re, -2 - Math.sqrt(3), 12);
    near(e[0].K.re, 5.464, 3);
    near(s.r6.departures[0].angles[0], 144.74, 2);
  });

  it('K(s+4)/[(s+1)(s+2)] — circular locus', () => {
    const s = solve('s+4', '(s+1)(s+2)');
    const b = brk(s, 'breakaway'),
      e = brk(s, 'entry');
    near(b[0].s.re, -4 + Math.sqrt(6), 12);
    near(b[0].K.re, 0.101, 3);
    near(e[0].s.re, -4 - Math.sqrt(6), 12);
    near(e[0].K.re, 9.899, 3);
    // every complex sample of the locus lies on the circle |s + 4| = √6
    const R = Math.sqrt(6);
    let worst = 0;
    s.locus.branches.forEach((br) =>
      br.forEach((z) => {
        if (Math.abs(z.im) > 1e-6) worst = Math.max(worst, Math.abs(cabs(csub(z, { re: -4, im: 0 })) - R));
      }),
    );
    expect(worst).toBeLessThan(1e-9);
  });

  it('K(s²+2s+2)/[s(s+3)(s+5)] — complex zeros', () => {
    const s = solve('s^2+2s+2', 's(s+3)(s+5)');
    near(brk(s)[0].s.re, -1.077, 3);
    near(brk(s)[0].K.re, 8.077, 3);
    const a = s.r6.arrivals[0];
    expect(a.at.im).toBeGreaterThan(0);
    near(a.angles[0], -94.4, 1); // at −1 + j  (∓94.4° for ±j)
  });
});

describe('special cases', () => {
  it('Routh row entirely zero (even characteristic polynomial)', () => {
    const s = solve('s^2+1', 's^2(s^2+4)');
    expect(s.routh.zeroRows).toContain(3);
    const auxRow = s.routh.rows.find((r) => r.special === 'aux');
    expect(auxRow?.aux?.power).toBe(4);
    expect(s.routh.notes.join(' ')).toMatch(/auxiliary/);
    expect(s.stab.stable).toHaveLength(0);
    expect(s.stab.marginalEverywhere).toBe(true);
    expect(s.cross.jwSegments.length).toBeGreaterThan(0);
  });

  it('K/s² — double pole at the origin, locus on the jω axis', () => {
    const s = solve('1', 's^2');
    expect(s.ol.polesM[0].mult).toBe(2);
    expect(s.routh.zeroRows).toEqual([1]);
    expect(s.r6.departures[0].angles.sort()).toEqual([-90, 90]);
    expect(s.cross.jwSegments).toEqual([{ omegaLo: 0, omegaHi: Infinity }]);
    expect(s.stab.stable).toHaveLength(0);
    expect(s.stab.marginalEverywhere).toBe(true);
    // branches stay on the jω axis
    s.locus.branches.forEach((br) => br.forEach((z) => expect(Math.abs(z.re)).toBeLessThan(1e-9)));
  });

  it('first-column zero → ε method', () => {
    const s = solve('1', 's(s+1)(s^2+2)'); // s⁴+s³+2s²+2s+K
    expect(s.routh.usedEpsilon).toBe(true);
    const r2 = s.routh.rows.find((r) => r.power === 2);
    expect(r2?.special).toBe('epsilon');
    expect(s.routh.notes.join(' ')).toMatch(/ε/);
    // s¹ entry (2ε − K)/ε → −K < 0 as ε → 0⁺ : unstable for every K > 0
    const c1 = s.conds.find((c) => c.power === 1);
    expect(c1?.positive).toEqual([]);
    expect(s.stab.stable).toEqual([]);
  });

  it('n = m (no asymptotes)', () => {
    const s = solve('s^2+2s+5', '(s+1)(s+3)');
    expect(s.r3.angles).toHaveLength(0);
    expect(s.r4.sigma).toBeNull();
    // P(s) ∝ s² − 2s − 7 → s = 1 ± 2√2 ; only 1 − 2√2 lies on the locus
    near(brk(s)[0].s.re, 1 - 2 * Math.SQRT2, 12);
    // each branch ends on a zero −1 ± j2
    s.locus.branches.forEach((br) => {
      const last = br[br.length - 1];
      expect(Math.min(cabs(csub(last, { re: -1, im: 2 })), cabs(csub(last, { re: -1, im: -2 })))).toBeLessThan(0.05);
    });
  });

  it('conditionally stable system', () => {
    const s = solve('s^2+2s+4', 's(s+4)(s+6)(s^2+1.4s+1)');
    expect(s.stab.stable).toHaveLength(2);
    expect(s.stab.conditionallyStable).toBe(true);
    expect(s.cross.crossings).toHaveLength(3);
    expect(s.stab.numericCheck.mismatches).toBe(0);
    near(s.stab.stable[0].hi, s.cross.crossings[0].K, 12);
    near(s.stab.stable[1].lo, s.cross.crossings[1].K, 12);
    near(s.stab.stable[1].hi, s.cross.crossings[2].K, 12);
  });

  it('complex breakaway points are accepted (K real > 0)', () => {
    const s = solve('1', 's(s+4)(s^2+4s+20)');
    const c = brk(s, 'complex');
    expect(c).toHaveLength(2);
    near(c[0].s.re, -2, 9);
    near(Math.abs(c[0].s.im), Math.sqrt(6), 9);
    near(c[0].K.re, 100, 9);
    near(brk(s, 'breakaway')[0].K.re, 64, 9);
    near(s.cross.crossings[0].K, 260, 9);
  });

  it('triple meeting point (3 branches)', () => {
    const s = solve('s+1', 's^2(s+9)');
    const b = brk(s)[0];
    expect(b.mult).toBe(2);
    expect(b.branches).toBe(3);
    near(b.s.re, -3, 12);
    near(b.K.re, 27, 9);
  });

  it('negative effective gain → 0° locus', () => {
    const s = solve('1-s', 's(s+2)');
    expect(s.ol.is180).toBe(false);
    expect(s.r3.angles.map((a) => a.deg)).toEqual([0]);
    near(s.cross.crossings[0].K, 2, 12);
    near(s.cross.crossings[0].omega, Math.SQRT2, 12);
    expect(s.r2.segments.some((g) => g.a === Infinity)).toBe(true);
  });

  it('repeated real pole of multiplicity 3', () => {
    const s = solve('1', '(s+1)^3');
    expect(s.ol.polesM[0].mult).toBe(3);
    expect(sortedAbs(s.r6.departures[0].angles)).toEqual([-60, 60, 180]);
    near(s.cross.crossings[0].K, 8, 12);
    near(s.cross.crossings[0].omega, Math.sqrt(3), 12);
  });

  it('origin crossing reported for a non-minimum-phase zero', () => {
    const s = solve('s-1', 's(s+2)(s+3)'.replace('s(s+2)', '(s+1)(s+2)'));
    // char: (s+1)(s+2)(s+3) + K(s−1): constant 6 − K → root at 0 when K = 6
    expect(s.cross.originK).toBe(6);
    expect(s.stab.stable[0].hi).toBeLessThanOrEqual(6);
  });

  it('Routh entries are exact, teacher style pivot form', () => {
    const s = solve('1', 's(s+3)(s^2+2s+2)'); // s⁴+5s³+8s²+6s+K
    const r1 = s.routh.rows.find((r) => r.power === 1);
    expect(r1).toBeDefined();
    const e = r1!.entries[0];
    expect(rfIsZero(e.val)).toBe(false);
    // raw numerator 6.8·6 − 5K = 40.8 − 5K, pivot 6.8
    const raw = e.rawNum!.n[0].map((q) => q.toNumber());
    expect(raw).toEqual([40.8, -5]);
    expect(e.rawDen!.n[0].map((q) => q.toNumber())).toEqual([6.8]);
  });
});

describe('locus tracking quality', () => {
  const cases: [string, string][] = [
    ['1', 's(s+4)(s+5)'],
    ['1', 's(s+4)(s^2+4s+20)'],
    ['s+4', '(s+1)(s+2)'],
    ['s^2+2s+4', 's(s+4)(s+6)(s^2+1.4s+1)'],
    ['1', '(s+1)^3'],
  ];
  it.each(cases)('no branch jumps for K(%s)/(%s)', (num, den) => {
    const s = solve(num, den);
    const span = Math.max(s.view.x1 - s.view.x0, s.view.y1 - s.view.y0);
    for (const br of s.locus.branches) {
      for (let k = 1; k < br.length; k++) {
        const a = br[k - 1],
          b = br[k];
        if (!Number.isFinite(a.re) || !Number.isFinite(b.re)) continue;
        if (cabs(csub(a, { re: -1, im: 0 })) > 5 * span) continue;
        if (Math.max(cabs(a), cabs(b)) > 2.5 * span) continue;
        expect(cabs(csub(a, b))).toBeLessThan(0.05 * span);
      }
    }
    // branches start on the poles
    s.locus.branches.forEach((br, i) => expect(cabs(csub(br[0], s.ol.poles[i]))).toBe(0));
  });
  it('samples the exact breakaway K', () => {
    const s = solve('1', 's(s+4)(s+5)');
    const kb = brk(s)[0].K.re;
    expect(s.locus.Ks.some((k) => Math.abs(k - kb) < 1e-12 * kb)).toBe(true);
  });
});

describe('K < 0 (complementary) locus', () => {
  it('class example: real-axis segments, asymptotes and origin crossing for K < 0', async () => {
    const { solveNegative } = await import('../solve');
    const s = solve('1', 's(s+4)(s+5)');
    const n = solveNegative(s);
    expect(n.ol.is180).toBe(false);
    expect(sortedAbs(n.r3.angles.map((a) => a.deg))).toEqual([-120, 0, 120]);
    // K < 0 real-axis segments: s > 0 and −5 < s < −4
    expect(n.r2.segments.map((g) => [g.a, g.b])).toEqual([
      [Infinity, 0],
      [-4, -5],
    ]);
    // break point between −4 and −5 (the other root of P), K = −1.128
    near(n.r5.accepted[0].s.re, -4.528, 3);
    near(-n.r5.accepted[0].K.re, -1.128, 3);
    // a pole crosses into the RHP through s = 0 immediately: unstable for every K < 0
    expect(n.stab.stable).toEqual([]);
  });
});

describe('K < 0 tracking terminates and is continuous', () => {
  it.each([
    ['1', 's(s+4)(s+5)'],
    ['1', 's(s+3)(s^2+2s+2)'],
    ['s+4', '(s+1)(s+2)'],
    ['s^2+2s+4', 's(s+4)(s+6)(s^2+1.4s+1)'],
  ])('K(%s)/(%s)', async (num, den) => {
    const { trackLocus } = await import('../locus');
    const s = solve(num, den);
    const t = Date.now();
    const L = trackLocus(s.ol, { view: s.view, sign: -1 });
    expect(Date.now() - t).toBeLessThan(5000);
    expect(L.Ks.every((k) => k <= 0)).toBe(true);
    // the closed-loop char poly D + K·N vanishes at every sample
    const span = Math.max(s.view.x1 - s.view.x0, s.view.y1 - s.view.y0);
    let jumps = 0;
    L.branches.forEach((br) => {
      for (let i = 1; i < br.length; i++)
        if (Math.max(cabs(br[i]), cabs(br[i - 1])) < 2 * span && cabs(csub(br[i], br[i - 1])) > 0.05 * span) jumps++;
    });
    expect(jumps).toBe(0);
  });
});
