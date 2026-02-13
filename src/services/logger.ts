/**
 * MorningTrader - Structured Logging Service (Pino)
 *
 * Provides a root logger and child logger factory for each application module.
 * All log output is structured JSON in production and human-readable via
 * pino-pretty in development.
 *
 * SECURITY NOTE:
 * -----------------------------------------------------------------------
 * Account numbers, credentials, API keys, tokens, passwords, and any other
 * sensitive data MUST NEVER be passed to the logger. Callers are responsible
 * for sanitizing or omitting sensitive fields before logging. This includes
 * but is not limited to:
 *   - IBKR account IDs / numbers
 *   - IBKR client credentials or connection passwords
 *   - Any authentication tokens or secrets
 * -----------------------------------------------------------------------
 */

import pino from 'pino';
import type { Logger as PinoLogger } from 'pino';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Re-export Pino's Logger type for convenience so consumers do not need
 * to import pino directly.
 */
export type Logger = PinoLogger;

/**
 * Valid module names that can create child loggers.
 * Each child logger will have a `module` field in its output.
 */
export type ModuleName =
  | 'ibkr'
  | 'strategy'
  | 'storage'
  | 'cli'
  | 'scheduler'
  | 'backtest'
  | 'risk';

/**
 * Options accepted by the root logger factory.
 */
export interface CreateLoggerOptions {
  /** Log level threshold. Defaults to 'info'. */
  level?: string;
  /** When true, pipe output through pino-pretty for human-readable logs. */
  pretty?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_LOG_LEVEL = 'info';
const SERVICE_NAME = 'morningtrader';

// ---------------------------------------------------------------------------
// Factory Functions
// ---------------------------------------------------------------------------

/**
 * Create a root Pino logger instance.
 *
 * @param options.level  - Minimum log level (default: 'info')
 * @param options.pretty - Use pino-pretty transport for development (default: false)
 * @returns A configured Pino Logger instance
 *
 * @example
 * ```ts
 * const logger = createLogger({ level: 'debug', pretty: true });
 * logger.info('Application started');
 * ```
 */
export function createLogger(options?: CreateLoggerOptions): Logger {
  const level = options?.level ?? DEFAULT_LOG_LEVEL;
  const pretty = options?.pretty ?? false;

  const baseOptions: pino.LoggerOptions = {
    level,
    base: { service: SERVICE_NAME },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (pretty) {
    // Use pino-pretty as a transport for human-readable development output.
    // pino-pretty is a peer/optional dependency -- it must be installed
    // (it is listed in package.json dependencies for this project).
    return pino({
      ...baseOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-MM-dd HH:mm:ss.l',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  // Production: structured JSON to stdout (default pino behaviour).
  return pino(baseOptions);
}

/**
 * Create a child logger scoped to a specific application module.
 *
 * The child logger inherits all configuration from its parent and adds
 * a `module` field to every log entry so log consumers can filter by
 * module name.
 *
 * @param parent - The parent Pino logger (typically the root logger)
 * @param module - The module identifier (e.g. 'ibkr', 'strategy', 'storage')
 * @returns A child Pino Logger with the module binding
 *
 * @example
 * ```ts
 * const root = createLogger();
 * const ibkrLog = getChildLogger(root, 'ibkr');
 * ibkrLog.info({ symbol: 'AAPL' }, 'Subscribing to bars');
 * // => {"level":30,"time":"...","service":"morningtrader","module":"ibkr","symbol":"AAPL","msg":"Subscribing to bars"}
 * ```
 */
export function getChildLogger(parent: Logger, module: ModuleName): Logger {
  return parent.child({ module });
}
