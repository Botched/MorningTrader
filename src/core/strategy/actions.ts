import { assign } from 'xstate';
import type { StrategyMachineContext, StrategyEvent } from './events.js';
import type {
  Candle,
  Trade,
  TradeOutcome,
  TradeResult,
  TradeDirection,
  SignalType,
  SignalDirection,
  Signal,
  DecisionZone,
} from '../models/index.js';
import { getHighestHigh, getLowestLow } from '../../utils/bar-utils.js';
import {
  computeTargets,
  determineStopLevel,
  computeMaxFavorableR,
  computeMaxAdverseR,
} from '../risk/calculator.js';
import { computeRValue, computeRMultiple, roundR } from '../../utils/math.js';

// ---------------------------------------------------------------------------
// Type alias for the assign args shape used by XState v5
// ---------------------------------------------------------------------------

type ActionArgs = {
  context: StrategyMachineContext;
  event: StrategyEvent;
};

// ---------------------------------------------------------------------------
// Helpers (pure, internal)
// ---------------------------------------------------------------------------

/** Build a deterministic trade ID. */
function buildTradeId(
  date: string,
  symbol: string,
  direction: TradeDirection,
  attempt: number,
): string {
  return `${date}_${symbol}_${direction}_${attempt}`;
}

/** Extract the NEW_BAR candle from an event, or null if event is wrong type. */
function extractCandle(event: StrategyEvent): Candle | null {
  return event.type === 'NEW_BAR' ? event.candle : null;
}

/** Find the last OPEN trade for a given direction. */
function findActiveTrade(
  trades: readonly Trade[],
  direction: TradeDirection,
): Trade | null {
  for (let i = trades.length - 1; i >= 0; i--) {
    if (trades[i].direction === direction && trades[i].status === 'OPEN') return trades[i];
  }
  return null;
}

/** Create a new Signal object. */
function buildSignal(
  direction: SignalDirection,
  type: SignalType,
  candle: Candle,
  attempt: number,
): Signal {
  return {
    direction,
    type,
    timestamp: candle.timestamp,
    price: candle.close,
    triggerCandle: candle,
    attemptNumber: attempt,
  };
}

/** Replace a trade by ID within the trades array, returning a new array. */
function updateTradeInArray(
  trades: readonly Trade[],
  tradeId: string,
  updater: (t: Trade) => Trade,
): readonly Trade[] {
  return trades.map((t) => (t.id === tradeId ? updater(t) : t));
}

/** Get bars that occurred after a given timestamp (exclusive). */
function barsSinceEntry(
  allBars: readonly Candle[],
  entryTimestamp: number,
): readonly Candle[] {
  return allBars.filter((b) => b.timestamp > entryTimestamp);
}

/** Determine the first R-threshold reached (0 if none, else 1/2/3). */
function firstThreshold(r1: boolean, r2: boolean, r3: boolean): 0 | 1 | 2 | 3 {
  if (!r1) return 0;
  if (!r2) return 1;
  if (!r3) return 2;
  return 3;
}

/**
 * Build a TradeOutcome for a stop hit or session timeout.
 */
function buildOutcome(
  trade: Trade,
  result: TradeResult,
  exitPrice: number,
  exitTimestamp: number,
  barsAfterEntry: readonly Candle[],
  reached1R: boolean,
  reached2R: boolean,
  reached3R: boolean,
  ts1R: number,
  ts2R: number,
  ts3R: number,
  isStopHit: boolean,
): TradeOutcome {
  const realizedR = computeRMultiple(
    trade.entryPrice,
    exitPrice,
    trade.rValue,
    trade.direction,
  );
  return {
    tradeId: trade.id,
    result,
    maxFavorableR: computeMaxFavorableR(
      barsAfterEntry,
      trade.entryPrice,
      trade.rValue,
      trade.direction,
    ),
    maxAdverseR: computeMaxAdverseR(
      barsAfterEntry,
      trade.entryPrice,
      trade.rValue,
      trade.direction,
    ),
    exitPrice,
    exitTimestamp,
    realizedR,
    firstThresholdReached: firstThreshold(reached1R, reached2R, reached3R),
    timestamp1R: ts1R,
    timestamp2R: ts2R,
    timestamp3R: ts3R,
    timestampStop: isStopHit ? exitTimestamp : 0,
    barsHeld: barsAfterEntry.length,
  };
}

