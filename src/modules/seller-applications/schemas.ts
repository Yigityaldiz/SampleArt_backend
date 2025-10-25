import { z } from 'zod';
import type { SellerProfileStatus } from '@prisma/client';

const notEmptyString = (field: string, min = 2, max = 120) =>
  z
    .string()
    .trim()
    .min(min, `${field} must be at least ${min} characters`)
    .max(max, `${field} must be at most ${max} characters`);

const phoneRegex = /^[\d\s()+\-]{5,20}$/;

const companyNameSchema = notEmptyString('companyName', 2, 160);
const brandNameSchema = notEmptyString('brandName', 2, 120);
const contactNameSchema = notEmptyString('contactName', 2, 120);
const taxIdSchema = notEmptyString('taxId', 3, 50);

const productCategorySchema = z
  .string()
  .trim()
  .min(2, 'product category must be at least 2 characters')
  .max(60, 'product category must be at most 60 characters')
  .refine((value) => value.length > 0, 'product category is required');

const countryCodeSchema = z
  .string()
  .length(2, 'countryCode must be ISO 3166-1 alpha-2')
  .transform((value) => value.toUpperCase());

const baseSellerApplicationSchema = z.object({
  companyName: companyNameSchema,
  brandName: brandNameSchema,
  productCategories: z
    .array(productCategorySchema)
    .nonempty('productCategories must contain at least one category')
    .max(20, 'productCategories must contain at most 20 categories'),
  countryCode: countryCodeSchema,
  contactName: contactNameSchema,
  contactPhone: z
    .string()
    .min(5, 'contactPhone must be at least 5 characters')
    .max(25, 'contactPhone must be at most 25 characters')
    .refine((value) => phoneRegex.test(value), 'contactPhone has invalid format'),
  contactEmail: z
    .string()
    .email('contactEmail must be a valid email address')
    .max(160, 'contactEmail must be at most 160 characters'),
  taxId: taxIdSchema,
});

export const createSellerApplicationBodySchema = baseSellerApplicationSchema;

export const updateSellerApplicationBodySchema = baseSellerApplicationSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  {
    message: 'At least one field is required',
  },
);

export const sellerApplicationResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  companyName: z.string(),
  brandName: z.string(),
  productCategories: z.array(z.string()),
  countryCode: z.string(),
  contactName: z.string(),
  contactPhone: z.string(),
  contactEmail: z.string().email(),
  taxId: z.string(),
  status: z.string(),
  reviewedById: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SellerApplicationStatus = SellerProfileStatus;
