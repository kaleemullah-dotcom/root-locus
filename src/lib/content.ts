/**
 * Teacher-style content for the 7-rule table. Strings use `$…$` for KaTeX and `**…**` for bold
 * (rendered by <MathText>). Pure: no React.
 */
import type { Complex, Solution } from '../engine';
import { polyTex, fnum, tnum, fcomplex, fpair, routhEntryTex, polyKTex, qnum } from '../engine/latex';
import { qder, qToFloat, qdeg } from '../engine/qpoly';
import { intervalsText } from '../engine/routh';

export type RuleId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7';
export interface RuleRow {
  id: RuleId;
  name: string;
  formula: string[];
  calc: string[];
  results: string[];
  remarks: string;
}

const deg = (x: number, d = 2): string => `${fnum(x, d)}^\\circ`;
const n3 = (x: number): string => fnum(x, 3);
/** plain-text number (typographic minus) */
const t3 = (x: number, d = 3): string => tnum(x, d);

/** P1…Pn / z1…zm names following the teacher ordering. */
export function namer(sol: Solution): { pole: (x: Complex) => string; zero: (x: Complex) => string; atReal: (x: number) => string } {
  const same = (a: Complex, b: Complex): boolean => Math.abs(a.re - b.re) < 1e-9 && Math.abs(a.im - b.im) < 1e-9;
  const pole = (z: Complex): string => {
    const ids = sol.ol.poles.map((p, i) => (same(p, z) ? i + 1 : 0)).filter(Boolean);
    return ids.length ? ids.map((i) => `P_{${i}}`).join(',') : '';
  };
  const zero = (z: Complex): string => {
    const ids = sol.ol.zeros.map((p, i) => (same(p, z) ? i + 1 : 0)).filter(Boolean);
    return ids.length ? ids.map((i) => `z_{${i}}`).join(',') : '';
  };
  const atReal = (x: number): string => {
    const p = pole({ re: x, im: 0 }),
      z = zero({ re: x, im: 0 });
    return [p, z].filter(Boolean).join(',');
  };
  return { pole, zero, atReal };
}

export function stabilityText(sol: Solution): string {
  const st = sol.stab;
  if (st.marginalEverywhere) return 'Marginally stable for every K > 0 (closed-loop poles on the jω axis)';
  if (!st.stable.length) return 'Unstable for every K > 0';
  const parts = st.stable.map(({ lo, hi }) =>
    hi === Infinity ? (lo === 0 ? 'all K > 0' : `K > ${t3(lo)}`) : `${lo === 0 ? '0' : t3(lo)} < K < ${t3(hi)}`,
  );
  return 'Stable for ' + parts.join(' and ');
}

