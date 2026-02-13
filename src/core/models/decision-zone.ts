import type { Candle } from './candle.js';

export type DecisionZoneStatus = 'PENDING' | 'DEFINED' | 'NO_TRADE_CHOPPY' | 'NO_TRADE_DEGENERATE' | 'EXPIRED';

export type DecisionZone = {
  readonly resistance: number;       // highest HIGH 09:30-10:00, int cents
  readonly support: number;          // lowest LOW 09:30-10:00, int cents
  readonly status: DecisionZoneStatus;
  readonly spread: number;           // resistance - support, int cents
  readonly definedAt: number;        // UTC ms
  readonly sourceBars: readonly Candle[];
  readonly premarketPrice: number;   // 0 if not recorded
};
