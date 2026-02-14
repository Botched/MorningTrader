/**
 * Watchlist API Routes
 *
 * Provides CRUD operations for watchlist items:
 * - GET /api/watchlist - List all watchlist items
 * - POST /api/watchlist - Create new watchlist item
 * - PUT /api/watchlist/:id - Update watchlist item
 * - DELETE /api/watchlist/:id - Delete watchlist item
 *
 * Note: "Run" functionality is deferred to a future implementation.
 * For now, these routes only manage the watchlist data.
 */

import type { FastifyInstance } from 'fastify';
import type { SQLiteAdapter } from '../../adapters/storage/sqlite-adapter.js';
import { z } from 'zod';

// ───────────────────────────────────────────────────────────────────────
// Validation Schemas
// ───────────────────────────────────────────────────────────────────────

const CreateWatchlistItemSchema = z.object({
  symbol: z.string().min(1).max(10).transform(s => s.toUpperCase()),
  isMock: z.boolean(),
  scheduleEnabled: z.boolean(),
});

const UpdateWatchlistItemSchema = z.object({
  isActive: z.boolean().optional(),
  isMock: z.boolean().optional(),
  scheduleEnabled: z.boolean().optional(),
});

// ───────────────────────────────────────────────────────────────────────
// Route Registration
// ───────────────────────────────────────────────────────────────────────

export async function registerWatchlistRoutes(
  app: FastifyInstance,
  storage: SQLiteAdapter,
): Promise<void> {
  // ─── GET /api/watchlist ───────────────────────────────────────────────
  app.get('/api/watchlist', async (_request, reply) => {
    try {
      const items = storage.getWatchlistItems();
      return reply.code(200).send(items);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list watchlist items';
      app.log.error({ error }, message);
      return reply.code(500).send({ error: message });
    }
  });

  // ─── POST /api/watchlist ──────────────────────────────────────────────
  app.post('/api/watchlist', async (request, reply) => {
    try {
      const body = CreateWatchlistItemSchema.parse(request.body);

      // Check if symbol already exists
      const existing = storage.getWatchlistItems().find(item => item.symbol === body.symbol);
      if (existing) {
        return reply.code(409).send({ error: `Symbol ${body.symbol} already in watchlist` });
      }

      const id = storage.createWatchlistItem(body);
      const item = storage.getWatchlistItem(id);

      return reply.code(201).send(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request body', details: error.errors });
      }

      const message = error instanceof Error ? error.message : 'Failed to create watchlist item';
      app.log.error({ error }, message);
      return reply.code(500).send({ error: message });
    }
  });

  // ─── PUT /api/watchlist/:id ───────────────────────────────────────────
  app.put<{ Params: { id: string } }>('/api/watchlist/:id', async (request, reply) => {
    try {
      const id = parseInt(request.params.id, 10);
      if (isNaN(id)) {
        return reply.code(400).send({ error: 'Invalid ID' });
      }

      const body = UpdateWatchlistItemSchema.parse(request.body);

      // Check if item exists
      const existing = storage.getWatchlistItem(id);
      if (!existing) {
        return reply.code(404).send({ error: `Watchlist item ${id} not found` });
      }

      storage.updateWatchlistItem(id, body);
      const updated = storage.getWatchlistItem(id);

      return reply.code(200).send(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request body', details: error.errors });
      }

      const message = error instanceof Error ? error.message : 'Failed to update watchlist item';
      app.log.error({ error }, message);
      return reply.code(500).send({ error: message });
    }
  });

  // ─── DELETE /api/watchlist/:id ────────────────────────────────────────
  app.delete<{ Params: { id: string } }>('/api/watchlist/:id', async (request, reply) => {
    try {
      const id = parseInt(request.params.id, 10);
      if (isNaN(id)) {
        return reply.code(400).send({ error: 'Invalid ID' });
      }

      // Check if item exists
      const existing = storage.getWatchlistItem(id);
      if (!existing) {
        return reply.code(404).send({ error: `Watchlist item ${id} not found` });
      }

      storage.deleteWatchlistItem(id);

      return reply.code(204).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete watchlist item';
      app.log.error({ error }, message);
      return reply.code(500).send({ error: message });
    }
  });
}
