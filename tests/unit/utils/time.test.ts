import { describe, it, expect } from 'vitest';
import {
  etToUtc,
  getSessionWindows,
  normalizeToBarGrid,
  isWithinRange,
  utcToEtDateStr,
} from '../../../src/utils/time.js';

// ---------------------------------------------------------------------------
// etToUtc
// ---------------------------------------------------------------------------

describe('etToUtc', () => {
  it('converts a summer ET time to UTC ms (EDT = UTC-4)', () => {
    // 2024-06-15 09:30 ET (EDT) = 2024-06-15 13:30 UTC
    const result = etToUtc('2024-06-15', '09:30');
    // 2024-06-15T13:30:00Z in ms
    const expected = Date.UTC(2024, 5, 15, 13, 30, 0, 0); // month is 0-indexed
    expect(result).toBe(expected);
  });

  it('converts a winter ET time to UTC ms (EST = UTC-5)', () => {
    // 2024-01-15 09:30 ET (EST) = 2024-01-15 14:30 UTC
    const result = etToUtc('2024-01-15', '09:30');
    const expected = Date.UTC(2024, 0, 15, 14, 30, 0, 0);
    expect(result).toBe(expected);
  });

  it('handles midnight ET correctly in winter', () => {
    // 2024-01-02 00:00 ET (EST) = 2024-01-02 05:00 UTC
    const result = etToUtc('2024-01-02', '00:00');
    const expected = Date.UTC(2024, 0, 2, 5, 0, 0, 0);
    expect(result).toBe(expected);
  });

  it('handles midnight ET correctly in summer', () => {
    // 2024-07-01 00:00 ET (EDT) = 2024-07-01 04:00 UTC
    const result = etToUtc('2024-07-01', '00:00');
    const expected = Date.UTC(2024, 6, 1, 4, 0, 0, 0);
    expect(result).toBe(expected);
  });

  it('handles DST spring forward date (2024-03-10)', () => {
    // On March 10, 2024, clocks spring forward at 2:00 AM ET
    // 09:30 on this day is EDT (UTC-4)
    const result = etToUtc('2024-03-10', '09:30');
    const expected = Date.UTC(2024, 2, 10, 13, 30, 0, 0);
    expect(result).toBe(expected);
  });

  it('handles DST fall back date (2024-11-03)', () => {
    // On November 3, 2024, clocks fall back at 2:00 AM ET
    // 09:30 on this day is EST (UTC-5)
    const result = etToUtc('2024-11-03', '09:30');
    const expected = Date.UTC(2024, 10, 3, 14, 30, 0, 0);
    expect(result).toBe(expected);
  });

  it('day before spring forward is still EST (UTC-5)', () => {
    // 2024-03-09 is still EST
    const result = etToUtc('2024-03-09', '09:30');
    const expected = Date.UTC(2024, 2, 9, 14, 30, 0, 0);
    expect(result).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// getSessionWindows
// ---------------------------------------------------------------------------

describe('getSessionWindows', () => {
  it('returns correct session windows for a summer day (EDT, UTC-4)', () => {
    const windows = getSessionWindows('2024-06-15');

    // 09:00 ET (EDT) = 13:00 UTC
    expect(windows.premarketUtc).toBe(Date.UTC(2024, 5, 15, 13, 0, 0, 0));
    // 09:30 ET (EDT) = 13:30 UTC
    expect(windows.zoneStartUtc).toBe(Date.UTC(2024, 5, 15, 13, 30, 0, 0));
    // 10:00 ET (EDT) = 14:00 UTC
    expect(windows.zoneEndUtc).toBe(Date.UTC(2024, 5, 15, 14, 0, 0, 0));
    // 12:00 ET (EDT) = 16:00 UTC
    expect(windows.executionEndUtc).toBe(Date.UTC(2024, 5, 15, 16, 0, 0, 0));
  });

  it('returns correct session windows for a winter day (EST, UTC-5)', () => {
    const windows = getSessionWindows('2024-01-15');

    // 09:00 ET (EST) = 14:00 UTC
    expect(windows.premarketUtc).toBe(Date.UTC(2024, 0, 15, 14, 0, 0, 0));
    // 09:30 ET (EST) = 14:30 UTC
    expect(windows.zoneStartUtc).toBe(Date.UTC(2024, 0, 15, 14, 30, 0, 0));
    // 10:00 ET (EST) = 15:00 UTC
    expect(windows.zoneEndUtc).toBe(Date.UTC(2024, 0, 15, 15, 0, 0, 0));
    // 12:00 ET (EST) = 17:00 UTC
    expect(windows.executionEndUtc).toBe(Date.UTC(2024, 0, 15, 17, 0, 0, 0));
  });

  it('handles DST spring forward correctly (2024-03-10)', () => {
    const windows = getSessionWindows('2024-03-10');
    // After spring forward, 09:30 ET is EDT = UTC-4, so 12:00 ET = 16:00 UTC
    expect(windows.zoneStartUtc).toBe(Date.UTC(2024, 2, 10, 13, 30, 0, 0));
    expect(windows.executionEndUtc).toBe(Date.UTC(2024, 2, 10, 16, 0, 0, 0));
  });

  it('handles DST fall back correctly (2024-11-03)', () => {
    const windows = getSessionWindows('2024-11-03');
    // After fall back, 09:30 ET is EST = UTC-5, so 12:00 ET = 17:00 UTC
    expect(windows.zoneStartUtc).toBe(Date.UTC(2024, 10, 3, 14, 30, 0, 0));
    expect(windows.executionEndUtc).toBe(Date.UTC(2024, 10, 3, 17, 0, 0, 0));
  });

  it('session window spans: 30min zone, 2.5h total execution (09:30-12:00)', () => {
    const windows = getSessionWindows('2024-06-15');
    expect(windows.zoneEndUtc - windows.zoneStartUtc).toBe(30 * 60 * 1000);
    expect(windows.executionEndUtc - windows.zoneStartUtc).toBe(
      150 * 60 * 1000, // 09:30-12:00 = 2.5 hours = 150 minutes
    );
    expect(windows.zoneStartUtc - windows.premarketUtc).toBe(30 * 60 * 1000);
  });
});

// ---------------------------------------------------------------------------
// normalizeToBarGrid
// ---------------------------------------------------------------------------

describe('normalizeToBarGrid', () => {
  it('returns the same value when already at a bar boundary', () => {
    // 5 min bars = 300_000 ms
    const barBoundary = 300_000 * 100; // exact multiple
    expect(normalizeToBarGrid(barBoundary, 5)).toBe(barBoundary);
  });

  it('snaps down to bar start when mid-bar', () => {
    // 300_000 * 100 = 30_000_000 (bar boundary)
    // 30_000_000 + 150_000 (2.5 min past) should snap to 30_000_000
    const barStart = 300_000 * 100;
    const midBar = barStart + 150_000;
    expect(normalizeToBarGrid(midBar, 5)).toBe(barStart);
  });

  it('snaps 1ms past boundary down to that boundary', () => {
    const boundary = 300_000 * 50;
    expect(normalizeToBarGrid(boundary + 1, 5)).toBe(boundary);
  });

  it('snaps 1ms before boundary down to previous boundary', () => {
    const boundary = 300_000 * 50;
    expect(normalizeToBarGrid(boundary - 1, 5)).toBe(boundary - 300_000);
  });

  it('works with 1-minute bars (60000 ms)', () => {
    const boundary = 60_000 * 100;
    const midBar = boundary + 30_000;
    expect(normalizeToBarGrid(midBar, 1)).toBe(boundary);
  });

  it('works with 15-minute bars (900000 ms)', () => {
    const boundary = 900_000 * 10;
    const midBar = boundary + 450_000;
    expect(normalizeToBarGrid(midBar, 15)).toBe(boundary);
  });

  it('handles zero timestamp', () => {
    expect(normalizeToBarGrid(0, 5)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// isWithinRange
// ---------------------------------------------------------------------------

describe('isWithinRange', () => {
  it('returns true for timestamp at range start (inclusive)', () => {
    expect(isWithinRange(1000, 1000, 2000)).toBe(true);
  });

  it('returns false for timestamp at range end (exclusive)', () => {
    expect(isWithinRange(2000, 1000, 2000)).toBe(false);
  });

  it('returns true for timestamp in the middle of range', () => {
    expect(isWithinRange(1500, 1000, 2000)).toBe(true);
  });

  it('returns false for timestamp before range', () => {
    expect(isWithinRange(999, 1000, 2000)).toBe(false);
  });

  it('returns false for timestamp after range', () => {
    expect(isWithinRange(2001, 1000, 2000)).toBe(false);
  });

  it('returns false when start == end (empty range)', () => {
    expect(isWithinRange(1000, 1000, 1000)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// utcToEtDateStr
// ---------------------------------------------------------------------------

describe('utcToEtDateStr', () => {
  it('converts a UTC timestamp to ET date string in summer', () => {
    // 2024-06-15T13:30:00Z = 2024-06-15 09:30 ET (EDT)
    const utcMs = Date.UTC(2024, 5, 15, 13, 30, 0, 0);
    expect(utcToEtDateStr(utcMs)).toBe('2024-06-15');
  });

  it('converts a UTC timestamp to ET date string in winter', () => {
    // 2024-01-15T14:30:00Z = 2024-01-15 09:30 ET (EST)
    const utcMs = Date.UTC(2024, 0, 15, 14, 30, 0, 0);
    expect(utcToEtDateStr(utcMs)).toBe('2024-01-15');
  });

  it('handles date rollover: UTC midnight is previous day in ET', () => {
    // 2024-06-15T00:00:00Z = 2024-06-14 20:00 ET (EDT, UTC-4)
    const utcMs = Date.UTC(2024, 5, 15, 0, 0, 0, 0);
    expect(utcToEtDateStr(utcMs)).toBe('2024-06-14');
  });

  it('handles date rollover in winter: UTC midnight is previous day in ET', () => {
    // 2024-01-15T00:00:00Z = 2024-01-14 19:00 ET (EST, UTC-5)
    const utcMs = Date.UTC(2024, 0, 15, 0, 0, 0, 0);
    expect(utcToEtDateStr(utcMs)).toBe('2024-01-14');
  });
});
