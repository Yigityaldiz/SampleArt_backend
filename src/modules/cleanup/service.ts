import {
  CleanupEntity,
  CleanupStatus,
  Prisma,
  type CleanupTask,
  type PrismaClient,
} from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { deleteS3Objects } from '../../lib/s3';
import { logger } from '../../lib/logger';

const DEFAULT_RETRY_DELAY_MS = 5 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 10;

const isRecordNotFoundError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';

const normalizeObjectKeys = (keys?: unknown): string[] => {
  if (!Array.isArray(keys)) {
    return [];
  }

  return keys
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0);
};

const nowPlus = (ms: number) => new Date(Date.now() + ms);

const toJson = (value: Record<string, unknown>): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

interface EnqueueSampleParams {
  sampleId: string;
  userId: string;
  objectKeys?: string[];
  scheduleAt?: Date;
}

interface EnqueueUserParams {
  userId: string;
  objectKeys?: string[];
  scheduleAt?: Date;
}

export class CleanupTaskService {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    private readonly batchSize = DEFAULT_BATCH_SIZE,
  ) {}

  async enqueueSampleCleanup(params: EnqueueSampleParams): Promise<void> {
    const payload = {
      sampleId: params.sampleId,
      userId: params.userId,
      objectKeys: params.objectKeys ?? [],
    };

    await this.upsertTask(
      CleanupEntity.SAMPLE,
      params.sampleId,
      toJson(payload),
      params.scheduleAt,
    );
  }

  async enqueueUserCleanup(params: EnqueueUserParams): Promise<void> {
    const payload = {
      userId: params.userId,
      objectKeys: params.objectKeys ?? [],
    };

    await this.upsertTask(
      CleanupEntity.USER,
      params.userId,
      toJson(payload),
      params.scheduleAt,
    );
  }

  async processPending(limit = this.batchSize): Promise<void> {
    const tasks = await this.db.cleanupTask.findMany({
      where: {
        status: { in: [CleanupStatus.PENDING, CleanupStatus.FAILED] },
        scheduledAt: { lte: new Date() },
      },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
    });

    if (tasks.length === 0) {
      return;
    }

    for (const task of tasks) {
      const claimed = await this.markRunning(task.id);
      if (!claimed) {
        continue;
      }

      try {
        await this.processTask(claimed);
        await this.markCompleted(claimed.id);
      } catch (error) {
        logger.error(
          { err: error, taskId: claimed.id, entityType: claimed.entityType },
          'Cleanup task failed',
        );
        await this.markFailed(claimed.id, error as Error);
      }
    }
  }

  private async upsertTask(
    entityType: CleanupEntity,
    entityId: string,
    payload: Prisma.InputJsonValue,
    scheduleAt?: Date,
  ) {
    const existing = await this.db.cleanupTask.findFirst({
      where: {
        entityType,
        entityId,
        status: { in: [CleanupStatus.PENDING, CleanupStatus.FAILED, CleanupStatus.RUNNING] },
      },
    });

    const data = {
      payload,
      scheduledAt: scheduleAt ?? new Date(),
    };

    if (!existing) {
      await this.db.cleanupTask.create({
        data: {
          entityType,
          entityId,
          ...data,
          status: CleanupStatus.PENDING,
        },
      });
      return;
    }

    const statusUpdate =
      existing.status === CleanupStatus.RUNNING
        ? {}
        : { status: CleanupStatus.PENDING, lastError: null };

    await this.db.cleanupTask.update({
      where: { id: existing.id },
      data: {
        ...data,
        ...statusUpdate,
      },
    });
  }

  private async markRunning(id: string): Promise<CleanupTask | null> {
    try {
      return await this.db.cleanupTask.update({
        where: { id },
        data: {
          status: CleanupStatus.RUNNING,
          attempts: { increment: 1 },
          lastError: null,
        },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

  private async markCompleted(id: string): Promise<void> {
    await this.db.cleanupTask.update({
      where: { id },
      data: {
        status: CleanupStatus.COMPLETED,
        lastError: null,
      },
    });
  }

  private async markFailed(id: string, error: Error): Promise<void> {
    await this.db.cleanupTask.update({
      where: { id },
      data: {
        status: CleanupStatus.FAILED,
        scheduledAt: nowPlus(this.retryDelayMs),
        lastError: error.message ?? 'Unknown cleanup error',
      },
    });
  }

  private async processTask(task: CleanupTask): Promise<void> {
    switch (task.entityType) {
      case CleanupEntity.SAMPLE:
        await this.processSampleTask(task);
        break;
      case CleanupEntity.USER:
        await this.processUserTask(task);
        break;
      default:
        logger.warn({ entityType: task.entityType }, 'Unknown cleanup task entity type');
    }
  }

  private async processSampleTask(task: CleanupTask): Promise<void> {
    const rawPayload =
      typeof task.payload === 'object' && task.payload !== null ? task.payload : {};

    const sampleId = (rawPayload as Record<string, unknown>).sampleId ?? task.entityId;
    const sampleIdStr = typeof sampleId === 'string' ? sampleId : task.entityId;

    const initialObjectKeys = normalizeObjectKeys(
      (rawPayload as Record<string, unknown>).objectKeys,
    );

    const sample = await this.db.sample.findUnique({
      where: { id: sampleIdStr },
      include: {
        image: true,
      },
    });

    const objectKeys = new Set(initialObjectKeys);
    if (sample?.image?.objectKey) {
      objectKeys.add(sample.image.objectKey);
    }

    if (objectKeys.size > 0) {
      await deleteS3Objects(Array.from(objectKeys));
    }

    await this.db.$transaction([
      this.db.collectionSample.deleteMany({ where: { sampleId: sampleIdStr } }),
      this.db.sampleImage.deleteMany({ where: { sampleId: sampleIdStr } }),
      this.db.sample.deleteMany({ where: { id: sampleIdStr } }),
    ]);
  }

  private async processUserTask(task: CleanupTask): Promise<void> {
    const rawPayload =
      typeof task.payload === 'object' && task.payload !== null ? task.payload : {};

    const userId = (rawPayload as Record<string, unknown>).userId ?? task.entityId;
    const userIdStr = typeof userId === 'string' ? userId : task.entityId;

    const payloadObjectKeys = normalizeObjectKeys(
      (rawPayload as Record<string, unknown>).objectKeys,
    );

    const [sampleImages, sampleIds] = await Promise.all([
      this.db.sampleImage.findMany({
        where: { sample: { userId: userIdStr } },
        select: { objectKey: true },
      }),
      this.db.sample.findMany({
        where: { userId: userIdStr },
        select: { id: true },
      }),
    ]);

    const objectKeys = new Set(payloadObjectKeys);
    for (const image of sampleImages) {
      if (image.objectKey) {
        objectKeys.add(image.objectKey);
      }
    }

    if (objectKeys.size > 0) {
      await deleteS3Objects(Array.from(objectKeys));
    }

    const sampleIdList = sampleIds.map((item) => item.id);

    await this.db.$transaction([
      this.db.collectionSample.deleteMany({
        where: {
          OR: [
            { sampleId: { in: sampleIdList } },
            { collection: { userId: userIdStr } },
          ],
        },
      }),
      this.db.sampleImage.deleteMany({ where: { sample: { userId: userIdStr } } }),
      this.db.sample.deleteMany({ where: { userId: userIdStr } }),
      this.db.collection.deleteMany({ where: { userId: userIdStr } }),
      this.db.user.deleteMany({ where: { id: userIdStr } }),
      this.db.cleanupTask.deleteMany({
        where: {
          entityType: CleanupEntity.SAMPLE,
          entityId: { in: sampleIdList },
        },
      }),
    ]);
  }
}

export const cleanupTaskService = new CleanupTaskService();
