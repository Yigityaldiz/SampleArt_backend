import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CollectionService } from './service';
import { HttpError, NotFoundError } from '../../errors';

const createDate = () => new Date('2024-01-01T00:00:00.000Z');

const sampleSummary = {
  collectionId: 'col_1',
  sampleId: 'sample_1',
  position: 1,
  addedAt: createDate(),
  sample: {
    id: 'sample_1',
    userId: 'user_1',
    title: 'Marble Tile',
    materialType: 'tile',
    isDeleted: false,
    createdAt: createDate(),
    updatedAt: createDate(),
  },
};

const collectionWithRelations = {
  id: 'col_1',
  userId: 'user_1',
  name: 'Favorites',
  createdAt: createDate(),
  updatedAt: createDate(),
  samples: [sampleSummary],
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
  };

  const sampleRepo = {
    findById: vi.fn(),
  };

  let service: CollectionService;

  beforeEach(() => {
    vi.resetAllMocks();
    Object.values(repo).forEach((mock) => (mock as any).mockReset?.());
    (sampleRepo.findById as any).mockReset?.();
    service = new CollectionService(repo as any, sampleRepo as any);
  });

  it('lists collections and maps samples', async () => {
    (repo.list as any).mockResolvedValue([collectionWithRelations]);

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
    (repo.findById as any).mockResolvedValue(null);

    await expect(service.getById('missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('creates collection for user', async () => {
    (repo.create as any).mockResolvedValue(collectionWithRelations);

    const result = await service.create({ name: 'Favorites', userId: 'user_1' });

    expect(repo.create).toHaveBeenCalledWith({ name: 'Favorites', userId: 'user_1' });
    expect(result.name).toBe('Favorites');
  });

  it('throws when adding duplicated sample', async () => {
    (repo.findById as any).mockResolvedValue(collectionWithRelations);
    (repo.getCollectionSample as any).mockResolvedValue(sampleSummary);

    await expect(service.addSample('col_1', 'sample_1')).rejects.toBeInstanceOf(HttpError);
    expect(sampleRepo.findById).not.toHaveBeenCalled();
  });

  it('adds sample with next position', async () => {
    (repo.findById as any).mockResolvedValue(collectionWithRelations);
    (repo.getCollectionSample as any).mockResolvedValue(null);
    (sampleRepo.findById as any).mockResolvedValue({
      id: 'sample_2',
      userId: 'user_1',
    });
    (repo.getNextSamplePosition as any).mockResolvedValue(2);
    (repo.createCollectionSample as any).mockResolvedValue({
      collectionId: 'col_1',
      sampleId: 'sample_2',
      position: 2,
      addedAt: createDate(),
      sample: sampleSummary.sample,
    });

    const created = await service.addSample('col_1', 'sample_2');

    expect(sampleRepo.findById).toHaveBeenCalledWith('sample_2');
    expect(repo.createCollectionSample).toHaveBeenCalledWith('col_1', 'sample_2', 2);
    expect(created.position).toBe(2);
  });

  it('throws when sample belongs to another user', async () => {
    (repo.findById as any).mockResolvedValue(collectionWithRelations);
    (repo.getCollectionSample as any).mockResolvedValue(null);
    (sampleRepo.findById as any).mockResolvedValue({
      id: 'sample_2',
      userId: 'other_user',
    });

    await expect(service.addSample('col_1', 'sample_2')).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('reorders collection samples and normalizes missing ones', async () => {
    const reorderCollection = {
      ...collectionWithRelations,
      samples: [
        sampleSummary,
        {
          ...sampleSummary,
          sampleId: 'sample_2',
          position: 2,
        },
      ],
    };

    (repo.findById as any)
      .mockResolvedValueOnce(reorderCollection)
      .mockResolvedValueOnce(reorderCollection)
      .mockResolvedValueOnce(reorderCollection);

    await service.reorderSamples('col_1', { sampleIds: ['sample_2'] });

    expect(repo.updateSamplePositions).toHaveBeenCalledWith('col_1', [
      { sampleId: 'sample_2', position: 1 },
      { sampleId: 'sample_1', position: 2 },
    ]);
  });
});
