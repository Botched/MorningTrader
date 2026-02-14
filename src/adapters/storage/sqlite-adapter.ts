import Database from 'better-sqlite3';
import type { StorageProvider } from '../../core/interfaces/storage.js';
import type {
  SessionContext,
  SessionStatus,
  ExecutionMode,
} from '../../core/models/session.js';
import type { Trade, TradeOutcome, TradeResult, TradeDirection, TradeStatus } from '../../core/models/trade.js';
import type { Signal, SignalDirection, SignalType } from '../../core/models/signal.js';
import type { DecisionZoneStatus } from '../../core/models/decision-zone.js';
import type { Candle } from '../../core/models/candle.js';
import { migration001, runMigrations } from './migrations/001-initial.js';
import { migration002 } from './migrations/002-bars.js';
import { migration003 } from './migrations/003-v2-features.js';

// ── Row types returned by better-sqlite3 ────────────────────────────

interface SessionRow {
  id: number;
  date: string;
  symbol: string;
  status: string;
  zone_resistance: number | null;
  zone_support: number | null;
  zone_status: string | null;
  execution_mode: string;
  started_at: number;
  completed_at: number | null;
  is_backtest: number;
  error: string | null;
}

interface TradeRow {
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

interface OutcomeRow {
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

interface BarRow {
  id: number;
  session_id: number;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  completed: number;
  bar_size_minutes: number;
}

// ── Helpers ──────────────────────────────────────────────────────────

function rowToCandle(row: BarRow): Candle {
  return {
    timestamp: row.timestamp,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
    completed: row.completed === 1,
    barSizeMinutes: 5,
  };
}

const EMPTY_CANDLE: Candle = {
  timestamp: 0,
  open: 0,
  high: 0,
  low: 0,
  close: 0,
  volume: 0,
  completed: false,
  barSizeMinutes: 5,
};

function rowToSession(row: SessionRow): SessionContext {
  return {
    date: row.date,
    symbol: row.symbol,
    status: row.status as SessionStatus,
    zone:
      row.zone_resistance !== null &&
      row.zone_support !== null &&
      row.zone_status !== null
        ? {
            resistance: row.zone_resistance,
            support: row.zone_support,
            status: row.zone_status as DecisionZoneStatus,
            spread: row.zone_resistance - row.zone_support,
            definedAt: 0,
            sourceBars: [],
            premarketPrice: 0,
          }
        : null,
    signals: [],
    trades: [],
    outcomes: [],
    allBars: [],
    executionMode: row.execution_mode as ExecutionMode,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? 0,
    isBacktest: row.is_backtest === 1,
    error: row.error,
  };
}

function rowToTrade(row: TradeRow): Trade {
  const direction = row.direction as TradeDirection;
  const entrySignal: Signal = {
    direction: direction as SignalDirection,
    type: 'CONFIRMATION' as SignalType,
    timestamp: row.entry_timestamp,
    price: row.entry_price,
    triggerCandle: EMPTY_CANDLE,
    attemptNumber: 1,
  };

  return {
    id: row.id,
    symbol: row.symbol,
    direction,
    entryPrice: row.entry_price,
    stopLevel: row.initial_stop,
    currentStop: row.current_stop,
    rValue: row.r_value,
    target1R: row.target_1r,
    target2R: row.target_2r,
    target3R: row.target_3r,
    entryTimestamp: row.entry_timestamp,
    status: row.status as TradeStatus,
    entrySignal,
  };
}

function rowToOutcome(row: OutcomeRow): TradeOutcome {
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

// ── SQLiteAdapter ────────────────────────────────────────────────────

export class SQLiteAdapter implements StorageProvider {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  initialize(): void {
    runMigrations(this.db, [migration001, migration002, migration003]);

    const result = this.db.pragma('integrity_check') as { integrity_check: string }[];
    const status = result[0]?.integrity_check ?? '';
    if (status !== 'ok') {
      console.warn(`[SQLiteAdapter] integrity_check: ${status}`);
    }
  }

  // ── Sessions ─────────────────────────────────────────────────────

  saveSession(session: SessionContext): number {
    const stmt = this.db.prepare(`
      INSERT INTO sessions
        (date, symbol, status, zone_resistance, zone_support, zone_status,
         execution_mode, started_at, completed_at, is_backtest, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      session.date,
      session.symbol,
      session.status,
      session.zone?.resistance ?? null,
      session.zone?.support ?? null,
      session.zone?.status ?? null,
      session.executionMode,
      session.startedAt,
      session.completedAt || null,
      session.isBacktest ? 1 : 0,
      session.error,
    );

    return Number(info.lastInsertRowid);
  }

  getSession(date: string, symbol: string): SessionContext | null {
    const stmt = this.db.prepare(
      'SELECT * FROM sessions WHERE date = ? AND symbol = ?',
    );
    const row = stmt.get(date, symbol) as SessionRow | undefined;
    return row ? rowToSession(row) : null;
  }

  hasCompletedSession(date: string, symbol: string): boolean {
    const stmt = this.db.prepare(
      "SELECT 1 FROM sessions WHERE date = ? AND symbol = ? AND status = 'COMPLETE'",
    );
    return stmt.get(date, symbol) !== undefined;
  }

  getSessionsByDateRange(
    from: string,
    to: string,
    symbol?: string,
  ): SessionContext[] {
    if (symbol !== undefined) {
      const stmt = this.db.prepare(
        'SELECT * FROM sessions WHERE date BETWEEN ? AND ? AND symbol = ?',
      );
      return (stmt.all(from, to, symbol) as SessionRow[]).map(rowToSession);
    }
    const stmt = this.db.prepare(
      'SELECT * FROM sessions WHERE date BETWEEN ? AND ?',
    );
    return (stmt.all(from, to) as SessionRow[]).map(rowToSession);
  }

  // ── Trades ───────────────────────────────────────────────────────

  saveTrade(trade: Trade, sessionId: number): void {
    const stmt = this.db.prepare(`
      INSERT INTO trades
        (id, session_id, symbol, direction, entry_price, initial_stop,
         current_stop, r_value, target_1r, target_2r, target_3r,
         entry_timestamp, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
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
  }

  getTradesByDateRange(
    from: string,
    to: string,
    symbol?: string,
  ): Trade[] {
    if (symbol !== undefined) {
      const stmt = this.db.prepare(`
        SELECT t.* FROM trades t
        JOIN sessions s ON t.session_id = s.id
        WHERE s.date BETWEEN ? AND ? AND s.symbol = ?
        ORDER BY t.entry_timestamp ASC
      `);
      return (stmt.all(from, to, symbol) as TradeRow[]).map(rowToTrade);
    }
    const stmt = this.db.prepare(`
      SELECT t.* FROM trades t
      JOIN sessions s ON t.session_id = s.id
      WHERE s.date BETWEEN ? AND ?
      ORDER BY t.entry_timestamp ASC
    `);
    return (stmt.all(from, to) as TradeRow[]).map(rowToTrade);
  }

  // ── TradeOutcomes ────────────────────────────────────────────────

  saveTradeOutcome(outcome: TradeOutcome): void {
    const stmt = this.db.prepare(`
      INSERT INTO trade_outcomes
        (trade_id, result, max_favorable_r, max_adverse_r, exit_price,
         exit_timestamp, realized_r, first_threshold, timestamp_1r,
         timestamp_2r, timestamp_3r, timestamp_stop, bars_held)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
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
  }

  saveTradeWithOutcome(trade: Trade, outcome: TradeOutcome, sessionId: number): void {
    const tradeStmt = this.db.prepare(`
      INSERT INTO trades
        (id, session_id, symbol, direction, entry_price, initial_stop,
         current_stop, r_value, target_1r, target_2r, target_3r,
         entry_timestamp, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const outcomeStmt = this.db.prepare(`
      INSERT INTO trade_outcomes
        (trade_id, result, max_favorable_r, max_adverse_r, exit_price,
         exit_timestamp, realized_r, first_threshold, timestamp_1r,
         timestamp_2r, timestamp_3r, timestamp_stop, bars_held)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertBoth = this.db.transaction(() => {
      tradeStmt.run(
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
      outcomeStmt.run(
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
    });

    insertBoth();
  }

  getOutcomesByDateRange(
    from: string,
    to: string,
    symbol?: string,
  ): TradeOutcome[] {
    if (symbol !== undefined) {
      const stmt = this.db.prepare(`
        SELECT o.* FROM trade_outcomes o
        JOIN trades t ON o.trade_id = t.id
        JOIN sessions s ON t.session_id = s.id
        WHERE s.date BETWEEN ? AND ? AND s.symbol = ?
      `);
      return (stmt.all(from, to, symbol) as OutcomeRow[]).map(rowToOutcome);
    }
    const stmt = this.db.prepare(`
      SELECT o.* FROM trade_outcomes o
      JOIN trades t ON o.trade_id = t.id
      JOIN sessions s ON t.session_id = s.id
      WHERE s.date BETWEEN ? AND ?
    `);
    return (stmt.all(from, to) as OutcomeRow[]).map(rowToOutcome);
  }

  // ── Signals ──────────────────────────────────────────────────────

  saveSignals(signals: readonly Signal[], sessionId: number): void {
    const stmt = this.db.prepare(`
      INSERT INTO signals
        (session_id, direction, signal_type, timestamp, price, attempt_number)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertAll = this.db.transaction((items: readonly Signal[]) => {
      for (const signal of items) {
        stmt.run(
          sessionId,
          signal.direction,
          signal.type,
          signal.timestamp,
          signal.price,
          signal.attemptNumber,
        );
      }
    });

    insertAll(signals);
  }

  // ── Bars ────────────────────────────────────────────────────────

  saveBars(bars: readonly Candle[], sessionId: number): void {
    const stmt = this.db.prepare(`
      INSERT INTO bars
        (session_id, timestamp, open, high, low, close, volume, completed, bar_size_minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertAll = this.db.transaction((items: readonly Candle[]) => {
      for (const bar of items) {
        stmt.run(
          sessionId,
          bar.timestamp,
          bar.open,
          bar.high,
          bar.low,
          bar.close,
          bar.volume,
          bar.completed ? 1 : 0,
          bar.barSizeMinutes,
        );
      }
    });

    insertAll(bars);
  }

  getBarsBySessionId(sessionId: number): Candle[] {
    const stmt = this.db.prepare(
      'SELECT * FROM bars WHERE session_id = ? ORDER BY timestamp ASC',
    );
    const rows = stmt.all(sessionId) as BarRow[];
    return rows.map(rowToCandle);
  }

  // ── Maintenance ──────────────────────────────────────────────────

  deleteAllBacktestSessions(): void {
    // Delete only backtest data (is_backtest = 1), preserve real trades
    // Get all backtest session IDs
    const backtestSessionIds = this.db
      .prepare('SELECT id FROM sessions WHERE is_backtest = 1')
      .all() as { id: number }[];

    if (backtestSessionIds.length === 0) {
      return; // Nothing to delete
    }

    const ids = backtestSessionIds.map((row) => row.id);
    const placeholders = ids.map(() => '?').join(',');

    // Delete related data for backtest sessions only
    this.db.prepare(`DELETE FROM signals WHERE session_id IN (${placeholders})`).run(...ids);
    this.db.prepare(`DELETE FROM bars WHERE session_id IN (${placeholders})`).run(...ids);
    this.db.prepare(`DELETE FROM trade_outcomes WHERE trade_id IN (SELECT id FROM trades WHERE session_id IN (${placeholders}))`).run(...ids);
    this.db.prepare(`DELETE FROM trades WHERE session_id IN (${placeholders})`).run(...ids);
    this.db.prepare(`DELETE FROM sessions WHERE is_backtest = 1`).run();
  }

  close(): void {
    this.db.close();
  }
}
