/**
 * MorningTrader - IBKR Connection Manager
 *
 * Manages the lifecycle of a connection to Interactive Brokers TWS/Gateway
 * via IBApiNext. Provides:
 * - Observable connection state tracking
 * - Automatic reconnection with exponential backoff
 * - Error routing (connectivity vs application errors)
 * - Bar timestamp tracking for post-reconnect backfill
 */

import {
  IBApiNext,
  ConnectionState as IBConnectionState,
  MarketDataType,
} from '@stoqey/ib';
import type { IBApiNextError } from '@stoqey/ib';
import { Observable, Subject, BehaviorSubject, Subscription, firstValueFrom, filter, timeout } from 'rxjs';
import type { Logger } from '../../services/logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Possible states for the IBKR connection, as seen by MorningTrader.
 *
 * Superset of the IB SDK enum -- we add RECONNECTING and DISCONNECTING
 * to capture transient phases the application cares about.
 */
export type ConnectionState =
  | 'CONNECTED'
  | 'CONNECTING'
  | 'DISCONNECTING'
  | 'RECONNECTING'
  | 'DISCONNECTED';

/**
 * Configuration for the ConnectionManager.
 */
export interface ConnectionConfig {
  /** TWS / IB Gateway hostname (e.g. '127.0.0.1'). */
  readonly host: string;
  /** TWS / IB Gateway port (e.g. 7496 live, 7497 paper). */
  readonly port: number;
  /** Unique client id for this API session. */
  readonly clientId: number;
  /** Maximum reconnection attempts before giving up. Default: 10 */
  readonly reconnectAttempts?: number;
  /** Base delay (ms) for exponential backoff. Default: 2000 */
  readonly reconnectBaseDelay?: number;
  /** Maximum delay (ms) cap for exponential backoff. Default: 60000 */
  readonly reconnectMaxDelay?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_RECONNECT_ATTEMPTS = 10;
const DEFAULT_RECONNECT_BASE_DELAY = 2000;
const DEFAULT_RECONNECT_MAX_DELAY = 60000;

/** Timeout (ms) for the initial connect() handshake. */
const CONNECT_TIMEOUT_MS = 30_000;

// IBKR system error codes
const IBKR_CONNECTIVITY_LOST = 1100;
const IBKR_CONNECTIVITY_RESTORED_DATA_MAINTAINED = 1101;
const IBKR_CONNECTIVITY_RESTORED_DATA_LOST = 1102;
const IBKR_MARKET_DATA_FARM_OK = 2104;
const IBKR_HMDS_DATA_FARM_OK = 2106;

// ---------------------------------------------------------------------------
// ConnectionManager
// ---------------------------------------------------------------------------

/**
 * Manages the socket connection to TWS / IB Gateway, including reconnection
 * with exponential back-off and bar-timestamp tracking so the IBKRAdapter
 * (T015) knows from where to backfill after a reconnect.
 */
export class ConnectionManager {
  // ---- internal state ----
  private api: IBApiNext | null = null;
  private readonly connectionStateSubject = new BehaviorSubject<ConnectionState>('DISCONNECTED');
  private readonly errorsSubject = new Subject<{ code: number; message: string }>();
  private reconnectCount = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastReceivedBarTimestamp = 0;
  private isShuttingDown = false;
  private errorSubscription: Subscription | null = null;
  private connectionSubscription: Subscription | null = null;

  // ---- public observables ----

  /** Observable stream of connection state transitions. */
  readonly connectionState$: Observable<ConnectionState>;
  /** Observable stream of error events forwarded from IBKR. */
  readonly errors$: Observable<{ code: number; message: string }>;

  constructor(
    private readonly config: ConnectionConfig,
    private readonly logger: Logger,
  ) {
    this.connectionState$ = this.connectionStateSubject.asObservable();
    this.errors$ = this.errorsSubject.asObservable();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Get the underlying IBApiNext instance.
   *
   * @throws Error if the manager is not currently connected.
   */
  getApi(): IBApiNext {
    if (!this.api || !this.isConnected) {
      throw new Error('ConnectionManager is not connected. Call connect() first.');
    }
    return this.api;
  }

  /**
   * Establish a connection to TWS / IB Gateway.
   *
   * 1. Creates a new IBApiNext instance (auto-reconnect disabled).
   * 2. Transitions state to CONNECTING.
   * 3. Calls `api.connect(clientId)`.
   * 4. Waits for the IB SDK to report Connected.
   * 5. Sets market data type to REALTIME.
   * 6. Wires up error monitoring.
   * 7. Transitions state to CONNECTED and resets the reconnect counter.
   */
  async connect(): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('ConnectionManager is shutting down; cannot connect.');
    }

    // Tear down any previous API instance
    this.cleanupApiSubscriptions();

