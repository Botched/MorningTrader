import type Database from 'better-sqlite3';
import type {
  Trade,
  TradeDirection,
  TradeStatus,
  TradeOutcome,
  TradeResult,
  Signal,
} from '../../../core/models/index.js';

// ── Row types matching the database tables ────────────────────────────

export interface TradeRow {
  id: string;
  session_id: number;
  symbol: string;
  direction: string;
  entry_price: number;
  initial_stop: number;
  current_stop: number;
  r_value: number;
  target_1r: number;
  target_2r: number;
  target_3r: number;
  entry_timestamp: number;
  status: string;
}

export interface OutcomeRow {
  trade_id: string;
  result: string;
  max_favorable_r: number;
  max_adverse_r: number;
  exit_price: number;
  exit_timestamp: number;
  realized_r: number;
  first_threshold: number;
  timestamp_1r: number;
  timestamp_2r: number;
  timestamp_3r: number;
  timestamp_stop: number;
  bars_held: number;
}

// ── Row → Model mapping ──────────────────────────────────────────────

/**
 * Map a TradeRow to the Trade model type.
 *
 * The `entrySignal` field cannot be fully reconstructed from the trades
 * table alone (signals are stored separately and contain a triggerCandle
 * that is not persisted).  A **stub** Signal is created with only the
 * data that can be inferred from the trade row itself.  Callers that
 * need the full Signal should enrich the result from the signals table.
 */
export function mapTradeRow(row: TradeRow): Trade {
  const stubSignal: Signal = {
    direction: row.direction as Trade['entrySignal']['direction'],
    type: 'CONFIRMATION',
    timestamp: row.entry_timestamp,
    price: row.entry_price,
    triggerCandle: {
      timestamp: row.entry_timestamp,
      open: 0,
      high: 0,
      low: 0,
      close: row.entry_price,
      volume: 0,
      completed: true,
      barSizeMinutes: 5,
    },
    attemptNumber: 1,
  };

  return {
    id: row.id,
    symbol: row.symbol,
    direction: row.direction as TradeDirection,
    entryPrice: row.entry_price,
    stopLevel: row.initial_stop,
    currentStop: row.current_stop,
    rValue: row.r_value,
    target1R: row.target_1r,
    target2R: row.target_2r,
    target3R: row.target_3r,
    entryTimestamp: row.entry_timestamp,
    status: row.status as TradeStatus,
    entrySignal: stubSignal,
  };
}

/**
 * Map an OutcomeRow to the TradeOutcome model type.
 */
export function mapOutcomeRow(row: OutcomeRow): TradeOutcome {
  return {
    tradeId: row.trade_id,
    result: row.result as TradeResult,
    maxFavorableR: row.max_favorable_r,
    maxAdverseR: row.max_adverse_r,
    exitPrice: row.exit_price,
    exitTimestamp: row.exit_timestamp,
    realizedR: row.realized_r,
    firstThresholdReached: row.first_threshold as 0 | 1 | 2 | 3,
    timestamp1R: row.timestamp_1r,
    timestamp2R: row.timestamp_2r,
    timestamp3R: row.timestamp_3r,
    timestampStop: row.timestamp_stop,
    barsHeld: row.bars_held,
  };
}

// ── Factory ──────────────────────────────────────────────────────────

export function createTradeQueries(db: Database.Database) {
  // ── Prepared statements ──

  const insertTrade = db.prepare(`
    INSERT INTO trades
      (id, session_id, symbol, direction, entry_price, initial_stop,
       current_stop, r_value, target_1r, target_2r, target_3r,
       entry_timestamp, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertOutcome = db.prepare(`
    INSERT INTO trade_outcomes
      (trade_id, result, max_favorable_r, max_adverse_r, exit_price,
       exit_timestamp, realized_r, first_threshold, timestamp_1r,
       timestamp_2r, timestamp_3r, timestamp_stop, bars_held)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const selectBySession = db.prepare(`
    SELECT * FROM trades WHERE session_id = ?
  `);

  const selectByDateRange = db.prepare(`
    SELECT t.* FROM trades t
    JOIN sessions s ON t.session_id = s.id
    WHERE s.date BETWEEN ? AND ?
    ORDER BY t.entry_timestamp ASC
  `);

  const selectByDateRangeAndSymbol = db.prepare(`
    SELECT t.* FROM trades t
    JOIN sessions s ON t.session_id = s.id
    WHERE s.date BETWEEN ? AND ? AND t.symbol = ?
    ORDER BY t.entry_timestamp ASC
  `);

  const selectOutcomeByTradeId = db.prepare(`
    SELECT * FROM trade_outcomes WHERE trade_id = ?
  `);

  const selectOutcomesByDateRange = db.prepare(`
    SELECT o.* FROM trade_outcomes o
    JOIN trades t ON o.trade_id = t.id
    JOIN sessions s ON t.session_id = s.id
    WHERE s.date BETWEEN ? AND ?
    ORDER BY o.exit_timestamp ASC
  `);

  const selectOutcomesByDateRangeAndSymbol = db.prepare(`
    SELECT o.* FROM trade_outcomes o
    JOIN trades t ON o.trade_id = t.id
    JOIN sessions s ON t.session_id = s.id
    WHERE s.date BETWEEN ? AND ? AND t.symbol = ?
    ORDER BY o.exit_timestamp ASC
  `);

  return {
    /**
     * Insert a trade linked to its session.
     */
    insert(trade: Trade, sessionId: number): void {
      insertTrade.run(
        trade.id,
        sessionId,
        trade.symbol,
        trade.direction,
        trade.entryPrice,
        trade.stopLevel,
        trade.currentStop,
        trade.rValue,
        trade.target1R,
        trade.target2R,
        trade.target3R,
        trade.entryTimestamp,
        trade.status,
      );
    },

    /**
     * Insert a trade outcome.
     */
    insertOutcome(outcome: TradeOutcome): void {
      insertOutcome.run(
        outcome.tradeId,
        outcome.result,
        outcome.maxFavorableR,
        outcome.maxAdverseR,
        outcome.exitPrice,
        outcome.exitTimestamp,
        outcome.realizedR,
        outcome.firstThresholdReached,
        outcome.timestamp1R,
        outcome.timestamp2R,
        outcome.timestamp3R,
        outcome.timestampStop,
        outcome.barsHeld,
      );
    },

    /**
     * Get all trades for a given session.
     */
    getBySessionId(sessionId: number): TradeRow[] {
      return selectBySession.all(sessionId) as TradeRow[];
    },

    /**
     * Get trades in a date range, optionally filtered by symbol.
     */
    getByDateRange(
      from: string,
      to: string,
      symbol?: string,
    ): TradeRow[] {
      if (symbol) {
        return selectByDateRangeAndSymbol.all(
          from,
          to,
          symbol,
        ) as TradeRow[];
      }
      return selectByDateRange.all(from, to) as TradeRow[];
    },

    /**
     * Get the outcome for a single trade.
     */
    getOutcomeByTradeId(tradeId: string): OutcomeRow | undefined {
      return selectOutcomeByTradeId.get(tradeId) as
        | OutcomeRow
        | undefined;
    },

    /**
     * Get outcomes in a date range, optionally filtered by symbol.
     */
    getOutcomesByDateRange(
      from: string,
      to: string,
      symbol?: string,
    ): OutcomeRow[] {
      if (symbol) {
        return selectOutcomesByDateRangeAndSymbol.all(
          from,
          to,
          symbol,
        ) as OutcomeRow[];
      }
      return selectOutcomesByDateRange.all(from, to) as OutcomeRow[];
    },
  };
}
