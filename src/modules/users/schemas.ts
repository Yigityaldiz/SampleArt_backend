import { z } from 'zod';
import type { SupportedLanguageCode } from './languages';
import { isSupportedLanguageCode } from './languages';
import {
  NAME_MIN_LENGTH,
  NAME_MAX_LENGTH,
  normalizeName,
  containsOnlyPrintableCharacters,
} from './name';

const languageCodeSchema = z.string().refine((value) => isSupportedLanguageCode(value), {
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

const nameInputSchema = z
  .string()
  .transform((value) => normalizeName(value))
  .refine((value) => value.length >= NAME_MIN_LENGTH, {
    message: `name must be at least ${NAME_MIN_LENGTH} characters`,
  })
  .refine((value) => value.length <= NAME_MAX_LENGTH, {
    message: `name must be at most ${NAME_MAX_LENGTH} characters`,
  })
  .refine((value) => containsOnlyPrintableCharacters(value), {
    message: 'name must contain only printable characters',
  });

export const createUserBodySchema = z.object({
  id: z.string().min(1, 'id is required'),
  email: z.string().email().optional().nullable(),
  name: nameInputSchema.optional().nullable(),
  locale: languageCodeSchema.optional().nullable(),
});

export const updateUserBodySchema = z
  .object({
    email: z.string().email().optional().nullable(),
    name: nameInputSchema.optional().nullable(),
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
