import { memo, useId } from 'react';
import type { Complex, Solution, ViewBox } from '../engine';
import { autoView, featureBox } from '../engine/view';
import type { RuleId } from '../lib/content';
import { COL, LabelPlacer, arrowHead, branchPath, makePlane, type Plane } from '../plot/plane';
import { fcomplex, tnum } from '../engine/latex';
import { rich } from './MainPlot';

const W = 176,
  H = 118;

/** View for real-axis sketches (R2 / R5): spans the critical points. */
function realView(sol: Solution): ViewBox {
  const xs = [...sol.r2.crit, 0, ...sol.r5.accepted.filter((c) => c.s.im === 0).map((c) => c.s.re)];
  let x0 = Math.min(...xs),
    x1 = Math.max(...xs);
  const sp = Math.max(x1 - x0, Math.max(Math.abs(x0), Math.abs(x1)) * 0.5, 1e-9) || 1;
  x0 -= 0.22 * sp;
  x1 += 0.22 * sp;
  if (sol.r2.segments.some((g) => g.b === -Infinity)) x0 -= 0.25 * sp;
  if (sol.r2.segments.some((g) => g.a === Infinity)) x1 += 0.25 * sp;
  const hh = (x1 - x0) / (W / H) / 2;
  return { x0, x1, y0: -hh, y1: hh };
}

/** Tighter view than the main plot so the small sketch is readable. */
function miniView(sol: Solution): ViewBox {
  const v = autoView(featureBox(sol.features), W / H);
  const cx = (v.x0 + v.x1) / 2,
    s = 0.82;
  return { x0: cx + (v.x0 - cx) * s, x1: cx + (v.x1 - cx) * s, y0: v.y0 * s, y1: v.y1 * s };
}

function pz(sol: Solution, P: Plane, out: JSX.Element[], labels: boolean): void {
  sol.ol.zerosM.forEach((r, i) =>
    out.push(<circle key={`z${i}`} cx={P.X(r.z.re)} cy={P.Y(r.z.im)} r={3.8} fill="#fff" stroke={COL.pole} strokeWidth={1.8} />),
  );
  sol.ol.polesM.forEach((r, i) => {
    const x = P.X(r.z.re),
      y = P.Y(r.z.im),
      s = 3.8;
    out.push(<path key={`p${i}`} d={`M${x - s} ${y - s}L${x + s} ${y + s}M${x - s} ${y + s}L${x + s} ${y - s}`} stroke={COL.pole} strokeWidth={2} strokeLinecap="round" />);
  });
  if (labels) {
    let pi = 0,
      zi = 0;
    sol.ol.polesM.forEach((r, i) => {
      const names = Array.from({ length: r.mult }, () => `P_${++pi}`).join(',');
      out.push(
        <text key={`pl${i}`} x={P.X(r.z.re) - 3} y={P.Y(r.z.im) - 7 - (i % 2) * 9} fontSize={8.5} fill="#222">
          {rich(names)}
        </text>,
      );
    });
    sol.ol.zerosM.forEach((r, i) => {
      const names = Array.from({ length: r.mult }, () => `z_${++zi}`).join(',');
      out.push(
        <text key={`zl${i}`} x={P.X(r.z.re) + 4} y={P.Y(r.z.im) + 12} fontSize={8.5} fill="#222">
          {rich(names)}
        </text>,
      );
    });
  }
}

function segments(sol: Solution, P: Plane, out: JSX.Element[], animate: boolean): void {
  const v = P.view;
  sol.r2.segments.forEach((g, i) => {
    const a = Math.min(g.a, v.x1 + 1),
      b = Math.max(g.b, v.x0 - 1);
    out.push(<line key={`s${i}`} x1={P.X(a)} x2={P.X(b)} y1={P.Y(0)} y2={P.Y(0)} stroke={COL.brk} strokeWidth={3} />);
    g.pieces.forEach((p, j) => {
      const pa = Math.min(p.a, v.x1),
        pb = Math.max(p.b, v.x0);
      if (pa <= pb) return;
      const mid = (pa + pb) / 2;
      const x = P.X(mid),
        y = P.Y(0);
      out.push(
        <path
          key={`a${i}-${j}`}
          className={animate ? 'anim-arrow' : undefined}
          style={animate ? ({ ['--nx' as string]: `${p.dir * 3}px` } as React.CSSProperties) : undefined}
          d={arrowHead(x - p.dir * 5, y, x + p.dir * 3, y, 7.5)}
          fill={COL.arrowNavy}
        />,
      );
    });
  });
}

