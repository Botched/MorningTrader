import { describe, it, expect } from 'vitest';
import {
  computeRValue,
  computeRMultiple,
  computeTargetPrice,
  roundR,
  computeTargets,
  determineStopLevel,
  computeTrailingStop,
  computeMaxFavorableR,
  computeMaxAdverseR,
} from '@core/risk/calculator.js';
import type { Candle } from '@core/models/candle.js';
import type { DecisionZone } from '@core/models/decision-zone.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal Candle object for testing. */
function makeCandle(overrides: Partial<Candle> = {}): Candle {
  return {
    timestamp: Date.now(),
    open: 15000,
    high: 15100,
    low: 14900,
    close: 15050,
    volume: 1000,
    completed: true,
    barSizeMinutes: 5,
    ...overrides,
  };
}

/** Create a minimal DecisionZone for testing. */
function makeZone(overrides: Partial<DecisionZone> = {}): DecisionZone {
  return {
    resistance: 15100,
    support: 14900,
    status: 'DEFINED',
    spread: 200,
    definedAt: Date.now(),
    sourceBars: [],
    premarketPrice: 0,
    ...overrides,
  };
}

// ===========================================================================
// computeRValue
// ===========================================================================
describe('computeRValue', () => {
  it('should compute R value for LONG (entry above stop)', () => {
    // entry 15000, stop 14900 => R = 100
    expect(computeRValue(15000, 14900)).toBe(100);
  });

  it('should compute R value for SHORT (entry below stop)', () => {
    // entry 15000, stop 15100 => R = 100
    expect(computeRValue(15000, 15100)).toBe(100);
  });

  it('should handle minimum R value of 1 cent', () => {
    expect(computeRValue(15000, 14999)).toBe(1);
  });

  it('should handle large R value', () => {
    // entry 20000 ($200.00), stop 15000 ($150.00) => R = 5000 cents
    expect(computeRValue(20000, 15000)).toBe(5000);
  });

  it('should return 0 when entry equals stop', () => {
    expect(computeRValue(15000, 15000)).toBe(0);
  });
});

// ===========================================================================
// computeTargets
// ===========================================================================
describe('computeTargets', () => {
  it('should compute LONG targets: 1R=15100, 2R=15200, 3R=15300', () => {
    const targets = computeTargets(15000, 100, 'LONG');
    expect(targets.target1R).toBe(15100);
    expect(targets.target2R).toBe(15200);
    expect(targets.target3R).toBe(15300);
  });

  it('should compute SHORT targets: 1R=14900, 2R=14800, 3R=14700', () => {
    const targets = computeTargets(15000, 100, 'SHORT');
    expect(targets.target1R).toBe(14900);
    expect(targets.target2R).toBe(14800);
    expect(targets.target3R).toBe(14700);
  });

  it('should handle edge case R value of 1 cent (LONG)', () => {
    const targets = computeTargets(15000, 1, 'LONG');
    expect(targets.target1R).toBe(15001);
    expect(targets.target2R).toBe(15002);
    expect(targets.target3R).toBe(15003);
  });

  it('should handle edge case R value of 1 cent (SHORT)', () => {
    const targets = computeTargets(15000, 1, 'SHORT');
    expect(targets.target1R).toBe(14999);
    expect(targets.target2R).toBe(14998);
    expect(targets.target3R).toBe(14997);
  });

  it('should handle large R value', () => {
    const targets = computeTargets(15000, 5000, 'LONG');
    expect(targets.target1R).toBe(20000);
    expect(targets.target2R).toBe(25000);
    expect(targets.target3R).toBe(30000);
  });
});

// ===========================================================================
// computeTargetPrice (re-exported from math utils)
// ===========================================================================
describe('computeTargetPrice', () => {
  it('should compute LONG target at 1R', () => {
    expect(computeTargetPrice(15000, 100, 1, 'LONG')).toBe(15100);
  });

  it('should compute SHORT target at 2R', () => {
    expect(computeTargetPrice(15000, 100, 2, 'SHORT')).toBe(14800);
  });
});

