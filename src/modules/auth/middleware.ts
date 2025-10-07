import type { RequestHandler, Response } from 'express';
import { clerkAuthAdapter, extractTokenFromHeaders } from './clerk';
import { logger } from '../../lib/logger';

const unauthorizedResponse = (res: Response) =>
  res.status(401).json({
    error: {
      message: 'Unauthorized',
    },
  });

export const clerkAuthMiddleware: RequestHandler = async (req, res, next) => {
  const headers = req.headers as Record<string, string | string[] | undefined>;
  const { credentialPresent } = extractTokenFromHeaders(headers);

  try {
    const authUser = await clerkAuthAdapter.verifyRequest(headers);

    if (authUser) {
      req.authUser = authUser;
      res.locals.authUser = authUser;
    } else {
      req.authUser = undefined;
      res.locals.authUser = undefined;
    }

    next();
  } catch (error) {
    logger.warn({ err: error }, 'Clerk authentication failed');

    if (credentialPresent) {
      return unauthorizedResponse(res);
    }

    req.authUser = undefined;
    res.locals.authUser = undefined;
    next();
  }
};
