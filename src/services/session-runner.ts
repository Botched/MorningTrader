/**
 * MorningTrader - Session Runner Service
 *
 * Orchestrates a single trading session lifecycle:
 *   1. Creates an XState strategy actor from the machine
 *   2. Subscribes to bar streams from a MarketDataProvider
 *   3. Feeds completed bars as NEW_BAR events to the actor
 *   4. Handles SESSION_START and SESSION_END events
 *   5. Tracks session state and produces a SessionContext at the end
 *
 * All timestamps are UTC milliseconds. All prices are integer cents.
 */

import type { Subscription } from 'rxjs';
import type { MarketDataProvider, Clock } from '../core/interfaces/index.js';
import type { SessionContext, SessionStatus, StrategyConfig } from '../core/models/index.js';
import type { StrategyMachineContext } from '../core/strategy/events.js';
import type { Logger } from './logger.js';
import { createStrategyActor } from '../core/strategy/machine.js';
import { getSessionWindows } from '../utils/time.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The XState actor returned by createStrategyActor. */
type StrategyActor = ReturnType<typeof createStrategyActor>;

// ---------------------------------------------------------------------------
// State value -> SessionStatus mapping
// ---------------------------------------------------------------------------

/**
 * Map the XState actor state value to a SessionStatus.
 *
 * The actor state value can be a string (top-level states like 'IDLE',
 * 'BUILDING_ZONE', 'NO_TRADE', 'COMPLETE', 'ERROR') or an object
 * (parallel states like { longTrack: '...', shortTrack: '...', barAccumulator: '...' }
 * when in MONITORING).
 */
function mapStateToSessionStatus(stateValue: unknown): SessionStatus {
  if (typeof stateValue === 'string') {
    switch (stateValue) {
      case 'IDLE':
        return 'WAITING';
      case 'BUILDING_ZONE':
        return 'BUILDING_ZONE';
      case 'MONITORING':
        return 'MONITORING';
      case 'NO_TRADE':
        return 'NO_TRADE';
      case 'COMPLETE':
        return 'COMPLETE';
      case 'ERROR':
        return 'ERROR';
      default:
        return 'COMPLETE';
    }
  }
  // Object state value means we are in a parallel state (MONITORING)
  if (typeof stateValue === 'object' && stateValue !== null) {
    return 'MONITORING';
  }
  return 'COMPLETE';
}

// ---------------------------------------------------------------------------
// SessionRunner
// ---------------------------------------------------------------------------

export class SessionRunner {
  private readonly marketData: MarketDataProvider;
  private readonly clock: Clock;
  private readonly log: Logger;
  private readonly config: StrategyConfig;

  /** Active bar subscription (RxJS). */
  private barSubscription: Subscription | null = null;

  /** Active strategy actor. */
  private actor: StrategyActor | null = null;

  /** Whether the session has been stopped via stop(). */
  private stopped = false;

  /** Resolve callback for the actor-done promise (early exit). */
  private resolveActorDone: (() => void) | null = null;

  /** Timestamp when runSession was called. */
  private startedAt = 0;

