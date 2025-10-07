import type { NextFunction, Request, Response } from 'express';
import { SampleService } from './service';
import {
  createSampleBodySchema,
  updateSampleBodySchema,
  listSamplesQuerySchema,
  sampleIdParamSchema,
} from './schemas';

const service = new SampleService();

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

    const targetUserId = body.userId ?? authUser.id;

    if (!authUser.roles.includes('admin') && targetUserId !== authUser.id) {
      return res.status(403).json({ error: { message: 'Forbidden' } });
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