// ---------------------------------------------------------------------------
// Bar Accumulation
// ---------------------------------------------------------------------------

/** Append a NEW_BAR candle to context.allBars. */
export const accumulateBar = assign(
  ({ context, event }: ActionArgs): Partial<StrategyMachineContext> => {
    const candle = extractCandle(event);
    if (!candle) return {};
    return { allBars: [...context.allBars, candle] };
  },
);

/** Append a NEW_BAR candle to context.zoneBars (zone-building phase). */
export const accumulateZoneBar = assign(
  ({ context, event }: ActionArgs): Partial<StrategyMachineContext> => {
    const candle = extractCandle(event);
    if (!candle) return {};
    return { zoneBars: [...context.zoneBars, candle] };
  },
);

// ---------------------------------------------------------------------------
// Zone Computation
// ---------------------------------------------------------------------------

/** Compute the decision zone from accumulated zone bars. */
export const computeZone = assign(
  ({ context, event }: ActionArgs): Partial<StrategyMachineContext> => {
    const candle = extractCandle(event);
    const bars = context.zoneBars;
    if (bars.length === 0) return {};

    const resistance = getHighestHigh(bars);
    const support = getLowestLow(bars);
    const spread = resistance - support;
    const definedAt = candle ? candle.timestamp : bars[bars.length - 1].timestamp;

    const zone: DecisionZone = {
      resistance,
      support,
      spread,
      status: 'DEFINED',
      definedAt,
      sourceBars: bars as Candle[],
      premarketPrice: context.zone?.premarketPrice ?? 0,
    };
    return { zone };
  },
);

// ---------------------------------------------------------------------------
// Zone Evaluation
// ---------------------------------------------------------------------------

/** Mark the zone as choppy (no-trade). */
export const markZoneChoppy = assign(
  ({ context }: ActionArgs): Partial<StrategyMachineContext> => {
    if (!context.zone) return {};
    return { zone: { ...context.zone, status: 'NO_TRADE_CHOPPY' as const } };
  },
);

/** Mark the zone as degenerate (also no-trade). */
export const markZoneDegenerate = assign(
  ({ context }: ActionArgs): Partial<StrategyMachineContext> => {
    if (!context.zone) return {};
    return { zone: { ...context.zone, status: 'NO_TRADE_DEGENERATE' as const } };
  },
);

// ---------------------------------------------------------------------------
// Signal Recording — LONG
// ---------------------------------------------------------------------------

/** Record a LONG break signal: create BREAK signal, bump attempts, set phase. */
export const recordLongBreak = assign(
  ({ context, event }: ActionArgs): Partial<StrategyMachineContext> => {
    const candle = extractCandle(event);
    if (!candle) return {};
    const attempt = context.longBreakAttempts + 1;
    const signal = buildSignal('LONG', 'BREAK', candle, attempt);
    return {
      signals: [...context.signals, signal],
      longBreakAttempts: attempt,
      longPhase: 'breakDetected' as const,
      longBreakBar: candle,
    };
  },
);

/** Record a LONG retest signal. */
export const recordLongRetest = assign(
  ({ context, event }: ActionArgs): Partial<StrategyMachineContext> => {
    const candle = extractCandle(event);
    if (!candle) return {};
    const signal = buildSignal('LONG', 'RETEST', candle, context.longBreakAttempts);
    return {
      signals: [...context.signals, signal],
      longPhase: 'retestDetected' as const,
      longRetestBar: candle,
    };
  },
);

/** Record a LONG break failure: create BREAK_FAILURE signal, reset phase. */
export const recordLongBreakFailure = assign(
  ({ context, event }: ActionArgs): Partial<StrategyMachineContext> => {
    const candle = extractCandle(event);
    if (!candle) return {};
    const signal = buildSignal('LONG', 'BREAK_FAILURE', candle, context.longBreakAttempts);
    return {
      signals: [...context.signals, signal],
      longPhase: 'watching' as const,
      longBreakBar: null,
      longRetestBar: null,
    };
  },
);

// ---------------------------------------------------------------------------
// Signal Recording — SHORT
// ---------------------------------------------------------------------------

