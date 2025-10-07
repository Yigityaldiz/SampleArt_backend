import { createClerkClient, verifyToken } from '@clerk/backend';
import type { User } from '@clerk/backend';
import type { AuthRole, AuthUser, AuthVerifier } from './types';
import { env } from '../../config';
import { logger } from '../../lib/logger';

const ALLOWED_ROLES: AuthRole[] = ['admin', 'user', 'viewer'];

const clerkClient = env.CLERK_SECRET_KEY
  ? createClerkClient({
      secretKey: env.CLERK_SECRET_KEY,
      publishableKey: env.CLERK_PUBLISHABLE_KEY,
    })
  : null;

const pickHeaderValue = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

const extractBearerToken = (headerValue: string | undefined): string | null => {
  if (!headerValue) {
    return null;
  }

  const match = headerValue.match(/Bearer\s+(.*)/i);
  return match ? match[1] : null;
};

const parseCookieHeader = (cookieHeader: string | undefined): Record<string, string> => {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(';').reduce<Record<string, string>>((acc, part) => {
    const [rawKey, ...rawValue] = part.split('=');
    const key = rawKey?.trim();

    if (!key) {
      return acc;
    }

    acc[key] = rawValue.join('=').trim();
    return acc;
  }, {});
};

export const extractTokenFromHeaders = (
  headers: Record<string, string | string[] | undefined>,
): { token: string | null; credentialPresent: boolean } => {
  const headerNames = ['authorization', 'Authorization', 'x-forwarded-authorization'];

  for (const name of headerNames) {
    const rawValue = pickHeaderValue(headers[name]);
    const token = extractBearerToken(rawValue);

    if (token) {
      return { token, credentialPresent: true };
    }

    if (rawValue) {
      return { token: null, credentialPresent: true };
    }
  }

  const cookieHeader = pickHeaderValue(headers.cookie);
  const cookies = parseCookieHeader(cookieHeader);
  const sessionCookie = cookies.__session ?? cookies['__session'];

  if (sessionCookie) {
    return { token: sessionCookie, credentialPresent: true };
  }

  return { token: null, credentialPresent: false };
};

const coerceRoles = (rawRoles: unknown): AuthRole[] => {
  if (!rawRoles) {
    return ['user'];
  }

  if (typeof rawRoles === 'string') {
    const single = rawRoles.trim();
    return ALLOWED_ROLES.includes(single as AuthRole) ? [single as AuthRole] : ['user'];
  }

  if (!Array.isArray(rawRoles)) {
    return ['user'];
  }

  const roles = rawRoles
    .map((role) => (typeof role === 'string' ? role.trim() : null))
    .filter((role): role is AuthRole => Boolean(role) && ALLOWED_ROLES.includes(role as AuthRole))
    .map((role) => role as AuthRole);

  return roles.length > 0 ? roles : ['user'];
};

const resolvePrimaryEmail = (user: User): string | null => {
  const emailAddresses = user.emailAddresses ?? [];
  const primaryEmail = emailAddresses.find((email) => email.id === user.primaryEmailAddressId);

  return primaryEmail?.emailAddress ?? emailAddresses[0]?.emailAddress ?? null;
};

const resolveDisplayName = (user: User): string | null => {
  if (user.fullName) {
    return user.fullName;
  }

  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
};

const mapUserToAuthUser = (user: User): AuthUser => {
  const publicMetadata = (user.publicMetadata ?? {}) as Record<string, unknown>;
  const roleSource = user.privateMetadata?.roles ?? publicMetadata.roles;

  return {
    id: user.id,
    email: resolvePrimaryEmail(user),
    name: resolveDisplayName(user),
    locale: (publicMetadata.locale as string | undefined) ?? null,
    roles: coerceRoles(roleSource),
    metadata: publicMetadata,
  };
};

const unauthorizedError = (message: string, error?: unknown) => {
  const err = new Error(message);
  (err as Error & { status?: number }).status = 401;

  if (error instanceof Error) {
    err.cause = error;
  }

  return err;
};

class ClerkAuthAdapter implements AuthVerifier {
  async verifyRequest(
    headers: Record<string, string | string[] | undefined>,
  ): Promise<AuthUser | null> {
    if (!clerkClient || !env.CLERK_SECRET_KEY) {
      logger.warn('Clerk client is not configured. Falling back to anonymous access.');
      return null;
    }

    const { token, credentialPresent } = extractTokenFromHeaders(headers);

    if (!token) {
      if (credentialPresent) {
        throw unauthorizedError('Authorization header was provided but token is invalid.');
      }

      return null;
    }

    try {
      const claims = (await verifyToken(token, {
        secretKey: env.CLERK_SECRET_KEY,
      })) as { sub?: string; userId?: string };

      const userId = claims.sub ?? claims.userId;

      if (!userId) {
        logger.warn('Clerk token verified but userId/sub is missing.');
        throw unauthorizedError('Unable to extract user information from token.');
      }

      const user = await clerkClient.users.getUser(userId);
      return mapUserToAuthUser(user);
    } catch (error) {
      logger.warn({ err: error }, 'Failed to verify Clerk token');
      throw unauthorizedError('Invalid or expired authentication token.', error);
    }
  }
}

export const clerkAuthAdapter: AuthVerifier = new ClerkAuthAdapter();
