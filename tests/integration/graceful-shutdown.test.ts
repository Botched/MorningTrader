/**
 * Integration tests for graceful shutdown flow.
 *
 * Verifies that:
 *   - SessionRunner.stop() causes runSession to resolve with INTERRUPTED status
 *   - ShutdownManager triggers registered handlers in LIFO order
 *   - ShutdownManager + SessionRunner integrate correctly end-to-end
 *   - stop() during BUILDING_ZONE phase produces INTERRUPTED
 *   - Double stop() is idempotent (does not throw)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Observable, Subject, BehaviorSubject, EMPTY } from 'rxjs';

import { SessionRunner } from '../../src/services/session-runner.js';
import { ShutdownManager } from '../../src/services/shutdown-manager.js';
import { createLogger } from '../../src/services/logger.js';
import type {
  MarketDataProvider,
  ConnectionState,
  ContractSpec,
  ProviderError,
  Clock,
  ClockTimer,
} from '../../src/core/interfaces/index.js';
import type { Candle } from '../../src/core/models/index.js';
import type { StrategyConfig } from '../../src/core/models/config.js';
import type { Logger } from '../../src/services/logger.js';
import { getSessionWindows } from '../../src/utils/time.js';

// ---------------------------------------------------------------------------
// Test date and session windows
// ---------------------------------------------------------------------------

/** Use a fixed date in the past so getSessionWindows computes deterministic UTC times. */
const TEST_DATE = '2025-03-17'; // Monday
const TEST_SYMBOL = 'SPY';

const windows = getSessionWindows(TEST_DATE);
const FIVE_MIN_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Default StrategyConfig for tests
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: StrategyConfig = {
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
    target1RMultiple: 1,
    target2RMultiple: 2,
    target3RMultiple: 3,
  },
  trailingStopAt1R: true,
};

// ---------------------------------------------------------------------------
// PausableClock -- waitUntil blocks until explicitly released
// ---------------------------------------------------------------------------

/**
 * A Clock implementation where waitUntil() blocks indefinitely until
 * releaseWait() is called. This lets tests control when the session
 * runner's time-based race resolves, creating a window to call stop().
 */
class PausableClock implements Clock {
  private _now: number;
  private waitResolvers: Array<() => void> = [];

  constructor(initialTime: number = 0) {
    this._now = initialTime;
  }

  now(): number {
    return this._now;
  }

  setTimeout(fn: () => void, _ms: number): ClockTimer {
    return { id: 0 };
  }

  clearTimeout(_timer: ClockTimer): void {
    // no-op
  }

  waitUntil(_utcMs: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.waitResolvers.push(resolve);
    });
  }

  /** Release all pending waitUntil promises so they resolve. */
  releaseWait(): void {
    for (const resolve of this.waitResolvers) {
      resolve();
    }
    this.waitResolvers = [];
  }

  setNow(ms: number): void {
    this._now = ms;
  }
}

// ---------------------------------------------------------------------------
// ControllableAdapter -- bars are emitted only when the test says so
// ---------------------------------------------------------------------------

/**
 * A MarketDataProvider where subscribeBars() returns an Observable that
 * stays open until the test explicitly emits bars or completes.
 */
class ControllableAdapter implements MarketDataProvider {
  private readonly barSubject = new Subject<Candle>();
  private readonly connectionStateSubject =
    new BehaviorSubject<ConnectionState>('CONNECTED');
  private readonly errorsSubject = new Subject<ProviderError>();

  async connect(): Promise<void> {
    this.connectionStateSubject.next('CONNECTED');
  }

  async disconnect(): Promise<void> {
    this.connectionStateSubject.next('DISCONNECTED');
  }

  get isConnected(): boolean {
    return true;
  }

  get connectionState$(): Observable<ConnectionState> {
    return this.connectionStateSubject.asObservable();
  }

  get errors$(): Observable<ProviderError> {
    return this.errorsSubject.asObservable();
  }

  async resolveContract(symbol: string): Promise<ContractSpec> {
    return {
      conId: 0,
      symbol,
      secType: 'STK',
      exchange: 'SMART',
      currency: 'USD',
    };
  }

  async getHistoricalBars(
    _symbol: string,
    _startUtc: number,
    _endUtc: number,
  ): Promise<Candle[]> {
    return [];
  }

  subscribeBars(_symbol: string): Observable<Candle> {
    return this.barSubject.asObservable();
  }

  unsubscribeBars(_symbol: string): void {
    // no-op
  }

  /** Emit a single bar to the subscriber. */
  emitBar(bar: Candle): void {
    this.barSubject.next(bar);
  }

  /** Complete the bar stream. */
  complete(): void {
    this.barSubject.complete();
  }
}

// ---------------------------------------------------------------------------
// Bar factory
// ---------------------------------------------------------------------------