/** Record a SHORT break signal: create BREAK signal, bump attempts, set phase. */
export const recordShortBreak = assign(
  ({ context, event }: ActionArgs): Partial<StrategyMachineContext> => {
    const candle = extractCandle(event);
    if (!candle) return {};
    const attempt = context.shortBreakAttempts + 1;
    const signal = buildSignal('SHORT', 'BREAK', candle, attempt);
    return {
      signals: [...context.signals, signal],
      shortBreakAttempts: attempt,
      shortPhase: 'breakDetected' as const,
      shortBreakBar: candle,
    };
  },
);

/** Record a SHORT retest signal. */
export const recordShortRetest = assign(
  ({ context, event }: ActionArgs): Partial<StrategyMachineContext> => {
    const candle = extractCandle(event);
    if (!candle) return {};
    const signal = buildSignal('SHORT', 'RETEST', candle, context.shortBreakAttempts);
    return {
      signals: [...context.signals, signal],
      shortPhase: 'retestDetected' as const,
      shortRetestBar: candle,
    };
  },
);

/** Record a SHORT break failure: create BREAK_FAILURE signal, reset phase. */
export const recordShortBreakFailure = assign(
  ({ context, event }: ActionArgs): Partial<StrategyMachineContext> => {
    const candle = extractCandle(event);
    if (!candle) return {};
    const signal = buildSignal('SHORT', 'BREAK_FAILURE', candle, context.shortBreakAttempts);
    return {
      signals: [...context.signals, signal],
      shortPhase: 'watching' as const,
      shortBreakBar: null,
      shortRetestBar: null,
    };
  },
);

// ---------------------------------------------------------------------------
// Trade Entry — Confirmation
// ---------------------------------------------------------------------------

/**
 * Record a LONG confirmation: create CONFIRMATION signal, build Trade,
 * set activeDirection and longPhase.
 */
export const recordLongConfirmation = assign(
  ({ context, event }: ActionArgs): Partial<StrategyMachineContext> => {
    const candle = extractCandle(event);
    if (!candle || !context.zone) return {};

    const direction: TradeDirection = 'LONG';
    const entryPrice = candle.close;
    const stopLevel = determineStopLevel(context.zone, direction);
    const rValue = computeRValue(entryPrice, stopLevel);
    const targets = computeTargets(entryPrice, rValue, direction);

    const confirmationSignal = buildSignal(
      'LONG',
      'CONFIRMATION',
      candle,
      context.longBreakAttempts,
    );

    const tradeId = buildTradeId(
      context.date,
      context.symbol,
      direction,
      context.longBreakAttempts,
    );

    const trade: Trade = {
      id: tradeId,
      symbol: context.symbol,
      direction,
      entryPrice,
      stopLevel,
      currentStop: stopLevel,
      rValue,
      target1R: targets.target1R,
      target2R: targets.target2R,
      target3R: targets.target3R,
      entryTimestamp: candle.timestamp,
      status: 'OPEN',
      entrySignal: confirmationSignal,
    };

    return {
      signals: [...context.signals, confirmationSignal],
      trades: [...context.trades, trade],
      longPhase: 'positionOpen' as const,
      activeDirection: 'LONG' as const,
    };
  },
);

/**
 * Record a SHORT confirmation: create CONFIRMATION signal, build Trade,
 * set activeDirection and shortPhase.
 */
export const recordShortConfirmation = assign(
  ({ context, event }: ActionArgs): Partial<StrategyMachineContext> => {
    const candle = extractCandle(event);
    if (!candle || !context.zone) return {};

    const direction: TradeDirection = 'SHORT';
    const entryPrice = candle.close;
    const stopLevel = determineStopLevel(context.zone, direction);
    const rValue = computeRValue(entryPrice, stopLevel);
    const targets = computeTargets(entryPrice, rValue, direction);

    const confirmationSignal = buildSignal(
      'SHORT',
      'CONFIRMATION',
      candle,
      context.shortBreakAttempts,
    );

    const tradeId = buildTradeId(
      context.date,
      context.symbol,
      direction,
      context.shortBreakAttempts,
    );

    const trade: Trade = {
      id: tradeId,
      symbol: context.symbol,
      direction,
      entryPrice,
      stopLevel,
      currentStop: stopLevel,
      rValue,
      target1R: targets.target1R,
      target2R: targets.target2R,
      target3R: targets.target3R,
      entryTimestamp: candle.timestamp,
      status: 'OPEN',
      entrySignal: confirmationSignal,
    };

    return {
      signals: [...context.signals, confirmationSignal],
      trades: [...context.trades, trade],
      shortPhase: 'positionOpen' as const,
      activeDirection: 'SHORT' as const,
    };
  },
);

