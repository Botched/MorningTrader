/**
 * MorningTrader - IBKR Market Data Adapter
 *
 * Implements the MarketDataProvider interface by delegating to the
 * component-level helpers: ConnectionManager, PacingManager,
 * ContractResolver, BarNormalizer, and BarValidator.
 *
 * All prices are integer cents.  All timestamps are UTC milliseconds.
 */

import {
  type IBApiNext,
  type Contract,
  BarSizeSetting,
  WhatToShow,
  SecType,
} from '@stoqey/ib';
import type { Bar } from '@stoqey/ib';
import {
  Observable,
  Subject,
  Subscription,
} from 'rxjs';
import {
  map,
  filter,
  distinctUntilChanged,
  takeUntil,
  share,
} from 'rxjs/operators';
import type {
  MarketDataProvider,
  ContractSpec,
  ProviderError,
  ConnectionState,
} from '../../core/interfaces/index.js';
import type { Candle } from '../../core/models/index.js';
import type { Logger } from '../../services/logger.js';
import { ConnectionManager } from './connection.js';
import { PacingManager } from './pacing.js';
import { ContractResolver } from './contract-resolver.js';
import { normalizeBar, BarCompletionBuffer } from './bar-normalizer.js';
import type { IBKRBar } from './bar-normalizer.js';
import { validateCandle } from './bar-validator.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** IBKR error: no security definition found. */
const ERR_NO_SECURITY_DEF = 200;
/** IBKR error: historical data farm connecting / query issues. */
const ERR_HISTORICAL_DATA = 162;
/** IBKR error: pacing violation. */
const ERR_PACING_VIOLATION = 420;

/** Set of fatal IBKR error codes that should reject / error immediately. */
const FATAL_ERROR_CODES = new Set<number>([ERR_NO_SECURITY_DEF]);

/** Seconds in one day. */
const SECONDS_PER_DAY = 86_400;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute an IBKR duration string from a UTC millisecond time range.
 *
 * IBKR accepts duration strings like:
 *   "3600 S"  (seconds)
 *   "2 D"     (days)
 *   "1 M"     (months)
 *   "1 Y"     (years)
 */
function computeDuration(startUtcMs: number, endUtcMs: number): string {
  const totalSeconds = Math.ceil((endUtcMs - startUtcMs) / 1000);

  if (totalSeconds <= 0) {
    return '1 D'; // fallback: request 1 day
  }

  if (totalSeconds < SECONDS_PER_DAY) {
    return `${totalSeconds} S`;
  }

  const days = Math.ceil(totalSeconds / SECONDS_PER_DAY);

  if (days <= 365) {
    return `${days} D`;
  }

  // For ranges exceeding a year, use years
  const years = Math.ceil(days / 365);
  return `${years} Y`;
}

/**
 * Format a UTC millisecond timestamp into the IBKR endDateTime string:
 * "yyyyMMdd HH:mm:ss UTC"
 */
function formatEndDateTime(utcMs: number): string {
  const d = new Date(utcMs);
  const yyyy = d.getUTCFullYear().toString();
  const MM = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = d.getUTCDate().toString().padStart(2, '0');
  const HH = d.getUTCHours().toString().padStart(2, '0');
  const mm = d.getUTCMinutes().toString().padStart(2, '0');
  const ss = d.getUTCSeconds().toString().padStart(2, '0');
  return `${yyyy}${MM}${dd} ${HH}:${mm}:${ss} UTC`;
}

/**
 * Map a ContractSpec to the @stoqey/ib Contract type.
 */
function toIBContract(spec: ContractSpec): Contract {
  return {
    conId: spec.conId,
    symbol: spec.symbol,
    secType: spec.secType as SecType,
    exchange: spec.exchange,
    currency: spec.currency,
  };
}

/**
 * Convert a @stoqey/ib Bar into the IBKRBar shape expected by normalizeBar.
 * IBKR returns optional fields; we default where necessary.
 */
function ibBarToIBKRBar(bar: Bar): IBKRBar {
  return {
    time: bar.time ?? '0',
    open: bar.open ?? 0,
    high: bar.high ?? 0,
    low: bar.low ?? 0,
    close: bar.close ?? 0,
    volume: bar.volume,
  };
}

// ---------------------------------------------------------------------------
// Subscription tracking
// ---------------------------------------------------------------------------

interface BarSubscription {
  readonly subscription: Subscription;
  readonly buffer: BarCompletionBuffer;
}

// ---------------------------------------------------------------------------
// IBKRAdapter
// ---------------------------------------------------------------------------

export class IBKRAdapter implements MarketDataProvider {
  // ---- internal state ----
  private readonly destroy$ = new Subject<void>();
  private readonly errorsSubject = new Subject<ProviderError>();
  private readonly barSubscriptions = new Map<string, BarSubscription>();
  private errorForwardSub: Subscription | null = null;

