import type { Prisma, User } from '@prisma/client';
import { NotFoundError } from '../../errors';
import { UserRepository } from './repository';
import type { UserResponse } from './schemas';
import { prisma } from '../../lib/prisma';
import { CleanupTaskService, cleanupTaskService } from '../cleanup';
import { isSupportedLanguageCode } from './languages';
import type { SupportedLanguageCode } from './languages';
import {
  ProfileStatusValue,
  resolveProfileStatusFromName,
  sanitizeOptionalName,
} from './name';

const toSupportedLocale = (value: string | null | undefined): SupportedLanguageCode | null => {
  if (typeof value !== 'string') {
    return null;
  }

  return isSupportedLanguageCode(value) ? value : null;
};

const emailPrefix = (email: string | null): string | null => {
  if (typeof email !== 'string') {
    return null;
  }

  const prefix = email.split('@')[0]?.trim();
  return prefix && prefix.length > 0 ? prefix : null;
};

const toDisplayName = (params: { name: string | null; email: string | null; id: string }): string => {
  const { name, email, id } = params;
  if (name) {
    return name;
  }

  const fallbackFromEmail = emailPrefix(email);
  if (fallbackFromEmail) {
    return fallbackFromEmail;
  }

  return `user-${id.slice(0, 6)}`;
};

const requiredFieldsForStatus = (status: ProfileStatusValue): string[] => {
  return status === 'INCOMPLETE' ? ['name'] : [];
};

const toResponse = (user: User): UserResponse => {
  const email = typeof user.email === 'string' ? user.email : null;
  const sanitizedName = sanitizeOptionalName(user.name) ?? null;
  const profileStatus = resolveProfileStatusFromName(sanitizedName);

  return {
    id: user.id,
    email,
    name: sanitizedName,
    displayName: toDisplayName({ name: sanitizedName, email, id: user.id }),
    profileStatus,
    requiredFields: requiredFieldsForStatus(profileStatus),
    locale: toSupportedLocale(user.locale),
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
    const sanitizedName = sanitizeOptionalName((data as { name?: string | null }).name ?? null) ?? null;
    const profileStatus = resolveProfileStatusFromName(sanitizedName);

    const created = await this.repo.create({
      ...data,
      name: sanitizedName,
      profileStatus,
    });
    return toResponse(created);
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<UserResponse> {
    const sanitizedName = sanitizeOptionalName((data as { name?: string | null }).name);

    const updateInput: Prisma.UserUpdateInput = {
      ...data,
    };

    if (sanitizedName !== undefined) {
      const normalizedName = sanitizedName ?? null;
      updateInput.name = normalizedName;
      updateInput.profileStatus = resolveProfileStatusFromName(normalizedName);
    }

    const updated = await this.repo.update(id, updateInput);
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
