import type { Prisma, User } from '@prisma/client';
import { NotFoundError } from '../../errors';
import { UserRepository } from './repository';
import type { UserResponse } from './schemas';
import { prisma } from '../../lib/prisma';
import { CleanupTaskService, cleanupTaskService } from '../cleanup';

const toResponse = (user: User): UserResponse => {
  return {
    id: user.id,
    email: typeof user.email === 'string' ? user.email : null,
    name: typeof user.name === 'string' ? user.name : null,
    locale: typeof user.locale === 'string' ? user.locale : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  } satisfies UserResponse;
};

export class UserService {
  constructor(
    private readonly repo = new UserRepository(),
    private readonly cleanupTasks: CleanupTaskService = cleanupTaskService,
  ) {}

  async list(params: { skip?: number; take?: number } = {}): Promise<UserResponse[]> {
    const users = await this.repo.list(params);
    return users.map(toResponse);
  }

  async getById(id: string): Promise<UserResponse> {
    const user = await this.repo.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    return toResponse(user);
  }

  async create(data: Prisma.UserCreateInput): Promise<UserResponse> {
    const created = await this.repo.create(data);
    return toResponse(created);
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<UserResponse> {
    const updated = await this.repo.update(id, data);
    return toResponse(updated);
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.repo.findById(id, { includeDeleted: true });

    if (!existing) {
      throw new NotFoundError('User not found');
    }

    if (existing.deletedAt) {
      return;
    }

    const deletedAt = new Date();

    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: { deletedAt },
      }),
      prisma.collection.updateMany({
        where: { userId: id },
        data: { deletedAt, isDeleted: true },
      }),
      prisma.sample.updateMany({
        where: { userId: id },
        data: { deletedAt, isDeleted: true },
      }),
      prisma.sampleImage.updateMany({
        where: { sample: { userId: id } },
        data: { deletedAt },
      }),
    ]);

    const images = await prisma.sampleImage.findMany({
      where: { sample: { userId: id } },
      select: { objectKey: true },
    });

    await this.cleanupTasks.enqueueUserCleanup({
      userId: id,
      objectKeys: images.map((image) => image.objectKey).filter((key): key is string => Boolean(key)),
    });
  }
}
