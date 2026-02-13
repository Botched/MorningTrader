import type { Candle } from '../core/models/index.js';

/**
 * Returns the highest HIGH value across all bars.
 * Throws if bars array is empty.
 */
export function getHighestHigh(bars: readonly Candle[]): number {
  if (bars.length === 0) throw new Error('Cannot get highest high from empty bars array');
  return Math.max(...bars.map(b => b.high));
}

/**
 * Returns the lowest LOW value across all bars.
 * Throws if bars array is empty.
 */
export function getLowestLow(bars: readonly Candle[]): number {
  if (bars.length === 0) throw new Error('Cannot get lowest low from empty bars array');
  return Math.min(...bars.map(b => b.low));
}

/**
 * Filters bars by time range: inclusive start, exclusive end.
 */
export function filterByTimeRange(
  bars: readonly Candle[],
  startUtc: number,
  endUtc: number,
): Candle[] {
  return bars.filter(b => b.timestamp >= startUtc && b.timestamp < endUtc);
}
