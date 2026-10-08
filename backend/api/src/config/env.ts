import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGIN: z.string().default(''),
  // Number of reverse proxies in front of the API whose X-Forwarded-For
  // entries are trusted. 0 = ignore X-Forwarded-For (direct exposure / local dev).
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  JWT_SECRET: z.string().optional(),
  JWT_ACCESS_TOKEN_TTL: z.string().default('15m'),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),
  PUBLIC_UPLOADS_BASE_URL: z.string().url().optional(),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  UPLOAD_ROOT: z.string().min(1).default('uploads'),
  ALLOW_LOCAL_PRODUCTION_STORAGE: z
    .string()
    .optional()
    .transform((value) => value === 'true')
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables', parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

if (parsedEnv.data.NODE_ENV === 'production') {
  const missingSecrets = [
    'JWT_SECRET',
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD',
    'DATABASE_URL',
    'CORS_ORIGIN',
    'PUBLIC_UPLOADS_BASE_URL'
  ].filter(
    (key) => !parsedEnv.data[key as keyof typeof parsedEnv.data]
  );

  if (missingSecrets.length > 0) {
    console.error(`Missing required production secrets: ${missingSecrets.join(', ')}`);
    process.exit(1);
  }
}

export const env = {
  ...parsedEnv.data,
  jwtSecret:
    parsedEnv.data.JWT_SECRET ??
    'development-only-change-this-secret-before-production',
  corsOrigins: parsedEnv.data.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  trustProxyHops: parsedEnv.data.TRUST_PROXY_HOPS,
  publicUploadsBaseUrl: parsedEnv.data.PUBLIC_UPLOADS_BASE_URL,
  storageDriver: parsedEnv.data.STORAGE_DRIVER,
  uploadRoot: parsedEnv.data.UPLOAD_ROOT,
  allowLocalProductionStorage: parsedEnv.data.ALLOW_LOCAL_PRODUCTION_STORAGE
};
