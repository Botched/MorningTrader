/**
 * Config Adapter - Preset ↔ StrategyConfig Conversion
 *
 * Provides bidirectional conversion between database ConfigPreset records
 * and runtime StrategyConfig objects. Enables storing multiple named
 * strategy configurations in the database.
 */

import type { StrategyConfig } from '../../core/models/config.js';
import type {
  ConfigPreset,
  ConfigPresetInput,
} from '../../core/models/config-preset.js';

/**
 * Convert a ConfigPreset (database model) to StrategyConfig (runtime model)
 *
 * Maps preset fields to the nested StrategyConfig structure used by
 * the strategy engine. This is the primary conversion for loading
 * presets at runtime.
 */
export function presetToStrategyConfig(preset: ConfigPreset): StrategyConfig {
  return {
    maxBreakAttempts: preset.maxBreakAttempts,
    minZoneSpreadCents: preset.minZoneSpreadCents,
    maxZoneSpreadPercent: preset.maxZoneSpreadPercent,
    barSizeMinutes: 5 as const,
    sessionWindows: {
      premarketTime: preset.premarketTime,
      zoneStartTime: preset.zoneStartTime,
      zoneEndTime: preset.zoneEndTime,
      executionEndTime: preset.executionEndTime,
    },
    minZoneBars: preset.minZoneBars,
    targets: {
      target1RMultiple: preset.target1RMultiple,
      target2RMultiple: preset.target2RMultiple,
      target3RMultiple: preset.target3RMultiple,
    },
    trailingStopAt1R: preset.trailingStopAt1R,
  };
}

/**
 * Convert a StrategyConfig (runtime model) to ConfigPresetInput (for database insert)
 *
 * Flattens the nested StrategyConfig structure into the flat preset schema.
 * Used when creating a new preset from an existing config (e.g., "Save as Preset").
 *
 * Note: barSizeMinutes is always 5 and is not stored in presets (it's a system constant).
 */
export function strategyConfigToPreset(
  config: StrategyConfig,
  name: string,
): ConfigPresetInput {
  return {
    name,
    maxBreakAttempts: config.maxBreakAttempts,
    minZoneSpreadCents: config.minZoneSpreadCents,
    maxZoneSpreadPercent: config.maxZoneSpreadPercent,
    minZoneBars: config.minZoneBars,
    premarketTime: config.sessionWindows.premarketTime,
    zoneStartTime: config.sessionWindows.zoneStartTime,
    zoneEndTime: config.sessionWindows.zoneEndTime,
    executionEndTime: config.sessionWindows.executionEndTime,
    target1RMultiple: config.targets.target1RMultiple,
    target2RMultiple: config.targets.target2RMultiple,
    target3RMultiple: config.targets.target3RMultiple,
    trailingStopAt1R: config.trailingStopAt1R,
  };
}

/**
 * Get factory default strategy configuration as a ConfigPresetInput
 *
 * Returns the hardcoded defaults matching the original StrategyConfig defaults.
 * Use this to create the initial "Default" preset or reset values to factory settings.
 */
export function getFactoryDefaults(): ConfigPresetInput {
  return {
    name: 'Default',
    maxBreakAttempts: 5,
    minZoneSpreadCents: 10,
    maxZoneSpreadPercent: 3.0,
    minZoneBars: 3,
    premarketTime: '04:30',
    zoneStartTime: '09:30',
    zoneEndTime: '10:00',
    executionEndTime: '12:00',
    target1RMultiple: 1.0,
    target2RMultiple: 2.0,
    target3RMultiple: 3.0,
    trailingStopAt1R: true,
  };
}
