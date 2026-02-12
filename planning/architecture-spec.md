# MorningTrader - First Candle Strategy IBKR Trading Tool

## Context

Build a full-featured trading tool implementing the "First 30-Minute Candle Decision Zone" strategy using the Interactive Brokers (IBKR) API. The system connects to IBKR TWS/Gateway, defines a Decision Zone from 09:30-10:00 ET, evaluates 5-minute bars from 10:00-11:00 ET, enforces a strict break-retest-confirmation entry sequence, tracks R-based outcomes, and can execute real orders (with a config switch for mock/live execution). Supports **live trading**, **paper/mock trading**, and **historical backtesting** modes sharing the exact same strategy engine.

**Scope**: US equities only, prices >= $1.00 (integer cents representation).

---

## 1. Tech Stack & Project Structure

**Runtime**: Node.js 20+ / TypeScript 5.7+

**Key Dependencies**:
| Package | Purpose | Pin Strategy |
|---------|---------|-------------|
| `@stoqey/ib` ^1.5.3 | IBKR TypeScript client (IBApiNext) | Exact pin, wrap behind interface |
| `xstate` ^5.27 | State machine with parallel states | Semver range |
| `better-sqlite3` ^11.7 | Synchronous SQLite for trade logging | Semver range |
| `date-fns` ^4.1 + `@date-fns/tz` >=1.2.0 | Timezone-safe dates (TZDate) | Pin tz >=1.0.2 for constructFrom fix |
| `commander` ^12.1 | CLI framework | Semver range |
| `pino` ^9.5 + `pino-pretty` | Structured JSON logging | Semver range |
| `zod` ^3.24 | Runtime config/bar validation | Semver range |
| `rxjs` ^7.8 | Bar stream processing | Semver range |
| `vitest` ^2.1 | Testing framework | Dev only |

**Directory Layout**:
```
src/
  core/                          # Pure domain - ZERO external deps except xstate
    interfaces/
      market-data.ts             # MarketDataProvider interface
      order-execution.ts         # OrderExecutionProvider interface (mock/live)
      storage.ts                 # StorageProvider interface
      clock.ts                   # Clock interface (system/simulated)
      notification.ts            # NotificationProvider interface
      index.ts
    models/
      candle.ts                  # Candle type + utility fns (no BarSeries class)
      decision-zone.ts           # DecisionZone
      signal.ts                  # Signal types
      trade.ts                   # Trade, TradeOutcome
      session.ts                 # SessionContext
      config.ts                  # StrategyConfig, IBKRConfig, AppConfig
      index.ts
    strategy/
      machine.ts                 # XState v5 setup() + createMachine
      actions.ts                 # State machine assign actions
      guards.ts                  # Pure guard functions
      events.ts                  # StrategyEvent union type
      index.ts
    risk/
      calculator.ts              # R-multiple calculations, target computation
      index.ts
    metrics/
      aggregator.ts              # Win rate, profit factor, drawdown
      index.ts
  adapters/
    ibkr/
      ibkr-adapter.ts            # Implements MarketDataProvider
      ibkr-order-adapter.ts      # Implements OrderExecutionProvider (live)
      connection.ts              # ConnectionManager + reconnection
      contract-resolver.ts       # Contract resolution + caching
      pacing.ts                  # 3-tier pacing (15s dedup, 6/2s burst, 60/10min global)
      bar-normalizer.ts          # IBKR Bar -> Candle (formatDate=2 epoch seconds)
      bar-validator.ts           # Zod validation of incoming bars
      index.ts
    backtest/
      backtest-adapter.ts        # Implements MarketDataProvider
      csv-loader.ts              # Load bars from CSV
      replay-engine.ts           # Deterministic bar replay
      index.ts
    execution/
      mock-order-adapter.ts      # Implements OrderExecutionProvider (paper/backtest)
      index.ts
    storage/
      sqlite-adapter.ts          # Implements StorageProvider
      migrations/
        001-initial.ts           # Schema creation
      queries/
        trades.ts
        sessions.ts
        aggregations.ts
      index.ts
  services/
    scheduler.ts                 # Session window orchestration + market calendar
    session-runner.ts            # Single-session lifecycle
    backtest-runner.ts           # Multi-day batch backtesting
    reporter.ts                  # CSV/JSON export + console output
    shutdown-manager.ts          # Graceful SIGINT/SIGTERM handling
    logger.ts                    # Pino structured logging
  utils/
    time.ts                      # Timezone logic, session windows, DST
    math.ts                      # Integer-cents arithmetic, R calculations
    holidays.ts                  # NYSE holiday calendar (config file, not hardcoded)
    bar-utils.ts                 # getHighestHigh(), getLowestLow() pure fns
    index.ts
  cli/
    index.ts                     # Commander setup
    commands/
      live.ts                    # morningtrader live AAPL [--dry-run] [--mock]
      backtest.ts                # morningtrader backtest AAPL --from --to
      report.ts                  # morningtrader report --period weekly
      export.ts                  # morningtrader export --format csv
      config.ts                  # morningtrader config --show
    dashboard.ts                 # Formatted console output per bar
  app.ts                         # DI wiring / bootstrap
tests/
  unit/core/strategy/            # Guard + action + machine tests
  unit/core/risk/                # R calculator tests
  unit/core/metrics/             # Aggregator tests
  unit/utils/                    # Time, math, bar-utils tests
  unit/adapters/                 # BarNormalizer, pacing tests
  integration/                   # IBKR connection, SQLite CRUD
  fixtures/bars/                 # Scenario CSV files
  e2e/                           # Full session tests
data/                            # SQLite DB + exports (gitignored)
config/
  default.json                   # Default strategy/app config
  holidays.json                  # NYSE holiday calendar (updatable)
```

