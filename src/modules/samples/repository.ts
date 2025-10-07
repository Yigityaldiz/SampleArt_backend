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

  findById(id: string) {
    return this.db.sample.findUnique({ where: { id }, include: defaultInclude });
  }

  list(params: { userId?: string; skip?: number; take?: number; includeDeleted?: boolean } = {}) {
    const { userId, skip = 0, take = 25, includeDeleted = false } = params;

    return this.db.sample.findMany({
      where: {
        userId,
        ...(includeDeleted ? {} : { isDeleted: false }),
      },
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

  softDelete(id: string) {
    return this.db.sample.update({
      where: { id },
      data: { isDeleted: true },
      include: defaultInclude,
    });
  }
}

export type SampleWithRelations = Prisma.SampleGetPayload<{
  include: typeof defaultInclude;
}>;

export const sampleInclude = defaultInclude;
