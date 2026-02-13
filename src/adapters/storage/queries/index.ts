// Barrel export for adapters/storage/queries
export {
  createSessionQueries,
  mapSessionRow,
} from './sessions.js';
export type { SessionRow } from './sessions.js';

export {
  createTradeQueries,
  mapTradeRow,
  mapOutcomeRow,
} from './trades.js';
export type { TradeRow, OutcomeRow } from './trades.js';

export {
  createAggregationQueries,
} from './aggregations.js';
export type {
  WinLossRow,
  PerSymbolStatsRow,
  DailyStatsRow,
} from './aggregations.js';

export {
  createDashboardQueries,
} from './dashboard.js';
export type {
  SessionListRow,
  OverviewStatsRow,
  EquityCurvePoint,
  SymbolListRow,
} from './dashboard.js';
