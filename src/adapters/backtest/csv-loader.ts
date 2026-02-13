import fs from 'node:fs';
import type { Candle } from '../../core/models/index.js';
import { dollarsToCents } from '../../utils/math.js';
import { etToUtc } from '../../utils/time.js';

export interface CsvLoadResult {
  readonly bars: Candle[];
  readonly errors: readonly CsvRowError[];
  readonly totalRows: number;
}

export interface CsvRowError {
  readonly line: number;
  readonly reason: string;
  readonly raw: string;
}

/**
 * Load 5-minute bar data from a CSV file.
 *
 * Expected CSV format:
 *   timestamp,open,high,low,close,volume
 *   20240102 09:30:00,475.50,476.20,475.30,475.80,125000
 *   1704203400,475.50,476.20,475.30,475.80,125000
 *
 * Timestamp formats supported:
 *   - "YYYYMMDD HH:MM:SS" (interpreted as ET, converted to UTC)
 *   - Epoch seconds (integer, treated as UTC)
 *
 * Prices are dollar floats, converted to integer cents on load.
 *
 * @param filePath - Path to the CSV file
 * @returns CsvLoadResult with parsed bars, any row errors, and total row count
 */
export function loadBarsFromCsv(filePath: string): CsvLoadResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

  if (lines.length === 0) {
    return { bars: [], errors: [], totalRows: 0 };
  }

  // Skip header row if present (check if first field is non-numeric)
  const startIdx = isHeaderRow(lines[0]) ? 1 : 0;

  const bars: Candle[] = [];
  const errors: CsvRowError[] = [];

  for (let i = startIdx; i < lines.length; i++) {
    try {
      const bar = parseRow(lines[i], i + 1); // 1-indexed line numbers
      bars.push(bar);
    } catch (e) {
      errors.push({
        line: i + 1,
        reason: e instanceof Error ? e.message : String(e),
        raw: lines[i],
      });
    }
  }

  // Sort by timestamp ascending
  bars.sort((a, b) => a.timestamp - b.timestamp);

  return { bars, errors, totalRows: lines.length - startIdx };
}

function isHeaderRow(line: string): boolean {
  const firstField = line.split(',')[0].trim();
  // A header row starts with a letter (e.g. "timestamp", "date", etc.)
  return firstField.length > 0 && /^[a-zA-Z]/.test(firstField);
}

function parseRow(line: string, lineNumber: number): Candle {
  const fields = line.split(',');

  if (fields.length < 6) {
    throw new Error(
      `Expected 6 fields (timestamp,open,high,low,close,volume), got ${fields.length}`,
    );
  }

  const rawTimestamp = fields[0].trim();
  const rawOpen = fields[1].trim();
  const rawHigh = fields[2].trim();
  const rawLow = fields[3].trim();
  const rawClose = fields[4].trim();
  const rawVolume = fields[5].trim();

  const timestamp = parseTimestamp(rawTimestamp);

  const open = parseFloat(rawOpen);
  if (Number.isNaN(open)) {
    throw new Error(`Invalid open price: "${rawOpen}"`);
  }

  const high = parseFloat(rawHigh);
  if (Number.isNaN(high)) {
    throw new Error(`Invalid high price: "${rawHigh}"`);
  }

  const low = parseFloat(rawLow);
  if (Number.isNaN(low)) {
    throw new Error(`Invalid low price: "${rawLow}"`);
  }

  const close = parseFloat(rawClose);
  if (Number.isNaN(close)) {
    throw new Error(`Invalid close price: "${rawClose}"`);
  }

  const volume = parseInt(rawVolume, 10);
  if (Number.isNaN(volume)) {
    throw new Error(`Invalid volume: "${rawVolume}"`);
  }

  return {
    timestamp,
    open: dollarsToCents(open),
    high: dollarsToCents(high),
    low: dollarsToCents(low),
    close: dollarsToCents(close),
    volume,
    completed: true,
    barSizeMinutes: 5,
  };
}

function parseTimestamp(raw: string): number {
  if (raw.includes(' ')) {
    // Format: "YYYYMMDD HH:MM:SS" interpreted as Eastern Time
    const [datePart, timePart] = raw.split(' ');

    if (datePart.length !== 8) {
      throw new Error(`Invalid date portion of timestamp: "${datePart}"`);
    }

    const year = datePart.substring(0, 4);
    const month = datePart.substring(4, 6);
    const day = datePart.substring(6, 8);

    const timeParts = timePart.split(':');
    if (timeParts.length < 2) {
      throw new Error(`Invalid time portion of timestamp: "${timePart}"`);
    }

    const hour = timeParts[0];
    const minute = timeParts[1];
    const second = timeParts.length >= 3 ? parseInt(timeParts[2], 10) : 0;

    if (Number.isNaN(second)) {
      throw new Error(`Invalid seconds in timestamp: "${timePart}"`);
    }

    // etToUtc returns UTC ms for the given ET date + HH:MM
    const baseUtcMs = etToUtc(`${year}-${month}-${day}`, `${hour}:${minute}`);
    return baseUtcMs + second * 1000;
  }

  // Epoch seconds (integer) -> UTC ms
  const epochSeconds = parseInt(raw, 10);
  if (Number.isNaN(epochSeconds)) {
    throw new Error(`Invalid timestamp: "${raw}"`);
  }
  return epochSeconds * 1000;
}
