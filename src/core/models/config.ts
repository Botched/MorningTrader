import { z } from 'zod';

// -----------------------------------------------------------------------
// Strategy Configuration
// -----------------------------------------------------------------------

export const SessionWindowsSchema = z.object({
  premarketTime: z.string().regex(/^\d{2}:\d{2}$/),
  zoneStartTime: z.string().regex(/^\d{2}:\d{2}$/),
  zoneEndTime: z.string().regex(/^\d{2}:\d{2}$/),
  executionEndTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export const TargetsSchema = z.object({
  target1RMultiple: z.number().positive(),
  target2RMultiple: z.number().positive(),
  target3RMultiple: z.number().positive(),
});

export const StrategyConfigSchema = z.object({
  maxBreakAttempts: z.number().int().positive().default(5),
  minZoneSpreadCents: z.number().int().nonnegative().default(10),
  maxZoneSpreadPercent: z.number().positive().default(3.0),
  barSizeMinutes: z.literal(5),
  sessionWindows: SessionWindowsSchema,
  minZoneBars: z.number().int().positive().default(3),
  targets: TargetsSchema,
  trailingStopAt1R: z.boolean().default(true),
});

export type StrategyConfig = z.infer<typeof StrategyConfigSchema>;

// -----------------------------------------------------------------------
// IBKR Configuration
// -----------------------------------------------------------------------

export const IBKRConfigSchema = z.object({
  host: z.string().default('127.0.0.1'),
  port: z.number().int().positive().default(7497),
  clientId: z.number().int().nonnegative().default(1),
  marketDataType: z.number().int().min(1).max(4).default(1),
});

export type IBKRConfig = z.infer<typeof IBKRConfigSchema>;

// -----------------------------------------------------------------------
// Execution Configuration
// -----------------------------------------------------------------------

export const ExecutionConfigSchema = z.object({
  mode: z.enum(['LIVE', 'MOCK']).default('MOCK'),
  defaultQuantity: z.number().int().positive().default(100),
});

export type ExecutionConfig = z.infer<typeof ExecutionConfigSchema>;

// -----------------------------------------------------------------------
// Logging Configuration
// -----------------------------------------------------------------------

export const LoggingConfigSchema = z.object({
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  pretty: z.boolean().default(false),
});

export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;

// -----------------------------------------------------------------------
// Storage Configuration
// -----------------------------------------------------------------------

export const StorageConfigSchema = z.object({
  dbPath: z.string().default('data/morningtrader.db'),
});

export type StorageConfig = z.infer<typeof StorageConfigSchema>;

// -----------------------------------------------------------------------
// Web Dashboard Configuration
// -----------------------------------------------------------------------

export const WebConfigSchema = z.object({
  port: z.number().int().positive().default(3847),
  host: z.string().default('127.0.0.1'),
});

export type WebConfig = z.infer<typeof WebConfigSchema>;

// -----------------------------------------------------------------------
// App Configuration (top-level)
// -----------------------------------------------------------------------

export const AppConfigSchema = z.object({
  strategy: StrategyConfigSchema,
  ibkr: IBKRConfigSchema,
  execution: ExecutionConfigSchema,
  logging: LoggingConfigSchema,
  storage: StorageConfigSchema,
  web: WebConfigSchema.default({}),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
