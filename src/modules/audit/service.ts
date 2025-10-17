import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export interface AuditLogParams {
  actorId: string;
  action: string;
  collectionId?: string | null;
  targetUserId?: string | null;
  inviteId?: string | null;
  metadata?: Record<string, unknown> | null;
}

const toJson = (value: Record<string, unknown> | null | undefined): Prisma.InputJsonValue | undefined => {
  if (!value) {
    return undefined;
  }

  return value as Prisma.InputJsonValue;
};

export class AuditLogService {
  constructor(private readonly db: PrismaClient = prisma) {}

  async log(params: AuditLogParams) {
    const { actorId, action, collectionId, targetUserId, inviteId, metadata } = params;

    return this.db.auditLog.create({
      data: {
        actorId,
        action,
        collectionId: collectionId ?? null,
        targetUserId: targetUserId ?? null,
        inviteId: inviteId ?? null,
        metadata: toJson(metadata ?? undefined),
      },
    });
  }
}

export const auditLogService = new AuditLogService();
