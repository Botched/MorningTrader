/**
 * Config command.
 * morningtrader config [--show] [--validate]
 *
 * Reads and displays the current application configuration from the
 * config JSON file (default: config/default.json). Formats the output
 * as a readable grouped table in the console.
 */
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppConfigSchema, type AppConfig } from '../../core/models/config.js';

// ── Formatting helpers ─────────────────────────────────────────────

const DIVIDER = '─'.repeat(56);
const HEADER_DIVIDER = '═'.repeat(56);

function sectionHeader(title: string): string {
  return `\n  ${title}\n  ${DIVIDER}`;
}

function row(label: string, value: string | number | boolean): string {
  const labelStr = String(label).padEnd(28);
  return `  ${labelStr} ${value}`;
}

// ── Config display ─────────────────────────────────────────────────

function formatConfig(config: AppConfig, configPath: string): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`  ${HEADER_DIVIDER}`);
  lines.push(`  MorningTrader Configuration`);
  lines.push(`  ${HEADER_DIVIDER}`);
  lines.push(row('Config file', configPath));

  // Strategy params
  lines.push(sectionHeader('Strategy'));
  lines.push(row('maxBreakAttempts', config.strategy.maxBreakAttempts));
  lines.push(row('minZoneSpreadCents', config.strategy.minZoneSpreadCents));
  lines.push(row('maxZoneSpreadPercent', `${config.strategy.maxZoneSpreadPercent}%`));
  lines.push(row('barSizeMinutes', config.strategy.barSizeMinutes));
  lines.push(row('minZoneBars', config.strategy.minZoneBars));
  lines.push(row('trailingStopAt1R', config.strategy.trailingStopAt1R));

  // Session windows
  lines.push(sectionHeader('Session Windows'));
  lines.push(row('premarketTime', config.strategy.sessionWindows.premarketTime));
  lines.push(row('zoneStartTime', config.strategy.sessionWindows.zoneStartTime));
  lines.push(row('zoneEndTime', config.strategy.sessionWindows.zoneEndTime));
  lines.push(row('executionEndTime', config.strategy.sessionWindows.executionEndTime));

  // Targets
  lines.push(sectionHeader('Targets'));
  lines.push(row('target1RMultiple', `${config.strategy.targets.target1RMultiple}R`));
  lines.push(row('target2RMultiple', `${config.strategy.targets.target2RMultiple}R`));
  lines.push(row('target3RMultiple', `${config.strategy.targets.target3RMultiple}R`));

  // IBKR connection
  lines.push(sectionHeader('IBKR Connection'));
  lines.push(row('host', config.ibkr.host));
  lines.push(row('port', config.ibkr.port));
  lines.push(row('clientId', config.ibkr.clientId));
  lines.push(row('marketDataType', config.ibkr.marketDataType));

  // Execution
  lines.push(sectionHeader('Execution'));
  lines.push(row('mode', config.execution.mode));
  lines.push(row('defaultQuantity', config.execution.defaultQuantity));

  // Logging
  lines.push(sectionHeader('Logging'));
  lines.push(row('level', config.logging.level));
  lines.push(row('pretty', config.logging.pretty));

  // Storage / paths
  lines.push(sectionHeader('Storage'));
  lines.push(row('dbPath', config.storage.dbPath));

  lines.push('');

  return lines.join('\n');
}

// ── Config loading ─────────────────────────────────────────────────

function loadConfig(configPath: string): AppConfig {
  const absolutePath = resolve(configPath);
  const raw = readFileSync(absolutePath, 'utf-8');
  const json: unknown = JSON.parse(raw);
  return AppConfigSchema.parse(json);
}

// ── Command registration ───────────────────────────────────────────

export function registerConfigCommand(program: Command): void {
  program
    .command('config')
    .description('Show or validate configuration')
    .option('--show', 'Display current configuration')
    .option('--validate', 'Validate configuration file and report errors')
    .action((options: { show?: boolean; validate?: boolean }) => {
      // Resolve config path from the parent program's global --config option
      const configPath: string =
        program.opts<{ config: string }>().config ?? 'config/default.json';

      if (options.validate) {
        try {
          loadConfig(configPath);
          console.log(`Configuration is valid: ${configPath}`);
        } catch (err) {
          console.error(`Configuration validation failed: ${configPath}`);
          if (err instanceof Error) {
            console.error(err.message);
          }
          process.exitCode = 1;
        }
        return;
      }

      if (options.show) {
        try {
          const config = loadConfig(configPath);
          console.log(formatConfig(config, configPath));
        } catch (err) {
          console.error(`Failed to load configuration: ${configPath}`);
          if (err instanceof Error) {
            console.error(err.message);
          }
          process.exitCode = 1;
        }
        return;
      }

      // Default: show help for the config subcommand
      // Access the config Command object through program.commands
      const configCmd = program.commands.find((c) => c.name() === 'config');
      if (configCmd) {
        configCmd.help();
      }
    });
}
