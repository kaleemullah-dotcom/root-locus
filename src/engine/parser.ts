/**
 * Recursive-descent parser for transfer-function expressions in s (and the gain symbol K).
 * Produces an AST that evaluates EXACTLY to a rational function over Q.
 *
 * Grammar
 *   expr   := ('+'|'-')? term (('+'|'-') term)*
 *   term   := power (('*'|'/')? power)*         (juxtaposition = implicit multiplication;
 *             after '/', juxtaposed factors all belong to the divisor: K/s(s+1) = K/[s(s+1)])
 *   power  := base ('^' integer)?
 *   base   := number | 's' | 'K' | '(' expr ')' | '[' expr ']'
 */
import { Q, Q0, Q1 } from './rational';
import { qdeg, qmul, qpow, qscale, qadd, qsub, qtrim, QS, type QPoly } from './qpoly';

export class ParseError extends Error {
  readonly position: number | null;
  constructor(message: string, position: number | null = null) {
    super(message);
    this.name = 'ParseError';
    this.position = position;
  }
}

export type Ast =
  | { t: 'num'; v: Q }
  | { t: 's' }
  | { t: 'K' }
  | { t: 'neg'; a: Ast }
  | { t: 'add' | 'sub' | 'mul' | 'div'; a: Ast; b: Ast }
  | { t: 'pow'; a: Ast; k: number };

const SUPERS: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
};

/** Normalise unicode maths characters typed or pasted by users. */
export function normalizeInput(src: string): string {
  let s = src
    .replace(/[−–—]/g, '-')
    .replace(/[·×⋅∙]/g, '*')
    .replace(/\*\*/g, '^')
    .replace(/÷/g, '/')
    .replace(/[{]/g, '(')
    .replace(/[}]/g, ')');
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => '^' + [...m].map((c) => SUPERS[c]).join(''));
  return s;
}

interface Tok {
  k: 'num' | 's' | 'K' | 'op' | 'lp' | 'rp' | 'end';
  v: string;
  pos: number;
}

function tokenize(raw: string): Tok[] {
  const src = normalizeInput(raw);
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
    if (m) {
      toks.push({ k: 'num', v: m[0], pos: i });
      i += m[0].length;
      continue;
    }
    if (c === 's' || c === 'S') toks.push({ k: 's', v: 's', pos: i });
    else if (c === 'K' || c === 'k') toks.push({ k: 'K', v: 'K', pos: i });
    else if ('+-*/^'.includes(c)) toks.push({ k: 'op', v: c, pos: i });
    else if (c === '(' || c === '[') toks.push({ k: 'lp', v: c, pos: i });
    else if (c === ')' || c === ']') toks.push({ k: 'rp', v: c, pos: i });
    else throw new ParseError(`Unexpected character "${c}" at position ${i + 1}`, i);
    i++;
  }
  toks.push({ k: 'end', v: '', pos: src.length });
  return toks;
}

export function parseAst(src: string): Ast {
  if (!src.trim()) throw new ParseError('Expression is empty');
  const toks = tokenize(src);
  let p = 0;
  const peek = (): Tok => toks[p];
  const next = (): Tok => toks[p++];

  function expr(): Ast {
    let neg = false;
    if (peek().k === 'op' && (peek().v === '+' || peek().v === '-')) neg = next().v === '-';
    let a = term();
    if (neg) a = { t: 'neg', a };
    while (peek().k === 'op' && (peek().v === '+' || peek().v === '-')) {
      const op = next().v;
      const b = term();
      a = { t: op === '+' ? 'add' : 'sub', a, b };
    }
    return a;
  }
  function startsBase(t: Tok): boolean {
    return t.k === 'num' || t.k === 's' || t.k === 'K' || t.k === 'lp';
  }
  function term(): Ast {
    let a = power();
    for (;;) {
      const t = peek();
      if (t.k === 'op' && (t.v === '*' || t.v === '/')) {
        next();
        if (!startsBase(peek()))
          throw new ParseError(`Expected a factor after "${t.v}" at position ${peek().pos + 1}`, peek().pos);
        let b = power();
        // Textbook convention: "K/s(s+1)" means K/[s(s+1)] — juxtaposed factors after "/" stay in the divisor.
        if (t.v === '/') while (startsBase(peek())) b = { t: 'mul', a: b, b: power() };
        a = { t: t.v === '*' ? 'mul' : 'div', a, b };
      } else if (startsBase(t)) {
        const prev = toks[p - 1];
        if (t.k === 'num' && (prev.k === 's' || prev.k === 'K'))
          throw new ParseError(
            `A number directly after "${prev.v}" at position ${t.pos + 1} is ambiguous — write ${prev.v}^${t.v} or ${t.v}${prev.v}`,
            t.pos,
          );
        if (t.k === 'num' && prev.k === 'rp')
          throw new ParseError(`A number directly after ")" at position ${t.pos + 1} — did you mean ^${t.v}?`, t.pos);
        a = { t: 'mul', a, b: power() };
      } else break;
    }
    return a;
  }
  function power(): Ast {
    const b = base();
    if (peek().k === 'op' && peek().v === '^') {
      next();
      let paren = false;
      if (peek().k === 'lp') {
        next();
        paren = true;
      }
      const t = next();
      if (t.k !== 'num' || !/^\d+$/.test(t.v))
        throw new ParseError(`Exponent must be a whole number (position ${t.pos + 1})`, t.pos);
      const k = parseInt(t.v, 10);
      if (k > 40) throw new ParseError(`Exponent ${k} is too large (max 40)`, t.pos);
      if (paren) {
        if (peek().k !== 'rp') throw new ParseError(`Missing ")" after exponent`, peek().pos);
        next();
      }
      return { t: 'pow', a: b, k };
    }
    return b;
  }
  function base(): Ast {
    const t = next();
    if (t.k === 'num') return { t: 'num', v: Q.parse(t.v) };
    if (t.k === 's') return { t: 's' };
    if (t.k === 'K') return { t: 'K' };
    if (t.k === 'lp') {
      if (peek().k === 'rp') throw new ParseError(`Empty brackets at position ${t.pos + 1}`, t.pos);
      const e = expr();
      const r = next();
      if (r.k !== 'rp') throw new ParseError(`Missing ")" for "(" at position ${t.pos + 1}`, t.pos);
      return e;
    }
    if (t.k === 'end') throw new ParseError('Expression ends unexpectedly');
    throw new ParseError(`Unexpected "${t.v}" at position ${t.pos + 1}`, t.pos);
  }
  const ast = expr();
  if (peek().k !== 'end') {
    const t = peek();
    throw new ParseError(
      t.k === 'rp' ? `Unmatched ")" at position ${t.pos + 1}` : `Unexpected "${t.v}" at position ${t.pos + 1}`,
      t.pos,
    );
  }
  return ast;
}