/** Horizontal dashed reference + dotted arc from 0° to `deg` with an arrowhead showing the sense. */
function miniArc(P: Plane, at: Complex, deg: number, color: string, out: JSX.Element[], key: string, r = 13): void {
  const cx = P.X(at.re),
    cy = P.Y(at.im);
  const t = (deg * Math.PI) / 180;
  out.push(<line key={`${key}h`} x1={cx} y1={cy} x2={cx + r + 8} y2={cy} stroke="#495057" strokeWidth={0.9} strokeDasharray="3 2" />);
  const fx = cx + r * Math.cos(t),
    fy = cy - r * Math.sin(t);
  out.push(<path key={`${key}a`} d={`M${cx + r} ${cy}A${r} ${r} 0 0 ${deg > 0 ? 0 : 1} ${fx} ${fy}`} fill="none" stroke={color} strokeWidth={1.2} strokeDasharray="1.5 2" />);
  const dx = deg > 0 ? -Math.sin(t) : Math.sin(t),
    dy = deg > 0 ? -Math.cos(t) : Math.cos(t);
  out.push(<path key={`${key}p`} d={arrowHead(fx - dx * 4, fy - dy * 4, fx, fy, 5)} fill={color} />);
}

function asymptotes(sol: Solution, P: Plane, out: JSX.Element[]): void {
  const s = sol.r4.sigma;
  if (s === null || sol.ol.q < 1) return;
  const L = 10 * (P.view.x1 - P.view.x0);
  sol.r3.angles.forEach((a, i) => {
    const t = (a.deg * Math.PI) / 180;
    out.push(
      <line key={`as${i}`} x1={P.X(s)} y1={P.Y(0)} x2={P.X(s + L * Math.cos(t))} y2={P.Y(L * Math.sin(t))} stroke={COL.asym} strokeWidth={1.2} strokeDasharray="4 3" />,
    );
  });
}

