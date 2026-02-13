import type Database from 'better-sqlite3';
import type {
  SessionContext,
  SessionStatus,
  ExecutionMode,
  DecisionZoneStatus,
} from '../../../core/models/index.js';

// ── Row type matching the sessions table ──────────────────────────────

export interface SessionRow {
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

// ── Row → Model mapping ──────────────────────────────────────────────

/**
 * Convert a flat SessionRow into a partial SessionContext.
 *
 * Fields that live in child tables (signals, trades, outcomes, allBars)
 * are **not** populated here — callers compose them separately.
 */
export function mapSessionRow(row: SessionRow): Partial<SessionContext> {
  return {
    date: row.date,
    symbol: row.symbol,
    status: row.status as SessionStatus,
    zone:
      row.zone_resistance !== null && row.zone_support !== null
        ? {
            resistance: row.zone_resistance,
            support: row.zone_support,
            status: (row.zone_status ?? 'PENDING') as DecisionZoneStatus,
            spread: row.zone_resistance - row.zone_support,
            definedAt: 0,
            sourceBars: [],
            premarketPrice: 0,
          }
        : null,
    executionMode: row.execution_mode as ExecutionMode,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? 0,
    isBacktest: row.is_backtest === 1,
    error: row.error,
  };
}

// ── Factory ──────────────────────────────────────────────────────────

export function createSessionQueries(db: Database.Database) {
  const insertSession = db.prepare(`
    INSERT INTO sessions
      (date, symbol, status, zone_resistance, zone_support, zone_status,
       execution_mode, started_at, completed_at, is_backtest, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const selectByDateSymbol = db.prepare(`
    SELECT * FROM sessions WHERE date = ? AND symbol = ?
  `);

  const selectHasCompleted = db.prepare(`
    SELECT 1 FROM sessions WHERE date = ? AND symbol = ? AND status = 'COMPLETE'
  `);

  const selectByDateRange = db.prepare(`
    SELECT * FROM sessions WHERE date BETWEEN ? AND ? ORDER BY date ASC
  `);

  const selectByDateRangeAndSymbol = db.prepare(`
    SELECT * FROM sessions
    WHERE date BETWEEN ? AND ? AND symbol = ?
    ORDER BY date ASC
  `);

  return {
    /**
     * Insert a session and return the auto-generated row id.
     */
    insert(session: SessionContext): number {
      const info = insertSession.run(
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
    },

    /**
     * Retrieve a single session row by date + symbol.
     */
    getByDateAndSymbol(
      date: string,
      symbol: string,
    ): SessionRow | undefined {
      return selectByDateSymbol.get(date, symbol) as
        | SessionRow
        | undefined;
    },

    /**
     * Check whether a COMPLETE session exists for the given date + symbol.
     */
    hasCompleted(date: string, symbol: string): boolean {
      return selectHasCompleted.get(date, symbol) !== undefined;
    },

    /**
     * Return all sessions in a date range, optionally filtered by symbol.
     */
    getByDateRange(
      from: string,
      to: string,
      symbol?: string,
    ): SessionRow[] {
      if (symbol) {
        return selectByDateRangeAndSymbol.all(
          from,
          to,
          symbol,
        ) as SessionRow[];
      }
      return selectByDateRange.all(from, to) as SessionRow[];
    },
  };
}
