import { Prisma } from '@prisma/client';
import { NotFoundError } from '../../errors';
import { SampleRepository } from './repository';
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

  return {
    id: image.id,
    storageProvider: image.storageProvider,
    objectKey: image.objectKey,
    url: image.url,
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
  image: toImageResponse(sample.image ?? null),
  collections: sample.collections.map((item: any) => ({
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
  constructor(private readonly repo = new SampleRepository()) {}

  async list(query: ListSamplesQuery = {}): Promise<SampleResponse[]> {
    const samples = await this.repo.list(query);
    return samples.map((sample: any) => toSampleResponse(sample));
  }

  async getById(id: string): Promise<SampleResponse> {
    const sample = await this.repo.findById(id);
    if (!sample) {
      throw new NotFoundError('Sample not found');
    }

    return toSampleResponse(sample);
  }

  async create(body: CreateSampleBody): Promise<SampleResponse> {
    const data: Prisma.SampleUncheckedCreateInput = {
      userId: body.userId,
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
      image: body.image ? { create: mapImageCreate(body.image) } : undefined,
    };

    const created = await this.repo.create(data);
    return toSampleResponse(created);
  }

  async update(id: string, body: UpdateSampleBody): Promise<SampleResponse> {
    const existing = await this.repo.findById(id);
    if (!existing) {
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
      image: buildImageMutation(body.image),
    };

    const updated = await this.repo.update(id, data);
    return toSampleResponse(updated);
  }

  async softDelete(id: string): Promise<SampleResponse> {
    const deleted = await this.repo.softDelete(id);
    return toSampleResponse(deleted);
  }
}