// ===========================================================================
// computeRMultiple
// ===========================================================================
describe('computeRMultiple', () => {
  it('LONG win: entry 15000, exit 15200, R=100 => 2.0R', () => {
    expect(computeRMultiple(15000, 15200, 100, 'LONG')).toBe(2.0);
  });

  it('LONG loss: entry 15000, exit 14850, R=100 => -1.5R', () => {
    expect(computeRMultiple(15000, 14850, 100, 'LONG')).toBe(-1.5);
  });

  it('SHORT win: entry 15000, exit 14800, R=100 => 2.0R', () => {
    expect(computeRMultiple(15000, 14800, 100, 'SHORT')).toBe(2.0);
  });

  it('SHORT loss: entry 15000, exit 15150, R=100 => -1.5R', () => {
    expect(computeRMultiple(15000, 15150, 100, 'SHORT')).toBe(-1.5);
  });

  it('breakeven: entry 15000, exit 15000, R=100 => 0.0R', () => {
    expect(computeRMultiple(15000, 15000, 100, 'LONG')).toBe(0.0);
    expect(computeRMultiple(15000, 15000, 100, 'SHORT')).toBe(0.0);
  });

  it('should round to 2 decimal places', () => {
    // LONG: (15033 - 15000) / 100 = 0.33
    expect(computeRMultiple(15000, 15033, 100, 'LONG')).toBe(0.33);
    // LONG: (15067 - 15000) / 100 = 0.67
    expect(computeRMultiple(15000, 15067, 100, 'LONG')).toBe(0.67);
    // SHORT: (15000 - 14967) / 100 = 0.33
    expect(computeRMultiple(15000, 14967, 100, 'SHORT')).toBe(0.33);
  });

  it('should throw if rValue is 0', () => {
    expect(() => computeRMultiple(15000, 15100, 0, 'LONG')).toThrow(
      'rValue must be greater than 0',
    );
  });
});

// ===========================================================================
// roundR
// ===========================================================================
describe('roundR', () => {
  it('should round to 2 decimal places', () => {
    expect(roundR(2.346)).toBe(2.35);
    expect(roundR(0)).toBe(0);
    expect(roundR(1.999)).toBe(2);
    expect(roundR(-0.501)).toBe(-0.5);
  });

  it('should handle exact half-cent values', () => {
    // Math.round(155) = 155, so 1.55 stays 1.55
    expect(roundR(1.55)).toBe(1.55);
    // Math.round(250) = 250
    expect(roundR(2.5)).toBe(2.5);
  });

  it('should handle negative values', () => {
    expect(roundR(-1.234)).toBe(-1.23);
    expect(roundR(-2.999)).toBe(-3);
  });
});

// ===========================================================================
// determineStopLevel
// ===========================================================================
describe('determineStopLevel', () => {
  it('LONG: returns zone.support', () => {
    const zone = makeZone({ resistance: 15100, support: 14900 });
    expect(determineStopLevel(zone, 'LONG')).toBe(14900);
  });

  it('SHORT: returns zone.resistance', () => {
    const zone = makeZone({ resistance: 15100, support: 14900 });
    expect(determineStopLevel(zone, 'SHORT')).toBe(15100);
  });

  it('should handle zones with equal support and resistance', () => {
    const zone = makeZone({ resistance: 15000, support: 15000 });
    expect(determineStopLevel(zone, 'LONG')).toBe(15000);
    expect(determineStopLevel(zone, 'SHORT')).toBe(15000);
  });
});

// ===========================================================================
// computeTrailingStop
// ===========================================================================
describe('computeTrailingStop', () => {
  it('before 1R reached: returns initial stop level', () => {
    expect(computeTrailingStop(14900, 15000, false)).toBe(14900);
  });

  it('after 1R reached: returns entry price (breakeven)', () => {
    expect(computeTrailingStop(14900, 15000, true)).toBe(15000);
  });

  it('SHORT: before 1R returns initial stop', () => {
    // Short trade: initial stop above entry, e.g., stop at 15100, entry 15000
    expect(computeTrailingStop(15100, 15000, false)).toBe(15100);
  });

  it('SHORT: after 1R returns entry price', () => {
    expect(computeTrailingStop(15100, 15000, true)).toBe(15000);
  });
});