// ---------------------------------------------------------------------------
// Position Management — Trailing Stop
// ---------------------------------------------------------------------------

/**
 * When LONG reaches 1R: move currentStop to entryPrice (breakeven),
 * set reached1R, record timestamp1R.
 */
export const updateLongTrailingStop = assign(
  ({ context, event }: ActionArgs): Partial<StrategyMachineContext> => {
    const candle = extractCandle(event);
    const trade = findActiveTrade(context.trades, 'LONG');
    if (!trade || !candle) return {};

    const updatedTrades = updateTradeInArray(
      context.trades,
      trade.id,
      (t) => ({ ...t, currentStop: t.entryPrice }),
    );

    return {
      trades: updatedTrades,
      reached1R: true,
      timestamp1R: candle.timestamp,
    };
  },
);

/**
 * When SHORT reaches 1R: move currentStop to entryPrice (breakeven),
 * set reached1R, record timestamp1R.
 */
export const updateShortTrailingStop = assign(
  ({ context, event }: ActionArgs): Partial<StrategyMachineContext> => {
    const candle = extractCandle(event);
    const trade = findActiveTrade(context.trades, 'SHORT');
    if (!trade || !candle) return {};

    const updatedTrades = updateTradeInArray(
      context.trades,
      trade.id,
      (t) => ({ ...t, currentStop: t.entryPrice }),
    );

    return {
      trades: updatedTrades,
      reached1R: true,
      timestamp1R: candle.timestamp,
    };
  },
);

// ---------------------------------------------------------------------------
// Position Management — R Milestones
// ---------------------------------------------------------------------------

/** Record that LONG trade reached 2R. Backfills 1R if not yet recorded. */
export const recordLong2R = assign(
  ({ context, event }: ActionArgs): Partial<StrategyMachineContext> => {
    const candle = extractCandle(event);
    const trade = findActiveTrade(context.trades, 'LONG');
    if (!candle) return {};

    // Backfill 1R milestone and trailing stop if skipped (bar jumped past 1R)
    const ts1R = context.timestamp1R || candle.timestamp;

    // Move trailing stop to entry price if not already moved
    const trades = (trade && !context.reached1R)
      ? updateTradeInArray(context.trades, trade.id, (t) => ({ ...t, currentStop: t.entryPrice }))
      : undefined;

    return {
      ...(trades !== undefined ? { trades } : {}),
      reached1R: true,
      reached2R: true,
      timestamp1R: ts1R,
      timestamp2R: candle.timestamp,
    };
  },
);

/** Record that SHORT trade reached 2R. Backfills 1R if not yet recorded. */
export const recordShort2R = assign(
  ({ context, event }: ActionArgs): Partial<StrategyMachineContext> => {
    const candle = extractCandle(event);
    const trade = findActiveTrade(context.trades, 'SHORT');
    if (!candle) return {};

    // Backfill 1R milestone and trailing stop if skipped (bar jumped past 1R)
    const ts1R = context.timestamp1R || candle.timestamp;

    // Move trailing stop to entry price if not already moved
    const trades = (trade && !context.reached1R)
      ? updateTradeInArray(context.trades, trade.id, (t) => ({ ...t, currentStop: t.entryPrice }))
      : undefined;

    return {
      ...(trades !== undefined ? { trades } : {}),
      reached1R: true,
      reached2R: true,
      timestamp1R: ts1R,
      timestamp2R: candle.timestamp,
    };
  },
);

