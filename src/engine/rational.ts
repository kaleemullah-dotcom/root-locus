/**
 * Exact rational numbers backed by BigInt.
 * Always stored in lowest terms with a positive denominator.
 */

const babs = (a: bigint): bigint => (a < 0n ? -a : a);

function bgcd(a: bigint, b: bigint): bigint {
  a = babs(a);
  b = babs(b);
  while (b !== 0n) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

function bitLength(a: bigint): number {
  return babs(a).toString(2).length;
}

export class Q {
  readonly n: bigint;
  readonly d: bigint;

  private constructor(n: bigint, d: bigint) {
    this.n = n;
    this.d = d;
  }

  static readonly ZERO: Q = new Q(0n, 1n);
  static readonly ONE: Q = new Q(1n, 1n);

  static make(n: bigint, d: bigint = 1n): Q {
    if (d === 0n) throw new Error('Rational with zero denominator');
    if (n === 0n) return Q.ZERO;
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = bgcd(n, d);
    return g === 1n ? new Q(n, d) : new Q(n / g, d / g);
  }

  static int(k: number | bigint): Q {
    return Q.make(BigInt(k), 1n);
  }

  /** Parse an exact decimal / integer / exponent string such as "12", "-0.25", "1.5e-3". */
  static parse(str: string): Q {
    const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(str.trim());
    if (!m || (m[2] === '' && (m[3] ?? '') === '')) throw new Error(`Not a number: "${str}"`);
    const sign = m[1] === '-' ? -1n : 1n;
    const intPart = m[2] || '0';
    const frac = m[3] ?? '';
    const exp = m[4] ? parseInt(m[4], 10) : 0;
    let n = BigInt(intPart + frac) * sign;
    let d = 10n ** BigInt(frac.length);
    if (exp > 0) n *= 10n ** BigInt(exp);
    else if (exp < 0) d *= 10n ** BigInt(-exp);
    return Q.make(n, d);
  }

  /**
   * Exact conversion of a finite double (every double is a dyadic rational).
   * Use `approx` instead when a "nice" nearby fraction is wanted.
   */
  static fromNumber(x: number): Q {
    if (!Number.isFinite(x)) throw new Error('Cannot convert non-finite number to rational');
    if (Number.isInteger(x) && Math.abs(x) < Number.MAX_SAFE_INTEGER) return Q.int(x);
    // Use the shortest round-trip decimal representation: this is what the user typed.
    return Q.parse(x.toString());
  }

  /** Best rational approximation with denominator ≤ maxDen (continued fractions). */
  static approx(x: number, maxDen = 1_000_000): Q {
    if (!Number.isFinite(x)) throw new Error('non-finite');
    const sign = x < 0 ? -1 : 1;
    let v = Math.abs(x);
    let h0 = 0,
      h1 = 1,
      k0 = 1,
      k1 = 0;
    for (let i = 0; i < 64; i++) {
      const a = Math.floor(v);
      const h2 = a * h1 + h0;
      const k2 = a * k1 + k0;
      if (k2 > maxDen) break;
      h0 = h1;
      h1 = h2;
      k0 = k1;
      k1 = k2;
      const f = v - a;
      if (f < 1e-15) break;
      v = 1 / f;
    }
    return Q.make(BigInt(sign * h1), BigInt(k1));
  }

  add(b: Q): Q {
    if (this.d === b.d) return Q.make(this.n + b.n, this.d);
    return Q.make(this.n * b.d + b.n * this.d, this.d * b.d);
  }
  sub(b: Q): Q {
    if (this.d === b.d) return Q.make(this.n - b.n, this.d);
    return Q.make(this.n * b.d - b.n * this.d, this.d * b.d);
  }
  mul(b: Q): Q {
    if (this.n === 0n || b.n === 0n) return Q.ZERO;
    return Q.make(this.n * b.n, this.d * b.d);
  }
  div(b: Q): Q {
    if (b.n === 0n) throw new Error('Division by zero (rational)');
    return Q.make(this.n * b.d, this.d * b.n);
  }
  neg(): Q {
    return this.n === 0n ? Q.ZERO : new Q(-this.n, this.d);
  }
  inv(): Q {
    return Q.make(this.d, this.n);
  }
  pow(k: number): Q {
    let r: Q = Q.ONE;
    for (let i = 0; i < k; i++) r = r.mul(this);
    return r;
  }
  sign(): -1 | 0 | 1 {
    return this.n === 0n ? 0 : this.n > 0n ? 1 : -1;
  }
  isZero(): boolean {
    return this.n === 0n;
  }
  isOne(): boolean {
    return this.n === 1n && this.d === 1n;
  }
  isInt(): boolean {
    return this.d === 1n;
  }
  cmp(b: Q): -1 | 0 | 1 {
    return this.sub(b).sign();
  }
  eq(b: Q): boolean {
    return this.n === b.n && this.d === b.d;
  }
  abs(): Q {
    return this.n < 0n ? this.neg() : this;
  }

  /** Correctly scaled conversion to double even for huge numerators / denominators. */
  toNumber(): number {
    const n = this.n,
      d = this.d;
    const bn = bitLength(n),
      bd = bitLength(d);
    if (bn < 1000 && bd < 1000) {
      const v = Number(n) / Number(d);
      if (Number.isFinite(v) && (v !== 0 || n === 0n)) {
        if (bn <= 53 && bd <= 53) return v;
      }
    }
    // Scale so the quotient carries ~64 significant bits.
    const shift = bd - bn + 64;
    const q = shift >= 0 ? (n << BigInt(shift)) / d : n / (d << BigInt(-shift));
    return Number(q) * Math.pow(2, -shift);
  }

  /** True when the decimal expansion terminates (denominator = 2^a 5^b). */
  isTerminating(): boolean {
    let d = this.d;
    while (d % 2n === 0n) d /= 2n;
    while (d % 5n === 0n) d /= 5n;
    return d === 1n;
  }

  toString(): string {
    return this.d === 1n ? this.n.toString() : `${this.n}/${this.d}`;
  }
}

export const Q0: Q = Q.ZERO;
export const Q1: Q = Q.ONE;
