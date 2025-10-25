import { z } from 'zod';

export const listCatalogSellersQuerySchema = z.object({
  search: z.string().min(1).max(120).optional(),
  materialType: z.string().min(1).max(60).optional(),
  countryCode: z
    .string()
    .length(2, 'countryCode must be ISO alpha-2')
    .transform((value) => value.toUpperCase())
    .optional(),
  skip: z.coerce.number().int().min(0).default(0),
  take: z.coerce.number().int().min(1).max(50).default(20),
});

export const catalogSellerIdParamSchema = z.object({
  sellerId: z.string().cuid({ message: 'sellerId must be a valid CUID' }),
});

export const listSellerSamplesQuerySchema = z.object({
  search: z.string().min(1).max(120).optional(),
  materialType: z.string().min(1).max(60).optional(),
  colorHex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'colorHex must be a hex color like #FFFFFF')
    .optional(),
  priceMin: z.coerce.number().int().min(0).optional(),
  priceMax: z.coerce.number().int().min(0).optional(),
  skip: z.coerce.number().int().min(0).default(0),
  take: z.coerce.number().int().min(1).max(100).default(25),
});

export const listCatalogSamplesQuerySchema = listSellerSamplesQuerySchema.extend({
  sellerId: z.string().cuid().optional(),
  countryCode: z
    .string()
    .length(2, 'countryCode must be ISO alpha-2')
    .transform((value) => value.toUpperCase())
    .optional(),
});

export const saveCatalogSampleBodySchema = z.object({
  collectionId: z.string().min(1, 'collectionId is required'),
});
