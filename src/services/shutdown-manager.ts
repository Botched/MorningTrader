/**
 * MorningTrader - Graceful Shutdown Manager
 *
 * Handles orderly process shutdown on SIGINT / SIGTERM signals.
 * Shutdown handlers are executed in LIFO order (last registered = first called)
 * so that cleanup mirrors the reverse of initialization.
 *
 * Typical registration order:
 *   1. IBKR bar stream unsubscribe
 *   2. Mark session as INTERRUPTED
 *   3. Record open positions as SESSION_TIMEOUT
 *   4. Flush SQLite writes
 *   5. Close IBKR connection
 *
 * During shutdown these execute 5 -> 4 -> 3 -> 2 -> 1.
 */

import type { Logger } from './logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A function invoked during graceful shutdown.
 * May be synchronous or return a Promise.
 */
export type ShutdownHandler = () => Promise<void> | void;

// ---------------------------------------------------------------------------
// ShutdownManager
// ---------------------------------------------------------------------------

export class ShutdownManager {
  private readonly handlers: ShutdownHandler[] = [];
  private isShuttingDown = false;
  private readonly forceExitTimeout: number;

  constructor(
    private readonly logger: Logger,
    options?: { forceExitTimeoutMs?: number },
  ) {
    this.forceExitTimeout = options?.forceExitTimeoutMs ?? 10000;
  }

  /**
   * Register a shutdown handler. Handlers are called in LIFO order
   * (last registered = first called).
   *
   * Typical registration order:
   *   1. IBKR bar stream unsubscribe
   *   2. Mark session as INTERRUPTED
   *   3. Record open positions as SESSION_TIMEOUT
   *   4. Flush SQLite writes
   *   5. Close IBKR connection
   */
  register(handler: ShutdownHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Start listening for SIGINT and SIGTERM signals.
   * Should be called once at application startup.
   */
  listen(): void {
    const handler = () => {
      this.shutdown('signal');
    };
    process.on('SIGINT', handler);
    process.on('SIGTERM', handler);
  }

  /**
   * Execute shutdown sequence.
   * Idempotent - a second call while shutdown is already in progress is a no-op.
   *
   * @param reason - Why shutdown was triggered ('signal', 'error', 'complete')
   */
  async shutdown(reason: string): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn('Shutdown already in progress, ignoring duplicate signal');
      return;
    }
    this.isShuttingDown = true;

    this.logger.info({ reason }, 'Shutdown initiated');

    // Set force exit timer to prevent hanging on stuck handlers.
    const forceTimer = setTimeout(() => {
      this.logger.error('Force exit: clean shutdown timed out');
      process.exit(1);
    }, this.forceExitTimeout);
    // Unref so the timer doesn't keep the event loop alive if clean shutdown
    // completes before the timeout fires.
    forceTimer.unref();

    // Execute handlers in reverse order (LIFO).
    const reversed = [...this.handlers].reverse();
    for (const handler of reversed) {
      try {
        await handler();
      } catch (err) {
        this.logger.error({ err }, 'Error during shutdown handler');
        // Continue with remaining handlers regardless of individual failures.
      }
    }

    clearTimeout(forceTimer);
    this.logger.info('Clean shutdown complete');
    process.exit(0);
  }

  /** Check if shutdown is in progress. */
  get shuttingDown(): boolean {
    return this.isShuttingDown;
  }
}
