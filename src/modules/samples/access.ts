import { HttpError } from '../../errors';
import { CollectionRepository } from '../collections/repository';

const defaultCollectionRepo = new CollectionRepository();

export interface EnsureSampleAccessParams {
  userId: string;
  sampleOwnerId: string;
  sampleId: string;
  collectionId?: string;
  isAdmin?: boolean;
  collectionRepo?: CollectionRepository;
}

export const ensureSampleAccess = async ({
  userId,
  sampleOwnerId,
  sampleId,
  collectionId,
  isAdmin = false,
  collectionRepo = defaultCollectionRepo,
}: EnsureSampleAccessParams): Promise<void> => {
  if (isAdmin || sampleOwnerId === userId) {
    return;
  }

  const isMember = await collectionRepo.isUserMemberOfSample({
    userId,
    sampleId,
    collectionId,
  });

  if (!isMember) {
    throw new HttpError(403, 'Forbidden');
  }
};
