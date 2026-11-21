import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { Complex, Solution, ViewBox } from '../engine';
import type { Locus } from '../engine/locus';
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

/** Which gain range the final plot shows. */
export type KMode = 'pos' | 'neg' | 'both';

/** Colours for the K < 0 (complementary) locus. */
export const NEG = { locus: '#0c8599', asym: '#3bc9db' } as const;

export interface MainPlotHandle {
  svg: () => SVGSVGElement | null;
  resetView: () => void;
}
interface Props {
  sol: Solution;
  /** K < 0 analysis (0° rules) with its traced locus; needed for kMode 'neg' / 'both' */
  solNeg?: Solution | null;
  kMode?: KMode;
  /** initial view (defaults to the solution's own view) */
  baseView?: ViewBox;
  /** closed-loop poles at the slider K */
  clPoles?: Complex[] | null;
  highlight?: RuleId | null;
  /** teach mode: show only features of rules ≤ reveal */
  reveal?: number;
  title?: string;
  /** draw the legend inside the plot (top band) */
  legend?: boolean;
  /** fixed width for export rendering */
  fixedWidth?: number;
  /** mark the SVG for vector embedding in the PDF */
  pdfVector?: boolean;
  /** hide zoom buttons */
  bare?: boolean;
}

const FONT = 'Inter, Segoe UI, Arial, sans-serif';
const finite = (z: Complex): boolean => Number.isFinite(z.re) && Number.isFinite(z.im);

interface LegendItem {
  kind: 'pole' | 'zero' | 'locus' | 'neg' | 'asym' | 'nasym' | 'centroid' | 'brk' | 'cross' | 'cl';
  label: string;
}

function legendItems(sol: Solution, solNeg: Solution | null | undefined, mode: KMode, reveal: number, cl: boolean): LegendItem[] {
  const pos = mode !== 'neg',
    neg = mode !== 'pos' && !!solNeg;
  const it: LegendItem[] = [{ kind: 'pole', label: 'Open-loop poles' }];
  if (sol.ol.m) it.push({ kind: 'zero', label: 'Open-loop zeros' });
  if (pos && reveal >= 2) it.push({ kind: 'locus', label: mode === 'both' ? 'Locus K > 0' : 'Root locus (K: 0 → ∞)' });
  if (neg) it.push({ kind: 'neg', label: mode === 'both' ? 'Locus K < 0' : 'Root locus (K: 0 → −∞)' });
  if (sol.ol.q >= 2 && reveal >= 3) {
    if (pos) it.push({ kind: 'asym', label: mode === 'both' ? 'Asymptotes K > 0' : 'Asymptotes' });
    if (neg) it.push({ kind: 'nasym', label: mode === 'both' ? 'Asymptotes K < 0' : 'Asymptotes' });
    it.push({ kind: 'centroid', label: 'Centroid σ' });
  }
  if (reveal >= 5 && ((pos && sol.r5.accepted.length) || (neg && solNeg?.r5.accepted.length))) it.push({ kind: 'brk', label: 'Breakaway / entry' });
  if (reveal >= 7 && ((pos && sol.cross.crossings.length) || (neg && solNeg?.cross.crossings.length))) it.push({ kind: 'cross', label: 'jω crossing' });
  if (cl) it.push({ kind: 'cl', label: 'Closed-loop poles at K' });
  return it;
}

function legendGlyph(kind: LegendItem['kind'], x: number, y: number): JSX.Element {
  switch (kind) {
    case 'pole':
      return <path d={`M${x + 3} ${y - 4}l8 8M${x + 3} ${y + 4}l8 -8`} stroke={COL.pole} strokeWidth={2.2} strokeLinecap="round" />;
    case 'zero':
      return <circle cx={x + 7} cy={y} r={4.2} fill="#fff" stroke={COL.pole} strokeWidth={1.8} />;
    case 'locus':
      return <line x1={x} x2={x + 16} y1={y} y2={y} stroke={COL.locus} strokeWidth={3} />;
    case 'neg':
      return <line x1={x} x2={x + 16} y1={y} y2={y} stroke={NEG.locus} strokeWidth={3} />;
    case 'asym':
      return <line x1={x} x2={x + 16} y1={y} y2={y} stroke={COL.asym} strokeWidth={1.6} strokeDasharray="4 3" />;
    case 'nasym':
      return <line x1={x} x2={x + 16} y1={y} y2={y} stroke={NEG.asym} strokeWidth={1.6} strokeDasharray="4 3" />;
    case 'centroid':
      return <rect x={x + 3.5} y={y - 3.5} width={7} height={7} transform={`rotate(45 ${x + 7} ${y})`} fill={COL.asym} />;
    case 'brk':
      return <circle cx={x + 7} cy={y} r={4.2} fill={COL.brk} />;
    case 'cross':
      return <circle cx={x + 7} cy={y} r={4.2} fill={COL.cross} />;
    default:
      return <circle cx={x + 7} cy={y} r={5} fill="#fab005" stroke="#212529" strokeWidth={1.2} />;
  }
}

