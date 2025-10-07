import type { RequestHandler } from 'express';
import { env } from '../../config';
import { logger } from '../../lib/logger';
import type { AuthRole, AuthUser } from './types';

const DEFAULT_USER: AuthUser = {
  id: 'user_mock',
  email: 'mock@example.com',
  name: 'Mock User',
  roles: ['user'],
  locale: 'tr-TR',
};

const parseRoles = (raw: string | undefined): AuthRole[] => {
  if (!raw) {
    return DEFAULT_USER.roles;
  }

  return raw
    .split(',')
    .map((role) => role.trim())
    .filter((role): role is AuthRole => role === 'admin' || role === 'user' || role === 'viewer');
};

export const mockAuthMiddleware: RequestHandler = (req, res, next) => {
  if (!env.isDevelopment) {
    return next();
  }

  const roles = parseRoles(req.header('x-mock-user-roles') ?? undefined);
  const user: AuthUser = {
    id: req.header('x-mock-user-id') ?? DEFAULT_USER.id,
    email: req.header('x-mock-user-email') ?? DEFAULT_USER.email,
    name: req.header('x-mock-user-name') ?? DEFAULT_USER.name,
    roles,
    locale: req.header('x-mock-user-locale') ?? DEFAULT_USER.locale,
  };

  if (req.header('x-mock-disable-auth') === '1') {
    logger.debug('Mock auth devre dışı bırakıldı.');
    req.authUser = undefined;
    res.locals.authUser = undefined;
    return next();
  }

  req.authUser = user;
  res.locals.authUser = user;
  next();
};
