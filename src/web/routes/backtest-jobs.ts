/**
 * Backtest Jobs API Routes
 *
 * Endpoints for async backtest job management:
 * - POST /api/backtest-jobs - Submit new backtest job
 * - GET /api/backtest-jobs/:id - Poll job status
 * - GET /api/backtest-jobs - List all jobs (with optional filter)
 * - DELETE /api/backtest-jobs/:id - Cancel pending job
 */

import type { FastifyInstance } from 'fastify';
import type { JobQueue } from '../../services/job-queue.js';
import type { BacktestJobRequest } from '../../core/models/backtest-job.js';

export async function registerBacktestJobRoutes(
  app: FastifyInstance,
  jobQueue: JobQueue,
): Promise<void> {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /api/backtest-jobs - Submit new backtest job
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  app.post('/api/backtest-jobs', async (request, reply) => {
    const body = request.body as any;

    // Validate required fields
    if (!body.symbol || typeof body.symbol !== 'string') {
      return reply.code(400).send({ error: 'symbol is required (string)' });
    }
    if (!body.fromDate || typeof body.fromDate !== 'string') {
      return reply.code(400).send({ error: 'fromDate is required (YYYY-MM-DD)' });
    }
    if (!body.toDate || typeof body.toDate !== 'string') {
      return reply.code(400).send({ error: 'toDate is required (YYYY-MM-DD)' });
    }

    // Validate date format (basic check)
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(body.fromDate) || !datePattern.test(body.toDate)) {
      return reply.code(400).send({ error: 'Dates must be in YYYY-MM-DD format' });
    }

    // Optional presetId validation
    if (body.presetId !== undefined && typeof body.presetId !== 'number') {
      return reply.code(400).send({ error: 'presetId must be a number' });
    }

    try {
      const request: BacktestJobRequest = {
        symbol: body.symbol.toUpperCase(),
        fromDate: body.fromDate,
        toDate: body.toDate,
        presetId: body.presetId,
      };

      const jobId = jobQueue.enqueue(request);

      return reply.code(201).send({ jobId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit job';
      return reply.code(500).send({ error: message });
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /api/backtest-jobs/:id - Poll job status
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  app.get('/api/backtest-jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const job = jobQueue.getJobStatus(id);
    if (!job) {
      return reply.code(404).send({ error: `Job ${id} not found` });
    }

    // Calculate progress percentage
    const percent =
      job.progressTotal > 0 ? Math.round((job.progressCurrent / job.progressTotal) * 100) : 0;

    // Deserialize result summary if present
    let result = null;
    if (job.resultSummary) {
      try {
        result = JSON.parse(job.resultSummary);
      } catch {
        // Invalid JSON, leave as null
      }
    }

    return reply.code(200).send({
      id: job.id,
      symbol: job.symbol,
      fromDate: job.fromDate,
      toDate: job.toDate,
      presetId: job.presetId,
      status: job.status,
      progress: {
        current: job.progressCurrent,
        total: job.progressTotal,
        percent,
      },
      result,
      error: job.errorMessage,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /api/backtest-jobs - List all jobs (with optional status filter)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  app.get('/api/backtest-jobs', async (request, reply) => {
    const query = request.query as { status?: string };

    // Validate status filter if provided
    const validStatuses = ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'];
    if (query.status && !validStatuses.includes(query.status)) {
      return reply
        .code(400)
        .send({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    try {
      const status = query.status as 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | undefined;
      const jobs = jobQueue.listJobs(status);

      // Map to response format with progress calculation
      const response = jobs.map((job) => {
        const percent =
          job.progressTotal > 0
            ? Math.round((job.progressCurrent / job.progressTotal) * 100)
            : 0;

        let result = null;
        if (job.resultSummary) {
          try {
            result = JSON.parse(job.resultSummary);
          } catch {
            // Invalid JSON, leave as null
          }
        }

        return {
          id: job.id,
          symbol: job.symbol,
          fromDate: job.fromDate,
          toDate: job.toDate,
          presetId: job.presetId,
          status: job.status,
          progress: {
            current: job.progressCurrent,
            total: job.progressTotal,
            percent,
          },
          result,
          error: job.errorMessage,
          createdAt: job.createdAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
        };
      });

      return reply.code(200).send(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list jobs';
      return reply.code(500).send({ error: message });
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DELETE /api/backtest-jobs/:id - Cancel pending job
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  app.delete('/api/backtest-jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      jobQueue.cancelJob(id);
      return reply.code(204).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cancel job';

      // Check if error is "not found" vs "cannot cancel"
      if (message.includes('not found')) {
        return reply.code(404).send({ error: message });
      }
      if (message.includes('Cannot cancel')) {
        return reply.code(400).send({ error: message });
      }

      return reply.code(500).send({ error: message });
    }
  });
}
