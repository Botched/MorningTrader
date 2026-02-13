import Database from 'better-sqlite3';

const db = new Database('data/morningtrader.db', { readonly: true });

// Find ANY sessions with trades
const sessions = db.prepare(`
  SELECT s.id, s.symbol, s.date, s.status, s.zone_support, s.zone_resistance, s.zone_status
  FROM sessions s
  JOIN trades t ON s.id = t.session_id
  LIMIT 5
`).all();

console.log(`Found ${sessions.length} sessions with trades (any status):\n`);

if (sessions.length === 0) {
  console.log('No trades found. Let me check session statuses:');
  const statuses = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM sessions
    GROUP BY status
  `).all();

  console.log('\nSession statuses:');
  statuses.forEach(s => {
    console.log(`  ${s.status}: ${s.count}`);
  });
}

sessions.forEach(session => {
  console.log(`${session.symbol} on ${session.date} (${session.status})`);
  console.log(`  Session ID: ${session.id}`);
});

db.close();
