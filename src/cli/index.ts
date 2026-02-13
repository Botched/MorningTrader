#!/usr/bin/env node

/**
 * MorningTrader CLI - First Candle Strategy IBKR Trading Tool
 *
 * Entry point for the Commander.js CLI framework.
 * Sets up all subcommands, global options, and error handling.
 */
import { Command, Option } from 'commander';
import {
  registerLiveCommand,
  registerBacktestCommand,
  registerReportCommand,
  registerExportCommand,
  registerConfigCommand,
  registerDashboardCommand,
} from './commands/index.js';

// Re-export Dashboard for programmatic use
export { Dashboard } from './dashboard.js';

const VERSION = '0.1.0';

/**
 * Creates and configures the Commander program with all subcommands
 * and global options. Exported for testing and programmatic use.
 */
export function createProgram(): Command {
  const program = new Command();

  // ── Program metadata ──────────────────────────────────────────
  program
    .name('morningtrader')
    .version(VERSION, '-V, --version', 'Output the current version')
    .description('First Candle Strategy IBKR Trading Tool');

  // ── Global options ────────────────────────────────────────────
  program.option(
    '--config <path>',
    'Path to config file',
    'config/default.json'
  );

  program.option(
    '--verbose',
    'Enable verbose logging'
  );

  program.addOption(
    new Option('--log-level <level>', 'Log level')
      .choices(['debug', 'info', 'warn', 'error'])
      .default('info')
  );

  // ── Register subcommands ──────────────────────────────────────
  registerLiveCommand(program);
  registerBacktestCommand(program);
  registerReportCommand(program);
  registerExportCommand(program);
  registerConfigCommand(program);
  registerDashboardCommand(program);

  // ── Error handling ────────────────────────────────────────────
  // Show suggestions for unknown commands (e.g., "did you mean 'live'?")
  program.showSuggestionAfterError(true);
  program.showHelpAfterError(true);

  // Handle unknown commands explicitly via the command:* event.
  // This fires when a non-registered command name is provided.
  program.on('command:*', (operands: string[]) => {
    console.error(`error: unknown command '${operands[0]}'`);
    const availableCommands = program.commands.map((cmd) => cmd.name());
    console.error(`Available commands: ${availableCommands.join(', ')}`);
    process.exitCode = 1;
  });

  return program;
}

/** The configured Commander program instance. */
export const program = createProgram();

// ── Run CLI when executed directly ────────────────────────────────
// Detect if this module is the entry point (bin execution).
// In ESM, there is no require.main; we check process.argv against
// the current module's file path.
const argPath = process.argv[1]
  ? process.argv[1].replace(/\\/g, '/')
  : '';

const isDirectExecution =
  argPath.endsWith('/cli/index.js') ||
  argPath.endsWith('/morningtrader');

if (isDirectExecution) {
  program.parse(process.argv);
}
