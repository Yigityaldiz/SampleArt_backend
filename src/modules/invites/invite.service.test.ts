import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CollectionRole, InviteStatus } from '@prisma/client';
import { InviteService } from './service';
import type { InviteRepository, InviteWithRelations } from './repository';
import type { UserRepository } from '../users/repository';
import type { AuditLogService } from '../audit';

const createDate = () => new Date('2024-01-01T00:00:00.000Z');

const buildInvite = (overrides: Partial<InviteWithRelations> = {}): InviteWithRelations => ({
  id: 'inv_1',
  collectionId: 'col_1',
  inviterId: 'user_owner',
  inviteeUserId: null,
  inviteeEmail: null,
  inviteeUsername: null,
  role: CollectionRole.VIEW_ONLY,
  token: 'inv_token',
  status: InviteStatus.PENDING,
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  createdAt: createDate(),
  updatedAt: createDate(),
  collection: {
    id: 'col_1',
    name: 'Favorites',
  },
  inviter: {
    id: 'user_owner',
    email: 'owner@example.com',
    name: 'Owner',
  },
  invitee: null,
  ...overrides,
});

describe('InviteService security checks', () => {
  const repo = {
    countRecentByInviter: vi.fn(),
    create: vi.fn(),
    findByToken: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    findPendingExpired: vi.fn(),
    markExpired: vi.fn(),
  } satisfies Record<string, ReturnType<typeof vi.fn>>;

  const userRepo = {
    findByEmail: vi.fn(),
    findByName: vi.fn(),
    findById: vi.fn(),
  } satisfies Record<string, ReturnType<typeof vi.fn>>;

  const auditLogs = {
    log: vi.fn(),
  } satisfies Record<string, ReturnType<typeof vi.fn>>;

  let service: InviteService;

  beforeEach(() => {
    vi.restoreAllMocks();
    Object.values(repo).forEach((mock) => mock.mockReset());
    Object.values(userRepo).forEach((mock) => mock.mockReset());
    auditLogs.log.mockReset();

    repo.countRecentByInviter.mockResolvedValue(0);
    repo.create.mockResolvedValue(
      buildInvite({
        token: 'generated',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }),
    );
    repo.findById.mockResolvedValue(
      buildInvite({
        inviteeUserId: 'user_target',
        inviteeEmail: 'target@example.com',
        inviteeUsername: 'target',
        invitee: {
          id: 'user_target',
          email: 'target@example.com',
          name: 'Target',
        },
      }),
    );
    repo.update.mockResolvedValue(
      buildInvite({
        inviteeUserId: 'user_target',
        inviteeEmail: 'target@example.com',
        inviteeUsername: 'target',
        invitee: {
          id: 'user_target',
          email: 'target@example.com',
          name: 'Target',
        },
        status: InviteStatus.ACCEPTED,
      }),
    );

    userRepo.findByEmail.mockResolvedValue(null);
    userRepo.findByName.mockResolvedValue(null);
    userRepo.findById.mockResolvedValue({
      id: 'user_target',
      email: 'target@example.com',
      name: 'Target',
    });

    service = new InviteService(
      repo as unknown as InviteRepository,
      userRepo as unknown as UserRepository,
      auditLogs as unknown as AuditLogService,
    );
  });

  it('enforces inviter rate limits', async () => {
    repo.countRecentByInviter.mockResolvedValueOnce(5);

    await expect(service.createInvite('col_1', 'user_owner')).rejects.toMatchObject({
      statusCode: 429,
    });
  });

  it('creates view-only invite when no role specified', async () => {
    const result = await service.createInvite('col_1', 'user_owner');

    expect(result.invite.role).toBe(CollectionRole.VIEW_ONLY);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        role: CollectionRole.VIEW_ONLY,
        inviteeUserId: null,
        inviteeEmail: null,
      }),
    );
  });

  it('rejects OWNER role requests', async () => {
    await expect(
      service.createInvite('col_1', 'user_owner', CollectionRole.OWNER),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('ignores requested higher role and keeps view-only', async () => {
    const result = await service.createInvite('col_1', 'user_owner', CollectionRole.EDITOR);

    expect(result.invite.role).toBe(CollectionRole.VIEW_ONLY);
  });

  it('rejects invite acceptance for a different user', async () => {
    repo.findById.mockResolvedValueOnce(
      buildInvite({
        inviteeUserId: 'another_user',
        invitee: {
          id: 'another_user',
          email: 'another@example.com',
          name: 'Another',
        },
      }),
    );

    await expect(service.acceptInvite('inv_1', 'user_target')).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('rejects invite acceptance when email does not match', async () => {
    repo.findById.mockResolvedValueOnce(
      buildInvite({
        inviteeUserId: null,
        inviteeEmail: 'expected@example.com',
      }),
    );

    userRepo.findById.mockResolvedValueOnce({
      id: 'user_target',
      email: 'other@example.com',
      name: 'Target',
    });

    await expect(service.acceptInvite('inv_1', 'user_target')).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
