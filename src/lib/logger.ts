import pino from 'pino';
import { env } from '../config';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: 'sample-art-backend',
  },
  transport: env.isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
        },
      },
});
