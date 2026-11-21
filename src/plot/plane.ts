/** Geometry helpers shared by the main plot and the mini sketches. Pure (no React). */
import type { Complex, ViewBox } from '../engine';

export const COL = {
  pole: '#c92a2a',
  locus: '#2a6fdb',
  asym: '#e8590c',
  brk: '#2b8a3e',
  cross: '#7b2cbf',
  navy: '#1f3b6e',
  arrowNavy: '#0b3d91',
  axis: '#343a40',
  grid: '#e9ecef',
  gridMajor: '#dee2e6',
  highlight: '#fcc419',
  comp: '#94a3b8',
  text: '#212529',
} as const;

export interface Plane {
  W: number;
  H: number;
  /** plot-area padding */
  pl: number;
  pr: number;
  pt: number;
  pb: number;
  view: ViewBox;
  X: (x: number) => number;
  Y: (y: number) => number;
  /** inverse */
  toWorld: (px: number, py: number) => Complex;
  /** world units per pixel (equal in x and y) */
  upp: number;
}

/** Make a plane whose x and y scales are equal; the view is expanded to fill the area. */
export function makePlane(
  W: number,
  H: number,
  view: ViewBox,
  pad: { l: number; r: number; t: number; b: number } = { l: 0, r: 0, t: 0, b: 0 },
): Plane {
  const pw = W - pad.l - pad.r,
    ph = H - pad.t - pad.b;
  const vw = view.x1 - view.x0,
    vh = view.y1 - view.y0;
  const upp = Math.max(vw / pw, vh / ph);
  const cx = (view.x0 + view.x1) / 2,
    cy = (view.y0 + view.y1) / 2;
  const v: ViewBox = { x0: cx - (upp * pw) / 2, x1: cx + (upp * pw) / 2, y0: cy - (upp * ph) / 2, y1: cy + (upp * ph) / 2 };
  return {
    W,
    H,
    pl: pad.l,
    pr: pad.r,
    pt: pad.t,
    pb: pad.b,
    view: v,
    upp,
    X: (x) => pad.l + (x - v.x0) / upp,
    Y: (y) => pad.t + (v.y1 - y) / upp,
    toWorld: (px, py) => ({ re: v.x0 + (px - pad.l) * upp, im: v.y1 - (py - pad.t) * upp }),
  };
}

/** SVG path for an arrowhead whose tip is at (x2, y2), pointing along (x1,y1)→(x2,y2). */
export function arrowHead(x1: number, y1: number, x2: number, y2: number, size = 8): string {
  const L = Math.hypot(x2 - x1, y2 - y1);
  if (L < 1e-9) return '';
  const ux = (x2 - x1) / L,
    uy = (y2 - y1) / L;
  const s = size;
  const tipX = x2 + ux * s * 0.6,
    tipY = y2 + uy * s * 0.6;
  const bx = x2 - ux * s * 0.9,
    by = y2 - uy * s * 0.9;
  return `M${f(tipX)} ${f(tipY)}L${f(bx - uy * s * 0.55)} ${f(by + ux * s * 0.55)}L${f(bx + uy * s * 0.55)} ${f(by - ux * s * 0.55)}Z`;
}
const f = (x: number): string => (Math.round(x * 10) / 10).toString();

const finite = (z: Complex): boolean => Number.isFinite(z.re) && Number.isFinite(z.im);

/** Polyline path of a branch in screen coordinates, broken at gaps/infinities. */
export function branchPath(P: Plane, pts: Complex[]): string {
  let d = '';
  let pen = false;
  const lim = 1e5;
  let lastX = 0,
    lastY = 0;
  for (const z of pts) {
    if (!finite(z)) {
      pen = false;
      continue;
    }
    let x = P.X(z.re),
      y = P.Y(z.im);
    if (Math.abs(x) > lim || Math.abs(y) > lim) {
      // clamp far points so the line still exits the frame in the right direction
      const k = lim / Math.max(Math.abs(x), Math.abs(y));
      x *= k;
      y *= k;
    }
    if (pen && Math.abs(x - lastX) < 0.25 && Math.abs(y - lastY) < 0.25) continue; // sub-pixel decimation
    d += (pen ? 'L' : 'M') + f(x) + ' ' + f(y);
    pen = true;
    lastX = x;
    lastY = y;
  }
  return d;
}

