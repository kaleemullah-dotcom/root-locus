import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { Complex, Solution, ViewBox } from '../engine';
import { poleInfo } from '../engine/closedloop';
import { fcomplex, tnum } from '../engine/latex';
import type { RuleId } from '../lib/content';
import {
  COL,
  LabelPlacer,
  arrowHead,
  branchArrow,
  branchPath,
  makePlane,
  niceStep,
  tickLabel,
  ticks,
  type Plane,
} from '../plot/plane';

export interface MainPlotHandle {
  svg: () => SVGSVGElement | null;
  resetView: () => void;
}
interface Props {
  sol: Solution;
  /** closed-loop poles at the slider K */
  clPoles?: Complex[] | null;
  highlight?: RuleId | null;
  /** teach mode: show only features of rules ≤ reveal */
  reveal?: number;
  showComplementary?: boolean;
  title?: string;
  /** fixed width for export rendering */
  fixedWidth?: number;
  /** mark the SVG for vector embedding in the PDF */
  pdfVector?: boolean;
  /** hide zoom buttons */
  bare?: boolean;
}

const PAD = { l: 54, r: 14, t: 34, b: 46 };
const PAD_SMALL = { l: 44, r: 10, t: 12, b: 42 };
const FONT = 'Inter, Segoe UI, Arial, sans-serif';
const finite = (z: Complex): boolean => Number.isFinite(z.re) && Number.isFinite(z.im);