/** Lay the legend out in rows across the top band; returns elements and the band height. */
function layoutLegend(items: LegendItem[], W: number, x0: number, y0: number, small: boolean) {
  const fs = small ? 10 : 11.5;
  const maxW = W - x0 - 10;
  const els: JSX.Element[] = [];
  let x = x0,
    y = y0,
    rows = 1;
  items.forEach((it, i) => {
    const w = 20 + it.label.length * fs * 0.55 + 14;
    if (x + w > x0 + maxW && x > x0) {
      x = x0;
      y += fs + 7;
      rows++;
    }
    els.push(
      <g key={`lg${i}`}>
        {legendGlyph(it.kind, x, y - fs * 0.35)}
        <text x={x + 20} y={y} fontSize={fs} fill="#343a40">
          {it.label}
        </text>
      </g>,
    );
    x += w;
  });
  return { els, height: rows * (fs + 7) };
}

export const MainPlot = forwardRef<MainPlotHandle, Props>(function MainPlot(
  {
    sol,
    solNeg = null,
    kMode = 'pos',
    baseView,
    clPoles,
    highlight = null,
    reveal = 7,
    title,
    legend = true,
    fixedWidth,
    pdfVector = false,
    bare = false,
  },
  ref,
) {
  const uid = 'mp' + useId().replace(/:/g, '');
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(fixedWidth ?? 760);
  const [winH, setWinH] = useState(typeof window !== 'undefined' ? window.innerHeight : 900);
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
    const onR = (): void => setWinH(window.innerHeight);
    window.addEventListener('resize', onR);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onR);
    };
  }, [fixedWidth]);
  const initialView = baseView ?? sol.view;
  useEffect(() => setView(null), [sol, initialView]);

  const W = width;
  const small = W < 520;
  const items = useMemo(
    () => (legend ? legendItems(sol, solNeg, kMode, reveal, !!clPoles) : []),
    [legend, sol, solNeg, kMode, reveal, clPoles],
  );
  const showTitle = !!title && !small;
  const titleH = showTitle ? 24 : 6;
  const lg = useMemo(() => layoutLegend(items, W, small ? 44 : 54, titleH + 12, small), [items, W, small, titleH]);
  const pad = { l: small ? 44 : 54, r: small ? 10 : 14, t: titleH + (items.length ? lg.height + 8 : 6), b: small ? 42 : 46 };
  let H = Math.round(Math.max(300, Math.min(660, small ? W * 0.95 : W / 1.38)));
  // keep the plot within one screen on desktop so the controls stay visible
  if (!fixedWidth && !small) H = Math.min(H, Math.max(380, winH - 150));
  H += pad.t - 34;
  const P: Plane = useMemo(() => makePlane(W, H, view ?? initialView, pad), [W, H, view, initialView, pad.l, pad.r, pad.t, pad.b]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const shownLoci = useMemo(() => {
    const L: Locus[] = [];
    if (kMode !== 'neg') L.push(sol.locus);
    if (kMode !== 'pos' && solNeg) L.push(solNeg.locus);
    return L;
  }, [kMode, sol, solNeg]);
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
    // hover: nearest sample of the loci on display
    let best: { d: number; s: Complex; K: number } | null = null;
    for (const L of shownLoci)
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
  const scene = useMemo(
    () => buildScene(sol, kMode !== 'pos' ? solNeg : null, kMode, P, reveal, showTitle ? title : undefined),
    [sol, solNeg, kMode, P, reveal, title, showTitle],
  );
  const hl = highlight && kMode !== 'neg' ? highlightLayer(sol, P, highlight) : null;

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
        {lg.els}
        <g clipPath={`url(#${uid}-clip)`}>
          {hl?.under}
          {scene.body}
          {clPoles &&
            clPoles.filter(finite).map((z, i) => (
              <circle key={i} cx={P.X(z.re)} cy={P.Y(z.im)} r={7} fill={z.re > 1e-9 ? '#fa5252' : '#fab005'} stroke="#212529" strokeWidth={1.5} />
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
            left: `${Math.min(80, (hover.x / W) * 100 + 2)}%`,
            top: `${Math.max(0, (hover.y / H) * 100 - 16)}%`,
          }}
          role="status"
        >
          <div className="num">s = {fcomplex(hover.s, 3, true)}</div>
          <div className="num">K = {tnum(hover.K, 4)}</div>
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

interface LayerStyle {
  locus: string;
  asym: string;
  /** label suffix (e.g. " (K<0)") */
  tag: string;
  /** −1 for the K < 0 analysis (its gains are reported as K' = −K) */
  sign: 1 | -1;
}

function buildScene(sol: Solution, solNeg: Solution | null, mode: KMode, P: Plane, reveal: number, title?: string) {
  const v = P.view;
  const { ol } = sol;
  const W = P.W,
    H = P.H;
  const frame: JSX.Element[] = [];
  const body: JSX.Element[] = [];
  const labels = new LabelPlacer(P);
  const pendingLabels: Array<() => void> = [];
  let key = 0;
  const k = (): number => key++;

  // grid + ticks
  const step = niceStep(Math.max(v.x1 - v.x0, v.y1 - v.y0), W < 500 ? 6 : 9);
  const xt = ticks(v.x0, v.x1, step),
    yt = ticks(v.y0, v.y1, step);
  frame.push(<rect key={k()} x={P.pl} y={P.pt} width={W - P.pl - P.pr} height={H - P.pt - P.pb} fill="#fff" stroke="#adb5bd" />);
  for (const x of xt) frame.push(<line key={k()} x1={P.X(x)} x2={P.X(x)} y1={P.pt} y2={H - P.pb} stroke={COL.grid} strokeWidth={1} />);
  for (const y of yt) frame.push(<line key={k()} x1={P.pl} x2={W - P.pr} y1={P.Y(y)} y2={P.Y(y)} stroke={COL.grid} strokeWidth={1} />);
  if (v.y0 < 0 && v.y1 > 0) frame.push(<line key={k()} x1={P.pl} x2={W - P.pr} y1={P.Y(0)} y2={P.Y(0)} stroke={COL.axis} strokeWidth={1} />);
  if (v.x0 < 0 && v.x1 > 0) frame.push(<line key={k()} x1={P.X(0)} x2={P.X(0)} y1={P.pt} y2={H - P.pb} stroke={COL.axis} strokeWidth={1} />);
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
  if (title)
    tickEls.push(
      <text key={k()} x={P.pl + (W - P.pl - P.pr) / 2} y={18} fontSize={13.5} fontWeight={600} textAnchor="middle" fill="#111">
        {title}
        {mode === 'neg' ? '  —  K < 0' : mode === 'both' ? '  —  K > 0 and K < 0' : ''}
      </text>,
    );

  [...ol.poles, ...ol.zeros].forEach((z) => labels.reservePoint(P.X(z.re), P.Y(z.im), 8));
  const inView = (z: Complex): boolean => z.re >= v.x0 && z.re <= v.x1 && z.im >= v.y0 && z.im <= v.y1;

  /** Everything that depends on the sign of K: asymptotes, locus, real-axis segments, break points, crossings. */
  const drawLayer = (s: Solution, st: LayerStyle, rv: number): void => {
    const { r2, r3, r4, r5, cross, locus } = s;
    // asymptotes
    if (rv >= 3 && r4.sigma !== null && s.ol.q >= 2) {
      const Lr = 4 * Math.max(v.x1 - v.x0, v.y1 - v.y0);
      for (const a of r3.angles) {
        const t = (a.deg * Math.PI) / 180;
        body.push(
          <line key={k()} x1={P.X(r4.sigma)} y1={P.Y(0)} x2={P.X(r4.sigma + Lr * Math.cos(t))} y2={P.Y(Lr * Math.sin(t))} stroke={st.asym} strokeWidth={1.3} strokeDasharray="6 4" />,
        );
      }
    }
    // full locus with arrows
    if (rv >= 7) {
      locus.branches.forEach((br) =>
        body.push(<path key={k()} d={branchPath(P, br)} fill="none" stroke={st.locus} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />),
      );
      cross.jwSegments.forEach((g) => {
        const hi = Math.min(g.omegaHi, v.y1 * 2);
        [1, -1].forEach((sg) =>
          body.push(<line key={k()} x1={P.X(0)} x2={P.X(0)} y1={P.Y(sg * g.omegaLo)} y2={P.Y(sg * hi)} stroke={st.locus} strokeWidth={3} />),
        );
      });
      const H0 = (v.y1 - v.y0) * 0.04;
      locus.branches.forEach((br) => {
        const a = branchArrow(P, br, H0);
        if (a) body.push(<path key={k()} d={arrowHead(a.x - a.dx, a.y - a.dy, a.x, a.y, 10)} fill={st.locus} />);
      });
    }
    // real-axis segments with direction arrows (increasing |K|)
    if (rv >= 2)
      for (const g of r2.segments) {
        const a = Math.min(g.a, v.x1 + (v.x1 - v.x0)),
          b = Math.max(g.b, v.x0 - (v.x1 - v.x0));
        body.push(<line key={k()} x1={P.X(a)} x2={P.X(b)} y1={P.Y(0)} y2={P.Y(0)} stroke={st.locus} strokeWidth={rv >= 7 ? 3 : 3.5} />);
        for (const p of g.pieces) {
          const pa = Math.min(p.a, v.x1),
            pb = Math.max(p.b, v.x0);
          if (pa <= pb) continue;
          const mid = p.a === Infinity || p.b === -Infinity ? pb + (pa - pb) * 0.5 : (p.a + p.b) / 2;
          const x = P.X(mid),
            y = P.Y(0);
          body.push(<path key={k()} d={arrowHead(x - p.dir * 6, y, x + p.dir * 4, y, 10)} fill={st.locus} />);
        }
      }
    // break points
    if (rv >= 5)
      r5.accepted.forEach((c) => {
        const x = P.X(c.s.re),
          y = P.Y(c.s.im);
        body.push(<circle key={k()} cx={x} cy={y} r={5.5} fill={COL.brk} stroke={st.sign < 0 ? NEG.locus : '#fff'} strokeWidth={st.sign < 0 ? 2 : 1.5} />);
        labels.reservePoint(x, y, 7);
        if (inView(c.s))
          pendingLabels.push(() => {
            const tag = c.kind === 'entry' ? 'entry' : 'brk';
            labels.add(x, y, `${tag} ${c.s.im === 0 ? tnum(c.s.re, 2) : fcomplex(c.s, 2, true)}${st.tag}`, COL.brk, 11.5, [[-24, -12]]);
          });
      });
    // jω crossings
    if (rv >= 7) {
      cross.crossings.forEach((c) =>
        [1, -1].forEach((sg) => {
          const x = P.X(0),
            y = P.Y(sg * c.omega);
          body.push(<circle key={k()} cx={x} cy={y} r={5.5} fill={COL.cross} stroke={st.sign < 0 ? NEG.locus : '#fff'} strokeWidth={st.sign < 0 ? 2 : 1.5} />);
          labels.reservePoint(x, y, 7);
          if (inView({ re: 0, im: sg * c.omega }))
            pendingLabels.push(() =>
              labels.add(x, y, `${sg > 0 ? '+' : '−'}j${tnum(c.omega, 3)}${st.tag}`, COL.cross, 11.5, [[9, sg > 0 ? -7 : 15]]),
            );
        }),
      );
      if (cross.originK !== null && st.sign < 0) labels.reservePoint(P.X(0), P.Y(0), 7);
    }
  };

  const both = mode === 'both';
  if (mode !== 'neg') drawLayer(sol, { locus: COL.locus, asym: COL.asym, tag: both ? ' (K>0)' : '', sign: 1 }, reveal);
  if (solNeg) drawLayer(solNeg, { locus: NEG.locus, asym: NEG.asym, tag: both ? ' (K<0)' : '', sign: -1 }, 7);

  // poles / zeros (on top)
  const big = W >= 500;
  ol.zerosM.forEach((r) => body.push(<circle key={k()} cx={P.X(r.z.re)} cy={P.Y(r.z.im)} r={big ? 5.5 : 4.5} fill="#fff" stroke={COL.pole} strokeWidth={2.2} />));
  ol.polesM.forEach((r) => {
    const x = P.X(r.z.re),
      y = P.Y(r.z.im),
      s = big ? 6 : 5;
    body.push(<path key={k()} d={`M${x - s} ${y - s}L${x + s} ${y + s}M${x - s} ${y + s}L${x + s} ${y - s}`} stroke={COL.pole} strokeWidth={2.6} strokeLinecap="round" />);
  });
  // centroid (identical for K > 0 and K < 0)
  const sig = sol.r4.sigma;
  const showCentroid = sig !== null && ol.q >= 2 && (mode !== 'pos' || reveal >= 4);
  if (showCentroid && sig !== null) {
    const x = P.X(sig),
      y = P.Y(0);
    body.push(<rect key={k()} x={x - 5} y={y - 5} width={10} height={10} transform={`rotate(45 ${x} ${y})`} fill={COL.asym} />);
    labels.reservePoint(x, y, 7);
  }
  // R6 departure arrows (teach mode only)
  if (mode === 'pos' && reveal === 6) {
    const Lr = 0.12 * Math.max(v.x1 - v.x0, v.y1 - v.y0);
    const drawDir = (at: Complex, ang: number, arriving: boolean): void =>
      [1, -1].forEach((sg) => {
        if (at.im === 0 && sg < 0) return;
        const p = { re: at.re, im: sg * at.im };
        const t = (sg * ang * Math.PI) / 180;
        const e = { re: p.re + Lr * Math.cos(t), im: p.im + Lr * Math.sin(t) };
        const [s0, s1] = arriving ? [e, p] : [p, e];
        body.push(<line key={k()} x1={P.X(s0.re)} y1={P.Y(s0.im)} x2={P.X(s1.re)} y2={P.Y(s1.im)} stroke={COL.locus} strokeWidth={2} />);
        body.push(<path key={k()} d={arrowHead(P.X(s0.re), P.Y(s0.im), P.X(s1.re), P.Y(s1.im), 9)} fill={COL.locus} />);
      });
    sol.r6.departures.forEach((d) => d.angles.forEach((a) => drawDir(d.at, a, false)));
    sol.r6.arrivals.forEach((d) => d.angles.forEach((a) => drawDir(d.at, a, true)));
  }

  // ---------------- labels (after all reservations)
  const nameList = (z: Complex, list: Complex[], pfx: string): string =>
    list
      .map((w, i) => (w.re === z.re && w.im === z.im ? `${pfx}${i + 1}` : ''))
      .filter(Boolean)
      .join(',');
  ol.polesM.forEach((r) => {
    if (inView(r.z)) labels.add(P.X(r.z.re), P.Y(r.z.im), `${nameList(r.z, ol.poles, 'P')} = ${fcomplex(r.z, 2, true)}`, '#212529', 11);
  });
  ol.zerosM.forEach((r) => {
    if (inView(r.z)) labels.add(P.X(r.z.re), P.Y(r.z.im), `${nameList(r.z, ol.zeros, 'z')} = ${fcomplex(r.z, 2, true)}`, '#212529', 11);
  });
  if (showCentroid && sig !== null && inView({ re: sig, im: 0 })) labels.add(P.X(sig), P.Y(0), `σ = ${tnum(sig, 2)}`, COL.asym, 11.5, [[-20, 24]]);
  pendingLabels.forEach((f) => f());
  if (mode === 'pos' && reveal >= 6) {
    sol.r6.departures.forEach((d) => {
      if (inView(d.at) && d.at.im !== 0) labels.add(P.X(d.at.re), P.Y(d.at.im), `θd = ${tnum(d.angles[0], 1)}°`, COL.locus, 11);
    });
    sol.r6.arrivals.forEach((d) => {
      if (inView(d.at) && d.at.im !== 0) labels.add(P.X(d.at.re), P.Y(d.at.im), `θa = ${tnum(d.angles[0], 1)}°`, COL.locus, 11);
    });
  }
  const labelEls = labels.placed.map((l, i) => (
    <text key={`l${i}`} x={l.x} y={l.y} fontSize={l.size} fill={l.color} stroke="#fff" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">
      {l.text}
    </text>
  ));
  const descOf = (s: Solution, sign: string): string =>
    (s.r5.accepted.length ? `Break points (K ${sign} 0) at ${s.r5.accepted.map((c) => fcomplex(c.s, 2, true)).join(', ')}. ` : '') +
    (s.cross.crossings.length
      ? `Crosses the jω axis (K ${sign} 0) at ${s.cross.crossings.map((c) => `±j${tnum(c.omega, 3)} (K = ${sign === '<' ? '−' : ''}${tnum(c.K, 3)})`).join(', ')}. `
      : '');
  const desc =
    `Root locus with ${ol.n} poles and ${ol.m} zeros, showing ${mode === 'pos' ? 'K > 0' : mode === 'neg' ? 'K < 0' : 'K > 0 and K < 0'}. ` +
    (mode !== 'neg' ? descOf(sol, '>') : '') +
    (solNeg ? descOf(solNeg, '<') : '');
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
