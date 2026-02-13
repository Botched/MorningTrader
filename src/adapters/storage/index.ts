// Barrel export for adapters/storage
export type { Migration } from './migrations/index.js';
export { migration001, runMigrations } from './migrations/index.js';
export { SQLiteAdapter } from './sqlite-adapter.js';

// Query modules
export {
  createSessionQueries,
  mapSessionRow,
  createTradeQueries,
  mapTradeRow,
  mapOutcomeRow,
  createAggregationQueries,
} from './queries/index.js';
export type {
  SessionRow,
  TradeRow,
  OutcomeRow,
  WinLossRow,
  PerSymbolStatsRow,
  DailyStatsRow,
} from './queries/index.js';
