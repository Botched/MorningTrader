import { describe, it, expect } from 'vitest';
import {
  accumulateBar,
  accumulateZoneBar,
  computeZone,
  markZoneChoppy,
  markZoneDegenerate,
  recordLongBreak,
  recordLongRetest,
  recordLongBreakFailure,
  recordShortBreak,
  recordShortRetest,
  recordShortBreakFailure,
  recordLongConfirmation,
  recordShortConfirmation,
  updateLongTrailingStop,
  updateShortTrailingStop,
  recordLong2R,
  recordShort2R,
  recordLong3R,
  recordShort3R,
  recordLongStopHit,
  recordShortStopHit,
  recordSessionTimeout,
} from '@core/strategy/actions.js';
import type { StrategyMachineContext, StrategyEvent } from '@core/strategy/events.js';
import type { Candle } from '@core/models/candle.js';
import type { DecisionZone } from '@core/models/decision-zone.js';
import type { Trade } from '@core/models/trade.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal Candle. Prices in integer cents. */
function makeCandle(overrides: Partial<Candle> = {}): Candle {
  return {
    timestamp: 1_700_000_000_000,
    open: 15000,
    high: 15100,
    low: 14900,
    close: 15050,
    volume: 1000,
    completed: true,
    barSizeMinutes: 5,
    ...overrides,
  };
}

/** Create a minimal DecisionZone. */
function makeZone(overrides: Partial<DecisionZone> = {}): DecisionZone {
  return {
    resistance: 15100,
    support: 14900,
    spread: 200,
    status: 'DEFINED',
    definedAt: 1_700_000_000_000,
    sourceBars: [],
    premarketPrice: 0,
    ...overrides,
  };
}

/** Create a minimal OPEN Trade for testing. */
function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: '2024-01-02_SPY_LONG_1',
    symbol: 'SPY',
    direction: 'LONG',
    entryPrice: 15200,
    stopLevel: 15100,
    currentStop: 15100,
    rValue: 100,
    target1R: 15300,
    target2R: 15400,
    target3R: 15500,
    entryTimestamp: 1_700_000_000_000,
    status: 'OPEN',
    entrySignal: {
      direction: 'LONG',
      type: 'CONFIRMATION',
      timestamp: 1_700_000_000_000,
      price: 15200,
      triggerCandle: makeCandle(),
      attemptNumber: 1,
    },
    ...overrides,
  };
}

/** Build a minimal StrategyMachineContext with sensible defaults. */
function makeContext(overrides: Partial<StrategyMachineContext> = {}): StrategyMachineContext {
  return {
    date: '2024-01-02',
    symbol: 'SPY',
    zone: null,
    zoneBars: [],
    signals: [],
    trades: [],
    outcomes: [],
    allBars: [],
    activeDirection: null,
    longBreakAttempts: 0,
    longPhase: 'watching',
    longBreakBar: null,
    longRetestBar: null,
    shortBreakAttempts: 0,
    shortPhase: 'watching',
    shortBreakBar: null,
    shortRetestBar: null,
    reached1R: false,
    reached2R: false,
    reached3R: false,
    timestamp1R: 0,
    timestamp2R: 0,
    timestamp3R: 0,
    maxBreakAttempts: 2,
    minZoneSpreadCents: 50,
    maxZoneSpreadPercent: 5,
    error: null,
    ...overrides,
  };
}

/** Build a NEW_BAR event. */
function newBarEvent(candle: Candle): StrategyEvent {
  return { type: 'NEW_BAR', candle };
}

/**
 * Extract the assignment function from an XState v5 assign action.
 *
 * In XState v5, `assign(fn)` creates an action object whose internal
 * assignment function is stored on a property. We try known property
 * names to be resilient across minor XState versions.
 */
function getAssignFn(
  action: unknown,
): (args: { context: StrategyMachineContext; event: StrategyEvent }) => Partial<StrategyMachineContext> {
  const a = action as Record<string, unknown>;

  // XState v5 stores the assignment function on different properties depending on version
  if (typeof a.assignment === 'function') {
    return a.assignment as typeof getAssignFn extends (...args: infer _) => infer R ? R : never;
  }

  // Some builds store it under params.assignment
  if (a.params && typeof (a.params as Record<string, unknown>).assignment === 'function') {
    return (a.params as Record<string, unknown>).assignment as ReturnType<typeof getAssignFn>;
  }

  throw new Error(
    `Could not extract assignment function from action. Keys: ${Object.keys(a).join(', ')}`,
  );
}