export function buildRows(sol: Solution): RuleRow[] {
  const { ol, r1, r2, r3, r4, r5, r6 } = sol;
  const nm = namer(sol);
  const is180 = ol.is180;
  const rows: RuleRow[] = [];
  const list = (zs: Complex[]): string => zs.map((z) => `$${fcomplex(z)}$`).join(', ');

  // ---------------------------------------------------------------- R1
  rows.push({
    id: 'R1',
    name: 'No. of Branches',
    formula: ['$= n$, if $n \\ge m$', 'otherwise $m$'],
    calc: [
      `$n = ${r1.n}$ (poles: ${list(ol.poles)})`,
      `$m = ${r1.m}$ ${r1.m ? `(zeros: ${list(ol.zeros)})` : '(no finite zeros)'}`,
      `$n \\ge m \\Rightarrow$ branches $= n$`,
    ],
    results: [`**Branches $= ${r1.branches}$**`],
    remarks:
      `Branches start at the ${ol.n} poles (K = 0). ` +
      (ol.m
        ? `${ol.m} end${ol.m === 1 ? 's' : ''} on the finite zero${ol.m > 1 ? 's' : ''}; ${ol.q} go${ol.q === 1 ? 'es' : ''} to ∞.`
        : `All ${ol.n} go to ∞.`),
  });

  // ---------------------------------------------------------------- R2
  const parity = is180 ? 'odd' : 'even';
  const iv = (a: number, b: number): string =>
    a === Infinity && b === -Infinity
      ? '$-\\infty < s < \\infty$'
      : a === Infinity
        ? `$s > ${n3(b)}$`
        : b === -Infinity
          ? `$s < ${n3(a)}$`
          : `$${n3(a)} > s > ${n3(b)}$`;
  const tests = r2.tests.map(
    (t) => `${iv(t.a, t.b)}: ${t.countRight} to the right → ${t.on ? `${parity} ✓` : `${t.countRight % 2 ? 'odd' : 'even'} ✗`}`,
  );
  const node = (x: number, kind: 'end' | 'cut'): string => {
    if (x === Infinity) return '$+\\infty$';
    if (x === -Infinity) return '$-\\infty$';
    if (kind === 'cut') {
      const b = r5.accepted.find((c) => c.s.im === 0 && Math.abs(c.s.re - x) < 1e-9);
      const sub = b?.kind === 'entry' ? 'e' : 'b';
      return `$s_${sub}$`;
    }
    const name = nm.atReal(x);
    return `$${name ? `${name}\\,(${n3(x)})` : n3(x)}$`;
  };
  const segRes: string[] = [];
  const dirText: string[] = [];
  for (const g of r2.segments) {
    let s = node(g.a, 'end');
    g.pieces.forEach((p, k) => {
      s += p.dir < 0 ? ' $\\rightarrow$ ' : ' $\\leftarrow$ ';
      s += node(p.b, k === g.pieces.length - 1 ? 'end' : 'cut');
    });
    segRes.push(`**${s}**`);
    const a = g.a === Infinity ? '+∞' : t3(g.a, 2);
    const b = g.b === -Infinity ? '−∞' : t3(g.b, 2);
    if (g.pieces.length === 1) dirText.push(`on (${b}, ${a}) the branch moves ${g.pieces[0].dir < 0 ? 'left' : 'right'}`);
    else {
      const meet = g.pieces.slice(0, -1).map((p) => t3(p.b, 2));
      const kinds = g.pieces[0].dir > 0 && g.pieces[g.pieces.length - 1].dir < 0 ? 'enter at' : 'meet at';
      dirText.push(`on (${b}, ${a}) branches ${kinds} ${meet.join(' and ')}`);
    }
  }
  rows.push({
    id: 'R2',
    name: 'Real Axis Segment',
    formula: is180
      ? ['All points to the **left** of an **odd** number of (real) poles + zeros']
      : ['0° locus: all points to the **left** of an **even** number (incl. 0) of real poles + zeros'],
    calc: [...(r2.hasComplex ? ['Count only REAL poles/zeros (complex pairs cancel).'] : []), ...tests],
    results: segRes.length ? segRes : ['**No real-axis segment**'],
    remarks: segRes.length
      ? `Arrows show the direction of increasing K: ${dirText.join('; ')}.`
      : 'No part of the real axis is on the locus.',
  });

  // ---------------------------------------------------------------- R3
  const q = ol.q;
  const baseTex = is180 ? '180^\\circ + 360^\\circ i' : '360^\\circ i';
  const shown = [...new Set(r3.angles.map((a) => Math.abs(a.deg)))].sort((x, y) => x - y);
  rows.push({
    id: 'R3',
    name: 'Angles of Asymptotes',
    formula: [`$\\theta_k = \\dfrac{${baseTex}}{n-m}$`, '$i = 0, \\pm1, \\pm2, \\ldots$'],
    calc: q
      ? [
          `$\\theta_k = \\dfrac{${is180 ? '180 + 360i' : '360i'}}{${q}}$`,
          ...r3.angles.map(
            (a) => `$i = ${a.i} \\rightarrow ${deg(a.raw)}$` + (Math.abs(a.raw - a.deg) > 1e-9 ? ` $(\\equiv ${deg(a.deg)})$` : ''),
          ),
        ]
      : ['$n - m = 0 \\Rightarrow$ no asymptotes'],
    results: q
      ? [`**$\\theta_k = ${shown.map((v) => (v === 0 || v === 180 ? '' : '\\pm') + deg(v)).join(',\\ ')}$**`]
      : ['**NA**'],
    remarks: q
      ? `n − m = ${q} asymptote${q > 1 ? 's' : ''}` +
        (q > 1 ? `, spaced ${fnum(360 / q, 2)}° apart.` : is180 ? ' → along the negative real axis.' : ' → along the positive real axis.')
      : 'Every branch ends on a finite zero.',
  });

  // ---------------------------------------------------------------- R4
  const sumList = (zs: Complex[]): string => (zs.length ? zs.map((z) => `(${fcomplex(z)})`).join(' + ') : '0');
  let rem4: string;
  if (q === 0) rem4 = '—';
  else if (q === 1) rem4 = 'Only one asymptote (along the real axis), so the centroid has no practical use here.';
  else if (r4.tan)
    rem4 = `Teacher's tan-rule: $p = |\\sigma|\\tan\\theta = ${fnum(Math.abs(r4.sigma ?? 0), 2)}\\cdot\\tan ${deg(r4.tan.theta, 1)} = j${fnum(r4.tan.p, 3)}$ (where the asymptote crosses the jω axis).`;
  else if (q === 2) rem4 = 'Asymptotes are vertical lines through σ (parallel to the jω axis).';
  else rem4 = 'Asymptotes radiate from σ.';
  rows.push({
    id: 'R4',
    name: 'Centroid of Asymptotes',
    formula: ['$\\sigma = \\dfrac{\\sum GH\\ \\text{poles} - \\sum GH\\ \\text{zeros}}{n - m}$'],
    calc: q
      ? [
          `$\\sum$ poles $= ${sumList(ol.poles)} = ${fnum(r4.sumPoles)}$`,
          `$\\sum$ zeros $= ${ol.zeros.length ? `${sumList(ol.zeros)} = ${fnum(r4.sumZeros)}` : '0'}$`,
          `$\\sigma = \\dfrac{${fnum(r4.sumPoles)} - (${fnum(r4.sumZeros)})}{${q}} = ${fnum(r4.sigma ?? 0)}$`,
        ]
      : ['$n - m = 0 \\Rightarrow$ NA'],
    results: [q ? `**$\\sigma = ${fnum(r4.sigma ?? 0)}$**` : '**NA**'],
    remarks: rem4,
  });

  // ---------------------------------------------------------------- R5
  const N = ol.N,
    D = ol.D;
  const nConst = qdeg(N) === 0;
  const c5: string[] = [
    `$N = ${polyTex(N)},\\quad N' = ${polyTex(qToFloat(qder(N)))}$`,
    `$D = ${polyTex(D)}$`,
    `$D' = ${polyTex(qder(D))}$`,
    nConst
      ? `$P = N D' - N' D = ${N[0].isOne() ? "D'" : `${qnum(N[0])}\\,D'`}$:`
      : `$P = N D' - N' D$:`,
    `**$${polyTex(r5.P)} = 0$**`,
  ];
  if (r5.removed.length)
    c5.push(
      `(roots at repeated ${[...new Set(r5.removed.map((r) => r.at))].join('/')}s: ${r5.removed
        .map((r) => `$${fcomplex(r.s)}$`)
        .join(', ')} — K = ${r5.removed[0].at === 'pole' ? '0' : '∞'}, not break points)`,
    );
  r5.candidates.forEach((c, k) => {
    const mult = c.mult > 1 ? ` (×${c.mult})` : '';
    c5.push(`$s_{${k + 1}} = ${fcomplex(c.s)}$${mult} ${c.ok ? '✓' : `✗ ${c.why}`}`);
  });
  r5.accepted.forEach((c) => {
    const kindTxt =
      c.kind === 'breakaway'
        ? "$\\frac{d^2K}{ds^2} < 0$ (K max) ⇒ breakaway"
        : c.kind === 'entry'
          ? "$\\frac{d^2K}{ds^2} > 0$ (K min) ⇒ entry"
          : c.kind === 'saddle'
            ? `${c.branches} branches meet (K monotonic) ⇒ breakaway & entry`
            : 'complex break point';
    c5.push(`$K = -D/N\\,|_{s = ${fcomplex(c.s)}} = ${n3(c.K.re)}$ → ${kindTxt}`);
  });
  const sub = (c: (typeof r5.accepted)[number]): string =>
    c.kind === 'entry' ? 'ent' : c.kind === 'complex' ? 'c' : 'brk';
  const res5 = r5.accepted.length
    ? r5.accepted.map((c) => `**$s_{${sub(c)}} = ${fcomplex(c.s)},\\ K = ${n3(c.K.re)}$**`)
    : ['**NA** (no valid root)'];
  const rejected = r5.candidates.filter((c) => !c.ok);
  const rem5 =
    (r5.accepted.length
      ? r5.accepted
          .map((c) =>
            c.kind === 'entry'
              ? `Branches enter the real axis at ${t3(c.s.re, 2)}.`
              : c.kind === 'complex'
                ? `Branches meet off the real axis at ${fcomplex(c.s, 2, true)} and split at ±${fnum(c.breakAngle, 0)}°.`
                : c.kind === 'saddle'
                  ? `${c.branches} branches meet at ${t3(c.s.re, 2)}; they separate ${fnum(360 / c.branches, 0)}° apart.`
                  : `Branches meet at ${t3(c.s.re, 2)} and leave the real axis at ±${fnum(c.breakAngle, 0)}°.`,
          )
          .join(' ')
      : 'No breakaway/entry point: branches never meet on the real axis.') +
    (rejected.length ? ` Rejected ${rejected.length} root${rejected.length > 1 ? 's' : ''} of P(s) (✗).` : '');
  rows.push({
    id: 'R5',
    name: 'Breakaway / Entry Points',
    formula: [
      "$P = N D' - N' D = 0$",
      '$K_{brk} = -D/N\\,|_{s = s_{brk}}$',
      '$K_{ent} = -D/N\\,|_{s = s_{ent}}$',
    ],
    calc: c5,
    results: res5,
    remarks: rem5,
  });

  // ---------------------------------------------------------------- R6
  const c6: string[] = [];
  const res6: string[] = [];
  const terms = (t: { from: Complex; angle: number; mult: number }[], what: string): string[] =>
    t.map((o) => `∠ from ${what} $${fcomplex(o.from)}$: $${deg(o.angle)}$${o.mult > 1 ? ` ×${o.mult}` : ''}`);
  const b6 = is180 ? 180 : 0;
  for (const d of r6.departures) {
    const name = nm.pole(d.at).split(',')[0];
    c6.push(`**At $${name} = ${fcomplex(d.at)}$:**`);
    c6.push(...terms(d.poleTerms, 'pole'), ...terms(d.zeroTerms, 'zero'));
    const mul = d.mult > 1 ? `\\dfrac{1}{${d.mult}}\\big(` : '';
    const end = d.mult > 1 ? ` + 360^\\circ l\\big)` : '';
    c6.push(
      `$\\phi_{dp} = ${mul}-(${fnum(d.sumPoles, 2)}) + ${fnum(d.sumZeros, 2)}${b6 ? ' + 180' : ''}${end} = ${deg(d.raw / (d.mult || 1))}$` +
        (d.mult === 1 && Math.abs(d.raw - d.angles[0]) > 1e-6 ? ` $\\equiv ${deg(d.angles[0])}$` : ''),
    );
    if (d.at.im !== 0) {
      const conj = nm.pole({ re: d.at.re, im: -d.at.im }).split(',')[0];
      res6.push(`**$\\phi_d(${name}) = ${d.angles.map((a) => deg(a)).join(', ')}$**`);
      res6.push(`**$\\phi_d(${conj}) = ${d.angles.map((a) => deg(-a)).join(', ')}$**`);
    } else res6.push(`**$\\phi_d(${name}) = ${d.angles.map((a) => deg(a)).join(',\\ ')}$**`);
  }
  for (const d of r6.arrivals) {
    const name = nm.zero(d.at).split(',')[0];
    c6.push(`**At $${name} = ${fcomplex(d.at)}$:**`);
    c6.push(...terms(d.zeroTerms, 'zero'), ...terms(d.poleTerms, 'pole'));
    c6.push(
      `$\\phi_{az} = -(${fnum(d.sumZeros, 2)}) + ${fnum(d.sumPoles, 2)}${b6 ? ' - 180' : ''} = ${deg(d.raw / d.mult)}$` +
        (d.mult === 1 && Math.abs(d.raw - d.angles[0]) > 1e-6 ? ` $\\equiv ${deg(d.angles[0])}$` : ''),
    );
    if (d.at.im !== 0) {
      const conj = nm.zero({ re: d.at.re, im: -d.at.im }).split(',')[0];
      res6.push(`**$\\phi_a(${name}) = ${d.angles.map((a) => deg(a)).join(', ')}$**`);
      res6.push(`**$\\phi_a(${conj}) = ${d.angles.map((a) => deg(-a)).join(', ')}$**`);
    } else res6.push(`**$\\phi_a(${name}) = ${d.angles.map((a) => deg(a)).join(',\\ ')}$**`);
  }
  let rem6: string;
  if (!r6.departures.length && !r6.arrivals.length) rem6 = 'R6 is only needed for complex (or repeated) poles / zeros.';
  else if (r6.departures.length) {
    const d = r6.departures.find((x) => x.at.im > 0) ?? r6.departures[0];
    rem6 =
      d.at.im > 0
        ? `The complex poles leave ${Math.abs(d.angles[0]) < 90 ? 'toward the right (jω axis)' : 'toward the left'}, then bend onto their asymptotes${ol.m ? ' or zeros' : ''}.`
        : `The ${d.mult} coincident poles at ${t3(d.at.re, 2)} split ${fnum(360 / d.mult, 0)}° apart.`;
  } else rem6 = 'Branches arrive at the complex zeros at the angle shown.';
  rows.push({
    id: 'R6',
    name: 'Angle of Departure / Approach',
    formula: is180
      ? [
          '$\\phi_{dp} = -\\sum \\text{other GH pole}\\ \\angle s + \\sum \\text{GH zero}\\ \\angle s + 180^\\circ$',
          '$\\phi_{az} = -\\sum \\text{other GH zero}\\ \\angle s + \\sum \\text{GH pole}\\ \\angle s - 180^\\circ$',
        ]
      : [
          '$\\phi_{dp} = -\\sum \\text{other GH pole}\\ \\angle s + \\sum \\text{GH zero}\\ \\angle s$ (0° locus)',
          '$\\phi_{az} = -\\sum \\text{other GH zero}\\ \\angle s + \\sum \\text{GH pole}\\ \\angle s$',
        ],
    calc: c6.length ? c6 : ['No complex poles / zeros exist'],
    results: res6.length ? res6 : ['**NA**'],
    remarks: rem6,
  });

  // ---------------------------------------------------------------- R7
  rows.push(buildR7(sol));
  return rows;
}

