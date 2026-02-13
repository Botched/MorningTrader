// Barrel export for core/strategy

// Events & machine types
export type {
  StrategyEvent,
  StrategyMachineContext,
  StrategyMachineInput,
} from './events.js';

// Guards
export {
  // Zone guards
  isFirstBarComplete,
  isZoneComplete,
  isChoppyZone,
  isDegenerateZone,
  // Long guards
  isLongBreak,
  isLongRetest,
  isLongRetestAndConfirm,
  isLongConfirmation,
  isLongBreakFailure,
  isLongStopHit,
  isLong1R,
  isLong2R,
  isLong3R,
  // Short guards
  isShortBreak,
  isShortRetest,
  isShortRetestAndConfirm,
  isShortConfirmation,
  isShortBreakFailure,
  isShortStopHit,
  isShort1R,
  isShort2R,
  isShort3R,
  // Control guards
  isMaxAttemptsReached,
  isMaxLongAttemptsReached,
  isMaxShortAttemptsReached,
  isSuperseded,
  isLongSuperseded,
  isShortSuperseded,
  isSessionEnd,
} from './guards.js';

// Actions
export {
  // Bar accumulation
  accumulateBar,
  accumulateZoneBar,
  // Zone computation
  computeZone,
  // Zone evaluation
  markZoneChoppy,
  markZoneDegenerate,
  // Signal recording — LONG
  recordLongBreak,
  recordLongRetest,
  recordLongBreakFailure,
  // Signal recording — SHORT
  recordShortBreak,
  recordShortRetest,
  recordShortBreakFailure,
  // Trade entry — confirmation
  recordLongConfirmation,
  recordShortConfirmation,
  // Position management — trailing stop
  updateLongTrailingStop,
  updateShortTrailingStop,
  // Position management — R milestones
  recordLong2R,
  recordShort2R,
  recordLong3R,
  recordShort3R,
  // Exit — stop hit
  recordLongStopHit,
  recordShortStopHit,
  // Exit — session timeout
  recordSessionTimeout,
} from './actions.js';

// State machine & actor
export { strategyMachine, createStrategyActor } from './machine.js';
