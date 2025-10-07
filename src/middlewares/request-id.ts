import { randomUUID } from 'crypto';
import type { RequestHandler } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const incoming = req.header(REQUEST_ID_HEADER) ?? req.header(REQUEST_ID_HEADER.toUpperCase());
  const requestId = incoming ?? randomUUID();

  req.id = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  next();
};
