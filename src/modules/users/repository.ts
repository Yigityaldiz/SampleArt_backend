import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export type UserCreateInput = Prisma.UserCreateInput;
export type UserUpdateInput = Prisma.UserUpdateInput;

export class UserRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  findById(id: string, options: { includeDeleted?: boolean } = {}) {
    const { includeDeleted = false } = options;
    return this.db.user.findFirst({
      where: {
        id,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
  }

  findByEmail(email: string) {
    return this.db.user.findFirst({
      where: { email, deletedAt: null },
    });
  }
  findByName(name: string) {
    return this.db.user.findFirst({
      where: { name, deletedAt: null },
    });
  }

  list(params: { skip?: number; take?: number } = {}) {
    const { skip = 0, take = 25 } = params;
    return this.db.user.findMany({
      where: { deletedAt: null },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }

  create(data: UserCreateInput) {
    return this.db.user.create({ data });
  }

  update(id: string, data: UserUpdateInput) {
    return this.db.user.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.db.user.delete({ where: { id } });
  }

  softDelete(id: string, deletedAt: Date) {
    return this.db.user.update({
      where: { id },
      data: { deletedAt },
    });
  }
}

export type UserWithRelations = Prisma.UserGetPayload<{
  include: {
    samples: true;
    collections: true;
  };
}>;

export const defaultUserSelect: Prisma.UserSelect = {
  id: true,
  email: true,
  name: true,
  locale: true,
  createdAt: true,
  updatedAt: true,
};
