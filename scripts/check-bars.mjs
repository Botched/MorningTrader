import Database from 'better-sqlite3';

const db = new Database('data/morningtrader.db', { readonly: true });

const session = db.prepare('SELECT id FROM sessions WHERE date = ? AND symbol = ?').get('2026-02-10', 'AAPL');
if (session) {
  console.log('First 8 bars from session', session.id + ':');
  const bars = db.prepare(`
    SELECT timestamp, open, high, low, close
    FROM bars
    WHERE session_id = ?
    ORDER BY timestamp
    LIMIT 8
  `).all(session.id);

  bars.forEach((bar, i) => {
    const time = new Date(bar.timestamp);
    const etTime = time.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' });
    console.log(`  ${i+1}. ${etTime} | Close: $${(bar.close/100).toFixed(2)}`);
  });
}
db.close();
