import type { RequestHandler } from 'express';
import { NotFoundError } from '../errors/not-found-error';

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new NotFoundError());
};
