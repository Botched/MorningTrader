import type Database from 'better-sqlite3';
import type { WatchlistItem, WatchlistItemInput, WatchlistItemUpdate } from '../../../core/models/index.js';

// -----------------------------------------------------------------------
// Watchlist CRUD Queries
// -----------------------------------------------------------------------

export function createWatchlistQueries(db: Database.Database) {
  // ── Create ──────────────────────────────────────────────────────────
  const insertStmt = db.prepare(`
    INSERT INTO watchlist_items (
      symbol,
      is_active,
      is_mock,
      schedule_enabled,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  function createWatchlistItem(request: WatchlistItemInput): number {
    const now = Date.now();
    const result = insertStmt.run(
      request.symbol,
      1, // isActive defaults to true for new items
      request.isMock ? 1 : 0,
      request.scheduleEnabled ? 1 : 0,
      now,
      now,
    );
    return result.lastInsertRowid as number;
  }

  // ── Read ────────────────────────────────────────────────────────────
  const getByIdStmt = db.prepare(`
    SELECT
      id,
      symbol,
      is_active AS isActive,
      is_mock AS isMock,
      schedule_enabled AS scheduleEnabled,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM watchlist_items
    WHERE id = ?
  `);

  function getWatchlistItem(id: number): WatchlistItem | null {
    const row = getByIdStmt.get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      symbol: row.symbol,
      isActive: row.isActive === 1,
      isMock: row.isMock === 1,
      scheduleEnabled: row.scheduleEnabled === 1,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  const getBySymbolStmt = db.prepare(`
    SELECT
      id,
      symbol,
      is_active AS isActive,
      is_mock AS isMock,
      schedule_enabled AS scheduleEnabled,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM watchlist_items
    WHERE symbol = ?
  `);

  function getWatchlistItemBySymbol(symbol: string): WatchlistItem | null {
    const row = getBySymbolStmt.get(symbol) as any;
    if (!row) return null;

    return {
      id: row.id,
      symbol: row.symbol,
      isActive: row.isActive === 1,
      isMock: row.isMock === 1,
      scheduleEnabled: row.scheduleEnabled === 1,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  const listAllStmt = db.prepare(`
    SELECT
      id,
      symbol,
      is_active AS isActive,
      is_mock AS isMock,
      schedule_enabled AS scheduleEnabled,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM watchlist_items
    ORDER BY created_at DESC
  `);

  function listWatchlistItems(): WatchlistItem[] {
    const rows = listAllStmt.all() as any[];
    return rows.map((row) => ({
      id: row.id,
      symbol: row.symbol,
      isActive: row.isActive === 1,
      isMock: row.isMock === 1,
      scheduleEnabled: row.scheduleEnabled === 1,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  const listActiveStmt = db.prepare(`
    SELECT
      id,
      symbol,
      is_active AS isActive,
      is_mock AS isMock,
      schedule_enabled AS scheduleEnabled,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM watchlist_items
    WHERE is_active = 1
    ORDER BY created_at DESC
  `);

  function listActiveWatchlistItems(): WatchlistItem[] {
    const rows = listActiveStmt.all() as any[];
    return rows.map((row) => ({
      id: row.id,
      symbol: row.symbol,
      isActive: row.isActive === 1,
      isMock: row.isMock === 1,
      scheduleEnabled: row.scheduleEnabled === 1,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  const listScheduledStmt = db.prepare(`
    SELECT
      id,
      symbol,
      is_active AS isActive,
      is_mock AS isMock,
      schedule_enabled AS scheduleEnabled,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM watchlist_items
    WHERE is_active = 1 AND schedule_enabled = 1
    ORDER BY created_at DESC
  `);

  function listScheduledWatchlistItems(): WatchlistItem[] {
    const rows = listScheduledStmt.all() as any[];
    return rows.map((row) => ({
      id: row.id,
      symbol: row.symbol,
      isActive: row.isActive === 1,
      isMock: row.isMock === 1,
      scheduleEnabled: row.scheduleEnabled === 1,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  // ── Update ──────────────────────────────────────────────────────────
  function updateWatchlistItem(id: number, request: WatchlistItemUpdate): void {
    const now = Date.now();

    // Get current item
    const current = getWatchlistItem(id);
    if (!current) {
      throw new Error(`Watchlist item ${id} not found`);
    }

    // Build UPDATE statement dynamically based on provided fields
    const updates: string[] = [];
    const values: any[] = [];

    if (request.isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(request.isActive ? 1 : 0);
    }
    if (request.isMock !== undefined) {
      updates.push('is_mock = ?');
      values.push(request.isMock ? 1 : 0);
    }
    if (request.scheduleEnabled !== undefined) {
      updates.push('schedule_enabled = ?');
      values.push(request.scheduleEnabled ? 1 : 0);
    }

    if (updates.length === 0) {
      return; // Nothing to update
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    const sql = `UPDATE watchlist_items SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...values);
  }

  // ── Delete ──────────────────────────────────────────────────────────
  const deleteStmt = db.prepare(`
    DELETE FROM watchlist_items WHERE id = ?
  `);

  function deleteWatchlistItem(id: number): void {
    deleteStmt.run(id);
  }

  // ── Return API ──────────────────────────────────────────────────────
  return {
    createWatchlistItem,
    getWatchlistItem,
    getWatchlistItemBySymbol,
    listWatchlistItems,
    listActiveWatchlistItems,
    listScheduledWatchlistItems,
    updateWatchlistItem,
    deleteWatchlistItem,
  };
}
