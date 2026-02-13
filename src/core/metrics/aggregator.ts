import type { TradeOutcome, SessionContext } from '../models/index.js';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface TradeStats {
  readonly totalTrades: number;
  readonly wins: number;
  readonly losses: number;
  readonly breakeven: number;
  readonly timeouts: number;
}

export interface DirectionStats {
  readonly totalTrades: number;
  readonly wins: number;
  readonly losses: number;
  readonly winRate: number;
  readonly averageR: number;
}

export interface AggregateMetrics {
  readonly stats: TradeStats;
  readonly winRate: number;
  readonly profitFactor: number;
  readonly averageR: number;
  readonly maxDrawdownR: number;
  readonly totalR: number;
  readonly longStats: DirectionStats;
  readonly shortStats: DirectionStats;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Round a number to 2 decimal places. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function isWin(result: TradeOutcome['result']): boolean {
  return result === 'WIN_2R' || result === 'WIN_3R';
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Compute basic trade statistics from outcomes.
 */
export function computeTradeStats(outcomes: readonly TradeOutcome[]): TradeStats {
  let wins = 0;
  let losses = 0;
  let breakeven = 0;
  let timeouts = 0;

  for (const o of outcomes) {
    switch (o.result) {
      case 'WIN_2R':
      case 'WIN_3R':
        wins++;
        break;
      case 'LOSS':
        losses++;
        break;
      case 'BREAKEVEN_STOP':
        breakeven++;
        break;
      case 'SESSION_TIMEOUT':
        timeouts++;
        break;
    }
  }

  return {
    totalTrades: outcomes.length,
    wins,
    losses,
    breakeven,
    timeouts,
  };
}

/**
 * Compute win rate as percentage.
 * Returns 0 if no trades.
 */
export function computeWinRate(outcomes: readonly TradeOutcome[]): number {
  if (outcomes.length === 0) return 0;
  const wins = outcomes.filter((o) => isWin(o.result)).length;
  return round2((wins / outcomes.length) * 100);
}

/**
 * Compute profit factor: sum of positive R / abs(sum of negative R).
 * Returns Infinity if no losses, 0 if no wins.
 */
export function computeProfitFactor(outcomes: readonly TradeOutcome[]): number {
  let grossProfit = 0;
  let grossLoss = 0;

  for (const o of outcomes) {
    if (o.realizedR > 0) {
      grossProfit += o.realizedR;
    } else if (o.realizedR < 0) {
      grossLoss += Math.abs(o.realizedR);
    }
  }

  if (grossLoss === 0) {
    return grossProfit > 0 ? Infinity : 0;
  }

  return round2(grossProfit / grossLoss);
}

/**
 * Compute average realized R-multiple across all outcomes.
 * Returns 0 if no trades.
 */
export function computeAverageR(outcomes: readonly TradeOutcome[]): number {
  if (outcomes.length === 0) return 0;
  const totalR = outcomes.reduce((sum, o) => sum + o.realizedR, 0);
  return round2(totalR / outcomes.length);
}

/**
 * Compute maximum drawdown in R-multiples.
 * Tracks cumulative R, finds max peak-to-trough decline.
 * Returns 0 if no drawdown (all wins or no trades).
 */
export function computeMaxDrawdown(outcomes: readonly TradeOutcome[]): number {
  if (outcomes.length === 0) return 0;

  let cumulativeR = 0;
  let peakR = 0;
  let maxDrawdown = 0;

  for (const o of outcomes) {
    cumulativeR += o.realizedR;
    if (cumulativeR > peakR) {
      peakR = cumulativeR;
    }
    const drawdown = peakR - cumulativeR;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return round2(maxDrawdown);
}

/**
 * Compute per-direction statistics.
 * Needs access to the trades to know direction, matched via tradeId.
 */
export function computePerDirectionStats(
  outcomes: readonly TradeOutcome[],
  direction: 'LONG' | 'SHORT',
  trades: readonly { id: string; direction: 'LONG' | 'SHORT' }[],
): DirectionStats {
  const tradeIdSet = new Set(
    trades.filter((t) => t.direction === direction).map((t) => t.id),
  );

  const filtered = outcomes.filter((o) => tradeIdSet.has(o.tradeId));

  const wins = filtered.filter((o) => isWin(o.result)).length;
  const losses = filtered.filter((o) => o.result === 'LOSS').length;
  const totalTrades = filtered.length;
  const winRate = totalTrades === 0 ? 0 : round2((wins / totalTrades) * 100);
  const averageR =
    totalTrades === 0
      ? 0
      : round2(filtered.reduce((sum, o) => sum + o.realizedR, 0) / totalTrades);

  return {
    totalTrades,
    wins,
    losses,
    winRate,
    averageR,
  };
}

/**
 * Full aggregate metrics across multiple sessions.
 */
export function aggregateMetrics(
  sessions: readonly SessionContext[],
): AggregateMetrics {
  // Flatten all outcomes and trades from every session.
  const allOutcomes: TradeOutcome[] = [];
  const allTrades: { id: string; direction: 'LONG' | 'SHORT' }[] = [];

  for (const session of sessions) {
    for (const outcome of session.outcomes) {
      allOutcomes.push(outcome);
    }
    for (const trade of session.trades) {
      allTrades.push({ id: trade.id, direction: trade.direction });
    }
  }

  const stats = computeTradeStats(allOutcomes);
  const winRate = computeWinRate(allOutcomes);
  const profitFactor = computeProfitFactor(allOutcomes);
  const averageR = computeAverageR(allOutcomes);
  const maxDrawdownR = computeMaxDrawdown(allOutcomes);
  const totalR = round2(allOutcomes.reduce((sum, o) => sum + o.realizedR, 0));
  const longStats = computePerDirectionStats(allOutcomes, 'LONG', allTrades);
  const shortStats = computePerDirectionStats(allOutcomes, 'SHORT', allTrades);

  return {
    stats,
    winRate,
    profitFactor,
    averageR,
    maxDrawdownR,
    totalR,
    longStats,
    shortStats,
  };
}