/** Convenience: call an assign action with context and event, return partial. */
function callAction(
  action: unknown,
  context: StrategyMachineContext,
  event: StrategyEvent,
): Partial<StrategyMachineContext> {
  const fn = getAssignFn(action);
  return fn({ context, event });
}

// ===========================================================================
// accumulateBar
// ===========================================================================
describe('accumulateBar', () => {
  it('appends a NEW_BAR candle to allBars', () => {
    const candle = makeCandle({ timestamp: 100 });
    const ctx = makeContext({ allBars: [] });
    const result = callAction(accumulateBar, ctx, newBarEvent(candle));
    expect(result.allBars).toHaveLength(1);
    expect(result.allBars![0]).toBe(candle);
  });

  it('preserves existing bars and appends', () => {
    const bar1 = makeCandle({ timestamp: 100 });
    const bar2 = makeCandle({ timestamp: 200 });
    const ctx = makeContext({ allBars: [bar1] });
    const result = callAction(accumulateBar, ctx, newBarEvent(bar2));
    expect(result.allBars).toHaveLength(2);
    expect(result.allBars![0]).toBe(bar1);
    expect(result.allBars![1]).toBe(bar2);
  });

  it('returns empty object for non-NEW_BAR event', () => {
    const ctx = makeContext({ allBars: [] });
    const result = callAction(accumulateBar, ctx, { type: 'SESSION_END' });
    expect(result).toEqual({});
  });
});

// ===========================================================================
// accumulateZoneBar
// ===========================================================================
describe('accumulateZoneBar', () => {
  it('appends a NEW_BAR candle to zoneBars', () => {
    const candle = makeCandle({ timestamp: 100 });
    const ctx = makeContext({ zoneBars: [] });
    const result = callAction(accumulateZoneBar, ctx, newBarEvent(candle));
    expect(result.zoneBars).toHaveLength(1);
    expect(result.zoneBars![0]).toBe(candle);
  });

  it('preserves existing zone bars', () => {
    const bar1 = makeCandle({ timestamp: 100 });
    const bar2 = makeCandle({ timestamp: 200 });
    const ctx = makeContext({ zoneBars: [bar1] });
    const result = callAction(accumulateZoneBar, ctx, newBarEvent(bar2));
    expect(result.zoneBars).toHaveLength(2);
    expect(result.zoneBars![0]).toBe(bar1);
    expect(result.zoneBars![1]).toBe(bar2);
  });

  it('returns empty object for non-NEW_BAR event', () => {
    const ctx = makeContext({ zoneBars: [] });
    const result = callAction(accumulateZoneBar, ctx, { type: 'SESSION_END' });
    expect(result).toEqual({});
  });
});

// ===========================================================================
// computeZone
// ===========================================================================
describe('computeZone', () => {
  it('computes zone from accumulated bars', () => {
    const bars = [
      makeCandle({ high: 15200, low: 14800 }),
      makeCandle({ high: 15100, low: 14900 }),
    ];
    const triggerCandle = makeCandle({ timestamp: 999 });
    const ctx = makeContext({ zoneBars: bars });
    const result = callAction(computeZone, ctx, newBarEvent(triggerCandle));

    expect(result.zone).toBeDefined();
    expect(result.zone!.resistance).toBe(15200); // highest high
    expect(result.zone!.support).toBe(14800);    // lowest low
    expect(result.zone!.spread).toBe(400);       // 15200 - 14800
    expect(result.zone!.status).toBe('DEFINED');
    expect(result.zone!.definedAt).toBe(999);    // from trigger candle
  });

  it('uses last zoneBars timestamp if event has no candle', () => {
    const bars = [makeCandle({ timestamp: 500, high: 15100, low: 14900 })];
    const ctx = makeContext({ zoneBars: bars });
    const result = callAction(computeZone, ctx, { type: 'SESSION_END' });
    // extractCandle returns null for SESSION_END, falls back to last bar timestamp
    expect(result.zone!.definedAt).toBe(500);
  });

  it('returns empty object when zoneBars is empty', () => {
    const ctx = makeContext({ zoneBars: [] });
    const result = callAction(computeZone, ctx, newBarEvent(makeCandle()));
    expect(result).toEqual({});
  });

  it('preserves premarketPrice from existing zone', () => {
    const bars = [makeCandle({ high: 15100, low: 14900 })];
    const ctx = makeContext({
      zoneBars: bars,
      zone: makeZone({ premarketPrice: 15050 }),
    });
    const result = callAction(computeZone, ctx, newBarEvent(makeCandle()));
    expect(result.zone!.premarketPrice).toBe(15050);
  });

  it('sets premarketPrice to 0 when no existing zone', () => {
    const bars = [makeCandle({ high: 15100, low: 14900 })];
    const ctx = makeContext({ zoneBars: bars, zone: null });
    const result = callAction(computeZone, ctx, newBarEvent(makeCandle()));
    expect(result.zone!.premarketPrice).toBe(0);
  });

  it('sets sourceBars to the zoneBars from context', () => {
    const bars = [
      makeCandle({ high: 15200, low: 14800 }),
      makeCandle({ high: 15100, low: 14900 }),
    ];
    const ctx = makeContext({ zoneBars: bars });
    const result = callAction(computeZone, ctx, newBarEvent(makeCandle()));
    expect(result.zone!.sourceBars).toHaveLength(2);
  });
});

