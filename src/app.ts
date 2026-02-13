/**
 * MorningTrader - Application Bootstrap & DI Wiring
 *
 * Connects all layers together: Core -> Adapters -> Services.
 * Provides factory functions for live trading and backtesting contexts.
 *
 * All prices are integer cents. All timestamps are UTC milliseconds.
 */

import fs from 'node:fs';
import path from 'node:path';
import { IBApiNext } from '@stoqey/ib';

import type { Clock, ClockTimer } from './core/interfaces/index.js';
import type { MarketDataProvider, OrderExecutionProvider, StorageProvider } from './core/interfaces/index.js';
import type { AppConfig } from './core/models/index.js';
import { AppConfigSchema } from './core/models/index.js';
import type { HolidayCalendar } from './utils/holidays.js';
import { loadHolidayCalendar } from './utils/holidays.js';
import { createLogger } from './services/logger.js';
import type { Logger } from './services/logger.js';
import { IBKRAdapter } from './adapters/ibkr/ibkr-adapter.js';
import { ConnectionManager } from './adapters/ibkr/connection.js';
import { PacingManager } from './adapters/ibkr/pacing.js';
import { ContractResolver } from './adapters/ibkr/contract-resolver.js';
import { IBKROrderAdapter } from './adapters/ibkr/ibkr-order-adapter.js';
import { MockOrderAdapter } from './adapters/execution/mock-order-adapter.js';
import { BacktestAdapter } from './adapters/backtest/backtest-adapter.js';
import { SimulatedClock } from './adapters/backtest/replay-engine.js';
import { SQLiteAdapter } from './adapters/storage/sqlite-adapter.js';
import { SessionRunner } from './services/session-runner.js';
import { BacktestRunner } from './services/backtest-runner.js';
import { Scheduler } from './services/scheduler.js';
import { Reporter } from './services/reporter.js';
import { ShutdownManager } from './services/shutdown-manager.js';

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

export const VERSION = '0.1.0';

// ---------------------------------------------------------------------------
// SystemClock - implements Clock using real system time
// ---------------------------------------------------------------------------

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }

  setTimeout(fn: () => void, ms: number): ClockTimer {
    const id = globalThis.setTimeout(fn, ms) as unknown as number;
    return { id };
  }

  clearTimeout(timer: ClockTimer): void {
    globalThis.clearTimeout(timer.id);
  }

  async waitUntil(utcMs: number): Promise<void> {
    const delay = utcMs - Date.now();
    if (delay <= 0) return;
    return new Promise(resolve => globalThis.setTimeout(resolve, delay));
  }
}

// ---------------------------------------------------------------------------
// Deep merge utility
// ---------------------------------------------------------------------------

/**
 * Deep merge two plain objects. Arrays are replaced, not concatenated.
 * `source` values override `target` values at every level.
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>,
): T {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof T>) {
    const srcVal = source[key];
    const tgtVal = target[key];

    if (
      srcVal !== null &&
      srcVal !== undefined &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      tgtVal !== null &&
      tgtVal !== undefined &&
      typeof tgtVal === 'object' &&
      !Array.isArray(tgtVal)
    ) {
      result[key] = deepMerge(
        tgtVal as Record<string, unknown>,
        srcVal as Record<string, unknown>,
      ) as T[keyof T];
    } else if (srcVal !== undefined) {
      result[key] = srcVal as T[keyof T];
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

/**
 * Load application configuration from `config/default.json`, deep-merge
 * with optional overrides, and validate through the Zod schema.
 *
 * @param overrides - Partial config values that take precedence over defaults.
 * @returns A fully validated {@link AppConfig}.
 * @throws If the JSON file is missing, malformed, or fails validation.
 */
export function loadConfig(overrides?: Partial<AppConfig>): AppConfig {
  const configPath = path.resolve('config', 'default.json');
  const raw = fs.readFileSync(configPath, 'utf-8');
  const parsed: unknown = JSON.parse(raw);

  const base = parsed as Record<string, unknown>;
  const merged = overrides
    ? deepMerge(base, overrides as Record<string, unknown>)
    : base;

  return AppConfigSchema.parse(merged);
}

