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
import { uploadsRouter } from './modules/uploads';
import { invitesRouter } from './modules/invites';
import { sellerApplicationsRouter } from './modules/seller-applications';
import { logger } from './lib/logger';
import { env } from './config';
import { clerkAuthMiddleware, mockAuthMiddleware, authRouter } from './modules/auth';
import { adminRouter } from './modules/admin';
import { catalogRouter } from './modules/catalog';

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

  if (env.corsAllowedOrigins && env.corsAllowedOrigins.length > 0) {
    app.use(
      cors({
        origin: env.corsAllowedOrigins,
        credentials: true,
      }),
    );
  } else {
    app.use(cors());
  }
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (env.forceHttpsRedirect) {
    app.use((req, res, next) => {
      if (req.secure) {
        next();
        return;
      }

      const host = req.headers.host;
      if (!host) {
        res.status(400).send('Host header is required');
        return;
      }

      const redirectUrl = `https://${host}${req.originalUrl}`;
      res.redirect(307, redirectUrl);
    });
  }

  if (env.isDevelopment) {
    app.use(mockAuthMiddleware);
  } else {
    app.use(clerkAuthMiddleware);
  }

  app.use('/health', healthRouter);
  app.use('/auth', authRouter);
  app.use('/catalog', catalogRouter);
  app.use('/admin', adminRouter);
  app.use('/users', usersRouter);
  app.use('/samples', samplesRouter);
  app.use('/collections', collectionsRouter);
  app.use('/uploads', uploadsRouter);
  app.use('/invites', invitesRouter);
  app.use('/seller-applications', sellerApplicationsRouter);

  const sendAasa = (res: express.Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.json({
      applinks: {
        apps: [] as string[],
        details: [
          {
            appIDs: env.iosAppIds,
            paths: env.iosAppPaths,
          },
        ],
      },
    });
  };

  app.get('/apple-app-site-association', (_req, res) => {
    sendAasa(res);
  });
  app.get('/.well-known/apple-app-site-association', (_req, res) => {
    sendAasa(res);
  });

  app.get('/invite/:token', (req, res) => {
    const token = req.params.token ?? '';
    const redirectUrl = `${env.iosDeepLinkScheme}://invite/${encodeURIComponent(token)}`;
    res.redirect(redirectUrl);
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
