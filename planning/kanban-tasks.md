# MorningTrader - Kanban Task Breakdown

## Legend

- **Priority**: P0 = critical path, P1 = important, P2 = nice-to-have
- **Effort**: S (< 1hr), M (1-3hr), L (3-6hr), XL (6+ hr)
- **Status**: BACKLOG | READY | IN PROGRESS | REVIEW | DONE

---

# ============================================================
# KANBAN BOARD
# ============================================================

## DONE (code reviewed and approved)

| ID | Title | Phase | Assigned Agent | Priority | Effort |
|----|-------|-------|---------------|----------|--------|
| T083 | Integration tests for web dashboard | 5 | Fullstack Developer | P1 | M |
| T001 | Initialize project scaffolding | 1 | DevOps Engineer | P0 | M |
| T002 | Create directory structure with barrel exports | 1 | DevOps Engineer | P0 | S |
| T003 | Implement core interfaces | 1 | Backend Architect | P0 | M |
| T004 | Implement data models | 1 | Backend Architect | P0 | M |
| T005 | Implement time utilities | 1 | Fullstack Developer | P0 | M |
| T006 | Implement math utilities | 1 | Fullstack Developer | P1 | S |
| T007 | Implement bar utility functions | 1 | Fullstack Developer | P1 | S |
| T008 | Implement holiday calendar utility | 1 | Fullstack Developer | P1 | S |
| T009 | Create configuration files | 1 | DevOps Engineer | P1 | S |
| T010 | Implement IBKR bar normalizer | 1 | Backend Architect | P0 | M |
| T011 | Implement IBKR bar validator | 1 | Backend Architect | P0 | S |
| T012 | Implement IBKR 3-tier pacing manager | 1 | Performance Engineer | P1 | L |
| T013 | Implement IBKR contract resolver | 1 | Backend Architect | P1 | M |
| T014 | Implement IBKR connection manager | 1 | Backend Architect | P0 | L |
| T015 | Implement IBKRAdapter (MarketDataProvider) | 1 | Backend Architect | P0 | XL |
| T016 | Unit tests: bar normalizer + validator | 1 | Fullstack Developer | P1 | M |
| T017 | Unit tests: pacing manager | 1 | Performance Engineer | P1 | M |
| T018 | Unit tests: time, math, bar-utils | 1 | Fullstack Developer | P1 | M |
| T019 | Code review: core models + interfaces | 1 | Architect Reviewer | P1 | M |
| T021 | Implement strategy event types | 2 | Backend Architect | P0 | S |
| T022 | Implement strategy guard functions | 2 | Backend Architect | P0 | L |
| T023 | Implement strategy action functions | 2 | Backend Architect | P0 | L |
| T025 | Implement risk calculator | 2 | Fullstack Developer | P0 | M |
| T026 | Implement metrics aggregator | 2 | Fullstack Developer | P1 | M |
| T027 | Implement CSV loader | 2 | Fullstack Developer | P1 | M |
| T028 | Implement replay engine + SimClock | 2 | Backend Architect | P1 | M |
| T029 | Implement backtest adapter | 2 | Fullstack Developer | P1 | M |
| T032 | Create test fixture CSV files | 2 | Fullstack Developer | P1 | L |
| T036 | Unit tests: risk calculator | 2 | Fullstack Developer | P1 | M |
| T037 | Unit tests: metrics aggregator | 2 | Fullstack Developer | P1 | M |
| T041 | Implement SQLite schema + migrations | 3 | Database Architect | P0 | M |
| T042 | Implement SQLite storage adapter | 3 | Database Architect | P0 | L |
| T043 | Implement SQLite query modules | 3 | Database Architect | P1 | M |
| T044 | Implement mock order adapter | 3 | Fullstack Developer | P1 | M |
| T046 | Implement scheduler service | 3 | Fullstack Developer | P1 | M |
| T047 | Implement shutdown manager | 3 | Backend Architect | P1 | M |
| T048 | Implement reporter service | 3 | Fullstack Developer | P1 | M |
| T049 | Implement logger service (Pino) | 3 | DevOps Engineer | P1 | S |
| T050 | Implement CLI framework (Commander setup) | 3 | Fullstack Developer | P1 | S |
| T024 | Implement XState strategy machine | 2 | Backend Architect | P0 | L |
| T033 | Unit tests: strategy guards | 2 | Fullstack Developer | P0 | L |
| T034 | Unit tests: strategy actions | 2 | Fullstack Developer | P1 | M |
| T045 | Implement IBKR order adapter | 3 | Backend Architect | P1 | L |
| T055 | Implement CLI: config command | 3 | Fullstack Developer | P2 | S |
| T056 | Implement CLI dashboard | 3 | Frontend Developer | P2 | M |
| T058 | Integration tests: SQLite CRUD | 3 | Database Architect | P1 | M |
| T020 | Code review: IBKR adapter layer | 1 | Code Reviewer | P1 | M |
| T020a | Security review: IBKR + orders | 1 | Security Auditor | P1 | M |
| T061 | Code review: storage layer | 3 | Code Reviewer | P1 | M |
| T030 | Implement session runner | 2 | Backend Architect | P0 | L |
| T035 | Unit tests: machine transitions | 2 | Backend Architect | P0 | XL |
| T053 | Implement CLI: report command | 3 | Fullstack Developer | P1 | S |
| T054 | Implement CLI: export command | 3 | Fullstack Developer | P1 | S |
| T031 | Implement backtest runner | 2 | Fullstack Developer | P1 | L |
| T057 | Implement app bootstrap (DI) | 3 | Backend Architect | P0 | M |
| T039 | Code review: strategy engine | 2 | Architect Reviewer | P0 | L |
| T038 | Integration tests: backtest scenarios | 2 | Fullstack Developer | P0 | XL |
| T040 | Code review: backtest framework | 2 | Code Reviewer | P1 | M |
| T051 | Implement CLI: live command | 3 | Fullstack Developer | P0 | M |
| T052 | Implement CLI: backtest command | 3 | Fullstack Developer | P0 | M |
| T059 | Integration tests: full session | 3 | Fullstack Developer | P0 | L |
| T063 | Graceful shutdown integration test | 3 | Fullstack Developer | P1 | M |
| T060 | CLI smoke tests | 3 | Fullstack Developer | P1 | M |
| T062 | Code review: CLI + operations | 3 | Architect Reviewer | P1 | M |
| T064 | Performance review | 3 | Performance Engineer | P2 | M |
| T065 | Wire IBKR historical source into BacktestRunner | 4 | Backend Architect | P0 | M |
| T066 | Add IBKR bootstrap path for backtest mode | 4 | Backend Architect | P0 | M |
| T067 | Pass IBKR adapter through CLI backtest command | 4 | Fullstack Developer | P1 | S |
| T068 | Integration tests: IBKR historical backtest source | 4 | Fullstack Developer | P1 | M |
| T070 | Create migration 002 for bars table | 5 | Database Architect | P0 | S |
| T071 | Extend StorageProvider interface with bar methods | 5 | Backend Architect | P0 | S |
| T072 | Implement bar persistence in SQLiteAdapter | 5 | Database Architect | P0 | M |
| T073 | Update BacktestRunner to persist bars | 5 | Fullstack Developer | P0 | S |
| T074 | Define narrative types and implement NarrativeGenerator | 5 | Backend Architect | P1 | L |
| T075 | Create Fastify server and API routes | 5 | Backend Architect | P0 | L |
| T076 | Create dashboard CLI command | 5 | Fullstack Developer | P1 | S |
| T077 | Add web config to AppConfig | 5 | Backend Architect | P2 | S |
| T078 | Initialize React frontend project | 5 | Frontend Developer | P0 | M |
| T079 | Build Dashboard page | 5 | Frontend Developer | P0 | L |
| T080 | Build Sessions List page | 5 | Frontend Developer | P0 | M |
| T081 | Build Session Detail page | 5 | Frontend Developer | P0 | XL |
| T082 | Update build scripts and package.json | 5 | DevOps Engineer | P1 | S |
| T084-fix1 | Fix win rate double-multiplication in DashboardPage | 5 | Fullstack Developer | P0 | S |
| T084-fix2 | Fix profit factor calculation and remove dead variable | 5 | Fullstack Developer | P0 | S |
| T084-fix3 | Clean up dead code and add outcomes to session detail endpoint | 5 | Backend Architect | P1 | M |
| T069-fix1 | Fix test placement and assertion in IBKR backtest tests | 4 | Fullstack Developer | P1 | S |
| T084-fix4 | Remove read-write SQLiteAdapter from web server | 5 | Backend Architect | P1 | S |
| T084-fix5 | Fix command injection risk in dashboard CLI browser open | 5 | Fullstack Developer | P1 | S |

## REVIEW (implementation complete, awaiting code review)

| ID | Title | Phase | Assigned Agent | Priority | Effort |
|----|-------|-------|---------------|----------|--------|
| T069 | Code review: IBKR historical backtest feature | 4 | Code Reviewer | P1 | M |
| T084 | Code review: Web Dashboard | 5 | Code Reviewer | P1 | M |

## IN PROGRESS (agent actively working)

| ID | Title | Phase | Assigned Agent | Priority | Effort |
|----|-------|-------|---------------|----------|--------|
| *(none)* | | | | | |

## READY (no unmet dependencies)

| ID | Title | Phase | Assigned Agent | Priority | Effort |
|----|-------|-------|---------------|----------|--------|
| *(none)* | | | | | |

## BACKLOG (has unmet dependencies)

| ID | Title | Phase | Assigned Agent | Priority | Effort |
|----|-------|-------|---------------|----------|--------|
| *(none)* | | | | | |

---

# ============================================================
# DETAILED TASK LIST
# ============================================================

## PHASE 1: Core Foundation

### T001 - Initialize Project Scaffolding
- **Phase**: 1
- **Assigned Agent**: DevOps Engineer
- **Dependencies**: None
- **Priority**: P0 (critical path)
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Notes**: All deps installed (better-sqlite3 with --ignore-scripts due to Node v24). npm run build zero errors. Vitest configured with unit/integration/e2e projects.
- **Acceptance Criteria**:
  - `npm init` completed with correct package.json metadata
  - All dependencies from tech stack table installed at pinned versions
  - `tsconfig.json` configured: strict mode, ES2022 target, NodeNext module resolution, paths aliases
  - ESLint + Prettier configured with TypeScript rules
  - Vitest configured with `test:unit`, `test:integration`, `test:e2e` scripts
  - `npm run build` compiles empty project with zero errors
  - `.gitignore` covers node_modules, dist, data/, *.db
- **Files**:
  - `package.json`
  - `tsconfig.json`
  - `.eslintrc.json` (or `eslint.config.js`)
  - `.prettierrc`
  - `vitest.config.ts`
  - `.gitignore`

---

### T002 - Create Directory Structure with Barrel Exports
- **Phase**: 1
- **Assigned Agent**: DevOps Engineer
- **Dependencies**: T001 (DONE)
- **Priority**: P0 (critical path)
- **Effort**: S (< 1hr)
- **Status**: DONE
- **Started**: 2026-02-12
- **Completed**: 2026-02-12
- **Implementation Notes**: Created all directories per plan layout, 17 barrel export index.ts files across src/, 12 test directories. Build compiles with zero errors. Code review: APPROVE. Post-review fix: added .gitkeep to data/ directory.
- **Acceptance Criteria**:
  - All directories from the plan's directory layout exist
  - Every directory under `src/` has an `index.ts` barrel export file (empty or with placeholder comments)
  - `tests/` directories exist: `unit/core/strategy/`, `unit/core/risk/`, `unit/core/metrics/`, `unit/utils/`, `unit/adapters/`, `integration/`, `fixtures/bars/`, `e2e/`
  - `config/` directory exists with placeholder files
  - `data/` directory exists and is gitignored
  - `npm run build` still compiles with zero errors
- **Files**:
  - All `src/**/index.ts` barrel files
  - `config/` directory
  - `data/` directory
  - `tests/` directory tree

---

### T003 - Implement Core Interfaces
- **Phase**: 1
- **Assigned Agent**: Backend Architect
- **Dependencies**: T002 (DONE)
- **Priority**: P0 (critical path)
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Started**: 2026-02-12
- **Completed**: 2026-02-12
- **Implementation Notes**: Created 5 interface files + barrel export. MarketDataProvider, OrderExecutionProvider, StorageProvider, Clock, NotificationProvider. All use Observable from rxjs. All imports use .js extension. Build verified zero errors. Code review: APPROVE. Warnings noted: duplicate ExecutionMode type (also in session.ts), Order.status as string not union, missing CONNECTING state.
- **Acceptance Criteria**:
  - `MarketDataProvider` interface matches spec (connect, disconnect, isConnected, connectionState$, errors$, resolveContract, getHistoricalBars, subscribeBars, unsubscribeBars)
  - `OrderExecutionProvider` interface matches spec (mode, placeOrder, cancelOrder, getOpenOrders, fills$) with `OrderRequest`, `OrderResult`, `Fill` types
  - `StorageProvider` interface matches spec (all CRUD methods)
  - `Clock` interface matches spec (now, setTimeout, clearTimeout, waitUntil) with `SystemClock` and `SimulatedClock` type stubs
  - `NotificationProvider` interface matches spec (notify with NotificationEvent)
  - Supporting types: `ContractSpec`, `ProviderError`, `ClockTimer`, `NotificationEvent`, `Direction`
  - All interfaces exported from `src/core/interfaces/index.ts`
  - `npm run build` zero errors
- **Files**:
  - `src/core/interfaces/market-data.ts`
  - `src/core/interfaces/order-execution.ts`
  - `src/core/interfaces/storage.ts`
  - `src/core/interfaces/clock.ts`
  - `src/core/interfaces/notification.ts`
  - `src/core/interfaces/index.ts`

---

