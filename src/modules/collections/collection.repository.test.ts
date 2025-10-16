import { describe, it, expect, vi } from 'vitest';
import { CollectionRole, type PrismaClient } from '@prisma/client';
import { CollectionRepository, type CollectionCreateData } from './repository';

const createPrismaStub = () => {
  const tx = {
    collection: {
      create: vi.fn(),
    },
    collectionMember: {
      create: vi.fn(),
    },
  };

  const db = {
    collection: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    collectionSample: {
      aggregate: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    collectionMember: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => {
      return callback(tx);
    }),
  };

  return { db, tx };
};

describe('CollectionRepository', () => {
  it('lists collections visible to owner or members', async () => {
    const { db } = createPrismaStub();
    db.collection.findMany.mockResolvedValue([]);
    const repo = new CollectionRepository(db as unknown as PrismaClient);

    await repo.list({ userId: 'user_member', take: 10 });

    expect(db.collection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isDeleted: false,
          deletedAt: null,
          OR: [{ userId: 'user_member' }, { members: { some: { userId: 'user_member' } } }],
        },
        take: 10,
      }),
    );
  });

  it('creates collection and owner membership in a single transaction', async () => {
    const { db, tx } = createPrismaStub();
    const now = new Date('2024-01-01T00:00:00.000Z');
    const createdCollection = {
      id: 'col_1',
      userId: 'user_owner',
      name: 'Workspace',
      createdAt: now,
      updatedAt: now,
      samples: [],
    };

    tx.collection.create.mockResolvedValue(createdCollection);
    tx.collectionMember.create.mockResolvedValue({
      id: 'cm_1',
      collectionId: 'col_1',
      userId: 'user_owner',
      role: CollectionRole.OWNER,
      createdAt: now,
      updatedAt: now,
    });

    const repo = new CollectionRepository(db as unknown as PrismaClient);
    const result = await repo.create({ userId: 'user_owner', name: 'Workspace' } as CollectionCreateData);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    const createCall = tx.collection.create.mock.calls[0]?.[0] as {
      data: { userId: string; name: string };
      include: unknown;
    };
    expect(createCall.data).toEqual({ userId: 'user_owner', name: 'Workspace' });
    expect(createCall.include).toBeDefined();
    expect(tx.collectionMember.create).toHaveBeenCalledWith({
      data: {
        collectionId: 'col_1',
        userId: 'user_owner',
        role: CollectionRole.OWNER,
      },
    });
    expect(result).toEqual(createdCollection);
  });
});
