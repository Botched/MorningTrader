# MorningTrader Training Guide

A complete guide to using MorningTrader — the First 30-Minute Candle Decision Zone strategy tool for Interactive Brokers.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Installation & Setup](#2-installation--setup)
3. [Understanding the Strategy](#3-understanding-the-strategy)
4. [Configuration](#4-configuration)
5. [CLI Commands](#5-cli-commands)
6. [Live Trading](#6-live-trading)
7. [Backtesting](#7-backtesting)
8. [Reports & Exports](#8-reports--exports)
9. [Dashboard Display](#9-dashboard-display)
10. [Data Models Reference](#10-data-models-reference)
11. [Database & Storage](#11-database--storage)
12. [CSV Fixture Format](#12-csv-fixture-format)
13. [Logging](#13-logging)
14. [Troubleshooting](#14-troubleshooting)
15. [Glossary](#15-glossary)

---

## 1. Overview

MorningTrader implements the **First 30-Minute Candle Decision Zone** strategy. It connects to Interactive Brokers TWS/Gateway, defines a Decision Zone from the first 30 minutes of market trading (09:30-10:00 ET), then monitors for breakout-retest-confirmation entries during the 10:00-11:00 ET execution window.

### What It Does

- Builds a "Decision Zone" from the first 30 minutes of 5-minute bars
- Monitors for breakouts above resistance (LONG) or below support (SHORT)
- Requires a break-retest-confirmation sequence before entry
- Manages positions with R-based targets (1R, 2R, 3R) and trailing stops
- Tracks every signal, trade, and outcome in a SQLite database
- Supports live trading, paper/mock trading, and historical backtesting

### Key Design Principles

- **All prices stored as integer cents** — $500.25 is stored as `50025` to avoid floating-point errors
- **All timestamps in UTC milliseconds** — timezone handling uses `@date-fns/tz` for DST safety
- **Same strategy engine for live and backtest** — the XState state machine is shared across all modes

---

## 2. Installation & Setup

### Prerequisites

- Node.js 20 or later
- Interactive Brokers TWS or IB Gateway (for live/paper trading)
- npm

### Install Dependencies

```bash
npm install
```

### Build the Project

```bash
npm run build
```

### Verify Installation

```bash
# Type-check without emitting
npx tsc --noEmit

# Run all tests
npm test

# Run unit tests only
npm run test:unit
```

### Available npm Scripts

| Script | Purpose |
|--------|---------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm test` | Run all tests |
| `npm run test:unit` | Run unit tests only |
| `npm run test:integration` | Run integration tests only |
| `npm run test:e2e` | Run end-to-end tests only |
| `npm run lint` | Check code style with ESLint |
| `npm run format` | Auto-format code with Prettier |

### IBKR Connection Setup

1. Open TWS or IB Gateway
2. Go to **Edit > Global Configuration > API > Settings**
3. Enable **"Enable ActiveX and Socket Clients"**
4. Note the **Socket Port** (default: 7497 for TWS, 4001 for Gateway)
5. Set the port in `config/default.json` under `ibkr.port`

---

## 3. Understanding the Strategy

### Session Timeline

```
 09:00 ET        09:30 ET              10:00 ET                     11:00 ET
    |               |                     |                            |
    |  Premarket    |   Zone Formation    |     Execution Window       |
    |               |   (6 five-min bars) |     (monitor & trade)      |
    |               |                     |                            |
                    |<-- Build Zone ----->|<--- Trade if valid zone -->|
```

### Step 1: Zone Formation (09:30-10:00 ET)

During the first 30 minutes of market trading, the system collects 5-minute bars and builds a **Decision Zone**:

- **Resistance** = Highest HIGH across all zone bars
- **Support** = Lowest LOW across all zone bars
- **Spread** = Resistance - Support

### Step 2: Zone Validation (at 10:00 ET)

The zone is evaluated for tradability:

| Check | Condition | Result |
|-------|-----------|--------|
| **Choppy** | Last bar's close is strictly between support and resistance | NO_TRADE |
| **Too narrow** | Spread < `minZoneSpreadCents` (default: 10 cents) | NO_TRADE |
| **Too wide** | Spread/midpoint > `maxZoneSpreadPercent` (default: 3%) | NO_TRADE |
| **Valid** | Passes all checks | Proceed to monitoring |

### Step 3: Monitoring for Entries (10:00-11:00 ET)

Both LONG and SHORT tracks run in parallel. The entry sequence requires three steps:

#### LONG Entry Sequence

1. **Break** — A bar's HIGH pierces above resistance
2. **Retest** — A subsequent bar's LOW dips back to or below resistance
3. **Confirmation** — A bar's CLOSE finishes above resistance

A single bar can satisfy both retest AND confirmation (the "single-bar shortcut") if its LOW touches resistance and its CLOSE is above resistance.

#### SHORT Entry Sequence (mirror of LONG)

1. **Break** — A bar's LOW pierces below support
2. **Retest** — A subsequent bar's HIGH reaches back to or above support
3. **Confirmation** — A bar's CLOSE finishes below support

#### One-Side-Only Rule

Once one direction confirms an entry, the other direction is **superseded** (disabled). Only one position can be open at a time.

#### Break Failure & Retries

If a break fails to hold (close reverts back inside the zone), the system resets to watching. Up to `maxBreakAttempts` (default: 5) are allowed before giving up on that direction.

### Step 4: Position Management

Once a trade is entered:

- **Entry Price** = Close of the confirmation bar
- **Initial Stop** = Zone boundary (resistance for LONG, support for SHORT)
- **R-Value** = |Entry Price - Stop Level| (the risk per share, in cents)

#### Targets

| Target | Calculation (LONG) | Calculation (SHORT) |
|--------|--------------------|---------------------|
| 1R | Entry + R | Entry - R |
| 2R | Entry + 2R | Entry - 2R |
| 3R | Entry + 3R | Entry - 3R |

#### Trailing Stop at 1R

When price reaches the 1R target (if `trailingStopAt1R` is enabled):
- The stop moves from the zone boundary to the **entry price** (breakeven)
- If subsequently stopped out at entry: result is **BREAKEVEN_STOP**

#### Exit Priority (checked highest first)

1. **3R Target Hit** — Full exit, result: WIN_3R
2. **2R Milestone** — Recorded but position continues
3. **1R Milestone** — Stop moves to breakeven
4. **Stop Hit** — Full exit, result: LOSS or BREAKEVEN_STOP
5. **Session End (11:00 ET)** — Force exit, result: SESSION_TIMEOUT

### Visual Summary

```
Price
  ^
  |  -------- 3R Target --------  WIN_3R
  |
  |  -------- 2R Milestone -----  (tracked)
  |
  |  -------- 1R Target --------  Stop moves to entry
  |
  |  ======== ENTRY PRICE =======  Confirmation bar close
  |
  |  ~~~~~~~~ RESISTANCE ~~~~~~~~  Initial stop (LONG)
  |
  |         DECISION ZONE
  |
  |  ~~~~~~~~ SUPPORT ~~~~~~~~~~~  Initial stop (SHORT)
  |
  |  ======== ENTRY PRICE =======  (SHORT entry)
  |
  |  -------- 1R Target --------  (SHORT, below entry)
  |
```

---

## 4. Configuration

### Configuration File

The default configuration lives at `config/default.json`. You can specify a custom path with the `--config` flag on any command.

### Viewing Configuration

```bash
# Display current config
morningtrader config --show

# Validate config file
morningtrader config --validate

# View a custom config
morningtrader --config /path/to/custom.json config --show
```

### Configuration Sections

#### Strategy Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `maxBreakAttempts` | 5 | Maximum breakout attempts before giving up |
| `minZoneSpreadCents` | 10 | Minimum zone width in cents ($0.10) |
| `maxZoneSpreadPercent` | 3.0 | Maximum zone width as % of midpoint |
| `barSizeMinutes` | 5 | Bar interval (fixed at 5 minutes) |
| `minZoneBars` | 3 | Minimum bars required to form a valid zone |
| `trailingStopAt1R` | true | Move stop to entry when 1R is reached |

#### Session Windows

| Parameter | Default | Description |
|-----------|---------|-------------|
| `premarketTime` | 09:00 | Premarket start (ET) |
| `zoneStartTime` | 09:30 | Zone formation start / market open (ET) |
| `zoneEndTime` | 10:00 | Zone formation end (ET) |
| `executionEndTime` | 11:00 | Execution window end (ET) |

#### R-Multiple Targets

| Parameter | Default | Description |
|-----------|---------|-------------|
| `target1RMultiple` | 1.0 | First profit milestone (triggers trailing stop) |
| `target2RMultiple` | 2.0 | Second profit milestone |
| `target3RMultiple` | 3.0 | Full exit target |

#### IBKR Connection

| Parameter | Default | Description |
|-----------|---------|-------------|
| `host` | 127.0.0.1 | TWS/Gateway host address |
| `port` | 7497 | TWS/Gateway API port |
| `clientId` | 1 | Unique client identifier |
| `marketDataType` | 1 | 1=Realtime, 2=Frozen, 3=Delayed, 4=Delayed-Frozen |

#### Execution

| Parameter | Default | Description |
|-----------|---------|-------------|
| `mode` | MOCK | Execution mode: LIVE (real orders) or MOCK (simulated) |
| `defaultQuantity` | 100 | Default share quantity per trade |

#### Logging

| Parameter | Default | Description |
|-----------|---------|-------------|
| `level` | info | Log level: debug, info, warn, error |
| `pretty` | false | Human-readable log output (true for development) |

#### Storage

| Parameter | Default | Description |
|-----------|---------|-------------|
| `dbPath` | data/morningtrader.db | SQLite database file location |

### Holiday Calendar

The file `config/holidays.json` contains NYSE holidays and early close days (2024-2026). The system automatically skips weekends and holidays when scheduling sessions or running backtests.

---

## 5. CLI Commands

### Global Options

These options are available on all commands and must be placed **before** the command name:

```bash
morningtrader [global-options] <command> [command-options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--config <path>` | `config/default.json` | Path to configuration file |
| `--verbose` | false | Enable verbose logging |
| `--log-level <level>` | info | Log level: debug, info, warn, error |
| `-V, --version` | — | Display version number |

### Command Summary

| Command | Purpose |
|---------|---------|
| `live <symbol>` | Run a live trading session |
| `backtest <symbol>` | Run historical backtests |
| `report` | Generate performance reports |
| `export` | Export trade data to CSV/JSON |
| `config` | View or validate configuration |

---

## 6. Live Trading

### Command Syntax

```bash
morningtrader live <symbol> [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--mock` | Use mock execution (paper trading with live market data) |
| `--dry-run` | No storage writes, no order execution |
| `--force` | Run even if a completed session already exists for today |

### Examples

```bash
# Live trading with real orders (uses config execution mode)
morningtrader live SPY

# Paper trading — live data, simulated fills
morningtrader live SPY --mock

# Observation only — no orders, no database writes
morningtrader live SPY --dry-run

# Force re-run today's session
morningtrader live SPY --force

# With debug logging
morningtrader --verbose --log-level debug live AAPL --mock
```

### What Happens During a Live Session

1. **Bootstrap** — Load config, connect to IBKR, initialize storage
2. **Schedule Check** — Verify today is a trading day, check for prior session
3. **Wait for Market** — If before 09:30 ET, wait for market open
4. **Connect to Market Data** — Subscribe to 5-minute bars for the symbol
5. **Build Zone** — Accumulate bars from 09:30-10:00 ET
6. **Evaluate Zone** — Check if zone is tradeable
7. **Monitor** — Watch for break-retest-confirmation entries (10:00-11:00 ET)
8. **Manage Position** — Track R targets, trailing stop, exit conditions
9. **Session End** — At 11:00 ET, close any open positions
10. **Persist** — Save session, trades, outcomes, and signals to database
11. **Report** — Print summary to console
12. **Shutdown** — Disconnect from IBKR, close database

### Re-run Protection

By default, the system prevents running the same session twice for the same date/symbol. This avoids duplicate trades. Use `--force` to override this check.

### Graceful Shutdown

Press **Ctrl+C** (SIGINT) during a live session for graceful shutdown:
- Open positions are recorded as SESSION_TIMEOUT
- All data is flushed to the database
- IBKR connection is closed cleanly
- Session status is set to INTERRUPTED

The system allows a 10-second window for cleanup before forcing exit.

---

## 7. Backtesting

### Command Syntax

```bash
morningtrader backtest <symbol> --from <date> --to <date> [options]
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `--from <date>` | *required* | Start date (YYYY-MM-DD) |
| `--to <date>` | *required* | End date (YYYY-MM-DD) |
| `--source <type>` | csv | Data source: `csv` or `ibkr` |
| `--csv-dir <path>` | `tests/fixtures/bars` | Directory containing CSV bar files |
| `--force` | false | Re-run already completed sessions |
| `--no-persist` | false | Skip saving results to database |

### Examples

```bash
# Basic backtest from CSV files
morningtrader backtest SPY --from 2024-01-02 --to 2024-01-31

# Backtest using IBKR historical data
morningtrader backtest AAPL --from 2024-06-01 --to 2024-06-30 --source ibkr

# Custom CSV directory
morningtrader backtest SPY --from 2024-01-02 --to 2024-03-29 --csv-dir ./my-data

# Skip database persistence
morningtrader backtest SPY --from 2024-01-02 --to 2024-01-31 --no-persist

# Force re-run of already-completed sessions
morningtrader backtest SPY --from 2024-01-02 --to 2024-01-31 --force
```

### How Backtesting Works

For each calendar day in the date range:

1. **Skip non-trading days** — Weekends and NYSE holidays are skipped
2. **Check for prior session** — Skip if already backtested (unless `--force`)
3. **Load bars** — From CSV files or IBKR historical data
4. **Create isolated session** — Fresh state machine and simulated clock per day
5. **Replay bars** — Feed bars through the strategy engine in order
6. **Record results** — Save session, trades, outcomes to database
7. **Aggregate metrics** — Compute win rate, profit factor, etc. across all days

### CSV File Resolution

When using `--source csv`, the system looks for bar data in this order:

1. **Per-day file**: `{csv-dir}/{SYMBOL}-{YYYY-MM-DD}.csv` (e.g., `SPY-2024-01-15.csv`)
2. **Single file**: `{csv-dir}/{SYMBOL}.csv` — filtered to the day's trading window

### Backtest Output

After completion, the backtest displays:

- Total days in range
- Trading days processed
- Sessions completed
- Skipped dates (holidays, weekends, already completed)
- Error dates (if any)
- Aggregate performance metrics

---

## 8. Reports & Exports

### Performance Reports

```bash
morningtrader report --period <period> [options]
```

#### Period Options

| Period | Date Range |
|--------|------------|
| `daily` | Today only |
| `weekly` | Last 7 days |
| `monthly` | Last 30 days |
| `custom` | Specified via `--from` and `--to` |

#### Options

| Option | Description |
|--------|-------------|
| `--period <period>` | *Required*. Report period (daily, weekly, monthly, custom) |
| `--from <date>` | Start date. Required for `custom` period |
| `--to <date>` | End date. Defaults to today |
| `--symbol <symbol>` | Filter by symbol |

#### Examples

```bash
# Today's performance
morningtrader report --period daily

# Last 7 days
morningtrader report --period weekly

# Last 30 days, SPY only
morningtrader report --period monthly --symbol SPY

# Custom range
morningtrader report --period custom --from 2024-01-01 --to 2024-03-31
```

#### Report Contents

```
=== MorningTrader Performance Report ===

Total Sessions: 22
Total Trades: 15
  Wins: 8
  Losses: 4
  Breakeven: 2
  Timeouts: 1

Win Rate: 53.3%
Profit Factor: 2.15
Average R: 0.85R
Total R: 12.75R
Max Drawdown: 3.20R

--- Per Direction ---
LONG:  10 trades, 60.0% win rate, 1.05R avg
SHORT:  5 trades, 40.0% win rate, 0.45R avg
========================================
```

### Data Exports

```bash
morningtrader export --format <format> --output <path> [options]
```

#### Options

| Option | Default | Description |
|--------|---------|-------------|
| `--format <format>` | *required* | Output format: `csv` or `json` |
| `--output <path>` | *required* | Output file path |
| `--from <date>` | 30 days ago | Start date |
| `--to <date>` | Today | End date |
| `--symbol <symbol>` | All | Filter by symbol |

#### Examples

```bash
# Export all trades to CSV
morningtrader export --format csv --output trades.csv

# Export to JSON
morningtrader export --format json --output trades.json

# Export SPY trades for January 2024
morningtrader export --format csv --output spy-jan.csv \
  --from 2024-01-01 --to 2024-01-31 --symbol SPY
```

#### CSV Export Columns

**Trades CSV:**
```
id, symbol, direction, entry_price, stop_level, r_value,
target_1r, target_2r, target_3r, status
```

**Outcomes CSV:**
```
trade_id, result, realized_r, max_favorable_r, max_adverse_r,
exit_price, bars_held
```

All prices in the export are converted from integer cents to dollars (e.g., `50025` becomes `500.25`).

---

## 9. Dashboard Display

During a live session, the dashboard renders a formatted console display with six sections:

```
┌──────────────────────────────────────────────────────────────┐
│                   MorningTrader Dashboard                     │
├──────────────────────────────────────────────────────────────┤
│ Date: 2024-06-17    Symbol: SPY    Mode: MOCK                │
│ Started: 09:30:00   Completed: --                            │
├──────────────────────────────────────────────────────────────┤
│ DECISION ZONE                                                │
│ Resistance:    $502.50     Support:       $498.00            │
│ Spread:        $4.50       Status:        DEFINED            │
│ Source Bars:   6           Defined At:    10:00:00           │
├──────────────────────────────────────────────────────────────┤
│ SESSION STATE                                                │
│ Status:        Monitoring for signals                        │
│ Bars:          8           Signals: 2     Trades: 1          │
├──────────────────────────────────────────────────────────────┤
│ ACTIVE TRADE                                                 │
│ Direction:     LONG        Entry:         $503.00            │
│ Initial Stop:  $502.50     Current Stop:  $503.00            │
│ R-Value:       $0.50       1R: $503.50  2R: $504.00          │
│ Entry Time:    10:15:00    Signal: CONFIRMATION #1           │
├──────────────────────────────────────────────────────────────┤
│ SIGNAL HISTORY                                               │
│ 10:05:00  LONG  BREAK          #1  $502.75                  │
│ 10:10:00  LONG  RETEST         #1  $502.50                  │
│ 10:15:00  LONG  CONFIRMATION   #1  $503.00                  │
├──────────────────────────────────────────────────────────────┤
│ CURRENT BAR                                                  │
│ Time: 10:20:00  O: $503.25  H: $503.75  L: $503.00          │
│ C: $503.50      V: 125000   Status: complete  Bar #9         │
└──────────────────────────────────────────────────────────────┘
```

---

## 10. Data Models Reference

### Candle (5-Minute Bar)

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | number | Bar START time in UTC milliseconds |
| `open` | number | Open price (integer cents) |
| `high` | number | High price (integer cents) |
| `low` | number | Low price (integer cents) |
| `close` | number | Close price (integer cents) |
| `volume` | number | Trading volume |
| `completed` | boolean | Whether bar is fully formed |
| `barSizeMinutes` | 5 | Fixed at 5 minutes |

### Decision Zone

| Field | Type | Description |
|-------|------|-------------|
| `resistance` | number | Highest HIGH during 09:30-10:00 ET (cents) |
| `support` | number | Lowest LOW during 09:30-10:00 ET (cents) |
| `spread` | number | Resistance - Support (cents) |
| `status` | string | PENDING, DEFINED, NO_TRADE_CHOPPY, NO_TRADE_DEGENERATE, EXPIRED |
| `definedAt` | number | UTC ms when zone was defined |
| `sourceBars` | Candle[] | The bars used to build the zone |
| `premarketPrice` | number | Pre-market price (0 if unavailable) |

### Signal

| Field | Type | Description |
|-------|------|-------------|
| `direction` | LONG / SHORT | Signal direction |
| `type` | string | BREAK, RETEST, CONFIRMATION, BREAK_FAILURE |
| `timestamp` | number | UTC milliseconds |
| `price` | number | Trigger price (cents) |
| `triggerCandle` | Candle | The bar that generated the signal |
| `attemptNumber` | number | Which break attempt (1st, 2nd, etc.) |

### Trade

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Format: `{date}_{symbol}_{direction}_{attemptN}` |
| `symbol` | string | Ticker symbol |
| `direction` | LONG / SHORT | Trade direction |
| `entryPrice` | number | Confirmation bar close (cents) |
| `stopLevel` | number | Initial stop level (cents) |
| `currentStop` | number | Current stop — moves to entry after 1R (cents) |
| `rValue` | number | Risk per share = \|entry - stop\| (cents) |
| `target1R` | number | First target (cents) |
| `target2R` | number | Second target (cents) |
| `target3R` | number | Full exit target (cents) |
| `entryTimestamp` | number | UTC ms of entry |
| `status` | string | OPEN, STOPPED_OUT, TARGET_HIT, SESSION_EXPIRED |
| `entrySignal` | Signal | The confirmation signal |

### Trade Outcome

| Field | Type | Description |
|-------|------|-------------|
| `tradeId` | string | References Trade.id |
| `result` | string | LOSS, BREAKEVEN_STOP, WIN_2R, WIN_3R, SESSION_TIMEOUT |
| `realizedR` | number | Actual profit/loss in R units (2 decimal places) |
| `maxFavorableR` | number | Best price reached in R units |
| `maxAdverseR` | number | Worst drawdown in R units |
| `exitPrice` | number | Final exit price (cents) |
| `exitTimestamp` | number | UTC ms of exit |
| `firstThresholdReached` | 0-3 | Which R target was hit first (0 = stop) |
| `timestamp1R` | number | When 1R reached (0 if never) |
| `timestamp2R` | number | When 2R reached (0 if never) |
| `timestamp3R` | number | When 3R reached (0 if never) |
| `timestampStop` | number | When stop hit (0 if never) |
| `barsHeld` | number | Number of bars from entry to exit |

### Session Context

| Field | Type | Description |
|-------|------|-------------|
| `date` | string | Trading date (YYYY-MM-DD, Eastern Time) |
| `symbol` | string | Ticker symbol |
| `zone` | DecisionZone / null | The session's decision zone |
| `signals` | Signal[] | All signals detected |
| `trades` | Trade[] | All trades entered |
| `outcomes` | TradeOutcome[] | All trade results |
| `allBars` | Candle[] | Every bar received during the session |
| `status` | string | WAITING, BUILDING_ZONE, MONITORING, NO_TRADE, COMPLETE, INTERRUPTED, ERROR |
| `isBacktest` | boolean | True if historical backtest |
| `executionMode` | string | LIVE or MOCK |
| `startedAt` | number | UTC ms when session started |
| `completedAt` | number | UTC ms when session ended |
| `error` | string / null | Error message if failed |

### Possible Trade Results

| Result | Description |
|--------|-------------|
| **LOSS** | Stop was hit before reaching 1R. Full risk lost. |
| **BREAKEVEN_STOP** | Reached 1R (stop moved to entry), then stopped at entry. No profit or loss. |
| **WIN_2R** | Price reached the 2R target. Profit = 2x the initial risk. |
| **WIN_3R** | Price reached the 3R target. Profit = 3x the initial risk. |
| **SESSION_TIMEOUT** | Session ended at 11:00 ET with position still open. |

---

## 11. Database & Storage

### Location

Default: `data/morningtrader.db` (configurable via `storage.dbPath` in config).

### Schema Overview

The SQLite database uses WAL mode for performance and contains four tables:

#### Sessions Table

Stores one row per trading session (per date/symbol).

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto-increment primary key |
| date | TEXT | YYYY-MM-DD |
| symbol | TEXT | Ticker symbol |
| status | TEXT | Session status |
| zone_resistance | INTEGER | Zone resistance (cents), nullable |
| zone_support | INTEGER | Zone support (cents), nullable |
| zone_status | TEXT | Zone status, nullable |
| execution_mode | TEXT | LIVE or MOCK |
| started_at | INTEGER | UTC ms |
| completed_at | INTEGER | UTC ms, nullable |
| is_backtest | INTEGER | 0 or 1 |
| error | TEXT | Error message, nullable |

Unique constraint on `(date, symbol, is_backtest)` prevents duplicate sessions.

#### Trades Table

Stores each trade entered.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | `{date}_{symbol}_{direction}_{attempt}` |
| session_id | INTEGER | Foreign key to sessions |
| symbol | TEXT | Ticker symbol |
| direction | TEXT | LONG or SHORT |
| entry_price | INTEGER | Entry price (cents) |
| initial_stop | INTEGER | Initial stop level (cents) |
| current_stop | INTEGER | Current stop level (cents) |
| r_value | INTEGER | Risk per share (cents) |
| target_1r/2r/3r | INTEGER | Target levels (cents) |
| entry_timestamp | INTEGER | UTC ms |
| status | TEXT | Trade status |

#### Trade Outcomes Table

Stores the result of each completed trade.

| Column | Type | Description |
|--------|------|-------------|
| trade_id | TEXT | References trades.id |
| result | TEXT | LOSS, BREAKEVEN_STOP, WIN_2R, WIN_3R, SESSION_TIMEOUT |
| realized_r | REAL | Actual R-multiple achieved |
| max_favorable_r | REAL | Best R reached |
| max_adverse_r | REAL | Worst R drawdown |
| exit_price | INTEGER | Exit price (cents) |
| exit_timestamp | INTEGER | UTC ms |
| bars_held | INTEGER | Number of bars held |

#### Signals Table

Stores every signal (break, retest, confirmation, failure) detected.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto-increment |
| session_id | INTEGER | Foreign key to sessions |
| direction | TEXT | LONG or SHORT |
| signal_type | TEXT | BREAK, RETEST, CONFIRMATION, BREAK_FAILURE |
| timestamp | INTEGER | UTC ms |
| price | INTEGER | Signal price (cents) |
| attempt_number | INTEGER | Which attempt |

---

## 12. CSV Fixture Format

For backtesting with `--source csv`, bar data files use this format:

### File Naming

- **Per-day**: `{SYMBOL}-{YYYY-MM-DD}.csv` (e.g., `SPY-2024-01-15.csv`)
- **Multi-day**: `{SYMBOL}.csv` (e.g., `SPY.csv`) — system filters by date

### CSV Structure

```csv
timestamp,open,high,low,close,volume
1718631000,500.00,502.00,499.00,501.00,100000
1718631300,501.00,502.00,498.50,499.50,90000
```

### Column Definitions

| Column | Format | Description |
|--------|--------|-------------|
| timestamp | integer | UTC epoch **seconds** (not milliseconds) |
| open | decimal | Price in dollars (e.g., 500.00) |
| high | decimal | Price in dollars |
| low | decimal | Price in dollars |
| close | decimal | Price in dollars |
| volume | integer | Share volume |

Prices are automatically converted from dollars to integer cents on load.

### Included Test Fixtures

| File | Scenario | Expected Result |
|------|----------|-----------------|
| `spy-long-breakout-2r.csv` | Clean long breakout | WIN_2R |
| `spy-short-breakout-3r.csv` | Clean short breakout | WIN_3R |
| `spy-stop-loss.csv` | Entry then immediate reversal | LOSS |
| `spy-choppy.csv` | Price inside zone at 10:00 | NO_TRADE |
| `spy-breakeven-stop.csv` | Reaches 1R then stopped at entry | BREAKEVEN_STOP |
| `spy-session-timeout.csv` | Position open at 11:00 | SESSION_TIMEOUT |
| `spy-false-retest.csv` | Break fails to hold | No entry |
| `spy-single-bar-retest-confirm.csv` | Retest + confirm in one bar | Entry on that bar |
| `spy-multi-break-attempts.csv` | Multiple failed breaks | Entry on later attempt |

---

## 13. Logging

### Log Levels

| Level | When to Use |
|-------|-------------|
| `error` | Unrecoverable failures |
| `warn` | Recoverable issues (disconnections, stale data) |
| `info` | Key events (session start/end, trades, zone defined) |
| `debug` | Detailed flow (every bar, every guard evaluation) |

### Setting Log Level

```bash
# Via CLI flag
morningtrader --log-level debug live SPY --mock

# Via config file (logging.level)
```

### Pretty vs JSON Logging

- **JSON mode** (default, `pretty: false`): Machine-readable structured logs for production
  ```json
  {"level":30,"time":"2024-06-17T13:30:45.123Z","service":"morningtrader","module":"strategy","msg":"Zone defined"}
  ```

- **Pretty mode** (`pretty: true`): Human-readable colorized output for development
  ```
  2024-06-17 09:30:45.123 INFO  [strategy] Zone defined
  ```

### Module Scopes

Logs include a `module` field for filtering:

| Module | Logs From |
|--------|-----------|
| `ibkr` | IBKR connection, bar normalization, pacing |
| `strategy` | State machine transitions, signals, trades |
| `storage` | Database operations |
| `cli` | Command parsing, user interaction |
| `scheduler` | Session scheduling, market calendar |
| `backtest` | Backtest runner, CSV loading, replay |
| `risk` | R-value calculations |

---

## 14. Troubleshooting

### "Session already completed for today"

The system prevents duplicate sessions. Use `--force` to re-run:
```bash
morningtrader live SPY --force
```

### IBKR Connection Refused

1. Ensure TWS or IB Gateway is running
2. Check the API port in TWS settings matches your config (`ibkr.port`)
3. Verify "Enable ActiveX and Socket Clients" is checked in TWS API settings
4. Confirm no other client is using the same `clientId`

### No Bars Received

- Check that the symbol is valid and markets are open
- Verify `marketDataType` in config (1 for real-time requires market data subscription)
- Check IBKR data permissions for the symbol

### Backtest Finds No CSV Files

- Verify CSV files are in the expected directory (`--csv-dir`)
- Check file naming: `{SYMBOL}-{YYYY-MM-DD}.csv` or `{SYMBOL}.csv`
- Ensure the symbol in the filename matches the command argument (case-sensitive)

### Zone Always Choppy/Degenerate

- **Choppy**: The market's 10:00 close is inside the zone — this is by design (no clear direction)
- **Degenerate (too narrow)**: Reduce `minZoneSpreadCents` in config
- **Degenerate (too wide)**: Increase `maxZoneSpreadPercent` in config

### Integration Tests Failing (better-sqlite3)

If using Node v24, the `better-sqlite3` native bindings may not compile. This affects integration tests only — not unit tests or the strategy engine. Use Node v20 or v22 for full compatibility.

---

## 15. Glossary

| Term | Definition |
|------|------------|
| **Decision Zone** | The price range (support to resistance) formed during 09:30-10:00 ET |
| **Resistance** | The highest HIGH during the zone formation period |
| **Support** | The lowest LOW during the zone formation period |
| **Break** | When price pierces through resistance (LONG) or support (SHORT) |
| **Retest** | When price returns to the zone boundary after a break |
| **Confirmation** | A bar closing beyond the zone boundary, triggering entry |
| **R-Value** | Risk per share = \|entry price - stop level\|, measured in cents |
| **1R / 2R / 3R** | Profit targets at 1x, 2x, 3x the initial risk |
| **Trailing Stop** | Moving the stop loss to entry price (breakeven) after reaching 1R |
| **Superseded** | When one direction's entry cancels the other direction |
| **MFE** | Maximum Favorable Excursion — best price reached during a trade |
| **MAE** | Maximum Adverse Excursion — worst drawdown during a trade |
| **Profit Factor** | Sum of winning R / Sum of losing R |
| **Win Rate** | Percentage of trades that result in WIN_2R or WIN_3R |
| **WAL Mode** | Write-Ahead Logging — SQLite mode for better concurrent performance |
| **ET** | Eastern Time (America/New_York) — handles EST/EDT automatically |
| **Integer Cents** | Price representation where $500.25 = 50025 to avoid float precision issues |