---

## 2. System Architecture

### Layer Diagram (dependencies point inward only)
```
┌─────────────────────────────────────────────────────────────────┐
│  CLI Layer          commands, dashboard, arg parsing            │
├─────────────────────────────────────────────────────────────────┤
│  Service Layer      Scheduler, SessionRunner, BacktestRunner,   │
│                     Reporter, ShutdownManager                   │
├─────────────────────────────────────────────────────────────────┤
│  Adapter Layer      IBKRAdapter, IBKROrderAdapter,              │
│                     MockOrderAdapter, BacktestAdapter,          │
│                     SQLiteAdapter                               │
├─────────────────────────────────────────────────────────────────┤
│  Core Layer         Models, Interfaces, Strategy Machine,       │
│                     Risk Calculator, Metrics Aggregator         │
│                     ** ZERO external runtime deps except xstate **
└─────────────────────────────────────────────────────────────────┘
```

**Critical rule**: `src/core/` NEVER imports from adapters/services/cli. All external deps injected via interfaces defined in `src/core/interfaces/`.

### Data Flow
```
                        ┌──────────────┐
                        │  IBKR TWS /  │
                        │  IB Gateway  │
                        └──────┬───────┘
                               │ socket
                        ┌──────▼───────┐
                        │ IBKRAdapter  │──── BarValidator ──── BarNormalizer
                        │ (or Backtest │      (Zod schema)     ($ -> cents,
                        │  Adapter)    │                        epoch -> UTC ms)
                        └──────┬───────┘
                               │ Observable<Candle>
                        ┌──────▼───────┐
                        │SessionRunner │──── filters by session windows
                        │              │     sends NEW_BAR events
                        └──────┬───────┘
                               │ events
                        ┌──────▼───────┐
                        │  XState      │──── guards evaluate break/retest/confirm
                        │  Actor       │     actions update context
                        │  (strategy   │     raises ENTRY_CONFIRMED -> OrderExecution
                        │   machine)   │
                        └──────┬───────┘
                               │ context snapshots
                  ┌────────────┼────────────┐
                  ▼            ▼            ▼
           ┌──────────┐ ┌──────────┐ ┌──────────┐
           │  Order   │ │  SQLite  │ │ Reporter │
           │ Executor │ │ Storage  │ │ (CSV/    │
           │(mock/live)│ │          │ │  JSON)   │
           └──────────┘ └──────────┘ └──────────┘
```

---

## 3. Core Interfaces

### 3.1 MarketDataProvider
```typescript
interface MarketDataProvider {
  connect(): Promise<void>
  disconnect(): Promise<void>
  readonly isConnected: boolean
  readonly connectionState$: Observable<'CONNECTED' | 'DISCONNECTING' | 'RECONNECTING' | 'DISCONNECTED'>
  readonly errors$: Observable<ProviderError>  // non-fatal errors
  resolveContract(symbol: string): Promise<ContractSpec>
  getHistoricalBars(symbol: string, startUtc: number, endUtc: number): Promise<Candle[]>
  subscribeBars(symbol: string): Observable<Candle>  // emits completed bars only
  unsubscribeBars(symbol: string): void
}
```

### 3.2 OrderExecutionProvider
```typescript
interface OrderExecutionProvider {
  readonly mode: 'LIVE' | 'MOCK'
  placeOrder(order: OrderRequest): Promise<OrderResult>
  cancelOrder(orderId: string): Promise<void>
  getOpenOrders(): Promise<Order[]>
  readonly fills$: Observable<Fill>
}

interface OrderRequest {
  symbol: string; direction: Direction; quantity: number
  orderType: 'MARKET' | 'LIMIT'; limitPrice?: number
  stopPrice?: number  // for stop-loss orders
}

interface OrderResult {
  orderId: string; status: 'SUBMITTED' | 'REJECTED'; reason?: string
}

interface Fill {
  orderId: string; fillPrice: number; filledQuantity: number
  timestamp: number; commission: number
}
```

