import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

const cwd = process.cwd();
const explicitEnvFile = process.env.ENV_FILE;
const candidateFiles = explicitEnvFile ? [explicitEnvFile] : ['.env.local', '.env'];

const resolvedEnvFile = candidateFiles
  .map((file) => path.resolve(cwd, file))
  .find((absolutePath) => fs.existsSync(absolutePath));

if (resolvedEnvFile) {
  dotenv.config({ path: resolvedEnvFile });
} else {
  dotenv.config();
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .default('postgresql://sample_art:sample_art@localhost:5432/sample_art?schema=public'),
  UPLOAD_ROOT: z.string().min(1).default('storage/uploads'),
  AWS_REGION: z.string().min(1).default('eu-central-1'),
  S3_BUCKET: z.string().min(1).optional(),
  AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
  AWS_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  CDN_BASE_URL: z.string().url().optional(),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default(process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  COGNITO_REGION: z.string().min(1).optional(),
  COGNITO_USER_POOL_ID: z.string().min(1).optional(),
  COGNITO_CLIENT_ID_USER: z.string().min(1).optional(),
  COGNITO_CLIENT_ID_SELLER: z.string().min(1).optional(),
  COGNITO_CLIENT_ID_ADMIN: z.string().min(1).optional(),
  COGNITO_JWKS_URI: z.string().url().optional(),
  COGNITO_DOMAIN: z.string().optional(),
  COGNITO_SELLER_GROUP: z.string().default('seller'),
  COGNITO_USER_GROUP: z.string().default('user'),
  CLEANUP_POLL_INTERVAL_MS: z.coerce.number().int().positive().optional(),
  HTTPS_CERT_PATH: z.string().min(1).optional(),
  HTTPS_KEY_PATH: z.string().min(1).optional(),
  HTTPS_CA_PATH: z.string().min(1).optional(),
  FORCE_HTTPS_REDIRECT: z
    .enum(['true', 'false'])
    .default(process.env.NODE_ENV === 'production' ? 'true' : 'false')
    .transform((value) => value === 'true'),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  IOS_APP_IDS: z.string().optional(),
  IOS_APP_PATHS: z.string().optional(),
  IOS_DEEP_LINK_SCHEME: z.string().min(1).default('sampleart'),
});

const parsed = EnvSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  UPLOAD_ROOT: process.env.UPLOAD_ROOT,
  AWS_REGION: process.env.AWS_REGION,
  S3_BUCKET: process.env.S3_BUCKET,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  CDN_BASE_URL: process.env.CDN_BASE_URL,
  LOG_LEVEL: process.env.LOG_LEVEL,
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  COGNITO_REGION: process.env.COGNITO_REGION,
  COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID,
  COGNITO_CLIENT_ID_USER: process.env.COGNITO_CLIENT_ID_USER,
  COGNITO_CLIENT_ID_SELLER: process.env.COGNITO_CLIENT_ID_SELLER,
  COGNITO_CLIENT_ID_ADMIN: process.env.COGNITO_CLIENT_ID_ADMIN,
  COGNITO_JWKS_URI: process.env.COGNITO_JWKS_URI,
  COGNITO_DOMAIN: process.env.COGNITO_DOMAIN,
  COGNITO_SELLER_GROUP: process.env.COGNITO_SELLER_GROUP,
  COGNITO_USER_GROUP: process.env.COGNITO_USER_GROUP,
  CLEANUP_POLL_INTERVAL_MS: process.env.CLEANUP_POLL_INTERVAL_MS,
  HTTPS_CERT_PATH: process.env.HTTPS_CERT_PATH,
  HTTPS_KEY_PATH: process.env.HTTPS_KEY_PATH,
  HTTPS_CA_PATH: process.env.HTTPS_CA_PATH,
  FORCE_HTTPS_REDIRECT: process.env.FORCE_HTTPS_REDIRECT,
  CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS,
  IOS_APP_IDS: process.env.IOS_APP_IDS,
  IOS_APP_PATHS: process.env.IOS_APP_PATHS,
  IOS_DEEP_LINK_SCHEME: process.env.IOS_DEEP_LINK_SCHEME,
});

if ((parsed.HTTPS_CERT_PATH && !parsed.HTTPS_KEY_PATH) || (!parsed.HTTPS_CERT_PATH && parsed.HTTPS_KEY_PATH)) {
  throw new Error('HTTPS_CERT_PATH and HTTPS_KEY_PATH must both be set to enable HTTPS');
}

export const env = {
  ...parsed,
  isProduction: parsed.NODE_ENV === 'production',
  isDevelopment: parsed.NODE_ENV === 'development',
  isTest: parsed.NODE_ENV === 'test',
  loadedEnvFile: resolvedEnvFile,
  CLEANUP_POLL_INTERVAL_MS: parsed.CLEANUP_POLL_INTERVAL_MS,
  cleanupPollIntervalMs: parsed.CLEANUP_POLL_INTERVAL_MS ?? 60_000,
  httpsEnabled: Boolean(parsed.HTTPS_CERT_PATH && parsed.HTTPS_KEY_PATH),
  forceHttpsRedirect: parsed.FORCE_HTTPS_REDIRECT,
  cognito: {
    region: parsed.COGNITO_REGION ?? null,
    userPoolId: parsed.COGNITO_USER_POOL_ID ?? null,
    clientIdUser: parsed.COGNITO_CLIENT_ID_USER ?? null,
    clientIdSeller: parsed.COGNITO_CLIENT_ID_SELLER ?? null,
    clientIdAdmin: parsed.COGNITO_CLIENT_ID_ADMIN ?? null,
    jwksUri: parsed.COGNITO_JWKS_URI ?? null,
    domain: parsed.COGNITO_DOMAIN ?? null,
    sellerGroup: parsed.COGNITO_SELLER_GROUP,
    userGroup: parsed.COGNITO_USER_GROUP,
  },
  corsAllowedOrigins: parsed.CORS_ALLOWED_ORIGINS
    ? parsed.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter((origin) => origin.length > 0)
    : null,
  iosAppIds: parsed.IOS_APP_IDS
    ? parsed.IOS_APP_IDS.split(',').map((id) => id.trim()).filter((id) => id.length > 0)
    : ['TEAMID.com.sampleart.app'],
  iosAppPaths: parsed.IOS_APP_PATHS
    ? parsed.IOS_APP_PATHS.split(',').map((path) => path.trim()).filter((path) => path.length > 0)
    : ['/invite/*'],
  iosDeepLinkScheme: parsed.IOS_DEEP_LINK_SCHEME,
};

export type AppEnvironment = typeof env;
