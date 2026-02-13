import type Database from 'better-sqlite3';

// ── Result types for aggregate queries ────────────────────────────────

export interface WinLossRow {
  result: string;
  count: number;
}

export interface PerSymbolStatsRow {
  symbol: string;
  total_trades: number;
  wins: number;
  losses: number;
  breakevens: number;
  timeouts: number;
  total_realized_r: number;
  avg_realized_r: number;
}

export interface DailyStatsRow {
  date: string;
  total_trades: number;
  wins: number;
  losses: number;
  total_realized_r: number;
  avg_realized_r: number;
}

// ── Factory ──────────────────────────────────────────────────────────

export function createAggregationQueries(db: Database.Database) {
  // ── Trade count ──

  const countAll = db.prepare(`
    SELECT COUNT(*) AS count FROM trades t
    JOIN sessions s ON t.session_id = s.id
    WHERE s.date BETWEEN ? AND ?
  `);

  const countBySymbol = db.prepare(`
    SELECT COUNT(*) AS count FROM trades t
    JOIN sessions s ON t.session_id = s.id
    WHERE s.date BETWEEN ? AND ? AND t.symbol = ?
  `);

  // ── Win / loss breakdown ──

  const winLossAll = db.prepare(`
    SELECT o.result, COUNT(*) AS count
    FROM trade_outcomes o
    JOIN trades t ON o.trade_id = t.id
    JOIN sessions s ON t.session_id = s.id
    WHERE s.date BETWEEN ? AND ?
    GROUP BY o.result
  `);

  const winLossBySymbol = db.prepare(`
    SELECT o.result, COUNT(*) AS count
    FROM trade_outcomes o
    JOIN trades t ON o.trade_id = t.id
    JOIN sessions s ON t.session_id = s.id
    WHERE s.date BETWEEN ? AND ? AND t.symbol = ?
    GROUP BY o.result
  `);

  // ── Per-symbol stats ──

  const perSymbol = db.prepare(`
    SELECT
      t.symbol,
      COUNT(*)                                                 AS total_trades,
      SUM(CASE WHEN o.result IN ('WIN_2R', 'WIN_3R') THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN o.result = 'LOSS' THEN 1 ELSE 0 END)      AS losses,
      SUM(CASE WHEN o.result = 'BREAKEVEN_STOP' THEN 1 ELSE 0 END) AS breakevens,
      SUM(CASE WHEN o.result = 'SESSION_TIMEOUT' THEN 1 ELSE 0 END) AS timeouts,
      COALESCE(SUM(o.realized_r), 0)                           AS total_realized_r,
      COALESCE(AVG(o.realized_r), 0)                           AS avg_realized_r
    FROM trades t
    JOIN sessions s ON t.session_id = s.id
    LEFT JOIN trade_outcomes o ON o.trade_id = t.id
    WHERE s.date BETWEEN ? AND ?
    GROUP BY t.symbol
    ORDER BY t.symbol ASC
  `);

  // ── Daily stats ──

  const dailyAll = db.prepare(`
    SELECT
      s.date,
      COUNT(*)                                                 AS total_trades,
      SUM(CASE WHEN o.result IN ('WIN_2R', 'WIN_3R') THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN o.result = 'LOSS' THEN 1 ELSE 0 END)      AS losses,
      COALESCE(SUM(o.realized_r), 0)                           AS total_realized_r,
      COALESCE(AVG(o.realized_r), 0)                           AS avg_realized_r
    FROM trades t
    JOIN sessions s ON t.session_id = s.id
    LEFT JOIN trade_outcomes o ON o.trade_id = t.id
    WHERE s.date BETWEEN ? AND ?
    GROUP BY s.date
    ORDER BY s.date ASC
  `);

  const dailyBySymbol = db.prepare(`
    SELECT
      s.date,
      COUNT(*)                                                 AS total_trades,
      SUM(CASE WHEN o.result IN ('WIN_2R', 'WIN_3R') THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN o.result = 'LOSS' THEN 1 ELSE 0 END)      AS losses,
      COALESCE(SUM(o.realized_r), 0)                           AS total_realized_r,
      COALESCE(AVG(o.realized_r), 0)                           AS avg_realized_r
    FROM trades t
    JOIN sessions s ON t.session_id = s.id
    LEFT JOIN trade_outcomes o ON o.trade_id = t.id
    WHERE s.date BETWEEN ? AND ? AND t.symbol = ?
    GROUP BY s.date
    ORDER BY s.date ASC
  `);

  // ── Total realized R ──

  const totalRAll = db.prepare(`
    SELECT COALESCE(SUM(o.realized_r), 0) AS total
    FROM trade_outcomes o
    JOIN trades t ON o.trade_id = t.id
    JOIN sessions s ON t.session_id = s.id
    WHERE s.date BETWEEN ? AND ?
  `);

  const totalRBySymbol = db.prepare(`
    SELECT COALESCE(SUM(o.realized_r), 0) AS total
    FROM trade_outcomes o
    JOIN trades t ON o.trade_id = t.id
    JOIN sessions s ON t.session_id = s.id
    WHERE s.date BETWEEN ? AND ? AND t.symbol = ?
  `);

  return {
    /**
     * Total number of trades in the date range.
     */
    getTotalTradeCount(
      from: string,
      to: string,
      symbol?: string,
    ): number {
      if (symbol) {
        return (countBySymbol.get(from, to, symbol) as { count: number })
          .count;
      }
      return (countAll.get(from, to) as { count: number }).count;
    },

    /**
     * Count of trades grouped by result type (LOSS, WIN_2R, etc.).
     */
    getWinLossBreakdown(
      from: string,
      to: string,
      symbol?: string,
    ): WinLossRow[] {
      if (symbol) {
        return winLossBySymbol.all(from, to, symbol) as WinLossRow[];
      }
      return winLossAll.all(from, to) as WinLossRow[];
    },

    /**
     * Per-symbol aggregate statistics.
     */
    getPerSymbolStats(from: string, to: string): PerSymbolStatsRow[] {
      return perSymbol.all(from, to) as PerSymbolStatsRow[];
    },

    /**
     * Daily aggregate statistics, optionally filtered by symbol.
     */
    getDailyStats(
      from: string,
      to: string,
      symbol?: string,
    ): DailyStatsRow[] {
      if (symbol) {
        return dailyBySymbol.all(from, to, symbol) as DailyStatsRow[];
      }
      return dailyAll.all(from, to) as DailyStatsRow[];
    },

    /**
     * Sum of realizedR across all outcomes in the date range.
     */
    getTotalRealizedR(
      from: string,
      to: string,
      symbol?: string,
    ): number {
      if (symbol) {
        return (
          totalRBySymbol.get(from, to, symbol) as { total: number }
        ).total;
      }
      return (totalRAll.get(from, to) as { total: number }).total;
    },
  };
}