// ===========================================================================
// markZoneChoppy / markZoneDegenerate
// ===========================================================================
describe('markZoneChoppy', () => {
  it('sets zone status to NO_TRADE_CHOPPY', () => {
    const ctx = makeContext({ zone: makeZone({ status: 'DEFINED' }) });
    const result = callAction(markZoneChoppy, ctx, { type: 'SESSION_END' });
    expect(result.zone!.status).toBe('NO_TRADE_CHOPPY');
  });

  it('preserves other zone fields', () => {
    const zone = makeZone({ resistance: 15100, support: 14900, spread: 200 });
    const ctx = makeContext({ zone });
    const result = callAction(markZoneChoppy, ctx, { type: 'SESSION_END' });
    expect(result.zone!.resistance).toBe(15100);
    expect(result.zone!.support).toBe(14900);
    expect(result.zone!.spread).toBe(200);
  });

  it('returns empty object when zone is null', () => {
    const ctx = makeContext({ zone: null });
    const result = callAction(markZoneChoppy, ctx, { type: 'SESSION_END' });
    expect(result).toEqual({});
  });
});

describe('markZoneDegenerate', () => {
  it('sets zone status to NO_TRADE_DEGENERATE', () => {
    const ctx = makeContext({ zone: makeZone({ status: 'DEFINED' }) });
    const result = callAction(markZoneDegenerate, ctx, { type: 'SESSION_END' });
    expect(result.zone!.status).toBe('NO_TRADE_DEGENERATE');
  });

  it('returns empty object when zone is null', () => {
    const ctx = makeContext({ zone: null });
    const result = callAction(markZoneDegenerate, ctx, { type: 'SESSION_END' });
    expect(result).toEqual({});
  });
});

// ===========================================================================
// LONG Signal Recording
// ===========================================================================
describe('recordLongBreak', () => {
  it('creates BREAK signal, bumps attempts, sets phase and breakBar', () => {
    const candle = makeCandle({ timestamp: 1000, close: 15200 });
    const ctx = makeContext({ longBreakAttempts: 0, signals: [] });
    const result = callAction(recordLongBreak, ctx, newBarEvent(candle));

    expect(result.longBreakAttempts).toBe(1);
    expect(result.longPhase).toBe('breakDetected');
    expect(result.longBreakBar).toBe(candle);
    expect(result.signals).toHaveLength(1);

    const signal = result.signals![0];
    expect(signal.direction).toBe('LONG');
    expect(signal.type).toBe('BREAK');
    expect(signal.price).toBe(15200);
    expect(signal.timestamp).toBe(1000);
    expect(signal.attemptNumber).toBe(1);
    expect(signal.triggerCandle).toBe(candle);
  });

  it('increments existing attempt count', () => {
    const candle = makeCandle();
    const ctx = makeContext({ longBreakAttempts: 1, signals: [] });
    const result = callAction(recordLongBreak, ctx, newBarEvent(candle));
    expect(result.longBreakAttempts).toBe(2);
    expect(result.signals![0].attemptNumber).toBe(2);
  });

  it('returns empty object for non-NEW_BAR event', () => {
    const ctx = makeContext();
    const result = callAction(recordLongBreak, ctx, { type: 'SESSION_END' });
    expect(result).toEqual({});
  });
});

