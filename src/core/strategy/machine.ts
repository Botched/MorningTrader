import { setup, createActor, assign, and } from 'xstate';
import type { StrategyMachineContext, StrategyMachineInput, StrategyEvent } from './events.js';
import * as guardFns from './guards.js';
import {
  // Bar accumulation
  accumulateBar,
  accumulateZoneBar,
  // Zone computation
  computeZone,
  // Zone evaluation
  markZoneChoppy,
  markZoneDegenerate,
  // Signal recording -- LONG
  recordLongBreak,
  recordLongRetest,
  recordLongBreakFailure,
  // Signal recording -- SHORT
  recordShortBreak,
  recordShortRetest,
  recordShortBreakFailure,
  // Trade entry -- confirmation
  recordLongConfirmation,
  recordShortConfirmation,
  // Position management -- trailing stop
  updateLongTrailingStop,
  updateShortTrailingStop,
  // Position management -- R milestones
  recordLong2R,
  recordShort2R,
  recordLong3R,
  recordShort3R,
  // Exit -- stop hit
  recordLongStopHit,
  recordShortStopHit,
  // Exit -- session timeout
  recordSessionTimeout,
} from './actions.js';

// ---------------------------------------------------------------------------
// Initial context factory
// ---------------------------------------------------------------------------

function createInitialContext(input: StrategyMachineInput): StrategyMachineContext {
  return {
    date: input.date,
    symbol: input.symbol,

    zone: null,
    zoneBars: [],

    signals: [],
    trades: [],
    outcomes: [],
    allBars: [],

    activeDirection: null,

    longBreakAttempts: 0,
    longPhase: 'watching',
    longBreakBar: null,
    longRetestBar: null,

    shortBreakAttempts: 0,
    shortPhase: 'watching',
    shortBreakBar: null,
    shortRetestBar: null,

    reached1R: false,
    reached2R: false,
    reached3R: false,
    timestamp1R: 0,
    timestamp2R: 0,
    timestamp3R: 0,

    maxBreakAttempts: input.maxBreakAttempts ?? 3,
    minZoneSpreadCents: input.minZoneSpreadCents ?? 20,
    maxZoneSpreadPercent: input.maxZoneSpreadPercent ?? 3,

    error: null,
  };
}

// ---------------------------------------------------------------------------
// Guard / action callback arg types for XState v5 setup()
// ---------------------------------------------------------------------------

type GuardArgs = { context: StrategyMachineContext; event: StrategyEvent };
type ContextOnlyArgs = { context: StrategyMachineContext };

// ---------------------------------------------------------------------------
// Error action (inline -- not part of T023 actions module)
// ---------------------------------------------------------------------------

const setError = assign(
  ({ event }: { context: StrategyMachineContext; event: StrategyEvent }) => {
    if (event.type !== 'ERROR') return {};
    return { error: event.message };
  },
);

// ---------------------------------------------------------------------------
// Strategy State Machine
// ---------------------------------------------------------------------------

