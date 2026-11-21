/**
 * Shareable URL state in the hash, readable by humans:
 *   #tf=K(s+2)/(s(s+1)(s+5))           expression modes
 *   #pz=<zeros>|<poles>|<gain>         pole/zero list mode
 */
import type { TFInput } from '../engine';

export function inputToHash(inp: TFInput): string {
  if (inp.mode === 'pz') return `#pz=${encodeURIComponent(`${inp.zeros}|${inp.poles}|${inp.gain}`)}`;
  const expr = inp.mode === 'string' ? inp.expr : ndToExpr(inp.num, inp.den);
  return `#tf=${encodeURIComponent(expr).replace(/%2F/g, '/').replace(/%5E/g, '^').replace(/%2B/g, '+').replace(/%2C/g, ',')}`;
}

export function ndToExpr(num: string, den: string): string {
  const n = num.trim() === '1' ? 'K' : `K(${num.trim()})`;
  return `${n}/(${den.trim()})`;
}

/** Split a "K·N/D" expression back into N and D strings when it has the simple form K(N)/(D). */
export function exprToND(expr: string): { num: string; den: string } | null {
  const s = expr.replace(/\s+/g, '');
  const m = /^K(?:\*?\((.+?)\))?\/\((.+)\)$/.exec(s) ?? /^K(?:\*?\((.+?)\))?\/(.+)$/.exec(s);
  if (!m) return null;
  const num = m[1] ?? '1';
  const den = m[2];
  // reject if the parentheses inside are unbalanced (the regex split at the wrong place)
  const bal = (x: string): boolean => {
    let d = 0;
    for (const c of x) {
      if (c === '(') d++;
      else if (c === ')' && --d < 0) return false;
    }
    return d === 0;
  };
  return bal(num) && bal(den) ? { num, den } : null;
}

export function hashToInput(hash: string): TFInput | null {
  const h = hash.replace(/^#/, '');
  const params = new URLSearchParams(h.replace(/\+/g, '%2B'));
  const tf = params.get('tf');
  if (tf) {
    const nd = exprToND(tf);
    return nd ? { mode: 'nd', ...nd } : { mode: 'string', expr: tf };
  }
  const pz = params.get('pz');
  if (pz) {
    const [zeros = '', poles = '', gain = '1'] = pz.split('|');
    return { mode: 'pz', zeros, poles, gain };
  }
  return null;
}
