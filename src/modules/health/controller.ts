import type { Request, Response } from 'express';
import { env } from '../../config';

export const getHealth = (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    environment: env.NODE_ENV,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
};
