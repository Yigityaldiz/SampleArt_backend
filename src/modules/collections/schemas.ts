import { z } from 'zod';

export const collectionIdParamSchema = z.object({
  id: z.string().min(1, 'id is required'),
});

export const collectionSampleParamSchema = z.object({
  sampleId: z.string().min(1, 'sampleId is required'),
});

export const listCollectionsQuerySchema = z
  .object({
    userId: z.string().min(1).optional(),
    skip: z.coerce.number().int().min(0).optional(),
    take: z.coerce.number().int().min(1).max(100).optional(),
    includeSamples: z.coerce.boolean().optional(),
  })
  .partial();

export const createCollectionBodySchema = z.object({
  name: z.string().min(1, 'name is required').max(120),
  userId: z.string().min(1).optional(),
});

export const updateCollectionBodySchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export const addCollectionSampleBodySchema = z.object({
  sampleId: z.string().min(1, 'sampleId is required'),
});

export const reorderCollectionSamplesBodySchema = z.object({
  sampleIds: z.array(z.string().min(1)).min(1, 'sampleIds must include at least one entry'),
});

export const memberRoleSchema = z.enum(['EDITOR', 'VIEW_ONLY']);

export const updateCollectionMemberBodySchema = z.object({
  role: memberRoleSchema,
});

export const collectionMemberIdParamSchema = z.object({
  memberId: z.string().min(1, 'memberId is required'),
});

export type ListCollectionsQuery = z.infer<typeof listCollectionsQuerySchema>;
export type CreateCollectionBody = z.infer<typeof createCollectionBodySchema>;
export type UpdateCollectionBody = z.infer<typeof updateCollectionBodySchema>;
export type AddCollectionSampleBody = z.infer<typeof addCollectionSampleBodySchema>;
export type ReorderCollectionSamplesBody = z.infer<typeof reorderCollectionSamplesBodySchema>;
export type UpdateCollectionMemberBody = z.infer<typeof updateCollectionMemberBodySchema>;
