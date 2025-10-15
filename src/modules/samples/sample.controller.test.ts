import type { Request, Response } from 'express';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundError } from '../../errors';

const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
}));

vi.mock('../../lib/logger', () => ({
  logger: loggerMock,
}));

const serviceMocks = vi.hoisted(() => ({
  list: vi.fn(),
  findById: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  hardDelete: vi.fn(),
}));

const collectionServiceMocks = vi.hoisted(() => ({
  getById: vi.fn(),
  addSample: vi.fn(),
  removeSample: vi.fn(),
}));

vi.mock('./service', () => ({
  SampleService: vi.fn().mockImplementation(() => serviceMocks),
}));

vi.mock('../collections/service', () => ({
  CollectionService: vi.fn().mockImplementation(() => collectionServiceMocks),
}));

import {
  listSamples,
  getSample,
  createSample,
  updateSample,
  deleteSample,
} from './controller';

const createResponse = () => {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
};

describe('Samples controller', () => {
  beforeEach(() => {
    Object.values(serviceMocks).forEach((mock) => mock.mockReset());
    Object.values(collectionServiceMocks).forEach((mock) => mock.mockReset());
  });

  it('forces non-admin queries to current user', async () => {
    serviceMocks.list.mockResolvedValue([]);
    const req = {
      query: { userId: 'custom', includeDeleted: 'true' },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const res = createResponse();

    await listSamples(req, res, vi.fn());

    expect(serviceMocks.list).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_1',
        includeDeleted: false,
      }),
    );
  });

  it('respects admin query parameters', async () => {
    serviceMocks.list.mockResolvedValue([]);
    const req = {
      query: { take: '5', includeDeleted: 'true' },
      authUser: { id: 'admin', roles: ['admin'] },
    } as unknown as Request;
    const res = createResponse();

    await listSamples(req, res, vi.fn());

    expect(serviceMocks.list).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5, includeDeleted: true }),
    );
  });

  it('returns 403 when accessing other users sample', async () => {
    serviceMocks.getById.mockResolvedValue({ id: 'sample', userId: 'owner' });
    const req = {
      params: { id: 'sample' },
      authUser: { id: 'intruder', roles: ['user'] },
    } as unknown as Request;
    const res = createResponse();

    await getSample(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'Forbidden' } });
  });

  it('allows owner to fetch sample', async () => {
    serviceMocks.getById.mockResolvedValue({ id: 'sample', userId: 'owner' });
    const req = {
      params: { id: 'sample' },
      authUser: { id: 'owner', roles: ['user'] },
    } as unknown as Request;
    const res = createResponse();
    const next = vi.fn();

    await getSample(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ data: { id: 'sample', userId: 'owner' } });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when creating without auth', async () => {
    const req = { body: { userId: 'user_1', title: 't', materialType: 'm' } } as unknown as Request;
    const res = createResponse();

    await createSample(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 403 when non-admin creates for other user', async () => {
    const req = {
      body: { userId: 'user_2', title: 't', materialType: 'm' },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const res = createResponse();

    await createSample(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('creates sample for current user when authorized', async () => {
    serviceMocks.create.mockResolvedValue({ id: 'sample' });
    serviceMocks.getById.mockResolvedValue({ id: 'sample', collections: [] });
    const req = {
      body: { userId: 'user_1', title: 't', materialType: 'm' },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const res = createResponse();

    await createSample(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(serviceMocks.create).toHaveBeenCalledWith({
      userId: 'user_1',
      title: 't',
      materialType: 'm',
    });
    expect(collectionServiceMocks.getById).not.toHaveBeenCalled();
    expect(collectionServiceMocks.addSample).not.toHaveBeenCalled();
  });

  it('links new sample to provided collections', async () => {
    serviceMocks.create.mockResolvedValue({ id: 'sample', collections: [] });
    serviceMocks.getById.mockResolvedValue({ id: 'sample', collections: [{ collectionId: 'col_1' }] });
    collectionServiceMocks.getById.mockResolvedValue({ id: 'col_1', userId: 'user_1' });
    collectionServiceMocks.addSample.mockResolvedValue({ sampleId: 'sample', position: 1 });
    const req = {
      body: { userId: 'user_1', title: 't', materialType: 'm', collectionIds: ['col_1'] },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const res = createResponse();

    await createSample(req, res, vi.fn());

    expect(collectionServiceMocks.getById).toHaveBeenCalledWith('col_1');
    expect(collectionServiceMocks.addSample).toHaveBeenCalledWith('col_1', 'sample');
    expect(serviceMocks.getById).toHaveBeenCalledWith('sample');
    expect(serviceMocks.hardDelete).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns 404 when collection not found while creating sample', async () => {
    collectionServiceMocks.getById.mockRejectedValue(new NotFoundError('Collection not found'));
    const req = {
      body: { userId: 'user_1', title: 't', materialType: 'm', collectionIds: ['missing'] },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const res = createResponse();

    await createSample(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(serviceMocks.create).not.toHaveBeenCalled();
    expect(collectionServiceMocks.addSample).not.toHaveBeenCalled();
  });

  it('forbids update when user not owner', async () => {
    serviceMocks.getById.mockResolvedValue({ id: 'sample', userId: 'owner' });
    const req = {
      params: { id: 'sample' },
      body: { title: 'new' },
      authUser: { id: 'other', roles: ['user'] },
    } as unknown as Request;
    const res = createResponse();

    await updateSample(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(serviceMocks.update).not.toHaveBeenCalled();
  });

  it('updates when user authorized', async () => {
    serviceMocks.getById.mockResolvedValue({ id: 'sample', userId: 'owner' });
    serviceMocks.update.mockResolvedValue({ id: 'sample', userId: 'owner' });
    const req = {
      params: { id: 'sample' },
      body: { title: 'new' },
      authUser: { id: 'owner', roles: ['user'] },
    } as unknown as Request;
    const res = createResponse();

    await updateSample(req, res, vi.fn());

    expect(serviceMocks.update).toHaveBeenCalledWith('sample', { title: 'new' });
    expect(res.json).toHaveBeenCalledWith({ data: { id: 'sample', userId: 'owner' } });
  });

  it('updates collections when collectionIds provided', async () => {
    const existingSample = {
      id: 'sample',
      userId: 'owner',
      collections: [{ collectionId: 'col_1', position: 1 }],
    };
    const finalSample = {
      id: 'sample',
      userId: 'owner',
      collections: [
        { collectionId: 'col_1', position: 1 },
        { collectionId: 'col_2', position: 2 },
      ],
    };

    serviceMocks.getById
      .mockResolvedValueOnce(existingSample)
      .mockResolvedValueOnce(finalSample);

    collectionServiceMocks.getById.mockImplementation(async (id: string) => ({
      id,
      userId: 'owner',
    }));
    collectionServiceMocks.addSample.mockResolvedValue({ sampleId: 'sample', position: 2 });

    const req = {
      params: { id: 'sample' },
      body: { collectionIds: ['col_1', 'col_2'] },
      authUser: { id: 'owner', roles: ['user'] },
    } as unknown as Request;
    const res = createResponse();

    await updateSample(req, res, vi.fn());

    expect(serviceMocks.update).not.toHaveBeenCalled();
    expect(collectionServiceMocks.addSample).toHaveBeenCalledWith('col_2', 'sample');
    expect(collectionServiceMocks.removeSample).not.toHaveBeenCalled();
    expect(serviceMocks.getById).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith({ data: finalSample });
  });

  it('removes collections not present in payload', async () => {
    const existingSample = {
      id: 'sample',
      userId: 'owner',
      collections: [
        { collectionId: 'col_1', position: 1 },
        { collectionId: 'col_2', position: 2 },
      ],
    };
    const updatedSample = { ...existingSample, title: 'new' };
    const finalSample = {
      id: 'sample',
      userId: 'owner',
      title: 'new',
      collections: [{ collectionId: 'col_1', position: 1 }],
    };

    serviceMocks.getById
      .mockResolvedValueOnce(existingSample)
      .mockResolvedValueOnce(finalSample);
    serviceMocks.update.mockResolvedValue(updatedSample);

    collectionServiceMocks.getById.mockImplementation(async (id: string) => ({
      id,
      userId: 'owner',
    }));
    collectionServiceMocks.removeSample.mockResolvedValue({ id: 'col_2' });

    const req = {
      params: { id: 'sample' },
      body: { title: 'new', collectionIds: ['col_1'] },
      authUser: { id: 'owner', roles: ['user'] },
    } as unknown as Request;
    const res = createResponse();

    await updateSample(req, res, vi.fn());

    expect(serviceMocks.update).toHaveBeenCalledWith('sample', { title: 'new' });
    expect(collectionServiceMocks.getById).toHaveBeenCalledWith('col_1');
    expect(collectionServiceMocks.removeSample).toHaveBeenCalledWith('col_2', 'sample');
    expect(collectionServiceMocks.addSample).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ data: finalSample });
  });

  it('returns 404 when collection is missing during update', async () => {
    serviceMocks.getById.mockResolvedValue({ id: 'sample', userId: 'owner', collections: [] });
    collectionServiceMocks.getById.mockRejectedValue(new NotFoundError('Collection not found'));
    const req = {
      params: { id: 'sample' },
      body: { collectionIds: ['missing'] },
      authUser: { id: 'owner', roles: ['user'] },
    } as unknown as Request;
    const res = createResponse();

    await updateSample(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(serviceMocks.update).not.toHaveBeenCalled();
    expect(collectionServiceMocks.addSample).not.toHaveBeenCalled();
    expect(collectionServiceMocks.removeSample).not.toHaveBeenCalled();
  });

  it('deletes when user authorized', async () => {
    serviceMocks.findById.mockResolvedValue({ id: 'sample', userId: 'owner' });
    serviceMocks.softDelete.mockResolvedValue({ id: 'sample', userId: 'owner' });
    const req = {
      params: { id: 'sample' },
      authUser: { id: 'owner', roles: ['user'] },
    } as unknown as Request;
    const res = createResponse();

    await deleteSample(req, res, vi.fn());

    expect(serviceMocks.findById).toHaveBeenCalledWith('sample', { includeDeleted: true });
    expect(serviceMocks.softDelete).toHaveBeenCalledWith('sample');
    expect(res.json).toHaveBeenCalledWith({ data: { id: 'sample', userId: 'owner' } });
  });

  it('returns 404 when deleting missing sample', async () => {
    serviceMocks.findById.mockResolvedValue(null);
    const req = {
      params: { id: 'sample' },
      authUser: { id: 'owner', roles: ['user'] },
    } as unknown as Request;
    const res = createResponse();

    await deleteSample(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'Sample not found' } });
    expect(serviceMocks.softDelete).not.toHaveBeenCalled();
  });
});
