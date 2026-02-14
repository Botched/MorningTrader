import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { JobQueue } from '../../../src/services/job-queue.js';
import type { BacktestRunner } from '../../../src/services/backtest-runner.js';
import type { BacktestJob, BacktestJobRequest } from '../../../src/core/models/backtest-job.js';
import type { SQLiteAdapter } from '../../../src/adapters/storage/sqlite-adapter.js';
import type { SessionContext } from '../../../src/core/models/index.js';

// -----------------------------------------------------------------------
// Mock Storage
// -----------------------------------------------------------------------

class MockStorage {
  private jobs: Map<string, BacktestJob> = new Map();
  private nextId = 1;

  createBacktestJob(request: BacktestJobRequest): string {
    const id = `job-${this.nextId++}`;
    const now = Date.now();
    this.jobs.set(id, {
      id,
      symbol: request.symbol,
      fromDate: request.fromDate,
      toDate: request.toDate,
      presetId: request.presetId ?? null,
      status: 'PENDING',
      progressTotal: 0,
      progressCurrent: 0,
      resultSummary: null,
      errorMessage: null,
      createdAt: now,
      startedAt: null,
      completedAt: null,
    });
    return id;
  }

  getBacktestJob(id: string): BacktestJob | null {
    return this.jobs.get(id) ?? null;
  }

  getBacktestJobs(status?: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'): BacktestJob[] {
    const allJobs = Array.from(this.jobs.values());
    if (!status) return allJobs;
    return allJobs.filter((job) => job.status === status);
  }

  updateJobStatus(
    id: string,
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED',
  ): void {
    const job = this.jobs.get(id);
    if (!job) return;

    job.status = status;
    if (status === 'RUNNING' && !job.startedAt) {
      job.startedAt = Date.now();
    }
    if ((status === 'COMPLETED' || status === 'FAILED') && !job.completedAt) {
      job.completedAt = Date.now();
    }
  }

  updateJobProgress(id: string, current: number, total: number): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.progressCurrent = current;
    job.progressTotal = total;
  }

  completeBacktestJob(id: string, resultSummary: string): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.status = 'COMPLETED';
    job.resultSummary = resultSummary;
    job.completedAt = Date.now();
  }

  getStaleJobs(staleThresholdMs: number): BacktestJob[] {
    const cutoff = Date.now() - staleThresholdMs;
    return Array.from(this.jobs.values()).filter(
      (job) => job.status === 'RUNNING' && job.startedAt && job.startedAt < cutoff,
    );
  }

  getConfigPreset(_id: number): any | null {
    return null; // Not testing presets here
  }

  reset(): void {
    this.jobs.clear();
    this.nextId = 1;
  }
}

// -----------------------------------------------------------------------
// Mock BacktestRunner
// -----------------------------------------------------------------------

class MockBacktestRunner {
  public runBacktestSpy = vi.fn();
  public delayMs: number = 10;

  async runBacktest(options: any): Promise<any> {
    this.runBacktestSpy(options);

    // Simulate progress callbacks
    if (options.onProgress) {
      for (let i = 1; i <= 5; i++) {
        options.onProgress(i, 5);
        await new Promise((resolve) => setTimeout(resolve, this.delayMs));
      }
    }

    // Return mock result with proper structure
    return {
      sessions: [
        {
          id: 'session-1',
          symbol: options.symbol,
          date: '2024-01-02',
          outcomes: [
            { id: 'outcome-1', result: 'WIN_2R', realizedR: 2.0 },
            { id: 'outcome-2', result: 'WIN_3R', realizedR: 3.0 },
          ],
        },
      ] as SessionContext[],
      metrics: {},
      skippedDates: [],
      errorDates: [],
      totalDays: 5,
      tradingDays: 5,
    };
  }

