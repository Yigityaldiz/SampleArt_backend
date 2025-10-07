import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { requestIdMiddleware } from './middlewares/request-id';
import { notFoundHandler } from './middlewares/not-found';
import { errorHandler } from './middlewares/error-handler';
import { healthRouter } from './modules/health';
import { usersRouter } from './modules/users';
import { samplesRouter } from './modules/samples';
import { collectionsRouter } from './modules/collections';
import { logger } from './lib/logger';
import { env } from './config';
import { clerkAuthMiddleware, mockAuthMiddleware } from './modules/auth';

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(requestIdMiddleware);
  app.use(
    pinoHttp({
      logger,
      customProps: (req) => ({
        requestId: req.id,
      }),
    }),
  );

  app.use(
    rateLimit({
      windowMs: 60_000,
      max: env.isProduction ? 100 : 500,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (env.isDevelopment) {
    app.use(mockAuthMiddleware);
  } else {
    app.use(clerkAuthMiddleware);
  }

  app.use('/health', healthRouter);
  app.use('/users', usersRouter);
  app.use('/samples', samplesRouter);
  app.use('/collections', collectionsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