    // 1. Create IBApiNext -- reconnectInterval=0 disables built-in reconnect
    this.api = new IBApiNext({
      host: this.config.host,
      port: this.config.port,
      reconnectInterval: 0,
    });

    // 2. Transition to CONNECTING
    this.connectionStateSubject.next('CONNECTING');
    this.logger.info(
      { host: this.config.host, port: this.config.port, clientId: this.config.clientId },
      'IBKR connecting',
    );

    // 3. Initiate connection (synchronous call that triggers async handshake)
    this.api.connect(this.config.clientId);

    // 4. Wait for IB SDK to report Connected (with timeout)
    try {
      await firstValueFrom(
        this.api.connectionState.pipe(
          filter((state: IBConnectionState) => state === IBConnectionState.Connected),
          timeout(CONNECT_TIMEOUT_MS),
        ),
      );
    } catch (err) {
      this.connectionStateSubject.next('DISCONNECTED');
      this.cleanupApi();
      throw new Error(
        `Failed to connect to IBKR within ${CONNECT_TIMEOUT_MS}ms: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // 5. Set market data type to REALTIME
    this.api.setMarketDataType(MarketDataType.REALTIME);

    // 6. Wire up error monitoring
    this.setupErrorMonitoring();

    // 7. Connected -- reset reconnect counter
    this.connectionStateSubject.next('CONNECTED');
    this.reconnectCount = 0;
    this.logger.info('IBKR connected');
  }

  /**
   * Disconnect from TWS / IB Gateway cleanly.
   *
   * Sets `isShuttingDown` so the error handler will not trigger reconnects.
   */
  async disconnect(): Promise<void> {
    this.isShuttingDown = true;
    this.connectionStateSubject.next('DISCONNECTING');
    this.logger.info('IBKR disconnecting');

    this.cancelReconnectTimer();
    this.cleanupApiSubscriptions();

    if (this.api) {
      try {
        this.api.disconnect();
      } catch {
        // Swallow -- we are tearing down anyway
      }
      this.api = null;
    }

    this.connectionStateSubject.next('DISCONNECTED');
    this.logger.info('IBKR disconnected');
  }

  /** Whether the connection is currently established. */
  get isConnected(): boolean {
    return this.connectionStateSubject.getValue() === 'CONNECTED';
  }

  /**
   * Record the timestamp of the most recently received bar.
   *
   * The IBKRAdapter calls this as bars arrive so that, after a reconnect,
   * we know from what point historical data must be back-filled.
   */
  recordBarTimestamp(timestamp: number): void {
    this.lastReceivedBarTimestamp = Math.max(this.lastReceivedBarTimestamp, timestamp);
  }

  /**
   * Get the timestamp from which post-reconnect backfill should start.
   *
   * Returns 0 if no bars have been recorded yet.
   */
  getBackfillStartTimestamp(): number {
    return this.lastReceivedBarTimestamp;
  }

  /**
   * Release all resources held by this manager.
   *
   * After calling `destroy()`, the instance must not be reused.
   */
  destroy(): void {
    this.isShuttingDown = true;
    this.cancelReconnectTimer();
    this.cleanupApiSubscriptions();

    if (this.api) {
      try {
        this.api.disconnect();
      } catch {
        // Ignore during teardown
      }
      this.api = null;
    }

    this.connectionStateSubject.complete();
    this.errorsSubject.complete();
  }

  // ---------------------------------------------------------------------------
  // Private -- error routing
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to IBApiNext's error observable and route errors to the
   * appropriate handler.
   */
  private setupErrorMonitoring(): void {
    if (!this.api) return;

    this.errorSubscription = this.api.error.subscribe({
      next: (error: IBApiNextError) => {
        this.handleIBKRError(error.code, error.message);
      },
      error: (err: unknown) => {
        this.logger.error({ err }, 'IBKR error observable faulted');
      },
    });

    // Also watch the IB SDK connection state for unexpected disconnects.
    this.connectionSubscription = this.api.connectionState.subscribe({
      next: (state: IBConnectionState) => {
        if (state === IBConnectionState.Disconnected && !this.isShuttingDown) {
          this.logger.warn('IBKR SDK reported Disconnected');
          if (this.connectionStateSubject.getValue() !== 'RECONNECTING') {
            this.connectionStateSubject.next('RECONNECTING');
            void this.attemptReconnect();
          }
        }
      },
    });
  }

  /**
   * Route IBKR error codes to the correct action.
   *
   * Known error codes:
   * - 1100  Connectivity between IB and TWS lost
   * - 1101  Connectivity restored -- data maintained
   * - 1102  Connectivity restored -- data lost (backfill needed)
   * - 2104  Market data farm connection OK
   * - 2106  HMDS data farm connection OK
   */
  private handleIBKRError(code: number, message: string): void {
    switch (code) {
      case IBKR_CONNECTIVITY_LOST:
        this.logger.warn({ code, message }, 'IBKR connectivity lost');
        if (!this.isShuttingDown && this.connectionStateSubject.getValue() !== 'RECONNECTING') {
          this.connectionStateSubject.next('RECONNECTING');
          void this.attemptReconnect();
        }
        break;

      case IBKR_CONNECTIVITY_RESTORED_DATA_MAINTAINED:
        this.logger.info({ code, message }, 'IBKR connectivity restored (data maintained)');
        this.reconnectCount = 0;
        this.cancelReconnectTimer();
        this.connectionStateSubject.next('CONNECTED');
        break;

      case IBKR_CONNECTIVITY_RESTORED_DATA_LOST:
        this.logger.warn({ code, message }, 'IBKR connectivity restored (data lost -- backfill needed)');
        this.reconnectCount = 0;
        this.cancelReconnectTimer();
        this.connectionStateSubject.next('CONNECTED');
        // Forward to errors$ so the IBKRAdapter can trigger a backfill
        this.errorsSubject.next({ code, message });
        break;

      case IBKR_MARKET_DATA_FARM_OK:
      case IBKR_HMDS_DATA_FARM_OK:
        // Informational -- safe to ignore
        this.logger.info({ code, message }, 'IBKR farm status');
        break;

      default:
        // Forward all other errors to the public observable
        this.logger.warn({ code, message }, 'IBKR error');
        this.errorsSubject.next({ code, message });
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Private -- reconnection
  // ---------------------------------------------------------------------------

  /**
   * Attempt to re-establish the connection using exponential backoff.
   *
   * delay = min(baseDelay * 2^attempt, maxDelay)
   *
   * Gives up after `reconnectAttempts` (default 10) and transitions to
   * DISCONNECTED.
   */
  private async attemptReconnect(): Promise<void> {
    const maxAttempts = this.config.reconnectAttempts ?? DEFAULT_RECONNECT_ATTEMPTS;
    const baseDelay = this.config.reconnectBaseDelay ?? DEFAULT_RECONNECT_BASE_DELAY;
    const maxDelay = this.config.reconnectMaxDelay ?? DEFAULT_RECONNECT_MAX_DELAY;

    while (this.reconnectCount < maxAttempts && !this.isShuttingDown) {
      const delay = Math.min(baseDelay * Math.pow(2, this.reconnectCount), maxDelay);
      this.reconnectCount++;

      this.logger.info(
        { attempt: this.reconnectCount, maxAttempts, delayMs: delay },
        'IBKR reconnect attempt scheduled',
      );

      // Wait for the backoff delay (cancellable via clearTimeout)
      await new Promise<void>((resolve) => {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          resolve();
        }, delay);
      });

      // If shutdown was requested while we were waiting, bail out
      if (this.isShuttingDown) {
        this.logger.info('Reconnect aborted -- shutdown in progress');
        return;
      }

      try {
        // Tear down the old API before creating a new one
        this.cleanupApiSubscriptions();
        if (this.api) {
          try {
            this.api.disconnect();
          } catch {
            // Ignore cleanup errors
          }
          this.api = null;
        }

        // Re-use the public connect() flow
        this.isShuttingDown = false; // allow connect()
        await this.connect();

        this.logger.info(
          { attempt: this.reconnectCount },
          'IBKR reconnected successfully',
        );
        return; // success -- exit the retry loop
      } catch (err) {
        this.logger.error(
          { attempt: this.reconnectCount, err },
          'IBKR reconnect attempt failed',
        );
      }
    }

    // Exhausted all attempts
    if (!this.isShuttingDown) {
      this.logger.error(
        { maxAttempts },
        'IBKR reconnect failed after maximum attempts -- giving up',
      );
      this.connectionStateSubject.next('DISCONNECTED');
    }
  }

  // ---------------------------------------------------------------------------
  // Private -- helpers
  // ---------------------------------------------------------------------------

  /** Cancel a pending reconnect timer, if any. */
  private cancelReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /** Unsubscribe from IBApiNext observables. */
  private cleanupApiSubscriptions(): void {
    if (this.errorSubscription) {
      this.errorSubscription.unsubscribe();
      this.errorSubscription = null;
    }
    if (this.connectionSubscription) {
      this.connectionSubscription.unsubscribe();
      this.connectionSubscription = null;
    }
  }

  /** Disconnect and null out the API instance. */
  private cleanupApi(): void {
    this.cleanupApiSubscriptions();
    if (this.api) {
      try {
        this.api.disconnect();
      } catch {
        // Ignore
      }
      this.api = null;
    }
  }
}
