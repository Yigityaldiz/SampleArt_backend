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

  list(params: { skip?: number; take?: number; search?: string } = {}) {
    const { skip = 0, take = 25, search } = params;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    };

    if (search && search.trim().length > 0) {
      const query = search.trim();
      where.OR = [
        { email: { contains: query, mode: 'insensitive' } },
        { name: { contains: query, mode: 'insensitive' } },
        { id: { contains: query } },
      ];
    }

    return this.db.user.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }

  count(params: { search?: string } = {}) {
    const { search } = params;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    };

    if (search && search.trim().length > 0) {
      const query = search.trim();
      where.OR = [
        { email: { contains: query, mode: 'insensitive' } },
        { name: { contains: query, mode: 'insensitive' } },
        { id: { contains: query } },
      ];
    }

    return this.db.user.count({ where });
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
