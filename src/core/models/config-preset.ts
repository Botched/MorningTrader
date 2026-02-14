/**
 * Strategy Configuration Preset
 *
 * Named strategy configuration profile that can be stored, edited, and applied.
 * Supports multiple presets with one marked as default. All strategy parameters
 * are configurable, allowing different risk profiles or trading styles.
 */
export interface ConfigPreset {
  readonly id: number;
  readonly name: string;
  readonly isDefault: boolean;          // Only one preset can be default

  // Core strategy parameters
  readonly maxBreakAttempts: number;
  readonly minZoneSpreadCents: number;  // Minimum zone size (cents)
  readonly maxZoneSpreadPercent: number; // Maximum zone size (% of price)
  readonly minZoneBars: number;

  // Time windows (stored as HH:MM strings in Eastern Time)
  readonly premarketTime: string;       // e.g., "04:30"
  readonly zoneStartTime: string;       // e.g., "09:30"
  readonly zoneEndTime: string;         // e.g., "10:00"
  readonly executionEndTime: string;    // e.g., "12:00"

  // Target multiples
  readonly target1RMultiple: number;    // e.g., 1.0
  readonly target2RMultiple: number;    // e.g., 2.0
  readonly target3RMultiple: number;    // e.g., 3.0

  // Position management
  readonly trailingStopAt1R: boolean;   // Move stop to breakeven after 1R hit

  // Metadata
  readonly createdAt: number;           // UTC milliseconds
  readonly updatedAt: number;           // UTC milliseconds
}

/**
 * Input for creating a new preset (id and timestamps auto-generated)
 */
export interface ConfigPresetInput {
  readonly name: string;
  readonly maxBreakAttempts?: number;
  readonly minZoneSpreadCents?: number;
  readonly maxZoneSpreadPercent?: number;
  readonly minZoneBars?: number;
  readonly premarketTime?: string;
  readonly zoneStartTime?: string;
  readonly zoneEndTime?: string;
  readonly executionEndTime?: string;
  readonly target1RMultiple?: number;
  readonly target2RMultiple?: number;
  readonly target3RMultiple?: number;
  readonly trailingStopAt1R?: boolean;
}

/**
 * Partial update for existing preset
 */
export interface ConfigPresetUpdate {
  readonly name?: string;
  readonly maxBreakAttempts?: number;
  readonly minZoneSpreadCents?: number;
  readonly maxZoneSpreadPercent?: number;
  readonly minZoneBars?: number;
  readonly premarketTime?: string;
  readonly zoneStartTime?: string;
  readonly zoneEndTime?: string;
  readonly executionEndTime?: string;
  readonly target1RMultiple?: number;
  readonly target2RMultiple?: number;
  readonly target3RMultiple?: number;
  readonly trailingStopAt1R?: boolean;
}
