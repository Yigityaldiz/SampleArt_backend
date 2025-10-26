import {
  ConfirmForgotPasswordCommand,
  ConfirmForgotPasswordCommandOutput,
  ConfirmSignUpCommand,
  ConfirmSignUpCommandOutput,
  ForgotPasswordCommand,
  ForgotPasswordCommandOutput,
  InitiateAuthCommand,
  InitiateAuthCommandOutput,
  SignUpCommand,
  SignUpCommandOutput,
} from '@aws-sdk/client-cognito-identity-provider';
import type { AuthRole, AuthUser, AuthVerifier } from './types';
import { env } from '../../config';
import { logger } from '../../lib/logger';
import { verifyCognitoToken, cognito } from '../../lib/cognito';
import { isSupportedLanguageCode } from '../users/languages';
import type { SupportedLanguageCode } from '../users/languages';

type RoleKind = 'user' | 'seller';

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
  const sessionCookie = cookies.__session ?? cookies.__SESSION ?? cookies.session;

  if (sessionCookie) {
    return { token: sessionCookie, credentialPresent: true };
  }

  return { token: null, credentialPresent: false };
};

const mapGroupsToRoles = (groups: string[] | undefined): AuthRole[] => {
  const normalized = (groups ?? []).map((group) => group.trim().toLowerCase());
  const roles = new Set<AuthRole>();

  for (const group of normalized) {
    if (group === 'admin') {
      roles.add('admin');
    } else if (group === 'seller') {
      roles.add('seller');
    } else if (group === 'viewer') {
      roles.add('viewer');
    } else if (group === 'user') {
      roles.add('user');
    }
  }

  if (roles.size === 0) {
    roles.add('user');
  }

  return Array.from(roles);
};

const resolveLocale = (payload: Record<string, unknown>): SupportedLanguageCode | null => {
  const rawLocale = payload.locale ?? payload['custom:locale'];
  if (typeof rawLocale === 'string' && isSupportedLanguageCode(rawLocale)) {
    return rawLocale;
  }

  return null;
};

const mapClaimsToAuthUser = (claims: Record<string, unknown>): AuthUser => {
  const groups = Array.isArray(claims['cognito:groups'])
    ? (claims['cognito:groups'] as string[])
    : typeof claims['cognito:groups'] === 'string'
      ? (claims['cognito:groups'] as string).split(',').map((group) => group.trim())
      : undefined;

  const roles = mapGroupsToRoles(groups);

  return {
    id: typeof claims.sub === 'string' ? claims.sub : '',
    email: typeof claims.email === 'string' ? claims.email : null,
    name: typeof claims.name === 'string' ? claims.name : null,
    roles,
    locale: resolveLocale(claims),
    metadata: claims,
  };
};

const unauthorizedError = (message: string, error?: unknown) => {
  const err: Error & { status?: number } = new Error(message);
  err.status = 401;

  if (error instanceof Error) {
    err.cause = error;
  }

  return err;
};

const resolveClientId = (role: RoleKind) => {
  const clientId =
    role === 'seller' ? env.cognito.clientIdSeller : env.cognito.clientIdUser ?? env.cognito.clientIdAdmin;

  if (!clientId) {
    throw new Error(`Cognito client id for role "${role}" is not configured`);
  }

  return clientId;
};

const toAttributeList = (attributes: Record<string, string | null | undefined> = {}) =>
  Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([Name, Value]) => ({ Name, Value: Value as string }));

class CognitoAuthAdapter implements AuthVerifier {
  async verifyRequest(
    headers: Record<string, string | string[] | undefined>,
  ): Promise<AuthUser | null> {
    const { token, credentialPresent } = extractTokenFromHeaders(headers);

    if (!token) {
      if (credentialPresent) {
        throw unauthorizedError('Authorization header was provided but token is invalid.');
      }

      return null;
    }

    const allowedAudiences = [env.cognito.clientIdUser, env.cognito.clientIdSeller, env.cognito.clientIdAdmin].filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );

    const payload = await verifyCognitoToken(token, {
      requireTokenUse: ['id', 'access'],
      audience: allowedAudiences.length > 0 ? allowedAudiences : undefined,
    });

    if (!payload) {
      throw unauthorizedError('Invalid or expired authentication token.');
    }

    const userId = typeof payload.sub === 'string' ? payload.sub : null;

    if (!userId) {
      logger.warn('Cognito token verified but sub claim is missing.');
      throw unauthorizedError('Unable to extract user information from token.');
    }

    return mapClaimsToAuthUser(payload);
  }
}

export const cognitoAuthAdapter: AuthVerifier = new CognitoAuthAdapter();

export interface SignUpParams {
  role: RoleKind;
  username: string;
  password: string;
  attributes?: Record<string, string | null | undefined>;
}

export const signUp = async (params: SignUpParams): Promise<SignUpCommandOutput> => {
  const { role, username, password, attributes } = params;

  return cognito.send(
    new SignUpCommand({
      ClientId: resolveClientId(role),
      Username: username,
      Password: password,
      UserAttributes: toAttributeList(attributes),
    }),
  );
};

export interface ConfirmSignUpParams {
  role: RoleKind;
  username: string;
  code: string;
}

export const confirmSignUp = async (
  params: ConfirmSignUpParams,
): Promise<ConfirmSignUpCommandOutput> => {
  const { role, username, code } = params;

  return cognito.send(
    new ConfirmSignUpCommand({
      ClientId: resolveClientId(role),
      Username: username,
      ConfirmationCode: code,
    }),
  );
};

export interface SignInParams {
  role: RoleKind;
  username: string;
  password: string;
}

export const signIn = async (params: SignInParams): Promise<InitiateAuthCommandOutput> => {
  const { role, username, password } = params;

  return cognito.send(
    new InitiateAuthCommand({
      ClientId: resolveClientId(role),
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    }),
  );
};

export interface ForgotPasswordParams {
  role: RoleKind;
  username: string;
}

export const forgotPassword = async (
  params: ForgotPasswordParams,
): Promise<ForgotPasswordCommandOutput> => {
  const { role, username } = params;

  return cognito.send(
    new ForgotPasswordCommand({
      ClientId: resolveClientId(role),
      Username: username,
    }),
  );
};

export interface ConfirmForgotPasswordParams {
  role: RoleKind;
  username: string;
  code: string;
  newPassword: string;
}

export const confirmForgotPassword = async (
  params: ConfirmForgotPasswordParams,
): Promise<ConfirmForgotPasswordCommandOutput> => {
  const { role, username, code, newPassword } = params;

  return cognito.send(
    new ConfirmForgotPasswordCommand({
      ClientId: resolveClientId(role),
      Username: username,
      ConfirmationCode: code,
      Password: newPassword,
    }),
  );
};
