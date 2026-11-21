/**
 * Floating-point real polynomials. Coefficient arrays are LOW → HIGH:
 * [a0, a1, a2] = a0 + a1 s + a2 s².
 */
import { cadd, cmul, cx, type Complex } from './complex';

export type Poly = number[];

export function ptrim(p: Poly, tol = 0): Poly {
  const r = p.slice();
  while (r.length > 1 && Math.abs(r[r.length - 1]) <= tol) r.pop();
  return r.length ? r : [0];
}
export const pdeg = (p: Poly): number => {
  const t = ptrim(p);
  return t.length === 1 && t[0] === 0 ? -Infinity : t.length - 1;
};
export function padd(a: Poly, b: Poly): Poly {
  const r = new Array<number>(Math.max(a.length, b.length)).fill(0);
  a.forEach((x, i) => (r[i] += x));
  b.forEach((x, i) => (r[i] += x));
  return ptrim(r);
}
export const pscale = (a: Poly, k: number): Poly => ptrim(a.map((x) => x * k));
export const psub = (a: Poly, b: Poly): Poly => padd(a, pscale(b, -1));
export function pmul(a: Poly, b: Poly): Poly {
  const r = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) r[i + j] += a[i] * b[j];
  return ptrim(r);
}
export const pder = (a: Poly): Poly => (a.length <= 1 ? [0] : ptrim(a.slice(1).map((x, i) => x * (i + 1))));

/** Horner evaluation at a real point. */
export function pevalR(a: Poly, x: number): number {
  let acc = 0;
  for (let k = a.length - 1; k >= 0; k--) acc = acc * x + a[k];
  return acc;
}
/** Horner evaluation at a complex point. */
export function pevalC(a: Poly, z: Complex): Complex {
  let re = 0,
    im = 0;
  for (let k = a.length - 1; k >= 0; k--) {
    const nr = re * z.re - im * z.im + a[k];
    im = re * z.im + im * z.re;
    re = nr;
  }
  return cx(re, im);
}
/** Evaluate polynomial with complex coefficients. */
export function pevalCC(a: Complex[], z: Complex): Complex {
  let acc = cx(0);
  for (let k = a.length - 1; k >= 0; k--) acc = cadd(cmul(acc, z), a[k]);
  return acc;
}
