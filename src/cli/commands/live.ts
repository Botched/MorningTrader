/**
 * Live trading command.
 * morningtrader live <symbol> [--mock] [--dry-run] [--force]
 *
 * Orchestrates a complete live trading session lifecycle:
 *   1. Bootstrap application context (adapters, services)
 *   2. Validate trading schedule (trading day, prior completion)
 *   3. Wait for market open if needed
 *   4. Connect to market data and run the strategy session
 *   5. Persist results and print summary
 *   6. Clean shutdown
 */
import { Command } from 'commander';
import { bootstrapLive, shutdown } from '../../app.js';
import type { AppContext } from '../../app.js';

interface LiveOptions {
  mock?: boolean;
  dryRun?: boolean;
  force?: boolean;
}

export function registerLiveCommand(program: Command): void {
  program
    .command('live')
    .description('Run live trading session for a symbol')
    .argument('<symbol>', 'Stock symbol to trade (e.g., AAPL, SPY)')
    .option('--mock', 'Use mock execution (paper trading with live data)')
    .option('--dry-run', 'No storage writes, no order execution')
    .option('--force', 'Run even if a completed session already exists for today')
    .action(async (symbol: string, options: LiveOptions) => {
      let ctx: AppContext | null = null;

      try {
        // ── 1. Bootstrap application context ──────────────────────
        const upperSymbol = symbol.toUpperCase();

        ctx = await bootstrapLive({
          symbol: upperSymbol,
          mock: options.mock,
          dryRun: options.dryRun,
        });

        const { logger, sessionRunner, scheduler, shutdownManager, storage, reporter, marketData } = ctx;

        // ── 2. Register shutdown handler ──────────────────────────
        shutdownManager.register(() => {
          sessionRunner.stop();
        });
        shutdownManager.listen();

        // ── 3. Determine today's schedule ─────────────────────────
        const today = scheduler.getTodayET();
        const schedule = scheduler.getSchedule(today);

        logger.info(
          {
            date: today,
            symbol: upperSymbol,
            isTradingDay: schedule.isTradingDay,
            isEarlyClose: schedule.isEarlyClose,
            mock: options.mock ?? false,
            dryRun: options.dryRun ?? false,
          },
          'Live session starting',
        );

        // ── 4. Check if it is a trading day ───────────────────────
        if (!schedule.isTradingDay) {
          logger.warn(
            { date: today },
            'Today is not a trading day (weekend or holiday). Session will not run.',
          );
          console.log(`[live] ${today} is not a trading day. Exiting.`);
          await shutdown(ctx);
          return;
        }

        if (schedule.isEarlyClose) {
          logger.info({ date: today }, 'Today is an early-close day');
        }

        // ── 5. Check for existing completed session ───────────────
        if (!options.force && storage.hasCompletedSession(today, upperSymbol)) {
          logger.warn(
            { date: today, symbol: upperSymbol },
            'Completed session already exists. Use --force to run again.',
          );
          console.log(
            `[live] A completed session for ${upperSymbol} on ${today} already exists. Use --force to override.`,
          );
          await shutdown(ctx);
          return;
        }

        // ── 6. Check if session window has already expired ────────
        if (scheduler.isSessionExpired(schedule)) {
          logger.warn(
            { date: today },
            'Execution window has already ended for today.',
          );
          console.log(`[live] Execution window for ${today} has already ended. Exiting.`);
          await shutdown(ctx);
          return;
        }

        // ── 7. Wait for zone start if needed ──────────────────────
        await scheduler.waitForZoneStart(schedule);

        // ── 8. Connect to market data provider ────────────────────
        logger.info('Connecting to market data provider...');
        await marketData.connect();
        logger.info('Market data provider connected');

        // ── 9. Run the trading session ────────────────────────────
        const sessionResult = await sessionRunner.runSession(today, upperSymbol);

        // ── 10. Persist results to storage (unless dry-run) ───────
        if (!options.dryRun) {
          const sessionId = storage.saveSession(sessionResult);

          if (sessionResult.signals.length > 0) {
            storage.saveSignals(sessionResult.signals, sessionId);
          }

          for (let i = 0; i < sessionResult.trades.length; i++) {
            const trade = sessionResult.trades[i];
            const outcome = sessionResult.outcomes[i];
            if (trade && outcome) {
              storage.saveTradeWithOutcome(trade, outcome, sessionId);
            } else if (trade) {
              storage.saveTrade(trade, sessionId);
            }
          }

          logger.info(
            {
              sessionId,
              trades: sessionResult.trades.length,
              signals: sessionResult.signals.length,
            },
            'Session results persisted to storage',
          );
        } else {
          logger.info('Dry-run mode: skipping storage persistence');
        }

        // ── 11. Print summary using reporter ──────────────────────
        const report = reporter.generateReport([sessionResult]);
        reporter.writeOutput(report);

        // ── 12. Clean shutdown ────────────────────────────────────
        await shutdown(ctx);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (ctx) {
          ctx.logger.error({ err }, 'Live session failed');
          try {
            await shutdown(ctx);
          } catch (shutdownErr) {
            ctx.logger.error({ err: shutdownErr }, 'Error during shutdown after failure');
          }
        } else {
          console.error(`[live] Fatal error: ${message}`);
        }
        process.exitCode = 1;
      }
    });
}
