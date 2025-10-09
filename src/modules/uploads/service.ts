import { HttpError } from '../../errors';
import { env } from '../../config';
import { createPutObjectPresign } from '../../lib/s3';
import type { CreatePresignedUploadBody } from './schemas';

export interface PresignedUploadResponse {
  key: string;
  uploadUrl: string;
  publicUrl: string;
  expiresIn: number;
  expiresAt: string;
  contentType: string;
}

export class UploadService {
  async createPresignedUpload(
    userId: string,
    body: CreatePresignedUploadBody,
  ): Promise<PresignedUploadResponse> {
    if (!env.S3_BUCKET) {
      throw new HttpError(503, 'S3 bucket is not configured');
    }

    try {
      const presigned = await createPutObjectPresign({
        userId,
        contentType: body.contentType,
        extension: body.extension,
      });

      const expiresAt = new Date(Date.now() + presigned.expiresIn * 1000).toISOString();

      return {
        key: presigned.key,
        uploadUrl: presigned.uploadUrl,
        publicUrl: presigned.publicUrl,
        expiresIn: presigned.expiresIn,
        expiresAt,
        contentType: body.contentType,
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new HttpError(500, 'Failed to create pre-signed upload URL', error);
    }
  }
}
