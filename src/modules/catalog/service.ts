import { HttpError, NotFoundError } from '../../errors';
import { CatalogRepository } from './repository';
import { SellerApplicationRepository } from '../seller-applications/repository';
import { CollectionService } from '../collections/service';
import { publicUrlFor } from '../../lib/s3';

export class CatalogService {
  constructor(
    private readonly catalogRepo = new CatalogRepository(),
    private readonly sellerRepo = new SellerApplicationRepository(),
    private readonly collectionService = new CollectionService(),
  ) {}

  async listSellers(params: {
    search?: string;
    materialType?: string;
    countryCode?: string;
    skip?: number;
    take?: number;
  }) {
    const { items, total, sampleCountByUserId } = await this.catalogRepo.listSellers(params);

    return {
      items: items.map((item) => ({
        id: item.id,
        userId: item.userId,
        companyName: item.companyName,
        brandName: item.brandName,
        countryCode: item.countryCode,
        productCategories: item.productCategories,
        sampleCount: sampleCountByUserId.get(item.userId) ?? 0,
        contactName: item.contactName,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      total,
    };
  }

  async getSellerById(sellerId: string) {
    const result = await this.catalogRepo.getSellerById(sellerId);
    if (!result) {
      throw new NotFoundError('Seller not found');
    }

    const { profile, sampleStats } = result;

    return {
      id: profile.id,
      userId: profile.userId,
      companyName: profile.companyName,
      brandName: profile.brandName,
      countryCode: profile.countryCode,
      productCategories: profile.productCategories,
      contactName: profile.contactName,
      contactEmail: profile.contactEmail,
      contactPhone: profile.contactPhone,
      sampleCount: sampleStats._count?._all ?? 0,
      lastPublishedAt: sampleStats._max?.publishedAt
        ? sampleStats._max.publishedAt.toISOString()
        : null,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  private async resolveSellerUserId(sellerId: string) {
    const seller = await this.sellerRepo.findById(sellerId);
    if (!seller || seller.status !== 'APPROVED') {
      throw new NotFoundError('Seller not found');
    }

    return seller.userId;
  }

  async listSellerSamples(
    sellerId: string,
    filters: {
      search?: string;
      materialType?: string;
      colorHex?: string;
      priceMin?: number;
      priceMax?: number;
      skip?: number;
      take?: number;
    },
  ) {
    const sellerUserId = await this.resolveSellerUserId(sellerId);
    const { samples, total } = await this.catalogRepo.listSellerSamples({
      sellerUserId,
      ...filters,
    });

    return {
      items: samples.map((sample) => this.toCatalogSample(sample)),
      total,
    };
  }

  async listSamples(filters: {
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
    const params = { ...filters };

    if (filters.sellerId) {
      params.sellerId = await this.resolveSellerUserId(filters.sellerId);
    }

    const { samples, total } = await this.catalogRepo.listPublicSamples(params);

    return {
      items: samples.map((sample) => this.toCatalogSample(sample)),
      total,
    };
  }

  async saveSampleToCollection(sampleId: string, collectionId: string, userId: string) {
    const sample = await this.catalogRepo.getPublicSampleById(sampleId);
    if (!sample) {
      throw new NotFoundError('Sample not found');
    }

    await this.collectionService.addSampleForUser(collectionId, userId, sampleId);

    return this.toCatalogSample(sample);
  }

  private toCatalogSample(sample: unknown) {
    if (!sample) {
      throw new HttpError(500, 'Failed to map catalog sample');
    }

    const typed = sample as {
      id: string;
      userId: string;
      title: string;
      materialType: string;
      colorHex: string | null;
      companyName: string | null;
      priceMinor: number | null;
      priceCurrency: string | null;
      quantityValue?: { toString(): string } | string | null;
      quantityUnit: string | null;
      sizeText: string | null;
      isPublic: boolean;
      publishedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      image?: {
        objectKey: string | null;
        url: string;
        width: number | null;
        height: number | null;
      } | null;
      user?: {
        id: string;
        name: string | null;
        email: string | null;
        sellerProfile?: {
          id: string;
          brandName: string;
          companyName: string;
          countryCode?: string | null;
        } | null;
      } | null;
    };

    const quantityValue =
      typeof typed.quantityValue === 'string'
        ? typed.quantityValue
        : typed.quantityValue
        ? typed.quantityValue.toString()
        : null;

    const image =
      typed.image && (typed.image.objectKey || typed.image.url)
        ? {
            url:
              typed.image.objectKey && typed.image.objectKey.length > 0
                ? publicUrlFor(typed.image.objectKey)
                : typed.image.url,
            width: typed.image.width,
            height: typed.image.height,
          }
        : null;

    return {
      id: typed.id,
      userId: typed.userId,
      title: typed.title,
      materialType: typed.materialType,
      colorHex: typed.colorHex,
      companyName: typed.companyName,
      priceMinor: typed.priceMinor,
      priceCurrency: typed.priceCurrency,
      quantityValue,
      quantityUnit: typed.quantityUnit,
      sizeText: typed.sizeText,
      isPublic: typed.isPublic,
      publishedAt: typed.publishedAt ? typed.publishedAt.toISOString() : null,
      createdAt: typed.createdAt.toISOString(),
      updatedAt: typed.updatedAt.toISOString(),
      image,
      seller: typed.user?.sellerProfile
        ? {
            id: typed.user.sellerProfile.id,
            brandName: typed.user.sellerProfile.brandName,
            companyName: typed.user.sellerProfile.companyName,
            countryCode: typed.user.sellerProfile.countryCode ?? null,
          }
        : null,
    };
  }
}
