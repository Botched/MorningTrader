/**
 * MorningTrader - IBKR Order Execution Adapter
 *
 * Implements the OrderExecutionProvider interface using the @stoqey/ib IBApiNext
 * API for live order execution against Interactive Brokers TWS/Gateway.
 *
 * All prices are integer cents internally.  IBKR uses dollar floats, so this
 * adapter converts:
 *   - outbound (placeOrder): cents -> dollars  (price / 100)
 *   - inbound  (fills$):     dollars -> cents   (Math.round(price * 100))
 *
 * All timestamps are UTC milliseconds.
 */

import {
  type Contract,
  type Order as IBKROrder,
  type ExecutionFilter,
  OrderAction,
  OrderType as IBKROrderType,
  SecType,
  Stock,
} from '@stoqey/ib';
import type { OpenOrder, ExecutionDetail } from '@stoqey/ib';
import { Observable, Subject, Subscription } from 'rxjs';

import type {
  OrderExecutionProvider,
  OrderRequest,
  OrderResult,
  Fill,
  Order,
  Direction,
  OrderType,
} from '../../core/interfaces/index.js';
import type { Logger } from '../../services/logger.js';
import { ConnectionManager } from './connection.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum time (ms) to wait for order acknowledgment after placing. */
const ORDER_ACK_TIMEOUT_MS = 10_000;

/** Interval (ms) for polling execution details after an order is placed. */
const FILL_POLL_INTERVAL_MS = 2_000;

/** Maximum number of fill poll attempts before giving up on a single order. */
const FILL_POLL_MAX_ATTEMPTS = 30;

/**
 * IBKR error code indicating that an order was rejected.
 * Code 201: "Order rejected - reason:..."
 */
const IBKR_ORDER_REJECTED = 201;

/**
 * IBKR error code: order cancelled.
 * Code 202: "Order Cancelled"
 */
const IBKR_ORDER_CANCELLED = 202;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert our Direction ('LONG' | 'SHORT') to IBKR OrderAction.
 */
function toIBKRAction(direction: Direction): OrderAction {
  return direction === 'LONG' ? OrderAction.BUY : OrderAction.SELL;
}

/**
 * Convert our OrderType ('MARKET' | 'LIMIT') to IBKR OrderType enum.
 */
function toIBKROrderType(orderType: OrderType): IBKROrderType {
  return orderType === 'MARKET' ? IBKROrderType.MKT : IBKROrderType.LMT;
}

/**
 * Convert IBKR OrderAction back to our Direction.
 */
function fromIBKRAction(action: OrderAction | undefined): Direction {
  return action === OrderAction.SELL ? 'SHORT' : 'LONG';
}

/**
 * Convert IBKR OrderType back to our OrderType.
 */
function fromIBKROrderType(orderType: IBKROrderType | undefined): OrderType {
  return orderType === IBKROrderType.LMT ? 'LIMIT' : 'MARKET';
}

/**
 * Convert integer cents to dollar float for IBKR.
 */
function centsToDollars(cents: number): number {
  return cents / 100;
}

/**
 * Convert dollar float from IBKR to integer cents.
 */
function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Build a simple stock Contract for IBKR from a symbol string.
 * Uses SMART routing and USD currency by default.
 */
function buildStockContract(symbol: string): Contract {
  return new Stock(symbol, 'SMART', 'USD');
}

// ---------------------------------------------------------------------------
// IBKROrderAdapter
// ---------------------------------------------------------------------------

/**
 * Live order execution adapter that delegates to Interactive Brokers
 * via the @stoqey/ib IBApiNext API.
 *
 * Usage:
 * ```ts
 * const adapter = new IBKROrderAdapter(connectionManager, logger);
 * adapter.fills$.subscribe(fill => console.log('Fill:', fill));
 * const result = await adapter.placeOrder({ symbol: 'AAPL', ... });
 * ```
 */
export class IBKROrderAdapter implements OrderExecutionProvider {
  readonly mode = 'LIVE' as const;

  // ---- internal state ----
  private readonly fillSubject = new Subject<Fill>();
  private readonly trackedOrderIds = new Set<string>();
  private readonly emittedFillExecIds = new Set<string>();
  private orderMonitorSub: Subscription | null = null;
  private errorForwardSub: Subscription | null = null;
  private isMonitoring = false;

  // ---- public observable ----
  readonly fills$: Observable<Fill> = this.fillSubject.asObservable();

  constructor(
    private readonly connectionManager: ConnectionManager,
    private readonly logger: Logger,
  ) {}

  // ---------------------------------------------------------------------------
  // OrderExecutionProvider -- placeOrder
  // ---------------------------------------------------------------------------