describe('recordLongRetest', () => {
  it('creates RETEST signal, sets phase and retestBar', () => {
    const candle = makeCandle({ timestamp: 2000, close: 15100 });
    const ctx = makeContext({ longBreakAttempts: 1, signals: [] });
    const result = callAction(recordLongRetest, ctx, newBarEvent(candle));

    expect(result.longPhase).toBe('retestDetected');
    expect(result.longRetestBar).toBe(candle);
    expect(result.signals).toHaveLength(1);

    const signal = result.signals![0];
    expect(signal.direction).toBe('LONG');
    expect(signal.type).toBe('RETEST');
    expect(signal.attemptNumber).toBe(1);
  });
});

describe('recordLongBreakFailure', () => {
  it('creates BREAK_FAILURE signal, resets phase and bars', () => {
    const candle = makeCandle({ timestamp: 3000 });
    const ctx = makeContext({
      longBreakAttempts: 1,
      signals: [],
      longBreakBar: makeCandle(),
      longRetestBar: makeCandle(),
    });
    const result = callAction(recordLongBreakFailure, ctx, newBarEvent(candle));

    expect(result.longPhase).toBe('watching');
    expect(result.longBreakBar).toBeNull();
    expect(result.longRetestBar).toBeNull();
    expect(result.signals).toHaveLength(1);
    expect(result.signals![0].type).toBe('BREAK_FAILURE');
    expect(result.signals![0].direction).toBe('LONG');
  });
});

// ===========================================================================
// SHORT Signal Recording
// ===========================================================================
describe('recordShortBreak', () => {
  it('creates BREAK signal, bumps attempts, sets phase and breakBar', () => {
    const candle = makeCandle({ timestamp: 1000, close: 14800 });
    const ctx = makeContext({ shortBreakAttempts: 0, signals: [] });
    const result = callAction(recordShortBreak, ctx, newBarEvent(candle));

    expect(result.shortBreakAttempts).toBe(1);
    expect(result.shortPhase).toBe('breakDetected');
    expect(result.shortBreakBar).toBe(candle);
    expect(result.signals).toHaveLength(1);

    const signal = result.signals![0];
    expect(signal.direction).toBe('SHORT');
    expect(signal.type).toBe('BREAK');
    expect(signal.price).toBe(14800);
    expect(signal.attemptNumber).toBe(1);
  });

  it('increments existing attempt count', () => {
    const candle = makeCandle();
    const ctx = makeContext({ shortBreakAttempts: 1, signals: [] });
    const result = callAction(recordShortBreak, ctx, newBarEvent(candle));
    expect(result.shortBreakAttempts).toBe(2);
    expect(result.signals![0].attemptNumber).toBe(2);
  });
});

describe('recordShortRetest', () => {
  it('creates RETEST signal, sets phase and retestBar', () => {
    const candle = makeCandle({ timestamp: 2000, close: 14900 });
    const ctx = makeContext({ shortBreakAttempts: 1, signals: [] });
    const result = callAction(recordShortRetest, ctx, newBarEvent(candle));

    expect(result.shortPhase).toBe('retestDetected');
    expect(result.shortRetestBar).toBe(candle);
    expect(result.signals![0].direction).toBe('SHORT');
    expect(result.signals![0].type).toBe('RETEST');
  });
});

describe('recordShortBreakFailure', () => {
  it('creates BREAK_FAILURE signal, resets phase and bars', () => {
    const candle = makeCandle({ timestamp: 3000 });
    const ctx = makeContext({
      shortBreakAttempts: 1,
      signals: [],
      shortBreakBar: makeCandle(),
      shortRetestBar: makeCandle(),
    });
    const result = callAction(recordShortBreakFailure, ctx, newBarEvent(candle));

    expect(result.shortPhase).toBe('watching');
    expect(result.shortBreakBar).toBeNull();
    expect(result.shortRetestBar).toBeNull();
    expect(result.signals![0].type).toBe('BREAK_FAILURE');
    expect(result.signals![0].direction).toBe('SHORT');
  });
});

