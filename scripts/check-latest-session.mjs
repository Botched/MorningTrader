import Database from 'better-sqlite3';

const db = new Database('data/morningtrader.db', { readonly: true });

// Get the most recent session
const session = db.prepare(`
  SELECT id, symbol, date, status, zone_support, zone_resistance, zone_status
  FROM sessions
  ORDER BY id DESC
  LIMIT 1
`).get();

if (!session) {
  console.log('No sessions found in database');
  process.exit(0);
}

console.log('=== LATEST SESSION ===');
console.log(`ID: ${session.id}`);
console.log(`Symbol: ${session.symbol}`);
console.log(`Date: ${session.date}`);
console.log(`Status: ${session.status}`);
console.log(`Zone: Support=$${(session.zone_support/100).toFixed(2)}, Resistance=$${(session.zone_resistance/100).toFixed(2)}`);
console.log(`Zone Status: ${session.zone_status}`);

// Get bars
const bars = db.prepare(`
  SELECT timestamp, open, high, low, close
  FROM bars
  WHERE session_id = ?
  ORDER BY timestamp
`).all(session.id);

console.log(`\n=== BARS (${bars.length} total) ===`);
if (bars.length === 0) {
  console.log('No bars saved!');
} else {
  const firstBar = new Date(bars[0].timestamp);
  const lastBar = new Date(bars[bars.length - 1].timestamp);

  console.log(`First bar: ${firstBar.toISOString()} (${firstBar.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' })} ET)`);
  console.log(`Last bar:  ${lastBar.toISOString()} (${lastBar.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' })} ET)`);

  // Show last 5 bars
  console.log('\nLast 5 bars:');
  bars.slice(-5).forEach((bar) => {
    const time = new Date(bar.timestamp);
    const etTime = time.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' });
    console.log(`  ${etTime} ET | O:$${(bar.open/100).toFixed(2)} H:$${(bar.high/100).toFixed(2)} L:$${(bar.low/100).toFixed(2)} C:$${(bar.close/100).toFixed(2)}`);
  });
}

// Get trades
const trade = db.prepare(`
  SELECT direction, entry_price, initial_stop, target_1r, target_2r, target_3r
  FROM trades
  WHERE session_id = ?
`).get(session.id);

console.log('\n=== TRADE ===');
if (!trade) {
  console.log('No trade (this is why you don\'t see R-multiple zones!)');
} else {
  console.log(`Direction: ${trade.direction}`);
  console.log(`Entry: $${(trade.entry_price/100).toFixed(2)}`);
  console.log(`Stop: $${(trade.initial_stop/100).toFixed(2)}`);
  console.log(`1R: $${(trade.target_1r/100).toFixed(2)}`);
  console.log(`2R: $${(trade.target_2r/100).toFixed(2)}`);
  console.log(`3R: $${(trade.target_3r/100).toFixed(2)}`);
}

db.close();
