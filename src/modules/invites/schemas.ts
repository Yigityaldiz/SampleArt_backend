import { CollectionRole } from '@prisma/client';
import { z } from 'zod';

export const createInviteBodySchema = z
  .object({
    role: z.nativeEnum(CollectionRole).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.role === CollectionRole.OWNER) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'OWNER role cannot be assigned via invite',
        path: ['role'],
      });
    }
  });

export const resolveInviteQuerySchema = z.object({
  token: z
    .string()
    .trim()
    .min(1, 'token is required'),
});

export const inviteIdParamSchema = z.object({
  id: z.string().min(1, 'id is required'),
});

export type CreateInviteBody = z.infer<typeof createInviteBodySchema>;