// ===========================================================================
// Trade Entry — Confirmation
// ===========================================================================
describe('recordLongConfirmation', () => {
  it('creates CONFIRMATION signal, trade, sets activeDirection and phase', () => {
    const candle = makeCandle({ timestamp: 5000, close: 15200 });
    const zone = makeZone({ resistance: 15100, support: 14900 });
    const ctx = makeContext({
      zone,
      longBreakAttempts: 1,
      signals: [],
      trades: [],
    });
    const result = callAction(recordLongConfirmation, ctx, newBarEvent(candle));

    expect(result.longPhase).toBe('positionOpen');
    expect(result.activeDirection).toBe('LONG');

    // Confirmation signal
    expect(result.signals).toHaveLength(1);
    expect(result.signals![0].direction).toBe('LONG');
    expect(result.signals![0].type).toBe('CONFIRMATION');

    // Trade
    expect(result.trades).toHaveLength(1);
    const trade = result.trades![0] as Trade;
    expect(trade.direction).toBe('LONG');
    expect(trade.entryPrice).toBe(15200);
    expect(trade.status).toBe('OPEN');
    // For LONG: stop at resistance = 15100, rValue = |15200 - 15100| = 100
    expect(trade.stopLevel).toBe(15100);
    expect(trade.currentStop).toBe(15100);
    expect(trade.rValue).toBe(100);
    // Targets: 1R=15300, 2R=15400, 3R=15500
    expect(trade.target1R).toBe(15300);
    expect(trade.target2R).toBe(15400);
    expect(trade.target3R).toBe(15500);
    expect(trade.entryTimestamp).toBe(5000);
    expect(trade.id).toBe('2024-01-02_SPY_LONG_1');
  });

  it('returns empty object when zone is null', () => {
    const candle = makeCandle();
    const ctx = makeContext({ zone: null });
    const result = callAction(recordLongConfirmation, ctx, newBarEvent(candle));
    expect(result).toEqual({});
  });

  it('returns empty object for non-NEW_BAR event', () => {
    const ctx = makeContext({ zone: makeZone() });
    const result = callAction(recordLongConfirmation, ctx, { type: 'SESSION_END' });
    expect(result).toEqual({});
  });
});

describe('recordShortConfirmation', () => {
  it('creates CONFIRMATION signal, trade, sets activeDirection and phase', () => {
    const candle = makeCandle({ timestamp: 5000, close: 14800 });
    const zone = makeZone({ resistance: 15100, support: 14900 });
    const ctx = makeContext({
      zone,
      shortBreakAttempts: 1,
      signals: [],
      trades: [],
    });
    const result = callAction(recordShortConfirmation, ctx, newBarEvent(candle));

    expect(result.shortPhase).toBe('positionOpen');
    expect(result.activeDirection).toBe('SHORT');

    const trade = result.trades![0] as Trade;
    expect(trade.direction).toBe('SHORT');
    expect(trade.entryPrice).toBe(14800);
    expect(trade.status).toBe('OPEN');
    // For SHORT: stop at support = 14900, rValue = |14800 - 14900| = 100
    expect(trade.stopLevel).toBe(14900);
    expect(trade.currentStop).toBe(14900);
    expect(trade.rValue).toBe(100);
    // Targets: 1R=14700, 2R=14600, 3R=14500
    expect(trade.target1R).toBe(14700);
    expect(trade.target2R).toBe(14600);
    expect(trade.target3R).toBe(14500);
    expect(trade.id).toBe('2024-01-02_SPY_SHORT_1');
  });
});

// ===========================================================================
// Position Management — Trailing Stop (1R)
// ===========================================================================
describe('updateLongTrailingStop', () => {
  it('moves currentStop to entryPrice, sets reached1R and timestamp1R', () => {
    const trade = makeTrade({
      direction: 'LONG',
      entryPrice: 15200,
      currentStop: 15100,
      status: 'OPEN',
    });
    const candle = makeCandle({ timestamp: 6000 });
    const ctx = makeContext({ trades: [trade] });
    const result = callAction(updateLongTrailingStop, ctx, newBarEvent(candle));

    expect(result.reached1R).toBe(true);
    expect(result.timestamp1R).toBe(6000);
    // currentStop should move to entryPrice (15200)
    const updatedTrade = (result.trades as Trade[])!.find((t) => t.id === trade.id)!;
    expect(updatedTrade.currentStop).toBe(15200);
  });

  it('returns empty object when no active LONG trade', () => {
    const ctx = makeContext({ trades: [] });
    const result = callAction(updateLongTrailingStop, ctx, newBarEvent(makeCandle()));
    expect(result).toEqual({});
  });
});

