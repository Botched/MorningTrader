/**
 * JobQueue - Async Backtest Job Orchestration
 *
 * Manages a queue of backtest jobs with:
 * - FIFO processing with concurrency limit = 1
 * - SQLite persistence for crash recovery
 * - EventEmitter for job lifecycle events
 * - Progress tracking via callbacks
 *
 * Job Lifecycle:
 * PENDING → RUNNING → COMPLETED/FAILED
 *
 * Events:
 * - 'started': job begins processing
 * - 'progress': progress update (current, total)
 * - 'completed': job finished successfully
 * - 'failed': job encountered error
 */

import { EventEmitter } from 'node:events';
import type { SQLiteAdapter } from '../adapters/storage/sqlite-adapter.js';
import type { BacktestRunner } from './backtest-runner.js';
import type { BacktestJob, BacktestJobRequest, BacktestJobResult } from '../core/models/backtest-job.js';

export interface JobQueueOptions {
  storage: SQLiteAdapter;
  backtestRunner: BacktestRunner;
  concurrency?: number; // Default: 1
  staleThresholdMs?: number; // Default: 1 hour
}

export class JobQueue extends EventEmitter {
  private storage: SQLiteAdapter;
  private backtestRunner: BacktestRunner;
  private concurrency: number;
  private staleThresholdMs: number;

  private queue: string[] = []; // Job IDs in FIFO order
  private processing = false;
  private runningJobs = 0;

  constructor(options: JobQueueOptions) {
    super();
    this.storage = options.storage;
    this.backtestRunner = options.backtestRunner;
    this.concurrency = options.concurrency ?? 1;
    this.staleThresholdMs = options.staleThresholdMs ?? 60 * 60 * 1000; // 1 hour
  }

  /**
   * Initialize the queue on startup
   * - Reset stale RUNNING jobs to FAILED
   * - Re-enqueue PENDING jobs
   */
  async initialize(): Promise<void> {
    // Find stale jobs (RUNNING for > 1 hour)
    const staleJobs = this.storage.getStaleJobs(this.staleThresholdMs);
    for (const job of staleJobs) {
      this.storage.updateJobStatus(job.id, 'FAILED');
      this.emit('failed', job.id, new Error('Job marked stale on startup'));
    }

    // Re-enqueue pending jobs
    const pendingJobs = this.storage.getBacktestJobs('PENDING');
    for (const job of pendingJobs) {
      this.queue.push(job.id);
    }
  }

  /**
   * Enqueue a new backtest job
   * Returns the job ID
   */
  enqueue(request: BacktestJobRequest): string {
    const jobId = this.storage.createBacktestJob(request);
    this.queue.push(jobId);

    // Start processing if not already running
    if (!this.processing) {
      this.start();
    }

    return jobId;
  }

  /**
   * Get job status by ID
   */
  getJobStatus(jobId: string): BacktestJob | null {
    return this.storage.getBacktestJob(jobId);
  }

  /**
   * List all jobs, optionally filtered by status
   */
  listJobs(status?: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'): BacktestJob[] {
    return this.storage.getBacktestJobs(status);
  }

  /**
   * Cancel a pending job
   * Only PENDING jobs can be cancelled (not RUNNING/COMPLETED/FAILED)
   */
  cancelJob(jobId: string): void {
    const job = this.storage.getBacktestJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status !== 'PENDING') {
      throw new Error(`Cannot cancel job in ${job.status} status`);
    }

    // Remove from queue
    const index = this.queue.indexOf(jobId);
    if (index !== -1) {
      this.queue.splice(index, 1);
    }

    // Mark as failed with cancellation message
    this.storage.updateJobStatus(jobId, 'FAILED');
    this.emit('failed', jobId, new Error('Job cancelled by user'));
  }

  /**
   * Start processing the queue
   */
  start(): void {
    if (this.processing) return;
    this.processing = true;
    this.processNext();
  }

  /**
   * Stop processing the queue (graceful shutdown)
   * Waits for current job to complete
   */
  async stop(): Promise<void> {
    this.processing = false;
    // Wait for running jobs to finish
    while (this.runningJobs > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Process next job in queue (private)
   */
  private async processNext(): Promise<void> {
    if (!this.processing) return;
    if (this.runningJobs >= this.concurrency) return;
    if (this.queue.length === 0) {
      // Queue empty, stop processing
      this.processing = false;
      return;
    }

    const jobId = this.queue.shift()!;
    this.runningJobs++;

    try {
      await this.runJob(jobId);
    } catch (error) {
      // Error already handled in runJob
    } finally {
      this.runningJobs--;
      // Process next job
      setImmediate(() => this.processNext());
    }
  }

  /**
   * Execute a single backtest job (private)
   */
  private async runJob(jobId: string): Promise<void> {
    const job = this.storage.getBacktestJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Mark as running
    this.storage.updateJobStatus(jobId, 'RUNNING');
    this.emit('started', jobId);

    try {
      // Get preset config if specified
      let presetId: number | undefined;
      if (job.presetId) {
        const preset = this.storage.getConfigPreset(job.presetId);
        if (!preset) {
          throw new Error(`Preset ${job.presetId} not found`);
        }
        presetId = preset.id;
      }

      // Run backtest with progress callback
      const result = await this.backtestRunner.runBacktest({
        symbol: job.symbol,
        fromDate: job.fromDate,
        toDate: job.toDate,
        source: 'csv', // TODO: support IBKR source in future
        presetId,
        onProgress: (current: number, total: number) => {
          // Update progress
          this.storage.updateJobProgress(jobId, current, total);
          this.emit('progress', jobId, current, total);
        },
      });

      // Calculate summary
      const totalTrades = result.sessions.reduce((sum, s) => sum + s.outcomes.length, 0);
      const winningTrades = result.sessions.reduce(
        (sum, s) =>
          sum +
          s.outcomes.filter((o) => o.result === 'WIN_2R' || o.result === 'WIN_3R').length,
        0,
      );
      const summary: BacktestJobResult = {
        totalR: result.sessions.reduce(
          (sum, s) => sum + s.outcomes.reduce((r, o) => r + o.realizedR, 0),
          0,
        ),
        winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
        totalTrades,
        sessionsCompleted: result.sessions.length,
        errorCount: result.errorDates.length,
      };

      // Mark as completed (stringify the summary)
      this.storage.completeBacktestJob(jobId, JSON.stringify(summary));
      this.emit('completed', jobId, summary);
    } catch (error) {
      // Mark as failed with error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.storage.updateJobStatus(jobId, 'FAILED', errorMessage);
      this.emit('failed', jobId, error);

      throw error; // Re-throw to be caught by processNext
    }
  }
}
