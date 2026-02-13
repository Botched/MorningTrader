/**
 * MorningTrader Web Dashboard Server
 *
 * Fastify server that serves:
 * - JSON API routes (/api/*) backed by SQLite read queries
 * - Static React SPA assets (built from web/)
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import Database from 'better-sqlite3';
import { createDashboardQueries } from '../adapters/storage/queries/dashboard.js';
import { createAggregationQueries } from '../adapters/storage/queries/aggregations.js';
import { registerOverviewRoutes } from './routes/overview.js';
import { registerSessionRoutes } from './routes/sessions.js';
import { registerStatsRoutes } from './routes/stats.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DashboardServerOptions {
  dbPath: string;
  port?: number;
  host?: string;
}

export async function createDashboardServer(options: DashboardServerOptions) {
  const { dbPath, port = 3847, host = '127.0.0.1' } = options;

  // Open a read-only DB connection for the web server
  const db = new Database(dbPath, { readonly: true });
  db.pragma('journal_mode = WAL');

  const dashboardQueries = createDashboardQueries(db);
  const aggregationQueries = createAggregationQueries(db);

  const app = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    },
  });

  // ── CORS for development ──────────────────────────────────────
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
    if (request.method === 'OPTIONS') {
      return reply.code(204).send();
    }
  });

  // ── API Routes ────────────────────────────────────────────────
  registerOverviewRoutes(app, dashboardQueries);
  registerSessionRoutes(app, dashboardQueries);
  registerStatsRoutes(app, dashboardQueries, aggregationQueries);

  // ── Static SPA serving ────────────────────────────────────────
  // Serve built frontend assets from web/dist
  const webDistPath = path.resolve(__dirname, '../../web/dist');

  try {
    await app.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
      wildcard: false,
    });

    // SPA fallback: serve index.html for all non-API, non-static routes
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.code(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html');
    });
  } catch {
    // web/dist may not exist yet during development
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.code(404).send({ error: 'Not found' });
      }
      return reply.code(200).send(
        '<html><body><h1>MorningTrader Dashboard</h1>' +
        '<p>Frontend not built yet. Run <code>npm run build:web</code> first, ' +
        'or use <code>npm run dev:web</code> for development.</p></body></html>',
      );
    });
  }

  // ── Lifecycle hooks ───────────────────────────────────────────
  app.addHook('onClose', async () => {
    db.close();
  });

  return {
    app,
    async start() {
      await app.listen({ port, host });
      return { port, host, url: `http://${host}:${port}` };
    },
    async stop() {
      await app.close();
    },
  };
}
