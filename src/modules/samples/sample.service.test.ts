import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { SampleService } from './service';
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

const date = new Date('2024-01-01T00:00:00.000Z');

const createDecimal = (value: string) => new Prisma.Decimal(value);

describe('SampleService', () => {
  const repo = {
    list: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    markImageDeleted: vi.fn(),
  };

  const cleanupTasks = {
    enqueueSampleCleanup: vi.fn(),
  };

  const sampleWithRelations = {
    id: 'sample_1',
    userId: 'user_1',
    title: 'Marble Tile',
    materialType: 'tile',
    applicationArea: 'bathroom',
    surface: 'matte',
    colorHex: '#FFFFFF',
    colorName: 'White',
    companyName: 'Sample Co',
    priceMinor: 1200,
    priceCurrency: 'TRY',
    quantityValue: createDecimal('10.5'),
    quantityUnit: 'sqm',
    sizeText: '30x30',
    locationLat: createDecimal('40.123456'),
    locationLng: createDecimal('29.654321'),
    notes: 'Test note',
    isDeleted: false,
    deletedAt: null,
    image: {
      id: 'img_1',
      sampleId: 'sample_1',
      storageProvider: 'local',
      objectKey: 'sample/object.jpg',
      url: 'https://example.com/object.jpg',
      width: 1200,
      height: 800,
      blurhash: null,
      exif: { camera: 'nikon' },
      createdAt: date,
      deletedAt: null,
    },
    collections: [
      {
        collectionId: 'col_1',
        sampleId: 'sample_1',
        position: 1,
        addedAt: date,
      },
    ],
    createdAt: date,
    updatedAt: date,
  } as any;

  const service = new SampleService(repo as any, cleanupTasks as any);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('lists samples and maps decimals to numbers', async () => {
    repo.list.mockResolvedValue([sampleWithRelations]);

    const result = await service.list({ take: 5 });

    expect(repo.list).toHaveBeenCalledWith({ take: 5 });
    expect(result[0]).toMatchObject({
      id: 'sample_1',
      quantityValue: 10.5,
      locationLat: 40.123456,
      image: {
        storageProvider: 'local',
        exif: { camera: 'nikon' },
      },
    });
  });

  it('gets sample by id', async () => {
    repo.findById.mockResolvedValue(sampleWithRelations);

    const result = await service.getById('sample_1');

    expect(repo.findById).toHaveBeenCalledWith('sample_1');
    expect(result.id).toBe('sample_1');
  });

  it('throws NotFoundError when sample missing', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(service.getById('missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('creates sample and uppercases currency', async () => {
    repo.create.mockResolvedValue(sampleWithRelations);

    const body = {
      userId: 'user_1',
      title: 'Marble Tile',
      materialType: 'tile',
      priceCurrency: 'try',
      quantityValue: '10.5',
      locationLat: '40.123456',
      locationLng: '29.654321',
      image: {
        storageProvider: 'local',
        objectKey: 'sample/object.jpg',
        url: 'https://example.com/object.jpg',
      },
    } as any;

    await service.create(body);

    const payload = repo.create.mock.calls[0][0];
    expect(payload.priceCurrency).toBe('TRY');
    expect(payload.quantityValue).toBeInstanceOf(Prisma.Decimal);
    expect(payload.locationLat).toBeInstanceOf(Prisma.Decimal);
    expect(payload.image?.create).toBeDefined();
  });

  it('updates sample and handles image mutation', async () => {
    repo.findById.mockResolvedValue(sampleWithRelations);
    repo.update.mockResolvedValue(sampleWithRelations);

    const body = {
      title: 'Updated',
      priceCurrency: 'usd',
      quantityValue: '9.5',
      image: {
        storageProvider: 's3',
        objectKey: 'sample/new.jpg',
        url: 'https://example.com/new.jpg',
      },
    } as any;

    await service.update('sample_1', body);

    const payload = repo.update.mock.calls[0][1];
    expect(repo.findById).toHaveBeenCalledWith('sample_1');
    expect(payload.priceCurrency).toBe('USD');
    expect(payload.image?.upsert).toBeDefined();
  });

  it('throws NotFoundError when updating missing sample', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(service.update('missing', {} as any)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('soft deletes sample', async () => {
    const deletedSample = { ...sampleWithRelations, isDeleted: true };
    repo.findById.mockResolvedValueOnce(sampleWithRelations);
    repo.softDelete.mockResolvedValue({ ...deletedSample, deletedAt: date });

    const result = await service.softDelete('sample_1');

    expect(repo.findById).toHaveBeenCalledWith('sample_1', { includeDeleted: true });
    expect(repo.softDelete).toHaveBeenCalledWith('sample_1', expect.any(Date));
    expect(repo.markImageDeleted).toHaveBeenCalledWith('sample_1', expect.any(Date));
    expect(cleanupTasks.enqueueSampleCleanup).toHaveBeenCalledWith({
      sampleId: 'sample_1',
      userId: 'user_1',
      objectKeys: ['sample/object.jpg'],
    });
    expect(result.isDeleted).toBe(true);
  });
});
