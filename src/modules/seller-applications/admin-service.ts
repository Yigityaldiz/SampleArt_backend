import { SellerProfileStatus, type SellerProfile } from '@prisma/client';
import { HttpError, NotFoundError } from '../../errors';
import { SellerApplicationRepository } from './repository';
import { auditLogService } from '../audit';
import { logger } from '../../lib/logger';

export interface SellerApplicationListParams {
  status?: SellerProfileStatus;
  countryCode?: string;
  search?: string;
  createdFrom?: Date;
  createdTo?: Date;
  skip?: number;
  take?: number;
}

export class SellerApplicationAdminService {
  constructor(private readonly repository = new SellerApplicationRepository()) {}

  list(params: SellerApplicationListParams) {
    return this.repository.list(params);
  }

  async getById(id: string) {
    const profile = await this.repository.findDetailedById(id);
    if (!profile) {
      throw new NotFoundError('Seller application not found');
    }

    return profile;
  }

  private async ensureReviewable(id: string): Promise<SellerProfile> {
    const profile = await this.repository.findById(id);
    if (!profile) {
      throw new NotFoundError('Seller application not found');
    }

    if (profile.status === SellerProfileStatus.APPROVED) {
      throw new HttpError(409, 'Application already approved');
    }

    if (profile.status === SellerProfileStatus.REJECTED) {
      throw new HttpError(409, 'Application already rejected');
    }

    return profile;
  }

  async approve(id: string, reviewerId: string) {
    const profile = await this.ensureReviewable(id);
    const updated = await this.repository.approve(id, reviewerId);

    await auditLogService.log({
      actorId: reviewerId,
      action: 'SELLER_APPLICATION_APPROVED',
      targetUserId: profile.userId,
      metadata: {
        sellerProfileId: id,
        companyName: profile.companyName,
      },
    });

    logger.info(
      {
        sellerProfileId: id,
        reviewerId,
        userId: profile.userId,
        companyName: profile.companyName,
      },
      'Seller application approved',
    );

    return updated;
  }

  async reject(id: string, reviewerId: string, rejectionReason: string | null) {
    const profile = await this.ensureReviewable(id);

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      throw new HttpError(400, 'Rejection reason is required');
    }

    const updated = await this.repository.reject(id, reviewerId, rejectionReason.trim());

    await auditLogService.log({
      actorId: reviewerId,
      action: 'SELLER_APPLICATION_REJECTED',
      targetUserId: profile.userId,
      metadata: {
        sellerProfileId: id,
        companyName: profile.companyName,
        reason: rejectionReason,
      },
    });

    logger.info(
      {
        sellerProfileId: id,
        reviewerId,
        userId: profile.userId,
        companyName: profile.companyName,
        reason: rejectionReason,
      },
      'Seller application rejected',
    );

    return updated;
  }
}
