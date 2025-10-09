import type { NextFunction, Request, Response } from 'express';
import { createPresignedUploadBodySchema, createPresignedDownloadBodySchema } from './schemas';
import { UploadService } from './service';

const service = new UploadService();

export const createPresignedUpload = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    const body = createPresignedUploadBodySchema.parse(req.body);
    const result = await service.createPresignedUpload(authUser.id, body);

    return res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const createPresignedDownload = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    const body = createPresignedDownloadBodySchema.parse(req.body);
    const allowAllKeys = authUser.roles.includes('admin');
    const result = await service.createPresignedDownload(authUser.id, body, { allowAllKeys });

    return res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};
