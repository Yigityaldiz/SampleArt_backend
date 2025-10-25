import type { NextFunction, Request, Response } from 'express';
import { HttpError, NotFoundError } from '../../../errors';
import { SellerApplicationAdminService } from '../../seller-applications/admin-service';
import type { SellerProfileAdminView } from '../../seller-applications/repository';
import {
  adminSellerApplicationIdParamSchema,
  listAdminSellerApplicationsQuerySchema,
  rejectSellerApplicationBodySchema,
} from './schemas';
import { UserService } from '../../users/service';
import type { AuthUser } from '../../auth';

const service = new SellerApplicationAdminService();
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

const serializeAdminSellerProfile = (profile: SellerProfileAdminView) => ({
  id: profile.id,
  user: {
    id: profile.user.id,
    email: profile.user.email,
    name: profile.user.name,
  },
  companyName: profile.companyName,
  brandName: profile.brandName,
  productCategories: profile.productCategories,
  countryCode: profile.countryCode,
  contactName: profile.contactName,
  contactPhone: profile.contactPhone,
  contactEmail: profile.contactEmail,
  taxId: profile.taxId,
  status: profile.status,
  reviewedBy: profile.reviewedBy
    ? {
        id: profile.reviewedBy.id,
        email: profile.reviewedBy.email,
        name: profile.reviewedBy.name,
      }
    : null,
  reviewedAt: profile.reviewedAt ? profile.reviewedAt.toISOString() : null,
  rejectionReason: profile.rejectionReason,
  createdAt: profile.createdAt.toISOString(),
  updatedAt: profile.updatedAt.toISOString(),
});

export const listAdminSellerApplications = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = listAdminSellerApplicationsQuerySchema.parse(req.query);
    const { createdFrom, createdTo, skip, take, ...rest } = query;

    const filters = {
      ...rest,
      createdFrom: createdFrom ? new Date(createdFrom) : undefined,
      createdTo: createdTo ? new Date(createdTo) : undefined,
      skip,
      take,
    };

    const { items, total } = await service.list(filters);

    res.json({
      data: items.map(serializeAdminSellerProfile),
      meta: {
        total,
        skip,
        take,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminSellerApplication = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const params = adminSellerApplicationIdParamSchema.parse(req.params);
    const profile = await service.getById(params.applicationId);
    res.json({ data: serializeAdminSellerProfile(profile) });
  } catch (error) {
    next(error);
  }
};

export const approveSellerApplication = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const params = adminSellerApplicationIdParamSchema.parse(req.params);
    const authUser = req.authUser!;
    await ensureUserRecord(authUser);
    await service.approve(params.applicationId, authUser.id);
    const profile = await service.getById(params.applicationId);
    res.json({ data: serializeAdminSellerProfile(profile) });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ error: { message: error.message } });
    }
    next(error);
  }
};

export const rejectSellerApplication = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const params = adminSellerApplicationIdParamSchema.parse(req.params);
    const body = rejectSellerApplicationBodySchema.parse(req.body);

    const authUser = req.authUser!;
    await ensureUserRecord(authUser);
    await service.reject(params.applicationId, authUser.id, body.reason);
    const profile = await service.getById(params.applicationId);
    res.json({ data: serializeAdminSellerProfile(profile) });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ error: { message: error.message } });
    }
    next(error);
  }
};
