import { SellerProfileStatus, type Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export type CatalogSeller = Prisma.SellerProfileGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        email: true;
        name: true;
      };
    };
  };
}>;

export type CatalogSample = Prisma.SampleGetPayload<{
  include: {
    image: true;
    user: {
      select: {
        id: true;
        name: true;
        email: true;
        sellerProfile: true;
      };
    };
  };
}>;

export class CatalogRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async listSellers(params: {
    search?: string;
    materialType?: string;
    countryCode?: string;
    skip?: number;
    take?: number;
  }) {
    const { search, materialType, countryCode, skip = 0, take = 20 } = params;

    const where: Prisma.SellerProfileWhereInput = {
      status: SellerProfileStatus.APPROVED,
    };

    if (search && search.trim().length > 0) {
      const query = search.trim();
      where.OR = [
        { companyName: { contains: query, mode: 'insensitive' } },
        { brandName: { contains: query, mode: 'insensitive' } },
        { contactName: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (countryCode) {
      where.countryCode = countryCode;
    }

    if (materialType) {
      where.user = {
        samples: {
          some: {
            materialType,
            isPublic: true,
            isDeleted: false,
          },
        },
      };
    } else {
      where.user = {
        samples: {
          some: {
            isPublic: true,
            isDeleted: false,
          },
        },
      };
    }

    const [profiles, total] = await this.db.$transaction([
      this.db.sellerProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: [
          { createdAt: 'desc' },
          { brandName: 'asc' },
        ],
        skip,
        take,
      }),
      this.db.sellerProfile.count({ where }),
    ]);

    const sellerUserIds = profiles.map((profile) => profile.userId);

    const sampleCounts = sellerUserIds.length
      ? await this.db.sample.groupBy({
          by: ['userId'],
          where: {
            userId: { in: sellerUserIds },
            isPublic: true,
            isDeleted: false,
          },
          _count: {
            _all: true,
          },
        })
      : [];

    const countMap = new Map<string, number>();
    for (const item of sampleCounts) {
      countMap.set(item.userId, item._count._all);
    }

    return {
      items: profiles,
      total,
      sampleCountByUserId: countMap,
    };
  }

  async getSellerById(id: string) {
    const profile = await this.db.sellerProfile.findUnique({
      where: {
        id,
        status: SellerProfileStatus.APPROVED,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!profile) {
      return null;
    }

    const [sampleStats] = await this.db.$transaction([
      this.db.sample.aggregate({
        where: {
          userId: profile.userId,
          isPublic: true,
          isDeleted: false,
        },
        _count: {
          _all: true,
        },
        _max: {
          publishedAt: true,
        },
      }),
    ]);

    return {
      profile,
      sampleStats,
    };
  }

  async listSellerSamples(params: {
    sellerUserId: string;
    search?: string;
    materialType?: string;
    colorHex?: string;
    priceMin?: number;
    priceMax?: number;
    skip?: number;
    take?: number;
  }) {
    const { sellerUserId, search, materialType, colorHex, priceMin, priceMax, skip = 0, take = 25 } =
      params;

    const where: Prisma.SampleWhereInput = {
      userId: sellerUserId,
      isPublic: true,
      isDeleted: false,
    };

    if (search && search.trim().length > 0) {
      const query = search.trim();
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { materialType: { contains: query, mode: 'insensitive' } },
        { companyName: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (materialType) {
      where.materialType = materialType;
    }

    if (colorHex) {
      where.colorHex = colorHex;
    }

    if (typeof priceMin === 'number' || typeof priceMax === 'number') {
      where.priceMinor = {
        ...(typeof priceMin === 'number' ? { gte: priceMin } : {}),
        ...(typeof priceMax === 'number' ? { lte: priceMax } : {}),
      };
    }

    const [samples, total] = await this.db.$transaction([
      this.db.sample.findMany({
        where,
        include: {
          image: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              sellerProfile: true,
            },
          },
        },
        orderBy: [
          { publishedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take,
      }),
      this.db.sample.count({ where }),
    ]);

    return { samples, total };
  }

  async listPublicSamples(params: {
    search?: string;
    materialType?: string;
    colorHex?: string;
    priceMin?: number;
    priceMax?: number;
    sellerId?: string;
    countryCode?: string;
    skip?: number;
    take?: number;
  }) {
    const { search, materialType, colorHex, priceMin, priceMax, sellerId, countryCode, skip = 0, take = 25 } =
      params;

    const where: Prisma.SampleWhereInput = {
      isPublic: true,
      isDeleted: false,
      user: {
        sellerProfile: {
          status: SellerProfileStatus.APPROVED,
          ...(countryCode ? { countryCode } : {}),
        },
      },
    };

    if (sellerId) {
      where.userId = sellerId;
    }

    if (search && search.trim().length > 0) {
      const query = search.trim();
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { materialType: { contains: query, mode: 'insensitive' } },
        { companyName: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (materialType) {
      where.materialType = materialType;
    }

    if (colorHex) {
      where.colorHex = colorHex;
    }

    if (typeof priceMin === 'number' || typeof priceMax === 'number') {
      where.priceMinor = {
        ...(typeof priceMin === 'number' ? { gte: priceMin } : {}),
        ...(typeof priceMax === 'number' ? { lte: priceMax } : {}),
      };
    }

    const [samples, total] = await this.db.$transaction([
      this.db.sample.findMany({
        where,
        include: {
          image: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              sellerProfile: {
                select: {
                  id: true,
                  brandName: true,
                  companyName: true,
                  countryCode: true,
                },
              },
            },
          },
        },
        orderBy: [
          { publishedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take,
      }),
      this.db.sample.count({ where }),
    ]);

    return { samples, total };
  }

  getPublicSampleById(id: string) {
    return this.db.sample.findFirst({
      where: {
        id,
        isPublic: true,
        isDeleted: false,
        user: {
          sellerProfile: {
            status: SellerProfileStatus.APPROVED,
          },
        },
      },
      include: {
        image: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            sellerProfile: {
              select: {
                id: true,
                brandName: true,
              },
            },
          },
        },
      },
    });
  }
}
