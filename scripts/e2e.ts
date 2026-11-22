/**
 * End-to-end smoke test of the built app (Playwright).  Usage: npm run build && npm run e2e
 */
import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Page } from '@playwright/test';

const port = 4193;
const base = `http://localhost:${port}/`;
const results: Array<[string, boolean, string?]> = [];
async function check(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push([name, true]);
  } catch (e) {
    results.push([name, false, (e as Error).message.split('\n')[0]]);
  }
}
function assert(c: unknown, msg: string): void {
  if (!c) throw new Error(msg);
}

const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { shell: true, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 4000));
const browser = await chromium.launch();
const errors: string[] = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page: Page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(base);
  await page.waitForSelector('table.rl');

  await check('default example solves (class example)', async () => {
    const txt = await page.locator('table.rl').innerText();
    assert(txt.includes('13.128') && txt.includes('180'), 'expected K_brk 13.128 and K_x 180 in the table');
  });
  await check('address bar shows only the root URL', async () => {
    assert(!page.url().includes('#'), page.url());
  });
  await check('invalid input shows an error', async () => {
    await page.fill('#den', 's(s+1');
    await page.click('button[type=submit]');
    await page.waitForSelector('[role=alert]');
    assert((await page.locator('[role=alert]').innerText()).includes(')'), 'missing-paren message');
  });
  await check('improper TF is rejected with explanation', async () => {
    await page.fill('#num', 's^3');
    await page.fill('#den', 's+1');
    await page.click('button[type=submit]');
    assert((await page.locator('[role=alert]').innerText()).includes('Improper'), 'improper message');
  });
  await check('example dropdown loads the conditionally stable case', async () => {
    await page.selectOption('#examples', 'cond');
    await page.waitForFunction(() => document.querySelector('table.rl')?.textContent?.includes('163.557'));
  });
  await check('pole/zero list mode', async () => {
    await page.getByRole('radio', { name: 'Poles & zeros' }).click();
    await page.fill('#pz-poles', '0, -4, -1+2j');
    await page.fill('#pz-zeros', '');
    await page.fill('#pz-gain', '2');
    await page.click('button[type=submit]');
    await page.waitForFunction(() => document.body.textContent?.includes('added the missing conjugate'));
  });
  await check('one-line mode with K', async () => {
    await page.getByRole('radio', { name: 'One line' }).click();
    await page.fill('#expr', 'K(s+4)/((s+1)(s+2))');
    await page.click('button[type=submit]');
    await page.waitForFunction(() => document.querySelector('table.rl')?.textContent?.includes('9.899'));
  });
  await check('clicking a rule highlights it (floating preview)', async () => {
    await page.locator('table.rl').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /R5 Breakaway/ }).click();
    await page.waitForSelector('[role=dialog][aria-label="R5 on the plot"]');
  });
  await check('plot renders with locus paths and hover tooltip', async () => {
    await page.locator('#sec-plot').scrollIntoViewIfNeeded();
    await page.waitForSelector('#sec-plot svg path[stroke="#2a6fdb"]');
    const n = await page.locator('#sec-plot svg path[stroke="#2a6fdb"]').count();
    assert(n >= 2, `locus paths: ${n}`);
  });
  await check('K slider changes the stability badge', async () => {
    const slider = page.locator('#kslider');
    await slider.fill('0');
    const a = await page.locator('[role=status]').filter({ hasText: /STABLE|UNSTABLE|MARGINAL/ }).first().innerText();
    assert(/STABLE/.test(a), a);
  });
  await check('Play animates K', async () => {
    const before = await page.locator('output[for=kslider]').innerText();
    await page.getByRole('button', { name: /Play/ }).click();
    await page.waitForTimeout(800);
    const after = await page.locator('output[for=kslider]').innerText();
    await page.getByRole('button', { name: /Pause/ }).click();
    assert(before !== after, `${before} → ${after}`);
  });
  await check('SVG and PNG export download', async () => {
    const [svg] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'SVG', exact: true }).click()]);
    const p1 = join(tmpdir(), 'rl-test.svg');
    await svg.saveAs(p1);
    assert(statSync(p1).size > 3000, 'svg too small');
    const [png] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PNG', exact: true }).click()]);
    const p2 = join(tmpdir(), 'rl-test.png');
    await png.saveAs(p2);
    assert(statSync(p2).size > 10000, 'png too small');
  });
  await check('PDF export downloads a multi-page A4 file', async () => {
    const [pdf] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.getByRole('button', { name: 'Export PDF' }).click()]);
    const p = join(tmpdir(), 'rl-test.pdf');
    await pdf.saveAs(p);
    assert(statSync(p).size > 50000, `pdf size ${statSync(p).size}`);
    console.log('PDF saved to', p);
  });
  await check('K < 0 mode draws the complementary locus and simulates negative K', async () => {
    await page.getByRole('radio', { name: 'K < 0' }).click();
    await page.waitForSelector('#sec-plot svg path[stroke="#0c8599"]', { timeout: 10000, state: 'attached' });
    const k = await page.locator('output[for=kslider]').innerText();
    assert(k.includes('−'), `K should be negative: ${k}`);
    const blue = await page.locator('#sec-plot svg path[stroke="#2a6fdb"][fill="none"]').count();
    assert(blue === 0, `K > 0 locus should be hidden, found ${blue}`);
  });
  await check('Both mode shows both loci; Play sweeps through K = 0', async () => {
    await page.getByRole('radio', { name: 'Both' }).click();
    await page.waitForSelector('#sec-plot svg path[stroke="#0c8599"]', { state: 'attached' });
    await page.waitForSelector('#sec-plot svg path[stroke="#2a6fdb"][fill="none"]', { state: 'attached' });
    await page.getByRole('button', { name: /Play/ }).click();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: /Pause/ }).click();
    await page.getByRole('radio', { name: 'K > 0' }).click();
  });
  await check('teach mode steps through the rules', async () => {
    await page.getByRole('tab', { name: 'Step-by-step' }).click();
    await page.waitForSelector('text=R1 · No. of Branches');
    await page.getByRole('button', { name: 'Next →' }).click();
    await page.waitForSelector('text=R2 · Real Axis Segment');
    await page.keyboard.press('ArrowRight');
    await page.waitForSelector('text=R3 · Angles of Asymptotes');
  });
  await check('shared URL reopens the same transfer function', async () => {
    const p2 = await ctx.newPage();
    await p2.goto(`${base}#tf=${encodeURIComponent('K/(s(s+3)(s^2+2s+2))')}`);
    await p2.waitForFunction(() => document.querySelector('table.rl')?.textContent?.includes('8.16'));
    assert(!p2.url().includes('#'), `hash should be cleared: ${p2.url()}`);
    await p2.close();
  });
  await check('mobile 390px: cards, no horizontal scroll', async () => {
    const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await m.goto(base);
    await m.waitForSelector('.rule-cards article');
    const over = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(over <= 1, `overflow ${over}px`);
    await m.getByRole('button', { name: /Show formula & working/ }).first().click();
    await m.waitForSelector('text=Calculations');
    await m.close();
  });
  await check('no console errors', async () => {
    assert(errors.length === 0, errors.join(' | '));
  });
} finally {
  await browser.close();
  if (process.platform === 'win32' && server.pid) spawn('taskkill', ['/pid', String(server.pid), '/T', '/F']);
  else server.kill();
}
for (const [n, ok, msg] of results) console.log(`${ok ? '✓' : '✗'} ${n}${msg ? ` — ${msg}` : ''}`);
const failed = results.filter((r) => !r[1]).length;
console.log(`\n${results.length - failed}/${results.length} e2e checks passed`);
process.exitCode = failed ? 1 : 0;
