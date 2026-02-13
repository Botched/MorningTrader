import type Database from 'better-sqlite3';
import type { Migration } from './001-initial.js';

/**
 * Migration 002: Bars table
 *
 * Adds a `bars` table to persist candlestick data for each session.
 * This enables the web dashboard to render OHLC charts for historical
 * sessions without requiring the original CSV files or IBKR connection.
 *
 * All price columns are INTEGER (cents). Timestamps are INTEGER (UTC ms).
 */
export const migration002: Migration = {
  id: '002-bars',
  description: 'Create bars table for candlestick data persistence',

  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS bars (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES sessions(id),
        timestamp INTEGER NOT NULL,
        open INTEGER NOT NULL,
        high INTEGER NOT NULL,
        low INTEGER NOT NULL,
        close INTEGER NOT NULL,
        volume INTEGER NOT NULL,
        completed INTEGER NOT NULL DEFAULT 1,
        bar_size_minutes INTEGER NOT NULL DEFAULT 5
      );

      CREATE INDEX IF NOT EXISTS idx_bars_session ON bars(session_id);
      CREATE INDEX IF NOT EXISTS idx_bars_session_timestamp ON bars(session_id, timestamp);
    `);
  },
};