  // ---- public observables ----
  readonly errors$: Observable<ProviderError>;

  constructor(
    private readonly api: IBApiNext,
    private readonly connectionManager: ConnectionManager,
    private readonly pacingManager: PacingManager,
    private readonly contractResolver: ContractResolver,
    private readonly logger: Logger,
  ) {
    this.errors$ = this.errorsSubject.asObservable();
  }

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------

  async connect(): Promise<void> {
    await this.connectionManager.connect();
    this.setupErrorForwarding();
    this.logger.info('IBKRAdapter connected');
  }

  async disconnect(): Promise<void> {
    // Cancel all active bar subscriptions
    for (const symbol of [...this.barSubscriptions.keys()]) {
      this.unsubscribeBars(symbol);
    }

    this.cleanupErrorForwarding();
    await this.connectionManager.disconnect();
    this.logger.info('IBKRAdapter disconnected');
  }

  get isConnected(): boolean {
    return this.connectionManager.isConnected;
  }

  /**
   * Map ConnectionManager's state (which includes 'CONNECTING') to the
   * MarketDataProvider ConnectionState (which does not).
   */
  get connectionState$(): Observable<ConnectionState> {
    return this.connectionManager.connectionState$.pipe(
      map((state): ConnectionState => {
        // ConnectionManager emits 'CONNECTING' which is not in the interface.
        // Map it to 'DISCONNECTED' since the connection is not yet usable.
        if (state === 'CONNECTING') {
          return 'DISCONNECTED';
        }
        return state as ConnectionState;
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // Contract resolution
  // ---------------------------------------------------------------------------

  async resolveContract(symbol: string): Promise<ContractSpec> {
    return this.contractResolver.resolve(
      this.connectionManager.getApi(),
      symbol,
    );
  }

  // ---------------------------------------------------------------------------
  // Historical bars (one-shot)
  // ---------------------------------------------------------------------------

  async getHistoricalBars(
    symbol: string,
    startUtc: number,
    endUtc: number,
  ): Promise<Candle[]> {
    // 1. Resolve contract
    const spec = await this.resolveContract(symbol);
    const ibContract = toIBContract(spec);

    // 2. Compute IBKR request parameters
    const durationStr = computeDuration(startUtc, endUtc);
    const endDateTime = formatEndDateTime(endUtc);
    const contractId = `${spec.secType}-${spec.symbol}-${spec.exchange}-${spec.currency}`;
    const requestKey = `${spec.symbol}-5min-${startUtc}-${endUtc}`;

    // 3. Acquire pacing slot
    await this.pacingManager.acquireSlot(contractId, requestKey);

    // 4. Fetch historical data
    this.logger.debug(
      { symbol, durationStr, endDateTime },
      'Requesting historical bars',
    );

    let bars: Bar[];
    try {
      bars = await this.connectionManager.getApi().getHistoricalData(
        ibContract,
        endDateTime,
        durationStr,
        BarSizeSetting.MINUTES_FIVE,
        WhatToShow.TRADES,
        1, // useRTH = true (regular trading hours only)
        2, // formatDate = 2 (epoch seconds)
      );
    } catch (err: unknown) {
      const providerError = this.toProviderError(err);
      if (!providerError.recoverable) {
        throw new Error(
          `Historical data request failed for "${symbol}": ${providerError.message}`,
        );
      }
      // Forward recoverable error and return empty
      this.errorsSubject.next(providerError);
      return [];
    }

    // 5. Normalize and validate each bar
    const candles: Candle[] = [];
    for (const bar of bars) {
      const ibkrBar = ibBarToIBKRBar(bar);
      const candle = normalizeBar(ibkrBar);

      // Filter by requested time range
      if (candle.timestamp < startUtc || candle.timestamp > endUtc) {
        continue;
      }

      const validation = validateCandle(candle);
      if (validation.success) {
        candles.push(validation.data);
      } else {
        this.logger.warn(
          { symbol, timestamp: candle.timestamp, errors: validation.error.issues },
          'Bar failed validation, skipping',
        );
      }
    }

    // 6. Sort by timestamp ascending
    candles.sort((a, b) => a.timestamp - b.timestamp);

    this.logger.info(
      { symbol, count: candles.length, startUtc, endUtc },
      'Historical bars retrieved',
    );

    return candles;
  }

  // ---------------------------------------------------------------------------
  // Streaming bars (subscription)
  // ---------------------------------------------------------------------------

  subscribeBars(symbol: string): Observable<Candle> {
    // If there is already a subscription for this symbol, return the same stream
    // by unsubscribing first then re-creating
    if (this.barSubscriptions.has(symbol)) {
      this.unsubscribeBars(symbol);
    }

    const buffer = new BarCompletionBuffer();

    // We create a new Subject for this symbol's stream so we can control its
    // lifecycle independently.
    const barSubject = new Subject<Candle>();

    // Resolve contract and start streaming asynchronously
    const setupSub = new Subscription();

    // We'll use a promise-based setup to resolve the contract first,
    // then subscribe to streaming bars.
    const setup = async (): Promise<void> => {
      const spec = await this.resolveContract(symbol);
      const ibContract = toIBContract(spec);

      this.logger.info({ symbol }, 'Subscribing to bar updates');

      const innerSub = this.connectionManager
        .getApi()
        .getHistoricalDataUpdates(
          ibContract,
          BarSizeSetting.MINUTES_FIVE,
          WhatToShow.TRADES,
          2, // formatDate = 2 (epoch seconds)
        )
        .subscribe({
          next: (bar: Bar) => {
            const ibkrBar = ibBarToIBKRBar(bar);
            const normalized = normalizeBar(ibkrBar);
            const completed = buffer.push(normalized);

            if (completed) {
              // Record timestamp for backfill tracking
              this.connectionManager.recordBarTimestamp(completed.timestamp);

              const validation = validateCandle(completed);
              if (validation.success) {
                barSubject.next(validation.data);
              } else {
                this.logger.warn(
                  { symbol, timestamp: completed.timestamp, errors: validation.error.issues },
                  'Streaming bar failed validation, skipping',
                );
              }
            }
          },
          error: (err: unknown) => {
            const providerError = this.toProviderError(err);
            if (providerError.recoverable) {
              this.errorsSubject.next(providerError);
            } else {
              barSubject.error(
                new Error(`Bar subscription failed for "${symbol}": ${providerError.message}`),
              );
            }
          },
          complete: () => {
            // Flush the last buffered bar on stream completion
            const last = buffer.flush();
            if (last) {
              const validation = validateCandle(last);
              if (validation.success) {
                barSubject.next(validation.data);
              }
            }
            barSubject.complete();
          },
        });

      setupSub.add(innerSub);
    };

    // Fire-and-forget the async setup; errors are forwarded to the subject
    setup().catch((err: unknown) => {
      const providerError = this.toProviderError(err);
      this.errorsSubject.next(providerError);
      barSubject.error(
        new Error(`Failed to set up bar subscription for "${symbol}": ${providerError.message}`),
      );
    });

    // Store the subscription for cleanup
    this.barSubscriptions.set(symbol, {
      subscription: setupSub,
      buffer,
    });

    // Build the output pipeline
    return barSubject.asObservable().pipe(
      distinctUntilChanged((prev, curr) => prev.timestamp === curr.timestamp),
      takeUntil(this.destroy$),
      share(),
    );
  }

  unsubscribeBars(symbol: string): void {
    const entry = this.barSubscriptions.get(symbol);
    if (!entry) {
      this.logger.debug({ symbol }, 'No active bar subscription to cancel');
      return;
    }

    entry.subscription.unsubscribe();
    entry.buffer.reset();
    this.barSubscriptions.delete(symbol);
    this.logger.info({ symbol }, 'Bar subscription cancelled');
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Tear down all resources.  Call once on application shutdown.
   */
  destroy(): void {
    for (const symbol of [...this.barSubscriptions.keys()]) {
      this.unsubscribeBars(symbol);
    }

    this.cleanupErrorForwarding();
    this.destroy$.next();
    this.destroy$.complete();
    this.errorsSubject.complete();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Forward non-fatal errors from the ConnectionManager to the adapter's
   * errors$ subject as ProviderError objects.
   */
  private setupErrorForwarding(): void {
    this.cleanupErrorForwarding();

    this.errorForwardSub = this.connectionManager.errors$.subscribe({
      next: ({ code, message }) => {
        this.errorsSubject.next({
          code,
          message,
          timestamp: Date.now(),
          recoverable: !FATAL_ERROR_CODES.has(code),
        });
      },
    });
  }

  private cleanupErrorForwarding(): void {
    if (this.errorForwardSub) {
      this.errorForwardSub.unsubscribe();
      this.errorForwardSub = null;
    }
  }

  /**
   * Convert an unknown caught error into a ProviderError.
   */
  private toProviderError(err: unknown): ProviderError {
    if (err != null && typeof err === 'object') {
      const errObj = err as Record<string, unknown>;
      const code =
        typeof errObj['code'] === 'number' ? errObj['code'] : -1;
      const message =
        typeof errObj['message'] === 'string'
          ? errObj['message']
          : String(err);
      const recoverable = !FATAL_ERROR_CODES.has(code);

      return { code, message, timestamp: Date.now(), recoverable };
    }

    return {
      code: -1,
      message: String(err),
      timestamp: Date.now(),
      recoverable: true,
    };
  }
}
