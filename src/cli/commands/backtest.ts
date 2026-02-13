/**
 * Backtest command.
 * morningtrader backtest <symbol> --from <date> --to <date> [--source <type>]
 *
 * Runs historical backtesting across a date range by replaying CSV (or IBKR)
 * bar data through the strategy engine. Prints a performance summary on
 * completion and optionally persists results to storage.
 */
import { Command, Option } from 'commander';
import { bootstrapBacktest, shutdown } from '../../app.js';
import { BacktestRunner } from '../../services/backtest-runner.js';
import { Reporter } from '../../services/reporter.js';
import type { BacktestResult } from '../../services/backtest-runner.js';

// ---------------------------------------------------------------------------
// Date validation helper
// ---------------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate that a string matches YYYY-MM-DD format and represents a real
 * calendar date.
 */
function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

// ---------------------------------------------------------------------------
// Options interface
// ---------------------------------------------------------------------------

interface BacktestCommandOptions {
  from: string;
  to: string;
  source: 'csv' | 'ibkr';
  csvDir: string;
  force?: boolean;
  persist: boolean;     // Commander inverts --no-persist into persist=false
  config?: string;
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerBacktestCommand(program: Command): void {
  program
    .command('backtest')
    .description('Run historical backtest for a symbol')
    .argument('<symbol>', 'Stock symbol to backtest (e.g., AAPL, SPY)')
    .requiredOption('--from <date>', 'Start date (YYYY-MM-DD)')
    .requiredOption('--to <date>', 'End date (YYYY-MM-DD)')
    .addOption(
      new Option('--source <type>', 'Data source type')
        .choices(['csv', 'ibkr'])
        .default('csv'),
    )
    .option('--csv-dir <path>', 'Directory containing CSV files', 'tests/fixtures/bars')
    .option('--force', 'Re-run already completed sessions')
    .option('--no-persist', 'Skip saving results to storage')
    .option('--config <path>', 'Custom config file path')
    .action(async (symbol: string, options: BacktestCommandOptions) => {
      await runBacktestCommand(symbol, options);
    });
}

// ---------------------------------------------------------------------------
// Command implementation
// ---------------------------------------------------------------------------

async function runBacktestCommand(
  symbol: string,
  options: BacktestCommandOptions,
): Promise<void> {
  // 1. Validate date format
  if (!isValidDate(options.from)) {
    console.error(`Error: Invalid --from date "${options.from}". Expected YYYY-MM-DD.`);
    process.exitCode = 1;
    return;
  }

  if (!isValidDate(options.to)) {
    console.error(`Error: Invalid --to date "${options.to}". Expected YYYY-MM-DD.`);
    process.exitCode = 1;
    return;
  }

  if (options.from > options.to) {
    console.error(`Error: --from date "${options.from}" must not be after --to date "${options.to}".`);
    process.exitCode = 1;
    return;
  }

  // 2. Bootstrap the backtest context
  let ctx: Awaited<ReturnType<typeof bootstrapBacktest>>;
  try {
    ctx = await bootstrapBacktest({
      persist: options.persist,
      source: options.source,
    });
  } catch (err) {
    if (options.source === 'ibkr') {
      console.error(`\nError: Failed to connect to IBKR TWS/Gateway.`);
      console.error(`Make sure TWS or IB Gateway is running and configured in config/default.json.`);
      console.error(`Details: ${err instanceof Error ? err.message : String(err)}`);
    } else {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
    process.exitCode = 1;
    return;
  }

  try {
    // 3. Create BacktestRunner with context components
    const runner = new BacktestRunner(
      ctx.logger,
      ctx.config.strategy,
      ctx.calendar,
      options.persist ? ctx.storage : undefined,
      options.source === 'ibkr' ? ctx.ibkrAdapter : undefined,
    );

    // 4. Run backtest
    console.log(`\nRunning backtest for ${symbol.toUpperCase()} from ${options.from} to ${options.to}`);
    console.log(`  Source: ${options.source}`);
    console.log(`  CSV dir: ${options.csvDir}`);
    console.log(`  Persist: ${options.persist}`);
    console.log(`  Force: ${options.force ?? false}\n`);

    if (options.source === 'ibkr') {
      console.log('  Connecting to IBKR TWS/Gateway...');
    }

    const result: BacktestResult = await runner.runBacktest({
      symbol: symbol.toUpperCase(),
      fromDate: options.from,
      toDate: options.to,
      source: options.source,
      csvDir: options.csvDir,
      persist: options.persist,
      force: options.force ?? false,
    });

    // 5. Print performance report using Reporter
    const reporter = new Reporter();
    const summary = reporter.formatConsoleSummary(result.metrics, result.sessions.length);
    console.log('');
    console.log(summary);

    // 6. Print additional stats
    console.log('');
    console.log('--- Backtest Summary ---');
    console.log(`Total days in range: ${result.totalDays}`);
    console.log(`Trading days:        ${result.tradingDays}`);
    console.log(`Sessions completed:  ${result.sessions.length}`);
    console.log(`Skipped dates:       ${result.skippedDates.length}`);
    console.log(`Error dates:         ${result.errorDates.length}`);

    if (result.errorDates.length > 0) {
      console.log('');
      console.log('Errors:');
      for (const err of result.errorDates) {
        console.log(`  ${err.date}: ${err.error}`);
      }
    }

    console.log('');
  } finally {
    // 7. Clean shutdown
    await shutdown(ctx);
  }
}
