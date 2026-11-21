/**
 * Playwright screenshots of every example at 1440 px and 390 px.
 * Usage: npm run build && npm run screenshots [-- --only=class,p1] [--full]
 * Starts `vite preview` itself, writes PNGs to screenshots/, reports console errors and
 * horizontal overflow (anything wider than the viewport).
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { EXAMPLES } from '../src/lib/examples';
import { ndToExpr } from '../src/lib/urlState';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'screenshots');
mkdirSync(outDir, { recursive: true });
const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const full = args.includes('--full');
const port = 4179;

async function main(): Promise<void> {
  const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
    cwd: root,
    shell: process.platform === 'win32',
    stdio: 'pipe',
  });
  await new Promise<void>((res) => {
    server.stdout.on('data', (d: Buffer) => {
      if (d.toString().includes(String(port))) res();
    });
    setTimeout(res, 8000);
  });
  const browser = await chromium.launch();
  const problems: string[] = [];
  try {
    const list = EXAMPLES.filter((e) => !only || only.includes(e.id));
    for (const width of [1440, 390]) {
      const ctx = await browser.newContext({ viewport: { width, height: width > 800 ? 900 : 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      page.on('console', (m) => {
        if (m.type() === 'error') problems.push(`[console ${width}] ${m.text()}`);
      });
      page.on('pageerror', (e) => problems.push(`[pageerror ${width}] ${e.message}`));
      for (const ex of list) {
        const hash = '#tf=' + encodeURIComponent(ndToExpr(ex.num, ex.den));
        await page.goto(`http://localhost:${port}/${hash}`, { waitUntil: 'networkidle' });
        await page.waitForSelector('#sec-plot svg');
        await page.waitForTimeout(250);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (overflow > 1) problems.push(`[overflow ${width}] ${ex.id}: page is ${overflow}px wider than the viewport`);
        const file = join(outDir, `${ex.id}-${width}.png`);
        if (full) await page.screenshot({ path: file, fullPage: true });
        else {
          await page.locator('#sec-table').screenshot({ path: join(outDir, `${ex.id}-${width}-table.png`) });
          await page.locator('#sec-plot').screenshot({ path: join(outDir, `${ex.id}-${width}-plot.png`) });
        }
        process.stdout.write(`${ex.id}@${width} `);
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
    if (process.platform === 'win32' && server.pid) spawn('taskkill', ['/pid', String(server.pid), '/T', '/F']);
    else server.kill();
  }
  console.log(`\n${problems.length ? problems.join('\n') : 'No console errors, no horizontal overflow.'}`);
  process.exitCode = problems.length ? 1 : 0;
}
void main();
