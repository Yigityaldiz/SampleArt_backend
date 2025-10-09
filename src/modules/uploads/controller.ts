import type { NextFunction, Request, Response } from 'express';
import { createPresignedUploadBodySchema } from './schemas';
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
