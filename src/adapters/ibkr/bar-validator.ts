import { z } from 'zod';
import type { Candle } from '../../core/models/index.js';

export const CandleSchema = z.object({
  timestamp: z.number().positive(),
  open: z.number().int().positive(),
  high: z.number().int().positive(),
  low: z.number().int().positive(),
  close: z.number().int().positive(),
  volume: z.number().int().nonnegative(),
  completed: z.boolean(),
  barSizeMinutes: z.literal(5),
}).refine(c => c.high >= c.low, { message: 'high must be >= low' })
  .refine(c => c.high >= c.open && c.high >= c.close, { message: 'high must be >= open and close' })
  .refine(c => c.low <= c.open && c.low <= c.close, { message: 'low must be <= open and close' });

export type CandleValidationResult =
  | { success: true; data: Candle }
  | { success: false; error: z.ZodError };

export function validateCandle(candle: unknown): CandleValidationResult {
  const result = CandleSchema.safeParse(candle);
  if (result.success) {
    return { success: true, data: result.data as Candle };
  }
  return { success: false, error: result.error };
}
