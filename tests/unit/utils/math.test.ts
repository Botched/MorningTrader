import { describe, it, expect } from 'vitest';
import {
  dollarsToCents,
  centsToDollars,
  roundR,
  computeRMultiple,
  computeRValue,
  computeTargetPrice,
} from '../../../src/utils/math.js';

// ---------------------------------------------------------------------------
// dollarsToCents
// ---------------------------------------------------------------------------

describe('dollarsToCents', () => {
  it('converts $150.50 to 15050 cents', () => {
    expect(dollarsToCents(150.5)).toBe(15050);
  });

  it('converts $1.005 using Math.round', () => {
    // Math.round(1.005 * 100) depends on float representation
    expect(dollarsToCents(1.005)).toBe(Math.round(1.005 * 100));
  });

  it('converts $0 to 0 cents', () => {
    expect(dollarsToCents(0)).toBe(0);
  });

  it('converts $0.01 to 1 cent', () => {
    expect(dollarsToCents(0.01)).toBe(1);
  });

  it('converts $100 to 10000 cents', () => {
    expect(dollarsToCents(100)).toBe(10000);
  });

  it('converts $0.99 to 99 cents', () => {
    expect(dollarsToCents(0.99)).toBe(99);
  });

  it('handles large dollar amounts ($9999.99 -> 999999)', () => {
    expect(dollarsToCents(9999.99)).toBe(999999);
  });

  it('converts $1.999 to 200 cents (rounding up)', () => {
    expect(dollarsToCents(1.999)).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// centsToDollars
// ---------------------------------------------------------------------------

describe('centsToDollars', () => {
  it('converts 15050 cents to $150.50', () => {
    expect(centsToDollars(15050)).toBe(150.5);
  });

  it('converts 1 cent to $0.01', () => {
    expect(centsToDollars(1)).toBe(0.01);
  });

  it('converts 0 cents to $0', () => {
    expect(centsToDollars(0)).toBe(0);
  });

  it('converts 10000 cents to $100', () => {
    expect(centsToDollars(10000)).toBe(100);
  });

  it('converts 999999 cents to $9999.99', () => {
    expect(centsToDollars(999999)).toBe(9999.99);
  });
});

// ---------------------------------------------------------------------------
// roundR
// ---------------------------------------------------------------------------

describe('roundR', () => {
  it('rounds 1.555 to 1.56', () => {
    expect(roundR(1.555)).toBe(1.56);
  });

  it('rounds -0.5 to -0.5 (no change needed)', () => {
    expect(roundR(-0.5)).toBe(-0.5);
  });

  it('rounds 0 to 0', () => {
    expect(roundR(0)).toBe(0);
  });

  it('rounds 2.001 to 2', () => {
    expect(roundR(2.001)).toBe(2);
  });

  it('rounds 1.999 to 2', () => {
    expect(roundR(1.999)).toBe(2);
  });

  it('rounds -1.555 to -1.55 (Math.round rounds toward +infinity)', () => {
    // Math.round(-1.555 * 100) / 100 = Math.round(-155.5) / 100 = -155 / 100 = -1.55
    expect(roundR(-1.555)).toBe(-1.55);
  });

  it('preserves already-rounded values', () => {
    expect(roundR(1.23)).toBe(1.23);
  });
});

// ---------------------------------------------------------------------------
// computeRMultiple
// ---------------------------------------------------------------------------

describe('computeRMultiple', () => {
  it('LONG: entry 15000, exit 15100, R=100 -> 1.0R', () => {
    expect(computeRMultiple(15000, 15100, 100, 'LONG')).toBe(1.0);
  });

  it('SHORT: entry 15000, exit 14900, R=100 -> 1.0R', () => {
    expect(computeRMultiple(15000, 14900, 100, 'SHORT')).toBe(1.0);
  });

  it('LONG loss: entry 15000, exit 14950, R=100 -> -0.5R', () => {
    expect(computeRMultiple(15000, 14950, 100, 'LONG')).toBe(-0.5);
  });

  it('SHORT loss: entry 15000, exit 15050, R=100 -> -0.5R', () => {
    expect(computeRMultiple(15000, 15050, 100, 'SHORT')).toBe(-0.5);
  });

  it('LONG: 2R winner', () => {
    expect(computeRMultiple(15000, 15200, 100, 'LONG')).toBe(2.0);
  });

  it('SHORT: 3R winner', () => {
    expect(computeRMultiple(15000, 14700, 100, 'SHORT')).toBe(3.0);
  });

  it('LONG: breakeven (0R)', () => {
    expect(computeRMultiple(15000, 15000, 100, 'LONG')).toBe(0);
  });

  it('throws when rValue is 0', () => {
    expect(() => computeRMultiple(15000, 15100, 0, 'LONG')).toThrow(
      'rValue must be greater than 0',
    );
  });

  it('rounds result to 2 decimal places', () => {
    // 15033 - 15000 = 33; 33 / 100 = 0.33
    expect(computeRMultiple(15000, 15033, 100, 'LONG')).toBe(0.33);
  });
});

// ---------------------------------------------------------------------------
// computeRValue
// ---------------------------------------------------------------------------

describe('computeRValue', () => {
  it('computes |15000 - 14900| = 100', () => {
    expect(computeRValue(15000, 14900)).toBe(100);
  });

  it('computes |14900 - 15000| = 100 (order does not matter)', () => {
    expect(computeRValue(14900, 15000)).toBe(100);
  });

  it('returns 0 when entry equals stop', () => {
    expect(computeRValue(15000, 15000)).toBe(0);
  });

  it('handles large differences', () => {
    expect(computeRValue(20000, 15000)).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// computeTargetPrice
// ---------------------------------------------------------------------------

describe('computeTargetPrice', () => {
  it('LONG: entry 15000, R=100, multiplier 2 -> 15200', () => {
    expect(computeTargetPrice(15000, 100, 2, 'LONG')).toBe(15200);
  });

  it('SHORT: entry 15000, R=100, multiplier 2 -> 14800', () => {
    expect(computeTargetPrice(15000, 100, 2, 'SHORT')).toBe(14800);
  });

  it('LONG: 1R target', () => {
    expect(computeTargetPrice(15000, 100, 1, 'LONG')).toBe(15100);
  });

  it('SHORT: 1R target', () => {
    expect(computeTargetPrice(15000, 100, 1, 'SHORT')).toBe(14900);
  });

  it('LONG: 0R target is entry price', () => {
    expect(computeTargetPrice(15000, 100, 0, 'LONG')).toBe(15000);
  });

  it('SHORT: 0R target is entry price', () => {
    expect(computeTargetPrice(15000, 100, 0, 'SHORT')).toBe(15000);
  });

  it('LONG: fractional multiplier 1.5R', () => {
    expect(computeTargetPrice(15000, 100, 1.5, 'LONG')).toBe(15150);
  });

  it('SHORT: fractional multiplier 1.5R', () => {
    expect(computeTargetPrice(15000, 100, 1.5, 'SHORT')).toBe(14850);
  });

  it('rounds the R*multiple product to integer', () => {
    // R=33, multiple=1 -> 33*1=33 (exact). entry + 33 = 15033
    expect(computeTargetPrice(15000, 33, 1, 'LONG')).toBe(15033);
  });
});
