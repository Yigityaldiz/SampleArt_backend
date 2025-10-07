import type { Prisma, User } from '@prisma/client';
import { NotFoundError } from '../../errors';
import { UserRepository } from './repository';
import type { UserResponse } from './schemas';

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
  constructor(private readonly repo = new UserRepository()) {}

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
}
