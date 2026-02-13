/**
 * CLI Smoke Tests
 *
 * Verifies that the Commander.js CLI program can be created, all commands
 * are registered correctly, options are parsed, and help text is generated.
 *
 * These tests do NOT run live sessions, connect to IBKR, or perform any
 * real trading. They only verify CLI structure and parsing.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import type { Command } from 'commander';

// ---------------------------------------------------------------------------
// Mock heavy dependencies so the CLI module tree can be imported without
// needing real IBKR connections, databases, or service infrastructure.
// ---------------------------------------------------------------------------

vi.mock('../../src/app.js', () => ({
  bootstrapLive: vi.fn(),
  bootstrapBacktest: vi.fn(),
  shutdown: vi.fn(),
}));

vi.mock('../../src/services/backtest-runner.js', () => ({
  BacktestRunner: vi.fn(),
}));

vi.mock('../../src/services/reporter.js', () => ({
  Reporter: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import after mocks are in place
// ---------------------------------------------------------------------------

const { createProgram } = await import('../../src/cli/index.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get a subcommand by name from the program. */
function findCommand(program: Command, name: string): Command | undefined {
  return program.commands.find((c) => c.name() === name);
}

/** Get long option names (e.g., '--mock') from a command. */
function getOptionLongs(cmd: Command): string[] {
  return cmd.options.map((o) => o.long ?? '');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CLI Smoke Tests', () => {
  let program: Command;

  beforeAll(() => {
    program = createProgram();
  });

  // ── Program creation ────────────────────────────────────────────

  it('creates Commander program without errors', () => {
    expect(program).toBeDefined();
    expect(program.name()).toBe('morningtrader');
  });

  it('program has correct version', () => {
    // Commander stores version in _version or via version()
    expect(program.version()).toBe('0.1.0');
  });

  it('program has description', () => {
    expect(program.description()).toBe('First Candle Strategy IBKR Trading Tool');
  });

  // ── Command registration ────────────────────────────────────────

  it('registers all expected commands', () => {
    const commandNames = program.commands.map((c) => c.name());
    expect(commandNames).toContain('live');
    expect(commandNames).toContain('backtest');
    expect(commandNames).toContain('report');
    expect(commandNames).toContain('export');
    expect(commandNames).toContain('config');
  });

  it('registers exactly 5 commands', () => {
    expect(program.commands).toHaveLength(5);
  });

  // ── Global options ──────────────────────────────────────────────

  it('program has global --config option', () => {
    const optionLongs = getOptionLongs(program);
    expect(optionLongs).toContain('--config');
  });

  it('program has global --verbose option', () => {
    const optionLongs = getOptionLongs(program);
    expect(optionLongs).toContain('--verbose');
  });

  it('program has global --log-level option', () => {
    const optionLongs = getOptionLongs(program);
    expect(optionLongs).toContain('--log-level');
  });

  // ── live command ────────────────────────────────────────────────

  describe('live command', () => {
    it('exists and has correct description', () => {
      const cmd = findCommand(program, 'live');
      expect(cmd).toBeDefined();
      expect(cmd!.description()).toBe('Run live trading session for a symbol');
    });

    it('requires a <symbol> argument', () => {
      const cmd = findCommand(program, 'live')!;
      const args = cmd.registeredArguments;
      expect(args).toHaveLength(1);
      expect(args[0].name()).toBe('symbol');
      expect(args[0].required).toBe(true);
    });

    it('has --mock option', () => {
      const cmd = findCommand(program, 'live')!;
      expect(getOptionLongs(cmd)).toContain('--mock');
    });

    it('has --dry-run option', () => {
      const cmd = findCommand(program, 'live')!;
      expect(getOptionLongs(cmd)).toContain('--dry-run');
    });

    it('has --force option', () => {
      const cmd = findCommand(program, 'live')!;
      expect(getOptionLongs(cmd)).toContain('--force');
    });
  });

  // ── backtest command ────────────────────────────────────────────

  describe('backtest command', () => {
    it('exists and has correct description', () => {
      const cmd = findCommand(program, 'backtest');
      expect(cmd).toBeDefined();
      expect(cmd!.description()).toBe('Run historical backtest for a symbol');
    });

    it('requires a <symbol> argument', () => {
      const cmd = findCommand(program, 'backtest')!;
      const args = cmd.registeredArguments;
      expect(args).toHaveLength(1);
      expect(args[0].name()).toBe('symbol');
      expect(args[0].required).toBe(true);
    });

    it('has --from option', () => {
      const cmd = findCommand(program, 'backtest')!;
      expect(getOptionLongs(cmd)).toContain('--from');
    });

    it('has --to option', () => {
      const cmd = findCommand(program, 'backtest')!;
      expect(getOptionLongs(cmd)).toContain('--to');
    });

    it('has --source option', () => {
      const cmd = findCommand(program, 'backtest')!;
      expect(getOptionLongs(cmd)).toContain('--source');
    });

    it('has --csv-dir option', () => {
      const cmd = findCommand(program, 'backtest')!;
      expect(getOptionLongs(cmd)).toContain('--csv-dir');
    });

    it('has --force option', () => {
      const cmd = findCommand(program, 'backtest')!;
      expect(getOptionLongs(cmd)).toContain('--force');
    });

    it('has --no-persist option (Commander stores as --persist negated)', () => {
      const cmd = findCommand(program, 'backtest')!;
      // Commander represents --no-persist as a boolean option with long '--no-persist'
      // but stores it internally as --persist with negate
      const flags = cmd.options.map((o) => o.flags);
      const hasNoPersist = flags.some((f) => f.includes('--no-persist'));
      expect(hasNoPersist).toBe(true);
    });

    it('has --config option', () => {
      const cmd = findCommand(program, 'backtest')!;
      expect(getOptionLongs(cmd)).toContain('--config');
    });
  });

  // ── report command ──────────────────────────────────────────────

  describe('report command', () => {
    it('exists and has correct description', () => {
      const cmd = findCommand(program, 'report');
      expect(cmd).toBeDefined();
      expect(cmd!.description()).toBe('Generate trading performance report');
    });

    it('has no required arguments', () => {
      const cmd = findCommand(program, 'report')!;
      expect(cmd.registeredArguments).toHaveLength(0);
    });

    it('has --period option', () => {
      const cmd = findCommand(program, 'report')!;
      expect(getOptionLongs(cmd)).toContain('--period');
    });

    it('has --from option', () => {
      const cmd = findCommand(program, 'report')!;
      expect(getOptionLongs(cmd)).toContain('--from');
    });

    it('has --to option', () => {
      const cmd = findCommand(program, 'report')!;
      expect(getOptionLongs(cmd)).toContain('--to');
    });

    it('has --symbol option', () => {
      const cmd = findCommand(program, 'report')!;
      expect(getOptionLongs(cmd)).toContain('--symbol');
    });
  });

  // ── export command ──────────────────────────────────────────────

  describe('export command', () => {
    it('exists and has correct description', () => {
      const cmd = findCommand(program, 'export');
      expect(cmd).toBeDefined();
      expect(cmd!.description()).toBe('Export trade data to CSV or JSON');
    });

    it('has no required arguments', () => {
      const cmd = findCommand(program, 'export')!;
      expect(cmd.registeredArguments).toHaveLength(0);
    });

    it('has --format option', () => {
      const cmd = findCommand(program, 'export')!;
      expect(getOptionLongs(cmd)).toContain('--format');
    });

    it('has --output option', () => {
      const cmd = findCommand(program, 'export')!;
      expect(getOptionLongs(cmd)).toContain('--output');
    });

    it('has --from option', () => {
      const cmd = findCommand(program, 'export')!;
      expect(getOptionLongs(cmd)).toContain('--from');
    });

    it('has --to option', () => {
      const cmd = findCommand(program, 'export')!;
      expect(getOptionLongs(cmd)).toContain('--to');
    });

    it('has --symbol option', () => {
      const cmd = findCommand(program, 'export')!;
      expect(getOptionLongs(cmd)).toContain('--symbol');
    });
  });

  // ── config command ──────────────────────────────────────────────

  describe('config command', () => {
    it('exists and has correct description', () => {
      const cmd = findCommand(program, 'config');
      expect(cmd).toBeDefined();
      expect(cmd!.description()).toBe('Show or validate configuration');
    });

    it('has no required arguments', () => {
      const cmd = findCommand(program, 'config')!;
      expect(cmd.registeredArguments).toHaveLength(0);
    });

    it('has --show option', () => {
      const cmd = findCommand(program, 'config')!;
      expect(getOptionLongs(cmd)).toContain('--show');
    });

    it('has --validate option', () => {
      const cmd = findCommand(program, 'config')!;
      expect(getOptionLongs(cmd)).toContain('--validate');
    });
  });

  // ── Help text generation ────────────────────────────────────────

  describe('help text', () => {
    it('program generates help text containing all command names', () => {
      const helpText = program.helpInformation();
      expect(helpText).toContain('morningtrader');
      expect(helpText).toContain('live');
      expect(helpText).toContain('backtest');
      expect(helpText).toContain('report');
      expect(helpText).toContain('export');
      expect(helpText).toContain('config');
    });

    it('program help text contains global options', () => {
      const helpText = program.helpInformation();
      expect(helpText).toContain('--config');
      expect(helpText).toContain('--verbose');
      expect(helpText).toContain('--log-level');
    });

    it('program help text contains version flag', () => {
      const helpText = program.helpInformation();
      expect(helpText).toContain('--version');
    });

    it('live command generates help text', () => {
      const cmd = findCommand(program, 'live')!;
      const helpText = cmd.helpInformation();
      expect(helpText).toContain('live');
      expect(helpText).toContain('<symbol>');
      expect(helpText).toContain('--mock');
      expect(helpText).toContain('--dry-run');
      expect(helpText).toContain('--force');
    });

    it('backtest command generates help text', () => {
      const cmd = findCommand(program, 'backtest')!;
      const helpText = cmd.helpInformation();
      expect(helpText).toContain('backtest');
      expect(helpText).toContain('<symbol>');
      expect(helpText).toContain('--from');
      expect(helpText).toContain('--to');
      expect(helpText).toContain('--source');
    });
  });
});
