/**
 * Report command.
 * morningtrader report --period weekly [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--symbol AAPL]
 *
 * Shows trading performance summaries for different time periods.
 * The actual storage/reporter wiring will be done in app bootstrap T057.
 */
import { Command, Option } from 'commander';

// ── Types ──────────────────────────────────────────────────────────

interface ReportOptions {
  period: 'daily' | 'weekly' | 'monthly' | 'custom';
  from?: string;
  to?: string;
  symbol?: string;
}

interface ResolvedReportOptions {
  period: 'daily' | 'weekly' | 'monthly' | 'custom';
  from: string;
  to: string;
  symbol?: string;
}

// ── Date helpers ───────────────────────────────────────────────────

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validateDate(dateStr: string): boolean {
  if (!DATE_REGEX.test(dateStr)) {
    return false;
  }
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayDate(): string {
  return formatDate(new Date());
}

function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDate(date);
}

// ── Option resolution ──────────────────────────────────────────────

function resolveDateRange(options: ReportOptions): ResolvedReportOptions {
  const today = getTodayDate();

  // Determine date range based on period
  switch (options.period) {
    case 'daily': {
      return {
        period: 'daily',
        from: today,
        to: today,
        symbol: options.symbol,
      };
    }

    case 'weekly': {
      return {
        period: 'weekly',
        from: getDateDaysAgo(7),
        to: today,
        symbol: options.symbol,
      };
    }

    case 'monthly': {
      return {
        period: 'monthly',
        from: getDateDaysAgo(30),
        to: today,
        symbol: options.symbol,
      };
    }

    case 'custom': {
      // Custom period requires --from, --to is optional (defaults to today)
      if (!options.from) {
        console.error('Error: --from is required when period is "custom"');
        process.exitCode = 1;
        throw new Error('Missing required --from option for custom period');
      }

      if (!validateDate(options.from)) {
        console.error(`Error: Invalid date format for --from: ${options.from}`);
        console.error('Expected format: YYYY-MM-DD');
        process.exitCode = 1;
        throw new Error('Invalid --from date format');
      }

      const to = options.to ?? today;
      if (!validateDate(to)) {
        console.error(`Error: Invalid date format for --to: ${to}`);
        console.error('Expected format: YYYY-MM-DD');
        process.exitCode = 1;
        throw new Error('Invalid --to date format');
      }

      return {
        period: 'custom',
        from: options.from,
        to,
        symbol: options.symbol,
      };
    }
  }
}

// ── Command registration ───────────────────────────────────────────

export function registerReportCommand(program: Command): void {
  program
    .command('report')
    .description('Generate trading performance report')
    .addOption(
      new Option('--period <period>', 'Report period')
        .choices(['daily', 'weekly', 'monthly', 'custom'])
        .makeOptionMandatory(),
    )
    .option('--from <date>', 'Start date (YYYY-MM-DD, required for custom period)')
    .option('--to <date>', 'End date (YYYY-MM-DD, defaults to today)')
    .option('--symbol <symbol>', 'Filter by symbol (optional)')
    .action((options: ReportOptions) => {
      try {
        // Resolve the date range based on the period
        const resolved = resolveDateRange(options);

        // Print placeholder message
        const symbolDisplay = resolved.symbol ?? 'all';
        console.log(
          `Report: ${symbolDisplay} from ${resolved.from} to ${resolved.to} (period: ${resolved.period})`,
        );

        // Store resolved options for future use by session runner
        // When wired up in T057, this will be used to fetch data from storage
        // and generate the actual report using the Reporter service
      } catch (err) {
        // Error already handled in resolveDateRange
        // process.exitCode already set to 1
        return;
      }
    });
}
