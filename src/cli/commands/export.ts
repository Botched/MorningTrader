/**
 * Export command.
 * morningtrader export --format csv --output trades.csv [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--symbol AAPL]
 *
 * Exports trade data to CSV or JSON format with optional date range and symbol filtering.
 */
import { Command } from 'commander';

// ── Date validation ────────────────────────────────────────────────

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validateDateFormat(date: string): boolean {
  return DATE_REGEX.test(date);
}

function getDefaultFromDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().split('T')[0];
}

function getDefaultToDate(): string {
  const date = new Date();
  return date.toISOString().split('T')[0];
}

// ── Command registration ───────────────────────────────────────────

export function registerExportCommand(program: Command): void {
  program
    .command('export')
    .description('Export trade data to CSV or JSON')
    .requiredOption('--format <format>', 'Output format: csv or json')
    .requiredOption('--output <path>', 'Output file path')
    .option('--from <date>', 'Start date (YYYY-MM-DD, defaults to 30 days ago)')
    .option('--to <date>', 'End date (YYYY-MM-DD, defaults to today)')
    .option('--symbol <symbol>', 'Filter by symbol (optional)')
    .action((options: { format: string; output: string; from?: string; to?: string; symbol?: string }) => {
      // Validate format
      if (options.format !== 'csv' && options.format !== 'json') {
        console.error(`Invalid format: ${options.format}. Must be 'csv' or 'json'.`);
        process.exitCode = 1;
        return;
      }

      // Resolve date defaults
      const fromDate = options.from ?? getDefaultFromDate();
      const toDate = options.to ?? getDefaultToDate();

      // Validate date formats
      if (!validateDateFormat(fromDate)) {
        console.error(`Invalid from date format: ${fromDate}. Expected YYYY-MM-DD.`);
        process.exitCode = 1;
        return;
      }

      if (!validateDateFormat(toDate)) {
        console.error(`Invalid to date format: ${toDate}. Expected YYYY-MM-DD.`);
        process.exitCode = 1;
        return;
      }

      // Store resolved options (will be used in T057)
      const resolvedOptions = {
        format: options.format,
        output: options.output,
        from: fromDate,
        to: toDate,
        symbol: options.symbol,
      };

      // Print placeholder message
      console.log(
        `Export: ${resolvedOptions.format} -> ${resolvedOptions.output} ` +
        `(${resolvedOptions.from} to ${resolvedOptions.to}, symbol: ${resolvedOptions.symbol ?? 'all'})`
      );
    });
}