describe('updateShortTrailingStop', () => {
  it('moves currentStop to entryPrice, sets reached1R and timestamp1R', () => {
    const trade = makeTrade({
      id: '2024-01-02_SPY_SHORT_1',
      direction: 'SHORT',
      entryPrice: 14800,
      currentStop: 14900,
      status: 'OPEN',
    });
    const candle = makeCandle({ timestamp: 6000 });
    const ctx = makeContext({ trades: [trade] });
    const result = callAction(updateShortTrailingStop, ctx, newBarEvent(candle));

    expect(result.reached1R).toBe(true);
    expect(result.timestamp1R).toBe(6000);
    const updatedTrade = (result.trades as Trade[])!.find((t) => t.id === trade.id)!;
    expect(updatedTrade.currentStop).toBe(14800);
  });
});

// ===========================================================================
// R Milestones — 2R
// ===========================================================================
describe('recordLong2R', () => {
  it('sets reached2R and timestamp2R', () => {
    const candle = makeCandle({ timestamp: 7000 });
    const ctx = makeContext();
    const result = callAction(recordLong2R, ctx, newBarEvent(candle));
    expect(result.reached2R).toBe(true);
    expect(result.timestamp2R).toBe(7000);
  });

  it('returns empty for non-NEW_BAR event', () => {
    const ctx = makeContext();
    const result = callAction(recordLong2R, ctx, { type: 'SESSION_END' });
    expect(result.reached2R).toBeUndefined();
  });

  it('backfills reached1R and timestamp1R when 1R not yet reached', () => {
    const candle = makeCandle({ timestamp: 7000 });
    const ctx = makeContext({ reached1R: false, timestamp1R: 0 });
    const result = callAction(recordLong2R, ctx, newBarEvent(candle));
    expect(result.reached1R).toBe(true);
    expect(result.reached2R).toBe(true);
    expect(result.timestamp1R).toBe(7000);
    expect(result.timestamp2R).toBe(7000);
  });

  it('preserves existing timestamp1R when 1R already reached', () => {
    const candle = makeCandle({ timestamp: 7000 });
    const ctx = makeContext({ reached1R: true, timestamp1R: 5000 });
    const result = callAction(recordLong2R, ctx, newBarEvent(candle));
    expect(result.reached1R).toBe(true);
    expect(result.timestamp1R).toBe(5000);
    expect(result.timestamp2R).toBe(7000);
  });
});

describe('recordShort2R', () => {
  it('sets reached2R and timestamp2R', () => {
    const candle = makeCandle({ timestamp: 7000 });
    const ctx = makeContext();
    const result = callAction(recordShort2R, ctx, newBarEvent(candle));
    expect(result.reached2R).toBe(true);
    expect(result.timestamp2R).toBe(7000);
  });
});

// ===========================================================================
// R Milestones — 3R (WIN)
// ===========================================================================
describe('recordLong3R', () => {
  it('creates WIN_3R outcome, marks all thresholds reached, resolves position', () => {
    const trade = makeTrade({
      direction: 'LONG',
      entryPrice: 15200,
      rValue: 100,
      target3R: 15500,
      status: 'OPEN',
      entryTimestamp: 1000,
    });
    const postEntryBar = makeCandle({ timestamp: 2000, high: 15500, low: 15150 });
    const candle = makeCandle({ timestamp: 3000, close: 15500 });
    const ctx = makeContext({
      trades: [trade],
      allBars: [postEntryBar],
      outcomes: [],
      reached1R: true,
      reached2R: true,
      reached3R: false,
      timestamp1R: 1500,
      timestamp2R: 2000,
      timestamp3R: 0,
    });
    const result = callAction(recordLong3R, ctx, newBarEvent(candle));

    expect(result.longPhase).toBe('resolved');
    expect(result.reached1R).toBe(true);
    expect(result.reached2R).toBe(true);
    expect(result.reached3R).toBe(true);
    expect(result.timestamp3R).toBe(3000);

    // Outcome
    expect(result.outcomes).toHaveLength(1);
    const outcome = result.outcomes![0];
    expect(outcome.result).toBe('WIN_3R');
    expect(outcome.tradeId).toBe(trade.id);
    expect(outcome.exitPrice).toBe(15500); // target3R
    expect(outcome.exitTimestamp).toBe(3000);
    expect(outcome.realizedR).toBe(3);
    expect(outcome.firstThresholdReached).toBe(3);
    expect(outcome.timestampStop).toBe(0);

    // Trade status
    const updatedTrade = (result.trades as Trade[])!.find((t) => t.id === trade.id)!;
    expect(updatedTrade.status).toBe('TARGET_HIT');
  });

  it('backfills timestamp1R and timestamp2R when they were 0', () => {
    const trade = makeTrade({
      direction: 'LONG',
      entryPrice: 15200,
      rValue: 100,
      target3R: 15500,
      status: 'OPEN',
      entryTimestamp: 1000,
    });
    const candle = makeCandle({ timestamp: 3000 });
    const ctx = makeContext({
      trades: [trade],
      allBars: [],
      outcomes: [],
      reached1R: false,
      reached2R: false,
      reached3R: false,
      timestamp1R: 0,
      timestamp2R: 0,
    });
    const result = callAction(recordLong3R, ctx, newBarEvent(candle));

    // Backfilled to candle timestamp
    expect(result.timestamp1R).toBe(3000);
    expect(result.timestamp2R).toBe(3000);
    expect(result.timestamp3R).toBe(3000);
  });

  it('returns empty object when no active LONG trade', () => {
    const ctx = makeContext({ trades: [], allBars: [] });
    const result = callAction(recordLong3R, ctx, newBarEvent(makeCandle()));
    expect(result).toEqual({});
  });
});

