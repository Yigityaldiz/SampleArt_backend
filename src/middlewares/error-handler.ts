import type { ErrorRequestHandler } from 'express';
import { HttpError } from '../errors/http-error';
import { logger } from '../lib/logger';
import { env } from '../config';

type ErrorResponseBody = {
  error: {
    message: string;
    details?: unknown;
    stack?: string;
  };
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const isHttpError = err instanceof HttpError;
  const normalizedError = err instanceof Error ? err : new Error(String(err));
  const statusCode = isHttpError ? err.statusCode : 500;
  const message = isHttpError ? err.message : 'Internal server error';
  const details = isHttpError ? err.details : undefined;

  logger.error(
    {
      err: normalizedError,
      requestId: req.id,
      path: req.originalUrl,
      method: req.method,
    },
    'Request failed',
  );

  const responseBody: ErrorResponseBody = {
    error: {
      message,
    },
  };

  if (env.isDevelopment && details !== undefined) {
    responseBody.error.details = details;
  }

  if (env.isDevelopment && normalizedError.stack) {
    responseBody.error.stack = normalizedError.stack;
  }

  res.status(statusCode).json(responseBody);
};
