/**
 * Integration Tests: Backtest Scenarios
 *
 * Runs full backtest sessions through the strategy engine using CSV fixture files.
 * Each test loads bars from a CSV, creates a fresh SimulatedClock and BacktestAdapter,
 * runs a SessionRunner, and asserts the final SessionContext properties.
 *
 * All prices are integer cents. All timestamps are UTC milliseconds.
 * June 17, 2024 is EDT (UTC-4): 09:30 ET = 13:30 UTC = epoch ms 1718631000000.
 */

import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { SimulatedClock } from '../../src/adapters/backtest/replay-engine.js';
import { BacktestAdapter } from '../../src/adapters/backtest/backtest-adapter.js';
import { SessionRunner } from '../../src/services/session-runner.js';
import { loadBarsFromCsv } from '../../src/adapters/backtest/csv-loader.js';
import { createLogger } from '../../src/services/logger.js';
import type { StrategyConfig } from '../../src/core/models/config.js';
import type { SessionContext } from '../../src/core/models/session.js';

// ---------------------------------------------------------------------------
// Key Timestamps (June 17, 2024, EDT = UTC-4)
// ---------------------------------------------------------------------------

const TS_0930 = 1718631000000;
const TS_0935 = 1718631300000;
const TS_0940 = 1718631600000;
const TS_0945 = 1718631900000;
const TS_0950 = 1718632200000;
const TS_0955 = 1718632500000;
const TS_1000 = 1718632800000; // zone end
const TS_1005 = 1718633100000;
const TS_1010 = 1718633400000;
const TS_1015 = 1718633700000;
const TS_1020 = 1718634000000;
const TS_1025 = 1718634300000;
const TS_1030 = 1718634600000;
const TS_1035 = 1718634900000;
const TS_1040 = 1718635200000;
const TS_1045 = 1718635500000;
const TS_1050 = 1718635800000;
const TS_1055 = 1718636100000;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures/bars');
const SESSION_DATE = '2024-06-17';
const SYMBOL = 'SPY';

// ---------------------------------------------------------------------------
// Default strategy config
// ---------------------------------------------------------------------------

const defaultConfig: StrategyConfig = {
  maxBreakAttempts: 5,
  minZoneSpreadCents: 10,
  maxZoneSpreadPercent: 3.0,
  barSizeMinutes: 5,
  sessionWindows: {
    premarketTime: '09:00',
    zoneStartTime: '09:30',
    zoneEndTime: '10:00',
    executionEndTime: '12:00',
  },
  minZoneBars: 3,
  targets: {
    target1RMultiple: 1.0,
    target2RMultiple: 2.0,
    target3RMultiple: 3.0,
  },
  trailingStopAt1R: true,
};

// ---------------------------------------------------------------------------
// Helper: run a scenario from a CSV fixture file
// ---------------------------------------------------------------------------

async function runScenario(csvFileName: string): Promise<SessionContext> {
  const csvPath = path.join(FIXTURES_DIR, csvFileName);
  const { bars, errors } = loadBarsFromCsv(csvPath);

  if (errors.length > 0) {
    throw new Error(`CSV load errors in ${csvFileName}: ${JSON.stringify(errors)}`);
  }

  const clock = new SimulatedClock(0);
  const adapter = new BacktestAdapter(clock);
  adapter.loadBars(SYMBOL, bars);

  const logger = createLogger({ level: 'error' });
  const runner = new SessionRunner(adapter, clock, logger, defaultConfig);

  return runner.runSession(SESSION_DATE, SYMBOL);
}

// ===========================================================================
// Backtest Scenario Tests
// ===========================================================================

