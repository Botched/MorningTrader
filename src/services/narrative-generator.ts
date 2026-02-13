/**
 * NarrativeGenerator - Transforms session data into structured narrative sections
 *
 * A pure, stateless service that generates human-readable write-ups
 * explaining what happened during a trading session: zone formation,
 * signal sequence, trade decisions, and outcomes.
 */

import type {
  FullSessionData,
  SessionNarrative,
  NarrativeSection,
  NarrativeKeyValue,
} from './narrative-types.js';

// ── Formatting helpers ──────────────────────────────────────────────

function centsToDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatTime(utcMs: number): string {
  if (!utcMs) return 'N/A';
  const d = new Date(utcMs);
  return d.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDate(utcMs: number): string {
  if (!utcMs) return 'N/A';
  const d = new Date(utcMs);
  return d.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatR(r: number): string {
  return `${r >= 0 ? '+' : ''}${r.toFixed(2)}R`;
}

function resultLabel(result: string): string {
  switch (result) {
    case 'WIN_2R': return 'Win (2R)';
    case 'WIN_3R': return 'Win (3R)';
    case 'LOSS': return 'Loss';
    case 'BREAKEVEN_STOP': return 'Breakeven Stop';
    case 'SESSION_TIMEOUT': return 'Session Timeout';
    default: return result;
  }
}

// ── Section generators ──────────────────────────────────────────────

function generateOverview(data: FullSessionData): NarrativeSection {
  const mode = data.isBacktest ? 'Backtest' : data.executionMode === 'LIVE' ? 'Live' : 'Paper';
  const duration = data.completedAt && data.startedAt
    ? Math.round((data.completedAt - data.startedAt) / 60000)
    : 0;

  const statusMap: Record<string, string> = {
    COMPLETE: 'completed normally',
    NO_TRADE: 'no trade taken',
    ERROR: `error: ${data.error ?? 'unknown'}`,
    INTERRUPTED: 'interrupted',
    MONITORING: 'ended while monitoring',
    BUILDING_ZONE: 'ended during zone building',
    WAITING: 'did not start',
  };

  const paragraphs = [
    `**${data.symbol}** session on **${data.date}** (${mode} mode). ` +
    `Session ${statusMap[data.status] ?? data.status}.`,
  ];

  if (data.bars.length > 0) {
    paragraphs.push(
      `Processed ${data.bars.length} bars from ${formatTime(data.bars[0].timestamp)} ` +
      `to ${formatTime(data.bars[data.bars.length - 1].timestamp)} ET.`,
    );
  }

  const keyValues: NarrativeKeyValue[] = [
    { label: 'Date', value: data.date, type: 'time' },
    { label: 'Symbol', value: data.symbol, type: 'text' },
    { label: 'Mode', value: mode, type: 'text' },
    { label: 'Status', value: data.status, type: 'result' },
    { label: 'Bars', value: String(data.bars.length), type: 'text' },
  ];

  if (duration > 0) {
    keyValues.push({ label: 'Duration', value: `${duration} min`, type: 'text' });
  }

  return { title: 'Overview', paragraphs, keyValues };
}

function generateZoneFormation(data: FullSessionData): NarrativeSection {
  if (!data.zone) {
    return {
      title: 'Zone Formation',
      paragraphs: ['No decision zone was formed for this session.'],
      keyValues: [],
    };
  }

  const zone = data.zone;
  const spreadDollars = (zone.spread / 100).toFixed(2);
  const midpoint = Math.round((zone.resistance + zone.support) / 2);

  const paragraphs = [
    `The decision zone was built from the first 30 minutes of trading (9:30-10:00 ET). ` +
    `Resistance established at ${centsToDollars(zone.resistance)} (highest high) ` +
    `and support at ${centsToDollars(zone.support)} (lowest low), ` +
    `creating a $${spreadDollars} spread.`,
  ];

  if (zone.status === 'NO_TRADE_CHOPPY') {
    paragraphs.push(
      'At 10:00 ET, price was inside the zone (choppy). No trade was taken.',
    );
  } else if (zone.status === 'NO_TRADE_DEGENERATE') {
    paragraphs.push(
      'Zone spread was too narrow or too wide. No trade was taken.',
    );
  } else if (zone.status === 'DEFINED') {
    paragraphs.push('Zone was clean and valid for trade evaluation.');
  }

  if (zone.sourceBars.length > 0) {
    paragraphs.push(
      `Zone was derived from ${zone.sourceBars.length} bars.`,
    );
  }

  const keyValues: NarrativeKeyValue[] = [
    { label: 'Resistance', value: centsToDollars(zone.resistance), type: 'price' },
    { label: 'Support', value: centsToDollars(zone.support), type: 'price' },
    { label: 'Spread', value: `$${spreadDollars}`, type: 'price' },
    { label: 'Midpoint', value: centsToDollars(midpoint), type: 'price' },
    { label: 'Zone Status', value: zone.status, type: 'result' },
  ];

  return { title: 'Zone Formation', paragraphs, keyValues };
}

function generateSignalSequence(data: FullSessionData): NarrativeSection {
  if (data.signals.length === 0) {
    return {
      title: 'Signal Sequence',
      paragraphs: ['No signals were generated during this session.'],
      keyValues: [],
    };
  }

  const sorted = [...data.signals].sort((a, b) => a.timestamp - b.timestamp);
  const lines: string[] = [];

  for (const signal of sorted) {
    const time = formatTime(signal.timestamp);
    const price = centsToDollars(signal.price);
    const attempt = signal.attemptNumber > 1 ? ` (attempt #${signal.attemptNumber})` : '';
    lines.push(`- **${time}**: ${signal.direction} ${signal.type} at ${price}${attempt}`);
  }

  const paragraphs = [
    `${data.signals.length} signal(s) detected during the monitoring window:`,
    lines.join('\n'),
  ];

  const breaks = sorted.filter((s) => s.type === 'BREAK').length;
  const retests = sorted.filter((s) => s.type === 'RETEST').length;
  const confirms = sorted.filter((s) => s.type === 'CONFIRMATION').length;
  const failures = sorted.filter((s) => s.type === 'BREAK_FAILURE').length;

  const keyValues: NarrativeKeyValue[] = [
    { label: 'Total Signals', value: String(data.signals.length), type: 'text' },
    { label: 'Breaks', value: String(breaks), type: 'text' },
    { label: 'Retests', value: String(retests), type: 'text' },
    { label: 'Confirmations', value: String(confirms), type: 'text' },
  ];

  if (failures > 0) {
    keyValues.push({ label: 'Failures', value: String(failures), type: 'text' });
  }

  return { title: 'Signal Sequence', paragraphs, keyValues };
}

function generateTradeEntry(data: FullSessionData): NarrativeSection | null {
  if (data.trades.length === 0) return null;

  const trade = data.trades[0];
  const rDollars = (trade.rValue / 100).toFixed(2);

  const paragraphs = [
    `**${trade.direction}** entry confirmed at ${formatTime(trade.entryTimestamp)} ` +
    `with entry price ${centsToDollars(trade.entryPrice)}.`,
    `Initial stop set at ${centsToDollars(trade.stopLevel)} ` +
    `(R-value: $${rDollars}).`,
    `Targets: 1R at ${centsToDollars(trade.target1R)}, ` +
    `2R at ${centsToDollars(trade.target2R)}, ` +
    `3R at ${centsToDollars(trade.target3R)}.`,
  ];

  const keyValues: NarrativeKeyValue[] = [
    { label: 'Direction', value: trade.direction, type: 'direction' },
    { label: 'Entry', value: centsToDollars(trade.entryPrice), type: 'price' },
    { label: 'Stop', value: centsToDollars(trade.stopLevel), type: 'price' },
    { label: 'R-Value', value: `$${rDollars}`, type: 'price' },
    { label: 'Target 1R', value: centsToDollars(trade.target1R), type: 'price' },
    { label: 'Target 2R', value: centsToDollars(trade.target2R), type: 'price' },
    { label: 'Target 3R', value: centsToDollars(trade.target3R), type: 'price' },
  ];

  return { title: 'Trade Entry', paragraphs, keyValues };
}

function generateTradeManagement(data: FullSessionData): NarrativeSection | null {
  if (data.trades.length === 0 || data.outcomes.length === 0) return null;

  const trade = data.trades[0];
  const outcome = data.outcomes[0];
  const milestones: string[] = [];

  if (outcome.timestamp1R) {
    milestones.push(`1R reached at ${formatTime(outcome.timestamp1R)} — stop moved to entry (${centsToDollars(trade.entryPrice)})`);
  }
  if (outcome.timestamp2R) {
    milestones.push(`2R reached at ${formatTime(outcome.timestamp2R)}`);
  }
  if (outcome.timestamp3R) {
    milestones.push(`3R reached at ${formatTime(outcome.timestamp3R)}`);
  }

  const paragraphs: string[] = [];

  if (milestones.length > 0) {
    paragraphs.push('**Milestones:**');
    paragraphs.push(milestones.map((m) => `- ${m}`).join('\n'));
  } else {
    paragraphs.push('No R-milestones were reached before the trade resolved.');
  }

  paragraphs.push(
    `Max favorable excursion: ${formatR(outcome.maxFavorableR)}. ` +
    `Max adverse excursion: ${formatR(outcome.maxAdverseR)}.`,
  );

  const keyValues: NarrativeKeyValue[] = [
    { label: 'Max Favorable', value: formatR(outcome.maxFavorableR), type: 'r-value' },
    { label: 'Max Adverse', value: formatR(outcome.maxAdverseR), type: 'r-value' },
    { label: 'Bars Held', value: String(outcome.barsHeld), type: 'text' },
  ];

  if (outcome.firstThresholdReached > 0) {
    keyValues.push({
      label: 'Highest Threshold',
      value: `${outcome.firstThresholdReached}R`,
      type: 'r-value',
    });
  }

  return { title: 'Trade Management', paragraphs, keyValues };
}

function generateOutcome(data: FullSessionData): NarrativeSection | null {
  if (data.outcomes.length === 0) return null;

  const outcome = data.outcomes[0];
  const label = resultLabel(outcome.result);

  const paragraphs = [
    `Trade resolved as **${label}** with realized R of **${formatR(outcome.realizedR)}**.`,
    `Exit at ${centsToDollars(outcome.exitPrice)} at ${formatTime(outcome.exitTimestamp)}.`,
  ];

  if (outcome.result === 'BREAKEVEN_STOP') {
    paragraphs.push(
      'Price reached 1R, stop was moved to entry, then price returned to entry level and the stop was triggered.',
    );
  } else if (outcome.result === 'LOSS') {
    paragraphs.push('Price reversed and hit the initial stop level.');
  } else if (outcome.result === 'SESSION_TIMEOUT') {
    paragraphs.push('The 11:00 ET session end arrived before the trade resolved naturally.');
  }

  const keyValues: NarrativeKeyValue[] = [
    { label: 'Result', value: label, type: 'result' },
    { label: 'Realized R', value: formatR(outcome.realizedR), type: 'r-value' },
    { label: 'Exit Price', value: centsToDollars(outcome.exitPrice), type: 'price' },
    { label: 'Exit Time', value: formatTime(outcome.exitTimestamp), type: 'time' },
  ];

  if (outcome.timestampStop) {
    keyValues.push({ label: 'Stop Time', value: formatTime(outcome.timestampStop), type: 'time' });
  }

  return { title: 'Outcome', paragraphs, keyValues };
}

function generateAssessment(data: FullSessionData): NarrativeSection {
  const paragraphs: string[] = [];
  const keyValues: NarrativeKeyValue[] = [];

  if (data.status === 'NO_TRADE') {
    const reason = data.zone?.status === 'NO_TRADE_CHOPPY'
      ? 'choppy zone (price inside zone at 10:00)'
      : data.zone?.status === 'NO_TRADE_DEGENERATE'
        ? 'degenerate zone (spread too narrow/wide)'
        : 'no valid signals generated';
    paragraphs.push(`**No trade session** — ${reason}.`);
    keyValues.push({ label: 'Classification', value: 'No Trade', type: 'result' });
    return { title: 'Assessment', paragraphs, keyValues };
  }

  if (data.trades.length === 0) {
    paragraphs.push('Zone was valid but no break-retest-confirmation sequence completed.');
    keyValues.push({ label: 'Classification', value: 'No Entry', type: 'result' });
    return { title: 'Assessment', paragraphs, keyValues };
  }

  const outcome = data.outcomes[0];
  if (!outcome) {
    paragraphs.push('Trade was opened but no outcome was recorded.');
    keyValues.push({ label: 'Classification', value: 'Incomplete', type: 'result' });
    return { title: 'Assessment', paragraphs, keyValues };
  }

  const failures = data.signals.filter((s) => s.type === 'BREAK_FAILURE').length;

  if (failures === 0 && (outcome.result === 'WIN_2R' || outcome.result === 'WIN_3R')) {
    paragraphs.push('**Clean execution** — first break attempt succeeded with a clear retest and confirmation, leading to a winning outcome.');
    keyValues.push({ label: 'Classification', value: 'Clean Win', type: 'result' });
  } else if (failures > 0 && (outcome.result === 'WIN_2R' || outcome.result === 'WIN_3R')) {
    paragraphs.push(`**Persistent entry** — ${failures} failed break attempt(s) before a successful entry. Patience rewarded with a winning trade.`);
    keyValues.push({ label: 'Classification', value: 'Persistent Win', type: 'result' });
  } else if (outcome.result === 'LOSS') {
    paragraphs.push('**Stop loss** — entry confirmed but price reversed to hit the initial stop.');
    keyValues.push({ label: 'Classification', value: 'Stop Loss', type: 'result' });
  } else if (outcome.result === 'BREAKEVEN_STOP') {
    paragraphs.push('**Breakeven** — reached 1R target (trailing stop moved to entry), then price returned and triggered the stop at entry.');
    keyValues.push({ label: 'Classification', value: 'Breakeven', type: 'result' });
  } else if (outcome.result === 'SESSION_TIMEOUT') {
    paragraphs.push('**Session timeout** — position was still open at the 11:00 ET session end.');
    keyValues.push({ label: 'Classification', value: 'Timeout', type: 'result' });
  }

  if (failures > 0) {
    keyValues.push({ label: 'Break Failures', value: String(failures), type: 'text' });
  }

  return { title: 'Assessment', paragraphs, keyValues };
}

// ── Public API ──────────────────────────────────────────────────────

export function generateNarrative(data: FullSessionData): SessionNarrative {
  return {
    overview: generateOverview(data),
    zoneFormation: generateZoneFormation(data),
    signalSequence: generateSignalSequence(data),
    tradeEntry: generateTradeEntry(data),
    tradeManagement: generateTradeManagement(data),
    outcome: generateOutcome(data),
    assessment: generateAssessment(data),
  };
}