/** Record that LONG trade reached 3R: create WIN_3R outcome, resolve position. */
export const recordLong3R = assign(
  ({ context, event }: ActionArgs): Partial<StrategyMachineContext> => {
    const candle = extractCandle(event);
    const trade = findActiveTrade(context.trades, 'LONG');
    if (!trade || !candle) return {};

    const barsAfterEntry = barsSinceEntry(context.allBars, trade.entryTimestamp);
    const exitPrice = trade.target3R;
    // Backfill timestamps for any thresholds not yet recorded (single-bar jump)
    const ts1R = context.timestamp1R || candle.timestamp;
    const ts2R = context.timestamp2R || candle.timestamp;

    const outcome: TradeOutcome = {
      tradeId: trade.id,
      result: 'WIN_3R',
      maxFavorableR: computeMaxFavorableR(barsAfterEntry, trade.entryPrice, trade.rValue, 'LONG'),
      maxAdverseR: computeMaxAdverseR(barsAfterEntry, trade.entryPrice, trade.rValue, 'LONG'),
      exitPrice,
      exitTimestamp: candle.timestamp,
      realizedR: roundR(3),
      firstThresholdReached: 3,
      timestamp1R: ts1R,
      timestamp2R: ts2R,
      timestamp3R: candle.timestamp,
      timestampStop: 0,
      barsHeld: barsAfterEntry.length,
    };

    const updatedTrades = updateTradeInArray(
      context.trades,
      trade.id,
      (t) => ({ ...t, status: 'TARGET_HIT' as const }),
    );

    return {
      trades: updatedTrades,
      outcomes: [...context.outcomes, outcome],
      longPhase: 'resolved' as const,
      reached1R: true,
      reached2R: true,
      reached3R: true,
      timestamp1R: ts1R,
      timestamp2R: ts2R,
      timestamp3R: candle.timestamp,
    };
  },
);

/** Record that SHORT trade reached 3R: create WIN_3R outcome, resolve position. */
export const recordShort3R = assign(
  ({ context, event }: ActionArgs): Partial<StrategyMachineContext> => {
    const candle = extractCandle(event);
    const trade = findActiveTrade(context.trades, 'SHORT');
    if (!trade || !candle) return {};

    const barsAfterEntry = barsSinceEntry(context.allBars, trade.entryTimestamp);
    const exitPrice = trade.target3R;
    // Backfill timestamps for any thresholds not yet recorded (single-bar jump)
    const ts1R = context.timestamp1R || candle.timestamp;
    const ts2R = context.timestamp2R || candle.timestamp;

    const outcome: TradeOutcome = {
      tradeId: trade.id,
      result: 'WIN_3R',
      maxFavorableR: computeMaxFavorableR(barsAfterEntry, trade.entryPrice, trade.rValue, 'SHORT'),
      maxAdverseR: computeMaxAdverseR(barsAfterEntry, trade.entryPrice, trade.rValue, 'SHORT'),
      exitPrice,
      exitTimestamp: candle.timestamp,
      realizedR: roundR(3),
      firstThresholdReached: 3,
      timestamp1R: ts1R,
      timestamp2R: ts2R,
      timestamp3R: candle.timestamp,
      timestampStop: 0,
      barsHeld: barsAfterEntry.length,
    };

    const updatedTrades = updateTradeInArray(
      context.trades,
      trade.id,
      (t) => ({ ...t, status: 'TARGET_HIT' as const }),
    );

    return {
      trades: updatedTrades,
      outcomes: [...context.outcomes, outcome],
      shortPhase: 'resolved' as const,
      reached1R: true,
      reached2R: true,
      reached3R: true,
      timestamp1R: ts1R,
      timestamp2R: ts2R,
      timestamp3R: candle.timestamp,
    };
  },
);

// ---------------------------------------------------------------------------
// Exit — Stop Hit
// ---------------------------------------------------------------------------

/** Record LONG stop hit: LOSS or BREAKEVEN_STOP depending on whether 1R was reached. */
export const recordLongStopHit = assign(
  ({ context, event }: ActionArgs): Partial<StrategyMachineContext> => {
    const candle = extractCandle(event);
    const trade = findActiveTrade(context.trades, 'LONG');
    if (!trade || !candle) return {};

    const barsAfterEntry = barsSinceEntry(context.allBars, trade.entryTimestamp);
    const result: TradeResult = context.reached1R ? 'BREAKEVEN_STOP' : 'LOSS';
    const exitPrice = trade.currentStop;

    const outcome = buildOutcome(
      trade,
      result,
      exitPrice,
      candle.timestamp,
      barsAfterEntry,
      context.reached1R,
      context.reached2R,
      context.reached3R,
      context.timestamp1R,
      context.timestamp2R,
      context.timestamp3R,
      true,
    );

    const updatedTrades = updateTradeInArray(
      context.trades,
      trade.id,
      (t) => ({ ...t, status: 'STOPPED_OUT' as const }),
    );

    return {
      trades: updatedTrades,
      outcomes: [...context.outcomes, outcome],
      longPhase: 'resolved' as const,
    };
  },
);

