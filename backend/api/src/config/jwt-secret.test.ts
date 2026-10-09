import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isVitestProcess,
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

  it('uses the deterministic test-only secret inside Vitest', () => {
    expect(resolveJwtSecret('test', undefined, true)).toBe(testOnlyJwtSecret);
    expect(resolveJwtSecret('test', 'short-local-dev-value', true)).toBe(testOnlyJwtSecret);
    expect(resolveJwtSecret('test', validSecret, true)).toBe(testOnlyJwtSecret);
  });

  it('detects this Vitest run by default (no extra variables needed)', () => {
    expect(isVitestProcess()).toBe(true);
    expect(resolveJwtSecret('test', undefined)).toBe(testOnlyJwtSecret);
  });

  it.each([undefined, '', validSecret])(
    'rejects NODE_ENV=test outside Vitest (JWT_SECRET %j) without printing secrets',
    (value) => {
      const error = (() => {
        try {
          resolveJwtSecret('test', value, false);
        } catch (caught) {
          return caught as Error;
        }
        throw new Error('expected rejection');
      })();

      expect(error).toBeInstanceOf(JwtSecretConfigError);
      expect(error.message).toMatch(/NODE_ENV=test is only allowed inside the Vitest test runner/);
      expect(error.message).not.toContain(testOnlyJwtSecret);
      expect(error.message).not.toContain(validSecret);
    }
  );

  it('keeps development/production rules unchanged regardless of the Vitest signal', () => {
    for (const underVitest of [true, false]) {
      expect(resolveJwtSecret('development', validSecret, underVitest)).toBe(validSecret);
      expect(resolveJwtSecret('production', validSecret, underVitest)).toBe(validSecret);
      expect(() => resolveJwtSecret('production', testOnlyJwtSecret, underVitest)).toThrow(
        /known placeholder/
      );
      expect(() => resolveJwtSecret('development', undefined, underVitest)).toThrow(
        /JWT_SECRET is required/
      );
    }
  });
});

describe('isVitestProcess', () => {
  const workerEnv = { VITEST: 'true', VITEST_WORKER_ID: '3', VITEST_POOL_ID: '1' };

  it('requires the variables Vitest sets in its workers', () => {
    expect(isVitestProcess(workerEnv)).toBe(true);
  });

  it.each([
    ['nothing', {}],
    ['only NODE_ENV=test', { NODE_ENV: 'test' }],
    ['only VITEST=true', { VITEST: 'true' }],
    ['VITEST without a pool id', { VITEST: 'true', VITEST_WORKER_ID: '1' }],
    ['VITEST=false', { ...workerEnv, VITEST: 'false' }],
    ['empty worker id', { ...workerEnv, VITEST_WORKER_ID: '' }]
  ])('is false for %s', (_label, env) => {
    expect(isVitestProcess(env)).toBe(false);
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

  it('starts in development with a valid secret', () => {
    const result = loadEnv({ NODE_ENV: 'development', JWT_SECRET: validSecret });

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it('fails fast in development with the public test-only secret without printing it', () => {
    const result = loadEnv({ NODE_ENV: 'development', JWT_SECRET: testOnlyJwtSecret });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('known placeholder');
    expect(result.stderr + result.stdout).not.toContain(testOnlyJwtSecret);
  });

  it.each(['', validSecret])(
    'refuses a standalone process with NODE_ENV=test (JWT_SECRET %j)',
    (secret) => {
      const result = loadEnv({ NODE_ENV: 'test', JWT_SECRET: secret });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        'Invalid configuration: NODE_ENV=test is only allowed inside the Vitest test runner'
      );
      expect(result.stderr + result.stdout).not.toContain(testOnlyJwtSecret);
    }
  );

  it('refuses to start the real server with NODE_ENV=test', () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
      cwd: apiRoot,
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        PATH: process.env.PATH ?? '',
        SystemRoot: process.env.SystemRoot ?? '',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/tazascan',
        NODE_ENV: 'test',
        JWT_SECRET: '',
        PORT: '45999' // never bound: configuration fails before listen()
      }
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('NODE_ENV=test is only allowed inside the Vitest test runner');
    expect(result.stdout).not.toContain('"event":"startup"');
  });

  it('initializes NODE_ENV=test without JWT_SECRET when Vitest worker variables are present', () => {
    const result = loadEnv({
      NODE_ENV: 'test',
      JWT_SECRET: '',
      VITEST: 'true',
      VITEST_WORKER_ID: '1',
      VITEST_POOL_ID: '1'
    });

    expect(result.status).toBe(0);
  });
});
