/**
 * Backtest Job - Async backtest execution tracking
 *
 * Represents a queued or running backtest operation with progress tracking
 * and result storage. Jobs move through states: PENDING → RUNNING → COMPLETED/FAILED.
 */

export type BacktestJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface BacktestJob {
  readonly id: string;                  // UUID
  readonly symbol: string;
  readonly fromDate: string;            // YYYY-MM-DD
  readonly toDate: string;              // YYYY-MM-DD
  readonly presetId: number | null;     // null = use default preset
  readonly status: BacktestJobStatus;
  readonly progressTotal: number;       // Total trading days in range
  readonly progressCurrent: number;     // Completed days (0 to progressTotal)
  readonly resultSummary: string | null; // JSON: { totalR, winRate, trades, ... }
  readonly errorMessage: string | null;
  readonly createdAt: number;           // UTC milliseconds
  readonly startedAt: number | null;    // UTC milliseconds (null if not started)
  readonly completedAt: number | null;  // UTC milliseconds (null if not completed)
}

/**
 * Input for creating a new backtest job (id and timestamps auto-generated)
 */
export interface BacktestJobRequest {
  readonly symbol: string;
  readonly fromDate: string;            // YYYY-MM-DD
  readonly toDate: string;              // YYYY-MM-DD
  readonly presetId?: number;           // Optional - uses default if not specified
}

/**
 * Summary metrics stored in result_summary JSON field
 */
export interface BacktestJobResult {
  readonly totalR: number;              // Total R-multiples across all trades
  readonly winRate: number;             // Percentage (0-100)
  readonly totalTrades: number;
  readonly sessionsCompleted: number;
  readonly errorCount: number;
}
