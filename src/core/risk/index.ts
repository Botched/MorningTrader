// Barrel export for core/risk
export {
  // Re-exported from utils/math.js
  computeRValue,
  computeRMultiple,
  computeTargetPrice,
  roundR,
  // Risk calculator functions
  computeTargets,
  determineStopLevel,
  computeTrailingStop,
  computeMaxFavorableR,
  computeMaxAdverseR,
} from './calculator.js';
