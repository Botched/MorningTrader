# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MorningTrader implements the "First 30-Minute Candle Decision Zone" strategy for US equities using the Interactive Brokers (IBKR) API. It defines a Decision Zone from the first 30 minutes of trading (09:30-10:00 ET), then evaluates 5-minute bars from 10:00-11:00 ET for break-retest-confirmation entries, tracking R-based outcomes (1R/2R/3R targets with trailing stop at 1R).

Supports three modes sharing the same strategy engine: **live trading**, **paper/mock trading**, and **historical backtesting**.

## Build & Test Commands

```bash
npm run build          # TypeScript compilation
npm run test:unit      # Unit tests (guards, actions, risk, utils, adapters)
npm run test:integration  # Integration tests (IBKR connection, SQLite CRUD, full sessions)
npm run test:e2e       # End-to-end tests (CLI smoke, graceful shutdown)
npm test               # All tests
```

### Running a Single Test
```bash
npx vitest run tests/unit/core/strategy/guards.test.ts
npx vitest run --testNamePattern "isLongBreak" tests/unit/core/strategy/guards.test.ts
```

### CLI Usage
```bash
morningtrader live AAPL --mock       # Live data, mock execution
morningtrader live AAPL --dry-run    # Live data, no storage, no orders
morningtrader backtest AAPL --from 2024-01-02 --to 2024-01-31 --source csv
morningtrader report --period weekly
morningtrader export --format csv --output trades.csv
```

## Architecture

### Layer Rule (Critical)
Dependencies point inward only. `src/core/` has **ZERO imports** from adapters, services, or CLI. All external dependencies are injected via interfaces in `src/core/interfaces/`.

```
CLI Layer        → src/cli/          (commands, dashboard)
Service Layer    → src/services/     (scheduler, session-runner, backtest-runner, reporter)
Adapter Layer    → src/adapters/     (ibkr/, backtest/, execution/, storage/)
Core Layer       → src/core/         (interfaces, models, strategy machine, risk, metrics)
```

### Strategy Engine (XState v5)
The state machine in `src/core/strategy/machine.ts` uses `setup()` + `createMachine()`. It has parallel long/short tracks inside a MONITORING state. Key flow: IDLE → BUILDING_ZONE → EVALUATING_ZONE → MONITORING → COMPLETE.

All strategy transitions are driven by `NEW_BAR` events with guard conditions — there are no separate BREAK/RETEST/CONFIRM events. Guards use a **two-tier filter**: HIGH/LOW for break detection, CLOSE for everything else (confirmation, stops, targets).

**One-side-only**: When one track enters `positionOpen`, the other track transitions to `superseded` (terminal).

### Key Domain Conventions
- **All prices are integer cents** (`Math.round(dollarPrice * 100)`), never floating-point dollars
- **All timestamps are UTC milliseconds** (`number`), never Date objects in storage
- **R-multiples** are rounded to 2 decimal places: `Math.round(r * 100) / 100`
- Bar timestamps represent bar **start time** (IBKR convention)
- Data models are plain `type` aliases with `readonly` fields, not classes

### Provider Interfaces
The same strategy engine runs in all modes via dependency injection:
- `MarketDataProvider` → `IBKRAdapter` (live) or `BacktestAdapter` (backtest)
- `OrderExecutionProvider` → `IBKROrderAdapter` (live), `MockOrderAdapter` (paper/backtest)
- `StorageProvider` → `SQLiteAdapter` (WAL mode, better-sqlite3)
- `Clock` → `SystemClock` (live) or `SimulatedClock` (backtest, deterministic)

### IBKR Integration
- Uses `@stoqey/ib` (IBApiNext with RxJS Observables), pinned at ^1.5.3
- Requests `formatDate=2` for epoch seconds (avoids timezone parsing)
- Bar completion uses a one-bar buffer algorithm (emit when next timestamp arrives)
- 3-tier pacing: 15s identity dedup → 6/2s per-contract burst → 60/10min global rolling

## Planning Documents

Detailed architecture spec and task breakdown are in `planning/`:
- `planning/architecture-spec.md` — Full technical design (interfaces, models, state machine, IBKR integration, SQL schema)
- `planning/kanban-tasks.md` — 64 tasks with dependencies and parallel execution waves

## Tech Stack

Node.js 20+ / TypeScript 5.7+ with: `@stoqey/ib`, `xstate` v5, `better-sqlite3`, `date-fns` v4 + `@date-fns/tz`, `commander`, `pino`, `zod`, `rxjs`, `vitest`.