### 3.3 StorageProvider
```typescript
interface StorageProvider {
  initialize(): void                    // run migrations
  saveSession(session: SessionContext): number  // returns session ID
  getSession(date: string, symbol: string): SessionContext | null
  hasCompletedSession(date: string, symbol: string): boolean
  saveTrade(trade: Trade, sessionId: number): void
  saveTradeOutcome(outcome: TradeOutcome): void
  saveSignals(signals: Signal[], sessionId: number): void
  getTradesByDateRange(from: string, to: string, symbol?: string): Trade[]
  getOutcomesByDateRange(from: string, to: string, symbol?: string): TradeOutcome[]
  getSessionsByDateRange(from: string, to: string, symbol?: string): SessionContext[]
  close(): void
}
```

### 3.4 Clock
```typescript
interface Clock {
  now(): number  // UTC milliseconds
  setTimeout(fn: () => void, ms: number): ClockTimer
  clearTimeout(timer: ClockTimer): void
  waitUntil(utcMs: number): Promise<void>
}
// SystemClock: real Date.now() + setTimeout
// SimulatedClock: advances with replayed bar timestamps, deterministic
```

### 3.5 NotificationProvider
```typescript
interface NotificationProvider {
  notify(event: NotificationEvent): void
}
// Events: ZONE_DEFINED, BREAK_DETECTED, ENTRY_SIGNAL, STOP_HIT, TARGET_HIT, SESSION_ERROR
// Implementations: ConsoleNotifier (v1), WebhookNotifier (future)
```

---

## 4. Data Models

All prices as **integer cents** (`Math.round(dollarPrice * 100)`). All timestamps as UTC milliseconds.

### Candle (plain type + utility functions, no class)
```typescript
type Candle = {
  readonly timestamp: number    // UTC ms, bar START time
  readonly open: number         // int cents
  readonly high: number         // int cents
  readonly low: number          // int cents
  readonly close: number        // int cents
  readonly volume: number
  readonly completed: boolean
  readonly barSizeMinutes: 5
}
// Utility fns in bar-utils.ts:
// getHighestHigh(bars: Candle[]): number
// getLowestLow(bars: Candle[]): number
// filterByTimeRange(bars: Candle[], startUtc: number, endUtc: number): Candle[]
```

### DecisionZone
```typescript
type DecisionZone = {
  readonly resistance: number   // highest HIGH 09:30-10:00, int cents (was 'a')
  readonly support: number      // lowest LOW 09:30-10:00, int cents (was 'b')
  readonly status: 'PENDING' | 'DEFINED' | 'NO_TRADE_CHOPPY' | 'EXPIRED'
  readonly spread: number       // resistance - support, int cents
  readonly definedAt: number    // UTC ms
  readonly sourceBars: readonly Candle[]
  readonly premarketPrice: number  // 0 if not recorded
}
```
**Choppy criteria**: At 10:00 ET, if the last received bar's CLOSE is strictly between `support` and `resistance`, status = `NO_TRADE_CHOPPY`. Additionally, configurable `minZoneSpreadCents` (default: 10 = $0.10) and `maxZoneSpreadPercent` (default: 3.0%) guard against degenerate zones.

### Signal
```typescript
type Signal = {
  readonly direction: 'LONG' | 'SHORT'
  readonly type: 'BREAK' | 'RETEST' | 'CONFIRMATION' | 'BREAK_FAILURE'
  readonly timestamp: number
  readonly price: number        // int cents
  readonly triggerCandle: Candle
  readonly attemptNumber: number
}
```

### Trade
```typescript
type Trade = {
  readonly id: string           // {date}_{symbol}_{direction}_{attemptN}
  readonly symbol: string
  readonly direction: 'LONG' | 'SHORT'
  readonly entryPrice: number   // confirmation candle CLOSE, int cents
  readonly stopLevel: number    // initial stop: resistance (long) / support (short)
  readonly currentStop: number  // moves to entryPrice after 1R
  readonly rValue: number       // |entry - stop|, int cents
  readonly target1R: number
  readonly target2R: number
  readonly target3R: number
  readonly entryTimestamp: number
  readonly status: 'OPEN' | 'STOPPED_OUT' | 'TARGET_HIT' | 'SESSION_EXPIRED'
  readonly entrySignal: Signal
}
```

### TradeOutcome
```typescript
type TradeOutcome = {
  readonly tradeId: string
  readonly result: 'LOSS' | 'BREAKEVEN_STOP' | 'WIN_2R' | 'WIN_3R' | 'SESSION_TIMEOUT'
  readonly maxFavorableR: number   // uses bar HIGH (long) or LOW (short)
  readonly maxAdverseR: number     // uses bar LOW (long) or HIGH (short)
  readonly exitPrice: number       // int cents
  readonly exitTimestamp: number
  readonly realizedR: number       // float, rounded to 2 decimals
  readonly firstThresholdReached: 0 | 1 | 2 | 3
  readonly timestamp1R: number     // 0 if never
  readonly timestamp2R: number
  readonly timestamp3R: number
  readonly timestampStop: number
  readonly barsHeld: number
}
```
- `BREAKEVEN_STOP`: reached 1R, stop moved to entry, then stop triggered at entry price.

