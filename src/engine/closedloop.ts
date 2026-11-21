/**
 * Closed-loop analysis at a given K: poles, damping, step response.
 * Step response uses exact zero-order-hold discretisation (matrix exponential of the
 * augmented controllable-canonical realisation), so stiff / repeated poles are handled.
 */
import { cabs, type Complex } from './complex';
import { charPolyF, closedLoopPoles } from './stability';
import type { OpenLoopLite } from './stability';

export interface PoleInfo {
  s: Complex;
  zeta: number;
  wn: number;
}
export function poleInfo(s: Complex): PoleInfo {
  const wn = cabs(s);
  return { s, wn, zeta: wn === 0 ? 1 : -s.re / wn };
}

type Mat = number[][];
const zeros = (n: number, m = n): Mat => Array.from({ length: n }, () => new Array<number>(m).fill(0));
const eye = (n: number): Mat => {
  const r = zeros(n);
  for (let i = 0; i < n; i++) r[i][i] = 1;
  return r;
};
function mmul(a: Mat, b: Mat): Mat {
  const n = a.length,
    m = b[0].length,
    k = b.length;
  const r = zeros(n, m);
  for (let i = 0; i < n; i++)
    for (let l = 0; l < k; l++) {
      const x = a[i][l];
      if (x === 0) continue;
      for (let j = 0; j < m; j++) r[i][j] += x * b[l][j];
    }
  return r;
}
const madd = (a: Mat, b: Mat, s = 1): Mat => a.map((row, i) => row.map((x, j) => x + s * b[i][j]));
const mscale = (a: Mat, s: number): Mat => a.map((row) => row.map((x) => x * s));
function msolve(A: Mat, B: Mat): Mat {
  const n = A.length,
    m = B[0].length;
  const a = A.map((r, i) => [...r, ...B[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    [a[c], a[p]] = [a[p], a[c]];
    const piv = a[c][c] || 1e-300;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = a[r][c] / piv;
      if (f === 0) continue;
      for (let j = c; j < n + m; j++) a[r][j] -= f * a[c][j];
    }
  }
  return a.map((r, i) => r.slice(n).map((x) => x / (a[i][i] || 1e-300)));
}
/** Matrix exponential: scaling & squaring with a [6/6] Padé approximant. */
export function expm(A: Mat): Mat {
  const n = A.length;
  const norm = Math.max(...A.map((r) => r.reduce((s, x) => s + Math.abs(x), 0)));
  const s = Math.max(0, Math.ceil(Math.log2(norm || 1)) + 1);
  const X = mscale(A, Math.pow(2, -s));
  const c = [1, 1 / 2, 5 / 44, 1 / 66, 1 / 792, 1 / 15840, 1 / 665280];
  let N = eye(n),
    D = eye(n),
    P = eye(n);
  for (let k = 1; k <= 6; k++) {
    P = mmul(P, X);
    N = madd(N, P, c[k]);
    D = madd(D, P, k % 2 ? -c[k] : c[k]);
  }
  let E = msolve(D, N);
  for (let i = 0; i < s; i++) E = mmul(E, E);
  return E;
}

export interface StepResponse {
  t: number[];
  y: number[];
  final: number | null;
  stable: boolean;
  /** poles on the jω axis, none in the RHP: sustained oscillation */
  marginal: boolean;
  clipped: boolean;
}

export function stepResponse(ol: Pick<OpenLoopLite, 'Df' | 'Nf'>, K: number, nPts = 300): StepResponse {
  const a = charPolyF(ol, K); // LOW → HIGH
  let deg = a.length - 1;
  const scale = Math.max(...a.map(Math.abs));
  while (deg > 0 && Math.abs(a[deg]) < 1e-14 * scale) deg--;
  const lead = a[deg];
  const den = a.slice(0, deg + 1).map((x) => x / lead); // monic
  const num = Array.from({ length: deg + 1 }, (_, k) => (K * (ol.Nf[k] ?? 0)) / lead);
  const poles = closedLoopPoles(ol, K);
  const maxRe = Math.max(...poles.map((p) => p.re));
  const stable = maxRe < -1e-9 * Math.max(1, ...poles.map(cabs));
  if (deg === 0) {
    const g = num[0] / den[0];
    return { t: [0, 1], y: [g, g], final: g, stable: true, marginal: false, clipped: false };
  }
  // feed-through for biproper T(s)
  const dft = num[deg] ?? 0;
  const b = num.slice(0, deg).map((x, k) => x - dft * den[k]);
  // controllable canonical form
  const n = deg;
  const A = zeros(n);
  for (let i = 0; i < n - 1; i++) A[i][i + 1] = 1;
  for (let j = 0; j < n; j++) A[n - 1][j] = -den[j];
  // time horizon
  const slow = Math.min(...poles.map((p) => Math.abs(p.re)).filter((x) => x > 1e-9 * Math.max(1, ...poles.map(cabs))));
  const fastIm = Math.max(1e-9, ...poles.map((p) => Math.abs(p.im)));
  let T: number;
  if (stable) T = Math.min(8 / slow, 60 * (2 * Math.PI) / fastIm + 8 / slow);
  else if (maxRe > 1e-9 * Math.max(1, ...poles.map(cabs))) T = Math.min(5 / maxRe, (8 * 2 * Math.PI) / fastIm + 5 / maxRe);
  else T = (8 * 2 * Math.PI) / fastIm;
  if (!Number.isFinite(T) || T <= 0) T = 10;
  const dt = T / (nPts - 1);
  // augmented exponential [[A, B],[0, 0]]
  const M = zeros(n + 1);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) M[i][j] = A[i][j] * dt;
  M[n - 1][n] = dt;
  const E = expm(M);
  let x = new Array<number>(n).fill(0);
  const t: number[] = [],
    y: number[] = [];
  let clipped = false;
  const final = stable ? (den[0] !== 0 ? num[0] / den[0] : null) : null;
  const limit = final !== null ? Math.max(10 * Math.abs(final), 10) : 1e6;
  for (let k = 0; k < nPts; k++) {
    const out = b.reduce((s, bi, i) => s + bi * x[i], 0) + dft;
    t.push(k * dt);
    if (Math.abs(out) > limit) {
      clipped = true;
      y.push(Math.sign(out) * limit);
      break;
    }
    y.push(out);
    const nx = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) {
      let s = E[i][n];
      for (let j = 0; j < n; j++) s += E[i][j] * x[j];
      nx[i] = s;
    }
    x = nx;
  }
  const marginal = !stable && maxRe <= 1e-9 * Math.max(1, ...poles.map(cabs));
  return { t, y, final, stable, marginal, clipped };
}
