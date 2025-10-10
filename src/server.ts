import fs from 'fs';
import http from 'http';
import https from 'https';
import { createApp } from './app';
import { env } from './config';
import { logger } from './lib/logger';
import { CleanupScheduler } from './modules/cleanup';

const app = createApp();
const cleanupScheduler = new CleanupScheduler();
cleanupScheduler.start();

const createServer = () => {
  if (!env.httpsEnabled) {
    logger.info('Starting HTTP server');
    return http.createServer(app);
  }

  try {
    const options: https.ServerOptions = {
      key: fs.readFileSync(env.HTTPS_KEY_PATH!, 'utf8'),
      cert: fs.readFileSync(env.HTTPS_CERT_PATH!, 'utf8'),
    };

    if (env.HTTPS_CA_PATH) {
      options.ca = fs.readFileSync(env.HTTPS_CA_PATH, 'utf8');
    }

    logger.info(
      { keyPath: env.HTTPS_KEY_PATH, certPath: env.HTTPS_CERT_PATH },
      'Starting HTTPS server',
    );
    return https.createServer(options, app);
  } catch (error) {
    logger.error({ err: error }, 'Failed to load HTTPS certificates');
    process.exit(1);
    throw error instanceof Error ? error : new Error('Unknown HTTPS configuration error');
  }
};

const server = createServer();

server.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      env: env.NODE_ENV,
      protocol: env.httpsEnabled ? 'https' : 'http',
    },
    'Server is listening',
  );
});

const shutdown = (signal: NodeJS.Signals) => {
  logger.info({ signal }, 'Received shutdown signal');
  cleanupScheduler.stop();
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