/** Rational function in s with exact coefficients (not automatically reduced). */
export interface RatS {
  num: QPoly;
  den: QPoly;
}

const rs = (num: QPoly, den: QPoly = [Q1]): RatS => ({ num, den });

function rsAdd(a: RatS, b: RatS, sub: boolean): RatS {
  if (qdeg(a.den) === 0 && qdeg(b.den) === 0) {
    const bn = qscale(b.num, a.den[0].div(b.den[0]));
    return rs(sub ? qsub(a.num, bn) : qadd(a.num, bn), a.den);
  }
  const l = qmul(a.num, b.den),
    r = qmul(b.num, a.den);
  return rs(sub ? qsub(l, r) : qadd(l, r), qmul(a.den, b.den));
}

/** Evaluate AST with K replaced by a numeric value. */
export function evalAst(a: Ast, K: Q = Q1): RatS {
  switch (a.t) {
    case 'num':
      return rs(qtrim([a.v]));
    case 's':
      return rs(QS);
    case 'K':
      return rs(qtrim([K]));
    case 'neg': {
      const x = evalAst(a.a, K);
      return rs(qscale(x.num, Q.int(-1)), x.den);
    }
    case 'add':
    case 'sub':
      return rsAdd(evalAst(a.a, K), evalAst(a.b, K), a.t === 'sub');
    case 'mul': {
      const x = evalAst(a.a, K),
        y = evalAst(a.b, K);
      return rs(qmul(x.num, y.num), qmul(x.den, y.den));
    }
    case 'div': {
      const x = evalAst(a.a, K),
        y = evalAst(a.b, K);
      if (!y.num.length) throw new ParseError('Division by zero in expression');
      if (qdeg(y.num) === 0 && qdeg(x.den) === 0) return rs(qscale(x.num, y.den[0].div(y.num[0])), x.den);
      return rs(qmul(x.num, y.den), qmul(x.den, y.num));
    }
    case 'pow': {
      const x = evalAst(a.a, K);
      return rs(qpow(x.num, a.k), qpow(x.den, a.k));
    }
  }
}

export function containsK(a: Ast): boolean {
  switch (a.t) {
    case 'K':
      return true;
    case 'num':
    case 's':
      return false;
    case 'neg':
    case 'pow':
      return containsK(a.a);
    default:
      return containsK(a.a) || containsK(a.b);
  }
}

/** Parse a field that must be a polynomial or rational expression in s (K not allowed). */
export function parseRational(src: string, fieldName = 'expression'): RatS {
  const ast = parseAst(src);
  if (containsK(ast)) throw new ParseError(`K is not allowed inside ${fieldName}; it is the variable gain`);
  return evalAst(ast);
}

// ------------------------------------------------------------------ complex lists

export interface QComplex {
  re: Q;
  im: Q;
}

/** Parse a single complex number such as "-1+2j", "-1 - j2", "3j", "-j", "0", "2.5". */
export function parseComplex(src: string): QComplex {
  const s = normalizeInput(src).replace(/\s+/g, '').replace(/i/g, 'j');
  if (!s) throw new ParseError('Empty number');
  let re = Q0,
    im = Q0;
  const termRe = /([+-]?)(?:(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+)\*?(j)|(j)\*?(\d+\.?\d*|\.\d+)?|(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+))/y;
  let pos = 0,
    count = 0;
  while (pos < s.length) {
    termRe.lastIndex = pos;
    const m = termRe.exec(s);
    if (!m || m[0] === '' || (count > 0 && !m[1]))
      throw new ParseError(`Cannot read "${src.trim()}" as a number (use forms like -1+2j)`, pos);
    const sign = m[1] === '-' ? Q.int(-1) : Q1;
    if (m[3]) im = im.add(Q.parse(m[2]).mul(sign));
    else if (m[4]) im = im.add((m[5] ? Q.parse(m[5]) : Q1).mul(sign));
    else re = re.add(Q.parse(m[6]).mul(sign));
    pos = termRe.lastIndex;
    count++;
  }
  return { re, im };
}

/** Parse a comma/semicolon separated list of complex numbers. Empty string → []. */
export function parseComplexList(src: string, what: string): QComplex[] {
  const t = src.trim();
  if (!t || t === '-' || /^none$/i.test(t)) return [];
  return t
    .split(/[,;]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((item) => {
      try {
        return parseComplex(item);
      } catch (e) {
        throw new ParseError(`${what}: ${(e as Error).message}`);
      }
    });
}
