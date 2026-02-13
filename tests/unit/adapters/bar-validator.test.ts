import { describe, it, expect } from 'vitest';
import {
  CandleSchema,
  validateCandle,
} from '../../../src/adapters/ibkr/bar-validator.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validCandle() {
  return {
    timestamp: 1704067200000,
    open: 15050,
    high: 15200,
    low: 14925,
    close: 15175,
    volume: 10000,
    completed: true,
    barSizeMinutes: 5 as const,
  };
}

// ---------------------------------------------------------------------------
// CandleSchema direct tests
// ---------------------------------------------------------------------------

describe('CandleSchema', () => {
  it('accepts a valid candle', () => {
    const result = CandleSchema.safeParse(validCandle());
    expect(result.success).toBe(true);
  });

  // --- Price validations ---------------------------------------------------

  it('rejects negative open price', () => {
    const result = CandleSchema.safeParse({ ...validCandle(), open: -100 });
    expect(result.success).toBe(false);
  });

  it('rejects negative high price', () => {
    const result = CandleSchema.safeParse({ ...validCandle(), high: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects negative low price', () => {
    const result = CandleSchema.safeParse({ ...validCandle(), low: -50 });
    expect(result.success).toBe(false);
  });

  it('rejects negative close price', () => {
    const result = CandleSchema.safeParse({ ...validCandle(), close: -10 });
    expect(result.success).toBe(false);
  });

  it('rejects zero open price (.positive() excludes zero)', () => {
    const result = CandleSchema.safeParse({ ...validCandle(), open: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer open price', () => {
    const result = CandleSchema.safeParse({ ...validCandle(), open: 150.5 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer high price', () => {
    const result = CandleSchema.safeParse({ ...validCandle(), high: 152.3 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer low price', () => {
    const result = CandleSchema.safeParse({ ...validCandle(), low: 149.7 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer close price', () => {
    const result = CandleSchema.safeParse({ ...validCandle(), close: 151.9 });
    expect(result.success).toBe(false);
  });

  // --- OHLC relationship refinements ---------------------------------------

  it('rejects high < low', () => {
    const result = CandleSchema.safeParse({
      ...validCandle(),
      high: 14900,
      low: 15000,
    });
    expect(result.success).toBe(false);
  });

  it('rejects high < open', () => {
    const result = CandleSchema.safeParse({
      ...validCandle(),
      open: 15300,
      high: 15200,
    });
    expect(result.success).toBe(false);
  });

  it('rejects high < close', () => {
    const result = CandleSchema.safeParse({
      ...validCandle(),
      close: 15300,
      high: 15200,
    });
    expect(result.success).toBe(false);
  });

  it('rejects low > open', () => {
    const result = CandleSchema.safeParse({
      ...validCandle(),
      open: 14900,
      low: 14925,
      high: 15200,
    });
    expect(result.success).toBe(false);
  });

  it('rejects low > close', () => {
    const result = CandleSchema.safeParse({
      ...validCandle(),
      close: 14900,
      low: 14925,
      high: 15200,
    });
    expect(result.success).toBe(false);
  });

  it('accepts high == open == close (doji-like, flat bar)', () => {
    const result = CandleSchema.safeParse({
      ...validCandle(),
      open: 15000,
      high: 15000,
      low: 15000,
      close: 15000,
    });
    expect(result.success).toBe(true);
  });

  // --- Timestamp -----------------------------------------------------------

  it('rejects zero timestamp', () => {
    const result = CandleSchema.safeParse({ ...validCandle(), timestamp: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects negative timestamp', () => {
    const result = CandleSchema.safeParse({
      ...validCandle(),
      timestamp: -1000,
    });
    expect(result.success).toBe(false);
  });

  // --- Volume --------------------------------------------------------------

  it('rejects negative volume', () => {
    const result = CandleSchema.safeParse({ ...validCandle(), volume: -1 });
    expect(result.success).toBe(false);
  });

  it('accepts zero volume', () => {
    const result = CandleSchema.safeParse({ ...validCandle(), volume: 0 });
    expect(result.success).toBe(true);
  });

  it('rejects non-integer volume', () => {
    const result = CandleSchema.safeParse({ ...validCandle(), volume: 100.5 });
    expect(result.success).toBe(false);
  });

  // --- barSizeMinutes ------------------------------------------------------

  it('rejects barSizeMinutes != 5', () => {
    const result = CandleSchema.safeParse({
      ...validCandle(),
      barSizeMinutes: 1,
    });
    expect(result.success).toBe(false);
  });

  // --- Missing fields ------------------------------------------------------

  it('rejects missing timestamp', () => {
    const { timestamp: _, ...rest } = validCandle();
    const result = CandleSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects missing completed field', () => {
    const { completed: _, ...rest } = validCandle();
    const result = CandleSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateCandle wrapper
// ---------------------------------------------------------------------------

describe('validateCandle', () => {
  it('returns { success: true, data } for a valid candle', () => {
    const result = validateCandle(validCandle());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validCandle());
    }
  });

  it('returns { success: false, error } for an invalid candle', () => {
    const result = validateCandle({ ...validCandle(), open: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it('returns error for completely wrong input', () => {
    const result = validateCandle({ foo: 'bar' });
    expect(result.success).toBe(false);
  });

  it('returns error for null input', () => {
    const result = validateCandle(null);
    expect(result.success).toBe(false);
  });

  it('returns error for undefined input', () => {
    const result = validateCandle(undefined);
    expect(result.success).toBe(false);
  });

  it('returns error when high < low (refinement check)', () => {
    const result = validateCandle({
      ...validCandle(),
      high: 14000,
      low: 15000,
      open: 14000,
      close: 14000,
    });
    expect(result.success).toBe(false);
  });

  it('error contains descriptive issue message for high < low', () => {
    const result = validateCandle({
      ...validCandle(),
      high: 14900,
      low: 15000,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map(i => i.message);
      expect(messages.some(m => m.includes('high must be >= low'))).toBe(true);
    }
  });
});
