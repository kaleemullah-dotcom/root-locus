/** Auto-generated plain-English description of the locus (ported from the prototype, generalised). */
import type { Solution } from '../engine';
import { fpair, tnum, fcomplex } from '../engine/latex';
import { stabilityText } from './content';

const t = (x: number, d = 2): string => tnum(x, d);

export function describe(sol: Solution): string[] {
  const { ol, r2, r3, r4, r5, r6, cross } = sol;
  const out: string[] = [];
  const uniq = (zs: typeof ol.poles): string[] => {
    const seen = new Set<string>();
    const res: string[] = [];
    for (const z of zs) {
      if (z.im < 0) continue;
      const k = fpair(z, 2, true);
      if (seen.has(k)) continue;
      seen.add(k);
      const mult = zs.filter((w) => w.re === z.re && w.im === z.im).length;
      res.push(mult > 1 ? `${k} (×${mult})` : k);
    }
    return res;
  };
  out.push(
    `**Start (K = 0):** ${ol.n} branch${ol.n > 1 ? 'es' : ''} leave the poles ${uniq(ol.poles).join(', ')}. ` +
      (ol.m
        ? `${ol.m} end${ol.m === 1 ? 's' : ''} on the zero${ol.m > 1 ? 's' : ''} ${uniq(ol.zeros).join(', ')}; ${ol.q} go${ol.q === 1 ? 'es' : ''} to ∞.`
        : 'No finite zeros, so all go to ∞.'),
  );
  if (!ol.is180)
    out.push('**0° locus:** the effective gain is negative, so the complementary (0°) angle condition applies.');
  const seg = r2.segments.map((g) => {
    const a = g.a === Infinity ? '+∞' : t(g.a),
      b = g.b === -Infinity ? '−∞' : t(g.b);
    if (g.pieces.length === 1) return `on (${b}, ${a}) the branch moves **${g.pieces[0].dir < 0 ? 'left' : 'right'}**`;
    return `on (${b}, ${a}) the arrows point ${g.pieces.map((p) => (p.dir < 0 ? '←' : '→')).join(' ')}`;
  });
  if (seg.length) out.push(`**Real axis (with direction):** ${seg.join('; ')}.`);
  const acc = r5.accepted;
  if (acc.length)
    out.push(
      acc
        .map((c) =>
          c.kind === 'entry'
            ? `**Entry point:** branches join the real axis at **s = ${t(c.s.re)} (K = ${t(c.K.re)})**.`
            : c.kind === 'complex'
              ? c.s.im > 0
                ? `**Complex break points:** branches meet at **s = ${fpair(c.s, 2, true)} (K = ${t(c.K.re)})**.`
                : ''
              : `**Breakaway:** ${c.branches} branches meet at **s = ${t(c.s.re)} (K = ${t(c.K.re)})** and leave at ±${t(c.breakAngle, 0)}°.`,
        )
        .filter(Boolean)
        .join(' '),
    );
  else out.push('**No breakaway / entry point** on the real axis.');
  const dep = r6.departures.filter((d) => d.at.im > 0);
  if (dep.length)
    out.push(
      `**Complex poles:** ${dep.map((d) => `from ${fpair(d.at, 2, true)} depart at ${d.angles[0] < 0 ? '∓' : '±'}${t(Math.abs(d.angles[0]), 1)}°`).join('; ')}.`,
    );
  const arr = r6.arrivals.filter((d) => d.at.im > 0);
  if (arr.length)
    out.push(
      `**Complex zeros:** ${arr.map((d) => `approached at ${d.angles[0] < 0 ? '∓' : '±'}${t(Math.abs(d.angles[0]), 1)}° into ${fpair(d.at, 2, true)}`).join('; ')}.`,
    );
  if (ol.q >= 2 && r4.sigma !== null)
    out.push(
      `**Asymptotes:** ${ol.q} lines at ${[...new Set(r3.angles.map((a) => Math.abs(a.deg)))]
        .map((v) => (v === 180 || v === 0 ? '' : '±') + t(v, 1) + '°')
        .join(', ')} from σ = ${t(r4.sigma)}.`,
    );
  if (cross.crossings.length)
    out.push(
      `**jω crossing:** ${cross.crossings.map((c) => `±j${t(c.omega, 3)} at K = ${t(c.K, 3)}`).join('; ')}. ${stabilityText(sol)}.`,
    );
  else if (cross.jwSegments.length) out.push(`**jω axis:** part of the locus lies on the jω axis. ${stabilityText(sol)}.`);
  else out.push(`**jω axis:** never crossed. ${stabilityText(sol)}.`);
  if (cross.originK !== null) out.push(`A real closed-loop pole passes through s = 0 at K = ${t(cross.originK, 3)}.`);
  if (sol.stab.conditionallyStable) out.push('**Conditionally stable:** increasing or decreasing K can destabilise the loop.');
  void fcomplex;
  return out;
}
