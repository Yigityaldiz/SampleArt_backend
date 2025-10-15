import type { Request, Response, NextFunction } from 'express';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const serviceMocks = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock('./service', () => ({
  UserService: vi.fn().mockImplementation(() => serviceMocks),
}));

import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  getCurrentUser,
  updateCurrentUserLanguage,
} from './controller';
import type { AuthUser } from '../auth';
import { NotFoundError } from '../../errors';

const createResponse = () => {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
};

const createAuthUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 'user_1',
  roles: ['user'],
  ...overrides,
});

describe('Users controller', () => {
  beforeEach(() => {
    Object.values(serviceMocks).forEach((mock) => mock.mockReset());
  });

  it('returns only authenticated user when not admin', async () => {
    const req = {
      query: { take: '5' },
      authUser: createAuthUser(),
    } as unknown as Request;
    const res = createResponse();
    const next = vi.fn();

    serviceMocks.getById.mockResolvedValue({ id: 'user_1' });

    await listUsers(req, res, next);

    expect(serviceMocks.list).not.toHaveBeenCalled();
    expect(serviceMocks.getById).toHaveBeenCalledWith('user_1');
    expect(res.json).toHaveBeenCalledWith({ data: [{ id: 'user_1' }] });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns paginated list for admin users', async () => {
    const req = {
      query: { take: '5' },
      authUser: createAuthUser({ roles: ['admin'] }),
    } as unknown as Request;
    const res = createResponse();
    const next = vi.fn();

    serviceMocks.list.mockResolvedValue([{ id: 'user_1' }]);

    await listUsers(req, res, next);

    expect(serviceMocks.list).toHaveBeenCalledWith({ take: 5, skip: 0 });
    expect(res.json).toHaveBeenCalledWith({ data: [{ id: 'user_1' }] });
    expect(next).not.toHaveBeenCalled();
  });

  it('gets user by id', async () => {
    const req = {
      params: { id: 'user_1' },
      authUser: createAuthUser(),
    } as unknown as Request;
    const res = createResponse();
    const next = vi.fn();
    serviceMocks.getById.mockResolvedValue({ id: 'user_1' });

    await getUser(req, res, next);

    expect(serviceMocks.getById).toHaveBeenCalledWith('user_1');
    expect(res.json).toHaveBeenCalledWith({ data: { id: 'user_1' } });
    expect(next).not.toHaveBeenCalled();
  });

  it('creates user and sets status 201', async () => {
    const req = {
      body: {
        id: 'user_1',
        email: 'foo@example.com',
        name: 'Foo',
        locale: 'en-US',
      },
      authUser: createAuthUser(),
    } as unknown as Request;
    const res = createResponse();
    const next = vi.fn();
    serviceMocks.create.mockResolvedValue({ id: 'user_1' });

    await createUser(req, res, next);

    expect(serviceMocks.create).toHaveBeenCalledWith({
      id: 'user_1',
      email: 'foo@example.com',
      name: 'Foo',
      locale: 'en-US',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ data: { id: 'user_1' } });
  });

  it('calls next when service throws', async () => {
    const req = {
      params: { id: 'user_1' },
      body: { email: 'foo@example.com' },
      authUser: createAuthUser(),
    } as unknown as Request;
    const res = createResponse();
    const next = vi.fn();
    const error = new Error('boom');
    serviceMocks.update.mockRejectedValue(error);

    await updateUser(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it('forbids accessing other users', async () => {
    const req = {
      params: { id: 'user_2' },
      authUser: createAuthUser(),
    } as unknown as Request;
    const res = createResponse();
    const next = vi.fn();

    await getUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'Forbidden' } });
    expect(serviceMocks.getById).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns current user when record exists', async () => {
    const req = {
      authUser: createAuthUser(),
    } as unknown as Request;
    const res = createResponse();
    const next = vi.fn();

    serviceMocks.getById.mockResolvedValue({ id: 'user_1' });

    await getCurrentUser(req, res, next);

    expect(serviceMocks.getById).toHaveBeenCalledWith('user_1');
    expect(serviceMocks.create).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ data: { id: 'user_1' } });
    expect(next).not.toHaveBeenCalled();
  });

  it('lazily creates current user when missing', async () => {
    const req = {
      authUser: createAuthUser({ id: 'user_missing', roles: ['user'], name: 'Missing' }),
    } as unknown as Request;
    const res = createResponse();
    const next = vi.fn();

    serviceMocks.getById.mockRejectedValue(new NotFoundError('User not found'));
    serviceMocks.create.mockResolvedValue({ id: 'user_missing' });

    await getCurrentUser(req, res, next);

    expect(serviceMocks.getById).toHaveBeenCalledWith('user_missing');
    expect(serviceMocks.create).toHaveBeenCalledWith({
      id: 'user_missing',
      email: undefined,
      name: 'Missing',
      locale: undefined,
    });
    expect(res.json).toHaveBeenCalledWith({ data: { id: 'user_missing' } });
    expect(next).not.toHaveBeenCalled();
  });

  it('updates current user language', async () => {
    const req = {
      authUser: createAuthUser(),
      body: { locale: 'en' },
    } as unknown as Request;
    const res = createResponse();
    const next = vi.fn();

    serviceMocks.update.mockResolvedValue({ id: 'user_1', locale: 'en' });

    await updateCurrentUserLanguage(req, res, next);

    expect(serviceMocks.update).toHaveBeenCalledWith('user_1', { locale: 'en' });
    expect(res.json).toHaveBeenCalledWith({ data: { id: 'user_1', locale: 'en' } });
    expect(next).not.toHaveBeenCalled();
  });

  it('creates missing user before updating language', async () => {
    const req = {
      authUser: createAuthUser({ email: 'user@example.com', name: 'User' }),
      body: { locale: 'tr' },
    } as unknown as Request;
    const res = createResponse();
    const next = vi.fn();

    serviceMocks.update
      .mockRejectedValueOnce({ code: 'P2025' })
      .mockResolvedValueOnce({ id: 'user_1', locale: 'tr' });
    serviceMocks.create.mockResolvedValue({ id: 'user_1' });

    await updateCurrentUserLanguage(req, res, next);

    expect(serviceMocks.create).toHaveBeenCalledWith({
      id: 'user_1',
      email: 'user@example.com',
      name: 'User',
      locale: 'tr',
    });
    expect(serviceMocks.update).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith({ data: { id: 'user_1', locale: 'tr' } });
    expect(next).not.toHaveBeenCalled();
  });

  it('propagates non-P2025 errors when updating language', async () => {
    const req = {
      authUser: createAuthUser(),
      body: { locale: 'en' },
    } as unknown as Request;
    const res = createResponse();
    const next = vi.fn();
    const error = new Error('boom');

    serviceMocks.update.mockRejectedValue(error);

    await updateCurrentUserLanguage(req, res, next);

    expect(serviceMocks.create).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(error);
  });

  it('returns 401 when updating language without auth', async () => {
    const req = {
      authUser: undefined,
      body: { locale: 'en' },
    } as unknown as Request;
    const res = createResponse();
    const next = vi.fn();

    await updateCurrentUserLanguage(req, res, next);

    expect(serviceMocks.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'Unauthorized' } });
    expect(next).not.toHaveBeenCalled();
  });
});