export const strategyMachine = setup({
  types: {
    context: {} as StrategyMachineContext,
    events: {} as StrategyEvent,
    input: {} as StrategyMachineInput,
  },

  // -----------------------------------------------------------------------
  // Guards -- wrap imported guard functions for XState v5 ({ context, event })
  // -----------------------------------------------------------------------
  guards: {
    // Zone guards
    isZoneComplete: ({ context, event }: GuardArgs) =>
      guardFns.isZoneComplete(context, event),
    isChoppyZone: ({ context }: ContextOnlyArgs) =>
      guardFns.isChoppyZone(context),
    isDegenerateZone: ({ context }: ContextOnlyArgs) =>
      guardFns.isDegenerateZone(context),

    // Long guards
    isLongBreak: ({ context, event }: GuardArgs) =>
      guardFns.isLongBreak(context, event),
    isLongRetest: ({ context, event }: GuardArgs) =>
      guardFns.isLongRetest(context, event),
    isLongRetestAndConfirm: ({ context, event }: GuardArgs) =>
      guardFns.isLongRetestAndConfirm(context, event),
    isLongConfirmation: ({ context, event }: GuardArgs) =>
      guardFns.isLongConfirmation(context, event),
    isLongBreakFailure: ({ context, event }: GuardArgs) =>
      guardFns.isLongBreakFailure(context, event),
    isLongStopHit: ({ context, event }: GuardArgs) =>
      guardFns.isLongStopHit(context, event),
    isLong1R: ({ context, event }: GuardArgs) =>
      guardFns.isLong1R(context, event),
    isLong2R: ({ context, event }: GuardArgs) =>
      guardFns.isLong2R(context, event),
    isLong3R: ({ context, event }: GuardArgs) =>
      guardFns.isLong3R(context, event),

    // Short guards
    isShortBreak: ({ context, event }: GuardArgs) =>
      guardFns.isShortBreak(context, event),
    isShortRetest: ({ context, event }: GuardArgs) =>
      guardFns.isShortRetest(context, event),
    isShortRetestAndConfirm: ({ context, event }: GuardArgs) =>
      guardFns.isShortRetestAndConfirm(context, event),
    isShortConfirmation: ({ context, event }: GuardArgs) =>
      guardFns.isShortConfirmation(context, event),
    isShortBreakFailure: ({ context, event }: GuardArgs) =>
      guardFns.isShortBreakFailure(context, event),
    isShortStopHit: ({ context, event }: GuardArgs) =>
      guardFns.isShortStopHit(context, event),
    isShort1R: ({ context, event }: GuardArgs) =>
      guardFns.isShort1R(context, event),
    isShort2R: ({ context, event }: GuardArgs) =>
      guardFns.isShort2R(context, event),
    isShort3R: ({ context, event }: GuardArgs) =>
      guardFns.isShort3R(context, event),

    // Control guards
    isMaxLongAttemptsReached: ({ context }: ContextOnlyArgs) =>
      guardFns.isMaxLongAttemptsReached(context),
    isMaxShortAttemptsReached: ({ context }: ContextOnlyArgs) =>
      guardFns.isMaxShortAttemptsReached(context),
    isLongSuperseded: ({ context }: ContextOnlyArgs) =>
      guardFns.isLongSuperseded(context),
    isShortSuperseded: ({ context }: ContextOnlyArgs) =>
      guardFns.isShortSuperseded(context),
  },

  // -----------------------------------------------------------------------
  // Actions -- reference imported assign() actions.
  //
  // The assign() calls in actions.ts produce ActionFunction<..., EventObject>
  // which is structurally compatible but nominally mismatched with the
  // specific StrategyEvent union. We cast via the actions record type to
  // satisfy setup()'s strict generic constraints. Each action is type-safe
  // at its own definition site.
  // -----------------------------------------------------------------------
  actions: {
    accumulateBar: accumulateBar as any,       // eslint-disable-line @typescript-eslint/no-explicit-any
    accumulateZoneBar: accumulateZoneBar as any,
    computeZone: computeZone as any,
    markZoneChoppy: markZoneChoppy as any,
    markZoneDegenerate: markZoneDegenerate as any,

    recordLongBreak: recordLongBreak as any,
    recordLongRetest: recordLongRetest as any,
    recordLongBreakFailure: recordLongBreakFailure as any,
    recordLongConfirmation: recordLongConfirmation as any,
    updateLongTrailingStop: updateLongTrailingStop as any,
    recordLong2R: recordLong2R as any,
    recordLong3R: recordLong3R as any,
    recordLongStopHit: recordLongStopHit as any,

    recordShortBreak: recordShortBreak as any,
    recordShortRetest: recordShortRetest as any,
    recordShortBreakFailure: recordShortBreakFailure as any,
    recordShortConfirmation: recordShortConfirmation as any,
    updateShortTrailingStop: updateShortTrailingStop as any,
    recordShort2R: recordShort2R as any,
    recordShort3R: recordShort3R as any,
    recordShortStopHit: recordShortStopHit as any,

    recordSessionTimeout: recordSessionTimeout as any,
    setError: setError as any,
  },
}).createMachine({
  id: 'strategy',
  initial: 'IDLE',
  context: ({ input }) => createInitialContext(input),

  states: {
    // =======================================================================
    // IDLE -- waiting for session to begin
    // =======================================================================
    IDLE: {
      on: {
        SESSION_START: { target: 'BUILDING_ZONE' },
        ERROR: { target: 'ERROR', actions: 'setError' },
      },
    },

    // =======================================================================
    // BUILDING_ZONE -- accumulating 5-min bars from 09:30 to 10:00 ET
    // =======================================================================
    BUILDING_ZONE: {
      on: {
        NEW_BAR: [
          {
            guard: 'isZoneComplete',
            actions: ['accumulateBar', 'accumulateZoneBar', 'computeZone'],
            target: 'EVALUATING_ZONE',
          },
          {
            actions: ['accumulateBar', 'accumulateZoneBar'],
          },
        ],
        ERROR: { target: 'ERROR', actions: 'setError' },
      },
    },

    // =======================================================================
    // EVALUATING_ZONE -- transient state; immediately evaluates zone quality
    // =======================================================================
    EVALUATING_ZONE: {
      always: [
        {
          guard: 'isChoppyZone',
          actions: 'markZoneChoppy',
          target: 'NO_TRADE',
        },
        {
          guard: 'isDegenerateZone',
          actions: 'markZoneDegenerate',
          target: 'NO_TRADE',
        },
        {
          target: 'MONITORING',
        },
      ],
    },

    // =======================================================================
    // MONITORING -- parallel state tracking both long and short sides
    // =======================================================================
    MONITORING: {
      type: 'parallel',

      // SESSION_END at the parent level exits all children
      on: {
        SESSION_END: {
          target: '#strategy.COMPLETE',
          actions: 'recordSessionTimeout',
        },
        ERROR: {
          target: '#strategy.ERROR',
          actions: 'setError',
        },
      },

      states: {
        // -------------------------------------------------------------------
        // Bar accumulator -- dedicated parallel region that accumulates every
        // NEW_BAR into context.allBars, regardless of what the trade tracks
        // are doing. This prevents duplicate accumulation in parallel regions.
        // -------------------------------------------------------------------
        barAccumulator: {
          initial: 'active',
          states: {
            active: {
              on: {
                NEW_BAR: {
                  actions: 'accumulateBar',
                },
              },
            },
          },
        },

        // -------------------------------------------------------------------
        // LONG TRACK
        // -------------------------------------------------------------------
        longTrack: {
          initial: 'watchingForBreak',
          states: {
            // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
            // Watching for a break above resistance
            // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
            watchingForBreak: {
              always: [
                {
                  guard: 'isLongSuperseded',
                  target: 'superseded',
                },
              ],
              on: {
                NEW_BAR: [
                  {
                    guard: 'isLongBreak',
                    actions: 'recordLongBreak',
                    target: 'breakDetected',
                  },
                ],
              },
            },

            // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
            // Break detected -- waiting for retest or failure
            // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
            breakDetected: {
              always: [
                {
                  guard: 'isLongSuperseded',
                  target: 'superseded',
                },
              ],
              on: {
                NEW_BAR: [
                  // Priority 1: Single-bar retest+confirm shortcut
                  {
                    guard: 'isLongRetestAndConfirm',
                    actions: ['recordLongRetest', 'recordLongConfirmation'],
                    target: 'positionOpen',
                  },
                  // Priority 2: Break failure with max attempts exhausted
                  {
                    guard: and(['isLongBreakFailure', 'isMaxLongAttemptsReached']),
                    actions: 'recordLongBreakFailure',
                    target: 'maxAttemptsExhausted',
                  },
                  // Priority 3: Break failure (retry allowed)
                  {
                    guard: 'isLongBreakFailure',
                    actions: 'recordLongBreakFailure',
                    target: 'watchingForBreak',
                  },
                  // Priority 4: Normal retest
                  {
                    guard: 'isLongRetest',
                    actions: 'recordLongRetest',
                    target: 'retestDetected',
                  },
                ],
              },
            },

            // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
            // Retest detected -- waiting for confirmation or failure
            // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
            retestDetected: {
              always: [
                {
                  guard: 'isLongSuperseded',
                  target: 'superseded',
                },
              ],
              on: {
                NEW_BAR: [
                  // Priority 1: Confirmation -- enter long position
                  {
                    guard: 'isLongConfirmation',
                    actions: 'recordLongConfirmation',
                    target: 'positionOpen',
                  },
                  // Priority 2: Confirmation failure -- back to watching
                  {
                    guard: 'isLongBreakFailure',
                    actions: 'recordLongBreakFailure',
                    target: 'watchingForBreak',
                  },
                ],
              },
            },

            // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
            // Position open -- tracking R targets and stop
            // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
            positionOpen: {
              on: {
                NEW_BAR: [
                  // Priority 1: 3R target hit -- full exit
                  {
                    guard: 'isLong3R',
                    actions: 'recordLong3R',
                    target: 'resolved',
                  },
                  // Priority 2: 2R milestone
                  {
                    guard: 'isLong2R',
                    actions: 'recordLong2R',
                    // Stay in positionOpen (internal transition)
                  },
                  // Priority 3: 1R milestone -- move stop to breakeven
                  {
                    guard: 'isLong1R',
                    actions: 'updateLongTrailingStop',
                    // Stay in positionOpen (internal transition)
                  },
                  // Priority 4: Stop hit -- exit with loss or breakeven
                  {
                    guard: 'isLongStopHit',
                    actions: 'recordLongStopHit',
                    target: 'resolved',
                  },
                ],
              },
            },

            // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
            // Terminal states
            // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
            resolved: {
              type: 'final',
            },
            superseded: {
              type: 'final',
            },
            maxAttemptsExhausted: {
              type: 'final',
            },
          },
        },

        // -------------------------------------------------------------------
        // SHORT TRACK
        // -------------------------------------------------------------------
        shortTrack: {
          initial: 'watchingForBreak',
          states: {
            // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
            // Watching for a break below support
            // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
            watchingForBreak: {
              always: [
                {
                  guard: 'isShortSuperseded',
                  target: 'superseded',
                },
              ],
              on: {
                NEW_BAR: [
                  {
                    guard: 'isShortBreak',
                    actions: 'recordShortBreak',
                    target: 'breakDetected',
                  },
                ],
              },
            },

            // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
            // Break detected -- waiting for retest or failure
            // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
            breakDetected: {
              always: [
                {
                  guard: 'isShortSuperseded',
                  target: 'superseded',
                },
              ],
              on: {
                NEW_BAR: [
                  // Priority 1: Single-bar retest+confirm shortcut
                  {
                    guard: 'isShortRetestAndConfirm',
                    actions: ['recordShortRetest', 'recordShortConfirmation'],
                    target: 'positionOpen',
                  },
                  // Priority 2: Break failure with max attempts exhausted
                  {
                    guard: and(['isShortBreakFailure', 'isMaxShortAttemptsReached']),
                    actions: 'recordShortBreakFailure',
                    target: 'maxAttemptsExhausted',
                  },
                  // Priority 3: Break failure (retry allowed)
                  {
                    guard: 'isShortBreakFailure',
                    actions: 'recordShortBreakFailure',
                    target: 'watchingForBreak',
                  },
                  // Priority 4: Normal retest
                  {
                    guard: 'isShortRetest',
                    actions: 'recordShortRetest',
                    target: 'retestDetected',
                  },
                ],
              },
            },

            // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
            // Retest detected -- waiting for confirmation or failure
            // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
            retestDetected: {
              always: [
                {
                  guard: 'isShortSuperseded',
                  target: 'superseded',
                },
              ],
              on: {
                NEW_BAR: [
                  // Priority 1: Confirmation -- enter short position
                  {
                    guard: 'isShortConfirmation',
                    actions: 'recordShortConfirmation',
                    target: 'positionOpen',
                  },
                  // Priority 2: Confirmation failure -- back to watching
                  {
                    guard: 'isShortBreakFailure',
                    actions: 'recordShortBreakFailure',
                    target: 'watchingForBreak',
                  },
                ],
              },
            },

            // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
            // Position open -- tracking R targets and stop
            // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
            positionOpen: {
              on: {
                NEW_BAR: [
                  // Priority 1: 3R target hit -- full exit
                  {
                    guard: 'isShort3R',
                    actions: 'recordShort3R',
                    target: 'resolved',
                  },
                  // Priority 2: 2R milestone
                  {
                    guard: 'isShort2R',
                    actions: 'recordShort2R',
                    // Stay in positionOpen (internal transition)
                  },
                  // Priority 3: 1R milestone -- move stop to breakeven
                  {
                    guard: 'isShort1R',
                    actions: 'updateShortTrailingStop',
                    // Stay in positionOpen (internal transition)
                  },
                  // Priority 4: Stop hit -- exit with loss or breakeven
                  {
                    guard: 'isShortStopHit',
                    actions: 'recordShortStopHit',
                    target: 'resolved',
                  },
                ],
              },
            },

            // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
            // Terminal states
            // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
            resolved: {
              type: 'final',
            },
            superseded: {
              type: 'final',
            },
            maxAttemptsExhausted: {
              type: 'final',
            },
          },
        },
      },
    },

    // =======================================================================
    // NO_TRADE -- zone was choppy or degenerate; no trading today
    // =======================================================================
    NO_TRADE: {
      type: 'final',
    },

    // =======================================================================
    // COMPLETE -- session ended normally
    // =======================================================================
    COMPLETE: {
      type: 'final',
    },

    // =======================================================================
    // ERROR -- unrecoverable error
    // =======================================================================
    ERROR: {
      type: 'final',
    },
  },
});

// ---------------------------------------------------------------------------
// Actor factory helper
// ---------------------------------------------------------------------------

/**
 * Create a new strategy actor from the state machine.
 *
 * @param input - Session date and symbol, plus optional config overrides.
 * @returns An XState actor that can be started with `.start()`.
 *
 * @example
 * ```ts
 * const actor = createStrategyActor({ date: '2024-03-15', symbol: 'SPY' });
 * actor.start();
 * actor.send({ type: 'SESSION_START', date: '2024-03-15', symbol: 'SPY' });
 * actor.send({ type: 'NEW_BAR', candle: bar });
 * ```
 */
export function createStrategyActor(input: StrategyMachineInput) {
  return createActor(strategyMachine, { input });
}
