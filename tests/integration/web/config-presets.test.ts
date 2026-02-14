/**
 * Integration tests for Config Presets API routes
 *
 * Tests the REST API endpoints for managing strategy configuration presets.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync, existsSync } from 'node:fs';
import { createDashboardServer } from '../../../src/web/server.js';
import type { DashboardServerOptions } from '../../../src/web/server.js';
import { SQLiteAdapter } from '../../../src/adapters/storage/sqlite-adapter.js';

describe('Config Presets API', () => {
  let serverUrl: string;
  let serverInstance: Awaited<ReturnType<typeof createDashboardServer>>;
  let dbPath: string;

  beforeAll(async () => {
    // Create temp database
    dbPath = join(tmpdir(), `morningtrader-config-test-${Date.now()}.db`);

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
  // GET /api/config-presets - List all presets
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('GET /api/config-presets returns empty array initially', async () => {
    const response = await fetch(`${serverUrl}/api/config-presets`);

    expect(response.status).toBe(200);
    const presets = await response.json();
    expect(Array.isArray(presets)).toBe(true);
    expect(presets.length).toBe(0);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /api/config-presets - Create preset
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('POST /api/config-presets creates a new preset', async () => {
    const data = {
      name: 'Test Preset',
      maxBreakAttempts: 7,
      minZoneSpreadCents: 15,
    };

    const response = await fetch(`${serverUrl}/api/config-presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    expect(response.status).toBe(201);
    const preset = await response.json();

    expect(preset.id).toBeGreaterThan(0);
    expect(preset.name).toBe('Test Preset');
    expect(preset.isDefault).toBe(false);
    expect(preset.maxBreakAttempts).toBe(7);
    expect(preset.minZoneSpreadCents).toBe(15);
    expect(preset.createdAt).toBeGreaterThan(0);
    expect(preset.updatedAt).toBeGreaterThan(0);
  });

  it('POST /api/config-presets uses defaults for omitted fields', async () => {
    const data = {
      name: 'Minimal Preset',
    };

    const response = await fetch(`${serverUrl}/api/config-presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    expect(response.status).toBe(201);
    const preset = await response.json();

    expect(preset.maxBreakAttempts).toBe(5);
    expect(preset.minZoneSpreadCents).toBe(10);
    expect(preset.maxZoneSpreadPercent).toBe(3.0);
    expect(preset.target1RMultiple).toBe(1.0);
    expect(preset.trailingStopAt1R).toBe(true);
  });

  it('POST /api/config-presets rejects empty name', async () => {
    const data = { name: '' };

    const response = await fetch(`${serverUrl}/api/config-presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    expect(response.status).toBe(400);
    const error = await response.json();
    expect(error.error).toContain('required');
  });

  it('POST /api/config-presets rejects duplicate name', async () => {
    const data = { name: 'Duplicate Test' };

    // Create first
    const first = await fetch(`${serverUrl}/api/config-presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    expect(first.status).toBe(201);

    // Try to create duplicate
    const second = await fetch(`${serverUrl}/api/config-presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    expect(second.status).toBe(409);
    const error = await second.json();
    expect(error.error).toContain('already exists');
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /api/config-presets/:id - Get preset by id
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('GET /api/config-presets/:id returns preset', async () => {
    // Create a preset
    const create = await fetch(`${serverUrl}/api/config-presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Get Test' }),
    });
    const created = await create.json();

    // Get by id
    const response = await fetch(`${serverUrl}/api/config-presets/${created.id}`);

    expect(response.status).toBe(200);
    const preset = await response.json();
    expect(preset.id).toBe(created.id);
    expect(preset.name).toBe('Get Test');
  });

  it('GET /api/config-presets/:id returns 404 for non-existent id', async () => {
    const response = await fetch(`${serverUrl}/api/config-presets/99999`);

    expect(response.status).toBe(404);
    const error = await response.json();
    expect(error.error).toContain('not found');
  });

  it('GET /api/config-presets/:id returns 400 for invalid id', async () => {
    const response = await fetch(`${serverUrl}/api/config-presets/invalid`);

    expect(response.status).toBe(400);
    const error = await response.json();
    expect(error.error).toContain('Invalid');
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PUT /api/config-presets/:id - Update preset
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('PUT /api/config-presets/:id updates preset', async () => {
    // Create
    const create = await fetch(`${serverUrl}/api/config-presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Update Test' }),
    });
    const created = await create.json();

    // Update
    const response = await fetch(`${serverUrl}/api/config-presets/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Name', maxBreakAttempts: 12 }),
    });

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.name).toBe('Updated Name');
    expect(updated.maxBreakAttempts).toBe(12);
    expect(updated.updatedAt).toBeGreaterThan(created.updatedAt);
  });

  it('PUT /api/config-presets/:id returns 404 for non-existent id', async () => {
    const response = await fetch(`${serverUrl}/api/config-presets/99999`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });

    expect(response.status).toBe(404);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /api/config-presets/:id/default - Set as default
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('POST /api/config-presets/:id/default sets preset as default', async () => {
    // Create two presets
    const first = await fetch(`${serverUrl}/api/config-presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'First' }),
    });
    const firstPreset = await first.json();

    const second = await fetch(`${serverUrl}/api/config-presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Second' }),
    });
    const secondPreset = await second.json();

    // Set first as default
    const setFirst = await fetch(`${serverUrl}/api/config-presets/${firstPreset.id}/default`, {
      method: 'POST',
    });
    expect(setFirst.status).toBe(200);

    // Set second as default
    const setSecond = await fetch(`${serverUrl}/api/config-presets/${secondPreset.id}/default`, {
      method: 'POST',
    });
    expect(setSecond.status).toBe(200);
    const updated = await setSecond.json();
    expect(updated.isDefault).toBe(true);

    // Verify first is no longer default
    const checkFirst = await fetch(`${serverUrl}/api/config-presets/${firstPreset.id}`);
    const firstCheck = await checkFirst.json();
    expect(firstCheck.isDefault).toBe(false);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DELETE /api/config-presets/:id - Delete preset
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('DELETE /api/config-presets/:id deletes non-default preset', async () => {
    // Create
    const create = await fetch(`${serverUrl}/api/config-presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Delete Test' }),
    });
    const created = await create.json();

    // Delete
    const response = await fetch(`${serverUrl}/api/config-presets/${created.id}`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(204);

    // Verify deleted
    const check = await fetch(`${serverUrl}/api/config-presets/${created.id}`);
    expect(check.status).toBe(404);
  });

  it('DELETE /api/config-presets/:id prevents deletion of default preset', async () => {
    // Create and set as default
    const create = await fetch(`${serverUrl}/api/config-presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Default Delete Test' }),
    });
    const created = await create.json();

    await fetch(`${serverUrl}/api/config-presets/${created.id}/default`, {
      method: 'POST',
    });

    // Try to delete
    const response = await fetch(`${serverUrl}/api/config-presets/${created.id}`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(403);
    const error = await response.json();
    expect(error.error).toContain('Cannot delete default preset');

    // Verify still exists
    const check = await fetch(`${serverUrl}/api/config-presets/${created.id}`);
    expect(check.status).toBe(200);
  });

  it('DELETE /api/config-presets/:id returns 404 for non-existent id', async () => {
    const response = await fetch(`${serverUrl}/api/config-presets/99999`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(404);
  });
});
