import { describe, it, expect } from 'vitest';
import {
  isZoneComplete,
  isChoppyZone,
  isDegenerateZone,
  isLongBreak,
  isLongRetest,
  isLongRetestAndConfirm,
  isLongConfirmation,
  isLongBreakFailure,
  isLongStopHit,
  isLong1R,
  isLong2R,
  isLong3R,
  isShortBreak,
  isShortRetest,
  isShortRetestAndConfirm,
  isShortConfirmation,
  isShortBreakFailure,
  isShortStopHit,
  isShort1R,
  isShort2R,
  isShort3R,
  isMaxAttemptsReached,
  isMaxLongAttemptsReached,
  isMaxShortAttemptsReached,
  isSuperseded,
  isLongSuperseded,
  isShortSuperseded,
  isSessionEnd,
} from '@core/strategy/guards.js';
import type { StrategyMachineContext, StrategyEvent } from '@core/strategy/events.js';
import type { Candle } from '@core/models/candle.js';
import type { DecisionZone } from '@core/models/decision-zone.js';
import type { Trade } from '@core/models/trade.js';
import { etToUtc } from '@utils/time.js';

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

/** Create a minimal OPEN Trade for testing stop/R-target guards. */
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

// ===========================================================================
// isZoneComplete
// ===========================================================================
describe('isZoneComplete', () => {
  // 10:00 ET on 2024-01-02 (EST, UTC-5) = 15:00 UTC
  const zoneEndUtc = etToUtc('2024-01-02', '10:00');

  it('returns true when completed bar timestamp >= zone end time', () => {
    const ctx = makeContext({ date: '2024-01-02' });
    const bar = makeCandle({ completed: true, timestamp: zoneEndUtc });
    expect(isZoneComplete(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns true when bar timestamp is after zone end time', () => {
    const ctx = makeContext({ date: '2024-01-02' });
    const bar = makeCandle({ completed: true, timestamp: zoneEndUtc + 300_000 });
    expect(isZoneComplete(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns false when bar timestamp is 1 ms before zone end', () => {
    const ctx = makeContext({ date: '2024-01-02' });
    const bar = makeCandle({ completed: true, timestamp: zoneEndUtc - 1 });
    expect(isZoneComplete(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false when bar is not completed', () => {
    const ctx = makeContext({ date: '2024-01-02' });
    const bar = makeCandle({ completed: false, timestamp: zoneEndUtc });
    expect(isZoneComplete(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false for non-NEW_BAR event', () => {
    const ctx = makeContext({ date: '2024-01-02' });
    expect(isZoneComplete(ctx, { type: 'SESSION_END' })).toBe(false);
  });
});

// ===========================================================================
// isChoppyZone
// ===========================================================================
describe('isChoppyZone', () => {
  it('returns true when last bar close is strictly between support and resistance', () => {
    const bars = [makeCandle({ close: 15000 })];
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100, support: 14900, sourceBars: bars }),
    });
    expect(isChoppyZone(ctx)).toBe(true);
  });

  it('returns false when close equals resistance', () => {
    const bars = [makeCandle({ close: 15100 })];
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100, support: 14900, sourceBars: bars }),
    });
    expect(isChoppyZone(ctx)).toBe(false);
  });

  it('returns false when close equals support', () => {
    const bars = [makeCandle({ close: 14900 })];
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100, support: 14900, sourceBars: bars }),
    });
    expect(isChoppyZone(ctx)).toBe(false);
  });

  it('returns false when close is above resistance', () => {
    const bars = [makeCandle({ close: 15200 })];
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100, support: 14900, sourceBars: bars }),
    });
    expect(isChoppyZone(ctx)).toBe(false);
  });

  it('returns false when close is below support', () => {
    const bars = [makeCandle({ close: 14800 })];
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100, support: 14900, sourceBars: bars }),
    });
    expect(isChoppyZone(ctx)).toBe(false);
  });

  it('returns false when zone is null', () => {
    const ctx = makeContext({ zone: null });
    expect(isChoppyZone(ctx)).toBe(false);
  });

  it('returns false when sourceBars is empty', () => {
    const ctx = makeContext({
      zone: makeZone({ sourceBars: [] }),
    });
    expect(isChoppyZone(ctx)).toBe(false);
  });

  it('uses the LAST bar close (not first) for choppy check', () => {
    const bars = [
      makeCandle({ close: 15200 }), // outside zone
      makeCandle({ close: 15000 }), // inside zone
    ];
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100, support: 14900, sourceBars: bars }),
    });
    expect(isChoppyZone(ctx)).toBe(true);
  });

  it('boundary: close 1 cent above support is choppy', () => {
    const bars = [makeCandle({ close: 14901 })];
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100, support: 14900, sourceBars: bars }),
    });
    expect(isChoppyZone(ctx)).toBe(true);
  });

  it('boundary: close 1 cent below resistance is choppy', () => {
    const bars = [makeCandle({ close: 15099 })];
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100, support: 14900, sourceBars: bars }),
    });
    expect(isChoppyZone(ctx)).toBe(true);
  });
});

