import { InviteStatus, type Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const inviteUserSelect = {
  id: true,
  email: true,
  name: true,
} satisfies Prisma.UserSelect;

const inviteInclude = {
  collection: {
    select: {
      id: true,
      name: true,
    },
  },
  inviter: {
    select: inviteUserSelect,
  },
  invitee: {
    select: inviteUserSelect,
  },
} satisfies Prisma.InviteInclude;

export type InviteWithRelations = Prisma.InviteGetPayload<{
  include: typeof inviteInclude;
}>;

export class InviteRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  create(data: Prisma.InviteUncheckedCreateInput): Promise<InviteWithRelations> {
    return this.db.invite.create({ data, include: inviteInclude });
  }

  findByToken(token: string): Promise<InviteWithRelations | null> {
    return this.db.invite.findUnique({
      where: { token },
      include: inviteInclude,
    });
  }

  findById(id: string): Promise<InviteWithRelations | null> {
    return this.db.invite.findUnique({
      where: { id },
      include: inviteInclude,
    });
  }

  countRecentByInviter(inviterId: string, since: Date): Promise<number> {
    return this.db.invite.count({
      where: {
        inviterId,
        createdAt: {
          gte: since,
        },
      },
    });
  }

  update(id: string, data: Prisma.InviteUncheckedUpdateInput): Promise<InviteWithRelations> {
    return this.db.invite.update({
      where: { id },
      data,
      include: inviteInclude,
    });
  }

  findPendingExpired(now: Date): Promise<InviteWithRelations[]> {
    return this.db.invite.findMany({
      where: {
        status: InviteStatus.PENDING,
        expiresAt: {
          lt: now,
        },
      },
      include: inviteInclude,
      orderBy: {
        expiresAt: 'asc',
      },
    });
  }

  async markExpired(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const result = await this.db.invite.updateMany({
      where: { id: { in: ids } },
      data: { status: InviteStatus.EXPIRED },
    });

    return result.count;
  }
}

export const inviteRepository = new InviteRepository();
