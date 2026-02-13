/**
 * Integration Tests: IBKR Historical Backtest Source
 *
 * Tests the BacktestRunner when configured to fetch historical bars from
 * IBKR API instead of CSV files. Covers:
 *   - BacktestRunner delegation to IBKRAdapter.getHistoricalBars()
 *   - Bar format conversion and validation
 *   - Date range filtering
 *   - Error handling (invalid symbols, connection errors, empty data)
 *   - CLI integration with --source ibkr flag
 *
 * All prices are integer cents. All timestamps are UTC milliseconds.
 *
 * IMPORTANT: These tests require a running IBKR TWS/Gateway instance.
 * They are skipped by default unless IBKR_TEST_ENABLED=1 environment variable is set.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { IBApiNext } from '@stoqey/ib';
import { Subject } from 'rxjs';
import { createLogger } from '../../src/services/logger.js';
import { BacktestRunner } from '../../src/services/backtest-runner.js';
import { IBKRAdapter } from '../../src/adapters/ibkr/ibkr-adapter.js';
import { ConnectionManager } from '../../src/adapters/ibkr/connection.js';
import { PacingManager } from '../../src/adapters/ibkr/pacing.js';
import { ContractResolver } from '../../src/adapters/ibkr/contract-resolver.js';
import { SQLiteAdapter } from '../../src/adapters/storage/sqlite-adapter.js';
import { loadHolidayCalendar } from '../../src/utils/holidays.js';
import type { StrategyConfig } from '../../src/core/models/config.js';
import type { Candle } from '../../src/core/models/index.js';
import type { MarketDataProvider } from '../../src/core/interfaces/market-data.js';
import { etToUtc } from '../../src/utils/time.js';
import path from 'node:path';
import fs from 'node:fs';

// ---------------------------------------------------------------------------
// Test Configuration
// ---------------------------------------------------------------------------

const IBKR_TESTS_ENABLED = process.env.IBKR_TEST_ENABLED === '1';

// Skip all tests in this file unless explicitly enabled
const describeIf = IBKR_TESTS_ENABLED ? describe : describe.skip;

// IBKR connection config (should match config/default.json or be overridden)
const IBKR_HOST = process.env.IBKR_HOST || '127.0.0.1';
const IBKR_PORT = Number(process.env.IBKR_PORT) || 4002; // Paper trading port
const IBKR_CLIENT_ID = Number(process.env.IBKR_CLIENT_ID) || 1;

// Test symbols and dates (June 2024 - known trading days)
const TEST_SYMBOL = 'SPY';
const TEST_DATE_SINGLE = '2024-06-17'; // Monday, June 17, 2024
const TEST_DATE_FROM = '2024-06-17';
const TEST_DATE_TO = '2024-06-19'; // Wednesday (3 trading days)

// Default strategy config
const defaultConfig: StrategyConfig = {
  maxBreakAttempts: 5,
  minZoneSpreadCents: 10,
  maxZoneSpreadPercent: 3.0,
  barSizeMinutes: 5,
  sessionWindows: {
    premarketTime: '09:00',
    zoneStartTime: '09:30',
    zoneEndTime: '10:00',
    executionEndTime: '11:00',
  },
  minZoneBars: 3,
  targets: {
    target1RMultiple: 1.0,
    target2RMultiple: 2.0,
    target3RMultiple: 3.0,
  },
  trailingStopAt1R: true,
};

// ---------------------------------------------------------------------------
// Shared Test Infrastructure
// ---------------------------------------------------------------------------

let logger: ReturnType<typeof createLogger>;
let ibkrAdapter: IBKRAdapter;
let storage: SQLiteAdapter;
let calendar: ReturnType<typeof loadHolidayCalendar>;

beforeAll(async () => {
  if (!IBKR_TESTS_ENABLED) {
    console.log('⊘ IBKR integration tests skipped (set IBKR_TEST_ENABLED=1 to enable)');
    return;
  }

  logger = createLogger({ level: 'error' }); // Reduce noise in test output

  // Load holiday calendar
  calendar = loadHolidayCalendar(path.resolve('config', 'holidays.json'));

  // Set up temporary test database
  const testDbPath = path.resolve('data', 'test-ibkr-backtest.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  storage = new SQLiteAdapter(testDbPath);
  storage.initialize();

  // Set up IBKR connection
  const connectionConfig = {
    host: IBKR_HOST,
    port: IBKR_PORT,
    clientId: IBKR_CLIENT_ID,
  };
  const connectionManager = new ConnectionManager(connectionConfig, logger);
  const pacingManager = new PacingManager();
  const contractResolver = new ContractResolver(logger);

  const api = new IBApiNext({
    host: IBKR_HOST,
    port: IBKR_PORT,
    reconnectInterval: 0,
  });

  ibkrAdapter = new IBKRAdapter(
    api,
    connectionManager,
    pacingManager,
    contractResolver,
    logger,
  );

  // Connect to IBKR
  try {
    await ibkrAdapter.connect();
    logger.info('IBKR connection established for integration tests');
  } catch (err) {
    console.error('Failed to connect to IBKR TWS/Gateway:');
    console.error(err instanceof Error ? err.message : String(err));
    console.error('Make sure TWS or IB Gateway is running on port', IBKR_PORT);
    throw err;
  }
}, 30000); // 30s timeout for connection

afterAll(async () => {
  if (!IBKR_TESTS_ENABLED) return;

  // Disconnect IBKR
  if (ibkrAdapter && ibkrAdapter.isConnected) {
    await ibkrAdapter.disconnect();
  }

  // Clean up test database
  const testDbPath = path.resolve('data', 'test-ibkr-backtest.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
}, 10000);

// ---------------------------------------------------------------------------
// Test Suite 1: BacktestRunner with IBKR Historical Data Source
// ---------------------------------------------------------------------------

describeIf('BacktestRunner with IBKR Historical Data Source', () => {

  it('fetches historical bars for a single trading day', async () => {
    const runner = new BacktestRunner(
      logger,
      defaultConfig,
      calendar,
      storage,
      ibkrAdapter, // Pass IBKR adapter as historical provider
    );

    const result = await runner.runBacktest({
      symbol: TEST_SYMBOL,
      fromDate: TEST_DATE_SINGLE,
      toDate: TEST_DATE_SINGLE,
      source: 'ibkr',
      persist: false, // Don't persist for this test
      force: true,
    });

    // Should complete successfully
    expect(result.sessions).toHaveLength(1);
    expect(result.errorDates).toHaveLength(0);
    expect(result.tradingDays).toBe(1);

    const session = result.sessions[0];
    expect(session.date).toBe(TEST_DATE_SINGLE);
    expect(session.symbol).toBe(TEST_SYMBOL);
    expect(session.isBacktest).toBe(true);
    expect(session.executionMode).toBe('MOCK');

    // Verify bars were fetched
    expect(session.allBars.length).toBeGreaterThan(0);

    // Verify bar structure and timestamps
    const firstBar = session.allBars[0];
    expect(firstBar.timestamp).toBeGreaterThan(0);
    expect(firstBar.open).toBeGreaterThan(0);
    expect(firstBar.high).toBeGreaterThan(0);
    expect(firstBar.low).toBeGreaterThan(0);
    expect(firstBar.close).toBeGreaterThan(0);
    expect(firstBar.completed).toBe(true);

    // All bars should be within the session window (09:30-11:00 ET)
    const sessionStart = etToUtc(TEST_DATE_SINGLE, '09:30');
    const sessionEnd = etToUtc(TEST_DATE_SINGLE, '11:00');
    for (const bar of session.allBars) {
      expect(bar.timestamp).toBeGreaterThanOrEqual(sessionStart);
      expect(bar.timestamp).toBeLessThan(sessionEnd);
    }

    // Prices should be in integer cents (not floating-point dollars)
    for (const bar of session.allBars) {
      expect(Number.isInteger(bar.open)).toBe(true);
      expect(Number.isInteger(bar.high)).toBe(true);
      expect(Number.isInteger(bar.low)).toBe(true);
      expect(Number.isInteger(bar.close)).toBe(true);
    }
  }, 60000); // 60s timeout for IBKR API call + backtest

  it('fetches historical bars for multiple trading days', async () => {
    const runner = new BacktestRunner(
      logger,
      defaultConfig,
      calendar,
      storage,
      ibkrAdapter,
    );

    const result = await runner.runBacktest({
      symbol: TEST_SYMBOL,
      fromDate: TEST_DATE_FROM,
      toDate: TEST_DATE_TO,
      source: 'ibkr',
      persist: false,
      force: true,
    });

    // Should complete 3 trading days (Mon, Tue, Wed)
    expect(result.sessions.length).toBeGreaterThanOrEqual(2);
    expect(result.errorDates).toHaveLength(0);
    expect(result.tradingDays).toBeGreaterThanOrEqual(2);

    // Each session should have valid bars
    for (const session of result.sessions) {
      expect(session.symbol).toBe(TEST_SYMBOL);
      expect(session.isBacktest).toBe(true);
      expect(session.executionMode).toBe('MOCK');
      expect(session.allBars.length).toBeGreaterThan(0);
    }

    // Aggregate metrics should be computed
    expect(result.metrics.stats.totalTrades).toBeGreaterThanOrEqual(0);
  }, 120000); // 2 minute timeout for multi-day backtest

  it('persists sessions and bars to storage when persist=true', async () => {
    const runner = new BacktestRunner(
      logger,
      defaultConfig,
      calendar,
      storage,
      ibkrAdapter,
    );

    const result = await runner.runBacktest({
      symbol: TEST_SYMBOL,
      fromDate: TEST_DATE_SINGLE,
      toDate: TEST_DATE_SINGLE,
      source: 'ibkr',
      persist: true,
      force: true,
    });

    expect(result.sessions).toHaveLength(1);

    // Verify session was persisted
    const sessions = storage.getSessionsByDateRange(TEST_DATE_SINGLE, TEST_DATE_SINGLE, TEST_SYMBOL);
    expect(sessions.length).toBeGreaterThan(0);

    const persistedSession = sessions.find(s => s.date === TEST_DATE_SINGLE);
    expect(persistedSession).toBeDefined();
    expect(persistedSession!.symbol).toBe(TEST_SYMBOL);

    // Verify bars were persisted (if session has bars)
    if (result.sessions[0].allBars.length > 0) {
      const bars = storage.getBarsBySessionId(persistedSession!.id);
      expect(bars.length).toBeGreaterThan(0);
    }
  }, 60000);

  it('handles empty data gracefully (no bars for date)', async () => {
    const runner = new BacktestRunner(
      logger,
      defaultConfig,
      calendar,
      storage,
      ibkrAdapter,
    );

    // Request a far future date (should return no data)
    const futureDate = '2030-01-02';

    const result = await runner.runBacktest({
      symbol: TEST_SYMBOL,
      fromDate: futureDate,
      toDate: futureDate,
      source: 'ibkr',
      persist: false,
      force: true,
    });

    // Should skip the day or record error
    expect(result.sessions).toHaveLength(0);
    // Either skipped or error recorded
    expect(result.skippedDates.length + result.errorDates.length).toBeGreaterThan(0);
  }, 60000);

  it('handles invalid symbols gracefully', async () => {
    const runner = new BacktestRunner(
      logger,
      defaultConfig,
      calendar,
      storage,
      ibkrAdapter,
    );

    const invalidSymbol = 'INVALIDXYZ123';

    const result = await runner.runBacktest({
      symbol: invalidSymbol,
      fromDate: TEST_DATE_SINGLE,
      toDate: TEST_DATE_SINGLE,
      source: 'ibkr',
      persist: false,
      force: true,
    });

    // Should record an error for the invalid symbol
    expect(result.sessions).toHaveLength(0);
    expect(result.errorDates.length).toBeGreaterThan(0);
    expect(result.errorDates[0].error).toMatch(/contract|symbol|security/i);
  }, 60000);
});

// ---------------------------------------------------------------------------
// Test Suite 2: IBKRAdapter.getHistoricalBars() Direct Tests
// ---------------------------------------------------------------------------

describeIf('IBKRAdapter.getHistoricalBars()', () => {

  it('returns valid Candle objects for a known date range', async () => {
    const startUtc = etToUtc(TEST_DATE_SINGLE, '09:30');
    const endUtc = etToUtc(TEST_DATE_SINGLE, '11:00');

    const bars = await ibkrAdapter.getHistoricalBars(TEST_SYMBOL, startUtc, endUtc);

    // Should return 5-minute bars covering the 90-minute window (18 bars)
    expect(bars.length).toBeGreaterThan(0);
    expect(bars.length).toBeLessThanOrEqual(20); // Allow some variance

    // Verify bar structure
    for (const bar of bars) {
      expect(bar.timestamp).toBeGreaterThanOrEqual(startUtc);
      expect(bar.timestamp).toBeLessThan(endUtc);
      expect(bar.open).toBeGreaterThan(0);
      expect(bar.high).toBeGreaterThan(0);
      expect(bar.low).toBeGreaterThan(0);
      expect(bar.close).toBeGreaterThan(0);
      expect(bar.volume).toBeGreaterThanOrEqual(0);
      expect(bar.completed).toBe(true);

      // OHLC consistency
      expect(bar.high).toBeGreaterThanOrEqual(bar.low);
      expect(bar.high).toBeGreaterThanOrEqual(bar.open);
      expect(bar.high).toBeGreaterThanOrEqual(bar.close);
      expect(bar.low).toBeLessThanOrEqual(bar.open);
      expect(bar.low).toBeLessThanOrEqual(bar.close);

      // Prices in integer cents (SPY trades around $500, so 50000 cents)
      expect(bar.close).toBeGreaterThan(10000); // Reasonable lower bound
      expect(bar.close).toBeLessThan(100000);  // Reasonable upper bound
    }

    // Bars should be in chronological order
    for (let i = 1; i < bars.length; i++) {
      expect(bars[i].timestamp).toBeGreaterThanOrEqual(bars[i - 1].timestamp);
    }
  }, 30000);

  it('returns empty array for invalid symbol', async () => {
    const startUtc = etToUtc(TEST_DATE_SINGLE, '09:30');
    const endUtc = etToUtc(TEST_DATE_SINGLE, '11:00');

    const bars = await ibkrAdapter.getHistoricalBars('INVALIDXYZ123', startUtc, endUtc);

    // Should return empty array instead of throwing (recoverable error)
    expect(bars).toHaveLength(0);
  }, 30000);

  it('returns empty array for future dates with no data', async () => {
    const startUtc = etToUtc('2030-01-02', '09:30');
    const endUtc = etToUtc('2030-01-02', '11:00');

    const bars = await ibkrAdapter.getHistoricalBars(TEST_SYMBOL, startUtc, endUtc);

    // Future dates should return no data
    expect(bars).toHaveLength(0);
  }, 30000);

  it('handles pacing violations gracefully', async () => {
    // Make multiple rapid requests to test pacing manager
    const promises: Promise<Candle[]>[] = [];
    const startUtc = etToUtc(TEST_DATE_SINGLE, '09:30');
    const endUtc = etToUtc(TEST_DATE_SINGLE, '11:00');

    // Fire 10 rapid requests (should be paced internally)
    for (let i = 0; i < 10; i++) {
      promises.push(ibkrAdapter.getHistoricalBars(TEST_SYMBOL, startUtc, endUtc));
    }

    // All should complete without errors (pacing manager handles delays)
    const results = await Promise.all(promises);
    expect(results).toHaveLength(10);

    // Each result should be valid
    for (const bars of results) {
      expect(Array.isArray(bars)).toBe(true);
    }
  }, 120000); // 2 minute timeout for paced requests
});

// ---------------------------------------------------------------------------
// Test Suite 3: Mock Provider Tests (Unit-level, always run)
// ---------------------------------------------------------------------------

describe('BacktestRunner with Mock MarketDataProvider', () => {

  it('calls getHistoricalBars with correct time range when source=ibkr', async () => {
    let capturedSymbol: string | undefined;
    let capturedStartUtc: number | undefined;
    let capturedEndUtc: number | undefined;

    // Load calendar for the test
    const testCalendar = loadHolidayCalendar(path.resolve('config', 'holidays.json'));

    // Create a mock MarketDataProvider that captures arguments
    const mockProvider: MarketDataProvider = {
      connect: async () => {},
      disconnect: async () => {},
      isConnected: true,
      connectionState$: new Subject(),
      errors$: new Subject(),
      resolveContract: async (symbol: string) => ({
        conId: 12345,
        symbol,
        secType: 'STK',
        exchange: 'SMART',
        currency: 'USD',
      }),
      getHistoricalBars: async (symbol: string, startUtc: number, endUtc: number) => {
        capturedSymbol = symbol;
        capturedStartUtc = startUtc;
        capturedEndUtc = endUtc;
        return []; // Return empty for this test
      },
      subscribeBars: () => new Subject(),
      unsubscribeBars: () => {},
    };

    const runner = new BacktestRunner(
      createLogger({ level: 'error' }),
      defaultConfig,
      testCalendar,
      undefined, // No storage
      mockProvider,
    );

    await runner.runBacktest({
      symbol: 'AAPL',
      fromDate: TEST_DATE_SINGLE,
      toDate: TEST_DATE_SINGLE,
      source: 'ibkr',
      persist: false,
      force: true,
    });

    // Verify getHistoricalBars was called with correct arguments
    expect(capturedSymbol).toBe('AAPL');
    expect(capturedStartUtc).toBe(etToUtc(TEST_DATE_SINGLE, '09:30'));
    expect(capturedEndUtc).toBe(etToUtc(TEST_DATE_SINGLE, '12:00'));
  });

  it('uses CSV path when source=csv (no IBKR provider calls)', async () => {
    let getHistoricalBarsCalled = false;

    const testCalendar = loadHolidayCalendar(path.resolve('config', 'holidays.json'));

    const mockProvider: MarketDataProvider = {
      connect: async () => {},
      disconnect: async () => {},
      isConnected: true,
      connectionState$: new Subject(),
      errors$: new Subject(),
      resolveContract: async (symbol: string) => ({
        conId: 12345,
        symbol,
        secType: 'STK',
        exchange: 'SMART',
        currency: 'USD',
      }),
      getHistoricalBars: async () => {
        getHistoricalBarsCalled = true;
        return [];
      },
      subscribeBars: () => new Subject(),
      unsubscribeBars: () => {},
    };

    const runner = new BacktestRunner(
      createLogger({ level: 'error' }),
      defaultConfig,
      testCalendar,
      undefined,
      mockProvider,
    );

    const csvDir = path.resolve('tests', 'fixtures', 'bars');

    await runner.runBacktest({
      symbol: 'SPY',
      fromDate: TEST_DATE_SINGLE,
      toDate: TEST_DATE_SINGLE,
      source: 'csv',
      csvDir,
      persist: false,
      force: true,
    });

    // getHistoricalBars should NOT be called when source=csv
    expect(getHistoricalBarsCalled).toBe(false);
  });

  it('handles provider returning empty array (no data)', async () => {
    const testCalendar = loadHolidayCalendar(path.resolve('config', 'holidays.json'));

    const mockProvider: MarketDataProvider = {
      connect: async () => {},
      disconnect: async () => {},
      isConnected: true,
      connectionState$: new Subject(),
      errors$: new Subject(),
      resolveContract: async (symbol: string) => ({
        conId: 12345,
        symbol,
        secType: 'STK',
        exchange: 'SMART',
        currency: 'USD',
      }),
      getHistoricalBars: async () => [], // No data
      subscribeBars: () => new Subject(),
      unsubscribeBars: () => {},
    };

    const runner = new BacktestRunner(
      createLogger({ level: 'error' }),
      defaultConfig,
      testCalendar,
      undefined,
      mockProvider,
    );

    const result = await runner.runBacktest({
      symbol: 'SPY',
      fromDate: TEST_DATE_SINGLE,
      toDate: TEST_DATE_SINGLE,
      source: 'ibkr',
      persist: false,
      force: true,
    });

    // Should record as error (no bars found)
    expect(result.sessions).toHaveLength(0);
    expect(result.errorDates).toHaveLength(1);
    expect(result.errorDates[0].error).toMatch(/No bars found/i);
  });

  it('handles provider throwing an error', async () => {
    const testCalendar = loadHolidayCalendar(path.resolve('config', 'holidays.json'));

    const mockProvider: MarketDataProvider = {
      connect: async () => {},
      disconnect: async () => {},
      isConnected: true,
      connectionState$: new Subject(),
      errors$: new Subject(),
      resolveContract: async (symbol: string) => ({
        conId: 12345,
        symbol,
        secType: 'STK',
        exchange: 'SMART',
        currency: 'USD',
      }),
      getHistoricalBars: async () => {
        throw new Error('Connection lost');
      },
      subscribeBars: () => new Subject(),
      unsubscribeBars: () => {},
    };

    const runner = new BacktestRunner(
      createLogger({ level: 'error' }),
      defaultConfig,
      testCalendar,
      undefined,
      mockProvider,
    );

    const result = await runner.runBacktest({
      symbol: 'SPY',
      fromDate: TEST_DATE_SINGLE,
      toDate: TEST_DATE_SINGLE,
      source: 'ibkr',
      persist: false,
      force: true,
    });

    // Should record error
    expect(result.sessions).toHaveLength(0);
    expect(result.errorDates).toHaveLength(1);
    expect(result.errorDates[0].error).toMatch(/Connection lost/i);
  });

  it('records error when source=ibkr but no historicalProvider passed', async () => {
    const testCalendar = loadHolidayCalendar(path.resolve('config', 'holidays.json'));

    const runner = new BacktestRunner(
      createLogger({ level: 'error' }),
      defaultConfig,
      testCalendar,
      undefined, // No storage
      undefined, // No historical provider
    );

    const result = await runner.runBacktest({
      symbol: 'AAPL',
      fromDate: TEST_DATE_SINGLE,
      toDate: TEST_DATE_SINGLE,
      source: 'ibkr',
      persist: false,
      force: true,
    });

    // Should record error instead of throwing
    expect(result.sessions).toHaveLength(0);
    expect(result.errorDates).toHaveLength(1);
    expect(result.errorDates[0].date).toBe(TEST_DATE_SINGLE);
    expect(result.errorDates[0].error).toMatch(/IBKR historical data source requires a MarketDataProvider/i);
  });
});

// ---------------------------------------------------------------------------
// Test Suite 4: CLI Integration (requires IBKR connection)
// ---------------------------------------------------------------------------

describeIf('CLI Integration: morningtrader backtest --source ibkr', () => {

  it('uses IBKR source when --source ibkr flag is passed', async () => {
    const { bootstrapBacktest, shutdown } = await import('../../src/app.js');

    const ctx = await bootstrapBacktest({
      persist: false,
      source: 'ibkr',
    });

    expect(ctx.ibkrAdapter).toBeDefined();
    expect(ctx.ibkrAdapter!.isConnected).toBe(true);

    // Run a minimal backtest
    const runner = new BacktestRunner(
      ctx.logger,
      ctx.config.strategy,
      ctx.calendar,
      undefined, // No storage
      ctx.ibkrAdapter,
    );

    const result = await runner.runBacktest({
      symbol: TEST_SYMBOL,
      fromDate: TEST_DATE_SINGLE,
      toDate: TEST_DATE_SINGLE,
      source: 'ibkr',
      persist: false,
      force: true,
    });

    expect(result.sessions.length).toBeGreaterThan(0);

    // Clean up
    await shutdown(ctx);
  }, 60000);

  it('does not connect to IBKR when --source csv flag is used', async () => {
    const { bootstrapBacktest, shutdown } = await import('../../src/app.js');

    const ctx = await bootstrapBacktest({
      persist: false,
      source: 'csv',
    });

    // ibkrAdapter should be undefined for CSV source
    expect(ctx.ibkrAdapter).toBeUndefined();

    // Clean up
    await shutdown(ctx);
  }, 10000);
});

// ---------------------------------------------------------------------------
// Summary Report
// ---------------------------------------------------------------------------

if (!IBKR_TESTS_ENABLED) {
  console.log('\n========================================');
  console.log('ℹ️  IBKR Integration Tests Skipped');
  console.log('========================================');
  console.log('To enable these tests:');
  console.log('  1. Start IBKR TWS or IB Gateway (paper trading recommended)');
  console.log('  2. Set environment variable: IBKR_TEST_ENABLED=1');
  console.log('  3. Optional: configure IBKR_HOST, IBKR_PORT, IBKR_CLIENT_ID');
  console.log('  4. Run: npm run test:integration\n');
}
