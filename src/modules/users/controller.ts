import type { NextFunction, Request, Response } from 'express';
import { NotFoundError } from '../../errors';
import { UserService } from './service';
import type { AuthUser } from '../auth';
import {
  listUsersQuerySchema,
  userIdParamSchema,
  createUserBodySchema,
  updateUserBodySchema,
  updateUserLanguageBodySchema,
} from './schemas';
import { isSupportedLanguageCode } from './languages';
import { sanitizeOptionalName } from './name';

const service = new UserService();

const toNullable = <T>(value: T | null | undefined) => (value === undefined ? undefined : value);

const normalizeLocale = (value: string | null | undefined) =>
  typeof value === 'string' && isSupportedLanguageCode(value) ? value : undefined;

const ensureUserRecord = async (authUser: AuthUser) => {
  try {
    return await service.getById(authUser.id);
  } catch (error) {
    if (!(error instanceof NotFoundError)) {
      throw error;
    }

    return service.create({
      id: authUser.id,
      email: toNullable(authUser.email),
      name: sanitizeOptionalName(authUser.name) ?? null,
      locale: toNullable(normalizeLocale(authUser.locale)),
    });
  }
};

const isRecordNotFoundError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return 'code' in error && (error as { code?: string }).code === 'P2025';
};

export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    const query = listUsersQuerySchema.parse(req.query);

    const isAdmin = authUser.roles.includes('admin');

    if (!isAdmin) {
      const user = await ensureUserRecord(authUser);
      return res.json({ data: [user] });
    }

    const users = await service.list(query);
    res.json({ data: users });
  } catch (error) {
    next(error);
  }
};

export const getUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    const params = userIdParamSchema.parse(req.params);

    const isAdmin = authUser.roles.includes('admin');

    if (!isAdmin && params.id !== authUser.id) {
      return res.status(403).json({ error: { message: 'Forbidden' } });
    }

    const user = await service.getById(params.id);
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    const body = createUserBodySchema.parse(req.body);

    const isAdmin = authUser.roles.includes('admin');

    if (!isAdmin && body.id !== authUser.id) {
      return res.status(403).json({ error: { message: 'Forbidden' } });
    }

    const sanitizedName = sanitizeOptionalName(body.name);
    const created = await service.create({
      id: body.id,
      email: toNullable(body.email),
      name: sanitizedName ?? null,
      locale: toNullable(body.locale),
    });

    res.status(201).json({ data: created });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    const params = userIdParamSchema.parse(req.params);

    const isAdmin = authUser.roles.includes('admin');

    if (!isAdmin && params.id !== authUser.id) {
      return res.status(403).json({ error: { message: 'Forbidden' } });
    }

    const body = updateUserBodySchema.parse(req.body);
    const updated = await service.update(params.id, {
      email: toNullable(body.email),
      name: sanitizeOptionalName(body.name),
      locale: toNullable(body.locale),
    });

    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    const user = await ensureUserRecord(authUser);
    return res.json({ data: user });
  } catch (error) {
    next(error);
  }
};

export const updateCurrentUserLanguage = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    const body = updateUserLanguageBodySchema.parse(req.body);
    try {
      const updated = await service.update(authUser.id, {
        locale: body.locale,
      });

      res.json({ data: updated });
      return;
    } catch (error) {
      if (!isRecordNotFoundError(error)) {
        throw error;
      }

      await service.create({
        id: authUser.id,
        email: toNullable(authUser.email),
        name: sanitizeOptionalName(authUser.name) ?? null,
        locale: toNullable(body.locale),
      });

      const updated = await service.update(authUser.id, {
        locale: body.locale,
      });

      res.json({ data: updated });
    }
  } catch (error) {
    next(error);
  }
};
