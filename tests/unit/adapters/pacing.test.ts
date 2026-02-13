import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PacingManager } from '../../../src/adapters/ibkr/pacing.js';

// ---------------------------------------------------------------------------
// Setup fake timers for every test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tier 1 - Identity dedup
// ---------------------------------------------------------------------------

describe('PacingManager - Tier 1 (Identity dedup)', () => {
  it('allows the first request for a key immediately', async () => {
    const pm = new PacingManager();
    const start = Date.now();

    const p = pm.acquireSlot('contract-A', 'key-1');
    // Flush microtasks + timers
    await vi.runAllTimersAsync();
    await p;

    // Should resolve without any delay
    expect(Date.now() - start).toBe(0);
  });

  it('queues the same request key within 15s', async () => {
    const pm = new PacingManager();

    // First request
    const p1 = pm.acquireSlot('contract-A', 'key-1');
    await vi.runAllTimersAsync();
    await p1;

    const startSecond = Date.now();
    const p2 = pm.acquireSlot('contract-A', 'key-1');
    await vi.runAllTimersAsync();
    await p2;

    // Should have waited ~15000ms for the identity window
    expect(Date.now() - startSecond).toBeGreaterThanOrEqual(15000);
  });

  it('allows a different request key immediately', async () => {
    const pm = new PacingManager();

    const p1 = pm.acquireSlot('contract-A', 'key-1');
    await vi.runAllTimersAsync();
    await p1;

    const start = Date.now();
    const p2 = pm.acquireSlot('contract-A', 'key-2');
    await vi.runAllTimersAsync();
    await p2;

    // Different key should not be delayed by identity dedup
    // (it will be serialized by the queue, but not delayed by Tier 1)
    expect(Date.now() - start).toBe(0);
  });

  it('allows the same key again after identity window expires', async () => {
    const pm = new PacingManager();

    const p1 = pm.acquireSlot('contract-A', 'key-1');
    await vi.runAllTimersAsync();
    await p1;

    // Advance past the identity window (15s)
    vi.advanceTimersByTime(15001);

    const start = Date.now();
    const p2 = pm.acquireSlot('contract-A', 'key-1');
    await vi.runAllTimersAsync();
    await p2;

    // Should not wait because the identity window has elapsed
    expect(Date.now() - start).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tier 2 - Per-contract burst
// ---------------------------------------------------------------------------

describe('PacingManager - Tier 2 (Per-contract burst)', () => {
  it('allows the first burstLimit requests for same contract immediately', async () => {
    const pm = new PacingManager({
      burstLimit: 6,
      burstWindowMs: 2000,
      // Use large identity/global windows to avoid interference
      identityWindowMs: 0,
      globalLimit: 1000,
    });

    const start = Date.now();

    // Fire 6 requests with unique keys
    for (let i = 0; i < 6; i++) {
      const p = pm.acquireSlot('contract-A', `key-${i}`);
      await vi.runAllTimersAsync();
      await p;
    }

    // All 6 should proceed without any burst delay
    expect(Date.now() - start).toBe(0);
  });

  it('queues the 7th request until the burst window slides', async () => {
    const pm = new PacingManager({
      burstLimit: 6,
      burstWindowMs: 2000,
      identityWindowMs: 0,
      globalLimit: 1000,
    });

    // Fire 6 requests
    for (let i = 0; i < 6; i++) {
      const p = pm.acquireSlot('contract-A', `key-${i}`);
      await vi.runAllTimersAsync();
      await p;
    }

    const startSeventh = Date.now();
    const p7 = pm.acquireSlot('contract-A', 'key-6');
    await vi.runAllTimersAsync();
    await p7;

    // The 7th request should wait for the burst window (2000ms)
    expect(Date.now() - startSeventh).toBeGreaterThanOrEqual(2000);
  });

  it('treats different contracts independently', async () => {
    const pm = new PacingManager({
      burstLimit: 6,
      burstWindowMs: 2000,
      identityWindowMs: 0,
      globalLimit: 1000,
    });

    // Fill burst for contract-A (6 requests)
    for (let i = 0; i < 6; i++) {
      const p = pm.acquireSlot('contract-A', `A-key-${i}`);
      await vi.runAllTimersAsync();
      await p;
    }

    // contract-B should still proceed immediately (separate burst bucket)
    const start = Date.now();
    const p = pm.acquireSlot('contract-B', 'B-key-0');
    await vi.runAllTimersAsync();
    await p;

    expect(Date.now() - start).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tier 3 - Global rolling window
// ---------------------------------------------------------------------------

describe('PacingManager - Tier 3 (Global rolling window)', () => {
  it('allows up to globalLimit requests within the window', async () => {
    const pm = new PacingManager({
      identityWindowMs: 0,
      burstLimit: 1000, // effectively disabled
      burstWindowMs: 100,
      globalLimit: 5,
      globalWindowMs: 10000,
    });

    const start = Date.now();

    for (let i = 0; i < 5; i++) {
      const p = pm.acquireSlot(`contract-${i}`, `key-${i}`);
      await vi.runAllTimersAsync();
      await p;
    }

    // All 5 should proceed without global delay
    expect(Date.now() - start).toBe(0);
  });

  it('queues requests exceeding globalLimit until window slides', async () => {
    const pm = new PacingManager({
      identityWindowMs: 0,
      burstLimit: 1000,
      burstWindowMs: 100,
      globalLimit: 5,
      globalWindowMs: 10000,
    });

    // Fill global quota
    for (let i = 0; i < 5; i++) {
      const p = pm.acquireSlot(`contract-${i}`, `key-${i}`);
      await vi.runAllTimersAsync();
      await p;
    }

    const startExtra = Date.now();
    const pExtra = pm.acquireSlot('contract-extra', 'key-extra');
    await vi.runAllTimersAsync();
    await pExtra;

    // Should have waited for the global window to slide (10000ms)
    expect(Date.now() - startExtra).toBeGreaterThanOrEqual(10000);
  });

  it('allows a new request after the oldest slides out of the window', async () => {
    const pm = new PacingManager({
      identityWindowMs: 0,
      burstLimit: 1000,
      burstWindowMs: 100,
      globalLimit: 3,
      globalWindowMs: 5000,
    });

    // Fill global quota
    for (let i = 0; i < 3; i++) {
      const p = pm.acquireSlot(`contract-${i}`, `key-${i}`);
      await vi.runAllTimersAsync();
      await p;
    }

    // Advance time so the first request slides out
    vi.advanceTimersByTime(5001);

    const start = Date.now();
    const p = pm.acquireSlot('contract-new', 'key-new');
    await vi.runAllTimersAsync();
    await p;

    // Should proceed immediately since oldest has expired
    expect(Date.now() - start).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getStatus and reset
// ---------------------------------------------------------------------------

describe('PacingManager - getStatus / reset', () => {
  it('getStatus reflects current usage', async () => {
    const pm = new PacingManager({
      identityWindowMs: 0,
      burstLimit: 100,
      burstWindowMs: 100,
      globalLimit: 60,
      globalWindowMs: 600000,
    });

    const p = pm.acquireSlot('AAPL', 'AAPL-key');
    await vi.runAllTimersAsync();
    await p;

    const status = pm.getStatus();
    expect(status.globalUsed).toBe(1);
    expect(status.globalRemaining).toBe(59);
    expect(status.contractCounts.get('AAPL')).toBe(1);
  });

  it('reset clears all tracking', async () => {
    const pm = new PacingManager({
      identityWindowMs: 0,
      burstLimit: 100,
      burstWindowMs: 100,
      globalLimit: 60,
      globalWindowMs: 600000,
    });

    const p = pm.acquireSlot('AAPL', 'AAPL-key');
    await vi.runAllTimersAsync();
    await p;

    pm.reset();
    const status = pm.getStatus();
    expect(status.globalUsed).toBe(0);
    expect(status.globalRemaining).toBe(60);
    expect(status.contractCounts.size).toBe(0);
  });
});
