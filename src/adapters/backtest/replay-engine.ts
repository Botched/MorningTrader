import type { Clock, ClockTimer } from '../../core/interfaces/index.js';
import type { Candle } from '../../core/models/index.js';

export class SimulatedClock implements Clock {
  private currentTime: number;
  private nextTimerId = 0;
  private readonly timers = new Map<number, { fireAt: number; fn: () => void }>();

  constructor(initialTime: number = 0) {
    this.currentTime = initialTime;
  }

  now(): number {
    return this.currentTime;
  }

  setTimeout(fn: () => void, ms: number): ClockTimer {
    const id = ++this.nextTimerId;
    this.timers.set(id, { fireAt: this.currentTime + ms, fn });
    return { id };
  }

  clearTimeout(timer: ClockTimer): void {
    this.timers.delete(timer.id);
  }

  async waitUntil(utcMs: number): Promise<void> {
    // In simulated clock, this resolves immediately
    // (time is advanced externally by the replay engine)
    return Promise.resolve();
  }

  /**
   * Advance simulated time to a new timestamp.
   * Fires any timers that should have triggered between old and new time.
   * Timers fire in chronological order.
   */
  advanceTo(utcMs: number): void {
    if (utcMs < this.currentTime) {
      throw new Error(`Cannot advance clock backwards: ${utcMs} < ${this.currentTime}`);
    }
    this.currentTime = utcMs;

    // Fire any timers whose fireAt <= currentTime, in order
    const toFire = [...this.timers.entries()]
      .filter(([, t]) => t.fireAt <= this.currentTime)
      .sort(([, a], [, b]) => a.fireAt - b.fireAt);

    for (const [id, timer] of toFire) {
      this.timers.delete(id);
      timer.fn();
    }
  }

  /** Reset clock to initial state */
  reset(time: number = 0): void {
    this.currentTime = time;
    this.timers.clear();
    this.nextTimerId = 0;
  }
}

export interface ReplayOptions {
  /** Callback invoked for each bar */
  readonly onBar: (bar: Candle) => void;
  /** Optional callback before replay starts */
  readonly onStart?: () => void;
  /** Optional callback after replay ends */
  readonly onEnd?: () => void;
}

export class ReplayEngine {
  private readonly clock: SimulatedClock;

  constructor(clock: SimulatedClock) {
    this.clock = clock;
  }

  /**
   * Replay bars deterministically through the callback.
   * Advances the SimulatedClock to each bar's timestamp before emitting.
   * No wall-clock dependency - fully deterministic.
   *
   * @param bars - Sorted array of candles (ascending by timestamp)
   * @param options - Callbacks for bar processing
   */
  replay(bars: readonly Candle[], options: ReplayOptions): void {
    if (options.onStart) options.onStart();

    for (const bar of bars) {
      // Advance clock to this bar's timestamp
      this.clock.advanceTo(bar.timestamp);
      // Emit bar
      options.onBar(bar);
    }

    if (options.onEnd) options.onEnd();
  }

  /** Get the associated clock */
  getClock(): SimulatedClock {
    return this.clock;
  }
}
