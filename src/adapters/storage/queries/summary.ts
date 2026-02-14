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
  // ── Prepare statements at initialization time (avoid dynamic SQL) ──

  // Top sessions statements (one per filter type)
  const topSessionsBoth = db.prepare(`
    SELECT
      s.id AS session_id,
      s.date,
      s.symbol,
      s.zone_resistance,
      s.zone_support,
      COALESCE(SUM(o.realized_r), 0) AS total_r,
      COUNT(t.id) AS trade_count,
      MAX(o.result) AS result
    FROM sessions s
    LEFT JOIN trades t ON t.session_id = s.id
    LEFT JOIN trade_outcomes o ON o.trade_id = t.id
    GROUP BY s.id
    ORDER BY total_r DESC
    LIMIT ?
  `);

  const topSessionsBacktest = db.prepare(`
    SELECT
      s.id AS session_id,
      s.date,
      s.symbol,
      s.zone_resistance,
      s.zone_support,
      COALESCE(SUM(o.realized_r), 0) AS total_r,
      COUNT(t.id) AS trade_count,
      MAX(o.result) AS result
    FROM sessions s
    LEFT JOIN trades t ON t.session_id = s.id
    LEFT JOIN trade_outcomes o ON o.trade_id = t.id
    WHERE s.is_backtest = 1
    GROUP BY s.id
    ORDER BY total_r DESC
    LIMIT ?
  `);

  const topSessionsLive = db.prepare(`
    SELECT
      s.id AS session_id,
      s.date,
      s.symbol,
      s.zone_resistance,
      s.zone_support,
      COALESCE(SUM(o.realized_r), 0) AS total_r,
      COUNT(t.id) AS trade_count,
      MAX(o.result) AS result
    FROM sessions s
    LEFT JOIN trades t ON t.session_id = s.id
    LEFT JOIN trade_outcomes o ON o.trade_id = t.id
    WHERE s.is_backtest = 0
    GROUP BY s.id
    ORDER BY total_r DESC
    LIMIT ?
  `);

  // By-stock statements (one per filter type)
  const byStockBoth = db.prepare(`
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
    GROUP BY s.symbol
    ORDER BY total_r DESC
  `);

  const byStockBacktest = db.prepare(`
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
    WHERE s.is_backtest = 1
    GROUP BY s.symbol
    ORDER BY total_r DESC
  `);

  const byStockLive = db.prepare(`
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
    WHERE s.is_backtest = 0
    GROUP BY s.symbol
    ORDER BY total_r DESC
  `);

  /**
   * Get top N sessions ordered by total realized R (descending).
   *
   * @param limit - Maximum number of sessions to return (10, 25, 50, or 100)
   * @param include - Filter: 'backtest', 'live', or 'both'
   * @returns Array of session summaries
   */
  function getTopSessions(limit: number, include: 'backtest' | 'live' | 'both'): SessionSummaryRow[] {
    if (include === 'backtest') {
      return topSessionsBacktest.all(limit) as SessionSummaryRow[];
    } else if (include === 'live') {
      return topSessionsLive.all(limit) as SessionSummaryRow[];
    } else {
      return topSessionsBoth.all(limit) as SessionSummaryRow[];
    }
  }

  /**
   * Get aggregate statistics grouped by stock symbol.
   *
   * @param include - Filter: 'backtest', 'live', or 'both'
   * @returns Array of stock summaries
   */
  function getSessionsByStock(include: 'backtest' | 'live' | 'both'): StockSummaryRow[] {
    if (include === 'backtest') {
      return byStockBacktest.all() as StockSummaryRow[];
    } else if (include === 'live') {
      return byStockLive.all() as StockSummaryRow[];
    } else {
      return byStockBoth.all() as StockSummaryRow[];
    }
  }

  return {
    getTopSessions,
    getSessionsByStock,
  };
}
