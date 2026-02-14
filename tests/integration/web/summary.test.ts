/**
 * Integration tests for Summary API routes
 *
 * Tests the leaderboard and aggregate statistics endpoints.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync, existsSync } from 'node:fs';
import { createDashboardServer } from '../../../src/web/server.js';
import type { DashboardServerOptions } from '../../../src/web/server.js';
import { SQLiteAdapter } from '../../../src/adapters/storage/sqlite-adapter.js';

describe('Summary API', () => {
  let serverUrl: string;
  let serverInstance: Awaited<ReturnType<typeof createDashboardServer>>;
  let dbPath: string;
  let storage: SQLiteAdapter;

  beforeAll(async () => {
    // Create temp database
    dbPath = join(tmpdir(), `morningtrader-summary-test-${Date.now()}.db`);

    // Initialize database with migrations
    storage = new SQLiteAdapter(dbPath);
    storage.initialize();

    // Seed database with test data
    seedTestData();

    // Close adapter (server will open its own connection)
    storage.close();

    // Create and start server
    const options: DashboardServerOptions = {
      dbPath,
      port: 0, // Let OS assign port
      host: '127.0.0.1',
    };

    serverInstance = await createDashboardServer(options);
    const { url } = await serverInstance.start();
    serverUrl = url;
  });

  afterAll(async () => {
    await serverInstance.stop();

    // Clean up temp database
    if (existsSync(dbPath)) unlinkSync(dbPath);
    if (existsSync(dbPath + '-shm')) unlinkSync(dbPath + '-shm');
    if (existsSync(dbPath + '-wal')) unlinkSync(dbPath + '-wal');
  });

  function seedTestData() {
    // Reopen adapter for seeding
    const adapter = new SQLiteAdapter(dbPath);
    adapter.initialize();

    const now = Date.now();

    // Create 5 backtest sessions and 3 live sessions
    // Backtest sessions with varying total R
    for (let i = 0; i < 5; i++) {
      const sessionId = adapter.saveSession({
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        symbol: i < 3 ? 'AAPL' : 'TSLA',
        executionMode: 'mock',
        isBacktest: true,
        status: 'COMPLETED',
        zone: {
          resistance: 21000 + i * 100, // $210.00, $211.00, etc.
          support: 20900 + i * 100,
          status: 'VALID',
        },
        startedAt: now,
        completedAt: now + 3600000,
      });

      // Add trade and outcome with varying R
      const tradeId = `trade-backtest-${i}`;
      adapter.saveTrade({
        id: tradeId,
        symbol: i < 3 ? 'AAPL' : 'TSLA',
        direction: 'LONG',
        entryPrice: 21000 + i * 100,
        stopLevel: 20900 + i * 100,
        currentStop: 20900 + i * 100,
        rValue: 100,
        target1R: 21100 + i * 100,
        target2R: 21200 + i * 100,
        target3R: 21300 + i * 100,
        entryTimestamp: now,
        status: 'CLOSED',
      }, sessionId);

      // Vary the realized R: +3R, +2R, +1R, -1R, +0.5R
      const realizedR = i === 3 ? -1.0 : i === 4 ? 0.5 : 3 - i;
      adapter.saveTradeOutcome({
        tradeId,
        result: realizedR >= 2 ? 'WIN_2R' : realizedR >= 0 ? 'WIN_2R' : 'LOSS',
        realizedR,
        maxFavorableR: realizedR > 0 ? realizedR : 0,
        maxAdverseR: realizedR < 0 ? realizedR : 0,
        exitPrice: 21000 + i * 100 + Math.round(realizedR * 100),
        exitTimestamp: now + 3600000,
        firstThresholdReached: realizedR >= 1 ? 1 : 0,
        barsHeld: 10,
      });
    }

    // Live sessions (3 total)
    for (let i = 0; i < 3; i++) {
      const sessionId = adapter.saveSession({
        date: `2024-01-${String(i + 10).padStart(2, '0')}`,
        symbol: 'SPY',
        executionMode: 'live',
        isBacktest: false,
        status: 'COMPLETED',
        zone: {
          resistance: 50000 + i * 100,
          support: 49900 + i * 100,
          status: 'VALID',
        },
        startedAt: now,
        completedAt: now + 3600000,
      });

      const tradeId = `trade-live-${i}`;
      adapter.saveTrade({
        id: tradeId,
        symbol: 'SPY',
        direction: 'SHORT',
        entryPrice: 50000 + i * 100,
        stopLevel: 50100 + i * 100,
        currentStop: 50100 + i * 100,
        rValue: 100,
        target1R: 49900 + i * 100,
        target2R: 49800 + i * 100,
        target3R: 49700 + i * 100,
        entryTimestamp: now,
        status: 'CLOSED',
      }, sessionId);

      // All live sessions are wins: +2R, +1.5R, +1R
      const realizedR = 2 - i * 0.5;
      adapter.saveTradeOutcome({
        tradeId,
        result: 'WIN_2R',
        realizedR,
        maxFavorableR: realizedR,
        maxAdverseR: 0,
        exitPrice: 50000 + i * 100 - Math.round(realizedR * 100),
        exitTimestamp: now + 3600000,
        firstThresholdReached: 1,
        barsHeld: 8,
      });
    }

    adapter.close();
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /api/summary/top-sessions
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('GET /api/summary/top-sessions?limit=10&include=both returns all sessions', async () => {
    const response = await fetch(`${serverUrl}/api/summary/top-sessions?limit=10&include=both`);

    expect(response.status).toBe(200);
    const sessions = await response.json();
    expect(Array.isArray(sessions)).toBe(true);
    expect(sessions.length).toBe(8); // 5 backtest + 3 live

    // Verify sorted by total R descending
    expect(sessions[0].totalR).toBeGreaterThanOrEqual(sessions[1].totalR);
  });

  it('GET /api/summary/top-sessions?limit=10&include=backtest returns only backtest', async () => {
    const response = await fetch(`${serverUrl}/api/summary/top-sessions?limit=10&include=backtest`);

    expect(response.status).toBe(200);
    const sessions = await response.json();
    expect(sessions.length).toBe(5);

    // Verify all are from backtest sessions (date 2024-01-01 to 2024-01-05)
    for (const session of sessions) {
      expect(session.date).toMatch(/^2024-01-0[1-5]$/);
    }
  });

  it('GET /api/summary/top-sessions?limit=10&include=live returns only live', async () => {
    const response = await fetch(`${serverUrl}/api/summary/top-sessions?limit=10&include=live`);

    expect(response.status).toBe(200);
    const sessions = await response.json();
    expect(sessions.length).toBe(3);

    // Verify all are from live sessions (SPY)
    for (const session of sessions) {
      expect(session.symbol).toBe('SPY');
    }
  });

  it('GET /api/summary/top-sessions validates limit parameter', async () => {
    const response = await fetch(`${serverUrl}/api/summary/top-sessions?limit=99`);

    expect(response.status).toBe(400);
    const error = await response.json();
    expect(error.error).toContain('Invalid limit');
  });

  it('GET /api/summary/top-sessions validates include parameter', async () => {
    const response = await fetch(`${serverUrl}/api/summary/top-sessions?limit=10&include=invalid`);

    expect(response.status).toBe(400);
    const error = await response.json();
    expect(error.error).toContain('Invalid include');
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /api/summary/by-stock
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('GET /api/summary/by-stock?include=both returns all symbols', async () => {
    const response = await fetch(`${serverUrl}/api/summary/by-stock?include=both`);

    expect(response.status).toBe(200);
    const stocks = await response.json();
    expect(Array.isArray(stocks)).toBe(true);
    expect(stocks.length).toBe(3); // AAPL, TSLA, SPY

    // Verify sorted by total R descending
    expect(stocks[0].totalR).toBeGreaterThanOrEqual(stocks[1].totalR);

    // Verify aggregations
    const aapl = stocks.find((s: any) => s.symbol === 'AAPL');
    expect(aapl).toBeDefined();
    expect(aapl.sessionCount).toBe(3); // 3 AAPL sessions
    expect(aapl.tradeCount).toBe(3); // 3 trades

    // Verify win rate calculation
    expect(aapl.winRate).toBeGreaterThanOrEqual(0);
    expect(aapl.winRate).toBeLessThanOrEqual(100);
  });

  it('GET /api/summary/by-stock?include=backtest returns only backtest symbols', async () => {
    const response = await fetch(`${serverUrl}/api/summary/by-stock?include=backtest`);

    expect(response.status).toBe(200);
    const stocks = await response.json();
    expect(stocks.length).toBe(2); // AAPL, TSLA (no SPY)

    const symbols = stocks.map((s: any) => s.symbol);
    expect(symbols).toContain('AAPL');
    expect(symbols).toContain('TSLA');
    expect(symbols).not.toContain('SPY');
  });

  it('GET /api/summary/by-stock?include=live returns only live symbols', async () => {
    const response = await fetch(`${serverUrl}/api/summary/by-stock?include=live`);

    expect(response.status).toBe(200);
    const stocks = await response.json();
    expect(stocks.length).toBe(1); // Only SPY

    expect(stocks[0].symbol).toBe('SPY');
    expect(stocks[0].sessionCount).toBe(3);
  });

  it('GET /api/summary/by-stock validates include parameter', async () => {
    const response = await fetch(`${serverUrl}/api/summary/by-stock?include=invalid`);

    expect(response.status).toBe(400);
    const error = await response.json();
    expect(error.error).toContain('Invalid include');
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Aggregation verification
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('Aggregations calculate total R correctly', async () => {
    const response = await fetch(`${serverUrl}/api/summary/by-stock?include=both`);
    const stocks = await response.json();

    // Verify total R is sum of all realized R values
    for (const stock of stocks) {
      expect(stock.totalR).toBeDefined();
      expect(typeof stock.totalR).toBe('number');
    }

    // SPY should have highest total R (all wins: +2R + +1.5R + +1R = +4.5R)
    const spy = stocks.find((s: any) => s.symbol === 'SPY');
    expect(spy.totalR).toBeCloseTo(4.5, 1);
  });

  it('Aggregations calculate avg R correctly', async () => {
    const response = await fetch(`${serverUrl}/api/summary/by-stock?include=live`);
    const stocks = await response.json();

    const spy = stocks[0];
    expect(spy.avgR).toBeCloseTo(1.5, 1); // (2 + 1.5 + 1) / 3 = 1.5
  });
});
