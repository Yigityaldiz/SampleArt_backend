import type { Request, Response } from 'express';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpError, NotFoundError } from '../../errors';

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
  getForUser: vi.fn(),
  addSample: vi.fn(),
  addSampleForUser: vi.fn(),
  removeSample: vi.fn(),
  removeSampleForUser: vi.fn(),
}));

const userServiceMocks = vi.hoisted(() => ({
  getById: vi.fn(),
  create: vi.fn(),
}));

const accessMocks = vi.hoisted(() => ({
  ensureSampleAccess: vi.fn(),
}));

vi.mock('./service', () => ({
  SampleService: vi.fn().mockImplementation(() => serviceMocks),
}));

vi.mock('../collections/service', () => ({
  CollectionService: vi.fn().mockImplementation(() => collectionServiceMocks),
}));

vi.mock('../users/service', () => ({
  UserService: vi.fn().mockImplementation(() => userServiceMocks),
}));

vi.mock('./access', () => accessMocks);

import {
  listSamples,
  getSample,
  createSample,
  updateSample,
  deleteSample,
} from './controller';

const createResponse = () => {
  const res = {} as Response;
  const status = vi.fn<Response['status']>().mockReturnValue(res);
  const json = vi.fn<Response['json']>().mockReturnValue(res);

  Object.assign(res, {
    status,
    json,
  });

  return { res, status, json };
};