// ---------------------------------------------------------------------------
// AppContext - the DI container
// ---------------------------------------------------------------------------

export interface AppContext {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly clock: Clock;
  readonly calendar: HolidayCalendar;
  readonly storage: StorageProvider;
  readonly marketData: MarketDataProvider;
  readonly orderExecution: OrderExecutionProvider;
  readonly sessionRunner: SessionRunner;
  readonly scheduler: Scheduler;
  readonly reporter: Reporter;
  readonly shutdownManager: ShutdownManager;
  readonly ibkrAdapter?: MarketDataProvider;
}

// ---------------------------------------------------------------------------
// bootstrapLive - live / paper trading context
// ---------------------------------------------------------------------------

/**
 * Bootstrap the application for live or paper trading.
 *
 * Creates all adapters and services wired together, ready for a
 * trading session. Does NOT connect to IBKR or start the session --
 * the caller is responsible for calling `marketData.connect()` and
 * driving the session lifecycle.
 *
 * @param options.symbol   - Ticker symbol (e.g. 'SPY')
 * @param options.mock     - Use MockOrderAdapter instead of IBKROrderAdapter
 * @param options.dryRun   - When true, storage is still created but the
 *                           caller can choose not to persist.
 * @param options.configOverrides - Partial config values merged over defaults.
 */
export async function bootstrapLive(options: {
  symbol: string;
  mock?: boolean;
  dryRun?: boolean;
  configOverrides?: Partial<AppConfig>;
}): Promise<AppContext> {
  const config = loadConfig(options.configOverrides);

  const logger = createLogger({
    level: config.logging.level,
    pretty: config.logging.pretty,
  });

  const clock = new SystemClock();

  const calendar = loadHolidayCalendar(
    path.resolve('config', 'holidays.json'),
  );

  // ---- Storage ----
  const storage = new SQLiteAdapter(config.storage.dbPath);
  storage.initialize();

  // ---- IBKR market data ----
  const connectionConfig = {
    host: config.ibkr.host,
    port: config.ibkr.port,
    clientId: config.ibkr.clientId,
  };
  const connectionManager = new ConnectionManager(connectionConfig, logger);
  const pacingManager = new PacingManager();
  const contractResolver = new ContractResolver(logger);

  // IBApiNext instance for IBKRAdapter constructor parameter.
  // IBKRAdapter delegates all API calls through connectionManager.getApi(),
  // but its constructor signature requires an IBApiNext reference.
  const api = new IBApiNext({
    host: config.ibkr.host,
    port: config.ibkr.port,
    reconnectInterval: 0,
  });

  const marketData = new IBKRAdapter(
    api,
    connectionManager,
    pacingManager,
    contractResolver,
    logger,
  );

  // ---- Order execution ----
  const orderExecution = options.mock
    ? new MockOrderAdapter(logger)
    : new IBKROrderAdapter(connectionManager, logger);

  // ---- Services ----
  const sessionRunner = new SessionRunner(
    marketData,
    clock,
    logger,
    config.strategy,
  );
  const scheduler = new Scheduler(clock, calendar, logger);
  const reporter = new Reporter();
  const shutdownManager = new ShutdownManager(logger);

  logger.info(
    { symbol: options.symbol, mock: options.mock ?? false, version: VERSION },
    'MorningTrader live context bootstrapped',
  );

  return {
    config,
    logger,
    clock,
    calendar,
    storage,
    marketData,
    orderExecution,
    sessionRunner,
    scheduler,
    reporter,
    shutdownManager,
  };
}

// ---------------------------------------------------------------------------
// bootstrapBacktest - backtesting context
// ---------------------------------------------------------------------------

