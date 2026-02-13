/**
 * Response serializers for the web API.
 *
 * Converts internal representations (integer cents, UTC ms) to
 * display-friendly formats (dollars, ET-formatted times).
 */

export function centsToDollars(cents: number | null): number | null {
  if (cents === null || cents === undefined) return null;
  return Math.round(cents) / 100;
}

export function utcToET(utcMs: number | null): string | null {
  if (!utcMs) return null;
  const d = new Date(utcMs);
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function utcToETTime(utcMs: number | null): string | null {
  if (!utcMs) return null;
  const d = new Date(utcMs);
  return d.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function serializeBar(row: {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}) {
  return {
    timestamp: row.timestamp,
    time: utcToET(row.timestamp),
    open: centsToDollars(row.open)!,
    high: centsToDollars(row.high)!,
    low: centsToDollars(row.low)!,
    close: centsToDollars(row.close)!,
    volume: row.volume,
  };
}

export function serializeSignal(row: {
  direction: string;
  signal_type: string;
  timestamp: number;
  price: number;
  attempt_number: number;
}) {
  return {
    direction: row.direction,
    type: row.signal_type,
    timestamp: row.timestamp,
    time: utcToETTime(row.timestamp),
    price: centsToDollars(row.price)!,
    attemptNumber: row.attempt_number,
  };
}

export function serializeTrade(row: {
  id: string;
  symbol: string;
  direction: string;
  entry_price: number;
  initial_stop: number;
  current_stop: number;
  r_value: number;
  target_1r: number;
  target_2r: number;
  target_3r: number;
  entry_timestamp: number;
  status: string;
}) {
  return {
    id: row.id,
    symbol: row.symbol,
    direction: row.direction,
    entryPrice: centsToDollars(row.entry_price)!,
    initialStop: centsToDollars(row.initial_stop)!,
    currentStop: centsToDollars(row.current_stop)!,
    rValue: centsToDollars(row.r_value)!,
    target1R: centsToDollars(row.target_1r)!,
    target2R: centsToDollars(row.target_2r)!,
    target3R: centsToDollars(row.target_3r)!,
    entryTimestamp: row.entry_timestamp,
    entryTime: utcToETTime(row.entry_timestamp),
    status: row.status,
  };
}

export function serializeOutcome(row: {
  trade_id: string;
  result: string;
  max_favorable_r: number;
  max_adverse_r: number;
  exit_price: number;
  exit_timestamp: number;
  realized_r: number;
  first_threshold: number;
  timestamp_1r: number;
  timestamp_2r: number;
  timestamp_3r: number;
  timestamp_stop: number;
  bars_held: number;
}) {
  return {
    tradeId: row.trade_id,
    result: row.result,
    maxFavorableR: row.max_favorable_r,
    maxAdverseR: row.max_adverse_r,
    exitPrice: centsToDollars(row.exit_price)!,
    exitTimestamp: row.exit_timestamp,
    exitTime: utcToETTime(row.exit_timestamp),
    realizedR: row.realized_r,
    firstThresholdReached: row.first_threshold,
    timestamp1R: row.timestamp_1r,
    timestamp2R: row.timestamp_2r,
    timestamp3R: row.timestamp_3r,
    timestampStop: row.timestamp_stop,
    barsHeld: row.bars_held,
  };
}
