import { Prisma } from '@prisma/client';
import { extname } from 'path';
import { NotFoundError } from '../../errors';
import { buildPublicSampleKey, copyObjectToPublic, publicUrlFor } from '../../lib/s3';
import { SampleRepository } from './repository';
import { CleanupTaskService } from '../cleanup';
import type {
  CreateSampleBody,
  UpdateSampleBody,
  ListSamplesQuery,
  SampleImageInput,
} from './schemas';
import type { SampleWithRelations } from './repository';

export interface SampleImageResponse {
  id: string;
  storageProvider: string;
  objectKey: string;
  url: string;
  width?: number | null;
  height?: number | null;
  blurhash?: string | null;
  exif?: Record<string, unknown> | null;
}

export interface SampleResponse {
  id: string;
  userId: string;
  title: string;
  materialType: string;
  applicationArea?: string | null;
  surface?: string | null;
  colorHex?: string | null;
  colorName?: string | null;
  companyName?: string | null;
  priceMinor?: number | null;
  priceCurrency?: string | null;
  quantityValue?: number | null;
  quantityUnit?: string | null;
  sizeText?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  notes?: string | null;
  isDeleted: boolean;
  isPublic: boolean;
  publishedAt: string | null;
  image?: SampleImageResponse | null;
  collections: Array<{
    collectionId: string;
    position: number | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

const toNumber = (value: Prisma.Decimal | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  return value.toNumber();
};

const toImageResponse = (image: SampleWithRelations['image']): SampleImageResponse | null => {
  if (!image) {
    return null;
  }

  const derivedUrl =
    image.objectKey && image.objectKey.length > 0 ? publicUrlFor(image.objectKey) : image.url;

  return {
    id: image.id,
    storageProvider: image.storageProvider,
    objectKey: image.objectKey,
    url: derivedUrl,
    width: image.width ?? null,
    height: image.height ?? null,
    blurhash: image.blurhash ?? null,
    exif: (image.exif as Record<string, unknown> | null) ?? null,
  };
};

const toSampleResponse = (sample: SampleWithRelations): SampleResponse => ({
  id: sample.id,
  userId: sample.userId,
  title: sample.title,
  materialType: sample.materialType,
  applicationArea: sample.applicationArea ?? null,
  surface: sample.surface ?? null,
  colorHex: sample.colorHex ?? null,
  colorName: sample.colorName ?? null,
  companyName: sample.companyName ?? null,
  priceMinor: sample.priceMinor ?? null,
  priceCurrency: sample.priceCurrency ?? null,
  quantityValue: toNumber(sample.quantityValue),
  quantityUnit: sample.quantityUnit ?? null,
  sizeText: sample.sizeText ?? null,
  locationLat: toNumber(sample.locationLat),
  locationLng: toNumber(sample.locationLng),
  notes: sample.notes ?? null,
  isDeleted: sample.isDeleted,
  isPublic: sample.isPublic,
  publishedAt: sample.publishedAt ? sample.publishedAt.toISOString() : null,
  image: toImageResponse(sample.image ?? null),
  collections: sample.collections.map((item) => ({
    collectionId: item.collectionId,
    position: item.position ?? null,
  })),
  createdAt: sample.createdAt.toISOString(),
  updatedAt: sample.updatedAt.toISOString(),
});

const decimalOrUndefined = (value?: string) =>
  value === undefined ? undefined : new Prisma.Decimal(value);

const toJsonValue = (value?: Record<string, unknown>) =>
  value === undefined ? undefined : (value as Prisma.InputJsonValue);

const mapImageCreate = (
  image: SampleImageInput,
): Prisma.SampleImageUncheckedCreateWithoutSampleInput => ({
  storageProvider: image.storageProvider,
  objectKey: image.objectKey,
  url: image.url,
  width: image.width ?? undefined,
  height: image.height ?? undefined,
  blurhash: image.blurhash ?? undefined,
  exif: toJsonValue(image.exif),
});

const mapImageUpdate = (
  image: SampleImageInput,
): Prisma.SampleImageUncheckedUpdateWithoutSampleInput => ({
  storageProvider: image.storageProvider,
  objectKey: image.objectKey,
  url: image.url,
  width: image.width ?? undefined,
  height: image.height ?? undefined,
  blurhash: image.blurhash ?? undefined,
  exif: toJsonValue(image.exif),
});

const buildImageMutation = (
  image?: SampleImageInput,
): Prisma.SampleImageUncheckedUpdateOneWithoutSampleNestedInput | undefined => {
  if (!image) {
    return undefined;
  }

  return {
    upsert: {
      create: mapImageCreate(image),
      update: mapImageUpdate(image),
    },
  };
};

export class SampleService {
  constructor(
    private readonly repo = new SampleRepository(),
    private readonly cleanupTasks = new CleanupTaskService(),
  ) {}

  async list(query: ListSamplesQuery = {}): Promise<SampleResponse[]> {
    const samples = await this.repo.list(query);
    return samples.map((sample) => toSampleResponse(sample));
  }

  async findById(
    id: string,
    options: { includeDeleted?: boolean } = {},
  ): Promise<SampleWithRelations | null> {
    return this.repo.findById(id, options);
  }

  async getById(id: string): Promise<SampleResponse> {
    const sample = await this.repo.findById(id);
    if (!sample || sample.deletedAt) {
      throw new NotFoundError('Sample not found');
    }

    return toSampleResponse(sample);
  }

  async create(body: CreateSampleBody): Promise<SampleResponse> {
    const { collectionIds: _collectionIds, ...rest } = body;
    void _collectionIds;
    const data: Prisma.SampleUncheckedCreateInput = {
      userId: rest.userId,
      title: rest.title,
      materialType: rest.materialType,
      applicationArea: rest.applicationArea,
      surface: rest.surface,
      colorHex: rest.colorHex,
      colorName: rest.colorName,
      companyName: rest.companyName,
      priceMinor: rest.priceMinor,
      priceCurrency: rest.priceCurrency?.toUpperCase(),
      quantityValue: decimalOrUndefined(rest.quantityValue),
      quantityUnit: rest.quantityUnit,
      sizeText: rest.sizeText,
      locationLat: decimalOrUndefined(rest.locationLat),
      locationLng: decimalOrUndefined(rest.locationLng),
      notes: rest.notes,
      isPublic: rest.isPublic ?? false,
      publishedAt: rest.isPublic ? new Date() : undefined,
      image: rest.image ? { create: mapImageCreate(rest.image) } : undefined,
    };

    const created = await this.repo.create(data);
    const promoted = await this.promoteSampleImageIfNeeded(created);
    return toSampleResponse(promoted);
  }

  async update(id: string, body: UpdateSampleBody): Promise<SampleResponse> {
    const existing = await this.repo.findById(id);
    if (!existing || existing.deletedAt) {
      throw new NotFoundError('Sample not found');
    }

    const data: Prisma.SampleUncheckedUpdateInput = {
      title: body.title,
      materialType: body.materialType,
      applicationArea: body.applicationArea,
      surface: body.surface,
      colorHex: body.colorHex,
      colorName: body.colorName,
      companyName: body.companyName,
      priceMinor: body.priceMinor,
      priceCurrency: body.priceCurrency?.toUpperCase(),
      quantityValue: decimalOrUndefined(body.quantityValue),
      quantityUnit: body.quantityUnit,
      sizeText: body.sizeText,
      locationLat: decimalOrUndefined(body.locationLat),
      locationLng: decimalOrUndefined(body.locationLng),
      notes: body.notes,
      isDeleted: body.isDeleted,
      isPublic: body.isPublic,
      image: buildImageMutation(body.image),
    };

    if (body.isPublic !== undefined) {
      data.publishedAt = body.isPublic ? existing.publishedAt ?? new Date() : null;
    }

    const updated = await this.repo.update(id, data);
    const promoted = await this.promoteSampleImageIfNeeded(updated);
    return toSampleResponse(promoted);
  }

  async softDelete(id: string): Promise<SampleResponse> {
    const existing = await this.repo.findById(id, { includeDeleted: true });
    if (!existing) {
      throw new NotFoundError('Sample not found');
    }

    if (existing.deletedAt) {
      return toSampleResponse(existing);
    }

    const deletedAt = new Date();
    const deleted = await this.repo.softDelete(id, deletedAt);
    await this.repo.markImageDeleted(id, deletedAt);

    const objectKeys =
      existing.image?.objectKey && existing.image.objectKey.length > 0
        ? [existing.image.objectKey]
        : [];

    await this.cleanupTasks.enqueueSampleCleanup({
      sampleId: deleted.id,
      userId: deleted.userId,
      objectKeys,
    });

    return toSampleResponse(deleted);
  }

  async hardDelete(id: string): Promise<void> {
    await this.repo.hardDelete(id);
  }

  private async promoteSampleImageIfNeeded(
    sample: SampleWithRelations,
  ): Promise<SampleWithRelations> {
    if (!sample.image || !sample.isPublic) {
      return sample;
    }

    const currentKey = sample.image.objectKey;
    if (!currentKey || currentKey.startsWith('public/')) {
      return sample;
    }

    const extension = extname(currentKey).replace(/^\./, '').toLowerCase() || undefined;
    const targetKey = buildPublicSampleKey({
      userId: sample.userId,
      extension,
    });

    await copyObjectToPublic({
      sourceKey: currentKey,
      targetKey,
      deleteSource: true,
    });

    const url = publicUrlFor(targetKey);

    await this.repo.updateImageObjectKey(sample.image.id, {
      objectKey: targetKey,
      url,
    });

    const refreshed = await this.repo.findById(sample.id, { includeDeleted: true });
    if (refreshed) {
      return refreshed;
    }

    return {
      ...sample,
      image: {
        ...sample.image,
        objectKey: targetKey,
        url,
      },
    };
  }
}
