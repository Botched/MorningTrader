import type { Signal } from './signal.js';

export type TradeDirection = 'LONG' | 'SHORT';
export type TradeStatus = 'OPEN' | 'STOPPED_OUT' | 'TARGET_HIT' | 'SESSION_EXPIRED';

export type Trade = {
  readonly id: string;               // {date}_{symbol}_{direction}_{attemptN}
  readonly symbol: string;
  readonly direction: TradeDirection;
  readonly entryPrice: number;       // confirmation candle CLOSE, int cents
  readonly stopLevel: number;        // initial stop: resistance (long) / support (short)
  readonly currentStop: number;      // moves to entryPrice after 1R
  readonly rValue: number;           // |entry - stop|, int cents
  readonly target1R: number;         // int cents
  readonly target2R: number;         // int cents
  readonly target3R: number;         // int cents
  readonly entryTimestamp: number;   // UTC ms
  readonly status: TradeStatus;
  readonly entrySignal: Signal;
};

export type TradeResult = 'LOSS' | 'BREAKEVEN_STOP' | 'WIN_2R' | 'WIN_3R' | 'SESSION_TIMEOUT';

export type TradeOutcome = {
  readonly tradeId: string;
  readonly result: TradeResult;
  readonly maxFavorableR: number;    // uses bar HIGH (long) or LOW (short)
  readonly maxAdverseR: number;     // uses bar LOW (long) or HIGH (short)
  readonly exitPrice: number;       // int cents
  readonly exitTimestamp: number;   // UTC ms
  readonly realizedR: number;       // float, rounded to 2 decimals
  readonly firstThresholdReached: 0 | 1 | 2 | 3;
  readonly timestamp1R: number;    // 0 if never
  readonly timestamp2R: number;
  readonly timestamp3R: number;
  readonly timestampStop: number;
  readonly barsHeld: number;
};
