/**
 * MorningTrader - Backtest Runner Service
 *
 * Orchestrates backtesting across a date range by replaying historical
 * bar data through the SessionRunner for each trading day.
 *
 * For each trading day in the range:
 *   1. Skips non-trading days (weekends, holidays)
 *   2. Skips already-completed sessions (unless force=true)
 *   3. Loads bars from CSV (per-day file or single-file fallback)
 *   4. Creates a fresh SimulatedClock + BacktestAdapter + SessionRunner
 *   5. Runs the session and collects the SessionContext
 *   6. Overrides isBacktest/executionMode and persists to storage
 *   7. Aggregates metrics across all sessions at the end
 *
 * All timestamps are UTC milliseconds. All prices are integer cents.
 */

import path from 'node:path';
import fs from 'node:fs';
import { addDays, parseISO, isBefore, isEqual } from 'date-fns';
import { format } from 'date-fns';
import type { Logger } from './logger.js';
import type { StorageProvider } from '../core/interfaces/storage.js';
import type { MarketDataProvider } from '../core/interfaces/market-data.js';
import type { Candle, SessionContext, StrategyConfig } from '../core/models/index.js';
import type { AggregateMetrics } from '../core/metrics/aggregator.js';
import type { HolidayCalendar } from '../utils/holidays.js';
import { isTradingDay } from '../utils/holidays.js';
import { aggregateMetrics } from '../core/metrics/aggregator.js';
import { SimulatedClock } from '../adapters/backtest/replay-engine.js';
import { BacktestAdapter } from '../adapters/backtest/backtest-adapter.js';
import { loadBarsFromCsv } from '../adapters/backtest/csv-loader.js';
import { SessionRunner } from './session-runner.js';
import { etToUtc } from '../utils/time.js';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface BacktestOptions {
  readonly symbol: string;
  readonly fromDate: string;   // YYYY-MM-DD
  readonly toDate: string;     // YYYY-MM-DD
  readonly source: 'csv' | 'ibkr';
  readonly csvDir?: string;    // directory containing CSV files per date
  readonly persist?: boolean;  // save results to storage (default: true)
  readonly force?: boolean;    // re-run even if session already completed (default: false)
}

export interface BacktestResult {
  readonly sessions: SessionContext[];
  readonly metrics: AggregateMetrics;
  readonly skippedDates: string[];         // holidays/weekends
  readonly errorDates: { date: string; error: string }[];
  readonly totalDays: number;
  readonly tradingDays: number;
}

// ---------------------------------------------------------------------------
// BacktestRunner
// ---------------------------------------------------------------------------

export class BacktestRunner {
  private readonly log: Logger;
  private readonly config: StrategyConfig;
  private readonly calendar: HolidayCalendar;
  private readonly storage: StorageProvider | null;
  private readonly historicalProvider: MarketDataProvider | null;