// ===========================================================================
// isDegenerateZone
// ===========================================================================
describe('isDegenerateZone', () => {
  it('returns true when spread is below minZoneSpreadCents', () => {
    const ctx = makeContext({
      zone: makeZone({ spread: 49, resistance: 15025, support: 14976 }),
      minZoneSpreadCents: 50,
    });
    expect(isDegenerateZone(ctx)).toBe(true);
  });

  it('returns false when spread equals minZoneSpreadCents', () => {
    const ctx = makeContext({
      zone: makeZone({ spread: 50, resistance: 15025, support: 14975 }),
      minZoneSpreadCents: 50,
      maxZoneSpreadPercent: 10,
    });
    expect(isDegenerateZone(ctx)).toBe(false);
  });

  it('returns true when spread exceeds maxZoneSpreadPercent of midpoint', () => {
    // midpoint = (16000 + 14000) / 2 = 15000
    // spread = 2000, maxPercent = 5 => 5/100 = 0.05
    // 2000 / 15000 = 0.1333 > 0.05 => degenerate
    const ctx = makeContext({
      zone: makeZone({ spread: 2000, resistance: 16000, support: 14000 }),
      minZoneSpreadCents: 50,
      maxZoneSpreadPercent: 5,
    });
    expect(isDegenerateZone(ctx)).toBe(true);
  });

  it('returns false when spread is within both limits', () => {
    // spread = 200, midpoint = 15000, 200/15000 = 0.0133 < 0.05
    const ctx = makeContext({
      zone: makeZone({ spread: 200, resistance: 15100, support: 14900 }),
      minZoneSpreadCents: 50,
      maxZoneSpreadPercent: 5,
    });
    expect(isDegenerateZone(ctx)).toBe(false);
  });

  it('returns true when midpoint is 0', () => {
    const ctx = makeContext({
      zone: makeZone({ spread: 100, resistance: 50, support: -50 }),
      minZoneSpreadCents: 50,
    });
    expect(isDegenerateZone(ctx)).toBe(true);
  });

  it('returns false when zone is null', () => {
    const ctx = makeContext({ zone: null });
    expect(isDegenerateZone(ctx)).toBe(false);
  });

  it('boundary: spread exactly at maxPercent threshold is not degenerate', () => {
    // midpoint = 10000, spread = 500, maxPercent = 5
    // 500 / 10000 = 0.05, 5/100 = 0.05 => NOT > 0.05 => not degenerate
    const ctx = makeContext({
      zone: makeZone({ spread: 500, resistance: 10250, support: 9750 }),
      minZoneSpreadCents: 50,
      maxZoneSpreadPercent: 5,
    });
    expect(isDegenerateZone(ctx)).toBe(false);
  });
});

// ===========================================================================
// LONG Guards
// ===========================================================================
describe('isLongBreak', () => {
  it('returns true when bar HIGH pierces resistance in watching phase', () => {
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100 }),
      longPhase: 'watching',
    });
    const bar = makeCandle({ high: 15101, completed: true });
    expect(isLongBreak(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns false when bar HIGH equals resistance (not pierced)', () => {
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100 }),
      longPhase: 'watching',
    });
    const bar = makeCandle({ high: 15100, completed: true });
    expect(isLongBreak(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false when bar HIGH is 1 cent below resistance', () => {
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100 }),
      longPhase: 'watching',
    });
    const bar = makeCandle({ high: 15099, completed: true });
    expect(isLongBreak(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false in wrong phase (breakDetected)', () => {
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100 }),
      longPhase: 'breakDetected',
    });
    const bar = makeCandle({ high: 15200, completed: true });
    expect(isLongBreak(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false when bar is not completed', () => {
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100 }),
      longPhase: 'watching',
    });
    const bar = makeCandle({ high: 15200, completed: false });
    expect(isLongBreak(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false when zone is null', () => {
    const ctx = makeContext({ zone: null, longPhase: 'watching' });
    const bar = makeCandle({ high: 99999, completed: true });
    expect(isLongBreak(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false for non-NEW_BAR event', () => {
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100 }),
      longPhase: 'watching',
    });
    expect(isLongBreak(ctx, { type: 'SESSION_END' })).toBe(false);
  });
});

