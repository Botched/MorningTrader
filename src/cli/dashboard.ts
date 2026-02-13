/**
 * CLI Dashboard - Formatted console output per bar.
 *
 * Renders the current session state as a compact, readable console display
 * using simple box-drawing characters. No external dependencies required.
 *
 * Usage:
 * ```ts
 * const dashboard = new Dashboard();
 * dashboard.render(sessionContext, currentBar);
 * ```
 */
import type { Candle } from '../core/models/candle.js';
import type { DecisionZone } from '../core/models/decision-zone.js';
import type { SessionContext, SessionStatus } from '../core/models/session.js';
import type { Signal } from '../core/models/signal.js';
import type { Trade } from '../core/models/trade.js';
import { centsToDollars } from '../utils/math.js';

// ── Box-drawing constants ──────────────────────────────────────────

const BOX_WIDTH = 62;

const TOP_LEFT = '\u250C';       // ┌
const TOP_RIGHT = '\u2510';      // ┐
const BOTTOM_LEFT = '\u2514';    // └
const BOTTOM_RIGHT = '\u2518';   // ┘
const HORIZONTAL = '\u2500';     // ─
const VERTICAL = '\u2502';       // │
const TEE_LEFT = '\u251C';       // ├
const TEE_RIGHT = '\u2524';      // ┤

const HR = HORIZONTAL.repeat(BOX_WIDTH - 2);

// ── Formatting helpers ─────────────────────────────────────────────

function topBorder(): string {
  return `${TOP_LEFT}${HR}${TOP_RIGHT}`;
}

function bottomBorder(): string {
  return `${BOTTOM_LEFT}${HR}${BOTTOM_RIGHT}`;
}

function separator(): string {
  return `${TEE_LEFT}${HR}${TEE_RIGHT}`;
}

function padLine(content: string): string {
  // Strip ANSI for length calculation (simple approach: no ANSI used here)
  const innerWidth = BOX_WIDTH - 4; // 2 for borders + 2 for padding
  const padded = content.length > innerWidth
    ? content.slice(0, innerWidth)
    : content.padEnd(innerWidth);
  return `${VERTICAL} ${padded} ${VERTICAL}`;
}

function emptyLine(): string {
  return padLine('');
}

/** Format cents as dollar string, e.g. 15025 -> "$150.25" */
function $(cents: number): string {
  return `$${centsToDollars(cents).toFixed(2)}`;
}