### SessionContext
```typescript
type SessionContext = {
  readonly date: string          // YYYY-MM-DD (ET)
  readonly symbol: string
  readonly zone: DecisionZone | null
  readonly signals: readonly Signal[]
  readonly trades: readonly Trade[]
  readonly outcomes: readonly TradeOutcome[]
  readonly allBars: readonly Candle[]
  readonly status: 'WAITING' | 'BUILDING_ZONE' | 'MONITORING' | 'NO_TRADE' | 'COMPLETE' | 'INTERRUPTED' | 'ERROR'
  readonly isBacktest: boolean
  readonly executionMode: 'LIVE' | 'MOCK'
  readonly startedAt: number
  readonly completedAt: number
  readonly error: string | null
}
```

---

## 5. Strategy State Machine (XState v5)

### Architecture: One-Side-Only with Parallel Monitoring

Both long and short tracks run in parallel BUT when one side enters `positionOpen`, the other side transitions to `superseded` (terminal). This prevents conflicting simultaneous positions.

### State Diagram
```
IDLE
  │ SESSION_START
  ▼
BUILDING_ZONE  (accumulates bars 09:30-10:00)
  │ zone complete (first bar at/after 10:00)
  ▼
EVALUATING_ZONE  (immediate/transient)
  ├── choppy or degenerate zone ──► NO_TRADE (final)
  │
  ▼
MONITORING  (parallel, 10:00-11:00)
  ├── longTrack ───────────────────────── shortTrack
  │   watchingForBreak                     watchingForBreak
  │     │ bar HIGH > resistance              │ bar LOW < support
  │   breakDetected                        breakDetected
  │     │ bar LOW <= resistance              │ bar HIGH >= support
  │     │ [or retestAndConfirm]              │ [or retestAndConfirm]
  │   retestDetected                       retestDetected
  │     │ bar CLOSE > resistance             │ bar CLOSE < support
  │   positionOpen ◄─── SUPERSEDES OTHER    positionOpen ◄─── SUPERSEDES OTHER
  │     │ [tracking R targets]               │ [tracking R targets]
  │     │ stop/3R/session-end                │ stop/3R/session-end
  │   resolved (final)                     resolved (final)
  │
  │   ALSO: breakDetected -> watchingForBreak (break failure, max 5 attempts)
  │         retestDetected -> watchingForBreak (confirmation failure)
  │         * -> superseded (final)  when other side enters position
  │
  │ SESSION_END (at 11:00 ET, handled at MONITORING parent)
  ▼
COMPLETE (final)

ERROR (final) - on unrecoverable errors
```

### Event Types
```typescript
type StrategyEvent =
  | { type: 'NEW_BAR'; candle: Candle }
  | { type: 'SESSION_START'; date: string; symbol: string }
  | { type: 'SESSION_END' }
  | { type: 'ERROR'; message: string }
// All other transitions (break, retest, confirm, stop, targets) are
// evaluated as guard conditions on NEW_BAR, not separate events.
// This is simpler and ensures all logic flows through one event path.
```

### Guard Functions (Pure, in `guards.ts`)

**Two-tier filter**: HIGH/LOW for break detection, CLOSE for everything else.

```
LONG GUARDS:
  isLongBreak:            completed && bar.high > zone.resistance && phase === 'watching'
  isLongRetest:           completed && bar.low <= zone.resistance && phase === 'breakDetected'
  isLongRetestAndConfirm: completed && bar.low <= zone.resistance && bar.close > zone.resistance
                          && phase === 'breakDetected'  (single-bar shortcut)
  isLongConfirmation:     completed && bar.close > zone.resistance && phase === 'retestDetected'
  isLongBreakFailure:     completed && bar.close <= zone.resistance
                          && phase in ['breakDetected', 'retestDetected']
  isLongStopHit:          completed && bar.close <= trade.currentStop
                          (currentStop = resistance initially, moves to entryPrice after 1R)
  isLong1R:               completed && bar.close >= trade.target1R && !reached1R
  isLong2R:               completed && bar.close >= trade.target2R && !reached2R
  isLong3R:               completed && bar.close >= trade.target3R && !reached3R

SHORT GUARDS: (exact mirrors with inverted comparisons)
  isShortBreak:           completed && bar.low < zone.support
  isShortRetest:          completed && bar.high >= zone.support
  isShortRetestAndConfirm: completed && bar.high >= zone.support && bar.close < zone.support
  isShortConfirmation:    completed && bar.close < zone.support
  isShortBreakFailure:    completed && bar.close >= zone.support
  isShortStopHit:         completed && bar.close >= trade.currentStop
  isShort1R/2R/3R:        completed && bar.close <= trade.targetNR
```

### Multi-Target Resolution in Single Bar
Guards are evaluated **highest target first** (3R -> 2R -> 1R -> stop). If a bar jumps from 0.5R to 3.5R, the 3R guard fires, directly creating a WIN_3R outcome and marking 1R + 2R as also reached with the same timestamp.

