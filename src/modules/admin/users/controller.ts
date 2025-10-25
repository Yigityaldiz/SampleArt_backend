import type { NextFunction, Request, Response } from 'express';
import { UserService } from '../../users/service';
import { listAdminUsersQuerySchema } from './schemas';

const userService = new UserService();

export const listAdminUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listAdminUsersQuerySchema.parse(req.query);
    const { items, total } = await userService.listWithCount(query);

    res.json({
      data: items,
      meta: {
        total,
        skip: query.skip,
        take: query.take,
      },
    });
  } catch (error) {
    next(error);
  }
};
