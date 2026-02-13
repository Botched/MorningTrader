import { describe, it, expect } from 'vitest';
import {
  computeTradeStats,
  computeWinRate,
  computeProfitFactor,
  computeAverageR,
  computeMaxDrawdown,
  computePerDirectionStats,
  aggregateMetrics,
} from '@core/metrics/aggregator.js';
import type { TradeOutcome, TradeResult } from '@core/models/trade.js';
import type { SessionContext } from '@core/models/session.js';
import type { Trade } from '@core/models/trade.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeOutcome = (result: TradeResult, realizedR: number, tradeId = 'test'): TradeOutcome => ({
  tradeId,
  result,
  maxFavorableR: Math.abs(realizedR),
  maxAdverseR: 0,
  exitPrice: 15000,
  exitTimestamp: Date.now(),
  realizedR,
  firstThresholdReached: 0,
  timestamp1R: 0,
  timestamp2R: 0,
  timestamp3R: 0,
  timestampStop: 0,
  barsHeld: 5,
});

/** Minimal Trade stub for per-direction tests. */
function makeTrade(id: string, direction: 'LONG' | 'SHORT'): Trade {
  return {
    id,
    symbol: 'SPY',
    direction,
    entryPrice: 15000,
    stopLevel: direction === 'LONG' ? 14900 : 15100,
    currentStop: direction === 'LONG' ? 14900 : 15100,
    rValue: 100,
    target1R: direction === 'LONG' ? 15100 : 14900,
    target2R: direction === 'LONG' ? 15200 : 14800,
    target3R: direction === 'LONG' ? 15300 : 14700,
    entryTimestamp: Date.now(),
    status: 'OPEN',
    entrySignal: {
      direction,
      type: 'BREAK',
      timestamp: Date.now(),
      price: 15000,
      triggerCandle: {
        timestamp: Date.now(),
        open: 15000,
        high: 15100,
        low: 14900,
        close: 15050,
        volume: 1000,
        completed: true,
        barSizeMinutes: 5,
      },
      attemptNumber: 1,
    },
  };
}

/** Minimal SessionContext factory for aggregateMetrics tests. */
function makeSession(
  outcomes: TradeOutcome[],
  trades: Trade[],
): SessionContext {
  return {
    date: '2025-01-15',
    symbol: 'SPY',
    zone: null,
    signals: [],
    trades,
    outcomes,
    allBars: [],
    status: 'COMPLETE',
    isBacktest: false,
    executionMode: 'MOCK',
    startedAt: Date.now(),
    completedAt: Date.now(),
    error: null,
  };
}

// ===========================================================================
// computeWinRate
// ===========================================================================
describe('computeWinRate', () => {
  it('3 wins, 2 losses => 60%', () => {
    const outcomes: TradeOutcome[] = [
      makeOutcome('WIN_2R', 2),
      makeOutcome('WIN_3R', 3),
      makeOutcome('WIN_2R', 2),
      makeOutcome('LOSS', -1),
      makeOutcome('LOSS', -1),
    ];
    expect(computeWinRate(outcomes)).toBe(60);
  });

  it('all wins => 100%', () => {
    const outcomes: TradeOutcome[] = [
      makeOutcome('WIN_2R', 2),
      makeOutcome('WIN_3R', 3),
    ];
    expect(computeWinRate(outcomes)).toBe(100);
  });

  it('all losses => 0%', () => {
    const outcomes: TradeOutcome[] = [
      makeOutcome('LOSS', -1),
      makeOutcome('LOSS', -1),
    ];
    expect(computeWinRate(outcomes)).toBe(0);
  });

  it('empty array => 0', () => {
    expect(computeWinRate([])).toBe(0);
  });

  it('BREAKEVEN_STOP and SESSION_TIMEOUT are not wins', () => {
    const outcomes: TradeOutcome[] = [
      makeOutcome('WIN_2R', 2),
      makeOutcome('BREAKEVEN_STOP', 0),
      makeOutcome('SESSION_TIMEOUT', -0.2),
      makeOutcome('LOSS', -1),
    ];
    // 1 win out of 4 = 25%
    expect(computeWinRate(outcomes)).toBe(25);
  });
});

