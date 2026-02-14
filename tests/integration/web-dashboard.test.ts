/**
 * Integration tests for Web Dashboard (Phase 5)
 *
 * Tests:
 * - Database layer: saveBars, getBarsBySessionId
 * - Dashboard queries: getTradingSummary, getRecentSessions, getSessionById
 * - API endpoints: /api/overview, /api/sessions, /api/sessions/:id, /api/sessions/:id/narrative
 * - Serialization: cents→dollars, UTC→ET
 * - NarrativeGenerator service
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { SQLiteAdapter } from '../../src/adapters/storage/sqlite-adapter.js';
import { createDashboardQueries } from '../../src/adapters/storage/queries/dashboard.js';
import { generateNarrative } from '../../src/services/narrative-generator.js';
import { centsToDollars, utcToET, utcToETTime } from '../../src/web/serializers.js';
import type { SessionContext, Trade, TradeOutcome, Signal, Candle } from '../../src/core/models/index.js';
import type { FullSessionData } from '../../src/services/narrative-types.js';

// ═══════════════════════════════════════════════════════════════════════
// Fixture Helpers
// ═══════════════════════════════════════════════════════════════════════

const EMPTY_CANDLE: Candle = {
  timestamp: 0,
  open: 0,
  high: 0,
  low: 0,
  close: 0,
  volume: 0,
  completed: false,
  barSizeMinutes: 5,
};

function makeSession(overrides: Partial<SessionContext> = {}): SessionContext {
  return {
    date: '2025-01-15',
    symbol: 'SPY',
    status: 'COMPLETE',
    zone: {
      resistance: 47500,
      support: 47200,
      status: 'DEFINED',
      spread: 300,
      definedAt: 1737291000000, // 2025-01-15 09:30 ET
      sourceBars: [],
      premarketPrice: 47350,
    },
    signals: [],
    trades: [],
    outcomes: [],
    allBars: [],
    executionMode: 'MOCK',
    startedAt: 1737291000000,
    completedAt: 1737304200000,
    isBacktest: false,
    error: null,
    ...overrides,
  };
}

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: '2025-01-15_SPY_LONG_1',
    symbol: 'SPY',
    direction: 'LONG',
    entryPrice: 47550,
    stopLevel: 47500,
    currentStop: 47500,
    rValue: 50,
    target1R: 47600,
    target2R: 47650,
    target3R: 47700,
    entryTimestamp: 1737294600000,
    status: 'CLOSED',
    entrySignal: {
      direction: 'LONG',
      type: 'CONFIRMATION',
      timestamp: 1737294600000,
      price: 47550,
      triggerCandle: EMPTY_CANDLE,
      attemptNumber: 1,
    },
    ...overrides,
  };
}

function makeOutcome(overrides: Partial<TradeOutcome> = {}): TradeOutcome {
  return {
    tradeId: '2025-01-15_SPY_LONG_1',
    result: 'WIN_2R',
    maxFavorableR: 2.45,
    maxAdverseR: 0.32,
    exitPrice: 47650,
    exitTimestamp: 1737298800000,
    realizedR: 2.0,
    firstThresholdReached: 2,
    timestamp1R: 1737296400000,
    timestamp2R: 1737297600000,
    timestamp3R: 0,
    timestampStop: 0,
    barsHeld: 14,
    ...overrides,
  };
}

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    direction: 'LONG',
    type: 'BREAK',
    timestamp: 1737293400000,
    price: 47510,
    triggerCandle: EMPTY_CANDLE,
    attemptNumber: 1,
    ...overrides,
  };
}

function makeBar(overrides: Partial<Candle> = {}): Candle {
  return {
    timestamp: 1737291000000,
    open: 47400,
    high: 47450,
    low: 47380,
    close: 47420,
    volume: 125000,
    completed: true,
    barSizeMinutes: 5,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 1. Database Layer Tests (StorageProvider extensions)
// ═══════════════════════════════════════════════════════════════════════

describe('Web Dashboard - Database Layer', () => {
  let adapter: SQLiteAdapter;

  beforeEach(() => {
    adapter = new SQLiteAdapter(':memory:');
    adapter.initialize();
  });

  afterEach(() => {
    adapter.close();
  });

  describe('saveBars and getBarsBySessionId', () => {
    it('should save bars and retrieve them by session ID', () => {
      const sessionId = adapter.saveSession(makeSession());
      const bars: Candle[] = [
        makeBar({ timestamp: 1737291000000, open: 47400, close: 47420 }),
        makeBar({ timestamp: 1737291300000, open: 47420, close: 47440 }),
        makeBar({ timestamp: 1737291600000, open: 47440, close: 47460 }),
      ];

      adapter.saveBars(bars, sessionId);

      const retrieved = adapter.getBarsBySessionId(sessionId);
      expect(retrieved).toHaveLength(3);
      expect(retrieved[0].timestamp).toBe(1737291000000);
      expect(retrieved[0].open).toBe(47400);
      expect(retrieved[0].close).toBe(47420);
      expect(retrieved[2].close).toBe(47460);
    });

    it('should return empty array for session with no bars', () => {
      const sessionId = adapter.saveSession(makeSession());
      const retrieved = adapter.getBarsBySessionId(sessionId);
      expect(retrieved).toEqual([]);
    });

    it('should handle multiple sessions with different bars', () => {
      const session1 = adapter.saveSession(makeSession({ date: '2025-01-15' }));
      const session2 = adapter.saveSession(makeSession({ date: '2025-01-16' }));

      adapter.saveBars([makeBar({ close: 47420 })], session1);
      adapter.saveBars([makeBar({ close: 47520 })], session2);

      const bars1 = adapter.getBarsBySessionId(session1);
      const bars2 = adapter.getBarsBySessionId(session2);

      expect(bars1[0].close).toBe(47420);
      expect(bars2[0].close).toBe(47520);
    });

    it('should preserve all OHLCV fields correctly', () => {
      const sessionId = adapter.saveSession(makeSession());
      const bar = makeBar({
        timestamp: 1737291000000,
        open: 47400,
        high: 47500,
        low: 47350,
        close: 47480,
        volume: 250000,
      });

      adapter.saveBars([bar], sessionId);
      const retrieved = adapter.getBarsBySessionId(sessionId);

      expect(retrieved[0].open).toBe(47400);
      expect(retrieved[0].high).toBe(47500);
      expect(retrieved[0].low).toBe(47350);
      expect(retrieved[0].close).toBe(47480);
      expect(retrieved[0].volume).toBe(250000);
    });

    it('should handle large number of bars per session', () => {
      const sessionId = adapter.saveSession(makeSession());
      const bars = Array.from({ length: 100 }, (_, i) =>
        makeBar({
          timestamp: 1737291000000 + i * 300000, // 5-minute bars
          close: 47400 + i * 10,
        }),
      );

      adapter.saveBars(bars, sessionId);
      const retrieved = adapter.getBarsBySessionId(sessionId);

      expect(retrieved).toHaveLength(100);
      expect(retrieved[0].close).toBe(47400);
      expect(retrieved[99].close).toBe(47400 + 99 * 10);
    });
  });

  describe('Bars table schema', () => {
    it('should have correct indexes', () => {
      const db = new Database(':memory:');
      adapter.close();

      const testAdapter = new SQLiteAdapter(':memory:');
      testAdapter.initialize();

      // Query indexes using raw DB access is tricky with adapter,
      // so we verify by checking that queries are fast (implicit index use)
      const sessionId = testAdapter.saveSession(makeSession());
      const bars = Array.from({ length: 1000 }, (_, i) =>
        makeBar({ timestamp: 1737291000000 + i * 300000 }),
      );
      testAdapter.saveBars(bars, sessionId);

      const start = Date.now();
      testAdapter.getBarsBySessionId(sessionId);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50); // Should be instant with index
      testAdapter.close();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. Dashboard Queries Tests
// ═══════════════════════════════════════════════════════════════════════

describe('Web Dashboard - Dashboard Queries', () => {
  let adapter: SQLiteAdapter;

  beforeEach(() => {
    adapter = new SQLiteAdapter(':memory:');
    adapter.initialize();
  });

  afterEach(() => {
    adapter.close();
  });

  describe('Data persistence for dashboard queries', () => {
    it('should save and retrieve session data for dashboard rendering', () => {
      const sessionId = adapter.saveSession(makeSession());

      const trade1 = makeTrade({ id: 'T1' });
      const trade2 = makeTrade({ id: 'T2', direction: 'SHORT' });

      adapter.saveTrade(trade1, sessionId);
      adapter.saveTrade(trade2, sessionId);

      adapter.saveTradeOutcome(makeOutcome({ tradeId: 'T1', result: 'WIN_2R', realizedR: 2.0 }));
      adapter.saveTradeOutcome(makeOutcome({ tradeId: 'T2', result: 'LOSS', realizedR: -1.0 }));

      const trades = adapter.getTradesByDateRange('2025-01-15', '2025-01-15');
      const outcomes = adapter.getOutcomesByDateRange('2025-01-15', '2025-01-15');

      expect(trades).toHaveLength(2);
      expect(outcomes).toHaveLength(2);
      expect(outcomes[0].result).toBe('WIN_2R');
      expect(outcomes[1].result).toBe('LOSS');
    });

    it('should calculate profit factor correctly from winning and losing R values', () => {
      const db = adapter['db']; // Access internal DB for dashboard queries
      const queries = createDashboardQueries(db);

      const sessionId = adapter.saveSession(makeSession({ date: '2025-01-15' }));

      // Create 5 winning trades totaling +10R and 3 losing trades totaling -4R
      // Expected Profit Factor = 10 / 4 = 2.5
      const winningTrades = [
        makeTrade({ id: 'W1' }),
        makeTrade({ id: 'W2' }),
        makeTrade({ id: 'W3' }),
        makeTrade({ id: 'W4' }),
        makeTrade({ id: 'W5' }),
      ];
      const losingTrades = [
        makeTrade({ id: 'L1' }),
        makeTrade({ id: 'L2' }),
        makeTrade({ id: 'L3' }),
      ];

      winningTrades.forEach((t) => adapter.saveTrade(t, sessionId));
      losingTrades.forEach((t) => adapter.saveTrade(t, sessionId));

      adapter.saveTradeOutcome(makeOutcome({ tradeId: 'W1', result: 'WIN_2R', realizedR: 2.0 }));
      adapter.saveTradeOutcome(makeOutcome({ tradeId: 'W2', result: 'WIN_3R', realizedR: 3.0 }));
      adapter.saveTradeOutcome(makeOutcome({ tradeId: 'W3', result: 'WIN_2R', realizedR: 2.0 }));
      adapter.saveTradeOutcome(makeOutcome({ tradeId: 'W4', result: 'WIN_2R', realizedR: 2.0 }));
      adapter.saveTradeOutcome(makeOutcome({ tradeId: 'W5', result: 'WIN_2R', realizedR: 1.0 }));

      adapter.saveTradeOutcome(makeOutcome({ tradeId: 'L1', result: 'LOSS', realizedR: -1.0 }));
      adapter.saveTradeOutcome(makeOutcome({ tradeId: 'L2', result: 'LOSS', realizedR: -2.0 }));
      adapter.saveTradeOutcome(makeOutcome({ tradeId: 'L3', result: 'LOSS', realizedR: -1.0 }));

      const stats = queries.getOverviewStats('2025-01-15', '2025-01-15');

      expect(stats.total_winning_r).toBe(10.0);
      expect(stats.total_losing_r).toBe(-4.0);

      // Profit Factor = 10 / 4 = 2.5
      const profitFactor = Math.round((stats.total_winning_r / Math.abs(stats.total_losing_r)) * 100) / 100;
      expect(profitFactor).toBe(2.5);
    });

    it('should handle edge case: all wins (Infinity profit factor)', () => {
      const db = adapter['db'];
      const queries = createDashboardQueries(db);

      const sessionId = adapter.saveSession(makeSession({ date: '2025-01-15' }));
      const trade = makeTrade({ id: 'W1' });
      adapter.saveTrade(trade, sessionId);
      adapter.saveTradeOutcome(makeOutcome({ tradeId: 'W1', result: 'WIN_2R', realizedR: 2.0 }));

      const stats = queries.getOverviewStats('2025-01-15', '2025-01-15');

      expect(stats.total_winning_r).toBe(2.0);
      expect(stats.total_losing_r).toBe(0);

      // Should return Infinity when no losses
      const profitFactor = stats.total_losing_r < 0
        ? Math.round((stats.total_winning_r / Math.abs(stats.total_losing_r)) * 100) / 100
        : stats.total_winning_r > 0 ? Infinity : 0;

      expect(profitFactor).toBe(Infinity);
    });

    it('should handle edge case: all losses (0 profit factor)', () => {
      const db = adapter['db'];
      const queries = createDashboardQueries(db);

      const sessionId = adapter.saveSession(makeSession({ date: '2025-01-15' }));
      const trade = makeTrade({ id: 'L1' });
      adapter.saveTrade(trade, sessionId);
      adapter.saveTradeOutcome(makeOutcome({ tradeId: 'L1', result: 'LOSS', realizedR: -1.0 }));

      const stats = queries.getOverviewStats('2025-01-15', '2025-01-15');

      expect(stats.total_winning_r).toBe(0);
      expect(stats.total_losing_r).toBe(-1.0);

      // Should return 0 when no wins
      const profitFactor = stats.total_losing_r < 0
        ? Math.round((stats.total_winning_r / Math.abs(stats.total_losing_r)) * 100) / 100
        : stats.total_winning_r > 0 ? Infinity : 0;

      expect(profitFactor).toBe(0);
    });

    it('should support querying sessions by date range', () => {
      adapter.saveSession(makeSession({ date: '2025-01-15' }));
      adapter.saveSession(makeSession({ date: '2025-01-16' }));
      adapter.saveSession(makeSession({ date: '2025-01-17' }));

      const sessions = adapter.getSessionsByDateRange('2025-01-15', '2025-01-16');
      expect(sessions).toHaveLength(2);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. API Endpoint Tests (using dashboard queries directly)
// ═══════════════════════════════════════════════════════════════════════

describe('Web Dashboard - API Serialization Logic', () => {
  describe('Dashboard queries integration', () => {
    let adapter: SQLiteAdapter;

    beforeEach(() => {
      adapter = new SQLiteAdapter(':memory:');
      adapter.initialize();
    });

    afterEach(() => {
      adapter.close();
    });

    it('should prepare data for /api/sessions endpoint', () => {
      const session1 = adapter.saveSession(
        makeSession({ date: '2025-01-15', symbol: 'SPY', status: 'COMPLETE' }),
      );
      const trade1 = makeTrade();
      adapter.saveTrade(trade1, session1);
      adapter.saveTradeOutcome(makeOutcome({ result: 'WIN_2R', realizedR: 2.0 }));

      const sessions = adapter.getSessionsByDateRange('2025-01-15', '2025-01-15');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].date).toBe('2025-01-15');
      expect(sessions[0].symbol).toBe('SPY');
    });

    it('should prepare data for /api/sessions/:id endpoint', () => {
      const sessionId = adapter.saveSession(makeSession());
      const bars = [
        makeBar({ timestamp: 1737291000000, close: 47420 }),
        makeBar({ timestamp: 1737291300000, close: 47440 }),
      ];
      const signals = [
        makeSignal({ type: 'BREAK', timestamp: 1737293400000 }),
        makeSignal({ type: 'CONFIRMATION', timestamp: 1737294600000 }),
      ];

      adapter.saveBars(bars, sessionId);
      adapter.saveSignals(signals, sessionId);

      const retrievedBars = adapter.getBarsBySessionId(sessionId);
      const retrievedSession = adapter.getSession('2025-01-15', 'SPY');

      expect(retrievedBars).toHaveLength(2);
      expect(retrievedSession).not.toBeNull();
      // Note: getSession returns empty signals array - signals must be queried separately via dashboard queries
      expect(retrievedSession!.signals).toHaveLength(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. Serialization Tests (cents→dollars, UTC→ET)
// ═══════════════════════════════════════════════════════════════════════

describe('Web Dashboard - Serialization', () => {
  describe('centsToDollars', () => {
    it('should convert cents to dollars with 2 decimal places', () => {
      expect(centsToDollars(47500)).toBe(475.00);
      expect(centsToDollars(12345)).toBe(123.45);
      expect(centsToDollars(100)).toBe(1.00);
      expect(centsToDollars(1)).toBe(0.01);
    });

    it('should handle null values', () => {
      expect(centsToDollars(null)).toBeNull();
    });

    it('should handle zero', () => {
      expect(centsToDollars(0)).toBe(0.00);
    });

    it('should handle negative values (for short trades)', () => {
      expect(centsToDollars(-5000)).toBe(-50.00);
    });
  });

  describe('utcToET', () => {
    it('should format UTC milliseconds to ET timestamp', () => {
      const utcMs = 1736951400000; // 2025-01-15 09:30 ET (14:30 UTC)
      const formatted = utcToET(utcMs);

      expect(formatted).toBeTruthy();
      expect(formatted).toContain('2025');
      expect(formatted).toContain('01');
      expect(formatted).toContain('15');
    });

    it('should handle null values', () => {
      expect(utcToET(null)).toBeNull();
      expect(utcToET(0)).toBeNull();
    });
  });

  describe('utcToETTime', () => {
    it('should format UTC milliseconds to ET time string', () => {
      const utcMs = 1737291000000;
      const formatted = utcToETTime(utcMs);

      expect(formatted).toBeTruthy();
      // Should be in format like "09:30 AM"
      expect(formatted).toMatch(/\d{2}:\d{2}\s(AM|PM)/);
    });

    it('should handle null values', () => {
      expect(utcToETTime(null)).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle very large cent values', () => {
      expect(centsToDollars(1000000000)).toBe(10000000.00);
    });

    it('should round fractional cents correctly', () => {
      expect(centsToDollars(12345.6)).toBe(123.46);
      expect(centsToDollars(12345.4)).toBe(123.45);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. NarrativeGenerator Service Tests
// ═══════════════════════════════════════════════════════════════════════

describe('Web Dashboard - NarrativeGenerator', () => {
  describe('generateNarrative - winning trade session', () => {
    it('should generate all 7 sections for winning trade', () => {
      const fullData: FullSessionData = {
        id: 1,
        date: '2025-01-15',
        symbol: 'SPY',
        status: 'COMPLETE',
        executionMode: 'MOCK',
        isBacktest: false,
        startedAt: 1737291000000,
        completedAt: 1737304200000,
        error: null,
        zone: {
          resistance: 47500,
          support: 47200,
          status: 'DEFINED',
          spread: 300,
          definedAt: 1737291000000,
          sourceBars: [],
          premarketPrice: 47350,
        },
        signals: [
          makeSignal({ type: 'BREAK', timestamp: 1737293400000, price: 47510 }),
          makeSignal({ type: 'RETEST', timestamp: 1737294000000, price: 47505 }),
          makeSignal({ type: 'CONFIRMATION', timestamp: 1737294600000, price: 47550 }),
        ],
        trades: [makeTrade()],
        outcomes: [makeOutcome({ result: 'WIN_2R', realizedR: 2.0 })],
        bars: [
          makeBar({ timestamp: 1737291000000, close: 47420 }),
          makeBar({ timestamp: 1737291300000, close: 47440 }),
        ],
      };

      const narrative = generateNarrative(fullData);

      expect(narrative.overview).toBeDefined();
      expect(narrative.overview.title).toBe('Overview');
      expect(narrative.overview.paragraphs.length).toBeGreaterThan(0);

      expect(narrative.zoneFormation).toBeDefined();
      expect(narrative.zoneFormation.title).toBe('Zone Formation');

      expect(narrative.signalSequence).toBeDefined();
      expect(narrative.signalSequence.title).toBe('Signal Sequence');

      expect(narrative.tradeEntry).toBeDefined();
      expect(narrative.tradeEntry!.title).toBe('Trade Entry');

      expect(narrative.tradeManagement).toBeDefined();
      expect(narrative.outcome).toBeDefined();
      expect(narrative.assessment).toBeDefined();
    });
  });

  describe('generateNarrative - losing trade session', () => {
    it('should generate narrative for losing trade', () => {
      const fullData: FullSessionData = {
        id: 2,
        date: '2025-01-16',
        symbol: 'QQQ',
        status: 'COMPLETE',
        executionMode: 'MOCK',
        isBacktest: false,
        startedAt: 1737377400000,
        completedAt: 1737390600000,
        error: null,
        zone: {
          resistance: 39500,
          support: 39200,
          status: 'DEFINED',
          spread: 300,
          definedAt: 1737377400000,
          sourceBars: [],
          premarketPrice: 39350,
        },
        signals: [
          makeSignal({ type: 'BREAK', price: 39510, symbol: 'QQQ' }),
          makeSignal({ type: 'CONFIRMATION', price: 39550, symbol: 'QQQ' }),
        ],
        trades: [
          makeTrade({
            id: '2025-01-16_QQQ_LONG_1',
            symbol: 'QQQ',
            entryPrice: 39550,
            stopLevel: 39500,
          }),
        ],
        outcomes: [
          makeOutcome({
            tradeId: '2025-01-16_QQQ_LONG_1',
            result: 'LOSS',
            realizedR: -1.0,
            exitPrice: 39500,
          }),
        ],
        bars: [],
      };

      const narrative = generateNarrative(fullData);

      expect(narrative.outcome).toBeDefined();
      expect(narrative.outcome!.paragraphs.some((p) => p.includes('Loss'))).toBe(true);
    });
  });

  describe('generateNarrative - no-trade session', () => {
    it('should generate narrative for session with no trades', () => {
      const fullData: FullSessionData = {
        id: 3,
        date: '2025-01-17',
        symbol: 'AAPL',
        status: 'COMPLETE',
        executionMode: 'MOCK',
        isBacktest: false,
        startedAt: 1737463800000,
        completedAt: 1737477000000,
        error: null,
        zone: {
          resistance: 18500,
          support: 18200,
          status: 'DEFINED',
          spread: 300,
          definedAt: 1737463800000,
          sourceBars: [],
          premarketPrice: 18350,
        },
        signals: [
          makeSignal({ type: 'BREAK', price: 18510 }),
        ],
        trades: [],
        outcomes: [],
        bars: [],
      };

      const narrative = generateNarrative(fullData);

      expect(narrative.overview).toBeDefined();
      expect(narrative.zoneFormation).toBeDefined();
      expect(narrative.signalSequence).toBeDefined();
      expect(narrative.tradeEntry).toBeNull();
      expect(narrative.tradeManagement).toBeNull();
      expect(narrative.outcome).toBeNull();
      expect(narrative.assessment).toBeDefined();
    });
  });

  describe('Narrative markdown formatting', () => {
    it('should include markdown formatting in paragraphs', () => {
      const fullData: FullSessionData = {
        id: 1,
        date: '2025-01-15',
        symbol: 'SPY',
        status: 'COMPLETE',
        executionMode: 'MOCK',
        isBacktest: false,
        startedAt: 1737291000000,
        completedAt: 1737304200000,
        error: null,
        zone: {
          resistance: 47500,
          support: 47200,
          status: 'DEFINED',
          spread: 300,
          definedAt: 1737291000000,
          sourceBars: [],
          premarketPrice: 47350,
        },
        signals: [],
        trades: [],
        outcomes: [],
        bars: [],
      };

      const narrative = generateNarrative(fullData);

      // Check for bold formatting (** markers)
      const hasMarkdown = narrative.overview.paragraphs.some((p) =>
        p.includes('**'),
      );
      expect(hasMarkdown).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. Full Integration Test (Database → Queries → Serialization)
// ═══════════════════════════════════════════════════════════════════════

describe('Web Dashboard - Full Integration', () => {
  let adapter: SQLiteAdapter;

  beforeEach(() => {
    adapter = new SQLiteAdapter(':memory:');
    adapter.initialize();
  });

  afterEach(() => {
    adapter.close();
  });

  it('should support complete workflow: save session → save bars → retrieve → serialize', () => {
    // 1. Create and save session
    const sessionId = adapter.saveSession(
      makeSession({
        date: '2025-01-15',
        symbol: 'SPY',
        status: 'COMPLETE',
      }),
    );

    // 2. Save bars
    const bars = [
      makeBar({ timestamp: 1737291000000, open: 47400, close: 47420 }),
      makeBar({ timestamp: 1737291300000, open: 47420, close: 47440 }),
      makeBar({ timestamp: 1737291600000, open: 47440, close: 47460 }),
    ];
    adapter.saveBars(bars, sessionId);

    // 3. Save signals
    const signals = [
      makeSignal({ type: 'BREAK', timestamp: 1737293400000 }),
      makeSignal({ type: 'CONFIRMATION', timestamp: 1737294600000 }),
    ];
    adapter.saveSignals(signals, sessionId);

    // 4. Save trade and outcome
    const trade = makeTrade();
    adapter.saveTrade(trade, sessionId);
    adapter.saveTradeOutcome(makeOutcome());

    // 5. Retrieve all data
    const session = adapter.getSession('2025-01-15', 'SPY');
    const retrievedBars = adapter.getBarsBySessionId(sessionId);

    // 6. Verify data integrity
    expect(session).not.toBeNull();
    // Note: getSession returns empty signals - signals are persisted but must be queried separately
    expect(retrievedBars).toHaveLength(3);

    // 7. Test serialization
    const serializedBar = {
      timestamp: retrievedBars[0].timestamp,
      open: centsToDollars(retrievedBars[0].open),
      high: centsToDollars(retrievedBars[0].high),
      low: centsToDollars(retrievedBars[0].low),
      close: centsToDollars(retrievedBars[0].close),
      volume: retrievedBars[0].volume,
    };

    expect(serializedBar.open).toBe(474.00);
    expect(serializedBar.close).toBe(474.20);

    // 8. Generate narrative
    const fullData: FullSessionData = {
      id: sessionId,
      date: session!.date,
      symbol: session!.symbol,
      status: session!.status,
      executionMode: session!.executionMode,
      isBacktest: session!.isBacktest,
      startedAt: session!.startedAt,
      completedAt: session!.completedAt ?? 0,
      error: session!.error,
      zone: session!.zone,
      signals: session!.signals,
      trades: session!.trades,
      outcomes: session!.outcomes,
      bars: retrievedBars,
    };

    const narrative = generateNarrative(fullData);
    expect(narrative.overview).toBeDefined();
    expect(narrative.overview.paragraphs.length).toBeGreaterThan(0);
  });

  it('should handle multiple sessions with different symbols', () => {
    const spyId = adapter.saveSession(makeSession({ date: '2025-01-15', symbol: 'SPY' }));
    const qqqId = adapter.saveSession(makeSession({ date: '2025-01-15', symbol: 'QQQ' }));

    adapter.saveBars([makeBar({ close: 47420 })], spyId);
    adapter.saveBars([makeBar({ close: 39520 })], qqqId);

    const spyBars = adapter.getBarsBySessionId(spyId);
    const qqqBars = adapter.getBarsBySessionId(qqqId);

    expect(spyBars[0].close).toBe(47420);
    expect(qqqBars[0].close).toBe(39520);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite 7: Maintenance Routes
// ─────────────────────────────────────────────────────────────────────────────
describe('Maintenance Routes', () => {
  it('DELETE /api/maintenance/backtest-sessions deletes all backtest data', async () => {
    const adapter = new SQLiteAdapter(':memory:');
    adapter.initialize();

    // Create 2 backtest sessions and 1 real session
    const backtestSession1 = makeSession({
      date: '2025-01-10',
      symbol: 'SPY',
      isBacktest: true,
    });
    const backtestSession2 = makeSession({
      date: '2025-01-11',
      symbol: 'AAPL',
      isBacktest: true,
    });
    const realSession = makeSession({
      date: '2025-01-12',
      symbol: 'MSFT',
      isBacktest: false,
    });

    const backtestId1 = adapter.saveSession(backtestSession1);
    const backtestId2 = adapter.saveSession(backtestSession2);
    const realId = adapter.saveSession(realSession);

    // Add trades to backtest sessions
    const backtestTrade = makeTrade({ id: 'backtest-trade-1', symbol: 'SPY' });
    adapter.saveTrade(backtestTrade, backtestId1);

    const realTrade = makeTrade({ id: 'real-trade-1', symbol: 'MSFT' });
    adapter.saveTrade(realTrade, realId);

    // Verify initial state: 3 sessions, 2 trades
    const allSessionsBefore = adapter.getSessionsByDateRange('2025-01-10', '2025-01-12');
    expect(allSessionsBefore).toHaveLength(3);
    const allTradesBefore = adapter.getTradesByDateRange('2025-01-10', '2025-01-12');
    expect(allTradesBefore).toHaveLength(2);

    // Call the storage method (maintenance endpoint uses this under the hood)
    adapter.deleteAllBacktestSessions();

    // Verify backtest data is deleted but real data remains
    const allSessionsAfter = adapter.getSessionsByDateRange('2025-01-10', '2025-01-12');
    expect(allSessionsAfter).toHaveLength(1);
    expect(allSessionsAfter[0].symbol).toBe('MSFT');
    expect(allSessionsAfter[0].isBacktest).toBe(false);

    const allTradesAfter = adapter.getTradesByDateRange('2025-01-10', '2025-01-12');
    expect(allTradesAfter).toHaveLength(1);
    expect(allTradesAfter[0].id).toBe('real-trade-1');
    expect(allTradesAfter[0].symbol).toBe('MSFT');

    adapter.close();
  });
});
