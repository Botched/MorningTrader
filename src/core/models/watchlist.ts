/**
 * Watchlist Item - Stock ticker for monitoring
 *
 * Represents a stock symbol configured for either manual or automated
 * session execution. Each item can be toggled between mock and real
 * execution modes, and can be scheduled for automated daily runs.
 */
export interface WatchlistItem {
  readonly id: number;
  readonly symbol: string;
  readonly isActive: boolean;           // false = disabled, true = enabled
  readonly isMock: boolean;             // false = real, true = mock execution
  readonly scheduleEnabled: boolean;    // false = manual only, true = auto-scheduled
  readonly createdAt: number;           // UTC milliseconds
  readonly updatedAt: number;           // UTC milliseconds
}

/**
 * Input for creating a new watchlist item (id and timestamps auto-generated)
 */
export interface WatchlistItemInput {
  readonly symbol: string;
  readonly isMock: boolean;
  readonly scheduleEnabled: boolean;
}

/**
 * Partial update for existing watchlist item
 */
export interface WatchlistItemUpdate {
  readonly isActive?: boolean;
  readonly isMock?: boolean;
  readonly scheduleEnabled?: boolean;
}
