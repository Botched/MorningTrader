import type { Command } from 'commander';
import { createDashboardServer } from '../../web/server.js';

export function registerDashboardCommand(program: Command): void {
  program
    .command('dashboard')
    .description('Start the web dashboard to visualize trading results')
    .option('-p, --port <number>', 'Port to listen on', '3847')
    .option('-H, --host <address>', 'Host address to bind to', '127.0.0.1')
    .option('--db <path>', 'Path to SQLite database', 'data/morningtrader.db')
    .option('--no-open', 'Do not open browser automatically')
    .action(async (opts: {
      port: string;
      host: string;
      db: string;
      open: boolean;
    }) => {
      const port = parseInt(opts.port, 10);
      const host = opts.host;

      console.log(`Starting MorningTrader Dashboard...`);
      console.log(`  Database: ${opts.db}`);
      console.log(`  Address:  http://${host}:${port}`);

      try {
        const server = await createDashboardServer({
          dbPath: opts.db,
          port,
          host,
        });

        const info = await server.start();
        console.log(`\n  Dashboard running at ${info.url}\n`);

        if (opts.open) {
          // Try to open browser
          const { exec } = await import('node:child_process');
          const cmd = process.platform === 'win32' ? 'start'
            : process.platform === 'darwin' ? 'open'
            : 'xdg-open';
          exec(`${cmd} ${info.url}`);
        }

        // Keep running until SIGINT/SIGTERM
        const shutdown = async () => {
          console.log('\nShutting down dashboard server...');
          await server.stop();
          process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
      } catch (err) {
        console.error('Failed to start dashboard:', err);
        process.exit(1);
      }
    });
}