describe('recordShort3R', () => {
  it('creates WIN_3R outcome and resolves SHORT position', () => {
    const trade = makeTrade({
      id: '2024-01-02_SPY_SHORT_1',
      direction: 'SHORT',
      entryPrice: 14800,
      rValue: 100,
      target3R: 14500,
      status: 'OPEN',
      entryTimestamp: 1000,
    });
    const candle = makeCandle({ timestamp: 3000, close: 14500 });
    const ctx = makeContext({
      trades: [trade],
      allBars: [],
      outcomes: [],
      reached1R: true,
      reached2R: true,
      reached3R: false,
      timestamp1R: 1500,
      timestamp2R: 2000,
    });
    const result = callAction(recordShort3R, ctx, newBarEvent(candle));

    expect(result.shortPhase).toBe('resolved');
    expect(result.reached3R).toBe(true);
    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes![0].result).toBe('WIN_3R');
    expect(result.outcomes![0].exitPrice).toBe(14500);
    expect(result.outcomes![0].realizedR).toBe(3);
  });
});

// ===========================================================================
// Exit — Stop Hit
// ===========================================================================
describe('recordLongStopHit', () => {
  it('creates LOSS outcome when 1R not reached', () => {
    const trade = makeTrade({
      direction: 'LONG',
      entryPrice: 15200,
      currentStop: 15100,
      rValue: 100,
      status: 'OPEN',
      entryTimestamp: 1000,
    });
    const candle = makeCandle({ timestamp: 4000, close: 15100 });
    const ctx = makeContext({
      trades: [trade],
      allBars: [],
      outcomes: [],
      reached1R: false,
    });
    const result = callAction(recordLongStopHit, ctx, newBarEvent(candle));

    expect(result.longPhase).toBe('resolved');
    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes![0].result).toBe('LOSS');
    expect(result.outcomes![0].exitPrice).toBe(15100); // currentStop
    expect(result.outcomes![0].timestampStop).toBe(4000);

    const updatedTrade = (result.trades as Trade[])!.find((t) => t.id === trade.id)!;
    expect(updatedTrade.status).toBe('STOPPED_OUT');
  });

  it('creates BREAKEVEN_STOP outcome when 1R was reached', () => {
    const trade = makeTrade({
      direction: 'LONG',
      entryPrice: 15200,
      currentStop: 15200, // moved to entry after 1R
      rValue: 100,
      status: 'OPEN',
      entryTimestamp: 1000,
    });
    const candle = makeCandle({ timestamp: 4000, close: 15200 });
    const ctx = makeContext({
      trades: [trade],
      allBars: [],
      outcomes: [],
      reached1R: true,
      timestamp1R: 2000,
    });
    const result = callAction(recordLongStopHit, ctx, newBarEvent(candle));

    expect(result.outcomes![0].result).toBe('BREAKEVEN_STOP');
    expect(result.outcomes![0].exitPrice).toBe(15200);
  });

  it('returns empty object when no active LONG trade', () => {
    const ctx = makeContext({ trades: [] });
    const result = callAction(recordLongStopHit, ctx, newBarEvent(makeCandle()));
    expect(result).toEqual({});
  });
});

