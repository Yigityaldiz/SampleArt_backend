import { HttpError } from '../../errors';
import { env } from '../../config';
import { createPutObjectPresign, createGetObjectPresign } from '../../lib/s3';
import { SampleRepository } from '../samples/repository';
import { CollectionRepository } from '../collections/repository';
import { ensureSampleAccess } from '../samples/access';
import type {
  CreatePresignedDownloadBody,
  CreatePresignedUploadBody,
} from './schemas';

export interface PresignedUploadResponse {
  key: string;
  uploadUrl: string;
  publicUrl: string;
  expiresIn: number;
  expiresAt: string;
  contentType: string;
}

export interface PresignedDownloadResponse {
  key: string;
  downloadUrl: string;
  expiresIn: number;
  expiresAt: string;
}

export class UploadService {
  constructor(
    private readonly sampleRepo = new SampleRepository(),
    private readonly collectionRepo = new CollectionRepository(),
  ) {}

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

  async createPresignedDownload(
    userId: string,
    body: CreatePresignedDownloadBody,
    options: { allowAllKeys?: boolean } = {},
  ): Promise<PresignedDownloadResponse> {
    if (!env.S3_BUCKET) {
      throw new HttpError(503, 'S3 bucket is not configured');
    }

    const key = body.objectKey.trim();
    const basePrefix = 'samples/';
    const allowedPrefix = `samples/${userId}/`;
    const sampleId = body.sampleId.trim();
    const collectionId = body.collectionId?.trim();
    const { allowAllKeys = false } = options;

    if (!key.startsWith(basePrefix)) {
      throw new HttpError(400, 'Invalid object key');
    }

    if (!allowAllKeys && !key.startsWith(allowedPrefix)) {
      const sample = await this.sampleRepo.findById(sampleId);
      if (!sample || !sample.image || sample.image.objectKey !== key) {
        throw new HttpError(404, 'Sample image not found for provided object key');
      }

      await ensureSampleAccess({
        userId,
        sampleOwnerId: sample.userId,
        sampleId,
        collectionId,
        collectionRepo: this.collectionRepo,
      }).catch((error) => {
        if (error instanceof HttpError && error.statusCode === 403) {
          throw new HttpError(403, 'Access to object denied');
        }
        throw error;
      });
    }

    try {
      const presigned = await createGetObjectPresign({ key });
      const expiresAt = new Date(Date.now() + presigned.expiresIn * 1000).toISOString();

      return {
        key: presigned.key,
        downloadUrl: presigned.downloadUrl,
        expiresIn: presigned.expiresIn,
        expiresAt,
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new HttpError(500, 'Failed to create pre-signed download URL', error);
    }
  }
}