  constructor(
    logger: Logger,
    config: StrategyConfig,
    calendar: HolidayCalendar,
    storage?: StorageProvider,
    historicalProvider?: MarketDataProvider,
  ) {
    this.log = logger;
    this.config = config;
    this.calendar = calendar;
    this.storage = storage ?? null;
    this.historicalProvider = historicalProvider ?? null;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Run a backtest across the specified date range.
   *
   * Iterates each calendar day from `fromDate` to `toDate` (inclusive),
   * skipping non-trading days and (optionally) already-completed sessions.
   * For each trading day, creates fresh backtest infrastructure, runs the
   * session, and collects results.
   *
   * @param options - Backtest configuration
   * @returns Aggregated backtest results
   */
  async runBacktest(options: BacktestOptions): Promise<BacktestResult> {
    const {
      symbol,
      fromDate,
      toDate,
      source,
      csvDir,
      persist = true,
      force = false,
    } = options;

    this.log.info(
      { symbol, fromDate, toDate, source, persist, force },
      'Backtest starting',
    );

    // Enumerate all calendar days in range
    const allDates = this.enumerateDates(fromDate, toDate);
    const totalDays = allDates.length;

    const sessions: SessionContext[] = [];
    const skippedDates: string[] = [];
    const errorDates: { date: string; error: string }[] = [];
    let tradingDayCount = 0;

    for (let i = 0; i < allDates.length; i++) {
      const date = allDates[i];

      // 1. Skip non-trading days (weekends, holidays)
      if (!isTradingDay(date, this.calendar)) {
        skippedDates.push(date);
        continue;
      }

      tradingDayCount++;

      // 2. Skip if already completed (unless force=true)
      if (
        !force &&
        this.storage !== null &&
        this.storage.hasCompletedSession(date, symbol)
      ) {
        this.log.info(
          { date, symbol },
          'Session already completed, skipping (use force=true to re-run)',
        );
        skippedDates.push(date);
        continue;
      }

      this.log.info(
        { date, symbol, progress: `${i + 1}/${totalDays}` },
        `Processing ${date} (${i + 1}/${totalDays})`,
      );

      try {
        // 3. Load bars
        const bars = await this.loadBarsForDate(source, symbol, date, csvDir);

        if (bars.length === 0) {
          this.log.warn({ date, symbol }, 'No bars found for date, skipping');
          errorDates.push({ date, error: 'No bars found' });
          continue;
        }

        // 4. Create fresh SimulatedClock + BacktestAdapter (full isolation per day)
        const clock = new SimulatedClock(bars[0].timestamp);
        const adapter = new BacktestAdapter(clock);

        // 5. Load bars into the adapter
        await adapter.connect();
        adapter.loadBars(symbol, bars);

        // 6. Create fresh SessionRunner
        const sessionRunner = new SessionRunner(
          adapter,
          clock,
          this.log,
          this.config,
        );

        // 7. Run the session
        const session = await sessionRunner.runSession(date, symbol);

        // 8. Override to mark as backtest
        const backtestSession: SessionContext = {
          ...session,
          isBacktest: true,
          executionMode: 'MOCK',
        };

        // 9. Persist to storage
        if (persist && this.storage !== null) {
          this.persistSession(backtestSession);
        }

        // 10. Collect session result
        sessions.push(backtestSession);

        this.log.info(
          {
            date,
            symbol,
            status: backtestSession.status,
            trades: backtestSession.trades.length,
            signals: backtestSession.signals.length,
          },
          `Completed ${date}`,
        );

        // Cleanup
        await adapter.disconnect();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.log.error({ date, symbol, err }, `Error processing ${date}`);
        errorDates.push({ date, error: message });
      }
    }

    // Aggregate metrics across all sessions
    const metrics = aggregateMetrics(sessions);

    const result: BacktestResult = {
      sessions,
      metrics,
      skippedDates,
      errorDates,
      totalDays,
      tradingDays: tradingDayCount,
    };

    this.log.info(
      {
        totalDays,
        tradingDays: tradingDayCount,
        sessionsCompleted: sessions.length,
        errorsCount: errorDates.length,
        skippedCount: skippedDates.length,
        totalTrades: metrics.stats.totalTrades,
        winRate: metrics.winRate,
        totalR: metrics.totalR,
      },
      'Backtest completed',
    );

    return result;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Enumerate all calendar dates from `fromDate` to `toDate` inclusive.
   * Returns an array of 'YYYY-MM-DD' strings.
   */
  private enumerateDates(fromDate: string, toDate: string): string[] {
    const dates: string[] = [];
    let current = parseISO(fromDate);
    const end = parseISO(toDate);

    while (isBefore(current, end) || isEqual(current, end)) {
      dates.push(format(current, 'yyyy-MM-dd'));
      current = addDays(current, 1);
    }

    return dates;
  }

  /**
   * Load bars for a specific date from the configured source.
   *
   * CSV source strategy:
   *   1. Try per-day file: `{csvDir}/{SYMBOL}-{YYYY-MM-DD}.csv`
   *   2. Fallback: `{csvDir}/{SYMBOL}.csv` filtered to the day's timestamp range
   *
   * IBKR source: fetches historical bars via the injected MarketDataProvider.
   *   Uses the zone start (09:30 ET) to execution end (11:00 ET) window.
   */
  private async loadBarsForDate(
    source: 'csv' | 'ibkr',
    symbol: string,
    date: string,
    csvDir?: string,
  ): Promise<Candle[]> {
    if (source === 'csv') {
      return this.loadBarsFromCsvSource(symbol, date, csvDir);
    }

    // IBKR historical data source
    if (this.historicalProvider === null) {
      throw new Error(
        'IBKR historical data source requires a MarketDataProvider. ' +
        'Pass a historicalProvider to the BacktestRunner constructor.',
      );
    }

    const startUtc = etToUtc(date, '09:30');
    const endUtc = etToUtc(date, '11:00');

    this.log.debug(
      { symbol, date, startUtc, endUtc },
      'Fetching IBKR historical bars',
    );

    return this.historicalProvider.getHistoricalBars(symbol, startUtc, endUtc);
  }

  /**
   * Load bars from CSV files for a specific date.
   *
   * Looks for a per-day file first, then falls back to a single symbol file
   * and filters bars to the day's trading window.
   */
  private loadBarsFromCsvSource(
    symbol: string,
    date: string,
    csvDir?: string,
  ): Candle[] {
    if (!csvDir) {
      throw new Error('csvDir is required when source is "csv"');
    }

    const upperSymbol = symbol.toUpperCase();

    // Try per-day file: {csvDir}/{SYMBOL}-{YYYY-MM-DD}.csv
    const perDayFile = path.join(csvDir, `${upperSymbol}-${date}.csv`);

    if (fs.existsSync(perDayFile)) {
      this.log.debug({ file: perDayFile }, 'Loading per-day CSV file');
      const result = loadBarsFromCsv(perDayFile);

      if (result.errors.length > 0) {
        this.log.warn(
          { file: perDayFile, errorCount: result.errors.length },
          'CSV parse errors encountered',
        );
      }

      return result.bars;
    }

    // Fallback: {csvDir}/{SYMBOL}.csv (single file with all dates)
    const singleFile = path.join(csvDir, `${upperSymbol}.csv`);

    if (fs.existsSync(singleFile)) {
      this.log.debug({ file: singleFile, date }, 'Loading from single CSV file, filtering by date');
      const result = loadBarsFromCsv(singleFile);

      if (result.errors.length > 0) {
        this.log.warn(
          { file: singleFile, errorCount: result.errors.length },
          'CSV parse errors encountered',
        );
      }

      // Filter bars to the day's trading window
      // Use a generous range: midnight to midnight UTC for the date
      // (the session runner will further filter to the session window)
      const dayStartUtc = etToUtc(date, '04:00');  // pre-market start
      const dayEndUtc = etToUtc(date, '20:00');     // well after market close

      return result.bars.filter(
        (bar) => bar.timestamp >= dayStartUtc && bar.timestamp < dayEndUtc,
      );
    }

    this.log.warn(
      { symbol, date, csvDir },
      `No CSV file found (tried ${perDayFile} and ${singleFile})`,
    );
    return [];
  }

  /**
   * Persist a backtest session and its trades/outcomes/signals to storage.
   *
   * Flow:
   *   1. Save session -> get sessionId
   *   2. For each trade, save with outcome if available, otherwise trade alone
   *   3. Save signals if any
   */
  private persistSession(session: SessionContext): void {
    if (this.storage === null) return;

    try {
      const sessionId = this.storage.saveSession(session);

      for (const trade of session.trades) {
        const outcome = session.outcomes.find((o) => o.tradeId === trade.id);
        if (outcome) {
          this.storage.saveTradeWithOutcome(trade, outcome, sessionId);
        } else {
          this.storage.saveTrade(trade, sessionId);
        }
      }

      if (session.signals.length > 0) {
        this.storage.saveSignals(session.signals, sessionId);
      }

      if (session.allBars.length > 0) {
        this.storage.saveBars(session.allBars, sessionId);
      }

      this.log.debug(
        {
          date: session.date,
          sessionId,
          trades: session.trades.length,
          signals: session.signals.length,
        },
        'Session persisted to storage',
      );
    } catch (err) {
      this.log.error(
        { date: session.date, err },
        'Failed to persist session to storage',
      );
    }
  }
}
