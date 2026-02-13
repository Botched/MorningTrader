/**
 * Services barrel export.
 *
 * Re-exports all public service APIs for convenient single-path imports:
 *   import { createLogger, getChildLogger } from '@services/index.js';
 */

export {
  createLogger,
  getChildLogger,
  type Logger,
  type ModuleName,
  type CreateLoggerOptions,
} from './logger.js';

export {
  ShutdownManager,
  type ShutdownHandler,
} from './shutdown-manager.js';

export {
  Scheduler,
  type SchedulerConfig,
  type SessionSchedule,
} from './scheduler.js';

export {
  Reporter,
  type ReportOptions,
} from './reporter.js';

export {
  SessionRunner,
} from './session-runner.js';

export {
  BacktestRunner,
  type BacktestOptions,
  type BacktestResult,
} from './backtest-runner.js';
