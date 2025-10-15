import { describe, it, expect, beforeEach, vi } from 'vitest';

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

import { UserService } from './service';
import { NotFoundError } from '../../errors';

const createDate = () => new Date('2024-01-01T00:00:00.000Z');

describe('UserService', () => {
  const repo = {
    list: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const cleanupTasks = {
    enqueueUserCleanup: vi.fn(),
  };

  const baseUser = {
    id: 'user_1',
    email: 'test@example.com',
    name: 'Test User',
    locale: 'en-US',
    createdAt: createDate(),
    updatedAt: createDate(),
  } as const;

  const service = new UserService(repo as any, cleanupTasks as any);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('lists users with pagination defaults', async () => {
    repo.list.mockResolvedValue([baseUser]);

    const result = await service.list();

    expect(repo.list).toHaveBeenCalledWith({});
    expect(result).toEqual([
      {
        id: baseUser.id,
        email: baseUser.email,
        name: baseUser.name,
        locale: baseUser.locale,
        createdAt: baseUser.createdAt.toISOString(),
        updatedAt: baseUser.updatedAt.toISOString(),
      },
    ]);
  });

  it('gets user by id', async () => {
    repo.findById.mockResolvedValue(baseUser);

    const result = await service.getById('user_1');

    expect(repo.findById).toHaveBeenCalledWith('user_1');
    expect(result.id).toBe('user_1');
  });

  it('normalizes unsupported locale to null', async () => {
    repo.findById.mockResolvedValue({
      ...baseUser,
      locale: 'xx-YY',
    });

    const result = await service.getById('user_1');

    expect(result.locale).toBeNull();
  });

  it('throws NotFoundError when user missing', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(service.getById('missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('creates user and maps response', async () => {
    repo.create.mockResolvedValue(baseUser);

    const result = await service.create({ id: 'user_1' } as any);

    expect(repo.create).toHaveBeenCalledWith({ id: 'user_1' });
    expect(result.email).toBe(baseUser.email);
  });

  it('updates user and maps response', async () => {
    repo.update.mockResolvedValue(baseUser);

    const result = await service.update('user_1', { name: 'New' });

    expect(repo.update).toHaveBeenCalledWith('user_1', { name: 'New' });
    expect(result.updatedAt).toBe(baseUser.updatedAt.toISOString());
  });
});
