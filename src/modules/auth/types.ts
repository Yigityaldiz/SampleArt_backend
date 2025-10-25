export type AuthRole = 'admin' | 'user' | 'viewer' | 'seller';

import type { SupportedLanguageCode } from '../users/languages';

export interface AuthUser {
  id: string;
  email?: string | null;
  name?: string | null;
  roles: AuthRole[];
  locale?: SupportedLanguageCode | null;
  metadata?: Record<string, unknown> | null;
}

export interface AuthVerifier {
  verifyRequest: (
    headers: Record<string, string | string[] | undefined>,
  ) => Promise<AuthUser | null>;
}