// ===========================================================================
// computeProfitFactor
// ===========================================================================
describe('computeProfitFactor', () => {
  it('gross profit / gross loss: 2R + 3R wins vs -1R + -1R losses => 5/2 = 2.5', () => {
    const outcomes: TradeOutcome[] = [
      makeOutcome('WIN_2R', 2),
      makeOutcome('WIN_3R', 3),
      makeOutcome('LOSS', -1),
      makeOutcome('LOSS', -1),
    ];
    expect(computeProfitFactor(outcomes)).toBe(2.5);
  });

  it('no losses => Infinity', () => {
    const outcomes: TradeOutcome[] = [
      makeOutcome('WIN_2R', 2),
      makeOutcome('WIN_3R', 3),
    ];
    expect(computeProfitFactor(outcomes)).toBe(Infinity);
  });

  it('no wins => 0', () => {
    const outcomes: TradeOutcome[] = [
      makeOutcome('LOSS', -1),
      makeOutcome('LOSS', -1),
    ];
    expect(computeProfitFactor(outcomes)).toBe(0);
  });

  it('empty array => 0', () => {
    expect(computeProfitFactor([])).toBe(0);
  });

  it('no wins and no losses (all breakeven) => 0', () => {
    const outcomes: TradeOutcome[] = [
      makeOutcome('BREAKEVEN_STOP', 0),
      makeOutcome('BREAKEVEN_STOP', 0),
    ];
    // grossProfit = 0, grossLoss = 0 => grossLoss === 0 => grossProfit > 0 ? Infinity : 0 => 0
    expect(computeProfitFactor(outcomes)).toBe(0);
  });

  it('handles fractional R values', () => {
    const outcomes: TradeOutcome[] = [
      makeOutcome('WIN_2R', 1.5),
      makeOutcome('LOSS', -0.5),
    ];
    // 1.5 / 0.5 = 3.0
    expect(computeProfitFactor(outcomes)).toBe(3);
  });
});

// ===========================================================================
// computeMaxDrawdown
// ===========================================================================
describe('computeMaxDrawdown', () => {
  it('consecutive losses: -1R, -1R, -1R => drawdown = 3R', () => {
    const outcomes: TradeOutcome[] = [
      makeOutcome('LOSS', -1),
      makeOutcome('LOSS', -1),
      makeOutcome('LOSS', -1),
    ];
    expect(computeMaxDrawdown(outcomes)).toBe(3);
  });

  it('win then losses: +2R, -1R, -1R => drawdown = 2R', () => {
    const outcomes: TradeOutcome[] = [
      makeOutcome('WIN_2R', 2),
      makeOutcome('LOSS', -1),
      makeOutcome('LOSS', -1),
    ];
    // cumR: 2, 1, 0 | peak: 2, 2, 2 | drawdown: 0, 1, 2 => max = 2
    expect(computeMaxDrawdown(outcomes)).toBe(2);
  });

  it('no losses => 0', () => {
    const outcomes: TradeOutcome[] = [
      makeOutcome('WIN_2R', 2),
      makeOutcome('WIN_3R', 3),
    ];
    expect(computeMaxDrawdown(outcomes)).toBe(0);
  });

  it('empty array => 0', () => {
    expect(computeMaxDrawdown([])).toBe(0);
  });

  it('single losing trade', () => {
    const outcomes: TradeOutcome[] = [makeOutcome('LOSS', -1)];
    // cumR: -1 | peak: 0 | drawdown: 1
    expect(computeMaxDrawdown(outcomes)).toBe(1);
  });

  it('single winning trade', () => {
    const outcomes: TradeOutcome[] = [makeOutcome('WIN_2R', 2)];
    expect(computeMaxDrawdown(outcomes)).toBe(0);
  });

  it('recovery then new drawdown: +3R, -1R, +2R, -2R, -1R', () => {
    const outcomes: TradeOutcome[] = [
      makeOutcome('WIN_3R', 3),
      makeOutcome('LOSS', -1),
      makeOutcome('WIN_2R', 2),
      makeOutcome('LOSS', -2),
      makeOutcome('LOSS', -1),
    ];
    // cumR: 3, 2, 4, 2, 1 | peak: 3, 3, 4, 4, 4 | drawdown: 0, 1, 0, 2, 3 => max = 3
    expect(computeMaxDrawdown(outcomes)).toBe(3);
  });
});

