import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config';

const hasStaticCredentials = Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);

const createS3Client = () =>
  new S3Client({
    region: env.AWS_REGION,
    credentials: hasStaticCredentials
      ? {
          accessKeyId: env.AWS_ACCESS_KEY_ID as string,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY as string,
        }
      : undefined,
  });

const globalForS3 = globalThis as unknown as {
  s3Client?: S3Client;
};

export const s3Client = globalForS3.s3Client ?? createS3Client();

if (!env.isProduction) {
  globalForS3.s3Client = s3Client;
}

const CONTENT_TYPE_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/gif': 'gif',
};

const sanitizeExtension = (extension?: string) => {
  if (!extension) {
    return undefined;
  }

  const normalized = extension.replace(/^\./, '').toLowerCase().trim();
  return /^[a-z0-9]+$/.test(normalized) ? normalized : undefined;
};

const inferExtension = (contentType: string, extension?: string) => {
  const sanitized = sanitizeExtension(extension);
  if (sanitized) {
    return sanitized;
  }

  const mapped = CONTENT_TYPE_EXTENSION_MAP[contentType.toLowerCase()];
  if (mapped) {
    return mapped;
  }

  const [, subtype] = contentType.split('/');
  return sanitizeExtension(subtype);
};

export const buildObjectKey = (params: { userId: string; extension?: string }) => {
  const { userId, extension } = params;
  const suffix = extension ? `.${extension}` : '';
  return `samples/${userId}/${randomUUID()}${suffix}`;
};

export const publicUrlFor = (key: string) => {
  if (!env.S3_BUCKET) {
    throw new Error('S3 bucket is not configured');
  }

  const base = env.CDN_BASE_URL ?? `https://${env.S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com`;
  return `${base.replace(/\/$/, '')}/${key}`;
};

const DEFAULT_PRESIGN_EXPIRATION_SECONDS = 900;

export interface PresignedPutObject {
  key: string;
  uploadUrl: string;
  publicUrl: string;
  expiresIn: number;
}

export interface PresignedGetObject {
  key: string;
  downloadUrl: string;
  expiresIn: number;
}

export const createPutObjectPresign = async (params: {
  userId: string;
  contentType: string;
  extension?: string;
  expiresInSeconds?: number;
}): Promise<PresignedPutObject> => {
  if (!env.S3_BUCKET) {
    throw new Error('S3 bucket is not configured');
  }

  const { userId, contentType, extension, expiresInSeconds } = params;
  const key = buildObjectKey({ userId, extension: inferExtension(contentType, extension) });
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const expiresIn = expiresInSeconds ?? DEFAULT_PRESIGN_EXPIRATION_SECONDS;
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

  return {
    key,
    uploadUrl,
    publicUrl: publicUrlFor(key),
    expiresIn,
  };
};

export const createGetObjectPresign = async (params: {
  key: string;
  expiresInSeconds?: number;
}): Promise<PresignedGetObject> => {
  if (!env.S3_BUCKET) {
    throw new Error('S3 bucket is not configured');
  }

  const { key, expiresInSeconds } = params;
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
  });

  const expiresIn = expiresInSeconds ?? DEFAULT_PRESIGN_EXPIRATION_SECONDS;
  const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn });

  return {
    key,
    downloadUrl,
    expiresIn,
  };
};
