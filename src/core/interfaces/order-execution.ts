import type { Observable } from 'rxjs';

export type Direction = 'LONG' | 'SHORT';
export type OrderType = 'MARKET' | 'LIMIT';
export type ExecutionMode = 'LIVE' | 'MOCK';

export interface OrderRequest {
  readonly symbol: string;
  readonly direction: Direction;
  readonly quantity: number;
  readonly orderType: OrderType;
  readonly limitPrice?: number;
  readonly stopPrice?: number;
}

export interface OrderResult {
  readonly orderId: string;
  readonly status: 'SUBMITTED' | 'REJECTED';
  readonly reason?: string;
}

export interface Fill {
  readonly orderId: string;
  readonly fillPrice: number;   // int cents
  readonly filledQuantity: number;
  readonly timestamp: number;   // UTC ms
  readonly commission: number;  // int cents
}

export interface Order {
  readonly orderId: string;
  readonly symbol: string;
  readonly direction: Direction;
  readonly quantity: number;
  readonly orderType: OrderType;
  readonly status: string;
}

export interface OrderExecutionProvider {
  readonly mode: ExecutionMode;
  placeOrder(order: OrderRequest): Promise<OrderResult>;
  cancelOrder(orderId: string): Promise<void>;
  getOpenOrders(): Promise<Order[]>;
  readonly fills$: Observable<Fill>;
}
