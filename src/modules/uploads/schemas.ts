import { z } from 'zod';

const contentTypeSchema = z
  .string()
  .min(1, 'contentType is required')
  .regex(/^image\/[a-zA-Z0-9.+-]+$/, 'Only image content types are supported');

const extensionSchema = z
  .string()
  .min(1)
  .regex(/^[a-zA-Z0-9]+$/, 'extension must contain only alphanumeric characters')
  .optional();

export const createPresignedUploadBodySchema = z.object({
  contentType: contentTypeSchema,
  extension: extensionSchema,
});

export const createPresignedDownloadBodySchema = z.object({
  objectKey: z.string().min(1, 'objectKey is required'),
  sampleId: z.string().min(1, 'sampleId is required'),
  collectionId: z.string().min(1).optional(),
});

export type CreatePresignedUploadBody = z.infer<typeof createPresignedUploadBodySchema>;
export type CreatePresignedDownloadBody = z.infer<typeof createPresignedDownloadBodySchema>;
