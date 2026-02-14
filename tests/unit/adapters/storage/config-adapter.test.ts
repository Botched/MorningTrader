/**
 * Unit tests for config-adapter (preset ↔ StrategyConfig conversion)
 */

import { describe, it, expect } from 'vitest';
import {
  presetToStrategyConfig,
  strategyConfigToPreset,
  getFactoryDefaults,
} from '../../../../src/adapters/storage/config-adapter.js';
import type { ConfigPreset } from '../../../../src/core/models/config-preset.js';
import type { StrategyConfig } from '../../../../src/core/models/config.js';

describe('config-adapter', () => {
  describe('presetToStrategyConfig', () => {
    it('converts all fields correctly', () => {
      const preset: ConfigPreset = {
        id: 1,
        name: 'Test Preset',
        isDefault: false,
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
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const config = presetToStrategyConfig(preset);

      // Direct mappings
      expect(config.maxBreakAttempts).toBe(5);
      expect(config.minZoneSpreadCents).toBe(10);
      expect(config.maxZoneSpreadPercent).toBe(3.0);
      expect(config.minZoneBars).toBe(3);
      expect(config.trailingStopAt1R).toBe(true);

      // barSizeMinutes is always 5
      expect(config.barSizeMinutes).toBe(5);

      // sessionWindows object
      expect(config.sessionWindows).toEqual({
        premarketTime: '04:30',
        zoneStartTime: '09:30',
        zoneEndTime: '10:00',
        executionEndTime: '12:00',
      });

      // targets object
      expect(config.targets).toEqual({
        target1RMultiple: 1.0,
        target2RMultiple: 2.0,
        target3RMultiple: 3.0,
      });
    });

    it('handles trailingStopAt1R=false correctly', () => {
      const preset: ConfigPreset = {
        id: 2,
        name: 'No Trailing Stop',
        isDefault: false,
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
        trailingStopAt1R: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const config = presetToStrategyConfig(preset);

      expect(config.trailingStopAt1R).toBe(false);
    });

    it('preserves custom parameter values', () => {
      const preset: ConfigPreset = {
        id: 3,
        name: 'Aggressive',
        isDefault: false,
        maxBreakAttempts: 10,
        minZoneSpreadCents: 5,
        maxZoneSpreadPercent: 5.0,
        minZoneBars: 2,
        premarketTime: '04:00',
        zoneStartTime: '09:30',
        zoneEndTime: '09:45',
        executionEndTime: '11:00',
        target1RMultiple: 1.5,
        target2RMultiple: 3.0,
        target3RMultiple: 5.0,
        trailingStopAt1R: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const config = presetToStrategyConfig(preset);

      expect(config.maxBreakAttempts).toBe(10);
      expect(config.minZoneSpreadCents).toBe(5);
      expect(config.maxZoneSpreadPercent).toBe(5.0);
      expect(config.minZoneBars).toBe(2);
      expect(config.sessionWindows.premarketTime).toBe('04:00');
      expect(config.sessionWindows.zoneEndTime).toBe('09:45');
      expect(config.sessionWindows.executionEndTime).toBe('11:00');
      expect(config.targets.target1RMultiple).toBe(1.5);
      expect(config.targets.target2RMultiple).toBe(3.0);
      expect(config.targets.target3RMultiple).toBe(5.0);
    });
  });

  describe('strategyConfigToPreset', () => {
    it('flattens nested config structure correctly', () => {
      const config: StrategyConfig = {
        maxBreakAttempts: 5,
        minZoneSpreadCents: 10,
        maxZoneSpreadPercent: 3.0,
        barSizeMinutes: 5,
        sessionWindows: {
          premarketTime: '04:30',
          zoneStartTime: '09:30',
          zoneEndTime: '10:00',
          executionEndTime: '12:00',
        },
        minZoneBars: 3,
        targets: {
          target1RMultiple: 1.0,
          target2RMultiple: 2.0,
          target3RMultiple: 3.0,
        },
        trailingStopAt1R: true,
      };

      const preset = strategyConfigToPreset(config, 'Test Config');

      expect(preset.name).toBe('Test Config');
      expect(preset.maxBreakAttempts).toBe(5);
      expect(preset.minZoneSpreadCents).toBe(10);
      expect(preset.maxZoneSpreadPercent).toBe(3.0);
      expect(preset.minZoneBars).toBe(3);
      expect(preset.premarketTime).toBe('04:30');
      expect(preset.zoneStartTime).toBe('09:30');
      expect(preset.zoneEndTime).toBe('10:00');
      expect(preset.executionEndTime).toBe('12:00');
      expect(preset.target1RMultiple).toBe(1.0);
      expect(preset.target2RMultiple).toBe(2.0);
      expect(preset.target3RMultiple).toBe(3.0);
      expect(preset.trailingStopAt1R).toBe(true);
    });

    it('round-trip conversion is identity (config → preset → config)', () => {
      const originalConfig: StrategyConfig = {
        maxBreakAttempts: 7,
        minZoneSpreadCents: 15,
        maxZoneSpreadPercent: 4.5,
        barSizeMinutes: 5,
        sessionWindows: {
          premarketTime: '04:15',
          zoneStartTime: '09:30',
          zoneEndTime: '09:55',
          executionEndTime: '11:30',
        },
        minZoneBars: 4,
        targets: {
          target1RMultiple: 1.2,
          target2RMultiple: 2.5,
          target3RMultiple: 4.0,
        },
        trailingStopAt1R: false,
      };

      // Convert to preset
      const presetInput = strategyConfigToPreset(originalConfig, 'Round Trip Test');

      // Create a full ConfigPreset (simulate database insert/retrieval)
      const fullPreset: ConfigPreset = {
        id: 999,
        name: presetInput.name,
        isDefault: false,
        maxBreakAttempts: presetInput.maxBreakAttempts!,
        minZoneSpreadCents: presetInput.minZoneSpreadCents!,
        maxZoneSpreadPercent: presetInput.maxZoneSpreadPercent!,
        minZoneBars: presetInput.minZoneBars!,
        premarketTime: presetInput.premarketTime!,
        zoneStartTime: presetInput.zoneStartTime!,
        zoneEndTime: presetInput.zoneEndTime!,
        executionEndTime: presetInput.executionEndTime!,
        target1RMultiple: presetInput.target1RMultiple!,
        target2RMultiple: presetInput.target2RMultiple!,
        target3RMultiple: presetInput.target3RMultiple!,
        trailingStopAt1R: presetInput.trailingStopAt1R!,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Convert back to config
      const resultConfig = presetToStrategyConfig(fullPreset);

      // Verify identity
      expect(resultConfig).toEqual(originalConfig);
    });
  });

  describe('getFactoryDefaults', () => {
    it('returns valid ConfigPresetInput with expected defaults', () => {
      const defaults = getFactoryDefaults();

      expect(defaults.name).toBe('Default');
      expect(defaults.maxBreakAttempts).toBe(5);
      expect(defaults.minZoneSpreadCents).toBe(10);
      expect(defaults.maxZoneSpreadPercent).toBe(3.0);
      expect(defaults.minZoneBars).toBe(3);
      expect(defaults.premarketTime).toBe('04:30');
      expect(defaults.zoneStartTime).toBe('09:30');
      expect(defaults.zoneEndTime).toBe('10:00');
      expect(defaults.executionEndTime).toBe('12:00');
      expect(defaults.target1RMultiple).toBe(1.0);
      expect(defaults.target2RMultiple).toBe(2.0);
      expect(defaults.target3RMultiple).toBe(3.0);
      expect(defaults.trailingStopAt1R).toBe(true);
    });

    it('factory defaults match StrategyConfig defaults', () => {
      const defaults = getFactoryDefaults();

      // Create a ConfigPreset from factory defaults
      const preset: ConfigPreset = {
        id: 0,
        name: defaults.name,
        isDefault: true,
        maxBreakAttempts: defaults.maxBreakAttempts!,
        minZoneSpreadCents: defaults.minZoneSpreadCents!,
        maxZoneSpreadPercent: defaults.maxZoneSpreadPercent!,
        minZoneBars: defaults.minZoneBars!,
        premarketTime: defaults.premarketTime!,
        zoneStartTime: defaults.zoneStartTime!,
        zoneEndTime: defaults.zoneEndTime!,
        executionEndTime: defaults.executionEndTime!,
        target1RMultiple: defaults.target1RMultiple!,
        target2RMultiple: defaults.target2RMultiple!,
        target3RMultiple: defaults.target3RMultiple!,
        trailingStopAt1R: defaults.trailingStopAt1R!,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const config = presetToStrategyConfig(preset);

      // Verify the converted config matches expected defaults
      expect(config.maxBreakAttempts).toBe(5);
      expect(config.minZoneSpreadCents).toBe(10);
      expect(config.maxZoneSpreadPercent).toBe(3.0);
      expect(config.minZoneBars).toBe(3);
      expect(config.barSizeMinutes).toBe(5);
      expect(config.targets.target1RMultiple).toBe(1.0);
      expect(config.targets.target2RMultiple).toBe(2.0);
      expect(config.targets.target3RMultiple).toBe(3.0);
      expect(config.trailingStopAt1R).toBe(true);
    });
  });
});