  constructor(
    marketData: MarketDataProvider,
    clock: Clock,
    logger: Logger,
    config: StrategyConfig,
  ) {
    this.marketData = marketData;
    this.clock = clock;
    this.log = logger;
    this.config = config;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Run a complete trading session for the given date and symbol.
   *
   * Lifecycle:
   *   1. Compute session windows (zone start/end, execution end) in UTC
   *   2. Create and start the XState strategy actor
   *   3. Send SESSION_START event
   *   4. Subscribe to live bar stream, filtering to session window
   *   5. Wait until execution end or actor reaches final state
   *   6. Send SESSION_END, clean up, and return the final SessionContext
   *
   * @param date   - Trading date in 'YYYY-MM-DD' format (Eastern Time)
   * @param symbol - Ticker symbol (e.g. 'SPY')
   * @returns Completed SessionContext summarizing the session
   */
  async runSession(date: string, symbol: string): Promise<SessionContext> {
    this.stopped = false;
    this.startedAt = this.clock.now();

    const windows = getSessionWindows(date);

    this.log.info(
      {
        date,
        symbol,
        zoneStartUtc: new Date(windows.zoneStartUtc).toISOString(),
        zoneEndUtc: new Date(windows.zoneEndUtc).toISOString(),
        executionEndUtc: new Date(windows.executionEndUtc).toISOString(),
      },
      'Session starting',
    );

    // ----- Create and start the actor -----
    const actor = createStrategyActor({
      date,
      symbol,
      maxBreakAttempts: this.config.maxBreakAttempts,
      minZoneSpreadCents: this.config.minZoneSpreadCents,
      maxZoneSpreadPercent: this.config.maxZoneSpreadPercent,
    });
    this.actor = actor;
    actor.start();

    // ----- Send SESSION_START -----
    actor.send({ type: 'SESSION_START', date, symbol });
    this.log.info({ date, symbol }, 'SESSION_START sent');

    // ----- Create a promise that resolves when actor reaches final state -----
    const actorDonePromise = new Promise<void>((resolve) => {
      this.resolveActorDone = resolve;

      actor.subscribe((snapshot) => {
        if (snapshot.status === 'done') {
          this.log.info(
            { state: snapshot.value },
            'Actor reached final state',
          );
          resolve();
        }
      });
    });

    // ----- Subscribe to bar stream -----
    try {
      const bars$ = this.marketData.subscribeBars(symbol);

      this.barSubscription = bars$.subscribe({
        next: (bar) => {
          try {
            // Only process completed bars within the session window
            if (!bar.completed) return;
            if (bar.timestamp < windows.zoneStartUtc) return;
            if (bar.timestamp >= windows.executionEndUtc) return;

            // Do not feed bars after stop or after actor is done
            if (this.stopped) return;
            const snapshot = actor.getSnapshot();
            if (snapshot.status === 'done') return;

            actor.send({ type: 'NEW_BAR', candle: bar });

            this.log.debug(
              {
                timestamp: new Date(bar.timestamp).toISOString(),
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
                volume: bar.volume,
              },
              'Bar sent to actor',
            );
          } catch (err) {
            this.log.error(
              { err, timestamp: bar.timestamp },
              'Error processing bar',
            );
          }
        },
        error: (err) => {
          this.log.error({ err }, 'Bar stream error');
          try {
            const snapshot = actor.getSnapshot();
            if (snapshot.status !== 'done') {
              actor.send({
                type: 'ERROR',
                message: err instanceof Error ? err.message : String(err),
              });
            }
          } catch {
            // Actor may already be stopped
          }
        },
      });
    } catch (err) {
      this.log.error({ err }, 'Failed to subscribe to bar stream');
      actor.send({
        type: 'ERROR',
        message: err instanceof Error ? err.message : String(err),
      });
    }

    // ----- Wait for session end or actor done -----
    const waitPromise = this.clock.waitUntil(windows.executionEndUtc);
    await Promise.race([waitPromise, actorDonePromise]);

    // ----- Send SESSION_END if actor is still running -----
    try {
      const snapshot = actor.getSnapshot();
      if (snapshot.status !== 'done' && !this.stopped) {
        actor.send({ type: 'SESSION_END' });
        this.log.info('SESSION_END sent');
      }
    } catch {
      // Actor may already be stopped
    }

    // ----- Cleanup -----
    this.cleanup(symbol);

    // ----- Build and return SessionContext -----
    const sessionContext = this.buildSessionContext(actor, date, symbol);

    this.log.info(
      {
        date,
        symbol,
        status: sessionContext.status,
        trades: sessionContext.trades.length,
        signals: sessionContext.signals.length,
        bars: sessionContext.allBars.length,
      },
      'Session completed',
    );

    return sessionContext;
  }

  /**
   * Gracefully stop a running session.
   *
   * Used by the ShutdownManager to abort the session on SIGINT/SIGTERM.
   * The runSession promise will resolve with status 'INTERRUPTED'.
   */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;

    this.log.info('Session stop requested');

    // Resolve the actor-done promise to unblock runSession
    if (this.resolveActorDone) {
      this.resolveActorDone();
      this.resolveActorDone = null;
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Clean up subscriptions and stop the actor.
   */
  private cleanup(symbol: string): void {
    // Unsubscribe from bar stream
    if (this.barSubscription) {
      this.barSubscription.unsubscribe();
      this.barSubscription = null;
    }

    // Unsubscribe from market data provider
    try {
      this.marketData.unsubscribeBars(symbol);
    } catch (err) {
      this.log.warn({ err }, 'Error unsubscribing from bars');
    }

    // Stop the actor
    if (this.actor) {
      try {
        this.actor.stop();
      } catch {
        // Actor may already be stopped
      }
      this.actor = null;
    }

    this.resolveActorDone = null;
  }

  /**
   * Build a SessionContext from the actor's final snapshot.
   */
  private buildSessionContext(
    actor: StrategyActor,
    date: string,
    symbol: string,
  ): SessionContext {
    let machineContext: StrategyMachineContext;
    let status: SessionStatus;

    try {
      const snapshot = actor.getSnapshot();
      machineContext = snapshot.context;
      status = this.stopped
        ? 'INTERRUPTED'
        : mapStateToSessionStatus(snapshot.value);
    } catch {
      // If snapshot is unavailable, return a minimal error context
      return {
        date,
        symbol,
        zone: null,
        signals: [],
        trades: [],
        outcomes: [],
        allBars: [],
        status: 'ERROR',
        isBacktest: false,
        executionMode: 'LIVE',
        startedAt: this.startedAt,
        completedAt: this.clock.now(),
        error: 'Failed to read actor snapshot',
      };
    }

    return {
      date,
      symbol,
      zone: machineContext.zone,
      signals: [...machineContext.signals],
      trades: [...machineContext.trades],
      outcomes: [...machineContext.outcomes],
      allBars: [...machineContext.allBars],
      status,
      isBacktest: false,
      executionMode: 'LIVE',
      startedAt: this.startedAt,
      completedAt: this.clock.now(),
      error: machineContext.error,
    };
  }
}
