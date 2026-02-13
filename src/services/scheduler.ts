/**
 * MorningTrader - Scheduler Service
 *
 * Orchestrates when trading sessions start based on the market calendar
 * and session windows. Uses the Clock interface so that simulated clocks
 * (backtest) resolve wait calls instantly while the system clock blocks
 * until the real wall-clock time arrives.
 *
 * All timestamps are UTC milliseconds.
 */

import type { Clock } from '../core/interfaces/index.js';
import type { Logger } from './logger.js';
import type { HolidayCalendar } from '../utils/holidays.js';
import { getSessionWindows } from '../utils/time.js';
import { utcToEtDateStr } from '../utils/time.js';
import {
  isTradingDay,
  isEarlyClose,
  isWithinCalendarRange,
  getNextTradingDay,
} from '../utils/holidays.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface SchedulerConfig {
  /** Pre-market buffer time in minutes before zone start (default: 30 = 09:00 ET) */
  readonly premarketBufferMinutes: number;
}

// ---------------------------------------------------------------------------
// Session Schedule
// ---------------------------------------------------------------------------

export interface SessionSchedule {
  /** Trading date in YYYY-MM-DD format (Eastern Time) */
  readonly date: string;
  /** Whether this date is a regular NYSE trading day */
  readonly isTradingDay: boolean;
  /** Whether this date is an NYSE early-close day */
  readonly isEarlyClose: boolean;
  /** Pre-market start: 09:00 ET in UTC milliseconds */
  readonly premarketUtc: number;
  /** Zone start: 09:30 ET in UTC milliseconds */
  readonly zoneStartUtc: number;
  /** Zone end: 10:00 ET in UTC milliseconds */
  readonly zoneEndUtc: number;
  /** Execution end: 11:00 ET in UTC milliseconds */
  readonly executionEndUtc: number;
  /** Whether the date falls within the confirmed holiday calendar range */
  readonly withinCalendarRange: boolean;
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

export class Scheduler {
  private readonly clock: Clock;
  private readonly calendar: HolidayCalendar;
  private readonly log: Logger;

  constructor(clock: Clock, calendar: HolidayCalendar, logger: Logger) {
    this.clock = clock;
    this.calendar = calendar;
    this.log = logger;
  }

  /**
   * Get the full session schedule for a specific date.
   *
   * Computes all session window timestamps and checks the holiday calendar
   * for trading-day status, early-close status, and calendar-range coverage.
   *
   * @param dateStr - Date in `YYYY-MM-DD` format (Eastern Time)
   * @returns A {@link SessionSchedule} for the requested date
   */
  getSchedule(dateStr: string): SessionSchedule {
    const windows = getSessionWindows(dateStr);
    const trading = isTradingDay(dateStr, this.calendar);
    const earlyClose = isEarlyClose(dateStr, this.calendar);
    const inRange = isWithinCalendarRange(dateStr, this.calendar);

    if (!inRange) {
      this.log.warn({ date: dateStr }, 'Date is outside confirmed calendar range');
    }

    return {
      date: dateStr,
      isTradingDay: trading,
      isEarlyClose: earlyClose,
      premarketUtc: windows.premarketUtc,
      zoneStartUtc: windows.zoneStartUtc,
      zoneEndUtc: windows.zoneEndUtc,
      executionEndUtc: windows.executionEndUtc,
      withinCalendarRange: inRange,
    };
  }

  /**
   * Wait until the pre-market phase starts (09:00 ET).
   *
   * Returns immediately if the current clock time is already at or past
   * the pre-market timestamp. When using a SimulatedClock the promise
   * resolves instantly; with the system clock it blocks until the real
   * wall-clock time arrives.
   *
   * @param schedule - The session schedule to wait for
   */
  async waitForPremarket(schedule: SessionSchedule): Promise<void> {
    const now = this.clock.now();
    if (now >= schedule.premarketUtc) return;

    this.log.info(
      { waitUntil: new Date(schedule.premarketUtc).toISOString() },
      'Waiting for pre-market',
    );
    await this.clock.waitUntil(schedule.premarketUtc);
  }

  /**
   * Wait until the zone-start phase begins (09:30 ET).
   *
   * Returns immediately if the current clock time is already at or past
   * the zone-start timestamp.
   *
   * @param schedule - The session schedule to wait for
   */
  async waitForZoneStart(schedule: SessionSchedule): Promise<void> {
    const now = this.clock.now();
    if (now >= schedule.zoneStartUtc) return;

    this.log.info(
      { waitUntil: new Date(schedule.zoneStartUtc).toISOString() },
      'Waiting for zone start',
    );
    await this.clock.waitUntil(schedule.zoneStartUtc);
  }

  /**
   * Check if the current clock time is within the active session window.
   *
   * The active window runs from zone start (09:30 ET) through execution
   * end (11:00 ET), inclusive on both boundaries.
   *
   * @param schedule - The session schedule to check against
   * @returns `true` if the clock is between zoneStartUtc and executionEndUtc
   */
  isWithinSessionWindow(schedule: SessionSchedule): boolean {
    const now = this.clock.now();
    return now >= schedule.zoneStartUtc && now <= schedule.executionEndUtc;
  }

  /**
   * Check if the execution window has ended (past 11:00 ET).
   *
   * @param schedule - The session schedule to check against
   * @returns `true` if the clock is past executionEndUtc
   */
  isSessionExpired(schedule: SessionSchedule): boolean {
    return this.clock.now() > schedule.executionEndUtc;
  }

  /**
   * Get the next NYSE trading day after the given date.
   *
   * Skips weekends and holidays using the loaded holiday calendar.
   *
   * @param fromDate - Date in `YYYY-MM-DD` format
   * @returns The next trading day in `YYYY-MM-DD` format
   */
  getNextTradingDay(fromDate: string): string {
    return getNextTradingDay(fromDate, this.calendar);
  }

  /**
   * Get today's date string in Eastern Time using the scheduler's clock.
   *
   * This ensures that in backtest mode the "today" date reflects the
   * simulated clock rather than the real system time.
   *
   * @returns Date string in `YYYY-MM-DD` format (ET)
   */
  getTodayET(): string {
    const nowMs = this.clock.now();
    return utcToEtDateStr(nowMs);
  }
}
