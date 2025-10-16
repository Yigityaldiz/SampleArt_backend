import { z } from 'zod';

const decimalPattern = /^-?\d+(\.\d+)?$/;

const decimalLike = z
  .union([
    z
      .string()
      .trim()
      .min(1, 'Must be a numeric string')
      .regex(decimalPattern, 'Must be a numeric string'),
    z.number().refine((value) => Number.isFinite(value), 'Must be a finite number'),
  ])
  .transform((value) => (typeof value === 'number' ? value.toString() : value));

export const sampleIdParamSchema = z.object({
  id: z.string().min(1, 'id is required'),
});

export const listSamplesQuerySchema = z
  .object({
    userId: z.string().min(1).optional(),
    skip: z.coerce.number().int().min(0).optional(),
    take: z.coerce.number().int().min(1).max(100).optional(),
    includeDeleted: z.coerce.boolean().optional(),
    collectionId: z.string().min(1).optional(),
  })
  .partial();

const sampleImageInputSchema = z.object({
  storageProvider: z.string().min(1),
  objectKey: z.string().min(1),
  url: z.string().url(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  blurhash: z.string().optional(),
  exif: z.record(z.string(), z.unknown()).optional(),
});

const baseSampleBodySchema = z.object({
  userId: z.string().min(1),
  title: z.string().min(1),
  materialType: z.string().min(1),
  applicationArea: z.string().optional(),
  surface: z.string().optional(),
  colorHex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  colorName: z.string().optional(),
  companyName: z.string().optional(),
  priceMinor: z.number().int().optional(),
  priceCurrency: z.string().length(3).optional(),
  quantityValue: decimalLike.optional(),
  quantityUnit: z.string().optional(),
  sizeText: z.string().optional(),
  locationLat: decimalLike.optional(),
  locationLng: decimalLike.optional(),
  notes: z.string().optional(),
  image: sampleImageInputSchema.optional(),
});

export const createSampleBodySchema = baseSampleBodySchema.extend({
  collectionIds: z.array(z.string().min(1)).max(20).optional(),
});

export const updateSampleBodySchema = baseSampleBodySchema
  .omit({ userId: true })
  .partial()
  .extend({
    isDeleted: z.boolean().optional(),
    collectionIds: z.array(z.string().min(1)).max(20).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export type SampleImageInput = z.infer<typeof sampleImageInputSchema>;
export type CreateSampleBody = z.infer<typeof createSampleBodySchema>;
export type UpdateSampleBody = z.infer<typeof updateSampleBodySchema>;
export type ListSamplesQuery = z.infer<typeof listSamplesQuerySchema>;
