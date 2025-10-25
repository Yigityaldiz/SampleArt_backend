import type { RequestHandler } from 'express';
import { env } from '../../config';
import { logger } from '../../lib/logger';
import type { AuthRole, AuthUser } from './types';
import { isSupportedLanguageCode } from '../users/languages';

const DEFAULT_USER: AuthUser = {
  id: 'user_mock',
  email: 'mock@example.com',
  name: 'Mock User',
  roles: ['user'],
  locale: 'tr',
};

const resolveLocale = (value: string | null | undefined): AuthUser['locale'] => {
  if (typeof value === 'string' && isSupportedLanguageCode(value)) {
    return value;
  }

  const fallback = DEFAULT_USER.locale;
  if (typeof fallback === 'string' && isSupportedLanguageCode(fallback)) {
    return fallback;
  }

  return 'en';
};

const parseRoles = (raw: string | undefined): AuthRole[] => {
  if (!raw) {
    return DEFAULT_USER.roles;
  }

  return raw
    .split(',')
    .map((role) => role.trim())
    .filter(
      (role): role is AuthRole =>
        role === 'admin' || role === 'user' || role === 'viewer' || role === 'seller',
    );
};

export const mockAuthMiddleware: RequestHandler = (req, res, next) => {
  if (!env.isDevelopment) {
    return next();
  }

  const roles = parseRoles(req.header('x-mock-user-roles') ?? undefined);
  const locale = resolveLocale(req.header('x-mock-user-locale') ?? undefined);
  const user: AuthUser = {
    id: req.header('x-mock-user-id') ?? DEFAULT_USER.id,
    email: req.header('x-mock-user-email') ?? DEFAULT_USER.email,
    name: req.header('x-mock-user-name') ?? DEFAULT_USER.name,
    roles,
    locale,
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
