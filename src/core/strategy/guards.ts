import type { Trade, TradeDirection } from '../models/index.js';
import type { StrategyMachineContext, StrategyEvent } from './events.js';
import { etToUtc } from '../../utils/time.js';

// ---------------------------------------------------------------------------
// Internal helpers (not exported)
// ---------------------------------------------------------------------------

/**
 * Retrieve the currently-open trade for a given direction, or null.
 * Since the context stores all trades in a flat array, we search for the
 * one that is both OPEN and matches the requested direction.
 */
function getActiveTrade(
  context: StrategyMachineContext,
  direction: TradeDirection,
): Trade | null {
  for (let i = context.trades.length - 1; i >= 0; i--) {
    const t = context.trades[i];
    if (t.direction === direction && t.status === 'OPEN') return t;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Zone Guards
// ---------------------------------------------------------------------------

/**
 * The first completed bar whose timestamp >= 10:00 ET triggers zone
 * evaluation.  We derive zoneEndUtc from the session date stored in context.
 */
export function isZoneComplete(
  context: StrategyMachineContext,
  event: StrategyEvent,
): boolean {
  if (event.type !== 'NEW_BAR') return false;
  const bar = event.candle;
  if (!bar.completed) return false;
  const zoneEndUtc = etToUtc(context.date, '10:00');
  return bar.timestamp >= zoneEndUtc;
}

/**
 * Choppy zone: the last source bar's CLOSE falls strictly between support
 * and resistance, meaning price never decisively closed outside the range
 * during the formation window.
 */
export function isChoppyZone(context: StrategyMachineContext): boolean {
  if (!context.zone) return false;
  const bars = context.zone.sourceBars;
  if (bars.length === 0) return false;
  const lastClose = bars[bars.length - 1].close;
  return lastClose > context.zone.support && lastClose < context.zone.resistance;
}

/**
 * Degenerate zone: spread is too narrow (< minZoneSpreadCents) or too wide
 * relative to the midpoint (spread / midpoint > maxZoneSpreadPercent / 100).
 */
export function isDegenerateZone(context: StrategyMachineContext): boolean {
  if (!context.zone) return false;
  const { spread, resistance, support } = context.zone;

  // Too narrow
  if (spread < context.minZoneSpreadCents) return true;

  // Too wide (percentage of midpoint)
  const midpoint = (resistance + support) / 2;
  if (midpoint === 0) return true; // degenerate by definition
  if (spread / midpoint > context.maxZoneSpreadPercent / 100) return true;

  return false;
}

// ---------------------------------------------------------------------------
// LONG Guards
// ---------------------------------------------------------------------------

/**
 * Long break: bar's HIGH pierces resistance while in 'watching' phase.
 * Uses HIGH (not close) per the two-tier filter for break detection.
 */
export function isLongBreak(
  context: StrategyMachineContext,
  event: StrategyEvent,
): boolean {
  if (event.type !== 'NEW_BAR') return false;
  const bar = event.candle;
  if (!bar.completed || !context.zone) return false;
  return bar.high > context.zone.resistance && context.longPhase === 'watching';
}

/**
 * Long retest: after a break, price pulls back so bar's LOW touches or
 * dips below resistance (i.e. retests the zone from above).
 */
export function isLongRetest(
  context: StrategyMachineContext,
  event: StrategyEvent,
): boolean {
  if (event.type !== 'NEW_BAR') return false;
  const bar = event.candle;
  if (!bar.completed || !context.zone) return false;
  return bar.low <= context.zone.resistance && context.longPhase === 'breakDetected';
}

/**
 * Single-bar retest-and-confirm shortcut: the bar dips to/below resistance
 * AND closes back above it, all in one candle.
 */
export function isLongRetestAndConfirm(
  context: StrategyMachineContext,
  event: StrategyEvent,
): boolean {
  if (event.type !== 'NEW_BAR') return false;
  const bar = event.candle;
  if (!bar.completed || !context.zone) return false;
  return (
    bar.low <= context.zone.resistance &&
    bar.close > context.zone.resistance &&
    context.longPhase === 'breakDetected'
  );
}

/**
 * Long confirmation: after a retest, bar closes above resistance.
 * Uses CLOSE per the two-tier filter (close for everything except break
 * detection).
 */
export function isLongConfirmation(
  context: StrategyMachineContext,
  event: StrategyEvent,
): boolean {
  if (event.type !== 'NEW_BAR') return false;
  const bar = event.candle;
  if (!bar.completed || !context.zone) return false;
  return bar.close > context.zone.resistance && context.longPhase === 'retestDetected';
}

/**
 * Long break failure: after break or retest, bar closes at or below
 * resistance — the breakout has failed.
 */
export function isLongBreakFailure(
  context: StrategyMachineContext,
  event: StrategyEvent,
): boolean {
  if (event.type !== 'NEW_BAR') return false;
  const bar = event.candle;
  if (!bar.completed || !context.zone) return false;
  return (
    bar.close <= context.zone.resistance &&
    (context.longPhase === 'breakDetected' || context.longPhase === 'retestDetected')
  );
}

/**
 * Long stop hit: bar closes at or below the current stop level.
 * currentStop starts at resistance and moves to entryPrice after 1R is
 * reached (trailing logic is handled by the machine's assign actions).
 */
export function isLongStopHit(
  context: StrategyMachineContext,
  event: StrategyEvent,
): boolean {
  if (event.type !== 'NEW_BAR') return false;
  const bar = event.candle;
  if (!bar.completed) return false;
  const trade = getActiveTrade(context, 'LONG');
  if (!trade) return false;
  return bar.close <= trade.currentStop && context.longPhase === 'positionOpen';
}

/**
 * Long 1R: bar closes at or above the 1R target (first time).
 * Multi-target resolution: checked after 3R and 2R (highest first) by
 * the machine, but the guard itself only checks the threshold.
 */
export function isLong1R(
  context: StrategyMachineContext,
  event: StrategyEvent,
): boolean {
  if (event.type !== 'NEW_BAR') return false;
  const bar = event.candle;
  if (!bar.completed) return false;
  const trade = getActiveTrade(context, 'LONG');
  if (!trade) return false;
  return (
    bar.close >= trade.target1R &&
    !context.reached1R &&
    context.longPhase === 'positionOpen'
  );
}

/**
 * Long 2R: bar closes at or above the 2R target (first time).
 */
export function isLong2R(
  context: StrategyMachineContext,
  event: StrategyEvent,
): boolean {
  if (event.type !== 'NEW_BAR') return false;
  const bar = event.candle;
  if (!bar.completed) return false;
  const trade = getActiveTrade(context, 'LONG');
  if (!trade) return false;
  return (
    bar.close >= trade.target2R &&
    !context.reached2R &&
    context.longPhase === 'positionOpen'
  );
}

/**
 * Long 3R: bar closes at or above the 3R target (first time).
 */
export function isLong3R(
  context: StrategyMachineContext,
  event: StrategyEvent,
): boolean {
  if (event.type !== 'NEW_BAR') return false;
  const bar = event.candle;
  if (!bar.completed) return false;
  const trade = getActiveTrade(context, 'LONG');
  if (!trade) return false;
  return (
    bar.close >= trade.target3R &&
    !context.reached3R &&
    context.longPhase === 'positionOpen'
  );
}

// ---------------------------------------------------------------------------
// SHORT Guards (mirrored from LONG with inverted comparisons)
// ---------------------------------------------------------------------------

/**
 * Short break: bar's LOW pierces support while in 'watching' phase.
 * Uses LOW (not close) per the two-tier filter for break detection.
 */
export function isShortBreak(
  context: StrategyMachineContext,
  event: StrategyEvent,
): boolean {
  if (event.type !== 'NEW_BAR') return false;
  const bar = event.candle;
  if (!bar.completed || !context.zone) return false;
  return bar.low < context.zone.support && context.shortPhase === 'watching';
}

/**
 * Short retest: after a break, price pulls back so bar's HIGH touches or
 * rises above support (i.e. retests the zone from below).
 */
export function isShortRetest(
  context: StrategyMachineContext,
  event: StrategyEvent,
): boolean {
  if (event.type !== 'NEW_BAR') return false;
  const bar = event.candle;
  if (!bar.completed || !context.zone) return false;
  return bar.high >= context.zone.support && context.shortPhase === 'breakDetected';
}

/**
 * Single-bar retest-and-confirm shortcut for short: bar rises to/above
 * support AND closes back below it, all in one candle.
 */
export function isShortRetestAndConfirm(
  context: StrategyMachineContext,
  event: StrategyEvent,
): boolean {
  if (event.type !== 'NEW_BAR') return false;
  const bar = event.candle;
  if (!bar.completed || !context.zone) return false;
  return (
    bar.high >= context.zone.support &&
    bar.close < context.zone.support &&
    context.shortPhase === 'breakDetected'
  );
}

/**
 * Short confirmation: after a retest, bar closes below support.
 * Uses CLOSE per the two-tier filter.
 */
export function isShortConfirmation(
  context: StrategyMachineContext,
  event: StrategyEvent,
): boolean {
  if (event.type !== 'NEW_BAR') return false;
  const bar = event.candle;
  if (!bar.completed || !context.zone) return false;
  return bar.close < context.zone.support && context.shortPhase === 'retestDetected';
}

/**
 * Short break failure: after break or retest, bar closes at or above
 * support — the breakdown has failed.
 */
export function isShortBreakFailure(
  context: StrategyMachineContext,
  event: StrategyEvent,
): boolean {
  if (event.type !== 'NEW_BAR') return false;
  const bar = event.candle;
  if (!bar.completed || !context.zone) return false;
  return (
    bar.close >= context.zone.support &&
    (context.shortPhase === 'breakDetected' || context.shortPhase === 'retestDetected')
  );
}

/**
 * Short stop hit: bar closes at or above the current stop level.
 * For shorts, stop is above the entry (initially at support, moves to
 * entryPrice after 1R).
 */
export function isShortStopHit(
  context: StrategyMachineContext,
  event: StrategyEvent,
): boolean {
  if (event.type !== 'NEW_BAR') return false;
  const bar = event.candle;
  if (!bar.completed) return false;
  const trade = getActiveTrade(context, 'SHORT');
  if (!trade) return false;
  return bar.close >= trade.currentStop && context.shortPhase === 'positionOpen';
}

/**
 * Short 1R: bar closes at or below the 1R target (first time).
 * For shorts, targets are below the entry price.
 */
export function isShort1R(
  context: StrategyMachineContext,
  event: StrategyEvent,
): boolean {
  if (event.type !== 'NEW_BAR') return false;
  const bar = event.candle;
  if (!bar.completed) return false;
  const trade = getActiveTrade(context, 'SHORT');
  if (!trade) return false;
  return (
    bar.close <= trade.target1R &&
    !context.reached1R &&
    context.shortPhase === 'positionOpen'
  );
}

/**
 * Short 2R: bar closes at or below the 2R target (first time).
 */
export function isShort2R(
  context: StrategyMachineContext,
  event: StrategyEvent,
): boolean {
  if (event.type !== 'NEW_BAR') return false;
  const bar = event.candle;
  if (!bar.completed) return false;
  const trade = getActiveTrade(context, 'SHORT');
  if (!trade) return false;
  return (
    bar.close <= trade.target2R &&
    !context.reached2R &&
    context.shortPhase === 'positionOpen'
  );
}

/**
 * Short 3R: bar closes at or below the 3R target (first time).
 */
export function isShort3R(
  context: StrategyMachineContext,
  event: StrategyEvent,
): boolean {
  if (event.type !== 'NEW_BAR') return false;
  const bar = event.candle;
  if (!bar.completed) return false;
  const trade = getActiveTrade(context, 'SHORT');
  if (!trade) return false;
  return (
    bar.close <= trade.target3R &&
    !context.reached3R &&
    context.shortPhase === 'positionOpen'
  );
}

// ---------------------------------------------------------------------------
// Control Guards
// ---------------------------------------------------------------------------

/**
 * Generic: has the given direction exhausted its allowed break attempts?
 */
export function isMaxAttemptsReached(
  context: StrategyMachineContext,
  direction: TradeDirection,
): boolean {
  const attempts =
    direction === 'LONG' ? context.longBreakAttempts : context.shortBreakAttempts;
  return attempts >= context.maxBreakAttempts;
}

/** Direction-specific wrappers for the state machine guard map. */
export function isMaxLongAttemptsReached(context: StrategyMachineContext): boolean {
  return isMaxAttemptsReached(context, 'LONG');
}

export function isMaxShortAttemptsReached(context: StrategyMachineContext): boolean {
  return isMaxAttemptsReached(context, 'SHORT');
}

/**
 * Generic: has the opposite direction already been activated, superseding
 * this one?
 */
export function isSuperseded(
  context: StrategyMachineContext,
  direction: TradeDirection,
): boolean {
  return context.activeDirection !== null && context.activeDirection !== direction;
}

/** Direction-specific wrappers for the state machine guard map. */
export function isLongSuperseded(context: StrategyMachineContext): boolean {
  return isSuperseded(context, 'LONG');
}

export function isShortSuperseded(context: StrategyMachineContext): boolean {
  return isSuperseded(context, 'SHORT');
}

/**
 * Session end: the event signals the end of the trading session.
 */
export function isSessionEnd(
  _context: StrategyMachineContext,
  event: StrategyEvent,
): boolean {
  return event.type === 'SESSION_END';
}
