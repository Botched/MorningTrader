import { Observable, Subject, BehaviorSubject, EMPTY } from 'rxjs';
import type {
  MarketDataProvider,
  ConnectionState,
  ContractSpec,
  ProviderError,
} from '../../core/interfaces/index.js';
import type { Candle } from '../../core/models/index.js';
import { SimulatedClock, ReplayEngine } from './replay-engine.js';

/**
 * Backtest adapter implementing MarketDataProvider for deterministic replay.
 *
 * All prices are integer cents, all timestamps UTC milliseconds.
 * No wall-clock dependency — fully deterministic.
 * Uses SimulatedClock and ReplayEngine for bar replay.
 */
export class BacktestAdapter implements MarketDataProvider {
  private readonly clock: SimulatedClock;
  private readonly replayEngine: ReplayEngine;
  private connected = false;
  private readonly connectionStateSubject: BehaviorSubject<ConnectionState>;
  private readonly errorsSubject = new Subject<ProviderError>();
  private readonly bars: Map<string, readonly Candle[]> = new Map();

  constructor(clock: SimulatedClock) {
    this.clock = clock;
    this.replayEngine = new ReplayEngine(clock);
    this.connectionStateSubject = new BehaviorSubject<ConnectionState>('DISCONNECTED');
  }

  /**
   * Load bars for a symbol before subscribing.
   * Bars should already be sorted ascending by timestamp with prices in integer cents.
   */
  loadBars(symbol: string, bars: readonly Candle[]): void {
    this.bars.set(symbol, bars);
  }

  async connect(): Promise<void> {
    this.connected = true;
    this.connectionStateSubject.next('CONNECTED');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.connectionStateSubject.next('DISCONNECTED');
  }

  get isConnected(): boolean {
    return this.connected;
  }

  get connectionState$(): Observable<ConnectionState> {
    return this.connectionStateSubject.asObservable();
  }

  get errors$(): Observable<ProviderError> {
    return this.errorsSubject.asObservable();
  }

  async resolveContract(symbol: string): Promise<ContractSpec> {
    // Return a stub contract for backtesting — no real IBKR needed
    return {
      conId: 0,
      symbol,
      secType: 'STK',
      exchange: 'SMART',
      currency: 'USD',
    };
  }

  async getHistoricalBars(
    symbol: string,
    startUtc: number,
    endUtc: number,
  ): Promise<Candle[]> {
    const allBars = this.bars.get(symbol) ?? [];
    return allBars.filter(b => b.timestamp >= startUtc && b.timestamp < endUtc);
  }

  subscribeBars(symbol: string): Observable<Candle> {
    const bars = this.bars.get(symbol);
    if (!bars || bars.length === 0) return EMPTY;

    return new Observable<Candle>(subscriber => {
      this.replayEngine.replay(bars, {
        onBar: (bar) => subscriber.next(bar),
        onEnd: () => subscriber.complete(),
      });
    });
  }

  unsubscribeBars(_symbol: string): void {
    // No-op for backtest — replay is synchronous
  }

  /** Get the SimulatedClock used by this adapter */
  getClock(): SimulatedClock {
    return this.clock;
  }
}
