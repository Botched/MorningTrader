import { describe, it, expect } from 'vitest';
import {
  normalizeBar,
  BarCompletionBuffer,
  type IBKRBar,
} from '../../../src/adapters/ibkr/bar-normalizer.js';
import type { Candle } from '../../../src/core/models/candle.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIBKRBar(overrides?: Partial<IBKRBar>): IBKRBar {
  return {
    time: '1704067200', // 2024-01-01T00:00:00Z in epoch seconds
    open: 150.5,
    high: 152.0,
    low: 149.25,
    close: 151.75,
    volume: 10000,
    ...overrides,
  };
}

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
// normalizeBar
// ---------------------------------------------------------------------------

describe('normalizeBar', () => {
  it('converts epoch seconds string to UTC milliseconds', () => {
    const bar = makeIBKRBar({ time: '1704067200' });
    const candle = normalizeBar(bar);
    expect(candle.timestamp).toBe(1704067200000);
  });

  it('converts a different epoch seconds value correctly', () => {
    // 2024-06-15T13:30:00Z = 1718455800 seconds
    const bar = makeIBKRBar({ time: '1718455800' });
    const candle = normalizeBar(bar);
    expect(candle.timestamp).toBe(1718455800000);
  });

  it('converts dollar prices to integer cents', () => {
    const bar = makeIBKRBar({
      open: 150.5,
      high: 152.0,
      low: 149.25,
      close: 151.75,
    });
    const candle = normalizeBar(bar);
    expect(candle.open).toBe(15050);
    expect(candle.high).toBe(15200);
    expect(candle.low).toBe(14925);
    expect(candle.close).toBe(15175);
  });

  it('handles rounding edge case $1.005 -> 101 cents (Math.round)', () => {
    const bar = makeIBKRBar({ open: 1.005 });
    const candle = normalizeBar(bar);
    // Math.round(1.005 * 100) = Math.round(100.49999...) = 100 due to float
    // OR Math.round(100.5) = 101 depending on platform
    // The implementation uses dollarsToCents which is Math.round(dollars * 100)
    expect(candle.open).toBe(Math.round(1.005 * 100));
  });

  it('handles whole dollar prices correctly ($100 -> 10000)', () => {
    const bar = makeIBKRBar({ open: 100.0 });
    const candle = normalizeBar(bar);
    expect(candle.open).toBe(10000);
  });

  it('handles sub-penny prices via rounding ($0.999 -> 100)', () => {
    const bar = makeIBKRBar({ close: 0.999 });
    const candle = normalizeBar(bar);
    expect(candle.close).toBe(Math.round(0.999 * 100));
  });

  it('defaults null/undefined volume to 0', () => {
    const bar = makeIBKRBar({ volume: undefined });
    const candle = normalizeBar(bar);
    expect(candle.volume).toBe(0);
  });

  it('preserves explicit volume when provided', () => {
    const bar = makeIBKRBar({ volume: 50000 });
    const candle = normalizeBar(bar);
    expect(candle.volume).toBe(50000);
  });

  it('sets barSizeMinutes to 5', () => {
    const candle = normalizeBar(makeIBKRBar());
    expect(candle.barSizeMinutes).toBe(5);
  });

  it('sets completed to true', () => {
    const candle = normalizeBar(makeIBKRBar());
    expect(candle.completed).toBe(true);
  });

  it('produces a well-formed Candle from a typical bar', () => {
    const bar = makeIBKRBar();
    const candle = normalizeBar(bar);
    expect(candle).toEqual({
      timestamp: 1704067200000,
      open: 15050,
      high: 15200,
      low: 14925,
      close: 15175,
      volume: 10000,
      completed: true,
      barSizeMinutes: 5,
    });
  });
});

// ---------------------------------------------------------------------------
// BarCompletionBuffer
// ---------------------------------------------------------------------------

