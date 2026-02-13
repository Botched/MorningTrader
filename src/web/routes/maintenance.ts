import type { FastifyInstance } from 'fastify';
import type { StorageProvider } from '../../core/interfaces/index.js';

export async function maintenanceRoutes(
  fastify: FastifyInstance,
  storage: StorageProvider,
): Promise<void> {
  /**
   * DELETE /api/maintenance/backtest-sessions
   * Delete all backtest sessions, trades, outcomes, signals, and bars.
   * Preserves real trading data (is_backtest = 0).
   */
  fastify.delete('/api/maintenance/backtest-sessions', async (request, reply) => {
    try {
      storage.deleteAllBacktestSessions();
      return reply.code(200).send({ success: true, message: 'All backtest data deleted' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ success: false, error: message });
    }
  });
}
