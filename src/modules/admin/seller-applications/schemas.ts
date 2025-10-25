import { SellerProfileStatus } from '@prisma/client';
import { z } from 'zod';

export const adminSellerApplicationIdParamSchema = z.object({
  applicationId: z.string().cuid({ message: 'applicationId must be a valid CUID' }),
});

export const listAdminSellerApplicationsQuerySchema = z.object({
  status: z.nativeEnum(SellerProfileStatus).optional(),
  countryCode: z
    .string()
    .length(2, 'countryCode must be ISO alpha-2')
    .transform((value) => value.toUpperCase())
    .optional(),
  search: z.string().min(1).max(120).optional(),
  createdFrom: z
    .string()
    .datetime({ message: 'createdFrom must be an ISO8601 datetime string' })
    .optional(),
  createdTo: z
    .string()
    .datetime({ message: 'createdTo must be an ISO8601 datetime string' })
    .optional(),
  skip: z.coerce.number().int().min(0).default(0),
  take: z.coerce.number().int().min(1).max(100).default(25),
});

export const rejectSellerApplicationBodySchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'reason must be at least 5 characters')
    .max(500, 'reason must be at most 500 characters'),
});
