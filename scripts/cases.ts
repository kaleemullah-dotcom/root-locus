/** Shared verification cases: hand-picked + seeded random transfer functions. */
export interface VCase {
  id: string;
  num: string;
  den: string;
}

export const HAND_PICKED: VCase[] = [
  { id: 'class', num: '1', den: 's(s+4)(s+5)' },
  { id: 'p1', num: '1', den: 's(s+3)(s^2+2s+2)' },
  { id: 'book-a', num: 's+3', den: '(s+1)(s+5)' },
  { id: 'book-d', num: '1', den: '(s+1)(s+3)(s+6)' },
  { id: 'book-k', num: 's+2', den: '(s+1)(s+4)(s+6)' },
  { id: 'book-o', num: '1', den: '(s+4)(s+5)(s^2+2s+5)' },
  { id: 'book-p', num: '1', den: '(s+1)(s+2)(s^2+8s+20)' },
  { id: 'entry', num: 's+2', den: 's^2+2s+3' },
  { id: 'circle', num: 's+4', den: '(s+1)(s+2)' },
  { id: 'cplx-zeros', num: 's^2+2s+2', den: 's(s+3)(s+5)' },
  { id: 'cond-stable', num: 's^2+2s+4', den: 's(s+4)(s+6)(s^2+1.4s+1)' },
  { id: 'cplx-brk', num: '1', den: 's(s+4)(s^2+4s+20)' },
  { id: 'triple', num: 's+1', den: 's^2(s+9)' },
  { id: 'nmp', num: '1-s', den: 's(s+2)' },
  { id: 'n-eq-m', num: 's^2+2s+5', den: '(s+1)(s+3)' },
  { id: 'rep3', num: '1', den: '(s+1)^3' },
  { id: 'eps', num: '1', den: 's(s+1)(s^2+2)' },
  { id: 'lead-coef', num: '2.5(s+3)', den: 's(s+1)(s+5)(s+8)' },
  { id: 'small', num: '1', den: '(s+0.001)(s+0.002)(s+0.005)' },
  { id: 'spread', num: 's+10', den: '(s+0.1)(s+1)(s+100)(s+1000)' },
  { id: 'q5', num: '1', den: '(s+1)(s+2)(s+3)(s+4)(s+5)' },
  { id: 'q8', num: '1', den: '(s+1)^2(s+2)(s+3)(s^2+2s+5)(s^2+4s+8)' },
  { id: 'origin-cross', num: 's-1', den: '(s+1)(s+2)(s+3)' },
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random factored polynomial with `deg` roots; values rounded to one decimal place. */
function randomFactors(rand: () => number, deg: number, allowOrigin: boolean): string {
  const f: string[] = [];
  let left = deg;
  while (left > 0) {
    if (left >= 2 && rand() < 0.35) {
      const a = Math.round((0.2 + rand() * 6) * 10) / 10;
      const b = Math.round((0.3 + rand() * 5) * 10) / 10;
      const c1 = Math.round(2 * a * 100) / 100,
        c0 = Math.round((a * a + b * b) * 100) / 100;
      f.push(`(s^2+${c1}s+${c0})`);
      left -= 2;
    } else {
      const r = allowOrigin && rand() < 0.15 ? 0 : Math.round((0.1 + rand() * 9) * 10) / 10;
      f.push(r === 0 ? 's' : `(s+${r})`);
      left -= 1;
    }
  }
  return f.join('');
}

export function randomCases(count: number, seed = 20261121): VCase[] {
  const rand = mulberry32(seed);
  const out: VCase[] = [];
  for (let i = 0; i < count; i++) {
    const n = 2 + Math.floor(rand() * 6); // 2..7
    const m = Math.floor(rand() * Math.min(n, 4)); // 0..min(n−1, 3)
    const gain = rand() < 0.3 ? Math.round((0.5 + rand() * 4) * 10) / 10 : 1;
    const num = (gain !== 1 ? `${gain}` : '') + (m ? randomFactors(rand, m, false) : gain === 1 ? '1' : '');
    out.push({ id: `rand-${i + 1}`, num, den: randomFactors(rand, n, true) });
  }
  return out;
}

export const ALL_CASES: VCase[] = [...HAND_PICKED, ...randomCases(22)];
