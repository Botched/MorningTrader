export type ClockTimer = { readonly id: number };

export interface Clock {
  now(): number;  // UTC milliseconds
  setTimeout(fn: () => void, ms: number): ClockTimer;
  clearTimeout(timer: ClockTimer): void;
  waitUntil(utcMs: number): Promise<void>;
}
