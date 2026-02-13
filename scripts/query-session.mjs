import Database from 'better-sqlite3';

const db = new Database('data/morningtrader.db', { readonly: true });

// Get NVDA session for 2026-02-09
const session = db.prepare(`
  SELECT id, symbol, date, status,
         zone_support, zone_resistance, zone_status
  FROM sessions
  WHERE symbol = ? AND date = ?
`).get('NVDA', '2026-02-09');

console.log('Session:', session);

if (session) {
  // Get bars
  const bars = db.prepare(`
    SELECT timestamp, open, high, low, close, volume
    FROM bars
    WHERE session_id = ?
    ORDER BY timestamp
  `).all(session.id);

  console.log('\nBars:');
  bars.forEach((bar, idx) => {
    const time = new Date(bar.timestamp);
    console.log(`${idx + 1}. ${time.toISOString()} | O:${(bar.open/100).toFixed(2)} H:${(bar.high/100).toFixed(2)} L:${(bar.low/100).toFixed(2)} C:${(bar.close/100).toFixed(2)} V:${bar.volume}`);
  });

  // Get signals
  const signals = db.prepare(`
    SELECT timestamp, signal_type, direction, price, attempt_number
    FROM signals
    WHERE session_id = ?
    ORDER BY timestamp
  `).all(session.id);

  console.log('\nSignals:');
  if (signals.length === 0) {
    console.log('No signals detected');
  } else {
    signals.forEach(signal => {
      const time = new Date(signal.timestamp);
      console.log(`${time.toISOString()} | ${signal.signal_type} ${signal.direction} | Price:${(signal.price/100).toFixed(2)} Attempt:${signal.attempt_number}`);
    });
  }

  // Get trades
  const trades = db.prepare(`
    SELECT direction, entry_price, initial_stop, target_1r, target_2r, target_3r
    FROM trades
    WHERE session_id = ?
  `).all(session.id);

  console.log('\nTrades:');
  if (trades.length === 0) {
    console.log('No trades');
  } else {
    trades.forEach(trade => {
      console.log(`${trade.direction} | Entry:${(trade.entry_price/100).toFixed(2)} Stop:${(trade.initial_stop/100).toFixed(2)} 1R:${(trade.target_1r/100).toFixed(2)} 2R:${(trade.target_2r/100).toFixed(2)} 3R:${(trade.target_3r/100).toFixed(2)}`);
    });
  }

  console.log(`\nZone: Support=${(session.zone_support/100).toFixed(2)}, Resistance=${(session.zone_resistance/100).toFixed(2)}`);
  console.log(`Zone Status: ${session.zone_status}`);
}

db.close();
