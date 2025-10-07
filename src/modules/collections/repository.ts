import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const sampleSelect = {
  id: true,
  userId: true,
  title: true,
  materialType: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SampleSelect;

const defaultInclude = {
  samples: {
    include: {
      sample: {
        select: sampleSelect,
      },
    },
    orderBy: {
      position: 'asc',
    },
  },
} satisfies Prisma.CollectionInclude;

export type CollectionWithRelations = Prisma.CollectionGetPayload<{
  include: typeof defaultInclude;
}>;

export class CollectionRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  list(params: { userId?: string; skip?: number; take?: number } = {}) {
    const { userId, skip = 0, take = 25 } = params;

    return this.db.collection.findMany({
      where: {
        userId,
      },
      include: defaultInclude,
      orderBy: { updatedAt: 'desc' },
      skip,
      take,
    });
  }

  findById(id: string) {
    return this.db.collection.findUnique({
      where: { id },
      include: defaultInclude,
    });
  }

  create(data: Prisma.CollectionUncheckedCreateInput) {
    return this.db.collection.create({ data, include: defaultInclude });
  }

  update(id: string, data: Prisma.CollectionUpdateInput) {
    return this.db.collection.update({ where: { id }, data, include: defaultInclude });
  }

  delete(id: string) {
    return this.db.collection.delete({ where: { id } });
  }

  async getNextSamplePosition(collectionId: string) {
    const result = await this.db.collectionSample.aggregate({
      where: { collectionId },
      _max: {
        position: true,
      },
    });

    return (result._max.position ?? 0) + 1;
  }

  createCollectionSample(collectionId: string, sampleId: string, position: number) {
    return this.db.collectionSample.create({
      data: {
        collectionId,
        sampleId,
        position,
      },
      include: {
        sample: {
          select: sampleSelect,
        },
      },
    });
  }

  removeCollectionSample(collectionId: string, sampleId: string) {
    return this.db.collectionSample.delete({
      where: {
        collectionId_sampleId: {
          collectionId,
          sampleId,
        },
      },
    });
  }

  async updateSamplePositions(
    collectionId: string,
    items: Array<{ sampleId: string; position: number }>,
  ) {
    if (items.length === 0) {
      return;
    }

    await this.db.$transaction(
      items.map(({ sampleId, position }) =>
        this.db.collectionSample.update({
          where: {
            collectionId_sampleId: {
              collectionId,
              sampleId,
            },
          },
          data: { position },
        }),
      ),
    );
  }

  getCollectionSample(collectionId: string, sampleId: string) {
    return this.db.collectionSample.findUnique({
      where: {
        collectionId_sampleId: {
          collectionId,
          sampleId,
        },
      },
      include: {
        sample: {
          select: sampleSelect,
        },
      },
    });
  }
}

export const collectionInclude = defaultInclude;
