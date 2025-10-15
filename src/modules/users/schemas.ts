import { z } from 'zod';
import type { SupportedLanguageCode } from './languages';
import { isSupportedLanguageCode } from './languages';

const languageCodeSchema = z
  .string()
  .refine((value) => isSupportedLanguageCode(value), {
    message: 'Unsupported language code',
  });

export const userIdParamSchema = z.object({
  id: z.string().min(1, 'id is required'),
});

export const listUsersQuerySchema = z
  .object({
    skip: z.coerce.number().int().min(0).default(0),
    take: z.coerce.number().int().min(1).max(100).default(25),
  })
  .partial();

export const createUserBodySchema = z.object({
  id: z.string().min(1, 'id is required'),
  email: z.string().email().optional().nullable(),
  name: z.string().trim().min(1).optional().nullable(),
  locale: languageCodeSchema.optional().nullable(),
});

export const updateUserBodySchema = z
  .object({
    email: z.string().email().optional().nullable(),
    name: z.string().trim().min(1).optional().nullable(),
    locale: languageCodeSchema.optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export const userResponseSchema = z.object({
  id: z.string(),
  email: z.string().email().nullable().optional(),
  name: z.string().nullable().optional(),
  locale: z
    .string()
    .nullable()
    .optional()
    .refine((value) => value === null || value === undefined || isSupportedLanguageCode(value), {
      message: 'Unsupported language code',
    }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const updateUserLanguageBodySchema = z.object({
  locale: languageCodeSchema,
});

export type UserResponse = {
  id: string;
  email?: string | null;
  name?: string | null;
  locale?: SupportedLanguageCode | null;
  createdAt: string;
  updatedAt: string;
};
