/**
 * Integration Tests: Full Session with Storage
 *
 * Runs complete sessions (market data -> strategy -> storage) using
 * BacktestAdapter + SimulatedClock. All prices are integer cents,
 * all timestamps are UTC milliseconds.
 *
 * June 17, 2024 is EDT (UTC-4):
 *   09:30 ET = 13:30 UTC = epoch ms 1718631000000
 *   10:00 ET = 14:00 UTC = epoch ms 1718632800000
 *   11:00 ET = 15:00 UTC = epoch ms 1718636400000
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { SessionRunner } from '../../src/services/session-runner.js';
import { BacktestAdapter } from '../../src/adapters/backtest/backtest-adapter.js';
import { SimulatedClock } from '../../src/adapters/backtest/replay-engine.js';
import { createLogger } from '../../src/services/logger.js';
import type { StrategyConfig } from '../../src/core/models/config.js';
import type { Candle } from '../../src/core/models/candle.js';
import type { SessionContext } from '../../src/core/models/session.js';

// ---------------------------------------------------------------------------
// Constants: June 17, 2024 EDT (UTC-4) timestamps in UTC milliseconds
// ---------------------------------------------------------------------------

const TS_0930 = 1718631000000; // 09:30 ET
const TS_0935 = 1718631300000; // 09:35 ET
const TS_0940 = 1718631600000; // 09:40 ET
const TS_0945 = 1718631900000; // 09:45 ET
const TS_0950 = 1718632200000; // 09:50 ET
const TS_0955 = 1718632500000; // 09:55 ET
const TS_1000 = 1718632800000; // 10:00 ET (zone end)
const TS_1005 = 1718633100000; // 10:05 ET
const TS_1010 = 1718633400000; // 10:10 ET
const TS_1015 = 1718633700000; // 10:15 ET
const TS_1020 = 1718634000000; // 10:20 ET
const TS_1025 = 1718634300000; // 10:25 ET
const TS_1030 = 1718634600000; // 10:30 ET
const TS_1035 = 1718634900000; // 10:35 ET
const TS_1040 = 1718635200000; // 10:40 ET
const TS_1045 = 1718635500000; // 10:45 ET
const TS_1050 = 1718635800000; // 10:50 ET
const TS_1055 = 1718636100000; // 10:55 ET

const DATE = '2024-06-17';
const SYMBOL = 'SPY';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a completed 5-min candle. All prices in integer cents. */
function makeBar(
  timestamp: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume = 100000,
): Candle {
  return { timestamp, open, high, low, close, volume, completed: true, barSizeMinutes: 5 };
}

/**
 * Standard zone bars: First bar (09:30) defines zone, remaining bars for price action.
 * Zone (from first bar only): R=50200, S=49900, spread=300 cents.
 * Last bar (10:00) closes at resistance (50200) so the zone is NOT choppy.
 */
function makeStandardZoneBars(): Candle[] {
  return [
    makeBar(TS_0930, 50000, 50200, 49900, 50100),
    makeBar(TS_0935, 50100, 50200, 49850, 49950),
    makeBar(TS_0940, 49950, 50150, 49800, 50050),
    makeBar(TS_0945, 50050, 50180, 49850, 49900),
    makeBar(TS_0950, 49900, 50150, 49800, 50000),
    makeBar(TS_0955, 50000, 50200, 49850, 50200),
    // Zone-completing bar at 10:00 ET -- close at resistance to avoid choppy
    makeBar(TS_1000, 50200, 50200, 50000, 50200),
  ];
}

/**
 * Zone bars where the 10:00 close is strictly between S and R (choppy).
 * Zone (from first bar only): R=50200, S=49900, spread=300 cents.
 * Last bar closes at 50000 (between S=49900 and R=50200).
 */
function makeChoppyZoneBars(): Candle[] {
  return [
    makeBar(TS_0930, 50000, 50200, 49900, 50100),
    makeBar(TS_0935, 50100, 50200, 49850, 49950),
    makeBar(TS_0940, 49950, 50150, 49800, 50050),
    makeBar(TS_0945, 50050, 50180, 49850, 49900),
    makeBar(TS_0950, 49900, 50150, 49800, 50000),
    makeBar(TS_0955, 50000, 50200, 49850, 50100),
    // Zone-completing bar: close at 50000, strictly between S=49800 and R=50200
    makeBar(TS_1000, 50000, 50100, 49900, 50000),
  ];
}

