import type { NextFunction, Request, Response } from 'express';
import { NotFoundError } from '../../errors';
import { UserService } from '../users/service';
import type { AuthUser } from '../auth';
import { SampleService } from './service';
import {
  createSampleBodySchema,
  updateSampleBodySchema,
  listSamplesQuerySchema,
  sampleIdParamSchema,
} from './schemas';

const service = new SampleService();
const userService = new UserService();

const toNullable = <T>(value: T | null | undefined) => (value === undefined ? undefined : value);

const ensureUserRecord = async (authUser: AuthUser) => {
  try {
    return await userService.getById(authUser.id);
  } catch (error) {
    if (!(error instanceof NotFoundError)) {
      throw error;
    }

    return userService.create({
      id: authUser.id,
      email: toNullable(authUser.email),
      name: toNullable(authUser.name),
      locale: toNullable(authUser.locale),
    });
  }
};

export const listSamples = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let query = listSamplesQuerySchema.parse(req.query);
    const authUser = req.authUser;

    if (authUser && !authUser.roles.includes('admin')) {
      query = {
        ...query,
        userId: authUser.id,
        includeDeleted: false,
      };
    }

    const samples = await service.list(query);
    res.json({ data: samples });
  } catch (error) {
    next(error);
  }
};

export const getSample = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = sampleIdParamSchema.parse(req.params);
    const sample = await service.getById(params.id);

    const authUser = req.authUser;
    if (authUser && !authUser.roles.includes('admin') && authUser.id !== sample.userId) {
      return res.status(403).json({ error: { message: 'Forbidden' } });
    }

    res.json({ data: sample });
  } catch (error) {
    next(error);
  }
};

export const createSample = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createSampleBodySchema.parse(req.body);
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    await ensureUserRecord(authUser);

    const targetUserId = body.userId ?? authUser.id;

    if (!authUser.roles.includes('admin') && targetUserId !== authUser.id) {
      return res.status(403).json({ error: { message: 'Forbidden' } });
    }

    if (targetUserId !== authUser.id) {
      const targetUser = await userService.getById(targetUserId).catch((error) => {
        if (error instanceof NotFoundError) {
          return null;
        }

        throw error;
      });

      if (!targetUser) {
        return res.status(400).json({ error: { message: 'Target user not found' } });
      }
    }

    const sample = await service.create({ ...body, userId: targetUserId });
    res.status(201).json({ data: sample });
  } catch (error) {
    next(error);
  }
};

export const updateSample = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = sampleIdParamSchema.parse(req.params);
    const body = updateSampleBodySchema.parse(req.body);
    const existing = await service.getById(params.id);
    const authUser = req.authUser;

    if (authUser && !authUser.roles.includes('admin') && authUser.id !== existing.userId) {
      return res.status(403).json({ error: { message: 'Forbidden' } });
    }

    const sample = await service.update(params.id, body);
    res.json({ data: sample });
  } catch (error) {
    next(error);
  }
};

export const deleteSample = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = sampleIdParamSchema.parse(req.params);
    const existing = await service.getById(params.id);
    const authUser = req.authUser;

    if (authUser && !authUser.roles.includes('admin') && authUser.id !== existing.userId) {
      return res.status(403).json({ error: { message: 'Forbidden' } });
    }

    const sample = await service.softDelete(params.id);
    res.json({ data: sample });
  } catch (error) {
    next(error);
  }
};
