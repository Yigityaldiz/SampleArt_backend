import type { NextFunction, Request, Response } from 'express';
import { CollectionService } from './service';
import {
  listCollectionsQuerySchema,
  collectionIdParamSchema,
  createCollectionBodySchema,
  updateCollectionBodySchema,
  addCollectionSampleBodySchema,
  reorderCollectionSamplesBodySchema,
  collectionSampleParamSchema,
  updateCollectionMemberBodySchema,
  collectionMemberIdParamSchema,
} from './schemas';

const service = new CollectionService();

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
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    const collection = await service.getForUser(params.id, authUser.id);
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
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    const updated = await service.updateForUser(params.id, authUser.id, body);
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
};

export const deleteCollection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = collectionIdParamSchema.parse(req.params);
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    await service.deleteForUser(params.id, authUser.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const addCollectionSample = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = collectionIdParamSchema.parse(req.params);
    const body = addCollectionSampleBodySchema.parse(req.body);
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    const created = await service.addSampleForUser(params.id, authUser.id, body.sampleId);
    res.status(201).json({ data: created });
  } catch (error) {
    next(error);
  }
};

export const reorderCollectionSamples = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = collectionIdParamSchema.parse(req.params);
    const body = reorderCollectionSamplesBodySchema.parse(req.body);
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    const updated = await service.reorderSamplesForUser(params.id, authUser.id, body);
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
};

export const removeCollectionSample = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = collectionIdParamSchema.parse(req.params);
    const sampleParams = collectionSampleParamSchema.parse(req.params);
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    const updated = await service.removeSampleForUser(params.id, authUser.id, sampleParams.sampleId);
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
};

export const listCollectionMembers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = collectionIdParamSchema.parse(req.params);
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    const members = await service.listMembers(params.id, authUser.id);
    res.json({ data: members, count: members.length });
  } catch (error) {
    next(error);
  }
};

export const updateCollectionMemberRole = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const params = collectionIdParamSchema.parse(req.params);
    const memberParams = collectionMemberIdParamSchema.parse(req.params);
    const body = updateCollectionMemberBodySchema.parse(req.body);
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    const member = await service.updateMemberRole(
      params.id,
      authUser.id,
      memberParams.memberId,
      body.role,
    );
    res.json({ data: member });
  } catch (error) {
    next(error);
  }
};

export const removeCollectionMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = collectionIdParamSchema.parse(req.params);
    const memberParams = collectionMemberIdParamSchema.parse(req.params);
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    await service.removeMember(params.id, authUser.id, memberParams.memberId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
