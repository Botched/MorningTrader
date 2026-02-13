import type Database from 'better-sqlite3';

/**
 * Represents a single database migration.
 */
export interface Migration {
  readonly id: string;
  readonly description: string;
  up(db: Database.Database): void;
}

/**
 * Initial schema migration.
 *
 * Creates the core tables for the MorningTrader system:
 * - sessions: Trading session records (one per day/symbol combination)
 * - trades: Individual trade entries with price levels in integer cents
 * - trade_outcomes: Results and statistics for completed trades
 * - signals: Market signals detected during a session
 *
 * All price columns are INTEGER (cents). All timestamps are INTEGER (UTC ms).
 * Foreign keys are declared in the schema; enforcement requires PRAGMA foreign_keys = ON
 * (set by the adapter, not here).
 *
 * WAL mode (PRAGMA journal_mode = WAL) improves concurrent read performance
 * but is NOT set here -- that is the storage adapter's responsibility.
 */
export const migration001: Migration = {
  id: '001-initial',
  description: 'Create sessions, trades, trade_outcomes, and signals tables',

  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        symbol TEXT NOT NULL,
        status TEXT NOT NULL,
        zone_resistance INTEGER,
        zone_support INTEGER,
        zone_status TEXT,
        execution_mode TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        is_backtest INTEGER DEFAULT 0,
        error TEXT,
        UNIQUE(date, symbol, is_backtest)
      );

      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES sessions(id),
        symbol TEXT NOT NULL,
        direction TEXT NOT NULL,
        entry_price INTEGER NOT NULL,
        initial_stop INTEGER NOT NULL,
        current_stop INTEGER NOT NULL,
        r_value INTEGER NOT NULL,
        target_1r INTEGER NOT NULL,
        target_2r INTEGER NOT NULL,
        target_3r INTEGER NOT NULL,
        entry_timestamp INTEGER NOT NULL,
        status TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS trade_outcomes (
        trade_id TEXT PRIMARY KEY REFERENCES trades(id),
        result TEXT NOT NULL,
        max_favorable_r REAL NOT NULL,
        max_adverse_r REAL NOT NULL,
        exit_price INTEGER NOT NULL,
        exit_timestamp INTEGER NOT NULL,
        realized_r REAL NOT NULL,
        first_threshold INTEGER NOT NULL,
        timestamp_1r INTEGER DEFAULT 0,
        timestamp_2r INTEGER DEFAULT 0,
        timestamp_3r INTEGER DEFAULT 0,
        timestamp_stop INTEGER DEFAULT 0,
        bars_held INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS signals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES sessions(id),
        direction TEXT NOT NULL,
        signal_type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        price INTEGER NOT NULL,
        attempt_number INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
      CREATE INDEX IF NOT EXISTS idx_trades_session ON trades(session_id);
      CREATE INDEX IF NOT EXISTS idx_signals_session ON signals(session_id);
    `);
  },
};

/**
 * Run all pending migrations.
 *
 * Creates a `_migrations` table to track which migrations have been applied.
 * Safe to call multiple times (idempotent). Each unapplied migration is
 * executed inside a transaction together with its bookkeeping insert.
 */
export function runMigrations(
  db: Database.Database,
  migrations: Migration[],
): void {
  // Ensure the migrations tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  // Retrieve the set of already-applied migration IDs
  const applied = new Set(
    (db.prepare('SELECT id FROM _migrations').all() as { id: string }[]).map(
      (row) => row.id,
    ),
  );

  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      continue;
    }

    const applyMigration = db.transaction(() => {
      migration.up(db);
      db.prepare('INSERT INTO _migrations (id, applied_at) VALUES (?, ?)').run(
        migration.id,
        Date.now(),
      );
    });

    applyMigration();
  }
}
