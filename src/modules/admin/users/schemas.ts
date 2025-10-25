import { z } from 'zod';

export const listAdminUsersQuerySchema = z.object({
  search: z.string().min(1).max(120).optional(),
  skip: z.coerce.number().int().min(0).default(0),
  take: z.coerce.number().int().min(1).max(100).default(25),
});
