/**
 * Exact rational number arithmetic backed by BigInt, matching Python's fractions.Fraction.
 */

export function gcdBigInt(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x === 0n ? 1n : x;
}

export class Fraction {
  readonly numerator: bigint;
  readonly denominator: bigint;

  static readonly ZERO = new Fraction(0n, 1n);
  static readonly ONE = new Fraction(1n, 1n);
  static readonly MINUS_ONE = new Fraction(-1n, 1n);

  constructor(num: bigint | number, den: bigint | number = 1n) {
    let n = typeof num === 'bigint' ? num : BigInt(Math.trunc(num));
    let d = typeof den === 'bigint' ? den : BigInt(Math.trunc(den));
    if (d === 0n) {
      throw new RangeError('Division by zero in Fraction');
    }
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    if (n === 0n) {
      this.numerator = 0n;
      this.denominator = 1n;
    } else {
      const g = gcdBigInt(n, d);
      this.numerator = n / g;
      this.denominator = d / g;
    }
  }

  static fromString(raw: string): Fraction {
    const s = raw.trim();
    if (!s) {
      throw new Error(`Invalid fraction string: "${raw}"`);
    }
    if (s.includes('/')) {
      const parts = s.split('/');
      if (parts.length !== 2) {
        throw new Error(`Invalid fraction string: "${raw}"`);
      }
      const n = BigInt(parts[0].trim());
      const d = BigInt(parts[1].trim());
      return new Fraction(n, d);
    }
    if (s.includes('.') || s.includes('e') || s.includes('E')) {
      return Fraction.fromDecimalString(s);
    }
    return new Fraction(BigInt(s), 1n);
  }

  static fromDecimalString(raw: string): Fraction {
    const s = raw.trim();
    const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(s);
    if (!match || (!match[2] && !match[3])) {
      throw new Error(`Invalid decimal string: "${raw}"`);
    }
    const sign = match[1] === '-' ? -1n : 1n;
    const intPart = match[2] || '';
    const fracPart = match[3] || '';
    const exp = match[4] ? parseInt(match[4], 10) : 0;
    const digits = intPart + fracPart;
    const numDigits = BigInt(digits || '0');
    const netExp = exp - fracPart.length;
    if (netExp >= 0) {
      return new Fraction(sign * numDigits * 10n ** BigInt(netExp), 1n);
    }
    return new Fraction(sign * numDigits, 10n ** BigInt(-netExp));
  }

  /**
   * Convert a finite JS number to a Fraction using continued-fraction approximation
   * (max denominator 10^9) so floating-point values like mouse coordinates or Decimal steps convert cleanly.
   */
  static fromNumber(x: number, maxDen = 1_000_000_000n): Fraction {
    if (!Number.isFinite(x)) {
      throw new RangeError('Cannot convert non-finite number to Fraction');
    }
    if (x === 0) return Fraction.ZERO;
    if (Number.isInteger(x) && Math.abs(x) <= Number.MAX_SAFE_INTEGER) {
      return new Fraction(BigInt(x), 1n);
    }
    const sign = x < 0 ? -1n : 1n;
    let v = Math.abs(x);
    if (v >= 1e15) {
      return new Fraction(sign * BigInt(Math.round(v)), 1n);
    }
    // Limit denominator with continued fractions
    let h1 = 1n, h2 = 0n;
    let k1 = 0n, k2 = 1n;
    let b = v;
    for (let iter = 0; iter < 64; iter++) {
      const a = Math.floor(b);
      const aBig = BigInt(a);
      const nextK = aBig * k1 + k2;
      if (nextK > maxDen) {
        const rem = (maxDen - k2) / k1;
        const h = rem * h1 + h2;
        const k = rem * k1 + k2;
        return new Fraction(sign * h, k);
      }
      const nextH = aBig * h1 + h2;
      h2 = h1;
      h1 = nextH;
      k2 = k1;
      k1 = nextK;
      const frac = b - a;
      if (frac < 1e-12) break;
      b = 1 / frac;
      if (!Number.isFinite(b) || b > 1e15) break;
    }
    return new Fraction(sign * h1, k1);
  }

  isZero(): boolean {
    return this.numerator === 0n;
  }

  sign(): number {
    return this.numerator < 0n ? -1 : this.numerator > 0n ? 1 : 0;
  }

  neg(): Fraction {
    return new Fraction(-this.numerator, this.denominator);
  }

  abs(): Fraction {
    return this.numerator < 0n ? this.neg() : this;
  }

  add(other: Fraction): Fraction {
    return new Fraction(
      this.numerator * other.denominator + other.numerator * this.denominator,
      this.denominator * other.denominator
    );
  }

  sub(other: Fraction): Fraction {
    return new Fraction(
      this.numerator * other.denominator - other.numerator * this.denominator,
      this.denominator * other.denominator
    );
  }

  mul(other: Fraction): Fraction {
    return new Fraction(
      this.numerator * other.numerator,
      this.denominator * other.denominator
    );
  }

  div(other: Fraction): Fraction {
    if (other.numerator === 0n) {
      throw new RangeError('Division by zero');
    }
    return new Fraction(
      this.numerator * other.denominator,
      this.denominator * other.numerator
    );
  }

  eq(other: Fraction): boolean {
    return this.numerator === other.numerator && this.denominator === other.denominator;
  }

  cmp(other: Fraction): number {
    const diff = this.numerator * other.denominator - other.numerator * this.denominator;
    return diff < 0n ? -1 : diff > 0n ? 1 : 0;
  }

  lt(other: Fraction): boolean {
    return this.cmp(other) < 0;
  }

  lte(other: Fraction): boolean {
    return this.cmp(other) <= 0;
  }

  gt(other: Fraction): boolean {
    return this.cmp(other) > 0;
  }

  gte(other: Fraction): boolean {
    return this.cmp(other) >= 0;
  }

  /** Round to nearest integer (half-to-even or standard round). */
  roundInt(): bigint {
    const absN = this.numerator < 0n ? -this.numerator : this.numerator;
    const q = absN / this.denominator;
    const r = absN % this.denominator;
    const twiceR = r * 2n;
    let rounded = q;
    if (twiceR > this.denominator) {
      rounded = q + 1n;
    } else if (twiceR === this.denominator && (q % 2n === 1n)) {
      rounded = q + 1n;
    }
    return this.numerator < 0n ? -rounded : rounded;
  }

  toNumber(): number {
    // Convert cleanly even for large BigInts
    const nStr = this.numerator.toString();
    const dStr = this.denominator.toString();
    if (nStr.length <= 15 && dStr.length <= 15) {
      return Number(this.numerator) / Number(this.denominator);
    }
    const shift = Math.max(0, Math.max(nStr.length, dStr.length) - 15);
    const divPow = 10n ** BigInt(shift);
    const nApprox = Number(this.numerator / divPow);
    const dApprox = Number(this.denominator / divPow);
    if (dApprox === 0) return Number(this.numerator) / Number(this.denominator);
    return nApprox / dApprox;
  }

  toString(): string {
    return this.denominator === 1n
      ? this.numerator.toString()
      : `${this.numerator.toString()}/${this.denominator.toString()}`;
  }
}
