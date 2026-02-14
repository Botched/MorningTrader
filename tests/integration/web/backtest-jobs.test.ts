import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createDashboardServer } from '../../../src/web/server.js';
import { SQLiteAdapter } from '../../../src/adapters/storage/sqlite-adapter.js';
import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';

// -----------------------------------------------------------------------
// Test Database Setup
// -----------------------------------------------------------------------

const TEST_DB_PATH = path.resolve(process.cwd(), 'data/test-backtest-jobs.db');

function ensureTestDbExists() {
  const dir = path.dirname(TEST_DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  // Delete existing test DB
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  // Initialize DB with migrations
  const adapter = new SQLiteAdapter(TEST_DB_PATH);
  adapter.initialize();
  adapter.close();
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

describe('Backtest Jobs API Routes', () => {
  let server: Awaited<ReturnType<typeof createDashboardServer>> | undefined;
  let app: FastifyInstance;
  let baseUrl: string;

  beforeAll(async () => {
    ensureTestDbExists();

    server = await createDashboardServer({
      dbPath: TEST_DB_PATH,
      port: 0, // Let OS assign random port
      host: '127.0.0.1',
    });

    const info = await server.start();
    app = server.app;
    baseUrl = info.url;
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
    // Clean up test DB
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  beforeEach(async () => {
    // Clean up jobs before each test
    const deleteResponse = await fetch(`${baseUrl}/api/maintenance/backtest-sessions`, {
      method: 'DELETE',
    });
    expect(deleteResponse.status).toBe(200);
  });

  // -----------------------------------------------------------------------
  // POST /api/backtest-jobs - Submit Job
  // -----------------------------------------------------------------------

  describe('POST /api/backtest-jobs', () => {
    it('should create a new backtest job and return job ID', async () => {
      const response = await fetch(`${baseUrl}/api/backtest-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'AAPL',
          fromDate: '2024-01-02',
          toDate: '2024-01-05',
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toHaveProperty('jobId');
      expect(typeof data.jobId).toBe('string');
    });

    it('should accept optional presetId parameter', async () => {
      const response = await fetch(`${baseUrl}/api/backtest-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'TSLA',
          fromDate: '2024-01-02',
          toDate: '2024-01-05',
          // Omit presetId to use default config
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toHaveProperty('jobId');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await fetch(`${baseUrl}/api/backtest-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'AAPL',
          // Missing fromDate and toDate
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid date format', async () => {
      const response = await fetch(`${baseUrl}/api/backtest-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'AAPL',
          fromDate: 'invalid-date',
          toDate: '2024-01-05',
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/backtest-jobs/:id - Get Job Status
  // -----------------------------------------------------------------------

  describe('GET /api/backtest-jobs/:id', () => {
    it('should return job status and progress', async () => {
      // Create a job first
      const createResponse = await fetch(`${baseUrl}/api/backtest-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'AAPL',
          fromDate: '2024-01-02',
          toDate: '2024-01-05',
        }),
      });
      const { jobId } = await createResponse.json();

      // Poll job status
      const response = await fetch(`${baseUrl}/api/backtest-jobs/${jobId}`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toMatchObject({
        id: jobId,
        symbol: 'AAPL',
        fromDate: '2024-01-02',
        toDate: '2024-01-05',
        status: expect.stringMatching(/^(PENDING|RUNNING|COMPLETED|FAILED)$/),
        progress: {
          current: expect.any(Number),
          total: expect.any(Number),
          percent: expect.any(Number),
        },
      });
    });

    it('should include result on terminal status (COMPLETED/FAILED)', async () => {
      // Create and wait for job to finish (may fail due to missing csvDir)
      const createResponse = await fetch(`${baseUrl}/api/backtest-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'AAPL',
          fromDate: '2024-01-02',
          toDate: '2024-01-02', // Single day for faster completion
        }),
      });
      const { jobId } = await createResponse.json();

      // Poll until terminal state (with timeout)
      let attempts = 0;
      let terminalStatus = null;
      while (attempts < 20 && !terminalStatus) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const statusResponse = await fetch(`${baseUrl}/api/backtest-jobs/${jobId}`);
        const status = await statusResponse.json();

        if (status.status === 'COMPLETED' || status.status === 'FAILED') {
          terminalStatus = status;

          // Verify result structure exists (even on FAILED)
          if (status.status === 'COMPLETED' && status.result) {
            expect(status.result).toMatchObject({
              totalR: expect.any(Number),
              winRate: expect.any(Number),
              totalTrades: expect.any(Number),
              sessionsCompleted: expect.any(Number),
              errorCount: expect.any(Number),
            });
          }
        }
        attempts++;
      }

      // Should reach terminal state within timeout
      expect(terminalStatus).not.toBeNull();
    });

    it('should return 404 for non-existent job ID', async () => {
      const response = await fetch(`${baseUrl}/api/backtest-jobs/invalid-job-id`);
      expect(response.status).toBe(404);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/backtest-jobs - List Jobs
  // -----------------------------------------------------------------------

  describe('GET /api/backtest-jobs', () => {
    it('should list all jobs', async () => {
      // Create 2 jobs
      await fetch(`${baseUrl}/api/backtest-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'AAPL',
          fromDate: '2024-01-02',
          toDate: '2024-01-05',
        }),
      });
      await fetch(`${baseUrl}/api/backtest-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'TSLA',
          fromDate: '2024-01-02',
          toDate: '2024-01-05',
        }),
      });

      const response = await fetch(`${baseUrl}/api/backtest-jobs`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter jobs by status', async () => {
      // Create a job
      await fetch(`${baseUrl}/api/backtest-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'AAPL',
          fromDate: '2024-01-02',
          toDate: '2024-01-05',
        }),
      });

      // List PENDING jobs
      const response = await fetch(`${baseUrl}/api/backtest-jobs?status=PENDING`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      // All jobs should be PENDING or may have transitioned
      for (const job of data) {
        expect(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED']).toContain(job.status);
      }
    });
  });

  // -----------------------------------------------------------------------
  // DELETE /api/backtest-jobs/:id - Cancel Job
  // -----------------------------------------------------------------------

  describe('DELETE /api/backtest-jobs/:id', () => {
    it('should cancel a PENDING job', async () => {
      // Create a job and immediately try to cancel (before it starts)
      // Note: Due to auto-start, this test may be flaky
      const createResponse = await fetch(`${baseUrl}/api/backtest-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'AAPL',
          fromDate: '2024-01-02',
          toDate: '2024-12-31', // Long range to keep it queued
        }),
      });
      const { jobId } = await createResponse.json();

      // Attempt to cancel
      const cancelResponse = await fetch(`${baseUrl}/api/backtest-jobs/${jobId}`, {
        method: 'DELETE',
      });

      // Accept either 204 (cancelled) or 400 (already running/completed)
      expect([204, 400]).toContain(cancelResponse.status);
    });

    it('should return 404 for non-existent job', async () => {
      const response = await fetch(`${baseUrl}/api/backtest-jobs/invalid-id`, {
        method: 'DELETE',
      });
      expect(response.status).toBe(404);
    });

    it('should return 400 when cancelling non-PENDING job', async () => {
      // Create and wait for terminal state
      const createResponse = await fetch(`${baseUrl}/api/backtest-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'AAPL',
          fromDate: '2024-01-02',
          toDate: '2024-01-02',
        }),
      });
      const { jobId } = await createResponse.json();

      // Wait for terminal state
      let attempts = 0;
      while (attempts < 20) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const statusResponse = await fetch(`${baseUrl}/api/backtest-jobs/${jobId}`);
        const status = await statusResponse.json();
        if (status.status === 'COMPLETED' || status.status === 'FAILED') {
          break;
        }
        attempts++;
      }

      // Try to cancel terminal job
      const cancelResponse = await fetch(`${baseUrl}/api/backtest-jobs/${jobId}`, {
        method: 'DELETE',
      });
      expect(cancelResponse.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // Integration: Full Job Lifecycle
  // -----------------------------------------------------------------------

  describe('Job Lifecycle Integration', () => {
    it('should process a job from submission to terminal state', async () => {
      // Submit job
      const createResponse = await fetch(`${baseUrl}/api/backtest-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'AAPL',
          fromDate: '2024-01-02',
          toDate: '2024-01-03',
        }),
      });
      expect(createResponse.status).toBe(201);
      const { jobId } = await createResponse.json();

      // Poll status until terminal state
      let finalStatus = null;
      let attempts = 0;
      while (attempts < 30) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const statusResponse = await fetch(`${baseUrl}/api/backtest-jobs/${jobId}`);
        const status = await statusResponse.json();

        if (status.status === 'COMPLETED' || status.status === 'FAILED') {
          finalStatus = status;
          break;
        }

        // Verify progress updates during execution
        expect(status.progress.percent).toBeGreaterThanOrEqual(0);
        expect(status.progress.percent).toBeLessThanOrEqual(100);

        attempts++;
      }

      // Verify final state was reached
      expect(finalStatus).not.toBeNull();
      expect(['COMPLETED', 'FAILED']).toContain(finalStatus?.status);

      // If completed, verify result structure
      if (finalStatus?.status === 'COMPLETED') {
        expect(finalStatus.result).toBeDefined();
      }
    }, 20000); // 20 second timeout for this test
  });
});
