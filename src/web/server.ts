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
import { SQLiteAdapter } from '../adapters/storage/sqlite-adapter.js';
import { registerOverviewRoutes } from './routes/overview.js';
import { registerSessionRoutes } from './routes/sessions.js';
import { registerStatsRoutes } from './routes/stats.js';
import { maintenanceRoutes } from './routes/maintenance.js';
import { registerConfigPresetRoutes } from './routes/config-presets.js';
import { registerBacktestJobRoutes } from './routes/backtest-jobs.js';
import { JobQueue } from '../services/job-queue.js';
import { BacktestRunner } from '../services/backtest-runner.js';
import { createLogger } from '../services/logger.js';
import { presetToStrategyConfig } from '../adapters/storage/config-adapter.js';
import { loadHolidayCalendar } from '../utils/holidays.js';
import type { StrategyConfig } from '../core/models/index.js';

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

  // Separate read-write connection for maintenance operations
  const maintenanceStorage = new SQLiteAdapter(dbPath);
  maintenanceStorage.initialize();

  // ── JobQueue for async backtests ─────────────────────────────
  const logger = createLogger();
  const calendar = loadHolidayCalendar();

  // Get default config (will be overridden by preset during job execution)
  const defaultPreset = maintenanceStorage.getDefaultConfigPreset();
  const defaultConfig: StrategyConfig = defaultPreset
    ? presetToStrategyConfig(defaultPreset)
    : {
        maxBreakAttempts: 5,
        minZoneSpreadCents: 10,
        maxZoneSpreadPercent: 3.0,
        barSizeMinutes: 5 as const,
        sessionWindows: {
          premarketTime: '04:30',
          zoneStartTime: '09:30',
          zoneEndTime: '10:00',
          executionEndTime: '12:00',
        },
        minZoneBars: 3,
        targets: {
          target1RMultiple: 1.0,
          target2RMultiple: 2.0,
          target3RMultiple: 3.0,
        },
        trailingStopAt1R: true,
      };

  const backtestRunner = new BacktestRunner(
    logger,
    defaultConfig,
    calendar,
    maintenanceStorage,
  );

  const jobQueue = new JobQueue({
    storage: maintenanceStorage,
    backtestRunner,
  });

  // Initialize job queue (recover stale jobs)
  await jobQueue.initialize();
  jobQueue.start();

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
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
    if (request.method === 'OPTIONS') {
      return reply.code(204).send();
    }
  });

  // ── API Routes ────────────────────────────────────────────────
  registerOverviewRoutes(app, dashboardQueries);
  registerSessionRoutes(app, dashboardQueries);
  registerStatsRoutes(app, dashboardQueries, aggregationQueries);
  await maintenanceRoutes(app, maintenanceStorage);
  await registerConfigPresetRoutes(app, maintenanceStorage);
  await registerBacktestJobRoutes(app, jobQueue);

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
    await jobQueue.stop();
    db.close();
    maintenanceStorage.close();
  });

  return {
    app,
    async start() {
      await app.listen({ port, host });
      const address = app.server.address();
      const actualPort = typeof address === 'object' && address !== null ? address.port : port;
      return { port: actualPort, host, url: `http://${host}:${actualPort}` };
    },
    async stop() {
      await app.close();
    },
  };
}