### Trailing Stop at 1R
When `isLong1R` fires:
- `trade.currentStop` moves from `zone.resistance` to `trade.entryPrice`
- `reached1R = true`, `timestamp1R = bar.timestamp`
- Subsequent stop checks use `trade.currentStop` (entry price), not the zone level
- If stopped at entry after 1R: result = `BREAKEVEN_STOP`

### One-Side-Only Enforcement
When either track's `recordConfirmation` action fires:
- It sets a context flag `activeDirection: 'LONG' | 'SHORT'`
- The other track checks `guard: isSuperseded` (activeDirection !== null && activeDirection !== myDirection)
- If true, transitions to `superseded` final state

### Break Attempt Limit
Configurable `maxBreakAttempts` (default: 5). After exhausting attempts, track transitions to `maxAttemptsExhausted` terminal state. Each failure logs a `BREAK_FAILURE` signal.

### XState v5 Implementation Pattern
```typescript
import { setup, assign } from 'xstate';

const machine = setup({
  types: {
    context: {} as StrategyMachineContext,
    events: {} as StrategyEvent,
    input: {} as { date: string; symbol: string },
  },
  guards: { isLongBreak, isLongRetest, /* ... all guards */ },
  actions: { accumulateZoneBar, computeZone, recordLongBreak, /* ... */ },
}).createMachine({
  id: 'firstCandleStrategy',
  // ... state definition
});
```

---

## 6. IBKR Integration Layer

### IBKRAdapter (implements MarketDataProvider)
- Uses **IBApiNext** (RxJS Observable API from `@stoqey/ib`)
- Requests `formatDate=2` to receive epoch seconds (eliminates timezone parsing)
- `getHistoricalData()` for backtest, `getHistoricalDataUpdates()` for live streaming

### Bar Normalization & Validation
```typescript
// bar-normalizer.ts - Convert IBKR Bar to Candle
function normalizeBar(ibBar: Bar): Candle {
  return {
    timestamp: parseInt(ibBar.time, 10) * 1000,  // epoch sec -> UTC ms
    open: Math.round(ibBar.open * 100),           // $ -> cents
    high: Math.round(ibBar.high * 100),
    low: Math.round(ibBar.low * 100),
    close: Math.round(ibBar.close * 100),
    volume: ibBar.volume ?? 0,
    completed: true,  // set by completion detection, not always true
    barSizeMinutes: 5,
  };
}

// bar-validator.ts - Zod schema validation
const CandleSchema = z.object({
  timestamp: z.number().positive(),
  open: z.number().int().positive(),
  high: z.number().int().positive(),
  low: z.number().int().positive(),
  close: z.number().int().positive(),
  volume: z.number().int().nonnegative(),
}).refine(c => c.high >= c.low, 'high must be >= low')
  .refine(c => c.high >= c.open && c.high >= c.close, 'high must be >= open and close')
  .refine(c => c.low <= c.open && c.low <= c.close, 'low must be <= open and close');
```

### Bar Completion Detection
**One-bar buffer algorithm**: BarNormalizer maintains a buffer. When IBKR sends a bar:
1. If buffer is empty, store bar in buffer (incomplete)
2. If buffer has a bar with a DIFFERENT timestamp, emit buffered bar as `completed: true`, store new bar
3. If buffer has a bar with the SAME timestamp, replace buffer (update in-progress bar)
4. On `SESSION_END`, emit buffered bar as completed

### Bar Stream Pipeline (RxJS)
```typescript
subscribeBars(symbol: string): Observable<Candle> {
  return this.rawBarSubject.pipe(
    map(bar => normalizeBar(bar)),
    // bar completion detection via scan + pairwise
    filter(bar => bar.completed),
    filter(bar => CandleSchema.safeParse(bar).success),
    distinctUntilChanged((a, b) => a.timestamp === b.timestamp),
    takeUntil(this.destroy$),
    share(),
  );
}
```

### 3-Tier Pacing Manager
| Rule | Window | Limit | Action |
|------|--------|-------|--------|
| Identity dedup | 15 seconds | 1 identical request | Queue and wait |
| Per-contract burst | 2 seconds | 6 requests | Queue and wait |
| **Global rolling** | **10 minutes** | **60 historical requests** | **Queue with backpressure** |

### Connection Manager
- Exponential backoff: 2s initial, 60s max, 10 attempts
- Monitors IBKR error codes: 1100 (lost), 1102 (restored, data lost), 2104/2106 (farm status)
- Calls `reqMarketDataType(1)` for REALTIME data on connect
- Validates `clientId` uniqueness at startup

### Reconnection Backfill Algorithm
1. On disconnect: record `lastReceivedBarTimestamp`
2. On reconnect: request historical bars from `lastReceivedBarTimestamp + 5min` to `now`
3. Validate no overlap with already-processed bars (dedup by timestamp)
4. Feed backfilled bars through state machine in chronological order
5. Resume live streaming
6. If backfill fails: log warning, mark session as `DEGRADED`, continue with live stream

### Contract Resolver
- Filters to `secType: 'STK'`, `exchange: 'SMART'`, `currency: 'USD'`
- Caches resolved contracts for session lifetime
- Handles error 200 (no security definition found)

