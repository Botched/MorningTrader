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
morningtrader dashboard --port 3847  # Start web dashboard server
```

### Web Dashboard (v2)

The web dashboard provides a React SPA for managing and visualizing trading sessions:

**Pages**:
- `/` - Dashboard with metrics cards, equity curve, win/loss distribution
- `/sessions` - Session list with filters, pagination, status badges
- `/sessions/:id` - Session detail with TradingView charts, trade cards, narrative
- `/watchlist` - Manage stock watchlist (add/remove, toggle mock/schedule)
- `/backtest` - Submit async backtest jobs, view progress and results
- `/summary` - Leaderboards (top sessions, by-stock aggregates)
- `/config` - Manage strategy configuration presets

**Key API Endpoints**:
- `GET /api/overview` - Dashboard metrics + equity curve
- `GET /api/sessions` - Session list with pagination
- `GET /api/sessions/:id` - Full session data (bars, signals, trades, outcomes)
- `GET /api/watchlist` - List watchlist items
- `POST /api/backtest-jobs` - Submit async backtest job
- `GET /api/summary/top-sessions` - Top N sessions by total R
- `GET /api/config-presets` - List configuration presets

**Database Schema (v2 - Migration 003)**:
- `watchlist_items` - Stock symbols with is_active, is_mock, schedule_enabled flags
- `strategy_presets` - Strategy configuration presets with is_default flag
- `backtest_jobs` - Async job queue with status, progress, result_summary (JSON)

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

## Task Management Workflow

The project uses a Kanban board at `planning/kanban-tasks.md` to track all implementation tasks. **You MUST update the Kanban board for every status transition.** No task moves between statuses without updating both the top-level board section AND the detailed task entry.

### Task Lifecycle: BACKLOG → READY → IN PROGRESS → REVIEW → DONE

**BACKLOG → READY** (when all dependencies are satisfied):
- Move the task from the BACKLOG table to the READY table in the board section.
- Update the task's detailed entry status to `READY`.

**READY → IN PROGRESS** (when an agent begins work):
- Move the task from the READY table to the IN PROGRESS table in the board section.
- Update the task's detailed entry status to `IN PROGRESS` with the start date.

**IN PROGRESS → REVIEW** (when the implementing agent finishes):
- Move the task from IN PROGRESS to the REVIEW table in the board section.
- Update the task's detailed entry status to `REVIEW` with completion notes.
- **Do NOT move to DONE.** Every task must be code reviewed before it can be marked DONE.
- Dispatch the Code Reviewer agent to review the task's output.

**REVIEW → DONE** (only after code review passes):
- The Code Reviewer agent reviews the implementation.
- If changes are needed: create **new tasks** in `kanban-tasks.md` for each required change (as sub-tasks referencing the parent, e.g., `T002-fix1`). The original task stays in REVIEW until the fixes are completed and re-reviewed.
- Only when the Code Reviewer approves with no outstanding issues: move the task to the DONE table and update the detailed entry with `Completed` date and `Notes`.

**After any task reaches DONE:**
- Check dependencies: find all tasks whose dependencies are now fully satisfied and promote them from BACKLOG to READY.
- Update the STATUS SUMMARY counts at the bottom of the file.
- Present the newly READY tasks to the user for confirmation before dispatching agents.

### Planning Documents

Refer to `planning/architecture-spec.md` for the full technical design (interfaces, models, state machine, IBKR integration, SQL schema). The Kanban board references task dependencies and parallel execution waves.

## Tech Stack

Node.js 20+ / TypeScript 5.7+ with: `@stoqey/ib`, `xstate` v5, `better-sqlite3`, `date-fns` v4 + `@date-fns/tz`, `commander`, `pino`, `zod`, `rxjs`, `vitest`.
