import { TZDate } from '@date-fns/tz';

const ET_TIMEZONE = 'America/New_York';

/**
 * Session time windows for a given trading day.
 * All values are UTC milliseconds.
 */
export interface SessionWindows {
  readonly premarketUtc: number;      // 09:00 ET -> UTC ms
  readonly zoneStartUtc: number;      // 09:30 ET -> UTC ms
  readonly zoneEndUtc: number;        // 10:00 ET -> UTC ms
  readonly executionEndUtc: number;   // 12:00 ET -> UTC ms (90 min evaluation period)
}

/**
 * Convert an Eastern Time date+time to UTC milliseconds.
 *
 * @param dateStr - Date in 'YYYY-MM-DD' format
 * @param timeStr - Time in 'HH:MM' format (24-hour, ET)
 * @returns UTC milliseconds
 *
 * @example
 * etToUtc('2024-03-10', '09:30') // Spring forward day - handles DST correctly
 */
export function etToUtc(dateStr: string, timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  // TZDate creates a date in the specified timezone
  // It automatically handles DST transitions
  const tzDate = new TZDate(
    parseInt(dateStr.substring(0, 4), 10),    // year
    parseInt(dateStr.substring(5, 7), 10) - 1, // month (0-indexed)
    parseInt(dateStr.substring(8, 10), 10),    // day
    hours,
    minutes,
    0,
    0,
    ET_TIMEZONE,
  );
  return tzDate.getTime();
}

/**
 * Get session time windows for a trading day.
 *
 * @param dateStr - Date in 'YYYY-MM-DD' format
 * @returns SessionWindows with all times as UTC milliseconds
 */
export function getSessionWindows(dateStr: string): SessionWindows {
  return {
    premarketUtc: etToUtc(dateStr, '09:00'),
    zoneStartUtc: etToUtc(dateStr, '09:30'),
    zoneEndUtc: etToUtc(dateStr, '10:00'),
    executionEndUtc: etToUtc(dateStr, '12:00'),  // Extended to 12:00 for 90 min evaluation
  };
}

/**
 * Snap a UTC timestamp to the nearest bar grid boundary (floor).
 *
 * @param utcMs - UTC milliseconds to normalize
 * @param barSizeMinutes - Bar size in minutes (typically 5)
 * @returns UTC milliseconds snapped to bar grid
 *
 * @example
 * // 10:03 snaps to 10:00 for 5-min bars
 * normalizeToBarGrid(etToUtc('2024-01-02', '10:03'), 5) === etToUtc('2024-01-02', '10:00')
 */
export function normalizeToBarGrid(utcMs: number, barSizeMinutes: number): number {
  const msPerBar = barSizeMinutes * 60 * 1000;
  return Math.floor(utcMs / msPerBar) * msPerBar;
}

/**
 * Check if a UTC timestamp falls within a time range (inclusive start, exclusive end).
 *
 * @param utcMs - Timestamp to check
 * @param startUtc - Range start (inclusive)
 * @param endUtc - Range end (exclusive)
 * @returns true if startUtc <= utcMs < endUtc
 */
export function isWithinRange(utcMs: number, startUtc: number, endUtc: number): boolean {
  return utcMs >= startUtc && utcMs < endUtc;
}

/**
 * Format a UTC millisecond timestamp to 'YYYY-MM-DD' in Eastern Time.
 * Useful for getting the trading date from a UTC timestamp.
 *
 * @param utcMs - UTC milliseconds
 * @returns Date string in 'YYYY-MM-DD' format (ET)
 */
export function utcToEtDateStr(utcMs: number): string {
  const tzDate = new TZDate(utcMs, ET_TIMEZONE);
  const year = tzDate.getFullYear();
  const month = String(tzDate.getMonth() + 1).padStart(2, '0');
  const day = String(tzDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