/** Record SHORT stop hit: LOSS or BREAKEVEN_STOP depending on whether 1R was reached. */
export const recordShortStopHit = assign(
  ({ context, event }: ActionArgs): Partial<StrategyMachineContext> => {
    const candle = extractCandle(event);
    const trade = findActiveTrade(context.trades, 'SHORT');
    if (!trade || !candle) return {};

    const barsAfterEntry = barsSinceEntry(context.allBars, trade.entryTimestamp);
    const result: TradeResult = context.reached1R ? 'BREAKEVEN_STOP' : 'LOSS';
    const exitPrice = trade.currentStop;

    const outcome = buildOutcome(
      trade,
      result,
      exitPrice,
      candle.timestamp,
      barsAfterEntry,
      context.reached1R,
      context.reached2R,
      context.reached3R,
      context.timestamp1R,
      context.timestamp2R,
      context.timestamp3R,
      true,
    );

    const updatedTrades = updateTradeInArray(
      context.trades,
      trade.id,
      (t) => ({ ...t, status: 'STOPPED_OUT' as const }),
    );

    return {
      trades: updatedTrades,
      outcomes: [...context.outcomes, outcome],
      shortPhase: 'resolved' as const,
    };
  },
);

// ---------------------------------------------------------------------------
// Exit — Session Timeout
// ---------------------------------------------------------------------------

/**
 * Record session timeout for any open position.
 * Closes whichever direction has phase === 'positionOpen'.
 */
export const recordSessionTimeout = assign(
  ({ context }: ActionArgs): Partial<StrategyMachineContext> => {
    const lastBar =
      context.allBars.length > 0
        ? context.allBars[context.allBars.length - 1]
        : null;

    let updatedTrades = context.trades;
    const newOutcomes: TradeOutcome[] = [];
    let longPhase = context.longPhase;
    let shortPhase = context.shortPhase;

    // Handle open LONG position
    if (context.longPhase === 'positionOpen') {
      const trade = findActiveTrade(context.trades, 'LONG');
      if (trade && lastBar) {
        const barsAfterEntry = barsSinceEntry(context.allBars, trade.entryTimestamp);
        const exitPrice = lastBar.close;

        const outcome = buildOutcome(
          trade,
          'SESSION_TIMEOUT',
          exitPrice,
          lastBar.timestamp,
          barsAfterEntry,
          context.reached1R,
          context.reached2R,
          context.reached3R,
          context.timestamp1R,
          context.timestamp2R,
          context.timestamp3R,
          false,
        );

        updatedTrades = updateTradeInArray(
          updatedTrades,
          trade.id,
          (t) => ({ ...t, status: 'SESSION_EXPIRED' as const }),
        );
        newOutcomes.push(outcome);
        longPhase = 'resolved';
      }
    }

    // Handle open SHORT position
    if (context.shortPhase === 'positionOpen') {
      const trade = findActiveTrade(updatedTrades, 'SHORT');
      if (trade && lastBar) {
        const barsAfterEntry = barsSinceEntry(context.allBars, trade.entryTimestamp);
        const exitPrice = lastBar.close;

        const outcome = buildOutcome(
          trade,
          'SESSION_TIMEOUT',
          exitPrice,
          lastBar.timestamp,
          barsAfterEntry,
          context.reached1R,
          context.reached2R,
          context.reached3R,
          context.timestamp1R,
          context.timestamp2R,
          context.timestamp3R,
          false,
        );

        updatedTrades = updateTradeInArray(
          updatedTrades,
          trade.id,
          (t) => ({ ...t, status: 'SESSION_EXPIRED' as const }),
        );
        newOutcomes.push(outcome);
        shortPhase = 'resolved';
      }
    }

    return {
      trades: updatedTrades,
      outcomes: [...context.outcomes, ...newOutcomes],
      longPhase,
      shortPhase,
    };
  },
);