/** Arc-length midpoint of the visible, off-axis part of a branch → arrow position + direction. */
export function branchArrow(P: Plane, pts: Complex[], minIm: number): { x: number; y: number; dx: number; dy: number } | null {
  const v = P.view;
  const vis: Complex[] = pts.filter(
    (z) => finite(z) && Math.abs(z.im) > minIm && z.re > v.x0 && z.re < v.x1 && z.im > v.y0 && z.im < v.y1,
  );
  if (vis.length < 6) return null;
  const acc = [0];
  for (let k = 1; k < vis.length; k++) acc.push(acc[k - 1] + Math.hypot(vis[k].re - vis[k - 1].re, vis[k].im - vis[k - 1].im));
  const total = acc[acc.length - 1];
  if (total < 30 * P.upp) return null;
  const k = Math.max(1, Math.min(vis.length - 2, acc.findIndex((a) => a >= total * 0.5)));
  const a = vis[k],
    b = vis[Math.min(vis.length - 1, k + 1)];
  const x1 = P.X(a.re),
    y1 = P.Y(a.im),
    x2 = P.X(b.re),
    y2 = P.Y(b.im);
  const L = Math.hypot(x2 - x1, y2 - y1) || 1;
  return { x: x1, y: y1, dx: (x2 - x1) / L, dy: (y2 - y1) / L };
}

/** "Nice" grid step for a range. */
export function niceStep(range: number, target = 8): number {
  const r = range / target;
  const p = Math.pow(10, Math.floor(Math.log10(r)));
  const q = r / p;
  return (q < 1.5 ? 1 : q < 3 ? 2 : q < 7 ? 5 : 10) * p;
}
export function ticks(lo: number, hi: number, step: number): number[] {
  const out: number[] = [];
  for (let x = Math.ceil(lo / step) * step; x <= hi + step * 1e-9; x += step) out.push(Math.abs(x) < step * 1e-9 ? 0 : x);
  return out;
}
export function tickLabel(x: number, step: number): string {
  const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  const a = Math.abs(x);
  if (a !== 0 && (a >= 1e5 || a < 1e-4)) return x.toExponential(1).replace('-', '−');
  return x.toFixed(Math.min(6, d)).replace('-', '−');
}

// ---------------------------------------------------------------- labels

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface PlacedLabel {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  anchor: 'start' | 'middle' | 'end';
}

/** Greedy overlap-free label placement against reserved boxes and earlier labels. */
export class LabelPlacer {
  private boxes: Box[] = [];
  readonly placed: PlacedLabel[] = [];
  private readonly P: Plane;
  constructor(P: Plane) {
    this.P = P;
  }
  reserve(b: Box): void {
    this.boxes.push(b);
  }
  reservePoint(x: number, y: number, r: number): void {
    this.boxes.push({ x: x - r, y: y - r, w: 2 * r, h: 2 * r });
  }
  add(px: number, py: number, text: string, color: string, size = 11.5, prefer: Array<[number, number]> = []): void {
    const w = text.length * size * 0.56 + 4,
      h = size * 1.25;
    const P = this.P;
    const cands: Array<[number, number]> = [
      ...prefer,
      [9, -7],
      [9, 15],
      [-w - 9, -7],
      [-w - 9, 15],
      [-w / 2, -13],
      [-w / 2, 23],
      [12, -22],
      [-w - 12, -22],
      [12, 30],
      [-w - 12, 30],
      [-w / 2, -30],
      [-w / 2, 40],
      [20, 4],
      [-w - 20, 4],
    ];
    let best = cands[0],
      bestScore = Infinity;
    for (const [dx, dy] of cands) {
      const bx = px + dx,
        by = py + dy - h * 0.8;
      let score = 0;
      for (const b of this.boxes) {
        const ox = Math.max(0, Math.min(bx + w, b.x + b.w) - Math.max(bx, b.x));
        const oy = Math.max(0, Math.min(by + h, b.y + b.h) - Math.max(by, b.y));
        score += ox * oy;
      }
      if (bx < P.pl + 2 || bx + w > P.W - P.pr - 2 || by < P.pt + 2 || by + h > P.H - P.pb - 2) score += 1e5;
      score += Math.hypot(dx + w / 2, dy) * 0.02; // mild preference for close placements
      if (score < bestScore) {
        bestScore = score;
        best = [dx, dy];
      }
    }
    const bx = px + best[0],
      by = py + best[1] - h * 0.8;
    this.boxes.push({ x: bx, y: by, w, h });
    this.placed.push({ x: bx + 2, y: py + best[1], text, color, size, anchor: 'start' });
  }
}