/** Default strategy config for tests. */
function makeConfig(): StrategyConfig {
  return {
    maxBreakAttempts: 5,
    minZoneSpreadCents: 10,
    maxZoneSpreadPercent: 3.0,
    barSizeMinutes: 5,
    sessionWindows: {
      premarketTime: '09:00',
      zoneStartTime: '09:30',
      zoneEndTime: '10:00',
      executionEndTime: '11:00',
    },
    minZoneBars: 3,
    targets: {
      target1RMultiple: 1,
      target2RMultiple: 2,
      target3RMultiple: 3,
    },
    trailingStopAt1R: true,
  };
}

/** Silent logger for tests (suppress output). */
function makeSilentLogger() {
  return createLogger({ level: 'silent' });
}

/**
 * Build the test infrastructure: SimulatedClock, BacktestAdapter, SessionRunner.
 * Optionally load bars into the adapter.
 */
function createTestSession(bars?: Candle[]) {
  const clock = new SimulatedClock(TS_0930);
  const adapter = new BacktestAdapter(clock);

  if (bars && bars.length > 0) {
    adapter.loadBars(SYMBOL, bars);
  }

  // Connect the adapter (synchronous for backtest)
  adapter.connect();

  const logger = makeSilentLogger();
  const config = makeConfig();
  const runner = new SessionRunner(adapter, clock, logger, config);

  return { clock, adapter, runner, config };
}

// ===========================================================================
// Suite 1: Session Execution (no storage)
// ===========================================================================