export const MainPlot = forwardRef<MainPlotHandle, Props>(function MainPlot(
  { sol, clPoles, highlight = null, reveal = 7, showComplementary = false, title, fixedWidth, pdfVector = false, bare = false },
  ref,
) {
  const uid = 'mp' + useId().replace(/:/g, '');
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(fixedWidth ?? 760);
  const [view, setView] = useState<ViewBox | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; s: Complex; K: number } | null>(null);

  useEffect(() => {
    if (fixedWidth) return;
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((es) => {
      const w = Math.floor(es[0].contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fixedWidth]);
  useEffect(() => setView(null), [sol]);

  const W = width;
  const H = Math.round(Math.max(300, Math.min(640, W < 560 ? W * 0.95 : W / 1.38)));
  const P: Plane = useMemo(() => makePlane(W, H, view ?? sol.view, W < 520 ? PAD_SMALL : PAD), [W, H, view, sol.view]);

  useImperativeHandle(ref, () => ({ svg: () => svgRef.current, resetView: () => setView(null) }), []);

  // ------------------------------------------------------------ zoom / pan
  const zoomAt = useCallback(
    (px: number, py: number, factor: number) => {
      const c = P.toWorld(px, py);
      const v = P.view;
      setView({
        x0: c.re + (v.x0 - c.re) * factor,
        x1: c.re + (v.x1 - c.re) * factor,
        y0: c.im + (v.y0 - c.im) * factor,
        y1: c.im + (v.y1 - c.im) * factor,
      });
    },
    [P],
  );
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey && !e.altKey && Math.abs(e.deltaY) < 1) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const sx = W / r.width;
      zoomAt((e.clientX - r.left) * sx, (e.clientY - r.top) * sx, Math.exp(Math.sign(e.deltaY) * 0.12));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt, W]);

  const drag = useRef<{ id: number; x: number; y: number; v: ViewBox } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; v: ViewBox; cx: number; cy: number } | null>(null);
  const toSvg = (e: React.PointerEvent): { x: number; y: number } => {
    const r = (svgRef.current as SVGSVGElement).getBoundingClientRect();
    const s = W / r.width;
    return { x: (e.clientX - r.left) * s, y: (e.clientY - r.top) * s };
  };
  const onPointerDown = (e: React.PointerEvent): void => {
    const p = toSvg(e);
    pointers.current.set(e.pointerId, p);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), v: P.view, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      drag.current = null;
    } else drag.current = { id: e.pointerId, x: p.x, y: p.y, v: P.view };
  };
  const onPointerMove = (e: React.PointerEvent): void => {
    const p = toSvg(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, p);
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const k = pinch.current.d / Math.max(10, d);
      const v = pinch.current.v;
      const c = P.toWorld(pinch.current.cx, pinch.current.cy);
      setView({ x0: c.re + (v.x0 - c.re) * k, x1: c.re + (v.x1 - c.re) * k, y0: c.im + (v.y0 - c.im) * k, y1: c.im + (v.y1 - c.im) * k });
      return;
    }
    if (drag.current && drag.current.id === e.pointerId) {
      const dx = (p.x - drag.current.x) * P.upp,
        dy = (p.y - drag.current.y) * P.upp;
      const v = drag.current.v;
      setView({ x0: v.x0 - dx, x1: v.x1 - dx, y0: v.y0 + dy, y1: v.y1 + dy });
      setHover(null);
      return;
    }
    // hover: nearest locus sample
    let best: { d: number; s: Complex; K: number } | null = null;
    const L = sol.locus;
    for (const br of L.branches)
      for (let k = 0; k < br.length; k++) {
        const z = br[k];
        if (!finite(z)) continue;
        const d = Math.hypot(P.X(z.re) - p.x, P.Y(z.im) - p.y);
        if (d < 14 && (!best || d < best.d)) best = { d, s: z, K: L.Ks[k] };
      }
    setHover(best ? { x: P.X(best.s.re), y: P.Y(best.s.im), s: best.s, K: best.K } : null);
  };
  const onPointerUp = (e: React.PointerEvent): void => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (drag.current?.id === e.pointerId) drag.current = null;
  };

  // ------------------------------------------------------------ scene
  const scene = useMemo(() => buildScene(sol, P, reveal, showComplementary, title), [sol, P, reveal, showComplementary, title]);
  const hl = highlight ? highlightLayer(sol, P, highlight) : null;

  const info = hover ? poleInfo(hover.s) : null;
  return (
    <div ref={wrapRef} className="relative w-full select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="block h-auto w-full touch-none rounded-md"
        xmlns="http://www.w3.org/2000/svg"
        fontFamily={FONT}
        {...(pdfVector ? { 'data-pdf-vector': '' } : {})}
        role="img"
        aria-labelledby={`${uid}-t ${uid}-d`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHover(null)}
        onDoubleClick={() => setView(null)}
      >
        <title id={`${uid}-t`}>Root locus plot</title>
        <desc id={`${uid}-d`}>{scene.desc}</desc>
        <rect x={0} y={0} width={W} height={H} fill="#fff" />
        <defs>
          <clipPath id={`${uid}-clip`}>
            <rect x={P.pl} y={P.pt} width={W - P.pl - P.pr} height={H - P.pt - P.pb} />
          </clipPath>
        </defs>
        {scene.frame}
        <g clipPath={`url(#${uid}-clip)`}>
          {hl?.under}
          {scene.body}
          {clPoles &&
            clPoles.filter(finite).map((z, i) => (
              <g key={i}>
                <circle cx={P.X(z.re)} cy={P.Y(z.im)} r={7} fill={z.re > 1e-9 ? '#fa5252' : '#fab005'} stroke="#212529" strokeWidth={1.5} />
              </g>
            ))}
          {hl?.over}
        </g>
        {scene.labels}
        {hover && (
          <g pointerEvents="none">
            <circle cx={hover.x} cy={hover.y} r={5} fill="none" stroke="#212529" strokeWidth={1.5} />
          </g>
        )}
      </svg>
      {hover && info && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-slate-300 bg-white/95 px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: `${Math.min(88, (hover.x / W) * 100 + 2)}%`,
            top: `${Math.max(0, (hover.y / H) * 100 - 16)}%`,
          }}
          role="status"
        >
          <div className="num">s = {fcomplex(hover.s, 3, true)}</div>
          <div className="num">K = {tnum(Math.abs(hover.K), 4)}</div>
          <div className="num">ζ = {tnum(info.zeta, 3)}, ωₙ = {tnum(info.wn, 3)}</div>
        </div>
      )}
      {!fixedWidth && !bare && (
        <div className="no-print absolute bottom-[54px] right-[22px] flex gap-1">
          {[
            ['Zoom in', '+', () => zoomAt(W / 2, H / 2, 0.8)],
            ['Zoom out', '−', () => zoomAt(W / 2, H / 2, 1.25)],
            ['Reset view', '⟲', () => setView(null)],
          ].map(([label, ch, fn]) => (
            <button
              key={label as string}
              type="button"
              aria-label={label as string}
              title={label as string}
              onClick={fn as () => void}
              className="h-8 w-8 rounded-md border border-slate-300 bg-white/90 text-base font-semibold text-navy shadow-sm hover:bg-navy-50"
            >
              {ch as string}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

// ======================================================================= scene builder

function buildScene(sol: Solution, P: Plane, reveal: number, showComp: boolean, title?: string) {
  const v = P.view;
  const { ol, r2, r3, r4, r5, r6, cross, locus } = sol;
  const W = P.W,
    H = P.H;
  const frame: JSX.Element[] = [];
  const body: JSX.Element[] = [];
  const labels = new LabelPlacer(P);
  let key = 0;
  const k = (): number => key++;

  // grid + ticks
  const step = niceStep(Math.max(v.x1 - v.x0, v.y1 - v.y0), W < 500 ? 6 : 9);
  const xt = ticks(v.x0, v.x1, step),
    yt = ticks(v.y0, v.y1, step);
  frame.push(<rect key={k()} x={P.pl} y={P.pt} width={W - P.pl - P.pr} height={H - P.pt - P.pb} fill="#fff" stroke="#adb5bd" />);
  for (const x of xt)
    frame.push(<line key={k()} x1={P.X(x)} x2={P.X(x)} y1={P.pt} y2={H - P.pb} stroke={COL.grid} strokeWidth={1} />);
  for (const y of yt)
    frame.push(<line key={k()} x1={P.pl} x2={W - P.pr} y1={P.Y(y)} y2={P.Y(y)} stroke={COL.grid} strokeWidth={1} />);
  if (v.y0 < 0 && v.y1 > 0)
    frame.push(<line key={k()} x1={P.pl} x2={W - P.pr} y1={P.Y(0)} y2={P.Y(0)} stroke={COL.axis} strokeWidth={1} />);
  if (v.x0 < 0 && v.x1 > 0)
    frame.push(<line key={k()} x1={P.X(0)} x2={P.X(0)} y1={P.pt} y2={H - P.pb} stroke={COL.axis} strokeWidth={1} />);
  const tickEls: JSX.Element[] = [];
  for (const x of xt)
    tickEls.push(
      <text key={k()} x={P.X(x)} y={H - P.pb + 15} fontSize={10.5} textAnchor="middle" fill="#495057">
        {tickLabel(x, step)}
      </text>,
    );
  for (const y of yt)
    tickEls.push(
      <text key={k()} x={P.pl - 6} y={P.Y(y) + 3.5} fontSize={10.5} textAnchor="end" fill="#495057">
        {tickLabel(y, step)}
      </text>,
    );
  tickEls.push(
    <text key={k()} x={P.pl + (W - P.pl - P.pr) / 2} y={H - 8} fontSize={12} textAnchor="middle" fill="#343a40">
      Real axis σ
    </text>,
    <text key={k()} transform={`translate(14 ${P.pt + (H - P.pt - P.pb) / 2}) rotate(-90)`} fontSize={12} textAnchor="middle" fill="#343a40">
      Imaginary axis jω
    </text>,
  );
  if (title && W >= 520)
    tickEls.push(
      <text key={k()} x={P.pl + (W - P.pl - P.pr) / 2} y={21} fontSize={W < 500 ? 11.5 : 13.5} fontWeight={600} textAnchor="middle" fill="#111">
        {title}
      </text>,
    );

  // reserve marker areas so labels avoid them
  [...ol.poles, ...ol.zeros].forEach((z) => labels.reservePoint(P.X(z.re), P.Y(z.im), 8));

  // R3 asymptotes
  if (reveal >= 3 && r4.sigma !== null && ol.q >= 2) {
    const Lr = 4 * Math.max(v.x1 - v.x0, v.y1 - v.y0);
    for (const a of r3.angles) {
      const t = (a.deg * Math.PI) / 180;
      body.push(
        <line
          key={k()}
          x1={P.X(r4.sigma)}
          y1={P.Y(0)}
          x2={P.X(r4.sigma + Lr * Math.cos(t))}
          y2={P.Y(Lr * Math.sin(t))}
          stroke={COL.asym}
          strokeWidth={1.3}
          strokeDasharray="6 4"
        />,
      );
    }
  }
  // complementary locus
  if (showComp && sol.locusNeg)
    sol.locusNeg.branches.forEach((br) =>
      body.push(<path key={k()} d={branchPath(P, br)} fill="none" stroke={COL.comp} strokeWidth={1.6} strokeDasharray="4 3" />),
    );
  // R7 full locus
  if (reveal >= 7) {
    locus.branches.forEach((br) =>
      body.push(<path key={k()} d={branchPath(P, br)} fill="none" stroke={COL.locus} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />),
    );
    // jω-axis segments
    cross.jwSegments.forEach((g) => {
      const hi = Math.min(g.omegaHi, v.y1 * 2);
      [1, -1].forEach((sg) =>
        body.push(<line key={k()} x1={P.X(0)} x2={P.X(0)} y1={P.Y(sg * g.omegaLo)} y2={P.Y(sg * hi)} stroke={COL.locus} strokeWidth={3} />),
      );
    });
    // arrows on complex branches
    const H0 = (v.y1 - v.y0) * 0.04;
    locus.branches.forEach((br) => {
      const a = branchArrow(P, br, H0);
      if (a)
        body.push(<path key={k()} d={arrowHead(a.x - a.dx, a.y - a.dy, a.x, a.y, 10)} fill={COL.locus} />);
    });
  }
  // R2 real-axis segments with arrows
  if (reveal >= 2) {
    for (const g of r2.segments) {
      const a = Math.min(g.a, v.x1 + (v.x1 - v.x0)),
        b = Math.max(g.b, v.x0 - (v.x1 - v.x0));
      body.push(<line key={k()} x1={P.X(a)} x2={P.X(b)} y1={P.Y(0)} y2={P.Y(0)} stroke={COL.locus} strokeWidth={reveal >= 7 ? 3 : 3.5} />);
      for (const p of g.pieces) {
        const pa = Math.min(p.a, v.x1),
          pb = Math.max(p.b, v.x0);
        if (pa <= pb) continue;
        const mid = p.a === Infinity ? pb + (pa - pb) * 0.5 : p.b === -Infinity ? pa - (pa - pb) * 0.5 : (p.a + p.b) / 2;
        const x = P.X(mid),
          y = P.Y(0);
        body.push(<path key={k()} d={arrowHead(x - p.dir * 6, y, x + p.dir * 4, y, 10)} fill={COL.locus} />);
      }
    }
  }
  // R1 poles / zeros
  const big = W >= 500;
  if (reveal >= 1) {
    ol.zerosM.forEach((r) =>
      body.push(<circle key={k()} cx={P.X(r.z.re)} cy={P.Y(r.z.im)} r={big ? 5.5 : 4.5} fill="#fff" stroke={COL.pole} strokeWidth={2.2} />),
    );
    ol.polesM.forEach((r) => {
      const x = P.X(r.z.re),
        y = P.Y(r.z.im),
        s = big ? 6 : 5;
      body.push(
        <path key={k()} d={`M${x - s} ${y - s}L${x + s} ${y + s}M${x - s} ${y + s}L${x + s} ${y - s}`} stroke={COL.pole} strokeWidth={2.6} strokeLinecap="round" />,
      );
    });
  }
  // R4 centroid
  if (reveal >= 4 && r4.sigma !== null && ol.q >= 2) {
    const x = P.X(r4.sigma),
      y = P.Y(0);
    body.push(<rect key={k()} x={x - 5} y={y - 5} width={10} height={10} transform={`rotate(45 ${x} ${y})`} fill={COL.asym} />);
    labels.reservePoint(x, y, 7);
  }
  // R5 break points
  if (reveal >= 5)
    r5.accepted.forEach((c) => {
      const x = P.X(c.s.re),
        y = P.Y(c.s.im);
      body.push(<circle key={k()} cx={x} cy={y} r={5.5} fill={COL.brk} stroke="#fff" strokeWidth={1.5} />);
      labels.reservePoint(x, y, 7);
    });
  // R6 departure / arrival arrows
  if (reveal >= 6 && reveal < 7) {
    const Lr = 0.12 * Math.max(v.x1 - v.x0, v.y1 - v.y0);
    const drawDir = (at: Complex, ang: number, arriving: boolean): void => {
      [1, -1].forEach((sg) => {
        if (at.im === 0 && sg < 0) return;
        const p = { re: at.re, im: sg * at.im };
        const t = (sg * ang * Math.PI) / 180;
        const e = { re: p.re + Lr * Math.cos(t), im: p.im + Lr * Math.sin(t) };
        const [s0, s1] = arriving ? [e, p] : [p, e];
        body.push(<line key={k()} x1={P.X(s0.re)} y1={P.Y(s0.im)} x2={P.X(s1.re)} y2={P.Y(s1.im)} stroke={COL.locus} strokeWidth={2} />);
        body.push(<path key={k()} d={arrowHead(P.X(s0.re), P.Y(s0.im), P.X(s1.re), P.Y(s1.im), 9)} fill={COL.locus} />);
      });
    };
    r6.departures.forEach((d) => d.angles.forEach((a) => drawDir(d.at, a, false)));
    r6.arrivals.forEach((d) => d.angles.forEach((a) => drawDir(d.at, a, true)));
  }
  // R7 crossings
  if (reveal >= 7)
    cross.crossings.forEach((c) =>
      [1, -1].forEach((sg) => {
        const x = P.X(0),
          y = P.Y(sg * c.omega);
        body.push(<circle key={k()} cx={x} cy={y} r={5.5} fill={COL.cross} stroke="#fff" strokeWidth={1.5} />);
        labels.reservePoint(x, y, 7);
      }),
    );

  // ---------------- labels (after all reservations)
  const nameList = (z: Complex, list: Complex[], pfx: string): string =>
    list
      .map((w, i) => (w.re === z.re && w.im === z.im ? `${pfx}${i + 1}` : ''))
      .filter(Boolean)
      .join(',');
  const inView = (z: Complex): boolean => z.re >= v.x0 && z.re <= v.x1 && z.im >= v.y0 && z.im <= v.y1;
  if (reveal >= 1) {
    ol.polesM.forEach((r) => {
      if (!inView(r.z)) return;
      labels.add(P.X(r.z.re), P.Y(r.z.im), `${nameList(r.z, ol.poles, 'P')} = ${fcomplex(r.z, 2, true)}`, '#212529', 11);
    });
    ol.zerosM.forEach((r) => {
      if (!inView(r.z)) return;
      labels.add(P.X(r.z.re), P.Y(r.z.im), `${nameList(r.z, ol.zeros, 'z')} = ${fcomplex(r.z, 2, true)}`, '#212529', 11);
    });
  }
  if (reveal >= 4 && r4.sigma !== null && ol.q >= 2 && inView({ re: r4.sigma, im: 0 }))
    labels.add(P.X(r4.sigma), P.Y(0), `σ = ${tnum(r4.sigma, 2)}`, COL.asym, 11.5, [[-20, 24]]);
  if (reveal >= 5)
    r5.accepted.forEach((c) => {
      if (!inView(c.s)) return;
      const tag = c.kind === 'entry' ? 'entry' : 'brk';
      labels.add(P.X(c.s.re), P.Y(c.s.im), `${tag} ${c.s.im === 0 ? tnum(c.s.re, 2) : fcomplex(c.s, 2, true)}`, COL.brk, 11.5, [[-24, -12]]);
    });
  if (reveal >= 7)
    cross.crossings.forEach((c) =>
      [1, -1].forEach((sg) => {
        if (!inView({ re: 0, im: sg * c.omega })) return;
        labels.add(P.X(0), P.Y(sg * c.omega), `${sg > 0 ? '+' : '−'}j${tnum(c.omega, 3)}`, COL.cross, 11.5, [[9, sg > 0 ? -7 : 15]]);
      }),
    );
  if (reveal >= 6) {
    r6.departures.forEach((d) => {
      if (!inView(d.at) || (d.at.im === 0 && d.mult < 2)) return;
      if (d.at.im === 0) return;
      labels.add(P.X(d.at.re), P.Y(d.at.im), `θd = ${tnum(d.angles[0], 1)}°`, COL.locus, 11);
    });
    r6.arrivals.forEach((d) => {
      if (!inView(d.at) || d.at.im === 0) return;
      labels.add(P.X(d.at.re), P.Y(d.at.im), `θa = ${tnum(d.angles[0], 1)}°`, COL.locus, 11);
    });
  }
  const labelEls = labels.placed.map((l, i) => (
    <text key={`l${i}`} x={l.x} y={l.y} fontSize={l.size} fill={l.color} stroke="#fff" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">
      {l.text}
    </text>
  ));
  const desc =
    `Root locus with ${ol.n} poles and ${ol.m} zeros. ` +
    (r5.accepted.length ? `Break points at ${r5.accepted.map((c) => fcomplex(c.s, 2, true)).join(', ')}. ` : '') +
    (cross.crossings.length ? `Crosses the jω axis at ${cross.crossings.map((c) => `±j${tnum(c.omega, 3)} (K = ${tnum(c.K, 3)})`).join(', ')}.` : 'No jω-axis crossing.');
  return { frame, body, labels: [...tickEls, ...labelEls], desc };
}

function highlightLayer(sol: Solution, P: Plane, rule: RuleId): { under: JSX.Element[]; over: JSX.Element[] } {
  const under: JSX.Element[] = [],
    over: JSX.Element[] = [];
  const glow = { stroke: COL.highlight, strokeOpacity: 0.75, fill: 'none', strokeLinecap: 'round' as const };
  const ring = (z: Complex, i: number): void => {
    over.push(<circle key={`r${i}`} cx={P.X(z.re)} cy={P.Y(z.im)} r={13} fill="none" stroke="#f08c00" strokeWidth={2.5} />);
    over.push(<circle key={`p${i}`} className="pulse" cx={P.X(z.re)} cy={P.Y(z.im)} r={8} fill="none" stroke="#f08c00" strokeWidth={2} />);
  };
  const v = P.view;
  let i = 0;
  switch (rule) {
    case 'R1':
      [...sol.ol.polesM, ...sol.ol.zerosM].forEach((r) => ring(r.z, i++));
      break;
    case 'R2':
      sol.r2.segments.forEach((g) => {
        const a = Math.min(g.a, v.x1 + 10 * (v.x1 - v.x0)),
          b = Math.max(g.b, v.x0 - 10 * (v.x1 - v.x0));
        under.push(<line key={`s${i++}`} x1={P.X(a)} x2={P.X(b)} y1={P.Y(0)} y2={P.Y(0)} strokeWidth={12} {...glow} />);
      });
      break;
    case 'R3':
    case 'R4': {
      const s = sol.r4.sigma;
      if (s === null || sol.ol.q < 2) break;
      if (rule === 'R4') ring({ re: s, im: 0 }, i++);
      const Lr = 4 * Math.max(v.x1 - v.x0, v.y1 - v.y0);
      sol.r3.angles.forEach((a) => {
        const t = (a.deg * Math.PI) / 180;
        under.push(<line key={`a${i++}`} x1={P.X(s)} y1={P.Y(0)} x2={P.X(s + Lr * Math.cos(t))} y2={P.Y(Lr * Math.sin(t))} strokeWidth={9} {...glow} />);
      });
      break;
    }
    case 'R5':
      sol.r5.accepted.forEach((c) => ring(c.s, i++));
      break;
    case 'R6':
      [...sol.r6.departures, ...sol.r6.arrivals].forEach((d) => {
        ring(d.at, i++);
        if (d.at.im) ring({ re: d.at.re, im: -d.at.im }, i++);
      });
      break;
    case 'R7':
      under.push(<line key="jw" x1={P.X(0)} x2={P.X(0)} y1={P.pt} y2={P.H - P.pb} strokeWidth={10} {...glow} />);
      sol.cross.crossings.forEach((c) => {
        ring({ re: 0, im: c.omega }, i++);
        ring({ re: 0, im: -c.omega }, i++);
      });
      break;
  }
  return { under, over };
}
