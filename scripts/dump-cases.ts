/** Runs the engine on every verification case and writes scripts/out/engine.json for verify.py. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { solveTF, summarize } from '../src/engine/index';
import { ALL_CASES } from './cases';

const here = dirname(fileURLToPath(import.meta.url));
const out: unknown[] = [];
for (const c of ALL_CASES) {
  try {
    const sol = solveTF({ mode: 'nd', num: c.num, den: c.den });
    out.push({ id: c.id, num: c.num, den: c.den, ...summarize(sol) });
  } catch (e) {
    out.push({ id: c.id, num: c.num, den: c.den, error: (e as Error).message });
  }
}
mkdirSync(join(here, 'out'), { recursive: true });
const file = join(here, 'out', 'engine.json');
writeFileSync(file, JSON.stringify(out, null, 1));
console.log(`engine: wrote ${out.length} cases → ${file}`);