export function charEqTex(sol: Solution): string {
  const N = sol.ol.N;
  const nTex = polyTex(N);
  const kPart = qdeg(N) === 0 ? (N[0].isOne() ? 'K' : `${qnum(N[0])}K`) : `K(${nTex})`;
  return `${polyTex(sol.ol.D)} + ${kPart} = 0`;
}

function buildR7(sol: Solution): RuleRow {
  const { cross, routh } = sol;
  const ch = charEqTex(sol);
  const calc: string[] = [`$${ch}$`, 'Routh array (below):'];
  const results: string[] = [];
  if (cross.crossings.length) {
    for (const c of cross.crossings) {
      const row = routh.rows.find((r) => r.power === c.routhPower);
      if (row) calc.push(`$s^{${row.power}}$ row: $${routhEntryTex(row.entries[0])} = 0 \\Rightarrow K_x = ${n3(c.K)}$`);
      else calc.push(`jω method: $K_x = ${n3(c.K)}$`);
      if (c.aux && c.auxPower !== null) {
        calc.push(`Aux. eq. ($s^{${c.auxPower}}$ row): $${polyTex(c.aux, 's', 3)} = 0$`);
        calc.push(`$\\Rightarrow s = \\pm j${n3(c.omega)}$`);
      } else calc.push(`$\\Rightarrow s = \\pm j${n3(c.omega)}$`);
      results.push(`**$K_x = ${n3(c.K)}$**`, `**$s_x = \\pm j${n3(c.omega)}$**`);
    }
  } else if (!cross.jwSegments.length) {
    calc.push('First column: no K > 0 makes a row vanish with jω roots', '⇒ no jω crossing');
    results.push('**No jω crossing**');
  }
  if (cross.originK !== null) {
    calc.push(`$s^{0}$ row: $${routhEntryTex(routh.rows[routh.rows.length - 1].entries[0])} = 0 \\Rightarrow K = ${n3(cross.originK)}$ (root at $s = 0$)`);
    results.push(`**$K = ${n3(cross.originK)}$: root crosses at $s = 0$**`);
  }
  if (cross.jwSegments.length) {
    calc.push('$D(j\\omega)/N(j\\omega)$ is real for every ω ⇒ part of the jω axis is ON the locus');
    results.push(
      `**Locus on the jω axis:** ${cross.jwSegments
        .map((g) => `$${n3(g.omegaLo)} \\le \\omega ${g.omegaHi === Infinity ? '' : `\\le ${n3(g.omegaHi)}`}$`)
        .join(', ')}`,
    );
  }
  if (routh.usedEpsilon) calc.push('ε method used (see Routh notes).');
  if (routh.zeroRows.length) calc.push(`Row(s) $s^{${routh.zeroRows.join('}, s^{')}}$ identically zero → auxiliary polynomial.`);
  const stab = stabilityText(sol);
  results.push(stab);
  const rem =
    `${stab}.` +
    (sol.r4.tan && cross.crossings.length
      ? ` Tan-rule estimate $j${fnum(sol.r4.tan.p, 2)}$ vs exact $j${n3(cross.crossings[0].omega)}$.`
      : '');
  return {
    id: 'R7',
    name: 'jω Crossing Points',
    formula: ['$1 + KG(s)H(s) = 0$', 'Find $s_x$ & $K_x$ using Routh table'],
    calc,
    results,
    remarks: rem,
  };
}

/** Routh first-column conditions for the panel. */
export function conditionLines(sol: Solution): string[] {
  return sol.conds
    .filter((c) => !c.constant)
    .map((c) => {
      const row = sol.routh.rows.find((r) => r.power === c.power);
      const expr = row ? routhEntryTex(row.entries[0]) : '';
      return `$s^{${c.power}}: ${expr} > 0 \\Rightarrow$ **${intervalsText(c.positive)}**`;
    });
}

export { polyKTex, fpair };
