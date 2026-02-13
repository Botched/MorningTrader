import type { Candle, DecisionZone, Signal, Trade, TradeOutcome } from '../models/index.js';

// ---------------------------------------------------------------------------
// Strategy Events — fed into the strategy state machine
// ---------------------------------------------------------------------------

export type StrategyEvent =
  | { readonly type: 'NEW_BAR'; readonly candle: Candle }
  | { readonly type: 'SESSION_START'; readonly date: string; readonly symbol: string }
  | { readonly type: 'SESSION_END' }
  | { readonly type: 'ERROR'; readonly message: string };

// ---------------------------------------------------------------------------
// Strategy Machine Context — full state carried by the machine
// ---------------------------------------------------------------------------

export type StrategyMachineContext = {
  // Session info
  readonly date: string;
  readonly symbol: string;

  // Zone
  readonly zone: DecisionZone | null;
  readonly zoneBars: readonly Candle[];

  // Signals and trades
  readonly signals: readonly Signal[];
  readonly trades: readonly Trade[];
  readonly outcomes: readonly TradeOutcome[];
  readonly allBars: readonly Candle[];

  // Active direction (one-side-only enforcement)
  readonly activeDirection: 'LONG' | 'SHORT' | null;

  // Long track state
  readonly longBreakAttempts: number;
  readonly longPhase:
    | 'watching'
    | 'breakDetected'
    | 'retestDetected'
    | 'positionOpen'
    | 'resolved'
    | 'superseded'
    | 'maxAttemptsExhausted';
  readonly longBreakBar: Candle | null;
  readonly longRetestBar: Candle | null;

  // Short track state
  readonly shortBreakAttempts: number;
  readonly shortPhase:
    | 'watching'
    | 'breakDetected'
    | 'retestDetected'
    | 'positionOpen'
    | 'resolved'
    | 'superseded'
    | 'maxAttemptsExhausted';
  readonly shortBreakBar: Candle | null;
  readonly shortRetestBar: Candle | null;

  // R-target tracking (for active trade)
  readonly reached1R: boolean;
  readonly reached2R: boolean;
  readonly reached3R: boolean;
  readonly timestamp1R: number;
  readonly timestamp2R: number;
  readonly timestamp3R: number;

  // Config (injected at start)
  readonly maxBreakAttempts: number;
  readonly minZoneSpreadCents: number;
  readonly maxZoneSpreadPercent: number;

  // Status
  readonly error: string | null;
};

// ---------------------------------------------------------------------------
// Strategy Machine Input — provided when spawning a new machine instance
// ---------------------------------------------------------------------------

export type StrategyMachineInput = {
  readonly date: string;
  readonly symbol: string;
  readonly maxBreakAttempts?: number;
  readonly minZoneSpreadCents?: number;
  readonly maxZoneSpreadPercent?: number;
};
