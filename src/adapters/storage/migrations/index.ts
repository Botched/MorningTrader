// Barrel export for adapters/storage/migrations
export type { Migration } from './001-initial.js';
export { migration001, runMigrations } from './001-initial.js';
export { migration002 } from './002-bars.js';
export { migration003 } from './003-v2-features.js';
