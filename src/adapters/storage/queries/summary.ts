import type Database from 'better-sqlite3';

// ── Result types for summary queries ────────────────────────────────

export interface SessionSummaryRow {
  session_id: number;
  date: string;
  symbol: string;
  zone_resistance: number | null;
  zone_support: number | null;
  total_r: number;
  trade_count: number;
  result: string | null;
}

export interface StockSummaryRow {
  symbol: string;
  session_count: number;
  trade_count: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_r: number;
  avg_r: number;
}

// ── Factory ──────────────────────────────────────────────────────────

export function createSummaryQueries(db: Database.Database) {
  /**
   * Get top N sessions ordered by total realized R (descending).
   *
   * @param limit - Maximum number of sessions to return (10, 25, 50, or 100)
   * @param include - Filter: 'backtest', 'live', or 'both'
   * @returns Array of session summaries
   */
  function getTopSessions(limit: number, include: 'backtest' | 'live' | 'both'): SessionSummaryRow[] {
    let filterClause = '';
    if (include === 'backtest') {
      filterClause = 'AND s.is_backtest = 1';
    } else if (include === 'live') {
      filterClause = 'AND s.is_backtest = 0';
    }

    const stmt = db.prepare(`
      SELECT
        s.id AS session_id,
        s.date,
        s.symbol,
        s.zone_resistance,
        s.zone_support,
        COALESCE(SUM(o.realized_r), 0) AS total_r,
        COUNT(t.id) AS trade_count,
        o.result
      FROM sessions s
      LEFT JOIN trades t ON t.session_id = s.id
      LEFT JOIN trade_outcomes o ON o.trade_id = t.id
      WHERE 1=1 ${filterClause}
      GROUP BY s.id
      ORDER BY total_r DESC
      LIMIT ?
    `);

    return stmt.all(limit) as SessionSummaryRow[];
  }

  /**
   * Get aggregate statistics grouped by stock symbol.
   *
   * @param include - Filter: 'backtest', 'live', or 'both'
   * @returns Array of stock summaries
   */
  function getSessionsByStock(include: 'backtest' | 'live' | 'both'): StockSummaryRow[] {
    let filterClause = '';
    if (include === 'backtest') {
      filterClause = 'AND s.is_backtest = 1';
    } else if (include === 'live') {
      filterClause = 'AND s.is_backtest = 0';
    }

    const stmt = db.prepare(`
      SELECT
        s.symbol,
        COUNT(DISTINCT s.id) AS session_count,
        COUNT(t.id) AS trade_count,
        SUM(CASE WHEN o.result IN ('WIN_2R', 'WIN_3R') THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN o.result = 'LOSS' THEN 1 ELSE 0 END) AS losses,
        CASE
          WHEN COUNT(o.trade_id) > 0
          THEN CAST(SUM(CASE WHEN o.result IN ('WIN_2R', 'WIN_3R') THEN 1 ELSE 0 END) AS REAL) / COUNT(o.trade_id)
          ELSE 0
        END AS win_rate,
        COALESCE(SUM(o.realized_r), 0) AS total_r,
        COALESCE(AVG(o.realized_r), 0) AS avg_r
      FROM sessions s
      LEFT JOIN trades t ON t.session_id = s.id
      LEFT JOIN trade_outcomes o ON o.trade_id = t.id
      WHERE 1=1 ${filterClause}
      GROUP BY s.symbol
      ORDER BY total_r DESC
    `);

    return stmt.all() as StockSummaryRow[];
  }

  return {
    getTopSessions,
    getSessionsByStock,
  };
}