// ===========================================================================
// computeAverageR
// ===========================================================================
describe('computeAverageR', () => {
  it('mixed results: average of all realizedR values', () => {
    const outcomes: TradeOutcome[] = [
      makeOutcome('WIN_2R', 2),
      makeOutcome('WIN_3R', 3),
      makeOutcome('LOSS', -1),
      makeOutcome('LOSS', -1),
    ];
    // (2 + 3 - 1 - 1) / 4 = 0.75
    expect(computeAverageR(outcomes)).toBe(0.75);
  });

  it('single trade', () => {
    const outcomes: TradeOutcome[] = [makeOutcome('WIN_2R', 2)];
    expect(computeAverageR(outcomes)).toBe(2);
  });

  it('empty array => 0', () => {
    expect(computeAverageR([])).toBe(0);
  });

  it('all negative', () => {
    const outcomes: TradeOutcome[] = [
      makeOutcome('LOSS', -1),
      makeOutcome('LOSS', -0.5),
    ];
    // (-1 + -0.5) / 2 = -0.75
    expect(computeAverageR(outcomes)).toBe(-0.75);
  });

  it('rounds to 2 decimal places', () => {
    const outcomes: TradeOutcome[] = [
      makeOutcome('WIN_2R', 2),
      makeOutcome('LOSS', -1),
      makeOutcome('LOSS', -1),
    ];
    // (2 - 1 - 1) / 3 = 0
    expect(computeAverageR(outcomes)).toBe(0);
  });
});

// ===========================================================================
// computeTradeStats
// ===========================================================================
describe('computeTradeStats', () => {
  it('counts: total, wins, losses, breakeven, timeouts', () => {
    const outcomes: TradeOutcome[] = [
      makeOutcome('WIN_2R', 2),
      makeOutcome('WIN_3R', 3),
      makeOutcome('LOSS', -1),
      makeOutcome('BREAKEVEN_STOP', 0),
      makeOutcome('SESSION_TIMEOUT', -0.2),
    ];
    const stats = computeTradeStats(outcomes);
    expect(stats.totalTrades).toBe(5);
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(1);
    expect(stats.breakeven).toBe(1);
    expect(stats.timeouts).toBe(1);
  });

  it('all same type (all wins)', () => {
    const outcomes: TradeOutcome[] = [
      makeOutcome('WIN_2R', 2),
      makeOutcome('WIN_2R', 2),
      makeOutcome('WIN_3R', 3),
    ];
    const stats = computeTradeStats(outcomes);
    expect(stats.totalTrades).toBe(3);
    expect(stats.wins).toBe(3);
    expect(stats.losses).toBe(0);
    expect(stats.breakeven).toBe(0);
    expect(stats.timeouts).toBe(0);
  });

  it('all same type (all losses)', () => {
    const outcomes: TradeOutcome[] = [
      makeOutcome('LOSS', -1),
      makeOutcome('LOSS', -1),
    ];
    const stats = computeTradeStats(outcomes);
    expect(stats.totalTrades).toBe(2);
    expect(stats.wins).toBe(0);
    expect(stats.losses).toBe(2);
    expect(stats.breakeven).toBe(0);
    expect(stats.timeouts).toBe(0);
  });

  it('empty array', () => {
    const stats = computeTradeStats([]);
    expect(stats.totalTrades).toBe(0);
    expect(stats.wins).toBe(0);
    expect(stats.losses).toBe(0);
    expect(stats.breakeven).toBe(0);
    expect(stats.timeouts).toBe(0);
  });

  it('WIN_2R and WIN_3R both count as wins', () => {
    const outcomes: TradeOutcome[] = [
      makeOutcome('WIN_2R', 2),
      makeOutcome('WIN_3R', 3),
    ];
    const stats = computeTradeStats(outcomes);
    expect(stats.wins).toBe(2);
  });
});