describe('isLongRetest', () => {
  it('returns true when bar LOW touches resistance in breakDetected phase', () => {
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100 }),
      longPhase: 'breakDetected',
    });
    const bar = makeCandle({ low: 15100, completed: true });
    expect(isLongRetest(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns true when bar LOW dips below resistance', () => {
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100 }),
      longPhase: 'breakDetected',
    });
    const bar = makeCandle({ low: 15050, completed: true });
    expect(isLongRetest(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns false when bar LOW is 1 cent above resistance', () => {
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100 }),
      longPhase: 'breakDetected',
    });
    const bar = makeCandle({ low: 15101, completed: true });
    expect(isLongRetest(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false in watching phase', () => {
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100 }),
      longPhase: 'watching',
    });
    const bar = makeCandle({ low: 15000, completed: true });
    expect(isLongRetest(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false when bar is not completed', () => {
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100 }),
      longPhase: 'breakDetected',
    });
    const bar = makeCandle({ low: 15000, completed: false });
    expect(isLongRetest(ctx, newBarEvent(bar))).toBe(false);
  });
});

describe('isLongRetestAndConfirm', () => {
  it('returns true when bar dips to resistance and closes above it', () => {
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100 }),
      longPhase: 'breakDetected',
    });
    const bar = makeCandle({ low: 15100, close: 15150, completed: true });
    expect(isLongRetestAndConfirm(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns true when bar dips below resistance and closes above it', () => {
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100 }),
      longPhase: 'breakDetected',
    });
    const bar = makeCandle({ low: 15050, close: 15200, completed: true });
    expect(isLongRetestAndConfirm(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns false when close equals resistance (not above)', () => {
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100 }),
      longPhase: 'breakDetected',
    });
    const bar = makeCandle({ low: 15050, close: 15100, completed: true });
    expect(isLongRetestAndConfirm(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false when low is above resistance (no retest)', () => {
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100 }),
      longPhase: 'breakDetected',
    });
    const bar = makeCandle({ low: 15101, close: 15200, completed: true });
    expect(isLongRetestAndConfirm(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false in wrong phase', () => {
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100 }),
      longPhase: 'watching',
    });
    const bar = makeCandle({ low: 15050, close: 15200, completed: true });
    expect(isLongRetestAndConfirm(ctx, newBarEvent(bar))).toBe(false);
  });
});

describe('isLongConfirmation', () => {
  it('returns true when bar closes above resistance in retestDetected phase', () => {
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100 }),
      longPhase: 'retestDetected',
    });
    const bar = makeCandle({ close: 15101, completed: true });
    expect(isLongConfirmation(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns false when close equals resistance', () => {
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100 }),
      longPhase: 'retestDetected',
    });
    const bar = makeCandle({ close: 15100, completed: true });
    expect(isLongConfirmation(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false in breakDetected phase', () => {
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100 }),
      longPhase: 'breakDetected',
    });
    const bar = makeCandle({ close: 15200, completed: true });
    expect(isLongConfirmation(ctx, newBarEvent(bar))).toBe(false);
  });
});

describe('isLongBreakFailure', () => {
  it('returns true when close at resistance in breakDetected phase', () => {
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100 }),
      longPhase: 'breakDetected',
    });
    const bar = makeCandle({ close: 15100, completed: true });
    expect(isLongBreakFailure(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns true when close below resistance in retestDetected phase', () => {
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100 }),
      longPhase: 'retestDetected',
    });
    const bar = makeCandle({ close: 15050, completed: true });
    expect(isLongBreakFailure(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns false when close is above resistance', () => {
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100 }),
      longPhase: 'breakDetected',
    });
    const bar = makeCandle({ close: 15101, completed: true });
    expect(isLongBreakFailure(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false in watching phase', () => {
    const ctx = makeContext({
      zone: makeZone({ resistance: 15100 }),
      longPhase: 'watching',
    });
    const bar = makeCandle({ close: 15000, completed: true });
    expect(isLongBreakFailure(ctx, newBarEvent(bar))).toBe(false);
  });
});