describe('Backtest Scenarios', () => {

  // -------------------------------------------------------------------------
  // 1. Long Breakout to 3R (fixture named "2r" but data reaches 3R)
  // -------------------------------------------------------------------------
  // Zone: R=50200, S=49800, spread=400
  // Break at 10:05 (H=50350 > R)
  // Retest+Confirm at 10:10 (L=50180<=R, C=50280>R)
  // Entry=50280, Stop=50200, R=80
  // 1R=50360 hit at 10:15, 2R=50440 hit at 10:20, 3R=50520 hit at 10:40
  // -------------------------------------------------------------------------

  it('spy-long-breakout-2r: produces WIN_3R outcome via long breakout', async () => {
    const result = await runScenario('spy-long-breakout-2r.csv');

    // Session metadata
    expect(result.date).toBe(SESSION_DATE);
    expect(result.symbol).toBe(SYMBOL);
    expect(result.status).toBe('COMPLETE');
    expect(result.error).toBeNull();

    // Zone definition
    expect(result.zone).not.toBeNull();
    expect(result.zone!.status).toBe('DEFINED');
    expect(result.zone!.resistance).toBe(50200);
    expect(result.zone!.support).toBe(49900);
    expect(result.zone!.spread).toBe(300);

    // Zone bars: 6 zone bars (09:30-09:55) + 1 zone-completing (10:00) = 7
    expect(result.zone!.sourceBars).toHaveLength(1);

    // Trade details
    expect(result.trades).toHaveLength(1);
    const trade = result.trades[0];
    expect(trade.direction).toBe('LONG');
    expect(trade.entryPrice).toBe(50280);
    expect(trade.stopLevel).toBe(49900);
    expect(trade.rValue).toBe(380);
    expect(trade.target1R).toBe(50660);
    expect(trade.target2R).toBe(51040);
    expect(trade.target3R).toBe(51420);
    expect(trade.entryTimestamp).toBe(TS_1010);
    expect(trade.status).toBe('TARGET_HIT');

    // Outcome
    expect(result.outcomes).toHaveLength(1);
    const outcome = result.outcomes[0];
    expect(outcome.result).toBe('WIN_3R');
    expect(outcome.exitPrice).toBe(51420); // target3R
    expect(outcome.exitTimestamp).toBe(TS_1040);
    expect(outcome.realizedR).toBe(3);
    expect(outcome.firstThresholdReached).toBe(3);
    expect(outcome.timestampStop).toBe(0); // no stop hit

    // Signals: BREAK, RETEST, CONFIRMATION at minimum
    const breakSignals = result.signals.filter(s => s.direction === 'LONG' && s.type === 'BREAK');
    const confirmSignals = result.signals.filter(s => s.direction === 'LONG' && s.type === 'CONFIRMATION');
    expect(breakSignals).toHaveLength(1);
    expect(confirmSignals).toHaveLength(1);
    expect(breakSignals[0].timestamp).toBe(TS_1005);
    expect(confirmSignals[0].timestamp).toBe(TS_1010);

    // All bars: 7 zone + 11 monitoring = 18 total
    expect(result.allBars).toHaveLength(18);
  });

  // -------------------------------------------------------------------------
  // 2. Short Breakout to 3R
  // -------------------------------------------------------------------------
  // Zone: R=50200, S=49800, spread=400 (close at support)
  // Break at 10:05 (L=49700 < S)
  // Retest+Confirm at 10:10 (H=49820>=S, C=49720<S)
  // Entry=49720, Stop=49800, R=80
  // 1R=49640 hit at 10:15, 2R=49560 hit at 10:20, 3R=49480 hit at 10:25
  // -------------------------------------------------------------------------

  it('spy-short-breakout-3r: produces WIN_3R outcome via short breakout', async () => {
    const result = await runScenario('spy-short-breakout-3r.csv');

    // Session metadata
    expect(result.date).toBe(SESSION_DATE);
    expect(result.symbol).toBe(SYMBOL);
    expect(result.status).toBe('COMPLETE');
    expect(result.error).toBeNull();

    // Zone definition
    expect(result.zone).not.toBeNull();
    expect(result.zone!.status).toBe('DEFINED');
    expect(result.zone!.resistance).toBe(50200);
    expect(result.zone!.support).toBe(49900);
    expect(result.zone!.spread).toBe(300);

    // Trade details
    expect(result.trades).toHaveLength(1);
    const trade = result.trades[0];
    expect(trade.direction).toBe('SHORT');
    expect(trade.entryPrice).toBe(49720);
    expect(trade.stopLevel).toBe(50200);
    expect(trade.rValue).toBe(480);
    expect(trade.target1R).toBe(49240);
    expect(trade.target2R).toBe(48760);
    expect(trade.target3R).toBe(48280);
    expect(trade.entryTimestamp).toBe(TS_1010);
    expect(trade.status).toBe('TARGET_HIT');

    // Outcome
    expect(result.outcomes).toHaveLength(1);
    const outcome = result.outcomes[0];
    expect(outcome.result).toBe('WIN_3R');
    expect(outcome.exitPrice).toBe(48280); // target3R
    expect(outcome.exitTimestamp).toBe(TS_1025);
    expect(outcome.realizedR).toBe(3);
    expect(outcome.firstThresholdReached).toBe(3);
    expect(outcome.timestampStop).toBe(0);

    // Signals
    const breakSignals = result.signals.filter(s => s.direction === 'SHORT' && s.type === 'BREAK');
    const confirmSignals = result.signals.filter(s => s.direction === 'SHORT' && s.type === 'CONFIRMATION');
    expect(breakSignals).toHaveLength(1);
    expect(confirmSignals).toHaveLength(1);
    expect(breakSignals[0].timestamp).toBe(TS_1005);
    expect(confirmSignals[0].timestamp).toBe(TS_1010);

    // All bars
    expect(result.allBars).toHaveLength(18);
  });

  // -------------------------------------------------------------------------
  // 3. Choppy Zone - No Trade
  // -------------------------------------------------------------------------
  // Zone: R=50200, S=49800, zone-completing bar close=50050 (between S and R)
  // Choppy -> NO_TRADE
  // -------------------------------------------------------------------------

  it('spy-choppy: produces NO_TRADE status with choppy zone', async () => {
    const result = await runScenario('spy-choppy.csv');

    // Session metadata
    expect(result.date).toBe(SESSION_DATE);
    expect(result.symbol).toBe(SYMBOL);
    expect(result.status).toBe('NO_TRADE');
    expect(result.error).toBeNull();

    // Zone should be marked as choppy
    expect(result.zone).not.toBeNull();
    expect(result.zone!.status).toBe('NO_TRADE_CHOPPY');
    expect(result.zone!.resistance).toBe(50200);
    expect(result.zone!.support).toBe(49900);
    expect(result.zone!.spread).toBe(300);

    // No trades, outcomes, or directional signals
    expect(result.trades).toHaveLength(0);
    expect(result.outcomes).toHaveLength(0);

    // Zone bars: first 7 bars (including zone-completing bar)
    expect(result.zone!.sourceBars).toHaveLength(1);

    // allBars only includes the 7 zone bars; post-zone bars are NOT sent
    // because the machine transitions to NO_TRADE (a final state)
    expect(result.allBars).toHaveLength(7);
  });

  // -------------------------------------------------------------------------
  // 4. Stop Loss
  // -------------------------------------------------------------------------
  // Zone: R=50200, S=49800
  // Break at 10:05, Retest+Confirm at 10:10
  // Entry=50280, Stop=50200, R=80
  // Bar at 10:15: C=50180 <= 50200 (stop) -> LOSS
  // -------------------------------------------------------------------------

  it('spy-stop-loss: produces LOSS outcome with stop hit before 1R', async () => {
    const result = await runScenario('spy-stop-loss.csv');

    // Session metadata
    expect(result.date).toBe(SESSION_DATE);
    expect(result.symbol).toBe(SYMBOL);
    expect(result.status).toBe('COMPLETE');
    expect(result.error).toBeNull();

    // Zone definition
    expect(result.zone).not.toBeNull();
    expect(result.zone!.status).toBe('DEFINED');
    expect(result.zone!.resistance).toBe(50200);
    expect(result.zone!.support).toBe(49900);

    // Trade details
    expect(result.trades).toHaveLength(1);
    const trade = result.trades[0];
    expect(trade.direction).toBe('LONG');
    expect(trade.entryPrice).toBe(50280);
    expect(trade.stopLevel).toBe(49900);
    expect(trade.rValue).toBe(380);
    expect(trade.status).toBe('STOPPED_OUT');

    // Outcome
    expect(result.outcomes).toHaveLength(1);
    const outcome = result.outcomes[0];
    expect(outcome.result).toBe('LOSS');
    expect(outcome.exitPrice).toBe(49900); // stopped at initial stop (support)
    expect(outcome.exitTimestamp).toBe(TS_1015);
    expect(outcome.realizedR).toBe(-1); // (49900 - 50280) / 380 = -1
    expect(outcome.timestampStop).toBe(TS_1015);
    expect(outcome.timestamp1R).toBe(0); // 1R never reached
    expect(outcome.timestamp2R).toBe(0);
    expect(outcome.timestamp3R).toBe(0);

    // Signals
    const breakSignals = result.signals.filter(s => s.direction === 'LONG' && s.type === 'BREAK');
    expect(breakSignals).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // 5. Breakeven Stop
  // -------------------------------------------------------------------------
  // Zone: R=50200, S=49800
  // Break at 10:05, Retest+Confirm at 10:10
  // Entry=50280, Stop=50200, R=80
  // 1R=50360 hit at 10:15 -> stop moves to 50280 (entry price)
  // Bar at 10:20: C=50280 <= 50280 (breakeven stop) -> BREAKEVEN_STOP
  // -------------------------------------------------------------------------

  it('spy-breakeven-stop: produces BREAKEVEN_STOP after reaching 1R', async () => {
    const result = await runScenario('spy-breakeven-stop.csv');

    // Session metadata
    expect(result.date).toBe(SESSION_DATE);
    expect(result.symbol).toBe(SYMBOL);
    expect(result.status).toBe('COMPLETE');
    expect(result.error).toBeNull();

    // Zone definition
    expect(result.zone).not.toBeNull();
    expect(result.zone!.status).toBe('DEFINED');
    expect(result.zone!.resistance).toBe(50200);
    expect(result.zone!.support).toBe(49900);

    // Trade details
    expect(result.trades).toHaveLength(1);
    const trade = result.trades[0];
    expect(trade.direction).toBe('LONG');
    expect(trade.entryPrice).toBe(50280);
    expect(trade.stopLevel).toBe(49900);
    expect(trade.rValue).toBe(380);
    expect(trade.currentStop).toBe(50280); // moved to entry after 1R
    expect(trade.status).toBe('STOPPED_OUT');

    // Outcome
    expect(result.outcomes).toHaveLength(1);
    const outcome = result.outcomes[0];
    expect(outcome.result).toBe('BREAKEVEN_STOP');
    expect(outcome.exitPrice).toBe(50280); // stopped at entry (breakeven)
    expect(outcome.exitTimestamp).toBe(TS_1020);
    expect(outcome.realizedR).toBe(0); // (50280 - 50280) / 80 = 0
    expect(outcome.timestampStop).toBe(TS_1020);
    expect(outcome.timestamp1R).toBe(TS_1015); // 1R was reached
    expect(outcome.timestamp2R).toBe(0); // 2R never reached
    expect(outcome.timestamp3R).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 6. Session Timeout
  // -------------------------------------------------------------------------
  // Zone: R=50200, S=49800
  // Break at 10:05, Retest+Confirm at 10:10
  // Entry=50280, Stop=50200, R=80
  // Price drifts 50280-50310 without hitting 1R (50360) or stop (50200)
  // SESSION_END fires -> SESSION_TIMEOUT
  // -------------------------------------------------------------------------

  it('spy-session-timeout: produces SESSION_TIMEOUT for unresolved position', async () => {
    const result = await runScenario('spy-session-timeout.csv');

    // Session metadata
    expect(result.date).toBe(SESSION_DATE);
    expect(result.symbol).toBe(SYMBOL);
    expect(result.status).toBe('COMPLETE');
    expect(result.error).toBeNull();

    // Zone definition
    expect(result.zone).not.toBeNull();
    expect(result.zone!.status).toBe('DEFINED');
    expect(result.zone!.resistance).toBe(50200);
    expect(result.zone!.support).toBe(49900);

    // Trade details
    expect(result.trades).toHaveLength(1);
    const trade = result.trades[0];
    expect(trade.direction).toBe('LONG');
    expect(trade.entryPrice).toBe(50280);
    expect(trade.stopLevel).toBe(49900);
    expect(trade.rValue).toBe(380);
    expect(trade.status).toBe('SESSION_EXPIRED');

    // Outcome
    expect(result.outcomes).toHaveLength(1);
    const outcome = result.outcomes[0];
    expect(outcome.result).toBe('SESSION_TIMEOUT');
    // Exit price is the last bar's close
    expect(outcome.exitPrice).toBe(50300); // last bar close = 503.00
    expect(outcome.exitTimestamp).toBe(TS_1055); // last bar timestamp
    expect(outcome.timestampStop).toBe(0); // no stop hit
    expect(outcome.timestamp1R).toBe(0); // never reached 1R
    expect(outcome.timestamp2R).toBe(0);
    expect(outcome.timestamp3R).toBe(0);

    // All 18 bars processed
    expect(result.allBars).toHaveLength(18);
  });

  // -------------------------------------------------------------------------
  // 7. Single-Bar Retest+Confirm
  // -------------------------------------------------------------------------
  // Zone: R=50200, S=49800
  // Break at 10:05 (H=50300 > R)
  // Retest+Confirm at 10:10 in ONE bar (L=50190<=R, C=50260>R)
  // Entry=50260, Stop=50200, R=60
  // 1R=50320 hit at 10:15, 2R=50380 hit at 10:25, 3R=50440 hit at 10:40
  // -------------------------------------------------------------------------

  it('spy-single-bar-retest-confirm: enters via single-bar retest+confirm', async () => {
    const result = await runScenario('spy-single-bar-retest-confirm.csv');

    // Session metadata
    expect(result.date).toBe(SESSION_DATE);
    expect(result.symbol).toBe(SYMBOL);
    expect(result.status).toBe('COMPLETE');
    expect(result.error).toBeNull();

    // Zone definition
    expect(result.zone).not.toBeNull();
    expect(result.zone!.status).toBe('DEFINED');
    expect(result.zone!.resistance).toBe(50200);
    expect(result.zone!.support).toBe(49900);

    // Trade details
    expect(result.trades).toHaveLength(1);
    const trade = result.trades[0];
    expect(trade.direction).toBe('LONG');
    expect(trade.entryPrice).toBe(50260);
    expect(trade.stopLevel).toBe(49900);
    expect(trade.rValue).toBe(360);
    expect(trade.target1R).toBe(50620);
    expect(trade.target2R).toBe(50980);
    expect(trade.target3R).toBe(51340);
    expect(trade.entryTimestamp).toBe(TS_1010);
    expect(trade.status).toBe('TARGET_HIT');

    // Signals: BREAK at 10:05, then RETEST + CONFIRMATION at 10:10
    const breakSignals = result.signals.filter(s => s.direction === 'LONG' && s.type === 'BREAK');
    const retestSignals = result.signals.filter(s => s.direction === 'LONG' && s.type === 'RETEST');
    const confirmSignals = result.signals.filter(s => s.direction === 'LONG' && s.type === 'CONFIRMATION');
    expect(breakSignals).toHaveLength(1);
    expect(retestSignals).toHaveLength(1);
    expect(confirmSignals).toHaveLength(1);
    expect(breakSignals[0].timestamp).toBe(TS_1005);
    // Both retest and confirm occur on the same bar (single-bar shortcut)
    expect(retestSignals[0].timestamp).toBe(TS_1010);
    expect(confirmSignals[0].timestamp).toBe(TS_1010);

    // Outcome: WIN_3R
    expect(result.outcomes).toHaveLength(1);
    const outcome = result.outcomes[0];
    expect(outcome.result).toBe('WIN_3R');
    expect(outcome.exitPrice).toBe(51340); // target3R
    expect(outcome.realizedR).toBe(3);
  });

  // -------------------------------------------------------------------------
  // 8. Multiple Break Attempts
  // -------------------------------------------------------------------------
  // Zone: R=50200, S=49800
  // Break #1 at 10:05 (H=50280 > R=50200), Failure at 10:10 (C=50150 <= R)
  // Break #2 at 10:15, Failure at 10:20
  // Break #3 at 10:25, Failure at 10:30
  // Break #4 at 10:35, Retest+Confirm at 10:40 (L=50180<=R, C=50260>R)
  // Entry=50260, Stop=50200, R=60
  // 1R=50320 hit at 10:50, then SESSION_TIMEOUT
  // -------------------------------------------------------------------------

  it('spy-multi-break-attempts: enters after 3 failed break attempts', async () => {
    const result = await runScenario('spy-multi-break-attempts.csv');

    // Session metadata
    expect(result.date).toBe(SESSION_DATE);
    expect(result.symbol).toBe(SYMBOL);
    expect(result.status).toBe('COMPLETE');
    expect(result.error).toBeNull();

    // Zone definition
    expect(result.zone).not.toBeNull();
    expect(result.zone!.status).toBe('DEFINED');
    expect(result.zone!.resistance).toBe(50200);
    expect(result.zone!.support).toBe(49900);

    // BREAK_FAILURE signals: 3 failed attempts
    const breakSignals = result.signals.filter(
      s => s.direction === 'LONG' && s.type === 'BREAK',
    );
    const failureSignals = result.signals.filter(
      s => s.direction === 'LONG' && s.type === 'BREAK_FAILURE',
    );
    expect(failureSignals).toHaveLength(3);
    expect(breakSignals.length).toBeGreaterThanOrEqual(4); // 3 failed + 1 successful

    // Trade on 4th attempt
    expect(result.trades).toHaveLength(1);
    const trade = result.trades[0];
    expect(trade.direction).toBe('LONG');
    expect(trade.entryPrice).toBe(50260);
    expect(trade.stopLevel).toBe(49900);
    expect(trade.rValue).toBe(360);
    expect(trade.entryTimestamp).toBe(TS_1040);

    // Outcome: SESSION_TIMEOUT (position open at session end)
    expect(result.outcomes).toHaveLength(1);
    const outcome = result.outcomes[0];
    expect(outcome.result).toBe('SESSION_TIMEOUT');
    expect(outcome.exitPrice).toBe(50350); // last bar close = 503.50

    // All 18 bars processed
    expect(result.allBars).toHaveLength(18);
  });
});

// ===========================================================================
// Cross-cutting integration verifications
// ===========================================================================

describe('Backtest Scenarios - Cross-cutting Concerns', () => {

  it('all scenarios produce valid SessionContext structure', async () => {
    const fixtures = [
      'spy-long-breakout-2r.csv',
      'spy-short-breakout-3r.csv',
      'spy-choppy.csv',
      'spy-stop-loss.csv',
      'spy-breakeven-stop.csv',
      'spy-session-timeout.csv',
      'spy-single-bar-retest-confirm.csv',
      'spy-multi-break-attempts.csv',
    ];

    for (const fixture of fixtures) {
      const result = await runScenario(fixture);

      // Common structural assertions for every scenario
      expect(result.date).toBe(SESSION_DATE);
      expect(result.symbol).toBe(SYMBOL);
      expect(result.zone).not.toBeNull();
      expect(result.allBars.length).toBeGreaterThan(0);
      expect(result.error).toBeNull();
      expect(['WAITING', 'BUILDING_ZONE', 'MONITORING', 'NO_TRADE', 'COMPLETE', 'INTERRUPTED', 'ERROR'])
        .toContain(result.status);

      // Every trade should have a valid R-value
      for (const trade of result.trades) {
        expect(trade.rValue).toBeGreaterThan(0);
        expect(trade.entryPrice).toBeGreaterThan(0);
        expect(trade.stopLevel).toBeGreaterThan(0);
        expect(['OPEN', 'STOPPED_OUT', 'TARGET_HIT', 'SESSION_EXPIRED']).toContain(trade.status);
      }

      // Every outcome should have a valid result
      for (const outcome of result.outcomes) {
        expect(['LOSS', 'BREAKEVEN_STOP', 'WIN_2R', 'WIN_3R', 'SESSION_TIMEOUT'])
          .toContain(outcome.result);
        expect(outcome.exitPrice).toBeGreaterThan(0);
        expect(outcome.barsHeld).toBeGreaterThanOrEqual(0);
      }

      // Outcomes count should match non-OPEN trades count
      const closedTrades = result.trades.filter(t => t.status !== 'OPEN');
      expect(result.outcomes).toHaveLength(closedTrades.length);
    }
  });

  it('bar timestamps are within the session window', async () => {
    const result = await runScenario('spy-long-breakout-2r.csv');

    // All bars should be within [09:30, 11:00) ET
    for (const bar of result.allBars) {
      expect(bar.timestamp).toBeGreaterThanOrEqual(TS_0930);
      expect(bar.timestamp).toBeLessThan(TS_1055 + 300000); // 11:00 ET
    }

    // All bars should be completed
    for (const bar of result.allBars) {
      expect(bar.completed).toBe(true);
    }
  });

  it('prices are converted from dollars to integer cents', async () => {
    const result = await runScenario('spy-long-breakout-2r.csv');

    // Verify first bar prices match CSV values converted to cents
    // CSV: 500.00, 502.00, 499.00, 501.00
    const firstBar = result.allBars[0];
    expect(firstBar.open).toBe(50000);
    expect(firstBar.high).toBe(50200);
    expect(firstBar.low).toBe(49900);
    expect(firstBar.close).toBe(50100);
  });

  it('signals are recorded in chronological order', async () => {
    const result = await runScenario('spy-multi-break-attempts.csv');

    // Signals should be in timestamp order (or at least non-decreasing)
    for (let i = 1; i < result.signals.length; i++) {
      expect(result.signals[i].timestamp).toBeGreaterThanOrEqual(
        result.signals[i - 1].timestamp,
      );
    }
  });
});