---

## 7. Time Handling

- **All internal timestamps**: UTC milliseconds (`number`)
- **Library**: `date-fns` v4 + `@date-fns/tz` >= 1.2.0 with `TZDate`
- **Comparisons**: Always via `.getTime()`, never reference equality
- **IBKR bars**: Use `formatDate=2` for epoch seconds, eliminating timezone parsing
- **Bar timestamps**: Represent bar START time (IBKR convention). A 10:00-10:05 bar has timestamp 10:00.

### Session Windows
```typescript
function getSessionWindows(dateStr: string): SessionWindows {
  // Uses TZDate in 'America/New_York' - handles DST automatically
  return {
    premarketUtc:    etToUtc(dateStr, '09:00'),
    zoneStartUtc:    etToUtc(dateStr, '09:30'),
    zoneEndUtc:      etToUtc(dateStr, '10:00'),
    executionEndUtc: etToUtc(dateStr, '11:00'),
  }
}
```

### Bar Grid Normalization
```typescript
function normalizeToBarGrid(utcMs: number, barSizeMinutes: number): number {
  const msPerBar = barSizeMinutes * 60 * 1000;
  return Math.floor(utcMs / msPerBar) * msPerBar;
}
```

### Market Calendar
- **holidays.json** config file (not hardcoded) with NYSE holidays and early close days
- Validated with `zod` schema on load
- `isTradingDay(dateStr)` checks weekends + holidays
- `isEarlyClose(dateStr)` for shortened sessions (does not affect our 9:30-11:00 window)
- Log warning when operating beyond confirmed calendar range

### Re-run Protection
- Check `storage.hasCompletedSession(date, symbol)` before starting
- Interrupted sessions (`INTERRUPTED` status) can be re-run (previous record is updated)

---

## 8. Backtesting Framework

### Replay Engine
Feeds historical bars one-at-a-time through the same XState actor used in live mode. No wall-clock dependency. SimulatedClock advances to each bar's timestamp.

### CSV Loader
```
Expected format: timestamp,open,high,low,close,volume
Supports: "YYYYMMDD HH:MM:SS" (ET) or epoch seconds (UTC)
Prices: dollar floats (converted to integer cents on load)
```

### BacktestRunner
```
for each trading day in range:
  1. Skip if not a trading day (holiday/weekend)
  2. Fetch bars (CSV or IBKR historical)
  3. Create fresh XState actor
  4. Send SESSION_START
  5. Feed each bar as NEW_BAR
  6. Send SESSION_END
  7. Extract final context -> SessionContext
  8. Persist to storage
Aggregate metrics across all sessions
```

### Determinism Guarantees
- SimulatedClock (no Date.now() leaks into core)
- R-multiples rounded to 2 decimal places via `Math.round(r * 100) / 100`
- No async operations in core strategy logic
- "Bit-exact" = matching to 2 decimal places on all R values

### Test Fixture Scenarios
| File | Scenario | Expected |
|------|----------|----------|
| `spy-long-breakout-2r.csv` | Clean long: break -> retest -> confirm -> 2R | WIN_2R |
| `spy-short-breakout-3r.csv` | Clean short: break -> retest -> confirm -> 3R | WIN_3R |
| `spy-choppy.csv` | 10:00 price inside zone | NO_TRADE_CHOPPY |
| `spy-stop-loss.csv` | Entry then immediate reversal | LOSS |
| `spy-breakeven-stop.csv` | Reaches 1R, stop moves, then stopped at entry | BREAKEVEN_STOP |
| `spy-session-timeout.csv` | Position never resolves by 11:00 | SESSION_TIMEOUT |
| `spy-false-retest.csv` | Break then fails to hold | No entry, back to watching |
| `spy-single-bar-retest-confirm.csv` | One bar retests AND confirms | Entry on that bar |
| `spy-multi-break-attempts.csv` | 3 failed breaks before success | Entry on 4th attempt |

---

## 9. Storage & Reporting

