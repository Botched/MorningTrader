/**
 * Summary API Routes
 *
 * Provides leaderboard and aggregate statistics endpoints:
 * - GET /api/summary/top-sessions - Top N sessions by total R
 * - GET /api/summary/by-stock - Aggregate stats per symbol
 */

import type { FastifyInstance } from 'fastify';
import type { createSummaryQueries } from '../../adapters/storage/queries/summary.js';

type SummaryQueries = ReturnType<typeof createSummaryQueries>;

/**
 * Helper: Convert cents to dollars
 */
function centsToDollars(cents: number | null): number | null {
  return cents !== null ? Math.round(cents) / 100 : null;
}

export function registerSummaryRoutes(
  app: FastifyInstance,
  summaryQueries: SummaryQueries,
) {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /api/summary/top-sessions - Top N sessions by total R
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  app.get('/api/summary/top-sessions', async (request, reply) => {
    const { limit = '50', include = 'both' } = request.query as {
      limit?: string;
      include?: string;
    };

    // Validate limit
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || ![10, 25, 50, 100].includes(limitNum)) {
      return reply.code(400).send({
        error: 'Invalid limit. Must be one of: 10, 25, 50, 100',
      });
    }

    // Validate include
    if (!['backtest', 'live', 'both'].includes(include)) {
      return reply.code(400).send({
        error: 'Invalid include. Must be one of: backtest, live, both',
      });
    }

    const rows = summaryQueries.getTopSessions(
      limitNum,
      include as 'backtest' | 'live' | 'both',
    );

    return rows.map((row) => ({
      sessionId: row.session_id,
      date: row.date,
      symbol: row.symbol,
      zoneResistance: centsToDollars(row.zone_resistance),
      zoneSupport: centsToDollars(row.zone_support),
      totalR: Math.round(row.total_r * 100) / 100,
      tradeCount: row.trade_count,
      result: row.result,
    }));
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /api/summary/by-stock - Aggregate stats per symbol
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  app.get('/api/summary/by-stock', async (request, reply) => {
    const { include = 'both' } = request.query as {
      include?: string;
    };

    // Validate include
    if (!['backtest', 'live', 'both'].includes(include)) {
      return reply.code(400).send({
        error: 'Invalid include. Must be one of: backtest, live, both',
      });
    }

    const rows = summaryQueries.getSessionsByStock(
      include as 'backtest' | 'live' | 'both',
    );

    return rows.map((row) => ({
      symbol: row.symbol,
      sessionCount: row.session_count,
      tradeCount: row.trade_count,
      wins: row.wins,
      losses: row.losses,
      winRate: Math.round(row.win_rate * 10000) / 100, // Convert to percentage (2 decimals)
      totalR: Math.round(row.total_r * 100) / 100,
      avgR: Math.round(row.avg_r * 100) / 100,
    }));
  });
}
