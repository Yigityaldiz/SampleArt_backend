import { SellerProfileStatus, type Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export type SellerProfileCreateInput = Prisma.SellerProfileUncheckedCreateInput;
export type SellerProfileUpdateInput = Prisma.SellerProfileUncheckedUpdateInput;

export class SellerApplicationRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  findById(id: string) {
    return this.db.sellerProfile.findUnique({
      where: { id },
    });
  }

  findByUserId(userId: string) {
    return this.db.sellerProfile.findUnique({
      where: { userId },
    });
  }

  create(data: SellerProfileCreateInput) {
    return this.db.sellerProfile.create({
      data,
    });
  }

  updateByUserId(userId: string, data: SellerProfileUpdateInput) {
    return this.db.sellerProfile.update({
      where: { userId },
      data,
    });
  }

  upsertByUserId(userId: string, data: SellerProfileCreateInput, update?: SellerProfileUpdateInput) {
    return this.db.sellerProfile.upsert({
      where: { userId },
      create: data,
      update: update ?? data,
    });
  }

  async list(params: {
    status?: SellerProfileStatus;
    countryCode?: string;
    search?: string;
    createdFrom?: Date;
    createdTo?: Date;
    skip?: number;
    take?: number;
  }) {
    const { status, countryCode, search, createdFrom, createdTo, skip = 0, take = 25 } = params;

    const where: Prisma.SellerProfileWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (countryCode) {
      where.countryCode = countryCode;
    }

    if (createdFrom || createdTo) {
      where.createdAt = {
        ...(createdFrom ? { gte: createdFrom } : {}),
        ...(createdTo ? { lte: createdTo } : {}),
      };
    }

    if (search) {
      const query = search.trim();

      if (query.length > 0) {
        where.OR = [
          { companyName: { contains: query, mode: 'insensitive' } },
          { brandName: { contains: query, mode: 'insensitive' } },
          {
            contactName: { contains: query, mode: 'insensitive' },
          },
        ];
      }
    }

    const [items, total] = await this.db.$transaction([
      this.db.sellerProfile.findMany({
        where,
        include: {
          user: true,
          reviewedBy: true,
        },
        orderBy: [
          { status: 'asc' },
          { createdAt: 'desc' },
        ],
        skip,
        take,
      }),
      this.db.sellerProfile.count({ where }),
    ]);

    return {
      items,
      total,
    };
  }

  findDetailedById(id: string) {
    return this.db.sellerProfile.findUnique({
      where: { id },
      include: {
        user: true,
        reviewedBy: true,
      },
    });
  }

  approve(id: string, reviewerId: string) {
    return this.db.sellerProfile.update({
      where: { id },
      data: {
        status: SellerProfileStatus.APPROVED,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: null,
      },
    });
  }

  reject(id: string, reviewerId: string, rejectionReason: string | null) {
    return this.db.sellerProfile.update({
      where: { id },
      data: {
        status: SellerProfileStatus.REJECTED,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: rejectionReason ?? null,
      },
    });
  }
}

export type SellerProfileWithUser = Prisma.SellerProfileGetPayload<{
  include: {
    user: true;
  };
}>;

export type SellerProfileAdminView = Prisma.SellerProfileGetPayload<{
  include: {
    user: true;
    reviewedBy: true;
  };
}>;
