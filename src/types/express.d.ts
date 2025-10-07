import 'express-serve-static-core';
import type { AuthUser } from '../modules/auth/types';

declare global {
  namespace Express {
    interface Request {
      id?: string;
      authUser?: AuthUser;
    }

    interface Locals {
      authUser?: AuthUser;
    }
  }
}

export {};
