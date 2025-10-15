import { z } from 'zod';
import type { SupportedLanguageCode } from './languages';
import { isSupportedLanguageCode } from './languages';
import {
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  containsOnlyPrintableCharacters,
  normalizeName,
} from './name';

const languageCodeSchema = z
  .string()
  .refine((value) => isSupportedLanguageCode(value), {
    message: 'Unsupported language code',
  });

export const profileStatusSchema = z.enum(['INCOMPLETE', 'COMPLETE']);

const normalizedNameSchema = z
  .string()
  .transform((value) => normalizeName(value))
  .pipe(
    z
      .string()
      .min(NAME_MIN_LENGTH, `name must be at least ${NAME_MIN_LENGTH} characters`)
      .max(NAME_MAX_LENGTH, `name must be at most ${NAME_MAX_LENGTH} characters`)
      .refine((value) => containsOnlyPrintableCharacters(value), {
        message: 'name must contain printable characters only',
      }),
  );

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
  name: normalizedNameSchema.optional().nullable(),
  locale: languageCodeSchema.optional().nullable(),
});

export const updateUserBodySchema = z
  .object({
    email: z.string().email().optional().nullable(),
    name: normalizedNameSchema.optional().nullable(),
    locale: languageCodeSchema.optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export const userResponseSchema = z.object({
  id: z.string(),
  email: z.string().email().nullable().optional(),
  name: z.string().nullable().optional(),
  displayName: z.string(),
  profileStatus: profileStatusSchema,
  requiredFields: z.array(z.string()),
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
  displayName: string;
  profileStatus: z.infer<typeof profileStatusSchema>;
  requiredFields: string[];
  locale?: SupportedLanguageCode | null;
  createdAt: string;
  updatedAt: string;
};