export const MiniSketch = memo(function MiniSketch({ sol, rule, locus }: { sol: Solution; rule: RuleId; locus?: Solution['locus'] }) {
  const uid = useId().replace(/:/g, '');
  const view = rule === 'R2' || rule === 'R5' ? realView(sol) : miniView(sol);
  const P = makePlane(W, H, view);
  const out: JSX.Element[] = [];
  const v = P.view;
  if (v.y0 < 0 && v.y1 > 0) out.push(<line key="ax" x1={0} x2={W} y1={P.Y(0)} y2={P.Y(0)} stroke="#495057" strokeWidth={0.8} />);
  if (v.x0 < 0 && v.x1 > 0) out.push(<line key="ay" x1={P.X(0)} x2={P.X(0)} y1={0} y2={H} stroke="#495057" strokeWidth={0.8} />);
  // value labels (overlap-free): pole/zero locations, angles, centroid, break points, crossings
  const L = new LabelPlacer(P);
  const marks: Array<() => void> = [];
  const FS = 9.5;
  const inV = (z: Complex): boolean => z.re >= v.x0 && z.re <= v.x1 && z.im >= v.y0 && z.im <= v.y1;
  const reserveAll = (): void => {
    [...sol.ol.poles, ...sol.ol.zeros].forEach((z) => L.reservePoint(P.X(z.re), P.Y(z.im), 5));
  };
  const lab = (z: Complex, text: string, color = '#1f2937', prefer: Array<[number, number]> = []): void => {
    if (inV(z)) marks.push(() => L.add(P.X(z.re), P.Y(z.im), text, color, FS, prefer));
  };
  let desc = '';
  switch (rule) {
    case 'R1': {
      pz(sol, P, out, false);
      let pi = 0,
        zi = 0;
      sol.ol.polesM.forEach((r) => {
        const names = Array.from({ length: r.mult }, () => `P_${++pi}`).join(',');
        lab(r.z, `${names} = ${fcomplex(r.z, 2, true)}`, '#1f2937', [[-10, -6]]);
      });
      sol.ol.zerosM.forEach((r) => {
        const names = Array.from({ length: r.mult }, () => `z_${++zi}`).join(',');
        lab(r.z, `${names} = ${fcomplex(r.z, 2, true)}`, '#1f2937', [[-10, 13]]);
      });
      desc = 'Open-loop poles (crosses) and zeros (circles) with their locations.';
      break;
    }
    case 'R2':
      segments(sol, P, out, true);
      pz(sol, P, out, false);
      sol.r2.crit.forEach((x, i) => lab({ re: x, im: 0 }, tnum(x, 2), '#1f2937', [[-6, i % 2 ? -7 : 14]]));
      desc = 'Real-axis segments with arrows for increasing K.';
      break;
    case 'R3': {
      asymptotes(sol, P, out);
      pz(sol, P, out, false);
      const a0 = sol.r3.angles.map((a) => a.deg).filter((d) => d > 1e-9 && d < 180 - 1e-9).sort((x, y) => x - y)[0];
      if (a0 !== undefined && sol.r4.sigma !== null) miniArc(P, { re: sol.r4.sigma, im: 0 }, a0, COL.asym, out, 'r3arc', 14);
      if (sol.r4.sigma !== null) {
        const sg0 = sol.r4.sigma;
        const rr = 0.3 * (v.x1 - v.x0);
        const seen = new Set<string>();
        sol.r3.angles.forEach((a) => {
          const key = a.deg.toFixed(3);
          if (seen.has(key)) return;
          seen.add(key);
          const t = (a.deg * Math.PI) / 180;
          lab({ re: sg0 + rr * Math.cos(t), im: rr * Math.sin(t) }, `${tnum(a.deg, 1)}°`, '#c2410c', [[3, a.deg < 0 ? 10 : -3]]);
        });
      }
      desc = 'Asymptotes with the angle measured from the positive real axis.';
      break;
    }
    case 'R4':
      asymptotes(sol, P, out);
      pz(sol, P, out, false);
      if (sol.r4.sigma !== null && sol.ol.q >= 1) {
        const x = P.X(sol.r4.sigma),
          y = P.Y(0);
        out.push(<rect key="c" x={x - 3.8} y={y - 3.8} width={7.6} height={7.6} transform={`rotate(45 ${x} ${y})`} fill={COL.asym} />);
        L.reservePoint(x, y, 5);
        lab({ re: sol.r4.sigma, im: 0 }, `σ = ${tnum(sol.r4.sigma, 2)}`, '#c2410c', [[-18, 14]]);
      }
      desc = 'Centroid of the asymptotes.';
      break;
    case 'R5': {
      segments(sol, P, out, false);
      pz(sol, P, out, false);
      const h = (v.y1 - v.y0) * 0.32;
      sol.r5.accepted
        .filter((c) => c.s.im === 0)
        .forEach((c, i) => {
          const x = c.s.re;
          out.push(<circle key={`b${i}`} cx={P.X(x)} cy={P.Y(0)} r={3.6} fill={COL.brk} stroke="#fff" strokeWidth={1} />);
          L.reservePoint(P.X(x), P.Y(0), 5);
          lab({ re: x, im: 0 }, `${c.kind === 'entry' ? 's_e' : 's_b'} = ${tnum(x, 2)}`, '#1e6b30', [[4, 14]]);
          if (c.kind !== 'breakaway' && c.kind !== 'entry') return;
          [1, -1].forEach((sg) => {
            const tip = c.kind === 'breakaway' ? sg * h : sg * h * 0.3;
            const tail = c.kind === 'breakaway' ? sg * h * 0.55 : sg * h;
            out.push(<line key={`l${i}${sg}`} x1={P.X(x)} y1={P.Y(0)} x2={P.X(x)} y2={P.Y(sg * h)} stroke={COL.cross} strokeWidth={1.4} />);
            out.push(
              <path
                key={`h${i}${sg}`}
                className="anim-arrow"
                style={{ ['--nx' as string]: '0px', ['--ny' as string]: `${(c.kind === 'breakaway' ? -sg : sg) * 3}px` } as React.CSSProperties}
                d={arrowHead(P.X(x), P.Y(tail), P.X(x), P.Y(tip), 6)} fill={COL.cross} />,
            );
          });
        });
      desc = 'Breakaway / entry points with the branch directions.';
      break;
    }
    case 'R6': {
      pz(sol, P, out, false);
      const Lr = (v.x1 - v.x0) * 0.16;
      const draw = (at: Complex, a: number, arriving: boolean, key: string): void =>
        [1, -1].forEach((sg) => {
          if (at.im === 0 && sg < 0) return;
          const p = { re: at.re, im: sg * at.im };
          const t = (sg * a * Math.PI) / 180;
          const e = { re: p.re + Lr * Math.cos(t), im: p.im + Lr * Math.sin(t) };
          const [s0, s1] = arriving ? [e, p] : [p, e];
          out.push(<line key={`${key}${sg}`} x1={P.X(s0.re)} y1={P.Y(s0.im)} x2={P.X(s1.re)} y2={P.Y(s1.im)} stroke={COL.locus} strokeWidth={1.6} />);
          out.push(<path key={`${key}h${sg}`} d={arrowHead(P.X(s0.re), P.Y(s0.im), P.X(s1.re), P.Y(s1.im), 6)} fill={COL.locus} />);
          if (at.im !== 0) miniArc(P, p, sg * a, COL.locus, out, `${key}arc${sg}`);
        });
      sol.r6.departures.forEach((d, i) => d.angles.forEach((a, j) => draw(d.at, a, false, `d${i}-${j}`)));
      sol.r6.arrivals.forEach((d, i) => d.angles.forEach((a, j) => draw(d.at, a, true, `r${i}-${j}`)));
      sol.r6.departures
        .filter((d) => d.at.im > 0)
        .forEach((d) => {
          lab(d.at, `θ_d = ${tnum(d.angles[0], 1)}°`, '#1d4ed8', [[6, -5]]);
          lab({ re: d.at.re, im: -d.at.im }, `θ_d = ${tnum(-d.angles[0], 1)}°`, '#1d4ed8', [[6, 12]]);
        });
      sol.r6.arrivals
        .filter((d) => d.at.im > 0)
        .forEach((d) => {
          lab(d.at, `θ_a = ${tnum(d.angles[0], 1)}°`, '#1d4ed8', [[6, -5]]);
          lab({ re: d.at.re, im: -d.at.im }, `θ_a = ${tnum(-d.angles[0], 1)}°`, '#1d4ed8', [[6, 12]]);
        });
      desc = 'Angles of departure / arrival.';
      break;
    }
    case 'R7':
      (locus ?? sol.locus).branches.forEach((br, i) =>
        out.push(<path key={`br${i}`} d={branchPath(P, br)} fill="none" stroke={COL.locus} strokeWidth={1.5} />),
      );
      sol.cross.jwSegments.forEach((g, i) =>
        out.push(<line key={`jw${i}`} x1={P.X(0)} x2={P.X(0)} y1={P.Y(Math.min(g.omegaHi, v.y1 * 2))} y2={P.Y(-Math.min(g.omegaHi, v.y1 * 2))} stroke={COL.locus} strokeWidth={2} />),
      );
      pz(sol, P, out, false);
      sol.cross.crossings.forEach((c, i) =>
        [1, -1].forEach((sg) =>
          out.push(<circle key={`x${i}${sg}`} cx={P.X(0)} cy={P.Y(sg * c.omega)} r={3.6} fill={COL.cross} stroke="#fff" strokeWidth={1} />),
        ),
      );
      sol.cross.crossings.forEach((c) => {
        L.reservePoint(P.X(0), P.Y(c.omega), 5);
        L.reservePoint(P.X(0), P.Y(-c.omega), 5);
        lab({ re: 0, im: c.omega }, `±j${tnum(c.omega, 2)}, K_x = ${tnum(c.K, 2)}`, '#6b21a8', [[5, -5]]);
      });
      desc = 'Complete root locus with jω crossings.';
      break;
  }
  reserveAll();
  marks.forEach((f) => f());
  const labelEls = L.placed.map((l, i) => (
    <text key={`lb${i}`} x={l.x} y={l.y} fontSize={l.size} fill={l.color} stroke="#fff" strokeWidth={2.4} paintOrder="stroke" strokeLinejoin="round">
      {rich(l.text)}
    </text>
  ));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full max-w-[176px]" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={`${rule} sketch: ${desc}`} fontFamily="Inter, Arial, sans-serif">
      <rect x={0.5} y={0.5} width={W - 1} height={H - 1} fill="#fff" stroke="#ced4da" rx={3} />
      <clipPath id={`mc-${uid}`}>
        <rect x={1} y={1} width={W - 2} height={H - 2} />
      </clipPath>
      <g clipPath={`url(#mc-${uid})`}>
        {out}
        {labelEls}
      </g>
    </svg>
  );
});
