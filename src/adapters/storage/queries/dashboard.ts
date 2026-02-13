import type Database from 'better-sqlite3';

// ── Result types for dashboard queries ──────────────────────────────

export interface SessionListRow {
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
  trade_id: string | null;
  direction: string | null;
  entry_price: number | null;
  result: string | null;
  realized_r: number | null;
}

export interface OverviewStatsRow {
  total_sessions: number;
  sessions_with_trades: number;
  total_trades: number;
  wins: number;
  losses: number;
  breakevens: number;
  timeouts: number;
  total_realized_r: number;
  avg_realized_r: number;
  max_favorable_r: number;
  max_adverse_r: number;
  total_winning_r: number;
  total_losing_r: number;
}

export interface EquityCurvePoint {
  date: string;
  cumulative_r: number;
}

export interface SymbolListRow {
  symbol: string;
}

// ── Factory ──────────────────────────────────────────────────────────

export function createDashboardQueries(db: Database.Database) {
  // ── Session list with trade summary ──

  const sessionListAll = db.prepare(`
    SELECT
      s.id, s.date, s.symbol, s.status,
      s.zone_resistance, s.zone_support, s.zone_status,
      s.execution_mode, s.started_at, s.completed_at,
      s.is_backtest, s.error,
      t.id AS trade_id, t.direction, t.entry_price,
      o.result, o.realized_r
    FROM sessions s
    LEFT JOIN trades t ON t.session_id = s.id
    LEFT JOIN trade_outcomes o ON o.trade_id = t.id
    WHERE s.date BETWEEN ? AND ?
    ORDER BY s.date DESC, s.id DESC
  `);

  const sessionListBySymbol = db.prepare(`
    SELECT
      s.id, s.date, s.symbol, s.status,
      s.zone_resistance, s.zone_support, s.zone_status,
      s.execution_mode, s.started_at, s.completed_at,
      s.is_backtest, s.error,
      t.id AS trade_id, t.direction, t.entry_price,
      o.result, o.realized_r
    FROM sessions s
    LEFT JOIN trades t ON t.session_id = s.id
    LEFT JOIN trade_outcomes o ON o.trade_id = t.id
    WHERE s.date BETWEEN ? AND ? AND s.symbol = ?
    ORDER BY s.date DESC, s.id DESC
  `);

  // ── Overview stats ──

  const overviewAll = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM sessions WHERE date BETWEEN ? AND ?) AS total_sessions,
      (SELECT COUNT(DISTINCT s.id) FROM sessions s
        JOIN trades t ON t.session_id = s.id
        WHERE s.date BETWEEN ? AND ?) AS sessions_with_trades,
      COUNT(t.id) AS total_trades,
      SUM(CASE WHEN o.result IN ('WIN_2R', 'WIN_3R') THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN o.result = 'LOSS' THEN 1 ELSE 0 END) AS losses,
      SUM(CASE WHEN o.result = 'BREAKEVEN_STOP' THEN 1 ELSE 0 END) AS breakevens,
      SUM(CASE WHEN o.result = 'SESSION_TIMEOUT' THEN 1 ELSE 0 END) AS timeouts,
      COALESCE(SUM(o.realized_r), 0) AS total_realized_r,
      COALESCE(AVG(o.realized_r), 0) AS avg_realized_r,
      COALESCE(MAX(o.max_favorable_r), 0) AS max_favorable_r,
      COALESCE(MAX(o.max_adverse_r), 0) AS max_adverse_r,
      COALESCE(SUM(CASE WHEN o.realized_r > 0 THEN o.realized_r ELSE 0 END), 0) AS total_winning_r,
      COALESCE(SUM(CASE WHEN o.realized_r < 0 THEN o.realized_r ELSE 0 END), 0) AS total_losing_r
    FROM trades t
    JOIN sessions s ON t.session_id = s.id
    LEFT JOIN trade_outcomes o ON o.trade_id = t.id
    WHERE s.date BETWEEN ? AND ?
  `);

  const overviewBySymbol = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM sessions WHERE date BETWEEN ? AND ? AND symbol = ?) AS total_sessions,
      (SELECT COUNT(DISTINCT s.id) FROM sessions s
        JOIN trades t ON t.session_id = s.id
        WHERE s.date BETWEEN ? AND ? AND s.symbol = ?) AS sessions_with_trades,
      COUNT(t.id) AS total_trades,
      SUM(CASE WHEN o.result IN ('WIN_2R', 'WIN_3R') THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN o.result = 'LOSS' THEN 1 ELSE 0 END) AS losses,
      SUM(CASE WHEN o.result = 'BREAKEVEN_STOP' THEN 1 ELSE 0 END) AS breakevens,
      SUM(CASE WHEN o.result = 'SESSION_TIMEOUT' THEN 1 ELSE 0 END) AS timeouts,
      COALESCE(SUM(o.realized_r), 0) AS total_realized_r,
      COALESCE(AVG(o.realized_r), 0) AS avg_realized_r,
      COALESCE(MAX(o.max_favorable_r), 0) AS max_favorable_r,
      COALESCE(MAX(o.max_adverse_r), 0) AS max_adverse_r,
      COALESCE(SUM(CASE WHEN o.realized_r > 0 THEN o.realized_r ELSE 0 END), 0) AS total_winning_r,
      COALESCE(SUM(CASE WHEN o.realized_r < 0 THEN o.realized_r ELSE 0 END), 0) AS total_losing_r
    FROM trades t
    JOIN sessions s ON t.session_id = s.id
    LEFT JOIN trade_outcomes o ON o.trade_id = t.id
    WHERE s.date BETWEEN ? AND ? AND s.symbol = ?
  `);

  // ── Equity curve ──

  const equityCurveAll = db.prepare(`
    SELECT
      s.date,
      SUM(o.realized_r) AS daily_r
    FROM trade_outcomes o
    JOIN trades t ON o.trade_id = t.id
    JOIN sessions s ON t.session_id = s.id
    WHERE s.date BETWEEN ? AND ?
    GROUP BY s.date
    ORDER BY s.date ASC
  `);

  const equityCurveBySymbol = db.prepare(`
    SELECT
      s.date,
      SUM(o.realized_r) AS daily_r
    FROM trade_outcomes o
    JOIN trades t ON o.trade_id = t.id
    JOIN sessions s ON t.session_id = s.id
    WHERE s.date BETWEEN ? AND ? AND s.symbol = ?
    GROUP BY s.date
    ORDER BY s.date ASC
  `);

  // ── Full session by id ──

  const sessionById = db.prepare('SELECT * FROM sessions WHERE id = ?');

  const tradesBySessionId = db.prepare(
    'SELECT * FROM trades WHERE session_id = ? ORDER BY entry_timestamp ASC',
  );

  const signalsBySessionId = db.prepare(
    'SELECT * FROM signals WHERE session_id = ? ORDER BY timestamp ASC',
  );

  const barsBySessionId = db.prepare(
    'SELECT * FROM bars WHERE session_id = ? ORDER BY timestamp ASC',
  );

  const outcomesBySessionId = db.prepare(`
    SELECT o.*
    FROM trade_outcomes o
    JOIN trades t ON o.trade_id = t.id
    WHERE t.session_id = ?
    ORDER BY o.exit_timestamp ASC
  `);

  // ── Distinct symbols ──

  const distinctSymbols = db.prepare(
    'SELECT DISTINCT symbol FROM sessions ORDER BY symbol ASC',
  );

  return {
    getSessionList(
      from: string,
      to: string,
      symbol?: string,
    ): SessionListRow[] {
      if (symbol) {
        return sessionListBySymbol.all(from, to, symbol) as SessionListRow[];
      }
      return sessionListAll.all(from, to) as SessionListRow[];
    },

    getOverviewStats(
      from: string,
      to: string,
      symbol?: string,
    ): OverviewStatsRow {
      if (symbol) {
        return overviewBySymbol.get(from, to, symbol, from, to, symbol, from, to, symbol) as OverviewStatsRow;
      }
      return overviewAll.get(from, to, from, to, from, to) as OverviewStatsRow;
    },

    getEquityCurve(
      from: string,
      to: string,
      symbol?: string,
    ): EquityCurvePoint[] {
      const rows = symbol
        ? (equityCurveBySymbol.all(from, to, symbol) as { date: string; daily_r: number }[])
        : (equityCurveAll.all(from, to) as { date: string; daily_r: number }[]);

      let cumulative = 0;
      return rows.map((row) => {
        cumulative += row.daily_r;
        return {
          date: row.date,
          cumulative_r: Math.round(cumulative * 100) / 100,
        };
      });
    },

    getSessionById(id: number) {
      return sessionById.get(id) as SessionListRow | undefined;
    },

    getTradesBySessionId(sessionId: number) {
      return tradesBySessionId.all(sessionId);
    },

    getSignalsBySessionId(sessionId: number) {
      return signalsBySessionId.all(sessionId);
    },

    getBarsBySessionId(sessionId: number) {
      return barsBySessionId.all(sessionId);
    },

    getOutcomesBySessionId(sessionId: number) {
      return outcomesBySessionId.all(sessionId);
    },

    getDistinctSymbols(): string[] {
      return (distinctSymbols.all() as SymbolListRow[]).map((r) => r.symbol);
    },
  };
}