describe('Full Session Integration', () => {

  // -------------------------------------------------------------------------
  // Test 1: Complete long breakout session to 3R
  // -------------------------------------------------------------------------
  it('runs a complete long breakout session to WIN_3R', async () => {
    // Zone (first bar only): R=50200, S=49900, spread=300
    // After zone:
    //   10:05 - Break: high=50300 > R(50200)
    //   10:10 - Retest+Confirm: low=50180 <= R, close=50350 > R
    //           Entry=50350, stop=49900, rValue=450
    //           target1R=50800, target2R=51250, target3R=51700
    //   10:15 - 1R hit: high >= 50800, trailing stop moves to entry
    //   10:20 - 2R hit: high >= 51250
    //   10:25 - 3R hit: high >= 51700 -> WIN_3R

    const zoneBars = makeStandardZoneBars();
    const executionBars: Candle[] = [
      // Break above resistance
      makeBar(TS_1005, 50200, 50300, 50150, 50250),
      // Retest+Confirm: dips to R then closes above
      makeBar(TS_1010, 50250, 50400, 50180, 50350),
      // 1R hit
      makeBar(TS_1015, 50350, 50850, 50300, 50750),
      // 2R hit
      makeBar(TS_1020, 50750, 51300, 50700, 51200),
      // 3R hit
      makeBar(TS_1025, 51200, 51750, 51150, 51700),
    ];
    const allBars = [...zoneBars, ...executionBars];

    const { runner } = createTestSession(allBars);
    const result = await runner.runSession(DATE, SYMBOL);

    // Session reached COMPLETE because the actor resolved (3R hit -> final state)
    expect(result.status).toBe('COMPLETE');
    expect(result.date).toBe(DATE);
    expect(result.symbol).toBe(SYMBOL);

    // Zone was properly computed
    expect(result.zone).not.toBeNull();
    expect(result.zone!.resistance).toBe(50200);
    expect(result.zone!.support).toBe(49900);
    expect(result.zone!.spread).toBe(300);
    expect(result.zone!.status).toBe('DEFINED');

    // One trade was taken
    expect(result.trades).toHaveLength(1);
    const trade = result.trades[0];
    expect(trade.direction).toBe('LONG');
    expect(trade.entryPrice).toBe(50350);
    expect(trade.stopLevel).toBe(49900);
    expect(trade.rValue).toBe(450);
    expect(trade.target1R).toBe(50800);
    expect(trade.target2R).toBe(51250);
    expect(trade.target3R).toBe(51700);
    expect(trade.status).toBe('TARGET_HIT');

    // One outcome: WIN_3R
    expect(result.outcomes).toHaveLength(1);
    const outcome = result.outcomes[0];
    expect(outcome.result).toBe('WIN_3R');
    expect(outcome.tradeId).toBe(trade.id);
    expect(outcome.exitPrice).toBe(51700); // target3R
    expect(outcome.realizedR).toBe(3);
    expect(outcome.firstThresholdReached).toBe(3);
    expect(outcome.timestamp3R).toBeGreaterThan(0);

    // Signals: BREAK, RETEST, CONFIRMATION
    expect(result.signals.length).toBeGreaterThanOrEqual(3);
    const signalTypes = result.signals.map(s => s.type);
    expect(signalTypes).toContain('BREAK');
    expect(signalTypes).toContain('RETEST');
    expect(signalTypes).toContain('CONFIRMATION');

    // allBars should contain all bars fed to the actor
    expect(result.allBars.length).toBeGreaterThanOrEqual(zoneBars.length);
  });

  // -------------------------------------------------------------------------
  // Test 2: Long breakout that gets stopped out (LOSS)
  // -------------------------------------------------------------------------
  it('runs a session where long position gets stopped out for LOSS', async () => {
    // Zone: R=50200, S=49900, spread=300
    // After zone:
    //   10:05 - Break: high=50300 > R(50200)
    //   10:10 - Retest+Confirm: low=50180 <= R, close=50350 > R
    //           Entry=50350, stop=49900, rValue=450
    //   10:15 - Stop hit: close=49850 <= stop(49900) -> LOSS

    const zoneBars = makeStandardZoneBars();
    const executionBars: Candle[] = [
      makeBar(TS_1005, 50200, 50300, 50150, 50250),
      makeBar(TS_1010, 50250, 50400, 50180, 50350),
      // Price drops to stop
      makeBar(TS_1015, 50300, 50320, 49800, 49850),
    ];
    const allBars = [...zoneBars, ...executionBars];

    const { runner } = createTestSession(allBars);
    const result = await runner.runSession(DATE, SYMBOL);

    expect(result.status).toBe('COMPLETE');
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].status).toBe('STOPPED_OUT');

    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0].result).toBe('LOSS');
    expect(result.outcomes[0].realizedR).toBeLessThan(0);
  });

  // -------------------------------------------------------------------------
  // Test 3: Choppy zone results in NO_TRADE
  // -------------------------------------------------------------------------
  it('runs a choppy session with no trade', async () => {
    // Zone bars where 10:00 close (50000) is strictly between S(49800) and R(50200)
    const bars = makeChoppyZoneBars();

    const { runner } = createTestSession(bars);
    const result = await runner.runSession(DATE, SYMBOL);

    expect(result.status).toBe('NO_TRADE');
    expect(result.trades).toHaveLength(0);
    expect(result.outcomes).toHaveLength(0);

    // Zone should be marked choppy
    expect(result.zone).not.toBeNull();
    expect(result.zone!.status).toBe('NO_TRADE_CHOPPY');
  });

  // -------------------------------------------------------------------------
  // Test 4: Session timeout with open position
  // -------------------------------------------------------------------------
  it('runs a session that times out with an open position', async () => {
    // Zone: R=50200, S=49800
    // Entry happens but price just drifts sideways -- no R targets or stop hit.
    // All bars end before session end. SESSION_END is sent, triggering timeout.

    const zoneBars = makeStandardZoneBars();
    const executionBars: Candle[] = [
      // Break above resistance
      makeBar(TS_1005, 50200, 50300, 50150, 50250),
      // Retest+Confirm: single bar
      makeBar(TS_1010, 50250, 50380, 50180, 50350),
      // Price drifts sideways -- no 1R (50500) or stop (50200) hit
      makeBar(TS_1015, 50350, 50400, 50250, 50300),
      makeBar(TS_1020, 50300, 50380, 50220, 50350),
      makeBar(TS_1025, 50350, 50420, 50280, 50380),
      makeBar(TS_1030, 50380, 50450, 50300, 50400),
      makeBar(TS_1035, 50400, 50430, 50250, 50300),
      makeBar(TS_1040, 50300, 50380, 50220, 50350),
      makeBar(TS_1045, 50350, 50400, 50260, 50320),
      makeBar(TS_1050, 50320, 50380, 50240, 50300),
      makeBar(TS_1055, 50300, 50350, 50230, 50280),
    ];
    const allBars = [...zoneBars, ...executionBars];

    const { runner } = createTestSession(allBars);
    const result = await runner.runSession(DATE, SYMBOL);

    // SessionRunner sends SESSION_END after all bars processed,
    // which triggers recordSessionTimeout in the machine.
    expect(result.status).toBe('COMPLETE');
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].status).toBe('SESSION_EXPIRED');

    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0].result).toBe('SESSION_TIMEOUT');
    expect(result.outcomes[0].exitTimestamp).toBeGreaterThan(0);
    expect(result.outcomes[0].barsHeld).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Test 5: Empty bar stream
  // -------------------------------------------------------------------------
  it('handles empty bar stream gracefully', async () => {
    // No bars loaded into the adapter
    const { runner } = createTestSession([]);

    const result = await runner.runSession(DATE, SYMBOL);

    // Session should end. With no bars at all, the actor stays in BUILDING_ZONE.
    // SESSION_END is sent but BUILDING_ZONE does not handle SESSION_END,
    // so the actor remains in BUILDING_ZONE. The runner maps that to BUILDING_ZONE status.
    expect(result.date).toBe(DATE);
    expect(result.symbol).toBe(SYMBOL);
    expect(result.trades).toHaveLength(0);
    expect(result.outcomes).toHaveLength(0);
    expect(result.allBars).toHaveLength(0);
    expect(result.error).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Test 6: Session stop() produces INTERRUPTED status
  // -------------------------------------------------------------------------
  it('session runner stop() produces INTERRUPTED status', async () => {
    // Use a full set of bars so the session has work to do, but stop it early.
    // Because backtest replay is synchronous, all bars process before the await.
    // We need to call stop() to trigger the INTERRUPTED status.

    const zoneBars = makeStandardZoneBars();
    const executionBars: Candle[] = [
      makeBar(TS_1005, 50200, 50300, 50150, 50250),
      makeBar(TS_1010, 50250, 50380, 50180, 50350),
      makeBar(TS_1015, 50350, 50400, 50250, 50300),
    ];
    const allBars = [...zoneBars, ...executionBars];

    const { runner } = createTestSession(allBars);

    // Call stop() before runSession resolves.
    // Since backtest replay is synchronous, we need to call stop() concurrently.
    const sessionPromise = runner.runSession(DATE, SYMBOL);

    // stop() can be called anytime -- it sets `stopped = true` and resolves
    // the actorDone promise. Since the replay already completed synchronously,
    // the runner is currently awaiting Promise.race. Calling stop() triggers
    // the INTERRUPTED mapping in buildSessionContext.
    runner.stop();

    const result = await sessionPromise;

    expect(result.status).toBe('INTERRUPTED');
    expect(result.date).toBe(DATE);
    expect(result.symbol).toBe(SYMBOL);
  });

  // -------------------------------------------------------------------------
  // Test 7: Short breakout to 3R
  // -------------------------------------------------------------------------
  it('runs a complete short breakout session to WIN_3R', async () => {
    // Zone: R=50200, S=49900, spread=300 (first bar defines zone)
    // Zone bars: 10:00 bar closes below support (49850 < 49900) so NOT choppy
    const zoneBars = [
      makeBar(TS_0930, 50000, 50200, 49900, 50100),
      makeBar(TS_0935, 50100, 50200, 49850, 49950),
      makeBar(TS_0940, 49950, 50150, 49800, 50050),
      makeBar(TS_0945, 50050, 50180, 49850, 49900),
      makeBar(TS_0950, 49900, 50150, 49800, 50000),
      makeBar(TS_0955, 50000, 50200, 49850, 49850),
      // Zone-completing bar: close below support (49850 < 49900) -> NOT choppy
      makeBar(TS_1000, 49900, 50000, 49800, 49850),
    ];

    // Short break -> retest+confirm -> 3R
    // Break: bar.low < S (49900)
    // Retest+Confirm: bar.high >= S AND bar.close < S
    // Entry=close, stop=R(50200), rValue = stop - entry
    // For entry at 49720: stop=50200, rValue=480
    //   target1R=49240, target2R=48760, target3R=48280
    const executionBars: Candle[] = [
      // Break below support: low=49700 < S(49900)
      makeBar(TS_1005, 49850, 49900, 49700, 49750),
      // Retest+Confirm: high=49920 >= S(49900), close=49720 < S(49900)
      makeBar(TS_1010, 49750, 49920, 49650, 49720),
      // 1R hit: close=49200 <= target1R(49240)
      makeBar(TS_1015, 49720, 49750, 49150, 49200),
      // 2R hit: close=48700 <= target2R(48760)
      makeBar(TS_1020, 49200, 49250, 48650, 48700),
      // 3R hit: close=48250 <= target3R(48280)
      makeBar(TS_1025, 48700, 48750, 48200, 48250),
    ];
    const allBars = [...zoneBars, ...executionBars];

    const { runner } = createTestSession(allBars);
    const result = await runner.runSession(DATE, SYMBOL);

    expect(result.status).toBe('COMPLETE');

    expect(result.trades).toHaveLength(1);
    const trade = result.trades[0];
    expect(trade.direction).toBe('SHORT');
    expect(trade.entryPrice).toBe(49720);
    expect(trade.stopLevel).toBe(50200);
    expect(trade.rValue).toBe(480);
    expect(trade.status).toBe('TARGET_HIT');

    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0].result).toBe('WIN_3R');
    expect(result.outcomes[0].realizedR).toBe(3);
  });

  // -------------------------------------------------------------------------
  // Test 8: Degenerate zone (spread too narrow)
  // -------------------------------------------------------------------------
  it('marks a degenerate zone as NO_TRADE when spread is too narrow', async () => {
    // Zone with very narrow spread: R-S < minZoneSpreadCents (10)
    // R=50005, S=50000, spread=5 < 10
    const zoneBars = [
      makeBar(TS_0930, 50000, 50005, 50000, 50002),
      makeBar(TS_0935, 50002, 50005, 50000, 50003),
      makeBar(TS_0940, 50003, 50005, 50000, 50001),
      makeBar(TS_0945, 50001, 50005, 50000, 50004),
      makeBar(TS_0950, 50004, 50005, 50000, 50002),
      makeBar(TS_0955, 50002, 50005, 50000, 50003),
      // Close at resistance to avoid choppy check triggering first
      makeBar(TS_1000, 50003, 50005, 50000, 50005),
    ];

    const { runner } = createTestSession(zoneBars);
    const result = await runner.runSession(DATE, SYMBOL);

    expect(result.status).toBe('NO_TRADE');
    expect(result.zone).not.toBeNull();
    expect(result.zone!.status).toBe('NO_TRADE_DEGENERATE');
    expect(result.zone!.spread).toBe(5);
    expect(result.trades).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Test 9: Break failure then successful entry
  // -------------------------------------------------------------------------
  it('handles break failure followed by a successful entry', async () => {
    // Zone: R=50200, S=49900, spread=300
    // 10:05 - Break above R: high=50300 > R
    // 10:10 - Break failure: close=50100 <= R (fails back)
    // 10:15 - Second break: high=50350 > R
    // 10:20 - Retest+Confirm: low=50180 <= R, close=50400 > R
    //         Entry=50400, stop=S=49900, rValue=500
    //         target1R=50900, target2R=51400, target3R=51900
    // 10:25 - 3R: close=51950 >= 51900

    const zoneBars = makeStandardZoneBars();
    const executionBars: Candle[] = [
      // First break
      makeBar(TS_1005, 50200, 50300, 50150, 50250),
      // Break failure: close <= R
      makeBar(TS_1010, 50250, 50280, 50050, 50100),
      // Second break
      makeBar(TS_1015, 50100, 50350, 50050, 50300),
      // Retest+Confirm
      makeBar(TS_1020, 50300, 50450, 50180, 50400),
      // Jump to 3R (target3R = 50400 + 1500 = 51900)
      makeBar(TS_1025, 50400, 52000, 50350, 51950),
    ];
    const allBars = [...zoneBars, ...executionBars];

    const { runner } = createTestSession(allBars);
    const result = await runner.runSession(DATE, SYMBOL);

    expect(result.status).toBe('COMPLETE');
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].direction).toBe('LONG');
    expect(result.trades[0].entryPrice).toBe(50400);
    expect(result.trades[0].rValue).toBe(500);

    // Should have BREAK, BREAK_FAILURE, BREAK (2nd), RETEST, CONFIRMATION signals
    const signalTypes = result.signals.map(s => s.type);
    expect(signalTypes.filter(t => t === 'BREAK')).toHaveLength(2);
    expect(signalTypes).toContain('BREAK_FAILURE');
    expect(signalTypes).toContain('RETEST');
    expect(signalTypes).toContain('CONFIRMATION');

    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0].result).toBe('WIN_3R');
  });

  // -------------------------------------------------------------------------
  // Test 10: Session context metadata
  // -------------------------------------------------------------------------
  it('populates session context with correct metadata', async () => {
    const zoneBars = makeStandardZoneBars();
    const { runner } = createTestSession(zoneBars);
    const result = await runner.runSession(DATE, SYMBOL);

    // Basic metadata
    expect(result.date).toBe(DATE);
    expect(result.symbol).toBe(SYMBOL);
    expect(result.startedAt).toBeGreaterThan(0);
    expect(result.completedAt).toBeGreaterThanOrEqual(result.startedAt);
    expect(result.error).toBeNull();

    // Since no post-zone bars trigger a break, the session should end in MONITORING
    // after SESSION_END is sent (but MONITORING does not transition to a final state
    // on its own for the short track). Actually, SESSION_END goes to COMPLETE.
    // With no trades open, recordSessionTimeout is a no-op, and the machine goes COMPLETE.
    expect(result.status).toBe('COMPLETE');
  });

  // -------------------------------------------------------------------------
  // Test 11: Breakeven stop (1R reached, then stop hit at entry)
  // -------------------------------------------------------------------------
  it('records BREAKEVEN_STOP when stopped at entry after reaching 1R', async () => {
    // Zone: R=50200, S=49900, spread=300
    // Entry: confirm at 50350, stop=49900, rValue=450
    // target1R=50800
    // 10:15: 1R hit -> stop moves to entryPrice (50350)
    // 10:20: close <= 50350 (currentStop) -> BREAKEVEN_STOP

    const zoneBars = makeStandardZoneBars();
    const executionBars: Candle[] = [
      makeBar(TS_1005, 50200, 50300, 50150, 50250),
      makeBar(TS_1010, 50250, 50400, 50180, 50350),
      // 1R hit: close=50850 >= 50800
      makeBar(TS_1015, 50350, 50900, 50300, 50850),
      // Price reverses back to entry, stop hit at 50350
      makeBar(TS_1020, 50800, 50850, 50280, 50340),
    ];
    const allBars = [...zoneBars, ...executionBars];

    const { runner } = createTestSession(allBars);
    const result = await runner.runSession(DATE, SYMBOL);

    expect(result.status).toBe('COMPLETE');
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].status).toBe('STOPPED_OUT');

    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0].result).toBe('BREAKEVEN_STOP');
  });

  // -------------------------------------------------------------------------
  // Test 12: Monitoring with no break at all -> COMPLETE with no trades
  // -------------------------------------------------------------------------
  it('completes with no trades when no break occurs during monitoring', async () => {
    // Zone: R=50200, S=49800
    // Post-zone bars stay within R and S -- no break happens

    const zoneBars = makeStandardZoneBars();
    const executionBars: Candle[] = [
      // Bars stay within the zone -- high never pierces R, low never pierces S
      makeBar(TS_1005, 50100, 50180, 49850, 50050),
      makeBar(TS_1010, 50050, 50150, 49820, 50000),
      makeBar(TS_1015, 50000, 50100, 49850, 49950),
      makeBar(TS_1020, 49950, 50100, 49820, 50050),
    ];
    const allBars = [...zoneBars, ...executionBars];

    const { runner } = createTestSession(allBars);
    const result = await runner.runSession(DATE, SYMBOL);

    expect(result.status).toBe('COMPLETE');
    expect(result.trades).toHaveLength(0);
    expect(result.outcomes).toHaveLength(0);
    expect(result.zone).not.toBeNull();
    expect(result.zone!.status).toBe('DEFINED');
  });
});

