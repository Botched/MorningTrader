import type { Candle, DecisionZone } from '../models/index.js';
import { computeRValue, computeRMultiple, computeTargetPrice, roundR } from '../../utils/math.js';

// Re-export math utils so consumers can get everything from one place
export { computeRValue, computeRMultiple, computeTargetPrice, roundR };

/**
 * Compute all R targets for a trade entry.
 * Returns { target1R, target2R, target3R } in integer cents.
 *
 * @param entryPrice - Entry price in int cents
 * @param rValue - R value (|entry - stop|) in int cents
 * @param direction - Trade direction ('LONG' or 'SHORT')
 * @returns Object with target1R, target2R, target3R in int cents
 */
export function computeTargets(
  entryPrice: number,
  rValue: number,
  direction: 'LONG' | 'SHORT',
): { target1R: number; target2R: number; target3R: number } {
  return {
    target1R: computeTargetPrice(entryPrice, rValue, 1, direction),
    target2R: computeTargetPrice(entryPrice, rValue, 2, direction),
    target3R: computeTargetPrice(entryPrice, rValue, 3, direction),
  };
}

/**
 * Determine the initial stop level based on zone and direction.
 * LONG: stop at zone support (entry is above resistance, stop at support protects against loss)
 * SHORT: stop at zone resistance (entry is below support, stop at resistance protects against loss)
 *
 * @param zone - The decision zone containing support and resistance levels
 * @param direction - Trade direction ('LONG' or 'SHORT')
 * @returns Stop level in int cents
 */
export function determineStopLevel(
  zone: DecisionZone,
  direction: 'LONG' | 'SHORT',
): number {
  return direction === 'LONG' ? zone.support : zone.resistance;
}

/**
 * Compute trailing stop level.
 * Before 1R reached: returns initial stop (zone level).
 * After 1R reached: returns entry price (breakeven stop).
 *
 * @param initialStop - Initial stop level in int cents
 * @param entryPrice - Entry price in int cents
 * @param reached1R - Whether price has reached the 1R target
 * @returns Trailing stop level in int cents
 */
export function computeTrailingStop(
  initialStop: number,
  entryPrice: number,
  reached1R: boolean,
): number {
  return reached1R ? entryPrice : initialStop;
}

/**
 * Compute Maximum Favorable Excursion in R-multiples.
 * For LONG: uses bar HIGHs relative to entry.
 * For SHORT: uses bar LOWs relative to entry.
 *
 * @param bars - Array of candle bars after trade entry
 * @param entryPrice - Entry price in int cents
 * @param rValue - R value in int cents, must be > 0
 * @param direction - Trade direction ('LONG' or 'SHORT')
 * @returns MFE as R-multiple rounded to 2 decimal places
 */
export function computeMaxFavorableR(
  bars: readonly Candle[],
  entryPrice: number,
  rValue: number,
  direction: 'LONG' | 'SHORT',
): number {
  if (bars.length === 0 || rValue === 0) return 0;
  if (direction === 'LONG') {
    const maxHigh = Math.max(...bars.map(b => b.high));
    return roundR((maxHigh - entryPrice) / rValue);
  }
  const minLow = Math.min(...bars.map(b => b.low));
  return roundR((entryPrice - minLow) / rValue);
}

/**
 * Compute Maximum Adverse Excursion in R-multiples.
 * For LONG: uses bar LOWs relative to entry (how far against you).
 * For SHORT: uses bar HIGHs relative to entry.
 *
 * @param bars - Array of candle bars after trade entry
 * @param entryPrice - Entry price in int cents
 * @param rValue - R value in int cents, must be > 0
 * @param direction - Trade direction ('LONG' or 'SHORT')
 * @returns MAE as R-multiple rounded to 2 decimal places
 */
export function computeMaxAdverseR(
  bars: readonly Candle[],
  entryPrice: number,
  rValue: number,
  direction: 'LONG' | 'SHORT',
): number {
  if (bars.length === 0 || rValue === 0) return 0;
  if (direction === 'LONG') {
    const minLow = Math.min(...bars.map(b => b.low));
    return roundR((entryPrice - minLow) / rValue);
  }
  const maxHigh = Math.max(...bars.map(b => b.high));
  return roundR((maxHigh - entryPrice) / rValue);
}
