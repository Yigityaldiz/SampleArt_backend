import type { NextFunction, Request, Response } from 'express';
import { SellerProfileStatus } from '@prisma/client';
import { NotFoundError } from '../../errors';
import type { AuthUser } from './types';
import { SellerApplicationService } from '../seller-applications/service';
import { serializeSellerProfile } from '../seller-applications/controller';
import { UserService } from '../users/service';

const sellerApplications = new SellerApplicationService();
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

export const sellerAuthLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = req.authUser;
    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    await ensureUserRecord(authUser);

    let profile;
    try {
      profile = await sellerApplications.getForUser(authUser.id);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(403).json({
          error: {
            message: 'Seller application not found',
          },
        });
      }

      throw error;
    }

    if (profile.status === SellerProfileStatus.PENDING) {
      return res.status(403).json({
        error: {
          message: 'Seller application pending approval',
          status: profile.status,
        },
      });
    }

    if (profile.status === SellerProfileStatus.REJECTED) {
      return res.status(403).json({
        error: {
          message: 'Seller application rejected',
          status: profile.status,
          rejectionReason: profile.rejectionReason,
        },
      });
    }

    return res.json({
      data: {
        profile: serializeSellerProfile(profile),
      },
    });
  } catch (error) {
    next(error);
  }
};
