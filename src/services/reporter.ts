/**
 * MorningTrader - Reporter Service
 *
 * Formats and exports trade data for reporting.  Supports CSV, JSON, and
 * human-readable console output.
 *
 * IMPORTANT:
 * - All internal prices are integer cents.  They are converted to dollars
 *   for every external representation (CSV columns, JSON values, console text).
 * - R-multiples are displayed to 2 decimal places.
 */

import { writeFileSync } from 'node:fs';
import type { Trade, TradeOutcome } from '../core/models/index.js';
import type { SessionContext } from '../core/models/index.js';
import type { AggregateMetrics } from '../core/metrics/index.js';
import { aggregateMetrics } from '../core/metrics/aggregator.js';
import { centsToDollars } from '../utils/math.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportOptions {
  readonly format: 'csv' | 'json' | 'console';
  readonly from?: string;   // YYYY-MM-DD
  readonly to?: string;     // YYYY-MM-DD
  readonly symbol?: string;
  readonly output?: string; // file path for csv/json, undefined for stdout
}

// ---------------------------------------------------------------------------
// Reporter
// ---------------------------------------------------------------------------

export class Reporter {
  /**
   * Format trades as a CSV string.
   *
   * Columns: id, symbol, direction, entry_price, stop_level, r_value,
   *          target_1r, target_2r, target_3r, status
   *
   * All price columns are converted from integer cents to dollars.
   */
  formatTradesAsCsv(trades: readonly Trade[]): string {
    const header =
      'id,symbol,direction,entry_price,stop_level,r_value,target_1r,target_2r,target_3r,status';
    const rows = trades.map((t) =>
      [
        t.id,
        t.symbol,
        t.direction,
        centsToDollars(t.entryPrice).toFixed(2),
        centsToDollars(t.stopLevel).toFixed(2),
        centsToDollars(t.rValue).toFixed(2),
        centsToDollars(t.target1R).toFixed(2),
        centsToDollars(t.target2R).toFixed(2),
        centsToDollars(t.target3R).toFixed(2),
        t.status,
      ].join(','),
    );
    return [header, ...rows].join('\n');
  }

  /**
   * Format trade outcomes as a CSV string.
   *
   * Columns: trade_id, result, realized_r, max_favorable_r, max_adverse_r,
   *          exit_price, bars_held
   *
   * Exit price is converted from integer cents to dollars.
   * R-multiples are shown to 2 decimal places.
   */
  formatOutcomesAsCsv(outcomes: readonly TradeOutcome[]): string {
    const header =
      'trade_id,result,realized_r,max_favorable_r,max_adverse_r,exit_price,bars_held';
    const rows = outcomes.map((o) =>
      [
        o.tradeId,
        o.result,
        o.realizedR.toFixed(2),
        o.maxFavorableR.toFixed(2),
        o.maxAdverseR.toFixed(2),
        centsToDollars(o.exitPrice).toFixed(2),
        o.barsHeld,
      ].join(','),
    );
    return [header, ...rows].join('\n');
  }

  /**
   * Format trades as a pretty-printed JSON string.
   *
   * All price fields are converted from integer cents to dollars so the
   * JSON output uses human-readable dollar values.
   */
  formatTradesAsJson(trades: readonly Trade[]): string {
    const formatted = trades.map((t) => ({
      ...t,
      entryPrice: centsToDollars(t.entryPrice),
      stopLevel: centsToDollars(t.stopLevel),
      currentStop: centsToDollars(t.currentStop),
      rValue: centsToDollars(t.rValue),
      target1R: centsToDollars(t.target1R),
      target2R: centsToDollars(t.target2R),
      target3R: centsToDollars(t.target3R),
    }));
    return JSON.stringify(formatted, null, 2);
  }

  /**
   * Format a human-readable console summary from aggregate metrics.
   *
   * @param metrics        - Pre-computed aggregate metrics.
   * @param totalSessions  - Number of sessions (optional context line).
   */
  formatConsoleSummary(
    metrics: AggregateMetrics,
    totalSessions?: number,
  ): string {
    const lines: string[] = [
      '=== MorningTrader Performance Report ===',
      '',
    ];

    if (totalSessions !== undefined) {
      lines.push(`Total Sessions: ${totalSessions}`);
    }

    lines.push(
      `Total Trades:   ${metrics.stats.totalTrades}`,
      `  Wins:         ${metrics.stats.wins}`,
      `  Losses:       ${metrics.stats.losses}`,
      `  Breakeven:    ${metrics.stats.breakeven}`,
      `  Timeouts:     ${metrics.stats.timeouts}`,
      '',
      `Win Rate:       ${metrics.winRate.toFixed(1)}%`,
      `Profit Factor:  ${metrics.profitFactor === Infinity ? 'Inf' : metrics.profitFactor.toFixed(2)}`,
      `Average R:      ${metrics.averageR.toFixed(2)}R`,
      `Total R:        ${metrics.totalR.toFixed(2)}R`,
      `Max Drawdown:   ${metrics.maxDrawdownR.toFixed(2)}R`,
      '',
      '--- Per Direction ---',
    );

    if (metrics.longStats.totalTrades > 0) {
      lines.push(
        `LONG:  ${metrics.longStats.totalTrades} trades, ` +
          `${metrics.longStats.winRate.toFixed(1)}% win rate, ` +
          `${metrics.longStats.averageR.toFixed(2)}R avg`,
      );
    }

    if (metrics.shortStats.totalTrades > 0) {
      lines.push(
        `SHORT: ${metrics.shortStats.totalTrades} trades, ` +
          `${metrics.shortStats.winRate.toFixed(1)}% win rate, ` +
          `${metrics.shortStats.averageR.toFixed(2)}R avg`,
      );
    }

    lines.push('', '========================================');
    return lines.join('\n');
  }

  /**
   * Generate a console-format report from a set of sessions.
   *
   * Delegates to {@link aggregateMetrics} for computation and
   * {@link formatConsoleSummary} for presentation.
   */
  generateReport(sessions: readonly SessionContext[]): string {
    const metrics = aggregateMetrics(sessions);
    return this.formatConsoleSummary(metrics, sessions.length);
  }

  /**
   * Write content to a file or to stdout.
   *
   * @param content    - String content to write.
   * @param outputPath - File path. When omitted, content is written to stdout.
   */
  writeOutput(content: string, outputPath?: string): void {
    if (outputPath) {
      writeFileSync(outputPath, content, 'utf-8');
    } else {
      console.log(content);
    }
  }
}
