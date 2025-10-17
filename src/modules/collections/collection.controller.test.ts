import type { Request, Response } from 'express';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const serviceMocks = vi.hoisted(() => ({
  list: vi.fn(),
  getForUser: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  updateForUser: vi.fn(),
  deleteForUser: vi.fn(),
  addSampleForUser: vi.fn(),
  removeSampleForUser: vi.fn(),
  reorderSamplesForUser: vi.fn(),
  listMembers: vi.fn(),
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
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
  listCollectionMembers,
  updateCollectionMemberRole,
  removeCollectionMember,
} from './controller';

const createResponse = () => {
 const res = {} as Response;
  const status = vi.fn<Response['status']>().mockReturnValue(res);
  const json = vi.fn<Response['json']>().mockReturnValue(res);
  const send = vi.fn<Response['send']>().mockReturnValue(res);

  Object.assign(res, {
    status,
    json,
    send,
  });

  return { res, status, json, send };
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
    const { res, json } = createResponse();

    await listCollections(req, res, vi.fn());

    expect(serviceMocks.list).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user_1' }));
    expect(json).toHaveBeenCalledWith({ data: [] });
  });

  it('returns collection for authorized member', async () => {
    const collection = { id: 'col_1', userId: 'user_1' };
    serviceMocks.getForUser.mockResolvedValue(collection);

    const req = {
      params: { id: 'col_1' },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const { res, json } = createResponse();

    await getCollection(req, res, vi.fn());

    expect(serviceMocks.getForUser).toHaveBeenCalledWith('col_1', 'user_1');
    expect(json).toHaveBeenCalledWith({ data: collection });
  });

  it('rejects creation for other user when not admin', async () => {
    const req = {
      body: { name: 'Favorites', userId: 'other' },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const { res, status } = createResponse();

    await createCollection(req, res, vi.fn());

    expect(status).toHaveBeenCalledWith(403);
    expect(serviceMocks.create).not.toHaveBeenCalled();
  });

  it('creates collection for current user', async () => {
    const created = { id: 'col_1', userId: 'user_1' };
    serviceMocks.create.mockResolvedValue(created);
    const req = {
      body: { name: 'Favorites' },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const { res, status, json } = createResponse();

    await createCollection(req, res, vi.fn());

    expect(serviceMocks.create).toHaveBeenCalledWith({ name: 'Favorites', userId: 'user_1' });
    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith({ data: created });
  });

  it('updates collection using RBAC guard', async () => {
    serviceMocks.updateForUser.mockResolvedValue({ id: 'col_1', name: 'Updated' });
    const req = {
      params: { id: 'col_1' },
      body: { name: 'Updated' },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const { res, json } = createResponse();

    await updateCollection(req, res, vi.fn());

    expect(serviceMocks.updateForUser).toHaveBeenCalledWith('col_1', 'user_1', { name: 'Updated' });
    expect(json).toHaveBeenCalledWith({ data: { id: 'col_1', name: 'Updated' } });
  });

  it('deletes collection using RBAC guard', async () => {
    const req = {
      params: { id: 'col_1' },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const { res, status } = createResponse();

    await deleteCollection(req, res, vi.fn());

    expect(serviceMocks.deleteForUser).toHaveBeenCalledWith('col_1', 'user_1');
    expect(status).toHaveBeenCalledWith(204);
  });

  it('adds sample through RBAC aware service', async () => {
    serviceMocks.addSampleForUser.mockResolvedValue({
      sampleId: 'sample_1',
      position: 1,
      addedAt: '2024-01-01T00:00:00.000Z',
    });

    const req = {
      params: { id: 'col_1' },
      body: { sampleId: 'sample_1' },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const { res, status } = createResponse();

    await addCollectionSample(req, res, vi.fn());

    expect(serviceMocks.addSampleForUser).toHaveBeenCalledWith('col_1', 'user_1', 'sample_1');
    expect(status).toHaveBeenCalledWith(201);
  });

  it('reorders samples through RBAC aware service', async () => {
    serviceMocks.reorderSamplesForUser.mockResolvedValue({ id: 'col_1' });
    const req = {
      params: { id: 'col_1' },
      body: { sampleIds: ['sample_2', 'sample_1'] },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const { res, json } = createResponse();

    await reorderCollectionSamples(req, res, vi.fn());

    expect(serviceMocks.reorderSamplesForUser).toHaveBeenCalledWith('col_1', 'user_1', {
      sampleIds: ['sample_2', 'sample_1'],
    });
    expect(json).toHaveBeenCalledWith({ data: { id: 'col_1' } });
  });

  it('removes sample through RBAC aware service', async () => {
    serviceMocks.removeSampleForUser.mockResolvedValue({ id: 'col_1' });
    const req = {
      params: { id: 'col_1', sampleId: 'sample_1' },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const { res, json } = createResponse();

    await removeCollectionSample(req, res, vi.fn());

    expect(serviceMocks.removeSampleForUser).toHaveBeenCalledWith('col_1', 'user_1', 'sample_1');
    expect(json).toHaveBeenCalledWith({ data: { id: 'col_1' } });
  });

  it('lists members for collection', async () => {
    serviceMocks.listMembers.mockResolvedValue([{ id: 'mem_1' }]);
    const req = {
      params: { id: 'col_1' },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const { res, json } = createResponse();

    await listCollectionMembers(req, res, vi.fn());

    expect(serviceMocks.listMembers).toHaveBeenCalledWith('col_1', 'user_1');
    expect(json).toHaveBeenCalledWith({ data: [{ id: 'mem_1' }], count: 1 });
  });

  it('updates member role', async () => {
    serviceMocks.updateMemberRole.mockResolvedValue({ id: 'mem_2', role: 'VIEW_ONLY' });
    const req = {
      params: { id: 'col_1', memberId: 'mem_2' },
      body: { role: 'VIEW_ONLY' },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const { res, json } = createResponse();

    await updateCollectionMemberRole(req, res, vi.fn());

    expect(serviceMocks.updateMemberRole).toHaveBeenCalledWith(
      'col_1',
      'user_1',
      'mem_2',
      'VIEW_ONLY',
    );
    expect(json).toHaveBeenCalledWith({ data: { id: 'mem_2', role: 'VIEW_ONLY' } });
  });

  it('removes member', async () => {
    const req = {
      params: { id: 'col_1', memberId: 'mem_2' },
      authUser: { id: 'user_1', roles: ['user'] },
    } as unknown as Request;
    const { res, status } = createResponse();

    await removeCollectionMember(req, res, vi.fn());

    expect(serviceMocks.removeMember).toHaveBeenCalledWith('col_1', 'user_1', 'mem_2');
    expect(status).toHaveBeenCalledWith(204);
  });
});
