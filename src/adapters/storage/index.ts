// Barrel export for adapters/storage
export type { Migration } from './migrations/index.js';
export { migration001, runMigrations } from './migrations/index.js';
export { migration002 } from './migrations/index.js';
export { SQLiteAdapter } from './sqlite-adapter.js';

// Query modules
export {
  createSessionQueries,
  mapSessionRow,
  createTradeQueries,
  mapTradeRow,
  mapOutcomeRow,
  createAggregationQueries,
  createDashboardQueries,
} from './queries/index.js';
export type {
  SessionRow,
  TradeRow,
  OutcomeRow,
  WinLossRow,
  PerSymbolStatsRow,
  DailyStatsRow,
  SessionListRow,
  OverviewStatsRow,
  EquityCurvePoint,
  SymbolListRow,
} from './queries/index.js';