### SQLite Schema (better-sqlite3, WAL mode)
```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,              -- YYYY-MM-DD (ET)
  symbol TEXT NOT NULL,
  status TEXT NOT NULL,
  zone_resistance INTEGER,        -- int cents
  zone_support INTEGER,           -- int cents
  zone_status TEXT,
  execution_mode TEXT NOT NULL,    -- LIVE, MOCK
  started_at INTEGER NOT NULL,    -- UTC ms
  completed_at INTEGER,
  is_backtest INTEGER DEFAULT 0,
  error TEXT,
  UNIQUE(date, symbol, is_backtest)
);

CREATE TABLE trades (
  id TEXT PRIMARY KEY,             -- {date}_{symbol}_{dir}_{attempt}
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  entry_price INTEGER NOT NULL,    -- int cents
  initial_stop INTEGER NOT NULL,
  current_stop INTEGER NOT NULL,
  r_value INTEGER NOT NULL,
  target_1r INTEGER NOT NULL,
  target_2r INTEGER NOT NULL,
  target_3r INTEGER NOT NULL,
  entry_timestamp INTEGER NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE trade_outcomes (
  trade_id TEXT PRIMARY KEY REFERENCES trades(id),
  result TEXT NOT NULL,
  max_favorable_r REAL NOT NULL,
  max_adverse_r REAL NOT NULL,
  exit_price INTEGER NOT NULL,
  exit_timestamp INTEGER NOT NULL,
  realized_r REAL NOT NULL,
  first_threshold INTEGER NOT NULL,
  timestamp_1r INTEGER DEFAULT 0,
  timestamp_2r INTEGER DEFAULT 0,
  timestamp_3r INTEGER DEFAULT 0,
  timestamp_stop INTEGER DEFAULT 0,
  bars_held INTEGER NOT NULL
);

CREATE TABLE signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  direction TEXT NOT NULL,
  signal_type TEXT NOT NULL,       -- BREAK, RETEST, CONFIRMATION, BREAK_FAILURE
  timestamp INTEGER NOT NULL,
  price INTEGER NOT NULL,
  attempt_number INTEGER NOT NULL
);

-- Indexes
CREATE INDEX idx_sessions_date ON sessions(date);
CREATE INDEX idx_trades_session ON trades(session_id);
CREATE INDEX idx_signals_session ON signals(session_id);
```

### CLI Commands
```
morningtrader live AAPL                         # Live with real orders
morningtrader live AAPL --mock                  # Live data, mock execution
morningtrader live AAPL --dry-run               # Live data, no storage, no orders
morningtrader backtest AAPL --from 2024-01-02 --to 2024-01-31 --source csv
morningtrader backtest AAPL --from 2024-01-02 --to 2024-01-31 --source ibkr
morningtrader report --period weekly [--from --to]
morningtrader export --format csv --output trades.csv
morningtrader config --show
```

### Graceful Shutdown (ShutdownManager)
On SIGINT/SIGTERM:
1. Mark current session as `INTERRUPTED`
2. Record any open positions as `SESSION_TIMEOUT` outcomes
3. Flush pending SQLite writes (within transaction)
4. Unsubscribe all IBKR bar streams
5. Close IBKR connection cleanly
6. Log shutdown reason and exit

---

## 10. Implementation Phases

### Phase 1: Core Foundation (scaffolding + models + interfaces + IBKR)
**Files**: All `src/core/interfaces/`, `src/core/models/`, `src/utils/`, `src/adapters/ibkr/`, config files, package.json, tsconfig
- Init npm project, install all deps, configure TS/ESLint/Vitest
- Create full directory structure with barrel exports
- Implement ALL interfaces (MarketDataProvider, OrderExecutionProvider, StorageProvider, Clock, NotificationProvider)
- Implement ALL data models
- Implement `utils/time.ts`, `utils/math.ts`, `utils/bar-utils.ts`, `utils/holidays.ts`
- Implement IBKRAdapter + ConnectionManager + PacingManager (3-tier) + BarNormalizer + BarValidator + ContractResolver
- Write unit tests for: bar-normalizer, bar-validator, pacing, time utils, math utils
- **Done**: `npm run build` zero errors, `npm test` passes, IBKRAdapter can fetch SPY 5-min bars from TWS paper

### Phase 2: Strategy Engine + Risk + Backtest
**Files**: All `src/core/strategy/`, `src/core/risk/`, `src/core/metrics/`, `src/adapters/backtest/`, `src/services/session-runner.ts`, `src/services/backtest-runner.ts`, test fixtures
- Implement guards.ts (all guard functions, pure)
- Implement actions.ts (all assign actions)
- Implement events.ts (StrategyEvent types)
- Implement machine.ts (XState v5 setup() + createMachine)
- Implement risk/calculator.ts (R computation, targets, stop management, trailing stop)
- Implement metrics/aggregator.ts (win rate, profit factor, drawdown, per-direction stats)
- Implement CsvLoader, ReplayEngine, BacktestAdapter
- Implement SessionRunner (orchestrates actor lifecycle)
- Implement BacktestRunner (multi-day loop)
- Create ALL test fixture CSV files
- Write comprehensive tests: every guard, every transition, every edge case, full backtest scenarios
- **Done**: >95% coverage on `src/core/`, all fixture backtests produce expected outcomes, trailing stop logic verified

### Phase 3: Storage + Execution + CLI + Operations
**Files**: All `src/adapters/storage/`, `src/adapters/execution/`, `src/services/`, `src/cli/`, `src/app.ts`
- Implement SQLite schema + migrations + adapter
- Implement MockOrderAdapter (paper trading)
- Implement IBKROrderAdapter (live orders - behind config switch)
- Implement Scheduler (market calendar, session orchestration)
- Implement ShutdownManager (SIGINT/SIGTERM)
- Implement Reporter (CSV, JSON, console output)
- Implement Logger (pino)
- Implement all CLI commands
- Wire everything in app.ts (dependency injection)
- Write integration tests: SQLite CRUD, full session with mock data
- Write CLI smoke tests
- **Done**: Full CLI works end-to-end for live (--mock), backtest, report, export

