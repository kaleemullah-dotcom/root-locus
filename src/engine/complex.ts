/** Minimal immutable complex arithmetic. */
export interface Complex {
  re: number;
  im: number;
}

export const cx = (re: number, im = 0): Complex => ({ re, im });
export const cadd = (a: Complex, b: Complex): Complex => cx(a.re + b.re, a.im + b.im);
export const csub = (a: Complex, b: Complex): Complex => cx(a.re - b.re, a.im - b.im);
export const cmul = (a: Complex, b: Complex): Complex =>
  cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
export const cscale = (a: Complex, k: number): Complex => cx(a.re * k, a.im * k);
export const cneg = (a: Complex): Complex => cx(-a.re, -a.im);
export const cconj = (a: Complex): Complex => cx(a.re, -a.im);
export const cabs = (a: Complex): number => Math.hypot(a.re, a.im);
export const cabs2 = (a: Complex): number => a.re * a.re + a.im * a.im;

export function cdiv(a: Complex, b: Complex): Complex {
  // Smith's algorithm (avoids overflow / underflow)
  if (Math.abs(b.re) >= Math.abs(b.im)) {
    if (b.re === 0 && b.im === 0) return cx(NaN, NaN);
    const r = b.im / b.re,
      den = b.re + b.im * r;
    return cx((a.re + a.im * r) / den, (a.im - a.re * r) / den);
  }
  const r = b.re / b.im,
    den = b.re * r + b.im;
  return cx((a.re * r + a.im) / den, (a.im * r - a.re) / den);
}

export const cinv = (a: Complex): Complex => cdiv(cx(1), a);

/** Principal argument in degrees, (−180, 180]. */
export const cargDeg = (a: Complex): number => (Math.atan2(a.im, a.re) * 180) / Math.PI;

export function csqrt(a: Complex): Complex {
  const r = cabs(a);
  if (r === 0) return cx(0);
  const re = Math.sqrt((r + a.re) / 2);
  const im = Math.sqrt(Math.max(0, (r - a.re) / 2));
  return cx(re, a.im < 0 ? -im : im);
}

export const isRealC = (z: Complex, tol = 1e-12): boolean => Math.abs(z.im) <= tol;
