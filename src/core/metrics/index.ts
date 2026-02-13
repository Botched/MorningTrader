// Barrel export for core/metrics
export type { TradeStats, DirectionStats, AggregateMetrics } from './aggregator.js';
export {
  computeTradeStats,
  computeWinRate,
  computeProfitFactor,
  computeAverageR,
  computeMaxDrawdown,
  computePerDirectionStats,
  aggregateMetrics,
} from './aggregator.js';
