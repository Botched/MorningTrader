import { describe, it, expect } from 'vitest';
import {
  getHighestHigh,
  getLowestLow,
  filterByTimeRange,
} from '../../../src/utils/bar-utils.js';
import type { Candle } from '../../../src/core/models/candle.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCandle(overrides?: Partial<Candle>): Candle {
  return {
    timestamp: 1704067200000,
    open: 15050,
    high: 15200,
    low: 14925,
    close: 15175,
    volume: 10000,
    completed: true,
    barSizeMinutes: 5,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getHighestHigh
// ---------------------------------------------------------------------------

describe('getHighestHigh', () => {
  it('returns the maximum high from multiple bars', () => {
    const bars: Candle[] = [
      makeCandle({ high: 15000 }),
      makeCandle({ high: 15500 }),
      makeCandle({ high: 15200 }),
    ];
    expect(getHighestHigh(bars)).toBe(15500);
  });

  it('returns the high from a single-bar array', () => {
    const bars: Candle[] = [makeCandle({ high: 14800 })];
    expect(getHighestHigh(bars)).toBe(14800);
  });

  it('throws on an empty array', () => {
    expect(() => getHighestHigh([])).toThrow(
      'Cannot get highest high from empty bars array',
    );
  });

  it('handles bars where all highs are equal', () => {
    const bars: Candle[] = [
      makeCandle({ high: 15000 }),
      makeCandle({ high: 15000 }),
      makeCandle({ high: 15000 }),
    ];
    expect(getHighestHigh(bars)).toBe(15000);
  });

  it('handles bars with large range of highs', () => {
    const bars: Candle[] = [
      makeCandle({ high: 100 }),
      makeCandle({ high: 99999 }),
      makeCandle({ high: 50000 }),
    ];
    expect(getHighestHigh(bars)).toBe(99999);
  });
});

// ---------------------------------------------------------------------------
// getLowestLow
// ---------------------------------------------------------------------------

describe('getLowestLow', () => {
  it('returns the minimum low from multiple bars', () => {
    const bars: Candle[] = [
      makeCandle({ low: 15000 }),
      makeCandle({ low: 14500 }),
      makeCandle({ low: 14800 }),
    ];
    expect(getLowestLow(bars)).toBe(14500);
  });

  it('returns the low from a single-bar array', () => {
    const bars: Candle[] = [makeCandle({ low: 14800 })];
    expect(getLowestLow(bars)).toBe(14800);
  });

  it('throws on an empty array', () => {
    expect(() => getLowestLow([])).toThrow(
      'Cannot get lowest low from empty bars array',
    );
  });

  it('handles bars where all lows are equal', () => {
    const bars: Candle[] = [
      makeCandle({ low: 14500 }),
      makeCandle({ low: 14500 }),
      makeCandle({ low: 14500 }),
    ];
    expect(getLowestLow(bars)).toBe(14500);
  });

  it('handles bars with large range of lows', () => {
    const bars: Candle[] = [
      makeCandle({ low: 50000 }),
      makeCandle({ low: 100 }),
      makeCandle({ low: 30000 }),
    ];
    expect(getLowestLow(bars)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// filterByTimeRange
// ---------------------------------------------------------------------------

describe('filterByTimeRange', () => {
  const bars: Candle[] = [
    makeCandle({ timestamp: 1000 }),
    makeCandle({ timestamp: 2000 }),
    makeCandle({ timestamp: 3000 }),
    makeCandle({ timestamp: 4000 }),
    makeCandle({ timestamp: 5000 }),
  ];

  it('filters bars within range (inclusive start, exclusive end)', () => {
    const filtered = filterByTimeRange(bars, 2000, 4000);
    expect(filtered).toHaveLength(2);
    expect(filtered[0]!.timestamp).toBe(2000);
    expect(filtered[1]!.timestamp).toBe(3000);
  });

  it('includes bar at exact start time', () => {
    const filtered = filterByTimeRange(bars, 1000, 2000);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.timestamp).toBe(1000);
  });

  it('excludes bar at exact end time', () => {
    const filtered = filterByTimeRange(bars, 1000, 3000);
    expect(filtered).toHaveLength(2);
    expect(filtered.every(b => b.timestamp < 3000)).toBe(true);
  });

  it('returns all bars when range covers everything', () => {
    const filtered = filterByTimeRange(bars, 0, 10000);
    expect(filtered).toHaveLength(5);
  });

  it('returns empty array when no bars are in range', () => {
    const filtered = filterByTimeRange(bars, 6000, 9000);
    expect(filtered).toHaveLength(0);
  });

  it('returns empty array when range is before all bars', () => {
    const filtered = filterByTimeRange(bars, 0, 500);
    expect(filtered).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    const filtered = filterByTimeRange([], 0, 10000);
    expect(filtered).toHaveLength(0);
  });

  it('handles single bar at range start', () => {
    const filtered = filterByTimeRange(bars, 5000, 6000);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.timestamp).toBe(5000);
  });

  it('handles single bar exactly at start=end boundary (empty range)', () => {
    const filtered = filterByTimeRange(bars, 3000, 3000);
    expect(filtered).toHaveLength(0);
  });
});