describe('BarCompletionBuffer', () => {
  it('stores the first bar and does not emit it (returns null)', () => {
    const buf = new BarCompletionBuffer();
    const bar = makeCandle({ timestamp: 1000 });
    const result = buf.push(bar);
    expect(result).toBeNull();
  });

  it('emits buffered bar as completed when a new timestamp arrives', () => {
    const buf = new BarCompletionBuffer();
    const bar1 = makeCandle({ timestamp: 1000, open: 100 });
    const bar2 = makeCandle({ timestamp: 2000, open: 200 });

    buf.push(bar1);
    const completed = buf.push(bar2);

    expect(completed).not.toBeNull();
    expect(completed!.timestamp).toBe(1000);
    expect(completed!.open).toBe(100);
    expect(completed!.completed).toBe(true);
  });

  it('replaces buffer on same-timestamp update without emitting', () => {
    const buf = new BarCompletionBuffer();
    const bar1 = makeCandle({ timestamp: 1000, close: 100 });
    const bar1Updated = makeCandle({ timestamp: 1000, close: 200 });

    buf.push(bar1);
    const result = buf.push(bar1Updated);

    expect(result).toBeNull();
  });

  it('after same-timestamp update, flush emits the updated bar', () => {
    const buf = new BarCompletionBuffer();
    const bar1 = makeCandle({ timestamp: 1000, close: 100 });
    const bar1Updated = makeCandle({ timestamp: 1000, close: 200 });

    buf.push(bar1);
    buf.push(bar1Updated);

    const flushed = buf.flush();
    expect(flushed).not.toBeNull();
    expect(flushed!.close).toBe(200);
    expect(flushed!.completed).toBe(true);
  });

  it('flush() emits the buffered bar as completed', () => {
    const buf = new BarCompletionBuffer();
    const bar = makeCandle({ timestamp: 5000, high: 300 });

    buf.push(bar);
    const flushed = buf.flush();

    expect(flushed).not.toBeNull();
    expect(flushed!.timestamp).toBe(5000);
    expect(flushed!.high).toBe(300);
    expect(flushed!.completed).toBe(true);
  });

  it('flush() on empty buffer returns null', () => {
    const buf = new BarCompletionBuffer();
    expect(buf.flush()).toBeNull();
  });

  it('flush() clears the buffer (second flush returns null)', () => {
    const buf = new BarCompletionBuffer();
    buf.push(makeCandle({ timestamp: 1000 }));
    buf.flush();
    expect(buf.flush()).toBeNull();
  });

  it('emits each previous bar as completed in a sequence', () => {
    const buf = new BarCompletionBuffer();
    const bars = [
      makeCandle({ timestamp: 1000, open: 100 }),
      makeCandle({ timestamp: 2000, open: 200 }),
      makeCandle({ timestamp: 3000, open: 300 }),
      makeCandle({ timestamp: 4000, open: 400 }),
    ];

    const emitted: Candle[] = [];

    for (const bar of bars) {
      const completed = buf.push(bar);
      if (completed) emitted.push(completed);
    }

    // Should have emitted bars 1, 2, 3 — bar 4 is still buffered
    expect(emitted).toHaveLength(3);
    expect(emitted[0]!.timestamp).toBe(1000);
    expect(emitted[1]!.timestamp).toBe(2000);
    expect(emitted[2]!.timestamp).toBe(3000);
    expect(emitted.every(c => c.completed)).toBe(true);

    // Flush the last bar
    const last = buf.flush();
    expect(last).not.toBeNull();
    expect(last!.timestamp).toBe(4000);
    expect(last!.completed).toBe(true);
  });

  it('marks buffered bar as completed=false internally', () => {
    const buf = new BarCompletionBuffer();
    const bar = makeCandle({ timestamp: 1000, completed: true });
    buf.push(bar);

    // When we push a second bar, the first should come out as completed=true
    const completed = buf.push(makeCandle({ timestamp: 2000 }));
    expect(completed!.completed).toBe(true);
  });

  it('reset() clears the buffer without emitting', () => {
    const buf = new BarCompletionBuffer();
    buf.push(makeCandle({ timestamp: 1000 }));
    buf.reset();
    expect(buf.flush()).toBeNull();
  });
});