describe('Samples controller', () => {
  beforeEach(() => {
    Object.values(serviceMocks).forEach((mock) => mock.mockReset());
    Object.values(collectionServiceMocks).forEach((mock) => mock.mockReset());
    Object.values(userServiceMocks).forEach((mock) => mock.mockReset());
    accessMocks.ensureSampleAccess.mockReset();
    accessMocks.ensureSampleAccess.mockResolvedValue(undefined);
    userServiceMocks.getById.mockResolvedValue({ id: 'user_1' });
    userServiceMocks.create.mockResolvedValue({ id: 'user_1' });
  });

  it('forces non-admin queries to current user', async () => {
    serviceMocks.list.mockResolvedValue([]);
    const req = {
      query: { userId: 'custom', includeDeleted: 'true' },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const { res } = createResponse();

    await listSamples(req, res, vi.fn());

    expect(serviceMocks.list).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_1',
        includeDeleted: false,
      }),
    );
  });

  it('allows non-admin to query shared collection after membership check', async () => {
    serviceMocks.list.mockResolvedValue([]);
    collectionServiceMocks.getForUser.mockResolvedValue({ id: 'col_1' });
    const req = {
      query: { collectionId: 'col_1' },
      authUser: { id: 'user_2', roles: ['user'] },
    } as unknown as Request;
    const { res } = createResponse();

    await listSamples(req, res, vi.fn());

    expect(collectionServiceMocks.getForUser).toHaveBeenCalledWith('col_1', 'user_2');
    expect(serviceMocks.list).toHaveBeenCalled();
    const callArgs = serviceMocks.list.mock.calls[0][0];
    expect(callArgs.collectionId).toBe('col_1');
    expect(callArgs.includeDeleted).toBe(false);
    expect(callArgs.userId).toBeUndefined();
  });

  it('respects admin query parameters', async () => {
    serviceMocks.list.mockResolvedValue([]);
    const req = {
      query: { take: '5', includeDeleted: 'true' },
      authUser: { id: 'admin', roles: ['admin'] },
    } as unknown as Request;
    const { res } = createResponse();

    await listSamples(req, res, vi.fn());

    expect(serviceMocks.list).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5, includeDeleted: true }),
    );
  });

  it('returns 403 when accessing other users sample without collection access', async () => {
    serviceMocks.getById.mockResolvedValue({ id: 'sample', userId: 'owner' });
    accessMocks.ensureSampleAccess.mockRejectedValue(new HttpError(403, 'Forbidden'));
    const req = {
      params: { id: 'sample' },
      authUser: { id: 'intruder', roles: ['user'] },
    } as unknown as Request;
    const { res, status, json } = createResponse();

    await getSample(req, res, vi.fn());

    expect(accessMocks.ensureSampleAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'intruder',
        sampleOwnerId: 'owner',
        sampleId: 'sample',
        isAdmin: false,
      }),
    );
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: { message: 'Forbidden' } });
  });

  it('allows owner to fetch sample', async () => {
    serviceMocks.getById.mockResolvedValue({ id: 'sample', userId: 'owner' });
    const req = {
      params: { id: 'sample' },
      authUser: { id: 'owner', roles: ['user'] },
    } as unknown as Request;
    const { res, json } = createResponse();
    const next = vi.fn();

    await getSample(req, res, next);

    expect(accessMocks.ensureSampleAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'owner',
        sampleOwnerId: 'owner',
        sampleId: 'sample',
        isAdmin: false,
      }),
    );
    expect(json).toHaveBeenCalledWith({ data: { id: 'sample', userId: 'owner' } });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows collection member to fetch sample', async () => {
    serviceMocks.getById.mockResolvedValue({ id: 'sample', userId: 'owner' });
    const req = {
      params: { id: 'sample' },
      authUser: { id: 'member', roles: ['user'] },
    } as unknown as Request;
    const { res, json } = createResponse();

    await getSample(req, res, vi.fn());

    expect(accessMocks.ensureSampleAccess).toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith({ data: { id: 'sample', userId: 'owner' } });
  });

  it('returns 401 when creating without auth', async () => {
    const req = { body: { userId: 'user_1', title: 't', materialType: 'm' } } as unknown as Request;
    const { res, status } = createResponse();

    await createSample(req, res, vi.fn());

    expect(status).toHaveBeenCalledWith(401);
  });

  it('returns 403 when non-admin creates for other user', async () => {
    const req = {
      body: { userId: 'user_2', title: 't', materialType: 'm' },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const { res, status } = createResponse();

    await createSample(req, res, vi.fn());

    expect(status).toHaveBeenCalledWith(403);
  });

  it('creates sample for current user when authorized', async () => {
    serviceMocks.create.mockResolvedValue({ id: 'sample' });
    serviceMocks.getById.mockResolvedValue({ id: 'sample', collections: [] });
    const req = {
      body: { userId: 'user_1', title: 't', materialType: 'm' },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const { res, status } = createResponse();

    await createSample(req, res, vi.fn());

    expect(status).toHaveBeenCalledWith(201);
    expect(serviceMocks.create).toHaveBeenCalledWith({
      userId: 'user_1',
      title: 't',
      materialType: 'm',
    });
    expect(collectionServiceMocks.addSampleForUser).not.toHaveBeenCalled();
    expect(collectionServiceMocks.addSample).not.toHaveBeenCalled();
  });

  it('links new sample to provided collections', async () => {
    serviceMocks.create.mockResolvedValue({ id: 'sample', collections: [] });
    serviceMocks.getById.mockResolvedValue({ id: 'sample', collections: [{ collectionId: 'col_1' }] });
    collectionServiceMocks.addSampleForUser.mockResolvedValue({
      sampleId: 'sample',
      position: 1,
    });
    const req = {
      body: { userId: 'user_1', title: 't', materialType: 'm', collectionIds: ['col_1'] },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const { res, status } = createResponse();

    await createSample(req, res, vi.fn());

    expect(collectionServiceMocks.addSample).not.toHaveBeenCalled();
    expect(collectionServiceMocks.addSampleForUser).toHaveBeenCalledWith('col_1', 'user_1', 'sample');
    expect(serviceMocks.getById).toHaveBeenCalledWith('sample');
    expect(serviceMocks.hardDelete).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(201);
  });

  it('returns 404 when collection not found while creating sample', async () => {
    serviceMocks.create.mockResolvedValue({ id: 'sample', collections: [] });
    collectionServiceMocks.addSampleForUser.mockRejectedValue(
      new NotFoundError('Collection not found'),
    );
    const req = {
      body: { userId: 'user_1', title: 't', materialType: 'm', collectionIds: ['missing'] },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const { res } = createResponse();
    const next = vi.fn();

    await createSample(req, res, next);

    expect(serviceMocks.create).toHaveBeenCalled();
    expect(serviceMocks.hardDelete).toHaveBeenCalledWith('sample');
    expect(collectionServiceMocks.addSampleForUser).toHaveBeenCalledWith(
      'missing',
      'user_1',
      'sample',
    );
    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
  });

  it('forbids update when user not owner', async () => {
    serviceMocks.getById.mockResolvedValue({ id: 'sample', userId: 'owner' });
    const req = {
      params: { id: 'sample' },
      body: { title: 'new' },
      authUser: { id: 'other', roles: ['user'] },
    } as unknown as Request;
    const { res, status } = createResponse();

    await updateSample(req, res, vi.fn());

    expect(status).toHaveBeenCalledWith(403);
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
    const { res, json } = createResponse();

    await updateSample(req, res, vi.fn());

    expect(serviceMocks.update).toHaveBeenCalledWith('sample', { title: 'new' });
    expect(json).toHaveBeenCalledWith({ data: { id: 'sample', userId: 'owner' } });
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

    collectionServiceMocks.addSampleForUser.mockResolvedValue({
      sampleId: 'sample',
      position: 2,
    });

    const req = {
      params: { id: 'sample' },
      body: { collectionIds: ['col_1', 'col_2'] },
      authUser: { id: 'owner', roles: ['user'] },
    } as unknown as Request;
    const { res, json } = createResponse();

    await updateSample(req, res, vi.fn());

    expect(serviceMocks.update).not.toHaveBeenCalled();
    expect(collectionServiceMocks.addSampleForUser).toHaveBeenCalledWith(
      'col_2',
      'owner',
      'sample',
    );
    expect(collectionServiceMocks.removeSampleForUser).not.toHaveBeenCalled();
    expect(serviceMocks.getById).toHaveBeenCalledTimes(2);
    expect(json).toHaveBeenCalledWith({ data: finalSample });
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

    collectionServiceMocks.removeSampleForUser.mockResolvedValue({ id: 'col_2' });

    const req = {
      params: { id: 'sample' },
      body: { title: 'new', collectionIds: ['col_1'] },
      authUser: { id: 'owner', roles: ['user'] },
    } as unknown as Request;
    const { res, json } = createResponse();

    await updateSample(req, res, vi.fn());

    expect(serviceMocks.update).toHaveBeenCalledWith('sample', { title: 'new' });
    expect(collectionServiceMocks.addSampleForUser).not.toHaveBeenCalled();
    expect(collectionServiceMocks.removeSample).not.toHaveBeenCalled();
    expect(collectionServiceMocks.removeSampleForUser).toHaveBeenCalledWith('col_2', 'owner', 'sample');
    expect(json).toHaveBeenCalledWith({ data: finalSample });
  });

  it('returns 404 when collection is missing during update', async () => {
    serviceMocks.getById.mockResolvedValue({ id: 'sample', userId: 'owner', collections: [] });
    collectionServiceMocks.addSampleForUser.mockRejectedValue(
      new NotFoundError('Collection not found'),
    );
    const req = {
      params: { id: 'sample' },
      body: { collectionIds: ['missing'] },
      authUser: { id: 'owner', roles: ['user'] },
    } as unknown as Request;
    const { res } = createResponse();
    const next = vi.fn();

    await updateSample(req, res, next);

    expect(serviceMocks.update).not.toHaveBeenCalled();
    expect(collectionServiceMocks.addSampleForUser).toHaveBeenCalledWith('missing', 'owner', 'sample');
    expect(collectionServiceMocks.removeSampleForUser).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
  });

  it('deletes when user authorized', async () => {
    serviceMocks.findById.mockResolvedValue({ id: 'sample', userId: 'owner' });
    serviceMocks.softDelete.mockResolvedValue({ id: 'sample', userId: 'owner' });
    const req = {
      params: { id: 'sample' },
      authUser: { id: 'owner', roles: ['user'] },
    } as unknown as Request;
    const { res, json } = createResponse();

    await deleteSample(req, res, vi.fn());

    expect(serviceMocks.findById).toHaveBeenCalledWith('sample', { includeDeleted: true });
    expect(serviceMocks.softDelete).toHaveBeenCalledWith('sample');
    expect(json).toHaveBeenCalledWith({ data: { id: 'sample', userId: 'owner' } });
  });

  it('returns 404 when deleting missing sample', async () => {
    serviceMocks.findById.mockResolvedValue(null);
    const req = {
      params: { id: 'sample' },
      authUser: { id: 'owner', roles: ['user'] },
    } as unknown as Request;
    const { res, status, json } = createResponse();

    await deleteSample(req, res, vi.fn());

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ error: { message: 'Sample not found' } });
    expect(serviceMocks.softDelete).not.toHaveBeenCalled();
  });
});
