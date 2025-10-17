import { CollectionRole, InviteStatus, type Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { HttpError, NotFoundError } from '../../errors';
import { InviteRepository, type InviteWithRelations, inviteRepository } from './repository';
import { UserRepository } from '../users/repository';
import { auditLogService, type AuditLogService } from '../audit';

const INVITER_RATE_LIMIT_MAX = 5;
const INVITER_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const buildInviteCreateData = (
  collectionId: string,
  inviterId: string,
  role: CollectionRole,
  token: string,
  expiresAt: Date,
): Prisma.InviteUncheckedCreateInput => ({
  collectionId,
  inviterId,
  inviteeUserId: null,
  inviteeEmail: null,
  inviteeUsername: null,
  role,
  token,
  status: InviteStatus.PENDING,
  expiresAt,
});

export const generateInviteToken = async (repo: InviteRepository, attempts = 5): Promise<string> => {
  for (let i = 0; i < attempts; i += 1) {
    const token = `inv_${randomBytes(8).toString('base64url')}`;
    const existing = await repo.findByToken(token);

    if (!existing) {
      return token;
    }
  }

  throw new Error('Failed to generate unique invite token');
};

export interface CreateInviteResult {
  invite: InviteWithRelations;
}

export class InviteService {
  constructor(
    private readonly repo: InviteRepository = inviteRepository,
    private readonly userRepository: UserRepository = new UserRepository(),
    private readonly auditLogs: AuditLogService = auditLogService,
  ) {}

  async createInvite(
    collectionId: string,
    inviterId: string,
    requestedRole: CollectionRole = CollectionRole.VIEW_ONLY,
  ): Promise<CreateInviteResult> {
    if (requestedRole === CollectionRole.OWNER) {
      throw new HttpError(400, 'Cannot invite user with OWNER role');
    }

    const finalRole = CollectionRole.VIEW_ONLY;
    const now = Date.now();
    const inviterLimitSince = new Date(now - INVITER_RATE_LIMIT_WINDOW_MS);
    const inviterCount = await this.repo.countRecentByInviter(inviterId, inviterLimitSince);
    if (inviterCount >= INVITER_RATE_LIMIT_MAX) {
      throw new HttpError(429, 'Invite rate limit exceeded for inviter');
    }

    const expiresAt = new Date(now + INVITE_TTL_MS);
    const token = await generateInviteToken(this.repo);

    const invite = await this.repo.create(
      buildInviteCreateData(collectionId, inviterId, finalRole, token, expiresAt),
    );

    await this.auditLogs.log({
      actorId: inviterId,
      action: 'INVITE_CREATED',
      collectionId,
      targetUserId: null,
      inviteId: invite.id,
      metadata: {
        role: invite.role,
        token,
        expiresAt: invite.expiresAt.toISOString(),
      },
    });

    return { invite };
  }

  async resolveInvite(token: string): Promise<InviteWithRelations> {
    const invite = await this.repo.findByToken(token);

    if (!invite) {
      throw new NotFoundError('Invite not found');
    }

    if (invite.status === InviteStatus.PENDING && invite.expiresAt.getTime() < Date.now()) {
      await this.repo.update(invite.id, { status: InviteStatus.EXPIRED });
      await this.auditLogs.log({
        actorId: invite.inviterId,
        action: 'INVITE_EXPIRED',
        collectionId: invite.collectionId,
        targetUserId: invite.invitee?.id ?? invite.inviteeUserId ?? null,
        inviteId: invite.id,
      });
      throw new HttpError(410, 'Invite has expired');
    }

    return invite;
  }

  async acceptInvite(inviteId: string, userId: string): Promise<InviteWithRelations> {
    const invite = await this.repo.findById(inviteId);

    if (!invite) {
      throw new NotFoundError('Invite not found');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new HttpError(409, 'Invite has already been processed');
    }

    if (invite.expiresAt.getTime() < Date.now()) {
      await this.repo.update(invite.id, { status: InviteStatus.EXPIRED });
      await this.auditLogs.log({
        actorId: invite.inviterId,
        action: 'INVITE_EXPIRED',
        collectionId: invite.collectionId,
        targetUserId: invite.invitee?.id ?? invite.inviteeUserId ?? null,
        inviteId: invite.id,
      });
      throw new HttpError(410, 'Invite has expired');
    }

    if (invite.inviteeUserId && invite.inviteeUserId !== userId) {
      throw new HttpError(403, 'Invite is not intended for this user');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (invite.inviteeEmail && user.email && invite.inviteeEmail !== user.email) {
      throw new HttpError(403, 'Invite email does not match the signed-in user');
    }

    const update: Prisma.InviteUncheckedUpdateInput = {
      status: InviteStatus.ACCEPTED,
    };

    if (!invite.inviteeUserId) {
      update.inviteeUserId = user.id;
    }

    if (!invite.inviteeEmail && user.email) {
      update.inviteeEmail = user.email;
    }

    if (!invite.inviteeUsername && user.name) {
      update.inviteeUsername = user.name;
    }

    const updated = await this.repo.update(invite.id, update);

    await this.auditLogs.log({
      actorId: userId,
      action: 'INVITE_ACCEPTED',
      collectionId: invite.collectionId,
      targetUserId: userId,
      inviteId: invite.id,
      metadata: {
        role: updated.role,
      },
    });

    return updated;
  }

  async rejectInvite(inviteId: string, userId: string): Promise<InviteWithRelations> {
    const invite = await this.repo.findById(inviteId);

    if (!invite) {
      throw new NotFoundError('Invite not found');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new HttpError(409, 'Invite has already been processed');
    }

    if (invite.expiresAt.getTime() < Date.now()) {
      await this.repo.update(invite.id, { status: InviteStatus.EXPIRED });
      await this.auditLogs.log({
        actorId: invite.inviterId,
        action: 'INVITE_EXPIRED',
        collectionId: invite.collectionId,
        targetUserId: invite.invitee?.id ?? invite.inviteeUserId ?? null,
        inviteId: invite.id,
      });
      throw new HttpError(410, 'Invite has expired');
    }

    if (invite.inviteeUserId && invite.inviteeUserId !== userId) {
      throw new HttpError(403, 'Invite is not intended for this user');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const update: Prisma.InviteUncheckedUpdateInput = {
      status: InviteStatus.REJECTED,
    };

    if (!invite.inviteeUserId) {
      update.inviteeUserId = user.id;
    }

    const updated = await this.repo.update(invite.id, update);

    await this.auditLogs.log({
      actorId: userId,
      action: 'INVITE_REJECTED',
      collectionId: invite.collectionId,
      targetUserId: userId,
      inviteId: invite.id,
    });

    return updated;
  }

  async expireInvites(now = new Date()): Promise<number> {
    const pending = await this.repo.findPendingExpired(now);

    if (pending.length === 0) {
      return 0;
    }

    const ids = pending.map((invite) => invite.id);
    const count = await this.repo.markExpired(ids);

    await Promise.allSettled(
      pending.map((invite) =>
        this.auditLogs.log({
          actorId: invite.inviterId,
          action: 'INVITE_EXPIRED',
          collectionId: invite.collectionId,
          targetUserId: invite.invitee?.id ?? invite.inviteeUserId ?? null,
          inviteId: invite.id,
        }),
      ),
    );

    return count;
  }
}

export const inviteService = new InviteService();
