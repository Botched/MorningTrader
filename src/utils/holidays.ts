import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

/**
 * Zod schema for validating the config/holidays.json file.
 * Matches the NYSE holiday calendar data format.
 */
export const HolidayCalendarSchema = z.object({
  holidays: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    name: z.string(),
  })),
  earlyCloses: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    name: z.string(),
    closeTime: z.string(),
  })),
  calendarRange: z.object({
    from: z.string(),
    to: z.string(),
  }),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Parsed holiday calendar, held in memory after one-time load at startup.
 * Dates are stored as Sets for O(1) lookup.
 */
export type HolidayCalendar = {
  readonly holidays: ReadonlySet<string>;
  readonly earlyCloseDates: ReadonlySet<string>;
  readonly calendarRange: { from: string; to: string };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return the day-of-week (0 = Sunday, 6 = Saturday) for a 'YYYY-MM-DD' string.
 * Parses the date components directly to avoid timezone issues.
 */
function dayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  // Date.UTC avoids local-timezone shifts
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Add one calendar day to a 'YYYY-MM-DD' string and return the result
 * in the same format.
 */
function addOneDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d) + 86_400_000;
  const next = new Date(ms);
  const ny = next.getUTCFullYear();
  const nm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const nd = String(next.getUTCDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load and validate the NYSE holiday calendar from a JSON file.
 *
 * This is a **synchronous** operation intended to be called once at startup.
 * The returned {@link HolidayCalendar} should be passed around as a dependency.
 *
 * @param configPath - Absolute or relative path to the holidays JSON file.
 *   Defaults to `config/holidays.json` resolved from the project root.
 * @returns A validated {@link HolidayCalendar} object.
 * @throws If the file cannot be read, contains invalid JSON, or fails schema
 *   validation.
 */
export function loadHolidayCalendar(configPath?: string): HolidayCalendar {
  const resolved = configPath
    ?? path.resolve(process.cwd(), 'config', 'holidays.json');

  const raw = fs.readFileSync(resolved, 'utf-8');
  const json: unknown = JSON.parse(raw);
  const parsed = HolidayCalendarSchema.parse(json);

  const holidays = new Set(parsed.holidays.map((h) => h.date));
  const earlyCloseDates = new Set(parsed.earlyCloses.map((e) => e.date));

  return {
    holidays,
    earlyCloseDates,
    calendarRange: parsed.calendarRange,
  };
}

/**
 * Check whether a given date is a regular NYSE trading day.
 *
 * Returns `false` for weekends (Saturday / Sunday) and dates that appear in
 * the holiday list.
 *
 * @param dateStr - Date in `YYYY-MM-DD` format.
 * @param calendar - A loaded {@link HolidayCalendar}.
 */
export function isTradingDay(dateStr: string, calendar: HolidayCalendar): boolean {
  const dow = dayOfWeek(dateStr);
  // Sunday = 0, Saturday = 6
  if (dow === 0 || dow === 6) return false;
  return !calendar.holidays.has(dateStr);
}

/**
 * Check whether a given date is an NYSE early-close day.
 *
 * @param dateStr - Date in `YYYY-MM-DD` format.
 * @param calendar - A loaded {@link HolidayCalendar}.
 */
export function isEarlyClose(dateStr: string, calendar: HolidayCalendar): boolean {
  return calendar.earlyCloseDates.has(dateStr);
}

/**
 * Check whether a date falls within the calendar's confirmed range.
 *
 * Logs a `console.warn` when the date is **outside** the range so that
 * operators are alerted the calendar data may be stale.
 *
 * @param dateStr - Date in `YYYY-MM-DD` format.
 * @param calendar - A loaded {@link HolidayCalendar}.
 */
export function isWithinCalendarRange(dateStr: string, calendar: HolidayCalendar): boolean {
  const inRange =
    dateStr >= calendar.calendarRange.from &&
    dateStr <= calendar.calendarRange.to;

  if (!inRange) {
    console.warn(
      `[holidays] Date ${dateStr} is outside the calendar range ` +
      `(${calendar.calendarRange.from} – ${calendar.calendarRange.to}). ` +
      `Holiday data may be incomplete.`,
    );
  }

  return inRange;
}

/**
 * Return the next NYSE trading day **after** the given date, skipping
 * weekends and holidays.
 *
 * @param dateStr - Date in `YYYY-MM-DD` format.
 * @param calendar - A loaded {@link HolidayCalendar}.
 * @returns The next trading day in `YYYY-MM-DD` format.
 */
export function getNextTradingDay(dateStr: string, calendar: HolidayCalendar): string {
  let candidate = addOneDay(dateStr);
  // Safety: cap iterations to avoid infinite loops if calendar data is bad
  const MAX_SKIP = 30;
  let i = 0;
  while (!isTradingDay(candidate, calendar)) {
    candidate = addOneDay(candidate);
    i++;
    if (i >= MAX_SKIP) {
      throw new Error(
        `[holidays] Could not find a trading day within ${MAX_SKIP} days after ${dateStr}`,
      );
    }
  }
  return candidate;
}
