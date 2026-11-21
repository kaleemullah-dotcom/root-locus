/**
 * Lighthouse (mobile + desktop) against the production build; median of N runs per form factor
 * (Lighthouse's simulated throttling is sensitive to host load, so single runs are noisy).
 * Usage: npm run build && npm run lighthouse   (set CHROME_PATH if Chrome is not auto-detected)
 *        RUNS=5 npm run lighthouse
 */
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const port = 4191;
const runs = Number(process.env.RUNS ?? 3);
const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { shell: true, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 4000));
const median = (xs: number[]): number => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
let ok = true;
try {
  for (const form of ['mobile', 'desktop']) {
    const perf: number[] = [],
      a11y: number[] = [],
      bp: number[] = [],
      tbt: number[] = [];
    for (let i = 0; i < runs; i++) {
      const out = join(tmpdir(), `lh-${form}.json`);
      const args = ['lighthouse', `http://localhost:${port}/`, '--only-categories=performance,accessibility,best-practices', '--chrome-flags=--headless=new', '--output=json', `--output-path=${out}`, '--quiet'];
      if (form === 'desktop') args.push('--preset=desktop');
      execFileSync('npx', args, { shell: true, stdio: 'inherit' });
      const d = JSON.parse(readFileSync(out, 'utf8'));
      perf.push(Math.round(d.categories.performance.score * 100));
      a11y.push(Math.round(d.categories.accessibility.score * 100));
      bp.push(Math.round(d.categories['best-practices'].score * 100));
      tbt.push(d.audits['total-blocking-time'].numericValue);
    }
    const p = median(perf),
      a = median(a11y);
    ok &&= p >= 90 && a >= 90;
    console.log(
      `${form.padEnd(8)} performance ${p} (runs: ${perf.join(', ')})  accessibility ${a}  best-practices ${median(bp)}  TBT ${Math.round(median(tbt))} ms`,
    );
  }
} finally {
  if (process.platform === 'win32' && server.pid) spawn('taskkill', ['/pid', String(server.pid), '/T', '/F']);
  else server.kill();
}
process.exitCode = ok ? 0 : 1;
