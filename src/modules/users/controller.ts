import type { NextFunction, Request, Response } from 'express';
import { UserService } from './service';
import {
  listUsersQuerySchema,
  userIdParamSchema,
  createUserBodySchema,
  updateUserBodySchema,
} from './schemas';

const service = new UserService();

const toNullable = <T>(value: T | null | undefined) => (value === undefined ? undefined : value);

export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listUsersQuerySchema.parse(req.query);
    const users = await service.list(query);
    res.json({ data: users });
  } catch (error) {
    next(error);
  }
};

export const getUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = userIdParamSchema.parse(req.params);
    const user = await service.getById(params.id);
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createUserBodySchema.parse(req.body);
    const created = await service.create({
      id: body.id,
      email: toNullable(body.email),
      name: toNullable(body.name),
      locale: toNullable(body.locale),
    });

    res.status(201).json({ data: created });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = userIdParamSchema.parse(req.params);
    const body = updateUserBodySchema.parse(req.body);
    const updated = await service.update(params.id, {
      email: toNullable(body.email),
      name: toNullable(body.name),
      locale: toNullable(body.locale),
    });

    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
};
