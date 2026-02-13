/**
 * IBKR 3-Tier Pacing Manager
 *
 * Prevents IBKR API rate limit violations on historical data requests
 * by enforcing three tiers of request throttling:
 *
 *   Tier 1 - Identity dedup:     max 1 identical request per 15s
 *   Tier 2 - Per-contract burst:  max 6 requests per contract per 2s
 *   Tier 3 - Global rolling:      max 60 historical requests per 10min
 *
 * All concurrent callers are serialized through a promise queue so that
 * slot acquisition is atomic and no two callers can race past the same
 * limit check.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PacingConfig {
  readonly identityWindowMs?: number;  // default: 15 000
  readonly burstWindowMs?: number;     // default: 2 000
  readonly burstLimit?: number;        // default: 6
  readonly globalWindowMs?: number;    // default: 600 000 (10 min)
  readonly globalLimit?: number;       // default: 60
}

interface ResolvedConfig {
  readonly identityWindowMs: number;
  readonly burstWindowMs: number;
  readonly burstLimit: number;
  readonly globalWindowMs: number;
  readonly globalLimit: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: ResolvedConfig = {
  identityWindowMs: 15_000,
  burstWindowMs: 2_000,
  burstLimit: 6,
  globalWindowMs: 600_000,
  globalLimit: 60,
} as const;

/** Promise-based setTimeout wrapper. */
function delay(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// PacingManager
// ---------------------------------------------------------------------------

export class PacingManager {
  // Tier 1 – identity dedup: requestKey -> last request timestamp
  private readonly identityMap = new Map<string, number>();

  // Tier 2 – per-contract burst: contractId -> sorted timestamp array
  private readonly contractTimestamps = new Map<string, number[]>();

  // Tier 3 – global rolling window: sorted timestamp array
  private readonly globalTimestamps: number[] = [];

  // Serialization queue – ensures only one acquireSlot runs at a time
  private _queue: Promise<void> = Promise.resolve();

  private readonly cfg: ResolvedConfig;

  constructor(config?: PacingConfig) {
    this.cfg = {
      identityWindowMs: config?.identityWindowMs ?? DEFAULT_CONFIG.identityWindowMs,
      burstWindowMs: config?.burstWindowMs ?? DEFAULT_CONFIG.burstWindowMs,
      burstLimit: config?.burstLimit ?? DEFAULT_CONFIG.burstLimit,
      globalWindowMs: config?.globalWindowMs ?? DEFAULT_CONFIG.globalWindowMs,
      globalLimit: config?.globalLimit ?? DEFAULT_CONFIG.globalLimit,
    };
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Acquire a slot to make a historical data request.
   * Returns a Promise that resolves when it is safe to proceed.
   * The caller should await this before making the IBKR API call.
   *
   * @param contractId  The contract identifier (e.g. "STK-AAPL-SMART-USD")
   * @param requestKey  A unique key for identity dedup
   *                    (e.g. "AAPL-5min-20240101-20240102")
   */
  async acquireSlot(contractId: string, requestKey: string): Promise<void> {
    // Chain onto the serialization queue so concurrent callers execute
    // one at a time.
    const slot = this._queue.then(() =>
      this._acquireSlotInternal(contractId, requestKey),
    );
    // Swallow rejections on the queue itself to prevent unhandled-rejection
    // cascading.  The *returned* promise (`slot`) still propagates errors to
    // the individual caller.
    this._queue = slot.catch(() => {});
    return slot;
  }

  /**
   * Get current pacing status for monitoring / logging.
   */
  getStatus(): {
    globalUsed: number;
    globalRemaining: number;
    contractCounts: Map<string, number>;
  } {
    const now = Date.now();
    this.pruneStaleEntries(now);

    const globalUsed = this.globalTimestamps.length;
    const globalRemaining = Math.max(0, this.cfg.globalLimit - globalUsed);

    const contractCounts = new Map<string, number>();
    for (const [id, timestamps] of this.contractTimestamps) {
      if (timestamps.length > 0) {
        contractCounts.set(id, timestamps.length);
      }
    }

    return { globalUsed, globalRemaining, contractCounts };
  }

  /**
   * Reset all tracking (e.g. on reconnection).
   */
  reset(): void {
    this.identityMap.clear();
    this.contractTimestamps.clear();
    this.globalTimestamps.length = 0;
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  /**
   * Core implementation called inside the serialized queue.
   */
  private async _acquireSlotInternal(
    contractId: string,
    requestKey: string,
  ): Promise<void> {
    // -- Tier 1: Identity dedup ----------------------------------------
    await this.waitForIdentity(requestKey);

    // -- Tier 2: Per-contract burst ------------------------------------
    await this.waitForBurst(contractId);

    // -- Tier 3: Global rolling ----------------------------------------
    await this.waitForGlobal();

    // -- Record the request in all tiers --------------------------------
    const now = Date.now();
    this.identityMap.set(requestKey, now);

    let contractTs = this.contractTimestamps.get(contractId);
    if (!contractTs) {
      contractTs = [];
      this.contractTimestamps.set(contractId, contractTs);
    }
    contractTs.push(now);

    this.globalTimestamps.push(now);
  }

  /**
   * Tier 1 – Identity dedup.
   * If the same requestKey was used within identityWindowMs, wait until the
   * window expires.
   */
  private async waitForIdentity(requestKey: string): Promise<void> {
    const now = Date.now();
    this.pruneStaleEntries(now);

    const lastTs = this.identityMap.get(requestKey);
    if (lastTs === undefined) return;

    const elapsed = now - lastTs;
    if (elapsed >= this.cfg.identityWindowMs) return;

    const waitMs = this.cfg.identityWindowMs - elapsed;
    await delay(waitMs);
  }

  /**
   * Tier 2 – Per-contract burst.
   * If `burstLimit` requests for this contract were made within
   * `burstWindowMs`, wait until the oldest one ages out.
   */
  private async waitForBurst(contractId: string): Promise<void> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const now = Date.now();
      this.pruneStaleEntries(now);

      const timestamps = this.contractTimestamps.get(contractId);
      if (!timestamps || timestamps.length < this.cfg.burstLimit) return;

      // The oldest timestamp still in the window needs to age out.
      const oldest = timestamps[0]!;
      const waitMs = oldest + this.cfg.burstWindowMs - now;
      if (waitMs <= 0) return;

      await delay(waitMs);
    }
  }

  /**
   * Tier 3 – Global rolling window.
   * If `globalLimit` requests were made within `globalWindowMs`, wait until
   * the oldest one ages out.
   */
  private async waitForGlobal(): Promise<void> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const now = Date.now();
      this.pruneStaleEntries(now);

      if (this.globalTimestamps.length < this.cfg.globalLimit) return;

      const oldest = this.globalTimestamps[0]!;
      const waitMs = oldest + this.cfg.globalWindowMs - now;
      if (waitMs <= 0) return;

      await delay(waitMs);
    }
  }

  /**
   * Remove stale entries from all tracking maps to prevent unbounded memory
   * growth.  Called before every tier check.
   */
  private pruneStaleEntries(now: number): void {
    // Tier 1: identity map – remove entries older than identityWindowMs
    const identityCutoff = now - this.cfg.identityWindowMs;
    for (const [key, ts] of this.identityMap) {
      if (ts < identityCutoff) {
        this.identityMap.delete(key);
      }
    }

    // Tier 2: per-contract timestamps – remove entries older than burstWindowMs
    const burstCutoff = now - this.cfg.burstWindowMs;
    for (const [contractId, timestamps] of this.contractTimestamps) {
      // Timestamps are appended in order, so we can shift from the front.
      while (timestamps.length > 0 && timestamps[0]! < burstCutoff) {
        timestamps.shift();
      }
      // Clean up empty arrays to avoid map bloat.
      if (timestamps.length === 0) {
        this.contractTimestamps.delete(contractId);
      }
    }

    // Tier 3: global timestamps – remove entries older than globalWindowMs
    const globalCutoff = now - this.cfg.globalWindowMs;
    while (
      this.globalTimestamps.length > 0 &&
      this.globalTimestamps[0]! < globalCutoff
    ) {
      this.globalTimestamps.shift();
    }
  }
}
