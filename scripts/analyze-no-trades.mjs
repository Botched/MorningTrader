import Database from 'better-sqlite3';

const db = new Database('data/morningtrader.db', { readonly: true });

console.log('=== BACKTEST ANALYSIS ===\n');

// Get overview
const overview = db.prepare(`
  SELECT
    COUNT(*) as total_sessions,
    COUNT(DISTINCT symbol) as symbols,
    COUNT(DISTINCT date) as dates,
    MIN(date) as first_date,
    MAX(date) as last_date
  FROM sessions
`).get();

console.log(`Total Sessions: ${overview.total_sessions}`);
console.log(`Symbols: ${overview.symbols}`);
console.log(`Date Range: ${overview.first_date} to ${overview.last_date}\n`);

// Zone status breakdown
const zoneStatuses = db.prepare(`
  SELECT zone_status, COUNT(*) as count
  FROM sessions
  GROUP BY zone_status
  ORDER BY count DESC
`).all();

console.log('Zone Status Breakdown:');
zoneStatuses.forEach(z => {
  console.log(`  ${z.zone_status}: ${z.count} (${((z.count/overview.total_sessions)*100).toFixed(1)}%)`);
});

// Find the "best" zones (DEFINED but no trade)
const definedZones = db.prepare(`
  SELECT symbol, date, zone_support, zone_resistance, status
  FROM sessions
  WHERE zone_status = 'DEFINED'
  ORDER BY date DESC
  LIMIT 3
`).all();

console.log('\nSessions with DEFINED zones (closest to trading):');
if (definedZones.length === 0) {
  console.log('  None found');
} else {
  definedZones.forEach(s => {
    const spread = s.zone_resistance - s.zone_support;
    console.log(`  ${s.symbol} ${s.date}: $${(s.zone_support/100).toFixed(2)}-$${(s.zone_resistance/100).toFixed(2)} (spread: $${(spread/100).toFixed(2)}, status: ${s.status})`);
  });
}

// Sample a choppy zone for analysis
const choppy = db.prepare(`
  SELECT id, symbol, date, zone_support, zone_resistance
  FROM sessions
  WHERE zone_status = 'NO_TRADE_CHOPPY'
  LIMIT 1
`).get();

if (choppy) {
  console.log(`\n=== EXAMPLE: ${choppy.symbol} on ${choppy.date} (CHOPPY) ===`);

  const bars = db.prepare(`
    SELECT timestamp, open, high, low, close
    FROM bars
    WHERE session_id = ?
    ORDER BY timestamp
    LIMIT 7
  `).all(choppy.id);

  console.log(`Zone: Support=$${(choppy.zone_support/100).toFixed(2)}, Resistance=$${(choppy.zone_resistance/100).toFixed(2)}`);
  console.log('\nFirst 7 bars:');
  bars.forEach((bar, idx) => {
    const time = new Date(bar.timestamp);
    const hour = time.getUTCHours() - 5; // Convert to ET
    const min = time.getUTCMinutes();
    const timeStr = `${hour.toString().padStart(2,'0')}:${min.toString().padStart(2,'0')}`;
    const zoneMarker = idx < 6 ? '[ZONE]' : '[EVAL]';
    console.log(`  ${idx+1}. ${timeStr} ${zoneMarker} | O:$${(bar.open/100).toFixed(2)} H:$${(bar.high/100).toFixed(2)} L:$${(bar.low/100).toFixed(2)} C:$${(bar.close/100).toFixed(2)}`);
  });
}

db.close();
