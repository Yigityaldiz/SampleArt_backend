import {
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  CognitoIdentityProvider,
} from '@aws-sdk/client-cognito-identity-provider';
import { env } from '../config';
import { logger } from './logger';

const region = env.cognito.region ?? env.AWS_REGION;
const userPoolId = env.cognito.userPoolId;
const jwksUri =
  env.cognito.jwksUri ??
  (region && userPoolId
    ? `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`
    : null);

export const cognito = new CognitoIdentityProvider(
  region
    ? {
        region,
      }
    : {},
);

const issuer =
  region && userPoolId ? `https://cognito-idp.${region}.amazonaws.com/${userPoolId}` : null;

type JoseModule = typeof import('jose');
type RemoteJWKSet = ReturnType<JoseModule['createRemoteJWKSet']>;

let joseModulePromise: Promise<JoseModule> | null = null;
let jwks: RemoteJWKSet | null = null;

const loadJose = async (): Promise<JoseModule> => {
  if (!joseModulePromise) {
    joseModulePromise = import('jose');
  }

  return joseModulePromise;
};

const getJwks = async (): Promise<RemoteJWKSet | null> => {
  if (!jwksUri) {
    return null;
  }

  if (!jwks) {
    const { createRemoteJWKSet } = await loadJose();
    jwks = createRemoteJWKSet(new URL(jwksUri));
  }

  return jwks;
};

interface VerifyTokenOptions {
  requireTokenUse?: Array<'id' | 'access'>;
  audience?: string | string[];
}

export interface CognitoTokenPayload {
  sub: string;
  username?: string;
  email?: string;
  name?: string;
  'cognito:groups'?: string[];
  token_use?: 'id' | 'access';
  [key: string]: unknown;
}

export const verifyCognitoToken = async <TPayload extends CognitoTokenPayload = CognitoTokenPayload>(
  token: string,
  options: VerifyTokenOptions = {},
): Promise<TPayload | null> => {
  const remoteJwks = await getJwks();

  if (!remoteJwks || !issuer) {
    logger.warn('Cognito JWKS configuration missing; skipping token verification.');
    return null;
  }

  const { requireTokenUse, audience } = options;

  try {
    const { jwtVerify } = await loadJose();
    const { payload } = await jwtVerify(token, remoteJwks, {
      issuer,
      audience,
    });

    const tokenUse = payload.token_use;

    if (requireTokenUse && (!tokenUse || !requireTokenUse.includes(tokenUse as 'id' | 'access'))) {
      logger.warn({ tokenUse }, 'Cognito token has unexpected token_use claim.');
      return null;
    }

    return payload as TPayload;
  } catch (error) {
    logger.warn({ err: error }, 'Failed to verify Cognito token');
    return null;
  }
};

export const addUserToCognitoGroup = async (params: { username: string; group: string }) => {
  if (!userPoolId || !params.group) {
    logger.warn('Cognito group configuration missing; skipping addUserToGroup');
    return;
  }

  try {
    await cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: params.username,
        GroupName: params.group,
      }),
    );
  } catch (error) {
    logger.warn(
      { err: error, userPoolId, username: params.username, group: params.group },
      'Failed to add user to Cognito group',
    );
  }
};

export const removeUserFromCognitoGroup = async (params: { username: string; group: string }) => {
  if (!userPoolId || !params.group) {
    logger.warn('Cognito group configuration missing; skipping removeUserFromGroup');
    return;
  }

  try {
    await cognito.send(
      new AdminRemoveUserFromGroupCommand({
        UserPoolId: userPoolId,
        Username: params.username,
        GroupName: params.group,
      }),
    );
  } catch (error) {
    logger.warn(
      { err: error, userPoolId, username: params.username, group: params.group },
      'Failed to remove user from Cognito group',
    );
  }
};
