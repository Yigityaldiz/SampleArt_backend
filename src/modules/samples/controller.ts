import type { NextFunction, Request, Response } from 'express';
import { NotFoundError } from '../../errors';
import { UserService } from '../users/service';
import type { AuthUser } from '../auth';
import { SampleService } from './service';
import { CollectionService } from '../collections/service';
import {
  createSampleBodySchema,
  updateSampleBodySchema,
  listSamplesQuerySchema,
  sampleIdParamSchema,
} from './schemas';
import { isSupportedLanguageCode } from '../users/languages';

const service = new SampleService();
const userService = new UserService();
const collectionService = new CollectionService();

const toNullable = <T>(value: T | null | undefined) => (value === undefined ? undefined : value);
const normalizeLocale = (value: string | null | undefined) =>
  typeof value === 'string' && isSupportedLanguageCode(value) ? value : undefined;

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
      locale: toNullable(normalizeLocale(authUser.locale)),
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

    const collectionIds = Array.from(new Set(body.collectionIds ?? []));
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

    for (const collectionId of collectionIds) {
      try {
        const collection = await collectionService.getById(collectionId);
        if (collection.userId !== targetUserId) {
          return res.status(403).json({ error: { message: 'Forbidden' } });
        }
      } catch (error) {
        if (error instanceof NotFoundError) {
          return res.status(404).json({ error: { message: 'Collection not found' } });
        }

        throw error;
      }
    }

    const sample = await service.create({ ...body, userId: targetUserId });

    if (collectionIds.length === 0) {
      res.status(201).json({ data: sample });
      return;
    }

    try {
      for (const collectionId of collectionIds) {
        await collectionService.addSample(collectionId, sample.id);
      }
    } catch (error) {
      await service.hardDelete(sample.id);
      throw error;
    }

    const updatedSample = await service.getById(sample.id);
    res.status(201).json({ data: updatedSample });
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

    const { collectionIds, ...updatePayload } = body;
    const normalizedCollectionIds =
      collectionIds !== undefined ? Array.from(new Set(collectionIds)) : undefined;

    if (normalizedCollectionIds !== undefined) {
      try {
        for (const collectionId of normalizedCollectionIds) {
          const collection = await collectionService.getById(collectionId);
          if (collection.userId !== existing.userId) {
            return res.status(403).json({ error: { message: 'Forbidden' } });
          }
        }
      } catch (error) {
        if (error instanceof NotFoundError) {
          return res.status(404).json({ error: { message: 'Collection not found' } });
        }

        throw error;
      }
    }

    const hasMetadataUpdates = Object.keys(updatePayload).length > 0;

    let sample = existing;

    if (hasMetadataUpdates) {
      sample = await service.update(params.id, updatePayload);
    }

    if (normalizedCollectionIds === undefined) {
      res.json({ data: sample });
      return;
    }

    const currentCollectionIds = new Set(sample.collections.map((item) => item.collectionId));
    const targetCollectionIds = new Set(normalizedCollectionIds);

    const collectionsToAdd = normalizedCollectionIds.filter(
      (collectionId) => !currentCollectionIds.has(collectionId),
    );
    const collectionsToRemove = [...currentCollectionIds].filter(
      (collectionId) => !targetCollectionIds.has(collectionId),
    );

    for (const collectionId of collectionsToAdd) {
      await collectionService.addSample(collectionId, sample.id);
    }

    for (const collectionId of collectionsToRemove) {
      await collectionService.removeSample(collectionId, sample.id);
    }

    if (collectionsToAdd.length === 0 && collectionsToRemove.length === 0) {
      res.json({ data: sample });
      return;
    }

    const finalSample = await service.getById(params.id);
    res.json({ data: finalSample });
  } catch (error) {
    next(error);
  }
};
export const deleteSample = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = sampleIdParamSchema.parse(req.params);
    const existing = await service.findById(params.id, { includeDeleted: true });
    const authUser = req.authUser;

    if (!existing) {
      return res.status(404).json({ error: { message: 'Sample not found' } });
    }

    if (authUser && !authUser.roles.includes('admin') && authUser.id !== existing.userId) {
      return res.status(403).json({ error: { message: 'Forbidden' } });
    }

    const sample = await service.softDelete(params.id);
    res.json({ data: sample });
  } catch (error) {
    next(error);
  }
};
