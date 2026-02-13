import type { Candle } from './candle.js';

export type SignalDirection = 'LONG' | 'SHORT';
export type SignalType = 'BREAK' | 'RETEST' | 'CONFIRMATION' | 'BREAK_FAILURE';

export type Signal = {
  readonly direction: SignalDirection;
  readonly type: SignalType;
  readonly timestamp: number;        // UTC ms
  readonly price: number;            // int cents
  readonly triggerCandle: Candle;
  readonly attemptNumber: number;
};
