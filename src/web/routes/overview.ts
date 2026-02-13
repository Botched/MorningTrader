import type { FastifyInstance } from 'fastify';
import type { createDashboardQueries } from '../../adapters/storage/queries/dashboard.js';
import { centsToDollars } from '../serializers.js';

type DashboardQueries = ReturnType<typeof createDashboardQueries>;

export function registerOverviewRoutes(
  app: FastifyInstance,
  queries: DashboardQueries,
) {
  app.get('/api/overview', async (request) => {
    const { from = '2000-01-01', to = '2099-12-31', symbol } =
      request.query as { from?: string; to?: string; symbol?: string };

    const stats = queries.getOverviewStats(from, to, symbol);
    const equityCurve = queries.getEquityCurve(from, to, symbol);

    const totalTrades = stats.total_trades || 0;
    const wins = stats.wins || 0;
    const losses = stats.losses || 0;

    const winRate = totalTrades > 0 ? wins / totalTrades : 0;

    // Profit Factor = Gross Profit / abs(Gross Loss)
    const totalWinningR = stats.total_winning_r || 0;
    const totalLosingR = stats.total_losing_r || 0;
    const profitFactor = totalLosingR < 0
      ? Math.round((totalWinningR / Math.abs(totalLosingR)) * 100) / 100
      : totalWinningR > 0 ? Infinity : 0;

    return {
      stats: {
        totalSessions: stats.total_sessions || 0,
        sessionsWithTrades: stats.sessions_with_trades || 0,
        totalTrades,
        wins,
        losses,
        breakevens: stats.breakevens || 0,
        timeouts: stats.timeouts || 0,
        winRate,
        profitFactor,
        totalR: Math.round((stats.total_realized_r || 0) * 100) / 100,
        avgR: Math.round((stats.avg_realized_r || 0) * 100) / 100,
        maxFavorableR: Math.round((stats.max_favorable_r || 0) * 100) / 100,
        maxAdverseR: Math.round((stats.max_adverse_r || 0) * 100) / 100,
      },
      equityCurve,
    };
  });
}
