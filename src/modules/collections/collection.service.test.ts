import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CollectionRole, ProfileStatus } from '@prisma/client';
import { CollectionService } from './service';
import { NotFoundError } from '../../errors';
import type { CollectionRepository } from './repository';
import type { SampleRepository } from '../samples/repository';

const sanitizeOptionalNameMock = vi.hoisted(() =>
  vi.fn((value: string | null | undefined) => value ?? null),
);

vi.mock('../users/name', () => ({
  sanitizeOptionalName: sanitizeOptionalNameMock,
}));

const createDate = () => new Date('2024-01-01T00:00:00.000Z');

const ownerUser = {
  id: 'user_owner',
  email: 'owner@example.com',
  name: 'Owner Name',
  profileStatus: ProfileStatus.COMPLETE,
  locale: 'en',
};

const editorUser = {
  id: 'user_editor',
  email: 'editor@example.com',
  name: 'Editor',
  profileStatus: ProfileStatus.INCOMPLETE,
  locale: null,
};

const collectionWithRelations = {
  id: 'col_1',
  userId: ownerUser.id,
  name: 'Favorites',
  createdAt: createDate(),
  updatedAt: createDate(),
  samples: [
    {
      collectionId: 'col_1',
      sampleId: 'sample_1',
      position: 1,
      addedAt: createDate(),
      sample: {
        id: 'sample_1',
        userId: ownerUser.id,
        title: 'Tile',
        materialType: 'tile',
        isDeleted: false,
        createdAt: createDate(),
        updatedAt: createDate(),
      },
    },
  ],
};

const ownerMembership = {
  id: 'mem_owner',
  collectionId: 'col_1',
  userId: ownerUser.id,
  role: CollectionRole.OWNER,
  createdAt: createDate(),
  updatedAt: createDate(),
  user: ownerUser,
};

const editorMembership = {
  id: 'mem_editor',
  collectionId: 'col_1',
  userId: editorUser.id,
  role: CollectionRole.EDITOR,
  createdAt: createDate(),
  updatedAt: createDate(),
  user: editorUser,
};

describe('CollectionService', () => {
  const repo = {
    list: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getCollectionSample: vi.fn(),
    getNextSamplePosition: vi.fn(),
    createCollectionSample: vi.fn(),
    removeCollectionSample: vi.fn(),
    updateSamplePositions: vi.fn(),
    findMembership: vi.fn(),
    findMembershipById: vi.fn(),
    listMembers: vi.fn(),
    createMembership: vi.fn(),
    updateMembershipRole: vi.fn(),
    deleteMembership: vi.fn(),
  } satisfies Record<string, ReturnType<typeof vi.fn>>;

  const sampleRepo = {
    findById: vi.fn(),
  } satisfies Record<string, ReturnType<typeof vi.fn>>;

  let service: CollectionService;

  beforeEach(() => {
    vi.resetAllMocks();
    Object.values(repo).forEach((mock) => mock.mockReset());
    sampleRepo.findById.mockReset();
    sanitizeOptionalNameMock.mockReset();
    sanitizeOptionalNameMock.mockImplementation((value: string | null | undefined) => value ?? null);

    repo.list.mockResolvedValue([collectionWithRelations]);
    repo.findById.mockResolvedValue(collectionWithRelations);
    repo.findMembership.mockResolvedValue(ownerMembership);
    repo.listMembers.mockResolvedValue([ownerMembership]);
    repo.create.mockResolvedValue(collectionWithRelations);
    repo.getCollectionSample.mockResolvedValue(null);
    repo.getNextSamplePosition.mockResolvedValue(2);
    repo.createCollectionSample.mockResolvedValue({
      collectionId: 'col_1',
      sampleId: 'sample_2',
      position: 2,
      addedAt: createDate(),
      sample: collectionWithRelations.samples[0].sample,
    });
    sampleRepo.findById.mockResolvedValue({
      id: 'sample_2',
      userId: ownerUser.id,
    });
    service = new CollectionService(
      repo as unknown as CollectionRepository,
      sampleRepo as unknown as SampleRepository,
    );
  });

  it('lists collections and maps samples', async () => {
    const result = await service.list();

    expect(repo.list).toHaveBeenCalled();
    expect(result[0]).toMatchObject({
      id: 'col_1',
      samples: [
        {
          sampleId: 'sample_1',
          position: 1,
        },
      ],
    });
  });

  it('throws when collection not found on getById', async () => {
    repo.findById.mockResolvedValueOnce(null);

    await expect(service.getById('missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns collection for member in getForUser', async () => {
    const result = await service.getForUser('col_1', ownerUser.id);

    expect(repo.findMembership).toHaveBeenCalledWith('col_1', ownerUser.id);
    expect(result.id).toBe('col_1');
  });

  it('denies access when user is not a member', async () => {
    repo.findMembership.mockResolvedValueOnce(null);

    await expect(service.getForUser('col_1', 'other_user')).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('updates collection metadata only for owner', async () => {
    repo.update.mockResolvedValueOnce(collectionWithRelations);

    await service.updateForUser('col_1', ownerUser.id, { name: 'New Name' });
    expect(repo.update).toHaveBeenCalledWith('col_1', { name: 'New Name' });

    repo.findMembership.mockResolvedValueOnce({
      ...editorMembership,
    });

    await expect(
      service.updateForUser('col_1', editorUser.id, { name: 'Blocked' }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('adds sample for editor role', async () => {
    repo.findMembership.mockResolvedValueOnce(editorMembership);

    await service.addSampleForUser('col_1', editorUser.id, 'sample_2');

    expect(repo.createCollectionSample).toHaveBeenCalledWith('col_1', 'sample_2', 2);
  });

  it('prevents adding sample when ownership mismatches', async () => {
    repo.findMembership.mockResolvedValueOnce(editorMembership);
    repo.findMembership.mockResolvedValueOnce(null);
    sampleRepo.findById.mockResolvedValueOnce({
      id: 'sample_3',
      userId: 'other_user',
    });

    await expect(service.addSampleForUser('col_1', editorUser.id, 'sample_3')).rejects.toMatchObject(
      {
        statusCode: 403,
      },
    );
  });

  it('prevents removing collection owner membership', async () => {
    repo.findMembershipById.mockResolvedValueOnce(ownerMembership);

    await expect(
      service.removeMember('col_1', ownerUser.id, ownerMembership.id),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('removes member when permitted', async () => {
    repo.findMembershipById.mockResolvedValueOnce({
      ...editorMembership,
    });

    await service.removeMember('col_1', ownerUser.id, editorMembership.id);

    expect(repo.deleteMembership).toHaveBeenCalledWith(editorMembership.id);
  });
});