### T004 - Implement Core Data Models
- **Phase**: 1
- **Assigned Agent**: Backend Architect
- **Dependencies**: T002 (DONE)
- **Priority**: P0 (critical path)
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Started**: 2026-02-12
- **Completed**: 2026-02-12
- **Implementation Notes**: Created 6 model files + barrel export. Candle, DecisionZone, Signal, Trade/TradeOutcome, SessionContext, Config (with Zod schemas). All readonly types, int cents for prices, UTC ms for timestamps. Build verified zero errors. Code review: APPROVE. Warning noted: duplicate ExecutionMode type with order-execution.ts.
- **Acceptance Criteria**:
  - `Candle` type: readonly fields, timestamp (UTC ms), prices as int cents, volume, completed, barSizeMinutes
  - `DecisionZone` type: resistance, support, status enum, spread, definedAt, sourceBars, premarketPrice
  - `Signal` type: direction, type enum (BREAK/RETEST/CONFIRMATION/BREAK_FAILURE), timestamp, price, triggerCandle, attemptNumber
  - `Trade` type: id format, all R targets, currentStop, status enum, entrySignal
  - `TradeOutcome` type: result enum, all R timestamps, maxFavorableR, maxAdverseR, realizedR, barsHeld
  - `SessionContext` type: all fields including status enum, executionMode, isBacktest
  - `StrategyConfig` type with Zod schema: maxBreakAttempts, minZoneSpreadCents, maxZoneSpreadPercent, etc.
  - `AppConfig` type with Zod schema: ibkr connection settings, execution mode, logging level
  - All types are readonly and use integer cents for prices
  - All types exported from `src/core/models/index.ts`
  - `npm run build` zero errors
- **Files**:
  - `src/core/models/candle.ts`
  - `src/core/models/decision-zone.ts`
  - `src/core/models/signal.ts`
  - `src/core/models/trade.ts`
  - `src/core/models/session.ts`
  - `src/core/models/config.ts`
  - `src/core/models/index.ts`

---

### T005 - Implement Time Utilities
- **Phase**: 1
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T002 (DONE)
- **Priority**: P0 (critical path)
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Started**: 2026-02-12
- **Completed**: 2026-02-12
- **Implementation Notes**: Created src/utils/time.ts with etToUtc, getSessionWindows, normalizeToBarGrid, isWithinRange, utcToEtDateStr. Uses TZDate from @date-fns/tz. Barrel export updated. Build verified zero errors. Code review: APPROVE.
- **Acceptance Criteria**:
  - `etToUtc(dateStr, timeStr)` converts ET time to UTC ms using TZDate
  - `getSessionWindows(dateStr)` returns premarketUtc, zoneStartUtc, zoneEndUtc, executionEndUtc
  - `normalizeToBarGrid(utcMs, barSizeMinutes)` snaps to 5-min grid
  - All functions handle DST transitions correctly (spring forward + fall back)
  - Uses `date-fns` v4 + `@date-fns/tz` >= 1.2.0 with TZDate
  - All comparisons via `.getTime()`, never reference equality
  - Exported from `src/utils/index.ts`
- **Files**:
  - `src/utils/time.ts`

---

### T006 - Implement Math Utilities
- **Phase**: 1
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T002 (DONE)
- **Priority**: P1
- **Effort**: S (< 1hr)
- **Status**: DONE
- **Started**: 2026-02-12
- **Completed**: 2026-02-12
- **Implementation Notes**: Created src/utils/math.ts with dollarsToCents, centsToDollars, roundR, computeRMultiple, computeRValue, computeTargetPrice. All pure functions. Barrel export updated with both time and math exports. Build verified zero errors. Code review: APPROVE.
- **Acceptance Criteria**:
  - `dollarsToCents(dollars: number): number` -> `Math.round(dollars * 100)`
  - `centsToDollars(cents: number): number` -> `cents / 100`
  - `roundR(r: number): number` -> `Math.round(r * 100) / 100` (2 decimal places)
  - `computeRMultiple(entryPrice, exitPrice, rValue, direction)` returns rounded R
  - All functions are pure, no side effects
  - Exported from `src/utils/index.ts`
- **Files**:
  - `src/utils/math.ts`

---

### T007 - Implement Bar Utility Functions
- **Phase**: 1
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T004 (DONE)
- **Priority**: P1
- **Effort**: S (< 1hr)
- **Status**: DONE
- **Started**: 2026-02-12
- **Completed**: 2026-02-12
- **Implementation Notes**: Created src/utils/bar-utils.ts with getHighestHigh(), getLowestLow(), filterByTimeRange(). All pure functions on readonly Candle[]. Empty array returns 0 for high/low. Barrel export updated. Build verified zero errors. Code review: APPROVE (non-blocking: no issues).
- **Acceptance Criteria**:
  - `getHighestHigh(bars: Candle[]): number` returns max high across bars
  - `getLowestLow(bars: Candle[]): number` returns min low across bars
  - `filterByTimeRange(bars: Candle[], startUtc, endUtc): Candle[]` filters inclusive start, exclusive end
  - Handle edge cases: empty array returns 0 (or throws), single bar
  - All functions are pure
  - Exported from `src/utils/index.ts`
- **Files**:
  - `src/utils/bar-utils.ts`

---

### T008 - Implement Holiday Calendar Utility
- **Phase**: 1
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T002 (DONE), T009 (DONE)
- **Priority**: P1
- **Effort**: S (< 1hr)
- **Status**: DONE
- **Started**: 2026-02-12
- **Completed**: 2026-02-12
- **Implementation Notes**: Created src/utils/holidays.ts with HolidayCalendarSchema (Zod), loadHolidayCalendar(), isTradingDay(), isEarlyClose(), isWithinCalendarRange(), getNextTradingDay(). Loads from config/holidays.json. Barrel export updated. Build verified zero errors. Code review: APPROVE (non-blocking: calendarRange.from/to could use date regex).
- **Acceptance Criteria**:
  - `isTradingDay(dateStr)` checks weekends + holidays from config
  - `isEarlyClose(dateStr)` for shortened sessions
  - Loads holidays from `config/holidays.json` (not hardcoded)
  - Validates holidays.json with Zod schema on load
  - Logs warning when operating beyond confirmed calendar range
  - Exported from `src/utils/index.ts`
- **Files**:
  - `src/utils/holidays.ts`

---

### T009 - Create Configuration Files
- **Phase**: 1
- **Assigned Agent**: DevOps Engineer
- **Dependencies**: T001 (DONE)
- **Priority**: P1
- **Effort**: S (< 1hr)
- **Status**: DONE
- **Started**: 2026-02-12
- **Completed**: 2026-02-12
- **Implementation Notes**: Created config/default.json with all StrategyConfig defaults and config/holidays.json with 30 NYSE holidays (2024-2026) and 8 early close dates. All dates verified to fall on weekdays. 2026 July 4 observed on July 3 (Saturday holiday). Valid JSON confirmed. Code review: APPROVE. All 30 holidays and 8 early close dates programmatically verified.
- **Acceptance Criteria**:
  - `config/default.json` contains all StrategyConfig defaults: maxBreakAttempts=5, minZoneSpreadCents=10, maxZoneSpreadPercent=3.0, session windows, execution mode
  - `config/holidays.json` contains NYSE holidays for 2024-2026 with early close dates
  - Both files validate against their Zod schemas
  - JSON is well-formatted and commented where possible
- **Files**:
  - `config/default.json`
  - `config/holidays.json`

---

### T010 - Implement IBKR Bar Normalizer
- **Phase**: 1
- **Assigned Agent**: Backend Architect
- **Dependencies**: T004 (DONE)
- **Priority**: P0 (critical path)
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Started**: 2026-02-12
- **Completed**: 2026-02-12
- **Implementation Notes**: Created src/adapters/ibkr/bar-normalizer.ts with IBKRBar type, normalizeBar() function (epoch sec → UTC ms, dollars → cents), BarCompletionBuffer class (one-bar buffer algorithm). Barrel export updated. Build verified zero errors. Code review: APPROVE (non-blocking: no issues).
- **Acceptance Criteria**:
  - `normalizeBar(ibBar: Bar): Candle` converts IBKR Bar to Candle type
  - Epoch seconds (formatDate=2) converted to UTC milliseconds
  - Dollar prices converted to integer cents via `Math.round(price * 100)`
  - One-bar buffer algorithm implemented for bar completion detection:
    - Empty buffer: store bar (incomplete)
    - Different timestamp: emit buffered bar as completed=true, store new bar
    - Same timestamp: replace buffer (update in-progress)
    - SESSION_END: emit buffered bar as completed
  - Handles edge cases: null/undefined volume defaults to 0
  - Exported from `src/adapters/ibkr/index.ts`
- **Files**:
  - `src/adapters/ibkr/bar-normalizer.ts`

---

### T011 - Implement IBKR Bar Validator
- **Phase**: 1
- **Assigned Agent**: Backend Architect
- **Dependencies**: T004 (DONE)
- **Priority**: P0
- **Effort**: S (< 1hr)
- **Status**: DONE
- **Started**: 2026-02-12
- **Completed**: 2026-02-12
- **Implementation Notes**: Created src/adapters/ibkr/bar-validator.ts with CandleSchema (Zod with refinements for high>=low etc.), validateCandle(), CandleValidationResult type. Barrel export updated. Build verified zero errors. Code review: APPROVE (non-blocking: timestamp field missing .int() in Zod schema).
- **Acceptance Criteria**:
  - Zod `CandleSchema` validates: timestamp positive, OHLCV all int positive (volume nonneg)
  - Refine: high >= low, high >= open, high >= close, low <= open, low <= close
  - Rejects bars with -1 prices, zero values, high < low
  - `validateCandle(candle)` returns `{ success: boolean, data?: Candle, error?: ZodError }`
  - Exported from `src/adapters/ibkr/index.ts`
- **Files**:
  - `src/adapters/ibkr/bar-validator.ts`

---

### T012 - Implement IBKR 3-Tier Pacing Manager
- **Phase**: 1
- **Assigned Agent**: Performance Engineer
- **Dependencies**: T003 (DONE)
- **Priority**: P1
- **Effort**: L (3-6hr)
- **Status**: DONE
- **Started**: 2026-02-12
- **Completed**: 2026-02-12
- **Implementation Notes**: Created src/adapters/ibkr/pacing.ts with PacingManager class, PacingConfig interface. 3-tier throttling: identity dedup (15s), per-contract burst (6/2s), global rolling (60/10min). Promise queue serialization for concurrent callers. getStatus(), reset() helpers. Barrel export updated. Build verified zero errors. Code review: APPROVE (no blocking issues).
- **Acceptance Criteria**:
  - Tier 1: Identity dedup - 15-second window, 1 identical request
  - Tier 2: Per-contract burst - 2-second window, max 6 requests
  - Tier 3: Global rolling - 10-minute window, max 60 historical requests
  - Queue with backpressure when limits exceeded
  - `acquireSlot(contractId, requestKey)` returns Promise that resolves when slot available
  - Tracks request timestamps for sliding window calculation
  - Exported from `src/adapters/ibkr/index.ts`
- **Files**:
  - `src/adapters/ibkr/pacing.ts`

---

### T013 - Implement IBKR Contract Resolver
- **Phase**: 1
- **Assigned Agent**: Backend Architect
- **Dependencies**: T003 (DONE)
- **Priority**: P1
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Started**: 2026-02-12
- **Completed**: 2026-02-12
- **Implementation Notes**: Created src/adapters/ibkr/contract-resolver.ts with ContractResolver class. Resolves symbols to ContractSpec with session-lifetime cache. Fixed: uses direct await api.getContractDetails() (returns Promise, not Observable in @stoqey/ib v1.5.x). Barrel export updated. Build verified zero errors. Code review: APPROVE (no blocking issues).
- **Acceptance Criteria**:
  - Resolves symbol to IBKR contract: secType=STK, exchange=SMART, currency=USD
  - Caches resolved contracts for session lifetime (Map)
  - Handles error 200 (no security definition found) gracefully
  - Validates symbol is US equity >= $1.00
  - Returns `ContractSpec` type
  - Exported from `src/adapters/ibkr/index.ts`
- **Files**:
  - `src/adapters/ibkr/contract-resolver.ts`

---

### T014 - Implement IBKR Connection Manager
- **Phase**: 1
- **Assigned Agent**: Backend Architect
- **Dependencies**: T003 (DONE)
- **Priority**: P0
- **Effort**: L (3-6hr)
- **Status**: DONE
- **Started**: 2026-02-12
- **Completed**: 2026-02-12
- **Implementation Notes**: Created src/adapters/ibkr/connection.ts with ConnectionManager class, ConnectionConfig interface, ConnectionState type. Exponential backoff reconnection (2s base, 60s cap, 10 attempts). Handles IBKR error codes: 1100, 1101, 1102, 2104, 2106. recordBarTimestamp()/getBackfillStartTimestamp() for reconnection backfill. Sets MarketDataType.REALTIME on connect. Barrel export updated. Build verified zero errors. Code review: APPROVE (non-blocking: isShuttingDown reset in reconnect path noted but safe).
- **Acceptance Criteria**:
  - Exponential backoff reconnection: 2s initial, 60s max, 10 attempts
  - Monitors IBKR error codes: 1100 (connection lost), 1102 (restored, data lost), 2104/2106 (farm status)
  - Calls `reqMarketDataType(1)` for REALTIME data on connect
  - Validates clientId uniqueness at startup
  - Exposes `connectionState$` Observable: CONNECTED, DISCONNECTING, RECONNECTING, DISCONNECTED
  - Implements reconnection backfill algorithm:
    1. Record lastReceivedBarTimestamp on disconnect
    2. Request historical bars from last+5min to now on reconnect
    3. Dedup by timestamp, feed backfilled bars in order
  - Exported from `src/adapters/ibkr/index.ts`
- **Files**:
  - `src/adapters/ibkr/connection.ts`

---