describe('recordShortStopHit', () => {
  it('creates LOSS outcome when 1R not reached', () => {
    const trade = makeTrade({
      id: '2024-01-02_SPY_SHORT_1',
      direction: 'SHORT',
      entryPrice: 14800,
      currentStop: 14900,
      rValue: 100,
      status: 'OPEN',
      entryTimestamp: 1000,
    });
    const candle = makeCandle({ timestamp: 4000, close: 14900 });
    const ctx = makeContext({
      trades: [trade],
      allBars: [],
      outcomes: [],
      reached1R: false,
    });
    const result = callAction(recordShortStopHit, ctx, newBarEvent(candle));

    expect(result.shortPhase).toBe('resolved');
    expect(result.outcomes![0].result).toBe('LOSS');
    expect(result.outcomes![0].exitPrice).toBe(14900);
  });

  it('creates BREAKEVEN_STOP outcome when 1R was reached', () => {
    const trade = makeTrade({
      id: '2024-01-02_SPY_SHORT_1',
      direction: 'SHORT',
      entryPrice: 14800,
      currentStop: 14800, // moved to entry after 1R
      rValue: 100,
      status: 'OPEN',
      entryTimestamp: 1000,
    });
    const candle = makeCandle({ timestamp: 4000, close: 14800 });
    const ctx = makeContext({
      trades: [trade],
      allBars: [],
      outcomes: [],
      reached1R: true,
    });
    const result = callAction(recordShortStopHit, ctx, newBarEvent(candle));
    expect(result.outcomes![0].result).toBe('BREAKEVEN_STOP');
  });
});

// ===========================================================================
// Exit — Session Timeout
// ===========================================================================
describe('recordSessionTimeout', () => {
  it('resolves open LONG position with SESSION_TIMEOUT', () => {
    const trade = makeTrade({
      direction: 'LONG',
      entryPrice: 15200,
      rValue: 100,
      status: 'OPEN',
      entryTimestamp: 1000,
    });
    const lastBar = makeCandle({ timestamp: 9000, close: 15250 });
    const ctx = makeContext({
      trades: [trade],
      allBars: [lastBar],
      outcomes: [],
      longPhase: 'positionOpen',
    });
    const result = callAction(recordSessionTimeout, ctx, { type: 'SESSION_END' });

    expect(result.longPhase).toBe('resolved');
    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes![0].result).toBe('SESSION_TIMEOUT');
    expect(result.outcomes![0].exitPrice).toBe(15250); // last bar close
    expect(result.outcomes![0].timestampStop).toBe(0); // not a stop hit

    const updatedTrade = (result.trades as Trade[])!.find((t) => t.id === trade.id)!;
    expect(updatedTrade.status).toBe('SESSION_EXPIRED');
  });

  it('resolves open SHORT position with SESSION_TIMEOUT', () => {
    const trade = makeTrade({
      id: '2024-01-02_SPY_SHORT_1',
      direction: 'SHORT',
      entryPrice: 14800,
      rValue: 100,
      status: 'OPEN',
      entryTimestamp: 1000,
    });
    const lastBar = makeCandle({ timestamp: 9000, close: 14850 });
    const ctx = makeContext({
      trades: [trade],
      allBars: [lastBar],
      outcomes: [],
      shortPhase: 'positionOpen',
    });
    const result = callAction(recordSessionTimeout, ctx, { type: 'SESSION_END' });

    expect(result.shortPhase).toBe('resolved');
    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes![0].result).toBe('SESSION_TIMEOUT');
  });

  it('does nothing when no position is open', () => {
    const ctx = makeContext({
      trades: [],
      allBars: [makeCandle()],
      outcomes: [],
      longPhase: 'watching',
      shortPhase: 'watching',
    });
    const result = callAction(recordSessionTimeout, ctx, { type: 'SESSION_END' });

    expect(result.outcomes).toHaveLength(0);
    expect(result.longPhase).toBe('watching');
    expect(result.shortPhase).toBe('watching');
  });

  it('handles empty allBars gracefully (no last bar)', () => {
    const trade = makeTrade({
      direction: 'LONG',
      status: 'OPEN',
    });
    const ctx = makeContext({
      trades: [trade],
      allBars: [],
      outcomes: [],
      longPhase: 'positionOpen',
    });
    const result = callAction(recordSessionTimeout, ctx, { type: 'SESSION_END' });

    // No last bar means the trade/outcome block is skipped
    expect(result.outcomes).toHaveLength(0);
    // longPhase stays positionOpen because the block was skipped (lastBar is null)
    expect(result.longPhase).toBe('positionOpen');
  });
});