/** Format a UTC ms timestamp as HH:MM:SS ET-style (local time). */
function formatTime(utcMs: number): string {
  if (utcMs === 0) return '--:--:--';
  const d = new Date(utcMs);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/** Map SessionStatus to a human-readable label. */
function statusLabel(status: SessionStatus): string {
  const labels: Record<SessionStatus, string> = {
    WAITING: 'Waiting for market open',
    BUILDING_ZONE: 'Building decision zone',
    MONITORING: 'Monitoring for signals',
    NO_TRADE: 'No trade today',
    COMPLETE: 'Session complete',
    INTERRUPTED: 'Session interrupted',
    ERROR: 'Error',
  };
  return labels[status] ?? status;
}

/** Format a key-value pair with aligned columns. */
function kv(key: string, value: string | number | boolean, keyWidth = 20): string {
  return `${String(key).padEnd(keyWidth)} ${value}`;
}

// ── Dashboard class ────────────────────────────────────────────────

export class Dashboard {
  /**
   * Render the full dashboard to stdout.
   *
   * @param context - The current session context
   * @param currentBar - The most recent (possibly incomplete) candle
   */
  render(context: SessionContext, currentBar?: Candle): void {
    const lines: string[] = [];

    lines.push('');
    lines.push(topBorder());
    this.renderHeader(lines, context);
    lines.push(separator());
    this.renderZone(lines, context.zone);
    lines.push(separator());
    this.renderState(lines, context);
    lines.push(separator());
    this.renderActiveTrade(lines, context.trades);
    lines.push(separator());
    this.renderSignals(lines, context.signals);

    if (currentBar) {
      lines.push(separator());
      this.renderBar(lines, currentBar, context.allBars.length);
    }

    lines.push(bottomBorder());
    lines.push('');

    console.log(lines.join('\n'));
  }

  // ── Section renderers ──────────────────────────────────────────

  private renderHeader(lines: string[], ctx: SessionContext): void {
    const modeTag = ctx.executionMode === 'LIVE' ? 'LIVE' : 'MOCK';
    const backtestTag = ctx.isBacktest ? ' [BACKTEST]' : '';

    lines.push(padLine(`MorningTrader Dashboard${backtestTag}`));
    lines.push(emptyLine());
    lines.push(padLine(kv('Date', ctx.date)));
    lines.push(padLine(kv('Symbol', ctx.symbol)));
    lines.push(padLine(kv('Mode', `${modeTag}${backtestTag}`)));
    lines.push(padLine(kv('Started', formatTime(ctx.startedAt))));

    if (ctx.completedAt > 0) {
      lines.push(padLine(kv('Completed', formatTime(ctx.completedAt))));
    }
  }

  private renderZone(lines: string[], zone: DecisionZone | null): void {
    lines.push(padLine('Decision Zone'));
    lines.push(emptyLine());

    if (!zone) {
      lines.push(padLine('  (not yet defined)'));
      return;
    }

    lines.push(padLine(kv('  Resistance', $(zone.resistance))));
    lines.push(padLine(kv('  Support', $(zone.support))));
    lines.push(padLine(kv('  Spread', $(zone.spread))));
    lines.push(padLine(kv('  Status', zone.status)));

    if (zone.premarketPrice > 0) {
      lines.push(padLine(kv('  Premarket Price', $(zone.premarketPrice))));
    }

    lines.push(padLine(kv('  Source Bars', String(zone.sourceBars.length))));
    lines.push(padLine(kv('  Defined At', formatTime(zone.definedAt))));
  }

  private renderState(lines: string[], ctx: SessionContext): void {
    lines.push(padLine('Session State'));
    lines.push(emptyLine());
    lines.push(padLine(kv('  Status', statusLabel(ctx.status))));
    lines.push(padLine(kv('  Bars Received', String(ctx.allBars.length))));
    lines.push(padLine(kv('  Signals', String(ctx.signals.length))));
    lines.push(padLine(kv('  Trades', String(ctx.trades.length))));
    lines.push(padLine(kv('  Outcomes', String(ctx.outcomes.length))));

    if (ctx.error) {
      lines.push(padLine(kv('  Error', ctx.error)));
    }
  }

  private renderActiveTrade(lines: string[], trades: readonly Trade[]): void {
    lines.push(padLine('Active Trade'));
    lines.push(emptyLine());

    const activeTrade = trades.find((t) => t.status === 'OPEN');

    if (!activeTrade) {
      lines.push(padLine('  (no active trade)'));
      return;
    }

    lines.push(padLine(kv('  Direction', activeTrade.direction)));
    lines.push(padLine(kv('  Entry', $(activeTrade.entryPrice))));
    lines.push(padLine(kv('  Stop (initial)', $(activeTrade.stopLevel))));
    lines.push(padLine(kv('  Stop (current)', $(activeTrade.currentStop))));
    lines.push(padLine(kv('  R-Value', $(activeTrade.rValue))));
    lines.push(padLine(kv('  Target 1R', $(activeTrade.target1R))));
    lines.push(padLine(kv('  Target 2R', $(activeTrade.target2R))));
    lines.push(padLine(kv('  Target 3R', $(activeTrade.target3R))));
    lines.push(padLine(kv('  Entry Time', formatTime(activeTrade.entryTimestamp))));
    lines.push(padLine(kv('  Signal', `${activeTrade.entrySignal.type} #${activeTrade.entrySignal.attemptNumber}`)));
  }

  private renderSignals(lines: string[], signals: readonly Signal[]): void {
    lines.push(padLine('Signal History'));
    lines.push(emptyLine());

    if (signals.length === 0) {
      lines.push(padLine('  (no signals yet)'));
      return;
    }

    // Compact list: "  09:35:00  LONG BREAK #1  $150.25"
    for (const sig of signals) {
      const time = formatTime(sig.timestamp);
      const dir = sig.direction.padEnd(5);
      const type = sig.type.padEnd(13);
      const attempt = `#${sig.attemptNumber}`;
      const price = $(sig.price);
      lines.push(padLine(`  ${time}  ${dir} ${type} ${attempt}  ${price}`));
    }
  }

  private renderBar(lines: string[], bar: Candle, barCount: number): void {
    lines.push(padLine('Current Bar'));
    lines.push(emptyLine());

    const status = bar.completed ? 'complete' : 'building';

    lines.push(padLine(kv('  Time', formatTime(bar.timestamp))));
    lines.push(padLine(kv('  O / H / L / C', `${$(bar.open)} / ${$(bar.high)} / ${$(bar.low)} / ${$(bar.close)}`)));
    lines.push(padLine(kv('  Volume', bar.volume.toLocaleString())));
    lines.push(padLine(kv('  Status', status)));
    lines.push(padLine(kv('  Bar Count', String(barCount))));
  }
}
