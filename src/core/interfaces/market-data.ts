import type { Observable } from 'rxjs';
import type { Candle } from '../models/index.js';

export type ConnectionState = 'CONNECTED' | 'DISCONNECTING' | 'RECONNECTING' | 'DISCONNECTED';

export interface ProviderError {
  readonly code: number;
  readonly message: string;
  readonly timestamp: number;
  readonly recoverable: boolean;
}

export interface ContractSpec {
  readonly conId: number;
  readonly symbol: string;
  readonly secType: string;
  readonly exchange: string;
  readonly currency: string;
}

export interface MarketDataProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  readonly isConnected: boolean;
  readonly connectionState$: Observable<ConnectionState>;
  readonly errors$: Observable<ProviderError>;
  resolveContract(symbol: string): Promise<ContractSpec>;
  getHistoricalBars(symbol: string, startUtc: number, endUtc: number): Promise<Candle[]>;
  subscribeBars(symbol: string): Observable<Candle>;
  unsubscribeBars(symbol: string): void;
}
