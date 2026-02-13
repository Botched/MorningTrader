// Generate CSV with bars from 09:30-12:00 ET for 2026-02-09
import { TZDate } from '@date-fns/tz';
import fs from 'fs';

const date = '2026-02-09';
const ET_TIMEZONE = 'America/New_York';

const bars = [];
let price = 175.00;

// Generate bars from 09:30 to 12:00 ET (5-min intervals)
for (let h = 9; h <= 12; h++) {
  const startMin = (h === 9) ? 30 : 0;
  const endMin = (h === 12) ? 5 : 60; // Include 12:00 bar

  for (let m = startMin; m < endMin; m += 5) {
    const tzDate = new TZDate(2026, 1, 9, h, m, 0, 0, ET_TIMEZONE); // Month is 0-indexed
    const timestamp = Math.floor(tzDate.getTime() / 1000);

    // Simulate price movement
    const open = price;
    const change = (Math.random() - 0.5) * 2;
    const high = open + Math.abs(change) + Math.random();
    const low = open - Math.abs(change) - Math.random();
    const close = open + change;
    price = close;

    const volume = Math.floor(800000 + Math.random() * 400000);

    bars.push({
      timestamp,
      open: open.toFixed(2),
      high: high.toFixed(2),
      low: low.toFixed(2),
      close: close.toFixed(2),
      volume
    });
  }
}

// Write CSV
const csvLines = ['timestamp,open,high,low,close,volume'];
bars.forEach(bar => {
  const line = [bar.timestamp, bar.open, bar.high, bar.low, bar.close, bar.volume].join(',');
  csvLines.push(line);
});

fs.writeFileSync('data/aapl-2026-02-09-extended.csv', csvLines.join('\n'));
console.log('Generated', bars.length, 'bars from 09:30 to 12:00 ET');
console.log('First bar:', new Date(bars[0].timestamp * 1000).toLocaleString('en-US', {timeZone: ET_TIMEZONE}));
console.log('Last bar:', new Date(bars[bars.length-1].timestamp * 1000).toLocaleString('en-US', {timeZone: ET_TIMEZONE}));
console.log('File: data/aapl-2026-02-09-extended.csv');