// ===========================================================================
// computePerDirectionStats
// ===========================================================================
describe('computePerDirectionStats', () => {
  it('filters by LONG correctly', () => {
    const trades = [
      makeTrade('t1', 'LONG'),
      makeTrade('t2', 'SHORT'),
      makeTrade('t3', 'LONG'),
    ];
    const outcomes: TradeOutcome[] = [
      makeOutcome('WIN_2R', 2, 't1'),
      makeOutcome('LOSS', -1, 't2'),
      makeOutcome('LOSS', -1, 't3'),
    ];
    const stats = computePerDirectionStats(outcomes, 'LONG', trades);
    expect(stats.totalTrades).toBe(2);
    expect(stats.wins).toBe(1);
    expect(stats.losses).toBe(1);
    // winRate = (1/2) * 100 = 50
    expect(stats.winRate).toBe(50);
    // averageR = (2 + -1) / 2 = 0.5
    expect(stats.averageR).toBe(0.5);
  });

  it('filters by SHORT correctly', () => {
    const trades = [
      makeTrade('t1', 'LONG'),
      makeTrade('t2', 'SHORT'),
      makeTrade('t3', 'SHORT'),
    ];
    const outcomes: TradeOutcome[] = [
      makeOutcome('WIN_2R', 2, 't1'),
      makeOutcome('WIN_3R', 3, 't2'),
      makeOutcome('LOSS', -1, 't3'),
    ];
    const stats = computePerDirectionStats(outcomes, 'SHORT', trades);
    expect(stats.totalTrades).toBe(2);
    expect(stats.wins).toBe(1);
    expect(stats.losses).toBe(1);
    // winRate = (1/2) * 100 = 50
    expect(stats.winRate).toBe(50);
    // averageR = (3 + -1) / 2 = 1.0
    expect(stats.averageR).toBe(1);
  });

  it('separate win rates per direction', () => {
    const trades = [
      makeTrade('t1', 'LONG'),
      makeTrade('t2', 'LONG'),
      makeTrade('t3', 'SHORT'),
    ];
    const outcomes: TradeOutcome[] = [
      makeOutcome('WIN_2R', 2, 't1'),
      makeOutcome('WIN_3R', 3, 't2'),
      makeOutcome('LOSS', -1, 't3'),
    ];

    const longStats = computePerDirectionStats(outcomes, 'LONG', trades);
    const shortStats = computePerDirectionStats(outcomes, 'SHORT', trades);

    expect(longStats.winRate).toBe(100);
    expect(shortStats.winRate).toBe(0);
  });

  it('no trades of given direction => all zeros', () => {
    const trades = [makeTrade('t1', 'LONG')];
    const outcomes: TradeOutcome[] = [makeOutcome('WIN_2R', 2, 't1')];
    const stats = computePerDirectionStats(outcomes, 'SHORT', trades);
    expect(stats.totalTrades).toBe(0);
    expect(stats.wins).toBe(0);
    expect(stats.losses).toBe(0);
    expect(stats.winRate).toBe(0);
    expect(stats.averageR).toBe(0);
  });
});

