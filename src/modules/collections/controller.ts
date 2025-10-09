import type { NextFunction, Request, Response } from 'express';
import { CollectionService } from './service';
import type { AuthUser } from '../auth';
import {
  listCollectionsQuerySchema,
  collectionIdParamSchema,
  createCollectionBodySchema,
  updateCollectionBodySchema,
  addCollectionSampleBodySchema,
  reorderCollectionSamplesBodySchema,
  collectionSampleParamSchema,
} from './schemas';

const service = new CollectionService();

const ensureAuthorized = (
  authUser: AuthUser | undefined,
  ownerId: string,
): { allowed: boolean; reason?: 'unauthorized' | 'forbidden' } => {
  if (!authUser) {
    return { allowed: false, reason: 'unauthorized' };
  }

  if (authUser.id === ownerId) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'forbidden' };
};

export const listCollections = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listCollectionsQuerySchema.parse(req.query);
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    const finalQuery = {
      ...query,
      userId: authUser.id,
    };

    const collections = await service.list({ ...finalQuery, includeSamples: true });
    res.json({ data: collections });
  } catch (error) {
    next(error);
  }
};

export const getCollection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = collectionIdParamSchema.parse(req.params);
    const collection = await service.getById(params.id);
    const authUser = req.authUser;

    const auth = ensureAuthorized(authUser, collection.userId);
    if (!auth.allowed) {
      return res
        .status(auth.reason === 'unauthorized' ? 401 : 403)
        .json({ error: { message: auth.reason === 'unauthorized' ? 'Unauthorized' : 'Forbidden' } });
    }

    res.json({ data: collection });
  } catch (error) {
    next(error);
  }
};

export const createCollection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createCollectionBodySchema.parse(req.body);
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    if (body.userId && body.userId !== authUser.id) {
      return res.status(403).json({ error: { message: 'Forbidden' } });
    }

    const created = await service.create({ name: body.name, userId: authUser.id });
    res.status(201).json({ data: created });
  } catch (error) {
    next(error);
  }
};

export const updateCollection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = collectionIdParamSchema.parse(req.params);
    const body = updateCollectionBodySchema.parse(req.body);
    const existing = await service.getById(params.id);

    const auth = ensureAuthorized(req.authUser, existing.userId);
    if (!auth.allowed) {
      return res
        .status(auth.reason === 'unauthorized' ? 401 : 403)
        .json({ error: { message: auth.reason === 'unauthorized' ? 'Unauthorized' : 'Forbidden' } });
    }

    const updated = await service.update(params.id, body);
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
};

export const deleteCollection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = collectionIdParamSchema.parse(req.params);
    const existing = await service.getById(params.id);
    const auth = ensureAuthorized(req.authUser, existing.userId);

    if (!auth.allowed) {
      return res
        .status(auth.reason === 'unauthorized' ? 401 : 403)
        .json({ error: { message: auth.reason === 'unauthorized' ? 'Unauthorized' : 'Forbidden' } });
    }

    await service.delete(params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const addCollectionSample = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = collectionIdParamSchema.parse(req.params);
    const body = addCollectionSampleBodySchema.parse(req.body);
    const collection = await service.getById(params.id);

    const auth = ensureAuthorized(req.authUser, collection.userId);
    if (!auth.allowed) {
      return res
        .status(auth.reason === 'unauthorized' ? 401 : 403)
        .json({ error: { message: auth.reason === 'unauthorized' ? 'Unauthorized' : 'Forbidden' } });
    }

    const created = await service.addSample(params.id, body.sampleId);
    res.status(201).json({ data: created });
  } catch (error) {
    next(error);
  }
};

export const reorderCollectionSamples = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = collectionIdParamSchema.parse(req.params);
    const body = reorderCollectionSamplesBodySchema.parse(req.body);
    const collection = await service.getById(params.id);

    const auth = ensureAuthorized(req.authUser, collection.userId);
    if (!auth.allowed) {
      return res
        .status(auth.reason === 'unauthorized' ? 401 : 403)
        .json({ error: { message: auth.reason === 'unauthorized' ? 'Unauthorized' : 'Forbidden' } });
    }

    const updated = await service.reorderSamples(params.id, body);
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
};

export const removeCollectionSample = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = collectionIdParamSchema.parse(req.params);
    const sampleParams = collectionSampleParamSchema.parse(req.params);
    const collection = await service.getById(params.id);

    const auth = ensureAuthorized(req.authUser, collection.userId);
    if (!auth.allowed) {
      return res
        .status(auth.reason === 'unauthorized' ? 401 : 403)
        .json({ error: { message: auth.reason === 'unauthorized' ? 'Unauthorized' : 'Forbidden' } });
    }

    const updated = await service.removeSample(params.id, sampleParams.sampleId);
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
};