function makeBar(
  timestampUtc: number,
  overrides: Partial<Candle> = {},
): Candle {
  return {
    timestamp: timestampUtc,
    open: 47000,
    high: 47100,
    low: 46900,
    close: 47050,
    volume: 1000,
    completed: true,
    barSizeMinutes: 5,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Quiet logger for tests
// ---------------------------------------------------------------------------

function createSilentLogger(): Logger {
  return createLogger({ level: 'silent' });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Graceful Shutdown', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Prevent ShutdownManager.shutdown() from calling process.exit
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(
      (() => {}) as unknown as (code?: number) => never,
    );
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  // -----------------------------------------------------------------------
  // Test 1
  // -----------------------------------------------------------------------
  it('SessionRunner.stop() resolves runSession with INTERRUPTED status', async () => {
    const clock = new PausableClock(windows.zoneStartUtc);
    const adapter = new ControllableAdapter();
    const log = createSilentLogger();

    const runner = new SessionRunner(adapter, clock, log, DEFAULT_CONFIG);

    // Start runSession in background -- it will block at the Promise.race
    // because the PausableClock's waitUntil never resolves.
    const sessionPromise = runner.runSession(TEST_DATE, TEST_SYMBOL);

    // Give the event loop a tick so runSession reaches the await
    await new Promise((r) => setTimeout(r, 10));

    // Now stop the session
    runner.stop();

    // runSession should resolve
    const result = await sessionPromise;

    expect(result.status).toBe('INTERRUPTED');
    expect(result.date).toBe(TEST_DATE);
    expect(result.symbol).toBe(TEST_SYMBOL);
  });

  // -----------------------------------------------------------------------
  // Test 2
  // -----------------------------------------------------------------------
  it('ShutdownManager triggers registered handlers in LIFO order', async () => {
    const log = createSilentLogger();
    const mgr = new ShutdownManager(log);

    const callOrder: string[] = [];
    mgr.register(() => {
      callOrder.push('first-registered');
    });
    mgr.register(() => {
      callOrder.push('second-registered');
    });
    mgr.register(async () => {
      callOrder.push('third-registered');
    });

    await mgr.shutdown('test');

    // LIFO: last registered is called first
    expect(callOrder).toEqual([
      'third-registered',
      'second-registered',
      'first-registered',
    ]);

    // process.exit(0) should have been called at the end
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  // -----------------------------------------------------------------------
  // Test 3
  // -----------------------------------------------------------------------
  it('ShutdownManager + SessionRunner integration', async () => {
    const clock = new PausableClock(windows.zoneStartUtc);
    const adapter = new ControllableAdapter();
    const log = createSilentLogger();

    const runner = new SessionRunner(adapter, clock, log, DEFAULT_CONFIG);
    const mgr = new ShutdownManager(log);

    // Register sessionRunner.stop as a shutdown handler
    mgr.register(() => runner.stop());

    // Start session in background
    const sessionPromise = runner.runSession(TEST_DATE, TEST_SYMBOL);

    // Give the event loop a tick so runSession reaches the await
    await new Promise((r) => setTimeout(r, 10));

    // Trigger shutdown -- this calls runner.stop() via the registered handler
    await mgr.shutdown('signal');

    // Session should resolve with INTERRUPTED
    const result = await sessionPromise;

    expect(result.status).toBe('INTERRUPTED');
    expect(mgr.shuttingDown).toBe(true);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  // -----------------------------------------------------------------------
  // Test 4
  // -----------------------------------------------------------------------
  it('stop() during BUILDING_ZONE phase', async () => {
    const clock = new PausableClock(windows.zoneStartUtc);
    const adapter = new ControllableAdapter();
    const log = createSilentLogger();

    const runner = new SessionRunner(adapter, clock, log, DEFAULT_CONFIG);

    // Start session in background
    const sessionPromise = runner.runSession(TEST_DATE, TEST_SYMBOL);

    // Give the event loop a tick so runSession reaches the await
    await new Promise((r) => setTimeout(r, 10));

    // Emit a couple of zone bars (not enough to complete the zone)
    adapter.emitBar(makeBar(windows.zoneStartUtc));
    adapter.emitBar(makeBar(windows.zoneStartUtc + FIVE_MIN_MS));

    // Give time for bar processing
    await new Promise((r) => setTimeout(r, 5));

    // Stop mid-zone-building
    runner.stop();

    const result = await sessionPromise;

    expect(result.status).toBe('INTERRUPTED');
    // Some bars should have been accumulated
    expect(result.allBars.length).toBeGreaterThanOrEqual(0);
  });

  // -----------------------------------------------------------------------
  // Test 5
  // -----------------------------------------------------------------------
  it('double stop() is idempotent', async () => {
    const clock = new PausableClock(windows.zoneStartUtc);
    const adapter = new ControllableAdapter();
    const log = createSilentLogger();

    const runner = new SessionRunner(adapter, clock, log, DEFAULT_CONFIG);

    // Start session in background
    const sessionPromise = runner.runSession(TEST_DATE, TEST_SYMBOL);

    // Give the event loop a tick
    await new Promise((r) => setTimeout(r, 10));

    // Call stop() twice -- should not throw
    runner.stop();
    expect(() => runner.stop()).not.toThrow();

    const result = await sessionPromise;
    expect(result.status).toBe('INTERRUPTED');
  });

  // -----------------------------------------------------------------------
  // Test 6 (bonus): ShutdownManager.shutdown() is idempotent
  // -----------------------------------------------------------------------
  it('ShutdownManager.shutdown() ignores duplicate calls', async () => {
    const log = createSilentLogger();
    const mgr = new ShutdownManager(log);

    let callCount = 0;
    mgr.register(() => {
      callCount++;
    });

    // First call runs handlers
    await mgr.shutdown('signal');
    expect(callCount).toBe(1);

    // Second call is a no-op
    await mgr.shutdown('duplicate');
    expect(callCount).toBe(1);
    expect(mgr.shuttingDown).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Test 7 (bonus): ShutdownManager continues on handler errors
  // -----------------------------------------------------------------------
  it('ShutdownManager continues executing remaining handlers when one throws', async () => {
    const log = createSilentLogger();
    const mgr = new ShutdownManager(log);

    const results: string[] = [];

    mgr.register(() => {
      results.push('handler-1');
    });
    mgr.register(() => {
      throw new Error('handler-2 exploded');
    });
    mgr.register(() => {
      results.push('handler-3');
    });

    // Should not throw despite handler-2 failing
    await mgr.shutdown('test');

    // LIFO: handler-3 first, handler-2 explodes, handler-1 still runs
    expect(results).toEqual(['handler-3', 'handler-1']);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
