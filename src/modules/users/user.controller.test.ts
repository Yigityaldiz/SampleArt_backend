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

import { listUsers, getUser, createUser, updateUser } from './controller';

const createResponse = () => {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
};

describe('Users controller', () => {
  beforeEach(() => {
    Object.values(serviceMocks).forEach((mock) => mock.mockReset());
  });

  it('returns paginated list', async () => {
    const req = { query: { take: '5' } } as unknown as Request;
    const res = createResponse();
    const next = vi.fn();

    serviceMocks.list.mockResolvedValue([{ id: 'user_1' }]);

    await listUsers(req, res, next);

    expect(serviceMocks.list).toHaveBeenCalledWith({ take: 5, skip: 0 });
    expect(res.json).toHaveBeenCalledWith({ data: [{ id: 'user_1' }] });
    expect(next).not.toHaveBeenCalled();
  });

  it('gets user by id', async () => {
    const req = { params: { id: 'user_1' } } as unknown as Request;
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
    const req = { params: { id: 'user_1' }, body: { email: 'foo@example.com' } } as unknown as Request;
    const res = createResponse();
    const next = vi.fn();
    const error = new Error('boom');
    serviceMocks.update.mockRejectedValue(error);

    await updateUser(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
