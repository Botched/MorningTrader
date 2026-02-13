import type { Candle } from './candle.js';
import type { DecisionZone } from './decision-zone.js';
import type { Signal } from './signal.js';
import type { Trade, TradeOutcome } from './trade.js';

export type SessionStatus =
  | 'WAITING'
  | 'BUILDING_ZONE'
  | 'MONITORING'
  | 'NO_TRADE'
  | 'COMPLETE'
  | 'INTERRUPTED'
  | 'ERROR';

export type ExecutionMode = 'LIVE' | 'MOCK';

export type SessionContext = {
  readonly date: string;             // YYYY-MM-DD (ET)
  readonly symbol: string;
  readonly zone: DecisionZone | null;
  readonly signals: readonly Signal[];
  readonly trades: readonly Trade[];
  readonly outcomes: readonly TradeOutcome[];
  readonly allBars: readonly Candle[];
  readonly status: SessionStatus;
  readonly isBacktest: boolean;
  readonly executionMode: ExecutionMode;
  readonly startedAt: number;        // UTC ms
  readonly completedAt: number;      // UTC ms, 0 if not completed
  readonly error: string | null;
};
