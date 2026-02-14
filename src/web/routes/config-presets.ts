/**
 * Config Presets API Routes
 *
 * REST endpoints for managing strategy configuration presets:
 * - GET    /api/config-presets           → List all presets
 * - GET    /api/config-presets/:id       → Get preset by id
 * - POST   /api/config-presets           → Create new preset
 * - PUT    /api/config-presets/:id       → Update preset
 * - DELETE /api/config-presets/:id       → Delete preset
 * - POST   /api/config-presets/:id/default → Set as default preset
 */

import type { FastifyInstance } from 'fastify';
import type { SQLiteAdapter } from '../../adapters/storage/sqlite-adapter.js';
import type {
  ConfigPresetInput,
  ConfigPresetUpdate,
} from '../../core/models/config-preset.js';

interface PresetParams {
  id: string;
}

interface CreatePresetBody {
  name: string;
  maxBreakAttempts?: number;
  minZoneSpreadCents?: number;
  maxZoneSpreadPercent?: number;
  minZoneBars?: number;
  premarketTime?: string;
  zoneStartTime?: string;
  zoneEndTime?: string;
  executionEndTime?: string;
  target1RMultiple?: number;
  target2RMultiple?: number;
  target3RMultiple?: number;
  trailingStopAt1R?: boolean;
}

interface UpdatePresetBody {
  name?: string;
  maxBreakAttempts?: number;
  minZoneSpreadCents?: number;
  maxZoneSpreadPercent?: number;
  minZoneBars?: number;
  premarketTime?: string;
  zoneStartTime?: string;
  zoneEndTime?: string;
  executionEndTime?: string;
  target1RMultiple?: number;
  target2RMultiple?: number;
  target3RMultiple?: number;
  trailingStopAt1R?: boolean;
}

export async function registerConfigPresetRoutes(
  app: FastifyInstance,
  storage: SQLiteAdapter,
): Promise<void> {
  // ────────────────────────────────────────────────────────────────────
  // GET /api/config-presets - List all presets
  // ────────────────────────────────────────────────────────────────────
  app.get('/api/config-presets', async (_request, reply) => {
    try {
      const presets = storage.getConfigPresets();
      return reply.code(200).send(presets);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      app.log.error({ err }, 'Failed to get config presets');
      return reply.code(500).send({ error: message });
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // GET /api/config-presets/:id - Get preset by id
  // ────────────────────────────────────────────────────────────────────
  app.get<{ Params: PresetParams }>(
    '/api/config-presets/:id',
    async (request, reply) => {
      try {
        const id = parseInt(request.params.id, 10);
        if (isNaN(id)) {
          return reply.code(400).send({ error: 'Invalid preset ID' });
        }

        const preset = storage.getConfigPreset(id);
        if (!preset) {
          return reply.code(404).send({ error: 'Preset not found' });
        }

        return reply.code(200).send(preset);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        app.log.error({ err }, 'Failed to get config preset');
        return reply.code(500).send({ error: message });
      }
    },
  );

  // ────────────────────────────────────────────────────────────────────
  // POST /api/config-presets - Create new preset
  // ────────────────────────────────────────────────────────────────────
  app.post<{ Body: CreatePresetBody }>(
    '/api/config-presets',
    async (request, reply) => {
      try {
        const { name, ...rest } = request.body;

        if (!name || name.trim() === '') {
          return reply.code(400).send({ error: 'Preset name is required' });
        }

        const input: ConfigPresetInput = {
          name: name.trim(),
          ...rest,
        };

        const id = storage.createConfigPreset(input);
        const preset = storage.getConfigPreset(id);

        return reply.code(201).send(preset);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';

        // Handle UNIQUE constraint violation
        if (message.includes('UNIQUE constraint failed')) {
          return reply.code(409).send({ error: 'Preset name already exists' });
        }

        app.log.error({ err }, 'Failed to create config preset');
        return reply.code(500).send({ error: message });
      }
    },
  );

  // ────────────────────────────────────────────────────────────────────
  // PUT /api/config-presets/:id - Update preset
  // ────────────────────────────────────────────────────────────────────
  app.put<{ Params: PresetParams; Body: UpdatePresetBody }>(
    '/api/config-presets/:id',
    async (request, reply) => {
      try {
        const id = parseInt(request.params.id, 10);
        if (isNaN(id)) {
          return reply.code(400).send({ error: 'Invalid preset ID' });
        }

        // Verify preset exists
        const existing = storage.getConfigPreset(id);
        if (!existing) {
          return reply.code(404).send({ error: 'Preset not found' });
        }

        const { name, ...rest } = request.body;
        const updates: ConfigPresetUpdate = { ...rest };

        if (name !== undefined) {
          if (name.trim() === '') {
            return reply.code(400).send({ error: 'Preset name cannot be empty' });
          }
          (updates as any).name = name.trim();
        }

        storage.updateConfigPreset(id, updates);
        const updated = storage.getConfigPreset(id);

        return reply.code(200).send(updated);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';

        // Handle UNIQUE constraint violation
        if (message.includes('UNIQUE constraint failed')) {
          return reply.code(409).send({ error: 'Preset name already exists' });
        }

        app.log.error({ err }, 'Failed to update config preset');
        return reply.code(500).send({ error: message });
      }
    },
  );

  // ────────────────────────────────────────────────────────────────────
  // DELETE /api/config-presets/:id - Delete preset
  // ────────────────────────────────────────────────────────────────────
  app.delete<{ Params: PresetParams }>(
    '/api/config-presets/:id',
    async (request, reply) => {
      try {
        const id = parseInt(request.params.id, 10);
        if (isNaN(id)) {
          return reply.code(400).send({ error: 'Invalid preset ID' });
        }

        // Verify preset exists
        const existing = storage.getConfigPreset(id);
        if (!existing) {
          return reply.code(404).send({ error: 'Preset not found' });
        }

        storage.deleteConfigPreset(id);

        return reply.code(204).send();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';

        // Handle default preset deletion attempt
        if (message.includes('Cannot delete default preset')) {
          return reply.code(403).send({ error: message });
        }

        app.log.error({ err }, 'Failed to delete config preset');
        return reply.code(500).send({ error: message });
      }
    },
  );

  // ────────────────────────────────────────────────────────────────────
  // POST /api/config-presets/:id/default - Set as default preset
  // ────────────────────────────────────────────────────────────────────
  app.post<{ Params: PresetParams }>(
    '/api/config-presets/:id/default',
    async (request, reply) => {
      try {
        const id = parseInt(request.params.id, 10);
        if (isNaN(id)) {
          return reply.code(400).send({ error: 'Invalid preset ID' });
        }

        // Verify preset exists
        const existing = storage.getConfigPreset(id);
        if (!existing) {
          return reply.code(404).send({ error: 'Preset not found' });
        }

        storage.setDefaultPreset(id);
        const updated = storage.getConfigPreset(id);

        return reply.code(200).send(updated);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        app.log.error({ err }, 'Failed to set default preset');
        return reply.code(500).send({ error: message });
      }
    },
  );
}
