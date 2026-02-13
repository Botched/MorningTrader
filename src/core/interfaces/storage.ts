import type { SessionContext, Trade, TradeOutcome, Signal, Candle } from '../models/index.js';

export interface StorageProvider {
  initialize(): void;
  saveSession(session: SessionContext): number;
  getSession(date: string, symbol: string): SessionContext | null;
  hasCompletedSession(date: string, symbol: string): boolean;
  saveTrade(trade: Trade, sessionId: number): void;
  saveTradeOutcome(outcome: TradeOutcome): void;
  saveTradeWithOutcome(trade: Trade, outcome: TradeOutcome, sessionId: number): void;
  saveSignals(signals: readonly Signal[], sessionId: number): void;
  saveBars(bars: readonly Candle[], sessionId: number): void;
  getBarsBySessionId(sessionId: number): Candle[];
  getTradesByDateRange(from: string, to: string, symbol?: string): Trade[];
  getOutcomesByDateRange(from: string, to: string, symbol?: string): TradeOutcome[];
  getSessionsByDateRange(from: string, to: string, symbol?: string): SessionContext[];
  close(): void;
}
