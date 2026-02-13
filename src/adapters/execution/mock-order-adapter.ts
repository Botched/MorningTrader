import { Subject, Observable } from 'rxjs';
import type {
  OrderExecutionProvider,
  OrderRequest,
  OrderResult,
  Fill,
  Order,
} from '../../core/interfaces/index.js';
import type { Logger } from '../../services/logger.js';

export class MockOrderAdapter implements OrderExecutionProvider {
  readonly mode = 'MOCK' as const;

  private readonly fillSubject = new Subject<Fill>();
  readonly fills$: Observable<Fill> = this.fillSubject.asObservable();

  private readonly openOrders = new Map<string, Order>();
  private nextOrderId = 1;

  constructor(private readonly logger: Logger) {}

  /**
   * Place a mock order. Immediately returns SUBMITTED status,
   * then emits a Fill event at the order's limit price (or a simulated market price).
   */
  async placeOrder(order: OrderRequest): Promise<OrderResult> {
    const orderId = `MOCK-${this.nextOrderId++}`;

    // Log the order
    this.logger.info(
      {
        orderId,
        symbol: order.symbol,
        direction: order.direction,
        quantity: order.quantity,
        orderType: order.orderType,
      },
      'Mock order placed',
    );

    // Add to open orders
    const mockOrder: Order = {
      orderId,
      symbol: order.symbol,
      direction: order.direction,
      quantity: order.quantity,
      orderType: order.orderType,
      status: 'SUBMITTED',
    };
    this.openOrders.set(orderId, mockOrder);

    // Simulate immediate fill
    const fillPrice = order.limitPrice ?? order.stopPrice ?? 0;
    const fill: Fill = {
      orderId,
      fillPrice,
      filledQuantity: order.quantity,
      timestamp: Date.now(),
      commission: 0, // Zero commission in mock mode
    };

    // Remove from open orders (filled)
    this.openOrders.delete(orderId);

    // Emit fill
    this.fillSubject.next(fill);

    this.logger.info(
      { orderId, fillPrice, quantity: order.quantity },
      'Mock order filled',
    );

    return { orderId, status: 'SUBMITTED' };
  }

  async cancelOrder(orderId: string): Promise<void> {
    if (this.openOrders.has(orderId)) {
      this.openOrders.delete(orderId);
      this.logger.info({ orderId }, 'Mock order cancelled');
    }
  }

  async getOpenOrders(): Promise<Order[]> {
    return Array.from(this.openOrders.values());
  }

  /** Clean up resources */
  destroy(): void {
    this.fillSubject.complete();
    this.openOrders.clear();
  }
}
