import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export type SampleCreateInput = Prisma.SampleUncheckedCreateInput;
export type SampleUpdateInput = Prisma.SampleUncheckedUpdateInput;

const defaultInclude = {
  image: true,
  collections: true,
} satisfies Prisma.SampleInclude;

export class SampleRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  findById(
    id: string,
    options: { includeDeleted?: boolean } = {},
  ): Promise<SampleWithRelations | null> {
    const { includeDeleted = false } = options;

    return this.db.sample.findFirst({
      where: {
        id,
        ...(includeDeleted
          ? {}
          : {
              isDeleted: false,
              deletedAt: null,
            }),
      },
      include: defaultInclude,
    });
  }

  list(
    params: {
      userId?: string;
      collectionId?: string;
      skip?: number;
      take?: number;
      includeDeleted?: boolean;
    } = {},
  ) {
    const { userId, collectionId, skip = 0, take = 25, includeDeleted = false } = params;

    const conditions: Prisma.SampleWhereInput[] = [];

    if (userId) {
      conditions.push({ userId });
    }

    if (!includeDeleted) {
      conditions.push({ isDeleted: false, deletedAt: null });
    }

    if (collectionId) {
      conditions.push({
        collections: {
          some: {
            collectionId,
          },
        },
      });
    }

    const where =
      conditions.length > 0
        ? {
            AND: conditions,
          }
        : undefined;

    return this.db.sample.findMany({
      where,
      skip,
      take,
      orderBy: { updatedAt: 'desc' },
      include: defaultInclude,
    });
  }

  create(data: SampleCreateInput) {
    return this.db.sample.create({ data, include: defaultInclude });
  }

  update(id: string, data: SampleUpdateInput) {
    return this.db.sample.update({ where: { id }, data, include: defaultInclude });
  }

  softDelete(id: string, deletedAt: Date) {
    return this.db.sample.update({
      where: { id },
      data: { isDeleted: true, deletedAt },
      include: defaultInclude,
    });
  }

  markImageDeleted(sampleId: string, deletedAt: Date) {
    return this.db.sampleImage.updateMany({
      where: { sampleId },
      data: { deletedAt },
    });
  }

  hardDelete(id: string) {
    return this.db.sample.delete({
      where: { id },
    });
  }

  deleteCollectionLinks(sampleId: string) {
    return this.db.collectionSample.deleteMany({
      where: { sampleId },
    });
  }
}

export type SampleWithRelations = Prisma.SampleGetPayload<{
  include: typeof defaultInclude;
}>;

export const sampleInclude = defaultInclude;
