/**
 * Integration tests for Watchlist API routes
 *
 * Tests the REST API endpoints for managing watchlist items.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync, existsSync } from 'node:fs';
import { createDashboardServer } from '../../../src/web/server.js';
import type { DashboardServerOptions } from '../../../src/web/server.js';
import { SQLiteAdapter } from '../../../src/adapters/storage/sqlite-adapter.js';

describe('Watchlist API', () => {
  let serverUrl: string;
  let serverInstance: Awaited<ReturnType<typeof createDashboardServer>>;
  let dbPath: string;

  beforeAll(async () => {
    // Create temp database
    dbPath = join(tmpdir(), `morningtrader-watchlist-test-${Date.now()}.db`);

    // Initialize database with migrations first
    const adapter = new SQLiteAdapter(dbPath);
    adapter.initialize();
    adapter.close();

    // Create and start server
    const options: DashboardServerOptions = {
      dbPath,
      port: 0, // Let OS assign port
      host: '127.0.0.1',
    };

    serverInstance = await createDashboardServer(options);
    const { url } = await serverInstance.start();
    serverUrl = url;
  });

  afterAll(async () => {
    await serverInstance.stop();

    // Clean up temp database
    if (existsSync(dbPath)) unlinkSync(dbPath);
    if (existsSync(dbPath + '-shm')) unlinkSync(dbPath + '-shm');
    if (existsSync(dbPath + '-wal')) unlinkSync(dbPath + '-wal');
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /api/watchlist - List all items
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('GET /api/watchlist returns empty array initially', async () => {
    const response = await fetch(`${serverUrl}/api/watchlist`);

    expect(response.status).toBe(200);
    const items = await response.json();
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBe(0);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /api/watchlist - Create item
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('POST /api/watchlist creates a new item', async () => {
    const data = {
      symbol: 'AAPL',
      isMock: true,
      scheduleEnabled: false,
    };

    const response = await fetch(`${serverUrl}/api/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    expect(response.status).toBe(201);
    const item = await response.json();

    expect(item.id).toBeGreaterThan(0);
    expect(item.symbol).toBe('AAPL');
    expect(item.isActive).toBe(true); // Default value
    expect(item.isMock).toBe(true);
    expect(item.scheduleEnabled).toBe(false);
    expect(item.createdAt).toBeGreaterThan(0);
    expect(item.updatedAt).toBeGreaterThan(0);
  });

  it('POST /api/watchlist normalizes symbol to uppercase', async () => {
    const data = {
      symbol: 'tsla',
      isMock: false,
      scheduleEnabled: true,
    };

    const response = await fetch(`${serverUrl}/api/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    expect(response.status).toBe(201);
    const item = await response.json();
    expect(item.symbol).toBe('TSLA');
  });

  it('POST /api/watchlist rejects duplicate symbol', async () => {
    const data = { symbol: 'SPY', isMock: true, scheduleEnabled: false };

    // Create first
    const first = await fetch(`${serverUrl}/api/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    expect(first.status).toBe(201);

    // Try to create duplicate
    const second = await fetch(`${serverUrl}/api/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    expect(second.status).toBe(409);
    const error = await second.json();
    expect(error.error).toContain('already in watchlist');
  });

  it('POST /api/watchlist rejects invalid request body', async () => {
    const data = {
      symbol: 'AAPL',
      // Missing required fields
    };

    const response = await fetch(`${serverUrl}/api/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    expect(response.status).toBe(400);
    const error = await response.json();
    expect(error.error).toContain('Invalid request body');
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PUT /api/watchlist/:id - Update item
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('PUT /api/watchlist/:id updates item', async () => {
    // Create
    const create = await fetch(`${serverUrl}/api/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: 'MSFT', isMock: true, scheduleEnabled: false }),
    });
    const created = await create.json();

    // Update
    const response = await fetch(`${serverUrl}/api/watchlist/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isMock: false, scheduleEnabled: true }),
    });

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.symbol).toBe('MSFT'); // Unchanged
    expect(updated.isMock).toBe(false); // Updated
    expect(updated.scheduleEnabled).toBe(true); // Updated
    expect(updated.updatedAt).toBeGreaterThan(created.updatedAt);
  });

  it('PUT /api/watchlist/:id toggles isActive', async () => {
    // Create
    const create = await fetch(`${serverUrl}/api/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: 'GOOGL', isMock: true, scheduleEnabled: false }),
    });
    const created = await create.json();
    expect(created.isActive).toBe(true);

    // Toggle to inactive
    const toggle = await fetch(`${serverUrl}/api/watchlist/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    });

    expect(toggle.status).toBe(200);
    const updated = await toggle.json();
    expect(updated.isActive).toBe(false);
  });

  it('PUT /api/watchlist/:id returns 404 for non-existent id', async () => {
    const response = await fetch(`${serverUrl}/api/watchlist/99999`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isMock: true }),
    });

    expect(response.status).toBe(404);
    const error = await response.json();
    expect(error.error).toContain('not found');
  });

  it('PUT /api/watchlist/:id returns 400 for invalid id', async () => {
    const response = await fetch(`${serverUrl}/api/watchlist/invalid`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isMock: true }),
    });

    expect(response.status).toBe(400);
    const error = await response.json();
    expect(error.error).toContain('Invalid ID');
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DELETE /api/watchlist/:id - Delete item
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('DELETE /api/watchlist/:id deletes item', async () => {
    // Create
    const create = await fetch(`${serverUrl}/api/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: 'AMZN', isMock: true, scheduleEnabled: false }),
    });
    const created = await create.json();

    // Delete
    const response = await fetch(`${serverUrl}/api/watchlist/${created.id}`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(204);

    // Verify deleted (list should not include it)
    const list = await fetch(`${serverUrl}/api/watchlist`);
    const items = await list.json();
    const found = items.find((item: any) => item.id === created.id);
    expect(found).toBeUndefined();
  });

  it('DELETE /api/watchlist/:id returns 404 for non-existent id', async () => {
    const response = await fetch(`${serverUrl}/api/watchlist/99999`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(404);
    const error = await response.json();
    expect(error.error).toContain('not found');
  });

  it('DELETE /api/watchlist/:id returns 400 for invalid id', async () => {
    const response = await fetch(`${serverUrl}/api/watchlist/invalid`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(400);
    const error = await response.json();
    expect(error.error).toContain('Invalid ID');
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Workflow tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('Complete CRUD workflow', async () => {
    // 1. List should be empty initially
    const list1 = await fetch(`${serverUrl}/api/watchlist`);
    const items1 = await list1.json();
    const initialCount = items1.length;

    // 2. Create item
    const create = await fetch(`${serverUrl}/api/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: 'NFLX', isMock: true, scheduleEnabled: false }),
    });
    const created = await create.json();
    expect(created.symbol).toBe('NFLX');

    // 3. List should contain new item
    const list2 = await fetch(`${serverUrl}/api/watchlist`);
    const items2 = await list2.json();
    expect(items2.length).toBe(initialCount + 1);
    const found = items2.find((item: any) => item.symbol === 'NFLX');
    expect(found).toBeDefined();

    // 4. Update item
    const update = await fetch(`${serverUrl}/api/watchlist/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isMock: false, scheduleEnabled: true }),
    });
    const updated = await update.json();
    expect(updated.isMock).toBe(false);
    expect(updated.scheduleEnabled).toBe(true);

    // 5. Delete item
    const deleteResponse = await fetch(`${serverUrl}/api/watchlist/${created.id}`, {
      method: 'DELETE',
    });
    expect(deleteResponse.status).toBe(204);

    // 6. List should be back to original count
    const list3 = await fetch(`${serverUrl}/api/watchlist`);
    const items3 = await list3.json();
    expect(items3.length).toBe(initialCount);
  });
});
