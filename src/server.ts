import { createApp } from './app';
import { env } from './config';
import { logger } from './lib/logger';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'HTTP server is listening');
});

const shutdown = (signal: NodeJS.Signals) => {
  logger.info({ signal }, 'Received shutdown signal');
  server.close((error) => {
    if (error) {
      logger.error({ err: error }, 'Error during graceful shutdown');
      process.exit(1);
    }

    logger.info('HTTP server closed gracefully');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
