import { Prisma, CollectionRole, type ProfileStatus } from '@prisma/client';
import { HttpError, NotFoundError } from '../../errors';
import {
  CollectionRepository,
  type CollectionWithRelations,
  type CollectionCreateData,
  type CollectionUpdateData,
  type CollectionSampleWithRelations,
  type CollectionMemberWithUser,
  type CollectionMemberCreateData,
} from './repository';
import type {
  CreateCollectionBody,
  UpdateCollectionBody,
  ListCollectionsQuery,
  ReorderCollectionSamplesBody,
} from './schemas';
import { SampleRepository } from '../samples/repository';
import { UserRepository } from '../users/repository';
import { sanitizeOptionalName } from '../users/name';

const isPrismaKnownRequestError = (error: unknown): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError;

export interface CollectionSampleSummary {
  sampleId: string;
  position: number;
  addedAt: string;
  sample?: {
    id: string;
    userId: string;
    title: string;
    materialType: string;
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

export interface CollectionResponse {
  id: string;
  userId: string;
  name: string;
  samples: CollectionSampleSummary[];
  createdAt: string;
  updatedAt: string;
}

const mapSample = (item: CollectionSampleWithRelations): CollectionSampleSummary => ({
  sampleId: item.sampleId,
  position: item.position,
  addedAt: item.addedAt.toISOString(),
  sample: item.sample
    ? {
        id: item.sample.id,
        userId: item.sample.userId,
        title: item.sample.title,
        materialType: item.sample.materialType,
        isDeleted: item.sample.isDeleted,
        createdAt: item.sample.createdAt.toISOString(),
        updatedAt: item.sample.updatedAt.toISOString(),
      }
    : undefined,
});

const toResponse = (collection: CollectionWithRelations): CollectionResponse => ({
  id: collection.id,
  userId: collection.userId,
  name: collection.name,
  samples: collection.samples.map(mapSample),
  createdAt: collection.createdAt.toISOString(),
  updatedAt: collection.updatedAt.toISOString(),
});

type MemberRole = CollectionRole;

const MEMBER_ROLE_VALUES: MemberRole[] = [
  CollectionRole.OWNER,
  CollectionRole.EDITOR,
  CollectionRole.VIEW_ONLY,
];

const MANAGE_CONTENT_ROLES: MemberRole[] = [CollectionRole.OWNER, CollectionRole.EDITOR];
const MANAGE_META_ROLES: MemberRole[] = [CollectionRole.OWNER];

type NonOwnerMemberRole = Extract<MemberRole, 'EDITOR' | 'VIEW_ONLY'>;

const isAssignableMemberRole = (role: MemberRole): role is NonOwnerMemberRole =>
  role === CollectionRole.EDITOR || role === CollectionRole.VIEW_ONLY;

const toDisplayName = (params: {
  id: string;
  email: string | null | undefined;
  name: string | null | undefined;
}): string => {
  const sanitizedName: string | null | undefined = sanitizeOptionalName(params.name);
  if (typeof sanitizedName === 'string' && sanitizedName.length > 0) {
    return sanitizedName;
  }

  const email = typeof params.email === 'string' ? params.email : null;
  if (email) {
    const prefix = email.split('@')[0]?.trim();
    if (prefix) {
      return prefix;
    }
  }

  return `user-${params.id.slice(0, 6)}`;
};

export interface CollectionMemberResponse {
  id: string;
  collectionId: string;
  userId: string;
  role: MemberRole;
  user: {
    id: string;
    email: string | null;
    name: string | null;
    displayName: string;
    profileStatus: ProfileStatus;
    locale: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

const toMemberResponse = (member: CollectionMemberWithUser): CollectionMemberResponse => {
  const email = typeof member.user.email === 'string' ? member.user.email : null;
  const sanitizedName: string | null | undefined = sanitizeOptionalName(member.user.name);

  return {
    id: member.id,
    collectionId: member.collectionId,
    userId: member.userId,
    role: member.role,
    user: {
      id: member.user.id,
      email,
      name: sanitizedName ?? null,
      displayName: toDisplayName({ id: member.user.id, email, name: sanitizedName ?? null }),
      profileStatus: member.user.profileStatus,
      locale: typeof member.user.locale === 'string' ? member.user.locale : null,
    },
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
  };
};

export class CollectionService {
  constructor(
    private readonly repo = new CollectionRepository(),
    private readonly sampleRepo = new SampleRepository(),
    private readonly userRepo = new UserRepository(),
  ) {}

  async list(params: ListCollectionsQuery = {}): Promise<CollectionResponse[]> {
    const { includeSamples: _includeSamples, ...rest } = params;
    void _includeSamples;
    const collections = await this.repo.list(rest);
    return collections.map(toResponse);
  }

  async getById(id: string): Promise<CollectionResponse> {
    const collection = await this.repo.findById(id);
    if (!collection) {
      throw new NotFoundError('Collection not found');
    }

    return toResponse(collection);
  }

  async getForUser(collectionId: string, userId: string): Promise<CollectionResponse> {
    const { collection } = await this.ensureCollectionRole(
      collectionId,
      userId,
      MEMBER_ROLE_VALUES,
    );
    return toResponse(collection);
  }

  async create(data: CreateCollectionBody & { userId: string }): Promise<CollectionResponse> {
    const payload: CollectionCreateData = {
      userId: data.userId,
      name: data.name,
    };

    const created = await this.repo.create(payload);
    return toResponse(created);
  }

  async updateForUser(
    id: string,
    userId: string,
    data: UpdateCollectionBody,
  ): Promise<CollectionResponse> {
    await this.ensureCollectionRole(id, userId, MANAGE_META_ROLES);

    try {
      const payload: CollectionUpdateData = {
        ...data,
      };
      const updated = await this.repo.update(id, payload);
      return toResponse(updated);
    } catch (error: unknown) {
      if (isPrismaKnownRequestError(error) && error.code === 'P2025') {
        throw new NotFoundError('Collection not found');
      }
      throw (error instanceof Error ? error : new Error(String(error)));
    }
  }

  async deleteForUser(id: string, userId: string): Promise<void> {
    await this.ensureCollectionRole(id, userId, MANAGE_META_ROLES);

    try {
      await this.repo.delete(id);
    } catch (error: unknown) {
      if (isPrismaKnownRequestError(error) && error.code === 'P2025') {
        throw new NotFoundError('Collection not found');
      }
      throw (error instanceof Error ? error : new Error(String(error)));
    }
  }

  async addSampleForUser(
    collectionId: string,
    userId: string,
    sampleId: string,
  ): Promise<CollectionSampleSummary> {
    await this.ensureCollectionRole(collectionId, userId, MANAGE_CONTENT_ROLES);
    return this.addSample(collectionId, sampleId);
  }

  async removeSampleForUser(
    collectionId: string,
    userId: string,
    sampleId: string,
  ): Promise<CollectionResponse> {
    await this.ensureCollectionRole(collectionId, userId, MANAGE_CONTENT_ROLES);
    return this.removeSample(collectionId, sampleId);
  }

  async reorderSamplesForUser(
    collectionId: string,
    userId: string,
    body: ReorderCollectionSamplesBody,
  ): Promise<CollectionResponse> {
    await this.ensureCollectionRole(collectionId, userId, MANAGE_CONTENT_ROLES);
    return this.reorderSamples(collectionId, body);
  }

  async addSample(collectionId: string, sampleId: string): Promise<CollectionSampleSummary> {
    const collection = await this.repo.findById(collectionId);
    if (!collection) {
      throw new NotFoundError('Collection not found');
    }

    const existing = await this.repo.getCollectionSample(collectionId, sampleId);
    if (existing) {
      throw new HttpError(409, 'Sample already exists in collection');
    }

    const sample = await this.sampleRepo.findById(sampleId);
    if (!sample) {
      throw new NotFoundError('Sample not found');
    }

    const sampleOwnerMembership = await this.repo.findMembership(collectionId, sample.userId);
    if (!sampleOwnerMembership) {
      throw new HttpError(403, 'Sample owner is not a member of the collection');
    }

    const position = await this.repo.getNextSamplePosition(collectionId);
    const created = await this.repo.createCollectionSample(collectionId, sampleId, position);
    return mapSample(created);
  }

  async removeSample(collectionId: string, sampleId: string): Promise<CollectionResponse> {
    const collection = await this.repo.findById(collectionId);
    if (!collection) {
      throw new NotFoundError('Collection not found');
    }

    const existing = collection.samples.find((item) => item.sampleId === sampleId);
    if (!existing) {
      throw new NotFoundError('Sample is not attached to the collection');
    }

    await this.repo.removeCollectionSample(collectionId, sampleId);
    await this.normalizePositions(collectionId);

    const updated = await this.repo.findById(collectionId);
    if (!updated) {
      throw new NotFoundError('Collection not found');
    }

    return toResponse(updated);
  }

  async reorderSamples(
    collectionId: string,
    body: ReorderCollectionSamplesBody,
  ): Promise<CollectionResponse> {
    const collection = await this.repo.findById(collectionId);
    if (!collection) {
      throw new NotFoundError('Collection not found');
    }

    const existingIds = new Set(collection.samples.map((item) => item.sampleId));

    const uniqueProvided = new Set(body.sampleIds);
    if (uniqueProvided.size !== body.sampleIds.length) {
      throw new HttpError(400, 'sampleIds must be unique');
    }

    for (const sampleId of body.sampleIds) {
      if (!existingIds.has(sampleId)) {
        throw new HttpError(400, `Sample ${sampleId} is not part of the collection`);
      }
    }

    const remaining = collection.samples
      .map((item) => item.sampleId)
      .filter((sampleId) => !uniqueProvided.has(sampleId));

    const ordered = [...body.sampleIds, ...remaining];

    const updates = ordered.map((sampleId, index) => ({ sampleId, position: index + 1 }));
    await this.repo.updateSamplePositions(collectionId, updates);

    const updated = await this.repo.findById(collectionId);
    if (!updated) {
      throw new NotFoundError('Collection not found');
    }

    return toResponse(updated);
  }

  async listMembers(collectionId: string, userId: string): Promise<CollectionMemberResponse[]> {
    await this.ensureCollectionRole(collectionId, userId, MEMBER_ROLE_VALUES);
    const members = await this.repo.listMembers(collectionId);
    return members.map(toMemberResponse);
  }

  async inviteMember(
    collectionId: string,
    userId: string,
    payload: { name: string; role: MemberRole },
  ): Promise<CollectionMemberResponse> {
    if (!isAssignableMemberRole(payload.role)) {
      throw new HttpError(400, 'Role must be EDITOR or VIEW_ONLY');
    }

    await this.ensureCollectionRole(collectionId, userId, MANAGE_META_ROLES);

    const sanitizedTargetName = sanitizeOptionalName(payload.name);
    if (!sanitizedTargetName) {
      throw new HttpError(400, 'Valid member name is required');
    }

    const existingUser = await this.userRepo.findByName(sanitizedTargetName);
    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    const membershipData: CollectionMemberCreateData = {
      collectionId,
      userId: existingUser.id,
      role: payload.role,
    };

    try {
      const created = await this.repo.createMembership(membershipData);
      return toMemberResponse(created);
    } catch (error: unknown) {
      if (isPrismaKnownRequestError(error) && error.code === 'P2002') {
        throw new HttpError(409, 'User is already a member of this collection');
      }
      throw (error instanceof Error ? error : new Error(String(error)));
    }
  }

  async updateMemberRole(
    collectionId: string,
    userId: string,
    memberId: string,
    role: MemberRole,
  ): Promise<CollectionMemberResponse> {
    if (!isAssignableMemberRole(role)) {
      throw new HttpError(400, 'Role must be EDITOR or VIEW_ONLY');
    }

    await this.ensureCollectionRole(collectionId, userId, MANAGE_META_ROLES);

    const membership = await this.repo.findMembershipById(memberId);
    if (!membership || membership.collectionId !== collectionId) {
      throw new NotFoundError('Membership not found');
    }

    if (membership.role === CollectionRole.OWNER) {
      throw new HttpError(400, 'Owner role cannot be changed');
    }

    if (membership.role === role) {
      return toMemberResponse(membership);
    }

    const updated = await this.repo.updateMembershipRole(memberId, role);
    return toMemberResponse(updated);
  }

  async removeMember(collectionId: string, userId: string, memberId: string): Promise<void> {
    await this.ensureCollectionRole(collectionId, userId, MANAGE_META_ROLES);

    const membership = await this.repo.findMembershipById(memberId);
    if (!membership || membership.collectionId !== collectionId) {
      throw new NotFoundError('Membership not found');
    }

    if (membership.role === CollectionRole.OWNER) {
      throw new HttpError(400, 'Cannot remove the owner from the collection');
    }

    await this.repo.deleteMembership(memberId);
  }

  private async ensureCollectionRole(
    collectionId: string,
    userId: string,
    allowedRoles: MemberRole[],
  ): Promise<{ collection: CollectionWithRelations; membership: CollectionMemberWithUser }> {
    const collection = await this.repo.findById(collectionId);
    if (!collection) {
      throw new NotFoundError('Collection not found');
    }

    const membership = await this.repo.findMembership(collectionId, userId);
    if (!membership) {
      throw new HttpError(403, 'Forbidden');
    }

    if (!allowedRoles.includes(membership.role)) {
      throw new HttpError(403, 'Insufficient permissions');
    }

    return { collection, membership };
  }

  private async normalizePositions(collectionId: string) {
    const collection = await this.repo.findById(collectionId);
    if (!collection) {
      return;
    }

    const sorted = [...collection.samples].sort((a, b) => a.position - b.position);
    const updates = sorted.map((item, index) => ({ sampleId: item.sampleId, position: index + 1 }));
    await this.repo.updateSamplePositions(collectionId, updates);
  }
}
