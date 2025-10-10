import { Prisma, type PrismaClient } from '@prisma/client';
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
    where: {
      sample: {
        isDeleted: false,
        deletedAt: null,
      },
    },
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

export type CollectionSampleWithRelations = Prisma.CollectionSampleGetPayload<{
  include: {
    sample: {
      select: typeof sampleSelect;
    };
  };
}>;

type CollectionCreateData = Prisma.CollectionUncheckedCreateInput;
type CollectionUpdateData = Prisma.CollectionUpdateInput;

export class CollectionRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  list(params: { userId?: string; skip?: number; take?: number } = {}): Promise<CollectionWithRelations[]> {
    const { userId, skip = 0, take = 25 } = params;

    return this.db.collection.findMany({
      where: {
        userId,
        isDeleted: false,
        deletedAt: null,
      },
      include: defaultInclude,
      orderBy: { updatedAt: 'desc' },
      skip,
      take,
    });
  }

  findById(id: string): Promise<CollectionWithRelations | null> {
    return this.db.collection.findFirst({
      where: { id, isDeleted: false, deletedAt: null },
      include: defaultInclude,
    });
  }

  create(data: CollectionCreateData): Promise<CollectionWithRelations> {
    return this.db.collection.create({ data, include: defaultInclude });
  }

  update(id: string, data: CollectionUpdateData): Promise<CollectionWithRelations> {
    return this.db.collection.update({ where: { id }, data, include: defaultInclude });
  }

  async delete(id: string): Promise<void> {
    await this.db.collection.delete({ where: { id } });
  }

  async getNextSamplePosition(collectionId: string): Promise<number> {
    const result = await this.db.collectionSample.aggregate({
      where: { collectionId },
      _max: {
        position: true,
      },
    });

    return (result._max.position ?? 0) + 1;
  }

  createCollectionSample(
    collectionId: string,
    sampleId: string,
    position: number,
  ): Promise<CollectionSampleWithRelations> {
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

  async removeCollectionSample(collectionId: string, sampleId: string): Promise<void> {
    await this.db.collectionSample.delete({
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
  ): Promise<void> {
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

  getCollectionSample(
    collectionId: string,
    sampleId: string,
  ): Promise<CollectionSampleWithRelations | null> {
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
export type { CollectionCreateData, CollectionUpdateData };
