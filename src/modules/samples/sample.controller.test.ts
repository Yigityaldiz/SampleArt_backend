import type { Request, Response } from 'express';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const serviceMocks = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
}));

vi.mock('./service', () => ({
  SampleService: vi.fn().mockImplementation(() => serviceMocks),
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

  it('deletes when user authorized', async () => {
    serviceMocks.getById.mockResolvedValue({ id: 'sample', userId: 'owner' });
    serviceMocks.softDelete.mockResolvedValue({ id: 'sample', userId: 'owner' });
    const req = {
      params: { id: 'sample' },
      authUser: { id: 'owner', roles: ['user'] },
    } as unknown as Request;
    const res = createResponse();

    await deleteSample(req, res, vi.fn());

    expect(serviceMocks.softDelete).toHaveBeenCalledWith('sample');
    expect(res.json).toHaveBeenCalledWith({ data: { id: 'sample', userId: 'owner' } });
  });
});
