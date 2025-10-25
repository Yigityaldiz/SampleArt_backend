import { SellerProfileStatus } from '@prisma/client';
import type { SellerProfile } from '@prisma/client';
import { HttpError, NotFoundError } from '../../errors';
import {
  SellerApplicationRepository,
  type SellerProfileCreateInput,
  type SellerProfileUpdateInput,
} from './repository';

export interface SellerApplicationPayload {
  companyName: string;
  brandName: string;
  productCategories: string[];
  countryCode: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  taxId: string;
}

export class SellerApplicationService {
  constructor(private readonly repository = new SellerApplicationRepository()) {}

  async submit(userId: string, payload: SellerApplicationPayload): Promise<SellerProfile> {
    const existing = await this.repository.findByUserId(userId);
    const baseData: SellerProfileCreateInput = {
      userId,
      companyName: payload.companyName,
      brandName: payload.brandName,
      productCategories: payload.productCategories,
      countryCode: payload.countryCode,
      contactName: payload.contactName,
      contactPhone: payload.contactPhone,
      contactEmail: payload.contactEmail,
      taxId: payload.taxId,
      status: SellerProfileStatus.PENDING,
      reviewedById: null,
      reviewedAt: null,
      rejectionReason: null,
    };

    if (!existing) {
      return this.repository.create(baseData);
    }

    if (existing.status === SellerProfileStatus.APPROVED) {
      throw new HttpError(409, 'Seller profile already approved');
    }

    const { userId: _userId, ...updateData } = baseData;
    return this.repository.updateByUserId(userId, updateData);
  }

  async getForUser(userId: string): Promise<SellerProfile> {
    const profile = await this.repository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError('Seller profile not found');
    }

    return profile;
  }

  async updatePending(userId: string, payload: Partial<SellerApplicationPayload>): Promise<SellerProfile> {
    const existing = await this.repository.findByUserId(userId);
    if (!existing) {
      throw new NotFoundError('Seller profile not found');
    }

    if (existing.status === SellerProfileStatus.APPROVED) {
      throw new HttpError(409, 'Seller profile already approved');
    }

    const data: SellerProfileUpdateInput = {};

    if (payload.companyName !== undefined) {
      data.companyName = payload.companyName;
    }
    if (payload.brandName !== undefined) {
      data.brandName = payload.brandName;
    }
    if (payload.productCategories !== undefined) {
      data.productCategories = payload.productCategories;
    }
    if (payload.countryCode !== undefined) {
      data.countryCode = payload.countryCode;
    }
    if (payload.contactName !== undefined) {
      data.contactName = payload.contactName;
    }
    if (payload.contactPhone !== undefined) {
      data.contactPhone = payload.contactPhone;
    }
    if (payload.contactEmail !== undefined) {
      data.contactEmail = payload.contactEmail;
    }
    if (payload.taxId !== undefined) {
      data.taxId = payload.taxId;
    }

    if (existing.status === SellerProfileStatus.REJECTED) {
      data.status = SellerProfileStatus.PENDING;
      data.reviewedAt = null;
      data.reviewedById = null;
      data.rejectionReason = null;
    }

    return this.repository.updateByUserId(userId, data);
  }
}