### T015 - Implement IBKRAdapter (MarketDataProvider)
- **Phase**: 1
- **Assigned Agent**: Backend Architect
- **Dependencies**: T003, T010, T011, T012, T013, T014
- **Priority**: P0 (critical path)
- **Effort**: XL (6+ hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - Implements `MarketDataProvider` interface fully
  - Uses IBApiNext (RxJS Observable API from `@stoqey/ib`)
  - `connect()` / `disconnect()` delegate to ConnectionManager
  - `resolveContract(symbol)` delegates to ContractResolver
  - `getHistoricalBars()` uses `getHistoricalData()` with formatDate=2, respects PacingManager
  - `subscribeBars()` uses `getHistoricalDataUpdates()`, returns Observable<Candle> pipeline:
    - map(normalizeBar) -> bar completion detection -> filter(completed) -> filter(validated) -> distinctUntilChanged(timestamp) -> takeUntil(destroy$) -> share()
  - `unsubscribeBars()` cancels subscription and cleans up
  - Exposes `errors$` for non-fatal error forwarding
  - Integration test: can connect to TWS paper and fetch SPY 5-min bars (skippable if TWS not running)
  - Exported from `src/adapters/ibkr/index.ts`
- **Files**:
  - `src/adapters/ibkr/ibkr-adapter.ts`
  - `src/adapters/ibkr/index.ts`

---

### T016 - Unit Tests: Bar Normalizer and Validator
- **Phase**: 1
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T010, T011
- **Priority**: P1
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - BarNormalizer tests:
    - Converts epoch seconds to UTC milliseconds correctly
    - Converts dollar prices to integer cents (including rounding edge cases like $1.005)
    - One-bar buffer: first bar stored, second bar with different timestamp emits first as completed
    - Same-timestamp update replaces buffer
    - SESSION_END emits buffered bar
    - Null volume defaults to 0
  - BarValidator tests:
    - Valid candle passes
    - Rejects negative prices, high < low, high < open, low > close
    - Rejects non-integer prices after normalization
    - Rejects zero timestamp
  - All tests pass with `npm run test:unit`
- **Files**:
  - `tests/unit/adapters/bar-normalizer.test.ts`
  - `tests/unit/adapters/bar-validator.test.ts`

---

### T017 - Unit Tests: Pacing Manager
- **Phase**: 1
- **Assigned Agent**: Performance Engineer
- **Dependencies**: T012
- **Priority**: P1
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - Identity dedup: same request within 15s is queued, different request proceeds
  - Per-contract burst: 7th request within 2s is queued until window slides
  - Global rolling: 61st request within 10min is queued with backpressure
  - Concurrent requests from different contracts are independent for Tier 2
  - Slot release after request completes
  - Timer-based tests using fake timers (vitest)
  - All tests pass with `npm run test:unit`
- **Files**:
  - `tests/unit/adapters/pacing.test.ts`

---

### T018 - Unit Tests: Time, Math, and Bar Utilities
- **Phase**: 1
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T005, T006, T007
- **Priority**: P1
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - Time utils tests:
    - `etToUtc` for standard day and DST transitions (2024-03-10 spring forward, 2024-11-03 fall back)
    - `getSessionWindows` returns correct UTC timestamps for ET session times
    - `normalizeToBarGrid` snaps correctly at bar boundaries and mid-bar
  - Math utils tests:
    - dollarsToCents edge cases: $1.005 rounds to 101 cents
    - centsToDollars: 15050 -> 150.50
    - roundR: 1.555 -> 1.56, -0.5 -> -0.5
    - computeRMultiple for LONG and SHORT
  - Bar utils tests:
    - getHighestHigh / getLowestLow with normal arrays, single element, empty array
    - filterByTimeRange inclusive start, exclusive end
  - All tests pass with `npm run test:unit`
- **Files**:
  - `tests/unit/utils/time.test.ts`
  - `tests/unit/utils/math.test.ts`
  - `tests/unit/utils/bar-utils.test.ts`

---

### T019 - Code Review: Core Models and Interfaces
- **Phase**: 1
- **Assigned Agent**: Architect Reviewer
- **Dependencies**: T003 (DONE), T004 (DONE)
- **Priority**: P1
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Implementation Notes**: Review performed as part of T003+T004 code review gate. APPROVE verdict. Findings: all interfaces match plan spec, all types readonly with int cents, no forbidden imports, barrel exports complete. Warnings: duplicate ExecutionMode type (medium), Order.status as string (low), missing CONNECTING state (low), no SessionWindows type alias (low).
- **Acceptance Criteria**:
  - All interfaces match the plan spec exactly
  - All types use readonly fields and integer cents for prices
  - No runtime dependencies imported in `src/core/` (except xstate types if needed)
  - Barrel exports are complete and correct
  - Type naming conventions are consistent
  - No mutable state leaks (arrays should be readonly)
  - Zod schemas for config types are comprehensive
  - Feedback documented and addressed
- **Files**: (review only, no creation)
  - `src/core/interfaces/*.ts`
  - `src/core/models/*.ts`

---

### T020 - Code Review: IBKR Adapter Layer
- **Phase**: 1
- **Assigned Agent**: Code Reviewer
- **Dependencies**: T015, T016, T017
- **Priority**: P1
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - IBKRAdapter correctly implements MarketDataProvider interface
  - Bar normalization pipeline is correct (order of operations, error handling)
  - Pacing manager correctly implements all 3 tiers
  - Connection manager handles all error codes from the plan
  - Reconnection backfill algorithm is implemented correctly
  - No resource leaks (Observable subscriptions cleaned up)
  - Error handling is comprehensive (non-fatal vs fatal errors)
  - All unit tests are meaningful and cover edge cases
  - Feedback documented and addressed
- **Files**: (review only)
  - `src/adapters/ibkr/*.ts`
  - `tests/unit/adapters/*.test.ts`

---

### T020a - Security Review: IBKR Connection and Order Interfaces
- **Phase**: 1
- **Assigned Agent**: Security Auditor
- **Dependencies**: T015
- **Priority**: P1
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - IBKR connection credentials are not hardcoded
  - ClientId management prevents conflicts
  - Config validation prevents injection of malicious values
  - No sensitive data logged (account numbers, positions beyond what's needed)
  - Order execution interface has proper mode guards (LIVE vs MOCK)
  - Socket connection has timeout and error boundaries
  - Report with findings documented
- **Files**: (review only)
  - `src/adapters/ibkr/*.ts`
  - `src/core/interfaces/order-execution.ts`
  - `src/core/models/config.ts`

---

## PHASE 2: Strategy Engine + Risk + Backtest

### T021 - Implement Strategy Event Types
- **Phase**: 2
- **Assigned Agent**: Backend Architect
- **Dependencies**: T004 (DONE)
- **Priority**: P0 (critical path)
- **Effort**: S (< 1hr)
- **Status**: DONE
- **Started**: 2026-02-12
- **Completed**: 2026-02-12
- **Implementation Notes**: Created src/core/strategy/events.ts with StrategyEvent union type (NEW_BAR, SESSION_START, SESSION_END, ERROR), StrategyMachineContext (full machine context), StrategyMachineInput. Barrel export updated. Build verified zero errors. Code review: APPROVE (non-blocking: longPhase/shortPhase could share TrackPhase type).
- **Acceptance Criteria**:
  - `StrategyEvent` union type: NEW_BAR, SESSION_START, SESSION_END, ERROR
  - `StrategyMachineContext` type with all context fields: zone, signals, trades, outcomes, allBars, activeDirection, longTrack/shortTrack state, break attempt counters
  - `StrategyMachineInput` type: date, symbol
  - All types exported from `src/core/strategy/index.ts`
  - Types are readonly where appropriate
- **Files**:
  - `src/core/strategy/events.ts`

---

### T022 - Implement Strategy Guard Functions
- **Phase**: 2
- **Assigned Agent**: Backend Architect
- **Dependencies**: T004, T021
- **Priority**: P0 (critical path)
- **Effort**: L (3-6hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - All LONG guards: isLongBreak, isLongRetest, isLongRetestAndConfirm, isLongConfirmation, isLongBreakFailure, isLongStopHit, isLong1R, isLong2R, isLong3R
  - All SHORT guards: mirrors of LONG with inverted comparisons
  - `isChoppyZone`: close inside zone at 10:00
  - `isDegenerateZone`: spread < minZoneSpreadCents or spread > maxZoneSpreadPercent
  - `isMaxAttemptsReached`: attempts >= maxBreakAttempts
  - `isSuperseded`: activeDirection set and !== myDirection
  - `isSessionEnd`: event type check
  - Two-tier filter: HIGH/LOW for break detection, CLOSE for everything else
  - Multi-target resolution: 3R -> 2R -> 1R -> stop priority order
  - All guards are pure functions (no side effects)
  - Exported from `src/core/strategy/index.ts`
- **Files**:
  - `src/core/strategy/guards.ts`

---

### T023 - Implement Strategy Action Functions
- **Phase**: 2
- **Assigned Agent**: Backend Architect
- **Dependencies**: T004, T021, T025
- **Priority**: P0 (critical path)
- **Effort**: L (3-6hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - `accumulateZoneBar`: adds bar to zone source bars
  - `computeZone`: calculates resistance/support from accumulated bars, sets status
  - `recordLongBreak` / `recordShortBreak`: creates BREAK signal, increments attempt counter
  - `recordLongRetest` / `recordShortRetest`: creates RETEST signal
  - `recordConfirmation` (long/short): creates Trade with R targets (uses risk calculator), sets activeDirection, creates CONFIRMATION signal
  - `updateTrailingStop`: moves currentStop from zone level to entryPrice after 1R
  - `recordStopHit`: creates TradeOutcome with LOSS or BREAKEVEN_STOP
  - `recordTargetHit`: creates TradeOutcome with WIN_2R or WIN_3R, marks intermediate thresholds
  - `recordBreakFailure`: creates BREAK_FAILURE signal, resets track state
  - `recordSessionTimeout`: creates SESSION_TIMEOUT outcome for open positions
  - `accumulateBar`: adds bar to allBars
  - All actions use XState v5 `assign()` pattern
  - All actions are pure (deterministic context updates)
  - Exported from `src/core/strategy/index.ts`
- **Files**:
  - `src/core/strategy/actions.ts`

---

### T024 - Implement XState v5 Strategy State Machine
- **Phase**: 2
- **Assigned Agent**: Backend Architect
- **Dependencies**: T021, T022, T023
- **Priority**: P0 (critical path)
- **Effort**: L (3-6hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - Uses XState v5 `setup()` + `createMachine()` pattern
  - States: IDLE -> BUILDING_ZONE -> EVALUATING_ZONE -> MONITORING (parallel) / NO_TRADE / COMPLETE / ERROR
  - MONITORING has parallel longTrack and shortTrack regions
  - Each track: watchingForBreak -> breakDetected -> retestDetected -> positionOpen -> resolved
  - Plus: superseded (final), maxAttemptsExhausted (final)
  - Single-bar retest+confirm shortcut transition
  - Break failure resets to watchingForBreak
  - One-side-only enforcement: positionOpen supersedes other track
  - SESSION_END at MONITORING parent level transitions to COMPLETE
  - All guards and actions wired via setup()
  - Machine can be instantiated with `createActor(machine, { input })` and `actor.send(event)`
  - Exported from `src/core/strategy/index.ts`
- **Files**:
  - `src/core/strategy/machine.ts`
  - `src/core/strategy/index.ts`

---

### T025 - Implement Risk Calculator
- **Phase**: 2
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T004 (DONE)
- **Priority**: P0 (critical path)
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Started**: 2026-02-12
- **Completed**: 2026-02-12
- **Implementation Notes**: Created src/core/risk/calculator.ts with computeTargets, determineStopLevel, computeTrailingStop, computeMaxFavorableR, computeMaxAdverseR. Re-exports computeRValue, computeRMultiple, computeTargetPrice, roundR from utils/math. All integer cents, R rounded to 2dp. Barrel export updated. Build verified zero errors. Code review: APPROVE (non-blocking: exhaustive switch guard suggestion).
- **Acceptance Criteria**:
  - `computeRValue(entryPrice, stopLevel)`: `Math.abs(entryPrice - stopLevel)` (int cents)
  - `computeTargets(entryPrice, rValue, direction)`: returns { target1R, target2R, target3R } (int cents)
    - LONG: entry + N*rValue
    - SHORT: entry - N*rValue
  - `computeRMultiple(entryPrice, exitPrice, rValue, direction)`: returns rounded R float
  - `computeMaxFavorableR(bars, trade)`: max HIGH (long) or min LOW (short) relative to entry
  - `computeMaxAdverseR(bars, trade)`: max adverse excursion
  - `determineStopLevel(zone, direction)`: resistance for LONG, support for SHORT
  - `computeTrailingStop(trade, reached1R)`: returns entryPrice if 1R reached, else initial stop
  - All calculations use integer cents, R-multiples rounded to 2dp
  - Exported from `src/core/risk/index.ts`
- **Files**:
  - `src/core/risk/calculator.ts`
  - `src/core/risk/index.ts`

---

### T026 - Implement Metrics Aggregator
- **Phase**: 2
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T004 (DONE)
- **Priority**: P1
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Started**: 2026-02-12
- **Completed**: 2026-02-12
- **Implementation Notes**: Created src/core/metrics/aggregator.ts with TradeStats, DirectionStats, AggregateMetrics interfaces. Functions: computeTradeStats, computeWinRate, computeProfitFactor, computeAverageR, computeMaxDrawdown (peak-to-trough cumulative R), computePerDirectionStats, aggregateMetrics. All values rounded to 2dp. Barrel export updated. Build verified zero errors. Code review: APPROVE (non-blocking: round2 duplicates roundR, computeProfitFactor returns Infinity).
- **Acceptance Criteria**:
  - `computeWinRate(outcomes)`: (WIN_2R + WIN_3R) / total, as percentage
  - `computeProfitFactor(outcomes)`: gross profit R / gross loss R
  - `computeMaxDrawdown(outcomes)`: maximum consecutive R-loss sequence
  - `computePerDirectionStats(outcomes, direction)`: win rate, avg R per direction
  - `computeAverageR(outcomes)`: mean realized R
  - `computeTradeStats(outcomes)`: total trades, wins, losses, breakeven, timeouts
  - `aggregateMetrics(sessions)`: full aggregate across multiple sessions
  - All calculations handle edge cases: empty arrays, all wins, all losses
  - Exported from `src/core/metrics/index.ts`
- **Files**:
  - `src/core/metrics/aggregator.ts`
  - `src/core/metrics/index.ts`

---

### T027 - Implement CSV Loader for Backtesting
- **Phase**: 2
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T004 (DONE), T006 (DONE)
- **Priority**: P1
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Started**: 2026-02-12
- **Completed**: 2026-02-12
- **Implementation Notes**: Created src/adapters/backtest/csv-loader.ts with loadBarsFromCsv(filePath). Reads CSV synchronously, supports "YYYYMMDD HH:MM:SS" (ET→UTC) and epoch seconds. CsvLoadResult: { bars, errors, totalRows }. Auto-detects/skips headers, sorts ascending by timestamp. Barrel export updated. Build verified zero errors. Code review: APPROVE (no blocking issues).
- **Acceptance Criteria**:
  - Parses CSV format: `timestamp,open,high,low,close,volume`
  - Supports timestamp formats: "YYYYMMDD HH:MM:SS" (ET) and epoch seconds (UTC)
  - Converts dollar float prices to integer cents on load
  - Returns sorted array of `Candle[]` (ascending by timestamp)
  - Validates each row with Zod schema
  - Skips header row if present
  - Reports row-level errors (line number + reason) without failing entire load
  - Exported from `src/adapters/backtest/index.ts`
- **Files**:
  - `src/adapters/backtest/csv-loader.ts`

---

### T028 - Implement Replay Engine and Simulated Clock
- **Phase**: 2
- **Assigned Agent**: Backend Architect
- **Dependencies**: T003 (DONE), T004 (DONE)
- **Priority**: P1
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Started**: 2026-02-12
- **Completed**: 2026-02-12
- **Implementation Notes**: Created src/adapters/backtest/replay-engine.ts with SimulatedClock (implements Clock: now, setTimeout, clearTimeout, waitUntil, advanceTo with chronological timer firing, reset) and ReplayEngine (replay with onBar/onStart/onEnd callbacks). Barrel export updated. Build verified zero errors. Code review: REQUEST_CHANGES on ClockTimer type violation (setTimeout returned raw number instead of {id}). Fix applied: return {id} in setTimeout, use timer.id in clearTimeout. Build re-verified. APPROVE after fix.
- **Acceptance Criteria**:
  - `SimulatedClock` implements `Clock` interface:
    - `now()` returns current simulated time (advances with replayed bars)
    - `setTimeout` / `clearTimeout` based on simulated time
    - `waitUntil` resolves when simulated time advances past target
    - `advanceTo(utcMs)` method for replay engine to call
  - `ReplayEngine`:
    - Takes sorted `Candle[]` array
    - Feeds bars one-at-a-time to a callback
    - Advances SimulatedClock to each bar's timestamp before emitting
    - No wall-clock dependency (deterministic)
    - Supports pause/resume for debugging (optional, P2)
  - Exported from `src/adapters/backtest/index.ts`
- **Files**:
  - `src/adapters/backtest/replay-engine.ts`
  - `src/core/interfaces/clock.ts` (add SimulatedClock implementation or separate file)

---

### T029 - Implement Backtest Adapter (MarketDataProvider)
- **Phase**: 2
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T003, T027, T028
- **Priority**: P1
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - Implements `MarketDataProvider` interface
  - `connect()` / `disconnect()` are no-ops (or minimal setup)
  - `resolveContract(symbol)` returns a stub ContractSpec
  - `getHistoricalBars()` delegates to CsvLoader or returns stored data
  - `subscribeBars()` returns Observable that emits bars from ReplayEngine
  - `isConnected` always true once connected
  - Works with SimulatedClock for deterministic replay
  - Exported from `src/adapters/backtest/index.ts`
- **Files**:
  - `src/adapters/backtest/backtest-adapter.ts`
  - `src/adapters/backtest/index.ts`

---

### T030 - Implement Session Runner
- **Phase**: 2
- **Assigned Agent**: Backend Architect
- **Dependencies**: T003, T024
- **Priority**: P0 (critical path)
- **Effort**: L (3-6hr)
- **Status**: BACKLOG
- **Acceptance Criteria**:
  - Creates and manages XState actor lifecycle for a single trading session
  - Subscribes to MarketDataProvider bar stream
  - Filters bars by session windows (zone: 09:30-10:00, execution: 10:00-11:00)
  - Sends SESSION_START event with date and symbol
  - Sends NEW_BAR events for each completed bar
  - Sends SESSION_END at 11:00 ET (or when all bars exhausted in backtest)
  - Extracts final `SessionContext` from actor state after completion
  - Delegates order execution to OrderExecutionProvider when ENTRY_CONFIRMED
  - Handles re-run protection: checks `storage.hasCompletedSession(date, symbol)`
  - Handles errors: catches exceptions, transitions machine to ERROR state
  - Console dashboard output per bar (delegates to dashboard module)
  - Exported from `src/services/`
- **Files**:
  - `src/services/session-runner.ts`

---

### T031 - Implement Backtest Runner
- **Phase**: 2
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T029, T030, T026
- **Priority**: P1
- **Effort**: L (3-6hr)
- **Status**: BACKLOG
- **Acceptance Criteria**:
  - Iterates over trading days in date range
  - Skips non-trading days (weekends, holidays via `isTradingDay()`)
  - For each day: fetch bars, create fresh XState actor, run session, persist results
  - Uses SessionRunner for each individual day
  - Aggregates metrics across all sessions using MetricsAggregator
  - Reports progress (day N of M)
  - Supports CSV source and IBKR historical source
  - Returns aggregate results + per-session details
  - Exported from `src/services/`
- **Files**:
  - `src/services/backtest-runner.ts`

---

### T032 - Create Test Fixture CSV Files
- **Phase**: 2
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T027
- **Priority**: P1
- **Effort**: L (3-6hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - All 9 scenario CSV files created with hand-calculated expected outcomes:
    1. `spy-long-breakout-2r.csv` - Clean long: break -> retest -> confirm -> 2R (WIN_2R)
    2. `spy-short-breakout-3r.csv` - Clean short: break -> retest -> confirm -> 3R (WIN_3R)
    3. `spy-choppy.csv` - 10:00 price inside zone (NO_TRADE_CHOPPY)
    4. `spy-stop-loss.csv` - Entry then immediate reversal (LOSS)
    5. `spy-breakeven-stop.csv` - Reaches 1R, stop moves, then stopped at entry (BREAKEVEN_STOP)
    6. `spy-session-timeout.csv` - Position never resolves by 11:00 (SESSION_TIMEOUT)
    7. `spy-false-retest.csv` - Break then fails to hold (no entry, back to watching)
    8. `spy-single-bar-retest-confirm.csv` - One bar retests AND confirms (entry on that bar)
    9. `spy-multi-break-attempts.csv` - 3 failed breaks before success (entry on 4th attempt)
  - Each file has correct 5-min bars covering 09:30-11:00 ET
  - Prices are dollar floats in CSV (converted on load)
  - Expected outcomes documented in comments or companion .md file
- **Files**:
  - `tests/fixtures/bars/spy-long-breakout-2r.csv`
  - `tests/fixtures/bars/spy-short-breakout-3r.csv`
  - `tests/fixtures/bars/spy-choppy.csv`
  - `tests/fixtures/bars/spy-stop-loss.csv`
  - `tests/fixtures/bars/spy-breakeven-stop.csv`
  - `tests/fixtures/bars/spy-session-timeout.csv`
  - `tests/fixtures/bars/spy-false-retest.csv`
  - `tests/fixtures/bars/spy-single-bar-retest-confirm.csv`
  - `tests/fixtures/bars/spy-multi-break-attempts.csv`
  - `tests/fixtures/bars/README.md` (expected outcomes)

---

### T033 - Unit Tests: Strategy Guards (100% Branch Coverage)
- **Phase**: 2
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T022
- **Priority**: P0
- **Effort**: L (3-6hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - Every guard function tested with true and false cases
  - LONG guards: break (high > resistance), retest (low <= resistance), retestAndConfirm (single bar), confirmation (close > resistance), breakFailure (close <= resistance), stopHit, 1R/2R/3R
  - SHORT guards: all mirror tests
  - isChoppyZone: close strictly between support and resistance
  - isDegenerateZone: spread too small, spread too large
  - isMaxAttemptsReached: at limit, below limit
  - isSuperseded: both directions, null direction
  - Multi-target resolution order: verifies 3R checked before 2R before 1R
  - Edge cases: bar exactly at boundary, bar.completed=false rejected
  - 100% branch coverage on guards.ts (verified via vitest coverage)
  - All tests pass with `npm run test:unit`
- **Files**:
  - `tests/unit/core/strategy/guards.test.ts`

---

### T034 - Unit Tests: Strategy Actions
- **Phase**: 2
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T023
- **Priority**: P1
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - accumulateZoneBar: adds bar to sourceBars array
  - computeZone: correct resistance/support from bars, correct status
  - recordBreak (long/short): creates correct Signal, increments attempt
  - recordConfirmation: creates Trade with correct R targets, sets activeDirection
  - updateTrailingStop: moves stop correctly after 1R
  - recordStopHit: correct outcome (LOSS vs BREAKEVEN_STOP)
  - recordTargetHit: correct outcome, marks intermediate thresholds with timestamps
  - recordBreakFailure: resets track, logs signal
  - recordSessionTimeout: correct outcome for open position
  - All actions produce immutable context updates
  - All tests pass with `npm run test:unit`
- **Files**:
  - `tests/unit/core/strategy/actions.test.ts`

---

### T035 - Unit Tests: Full Machine Transitions
- **Phase**: 2
- **Assigned Agent**: Backend Architect
- **Dependencies**: T024
- **Priority**: P0
- **Effort**: XL (6+ hr)
- **Status**: BACKLOG
- **Acceptance Criteria**:
  - Test IDLE -> BUILDING_ZONE on SESSION_START
  - Test BUILDING_ZONE accumulates 6 bars (09:30-10:00)
  - Test EVALUATING_ZONE -> NO_TRADE for choppy zone
  - Test EVALUATING_ZONE -> NO_TRADE for degenerate zone
  - Test EVALUATING_ZONE -> MONITORING for valid zone
  - Test full LONG flow: watchingForBreak -> breakDetected -> retestDetected -> positionOpen -> resolved (2R, 3R)
  - Test full SHORT flow (mirror)
  - Test single-bar retest+confirm shortcut
  - Test break failure -> back to watchingForBreak
  - Test max break attempts exhaustion
  - Test one-side-only: long enters position, short superseded (and vice versa)
  - Test trailing stop at 1R: stop moves to entry price
  - Test BREAKEVEN_STOP: 1R reached then stopped at entry
  - Test SESSION_END during MONITORING -> COMPLETE
  - Test SESSION_END with open position -> SESSION_TIMEOUT outcome
  - Test ERROR state on unrecoverable error
  - Test parallel state interaction
  - All tests pass with `npm run test:unit`
- **Files**:
  - `tests/unit/core/strategy/machine.test.ts`

---

### T036 - Unit Tests: Risk Calculator
- **Phase**: 2
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T025
- **Priority**: P1
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - computeRValue: LONG entry 15000 stop 14900 -> R=100
  - computeTargets LONG: 1R=15100, 2R=15200, 3R=15300
  - computeTargets SHORT: 1R=14800, 2R=14700, 3R=14600
  - computeRMultiple: various scenarios, verify rounding to 2dp
  - computeMaxFavorableR: scans bars correctly for LONG (max high) and SHORT (min low)
  - computeMaxAdverseR: scans correctly
  - determineStopLevel: resistance for LONG, support for SHORT
  - computeTrailingStop: returns entryPrice after 1R, initial stop before 1R
  - Edge case: R value of 1 cent (minimum)
  - All tests pass with `npm run test:unit`
- **Files**:
  - `tests/unit/core/risk/calculator.test.ts`

---

### T037 - Unit Tests: Metrics Aggregator
- **Phase**: 2
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T026
- **Priority**: P1
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - Win rate: 3 wins, 2 losses -> 60%
  - Profit factor: gross profit / gross loss, handles zero losses (Infinity)
  - Max drawdown: consecutive losses tracked correctly
  - Per-direction stats: filters by LONG/SHORT correctly
  - Average R: handles positive and negative R values
  - Trade stats: counts all result types correctly
  - Edge cases: empty array, single trade, all same result
  - All tests pass with `npm run test:unit`
- **Files**:
  - `tests/unit/core/metrics/aggregator.test.ts`

---

### T038 - Integration Tests: Backtest Scenarios (All 9 Fixtures)
- **Phase**: 2
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T031, T032
- **Priority**: P0
- **Effort**: XL (6+ hr)
- **Status**: BACKLOG
- **Acceptance Criteria**:
  - Each of the 9 fixture CSVs produces the documented expected outcome
  - Tests run end-to-end: CSV -> CsvLoader -> BacktestAdapter -> SessionRunner -> XState actor -> final context
  - Verify: zone resistance/support, signals generated, trade entry price, R value, outcome result, realized R
  - Trailing stop scenario (breakeven-stop): verify stop moved to entry after 1R
  - Multi-break scenario: verify attempt count increments
  - False retest: verify no trade entered, signals logged
  - Session timeout: verify SESSION_TIMEOUT outcome
  - R-multiples match hand-calculated values to 2 decimal places ("bit-exact")
  - All tests pass with `npm run test:integration`
- **Files**:
  - `tests/integration/backtest-scenarios.test.ts`

---

### T039 - Code Review: Strategy Engine
- **Phase**: 2
- **Assigned Agent**: Architect Reviewer
- **Dependencies**: T024, T033, T034, T035
- **Priority**: P0
- **Effort**: L (3-6hr)
- **Status**: BACKLOG
- **Acceptance Criteria**:
  - State machine structure matches plan's state diagram exactly
  - All guard functions are pure with no side effects
  - All actions produce deterministic context updates
  - Parallel state regions interact correctly (one-side-only)
  - XState v5 patterns are idiomatic (setup, assign, guard references)
  - Multi-target resolution priority is correct (3R -> 2R -> 1R -> stop)
  - Trailing stop logic at 1R is correct
  - Break failure / max attempts logic is correct
  - No core layer imports from adapters/services
  - Test coverage meets 95% threshold on src/core/strategy/
  - Feedback documented and addressed
- **Files**: (review only)
  - `src/core/strategy/*.ts`
  - `tests/unit/core/strategy/*.test.ts`

---

### T040 - Code Review: Backtest Framework
- **Phase**: 2
- **Assigned Agent**: Code Reviewer
- **Dependencies**: T031, T038
- **Priority**: P1
- **Effort**: M (1-3hr)
- **Status**: BACKLOG
- **Acceptance Criteria**:
  - CSV loader handles all documented formats correctly
  - ReplayEngine is deterministic (no wall-clock dependencies)
  - SimulatedClock advances correctly
  - BacktestAdapter implements MarketDataProvider completely
  - BacktestRunner iterates days correctly, skips holidays
  - Metrics aggregation across sessions is correct
  - All fixture test outcomes are plausible (hand-verified)
  - No async leaks in core strategy logic path
  - Feedback documented and addressed
- **Files**: (review only)
  - `src/adapters/backtest/*.ts`
  - `src/services/backtest-runner.ts`
  - `tests/integration/backtest-scenarios.test.ts`

---

## PHASE 3: Storage + Execution + CLI + Operations

### T041 - Implement SQLite Schema and Migrations
- **Phase**: 3
- **Assigned Agent**: Database Architect
- **Dependencies**: T004 (DONE)
- **Priority**: P0
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Started**: 2026-02-12
- **Completed**: 2026-02-12
- **Implementation Notes**: Created src/adapters/storage/migrations/001-initial.ts with Migration interface, migration001 (sessions, trades, trade_outcomes, signals tables + 3 indexes), runMigrations function with _migrations tracking table and transactional per-migration execution. Idempotent. Barrel exports updated. Build verified zero errors. Code review: APPROVE (no blocking issues).
- **Acceptance Criteria**:
  - Migration 001-initial.ts creates all 4 tables: sessions, trades, trade_outcomes, signals
  - All column types match the plan's SQL schema exactly
  - UNIQUE constraint on (date, symbol, is_backtest) for sessions
  - Foreign key constraints: trades -> sessions, trade_outcomes -> trades, signals -> sessions
  - Indexes created: idx_sessions_date, idx_trades_session, idx_signals_session
  - WAL mode enabled on database open
  - Migration runner tracks applied migrations
  - All price columns are INTEGER (cents)
  - All timestamp columns are INTEGER (UTC ms)
  - Schema creation is idempotent (safe to run multiple times)
- **Files**:
  - `src/adapters/storage/migrations/001-initial.ts`

---

### T042 - Implement SQLite Storage Adapter
- **Phase**: 3
- **Assigned Agent**: Database Architect
- **Dependencies**: T003, T041
- **Priority**: P0 (critical path)
- **Effort**: L (3-6hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - Implements `StorageProvider` interface fully
  - `initialize()`: opens SQLite DB in WAL mode, runs migrations
  - `saveSession()`: inserts session, returns auto-incremented ID
  - `getSession()`: retrieves by date + symbol
  - `hasCompletedSession()`: checks for COMPLETE status
  - `saveTrade()`: inserts trade linked to session
  - `saveTradeOutcome()`: inserts outcome linked to trade
  - `saveSignals()`: batch inserts signals linked to session
  - `getTradesByDateRange()`: filters by date range, optional symbol
  - `getOutcomesByDateRange()`: filters by date range, optional symbol
  - `getSessionsByDateRange()`: filters by date range, optional symbol
  - `close()`: closes database connection
  - Uses transactions for multi-table writes
  - Uses prepared statements for performance
  - Integrity check on startup
  - Exported from `src/adapters/storage/index.ts`
- **Files**:
  - `src/adapters/storage/sqlite-adapter.ts`
  - `src/adapters/storage/index.ts`

---

### T043 - Implement SQLite Query Modules
- **Phase**: 3
- **Assigned Agent**: Database Architect
- **Dependencies**: T041
- **Priority**: P1
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - `queries/trades.ts`: prepared statements for trade CRUD
  - `queries/sessions.ts`: prepared statements for session CRUD
  - `queries/aggregations.ts`: aggregate queries for reporting (win rate, total R, per-symbol stats, date range summaries)
  - All queries use parameterized statements (no string interpolation)
  - Query results are mapped to TypeScript model types
  - Exported from `src/adapters/storage/index.ts`
- **Files**:
  - `src/adapters/storage/queries/trades.ts`
  - `src/adapters/storage/queries/sessions.ts`
  - `src/adapters/storage/queries/aggregations.ts`

---

### T044 - Implement Mock Order Adapter
- **Phase**: 3
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T003 (DONE)
- **Priority**: P1
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Started**: 2026-02-12
- **Completed**: 2026-02-12
- **Implementation Notes**: Created src/adapters/execution/mock-order-adapter.ts with MockOrderAdapter implementing OrderExecutionProvider (mode='MOCK'). Immediate fill simulation via RxJS Subject<Fill>. Auto-incrementing MOCK-N order IDs, fill price from limitPrice/stopPrice, zero commission. Barrel export updated. Build verified zero errors. Code review: APPROVE (no blocking issues).
- **Acceptance Criteria**:
  - Implements `OrderExecutionProvider` interface with `mode: 'MOCK'`
  - `placeOrder()`: immediately returns SUBMITTED, generates fill at signal price
  - `cancelOrder()`: removes from internal open orders list
  - `getOpenOrders()`: returns current mock open orders
  - `fills$`: Observable that emits Fill events (immediate fill on placeOrder)
  - Commission defaults to 0 in mock mode
  - Logs all order activity for debugging
  - Exported from `src/adapters/execution/index.ts`
- **Files**:
  - `src/adapters/execution/mock-order-adapter.ts`
  - `src/adapters/execution/index.ts`

---

### T045 - Implement IBKR Order Adapter (Live Trading)
- **Phase**: 3
- **Assigned Agent**: Backend Architect
- **Dependencies**: T003, T015
- **Priority**: P1
- **Effort**: L (3-6hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - Implements `OrderExecutionProvider` interface with `mode: 'LIVE'`
  - `placeOrder()`: submits order to IBKR via IBApiNext, returns order ID
  - Supports MARKET and LIMIT order types
  - Supports stop-loss orders (stopPrice)
  - `cancelOrder()`: sends cancel request to IBKR
  - `getOpenOrders()`: queries IBKR for open orders
  - `fills$`: Observable that emits Fill events from IBKR fill callbacks
  - Handles order status updates: Submitted, Filled, Cancelled, Error
  - Guards against placing orders when mode !== 'LIVE'
  - Exported from `src/adapters/ibkr/index.ts`
- **Files**:
  - `src/adapters/ibkr/ibkr-order-adapter.ts`

---

### T046 - Implement Scheduler Service
- **Phase**: 3
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T005, T008
- **Priority**: P1
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - Determines if today is a trading day (weekend + holiday check)
  - Calculates session windows for today using `getSessionWindows()`
  - Waits until premarketUtc (09:00 ET) before starting session
  - Triggers SessionRunner at zoneStartUtc (09:30 ET)
  - Handles early close days (no effect on our 09:30-11:00 window, but logged)
  - Logs warnings when operating outside confirmed calendar range
  - Can schedule for next trading day if current session is over
  - Exported from `src/services/`
- **Files**:
  - `src/services/scheduler.ts`

---

### T047 - Implement Shutdown Manager
- **Phase**: 3
- **Assigned Agent**: Backend Architect
- **Dependencies**: T003 (DONE)
- **Priority**: P1
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Started**: 2026-02-12
- **Completed**: 2026-02-12
- **Implementation Notes**: Created src/services/shutdown-manager.ts with ShutdownManager class, ShutdownHandler type. LIFO handler execution, SIGINT/SIGTERM listening, force exit timeout (default 10s) with unref(), idempotent shutdown, individual handler error resilience. Barrel export updated. Build verified zero errors. Code review: APPROVE (no blocking issues).
- **Acceptance Criteria**:
  - Registers handlers for SIGINT and SIGTERM
  - On shutdown signal:
    1. Marks current session as INTERRUPTED
    2. Records open positions as SESSION_TIMEOUT outcomes
    3. Flushes pending SQLite writes within transaction
    4. Unsubscribes all IBKR bar streams
    5. Closes IBKR connection cleanly
    6. Logs shutdown reason
    7. Exits with code 0
  - Prevents double-shutdown (idempotent)
  - Timeout: force exit after 10 seconds if clean shutdown fails
  - Exported from `src/services/`
- **Files**:
  - `src/services/shutdown-manager.ts`

---

### T048 - Implement Reporter Service
- **Phase**: 3
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T004, T026
- **Priority**: P1
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - CSV export: trades, outcomes, sessions to CSV format
  - JSON export: same data to JSON format
  - Console report: formatted summary with metrics (win rate, profit factor, drawdown, per-direction stats)
  - Supports period filtering: daily, weekly, monthly, custom date range
  - Supports symbol filtering
  - Formats prices from cents to dollars for display ($150.50)
  - Formats R-multiples to 2 decimal places
  - Exported from `src/services/`
- **Files**:
  - `src/services/reporter.ts`

---

### T049 - Implement Logger Service (Pino)
- **Phase**: 3
- **Assigned Agent**: DevOps Engineer
- **Dependencies**: T001 (DONE)
- **Priority**: P1
- **Effort**: S (< 1hr)
- **Status**: DONE
- **Started**: 2026-02-12
- **Completed**: 2026-02-12
- **Implementation Notes**: Created src/services/logger.ts with createLogger() and getChildLogger() functions. JSON output in production, pino-pretty in dev. Child loggers scoped to modules (ibkr, strategy, storage, cli, scheduler, backtest, risk). Security note header. Build verified, runtime smoke test passed for both JSON and pretty modes. Barrel export updated in src/services/index.ts. Code review: APPROVE. Post-review fix: corrected translateTime format (mm/MM swap).
- **Acceptance Criteria**:
  - Pino logger configured with structured JSON output
  - Log levels configurable via AppConfig (default: info)
  - pino-pretty for development (human-readable)
  - Child loggers for each module (ibkr, strategy, storage, cli)
  - Timestamps in ISO format
  - No sensitive data in logs (account numbers, credentials)
  - Exported from `src/services/`
- **Files**:
  - `src/services/logger.ts`

---

### T050 - Implement CLI Framework (Commander Setup)
- **Phase**: 3
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T001 (DONE)
- **Priority**: P1
- **Effort**: S (< 1hr)
- **Status**: DONE
- **Started**: 2026-02-12
- **Completed**: 2026-02-12
- **Implementation Notes**: Created src/cli/index.ts with createProgram() factory. 5 subcommands (live, backtest, report, export, config) with stubs. Global options: --config, --verbose, --log-level. Choice validation on options. Unknown command handling via command:* event. showSuggestionAfterError + showHelpAfterError enabled. ESM-compatible entry detection. Build verified, all commands tested via CLI. Code review: APPROVE.
- **Acceptance Criteria**:
  - Commander.js configured with program name "morningtrader"
  - Version from package.json
  - Global options: --config, --verbose, --log-level
  - Subcommand registration for: live, backtest, report, export, config
  - Help text for each command
  - Error handling for unknown commands
  - Exported as bin entry in package.json
- **Files**:
  - `src/cli/index.ts`

---

### T051 - Implement CLI: Live Command
- **Phase**: 3
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T030, T050, T057
- **Priority**: P0
- **Effort**: M (1-3hr)
- **Status**: BACKLOG
- **Acceptance Criteria**:
  - `morningtrader live AAPL` - live trading with real orders
  - `morningtrader live AAPL --mock` - live data, mock execution
  - `morningtrader live AAPL --dry-run` - live data, no storage, no orders
  - Validates symbol argument is provided
  - Wires MarketDataProvider (IBKRAdapter), OrderExecutionProvider (live or mock), StorageProvider
  - Starts Scheduler -> SessionRunner
  - Dashboard output during session
  - Clean error messages for connection failures
- **Files**:
  - `src/cli/commands/live.ts`

---

### T052 - Implement CLI: Backtest Command
- **Phase**: 3
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T031, T050, T057
- **Priority**: P0
- **Effort**: M (1-3hr)
- **Status**: BACKLOG
- **Acceptance Criteria**:
  - `morningtrader backtest AAPL --from 2024-01-02 --to 2024-01-31 --source csv`
  - `morningtrader backtest AAPL --from 2024-01-02 --to 2024-01-31 --source ibkr`
  - Validates date format (YYYY-MM-DD)
  - Validates --from is before --to
  - Validates --source is "csv" or "ibkr"
  - Progress output during multi-day run
  - Summary report at completion
  - Exit code 0 on success, 1 on error
- **Files**:
  - `src/cli/commands/backtest.ts`

---

### T053 - Implement CLI: Report Command
- **Phase**: 3
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T048, T042, T050
- **Priority**: P1
- **Effort**: S (< 1hr)
- **Status**: BACKLOG
- **Acceptance Criteria**:
  - `morningtrader report --period weekly [--from --to]`
  - Supports periods: daily, weekly, monthly, custom
  - Reads from SQLite storage
  - Displays formatted metrics to console
  - Handles empty data gracefully
- **Files**:
  - `src/cli/commands/report.ts`

---

### T054 - Implement CLI: Export Command
- **Phase**: 3
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T048, T042, T050
- **Priority**: P1
- **Effort**: S (< 1hr)
- **Status**: BACKLOG
- **Acceptance Criteria**:
  - `morningtrader export --format csv --output trades.csv`
  - Supports formats: csv, json
  - Supports --output flag for file path (defaults to stdout)
  - Supports --from / --to date filtering
  - Supports --symbol filtering
  - Writes to file or stdout
- **Files**:
  - `src/cli/commands/export.ts`

---

### T055 - Implement CLI: Config Command
- **Phase**: 3
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T004 (DONE), T009 (DONE), T050 (DONE)
- **Priority**: P2
- **Effort**: S (< 1hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - `morningtrader config --show` displays current configuration
  - Shows merged config (defaults + overrides)
  - Validates config against Zod schema
  - Redacts sensitive fields (IBKR credentials if any)
- **Files**:
  - `src/cli/commands/config.ts`

---

### T056 - Implement CLI Dashboard (Console Output)
- **Phase**: 3
- **Assigned Agent**: Frontend Developer
- **Dependencies**: T004 (DONE)
- **Priority**: P2
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - Formatted console output per bar during live session:
    - Current bar: time, OHLCV, direction indicators
    - Zone: resistance/support levels, spread
    - Signals: break/retest/confirm indicators
    - Trade: entry price, current R, stop level, targets
    - Session status
  - Updates in-place (clears previous line or uses cursor movement)
  - Colors for key indicators (green=bullish, red=bearish)
  - Works on Windows and Unix terminals
- **Files**:
  - `src/cli/dashboard.ts`

---

### T057 - Implement App Bootstrap (DI Wiring)
- **Phase**: 3
- **Assigned Agent**: Backend Architect
- **Dependencies**: T042, T044, T045, T046, T047, T048, T049, T030
- **Priority**: P0 (critical path)
- **Effort**: M (1-3hr)
- **Status**: BACKLOG
- **Acceptance Criteria**:
  - Wires all dependencies based on execution mode (live/mock/backtest)
  - Creates correct MarketDataProvider (IBKRAdapter or BacktestAdapter)
  - Creates correct OrderExecutionProvider (IBKROrderAdapter, MockOrderAdapter, or null for dry-run)
  - Creates StorageProvider (SQLiteAdapter or null for dry-run)
  - Creates Clock (SystemClock or SimulatedClock)
  - Creates Logger, Scheduler, SessionRunner, ShutdownManager
  - Config loading: merges default.json + CLI overrides
  - Validates final config with Zod
  - Exports factory functions for CLI commands to use
- **Files**:
  - `src/app.ts`

---

### T058 - Integration Tests: SQLite CRUD
- **Phase**: 3
- **Assigned Agent**: Database Architect
- **Dependencies**: T042
- **Priority**: P1
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - Tests use temporary database (deleted after test)
  - saveSession + getSession roundtrip
  - saveTrade + getTradesByDateRange roundtrip
  - saveTradeOutcome + getOutcomesByDateRange roundtrip
  - saveSignals + verify count
  - hasCompletedSession returns true/false correctly
  - UNIQUE constraint enforced on duplicate (date, symbol, is_backtest)
  - Foreign key constraints enforced
  - Date range filtering works correctly
  - Symbol filtering works correctly
  - Empty results handled gracefully
  - All tests pass with `npm run test:integration`
- **Files**:
  - `tests/integration/sqlite-crud.test.ts`

---

### T059 - Integration Tests: Full Session with Mock Data
- **Phase**: 3
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T057
- **Priority**: P0
- **Effort**: L (3-6hr)
- **Status**: BACKLOG
- **Acceptance Criteria**:
  - End-to-end test: BacktestAdapter -> SessionRunner -> XState actor -> MockOrderAdapter -> SQLiteAdapter
  - Uses test fixture CSV data
  - Verifies session persisted to SQLite correctly
  - Verifies trade and outcome persisted correctly
  - Verifies signals persisted correctly
  - Verifies order placed via MockOrderAdapter
  - Verifies metrics computation from stored data
  - Tests dry-run mode: no storage writes, no orders
  - Tests mock mode: storage writes, mock orders
  - All tests pass with `npm run test:integration`
- **Files**:
  - `tests/integration/full-session.test.ts`

---

### T060 - CLI Smoke Tests
- **Phase**: 3
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T057, T050, T051, T052, T053, T054, T055
- **Priority**: P1
- **Effort**: M (1-3hr)
- **Status**: BACKLOG
- **Acceptance Criteria**:
  - `morningtrader --help` exits 0 with usage text
  - `morningtrader --version` prints version
  - `morningtrader live` (no symbol) exits 1 with error message
  - `morningtrader backtest AAPL --from 2024-01-02 --to 2024-01-31 --source csv` runs against fixtures without error
  - `morningtrader report` with empty database shows "no data" message
  - `morningtrader export --format csv` with empty database produces headers only
  - `morningtrader config --show` displays configuration
  - All tests pass with `npm run test:e2e`
- **Files**:
  - `tests/e2e/cli-smoke.test.ts`

---

### T061 - Code Review: Storage Layer
- **Phase**: 3
- **Assigned Agent**: Code Reviewer
- **Dependencies**: T042, T058
- **Priority**: P1
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - SQLite schema matches plan exactly
  - WAL mode enabled
  - Transactions used for multi-table writes
  - Prepared statements used (no SQL injection risk)
  - Foreign keys and constraints enforced
  - Migration system works correctly
  - Integrity check on startup
  - All CRUD operations correctly map to/from TypeScript types
  - Integration tests are comprehensive
  - Feedback documented and addressed
- **Files**: (review only)
  - `src/adapters/storage/*.ts`
  - `tests/integration/sqlite-crud.test.ts`

---

### T062 - Code Review: CLI and Operations Layer
- **Phase**: 3
- **Assigned Agent**: Architect Reviewer
- **Dependencies**: T057, T060
- **Priority**: P1
- **Effort**: M (1-3hr)
- **Status**: BACKLOG
- **Acceptance Criteria**:
  - DI wiring in app.ts is correct for all modes
  - CLI commands validate inputs properly
  - Shutdown manager handles all cases orderly
  - Scheduler calculates session windows correctly
  - Reporter formats output correctly
  - Logger configuration is appropriate
  - No missing error handling paths
  - Smoke tests cover all commands
  - End-to-end flow works for live (mock), backtest, report, export
  - Feedback documented and addressed
- **Files**: (review only)
  - `src/app.ts`
  - `src/cli/**/*.ts`
  - `src/services/*.ts`
  - `tests/e2e/cli-smoke.test.ts`

---

### T063 - Graceful Shutdown Integration Test
- **Phase**: 3
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T047, T057
- **Priority**: P1
- **Effort**: M (1-3hr)
- **Status**: BACKLOG
- **Acceptance Criteria**:
  - Send SIGINT during live session (mock mode)
  - Verify session status changes to INTERRUPTED
  - Verify open position gets SESSION_TIMEOUT outcome
  - Verify SQLite writes are flushed
  - Verify IBKR connection closed (or mock equivalent)
  - Verify process exits with code 0
  - All tests pass with `npm run test:e2e`
- **Files**:
  - `tests/e2e/graceful-shutdown.test.ts`

---

### T064 - Performance Review: Pacing and Data Pipeline
- **Phase**: 3
- **Assigned Agent**: Performance Engineer
- **Dependencies**: T015, T030
- **Priority**: P2
- **Effort**: M (1-3hr)
- **Status**: BACKLOG
- **Acceptance Criteria**:
  - Pacing manager does not introduce unnecessary latency (< 50ms overhead per request under normal conditions)
  - Bar pipeline processes bars within 10ms (normalize + validate + emit)
  - SQLite writes complete within 50ms per transaction
  - Memory usage stays stable during long sessions (no Observable leaks)
  - Backtest runner processes 1 month of data in < 5 seconds
  - Report documented with findings
- **Files**: (review only, no creation)

---

## PHASE 4: IBKR Historical Backtest Support

### T065 - Wire IBKR Historical Source into BacktestRunner
- **Phase**: 4
- **Assigned Agent**: Backend Architect
- **Dependencies**: T015 (DONE), T031 (DONE)
- **Priority**: P0 (blocks backtest --source ibkr)
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - `BacktestRunner` constructor accepts an optional `MarketDataProvider` parameter for IBKR historical data
  - `loadBarsForDate()` when `source === 'ibkr'`:
    1. Calls `provider.getHistoricalBars(symbol, zoneStartUtc, executionEndUtc)` using the injected `MarketDataProvider`
    2. Uses `etToUtc(date, '09:30')` and `etToUtc(date, '11:00')` for the time range (covering the full session window)
    3. Returns the bars array (already normalized and validated by IBKRAdapter)
  - Falls back to CSV if `source === 'csv'` (existing behavior unchanged)
  - Respects IBKR pacing limits (IBKRAdapter's PacingManager handles this transparently)
  - Error messages are clear if IBKR connection is not available
  - `npm run build` zero errors, existing tests still pass
- **Files**:
  - `src/services/backtest-runner.ts` (modify: add `historicalProvider` constructor param, implement IBKR branch in `loadBarsForDate`)
- **Implementation Notes**:
  - `IBKRAdapter.getHistoricalBars()` is already fully implemented (T015) — handles contract resolution, pacing, bar normalization, and validation
  - The only gap is plumbing: BacktestRunner needs to receive the IBKRAdapter and call it
  - Per-day bars are fetched one day at a time; the PacingManager's 60/10min global limit means ~60 days max per 10-minute window (well above typical backtest ranges)
  - Consider adding a small delay (1-2s) between days to be polite to IBKR pacing

---

### T066 - Add IBKR Bootstrap Path for Backtest Mode
- **Phase**: 4
- **Assigned Agent**: Backend Architect
- **Dependencies**: T065 (DONE), T057 (DONE)
- **Priority**: P0 (blocks backtest --source ibkr)
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - `bootstrapBacktest()` in `app.ts` accepts a new `source: 'csv' | 'ibkr'` option
  - When `source === 'ibkr'`:
    1. Creates IBKR infrastructure: `ConnectionManager`, `PacingManager`, `ContractResolver`, `IBApiNext` instance
    2. Creates `IBKRAdapter` and calls `connect()` to establish TWS/Gateway connection
    3. Passes `IBKRAdapter` as the `historicalProvider` to `BacktestRunner`
    4. Registers IBKR cleanup (disconnect) in the shutdown handler
  - When `source === 'csv'`: existing behavior unchanged (no IBKR connection)
  - `AppContext` type extended with optional `ibkrAdapter` field for cleanup
  - `shutdown()` function disconnects IBKR adapter if present
  - IBKR connection uses config values: `ibkr.host`, `ibkr.port`, `ibkr.clientId`
  - Clear error message if TWS/Gateway is not running
  - `npm run build` zero errors, existing tests still pass
- **Files**:
  - `src/app.ts` (modify: add IBKR creation logic to `bootstrapBacktest`, extend `AppContext`)
- **Implementation Notes**:
  - Reuse the same IBKR component creation pattern from `bootstrapLive()`
  - The IBKRAdapter connects once and stays connected for the entire backtest run
  - Consider using `marketDataType: 1` (REALTIME) or allowing config override since this is historical-only

---

### T067 - Pass IBKR Adapter through CLI Backtest Command
- **Phase**: 4
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T066 (DONE), T052 (DONE)
- **Priority**: P1
- **Effort**: S (< 1hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - `runBacktestCommand()` in `backtest.ts` passes `options.source` to `bootstrapBacktest()`
  - `BacktestRunner` is constructed with the IBKR historical provider from the bootstrap context (when source is 'ibkr')
  - When `--source ibkr`, the CLI prints a connecting message before the backtest starts
  - Graceful error handling if IBKR connection fails (print user-friendly message, exit cleanly)
  - `morningtrader backtest SPY --from 2025-09-01 --to 2025-09-30 --source ibkr` works end-to-end with TWS running
  - `morningtrader backtest SPY --from ... --to ... --source csv` still works unchanged
  - `npm run build` zero errors, existing tests still pass
- **Files**:
  - `src/cli/commands/backtest.ts` (modify: pass source to bootstrap, wire up historical provider)

---

### T068 - Integration Tests: IBKR Historical Backtest Source
- **Phase**: 4
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T065, T066, T067
- **Priority**: P1
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Started**: 2026-02-12
- **Completed**: 2026-02-12
- **Acceptance Criteria**:
  - Unit tests for `BacktestRunner.loadBarsForDate()` with a mock `MarketDataProvider`:
    - Calls `getHistoricalBars()` with correct time range when source is 'ibkr'
    - Returns bars from the provider
    - Handles provider returning empty array (no data for date)
    - Handles provider throwing an error (connection lost)
    - Falls through to CSV path when source is 'csv' (existing behavior)
  - Integration test (skippable, requires TWS):
    - `BacktestRunner.runBacktest()` with `source: 'ibkr'` fetches real historical data for 1-2 days
    - Bars are valid Candle objects with correct timestamp range
  - All tests pass with `npm run test:unit`
- **Files**:
  - `tests/integration/ibkr-historical-backtest.test.ts` (new)
- **Notes**:
  - Created comprehensive integration test suite with 4 test suites:
    1. BacktestRunner with IBKR Historical Data Source (7 tests, requires IBKR connection, skipped by default)
    2. IBKRAdapter.getHistoricalBars() Direct Tests (4 tests, requires IBKR connection, skipped by default)
    3. BacktestRunner with Mock MarketDataProvider (4 tests, always run)
    4. CLI Integration (2 tests, requires IBKR connection, skipped by default)
  - Mock provider tests verify delegation and error handling without IBKR connection
  - Real IBKR tests are skipped unless IBKR_TEST_ENABLED=1 environment variable is set
  - All 4 mock provider tests pass successfully
  - No regressions in existing integration tests

---

### T069 - Code Review: IBKR Historical Backtest Feature
- **Phase**: 4
- **Assigned Agent**: Code Reviewer
- **Dependencies**: T065, T066, T067, T068
- **Priority**: P1
- **Effort**: M (1-3hr)
- **Status**: REVIEW
- **Started**: 2026-02-12
- **Acceptance Criteria**:
  - [x] Verify BacktestRunner correctly delegates to IBKRAdapter.getHistoricalBars()
  - [x] Verify IBKR connection lifecycle (connect before backtest, disconnect after)
  - [x] Verify pacing compliance (no manual delays needed, PacingManager handles it)
  - [x] Verify error handling for connection failures, data gaps, and empty responses
  - [x] Verify no regressions in CSV-source backtest path
  - [x] Verify clean shutdown disconnects IBKR if connected
  - [x] No secrets or credentials in code or logs
  - [x] Build clean, all existing tests pass
- **Files**: (reviewed)
  - `src/services/backtest-runner.ts`
  - `src/app.ts`
  - `src/cli/commands/backtest.ts`
  - `src/adapters/ibkr/ibkr-adapter.ts`
  - `src/adapters/backtest/backtest-adapter.ts`
  - `tests/integration/ibkr-historical-backtest.test.ts`
- **Review Findings**:
  - Architecture: PASS - clean boundaries, correct DI, no layer violations
  - IBKR Integration: PASS - pacing, bar normalization, date conversion all correct
  - Data Correctness: PASS - integer cents, UTC timestamps, OHLC validation
  - Error Handling: PASS - robust per-day catch, clear error messages, clean shutdown
  - Code Quality: PASS - no console.log, ESM extensions correct, follows patterns
  - Testing: 1 issue found (T069-fix1)
  - No regressions: 12/12 existing backtest scenario tests pass
- **Issue Found (T069-fix1)**:
  - Test `'throws error when source=ibkr but no historicalProvider passed'` (line 343) is in the IBKR-dependent `describeIf` block but does not need IBKR
  - The test asserts `rejects.toThrow()` but `BacktestRunner.runBacktest()` catches the error in its per-day try/catch and records it in `errorDates` -- it does NOT throw
  - Fix: move test to Mock Provider suite, change assertion to check `result.errorDates`

---

### T069-fix1 - Fix Test Placement and Assertion in IBKR Backtest Tests
- **Phase**: 4
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T069 (review finding)
- **Priority**: P1
- **Effort**: S (< 1hr)
- **Status**: DONE
- **Completed**: 2026-02-13
- **Changes Made**:
  - Moved test from IBKR-dependent `describeIf` block (line 343) to Mock Provider suite (line 634)
  - Changed test name to "records error when source=ibkr but no historicalProvider passed"
  - Updated assertion from `rejects.toThrow()` to check `result.errorDates[0].error` and `result.sessions.length`
  - Fixed time range assertion in existing test (11:00 → 12:00) to match BacktestRunner changes
  - All 5 mock provider tests pass (16 total: 5 pass, 11 skipped for IBKR)
- **Files**:
  - `tests/integration/ibkr-historical-backtest.test.ts`
  - The correct assertion pattern matches the existing test at line 563 ('handles provider returning empty array')

---

# ============================================================
# CRITICAL PATH
# ============================================================

The critical path is the longest chain of dependent tasks that determines the minimum project duration.

```
T001 (M:2h) -> T002 (S:0.5h) -> T004 (M:2h) -> T021 (S:0.5h) -> T022 (L:4.5h)
    -> T023 (L:4.5h) [also needs T025] -> T024 (L:4.5h) -> T030 (L:4.5h)
    -> T057 (M:2h) [also needs T042,T044-T049] -> T059 (L:4.5h) -> T062 (M:2h)

Estimated critical path duration: ~32 hours of sequential work
```

Detailed critical path with all blocking dependencies shown:

```
T001 ─── T002 ─── T004 ─┬── T021 ── T022 ──┐
                         │                   │
                         └── T025 ───────────┴── T023 ── T024 ── T030 ──┐
                                                                         │
         T001 ── T009                                                    │
         T002 ── T003 ── T041 ── T042 ──────────────────────────────────┐│
         T003 ── T044 ──────────────────────────────────────────────────┤│
         T003 ── T047 ──────────────────────────────────────────────────┤│
         T001 ── T049 ──────────────────────────────────────────────────┤│
         T004 ── T026 ── T048 ──────────────────────────────────────────┤│
         T003,T015 ── T045 ─────────────────────────────────────────────┤│
         T005,T008 ── T046 ─────────────────────────────────────────────┤│
                                                                        ││
                                                           T057 ────────┘│
                                                             │            │
                                                             └── T059 ── T062
```

---

# ============================================================
# PARALLEL EXECUTION PLAN
# ============================================================

Tasks grouped into waves. All tasks within a wave can run simultaneously.

## Wave 1 (Start)
| ID | Title | Agent | Effort |
|----|-------|-------|--------|
| T001 | Initialize project scaffolding | DevOps Engineer | M |

## Wave 2 (after T001)
| ID | Title | Agent | Effort |
|----|-------|-------|--------|
| T002 | Create directory structure | DevOps Engineer | S |
| T009 | Create configuration files | DevOps Engineer | S |
| T049 | Implement logger (Pino) | DevOps Engineer | S |
| T050 | Implement CLI framework | Fullstack Developer | S |

## Wave 3 (after T002)
| ID | Title | Agent | Effort |
|----|-------|-------|--------|
| T003 | Implement core interfaces | Backend Architect | M |
| T004 | Implement core data models | Backend Architect | M |
| T005 | Implement time utilities | Fullstack Developer | M |
| T006 | Implement math utilities | Fullstack Developer | S |

## Wave 4 (after T003 + T004)
| ID | Title | Agent | Effort |
|----|-------|-------|--------|
| T007 | Implement bar utility functions | Fullstack Developer | S |
| T008 | Implement holiday calendar | Fullstack Developer | S |
| T010 | Implement IBKR bar normalizer | Backend Architect | M |
| T011 | Implement IBKR bar validator | Backend Architect | S |
| T012 | Implement IBKR pacing manager | Performance Engineer | L |
| T013 | Implement IBKR contract resolver | Backend Architect | M |
| T014 | Implement IBKR connection manager | Backend Architect | L |
| T019 | Code review: models + interfaces | Architect Reviewer | M |
| T021 | Implement strategy event types | Backend Architect | S |
| T025 | Implement risk calculator | Fullstack Developer | M |
| T026 | Implement metrics aggregator | Fullstack Developer | M |
| T041 | Implement SQLite schema | Database Architect | M |
| T044 | Implement mock order adapter | Fullstack Developer | M |
| T047 | Implement shutdown manager | Backend Architect | M |

## Wave 5 (after Wave 4 completes relevant items)
| ID | Title | Agent | Effort |
|----|-------|-------|--------|
| T015 | Implement IBKRAdapter | Backend Architect | XL |
| T016 | Unit tests: normalizer + validator | Fullstack Developer | M |
| T017 | Unit tests: pacing manager | Performance Engineer | M |
| T018 | Unit tests: time, math, bar-utils | Fullstack Developer | M |
| T022 | Implement strategy guards | Backend Architect | L |
| T027 | Implement CSV loader | Fullstack Developer | M |
| T028 | Implement replay engine + SimClock | Backend Architect | M |
| T036 | Unit tests: risk calculator | Fullstack Developer | M |
| T037 | Unit tests: metrics aggregator | Fullstack Developer | M |
| T042 | Implement SQLite adapter | Database Architect | L |
| T043 | Implement SQLite query modules | Database Architect | M |
| T046 | Implement scheduler | Fullstack Developer | M |

## Wave 6 (after Wave 5 completes relevant items)
| ID | Title | Agent | Effort |
|----|-------|-------|--------|
| T020 | Code review: IBKR adapter | Code Reviewer | M |
| T020a | Security review: IBKR + orders | Security Auditor | M |
| T023 | Implement strategy actions | Backend Architect | L |
| T029 | Implement backtest adapter | Fullstack Developer | M |
| T032 | Create test fixture CSVs | Fullstack Developer | L |
| T033 | Unit tests: strategy guards | Fullstack Developer | L |
| T045 | Implement IBKR order adapter | Backend Architect | L |
| T048 | Implement reporter service | Fullstack Developer | M |
| T056 | Implement CLI dashboard | Frontend Developer | M |
| T058 | Integration tests: SQLite CRUD | Database Architect | M |

## Wave 7 (after Wave 6 completes relevant items)
| ID | Title | Agent | Effort |
|----|-------|-------|--------|
| T024 | Implement XState strategy machine | Backend Architect | L |
| T034 | Unit tests: strategy actions | Fullstack Developer | M |
| T061 | Code review: storage layer | Code Reviewer | M |

## Wave 8 (after Wave 7 completes relevant items)
| ID | Title | Agent | Effort |
|----|-------|-------|--------|
| T030 | Implement session runner | Backend Architect | L |
| T031 | Implement backtest runner | Fullstack Developer | L |
| T035 | Unit tests: machine transitions | Backend Architect | XL |

## Wave 9 (after Wave 8 completes relevant items)
| ID | Title | Agent | Effort |
|----|-------|-------|--------|
| T038 | Integration tests: backtest scenarios | Fullstack Developer | XL |
| T039 | Code review: strategy engine | Architect Reviewer | L |
| T057 | Implement app bootstrap (DI) | Backend Architect | M |

## Wave 10 (after Wave 9 completes relevant items)
| ID | Title | Agent | Effort |
|----|-------|-------|--------|
| T040 | Code review: backtest framework | Code Reviewer | M |
| T051 | Implement CLI: live command | Fullstack Developer | M |
| T052 | Implement CLI: backtest command | Fullstack Developer | M |
| T053 | Implement CLI: report command | Fullstack Developer | S |
| T054 | Implement CLI: export command | Fullstack Developer | S |
| T055 | Implement CLI: config command | Fullstack Developer | S |
| T059 | Integration tests: full session | Fullstack Developer | L |

## Wave 11 (after Wave 10 completes)
| ID | Title | Agent | Effort |
|----|-------|-------|--------|
| T060 | CLI smoke tests | Fullstack Developer | M |
| T063 | Graceful shutdown integration test | Fullstack Developer | M |
| T064 | Performance review | Performance Engineer | M |

## Wave 12 (Final)
| ID | Title | Agent | Effort |
|----|-------|-------|--------|
| T062 | Code review: CLI + operations | Architect Reviewer | M |

---

# ============================================================
# RISK REGISTER
# ============================================================

| Risk ID | Task(s) | Risk Description | Likelihood | Impact | Mitigation |
|---------|---------|-----------------|------------|--------|------------|
| R001 | T015 | **@stoqey/ib API instability**: The `@stoqey/ib` library may have undocumented behavior, breaking changes, or incomplete TypeScript types. This is the most external-dependency-heavy task. | HIGH | HIGH | Pin exact version (^1.5.3). Wrap ALL calls behind MarketDataProvider interface. Write integration tests with real TWS paper trading. Have fallback plan to fork/patch the library. Budget extra time (XL estimate). |
| R002 | T024, T035 | **XState v5 parallel state complexity**: The parallel longTrack/shortTrack with superseding is the most complex piece of state logic. XState v5 API differences from v4 may cause surprises. | MEDIUM | HIGH | Study XState v5 docs thoroughly before starting. Write machine tests incrementally (test each state before wiring the full machine). Keep a reference to XState v5 migration guide. Budget XL for testing. |
| R003 | T032 | **Hand-calculated test fixtures**: Creating 9 CSV files with correct hand-calculated R-multiples is tedious and error-prone. Incorrect expected values will cause false test failures. | MEDIUM | MEDIUM | Create a spreadsheet to calculate expected values. Have a second person verify calculations. Start with simplest scenarios (choppy, clean breakout) and build up complexity. |
| R004 | T005, T018 | **DST edge cases in time handling**: Daylight Saving Time transitions (spring forward/fall back) are a notorious source of bugs. The date-fns/tz library version matters. | MEDIUM | HIGH | Pin `@date-fns/tz` >= 1.2.0 (has constructFrom fix). Test explicitly for 2024-03-10 and 2024-11-03. Never compare TZDate objects by reference. Always use `.getTime()`. |
| R005 | T010, T015 | **IBKR bar completion detection**: The one-bar buffer algorithm for detecting completed bars may have edge cases (e.g., market open, last bar of day, halts). | MEDIUM | MEDIUM | Test with real TWS paper data. Add logging for buffer state transitions. Handle SESSION_END flush case explicitly. Monitor for stale buffers. |
| R006 | T042 | **SQLite WAL mode on Windows**: WAL mode can have file locking issues on certain Windows configurations (network drives, anti-virus). | LOW | HIGH | Test on target Windows machine. Fall back to DELETE journal mode if WAL fails. Use absolute file paths. Ensure data/ directory is on local drive. |
| R007 | T045 | **Live order execution**: Any bugs in live order placement could result in financial loss. This is the highest-risk task from a real-world impact perspective. | LOW | CRITICAL | Extensive paper trading testing before any live use. Config switch defaults to MOCK. Multiple confirmation checks before order submission. Position sizing limits. Kill switch via ShutdownManager. |
| R008 | T012, T017 | **IBKR pacing violations**: Getting the 3-tier pacing right is tricky. Violations lead to IBKR temporarily banning requests, which degrades the session. | MEDIUM | MEDIUM | Conservative initial limits (below IBKR maximums). Logging of all pacing decisions. Backoff on 420 error codes. Test with burst scenarios using fake timers. |
| R009 | T014 | **IBKR reconnection backfill**: The backfill algorithm after reconnection must correctly dedup bars and feed them in order. Bugs here cause duplicate signals or missed bars. | MEDIUM | HIGH | Extensive unit testing of dedup logic. Log all backfill operations. Validate bar timestamp ordering after backfill. Mark session as DEGRADED if backfill fails. |
| R010 | T057 | **DI wiring complexity**: app.ts must correctly wire 8+ services with mode-dependent implementations. Missing or incorrect wiring causes runtime failures not caught by TypeScript. | MEDIUM | MEDIUM | Integration test that bootstraps each mode (live-mock, backtest, dry-run). Validate all providers are non-null before starting session. Use factory pattern with type guards. |

---

# ============================================================
# AGENT WORKLOAD SUMMARY
# ============================================================

| Agent | Task Count | Total Effort | Key Responsibilities |
|-------|-----------|-------------|---------------------|
| **Backend Architect** | 16 | ~40h | Interfaces, models, IBKR adapter, strategy engine, session runner, app bootstrap |
| **Fullstack Developer** | 24 | ~45h | Utils, tests, backtest framework, CLI commands, integration tests |
| **DevOps Engineer** | 4 | ~4h | Scaffolding, directory structure, config files, logger |
| **Database Architect** | 5 | ~12h | SQLite schema, adapter, queries, CRUD tests |
| **Performance Engineer** | 3 | ~8h | Pacing manager, pacing tests, performance review |
| **Code Reviewer** | 3 | ~6h | IBKR review, backtest review, storage review |
| **Architect Reviewer** | 3 | ~8h | Models/interfaces review, strategy review, CLI/ops review |
| **Security Auditor** | 1 | ~2h | IBKR connection + order security review |
| **Frontend Developer** | 1 | ~2h | CLI dashboard |
| **UI/UX Designer** | 0 | 0h | No tasks (CLI-only project) |
| **Debugger** | 0 | 0h | On-call for risk items R001, R002, R005 |
| **API Documenter** | 0 | 0h | No tasks (interfaces are self-documenting) |

---

# ============================================================
# STATUS SUMMARY
# ============================================================

| Status | Count |
|--------|-------|
| BACKLOG | 0 |
| READY | 0 |
| IN PROGRESS | 0 |
| REVIEW | 2 (T069, T084) |
| DONE | 89 (T001-T068, T070-T083, T069-fix1, T084-fix1, T084-fix2, T084-fix3, T084-fix4, T084-fix5, including T020a) |

**Total tasks**: 91 (64 original + 6 Phase 4 + 21 Phase 5)
**Phase 1-3**: COMPLETE (64/64 tasks DONE)
**Phase 4** (IBKR Historical Backtest): 5/6 done (83%), 1 REVIEW (T069)
**Phase 5** (Web Dashboard): 20/21 done (95%), 1 REVIEW (T084)
**Wave 13**: DONE (T065+T066+T067+T068)
**Wave 14**: REVIEW (T069), DONE (T069-fix1)
**Wave 15**: DONE (T070-T078, T082 - backend infrastructure)
**Wave 16**: DONE (T079+T080+T081 - frontend pages)
**Wave 17**: DONE (T083 - web dashboard integration tests)
**Wave 18**: REVIEW (T084), DONE (T084-fix1/T084-fix2/T084-fix3/T084-fix4/T084-fix5)

# ============================================================
# PHASE 5: Web Dashboard
# ============================================================

## T070 - Create Migration 002 for Bars Table
- **Phase**: 5
- **Assigned Agent**: Database Architect
- **Dependencies**: T042 (SQLite adapter exists)
- **Priority**: P0 (critical path)
- **Effort**: S (< 1hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Notes**: Created `002-bars.ts` migration with bars table. Registered in migration runner.
- **Acceptance Criteria**:
  - Migration file creates bars table with proper indexes
  - All price columns are INTEGER (cents)
  - Foreign key to sessions(id)
  - Indexes on session_id and (session_id, timestamp)
- **Files**:
  - `src/adapters/storage/migrations/002-bars.ts`
  - `src/adapters/storage/migrations/index.ts`

---

## T071 - Extend StorageProvider Interface with Bar Methods
- **Phase**: 5
- **Assigned Agent**: Backend Architect
- **Dependencies**: T003 (StorageProvider interface exists)
- **Priority**: P0 (critical path)
- **Effort**: S (< 1hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Notes**: Added saveBars/getBarsBySessionId to StorageProvider interface.
- **Files**:
  - `src/core/interfaces/storage.ts`

---

## T072 - Implement Bar Persistence in SQLiteAdapter
- **Phase**: 5
- **Assigned Agent**: Database Architect
- **Dependencies**: T070, T071
- **Priority**: P0 (critical path)
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Notes**: Implemented saveBars() with transaction-based batch insert. Created dashboard queries module.
- **Files**:
  - `src/adapters/storage/sqlite-adapter.ts`
  - `src/adapters/storage/queries/dashboard.ts`
  - `src/adapters/storage/queries/index.ts`

---

## T073 - Update BacktestRunner to Persist Bars
- **Phase**: 5
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T072
- **Priority**: P0 (critical path)
- **Effort**: S (< 1hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Files**:
  - `src/services/backtest-runner.ts`

---

## T074 - Define Narrative Types and Implement NarrativeGenerator
- **Phase**: 5
- **Assigned Agent**: Backend Architect
- **Dependencies**: None
- **Priority**: P1 (important)
- **Effort**: L (3-6hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Notes**: Pure stateless function generating 7-section narratives.
- **Files**:
  - `src/services/narrative-types.ts`
  - `src/services/narrative-generator.ts`
  - `src/services/index.ts`

---

## T075 - Create Fastify Server and API Routes
- **Phase**: 5
- **Assigned Agent**: Backend Architect
- **Dependencies**: T072, T074
- **Priority**: P0 (critical path)
- **Effort**: L (3-6hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Notes**: Fastify server with 6 API routes. Read-only DB connection. CORS enabled.
- **Files**:
  - `src/web/server.ts`
  - `src/web/routes/*.ts` (4 files)
  - `src/web/serializers.ts`

---

## T076 - Create Dashboard CLI Command
- **Phase**: 5
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T075
- **Priority**: P1 (important)
- **Effort**: S (< 1hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Files**:
  - `src/cli/commands/dashboard.ts`
  - `src/cli/commands/index.ts`
  - `src/cli/index.ts`

---

## T077 - Add Web Config to AppConfig
- **Phase**: 5
- **Assigned Agent**: Backend Architect
- **Dependencies**: None
- **Priority**: P2 (nice-to-have)
- **Effort**: S (< 1hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Files**:
  - `src/core/models/config.ts`
  - `src/core/models/index.ts`

---

## T078 - Initialize React Frontend Project
- **Phase**: 5
- **Assigned Agent**: Frontend Developer
- **Dependencies**: None
- **Priority**: P0 (critical path)
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Notes**: Vite + React + TypeScript + Tailwind CSS. API client, layout, stub pages.
- **Files**:
  - `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`
  - `web/src/App.tsx`, `web/src/api/*.ts`
  - `web/src/components/layout/*.tsx`, `web/src/components/common/*.tsx`
  - `web/src/pages/*.tsx` (3 stub pages)

---

## T079 - Build Dashboard Page
- **Phase**: 5
- **Assigned Agent**: Frontend Developer
- **Dependencies**: T078
- **Priority**: P0 (critical path)
- **Effort**: L (3-6hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Notes**: Implemented with 5 metric cards, Recharts equity curve and win/loss pie chart, performance summary section. API integration with loading and error states.
- **Files**:
  - `web/src/pages/DashboardPage.tsx`

---

## T080 - Build Sessions List Page
- **Phase**: 5
- **Assigned Agent**: Frontend Developer
- **Dependencies**: T078
- **Priority**: P0 (critical path)
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Notes**: Implemented with filterable table (symbol and status filters), color-coded badges for status/direction/result, pagination, click-to-navigate to detail page.
- **Files**:
  - `web/src/pages/SessionsPage.tsx`

---

## T081 - Build Session Detail Page
- **Phase**: 5
- **Assigned Agent**: Frontend Developer
- **Dependencies**: T078
- **Priority**: P0 (critical path)
- **Effort**: XL (6+ hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Notes**: Implemented with TradingView lightweight-charts candlestick chart, zone/entry/target price lines, signal markers, ZoneCard and TradeCard components, NarrativeView with section rendering. Integrated with session detail and narrative APIs.
- **Files**:
  - `web/src/pages/SessionDetailPage.tsx`

---

## T082 - Update Build Scripts and Package.json
- **Phase**: 5
- **Assigned Agent**: DevOps Engineer
- **Dependencies**: T078
- **Priority**: P1 (important)
- **Effort**: S (< 1hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Files**:
  - `package.json`

---

## T083 - Integration Tests for Web Dashboard
- **Phase**: 5
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T075, T079, T080, T081
- **Priority**: P1 (important)
- **Effort**: M (1-3hr)
- **Status**: DONE
- **Completed**: 2026-02-12
- **Notes**: Comprehensive integration tests covering 6 test suites with 26 tests total. All tests pass. Covers: (1) Database layer - saveBars/getBarsBySessionId with OHLCV persistence, (2) Dashboard queries - data persistence for rendering, (3) API serialization logic - endpoint data preparation, (4) Serialization - cents→dollars and UTC→ET conversion with edge cases, (5) NarrativeGenerator - all 7 sections for win/loss/no-trade scenarios, (6) Full integration - complete workflow from save to retrieve to serialize to narrative generation. Tests use in-memory SQLite for speed and isolation. Code review (T084): tests are well-structured, good fixture helpers, comprehensive coverage.
- **Acceptance Criteria**:
  - ✅ Test saveBars + getBarsBySessionId
  - ✅ Test dashboard queries with fixture data
  - ✅ Test API endpoints (serialization logic)
  - ✅ Verify serialization (cents→dollars, UTC→ET)
  - ✅ Test narrative generation
- **Files**:
  - `tests/integration/web-dashboard.test.ts`

---

## T084 - Code Review: Web Dashboard
- **Phase**: 5
- **Assigned Agent**: Code Reviewer
- **Dependencies**: T079, T080, T081, T083
- **Priority**: P1 (important)
- **Effort**: M (1-3hr)
- **Status**: REVIEW
- **Started**: 2026-02-12
- **Notes**: Comprehensive review of 30+ files. Found 3 high, 5 medium, 6 low issues. Created 5 fix sub-tasks. Stays in REVIEW until fixes complete.
- **Acceptance Criteria**:
  - Database queries use prepared statements
  - Read-only DB connection for web
  - No SQL injection vulnerabilities
  - Proper error handling in API routes
  - Charts handle edge cases
  - All components properly typed
- **Files**: All Phase 5 files
- **Fix Tasks**: T084-fix1, T084-fix2, T084-fix3, T084-fix4, T084-fix5

---

## T084-fix1 - Fix Win Rate Double-Multiplication in DashboardPage
- **Phase**: 5
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T084
- **Priority**: P0 (critical - user-visible data error)
- **Effort**: S
- **Status**: DONE
- **Completed**: 2026-02-12
- **Description**: Backend returns winRate as percentage (66.67) but frontend multiplies by 100 again showing 6667.0%. Fix: either change backend to return decimal or frontend to not multiply. Also fix color threshold.
- **Files**: `src/web/routes/overview.ts`, `web/src/pages/DashboardPage.tsx`
- **Notes**: Fixed by changing backend to return decimal (0.6667) instead of percentage. Frontend correctly multiplies by 100 for display. Color threshold fixed to compare percentage value (>= 50) instead of decimal (>= 0.5). All integration tests pass.

---

## T084-fix2 - Fix Profit Factor Calculation and Remove Dead Variable
- **Phase**: 5
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T084
- **Priority**: P0 (critical - user-visible data error)
- **Effort**: S
- **Status**: DONE
- **Started**: 2026-02-12
- **Completed**: 2026-02-12
- **Description**: Implemented correct profit factor calculation (Gross Profit / abs(Gross Loss)) in backend and frontend.
- **Changes Made**:
  - Added `total_winning_r` and `total_losing_r` to dashboard query SQL (sum of positive/negative realized_r)
  - Updated `OverviewStatsRow` interface to include new fields
  - Fixed parameter passing for SQL queries (6 params for all, 9 for by-symbol)
  - Calculated profit factor in backend: `totalWinningR / abs(totalLosingR)` with edge case handling
  - Added `profitFactor` to API response and frontend types
  - Updated frontend to display backend profit factor value with "N/A" for edge cases
  - Added 3 integration tests verifying correct calculation
- **Files**:
  - `src/adapters/storage/queries/dashboard.ts`
  - `src/web/routes/overview.ts`
  - `web/src/api/types.ts`
  - `web/src/pages/DashboardPage.tsx`
  - `tests/integration/web-dashboard.test.ts`

---

## T084-fix3 - Clean Up Dead Code and Add Outcomes to Session Detail Endpoint
- **Phase**: 5
- **Assigned Agent**: Backend Architect
- **Dependencies**: T084
- **Priority**: P1
- **Effort**: M
- **Status**: DONE
- **Started**: 2026-02-13
- **Completed**: 2026-02-13
- **Description**: /api/sessions/:id has dead code blocks and missing outcomes. Add getOutcomesBySessionId to dashboard queries, include outcomes in response, remove dead code, update frontend types.
- **Changes Made**:
  - Added `outcomesBySessionId` prepared statement to dashboard queries
  - Added `getOutcomesBySessionId()` method returning outcomes joined with trades by session_id
  - Updated `/api/sessions/:id` endpoint to query and serialize outcomes
  - Updated `/api/sessions/:id/narrative` endpoint to use dashboard query instead of storage provider
  - Removed all dead code blocks (lines 117-126 and 234-240)
  - Removed `storage: StorageProvider` parameter from `registerSessionRoutes()`
  - Updated `server.ts` to call `registerSessionRoutes()` without storage parameter
  - Added `outcomes: Outcome[]` field to `SessionDetailResponse` interface
  - All TypeScript compilation passes (backend and frontend)
- **Files**: `src/web/routes/sessions.ts`, `src/adapters/storage/queries/dashboard.ts`, `src/web/server.ts`, `web/src/api/types.ts`

---

## T084-fix4 - Remove Read-Write SQLiteAdapter from Web Server
- **Phase**: 5
- **Assigned Agent**: Backend Architect
- **Dependencies**: T084-fix3
- **Priority**: P1
- **Effort**: S
- **Status**: DONE
- **Completed**: 2026-02-13
- **Description**: After fix3 provides proper outcome queries via read-only connection, remove the read-write SQLiteAdapter from server.ts entirely.
- **Changes Made**:
  - Removed SQLiteAdapter import
  - Removed storage adapter creation and initialization (lines 37-39)
  - Removed maintenance routes registration (lines 69-71)
  - Removed `storage.close()` from onClose hook
  - Dashboard server now operates purely with read-only Database connection
  - TypeScript compilation passes
- **Files**: `src/web/server.ts`
- **Notes**: Maintenance routes (DELETE /api/maintenance/backtest-sessions) removed as they required write access. Dashboard is now purely read-only for viewing trading data.

---

## T084-fix5 - Fix Command Injection Risk in Dashboard CLI Browser Open
- **Phase**: 5
- **Assigned Agent**: Fullstack Developer
- **Dependencies**: T084
- **Priority**: P1
- **Effort**: S
- **Status**: DONE
- **Completed**: 2026-02-13
- **Description**: Dashboard CLI uses exec(cmd + url) with unescaped string interpolation. Fix: use execFile or spawn with argument array.
- **Changes Made**:
  - Replaced `exec()` with `spawn()` for secure command execution
  - URL is now passed as separate argument instead of string concatenation
  - Windows: `cmd /c start "" <url>` (empty string is window title)
  - macOS: `open <url>`
  - Linux: `xdg-open <url>`
  - Added `detached: true, stdio: 'ignore'` and `.unref()` to prevent blocking
  - TypeScript compilation passes
- **Files**: `src/cli/commands/dashboard.ts`
- **Security**: Eliminates command injection risk by using argument array instead of shell string interpolation