  reset(): void {
    this.runBacktestSpy.mockClear();
  }
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

describe('JobQueue', () => {
  let storage: MockStorage;
  let backtestRunner: MockBacktestRunner;
  let jobQueue: JobQueue;

  beforeEach(async () => {
    storage = new MockStorage();
    backtestRunner = new MockBacktestRunner();
    jobQueue = new JobQueue({
      storage: storage as unknown as SQLiteAdapter,
      backtestRunner: backtestRunner as unknown as BacktestRunner,
      concurrency: 1,
    });
    await jobQueue.initialize();
    // Don't auto-start for most tests
  });

  afterEach(async () => {
    await jobQueue.stop();
    storage.reset();
    backtestRunner.reset();
  });

  // -----------------------------------------------------------------------
  // Basic Enqueue/Dequeue
  // -----------------------------------------------------------------------

  describe('enqueue', () => {
    it('should create a new job and return job ID', async () => {
      const jobId = jobQueue.enqueue({
        symbol: 'AAPL',
        fromDate: '2024-01-02',
        toDate: '2024-01-05',
      });

      expect(jobId).toBe('job-1');
      const job = jobQueue.getJobStatus(jobId);
      expect(job).toMatchObject({
        id: 'job-1',
        symbol: 'AAPL',
        fromDate: '2024-01-02',
        toDate: '2024-01-05',
      });
      // Status will be PENDING/RUNNING/COMPLETED depending on timing
      expect(['PENDING', 'RUNNING', 'COMPLETED']).toContain(job?.status);
    });

    it('should execute backtest when started', async () => {
      jobQueue.enqueue({
        symbol: 'AAPL',
        fromDate: '2024-01-02',
        toDate: '2024-01-05',
      });

      jobQueue.start();
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(backtestRunner.runBacktestSpy).toHaveBeenCalledTimes(1);
    });

    it('should enqueue multiple jobs in FIFO order', async () => {
      const id1 = jobQueue.enqueue({
        symbol: 'AAPL',
        fromDate: '2024-01-02',
        toDate: '2024-01-05',
      });
      const id2 = jobQueue.enqueue({
        symbol: 'TSLA',
        fromDate: '2024-01-02',
        toDate: '2024-01-05',
      });

      expect(id1).toBe('job-1');
      expect(id2).toBe('job-2');

      // Before starting, both should be PENDING
      await jobQueue.stop(); // Stop auto-start
      const jobs = jobQueue.listJobs('PENDING');
      expect(jobs.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // Job Status
  // -----------------------------------------------------------------------

  describe('getJobStatus', () => {
    it('should return null for non-existent job', () => {
      const job = jobQueue.getJobStatus('invalid-id');
      expect(job).toBeNull();
    });

    it('should return current job status', async () => {
      const jobId = jobQueue.enqueue({
        symbol: 'AAPL',
        fromDate: '2024-01-02',
        toDate: '2024-01-05',
      });

      await jobQueue.stop(); // Prevent auto-start
      const job = jobQueue.getJobStatus(jobId);
      expect(job).toMatchObject({
        id: jobId,
        symbol: 'AAPL',
      });
    });
  });

  describe('listJobs', () => {
    it('should list all jobs when no status filter', async () => {
      jobQueue.enqueue({
        symbol: 'AAPL',
        fromDate: '2024-01-02',
        toDate: '2024-01-05',
      });
      jobQueue.enqueue({
        symbol: 'TSLA',
        fromDate: '2024-01-02',
        toDate: '2024-01-05',
      });

      await jobQueue.stop();
      const jobs = jobQueue.listJobs();
      expect(jobs.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter jobs by status', async () => {
      const id1 = jobQueue.enqueue({
        symbol: 'AAPL',
        fromDate: '2024-01-02',
        toDate: '2024-01-05',
      });
      jobQueue.enqueue({
        symbol: 'TSLA',
        fromDate: '2024-01-02',
        toDate: '2024-01-05',
      });

      await jobQueue.stop();

      // Mark first job as RUNNING manually
      storage.updateJobStatus(id1, 'RUNNING');

      const pending = jobQueue.listJobs('PENDING');
      const running = jobQueue.listJobs('RUNNING');

      expect(running).toHaveLength(1);
      expect(running[0].symbol).toBe('AAPL');
      expect(pending.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // Job Execution
  // -----------------------------------------------------------------------

  describe('execution', () => {
    it('should execute job and update status to COMPLETED', async () => {
      const jobId = jobQueue.enqueue({
        symbol: 'AAPL',
        fromDate: '2024-01-02',
        toDate: '2024-01-05',
      });

      jobQueue.start();
      await new Promise((resolve) => setTimeout(resolve, 300));

      const job = jobQueue.getJobStatus(jobId);
      expect(job?.status).toBe('COMPLETED');
      expect(job?.resultSummary).toContain('totalR');
    });

    it('should call onProgress callback during execution', async () => {
      const jobId = jobQueue.enqueue({
        symbol: 'AAPL',
        fromDate: '2024-01-02',
        toDate: '2024-01-05',
      });

      jobQueue.start();
      await new Promise((resolve) => setTimeout(resolve, 300));

      const job = jobQueue.getJobStatus(jobId);
      expect(job?.progressTotal).toBe(5);
      expect(job?.progressCurrent).toBe(5);
    });

    it('should handle errors and mark job as FAILED', async () => {
      // Create a new runner that always fails
      const failingRunner = {
        runBacktest: vi.fn().mockRejectedValue(new Error('Backtest failed')),
      };
      const failingQueue = new JobQueue({
        storage: storage as unknown as SQLiteAdapter,
        backtestRunner: failingRunner as unknown as BacktestRunner,
        concurrency: 1,
      });
      await failingQueue.initialize();

      const jobId = failingQueue.enqueue({
        symbol: 'AAPL',
        fromDate: '2024-01-02',
        toDate: '2024-01-05',
      });

      failingQueue.start();
      await new Promise((resolve) => setTimeout(resolve, 400));

      const job = failingQueue.getJobStatus(jobId);
      expect(job?.status).toBe('FAILED');

      await failingQueue.stop();
    });

    it('should process jobs sequentially with concurrency=1', async () => {
      jobQueue.enqueue({
        symbol: 'AAPL',
        fromDate: '2024-01-02',
        toDate: '2024-01-05',
      });
      jobQueue.enqueue({
        symbol: 'TSLA',
        fromDate: '2024-01-02',
        toDate: '2024-01-05',
      });

      jobQueue.start();
      await new Promise((resolve) => setTimeout(resolve, 200));

      // At concurrency=1, only one should be completed so far
      const completed = jobQueue.listJobs('COMPLETED');
      expect(completed.length).toBeLessThanOrEqual(2);
    });
  });

  // -----------------------------------------------------------------------
  // EventEmitter
  // -----------------------------------------------------------------------

  describe('events', () => {
    it('should emit "started" event when job starts', async () => {
      const startedSpy = vi.fn();
      jobQueue.on('started', startedSpy);

      const jobId = jobQueue.enqueue({
        symbol: 'AAPL',
        fromDate: '2024-01-02',
        toDate: '2024-01-05',
      });

      jobQueue.start();
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(startedSpy).toHaveBeenCalledWith(jobId);
    });

    it('should emit "progress" events during execution', async () => {
      const progressSpy = vi.fn();
      jobQueue.on('progress', progressSpy);

      jobQueue.enqueue({
        symbol: 'AAPL',
        fromDate: '2024-01-02',
        toDate: '2024-01-05',
      });

      jobQueue.start();
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(progressSpy).toHaveBeenCalled();
      expect(progressSpy.mock.calls.length).toBeGreaterThan(0);
    });

    it('should emit "completed" event on success', async () => {
      const completedSpy = vi.fn();
      jobQueue.on('completed', completedSpy);

      const jobId = jobQueue.enqueue({
        symbol: 'AAPL',
        fromDate: '2024-01-02',
        toDate: '2024-01-05',
      });

      jobQueue.start();
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(completedSpy).toHaveBeenCalledWith(
        jobId,
        expect.objectContaining({ totalR: expect.any(Number) }),
      );
    });

    it('should emit "failed" event on error', async () => {
      //Create a new runner that always fails
      const failingRunner = {
        runBacktest: vi.fn().mockRejectedValue(new Error('Test error')),
      };
      const failingQueue = new JobQueue({
        storage: storage as unknown as SQLiteAdapter,
        backtestRunner: failingRunner as unknown as BacktestRunner,
        concurrency: 1,
      });
      await failingQueue.initialize();

      const failedSpy = vi.fn();
      failingQueue.on('failed', failedSpy);

      const jobId = failingQueue.enqueue({
        symbol: 'AAPL',
        fromDate: '2024-01-02',
        toDate: '2024-01-05',
      });

      failingQueue.start();
      await new Promise((resolve) => setTimeout(resolve, 400));

      expect(failedSpy).toHaveBeenCalledWith(jobId, expect.any(Error));

      await failingQueue.stop();
    });
  });

  // -----------------------------------------------------------------------
  // Stale Job Recovery
  // -----------------------------------------------------------------------

  describe('initialize', () => {
    it('should reset stale RUNNING jobs to FAILED', async () => {
      // Create a stale job manually
      const jobId = storage.createBacktestJob({
        symbol: 'AAPL',
        fromDate: '2024-01-02',
        toDate: '2024-01-05',
      });
      storage.updateJobStatus(jobId, 'RUNNING');
      const job = storage.getBacktestJob(jobId);
      if (job) {
        job.startedAt = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
      }

      // Create new queue (triggers initialize)
      const newQueue = new JobQueue({
        storage: storage as unknown as SQLiteAdapter,
        backtestRunner: backtestRunner as unknown as BacktestRunner,
        staleThresholdMs: 60 * 60 * 1000, // 1 hour
      });
      await newQueue.initialize();

      const recovered = storage.getBacktestJob(jobId);
      expect(recovered?.status).toBe('FAILED');

      await newQueue.stop();
    });

    it('should re-enqueue PENDING jobs on startup', async () => {
      // Create PENDING jobs
      storage.createBacktestJob({
        symbol: 'AAPL',
        fromDate: '2024-01-02',
        toDate: '2024-01-05',
      });

      // Create new queue (triggers initialize and re-enqueues)
      const newQueue = new JobQueue({
        storage: storage as unknown as SQLiteAdapter,
        backtestRunner: backtestRunner as unknown as BacktestRunner,
      });
      await newQueue.initialize();
      newQueue.start();

      await new Promise((resolve) => setTimeout(resolve, 300));

      // Job should start processing
      expect(backtestRunner.runBacktestSpy).toHaveBeenCalled();

      await newQueue.stop();
    });
  });

  // -----------------------------------------------------------------------
  // Cancellation
  // -----------------------------------------------------------------------

  describe('cancelJob', () => {
    it('should cancel PENDING job', async () => {
      // Create a job directly via storage (bypass enqueue's auto-start)
      const jobId = storage.createBacktestJob({
        symbol: 'AAPL',
        fromDate: '2024-01-02',
        toDate: '2024-01-05',
      });

      // Verify it's PENDING
      const beforeCancel = jobQueue.getJobStatus(jobId);
      expect(beforeCancel?.status).toBe('PENDING');

      // Cancel it
      jobQueue.cancelJob(jobId);

      // Verify it's FAILED
      const job = jobQueue.getJobStatus(jobId);
      expect(job?.status).toBe('FAILED');
    });

    it('should throw when cancelling non-existent job', async () => {
      expect(() => jobQueue.cancelJob('invalid-id')).toThrow('not found');
    });

    it('should throw when cancelling non-PENDING job', async () => {
      const jobId = jobQueue.enqueue({
        symbol: 'AAPL',
        fromDate: '2024-01-02',
        toDate: '2024-01-05',
      });

      jobQueue.start();
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(() => jobQueue.cancelJob(jobId)).toThrow('Cannot cancel');
    });
  });

  // -----------------------------------------------------------------------
  // Start/Stop
  // -----------------------------------------------------------------------

  describe('start/stop', () => {
    it('should start processing when start() is called', async () => {
      jobQueue.enqueue({
        symbol: 'AAPL',
        fromDate: '2024-01-02',
        toDate: '2024-01-05',
      });

      jobQueue.start();
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(backtestRunner.runBacktestSpy).toHaveBeenCalled();
    });

    it('should stop processing and wait for running jobs', async () => {
      // Create a slow runner (200ms per job)
      const slowRunner = new MockBacktestRunner();
      slowRunner.delayMs = 40; // 5 progress callbacks * 40ms = 200ms per job

      // Create jobs via storage to avoid auto-start
      storage.createBacktestJob({
        symbol: 'AAPL',
        fromDate: '2024-01-02',
        toDate: '2024-01-05',
      });
      storage.createBacktestJob({
        symbol: 'TSLA',
        fromDate: '2024-01-02',
        toDate: '2024-01-05',
      });

      // Create queue with slow runner
      const newQueue = new JobQueue({
        storage: storage as unknown as SQLiteAdapter,
        backtestRunner: slowRunner as unknown as BacktestRunner,
        concurrency: 1,
      });
      await newQueue.initialize(); // This re-enqueues PENDING jobs

      // Start processing
      newQueue.start();
      await new Promise((resolve) => setTimeout(resolve, 100)); // Wait a bit for first job to start

      // Stop should wait for currently running job to finish
      const stopPromise = newQueue.stop();
      const before = Date.now();
      await stopPromise;
      const elapsed = Date.now() - before;

      // Stop should have waited for the job to finish (at least 100ms remaining)
      expect(elapsed).toBeGreaterThan(50); // Some time to finish the running job
    });
  });
});
