// Generate CSV with a valid trading setup for 2026-02-10
// Zone: 175.00-176.00 (narrow, valid)
// Pattern: Break above 176.00 -> Retest -> Confirm
import { TZDate } from '@date-fns/tz';
import fs from 'fs';

const date = '2026-02-10'; // Tuesday
const ET_TIMEZONE = 'America/New_York';

const bars = [];

// 09:30 - First bar defines zone (175.00-176.00, $1 spread = valid)
bars.push({
  timestamp: Math.floor(new TZDate(2026, 1, 10, 9, 30, 0, 0, ET_TIMEZONE).getTime() / 1000),
  open: 175.50,
  high: 176.00,
  low: 175.00,
  close: 175.60,
  volume: 800000
});

// 09:35-09:55 - Observe zone (price stays within zone)
for (let m = 35; m < 60; m += 5) {
  bars.push({
    timestamp: Math.floor(new TZDate(2026, 1, 10, 9, m, 0, 0, ET_TIMEZONE).getTime() / 1000),
    open: 175.20 + (Math.random() * 0.60),
    high: 175.50 + (Math.random() * 0.50),
    low: 175.00 + (Math.random() * 0.30),
    close: 175.30 + (Math.random() * 0.50),
    volume: 750000 + Math.floor(Math.random() * 200000)
  });
}

// 10:00 - Last observation bar - close ABOVE resistance to show bullish bias (NOT choppy)
bars.push({
  timestamp: Math.floor(new TZDate(2026, 1, 10, 10, 0, 0, 0, ET_TIMEZONE).getTime() / 1000),
  open: 175.70,
  high: 176.30,
  low: 175.60,
  close: 176.20,  // Close above resistance = bullish bias, not choppy
  volume: 900000
});

// 10:05 - BREAK: High breaks above resistance (176.00)
bars.push({
  timestamp: Math.floor(new TZDate(2026, 1, 10, 10, 5, 0, 0, ET_TIMEZONE).getTime() / 1000),
  open: 175.70,
  high: 176.50,  // Breaks resistance
  low: 175.60,
  close: 176.30,
  volume: 950000
});

// 10:10 - Continue above zone
bars.push({
  timestamp: Math.floor(new TZDate(2026, 1, 10, 10, 10, 0, 0, ET_TIMEZONE).getTime() / 1000),
  open: 176.30,
  high: 176.60,
  low: 176.10,
  close: 176.40,
  volume: 850000
});

// 10:15 - RETEST: Price comes back to zone, low touches resistance (176.00)
bars.push({
  timestamp: Math.floor(new TZDate(2026, 1, 10, 10, 15, 0, 0, ET_TIMEZONE).getTime() / 1000),
  open: 176.40,
  high: 176.50,
  low: 175.95,   // Retest to resistance
  close: 176.10,
  volume: 900000
});

// 10:20 - CONFIRM: Close back above resistance (176.00+)
bars.push({
  timestamp: Math.floor(new TZDate(2026, 1, 10, 10, 20, 0, 0, ET_TIMEZONE).getTime() / 1000),
  open: 176.10,
  high: 176.80,
  low: 176.05,
  close: 176.70,  // Confirms above resistance
  volume: 1100000
});

// 10:25-11:55 - Trade runs, price moves up toward targets
let price = 176.70;
for (let h = 10; h <= 11; h++) {
  const startMin = (h === 10) ? 25 : 0;
  const endMin = (h === 11) ? 60 : 60;

  for (let m = startMin; m < endMin; m += 5) {
    // Gradual upward trend
    const drift = 0.05 + (Math.random() * 0.10);
    price += drift;

    const bar = {
      timestamp: Math.floor(new TZDate(2026, 1, 10, h, m, 0, 0, ET_TIMEZONE).getTime() / 1000),
      open: price,
      high: price + (Math.random() * 0.30),
      low: price - (Math.random() * 0.20),
      close: price + (Math.random() * 0.15) - 0.05,
      volume: 700000 + Math.floor(Math.random() * 300000)
    };

    bars.push(bar);
    price = bar.close;
  }
}

// Format and write CSV
const csvLines = ['timestamp,open,high,low,close,volume'];
bars.forEach(bar => {
  const line = [
    bar.timestamp,
    bar.open.toFixed(2),
    bar.high.toFixed(2),
    bar.low.toFixed(2),
    bar.close.toFixed(2),
    bar.volume
  ].join(',');
  csvLines.push(line);
});

fs.writeFileSync('data/AAPL-2026-02-10.csv', csvLines.join('\n'));

console.log('Generated', bars.length, 'bars with valid trading setup');
console.log('Zone: $175.00 - $176.00 (narrow, valid)');
console.log('Pattern: Break (10:05) -> Retest (10:15) -> Confirm (10:20)');
console.log('Entry expected: ~$176.70 (LONG)');
console.log('Stop: ~$175.00 (zone support)');
console.log('File: data/AAPL-2026-02-10.csv');
