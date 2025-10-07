import type { Request, Response } from 'express';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const serviceMocks = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  addSample: vi.fn(),
  removeSample: vi.fn(),
  reorderSamples: vi.fn(),
}));

vi.mock('./service', () => ({
  CollectionService: vi.fn().mockImplementation(() => serviceMocks),
}));

import {
  listCollections,
  getCollection,
  createCollection,
  updateCollection,
  deleteCollection,
  addCollectionSample,
  removeCollectionSample,
  reorderCollectionSamples,
} from './controller';

const createResponse = () => {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res as Response;
};

describe('Collections controller', () => {
  beforeEach(() => {
    Object.values(serviceMocks).forEach((mock) => mock.mockReset());
  });

  it('forces list query to current user when not admin', async () => {
    serviceMocks.list.mockResolvedValue([]);
    const req = {
      query: { take: '10' },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const res = createResponse();

    await listCollections(req, res, vi.fn());

    expect(serviceMocks.list).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user_1' }));
    expect(res.json).toHaveBeenCalledWith({ data: [] });
  });

  it('returns collection when requester is owner', async () => {
    const collection = { id: 'col_1', userId: 'user_1' };
    serviceMocks.getById.mockResolvedValue(collection);
    const req = {
      params: { id: 'col_1' },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const res = createResponse();

    await getCollection(req, res, vi.fn());

    expect(res.json).toHaveBeenCalledWith({ data: collection });
  });

  it('rejects creation for other user when not admin', async () => {
    const req = {
      body: { name: 'Favorites', userId: 'other' },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const res = createResponse();

    await createCollection(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(serviceMocks.create).not.toHaveBeenCalled();
  });

  it('creates collection for current user', async () => {
    const created = { id: 'col_1', userId: 'user_1' };
    serviceMocks.create.mockResolvedValue(created);
    const req = {
      body: { name: 'Favorites' },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const res = createResponse();

    await createCollection(req, res, vi.fn());

    expect(serviceMocks.create).toHaveBeenCalledWith({ name: 'Favorites', userId: 'user_1' });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('updates collection when authorized', async () => {
    serviceMocks.getById.mockResolvedValue({ id: 'col_1', userId: 'user_1' });
    serviceMocks.update.mockResolvedValue({ id: 'col_1', userId: 'user_1', name: 'Updated' });
    const req = {
      params: { id: 'col_1' },
      body: { name: 'Updated' },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const res = createResponse();

    await updateCollection(req, res, vi.fn());

    expect(serviceMocks.update).toHaveBeenCalledWith('col_1', { name: 'Updated' });
    expect(res.json).toHaveBeenCalledWith({ data: { id: 'col_1', userId: 'user_1', name: 'Updated' } });
  });

  it('deletes collection when authorized', async () => {
    serviceMocks.getById.mockResolvedValue({ id: 'col_1', userId: 'user_1' });
    const req = {
      params: { id: 'col_1' },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const res = createResponse();

    await deleteCollection(req, res, vi.fn());

    expect(serviceMocks.delete).toHaveBeenCalledWith('col_1');
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('adds sample to collection', async () => {
    serviceMocks.getById.mockResolvedValue({ id: 'col_1', userId: 'user_1' });
    serviceMocks.addSample.mockResolvedValue({ sampleId: 'sample_1', position: 1, addedAt: '2024-01-01T00:00:00.000Z' });
    const req = {
      params: { id: 'col_1' },
      body: { sampleId: 'sample_1' },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const res = createResponse();

    await addCollectionSample(req, res, vi.fn());

    expect(serviceMocks.addSample).toHaveBeenCalledWith('col_1', 'sample_1');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('reorders samples in collection', async () => {
    serviceMocks.getById.mockResolvedValue({ id: 'col_1', userId: 'user_1' });
    serviceMocks.reorderSamples.mockResolvedValue({ id: 'col_1' });
    const req = {
      params: { id: 'col_1' },
      body: { sampleIds: ['sample_2', 'sample_1'] },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const res = createResponse();

    await reorderCollectionSamples(req, res, vi.fn());

    expect(serviceMocks.reorderSamples).toHaveBeenCalledWith('col_1', { sampleIds: ['sample_2', 'sample_1'] });
    expect(res.json).toHaveBeenCalledWith({ data: { id: 'col_1' } });
  });

  it('removes sample from collection', async () => {
    serviceMocks.getById.mockResolvedValue({ id: 'col_1', userId: 'user_1' });
    serviceMocks.removeSample.mockResolvedValue({ id: 'col_1' });
    const req = {
      params: { id: 'col_1', sampleId: 'sample_1' },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const res = createResponse();

    await removeCollectionSample(req, res, vi.fn());

    expect(serviceMocks.removeSample).toHaveBeenCalledWith('col_1', 'sample_1');
    expect(res.json).toHaveBeenCalledWith({ data: { id: 'col_1' } });
  });
});
