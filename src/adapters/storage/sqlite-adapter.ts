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
import type {
  WatchlistItem,
  WatchlistItemInput,
  WatchlistItemUpdate,
} from '../../core/models/watchlist.js';
import type {
  BacktestJob,
  BacktestJobRequest,
  BacktestJobStatus,
} from '../../core/models/backtest-job.js';
import type {
  ConfigPreset,
  ConfigPresetInput,
  ConfigPresetUpdate,
} from '../../core/models/config-preset.js';
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

interface WatchlistRow {
  id: number;
  symbol: string;
  is_active: number;
  is_mock: number;
  schedule_enabled: number;
  created_at: number;
  updated_at: number;
}

interface BacktestJobRow {
  id: string;
  symbol: string;
  from_date: string;
  to_date: string;
  preset_id: number | null;
  status: string;
  progress_total: number;
  progress_current: number;
  result_summary: string | null;
  error_message: string | null;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
}

interface ConfigPresetRow {
  id: number;
  name: string;
  is_default: number;
  max_break_attempts: number;
  min_zone_spread_cents: number;
  max_zone_spread_percent: number;
  min_zone_bars: number;
  premarket_time: string;
  zone_start_time: string;
  zone_end_time: string;
  execution_end_time: string;
  target_1r_multiple: number;
  target_2r_multiple: number;
  target_3r_multiple: number;
  trailing_stop_at_1r: number;
  created_at: number;
  updated_at: number;
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

function rowToWatchlistItem(row: WatchlistRow): WatchlistItem {
  return {
    id: row.id,
    symbol: row.symbol,
    isActive: row.is_active === 1,
    isMock: row.is_mock === 1,
    scheduleEnabled: row.schedule_enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToBacktestJob(row: BacktestJobRow): BacktestJob {
  return {
    id: row.id,
    symbol: row.symbol,
    fromDate: row.from_date,
    toDate: row.to_date,
    presetId: row.preset_id,
    status: row.status as BacktestJobStatus,
    progressTotal: row.progress_total,
    progressCurrent: row.progress_current,
    resultSummary: row.result_summary,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function rowToConfigPreset(row: ConfigPresetRow): ConfigPreset {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.is_default === 1,
    maxBreakAttempts: row.max_break_attempts,
    minZoneSpreadCents: row.min_zone_spread_cents,
    maxZoneSpreadPercent: row.max_zone_spread_percent,
    minZoneBars: row.min_zone_bars,
    premarketTime: row.premarket_time,
    zoneStartTime: row.zone_start_time,
    zoneEndTime: row.zone_end_time,
    executionEndTime: row.execution_end_time,
    target1RMultiple: row.target_1r_multiple,
    target2RMultiple: row.target_2r_multiple,
    target3RMultiple: row.target_3r_multiple,
    trailingStopAt1R: row.trailing_stop_at_1r === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

  // ── Watchlist Items ──────────────────────────────────────────────

  getWatchlistItems(): WatchlistItem[] {
    const stmt = this.db.prepare(
      'SELECT * FROM watchlist_items ORDER BY created_at DESC',
    );
    const rows = stmt.all() as WatchlistRow[];
    return rows.map(rowToWatchlistItem);
  }

  getWatchlistItem(id: number): WatchlistItem | null {
    const stmt = this.db.prepare(
      'SELECT * FROM watchlist_items WHERE id = ?',
    );
    const row = stmt.get(id) as WatchlistRow | undefined;
    return row ? rowToWatchlistItem(row) : null;
  }

  getScheduledWatchlistItems(): WatchlistItem[] {
    const stmt = this.db.prepare(
      'SELECT * FROM watchlist_items WHERE is_active = 1 AND schedule_enabled = 1 ORDER BY symbol ASC',
    );
    const rows = stmt.all() as WatchlistRow[];
    return rows.map(rowToWatchlistItem);
  }

  createWatchlistItem(input: WatchlistItemInput): number {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO watchlist_items
        (symbol, is_active, is_mock, schedule_enabled, created_at, updated_at)
      VALUES (?, 1, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      input.symbol.toUpperCase(),
      input.isMock ? 1 : 0,
      input.scheduleEnabled ? 1 : 0,
      now,
      now,
    );

    return Number(info.lastInsertRowid);
  }

  updateWatchlistItem(id: number, updates: WatchlistItemUpdate): void {
    const sets: string[] = [];
    const values: unknown[] = [];

    if (updates.isActive !== undefined) {
      sets.push('is_active = ?');
      values.push(updates.isActive ? 1 : 0);
    }
    if (updates.isMock !== undefined) {
      sets.push('is_mock = ?');
      values.push(updates.isMock ? 1 : 0);
    }
    if (updates.scheduleEnabled !== undefined) {
      sets.push('schedule_enabled = ?');
      values.push(updates.scheduleEnabled ? 1 : 0);
    }

    if (sets.length === 0) return; // No updates

    sets.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const stmt = this.db.prepare(
      `UPDATE watchlist_items SET ${sets.join(', ')} WHERE id = ?`,
    );
    stmt.run(...values);
  }

  deleteWatchlistItem(id: number): void {
    const stmt = this.db.prepare('DELETE FROM watchlist_items WHERE id = ?');
    stmt.run(id);
  }

  // ── Backtest Jobs ────────────────────────────────────────────────

  getBacktestJob(id: string): BacktestJob | null {
    const stmt = this.db.prepare('SELECT * FROM backtest_jobs WHERE id = ?');
    const row = stmt.get(id) as BacktestJobRow | undefined;
    return row ? rowToBacktestJob(row) : null;
  }

  getBacktestJobs(status?: BacktestJobStatus): BacktestJob[] {
    if (status !== undefined) {
      const stmt = this.db.prepare(
        'SELECT * FROM backtest_jobs WHERE status = ? ORDER BY created_at DESC',
      );
      const rows = stmt.all(status) as BacktestJobRow[];
      return rows.map(rowToBacktestJob);
    }

    const stmt = this.db.prepare(
      'SELECT * FROM backtest_jobs ORDER BY created_at DESC',
    );
    const rows = stmt.all() as BacktestJobRow[];
    return rows.map(rowToBacktestJob);
  }

  createBacktestJob(request: BacktestJobRequest): string {
    const jobId = crypto.randomUUID();
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO backtest_jobs
        (id, symbol, from_date, to_date, preset_id, status, progress_total,
         progress_current, result_summary, error_message, created_at,
         started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, 'PENDING', 0, 0, NULL, NULL, ?, NULL, NULL)
    `);

    stmt.run(
      jobId,
      request.symbol.toUpperCase(),
      request.fromDate,
      request.toDate,
      request.presetId ?? null,
      now,
    );

    return jobId;
  }

  updateJobStatus(id: string, status: BacktestJobStatus, errorMessage?: string): void {
    const now = Date.now();

    if (status === 'RUNNING') {
      const stmt = this.db.prepare(
        'UPDATE backtest_jobs SET status = ?, started_at = ? WHERE id = ?',
      );
      stmt.run(status, now, id);
    } else if (status === 'FAILED') {
      const stmt = this.db.prepare(
        'UPDATE backtest_jobs SET status = ?, error_message = ?, completed_at = ? WHERE id = ?',
      );
      stmt.run(status, errorMessage ?? null, now, id);
    } else {
      const stmt = this.db.prepare('UPDATE backtest_jobs SET status = ? WHERE id = ?');
      stmt.run(status, id);
    }
  }

  updateJobProgress(id: string, current: number, total: number): void {
    const stmt = this.db.prepare(
      'UPDATE backtest_jobs SET progress_current = ?, progress_total = ? WHERE id = ?',
    );
    stmt.run(current, total, id);
  }

  completeBacktestJob(id: string, resultSummary: string): void {
    const now = Date.now();
    const stmt = this.db.prepare(
      'UPDATE backtest_jobs SET status = ?, result_summary = ?, completed_at = ? WHERE id = ?',
    );
    stmt.run('COMPLETED', resultSummary, now, id);
  }

  getStaleJobs(olderThanMs: number): BacktestJob[] {
    const threshold = Date.now() - olderThanMs;
    const stmt = this.db.prepare(`
      SELECT * FROM backtest_jobs
      WHERE status = 'RUNNING' AND started_at < ?
      ORDER BY started_at ASC
    `);
    const rows = stmt.all(threshold) as BacktestJobRow[];
    return rows.map(rowToBacktestJob);
  }

  // ── Config Presets ───────────────────────────────────────────────

  getConfigPresets(): ConfigPreset[] {
    const stmt = this.db.prepare(
      'SELECT * FROM strategy_presets ORDER BY name ASC',
    );
    const rows = stmt.all() as ConfigPresetRow[];
    return rows.map(rowToConfigPreset);
  }

  getConfigPreset(id: number): ConfigPreset | null {
    const stmt = this.db.prepare('SELECT * FROM strategy_presets WHERE id = ?');
    const row = stmt.get(id) as ConfigPresetRow | undefined;
    return row ? rowToConfigPreset(row) : null;
  }

  getDefaultConfigPreset(): ConfigPreset | null {
    const stmt = this.db.prepare(
      'SELECT * FROM strategy_presets WHERE is_default = 1',
    );
    const row = stmt.get() as ConfigPresetRow | undefined;
    return row ? rowToConfigPreset(row) : null;
  }

  createConfigPreset(input: ConfigPresetInput): number {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO strategy_presets
        (name, is_default, max_break_attempts, min_zone_spread_cents,
         max_zone_spread_percent, min_zone_bars, premarket_time, zone_start_time,
         zone_end_time, execution_end_time, target_1r_multiple, target_2r_multiple,
         target_3r_multiple, trailing_stop_at_1r, created_at, updated_at)
      VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      input.name,
      input.maxBreakAttempts ?? 5,
      input.minZoneSpreadCents ?? 10,
      input.maxZoneSpreadPercent ?? 3.0,
      input.minZoneBars ?? 3,
      input.premarketTime ?? '04:30',
      input.zoneStartTime ?? '09:30',
      input.zoneEndTime ?? '10:00',
      input.executionEndTime ?? '12:00',
      input.target1RMultiple ?? 1.0,
      input.target2RMultiple ?? 2.0,
      input.target3RMultiple ?? 3.0,
      input.trailingStopAt1R === false ? 0 : 1,
      now,
      now,
    );

    return Number(info.lastInsertRowid);
  }

  updateConfigPreset(id: number, updates: ConfigPresetUpdate): void {
    const sets: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      sets.push('name = ?');
      values.push(updates.name);
    }
    if (updates.maxBreakAttempts !== undefined) {
      sets.push('max_break_attempts = ?');
      values.push(updates.maxBreakAttempts);
    }
    if (updates.minZoneSpreadCents !== undefined) {
      sets.push('min_zone_spread_cents = ?');
      values.push(updates.minZoneSpreadCents);
    }
    if (updates.maxZoneSpreadPercent !== undefined) {
      sets.push('max_zone_spread_percent = ?');
      values.push(updates.maxZoneSpreadPercent);
    }
    if (updates.minZoneBars !== undefined) {
      sets.push('min_zone_bars = ?');
      values.push(updates.minZoneBars);
    }
    if (updates.premarketTime !== undefined) {
      sets.push('premarket_time = ?');
      values.push(updates.premarketTime);
    }
    if (updates.zoneStartTime !== undefined) {
      sets.push('zone_start_time = ?');
      values.push(updates.zoneStartTime);
    }
    if (updates.zoneEndTime !== undefined) {
      sets.push('zone_end_time = ?');
      values.push(updates.zoneEndTime);
    }
    if (updates.executionEndTime !== undefined) {
      sets.push('execution_end_time = ?');
      values.push(updates.executionEndTime);
    }
    if (updates.target1RMultiple !== undefined) {
      sets.push('target_1r_multiple = ?');
      values.push(updates.target1RMultiple);
    }
    if (updates.target2RMultiple !== undefined) {
      sets.push('target_2r_multiple = ?');
      values.push(updates.target2RMultiple);
    }
    if (updates.target3RMultiple !== undefined) {
      sets.push('target_3r_multiple = ?');
      values.push(updates.target3RMultiple);
    }
    if (updates.trailingStopAt1R !== undefined) {
      sets.push('trailing_stop_at_1r = ?');
      values.push(updates.trailingStopAt1R ? 1 : 0);
    }

    if (sets.length === 0) return; // No updates

    sets.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const stmt = this.db.prepare(
      `UPDATE strategy_presets SET ${sets.join(', ')} WHERE id = ?`,
    );
    stmt.run(...values);
  }

  deleteConfigPreset(id: number): void {
    // Prevent deletion of default preset
    const preset = this.getConfigPreset(id);
    if (preset?.isDefault) {
      throw new Error('Cannot delete default preset. Set another preset as default first.');
    }

    const stmt = this.db.prepare('DELETE FROM strategy_presets WHERE id = ?');
    stmt.run(id);
  }

  setDefaultPreset(id: number): void {
    const transaction = this.db.transaction(() => {
      // Clear all defaults
      this.db.prepare('UPDATE strategy_presets SET is_default = 0').run();

      // Set new default
      this.db.prepare('UPDATE strategy_presets SET is_default = 1 WHERE id = ?').run(id);
    });

    transaction();
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

    // Wrap all deletes in a transaction for atomicity
    this.db.transaction(() => {
      // Delete related data for backtest sessions only
      this.db.prepare(`DELETE FROM signals WHERE session_id IN (${placeholders})`).run(...ids);
      this.db.prepare(`DELETE FROM bars WHERE session_id IN (${placeholders})`).run(...ids);
      this.db.prepare(`DELETE FROM trade_outcomes WHERE trade_id IN (SELECT id FROM trades WHERE session_id IN (${placeholders}))`).run(...ids);
      this.db.prepare(`DELETE FROM trades WHERE session_id IN (${placeholders})`).run(...ids);
      this.db.prepare(`DELETE FROM sessions WHERE is_backtest = 1`).run();
    })();
  }

  close(): void {
    this.db.close();
  }
}