// ===========================================================================
// aggregateMetrics
// ===========================================================================
describe('aggregateMetrics', () => {
  it('combines multiple sessions into aggregate stats', () => {
    const session1Trades = [makeTrade('s1t1', 'LONG'), makeTrade('s1t2', 'SHORT')];
    const session1Outcomes: TradeOutcome[] = [
      makeOutcome('WIN_2R', 2, 's1t1'),
      makeOutcome('LOSS', -1, 's1t2'),
    ];

    const session2Trades = [makeTrade('s2t1', 'LONG')];
    const session2Outcomes: TradeOutcome[] = [
      makeOutcome('WIN_3R', 3, 's2t1'),
    ];

    const sessions = [
      makeSession(session1Outcomes, session1Trades),
      makeSession(session2Outcomes, session2Trades),
    ];

    const result = aggregateMetrics(sessions);

    // Total: 3 trades, 2 wins (WIN_2R, WIN_3R), 1 loss
    expect(result.stats.totalTrades).toBe(3);
    expect(result.stats.wins).toBe(2);
    expect(result.stats.losses).toBe(1);
    expect(result.stats.breakeven).toBe(0);
    expect(result.stats.timeouts).toBe(0);

    // winRate = (2/3) * 100 = 66.67
    expect(result.winRate).toBe(66.67);

    // profitFactor = (2 + 3) / 1 = 5
    expect(result.profitFactor).toBe(5);

    // averageR = (2 + -1 + 3) / 3 = 1.33
    expect(result.averageR).toBe(1.33);

    // totalR = 2 + -1 + 3 = 4
    expect(result.totalR).toBe(4);

    // maxDrawdownR: cumR = 2, 1, 4 | peak = 2, 2, 4 | dd = 0, 1, 0 => 1
    expect(result.maxDrawdownR).toBe(1);

    // LONG stats: s1t1 (WIN_2R, +2R) + s2t1 (WIN_3R, +3R) => 2 trades, 2 wins
    expect(result.longStats.totalTrades).toBe(2);
    expect(result.longStats.wins).toBe(2);
    expect(result.longStats.winRate).toBe(100);
    expect(result.longStats.averageR).toBe(2.5);

    // SHORT stats: s1t2 (LOSS, -1R) => 1 trade, 0 wins, 1 loss
    expect(result.shortStats.totalTrades).toBe(1);
    expect(result.shortStats.wins).toBe(0);
    expect(result.shortStats.losses).toBe(1);
    expect(result.shortStats.winRate).toBe(0);
    expect(result.shortStats.averageR).toBe(-1);
  });

  it('empty sessions array', () => {
    const result = aggregateMetrics([]);

    expect(result.stats.totalTrades).toBe(0);
    expect(result.stats.wins).toBe(0);
    expect(result.stats.losses).toBe(0);
    expect(result.stats.breakeven).toBe(0);
    expect(result.stats.timeouts).toBe(0);
    expect(result.winRate).toBe(0);
    expect(result.profitFactor).toBe(0);
    expect(result.averageR).toBe(0);
    expect(result.maxDrawdownR).toBe(0);
    expect(result.totalR).toBe(0);
    expect(result.longStats.totalTrades).toBe(0);
    expect(result.shortStats.totalTrades).toBe(0);
  });

  it('single session with mixed results', () => {
    const trades = [
      makeTrade('t1', 'LONG'),
      makeTrade('t2', 'SHORT'),
      makeTrade('t3', 'LONG'),
      makeTrade('t4', 'SHORT'),
    ];
    const outcomes: TradeOutcome[] = [
      makeOutcome('WIN_3R', 3, 't1'),
      makeOutcome('WIN_2R', 2, 't2'),
      makeOutcome('LOSS', -1, 't3'),
      makeOutcome('BREAKEVEN_STOP', 0, 't4'),
    ];

    const sessions = [makeSession(outcomes, trades)];
    const result = aggregateMetrics(sessions);

    expect(result.stats.totalTrades).toBe(4);
    expect(result.stats.wins).toBe(2);
    expect(result.stats.losses).toBe(1);
    expect(result.stats.breakeven).toBe(1);
    expect(result.winRate).toBe(50);
    // totalR = 3 + 2 - 1 + 0 = 4
    expect(result.totalR).toBe(4);
    // averageR = 4 / 4 = 1.0
    expect(result.averageR).toBe(1);
  });
});
