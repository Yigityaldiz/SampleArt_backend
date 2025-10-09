import { Prisma } from '@prisma/client';
import { HttpError, NotFoundError } from '../../errors';
import {
  CollectionRepository,
  type CollectionWithRelations,
  type CollectionCreateData,
  type CollectionUpdateData,
  type CollectionSampleWithRelations,
} from './repository';
import type {
  CreateCollectionBody,
  UpdateCollectionBody,
  ListCollectionsQuery,
  ReorderCollectionSamplesBody,
} from './schemas';

const isPrismaKnownRequestError = (
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError;

export interface CollectionSampleSummary {
  sampleId: string;
  position: number;
  addedAt: string;
  sample?: {
    id: string;
    userId: string;
    title: string;
    materialType: string;
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

export interface CollectionResponse {
  id: string;
  userId: string;
  name: string;
  samples: CollectionSampleSummary[];
  createdAt: string;
  updatedAt: string;
}

const mapSample = (item: CollectionSampleWithRelations): CollectionSampleSummary => ({
  sampleId: item.sampleId,
  position: item.position,
  addedAt: item.addedAt.toISOString(),
  sample: item.sample
    ? {
        id: item.sample.id,
        userId: item.sample.userId,
        title: item.sample.title,
        materialType: item.sample.materialType,
        isDeleted: item.sample.isDeleted,
        createdAt: item.sample.createdAt.toISOString(),
        updatedAt: item.sample.updatedAt.toISOString(),
      }
    : undefined,
});

const toResponse = (collection: CollectionWithRelations): CollectionResponse => ({
  id: collection.id,
  userId: collection.userId,
  name: collection.name,
  samples: collection.samples.map(mapSample),
  createdAt: collection.createdAt.toISOString(),
  updatedAt: collection.updatedAt.toISOString(),
});

export class CollectionService {
  constructor(private readonly repo = new CollectionRepository()) {}

  async list(params: ListCollectionsQuery = {}): Promise<CollectionResponse[]> {
    const { includeSamples: _includeSamples, ...rest } = params;
    const collections = await this.repo.list(rest);
    return collections.map(toResponse);
  }

  async getById(id: string): Promise<CollectionResponse> {
    const collection = await this.repo.findById(id);
    if (!collection) {
      throw new NotFoundError('Collection not found');
    }

    return toResponse(collection);
  }

  async create(data: CreateCollectionBody & { userId: string }): Promise<CollectionResponse> {
    const payload: CollectionCreateData = {
      userId: data.userId,
      name: data.name,
    };

    const created = await this.repo.create(payload);
    return toResponse(created);
  }

  async update(id: string, data: UpdateCollectionBody): Promise<CollectionResponse> {
    try {
      const payload: CollectionUpdateData = {
        ...data,
      };
      const updated = await this.repo.update(id, payload);
      return toResponse(updated);
    } catch (error: unknown) {
      if (isPrismaKnownRequestError(error) && error.code === 'P2025') {
        throw new NotFoundError('Collection not found');
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.repo.delete(id);
    } catch (error: unknown) {
      if (isPrismaKnownRequestError(error) && error.code === 'P2025') {
        throw new NotFoundError('Collection not found');
      }
      throw error;
    }
  }

  async addSample(collectionId: string, sampleId: string): Promise<CollectionSampleSummary> {
    const collection = await this.repo.findById(collectionId);
    if (!collection) {
      throw new NotFoundError('Collection not found');
    }

    const existing = await this.repo.getCollectionSample(collectionId, sampleId);
    if (existing) {
      throw new HttpError(409, 'Sample already exists in collection');
    }

    const position = await this.repo.getNextSamplePosition(collectionId);
    const created = await this.repo.createCollectionSample(collectionId, sampleId, position);
    return mapSample(created);
  }

  async removeSample(collectionId: string, sampleId: string): Promise<CollectionResponse> {
    const collection = await this.repo.findById(collectionId);
    if (!collection) {
      throw new NotFoundError('Collection not found');
    }

    const existing = collection.samples.find((item) => item.sampleId === sampleId);
    if (!existing) {
      throw new NotFoundError('Sample is not attached to the collection');
    }

    await this.repo.removeCollectionSample(collectionId, sampleId);
    await this.normalizePositions(collectionId);

    return this.getById(collectionId);
  }

  async reorderSamples(
    collectionId: string,
    body: ReorderCollectionSamplesBody,
  ): Promise<CollectionResponse> {
    const collection = await this.repo.findById(collectionId);
    if (!collection) {
      throw new NotFoundError('Collection not found');
    }

    const existingIds = new Set(collection.samples.map((item) => item.sampleId));

    const uniqueProvided = new Set(body.sampleIds);
    if (uniqueProvided.size !== body.sampleIds.length) {
      throw new HttpError(400, 'sampleIds must be unique');
    }

    for (const sampleId of body.sampleIds) {
      if (!existingIds.has(sampleId)) {
        throw new HttpError(400, `Sample ${sampleId} is not part of the collection`);
      }
    }

    const remaining = collection.samples
      .map((item) => item.sampleId)
      .filter((sampleId) => !uniqueProvided.has(sampleId));

    const ordered = [...body.sampleIds, ...remaining];

    const updates = ordered.map((sampleId, index) => ({ sampleId, position: index + 1 }));
    await this.repo.updateSamplePositions(collectionId, updates);

    return this.getById(collectionId);
  }

  private async normalizePositions(collectionId: string) {
    const collection = await this.repo.findById(collectionId);
    if (!collection) {
      return;
    }

    const sorted = [...collection.samples].sort((a, b) => a.position - b.position);
    const updates = sorted.map((item, index) => ({ sampleId: item.sampleId, position: index + 1 }));
    await this.repo.updateSamplePositions(collectionId, updates);
  }
}
