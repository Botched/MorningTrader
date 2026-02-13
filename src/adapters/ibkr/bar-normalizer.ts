import type { Candle } from '../../core/models/index.js';
import { dollarsToCents } from '../../utils/math.js';

/**
 * Raw IBKR bar data as received from the TWS API.
 * Uses formatDate=2, so `time` is epoch seconds as a string.
 */
export type IBKRBar = {
  readonly time: string; // epoch seconds as string (formatDate=2)
  readonly open: number; // dollar float
  readonly high: number; // dollar float
  readonly low: number; // dollar float
  readonly close: number; // dollar float
  readonly volume?: number; // may be undefined
};

/**
 * Normalize a raw IBKR bar into a Candle.
 *
 * - Converts epoch seconds (string) to UTC milliseconds (number).
 * - Converts dollar floats to integer cents via dollarsToCents.
 * - Defaults volume to 0 if undefined.
 * - Sets completed=true (will be overridden by completion detection).
 * - Hardcodes barSizeMinutes=5.
 */
export function normalizeBar(ibBar: IBKRBar): Candle {
  return {
    timestamp: parseInt(ibBar.time, 10) * 1000, // epoch sec -> UTC ms
    open: dollarsToCents(ibBar.open),
    high: dollarsToCents(ibBar.high),
    low: dollarsToCents(ibBar.low),
    close: dollarsToCents(ibBar.close),
    volume: ibBar.volume ?? 0,
    completed: true, // will be overridden by completion detection
    barSizeMinutes: 5,
  };
}

/**
 * One-bar buffer algorithm for bar completion detection.
 *
 * IBKR streams in-progress bars that update until the bar closes. The only
 * reliable signal that a bar is complete is the arrival of a bar with a
 * *different* timestamp. This class buffers one bar and emits it as
 * completed when the next bar arrives.
 *
 * Usage:
 *   const buf = new BarCompletionBuffer();
 *   for (const raw of stream) {
 *     const completed = buf.push(normalizeBar(raw));
 *     if (completed) handleBar(completed);
 *   }
 *   // On SESSION_END:
 *   const last = buf.flush();
 *   if (last) handleBar(last);
 */
export class BarCompletionBuffer {
  private buffer: Candle | null = null;

  /**
   * Process a new bar. Returns the completed bar if one is ready,
   * null otherwise.
   */
  push(bar: Candle): Candle | null {
    if (this.buffer === null) {
      // Empty buffer: store bar (incomplete)
      this.buffer = { ...bar, completed: false };
      return null;
    }

    if (bar.timestamp !== this.buffer.timestamp) {
      // Different timestamp: emit buffered as completed, store new
      const completed: Candle = { ...this.buffer, completed: true };
      this.buffer = { ...bar, completed: false };
      return completed;
    }

    // Same timestamp: update buffer (replace in-progress bar)
    this.buffer = { ...bar, completed: false };
    return null;
  }

  /** Flush on SESSION_END: emit buffered bar as completed. */
  flush(): Candle | null {
    if (this.buffer === null) return null;
    const completed: Candle = { ...this.buffer, completed: true };
    this.buffer = null;
    return completed;
  }

  /** Reset buffer (discard any buffered bar without emitting). */
  reset(): void {
    this.buffer = null;
  }
}
