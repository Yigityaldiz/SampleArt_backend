export type AuthRole = 'admin' | 'user' | 'viewer';

export interface AuthUser {
  id: string;
  email?: string | null;
  name?: string | null;
  roles: AuthRole[];
  locale?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AuthVerifier {
  verifyRequest: (
    headers: Record<string, string | string[] | undefined>,
  ) => Promise<AuthUser | null>;
}