describe('isLongStopHit', () => {
  it('returns true when close at stop in positionOpen phase', () => {
    const trade = makeTrade({ direction: 'LONG', currentStop: 15100, status: 'OPEN' });
    const ctx = makeContext({ trades: [trade], longPhase: 'positionOpen' });
    const bar = makeCandle({ close: 15100, completed: true });
    expect(isLongStopHit(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns true when close below stop', () => {
    const trade = makeTrade({ direction: 'LONG', currentStop: 15100, status: 'OPEN' });
    const ctx = makeContext({ trades: [trade], longPhase: 'positionOpen' });
    const bar = makeCandle({ close: 15050, completed: true });
    expect(isLongStopHit(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns false when close is 1 cent above stop', () => {
    const trade = makeTrade({ direction: 'LONG', currentStop: 15100, status: 'OPEN' });
    const ctx = makeContext({ trades: [trade], longPhase: 'positionOpen' });
    const bar = makeCandle({ close: 15101, completed: true });
    expect(isLongStopHit(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false when no active LONG trade exists', () => {
    const ctx = makeContext({ trades: [], longPhase: 'positionOpen' });
    const bar = makeCandle({ close: 10000, completed: true });
    expect(isLongStopHit(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false in wrong phase', () => {
    const trade = makeTrade({ direction: 'LONG', currentStop: 15100, status: 'OPEN' });
    const ctx = makeContext({ trades: [trade], longPhase: 'watching' });
    const bar = makeCandle({ close: 15000, completed: true });
    expect(isLongStopHit(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false when trade is STOPPED_OUT (not OPEN)', () => {
    const trade = makeTrade({ direction: 'LONG', currentStop: 15100, status: 'STOPPED_OUT' });
    const ctx = makeContext({ trades: [trade], longPhase: 'positionOpen' });
    const bar = makeCandle({ close: 15000, completed: true });
    expect(isLongStopHit(ctx, newBarEvent(bar))).toBe(false);
  });
});

describe('isLong1R', () => {
  it('returns true when close at target1R and 1R not yet reached', () => {
    const trade = makeTrade({ direction: 'LONG', target1R: 15300, status: 'OPEN' });
    const ctx = makeContext({
      trades: [trade],
      longPhase: 'positionOpen',
      reached1R: false,
    });
    const bar = makeCandle({ close: 15300, completed: true });
    expect(isLong1R(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns true when close above target1R', () => {
    const trade = makeTrade({ direction: 'LONG', target1R: 15300, status: 'OPEN' });
    const ctx = makeContext({
      trades: [trade],
      longPhase: 'positionOpen',
      reached1R: false,
    });
    const bar = makeCandle({ close: 15400, completed: true });
    expect(isLong1R(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns false when close is 1 cent below target1R', () => {
    const trade = makeTrade({ direction: 'LONG', target1R: 15300, status: 'OPEN' });
    const ctx = makeContext({
      trades: [trade],
      longPhase: 'positionOpen',
      reached1R: false,
    });
    const bar = makeCandle({ close: 15299, completed: true });
    expect(isLong1R(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false when 1R already reached', () => {
    const trade = makeTrade({ direction: 'LONG', target1R: 15300, status: 'OPEN' });
    const ctx = makeContext({
      trades: [trade],
      longPhase: 'positionOpen',
      reached1R: true,
    });
    const bar = makeCandle({ close: 15300, completed: true });
    expect(isLong1R(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false in wrong phase', () => {
    const trade = makeTrade({ direction: 'LONG', target1R: 15300, status: 'OPEN' });
    const ctx = makeContext({
      trades: [trade],
      longPhase: 'watching',
      reached1R: false,
    });
    const bar = makeCandle({ close: 15300, completed: true });
    expect(isLong1R(ctx, newBarEvent(bar))).toBe(false);
  });
});

describe('isLong2R', () => {
  it('returns true when close at target2R and 2R not yet reached', () => {
    const trade = makeTrade({ direction: 'LONG', target2R: 15400, status: 'OPEN' });
    const ctx = makeContext({
      trades: [trade],
      longPhase: 'positionOpen',
      reached2R: false,
    });
    const bar = makeCandle({ close: 15400, completed: true });
    expect(isLong2R(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns false when 2R already reached', () => {
    const trade = makeTrade({ direction: 'LONG', target2R: 15400, status: 'OPEN' });
    const ctx = makeContext({
      trades: [trade],
      longPhase: 'positionOpen',
      reached2R: true,
    });
    const bar = makeCandle({ close: 15400, completed: true });
    expect(isLong2R(ctx, newBarEvent(bar))).toBe(false);
  });
});

describe('isLong3R', () => {
  it('returns true when close at target3R and 3R not yet reached', () => {
    const trade = makeTrade({ direction: 'LONG', target3R: 15500, status: 'OPEN' });
    const ctx = makeContext({
      trades: [trade],
      longPhase: 'positionOpen',
      reached3R: false,
    });
    const bar = makeCandle({ close: 15500, completed: true });
    expect(isLong3R(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns false when 3R already reached', () => {
    const trade = makeTrade({ direction: 'LONG', target3R: 15500, status: 'OPEN' });
    const ctx = makeContext({
      trades: [trade],
      longPhase: 'positionOpen',
      reached3R: true,
    });
    const bar = makeCandle({ close: 15500, completed: true });
    expect(isLong3R(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false when close is 1 cent below target3R', () => {
    const trade = makeTrade({ direction: 'LONG', target3R: 15500, status: 'OPEN' });
    const ctx = makeContext({
      trades: [trade],
      longPhase: 'positionOpen',
      reached3R: false,
    });
    const bar = makeCandle({ close: 15499, completed: true });
    expect(isLong3R(ctx, newBarEvent(bar))).toBe(false);
  });
});

// ===========================================================================
// SHORT Guards
// ===========================================================================
describe('isShortBreak', () => {
  it('returns true when bar LOW pierces support in watching phase', () => {
    const ctx = makeContext({
      zone: makeZone({ support: 14900 }),
      shortPhase: 'watching',
    });
    const bar = makeCandle({ low: 14899, completed: true });
    expect(isShortBreak(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns false when bar LOW equals support (not pierced)', () => {
    const ctx = makeContext({
      zone: makeZone({ support: 14900 }),
      shortPhase: 'watching',
    });
    const bar = makeCandle({ low: 14900, completed: true });
    expect(isShortBreak(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false when bar LOW is 1 cent above support', () => {
    const ctx = makeContext({
      zone: makeZone({ support: 14900 }),
      shortPhase: 'watching',
    });
    const bar = makeCandle({ low: 14901, completed: true });
    expect(isShortBreak(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false in wrong phase', () => {
    const ctx = makeContext({
      zone: makeZone({ support: 14900 }),
      shortPhase: 'breakDetected',
    });
    const bar = makeCandle({ low: 14800, completed: true });
    expect(isShortBreak(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false when bar is not completed', () => {
    const ctx = makeContext({
      zone: makeZone({ support: 14900 }),
      shortPhase: 'watching',
    });
    const bar = makeCandle({ low: 14800, completed: false });
    expect(isShortBreak(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false when zone is null', () => {
    const ctx = makeContext({ zone: null, shortPhase: 'watching' });
    const bar = makeCandle({ low: 0, completed: true });
    expect(isShortBreak(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false for non-NEW_BAR event', () => {
    const ctx = makeContext({
      zone: makeZone({ support: 14900 }),
      shortPhase: 'watching',
    });
    expect(isShortBreak(ctx, { type: 'SESSION_END' })).toBe(false);
  });
});

describe('isShortRetest', () => {
  it('returns true when bar HIGH touches support in breakDetected phase', () => {
    const ctx = makeContext({
      zone: makeZone({ support: 14900 }),
      shortPhase: 'breakDetected',
    });
    const bar = makeCandle({ high: 14900, completed: true });
    expect(isShortRetest(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns true when bar HIGH rises above support', () => {
    const ctx = makeContext({
      zone: makeZone({ support: 14900 }),
      shortPhase: 'breakDetected',
    });
    const bar = makeCandle({ high: 14950, completed: true });
    expect(isShortRetest(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns false when bar HIGH is 1 cent below support', () => {
    const ctx = makeContext({
      zone: makeZone({ support: 14900 }),
      shortPhase: 'breakDetected',
    });
    const bar = makeCandle({ high: 14899, completed: true });
    expect(isShortRetest(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false in watching phase', () => {
    const ctx = makeContext({
      zone: makeZone({ support: 14900 }),
      shortPhase: 'watching',
    });
    const bar = makeCandle({ high: 15000, completed: true });
    expect(isShortRetest(ctx, newBarEvent(bar))).toBe(false);
  });
});

describe('isShortRetestAndConfirm', () => {
  it('returns true when bar rises to support and closes below it', () => {
    const ctx = makeContext({
      zone: makeZone({ support: 14900 }),
      shortPhase: 'breakDetected',
    });
    const bar = makeCandle({ high: 14900, close: 14850, completed: true });
    expect(isShortRetestAndConfirm(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns true when bar rises above support and closes below it', () => {
    const ctx = makeContext({
      zone: makeZone({ support: 14900 }),
      shortPhase: 'breakDetected',
    });
    const bar = makeCandle({ high: 14950, close: 14800, completed: true });
    expect(isShortRetestAndConfirm(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns false when close equals support (not below)', () => {
    const ctx = makeContext({
      zone: makeZone({ support: 14900 }),
      shortPhase: 'breakDetected',
    });
    const bar = makeCandle({ high: 14950, close: 14900, completed: true });
    expect(isShortRetestAndConfirm(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false when high is below support (no retest)', () => {
    const ctx = makeContext({
      zone: makeZone({ support: 14900 }),
      shortPhase: 'breakDetected',
    });
    const bar = makeCandle({ high: 14899, close: 14800, completed: true });
    expect(isShortRetestAndConfirm(ctx, newBarEvent(bar))).toBe(false);
  });
});

describe('isShortConfirmation', () => {
  it('returns true when bar closes below support in retestDetected phase', () => {
    const ctx = makeContext({
      zone: makeZone({ support: 14900 }),
      shortPhase: 'retestDetected',
    });
    const bar = makeCandle({ close: 14899, completed: true });
    expect(isShortConfirmation(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns false when close equals support', () => {
    const ctx = makeContext({
      zone: makeZone({ support: 14900 }),
      shortPhase: 'retestDetected',
    });
    const bar = makeCandle({ close: 14900, completed: true });
    expect(isShortConfirmation(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false in breakDetected phase', () => {
    const ctx = makeContext({
      zone: makeZone({ support: 14900 }),
      shortPhase: 'breakDetected',
    });
    const bar = makeCandle({ close: 14800, completed: true });
    expect(isShortConfirmation(ctx, newBarEvent(bar))).toBe(false);
  });
});

describe('isShortBreakFailure', () => {
  it('returns true when close at support in breakDetected phase', () => {
    const ctx = makeContext({
      zone: makeZone({ support: 14900 }),
      shortPhase: 'breakDetected',
    });
    const bar = makeCandle({ close: 14900, completed: true });
    expect(isShortBreakFailure(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns true when close above support in retestDetected phase', () => {
    const ctx = makeContext({
      zone: makeZone({ support: 14900 }),
      shortPhase: 'retestDetected',
    });
    const bar = makeCandle({ close: 15000, completed: true });
    expect(isShortBreakFailure(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns false when close is below support', () => {
    const ctx = makeContext({
      zone: makeZone({ support: 14900 }),
      shortPhase: 'breakDetected',
    });
    const bar = makeCandle({ close: 14899, completed: true });
    expect(isShortBreakFailure(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false in watching phase', () => {
    const ctx = makeContext({
      zone: makeZone({ support: 14900 }),
      shortPhase: 'watching',
    });
    const bar = makeCandle({ close: 15000, completed: true });
    expect(isShortBreakFailure(ctx, newBarEvent(bar))).toBe(false);
  });
});

describe('isShortStopHit', () => {
  it('returns true when close at stop in positionOpen phase', () => {
    const trade = makeTrade({
      direction: 'SHORT',
      currentStop: 14900,
      status: 'OPEN',
    });
    const ctx = makeContext({ trades: [trade], shortPhase: 'positionOpen' });
    const bar = makeCandle({ close: 14900, completed: true });
    expect(isShortStopHit(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns true when close above stop', () => {
    const trade = makeTrade({
      direction: 'SHORT',
      currentStop: 14900,
      status: 'OPEN',
    });
    const ctx = makeContext({ trades: [trade], shortPhase: 'positionOpen' });
    const bar = makeCandle({ close: 15000, completed: true });
    expect(isShortStopHit(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns false when close is 1 cent below stop', () => {
    const trade = makeTrade({
      direction: 'SHORT',
      currentStop: 14900,
      status: 'OPEN',
    });
    const ctx = makeContext({ trades: [trade], shortPhase: 'positionOpen' });
    const bar = makeCandle({ close: 14899, completed: true });
    expect(isShortStopHit(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false when no active SHORT trade exists', () => {
    const ctx = makeContext({ trades: [], shortPhase: 'positionOpen' });
    const bar = makeCandle({ close: 99999, completed: true });
    expect(isShortStopHit(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false in wrong phase', () => {
    const trade = makeTrade({
      direction: 'SHORT',
      currentStop: 14900,
      status: 'OPEN',
    });
    const ctx = makeContext({ trades: [trade], shortPhase: 'watching' });
    const bar = makeCandle({ close: 15000, completed: true });
    expect(isShortStopHit(ctx, newBarEvent(bar))).toBe(false);
  });
});

describe('isShort1R', () => {
  it('returns true when close at target1R (below entry) and 1R not reached', () => {
    const trade = makeTrade({
      direction: 'SHORT',
      target1R: 14700,
      status: 'OPEN',
    });
    const ctx = makeContext({
      trades: [trade],
      shortPhase: 'positionOpen',
      reached1R: false,
    });
    const bar = makeCandle({ close: 14700, completed: true });
    expect(isShort1R(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns true when close below target1R', () => {
    const trade = makeTrade({
      direction: 'SHORT',
      target1R: 14700,
      status: 'OPEN',
    });
    const ctx = makeContext({
      trades: [trade],
      shortPhase: 'positionOpen',
      reached1R: false,
    });
    const bar = makeCandle({ close: 14600, completed: true });
    expect(isShort1R(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns false when close is 1 cent above target1R', () => {
    const trade = makeTrade({
      direction: 'SHORT',
      target1R: 14700,
      status: 'OPEN',
    });
    const ctx = makeContext({
      trades: [trade],
      shortPhase: 'positionOpen',
      reached1R: false,
    });
    const bar = makeCandle({ close: 14701, completed: true });
    expect(isShort1R(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false when 1R already reached', () => {
    const trade = makeTrade({
      direction: 'SHORT',
      target1R: 14700,
      status: 'OPEN',
    });
    const ctx = makeContext({
      trades: [trade],
      shortPhase: 'positionOpen',
      reached1R: true,
    });
    const bar = makeCandle({ close: 14700, completed: true });
    expect(isShort1R(ctx, newBarEvent(bar))).toBe(false);
  });
});

describe('isShort2R', () => {
  it('returns true when close at target2R and 2R not reached', () => {
    const trade = makeTrade({
      direction: 'SHORT',
      target2R: 14600,
      status: 'OPEN',
    });
    const ctx = makeContext({
      trades: [trade],
      shortPhase: 'positionOpen',
      reached2R: false,
    });
    const bar = makeCandle({ close: 14600, completed: true });
    expect(isShort2R(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns false when 2R already reached', () => {
    const trade = makeTrade({
      direction: 'SHORT',
      target2R: 14600,
      status: 'OPEN',
    });
    const ctx = makeContext({
      trades: [trade],
      shortPhase: 'positionOpen',
      reached2R: true,
    });
    const bar = makeCandle({ close: 14600, completed: true });
    expect(isShort2R(ctx, newBarEvent(bar))).toBe(false);
  });
});

describe('isShort3R', () => {
  it('returns true when close at target3R and 3R not reached', () => {
    const trade = makeTrade({
      direction: 'SHORT',
      target3R: 14500,
      status: 'OPEN',
    });
    const ctx = makeContext({
      trades: [trade],
      shortPhase: 'positionOpen',
      reached3R: false,
    });
    const bar = makeCandle({ close: 14500, completed: true });
    expect(isShort3R(ctx, newBarEvent(bar))).toBe(true);
  });

  it('returns false when 3R already reached', () => {
    const trade = makeTrade({
      direction: 'SHORT',
      target3R: 14500,
      status: 'OPEN',
    });
    const ctx = makeContext({
      trades: [trade],
      shortPhase: 'positionOpen',
      reached3R: true,
    });
    const bar = makeCandle({ close: 14500, completed: true });
    expect(isShort3R(ctx, newBarEvent(bar))).toBe(false);
  });

  it('returns false when close is 1 cent above target3R', () => {
    const trade = makeTrade({
      direction: 'SHORT',
      target3R: 14500,
      status: 'OPEN',
    });
    const ctx = makeContext({
      trades: [trade],
      shortPhase: 'positionOpen',
      reached3R: false,
    });
    const bar = makeCandle({ close: 14501, completed: true });
    expect(isShort3R(ctx, newBarEvent(bar))).toBe(false);
  });
});

// ===========================================================================
// Control Guards
// ===========================================================================
describe('isMaxAttemptsReached', () => {
  it('returns true when LONG attempts >= maxBreakAttempts', () => {
    const ctx = makeContext({ longBreakAttempts: 2, maxBreakAttempts: 2 });
    expect(isMaxAttemptsReached(ctx, 'LONG')).toBe(true);
  });

  it('returns true when LONG attempts exceed max', () => {
    const ctx = makeContext({ longBreakAttempts: 3, maxBreakAttempts: 2 });
    expect(isMaxAttemptsReached(ctx, 'LONG')).toBe(true);
  });

  it('returns false when LONG attempts < maxBreakAttempts', () => {
    const ctx = makeContext({ longBreakAttempts: 1, maxBreakAttempts: 2 });
    expect(isMaxAttemptsReached(ctx, 'LONG')).toBe(false);
  });

  it('returns true when SHORT attempts >= maxBreakAttempts', () => {
    const ctx = makeContext({ shortBreakAttempts: 2, maxBreakAttempts: 2 });
    expect(isMaxAttemptsReached(ctx, 'SHORT')).toBe(true);
  });

  it('returns false when SHORT attempts < maxBreakAttempts', () => {
    const ctx = makeContext({ shortBreakAttempts: 0, maxBreakAttempts: 2 });
    expect(isMaxAttemptsReached(ctx, 'SHORT')).toBe(false);
  });

  it('returns true with 0 attempts allowed and 0 attempts made', () => {
    const ctx = makeContext({ longBreakAttempts: 0, maxBreakAttempts: 0 });
    expect(isMaxAttemptsReached(ctx, 'LONG')).toBe(true);
  });
});

describe('isMaxLongAttemptsReached', () => {
  it('delegates to isMaxAttemptsReached for LONG', () => {
    const ctx = makeContext({ longBreakAttempts: 2, maxBreakAttempts: 2 });
    expect(isMaxLongAttemptsReached(ctx)).toBe(true);
  });

  it('returns false when LONG attempts not exhausted', () => {
    const ctx = makeContext({ longBreakAttempts: 1, maxBreakAttempts: 2 });
    expect(isMaxLongAttemptsReached(ctx)).toBe(false);
  });
});

describe('isMaxShortAttemptsReached', () => {
  it('delegates to isMaxAttemptsReached for SHORT', () => {
    const ctx = makeContext({ shortBreakAttempts: 3, maxBreakAttempts: 2 });
    expect(isMaxShortAttemptsReached(ctx)).toBe(true);
  });

  it('returns false when SHORT attempts not exhausted', () => {
    const ctx = makeContext({ shortBreakAttempts: 0, maxBreakAttempts: 2 });
    expect(isMaxShortAttemptsReached(ctx)).toBe(false);
  });
});

describe('isSuperseded', () => {
  it('returns true when activeDirection is SHORT and checking LONG', () => {
    const ctx = makeContext({ activeDirection: 'SHORT' });
    expect(isSuperseded(ctx, 'LONG')).toBe(true);
  });

  it('returns true when activeDirection is LONG and checking SHORT', () => {
    const ctx = makeContext({ activeDirection: 'LONG' });
    expect(isSuperseded(ctx, 'SHORT')).toBe(true);
  });

  it('returns false when activeDirection is null', () => {
    const ctx = makeContext({ activeDirection: null });
    expect(isSuperseded(ctx, 'LONG')).toBe(false);
    expect(isSuperseded(ctx, 'SHORT')).toBe(false);
  });

  it('returns false when checking same direction as active', () => {
    const ctx = makeContext({ activeDirection: 'LONG' });
    expect(isSuperseded(ctx, 'LONG')).toBe(false);
  });
});

describe('isLongSuperseded', () => {
  it('returns true when activeDirection is SHORT', () => {
    const ctx = makeContext({ activeDirection: 'SHORT' });
    expect(isLongSuperseded(ctx)).toBe(true);
  });

  it('returns false when activeDirection is null', () => {
    const ctx = makeContext({ activeDirection: null });
    expect(isLongSuperseded(ctx)).toBe(false);
  });

  it('returns false when activeDirection is LONG', () => {
    const ctx = makeContext({ activeDirection: 'LONG' });
    expect(isLongSuperseded(ctx)).toBe(false);
  });
});

describe('isShortSuperseded', () => {
  it('returns true when activeDirection is LONG', () => {
    const ctx = makeContext({ activeDirection: 'LONG' });
    expect(isShortSuperseded(ctx)).toBe(true);
  });

  it('returns false when activeDirection is null', () => {
    const ctx = makeContext({ activeDirection: null });
    expect(isShortSuperseded(ctx)).toBe(false);
  });

  it('returns false when activeDirection is SHORT', () => {
    const ctx = makeContext({ activeDirection: 'SHORT' });
    expect(isShortSuperseded(ctx)).toBe(false);
  });
});

describe('isSessionEnd', () => {
  it('returns true for SESSION_END event', () => {
    const ctx = makeContext();
    expect(isSessionEnd(ctx, { type: 'SESSION_END' })).toBe(true);
  });

  it('returns false for NEW_BAR event', () => {
    const ctx = makeContext();
    const bar = makeCandle();
    expect(isSessionEnd(ctx, { type: 'NEW_BAR', candle: bar })).toBe(false);
  });

  it('returns false for SESSION_START event', () => {
    const ctx = makeContext();
    expect(isSessionEnd(ctx, { type: 'SESSION_START', date: '2024-01-02', symbol: 'SPY' })).toBe(false);
  });

  it('returns false for ERROR event', () => {
    const ctx = makeContext();
    expect(isSessionEnd(ctx, { type: 'ERROR', message: 'fail' })).toBe(false);
  });
});
