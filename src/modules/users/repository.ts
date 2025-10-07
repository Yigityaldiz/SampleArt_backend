import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export type UserCreateInput = Prisma.UserCreateInput;
export type UserUpdateInput = Prisma.UserUpdateInput;

export class UserRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  findById(id: string) {
    return this.db.user.findUnique({ where: { id } });
  }

  findByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }

  list(params: { skip?: number; take?: number } = {}) {
    const { skip = 0, take = 25 } = params;
    return this.db.user.findMany({ skip, take, orderBy: { createdAt: 'desc' } });
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