  /**
   * Place an order through IBKR.
   *
   * Converts integer-cent prices to IBKR dollar floats, builds the IBKR
   * Order/Contract objects, and submits via `placeNewOrder()`.
   *
   * @returns OrderResult with orderId and status ('SUBMITTED' or 'REJECTED').
   */
  async placeOrder(order: OrderRequest): Promise<OrderResult> {
    const api = this.connectionManager.getApi();

    // Build IBKR contract
    const contract = buildStockContract(order.symbol);

    // Build IBKR order
    const ibOrder: IBKROrder = {
      action: toIBKRAction(order.direction),
      orderType: toIBKROrderType(order.orderType),
      totalQuantity: order.quantity,
      transmit: true,
    };

    // Set limit price (convert cents to dollars)
    if (order.orderType === 'LIMIT' && order.limitPrice != null) {
      ibOrder.lmtPrice = centsToDollars(order.limitPrice);
    }

    // Set stop price if provided (convert cents to dollars)
    if (order.stopPrice != null) {
      ibOrder.auxPrice = centsToDollars(order.stopPrice);
    }

    this.logger.info(
      {
        symbol: order.symbol,
        direction: order.direction,
        quantity: order.quantity,
        orderType: order.orderType,
        limitPriceCents: order.limitPrice,
        limitPriceDollars: order.limitPrice != null ? centsToDollars(order.limitPrice) : undefined,
      },
      'Placing IBKR order',
    );

    try {
      // placeNewOrder auto-fetches next valid order ID and returns it
      const ibOrderId = await api.placeNewOrder(contract, ibOrder);
      const orderId = String(ibOrderId);

      this.logger.info(
        { orderId, symbol: order.symbol },
        'IBKR order submitted',
      );

      // Track this order for fill monitoring
      this.trackedOrderIds.add(orderId);

      // Ensure fill monitoring is active
      this.ensureOrderMonitoring();

      // Start async fill polling for this order
      void this.pollForFills(orderId);

      return { orderId, status: 'SUBMITTED' };
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);

      this.logger.error(
        { err, symbol: order.symbol, direction: order.direction },
        'IBKR order placement failed',
      );

      return {
        orderId: '',
        status: 'REJECTED',
        reason,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // OrderExecutionProvider -- cancelOrder
  // ---------------------------------------------------------------------------

  /**
   * Cancel an active order by its orderId.
   *
   * @param orderId The string order ID (will be parsed to integer for IBKR).
   */
  async cancelOrder(orderId: string): Promise<void> {
    const api = this.connectionManager.getApi();
    const numericId = parseInt(orderId, 10);

    if (isNaN(numericId)) {
      throw new Error(`Invalid orderId for cancellation: "${orderId}"`);
    }

    this.logger.info({ orderId }, 'Cancelling IBKR order');

    try {
      api.cancelOrder(numericId);

      // Remove from tracking
      this.trackedOrderIds.delete(orderId);

      this.logger.info({ orderId }, 'IBKR order cancel request sent');
    } catch (err: unknown) {
      this.logger.error(
        { err, orderId },
        'IBKR order cancellation failed',
      );
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // OrderExecutionProvider -- getOpenOrders
  // ---------------------------------------------------------------------------

  /**
   * Retrieve all currently open orders from IBKR.
   *
   * Maps IBKR's OpenOrder type to our Order interface.
   */
  async getOpenOrders(): Promise<Order[]> {
    const api = this.connectionManager.getApi();

    this.logger.debug('Fetching open orders from IBKR');

    try {
      const ibOpenOrders: OpenOrder[] = await api.getAllOpenOrders();

      const orders: Order[] = ibOpenOrders.map((oo) => ({
        orderId: String(oo.orderId),
        symbol: oo.contract.symbol ?? '',
        direction: fromIBKRAction(oo.order.action),
        quantity: oo.order.totalQuantity ?? 0,
        orderType: fromIBKROrderType(oo.order.orderType),
        status: oo.orderState?.status ?? oo.orderStatus?.status ?? 'Unknown',
      }));

      this.logger.info(
        { count: orders.length },
        'Open orders retrieved from IBKR',
      );

      return orders;
    } catch (err: unknown) {
      this.logger.error({ err }, 'Failed to fetch open orders from IBKR');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Fill monitoring
  // ---------------------------------------------------------------------------

  /**
   * Ensure that order monitoring is set up.
   *
   * Subscribes to IBKR connection errors so we can react to disconnects
   * and avoid polling a dead connection.
   */
  private ensureOrderMonitoring(): void {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // Forward connection errors for awareness
    this.errorForwardSub = this.connectionManager.errors$.subscribe({
      next: ({ code, message }) => {
        this.logger.warn(
          { code, message },
          'IBKR error received during order monitoring',
        );
      },
    });
  }

  /**
   * Poll IBKR execution details for a specific order until we see a fill
   * or reach the maximum number of attempts.
   *
   * This runs asynchronously after placeOrder returns. When a fill is
   * detected, it emits on the fills$ subject.
   */
  private async pollForFills(orderId: string): Promise<void> {
    const api = this.connectionManager.getApi();

    for (let attempt = 0; attempt < FILL_POLL_MAX_ATTEMPTS; attempt++) {
      // Wait before polling
      await this.delay(FILL_POLL_INTERVAL_MS);

      // If we stopped tracking this order (cancelled, etc.), stop polling
      if (!this.trackedOrderIds.has(orderId)) {
        this.logger.debug(
          { orderId, attempt },
          'Order no longer tracked, stopping fill poll',
        );
        return;
      }

      // Check if still connected
      if (!this.connectionManager.isConnected) {
        this.logger.warn(
          { orderId },
          'Connection lost during fill poll, will retry when reconnected',
        );
        continue;
      }

      try {
        const filter: ExecutionFilter = {};
        const executions: ExecutionDetail[] = await api.getExecutionDetails(filter);

        for (const detail of executions) {
          const execOrderId = String(detail.execution.orderId ?? '');
          const execId = detail.execution.execId ?? '';

          // Only process fills for our tracked order that we haven't emitted yet
          if (execOrderId !== orderId) continue;
          if (this.emittedFillExecIds.has(execId)) continue;

          const fillPriceDollars = detail.execution.price ?? 0;
          const filledQuantity = detail.execution.shares ?? 0;
          const execTime = detail.execution.time ?? '';

          if (filledQuantity <= 0) continue;

          // Parse execution time to UTC milliseconds
          const timestamp = this.parseExecTime(execTime);

          // Query commission for this execution
          let commissionCents = 0;
          try {
            const commissions = await api.getCommissionReport(filter);
            const matchingComm = commissions.find((c) => c.execId === execId);
            if (matchingComm?.commission != null) {
              commissionCents = dollarsToCents(matchingComm.commission);
            }
          } catch {
            // Commission data may not be available immediately; log and continue
            this.logger.debug(
              { orderId, execId },
              'Commission data not yet available',
            );
          }

          const fill: Fill = {
            orderId,
            fillPrice: dollarsToCents(fillPriceDollars),
            filledQuantity,
            timestamp,
            commission: commissionCents,
          };

          this.emittedFillExecIds.add(execId);
          this.fillSubject.next(fill);

          this.logger.info(
            {
              orderId,
              execId,
              fillPriceDollars,
              fillPriceCents: fill.fillPrice,
              filledQuantity,
              commissionCents,
            },
            'IBKR fill detected',
          );

          // Remove from tracked orders once filled
          this.trackedOrderIds.delete(orderId);
          return;
        }
      } catch (err: unknown) {
        this.logger.warn(
          { err, orderId, attempt },
          'Error polling for execution details',
        );
      }
    }

    // Exhausted poll attempts -- the order may still be working.
    // It stays in trackedOrderIds; consumer can query getOpenOrders() manually.
    this.logger.warn(
      { orderId, maxAttempts: FILL_POLL_MAX_ATTEMPTS },
      'Fill poll exhausted max attempts; order may still be active',
    );
  }

  /**
   * Parse an IBKR execution time string into a UTC millisecond timestamp.
   *
   * IBKR execution times are formatted as "YYYYMMDD  HH:MM:SS" (note double space)
   * or "YYYYMMDD HH:MM:SS" in the local timezone of the exchange.
   * We do our best to parse and default to Date.now() if parsing fails.
   */
  private parseExecTime(timeStr: string): number {
    if (!timeStr) return Date.now();

    try {
      // Normalize double spaces to single space
      const normalized = timeStr.replace(/\s+/g, ' ').trim();

      // Try parsing as "YYYYMMDD HH:MM:SS"
      const match = normalized.match(
        /^(\d{4})(\d{2})(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/,
      );

      if (match) {
        const [, year, month, day, hour, minute, second] = match;
        const isoStr = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
        const ts = new Date(isoStr).getTime();
        if (!isNaN(ts)) return ts;
      }

      // Fallback: try native Date parsing
      const ts = new Date(normalized).getTime();
      if (!isNaN(ts)) return ts;
    } catch {
      // Fall through to default
    }

    return Date.now();
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Release all resources held by this adapter.
   *
   * Unsubscribes from IBKR observables, completes the fills$ subject,
   * and clears all tracking state. After calling destroy(), the instance
   * must not be reused.
   */
  destroy(): void {
    if (this.orderMonitorSub) {
      this.orderMonitorSub.unsubscribe();
      this.orderMonitorSub = null;
    }

    if (this.errorForwardSub) {
      this.errorForwardSub.unsubscribe();
      this.errorForwardSub = null;
    }

    this.fillSubject.complete();
    this.trackedOrderIds.clear();
    this.emittedFillExecIds.clear();
    this.isMonitoring = false;

    this.logger.info('IBKROrderAdapter destroyed');
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Promise-based delay.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