// ===========================================================================
// Suite 2: Session + Storage (conditional -- skip if better-sqlite3 unavailable)
// ===========================================================================

describe('Full Session with Storage', () => {
  let sqliteAvailable = false;
  let SQLiteAdapterCtor: any = null;

  beforeAll(async () => {
    try {
      const mod = await import('../../src/adapters/storage/sqlite-adapter.js');
      SQLiteAdapterCtor = mod.SQLiteAdapter;
      // Verify better-sqlite3 actually works by opening an in-memory database
      const testAdapter = new SQLiteAdapterCtor(':memory:');
      testAdapter.initialize();
      testAdapter.close();
      sqliteAvailable = true;
    } catch {
      sqliteAvailable = false;
    }
  });

  it('persists session context to storage', async () => {
    if (!sqliteAvailable) {
      console.log('Skipping: better-sqlite3 not available');
      return;
    }

    // Run a full session
    const zoneBars = makeStandardZoneBars();
    const executionBars: Candle[] = [
      makeBar(TS_1005, 50200, 50300, 50150, 50250),
      makeBar(TS_1010, 50250, 50400, 50180, 50350),
      makeBar(TS_1015, 50350, 50550, 50300, 50520),
      makeBar(TS_1020, 50520, 50700, 50480, 50670),
      makeBar(TS_1025, 50670, 50850, 50600, 50810),
    ];
    const allBars = [...zoneBars, ...executionBars];

    const { runner } = createTestSession(allBars);
    const sessionCtx = await runner.runSession(DATE, SYMBOL);

    // Save to storage
    const storage = new SQLiteAdapterCtor(':memory:');
    storage.initialize();

    try {
      const sessionId = storage.saveSession(sessionCtx);
      expect(sessionId).toBeGreaterThan(0);

      // Verify getSession returns it
      const retrieved = storage.getSession(DATE, SYMBOL);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.date).toBe(DATE);
      expect(retrieved!.symbol).toBe(SYMBOL);
      expect(retrieved!.status).toBe('COMPLETE');
    } finally {
      storage.close();
    }
  });

  it('persists trades and outcomes to storage', async () => {
    if (!sqliteAvailable) {
      console.log('Skipping: better-sqlite3 not available');
      return;
    }

    // Run a full session with a trade reaching 3R
    // Entry=50350, stop=49900, rValue=450
    // target1R=50800, target2R=51250, target3R=51700
    const zoneBars = makeStandardZoneBars();
    const executionBars: Candle[] = [
      makeBar(TS_1005, 50200, 50300, 50150, 50250),
      makeBar(TS_1010, 50250, 50400, 50180, 50350),
      makeBar(TS_1015, 50350, 50850, 50300, 50750),  // 1R hit
      makeBar(TS_1020, 50750, 51300, 50700, 51200),  // 2R hit
      makeBar(TS_1025, 51200, 51750, 51150, 51700),  // 3R hit
    ];
    const allBars = [...zoneBars, ...executionBars];

    const { runner } = createTestSession(allBars);
    const sessionCtx = await runner.runSession(DATE, SYMBOL);

    expect(sessionCtx.trades).toHaveLength(1);
    expect(sessionCtx.outcomes).toHaveLength(1);

    // Save to storage
    const storage = new SQLiteAdapterCtor(':memory:');
    storage.initialize();

    try {
      const sessionId = storage.saveSession(sessionCtx);

      // Save trades
      for (const trade of sessionCtx.trades) {
        storage.saveTrade(trade, sessionId);
      }

      // Save outcomes
      for (const outcome of sessionCtx.outcomes) {
        storage.saveTradeOutcome(outcome);
      }

      // Save signals
      storage.saveSignals(sessionCtx.signals, sessionId);

      // Verify trades
      const trades = storage.getTradesByDateRange(DATE, DATE);
      expect(trades).toHaveLength(1);
      expect(trades[0].direction).toBe('LONG');
      expect(trades[0].entryPrice).toBe(50350);
      expect(trades[0].status).toBe('TARGET_HIT');

      // Verify outcomes
      const outcomes = storage.getOutcomesByDateRange(DATE, DATE);
      expect(outcomes).toHaveLength(1);
      expect(outcomes[0].result).toBe('WIN_3R');
      expect(outcomes[0].realizedR).toBe(3);

      // Verify session completed flag
      expect(storage.hasCompletedSession(DATE, SYMBOL)).toBe(true);
    } finally {
      storage.close();
    }
  });

  it('persists session with no trades to storage', async () => {
    if (!sqliteAvailable) {
      console.log('Skipping: better-sqlite3 not available');
      return;
    }

    // Run a choppy session (no trade)
    const bars = makeChoppyZoneBars();
    const { runner } = createTestSession(bars);
    const sessionCtx = await runner.runSession(DATE, SYMBOL);

    expect(sessionCtx.status).toBe('NO_TRADE');

    // Save to storage
    const storage = new SQLiteAdapterCtor(':memory:');
    storage.initialize();

    try {
      const sessionId = storage.saveSession(sessionCtx);
      expect(sessionId).toBeGreaterThan(0);

      const retrieved = storage.getSession(DATE, SYMBOL);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.status).toBe('NO_TRADE');
      expect(retrieved!.zone).not.toBeNull();
      expect(retrieved!.zone!.status).toBe('NO_TRADE_CHOPPY');

      // No trades should exist
      const trades = storage.getTradesByDateRange(DATE, DATE);
      expect(trades).toHaveLength(0);
    } finally {
      storage.close();
    }
  });
});
