import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpError } from '../../errors';
import type { SampleRepository } from '../samples/repository';
import type { CollectionRepository } from '../collections/repository';
import { UploadService } from './service';

const s3Mocks = vi.hoisted(() => ({
  createPutObjectPresign: vi.fn(),
  createGetObjectPresign: vi.fn(),
}));

vi.mock('../../lib/s3', () => ({
  createPutObjectPresign: s3Mocks.createPutObjectPresign,
  createGetObjectPresign: s3Mocks.createGetObjectPresign,
}));

vi.mock('../../config', () => ({
  env: {
    S3_BUCKET: 'bucket',
    AWS_REGION: 'us-east-1',
    isProduction: true,
  },
}));

describe('UploadService.createPresignedDownload', () => {
  const sampleRepo = {
    findById: vi.fn(),
  };

  const collectionRepo = {
    isUserMemberOfSample: vi.fn(),
  };

  let service: UploadService;

  beforeEach(() => {
    vi.resetAllMocks();
    s3Mocks.createGetObjectPresign.mockImplementation(async ({ key }: { key: string }) => ({
      key,
      downloadUrl: 'https://example.com/presign',
      expiresIn: 900,
    }));

    sampleRepo.findById.mockReset();
    collectionRepo.isUserMemberOfSample.mockReset();

    service = new UploadService(
      sampleRepo as unknown as SampleRepository,
      collectionRepo as unknown as CollectionRepository,
    );
  });

  it('returns presign for object owned by requester without extra checks', async () => {
    const result = await service.createPresignedDownload(
      'user_1',
      { objectKey: 'samples/user_1/file.jpg', sampleId: 'sample_1' },
    );

    expect(sampleRepo.findById).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      key: 'samples/user_1/file.jpg',
      downloadUrl: 'https://example.com/presign',
      expiresIn: 900,
    });
  });

  it('bypasses checks when allowAllKeys is true (admin)', async () => {
    const result = await service.createPresignedDownload(
      'admin',
      { objectKey: 'samples/owner/file.jpg', sampleId: 'sample_1' },
      { allowAllKeys: true },
    );

    expect(sampleRepo.findById).not.toHaveBeenCalled();
    expect(collectionRepo.isUserMemberOfSample).not.toHaveBeenCalled();
    expect(result.downloadUrl).toBe('https://example.com/presign');
  });

  it('allows collection member when membership check passes', async () => {
    sampleRepo.findById.mockResolvedValue({
      id: 'sample_1',
      userId: 'owner',
      image: { objectKey: 'samples/owner/file.jpg' },
    });
    collectionRepo.isUserMemberOfSample.mockResolvedValue(true);

    const result = await service.createPresignedDownload('member', {
      objectKey: 'samples/owner/file.jpg',
      sampleId: 'sample_1',
      collectionId: 'col_1',
    });

    expect(sampleRepo.findById).toHaveBeenCalledWith('sample_1');
    expect(collectionRepo.isUserMemberOfSample).toHaveBeenCalledWith({
      userId: 'member',
      sampleId: 'sample_1',
      collectionId: 'col_1',
    });
    expect(result.downloadUrl).toBe('https://example.com/presign');
  });

  it('rejects access when membership check fails', async () => {
    sampleRepo.findById.mockResolvedValue({
      id: 'sample_1',
      userId: 'owner',
      image: { objectKey: 'samples/owner/file.jpg' },
    });
    collectionRepo.isUserMemberOfSample.mockResolvedValue(false);

    await expect(
      service.createPresignedDownload('member', {
        objectKey: 'samples/owner/file.jpg',
        sampleId: 'sample_1',
      }),
    ).rejects.toMatchObject({ statusCode: 403, message: 'Access to object denied' });
  });

  it('throws 404 when sample image does not match object key', async () => {
    sampleRepo.findById.mockResolvedValue({
      id: 'sample_1',
      userId: 'owner',
      image: { objectKey: 'samples/owner/other.jpg' },
    });

    await expect(
      service.createPresignedDownload('member', {
        objectKey: 'samples/owner/file.jpg',
        sampleId: 'sample_1',
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Sample image not found for provided object key',
    });
  });
});
