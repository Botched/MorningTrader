import type { FastifyInstance } from 'fastify';
import type { createDashboardQueries } from '../../adapters/storage/queries/dashboard.js';
import type { createAggregationQueries } from '../../adapters/storage/queries/aggregations.js';

type DashboardQueries = ReturnType<typeof createDashboardQueries>;
type AggregationQueries = ReturnType<typeof createAggregationQueries>;

export function registerStatsRoutes(
  app: FastifyInstance,
  dashboardQueries: DashboardQueries,
  aggregationQueries: AggregationQueries,
) {
  // ── Daily stats ─────────────────────────────────────────────

  app.get('/api/daily-stats', async (request) => {
    const { from = '2000-01-01', to = '2099-12-31', symbol } =
      request.query as { from?: string; to?: string; symbol?: string };

    const rows = aggregationQueries.getDailyStats(from, to, symbol);
    return {
      dailyStats: rows.map((row) => ({
        date: row.date,
        totalTrades: row.total_trades,
        wins: row.wins,
        losses: row.losses,
        totalR: Math.round(row.total_realized_r * 100) / 100,
        avgR: Math.round(row.avg_realized_r * 100) / 100,
      })),
    };
  });

  // ── Distinct symbols ──────────────────────────────────────────

  app.get('/api/symbols', async () => {
    const symbols = dashboardQueries.getDistinctSymbols();
    return { symbols };
  });
}