// ===========================================================================
// computeMaxFavorableR
// ===========================================================================
describe('computeMaxFavorableR', () => {
  it('LONG: scans bar HIGHs, computes max R from entry', () => {
    const bars: Candle[] = [
      makeCandle({ high: 15050 }),
      makeCandle({ high: 15200 }),
      makeCandle({ high: 15150 }),
    ];
    // Max high = 15200, entry = 15000, R = 100
    // MFE = (15200 - 15000) / 100 = 2.0
    expect(computeMaxFavorableR(bars, 15000, 100, 'LONG')).toBe(2.0);
  });

  it('SHORT: scans bar LOWs, computes max R from entry', () => {
    const bars: Candle[] = [
      makeCandle({ low: 14950 }),
      makeCandle({ low: 14800 }),
      makeCandle({ low: 14850 }),
    ];
    // Min low = 14800, entry = 15000, R = 100
    // MFE = (15000 - 14800) / 100 = 2.0
    expect(computeMaxFavorableR(bars, 15000, 100, 'SHORT')).toBe(2.0);
  });

  it('empty bars array: returns 0', () => {
    expect(computeMaxFavorableR([], 15000, 100, 'LONG')).toBe(0);
    expect(computeMaxFavorableR([], 15000, 100, 'SHORT')).toBe(0);
  });

  it('returns 0 when rValue is 0', () => {
    const bars: Candle[] = [makeCandle({ high: 15200 })];
    expect(computeMaxFavorableR(bars, 15000, 0, 'LONG')).toBe(0);
  });

  it('LONG: negative MFE when price never exceeds entry', () => {
    const bars: Candle[] = [
      makeCandle({ high: 14950 }),
      makeCandle({ high: 14980 }),
    ];
    // Max high = 14980, entry = 15000, R = 100
    // MFE = (14980 - 15000) / 100 = -0.20
    expect(computeMaxFavorableR(bars, 15000, 100, 'LONG')).toBe(-0.2);
  });

  it('should round to 2 decimal places', () => {
    const bars: Candle[] = [makeCandle({ high: 15033 })];
    // (15033 - 15000) / 100 = 0.33
    expect(computeMaxFavorableR(bars, 15000, 100, 'LONG')).toBe(0.33);
  });
});

// ===========================================================================
// computeMaxAdverseR
// ===========================================================================
describe('computeMaxAdverseR', () => {
  it('LONG: scans bar LOWs for worst drawdown from entry', () => {
    const bars: Candle[] = [
      makeCandle({ low: 14950 }),
      makeCandle({ low: 14800 }),
      makeCandle({ low: 14900 }),
    ];
    // Min low = 14800, entry = 15000, R = 100
    // MAE = (15000 - 14800) / 100 = 2.0
    expect(computeMaxAdverseR(bars, 15000, 100, 'LONG')).toBe(2.0);
  });

  it('SHORT: scans bar HIGHs for worst drawdown from entry', () => {
    const bars: Candle[] = [
      makeCandle({ high: 15050 }),
      makeCandle({ high: 15200 }),
      makeCandle({ high: 15100 }),
    ];
    // Max high = 15200, entry = 15000, R = 100
    // MAE = (15200 - 15000) / 100 = 2.0
    expect(computeMaxAdverseR(bars, 15000, 100, 'SHORT')).toBe(2.0);
  });

  it('empty bars array: returns 0', () => {
    expect(computeMaxAdverseR([], 15000, 100, 'LONG')).toBe(0);
    expect(computeMaxAdverseR([], 15000, 100, 'SHORT')).toBe(0);
  });

  it('returns 0 when rValue is 0', () => {
    const bars: Candle[] = [makeCandle({ low: 14800 })];
    expect(computeMaxAdverseR(bars, 15000, 0, 'LONG')).toBe(0);
  });

  it('LONG: no adverse excursion when price stays above entry', () => {
    const bars: Candle[] = [
      makeCandle({ low: 15050 }),
      makeCandle({ low: 15020 }),
    ];
    // Min low = 15020, entry = 15000, R = 100
    // MAE = (15000 - 15020) / 100 = -0.20 (negative means no adverse movement)
    expect(computeMaxAdverseR(bars, 15000, 100, 'LONG')).toBe(-0.2);
  });

  it('should round to 2 decimal places', () => {
    const bars: Candle[] = [makeCandle({ low: 14967 })];
    // (15000 - 14967) / 100 = 0.33
    expect(computeMaxAdverseR(bars, 15000, 100, 'LONG')).toBe(0.33);
  });
});
