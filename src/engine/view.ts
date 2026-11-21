/** Automatic plot window: contains every important feature, with margins, equal aspect. */
import type { Complex } from './complex';

export interface ViewBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Bounding box of the important points (always includes the origin). */
export function featureBox(points: Complex[]): ViewBox {
  const pts = points.filter((z) => Number.isFinite(z.re) && Number.isFinite(z.im));
  let x0 = 0,
    x1 = 0,
    ym = 0;
  for (const z of pts) {
    x0 = Math.min(x0, z.re);
    x1 = Math.max(x1, z.re);
    ym = Math.max(ym, Math.abs(z.im));
  }
  return { x0, x1, y0: -ym, y1: ym };
}

/**
 * Expand a feature box into a view of the requested aspect (width / height) with margins.
 * Symmetric about the real axis. Works for tiny and huge magnitudes (no absolute floors).
 */
export function autoView(box: ViewBox, aspect: number, opts: { leftExtra?: boolean } = {}): ViewBox {
  let { x0, x1 } = box;
  let ym = Math.max(Math.abs(box.y0), Math.abs(box.y1));
  let span = Math.max(x1 - x0, 2 * ym);
  if (!(span > 0)) span = 2; // everything at the origin
  const pad = 0.3 * span;
  x0 -= pad;
  x1 += pad * 0.7;
  if (opts.leftExtra) x0 -= 0.12 * span;
  ym += pad;
  let w = x1 - x0,
    h = 2 * ym;
  if (w / h < aspect) {
    const extra = h * aspect - w;
    x0 -= extra * 0.6;
    x1 += extra * 0.4;
    w = x1 - x0;
  } else {
    h = w / aspect;
  }
  return { x0, x1, y0: -h / 2, y1: h / 2 };
}

export const viewSpan = (v: ViewBox): number => Math.max(v.x1 - v.x0, v.y1 - v.y0);
export const viewCenter = (v: ViewBox): Complex => ({ re: (v.x0 + v.x1) / 2, im: (v.y0 + v.y1) / 2 });
