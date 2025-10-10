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
  CLEANUP_POLL_INTERVAL_MS: z.coerce.number().int().positive().optional(),
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
  CLEANUP_POLL_INTERVAL_MS: process.env.CLEANUP_POLL_INTERVAL_MS,
});

export const env = {
  ...parsed,
  isProduction: parsed.NODE_ENV === 'production',
  isDevelopment: parsed.NODE_ENV === 'development',
  isTest: parsed.NODE_ENV === 'test',
  loadedEnvFile: resolvedEnvFile,
  CLEANUP_POLL_INTERVAL_MS: parsed.CLEANUP_POLL_INTERVAL_MS,
  cleanupPollIntervalMs: parsed.CLEANUP_POLL_INTERVAL_MS ?? 60_000,
};

export type AppEnvironment = typeof env;
