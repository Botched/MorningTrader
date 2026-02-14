// API response types mirroring backend serializers

export interface OverviewStats {
  totalSessions: number;
  sessionsWithTrades: number;
  totalTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  timeouts: number;
  winRate: number;
  profitFactor: number;
  totalR: number;
  avgR: number;
  maxFavorableR: number;
  maxAdverseR: number;
}

export interface EquityCurvePoint {
  date: string;
  cumulative_r: number;
}

export interface OverviewResponse {
  stats: OverviewStats;
  equityCurve: EquityCurvePoint[];
}

export interface SessionListItem {
  id: number;
  date: string;
  symbol: string;
  status: string;
  zoneResistance: number | null;
  zoneSupport: number | null;
  zoneStatus: string | null;
  executionMode: string;
  isBacktest: boolean;
  direction: string | null;
  result: string | null;
  realizedR: number | null;
}

export interface SessionsListResponse {
  sessions: SessionListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Bar {
  timestamp: number;
  time: string | null;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Signal {
  direction: string;
  type: string;
  timestamp: number;
  time: string | null;
  price: number;
  attemptNumber: number;
}

export interface Trade {
  id: string;
  symbol: string;
  direction: string;
  entryPrice: number;
  initialStop: number;
  currentStop: number;
  rValue: number;
  target1R: number;
  target2R: number;
  target3R: number;
  entryTimestamp: number;
  entryTime: string | null;
  status: string;
}

export interface Outcome {
  tradeId: string;
  result: string;
  maxFavorableR: number;
  maxAdverseR: number;
  exitPrice: number;
  exitTimestamp: number;
  exitTime: string | null;
  realizedR: number;
  firstThresholdReached: number;
  timestamp1R: number;
  timestamp2R: number;
  timestamp3R: number;
  timestampStop: number;
  barsHeld: number;
}

export interface SessionDetailResponse {
  session: {
    id: number;
    date: string;
    symbol: string;
    status: string;
    zoneResistance: number | null;
    zoneSupport: number | null;
    zoneStatus: string | null;
    executionMode: string;
    isBacktest: boolean;
    error: string | null;
  };
  trades: Trade[];
  signals: Signal[];
  bars: Bar[];
  outcomes: Outcome[];
}

export interface NarrativeKeyValue {
  label: string;
  value: string;
  type: 'price' | 'time' | 'r-value' | 'result' | 'direction' | 'text';
}

export interface NarrativeSection {
  title: string;
  paragraphs: readonly string[];
  keyValues: readonly NarrativeKeyValue[];
}

export interface SessionNarrative {
  overview: NarrativeSection;
  zoneFormation: NarrativeSection;
  signalSequence: NarrativeSection;
  tradeEntry: NarrativeSection | null;
  tradeManagement: NarrativeSection | null;
  outcome: NarrativeSection | null;
  assessment: NarrativeSection;
}

export interface DailyStatsResponse {
  dailyStats: Array<{
    date: string;
    totalTrades: number;
    wins: number;
    losses: number;
    totalR: number;
    avgR: number;
  }>;
}

export interface SymbolsResponse {
  symbols: string[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Config Presets
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ConfigPreset {
  id: number;
  name: string;
  isDefault: boolean;
  maxBreakAttempts: number;
  minZoneSpreadCents: number;
  maxZoneSpreadPercent: number;
  minZoneBars: number;
  premarketTime: string;
  zoneStartTime: string;
  zoneEndTime: string;
  executionEndTime: string;
  target1RMultiple: number;
  target2RMultiple: number;
  target3RMultiple: number;
  trailingStopAt1R: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateConfigPresetRequest {
  name: string;
  maxBreakAttempts?: number;
  minZoneSpreadCents?: number;
  maxZoneSpreadPercent?: number;
  minZoneBars?: number;
  premarketTime?: string;
  zoneStartTime?: string;
  zoneEndTime?: string;
  executionEndTime?: string;
  target1RMultiple?: number;
  target2RMultiple?: number;
  target3RMultiple?: number;
  trailingStopAt1R?: boolean;
}

export interface UpdateConfigPresetRequest {
  name?: string;
  maxBreakAttempts?: number;
  minZoneSpreadCents?: number;
  maxZoneSpreadPercent?: number;
  minZoneBars?: number;
  premarketTime?: string;
  zoneStartTime?: string;
  zoneEndTime?: string;
  executionEndTime?: string;
  target1RMultiple?: number;
  target2RMultiple?: number;
  target3RMultiple?: number;
  trailingStopAt1R?: boolean;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Backtest Jobs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type BacktestJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface BacktestJob {
  id: string;
  symbol: string;
  fromDate: string;
  toDate: string;
  presetId: number | null;
  status: BacktestJobStatus;
  progress: {
    current: number;
    total: number;
    percent: number;
  };
  result: {
    totalR: number;
    winRate: number;
    totalTrades: number;
    sessionsCompleted: number;
    errorCount: number;
  } | null;
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
}

export interface SubmitBacktestJobRequest {
  symbol: string;
  fromDate: string;
  toDate: string;
  presetId?: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Watchlist
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface WatchlistItem {
  id: number;
  symbol: string;
  isActive: boolean;
  isMock: boolean;
  scheduleEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateWatchlistItemRequest {
  symbol: string;
  isMock: boolean;
  scheduleEnabled: boolean;
}

export interface UpdateWatchlistItemRequest {
  isActive?: boolean;
  isMock?: boolean;
  scheduleEnabled?: boolean;
}
