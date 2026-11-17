import { Fraction } from './fraction';

/**
 * Exact base-10 decimal representation `(coeff * 10^exp)` for clean axis steps and labels,
 * matching Python's `decimal.Decimal` behavior used in `buoc_dep` and `dinh_dang_nhan`.
 */
export class ExactDecimal {
  readonly coeff: bigint;
  readonly exp: number; // value = coeff * 10^exp

  constructor(coeff: bigint, exp: number) {
    if (coeff === 0n) {
      this.coeff = 0n;
      this.exp = 0;
    } else {
      let c = coeff;
      let e = exp;
      while (c % 10n === 0n) {
        c /= 10n;
        e += 1;
      }
      this.coeff = c;
      this.exp = e;
    }
  }

  static parse(raw: string): ExactDecimal {
    const s = raw.trim().replace(/,/g, '.');
    const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(s);
    if (!m || (!m[2] && !m[3])) {
      throw new Error('Invalid decimal');
    }
    const sign = m[1] === '-' ? -1n : 1n;
    const intPart = m[2] || '';
    const fracPart = m[3] || '';
    const expPart = m[4] ? parseInt(m[4], 10) : 0;
    const digits = BigInt((intPart + fracPart) || '0');
    return new ExactDecimal(sign * digits, expPart - fracPart.length);
  }

  static fromIntExp(coeff: number, exp: number): ExactDecimal {
    return new ExactDecimal(BigInt(coeff), exp);
  }

  isPositive(): boolean {
    return this.coeff > 0n;
  }

  isZero(): boolean {
    return this.coeff === 0n;
  }

  isOne(): boolean {
    return this.coeff === 1n && this.exp === 0;
  }

  mulInt(k: number): ExactDecimal {
    return new ExactDecimal(this.coeff * BigInt(k), this.exp);
  }

  toNumber(): number {
    if (this.coeff === 0n) return 0;
    return Number(this.coeff) * Math.pow(10, this.exp);
  }

  toFraction(): Fraction {
    if (this.coeff === 0n) return Fraction.ZERO;
    if (this.exp >= 0) {
      return new Fraction(this.coeff * 10n ** BigInt(this.exp), 1n);
    }
    return new Fraction(this.coeff, 10n ** BigInt(-this.exp));
  }

  /** Adjusted base-10 exponent: floor(log10(|value|)). */
  adjusted(): number {
    if (this.coeff === 0n) return 0;
    const absStr = (this.coeff < 0n ? -this.coeff : this.coeff).toString();
    return absStr.length - 1 + this.exp;
  }

  /** Plain fixed-point decimal string without scientific notation, trailing zeros stripped. */
  toFixedPlain(): string {
    if (this.coeff === 0n) return '0';
    const neg = this.coeff < 0n;
    const digits = (neg ? -this.coeff : this.coeff).toString();
    const sign = neg ? '-' : '';
    if (this.exp >= 0) {
      return sign + digits + '0'.repeat(this.exp);
    }
    const shift = -this.exp;
    if (digits.length <= shift) {
      return sign + '0.' + '0'.repeat(shift - digits.length) + digits;
    }
    const split = digits.length - shift;
    return sign + digits.slice(0, split) + '.' + digits.slice(split);
  }

  equals(other: ExactDecimal): boolean {
    return this.coeff === other.coeff && this.exp === other.exp;
  }
}
