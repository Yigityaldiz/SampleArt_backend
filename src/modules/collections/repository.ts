import { CollectionRole } from '@prisma/client';
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
type CollectionMemberCreateData = Prisma.CollectionMemberUncheckedCreateInput;

const memberUserSelect = {
  id: true,
  email: true,
  name: true,
  profileStatus: true,
  locale: true,
} satisfies Prisma.UserSelect;

export type CollectionMemberWithUser = Prisma.CollectionMemberGetPayload<{
  include: {
    user: {
      select: typeof memberUserSelect;
    };
  };
}>;

export class CollectionRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  list(params: { userId?: string; skip?: number; take?: number } = {}): Promise<CollectionWithRelations[]> {
    const { userId, skip = 0, take = 25 } = params;

    const where: Prisma.CollectionWhereInput = {
      isDeleted: false,
      deletedAt: null,
    };

    if (userId) {
      where.OR = [{ userId }, { members: { some: { userId } } }];
    }

    return this.db.collection.findMany({
      where,
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

  async create(data: CollectionCreateData): Promise<CollectionWithRelations> {
    return this.db.$transaction(async (tx) => {
      const collection = await tx.collection.create({ data, include: defaultInclude });

      await tx.collectionMember.create({
        data: {
          collectionId: collection.id,
          userId: data.userId,
          role: CollectionRole.OWNER,
        },
      });

      return collection;
    });
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

  findMembership(collectionId: string, userId: string): Promise<CollectionMemberWithUser | null> {
    return this.db.collectionMember.findFirst({
      where: {
        collectionId,
        userId,
      },
      include: {
        user: {
          select: memberUserSelect,
        },
      },
    });
  }

  findMembershipById(id: string): Promise<CollectionMemberWithUser | null> {
    return this.db.collectionMember.findUnique({
      where: { id },
      include: {
        user: {
          select: memberUserSelect,
        },
      },
    });
  }

  listMembers(collectionId: string): Promise<CollectionMemberWithUser[]> {
    return this.db.collectionMember.findMany({
      where: {
        collectionId,
      },
      include: {
        user: {
          select: memberUserSelect,
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  createMembership(data: CollectionMemberCreateData): Promise<CollectionMemberWithUser> {
    return this.db.collectionMember.create({
      data,
      include: {
        user: {
          select: memberUserSelect,
        },
      },
    });
  }

  updateMembershipRole(id: string, role: CollectionRole): Promise<CollectionMemberWithUser> {
    return this.db.collectionMember.update({
      where: { id },
      data: { role },
      include: {
        user: {
          select: memberUserSelect,
        },
      },
    });
  }

  async deleteMembership(id: string): Promise<void> {
    await this.db.collectionMember.delete({
      where: { id },
    });
  }

  async isUserMemberOfSample(params: {
    userId: string;
    sampleId: string;
    collectionId?: string;
  }): Promise<boolean> {
    const { userId, sampleId, collectionId } = params;
    const membership = await this.db.collectionMember.findFirst({
      where: {
        userId,
        ...(collectionId ? { collectionId } : {}),
        collection: {
          isDeleted: false,
          deletedAt: null,
          samples: {
            some: {
              sampleId,
              ...(collectionId ? { collectionId } : {}),
            },
          },
        },
      },
      select: { id: true },
    });

    return Boolean(membership);
  }
}

export const collectionInclude = defaultInclude;
export type { CollectionCreateData, CollectionUpdateData, CollectionMemberCreateData };
