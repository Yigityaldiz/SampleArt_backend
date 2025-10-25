import type { NextFunction, Request, Response } from 'express';
import type { SellerProfile } from '@prisma/client';
import { NotFoundError } from '../../errors';
import { SellerApplicationService } from './service';
import {
  createSellerApplicationBodySchema,
  updateSellerApplicationBodySchema,
} from './schemas';
import { UserService } from '../users/service';
import type { AuthUser } from '../auth';

const service = new SellerApplicationService();
const userService = new UserService();

const toNullable = <T>(value: T | null | undefined) => (value === undefined ? undefined : value);

const ensureUserRecord = async (authUser: AuthUser) => {
  try {
    return await userService.getById(authUser.id);
  } catch (error) {
    if (!(error instanceof NotFoundError)) {
      throw error;
    }

    return userService.create({
      id: authUser.id,
      email: toNullable(authUser.email),
      name: toNullable(authUser.name),
      locale: toNullable(authUser.locale),
    });
  }
};

export const serializeSellerProfile = (profile: SellerProfile) => ({
  id: profile.id,
  userId: profile.userId,
  companyName: profile.companyName,
  brandName: profile.brandName,
  productCategories: profile.productCategories,
  countryCode: profile.countryCode,
  contactName: profile.contactName,
  contactPhone: profile.contactPhone,
  contactEmail: profile.contactEmail,
  taxId: profile.taxId,
  status: profile.status,
  reviewedById: profile.reviewedById,
  reviewedAt: profile.reviewedAt ? profile.reviewedAt.toISOString() : null,
  rejectionReason: profile.rejectionReason,
  createdAt: profile.createdAt.toISOString(),
  updatedAt: profile.updatedAt.toISOString(),
});

export const submitSellerApplication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = req.authUser;
    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    await ensureUserRecord(authUser);

    const body = createSellerApplicationBodySchema.parse(req.body);

    let statusCode = 201;
    try {
      await service.getForUser(authUser.id);
      statusCode = 200;
    } catch (error) {
      if (!(error instanceof NotFoundError)) {
        throw error;
      }
    }

    const profile = await service.submit(authUser.id, body);
    res.status(statusCode).json({ data: serializeSellerProfile(profile) });
  } catch (error) {
    next(error);
  }
};

export const getCurrentSellerApplication = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authUser = req.authUser;
    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    await ensureUserRecord(authUser);

    const profile = await service.getForUser(authUser.id);
    res.json({ data: serializeSellerProfile(profile) });
  } catch (error) {
    next(error);
  }
};

export const updateCurrentSellerApplication = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authUser = req.authUser;
    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    await ensureUserRecord(authUser);

    const body = updateSellerApplicationBodySchema.parse(req.body);
    const profile = await service.updatePending(authUser.id, body);
    res.json({ data: serializeSellerProfile(profile) });
  } catch (error) {
    next(error);
  }
};
