import type Database from 'better-sqlite3';
import type { Migration } from './001-initial.js';

/**
 * MorningTrader v2 Features Migration
 *
 * Adds support for:
 * - Watchlist management (scheduled and manual stock monitoring)
 * - Async backtest job queue (background processing)
 * - Strategy configuration presets (multiple named configurations)
 *
 * New tables:
 * - watchlist_items: Stock tickers with execution mode and scheduling flags
 * - strategy_presets: Named strategy configurations with all parameters
 * - backtest_jobs: Async job queue with progress tracking and results
 *
 * All price columns are INTEGER (cents). All timestamps are INTEGER (UTC ms).
 * Boolean flags are INTEGER (0 or 1).
 */
export const migration003: Migration = {
  id: '003-v2-features',
  description: 'Create watchlist_items, strategy_presets, and backtest_jobs tables for v2 features',

  up(db: Database.Database): void {
    db.exec(`
      -- =====================================================================
      -- Watchlist Items
      -- =====================================================================
      CREATE TABLE IF NOT EXISTS watchlist_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL UNIQUE,
        is_active INTEGER NOT NULL DEFAULT 1,          -- 0=disabled, 1=enabled
        is_mock INTEGER NOT NULL DEFAULT 1,            -- 0=real, 1=mock execution
        schedule_enabled INTEGER NOT NULL DEFAULT 0,   -- 0=manual only, 1=auto-scheduled
        created_at INTEGER NOT NULL,                   -- UTC milliseconds
        updated_at INTEGER NOT NULL                    -- UTC milliseconds
      );

      CREATE INDEX IF NOT EXISTS idx_watchlist_active ON watchlist_items(is_active);
      CREATE INDEX IF NOT EXISTS idx_watchlist_schedule ON watchlist_items(schedule_enabled);

      -- =====================================================================
      -- Strategy Presets
      -- =====================================================================
      CREATE TABLE IF NOT EXISTS strategy_presets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        is_default INTEGER NOT NULL DEFAULT 0,         -- 0=no, 1=yes (only one can be default)

        -- Core strategy parameters
        max_break_attempts INTEGER NOT NULL DEFAULT 5,
        min_zone_spread_cents INTEGER NOT NULL DEFAULT 10,
        max_zone_spread_percent REAL NOT NULL DEFAULT 3.0,
        min_zone_bars INTEGER NOT NULL DEFAULT 3,

        -- Time windows (stored as HH:MM strings in Eastern Time)
        premarket_time TEXT NOT NULL DEFAULT '04:30',
        zone_start_time TEXT NOT NULL DEFAULT '09:30',
        zone_end_time TEXT NOT NULL DEFAULT '10:00',
        execution_end_time TEXT NOT NULL DEFAULT '12:00',

        -- Target multiples
        target_1r_multiple REAL NOT NULL DEFAULT 1.0,
        target_2r_multiple REAL NOT NULL DEFAULT 2.0,
        target_3r_multiple REAL NOT NULL DEFAULT 3.0,

        -- Position management
        trailing_stop_at_1r INTEGER NOT NULL DEFAULT 1,  -- 0=no, 1=yes

        -- Metadata
        created_at INTEGER NOT NULL,                   -- UTC milliseconds
        updated_at INTEGER NOT NULL                    -- UTC milliseconds
      );

      CREATE INDEX IF NOT EXISTS idx_presets_default ON strategy_presets(is_default);

      -- =====================================================================
      -- Backtest Jobs
      -- =====================================================================
      CREATE TABLE IF NOT EXISTS backtest_jobs (
        id TEXT PRIMARY KEY,                           -- UUID
        symbol TEXT NOT NULL,
        from_date TEXT NOT NULL,                       -- YYYY-MM-DD
        to_date TEXT NOT NULL,                         -- YYYY-MM-DD
        preset_id INTEGER REFERENCES strategy_presets(id),

        -- Job state
        status TEXT NOT NULL,                          -- PENDING, RUNNING, COMPLETED, FAILED
        progress_total INTEGER NOT NULL DEFAULT 0,     -- Total trading days in range
        progress_current INTEGER NOT NULL DEFAULT 0,   -- Completed days

        -- Results
        result_summary TEXT,                           -- JSON: { totalR, winRate, trades, ... }
        error_message TEXT,                            -- Error details if FAILED

        -- Timestamps
        created_at INTEGER NOT NULL,                   -- UTC milliseconds
        started_at INTEGER,                            -- UTC milliseconds (null if not started)
        completed_at INTEGER                           -- UTC milliseconds (null if not completed)
      );

      CREATE INDEX IF NOT EXISTS idx_jobs_status ON backtest_jobs(status);
    `);
  },
};
