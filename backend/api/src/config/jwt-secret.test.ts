import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  JwtSecretConfigError,
  minJwtSecretLength,
  resolveJwtSecret,
  testOnlyJwtSecret
} from './jwt-secret';

// Random-looking, clearly fake values; never real secrets.
const validSecret = 'k7Q2vX9pL4mN8rT1wY6zB3cF5hJ0dG2s-fake-for-tests';
const exactly32 = 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6';

describe('resolveJwtSecret', () => {
  it.each(['development', 'production'])('accepts a random 32+ character secret in %s', (nodeEnv) => {
    expect(resolveJwtSecret(nodeEnv, validSecret)).toBe(validSecret);
  });

  it('accepts exactly the minimum length and trims surrounding whitespace', () => {
    expect(exactly32).toHaveLength(minJwtSecretLength);
    expect(resolveJwtSecret('production', `  ${exactly32}\n`)).toBe(exactly32);
  });

  it.each([undefined, '', '   '])('rejects a missing JWT_SECRET outside test (%j)', (value) => {
    expect(() => resolveJwtSecret('development', value)).toThrow(JwtSecretConfigError);
    expect(() => resolveJwtSecret('production', value)).toThrow(/JWT_SECRET is required/);
  });

  it('rejects a secret one character shorter than the minimum', () => {
    expect(() => resolveJwtSecret('production', exactly32.slice(1))).toThrow(
      `JWT_SECRET must be at least ${minJwtSecretLength} characters long.`
    );
  });

  it.each([
    'development-only-change-this-secret-before-production',
    'change-this-secret-in-production',
    'CHANGE-THIS-SECRET-IN-PRODUCTION',
    'replace-with-a-local-development-secret',
    testOnlyJwtSecret
  ])('rejects the known placeholder %s', (placeholder) => {
    expect(() => resolveJwtSecret('production', placeholder)).toThrow(/known placeholder/);
    expect(() => resolveJwtSecret('development', placeholder)).toThrow(JwtSecretConfigError);
  });

  it.each(['change-me', 'secret'])('rejects the short placeholder %s', (placeholder) => {
    expect(() => resolveJwtSecret('production', placeholder)).toThrow(JwtSecretConfigError);
  });

  it('rejects long but obviously non-random values', () => {
    expect(() => resolveJwtSecret('production', 'a'.repeat(64))).toThrow(/non-random/);
    expect(() => resolveJwtSecret('production', 'ab'.repeat(32))).toThrow(/non-random/);
  });

  it('never includes the secret value in error messages', () => {
    const shortSecret = 'Zq8-short-but-sensitive';
    const error = (() => {
      try {
        resolveJwtSecret('production', shortSecret);
      } catch (caught) {
        return caught as Error;
      }
      throw new Error('expected rejection');
    })();

    expect(error.message).not.toContain(shortSecret);
  });

  it('uses the deterministic test-only secret in the test environment', () => {
    expect(resolveJwtSecret('test', undefined)).toBe(testOnlyJwtSecret);
    expect(resolveJwtSecret('test', 'short-local-dev-value')).toBe(testOnlyJwtSecret);
    expect(resolveJwtSecret('test', validSecret)).toBe(testOnlyJwtSecret);
  });
});

describe('startup configuration (env.ts)', () => {
  const apiRoot = path.resolve(__dirname, '../..');

  // Runs env.ts in a fresh Node process, as the server does at startup.
  function loadEnv(overrides: Record<string, string>) {
    return spawnSync(process.execPath, ['--import', 'tsx', 'src/config/env.ts'], {
      cwd: apiRoot,
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        PATH: process.env.PATH ?? '',
        SystemRoot: process.env.SystemRoot ?? '',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/tazascan',
        // Explicit (possibly empty) values so dotenv cannot fill them from a local .env.
        JWT_SECRET: '',
        ...overrides
      }
    });
  }

  const productionVars = {
    NODE_ENV: 'production',
    CORS_ORIGIN: 'https://admin.example.com',
    ADMIN_EMAIL: 'admin@example.com',
    ADMIN_PASSWORD: 'example-admin-password',
    PUBLIC_UPLOADS_BASE_URL: 'https://api.example.com/uploads'
  };

  it('fails fast in development when JWT_SECRET is missing', () => {
    const result = loadEnv({ NODE_ENV: 'development', JWT_SECRET: '' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Invalid configuration: JWT_SECRET is required');
  });

  it('fails fast in production with a placeholder secret without printing it', () => {
    const placeholder = 'change-this-secret-in-production';
    const result = loadEnv({ ...productionVars, JWT_SECRET: placeholder });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('known placeholder');
    expect(result.stderr + result.stdout).not.toContain(placeholder);
  });

  it('fails fast in production with a too-short secret', () => {
    const result = loadEnv({ ...productionVars, JWT_SECRET: 'Zq8-short-but-sensitive' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`at least ${minJwtSecretLength} characters`);
    expect(result.stderr).not.toContain('Zq8-short-but-sensitive');
  });

  it('starts with a valid secret', () => {
    const result = loadEnv({ ...productionVars, JWT_SECRET: validSecret });

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it('initializes in the test environment without any JWT_SECRET', () => {
    const result = loadEnv({ NODE_ENV: 'test', JWT_SECRET: '' });

    expect(result.status).toBe(0);
  });
});