---

## 11. Risk & Failure Mitigations

| Risk | Mitigation |
|------|-----------|
| **Missing bars / data gaps** | Track expected 6 bars for zone; compute from available if >= 3; ERROR if < 3 bars |
| **IBKR disconnection** | Exponential backoff reconnect; backfill missed bars on reconnect; stale data detector (10min) |
| **False retest edge cases** | Single-bar retest+confirm guard; break failure resets; max 5 break attempts |
| **Floating-point precision** | ALL prices as integer cents; comparisons on integers; R-multiples rounded to 2dp |
| **Time misalignment** | Snap to 5-min grid; formatDate=2 for epoch seconds; TZDate for DST |
| **IBKR pacing violations** | 3-tier pacing: 15s dedup + 6/2s burst + 60/10min global rolling window |
| **Bad bar data from IBKR** | Zod validation schema; reject bars with high < low, -1 prices, zero values |
| **Bar completion ambiguity** | One-bar buffer algorithm; emit only when next timestamp arrives |
| **Partial sessions / halts** | Halts = data gaps; SESSION_END at 11:00 regardless; stale data warning |
| **Database corruption** | WAL mode; transactions for multi-table writes; integrity check on startup |
| **Duplicate sessions** | Re-run protection; UNIQUE constraint on (date, symbol, is_backtest) |
| **Process crash / Ctrl+C** | ShutdownManager handles SIGINT/SIGTERM with orderly teardown |
| **Sub-cent prices** | Scoped to US equities >= $1.00; validated on input; reject sub-dollar symbols |
| **Simultaneous long+short** | One-side-only: first confirmed entry supersedes other track |
| **@stoqey/ib maintenance risk** | Exact version pin; all IBKR calls behind MarketDataProvider interface; replaceable |
| **IBKR nightly reset (23:45-00:45 ET)** | Our window is 9:30-11:00, unaffected; log warning if running outside window |

---

## 12. Verification Plan

1. **Unit tests** (`npm run test:unit`): All guards (100% branch coverage), actions, risk functions, time utils (including DST), math, bar-utils, bar-validator
2. **State machine tests**: Every transition, edge case, parallel state interaction, one-side-only superseding, trailing stop at 1R, break failure reset, max attempts
3. **Backtest fixture tests**: 9 scenario CSVs with hand-calculated expected outcomes
4. **Integration tests** (`npm run test:integration`): IBKR connection (skippable), SQLite CRUD, full session with mock adapter
5. **DST tests**: Session windows for 2024-03-10 (spring forward) and 2024-11-03 (fall back)
6. **Live smoke test**: Connect to TWS paper, `morningtrader live SPY --mock`, verify bars arrive, zone computes, signals log
7. **Dry-run test**: `morningtrader live SPY --dry-run`, verify no storage writes
8. **End-to-end backtest**: 1 month of data, verify aggregate metrics match hand calculations
9. **Graceful shutdown test**: Send SIGINT during live session, verify clean teardown and INTERRUPTED status

---

## Kanban Task Breakdown

See detailed task board: [fluffy-dancing-goblet-agent-aca26d6.md](./fluffy-dancing-goblet-agent-aca26d6.md)

**Summary**: 64 tasks across 3 phases, 12 parallel execution waves.

| Metric | Value |
|--------|-------|
| Total tasks | 64 |
| Estimated effort | ~127 hours |
| Critical path | ~32 hours sequential |
| Parallel waves | 12 |
| First task READY | T001: Initialize project scaffolding |

**Critical Path**: T001 -> T002 -> T004 -> T021 -> T022 -> T023 -> T024 -> T030 -> T057 -> T059 -> T062

**Agent Workload**:
| Agent | Tasks | Hours |
|-------|-------|-------|
| Backend Architect | 16 | ~40h |
| Fullstack Developer | 24 | ~45h |
| Database Architect | 5 | ~12h |
| Performance Engineer | 3 | ~8h |
| DevOps Engineer | 4 | ~4h |
| Code/Architect Reviewer | 6 | ~14h |
| Security Auditor | 1 | ~2h |
| Frontend Developer | 1 | ~2h |

---

## Open Design Decisions (Documented, Not Blocking)

1. **Multi-symbol support**: Current design is single-symbol. Architecture supports multi-symbol (separate actors per symbol, shared IBKR connection) but orchestration layer is future work.
2. **Webhook notifications**: NotificationProvider interface defined; ConsoleNotifier for v1, WebhookNotifier deferred.
3. **Position sizing**: Fixed quantity for v1 (configurable). Percent-of-equity sizing is future work requiring account balance API integration.
4. **Partial fills**: MockOrderAdapter fills immediately at signal price. IBKROrderAdapter will need fill tracking, but design deferred until order execution is tested with paper trading.
5. **Data retention**: No auto-pruning for v1. SQLite handles months of daily data without issues. Archive strategy deferred.
