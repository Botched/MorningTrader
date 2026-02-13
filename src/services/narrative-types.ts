/**
 * Types for the NarrativeGenerator service.
 *
 * Defines the data structures for transforming raw session data into
 * structured, human-readable narrative sections for the web dashboard.
 */

import type {
  Candle,
  DecisionZone,
  Signal,
  Trade,
  TradeOutcome,
  SessionStatus,
  ExecutionMode,
} from '../core/models/index.js';

// ── Input type ──────────────────────────────────────────────────────

export type FullSessionData = {
  readonly id: number;
  readonly date: string;
  readonly symbol: string;
  readonly status: SessionStatus;
  readonly executionMode: ExecutionMode;
  readonly isBacktest: boolean;
  readonly startedAt: number;
  readonly completedAt: number;
  readonly error: string | null;
  readonly zone: DecisionZone | null;
  readonly signals: readonly Signal[];
  readonly trades: readonly Trade[];
  readonly outcomes: readonly TradeOutcome[];
  readonly bars: readonly Candle[];
};

// ── Output types ────────────────────────────────────────────────────

export type KeyValueType = 'price' | 'time' | 'r-value' | 'result' | 'direction' | 'text';

export type NarrativeKeyValue = {
  readonly label: string;
  readonly value: string;
  readonly type: KeyValueType;
};

export type NarrativeSection = {
  readonly title: string;
  readonly paragraphs: readonly string[];
  readonly keyValues: readonly NarrativeKeyValue[];
};

export type SessionNarrative = {
  readonly overview: NarrativeSection;
  readonly zoneFormation: NarrativeSection;
  readonly signalSequence: NarrativeSection;
  readonly tradeEntry: NarrativeSection | null;
  readonly tradeManagement: NarrativeSection | null;
  readonly outcome: NarrativeSection | null;
  readonly assessment: NarrativeSection;
};
