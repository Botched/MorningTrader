/**
 * Convert a dollar price to integer cents.
 *
 * @param dollars - Price in dollars (e.g., 150.25)
 * @returns Price in integer cents (e.g., 15025)
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Convert integer cents to dollar price.
 *
 * @param cents - Price in integer cents (e.g., 15025)
 * @returns Price in dollars (e.g., 150.25)
 */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/**
 * Round an R-multiple to 2 decimal places.
 * Uses Math.round to avoid floating-point drift.
 *
 * @param r - Raw R-multiple
 * @returns R-multiple rounded to 2 decimal places
 */
export function roundR(r: number): number {
  return Math.round(r * 100) / 100;
}

/**
 * Compute the R-multiple of a trade.
 *
 * R = (exitPrice - entryPrice) / rValue for LONG
 * R = (entryPrice - exitPrice) / rValue for SHORT
 *
 * @param entryPrice - Entry price in int cents
 * @param exitPrice - Exit price in int cents
 * @param rValue - R value (|entry - stop|) in int cents, must be > 0
 * @param direction - Trade direction ('LONG' or 'SHORT')
 * @returns R-multiple rounded to 2 decimal places
 * @throws Error if rValue is 0
 */
export function computeRMultiple(
  entryPrice: number,
  exitPrice: number,
  rValue: number,
  direction: 'LONG' | 'SHORT',
): number {
  if (rValue === 0) {
    throw new Error('rValue must be greater than 0');
  }
  const rawR =
    direction === 'LONG'
      ? (exitPrice - entryPrice) / rValue
      : (entryPrice - exitPrice) / rValue;
  return roundR(rawR);
}

/**
 * Compute R-value (risk per share) from entry and stop level.
 * R-value = |entryPrice - stopLevel|
 *
 * @param entryPrice - Entry price in int cents
 * @param stopLevel - Stop level in int cents
 * @returns R-value in int cents (always positive)
 */
export function computeRValue(entryPrice: number, stopLevel: number): number {
  return Math.abs(entryPrice - stopLevel);
}

/**
 * Compute a target price at a given R-multiple.
 *
 * For LONG: target = entryPrice + (rValue * multiple)
 * For SHORT: target = entryPrice - (rValue * multiple)
 *
 * @param entryPrice - Entry price in int cents
 * @param rValue - R-value in int cents
 * @param multiple - R-multiple (e.g., 1, 2, 3)
 * @param direction - Trade direction ('LONG' or 'SHORT')
 * @returns Target price in int cents
 */
export function computeTargetPrice(
  entryPrice: number,
  rValue: number,
  multiple: number,
  direction: 'LONG' | 'SHORT',
): number {
  return direction === 'LONG'
    ? entryPrice + Math.round(rValue * multiple)
    : entryPrice - Math.round(rValue * multiple);
}
