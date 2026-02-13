import Database from 'better-sqlite3';

const db = new Database('data/morningtrader.db', { readonly: true });

// Find sessions with trades
const sessions = db.prepare(`
  SELECT s.id, s.symbol, s.date, s.status, s.zone_support, s.zone_resistance, s.zone_status,
         t.direction, t.entry_price, t.initial_stop, t.target_1r, t.target_2r, t.target_3r,
         o.result, o.realized_r, o.exit_price
  FROM sessions s
  JOIN trades t ON s.id = t.session_id
  LEFT JOIN trade_outcomes o ON t.id = o.trade_id
  WHERE s.status = 'COMPLETED'
  LIMIT 5
`).all();

console.log(`Found ${sessions.length} sessions with trades:\n`);

sessions.forEach((session, idx) => {
  console.log(`${idx + 1}. ${session.symbol} on ${session.date}`);
  console.log(`   Zone: Support=$${(session.zone_support/100).toFixed(2)}, Resistance=$${(session.zone_resistance/100).toFixed(2)}`);
  console.log(`   Trade: ${session.direction} @ $${(session.entry_price/100).toFixed(2)} | Stop=$${(session.initial_stop/100).toFixed(2)}`);
  if (session.result) {
    console.log(`   Result: ${session.result} (${session.realized_r}R) | Exit=$${(session.exit_price/100).toFixed(2)}`);
  }
  console.log('');
});

db.close();
