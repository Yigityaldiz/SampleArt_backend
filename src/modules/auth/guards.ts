import type { NextFunction, Request, Response } from 'express';
import { logger } from '../../lib/logger';
import type { AuthRole } from './types';

const unauthorized = (res: Response) =>
  res.status(401).json({
    error: {
      message: 'Unauthorized',
    },
  });

const forbidden = (res: Response) =>
  res.status(403).json({
    error: {
      message: 'Forbidden',
    },
  });

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.authUser) {
    return unauthorized(res);
  }

  return next();
};

export const requireRole =
  (roles: AuthRole | AuthRole[]) => (req: Request, res: Response, next: NextFunction) => {
    const requiredRoles = Array.isArray(roles) ? roles : [roles];

    if (!req.authUser) {
      return unauthorized(res);
    }

    const hasRole = req.authUser.roles.some((role) => requiredRoles.includes(role));

    if (!hasRole) {
      logger.warn(
        {
          userId: req.authUser.id,
          requiredRoles,
          userRoles: req.authUser.roles,
        },
        'Role check failed',
      );

      return forbidden(res);
    }

    return next();
  };
