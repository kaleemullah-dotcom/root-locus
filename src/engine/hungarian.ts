/**
 * Hungarian (Kuhn–Munkres) algorithm, O(n³), for a square cost matrix.
 * Returns assign[i] = column assigned to row i, minimising Σ cost[i][assign[i]].
 */
export function hungarian(cost: number[][]): number[] {
  const n = cost.length;
  if (n === 0) return [];
  const INF = Number.POSITIVE_INFINITY;
  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(n + 1).fill(0);
  const p = new Array<number>(n + 1).fill(0); // p[j] = row matched to column j (1-based)
  const way = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(n + 1).fill(INF);
    const used = new Array<boolean>(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF,
        j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      if (j1 === 0) {
        // all remaining costs are infinite / NaN — pick any unused column
        for (let j = 1; j <= n; j++)
          if (!used[j]) {
            j1 = j;
            break;
          }
        delta = 0;
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const assign = new Array<number>(n).fill(-1);
  for (let j = 1; j <= n; j++) if (p[j] > 0) assign[p[j] - 1] = j - 1;
  return assign;
}