/**
 * Bootstrap the application for backtesting.
 *
 * Uses a SimulatedClock placeholder (BacktestRunner manages its own
 * per-day clocks internally), BacktestAdapter for market data, and
 * MockOrderAdapter for order execution.
 *
 * @param options.configOverrides - Partial config values merged over defaults.
 * @param options.persist         - Whether to save results to storage (default: true).
 * @param options.source          - Data source: 'csv' (default) or 'ibkr' for TWS/Gateway historical data.
 */
export async function bootstrapBacktest(options?: {
  configOverrides?: Partial<AppConfig>;
  persist?: boolean;
  source?: 'csv' | 'ibkr';
}): Promise<AppContext> {
  const config = loadConfig(options?.configOverrides);

  const logger = createLogger({
    level: config.logging.level,
    pretty: config.logging.pretty,
  });

  // Placeholder SimulatedClock -- BacktestRunner creates per-day clocks
  const clock = new SimulatedClock(0);

  const calendar = loadHolidayCalendar(
    path.resolve('config', 'holidays.json'),
  );

  // ---- Storage ----
  const storage = new SQLiteAdapter(config.storage.dbPath);
  storage.initialize();

  // ---- Market data (backtest placeholder for per-day bar replay) ----
  const marketData = new BacktestAdapter(clock);

  // ---- IBKR adapter (optional, for historical bar fetching) ----
  let ibkrAdapter: IBKRAdapter | undefined;

  if (options?.source === 'ibkr') {
    const connectionConfig = {
      host: config.ibkr.host,
      port: config.ibkr.port,
      clientId: config.ibkr.clientId,
    };
    const connectionManager = new ConnectionManager(connectionConfig, logger);
    const pacingManager = new PacingManager();
    const contractResolver = new ContractResolver(logger);

    const api = new IBApiNext({
      host: config.ibkr.host,
      port: config.ibkr.port,
      reconnectInterval: 0,
    });

    ibkrAdapter = new IBKRAdapter(
      api,
      connectionManager,
      pacingManager,
      contractResolver,
      logger,
    );

    await ibkrAdapter.connect();
  }

  // ---- Order execution (mock) ----
  const orderExecution = new MockOrderAdapter(logger);

  // ---- Services ----
  const sessionRunner = new SessionRunner(
    marketData,
    clock,
    logger,
    config.strategy,
  );
  const scheduler = new Scheduler(clock, calendar, logger);
  const reporter = new Reporter();
  const shutdownManager = new ShutdownManager(logger);

  logger.info(
    { persist: options?.persist ?? true, source: options?.source ?? 'csv', version: VERSION },
    'MorningTrader backtest context bootstrapped',
  );

  return {
    config,
    logger,
    clock,
    calendar,
    storage,
    marketData,
    orderExecution,
    sessionRunner,
    scheduler,
    reporter,
    shutdownManager,
    ibkrAdapter,
  };
}

// ---------------------------------------------------------------------------
// shutdown - clean teardown
// ---------------------------------------------------------------------------

/**
 * Perform a clean shutdown of all application resources.
 *
 * Disconnects market data, closes storage, and logs completion.
 * Safe to call multiple times (individual adapters handle idempotency).
 *
 * @param ctx - The application context to tear down.
 */
export async function shutdown(ctx: AppContext): Promise<void> {
  ctx.logger.info('Application shutdown starting');

  // Disconnect market data provider
  try {
    await ctx.marketData.disconnect();
  } catch (err) {
    ctx.logger.error({ err }, 'Error disconnecting market data');
  }

  // Disconnect IBKR adapter (backtest with --source ibkr)
  if (ctx.ibkrAdapter) {
    try {
      await ctx.ibkrAdapter.disconnect();
    } catch (err) {
      ctx.logger.error({ err }, 'Error disconnecting IBKR adapter');
    }
  }

  // Close storage
  try {
    ctx.storage.close();
  } catch (err) {
    ctx.logger.error({ err }, 'Error closing storage');
  }

  ctx.logger.info('Application shutdown complete');
}
